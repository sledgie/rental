/** Deposits are stored as integer cents. All calculations round to the cent, half-up. */

export function roundHalfUp(value: number): number {
  return Math.sign(value) * Math.round(Math.abs(value));
}

export function centsFromInput(input: FormDataEntryValue | null | undefined): number | null {
  if (input == null) return null;
  const raw = String(input).replace(/[$,\s]/g, "");
  if (raw === "") return null;
  if (!/^-?\d+(\.\d{0,4})?$/.test(raw)) return null;
  return roundHalfUp(Number(raw) * 100);
}

export function formatCurrency(cents: number, opts: { signed?: boolean; compact?: boolean } = {}): string {
  const value = (cents ?? 0) / 100;
  const formatter = new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: opts.compact ? 0 : 2,
    maximumFractionDigits: opts.compact ? 0 : 2,
    signDisplay: opts.signed ? "exceptZero" : "auto",
  });
  return formatter.format(value);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-CA").format(value);
}

export function formatBps(bps: number): string {
  return `${(bps / 100).toFixed(2)}%`;
}

export function rentMultipleCents(rentCents: number, bps: number): number {
  return roundHalfUp((rentCents * bps) / 10_000);
}

export function sum(values: number[]): number {
  return values.reduce((acc, v) => acc + v, 0);
}

export function percent(part: number, whole: number): number {
  if (!whole) return 0;
  return Math.max(0, Math.min(100, Math.round((part / whole) * 100)));
}
