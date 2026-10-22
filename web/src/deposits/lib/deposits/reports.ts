import { diffDays } from "../dates";
import {
  REFUND_STATUS_LABELS,
  RECONCILIATION_STATUS_LABELS,
  depositTypeLabel,
  statusLabel,
  type DepositType,
} from "./domain";
import type { DepositModuleData, EnrichedDeposit } from "./service";

export const REPORT_DEFINITIONS = [
  { key: "liability", label: "Deposit liability" },
  { key: "collection", label: "Deposit collections" },
  { key: "application", label: "Deposit applications" },
  { key: "refund", label: "Deposit refunds" },
  { key: "interest", label: "Deposit interest" },
  { key: "aging", label: "Deposit aging" },
  { key: "reconciliation", label: "Reconciliation" },
  { key: "audit", label: "Transaction audit" },
] as const;

export type ReportKey = (typeof REPORT_DEFINITIONS)[number]["key"];
export type ReportColumnType = "text" | "currency" | "date" | "number" | "percent" | "datetime";

export type ReportColumn = { key: string; label: string; type?: ReportColumnType };

export type ReportResult = {
  key: ReportKey;
  title: string;
  description: string;
  columns: ReportColumn[];
  rows: Record<string, string | number>[];
  totals?: Record<string, number>;
  note?: string;
};

const active = (d: EnrichedDeposit) => !["cancelled", "draft"].includes(d.deposit.status);

function isPast(date: string | null, today: string): boolean {
  return Boolean(date && date < today);
}

export function buildReport(
  key: ReportKey,
  deposits: EnrichedDeposit[],
  module: Pick<DepositModuleData, "refunds" | "reconciliations" | "audit" | "today">,
  asOfLabel: string,
): ReportResult {
  const today = module.today;
  const depositById = new Map(deposits.map((d) => [d.deposit.id, d]));

  if (key === "liability") {
    const rows = deposits.filter(active).filter((d) => d.balances.totalRemainingCents !== 0).map((d) => ({
      reference: d.deposit.reference,
      tenant: d.tenant?.name ?? "—",
      property: `${d.property?.name ?? "—"} · ${d.unit?.label ?? "—"}`,
      lease: d.lease?.reference ?? "—",
      type: depositTypeLabel(d.deposit.depositType),
      jurisdiction: d.deposit.jurisdiction,
      period: d.deposit.expectedDate.slice(0, 7),
      principal: d.balances.principalOutstandingCents,
      interest: d.balances.interestOutstandingCents,
      total: d.balances.totalRemainingCents,
      liabilityAccount: d.deposit.liabilityAccountCode,
      status: statusLabel(d.deposit.status),
    }));
    return {
      key,
      title: "Deposit liability report",
      description: `Outstanding deposit obligations by property, tenant, lease, deposit type and accounting period as of ${asOfLabel}. Interest is shown separately from principal.`,
      columns: [
        { key: "reference", label: "Deposit ref" },
        { key: "tenant", label: "Tenant" },
        { key: "property", label: "Property · unit" },
        { key: "lease", label: "Lease" },
        { key: "type", label: "Deposit type" },
        { key: "jurisdiction", label: "Juris." },
        { key: "period", label: "Period" },
        { key: "principal", label: "Principal held", type: "currency" },
        { key: "interest", label: "Interest held", type: "currency" },
        { key: "total", label: "Total obligation", type: "currency" },
        { key: "liabilityAccount", label: "Liability a/c" },
        { key: "status", label: "Status" },
      ],
      rows,
      totals: {
        principal: rows.reduce((a, r) => a + r.principal, 0),
        interest: rows.reduce((a, r) => a + r.interest, 0),
        total: rows.reduce((a, r) => a + r.total, 0),
      },
    };
  }

  if (key === "collection") {
    const rows = deposits
      .filter((d) => d.deposit.status !== "cancelled")
      .map((d) => ({
        reference: d.deposit.reference,
        tenant: d.tenant?.name ?? "—",
        property: `${d.property?.name ?? "—"} · ${d.unit?.label ?? "—"}`,
        type: depositTypeLabel(d.deposit.depositType),
        expected: d.deposit.expectedDate,
        expectedAmount: d.deposit.requiredAmountCents,
        received: d.deposit.firstReceivedDate ?? "",
        collected: d.balances.receivedCents,
        outstanding: d.balances.uncollectedCents,
        variance: d.balances.receivedCents - d.deposit.requiredAmountCents,
        status: statusLabel(d.deposit.status),
        overdueDays: d.balances.uncollectedCents > 0 ? Math.max(0, diffDays(d.deposit.expectedDate, today)) : 0,
      }));
    return {
      key,
      title: "Deposit collection report",
      description: "Expected versus collected deposits, partial collections, collection dates and outstanding amounts. Overdue age is measured from the expected collection date.",
      columns: [
        { key: "reference", label: "Deposit ref" },
        { key: "tenant", label: "Tenant" },
        { key: "property", label: "Property · unit" },
        { key: "type", label: "Type" },
        { key: "expected", label: "Expected date", type: "date" },
        { key: "expectedAmount", label: "Required", type: "currency" },
        { key: "received", label: "First received", type: "date" },
        { key: "collected", label: "Collected", type: "currency" },
        { key: "outstanding", label: "Uncollected", type: "currency" },
        { key: "overdueDays", label: "Days overdue", type: "number" },
        { key: "status", label: "Status" },
      ],
      rows,
      totals: {
        expectedAmount: rows.reduce((a, r) => a + r.expectedAmount, 0),
        collected: rows.reduce((a, r) => a + r.collected, 0),
        outstanding: rows.reduce((a, r) => a + r.outstanding, 0),
      },
    };
  }

  if (key === "application") {
    const rows = deposits.flatMap((d) =>
      d.txns
        .filter((t) => t.txnType === "application")
        .map((t) => ({
          reference: d.deposit.reference,
          txnRef: t.reference,
          date: t.occurredAt,
          tenant: d.tenant?.name ?? "—",
          property: `${d.property?.name ?? "—"} · ${d.unit?.label ?? "—"}`,
          type: depositTypeLabel(d.deposit.depositType),
          purpose: (t.purpose ?? "—").replaceAll("_", " "),
          amount: Math.abs(t.signedAmountCents),
          invoice: t.invoiceId ?? "—",
          remaining: d.balances.principalOutstandingCents,
          status: statusLabel(d.deposit.status),
        })),
    );
    return {
      key,
      title: "Deposit application report",
      description: "Deposits applied to permitted purposes, the associated rental periods or charges, and remaining balances.",
      columns: [
        { key: "date", label: "Date", type: "date" },
        { key: "reference", label: "Deposit ref" },
        { key: "txnRef", label: "Ledger ref" },
        { key: "tenant", label: "Tenant" },
        { key: "property", label: "Property · unit" },
        { key: "type", label: "Type" },
        { key: "purpose", label: "Purpose" },
        { key: "invoice", label: "Linked record" },
        { key: "amount", label: "Applied", type: "currency" },
        { key: "remaining", label: "Remaining held", type: "currency" },
      ],
      rows,
      totals: { amount: rows.reduce((a, r) => a + r.amount, 0), remaining: rows.reduce((a, r) => a + r.remaining, 0) },
    };
  }

  if (key === "refund") {
    const rows = module.refunds
      .filter((r) => Boolean(r.deposit && depositById.has(r.deposit.deposit.id)))
      .map((r) => {
        const deposit = r.deposit;
        const paid = r.status === "completed" ? (r.approvedPrincipalCents ?? 0) + (r.approvedInterestCents ?? 0) : 0;
        const approved = (r.approvedPrincipalCents ?? 0) + (r.approvedInterestCents ?? 0);
        return {
          reference: r.reference,
          deposit: deposit?.deposit.reference ?? "—",
          tenant: deposit?.tenant?.name ?? "—",
          property: `${deposit?.property?.name ?? "—"} · ${deposit?.unit?.label ?? "—"}`,
          type: deposit ? depositTypeLabel(deposit.deposit.depositType) : "—",
          requestedAt: r.requestedAt,
          requested: r.requestedPrincipalCents + r.requestedInterestCents,
          approved,
          paid,
          outstanding: r.status === "completed" ? 0 : approved || r.requestedPrincipalCents + r.requestedInterestCents,
          method: r.method.toUpperCase(),
          status: REFUND_STATUS_LABELS[r.status] ?? r.status,
          due: r.dueDate ?? "",
          completed: r.completedAt ? r.completedAt.toISOString().slice(0, 10) : "",
          days: r.completedAt ? diffDays(r.requestedAt, r.completedAt.toISOString().slice(0, 10)) : diffDays(r.requestedAt, today),
        };
      });
    return {
      key,
      title: "Deposit refund report",
      description: "Refund requests, approved amounts, completed refunds, outstanding refunds and processing time (days).",
      columns: [
        { key: "reference", label: "Refund ref" },
        { key: "deposit", label: "Deposit ref" },
        { key: "tenant", label: "Tenant" },
        { key: "property", label: "Property · unit" },
        { key: "type", label: "Type" },
        { key: "requestedAt", label: "Requested", type: "date" },
        { key: "requested", label: "Requested", type: "currency" },
        { key: "approved", label: "Approved", type: "currency" },
        { key: "paid", label: "Completed", type: "currency" },
        { key: "outstanding", label: "Outstanding", type: "currency" },
        { key: "method", label: "Method" },
        { key: "status", label: "Status" },
        { key: "completed", label: "Completed date", type: "date" },
        { key: "days", label: "Days", type: "number" },
      ],
      rows,
      totals: {
        requested: rows.reduce((a, r) => a + r.requested, 0),
        approved: rows.reduce((a, r) => a + r.approved, 0),
        paid: rows.reduce((a, r) => a + r.paid, 0),
        outstanding: rows.reduce((a, r) => a + r.outstanding, 0),
      },
    };
  }

  if (key === "interest") {
    const rows = deposits
      .filter((d) => d.deposit.interestApplicable && d.deposit.status !== "cancelled")
      .map((d) => ({
        reference: d.deposit.reference,
        tenant: d.tenant?.name ?? "—",
        property: `${d.property?.name ?? "—"} · ${d.unit?.label ?? "—"}`,
        type: depositTypeLabel(d.deposit.depositType),
        rule: d.rule ? `${(d.rule.interestFrequency ?? "annual")} · ${d.rule.interestMethod}` : "Rule not configured",
        principal: d.balances.principalOutstandingCents,
        period: d.lastAccrualEnd ? `${d.lastAccrualEnd} → ${today}` : d.interestWindowStart,
        rate: d.interestPreview?.blendedRateBps ?? 0,
        accruedPosted: d.balances.interestAccruedCents,
        paid: d.balances.interestPaidCents,
        credited: d.balances.interestCreditedCents,
        outstanding: d.balances.interestOutstandingCents,
        unposted: d.interestPreview?.totalCents ?? 0,
        due: d.interestDueDate ?? "",
        status: d.interestOverdue ? "Overdue" : d.balances.interestOutstandingCents > 0 || (d.interestPreview?.totalCents ?? 0) > 0 ? "Pending" : "Settled",
      }));
    return {
      key,
      title: "Deposit interest report",
      description: "Accrued, paid and credited interest obligations by deposit, with the current unposted accrual estimate. Estimates are not accounting postings.",
      columns: [
        { key: "reference", label: "Deposit ref" },
        { key: "tenant", label: "Tenant" },
        { key: "property", label: "Property · unit" },
        { key: "type", label: "Type" },
        { key: "rule", label: "Interest rule" },
        { key: "principal", label: "Eligible principal", type: "currency" },
        { key: "period", label: "Period" },
        { key: "rate", label: "Blended rate", type: "percent" },
        { key: "accruedPosted", label: "Accrued (posted)", type: "currency" },
        { key: "paid", label: "Paid", type: "currency" },
        { key: "credited", label: "Credited", type: "currency" },
        { key: "outstanding", label: "Outstanding", type: "currency" },
        { key: "unposted", label: "Unposted estimate", type: "currency" },
        { key: "due", label: "Next due", type: "date" },
        { key: "status", label: "Status" },
      ],
      rows,
      totals: {
        principal: rows.reduce((a, r) => a + r.principal, 0),
        accruedPosted: rows.reduce((a, r) => a + r.accruedPosted, 0),
        paid: rows.reduce((a, r) => a + r.paid, 0),
        credited: rows.reduce((a, r) => a + r.credited, 0),
        outstanding: rows.reduce((a, r) => a + r.outstanding, 0),
        unposted: rows.reduce((a, r) => a + r.unposted, 0),
      },
      note: "Aging is measured against the specific interest obligation due date — a long-held deposit is not automatically overdue.",
    };
  }

  if (key === "aging") {
    const rows = deposits
      .filter(active)
      .flatMap((d) => {
        const out: Record<string, string | number>[] = [];
        const exposure = (obligation: string, amount: number, due: string | null, action: string, href: string) => {
          const age = due ? diffDays(due, today) : 0;
          const bucket = !due ? "No due date" : age <= 0 ? "Not yet due" : age <= 30 ? "1–30 days" : age <= 60 ? "31–60 days" : age <= 90 ? "61–90 days" : "90+ days";
          out.push({
            reference: d.deposit.reference,
            tenant: d.tenant?.name ?? "—",
            property: `${d.property?.name ?? "—"} · ${d.unit?.label ?? "—"}`,
            type: depositTypeLabel(d.deposit.depositType),
            obligation,
            amount,
            due: due ?? "",
            age: due ? Math.max(0, age) : 0,
            bucket,
            action,
            href,
            status: statusLabel(d.deposit.status),
          });
        };
        if (d.balances.uncollectedCents > 0 && d.deposit.status !== "expected") {
          exposure("Partially collected", d.balances.uncollectedCents, d.deposit.expectedDate, "Collect remaining amount", `/deposits/collection?deposit=${d.deposit.id}`);
        } else if (d.balances.uncollectedCents > 0) {
          exposure("Deposit expected", d.balances.uncollectedCents, d.deposit.expectedDate, "Record collection", `/deposits/collection?deposit=${d.deposit.id}`);
        }
        if (d.openRefund) {
          exposure("Refund outstanding", (d.openRefund.approvedPrincipalCents ?? d.openRefund.requestedPrincipalCents) + (d.openRefund.approvedInterestCents ?? d.openRefund.requestedInterestCents), d.openRefund.dueDate ?? d.openRefund.requestedAt, d.openRefund.status === "requested" ? "Approve refund" : "Process refund", `/deposits/refunds?deposit=${d.deposit.id}`);
        }
        if (d.balances.interestOutstandingCents > 0) {
          exposure("Interest payable", d.balances.interestOutstandingCents, d.interestDueDate, "Pay or credit interest", `/deposits/interest?deposit=${d.deposit.id}`);
        }
        if (d.deposit.depositType === "last_month_rent" && d.balances.principalOutstandingCents > 0 && d.lease && diffDays(today, d.lease.endDate) <= 60 && !d.openRefund) {
          exposure("Ready for final-period application", d.balances.principalOutstandingCents, d.lease.endDate, "Apply to final period", `/deposits/application?deposit=${d.deposit.id}`);
        }
        if (d.deposit.depositType === "key_fob" && d.devices.some((dev) => dev.quantityReturned < dev.quantityIssued)) {
          exposure("Access devices outstanding", d.balances.principalOutstandingCents, null, "Record device return", `/deposits/${d.deposit.id}`);
        }
        if (out.length === 0 && d.balances.principalOutstandingCents > 0) {
          exposure("Held — no action due (informational)", d.balances.principalOutstandingCents, null, "Monitor", `/deposits/${d.deposit.id}`);
        }
        return out;
      });
    return {
      key,
      title: "Deposit aging report",
      description: "Deposits awaiting collection, refund, application, device return or interest settlement, grouped by the relevant obligation due date. Held deposits with no due obligation are shown as informational and are not classified overdue.",
      columns: [
        { key: "reference", label: "Deposit ref" },
        { key: "tenant", label: "Tenant" },
        { key: "property", label: "Property · unit" },
        { key: "type", label: "Type" },
        { key: "obligation", label: "Open obligation" },
        { key: "amount", label: "Amount", type: "currency" },
        { key: "due", label: "Obligation date", type: "date" },
        { key: "age", label: "Age (days)", type: "number" },
        { key: "bucket", label: "Aging bucket" },
        { key: "action", label: "Action" },
      ],
      rows,
      totals: { amount: rows.reduce((a, r) => a + Number(r.amount), 0) },
    };
  }

  if (key === "reconciliation") {
    const rows = module.reconciliations.map((r) => ({
      reference: r.reference,
      deposit: r.depositReference,
      tenant: r.deposit?.tenant?.name ?? "—",
      txnDate: r.txnDate,
      txnRef: r.txnRef,
      accountingRef: r.accountingRef,
      source: r.source.toUpperCase(),
      amount: r.amountCents,
      difference: r.differenceCents,
      reason: r.reason ?? "—",
      reviewer: r.reviewer?.name ?? "Unassigned",
      status: RECONCILIATION_STATUS_LABELS[r.status] ?? r.status,
    }));
    return {
      key,
      title: "Deposit reconciliation report",
      description: "Subledger, general ledger and bank/trust balances with unmatched transactions and unresolved differences. Balances are related but may legitimately differ.",
      columns: [
        { key: "reference", label: "Item ref" },
        { key: "deposit", label: "Deposit ref" },
        { key: "tenant", label: "Tenant" },
        { key: "txnDate", label: "Txn date", type: "date" },
        { key: "txnRef", label: "Ledger ref" },
        { key: "accountingRef", label: "Accounting ref" },
        { key: "source", label: "Source" },
        { key: "amount", label: "Amount", type: "currency" },
        { key: "difference", label: "Difference", type: "currency" },
        { key: "reason", label: "Reason" },
        { key: "reviewer", label: "Reviewer" },
        { key: "status", label: "Status" },
      ],
      rows,
      totals: {
        amount: rows.reduce((a, r) => a + r.amount, 0),
        difference: rows.reduce((a, r) => a + Math.abs(r.difference), 0),
      },
    };
  }

  const rows = module.audit
    .filter((a) => a.entityType === "deposit" || a.entityType === "reconciliation" || a.entityType === "deposit_rule" || a.entityType === "interest_rate")
    .slice(0, 200)
    .map((a) => ({
      timestamp: a.createdAt.toISOString().slice(0, 16).replace("T", " "),
      deposit: a.entityType === "deposit" ? depositById.get(a.entityId)?.deposit.reference ?? a.entityId : "—",
      action: a.action,
      user: a.userId.replace("staff-", ""),
      previous: a.previousValue ? JSON.stringify(a.previousValue).slice(0, 90) : "—",
      current: a.newValue ? JSON.stringify(a.newValue).slice(0, 90) : "—",
      reason: a.reason ?? "—",
      approval: a.approvalRef ?? "—",
      related: a.relatedRef ?? "—",
    }));
  return {
    key: "audit",
    title: "Deposit transaction audit report",
    description: "Deposit creation, collections, applications, refunds, interest, adjustments, approvals and reversals with user, values and references.",
    columns: [
      { key: "timestamp", label: "Timestamp" },
      { key: "deposit", label: "Deposit" },
      { key: "action", label: "Action" },
      { key: "user", label: "User" },
      { key: "previous", label: "Previous value" },
      { key: "current", label: "New value" },
      { key: "reason", label: "Reason" },
      { key: "approval", label: "Approval / journal" },
      { key: "related", label: "Related ref" },
    ],
    rows,
  };
}
