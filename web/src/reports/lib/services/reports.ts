import { COMPANY, getDataset } from "../data";
import { REPORT_CATALOG } from "../data/catalog";
import type {
  AgingBucketRow,
  BudgetLine,
  ChartSpec,
  Dataset,
  ReportFilters,
  ReportResult,
  ReportRow,
} from "../types";
import { formatPercent, pctChange, round2, sum, varianceStatus } from "../utils/currency";
import { formatPeriodLabel, inRange, longDate, monthLabel, monthsInRange, previousPeriod } from "../utils/dates";
import { propertyLabel } from "../utils/filters";
import {
  accountActivity,
  asOfBalanceByAccount,
  currentEarnings,
  enrichLines,
  periodPnlByAccount,
  postedEntries,
  signedBalance,
  trialBalance,
} from "./ledger";

function baseResult(reportId: string, title: string, filters: ReportFilters, ds: Dataset): Omit<ReportResult, "columns" | "rows" | "notes" | "completeness"> {
  return {
    reportId,
    title,
    companyName: ds.companyName,
    propertyLabel: propertyLabel(filters, ds),
    periodLabel: formatPeriodLabel(filters.startDate, filters.endDate),
    asOfLabel: longDate(filters.asOfDate),
    basisLabel: filters.accountingBasis === "cash" ? "Cash basis" : "Accrual basis",
    generatedAt: new Date().toISOString(),
    filters,
  };
}

function moneyRow(
  id: string,
  label: string,
  amount: number,
  extra: Partial<ReportRow> = {},
): ReportRow {
  return { id, label, indent: extra.indent ?? 0, amount, ...extra };
}

export function getProfitAndLoss(filters: ReportFilters, ds = getDataset()): ReportResult {
  const current = periodPnlByAccount(ds, filters);
  const priorFilters = filters.comparison
    ? { ...filters, ...previousPeriod(filters.startDate, filters.endDate), asOfDate: previousPeriod(filters.startDate, filters.endDate).endDate }
    : null;
  const prior = priorFilters ? periodPnlByAccount(ds, priorFilters) : null;

  const bySection = (section: string, operatingOnly = false) => {
    const accts = ds.accounts.filter(
      (a) => a.pnlSection === section && a.isPostingAccount && (!operatingOnly || a.isOperating),
    );
    return accts
      .map((a) => ({
        account: a,
        amount: current.get(a.accountId) ?? 0,
        prior: prior ? (prior.get(a.accountId) ?? 0) : null,
      }))
      .filter((x) => x.amount !== 0 || (x.prior ?? 0) !== 0);
  };

  const sumSection = (section: string) => round2(sum(bySection(section).map((x) => x.amount)));
  const sumSectionPrior = (section: string) => (prior ? round2(sum(bySection(section).map((x) => x.prior ?? 0))) : null);

  const rental = sumSection("rental_income");
  const otherRental = sumSection("other_rental_income");
  const lateFees = sumSection("late_fees_charges");
  const totalRevenue = round2(rental + otherRental + lateFees);

  const opexGroups: Array<{ id: string; label: string; section: string }> = [
    { id: "repairs", label: "Repairs and Maintenance", section: "repairs_maintenance" },
    { id: "util", label: "Utilities", section: "utilities" },
    { id: "ins", label: "Insurance", section: "insurance" },
    { id: "tax", label: "Property Taxes", section: "property_taxes" },
    { id: "mgmt", label: "Property Management Fees", section: "management_fees" },
    { id: "otherop", label: "Other Operating Expenses", section: "other_operating" },
  ];
  const opex = opexGroups.map((g) => ({ ...g, amount: sumSection(g.section), prior: sumSectionPrior(g.section), details: bySection(g.section) }));
  const totalOpex = round2(sum(opex.map((g) => g.amount)));
  const noi = round2(totalRevenue - totalOpex);
  const interest = sumSection("interest");
  const depreciation = sumSection("depreciation");
  const otherNon = sumSection("other_non_operating");
  const totalExpense = round2(totalOpex + interest + depreciation + otherNon);
  const netIncome = round2(totalRevenue - totalExpense);

  const priorRev = prior
    ? round2((sumSectionPrior("rental_income") ?? 0) + (sumSectionPrior("other_rental_income") ?? 0) + (sumSectionPrior("late_fees_charges") ?? 0))
    : null;
  const priorOpex = prior ? round2(sum(opex.map((g) => g.prior ?? 0))) : null;
  const priorNoi = priorRev != null && priorOpex != null ? round2(priorRev - priorOpex) : null;
  const priorNi =
    priorRev != null
      ? round2(priorRev - (priorOpex ?? 0) - (sumSectionPrior("interest") ?? 0) - (sumSectionPrior("depreciation") ?? 0) - (sumSectionPrior("other_non_operating") ?? 0))
      : null;

  const childRows = (items: ReturnType<typeof bySection>, indent: number): ReportRow[] =>
    items.map((item) =>
      moneyRow(`acct-${item.account.accountId}`, `${item.account.accountCode}  ${item.account.accountName}`, item.amount, {
        indent,
        priorAmount: item.prior,
        accountId: item.account.accountId,
        accountCode: item.account.accountCode,
        expandable: false,
      }),
    );

  const rows: ReportRow[] = [
    moneyRow("rev-h", "Revenue", 0, { isSection: true, indent: 0 }),
    moneyRow("rental-h", "Rental Income", rental, {
      indent: 1,
      expandable: true,
      priorAmount: sumSectionPrior("rental_income"),
      children: childRows(bySection("rental_income"), 2),
    }),
    moneyRow("other-rental-h", "Other Rental Income", otherRental, {
      indent: 1,
      expandable: true,
      priorAmount: sumSectionPrior("other_rental_income"),
      children: childRows(bySection("other_rental_income"), 2),
    }),
    moneyRow("late-h", "Late Fees and Other Tenant Charges", lateFees, {
      indent: 1,
      expandable: true,
      priorAmount: sumSectionPrior("late_fees_charges"),
      children: childRows(bySection("late_fees_charges"), 2),
    }),
    moneyRow("total-rev", "Total Revenue", totalRevenue, { isTotal: true, indent: 0, priorAmount: priorRev }),
    moneyRow("opex-h", "Property Operating Expenses", 0, { isSection: true }),
    ...opex.map((g) =>
      moneyRow(g.id, g.label, g.amount, {
        indent: 1,
        expandable: true,
        priorAmount: g.prior,
        children: childRows(g.details, 2),
      }),
    ),
    moneyRow("total-opex", "Total Operating Expenses", totalOpex, { isTotal: true, priorAmount: priorOpex }),
    moneyRow("noi", "Net Operating Income", noi, { isGrandTotal: true, priorAmount: priorNoi }),
    moneyRow("nonop-h", "Non-operating Income and Expenses", 0, { isSection: true }),
    moneyRow("interest", "Interest Expense", interest, {
      indent: 1,
      expandable: true,
      priorAmount: sumSectionPrior("interest"),
      children: childRows(bySection("interest"), 2),
    }),
    moneyRow("dep", "Depreciation", depreciation, {
      indent: 1,
      expandable: true,
      priorAmount: sumSectionPrior("depreciation"),
      children: childRows(bySection("depreciation"), 2),
      note: filters.accountingBasis === "cash" ? "Depreciation is a non-cash item and is excluded from cash-basis net income." : undefined,
    }),
    moneyRow("other-non", "Other Non-operating Expenses", otherNon, {
      indent: 1,
      expandable: true,
      priorAmount: sumSectionPrior("other_non_operating"),
      children: childRows(bySection("other_non_operating"), 2),
    }),
    moneyRow("ni", "Net Income", netIncome, { isGrandTotal: true, priorAmount: priorNi }),
  ];

  if (filters.accountingBasis === "cash") {
    const depIdx = rows.findIndex((r) => r.id === "dep");
    if (depIdx >= 0) {
      rows[depIdx].amount = 0;
      rows[depIdx].note = "Excluded from cash-basis results (non-cash).";
    }
    const ni = round2(totalRevenue - totalOpex - interest - otherNon);
    rows[rows.length - 1].amount = ni;
  }

  return {
    ...baseResult("profit-and-loss", "Profit & Loss Statement", filters, ds),
    columns: [
      { key: "label", label: "Account", align: "left" },
      { key: "amount", label: "Amount", align: "right", format: "money" },
      ...(filters.comparison ? [{ key: "priorAmount", label: "Prior period", align: "right" as const, format: "money" as const }] : []),
    ],
    rows,
    totals: { totalRevenue, totalOpex, noi, netIncome: rows[rows.length - 1].amount },
    notes: [
      `Accounting basis: ${filters.accountingBasis === "cash" ? "Cash" : "Accrual"}.`,
      "Mortgage principal repayments are not included in operating expenses. Interest is reported separately.",
      filters.accountingBasis === "cash"
        ? "Cash basis uses tenant receipts allocated to invoices and vendor payments allocated to bills. Unapplied payments are not treated as revenue."
        : "Accrual basis uses posted journal entries in the reporting period.",
      filters.comparison ? `Comparison period: ${formatPeriodLabel(priorFilters!.startDate, priorFilters!.endDate)}.` : "Comparison is off.",
    ],
    completeness: "available",
    recordCount: rows.length,
    charts: [
      {
        id: "rev-exp",
        type: "bar",
        title: "Revenue vs operating expenses",
        data: [
          { label: "Revenue", value: totalRevenue, color: "#0f766e" },
          { label: "Operating expenses", value: totalOpex, color: "#b45309" },
          { label: "NOI", value: noi, color: "#1d4ed8" },
        ],
      },
    ],
  };
}

export function getBalanceSheet(filters: ReportFilters, ds = getDataset()): ReportResult {
  const balances = asOfBalanceByAccount(ds, filters);
  const earnings = currentEarnings(ds, filters);
  const sectionSum = (section: string) =>
    round2(
      sum(
        ds.accounts.filter((a) => a.bsSection === section && a.isPostingAccount).map((a) => balances.get(a.accountId) ?? 0),
      ),
    );
  const details = (section: string) =>
    ds.accounts
      .filter((a) => a.bsSection === section && a.isPostingAccount)
      .map((a) => ({ account: a, amount: balances.get(a.accountId) ?? 0 }))
      .filter((x) => x.amount !== 0);

  const cash = sectionSum("cash");
  const ar = sectionSum("ar");
  const prepaid = sectionSum("prepaid");
  const oca = sectionSum("other_current_asset");
  const ppe = sectionSum("ppe");
  const accum = sectionSum("accum_depreciation");
  const otherAsset = 0;
  const totalAssets = round2(cash + ar + prepaid + oca + ppe - accum + otherAsset);

  const ap = sectionSum("ap");
  const deposits = sectionSum("security_deposits");
  const accrued = sectionSum("accrued");
  const unapplied = sectionSum("unapplied_payments");
  const tax = sectionSum("tax_payable");
  const mortgage = sectionSum("mortgage");
  const otherLiab = sectionSum("other_liability");
  const totalLiab = round2(ap + deposits + accrued + unapplied + tax + mortgage + otherLiab);

  const contrib = sectionSum("owner_contributions");
  const dist = sectionSum("owner_distributions");
  const retained = sectionSum("retained_earnings");
  const totalEquity = round2(contrib - dist + retained + earnings);
  const check = round2(totalAssets - (totalLiab + totalEquity));

  const child = (section: string, indent = 1): ReportRow[] =>
    details(section).map((d) =>
      moneyRow(`bs-${d.account.accountId}`, `${d.account.accountCode}  ${d.account.accountName}`, d.amount, {
        indent,
        accountId: d.account.accountId,
        accountCode: d.account.accountCode,
      }),
    );

  const rows: ReportRow[] = [
    moneyRow("assets", "Assets", 0, { isSection: true }),
    moneyRow("cash", "Cash and Bank Accounts", cash, { indent: 1, expandable: true, children: child("cash", 2) }),
    moneyRow("ar", "Accounts Receivable", ar, { indent: 1, expandable: true, children: child("ar", 2) }),
    moneyRow("prepaid", "Prepaid Expenses", prepaid, { indent: 1, expandable: true, children: child("prepaid", 2) }),
    moneyRow("oca", "Other Current Assets", oca, { indent: 1, expandable: true, children: child("other_current_asset", 2) }),
    moneyRow("ppe", "Property and Equipment", ppe, { indent: 1, expandable: true, children: child("ppe", 2) }),
    moneyRow("accum", "Accumulated Depreciation", -accum, { indent: 1, expandable: true, children: child("accum_depreciation", 2) }),
    moneyRow("oa", "Other Assets", otherAsset, { indent: 1 }),
    moneyRow("ta", "Total Assets", totalAssets, { isGrandTotal: true }),
    moneyRow("liab", "Liabilities", 0, { isSection: true }),
    moneyRow("ap", "Accounts Payable", ap, { indent: 1, expandable: true, children: child("ap", 2) }),
    moneyRow("dep", "Tenant Security Deposits Payable", deposits, { indent: 1, expandable: true, children: child("security_deposits", 2) }),
    moneyRow("unapp", "Unapplied Tenant Payments", unapplied, { indent: 1, expandable: true, children: child("unapplied_payments", 2) }),
    moneyRow("accr", "Accrued Expenses", accrued, { indent: 1, expandable: true, children: child("accrued", 2) }),
    moneyRow("tax", "GST/HST Payable", tax, { indent: 1, expandable: true, children: child("tax_payable", 2) }),
    moneyRow("mtg", "Mortgage and Loan Payables", mortgage, { indent: 1, expandable: true, children: child("mortgage", 2) }),
    moneyRow("ol", "Other Liabilities", otherLiab, { indent: 1, expandable: true, children: child("other_liability", 2) }),
    moneyRow("tl", "Total Liabilities", totalLiab, { isTotal: true }),
    moneyRow("eq", "Equity", 0, { isSection: true }),
    moneyRow("oc", "Owner Contributions", contrib, { indent: 1, expandable: true, children: child("owner_contributions", 2) }),
    moneyRow("od", "Owner Distributions", -dist, { indent: 1, expandable: true, children: child("owner_distributions", 2) }),
    moneyRow("re", "Retained Earnings", retained, { indent: 1, expandable: true, children: child("retained_earnings", 2) }),
    moneyRow("cpe", "Current Period Earnings", earnings, { indent: 1 }),
    moneyRow("te", "Total Equity", totalEquity, { isTotal: true }),
    moneyRow("tle", "Total Liabilities and Equity", round2(totalLiab + totalEquity), { isGrandTotal: true }),
    moneyRow("check", "Accounting equation check (Assets − Liabilities − Equity)", check, {
      isTotal: true,
      note: Math.abs(check) < 0.02 ? "In balance." : "Out of balance — review journal entries.",
    }),
  ];

  const notes = [
    `As of ${longDate(filters.asOfDate)}.`,
    "Prepared from posted journal entries and opening balances, not from invoices alone.",
    Math.abs(check) < 0.02
      ? "Assets equal liabilities plus equity."
      : `Balance sheet is out of balance by ${check.toFixed(2)}.`,
  ];
  if (filters.propertyId !== "all") {
    notes.push(
      "Property-filtered statements exclude unallocated cash, equity, and other portfolio-level balances. An imbalance on a single property is expected when shared accounts are not allocated.",
    );
  }

  return {
    ...baseResult("balance-sheet", "Balance Sheet", filters, ds),
    periodLabel: `As of ${longDate(filters.asOfDate)}`,
    columns: [
      { key: "label", label: "Account", align: "left" },
      { key: "amount", label: "Amount", align: "right", format: "money" },
    ],
    rows,
    totals: { totalAssets, totalLiab, totalEquity, check },
    notes,
    completeness: Math.abs(check) < 0.02 || filters.propertyId !== "all" ? "available" : "available_with_limitations",
    completenessDetail: Math.abs(check) < 0.02 ? undefined : "The accounting equation does not currently balance.",
    recordCount: rows.length,
  };
}

export function getTrialBalance(filters: ReportFilters, ds = getDataset()): ReportResult {
  const rowsData = trialBalance(ds, filters);
  const totOpenDr = round2(sum(rowsData.map((r) => r.openingDebit)));
  const totOpenCr = round2(sum(rowsData.map((r) => r.openingCredit)));
  const totPerDr = round2(sum(rowsData.map((r) => r.periodDebit)));
  const totPerCr = round2(sum(rowsData.map((r) => r.periodCredit)));
  const totClDr = round2(sum(rowsData.map((r) => r.closingDebit)));
  const totClCr = round2(sum(rowsData.map((r) => r.closingCredit)));
  const imbalanced = Math.abs(totClDr - totClCr) >= 0.02;

  const rows: ReportRow[] = rowsData.map((r) =>
    moneyRow(`tb-${r.account.accountId}`, `${r.account.accountCode}  ${r.account.accountName}`, r.closingNet, {
      accountId: r.account.accountId,
      accountCode: r.account.accountCode,
      meta: {
        accountType: r.account.accountType,
        openingDebit: r.openingDebit,
        openingCredit: r.openingCredit,
        periodDebit: r.periodDebit,
        periodCredit: r.periodCredit,
        closingDebit: r.closingDebit,
        closingCredit: r.closingCredit,
      },
    }),
  );
  rows.push(
    moneyRow("tb-total", "Total", 0, {
      isGrandTotal: true,
      meta: {
        accountType: "",
        openingDebit: totOpenDr,
        openingCredit: totOpenCr,
        periodDebit: totPerDr,
        periodCredit: totPerCr,
        closingDebit: totClDr,
        closingCredit: totClCr,
      },
    }),
  );

  return {
    ...baseResult("trial-balance", "Trial Balance", filters, ds),
    columns: [
      { key: "accountCode", label: "Account Code", align: "left" },
      { key: "label", label: "Account Name", align: "left" },
      { key: "accountType", label: "Type", align: "left" },
      { key: "openingDebit", label: "Opening Debit", align: "right", format: "money" },
      { key: "openingCredit", label: "Opening Credit", align: "right", format: "money" },
      { key: "periodDebit", label: "Period Debit", align: "right", format: "money" },
      { key: "periodCredit", label: "Period Credit", align: "right", format: "money" },
      { key: "closingDebit", label: "Closing Debit", align: "right", format: "money" },
      { key: "closingCredit", label: "Closing Credit", align: "right", format: "money" },
    ],
    rows,
    totals: { totClDr, totClCr, difference: round2(totClDr - totClCr) },
    notes: [
      "Includes posted journal entries only. Draft entries are excluded.",
      imbalanced
        ? `Closing debits and credits differ by ${round2(totClDr - totClCr).toFixed(2)}.`
        : "Closing debits equal closing credits.",
      filters.propertyId !== "all"
        ? "A property filter excludes unallocated lines and may cause the trial balance not to equal on a single property."
        : "",
    ].filter(Boolean),
    completeness: imbalanced && filters.propertyId === "all" ? "available_with_limitations" : "available",
    recordCount: rowsData.length,
  };
}

export function getGeneralLedger(filters: ReportFilters, ds = getDataset()): ReportResult {
  const accounts = ds.accounts.filter((a) => a.isPostingAccount && (filters.accountId === "all" || a.accountId === filters.accountId));
  const rows: ReportRow[] = [];
  let recordCount = 0;
  accounts.forEach((account) => {
    const activity = accountActivity(ds, filters, account.accountId);
    if (!activity.account) return;
    if (!activity.opening && activity.lines.length === 0) return;
    rows.push(
      moneyRow(`gl-h-${account.accountId}`, `${account.accountCode}  ${account.accountName}`, activity.opening, {
        isSection: true,
        accountId: account.accountId,
        accountCode: account.accountCode,
        note: `Opening balance ${filters.startDate}`,
      }),
    );
    activity.lines.forEach((line) => {
      recordCount += 1;
      const running = (line as EnrichedLineWithRun).running ?? 0;
      rows.push(
        moneyRow(line.journalLineId, line.description, round2(line.debitAmount - line.creditAmount), {
          indent: 1,
          accountId: account.accountId,
          sourceId: line.entry.journalEntryId,
          sourceType: "journal",
          meta: {
            transactionDate: line.entry.transactionDate,
            postingDate: line.entry.postingDate,
            journalEntryNumber: line.entry.journalEntryNumber,
            reference: line.entry.referenceNumber,
            property: ds.properties.find((p) => p.propertyId === line.propertyId)?.propertyName ?? (line.propertyId ? line.propertyId : "Unallocated"),
            party:
              ds.tenants.find((t) => t.tenantId === line.tenantId)?.tenantName ??
              ds.vendors.find((v) => v.vendorId === line.vendorId)?.vendorName ??
              "",
            debit: line.debitAmount,
            credit: line.creditAmount,
            running,
            status: line.entry.status,
            sourceType: line.entry.sourceType,
            sourceId: line.entry.sourceId,
          },
        }),
      );
    });
    rows.push(
      moneyRow(`gl-c-${account.accountId}`, `Closing balance — ${account.accountName}`, activity.closing, {
        isTotal: true,
        accountId: account.accountId,
      }),
    );
  });

  return {
    ...baseResult("general-ledger", "General Ledger", filters, ds),
    columns: [
      { key: "postingDate", label: "Posting Date", align: "left", format: "date" },
      { key: "journalEntryNumber", label: "JE #", align: "left" },
      { key: "label", label: "Description", align: "left" },
      { key: "reference", label: "Reference", align: "left" },
      { key: "property", label: "Property", align: "left" },
      { key: "party", label: "Tenant / Vendor", align: "left" },
      { key: "debit", label: "Debit", align: "right", format: "money" },
      { key: "credit", label: "Credit", align: "right", format: "money" },
      { key: "running", label: "Running Balance", align: "right", format: "money" },
    ],
    rows,
    notes: [
      "Running balances follow each account’s normal balance (debit for assets/expenses, credit for liabilities/equity/revenue).",
      "Draft and reversed originals are excluded unless status = all.",
    ],
    completeness: "available",
    recordCount,
  };
}

type EnrichedLineWithRun = { running?: number };

export function getJournalEntryReport(filters: ReportFilters, ds = getDataset()): ReportResult {
  const entries = postedEntries(ds, filters).filter((je) => {
    if (!inRange(je.postingDate, filters.startDate, filters.endDate)) return false;
    if (filters.transactionType !== "all" && je.sourceType !== filters.transactionType) return false;
    if (filters.propertyId !== "all" || filters.ownerId !== "all") {
      const has = je.lines.some((l) => l.propertyId === filters.propertyId) || je.propertyId === filters.propertyId;
      if (filters.propertyId !== "all" && !has && je.propertyId !== null) return false;
      if (filters.propertyId !== "all" && !has && je.propertyId === null && !je.lines.some((l) => l.propertyId === filters.propertyId)) {
        if (je.lines.every((l) => l.propertyId && l.propertyId !== filters.propertyId)) return false;
        if (je.lines.every((l) => l.propertyId && l.propertyId !== filters.propertyId)) return false;
      }
      if (filters.propertyId !== "all" && !has && je.lines.every((l) => l.propertyId !== filters.propertyId && l.propertyId != null)) return false;
    }
    return true;
  });
  const rows: ReportRow[] = entries.map((je) =>
    moneyRow(je.journalEntryId, je.description, je.debitTotal, {
      sourceId: je.journalEntryId,
      sourceType: "journal",
      meta: {
        postingDate: je.postingDate,
        transactionDate: je.transactionDate,
        journalEntryNumber: je.journalEntryNumber,
        reference: je.referenceNumber,
        sourceType: je.sourceType,
        status: je.status,
        debit: je.debitTotal,
        credit: je.creditTotal,
        property: ds.properties.find((p) => p.propertyId === je.propertyId)?.propertyName ?? (je.propertyId ? je.propertyId : "Multiple / portfolio"),
        balanced: je.debitTotal === je.creditTotal ? "Yes" : "No",
      },
    }),
  );
  return {
    ...baseResult("journal-entry-report", "Journal Entry Report", filters, ds),
    columns: [
      { key: "postingDate", label: "Posting Date", align: "left" },
      { key: "journalEntryNumber", label: "JE #", align: "left" },
      { key: "label", label: "Description", align: "left" },
      { key: "sourceType", label: "Source", align: "left" },
      { key: "reference", label: "Reference", align: "left" },
      { key: "status", label: "Status", align: "left" },
      { key: "debit", label: "Debit", align: "right", format: "money" },
      { key: "credit", label: "Credit", align: "right", format: "money" },
    ],
    rows,
    notes: ["Click a journal entry to inspect debit and credit lines and the originating business transaction."],
    completeness: "available",
    recordCount: entries.length,
    totals: {
      debit: round2(sum(entries.map((e) => e.debitTotal))),
      credit: round2(sum(entries.map((e) => e.creditTotal))),
    },
  };
}

export function getAccountActivityReport(filters: ReportFilters, ds = getDataset()): ReportResult {
  if (filters.accountId === "all") {
    return {
      ...baseResult("account-activity", "Account Activity", filters, ds),
      columns: [],
      rows: [],
      notes: ["Select an account to view activity."],
      completeness: "available",
      completenessDetail: "An account filter is required for this report.",
    };
  }
  const gl = getGeneralLedger(filters, ds);
  return { ...gl, reportId: "account-activity", title: "Account Activity" };
}

function agingBucket(due: string, asOf: string, amount: number) {
  const days = Math.floor((Date.parse(`${asOf}T00:00:00`) - Date.parse(`${due}T00:00:00`)) / 86400000);
  const buckets = { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90plus: 0 };
  if (days <= 0) buckets.current = amount;
  else if (days <= 30) buckets.d1_30 = amount;
  else if (days <= 60) buckets.d31_60 = amount;
  else if (days <= 90) buckets.d61_90 = amount;
  else buckets.d90plus = amount;
  return buckets;
}

export function getArAging(filters: ReportFilters, ds = getDataset()): { result: ReportResult; rows: AgingBucketRow[] } {
  const asOf = filters.asOfDate;
  const items: AgingBucketRow[] = [];
  ds.invoices.forEach((inv) => {
    if (inv.invoiceType === "credit") return;
    if (inv.invoiceDate > asOf) return;
    if (filters.propertyId !== "all" && inv.propertyId !== filters.propertyId) return;
    if (filters.tenantId !== "all" && inv.tenantId !== filters.tenantId) return;
    const paid = round2(
      sum(
        ds.allocations
          .filter((a) => a.invoiceId === inv.invoiceId && a.allocationDate <= asOf && a.paymentId !== "CREDIT-NOTE")
          .map((a) => a.allocatedAmount),
      ),
    );
    const credit = round2(
      sum(
        ds.allocations
          .filter((a) => a.invoiceId === inv.invoiceId && a.allocationDate <= asOf && a.paymentId === "CREDIT-NOTE")
          .map((a) => a.allocatedAmount),
      ),
    );
    const outstanding = round2(inv.totalAmount - paid - credit);
    if (outstanding <= 0.009) return;
    const buckets = agingBucket(inv.dueDate, asOf, outstanding);
    const tenant = ds.tenants.find((t) => t.tenantId === inv.tenantId);
    const property = ds.properties.find((p) => p.propertyId === inv.propertyId);
    const unit = ds.units.find((u) => u.unitId === inv.unitId);
    items.push({
      id: inv.invoiceId,
      name: tenant?.tenantName ?? inv.tenantId,
      propertyName: property?.propertyName ?? "",
      unitNumber: unit?.unitNumber,
      documentNumber: inv.invoiceNumber,
      documentDate: inv.invoiceDate,
      dueDate: inv.dueDate,
      original: inv.totalAmount,
      paid,
      credit,
      outstanding,
      ...buckets,
      tenantId: inv.tenantId,
      invoiceId: inv.invoiceId,
    });
  });

  const totals = {
    original: round2(sum(items.map((i) => i.original))),
    paid: round2(sum(items.map((i) => i.paid))),
    credit: round2(sum(items.map((i) => i.credit))),
    outstanding: round2(sum(items.map((i) => i.outstanding))),
    current: round2(sum(items.map((i) => i.current))),
    d1_30: round2(sum(items.map((i) => i.d1_30))),
    d31_60: round2(sum(items.map((i) => i.d31_60))),
    d61_90: round2(sum(items.map((i) => i.d61_90))),
    d90plus: round2(sum(items.map((i) => i.d90plus))),
  };

  const unapplied = ds.payments.filter((p) => {
    if (p.paymentDate > asOf || p.paymentStatus !== "posted") return false;
    if (filters.tenantId !== "all" && p.tenantId !== filters.tenantId) return false;
    const allocated = round2(sum(ds.allocations.filter((a) => a.paymentId === p.paymentId && a.allocationDate <= asOf).map((a) => a.allocatedAmount)));
    return round2(p.totalAmount - allocated) > 0;
  });

  const rows: ReportRow[] = items.map((i) =>
    moneyRow(i.id, `${i.name} · ${i.documentNumber}`, i.outstanding, {
      sourceType: "invoice",
      sourceId: i.invoiceId,
      meta: { ...i } as unknown as Record<string, string | number | null>,
    }),
  );

  return {
    rows: items,
    result: {
      ...baseResult("ar-aging", "Accounts Receivable Aging", filters, ds),
      periodLabel: `As of ${longDate(asOf)}`,
      columns: [
        { key: "name", label: "Tenant", align: "left" },
        { key: "propertyName", label: "Property", align: "left" },
        { key: "unitNumber", label: "Unit", align: "left" },
        { key: "documentNumber", label: "Invoice #", align: "left" },
        { key: "documentDate", label: "Invoice Date", align: "left" },
        { key: "dueDate", label: "Due Date", align: "left" },
        { key: "original", label: "Original", align: "right", format: "money" },
        { key: "paid", label: "Paid", align: "right", format: "money" },
        { key: "credit", label: "Credit", align: "right", format: "money" },
        { key: "outstanding", label: "Outstanding", align: "right", format: "money" },
        { key: "current", label: "Current", align: "right", format: "money" },
        { key: "d1_30", label: "1–30", align: "right", format: "money" },
        { key: "d31_60", label: "31–60", align: "right", format: "money" },
        { key: "d61_90", label: "61–90", align: "right", format: "money" },
        { key: "d90plus", label: "Over 90", align: "right", format: "money" },
      ],
      rows,
      totals,
      notes: [
        "Aging is calculated from the as-of date versus each invoice due date.",
        "Fully paid invoices are excluded. Unapplied payments are listed in notes and do not reduce an arbitrary invoice.",
        unapplied.length
          ? `Unapplied payments not allocated to invoices: ${unapplied
              .map((p) => {
                const left = round2(
                  p.totalAmount -
                    sum(ds.allocations.filter((a) => a.paymentId === p.paymentId && a.allocationDate <= asOf).map((a) => a.allocatedAmount)),
                );
                const tenant = ds.tenants.find((t) => t.tenantId === p.tenantId)?.tenantName;
                return `${tenant} ${p.paymentNumber} ${left.toFixed(2)}`;
              })
              .join("; ")}.`
          : "No unapplied payments as of this date.",
      ],
      completeness: "available",
      recordCount: items.length,
      charts: [
        {
          id: "ar-buckets",
          type: "bar",
          title: "AR aging buckets",
          data: [
            { label: "Current", value: totals.current, color: "#0f766e" },
            { label: "1–30", value: totals.d1_30, color: "#0369a1" },
            { label: "31–60", value: totals.d31_60, color: "#b45309" },
            { label: "61–90", value: totals.d61_90, color: "#c2410c" },
            { label: "90+", value: totals.d90plus, color: "#b91c1c" },
          ],
        },
      ],
    },
  };
}

export function getApAging(filters: ReportFilters, ds = getDataset()): { result: ReportResult; rows: AgingBucketRow[] } {
  const asOf = filters.asOfDate;
  const items: AgingBucketRow[] = [];
  ds.bills.forEach((bill) => {
    if (bill.billDate > asOf) return;
    if (filters.propertyId !== "all" && bill.propertyId && bill.propertyId !== filters.propertyId) return;
    if (filters.propertyId !== "all" && !bill.propertyId) return;
    if (filters.vendorId !== "all" && bill.vendorId !== filters.vendorId) return;
    const paid = round2(
      sum(ds.billAllocations.filter((a) => a.billId === bill.billId && a.allocationDate <= asOf).map((a) => a.allocatedAmount)),
    );
    const outstanding = round2(bill.totalAmount - paid);
    if (outstanding <= 0.009) return;
    const buckets = agingBucket(bill.dueDate, asOf, outstanding);
    items.push({
      id: bill.billId,
      name: ds.vendors.find((v) => v.vendorId === bill.vendorId)?.vendorName ?? bill.vendorId,
      propertyName: ds.properties.find((p) => p.propertyId === bill.propertyId)?.propertyName ?? (bill.propertyId ? bill.propertyId : "Unallocated"),
      documentNumber: bill.billNumber,
      documentDate: bill.billDate,
      dueDate: bill.dueDate,
      original: bill.totalAmount,
      paid,
      credit: 0,
      outstanding,
      ...buckets,
      vendorId: bill.vendorId,
      billId: bill.billId,
    });
  });
  const totals = {
    original: round2(sum(items.map((i) => i.original))),
    paid: round2(sum(items.map((i) => i.paid))),
    outstanding: round2(sum(items.map((i) => i.outstanding))),
    current: round2(sum(items.map((i) => i.current))),
    d1_30: round2(sum(items.map((i) => i.d1_30))),
    d31_60: round2(sum(items.map((i) => i.d31_60))),
    d61_90: round2(sum(items.map((i) => i.d61_90))),
    d90plus: round2(sum(items.map((i) => i.d90plus))),
  };
  return {
    rows: items,
    result: {
      ...baseResult("ap-aging", "Accounts Payable Aging", filters, ds),
      periodLabel: `As of ${longDate(asOf)}`,
      columns: [
        { key: "name", label: "Vendor", align: "left" },
        { key: "propertyName", label: "Property", align: "left" },
        { key: "documentNumber", label: "Bill #", align: "left" },
        { key: "documentDate", label: "Bill Date", align: "left" },
        { key: "dueDate", label: "Due Date", align: "left" },
        { key: "original", label: "Original", align: "right", format: "money" },
        { key: "paid", label: "Paid", align: "right", format: "money" },
        { key: "outstanding", label: "Outstanding", align: "right", format: "money" },
        { key: "current", label: "Current", align: "right", format: "money" },
        { key: "d1_30", label: "1–30", align: "right", format: "money" },
        { key: "d31_60", label: "31–60", align: "right", format: "money" },
        { key: "d61_90", label: "61–90", align: "right", format: "money" },
        { key: "d90plus", label: "Over 90", align: "right", format: "money" },
      ],
      rows: items.map((i) =>
        moneyRow(i.id, `${i.name} · ${i.documentNumber}`, i.outstanding, {
          sourceType: "bill",
          sourceId: i.billId,
          meta: { ...i } as unknown as Record<string, string | number | null>,
        }),
      ),
      totals,
      notes: ["Outstanding amounts come from vendor bills less payments allocated on or before the as-of date. Recording an expense does not mean the vendor has been paid."],
      completeness: "available",
      recordCount: items.length,
      charts: [
        {
          id: "ap-buckets",
          type: "bar",
          title: "AP aging buckets",
          data: [
            { label: "Current", value: totals.current, color: "#0f766e" },
            { label: "1–30", value: totals.d1_30, color: "#0369a1" },
            { label: "31–60", value: totals.d31_60, color: "#b45309" },
            { label: "61–90", value: totals.d61_90, color: "#c2410c" },
            { label: "90+", value: totals.d90plus, color: "#b91c1c" },
          ],
        },
      ],
    },
  };
}

export function getIncomeExpenseByProperty(filters: ReportFilters, ds = getDataset()): ReportResult {
  const selected = ds.properties.filter((p) => filters.propertyId === "all" || p.propertyId === filters.propertyId);
  const rows: ReportRow[] = [];
  const chart: ChartSpec = { id: "ie-prop", type: "bar", title: "NOI by property", data: [] };
  let totRev = 0;
  let totExp = 0;
  selected.forEach((p) => {
    const map = periodPnlByAccount(ds, { ...filters, propertyId: p.propertyId });
    let rental = 0;
    let other = 0;
    let opex = 0;
    ds.accounts.forEach((a) => {
      const amt = map.get(a.accountId) ?? 0;
      if (a.pnlSection === "rental_income") rental += amt;
      else if (a.pnlSection === "other_rental_income" || a.pnlSection === "late_fees_charges") other += amt;
      else if (a.isOperating && a.accountType === "expense") opex += amt;
    });
    rental = round2(rental);
    other = round2(other);
    opex = round2(opex);
    const rev = round2(rental + other);
    const noi = round2(rev - opex);
    const margin = rev > 0 ? round2((noi / rev) * 100) : null;
    totRev += rev;
    totExp += opex;
    const occupied = ds.units.filter((u) => u.propertyId === p.propertyId && u.status === "occupied").length;
    rows.push(
      moneyRow(p.propertyId, p.propertyName, noi, {
        propertyId: p.propertyId,
        meta: {
          rental,
          other,
          opex,
          rev,
          noi,
          margin: margin ?? "n/a",
          units: `${occupied}/${p.unitCount}`,
          type: p.propertyType,
        },
      }),
    );
    chart.data.push({ label: p.propertyCode, value: noi, color: "#0f766e" });
  });
  const totNoi = round2(totRev - totExp);
  rows.push(
    moneyRow("portfolio", "Portfolio total", totNoi, {
      isGrandTotal: true,
      meta: { rental: totRev, other: 0, opex: totExp, rev: totRev, noi: totNoi, margin: totRev > 0 ? round2((totNoi / totRev) * 100) : "n/a", units: "", type: "" },
    }),
  );
  return {
    ...baseResult("income-expense-by-property", "Income & Expense by Property", filters, ds),
    columns: [
      { key: "label", label: "Property", align: "left" },
      { key: "type", label: "Type", align: "left" },
      { key: "units", label: "Occupied units", align: "left" },
      { key: "rental", label: "Rental income", align: "right", format: "money" },
      { key: "other", label: "Other income", align: "right", format: "money" },
      { key: "opex", label: "Operating expenses", align: "right", format: "money" },
      { key: "noi", label: "NOI", align: "right", format: "money" },
      { key: "margin", label: "NOI margin", align: "right", format: "percent" },
    ],
    rows,
    charts: [chart],
    totals: { totRev, totExp, totNoi },
    notes: [
      "Shared expenses without a property assignment are excluded from property rows and are not silently allocated.",
      "Click a property to open its profit and loss statement.",
    ],
    completeness: "available",
    recordCount: selected.length,
  };
}

export function getNoiByProperty(filters: ReportFilters, ds = getDataset()): ReportResult {
  const base = getIncomeExpenseByProperty(filters, ds);
  return { ...base, reportId: "noi-by-property", title: "Net Operating Income by Property" };
}

export function getCashFlowStatement(filters: ReportFilters, ds = getDataset()): ReportResult {
  const entries = postedEntries(ds, { transactionStatus: "posted" });
  const cashAccounts = new Set(["1020", "1030"]);
  const cashLines = enrichLines(ds, entries).filter((l) => cashAccounts.has(l.accountId));
  const opening = round2(
    sum(
      cashLines.filter((l) => l.entry.postingDate < filters.startDate).map((l) => l.debitAmount - l.creditAmount),
    ),
  );
  const period = cashLines.filter((l) => inRange(l.entry.postingDate, filters.startDate, filters.endDate));
  const filtered = period.filter((l) => {
    if (filters.propertyId === "all" && filters.ownerId === "all") return true;
    return l.propertyId === filters.propertyId || l.entry.propertyId === filters.propertyId || l.propertyId == null;
  });
  if (filters.bankAccountId !== "all") {
    const acct = ds.bankAccounts.find((b) => b.bankAccountId === filters.bankAccountId)?.accountId;
    if (acct) {
      /* handled below via account filter on lines */
    }
  }
  const bankAcct = filters.bankAccountId === "all" ? null : ds.bankAccounts.find((b) => b.bankAccountId === filters.bankAccountId)?.accountId;
  const used = bankAcct ? filtered.filter((l) => l.accountId === bankAcct) : filtered;

  const bucket = {
    tenantReceipts: 0,
    vendorPays: 0,
    opexPaid: 0,
    otherOp: 0,
    capex: 0,
    otherInv: 0,
    mortgageProceeds: 0,
    principal: 0,
    contrib: 0,
    dist: 0,
  };

  used.forEach((line) => {
    const signed = round2(line.debitAmount - line.creditAmount);
    const src = line.entry.sourceType;
    if (src === "tenant_payment" || src === "unapplied_payment" || src === "security_deposit") bucket.tenantReceipts += signed;
    else if (src === "deposit_refund") bucket.otherOp += signed;
    else if (src === "vendor_payment") {
      const billPay = ds.billPayments.find((b) => b.billPaymentId === line.entry.sourceId);
      const allocs = ds.billAllocations.filter((a) => a.billPaymentId === billPay?.billPaymentId);
      const capital = allocs.some((a) => ds.bills.find((b) => b.billId === a.billId)?.lines.some((l) => l.isCapital));
      if (capital) bucket.capex += signed;
      else bucket.vendorPays += signed;
    } else if (src === "capital_expenditure") bucket.capex += signed;
    else if (src === "insurance_prepayment") bucket.opexPaid += signed;
    else if (src === "mortgage_payment") {
      const principalLine = line.entry.lines.find((l) => l.accountId.startsWith("25"));
      const interestLine = line.entry.lines.find((l) => l.accountId === "6000");
      bucket.principal += principalLine ? -principalLine.debitAmount : 0;
      bucket.otherOp += interestLine ? -interestLine.debitAmount : signed;
    } else if (src === "owner_contribution") bucket.contrib += signed;
    else if (src === "owner_distribution") bucket.dist += signed;
    else if (src === "bank_charge") bucket.otherOp += signed;
    else if (src === "manual" && line.entry.referenceNumber.startsWith("HST")) bucket.otherOp += signed;
    else if (src === "manual" && line.entry.referenceNumber.startsWith("LAUNDRY")) bucket.tenantReceipts += signed;
    else if (src === "opening_balance") {
      /* opening excluded by date */
    } else bucket.otherOp += signed;
  });

  Object.keys(bucket).forEach((k) => {
    (bucket as Record<string, number>)[k] = round2((bucket as Record<string, number>)[k]);
  });

  const netOp = round2(bucket.tenantReceipts + bucket.vendorPays + bucket.opexPaid + bucket.otherOp);
  const netInv = round2(bucket.capex + bucket.otherInv);
  const netFin = round2(bucket.mortgageProceeds + bucket.principal + bucket.contrib + bucket.dist);
  const netChange = round2(netOp + netInv + netFin);
  const closing = round2(opening + netChange);

  const rows: ReportRow[] = [
    moneyRow("open", "Opening Cash Balance", opening, { isTotal: true }),
    moneyRow("op-h", "Operating Activities", 0, { isSection: true }),
    moneyRow("ten", "Cash Received from Tenants", bucket.tenantReceipts, { indent: 1 }),
    moneyRow("vend", "Cash Paid to Vendors", bucket.vendorPays, { indent: 1 }),
    moneyRow("opex", "Operating Expenses Paid", bucket.opexPaid, { indent: 1 }),
    moneyRow("othop", "Other Operating Cash Flows", bucket.otherOp, { indent: 1 }),
    moneyRow("netop", "Net Cash from Operating Activities", netOp, { isTotal: true }),
    moneyRow("inv-h", "Investing Activities", 0, { isSection: true }),
    moneyRow("capex", "Property Improvements / Capital Expenditures", bucket.capex, { indent: 1 }),
    moneyRow("netinv", "Net Cash from Investing Activities", netInv, { isTotal: true }),
    moneyRow("fin-h", "Financing Activities", 0, { isSection: true }),
    moneyRow("prin", "Loan Principal Repayments", bucket.principal, { indent: 1 }),
    moneyRow("cont", "Owner Contributions", bucket.contrib, { indent: 1 }),
    moneyRow("dist", "Owner Distributions", bucket.dist, { indent: 1 }),
    moneyRow("netfin", "Net Cash from Financing Activities", netFin, { isTotal: true }),
    moneyRow("net", "Net Change in Cash", netChange, { isTotal: true }),
    moneyRow("close", "Closing Cash Balance", closing, { isGrandTotal: true }),
  ];

  return {
    ...baseResult("cash-flow", "Cash Flow Statement", filters, ds),
    columns: [
      { key: "label", label: "Line", align: "left" },
      { key: "amount", label: "Amount", align: "right", format: "money" },
    ],
    rows,
    totals: { opening, netOp, netInv, netFin, netChange, closing },
    notes: [
      "Cash flow is derived from posted cash-account journal lines (RBC Operating and TD Deposit Trust), not from invoices or bills.",
      "Mortgage payments split interest (operating) and principal (financing). Capital expenditures are investing outflows.",
      "Security deposits received increase cash and a liability; they are not rental revenue.",
    ],
    completeness: "available",
    charts: [
      {
        id: "cf",
        type: "bar",
        title: "Cash inflows vs outflows",
        data: [
          { label: "Operating", value: netOp, color: "#0f766e" },
          { label: "Investing", value: netInv, color: "#b45309" },
          { label: "Financing", value: netFin, color: "#1d4ed8" },
        ],
      },
    ],
  };
}

export function getExpenseAnalysis(filters: ReportFilters, ds = getDataset()): ReportResult {
  const map = periodPnlByAccount(ds, filters);
  const expenseAccounts = ds.accounts.filter((a) => a.accountType === "expense" && a.isOperating);
  const byAccount = expenseAccounts
    .map((a) => ({ account: a, amount: map.get(a.accountId) ?? 0 }))
    .filter((x) => x.amount)
    .sort((a, b) => b.amount - a.amount);
  const byProperty = ds.properties
    .filter((p) => filters.propertyId === "all" || p.propertyId === p.propertyId)
    .map((p) => {
      const m = periodPnlByAccount(ds, { ...filters, propertyId: p.propertyId });
      const amount = round2(sum(expenseAccounts.map((a) => m.get(a.accountId) ?? 0)));
      return { property: p, amount };
    })
    .filter((x) => filters.propertyId === "all" || x.property.propertyId === filters.propertyId);

  const vendorSpend = new Map<string, number>();
  ds.bills.forEach((bill) => {
    if (!inRange(bill.billDate, filters.startDate, filters.endDate)) return;
    if (filters.propertyId !== "all" && bill.propertyId !== filters.propertyId) return;
    if (filters.vendorId !== "all" && bill.vendorId !== filters.vendorId) return;
    const exp = round2(sum(bill.lines.filter((l) => !l.isCapital).map((l) => l.amount)));
    vendorSpend.set(bill.vendorId, round2((vendorSpend.get(bill.vendorId) ?? 0) + exp));
  });

  const months = monthsInRange(filters.startDate, filters.endDate);
  const byMonth = months.map((m) => {
    const end = m.slice(0, 7) === filters.endDate.slice(0, 7) ? filters.endDate : `${m.slice(0, 8)}${new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)), 0).getDate()}`.replace(/undefined/g, "");
    const monthEnd = new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)), 0);
    const endStr = `${monthEnd.getFullYear()}-${String(monthEnd.getMonth() + 1).padStart(2, "0")}-${String(monthEnd.getDate()).padStart(2, "0")}`;
    const mm = periodPnlByAccount(ds, { ...filters, startDate: m, endDate: endStr < filters.endDate ? endStr : filters.endDate, asOfDate: endStr });
    const amount = round2(sum(expenseAccounts.map((a) => mm.get(a.accountId) ?? 0)));
    return { label: monthLabel(m), amount };
  });

  const rows: ReportRow[] = byAccount.map((x) =>
    moneyRow(x.account.accountId, `${x.account.accountCode}  ${x.account.accountName}`, x.amount, {
      accountId: x.account.accountId,
      accountCode: x.account.accountCode,
    }),
  );
  const total = round2(sum(byAccount.map((x) => x.amount)));
  rows.push(moneyRow("exp-total", "Total operating expenses", total, { isGrandTotal: true }));

  const vendorRows = [...vendorSpend.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id, amount]) => ({
      id,
      label: ds.vendors.find((v) => v.vendorId === id)?.vendorName ?? id,
      amount,
    }));

  return {
    ...baseResult("expense-analysis", "Expense Analysis", filters, ds),
    columns: [
      { key: "label", label: "Account", align: "left" },
      { key: "amount", label: "Amount", align: "right", format: "money" },
    ],
    rows,
    totals: { total },
    notes: [
      "Operating expenses only. Capital expenditures and loan principal are excluded.",
      "Vendor totals use vendor bills in the period (accrual), not the subsequent payment, so a bill is not counted twice when paid.",
    ],
    completeness: "available",
    recordCount: byAccount.length,
    charts: [
      {
        id: "exp-month",
        type: "line",
        title: "Monthly operating expenses",
        data: byMonth.map((m) => ({ label: m.label, value: m.amount, color: "#b45309" })),
      },
      {
        id: "exp-cat",
        type: "pie",
        title: "Expense by account",
        data: byAccount.slice(0, 8).map((x, i) => ({
          label: x.account.accountName,
          value: x.amount,
          color: ["#0f766e", "#1d4ed8", "#b45309", "#7c3aed", "#be123c", "#0369a1", "#365314", "#9f1239"][i],
        })),
      },
      {
        id: "exp-prop",
        type: "bar",
        title: "Expense by property",
        data: byProperty.map((p) => ({ label: p.property.propertyCode, value: p.amount })),
      },
    ],
    tableRows: vendorRows.map((v) => ({ Vendor: v.label, Amount: v.amount })),
  };
}

export function getRevenueAnalysis(filters: ReportFilters, ds = getDataset()): ReportResult {
  const map = periodPnlByAccount(ds, filters);
  const revAccts = ds.accounts.filter((a) => a.accountType === "revenue");
  const rows = revAccts
    .map((a) => moneyRow(a.accountId, `${a.accountCode}  ${a.accountName}`, map.get(a.accountId) ?? 0, { accountId: a.accountId, accountCode: a.accountCode }))
    .filter((r) => r.amount);
  const total = round2(sum(rows.map((r) => r.amount)));
  rows.push(moneyRow("rev-t", "Total revenue", total, { isGrandTotal: true }));
  const months = monthsInRange(filters.startDate, filters.endDate);
  const byMonth = months.map((m) => {
    const monthEnd = new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)), 0);
    const endStr = `${monthEnd.getFullYear()}-${String(monthEnd.getMonth() + 1).padStart(2, "0")}-${String(monthEnd.getDate()).padStart(2, "0")}`;
    const mm = periodPnlByAccount(ds, { ...filters, startDate: m, endDate: endStr < filters.endDate ? endStr : filters.endDate });
    return { label: monthLabel(m), value: round2(sum(revAccts.map((a) => mm.get(a.accountId) ?? 0))) };
  });
  return {
    ...baseResult("revenue-analysis", "Revenue Analysis", filters, ds),
    columns: [
      { key: "label", label: "Account", align: "left" },
      { key: "amount", label: "Amount", align: "right", format: "money" },
    ],
    rows,
    totals: { total },
    notes: ["Revenue follows the selected accounting basis. Residential rent is recorded as exempt of GST/HST."],
    completeness: "available",
    charts: [
      { id: "rev-m", type: "line", title: "Monthly revenue", data: byMonth },
      {
        id: "rev-a",
        type: "pie",
        title: "Revenue mix",
        data: rows
          .filter((r) => !r.isGrandTotal)
          .map((r, i) => ({ label: r.label, value: r.amount, color: ["#0f766e", "#1d4ed8", "#7c3aed", "#b45309", "#0369a1"][i % 5] })),
      },
    ],
  };
}

export function getBudgetVsActual(
  filters: ReportFilters,
  ds = getDataset(),
  budgetOverrides: BudgetLine[] = [],
): ReportResult {
  const year = filters.fiscalYear;
  const budgets = [...ds.budgets.filter((b) => b.fiscalYear === year && b.period === "annual"), ...budgetOverrides.filter((b) => b.fiscalYear === year && b.period === "annual")];
  const overrideIds = new Set(budgetOverrides.map((b) => `${b.propertyId}-${b.accountId}-${b.fiscalYear}-${b.period}-${b.month}`));
  const effective = [
    ...ds.budgets.filter((b) => b.fiscalYear === year && b.period === "annual" && !overrideIds.has(`${b.propertyId}-${b.accountId}-${b.fiscalYear}-${b.period}-${b.month}`)),
    ...budgetOverrides.filter((b) => b.fiscalYear === year && b.period === "annual"),
  ];
  const actualFilters: ReportFilters = {
    ...filters,
    startDate: `${year}-01-01`,
    endDate: year === Number(ds.today.slice(0, 4)) ? ds.today : `${year}-12-31`,
    asOfDate: year === Number(ds.today.slice(0, 4)) ? ds.today : `${year}-12-31`,
    accountingBasis: "accrual",
  };
  const properties = ds.properties.filter((p) => filters.propertyId === "all" || p.propertyId === filters.propertyId);
  const rows: ReportRow[] = [];
  properties.forEach((p) => {
    const actualMap = periodPnlByAccount(ds, { ...actualFilters, propertyId: p.propertyId });
    const accounts = ds.accounts.filter((a) => a.isPostingAccount && (a.accountType === "revenue" || a.accountType === "expense"));
    rows.push(moneyRow(`p-${p.propertyId}`, p.propertyName, 0, { isSection: true, propertyId: p.propertyId }));
    accounts.forEach((a) => {
      const budget = round2(
        sum(effective.filter((b) => b.propertyId === p.propertyId && b.accountId === a.accountId).map((b) => b.budgetAmount)),
      );
      const actual = actualMap.get(a.accountId) ?? 0;
      if (!budget && !actual) return;
      const variance = round2(actual - budget);
      const pct = budget === 0 ? null : round2((variance / Math.abs(budget)) * 100);
      const kind = a.accountType === "revenue" ? "revenue" : "expense";
      rows.push(
        moneyRow(`${p.propertyId}-${a.accountId}`, `${a.accountCode}  ${a.accountName}`, actual, {
          indent: 1,
          accountId: a.accountId,
          accountCode: a.accountCode,
          propertyId: p.propertyId,
          meta: {
            budget,
            actual,
            variance,
            variancePct: pct ?? "n/a",
            status: varianceStatus(kind, variance),
            accountType: a.accountType,
          },
        }),
      );
    });
  });
  return {
    ...baseResult("budget-vs-actual", "Budget vs. Actual", filters, ds),
    periodLabel: `Fiscal year ${year}`,
    columns: [
      { key: "label", label: "Account", align: "left" },
      { key: "budget", label: "Budget", align: "right", format: "money" },
      { key: "actual", label: "Actual", align: "right", format: "money" },
      { key: "variance", label: "Variance", align: "right", format: "money" },
      { key: "variancePct", label: "Variance %", align: "right" },
      { key: "status", label: "Status", align: "left" },
    ],
    rows,
    notes: [
      "Variance = Actual − Budget.",
      "For expenses, a positive variance is unfavorable (over budget). For revenue, a positive variance is favorable.",
      "Mock budgets can be edited in this session; they are not copied from actuals unless you use Fill sample budget.",
      "Missing budget rows appear only when actual activity exists.",
    ],
    completeness: "available",
    recordCount: rows.filter((r) => !r.isSection).length,
  };
}

export function getSecurityDepositRegister(filters: ReportFilters, ds = getDataset()): ReportResult {
  const asOf = filters.asOfDate;
  const rows: ReportRow[] = [];
  ds.deposits.forEach((d) => {
    if (d.dateReceived > asOf) return;
    if (filters.propertyId !== "all" && d.propertyId !== filters.propertyId) return;
    if (filters.tenantId !== "all" && d.tenantId !== filters.tenantId) return;
    const refunded = d.status === "refunded" && d.dateReceived <= asOf ? d.amountRefunded : d.amountRefunded && d.status === "refunded" ? d.amountRefunded : 0;
    const effectiveRefund = d.status === "refunded" ? d.amountRefunded : 0;
    const liability = round2(d.amountReceived - effectiveRefund - d.amountApplied);
    const tenant = ds.tenants.find((t) => t.tenantId === d.tenantId);
    const property = ds.properties.find((p) => p.propertyId === d.propertyId);
    const unit = ds.units.find((u) => u.unitId === d.unitId);
    const lease = ds.leases.find((l) => l.leaseId === d.leaseId);
    rows.push(
      moneyRow(d.depositId, tenant?.tenantName ?? d.tenantId, liability, {
        meta: {
          tenant: tenant?.tenantName ?? "",
          property: property?.propertyName ?? "",
          unit: unit?.unitNumber ?? "",
          lease: lease?.leaseId ?? "",
          type: d.depositType,
          dateReceived: d.dateReceived,
          received: d.amountReceived,
          refunded: effectiveRefund,
          applied: d.amountApplied,
          liability,
          status: d.status,
          bank: ds.bankAccounts.find((b) => b.bankAccountId === d.bankAccountId)?.name ?? "",
          notes: d.notes,
        },
      }),
    );
  });
  const total = round2(sum(rows.map((r) => r.amount)));
  const gl = asOfBalanceByAccount(ds, filters).get("2100") ?? 0;
  rows.push(moneyRow("dep-total", "Total deposit liability", total, { isGrandTotal: true }));
  return {
    ...baseResult("security-deposit-register", "Security Deposit Liability Register", filters, ds),
    periodLabel: `As of ${longDate(asOf)}`,
    columns: [
      { key: "tenant", label: "Tenant", align: "left" },
      { key: "property", label: "Property", align: "left" },
      { key: "unit", label: "Unit", align: "left" },
      { key: "lease", label: "Lease", align: "left" },
      { key: "type", label: "Deposit type", align: "left" },
      { key: "dateReceived", label: "Date received", align: "left" },
      { key: "received", label: "Received", align: "right", format: "money" },
      { key: "refunded", label: "Refunded", align: "right", format: "money" },
      { key: "applied", label: "Applied", align: "right", format: "money" },
      { key: "liability", label: "Current liability", align: "right", format: "money" },
      { key: "status", label: "Status", align: "left" },
    ],
    rows,
    totals: { total, gl },
    notes: [
      "Security deposits are liabilities, not rental revenue.",
      `Register total ${total.toFixed(2)} vs GL 2100 ${gl.toFixed(2)}.`,
      "Deposits are held in the TD Deposit Trust account, separate from operating cash.",
      "Deposit treatment varies by jurisdiction. This register does not assume deposits may be applied to rent.",
    ],
    completeness: "available",
    recordCount: rows.length - 1,
  };
}

export function getGstHstSummary(filters: ReportFilters, ds = getDataset()): ReportResult {
  const invoices = ds.invoices.filter((i) => !i.isOpening && inRange(i.invoiceDate, filters.startDate, filters.endDate));
  const bills = ds.bills.filter((b) => !b.isOpening && inRange(b.billDate, filters.startDate, filters.endDate));
  const groups = new Map<string, { taxableSales: number; gst: number; hst: number; itc: number; exempt: number; zero: number; oos: number }>();
  const ensure = (id: string) => {
    if (!groups.has(id)) groups.set(id, { taxableSales: 0, gst: 0, hst: 0, itc: 0, exempt: 0, zero: 0, oos: 0 });
    return groups.get(id)!;
  };
  invoices.forEach((inv) => {
    if (filters.propertyId !== "all" && inv.propertyId !== filters.propertyId) return;
    inv.lines.forEach((line) => {
      const code = ds.taxCodes.find((t) => t.taxCodeId === line.taxCodeId);
      if (!code) return;
      const g = ensure(code.taxCodeId);
      if (code.treatment === "taxable") {
        g.taxableSales += line.amount;
        if (code.code.startsWith("HST")) g.hst += line.taxAmount;
        else g.gst += line.taxAmount;
      } else if (code.treatment === "exempt") g.exempt += line.amount;
      else if (code.treatment === "zero_rated") g.zero += line.amount;
      else g.oos += line.amount;
    });
  });
  bills.forEach((bill) => {
    if (filters.propertyId !== "all" && bill.propertyId && bill.propertyId !== filters.propertyId) return;
    bill.lines.forEach((line) => {
      const code = ds.taxCodes.find((t) => t.taxCodeId === line.taxCodeId);
      if (!code) return;
      const g = ensure(code.taxCodeId);
      if (line.itcEligible) g.itc += line.taxAmount;
    });
  });
  const rows: ReportRow[] = [];
  groups.forEach((g, id) => {
    const code = ds.taxCodes.find((t) => t.taxCodeId === id)!;
    const net = round2(g.gst + g.hst - g.itc);
    rows.push(
      moneyRow(id, `${code.code} — ${code.name}`, net, {
        meta: {
          code: code.code,
          treatment: code.treatment,
          taxableSales: round2(g.taxableSales),
          gst: round2(g.gst),
          hst: round2(g.hst),
          itc: round2(g.itc),
          exempt: round2(g.exempt),
          net,
        },
      }),
    );
  });
  return {
    ...baseResult("gst-hst-summary", "GST/HST Summary", filters, ds),
    columns: [
      { key: "code", label: "Tax code", align: "left" },
      { key: "treatment", label: "Treatment", align: "left" },
      { key: "taxableSales", label: "Taxable sales", align: "right", format: "money" },
      { key: "gst", label: "GST collected", align: "right", format: "money" },
      { key: "hst", label: "HST collected", align: "right", format: "money" },
      { key: "itc", label: "Input tax credits", align: "right", format: "money" },
      { key: "exempt", label: "Exempt amounts", align: "right", format: "money" },
      { key: "net", label: "Net tax", align: "right", format: "money" },
    ],
    rows,
    notes: [
      "Management summary of explicitly coded tax amounts. This is not a validated GST/HST return.",
      "Residential rental charges are coded EXEMPT. Commercial rent at King Street Commercial is coded HST-ON-13.",
      "Input tax credits are recorded only where a vendor bill line is marked ITC eligible.",
      "Tax treatment is not inferred from city or property name.",
    ],
    completeness: "available_with_limitations",
    completenessDetail: "Illustrative tax codes only — not a filed return.",
    recordCount: rows.length,
  };
}

export function getCashReceipts(filters: ReportFilters, ds = getDataset()): ReportResult {
  const receipts = ds.payments.filter((p) => {
    if (p.paymentStatus !== "posted") return false;
    if (!inRange(p.paymentDate, filters.startDate, filters.endDate)) return false;
    if (filters.tenantId !== "all" && p.tenantId !== filters.tenantId) return false;
    if (filters.paymentMethod !== "all" && p.paymentMethod !== filters.paymentMethod) return false;
    if (filters.bankAccountId !== "all" && p.bankAccountId !== filters.bankAccountId) return false;
    return true;
  });
  const rows = receipts.map((p) => {
    const tenant = ds.tenants.find((t) => t.tenantId === p.tenantId);
    const alloc = ds.allocations.filter((a) => a.paymentId === p.paymentId);
    const applied = round2(sum(alloc.map((a) => a.allocatedAmount)));
    const unapplied = round2(p.totalAmount - applied);
    const invoice = alloc[0] ? ds.invoices.find((i) => i.invoiceId === alloc[0].invoiceId) : undefined;
    if (filters.propertyId !== "all" && invoice && invoice.propertyId !== filters.propertyId) {
      return null;
    }
    return moneyRow(p.paymentId, `${tenant?.tenantName ?? p.tenantId} · ${p.paymentNumber}`, p.totalAmount, {
      sourceType: "payment",
      sourceId: p.paymentId,
      meta: {
        date: p.paymentDate,
        tenant: tenant?.tenantName ?? "",
        method: p.paymentMethod,
        bank: ds.bankAccounts.find((b) => b.bankAccountId === p.bankAccountId)?.name ?? "",
        applied,
        unapplied,
        reference: p.reference,
      },
    });
  }).filter((r): r is ReportRow => r !== null);
  const total = round2(sum(rows.map((r) => r.amount)));
  rows.push(moneyRow("cr-t", "Total receipts", total, { isGrandTotal: true }));
  return {
    ...baseResult("cash-receipts", "Cash Receipts Report", filters, ds),
    columns: [
      { key: "date", label: "Date", align: "left" },
      { key: "label", label: "Tenant / payment", align: "left" },
      { key: "method", label: "Method", align: "left" },
      { key: "bank", label: "Bank", align: "left" },
      { key: "applied", label: "Applied", align: "right", format: "money" },
      { key: "unapplied", label: "Unapplied", align: "right", format: "money" },
      { key: "amount", label: "Amount", align: "right", format: "money" },
    ],
    rows,
    totals: { total },
    notes: ["Receipts are payment transactions, not invoice totals. Unapplied amounts remain a liability until allocated."],
    completeness: "available",
    recordCount: rows.length - 1,
  };
}

export function getCashDisbursements(filters: ReportFilters, ds = getDataset()): ReportResult {
  const pays = ds.billPayments.filter((p) => {
    if (!inRange(p.paymentDate, filters.startDate, filters.endDate)) return false;
    if (filters.vendorId !== "all" && p.vendorId !== filters.vendorId) return false;
    if (filters.paymentMethod !== "all" && p.paymentMethod !== filters.paymentMethod) return false;
    if (filters.bankAccountId !== "all" && p.bankAccountId !== filters.bankAccountId) return false;
    return true;
  });
  const rows = pays.map((p) => {
    const vendor = ds.vendors.find((v) => v.vendorId === p.vendorId);
    return moneyRow(p.billPaymentId, `${vendor?.vendorName ?? p.vendorId} · ${p.reference}`, p.totalAmount, {
      sourceType: "billPayment",
      sourceId: p.billPaymentId,
      meta: {
        date: p.paymentDate,
        vendor: vendor?.vendorName ?? "",
        method: p.paymentMethod,
        bank: ds.bankAccounts.find((b) => b.bankAccountId === p.bankAccountId)?.name ?? "",
        reference: p.reference,
      },
    });
  });
  const mtg = postedEntries(ds, { transactionStatus: "posted" }).filter(
    (je) => je.sourceType === "mortgage_payment" && inRange(je.postingDate, filters.startDate, filters.endDate),
  );
  mtg.forEach((je) => {
    if (filters.propertyId !== "all" && je.propertyId !== filters.propertyId) return;
    const cash = je.lines.find((l) => l.accountId === "1020");
    rows.push(
      moneyRow(je.journalEntryId, je.description, cash ? cash.creditAmount : je.debitTotal, {
        sourceType: "journal",
        sourceId: je.journalEntryId,
        meta: { date: je.postingDate, vendor: "RBC Royal Bank", method: "pre-authorized", bank: "RBC Operating", reference: je.referenceNumber },
      }),
    );
  });
  const total = round2(sum(rows.map((r) => r.amount)));
  rows.push(moneyRow("cd-t", "Total disbursements", total, { isGrandTotal: true }));
  return {
    ...baseResult("cash-disbursements", "Cash Disbursements Report", filters, ds),
    columns: [
      { key: "date", label: "Date", align: "left" },
      { key: "label", label: "Payee", align: "left" },
      { key: "method", label: "Method", align: "left" },
      { key: "bank", label: "Bank", align: "left" },
      { key: "amount", label: "Amount", align: "right", format: "money" },
    ],
    rows,
    totals: { total },
    notes: ["Includes vendor bill payments and mortgage cash outflows. Accrued but unpaid bills are excluded."],
    completeness: "available",
    recordCount: rows.length - 1,
  };
}

export function getBankAccountActivity(filters: ReportFilters, ds = getDataset()): ReportResult {
  const accountId =
    filters.bankAccountId === "all"
      ? "1020"
      : ds.bankAccounts.find((b) => b.bankAccountId === filters.bankAccountId)?.accountId ?? "1020";
  return getAccountActivityReport({ ...filters, accountId }, ds);
}

export function getBankReconciliation(
  filters: ReportFilters,
  ds = getDataset(),
  matchOverrides: Record<string, boolean> = {},
): ReportResult {
  const bankId = filters.bankAccountId === "all" ? "BnkOp" : filters.bankAccountId;
  const statement = ds.bankStatements.find((s) => s.bankAccountId === bankId);
  const account = ds.bankAccounts.find((b) => b.bankAccountId === bankId);
  const txns = ds.bankTxns.filter((t) => t.bankAccountId === bankId && t.statementId === statement?.statementId);
  const matched = (t: (typeof txns)[number]) => (t.bankTxnId in matchOverrides ? matchOverrides[t.bankTxnId] : t.defaultMatched);
  const depositsInTransit = txns.filter((t) => t.type === "deposit" && !matched(t));
  const outstanding = txns.filter((t) => t.type === "withdrawal" && !matched(t));
  const gl = asOfBalanceByAccount(ds, { ...filters, asOfDate: statement?.endingDate ?? filters.asOfDate, propertyId: "all" });
  const book = gl.get(account?.accountId ?? "1020") ?? 0;
  const stmtBal = statement?.endingBalance ?? 0;
  const dit = round2(sum(depositsInTransit.map((t) => t.amount)));
  const op = round2(sum(outstanding.map((t) => Math.abs(t.amount))));
  const adjustedBank = round2(stmtBal + dit - op);
  const adjustedBook = book;
  const diff = round2(adjustedBank - adjustedBook);
  const rows: ReportRow[] = [
    moneyRow("stmt", "Statement ending balance (sample)", stmtBal, { isTotal: true }),
    moneyRow("dit", "Deposits in transit", dit, { indent: 1 }),
    moneyRow("out", "Outstanding payments", -op, { indent: 1 }),
    moneyRow("adjb", "Adjusted bank balance", adjustedBank, { isTotal: true }),
    moneyRow("book", "Book balance", book, { isTotal: true }),
    moneyRow("adjk", "Adjusted book balance", adjustedBook, { isTotal: true }),
    moneyRow("diff", "Difference", diff, { isGrandTotal: true }),
  ];
  txns.forEach((t) => {
    rows.push(
      moneyRow(t.bankTxnId, t.description, t.amount, {
        sourceType: "bankTxn",
        sourceId: t.bankTxnId,
        meta: {
          date: t.txnDate,
          type: t.type,
          matched: matched(t) ? "Matched" : "Unmatched",
          amount: t.amount,
        },
      }),
    );
  });
  return {
    ...baseResult("bank-reconciliation", "Bank Reconciliation Report", filters, ds),
    periodLabel: statement ? `${statement.periodStart} to ${statement.periodEnd}` : formatPeriodLabel(filters.startDate, filters.endDate),
    columns: [
      { key: "date", label: "Date", align: "left" },
      { key: "label", label: "Description", align: "left" },
      { key: "type", label: "Type", align: "left" },
      { key: "matched", label: "Status", align: "left" },
      { key: "amount", label: "Amount", align: "right", format: "money" },
    ],
    rows,
    totals: { stmtBal, book, dit, op, adjustedBank, adjustedBook, diff },
    notes: [
      "Bank statement ending balances are sample data for this mock workflow.",
      "Toggle matched / unmatched on individual transactions. The report does not auto-reconcile every line.",
      account ? `Account: ${account.name} ${account.accountNumberMasked}` : "",
    ].filter(Boolean),
    completeness: "available_with_limitations",
    completenessDetail: "Statement information is sample data.",
    recordCount: txns.length,
  };
}

export function getOutstandingInvoices(filters: ReportFilters, ds = getDataset()): ReportResult {
  const { result, rows } = getArAging(filters, ds);
  return { ...result, reportId: "outstanding-invoices", title: "Outstanding Invoices", rows: result.rows };
}

export function getTenantBalanceSummary(filters: ReportFilters, ds = getDataset()): ReportResult {
  const { rows } = getArAging(filters, ds);
  const grouped = new Map<string, { name: string; invoices: number; outstanding: number; unapplied: number }>();
  rows.forEach((r) => {
    const g = grouped.get(r.tenantId ?? r.name) ?? { name: r.name, invoices: 0, outstanding: 0, unapplied: 0 };
    g.invoices += 1;
    g.outstanding += r.outstanding;
    grouped.set(r.tenantId ?? r.name, g);
  });
  ds.payments.forEach((p) => {
    if (p.paymentDate > filters.asOfDate) return;
    const allocated = round2(sum(ds.allocations.filter((a) => a.paymentId === p.paymentId).map((a) => a.allocatedAmount)));
    const left = round2(p.totalAmount - allocated);
    if (left <= 0) return;
    const tenant = ds.tenants.find((t) => t.tenantId === p.tenantId);
    const key = p.tenantId;
    const g = grouped.get(key) ?? { name: tenant?.tenantName ?? key, invoices: 0, outstanding: 0, unapplied: 0 };
    g.unapplied = round2(g.unapplied + left);
    grouped.set(key, g);
  });
  const reportRows: ReportRow[] = [...grouped.entries()].map(([id, g]) =>
    moneyRow(id, g.name, round2(g.outstanding - g.unapplied), {
      sourceType: "tenant",
      sourceId: id,
      meta: { invoices: g.invoices, outstanding: round2(g.outstanding), unapplied: g.unapplied, net: round2(g.outstanding - g.unapplied) },
    }),
  );
  return {
    ...baseResult("tenant-balance-summary", "Tenant Balance Summary", filters, ds),
    periodLabel: `As of ${longDate(filters.asOfDate)}`,
    columns: [
      { key: "label", label: "Tenant", align: "left" },
      { key: "invoices", label: "Open invoices", align: "right" },
      { key: "outstanding", label: "Invoice outstanding", align: "right", format: "money" },
      { key: "unapplied", label: "Unapplied payments", align: "right", format: "money" },
      { key: "net", label: "Net balance", align: "right", format: "money" },
    ],
    rows: reportRows,
    notes: ["Net balance = outstanding invoices − unapplied payments. Unapplied cash is not forced against an invoice."],
    completeness: "available",
    recordCount: reportRows.length,
  };
}

export function getVendorBalanceSummary(filters: ReportFilters, ds = getDataset()): ReportResult {
  const { rows } = getApAging(filters, ds);
  const grouped = new Map<string, { name: string; bills: number; outstanding: number }>();
  rows.forEach((r) => {
    const g = grouped.get(r.vendorId ?? r.name) ?? { name: r.name, bills: 0, outstanding: 0 };
    g.bills += 1;
    g.outstanding += r.outstanding;
    grouped.set(r.vendorId ?? r.name, g);
  });
  const reportRows = [...grouped.entries()].map(([id, g]) =>
    moneyRow(id, g.name, round2(g.outstanding), {
      sourceType: "vendor",
      sourceId: id,
      meta: { bills: g.bills, outstanding: round2(g.outstanding) },
    }),
  );
  return {
    ...baseResult("vendor-balance-summary", "Vendor Balance Summary", filters, ds),
    periodLabel: `As of ${longDate(filters.asOfDate)}`,
    columns: [
      { key: "label", label: "Vendor", align: "left" },
      { key: "bills", label: "Open bills", align: "right" },
      { key: "outstanding", label: "Outstanding", align: "right", format: "money" },
    ],
    rows: reportRows,
    notes: ["Balances are unpaid vendor bills, not expense totals."],
    completeness: "available",
    recordCount: reportRows.length,
  };
}

export function getCapexReport(filters: ReportFilters, ds = getDataset()): ReportResult {
  const bills = ds.bills.filter((b) => b.lines.some((l) => l.isCapital) && inRange(b.billDate, filters.startDate, filters.endDate));
  const rows = bills
    .filter((b) => filters.propertyId === "all" || b.propertyId === filters.propertyId)
    .map((b) =>
      moneyRow(b.billId, `${b.billReference} — ${ds.vendors.find((v) => v.vendorId === b.vendorId)?.vendorName}`, b.totalAmount, {
        sourceType: "bill",
        sourceId: b.billId,
        meta: {
          date: b.billDate,
          property: ds.properties.find((p) => p.propertyId === b.propertyId)?.propertyName ?? "",
          vendor: ds.vendors.find((v) => v.vendorId === b.vendorId)?.vendorName ?? "",
          account: "1510 Building Improvements",
          status: b.paymentStatus,
        },
      }),
    );
  const total = round2(sum(rows.map((r) => r.amount)));
  rows.push(moneyRow("cap-t", "Total capital expenditures", total, { isGrandTotal: true }));
  return {
    ...baseResult("capital-expenditure", "Capital Expenditure Report", filters, ds),
    columns: [
      { key: "date", label: "Date", align: "left" },
      { key: "label", label: "Item", align: "left" },
      { key: "property", label: "Property", align: "left" },
      { key: "vendor", label: "Vendor", align: "left" },
      { key: "status", label: "Payment", align: "left" },
      { key: "amount", label: "Amount", align: "right", format: "money" },
    ],
    rows,
    totals: { total },
    notes: ["Capitalized costs are posted to Building Improvements (1510), not operating expenses or NOI."],
    completeness: "available",
    recordCount: rows.length - 1,
  };
}

export function getRentalIncomeByProperty(filters: ReportFilters, ds = getDataset()): ReportResult {
  const ie = getIncomeExpenseByProperty(filters, ds);
  return { ...ie, reportId: "rental-income-by-property", title: "Rental Income by Property" };
}

export function getPropertyProfitability(filters: ReportFilters, ds = getDataset()): ReportResult {
  const selected = ds.properties.filter((p) => filters.propertyId === "all" || p.propertyId === filters.propertyId);
  const rows: ReportRow[] = selected
    .map((p) => {
      const map = periodPnlByAccount(ds, { ...filters, propertyId: p.propertyId });
      let rev = 0;
      let opex = 0;
      let interest = 0;
      let dep = 0;
      let other = 0;
      ds.accounts.forEach((a) => {
        const amt = map.get(a.accountId) ?? 0;
        if (a.accountType === "revenue") rev += amt;
        else if (a.isOperating && a.accountType === "expense") opex += amt;
        else if (a.pnlSection === "interest") interest += amt;
        else if (a.pnlSection === "depreciation") dep += amt;
        else if (a.accountType === "expense") other += amt;
      });
      const noi = round2(rev - opex);
      const ni = round2(rev - opex - interest - dep - other);
      return moneyRow(p.propertyId, p.propertyName, noi, {
        propertyId: p.propertyId,
        meta: { rev: round2(rev), opex: round2(opex), noi, interest: round2(interest), dep: round2(dep), ni, margin: rev > 0 ? round2((noi / rev) * 100) : "n/a" },
      });
    })
    .sort((a, b) => b.amount - a.amount);
  return {
    ...baseResult("property-profitability", "Property Profitability Comparison", filters, ds),
    columns: [
      { key: "label", label: "Property", align: "left" },
      { key: "rev", label: "Operating revenue", align: "right", format: "money" },
      { key: "opex", label: "Operating expenses", align: "right", format: "money" },
      { key: "noi", label: "NOI", align: "right", format: "money" },
      { key: "interest", label: "Interest", align: "right", format: "money" },
      { key: "dep", label: "Depreciation", align: "right", format: "money" },
      { key: "ni", label: "Net income", align: "right", format: "money" },
    ],
    rows,
    charts: [{ id: "rank", type: "bar", title: "NOI ranking", data: rows.map((r) => ({ label: r.label, value: r.amount })) }],
    notes: ["Ranked by NOI. Financing costs and depreciation are shown separately from operating results."],
    completeness: "available",
    recordCount: rows.length,
  };
}

export function getOperatingExpenseRatio(filters: ReportFilters, ds = getDataset()): ReportResult {
  const ie = getIncomeExpenseByProperty(filters, ds);
  const rows = ie.rows.map((r) => {
    const rev = Number(r.meta?.rev ?? 0);
    const opex = Number(r.meta?.opex ?? 0);
    const ratio = rev > 0 ? round2((opex / rev) * 100) : null;
    return moneyRow(r.id, r.label, opex, {
      propertyId: r.propertyId,
      isGrandTotal: r.isGrandTotal,
      meta: { ...r.meta, oer: ratio ?? "n/a" },
    });
  });
  return {
    ...ie,
    reportId: "operating-expense-ratio",
    title: "Operating Expense Ratio",
    rows,
    columns: [
      { key: "label", label: "Property", align: "left" },
      { key: "rev", label: "Operating revenue", align: "right", format: "money" },
      { key: "opex", label: "Operating expenses", align: "right", format: "money" },
      { key: "oer", label: "OER", align: "right" },
    ],
    notes: ["OER = Operating expenses ÷ Operating revenue. Financing and capital expenditures are excluded."],
  };
}

export function getPropertyTaxReport(filters: ReportFilters, ds = getDataset()): ReportResult {
  const map = periodPnlByAccount(ds, filters);
  const amount = map.get("5300") ?? 0;
  const bills = ds.bills.filter(
    (b) =>
      b.expenseCategory === "Property Taxes" &&
      inRange(b.billDate, filters.startDate, filters.endDate) &&
      (filters.propertyId === "all" || b.propertyId === filters.propertyId),
  );
  const rows = bills.map((b) =>
    moneyRow(b.billId, b.billReference, b.totalAmount, {
      sourceType: "bill",
      sourceId: b.billId,
      meta: {
        date: b.billDate,
        property: ds.properties.find((p) => p.propertyId === b.propertyId)?.propertyName ?? "Unallocated",
        vendor: ds.vendors.find((v) => v.vendorId === b.vendorId)?.vendorName ?? "",
        status: b.paymentStatus,
      },
    }),
  );
  rows.push(moneyRow("pt-gl", "GL Property tax expense (5300)", amount, { isGrandTotal: true, accountId: "5300" }));
  return {
    ...baseResult("property-tax", "Property Tax Expense Report", filters, ds),
    columns: [
      { key: "date", label: "Date", align: "left" },
      { key: "label", label: "Bill", align: "left" },
      { key: "property", label: "Property", align: "left" },
      { key: "vendor", label: "Vendor", align: "left" },
      { key: "status", label: "Payment", align: "left" },
      { key: "amount", label: "Amount", align: "right", format: "money" },
    ],
    rows,
    notes: ["Property tax is an operating expense and is not a financing item."],
    completeness: "available",
    recordCount: bills.length,
  };
}

export function getLoanMortgageSummary(filters: ReportFilters, ds = getDataset()): ReportResult {
  const asOf = filters.asOfDate;
  const rows: ReportRow[] = ds.mortgages
    .filter((m) => filters.propertyId === "all" || m.propertyId === filters.propertyId)
    .map((m) => {
      const gl = asOfBalanceByAccount(ds, { ...filters, propertyId: m.propertyId });
      const balance = gl.get(m.accountId) ?? 0;
      const interest = periodPnlByAccount(ds, { ...filters, propertyId: m.propertyId }).get("6000") ?? 0;
      const principalPaid = round2(m.openingBalance - balance);
      return moneyRow(m.mortgageId, `${ds.properties.find((p) => p.propertyId === m.propertyId)?.propertyName} — ${m.lender}`, balance, {
        propertyId: m.propertyId,
        accountId: m.accountId,
        meta: {
          rate: `${(m.interestRate * 100).toFixed(2)}%`,
          payment: m.monthlyPayment,
          opening: m.openingBalance,
          balance,
          interest,
          principalPaid,
          maturity: m.maturityDate,
        },
      });
    });
  return {
    ...baseResult("loan-mortgage-summary", "Loan & Mortgage Summary", filters, ds),
    columns: [
      { key: "label", label: "Loan", align: "left" },
      { key: "rate", label: "Rate", align: "left" },
      { key: "payment", label: "Monthly payment", align: "right", format: "money" },
      { key: "opening", label: "Opening (2025-01-01)", align: "right", format: "money" },
      { key: "principalPaid", label: "Principal paid in period (approx.)", align: "right", format: "money" },
      { key: "interest", label: "Interest (period)", align: "right", format: "money" },
      { key: "balance", label: "Balance as of date", align: "right", format: "money" },
    ],
    rows,
    notes: [
      `Balances as of ${longDate(asOf)} from the mortgage payable GL accounts.`,
      "Principal repayments reduce the liability and are not operating expenses. Interest is reported on the P&L.",
      "Lakeside Duplex and King Street Commercial have no mortgages in this dataset.",
    ],
    completeness: "available",
    recordCount: rows.length,
  };
}

export function getYearEndPackage(filters: ReportFilters, ds = getDataset()): ReportResult {
  const year = filters.fiscalYear;
  const yearFilters: ReportFilters = {
    ...filters,
    periodPreset: "fiscal-year",
    startDate: `${year}-01-01`,
    endDate: year === Number(ds.today.slice(0, 4)) ? ds.today : `${year}-12-31`,
    asOfDate: year === Number(ds.today.slice(0, 4)) ? ds.today : `${year}-12-31`,
  };
  const included = [
    "profit-and-loss",
    "balance-sheet",
    "cash-flow",
    "trial-balance",
    "general-ledger",
    "ar-aging",
    "ap-aging",
    "security-deposit-register",
    "income-expense-by-property",
    "gst-hst-summary",
  ];
  const rows = included.map((id) => {
    const def = REPORT_CATALOG.find((r) => r.reportId === id)!;
    return moneyRow(id, def.name, 0, {
      sourceType: "report",
      sourceId: id,
      meta: { status: def.availability, description: def.description },
    });
  });
  return {
    ...baseResult("year-end-package", "Year-End Financial Package", yearFilters, ds),
    periodLabel: `Fiscal year ${year}`,
    columns: [
      { key: "label", label: "Included report", align: "left" },
      { key: "status", label: "Availability", align: "left" },
      { key: "description", label: "Description", align: "left" },
    ],
    rows,
    notes: [
      "This package is a management compilation of the listed reports. It has not been audited, certified, or approved by an accountant.",
      "Open each report individually or use Print / PDF on this page to produce a combined print package.",
      "GST/HST is a management summary only.",
    ],
    completeness: "available",
    recordCount: included.length,
  };
}

export function getKpis(filters: ReportFilters, ds = getDataset()) {
  const pnl = getProfitAndLoss({ ...filters, comparison: true }, ds);
  const ar = getArAging({ ...filters, asOfDate: filters.endDate }, ds);
  const prior = previousPeriod(filters.startDate, filters.endDate);
  const priorPnl = getProfitAndLoss({ ...filters, startDate: prior.startDate, endDate: prior.endDate, asOfDate: prior.endDate, comparison: false }, ds);
  const revenue = pnl.totals?.totalRevenue ?? 0;
  const opex = pnl.totals?.totalOpex ?? 0;
  const noi = pnl.totals?.noi ?? 0;
  const receivables = ar.result.totals?.outstanding ?? 0;
  const priorRev = priorPnl.totals?.totalRevenue ?? 0;
  const priorOpex = priorPnl.totals?.totalOpex ?? 0;
  const priorNoi = priorPnl.totals?.noi ?? 0;
  const priorAr = getArAging({ ...filters, asOfDate: prior.endDate }, ds).result.totals?.outstanding ?? 0;
  return [
    {
      id: "rev",
      label: "Total Rental Revenue",
      value: revenue,
      period: formatPeriodLabel(filters.startDate, filters.endDate),
      change: pctChange(revenue, priorRev),
      href: "/reports/financial/profit-and-loss",
      hint: "Revenue accounts in the selected period using the selected accounting basis.",
    },
    {
      id: "opex",
      label: "Total Operating Expenses",
      value: opex,
      period: formatPeriodLabel(filters.startDate, filters.endDate),
      change: pctChange(opex, priorOpex),
      href: "/reports/financial/expense-analysis",
      hint: "Operating expense accounts only. Excludes interest, depreciation, capex, and principal.",
    },
    {
      id: "noi",
      label: "Net Operating Income",
      value: noi,
      period: formatPeriodLabel(filters.startDate, filters.endDate),
      change: pctChange(noi, priorNoi),
      href: "/reports/financial/noi-by-property",
      hint: "NOI = Total revenue − operating expenses.",
    },
    {
      id: "ar",
      label: "Outstanding Receivables",
      value: receivables,
      period: `As of ${longDate(filters.endDate)}`,
      change: pctChange(receivables, priorAr),
      href: "/reports/financial/ar-aging",
      hint: "Unpaid tenant invoices as of the period end date, after allocations and credits.",
    },
  ];
}

export function getFinancialReport(
  reportId: string,
  filters: ReportFilters,
  extras?: { budgetOverrides?: BudgetLine[]; matchOverrides?: Record<string, boolean> },
): ReportResult {
  const ds = getDataset();
  switch (reportId) {
    case "profit-and-loss":
      return getProfitAndLoss(filters, ds);
    case "balance-sheet":
      return getBalanceSheet(filters, ds);
    case "trial-balance":
      return getTrialBalance(filters, ds);
    case "general-ledger":
      return getGeneralLedger(filters, ds);
    case "journal-entry-report":
      return getJournalEntryReport(filters, ds);
    case "account-activity":
      return getAccountActivityReport(filters, ds);
    case "cash-flow":
      return getCashFlowStatement(filters, ds);
    case "income-expense-by-property":
      return getIncomeExpenseByProperty(filters, ds);
    case "noi-by-property":
      return getNoiByProperty(filters, ds);
    case "expense-analysis":
      return getExpenseAnalysis(filters, ds);
    case "revenue-analysis":
      return getRevenueAnalysis(filters, ds);
    case "budget-vs-actual":
      return getBudgetVsActual(filters, ds, extras?.budgetOverrides);
    case "ar-aging":
      return getArAging(filters, ds).result;
    case "ap-aging":
      return getApAging(filters, ds).result;
    case "outstanding-invoices":
      return getOutstandingInvoices(filters, ds);
    case "tenant-balance-summary":
      return getTenantBalanceSummary(filters, ds);
    case "vendor-balance-summary":
      return getVendorBalanceSummary(filters, ds);
    case "security-deposit-register":
      return getSecurityDepositRegister(filters, ds);
    case "gst-hst-summary":
      return getGstHstSummary(filters, ds);
    case "cash-receipts":
      return getCashReceipts(filters, ds);
    case "cash-disbursements":
      return getCashDisbursements(filters, ds);
    case "bank-account-activity":
      return getBankAccountActivity(filters, ds);
    case "bank-reconciliation":
      return getBankReconciliation(filters, ds, extras?.matchOverrides);
    case "capital-expenditure":
      return getCapexReport(filters, ds);
    case "rental-income-by-property":
      return getRentalIncomeByProperty(filters, ds);
    case "property-profitability":
      return getPropertyProfitability(filters, ds);
    case "operating-expense-ratio":
      return getOperatingExpenseRatio(filters, ds);
    case "property-tax":
      return getPropertyTaxReport(filters, ds);
    case "loan-mortgage-summary":
      return getLoanMortgageSummary(filters, ds);
    case "year-end-package":
      return getYearEndPackage(filters, ds);
    default:
      return {
        reportId,
        title: "Unknown report",
        companyName: COMPANY.name,
        propertyLabel: "—",
        periodLabel: "",
        generatedAt: new Date().toISOString(),
        filters,
        columns: [],
        rows: [],
        notes: ["This report id is not recognized."],
        completeness: "planned",
      };
  }
}

void formatPercent;
void COMPANY;
