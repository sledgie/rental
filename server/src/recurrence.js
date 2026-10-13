// Pure date math for bill schedules (no database access).
export const LEAD_DAYS = 7; // a bill counts as "due soon" this many days before its due date
const CAP = 1000; // never list more than this many occurrences for one schedule
const iso = (d) => d.toISOString().slice(0, 10);
const parse = (s) => new Date(`${s}T00:00:00Z`);

// The n-th due date (n = 0 is the start date). Months keep the start's day of month, clamped to short months.
export function nthDate(start, n, every, unit) {
  const d = parse(start);
  if (unit === 'DAY') d.setUTCDate(d.getUTCDate() + n * every);
  else if (unit === 'WEEK') d.setUTCDate(d.getUTCDate() + 7 * n * every);
  else {
    const day = d.getUTCDate(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + n * every);
    d.setUTCDate(Math.min(day, new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()));
  }
  return iso(d);
}
export const daysBetween = (a, b) => Math.round((parse(b) - parse(a)) / 86400000);

// Due dates of a schedule from its start up to `to` (inclusive), never past its end date.
export function occurrences(s, to) {
  const out = [];
  for (let n = 0; n < CAP; n++) {
    const d = nthDate(s.start, n, s.every, s.unit);
    if (d > to || (s.end && d > s.end)) break;
    out.push(d);
  }
  return out;
}
// First due date after `after` (or null when the schedule has ended).
export function nextAfter(s, after) {
  for (let n = 0; n < 20000; n++) {
    const d = nthDate(s.start, n, s.every, s.unit);
    if (s.end && d > s.end) return null;
    if (d > after) return d;
  }
  return null;
}

// What needs doing today: occurrences not yet posted or skipped. `handled` is a Set of YYYY-MM-DD dates.
export function status(s, handled, t) {
  const soonTo = iso(new Date(parse(t).getTime() + LEAD_DAYS * 86400000));
  const pending = occurrences(s, soonTo).filter((d) => !handled.has(d));
  const overdue = pending.filter((d) => d < t);
  const next = pending[0] || nextAfter(s, soonTo);
  let state = 'ok';
  if (!s.active) state = 'paused';
  else if (!next) state = 'done';
  else if (overdue.length) state = 'overdue';
  else if (next <= soonTo) state = 'soon';
  return { next: s.active ? next : null, overdue: overdue.length, oldestOverdue: overdue[0] || null, daysUntil: next ? daysBetween(t, next) : null, state };
}
