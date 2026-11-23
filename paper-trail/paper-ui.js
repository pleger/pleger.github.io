import { statuses, statusLabel, safeUrl } from "./domain.js";
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
  return `<fieldset class="paper-fieldset"><legend>Submission deadline</legend><label for="deadline-mode">Does this paper have a submission deadline?</label><select id="deadline-mode" name="deadline_mode"><option value="none" ${!deadline ? "selected" : ""}>No submission deadline</option><option value="date" ${deadline ? "selected" : ""}>Set a submission deadline</option></select><div id="deadline-date-fields" ${deadline ? "" : "hidden"}><label for="f-deadline">Submission deadline</label><input id="f-deadline" name="deadline" type="date" value="${esc(deadline)}" ${deadline ? "required" : "disabled"}><p class="hint">Confirm the submission time and time zone with the conference.</p></div><p class="hint">You can leave it unset and add it later.</p></fieldset>`;
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
  return `<fieldset class="paper-fieldset participant-fieldset"><legend>Participating researchers</legend><p class="field-help" id="participants-help">Select everyone participating in this paper.</p><div class="participant-list">${active.map((r) => `<label class="participant-option"><input type="checkbox" name="researcher_ids" value="${esc(r.id)}" ${selectedIds.includes(r.id) ? "checked" : ""} aria-describedby="participants-help"><span><strong>${esc(name(r))}</strong><small>${esc(r.emails?.[0] || r.orcid)}</small></span></label>`).join("")}</div><p class="hint">Select at least one researcher. You can select several without using Ctrl/Cmd.</p></fieldset>`;
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
    ? new Intl.DateTimeFormat("en-GB", { dateStyle: "long" }).format(
        new Date(paper.deadline + "T12:00:00"),
      )
    : "No submission deadline";
  return `<section class="panel paper-overview" aria-label="Paper status and details"><div class="paper-overview-heading"><div><h2>Paper status</h2><span class="paper-status ${esc(paper.status.replaceAll(" ", "-"))}">${esc(statusLabel(paper.status))}</span></div>${admin ? `<details class="paper-admin-menu"><summary>⚙ Paper settings ▾</summary><div class="paper-admin-options"><button class="button" data-edit-paper="${esc(paper.id)}">Edit details, participants, and deadline</button><a href="#admin/notifications">Configure team notifications →</a></div></details>` : ""}</div>${canWork ? `<div class="paper-status-editor"><label for="paper-status">Change editorial status</label><select id="paper-status" data-paper-status="${esc(paper.id)}">${statuses.map((s) => `<option value="${esc(s)}" ${paper.status === s ? "selected" : ""}>${esc(statusLabel(s))}</option>`).join("")}</select><p>Changes are saved when you select a status.</p></div>` : ""}<div class="paper-facts"><div><h3>Publication type</h3><p>${paper.kind === "conference" ? "Conference" : "Journal"}</p></div><div><h3>Submission deadline</h3><p>${esc(date)}</p></div><div class="paper-participants"><h3>Participating researchers</h3><div class="participant-chips">${participants.map((r) => `<span>${esc(name(r))}</span>`).join("") || "<span>No participants</span>"}</div></div></div>${safeUrl(paper.github_url) ? `<a class="button repository-link" href="${esc(safeUrl(paper.github_url))}" target="_blank" rel="noopener noreferrer">Open repository ↗</a>` : ""}<p class="detail-description">${esc(paper.description || "No project description.")}</p></section>`;
}
export function emailAvailability(settings, admin = false) {
  if (settings.email_enabled) return "";
  if (settings.email_enabled == null)
    return '<div class="email-availability" role="status">The ticket is recorded in Activity. Emails depend on the team settings; contact an administrator if you expected an email.</div>';
  return `<div class="email-availability" role="status"><strong>Email notifications are disabled.</strong> The ticket and updates appear in Activity, but no email will be sent.${admin ? ' <a href="#admin/notifications">Configure email notifications →</a>' : " An administrator must configure email sending."}</div>`;
}
