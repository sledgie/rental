import { isSupabaseConfigured } from "../../../lib/supabase";
import { emptyDataset } from "./live";
import type {
  BankStatement,
  BankTxn,
  BillPayment,
  BillPaymentAllocation,
  BudgetLine,
  Dataset,
  Invoice,
  JournalEntry,
  JournalLine,
  JournalSourceType,
  Payment,
  PaymentAllocation,
  SecurityDeposit,
  VendorBill,
} from "../types";
import { round2, sum } from "../utils/currency";
import { addDays, addMonths, endOfMonth, inRange, monthsInRange, startOfMonth } from "../utils/dates";
import {
  ACCUM_DEP,
  accounts,
  bankAccounts,
  BUILDING_COST,
  FURNITURE_COST,
  IMPROVEMENT_COST,
  leases,
  mortgages,
  owners,
  portfolios,
  properties,
  taxCodes,
  tenants,
  units,
  vendors,
} from "./entities";
import { APP_TODAY, COMPANY } from "./constants";

function money(n: number): number {
  return round2(n);
}

export function buildDataset(): Dataset {
  const invoices: Invoice[] = [];
  const payments: Payment[] = [];
  const allocations: PaymentAllocation[] = [];
  const bills: VendorBill[] = [];
  const billPayments: BillPayment[] = [];
  const billAllocations: BillPaymentAllocation[] = [];
  const deposits: SecurityDeposit[] = [];
  const journalEntries: JournalEntry[] = [];
  const budgets: BudgetLine[] = [];
  const bankStatements: BankStatement[] = [];
  const bankTxns: BankTxn[] = [];

  let invSeq = 1;
  let paySeq = 1;
  let billSeq = 1;
  let bpSeq = 1;
  let jeSeq = 1;
  let lineSeq = 1;
  let allocSeq = 1;
  let ballocSeq = 1;
  let depSeq = 1;

  const next = (prefix: string, seq: number) => `${prefix}-${String(seq).padStart(5, "0")}`;

  function postJournal(input: {
    date: string;
    postingDate?: string;
    description: string;
    reference: string;
    sourceType: JournalSourceType;
    sourceId: string;
    propertyId: string | null;
    cashFlowClass: JournalEntry["cashFlowClass"];
    status?: JournalEntry["status"];
    lines: Array<Omit<JournalLine, "journalLineId" | "journalEntryId">>;
  }): JournalEntry {
    const journalEntryId = `JE-${String(jeSeq).padStart(5, "0")}`;
    const journalEntryNumber = next("JE", jeSeq++);
    const lines: JournalLine[] = input.lines.map((l) => ({
      ...l,
      debitAmount: money(l.debitAmount),
      creditAmount: money(l.creditAmount),
      journalLineId: `JL-${String(lineSeq++).padStart(6, "0")}`,
      journalEntryId,
    }));
    const debitTotal = money(sum(lines.map((l) => l.debitAmount)));
    const creditTotal = money(sum(lines.map((l) => l.creditAmount)));
    if (debitTotal !== creditTotal) {
      throw new Error(
        `Unbalanced ${journalEntryNumber}: ${debitTotal} Dr vs ${creditTotal} Cr (${input.description})`,
      );
    }
    const entry: JournalEntry = {
      journalEntryId,
      journalEntryNumber,
      transactionDate: input.date,
      postingDate: input.postingDate ?? input.date,
      description: input.description,
      referenceNumber: input.reference,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      propertyId: input.propertyId,
      status: input.status ?? "posted",
      debitTotal,
      creditTotal,
      cashFlowClass: input.cashFlowClass,
      lines,
    };
    journalEntries.push(entry);
    return entry;
  }

  /* ---------- Opening balances 2024-12-31 ---------- */
  const openingLines: Array<Omit<JournalLine, "journalLineId" | "journalEntryId">> = [];
  const pushOpen = (
    accountId: string,
    debit: number,
    credit: number,
    propertyId: string | null,
    description: string,
  ) => {
    if (money(debit) === 0 && money(credit) === 0) return;
    openingLines.push({
      accountId,
      debitAmount: money(debit),
      creditAmount: money(credit),
      propertyId,
      description,
      tenantId: null,
      vendorId: null,
      unitId: null,
    });
  };

  pushOpen("1020", 185000, 0, null, "Opening operating cash");
  pushOpen("1030", 42500, 0, null, "Opening deposit trust cash");

  pushOpen("1100", 1750, 0, "P1", "Opening AR — Patel Dec 2024");
  pushOpen("1100", 2100, 0, "P1", "Opening AR — Williams Dec 2024");
  pushOpen("1100", 800, 0, "P1", "Opening AR — Chen late fee");
  pushOpen("1100", 2200, 0, "P3", "Opening AR — Rossi Dec 2024");
  pushOpen("1100", 1550, 0, "P4", "Opening AR — Fraser Dec 2024");

  pushOpen("1200", 4082.47, 0, "P1", "Opening prepaid insurance");
  pushOpen("1200", 3513.4, 0, "P2", "Opening prepaid insurance");
  pushOpen("1200", 1929.9, 0, "P3", "Opening prepaid insurance");
  pushOpen("1200", 1039.18, 0, "P4", "Opening prepaid insurance");
  pushOpen("1200", 1435.05, 0, "P5", "Opening prepaid insurance");

  (Object.keys(BUILDING_COST) as Array<keyof typeof BUILDING_COST>).forEach((pid) => {
    pushOpen("1500", BUILDING_COST[pid], 0, pid, "Opening buildings");
    pushOpen("1510", IMPROVEMENT_COST[pid], 0, pid, "Opening improvements");
    pushOpen("1520", FURNITURE_COST[pid], 0, pid, "Opening furniture");
    pushOpen("1590", 0, ACCUM_DEP[pid], pid, "Opening accumulated depreciation");
  });

  pushOpen("2000", 0, 4200, "P1", "Opening AP — City of Toronto tax");
  pushOpen("2000", 0, 2600, "P5", "Opening AP — City of Toronto tax King");
  pushOpen("2000", 0, 2400, "P1", "Opening AP — TrueNorth HVAC");
  pushOpen("2000", 0, 1200, "P5", "Opening AP — CleanPro");
  pushOpen("2000", 0, 1850, "P1", "Opening AP — Hydro One");
  pushOpen("2000", 0, 1950, null, "Opening AP — Summit Insurance");

  pushOpen("2100", 0, 2350, "P1", "Deposits — Chen");
  pushOpen("2100", 0, 2150, "P1", "Deposits — Patel");
  pushOpen("2100", 0, 1850, "P1", "Deposits — Blake");
  pushOpen("2100", 0, 2600, "P1", "Deposits — Williams");
  pushOpen("2100", 0, 3000, "P2", "Deposits — Nguyen");
  pushOpen("2100", 0, 2750, "P2", "Deposits — Kowalski");
  pushOpen("2100", 0, 3000, "P2", "Deposits — Singh");
  pushOpen("2100", 0, 2550, "P3", "Deposits — O'Brien");
  pushOpen("2100", 0, 2600, "P3", "Deposits — Rossi");
  pushOpen("2100", 0, 2450, "P3", "Deposits — MacDonald");
  pushOpen("2100", 0, 2050, "P4", "Deposits — Dubois");
  pushOpen("2100", 0, 1900, "P4", "Deposits — Fraser");
  pushOpen("2100", 0, 11250, "P5", "Deposits — Northstar");
  pushOpen("2100", 0, 150, "P1", "Key deposits — Maple");
  pushOpen("2100", 0, 200, "P2", "Key deposits — Harbour");
  pushOpen("2100", 0, 150, "P3", "Key deposits — Cedar");
  pushOpen("2100", 0, 1500, "P5", "Additional commercial deposit");

  pushOpen("2200", 0, 6800, null, "Opening accrued expenses");
  pushOpen("2300", 0, 2400, "P5", "Opening GST/HST payable");
  pushOpen("2500", 0, 1850000, "P1", "Opening mortgage Maple Ridge");
  pushOpen("2510", 0, 1420000, "P2", "Opening mortgage Harbourview");
  pushOpen("2520", 0, 680000, "P3", "Opening mortgage Cedar Grove");
  pushOpen("3000", 0, 850000, null, "Opening owner contributions");
  pushOpen("3100", 180000, 0, null, "Opening owner distributions");
  pushOpen("3200", 0, 297000, null, "Opening retained earnings");

  const openDr = money(sum(openingLines.map((l) => l.debitAmount)));
  const openCr = money(sum(openingLines.map((l) => l.creditAmount)));
  if (openDr !== openCr) {
    const diff = money(openDr - openCr);
    if (diff > 0) pushOpen("3200", 0, diff, null, "Opening balance plug to retained earnings");
    else pushOpen("3200", Math.abs(diff), 0, null, "Opening balance plug to retained earnings");
  }

  postJournal({
    date: "2024-12-31",
    description: "Opening balances as at 31 December 2024",
    reference: "OPEN-2025",
    sourceType: "opening_balance",
    sourceId: "OPEN-2025",
    propertyId: null,
    cashFlowClass: "none",
    lines: openingLines,
  });

  /* ---------- Security deposits ---------- */
  const seedDeposits: Array<Omit<SecurityDeposit, "depositId">> = [
    { tenantId: "T01", propertyId: "P1", unitId: "U101", leaseId: "L01", depositType: "security", dateReceived: "2023-05-28", amountReceived: 1850, amountRefunded: 0, amountApplied: 0, status: "held", bankAccountId: "BnkTr", notes: "Held in TD Deposit Trust. Not rental revenue." },
    { tenantId: "T01", propertyId: "P1", unitId: "U101", leaseId: "L01", depositType: "pet", dateReceived: "2023-05-28", amountReceived: 500, amountRefunded: 0, amountApplied: 0, status: "held", bankAccountId: "BnkTr", notes: "Pet damage deposit held in trust." },
    { tenantId: "T02", propertyId: "P1", unitId: "U102", leaseId: "L02", depositType: "security", dateReceived: "2023-12-20", amountReceived: 1750, amountRefunded: 0, amountApplied: 0, status: "held", bankAccountId: "BnkTr", notes: "Held in trust." },
    { tenantId: "T02", propertyId: "P1", unitId: "U102", leaseId: "L02", depositType: "pet", dateReceived: "2023-12-20", amountReceived: 400, amountRefunded: 0, amountApplied: 0, status: "held", bankAccountId: "BnkTr", notes: "Pet deposit held in trust." },
    { tenantId: "T03", propertyId: "P1", unitId: "U201", leaseId: "L03", depositType: "security", dateReceived: "2021-12-15", amountReceived: 1850, amountRefunded: 1850, amountApplied: 0, status: "refunded", bankAccountId: "BnkTr", notes: "Full refund after move-out inspection. Not treated as revenue." },
    { tenantId: "T04", propertyId: "P1", unitId: "U202", leaseId: "L04", depositType: "security", dateReceived: "2023-08-20", amountReceived: 2100, amountRefunded: 0, amountApplied: 0, status: "held", bankAccountId: "BnkTr", notes: "Held in trust." },
    { tenantId: "T04", propertyId: "P1", unitId: "U202", leaseId: "L04", depositType: "pet", dateReceived: "2023-08-20", amountReceived: 500, amountRefunded: 0, amountApplied: 0, status: "held", bankAccountId: "BnkTr", notes: "Pet deposit." },
    { tenantId: "T05", propertyId: "P2", unitId: "U501", leaseId: "L05", depositType: "security", dateReceived: "2024-02-20", amountReceived: 2400, amountRefunded: 0, amountApplied: 0, status: "held", bankAccountId: "BnkTr", notes: "Held in trust." },
    { tenantId: "T05", propertyId: "P2", unitId: "U501", leaseId: "L05", depositType: "pet", dateReceived: "2024-02-20", amountReceived: 600, amountRefunded: 0, amountApplied: 0, status: "held", bankAccountId: "BnkTr", notes: "Pet deposit." },
    { tenantId: "T06", propertyId: "P2", unitId: "U502", leaseId: "L06", depositType: "security", dateReceived: "2023-10-18", amountReceived: 2350, amountRefunded: 0, amountApplied: 0, status: "held", bankAccountId: "BnkTr", notes: "Held in trust." },
    { tenantId: "T06", propertyId: "P2", unitId: "U502", leaseId: "L06", depositType: "pet", dateReceived: "2023-10-18", amountReceived: 400, amountRefunded: 0, amountApplied: 0, status: "held", bankAccountId: "BnkTr", notes: "Pet deposit." },
    { tenantId: "T07", propertyId: "P2", unitId: "U503", leaseId: "L07", depositType: "security", dateReceived: "2024-06-15", amountReceived: 2500, amountRefunded: 0, amountApplied: 0, status: "held", bankAccountId: "BnkTr", notes: "Held in trust." },
    { tenantId: "T07", propertyId: "P2", unitId: "U503", leaseId: "L07", depositType: "pet", dateReceived: "2024-06-15", amountReceived: 500, amountRefunded: 0, amountApplied: 0, status: "held", bankAccountId: "BnkTr", notes: "Pet deposit." },
    { tenantId: "T08", propertyId: "P3", unitId: "UA", leaseId: "L08", depositType: "security", dateReceived: "2023-03-20", amountReceived: 2200, amountRefunded: 0, amountApplied: 0, status: "held", bankAccountId: "BnkTr", notes: "Held in trust." },
    { tenantId: "T08", propertyId: "P3", unitId: "UA", leaseId: "L08", depositType: "pet", dateReceived: "2023-03-20", amountReceived: 350, amountRefunded: 0, amountApplied: 0, status: "held", bankAccountId: "BnkTr", notes: "Pet deposit." },
    { tenantId: "T09", propertyId: "P3", unitId: "UB", leaseId: "L09", depositType: "security", dateReceived: "2024-01-18", amountReceived: 2200, amountRefunded: 0, amountApplied: 0, status: "held", bankAccountId: "BnkTr", notes: "Held in trust." },
    { tenantId: "T09", propertyId: "P3", unitId: "UB", leaseId: "L09", depositType: "pet", dateReceived: "2024-01-18", amountReceived: 400, amountRefunded: 0, amountApplied: 0, status: "held", bankAccountId: "BnkTr", notes: "Pet deposit." },
    { tenantId: "T10", propertyId: "P3", unitId: "UC", leaseId: "L10", depositType: "security", dateReceived: "2023-07-20", amountReceived: 2150, amountRefunded: 0, amountApplied: 0, status: "held", bankAccountId: "BnkTr", notes: "Held in trust." },
    { tenantId: "T10", propertyId: "P3", unitId: "UC", leaseId: "L10", depositType: "pet", dateReceived: "2023-07-20", amountReceived: 300, amountRefunded: 0, amountApplied: 0, status: "held", bankAccountId: "BnkTr", notes: "Pet deposit." },
    { tenantId: "T11", propertyId: "P4", unitId: "UUP", leaseId: "L11", depositType: "security", dateReceived: "2024-04-16", amountReceived: 1650, amountRefunded: 0, amountApplied: 0, status: "held", bankAccountId: "BnkTr", notes: "Held in trust." },
    { tenantId: "T11", propertyId: "P4", unitId: "UUP", leaseId: "L11", depositType: "pet", dateReceived: "2024-04-16", amountReceived: 400, amountRefunded: 0, amountApplied: 0, status: "held", bankAccountId: "BnkTr", notes: "Pet deposit." },
    { tenantId: "T12", propertyId: "P4", unitId: "ULW", leaseId: "L12", depositType: "security", dateReceived: "2022-09-20", amountReceived: 1550, amountRefunded: 0, amountApplied: 0, status: "held", bankAccountId: "BnkTr", notes: "Held in trust." },
    { tenantId: "T12", propertyId: "P4", unitId: "ULW", leaseId: "L12", depositType: "pet", dateReceived: "2022-09-20", amountReceived: 350, amountRefunded: 0, amountApplied: 0, status: "held", bankAccountId: "BnkTr", notes: "Pet deposit." },
    { tenantId: "T13", propertyId: "P5", unitId: "US100", leaseId: "L13", depositType: "security", dateReceived: "2022-12-15", amountReceived: 9600, amountRefunded: 0, amountApplied: 0, status: "held", bankAccountId: "BnkTr", notes: "Two months commercial rent held in trust. Not revenue." },
    { tenantId: "T13", propertyId: "P5", unitId: "US100", leaseId: "L13", depositType: "last_month", dateReceived: "2022-12-15", amountReceived: 1650, amountRefunded: 0, amountApplied: 0, status: "held", bankAccountId: "BnkTr", notes: "Additional commercial deposit held in trust." },
  ];
  seedDeposits.forEach((d) => {
    deposits.push({ depositId: next("DEP", depSeq++), ...d });
  });
  deposits.push({
    depositId: next("DEP", depSeq++),
    tenantId: "T01",
    propertyId: "P1",
    unitId: "U101",
    leaseId: "L01",
    depositType: "key",
    dateReceived: "2023-05-28",
    amountReceived: 150,
    amountRefunded: 0,
    amountApplied: 0,
    status: "held",
    bankAccountId: "BnkTr",
    notes: "Key deposit held in trust.",
  });
  deposits.push({
    depositId: next("DEP", depSeq++),
    tenantId: "T05",
    propertyId: "P2",
    unitId: "U501",
    leaseId: "L05",
    depositType: "key",
    dateReceived: "2024-02-20",
    amountReceived: 200,
    amountRefunded: 0,
    amountApplied: 0,
    status: "held",
    bankAccountId: "BnkTr",
    notes: "Key deposit held in trust.",
  });
  deposits.push({
    depositId: next("DEP", depSeq++),
    tenantId: "T08",
    propertyId: "P3",
    unitId: "UA",
    leaseId: "L08",
    depositType: "key",
    dateReceived: "2023-03-20",
    amountReceived: 150,
    amountRefunded: 0,
    amountApplied: 0,
    status: "held",
    bankAccountId: "BnkTr",
    notes: "Key deposit held in trust.",
  });
  deposits.push({
    depositId: next("DEP", depSeq++),
    tenantId: "T13",
    propertyId: "P5",
    unitId: "US100",
    leaseId: "L13",
    depositType: "key",
    dateReceived: "2022-12-15",
    amountReceived: 1500,
    amountRefunded: 0,
    amountApplied: 0,
    status: "held",
    bankAccountId: "BnkTr",
    notes: "Access fob / key deposit held in trust.",
  });

  /* ---------- Opening invoices (no P&L JE) ---------- */
  function addInvoice(inv: Omit<Invoice, "invoiceId" | "invoiceNumber"> & { invoiceNumber?: string }): Invoice {
    const invoiceId = `INV-${String(invSeq).padStart(5, "0")}`;
    const invoiceNumber = inv.invoiceNumber ?? next("INV", invSeq);
    invSeq += 1;
    const full: Invoice = { ...inv, invoiceId, invoiceNumber };
    invoices.push(full);
    return full;
  }

  const openingInvoices = [
    addInvoice({
      invoiceType: "rent",
      tenantId: "T02",
      propertyId: "P1",
      unitId: "U102",
      leaseId: "L02",
      invoiceDate: "2024-12-01",
      dueDate: "2024-12-01",
      subtotal: 1750,
      taxAmount: 0,
      totalAmount: 1750,
      status: "paid",
      isOpening: true,
      lines: [{ lineId: "OL1", accountId: "4000", description: "Dec 2024 rent", amount: 1750, taxCodeId: "TX-EX", taxAmount: 0 }],
    }),
    addInvoice({
      invoiceType: "rent",
      tenantId: "T12",
      propertyId: "P4",
      unitId: "ULW",
      leaseId: "L12",
      invoiceDate: "2024-12-01",
      dueDate: "2024-12-01",
      subtotal: 1550,
      taxAmount: 0,
      totalAmount: 1550,
      status: "paid",
      isOpening: true,
      lines: [{ lineId: "OL2", accountId: "4000", description: "Dec 2024 rent", amount: 1550, taxCodeId: "TX-EX", taxAmount: 0 }],
    }),
    addInvoice({
      invoiceType: "rent",
      tenantId: "T09",
      propertyId: "P3",
      unitId: "UB",
      leaseId: "L09",
      invoiceDate: "2024-12-01",
      dueDate: "2024-12-01",
      subtotal: 2200,
      taxAmount: 0,
      totalAmount: 2200,
      status: "open",
      isOpening: true,
      notes: "Still outstanding as of the current as-of date.",
      lines: [{ lineId: "OL3", accountId: "4000", description: "Dec 2024 rent", amount: 2200, taxCodeId: "TX-EX", taxAmount: 0 }],
    }),
    addInvoice({
      invoiceType: "rent",
      tenantId: "T04",
      propertyId: "P1",
      unitId: "U202",
      leaseId: "L04",
      invoiceDate: "2024-12-01",
      dueDate: "2024-12-01",
      subtotal: 2100,
      taxAmount: 0,
      totalAmount: 2100,
      status: "paid",
      isOpening: true,
      lines: [{ lineId: "OL4", accountId: "4000", description: "Dec 2024 rent", amount: 2100, taxCodeId: "TX-EX", taxAmount: 0 }],
    }),
    addInvoice({
      invoiceType: "late_fee",
      tenantId: "T01",
      propertyId: "P1",
      unitId: "U101",
      leaseId: "L01",
      invoiceDate: "2024-12-15",
      dueDate: "2024-12-15",
      subtotal: 800,
      taxAmount: 0,
      totalAmount: 800,
      status: "paid",
      isOpening: true,
      lines: [{ lineId: "OL5", accountId: "4120", description: "Late fee", amount: 800, taxCodeId: "TX-EX", taxAmount: 0 }],
    }),
  ];

  /* ---------- Opening vendor bills ---------- */
  function addBill(bill: Omit<VendorBill, "billId" | "billNumber">): VendorBill {
    const billId = `BILL-${String(billSeq).padStart(5, "0")}`;
    const billNumber = next("BILL", billSeq++);
    const full: VendorBill = { ...bill, billId, billNumber };
    bills.push(full);
    return full;
  }

  const openingBills = [
    addBill({
      vendorId: "V06",
      propertyId: "P1",
      billDate: "2024-11-15",
      dueDate: "2025-01-10",
      subtotal: 4200,
      taxAmount: 0,
      totalAmount: 4200,
      status: "paid",
      paymentStatus: "paid",
      billReference: "TOR-TAX-MAPLE-24",
      isOpening: true,
      expenseCategory: "Property Taxes",
      lines: [{ lineId: "BL1", accountId: "5300", description: "Property tax installment", amount: 4200, taxCodeId: "TX-OOS", taxAmount: 0, isCapital: false, itcEligible: false }],
    }),
    addBill({
      vendorId: "V06",
      propertyId: "P5",
      billDate: "2024-11-15",
      dueDate: "2025-01-10",
      subtotal: 2600,
      taxAmount: 0,
      totalAmount: 2600,
      status: "paid",
      paymentStatus: "paid",
      billReference: "TOR-TAX-KING-24",
      isOpening: true,
      expenseCategory: "Property Taxes",
      lines: [{ lineId: "BL2", accountId: "5300", description: "Property tax installment", amount: 2600, taxCodeId: "TX-OOS", taxAmount: 0, isCapital: false, itcEligible: false }],
    }),
    addBill({
      vendorId: "V10",
      propertyId: "P1",
      billDate: "2024-12-12",
      dueDate: "2025-01-11",
      subtotal: 2400,
      taxAmount: 0,
      totalAmount: 2400,
      status: "paid",
      paymentStatus: "paid",
      billReference: "HVAC-4412",
      isOpening: true,
      expenseCategory: "HVAC",
      lines: [{ lineId: "BL3", accountId: "5030", description: "Boiler service", amount: 2400, taxCodeId: "TX-OOS", taxAmount: 0, isCapital: false, itcEligible: false }],
    }),
    addBill({
      vendorId: "V11",
      propertyId: "P5",
      billDate: "2024-12-20",
      dueDate: "2025-01-19",
      subtotal: 1200,
      taxAmount: 0,
      totalAmount: 1200,
      status: "paid",
      paymentStatus: "paid",
      billReference: "CLN-9921",
      isOpening: true,
      expenseCategory: "Cleaning",
      lines: [{ lineId: "BL4", accountId: "5500", description: "December cleaning", amount: 1200, taxCodeId: "TX-OOS", taxAmount: 0, isCapital: false, itcEligible: false }],
    }),
    addBill({
      vendorId: "V01",
      propertyId: "P1",
      billDate: "2024-12-28",
      dueDate: "2025-01-20",
      subtotal: 1850,
      taxAmount: 0,
      totalAmount: 1850,
      status: "paid",
      paymentStatus: "paid",
      billReference: "HYD-DEC24",
      isOpening: true,
      expenseCategory: "Utilities",
      lines: [{ lineId: "BL5", accountId: "5100", description: "Electricity", amount: 1850, taxCodeId: "TX-OOS", taxAmount: 0, isCapital: false, itcEligible: false }],
    }),
    addBill({
      vendorId: "V12",
      propertyId: null,
      billDate: "2024-12-01",
      dueDate: "2025-01-15",
      subtotal: 1950,
      taxAmount: 0,
      totalAmount: 1950,
      status: "paid",
      paymentStatus: "paid",
      billReference: "INS-BAL-24",
      isOpening: true,
      expenseCategory: "Insurance",
      lines: [{ lineId: "BL6", accountId: "1200", description: "Insurance balance (prepaid)", amount: 1950, taxCodeId: "TX-OOS", taxAmount: 0, isCapital: false, itcEligible: false }],
    }),
  ];

  /* ---------- Recurring rent invoices ---------- */
  const extraCharges: Record<string, Array<{ accountId: string; amount: number; description: string }>> = {
    T01: [{ accountId: "4100", amount: 75, description: "Parking stall" }],
    T04: [{ accountId: "4100", amount: 75, description: "Parking stall" }],
    T05: [{ accountId: "4100", amount: 50, description: "Parking stall" }],
  };

  const months = monthsInRange("2025-01-01", "2026-03-01");
  const generatedInvoices: Invoice[] = [];

  months.forEach((monthStart) => {
    const monthEnd = endOfMonth(monthStart);
    leases.forEach((lease) => {
      if (lease.startDate > monthEnd || lease.endDate < monthStart) return;
      if (lease.leaseId === "L03") return;
      const tenant = tenants.find((t) => t.tenantId === lease.tenantId)!;
      const isCommercial = lease.tenantId === "T13";
      const extras = extraCharges[lease.tenantId] ?? [];
      const extraSum = money(sum(extras.map((e) => e.amount)));
      const rent = lease.monthlyRent;
      const subtotal = money(rent + extraSum);
      const taxAmount = isCommercial ? money(subtotal * 0.13) : 0;
      const taxCodeId = isCommercial ? "TX-HST" : "TX-EX";
      const revenueAccount = isCommercial ? "4010" : "4000";
      const lines = [
        {
          lineId: `IL-${invSeq}-R`,
          accountId: revenueAccount,
          description: `Rent ${monthStart.slice(0, 7)} — ${tenant.tenantName}`,
          amount: rent,
          taxCodeId,
          taxAmount: isCommercial ? money(rent * 0.13) : 0,
        },
        ...extras.map((e, idx) => ({
          lineId: `IL-${invSeq}-X${idx}`,
          accountId: e.accountId,
          description: e.description,
          amount: e.amount,
          taxCodeId,
          taxAmount: isCommercial ? money(e.amount * 0.13) : 0,
        })),
      ];
      const inv = addInvoice({
        invoiceType: "rent",
        tenantId: lease.tenantId,
        propertyId: lease.propertyId,
        unitId: lease.unitId,
        leaseId: lease.leaseId,
        invoiceDate: monthStart,
        dueDate: monthStart,
        subtotal,
        taxAmount,
        totalAmount: money(subtotal + taxAmount),
        status: "open",
        isOpening: false,
        lines,
      });
      generatedInvoices.push(inv);
      postJournal({
        date: monthStart,
        description: `Rent invoice ${inv.invoiceNumber} — ${tenant.tenantName}`,
        reference: inv.invoiceNumber,
        sourceType: "tenant_invoice",
        sourceId: inv.invoiceId,
        propertyId: lease.propertyId,
        cashFlowClass: "none",
        lines: [
          {
            accountId: "1100",
            debitAmount: inv.totalAmount,
            creditAmount: 0,
            propertyId: lease.propertyId,
            description: inv.invoiceNumber,
            tenantId: lease.tenantId,
            vendorId: null,
            unitId: lease.unitId,
          },
          ...lines.map((line) => ({
            accountId: line.accountId,
            debitAmount: 0,
            creditAmount: line.amount,
            propertyId: lease.propertyId,
            description: line.description,
            tenantId: lease.tenantId,
            vendorId: null,
            unitId: lease.unitId,
          })),
          ...(taxAmount
            ? [
                {
                  accountId: "2300",
                  debitAmount: 0,
                  creditAmount: taxAmount,
                  propertyId: lease.propertyId,
                  description: "HST collected on commercial rent",
                  tenantId: lease.tenantId,
                  vendorId: null,
                  unitId: lease.unitId,
                },
              ]
            : []),
        ],
      });
    });
  });

  /* Late fees and credit */
  const lateFeeInv = addInvoice({
    invoiceType: "late_fee",
    tenantId: "T01",
    propertyId: "P1",
    unitId: "U101",
    leaseId: "L01",
    invoiceDate: "2025-02-06",
    dueDate: "2025-02-06",
    subtotal: 50,
    taxAmount: 0,
    totalAmount: 50,
    status: "paid",
    isOpening: false,
    lines: [{ lineId: "LF1", accountId: "4120", description: "Late payment fee", amount: 50, taxCodeId: "TX-EX", taxAmount: 0 }],
  });
  generatedInvoices.push(lateFeeInv);
  postJournal({
    date: "2025-02-06",
    description: "Late fee — Emily Chen",
    reference: lateFeeInv.invoiceNumber,
    sourceType: "tenant_invoice",
    sourceId: lateFeeInv.invoiceId,
    propertyId: "P1",
    cashFlowClass: "none",
    lines: [
      { accountId: "1100", debitAmount: 50, creditAmount: 0, propertyId: "P1", description: "Late fee", tenantId: "T01", vendorId: null, unitId: "U101" },
      { accountId: "4120", debitAmount: 0, creditAmount: 50, propertyId: "P1", description: "Late fee", tenantId: "T01", vendorId: null, unitId: "U101" },
    ],
  });

  const rossiLate = addInvoice({
    invoiceType: "late_fee",
    tenantId: "T09",
    propertyId: "P3",
    unitId: "UB",
    leaseId: "L09",
    invoiceDate: "2025-07-10",
    dueDate: "2025-07-10",
    subtotal: 75,
    taxAmount: 0,
    totalAmount: 75,
    status: "open",
    isOpening: false,
    lines: [{ lineId: "LF2", accountId: "4120", description: "Late payment fee", amount: 75, taxCodeId: "TX-EX", taxAmount: 0 }],
  });
  generatedInvoices.push(rossiLate);
  postJournal({
    date: "2025-07-10",
    description: "Late fee — Sofia Rossi",
    reference: rossiLate.invoiceNumber,
    sourceType: "tenant_invoice",
    sourceId: rossiLate.invoiceId,
    propertyId: "P3",
    cashFlowClass: "none",
    lines: [
      { accountId: "1100", debitAmount: 75, creditAmount: 0, propertyId: "P3", description: "Late fee", tenantId: "T09", vendorId: null, unitId: "UB" },
      { accountId: "4120", debitAmount: 0, creditAmount: 75, propertyId: "P3", description: "Late fee", tenantId: "T09", vendorId: null, unitId: "UB" },
    ],
  });

  const creditNote = addInvoice({
    invoiceType: "credit",
    tenantId: "T01",
    propertyId: "P1",
    unitId: "U101",
    leaseId: "L01",
    invoiceDate: "2025-05-12",
    dueDate: "2025-05-12",
    subtotal: -75,
    taxAmount: 0,
    totalAmount: -75,
    status: "credited",
    isOpening: false,
    notes: "Credit for laundry card overcharge.",
    lines: [{ lineId: "CR1", accountId: "4110", description: "Laundry credit", amount: -75, taxCodeId: "TX-EX", taxAmount: 0 }],
  });
  postJournal({
    date: "2025-05-12",
    description: "Credit note — Emily Chen laundry",
    reference: creditNote.invoiceNumber,
    sourceType: "tenant_credit",
    sourceId: creditNote.invoiceId,
    propertyId: "P1",
    cashFlowClass: "none",
    lines: [
      { accountId: "4110", debitAmount: 75, creditAmount: 0, propertyId: "P1", description: "Laundry credit", tenantId: "T01", vendorId: null, unitId: "U101" },
      { accountId: "1100", debitAmount: 0, creditAmount: 75, propertyId: "P1", description: "AR credit", tenantId: "T01", vendorId: null, unitId: "U101" },
    ],
  });

  /* ---------- Payments ---------- */
  function addPayment(p: Omit<Payment, "paymentId" | "paymentNumber">): Payment {
    const paymentId = `PMT-${String(paySeq).padStart(5, "0")}`;
    const paymentNumber = next("PMT", paySeq++);
    const full: Payment = { ...p, paymentId, paymentNumber };
    payments.push(full);
    return full;
  }

  function allocate(payment: Payment, invoice: Invoice, amount: number, date: string) {
    allocations.push({
      allocationId: next("ALC", allocSeq++),
      paymentId: payment.paymentId,
      invoiceId: invoice.invoiceId,
      allocatedAmount: money(amount),
      allocationDate: date,
    });
  }

  function postTenantReceipt(payment: Payment, arAmount: number, unapplied: number, propertyId: string | null, unitId: string | null) {
    const lines: Array<Omit<JournalLine, "journalLineId" | "journalEntryId">> = [
      {
        accountId: "1020",
        debitAmount: payment.totalAmount,
        creditAmount: 0,
        propertyId,
        description: payment.paymentNumber,
        tenantId: payment.tenantId,
        vendorId: null,
        unitId,
      },
    ];
    if (arAmount) {
      lines.push({
        accountId: "1100",
        debitAmount: 0,
        creditAmount: arAmount,
        propertyId,
        description: "Applied to invoices",
        tenantId: payment.tenantId,
        vendorId: null,
        unitId,
      });
    }
    if (unapplied) {
      lines.push({
        accountId: "2150",
        debitAmount: 0,
        creditAmount: unapplied,
        propertyId,
        description: "Unapplied tenant payment",
        tenantId: payment.tenantId,
        vendorId: null,
        unitId,
      });
    }
    postJournal({
      date: payment.paymentDate,
      description: `Tenant receipt ${payment.paymentNumber}`,
      reference: payment.reference,
      sourceType: unapplied && !arAmount ? "unapplied_payment" : "tenant_payment",
      sourceId: payment.paymentId,
      propertyId,
      cashFlowClass: "operating",
      lines,
    });
  }

  const skipMonths: Record<string, string[]> = {
    T09: ["2025-06-01", "2026-02-01", "2026-03-01"],
  };
  const delayDays: Record<string, number> = {
    T01: 1,
    T02: 3,
    T04: 1,
    T05: 0,
    T06: 4,
    T07: 2,
    T08: 1,
    T09: 35,
    T10: 5,
    T11: 2,
    T12: 15,
    T13: 14,
    T14: 3,
  };
  const combinedWilliams = new Set(["2025-01-01", "2025-02-01"]);

  generatedInvoices.forEach((inv) => {
    if (inv.invoiceType !== "rent") return;
    if (skipMonths[inv.tenantId]?.includes(inv.invoiceDate)) return;
    if (inv.tenantId === "T04" && combinedWilliams.has(inv.invoiceDate)) return;
    const delay = delayDays[inv.tenantId] ?? 2;
    let payDate = addDays(inv.dueDate, delay);
    if (inv.tenantId === "T12" && inv.invoiceDate === "2026-01-01") {
      const pmt = addPayment({
        paymentDate: "2026-01-20",
        paymentMethod: "e-transfer",
        bankAccountId: "BnkOp",
        tenantId: "T12",
        totalAmount: 800,
        paymentStatus: "posted",
        reference: "ET-FRASER-PARTIAL",
        isOpening: false,
      });
      allocate(pmt, inv, 800, pmt.paymentDate);
      postTenantReceipt(pmt, 800, 0, inv.propertyId, inv.unitId);
      return;
    }
    if (inv.tenantId === "T01" && inv.invoiceDate === "2025-05-01") {
      const net = money(inv.totalAmount - 75);
      const pmt = addPayment({
        paymentDate: payDate,
        paymentMethod: "e-transfer",
        bankAccountId: "BnkOp",
        tenantId: "T01",
        totalAmount: net,
        paymentStatus: "posted",
        reference: `RCPT-${inv.invoiceNumber}`,
        isOpening: false,
      });
      allocate(pmt, inv, net, pmt.paymentDate);
      postTenantReceipt(pmt, net, 0, inv.propertyId, inv.unitId);
      return;
    }
    if (payDate > APP_TODAY) return;
    const method = inv.tenantId === "T13" ? "cheque" : inv.tenantId === "T08" ? "pre-authorized" : "e-transfer";
    const pmt = addPayment({
      paymentDate: payDate,
      paymentMethod: method,
      bankAccountId: "BnkOp",
      tenantId: inv.tenantId,
      totalAmount: inv.totalAmount,
      paymentStatus: "posted",
      reference: `RCPT-${inv.invoiceNumber}`,
      isOpening: false,
    });
    allocate(pmt, inv, inv.totalAmount, pmt.paymentDate);
    postTenantReceipt(pmt, inv.totalAmount, 0, inv.propertyId, inv.unitId);
  });

  const janW = generatedInvoices.find((i) => i.tenantId === "T04" && i.invoiceDate === "2025-01-01")!;
  const febW = generatedInvoices.find((i) => i.tenantId === "T04" && i.invoiceDate === "2025-02-01")!;
  const williamsCombo = addPayment({
    paymentDate: "2025-02-03",
    paymentMethod: "e-transfer",
    bankAccountId: "BnkOp",
    tenantId: "T04",
    totalAmount: money(janW.totalAmount + febW.totalAmount),
    paymentStatus: "posted",
    reference: "ET-WILLIAMS-JANFEB",
    isOpening: false,
  });
  allocate(williamsCombo, janW, janW.totalAmount, "2025-02-03");
  allocate(williamsCombo, febW, febW.totalAmount, "2025-02-03");
  postTenantReceipt(williamsCombo, williamsCombo.totalAmount, 0, "P1", "U202");

  const chenLatePay = addPayment({
    paymentDate: "2025-02-12",
    paymentMethod: "e-transfer",
    bankAccountId: "BnkOp",
    tenantId: "T01",
    totalAmount: 50,
    paymentStatus: "posted",
    reference: "ET-CHEN-LATE",
    isOpening: false,
  });
  allocate(chenLatePay, lateFeeInv, 50, "2025-02-12");
  postTenantReceipt(chenLatePay, 50, 0, "P1", "U101");

  const nguyenMarch = generatedInvoices.find((i) => i.tenantId === "T05" && i.invoiceDate === "2026-03-01");
  if (nguyenMarch) {
    const existing = allocations.filter((a) => a.invoiceId === nguyenMarch.invoiceId);
    const alreadyPaid = money(sum(existing.map((a) => a.allocatedAmount)));
    if (alreadyPaid === 0) {
      /* March receipt may already exist if delay 0 and date <= today */
    }
  }

  const unapplied = addPayment({
    paymentDate: "2026-03-10",
    paymentMethod: "e-transfer",
    bankAccountId: "BnkOp",
    tenantId: "T05",
    totalAmount: 500,
    paymentStatus: "posted",
    reference: "ET-NGUYEN-UNAPPLIED",
    isOpening: false,
  });
  postTenantReceipt(unapplied, 0, 500, "P2", "U501");

  openingInvoices.forEach((inv) => {
    if (inv.tenantId === "T09") return;
    const dates: Record<string, string> = {
      T02: "2025-01-08",
      T12: "2025-01-05",
      T04: "2025-01-03",
      T01: "2025-02-10",
    };
    const date = dates[inv.tenantId];
    if (!date) return;
    const pmt = addPayment({
      paymentDate: date,
      paymentMethod: "e-transfer",
      bankAccountId: "BnkOp",
      tenantId: inv.tenantId,
      totalAmount: inv.totalAmount,
      paymentStatus: "posted",
      reference: `RCPT-OPEN-${inv.invoiceNumber}`,
      isOpening: false,
    });
    allocate(pmt, inv, inv.totalAmount, date);
    postTenantReceipt(pmt, inv.totalAmount, 0, inv.propertyId, inv.unitId);
  });

  /* Apply credit to Chen May rent */
  const chenMay = generatedInvoices.find((i) => i.tenantId === "T01" && i.invoiceDate === "2025-05-01");
  if (chenMay) {
    allocations.push({
      allocationId: next("ALC", allocSeq++),
      paymentId: "CREDIT-NOTE",
      invoiceId: chenMay.invoiceId,
      allocatedAmount: 75,
      allocationDate: "2025-05-12",
    });
  }

  /* ---------- Hannah Brooks deposit ---------- */
  const brooksDep: SecurityDeposit = {
    depositId: next("DEP", depSeq++),
    tenantId: "T14",
    propertyId: "P1",
    unitId: "U201",
    leaseId: "L14",
    depositType: "security",
    dateReceived: "2025-08-20",
    amountReceived: 1900,
    amountRefunded: 0,
    amountApplied: 0,
    status: "held",
    bankAccountId: "BnkTr",
    notes: "Held in TD Deposit Trust. Not rental revenue.",
  };
  deposits.push(brooksDep);
  postJournal({
    date: "2025-08-20",
    description: "Security deposit received — Hannah Brooks",
    reference: brooksDep.depositId,
    sourceType: "security_deposit",
    sourceId: brooksDep.depositId,
    propertyId: "P1",
    cashFlowClass: "operating",
    lines: [
      { accountId: "1030", debitAmount: 1900, creditAmount: 0, propertyId: "P1", description: "Trust deposit", tenantId: "T14", vendorId: null, unitId: "U201" },
      { accountId: "2100", debitAmount: 0, creditAmount: 1900, propertyId: "P1", description: "Deposit liability", tenantId: "T14", vendorId: null, unitId: "U201" },
    ],
  });

  const blake = deposits.find((d) => d.tenantId === "T03" && d.depositType === "security")!;
  postJournal({
    date: "2025-02-14",
    description: "Security deposit refund — Jordan Blake",
    reference: blake.depositId,
    sourceType: "deposit_refund",
    sourceId: blake.depositId,
    propertyId: "P1",
    cashFlowClass: "operating",
    lines: [
      { accountId: "2100", debitAmount: 1850, creditAmount: 0, propertyId: "P1", description: "Release deposit liability", tenantId: "T03", vendorId: null, unitId: "U201" },
      { accountId: "1030", debitAmount: 0, creditAmount: 1850, propertyId: "P1", description: "Trust refund", tenantId: "T03", vendorId: null, unitId: "U201" },
    ],
  });

  /* ---------- Vendor bills (2025-2026) ---------- */
  function postBill(bill: VendorBill) {
    if (bill.isOpening) return;
    const expenseLines = bill.lines.map((line) => ({
      accountId: line.accountId,
      debitAmount: line.amount,
      creditAmount: 0,
      propertyId: bill.propertyId,
      description: line.description,
      tenantId: null,
      vendorId: bill.vendorId,
      unitId: null,
    }));
    const itc = money(sum(bill.lines.filter((l) => l.itcEligible).map((l) => l.taxAmount)));
    const lines = [
      ...expenseLines,
      ...(itc
        ? [
            {
              accountId: "2310",
              debitAmount: itc,
              creditAmount: 0,
              propertyId: bill.propertyId,
              description: "Input tax credit",
              tenantId: null,
              vendorId: bill.vendorId,
              unitId: null,
            },
          ]
        : []),
      {
        accountId: "2000",
        debitAmount: 0,
        creditAmount: bill.totalAmount,
        propertyId: bill.propertyId,
        description: bill.billNumber,
        tenantId: null,
        vendorId: bill.vendorId,
        unitId: null,
      },
    ];
    postJournal({
      date: bill.billDate,
      description: `Vendor bill ${bill.billNumber}`,
      reference: bill.billReference,
      sourceType: bill.lines.some((l) => l.isCapital) ? "capital_expenditure" : "vendor_bill",
      sourceId: bill.billId,
      propertyId: bill.propertyId,
      cashFlowClass: bill.lines.some((l) => l.isCapital) ? "investing" : "none",
      lines,
    });
  }

  function payBill(bill: VendorBill, date: string, method: BillPayment["paymentMethod"], amount?: number) {
    const payAmt = money(amount ?? bill.totalAmount);
    const bp: BillPayment = {
      billPaymentId: `BP-${String(bpSeq).padStart(5, "0")}`,
      paymentDate: date,
      paymentMethod: method,
      bankAccountId: "BnkOp",
      vendorId: bill.vendorId,
      totalAmount: payAmt,
      reference: next("BP", bpSeq++),
      isOpening: false,
    };
    billPayments.push(bp);
    billAllocations.push({
      allocationId: next("BAL", ballocSeq++),
      billPaymentId: bp.billPaymentId,
      billId: bill.billId,
      allocatedAmount: payAmt,
      allocationDate: date,
    });
    postJournal({
      date,
      description: `Vendor payment ${bp.reference} — ${bill.billNumber}`,
      reference: bp.reference,
      sourceType: "vendor_payment",
      sourceId: bp.billPaymentId,
      propertyId: bill.propertyId,
      cashFlowClass: bill.lines.some((l) => l.isCapital) ? "investing" : "operating",
      lines: [
        {
          accountId: "2000",
          debitAmount: payAmt,
          creditAmount: 0,
          propertyId: bill.propertyId,
          description: bill.billNumber,
          tenantId: null,
          vendorId: bill.vendorId,
          unitId: null,
        },
        {
          accountId: "1020",
          debitAmount: 0,
          creditAmount: payAmt,
          propertyId: bill.propertyId,
          description: bp.reference,
          tenantId: null,
          vendorId: bill.vendorId,
          unitId: null,
        },
      ],
    });
  }

  const utilitySchedule: Array<{
    vendorId: string;
    propertyId: string;
    accountId: string;
    amount: number;
    desc: string;
  }> = [
    { vendorId: "V01", propertyId: "P1", accountId: "5100", amount: 420, desc: "Electricity" },
    { vendorId: "V02", propertyId: "P1", accountId: "5110", amount: 280, desc: "Water" },
    { vendorId: "V19", propertyId: "P1", accountId: "5120", amount: 160, desc: "Gas" },
    { vendorId: "V03", propertyId: "P2", accountId: "5100", amount: 510, desc: "Electricity" },
    { vendorId: "V04", propertyId: "P3", accountId: "5100", amount: 390, desc: "Electricity" },
    { vendorId: "V04", propertyId: "P3", accountId: "5110", amount: 140, desc: "Water" },
    { vendorId: "V05", propertyId: "P4", accountId: "5100", amount: 210, desc: "Electricity" },
    { vendorId: "V05", propertyId: "P4", accountId: "5110", amount: 95, desc: "Water" },
    { vendorId: "V19", propertyId: "P4", accountId: "5120", amount: 110, desc: "Gas" },
    { vendorId: "V01", propertyId: "P5", accountId: "5100", amount: 340, desc: "Electricity" },
    { vendorId: "V02", propertyId: "P5", accountId: "5110", amount: 80, desc: "Water" },
    { vendorId: "V19", propertyId: "P5", accountId: "5120", amount: 70, desc: "Gas" },
  ];

  months.forEach((monthStart) => {
    const billDate = endOfMonth(monthStart);
    if (billDate > APP_TODAY) return;
    utilitySchedule.forEach((u) => {
      const taxable = u.propertyId === "P5";
      const tax = taxable ? money(u.amount * 0.13) : 0;
      const bill = addBill({
        vendorId: u.vendorId,
        propertyId: u.propertyId,
        billDate,
        dueDate: addDays(billDate, 20),
        subtotal: u.amount,
        taxAmount: tax,
        totalAmount: money(u.amount + tax),
        status: "open",
        paymentStatus: "unpaid",
        billReference: `${u.desc}-${monthStart.slice(0, 7)}-${u.propertyId}`,
        isOpening: false,
        expenseCategory: "Utilities",
        lines: [
          {
            lineId: `UL-${billSeq}`,
            accountId: u.accountId,
            description: `${u.desc} ${monthStart.slice(0, 7)}`,
            amount: u.amount,
            taxCodeId: taxable ? "TX-HST" : "TX-OOS",
            taxAmount: tax,
            isCapital: false,
            itcEligible: taxable,
          },
        ],
      });
      postBill(bill);
      const payDate = addDays(billDate, 20);
      if (payDate <= APP_TODAY && monthStart < "2026-02-01") {
        payBill(bill, payDate, "pre-authorized");
      }
    });

    const mgmt: Array<{ propertyId: string; amount: number }> = [
      { propertyId: "P1", amount: 450 },
      { propertyId: "P2", amount: 520 },
      { propertyId: "P3", amount: 400 },
      { propertyId: "P4", amount: 220 },
      { propertyId: "P5", amount: 380 },
    ];
    mgmt.forEach((m) => {
      const taxable = m.propertyId === "P5";
      const tax = taxable ? money(m.amount * 0.13) : 0;
      const bill = addBill({
        vendorId: "V15",
        propertyId: m.propertyId,
        billDate: monthStart,
        dueDate: addDays(monthStart, 14),
        subtotal: m.amount,
        taxAmount: tax,
        totalAmount: money(m.amount + tax),
        status: "open",
        paymentStatus: "unpaid",
        billReference: `MGMT-${monthStart.slice(0, 7)}-${m.propertyId}`,
        isOpening: false,
        expenseCategory: "Management",
        lines: [
          {
            lineId: `MG-${billSeq}`,
            accountId: "5400",
            description: `Management fee ${monthStart.slice(0, 7)}`,
            amount: m.amount,
            taxCodeId: taxable ? "TX-HST" : "TX-OOS",
            taxAmount: tax,
            isCapital: false,
            itcEligible: taxable,
          },
        ],
      });
      postBill(bill);
      const payDate = addDays(monthStart, 14);
      if (payDate <= APP_TODAY && monthStart !== "2026-03-01") {
        payBill(bill, payDate, "e-transfer");
      }
    });

    const clean = addBill({
      vendorId: "V11",
      propertyId: "P5",
      billDate: monthStart,
      dueDate: endOfMonth(monthStart),
      subtotal: 650,
      taxAmount: money(650 * 0.13),
      totalAmount: money(650 * 1.13),
      status: "open",
      paymentStatus: "unpaid",
      billReference: `CLN-${monthStart.slice(0, 7)}`,
      isOpening: false,
      expenseCategory: "Cleaning",
      lines: [
        {
          lineId: `CL-${billSeq}`,
          accountId: "5500",
          description: "Commercial cleaning",
          amount: 650,
          taxCodeId: "TX-HST",
          taxAmount: money(650 * 0.13),
          isCapital: false,
          itcEligible: true,
        },
      ],
    });
    postBill(clean);
    const cleanPay = endOfMonth(monthStart);
    if (cleanPay <= APP_TODAY && monthStart < "2026-03-01") {
      payBill(clean, cleanPay, "cheque");
    }

    const monthNum = Number(monthStart.slice(5, 7));
    if (monthNum >= 4 && monthNum <= 10 && monthStart.startsWith("2025")) {
      const land = addBill({
        vendorId: "V13",
        propertyId: "P3",
        billDate: addDays(monthStart, 5),
        dueDate: addDays(monthStart, 20),
        subtotal: 280,
        taxAmount: 0,
        totalAmount: 280,
        status: "open",
        paymentStatus: "unpaid",
        billReference: `LAND-${monthStart.slice(0, 7)}`,
        isOpening: false,
        expenseCategory: "Landscaping",
        lines: [
          {
            lineId: `LD-${billSeq}`,
            accountId: "5600",
            description: "Seasonal landscaping",
            amount: 280,
            taxCodeId: "TX-OOS",
            taxAmount: 0,
            isCapital: false,
            itcEligible: false,
          },
        ],
      });
      postBill(land);
      payBill(land, addDays(monthStart, 20), "e-transfer");
    }
  });

  const specialBills: VendorBill[] = [];
  const ads = addBill({
    vendorId: "V16",
    propertyId: "P1",
    billDate: "2025-02-08",
    dueDate: "2025-02-22",
    subtotal: 450,
    taxAmount: 0,
    totalAmount: 450,
    status: "paid",
    paymentStatus: "paid",
    billReference: "AD-UNIT201",
    isOpening: false,
    expenseCategory: "Advertising",
    lines: [
      { lineId: "AD1", accountId: "5700", description: "Listing for Unit 201", amount: 450, taxCodeId: "TX-OOS", taxAmount: 0, isCapital: false, itcEligible: false },
    ],
  });
  specialBills.push(ads);
  const legal = addBill({
    vendorId: "V16",
    propertyId: "P1",
    billDate: "2025-05-20",
    dueDate: "2025-06-05",
    subtotal: 2400,
    taxAmount: 0,
    totalAmount: 2400,
    status: "paid",
    paymentStatus: "paid",
    billReference: "LEGAL-LEASE",
    isOpening: false,
    expenseCategory: "Professional",
    lines: [
      { lineId: "LG1", accountId: "5800", description: "Lease preparation Unit 201", amount: 2400, taxCodeId: "TX-OOS", taxAmount: 0, isCapital: false, itcEligible: false },
    ],
  });
  specialBills.push(legal);
  const plumbing = addBill({
    vendorId: "V17",
    propertyId: "P2",
    billDate: "2025-02-18",
    dueDate: "2025-03-04",
    subtotal: 680,
    taxAmount: 0,
    totalAmount: 680,
    status: "paid",
    paymentStatus: "paid",
    billReference: "PLUMB-502",
    isOpening: false,
    expenseCategory: "Plumbing",
    lines: [
      { lineId: "PL1", accountId: "5010", description: "Unit 502 stack repair", amount: 680, taxCodeId: "TX-OOS", taxAmount: 0, isCapital: false, itcEligible: false },
    ],
  });
  specialBills.push(plumbing);
  const hvac = addBill({
    vendorId: "V10",
    propertyId: "P1",
    billDate: "2025-08-22",
    dueDate: "2025-09-21",
    subtotal: 1860,
    taxAmount: 0,
    totalAmount: 1860,
    status: "paid",
    paymentStatus: "paid",
    billReference: "HVAC-SUMMER",
    isOpening: false,
    expenseCategory: "HVAC",
    lines: [
      { lineId: "HV1", accountId: "5030", description: "Condenser replacement labour", amount: 1860, taxCodeId: "TX-OOS", taxAmount: 0, isCapital: false, itcEligible: false },
    ],
  });
  specialBills.push(hvac);
  const roof = addBill({
    vendorId: "V14",
    propertyId: "P1",
    billDate: "2025-07-15",
    dueDate: "2025-08-12",
    subtotal: 48500,
    taxAmount: 0,
    totalAmount: 48500,
    status: "paid",
    paymentStatus: "paid",
    billReference: "ROOF-MAPLE-2025",
    isOpening: false,
    expenseCategory: "Capital",
    lines: [
      { lineId: "RF1", accountId: "1510", description: "Roof replacement — capitalized", amount: 48500, taxCodeId: "TX-OOS", taxAmount: 0, isCapital: true, itcEligible: false },
    ],
  });
  specialBills.push(roof);
  const hvacOpen = addBill({
    vendorId: "V10",
    propertyId: "P1",
    billDate: "2026-03-08",
    dueDate: "2026-04-07",
    subtotal: 1150,
    taxAmount: 0,
    totalAmount: 1150,
    status: "open",
    paymentStatus: "unpaid",
    billReference: "HVAC-MAR26",
    isOpening: false,
    expenseCategory: "HVAC",
    lines: [
      { lineId: "HV2", accountId: "5030", description: "March diagnostic", amount: 1150, taxCodeId: "TX-OOS", taxAmount: 0, isCapital: false, itcEligible: false },
    ],
  });
  specialBills.push(hvacOpen);
  const elec = addBill({
    vendorId: "V10",
    propertyId: "P4",
    billDate: "2025-11-09",
    dueDate: "2025-12-09",
    subtotal: 920,
    taxAmount: 0,
    totalAmount: 920,
    status: "paid",
    paymentStatus: "paid",
    billReference: "ELEC-LAKE",
    isOpening: false,
    expenseCategory: "Electrical",
    lines: [
      { lineId: "EL1", accountId: "5020", description: "Panel upgrade labour", amount: 920, taxCodeId: "TX-OOS", taxAmount: 0, isCapital: false, itcEligible: false },
    ],
  });
  specialBills.push(elec);

  const taxBills = [
    { vendorId: "V06", propertyId: "P1", amount: 9200, date: "2025-03-01", ref: "TOR-MAPLE-25A" },
    { vendorId: "V06", propertyId: "P1", amount: 9200, date: "2025-09-01", ref: "TOR-MAPLE-25B" },
    { vendorId: "V07", propertyId: "P2", amount: 8100, date: "2025-04-01", ref: "VAN-HARBR-25A" },
    { vendorId: "V07", propertyId: "P2", amount: 8100, date: "2025-10-01", ref: "VAN-HARBR-25B" },
    { vendorId: "V08", propertyId: "P3", amount: 4900, date: "2025-05-01", ref: "CAL-CEDAR-25A" },
    { vendorId: "V08", propertyId: "P3", amount: 4900, date: "2025-11-01", ref: "CAL-CEDAR-25B" },
    { vendorId: "V09", propertyId: "P4", amount: 3200, date: "2025-03-15", ref: "OTT-LAKE-25A" },
    { vendorId: "V09", propertyId: "P4", amount: 3200, date: "2025-09-15", ref: "OTT-LAKE-25B" },
    { vendorId: "V06", propertyId: "P5", amount: 7300, date: "2025-03-01", ref: "TOR-KING-25A" },
    { vendorId: "V06", propertyId: "P5", amount: 7300, date: "2025-09-01", ref: "TOR-KING-25B" },
  ];
  taxBills.forEach((t) => {
    const bill = addBill({
      vendorId: t.vendorId,
      propertyId: t.propertyId,
      billDate: t.date,
      dueDate: addDays(t.date, 30),
      subtotal: t.amount,
      taxAmount: 0,
      totalAmount: t.amount,
      status: "paid",
      paymentStatus: "paid",
      billReference: t.ref,
      isOpening: false,
      expenseCategory: "Property Taxes",
      lines: [
        { lineId: t.ref, accountId: "5300", description: "Property tax installment", amount: t.amount, taxCodeId: "TX-OOS", taxAmount: 0, isCapital: false, itcEligible: false },
      ],
    });
    specialBills.push(bill);
  });

  specialBills.forEach((b) => {
    postBill(b);
    if (b.billReference === "HVAC-MAR26") return;
    const payDate =
      b.billReference === "ROOF-MAPLE-2025"
        ? "2025-08-12"
        : b.billReference === "LEGAL-LEASE"
          ? "2025-06-05"
          : addDays(b.billDate, 18);
    if (payDate <= APP_TODAY) payBill(b, payDate, "cheque");
  });

  openingBills.forEach((b) => {
    payBill(b, b.dueDate, "cheque");
  });

  /* Accrued reversal */
  postJournal({
    date: "2025-01-05",
    description: "Reverse opening accrued expenses",
    reference: "ACR-REV-2025",
    sourceType: "manual",
    sourceId: "ACR-REV-2025",
    propertyId: null,
    cashFlowClass: "none",
    lines: [
      { accountId: "2200", debitAmount: 6800, creditAmount: 0, propertyId: null, description: "Reverse accrual", tenantId: null, vendorId: null, unitId: null },
      { accountId: "5900", debitAmount: 0, creditAmount: 6800, propertyId: null, description: "Reverse accrual (prior period)", tenantId: null, vendorId: null, unitId: null },
    ],
  });

  /* ---------- Insurance amortization & renewal ---------- */
  const insAlloc = [
    { propertyId: "P1", amount: 408.25 },
    { propertyId: "P2", amount: 351.34 },
    { propertyId: "P3", amount: 192.99 },
    { propertyId: "P4", amount: 103.92 },
    { propertyId: "P5", amount: 143.5 },
  ];
  monthsInRange("2025-01-01", "2026-03-01").forEach((m) => {
    if (m > APP_TODAY) return;
    postJournal({
      date: m,
      description: `Insurance amortization ${m.slice(0, 7)}`,
      reference: `INS-AMORT-${m.slice(0, 7)}`,
      sourceType: "prepaid_amortization",
      sourceId: `INS-AMORT-${m}`,
      propertyId: null,
      cashFlowClass: "none",
      lines: [
        ...insAlloc.map((a) => ({
          accountId: "5200",
          debitAmount: a.amount,
          creditAmount: 0,
          propertyId: a.propertyId,
          description: "Insurance expense",
          tenantId: null,
          vendorId: "V12",
          unitId: null,
        })),
        {
          accountId: "1200",
          debitAmount: 0,
          creditAmount: 1200,
          propertyId: null,
          description: "Amortize prepaid insurance",
          tenantId: null,
          vendorId: "V12",
          unitId: null,
        },
      ],
    });
  });

  postJournal({
    date: "2025-11-01",
    description: "Renew property insurance — 12 month prepaid",
    reference: "INS-RENEW-2025",
    sourceType: "insurance_prepayment",
    sourceId: "INS-RENEW-2025",
    propertyId: null,
    cashFlowClass: "operating",
    lines: [
      { accountId: "1200", debitAmount: 14400, creditAmount: 0, propertyId: null, description: "Prepaid insurance renewal", tenantId: null, vendorId: "V12", unitId: null },
      { accountId: "1020", debitAmount: 0, creditAmount: 14400, propertyId: null, description: "Insurance premium paid", tenantId: null, vendorId: "V12", unitId: null },
    ],
  });

  /* ---------- Depreciation ---------- */
  function monthlyDep(pid: string): number {
    const bldg = money(BUILDING_COST[pid] / 480);
    const imp = money(IMPROVEMENT_COST[pid] / 180);
    const furn = money(FURNITURE_COST[pid] / 60);
    return money(bldg + imp + furn);
  }
  monthsInRange("2025-01-01", "2026-03-01").forEach((m) => {
    if (m > APP_TODAY) return;
    const lines: Array<Omit<JournalLine, "journalLineId" | "journalEntryId">> = [];
    properties.forEach((p) => {
      const amt = monthlyDep(p.propertyId);
      lines.push({
        accountId: "6100",
        debitAmount: amt,
        creditAmount: 0,
        propertyId: p.propertyId,
        description: "Depreciation",
        tenantId: null,
        vendorId: null,
        unitId: null,
      });
      lines.push({
        accountId: "1590",
        debitAmount: 0,
        creditAmount: amt,
        propertyId: p.propertyId,
        description: "Accumulated depreciation",
        tenantId: null,
        vendorId: null,
        unitId: null,
      });
    });
    postJournal({
      date: endOfMonth(m) > APP_TODAY ? APP_TODAY : endOfMonth(m),
      description: `Monthly depreciation ${m.slice(0, 7)}`,
      reference: `DEP-${m.slice(0, 7)}`,
      sourceType: "depreciation",
      sourceId: `DEP-${m}`,
      propertyId: null,
      cashFlowClass: "none",
      lines,
    });
  });

  /* ---------- Mortgages ---------- */
  mortgages.forEach((mtg) => {
    let balance = mtg.openingBalance;
    monthsInRange("2025-01-01", "2026-03-01").forEach((m) => {
      const payDate = addDays(m, 0);
      if (payDate > APP_TODAY) return;
      const interest = money(balance * mtg.interestRate / 12);
      let principal = money(mtg.monthlyPayment - interest);
      if (principal > balance) principal = balance;
      const total = money(principal + interest);
      postJournal({
        date: payDate,
        description: `Mortgage payment ${mtg.lender} — ${pName(mtg.propertyId)}`,
        reference: `MTG-${mtg.mortgageId}-${m.slice(0, 7)}`,
        sourceType: "mortgage_payment",
        sourceId: `${mtg.mortgageId}-${m}`,
        propertyId: mtg.propertyId,
        cashFlowClass: "financing",
        lines: [
          { accountId: "6000", debitAmount: interest, creditAmount: 0, propertyId: mtg.propertyId, description: "Mortgage interest", tenantId: null, vendorId: "V18", unitId: null },
          { accountId: mtg.accountId, debitAmount: principal, creditAmount: 0, propertyId: mtg.propertyId, description: "Mortgage principal", tenantId: null, vendorId: "V18", unitId: null },
          { accountId: "1020", debitAmount: 0, creditAmount: total, propertyId: mtg.propertyId, description: "Mortgage payment", tenantId: null, vendorId: "V18", unitId: null },
        ],
      });
      balance = money(balance - principal);
    });
  });

  function pName(id: string) {
    return properties.find((p) => p.propertyId === id)?.propertyName ?? id;
  }

  /* ---------- Owner activity, laundry cash, bank charges ---------- */
  ["2025-03-31", "2025-06-30", "2025-09-30", "2025-12-31"].forEach((d) => {
    postJournal({
      date: d,
      description: "Owner distribution",
      reference: `DIST-${d}`,
      sourceType: "owner_distribution",
      sourceId: `DIST-${d}`,
      propertyId: null,
      cashFlowClass: "financing",
      lines: [
        { accountId: "3100", debitAmount: 12000, creditAmount: 0, propertyId: null, description: "Owner draw", tenantId: null, vendorId: null, unitId: null },
        { accountId: "1020", debitAmount: 0, creditAmount: 12000, propertyId: null, description: "Distribution", tenantId: null, vendorId: null, unitId: null },
      ],
    });
  });
  postJournal({
    date: "2026-03-15",
    description: "Owner distribution",
    reference: "DIST-2026-03-15",
    sourceType: "owner_distribution",
    sourceId: "DIST-2026-03-15",
    propertyId: null,
    cashFlowClass: "financing",
    lines: [
      { accountId: "3100", debitAmount: 8000, creditAmount: 0, propertyId: null, description: "Owner draw", tenantId: null, vendorId: null, unitId: null },
      { accountId: "1020", debitAmount: 0, creditAmount: 8000, propertyId: null, description: "Distribution", tenantId: null, vendorId: null, unitId: null },
    ],
  });
  postJournal({
    date: "2025-06-15",
    description: "Owner contribution",
    reference: "CONT-2025-06-15",
    sourceType: "owner_contribution",
    sourceId: "CONT-2025-06-15",
    propertyId: null,
    cashFlowClass: "financing",
    lines: [
      { accountId: "1020", debitAmount: 25000, creditAmount: 0, propertyId: null, description: "Capital contribution", tenantId: null, vendorId: null, unitId: null },
      { accountId: "3000", debitAmount: 0, creditAmount: 25000, propertyId: null, description: "Owner contribution", tenantId: null, vendorId: null, unitId: null },
    ],
  });

  monthsInRange("2025-01-01", "2026-03-01").forEach((m) => {
    const d = addDays(m, 14);
    if (d > APP_TODAY) return;
    postJournal({
      date: d,
      description: "Coin laundry receipts — Maple Ridge",
      reference: `LAUNDRY-${m.slice(0, 7)}`,
      sourceType: "manual",
      sourceId: `LAUNDRY-${m}`,
      propertyId: "P1",
      cashFlowClass: "operating",
      lines: [
        { accountId: "1020", debitAmount: 180, creditAmount: 0, propertyId: "P1", description: "Laundry cash", tenantId: null, vendorId: null, unitId: null },
        { accountId: "4110", debitAmount: 0, creditAmount: 180, propertyId: "P1", description: "Laundry income", tenantId: null, vendorId: null, unitId: null },
      ],
    });
  });

  monthsInRange("2025-01-01", "2026-03-01").forEach((m) => {
    const d = endOfMonth(m);
    const date = d > APP_TODAY ? APP_TODAY : d;
    postJournal({
      date,
      description: "Bank service charge",
      reference: `BANK-${m.slice(0, 7)}`,
      sourceType: "bank_charge",
      sourceId: `BANK-${m}`,
      propertyId: null,
      cashFlowClass: "operating",
      lines: [
        { accountId: "6200", debitAmount: 14.5, creditAmount: 0, propertyId: null, description: "RBC service charge", tenantId: null, vendorId: "V18", unitId: null },
        { accountId: "1020", debitAmount: 0, creditAmount: 14.5, propertyId: null, description: "Bank charge", tenantId: null, vendorId: "V18", unitId: null },
      ],
    });
  });

  /* GST remittance */
  postJournal({
    date: "2025-01-31",
    description: "Remit opening GST/HST payable",
    reference: "HST-OPEN",
    sourceType: "manual",
    sourceId: "HST-OPEN",
    propertyId: "P5",
    cashFlowClass: "operating",
    lines: [
      { accountId: "2300", debitAmount: 2400, creditAmount: 0, propertyId: "P5", description: "Remit opening HST", tenantId: null, vendorId: null, unitId: null },
      { accountId: "1020", debitAmount: 0, creditAmount: 2400, propertyId: "P5", description: "HST remittance", tenantId: null, vendorId: null, unitId: null },
    ],
  });

  function remitHst(start: string, end: string, date: string, id: string) {
    const collected = money(
      sum(
        journalEntries
          .filter((je) => je.status === "posted" && je.sourceType === "tenant_invoice" && inRange(je.postingDate, start, end))
          .flatMap((je) => je.lines)
          .filter((l) => l.accountId === "2300")
          .map((l) => l.creditAmount - l.debitAmount),
      ),
    );
    const itc = money(
      sum(
        journalEntries
          .filter((je) => je.status === "posted" && je.sourceType === "vendor_bill" && inRange(je.postingDate, start, end))
          .flatMap((je) => je.lines)
          .filter((l) => l.accountId === "2310")
          .map((l) => l.debitAmount - l.creditAmount),
      ),
    );
    const net = money(collected - itc);
    if (collected === 0 && itc === 0) return;
    const lines: Array<Omit<JournalLine, "journalLineId" | "journalEntryId">> = [];
    if (collected) {
      lines.push({ accountId: "2300", debitAmount: collected, creditAmount: 0, propertyId: "P5", description: "Clear HST collected", tenantId: null, vendorId: null, unitId: null });
    }
    if (itc) {
      lines.push({ accountId: "2310", debitAmount: 0, creditAmount: itc, propertyId: "P5", description: "Apply ITCs", tenantId: null, vendorId: null, unitId: null });
    }
    if (net >= 0) {
      lines.push({ accountId: "1020", debitAmount: 0, creditAmount: net, propertyId: "P5", description: "Net HST remittance", tenantId: null, vendorId: null, unitId: null });
    } else {
      lines.push({ accountId: "1020", debitAmount: Math.abs(net), creditAmount: 0, propertyId: "P5", description: "HST refund", tenantId: null, vendorId: null, unitId: null });
    }
    postJournal({
      date,
      description: `GST/HST remittance ${start.slice(0, 7)} to ${end.slice(0, 7)}`,
      reference: id,
      sourceType: "manual",
      sourceId: id,
      propertyId: "P5",
      cashFlowClass: "operating",
      lines,
    });
  }
  remitHst("2025-01-01", "2025-03-31", "2025-04-30", "HST-Q1-2025");
  remitHst("2025-04-01", "2025-06-30", "2025-07-31", "HST-Q2-2025");
  remitHst("2025-07-01", "2025-09-30", "2025-10-31", "HST-Q3-2025");
  remitHst("2025-10-01", "2025-12-31", "2026-01-31", "HST-Q4-2025");

  /* Draft and reversed entries */
  postJournal({
    date: "2026-03-14",
    description: "DRAFT — proposed year-end bonus accrual (not posted)",
    reference: "DRAFT-ACCRUAL",
    sourceType: "manual",
    sourceId: "DRAFT-ACCRUAL",
    propertyId: null,
    cashFlowClass: "none",
    status: "draft",
    lines: [
      { accountId: "5900", debitAmount: 2500, creditAmount: 0, propertyId: null, description: "Draft accrual", tenantId: null, vendorId: null, unitId: null },
      { accountId: "2200", debitAmount: 0, creditAmount: 2500, propertyId: null, description: "Draft accrual", tenantId: null, vendorId: null, unitId: null },
    ],
  });

  const reversed = postJournal({
    date: "2026-02-28",
    description: "Duplicate bank charge — reversed",
    reference: "BANK-DUP",
    sourceType: "bank_charge",
    sourceId: "BANK-DUP",
    propertyId: null,
    cashFlowClass: "operating",
    status: "reversed",
    lines: [
      { accountId: "6200", debitAmount: 14.5, creditAmount: 0, propertyId: null, description: "Duplicate charge", tenantId: null, vendorId: "V18", unitId: null },
      { accountId: "1020", debitAmount: 0, creditAmount: 14.5, propertyId: null, description: "Duplicate charge", tenantId: null, vendorId: "V18", unitId: null },
    ],
  });
  postJournal({
    date: "2026-03-02",
    description: "Reversal of duplicate bank charge",
    reference: "BANK-DUP-REV",
    sourceType: "bank_charge",
    sourceId: reversed.journalEntryId,
    propertyId: null,
    cashFlowClass: "operating",
    lines: [
      { accountId: "1020", debitAmount: 14.5, creditAmount: 0, propertyId: null, description: "Reverse duplicate", tenantId: null, vendorId: "V18", unitId: null },
      { accountId: "6200", debitAmount: 0, creditAmount: 14.5, propertyId: null, description: "Reverse duplicate", tenantId: null, vendorId: "V18", unitId: null },
    ],
  });

  /* ---------- Invoice status from allocations ---------- */
  invoices.forEach((inv) => {
    if (inv.invoiceType === "credit") {
      inv.status = "credited";
      return;
    }
    const paid = money(
      sum(allocations.filter((a) => a.invoiceId === inv.invoiceId).map((a) => a.allocatedAmount)),
    );
    const creditApplied = inv.tenantId === "T01" && inv.invoiceDate === "2025-05-01" ? 75 : 0;
    const outstanding = money(inv.totalAmount - paid - creditApplied);
    if (outstanding <= 0) inv.status = "paid";
    else if (paid > 0) inv.status = "partial";
    else inv.status = "open";
  });
  bills.forEach((bill) => {
    const paid = money(
      sum(billAllocations.filter((a) => a.billId === bill.billId).map((a) => a.allocatedAmount)),
    );
    if (paid >= bill.totalAmount) {
      bill.status = "paid";
      bill.paymentStatus = "paid";
    } else if (paid > 0) {
      bill.status = "partial";
      bill.paymentStatus = "partial";
    } else {
      bill.status = "open";
      bill.paymentStatus = "unpaid";
    }
  });

  /* ---------- Budgets ---------- */
  const budgetMap: Array<{ accountId: string; amounts: Record<string, number> }> = [
    { accountId: "4000", amounts: { P1: 92000, P2: 87000, P3: 78000, P4: 38400, P5: 0 } },
    { accountId: "4010", amounts: { P1: 0, P2: 0, P3: 0, P4: 0, P5: 57600 } },
    { accountId: "4100", amounts: { P1: 1800, P2: 600, P3: 0, P4: 0, P5: 0 } },
    { accountId: "4110", amounts: { P1: 2000, P2: 0, P3: 0, P4: 0, P5: 0 } },
    { accountId: "4120", amounts: { P1: 200, P2: 0, P3: 150, P4: 0, P5: 0 } },
    { accountId: "5100", amounts: { P1: 5200, P2: 6200, P3: 4800, P4: 2600, P5: 4200 } },
    { accountId: "5110", amounts: { P1: 3400, P2: 0, P3: 1700, P4: 1200, P5: 1000 } },
    { accountId: "5120", amounts: { P1: 2000, P2: 0, P3: 0, P4: 1400, P5: 900 } },
    { accountId: "5200", amounts: { P1: 4900, P2: 4200, P3: 2300, P4: 1250, P5: 1750 } },
    { accountId: "5300", amounts: { P1: 18400, P2: 16200, P3: 9800, P4: 6400, P5: 14600 } },
    { accountId: "5400", amounts: { P1: 5400, P2: 6240, P3: 4800, P4: 2640, P5: 4560 } },
    { accountId: "5500", amounts: { P1: 0, P2: 0, P3: 0, P4: 0, P5: 7800 } },
    { accountId: "5600", amounts: { P1: 0, P2: 0, P3: 2100, P4: 0, P5: 0 } },
    { accountId: "5000", amounts: { P1: 3600, P2: 2400, P3: 1800, P4: 1500, P5: 1200 } },
    { accountId: "5010", amounts: { P1: 800, P2: 900, P3: 400, P4: 300, P5: 200 } },
    { accountId: "5030", amounts: { P1: 2200, P2: 800, P3: 600, P4: 400, P5: 500 } },
    { accountId: "5800", amounts: { P1: 2500, P2: 0, P3: 0, P4: 0, P5: 0 } },
    { accountId: "5700", amounts: { P1: 500, P2: 0, P3: 0, P4: 0, P5: 0 } },
    { accountId: "6000", amounts: { P1: 88000, P2: 65000, P3: 34000, P4: 0, P5: 0 } },
  ];
  let bSeq = 1;
  ["2025", "2026"].forEach((year) => {
    const factor = year === "2026" ? 1.03 : 1;
    budgetMap.forEach((row) => {
      (Object.keys(row.amounts) as string[]).forEach((pid) => {
        const annual = money(row.amounts[pid] * factor);
        if (!annual) return;
        budgets.push({
          budgetId: `BUD-${bSeq++}`,
          fiscalYear: Number(year),
          period: "annual",
          month: null,
          propertyId: pid,
          accountId: row.accountId,
          budgetAmount: annual,
        });
        for (let month = 1; month <= 12; month++) {
          budgets.push({
            budgetId: `BUD-${bSeq++}`,
            fiscalYear: Number(year),
            period: "monthly",
            month,
            propertyId: pid,
            accountId: row.accountId,
            budgetAmount: money(annual / 12),
          });
        }
      });
    });
  });

  /* ---------- Bank rec sample ---------- */
  bankStatements.push({
    statementId: "STMT-OP-2026-02",
    bankAccountId: "BnkOp",
    periodStart: "2026-02-01",
    periodEnd: "2026-02-28",
    endingDate: "2026-02-28",
    endingBalance: 0,
    isSampleData: true,
  });
  bankStatements.push({
    statementId: "STMT-TR-2026-02",
    bankAccountId: "BnkTr",
    periodStart: "2026-02-01",
    periodEnd: "2026-02-28",
    endingDate: "2026-02-28",
    endingBalance: 0,
    isSampleData: true,
  });

  let txnSeq = 1;
  const cashLines = journalEntries
    .filter((je) => je.status === "posted")
    .flatMap((je) =>
      je.lines
        .filter((l) => l.accountId === "1020" || l.accountId === "1030")
        .map((l) => ({ je, l })),
    );
  cashLines.forEach(({ je, l }) => {
    const signed = money(l.debitAmount - l.creditAmount);
    if (signed === 0) return;
    const bankAccountId = l.accountId === "1020" ? "BnkOp" : "BnkTr";
    const inFeb = inRange(je.postingDate, "2026-02-01", "2026-02-28");
    const afterStmt = je.postingDate > "2026-02-28";
    bankTxns.push({
      bankTxnId: next("BTX", txnSeq++),
      bankAccountId,
      txnDate: je.postingDate,
      description: je.description,
      amount: signed,
      type: signed > 0 ? "deposit" : "withdrawal",
      sourcePaymentId: je.sourceType === "tenant_payment" || je.sourceType === "unapplied_payment" ? je.sourceId : null,
      sourceBillPaymentId: je.sourceType === "vendor_payment" ? je.sourceId : null,
      sourceJournalId: je.journalEntryId,
      statementId: inFeb ? (bankAccountId === "BnkOp" ? "STMT-OP-2026-02" : "STMT-TR-2026-02") : null,
      defaultMatched: inFeb && !afterStmt,
    });
  });

  const unmatchedFeb = bankTxns.filter((t) => t.statementId === "STMT-OP-2026-02" && t.type === "withdrawal");
  if (unmatchedFeb.length > 2) {
    unmatchedFeb[0].defaultMatched = false;
    unmatchedFeb[1].defaultMatched = false;
  }
  const depositsFeb = bankTxns.filter((t) => t.statementId === "STMT-OP-2026-02" && t.type === "deposit");
  if (depositsFeb.length > 0) depositsFeb[0].defaultMatched = false;

  const bookOpAsOf = money(
    sum(
      journalEntries
        .filter((je) => je.status === "posted" && je.postingDate <= "2026-02-28")
        .flatMap((je) => je.lines)
        .filter((l) => l.accountId === "1020")
        .map((l) => l.debitAmount - l.creditAmount),
    ),
  );
  const inTransit = money(
    sum(
      bankTxns
        .filter((t) => t.bankAccountId === "BnkOp" && t.type === "deposit" && t.statementId === "STMT-OP-2026-02" && !t.defaultMatched)
        .map((t) => t.amount),
    ),
  );
  const outstandingPays = money(
    sum(
      bankTxns
        .filter((t) => t.bankAccountId === "BnkOp" && t.type === "withdrawal" && t.statementId === "STMT-OP-2026-02" && !t.defaultMatched)
        .map((t) => Math.abs(t.amount)),
    ),
  );
  const matchedNet = money(
    sum(
      bankTxns
        .filter((t) => t.bankAccountId === "BnkOp" && t.statementId === "STMT-OP-2026-02" && t.defaultMatched)
        .map((t) => t.amount),
    ),
  );
  void matchedNet;
  bankStatements[0].endingBalance = money(bookOpAsOf - inTransit + outstandingPays);

  const bookTr = money(
    sum(
      journalEntries
        .filter((je) => je.status === "posted" && je.postingDate <= "2026-02-28")
        .flatMap((je) => je.lines)
        .filter((l) => l.accountId === "1030")
        .map((l) => l.debitAmount - l.creditAmount),
    ),
  );
  bankStatements[1].endingBalance = bookTr;

  const postedImbalance = journalEntries
    .filter((je) => je.status === "posted")
    .filter((je) => je.debitTotal !== je.creditTotal);
  if (postedImbalance.length) {
    throw new Error(`Posted imbalance: ${postedImbalance.map((j) => j.journalEntryNumber).join(", ")}`);
  }

  return {
    companyName: COMPANY.name,
    legalName: COMPANY.legalName,
    address: COMPANY.address,
    currency: "CAD",
    today: APP_TODAY,
    owners,
    portfolios,
    properties,
    units,
    tenants,
    leases,
    vendors,
    bankAccounts,
    accounts,
    taxCodes,
    invoices,
    payments,
    allocations,
    bills,
    billPayments,
    billAllocations,
    deposits,
    journalEntries,
    budgets,
    bankStatements,
    bankTxns,
    mortgages,
  };
}

let cached: Dataset | null = null;
/** Supabase mode: the organization's books (./live.ts). Until they are loaded the reports show an empty dataset. */
export function setLiveDataset(ds: Dataset) {
  cached = ds;
}
export function getDataset(): Dataset {
  if (!cached) cached = isSupabaseConfigured ? emptyDataset(APP_TODAY) : buildDataset();
  return cached;
}
