/**
 * Shared domain types.
 *
 * These mirror the existing Keystone entities (Property, Unit, Person/Tenant,
 * Lease) plus the normalized application entities used by the Applications
 * module. Applications reference Property / Unit / Person / Lease records by id
 * instead of duplicating them.
 */

export type ID = string;

/* ------------------------------- Properties ------------------------------ */

export interface Property {
  id: ID;
  name: string;
  addressLine1: string;
  city: string;
  state: string;
  postalCode: string;
  propertyType: string;
  yearBuilt: number;
  managerId: ID;
}

export type UnitStatus =
  | "Vacant"
  | "Occupied"
  | "Notice"
  | "Renovation"
  | "Reserved";

export interface Unit {
  id: ID;
  propertyId: ID;
  unitNumber: string;
  unitType: string;
  bedrooms: number;
  bathrooms: number;
  squareFeet: number;
  advertisedRent: number;
  status: UnitStatus;
  availableFrom: string;
  parkingSpaces: number;
  parkingFee: number;
  petPolicy: string;
  notes?: string;
}

/* ---------------------------- People and tenants -------------------------- */

export interface Person {
  id: ID;
  fullName: string;
  preferredName?: string;
  email: string;
  phone: string;
  currentAddress: string;
  tenantId?: ID;
}

export interface Tenant {
  id: ID;
  code: string;
  personId: ID;
  status: "Current" | "Former" | "Prospect";
  propertyId?: ID;
  unitId?: ID;
  leaseId?: ID;
  balanceCents: number;
  since: string;
}

export interface Lease {
  id: ID;
  leaseNumber: string;
  propertyId: ID;
  unitId: ID;
  applicationId?: ID;
  tenantPersonIds: ID[];
  occupantNames: string[];
  startDate: string;
  endDate: string;
  monthlyRent: number;
  securityDeposit: number;
  termMonths: number;
  status: "Draft" | "Pending Signature" | "Active" | "Expired" | "Terminated";
  createdAt: string;
  notes?: string;
}

/* ---------------------------------- Staff -------------------------------- */

export interface Staff {
  id: ID;
  name: string;
  role: string;
  email: string;
  /** Permission keys used to gate sensitive screening data in the UI. */
  permissions: string[];
}

export const PERMISSIONS = {
  screening: "applications.screening.read",
  documents: "applications.documents.read",
  decisions: "applications.decision.write",
  management: "applications.manage",
} as const;

/* ------------------------------ Applications ----------------------------- */

export type ApplicationStatus =
  | "Draft"
  | "New"
  | "Under Review"
  | "Awaiting Information"
  | "Approved"
  | "Declined"
  | "Waitlisted"
  | "Withdrawn"
  | "Archived";

export type ApplicationSource =
  | "Website"
  | "Referral"
  | "Walk-in"
  | "Listing Portal"
  | "Manually Entered"
  | "Transfer";

export type PartyRole = "Primary Applicant" | "Co-Applicant" | "Proposed Occupant";

export type ScreeningStatus =
  | "Not Started"
  | "In Progress"
  | "Waiting for Information"
  | "Completed"
  | "Not Applicable";

export interface Application {
  id: ID;
  applicationNumber: string;
  status: ApplicationStatus;
  propertyId: ID;
  unitId: ID;
  requestedMoveInDate: string;
  requestedLeaseTerm: number;
  advertisedRent: number;
  proposedRent: number | null;
  applicationSource: ApplicationSource;
  assignedReviewerId: ID | null;
  submittedAt: string;
  updatedAt: string;
  internalNotes: string;
  createdLeaseId?: ID;
  /** Unit is never auto-reserved; a reservation is tracked separately. */
  unitReservation: "None" | "Soft Hold" | "Reserved";
  proposedOccupants: number;
  parkingRequired: string;
  petInfo: string;
  rentalPreferences: string;
  /** Draft applications are not yet visible to summary counters. */
  completeness: number;
}

export interface ApplicationParty {
  id: ID;
  applicationId: ID;
  personId?: ID;
  role: PartyRole;
  isPrimary: boolean;
  fullName: string;
  preferredName?: string;
  email: string;
  phone: string;
  currentAddress?: string;
  preferredContact: "Email" | "Phone" | "Text Message" | "Mail";
  relationship: string;
  incomeMonthly?: number;
  employment?: string;
  screeningStatus: ScreeningStatus;
  requiredDocuments: string[];
  signatureRequired: boolean;
  signatureStatus: "Not Sent" | "Sent" | "Signed" | "Not Applicable";
  notes?: string;
}

export type DocumentCategory =
  | "Rental Application Form"
  | "Proof of Income"
  | "Employment Letter"
  | "Reference"
  | "Credit Authorization"
  | "Identity Verification"
  | "Supporting Document"
  | "Other";

export type DocumentStatus =
  | "Received"
  | "Under Review"
  | "Accepted"
  | "Needs Replacement"
  | "Archived";

export interface DocumentVersion {
  id: ID;
  versionNumber: number;
  fileName: string;
  fileSize: number;
  fileType: string;
  uploadedAt: string;
  uploadedBy: string;
  notes?: string;
  /** the chosen file, uploaded when the document is saved (not kept after a reload) */
  file?: File;
}

export interface ApplicationDocument {
  id: ID;
  applicationId: ID;
  applicationPartyId?: ID;
  title: string;
  category: DocumentCategory;
  fileName: string;
  fileType: string;
  fileSize: number;
  uploadedAt: string;
  uploadedBy: string;
  versionNumber: number;
  previousVersionId?: ID;
  status: DocumentStatus;
  /** Object key / URI in a real object store. Empty in the prototype. */
  storageReference?: string;
  notes?: string;
  versions: DocumentVersion[];
  deletedAt?: string | null;
  retentionUntil?: string;
  /** the chosen file, uploaded when the document is saved (not kept after a reload) */
  file?: File;
}

export interface ApplicationReview {
  id: ID;
  applicationId: ID;
  reviewerId: ID;
  reviewType:
    | "Completeness Check"
    | "Reference Check"
    | "Employment & Income"
    | "Credit Check"
    | "Rental History"
    | "Identity Verification"
    | "Final Review";
  status: ScreeningStatus;
  startedAt?: string;
  reviewedAt?: string;
  notes?: string;
  followUpRequired: boolean;
  followUpDate?: string;
}

export type ActivityType =
  | "application_created"
  | "application_updated"
  | "applicant_added"
  | "co_applicant_added"
  | "applicant_removed"
  | "unit_selected"
  | "document_uploaded"
  | "document_updated"
  | "document_archived"
  | "document_deleted"
  | "review_started"
  | "review_note_added"
  | "information_requested"
  | "information_received"
  | "status_changed"
  | "decision_recorded"
  | "communication_logged"
  | "follow_up_completed"
  | "lease_created"
  | "note_added";

export interface ApplicationActivity {
  id: ID;
  applicationId: ID;
  activityType: ActivityType;
  description: string;
  details?: string;
  createdAt: string;
  createdBy: string;
}

export interface ApplicationCommunication {
  id: ID;
  applicationId: ID;
  applicationPartyId?: ID;
  contactMethod: "Phone Call" | "Email" | "Text Message" | "In Person" | "Letter" | "Portal Message";
  subject: string;
  summary: string;
  createdAt: string;
  createdBy: string;
  followUpRequired: boolean;
  followUpDate?: string;
  followUpStatus?: "Open" | "Completed" | "Overdue";
}

export const DOCUMENT_CATEGORIES: DocumentCategory[] = [
  "Rental Application Form",
  "Proof of Income",
  "Employment Letter",
  "Reference",
  "Credit Authorization",
  "Identity Verification",
  "Supporting Document",
  "Other",
];

/** Configurable per-application requirements (never a hard-coded global rule). */
export const DEFAULT_REQUIRED_DOCUMENTS = [
  "Rental Application Form",
  "Proof of Income",
  "Reference",
  "Credit Authorization",
];

export type StatusHistoryEntry = {
  id: ID;
  from: ApplicationStatus | "—";
  to: ApplicationStatus;
  changedAt: string;
  changedBy: string;
  notes?: string;
};
