export type PageId =
  | "dashboard"
  | "properties"
  | "tenants"
  | "leases"
  | "bills"
  | "providers"
  | "reports"
  | "settings";

export type BillCategory =
  | "hydro"
  | "gas"
  | "water"
  | "internet"
  | "insurance"
  | "property_tax"
  | "maintenance"
  | "other";

export type Frequency =
  | "weekly"
  | "monthly"
  | "quarterly"
  | "semi-annually"
  | "annually"
  | "custom";

export type AllocationMethod =
  | "none"
  | "percentage"
  | "fixed"
  | "manual"
  | "equal_split";

export type PaymentMethod =
  | "bank_transfer"
  | "credit_card"
  | "debit_card"
  | "cheque"
  | "cash"
  | "other";

export type ScheduleStatus = "active" | "paused" | "inactive";
export type ProviderPaymentStatus = "unpaid" | "partially_paid" | "paid";
export type DueStatus = "upcoming" | "due_soon" | "overdue" | "settled";
export type RecoveryStatus =
  | "not_recoverable"
  | "recovery_pending"
  | "partially_recovered"
  | "fully_recovered";
export type DocumentType = "invoice" | "receipt" | "proof_of_payment" | "other";
export type ResponsibleParty = "landlord" | "tenant" | "shared";
export type CalculationBasis = "actual" | "expected";

export interface Property {
  id: string;
  name: string;
  address: string;
  city: string;
  type: string;
  units: number;
}

export interface Unit {
  id: string;
  propertyId: string;
  name: string;
  beds: number;
  status: "occupied" | "vacant";
}

export interface Tenant {
  id: string;
  name: string;
  email: string;
  phone: string;
  unitId: string;
  leaseId: string;
}

export interface Lease {
  id: string;
  tenantId: string;
  unitId: string;
  startDate: string;
  endDate: string;
  rent: number;
  utilityClause: string;
}

export interface ServiceProvider {
  id: string;
  name: string;
  category: BillCategory;
  email: string;
  phone: string;
  website?: string;
}

export interface TenantAllocation {
  id: string;
  tenantId: string;
  unitId: string;
  method: AllocationMethod;
  percentage?: number;
  fixedAmount?: number;
  manualAmount?: number;
  calculationBasis: CalculationBasis;
  notes?: string;
}

export interface RecurringSchedule {
  id: string;
  name: string;
  category: BillCategory;
  providerId: string;
  propertyId: string;
  unitId?: string;
  accountNumber?: string;
  frequency: Frequency;
  customFrequencyNote?: string;
  expectedAmount?: number;
  nextExpectedDate: string;
  dueDateRule: string;
  responsibleParty: ResponsibleParty;
  allocationMethod: AllocationMethod;
  allocationPercentage?: number;
  allocationFixedAmount?: number;
  allocationTenantIds: string[];
  notes?: string;
  status: ScheduleStatus;
  reminderDays: number[];
}

export interface ProviderPayment {
  id: string;
  billId: string;
  amount: number;
  date: string;
  method: PaymentMethod;
  referenceNumber?: string;
  account?: string;
  notes?: string;
}

export interface TenantRecovery {
  id: string;
  billId: string;
  tenantId: string;
  amount: number;
  date: string;
  method: PaymentMethod;
  referenceNumber?: string;
  notes?: string;
}

export interface SupportingDocument {
  id: string;
  billId: string;
  name: string;
  type: DocumentType;
  mockFileName: string;
  addedAt: string;
  /** where the file is stored (Supabase Storage); opened through a short-lived link */
  bucket?: string;
  path?: string;
}

export interface Bill {
  id: string;
  name: string;
  category: BillCategory;
  providerId: string;
  propertyId: string;
  unitIds: string[];
  invoiceNumber?: string;
  accountNumber?: string;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  invoiceDate: string;
  dueDate: string;
  amount: number;
  notes?: string;
  scheduleId?: string;
  allocations: TenantAllocation[];
  documents: SupportingDocument[];
  reminderDays: number[];
}

export interface ReminderSettings {
  daysBefore: number[];
  notifyOnDueDate: boolean;
  notifyAfterIfUnpaid: boolean;
  dueSoonDays: number;
}

export interface AppState {
  bills: Bill[];
  schedules: RecurringSchedule[];
  payments: ProviderPayment[];
  recoveries: TenantRecovery[];
}

export type SortKey = "dueDate" | "amount" | "property" | "status";
export type SortDir = "asc" | "desc";

export interface BillFilters {
  query: string;
  propertyId: string;
  unitId: string;
  category: string;
  providerId: string;
  paymentStatus: string;
  recoveryStatus: string;
  dueFrom: string;
  dueTo: string;
}
