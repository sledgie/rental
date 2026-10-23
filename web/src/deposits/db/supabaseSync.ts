// Connects the Deposits module to Supabase. The module reads and writes through an in-memory `db` (./index.ts) whose calls look like
// Drizzle's; with Supabase connected that store becomes a cache of your organization's data:
//   * ensureLoaded() fills it from the database (it replaces the demo seed);
//   * every insert / update / delete the module makes is written through to the database, in the order the module made them;
//   * postJournal (lib/deposits/accounting.ts) posts real journal entries through the create_journal_entry function.
// Read-only tables (staff, properties, units, tenants, leases, chart of accounts, rent invoices) come from the rest of the app;
// writes to them stay in the cache (the one exception is a rent invoice settled by a deposit, which records a real payment).
// Row-Level Security decides who may read or write; the database also enforces the ledger rules (append-only deposit transactions,
// balanced journal entries, no overlapping rules).
import { useSyncExternalStore } from "react";
import { supabase, toError } from "../../lib/supabase";
import { getActiveOrgId, subscribeActiveOrg } from "../../lib/activeOrg";
import { fetchAll } from "../../lib/financeData";
import { bump } from "../shim/store";
import { hydrateStore, setWriteHook, type Row, type WriteKind } from "./index";
import { setCurrentStaffId } from "../lib/session";

/* eslint-disable @typescript-eslint/no-explicit-any -- rows come from untyped PostgREST responses */

// ------------------------------------------------------------------ conversions
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuidOrNull = (v: unknown) => (typeof v === "string" && UUID.test(v) ? v : null);
const cents = (v: unknown) => Math.round(Number(v ?? 0) * 100);
const dollars = (c: unknown) => Math.round(Number(c ?? 0)) / 100;
const centsOrNull = (v: unknown) => (v === null || v === undefined ? null : cents(v));
const dollarsOrNull = (c: unknown) => (c === null || c === undefined ? null : dollars(c));
/** 'YYYY-MM-DD' from a Date or string (the module keeps calendar days as strings) */
const day = (v: unknown): string | null => (v instanceof Date ? v.toISOString().slice(0, 10) : typeof v === "string" && v ? v.slice(0, 10) : null);
/** the module stores a calendar day; the database stores a timestamp, so noon UTC keeps the day stable in every time zone */
const dayToTs = (v: unknown): string | null => {
  const d = day(v);
  return d ? `${d}T12:00:00Z` : null;
};
const tsToDay = (v: unknown): string | null => (typeof v === "string" ? v.slice(0, 10) : null);
const iso = (v: unknown): string | null => (v instanceof Date ? v.toISOString() : typeof v === "string" && v ? v : null);
const date = (v: unknown): Date | null => (typeof v === "string" ? new Date(v) : null);

const METHOD_TO_DB: Record<string, string> = { eft: "bank_transfer", etransfer: "etransfer", cheque: "cheque", cash: "cash", card: "card" };
const METHOD_FROM_DB: Record<string, string> = { bank_transfer: "eft", pre_authorized_debit: "eft", etransfer: "etransfer", cheque: "cheque", cash: "cash", card: "card", other: "eft" };
const REFUND_METHOD_TO_DB: Record<string, string> = { eft: "eft", etransfer: "etransfer", cheque: "cheque", cash: "cash", card: "other" };
const REFUND_STATUS_TO_DB: Record<string, string> = { requested: "requested", approved: "approved", rejected: "rejected", completed: "paid", failed: "cancelled", reversed: "cancelled", cancelled: "cancelled" };
const REFUND_STATUS_FROM_DB: Record<string, string> = { requested: "requested", approved: "approved", rejected: "rejected", paid: "completed", cancelled: "failed" };
const ACCOUNT_KIND: Record<string, string> = { asset: "asset", liability: "liability", equity: "equity", revenue: "income", other_income: "income" };

// ------------------------------------------------------------------ state
let loadedOrg: string | null = null;
let loading: Promise<void> | null = null;
let accountIdByCode = new Map<string, string>();
const known = { payments: new Set<string>(), refunds: new Set<string>(), transactions: new Set<string>(), journals: new Set<string>() };
let invoiceStatus = new Map<string, string>(); // rent invoice id -> status the module last saw
const depositPaymentByInvoice = new Map<string, string>(); // rent invoice id -> the payment recorded when a deposit settled it
let generation = 0;
let queue: Promise<void> = Promise.resolve();

const errorListeners = new Set<() => void>();
let lastError: string | null = null;
const setError = (message: string | null) => {
  lastError = message;
  errorListeners.forEach((l) => l());
};
/** The latest save failure (null when there is none) and a way to dismiss it. */
export function useDepositSyncError(): [string | null, () => void] {
  const error = useSyncExternalStore((cb) => { errorListeners.add(cb); return () => errorListeners.delete(cb); }, () => lastError);
  return [error, () => setError(null)];
}

const needOrg = () => {
  const org = getActiveOrgId();
  if (!org) throw new Error("Select an organization first.");
  return org;
};
const friendly = (error: { code?: string; message?: string }, fallback: string) =>
  ["42501", "23514", "23503", "23P01", "22023"].includes(error.code ?? "") ? new Error(error.message || fallback) : toError(error, fallback);
const check = (res: { error: any }, fallback: string) => { if (res.error) throw friendly(res.error, fallback); };
/** the module words its notes as a simulation; the real records should not say so */
const clean = (v: unknown) => (typeof v === "string" ? v.replace(/\s*\(simulated\)/gi, "").replace(/Simulated +/g, "") : v ?? null);
const acct = (code: unknown) => (typeof code === "string" ? accountIdByCode.get(code) ?? null : null);

// ------------------------------------------------------------------ load
const staffRole = (label: string) => (["Owner", "Administrator"].includes(label) ? "admin" : label === "Accountant" ? "controller" : label === "Property Manager" ? "property_manager" : "auditor");
const roleTitle: Record<string, string> = { admin: "Administrator", controller: "Financial controller", property_manager: "Property manager", auditor: "Auditor" };
const initialsOf = (name: string) => name.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
const PROVINCES: Record<string, string> = {
  ontario: "ON", alberta: "AB", "british columbia": "BC", quebec: "QC", manitoba: "MB", saskatchewan: "SK", "nova scotia": "NS", "new brunswick": "NB",
  "newfoundland and labrador": "NL", "prince edward island": "PE", "northwest territories": "NT", yukon: "YT", nunavut: "NU",
};
const jurisdictionOf = (province: string | null) => {
  const p = (province ?? "").trim();
  return PROVINCES[p.toLowerCase()] ?? p.toUpperCase();
};

async function loadFromDb(orgId: string): Promise<void> {
  const q = (table: string, columns = "*") => supabase.from(table).select(columns).eq("organization_id", orgId);
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id ?? "";
  const [members, properties, units, tenants, leases, parties, leaseUnits, accounts, invoices, payments, rules, rates, deposits, txns, refunds, devices, settings, events] = await Promise.all([
    fetchAll("organization_members", "user_id, role", orgId, "user_id"),
    fetchAll("properties", "id, name, address_line1, city, state_province, country", orgId, "name"),
    fetchAll("units", "id, property_id, unit_number, bedrooms, advertised_rent, market_rent, unit_status", orgId, "unit_number"),
    fetchAll("tenants", "id, first_name, last_name, email, phone", orgId, "last_name"),
    fetchAll("leases", "id, lease_number, lease_type, start_date, end_date, agreed_monthly_rent, status, notes", orgId, "lease_number"),
    fetchAll("lease_parties", "lease_id, tenant_id, role, relationship_end_date", orgId, "lease_id"),
    fetchAll("lease_units", "lease_id, unit_id", orgId, "lease_id"),
    fetchAll("accounts", "id, code, name, account_type, classification, status, role", orgId, "code"),
    fetchAll("v_invoice_balances", "invoice_id, invoice_number, tenant_id, lease_id, invoice_type, status, issue_date, due_date, total, derived_status", orgId, "invoice_id"),
    fetchAll("payments", "*", orgId, "created_at"),
    supabase.from("deposit_rules").select("*").or(`organization_id.is.null,organization_id.eq.${orgId}`),
    supabase.from("deposit_interest_rates").select("*").or(`organization_id.is.null,organization_id.eq.${orgId}`),
    fetchAll("deposits", "*", orgId, "created_at"),
    fetchAll("deposit_transactions", "*", orgId, "occurred_at"),
    fetchAll("deposit_refunds", "*", orgId, "requested_at"),
    fetchAll("deposit_key_devices", "*", orgId, "deposit_id"),
    supabase.from("organization_settings").select("value").eq("organization_id", orgId).eq("category", "deposits").maybeSingle(),
    supabase.from("activity_events").select("id, actor_id, occurred_at, description, reason, entity_id, related_record_label, metadata").eq("organization_id", orgId).eq("action", "deposit.audit").order("occurred_at", { ascending: false }).limit(2000),
  ]);
  if (rules.error) throw toError(rules.error, "Unable to load deposit rules.");
  if (rates.error) throw toError(rates.error, "Unable to load deposit interest rates.");

  // profiles are not organization-scoped: ask for the members' own
  const memberIds = members.map((m: any) => m.user_id);
  const profiles = memberIds.length ? (await supabase.from("profiles").select("id, full_name, email").in("id", memberIds)).data ?? [] : [];
  accountIdByCode = new Map(accounts.map((a: any) => [a.code, a.id]));
  const codeById = new Map(accounts.map((a: any) => [a.id, a.code]));
  const profileById = new Map((profiles as any[]).map((p) => [p.id, p]));

  const depositJournalIds = new Set(txns.map((t: any) => t.journal_entry_id).filter(Boolean));
  // only the accounting entries that deposit transactions point at (not the whole journal), a hundred at a time
  const entryIds = [...depositJournalIds] as string[];
  const entries: any[] = [];
  const lines: any[] = [];
  for (let i = 0; i < entryIds.length; i += 100) {
    const chunk = entryIds.slice(i, i + 100);
    const [e, l] = await Promise.all([
      supabase.from("journal_entries").select("id, entry_date, memo, status, created_at").in("id", chunk),
      supabase.from("journal_entry_lines").select("id, entry_id, account_id, debit, credit, memo, line_number").in("entry_id", chunk),
    ]);
    if (e.error) throw toError(e.error, "Unable to load the deposit accounting entries.");
    if (l.error) throw toError(l.error, "Unable to load the deposit accounting entries.");
    entries.push(...(e.data ?? []));
    lines.push(...(l.data ?? []));
  }

  const store: Record<string, Row[]> = {};
  store.appMeta = [{ key: "seed_version", value: "supabase" }];
  const mapping = (settings.data as any)?.value?.accountMapping;
  if (mapping) store.appMeta.push({ key: "deposit_account_mappings", value: JSON.stringify(mapping) });

  store.staff = members.map((m: any) => {
    const p: any = profileById.get(m.user_id);
    const name = p?.full_name || p?.email || "Team member";
    const label = m.role === "owner" ? "Owner" : m.role === "administrator" ? "Administrator" : m.role === "accountant" ? "Accountant" : m.role === "property_manager" ? "Property Manager" : "Other";
    const role = staffRole(label);
    return { id: m.user_id, name, role, title: roleTitle[role], initials: initialsOf(name), email: p?.email ?? "" };
  });
  store.properties = properties.map((p: any) => ({ id: p.id, name: p.name, building: "", addressLine: p.address_line1, city: p.city, province: p.state_province ?? "", jurisdiction: jurisdictionOf(p.state_province), unitsCount: units.filter((u: any) => u.property_id === p.id).length }));
  const rentOf = (u: any) => cents(u.advertised_rent ?? u.market_rent ?? 0);
  store.units = units.map((u: any) => ({ id: u.id, propertyId: u.property_id, label: u.unit_number, bedrooms: u.bedrooms === null ? "Unit" : `${Number(u.bedrooms)} bed`, monthlyRentCents: rentOf(u), status: u.unit_status === "occupied" ? "occupied" : "vacant" }));
  store.tenants = tenants.map((t: any) => ({ id: t.id, name: `${t.first_name} ${t.last_name ?? ""}`.trim(), email: t.email ?? "", phone: t.phone ?? "" }));
  const propertyOfUnit = new Map(units.map((u: any) => [u.id, u.property_id]));
  const propertyById = new Map(properties.map((p: any) => [p.id, p]));
  store.leases = leases.map((l: any) => {
    const main = parties.find((p: any) => p.lease_id === l.id && p.role === "main_tenant" && !p.relationship_end_date) ?? parties.find((p: any) => p.lease_id === l.id);
    const unitId = leaseUnits.find((x: any) => x.lease_id === l.id)?.unit_id ?? "";
    const propertyId = (propertyOfUnit.get(unitId) as string) ?? "";
    const today = new Date().toISOString().slice(0, 10);
    return {
      id: l.id, reference: l.lease_number ?? l.id, tenantId: main?.tenant_id ?? "", propertyId, unitId,
      leaseType: String(l.lease_type ?? "").toLowerCase().includes("commercial") ? "commercial" : "residential",
      jurisdiction: jurisdictionOf((propertyById.get(propertyId) as any)?.state_province ?? null), startDate: l.start_date, endDate: l.end_date ?? l.start_date,
      monthlyRentCents: cents(l.agreed_monthly_rent), status: l.status === "terminated" || l.status === "expired" || (l.end_date && l.end_date < today && l.status !== "active") ? "ended" : "active", notes: l.notes ?? "",
    };
  });
  store.chartOfAccounts = accounts.map((a: any) => ({ code: a.code, name: a.name, type: ACCOUNT_KIND[a.account_type] ?? "expense", subtype: a.classification ?? "", isActive: a.status === "active" }));

  // payments: deposit receipts are marked in their notes; a payment recorded when a deposit settled an invoice carries the invoice id
  depositPaymentByInvoice.clear();
  const markerOf = (n: string | null) => /^\[deposit-applied:([^\]]+)\]/.exec(n ?? "")?.[1];
  for (const p of payments) {
    const invoiceId = markerOf(p.notes);
    if (invoiceId && p.status === "posted") depositPaymentByInvoice.set(invoiceId, p.id);
  }
  store.payments = payments.map((p: any) => ({
    id: p.id, reference: p.payment_number ?? p.id, tenantId: p.tenant_id, leaseId: p.lease_id ?? "", type: (p.notes ?? "").startsWith("[deposit]") ? "deposit" : "rent", direction: "in",
    amountCents: cents(p.amount), method: METHOD_FROM_DB[p.method] ?? "eft", receivedAt: p.payment_date, referenceNote: p.reference ?? null, status: p.status === "posted" ? "cleared" : "reversed",
    simulated: false, createdBy: p.recorded_by ?? "", notes: (p.notes ?? "").replace(/^\[deposit(-applied:[^\]]*)?\]\s*/, ""),
  }));
  known.payments = new Set(payments.map((p: any) => p.id));

  invoiceStatus = new Map();
  store.rentInvoices = invoices.filter((i: any) => i.invoice_type === "rent" && i.status === "open" && i.lease_id).map((i: any) => {
    const settledByDeposit = depositPaymentByInvoice.has(i.invoice_id);
    const status = i.derived_status === "paid" ? (settledByDeposit ? "settled_by_deposit" : "settled") : "open";
    invoiceStatus.set(i.invoice_id, status);
    const start = i.issue_date;
    return {
      id: i.invoice_id, reference: i.invoice_number ?? i.invoice_id, leaseId: i.lease_id, tenantId: i.tenant_id, periodLabel: String(start).slice(0, 7), periodStart: start,
      periodEnd: i.due_date, amountCents: cents(i.total), dueDate: i.due_date, status, settlementRef: settledByDeposit ? "Settled by deposit" : null,
    };
  });

  store.depositRules = (rules.data ?? []).map((r: any) => ({
    id: r.id, jurisdiction: r.jurisdiction, leaseType: r.lease_type, depositType: r.deposit_type, collectionPermitted: r.collection_permitted, maxAmountCents: centsOrNull(r.max_amount),
    maxMultipleOfRentBps: r.max_multiple_of_rent_bps, calculationMethod: r.calculation_method, refundConditions: r.refund_conditions, interestApplicable: r.interest_applicable,
    interestMethod: r.interest_method, interestFrequency: r.interest_frequency, applicationPurposes: r.application_purposes ?? [], requiredDocuments: r.required_documents ?? [],
    approvalRequired: r.approval_required, refundApprovalRequired: r.refund_approval_required, roundingMode: r.rounding_mode, effectiveFrom: r.effective_from, effectiveTo: r.effective_to,
    validationMessage: r.validation_message, legalReference: r.legal_reference, notes: r.notes, configuredBy: r.configured_by, configuredAt: date(r.configured_at) ?? new Date(),
  }));
  store.depositInterestRates = (rates.data ?? []).map((r: any) => ({
    id: r.id, jurisdiction: r.jurisdiction, leaseType: r.lease_type, depositType: r.deposit_type, annualRateBps: r.annual_rate_bps, effectiveFrom: r.effective_from, effectiveTo: r.effective_to, source: r.source, notes: r.notes,
  }));
  store.deposits = deposits.map((d: any) => ({
    id: d.id, reference: d.reference ?? d.id, tenantId: d.tenant_id, leaseId: d.lease_id, propertyId: d.property_id, unitId: d.unit_id, depositType: d.deposit_type, jurisdiction: d.jurisdiction, leaseType: d.lease_type,
    status: d.status, requiredAmountCents: cents(d.required_amount), expectedDate: d.expected_date, firstReceivedDate: d.first_received_date, interestApplicable: d.interest_applicable,
    liabilityAccountCode: codeById.get(d.liability_account_id) ?? null, cashAccountCode: codeById.get(d.cash_account_id) ?? null, receivableAccountCode: codeById.get(d.receivable_account_id) ?? null,
    interestPayableAccountCode: codeById.get(d.interest_payable_account_id) ?? null, responsibleUserId: d.responsible_user_id, notes: d.notes, documents: [], ruleSnapshot: d.rule_snapshot ?? {},
    reconciliationStatus: d.reconciliation_status, lastReconciledAt: date(d.last_reconciled_at), closedAt: tsToDay(d.closed_at), cancelledAt: tsToDay(d.cancelled_at), cancellationReason: d.cancellation_reason,
    transferRef: d.transfer_ref, createdBy: d.created_by, source: "app", createdAt: date(d.created_at) ?? new Date(), updatedAt: date(d.updated_at) ?? new Date(),
  }));
  store.depositTransactions = txns.map((t: any) => ({
    id: t.id, reference: t.reference ?? t.id, depositId: t.deposit_id, txnType: t.txn_type, classification: t.classification, signedAmountCents: cents(t.signed_amount), occurredAt: tsToDay(t.occurred_at),
    paymentId: t.payment_id, invoiceId: t.invoice_id, refundId: t.refund_id, journalEntryId: t.journal_entry_id, userId: t.user_id, notes: t.notes, documentRef: t.document_ref, purpose: t.purpose,
    approvalRef: t.approval_ref, relatedTxnId: t.related_txn_id, reversalOfTxnId: t.reversal_of_txn_id, periodStart: t.period_start, periodEnd: t.period_end, rateBps: t.rate_bps, status: t.status,
    source: "app", createdAt: date(t.created_at) ?? new Date(),
  }));
  known.transactions = new Set(txns.map((t: any) => t.id));
  store.depositRefunds = refunds.map((r: any) => ({
    id: r.id, reference: r.reference ?? r.id, depositId: r.deposit_id, requestedAt: tsToDay(r.requested_at), requestedPrincipalCents: cents(r.requested_principal), requestedInterestCents: cents(r.requested_interest),
    approvedPrincipalCents: centsOrNull(r.approved_principal), approvedInterestCents: centsOrNull(r.approved_interest), method: r.method ?? "eft", status: REFUND_STATUS_FROM_DB[r.status] ?? r.status,
    dueDate: r.due_date, approvalStatus: r.approval_status, requestedBy: r.requested_by, approvedBy: r.approved_by, approvedAt: date(r.approved_at), rejectionReason: r.rejection_reason, paymentId: r.payment_id,
    completedAt: date(r.completed_at), notes: r.notes, documentRef: null, source: "app", createdAt: date(r.created_at) ?? new Date(),
  }));
  known.refunds = new Set(refunds.map((r: any) => r.id));
  store.keyDevices = devices.map((k: any) => ({
    id: k.id, depositId: k.deposit_id, deviceType: k.device_type, identifier: k.identifier, quantityIssued: k.quantity_issued, quantityReturned: k.quantity_returned,
    replacementCostCents: centsOrNull(k.replacement_cost), returnDate: k.return_date, returnCondition: k.return_condition, notes: k.notes,
  }));
  store.reconciliationItems = [];

  store.journalEntries = entries.map((e: any) => ({
    id: e.id, reference: e.id, entryDate: e.entry_date, description: e.memo ?? "", sourceType: "deposit", sourceId: e.id, status: e.status, simulated: false, createdBy: "", createdAt: date(e.created_at) ?? new Date(),
  }));
  known.journals = new Set(entries.map((e: any) => e.id));
  store.journalLines = lines.map((l: any) => ({
    id: l.id, entryId: l.entry_id, accountCode: codeById.get(l.account_id) ?? "", debitCents: cents(l.debit), creditCents: cents(l.credit), memo: l.memo, depositId: null,
  }));
  store.auditLog = (events.data ?? []).map((e: any) => ({
    id: e.id, entityType: e.metadata?.entityType ?? "deposit", entityId: e.entity_id, action: e.related_record_label || e.description, userId: e.metadata?.userId ?? e.actor_id, previousValue: e.metadata?.previousValue ?? null,
    newValue: e.metadata?.newValue ?? null, reason: e.reason, approvalRef: e.metadata?.approvalRef ?? null, relatedRef: e.metadata?.relatedRef ?? null, createdAt: date(e.occurred_at) ?? new Date(),
  }));

  hydrateStore(store);
  setCurrentStaffId(store.staff.some((s) => s.id === userId) ? userId : "");
}

/** Loads the active organization's data into the module's store (once per organization); replaces the demo seed. */
export function ensureLoaded(): Promise<void> {
  const org = getActiveOrgId();
  if (!org) return Promise.resolve();
  if (loadedOrg === org) return Promise.resolve();
  if (loading) return loading;
  const gen = ++generation;
  loading = loadFromDb(org)
    .then(() => {
      if (gen === generation) loadedOrg = org;
    })
    .catch((error) => {
      setError(error instanceof Error ? error.message : "Unable to load deposits.");
      throw error;
    })
    .finally(() => {
      loading = null;
      bump();
    });
  return loading;
}

async function reloadNow() {
  loadedOrg = null;
  generation += 1;
  try {
    await ensureLoaded();
  } catch {
    /* the error is already shown */
  }
}

subscribeActiveOrg(() => {
  loadedOrg = null;
  generation += 1;
  bump();
});

// ------------------------------------------------------------------ write-through
type AnyRow = Record<string, any>;

const depositRow = (r: AnyRow) => ({
  reference: r.reference, tenant_id: r.tenantId, lease_id: r.leaseId, property_id: uuidOrNull(r.propertyId), unit_id: uuidOrNull(r.unitId), deposit_type: r.depositType,
  jurisdiction: r.jurisdiction ?? null, lease_type: r.leaseType ?? null, status: r.status, required_amount: dollars(r.requiredAmountCents), expected_date: day(r.expectedDate),
  first_received_date: day(r.firstReceivedDate), interest_applicable: !!r.interestApplicable, liability_account_id: acct(r.liabilityAccountCode), cash_account_id: acct(r.cashAccountCode),
  receivable_account_id: acct(r.receivableAccountCode), interest_payable_account_id: acct(r.interestPayableAccountCode), responsible_user_id: uuidOrNull(r.responsibleUserId), notes: r.notes ?? null,
  rule_snapshot: r.ruleSnapshot ?? {}, reconciliation_status: r.reconciliationStatus ?? "not_reviewed", last_reconciled_at: iso(r.lastReconciledAt), closed_at: dayToTs(r.closedAt),
  cancelled_at: dayToTs(r.cancelledAt), cancellation_reason: r.cancellationReason ?? null, transfer_ref: r.transferRef ?? null, created_by: uuidOrNull(r.createdBy),
});
const txnRow = (r: AnyRow) => ({
  reference: r.reference, deposit_id: r.depositId, txn_type: r.txnType, classification: r.classification ?? "principal", signed_amount: dollars(r.signedAmountCents), occurred_at: dayToTs(r.occurredAt) ?? new Date().toISOString(),
  // links to rows the database does not hold (a simulated refund payment, a journal entry from another source) are dropped instead of breaking the save
  payment_id: known.payments.has(r.paymentId) ? r.paymentId : null, invoice_id: uuidOrNull(r.invoiceId), refund_id: known.refunds.has(r.refundId) ? r.refundId : null,
  journal_entry_id: known.journals.has(r.journalEntryId) ? r.journalEntryId : null, user_id: uuidOrNull(r.userId), notes: clean(r.notes), document_ref: r.documentRef ?? null, purpose: r.purpose ?? null,
  approval_ref: r.approvalRef ?? null, related_txn_id: known.transactions.has(r.relatedTxnId) ? r.relatedTxnId : null, reversal_of_txn_id: known.transactions.has(r.reversalOfTxnId) ? r.reversalOfTxnId : null,
  period_start: day(r.periodStart), period_end: day(r.periodEnd), rate_bps: r.rateBps ?? null, status: r.status ?? "posted",
});
const refundRow = (r: AnyRow) => ({
  reference: r.reference, deposit_id: r.depositId, requested_at: dayToTs(r.requestedAt) ?? new Date().toISOString(), requested_principal: dollars(r.requestedPrincipalCents), requested_interest: dollars(r.requestedInterestCents),
  approved_principal: dollarsOrNull(r.approvedPrincipalCents), approved_interest: dollarsOrNull(r.approvedInterestCents), method: REFUND_METHOD_TO_DB[r.method] ?? "other",
  status: REFUND_STATUS_TO_DB[r.status] ?? "requested", due_date: day(r.dueDate), approval_status: r.approvalStatus ?? "not_required", requested_by: uuidOrNull(r.requestedBy), approved_by: uuidOrNull(r.approvedBy),
  approved_at: iso(r.approvedAt), rejection_reason: r.rejectionReason ?? null, payment_id: known.payments.has(r.paymentId) ? r.paymentId : null, completed_at: iso(r.completedAt), notes: clean(r.notes),
});
const ruleRow = (r: AnyRow) => ({
  jurisdiction: r.jurisdiction, lease_type: r.leaseType, deposit_type: r.depositType, collection_permitted: r.collectionPermitted ?? true, max_amount: dollarsOrNull(r.maxAmountCents),
  max_multiple_of_rent_bps: r.maxMultipleOfRentBps ?? null, calculation_method: r.calculationMethod ?? null, refund_conditions: r.refundConditions ?? null, interest_applicable: !!r.interestApplicable,
  interest_method: r.interestMethod ?? null, interest_frequency: r.interestFrequency ?? null, application_purposes: r.applicationPurposes ?? [], required_documents: r.requiredDocuments ?? [],
  approval_required: !!r.approvalRequired, refund_approval_required: !!r.refundApprovalRequired, rounding_mode: r.roundingMode ?? "half_up_cent", effective_from: day(r.effectiveFrom) ?? "2000-01-01",
  effective_to: day(r.effectiveTo), validation_message: r.validationMessage ?? null, legal_reference: r.legalReference ?? null, notes: r.notes ?? null, configured_by: uuidOrNull(r.configuredBy),
});
const rateRow = (r: AnyRow) => ({
  jurisdiction: r.jurisdiction, lease_type: r.leaseType, deposit_type: r.depositType, annual_rate_bps: r.annualRateBps, effective_from: day(r.effectiveFrom), effective_to: day(r.effectiveTo), source: r.source ?? null, notes: r.notes ?? null,
});
const deviceRow = (r: AnyRow) => ({
  deposit_id: r.depositId, device_type: r.deviceType, identifier: r.identifier ?? null, quantity_issued: r.quantityIssued ?? 1, quantity_returned: r.quantityReturned ?? 0,
  replacement_cost: dollarsOrNull(r.replacementCostCents), return_date: day(r.returnDate), return_condition: r.returnCondition ?? null, notes: r.notes ?? null,
});

/** A payment row from the module. Only money received is a payment in the database; refunds paid out stay in the cache. */
async function writePayment(orgId: string, r: AnyRow) {
  if (r.direction !== "in" || Number(r.amountCents) <= 0) return;
  check(await supabase.from("payments").insert({
    id: r.id, organization_id: orgId, payment_number: r.reference, tenant_id: r.tenantId, lease_id: uuidOrNull(r.leaseId), payment_date: day(r.receivedAt), method: METHOD_TO_DB[r.method] ?? "other",
    amount: dollars(r.amountCents), reference: r.referenceNote ?? null, notes: `[deposit] ${clean(r.notes) ?? ""}`.trim(), status: "posted", recorded_by: uuidOrNull(r.createdBy),
  }), "Unable to save the deposit payment.");
  known.payments.add(r.id);
}

/** A rent invoice settled by a deposit becomes paid in the database: a payment is recorded against it (no extra journal entry; the deposit's own entry already moved the money). */
async function writeInvoice(orgId: string, r: AnyRow) {
  const before = invoiceStatus.get(r.id);
  if (before === r.status) return;
  invoiceStatus.set(r.id, r.status);
  if (r.status === "settled_by_deposit") {
    const { data } = await supabase.from("v_invoice_balances").select("outstanding, tenant_id, lease_id").eq("invoice_id", r.id).maybeSingle();
    const outstanding = Number((data as any)?.outstanding ?? 0);
    const amount = Math.min(dollars(r.amountCents), outstanding);
    if (!data || amount <= 0) return;
    const paymentId = crypto.randomUUID();
    check(await supabase.from("payments").insert({
      id: paymentId, organization_id: orgId, tenant_id: (data as any).tenant_id, lease_id: (data as any).lease_id, payment_date: new Date().toISOString().slice(0, 10), method: "other", amount,
      reference: r.settlementRef ?? "Deposit applied", notes: `[deposit-applied:${r.id}] Settled by a tenant deposit`, status: "posted",
    }), "Unable to record the deposit application.");
    check(await supabase.from("payment_allocations").insert({ organization_id: orgId, payment_id: paymentId, invoice_id: r.id, amount }), "Unable to apply the deposit to the invoice.");
    depositPaymentByInvoice.set(r.id, paymentId);
    known.payments.add(paymentId);
  } else if (before === "settled_by_deposit") {
    const paymentId = depositPaymentByInvoice.get(r.id);
    if (!paymentId) return;
    check(await supabase.from("payments").update({ status: "reversed", reversal_reason: "Deposit application reversed" }).eq("id", paymentId), "Unable to reverse the deposit application.");
    depositPaymentByInvoice.delete(r.id);
  }
}

async function persist(kind: WriteKind, table: string, rows: AnyRow[]) {
  const orgId = needOrg();
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id ?? null;
  for (const r of rows) {
    switch (table) {
      case "deposits":
        if (kind === "insert") check(await supabase.from("deposits").insert({ id: r.id, organization_id: orgId, ...depositRow(r), created_by: userId }), "Unable to save the deposit.");
        else if (kind === "update") check(await supabase.from("deposits").update(depositRow(r)).eq("id", r.id), "Unable to save the deposit.");
        break;
      case "depositTransactions":
        if (kind === "insert") { check(await supabase.from("deposit_transactions").insert({ id: r.id, organization_id: orgId, ...txnRow(r) }), "Unable to save the deposit transaction."); known.transactions.add(r.id); }
        else if (kind === "update") check(await supabase.from("deposit_transactions").update({ status: r.status }).eq("id", r.id), "Unable to update the deposit transaction.");
        break;
      case "depositRefunds":
        if (kind === "insert") { check(await supabase.from("deposit_refunds").insert({ id: r.id, organization_id: orgId, ...refundRow(r) }), "Unable to save the refund."); known.refunds.add(r.id); }
        else if (kind === "update") check(await supabase.from("deposit_refunds").update(refundRow(r)).eq("id", r.id), "Unable to save the refund.");
        break;
      case "keyDevices":
        if (kind === "insert") check(await supabase.from("deposit_key_devices").insert({ id: r.id, organization_id: orgId, ...deviceRow(r) }), "Unable to save the key or device.");
        else if (kind === "update") check(await supabase.from("deposit_key_devices").update(deviceRow(r)).eq("id", r.id), "Unable to save the key or device.");
        break;
      case "depositRules":
        if (kind === "insert") check(await supabase.from("deposit_rules").insert({ id: r.id, organization_id: orgId, ...ruleRow(r), configured_by: userId }), "Unable to save the rule.");
        else if (kind === "update") check(await supabase.from("deposit_rules").update(ruleRow(r)).eq("id", r.id), "Unable to save the rule.");
        break;
      case "depositInterestRates":
        if (kind === "insert") check(await supabase.from("deposit_interest_rates").insert({ id: r.id, organization_id: orgId, ...rateRow(r) }), "Unable to save the interest rate.");
        else if (kind === "update") check(await supabase.from("deposit_interest_rates").update(rateRow(r)).eq("id", r.id), "Unable to save the interest rate.");
        break;
      case "payments":
        if (kind === "insert") await writePayment(orgId, r);
        break;
      case "rentInvoices":
        if (kind === "update") await writeInvoice(orgId, r);
        break;
      case "appMeta":
        if (r.key === "deposit_account_mappings" && kind !== "delete") {
          const existing = await supabase.from("organization_settings").select("value").eq("organization_id", orgId).eq("category", "deposits").maybeSingle();
          check(existing, "Unable to read the deposit settings.");
          const value = { ...((existing.data as any)?.value ?? {}), accountMapping: JSON.parse(r.value) };
          check(await supabase.from("organization_settings").upsert({ organization_id: orgId, category: "deposits", value, updated_by: userId }), "Unable to save the account mappings.");
        }
        break;
      case "auditLog":
        if (kind === "insert") {
          // best-effort: a logging failure never undoes a saved change
          await supabase.rpc("record_activity", {
            p_org: orgId, p_action: "deposit.audit", p_category: "Accounting & Finance", p_description: String(r.action ?? "Deposit activity"), p_entity_type: "deposit", p_entity_id: String(r.entityId ?? ""),
            p_label: String(r.action ?? ""), p_reason: r.reason ?? null, p_source_module: "Deposits",
            p_metadata: { entityType: r.entityType, userId: r.userId, previousValue: r.previousValue ?? null, newValue: r.newValue ?? null, approvalRef: r.approvalRef ?? null, relatedRef: r.relatedRef ?? null },
          });
        }
        break;
      default:
        break; // staff, properties, units, tenants, leases, chartOfAccounts, journals and reconciliation items are not written from here
    }
  }
}

setWriteHook((kind, table, rows) => {
  if (!rows.length) return;
  const gen = generation;
  queue = queue.then(async () => {
    if (gen !== generation) return;
    try {
      await persist(kind, table, rows);
    } catch (error) {
      setError(error instanceof Error ? error.message : "The change could not be saved.");
      await reloadNow(); // show what the database really contains
    }
  });
});

// ------------------------------------------------------------------ journal entries
export type JournalPost = {
  entryDate: string;
  description: string;
  lines: { accountCode: string; debitCents?: number; creditCents?: number; memo?: string }[];
  tenantId: string | null;
  leaseId: string | null;
  propertyId: string | null;
  unitId: string | null;
};

/** Posts a balanced journal entry through the database function and returns its id. */
export async function postJournalToDb(input: JournalPost): Promise<string> {
  const orgId = needOrg();
  const lines = input.lines.map((l) => ({
    account_code: l.accountCode, debit: dollars(l.debitCents ?? 0), credit: dollars(l.creditCents ?? 0), memo: l.memo ?? null,
    tenant_id: uuidOrNull(input.tenantId), lease_id: uuidOrNull(input.leaseId), property_id: uuidOrNull(input.propertyId), unit_id: uuidOrNull(input.unitId),
  }));
  const { data, error } = await supabase.rpc("create_journal_entry", { p_org: orgId, p_date: input.entryDate, p_memo: input.description, p_lines: lines, p_post: true, p_source: "deposit" });
  if (error) throw friendly(error, "Unable to post the accounting entry.");
  known.journals.add(data as string);
  return data as string;
}
