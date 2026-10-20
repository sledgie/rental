import type {
  Allocation,
  AuditEvent,
  CreditApplication,
  Invoice,
  Lease,
  Payment,
  PaymentMethod,
  Property,
  StaffUser,
  Tenant,
  TenantCredit,
  Unit,
} from "../types";

/**
 * All data below is fictional demo data.
 * Dates are generated relative to "today" so the demo always looks current.
 * Money is stored as integer cents.
 */

const now = new Date();
const Y = now.getFullYear();
const M = now.getMonth();

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const monthDay = (offset: number, day: number) => {
  const d = day > 28 ? Math.min(day, 28) : day;
  const safe = offset === 0 ? Math.min(d, Math.max(1, now.getDate())) : d;
  return iso(new Date(Y, M + offset, safe));
};

const monthStart = (offset: number) => iso(new Date(Y, M + offset, 1));
const monthEnd = (offset: number) => iso(new Date(Y, M + offset + 1, 0));

const periodName = (offset: number) =>
  new Date(Y, M + offset, 1).toLocaleDateString("en-CA", { month: "long", year: "numeric" });

// ---------------------------------------------------------------------------
// Staff users (fictional)
// ---------------------------------------------------------------------------

export const USERS: StaffUser[] = [
  { id: "USR-01", name: "J. Whitfield", role: "Administrator" },
  { id: "USR-02", name: "R. Sandhu", role: "Payment Clerk" },
  { id: "USR-03", name: "M. Dubois", role: "Supervisor" },
];

export const DEFAULT_USER_ID = "USR-02";

// ---------------------------------------------------------------------------
// Properties & units
// ---------------------------------------------------------------------------

export const PROPERTIES: Property[] = [
  { id: "PROP-MC", name: "Maple Court Apartments", address: "220 Maple Ct, Toronto, ON" },
  { id: "PROP-BW", name: "Birchwood Townhomes", address: "18 Birchwood Lane, Mississauga, ON" },
  { id: "PROP-CL", name: "Cedar Lofts", address: "75 Cedar St, Toronto, ON" },
  { id: "PROP-WP", name: "Willow Park House", address: "9 Willow Park Dr, North York, ON" },
];

export const UNITS: Unit[] = [
  { id: "U-MC-101", propertyId: "PROP-MC", number: "101" },
  { id: "U-MC-102", propertyId: "PROP-MC", number: "102" },
  { id: "U-MC-201", propertyId: "PROP-MC", number: "201" },
  { id: "U-MC-204", propertyId: "PROP-MC", number: "204" },
  { id: "U-MC-303", propertyId: "PROP-MC", number: "303" },
  { id: "U-BW-A", propertyId: "PROP-BW", number: "Townhome A" },
  { id: "U-BW-B", propertyId: "PROP-BW", number: "Townhome B" },
  { id: "U-BW-C", propertyId: "PROP-BW", number: "Townhome C" },
  { id: "U-BW-P12", propertyId: "PROP-BW", number: "Parking P-12" },
  { id: "U-CL-208", propertyId: "PROP-CL", number: "Loft 208" },
  { id: "U-CL-305", propertyId: "PROP-CL", number: "Loft 305" },
  { id: "U-CL-310", propertyId: "PROP-CL", number: "Loft 310" },
  { id: "U-CL-410", propertyId: "PROP-CL", number: "Loft 410" },
  { id: "U-WP-01", propertyId: "PROP-WP", number: "Whole house" },
];

// ---------------------------------------------------------------------------
// Tenants & leases
// ---------------------------------------------------------------------------

export const TENANTS: Tenant[] = [
  { id: "TEN-01", number: "T-1001", name: "Amelia Chen", email: "amelia.chen@example.com", phone: "(416) 555-0101", active: true },
  { id: "TEN-02", number: "T-1002", name: "Marcus Okafor", email: "marcus.okafor@example.com", phone: "(416) 555-0102", active: true },
  { id: "TEN-03", number: "T-1003", name: "Priya Raman", email: "priya.raman@example.com", phone: "(905) 555-0103", active: true },
  { id: "TEN-04", number: "T-1004", name: "Daniel Kowalski", email: "daniel.kowalski@example.com", phone: "(416) 555-0104", active: true },
  { id: "TEN-05", number: "T-1005", name: "Sofia Marchetti", email: "sofia.marchetti@example.com", phone: "(905) 555-0105", active: true },
  { id: "TEN-06", number: "T-1006", name: "Liam Tremblay", email: "liam.tremblay@example.com", phone: "(416) 555-0106", active: true },
  { id: "TEN-07", number: "T-1007", name: "Hana Yoshida", email: "hana.yoshida@example.com", phone: "(416) 555-0107", active: true },
  { id: "TEN-08", number: "T-1008", name: "Noah Beaulieu", email: "noah.beaulieu@example.com", phone: "(416) 555-0108", active: true },
  { id: "TEN-09", number: "T-1009", name: "Grace Adeyemi", email: "grace.adeyemi@example.com", phone: "(416) 555-0109", active: true },
  { id: "TEN-10", number: "T-1010", name: "Owen MacDonald", email: "owen.macdonald@example.com", phone: "(905) 555-0110", active: true },
  { id: "TEN-11", number: "T-1011", name: "Isabella Rossi", email: "isabella.rossi@example.com", phone: "(416) 555-0111", active: true },
  { id: "TEN-12", number: "T-1012", name: "Ethan Park", email: "ethan.park@example.com", phone: "(416) 555-0112", active: true },
  // Acceptance-test tenant (spec §6) — invoice numbers INV-2026-009/010 belong here.
  { id: "TEN-13", number: "T-1013", name: "Nora Kovacs", email: "nora.kovacs@example.com", phone: "(416) 555-0113", active: true },
];

export const LEASES: Lease[] = [
  { id: "LS-01", tenantId: "TEN-01", unitId: "U-MC-204", monthlyRent: 185000, startDate: "2025-07-01", endDate: "2026-06-30", status: "active" },
  { id: "LS-02", tenantId: "TEN-02", unitId: "U-MC-101", monthlyRent: 165000, startDate: "2025-05-01", endDate: "2026-04-30", status: "active" },
  { id: "LS-14", tenantId: "TEN-13", unitId: "U-CL-310", monthlyRent: 180000, startDate: "2026-09-01", endDate: "2027-08-31", status: "active" },
  { id: "LS-03", tenantId: "TEN-03", unitId: "U-BW-B", monthlyRent: 220000, startDate: "2025-09-01", endDate: "2026-08-31", status: "active" },
  { id: "LS-04", tenantId: "TEN-04", unitId: "U-CL-305", monthlyRent: 197500, startDate: "2025-06-01", endDate: "2026-05-31", status: "active" },
  { id: "LS-05", tenantId: "TEN-05", unitId: "U-BW-C", monthlyRent: 220000, startDate: "2025-08-01", endDate: "2026-07-31", status: "active" },
  { id: "LS-06", tenantId: "TEN-06", unitId: "U-MC-102", monthlyRent: 170000, startDate: "2025-10-01", endDate: "2026-09-30", status: "active" },
  { id: "LS-07", tenantId: "TEN-07", unitId: "U-CL-410", monthlyRent: 205000, startDate: "2025-04-01", endDate: "2026-03-31", status: "active" },
  { id: "LS-08", tenantId: "TEN-08", unitId: "U-MC-201", monthlyRent: 178000, startDate: "2025-11-01", endDate: "2026-10-31", status: "active" },
  { id: "LS-09", tenantId: "TEN-09", unitId: "U-WP-01", monthlyRent: 260000, startDate: "2025-03-01", endDate: "2027-02-28", status: "active" },
  // Owen MacDonald holds two leases: a townhome and a parking stall.
  { id: "LS-10", tenantId: "TEN-10", unitId: "U-BW-A", monthlyRent: 235000, startDate: "2025-06-01", endDate: "2026-05-31", status: "active" },
  { id: "LS-11", tenantId: "TEN-10", unitId: "U-BW-P12", monthlyRent: 12500, startDate: "2025-06-01", endDate: "2026-05-31", status: "active" },
  { id: "LS-12", tenantId: "TEN-12", unitId: "U-CL-208", monthlyRent: 190000, startDate: "2025-09-01", endDate: "2026-08-31", status: "active" },
  { id: "LS-13", tenantId: "TEN-11", unitId: "U-MC-303", monthlyRent: 172500, startDate: "2025-12-01", endDate: "2026-11-30", status: "active" },
];

// ---------------------------------------------------------------------------
// Invoices — sequential INV-YYYY-NNN numbering.
// LEASES is ordered so Nora Kovacs' two invoices land exactly on
// INV-2026-009 (September 2026, $300 outstanding) and
// INV-2026-010 (October 2026, $1,500 outstanding) for the acceptance test.
// Balances are never stored — they are derived (see paymentUtils).
// ---------------------------------------------------------------------------

let invSeq = 0;
const invId = () => `INV-${Y}-${String(++invSeq).padStart(3, "0")}`;

function monthInvoices(lease: Lease, offset: number, overrides?: Partial<Invoice>): Invoice {
  return {
    id: invId(),
    number: "",
    tenantId: lease.tenantId,
    leaseId: lease.id,
    periodStart: monthStart(offset),
    periodEnd: monthEnd(offset),
    dueDate: monthDay(offset, 1),
    originalAmount: lease.monthlyRent,
    adjustments: [],
    status: "open",
    description: "Monthly rent",
    ...overrides,
  };
}

export const INVOICES: Invoice[] = [];

// LS-01 & LS-02: four months each → INV-...-001..008
for (const offset of [-2, -1, 0, 1]) INVOICES.push(monthInvoices(LEASES[0], offset));
for (const offset of [-2, -1, 0, 1]) INVOICES.push(monthInvoices(LEASES[1], offset));

// LS-14 (Nora Kovacs) → INV-...-009 and INV-...-010, exactly per spec §6.
const nora = LEASES[2];
INVOICES.push(
  {
    id: invId(), // INV-YYYY-009
    number: "",
    tenantId: nora.tenantId,
    leaseId: nora.id,
    periodStart: `${Y}-09-01`,
    periodEnd: `${Y}-09-30`,
    dueDate: `${Y}-09-01`,
    originalAmount: 180000,
    adjustments: [],
    status: "open",
    description: "Monthly rent",
  },
  {
    id: invId(), // INV-YYYY-010
    number: "",
    tenantId: nora.tenantId,
    leaseId: nora.id,
    periodStart: `${Y}-10-01`,
    periodEnd: `${Y}-10-31`,
    dueDate: `${Y}-10-01`,
    originalAmount: 180000,
    adjustments: [{ label: "Unit renovation credit", amount: -30000 }],
    status: "open",
    description: "Monthly rent",
  },
);

// Remaining leases: four months each.
for (const lease of LEASES.slice(3)) {
  for (const offset of [-2, -1, 0, 1]) INVOICES.push(monthInvoices(lease, offset));
}

// A cancelled duplicate invoice (excluded from allocation workflows).
const cancelledInvoice: Invoice = {
  id: invId(),
  number: "",
  tenantId: "TEN-02",
  leaseId: "LS-02",
  periodStart: monthStart(1),
  periodEnd: monthEnd(1),
  dueDate: monthDay(1, 1),
  originalAmount: 165000,
  adjustments: [],
  status: "cancelled",
  description: "Duplicate entry — voided",
};
INVOICES.push(cancelledInvoice);

for (const inv of INVOICES) inv.number = inv.id;

export const NORA_INVOICE_IDS = { september: INVOICES[8].id, october: INVOICES[9].id };

// ---------------------------------------------------------------------------
// Seed payments. Compact rows expand into Payment + Allocation records.
// ---------------------------------------------------------------------------

interface SeedPayment {
  seq: number;
  tenantId: string;
  leaseId: string;
  /** [leaseId, monthOffset, cents] — or ["nora-sep" | "nora-oct", 0, cents] */
  alloc: Array<[string, number, number]>;
  offset: number;
  day: number;
  method: PaymentMethod;
  cents: number;
  reference?: string;
  notes?: string;
  reversed?: { offset: number; day: number; byId: string; reason: string };
  byId: string;
  at: string;
}

const invOf = (leaseId: string, offset: number): string => {
  if (leaseId === "nora-sep") return NORA_INVOICE_IDS.september;
  if (leaseId === "nora-oct") return NORA_INVOICE_IDS.october;
  const inv = INVOICES.find((i) => i.leaseId === leaseId && i.dueDate === monthDay(offset, 1) && i.status === "open");
  if (!inv) throw new Error(`No invoice for ${leaseId} @ ${offset}`);
  return inv.id;
};

const SEEDS: SeedPayment[] = [
  { seq: 131, tenantId: "TEN-01", leaseId: "LS-01", offset: -2, day: 2, method: "etransfer", cents: 185000, reference: "ETRF-88121-AC", byId: "USR-02", at: "09:24", alloc: [["LS-01", -2, 185000]] },
  { seq: 132, tenantId: "TEN-01", leaseId: "LS-01", offset: -1, day: 1, method: "etransfer", cents: 185000, reference: "ETRF-90412-BD", byId: "USR-02", at: "10:02", alloc: [["LS-01", -1, 185000]] },
  { seq: 133, tenantId: "TEN-02", leaseId: "LS-02", offset: -2, day: 5, method: "cash", cents: 80000, notes: "Partial payment — tenant promised the balance by month end.", byId: "USR-03", at: "15:40", alloc: [["LS-02", -2, 80000]] },
  { seq: 134, tenantId: "TEN-02", leaseId: "LS-02", offset: -1, day: 3, method: "etransfer", cents: 165000, reference: "ETRF-11877-MO", byId: "USR-01", at: "11:12", alloc: [["LS-02", -1, 165000]] },
  { seq: 135, tenantId: "TEN-03", leaseId: "LS-03", offset: -1, day: 2, method: "card", cents: 220000, reference: "TERM-44712", notes: "Processed on the office terminal (chip, approved).", byId: "USR-03", at: "13:05", alloc: [["LS-03", -1, 220000]] },
  { seq: 136, tenantId: "TEN-04", leaseId: "LS-04", offset: -1, day: 4, method: "cash", cents: 300000, notes: "One cash payment covering two invoices: older invoice in full, remainder on the newer one.", byId: "USR-01", at: "16:22", alloc: [["LS-04", -2, 197500], ["LS-04", -1, 102500]] },
  { seq: 137, tenantId: "TEN-06", leaseId: "LS-06", offset: -1, day: 6, method: "etransfer", cents: 170000, reference: "ETRF-20931-LT", byId: "USR-01", at: "09:58", alloc: [["LS-06", -1, 170000]], reversed: { offset: -1, day: 9, byId: "USR-01", reason: "e-Transfer reversed by the tenant's bank (NSF) — funds never settled." } },
  { seq: 138, tenantId: "TEN-07", leaseId: "LS-07", offset: -1, day: 3, method: "card", cents: 205000, reference: "TERM-44918", byId: "USR-03", at: "12:31", alloc: [["LS-07", -1, 205000]] },
  { seq: 139, tenantId: "TEN-08", leaseId: "LS-08", offset: 0, day: 2, method: "cash", cents: 90000, notes: "First instalment — remainder expected by the 15th.", byId: "USR-02", at: "17:03", alloc: [["LS-08", 0, 90000]] },
  { seq: 140, tenantId: "TEN-09", leaseId: "LS-09", offset: 0, day: 1, method: "etransfer", cents: 260000, reference: "ETRF-31208-GA", byId: "USR-01", at: "08:47", alloc: [["LS-09", 0, 260000]] },
  { seq: 141, tenantId: "TEN-10", leaseId: "LS-10", offset: -1, day: 2, method: "etransfer", cents: 247500, reference: "ETRF-27650-OM", notes: "Single transfer covering townhome rent plus the parking stall invoice.", byId: "USR-02", at: "10:36", alloc: [["LS-10", -1, 235000], ["LS-11", -1, 12500]] },
  { seq: 142, tenantId: "TEN-12", leaseId: "LS-12", offset: -2, day: 4, method: "cash", cents: 200000, notes: "Tenant overpaid by $100 — excess retained as unapplied tenant credit CR-…-0001.", byId: "USR-03", at: "14:19", alloc: [["LS-12", -2, 190000]] },
  { seq: 143, tenantId: "TEN-11", leaseId: "LS-13", offset: 0, day: 3, method: "card", cents: 172500, reference: "TERM-45102", byId: "USR-02", at: "11:55", alloc: [["LS-13", 0, 172500]] },
  { seq: 144, tenantId: "TEN-05", leaseId: "LS-05", offset: -2, day: 2, method: "cash", cents: 220000, byId: "USR-01", at: "09:12", alloc: [["LS-05", -2, 220000]] },
  { seq: 145, tenantId: "TEN-06", leaseId: "LS-06", offset: -2, day: 1, method: "etransfer", cents: 170000, reference: "ETRF-19204-LT", byId: "USR-02", at: "09:41", alloc: [["LS-06", -2, 170000]] },
  { seq: 146, tenantId: "TEN-08", leaseId: "LS-08", offset: -2, day: 2, method: "etransfer", cents: 178000, reference: "ETRF-15530-NB", byId: "USR-01", at: "10:15", alloc: [["LS-08", -2, 178000]] },
  { seq: 147, tenantId: "TEN-08", leaseId: "LS-08", offset: -1, day: 1, method: "etransfer", cents: 178000, reference: "ETRF-17742-NB", byId: "USR-02", at: "08:58", alloc: [["LS-08", -1, 178000]] },
  { seq: 148, tenantId: "TEN-05", leaseId: "LS-05", offset: -1, day: 3, method: "etransfer", cents: 220000, reference: "ETRF-21488-SM", byId: "USR-03", at: "12:26", alloc: [["LS-05", -1, 220000]] },
  { seq: 149, tenantId: "TEN-12", leaseId: "LS-12", offset: -1, day: 2, method: "card", cents: 190000, reference: "TERM-44233", byId: "USR-01", at: "13:44", alloc: [["LS-12", -1, 190000]] },
  { seq: 150, tenantId: "TEN-10", leaseId: "LS-10", offset: -2, day: 3, method: "etransfer", cents: 247500, reference: "ETRF-25310-OM", byId: "USR-02", at: "09:03", alloc: [["LS-10", -2, 235000], ["LS-11", -2, 12500]] },
  { seq: 151, tenantId: "TEN-03", leaseId: "LS-03", offset: -2, day: 2, method: "card", cents: 220000, reference: "TERM-43877", byId: "USR-03", at: "14:52", alloc: [["LS-03", -2, 220000]] },
  { seq: 152, tenantId: "TEN-07", leaseId: "LS-07", offset: -2, day: 4, method: "card", cents: 205000, reference: "TERM-44011", byId: "USR-01", at: "11:37", alloc: [["LS-07", -2, 205000]] },
  { seq: 153, tenantId: "TEN-09", leaseId: "LS-09", offset: -2, day: 1, method: "etransfer", cents: 260000, reference: "ETRF-12960-GA", byId: "USR-02", at: "09:29", alloc: [["LS-09", -2, 260000]] },
  { seq: 154, tenantId: "TEN-09", leaseId: "LS-09", offset: -1, day: 2, method: "etransfer", cents: 260000, reference: "ETRF-14407-GA", byId: "USR-03", at: "10:48", alloc: [["LS-09", -1, 260000]] },
  { seq: 155, tenantId: "TEN-11", leaseId: "LS-13", offset: -2, day: 2, method: "etransfer", cents: 172500, reference: "ETRF-16651-IR", byId: "USR-01", at: "15:21", alloc: [["LS-13", -2, 172500]] },
  { seq: 156, tenantId: "TEN-11", leaseId: "LS-13", offset: -1, day: 1, method: "card", cents: 172500, reference: "TERM-44590", byId: "USR-02", at: "09:52", alloc: [["LS-13", -1, 172500]] },
  { seq: 157, tenantId: "TEN-13", leaseId: "LS-14", offset: 0, day: 2, method: "etransfer", cents: 150000, reference: "ETRF-33410-NK", notes: "On-account payment toward September rent (partial).", byId: "USR-02", at: "10:20", alloc: [["nora-sep", 0, 150000]] },
];

const payId = (seq: number) => `PAY-${Y}-${String(seq).padStart(4, "0")}`;
const rcptId = (seq: number) => `RCPT-${Y}-${String(seq + 580).padStart(4, "0")}`;

export const PAYMENTS: Payment[] = SEEDS.map((s) => {
  const date = monthDay(s.offset, s.day);
  return {
    id: payId(s.seq),
    receiptId: rcptId(s.seq),
    tenantId: s.tenantId,
    leaseId: s.leaseId,
    date,
    method: s.method,
    amount: s.cents,
    reference: s.reference,
    notes: s.notes,
    status: s.reversed ? ("reversed" as const) : ("posted" as const),
    recordedById: s.byId,
    createdAt: `${date}T${s.at}:00`,
    reversedAt: s.reversed ? `${monthDay(s.reversed.offset, s.reversed.day)}T14:05:00` : undefined,
    reversedById: s.reversed?.byId,
    reversalReason: s.reversed?.reason,
  };
});

export const ALLOCATIONS: Allocation[] = SEEDS.flatMap((s) =>
  s.alloc.map(([leaseId, offset, cents], i) => ({
    id: `${payId(s.seq)}-A${i + 1}`,
    paymentId: payId(s.seq),
    invoiceId: invOf(leaseId, offset),
    amount: cents,
  })),
);

// ---------------------------------------------------------------------------
// Tenant credits
// ---------------------------------------------------------------------------

export const CREDITS: TenantCredit[] = [
  {
    id: `CR-${Y}-0001`,
    tenantId: "TEN-12",
    sourcePaymentId: payId(142),
    originalAmount: 10000,
    createdAt: monthDay(-2, 4) + "T14:25:00",
    note: "Overpayment of $100.00 on PAY-…-0142 retained on account.",
  },
];

export const CREDIT_APPLICATIONS: CreditApplication[] = [];

// ---------------------------------------------------------------------------
// Seed audit trail (generated from the history above — demonstration data,
// not a tamper-proof production audit system).
// ---------------------------------------------------------------------------

let audSeq = 0;
const aud = (partial: Omit<AuditEvent, "id">): AuditEvent => ({
  id: `AUD-${String(++audSeq).padStart(6, "0")}`,
  ...partial,
});

const userOf = (id: string) => USERS.find((u) => u.id === id)?.name ?? id;

export const AUDITS: AuditEvent[] = [];

for (const s of SEEDS) {
  const pid = payId(s.seq);
  const rid = rcptId(s.seq);
  const created = `${monthDay(s.offset, s.day)}T${s.at}:00`;
  AUDITS.push(
    aud({
      userId: s.byId,
      action: "payment.created",
      entityType: "payment",
      entityId: pid,
      at: created,
      summary: `${userOf(s.byId)} recorded a $${(s.cents / 100).toFixed(2)} payment for ${TENANTS.find((t) => t.id === s.tenantId)?.name ?? s.tenantId}.`,
      next: { amount: `$${(s.cents / 100).toFixed(2)}`, method: s.method, status: "draft" },
    }),
    aud({
      userId: s.byId,
      action: "payment.posted",
      entityType: "payment",
      entityId: pid,
      at: created,
      summary: `${pid} posted — ${s.alloc.length} allocation(s).`,
      prev: { status: "draft" },
      next: { status: "posted" },
    }),
    aud({
      userId: s.byId,
      action: "receipt.issued",
      entityType: "receipt",
      entityId: rid,
      at: created,
      summary: `Receipt ${rid} issued for ${pid}.`,
    }),
  );
  if (s.reversed) {
    AUDITS.push(
      aud({
        userId: s.reversed.byId,
        action: "payment.reversed",
        entityType: "payment",
        entityId: pid,
        at: `${monthDay(s.reversed.offset, s.reversed.day)}T14:05:00`,
        summary: `${pid} reversed — invoice balances recalculated.`,
        reason: s.reversed.reason,
        prev: { status: "posted" },
        next: { status: "reversed" },
      }),
    );
  }
}

AUDITS.push(
  aud({
    userId: "USR-03",
    action: "credit.created",
    entityType: "credit",
    entityId: CREDITS[0].id,
    at: CREDITS[0].createdAt,
    summary: `$100.00 overpayment on ${payId(142)} retained as tenant credit for Ethan Park.`,
    next: { originalAmount: "$100.00" },
  }),
  aud({
    userId: "USR-01",
    action: "invoice.cancelled",
    entityType: "invoice",
    entityId: cancelledInvoice.id,
    at: `${monthDay(-2, 9)}T09:30:00`,
    summary: `${cancelledInvoice.id} cancelled — duplicate of the ${periodName(1)} invoice.`,
    reason: "Duplicate entry created in error.",
    prev: { status: "open" },
    next: { status: "cancelled" },
  }),
);


