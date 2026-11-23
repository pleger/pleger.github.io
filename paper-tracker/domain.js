export const statuses = [
  "iniciando",
  "en desarrollo",
  "enviado",
  "en revisión",
  "aceptado",
  "rechazado",
];
export function validOrcid(value) {
  const s = value.replace(/^https:\/\/orcid.org\//, "").toUpperCase();
  if (!/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/.test(s)) return false;
  const raw = s.replaceAll("-", "");
  let total = 0;
  for (const digit of raw.slice(0, 15)) total = (total + Number(digit)) * 2;
  const result = (12 - (total % 11)) % 11;
  return raw[15] === (result === 10 ? "X" : String(result));
}
export function daysUntil(date, today = new Date()) {
  if (!date) return null;
  const now = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((Date.parse(date + "T00:00:00Z") - now) / 86400000);
}
export function safeUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === "https:" ? u.href : null;
  } catch {
    return null;
  }
}

export function signedInResearcher(researchers, user) {
  if (!user?.email) return null;
  return (
    researchers.find(
      (r) =>
        !r.deleted_at &&
        r.emails.some((e) => e.toLowerCase() === user.email.toLowerCase()),
    ) || null
  );
}
export function visibleResearcherId(researchers, user, viewId) {
  const actual = signedInResearcher(researchers, user);
  return actual?.is_admin &&
    researchers.some((r) => r.id === viewId && !r.deleted_at)
    ? viewId
    : actual?.id;
}
