// Supabase access for the Payments page. Inside the page everything is identified by its human number: invoices (INV-00001),
// payments (PAY-00001), credits (CN-00001) and leases (LSE-00001); the maps below turn those back into row ids for the database.
// Posting, reversing and applying credits are done by the database functions record_payment, reverse_payment and apply_credit_note,
// so each is atomic and validated there (allocations cannot exceed the payment or the invoice balance).
import { supabase, toError } from "../lib/supabase";
import { getActiveOrgId } from "../lib/activeOrg";
import { loadStaff } from "../properties/add/store/refRepo";
import type {
  Allocation, AuditAction, AuditEvent, CreditApplication, Invoice, Lease, Payment, PaymentMethod, Property, StaffUser, Tenant, TenantCredit, Unit,
} from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any -- rows come from untyped PostgREST responses */

export interface LedgerData {
  /** the organization issuing the receipts */
  company: { name: string; address: string; phone: string; email: string };
  invoices: Invoice[];
  leases: Lease[];
  properties: Property[];
  tenants: Tenant[];
  units: Unit[];
  users: StaffUser[];
  payments: Payment[];
  allocations: Allocation[];
  credits: TenantCredit[];
  creditApplications: CreditApplication[];
  audits: AuditEvent[];
}

export const emptyLedger = (): LedgerData => ({
  company: { name: "", address: "", phone: "", email: "" },
  invoices: [], leases: [], properties: [], tenants: [], units: [], users: [], payments: [], allocations: [], credits: [], creditApplications: [], audits: [],
});

const cents = (v: unknown) => Math.round(Number(v ?? 0) * 100);
const dollars = (c: number) => Math.round(c) / 100;

// the database has more payment methods than the page offers; show the closest one
const METHOD_FROM_DB: Record<string, PaymentMethod> = {
  etransfer: "etransfer", cash: "cash", card: "card", bank_transfer: "etransfer", pre_authorized_debit: "etransfer", cheque: "cash", other: "cash",
};
const roleOf = (role: string): StaffUser["role"] => (["Owner", "Administrator"].includes(role) ? "Administrator" : ["Accountant", "Property Manager"].includes(role) ? "Payment Clerk" : "Supervisor");

const invoiceRow = new Map<string, string>(); // INV number -> row id
const paymentRow = new Map<string, string>(); // PAY number -> row id
const creditRow = new Map<string, string>(); // CN number -> row id
const leaseRow = new Map<string, string>(); // LSE number -> row id

const need = <T,>(map: Map<string, T>, key: string, what: string): T => {
  const v = map.get(key);
  if (v === undefined) throw new Error(`${what} ${key} could not be found. Refresh the page and try again.`);
  return v;
};
const needOrg = () => {
  const org = getActiveOrgId();
  if (!org) throw new Error("Select an organization first.");
  return org;
};
const check = (res: { error: any }, fallback: string) => {
  if (res.error) {
    const e = res.error;
    throw new Error(e.code === "42501" || e.code === "23514" || e.code === "22023" || e.code === "P0001" ? e.message || fallback : toError(e, fallback).message);
  }
};

// ------------------------------------------------------------------ load
export async function loadLedger(orgId: string): Promise<LedgerData> {
  const q = (table: string, columns = "*") => supabase.from(table).select(columns).eq("organization_id", orgId);
  const [org, invoices, lines, tenants, properties, units, leases, leaseUnits, parties, payments, allocations, refunds, credits, applications, events, staff] = await Promise.all([
    supabase.from("organizations").select("name, email, phone, address_line1, city, state_province, postal_code").eq("id", orgId).maybeSingle(),
    q("invoices").in("status", ["open", "void"]).order("due_date"),
    q("invoice_lines", "invoice_id, description, subtotal, tax_amount, position").order("position"),
    q("tenants", "id, tenant_number, first_name, last_name, email, phone, status"),
    q("properties", "id, name, address_line1, city").is("archived_at", null),
    q("units", "id, property_id, unit_number").is("archived_at", null),
    q("leases", "id, lease_number, start_date, end_date, status, agreed_monthly_rent"),
    q("lease_units", "lease_id, unit_id").order("created_at"),
    q("lease_parties", "lease_id, tenant_id, role, relationship_end_date"),
    q("payments").order("created_at", { ascending: false }),
    q("payment_allocations", "id, payment_id, invoice_id, amount"),
    q("payment_refunds", "payment_id, amount, reason, refunded_by, created_at").order("created_at"),
    q("credit_notes").eq("status", "open").order("created_at"),
    q("credit_note_applications", "id, credit_note_id, invoice_id, amount, applied_on, created_at"),
    q("activity_events", "id, actor_id, action, entity_type, entity_id, occurred_at, description, reason, metadata").in("entity_type", ["payment", "receipt", "credit", "refund"]).order("occurred_at"),
    loadStaff(orgId).catch(() => []),
  ]);
  // the audit trail may be hidden by Row-Level Security: that is an empty list, not a failure
  for (const [name, res] of [["invoices", invoices], ["invoice lines", lines], ["tenants", tenants], ["properties", properties], ["units", units], ["leases", leases], ["lease units", leaseUnits], ["lease parties", parties], ["payments", payments], ["allocations", allocations], ["refunds", refunds], ["credits", credits], ["credit applications", applications]] as const) {
    if (res.error) throw toError(res.error, `Unable to load ${name}.`);
  }

  invoiceRow.clear(); paymentRow.clear(); creditRow.clear(); leaseRow.clear();
  const o: any = org.data;
  const invNumber = new Map<string, string>();
  for (const i of invoices.data ?? []) { invNumber.set(i.id, i.invoice_number); invoiceRow.set(i.invoice_number, i.id); }
  // allocations may point at invoices that are drafts or not loaded; they are ignored below
  const payNumber = new Map<string, string>();
  for (const p of payments.data ?? []) { payNumber.set(p.id, p.payment_number); paymentRow.set(p.payment_number, p.id); }
  const creditNumber = new Map<string, string>();
  for (const c of credits.data ?? []) { creditNumber.set(c.id, c.credit_number); creditRow.set(c.credit_number, c.id); }
  const leaseNumber = new Map<string, string>();
  for (const l of leases.data ?? []) { leaseNumber.set(l.id, l.lease_number); leaseRow.set(l.lease_number, l.id); }

  const linesBy = new Map<string, any[]>();
  for (const l of lines.data ?? []) linesBy.set(l.invoice_id, [...(linesBy.get(l.invoice_id) ?? []), l]);
  const refundBy = new Map<string, any[]>();
  for (const r of refunds.data ?? []) refundBy.set(r.payment_id, [...(refundBy.get(r.payment_id) ?? []), r]);

  const out = emptyLedger();
  if (o) out.company = { name: o.name, address: [o.address_line1, o.city, o.state_province, o.postal_code].filter(Boolean).join(", "), phone: o.phone ?? "", email: o.email ?? "" };
  out.tenants = (tenants.data ?? []).map((t: any): Tenant => ({
    id: t.id, number: t.tenant_number ?? "", name: `${t.first_name} ${t.last_name ?? ""}`.trim(), email: t.email ?? "", phone: t.phone ?? "", active: t.status === "active",
  }));
  out.properties = (properties.data ?? []).map((p: any): Property => ({ id: p.id, name: p.name, address: [p.address_line1, p.city].filter(Boolean).join(", ") }));
  out.units = (units.data ?? []).map((u: any): Unit => ({ id: u.id, propertyId: u.property_id, number: u.unit_number }));
  out.leases = (leases.data ?? []).map((l: any): Lease => {
    const main = (parties.data ?? []).find((p: any) => p.lease_id === l.id && p.role === "main_tenant" && !p.relationship_end_date) ?? (parties.data ?? []).find((p: any) => p.lease_id === l.id);
    return {
      id: l.lease_number,
      tenantId: main?.tenant_id ?? "",
      unitId: (leaseUnits.data ?? []).find((lu: any) => lu.lease_id === l.id)?.unit_id ?? "",
      startDate: l.start_date,
      endDate: l.end_date ?? l.start_date,
      monthlyRent: cents(l.agreed_monthly_rent),
      status: l.status === "active" ? "active" : "ended",
    };
  });
  out.users = staff.map((s): StaffUser => ({ id: s.id, name: s.name, role: roleOf(s.role) }));

  out.invoices = (invoices.data ?? []).map((i: any): Invoice => {
    const rows = linesBy.get(i.id) ?? [];
    const gross = rows.reduce((sum, l) => sum + cents(l.subtotal) + cents(l.tax_amount), 0);
    return {
      id: i.invoice_number,
      number: i.invoice_number,
      tenantId: i.tenant_id,
      leaseId: i.lease_id ? leaseNumber.get(i.lease_id) ?? "" : "",
      periodStart: i.billing_period_start ?? i.issue_date,
      periodEnd: i.billing_period_end ?? i.due_date,
      dueDate: i.due_date,
      originalAmount: gross,
      adjustments: Number(i.discount) > 0 ? [{ label: "Discount", amount: -cents(i.discount) }] : [],
      status: i.status === "void" ? "cancelled" : "open",
      description: i.memo || rows[0]?.description || "Invoice",
    };
  });

  out.payments = (payments.data ?? []).map((p: any): Payment => {
    const refundRows = refundBy.get(p.id) ?? [];
    const last = refundRows[refundRows.length - 1];
    return {
      id: p.payment_number,
      receiptId: p.receipt_number ?? null,
      tenantId: p.tenant_id,
      leaseId: p.lease_id ? leaseNumber.get(p.lease_id) ?? "" : "",
      date: p.payment_date,
      method: METHOD_FROM_DB[p.method] ?? "cash",
      amount: cents(p.amount),
      reference: p.reference ?? undefined,
      notes: p.notes ?? undefined,
      status: p.status,
      recordedById: p.recorded_by ?? "",
      createdAt: p.created_at,
      reversedAt: p.reversed_at ?? undefined,
      reversedById: p.reversed_by ?? undefined,
      reversalReason: p.reversal_reason ?? undefined,
      refund: last ? { at: last.created_at, byId: last.refunded_by ?? "", amount: refundRows.reduce((s, r) => s + cents(r.amount), 0), reason: last.reason } : undefined,
    };
  });
  out.allocations = (allocations.data ?? [])
    .filter((a: any) => payNumber.has(a.payment_id) && invNumber.has(a.invoice_id))
    .map((a: any): Allocation => ({ id: a.id, paymentId: payNumber.get(a.payment_id)!, invoiceId: invNumber.get(a.invoice_id)!, amount: cents(a.amount) }));
  out.credits = (credits.data ?? []).map((c: any): TenantCredit => ({
    id: c.credit_number, tenantId: c.tenant_id, sourcePaymentId: c.source_payment_id ? payNumber.get(c.source_payment_id) ?? null : null,
    originalAmount: cents(c.amount), createdAt: c.created_at, note: c.reason ?? undefined,
  }));
  out.creditApplications = (applications.data ?? [])
    .filter((a: any) => creditNumber.has(a.credit_note_id) && invNumber.has(a.invoice_id))
    .map((a: any): CreditApplication => ({ id: a.id, creditId: creditNumber.get(a.credit_note_id)!, invoiceId: invNumber.get(a.invoice_id)!, amount: cents(a.amount), at: a.created_at }));
  out.audits = (events.data ?? []).map((e: any): AuditEvent => ({
    id: e.id, userId: e.actor_id ?? "", action: e.action as AuditAction, entityType: e.entity_type, entityId: e.entity_id, at: e.occurred_at, summary: e.description,
    reason: e.reason ?? undefined, prev: e.metadata?.prev ?? undefined, next: e.metadata?.next ?? undefined,
  }));
  return out;
}

// ------------------------------------------------------------------ writes
/** Writes audit events (attributed to the signed-in user by the database). The trail is best-effort: a logging failure never undoes a saved payment. */
export async function recordAudits(events: Omit<AuditEvent, "id" | "userId" | "at">[]) {
  const orgId = needOrg();
  for (const e of events) {
    await supabase.rpc("record_activity", {
      p_org: orgId, p_action: e.action, p_category: "Accounting & Finance", p_description: e.summary, p_entity_type: e.entityType, p_entity_id: e.entityId,
      p_label: e.entityId, p_reason: e.reason ?? null, p_metadata: { prev: e.prev ?? null, next: e.next ?? null }, p_source_module: "Payments",
    });
  }
}

export interface PostPlan {
  tenantId: string;
  leaseId: string;
  date: string;
  amountCents: number;
  method: PaymentMethod;
  reference?: string;
  notes?: string;
  /** cash allocations: which invoice (by number) gets how much of this payment */
  cash: { invoiceId: string; amount: number }[];
  /** existing credits spent on invoices */
  credits: { creditId: string; invoiceId: string; amount: number }[];
  keepCredit: boolean;
}

/** Posts the payment, then spends credits. Returns the numbers the database assigned. */
export async function postPayment(plan: PostPlan, fmt: (cents: number) => string): Promise<{ paymentNumber: string; receiptNumber: string | null; creditNumber: string | null }> {
  const orgId = needOrg();
  const { data: id, error } = await supabase.rpc("record_payment", {
    p_org: orgId, p_tenant: plan.tenantId, p_lease: plan.leaseId ? need(leaseRow, plan.leaseId, "Lease") : null, p_date: plan.date, p_amount: dollars(plan.amountCents),
    p_method: plan.method === "etransfer" ? "etransfer" : plan.method, p_reference: plan.reference ?? null, p_notes: plan.notes ?? null, p_bank_account: null,
    p_allocations: plan.cash.map((c) => ({ invoice_id: need(invoiceRow, c.invoiceId, "Invoice"), amount: dollars(c.amount) })),
    p_keep_credit: plan.keepCredit, p_idempotency_key: crypto.randomUUID(),
  });
  if (error) check({ error }, "Unable to post the payment.");
  for (const c of plan.credits) {
    check(await supabase.rpc("apply_credit_note", { p_credit: need(creditRow, c.creditId, "Credit"), p_invoice: need(invoiceRow, c.invoiceId, "Invoice"), p_amount: dollars(c.amount) }), "Unable to apply the credit.");
  }
  const [paid, created] = await Promise.all([
    supabase.from("payments").select("payment_number, receipt_number").eq("id", id).single(),
    supabase.from("credit_notes").select("credit_number, amount").eq("source_payment_id", id).maybeSingle(),
  ]);
  const paymentNumber = (paid.data as any)?.payment_number ?? String(id);
  const receiptNumber = (paid.data as any)?.receipt_number ?? null;
  const creditNumber = (created.data as any)?.credit_number ?? null;

  const events: Omit<AuditEvent, "id" | "userId" | "at">[] = [
    { action: "payment.created", entityType: "payment", entityId: paymentNumber, summary: `Draft payment of ${fmt(plan.amountCents)} created for tenant ${plan.tenantId}.`, next: { amount: fmt(plan.amountCents), method: plan.method, status: "draft" } },
    { action: "payment.posted", entityType: "payment", entityId: paymentNumber, summary: `${paymentNumber} posted — ${plan.cash.length} allocation(s)${plan.credits.length ? `, ${plan.credits.length} credit application(s)` : ""}.`, prev: { status: "draft" }, next: { status: "posted" } },
  ];
  if (receiptNumber) events.push({ action: "receipt.issued", entityType: "receipt", entityId: receiptNumber, summary: `Receipt ${receiptNumber} issued for ${paymentNumber}.` });
  for (const c of plan.credits) events.push({ action: "credit.applied", entityType: "credit", entityId: c.creditId, summary: `${fmt(c.amount)} of ${c.creditId} applied to invoice ${c.invoiceId}.`, next: { appliedTo: c.invoiceId, amount: fmt(c.amount) } });
  if (creditNumber) events.push({ action: "credit.created", entityType: "credit", entityId: creditNumber, summary: `${fmt(cents((created.data as any).amount))} unapplied funds from ${paymentNumber} retained as tenant credit.`, next: { originalAmount: fmt(cents((created.data as any).amount)) } });
  await recordAudits(events);
  return { paymentNumber, receiptNumber, creditNumber };
}

export async function reversePayment(paymentNumber: string, reason: string, events: Omit<AuditEvent, "id" | "userId" | "at">[]) {
  check(await supabase.rpc("reverse_payment", { p_payment: need(paymentRow, paymentNumber, "Payment"), p_reason: reason }), "Unable to reverse the payment.");
  await recordAudits(events);
}

export async function recordRefund(paymentNumber: string, amountCents: number, reason: string, events: Omit<AuditEvent, "id" | "userId" | "at">[]) {
  const orgId = needOrg();
  const { data: auth } = await supabase.auth.getUser();
  check(await supabase.from("payment_refunds").insert({
    organization_id: orgId, payment_id: need(paymentRow, paymentNumber, "Payment"), amount: dollars(amountCents), reason, refunded_by: auth.user?.id ?? null,
  }), "Unable to record the refund.");
  await recordAudits(events);
}
