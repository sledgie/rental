// Builds the Financial Reports dataset from the organization's books (Supabase mode). The report engine was written against a sample chart of
// accounts, so the few accounts it looks up directly (operating cash, trust cash, security deposits, rent, other rental income, property tax,
// interest, bank charges) are resolved to your real accounts in SYS.
//   accounts        <- accounts (types and report sections derived from type, code, name and system key)
//   journal entries <- journal_entries + journal_entry_lines (the general ledger: P&L, balance sheet, trial balance, cash flow ...)
//   invoices / payments / allocations <- invoices, invoice_lines, payments, payment_allocations (+ balances)
//   vendor bills / bill payments      <- bills, bill_payments          deposits <- deposits + deposit_transactions
//   bank statements / transactions    <- reconciliations, bank_transactions
// Budgets, mortgages and tax codes are not recorded yet, so those reports stay empty.
import { supabase } from "../../../lib/supabase";
import { fetchAll, loadFinance } from "../../../lib/financeData";
import type {
  BankAccount, BankStatement, BankTxn, BillPayment, BillPaymentAllocation, BsSection, CashFlowClass, ChartAccount, Dataset, Invoice, JournalEntry, JournalSourceType, Lease, Owner, Payment,
  PaymentAllocation, PnlSection, Portfolio, Property, SecurityDeposit, Tenant, Unit, Vendor, VendorBill,
} from "../types";
import { COMPANY, SYS } from "./constants";

/* eslint-disable @typescript-eslint/no-explicit-any -- rows come from untyped PostgREST responses */

const num = (v: unknown) => Math.round(Number(v ?? 0) * 100) / 100;
const day = (v: string | null | undefined) => (v ? String(v).slice(0, 10) : "");

export const emptyDataset = (today: string): Dataset => ({
  companyName: COMPANY.name, legalName: COMPANY.name, address: "", currency: "CAD", today, owners: [], portfolios: [], properties: [], units: [], tenants: [], leases: [], vendors: [],
  bankAccounts: [], accounts: [], taxCodes: [], invoices: [], payments: [], allocations: [], bills: [], billPayments: [], billAllocations: [], deposits: [], journalEntries: [], budgets: [],
  bankStatements: [], bankTxns: [], mortgages: [],
});

function sections(a: any): { type: ChartAccount["accountType"]; pnl: PnlSection | null; bs: BsSection | null; operating: boolean; flow: CashFlowClass } {
  const name = String(a.name).toLowerCase();
  const key = a.system_key ?? "";
  switch (a.account_type) {
    case "revenue":
    case "other_income": {
      const pnl: PnlSection = a.account_type === "other_income" ? "other_non_operating" : key === "late_fees" || /late/.test(name) ? "late_fees_charges" : /rent/.test(name) || key === "rent_income" ? "rental_income" : "other_rental_income";
      return { type: "revenue", pnl, bs: null, operating: a.account_type === "revenue", flow: "operating" };
    }
    case "operating_cost":
    case "administrative_expense":
    case "other_expense": {
      const pnl: PnlSection =
        /interest/.test(name) ? "interest" : /depreciat/.test(name) ? "depreciation" : /repair|mainten|landscap|snow|janitor|clean|pest/.test(name) ? "repairs_maintenance"
          : /electric|gas|water|sewer|utilit|hydro/.test(name) ? "utilities" : /insurance/.test(name) ? "insurance" : /tax/.test(name) ? "property_taxes"
            : /management/.test(name) ? "management_fees" : a.account_type === "other_expense" ? "other_non_operating" : "other_operating";
      return { type: "expense", pnl, bs: null, operating: a.account_type !== "other_expense", flow: "operating" };
    }
    case "asset": {
      const bs: BsSection = ["operating_bank", "trust_bank"].includes(key) || /bank|cash/.test(name) ? "cash" : key === "accounts_receivable" || /receivable|allowance/.test(name) ? "ar"
        : /prepaid/.test(name) ? "prepaid" : /depreciation/.test(name) ? "accum_depreciation" : /equipment|building|land|furniture|vehicle|improvement/.test(name) ? "ppe"
          : a.classification === "Non-Current Asset" ? "other_asset" : "other_current_asset";
      return { type: "asset", pnl: null, bs, operating: false, flow: bs === "ppe" || bs === "accum_depreciation" ? "investing" : bs === "cash" ? "none" : "operating" };
    }
    case "liability": {
      const bs: BsSection = key === "accounts_payable" || /payable/.test(name) && /account/.test(name) ? "ap" : key === "tenant_deposits" || /deposit/.test(name) && /security|tenant/.test(name) ? "security_deposits"
        : key === "tenant_credits" || /prepaid rent|credit/.test(name) ? "unapplied_payments" : key === "sales_tax_payable" || /gst|hst|tax/.test(name) ? "tax_payable"
          : /mortgage|loan/.test(name) ? "mortgage" : /accrued/.test(name) ? "accrued" : "other_liability";
      return { type: "liability", pnl: null, bs, operating: false, flow: bs === "mortgage" ? "financing" : "operating" };
    }
    default: {
      const bs: BsSection = /contribut|capital/.test(name) ? "owner_contributions" : /draw|distribut/.test(name) ? "owner_distributions" : "retained_earnings";
      return { type: "equity", pnl: null, bs, operating: false, flow: bs === "retained_earnings" ? "none" : "financing" };
    }
  }
}

const SOURCE: Record<string, JournalSourceType> = {
  manual: "manual", invoice: "tenant_invoice", payment: "tenant_payment", payment_reversal: "tenant_payment", refund: "tenant_payment", credit_note: "tenant_credit", credit_application: "tenant_credit",
  expense: "vendor_bill", bill: "vendor_bill", bill_payment: "vendor_payment", bank_transaction: "bank_charge", transfer: "manual", deposit: "security_deposit", recurring: "manual", reversal: "manual",
  opening: "opening_balance", adjustment: "manual",
};
const METHOD: Record<string, Payment["paymentMethod"]> = { etransfer: "e-transfer", cash: "cash", card: "pre-authorized", cheque: "cheque", bank_transfer: "wire", pre_authorized_debit: "pre-authorized", other: "e-transfer" };

export async function loadFinancialDataset(orgId: string): Promise<Dataset> {
  const today = new Date().toISOString().slice(0, 10);
  const [org, owners, links, props, units, tenants, leases, leaseUnits, parties, vendors, banks, accounts, entries, lines, invoiceLines, bills, billBalances, billPayments, deposits, depositTxns, recs, bankTxns, finance] =
    await Promise.all([
      supabase.from("organizations").select("name, legal_name, address_line1, city").eq("id", orgId).maybeSingle(),
      fetchAll("owners", "id, name, owner_type", orgId, "name"),
      fetchAll("property_owners", "property_id, owner_id, ownership_percentage", orgId, "property_id"),
      fetchAll("properties", "*", orgId, "name"),
      fetchAll("units", "id, property_id, unit_number, bedrooms, bathrooms, square_feet, market_rent, unit_status, archived_at", orgId, "unit_number"),
      fetchAll("tenants", "id, tenant_number, first_name, last_name, email, phone, status", orgId, "last_name"),
      fetchAll("leases", "id, status, start_date, end_date, agreed_monthly_rent, deposit_amount", orgId, "start_date"),
      fetchAll("lease_units", "lease_id, unit_id", orgId, "lease_id"),
      fetchAll("lease_parties", "lease_id, tenant_id, role", orgId, "lease_id"),
      fetchAll("vendors", "id, company_name, vendor_type, trade, is_active", orgId, "company_name"),
      fetchAll("bank_accounts", "id, name, institution, last4, gl_account_id, purpose, account_type, is_active", orgId, "name"),
      fetchAll("accounts", "*", orgId, "code"),
      fetchAll("journal_entries", "id, entry_number, entry_date, memo, source, source_id, status, posted_at", orgId, "entry_date"),
      fetchAll("journal_entry_lines", "id, entry_id, line_number, account_id, debit, credit, memo, property_id, unit_id, tenant_id, vendor_id", orgId, "entry_id"),
      fetchAll("invoice_lines", "id, invoice_id, description, account_id, subtotal, tax_amount", orgId, "invoice_id"),
      fetchAll("bills", "id, bill_number, name, category, vendor_id, property_id, invoice_number, invoice_date, due_date, amount, tax_amount, status", orgId, "invoice_date"),
      fetchAll("v_bill_balances", "bill_id, paid, derived_status", orgId, "bill_id").catch(() => []),
      fetchAll("bill_payments", "id, bill_id, amount, paid_on, method, reference_number, bank_account_id", orgId, "paid_on"),
      fetchAll("deposits", "*", orgId, "created_at"),
      fetchAll("deposit_transactions", "deposit_id, txn_type, signed_amount, status", orgId, "deposit_id").catch(() => []),
      fetchAll("reconciliations", "id, bank_account_id, period_start, period_end, statement_ending_balance, status", orgId, "period_end").catch(() => []),
      fetchAll("bank_transactions", "id, bank_account_id, tx_date, description, signed_amount", orgId, "tx_date").catch(() => []),
      loadFinance(orgId),
    ]);

  const companyName = org.data?.name ?? "Your organization";
  COMPANY.name = companyName;

  // ---- chart of accounts, and the accounts the engine looks up directly
  const chart: ChartAccount[] = accounts.map((a: any) => {
    const s = sections(a);
    return {
      accountId: a.id, accountCode: a.code, accountName: a.name, accountType: s.type, parentAccountId: a.parent_id ?? null, normalBalance: a.normal_balance, isPostingAccount: a.role === "posting",
      isActive: a.status === "active", pnlSection: s.pnl, bsSection: s.bs, isOperating: s.operating, cashFlowClass: s.flow,
    };
  });
  const byKey = (k: string) => accounts.find((a: any) => a.system_key === k)?.id;
  const byName = (re: RegExp, type?: string) => accounts.find((a: any) => a.role === "posting" && re.test(String(a.name).toLowerCase()) && (!type || a.account_type === type))?.id;
  Object.assign(SYS, {
    cash: byKey("operating_bank") ?? byName(/bank|cash/, "asset") ?? "",
    trust: byKey("trust_bank") ?? "",
    securityDeposits: byKey("tenant_deposits") ?? "",
    rent: byKey("rent_income") ?? byName(/rent/, "revenue") ?? "",
    otherRental: byName(/parking|laundry|locker|utility billing/, "revenue") ?? "",
    propertyTax: byName(/property tax/) ?? "",
    interest: byName(/interest expense|mortgage interest/) ?? "",
    bankCharges: byName(/bank charge/) ?? "",
  });

  // ---- owners, portfolios, properties, units, tenants, leases, vendors
  const ownerList: Owner[] = owners.map((o: any) => ({ ownerId: o.id, ownerName: o.name, entityType: o.owner_type ?? "individual" }));
  const NO_OWNER = "owner-none";
  if (!ownerList.length || props.some((p: any) => !links.some((l: any) => l.property_id === p.id))) ownerList.push({ ownerId: NO_OWNER, ownerName: companyName, entityType: "organization" });
  const portfolios: Portfolio[] = ownerList.map((o) => ({ portfolioId: `pf-${o.ownerId}`, portfolioName: `${o.ownerName} portfolio`, ownerId: o.ownerId }));
  const ownerOf = (propertyId: string) => links.filter((l: any) => l.property_id === propertyId).sort((a: any, b: any) => num(b.ownership_percentage) - num(a.ownership_percentage))[0]?.owner_id ?? NO_OWNER;
  const properties: Property[] = props.map((p: any) => {
    const type = String(p.property_type ?? "");
    const owner = ownerOf(p.id);
    return {
      propertyId: p.id, propertyName: p.name, propertyCode: p.code ?? "", propertyType: /town/.test(type) ? "townhouse" : /duplex/.test(type) ? "duplex" : /commercial|retail|office|industrial/.test(type) ? "commercial" : "multi-family",
      address: p.address_line1 ?? "", city: p.city ?? "", province: p.state_province ?? "", postalCode: p.postal_code ?? "", ownerId: owner, portfolioId: `pf-${owner}`, activeStatus: p.archived_at ? "inactive" : "active",
      unitCount: units.filter((u: any) => u.property_id === p.id && !u.archived_at).length, imageUrl: "", acquiredDate: day(p.date_acquired) || day(p.created_at),
    };
  });
  const unitList: Unit[] = units.filter((u: any) => !u.archived_at).map((u: any) => ({
    unitId: u.id, propertyId: u.property_id, unitNumber: u.unit_number, bedrooms: num(u.bedrooms), bathrooms: num(u.bathrooms), sqft: num(u.square_feet), marketRent: num(u.market_rent),
    status: ["occupied", "notice"].includes(u.unit_status) ? "occupied" : "vacant",
  }));
  const unitProperty = new Map<string, string>(units.map((u: any) => [u.id, u.property_id]));
  const tenantList: Tenant[] = tenants.map((t: any) => ({
    tenantId: t.id, tenantName: `${t.first_name} ${t.last_name ?? ""}`.trim(), status: ["former", "inactive"].includes(t.status) ? "former" : t.status === "active" ? "active" : "pending",
    contactReference: t.tenant_number ?? "", email: t.email ?? "", phone: t.phone ?? "",
  }));
  const leaseList: Lease[] = leases.filter((l: any) => !["draft", "archived"].includes(l.status)).map((l: any) => {
    const unitId = leaseUnits.find((x: any) => x.lease_id === l.id)?.unit_id ?? "";
    return {
      leaseId: l.id, unitId, propertyId: unitProperty.get(unitId) ?? "", tenantId: (parties.find((p: any) => p.lease_id === l.id && p.role === "main_tenant") ?? parties.find((p: any) => p.lease_id === l.id))?.tenant_id ?? "",
      leaseStatus: l.status === "active" ? "active" : ["expired", "terminated"].includes(l.status) ? "expired" : "pending", startDate: day(l.start_date), endDate: day(l.end_date), monthlyRent: num(l.agreed_monthly_rent),
      depositAmount: num(l.deposit_amount),
    };
  });
  const vendorList: Vendor[] = vendors.map((v: any) => ({ vendorId: v.id, vendorName: v.company_name, category: v.trade ?? String(v.vendor_type).replace(/_/g, " "), city: "", status: v.is_active ? "active" : "inactive" }));

  // ---- bank accounts
  const bankAccounts: BankAccount[] = banks.map((b: any) => ({
    bankAccountId: b.id, accountId: b.gl_account_id ?? SYS.cash, name: b.name, bankName: b.institution ?? "", accountNumberMasked: b.last4 ? `•••• ${b.last4}` : "", type: /trust/i.test(`${b.purpose} ${b.account_type}`) ? "trust" : "operating", currency: "CAD",
  }));

  // ---- general ledger
  const linesBy = new Map<string, any[]>();
  for (const l of lines) linesBy.set(l.entry_id, [...(linesBy.get(l.entry_id) ?? []), l]);
  const journalEntries: JournalEntry[] = entries.map((e: any) => {
    const mine = (linesBy.get(e.id) ?? []).sort((a: any, b: any) => a.line_number - b.line_number);
    return {
      journalEntryId: e.id, journalEntryNumber: e.entry_number ? `JE-${String(e.entry_number).padStart(5, "0")}` : e.id.slice(0, 8), transactionDate: day(e.entry_date), postingDate: day(e.entry_date), description: e.memo ?? "",
      referenceNumber: e.source_id ?? "", sourceType: SOURCE[e.source] ?? "manual", sourceId: e.source_id ?? "", propertyId: mine.find((l: any) => l.property_id)?.property_id ?? null, status: e.status,
      debitTotal: num(mine.reduce((s: number, l: any) => s + num(l.debit), 0)), creditTotal: num(mine.reduce((s: number, l: any) => s + num(l.credit), 0)), cashFlowClass: "operating",
      lines: mine.map((l: any) => ({
        journalLineId: l.id, journalEntryId: e.id, accountId: l.account_id, debitAmount: num(l.debit), creditAmount: num(l.credit), propertyId: l.property_id ?? (l.unit_id ? unitProperty.get(l.unit_id) ?? null : null),
        description: l.memo ?? e.memo ?? "", tenantId: l.tenant_id ?? null, vendorId: l.vendor_id ?? null, unitId: l.unit_id ?? null,
      })),
    };
  });

  // ---- receivables
  const invoiceLinesBy = new Map<string, any[]>();
  for (const l of invoiceLines) invoiceLinesBy.set(l.invoice_id, [...(invoiceLinesBy.get(l.invoice_id) ?? []), l]);
  const invoices: Invoice[] = finance.invoices.map((i) => {
    const mine = invoiceLinesBy.get(i.id) ?? [];
    const subtotal = num(mine.reduce((s: number, l: any) => s + num(l.subtotal), 0));
    const tax = num(mine.reduce((s: number, l: any) => s + num(l.tax_amount), 0));
    const paid = i.paidByPayments + i.paidByCredits;
    return {
      invoiceId: i.id, invoiceNumber: i.number, invoiceType: i.type === "rent" ? "rent" : i.type === "late_fee" ? "late_fee" : "other_charge", tenantId: i.tenantId, propertyId: i.propertyId ?? (i.unitId ? unitProperty.get(i.unitId) ?? "" : ""),
      unitId: i.unitId ?? "", leaseId: i.leaseId ?? "", invoiceDate: i.issueDate, dueDate: i.dueDate, subtotal: subtotal || i.total, taxAmount: tax, totalAmount: i.total,
      status: i.status === "void" ? "void" : i.status === "draft" || i.status === "pending_approval" ? "draft" : i.outstanding <= 0.004 ? (i.paidByCredits >= i.total ? "credited" : "paid") : paid > 0 ? "partial" : "open",
      lines: mine.map((l: any) => ({ lineId: l.id, accountId: l.account_id ?? SYS.rent, description: l.description ?? "", amount: num(l.subtotal), taxCodeId: "", taxAmount: num(l.tax_amount) })),
      isOpening: false, notes: i.description || undefined,
    };
  });
  const payDate = new Map(finance.payments.map((p) => [p.id, p.date]));
  const payments: Payment[] = finance.payments.map((p) => ({
    paymentId: p.id, paymentNumber: p.number, paymentDate: p.date, paymentMethod: METHOD[p.method] ?? "e-transfer", bankAccountId: "", tenantId: p.tenantId, totalAmount: p.amount,
    paymentStatus: p.status === "reversed" ? "reversed" : "posted", reference: p.reference, isOpening: false,
  }));
  const allocations: PaymentAllocation[] = finance.allocations.map((a, i) => ({ allocationId: `${a.paymentId}-${i}`, paymentId: a.paymentId, invoiceId: a.invoiceId, allocatedAmount: a.amount, allocationDate: payDate.get(a.paymentId) ?? "" }));

  // ---- payables (provider bills)
  const billPaid = new Map<string, number>(billBalances.map((b: any) => [b.bill_id, num(b.paid)]));
  const expenseAccount = (category: string) =>
    ({ hydro: byName(/electric/), gas: byName(/gas/), water: byName(/water/), insurance: byName(/insurance/), property_tax: byName(/property tax/), maintenance: byName(/repair|mainten/) } as Record<string, string | undefined>)[category]
    ?? byName(/office|other/, "administrative_expense") ?? "";
  const billList: VendorBill[] = bills.filter((b: any) => b.status !== "draft").map((b: any) => {
    const paid = billPaid.get(b.id) ?? 0;
    const total = num(b.amount);
    return {
      billId: b.id, billNumber: b.bill_number ?? b.id.slice(0, 8), vendorId: b.vendor_id, propertyId: b.property_id ?? null, billDate: day(b.invoice_date), dueDate: day(b.due_date),
      subtotal: num(total - num(b.tax_amount)), taxAmount: num(b.tax_amount), totalAmount: total, status: b.status === "cancelled" ? "void" : paid >= total ? "paid" : paid > 0 ? "partial" : "open",
      paymentStatus: paid >= total ? "paid" : paid > 0 ? "partial" : "unpaid", billReference: b.invoice_number ?? "",
      lines: [{ lineId: `${b.id}-1`, accountId: expenseAccount(b.category), description: b.name ?? b.category, amount: num(total - num(b.tax_amount)), taxCodeId: "", taxAmount: num(b.tax_amount), isCapital: false, itcEligible: num(b.tax_amount) > 0 }],
      isOpening: false, expenseCategory: String(b.category).replace(/_/g, " "),
    };
  });
  const billVendor = new Map<string, string>(bills.map((b: any) => [b.id, b.vendor_id]));
  const billPaymentList: BillPayment[] = billPayments.map((p: any) => ({
    billPaymentId: p.id, paymentDate: day(p.paid_on), paymentMethod: p.method === "cheque" ? "cheque" : /pre|pad|auto/.test(String(p.method)) ? "pre-authorized" : /wire|bank/.test(String(p.method)) ? "wire" : "e-transfer",
    bankAccountId: p.bank_account_id ?? "", vendorId: billVendor.get(p.bill_id) ?? "", totalAmount: num(p.amount), reference: p.reference_number ?? "", isOpening: false,
  }));
  const billAllocations: BillPaymentAllocation[] = billPayments.map((p: any) => ({ allocationId: `${p.id}-a`, billPaymentId: p.id, billId: p.bill_id, allocatedAmount: num(p.amount), allocationDate: day(p.paid_on) }));

  // ---- security deposits
  const depositList: SecurityDeposit[] = deposits.map((d: any) => {
    const mine = depositTxns.filter((t: any) => t.deposit_id === d.id && t.status === "posted");
    const total = (types: string[]) => num(Math.abs(mine.filter((t: any) => types.includes(t.txn_type)).reduce((s: number, t: any) => s + num(t.signed_amount), 0)));
    const received = total(["collection", "partial_collection"]);
    const refunded = total(["refund_payment"]);
    const applied = total(["application"]);
    const type = String(d.deposit_type ?? "");
    return {
      depositId: d.id, tenantId: d.tenant_id ?? "", propertyId: d.property_id ?? "", unitId: d.unit_id ?? "", leaseId: d.lease_id ?? "",
      depositType: /pet/.test(type) ? "pet" : /key/.test(type) ? "key" : /last/.test(type) ? "last_month" : "security", dateReceived: day(d.first_received_date) || day(d.created_at),
      amountReceived: received, amountRefunded: refunded, amountApplied: applied,
      status: refunded >= received && received > 0 ? "refunded" : refunded > 0 ? "partially_refunded" : applied > 0 ? "applied" : /refund/.test(String(d.status)) ? "pending_refund" : "held",
      bankAccountId: "", notes: d.notes ?? "",
    };
  });

  // ---- bank statements and lines
  const bankStatements: BankStatement[] = recs.filter((r: any) => r.status !== "cancelled").map((r: any) => ({
    statementId: r.id, bankAccountId: r.bank_account_id, periodStart: day(r.period_start), periodEnd: day(r.period_end), endingDate: day(r.period_end), endingBalance: num(r.statement_ending_balance), isSampleData: false,
  }));
  const bankTxnList: BankTxn[] = bankTxns.map((t: any) => ({
    bankTxnId: t.id, bankAccountId: t.bank_account_id, txnDate: day(t.tx_date), description: t.description ?? "", amount: Math.abs(num(t.signed_amount)), type: num(t.signed_amount) >= 0 ? "deposit" : "withdrawal",
    sourcePaymentId: null, sourceBillPaymentId: null, sourceJournalId: null,
    statementId: bankStatements.find((s) => s.bankAccountId === t.bank_account_id && day(t.tx_date) >= s.periodStart && day(t.tx_date) <= s.periodEnd)?.statementId ?? null, defaultMatched: false,
  }));

  return {
    companyName, legalName: org.data?.legal_name ?? companyName, address: [org.data?.address_line1, org.data?.city].filter(Boolean).join(", "), currency: "CAD", today,
    owners: ownerList, portfolios, properties, units: unitList, tenants: tenantList, leases: leaseList, vendors: vendorList, bankAccounts, accounts: chart, taxCodes: [],
    invoices, payments, allocations, bills: billList, billPayments: billPaymentList, billAllocations, deposits: depositList, journalEntries, budgets: [], bankStatements, bankTxns: bankTxnList, mortgages: [],
  };
}
