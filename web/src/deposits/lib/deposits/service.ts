// React 18 has no cache(); data is re-read on every render anyway.
const cache = <T extends (...args: any[]) => any>(fn: T): T => fn;
import { db } from "../../db";
import * as schema from "../../db/schema";
import { and, eq, isNotNull } from "../../db/ops";
import { addMonthsISO, diffDays, maxISO, minISO, monthKey, todayISO } from "../dates";
import {
  calculateInterest,
  computeBalances,
  getApplicableRule,
  interestAccrualWindow,
  principalEventStream,
  ruleMaxAmountCents,
  type DepositBalances,
  type InterestPreview,
  type RateLike,
  type RuleLike,
  type TxnLike,
} from "./engine";
import {
  ACCOUNT_NAMES,
  LIABILITY_ACCOUNT_BY_TYPE,
  isTerminalStatus,
  type DepositStatus,
} from "./domain";

export type DepositRow = typeof schema.deposits.$inferSelect;
export type TxnRow = typeof schema.depositTransactions.$inferSelect;
export type RefundRow = typeof schema.depositRefunds.$inferSelect;
export type DeviceRow = typeof schema.keyDevices.$inferSelect;
export type LeaseRow = typeof schema.leases.$inferSelect;
export type TenantRow = typeof schema.tenants.$inferSelect;
export type PropertyRow = typeof schema.properties.$inferSelect;
export type UnitRow = typeof schema.units.$inferSelect;
export type StaffRow = typeof schema.staff.$inferSelect;
export type PaymentRow = typeof schema.payments.$inferSelect;
export type InvoiceRow = typeof schema.rentInvoices.$inferSelect;
export type AccountRow = typeof schema.chartOfAccounts.$inferSelect;
export type ReconRow = typeof schema.reconciliationItems.$inferSelect;
export type AuditRow = typeof schema.auditLog.$inferSelect;
export type JournalLineRow = typeof schema.journalLines.$inferSelect;
export type JournalEntryRow = typeof schema.journalEntries.$inferSelect;

export type JournalWithLines = { entry: JournalEntryRow; lines: JournalLineRow[] };

export type EnrichedDeposit = {
  deposit: DepositRow;
  tenant: TenantRow | null;
  lease: LeaseRow | null;
  property: PropertyRow | null;
  unit: UnitRow | null;
  responsible: StaffRow | null;
  txns: TxnRow[];
  refunds: RefundRow[];
  devices: DeviceRow[];
  journals: JournalWithLines[];
  balances: DepositBalances;
  rule: RuleLike | null;
  ruleAtExpected: RuleLike | null;
  maxCents: number | null;
  rates: RateLike[];
  interestWindowStart: string;
  lastAccrualEnd: string | null;
  interestPreview: InterestPreview | null;
  interestDueDate: string | null;
  interestOverdue: boolean;
  openRefund: RefundRow | null;
  refundablePrincipalCents: number;
  refundBlockReason: string | null;
  issues: { severity: "overdue" | "warning" | "info"; label: string; href: string }[];
  glLiabilityCents: number;
  glVarianceCents: number;
  varianceCents: number;
};

const toRule = (r: typeof schema.depositRules.$inferSelect): RuleLike => ({
  id: r.id,
  jurisdiction: r.jurisdiction,
  leaseType: r.leaseType,
  depositType: r.depositType,
  collectionPermitted: r.collectionPermitted,
  maxAmountCents: r.maxAmountCents,
  maxMultipleOfRentBps: r.maxMultipleOfRentBps,
  calculationMethod: r.calculationMethod,
  refundConditions: r.refundConditions,
  interestApplicable: r.interestApplicable,
  interestMethod: r.interestMethod,
  interestFrequency: r.interestFrequency,
  applicationPurposes: r.applicationPurposes ?? [],
  requiredDocuments: r.requiredDocuments ?? [],
  approvalRequired: r.approvalRequired,
  refundApprovalRequired: r.refundApprovalRequired,
  roundingMode: r.roundingMode,
  effectiveFrom: r.effectiveFrom,
  effectiveTo: r.effectiveTo,
  validationMessage: r.validationMessage,
  legalReference: r.legalReference,
  notes: r.notes,
});

const toRate = (r: typeof schema.depositInterestRates.$inferSelect): RateLike => ({
  id: r.id,
  annualRateBps: r.annualRateBps,
  effectiveFrom: r.effectiveFrom,
  effectiveTo: r.effectiveTo,
  source: r.source,
});

export type DepositModuleData = {
  today: string;
  deposits: EnrichedDeposit[];
  refunds: (RefundRow & { deposit: EnrichedDeposit | null })[];
  reconciliations: (ReconRow & { reviewer: StaffRow | null; deposit: EnrichedDeposit | null })[];
  audit: AuditRow[];
  lookups: {
    properties: PropertyRow[];
    units: UnitRow[];
    tenants: TenantRow[];
    leases: LeaseRow[];
    staff: StaffRow[];
    accounts: AccountRow[];
  };
  unlinkedDepositPayments: PaymentRow[];
  payments: PaymentRow[];
  bankOpeningCents: number;
  glByAccount: { code: string; name: string; debitCents: number; creditCents: number; balanceCents: number }[];
  rules: RuleLike[];
  rateHistory: (typeof schema.depositInterestRates.$inferSelect)[];
};

function anniversaryDue(start: string, frequency: string, lastEnd: string | null, today: string): string | null {
  if (frequency === "none") return null;
  const step = frequency === "monthly" ? 1 : 12;
  let anchor = lastEnd ?? start;
  let next = addMonthsISO(anchor, step);
  let guard = 0;
  while (next < today && guard < 120) {
    anchor = next;
    next = addMonthsISO(anchor, step);
    guard += 1;
  }
  return next;
}

export const loadDepositModule = cache(async (): Promise<DepositModuleData> => {
  const today = todayISO();
  const [
    depositRows,
    txnRows,
    refundRows,
    deviceRows,
    tenantRows,
    leaseRows,
    propertyRows,
    unitRows,
    staffRows,
    accountRows,
    paymentRows,
    ruleRows,
    rateRows,
    reconRows,
    auditRows,
    journalLineRows,
    journalEntryRows,
    metaRows,
  ] = await Promise.all([
    db.select().from(schema.deposits),
    db.select().from(schema.depositTransactions),
    db.select().from(schema.depositRefunds),
    db.select().from(schema.keyDevices),
    db.select().from(schema.tenants),
    db.select().from(schema.leases),
    db.select().from(schema.properties),
    db.select().from(schema.units),
    db.select().from(schema.staff),
    db.select().from(schema.chartOfAccounts),
    db.select().from(schema.payments),
    db.select().from(schema.depositRules),
    db.select().from(schema.depositInterestRates),
    db.select().from(schema.reconciliationItems),
    db.select().from(schema.auditLog),
    db.select().from(schema.journalLines),
    db.select().from(schema.journalEntries),
    db.select().from(schema.appMeta),
  ]);

  const tenantsById = new Map(tenantRows.map((t) => [t.id, t]));
  const leasesById = new Map(leaseRows.map((l) => [l.id, l]));
  const propertiesById = new Map(propertyRows.map((p) => [p.id, p]));
  const unitsById = new Map(unitRows.map((u) => [u.id, u]));
  const staffById = new Map(staffRows.map((s) => [s.id, s]));
  const rules = ruleRows.map(toRule);
  const rates = rateRows.map(toRate);
  const entryById = new Map(journalEntryRows.map((e) => [e.id, e]));

  const txnsByDeposit = new Map<string, TxnRow[]>();
  for (const t of txnRows) {
    const list = txnsByDeposit.get(t.depositId) ?? [];
    list.push(t);
    txnsByDeposit.set(t.depositId, list);
  }
  const refundsByDeposit = new Map<string, RefundRow[]>();
  for (const r of refundRows) {
    const list = refundsByDeposit.get(r.depositId) ?? [];
    list.push(r);
    refundsByDeposit.set(r.depositId, list);
  }
  const devicesByDeposit = new Map<string, DeviceRow[]>();
  for (const d of deviceRows) {
    const list = devicesByDeposit.get(d.depositId) ?? [];
    list.push(d);
    devicesByDeposit.set(d.depositId, list);
  }
  const journalLinesByDeposit = new Map<string, JournalLineRow[]>();
  for (const line of journalLineRows) {
    if (!line.depositId) continue;
    const list = journalLinesByDeposit.get(line.depositId) ?? [];
    list.push(line);
    journalLinesByDeposit.set(line.depositId, list);
  }

  const deposits: EnrichedDeposit[] = depositRows.map((deposit) => {
    const lease = leasesById.get(deposit.leaseId) ?? null;
    const txns = (txnsByDeposit.get(deposit.id) ?? []).sort((a, b) =>
      a.occurredAt === b.occurredAt ? a.createdAt.getTime() - b.createdAt.getTime() : a.occurredAt < b.occurredAt ? -1 : 1,
    );
    const devices = devicesByDeposit.get(deposit.id) ?? [];
    const refunds = (refundsByDeposit.get(deposit.id) ?? []).sort((a, b) => (a.requestedAt < b.requestedAt ? 1 : -1));
    const balances = computeBalances(deposit.requiredAmountCents, txns as TxnLike[]);
    const rule = getApplicableRule(rules, {
      jurisdiction: deposit.jurisdiction,
      leaseType: deposit.leaseType,
      depositType: deposit.depositType,
      asOf: today,
    });
    const ruleAtExpected = getApplicableRule(rules, {
      jurisdiction: deposit.jurisdiction,
      leaseType: deposit.leaseType,
      depositType: deposit.depositType,
      asOf: deposit.expectedDate,
    });
    const replacementCost = devices.reduce((acc, d) => acc + d.replacementCostCents * d.quantityIssued, 0);
    const maxCents = ruleMaxAmountCents(rule, lease?.monthlyRentCents ?? null, replacementCost || null);
    const typeRates = rateRows
      .filter(
        (r) =>
          r.jurisdiction === deposit.jurisdiction &&
          r.leaseType === deposit.leaseType &&
          r.depositType === deposit.depositType,
      )
      .map(toRate)
      .sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? 1 : -1));

    const interestStart = deposit.firstReceivedDate ?? lease?.startDate ?? deposit.expectedDate;
    const { start: windowStart, end: windowEnd, lastAccrualEnd } = interestAccrualWindow({
      txns: txns as TxnLike[],
      interestStart,
      asOf: today,
    });
    let preview: InterestPreview | null = null;
    if (rule?.interestApplicable && deposit.firstReceivedDate) {
      preview = calculateInterest({
        periodStart: windowStart,
        periodEnd: windowEnd,
        principalEvents: principalEventStream(txns as TxnLike[]),
        rates: typeRates,
      });
    }
    const interestDueDate =
      rule?.interestApplicable && deposit.firstReceivedDate
        ? anniversaryDue(interestStart, "annual", lastAccrualEnd, today)
        : null;
    const interestOverdue = Boolean(
      interestDueDate && interestDueDate < today && (preview?.totalCents ?? 0) + balances.interestOutstandingCents > 0,
    );

    const openRefund =
      refunds.find((r) => ["requested", "approved", "processing"].includes(r.status)) ?? null;

    let refundablePrincipalCents = Math.max(0, balances.principalOutstandingCents);
    let refundBlockReason: string | null = null;
    if (deposit.depositType === "last_month_rent") {
      const tenancyEnded = deposit.status === "closed" || (lease ? lease.endDate <= today || lease.status === "ended" : false);
      const overCollected = Math.max(0, balances.receivedCents - deposit.requiredAmountCents);
      if (!tenancyEnded) {
        refundablePrincipalCents = Math.min(refundablePrincipalCents, overCollected);
        if (overCollected === 0) {
          refundBlockReason =
            "Last month's rent is not refundable while the tenancy continues — apply it to the final rental period or refund after termination.";
        }
      }
    }
    if (deposit.depositType === "last_month_rent" && balances.principalOutstandingCents > 0 && !openRefund) {
      const leaseEnd = lease?.endDate ?? today;
      const daysToEnd = diffDays(today, leaseEnd);
      if (leaseEnd <= today) {
        refundBlockReason = refundBlockReason ?? "Lease period has ended — last month's rent must be applied to the final rental period.";
      } else if (daysToEnd <= 60) {
        refundBlockReason = null;
      }
    }
    if (deposit.depositType === "pet_deposit") {
      refundBlockReason = refundBlockReason ?? "This deposit category is not permitted for the applicable residential rules.";
    }

    const issues: EnrichedDeposit["issues"] = [];
    if (
      balances.uncollectedCents > 0 &&
      deposit.expectedDate < today &&
      !["cancelled", "closed", "draft"].includes(deposit.status)
    ) {
      issues.push({
        severity: "overdue",
        label: `Expected deposit not fully received by ${deposit.expectedDate}`,
        href: `/deposits/collection?deposit=${deposit.id}`,
      });
    }
    if (deposit.status === "partially_received") {
      issues.push({
        severity: "warning",
        label: `Partial collection — ${Math.round((balances.receivedCents / Math.max(1, deposit.requiredAmountCents)) * 100)}% received`,
        href: `/deposits/collection?deposit=${deposit.id}`,
      });
    }
    if (openRefund) {
      issues.push({
        severity: openRefund.status === "requested" ? "warning" : "warning",
        label: `Refund ${openRefund.reference} is ${openRefund.status === "requested" ? "awaiting approval" : "approved and awaiting payment"}`,
        href: `/deposits/refunds?deposit=${deposit.id}`,
      });
    }
    if (interestOverdue) {
      issues.push({
        severity: "overdue",
        label: `Interest accrual past its due date (${interestDueDate})`,
        href: `/deposits/interest?deposit=${deposit.id}`,
      });
    } else if (rule?.interestApplicable && (preview?.totalCents ?? 0) > 0 && (preview?.totalCents ?? 0) >= 500) {
      issues.push({
        severity: "warning",
        label: "Unposted interest accrual available",
        href: `/deposits/interest?deposit=${deposit.id}`,
      });
    }
    if (deposit.reconciliationStatus === "exception") {
      issues.push({ severity: "warning", label: "Unresolved reconciliation difference", href: `/deposits/reconciliation?deposit=${deposit.id}` });
    }
    if (!rule) {
      issues.push({
        severity: "warning",
        label: "No effective deposit rule for the jurisdiction / lease type",
        href: `/deposits/configuration?jurisdiction=${deposit.jurisdiction}`,
      });
    } else if (!rule.collectionPermitted && balances.receivedCents > 0) {
      issues.push({
        severity: "overdue",
        label: "Funds held under a deposit category that the applicable rule prohibits — review required",
        href: `/deposits/${deposit.id}`,
      });
    }
    if (!deposit.leaseId || !leasesById.get(deposit.leaseId)) {
      issues.push({ severity: "warning", label: "Deposit is missing a lease mapping", href: `/deposits/${deposit.id}` });
    }
    if (!accountRows.some((a) => a.code === deposit.liabilityAccountCode)) {
      issues.push({ severity: "warning", label: "Liability account mapping is missing or inactive", href: `/deposits/configuration` });
    }
    if (deposit.depositType === "last_month_rent" && (lease ? lease.endDate : today) <= addMonthsISO(today, 2) && balances.principalOutstandingCents > 0 && !openRefund) {
      issues.push({
        severity: "info",
        label: "Lease ends within 60 days — prepare final rental period application",
        href: `/deposits/application?deposit=${deposit.id}`,
      });
    }

    const lines = journalLinesByDeposit.get(deposit.id) ?? [];
    const glLiabilityCents = lines
      .filter((l) => l.accountCode === deposit.liabilityAccountCode)
      .reduce((acc, l) => acc + l.creditCents - l.debitCents, 0);
    const glInterestCents = lines
      .filter((l) => l.accountCode === deposit.interestPayableAccountCode)
      .reduce((acc, l) => acc + l.creditCents - l.debitCents, 0);
    const glLiability = glLiabilityCents + glInterestCents;
    const liabilityObligation = balances.principalOutstandingCents + balances.interestOutstandingCents;

    const journals: JournalWithLines[] = [];
    const seenEntries = new Set<string>();
    for (const line of txns) {
      if (!line.journalEntryId || seenEntries.has(line.journalEntryId)) continue;
      const entry = entryById.get(line.journalEntryId);
      if (!entry) continue;
      seenEntries.add(entry.id);
      journals.push({ entry, lines: journalLineRows.filter((l) => l.entryId === entry.id) });
    }

    return {
      deposit,
      tenant: tenantsById.get(deposit.tenantId) ?? null,
      lease,
      property: propertiesById.get(deposit.propertyId) ?? null,
      unit: unitsById.get(deposit.unitId) ?? null,
      responsible: staffById.get(deposit.responsibleUserId) ?? null,
      txns,
      refunds,
      devices,
      journals,
      balances,
      rule,
      ruleAtExpected,
      maxCents,
      rates: typeRates,
      interestWindowStart: windowStart,
      lastAccrualEnd,
      interestPreview: preview,
      interestDueDate,
      interestOverdue,
      openRefund,
      refundablePrincipalCents,
      refundBlockReason,
      issues: issues.filter((i) => !["cancelled", "closed"].includes(deposit.status) || i.severity === "overdue"),
      glLiabilityCents: glLiability,
      glVarianceCents: liabilityObligation - glLiability,
      varianceCents: balances.totalRemainingCents,
    };
  });

  deposits.sort((a, b) => (a.deposit.reference < b.deposit.reference ? 1 : -1));

  const unlinkedDepositPayments = paymentRows.filter(
    (p) => p.type === "deposit" && p.direction === "in" && !txnRows.some((t) => t.paymentId === p.id),
  );

  const glMap = new Map<string, { debit: number; credit: number }>();
  for (const l of journalLineRows) {
    const entry = entryById.get(l.entryId);
    if (entry?.status !== "posted") continue;
    const current = glMap.get(l.accountCode) ?? { debit: 0, credit: 0 };
    current.debit += l.debitCents;
    current.credit += l.creditCents;
    glMap.set(l.accountCode, current);
  }
  const glByAccount = Array.from(glMap.entries())
    .map(([code, v]) => ({
      code,
      name: accountRows.find((a) => a.code === code)?.name ?? ACCOUNT_NAMES[code] ?? code,
      debitCents: v.debit,
      creditCents: v.credit,
      balanceCents: v.credit - v.debit,
    }))
    .sort((a, b) => (a.code < b.code ? -1 : 1));

  const depositsById = new Map(deposits.map((d) => [d.deposit.id, d]));
  const refunds = refundRows
    .map((r) => ({ ...r, deposit: depositsById.get(r.depositId) ?? null }))
    .sort((a, b) => (a.requestedAt < b.requestedAt ? 1 : -1));

  const reconciliations = reconRows
    .map((r) => ({
      ...r,
      reviewer: r.reviewerId ? staffById.get(r.reviewerId) ?? null : null,
      deposit: r.depositId ? depositsById.get(r.depositId) ?? null : null,
    }))
    .sort((a, b) => (a.txnDate < b.txnDate ? 1 : -1));

  const bankOpeningCents = Number(metaRows.find((m) => m.key === "bank_opening_cents")?.value ?? "0");

  return {
    today,
    deposits,
    refunds,
    reconciliations,
    audit: auditRows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
    lookups: {
      properties: propertyRows,
      units: unitRows,
      tenants: tenantRows,
      leases: leaseRows,
      staff: staffRows,
      accounts: accountRows,
    },
    unlinkedDepositPayments,
    payments: paymentRows,
    bankOpeningCents,
    glByAccount,
    rules,
    rateHistory: rateRows,
  };
});

/* ------------------------------- Filters ------------------------------- */

export type DepositFilters = {
  q: string;
  tenantId: string;
  propertyId: string;
  unitId: string;
  leaseId: string;
  depositType: string;
  status: string;
  jurisdiction: string;
  leaseType: string;
  expectedFrom: string;
  expectedTo: string;
  receivedFrom: string;
  receivedTo: string;
  balance: string;
  interestStatus: string;
  reconStatus: string;
  overdueOnly: boolean;
  attention: boolean;
  sort: string;
  dir: "asc" | "desc";
  page: number;
};

const str = (v: string | string[] | undefined, fallback = ""): string =>
  (Array.isArray(v) ? v[0] : v) ?? fallback;

export function parseFilters(params: Record<string, string | string[] | undefined>): DepositFilters {
  const dir = str(params.dir, "desc") === "asc" ? "asc" : "desc";
  return {
    q: str(params.q),
    tenantId: str(params.tenantId),
    propertyId: str(params.propertyId),
    unitId: str(params.unitId),
    leaseId: str(params.leaseId),
    depositType: str(params.depositType),
    status: str(params.status),
    jurisdiction: str(params.jurisdiction),
    leaseType: str(params.leaseType),
    expectedFrom: str(params.expectedFrom),
    expectedTo: str(params.expectedTo),
    receivedFrom: str(params.receivedFrom),
    receivedTo: str(params.receivedTo),
    balance: str(params.balance),
    interestStatus: str(params.interestStatus),
    reconStatus: str(params.reconStatus),
    overdueOnly: str(params.overdueOnly) === "1",
    attention: str(params.attention) === "1",
    sort: str(params.sort, "reference"),
    dir,
    page: Math.max(1, Number(str(params.page, "1")) || 1),
  };
}

export function filtersToQuery(f: Record<string, string | number | boolean | undefined>): string {
  const out = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) {
    if (v == null || v === "" || v === false) continue;
    if (k === "page" && v === 1) continue;
    out.set(k, v === true ? "1" : String(v));
  }
  return out.toString();
}

export function applyFilters(rows: EnrichedDeposit[], f: DepositFilters, today: string): EnrichedDeposit[] {
  const q = f.q.trim().toLowerCase();
  return rows.filter((d) => {
    if (q) {
      const haystack = [
        d.deposit.reference,
        d.tenant?.name,
        d.property?.name,
        d.unit?.label,
        d.lease?.reference,
        d.deposit.notes,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    if (f.tenantId && d.deposit.tenantId !== f.tenantId) return false;
    if (f.propertyId && d.deposit.propertyId !== f.propertyId) return false;
    if (f.unitId && d.deposit.unitId !== f.unitId) return false;
    if (f.leaseId && d.deposit.leaseId !== f.leaseId) return false;
    if (f.depositType && d.deposit.depositType !== f.depositType) return false;
    if (f.status && d.deposit.status !== f.status) return false;
    if (f.jurisdiction && d.deposit.jurisdiction !== f.jurisdiction) return false;
    if (f.leaseType && d.deposit.leaseType !== f.leaseType) return false;
    if (f.expectedFrom && d.deposit.expectedDate < f.expectedFrom) return false;
    if (f.expectedTo && d.deposit.expectedDate > f.expectedTo) return false;
    const firstReceived = d.deposit.firstReceivedDate ?? "";
    if (f.receivedFrom && (!firstReceived || firstReceived < f.receivedFrom)) return false;
    if (f.receivedTo && (!firstReceived || firstReceived > f.receivedTo)) return false;
    if (f.balance === "outstanding" && d.balances.principalOutstandingCents <= 0) return false;
    if (f.balance === "zero" && d.balances.principalOutstandingCents > 0) return false;
    if (f.interestStatus === "due" && !d.interestOverdue) return false;
    if (f.interestStatus === "outstanding" && d.balances.interestOutstandingCents <= 0) return false;
    if (f.interestStatus === "none" && d.balances.interestOutstandingCents !== 0) return false;
    if (f.reconStatus === "exception" && d.deposit.reconciliationStatus !== "exception") return false;
    if (f.reconStatus === "not_reviewed" && d.deposit.reconciliationStatus !== "not_reviewed") return false;
    if (f.reconStatus === "reconciled" && d.deposit.reconciliationStatus !== "reconciled") return false;
    if (f.overdueOnly && !d.issues.some((i) => i.severity === "overdue")) return false;
    if (f.attention && d.issues.filter((i) => i.severity !== "info").length === 0) return false;
    return true;
  });
}

const SORT_KEYS: Record<string, (d: EnrichedDeposit) => string | number> = {
  reference: (d) => d.deposit.reference,
  tenant: (d) => d.tenant?.name ?? "",
  property: (d) => `${d.property?.name ?? ""} ${d.unit?.label ?? ""}`,
  type: (d) => d.deposit.depositType,
  expected: (d) => d.deposit.expectedDate,
  received: (d) => d.deposit.firstReceivedDate ?? "",
  required: (d) => d.deposit.requiredAmountCents,
  collected: (d) => d.balances.receivedCents,
  applied: (d) => d.balances.appliedCents,
  refunded: (d) => d.balances.refundedCents,
  outstanding: (d) => d.balances.totalRemainingCents,
  status: (d) => d.deposit.status,
  updated: (d) => d.deposit.updatedAt.getTime(),
};

export function sortDeposits(rows: EnrichedDeposit[], sort: string, dir: "asc" | "desc"): EnrichedDeposit[] {
  const key = SORT_KEYS[sort] ?? SORT_KEYS.reference;
  const sorted = [...rows].sort((a, b) => {
    const av = key(a);
    const bv = key(b);
    if (typeof av === "number" && typeof bv === "number") return av - bv;
    return String(av).localeCompare(String(bv));
  });
  return dir === "asc" ? sorted : sorted.reverse();
}

export function paginate<T>(rows: T[], page: number, size: number): { rows: T[]; page: number; pages: number; total: number } {
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const current = Math.min(Math.max(1, page), pages);
  return { rows: rows.slice((current - 1) * size, current * size), page: current, pages, total: rows.length };
}

/* ------------------------------- Dashboard ------------------------------- */

export type Kpi = {
  key: string;
  label: string;
  valueCents?: number;
  count?: number;
  isCount?: boolean;
  hint: string;
  href: string;
  tone: "neutral" | "info" | "success" | "warning" | "danger" | "accent";
};

export function summariseDeposits(rows: EnrichedDeposit[], asOf: string): { kpis: Kpi[]; summary: Record<string, number> } {
  const active = rows.filter((d) => !["cancelled", "draft"].includes(d.deposit.status));
  const principalHeld = active.reduce((acc, d) => acc + d.balances.principalOutstandingCents, 0);
  const interestHeld = active.reduce((acc, d) => acc + d.balances.interestOutstandingCents, 0);
  const unpostedInterest = active.reduce((acc, d) => acc + (d.interestPreview?.totalCents ?? 0), 0);
  const expected = active.filter((d) => d.balances.uncollectedCents > 0 && d.deposit.firstReceivedDate == null);
  const partiallyReceived = active.filter((d) => d.deposit.status === "partially_received" || (d.balances.receivedCents > 0 && d.balances.uncollectedCents > 0));
  const refundsPending = rows.filter((d) => d.openRefund);
  const refundsPendingCents = refundsPending.reduce(
    (acc, d) => acc + (d.openRefund?.approvedPrincipalCents ?? d.openRefund?.requestedPrincipalCents ?? 0) + (d.openRefund?.approvedInterestCents ?? d.openRefund?.requestedInterestCents ?? 0),
    0,
  );
  const dueApplication = active.filter(
    (d) =>
      d.deposit.depositType === "last_month_rent" &&
      d.balances.principalOutstandingCents > 0 &&
      d.lease &&
      diffDays(asOf, d.lease.endDate) <= 60,
  );
  const interestDue = active.filter(
    (d) => d.interestOverdue || (d.rule?.interestApplicable && (d.interestPreview?.totalCents ?? 0) >= 500),
  );
  const reconExceptions = rows.filter((d) => d.deposit.reconciliationStatus === "exception");
  const overdueActions = active.filter((d) => d.issues.some((i) => i.severity === "overdue"));

  const summary: Record<string, number> = {
    liabilityCents: principalHeld + interestHeld,
    principalHeld,
    interestHeld,
    unpostedInterest,
    expectedCents: expected.reduce((acc, d) => acc + d.balances.uncollectedCents, 0),
    expectedCount: expected.length,
    partialCount: partiallyReceived.length,
    partialReceivedCents: partiallyReceived.reduce((acc, d) => acc + d.balances.receivedCents, 0),
    partialOutstandingCents: partiallyReceived.reduce((acc, d) => acc + d.balances.uncollectedCents, 0),
    refundsPendingCents,
    refundsPendingCount: refundsPending.length,
    dueApplicationCents: dueApplication.reduce((acc, d) => acc + d.balances.principalOutstandingCents, 0),
    dueApplicationCount: dueApplication.length,
    interestDueCents: interestHeld + unpostedInterest,
    interestDueCount: interestDue.length,
    reconDifferenceCents: reconExceptions.reduce((acc, d) => acc + Math.abs(d.glVarianceCents), 0),
    reconCount: reconExceptions.length,
    overdueCount: overdueActions.length,
    recordCount: rows.length,
    heldCount: active.filter((d) => d.balances.principalOutstandingCents > 0).length,
  };

  const kpis: Kpi[] = [
    {
      key: "liability",
      label: "Total deposit liability",
      valueCents: summary.liabilityCents,
      hint: `${summary.heldCount} records with an outstanding obligation (principal + interest)`,
      href: "/deposits/register?balance=outstanding",
      tone: "accent",
    },
    {
      key: "held",
      label: "Total deposits held",
      valueCents: summary.principalHeld,
      hint: "Principal held in trust — excludes interest obligations",
      href: "/deposits/register?balance=outstanding",
      tone: "info",
    },
    {
      key: "expected",
      label: "Deposits expected",
      valueCents: summary.expectedCents,
      count: summary.expectedCount,
      hint: "Not yet collected — no liability recognised until received",
      href: "/deposits/register?status=expected",
      tone: "warning",
    },
    {
      key: "partial",
      label: "Partially received",
      valueCents: summary.partialOutstandingCents,
      count: summary.partialCount,
      hint: "Records with funds received below the required amount",
      href: "/deposits/register?status=partially_received",
      tone: "warning",
    },
    {
      key: "refunds",
      label: "Refunds pending",
      valueCents: summary.refundsPendingCents,
      count: summary.refundsPendingCount,
      hint: "Requested or approved refunds not yet paid",
      href: "/deposits/refunds?status=open",
      tone: "warning",
    },
    {
      key: "apply",
      label: "Deposits due for application",
      valueCents: summary.dueApplicationCents,
      count: summary.dueApplicationCount,
      hint: "Last month's rent on leases ending within 60 days or already ended",
      href: "/deposits/application",
      tone: "accent",
    },
    {
      key: "interest",
      label: "Interest due or pending",
      valueCents: summary.interestDueCents,
      count: summary.interestDueCount,
      hint: "Posted interest outstanding plus unposted accrual estimates",
      href: "/deposits/interest?filter=due",
      tone: "warning",
    },
    {
      key: "recon",
      label: "Reconciliation differences",
      valueCents: summary.reconDifferenceCents,
      count: summary.reconCount,
      hint: "Deposits flagged with an unresolved reconciliation exception",
      href: "/deposits/register?reconStatus=exception",
      tone: "danger",
    },
    {
      key: "overdue",
      label: "Overdue deposit actions",
      isCount: true,
      count: summary.overdueCount,
      valueCents: 0,
      hint: "Records with at least one overdue obligation (count, not amount)",
      href: "/deposits/register?overdueOnly=1",
      tone: "danger",
    },
  ];

  return { kpis, summary };
}

export async function getDepositById(id: string): Promise<EnrichedDeposit | null> {
  const data = await loadDepositModule();
  return data.deposits.find((d) => d.deposit.id === id) ?? null;
}

export async function getOpenInvoices(leaseId: string): Promise<InvoiceRow[]> {
  return db
    .select()
    .from(schema.rentInvoices)
    .where(and(eq(schema.rentInvoices.leaseId, leaseId), eq(schema.rentInvoices.status, "open")));
}

export async function getAuditForDeposit(id: string): Promise<AuditRow[]> {
  return db.select().from(schema.auditLog).where(eq(schema.auditLog.entityId, id));
}

export function interestStartForDeposit(d: EnrichedDeposit): string {
  return d.deposit.firstReceivedDate ?? d.lease?.startDate ?? d.deposit.expectedDate;
}

export function effectiveLiabilityAccount(depositType: string): string {
  return LIABILITY_ACCOUNT_BY_TYPE[depositType as keyof typeof LIABILITY_ACCOUNT_BY_TYPE] ?? "2240";
}

export function isActiveStatus(status: string): boolean {
  return !isTerminalStatus(status);
}

export function statusOptions(): DepositStatus[] {
  return [
    "draft",
    "expected",
    "partially_received",
    "held",
    "partially_applied",
    "applied",
    "refund_requested",
    "refund_pending",
    "partially_refunded",
    "refunded",
    "closed",
    "cancelled",
  ] as DepositStatus[];
}

export function monthTotals(rows: EnrichedDeposit[]) {
  const byMonth = new Map<string, { received: number; applied: number; refunded: number; interest: number }>();
  for (const d of rows) {
    for (const t of d.txns) {
      const key = monthKey(t.occurredAt);
      const bucket = byMonth.get(key) ?? { received: 0, applied: 0, refunded: 0, interest: 0 };
      if (["collection", "partial_collection"].includes(t.txnType)) bucket.received += t.signedAmountCents;
      if (t.txnType === "application") bucket.applied += Math.abs(t.signedAmountCents);
      if (t.txnType === "refund_payment") bucket.refunded += Math.abs(t.signedAmountCents);
      if (t.txnType === "interest_accrual") bucket.interest += t.signedAmountCents;
      byMonth.set(key, bucket);
    }
  }
  return byMonth;
}

export { addMonthsISO, maxISO, minISO };
