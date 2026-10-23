// Supabase access for Banks and Bank Reconciliation. The module works on one in-memory `StoreState` that its reducer replaces after every
// action, so persistence is a diff: `persist(prev, next)` writes the rows that changed, in dependency order
// (bank accounts -> import batches / mappings -> statement and ledger lines -> reconciliations -> matches -> adjustments -> audit).
// Tables: bank_accounts, bank_import_batches, bank_import_mappings, bank_transactions, book_transactions (+ invoices), reconciliations,
// reconciliation_matches (+ bank / book line links), reconciliation_adjustments, organization_settings, activity_events.
// Row-Level Security decides who may read or write; the database also freezes a finalized reconciliation.
import { supabase, toError } from "../lib/supabase";
import { getActiveOrgId } from "../lib/activeOrg";
import { fetchAll } from "../lib/financeData";
import { loadStaff } from "../properties/add/store/refRepo";
import type {
  Adjustment, AuditEntry, BankAccount, BankTransaction, BookTransaction, CoaAccount, ColumnMapping, ConfidenceLevel, ImportBatch, ImportMapping, Match,
  MatchType, MockUser, Property, Reconciliation, ReconStatus, Settings, StoreState, Tenant, Unit, Vendor,
} from "./lib/types";

/* eslint-disable @typescript-eslint/no-explicit-any -- rows come from untyped PostgREST responses */

export const DEFAULT_SETTINGS: Settings = {
  frequency: "Monthly", dateToleranceDays: 3, autoMatching: true, confidenceHigh: 85, confidenceMedium: 60, confidenceLow: 30, duplicateSensitivity: "normal",
  currencyPrecision: 2, approvalRequired: true, reopenPermission: "admin", staleWarningDays: 30, csvHasHeader: true, csvPositiveIsDeposit: true, csvDelimiter: ",",
  notificationEmail: "",
};

// the statement formats every organization starts with (not stored; saved custom mappings are)
const SYSTEM_MAPPINGS: ImportMapping[] = [
  { id: "MAP-FNB", name: "First National Bank CSV", format: "Debit/Credit columns", columns: { transactionDate: 0, postedDate: null, description: 1, reference: 2, debit: 3, credit: 4, signedAmount: null, runningBalance: null }, signedAmountMeaning: "positive_is_deposit", createdAt: "2000-01-01T00:00:00Z", system: true },
  { id: "MAP-GEN-DC", name: "Generic Bank (Debit/Credit)", format: "Debit/Credit columns", columns: { transactionDate: 0, postedDate: 1, description: 2, reference: 3, debit: 4, credit: 5, signedAmount: null, runningBalance: 6 }, signedAmountMeaning: "positive_is_deposit", createdAt: "2000-01-01T00:00:00Z", system: true },
  { id: "MAP-GEN-SIGNED", name: "Generic Bank (Signed Amount)", format: "Single signed amount column", columns: { transactionDate: 0, postedDate: 1, description: 2, reference: 3, debit: null, credit: null, signedAmount: 4, runningBalance: 5 }, signedAmountMeaning: "positive_is_deposit", createdAt: "2000-01-01T00:00:00Z", system: true },
];

export const emptyState = (): StoreState => ({
  version: 3, users: [], currentUserId: "", accounts: [], bookTxs: [], bankTxs: [], reconciliations: [], matches: [], adjustments: [], importBatches: [],
  importMappings: [...SYSTEM_MAPPINGS], audit: [], settings: { ...DEFAULT_SETTINGS }, properties: [], units: [], tenants: [], vendors: [], coa: [], depositLedger: [],
});

// ------------------------------------------------------------------ label <-> slug maps
const cap = (v: string) => v.charAt(0).toUpperCase() + v.slice(1);
const RECON_FROM_DB: Record<string, ReconStatus> = {
  not_started: "Not Started", in_progress: "In Progress", needs_review: "Needs Review", ready_to_finalize: "Ready to Finalize", reconciled: "Reconciled", reopened: "Reopened", cancelled: "Cancelled",
};
const RECON_TO_DB = Object.fromEntries(Object.entries(RECON_FROM_DB).map(([slug, label]) => [label, slug])) as Record<ReconStatus, string>;
const CONFIDENCE_FROM_DB: Record<string, ConfidenceLevel> = { high: "High", medium: "Medium", low: "Low", none: "None" };

/** account code (1010) <-> row id, rebuilt on every load */
const coaIdByCode = new Map<string, string>();
const coaCodeById = new Map<string, string>();
const unitIdByLabel = new Map<string, string>(); // `${propertyId}|${label}` -> unit row id

const n2 = (v: unknown) => Math.round(Number(v ?? 0) * 100) / 100;
const dateOnly = (v: string | null | undefined) => (v ? v.slice(0, 10) : "");

// ------------------------------------------------------------------ load
export async function loadState(orgId: string, userId: string): Promise<StoreState> {
  const q = (table: string, columns = "*") => supabase.from(table).select(columns).eq("organization_id", orgId);
  const [accounts, bankAccounts, batches, mappings, bankTxs, bookTxs, bookInvoices, recons, matches, bankLines, bookLines, adjustments, settings, events,
    properties, units, tenants, vendors, parties, partyUnits, staff, role] = await Promise.all([
    fetchAll("accounts", "id, code, name, account_type, role, status", orgId, "code"),
    fetchAll("bank_accounts", "*", orgId, "created_at"),
    fetchAll("bank_import_batches", "*", orgId, "imported_at"),
    q("bank_import_mappings").order("created_at"),
    fetchAll("bank_transactions", "*", orgId, "tx_date"),
    fetchAll("book_transactions", "*", orgId, "tx_date"),
    fetchAll("book_transaction_invoices", "book_transaction_id, invoice_id, invoice_number, amount", orgId, "book_transaction_id"),
    fetchAll("reconciliations", "*", orgId, "created_at"),
    fetchAll("reconciliation_matches", "*", orgId, "confirmed_at"),
    fetchAll("reconciliation_match_bank_lines", "match_id, bank_transaction_id", orgId, "match_id"),
    fetchAll("reconciliation_match_book_lines", "match_id, book_transaction_id", orgId, "match_id"),
    fetchAll("reconciliation_adjustments", "*", orgId, "created_at"),
    q("organization_settings", "value").eq("category", "bank_reconciliation").maybeSingle(),
    q("activity_events", "id, occurred_at, actor_display_name, related_record_label, description, entity_id, metadata").eq("action", "bankrecon.audit").order("occurred_at", { ascending: false }).limit(1000),
    fetchAll("properties", "id, name, address_line1, city", orgId, "name"),
    fetchAll("units", "id, property_id, unit_number, advertised_rent, market_rent", orgId, "unit_number"),
    fetchAll("tenants", "id, first_name, last_name, email", orgId, "last_name"),
    fetchAll("vendors", "id, company_name, trade", orgId, "company_name"),
    fetchAll("lease_parties", "id, tenant_id, relationship_end_date", orgId, "id"),
    fetchAll("lease_party_units", "lease_party_id, unit_id", orgId, "unit_id"),
    loadStaff(orgId).catch(() => []),
    supabase.from("organization_members").select("role").eq("organization_id", orgId).eq("user_id", userId).maybeSingle(),
  ]);
  if (mappings.error) throw toError(mappings.error, "Unable to load import mappings.");

  coaIdByCode.clear(); coaCodeById.clear(); unitIdByLabel.clear();
  for (const a of accounts) { coaIdByCode.set(a.code, a.id); coaCodeById.set(a.id, a.code); }
  const coaOf = (id: string | null) => (id ? coaCodeById.get(id) ?? null : null);
  const glName = new Map(accounts.map((a: any) => [a.id, a.name]));
  const unitLabel = new Map(units.map((u: any) => [u.id, u.unit_number]));
  for (const u of units) unitIdByLabel.set(`${u.property_id}|${u.unit_number}`, u.id);
  const staffName = new Map(staff.map((s) => [s.id, s.name]));
  const invoicesByBook = new Map<string, any[]>();
  for (const i of bookInvoices) invoicesByBook.set(i.book_transaction_id, [...(invoicesByBook.get(i.book_transaction_id) ?? []), i]);

  const out = emptyState();
  const adminRoles = ["owner", "administrator"];
  const isAdmin = adminRoles.includes((role.data as any)?.role ?? "");
  const me: MockUser = {
    id: userId,
    name: staffName.get(userId) ?? "You",
    role: isAdmin ? "Accounting Admin" : "Staff Accountant",
    permissions: isAdmin
      ? ["view_bank_accounts", "create_edit_bank_accounts", "start_reconciliation", "import_statements", "match_transactions", "unmatch_transactions", "record_missing", "approve_adjustments", "finalize_reconciliation", "reopen_reconciliation", "cancel_reconciliation", "view_reports", "manage_settings"]
      : ["view_bank_accounts", "start_reconciliation", "import_statements", "match_transactions", "unmatch_transactions", "record_missing", "view_reports"],
  };
  out.users = [me];
  out.currentUserId = userId;

  out.accounts = bankAccounts.map((r: any): BankAccount => ({
    id: r.id,
    code: r.account_code ?? undefined,
    name: r.name,
    institution: r.institution ?? "",
    maskedAccount: r.last4 ? `****${r.last4}` : "",
    accountType: cap(r.account_type) as BankAccount["accountType"],
    currency: String(r.currency).trim(),
    glAccount: coaOf(r.gl_account_id) ?? "",
    glAccountName: (glName.get(r.gl_account_id) as string) ?? "",
    openingBalance: n2(r.opening_balance),
    openingBalanceDate: r.opening_balance_date ?? dateOnly(r.created_at),
    active: r.is_active && !r.archived_at,
    purpose: r.purpose ?? "",
    propertyId: r.property_id ?? null,
    classification: r.classification ?? "",
    notes: r.notes ?? "",
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
  out.importBatches = batches.map((r: any): ImportBatch => ({
    id: r.id, accountId: r.bank_account_id, periodStart: r.period_start ?? "", periodEnd: r.period_end ?? "", fileName: r.file_name ?? "", importedAt: r.imported_at,
    importedBy: staffName.get(r.imported_by) ?? "Team member", totalRows: r.total_rows, acceptedRows: r.accepted_rows, rejectedRows: r.rejected_rows,
    duplicateRows: r.duplicate_rows, warnings: r.warnings ?? [], mappingName: r.mapping_name ?? "", reconciliationId: r.reconciliation_id ?? null,
  }));
  out.importMappings = [
    ...SYSTEM_MAPPINGS,
    ...(mappings.data ?? []).map((r: any): ImportMapping => ({
      id: r.id, name: r.name, format: r.format, columns: r.columns as ColumnMapping, signedAmountMeaning: r.signed_amount_meaning, createdAt: r.created_at,
    })),
  ];
  out.bankTxs = bankTxs.map((r: any): BankTransaction => ({
    id: r.id, batchId: r.batch_id ?? "", accountId: r.bank_account_id, date: r.tx_date, postedDate: r.posted_date ?? null, description: r.description ?? "",
    reference: r.reference ?? "", debit: n2(r.debit), credit: n2(r.credit), signedAmount: n2(r.signed_amount), runningBalance: r.running_balance === null ? null : n2(r.running_balance),
    fingerprint: r.fingerprint, duplicateOf: r.duplicate_of ?? null, manualEntry: r.manual_entry, importedAt: r.imported_at, notes: r.notes ?? "",
  }));
  out.bookTxs = bookTxs.map((r: any): BookTransaction => ({
    id: r.id, accountId: r.bank_account_id, date: r.tx_date, type: r.tx_type, description: r.description ?? "", counterparty: r.counterparty ?? "",
    propertyId: r.property_id ?? null, unit: r.unit_id ? (unitLabel.get(r.unit_id) as string) ?? null : null, reference: r.reference ?? "",
    invoices: (invoicesByBook.get(r.id) ?? []).map((i: any) => ({ id: i.invoice_id ?? i.invoice_number, number: i.invoice_number, amount: n2(i.amount) })),
    moneyIn: n2(r.money_in), moneyOut: n2(r.money_out), signedAmount: n2(r.signed_amount), coa: coaOf(r.coa_account_id) ?? "",
    postingStatus: r.posting_status === "pending" ? "Pending" : "Posted", source: r.source ?? "", notes: r.notes ?? "",
    assignee: staffName.get(r.assignee_id) ?? "Unassigned", createdAt: r.created_at,
  }));
  out.reconciliations = recons.map((r: any): Reconciliation => ({
    id: r.id, reference: r.reference ?? r.id, accountId: r.bank_account_id, periodStart: r.period_start, periodEnd: r.period_end,
    statementOpeningBalance: n2(r.statement_opening_balance), statementEndingBalance: n2(r.statement_ending_balance), statementRef: r.statement_ref ?? "",
    fileName: r.file_name ?? null, notes: r.notes ?? "", status: RECON_FROM_DB[r.status] ?? "In Progress", createdBy: staffName.get(r.created_by) ?? "Team member",
    createdAt: r.created_at, finalizedBy: r.finalized_by ? staffName.get(r.finalized_by) ?? "Team member" : null, finalizedAt: r.finalized_at ?? null,
    reopenReason: r.reopen_reason ?? null, finalSummary: r.final_summary ?? null, detailSeeded: true,
  }));
  const bankBy = new Map<string, string[]>();
  for (const l of bankLines) bankBy.set(l.match_id, [...(bankBy.get(l.match_id) ?? []), l.bank_transaction_id]);
  const bookBy = new Map<string, string[]>();
  for (const l of bookLines) bookBy.set(l.match_id, [...(bookBy.get(l.match_id) ?? []), l.book_transaction_id]);
  out.matches = matches.map((r: any): Match => {
    const bankTxIds = bankBy.get(r.id) ?? [];
    const bookTxIds = bookBy.get(r.id) ?? [];
    return {
      id: r.id, reconciliationId: r.reconciliation_id, bankTxIds, bookTxIds, confidence: n2(r.confidence), confidenceLevel: CONFIDENCE_FROM_DB[r.confidence_level] ?? "None",
      explanation: r.explanation ?? "", type: r.match_type as MatchType, automatic: r.is_automatic, confirmedBy: staffName.get(r.confirmed_by) ?? "Team member",
      confirmedAt: r.confirmed_at ?? r.created_at ?? "", active: bankTxIds.length > 0 || bookTxIds.length > 0, // an undone match keeps its history but no lines
      history: Array.isArray(r.history) ? r.history : [],
    };
  });
  out.adjustments = adjustments.map((r: any): Adjustment => ({
    id: r.id, reconciliationId: r.reconciliation_id, side: r.side, kind: r.kind, amount: n2(r.amount), description: r.description ?? "", coa: coaOf(r.coa_account_id),
    approved: r.approved, createdBy: staffName.get(r.created_by) ?? "Team member", createdAt: r.created_at, notes: r.notes ?? "",
  }));
  out.audit = (events.data ?? []).map((e: any, i: number): AuditEntry => ({
    id: e.id, eventId: `EV-${1000 + i}`, at: e.occurred_at, user: e.actor_display_name, action: e.related_record_label || "Activity", record: e.entity_id,
    before: e.metadata?.before ?? "", after: e.metadata?.after ?? "", notes: e.metadata?.notes ?? e.description ?? "",
  }));
  const saved = (settings.data as any)?.value?.reconciliation;
  out.settings = { ...DEFAULT_SETTINGS, ...(saved ?? {}) };

  out.coa = accounts.filter((a: any) => a.role === "posting").map((a: any): CoaAccount => ({
    code: a.code, name: a.name,
    kind: a.account_type === "asset" ? "asset" : a.account_type === "liability" ? "liability" : a.account_type === "equity" ? "equity" : ["revenue", "other_income"].includes(a.account_type) ? "income" : "expense",
  }));
  const unitCount = new Map<string, number>();
  for (const u of units) unitCount.set(u.property_id, (unitCount.get(u.property_id) ?? 0) + 1);
  out.properties = properties.map((p: any): Property => ({ id: p.id, name: p.name, address: [p.address_line1, p.city].filter(Boolean).join(", "), unitCount: unitCount.get(p.id) ?? 0 }));
  out.units = units.map((u: any): Unit => ({ id: u.id, propertyId: u.property_id, label: u.unit_number, rent: n2(u.market_rent ?? u.advertised_rent) }));
  const unitById = new Map(units.map((u: any) => [u.id, u]));
  out.tenants = tenants.map((t: any): Tenant => {
    const party = parties.find((p: any) => p.tenant_id === t.id && !p.relationship_end_date);
    const pu = party ? partyUnits.find((x: any) => x.lease_party_id === party.id) : undefined;
    const unit: any = pu ? unitById.get(pu.unit_id) : undefined;
    return { id: t.id, name: `${t.first_name} ${t.last_name ?? ""}`.trim(), propertyId: unit?.property_id ?? "", unit: unit?.unit_number ?? "", email: t.email ?? "" };
  });
  out.vendors = vendors.map((v: any): Vendor => ({ id: v.id, name: v.company_name, category: v.trade ?? "" }));
  return out;
}

// ------------------------------------------------------------------ persist (diff)
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
function diff<T extends { id: string }>(prev: T[], next: T[]) {
  const before = new Map(prev.map((r) => [r.id, r]));
  const after = new Map(next.map((r) => [r.id, r]));
  return {
    added: next.filter((r) => !before.has(r.id)),
    changed: next.filter((r) => before.has(r.id) && !same(before.get(r.id), r)),
    removed: prev.filter((r) => !after.has(r.id)),
  };
}
function friendly(error: { code?: string; message?: string }, fallback: string): Error {
  if (error.code === "23P01") return new Error("This account already has a finalized reconciliation covering part of that period.");
  if (error.code === "23505") return new Error("That record already exists (duplicate statement line, reference or match).");
  if (["42501", "23514", "23503"].includes(error.code ?? "")) return new Error(error.message || fallback);
  return toError(error, fallback);
}

/** Server-assigned numbers the page should show instead of its provisional ones. */
export type Numbers = { accountCodes: Map<string, string>; references: Map<string, string> };

export async function persist(prev: StoreState, next: StoreState, userId: string): Promise<Numbers> {
  const orgId = getActiveOrgId();
  if (!orgId) throw new Error("Select an organization first.");
  const out: Numbers = { accountCodes: new Map(), references: new Map() };
  const check = (res: { error: any }, fallback: string) => { if (res.error) throw friendly(res.error, fallback); };
  const coaId = (code: string | null) => (code ? coaIdByCode.get(code) ?? null : null);
  const unitId = (propertyId: string | null, label: string | null) => (propertyId && label ? unitIdByLabel.get(`${propertyId}|${label}`) ?? null : null);

  // bank accounts
  const accountRow = (a: BankAccount) => {
    const gl = coaId(a.glAccount);
    if (!gl) throw new Error("Link the bank account to a Chart of Accounts cash/bank account.");
    return {
      name: a.name, institution: a.institution || null, last4: a.maskedAccount ? a.maskedAccount.slice(-4) : null, account_type: a.accountType.toLowerCase(),
      currency: a.currency, gl_account_id: gl, opening_balance: a.openingBalance, opening_balance_date: a.openingBalanceDate || null, is_active: a.active,
      purpose: a.purpose || null, property_id: a.propertyId, classification: a.classification || null, notes: a.notes || null,
    };
  };
  const accounts = diff(prev.accounts, next.accounts);
  if (accounts.added.length) {
    const res = await supabase.from("bank_accounts").insert(accounts.added.map((a) => ({ id: a.id, organization_id: orgId, ...accountRow(a) }))).select("id, account_code");
    check(res, "Unable to save the bank account.");
    (res.data ?? []).forEach((r: any) => out.accountCodes.set(r.id, r.account_code));
  }
  for (const a of accounts.changed) {
    const res = await supabase.from("bank_accounts").update(accountRow(a)).eq("id", a.id).select("id");
    check(res, "Unable to save the bank account.");
    if (!res.data?.length) throw new Error("You don't have permission to edit bank accounts.");
  }

  // import batches and mappings
  const batchRow = (b: ImportBatch) => ({
    bank_account_id: b.accountId, reconciliation_id: b.reconciliationId, period_start: b.periodStart || null, period_end: b.periodEnd || null, file_name: b.fileName || null,
    mapping_name: b.mappingName || null, total_rows: b.totalRows, accepted_rows: b.acceptedRows, rejected_rows: b.rejectedRows, duplicate_rows: b.duplicateRows,
    warnings: b.warnings, imported_by: userId,
  });
  const batches = diff(prev.importBatches, next.importBatches);
  const knownBatches = new Set(next.importBatches.map((b) => b.id));
  const mappings = diff(prev.importMappings.filter((m) => !m.system), next.importMappings.filter((m) => !m.system));

  // reconciliations are written first, because batches and matches point at them
  const reconRow = (r: Reconciliation) => ({
    bank_account_id: r.accountId, period_start: r.periodStart, period_end: r.periodEnd, statement_opening_balance: r.statementOpeningBalance,
    statement_ending_balance: r.statementEndingBalance, statement_ref: r.statementRef || null, file_name: r.fileName, notes: r.notes || null, status: RECON_TO_DB[r.status],
    finalized_by: r.finalizedBy ? userId : null, finalized_at: r.finalizedAt, reopen_reason: r.reopenReason, final_summary: r.finalSummary,
  });
  const recons = diff(prev.reconciliations, next.reconciliations);
  if (recons.added.length) {
    const res = await supabase.from("reconciliations").insert(recons.added.map((r) => ({ id: r.id, organization_id: orgId, created_by: userId, ...reconRow(r) }))).select("id, reference");
    check(res, "Unable to save the reconciliation.");
    (res.data ?? []).forEach((r: any) => out.references.set(r.id, r.reference));
  }
  for (const r of recons.changed) {
    const res = await supabase.from("reconciliations").update(reconRow(r)).eq("id", r.id).select("id");
    check(res, "Unable to save the reconciliation.");
    if (!res.data?.length) throw new Error("You don't have permission to change reconciliations.");
  }

  if (batches.added.length) check(await supabase.from("bank_import_batches").insert(batches.added.map((b) => ({ id: b.id, organization_id: orgId, ...batchRow(b) }))), "Unable to save the statement import.");
  if (mappings.added.length) {
    check(await supabase.from("bank_import_mappings").insert(mappings.added.map((m) => ({
      id: m.id, organization_id: orgId, name: m.name, format: m.format, columns: m.columns, signed_amount_meaning: m.signedAmountMeaning,
    }))), "Unable to save the import mapping.");
  }
  for (const m of mappings.removed) check(await supabase.from("bank_import_mappings").delete().eq("id", m.id), "Unable to delete the import mapping.");

  // statement lines (a manual entry has no import batch) and ledger lines
  const bankRow = (t: BankTransaction) => ({
    batch_id: knownBatches.has(t.batchId) ? t.batchId : null, bank_account_id: t.accountId, tx_date: t.date, posted_date: t.postedDate, description: t.description,
    reference: t.reference || null, debit: t.debit, credit: t.credit, running_balance: t.runningBalance, fingerprint: t.fingerprint,
    duplicate_of: t.duplicateOf, manual_entry: t.manualEntry, notes: t.notes || null,
  });
  const bank = diff(prev.bankTxs, next.bankTxs);
  const withDuplicates = [...bank.added].sort((a, b) => Number(!!a.duplicateOf) - Number(!!b.duplicateOf)); // originals before the lines that point at them
  if (withDuplicates.length) check(await supabase.from("bank_transactions").insert(withDuplicates.map((t) => ({ id: t.id, organization_id: orgId, ...bankRow(t) }))), "Unable to save the statement lines.");
  for (const t of bank.changed) check(await supabase.from("bank_transactions").update(bankRow(t)).eq("id", t.id), "Unable to update the statement line.");

  const bookRow = (t: BookTransaction) => ({
    bank_account_id: t.accountId, tx_date: t.date, tx_type: t.type, description: t.description, counterparty: t.counterparty || null, property_id: t.propertyId,
    unit_id: unitId(t.propertyId, t.unit), reference: t.reference || null, money_in: t.moneyIn, money_out: t.moneyOut, coa_account_id: coaId(t.coa),
    posting_status: t.postingStatus === "Pending" ? "pending" : "posted", source: t.source || null, notes: t.notes || null,
  });
  const book = diff(prev.bookTxs, next.bookTxs);
  if (book.added.length) {
    check(await supabase.from("book_transactions").insert(book.added.map((t) => ({ id: t.id, organization_id: orgId, ...bookRow(t) }))), "Unable to save the ledger entries.");
    const links = book.added.flatMap((t) => t.invoices.map((i) => ({ organization_id: orgId, book_transaction_id: t.id, invoice_id: /^[0-9a-f-]{36}$/i.test(i.id) ? i.id : null, invoice_number: i.number, amount: i.amount })));
    if (links.length) check(await supabase.from("book_transaction_invoices").insert(links), "Unable to save the invoices on the ledger entries.");
  }
  for (const t of book.changed) check(await supabase.from("book_transactions").update(bookRow(t)).eq("id", t.id), "Unable to update the ledger entry.");
  for (const t of bank.removed) check(await supabase.from("bank_transactions").delete().eq("id", t.id), "Unable to delete the statement line.");

  // matches: the lines of an undone match are released, its history stays
  const matchRow = (m: Match) => ({
    reconciliation_id: m.reconciliationId, match_type: m.type, confidence: m.confidence, confidence_level: m.confidenceLevel.toLowerCase(), explanation: m.explanation || null,
    is_automatic: m.automatic, confirmed_by: userId, confirmed_at: m.confirmedAt, history: m.history,
  });
  const matches = diff(prev.matches, next.matches);
  for (const m of matches.added) {
    check(await supabase.from("reconciliation_matches").insert({ id: m.id, organization_id: orgId, ...matchRow(m) }), "Unable to save the match.");
    if (m.active) {
      if (m.bankTxIds.length) check(await supabase.from("reconciliation_match_bank_lines").insert(m.bankTxIds.map((id) => ({ organization_id: orgId, match_id: m.id, bank_transaction_id: id }))), "Unable to link the statement lines to the match.");
      if (m.bookTxIds.length) check(await supabase.from("reconciliation_match_book_lines").insert(m.bookTxIds.map((id) => ({ organization_id: orgId, match_id: m.id, book_transaction_id: id }))), "Unable to link the ledger lines to the match.");
    }
  }
  for (const m of matches.changed) {
    check(await supabase.from("reconciliation_matches").update(matchRow(m)).eq("id", m.id), "Unable to update the match.");
    if (!m.active) {
      check(await supabase.from("reconciliation_match_bank_lines").delete().eq("match_id", m.id), "Unable to release the statement lines.");
      check(await supabase.from("reconciliation_match_book_lines").delete().eq("match_id", m.id), "Unable to release the ledger lines.");
    }
  }

  // adjustments
  const adjustmentRow = (a: Adjustment) => ({
    reconciliation_id: a.reconciliationId, side: a.side, kind: a.kind, amount: a.amount, description: a.description || null, coa_account_id: coaId(a.coa),
    approved: a.approved, created_by: userId, notes: a.notes || null,
  });
  const adjustments = diff(prev.adjustments, next.adjustments);
  if (adjustments.added.length) check(await supabase.from("reconciliation_adjustments").insert(adjustments.added.map((a) => ({ id: a.id, organization_id: orgId, ...adjustmentRow(a) }))), "Unable to save the adjustment.");
  for (const a of adjustments.changed) check(await supabase.from("reconciliation_adjustments").update(adjustmentRow(a)).eq("id", a.id), "Unable to update the adjustment.");
  for (const a of adjustments.removed) check(await supabase.from("reconciliation_adjustments").delete().eq("id", a.id), "Unable to delete the adjustment.");

  // settings
  if (!same(prev.settings, next.settings)) {
    const existing = await supabase.from("organization_settings").select("value").eq("organization_id", orgId).eq("category", "bank_reconciliation").maybeSingle();
    check(existing, "Unable to read the reconciliation settings.");
    const value = { ...((existing.data as any)?.value ?? {}), reconciliation: next.settings };
    check(await supabase.from("organization_settings").upsert({ organization_id: orgId, category: "bank_reconciliation", value, updated_by: userId }), "Unable to save the reconciliation settings.");
  }

  // audit trail (best-effort: a logging failure never undoes a saved change)
  for (const a of diff(prev.audit, next.audit).added.reverse()) {
    await supabase.rpc("record_activity", {
      p_org: orgId, p_action: "bankrecon.audit", p_category: "Accounting & Finance", p_description: `${a.action}: ${a.record}`, p_entity_type: "reconciliation", p_entity_id: a.record,
      p_label: a.action, p_metadata: { before: a.before, after: a.after, notes: a.notes }, p_source_module: "Bank reconciliation",
    });
  }
  return out;
}
