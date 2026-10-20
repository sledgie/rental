/**
 * Domain model. Entities are related by ID only — no embedded copies of
 * related records. The shape mirrors the intended REST resources so the
 * mock store can later be swapped for API endpoints.
 */

export type ID = string;

export interface Property {
  id: ID;
  propertyName: string;
  address: string;
  city: string;
  province: string;
  postalCode: string;
  propertyType: "Apartment Building" | "Loft Conversion" | "Townhome Row" | "Duplex";
  yearBuilt: number;
  manager: string;
  imageUrl?: string;
}

export type UnitStatus =
  | "Occupied"
  | "Vacant"
  | "Reserved"
  | "Under Maintenance"
  | "Inactive";

export type UnitCondition = "Excellent" | "Good" | "Fair" | "Needs Work";

export type Furnished = "Furnished" | "Partially Furnished" | "Unfurnished";

export interface Inspection {
  status: "Passed" | "Scheduled" | "Overdue";
  lastInspectionDate?: string;
  nextInspectionDate?: string;
  inspector?: string;
}

export interface Unit {
  id: ID;
  propertyId: ID;
  unitNumber: string;
  unitType: "Apartment" | "Studio" | "Loft" | "Townhouse" | "Duplex Unit" | "Commercial";
  /** 0 = studio; null = not recorded */
  bedrooms: number | null;
  bathrooms: number | null;
  /** null = not measured */
  squareFootage: number | null;
  floor: string | null;
  furnished: Furnished;
  parkingDetails: string | null;
  storageDetails: string | null;
  appliances?: string[];
  utilitiesIncluded?: string[];
  accessibilityFeatures?: string[];
  yearRenovated?: number;
  unitCondition: UnitCondition;
  unitStatus: UnitStatus;
  /** Rent the unit is marketed at. Never used as contractual rent. */
  advertisedRent?: number | null;
  availabilityDate?: string | null;
  inspection?: Inspection;
  notes?: string;
  imageUrl?: string;
  /** Archived units keep every historical record but leave active reporting. */
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Tenant {
  id: ID;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  occupation?: string;
  tenantSince: string;
  avatarHue: number;
  notes?: string;
}

export type LeaseStatus = "Draft" | "Pending" | "Active" | "Expired" | "Terminated";

export interface Lease {
  id: ID;
  leaseNumber: string;
  startDate: string;
  endDate: string;
  leaseStatus: LeaseStatus;
  /** Contractual monthly rent for the WHOLE lease (may cover several units). */
  totalContractRent: number;
  rentDueDay: number;
  securityDeposit: number;
  renewalTerms: string;
  terms?: string;
  documentReferences: string[];
  terminatedOn?: string;
  terminationReason?: string;
}

/** Lease ⇄ Unit relationship, carrying the explicit rent allocation. */
export interface LeaseUnit {
  id: ID;
  leaseId: ID;
  unitId: ID;
  /**
   * Unit's share of the lease rent. When a lease covers a single unit this
   * equals the lease total. `null` means the allocation has not been recorded.
   */
  rentAllocation: number | null;
  occupancyStartDate: string;
  occupancyEndDate?: string | null;
}

export type PartyRole = "Main Tenant" | "Co-Tenant" | "Occupant" | "Guarantor";

/** Lease ⇄ Tenant relationship. Occupants are not necessarily signatories. */
export interface LeaseParty {
  id: ID;
  leaseId: ID;
  tenantId: ID;
  role: PartyRole;
  isSignatory: boolean;
  effectiveStartDate: string;
  effectiveEndDate?: string | null;
}

export type TxType =
  | "Rent Charge"
  | "Rent Payment"
  | "Late Fee"
  | "Utility Charge"
  | "Parking Fee"
  | "Maintenance Charge"
  | "Maintenance Expense"
  | "Credit"
  | "Adjustment";

export type TxStatus = "Posted" | "Draft" | "Void" | "Scheduled";

export type PaymentStatus = "Paid" | "Partial" | "Unpaid" | "Not Due";

export interface Transaction {
  id: ID;
  accountId: ID;
  accountType: "Unit" | "Lease" | "Tenant";
  leaseId?: ID | null;
  unitId?: ID | null;
  tenantId?: ID | null;
  transactionType: TxType;
  description: string;
  amount: number;
  transactionDate: string;
  dueDate?: string | null;
  transactionStatus: TxStatus;
  paymentStatus?: PaymentStatus;
  /** Amount applied against this charge so far. */
  amountPaid?: number;
  method?: "Pre-authorized Debit" | "E-Transfer" | "Cheque" | "Credit Card" | "Journal";
  reference?: string;
}

export type MaintenanceStatus = "Open" | "In Progress" | "Completed" | "Overdue";

export interface MaintenanceRequest {
  id: ID;
  refNumber: string;
  unitId: ID;
  title: string;
  description: string;
  category: string;
  priority: "Low" | "Medium" | "High" | "Urgent";
  status: MaintenanceStatus;
  createdAt: string;
  dueDate?: string | null;
  completedDate?: string | null;
  assignedTo?: string | null;
  costToDate: number;
  reportedBy?: string;
}

export type ProjectStatus = "Planning" | "Active" | "On Hold" | "Completed";

export interface Project {
  id: ID;
  refNumber: string;
  name: string;
  propertyId: ID;
  /** Units touched by the project — may be empty for property-wide work. */
  unitIds: ID[];
  status: ProjectStatus;
  startDate: string;
  estimatedCompletionDate?: string | null;
  completedDate?: string | null;
  contractor?: string | null;
  budget: number;
  costToDate: number;
  scope: string;
}

export interface DocumentRecord {
  id: ID;
  unitId?: ID | null;
  leaseId?: ID | null;
  name: string;
  kind: "Lease" | "Inspection" | "Photo" | "Invoice" | "Certificate" | "Notice";
  sizeKb: number;
  uploadedAt: string;
  uploadedBy: string;
}

export type ActivityKind =
  | "status"
  | "lease"
  | "tenant"
  | "finance"
  | "maintenance"
  | "record"
  | "system";

export interface ActivityEvent {
  id: ID;
  unitId: ID;
  kind: ActivityKind;
  message: string;
  actor: string;
  at: string;
}

export interface Database {
  properties: Property[];
  units: Unit[];
  tenants: Tenant[];
  leases: Lease[];
  leaseUnits: LeaseUnit[];
  leaseParties: LeaseParty[];
  transactions: Transaction[];
  maintenance: MaintenanceRequest[];
  projects: Project[];
  documents: DocumentRecord[];
  activity: ActivityEvent[];
}
