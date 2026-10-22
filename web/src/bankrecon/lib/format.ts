// Formatting and small utility helpers

export function r2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function money(n: number, currency = "USD"): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${currency} ${n.toFixed(2)}`;
  }
}

// Accounting style: negatives in parentheses
export function moneySigned(n: number, currency = "USD"): string {
  const m = money(Math.abs(n), currency);
  return n < 0 ? `(${m})` : m;
}

export function num(n: number, digits = 2): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(n);
}

export function toISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function parseD(s: string | Date): Date {
  return s instanceof Date ? s : new Date(s + "T00:00:00");
}

export function fmtDate(s: string | Date | null): string {
  if (!s) return "—";
  const d = parseD(s);
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export function fmtDateTime(s: string): string {
  const d = new Date(s);
  return d.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function daysBetween(a: string | Date, b: string | Date): number {
  const ms = parseD(b).getTime() - parseD(a).getTime();
  return Math.round(ms / 86400000);
}

export function todayISO(): string {
  return toISO(new Date());
}

export function monthStart(offsetMonths = 0): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + offsetMonths, 1);
}

export function monthEnd(offsetMonths = 0): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + offsetMonths + 1, 0);
}

export function monthLabel(offsetMonths = 0): string {
  const d = monthStart(offsetMonths);
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export function periodLabel(start: string, end: string): string {
  const s = parseD(start);
  const e = parseD(end);
  const sameYear = s.getFullYear() === e.getFullYear();
  const f = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: sameYear ? undefined : "numeric" });
  return `${f(s)} – ${f(e)} ${sameYear ? "" : e.getFullYear()}`;
}

// Deterministic string hash (djb2) — used for transaction fingerprints
export function hashString(str: string): string {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = (h * 33) ^ str.charCodeAt(i);
  }
  return (h >>> 0).toString(36);
}

export function fingerprint(
  accountId: string,
  date: string,
  amount: number,
  reference: string,
  description: string,
): string {
  const normDesc = description.toLowerCase().replace(/\s+/g, " ").replace(/[^a-z0-9 ]/g, "").trim();
  const normRef = reference.toLowerCase().replace(/\s+/g, "").trim();
  return hashString(`${accountId}|${date}|${r2(amount)}|${normRef}|${normDesc}`);
}

export function normalizeDesc(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").replace(/[^a-z0-9 ]/g, "").trim();
}

export function tokenize(s: string): string[] {
  return normalizeDesc(s).split(" ").filter(Boolean);
}

export function jaccard(a: string, b: string): number {
  const ta = new Set(tokenize(a));
  const tb = new Set(tokenize(b));
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return inter / (ta.size + tb.size - inter);
}

export function maskAccount(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length <= 4) return `****${digits}`;
  return `****${digits.slice(-4)}`;
}

export function ageLabel(dateStr: string): string {
  const days = Math.max(0, daysBetween(dateStr, new Date()));
  if (days === 0) return "Today";
  if (days === 1) return "1 day";
  if (days < 30) return `${days} days`;
  const months = Math.floor(days / 30);
  return `${months} month${months > 1 ? "s" : ""} (${days} days)`;
}

export function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function downloadCSV(filename: string, rows: (string | number)[][]) {
  const esc = (v: string | number) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = rows.map((r) => r.map(esc).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;
}
