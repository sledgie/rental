export type AccountType = "asset" | "liability" | "equity" | "revenue" | "expense";
export type NormalBalance = "debit" | "credit";
export type AccountingBasis = "accrual" | "cash";
export type ReportAvailability =
  | "available"
  | "available_with_limitations"
  | "requires_accounting_data"
  | "planned";

export type PeriodPreset =
  | "this-month"
  | "last-month"
  | "this-quarter"
  | "last-quarter"
  | "ytd"
  | "last-year"
  | "fiscal-year"
  | "custom";

export type ReportCategoryId =
  | "financial-performance"
  | "cash-flow-banking"
  | "receivables-payables"
  | "accounting-gl"
  | "property-investment"
  | "liabilities-tax";

export type PnlSection =
  | "rental_income"
  | "other_rental_income"
  | "late_fees_charges"
  | "repairs_maintenance"
  | "utilities"
  | "insurance"
  | "property_taxes"
  | "management_fees"
  | "other_operating"
  | "interest"
  | "depreciation"
  | "other_non_operating";

export type BsSection =
  | "cash"
  | "ar"
  | "prepaid"
  | "other_current_asset"
  | "ppe"
  | "accum_depreciation"
  | "other_asset"
  | "ap"
  | "security_deposits"
  | "accrued"
  | "unapplied_payments"
  | "tax_payable"
  | "mortgage"
  | "other_liability"
  | "owner_contributions"
  | "owner_distributions"
  | "retained_earnings";

export type CashFlowClass = "operating" | "investing" | "financing" | "none";

export type JournalSourceType =
  | "opening_balance"
  | "tenant_invoice"
  | "tenant_credit"
  | "tenant_payment"
  | "unapplied_payment"
  | "vendor_bill"
  | "vendor_payment"
  | "security_deposit"
  | "deposit_refund"
  | "deposit_application"
  | "mortgage_payment"
  | "depreciation"
  | "prepaid_amortization"
  | "capital_expenditure"
  | "owner_contribution"
  | "owner_distribution"
  | "bank_charge"
  | "insurance_prepayment"
  | "manual";

export type TaxTreatment = "taxable" | "exempt" | "zero_rated" | "out_of_scope";
export type TransactionStatus = "draft" | "posted" | "reversed";
export type InvoiceStatus = "draft" | "open" | "partial" | "paid" | "credited" | "void";
export type BillStatus = "open" | "partial" | "paid" | "void";
export type LeaseStatus = "active" | "expired" | "pending";
export type DepositStatus = "held" | "pending_refund" | "refunded" | "partially_refunded" | "applied";

export interface Owner {
  ownerId: string;
  ownerName: string;
  entityType: string;
}

export interface Portfolio {
  portfolioId: string;
  portfolioName: string;
  ownerId: string;
}

export interface Property {
  propertyId: string;
  propertyName: string;
  propertyCode: string;
  propertyType: "multi-family" | "townhouse" | "duplex" | "commercial";
  address: string;
  city: string;
  province: string;
  postalCode: string;
  ownerId: string;
  portfolioId: string;
  activeStatus: "active" | "inactive";
  unitCount: number;
  imageUrl: string;
  acquiredDate: string;
}

export interface Unit {
  unitId: string;
  propertyId: string;
  unitNumber: string;
  bedrooms: number;
  bathrooms: number;
  sqft: number;
  marketRent: number;
  status: "occupied" | "vacant";
}

export interface Tenant {
  tenantId: string;
  tenantName: string;
  status: "active" | "former" | "pending";
  contactReference: string;
  email: string;
  phone: string;
}

export interface Lease {
  leaseId: string;
  unitId: string;
  propertyId: string;
  tenantId: string;
  leaseStatus: LeaseStatus;
  startDate: string;
  endDate: string;
  monthlyRent: number;
  depositAmount: number;
}

export interface Vendor {
  vendorId: string;
  vendorName: string;
  category: string;
  city: string;
  status: "active" | "inactive";
}

export interface BankAccount {
  bankAccountId: string;
  accountId: string;
  name: string;
  bankName: string;
  accountNumberMasked: string;
  type: "operating" | "trust";
  currency: "CAD";
}

export interface ChartAccount {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: AccountType;
  parentAccountId: string | null;
  normalBalance: NormalBalance;
  isPostingAccount: boolean;
  isActive: boolean;
  pnlSection: PnlSection | null;
  bsSection: BsSection | null;
  isOperating: boolean;
  cashFlowClass: CashFlowClass;
}

export interface TaxCode {
  taxCodeId: string;
  code: string;
  name: string;
  rate: number;
  treatment: TaxTreatment;
  jurisdiction: string;
  notes: string;
}

export interface InvoiceLine {
  lineId: string;
  accountId: string;
  description: string;
  amount: number;
  taxCodeId: string;
  taxAmount: number;
}

export interface Invoice {
  invoiceId: string;
  invoiceNumber: string;
  invoiceType: "rent" | "late_fee" | "other_charge" | "credit";
  tenantId: string;
  propertyId: string;
  unitId: string;
  leaseId: string;
  invoiceDate: string;
  dueDate: string;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  status: InvoiceStatus;
  lines: InvoiceLine[];
  isOpening: boolean;
  notes?: string;
}

export interface Payment {
  paymentId: string;
  paymentNumber: string;
  paymentDate: string;
  paymentMethod: "e-transfer" | "cheque" | "pre-authorized" | "wire" | "cash";
  bankAccountId: string;
  tenantId: string;
  totalAmount: number;
  paymentStatus: "posted" | "reversed";
  reference: string;
  isOpening: boolean;
}

export interface PaymentAllocation {
  allocationId: string;
  paymentId: string;
  invoiceId: string;
  allocatedAmount: number;
  allocationDate: string;
}

export interface VendorBillLine {
  lineId: string;
  accountId: string;
  description: string;
  amount: number;
  taxCodeId: string;
  taxAmount: number;
  isCapital: boolean;
  itcEligible: boolean;
}

export interface VendorBill {
  billId: string;
  billNumber: string;
  vendorId: string;
  propertyId: string | null;
  billDate: string;
  dueDate: string;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  status: BillStatus;
  paymentStatus: "unpaid" | "partial" | "paid";
  billReference: string;
  lines: VendorBillLine[];
  isOpening: boolean;
  expenseCategory: string;
}

export interface BillPayment {
  billPaymentId: string;
  paymentDate: string;
  paymentMethod: "cheque" | "e-transfer" | "pre-authorized" | "wire";
  bankAccountId: string;
  vendorId: string;
  totalAmount: number;
  reference: string;
  isOpening: boolean;
}

export interface BillPaymentAllocation {
  allocationId: string;
  billPaymentId: string;
  billId: string;
  allocatedAmount: number;
  allocationDate: string;
}

export interface SecurityDeposit {
  depositId: string;
  tenantId: string;
  propertyId: string;
  unitId: string;
  leaseId: string;
  depositType: "security" | "pet" | "key" | "last_month";
  dateReceived: string;
  amountReceived: number;
  amountRefunded: number;
  amountApplied: number;
  status: DepositStatus;
  bankAccountId: string;
  notes: string;
}

export interface JournalLine {
  journalLineId: string;
  journalEntryId: string;
  accountId: string;
  debitAmount: number;
  creditAmount: number;
  propertyId: string | null;
  description: string;
  tenantId: string | null;
  vendorId: string | null;
  unitId: string | null;
}

export interface JournalEntry {
  journalEntryId: string;
  journalEntryNumber: string;
  transactionDate: string;
  postingDate: string;
  description: string;
  referenceNumber: string;
  sourceType: JournalSourceType;
  sourceId: string;
  propertyId: string | null;
  status: TransactionStatus;
  debitTotal: number;
  creditTotal: number;
  cashFlowClass: CashFlowClass;
  lines: JournalLine[];
}

export interface BudgetLine {
  budgetId: string;
  fiscalYear: number;
  period: "annual" | "monthly";
  month: number | null;
  propertyId: string | "portfolio";
  accountId: string;
  budgetAmount: number;
}

export interface BankStatement {
  statementId: string;
  bankAccountId: string;
  periodStart: string;
  periodEnd: string;
  endingDate: string;
  endingBalance: number;
  isSampleData: boolean;
}

export interface BankTxn {
  bankTxnId: string;
  bankAccountId: string;
  txnDate: string;
  description: string;
  amount: number;
  type: "deposit" | "withdrawal";
  sourcePaymentId: string | null;
  sourceBillPaymentId: string | null;
  sourceJournalId: string | null;
  statementId: string | null;
  defaultMatched: boolean;
}

export interface Mortgage {
  mortgageId: string;
  propertyId: string;
  lender: string;
  accountId: string;
  originalPrincipal: number;
  openingBalance: number;
  interestRate: number;
  monthlyPayment: number;
  startDate: string;
  maturityDate: string;
}

export interface ReportFilters {
  periodPreset: PeriodPreset;
  startDate: string;
  endDate: string;
  asOfDate: string;
  fiscalYear: number;
  propertyId: string | "all";
  portfolioId: string | "all";
  ownerId: string | "all";
  accountId: string | "all";
  tenantId: string | "all";
  unitId: string | "all";
  vendorId: string | "all";
  transactionType: string | "all";
  transactionStatus: "all" | "posted" | "draft";
  paymentMethod: string | "all";
  bankAccountId: string | "all";
  accountingBasis: AccountingBasis;
  comparison: boolean;
}

export interface ReportDefinition {
  reportId: string;
  name: string;
  description: string;
  categoryId: ReportCategoryId;
  availability: ReportAvailability;
  availabilityNote?: string;
  filters: Array<keyof ReportFilters | "period">;
  defaultAsOf?: boolean;
  priority: number;
}

export interface ReportRow {
  id: string;
  label: string;
  indent: number;
  amount: number;
  priorAmount?: number | null;
  isSection?: boolean;
  isTotal?: boolean;
  isGrandTotal?: boolean;
  accountId?: string;
  accountCode?: string;
  propertyId?: string;
  sourceType?: string;
  sourceId?: string;
  expandable?: boolean;
  children?: ReportRow[];
  note?: string;
  meta?: Record<string, string | number | null>;
}

export interface ReportColumn {
  key: string;
  label: string;
  align?: "left" | "right" | "center";
  width?: string;
  format?: "money" | "percent" | "number" | "date" | "text";
}

export interface ReportResult {
  reportId: string;
  title: string;
  subtitle?: string;
  companyName: string;
  propertyLabel: string;
  periodLabel: string;
  asOfLabel?: string;
  basisLabel?: string;
  generatedAt: string;
  filters: ReportFilters;
  columns: ReportColumn[];
  rows: ReportRow[];
  tableRows?: Array<Record<string, string | number | null>>;
  totals?: Record<string, number>;
  notes: string[];
  completeness: ReportAvailability;
  completenessDetail?: string;
  recordCount?: number;
  charts?: ChartSpec[];
}

export interface ChartSpec {
  id: string;
  type: "bar" | "line" | "pie" | "stacked-bar";
  title: string;
  data: Array<{ label: string; value: number; color?: string; secondary?: number }>;
}

export interface AgingBucketRow {
  id: string;
  name: string;
  propertyName: string;
  unitNumber?: string;
  documentNumber: string;
  documentDate: string;
  dueDate: string;
  original: number;
  paid: number;
  credit: number;
  outstanding: number;
  current: number;
  d1_30: number;
  d31_60: number;
  d61_90: number;
  d90plus: number;
  tenantId?: string;
  vendorId?: string;
  invoiceId?: string;
  billId?: string;
}

export interface Dataset {
  companyName: string;
  legalName: string;
  address: string;
  currency: "CAD";
  today: string;
  owners: Owner[];
  portfolios: Portfolio[];
  properties: Property[];
  units: Unit[];
  tenants: Tenant[];
  leases: Lease[];
  vendors: Vendor[];
  bankAccounts: BankAccount[];
  accounts: ChartAccount[];
  taxCodes: TaxCode[];
  invoices: Invoice[];
  payments: Payment[];
  allocations: PaymentAllocation[];
  bills: VendorBill[];
  billPayments: BillPayment[];
  billAllocations: BillPaymentAllocation[];
  deposits: SecurityDeposit[];
  journalEntries: JournalEntry[];
  budgets: BudgetLine[];
  bankStatements: BankStatement[];
  bankTxns: BankTxn[];
  mortgages: Mortgage[];
}
