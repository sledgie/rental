import { addDays } from "../lib/format";
import {
  type Application,
  type ApplicationActivity,
  type ApplicationCommunication,
  type ApplicationDocument,
  type ApplicationParty,
  type ApplicationReview,
  type ActivityType,
  type DocumentCategory,
  type Lease,
  type PartyRole,
  type Person,
  type Property,
  type Staff,
  type Tenant,
  type Unit,
} from "./types";

/** ISO day offset from today (negative = past). Keeps the demo data fresh. */
const d = (offset: number) => addDays(offset);


/* --------------------------------- Staff --------------------------------- */

export const staff: Staff[] = [
  {
    id: "stf-1",
    name: "Dana Whitfield",
    role: "Leasing Manager",
    email: "dana.whitfield@keystonepm.com",
    permissions: [
      "applications.screening.read",
      "applications.documents.read",
      "applications.decision.write",
      "applications.manage",
    ],
  },
  {
    id: "stf-2",
    name: "Marcus Ibele",
    role: "Property Manager",
    email: "marcus.ibele@keystonepm.com",
    permissions: [
      "applications.screening.read",
      "applications.documents.read",
      "applications.decision.write",
    ],
  },
  {
    id: "stf-3",
    name: "Priya Raman",
    role: "Leasing Coordinator",
    email: "priya.raman@keystonepm.com",
    permissions: ["applications.documents.read"],
  },
  {
    id: "stf-4",
    name: "Elena Cruz",
    role: "Regional Director",
    email: "elena.cruz@keystonepm.com",
    permissions: [
      "applications.screening.read",
      "applications.documents.read",
      "applications.decision.write",
      "applications.manage",
    ],
  },
];

/* ------------------------------- Properties ------------------------------ */

export const properties: Property[] = [
  {
    id: "prp-1",
    name: "Harborview Flats",
    addressLine1: "418 Harborview Ave",
    city: "Portland",
    state: "OR",
    postalCode: "97209",
    propertyType: "Apartment Building",
    yearBuilt: 1988,
    managerId: "stf-2",
  },
  {
    id: "prp-2",
    name: "Cedar Row Townhomes",
    addressLine1: "1290 Cedar Row Ln",
    city: "Beaverton",
    state: "OR",
    postalCode: "97005",
    propertyType: "Townhome Community",
    yearBuilt: 2004,
    managerId: "stf-1",
  },
  {
    id: "prp-3",
    name: "The Foundry Lofts",
    addressLine1: "77 Foundry St",
    city: "Portland",
    state: "OR",
    postalCode: "97227",
    propertyType: "Adaptive Reuse Lofts",
    yearBuilt: 2016,
    managerId: "stf-3",
  },
  {
    id: "prp-4",
    name: "Willow Court",
    addressLine1: "88 Willow Ct",
    city: "Lake Oswego",
    state: "OR",
    postalCode: "97034",
    propertyType: "Garden Style",
    yearBuilt: 1972,
    managerId: "stf-2",
  },
];

export const units: Unit[] = [
  { id: "unt-1", propertyId: "prp-1", unitNumber: "204", unitType: "1 Bed / 1 Bath", bedrooms: 1, bathrooms: 1, squareFeet: 720, advertisedRent: 1695, status: "Vacant", availableFrom: d(3), parkingSpaces: 1, parkingFee: 75, petPolicy: "Cats and dogs under 30 lbs. $40/mo pet rent." },
  { id: "unt-2", propertyId: "prp-1", unitNumber: "310", unitType: "2 Bed / 2 Bath", bedrooms: 2, bathrooms: 2, squareFeet: 1080, advertisedRent: 2340, status: "Notice", availableFrom: d(21), parkingSpaces: 1, parkingFee: 85, petPolicy: "No pets.", notes: "Updated kitchen, balcony facing harbor." },
  { id: "unt-3", propertyId: "prp-1", unitNumber: "118", unitType: "Studio", bedrooms: 0, bathrooms: 1, squareFeet: 520, advertisedRent: 1345, status: "Vacant", availableFrom: d(-4), parkingSpaces: 0, parkingFee: 0, petPolicy: "Cats only." },
  { id: "unt-4", propertyId: "prp-2", unitNumber: "B-2", unitType: "3 Bed / 2.5 Bath Townhome", bedrooms: 3, bathrooms: 2.5, squareFeet: 1540, advertisedRent: 2895, status: "Vacant", availableFrom: d(-12), parkingSpaces: 2, parkingFee: 0, petPolicy: "Two pets allowed, breed restrictions apply." },
  { id: "unt-5", propertyId: "prp-2", unitNumber: "A-4", unitType: "2 Bed / 1.5 Bath Townhome", bedrooms: 2, bathrooms: 1.5, squareFeet: 1180, advertisedRent: 2395, status: "Vacant", availableFrom: d(9), parkingSpaces: 1, parkingFee: 0, petPolicy: "One pet under 50 lbs." },
  { id: "unt-6", propertyId: "prp-2", unitNumber: "C-1", unitType: "3 Bed / 2.5 Bath Townhome", bedrooms: 3, bathrooms: 2.5, squareFeet: 1610, advertisedRent: 2995, status: "Occupied", availableFrom: d(120), parkingSpaces: 2, parkingFee: 0, petPolicy: "Two pets allowed." },
  { id: "unt-7", propertyId: "prp-3", unitNumber: "402", unitType: "1 Bed / 1 Bath Loft", bedrooms: 1, bathrooms: 1, squareFeet: 840, advertisedRent: 1985, status: "Vacant", availableFrom: d(14), parkingSpaces: 1, parkingFee: 125, petPolicy: "Pets considered case by case." },
  { id: "unt-8", propertyId: "prp-3", unitNumber: "505", unitType: "2 Bed / 2 Bath Loft", bedrooms: 2, bathrooms: 2, squareFeet: 1240, advertisedRent: 2740, status: "Occupied", availableFrom: d(60), parkingSpaces: 1, parkingFee: 125, petPolicy: "No pets." },
  { id: "unt-9", propertyId: "prp-3", unitNumber: "210", unitType: "Studio Loft", bedrooms: 0, bathrooms: 1, squareFeet: 610, advertisedRent: 1620, status: "Renovation", availableFrom: d(38), parkingSpaces: 0, parkingFee: 0, petPolicy: "Cats only.", notes: "Flooring replacement scheduled." },
  { id: "unt-10", propertyId: "prp-4", unitNumber: "12", unitType: "2 Bed / 1 Bath", bedrooms: 2, bathrooms: 1, squareFeet: 920, advertisedRent: 1895, status: "Vacant", availableFrom: d(1), parkingSpaces: 1, parkingFee: 50, petPolicy: "Cats and small dogs." },
  { id: "unt-11", propertyId: "prp-4", unitNumber: "7", unitType: "1 Bed / 1 Bath", bedrooms: 1, bathrooms: 1, squareFeet: 760, advertisedRent: 1725, status: "Notice", availableFrom: d(30), parkingSpaces: 1, parkingFee: 50, petPolicy: "Cats only." },
  { id: "unt-12", propertyId: "prp-4", unitNumber: "21", unitType: "2 Bed / 1 Bath", bedrooms: 2, bathrooms: 1, squareFeet: 940, advertisedRent: 1940, status: "Vacant", availableFrom: d(-6), parkingSpaces: 2, parkingFee: 50, petPolicy: "Cats and small dogs." },
];

/* ---------------------------- People and tenants -------------------------- */

export const people: Person[] = [
  { id: "per-1", fullName: "Amara Osei", preferredName: "Amy", email: "amara.osei@example.com", phone: "(503) 555-0142", currentAddress: "1420 SE Ankeny St, Portland, OR 97214", tenantId: "tnt-1" },
  { id: "per-2", fullName: "Devon Malik", email: "devon.malik@example.com", phone: "(971) 555-0188", currentAddress: "318 NW Everett St Apt 6, Portland, OR 97209" },
  { id: "per-3", fullName: "Rosalind Hart", preferredName: "Ros", email: "rosalind.hart@example.com", phone: "(503) 555-0119", currentAddress: "9011 SW Beaverton Hwy, Beaverton, OR 97005", tenantId: "tnt-2" },
  { id: "per-4", fullName: "Tobias Lund", email: "tobias.lund@example.com", phone: "(360) 555-0173", currentAddress: "226 Grand Ave, Vancouver, WA 98660" },
  { id: "per-5", fullName: "Priyanka Vaidya", email: "priyanka.vaidya@example.com", phone: "(503) 555-0164", currentAddress: "5408 N Vancouver Ave, Portland, OR 97217" },
  { id: "per-6", fullName: "Julian Reyes", email: "julian.reyes@example.com", phone: "(503) 555-0104", currentAddress: "77 Foundry St Apt 305, Portland, OR 97227" },
  { id: "per-7", fullName: "Hana Sorensen", email: "hana.sorensen@example.com", phone: "(971) 555-0137", currentAddress: "4110 SE Division St, Portland, OR 97206" },
  { id: "per-8", fullName: "Nathan Okonkwo", email: "nathan.okonkwo@example.com", phone: "(503) 555-0155", currentAddress: "1620 SW Jefferson St, Portland, OR 97201" },
  { id: "per-9", fullName: "Elise Fontaine", email: "elise.fontaine@example.com", phone: "(503) 555-0126", currentAddress: "88 Willow Ct Apt 9, Lake Oswego, OR 97034", tenantId: "tnt-3" },
  { id: "per-10", fullName: "Gregor Halvorsen", email: "gregor.halvorsen@example.com", phone: "(360) 555-0192", currentAddress: "1409 Franklin St, Vancouver, WA 98660" },
  { id: "per-11", fullName: "Marisol Duarte", email: "marisol.duarte@example.com", phone: "(503) 555-0178", currentAddress: "2310 SE Belmont St, Portland, OR 97214" },
  { id: "per-12", fullName: "Owen Castellanos", email: "owen.castellanos@example.com", phone: "(971) 555-0161", currentAddress: "615 N Killingsworth St, Portland, OR 97217" },
];

export const tenants: Tenant[] = [
  { id: "tnt-1", code: "TEN-1042", personId: "per-1", status: "Current", propertyId: "prp-3", unitId: "unt-8", leaseId: "lse-3", balanceCents: 0, since: d(-820) },
  { id: "tnt-2", code: "TEN-0977", personId: "per-3", status: "Former", propertyId: "prp-2", balanceCents: 0, since: d(-1500) },
  { id: "tnt-3", code: "TEN-1188", personId: "per-9", status: "Current", propertyId: "prp-4", unitId: "unt-11", leaseId: "lse-4", balanceCents: 45000, since: d(-430) },
];

export const leases: Lease[] = [
  {
    id: "lse-1",
    leaseNumber: "LSE-2026-0031",
    propertyId: "prp-2",
    unitId: "unt-4",
    applicationId: "app-1",
    tenantPersonIds: ["per-2", "per-4"],
    occupantNames: ["Lila Malik (age 7)"],
    startDate: d(-9),
    endDate: d(356),
    monthlyRent: 2850,
    securityDeposit: 2850,
    termMonths: 12,
    status: "Active",
    createdAt: d(-16),
    notes: "Created from application APP-0001. Applicant records linked, no duplicates created.",
  },
  {
    id: "lse-2",
    leaseNumber: "LSE-2026-0008",
    propertyId: "prp-3",
    unitId: "unt-8",
    tenantPersonIds: ["per-1"],
    occupantNames: [],
    startDate: d(-780),
    endDate: d(150),
    monthlyRent: 2640,
    securityDeposit: 2640,
    termMonths: 12,
    status: "Active",
    createdAt: d(-800),
  },
  {
    id: "lse-3",
    leaseNumber: "LSE-2025-0142",
    propertyId: "prp-4",
    unitId: "unt-11",
    tenantPersonIds: ["per-9"],
    occupantNames: [],
    startDate: d(-430),
    endDate: d(300),
    monthlyRent: 1690,
    securityDeposit: 1690,
    termMonths: 12,
    status: "Active",
    createdAt: d(-440),
  },
];

/* ------------------------------- Applications ---------------------------- */

let partySeq = 0;
const party = (
  p: Partial<ApplicationParty> & { applicationId: string; fullName: string; role: PartyRole },
): ApplicationParty => ({
  id: `pty-${++partySeq}`,
  isPrimary: false,
  email: "",
  phone: "",
  currentAddress: "",
  preferredContact: "Email",
  relationship: p.role === "Primary Applicant" ? "Applicant" : "Co-applicant",
  screeningStatus: "Not Started",
  requiredDocuments: [],
  signatureRequired: true,
  signatureStatus: "Not Sent",
  ...p,
});

let docSeq = 0;
const doc = (
  p: Partial<ApplicationDocument> & { applicationId: string; title: string; category: DocumentCategory },
): ApplicationDocument => {
  const docId = `doc-${++docSeq}`;
  const version: ApplicationDocument["versions"][number] = {
    id: `${docId}-v${p.versionNumber ?? 1}`,
    versionNumber: p.versionNumber ?? 1,
    fileName: p.fileName ?? `${p.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.pdf`,
    fileSize: p.fileSize ?? 248_000,
    fileType: p.fileType ?? "PDF",
    uploadedAt: p.uploadedAt ?? d(-6),
    uploadedBy: p.uploadedBy ?? "Amara Osei (Applicant portal)",
    notes: p.notes,
  };
  return {
    id: docId,
    fileName: version.fileName,
    fileType: version.fileType,
    fileSize: version.fileSize,
    uploadedAt: version.uploadedAt,
    uploadedBy: version.uploadedBy,
    status: "Received",
    versionNumber: 1,
    deletedAt: null,
    retentionUntil: addDays(2555, new Date(p.uploadedAt ?? new Date())),
    storageReference: undefined,
    ...p,
    versions: p.versions ?? [version],
  };
};

let actSeq = 0;
const act = (
  applicationId: string,
  activityType: ActivityType,
  description: string,
  createdAt: string,
  createdBy: string,
  details?: string,
): ApplicationActivity => ({
  id: `act-${++actSeq}`,
  applicationId,
  activityType,
  description,
  details,
  createdAt,
  createdBy,
});

export const applications: Application[] = [
  {
    id: "app-1", applicationNumber: "APP-0001", status: "Approved", propertyId: "prp-2", unitId: "unt-4",
    requestedMoveInDate: d(-9), requestedLeaseTerm: 12, advertisedRent: 2895, proposedRent: 2850,
    applicationSource: "Website", assignedReviewerId: "stf-1", submittedAt: d(-24), updatedAt: d(-16),
    internalNotes: "Strong combined income, verified both employers. Approved with standard deposit.",
    createdLeaseId: "lse-1", unitReservation: "None", proposedOccupants: 3, parkingRequired: "2 spaces (included with townhome)",
    petInfo: "One 4-year-old golden retriever, 68 lbs. Vaccination records on file.",
    rentalPreferences: "Ground-floor preferred but not required. Requests to install window coverings.",
    completeness: 100,
  },
  {
    id: "app-2", applicationNumber: "APP-0002", status: "Under Review", propertyId: "prp-1", unitId: "unt-2",
    requestedMoveInDate: d(24), requestedLeaseTerm: 18, advertisedRent: 2340, proposedRent: 2280,
    applicationSource: "Listing Portal", assignedReviewerId: "stf-2", submittedAt: d(-7), updatedAt: d(-1),
    internalNotes: "Household of four. Waiting on second co-applicant's employment letter.",
    unitReservation: "Soft Hold", proposedOccupants: 4, parkingRequired: "1 covered space ($85/mo)",
    petInfo: "None reported.",
    rentalPreferences: "Requests 18-month term at $2,280/mo. Willing to sign immediately after approval.",
    completeness: 78,
  },
  {
    id: "app-3", applicationNumber: "APP-0003", status: "Under Review", propertyId: "prp-3", unitId: "unt-7",
    requestedMoveInDate: d(16), requestedLeaseTerm: 12, advertisedRent: 1985, proposedRent: null,
    applicationSource: "Transfer", assignedReviewerId: "stf-1", submittedAt: d(-5), updatedAt: d(-2),
    internalNotes: "Internal transfer from Loft 505 (tenant TEN-1042). Clean payment history, no transfer fee.",
    unitReservation: "None", proposedOccupants: 1, parkingRequired: "1 garage space ($125/mo)",
    petInfo: "One cat, 9 lbs. Pet deposit already on file from current tenancy.",
    rentalPreferences: "Existing tenant in good standing requesting larger unit. Would like to keep same move-out date.",
    completeness: 92,
  },
  {
    id: "app-4", applicationNumber: "APP-0004", status: "Awaiting Information", propertyId: "prp-2", unitId: "unt-5",
    requestedMoveInDate: d(11), requestedLeaseTerm: 12, advertisedRent: 2395, proposedRent: null,
    applicationSource: "Referral", assignedReviewerId: "stf-3", submittedAt: d(-11), updatedAt: d(-3),
    internalNotes: "Needs two most recent pay stubs and landlord reference for the co-applicant. Reminder sent.",
    unitReservation: "None", proposedOccupants: 2, parkingRequired: "1 surface space",
    petInfo: "Dog, 42 lbs, mixed breed. Shot records pending.",
    rentalPreferences: "Hopes to coordinate move-in with the end of the current lease on the 30th.",
    completeness: 61,
  },
  {
    id: "app-5", applicationNumber: "APP-0005", status: "New", propertyId: "prp-4", unitId: "unt-10",
    requestedMoveInDate: d(4), requestedLeaseTerm: 12, advertisedRent: 1895, proposedRent: null,
    applicationSource: "Manually Entered", assignedReviewerId: null, submittedAt: d(0), updatedAt: d(0),
    internalNotes: "Walk-in tour converted to application. Needs reviewer assignment.",
    unitReservation: "None", proposedOccupants: 2, parkingRequired: "1 space",
    petInfo: "None reported.",
    rentalPreferences: "Asked about month-to-month after the initial term.",
    completeness: 45,
  },
  {
    id: "app-6", applicationNumber: "APP-0006", status: "Waitlisted", propertyId: "prp-2", unitId: "unt-6",
    requestedMoveInDate: d(58), requestedLeaseTerm: 12, advertisedRent: 2995, proposedRent: null,
    applicationSource: "Website", assignedReviewerId: "stf-1", submittedAt: d(-14), updatedAt: d(-8),
    internalNotes: "Qualified but unit is occupied through next quarter. Placed at #1 on the waitlist for C-1.",
    unitReservation: "None", proposedOccupants: 3, parkingRequired: "2 spaces",
    petInfo: "None reported.",
    rentalPreferences: "Flexible on move-in date if the current notice period is respected.",
    completeness: 88,
  },
  {
    id: "app-7", applicationNumber: "APP-0007", status: "Declined", propertyId: "prp-3", unitId: "unt-8",
    requestedMoveInDate: d(30), requestedLeaseTerm: 12, advertisedRent: 2740, proposedRent: null,
    applicationSource: "Listing Portal", assignedReviewerId: "stf-2", submittedAt: d(-19), updatedAt: d(-13),
    internalNotes: "Decision recorded: unanswered income verification after two requests. Adverse action notice sent.",
    unitReservation: "None", proposedOccupants: 1, parkingRequired: "1 space",
    petInfo: "None reported.",
    rentalPreferences: "—",
    completeness: 70,
  },
  {
    id: "app-8", applicationNumber: "APP-0008", status: "Withdrawn", propertyId: "prp-4", unitId: "unt-12",
    requestedMoveInDate: d(6), requestedLeaseTerm: 12, advertisedRent: 1940, proposedRent: null,
    applicationSource: "Website", assignedReviewerId: "stf-3", submittedAt: d(-9), updatedAt: d(-4),
    internalNotes: "Applicant withdrew — accepted a position out of state. Application fee non-refundable.",
    unitReservation: "None", proposedOccupants: 1, parkingRequired: "1 space",
    petInfo: "None reported.",
    rentalPreferences: "—",
    completeness: 55,
  },
  {
    id: "app-9", applicationNumber: "APP-0009", status: "New", propertyId: "prp-1", unitId: "unt-1",
    requestedMoveInDate: d(5), requestedLeaseTerm: 12, advertisedRent: 1695, proposedRent: null,
    applicationSource: "Website", assignedReviewerId: "stf-3", submittedAt: d(-1), updatedAt: d(-1),
    internalNotes: "Second application received for Unit 204. Compare with APP-0005 applicant pool before deciding.",
    unitReservation: "None", proposedOccupants: 1, parkingRequired: "1 space",
    petInfo: "Cat, 11 lbs.",
    rentalPreferences: "Prefers a 13-month term ending in summer.",
    completeness: 84,
  },
  {
    id: "app-10", applicationNumber: "APP-0010", status: "Under Review", propertyId: "prp-2", unitId: "unt-4",
    requestedMoveInDate: d(47), requestedLeaseTerm: 24, advertisedRent: 2895, proposedRent: 2950,
    applicationSource: "Referral", assignedReviewerId: "stf-1", submittedAt: d(-3), updatedAt: d(0),
    internalNotes: "Waitlist overflow for Cedar Row. Proposed a premium for the larger townhome.",
    unitReservation: "None", proposedOccupants: 4, parkingRequired: "2 spaces",
    petInfo: "Two cats. Both already microchipped.",
    rentalPreferences: "Requested 24-month term with a rent cap of 3% at renewal.",
    completeness: 81,
  },
  {
    id: "app-11", applicationNumber: "APP-0011", status: "Draft", propertyId: "prp-3", unitId: "unt-9",
    requestedMoveInDate: d(40), requestedLeaseTerm: 12, advertisedRent: 1620, proposedRent: null,
    applicationSource: "Walk-in", assignedReviewerId: null, submittedAt: d(0), updatedAt: d(0),
    internalNotes: "Started over the phone — applicant will finish the portal form tonight.",
    unitReservation: "None", proposedOccupants: 1, parkingRequired: "None requested",
    petInfo: "—",
    rentalPreferences: "Asked about furnished options.",
    completeness: 18,
  },
  {
    id: "app-12", applicationNumber: "APP-0012", status: "Archived", propertyId: "prp-1", unitId: "unt-3",
    requestedMoveInDate: d(-30), requestedLeaseTerm: 12, advertisedRent: 1345, proposedRent: null,
    applicationSource: "Listing Portal", assignedReviewerId: "stf-1", submittedAt: d(-42), updatedAt: d(-31),
    internalNotes: "Expired waitlist entry archived after 30 days of no contact. Records retained per policy.",
    unitReservation: "None", proposedOccupants: 1, parkingRequired: "None",
    petInfo: "—",
    rentalPreferences: "—",
    completeness: 100,
  },
];

export const parties: ApplicationParty[] = [
  /* APP-0001 — approved, lease created, household with co-applicant + occupant */
  party({ applicationId: "app-1", personId: "per-2", role: "Primary Applicant", isPrimary: true, fullName: "Devon Malik", email: "devon.malik@example.com", phone: "(971) 555-0188", currentAddress: "318 NW Everett St Apt 6, Portland, OR 97209", preferredContact: "Email", relationship: "Applicant", incomeMonthly: 6400, employment: "Providence Health — RN", screeningStatus: "Completed", requiredDocuments: ["Rental Application Form", "Proof of Income", "Identity Verification"], signatureStatus: "Signed", notes: "Verified employment 4/2026." }),
  party({ applicationId: "app-1", personId: "per-4", role: "Co-Applicant", fullName: "Tobias Lund", email: "tobias.lund@example.com", phone: "(360) 555-0173", currentAddress: "226 Grand Ave, Vancouver, WA 98660", preferredContact: "Phone", relationship: "Partner", incomeMonthly: 4100, employment: "Fred Meyer — Ops Lead", screeningStatus: "Completed", requiredDocuments: ["Rental Application Form", "Proof of Income"], signatureStatus: "Signed" }),
  party({ applicationId: "app-1", role: "Proposed Occupant", fullName: "Lila Malik", preferredContact: "Mail", relationship: "Daughter of primary applicant (age 7)", signatureRequired: false, signatureStatus: "Not Applicable", screeningStatus: "Not Applicable", email: "—", phone: "—" }),

  /* APP-0002 — under review, multiple co-applicants */
  party({ applicationId: "app-2", personId: "per-5", role: "Primary Applicant", isPrimary: true, fullName: "Priyanka Vaidya", email: "priyanka.vaidya@example.com", phone: "(503) 555-0164", currentAddress: "5408 N Vancouver Ave, Portland, OR 97217", preferredContact: "Text Message", relationship: "Applicant", incomeMonthly: 5800, employment: "Legacy Health — Analyst", screeningStatus: "In Progress", requiredDocuments: ["Rental Application Form", "Proof of Income", "Reference"], signatureStatus: "Signed" }),
  party({ applicationId: "app-2", personId: "per-6", role: "Co-Applicant", fullName: "Julian Reyes", email: "julian.reyes@example.com", phone: "(503) 555-0104", currentAddress: "77 Foundry St Apt 305, Portland, OR 97227", preferredContact: "Email", relationship: "Spouse", incomeMonthly: 3200, employment: "Self-employed — designer", screeningStatus: "Waiting for Information", requiredDocuments: ["Rental Application Form", "Proof of Income", "Employment Letter"], signatureStatus: "Sent", notes: "Needs 1099s + YTD profit & loss." }),
  party({ applicationId: "app-2", personId: "per-12", role: "Co-Applicant", fullName: "Owen Castellanos", email: "owen.castellanos@example.com", phone: "(971) 555-0161", currentAddress: "615 N Killingsworth St, Portland, OR 97217", preferredContact: "Email", relationship: "Household member", incomeMonthly: 2450, employment: "Powell's Books", screeningStatus: "In Progress", requiredDocuments: ["Rental Application Form"], signatureStatus: "Not Sent" }),
  party({ applicationId: "app-2", role: "Proposed Occupant", fullName: "Mateo Reyes", preferredContact: "Mail", relationship: "Son of primary applicant (age 11)", email: "—", phone: "—", signatureRequired: false, signatureStatus: "Not Applicable", screeningStatus: "Not Applicable" }),

  /* APP-0003 — under review, existing tenant (transfer) */
  party({ applicationId: "app-3", personId: "per-1", role: "Primary Applicant", isPrimary: true, fullName: "Amara Osei", preferredName: "Amy", email: "amara.osei@example.com", phone: "(503) 555-0142", currentAddress: "88 Willow Ct Apt 9, Lake Oswego, OR 97034", preferredContact: "Email", relationship: "Existing tenant (internal transfer)", incomeMonthly: 7100, employment: "Nike — Senior Planner", screeningStatus: "In Progress", requiredDocuments: ["Rental Application Form", "Reference"], signatureStatus: "Signed", notes: "Linked to tenant TEN-1042. No new tenant record required." }),

  /* APP-0004 — awaiting information */
  party({ applicationId: "app-4", personId: "per-7", role: "Primary Applicant", isPrimary: true, fullName: "Hana Sorensen", email: "hana.sorensen@example.com", phone: "(971) 555-0137", currentAddress: "4110 SE Division St, Portland, OR 97206", preferredContact: "Phone", relationship: "Applicant", incomeMonthly: 4600, employment: "OHSU — Coordinator", screeningStatus: "Waiting for Information", requiredDocuments: ["Rental Application Form", "Proof of Income", "Reference"], signatureStatus: "Signed" }),
  party({ applicationId: "app-4", personId: "per-8", role: "Co-Applicant", fullName: "Nathan Okonkwo", email: "nathan.okonkwo@example.com", phone: "(503) 555-0155", currentAddress: "1620 SW Jefferson St, Portland, OR 97201", preferredContact: "Email", relationship: "Partner", screeningStatus: "Waiting for Information", requiredDocuments: ["Rental Application Form", "Proof of Income", "Reference"], signatureStatus: "Not Sent", notes: "Landlord reference outstanding." }),

  /* APP-0005 — new */
  party({ applicationId: "app-5", personId: "per-11", role: "Primary Applicant", isPrimary: true, fullName: "Marisol Duarte", email: "marisol.duarte@example.com", phone: "(503) 555-0178", currentAddress: "2310 SE Belmont St, Portland, OR 97214", preferredContact: "Text Message", relationship: "Applicant", incomeMonthly: 5200, employment: "Providence — Medical Assistant", screeningStatus: "Not Started", requiredDocuments: ["Rental Application Form", "Proof of Income", "Identity Verification"], signatureStatus: "Not Sent" }),
  party({ applicationId: "app-5", role: "Proposed Occupant", fullName: "Camila Duarte", preferredContact: "Mail", relationship: "Daughter of primary applicant (age 4)", email: "—", phone: "—", signatureRequired: false, signatureStatus: "Not Applicable", screeningStatus: "Not Applicable" }),

  /* APP-0006 — waitlisted */
  party({ applicationId: "app-6", personId: "per-10", role: "Primary Applicant", isPrimary: true, fullName: "Gregor Halvorsen", email: "gregor.halvorsen@example.com", phone: "(360) 555-0192", currentAddress: "1409 Franklin St, Vancouver, WA 98660", preferredContact: "Email", relationship: "Applicant", incomeMonthly: 7600, employment: "Daimler Truck — Engineer", screeningStatus: "Completed", requiredDocuments: ["Rental Application Form", "Proof of Income"], signatureStatus: "Signed" }),
  party({ applicationId: "app-6", personId: "per-9", role: "Co-Applicant", fullName: "Elise Fontaine", email: "elise.fontaine@example.com", phone: "(503) 555-0126", currentAddress: "88 Willow Ct Apt 9, Lake Oswego, OR 97034", preferredContact: "Email", relationship: "Partner", incomeMonthly: 3900, employment: "Lewis & Clark — Admin", screeningStatus: "Completed", requiredDocuments: ["Rental Application Form", "Proof of Income"], signatureStatus: "Signed", notes: "Linked to tenant TEN-1188 — must be resolved before lease creation." }),

  /* APP-0007 — declined */
  party({ applicationId: "app-7", personId: "per-12", role: "Primary Applicant", isPrimary: true, fullName: "Owen Castellanos", email: "owen.castellanos@example.com", phone: "(971) 555-0161", currentAddress: "615 N Killingsworth St, Portland, OR 97217", preferredContact: "Email", relationship: "Applicant", screeningStatus: "Waiting for Information", requiredDocuments: ["Rental Application Form", "Proof of Income"], signatureStatus: "Signed" }),

  /* APP-0008 — withdrawn */
  party({ applicationId: "app-8", personId: "per-6", role: "Primary Applicant", isPrimary: true, fullName: "Julian Reyes", email: "julian.reyes@example.com", phone: "(503) 555-0104", currentAddress: "77 Foundry St Apt 305, Portland, OR 97227", preferredContact: "Email", relationship: "Applicant", screeningStatus: "In Progress", requiredDocuments: ["Rental Application Form"], signatureStatus: "Signed" }),

  /* APP-0009 — new, second application for the same unit as APP-0005's pool */
  party({ applicationId: "app-9", personId: "per-3", role: "Primary Applicant", isPrimary: true, fullName: "Rosalind Hart", preferredName: "Ros", email: "rosalind.hart@example.com", phone: "(503) 555-0119", currentAddress: "9011 SW Beaverton Hwy, Beaverton, OR 97005", preferredContact: "Phone", relationship: "Former tenant returning", incomeMonthly: 6100, employment: "Intel — Process Engineer", screeningStatus: "Not Started", requiredDocuments: ["Rental Application Form", "Proof of Income"], signatureStatus: "Signed", notes: "Linked to former tenant TEN-0977." }),

  /* APP-0010 — under review with co-applicants + occupant */
  party({ applicationId: "app-10", personId: "per-4", role: "Primary Applicant", isPrimary: true, fullName: "Tobias Lund", email: "tobias.lund@example.com", phone: "(360) 555-0173", currentAddress: "226 Grand Ave, Vancouver, WA 98660", preferredContact: "Phone", relationship: "Applicant", incomeMonthly: 4300, employment: "Fred Meyer — Ops Lead", screeningStatus: "In Progress", requiredDocuments: ["Rental Application Form", "Proof of Income"], signatureStatus: "Signed" }),
  party({ applicationId: "app-10", personId: "per-2", role: "Co-Applicant", fullName: "Devon Malik", email: "devon.malik@example.com", phone: "(971) 555-0188", currentAddress: "318 NW Everett St Apt 6, Portland, OR 97209", preferredContact: "Email", relationship: "Partner", incomeMonthly: 6400, employment: "Providence Health — RN", screeningStatus: "Completed", requiredDocuments: ["Rental Application Form", "Proof of Income"], signatureStatus: "Signed", notes: "Existing person record reused from APP-0001." }),
  party({ applicationId: "app-10", role: "Proposed Occupant", fullName: "Lila Malik", preferredContact: "Mail", relationship: "Daughter (age 7)", email: "—", phone: "—", signatureRequired: false, signatureStatus: "Not Applicable", screeningStatus: "Not Applicable" }),

  /* APP-0011 — draft */
  party({ applicationId: "app-11", personId: "per-7", role: "Primary Applicant", isPrimary: true, fullName: "Hana Sorensen", email: "hana.sorensen@example.com", phone: "(971) 555-0137", currentAddress: "4110 SE Division St, Portland, OR 97206", preferredContact: "Phone", relationship: "Applicant", screeningStatus: "Not Started", requiredDocuments: ["Rental Application Form"], signatureStatus: "Not Sent" }),

  /* APP-0012 — archived */
  party({ applicationId: "app-12", personId: "per-8", role: "Primary Applicant", isPrimary: true, fullName: "Nathan Okonkwo", email: "nathan.okonkwo@example.com", phone: "(503) 555-0155", currentAddress: "1620 SW Jefferson St, Portland, OR 97201", preferredContact: "Email", relationship: "Applicant", screeningStatus: "Not Applicable", requiredDocuments: ["Rental Application Form"], signatureStatus: "Signed" }),
];

/* -------------------------------- Documents ------------------------------- */

export const documents: ApplicationDocument[] = [
  /* APP-0001 — most complete set, includes a replaced version */
  doc({ applicationId: "app-1", applicationPartyId: "pty-1", title: "Signed Rental Application — Devon Malik", category: "Rental Application Form", fileName: "app-0001-devon-malik-signed.pdf", fileSize: 412_600, uploadedAt: d(-24), status: "Accepted", notes: "E-signature completed in applicant portal." }),
  doc({ applicationId: "app-1", applicationPartyId: "pty-2", title: "Signed Rental Application — Tobias Lund", category: "Rental Application Form", fileName: "app-0001-tobias-lund-signed.pdf", fileSize: 388_200, uploadedAt: d(-23), status: "Accepted" }),
  doc({ applicationId: "app-1", applicationPartyId: "pty-1", title: "Proof of Income — Pay Stubs (2 months)", category: "Proof of Income", fileName: "devon-malik-paystubs-mar-apr.pdf", fileSize: 1_240_000, uploadedAt: d(-22), uploadedBy: "Dana Whitfield", status: "Accepted", notes: "Verified against employer HR contact." }),
  doc({ applicationId: "app-1", applicationPartyId: "pty-2", title: "Proof of Income — Pay Stubs", category: "Proof of Income", fileName: "tobias-lund-paystubs.pdf", fileSize: 934_000, uploadedAt: d(-22), status: "Accepted" }),
  doc({ applicationId: "app-1", applicationPartyId: "pty-1", title: "Photo ID — Driver's License", category: "Identity Verification", fileName: "dm-license-front.jpg", fileType: "JPG", fileSize: 486_000, uploadedAt: d(-22), status: "Accepted" }),
  doc({ applicationId: "app-1", applicationPartyId: "pty-1", title: "Credit Authorization (Signed)", category: "Credit Authorization", fileName: "credit-auth-devon-malik.pdf", fileSize: 178_400, uploadedAt: d(-21), status: "Accepted", notes: "Authorization retained 5 years per policy." }),
  doc({ applicationId: "app-1", applicationPartyId: "pty-1", title: "Vet Records — Golden Retriever", category: "Supporting Document", fileName: "pet-vaccination-record.pdf", fileSize: 302_000, uploadedAt: d(-20), status: "Accepted" }),
  doc({
    applicationId: "app-1", applicationPartyId: "pty-2", title: "Employment Letter — Tobias Lund", category: "Employment Letter",
    fileName: "tobias-lund-employment-letter.pdf", fileSize: 220_000, uploadedAt: d(-19), status: "Archived",
    versionNumber: 2, previousVersionId: "doc-8-v1",
    uploadedBy: "Tobias Lund (Applicant portal)",
    notes: "Replaced: first letter was missing start date and HR signature.",
    versions: [
      { id: "doc-8-v1", versionNumber: 1, fileName: "employment-letter-scan.pdf", fileSize: 168_000, fileType: "PDF", uploadedAt: d(-23), uploadedBy: "Tobias Lund (Applicant portal)", notes: "Missing HR signature." },
      { id: "doc-8-v2", versionNumber: 2, fileName: "tobias-lund-employment-letter.pdf", fileSize: 220_000, fileType: "PDF", uploadedAt: d(-19), uploadedBy: "Tobias Lund (Applicant portal)", notes: "Signed by HR, start date included." },
    ],
  }),

  /* APP-0002 */
  doc({ applicationId: "app-2", applicationPartyId: "pty-4", title: "Rental Application — Priyanka Vaidya", category: "Rental Application Form", fileName: "app-0002-priyanka-vaidya.pdf", fileSize: 356_000, uploadedAt: d(-7), status: "Accepted" }),
  doc({ applicationId: "app-2", applicationPartyId: "pty-5", title: "Rental Application — Julian Reyes", category: "Rental Application Form", fileName: "app-0002-julian-reyes.pdf", fileSize: 341_000, uploadedAt: d(-7), status: "Accepted" }),
  doc({ applicationId: "app-2", applicationPartyId: "pty-4", title: "Pay Stubs — Legacy Health", category: "Proof of Income", fileName: "priyanka-paystubs-q1.pdf", fileSize: 1_020_000, uploadedAt: d(-6), status: "Under Review" }),
  doc({ applicationId: "app-2", applicationPartyId: "pty-5", title: "1099-NEC — 2025", category: "Proof of Income", fileName: "julian-reyes-1099-2025.pdf", fileSize: 214_000, uploadedAt: d(-4), status: "Under Review", notes: "Self-employed — needs YTD P&L to complete income review." }),
  doc({ applicationId: "app-2", applicationPartyId: "pty-6", title: "Rental Application — Owen Castellanos", category: "Rental Application Form", fileName: "app-0002-owen-castellanos.pdf", fileSize: 298_000, uploadedAt: d(-3), status: "Under Review" }),
  doc({ applicationId: "app-2", applicationPartyId: "pty-4", title: "Reference — Current Landlord", category: "Reference", fileName: "landlord-reference-nw-vancouver.pdf", fileSize: 156_000, uploadedAt: d(-2), uploadedBy: "Marcus Ibele", status: "Under Review", notes: "Landlord responded by phone; written form pending." }),
  doc({ applicationId: "app-2", applicationPartyId: "pty-5", title: "Proof of Income — Needs Replacement", category: "Proof of Income", fileName: "bank-statement-blurred.pdf", fileSize: 640_000, uploadedAt: d(-1), status: "Needs Replacement", notes: "Account numbers redacted too aggressively — dates unreadable." }),

  /* APP-0003 */
  doc({ applicationId: "app-3", applicationPartyId: "pty-8", title: "Transfer Request Form", category: "Rental Application Form", fileName: "internal-transfer-request.pdf", fileSize: 198_000, uploadedAt: d(-5), uploadedBy: "Amara Osei (Tenant portal)", status: "Accepted" }),
  doc({ applicationId: "app-3", applicationPartyId: "pty-8", title: "Proof of Income — Nike", category: "Proof of Income", fileName: "amara-osei-paystubs.pdf", fileSize: 878_000, uploadedAt: d(-4), status: "Accepted" }),
  doc({ applicationId: "app-3", applicationPartyId: "pty-8", title: "Reference — Current PM", category: "Reference", fileName: "reference-willow-court.pdf", fileSize: 142_000, uploadedAt: d(-3), uploadedBy: "Dana Whitfield", status: "Accepted", notes: "Zero late payments in 27 months." }),

  /* APP-0004 — missing items */
  doc({ applicationId: "app-4", applicationPartyId: "pty-9", title: "Rental Application — Hana Sorensen", category: "Rental Application Form", fileName: "app-0004-hana-sorensen.pdf", fileSize: 322_000, uploadedAt: d(-11), status: "Accepted" }),
  doc({ applicationId: "app-4", applicationPartyId: "pty-9", title: "Pay Stub — Most Recent", category: "Proof of Income", fileName: "hana-paystub-latest.pdf", fileSize: 268_000, uploadedAt: d(-10), status: "Under Review", notes: "Only one stub received; two required." }),
  doc({ applicationId: "app-4", applicationPartyId: "pty-10", title: "Rental Application — Nathan Okonkwo", category: "Rental Application Form", fileName: "app-0004-nathan-okonkwo.pdf", fileSize: 311_000, uploadedAt: d(-9), status: "Under Review" }),
  doc({ applicationId: "app-4", applicationPartyId: "pty-10", title: "Dog Vaccination Records", category: "Supporting Document", fileName: "dog-vaccinations.pdf", fileSize: 190_000, uploadedAt: d(-6), status: "Received" }),

  /* APP-0005 — new */
  doc({ applicationId: "app-5", applicationPartyId: "pty-12", title: "Rental Application — Marisol Duarte", category: "Rental Application Form", fileName: "app-0005-marisol-duarte.pdf", fileSize: 305_000, uploadedAt: d(0), status: "Received", notes: "Completed on a tablet during the tour." }),
  doc({ applicationId: "app-5", applicationPartyId: "pty-12", title: "Photo ID", category: "Identity Verification", fileName: "marisol-id.jpg", fileType: "JPG", fileSize: 512_000, uploadedAt: d(0), status: "Received" }),

  /* APP-0006 — waitlisted */
  doc({ applicationId: "app-6", applicationPartyId: "pty-14", title: "Rental Application — Gregor Halvorsen", category: "Rental Application Form", fileName: "app-0006-gregor-halvorsen.pdf", fileSize: 334_000, uploadedAt: d(-14), status: "Accepted" }),
  doc({ applicationId: "app-6", applicationPartyId: "pty-15", title: "Credit Authorization — Household", category: "Credit Authorization", fileName: "credit-auth-halvorsen-fontaine.pdf", fileSize: 168_000, uploadedAt: d(-13), status: "Accepted" }),
  doc({ applicationId: "app-6", applicationPartyId: "pty-14", title: "Offer Letter — Daimler Truck", category: "Employment Letter", fileName: "gregor-offer-letter.pdf", fileSize: 205_000, uploadedAt: d(-13), status: "Accepted" }),

  /* APP-0007 — declined */
  doc({ applicationId: "app-7", applicationPartyId: "pty-16", title: "Rental Application — Owen Castellanos", category: "Rental Application Form", fileName: "app-0007-owen-castellanos.pdf", fileSize: 289_000, uploadedAt: d(-19), status: "Accepted" }),
  doc({ applicationId: "app-7", applicationPartyId: "pty-16", title: "Income Verification Request (Unanswered)", category: "Other", fileName: "income-verification-request.pdf", fileSize: 96_000, uploadedAt: d(-15), uploadedBy: "Marcus Ibele", status: "Archived", notes: "Two requests sent, no response." }),

  /* APP-0008 — withdrawn */
  doc({ applicationId: "app-8", applicationPartyId: "pty-17", title: "Rental Application — Julian Reyes", category: "Rental Application Form", fileName: "app-0008-julian-reyes.pdf", fileSize: 274_000, uploadedAt: d(-9), status: "Archived" }),

  /* APP-0009 — new */
  doc({ applicationId: "app-9", applicationPartyId: "pty-18", title: "Rental Application — Rosalind Hart", category: "Rental Application Form", fileName: "app-0009-rosalind-hart.pdf", fileSize: 318_000, uploadedAt: d(-1), status: "Received" }),
  doc({ applicationId: "app-9", applicationPartyId: "pty-18", title: "Proof of Income — Intel", category: "Proof of Income", fileName: "rosalind-hart-paystubs.pdf", fileSize: 905_000, uploadedAt: d(-1), status: "Received" }),
  doc({ applicationId: "app-9", applicationPartyId: "pty-18", title: "Reference — Former Landlord", category: "Reference", fileName: "reference-cedar-row.pdf", fileSize: 138_000, uploadedAt: d(-1), status: "Received" }),

  /* APP-0010 */
  doc({ applicationId: "app-10", applicationPartyId: "pty-19", title: "Rental Application — Tobias Lund", category: "Rental Application Form", fileName: "app-0010-tobias-lund.pdf", fileSize: 296_000, uploadedAt: d(-3), status: "Under Review" }),
  doc({ applicationId: "app-10", applicationPartyId: "pty-20", title: "Proof of Income — Devon Malik", category: "Proof of Income", fileName: "devon-paystubs.pdf", fileSize: 1_110_000, uploadedAt: d(-2), status: "Under Review" }),
  doc({ applicationId: "app-10", applicationPartyId: "pty-20", title: "Credit Authorization — Devon Malik", category: "Credit Authorization", fileName: "credit-auth-devon-malik-app10.pdf", fileSize: 174_000, uploadedAt: d(-2), status: "Under Review" }),

  /* APP-0011 — draft, nearly empty */
  doc({ applicationId: "app-11", applicationPartyId: "pty-22", title: "Application Notes (Phone Intake)", category: "Other", fileName: "phone-intake-notes.pdf", fileSize: 84_000, uploadedAt: d(0), uploadedBy: "Priya Raman", status: "Received" }),

  /* APP-0012 — archived */
  doc({ applicationId: "app-12", applicationPartyId: "pty-23", title: "Rental Application — Nathan Okonkwo", category: "Rental Application Form", fileName: "app-0012-nathan-okonkwo.pdf", fileSize: 268_000, uploadedAt: d(-42), status: "Archived" }),
];

/* --------------------------------- Reviews -------------------------------- */

export const reviews: ApplicationReview[] = [
  { id: "rev-1", applicationId: "app-1", reviewerId: "stf-1", reviewType: "Completeness Check", status: "Completed", startedAt: d(-23), reviewedAt: d(-21), notes: "All required documents present." , followUpRequired: false },
  { id: "rev-2", applicationId: "app-1", reviewerId: "stf-1", reviewType: "Reference Check", status: "Completed", reviewedAt: d(-20), notes: "Prior landlord confirmed 24 months of on-time payments.", followUpRequired: false },
  { id: "rev-3", applicationId: "app-1", reviewerId: "stf-1", reviewType: "Employment & Income", status: "Completed", reviewedAt: d(-19), notes: "Combined income 3.3x rent.", followUpRequired: false },
  { id: "rev-4", applicationId: "app-1", reviewerId: "stf-1", reviewType: "Credit Check", status: "Completed", reviewedAt: d(-18), notes: "Written authorization on file. Results within policy thresholds.", followUpRequired: false },
  { id: "rev-5", applicationId: "app-1", reviewerId: "stf-4", reviewType: "Final Review", status: "Completed", reviewedAt: d(-17), notes: "Approved by regional director.", followUpRequired: false },

  { id: "rev-6", applicationId: "app-2", reviewerId: "stf-2", reviewType: "Completeness Check", status: "In Progress", startedAt: d(-6), notes: "Co-applicant Julian documents incomplete.", followUpRequired: true, followUpDate: d(2) },
  { id: "rev-7", applicationId: "app-2", reviewerId: "stf-2", reviewType: "Reference Check", status: "In Progress", startedAt: d(-3), notes: "Called current landlord, written form pending.", followUpRequired: true, followUpDate: d(3) },
  { id: "rev-8", applicationId: "app-2", reviewerId: "stf-2", reviewType: "Employment & Income", status: "Waiting for Information", startedAt: d(-4), notes: "Needs YTD P&L for self-employment income.", followUpRequired: true, followUpDate: d(1) },
  { id: "rev-9", applicationId: "app-2", reviewerId: "stf-2", reviewType: "Credit Check", status: "Not Started", followUpRequired: false },

  { id: "rev-10", applicationId: "app-3", reviewerId: "stf-1", reviewType: "Completeness Check", status: "Completed", startedAt: d(-4), reviewedAt: d(-3), notes: "Internal transfer — no new application fee.", followUpRequired: false },
  { id: "rev-11", applicationId: "app-3", reviewerId: "stf-1", reviewType: "Rental History", status: "Completed", reviewedAt: d(-2), notes: "TEN-1042 payment history clean; balance $0.", followUpRequired: false },
  { id: "rev-12", applicationId: "app-3", reviewerId: "stf-1", reviewType: "Final Review", status: "In Progress", startedAt: d(-1), notes: "Waiting on unit availability confirmation from maintenance.", followUpRequired: true, followUpDate: d(4) },

  { id: "rev-13", applicationId: "app-4", reviewerId: "stf-3", reviewType: "Completeness Check", status: "Waiting for Information", startedAt: d(-10), notes: "Missing second pay stub and co-applicant reference.", followUpRequired: true, followUpDate: d(-1) },
  { id: "rev-14", applicationId: "app-4", reviewerId: "stf-3", reviewType: "Reference Check", status: "Waiting for Information", startedAt: d(-7), notes: "Co-applicant landlord has not responded.", followUpRequired: true, followUpDate: d(2) },

  { id: "rev-15", applicationId: "app-9", reviewerId: "stf-3", reviewType: "Completeness Check", status: "Not Started", followUpRequired: false },
  { id: "rev-16", applicationId: "app-6", reviewerId: "stf-1", reviewType: "Final Review", status: "Completed", reviewedAt: d(-8), notes: "Qualified — waitlisted pending unit availability.", followUpRequired: false },
  { id: "rev-17", applicationId: "app-7", reviewerId: "stf-2", reviewType: "Employment & Income", status: "Waiting for Information", startedAt: d(-16), reviewedAt: d(-13), notes: "No response to verification requests.", followUpRequired: false },
  { id: "rev-18", applicationId: "app-10", reviewerId: "stf-1", reviewType: "Completeness Check", status: "In Progress", startedAt: d(-2), notes: "Initial document review underway.", followUpRequired: false },
];

/* ------------------------------- Activities ------------------------------- */

export const activities: ApplicationActivity[] = [
  act("app-1", "application_created", "Application created", d(-24), "Devon Malik (Applicant portal)", "Source: Website · Unit B-2 at Cedar Row Townhomes"),
  act("app-1", "co_applicant_added", "Co-applicant added — Tobias Lund", d(-24), "Devon Malik (Applicant portal)"),
  act("app-1", "applicant_added", "Proposed occupant added — Lila Malik", d(-24), "Devon Malik (Applicant portal)", "Recorded as an occupant, not an applicant."),
  act("app-1", "unit_selected", "Unit selected — Cedar Row Townhomes · B-2", d(-24), "Devon Malik (Applicant portal)"),
  act("app-1", "document_uploaded", "8 documents uploaded", d(-23), "Applicant portal", "Rental application forms, proof of income, ID, credit authorization, vet records"),
  act("app-1", "document_updated", "Employment Letter — Tobias Lund replaced with version 2", d(-19), "Tobias Lund (Applicant portal)"),
  act("app-1", "review_started", "Review started", d(-23), "Dana Whitfield"),
  act("app-1", "status_changed", "Status changed — New → Under Review", d(-23), "Dana Whitfield", "Completeness check passed."),
  act("app-1", "status_changed", "Status changed — Under Review → Approved", d(-17), "Elena Cruz", "Approved at $2,850/mo for a 12-month term with standard deposit."),
  act("app-1", "decision_recorded", "Decision recorded — Approved", d(-17), "Elena Cruz", "Confirmation #DEC-2026-0114"),
  act("app-1", "lease_created", "Lease created from application — LSE-2026-0031", d(-16), "Dana Whitfield", "Applicant person records linked to the lease; no duplicate tenant records created."),
  act("app-1", "status_changed", "Unit B-2 remained Vacant after approval", d(-16), "System", "Occupancy changes are driven by lease move-in, not application approval."),

  act("app-2", "application_created", "Application created", d(-7), "Priyanka Vaidya (Listing Portal)", "Source: Listing Portal · Unit 310 at Harborview Flats"),
  act("app-2", "co_applicant_added", "Co-applicants added — Julian Reyes, Owen Castellanos", d(-7), "Priyanka Vaidya (Listing Portal)"),
  act("app-2", "applicant_added", "Proposed occupant added — Mateo Reyes", d(-7), "Priyanka Vaidya (Listing Portal)"),
  act("app-2", "document_uploaded", "6 documents uploaded", d(-6), "Applicant portal"),
  act("app-2", "review_started", "Review started", d(-6), "Marcus Ibele"),
  act("app-2", "status_changed", "Status changed — New → Under Review", d(-6), "Marcus Ibele"),
  act("app-2", "document_updated", "Bank statement flagged as Needs Replacement", d(-1), "Marcus Ibele", "Redaction removed the statement dates."),
  act("app-2", "information_requested", "Information requested — YTD profit & loss and signed employment letter", d(-1), "Marcus Ibele", "Sent through the applicant portal (simulated in prototype)."),
  act("app-2", "communication_logged", "Phone call — discussed 18-month term request", d(-1), "Marcus Ibele", "Follow-up due in 2 days."),

  act("app-3", "application_created", "Application created (internal transfer)", d(-5), "Amara Osei (Tenant portal)", "Linked to existing tenant TEN-1042."),
  act("app-3", "unit_selected", "Unit selected — The Foundry Lofts · 402", d(-5), "Amara Osei (Tenant portal)"),
  act("app-3", "review_started", "Review started", d(-4), "Dana Whitfield"),
  act("app-3", "status_changed", "Status changed — New → Under Review", d(-4), "Dana Whitfield"),
  act("app-3", "document_uploaded", "Transfer request and reference uploaded", d(-3), "Dana Whitfield"),
  act("app-3", "review_note_added", "Review note added — Rental history verified", d(-2), "Dana Whitfield", "27 months of on-time payments, zero balance."),

  act("app-4", "application_created", "Application created", d(-11), "Hana Sorensen (Referral)"),
  act("app-4", "co_applicant_added", "Co-applicant added — Nathan Okonkwo", d(-11), "Hana Sorensen"),
  act("app-4", "review_started", "Review started", d(-10), "Priya Raman"),
  act("app-4", "status_changed", "Status changed — New → Under Review", d(-10), "Priya Raman"),
  act("app-4", "information_requested", "Information requested — 2nd pay stub and landlord reference", d(-4), "Priya Raman"),
  act("app-4", "status_changed", "Status changed — Under Review → Awaiting Information", d(-3), "Priya Raman", "Reminder sent to both applicants."),
  act("app-4", "communication_logged", "Email — document checklist reminder", d(-3), "Priya Raman", "Follow-up completed."),

  act("app-5", "application_created", "Application created", d(0), "Marisol Duarte (Walk-in)", "Manually entered by Dana Whitfield after the tour."),
  act("app-5", "applicant_added", "Proposed occupant added — Camila Duarte", d(0), "Dana Whitfield"),
  act("app-5", "document_uploaded", "2 documents uploaded at the leasing office", d(0), "Dana Whitfield", "Application form and photo ID."),

  act("app-6", "application_created", "Application created", d(-14), "Gregor Halvorsen (Website)"),
  act("app-6", "co_applicant_added", "Co-applicant added — Elise Fontaine", d(-14), "Gregor Halvorsen"),
  act("app-6", "review_started", "Review started", d(-12), "Dana Whitfield"),
  act("app-6", "status_changed", "Status changed — New → Under Review", d(-12), "Dana Whitfield"),
  act("app-6", "status_changed", "Status changed — Under Review → Waitlisted", d(-8), "Dana Whitfield", "Qualified, placed #1 on the waitlist for Unit C-1."),

  act("app-7", "application_created", "Application created", d(-19), "Owen Castellanos (Listing Portal)"),
  act("app-7", "review_started", "Review started", d(-17), "Marcus Ibele"),
  act("app-7", "status_changed", "Status changed — New → Under Review", d(-17), "Marcus Ibele"),
  act("app-7", "information_requested", "Information requested — income verification", d(-16), "Marcus Ibele"),
  act("app-7", "information_requested", "Second reminder sent", d(-14), "Marcus Ibele"),
  act("app-7", "status_changed", "Status changed — Under Review → Declined", d(-13), "Marcus Ibele", "Reason: unable to verify income after two documented requests."),
  act("app-7", "decision_recorded", "Decision recorded — Declined", d(-13), "Marcus Ibele", "Adverse action notice issued with applicant rights disclosure."),

  act("app-8", "application_created", "Application created", d(-9), "Julian Reyes (Website)"),
  act("app-8", "status_changed", "Status changed — New → Under Review", d(-8), "Priya Raman"),
  act("app-8", "status_changed", "Status changed — Under Review → Withdrawn", d(-4), "Julian Reyes", "Applicant relocated out of state."),

  act("app-9", "application_created", "Application created", d(-1), "Rosalind Hart (Website)", "Unit 204 at Harborview Flats — 2nd application for this unit."),
  act("app-9", "document_uploaded", "3 documents uploaded", d(-1), "Rosalind Hart (Applicant portal)"),
  act("app-9", "review_note_added", "Awaiting reviewer assignment", d(-1), "System"),

  act("app-10", "application_created", "Application created", d(-3), "Tobias Lund (Referral)"),
  act("app-10", "co_applicant_added", "Co-applicant added — Devon Malik", d(-3), "Tobias Lund", "Existing person record reused from APP-0001."),
  act("app-10", "review_started", "Review started", d(-2), "Dana Whitfield"),
  act("app-10", "status_changed", "Status changed — New → Under Review", d(-2), "Dana Whitfield"),
  act("app-10", "document_uploaded", "3 documents uploaded", d(-2), "Tobias Lund (Applicant portal)"),

  act("app-11", "application_created", "Draft application created", d(0), "Priya Raman", "Phone intake — applicant will finish in the portal."),
  act("app-11", "document_uploaded", "Phone intake notes attached", d(0), "Priya Raman"),

  act("app-12", "application_created", "Application created", d(-42), "Nathan Okonkwo (Listing Portal)"),
  act("app-12", "status_changed", "Status changed — New → Under Review", d(-40), "Dana Whitfield"),
  act("app-12", "status_changed", "Status changed — Under Review → Waitlisted", d(-35), "Dana Whitfield"),
  act("app-12", "status_changed", "Status changed — Waitlisted → Archived", d(-31), "Dana Whitfield", "No contact for 30 days. Records retained per retention policy."),
];

/* ------------------------------ Communications ---------------------------- */

export const communications: ApplicationCommunication[] = [
  { id: "com-1", applicationId: "app-2", applicationPartyId: "pty-4", contactMethod: "Phone Call", subject: "18-month term request", summary: "Confirmed household size and discussed the proposed $2,280 rent for an 18-month term. Applicant to send the P&L.", createdAt: d(-1), createdBy: "Marcus Ibele", followUpRequired: true, followUpDate: d(2), followUpStatus: "Open" },
  { id: "com-2", applicationId: "app-2", applicationPartyId: "pty-5", contactMethod: "Email", subject: "Document checklist", summary: "Emailed a list of outstanding items: signed employment letter and YTD profit & loss statement.", createdAt: d(-1), createdBy: "Marcus Ibele", followUpRequired: true, followUpDate: d(1), followUpStatus: "Open" },
  { id: "com-3", applicationId: "app-3", applicationPartyId: "pty-8", contactMethod: "In Person", subject: "Transfer walkthrough", summary: "Toured Loft 402 with the applicant. Confirm the current unit's move-out inspection date.", createdAt: d(-4), createdBy: "Dana Whitfield", followUpRequired: true, followUpDate: d(4), followUpStatus: "Open" },
  { id: "com-4", applicationId: "app-4", applicationPartyId: "pty-9", contactMethod: "Email", subject: "Outstanding documents", summary: "Sent the checklist: second pay stub, co-applicant landlord reference, and vaccination records.", createdAt: d(-3), createdBy: "Priya Raman", followUpRequired: true, followUpDate: d(-1), followUpStatus: "Overdue" },
  { id: "com-5", applicationId: "app-5", applicationPartyId: "pty-12", contactMethod: "In Person", subject: "Tour and paper application", summary: "Showed Unit 12; applicant completed the paper application on site and paid the screening fee.", createdAt: d(0), createdBy: "Dana Whitfield", followUpRequired: true, followUpDate: d(1), followUpStatus: "Open" },
  { id: "com-6", applicationId: "app-6", applicationPartyId: "pty-14", contactMethod: "Email", subject: "Waitlist position", summary: "Explained the waitlist position for Unit C-1 and offered comparable units at Cedar Row.", createdAt: d(-8), createdBy: "Dana Whitfield", followUpRequired: false, followUpStatus: "Completed" },
  { id: "com-7", applicationId: "app-7", applicationPartyId: "pty-16", contactMethod: "Letter", subject: "Adverse action notice", summary: "Mailed the adverse action notice with the consumer reporting agency's contact details.", createdAt: d(-13), createdBy: "Marcus Ibele", followUpRequired: false, followUpStatus: "Completed" },
  { id: "com-8", applicationId: "app-9", applicationPartyId: "pty-18", contactMethod: "Phone Call", subject: "Application received", summary: "Left a voicemail confirming receipt and next steps in the review process.", createdAt: d(-1), createdBy: "Priya Raman", followUpRequired: true, followUpDate: d(1), followUpStatus: "Open" },
  { id: "com-9", applicationId: "app-1", applicationPartyId: "pty-1", contactMethod: "Email", subject: "Approval and lease signing", summary: "Sent the approval summary and lease signing link. Keys scheduled for the move-in date.", createdAt: d(-16), createdBy: "Dana Whitfield", followUpRequired: false, followUpStatus: "Completed" },
];
