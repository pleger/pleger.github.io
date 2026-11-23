import {
  deadlineFields,
  syncDeadlineFields,
  participantFields,
  paperOverview,
  emailAvailability,
} from "./paper-ui.js";
import {
  statuses,
  validOrcid,
  daysUntil,
  safeUrl,
  signedInResearcher,
  visibleResearcherId,
} from "./domain.js";
const $ = (s) => document.querySelector(s),
  esc = (v) =>
    String(v ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
const config = window.PAPER_TRACKER_CONFIG || {},
  remote = !!(config.supabaseUrl && config.supabaseAnonKey);
let db,
  user,
  channel,
  timer,
  selected,
  editing,
  filter = "",
  statusFilter = "",
  authGeneration = 0;
let settings = {
  id: 1,
  email_enabled: null,
  provider: "resend",
  paper_created: true,
  paper_updated: true,
  ticket_assigned: true,
  ticket_completed: true,
  ticket_updated: false,
  weekly_digest: true,
  from_email: "",
  app_url: "https://pleger.github.io/paper-tracker/",
};
let outbox = [];
let invitations = [];
let invitationDraft = null;
let googleEnabled = false,
  unsavedPrefs = false;
let state = { researchers: [], papers: [], tickets: [], activity: [] };
function notice(s) {
  $("#notice").textContent = s;
}
function full(r) {
  return r ? `${r.first_name} ${r.last_name}` : "Sin asignar";
}
function person(id) {
  return state.researchers.find((r) => r.id === id);
}
function actual() {
  return signedInResearcher(state.researchers, user);
}
function admin() {
  return !!actual()?.is_admin;
}
function me() {
  return visibleResearcherId(state.researchers, user, selected);
}
function canWork(paperId) {
  return (
    canEdit() &&
    (admin() ||
      state.papers
        .find((p) => p.id === paperId)
        ?.researcher_ids.includes(actual().id))
  );
}
function activeResearchers() {
  return state.researchers.filter((r) => !r.deleted_at);
}
function requireAdmin() {
  if (!admin()) {
    notice("Esta opción requiere permisos de administrador.");
    return false;
  }
  return true;
}
function badge(s) {
  return `<span class="badge ${esc(s.replaceAll(" ", "-"))}">${esc(s)}</span>`;
}
function dateLabel(d) {
  if (!d) return "Sin fecha";
  return new Intl.DateTimeFormat("es-CL", {
    day: "numeric",
    month: "short",
  }).format(new Date(d + "T12:00:00"));
}
function due(d) {
  const n = daysUntil(d);
  return d
    ? `<span class="date ${n < 0 ? "overdue" : ""}">${esc(dateLabel(d))}${n < 0 ? " · vencido" : n === 0 ? " · hoy" : ""}</span>`
    : '<span class="date">Sin fecha</span>';
}
function avatars(ids) {
  return `<div class="avatars">${ids
    .map((id) => {
      const r = person(id);
      return r
        ? `<span class="avatar" title="${esc(full(r))}">${esc(r.first_name[0] + r.last_name[0])}</span>`
        : "";
    })
    .join("")}</div>`;
}
function canEdit() {
  return remote && !!actual();
}
function requireEdit() {
  if (!canEdit()) {
    notice(
      "Inicia sesión con un correo registrado por el equipo para realizar cambios.",
    );
    return false;
  }
  return true;
}
async function refresh() {
  if (!db || !user) return;
  const generation = authGeneration;
  const names = ["researchers", "papers", "tickets", "activity"];
  const results = await Promise.all(
    names.map((t) =>
      db.from(t).select("*").order("created_at", { ascending: false }),
    ),
  );
  if (generation !== authGeneration) return;
  for (let i = 0; i < results.length; i++) {
    if (results[i].error) throw results[i].error;
    state[names[i]] = results[i].data;
  }
  if (admin()) {
    const [prefs, queue, inviteRows] = await Promise.all([
      db.from("notification_settings").select("*").eq("id", 1).single(),
      db
        .from("notification_outbox")
        .select("id,status,attempts,last_error,created_at")
        .order("created_at", { ascending: false })
        .limit(20),
      db.from("researcher_invitations").select("id,researcher_id,email,expires_at,accepted_at,created_at").order("created_at", { ascending: false }),
    ]);
    if (generation !== authGeneration) return;
    if (prefs.error) throw prefs.error;
    if (queue.error) throw queue.error;
    if (inviteRows.error) throw inviteRows.error;
    settings = prefs.data;
    outbox = queue.data;
    invitations = inviteRows.data;
  }
  if (!actual() || (!$("#modal").open && !unsavedPrefs)) render();
}
async function persist(table, row, update = false) {
  if (!requireEdit()) throw Error("Acceso requerido");
  if (table === "researchers" && !requireAdmin())
    throw Error("Permisos de administrador requeridos");
  if (table === "papers" && update && !requireAdmin())
    throw Error("La configuración de papers requiere un administrador");
  const payload = { ...row };
  if (update) {
    delete payload.id;
    delete payload.created_at;
    if (table === "tickets") delete payload.paper_id;
  }
  const { error } = await (update
    ? db.from(table).update(payload).eq("id", row.id)
    : db.from(table).insert(payload));
  if (error) throw error;
  await refresh();
}
function pageHead(title, sub, action = "") {
  return `<div class="eyebrow">Tu investigación, en movimiento</div><div class="page-heading"><div><h1>${esc(title)}</h1><p class="subtitle">${esc(sub)}</p></div>${action}</div>`;
}
function addButton(type, label) {
  return `<button class="button primary" data-add="${type}">＋ ${label}</button>`;
}
function paperCard(p) {
  const ts = state.tickets.filter((t) => t.paper_id === p.id),
    done = ts.filter((t) => t.completed).length,
    progress = ts.length ? Math.round((done / ts.length) * 100) : 0;
  return `<article class="paper-card"><div class="card-top"><span class="type">${p.kind === "conference" ? "↗ Conferencia" : "▤ Revista"}</span>${badge(p.status)}</div><h3><a href="#paper/${p.id}">${esc(p.title)}</a></h3><p>${esc(p.venue || "Destino por definir")}</p><div class="progress-meta"><span>Tareas completadas</span><span>${done}/${ts.length} · ${progress}%</span></div><div class="progress"><i style="width:${progress}%"></i></div><div class="card-bottom">${avatars(p.researcher_ids)}${due(p.deadline)}</div></article>`;
}
function taskRow(t) {
  return `<div class="task-row ${t.completed ? "completed" : ""}"><input type="checkbox" aria-label="Completar ${esc(t.title)}" data-toggle="${t.id}" ${t.completed ? "checked" : ""} ${canWork(t.paper_id) ? "" : "disabled"}><div class="row-content"><div class="row-title">${esc(t.title)}</div><div class="row-sub"><a href="#paper/${t.paper_id}">${esc(state.papers.find((p) => p.id === t.paper_id)?.title || "Paper")}</a> · ${esc(full(person(t.assignee_id)))}</div>${t.description ? `<div class="row-sub">${esc(t.description)}</div>` : ""}</div>${due(t.deadline)}${canWork(t.paper_id) ? `<button class="button small" data-edit-ticket="${t.id}">Editar</button>` : ""}</div>`;
}
function empty(text) {
  return `<div class="empty">${text}</div>`;
}
function dashboard() {
  const mine = state.tickets
    .filter((t) => t.assignee_id === me() && !t.completed)
    .sort((a, b) => (a.deadline || "9999").localeCompare(b.deadline || "9999"));
  const deadlines = state.papers
    .filter((p) => p.deadline && !["aceptado", "rechazado"].includes(p.status))
    .sort((a, b) => a.deadline.localeCompare(b.deadline));
  return (
    pageHead(
      "Vista general",
      "Cada paper, cada tarea y cada próximo paso, en un solo lugar.",
      addButton("paper", "Nuevo paper"),
    ) +
    `<div class="stats">${[
      [
        "Papers en el espacio",
        state.papers.length,
        "▤",
        "Proyectos de investigación",
      ],
      [
        "En desarrollo",
        state.papers.filter((p) => p.status === "en desarrollo").length,
        "↗",
        "Ideas que toman forma",
      ],
      [
        "En revisión",
        state.papers.filter((p) => p.status === "en revisión").length,
        "◷",
        "Esperando nuevas noticias",
      ],
      [
        "Mis tareas pendientes",
        mine.length,
        "☑",
        "Tu próximo aporte al equipo",
      ],
    ]
      .map(
        ([label, n, icon, sub]) =>
          `<div class="stat"><div class="stat-top">${label}<span class="stat-icon">${icon}</span></div><strong>${n}</strong><small>${sub}</small></div>`,
      )
      .join(
        "",
      )}</div><div class="section-head"><h2>Papers en marcha <span class="badge">${state.papers.length}</span></h2><a href="#papers">Ver todos →</a></div>${state.papers.length ? `<div class="paper-grid">${state.papers.slice(0, 6).map(paperCard).join("")}</div>` : `<div class="empty large"><h3>El próximo paper empieza aquí</h3><p>Crea un proyecto, reúne a sus autores y define el siguiente paso.</p>${addButton("paper", "Crear primer paper")}</div>`}<div class="lower-grid"><section><div class="section-head"><h2>Mis próximos pasos</h2><a href="#tickets">Todos mis tickets →</a></div><div class="panel">${mine.slice(0, 5).map(taskRow).join("") || empty("Todo al día. No tienes tareas pendientes.")}</div></section><section><div class="section-head"><h2>Deadlines de envío</h2><span class="eyebrow">AGENDA</span></div><div class="panel">${
      deadlines
        .slice(0, 5)
        .map(
          (p) =>
            `<div class="deadline-row"><div class="date-tile">${esc(new Intl.DateTimeFormat("es", { month: "short" }).format(new Date(p.deadline + "T12:00:00")))}<strong>${Number(p.deadline.slice(-2))}</strong></div><div class="row-content"><a class="row-title" href="#paper/${p.id}">${esc(p.title)}</a><div class="row-sub">${esc(p.venue || "Conferencia")} · ${due(p.deadline)}</div></div></div>`,
        )
        .join("") || empty("Sin deadlines de envío programados.")
    }</div></section></div>`
  );
}
function render() {
  const route = location.hash.slice(1) || "dashboard",
    section = route.startsWith("paper/") ? "papers" : route;
  const signed = canEdit();
  $(".sidebar nav").hidden = !signed;
  $("#admin-menu").hidden = !admin();
  $("#identity").textContent = actual() ? full(actual()) : "";
  $("#login").textContent = user ? "Cerrar sesión" : "Continuar con Google";
  $("#view-user").innerHTML =
    '<option value="">Mi propia vista</option>' +
    activeResearchers()
      .map(
        (r) =>
          `<option value="${r.id}" ${selected === r.id ? "selected" : ""}>${esc(full(r))}</option>`,
      )
      .join("");
  document
    .querySelectorAll("[data-nav]")
    .forEach((a) => a.classList.toggle("active", a.dataset.nav === section));
  $("#breadcrumb").textContent =
    "Espacio de investigación / " +
    ({
      dashboard: "Vista general",
      papers: "Papers",
      tickets: "Mis tickets",
      researchers: "Investigadores",
      activity: "Actividad",
    }[section] || "Administración");
  if (!signed) {
    const pendingInvite = window.sessionStorage.getItem("paper-trail-invite");
    $("#unread").textContent = "";
    $("#main").innerHTML =
      `<section class="login-panel"><div class="eyebrow">INVESTIGACIÓN COMPARTIDA</div><h1>${pendingInvite ? "Aceptar invitación" : "Bienvenido a Paper Trail"}</h1><p>${pendingInvite ? "Inicia sesión con la cuenta Google a la que se envió la invitación." : "Inicia sesión con tu cuenta Google registrada para acceder a los papers y tareas del equipo."}</p>${!remote ? '<p class="setup-message">Estamos preparando el acceso privado. La configuración del servicio de autenticación aún está pendiente.</p>' : user ? `<p class="setup-message">${pendingInvite ? "Esta cuenta Google no coincide con la invitación, o el enlace venció. Cierra sesión e inicia con el correo invitado." : "Tu cuenta no está registrada o fue desactivada. Contacta a un administrador."}</p>` : '<button class="button primary" id="google-signin">Continuar con Google</button>'}</section>`;
    return;
  }
  if (route.startsWith("admin/") && !admin()) {
    $("#main").innerHTML = empty(
      "Solo los administradores pueden acceder a esta sección.",
    );
    return;
  }
  let html = "";
  if (route === "dashboard") html = dashboard();
  else if (route === "admin/papers")
    html =
      pageHead(
        "Configuración de papers",
        "Edita participantes, destino, estado editorial, repositorio y fechas.",
      ) +
      `<div class="panel">${state.papers.map((p) => `<div class="person-row"><div class="row-content"><a href="#paper/${p.id}" class="row-title">${esc(p.title)}</a><div class="row-sub">${esc(p.venue)} · ${esc(p.status)} · ${p.researcher_ids.length} participantes</div></div><button class="button small" data-edit-paper="${p.id}">Configurar</button></div>`).join("") || empty("Aún no hay papers para configurar.")}</div>`;
  else if (route === "admin/notifications") html = notificationsPanel();
  else if (route === "admin/invitations") html = invitationsPanel();
  else if (route === "papers")
    html =
      pageHead(
        "Nuestros papers",
        "Del primer borrador a la publicación.",
        addButton("paper", "Nuevo paper"),
      ) +
      `<div class="toolbar"><input id="search" placeholder="Buscar un paper…" aria-label="Buscar paper" value="${esc(filter)}"><select id="status-filter" aria-label="Filtrar estado"><option value="">Todos los estados</option>${statuses.map((s) => `<option ${statusFilter === s ? "selected" : ""}>${s}</option>`).join("")}</select></div><div class="paper-grid">${
        state.papers
          .filter(
            (p) =>
              p.title.toLowerCase().includes(filter.toLowerCase()) &&
              (!statusFilter || p.status === statusFilter),
          )
          .map(paperCard)
          .join("") || empty("No hay papers para mostrar.")
      }</div>`;
  else if (route === "researchers" || route === "admin/researchers")
    html =
      pageHead(
        "Investigadores",
        "Las personas detrás de cada contribución.",
        route.startsWith("admin/")
          ? addButton("researcher", "Agregar investigador")
          : "",
      ) +
      `<div class="paper-grid">${activeResearchers()
        .map(
          (r) =>
            `<article class="researcher-card">${avatars([r.id])}<h3>${esc(full(r))}</h3><p>${r.emails.map(esc).join("<br>") || "Correo pendiente de registrar"}</p><p><a href="https://orcid.org/${esc(r.orcid)}" target="_blank" rel="noopener noreferrer">ORCID ↗ ${esc(r.orcid)}</a></p>${r.is_admin ? '<span class="badge">Administrador</span>' : ""}${route.startsWith("admin/") ? `<div class="detail-actions"><button class="button small" data-edit-researcher="${r.id}">Editar y permisos</button><button class="button small danger" data-delete-researcher="${r.id}">Eliminar</button></div>` : ""}</article>`,
        )
        .join("")}</div>`;
  else if (route === "tickets")
    html =
      pageHead("Mis tickets", "Tu contribución, paso a paso.") +
      `<div class="panel">${
        state.tickets
          .filter((t) => t.assignee_id === me())
          .sort(
            (a, b) =>
              Number(a.completed) - Number(b.completed) ||
              (a.deadline || "9999").localeCompare(b.deadline || "9999"),
          )
          .map(taskRow)
          .join("") ||
        empty("No tienes tickets asignados. Puedes crear uno desde un paper.")
      }</div>`;
  else if (route === "activity") {
    localStorage.setItem("paper-trail-seen", new Date().toISOString());
    html =
      pageHead(
        "Actividad del equipo",
        "Las actualizaciones de tickets se comparten con todo el espacio.",
      ) +
      `<div class="panel">${state.activity.map((a) => `<div class="activity-row"><span class="avatar">↗</span><div class="row-content"><div class="row-title">${esc(a.message)}</div><div class="row-sub">${esc(full(person(a.actor_id)))} · ${esc(new Date(a.created_at).toLocaleString("es-CL"))} ${a.paper_id ? `· <a href="#paper/${a.paper_id}">Ver paper →</a>` : ""}</div></div></div>`).join("") || empty("Las novedades del equipo aparecerán aquí.")}</div>`;
  } else if (route.startsWith("paper/")) {
    const p = state.papers.find((p) => p.id === route.split("/")[1]);
    if (!p) html = empty("Paper no encontrado.");
    else {
      const ts = state.tickets.filter((t) => t.paper_id === p.id);
      html =
        pageHead(p.title, p.venue || "Destino por definir", "") +
        paperOverview(p, state.researchers, {
          canWork: canWork(p.id),
          admin: admin(),
        }) +
        emailAvailability(settings, admin()) +
        `<div class="section-head"><h2>Tickets del paper <span class="badge">${ts.filter((t) => t.completed).length}/${ts.length} completados</span></h2>${canWork(p.id) ? addButton("ticket", "Nuevo ticket") : ""}</div><div class="panel">${
          ts
            .sort((a, b) => Number(a.completed) - Number(b.completed))
            .map(taskRow)
            .join("") || empty("Define el siguiente paso para este paper.")
        }</div><div class="section-head"><h2>Mis tickets en este paper</h2></div><div class="panel">${
          ts
            .filter((t) => t.assignee_id === me() && !t.completed)
            .map(taskRow)
            .join("") || empty("Sin tareas pendientes asignadas a ti.")
        }</div>`;
    }
  } else
    html = empty(
      'Página no encontrada. <a href="#dashboard">Volver al inicio</a>',
    );
  $("#main").innerHTML =
    (admin() && selected && selected !== actual().id
      ? `<div class="view-banner">Vista de tareas de ${esc(full(person(selected)))}. Las acciones se registran como ${esc(full(actual()))}.</div>`
      : "") + html;
  if (route === "admin/invitations") inviteEmailOptions();
  const seen = localStorage.getItem("paper-trail-seen") || "";
  const n = state.activity.filter((a) => a.created_at > seen).length;
  $("#unread").textContent = n || "";
}
function field(name, label, type, value = "", extra = "") {
  return `<label for="f-${name}">${label}</label><input id="f-${name}" name="${name}" type="${type}" value="${esc(value)}" ${extra}>`;
}
function options(rows, value) {
  return rows
    .map(
      ([id, label]) =>
        `<option value="${esc(id)}" ${value === id ? "selected" : ""}>${esc(label)}</option>`,
    )
    .join("");
}
function select(name, label, rows, value) {
  return `<label for="f-${name}">${label}</label><select id="f-${name}" name="${name}">${options(rows, value)}</select>`;
}
function textarea(name, label, value) {
  return `<label for="f-${name}">${label}</label><textarea id="f-${name}" name="${name}">${esc(value || "")}</textarea>`;
}
function openEditor(type, id) {
  if (!requireEdit()) return;
  if ((type === "researcher" || (type === "paper" && id)) && !requireAdmin())
    return;
  const table = {
      paper: "papers",
      ticket: "tickets",
      researcher: "researchers",
    }[type],
    row = state[table].find((x) => x.id === id) || {};
  if (
    type === "ticket" &&
    !canWork(row.paper_id || location.hash.split("/")[1])
  ) {
    notice("Debes participar en este paper para modificar tickets.");
    return;
  }
  editing = { type, table, id };
  $("#dialog-title").textContent =
    `${id ? "Editar" : "Agregar"} ${{ paper: "paper", ticket: "ticket", researcher: "investigador" }[type]}`;
  $("#form-error").textContent = "";
  let html = "";
  if (type === "researcher")
    html =
      field(
        "first_name",
        "Nombre",
        "text",
        row.first_name,
        'required maxlength="100"',
      ) +
      field(
        "last_name",
        "Apellido",
        "text",
        row.last_name,
        'required maxlength="100"',
      ) +
      field(
        "emails",
        "Correos (separados por coma)",
        "text",
        row.emails?.join(", "),
        'placeholder="nombre@universidad.cl"',
      ) +
      '<p class="hint">Después de agregarlo, crea una invitación en Administración. El correo solo podrá entrar tras aceptarla con Google.</p>' +
      field(
        "orcid",
        "ORCID",
        "text",
        row.orcid,
        'required placeholder="0000-0000-0000-0000"',
      ) +
      select(
        "is_admin",
        "Permisos",
        [
          ["false", "Investigador"],
          ["true", "Administrador"],
        ],
        String(row.is_admin || false),
      );
  if (type === "paper")
    html =
      field(
        "title",
        "Título del paper",
        "text",
        row.title,
        'required maxlength="300"',
      ) +
      textarea("description", "Descripción", row.description) +
      select(
        "kind",
        "Tipo",
        [
          ["journal", "Revista"],
          ["conference", "Conferencia"],
        ],
        row.kind || "journal",
      ) +
      field("venue", "Conferencia o revista", "text", row.venue) +
      field(
        "github_url",
        "URL del repositorio (HTTPS)",
        "url",
        row.github_url,
      ) +
      select(
        "status",
        "Estado",
        statuses.map((s) => [s, s]),
        row.status || "iniciando",
      ) +
      deadlineFields(row.deadline) +
      participantFields(
        activeResearchers(),
        row.researcher_ids || [actual().id],
      );
  if (type === "ticket")
    html =
      field(
        "title",
        "Tarea o contribución realizada",
        "text",
        row.title,
        'required maxlength="300"',
      ) +
      textarea("description", "Detalle", row.description) +
      select(
        "assignee_id",
        "Asignado a",
        [
          ["", "Sin asignar"],
          ...activeResearchers()
            .filter((r) =>
              state.papers
                .find(
                  (p) => p.id === (row.paper_id || location.hash.split("/")[1]),
                )
                ?.researcher_ids.includes(r.id),
            )
            .map((r) => [r.id, full(r)]),
        ],
        row.assignee_id || me(),
      ) +
      field("deadline", "Fecha objetivo", "date", row.deadline) +
      select(
        "completed",
        "Estado",
        [
          ["false", "Pendiente"],
          ["true", "Completado"],
        ],
        String(row.completed || false),
      );
  $("#fields").innerHTML =
    (type === "ticket" ? emailAvailability(settings, admin()) : "") + html;
  $("#modal").showModal();
}
$("#editor").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = new FormData(e.target),
    { type, table, id } = editing;
  let row = { id: id || crypto.randomUUID() };
  const str = (n) => String(f.get(n) || "").trim();
  $("#save").disabled = true;
  try {
    if (type === "researcher") {
      row = {
        ...row,
        first_name: str("first_name"),
        last_name: str("last_name"),
        emails: str("emails")
          .split(",")
          .map((e) => e.trim().toLowerCase())
          .filter(Boolean),
        is_admin: str("is_admin") === "true",
        orcid: str("orcid")
          .replace(/^https:\/\/orcid.org\//, "")
          .toUpperCase(),
      };
      if (!validOrcid(row.orcid))
        throw Error("El ORCID no es válido. Revisa sus dígitos.");
      if (row.emails.some((e) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)))
        throw Error("Revisa el formato de los correos.");
      if (
        activeResearchers().some(
          (r) =>
            r.id !== id &&
            (r.orcid === row.orcid ||
              r.emails.some((e) => row.emails.includes(e))),
        )
      )
        throw Error("Este ORCID o correo ya está registrado.");
    }
    if (type === "paper") {
      row = {
        ...row,
        title: str("title"),
        description: str("description"),
        kind: str("kind"),
        venue: str("venue"),
        github_url: str("github_url"),
        status: str("status"),
        deadline:
          str("deadline_mode") === "none" ? null : str("deadline") || null,
        researcher_ids: f.getAll("researcher_ids"),
      };
      if (!row.researcher_ids.length)
        throw Error("Selecciona al menos un investigador.");
      if (!admin() && !row.researcher_ids.includes(actual().id))
        throw Error("Debes incluirte como participante del paper.");
      if (row.github_url && !safeUrl(row.github_url))
        throw Error("El repositorio debe usar una URL HTTPS.");
    }
    if (type === "ticket")
      row = {
        ...row,
        paper_id: id
          ? state.tickets.find((t) => t.id === id).paper_id
          : location.hash.split("/")[1],
        title: str("title"),
        description: str("description"),
        assignee_id: str("assignee_id") || null,
        deadline: str("deadline") || null,
        completed: str("completed") === "true",
      };
    await persist(table, row, !!id);
    $("#modal").close();
    render();
    if (type === "ticket")
      notice(
        settings.email_enabled !== false
          ? "Ticket guardado. Los correos dependen de los eventos habilitados; un administrador puede consultar su estado en Notificaciones."
          : "Ticket guardado. No se envió email: el envío de correos está desactivado. La novedad está disponible en Actividad.",
      );
  } catch (err) {
    $("#form-error").textContent = err.message;
  } finally {
    $("#save").disabled = false;
  }
});
$("#close-modal").onclick = $("#cancel").onclick = () => $("#modal").close();
document.addEventListener("click", async (e) => {
  if (e.target.closest('a[href="#admin/notifications"]') && $("#modal").open)
    $("#modal").close();
  const b = e.target.closest("button");
  if (!b) return;
  if (b.id === "google-signin") {
    $("#login").click();
    return;
  }
  if (b.dataset.deleteResearcher) {
    openDeleteResearcher(b.dataset.deleteResearcher);
    return;
  }
  if (b.dataset.add) openEditor(b.dataset.add);
  for (const type of ["paper", "ticket", "researcher"])
    if (b.dataset["edit" + type[0].toUpperCase() + type.slice(1)])
      openEditor(
        type,
        b.dataset["edit" + type[0].toUpperCase() + type.slice(1)],
      );
});
document.addEventListener("change", async (e) => {
  if (e.target.id === "deadline-mode") {
    syncDeadlineFields($("#editor"));
    return;
  }
  if (e.target.dataset.paperStatus) {
    try {
      const { error } = await db.rpc("set_paper_status", {
        paper: e.target.dataset.paperStatus,
        new_status: e.target.value,
      });
      if (error) throw error;
      await refresh();
    } catch (err) {
      notice(err.message);
      render();
    }
    return;
  }
  if (e.target.dataset.toggle) {
    const t = state.tickets.find((t) => t.id === e.target.dataset.toggle);
    e.target.disabled = true;
    try {
      await persist("tickets", { ...t, completed: e.target.checked }, true);
    } catch (err) {
      notice(err.message);
      render();
    }
  }
  if (e.target.id === "status-filter") {
    statusFilter = e.target.value;
    render();
  }
});
document.addEventListener("input", (e) => {
  if (e.target.id === "search") {
    const pos = e.target.selectionStart;
    filter = e.target.value;
    render();
    $("#search").focus();
    $("#search").setSelectionRange(pos, pos);
  }
});
$("#view-user").onchange = (e) => {
  if (!requireAdmin()) return;
  selected = e.target.value || undefined;
  render();
};
window.addEventListener("hashchange", render);
$("#login").onclick = async () => {
  if (!remote) {
    notice(
      "El acceso Google estará disponible cuando se complete la configuración de Supabase.",
    );
    return;
  }
  try {
    if (user) {
      const { error } = await db.auth.signOut();
      if (error) throw error;
      await syncSession(null);
    } else {
      if (!googleEnabled) {
        notice(
          "El proveedor Google aún está pendiente de configurar en Supabase.",
        );
        return;
      }
      const { error } = await db.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: location.origin + location.pathname,
          queryParams: { prompt: "select_account" },
        },
      });
      if (error) throw error;
    }
  } catch (err) {
    notice(err.message);
  }
};
async function syncSession(session) {
  const generation = ++authGeneration;
  clearInterval(timer);
  const previousChannel = channel;
  channel = null;
  if (previousChannel) await db.removeChannel(previousChannel);
  if (generation !== authGeneration) return;
  if ($("#modal").open) $("#modal").close();
  unsavedPrefs = false;
  user = session?.user;
  selected = undefined;
  state = { researchers: [], papers: [], tickets: [], activity: [] };
  outbox = [];
  render();
  if (!user) return;
  try {
    const pendingInvite = window.sessionStorage.getItem("paper-trail-invite");
    if (pendingInvite) {
      const { data: accepted, error: invitationError } = await db.rpc("accept_researcher_invitation", { token: pendingInvite });
      if (invitationError) throw invitationError;
      if (accepted) window.sessionStorage.removeItem("paper-trail-invite");
    }
    await refresh();
    if (generation !== authGeneration) return;
    if (!actual()) {
      notice(
        "Este correo no está registrado o está desactivado. Solicita acceso a un administrador.",
      );
      return;
    }
    notice("");
    channel = db
      .channel("team-updates-" + generation)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "activity" },
        () => refresh().catch((err) => notice(err.message)),
      )
      .subscribe();
    timer = setInterval(
      () => refresh().catch((err) => notice(err.message)),
      30000,
    );
  } catch (err) {
    if (generation === authGeneration)
      notice(`No fue posible cargar el espacio privado: ${err.message}`);
  }
}
async function start() {
  const invitationToken = location.hash.startsWith("#invite/") ? location.hash.slice(8) : null;
  if (invitationToken && /^[0-9a-f]{64}$/.test(invitationToken)) {
    window.sessionStorage.setItem("paper-trail-invite", invitationToken);
    history.replaceState(null, "", location.pathname + "#dashboard");
  }
  render();
  if (!remote) {
    notice(
      "Acceso privado pendiente de configuración. El modo local y el selector de identidad fueron deshabilitados.",
    );
    return;
  }
  try {
    const { createClient } =
      await import("https://esm.sh/@supabase/supabase-js@2");
    db = createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: { flowType: "pkce" },
    });
    const response = await fetch(config.supabaseUrl + "/auth/v1/settings", {
      headers: { apikey: config.supabaseAnonKey },
    });
    if (response.ok) {
      const authSettings = await response.json();
      googleEnabled = !!authSettings.external?.google;
    }

    $("#connection").textContent = "Espacio privado · Supabase";
    db.auth.onAuthStateChange((event, session) => {
      if (event !== "INITIAL_SESSION" && event !== "TOKEN_REFRESHED")
        setTimeout(() => syncSession(session), 0);
    });
    const { data, error } = await db.auth.getSession();
    if (error) throw error;
    await syncSession(data.session);
  } catch (err) {
    notice(`No fue posible conectar: ${err.message}`);
  }
}
document.addEventListener("input", (e) => {
  if (e.target.closest("#notification-form")) unsavedPrefs = true;
});
function emailProviderHelp(provider) {
  return provider === "gmail"
    ? "Envía desde tu cuenta @gmail.com. Activa la verificación en dos pasos de Google y genera una contraseña de aplicación de 16 caracteres. Se guarda cifrada en Supabase Vault."
    : "Resend requiere una API key y un remitente de un dominio verificado. La clave se guarda cifrada en Supabase Vault.";
}
function emailSecretLabel(provider) {
  return provider === "gmail"
    ? "Nueva contraseña de aplicación de Gmail (16 caracteres)"
    : "Nueva API key de Resend";
}
document.addEventListener("change", (e) => {
  if (e.target.id !== "f-provider") return;
  $("#provider-help").textContent = emailProviderHelp(e.target.value);
  document.querySelector('label[for="f-email_secret"]').textContent =
    emailSecretLabel(e.target.value);
  $("#f-email_secret").value = "";
  unsavedPrefs = true;
});
document.addEventListener("click", async (e) => {
  if (e.target.id !== "test-email") return;
  if (!requireAdmin()) return;
  const button = e.target;
  button.disabled = true;
  try {
    if (unsavedPrefs)
      throw Error("Guarda primero la configuración antes de enviar la prueba.");
    const { error } = await db.rpc("queue_test_email");
    if (error) throw error;
    $("#notification-result").textContent =
      "Prueba en cola para tu correo de inicio de sesión. El servidor la procesará durante el próximo minuto.";
    await refresh();
    if ($("#notification-result"))
      $("#notification-result").textContent =
        "Prueba en cola para tu correo de inicio de sesión. Revisa Últimos envíos durante el próximo minuto.";
  } catch (err) {
    $("#notification-result").textContent = err.message;
  } finally {
    button.disabled = false;
  }
});
function notificationsPanel() {
  const labels = {
    paper_created: "Nuevo paper",
    paper_updated: "Cambios y estados de un paper",
    ticket_assigned: "Ticket asignado o reasignado",
    ticket_completed: "Tarea completada o reabierta",
    ticket_updated: "Otros cambios de tickets",
    weekly_digest: "Resumen semanal de cada paper (lunes, 9:00 hora de Santiago)",
  };
  return (
    pageHead(
      "Notificaciones por email",
      "Los avisos se envían a los participantes del paper y al responsable del ticket.",
    ) +
    emailAvailability(settings, true) +
    `<div class="panel"><form id="notification-form"><label><input type="checkbox" name="email_enabled" ${settings.email_enabled ? "checked" : ""}> Habilitar envío de emails</label>${select(
      "provider",
      "Servicio de envío",
      [
        ["gmail", "Gmail (sin dominio propio)"],
        ["resend", "Resend (dominio verificado)"],
      ],
      settings.provider || "resend",
    )}<p class="hint" id="provider-help">${emailProviderHelp(settings.provider)}</p>${field("from_email", "Cuenta remitente", "email", settings.from_email, "required")}${field("app_url", "Dirección de la aplicación", "url", settings.app_url, "required")}${field("email_secret", emailSecretLabel(settings.provider), "password", "", 'autocomplete="new-password"')}<p class="hint">Deja el secreto vacío para conservar el que ya guardaste. No uses tu contraseña habitual de Google.</p><h3>Eventos que generan email</h3>${Object.entries(
      labels,
    )
      .map(
        ([k, label]) =>
          `<label><input type="checkbox" name="${k}" ${settings[k] ? "checked" : ""}> ${label}</label>`,
      )
      .join(
        "",
      )}<p id="notification-result" role="status"></p><div class="detail-actions"><button class="button primary">Guardar configuración</button><button type="button" class="button" id="test-email">Enviar prueba a mi correo</button></div></form></div><div class="section-head"><h2>Últimos envíos</h2></div><div class="panel">${outbox.map((o) => `<div class="activity-row"><div class="row-content"><div class="row-title">${esc({ pending: "En cola", sending: "Enviando", sent: "Enviado", failed: "Error", cancelled: "Cancelado" }[o.status] || o.status)} · ${o.attempts} intentos</div><div class="row-sub">${esc(new Date(o.created_at).toLocaleString("es-CL"))} ${esc(o.last_error || "")}</div></div></div>`).join("") || empty("No se han generado envíos. Solo se encolan emails para los eventos habilitados mientras el envío esté activo.")}</div>`
  );
}
function invitationsPanel() {
  return pageHead("Invitaciones", "Solo una cuenta Google invitada puede activar el acceso.") +
    `<div class="panel"><form id="invite-form"><label for="invite-researcher">Investigador</label><select id="invite-researcher" name="researcher" required>${activeResearchers().filter(r => !r.accepted_at).map(r => `<option value="${esc(r.id)}">${esc(full(r))}</option>`).join("")}</select><label for="invite-email">Correo invitado</label><select id="invite-email" name="email" required></select><p class="hint">Primero agrega al investigador y sus correos en «Investigadores y permisos». El enlace vence en 14 días y solo funciona con ese correo Google.</p><button class="button primary" ${activeResearchers().some(r => !r.accepted_at) ? "" : "disabled"}>Crear invitación</button></form><p id="invite-result" role="status"></p>${invitationDraft ? `<div class="panel"><p>Enlace nuevo para ${esc(invitationDraft.email)}:</p><input id="invite-link" readonly value="${esc(invitationDraft.url)}"><div class="detail-actions"><button class="button" id="copy-invite">Copiar enlace</button><a class="button" href="${esc(invitationDraft.mailto)}">Enviar por correo</a></div><p class="hint">El enlace se muestra solo ahora. Si se pierde, crea otro; el anterior dejará de funcionar.</p></div>` : ""}</div><div class="section-head"><h2>Invitaciones recientes</h2></div><div class="panel">${invitations.map(i => `<div class="person-row"><span>${esc(i.email)} · ${i.accepted_at ? "Aceptada" : new Date(i.expires_at)<new Date() ? "Vencida" : "Pendiente"}</span></div>`).join("") || empty("Aún no hay invitaciones.")}</div>`;
}
function inviteEmailOptions() {
  const selected = $("#invite-researcher")?.value;
  const researcher = person(selected);
  if ($("#invite-email")) $("#invite-email").innerHTML = (researcher?.emails || []).map(e => `<option value="${esc(e)}">${esc(e)}</option>`).join("");
}
document.addEventListener("change", e => {
  if (e.target.id === "invite-researcher") inviteEmailOptions();
});
document.addEventListener("submit", async e => {
  if (e.target.id !== "invite-form") return;
  e.preventDefault();
  if (!requireAdmin()) return;
  const form = new FormData(e.target);
  const researcher = String(form.get("researcher") || "");
  const email = String(form.get("email") || "");
  const result = $("#invite-result");
  try {
    const { data: token, error } = await db.rpc("create_researcher_invitation", { researcher, email_address: email });
    if (error) throw error;
    const url = `${location.origin}${location.pathname}#invite/${encodeURIComponent(token)}`;
    const subject = "Invitación a Paper Trail";
    const body = `Te invito a participar en Paper Trail. Abre este enlace e inicia sesión con ${email}:\n\n${url}\n\nEl enlace vence en 14 días.`;
    invitationDraft = { email, url, mailto: `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}` };
    await refresh();
    render();
    inviteEmailOptions();
  } catch (err) { result.textContent = err.message; }
});
document.addEventListener("click", async e => {
  if (e.target.id !== "copy-invite") return;
  await navigator.clipboard.writeText($("#invite-link").value);
  $("#invite-result").textContent = "Enlace copiado.";
});
document.addEventListener("submit", async (e) => {
  if (e.target.id !== "notification-form") return;
  e.preventDefault();
  if (!requireAdmin()) return;
  const button = e.target.querySelector("button"),
    result = $("#notification-result"),
    f = new FormData(e.target);
  button.disabled = true;
  try {
    const row = {
      ...settings,
      provider: String(f.get("provider") || "resend"),
      from_email: String(f.get("from_email")).trim(),
      app_url: String(f.get("app_url")).trim(),
    };
    if (!safeUrl(row.app_url))
      throw Error("La dirección de la aplicación debe usar HTTPS.");
    for (const k of [
      "email_enabled",
      "paper_created",
      "paper_updated",
      "ticket_assigned",
      "ticket_completed",
      "ticket_updated",
      "weekly_digest",
    ])
      row[k] = f.has(k);
    const secret = String(f.get("email_secret") || "").trim();
    if (secret) {
      const { error } =
        row.provider === "gmail"
          ? await db.rpc("configure_gmail_sender", {
              sender: row.from_email,
              app_password: secret,
            })
          : await db.rpc("configure_email_secret", { api_key: secret });
      if (error) throw error;
      e.target.elements.email_secret.value = "";
    }
    const { error } = await db
      .from("notification_settings")
      .update(row)
      .eq("id", 1);
    if (error) throw error;
    unsavedPrefs = false;
    await refresh();
    $("#notification-result").textContent =
      "Configuración guardada. Los eventos nuevos usarán estas preferencias.";
  } catch (err) {
    result.textContent = err.message;
  } finally {
    button.disabled = false;
  }
});
function openDeleteResearcher(id) {
  if (!requireAdmin()) return;
  const r = person(id);
  $("#dialog-title").textContent = "Eliminar investigador";
  $("#fields").innerHTML =
    `<p>Se desactivará el acceso de ${esc(full(r))}, se quitará su participación en los papers y sus tickets quedarán sin asignar. La actividad histórica se conserva.</p><button type="button" class="button danger" id="confirm-delete">Eliminar investigador</button>`;
  $("#form-error").textContent = "";
  $(".form-actions").hidden = true;
  $("#modal").showModal();
  $("#confirm-delete").onclick = async () => {
    try {
      const { error } = await db.rpc("deactivate_researcher", {
        researcher: id,
      });
      if (error) throw error;
      $("#modal").close();
      await refresh();
    } catch (err) {
      $("#form-error").textContent = err.message;
    }
  };
}
$("#modal").addEventListener("close", () => {
  $(".form-actions").hidden = false;
  editing = null;
});
start();
