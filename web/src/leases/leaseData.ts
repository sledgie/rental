export type LeaseStatus =
  | "Draft"
  | "Pending Review"
  | "Pending Signature"
  | "Active"
  | "Expiring"
  | "Expired"
  | "Terminated"
  | "Archived";

export type TenancyStatus = "Fixed-term" | "Periodic" | "At will" | "Other";

export type PartyRole = "Main Tenant" | "Co-Tenant" | "Occupant" | "Guarantor";
export type SignatureStatus = "Not required" | "Pending" | "Signed" | "Declined";
export type DocumentStatus =
  | "Draft"
  | "Awaiting Signature"
  | "Signed"
  | "Active"
  | "Superseded"
  | "Archived"
  | "Expired";

export const documentCategories = [
  "Original Lease Agreement",
  "Signed Lease Agreement",
  "Lease Addendum",
  "Lease Amendment",
  "Renewal Agreement",
  "Tenant Notice",
  "Inspection Report",
  "Deposit Receipt",
  "Guarantor Agreement",
  "Property Rules",
  "Insurance Document",
  "Tenant Correspondence",
  "Other",
] as const;

export interface Property {
  id: string;
  name: string;
  address: string;
  city: string;
}

export interface Unit {
  id: string;
  propertyId: string;
  number: string;
  type: string;
  status: "Occupied" | "Vacant" | "Turnover";
  marketRent: number;
  notes: string;
}

export interface LeaseUnit {
  id: string;
  leaseId: string;
  unitId: string;
  allocatedMonthlyRent: number;
  startDate?: string;
  endDate?: string;
  notes: string;
}

export interface TenantRecord {
  id: string;
  name: string;
  email: string;
  phone: string;
  mailingAddress: string;
  recordStatus: "Active" | "Former" | "Prospect" | "Archived";
  isTenantRecord: boolean;
}

export interface LeaseParty {
  id: string;
  leaseId: string;
  personId: string;
  role: PartyRole;
  isPrimaryContact: boolean;
  isSignatory: boolean;
  signatureStatus: SignatureStatus;
  relationshipStartDate: string;
  relationshipEndDate?: string;
  relationship?: string;
  notes: string;
}

export interface AdditionalCharge {
  label: string;
  amount: number;
}

export interface FinancialTerms {
  agreedMonthlyRent?: number;
  rentDueDay: number;
  depositType: string;
  depositAmount: number;
  depositPermitted?: boolean;
  additionalCharges: AdditionalCharge[];
  parkingFees: number;
  storageFees: number;
  utilities: string;
  rentIncreaseDetails: string;
  effectiveDate?: string;
  paymentFrequency: string;
  paymentMethod: string;
  notes: string;
}

export interface Lease {
  id: string;
  leaseNumber: string;
  name: string;
  leaseType: string;
  tenancyStatus: TenancyStatus;
  status: LeaseStatus;
  startDate: string;
  endDate?: string;
  renewalEligible: boolean;
  renewalDeadline?: string;
  noticePeriodDays?: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  notes: string;
  occupancyStatus: "Occupied" | "Vacant" | "Not yet occupied" | "Unknown";
  financialTerms: FinancialTerms;
}

export interface LeaseDocument {
  id: string;
  leaseId: string;
  title: string;
  category: (typeof documentCategories)[number];
  originalFileName: string;
  fileType: string;
  fileSize: number;
  uploadedAt: string;
  uploadedBy: string;
  documentDate?: string;
  versionNumber: number;
  previousVersionId?: string;
  versionGroupId: string;
  expiryDate?: string;
  signatureStatus: SignatureStatus;
  status: DocumentStatus;
  storageReference: string;
  notes: string;
  signedDate?: string;
  signedBy?: string;
  uploadProgress?: number;
  file?: File;
}

export interface LeaseRenewal {
  id: string;
  originalLeaseId: string;
  successorLeaseId?: string;
  type: "Renewal" | "Amendment";
  proposedStartDate?: string;
  proposedEndDate?: string;
  proposedRent?: number;
  effectiveDate?: string;
  reminderDate?: string;
  status: "Draft" | "Pending Review" | "Pending Signature" | "Approved" | "Signed";
  relatedDocumentIds: string[];
  notes: string;
  createdAt: string;
}

export interface FinancialTransaction {
  id: string;
  leaseId: string;
  date: string;
  description: string;
  type: "Rent charge" | "Payment" | "Credit" | "Refund" | "Other charge";
  amount: number;
  status: "Paid" | "Received" | "Outstanding" | "Posted" | "Reversed";
  sourceReference: string;
}

export interface LeaseActivity {
  id: string;
  leaseId: string;
  date: string;
  user: string;
  action: string;
  details: string;
}

export interface LeaseData {
  properties: Property[];
  units: Unit[];
  leases: Lease[];
  leaseUnits: LeaseUnit[];
  people: TenantRecord[];
  parties: LeaseParty[];
  documents: LeaseDocument[];
  renewals: LeaseRenewal[];
  transactions: FinancialTransaction[];
  activities: LeaseActivity[];
}

export function dateOffset(days: number): string {
  const date = new Date();
  date.setUTCHours(12, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function formatDate(value?: string): string {
  if (!value) return "Not set";
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return "Not set";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

export function formatMoney(value?: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value ?? 0);
}

export function leaseMonthlyRent(lease: Lease, links: LeaseUnit[]): number {
  if (typeof lease.financialTerms.agreedMonthlyRent === "number") {
    return lease.financialTerms.agreedMonthlyRent;
  }
  return links
    .filter((link) => link.leaseId === lease.id)
    .reduce((total, link) => total + link.allocatedMonthlyRent, 0);
}

export function createInitialData(): LeaseData {
  const properties: Property[] = [
    { id: "prop-alder", name: "The Alder House", address: "123 Main Street", city: "Portland, ME 04101" },
    { id: "prop-juniper", name: "Juniper Court", address: "48 Juniper Avenue", city: "Portland, ME 04102" },
    { id: "prop-morrow", name: "Morrow Lofts", address: "906 Congress Street", city: "Portland, ME 04102" },
  ];

  const units: Unit[] = [
    { id: "unit-alder-1a", propertyId: "prop-alder", number: "1A", type: "2 bed / 1 bath", status: "Occupied", marketRent: 2150, notes: "Garden-level entrance" },
    { id: "unit-alder-2a", propertyId: "prop-alder", number: "2A", type: "1 bed / 1 bath", status: "Occupied", marketRent: 1325, notes: "Rear stair access" },
    { id: "unit-alder-3b", propertyId: "prop-alder", number: "3B", type: "2 bed / 2 bath", status: "Occupied", marketRent: 1850, notes: "Corner unit" },
    { id: "unit-juniper-101", propertyId: "prop-juniper", number: "101", type: "1 bed / 1 bath", status: "Vacant", marketRent: 1650, notes: "Courtyard-facing" },
    { id: "unit-juniper-102", propertyId: "prop-juniper", number: "102", type: "2 bed / 1 bath", status: "Vacant", marketRent: 1725, notes: "Recently refreshed" },
    { id: "unit-juniper-201", propertyId: "prop-juniper", number: "201", type: "2 bed / 2 bath", status: "Occupied", marketRent: 2300, notes: "Top floor" },
    { id: "unit-morrow-4f", propertyId: "prop-morrow", number: "4F", type: "Studio / 1 bath", status: "Vacant", marketRent: 1880, notes: "Exposed brick" },
    { id: "unit-morrow-5a", propertyId: "prop-morrow", number: "5A", type: "1 bed / 1 bath", status: "Turnover", marketRent: 2040, notes: "Turnover in progress" },
  ];

  const people: TenantRecord[] = [
    { id: "person-01", name: "Jenna Smith", email: "jenna.smith@email.test", phone: "(207) 555-0148", mailingAddress: "123 Main Street, Portland, ME 04101", recordStatus: "Active", isTenantRecord: true },
    { id: "person-02", name: "Mark Smith", email: "mark.smith@email.test", phone: "(207) 555-0193", mailingAddress: "123 Main Street, Portland, ME 04101", recordStatus: "Active", isTenantRecord: true },
    { id: "person-03", name: "Riley Smith", email: "riley.smith@email.test", phone: "(207) 555-0181", mailingAddress: "123 Main Street, Portland, ME 04101", recordStatus: "Active", isTenantRecord: true },
    { id: "person-04", name: "Taylor Smith", email: "taylor.smith@email.test", phone: "(207) 555-0160", mailingAddress: "123 Main Street, Portland, ME 04101", recordStatus: "Active", isTenantRecord: false },
    { id: "person-05", name: "Eleanor Smith", email: "eleanor.smith@email.test", phone: "(207) 555-0199", mailingAddress: "88 Forest Avenue, Portland, ME 04101", recordStatus: "Active", isTenantRecord: true },
    { id: "person-06", name: "Drew Carter", email: "drew.carter@email.test", phone: "(207) 555-0112", mailingAddress: "48 Juniper Avenue, Portland, ME 04102", recordStatus: "Active", isTenantRecord: true },
    { id: "person-07", name: "Lena Ortiz", email: "lena.ortiz@email.test", phone: "(207) 555-0177", mailingAddress: "48 Juniper Avenue, Portland, ME 04102", recordStatus: "Prospect", isTenantRecord: true },
    { id: "person-08", name: "Kai Thompson", email: "kai.thompson@email.test", phone: "(207) 555-0128", mailingAddress: "906 Congress Street, Portland, ME 04102", recordStatus: "Former", isTenantRecord: true },
    { id: "person-09", name: "Mia Bennett", email: "mia.bennett@email.test", phone: "(207) 555-0174", mailingAddress: "12 Park Street, Portland, ME 04101", recordStatus: "Active", isTenantRecord: true },
    { id: "person-10", name: "Owen Foster", email: "owen.foster@email.test", phone: "(207) 555-0138", mailingAddress: "48 Juniper Avenue, Portland, ME 04102", recordStatus: "Active", isTenantRecord: true },
    { id: "person-11", name: "Samira Patel", email: "samira.patel@email.test", phone: "(207) 555-0158", mailingAddress: "906 Congress Street, Portland, ME 04102", recordStatus: "Active", isTenantRecord: true },
  ];

  const leases: Lease[] = [
    {
      id: "lease-01", leaseNumber: "LSE-0001", name: "Smith Family - Main Floor Lease", leaseType: "Residential Fixed Term", tenancyStatus: "Fixed-term", status: "Expiring",
      startDate: dateOffset(-307), endDate: dateOffset(58), renewalEligible: true, renewalDeadline: dateOffset(24), noticePeriodDays: 60,
      createdAt: dateOffset(-340), updatedAt: dateOffset(-3), createdBy: "Maya Chen", notes: "Household has two allocated units under one agreement. Confirm renewal terms with all signatories before the notice deadline.",
      occupancyStatus: "Occupied", financialTerms: {
        rentDueDay: 1, depositType: "Security deposit", depositAmount: 2600, depositPermitted: true,
        additionalCharges: [{ label: "Water / sewer", amount: 45 }], parkingFees: 125, storageFees: 35,
        utilities: "Tenant pays electric and internet; water included in additional charges.",
        rentIncreaseDetails: "Proposed renewal adjustment is under review; no increase is effective until an amendment is signed.",
        effectiveDate: dateOffset(-307), paymentFrequency: "Monthly", paymentMethod: "ACH transfer", notes: "Contract rent is allocated across Units 1A and 2A. Deposit rules depend on the applicable tenancy and jurisdiction.",
      },
    },
    {
      id: "lease-02", leaseNumber: "LSE-0002", name: "Carter - Corner Apartment", leaseType: "Residential Fixed Term", tenancyStatus: "Fixed-term", status: "Active",
      startDate: dateOffset(-144), endDate: dateOffset(221), renewalEligible: true, renewalDeadline: dateOffset(161), noticePeriodDays: 60,
      createdAt: dateOffset(-164), updatedAt: dateOffset(-12), createdBy: "Maya Chen", notes: "Standard residential terms. Bicycle storage is included.", occupancyStatus: "Occupied",
      financialTerms: { agreedMonthlyRent: 1850, rentDueDay: 1, depositType: "Security deposit", depositAmount: 1850, depositPermitted: true, additionalCharges: [], parkingFees: 0, storageFees: 0, utilities: "Tenant pays all utilities.", rentIncreaseDetails: "No increase currently scheduled.", effectiveDate: dateOffset(-144), paymentFrequency: "Monthly", paymentMethod: "ACH transfer", notes: "" },
    },
    {
      id: "lease-03", leaseNumber: "LSE-0003", name: "Ortiz - Juniper Court 101", leaseType: "Residential Fixed Term", tenancyStatus: "Fixed-term", status: "Pending Signature",
      startDate: dateOffset(8), endDate: dateOffset(373), renewalEligible: true, renewalDeadline: dateOffset(313), noticePeriodDays: 60,
      createdAt: dateOffset(-5), updatedAt: dateOffset(-1), createdBy: "Maya Chen", notes: "Move-in is scheduled after all required signatories complete the agreement.", occupancyStatus: "Not yet occupied",
      financialTerms: { agreedMonthlyRent: 1650, rentDueDay: 1, depositType: "Last month's rent", depositAmount: 1650, additionalCharges: [], parkingFees: 50, storageFees: 0, utilities: "Tenant pays electric and internet.", rentIncreaseDetails: "Review at renewal.", effectiveDate: dateOffset(8), paymentFrequency: "Monthly", paymentMethod: "Not recorded", notes: "Deposit type is configurable; confirm applicable local requirements." },
    },
    {
      id: "lease-04", leaseNumber: "LSE-0004", name: "Bennett - Juniper 102 Draft", leaseType: "Residential Fixed Term", tenancyStatus: "Fixed-term", status: "Draft",
      startDate: dateOffset(35), endDate: dateOffset(400), renewalEligible: true, renewalDeadline: dateOffset(340), noticePeriodDays: 60,
      createdAt: dateOffset(-2), updatedAt: dateOffset(-1), createdBy: "Maya Chen", notes: "Draft terms only. Not yet approved or sent for signature.", occupancyStatus: "Vacant",
      financialTerms: { rentDueDay: 1, depositType: "Not set", depositAmount: 0, additionalCharges: [], parkingFees: 0, storageFees: 0, utilities: "To be confirmed", rentIncreaseDetails: "", paymentFrequency: "Monthly", paymentMethod: "Not recorded", notes: "" },
    },
    {
      id: "lease-05", leaseNumber: "LSE-0005", name: "Thompson - Morrow Loft", leaseType: "Residential Fixed Term", tenancyStatus: "Fixed-term", status: "Expired",
      startDate: dateOffset(-431), endDate: dateOffset(-66), renewalEligible: false, renewalDeadline: dateOffset(-126), noticePeriodDays: 60,
      createdAt: dateOffset(-450), updatedAt: dateOffset(-66), createdBy: "Avery Brooks", notes: "Term ended. Physical move-out and final account are tracked separately.", occupancyStatus: "Vacant",
      financialTerms: { agreedMonthlyRent: 1880, rentDueDay: 1, depositType: "Security deposit", depositAmount: 1880, additionalCharges: [], parkingFees: 0, storageFees: 0, utilities: "Tenant paid electric.", rentIncreaseDetails: "", effectiveDate: dateOffset(-431), paymentFrequency: "Monthly", paymentMethod: "ACH transfer", notes: "" },
    },
    {
      id: "lease-06", leaseNumber: "LSE-0006", name: "Foster - Juniper Periodic Tenancy", leaseType: "Month-to-Month", tenancyStatus: "Periodic", status: "Active",
      startDate: dateOffset(-202), renewalEligible: true, renewalDeadline: dateOffset(38), noticePeriodDays: 30,
      createdAt: dateOffset(-210), updatedAt: dateOffset(-8), createdBy: "Avery Brooks", notes: "Periodic tenancy with no fixed end date. Notice and renewal rules remain configurable.", occupancyStatus: "Occupied",
      financialTerms: { agreedMonthlyRent: 2300, rentDueDay: 1, depositType: "Security deposit", depositAmount: 2000, additionalCharges: [{ label: "Pet rent", amount: 35 }], parkingFees: 75, storageFees: 0, utilities: "Tenant pays electric and internet.", rentIncreaseDetails: "Any rent change requires the applicable notice and approval.", effectiveDate: dateOffset(-202), paymentFrequency: "Monthly", paymentMethod: "ACH transfer", notes: "No fixed-term end date applies." },
    },
    {
      id: "lease-07", leaseNumber: "LSE-0007", name: "Patel - Morrow 5A", leaseType: "Residential Fixed Term", tenancyStatus: "Fixed-term", status: "Pending Review",
      startDate: dateOffset(22), endDate: dateOffset(387), renewalEligible: true, renewalDeadline: dateOffset(327), noticePeriodDays: 60,
      createdAt: dateOffset(-6), updatedAt: dateOffset(-2), createdBy: "Maya Chen", notes: "Awaiting internal review of the final rent allocation.", occupancyStatus: "Not yet occupied",
      financialTerms: { agreedMonthlyRent: 2040, rentDueDay: 1, depositType: "Security deposit", depositAmount: 2040, additionalCharges: [], parkingFees: 0, storageFees: 45, utilities: "Tenant pays utilities.", rentIncreaseDetails: "", effectiveDate: dateOffset(22), paymentFrequency: "Monthly", paymentMethod: "Not recorded", notes: "" },
    },
  ];

  const leaseUnits: LeaseUnit[] = [
    { id: "lu-01", leaseId: "lease-01", unitId: "unit-alder-1a", allocatedMonthlyRent: 2150, startDate: dateOffset(-307), endDate: dateOffset(58), notes: "Primary family residence" },
    { id: "lu-02", leaseId: "lease-01", unitId: "unit-alder-2a", allocatedMonthlyRent: 1325, startDate: dateOffset(-307), endDate: dateOffset(58), notes: "Second unit under the same household agreement" },
    { id: "lu-03", leaseId: "lease-02", unitId: "unit-alder-3b", allocatedMonthlyRent: 1850, startDate: dateOffset(-144), endDate: dateOffset(221), notes: "" },
    { id: "lu-04", leaseId: "lease-03", unitId: "unit-juniper-101", allocatedMonthlyRent: 1650, startDate: dateOffset(8), endDate: dateOffset(373), notes: "" },
    { id: "lu-05", leaseId: "lease-04", unitId: "unit-juniper-102", allocatedMonthlyRent: 1725, startDate: dateOffset(35), endDate: dateOffset(400), notes: "Draft allocation" },
    { id: "lu-06", leaseId: "lease-05", unitId: "unit-morrow-4f", allocatedMonthlyRent: 1880, startDate: dateOffset(-431), endDate: dateOffset(-66), notes: "" },
    { id: "lu-07", leaseId: "lease-06", unitId: "unit-juniper-201", allocatedMonthlyRent: 2300, startDate: dateOffset(-202), notes: "Periodic tenancy" },
    { id: "lu-08", leaseId: "lease-07", unitId: "unit-morrow-5a", allocatedMonthlyRent: 2040, startDate: dateOffset(22), endDate: dateOffset(387), notes: "Pending internal review" },
  ];

  const parties: LeaseParty[] = [
    { id: "party-01", leaseId: "lease-01", personId: "person-01", role: "Main Tenant", isPrimaryContact: true, isSignatory: true, signatureStatus: "Signed", relationshipStartDate: dateOffset(-307), notes: "Primary household contact" },
    { id: "party-02", leaseId: "lease-01", personId: "person-02", role: "Co-Tenant", isPrimaryContact: false, isSignatory: true, signatureStatus: "Pending", relationshipStartDate: dateOffset(-307), notes: "Renewal offer awaiting acknowledgment" },
    { id: "party-03", leaseId: "lease-01", personId: "person-03", role: "Co-Tenant", isPrimaryContact: false, isSignatory: true, signatureStatus: "Signed", relationshipStartDate: dateOffset(-307), notes: "" },
    { id: "party-04", leaseId: "lease-01", personId: "person-04", role: "Occupant", isPrimaryContact: false, isSignatory: false, signatureStatus: "Not required", relationshipStartDate: dateOffset(-307), relationship: "Child", notes: "Authorized occupant; not a financially responsible party." },
    { id: "party-05", leaseId: "lease-01", personId: "person-05", role: "Guarantor", isPrimaryContact: false, isSignatory: true, signatureStatus: "Signed", relationshipStartDate: dateOffset(-307), notes: "" },
    { id: "party-06", leaseId: "lease-02", personId: "person-06", role: "Main Tenant", isPrimaryContact: true, isSignatory: true, signatureStatus: "Signed", relationshipStartDate: dateOffset(-144), notes: "" },
    { id: "party-07", leaseId: "lease-03", personId: "person-07", role: "Main Tenant", isPrimaryContact: true, isSignatory: true, signatureStatus: "Pending", relationshipStartDate: dateOffset(8), notes: "Agreement sent for signature" },
    { id: "party-08", leaseId: "lease-04", personId: "person-09", role: "Main Tenant", isPrimaryContact: true, isSignatory: true, signatureStatus: "Not required", relationshipStartDate: dateOffset(35), notes: "Draft only" },
    { id: "party-09", leaseId: "lease-05", personId: "person-08", role: "Main Tenant", isPrimaryContact: true, isSignatory: true, signatureStatus: "Signed", relationshipStartDate: dateOffset(-431), relationshipEndDate: dateOffset(-66), notes: "" },
    { id: "party-10", leaseId: "lease-06", personId: "person-10", role: "Main Tenant", isPrimaryContact: true, isSignatory: true, signatureStatus: "Signed", relationshipStartDate: dateOffset(-202), notes: "" },
    { id: "party-11", leaseId: "lease-07", personId: "person-11", role: "Main Tenant", isPrimaryContact: true, isSignatory: true, signatureStatus: "Not required", relationshipStartDate: dateOffset(22), notes: "Pending internal review" },
  ];

  const documents: LeaseDocument[] = [
    { id: "doc-01-v1", leaseId: "lease-01", title: "Smith Family Lease Agreement", category: "Original Lease Agreement", originalFileName: "smith-family-lease-v1.pdf", fileType: "application/pdf", fileSize: 684032, uploadedAt: dateOffset(-307), uploadedBy: "Maya Chen", documentDate: dateOffset(-307), versionNumber: 1, versionGroupId: "version-smith-lease", signatureStatus: "Signed", status: "Superseded", storageReference: "simulated://leases/LSE-0001/smith-family-lease-v1.pdf", notes: "Original signed copy retained in version history.", signedDate: dateOffset(-307), signedBy: "Jenna Smith" },
    { id: "doc-01-v2", leaseId: "lease-01", title: "Smith Family Lease Agreement", category: "Signed Lease Agreement", originalFileName: "smith-family-lease-v2.pdf", fileType: "application/pdf", fileSize: 702412, uploadedAt: dateOffset(-295), uploadedBy: "Maya Chen", documentDate: dateOffset(-307), versionNumber: 2, previousVersionId: "doc-01-v1", versionGroupId: "version-smith-lease", signatureStatus: "Signed", status: "Signed", storageReference: "simulated://leases/LSE-0001/smith-family-lease-v2.pdf", notes: "Executed agreement. Earlier signed version preserved.", signedDate: dateOffset(-295), signedBy: "Jenna Smith, Mark Smith, Riley Smith" },
    { id: "doc-02", leaseId: "lease-01", title: "Pet and Occupant Addendum", category: "Lease Addendum", originalFileName: "occupant-addendum.pdf", fileType: "application/pdf", fileSize: 241920, uploadedAt: dateOffset(-140), uploadedBy: "Maya Chen", documentDate: dateOffset(-140), versionNumber: 1, versionGroupId: "version-occupant-addendum", signatureStatus: "Signed", status: "Active", storageReference: "simulated://leases/LSE-0001/occupant-addendum.pdf", notes: "Lists the authorized occupant." },
    { id: "doc-03", leaseId: "lease-01", title: "Move-in Inspection", category: "Inspection Report", originalFileName: "smith-move-in-inspection.pdf", fileType: "application/pdf", fileSize: 1228800, uploadedAt: dateOffset(-306), uploadedBy: "Avery Brooks", documentDate: dateOffset(-306), versionNumber: 1, versionGroupId: "version-inspection", signatureStatus: "Not required", status: "Active", storageReference: "simulated://leases/LSE-0001/move-in-inspection.pdf", notes: "Initial condition report." },
    { id: "doc-04", leaseId: "lease-01", title: "Proposed Renewal Offer", category: "Renewal Agreement", originalFileName: "smith-renewal-offer-draft.pdf", fileType: "application/pdf", fileSize: 174080, uploadedAt: dateOffset(-4), uploadedBy: "Maya Chen", documentDate: dateOffset(-4), versionNumber: 1, versionGroupId: "version-renewal-offer", signatureStatus: "Pending", status: "Awaiting Signature", expiryDate: dateOffset(24), storageReference: "simulated://leases/LSE-0001/renewal-offer-draft.pdf", notes: "Draft offer; not a completed electronic signature." },
    { id: "doc-05", leaseId: "lease-02", title: "Carter Signed Agreement", category: "Signed Lease Agreement", originalFileName: "carter-agreement.pdf", fileType: "application/pdf", fileSize: 645120, uploadedAt: dateOffset(-144), uploadedBy: "Maya Chen", documentDate: dateOffset(-144), versionNumber: 1, versionGroupId: "version-carter-agreement", signatureStatus: "Signed", status: "Signed", storageReference: "simulated://leases/LSE-0002/carter-agreement.pdf", notes: "Signed agreement on file.", signedDate: dateOffset(-144), signedBy: "Drew Carter" },
    { id: "doc-06", leaseId: "lease-03", title: "Juniper 101 Agreement - Signature Copy", category: "Original Lease Agreement", originalFileName: "ortiz-lease-signature-copy.pdf", fileType: "application/pdf", fileSize: 532480, uploadedAt: dateOffset(-3), uploadedBy: "Maya Chen", documentDate: dateOffset(-3), versionNumber: 1, versionGroupId: "version-ortiz-agreement", signatureStatus: "Pending", status: "Awaiting Signature", expiryDate: dateOffset(8), storageReference: "simulated://leases/LSE-0003/ortiz-lease-signature-copy.pdf", notes: "Awaiting tenant signature. No e-sign integration is connected." },
    { id: "doc-07", leaseId: "lease-05", title: "Thompson Lease Agreement", category: "Signed Lease Agreement", originalFileName: "thompson-agreement.pdf", fileType: "application/pdf", fileSize: 599040, uploadedAt: dateOffset(-431), uploadedBy: "Avery Brooks", documentDate: dateOffset(-431), versionNumber: 1, versionGroupId: "version-thompson-agreement", signatureStatus: "Signed", status: "Expired", expiryDate: dateOffset(-66), storageReference: "simulated://leases/LSE-0005/thompson-agreement.pdf", notes: "Historical record retained.", signedDate: dateOffset(-431), signedBy: "Kai Thompson" },
  ];

  const renewals: LeaseRenewal[] = [
    { id: "renewal-01", originalLeaseId: "lease-01", type: "Renewal", proposedStartDate: dateOffset(59), proposedEndDate: dateOffset(424), proposedRent: 3600, effectiveDate: dateOffset(59), reminderDate: dateOffset(10), status: "Draft", relatedDocumentIds: ["doc-04"], notes: "Draft renewal terms are under review. Original signed agreement remains unchanged.", createdAt: dateOffset(-4) },
  ];

  const transactions: FinancialTransaction[] = [
    { id: "TX-4102", leaseId: "lease-01", date: dateOffset(-27), description: "Monthly rent charge", type: "Rent charge", amount: 3475, status: "Paid", sourceReference: "FIN-4102" },
    { id: "TX-4108", leaseId: "lease-01", date: dateOffset(-26), description: "Rent payment received", type: "Payment", amount: -3475, status: "Received", sourceReference: "FIN-4108" },
    { id: "TX-4130", leaseId: "lease-01", date: dateOffset(-8), description: "Parking fee", type: "Other charge", amount: 125, status: "Outstanding", sourceReference: "FIN-4130" },
    { id: "TX-4051", leaseId: "lease-02", date: dateOffset(-18), description: "Monthly rent payment", type: "Payment", amount: -1850, status: "Received", sourceReference: "FIN-4051" },
    { id: "TX-3920", leaseId: "lease-05", date: dateOffset(-61), description: "Final account credit", type: "Credit", amount: -85, status: "Posted", sourceReference: "FIN-3920" },
  ];

  const activities: LeaseActivity[] = [
    { id: "activity-01", leaseId: "lease-01", date: dateOffset(-340), user: "Maya Chen", action: "Lease created", details: "Initial agreement created for Units 1A and 2A." },
    { id: "activity-02", leaseId: "lease-01", date: dateOffset(-307), user: "Maya Chen", action: "Document uploaded", details: "Signed agreement v1 added to simulated storage." },
    { id: "activity-03", leaseId: "lease-01", date: dateOffset(-295), user: "Maya Chen", action: "Document version created", details: "Signed agreement v2 added; version 1 retained." },
    { id: "activity-04", leaseId: "lease-01", date: dateOffset(-140), user: "Avery Brooks", action: "Occupant added", details: "Taylor Smith added as an authorized occupant." },
    { id: "activity-05", leaseId: "lease-01", date: dateOffset(-4), user: "Maya Chen", action: "Renewal created", details: "Renewal draft prepared for review; original terms are preserved." },
    { id: "activity-06", leaseId: "lease-01", date: dateOffset(-3), user: "Maya Chen", action: "Status updated", details: "Lease flagged as expiring based on its configured notice deadline." },
    { id: "activity-07", leaseId: "lease-03", date: dateOffset(-3), user: "Maya Chen", action: "Document uploaded", details: "Agreement sent for signature (simulation only)." },
    { id: "activity-08", leaseId: "lease-05", date: dateOffset(-66), user: "Avery Brooks", action: "Status updated", details: "Fixed term reached its end date; occupancy tracked separately." },
  ];

  return { properties, units, leases, leaseUnits, people, parties, documents, renewals, transactions, activities };
}