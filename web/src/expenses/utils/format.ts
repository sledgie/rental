import type {
  AllocationMethod,
  BillCategory,
  Frequency,
  PaymentMethod,
  ResponsibleParty,
} from "../types";

export function formatCAD(amount: number): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDateRange(start: string, end: string): string {
  return `${formatDate(start)} – ${formatDate(end)}`;
}

export function todayISO(): string {
  return toISODate(new Date());
}

export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

export function daysBetween(fromISO: string, toISO: string): number {
  const a = new Date(`${fromISO}T00:00:00`).getTime();
  const b = new Date(`${toISO}T00:00:00`).getTime();
  return Math.round((b - a) / 86400000);
}

export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

export function currentMonthKey(): string {
  return todayISO().slice(0, 7);
}

export function categoryLabel(category: BillCategory): string {
  const map: Record<BillCategory, string> = {
    hydro: "Hydro",
    gas: "Gas",
    water: "Water",
    internet: "Internet",
    insurance: "Property Insurance",
    property_tax: "Property Tax",
    maintenance: "Common Area Maintenance",
    other: "Other",
  };
  return map[category];
}

export function frequencyLabel(freq: Frequency): string {
  const map: Record<Frequency, string> = {
    weekly: "Weekly",
    monthly: "Monthly",
    quarterly: "Quarterly",
    "semi-annually": "Semi-annually",
    annually: "Annually",
    custom: "Custom",
  };
  return map[freq];
}

export function paymentMethodLabel(method: PaymentMethod): string {
  const map: Record<PaymentMethod, string> = {
    bank_transfer: "Bank Transfer",
    credit_card: "Credit Card",
    debit_card: "Debit Card",
    cheque: "Cheque",
    cash: "Cash",
    other: "Other",
  };
  return map[method];
}

export function allocationMethodLabel(method: AllocationMethod): string {
  const map: Record<AllocationMethod, string> = {
    none: "No tenant recovery",
    percentage: "Percentage of actual bill",
    fixed: "Fixed amount",
    manual: "Manually entered amount",
    equal_split: "Equal split among selected units",
  };
  return map[method];
}

export function responsiblePartyLabel(party: ResponsibleParty): string {
  const map: Record<ResponsibleParty, string> = {
    landlord: "Landlord",
    tenant: "Tenant",
    shared: "Shared",
  };
  return map[party];
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}
