const utc = { timeZone: "UTC" } as const;

function trim(value: string) {
  return value.replace(/\.0+$/, "").replace(/(\.\d)0$/, "$1");
}

export function compact(n: number, digits = 1): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return trim((n / 1_000_000_000).toFixed(2)) + "B";
  if (abs >= 1_000_000) return trim((n / 1_000_000).toFixed(2)) + "M";
  if (abs >= 1_000) return trim((n / 1_000).toFixed(digits)) + "k";
  return Math.round(n).toString();
}

export function money(n: number): string {
  return "$" + compact(n);
}

export function moneyFull(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export function numberFull(n: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);
}

export function pct(n: number, digits = 1): string {
  return `${(n * 100).toFixed(digits)}%`;
}

export function signedPct(n: number, digits = 1): string {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(digits)}%`;
}

export function signedPts(n: number, digits = 1): string {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(digits)} pts`;
}

export function change(current: number, previous: number): number {
  if (!previous) return 0;
  return ((current - previous) / previous) * 100;
}

export function parseISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function toISO(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const d = parseISO(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return toISO(d);
}

const shortDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", ...utc });
const mediumDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", ...utc });
const longDate = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", ...utc });
const monthShort = new Intl.DateTimeFormat("en-US", { month: "short", ...utc });
const monthLong = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", ...utc });
const weekdayShort = new Intl.DateTimeFormat("en-US", { weekday: "short", ...utc });
const serial = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", ...utc });

export function fmtDate(iso: string, style: "short" | "medium" | "long" = "medium"): string {
  const d = parseISO(iso);
  if (style === "short") return shortDate.format(d);
  if (style === "long") return longDate.format(d);
  return mediumDate.format(d);
}

export function fmtMonth(iso: string): string {
  return monthShort.format(parseISO(iso));
}

export function fmtMonthLong(iso: string): string {
  return monthLong.format(parseISO(iso));
}

export function fmtWeekday(iso: string): string {
  return weekdayShort.format(parseISO(iso));
}

export function fmtRange(start: string, end: string): string {
  const sameYear = start.slice(0, 4) === end.slice(0, 4);
  if (sameYear) {
    return `${fmtDate(start, "medium").replace(/, \d{4}$/, "")} – ${fmtDate(end, "medium")}`;
  }
  return `${serial.format(parseISO(start))} – ${serial.format(parseISO(end))}`;
}
