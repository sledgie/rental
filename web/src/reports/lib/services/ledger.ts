import { getDataset, SYS } from "../data";
import type {
  ChartAccount,
  Dataset,
  JournalEntry,
  JournalLine,
  ReportFilters,
} from "../types";
import { round2, sum } from "../utils/currency";
import { inRange } from "../utils/dates";
import { propertyMatches } from "../utils/filters";

export interface EnrichedLine extends JournalLine {
  entry: JournalEntry;
  account: ChartAccount;
}

export function postedEntries(ds: Dataset, filters?: Pick<ReportFilters, "transactionStatus">): JournalEntry[] {
  const status = filters?.transactionStatus ?? "posted";
  if (status === "all") return ds.journalEntries;
  if (status === "draft") return ds.journalEntries.filter((je) => je.status === "draft");
  return ds.journalEntries.filter((je) => je.status === "posted");
}

export function enrichLines(ds: Dataset, entries: JournalEntry[]): EnrichedLine[] {
  const accountMap = new Map(ds.accounts.map((a) => [a.accountId, a]));
  return entries.flatMap((entry) =>
    entry.lines.map((line) => ({
      ...line,
      entry,
      account: accountMap.get(line.accountId)!,
    })),
  );
}

export function filterLines(
  lines: EnrichedLine[],
  filters: ReportFilters,
  options?: { dateField?: "postingDate" | "transactionDate"; requireProperty?: boolean; asOf?: boolean },
): EnrichedLine[] {
  const dateField = options?.dateField ?? "postingDate";
  return lines.filter((line) => {
    const date = line.entry[dateField];
    if (options?.asOf) {
      if (date > filters.asOfDate) return false;
    } else if (!inRange(date, filters.startDate, filters.endDate)) {
      return false;
    }
    if (filters.accountId !== "all" && line.accountId !== filters.accountId) return false;
    if (filters.tenantId !== "all" && line.tenantId !== filters.tenantId) return false;
    if (filters.vendorId !== "all" && line.vendorId !== filters.vendorId) return false;
    if (filters.transactionType !== "all" && line.entry.sourceType !== filters.transactionType) return false;
    if (filters.bankAccountId !== "all") {
      const ds = getDataset();
      const bank = ds.bankAccounts.find((b) => b.bankAccountId === filters.bankAccountId);
      if (bank && line.accountId !== bank.accountId && !(line.accountId === SYS.cash || line.accountId === SYS.trust)) {
        /* keep non-cash lines; bank filter applied by callers that need it */
      }
    }
    if (!propertyMatches(line.propertyId, filters)) {
      if (options?.requireProperty) return false;
      if (filters.propertyId !== "all" || filters.ownerId !== "all") return false;
    }
    return true;
  });
}

export function netForAccount(lines: EnrichedLine[], accountId: string): number {
  const acctLines = lines.filter((l) => l.accountId === accountId);
  const acct = acctLines[0]?.account;
  const debit = sum(acctLines.map((l) => l.debitAmount));
  const credit = sum(acctLines.map((l) => l.creditAmount));
  if (!acct) return round2(debit - credit);
  return acct.normalBalance === "debit" ? round2(debit - credit) : round2(credit - debit);
}

export function signedBalance(account: ChartAccount, debit: number, credit: number): number {
  return account.normalBalance === "debit" ? round2(debit - credit) : round2(credit - debit);
}

export function runningNormal(account: ChartAccount, debit: number, credit: number, prior = 0): number {
  const movement = account.normalBalance === "debit" ? debit - credit : credit - debit;
  return round2(prior + movement);
}

export interface AccountPeriodBalance {
  account: ChartAccount;
  openingDebit: number;
  openingCredit: number;
  periodDebit: number;
  periodCredit: number;
  closingDebit: number;
  closingCredit: number;
  openingNet: number;
  periodNet: number;
  closingNet: number;
}

export function trialBalance(ds: Dataset, filters: ReportFilters): AccountPeriodBalance[] {
  const entries = postedEntries(ds, filters);
  const all = enrichLines(ds, entries).filter((line) => {
    if (filters.tenantId !== "all" && line.tenantId !== filters.tenantId) return false;
    if (filters.vendorId !== "all" && line.vendorId !== filters.vendorId) return false;
    if (filters.propertyId !== "all" || filters.ownerId !== "all") {
      return propertyMatches(line.propertyId, filters);
    }
    return true;
  });
  const posting = ds.accounts.filter((a) => a.isPostingAccount && a.isActive);
  return posting
    .map((account) => {
      if (filters.accountId !== "all" && account.accountId !== filters.accountId) {
        return null;
      }
      const lines = all.filter((l) => l.accountId === account.accountId);
      const opening = lines.filter((l) => l.entry.postingDate < filters.startDate);
      const period = lines.filter((l) => inRange(l.entry.postingDate, filters.startDate, filters.endDate));
      const openingDebit = round2(sum(opening.map((l) => l.debitAmount)));
      const openingCredit = round2(sum(opening.map((l) => l.creditAmount)));
      const periodDebit = round2(sum(period.map((l) => l.debitAmount)));
      const periodCredit = round2(sum(period.map((l) => l.creditAmount)));
      const closeDr = round2(openingDebit + periodDebit);
      const closeCr = round2(openingCredit + periodCredit);
      const openingNetRaw = round2(openingDebit - openingCredit);
      const closingNetRaw = round2(closeDr - closeCr);
      const openingDebitBal = openingNetRaw >= 0 ? openingNetRaw : 0;
      const openingCreditBal = openingNetRaw < 0 ? Math.abs(openingNetRaw) : 0;
      const closingDebitBal = closingNetRaw >= 0 ? closingNetRaw : 0;
      const closingCreditBal = closingNetRaw < 0 ? Math.abs(closingNetRaw) : 0;
      return {
        account,
        openingDebit: openingDebitBal,
        openingCredit: openingCreditBal,
        periodDebit,
        periodCredit,
        closingDebit: closingDebitBal,
        closingCredit: closingCreditBal,
        openingNet: signedBalance(account, openingDebit, openingCredit),
        periodNet: signedBalance(account, periodDebit, periodCredit),
        closingNet: signedBalance(account, closeDr, closeCr),
      };
    })
    .filter((row): row is AccountPeriodBalance => row !== null)
    .filter(
      (row) =>
        row.openingDebit ||
        row.openingCredit ||
        row.periodDebit ||
        row.periodCredit ||
        row.closingDebit ||
        row.closingCredit,
    );
}

export function accountActivity(ds: Dataset, filters: ReportFilters, accountId: string) {
  const account = ds.accounts.find((a) => a.accountId === accountId);
  if (!account) return { account: null, opening: 0, lines: [] as EnrichedLine[], closing: 0 };
  const entries = postedEntries(ds, filters);
  const lines = enrichLines(ds, entries).filter((line) => {
    if (line.accountId !== accountId) return false;
    if (filters.propertyId !== "all" || filters.ownerId !== "all") {
      if (!propertyMatches(line.propertyId, filters)) return false;
    }
    if (filters.tenantId !== "all" && line.tenantId !== filters.tenantId) return false;
    if (filters.vendorId !== "all" && line.vendorId !== filters.vendorId) return false;
    return true;
  });
  const openingLines = lines.filter((l) => l.entry.postingDate < filters.startDate);
  const periodLines = lines
    .filter((l) => inRange(l.entry.postingDate, filters.startDate, filters.endDate))
    .sort((a, b) => {
      const d = a.entry.postingDate.localeCompare(b.entry.postingDate);
      if (d !== 0) return d;
      return a.entry.journalEntryNumber.localeCompare(b.entry.journalEntryNumber);
    });
  const opening = signedBalance(
    account,
    sum(openingLines.map((l) => l.debitAmount)),
    sum(openingLines.map((l) => l.creditAmount)),
  );
  let run = opening;
  const withRun = periodLines.map((line) => {
    run = runningNormal(account, line.debitAmount, line.creditAmount, run);
    return Object.assign(line, { running: run });
  });
  return { account, opening, lines: withRun, closing: run };
}

export function periodPnlByAccount(ds: Dataset, filters: ReportFilters): Map<string, number> {
  const map = new Map<string, number>();
  if (filters.accountingBasis === "cash") {
    cashBasisActivity(ds, filters).forEach((value, key) => map.set(key, value));
    return map;
  }
  const entries = postedEntries(ds, { transactionStatus: "posted" });
  const lines = enrichLines(ds, entries).filter((line) => {
    if (!inRange(line.entry.postingDate, filters.startDate, filters.endDate)) return false;
    if (line.account.accountType !== "revenue" && line.account.accountType !== "expense") return false;
    if (filters.propertyId !== "all" || filters.ownerId !== "all") {
      if (!propertyMatches(line.propertyId, filters)) return false;
    }
    if (filters.accountId !== "all" && line.accountId !== filters.accountId) return false;
    return true;
  });
  lines.forEach((line) => {
    const current = map.get(line.accountId) ?? 0;
    map.set(line.accountId, round2(current + signedBalance(line.account, line.debitAmount, line.creditAmount)));
  });
  return map;
}

export function cashBasisActivity(ds: Dataset, filters: ReportFilters): Map<string, number> {
  const map = new Map<string, number>();
  const add = (accountId: string, amount: number) => {
    map.set(accountId, round2((map.get(accountId) ?? 0) + amount));
  };

  ds.allocations.forEach((alloc) => {
    if (!inRange(alloc.allocationDate, filters.startDate, filters.endDate)) return;
    if (alloc.paymentId === "CREDIT-NOTE") return;
    const payment = ds.payments.find((p) => p.paymentId === alloc.paymentId);
    const invoice = ds.invoices.find((i) => i.invoiceId === alloc.invoiceId);
    if (!payment || !invoice || payment.paymentStatus !== "posted") return;
    if (filters.propertyId !== "all" || filters.ownerId !== "all") {
      if (!propertyMatches(invoice.propertyId, filters)) return;
    }
    if (filters.tenantId !== "all" && invoice.tenantId !== filters.tenantId) return;
    const ratio = invoice.totalAmount === 0 ? 0 : alloc.allocatedAmount / invoice.totalAmount;
    invoice.lines.forEach((line) => {
      const revenue = round2(line.amount * ratio);
      if (revenue) add(line.accountId, revenue);
    });
  });

  ds.billAllocations.forEach((alloc) => {
    if (!inRange(alloc.allocationDate, filters.startDate, filters.endDate)) return;
    const bill = ds.bills.find((b) => b.billId === alloc.billId);
    const payment = ds.billPayments.find((p) => p.billPaymentId === alloc.billPaymentId);
    if (!bill || !payment) return;
    if (filters.propertyId !== "all" || filters.ownerId !== "all") {
      if (!propertyMatches(bill.propertyId, filters)) return;
    }
    if (filters.vendorId !== "all" && bill.vendorId !== filters.vendorId) return;
    const ratio = bill.totalAmount === 0 ? 0 : alloc.allocatedAmount / bill.totalAmount;
    bill.lines.forEach((line) => {
      if (line.isCapital) return;
      const expense = round2(line.amount * ratio);
      if (expense) add(line.accountId, expense);
    });
  });

  const cashEntries = postedEntries(ds, { transactionStatus: "posted" }).filter((je) =>
    inRange(je.postingDate, filters.startDate, filters.endDate),
  );
  cashEntries.forEach((je) => {
    if (je.sourceType === "mortgage_payment") {
      je.lines.forEach((line) => {
        if (line.accountId !== SYS.interest) return;
        if (filters.propertyId !== "all" || filters.ownerId !== "all") {
          if (!propertyMatches(line.propertyId, filters)) return;
        }
        add(SYS.interest, line.debitAmount);
      });
    }
    if (je.sourceType === "bank_charge") {
      je.lines.forEach((line) => {
        if (line.accountId === SYS.bankCharges) add(SYS.bankCharges, line.debitAmount - line.creditAmount);
      });
    }
    if (je.sourceType === "manual" && je.referenceNumber.startsWith("LAUNDRY")) {
      je.lines.forEach((line) => {
        if (line.accountId !== SYS.otherRental) return;
        if (filters.propertyId !== "all" || filters.ownerId !== "all") {
          if (!propertyMatches(line.propertyId, filters)) return;
        }
        add(SYS.otherRental, line.creditAmount);
      });
    }
  });

  return map;
}

export function asOfBalanceByAccount(ds: Dataset, filters: ReportFilters): Map<string, number> {
  const map = new Map<string, number>();
  const entries = postedEntries(ds, { transactionStatus: "posted" });
  const lines = enrichLines(ds, entries).filter((line) => {
    if (line.entry.postingDate > filters.asOfDate) return false;
    if (filters.propertyId !== "all" || filters.ownerId !== "all") {
      if (!propertyMatches(line.propertyId, filters)) return false;
    }
    return true;
  });
  ds.accounts
    .filter((a) => a.isPostingAccount)
    .forEach((account) => {
      const acctLines = lines.filter((l) => l.accountId === account.accountId);
      const debit = sum(acctLines.map((l) => l.debitAmount));
      const credit = sum(acctLines.map((l) => l.creditAmount));
      map.set(account.accountId, signedBalance(account, debit, credit));
    });
  return map;
}

export function currentEarnings(ds: Dataset, filters: ReportFilters): number {
  const entries = postedEntries(ds, { transactionStatus: "posted" });
  const lines = enrichLines(ds, entries).filter((line) => {
    if (line.entry.postingDate > filters.asOfDate) return false;
    const year = filters.asOfDate.slice(0, 4);
    if (line.entry.postingDate < `${year}-01-01`) return false;
    if (line.account.accountType !== "revenue" && line.account.accountType !== "expense") return false;
    if (filters.propertyId !== "all" || filters.ownerId !== "all") {
      if (!propertyMatches(line.propertyId, filters)) return false;
    }
    return true;
  });
  let income = 0;
  let expense = 0;
  lines.forEach((line) => {
    const net = signedBalance(line.account, line.debitAmount, line.creditAmount);
    if (line.account.accountType === "revenue") income += net;
    else expense += net;
  });
  return round2(income - expense);
}
