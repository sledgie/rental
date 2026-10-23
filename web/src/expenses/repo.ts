// Supabase access for Expenses & Bills (tables bills, bill_units, bill_tenant_allocations, bill_payments, bill_tenant_recoveries, bill_schedules,
// bill_schedule_tenants, vendors, tenants, leases, properties, units). A bill is identified inside the page by its number (BILL-00001);
// `billRow` turns that back into the row id. Row-Level Security decides who may read or write; the database also refuses a payment or
// recovery that would exceed the bill amount.
import { supabase, toError } from "../lib/supabase";
import { fileSize, listDocuments, uploadDocument } from "../lib/documents";
import { getActiveOrgId } from "../lib/activeOrg";
import { fetchAll } from "../lib/financeData";
import type {
  AppState, Bill, BillCategory, Lease, Property, ProviderPayment, RecurringSchedule, ServiceProvider, Tenant, TenantAllocation, TenantRecovery, Unit,
} from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any -- rows come from untyped PostgREST responses */

export interface Catalog { properties: Property[]; units: Unit[]; tenants: Tenant[]; leases: Lease[]; providers: ServiceProvider[] }
export interface Loaded { catalog: Catalog; state: AppState }

const CATEGORIES: BillCategory[] = ["hydro", "gas", "water", "internet", "insurance", "property_tax", "maintenance", "other"];
const asCategory = (v: unknown): BillCategory => (CATEGORIES.includes(v as BillCategory) ? (v as BillCategory) : "other");
const num = (v: unknown) => Number(v ?? 0);
const opt = <T,>(v: T | null | undefined) => (v === null || v === undefined ? undefined : v);

/** bill number (BILL-00001) -> row id, rebuilt on every load */
const billRow = new Map<string, string>();

const needOrg = () => {
  const org = getActiveOrgId();
  if (!org) throw new Error("Select an organization first.");
  return org;
};
function friendly(error: { code?: string; message?: string }, fallback: string): Error {
  if (error.code === "23505") return new Error("A bill with this provider invoice number already exists.");
  if (["42501", "23514", "23503"].includes(error.code ?? "")) return new Error(error.message || fallback);
  return toError(error, fallback);
}
const check = (res: { error: any }, fallback: string) => { if (res.error) throw friendly(res.error, fallback); };
const rowOf = (number: string) => {
  const id = billRow.get(number);
  if (!id) throw new Error("That bill could not be found. Refresh the page and try again.");
  return id;
};

// ------------------------------------------------------------------ load
export async function loadAll(orgId: string): Promise<Loaded> {
  const [properties, units, tenants, leases, parties, partyUnits, leaseUnits, vendors, bills, billUnits, allocations, payments, recoveries, schedules, scheduleTenants] = await Promise.all([
    fetchAll("properties", "id, name, address_line1, city, state_province, property_type", orgId, "name"),
    fetchAll("units", "id, property_id, unit_number, bedrooms, unit_status", orgId, "unit_number"),
    fetchAll("tenants", "id, first_name, last_name, email, phone", orgId, "last_name"),
    fetchAll("leases", "id, lease_number, start_date, end_date, agreed_monthly_rent, utilities", orgId, "lease_number"),
    fetchAll("lease_parties", "id, lease_id, tenant_id, role, relationship_end_date", orgId, "id"),
    fetchAll("lease_party_units", "lease_party_id, unit_id", orgId, "unit_id"),
    fetchAll("lease_units", "lease_id, unit_id", orgId, "lease_id"),
    fetchAll("vendors", "id, company_name, email, phone, website, trade, categories, vendor_type", orgId, "company_name"),
    fetchAll("bills", "*", orgId, "due_date"),
    fetchAll("bill_units", "bill_id, unit_id", orgId, "bill_id"),
    fetchAll("bill_tenant_allocations", "*", orgId, "bill_id"),
    fetchAll("bill_payments", "*", orgId, "paid_on"),
    fetchAll("bill_tenant_recoveries", "*", orgId, "received_on"),
    fetchAll("bill_schedules", "*", orgId, "next_expected_date"),
    fetchAll("bill_schedule_tenants", "schedule_id, tenant_id", orgId, "schedule_id"),
  ]);

  const unitCount = new Map<string, number>();
  for (const u of units) unitCount.set(u.property_id, (unitCount.get(u.property_id) ?? 0) + 1);
  const occupiedUnits = new Set<string>();
  const unitOfTenant = new Map<string, string>();
  const leaseOfTenant = new Map<string, string>();
  const firstUnitOfLease = new Map<string, string>();
  for (const lu of leaseUnits) if (!firstUnitOfLease.has(lu.lease_id)) firstUnitOfLease.set(lu.lease_id, lu.unit_id);
  const activeParties = parties.filter((p: any) => !p.relationship_end_date);
  for (const p of activeParties) {
    const pu = partyUnits.find((x: any) => x.lease_party_id === p.id)?.unit_id ?? firstUnitOfLease.get(p.lease_id);
    if (pu && !unitOfTenant.has(p.tenant_id)) { unitOfTenant.set(p.tenant_id, pu); leaseOfTenant.set(p.tenant_id, p.lease_id); occupiedUnits.add(pu); }
  }
  const leaseNumber = new Map(leases.map((l: any) => [l.id, l.lease_number]));
  const mainTenant = (leaseId: string) => (activeParties.find((p: any) => p.lease_id === leaseId && p.role === "main_tenant") ?? activeParties.find((p: any) => p.lease_id === leaseId))?.tenant_id ?? "";

  const catalog: Catalog = {
    properties: properties.map((p: any): Property => ({
      id: p.id, name: p.name, address: p.address_line1, city: [p.city, p.state_province].filter(Boolean).join(", "), type: String(p.property_type).replace(/_/g, " "), units: unitCount.get(p.id) ?? 0,
    })),
    units: units.map((u: any): Unit => ({ id: u.id, propertyId: u.property_id, name: u.unit_number, beds: num(u.bedrooms), status: occupiedUnits.has(u.id) || u.unit_status === "occupied" ? "occupied" : "vacant" })),
    tenants: tenants.map((t: any): Tenant => ({
      id: t.id, name: `${t.first_name} ${t.last_name ?? ""}`.trim(), email: t.email ?? "", phone: t.phone ?? "", unitId: unitOfTenant.get(t.id) ?? "", leaseId: leaseOfTenant.get(t.id) ?? "",
    })),
    leases: leases.map((l: any): Lease => ({
      id: l.id, tenantId: mainTenant(l.id), unitId: firstUnitOfLease.get(l.id) ?? "", startDate: l.start_date, endDate: l.end_date ?? l.start_date, rent: num(l.agreed_monthly_rent), utilityClause: l.utilities ?? "",
    })),
    providers: vendors.filter((v: any) => v.vendor_type === "service_provider").map((v: any): ServiceProvider => ({
      id: v.id, name: v.company_name, category: asCategory(v.trade ?? v.categories?.[0]), email: v.email ?? "", phone: v.phone ?? "", website: opt(v.website),
    })),
  };
  void leaseNumber;

  billRow.clear();
  const unitsBy = new Map<string, string[]>();
  for (const bu of billUnits) unitsBy.set(bu.bill_id, [...(unitsBy.get(bu.bill_id) ?? []), bu.unit_id]);
  const allocBy = new Map<string, TenantAllocation[]>();
  for (const a of allocations) {
    allocBy.set(a.bill_id, [...(allocBy.get(a.bill_id) ?? []), {
      id: a.id, tenantId: a.tenant_id, unitId: a.unit_id ?? "", method: a.method, percentage: opt(a.percentage === null ? null : num(a.percentage)), fixedAmount: opt(a.fixed_amount === null ? null : num(a.fixed_amount)),
      manualAmount: opt(a.manual_amount === null ? null : num(a.manual_amount)), calculationBasis: a.calculation_basis, notes: opt(a.notes),
    }]);
  }
  const liveBills = bills.filter((b: any) => b.status !== "cancelled");
  const numberOf = new Map<string, string>();
  for (const b of liveBills) { const n = b.bill_number ?? b.id; numberOf.set(b.id, n); billRow.set(n, b.id); }

  const files = await listDocuments(orgId, ["bill"]).catch(() => []);
  const documentsOf = (billId: string) => files.filter((f) => f.entityId === billId).map((f) => ({
    id: f.id, billId: numberOf.get(billId)!, name: f.name, type: DOC_TYPE_FROM_LABEL[f.category] ?? "other", mockFileName: `${f.name} (${fileSize(f.sizeBytes)})`, addedAt: f.uploadedAt.slice(0, 10), bucket: f.bucket, path: f.path,
  }));

  const state: AppState = {
    bills: liveBills.map((b: any): Bill => ({
      id: numberOf.get(b.id)!, name: b.name, category: asCategory(b.category), providerId: b.vendor_id, propertyId: b.property_id, unitIds: unitsBy.get(b.id) ?? [], invoiceNumber: opt(b.invoice_number),
      accountNumber: opt(b.account_number), billingPeriodStart: b.billing_period_start, billingPeriodEnd: b.billing_period_end, invoiceDate: b.invoice_date, dueDate: b.due_date, amount: num(b.amount),
      notes: opt(b.notes), scheduleId: opt(b.schedule_id), allocations: allocBy.get(b.id) ?? [], documents: documentsOf(b.id), reminderDays: b.reminder_days ?? [],
    })),
    payments: payments.filter((p: any) => numberOf.has(p.bill_id)).map((p: any): ProviderPayment => ({
      id: p.id, billId: numberOf.get(p.bill_id)!, amount: num(p.amount), date: p.paid_on, method: p.method, referenceNumber: opt(p.reference_number), notes: opt(p.notes),
    })),
    recoveries: recoveries.filter((r: any) => numberOf.has(r.bill_id)).map((r: any): TenantRecovery => ({
      id: r.id, billId: numberOf.get(r.bill_id)!, tenantId: r.tenant_id, amount: num(r.amount), date: r.received_on, method: r.method, referenceNumber: opt(r.reference_number), notes: opt(r.notes),
    })),
    schedules: schedules.map((s: any): RecurringSchedule => ({
      id: s.id, name: s.name, category: asCategory(s.bill_type), providerId: s.vendor_id ?? "", propertyId: s.property_id, unitId: opt(s.unit_id), accountNumber: opt(s.account_number),
      frequency: String(s.frequency).replace(/_/g, "-") as RecurringSchedule["frequency"], customFrequencyNote: opt(s.custom_frequency_note), expectedAmount: opt(s.expected_amount === null ? null : num(s.expected_amount)),
      nextExpectedDate: s.next_expected_date ?? s.start_date, dueDateRule: s.due_date_rule ?? "", responsibleParty: s.responsible_party, allocationMethod: s.allocation_method,
      allocationPercentage: opt(s.allocation_percentage === null ? null : num(s.allocation_percentage)), allocationFixedAmount: opt(s.allocation_fixed_amount === null ? null : num(s.allocation_fixed_amount)),
      allocationTenantIds: scheduleTenants.filter((t: any) => t.schedule_id === s.id).map((t: any) => t.tenant_id), notes: opt(s.notes), status: s.status, reminderDays: s.reminder_days ?? [],
    })),
  };
  return { catalog, state };
}

// ------------------------------------------------------------------ writes: bills
const billFields = (b: Partial<Bill>) => {
  const r: Record<string, unknown> = {};
  if (b.name !== undefined) r.name = b.name;
  if (b.category !== undefined) r.category = b.category;
  if (b.providerId !== undefined) r.vendor_id = b.providerId;
  if (b.propertyId !== undefined) r.property_id = b.propertyId;
  if (b.invoiceNumber !== undefined) r.invoice_number = b.invoiceNumber || null;
  if (b.accountNumber !== undefined) r.account_number = b.accountNumber || null;
  if (b.billingPeriodStart !== undefined) r.billing_period_start = b.billingPeriodStart;
  if (b.billingPeriodEnd !== undefined) r.billing_period_end = b.billingPeriodEnd;
  if (b.invoiceDate !== undefined) r.invoice_date = b.invoiceDate;
  if (b.dueDate !== undefined) r.due_date = b.dueDate;
  if (b.amount !== undefined) r.amount = b.amount;
  if (b.notes !== undefined) r.notes = b.notes || null;
  if (b.scheduleId !== undefined) r.schedule_id = b.scheduleId || null;
  if (b.reminderDays !== undefined) r.reminder_days = b.reminderDays;
  return r;
};

const allocationRows = (orgId: string, billId: string, rows: TenantAllocation[]) =>
  rows.map((a) => ({
    organization_id: orgId, bill_id: billId, tenant_id: a.tenantId, unit_id: a.unitId || null, method: a.method, percentage: a.percentage ?? null,
    fixed_amount: a.fixedAmount ?? null, manual_amount: a.manualAmount ?? null, calculation_basis: a.calculationBasis, notes: a.notes ?? null,
  }));

const DOC_TYPE_LABEL: Record<string, string> = { invoice: "Invoice", receipt: "Receipt", proof_of_payment: "Proof of payment", other: "Other" };
const DOC_TYPE_FROM_LABEL: Record<string, "invoice" | "receipt" | "proof_of_payment" | "other"> = { Invoice: "invoice", Receipt: "receipt", "Proof of payment": "proof_of_payment", Other: "other" };

/** Stores a file against a bill (invoice, receipt, proof of payment ...). */
export async function uploadBillDocument(number: string, file: File, type: "invoice" | "receipt" | "proof_of_payment" | "other"): Promise<void> {
  const id = rowOf(number);
  await uploadDocument({ bucket: "finance-documents", area: "bills", file, entityType: "bill", entityId: id, entityLabel: number, category: DOC_TYPE_LABEL[type], originModule: "Expenses & Bills" });
}

export async function createBill(bill: Omit<Bill, "id" | "documents">): Promise<string> {
  const orgId = needOrg();
  const { data: auth } = await supabase.auth.getUser();
  const res = await supabase.from("bills").insert({ ...billFields(bill), organization_id: orgId, status: "open", created_by: auth.user?.id ?? null }).select("id, bill_number").single();
  check(res, "Unable to save the bill.");
  const { id, bill_number } = res.data as any;
  try {
    if (bill.unitIds.length) check(await supabase.from("bill_units").insert(bill.unitIds.map((unit_id) => ({ organization_id: orgId, bill_id: id, unit_id }))), "Unable to save the bill's units.");
    if (bill.allocations.length) check(await supabase.from("bill_tenant_allocations").insert(allocationRows(orgId, id, bill.allocations)), "Unable to save the tenant allocations.");
  } catch (error) {
    await supabase.from("bills").delete().eq("id", id); // do not leave a half-saved bill behind
    throw error;
  }
  return bill_number;
}

export async function updateBill(number: string, patch: Partial<Bill>): Promise<void> {
  const orgId = needOrg();
  const id = rowOf(number);
  const fields = billFields(patch);
  if (Object.keys(fields).length) {
    const res = await supabase.from("bills").update(fields).eq("id", id).select("id");
    check(res, "Unable to save the bill.");
    if (!res.data?.length) throw new Error("You don't have permission to edit bills.");
  }
  if (patch.unitIds) {
    check(await supabase.from("bill_units").delete().eq("bill_id", id), "Unable to save the bill's units.");
    if (patch.unitIds.length) check(await supabase.from("bill_units").insert(patch.unitIds.map((unit_id) => ({ organization_id: orgId, bill_id: id, unit_id }))), "Unable to save the bill's units.");
  }
  if (patch.allocations) await replaceAllocations(number, patch.allocations);
}

export async function replaceAllocations(number: string, rows: TenantAllocation[]): Promise<void> {
  const orgId = needOrg();
  const id = rowOf(number);
  check(await supabase.from("bill_tenant_allocations").delete().eq("bill_id", id), "Unable to save the tenant allocations.");
  if (rows.length) check(await supabase.from("bill_tenant_allocations").insert(allocationRows(orgId, id, rows)), "Unable to save the tenant allocations.");
}

/** A bill with payments cannot be deleted without losing the books, so deleting cancels it: it leaves the list but stays on record. */
export async function cancelBill(number: string): Promise<void> {
  const id = rowOf(number);
  const res = await supabase.from("bills").update({ status: "cancelled" }).eq("id", id).select("id");
  check(res, "Unable to delete the bill.");
  if (!res.data?.length) throw new Error("You don't have permission to delete bills.");
}

export async function addPayment(p: Omit<ProviderPayment, "id">): Promise<void> {
  const orgId = needOrg();
  const { data: auth } = await supabase.auth.getUser();
  check(await supabase.from("bill_payments").insert({
    organization_id: orgId, bill_id: rowOf(p.billId), amount: p.amount, paid_on: p.date, method: p.method, reference_number: p.referenceNumber || null,
    notes: p.notes || null, recorded_by: auth.user?.id ?? null,
  }), "Unable to record the payment.");
}

export async function addRecovery(r: Omit<TenantRecovery, "id">): Promise<void> {
  const orgId = needOrg();
  check(await supabase.from("bill_tenant_recoveries").insert({
    organization_id: orgId, bill_id: rowOf(r.billId), tenant_id: r.tenantId, amount: r.amount, received_on: r.date, method: r.method,
    reference_number: r.referenceNumber || null, notes: r.notes || null,
  }), "Unable to record the recovery.");
}

// ------------------------------------------------------------------ writes: schedules and providers
const scheduleFields = (s: Partial<RecurringSchedule>) => {
  const r: Record<string, unknown> = {};
  if (s.name !== undefined) r.name = s.name;
  if (s.category !== undefined) r.bill_type = s.category;
  if (s.providerId !== undefined) r.vendor_id = s.providerId || null;
  if (s.propertyId !== undefined) r.property_id = s.propertyId;
  if (s.unitId !== undefined) r.unit_id = s.unitId || null;
  if (s.accountNumber !== undefined) r.account_number = s.accountNumber || null;
  if (s.frequency !== undefined) r.frequency = s.frequency.replace(/-/g, "_");
  if (s.customFrequencyNote !== undefined) r.custom_frequency_note = s.customFrequencyNote || null;
  if (s.expectedAmount !== undefined) r.expected_amount = s.expectedAmount ?? null;
  if (s.nextExpectedDate !== undefined) r.next_expected_date = s.nextExpectedDate;
  if (s.dueDateRule !== undefined) r.due_date_rule = s.dueDateRule || null;
  if (s.responsibleParty !== undefined) r.responsible_party = s.responsibleParty;
  if (s.allocationMethod !== undefined) r.allocation_method = s.allocationMethod;
  if (s.allocationPercentage !== undefined) r.allocation_percentage = s.allocationPercentage ?? null;
  if (s.allocationFixedAmount !== undefined) r.allocation_fixed_amount = s.allocationFixedAmount ?? null;
  if (s.reminderDays !== undefined) r.reminder_days = s.reminderDays;
  if (s.notes !== undefined) r.notes = s.notes || null;
  if (s.status !== undefined) r.status = s.status;
  return r;
};

async function replaceScheduleTenants(orgId: string, scheduleId: string, tenantIds: string[]) {
  check(await supabase.from("bill_schedule_tenants").delete().eq("schedule_id", scheduleId), "Unable to save the schedule's tenants.");
  if (tenantIds.length) check(await supabase.from("bill_schedule_tenants").insert(tenantIds.map((tenant_id) => ({ organization_id: orgId, schedule_id: scheduleId, tenant_id }))), "Unable to save the schedule's tenants.");
}

export async function createSchedule(s: Omit<RecurringSchedule, "id">): Promise<void> {
  const orgId = needOrg();
  const res = await supabase.from("bill_schedules").insert({ ...scheduleFields(s), organization_id: orgId, start_date: s.nextExpectedDate }).select("id").single();
  check(res, "Unable to save the schedule.");
  await replaceScheduleTenants(orgId, (res.data as any).id, s.allocationTenantIds);
}

export async function updateSchedule(id: string, patch: Partial<RecurringSchedule>): Promise<void> {
  const orgId = needOrg();
  const fields = scheduleFields(patch);
  if (Object.keys(fields).length) {
    const res = await supabase.from("bill_schedules").update(fields).eq("id", id).select("id");
    check(res, "Unable to save the schedule.");
    if (!res.data?.length) throw new Error("You don't have permission to edit schedules.");
  }
  if (patch.allocationTenantIds) await replaceScheduleTenants(orgId, id, patch.allocationTenantIds);
}

export async function createProvider(input: { name: string; category: BillCategory }): Promise<ServiceProvider> {
  const orgId = needOrg();
  const res = await supabase.from("vendors").insert({ organization_id: orgId, vendor_type: "service_provider", company_name: input.name.trim(), trade: input.category }).select("id, company_name, trade").single();
  check(res, "Unable to save the provider.");
  const row = res.data as any;
  return { id: row.id, name: row.company_name, category: asCategory(row.trade), email: "", phone: "" };
}
