import { getDataset } from "../data";
import { defaultFilters } from "./dates";
import { getBalanceSheet, getTrialBalance } from "../services/reports";
import { round2, sum } from "./currency";

export function verifyAccountingIntegrity() {
  const ds = getDataset();
  const posted = ds.journalEntries.filter((je) => je.status === "posted");
  const unbalanced = posted.filter((je) => je.debitTotal !== je.creditTotal);
  const filters = defaultFilters(ds.today);
  filters.startDate = "2025-01-01";
  filters.endDate = "2025-12-31";
  filters.asOfDate = "2025-12-31";
  filters.fiscalYear = 2025;
  const tb = getTrialBalance(filters, ds);
  const bs = getBalanceSheet({ ...filters, asOfDate: "2025-12-31" }, ds);
  return {
    posted: posted.length,
    unbalanced: unbalanced.map((j) => j.journalEntryNumber),
    invoices: ds.invoices.length,
    payments: ds.payments.length,
    bills: ds.bills.length,
    trialDifference: tb.totals?.difference ?? null,
    balanceSheetCheck: bs.totals?.check ?? null,
    depositRegister: round2(sum(ds.deposits.filter((d) => d.status !== "refunded").map((d) => d.amountReceived - d.amountRefunded - d.amountApplied))),
  };
}
