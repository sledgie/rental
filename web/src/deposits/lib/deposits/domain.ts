export const DEPOSIT_TYPES = [
  "last_month_rent",
  "key_fob",
  "security_deposit",
  "pet_deposit",
  "utility_deposit",
  "other_permitted",
] as const;
export type DepositType = (typeof DEPOSIT_TYPES)[number];

export const DEPOSIT_TYPE_LABELS: Record<DepositType, string> = {
  last_month_rent: "Last Month's Rent Deposit",
  key_fob: "Key / Fob / Access Card Deposit",
  security_deposit: "Security Deposit",
  pet_deposit: "Pet / Damage Deposit",
  utility_deposit: "Utility Deposit",
  other_permitted: "Other Permitted Deposit",
};

export const DEPOSIT_TYPE_SHORT: Record<DepositType, string> = {
  last_month_rent: "LMR",
  key_fob: "Key",
  security_deposit: "Security",
  pet_deposit: "Pet/Damage",
  utility_deposit: "Utility",
  other_permitted: "Other",
};

export const DEPOSIT_STATUSES = [
  "draft",
  "expected",
  "partially_received",
  "held",
  "partially_applied",
  "applied",
  "refund_requested",
  "refund_pending",
  "partially_refunded",
  "refunded",
  "transferred",
  "closed",
  "cancelled",
] as const;
export type DepositStatus = (typeof DEPOSIT_STATUSES)[number];

export const STATUS_LABELS: Record<DepositStatus, string> = {
  draft: "Draft",
  expected: "Expected",
  partially_received: "Partially received",
  held: "Held",
  partially_applied: "Partially applied",
  applied: "Applied",
  refund_requested: "Refund requested",
  refund_pending: "Refund pending",
  partially_refunded: "Partially refunded",
  refunded: "Refunded",
  transferred: "Transferred",
  closed: "Closed",
  cancelled: "Cancelled",
};

export type Tone = "neutral" | "info" | "success" | "warning" | "danger" | "accent";

export const STATUS_TONE: Record<DepositStatus, Tone> = {
  draft: "neutral",
  expected: "warning",
  partially_received: "warning",
  held: "info",
  partially_applied: "accent",
  applied: "success",
  refund_requested: "warning",
  refund_pending: "warning",
  partially_refunded: "accent",
  refunded: "success",
  transferred: "info",
  closed: "neutral",
  cancelled: "neutral",
};

/** Valid lifecycle transitions per deposit family. */
export const TRANSITIONS: Record<DepositType, Record<string, DepositStatus[]>> = {
  last_month_rent: {
    draft: ["expected", "cancelled"],
    expected: ["partially_received", "held", "cancelled"],
    partially_received: ["held", "partially_received"],
    held: ["partially_applied", "applied", "refund_requested"],
    partially_applied: ["applied", "partially_applied", "refund_requested"],
    applied: ["closed"],
    refund_requested: ["refund_pending", "held", "closed"],
    refund_pending: ["partially_refunded", "refunded"],
    partially_refunded: ["partially_refunded", "refunded"],
    refunded: ["closed"],
  },
  key_fob: {
    draft: ["expected", "cancelled"],
    expected: ["held", "partially_received", "cancelled"],
    partially_received: ["held"],
    held: ["refund_requested", "transferred"],
    refund_requested: ["refund_pending", "held"],
    refund_pending: ["partially_refunded", "refunded"],
    partially_refunded: ["refunded"],
    refunded: ["closed"],
    transferred: ["closed"],
  },
  security_deposit: {
    draft: ["expected", "cancelled"],
    expected: ["partially_received", "held", "cancelled"],
    partially_received: ["held"],
    held: ["partially_applied", "applied", "refund_requested"],
    partially_applied: ["applied", "partially_applied", "refund_requested"],
    applied: ["closed"],
    refund_requested: ["refund_pending", "held"],
    refund_pending: ["partially_refunded", "refunded"],
    partially_refunded: ["refunded"],
    refunded: ["closed"],
  },
  pet_deposit: {
    draft: ["cancelled"],
    expected: ["cancelled"],
  },
  utility_deposit: {
    draft: ["expected", "cancelled"],
    expected: ["held", "partially_received", "cancelled"],
    partially_received: ["held"],
    held: ["partially_applied", "refund_requested"],
    partially_applied: ["refund_requested", "applied"],
    refund_requested: ["refund_pending", "held"],
    refund_pending: ["partially_refunded", "refunded"],
    partially_refunded: ["refunded"],
    refunded: ["closed"],
  },
  other_permitted: {
    draft: ["expected", "cancelled"],
    expected: ["held", "cancelled"],
    partially_received: ["held"],
    held: ["partially_applied", "applied", "refund_requested", "transferred"],
    partially_applied: ["applied", "refund_requested"],
    applied: ["closed"],
    refund_requested: ["refund_pending", "held"],
    refund_pending: ["partially_refunded", "refunded"],
    partially_refunded: ["refunded"],
    refunded: ["closed"],
  },
};

export const JURISDICTIONS = [
  { code: "ON", label: "Ontario" },
  { code: "BC", label: "British Columbia" },
  { code: "AB", label: "Alberta" },
  { code: "QC", label: "Quebec" },
  { code: "NS", label: "Nova Scotia" },
] as const;

export const LEASE_TYPES = [
  { code: "residential", label: "Residential" },
  { code: "commercial", label: "Commercial" },
] as const;

export const PURPOSE_LABELS: Record<string, string> = {
  final_rental_period: "Apply to final rental period",
  rent_increase_credit: "Credit interest against lawful rent increase",
  lawful_arrears: "Apply to lawful rent arrears (after termination)",
  damage_beyond_normal_wear: "Apply to damage beyond normal wear (commercial)",
  outstanding_utilities: "Apply to outstanding utilities (commercial)",
  other_authorized_charge: "Apply to other authorized charge",
};

export const APPLICATION_PURPOSES = [
  "final_rental_period",
  "rent_increase_credit",
  "lawful_arrears",
  "damage_beyond_normal_wear",
  "outstanding_utilities",
  "other_authorized_charge",
] as const;

export const TXN_TYPE_LABELS: Record<string, string> = {
  deposit_created: "Deposit created",
  collection: "Collection",
  partial_collection: "Partial collection",
  interest_accrual: "Interest accrual",
  interest_payment: "Interest paid",
  interest_credit: "Interest credited",
  application: "Permitted application",
  refund_request: "Refund requested",
  refund_payment: "Refund processed",
  adjustment: "Adjustment",
  reversal: "Reversal",
  transfer: "Transfer",
  reconciliation: "Reconciliation",
  closure: "Closure",
  cancellation: "Cancellation",
};

export const REFUND_STATUS_LABELS: Record<string, string> = {
  requested: "Awaiting approval",
  approved: "Approved — pending payment",
  completed: "Completed",
  rejected: "Rejected",
  failed: "Payment failed",
  reversed: "Reversed",
};

export const RECONCILIATION_STATUS_LABELS: Record<string, string> = {
  open: "Open",
  under_review: "Under review",
  resolved: "Resolved",
  correction_required: "Correction required",
};

/* -------------------------------- Permissions -------------------------------- */

export const ROLES = [
  { code: "admin", label: "Administrator" },
  { code: "controller", label: "Financial Controller" },
  { code: "property_manager", label: "Property Manager" },
  { code: "auditor", label: "Auditor (read only)" },
] as const;
export type Role = (typeof ROLES)[number]["code"];

export const PERMISSIONS = [
  "view_deposits",
  "create_deposit",
  "edit_draft",
  "record_collection",
  "apply_deposit",
  "request_refund",
  "approve_refund",
  "process_refund",
  "process_interest",
  "configure_rules",
  "configure_accounts",
  "reconcile_deposits",
  "view_audit",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  admin: [...PERMISSIONS],
  controller: [
    "view_deposits",
    "create_deposit",
    "edit_draft",
    "record_collection",
    "apply_deposit",
    "request_refund",
    "approve_refund",
    "process_refund",
    "process_interest",
    "configure_accounts",
    "reconcile_deposits",
    "view_audit",
  ],
  property_manager: [
    "view_deposits",
    "create_deposit",
    "edit_draft",
    "record_collection",
    "apply_deposit",
    "request_refund",
    "view_audit",
  ],
  auditor: ["view_deposits", "view_audit"],
};

export function can(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export const LIABILITY_ACCOUNT_BY_TYPE: Record<DepositType, string> = {
  last_month_rent: "2200",
  key_fob: "2210",
  security_deposit: "2220",
  pet_deposit: "2220",
  utility_deposit: "2230",
  other_permitted: "2240",
};

export const ACCOUNT_NAMES: Record<string, string> = {
  "1010": "Operating Bank — Deposits",
  "1020": "Trust Account — Tenant Deposits",
  "1200": "Rent Receivable",
  "2200": "Last Month's Rent Deposits Payable",
  "2210": "Refundable Key Deposits Payable",
  "2220": "Security Deposits Payable",
  "2230": "Utility Deposits Payable",
  "2240": "Other Tenant Deposits Payable",
  "2310": "Tenant Deposit Interest Payable",
  "4000": "Rental Income",
  "6100": "Tenant Deposit Interest Expense",
};

export function isTerminalStatus(status: string): boolean {
  return ["closed", "cancelled", "transferred"].includes(status);
}

export function statusLabel(status: string): string {
  return STATUS_LABELS[status as DepositStatus] ?? status;
}

export function depositTypeLabel(type: string): string {
  return DEPOSIT_TYPE_LABELS[type as DepositType] ?? type;
}

export const METHOD_LABELS: Record<string, string> = {
  eft: "EFT / bank transfer",
  cheque: "Cheque",
  cash: "Cash",
  card: "Credit card",
  etransfer: "Interac e-Transfer",
};
