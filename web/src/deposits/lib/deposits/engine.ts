import { addDaysISO, diffDays, maxISO, minISO, parseISO, toISO } from "../dates";
import { rentMultipleCents, roundHalfUp } from "../money";
import type { DepositStatus, DepositType } from "./domain";

export type RuleLike = {
  id: string;
  jurisdiction: string;
  leaseType: string;
  depositType: string;
  collectionPermitted: boolean;
  maxAmountCents: number | null;
  maxMultipleOfRentBps: number | null;
  calculationMethod: string;
  refundConditions: string;
  interestApplicable: boolean;
  interestMethod: string;
  interestFrequency: string;
  applicationPurposes: string[];
  requiredDocuments: string[];
  approvalRequired: boolean;
  refundApprovalRequired: boolean;
  roundingMode: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  validationMessage: string;
  legalReference: string;
  notes: string | null;
};

export type RateLike = {
  id: string;
  annualRateBps: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  source: string;
};

export type TxnLike = {
  id: string;
  txnType: string;
  classification: string;
  signedAmountCents: number;
  occurredAt: string;
  periodStart?: string | null;
  periodEnd?: string | null;
  rateBps?: number | null;
  status?: string;
};

export type DepositBalances = {
  requiredCents: number;
  receivedCents: number;
  appliedCents: number;
  refundedCents: number;
  adjustmentsCents: number;
  reversalsCents: number;
  principalOutstandingCents: number;
  uncollectedCents: number;
  interestAccruedCents: number;
  interestPaidCents: number;
  interestCreditedCents: number;
  interestReversedCents: number;
  interestOutstandingCents: number;
  totalRemainingCents: number;
  hasInterestActivity: boolean;
};

const COLLECTION_TYPES = new Set(["collection", "partial_collection"]);

export function computeBalances(requiredCents: number, txns: TxnLike[]): DepositBalances {
  let received = 0;
  let applied = 0;
  let refunded = 0;
  let adjustments = 0;
  let reversals = 0;
  let interestAccrued = 0;
  let interestPaid = 0;
  let interestCredited = 0;
  let interestReversed = 0;

  for (const t of txns) {
    if ((t.status ?? "posted") !== "posted") continue;
    if (t.classification === "principal") {
      if (COLLECTION_TYPES.has(t.txnType)) received += t.signedAmountCents;
      else if (t.txnType === "application") applied -= t.signedAmountCents;
      else if (t.txnType === "refund_payment") refunded -= t.signedAmountCents;
      else if (t.txnType === "adjustment") adjustments += t.signedAmountCents;
      else if (t.txnType === "reversal") reversals += t.signedAmountCents;
    } else if (t.classification === "interest") {
      if (t.txnType === "interest_accrual") interestAccrued += t.signedAmountCents;
      else if (t.txnType === "interest_payment") interestPaid -= t.signedAmountCents;
      else if (t.txnType === "interest_credit") interestCredited -= t.signedAmountCents;
      else if (t.txnType === "reversal" || t.txnType === "adjustment") interestReversed += t.signedAmountCents;
    }
  }

  const principalOutstanding = received + adjustments + reversals - applied - refunded;
  const interestOutstanding = interestAccrued + interestReversed - interestPaid - interestCredited;

  return {
    requiredCents,
    receivedCents: received,
    appliedCents: applied,
    refundedCents: refunded,
    adjustmentsCents: adjustments,
    reversalsCents: reversals,
    principalOutstandingCents: principalOutstanding,
    uncollectedCents: Math.max(0, requiredCents - received),
    interestAccruedCents: interestAccrued,
    interestPaidCents: interestPaid,
    interestCreditedCents: interestCredited,
    interestReversedCents: interestReversed,
    interestOutstandingCents: interestOutstanding,
    totalRemainingCents: principalOutstanding + interestOutstanding,
    hasInterestActivity: interestAccrued !== 0 || interestPaid !== 0 || interestCredited !== 0,
  };
}

/* ------------------------------ Rule resolution ------------------------------ */

export function getApplicableRule(
  rules: RuleLike[],
  ctx: { jurisdiction: string; leaseType: string; depositType: string; asOf: string },
): RuleLike | null {
  const candidates = rules
    .filter(
      (r) =>
        r.jurisdiction === ctx.jurisdiction &&
        r.leaseType === ctx.leaseType &&
        r.depositType === ctx.depositType &&
        r.effectiveFrom <= ctx.asOf &&
        (!r.effectiveTo || r.effectiveTo >= ctx.asOf),
    )
    .sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? 1 : -1));
  return candidates[0] ?? null;
}

export function ruleMaxAmountCents(
  rule: RuleLike | null,
  monthlyRentCents: number | null,
  replacementCostBasisCents: number | null = null,
): number | null {
  if (!rule) return null;
  let max: number | null = rule.maxAmountCents;
  if (rule.maxMultipleOfRentBps && monthlyRentCents) {
    const multiple = rentMultipleCents(monthlyRentCents, rule.maxMultipleOfRentBps);
    max = max == null ? multiple : Math.min(max, multiple);
  }
  if (rule.calculationMethod === "replacement_cost" && replacementCostBasisCents != null) {
    max = max == null ? replacementCostBasisCents : Math.min(max, replacementCostBasisCents);
  }
  return max;
}

export function describeRuleLimit(rule: RuleLike | null, maxCents: number | null): string {
  if (!rule) return "No applicable rule configured";
  if (rule.maxMultipleOfRentBps) return `Maximum ${(rule.maxMultipleOfRentBps / 100).toFixed(2)}× monthly rent`;
  if (rule.calculationMethod === "replacement_cost") return "Maximum equals documented replacement cost";
  if (maxCents != null) return `Maximum ${(maxCents / 100).toLocaleString("en-CA", { style: "currency", currency: "CAD" })}`;
  return "No fixed maximum in the applicable rule";
}

/* -------------------------------- Interest -------------------------------- */

export type InterestSegment = {
  start: string;
  end: string;
  days: number;
  eligiblePrincipalCents: number;
  annualRateBps: number;
  interestCents: number;
  rateSource: string;
};

export type InterestPreview = {
  periodStart: string;
  periodEnd: string;
  segments: InterestSegment[];
  totalCents: number;
  eligiblePrincipalCents: number;
  blendedRateBps: number;
  dayCount: number;
  missingRate: boolean;
};

function rateForDate(rates: RateLike[], date: string): RateLike | null {
  const candidates = rates
    .filter((r) => r.effectiveFrom <= date && (!r.effectiveTo || r.effectiveTo >= date))
    .sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? 1 : -1));
  return candidates[0] ?? null;
}

/**
 * Simple interest, actual/365, no compounding, calculated in segments whenever
 * the effective annual rate or the eligible principal changes.
 * Interest accrues on principal held (collected, not yet applied or refunded).
 */
export function calculateInterest(args: {
  periodStart: string;
  periodEnd: string;
  principalEvents: { date: string; signedAmountCents: number }[];
  rates: RateLike[];
  openingPrincipalCents?: number;
}): InterestPreview {
  const { periodStart, periodEnd, principalEvents, rates } = args;
  const start = periodStart;
  const end = periodEnd;
  if (end <= start) {
    return {
      periodStart: start,
      periodEnd: end,
      segments: [],
      totalCents: 0,
      eligiblePrincipalCents: 0,
      blendedRateBps: 0,
      dayCount: 0,
      missingRate: false,
    };
  }

  const boundaries = new Set<string>([start, end]);
  for (const r of rates) {
    if (r.effectiveFrom > start && r.effectiveFrom < end) boundaries.add(r.effectiveFrom);
  }
  for (const e of principalEvents) {
    if (e.date > start && e.date < end) boundaries.add(e.date);
  }
  const points = Array.from(boundaries).sort();
  const opening =
    args.openingPrincipalCents ??
    principalEvents.filter((e) => e.date <= start).reduce((acc, e) => acc + e.signedAmountCents, 0);

  const segments: InterestSegment[] = [];
  let runningPrincipal = opening;
  let total = 0;
  let missingRate = false;

  for (let i = 0; i < points.length - 1; i += 1) {
    const segStart = points[i];
    const segEnd = points[i + 1];
    const days = diffDays(segStart, segEnd);
    if (days <= 0) continue;
    // apply principal events that happen on the segment start date
    for (const e of principalEvents.filter((ev) => ev.date === segStart)) {
      runningPrincipal += e.signedAmountCents;
    }
    const rate = rateForDate(rates, segStart);
    if (!rate) {
      missingRate = true;
      continue;
    }
    const eligible = Math.max(0, runningPrincipal);
    const interest = roundHalfUp((eligible * rate.annualRateBps * days) / (10_000 * 365));
    total += interest;
    segments.push({
      start: segStart,
      end: segEnd,
      days,
      eligiblePrincipalCents: eligible,
      annualRateBps: rate.annualRateBps,
      interestCents: interest,
      rateSource: rate.source,
    });
  }

  const dayCount = segments.reduce((acc, s) => acc + s.days, 0);
  const weighted = segments.reduce((acc, s) => acc + s.annualRateBps * s.days, 0);
  const blendedRateBps = dayCount ? Math.round(weighted / dayCount) : 0;
  const eligiblePrincipalCents = segments.length
    ? Math.max(...segments.map((s) => s.eligiblePrincipalCents))
    : Math.max(0, opening);

  return {
    periodStart: start,
    periodEnd: end,
    segments,
    totalCents: total,
    eligiblePrincipalCents,
    blendedRateBps,
    dayCount,
    missingRate,
  };
}

export function principalEventStream(txns: TxnLike[]): { date: string; signedAmountCents: number }[] {
  return txns
    .filter((t) => t.classification === "principal" && (t.status ?? "posted") === "posted")
    .map((t) => ({ date: t.occurredAt, signedAmountCents: t.signedAmountCents }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

export function interestAccrualWindow(args: {
  txns: TxnLike[];
  interestStart: string;
  asOf: string;
}): { start: string; end: string; lastAccrualEnd: string | null } {
  const accruals = args.txns.filter((t) => t.txnType === "interest_accrual");
  const lastAccrualEnd = accruals.reduce<string | null>((acc, t) => maxISO(acc, t.periodEnd ?? t.occurredAt), null);
  const start = maxISO(args.interestStart, lastAccrualEnd) ?? args.interestStart;
  return { start, end: args.asOf, lastAccrualEnd };
}

/* ------------------------------ Status engine ------------------------------ */

export function deriveStatus(args: {
  current: DepositStatus;
  balances: DepositBalances;
  openRefundStatus?: string | null;
  hasUncollected?: boolean;
  allApplied?: boolean;
}): DepositStatus {
  const { current, balances, openRefundStatus } = args;
  if (["draft", "cancelled", "closed", "transferred"].includes(current)) return current;
  if (openRefundStatus === "requested") return "refund_requested";
  if (openRefundStatus === "approved" || openRefundStatus === "processing") return "refund_pending";
  if (balances.receivedCents <= 0) return "expected";
  if (balances.uncollectedCents > 0) return current === "partially_received" ? "partially_received" : "partially_received";
  const outstanding = balances.principalOutstandingCents;
  if (outstanding <= 0) {
    if (balances.refundedCents > 0) return "refunded";
    return "applied";
  }
  if (balances.refundedCents > 0) return "partially_refunded";
  if (balances.appliedCents > 0) return "partially_applied";
  return "held";
}

export function isTransitionPermitted(
  transitions: Record<string, DepositStatus[]>,
  from: string,
  to: string,
): boolean {
  return (transitions[from] ?? []).includes(to as DepositStatus);
}

/* ------------------------------ Validation ------------------------------ */

export type Validation = { errors: string[]; warnings: string[]; ok: boolean };

function build(errors: string[], warnings: string[]): Validation {
  return { errors, warnings, ok: errors.length === 0 };
}

export type CollectionInput = {
  rule: RuleLike | null;
  leaseMonthlyRentCents: number;
  balances: DepositBalances;
  status: string;
  amountCents: number;
  asOf: string;
  replacementCostBasisCents?: number | null;
  hasAccountMapping: boolean;
  linkedPaymentAmountCents?: number | null;
  linkedPaymentAlreadyUsed?: boolean;
};

export function validateCollection(input: CollectionInput): Validation & { maxCents: number | null } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const rule = input.rule;
  const maxCents = ruleMaxAmountCents(rule, input.leaseMonthlyRentCents, input.replacementCostBasisCents ?? null);

  if (!rule) {
    errors.push(
      "No deposit rule is configured for this jurisdiction, lease type and deposit type as of the expected date. Configure the rule before collecting funds.",
    );
  } else if (!rule.collectionPermitted) {
    errors.push(rule.validationMessage || "Collection of this deposit type is not permitted by the applicable rules.");
  }
  if (["draft", "cancelled", "closed", "transferred"].includes(input.status)) {
    errors.push(`Deposits in ${input.status} status cannot accept a collection.`);
  }
  if (!Number.isFinite(input.amountCents) || input.amountCents <= 0) {
    errors.push("Enter a collection amount greater than zero.");
  }
  const projected = input.balances.receivedCents + input.amountCents;
  if (maxCents != null && projected > maxCents) {
    errors.push(
      `The total collected amount would exceed the permitted maximum of ${(maxCents / 100).toLocaleString("en-CA", {
        style: "currency",
        currency: "CAD",
      })}. A documented authorized adjustment is required.`,
    );
  }
  if (input.linkedPaymentAlreadyUsed) {
    errors.push("That payment is already linked to another deposit transaction. Deposit payments cannot be reused.");
  }
  if (input.linkedPaymentAmountCents != null && input.linkedPaymentAmountCents !== input.amountCents) {
    errors.push("The linked payment amount must equal the collection amount. Split the payment first in the Payments module.");
  }
  if (!input.hasAccountMapping) {
    errors.push("The deposit liability and bank/cash account mappings must be configured before posting.");
  }
  if (input.amountCents < input.balances.uncollectedCents) {
    warnings.push("This is a partial collection. The remaining expected amount will stay open.");
  }
  if (rule?.depositType === "last_month_rent" && input.amountCents > input.leaseMonthlyRentCents) {
    warnings.push("Collection is above one month's rent. Verify the lawful rent at the time of collection.");
  }
  if (rule?.depositType === "key_fob" && maxCents == null) {
    warnings.push("No documented replacement cost basis is on file; the deposit must not exceed the reasonable expected replacement cost.");
  }
  return { ...build(errors, warnings), maxCents };
}

export type ApplicationInput = {
  rule: RuleLike | null;
  status: string;
  balances: DepositBalances;
  amountCents: number;
  purpose: string;
  leaseMonthlyRentCents: number;
  invoice?: {
    id: string;
    amountCents: number;
    status: string;
    periodStart: string;
    periodEnd: string;
    isFinalPeriod: boolean;
    belongsToLease: boolean;
  } | null;
  leaseEndDate: string;
  asOf: string;
  approvalRef?: string | null;
  hasAccountMapping: boolean;
  alreadyAppliedToRecord?: boolean;
};

export function validateApplication(input: ApplicationInput): Validation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const rule = input.rule;

  if (!rule) {
    errors.push("No effective deposit rule is configured for this deposit as of today. Application cannot be posted.");
    return build(errors, warnings);
  }
  if (!rule.collectionPermitted) {
    errors.push(rule.validationMessage);
  }
  if (rule.applicationPurposes.length === 0) {
    errors.push("The applicable rule does not permit this deposit type to be applied to any charge.");
  }
  if (!rule.applicationPurposes.includes(input.purpose)) {
    errors.push(
      `The purpose "${input.purpose.replaceAll("_", " ")}" is not permitted for ${rule.legalReference}. Choose a permitted application purpose.`,
    );
  }
  if (["draft", "expected", "cancelled", "closed", "transferred"].includes(input.status)) {
    errors.push(`A deposit in ${input.status} status cannot be applied.`);
  }
  if (input.status === "refund_requested" || input.status === "refund_pending") {
    errors.push("This deposit has an open refund request. Resolve the refund before posting an application.");
  }
  if (!Number.isFinite(input.amountCents) || input.amountCents <= 0) {
    errors.push("Enter an application amount greater than zero.");
  }
  if (input.amountCents > input.balances.principalOutstandingCents) {
    errors.push("The application amount exceeds the principal currently held for this deposit.");
  }
  if (rule.approvalRequired && !input.approvalRef) {
    errors.push("The applicable rule requires an approval reference before posting this application.");
  }
  if (!input.hasAccountMapping) {
    errors.push("Liability and receivable account mappings are required before posting an application.");
  }

  if (input.purpose === "final_rental_period") {
    const invoice = input.invoice;
    if (!invoice) {
      errors.push("Select the rent invoice for the final rental period. The application must be linked to accounts receivable.");
    } else {
      if (!invoice.belongsToLease) errors.push("The selected invoice does not belong to this lease.");
      if (!invoice.isFinalPeriod) {
        errors.push("The selected invoice is not the final rental period of this lease. Last month's rent may only be applied to that period.");
      }
      if (invoice.status !== "open") errors.push("The selected rent invoice is already settled. Duplicate application is not permitted.");
      if (input.amountCents > invoice.amountCents) {
        errors.push("The application cannot exceed the amount of the linked rent invoice.");
      }
    }
    if (input.amountCents > input.leaseMonthlyRentCents) {
      errors.push("Last month's rent application cannot exceed one month's rent for the lease.");
    }
    if (input.asOf < input.leaseEndDate && input.amountCents !== 0) {
      warnings.push(
        "The lease is still active. Ontario last month's rent may be applied to the final rental period only; confirm the notice/termination record.",
      );
    }
  }

  if ((input.purpose === "damage_beyond_normal_wear" || input.purpose === "lawful_arrears") && input.rule?.jurisdiction === "ON" && input.rule.leaseType === "residential") {
    errors.push("Ontario residential tenancies do not permit deposits to be applied to damage or arrears through this workflow.");
  }
  if (input.alreadyAppliedToRecord) {
    errors.push("This obligation already has a deposit application recorded against it.");
  }
  return build(errors, warnings);
}

export type RefundInput = {
  rule: RuleLike | null;
  status: string;
  balances: DepositBalances;
  principalCents: number;
  interestCents: number;
  lease: { endDate: string; status: string; noticeDate?: string | null };
  asOf: string;
  devices?: {
    deviceType: string;
    quantityIssued: number;
    quantityReturned: number;
    replacementCostCents: number;
  }[];
  openRefund?: boolean;
  otherRefundTotalCents?: number;
  hasAccountMapping: boolean;
};

export function keyRefundableCents(
  devices: NonNullable<RefundInput["devices"]>,
  retentionApproved: boolean,
): { refundable: number; permittedRetention: number; outstandingDevices: number } {
  const outstandingDevices = devices.reduce((acc, d) => acc + Math.max(0, d.quantityIssued - d.quantityReturned), 0);
  const permittedRetention = retentionApproved
    ? devices.reduce((acc, d) => acc + Math.max(0, d.quantityIssued - d.quantityReturned) * d.replacementCostCents, 0)
    : 0;
  return { refundable: permittedRetention, permittedRetention, outstandingDevices };
}

export function validateRefund(input: RefundInput): Validation & { maxPrincipalCents: number; maxInterestCents: number } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const rule = input.rule;
  let maxPrincipal = input.balances.principalOutstandingCents;
  const maxInterest = input.balances.interestOutstandingCents;

  if (!rule) {
    errors.push("No effective deposit rule is configured; refund eligibility cannot be determined.");
  } else {
    if (!rule.refundConditions) errors.push("The applicable rule has no configured refund conditions.");
    if (rule.interestApplicable && input.balances.interestOutstandingCents > 0) {
      warnings.push("Outstanding interest exists and should be refunded or credited with the principal.");
    }
  }
  if (["draft", "cancelled", "closed", "transferred"].includes(input.status)) {
    errors.push(`A deposit in ${input.status} status cannot be refunded.`);
  }
  if (input.openRefund) {
    errors.push("An open refund request already exists for this deposit. Duplicate refunds are not permitted.");
  }
  if (!Number.isFinite(input.principalCents) || input.principalCents < 0 || !Number.isFinite(input.interestCents) || input.interestCents < 0) {
    errors.push("Refund amounts must be zero or greater.");
  }
  if (input.principalCents <= 0 && input.interestCents <= 0) {
    errors.push("Enter a principal and/or interest amount to refund.");
  }

  if (rule?.depositType === "key_fob" && input.devices && input.devices.length > 0) {
    const devices = input.devices;
    const outstanding = devices.reduce((acc, d) => acc + Math.max(0, d.quantityIssued - d.quantityReturned), 0);
    if (outstanding > 0) {
      warnings.push(
        `${outstanding} device(s) have not been returned. The full deposit cannot be retained automatically — attach a replacement-cost approval or reduce the refund by the documented replacement cost only.`,
      );
    }
    const replacementCost = devices.reduce((acc, d) => acc + d.replacementCostCents * Math.max(0, d.quantityIssued - d.quantityReturned), 0);
    if (outstanding > 0 && input.principalCents > maxPrincipal) {
      errors.push("The refund exceeds the held balance.");
    }
    if (outstanding > 0 && replacementCost > input.balances.receivedCents) {
      errors.push("Documented replacement cost exceeds the collected deposit; the excess cannot be recovered from this deposit.");
    }
    if (outstanding === 0) {
      maxPrincipal = input.balances.principalOutstandingCents;
    }
  }

  if (rule?.depositType === "last_month_rent") {
    const tenancyEnded = input.lease.status === "ended" || input.lease.endDate < input.asOf;
    const overCollected = Math.max(0, input.balances.receivedCents - input.balances.requiredCents);
    if (!tenancyEnded && overCollected === 0) {
      errors.push(
        "A last month's rent deposit is not refundable while the tenancy continues. Apply it to the final rental period, or refund within the statutory period after termination.",
      );
    }
    if (!tenancyEnded) {
      warnings.push("Refund permitted only for an over-collection or after tenancy termination. Confirm the termination record.");
    }
  }
  if (rule?.depositType === "security_deposit" && input.lease.status !== "ended" && input.asOf < input.lease.endDate) {
    warnings.push("The lease has not ended. Security deposit refunds normally occur after move-out inspection — attach the inspection report.");
  }
  if (input.principalCents > maxPrincipal) {
    errors.push("The requested principal refund exceeds the available refundable principal balance.");
  }
  if (input.interestCents > maxInterest) {
    errors.push("The requested interest refund exceeds the outstanding interest balance.");
  }
  if (!input.hasAccountMapping) {
    errors.push("Bank and liability account mappings are required before a refund can be processed.");
  }
  return { ...build(errors, warnings), maxPrincipalCents: Math.max(0, maxPrincipal), maxInterestCents: maxInterest };
}

export function interestStartDate(args: {
  firstReceivedDate: string | null;
  leaseStartDate: string;
  expectedDate: string;
}): string {
  return args.firstReceivedDate ?? args.leaseStartDate ?? args.expectedDate;
}

/** Utility used by reports and previews to describe the formula in the UI. */
export function balanceFormula(depositType: DepositType): string {
  if (depositType === "last_month_rent") {
    return "Principal held = collected + adjustments − applied to final rental period − refunded. Interest is tracked separately from principal.";
  }
  if (depositType === "key_fob") {
    return "Refundable balance = collected − refunded − documented replacement cost of unreturned devices (never an automatic full retention).";
  }
  return "Principal held = collected + valid adjustments − applied to authorized charges − refunded.";
}

export function clampAsOf(value: string): string {
  return minISO(value, toISO(new Date())) ?? value;
}

export function nextPeriodStart(lastEnd: string | null, fallback: string): string {
  return lastEnd ? addDaysISO(lastEnd, 0) : fallback;
}

export function isPast(dateISO: string, asOf: string): boolean {
  return parseISO(dateISO).getTime() < parseISO(asOf).getTime();
}
