/** All business dates are ISO calendar dates (YYYY-MM-DD) to avoid timezone drift. */

export function toISO(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(
    date.getUTCDate(),
  ).padStart(2, "0")}`;
}

export function todayISO(): string {
  return toISO(new Date());
}

export function parseISO(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export function isISODate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function addDaysISO(value: string, days: number): string {
  const d = parseISO(value);
  d.setUTCDate(d.getUTCDate() + days);
  return toISO(d);
}

export function addMonthsISO(value: string, months: number): string {
  const d = parseISO(value);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const daysInMonth = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, daysInMonth));
  return toISO(d);
}

export function diffDays(startISO: string, endISO: string): number {
  return Math.round((parseISO(endISO).getTime() - parseISO(startISO).getTime()) / 86_400_000);
}

export function maxISO(a: string | null | undefined, b: string | null | undefined): string | null {
  if (!a) return b ?? null;
  if (!b) return a;
  return a >= b ? a : b;
}

export function minISO(a: string | null | undefined, b: string | null | undefined): string | null {
  if (!a) return b ?? null;
  if (!b) return a;
  return a <= b ? a : b;
}

export function startOfMonthISO(value: string): string {
  return `${value.slice(0, 7)}-01`;
}

export function endOfMonthISO(value: string): string {
  const d = parseISO(startOfMonthISO(value));
  return toISO(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)));
}

export function monthKey(value: string): string {
  return value.slice(0, 7);
}

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function monthLabel(key: string): string {
  const [y, m] = key.split("-");
  return `${MONTH_LABELS[Number(m) - 1]} ${y.slice(2)}`;
}

export function lastMonths(count: number, fromISO: string = todayISO()): { key: string; label: string; start: string; end: string }[] {
  const out: { key: string; label: string; start: string; end: string }[] = [];
  const anchor = startOfMonthISO(fromISO);
  for (let i = count - 1; i >= 0; i -= 1) {
    const start = addMonthsISO(anchor, -i);
    const key = monthKey(start);
    out.push({ key, label: monthLabel(key), start, end: endOfMonthISO(start) });
  }
  return out;
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const iso = typeof value === "string" ? value.slice(0, 10) : toISO(value);
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return "—";
  return `${d} ${MONTH_LABELS[Number(m) - 1]} ${y}`;
}

export function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return `${formatDate(toISO(d))}, ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function relativeDays(value: string, asOf: string = todayISO()): number {
  return diffDays(asOf, value);
}

export function daysUntilLabel(value: string | null | undefined, asOf: string = todayISO()): string {
  if (!value) return "No due date";
  const days = diffDays(asOf, value.slice(0, 10));
  if (days === 0) return "Due today";
  if (days > 0) return `Due in ${days} day${days === 1 ? "" : "s"}`;
  return `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} overdue`;
}
