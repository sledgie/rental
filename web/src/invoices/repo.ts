// Supabase access for the Invoices page (tables invoices, invoice_lines, invoice_notes, payment_allocations + payments, tenants,
// properties, units, leases, activity_events; functions issue_invoice and record_payment).
// Inside the page an invoice is identified by its number (INV-00001), so `numbers` maps that back to the row id.
// Row-Level Security decides who may read or write; the database also refuses edits to issued invoices.
import { supabase, toError } from "../lib/supabase";
import { getActiveOrgId } from "../lib/activeOrg";
import { loadStaff } from "../properties/add/store/refRepo";
import type {
  ActivityEntry, ActivityKind, Invoice, InvoiceLineItem, InvoiceNote, InvoiceStatus, InvoiceType, LineItemCategory, Payment,
} from "./types/invoice";

/* eslint-disable @typescript-eslint/no-explicit-any -- rows come from untyped PostgREST responses */

export interface RefTenant { id: string; name: string; email: string; phone: string }
export interface RefProperty { id: string; name: string; city: string; units: number }
export interface RefUnit { id: string; propertyId: string; number: string }
export interface RefLease { id: string; number: string; tenantId: string }
export interface Refs { tenants: RefTenant[]; properties: RefProperty[]; units: RefUnit[]; leases: RefLease[] }
export const emptyRefs = (): Refs => ({ tenants: [], properties: [], units: [], leases: [] });

/** What the form hands over when creating or editing an invoice (ids come from the pickers). */
export interface InvoiceInput {
  tenantId?: string;
  leaseId?: string;
  propertyId?: string;
  unitId?: string;
  type: InvoiceType;
  status?: InvoiceStatus;
  issueDate: string;
  dueDate: string;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  discount: number;
  memo?: string;
  lineItems: InvoiceLineItem[];
}

const METHOD_FROM_DB: Record<string, Payment["method"]> = {
  bank_transfer: "Bank Transfer", card: "Credit Card", etransfer: "E-Transfer", cheque: "Cheque", cash: "Cash", pre_authorized_debit: "Pre-Authorized Debit", other: "Bank Transfer",
};
const METHOD_TO_DB: Record<Payment["method"], string> = {
  "Bank Transfer": "bank_transfer", "Credit Card": "card", "E-Transfer": "etransfer", Cheque: "cheque", Cash: "cash", "Pre-Authorized Debit": "pre_authorized_debit",
};
const KINDS: ActivityKind[] = ["created", "edited", "approved", "payment", "paid", "voided", "reminder", "sent", "note"];
const TYPE_FROM_DB: Record<string, InvoiceType> = { rent: "rent", utilities: "utilities", maintenance: "maintenance" };

/** invoice number (INV-00001) -> row id, rebuilt on every load */
const numbers = new Map<string, string>();
/** invoice number -> the tenant / lease the row belongs to (needed to record a payment) */
const owners = new Map<string, { tenantId: string; leaseId: string | null }>();

const initialsOf = (name: string) => name.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
const cap = (v: string) => v.charAt(0).toUpperCase() + v.slice(1);
const dateOnly = (v: string | null | undefined) => (v ? v.slice(0, 10) : "");

function friendly(error: { code?: string; message?: string }, fallback: string): Error {
  if (error.code === "42501") return new Error(error.message || "You don't have permission to do that.");
  if (error.code === "23514") return new Error(error.message || "A value is outside what the database allows.");
  if (error.code === "23505") return new Error("An invoice for this lease and billing period already exists.");
  return toError(error, fallback);
}
const check = (res: { error: any }, fallback: string) => { if (res.error) throw friendly(res.error, fallback); };
const needOrg = () => {
  const org = getActiveOrgId();
  if (!org) throw new Error("Select an organization first.");
  return org;
};
const rowId = (number: string) => {
  const id = numbers.get(number);
  if (!id) throw new Error("That invoice could not be found. Refresh the page and try again.");
  return id;
};

// ------------------------------------------------------------------ load
export async function loadAll(orgId: string): Promise<{ invoices: Invoice[]; refs: Refs }> {
  const q = (table: string, columns = "*") => supabase.from(table).select(columns).eq("organization_id", orgId);
  const [invoices, balances, lines, notes, allocations, tenants, properties, units, leases, parties, events, staff] = await Promise.all([
    q("invoices").order("created_at", { ascending: false }),
    q("v_invoice_balances", "invoice_id, derived_status"),
    q("invoice_lines").order("position"),
    q("invoice_notes").order("created_at"),
    q("payment_allocations", "payment_id, invoice_id, amount"),
    q("tenants", "id, first_name, last_name, email, phone"),
    q("properties", "id, name, city").is("archived_at", null),
    q("units", "id, property_id, unit_number").is("archived_at", null),
    q("leases", "id, lease_number"),
    q("lease_parties", "lease_id, tenant_id"),
    q("activity_events", "id, entity_id, occurred_at, actor_display_name, action, related_record_label, description").eq("entity_type", "invoice").order("occurred_at", { ascending: false }).limit(1000),
    loadStaff(orgId).catch(() => []),
  ]);
  // the audit trail may be hidden by Row-Level Security: that is an empty feed, not a failure
  for (const [name, res] of [["invoices", invoices], ["invoice status", balances], ["invoice lines", lines], ["notes", notes], ["payments", allocations], ["tenants", tenants], ["properties", properties], ["units", units], ["leases", leases]] as const) {
    if (res.error) throw toError(res.error, `Unable to load ${name}.`);
  }
  const paymentIds = [...new Set((allocations.data ?? []).map((a: any) => a.payment_id))];
  const payments = paymentIds.length
    ? await supabase.from("payments").select("id, payment_number, payment_date, method, reference, notes, status").in("id", paymentIds)
    : { data: [], error: null };
  if (payments.error) throw toError(payments.error, "Unable to load payments.");

  const tenantById = new Map((tenants.data ?? []).map((t: any) => [t.id, t]));
  const propertyById = new Map((properties.data ?? []).map((p: any) => [p.id, p]));
  const unitById = new Map((units.data ?? []).map((u: any) => [u.id, u]));
  const leaseById = new Map((leases.data ?? []).map((l: any) => [l.id, l]));
  const statusById = new Map((balances.data ?? []).map((b: any) => [b.invoice_id, b.derived_status as InvoiceStatus]));
  const paymentById = new Map((payments.data ?? []).map((p: any) => [p.id, p]));
  const names = new Map(staff.map((s) => [s.id, s.name]));

  const group = <T,>(rows: any[], key: string, map: (r: any) => T) => {
    const out = new Map<string, T[]>();
    for (const r of rows) out.set(r[key], [...(out.get(r[key]) ?? []), map(r)]);
    return out;
  };
  const linesBy = group(lines.data ?? [], "invoice_id", (l): InvoiceLineItem => ({
    id: l.id, description: l.description, category: cap(l.category) as LineItemCategory, quantity: Number(l.quantity), unitPrice: Number(l.unit_price), taxRate: Number(l.tax_rate),
  }));
  const notesBy = group(notes.data ?? [], "invoice_id", (n): InvoiceNote => ({
    id: n.id, author: names.get(n.author_id) ?? "Team member", createdAt: n.created_at, body: n.body, pinned: n.pinned,
  }));
  const activityBy = group(events.data ?? [], "entity_id", (e): ActivityEntry => {
    const kind = e.action.split(".")[1] as ActivityKind;
    return { id: e.id, kind: KINDS.includes(kind) ? kind : "edited", label: e.related_record_label || "Activity", detail: e.description, actor: e.actor_display_name, at: e.occurred_at };
  });

  numbers.clear();
  owners.clear();
  const result: Invoice[] = (invoices.data ?? []).map((r: any) => {
    const number = r.invoice_number ?? r.id;
    numbers.set(number, r.id);
    owners.set(number, { tenantId: r.tenant_id, leaseId: r.lease_id });
    const t: any = tenantById.get(r.tenant_id);
    const name = t ? `${t.first_name} ${t.last_name ?? ""}`.trim() : "Unknown tenant";
    const p: any = r.property_id ? propertyById.get(r.property_id) : undefined;
    const payments: Payment[] = (allocations.data ?? [])
      .filter((a: any) => a.invoice_id === r.id)
      .map((a: any) => ({ a, pay: paymentById.get(a.payment_id) as any }))
      .filter(({ pay }: any) => pay && pay.status === "posted")
      .map(({ a, pay }: any): Payment => ({
        id: pay.payment_number ?? pay.id, invoiceId: number, date: pay.payment_date, method: METHOD_FROM_DB[pay.method] ?? "Bank Transfer",
        reference: pay.reference ?? "", amount: Number(a.amount), notes: pay.notes ?? undefined,
      }));
    return {
      id: number,
      tenantId: r.tenant_id,
      unitId: r.unit_id ?? undefined,
      leaseId: r.lease_id ?? undefined,
      tenant: { name, email: t?.email ?? "", phone: t?.phone ?? "", avatarInitials: initialsOf(name) },
      propertyId: r.property_id ?? "",
      propertyName: p?.name ?? "—",
      unit: r.unit_id ? (unitById.get(r.unit_id) as any)?.unit_number ?? "—" : "—",
      leaseRef: r.lease_id ? (leaseById.get(r.lease_id) as any)?.lease_number ?? "—" : "—",
      type: TYPE_FROM_DB[r.invoice_type] ?? "other",
      status: statusById.get(r.id) ?? (r.status === "open" ? "unpaid" : r.status),
      issueDate: r.issue_date,
      dueDate: r.due_date,
      billingPeriodStart: r.billing_period_start ?? r.issue_date,
      billingPeriodEnd: r.billing_period_end ?? r.due_date,
      currency: "CAD",
      lineItems: linesBy.get(r.id) ?? [],
      discount: Number(r.discount),
      payments,
      attachments: [], // files arrive with file storage
      notes: notesBy.get(r.id) ?? [],
      activity: activityBy.get(r.id) ?? [],
      memo: r.memo ?? undefined,
    };
  });

  const unitCount = new Map<string, number>();
  for (const u of units.data ?? []) unitCount.set(u.property_id, (unitCount.get(u.property_id) ?? 0) + 1);
  const refs: Refs = {
    tenants: (tenants.data ?? []).map((t: any) => ({ id: t.id, name: `${t.first_name} ${t.last_name ?? ""}`.trim(), email: t.email ?? "", phone: t.phone ?? "" })).sort((a: RefTenant, b: RefTenant) => a.name.localeCompare(b.name)),
    properties: (properties.data ?? []).map((p: any) => ({ id: p.id, name: p.name, city: p.city, units: unitCount.get(p.id) ?? 0 })),
    units: (units.data ?? []).map((u: any) => ({ id: u.id, propertyId: u.property_id, number: u.unit_number })),
    leases: (parties.data ?? []).map((lp: any) => ({ id: lp.lease_id, number: (leaseById.get(lp.lease_id) as any)?.lease_number ?? "", tenantId: lp.tenant_id })),
  };
  return { invoices: result, refs };
}

// ------------------------------------------------------------------ writes
async function record(orgId: string, invoiceId: string, kind: ActivityKind, label: string, detail?: string) {
  // the audit trail is best-effort here: a failure to log must not undo a saved change
  await supabase.rpc("record_activity", {
    p_org: orgId, p_action: `invoice.${kind}`, p_category: "Accounting & Finance", p_description: detail || label,
    p_entity_type: "invoice", p_entity_id: invoiceId, p_label: label, p_source_module: "Invoices",
  });
}

const linesRows = (orgId: string, invoiceId: string, items: InvoiceLineItem[]) =>
  items.filter((i) => i.description.trim() !== "").map((i, position) => ({
    organization_id: orgId, invoice_id: invoiceId, position, description: i.description.trim(), category: i.category.toLowerCase(),
    quantity: i.quantity, unit_price: i.unitPrice, tax_rate: i.taxRate,
  }));

const headerRow = (v: Partial<InvoiceInput>) => {
  const r: Record<string, unknown> = {};
  if (v.tenantId !== undefined) r.tenant_id = v.tenantId;
  if (v.leaseId !== undefined) r.lease_id = v.leaseId || null;
  if (v.propertyId !== undefined) r.property_id = v.propertyId || null;
  if (v.unitId !== undefined) r.unit_id = v.unitId || null;
  if (v.type !== undefined) r.invoice_type = v.type;
  if (v.issueDate !== undefined) r.issue_date = v.issueDate;
  if (v.dueDate !== undefined) r.due_date = v.dueDate;
  if (v.billingPeriodStart !== undefined) r.billing_period_start = v.billingPeriodStart || null;
  if (v.billingPeriodEnd !== undefined) r.billing_period_end = v.billingPeriodEnd || null;
  if (v.discount !== undefined) r.discount = v.discount || 0;
  if (v.memo !== undefined) r.memo = v.memo || null;
  return r;
};

/** Creates the invoice (always as a draft first), then issues it when the form asked for "unpaid". Returns the invoice number. */
export async function createInvoice(input: InvoiceInput): Promise<string> {
  const orgId = needOrg();
  if (!input.tenantId) throw new Error("Choose a tenant for this invoice.");
  const { data: auth } = await supabase.auth.getUser();
  const created = await supabase
    .from("invoices")
    .insert({ ...headerRow(input), organization_id: orgId, status: "draft", created_by: auth.user?.id ?? null })
    .select("id, invoice_number")
    .single();
  check(created, "Unable to create the invoice.");
  const { id, invoice_number: number } = created.data as any;
  try {
    const rows = linesRows(orgId, id, input.lineItems);
    if (rows.length) check(await supabase.from("invoice_lines").insert(rows), "Unable to save the invoice lines.");
    if (input.status === "unpaid") check(await supabase.rpc("issue_invoice", { p_invoice: id }), "Unable to issue the invoice.");
    else if (input.status === "pending_approval") check(await supabase.from("invoices").update({ status: "pending_approval" }).eq("id", id), "Unable to submit the invoice for approval.");
  } catch (error) {
    await supabase.from("invoices").delete().eq("id", id); // do not leave an empty draft behind
    throw error;
  }
  await record(orgId, id, "created", "Invoice created", `Invoice ${number} created.`);
  return number;
}

export async function updateInvoice(number: string, patch: Partial<InvoiceInput>): Promise<void> {
  const orgId = needOrg();
  const id = rowId(number);
  const row = headerRow(patch);
  if (Object.keys(row).length) {
    const res = await supabase.from("invoices").update(row).eq("id", id).select("id");
    check(res, "Unable to save the invoice.");
    if (!res.data?.length) throw new Error("You don't have permission to edit invoices.");
  }
  if (patch.lineItems) {
    check(await supabase.from("invoice_lines").delete().eq("invoice_id", id), "Unable to save the invoice lines.");
    const rows = linesRows(orgId, id, patch.lineItems);
    if (rows.length) check(await supabase.from("invoice_lines").insert(rows), "Unable to save the invoice lines.");
  }
  await record(orgId, id, "edited", "Invoice edited", "Line items or billing details changed.");
}

export async function approveInvoice(number: string): Promise<void> {
  const orgId = needOrg();
  const id = rowId(number);
  check(await supabase.rpc("issue_invoice", { p_invoice: id }), "Unable to approve the invoice.");
  await record(orgId, id, "approved", "Invoice approved", "Approved and issued to the tenant ledger.");
}

export async function voidInvoice(number: string, reason?: string): Promise<void> {
  const orgId = needOrg();
  const id = rowId(number);
  const res = await supabase.from("invoices").update({ status: "void", void_reason: reason?.trim() || null }).eq("id", id).select("id");
  check(res, "Unable to void the invoice.");
  if (!res.data?.length) throw new Error("You don't have permission to void invoices.");
  await record(orgId, id, "voided", "Invoice voided", reason?.trim() || "Voided from the invoice register.");
}

export async function addNote(number: string, body: string): Promise<void> {
  const orgId = needOrg();
  const id = rowId(number);
  const { data: auth } = await supabase.auth.getUser();
  check(await supabase.from("invoice_notes").insert({ organization_id: orgId, invoice_id: id, author_id: auth.user?.id ?? null, body }), "Unable to save the note.");
  await record(orgId, id, "note", "Internal note added");
}

/** Records the payment and applies all of it to this invoice (the database validates the amount against the balance). */
export async function recordPayment(number: string, input: { date: string; method: Payment["method"]; reference: string; amount: number; notes?: string }): Promise<void> {
  const orgId = needOrg();
  const id = rowId(number);
  const owner = owners.get(number);
  if (!owner) throw new Error("That invoice could not be found. Refresh the page and try again.");
  check(await supabase.rpc("record_payment", {
    p_org: orgId, p_tenant: owner.tenantId, p_lease: owner.leaseId, p_date: input.date, p_amount: input.amount, p_method: METHOD_TO_DB[input.method],
    p_reference: input.reference, p_notes: input.notes ?? null, p_bank_account: null, p_allocations: [{ invoice_id: id, amount: input.amount }],
    p_keep_credit: false, p_idempotency_key: crypto.randomUUID(),
  }), "Unable to record the payment.");
  await record(orgId, id, "payment", "Payment recorded", `${input.method} · ${input.reference}`);
}
