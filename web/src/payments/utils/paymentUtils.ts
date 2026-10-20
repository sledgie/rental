import type {
  Allocation,
  AllocationStrategy,
  AuditAction,
  CreditApplication,
  CreditBalance,
  Invoice,
  InvoiceBalance,
  InvoiceStatus,
  Payment,
  PaymentMethod,
  TenantCredit,
} from "../types";

export const COMPANY = {
  name: "Northgate Residential Management",
  address: "480 Queen Street East, Toronto, ON M5A 1T7",
  phone: "(416) 555-0184",
  email: "office@northgate-residential.example",
};

export const METHOD_LABELS: Record<PaymentMethod, string> = {
  etransfer: "Interac e-Transfer",
  cash: "Cash",
  card: "Debit/Credit Card — External Terminal",
};

export const METHOD_SHORT: Record<PaymentMethod, string> = {
  etransfer: "Interac e-Transfer",
  cash: "Cash",
  card: "Card (external)",
};

export const ACTION_LABELS: Record<AuditAction, string> = {
  "payment.created": "Payment created",
  "payment.posted": "Payment posted",
  "payment.reversed": "Payment reversed",
  "receipt.issued": "Receipt issued",
  "receipt.reprinted": "Receipt reprinted",
  "receipt.downloaded": "Receipt downloaded",
  "refund.recorded": "Refund recorded",
  "credit.created": "Tenant credit created",
  "credit.applied": "Tenant credit applied",
  "credit.invalidated": "Credit invalidated",
  "invoice.cancelled": "Invoice cancelled",
};

// ---------------------------------------------------------------------------
// Money — everything is integer cents.
// ---------------------------------------------------------------------------

const cad = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" });
export const fmtCAD = (cents: number) => cad.format(cents / 100);

/** Parse a user-entered dollar string ("1,234.56") into integer cents. Null if invalid. */
export function parseToCents(input: string): number | null {
  const cleaned = input.replace(/[$\s,]/g, "");
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(cleaned)) return null;
  const [whole, frac = ""] = cleaned.split(".");
  return parseInt(whole, 10) * 100 + parseInt((frac + "00").slice(0, 2), 10);
}

export const sumCents = (values: number[]) => values.reduce((a, b) => a + b, 0);

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

export function todayISO() {
  const d = new Date();
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

export function formatDate(isoDate: string) {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function periodLabel(startISO: string, endISO: string) {
  const start = new Date(`${startISO}T00:00:00`);
  const end = new Date(`${endISO}T00:00:00`);
  const sameMonth =
    start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth();
  const fmt = (d: Date, withYear: boolean) =>
    d.toLocaleDateString("en-CA", {
      month: "short",
      day: "numeric",
      ...(withYear ? { year: "numeric" } : {}),
    });
  return sameMonth
    ? start.toLocaleDateString("en-CA", { month: "long", year: "numeric" })
    : `${fmt(start, start.getFullYear() !== end.getFullYear())} – ${fmt(end, true)}`;
}

// ---------------------------------------------------------------------------
// Derived balances — the single source of truth.
// ---------------------------------------------------------------------------

export const invoiceNetCharge = (inv: Invoice) =>
  inv.originalAmount + sumCents(inv.adjustments.map((a) => a.amount));

/** Posted payment IDs. Reversed payments never count toward anything. */
export function activePaymentIds(payments: Payment[]): Set<string> {
  return new Set(payments.filter((p) => p.status === "posted").map((p) => p.id));
}

export function buildInvoiceBalances(
  invoices: Invoice[],
  payments: Payment[],
  allocations: Allocation[],
  creditApplications: CreditApplication[],
): Map<string, InvoiceBalance> {
  const active = activePaymentIds(payments);
  const paidByPayments = new Map<string, number>();
  for (const a of allocations) {
    if (!active.has(a.paymentId)) continue;
    paidByPayments.set(a.invoiceId, (paidByPayments.get(a.invoiceId) ?? 0) + a.amount);
  }
  const paidByCredits = new Map<string, number>();
  for (const ca of creditApplications) {
    paidByCredits.set(ca.invoiceId, (paidByCredits.get(ca.invoiceId) ?? 0) + ca.amount);
  }
  const today = todayISO();
  const map = new Map<string, InvoiceBalance>();
  for (const inv of invoices) {
    const netCharge = invoiceNetCharge(inv);
    const byPayments = paidByPayments.get(inv.id) ?? 0;
    const byCredits = paidByCredits.get(inv.id) ?? 0;
    const paid = byPayments + byCredits;
    const outstanding = Math.max(0, netCharge - paid);
    const overdue = inv.status !== "cancelled" && outstanding > 0 && inv.dueDate < today;
    let status: InvoiceStatus;
    if (inv.status === "cancelled") status = "cancelled";
    else if (outstanding === 0) status = "paid";
    else if (paid > 0) status = "partial";
    else if (overdue) status = "overdue";
    else status = "open";
    map.set(inv.id, {
      invoiceId: inv.id,
      netCharge,
      paidByPayments: byPayments,
      paidByCredits: byCredits,
      paid,
      outstanding,
      status,
      overdue,
    });
  }
  return map;
}

/** Credits whose source payment was reversed are invalid and cannot be spent. */
export function buildCreditBalances(
  credits: TenantCredit[],
  creditApplications: CreditApplication[],
  payments: Payment[],
): Map<string, CreditBalance> {
  const active = activePaymentIds(payments);
  const applied = new Map<string, number>();
  for (const ca of creditApplications) applied.set(ca.creditId, (applied.get(ca.creditId) ?? 0) + ca.amount);
  const map = new Map<string, CreditBalance>();
  for (const c of credits) {
    const valid = c.sourcePaymentId === null || active.has(c.sourcePaymentId);
    const remaining = Math.max(0, c.originalAmount - (applied.get(c.id) ?? 0));
    map.set(c.id, { creditId: c.id, remaining, valid, exhausted: remaining === 0 });
  }
  return map;
}

export function tenantAvailableCredit(
  credits: TenantCredit[],
  creditBalances: Map<string, CreditBalance>,
  tenantId: string,
): number {
  return sumCents(
    credits
      .filter((c) => c.tenantId === tenantId)
      .map((c) => {
        const b = creditBalances.get(c.id);
        return b && b.valid && !b.exhausted ? b.remaining : 0;
      }),
  );
}

/** Outstanding, non-cancelled invoices for a tenant/lease, sorted by due date. */
export function eligibleInvoices(
  invoices: Invoice[],
  balances: Map<string, InvoiceBalance>,
  tenantId: string,
  leaseId: string,
): Invoice[] {
  return invoices
    .filter((inv) => {
      if (inv.tenantId !== tenantId || inv.leaseId !== leaseId) return false;
      if (inv.status === "cancelled") return false;
      return (balances.get(inv.id)?.outstanding ?? 0) > 0;
    })
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

// ---------------------------------------------------------------------------
// Allocation
// ---------------------------------------------------------------------------

export interface AllocatableInvoice {
  invoiceId: string;
  dueDate: string;
  outstanding: number;
}

/**
 * Spread available funds across invoices. Strategy is configurable; default is
 * oldest-first. Returns per-invoice amounts (integer cents).
 */
export function allocateFunds(
  items: AllocatableInvoice[],
  fundsCents: number,
  strategy: AllocationStrategy = "oldest",
): Array<{ invoiceId: string; amount: number }> {
  const sorted = [...items].sort((a, b) =>
    strategy === "oldest" ? a.dueDate.localeCompare(b.dueDate) : b.dueDate.localeCompare(a.dueDate),
  );
  let remaining = fundsCents;
  const lines: Array<{ invoiceId: string; amount: number }> = [];
  for (const item of sorted) {
    if (remaining <= 0) break;
    const apply = Math.min(remaining, item.outstanding);
    if (apply > 0) {
      lines.push({ invoiceId: item.invoiceId, amount: apply });
      remaining -= apply;
    }
  }
  return lines;
}

/**
 * Split per-invoice applied amounts into payment-funded allocations and
 * credit-funded amounts. Payment money covers invoices first (in given order);
 * tenant credit covers the remainder.
 */
export function splitFunding(
  rows: Array<{ invoiceId: string; amount: number }>,
  paymentCents: number,
): { allocations: Array<{ invoiceId: string; amount: number }>; creditNeeded: number } {
  let paymentRemaining = paymentCents;
  const allocations: Array<{ invoiceId: string; amount: number }> = [];
  let creditNeeded = 0;
  for (const row of rows) {
    if (row.amount <= 0) continue;
    const fromPayment = Math.min(row.amount, paymentRemaining);
    paymentRemaining -= fromPayment;
    if (fromPayment > 0) allocations.push({ invoiceId: row.invoiceId, amount: fromPayment });
    creditNeeded += row.amount - fromPayment;
  }
  return { allocations, creditNeeded };
}

// ---------------------------------------------------------------------------
// ID generation (demo sequences derived from current in-memory collections)
// ---------------------------------------------------------------------------

const YEAR = new Date().getFullYear();

function nextSeq(values: string[], pattern: RegExp): number {
  let max = 0;
  for (const v of values) {
    const m = v.match(pattern);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return max + 1;
}

export const nextPaymentId = (payments: Payment[]) =>
  `PAY-${YEAR}-${String(nextSeq(payments.map((p) => p.id), /PAY-\d{4}-(\d+)$/)).padStart(4, "0")}`;

export const nextReceiptId = (payments: Payment[]) =>
  `RCPT-${YEAR}-${String(nextSeq(payments.map((p) => p.receiptId ?? ""), /RCPT-\d{4}-(\d+)$/)).padStart(4, "0")}`;

export const nextCreditId = (credits: TenantCredit[]) =>
  `CR-${YEAR}-${String(nextSeq(credits.map((c) => c.id), /CR-\d{4}-(\d+)$/)).padStart(4, "0")}`;

export const nextAuditId = (events: Array<{ id: string }>) =>
  `AUD-${String(nextSeq(events.map((e) => e.id), /AUD-(\d+)$/)).padStart(6, "0")}`;

// ---------------------------------------------------------------------------
// Duplicate detection — warnings only, never auto-rejection.
// ---------------------------------------------------------------------------

export function findDuplicateReference(payments: Payment[], reference?: string): Payment[] {
  const ref = reference?.trim();
  if (!ref) return [];
  return payments.filter(
    (p) => p.status === "posted" && (p.reference ?? "").trim().toLowerCase() === ref.toLowerCase(),
  );
}

export function findPossibleDuplicates(
  payments: Payment[],
  tenantId: string,
  date: string,
  amountCents: number,
  method: PaymentMethod,
): Payment[] {
  return payments.filter(
    (p) =>
      p.status === "posted" &&
      p.tenantId === tenantId &&
      p.date === date &&
      p.method === method &&
      p.amount === amountCents,
  );
}

// ---------------------------------------------------------------------------
// Validation — reusable, server-portable rules.
// ---------------------------------------------------------------------------

export interface PaymentDraftRow {
  invoiceId: string;
  amountText: string;
}

export interface PaymentDraft {
  tenantId: string;
  leaseId: string;
  date: string;
  amountText: string;
  method: PaymentMethod;
  rows: PaymentDraftRow[];
  useCredit: boolean;
  creditAvailableCents: number;
  keepCreditDecided: boolean;
}

export interface DraftValidation {
  errors: Record<string, string>;
  warnings: string[];
  amountCents: number;
  rowsCents: Array<{ invoiceId: string; amount: number; error?: string }>;
  totalAllocated: number;
  unallocated: number;
  overpayment: boolean;
}

export function validatePaymentDraft(
  draft: PaymentDraft,
  invoices: Invoice[],
  balances: Map<string, InvoiceBalance>,
  payments: Payment[],
): DraftValidation {
  const errors: Record<string, string> = {};
  const warnings: string[] = [];

  if (!draft.tenantId) errors.tenant = "Select a tenant.";
  if (!draft.leaseId) errors.lease = "Select the lease or rental account for this payment.";
  if (!draft.date) errors.date = "Payment date is required.";

  const amountCents = parseToCents(draft.amountText) ?? -1;
  if (parseToCents(draft.amountText) === null)
    errors.amount = "Enter a valid amount in dollars and cents (max 2 decimals).";
  else if (amountCents <= 0) errors.amount = "Amount received must be greater than $0.00.";
  else if (amountCents > 10_000_000) errors.amount = "Amount looks too large for a rent payment.";

  if (!METHOD_LABELS[draft.method]) errors.method = "Choose a supported payment method.";

  const invoiceById = new Map(invoices.map((i) => [i.id, i]));
  const rowsCents: DraftValidation["rowsCents"] = [];
  let totalAllocated = 0;
  for (const row of draft.rows) {
    const inv = invoiceById.get(row.invoiceId);
    const bal = balances.get(row.invoiceId);
    const cents = parseToCents(row.amountText);
    let rowError: string | undefined;
    if (cents === null) rowError = "Invalid amount.";
    else {
      if (cents < 0) rowError = "Allocation amounts cannot be negative.";
      if (inv?.status === "cancelled") rowError = "Cancelled invoices cannot receive allocations.";
      if (bal && bal.status === "paid") rowError = "Invoice is already fully paid.";
      if (cents > 0 && bal && cents > bal.outstanding)
        rowError = `Cannot exceed the outstanding balance (${fmtCAD(bal.outstanding)}).`;
    }
    const amt = cents ?? 0;
    if (!rowError) totalAllocated += amt;
    rowsCents.push({ invoiceId: row.invoiceId, amount: rowError ? 0 : amt, error: rowError });
    if (rowError) errors[`row:${row.invoiceId}`] = rowError;
  }

  const funds = amountCents > 0 ? amountCents + (draft.useCredit ? draft.creditAvailableCents : 0) : 0;
  if (totalAllocated === 0 && draft.rows.length > 0)
    errors.allocation = "Allocate at least $0.01 to an invoice, or remove all selections.";
  if (totalAllocated > funds)
    errors.allocation = draft.useCredit
      ? `Total allocated (${fmtCAD(totalAllocated)}) exceeds payment plus available credit (${fmtCAD(funds)}).`
      : `Total allocated (${fmtCAD(totalAllocated)}) exceeds the amount received (${fmtCAD(Math.max(0, amountCents))}). Apply tenant credit or reduce allocations.`;

  const unallocated = Math.max(0, (amountCents > 0 ? amountCents : 0) - totalAllocated);
  const overpayment = amountCents > 0 && totalAllocated > 0 && unallocated > 0;
  if (overpayment && !draft.keepCreditDecided)
    errors.overpay = "Decide how to handle the excess: allocate it or retain it as tenant credit.";

  if (!errors.amount && !errors.tenant) {
    for (const p of findPossibleDuplicates(payments, draft.tenantId, draft.date, amountCents, draft.method))
      warnings.push(`Possible duplicate of ${p.id} — same tenant, date, method and amount.`);
  }

  return { errors, warnings, amountCents: Math.max(0, amountCents), rowsCents, totalAllocated, unallocated, overpayment };
}

export function validateReferenceDuplicate(payments: Payment[], reference?: string): string | null {
  const matches = findDuplicateReference(payments, reference);
  if (matches.length === 0) return null;
  return `Reference “${reference?.trim()}” already appears on ${matches.map((p) => p.id).join(", ")} — verify this is not the same transaction.`;
}
