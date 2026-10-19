/**
 * Domain types for the invoice module.
 * Kept separate from all presentation components.
 */

export type InvoiceStatus =
  | "draft"
  | "pending_approval"
  | "unpaid"
  | "partially_paid"
  | "paid"
  | "overdue"
  | "void";

export type InvoiceType = "rent" | "utilities" | "maintenance" | "other";

export type LineItemCategory =
  | "Rent"
  | "Utilities"
  | "Maintenance"
  | "Parking"
  | "Storage"
  | "Fees"
  | "Other";

export interface InvoiceLineItem {
  id: string;
  description: string;
  category: LineItemCategory;
  quantity: number;
  unitPrice: number;
  taxRate: number; // percentage, e.g. 13 for HST
  /** Optional: line total override not used — always derived. */
}

export interface InvoiceAttachment {
  id: string;
  name: string;
  kind: "pdf" | "image" | "sheet" | "doc";
  size: string;
  uploadedBy: string;
  uploadedAt: string; // ISO date
}

export interface InvoiceNote {
  id: string;
  author: string;
  createdAt: string; // ISO date
  body: string;
  pinned?: boolean;
}

export interface Payment {
  id: string;
  invoiceId: string;
  date: string; // ISO date
  method: "Bank Transfer" | "Credit Card" | "E-Transfer" | "Cheque" | "Cash" | "Pre-Authorized Debit";
  reference: string;
  amount: number;
  notes?: string;
}

export type ActivityKind =
  | "created"
  | "edited"
  | "approved"
  | "payment"
  | "paid"
  | "voided"
  | "reminder"
  | "sent"
  | "note";

export interface ActivityEntry {
  id: string;
  kind: ActivityKind;
  label: string;
  detail?: string;
  actor: string;
  at: string; // ISO datetime
}

export interface Invoice {
  id: string;
  tenant: {
    name: string;
    email: string;
    phone: string;
    avatarInitials: string;
  };
  propertyId: string;
  propertyName: string;
  unit: string;
  leaseRef: string;
  type: InvoiceType;
  status: InvoiceStatus;
  issueDate: string; // ISO date
  dueDate: string; // ISO date
  billingPeriodStart: string;
  billingPeriodEnd: string;
  currency: "CAD";
  lineItems: InvoiceLineItem[];
  discount: number; // absolute CAD amount
  payments: Payment[];
  attachments: InvoiceAttachment[];
  notes: InvoiceNote[];
  activity: ActivityEntry[];
  memo?: string;
}

/* ---------- Derived helpers ---------- */

export const lineItemTotal = (item: InvoiceLineItem): number =>
  item.quantity * item.unitPrice * (1 + item.taxRate / 100);

export const lineItemSubtotal = (item: InvoiceLineItem): number =>
  item.quantity * item.unitPrice;

export const lineItemTax = (item: InvoiceLineItem): number =>
  item.quantity * item.unitPrice * (item.taxRate / 100);

export const invoiceSubtotal = (invoice: Invoice): number =>
  invoice.lineItems.reduce((sum, i) => sum + lineItemSubtotal(i), 0);

export const invoiceTaxTotal = (invoice: Invoice): number =>
  invoice.lineItems.reduce((sum, i) => sum + lineItemTax(i), 0);

export const invoiceTotal = (invoice: Invoice): number =>
  invoiceSubtotal(invoice) + invoiceTaxTotal(invoice) - invoice.discount;

export const invoicePaid = (invoice: Invoice): number =>
  invoice.payments.reduce((sum, p) => sum + p.amount, 0);

export const invoiceBalance = (invoice: Invoice): number => {
  if (invoice.status === "void") return 0;
  return Math.max(0, round2(invoiceTotal(invoice) - invoicePaid(invoice)));
};

export const round2 = (n: number): number => Math.round(n * 100) / 100;

/* ---------- Filter model ---------- */

export type DueDateFilter =
  | "all"
  | "overdue"
  | "this_week"
  | "this_month"
  | "custom";

export interface InvoiceFilters {
  query: string;
  status: InvoiceStatus | "all";
  propertyId: string | "all";
  type: InvoiceType | "all";
  due: DueDateFilter;
  customFrom: string;
  customTo: string;
  tenant: string | "all";
  minAmount: string;
  maxAmount: string;
}

export const defaultFilters: InvoiceFilters = {
  query: "",
  status: "all",
  propertyId: "all",
  type: "all",
  due: "all",
  customFrom: "",
  customTo: "",
  tenant: "all",
  minAmount: "",
  maxAmount: "",
};

export const statusLabels: Record<InvoiceStatus, string> = {
  draft: "Draft",
  pending_approval: "Pending Approval",
  unpaid: "Unpaid",
  partially_paid: "Partially Paid",
  paid: "Paid",
  overdue: "Overdue",
  void: "Void",
};

export const typeLabels: Record<InvoiceType, string> = {
  rent: "Rent",
  utilities: "Utilities",
  maintenance: "Maintenance",
  other: "Other",
};

export interface Property {
  id: string;
  name: string;
  city: string;
  units: number;
}
