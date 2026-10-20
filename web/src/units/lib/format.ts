/** Formatting + date helpers shared across modules. All money is CAD. */

const cad = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const cadCompact = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
  notation: "compact",
  maximumFractionDigits: 1,
});

export function money(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return cad.format(value);
}

/** Money without cents — used for large summary figures. */
export function money0(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function moneyCompact(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return cadCompact.format(value);
}

export function signedMoney(value: number): string {
  const s = money(Math.abs(value));
  return value < 0 ? `−${s}` : s;
}

/* ------------------------------- dates -------------------------------- */

export const MS_DAY = 86_400_000;

export function startOfDay(d: Date | string): Date {
  const date = typeof d === "string" ? new Date(`${d}T00:00:00`) : new Date(d);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function toDate(v: Date | string): Date {
  return typeof v === "string" ? new Date(`${v.slice(0, 10)}T00:00:00`) : v;
}

export function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDays(d: Date, days: number): string {
  const next = new Date(d.getTime() + days * MS_DAY);
  return isoDate(next);
}

export function addMonths(d: Date, months: number): string {
  const next = new Date(d);
  next.setMonth(next.getMonth() + months);
  return isoDate(next);
}

export function formatDate(v: Date | string | null | undefined): string {
  if (!v) return "—";
  return toDate(v).toLocaleDateString("en-CA", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

export function formatDateShort(v: Date | string | null | undefined): string {
  if (!v) return "—";
  return toDate(v).toLocaleDateString("en-CA", { month: "short", day: "2-digit" });
}

export function formatDateTime(v: Date | string | null | undefined): string {
  if (!v) return "—";
  const d = v instanceof Date ? v : new Date(v);
  return d.toLocaleString("en-CA", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Whole days from today until `v` (negative when in the past). */
export function daysUntil(v: Date | string | null | undefined, today = new Date()): number {
  if (!v) return 0;
  return Math.round((startOfDay(toDate(v)).getTime() - startOfDay(today).getTime()) / MS_DAY);
}

export function daysLabel(days: number): string {
  if (days === 0) return "today";
  if (days === 1) return "1 day";
  if (days < 0) return `${Math.abs(days)} days overdue`;
  return `${days} days`;
}

export function relativeTime(v: Date | string): string {
  const diff = Date.now() - new Date(v).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(v);
}

/* ------------------------------- misc --------------------------------- */

export function monthKey(v: Date | string): string {
  const d = toDate(v);
  return `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, "0")}`;
}

export function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-CA", { month: "short" });
}

export function initials(first: string, last: string): string {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
}

export function pct(numerator: number, denominator: number, digits = 0): string {
  if (!denominator) return "—";
  return `${((numerator / denominator) * 100).toFixed(digits)}%`;
}

export function pluralize(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}
