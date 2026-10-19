export type TenantStatus = "Active" | "Pending" | "Inactive" | "Former";
export type LeaseStatus =
  "Draft" | "Pending" | "Active" | "Expiring" | "Expired" | "Terminated";
export type PartyRole = "Main Tenant" | "Co-Tenant" | "Occupant";

export interface Tenant {
  id: string;
  tenantNumber: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  preferredName?: string;
  photoUrl?: string;
  dateOfBirth?: string;
  phone: string;
  email: string;
  mailingAddress?: string;
  emergencyContact?: string;
  notes?: string;
  classification: "Main tenant" | "Individual";
  tenantStatus: TenantStatus;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
  avatarColor: string;
}

export interface Property {
  id: string;
  name: string;
  address: string;
  city: string;
}

export interface Unit {
  id: string;
  propertyId: string;
  unitNumber: string;
  unitStatus: "Occupied" | "Available" | "Reserved";
  bedrooms: number;
  area: number;
}

export interface LeaseDocument {
  id: string;
  name: string;
  createdAt: string;
}

export interface Lease {
  id: string;
  leaseNumber: string;
  startDate: string;
  endDate: string;
  leaseStatus: Exclude<LeaseStatus, "Expiring">;
  totalContractRent: number;
  securityDeposit: number;
  terms: string;
  documentReferences: LeaseDocument[];
  createdAt: string;
  updatedAt: string;
}

export interface LeaseUnit {
  id: string;
  leaseId: string;
  unitId: string;
  rentAllocation: number;
  occupancyStartDate: string;
  occupancyEndDate?: string;
}

export interface LeaseParty {
  id: string;
  leaseId: string;
  tenantId: string;
  role: PartyRole;
  isSignatory: boolean;
  effectiveStartDate: string;
  effectiveEndDate?: string;
}

export interface PartyUnit {
  id: string;
  partyId: string;
  unitId: string;
}

export interface Account {
  id: string;
  label: string;
  accountType: "Tenant" | "Lease" | "Unit";
  tenantId: string;
  leaseId?: string;
  unitId?: string;
  currency: "CAD";
  nettingRule: "within-account-only";
}

export interface Transaction {
  id: string;
  accountId: string;
  accountType: Account["accountType"];
  leaseId?: string;
  unitId?: string;
  tenantId: string;
  transactionType: "Charge" | "Payment" | "Credit" | "Adjustment";
  description: string;
  amount: number;
  transactionDate: string;
  dueDate?: string;
  paymentStatus: "Posted" | "Draft" | "Voided" | "Cancelled";
}

export interface Activity {
  id: string;
  tenantId: string;
  at: string;
  label: string;
  description: string;
}

export interface Database {
  tenants: Tenant[];
  properties: Property[];
  units: Unit[];
  leases: Lease[];
  leaseUnits: LeaseUnit[];
  leaseParties: LeaseParty[];
  partyUnits: PartyUnit[];
  accounts: Account[];
  transactions: Transaction[];
  activities: Activity[];
}

export interface NewLeaseInput {
  startDate: string;
  endDate: string;
  rent: number;
  deposit: number;
  unitIds: string[];
}

export interface LeaseAssociation {
  mode: "none" | "existing" | "new";
  leaseId?: string;
  role: PartyRole;
  isSignatory: boolean;
  unitIds: string[];
  newLease?: NewLeaseInput;
}

export type TenantInput = Omit<
  Tenant,
  | "id"
  | "tenantNumber"
  | "createdAt"
  | "updatedAt"
  | "avatarColor"
  | "archivedAt"
>;
export type ProfileTab =
  | "Overview"
  | "Personal information"
  | "Leases"
  | "Units"
  | "People"
  | "Financial ledger"
  | "Documents"
  | "Activity history";
