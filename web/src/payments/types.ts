/** All monetary values are integer cents to avoid floating-point rounding. */
export type Cents = number;

export type PaymentMethod = "etransfer" | "cash" | "card";
export type PaymentStatus = "posted" | "reversed";
export type InvoiceStatus = "paid" | "partial" | "overdue" | "open" | "cancelled";
export type AllocationStrategy = "oldest" | "newest";

export interface StaffUser {
  id: string;
  name: string;
  role: "Administrator" | "Payment Clerk" | "Supervisor";
}

export interface Tenant {
  id: string;
  number: string;
  name: string;
  email: string;
  phone: string;
  active: boolean;
}

export interface Property {
  id: string;
  name: string;
  address: string;
}

export interface Unit {
  id: string;
  propertyId: string;
  number: string;
}

export interface Lease {
  id: string;
  tenantId: string;
  unitId: string;
  startDate: string;
  endDate: string;
  monthlyRent: Cents;
  status: "active" | "ended";
}

export interface InvoiceAdjustment {
  label: string;
  /** Positive = extra charge, negative = credit / reduction. */
  amount: Cents;
}

export interface Invoice {
  id: string; // e.g. INV-2026-009
  number: string;
  tenantId: string;
  leaseId: string;
  periodStart: string; // YYYY-MM-DD
  periodEnd: string;
  dueDate: string;
  originalAmount: Cents;
  adjustments: InvoiceAdjustment[];
  /** Stored status — only the non-derivable part. Paid/partial/overdue are computed. */
  status: "open" | "cancelled";
  description: string;
}

export interface PaymentRefund {
  at: string;
  byId: string;
  amount: Cents;
  reason: string;
}

export interface Payment {
  id: string; // e.g. PAY-2026-0157
  receiptId: string | null;
  tenantId: string;
  leaseId: string;
  date: string; // YYYY-MM-DD
  method: PaymentMethod;
  /** Actual money received. */
  amount: Cents;
  reference?: string;
  notes?: string;
  status: PaymentStatus;
  recordedById: string;
  createdAt: string; // full ISO timestamp
  reversedAt?: string;
  reversedById?: string;
  reversalReason?: string;
  refund?: PaymentRefund;
}

export interface Allocation {
  id: string;
  paymentId: string;
  invoiceId: string;
  amount: Cents;
}

export interface TenantCredit {
  id: string; // e.g. CR-2026-0001
  tenantId: string;
  /** Payment that created this credit (overpayment). Null = manually created opening credit. */
  sourcePaymentId: string | null;
  originalAmount: Cents;
  createdAt: string;
  note?: string;
}

export interface CreditApplication {
  id: string;
  creditId: string;
  invoiceId: string;
  amount: Cents;
  at: string;
}

export type AuditAction =
  | "payment.created"
  | "payment.posted"
  | "payment.reversed"
  | "receipt.issued"
  | "receipt.reprinted"
  | "receipt.downloaded"
  | "refund.recorded"
  | "credit.created"
  | "credit.applied"
  | "credit.invalidated"
  | "invoice.cancelled";

export interface AuditEvent {
  id: string;
  userId: string;
  action: AuditAction;
  entityType: "payment" | "receipt" | "invoice" | "credit" | "refund";
  entityId: string;
  at: string;
  summary: string;
  reason?: string;
  prev?: Record<string, string>;
  next?: Record<string, string>;
}

export interface InvoiceBalance {
  invoiceId: string;
  netCharge: Cents;
  paidByPayments: Cents;
  paidByCredits: Cents;
  paid: Cents;
  outstanding: Cents;
  status: InvoiceStatus;
  overdue: boolean;
}

export interface CreditBalance {
  creditId: string;
  remaining: Cents;
  /** False when the credit's source payment was reversed. */
  valid: boolean;
  exhausted: boolean;
}

export interface PaymentRowInput {
  invoiceId: string;
  amountCents: Cents;
}

export interface NewPaymentInput {
  tenantId: string;
  leaseId: string;
  date: string;
  amountCents: Cents;
  method: PaymentMethod;
  reference?: string;
  notes?: string;
  rows: PaymentRowInput[];
  applyCredit: boolean;
  keepCredit: boolean;
}
