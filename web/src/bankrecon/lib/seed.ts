import { StoreState } from "./types";
import { fingerprint, r2, toISO } from "./format";

// ---------------------------------------------------------------------------
// Deterministic demo data for the Bank Reconciliation Module.
// All balances below are internally consistent so every summary figure is
// derived from the seeded transaction records.
// ---------------------------------------------------------------------------

const now = new Date();
const mk = (offsetMonths: number, day: number): string =>
  toISO(new Date(now.getFullYear(), now.getMonth() + offsetMonths, day));

const mStart = (offset: number): string => toISO(new Date(now.getFullYear(), now.getMonth() + offset, 1));
const mEnd = (offset: number): string => toISO(new Date(now.getFullYear(), now.getMonth() + offset + 1, 0));

const MM = (offset: number): string => `${now.getFullYear()}${String(now.getMonth() + 1 + offset).padStart(2, "0")}`;

let seq = 0;
const nid = (p: string) => `${p}-${String(++seq).padStart(3, "0")}`;

const at = (daysAgo: number) => new Date(Date.now() - daysAgo * 86400000).toISOString();

interface BankRowSeed {
  date: string;
  postedDate?: string;
  description: string;
  reference: string;
  debit?: number;
  credit?: number;
  duplicateOf?: string;
}

function makeBankTxs(accountId: string, batchId: string, rows: BankRowSeed[], opening: number) {
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
  let running = opening;
  return sorted.map((r) => {
    const signed = r2((r.credit ?? 0) - (r.debit ?? 0));
    running = r2(running + signed);
    return {
      id: nid("btx"),
      batchId,
      accountId,
      date: r.date,
      postedDate: r.postedDate ?? r.date,
      description: r.description,
      reference: r.reference,
      debit: r2(r.debit ?? 0),
      credit: r2(r.credit ?? 0),
      signedAmount: signed,
      runningBalance: running,
      fingerprint: fingerprint(accountId, r.date, signed, r.reference, r.description),
      duplicateOf: r.duplicateOf ?? null,
      manualEntry: false,
      importedAt: at(20),
      notes: "",
    };
  });
}

interface BookRowSeed {
  id: string;
  accountId: string;
  date: string;
  type: StoreState["bookTxs"][number]["type"];
  description: string;
  counterparty: string;
  propertyId: string | null;
  unit: string | null;
  reference: string;
  invoices?: { id: string; number: string; amount: number }[];
  moneyIn: number;
  moneyOut: number;
  coa: string;
  source: string;
}

function makeBookTxs(rows: BookRowSeed[]) {
  return rows.map((r) => {
    const signed = r2(r.moneyIn - r.moneyOut);
    return {
      ...r,
      invoices: r.invoices ?? [],
      signedAmount: signed,
      postingStatus: "Posted" as const,
      notes: "",
      assignee: "Unassigned",
      createdAt: at(20),
    };
  });
}

export function buildSeed(): StoreState {
  seq = 0;

  // ---------------- Bank accounts ----------------
  const accounts = [
    {
      id: "BA-OP-01",
      name: "Sunrise Property Management — Operating",
      institution: "First National Bank",
      maskedAccount: "****4521",
      accountType: "Operating" as const,
      currency: "USD",
      glAccount: "1010",
      glAccountName: "Cash — Operating",
      openingBalance: 147215.6,
      openingBalanceDate: mk(-2, 31),
      active: true,
      purpose: "Operating cash for property management activities",
      propertyId: null,
      classification: "Operating",
      notes: "Primary operating account for all managed properties.",
      createdAt: at(120),
      updatedAt: at(40),
    },
    {
      id: "BA-TR-02",
      name: "Tenant Trust — Deposits",
      institution: "First National Bank",
      maskedAccount: "****8830",
      accountType: "Trust" as const,
      currency: "USD",
      glAccount: "1020",
      glAccountName: "Cash — Tenant Trust",
      openingBalance: 75600,
      openingBalanceDate: mk(-3, 31),
      active: true,
      purpose: "Holding tenant security deposits and pet deposits (restricted funds)",
      propertyId: null,
      classification: "Trust / Restricted funds — jurisdiction-specific rules apply",
      notes: "Reconcile independently. Tenant deposits are NOT rental income.",
      createdAt: at(120),
      updatedAt: at(30),
    },
    {
      id: "BA-RS-03",
      name: "Capital Replacement Reserve",
      institution: "Metropolitan Credit Union",
      maskedAccount: "****1194",
      accountType: "Reserve" as const,
      currency: "USD",
      glAccount: "1030",
      glAccountName: "Cash — Reserve",
      openingBalance: 42800,
      openingBalanceDate: mk(-2, 1),
      active: true,
      purpose: "Capital replacement reserves for owned properties",
      propertyId: null,
      classification: "Reserve",
      notes: "Monthly reserve transfers from operating account.",
      createdAt: at(120),
      updatedAt: at(30),
    },
    {
      id: "BA-OP-04",
      name: "Lakeside Apartments — Property Operating",
      institution: "First National Bank",
      maskedAccount: "****7745",
      accountType: "Operating" as const,
      currency: "USD",
      glAccount: "1040",
      glAccountName: "Cash — Lakeside",
      openingBalance: 38200,
      openingBalanceDate: mk(-3, 31),
      active: true,
      purpose: "Property-level operating account for Lakeside Apartments",
      propertyId: "PL-02",
      classification: "Operating",
      notes: "Property-scoped account; no statements imported yet for the current period.",
      createdAt: at(120),
      updatedAt: at(60),
    },
  ];

  // ---------------- Reference data ----------------
  const properties = [
    { id: "PL-01", name: "Maple Grove Apartments", address: "120 Maple Grove Ln, Springfield", unitCount: 12 },
    { id: "PL-02", name: "Lakeside Apartments", address: "88 Lakeside Dr, Springfield", unitCount: 8 },
    { id: "PL-03", name: "Harbor View Condos", address: "5 Harbor View Way, Bayport", unitCount: 6 },
  ];
  const units = [
    { id: "U-101", propertyId: "PL-01", label: "M101", rent: 1650 },
    { id: "U-102", propertyId: "PL-01", label: "M102", rent: 1750 },
    { id: "U-201", propertyId: "PL-01", label: "M201", rent: 1800 },
    { id: "U-205", propertyId: "PL-01", label: "M205", rent: 1800 },
    { id: "U-104", propertyId: "PL-01", label: "M104", rent: 1650 },
    { id: "U-110", propertyId: "PL-01", label: "M110", rent: 1700 },
    { id: "U-L101", propertyId: "PL-02", label: "L101", rent: 1900 },
    { id: "U-L102", propertyId: "PL-02", label: "L102", rent: 1950 },
    { id: "U-L105", propertyId: "PL-02", label: "L105", rent: 2100 },
    { id: "U-H201", propertyId: "PL-03", label: "H201", rent: 2400 },
    { id: "U-H203", propertyId: "PL-03", label: "H203", rent: 2500 },
    { id: "U-H103", propertyId: "PL-03", label: "H103", rent: 2250 },
  ];
  const tenants = [
    { id: "T-01", name: "T. Whitfield", propertyId: "PL-01", unit: "M102", email: "t.whitfield@example.com" },
    { id: "T-02", name: "M. Okafor", propertyId: "PL-01", unit: "M205", email: "m.okafor@example.com" },
    { id: "T-03", name: "C. Chen", propertyId: "PL-02", unit: "L101", email: "c.chen@example.com" },
    { id: "T-04", name: "L. Duarte", propertyId: "PL-03", unit: "H201", email: "l.duarte@example.com" },
    { id: "T-05", name: "J. Alvarez", propertyId: "PL-01", unit: "M104", email: "j.alvarez@example.com" },
    { id: "T-06", name: "S. Patel", propertyId: "PL-02", unit: "L102", email: "s.patel@example.com" },
    { id: "T-07", name: "N. Brooks", propertyId: "PL-03", unit: "H103", email: "n.brooks@example.com" },
    { id: "T-08", name: "A. Fowler", propertyId: "PL-01", unit: "M110", email: "a.fowler@example.com" },
    { id: "T-09", name: "L. Nguyen", propertyId: "PL-02", unit: "L105", email: "l.nguyen@example.com" },
    { id: "T-10", name: "K. Osei", propertyId: "PL-03", unit: "H203", email: "k.osei@example.com" },
    { id: "T-11", name: "R. Pratt", propertyId: "PL-01", unit: "M201", email: "r.pratt@example.com" },
  ];
  const vendors = [
    { id: "V-01", name: "Metro Water", category: "Utilities" },
    { id: "V-02", name: "CleanCo Services", category: "Cleaning" },
    { id: "V-03", name: "BrightHome Maintenance", category: "Maintenance" },
    { id: "V-04", name: "Apex Appliance Repair", category: "Maintenance" },
    { id: "V-05", name: "Northside Landscaping", category: "Landscaping" },
  ];
  const coa = [
    { code: "1010", name: "Cash — Operating", kind: "asset" as const },
    { code: "1020", name: "Cash — Tenant Trust", kind: "asset" as const },
    { code: "1030", name: "Cash — Reserve", kind: "asset" as const },
    { code: "1040", name: "Cash — Lakeside", kind: "asset" as const },
    { code: "1100", name: "Accounts Receivable — Rent", kind: "asset" as const },
    { code: "2210", name: "Tenant Deposit Liability", kind: "liability" as const },
    { code: "4100", name: "Rental Income", kind: "income" as const },
    { code: "5100", name: "Maintenance & Repairs Expense", kind: "expense" as const },
    { code: "5200", name: "Utilities Expense", kind: "expense" as const },
    { code: "5300", name: "Bank Charges Expense", kind: "expense" as const },
    { code: "5400", name: "Management Fees Expense", kind: "expense" as const },
    { code: "6100", name: "Interest Income", kind: "income" as const },
    { code: "7100", name: "Transfers", kind: "equity" as const },
  ];

  // ---------------- Bank statement transactions ----------------
  const opSepBank = makeBankTxs("BA-OP-01", "IMP-OP-SEP", [
    { date: mk(-1, 2), description: "Rent — T. Whitfield", reference: "REN-1001", credit: 2000 },
    { date: mk(-1, 5), description: "Rent — M. Okafor", reference: "REN-1002", credit: 1500 },
    { date: mk(-1, 8), description: "Rent — L. Duarte", reference: "REN-1003", credit: 1800 },
    { date: mk(-1, 15), description: "Interest earned", reference: "INT-814", credit: 41.35 },
    { date: mk(-1, 18), description: "Transfer to Reserve Account", reference: "XFER-410", debit: 216.8 },
  ], 147215.6);

  const opOctBank = makeBankTxs("BA-OP-01", "IMP-OP-OCT", [
    { date: mk(0, 2), description: "Rent — T. Whitfield", reference: "REN-1001", credit: 2000 },
    { date: mk(0, 3), description: "Rent — M. Okafor", reference: "REN-1002", credit: 1800 },
    { date: mk(0, 3), description: "Rent — M. Okafor", reference: "REN-1002", credit: 1800, duplicateOf: "DUPLICATE" },
    { date: mk(0, 5), description: "Online payment batch deposit", reference: "PROC-7781", credit: 3800 },
    { date: mk(0, 6), description: "Rent — J. Alvarez", reference: "REN-1006", credit: 1200 },
    { date: mk(0, 8), description: "Merchant net settlement — card batch", reference: "PROC-7790", credit: 1970 },
    { date: mk(0, 9), description: "Metro Water — utility payment", reference: "INV-4401", debit: 620 },
    { date: mk(0, 10), description: "CleanCo Services — invoice 4410", reference: "INV-4410", debit: 400 },
    { date: mk(0, 12), description: "Transfer to Trust — Deposits", reference: "XFER-501", debit: 5000 },
    { date: mk(0, 15), description: "Interest earned", reference: "INT-902", credit: 63.2 },
    { date: mk(0, 20), description: "REVERSAL — Returned check J. Alvarez", reference: "REN-1006", debit: 1200 },
    { date: mk(0, 21), description: "Bank service charge", reference: "CHG-301", debit: 25 },
    { date: mk(0, 24), description: "ATM cash withdrawal", reference: "ATM-7782", debit: 400 },
    { date: mk(0, 26), description: "Rent — S. Patel", reference: "REN-1007", credit: 1450 },
  ], 152340.15);

  // mark the duplicate row
  const dupIdx = opOctBank.findIndex((t) => t.duplicateOf);
  if (dupIdx >= 0) {
    const original = opOctBank.find((t) => t.date === opOctBank[dupIdx].date && t.description === opOctBank[dupIdx].description && t.id !== opOctBank[dupIdx].id);
    opOctBank[dupIdx].duplicateOf = original?.id ?? null;
  }

  const trAugBank = makeBankTxs("BA-TR-02", "IMP-TR-AUG", [
    { date: mk(-2, 3), description: "Tenant deposit — K. Osei", reference: "DEP-3001", credit: 3200 },
    { date: mk(-2, 7), description: "Tenant deposit — R. Pratt", reference: "DEP-3002", credit: 3000 },
    { date: mk(-2, 14), description: "Deposit refund — K. Osei", reference: "REF-1101", debit: 1850 },
    { date: mk(-2, 18), description: "Transfer from Operating Account", reference: "XFER-410", credit: 2000 },
  ], 75600);

  const trSepBank = makeBankTxs("BA-TR-02", "IMP-TR-SEP", [
    { date: mk(-1, 4), description: "Tenant deposit — K. Osei", reference: "DEP-3101", credit: 1200 },
    { date: mk(-1, 11), description: "Tenant deposit — R. Pratt", reference: "DEP-3102", credit: 1600 },
    { date: mk(-1, 19), description: "Deposit refund — K. Osei", reference: "REF-1111", debit: 450 },
  ], 81950);

  const trOctBank = makeBankTxs("BA-TR-02", "IMP-TR-OCT", [
    { date: mk(0, 2), description: "Tenant deposit — A. Fowler", reference: "DEP-3201", credit: 1500 },
    { date: mk(0, 9), description: "Deposit refund — A. Fowler", reference: "REF-1121", debit: 600 },
    { date: mk(0, 12), description: "Transfer from Operating Account", reference: "XFER-501", credit: 5000 },
    { date: mk(0, 16), description: "Tenant deposit — L. Nguyen", reference: "DEP-3202", credit: 2200 },
    { date: mk(0, 22), description: "Trust account interest", reference: "INT-910", credit: 18.4 },
    { date: mk(0, 27), description: "Deposit refund — L. Nguyen", reference: "REF-1122", debit: 1150 },
  ], 84300);

  const rsAugBank = makeBankTxs("BA-RS-03", "IMP-RS-AUG", [
    { date: mk(-2, 2), description: "Monthly reserve transfer from Operating", reference: "XFER-410", credit: 3150 },
    { date: mk(-2, 20), description: "Interest earned", reference: "INT-830", credit: 50 },
  ], 42800);

  const rsSepBank = makeBankTxs("BA-RS-03", "IMP-RS-SEP", [
    { date: mk(-1, 2), description: "Monthly reserve transfer from Operating", reference: "XFER-410", credit: 3200 },
    { date: mk(-1, 22), description: "Interest earned", reference: "INT-831", credit: 22.1 },
  ], 46000);

  const bankTxs = [...opSepBank, ...opOctBank, ...trAugBank, ...trSepBank, ...trOctBank, ...rsAugBank, ...rsSepBank];

  // ---------------- Book (ledger) transactions ----------------
  const bookTxs = makeBookTxs([
    // September — Operating
    { id: "BT-OP-S1", accountId: "BA-OP-01", date: mk(-1, 2), type: "rent_payment", description: "Rent payment — T. Whitfield (settle AR)", counterparty: "T. Whitfield", propertyId: "PL-01", unit: "M102", reference: "REN-1001", invoices: [{ id: "INV-1", number: "REN-1001", amount: 2000 }], moneyIn: 2000, moneyOut: 0, coa: "1010", source: "Payment PAY-1011" },
    { id: "BT-OP-S2", accountId: "BA-OP-01", date: mk(-1, 5), type: "rent_payment", description: "Rent payment — M. Okafor (settle AR)", counterparty: "M. Okafor", propertyId: "PL-01", unit: "M205", reference: "REN-1002", invoices: [{ id: "INV-2", number: "REN-1002", amount: 1500 }], moneyIn: 1500, moneyOut: 0, coa: "1010", source: "Payment PAY-1012" },
    { id: "BT-OP-S3", accountId: "BA-OP-01", date: mk(-1, 8), type: "rent_payment", description: "Rent payment — L. Duarte (settle AR)", counterparty: "L. Duarte", propertyId: "PL-03", unit: "H201", reference: "REN-1003", invoices: [{ id: "INV-3", number: "REN-1003", amount: 1800 }], moneyIn: 1800, moneyOut: 0, coa: "1010", source: "Payment PAY-1013" },
    { id: "BT-OP-S4", accountId: "BA-OP-01", date: mk(-1, 15), type: "interest_income", description: "Interest earned — September", counterparty: "First National Bank", propertyId: null, unit: null, reference: "INT-814", moneyIn: 41.35, moneyOut: 0, coa: "6100", source: "Journal JE-2001" },
    { id: "BT-OP-S5", accountId: "BA-OP-01", date: mk(-1, 18), type: "transfer_out", description: "Transfer to Capital Replacement Reserve", counterparty: "Internal", propertyId: null, unit: null, reference: "XFER-410", moneyIn: 0, moneyOut: 216.8, coa: "7100", source: "Journal JE-2002" },
    // October — Operating
    { id: "BT-OP-1", accountId: "BA-OP-01", date: mk(0, 2), type: "rent_payment", description: "Rent payment — T. Whitfield (settle AR)", counterparty: "T. Whitfield", propertyId: "PL-01", unit: "M102", reference: "REN-1001", invoices: [{ id: "INV-10", number: "REN-1001", amount: 2000 }], moneyIn: 2000, moneyOut: 0, coa: "1010", source: "Payment PAY-1101" },
    { id: "BT-OP-2", accountId: "BA-OP-01", date: mk(0, 3), type: "rent_payment", description: "Rent payment — M. Okafor (settle AR)", counterparty: "M. Okafor", propertyId: "PL-01", unit: "M205", reference: "REN-1002", invoices: [{ id: "INV-11", number: "REN-1002", amount: 1800 }], moneyIn: 1800, moneyOut: 0, coa: "1010", source: "Payment PAY-1102" },
    { id: "BT-OP-3", accountId: "BA-OP-01", date: mk(0, 4), type: "rent_payment", description: "Rent payment — C. Chen (settle AR)", counterparty: "C. Chen", propertyId: "PL-02", unit: "L101", reference: "REN-1003", invoices: [{ id: "INV-12", number: "REN-1003", amount: 2000 }], moneyIn: 2000, moneyOut: 0, coa: "1010", source: "Payment PAY-1103" },
    { id: "BT-OP-4", accountId: "BA-OP-01", date: mk(0, 4), type: "rent_payment", description: "Rent payment — L. Duarte (settle AR)", counterparty: "L. Duarte", propertyId: "PL-03", unit: "H201", reference: "REN-1004", invoices: [{ id: "INV-13", number: "REN-1004", amount: 1800 }], moneyIn: 1800, moneyOut: 0, coa: "1010", source: "Payment PAY-1104" },
    { id: "BT-OP-5", accountId: "BA-OP-01", date: mk(0, 7), type: "rent_payment", description: "Card payment batch — October rent receipts", counterparty: "Online card payments", propertyId: "PL-01", unit: null, reference: "CARD-B-1007", invoices: [{ id: "INV-14", number: "REN-1005", amount: 2000 }], moneyIn: 2000, moneyOut: 0, coa: "1010", source: "Payment PAY-1105" },
    { id: "BT-OP-6", accountId: "BA-OP-01", date: mk(0, 8), type: "bank_fee", description: "Merchant processing fee — October card batch", counterparty: "Payment processor", propertyId: null, unit: null, reference: "CARD-B-1007", moneyIn: 0, moneyOut: 30, coa: "5300", source: "Journal JE-2041" },
    { id: "BT-OP-7", accountId: "BA-OP-01", date: mk(0, 9), type: "vendor_payment", description: "Utilities payment — Metro Water", counterparty: "Metro Water", propertyId: "PL-01", unit: null, reference: "INV-4401", moneyIn: 0, moneyOut: 620, coa: "5200", source: "Payment PAY-1106" },
    { id: "BT-OP-8", accountId: "BA-OP-01", date: mk(0, 10), type: "vendor_payment", description: "Cleaning service — CleanCo Services", counterparty: "CleanCo Services", propertyId: "PL-02", unit: null, reference: "INV-4410", moneyIn: 0, moneyOut: 400, coa: "5100", source: "Payment PAY-1107" },
    { id: "BT-OP-9", accountId: "BA-OP-01", date: mk(0, 12), type: "transfer_out", description: "Transfer to Tenant Trust account", counterparty: "Internal", propertyId: null, unit: null, reference: "XFER-501", moneyIn: 0, moneyOut: 5000, coa: "7100", source: "Journal JE-2042" },
    { id: "BT-OP-10", accountId: "BA-OP-01", date: mk(0, 15), type: "interest_income", description: "Interest earned — October", counterparty: "First National Bank", propertyId: null, unit: null, reference: "INT-902", moneyIn: 63.2, moneyOut: 0, coa: "6100", source: "Journal JE-2043" },
    { id: "BT-OP-11", accountId: "BA-OP-01", date: mk(0, 6), type: "rent_payment", description: "Rent payment — J. Alvarez (settle AR)", counterparty: "J. Alvarez", propertyId: "PL-01", unit: "M104", reference: "REN-1006", invoices: [{ id: "INV-15", number: "REN-1006", amount: 1200 }], moneyIn: 1200, moneyOut: 0, coa: "1010", source: "Payment PAY-1108" },
    { id: "BT-OP-12", accountId: "BA-OP-01", date: mk(0, 20), type: "returned_payment", description: "Returned check reversal — J. Alvarez (REN-1006)", counterparty: "J. Alvarez", propertyId: "PL-01", unit: "M104", reference: "REN-1006", moneyIn: 0, moneyOut: 1200, coa: "1100", source: "Journal JE-2044" },
    { id: "BT-OP-13", accountId: "BA-OP-01", date: mk(0, 30), type: "rent_payment", description: "Rent payment — S. Patel covering invoices REN-1007A & REN-1007B", counterparty: "S. Patel", propertyId: "PL-02", unit: "L102", reference: "REN-1007", invoices: [{ id: "INV-16", number: "REN-1007A", amount: 850 }, { id: "INV-17", number: "REN-1007B", amount: 600 }], moneyIn: 1450, moneyOut: 0, coa: "1010", source: "Payment PAY-1109" },
    { id: "BT-OP-14", accountId: "BA-OP-01", date: mk(0, 28), type: "vendor_payment", description: "Maintenance work order WO-332 — BrightHome", counterparty: "BrightHome Maintenance", propertyId: "PL-01", unit: null, reference: "INV-4420", moneyIn: 0, moneyOut: 850, coa: "5100", source: "Payment PAY-1110" },
    { id: "BT-OP-15", accountId: "BA-OP-01", date: mk(0, 30), type: "rent_payment", description: "Rent payment — N. Brooks (settle AR)", counterparty: "N. Brooks", propertyId: "PL-03", unit: "H103", reference: "REN-1008", invoices: [{ id: "INV-18", number: "REN-1008", amount: 1850 }], moneyIn: 1850, moneyOut: 0, coa: "1010", source: "Payment PAY-1111" },
    // August / September — Trust
    { id: "BT-TR-A1", accountId: "BA-TR-02", date: mk(-2, 3), type: "tenant_deposit", description: "Security deposit collection — K. Osei", counterparty: "K. Osei", propertyId: "PL-03", unit: "H203", reference: "DEP-3001", moneyIn: 3200, moneyOut: 0, coa: "1020", source: "Deposit DR-0301" },
    { id: "BT-TR-A2", accountId: "BA-TR-02", date: mk(-2, 7), type: "tenant_deposit", description: "Security deposit collection — R. Pratt", counterparty: "R. Pratt", propertyId: "PL-01", unit: "M201", reference: "DEP-3002", moneyIn: 3000, moneyOut: 0, coa: "1020", source: "Deposit DR-0302" },
    { id: "BT-TR-A3", accountId: "BA-TR-02", date: mk(-2, 14), type: "deposit_refund", description: "Deposit refund — K. Osei (move-out H203)", counterparty: "K. Osei", propertyId: "PL-03", unit: "H203", reference: "REF-1101", moneyIn: 0, moneyOut: 1850, coa: "1020", source: "Journal JE-1901" },
    { id: "BT-TR-A4", accountId: "BA-TR-02", date: mk(-2, 18), type: "transfer_in", description: "Transfer from Operating Account", counterparty: "Internal", propertyId: null, unit: null, reference: "XFER-410", moneyIn: 2000, moneyOut: 0, coa: "1020", source: "Journal JE-1902" },
    { id: "BT-TR-S1", accountId: "BA-TR-02", date: mk(-1, 4), type: "tenant_deposit", description: "Security deposit collection — K. Osei", counterparty: "K. Osei", propertyId: "PL-03", unit: "H203", reference: "DEP-3101", moneyIn: 1200, moneyOut: 0, coa: "1020", source: "Deposit DR-0311" },
    { id: "BT-TR-S2", accountId: "BA-TR-02", date: mk(-1, 11), type: "tenant_deposit", description: "Security deposit collection — R. Pratt", counterparty: "R. Pratt", propertyId: "PL-01", unit: "M201", reference: "DEP-3102", moneyIn: 1600, moneyOut: 0, coa: "1020", source: "Deposit DR-0312" },
    { id: "BT-TR-S3", accountId: "BA-TR-02", date: mk(-1, 19), type: "deposit_refund", description: "Deposit refund — K. Osei", counterparty: "K. Osei", propertyId: "PL-03", unit: "H203", reference: "REF-1111", moneyIn: 0, moneyOut: 450, coa: "1020", source: "Journal JE-1911" },
    // October — Trust
    { id: "BT-TR-1", accountId: "BA-TR-02", date: mk(0, 2), type: "tenant_deposit", description: "Security deposit collection — A. Fowler", counterparty: "A. Fowler", propertyId: "PL-01", unit: "M110", reference: "DEP-3201", moneyIn: 1500, moneyOut: 0, coa: "1020", source: "Deposit DR-0321" },
    { id: "BT-TR-2", accountId: "BA-TR-02", date: mk(0, 9), type: "deposit_refund", description: "Deposit refund — A. Fowler", counterparty: "A. Fowler", propertyId: "PL-01", unit: "M110", reference: "REF-1121", moneyIn: 0, moneyOut: 600, coa: "1020", source: "Journal JE-1921" },
    { id: "BT-TR-3", accountId: "BA-TR-02", date: mk(0, 12), type: "transfer_in", description: "Transfer from Operating Account", counterparty: "Internal", propertyId: null, unit: null, reference: "XFER-501", moneyIn: 5000, moneyOut: 0, coa: "1020", source: "Journal JE-1922" },
    { id: "BT-TR-4", accountId: "BA-TR-02", date: mk(0, 16), type: "tenant_deposit", description: "Security deposit collection — L. Nguyen", counterparty: "L. Nguyen", propertyId: "PL-02", unit: "L105", reference: "DEP-3202", moneyIn: 2200, moneyOut: 0, coa: "1020", source: "Deposit DR-0322" },
    { id: "BT-TR-5", accountId: "BA-TR-02", date: mk(0, 27), type: "deposit_refund", description: "Deposit refund — L. Nguyen", counterparty: "L. Nguyen", propertyId: "PL-02", unit: "L105", reference: "REF-1122", moneyIn: 0, moneyOut: 1150, coa: "1020", source: "Journal JE-1923" },
    // August / September — Reserve
    { id: "BT-RS-A1", accountId: "BA-RS-03", date: mk(-2, 2), type: "transfer_in", description: "Monthly reserve transfer from Operating", counterparty: "Internal", propertyId: null, unit: null, reference: "XFER-410", moneyIn: 3150, moneyOut: 0, coa: "1030", source: "Journal JE-1801" },
    { id: "BT-RS-A2", accountId: "BA-RS-03", date: mk(-2, 20), type: "interest_income", description: "Interest earned — August", counterparty: "Metropolitan Credit Union", propertyId: null, unit: null, reference: "INT-830", moneyIn: 50, moneyOut: 0, coa: "6100", source: "Journal JE-1802" },
    { id: "BT-RS-S1", accountId: "BA-RS-03", date: mk(-1, 2), type: "transfer_in", description: "Monthly reserve transfer from Operating", counterparty: "Internal", propertyId: null, unit: null, reference: "XFER-410", moneyIn: 3200, moneyOut: 0, coa: "1030", source: "Journal JE-1811" },
    { id: "BT-RS-S2", accountId: "BA-RS-03", date: mk(-1, 22), type: "interest_income", description: "Interest earned — September", counterparty: "Metropolitan Credit Union", propertyId: null, unit: null, reference: "INT-831", moneyIn: 22.1, moneyOut: 0, coa: "6100", source: "Journal JE-1812" },
  ]);

  // ---------------- Matches ----------------
  const mkMatch = (
    id: string,
    reconId: string,
    bankIds: string[],
    bookIds: string[],
    confidence: number,
    explanation: string,
    type: "one_to_one" | "one_to_many" | "many_to_one" = "one_to_one",
  ) => ({
    id,
    reconciliationId: reconId,
    bankTxIds: bankIds,
    bookTxIds: bookIds,
    confidence,
    confidenceLevel: (confidence >= 85 ? "High" : confidence >= 60 ? "Medium" : "Low") as "High" | "Medium" | "Low",
    explanation,
    type,
    automatic: true,
    confirmedBy: "Avery Chen",
    confirmedAt: at(15),
    active: true,
    history: [{ action: "Matched automatically by matching engine", by: "Avery Chen", at: at(15), note: "Suggested match confirmed during reconciliation review." }],
  });

  const findBank = (accountId: string, dateOffsetMonth: number, day: number) =>
    bankTxs.find((t) => t.accountId === accountId && t.date === mk(dateOffsetMonth, day));

  const matches = [
    // Operating September (Reconciled)
    mkMatch("M-OS1", "REC-OP-SEP", [findBank("BA-OP-01", -1, 2)!.id], ["BT-OP-S1"], 96, "Exact amount and reference match; same transaction date."),
    mkMatch("M-OS2", "REC-OP-SEP", [findBank("BA-OP-01", -1, 5)!.id], ["BT-OP-S2"], 95, "Exact amount and reference match; same transaction date."),
    mkMatch("M-OS3", "REC-OP-SEP", [findBank("BA-OP-01", -1, 8)!.id], ["BT-OP-S3"], 95, "Exact amount and reference match; same transaction date."),
    mkMatch("M-OS4", "REC-OP-SEP", [findBank("BA-OP-01", -1, 15)!.id], ["BT-OP-S4"], 93, "Exact amount and reference match; interest income recognized in ledger."),
    mkMatch("M-OS5", "REC-OP-SEP", [findBank("BA-OP-01", -1, 18)!.id], ["BT-OP-S5"], 96, "Exact amount and reference match; internal transfer between company accounts."),
    // Operating October
    mkMatch("M-OP1", "REC-OP-OCT", [findBank("BA-OP-01", 0, 2)!.id], ["BT-OP-1"], 96, "Exact amount and reference REN-1001 match; same transaction date."),
    mkMatch("M-OP2", "REC-OP-OCT", [findBank("BA-OP-01", 0, 3)!.id], ["BT-OP-2"], 96, "Exact amount and reference REN-1002 match; same transaction date."),
    mkMatch(
      "M-OP3", "REC-OP-OCT", [findBank("BA-OP-01", 0, 5)!.id], ["BT-OP-3", "BT-OP-4"], 92,
      "One bank deposit ($3,800) equals two tenant rent payments ($2,000 C. Chen + $1,800 L. Duarte); bank posted Oct 5, book recorded Oct 4.",
      "one_to_many",
    ),
    mkMatch("M-OP4", "REC-OP-OCT", [findBank("BA-OP-01", 0, 6)!.id], ["BT-OP-11"], 94, "Exact amount and reference REN-1006 match; same transaction date."),
    mkMatch(
      "M-OP5", "REC-OP-OCT", [findBank("BA-OP-01", 0, 8)!.id], ["BT-OP-5", "BT-OP-6"], 85,
      "Net merchant settlement $1,970 = gross card rent receipts $2,000 less $30 processing fee recorded as bank charge expense (JE-2041). Fee not hidden or absorbed.",
      "one_to_many",
    ),
    mkMatch("M-OP6", "REC-OP-OCT", [findBank("BA-OP-01", 0, 9)!.id], ["BT-OP-7"], 97, "Exact amount and invoice reference INV-4401 match; same date."),
    mkMatch("M-OP7", "REC-OP-OCT", [findBank("BA-OP-01", 0, 10)!.id], ["BT-OP-8"], 95, "Exact amount and invoice reference INV-4410 match; same date."),
    mkMatch("M-OP8", "REC-OP-OCT", [findBank("BA-OP-01", 0, 12)!.id], ["BT-OP-9"], 96, "Exact amount and reference XFER-501 match; transfer between company accounts."),
    mkMatch("M-OP10", "REC-OP-OCT", [findBank("BA-OP-01", 0, 20)!.id], ["BT-OP-12"], 95, "Returned check reversal matched to accounts receivable reversal entry; same reference REN-1006."),
    // Trust August (Reopened)
    mkMatch("M-TA1", "REC-TR-AUG", [findBank("BA-TR-02", -2, 3)!.id], ["BT-TR-A1"], 96, "Exact amount and deposit reference DEP-3001 match."),
    mkMatch("M-TA2", "REC-TR-AUG", [findBank("BA-TR-02", -2, 7)!.id], ["BT-TR-A2"], 96, "Exact amount and deposit reference DEP-3002 match."),
    mkMatch("M-TA3", "REC-TR-AUG", [findBank("BA-TR-02", -2, 14)!.id], ["BT-TR-A3"], 94, "Exact amount and refund reference REF-1101 match; deposit liability relieved."),
    mkMatch("M-TA4", "REC-TR-AUG", [findBank("BA-TR-02", -2, 18)!.id], ["BT-TR-A4"], 96, "Exact amount and reference XFER-410 match; internal transfer."),
    // Trust September (Reconciled)
    mkMatch("M-TS1", "REC-TR-SEP", [findBank("BA-TR-02", -1, 4)!.id], ["BT-TR-S1"], 96, "Exact amount and deposit reference DEP-3101 match."),
    mkMatch("M-TS2", "REC-TR-SEP", [findBank("BA-TR-02", -1, 11)!.id], ["BT-TR-S2"], 96, "Exact amount and deposit reference DEP-3102 match."),
    mkMatch("M-TS3", "REC-TR-SEP", [findBank("BA-TR-02", -1, 19)!.id], ["BT-TR-S3"], 94, "Exact amount and refund reference REF-1111 match."),
    // Trust October
    mkMatch("M-TR1", "REC-TR-OCT", [findBank("BA-TR-02", 0, 2)!.id], ["BT-TR-1"], 96, "Exact amount and deposit reference DEP-3201 match; credited to tenant deposit liability (not income)."),
    mkMatch("M-TR2", "REC-TR-OCT", [findBank("BA-TR-02", 0, 9)!.id], ["BT-TR-2"], 94, "Exact amount and refund reference REF-1121 match; deposit liability relieved."),
    mkMatch("M-TR3", "REC-TR-OCT", [findBank("BA-TR-02", 0, 12)!.id], ["BT-TR-3"], 96, "Exact amount and reference XFER-501 match; internal transfer."),
    mkMatch("M-TR4", "REC-TR-OCT", [findBank("BA-TR-02", 0, 16)!.id], ["BT-TR-4"], 96, "Exact amount and deposit reference DEP-3202 match."),
    mkMatch("M-TR5", "REC-TR-OCT", [findBank("BA-TR-02", 0, 27)!.id], ["BT-TR-5"], 94, "Exact amount and refund reference REF-1122 match."),
    // Reserve August (Reconciled)
    mkMatch("M-RA1", "REC-RS-AUG", [findBank("BA-RS-03", -2, 2)!.id], ["BT-RS-A1"], 96, "Exact amount and reference XFER-410 match."),
    mkMatch("M-RA2", "REC-RS-AUG", [findBank("BA-RS-03", -2, 20)!.id], ["BT-RS-A2"], 95, "Exact amount and reference INT-830 match."),
    // Reserve September (Ready to Finalize)
    mkMatch("M-RS1", "REC-RS-SEP", [findBank("BA-RS-03", -1, 2)!.id], ["BT-RS-S1"], 96, "Exact amount and reference XFER-410 match."),
    mkMatch("M-RS2", "REC-RS-SEP", [findBank("BA-RS-03", -1, 22)!.id], ["BT-RS-S2"], 95, "Exact amount and reference INT-831 match."),
  ];

  // ---------------- Reconciliations ----------------
  const reconciliations = [
    {
      id: "REC-OP-JUL", reference: `REC-OP-${MM(-3)}`, accountId: "BA-OP-01",
      periodStart: mStart(-3), periodEnd: mEnd(-3),
      statementOpeningBalance: 143900, statementEndingBalance: 146288.4,
      statementRef: `STMT-OP-${MM(-3)}`, fileName: `statement_operating_${MM(-3)}.csv`,
      notes: "Cancelled after a duplicate statement import was discovered.",
      status: "Cancelled" as const,
      createdBy: "Avery Chen", createdAt: at(95), finalizedBy: null, finalizedAt: null, reopenReason: null,
      finalSummary: null, detailSeeded: false,
    },
    {
      id: "REC-OP-AUG", reference: `REC-OP-${MM(-2)}`, accountId: "BA-OP-01",
      periodStart: mStart(-2), periodEnd: mEnd(-2),
      statementOpeningBalance: 142091.05, statementEndingBalance: 147215.6,
      statementRef: `STMT-OP-${MM(-2)}`, fileName: `statement_operating_${MM(-2)}.csv`,
      notes: "",
      status: "Reconciled" as const,
      createdBy: "Avery Chen", createdAt: at(70),
      finalizedBy: "Avery Chen", finalizedAt: at(50), reopenReason: null,
      finalSummary: { statementEndingBalance: 147215.6, adjustedBank: 147215.6, adjustedBook: 147215.6, remainingDifference: 0, matchedCount: 6, outstandingCount: 0, unresolvedCount: 0 },
      detailSeeded: false,
    },
    {
      id: "REC-OP-SEP", reference: `REC-OP-${MM(-1)}`, accountId: "BA-OP-01",
      periodStart: mStart(-1), periodEnd: mEnd(-1),
      statementOpeningBalance: 147215.6, statementEndingBalance: 152340.15,
      statementRef: `STMT-OP-${MM(-1)}`, fileName: `statement_operating_${MM(-1)}.csv`,
      notes: "",
      status: "Reconciled" as const,
      createdBy: "Avery Chen", createdAt: at(45),
      finalizedBy: "Avery Chen", finalizedAt: at(35), reopenReason: null,
      finalSummary: { statementEndingBalance: 152340.15, adjustedBank: 152340.15, adjustedBook: 152340.15, remainingDifference: 0, matchedCount: 5, outstandingCount: 0, unresolvedCount: 0 },
      detailSeeded: true,
    },
    {
      id: "REC-OP-OCT", reference: `REC-OP-${MM(0)}`, accountId: "BA-OP-01",
      periodStart: mStart(0), periodEnd: mEnd(0),
      statementOpeningBalance: 152340.15, statementEndingBalance: 158778.35,
      statementRef: `STMT-OP-${MM(0)}`, fileName: `statement_operating_${MM(0)}.csv`,
      notes: "Current period reconciliation in progress.",
      status: "In Progress" as const,
      createdBy: "Avery Chen", createdAt: at(6), finalizedBy: null, finalizedAt: null, reopenReason: null,
      finalSummary: null, detailSeeded: true,
    },
    {
      id: "REC-TR-AUG", reference: `REC-TR-${MM(-2)}`, accountId: "BA-TR-02",
      periodStart: mStart(-2), periodEnd: mEnd(-2),
      statementOpeningBalance: 75600, statementEndingBalance: 81950,
      statementRef: `STMT-TR-${MM(-2)}`, fileName: `statement_trust_${MM(-2)}.csv`,
      notes: "Reopened after a deposit refund posted post-finalization.",
      status: "Reopened" as const,
      createdBy: "Avery Chen", createdAt: at(70),
      finalizedBy: "Avery Chen", finalizedAt: at(48),
      reopenReason: "Deposit refund (K. Osei, $1,850) was posted after finalization; reconciliation reopened for correction.",
      finalSummary: { statementEndingBalance: 81950, adjustedBank: 81950, adjustedBook: 81950, remainingDifference: 0, matchedCount: 4, outstandingCount: 0, unresolvedCount: 0 },
      detailSeeded: true,
    },
    {
      id: "REC-TR-SEP", reference: `REC-TR-${MM(-1)}`, accountId: "BA-TR-02",
      periodStart: mStart(-1), periodEnd: mEnd(-1),
      statementOpeningBalance: 81950, statementEndingBalance: 84300,
      statementRef: `STMT-TR-${MM(-1)}`, fileName: `statement_trust_${MM(-1)}.csv`,
      notes: "",
      status: "Reconciled" as const,
      createdBy: "Avery Chen", createdAt: at(45),
      finalizedBy: "Avery Chen", finalizedAt: at(35), reopenReason: null,
      finalSummary: { statementEndingBalance: 84300, adjustedBank: 84300, adjustedBook: 84300, remainingDifference: 0, matchedCount: 3, outstandingCount: 0, unresolvedCount: 0 },
      detailSeeded: true,
    },
    {
      id: "REC-TR-OCT", reference: `REC-TR-${MM(0)}`, accountId: "BA-TR-02",
      periodStart: mStart(0), periodEnd: mEnd(0),
      statementOpeningBalance: 84300, statementEndingBalance: 91268.4,
      statementRef: `STMT-TR-${MM(0)}`, fileName: `statement_trust_${MM(0)}.csv`,
      notes: "Trust account — deposits are NOT rental income.",
      status: "In Progress" as const,
      createdBy: "Avery Chen", createdAt: at(6), finalizedBy: null, finalizedAt: null, reopenReason: null,
      finalSummary: null, detailSeeded: true,
    },
    {
      id: "REC-RS-AUG", reference: `REC-RS-${MM(-2)}`, accountId: "BA-RS-03",
      periodStart: mStart(-2), periodEnd: mEnd(-2),
      statementOpeningBalance: 42800, statementEndingBalance: 46000,
      statementRef: `STMT-RS-${MM(-2)}`, fileName: `statement_reserve_${MM(-2)}.csv`,
      notes: "",
      status: "Reconciled" as const,
      createdBy: "Avery Chen", createdAt: at(70),
      finalizedBy: "Avery Chen", finalizedAt: at(50), reopenReason: null,
      finalSummary: { statementEndingBalance: 46000, adjustedBank: 46000, adjustedBook: 46000, remainingDifference: 0, matchedCount: 2, outstandingCount: 0, unresolvedCount: 0 },
      detailSeeded: true,
    },
    {
      id: "REC-RS-SEP", reference: `REC-RS-${MM(-1)}`, accountId: "BA-RS-03",
      periodStart: mStart(-1), periodEnd: mEnd(-1),
      statementOpeningBalance: 46000, statementEndingBalance: 49222.1,
      statementRef: `STMT-RS-${MM(-1)}`, fileName: `statement_reserve_${MM(-1)}.csv`,
      notes: "",
      status: "In Progress" as const,
      createdBy: "Avery Chen", createdAt: at(40), finalizedBy: null, finalizedAt: null, reopenReason: null,
      finalSummary: null, detailSeeded: true,
    },
  ];

  // ---------------- Import batches ----------------
  const importBatches = [
    { id: "IMP-JUL", accountId: "BA-OP-01", periodStart: mStart(-3), periodEnd: mEnd(-3), fileName: `statement_operating_${MM(-3)}.csv`, importedAt: at(95), importedBy: "Avery Chen", totalRows: 6, acceptedRows: 5, rejectedRows: 1, duplicateRows: 0, warnings: ["1 row rejected: duplicate reference and amount of an earlier row (duplicate statement import)."], mappingName: "First National Bank CSV", reconciliationId: "REC-OP-JUL" },
    { id: "IMP-OP-SEP", accountId: "BA-OP-01", periodStart: mStart(-1), periodEnd: mEnd(-1), fileName: `statement_operating_${MM(-1)}.csv`, importedAt: at(44), importedBy: "Avery Chen", totalRows: 5, acceptedRows: 5, rejectedRows: 0, duplicateRows: 0, warnings: [], mappingName: "First National Bank CSV", reconciliationId: "REC-OP-SEP" },
    { id: "IMP-TR-AUG", accountId: "BA-TR-02", periodStart: mStart(-2), periodEnd: mEnd(-2), fileName: `statement_trust_${MM(-2)}.csv`, importedAt: at(69), importedBy: "Avery Chen", totalRows: 4, acceptedRows: 4, rejectedRows: 0, duplicateRows: 0, warnings: [], mappingName: "First National Bank CSV", reconciliationId: "REC-TR-AUG" },
    { id: "IMP-TR-SEP", accountId: "BA-TR-02", periodStart: mStart(-1), periodEnd: mEnd(-1), fileName: `statement_trust_${MM(-1)}.csv`, importedAt: at(44), importedBy: "Sam Rivera", totalRows: 3, acceptedRows: 3, rejectedRows: 0, duplicateRows: 0, warnings: [], mappingName: "First National Bank CSV", reconciliationId: "REC-TR-SEP" },
    { id: "IMP-TR-OCT", accountId: "BA-TR-02", periodStart: mStart(0), periodEnd: mEnd(0), fileName: `statement_trust_${MM(0)}.csv`, importedAt: at(6), importedBy: "Sam Rivera", totalRows: 6, acceptedRows: 6, rejectedRows: 0, duplicateRows: 0, warnings: [], mappingName: "First National Bank CSV", reconciliationId: "REC-TR-OCT" },
    { id: "IMP-OP-OCT", accountId: "BA-OP-01", periodStart: mStart(0), periodEnd: mEnd(0), fileName: `statement_operating_${MM(0)}.csv`, importedAt: at(5), importedBy: "Sam Rivera", totalRows: 14, acceptedRows: 14, rejectedRows: 0, duplicateRows: 1, warnings: ["1 potential duplicate detected against previously imported transactions (row 3)."], mappingName: "First National Bank CSV", reconciliationId: "REC-OP-OCT" },
    { id: "IMP-RS-AUG", accountId: "BA-RS-03", periodStart: mStart(-2), periodEnd: mEnd(-2), fileName: `statement_reserve_${MM(-2)}.csv`, importedAt: at(69), importedBy: "Avery Chen", totalRows: 2, acceptedRows: 2, rejectedRows: 0, duplicateRows: 0, warnings: [], mappingName: "First National Bank CSV", reconciliationId: "REC-RS-AUG" },
    { id: "IMP-RS-SEP", accountId: "BA-RS-03", periodStart: mStart(-1), periodEnd: mEnd(-1), fileName: `statement_reserve_${MM(-1)}.csv`, importedAt: at(39), importedBy: "Sam Rivera", totalRows: 2, acceptedRows: 2, rejectedRows: 0, duplicateRows: 0, warnings: [], mappingName: "First National Bank CSV", reconciliationId: "REC-RS-SEP" },
  ];

  // ---------------- Import mappings ----------------
  const importMappings = [
    {
      id: "MAP-FNB", name: "First National Bank CSV", format: "Debit/Credit columns",
      columns: { transactionDate: 0, postedDate: null, description: 1, reference: 2, debit: 3, credit: 4, signedAmount: null, runningBalance: null },
      signedAmountMeaning: "positive_is_deposit" as const, createdAt: at(90), system: true,
    },
    {
      id: "MAP-GEN-DC", name: "Generic Bank (Debit/Credit)", format: "Debit/Credit columns",
      columns: { transactionDate: 0, postedDate: 1, description: 2, reference: 3, debit: 4, credit: 5, signedAmount: null, runningBalance: 6 },
      signedAmountMeaning: "positive_is_deposit" as const, createdAt: at(90), system: true,
    },
    {
      id: "MAP-GEN-SIGNED", name: "Generic Bank (Signed Amount)", format: "Single signed amount column",
      columns: { transactionDate: 0, postedDate: 1, description: 2, reference: 3, debit: null, credit: null, signedAmount: 4, runningBalance: 5 },
      signedAmountMeaning: "positive_is_deposit" as const, createdAt: at(90), system: true,
    },
  ];

  // ---------------- Users ----------------
  const users = [
    {
      id: "u-admin", name: "Avery Chen", role: "Accounting Admin",
      permissions: [
        "view_bank_accounts", "create_edit_bank_accounts", "start_reconciliation", "import_statements",
        "match_transactions", "unmatch_transactions", "record_missing", "approve_adjustments",
        "finalize_reconciliation", "reopen_reconciliation", "cancel_reconciliation", "view_reports", "manage_settings",
      ],
    },
    {
      id: "u-staff", name: "Sam Rivera", role: "Staff Accountant",
      permissions: [
        "view_bank_accounts", "start_reconciliation", "import_statements", "match_transactions",
        "unmatch_transactions", "record_missing", "view_reports",
      ],
    },
  ];

  // ---------------- Settings ----------------
  const settings = {
    frequency: "Monthly" as const,
    dateToleranceDays: 3,
    autoMatching: true,
    confidenceHigh: 85,
    confidenceMedium: 60,
    confidenceLow: 30,
    duplicateSensitivity: "normal" as const,
    currencyPrecision: 2,
    approvalRequired: true,
    reopenPermission: "admin" as const,
    staleWarningDays: 30,
    csvHasHeader: true,
    csvPositiveIsDeposit: true,
    csvDelimiter: ",",
    notificationEmail: "accounting@sunrisepm.example.com",
  };

  // ---------------- Deposit liability ledger ----------------
  const depositLedger = [
    { tenant: "K. Osei", property: "Harbor View Condos", unit: "H203", periodStart: mStart(-2), deposits: 4400, refunds: 2300, balance: 2100 },
    { tenant: "R. Pratt", property: "Maple Grove Apartments", unit: "M201", periodStart: mStart(-2), deposits: 4600, refunds: 0, balance: 4600 },
    { tenant: "A. Fowler", property: "Maple Grove Apartments", unit: "M110", periodStart: mStart(0), deposits: 1500, refunds: 600, balance: 900 },
    { tenant: "L. Nguyen", property: "Lakeside Apartments", unit: "L105", periodStart: mStart(0), deposits: 2200, refunds: 1150, balance: 1050 },
  ];

  // ---------------- Audit log ----------------
  const audit = [
    { id: "A-001", eventId: "EV-1001", at: at(120), user: "Avery Chen", action: "Bank account created", record: "BA-OP-01", before: "", after: "Operating account configured (GL 1010)", notes: "Initial setup" },
    { id: "A-002", eventId: "EV-1002", at: at(120), user: "Avery Chen", action: "Bank account created", record: "BA-TR-02", before: "", after: "Trust account configured (GL 1020)", notes: "Restricted funds classification" },
    { id: "A-003", eventId: "EV-1003", at: at(95), user: "Avery Chen", action: "Statement import", record: "IMP-JUL", before: "", after: "6 rows parsed; 5 accepted, 1 rejected", notes: "Rejected row: duplicate of earlier row" },
    { id: "A-004", eventId: "EV-1004", at: at(94), user: "Avery Chen", action: "Reconciliation cancelled", record: "REC-OP-JUL", before: "In Progress", after: "Cancelled", notes: "Duplicate statement import discovered" },
    { id: "A-005", eventId: "EV-1005", at: at(50), user: "Avery Chen", action: "Reconciliation finalized", record: "REC-OP-AUG", before: "Ready to Finalize", after: "Reconciled", notes: "Adjusted balances agreed; no unresolved items" },
    { id: "A-006", eventId: "EV-1006", at: at(48), user: "Avery Chen", action: "Reconciliation reopened", record: "REC-TR-AUG", before: "Reconciled", after: "Reopened", notes: "Deposit refund posted after finalization" },
    { id: "A-007", eventId: "EV-1007", at: at(35), user: "Avery Chen", action: "Reconciliation finalized", record: "REC-OP-SEP", before: "Ready to Finalize", after: "Reconciled", notes: "5/5 bank transactions matched" },
    { id: "A-008", eventId: "EV-1008", at: at(35), user: "Avery Chen", action: "Reconciliation finalized", record: "REC-TR-SEP", before: "Ready to Finalize", after: "Reconciled", notes: "Deposit liability check in balance" },
    { id: "A-009", eventId: "EV-1009", at: at(15), user: "Avery Chen", action: "Manual transaction match", record: "M-OP5", before: "", after: "Net settlement grouped match confirmed", notes: "Gross receipts $2,000 + $30 fee = $1,970 net" },
    { id: "A-010", eventId: "EV-1010", at: at(6), user: "Avery Chen", action: "Reconciliation created", record: "REC-OP-OCT", before: "", after: "Statement period opened", notes: "" },
    { id: "A-011", eventId: "EV-1011", at: at(5), user: "Sam Rivera", action: "Statement import", record: "IMP-OP-OCT", before: "", after: "14 rows parsed; 14 accepted, 1 potential duplicate flagged", notes: "Imported into REC-OP-OCT" },
    { id: "A-012", eventId: "EV-1012", at: at(6), user: "Avery Chen", action: "Reconciliation created", record: "REC-TR-OCT", before: "", after: "Statement period opened", notes: "Trust account safeguards active" },
    { id: "A-013", eventId: "EV-1013", at: at(40), user: "Sam Rivera", action: "Reconciliation created", record: "REC-RS-SEP", before: "", after: "Statement period opened", notes: "" },
    { id: "A-014", eventId: "EV-1014", at: at(40), user: "Avery Chen", action: "Investigation note added", record: "BT-OP-15", before: "", after: "Note: 'Electronic transfer pending bank clearance — expected next statement.'", notes: "Deposit in transit classified as timing difference" },
  ];

  return {
    version: 3,
    users,
    currentUserId: "u-admin",
    accounts,
    bookTxs,
    bankTxs,
    reconciliations,
    matches,
    adjustments: [],
    importBatches,
    importMappings,
    audit,
    settings,
    properties,
    units,
    tenants,
    vendors,
    coa,
    depositLedger,
  };
}
