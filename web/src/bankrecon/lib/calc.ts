import { Adjustment, BankTransaction, BookTransaction, Reconciliation, ReconStatus, StoreState } from "./types";
import { r2 } from "./format";

export interface ReconCalc {
  statementEndingBalance: number;
  statementOpeningBalance: number;
  bookBalance: number;
  matchedBankCount: number;
  matchedBookCount: number;
  matchedAmount: number;
  unmatchedBank: BankTransaction[];
  unmatchedBook: BookTransaction[];
  depositsInTransit: BookTransaction[];
  outstandingPayments: BookTransaction[];
  depositsInTransitAmount: number;
  outstandingPaymentsAmount: number;
  bankAdjustments: Adjustment[];
  bookAdjustments: Adjustment[];
  bankAdjustmentTotal: number;
  bookAdjustmentTotal: number;
  adjustedBank: number;
  adjustedBook: number;
  remainingDifference: number;
  isBalanced: boolean;
  hasUnresolvedBankItems: boolean;
  hasUnresolvedBookItems: boolean;
  canFinalize: boolean;
  suggestedStatus: ReconStatus;
  openCount: number;
}

export function withinPeriod(dateStr: string, start: string, end: string): boolean {
  const d = new Date(dateStr + "T00:00:00").getTime();
  return d >= new Date(start + "T00:00:00").getTime() && d <= new Date(end + "T00:00:00").getTime();
}

export function computeRecon(state: StoreState, recon: Reconciliation): ReconCalc {
  const account = state.accounts.find((a) => a.id === recon.accountId);
  const precision = Math.pow(10, -state.settings.currencyPrecision);
  const epsilon = precision / 2;

  const bankTxs = state.bankTxs.filter((t) => t.accountId === recon.accountId && withinPeriod(t.date, recon.periodStart, recon.periodEnd));
  const bookAll = state.bookTxs.filter((t) => t.accountId === recon.accountId && new Date(t.date + "T00:00:00").getTime() <= new Date(recon.periodEnd + "T00:00:00").getTime());
  const bookInPeriod = bookAll.filter((t) => withinPeriod(t.date, recon.periodStart, recon.periodEnd));

  const activeMatches = state.matches.filter((m) => m.reconciliationId === recon.id && m.active);
  const matchedBankIds = new Set<string>();
  const matchedBookIds = new Set<string>();
  let matchedAmount = 0;
  for (const m of activeMatches) {
    for (const id of m.bankTxIds) {
      matchedBankIds.add(id);
      matchedAmount += state.bankTxs.find((t) => t.id === id)?.signedAmount ?? 0;
    }
    for (const id of m.bookTxIds) matchedBookIds.add(id);
  }
  matchedAmount = r2(matchedAmount);

  const unmatchedBank = bankTxs.filter((t) => !matchedBankIds.has(t.id));
  const unmatchedBook = bookInPeriod.filter((t) => !matchedBookIds.has(t.id));

  // Timing differences: unmatched book inflows are deposits in transit,
  // unmatched book outflows are outstanding payments (legitimate timing, not errors).
  const depositsInTransit = unmatchedBook.filter((t) => t.moneyIn > 0);
  const outstandingPayments = unmatchedBook.filter((t) => t.moneyOut > 0);
  const depositsInTransitAmount = r2(depositsInTransit.reduce((a, t) => a + t.moneyIn, 0));
  const outstandingPaymentsAmount = r2(outstandingPayments.reduce((a, t) => a + t.moneyOut, 0));

  const bookBalance = r2((account?.openingBalance ?? 0) + bookAll.reduce((a, t) => a + t.signedAmount, 0));

  const bankAdjustments = state.adjustments.filter((a) => a.reconciliationId === recon.id && a.side === "bank");
  const bookAdjustments = state.adjustments.filter((a) => a.reconciliationId === recon.id && a.side === "book");
  const bankAdjustmentTotal = r2(bankAdjustments.reduce((a, t) => a + t.amount, 0));
  const bookAdjustmentTotal = r2(bookAdjustments.reduce((a, t) => a + t.amount, 0));

  const adjustedBank = r2(recon.statementEndingBalance + depositsInTransitAmount - outstandingPaymentsAmount + bankAdjustmentTotal);
  const adjustedBook = r2(bookBalance + bookAdjustmentTotal);
  const remainingDifference = r2(adjustedBank - adjustedBook);

  const isBalanced = Math.abs(remainingDifference) <= epsilon;
  const hasUnresolvedBankItems = unmatchedBank.length > 0;
  const hasUnresolvedBookItems = unmatchedBook.length > 0;
  const canFinalize =
    recon.status !== "Reconciled" &&
    recon.status !== "Cancelled" &&
    isBalanced &&
    !hasUnresolvedBankItems &&
    state.adjustments.filter((a) => a.reconciliationId === recon.id && !a.approved).length === 0;

  let suggestedStatus: ReconStatus;
  if (recon.status === "Reconciled" || recon.status === "Cancelled") {
    suggestedStatus = recon.status;
  } else if (canFinalize) {
    suggestedStatus = "Ready to Finalize";
  } else if (hasUnresolvedBankItems || !isBalanced) {
    suggestedStatus = "Needs Review";
  } else {
    suggestedStatus = "In Progress";
  }

  return {
    statementEndingBalance: recon.statementEndingBalance,
    statementOpeningBalance: recon.statementOpeningBalance,
    bookBalance,
    matchedBankCount: matchedBankIds.size,
    matchedBookCount: matchedBookIds.size,
    matchedAmount,
    unmatchedBank,
    unmatchedBook,
    depositsInTransit,
    outstandingPayments,
    depositsInTransitAmount,
    outstandingPaymentsAmount,
    bankAdjustments,
    bookAdjustments,
    bankAdjustmentTotal,
    bookAdjustmentTotal,
    adjustedBank,
    adjustedBook,
    remainingDifference,
    isBalanced,
    hasUnresolvedBankItems,
    hasUnresolvedBookItems,
    canFinalize,
    suggestedStatus,
    openCount: unmatchedBank.length + unmatchedBook.length,
  };
}

export interface ReconTotals {
  totalAccounts: number;
  activeAccounts: number;
  accountsNeedingRecon: number;
  inProgress: number;
  completed: number;
  unmatchedBankTxs: number;
  unmatchedBookTxs: number;
  unresolvedDifferences: number;
  overdue: number;
}

export function computeDashboardTotals(state: StoreState): ReconTotals {
  const today = new Date().toISOString().slice(0, 10);
  const calcs = state.reconciliations
    .filter((r) => r.status !== "Cancelled")
    .map((r) => ({ recon: r, calc: computeRecon(state, r) }));

  const activeByAccount = new Map<string, Reconciliation>();
  for (const { recon } of calcs) {
    if (recon.status === "Reconciled") continue;
    const existing = activeByAccount.get(recon.accountId);
    if (!existing || recon.periodStart > existing.periodStart) activeByAccount.set(recon.accountId, recon);
  }

  const isActiveStatus = (s: ReconStatus) =>
    ["In Progress", "Needs Review", "Ready to Finalize", "Reopened"].includes(s);

  const inProgress = state.reconciliations.filter((r) => isActiveStatus(r.status)).length;

  const accountsNeedingRecon = state.accounts
    .filter((a) => a.active)
    .filter((a) => {
      // account needs reconciliation if it has an active (non-reconciled) reconciliation
      const cur = activeByAccount.get(a.id);
      if (cur) return true;
      // overdue check: latest completed period older than previous month
      const latest = state.reconciliations.filter((r) => r.accountId === a.id).sort((x, y) => y.periodEnd.localeCompare(x.periodEnd))[0];
      if (!latest || latest.status !== "Reconciled") return true;
      const expected = new Date();
      expected.setMonth(expected.getMonth() - 1);
      return latest.periodEnd < expected.toISOString().slice(0, 10);
    }).length;

  return {
    totalAccounts: state.accounts.length,
    activeAccounts: state.accounts.filter((a) => a.active).length,
    accountsNeedingRecon,
    inProgress,
    completed: state.reconciliations.filter((r) => r.status === "Reconciled").length,
    unmatchedBankTxs: calcs.reduce((a, { calc }) => a + calc.unmatchedBank.length, 0),
    unmatchedBookTxs: calcs.reduce((a, { calc }) => a + calc.unmatchedBook.length, 0),
    unresolvedDifferences: calcs.filter(({ calc }) => !calc.isBalanced || calc.hasUnresolvedBankItems).length,
    overdue: state.reconciliations.filter((r) => r.status !== "Reconciled" && r.status !== "Cancelled" && r.periodEnd < today).length,
  };
}

// --- Trust / deposit liability safeguards ---
export interface DepositLiabilityCheck {
  bankMovement: number;
  bookMovement: number;
  difference: number;
  inBalance: boolean;
  detail: { tenant: string; bank: number; book: number }[];
}

export function depositLiabilityCheck(state: StoreState, recon: Reconciliation): DepositLiabilityCheck {
  const bankDepositTxs = state.bankTxs.filter(
    (t) => t.accountId === recon.accountId && withinPeriod(t.date, recon.periodStart, recon.periodEnd) &&
      /deposit|refund|return/i.test(t.description),
  );
  const bookDepositTxs = state.bookTxs.filter(
    (t) => t.accountId === recon.accountId && withinPeriod(t.date, recon.periodStart, recon.periodEnd) &&
      (t.type === "tenant_deposit" || t.type === "deposit_refund"),
  );
  const bankMovement = r2(bankDepositTxs.reduce((a, t) => a + t.signedAmount, 0));
  const bookMovement = r2(bookDepositTxs.reduce((a, t) => a + t.signedAmount, 0));
  return {
    bankMovement,
    bookMovement,
    difference: r2(bankMovement - bookMovement),
    inBalance: Math.abs(bankMovement - bookMovement) < 0.005,
    detail: [],
  };
}

export function outstandingItemsAging(book: BookTransaction): number {
  return Math.max(0, Math.round((Date.now() - new Date(book.date + "T00:00:00").getTime()) / 86400000));
}
