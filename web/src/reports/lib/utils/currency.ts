export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function sum(values: number[]): number {
  return round2(values.reduce((acc, v) => acc + v, 0));
}

export function formatMoney(amount: number, options?: { withSign?: boolean; zeroDash?: boolean }): string {
  if (options?.zeroDash && round2(amount) === 0) return "—";
  const negative = amount < 0 || Object.is(amount, -0);
  const abs = Math.abs(round2(amount));
  const formatted = abs.toLocaleString("en-CA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  if (negative && abs !== 0) return `($${formatted})`;
  return `$${formatted}`;
}

export function formatMoneyPlain(amount: number): string {
  return round2(amount).toFixed(2);
}

export function formatPercent(value: number | null, digits = 1): string {
  if (value === null || Number.isNaN(value) || !Number.isFinite(value)) return "n/a";
  return `${value.toFixed(digits)}%`;
}

export function pctChange(current: number, prior: number): number | null {
  if (round2(prior) === 0) return null;
  return round2(((current - prior) / Math.abs(prior)) * 100);
}

export function varianceStatus(
  accountType: "revenue" | "expense" | "other",
  variance: number,
): "favorable" | "unfavorable" | "neutral" {
  if (round2(variance) === 0) return "neutral";
  if (accountType === "revenue") return variance > 0 ? "favorable" : "unfavorable";
  if (accountType === "expense") return variance > 0 ? "unfavorable" : "favorable";
  return variance > 0 ? "unfavorable" : "favorable";
}

export function csvEscape(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  let str = String(value);
  if (str.length > 0 && ["=", "+", "-", "@"].includes(str[0])) {
    str = `'${str}`;
  }
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
