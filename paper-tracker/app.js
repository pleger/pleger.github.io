import {
  deadlineFields,
  syncDeadlineFields,
  participantFields,
  paperOverview,
  emailAvailability,
} from "./paper-ui.js";
import {
  statuses,
  statusLabel,
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
  weekly_day: 1,
  weekly_hour: 9,
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
  return r ? `${r.first_name} ${r.last_name}` : "Unassigned";
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
    notice("This action requires administrator permissions.");
    return false;
  }
  return true;
}
function badge(s) {
  return `<span class="badge ${esc(s.replaceAll(" ", "-"))}">${esc(statusLabel(s))}</span>`;
}
function dateLabel(d) {
  if (!d) return "No date";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
  }).format(new Date(d + "T12:00:00"));
}
function due(d) {
  const n = daysUntil(d);
  return d
    ? `<span class="date ${n < 0 ? "overdue" : ""}">${esc(dateLabel(d))}${n < 0 ? " · overdue" : n === 0 ? " · today" : ""}</span>`
    : '<span class="date">No date</span>';
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
      "Sign in with an email registered by the team to make changes.",
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
  if (!requireEdit()) throw Error("Sign-in required");
  if (table === "researchers" && !requireAdmin())
    throw Error("Administrator permissions required");
  if (table === "papers" && update && !requireAdmin())
    throw Error("Only administrators can configure papers");
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
  return `<div class="eyebrow">Your research, in motion</div><div class="page-heading"><div><h1>${esc(title)}</h1><p class="subtitle">${esc(sub)}</p></div>${action}</div>`;
}
function addButton(type, label) {
  return `<button class="button primary" data-add="${type}">＋ ${label}</button>`;
}
function paperCard(p) {
  const ts = state.tickets.filter((t) => t.paper_id === p.id),
    done = ts.filter((t) => t.completed).length,
    progress = ts.length ? Math.round((done / ts.length) * 100) : 0;
  return `<article class="paper-card"><div class="card-top"><span class="type">${p.kind === "conference" ? "↗ Conference" : "▤ Journal"}</span>${badge(p.status)}</div><h3><a href="#paper/${p.id}">${esc(p.title)}</a></h3><p>${esc(p.venue || "Venue to be determined")}</p><div class="progress-meta"><span>Completed tasks</span><span>${done}/${ts.length} · ${progress}%</span></div><div class="progress"><i style="width:${progress}%"></i></div><div class="card-bottom">${avatars(p.researcher_ids)}${due(p.deadline)}</div></article>`;
}
function taskRow(t) {
  return `<div class="task-row ${t.completed ? "completed" : ""}"><input type="checkbox" aria-label="Complete ${esc(t.title)}" data-toggle="${t.id}" ${t.completed ? "checked" : ""} ${canWork(t.paper_id) ? "" : "disabled"}><div class="row-content"><div class="row-title">${esc(t.title)}</div><div class="row-sub"><a href="#paper/${t.paper_id}">${esc(state.papers.find((p) => p.id === t.paper_id)?.title || "Paper")}</a> · ${esc(full(person(t.assignee_id)))}</div>${t.description ? `<div class="row-sub">${esc(t.description)}</div>` : ""}</div>${due(t.deadline)}${canWork(t.paper_id) ? `<button class="button small" data-edit-ticket="${t.id}">Edit</button>` : ""}</div>`;
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
      "Dashboard",
      "Every paper, task, and next step in one place.",
      addButton("paper", "New paper"),
    ) +
    `<div class="stats">${[
      [
        "Papers in workspace",
        state.papers.length,
        "▤",
        "Research projects",
      ],
      [
        "In development",
        state.papers.filter((p) => p.status === "en desarrollo").length,
        "↗",
        "Ideas taking shape",
      ],
      [
        "Under review",
        state.papers.filter((p) => p.status === "en revisión").length,
        "◷",
        "Awaiting updates",
      ],
      [
        "My pending tasks",
        mine.length,
        "☑",
        "Your next contribution to the team",
      ],
    ]
      .map(
        ([label, n, icon, sub]) =>
          `<div class="stat"><div class="stat-top">${label}<span class="stat-icon">${icon}</span></div><strong>${n}</strong><small>${sub}</small></div>`,
      )
      .join(
        "",
      )}</div><div class="section-head"><h2>Papers in progress <span class="badge">${state.papers.length}</span></h2><a href="#papers">View all →</a></div>${state.papers.length ? `<div class="paper-grid">${state.papers.slice(0, 6).map(paperCard).join("")}</div>` : `<div class="empty large"><h3>Your next paper starts here</h3><p>Create a project, bring its authors together, and define the next step.</p>${addButton("paper", "Create your first paper")}</div>`}<div class="lower-grid"><section><div class="section-head"><h2>My next steps</h2><a href="#tickets">All my tickets →</a></div><div class="panel">${mine.slice(0, 5).map(taskRow).join("") || empty("All caught up. You have no pending tasks.")}</div></section><section><div class="section-head"><h2>Submission deadlines</h2><span class="eyebrow">SCHEDULE</span></div><div class="panel">${
      deadlines
        .slice(0, 5)
        .map(
          (p) =>
            `<div class="deadline-row"><div class="date-tile">${esc(new Intl.DateTimeFormat("en", { month: "short" }).format(new Date(p.deadline + "T12:00:00")))}<strong>${Number(p.deadline.slice(-2))}</strong></div><div class="row-content"><a class="row-title" href="#paper/${p.id}">${esc(p.title)}</a><div class="row-sub">${esc(p.venue || "Conference")} · ${due(p.deadline)}</div></div></div>`,
        )
        .join("") || empty("No submission deadlines scheduled.")
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
  $("#login").textContent = user ? "Sign out" : "Continue with Google";
  $("#view-user").innerHTML =
    '<option value="">My own view</option>' +
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
    "Research workspace / " +
    ({
      dashboard: "Dashboard",
      papers: "Papers",
      tickets: "My tickets",
      researchers: "Researchers",
      activity: "Activity",
    }[section] || "Administration");
  if (!signed) {
    const pendingInvite = window.sessionStorage.getItem("paper-trail-invite");
    $("#unread").textContent = "";
    $("#main").innerHTML =
      `<section class="login-panel"><div class="eyebrow">SHARED RESEARCH</div><h1>${pendingInvite ? "Accept invitation" : "Welcome to Paper Trail"}</h1><p>${pendingInvite ? "Sign in with the Google account that received the invitation." : "Sign in with your registered Google account to access the team’s papers and tasks."}</p>${!remote ? '<p class="setup-message">Private access is being prepared. The authentication service has not yet been configured.</p>' : user ? `<p class="setup-message">${pendingInvite ? "This Google account does not match the invitation or the link has expired. Sign out and sign in with the invited email." : "Your account is not registered or has been deactivated. Contact an administrator."}</p>` : '<button class="button primary" id="google-signin">Continue with Google</button>'}</section>`;
    return;
  }
  if (route.startsWith("admin/") && !admin()) {
    $("#main").innerHTML = empty(
      "Only administrators can access this section.",
    );
    return;
  }
  let html = "";
  if (route === "dashboard") html = dashboard();
  else if (route === "admin/papers")
    html =
      pageHead(
        "Paper settings",
        "Edit participants, venue, editorial status, repository, and dates.",
      ) +
      `<div class="panel">${state.papers.map((p) => `<div class="person-row"><div class="row-content"><a href="#paper/${p.id}" class="row-title">${esc(p.title)}</a><div class="row-sub">${esc(p.venue)} · ${esc(statusLabel(p.status))} · ${p.researcher_ids.length} participants</div></div><button class="button small" data-edit-paper="${p.id}">Configure</button></div>`).join("") || empty("There are no papers to configure yet.")}</div>`;
  else if (route === "admin/notifications") html = notificationsPanel();
  else if (route === "admin/invitations") html = invitationsPanel();
  else if (route === "papers")
    html =
      pageHead(
        "Our papers",
        "From first draft to publication.",
        addButton("paper", "New paper"),
      ) +
      `<div class="toolbar"><input id="search" placeholder="Search papers…" aria-label="Search papers" value="${esc(filter)}"><select id="status-filter" aria-label="Filter by status"><option value="">All statuses</option>${statuses.map((s) => `<option value="${esc(s)}" ${statusFilter === s ? "selected" : ""}>${esc(statusLabel(s))}</option>`).join("")}</select></div><div class="paper-grid">${
        state.papers
          .filter(
            (p) =>
              p.title.toLowerCase().includes(filter.toLowerCase()) &&
              (!statusFilter || p.status === statusFilter),
          )
          .map(paperCard)
          .join("") || empty("No papers to display.")
      }</div>`;
  else if (route === "researchers" || route === "admin/researchers")
    html =
      pageHead(
        "Researchers",
        "The people behind every contribution.",
        route.startsWith("admin/")
          ? addButton("researcher", "Add researcher")
          : "",
      ) +
      `<div class="paper-grid">${activeResearchers()
        .map(
          (r) =>
            `<article class="researcher-card">${avatars([r.id])}<h3>${esc(full(r))}</h3><p>${r.emails.map(esc).join("<br>") || "Email not yet registered"}</p><p><a href="https://orcid.org/${esc(r.orcid)}" target="_blank" rel="noopener noreferrer">ORCID ↗ ${esc(r.orcid)}</a></p>${r.is_admin ? '<span class="badge">Administrator</span>' : ""}${route.startsWith("admin/") ? `<div class="detail-actions"><button class="button small" data-edit-researcher="${r.id}">Edit and permissions</button><button class="button small danger" data-delete-researcher="${r.id}">Delete</button></div>` : ""}</article>`,
        )
        .join("")}</div>`;
  else if (route === "tickets")
    html =
      pageHead("My tickets", "Your contribution, step by step.") +
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
        empty("You have no assigned tickets. You can create one from a paper.")
      }</div>`;
  else if (route === "activity") {
    localStorage.setItem("paper-trail-seen", new Date().toISOString());
    html =
      pageHead(
        "Team activity",
        "Ticket updates are shared with the entire workspace.",
      ) +
      `<div class="panel">${state.activity.map((a) => `<div class="activity-row"><span class="avatar">↗</span><div class="row-content"><div class="row-title">${esc(a.message)}</div><div class="row-sub">${esc(full(person(a.actor_id)))} · ${esc(new Date(a.created_at).toLocaleString("en-GB"))} ${a.paper_id ? `· <a href="#paper/${a.paper_id}">View paper →</a>` : ""}</div></div></div>`).join("") || empty("Team updates will appear here.")}</div>`;
  } else if (route.startsWith("paper/")) {
    const p = state.papers.find((p) => p.id === route.split("/")[1]);
    if (!p) html = empty("Paper not found.");
    else {
      const ts = state.tickets.filter((t) => t.paper_id === p.id);
      html =
        pageHead(p.title, p.venue || "Venue to be determined", "") +
        paperOverview(p, state.researchers, {
          canWork: canWork(p.id),
          admin: admin(),
        }) +
        emailAvailability(settings, admin()) +
        `<div class="section-head"><h2>Paper tickets <span class="badge">${ts.filter((t) => t.completed).length}/${ts.length} completed</span></h2>${canWork(p.id) ? addButton("ticket", "New ticket") : ""}</div><div class="panel">${
          ts
            .sort((a, b) => Number(a.completed) - Number(b.completed))
            .map(taskRow)
            .join("") || empty("Define the next step for this paper.")
        }</div><div class="section-head"><h2>My tickets en este paper</h2></div><div class="panel">${
          ts
            .filter((t) => t.assignee_id === me() && !t.completed)
            .map(taskRow)
            .join("") || empty("You have no pending tasks assigned.")
        }</div>`;
    }
  } else
    html = empty(
      'Page not found. <a href="#dashboard">Return to dashboard</a>',
    );
  $("#main").innerHTML =
    (admin() && selected && selected !== actual().id
      ? `<div class="view-banner">Viewing tasks for ${esc(full(person(selected)))}. Actions are recorded as ${esc(full(actual()))}.</div>`
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
    notice("You must participate in this paper to modify tickets.");
    return;
  }
  editing = { type, table, id };
  $("#dialog-title").textContent =
    `${id ? "Edit" : "Add"} ${{ paper: "paper", ticket: "ticket", researcher: "researcher" }[type]}`;
  $("#form-error").textContent = "";
  let html = "";
  if (type === "researcher")
    html =
      field(
        "first_name",
        "First name",
        "text",
        row.first_name,
        'required maxlength="100"',
      ) +
      field(
        "last_name",
        "Last name",
        "text",
        row.last_name,
        'required maxlength="100"',
      ) +
      field(
        "emails",
        "Email addresses (comma separated)",
        "text",
        row.emails?.join(", "),
        'placeholder="nombre@universidad.cl"',
      ) +
      '<p class="hint">After adding a researcher, create an invitation in Administration. Access is enabled after accepting it with Google.</p>' +
      field(
        "orcid",
        "ORCID",
        "text",
        row.orcid,
        'required placeholder="0000-0000-0000-0000"',
      ) +
      select(
        "is_admin",
        "Permissions",
        [
          ["false", "Researcher"],
          ["true", "Administrator"],
        ],
        String(row.is_admin || false),
      );
  if (type === "paper")
    html =
      field(
        "title",
        "Paper title",
        "text",
        row.title,
        'required maxlength="300"',
      ) +
      textarea("description", "Description", row.description) +
      select(
        "kind",
        "Type",
        [
          ["journal", "Journal"],
          ["conference", "Conference"],
        ],
        row.kind || "journal",
      ) +
      field("venue", "Conference or journal", "text", row.venue) +
      field(
        "github_url",
        "Repository URL (HTTPS)",
        "url",
        row.github_url,
      ) +
      select(
        "status",
        "Status",
        statuses.map((s) => [s, statusLabel(s)]),
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
        "Task or completed contribution",
        "text",
        row.title,
        'required maxlength="300"',
      ) +
      textarea("description", "Details", row.description) +
      select(
        "assignee_id",
        "Assigned to",
        [
          ["", "Unassigned"],
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
      field("deadline", "Target date", "date", row.deadline) +
      select(
        "completed",
        "Status",
        [
          ["false", "Pending"],
          ["true", "Completed"],
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
        throw Error("Invalid ORCID. Check its digits.");
      if (row.emails.some((e) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)))
        throw Error("Check the email address format.");
      if (
        activeResearchers().some(
          (r) =>
            r.id !== id &&
            (r.orcid === row.orcid ||
              r.emails.some((e) => row.emails.includes(e))),
        )
      )
        throw Error("This ORCID or email is already registered.");
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
        throw Error("Select at least one researcher.");
      if (!admin() && !row.researcher_ids.includes(actual().id))
        throw Error("You must include yourself as a paper participant.");
      if (row.github_url && !safeUrl(row.github_url))
        throw Error("The repository must use an HTTPS URL.");
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
          ? "Ticket saved. Emails depend on enabled events; an administrator can check their status in Notifications."
          : "Ticket saved. Email is disabled. The update is available in Activity.",
      );
  } catch (err) {
    $("#form-error").textContent = err.message;
  } finally {
    $("#save").disabled = false;
  }
});
$("#close-modal").onclick = $("#cancel").onclick = () => $("#modal").close();
document.addEventListener("click", async (e) => {
  const menu = $("#admin-menu");
  if (menu.open && !menu.contains(e.target)) menu.open = false;
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
      "Google sign-in will be available after Supabase is configured.",
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
          "The Google provider has not yet been configured in Supabase.",
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
        "This email is not registered or is inactive. Request access from an administrator.",
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
      notice(`Could not load the private workspace: ${err.message}`);
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
      "Private access has not been configured.",
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

    $("#connection").textContent = "Private workspace · Supabase";
    db.auth.onAuthStateChange((event, session) => {
      if (event !== "INITIAL_SESSION" && event !== "TOKEN_REFRESHED")
        setTimeout(() => syncSession(session), 0);
    });
    const { data, error } = await db.auth.getSession();
    if (error) throw error;
    await syncSession(data.session);
  } catch (err) {
    notice(`Could not connect: ${err.message}`);
  }
}
document.addEventListener("input", (e) => {
  if (e.target.closest("#notification-form")) unsavedPrefs = true;
});
function emailProviderHelp(provider) {
  return provider === "gmail"
    ? "Send from a personal Google or Workspace Gmail account. Enable two-step verification and create a 16-character app password. It is encrypted in Supabase Vault."
    : "Resend requires an API key and a verified sending domain. The key is encrypted in Supabase Vault.";
}
function emailSecretLabel(provider) {
  return provider === "gmail"
    ? "New Gmail app password (16 characters)"
    : "New Resend API key";
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
      throw Error("Save the settings before sending a test.");
    const { error } = await db.rpc("queue_test_email");
    if (error) throw error;
    $("#notification-result").textContent =
      "Test queued for your sign-in email. The server will process it within a minute.";
    await refresh();
    if ($("#notification-result"))
      $("#notification-result").textContent =
        "Test queued for your sign-in email. Check recent deliveries within a minute.";
  } catch (err) {
    $("#notification-result").textContent = err.message;
  } finally {
    button.disabled = false;
  }
});
function notificationsPanel() {
  const labels = {
    paper_created: "New paper",
    paper_updated: "Paper changes and status updates",
    ticket_assigned: "Ticket assigned or reassigned",
    ticket_completed: "Task completed or reopened",
    ticket_updated: "Other ticket changes",
    weekly_digest: "Weekly paper summary",
  };
  return (
    pageHead(
      "Email notifications",
      "Notifications are sent to paper participants and the ticket assignee.",
    ) +
    emailAvailability(settings, true) +
    `<div class="panel"><form id="notification-form"><label><input type="checkbox" name="email_enabled" ${settings.email_enabled ? "checked" : ""}> Enable email notifications</label>${select(
      "provider",
      "Email provider",
      [
        ["gmail", "Gmail or Google Workspace"],
        ["resend", "Resend (verified domain)"],
      ],
      settings.provider || "resend",
    )}<p class="hint" id="provider-help">${emailProviderHelp(settings.provider)}</p>${field("from_email", "Sender account", "email", settings.from_email, "required")}${field("app_url", "Application URL", "url", settings.app_url, "required")}${field("email_secret", emailSecretLabel(settings.provider), "password", "", 'autocomplete="new-password"')}<p class="hint">Leave the secret blank to keep the saved value. Do not use your regular Google password.</p><h3>Events that trigger email</h3>${Object.entries(
      labels,
    )
      .map(
        ([k, label]) =>
          `<label><input type="checkbox" name="${k}" ${settings[k] ? "checked" : ""}> ${label}</label>`,
      )
      .join(
        "",
      )}${select("weekly_day", "Weekly summary day", [["1", "Monday"], ["2", "Tuesday"], ["3", "Wednesday"], ["4", "Thursday"], ["5", "Friday"], ["6", "Saturday"], ["7", "Sunday"]], String(settings.weekly_day ?? 1))}${select("weekly_hour", "Weekly summary time (Santiago)", Array.from({length: 24}, (_, h) => [String(h), `${String(h).padStart(2, "0")}:00`]), String(settings.weekly_hour ?? 9))}<p class="hint">Times use Santiago local time, including daylight saving changes. One summary is sent per paper per calendar week.</p><p id="notification-result" role="status"></p><div class="detail-actions"><button class="button primary">Save settings</button><button type="button" class="button" id="test-email">Send test to my email</button></div></form></div><div class="section-head"><h2>Recent deliveries</h2></div><div class="panel">${outbox.map((o) => `<div class="activity-row"><div class="row-content"><div class="row-title">${esc({ pending: "Queued", sending: "Sending", sent: "Sent", failed: "Error", cancelled: "Cancelled" }[o.status] || o.status)} · ${o.attempts} attempts</div><div class="row-sub">${esc(new Date(o.created_at).toLocaleString("en-GB"))} ${esc(o.last_error || "")}</div></div></div>`).join("") || empty("No emails have been queued yet. Only enabled events generate emails while sending is enabled.")}</div>`
  );
}
function invitationsPanel() {
  return pageHead("Invitations", "Only an invited Google account can activate access.") +
    `<div class="panel"><form id="invite-form"><label for="invite-researcher">Researcher</label><select id="invite-researcher" name="researcher" required>${activeResearchers().filter(r => !r.accepted_at).map(r => `<option value="${esc(r.id)}">${esc(full(r))}</option>`).join("")}</select><label for="invite-email">Invited email</label><select id="invite-email" name="email" required></select><p class="hint">First add the researcher and their emails under Researchers and permissions. The link expires in 14 days and works only with that Google email address.</p><button class="button primary" ${activeResearchers().some(r => !r.accepted_at) ? "" : "disabled"}>Create invitation</button></form><p id="invite-result" role="status"></p>${invitationDraft ? `<div class="panel invitation-link"><p>New link for ${esc(invitationDraft.email)}:</p><textarea id="invite-link" readonly aria-label="Invitation link">${esc(invitationDraft.url)}</textarea><div class="detail-actions"><button class="button" id="copy-invite">Copy link</button><a class="button" href="${esc(invitationDraft.mailto)}">Send by email</a></div><p class="hint">This link is shown only now. If lost, create another; the previous link will stop working.</p></div>` : ""}</div><div class="section-head"><h2>Recent invitations</h2></div><div class="panel">${invitations.map(i => `<div class="person-row"><span>${esc(i.email)} · ${i.accepted_at ? "Accepted" : new Date(i.expires_at)<new Date() ? "Expired" : "Pending"}</span></div>`).join("") || empty("No invitations yet.")}</div>`;
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
    const subject = "Invitation to Paper Trail";
    const body = `You are invited to join Paper Trail. Open this link and sign in with ${email}:\n\n${url}\n\nThe link expires in 14 days.`;
    invitationDraft = { email, url, mailto: `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}` };
    await refresh();
    render();
    inviteEmailOptions();
  } catch (err) { result.textContent = err.message; }
});
document.addEventListener("click", async e => {
  if (e.target.id !== "copy-invite") return;
  await navigator.clipboard.writeText($("#invite-link").value);
  $("#invite-result").textContent = "Link copied.";
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
      weekly_day: Number(f.get("weekly_day")),
      weekly_hour: Number(f.get("weekly_hour")),
    };
    if (!safeUrl(row.app_url))
      throw Error("The application URL must use HTTPS.");
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
      "Settings saved. New events will use these preferences.";
  } catch (err) {
    result.textContent = err.message;
  } finally {
    button.disabled = false;
  }
});
function openDeleteResearcher(id) {
  if (!requireAdmin()) return;
  const r = person(id);
  $("#dialog-title").textContent = "Delete researcher";
  $("#fields").innerHTML =
    `<p>Access will be deactivated for ${esc(full(r))}, their paper participation will be removed and their tickets unassigned. Historical activity will be retained.</p><button type="button" class="button danger" id="confirm-delete">Delete researcher</button>`;
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
