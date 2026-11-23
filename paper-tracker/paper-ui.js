import { statuses, safeUrl } from "./domain.js";
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const name = (r) => `${r.first_name} ${r.last_name}`;

export function deadlineFields(deadline) {
  return `<fieldset class="paper-fieldset"><legend>Fecha de entrega</legend><label for="deadline-mode">¿Este paper tiene fecha de entrega?</label><select id="deadline-mode" name="deadline_mode"><option value="none" ${!deadline ? "selected" : ""}>Sin fecha de entrega</option><option value="date" ${deadline ? "selected" : ""}>Definir una fecha de entrega</option></select><div id="deadline-date-fields" ${deadline ? "" : "hidden"}><label for="f-deadline">Fecha de entrega</label><input id="f-deadline" name="deadline" type="date" value="${esc(deadline)}" ${deadline ? "required" : "disabled"}><p class="hint">Confirma la hora y zona del cierre con la conferencia.</p></div><p class="hint">Puedes dejarla sin definir y agregarla más adelante.</p></fieldset>`;
}
export function syncDeadlineFields(form) {
  const hasDate = form.elements.deadline_mode.value === "date";
  const date = form.elements.deadline;
  date.disabled = !hasDate;
  date.required = hasDate;
  form.querySelector("#deadline-date-fields").hidden = !hasDate;
  if (!hasDate) date.value = "";
}
export function participantFields(researchers, selectedIds) {
  const active = researchers.filter((r) => !r.deleted_at);
  return `<fieldset class="paper-fieldset participant-fieldset"><legend>Investigadores participantes</legend><p class="field-help" id="participants-help">Marca a todas las personas que participarán en este paper.</p><div class="participant-list">${active.map((r) => `<label class="participant-option"><input type="checkbox" name="researcher_ids" value="${esc(r.id)}" ${selectedIds.includes(r.id) ? "checked" : ""} aria-describedby="participants-help"><span><strong>${esc(name(r))}</strong><small>${esc(r.emails?.[0] || r.orcid)}</small></span></label>`).join("")}</div><p class="hint">Selecciona al menos un investigador. Puedes marcar varios sin usar Ctrl/Cmd.</p></fieldset>`;
}
export function paperOverview(
  paper,
  researchers,
  { canWork = false, admin = false } = {},
) {
  const participants = paper.researcher_ids
    .map((id) => researchers.find((r) => r.id === id))
    .filter(Boolean);
  const date = paper.deadline
    ? new Intl.DateTimeFormat("es-CL", { dateStyle: "long" }).format(
        new Date(paper.deadline + "T12:00:00"),
      )
    : "Sin fecha de entrega";
  return `<section class="panel paper-overview" aria-label="Estado y detalles del paper"><div class="paper-overview-heading"><div><h2>Estado del paper</h2><span class="paper-status ${esc(paper.status.replaceAll(" ", "-"))}">${esc(paper.status)}</span></div>${admin ? `<details class="paper-admin-menu"><summary>⚙ Configuración del paper ▾</summary><div class="paper-admin-options"><button class="button" data-edit-paper="${esc(paper.id)}">Editar datos, participantes y fecha</button><a href="#admin/notifications">Configurar notificaciones del equipo →</a></div></details>` : ""}</div>${canWork ? `<div class="paper-status-editor"><label for="paper-status">Cambiar estado editorial</label><select id="paper-status" data-paper-status="${esc(paper.id)}">${statuses.map((s) => `<option value="${esc(s)}" ${paper.status === s ? "selected" : ""}>${esc(s)}</option>`).join("")}</select><p>El cambio se guarda al seleccionar un estado.</p></div>` : ""}<div class="paper-facts"><div><h3>Tipo de publicación</h3><p>${paper.kind === "conference" ? "Conferencia" : "Revista"}</p></div><div><h3>Fecha de entrega</h3><p>${esc(date)}</p></div><div class="paper-participants"><h3>Investigadores participantes</h3><div class="participant-chips">${participants.map((r) => `<span>${esc(name(r))}</span>`).join("") || "<span>Sin participantes</span>"}</div></div></div>${safeUrl(paper.github_url) ? `<a class="button repository-link" href="${esc(safeUrl(paper.github_url))}" target="_blank" rel="noopener noreferrer">Abrir repositorio ↗</a>` : ""}<p class="detail-description">${esc(paper.description || "Sin descripción del proyecto.")}</p></section>`;
}
export function emailAvailability(settings, admin = false) {
  if (settings.email_enabled) return "";
  if (settings.email_enabled == null)
    return '<div class="email-availability" role="status">El ticket se registra en Actividad. Los correos dependen de la configuración del equipo; consulta a un administrador si esperabas recibir un email.</div>';
  return `<div class="email-availability" role="status"><strong>Los emails están desactivados.</strong> El ticket se registra y sus novedades aparecen en Actividad, pero no se enviará correo.${admin ? ' <a href="#admin/notifications">Configurar envío de emails →</a>' : " Un administrador debe configurar el envío."}</div>`;
}
