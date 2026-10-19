import { DEMO_TODAY } from "@inv/data/mockInvoices";

const cad = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
  currencyDisplay: "narrowSymbol",
});

const cadPlain = new Intl.NumberFormat("en-CA", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const formatCAD = (n: number): string => cad.format(round2(n));

/** CAD without the $ prefix — used inside totals rows. */
export const formatCADNoSymbol = (n: number): string =>
  `${cadPlain.format(round2(n))} CAD`;

const round2 = (n: number) => Math.round(n * 100) / 100;

const dateFmt = new Intl.DateTimeFormat("en-CA", {
  month: "short",
  day: "2-digit",
  year: "numeric",
});

const dateTimeFmt = new Intl.DateTimeFormat("en-CA", {
  month: "short",
  day: "2-digit",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export const formatDate = (iso?: string): string => {
  if (!iso) return "—";
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "—";
  return dateFmt.format(d);
};

export const formatDateTime = (iso?: string): string => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return dateTimeFmt.format(d);
};

export const daysBetween = (from: Date, to: Date): number =>
  Math.round((to.getTime() - from.getTime()) / 86_400_000);

/** Signed day difference between a date and the demo "today". */
export const daysFromToday = (iso?: string): number => {
  if (!iso) return 0;
  return daysBetween(DEMO_TODAY, new Date(`${iso.slice(0, 10)}T00:00:00`));
};

export const dueLabel = (iso?: string): string => {
  const d = daysFromToday(iso);
  if (d === 0) return "Due today";
  if (d === 1) return "Due tomorrow";
  if (d > 1) return `In ${d} days`;
  if (d === -1) return "1 day late";
  return `${Math.abs(d)} days late`;
};

export const todayISO = (): string => DEMO_TODAY.toISOString().slice(0, 10);

export const toISO = (d: Date): string => d.toISOString().slice(0, 10);

/** Monday-start week containing the demo "today". */
export const weekRange = (): { from: string; to: string } => {
  const d = new Date(DEMO_TODAY);
  const dow = (d.getDay() + 6) % 7;
  const from = new Date(d);
  from.setDate(d.getDate() - dow);
  const to = new Date(from);
  to.setDate(from.getDate() + 6);
  return { from: toISO(from), to: toISO(to) };
};

export const monthRange = (): { from: string; to: string } => {
  const d = DEMO_TODAY;
  const from = new Date(d.getFullYear(), d.getMonth(), 1);
  const to = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return { from: toISO(from), to: toISO(to) };
};

export const percent = (part: number, whole: number): number =>
  whole <= 0 ? 0 : Math.min(100, Math.round((part / whole) * 100));
