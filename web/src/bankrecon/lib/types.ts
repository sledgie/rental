// Core domain types for the Bank Reconciliation Module (Rental Management System)

export type AccountType = "Operating" | "Trust" | "Reserve" | "Restricted" | "Other";

export const ACCOUNT_TYPES: AccountType[] = ["Operating", "Trust", "Reserve", "Restricted", "Other"];

export type ReconStatus =
  | "Not Started"
  | "In Progress"
  | "Needs Review"
  | "Ready to Finalize"
  | "Reconciled"
  | "Reopened"
  | "Cancelled";

export const RECON_STATUSES: ReconStatus[] = [
  "Not Started",
  "In Progress",
  "Needs Review",
  "Ready to Finalize",
  "Reconciled",
  "Reopened",
  "Cancelled",
];

// Transaction types recorded in the property-management accounting ledger
export type BookTxType =
  | "rent_payment"
  | "tenant_deposit"
  | "deposit_refund"
  | "maintenance_expense"
  | "vendor_payment"
  | "management_fee"
  | "bank_fee"
  | "interest_income"
  | "transfer_out"
  | "transfer_in"
  | "returned_payment"
  | "other";

export const TX_TYPE_META: Record<BookTxType, { label: string; direction: "in" | "out" }> = {
  rent_payment: { label: "Rent Payment", direction: "in" },
  tenant_deposit: { label: "Tenant Deposit Collection", direction: "in" },
  deposit_refund: { label: "Deposit Refund", direction: "out" },
  maintenance_expense: { label: "Maintenance Expense", direction: "out" },
  vendor_payment: { label: "Vendor Payment", direction: "out" },
  management_fee: { label: "Management Fee", direction: "out" },
  bank_fee: { label: "Bank Charge", direction: "out" },
  interest_income: { label: "Interest Income", direction: "in" },
  transfer_out: { label: "Transfer Out", direction: "out" },
  transfer_in: { label: "Transfer In", direction: "in" },
  returned_payment: { label: "Returned / Reversed Payment", direction: "out" },
  other: { label: "Other", direction: "in" },
};

export type PostingStatus = "Posted" | "Pending";
export type MatchType = "one_to_one" | "one_to_many" | "many_to_one";
export type ConfidenceLevel = "High" | "Medium" | "Low" | "None";

export interface BankAccount {
  id: string; // unique internal identifier (e.g. BA-OP-01)
  name: string;
  institution: string;
  maskedAccount: string; // masked account number, e.g. ****4521
  accountType: AccountType;
  currency: string;
  glAccount: string; // Chart of Accounts code
  glAccountName: string;
  openingBalance: number;
  openingBalanceDate: string; // ISO date
  active: boolean;
  purpose: string;
  propertyId: string | null;
  classification: string; // Trust / Operating / Restricted classification
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceRef {
  id: string;
  number: string;
  amount: number;
}

export interface BookTransaction {
  id: string;
  accountId: string;
  date: string; // ISO date
  type: BookTxType;
  description: string;
  counterparty: string; // tenant / vendor / payee
  propertyId: string | null;
  unit: string | null;
  reference: string; // payment or journal reference
  invoices: InvoiceRef[]; // invoices settled by this payment (Scenario E)
  moneyIn: number;
  moneyOut: number;
  signedAmount: number; // moneyIn - moneyOut
  coa: string;
  postingStatus: PostingStatus;
  source: string; // e.g. "Rent Roll", "Journal Entry JE-...", "Payment PAY-..."
  notes: string;
  assignee: string;
  createdAt: string;
}

export interface BankTransaction {
  id: string;
  batchId: string;
  accountId: string;
  date: string; // transaction date
  postedDate: string | null;
  description: string;
  reference: string;
  debit: number; // money out (bank perspective)
  credit: number; // money in (bank perspective)
  signedAmount: number; // credit - debit
  runningBalance: number | null;
  fingerprint: string;
  duplicateOf: string | null;
  manualEntry: boolean;
  importedAt: string;
  notes: string;
}

export interface Adjustment {
  id: string;
  reconciliationId: string;
  side: "bank" | "book";
  kind: string;
  amount: number; // signed, applied to adjusted balance per side convention
  description: string;
  coa: string | null;
  approved: boolean;
  createdBy: string;
  createdAt: string;
  notes: string;
}

export interface Match {
  id: string;
  reconciliationId: string;
  bankTxIds: string[];
  bookTxIds: string[];
  confidence: number; // 0-100
  confidenceLevel: ConfidenceLevel;
  explanation: string;
  type: MatchType;
  automatic: boolean;
  confirmedBy: string;
  confirmedAt: string;
  active: boolean; // false after manual unmatch (history preserved)
  history: { action: string; by: string; at: string; note: string }[];
}

export interface Reconciliation {
  id: string;
  reference: string; // REC-2025-10-OP-01
  accountId: string;
  periodStart: string;
  periodEnd: string;
  statementOpeningBalance: number;
  statementEndingBalance: number;
  statementRef: string;
  fileName: string | null;
  notes: string;
  status: ReconStatus;
  createdBy: string;
  createdAt: string;
  finalizedBy: string | null;
  finalizedAt: string | null;
  reopenReason: string | null;
  finalSummary: {
    statementEndingBalance: number;
    adjustedBank: number;
    adjustedBook: number;
    remainingDifference: number;
    matchedCount: number;
    outstandingCount: number;
    unresolvedCount: number;
  } | null;
  detailSeeded: boolean; // false for archived summary-only reconciliations
}

export interface ImportBatch {
  id: string;
  accountId: string;
  periodStart: string;
  periodEnd: string;
  fileName: string;
  importedAt: string;
  importedBy: string;
  totalRows: number;
  acceptedRows: number;
  rejectedRows: number;
  duplicateRows: number;
  warnings: string[];
  mappingName: string;
  reconciliationId: string | null;
}

export interface ColumnMapping {
  transactionDate: number | null;
  postedDate: number | null;
  description: number | null;
  reference: number | null;
  debit: number | null;
  credit: number | null;
  signedAmount: number | null;
  runningBalance: number | null;
}

export interface ImportMapping {
  id: string;
  name: string;
  format: string;
  columns: ColumnMapping;
  signedAmountMeaning: "positive_is_deposit" | "positive_is_withdrawal";
  createdAt: string;
  system?: boolean;
}

export interface AuditEntry {
  id: string;
  eventId: string;
  at: string;
  user: string;
  action: string;
  record: string;
  before: string | null;
  after: string | null;
  notes: string;
}

export interface Settings {
  frequency: "Monthly" | "Weekly" | "Quarterly";
  dateToleranceDays: number;
  autoMatching: boolean;
  confidenceHigh: number;
  confidenceMedium: number;
  confidenceLow: number;
  duplicateSensitivity: "strict" | "normal" | "loose";
  currencyPrecision: number;
  approvalRequired: boolean;
  reopenPermission: "admin" | "manager";
  staleWarningDays: number;
  csvHasHeader: boolean;
  csvPositiveIsDeposit: boolean;
  csvDelimiter: string;
  notificationEmail: string;
}

export interface MockUser {
  id: string;
  name: string;
  role: string;
  permissions: string[];
}

export const PERMISSIONS: { key: string; label: string; description: string }[] = [
  { key: "view_bank_accounts", label: "View Bank Accounts", description: "Read bank account configuration." },
  { key: "create_edit_bank_accounts", label: "Create / Edit Bank Accounts", description: "Create and modify bank account records." },
  { key: "start_reconciliation", label: "Start Reconciliation", description: "Create new reconciliation records." },
  { key: "import_statements", label: "Import Bank Statements", description: "Upload and import bank statement files." },
  { key: "match_transactions", label: "Match Transactions", description: "Confirm and override transaction matches." },
  { key: "unmatch_transactions", label: "Unmatch Transactions", description: "Undo confirmed matches (audited)." },
  { key: "record_missing", label: "Record Missing Transactions", description: "Create book entries for bank activity missing from the ledger." },
  { key: "approve_adjustments", label: "Approve Adjustments", description: "Approve reconciliation adjustments and finalizations." },
  { key: "finalize_reconciliation", label: "Finalize Reconciliation", description: "Lock and finalize a completed reconciliation." },
  { key: "reopen_reconciliation", label: "Reopen Reconciliation", description: "Reopen a finalized reconciliation with a documented reason." },
  { key: "cancel_reconciliation", label: "Cancel Reconciliation", description: "Cancel a reconciliation with a recorded reason." },
  { key: "view_reports", label: "View Reconciliation Reports", description: "Access reconciliation reports and exports." },
  { key: "manage_settings", label: "Manage Reconciliation Settings", description: "Configure module settings and import mappings." },
];

export interface Property {
  id: string;
  name: string;
  address: string;
  unitCount: number;
}

export interface Unit {
  id: string;
  propertyId: string;
  label: string;
  rent: number;
}

export interface Tenant {
  id: string;
  name: string;
  propertyId: string;
  unit: string;
  email: string;
}

export interface Vendor {
  id: string;
  name: string;
  category: string;
}

export interface CoaAccount {
  code: string;
  name: string;
  kind: "asset" | "liability" | "income" | "expense" | "equity";
}

export interface DepositLedgerEntry {
  tenant: string;
  property: string;
  unit: string;
  periodStart: string;
  deposits: number;
  refunds: number;
  balance: number;
}

export interface StoreState {
  version: number;
  users: MockUser[];
  currentUserId: string;
  accounts: BankAccount[];
  bookTxs: BookTransaction[];
  bankTxs: BankTransaction[];
  reconciliations: Reconciliation[];
  matches: Match[];
  adjustments: Adjustment[];
  importBatches: ImportBatch[];
  importMappings: ImportMapping[];
  audit: AuditEntry[];
  settings: Settings;
  properties: Property[];
  units: Unit[];
  tenants: Tenant[];
  vendors: Vendor[];
  coa: CoaAccount[];
  depositLedger: DepositLedgerEntry[];
}
