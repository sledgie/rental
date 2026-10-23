export type DocumentStatus = "active" | "archived";

export type CreationMethod = "system_generated" | "manual_upload" | "imported";

export interface RecordReference {
  module: string;
  recordType: string;
  recordId: string;
  recordLabel: string;
}

export interface RelatedRecord extends RecordReference {
  relationshipType?: string;
}

export interface EntityReference {
  entityType: string;
  entityId: string;
  entityLabel: string;
}

export interface DocumentActivity {
  id: string;
  action: string;
  at: string;
  actor: string;
  detail?: string;
}

export interface DocumentRecord {
  id: string;
  name: string;
  documentType: string;
  category: string;
  originModule: string;
  creationMethod: CreationMethod;
  primaryRecord: RecordReference | null;
  relatedRecords: RelatedRecord[];
  relatedEntities: EntityReference[];
  file: {
    fileName: string;
    extension: string;
    mimeType?: string;
    sizeBytes?: number;
    localPreviewUrl?: string;
    /** where the file is stored (Supabase Storage) */
    bucket?: string;
    path?: string;
  };
  description?: string;
  tags: string[];
  status: DocumentStatus;
  createdAt: string;
  createdBy: string;
  updatedAt?: string;
  updatedBy?: string;
  activity: DocumentActivity[];
}

export interface MockBusinessRecord {
  reference: RecordReference;
  description: string;
  relatedEntities: EntityReference[];
}

export const originModuleRegistry = [
  { name: "Payments", example: "Receipts and confirmations" },
  { name: "Leases", example: "Agreements, addenda and renewals" },
  { name: "Tenants", example: "Identification and correspondence" },
  { name: "Applications", example: "Applications and screening files" },
  { name: "Invoicing", example: "Invoices and credit notes" },
  { name: "Properties", example: "Deeds and insurance" },
  { name: "Units", example: "Unit photographs and attachments" },
  { name: "Maintenance", example: "Work orders and repair photos" },
  { name: "Inspections", example: "Reports and checklists" },
  { name: "Vendors", example: "Contracts and certificates" },
  { name: "Expenses", example: "Receipts and supporting invoices" },
  { name: "Accounting", example: "Statements and reconciliations" },
  { name: "Reports", example: "Generated operational reports" },
  { name: "Manual Upload", example: "Documents with no owning module" },
] as const;

export const documentTypeOptions = [
  "Payment receipt",
  "Lease agreement",
  "Lease addendum",
  "Identification",
  "Invoice",
  "Maintenance photo",
  "Inspection report",
  "Vendor invoice",
  "Bank statement",
  "Insurance policy",
  "Expense receipt",
  "Rental application",
  "Operational report",
  "Property deed",
  "Vendor certificate",
  "Supporting document",
];

export const categoryOptions = [
  "Accounting",
  "Applications",
  "Financial",
  "General",
  "Identity & compliance",
  "Lease & tenancy",
  "Maintenance",
  "Operations",
  "Property records",
  "Vendor records",
];

export const creationMethodLabels: Record<CreationMethod, string> = {
  system_generated: "System-generated",
  manual_upload: "Manual upload",
  imported: "Imported",
};

export const documentStatuses: Record<DocumentStatus, string> = {
  active: "Active",
  archived: "Archived",
};

const ago = (days: number, hour = 10) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(hour, 18, 0, 0);
  return date.toISOString();
};

const entity = (entityType: string, entityId: string, entityLabel: string): EntityReference => ({
  entityType,
  entityId,
  entityLabel,
});

const makeRecord = (
  module: string,
  recordType: string,
  recordId: string,
  recordLabel: string,
  description: string,
  relatedEntities: EntityReference[] = [],
): MockBusinessRecord => ({
  reference: { module, recordType, recordId, recordLabel },
  description,
  relatedEntities,
});

const tenants = {
  elena: entity("Tenant", "TEN-1042", "Elena Marquez"),
  marco: entity("Tenant", "TEN-1110", "Marco Ruiz"),
  aisha: entity("Tenant", "TEN-1088", "Aisha Campbell"),
  noah: entity("Tenant", "TEN-1029", "Noah Bennett"),
};

const properties = {
  meridian: entity("Property", "PROP-014", "Meridian House"),
  alder: entity("Property", "PROP-029", "Alder Court"),
};

const units = {
  fourB: entity("Unit", "UNIT-4B", "Unit 4B"),
  fourC: entity("Unit", "UNIT-4C", "Unit 4C"),
  twoA: entity("Unit", "UNIT-2A", "Unit 2A"),
  twoB: entity("Unit", "UNIT-2B", "Unit 2B"),
};

const vendors = {
  northline: entity("Vendor", "VEN-021", "Northline Plumbing"),
  lockworks: entity("Vendor", "VEN-032", "Lockworks Co."),
};

const meridianEntities = [properties.meridian, units.fourB];
const fourCEntities = [properties.meridian, units.fourC];

export const mockBusinessRecords: MockBusinessRecord[] = [
  makeRecord("Payments", "Payment", "PAY-0042", "May rent payment · Elena Marquez", "Rent payment received on 1 June 2026, allocated across three open invoices.", [tenants.elena, properties.meridian, units.fourB]),
  makeRecord("Payments", "Payment", "PAY-0041", "April rent payment · Marco Ruiz", "April rent payment received and reconciled.", [tenants.marco, properties.alder, units.twoA]),
  makeRecord("Payments", "Payment", "PAY-0038", "Security deposit · Aisha Campbell", "Security deposit received for the new tenancy.", [tenants.aisha, properties.alder, units.twoB]),
  makeRecord("Leases", "Lease", "LSE-0088", "Meridian House · Units 4B and 4C", "A joint lease for Elena Marquez and Marco Ruiz, covering two units.", [tenants.elena, tenants.marco, properties.meridian, units.fourB, units.fourC]),
  makeRecord("Leases", "Lease", "LSE-0086", "Alder Court · Unit 2A", "Residential lease for Marco Ruiz at Alder Court.", [tenants.marco, properties.alder, units.twoA]),
  makeRecord("Leases", "Lease", "LSE-0079", "Alder Court · Unit 2B", "Residential lease for Aisha Campbell at Alder Court.", [tenants.aisha, properties.alder, units.twoB]),
  makeRecord("Tenants", "Tenant", "TEN-1042", "Elena Marquez", "Tenant profile for Elena Marquez, resident at Meridian House.", [tenants.elena, properties.meridian, units.fourB]),
  makeRecord("Tenants", "Tenant", "TEN-1110", "Marco Ruiz", "Tenant profile for Marco Ruiz, resident at Meridian House and Alder Court.", [tenants.marco, properties.meridian, properties.alder, units.fourC, units.twoA]),
  makeRecord("Tenants", "Tenant", "TEN-1088", "Aisha Campbell", "Tenant profile for Aisha Campbell at Alder Court.", [tenants.aisha, properties.alder, units.twoB]),
  makeRecord("Tenants", "Tenant", "TEN-1029", "Noah Bennett", "Tenant profile for Noah Bennett at Meridian House.", [tenants.noah, properties.meridian, units.fourC]),
  makeRecord("Applications", "Application", "APP-0276", "Application · Noah Bennett", "Rental application for Unit 4C at Meridian House.", [tenants.noah, properties.meridian, units.fourC]),
  makeRecord("Applications", "Application", "APP-0272", "Application · Aisha Campbell", "Rental application for Unit 2B at Alder Court.", [tenants.aisha, properties.alder, units.twoB]),
  makeRecord("Invoicing", "Invoice", "INV-1001", "May rent · Unit 4B", "May rent invoice for Unit 4B at Meridian House.", [tenants.elena, properties.meridian, units.fourB]),
  makeRecord("Invoicing", "Invoice", "INV-1002", "Utilities · Unit 4B", "Shared utility invoice for Unit 4B at Meridian House.", [tenants.elena, properties.meridian, units.fourB]),
  makeRecord("Invoicing", "Invoice", "INV-1003", "Parking · Unit 4B", "Monthly parking invoice linked to Unit 4B.", [tenants.elena, properties.meridian, units.fourB]),
  makeRecord("Invoicing", "Invoice", "INV-1004", "April rent · Unit 2A", "April rent invoice for Unit 2A at Alder Court.", [tenants.marco, properties.alder, units.twoA]),
  makeRecord("Invoicing", "Invoice", "INV-1007", "Plumbing repair · Meridian House", "Vendor invoice for a completed plumbing repair.", [properties.meridian, units.fourB, vendors.northline]),
  makeRecord("Properties", "Property", "PROP-014", "Meridian House", "Multi-unit residential property at 18 Meridian Avenue.", [properties.meridian]),
  makeRecord("Properties", "Property", "PROP-029", "Alder Court", "Residential property at 42 Alder Street.", [properties.alder]),
  makeRecord("Units", "Unit", "UNIT-4B", "Meridian House · Unit 4B", "Two-bedroom apartment on the fourth floor.", meridianEntities),
  makeRecord("Units", "Unit", "UNIT-4C", "Meridian House · Unit 4C", "One-bedroom apartment on the fourth floor.", fourCEntities),
  makeRecord("Units", "Unit", "UNIT-2A", "Alder Court · Unit 2A", "Two-bedroom apartment on the second floor.", [properties.alder, units.twoA]),
  makeRecord("Units", "Unit", "UNIT-2B", "Alder Court · Unit 2B", "One-bedroom apartment on the second floor.", [properties.alder, units.twoB]),
  makeRecord("Maintenance", "Work order", "WO-3108", "Kitchen sink repair · Unit 4B", "Completed plumbing work order for a leaking kitchen sink.", [properties.meridian, units.fourB, vendors.northline]),
  makeRecord("Maintenance", "Work order", "WO-3093", "Front entry lock · Unit 2A", "Lock replacement at Alder Court.", [properties.alder, units.twoA, vendors.lockworks]),
  makeRecord("Inspections", "Inspection", "INS-2041", "Move-in inspection · Unit 4B", "Completed move-in inspection for Meridian House Unit 4B.", [tenants.elena, properties.meridian, units.fourB]),
  makeRecord("Vendors", "Vendor", "VEN-021", "Northline Plumbing", "Approved plumbing vendor for Meridian House.", [vendors.northline, properties.meridian]),
  makeRecord("Vendors", "Vendor", "VEN-032", "Lockworks Co.", "Approved locksmith and door hardware vendor.", [vendors.lockworks, properties.alder]),
  makeRecord("Vendors", "Vendor bill", "VBL-0219", "April plumbing invoice · Northline Plumbing", "Vendor bill imported for the Unit 4B kitchen repair.", [vendors.northline, properties.meridian, units.fourB]),
  makeRecord("Expenses", "Expense", "EXP-0117", "Plumbing repair · Unit 4B", "Property expense for the completed kitchen sink repair.", [properties.meridian, units.fourB, vendors.northline]),
  makeRecord("Accounting", "Accounting period", "ACC-2026-APR", "April 2026 reconciliation", "Monthly bank reconciliation and supporting statement.", [properties.meridian, properties.alder]),
  makeRecord("Reports", "Report", "RPT-2026-05", "May operations summary", "Portfolio operations and occupancy summary for May 2026.", [properties.meridian, properties.alder]),
  makeRecord("Reports", "Report", "RPT-2026-Q1", "Q1 financial overview", "First-quarter income and expense overview.", [properties.meridian, properties.alder]),
];

const record = (module: string, recordId: string) =>
  mockBusinessRecords.find(
    (item) => item.reference.module === module && item.reference.recordId === recordId,
  )!.reference;

const registryRecord = (
  module: string,
  recordId: string,
  relationshipType: string,
): RelatedRecord => ({ ...record(module, recordId), relationshipType });

const makeActivity = (
  id: string,
  action: string,
  at: string,
  actor: string,
  detail?: string,
): DocumentActivity => ({ id, action, at, actor, detail });

function seedDocument(
  input: Omit<DocumentRecord, "activity">,
): DocumentRecord {
  const eventTime = input.createdAt;
  const methodEvent = {
    system_generated: "System-generated file registered",
    manual_upload: "File manually uploaded",
    imported: "File imported into the registry",
  }[input.creationMethod];
  const activity: DocumentActivity[] = [
    makeActivity(`${input.id}-created`, "Document record created", eventTime, input.createdBy),
    makeActivity(`${input.id}-source`, methodEvent, eventTime, input.createdBy),
  ];

  if (input.primaryRecord) {
    activity.push(
      makeActivity(
        `${input.id}-primary-link`,
        "Linked to primary record",
        eventTime,
        input.createdBy,
        `${input.primaryRecord.module} · ${input.primaryRecord.recordId}`,
      ),
    );
  }
  if (input.relatedRecords.length > 0) {
    activity.push(
      makeActivity(
        `${input.id}-related-links`,
        "Related records linked",
        eventTime,
        input.createdBy,
        `${input.relatedRecords.length} additional record${input.relatedRecords.length === 1 ? "" : "s"}`,
      ),
    );
  }
  if (input.updatedAt && input.updatedBy) {
    activity.push(
      makeActivity(`${input.id}-updated`, "Metadata updated", input.updatedAt, input.updatedBy),
    );
  }
  if (input.status === "archived") {
    activity.push(
      makeActivity(
        `${input.id}-archived`,
        "Document archived",
        input.updatedAt ?? input.createdAt,
        input.updatedBy ?? input.createdBy,
      ),
    );
  }

  return { ...input, activity };
}

const pdf = (fileName: string, sizeBytes: number) => ({
  fileName,
  extension: "pdf",
  mimeType: "application/pdf",
  sizeBytes,
});

const image = (fileName: string, sizeBytes: number) => ({
  fileName,
  extension: "jpg",
  mimeType: "image/jpeg",
  sizeBytes,
});

export const initialDocuments: DocumentRecord[] = [
  seedDocument({
    id: "DOC-10482",
    name: "May rent payment receipt",
    documentType: "Payment receipt",
    category: "Financial",
    originModule: "Payments",
    creationMethod: "system_generated",
    primaryRecord: record("Payments", "PAY-0042"),
    relatedRecords: [
      registryRecord("Invoicing", "INV-1001", "Payment allocation"),
      registryRecord("Invoicing", "INV-1002", "Payment allocation"),
      registryRecord("Invoicing", "INV-1003", "Payment allocation"),
    ],
    relatedEntities: [tenants.elena, properties.meridian, units.fourB],
    file: pdf("receipt-PAY-0042.pdf", 121856),
    description: "Receipt for the May rent payment, allocated across three invoices.",
    tags: ["rent", "receipt", "may 2026"],
    status: "active",
    createdAt: ago(2, 9),
    createdBy: "Payments automation",
  }),
  seedDocument({
    id: "DOC-10479",
    name: "Signed residential lease",
    documentType: "Lease agreement",
    category: "Lease & tenancy",
    originModule: "Leases",
    creationMethod: "manual_upload",
    primaryRecord: record("Leases", "LSE-0088"),
    relatedRecords: [
      registryRecord("Tenants", "TEN-1042", "Named tenant"),
      registryRecord("Tenants", "TEN-1110", "Named tenant"),
      registryRecord("Units", "UNIT-4B", "Leased unit"),
      registryRecord("Units", "UNIT-4C", "Leased unit"),
      registryRecord("Properties", "PROP-014", "Property"),
    ],
    relatedEntities: [tenants.elena, tenants.marco, properties.meridian, units.fourB, units.fourC],
    file: pdf("lease-LSE-0088-signed.pdf", 2488320),
    description: "Executed lease for two tenants and two units at Meridian House.",
    tags: ["signed", "2026", "joint lease"],
    status: "active",
    createdAt: ago(4, 14),
    createdBy: "Alex Morgan",
  }),
  seedDocument({
    id: "DOC-10472",
    name: "Tenant identification - Elena Marquez",
    documentType: "Identification",
    category: "Identity & compliance",
    originModule: "Tenants",
    creationMethod: "manual_upload",
    primaryRecord: record("Tenants", "TEN-1042"),
    relatedRecords: [registryRecord("Leases", "LSE-0088", "Tenant lease")],
    relatedEntities: [tenants.elena, properties.meridian, units.fourB],
    file: image("elena-marquez-id.jpg", 682114),
    description: "Identity document submitted during tenant onboarding. Mock metadata only; source image is not stored.",
    tags: ["sensitive", "onboarding"],
    status: "active",
    createdAt: ago(6, 11),
    createdBy: "Sofia Chen",
  }),
  seedDocument({
    id: "DOC-10468",
    name: "May rent invoice - Unit 4B",
    documentType: "Invoice",
    category: "Financial",
    originModule: "Invoicing",
    creationMethod: "system_generated",
    primaryRecord: record("Invoicing", "INV-1001"),
    relatedRecords: [registryRecord("Payments", "PAY-0042", "Settled by payment")],
    relatedEntities: [tenants.elena, properties.meridian, units.fourB],
    file: pdf("invoice-INV-1001.pdf", 96640),
    description: "Monthly rent invoice for May 2026.",
    tags: ["invoice", "rent"],
    status: "active",
    createdAt: ago(8, 8),
    createdBy: "Invoicing automation",
  }),
  seedDocument({
    id: "DOC-10461",
    name: "Kitchen sink repair photos",
    documentType: "Maintenance photo",
    category: "Maintenance",
    originModule: "Maintenance",
    creationMethod: "manual_upload",
    primaryRecord: record("Maintenance", "WO-3108"),
    relatedRecords: [registryRecord("Units", "UNIT-4B", "Affected unit")],
    relatedEntities: [properties.meridian, units.fourB, vendors.northline],
    file: image("WO-3108-kitchen-repair.jpg", 1873408),
    description: "Before-and-after photographs attached to the completed work order. Mock metadata only.",
    tags: ["repair", "plumbing", "before and after"],
    status: "active",
    createdAt: ago(11, 16),
    createdBy: "Maintenance team",
  }),
  seedDocument({
    id: "DOC-10456",
    name: "Move-in inspection report - Unit 4B",
    documentType: "Inspection report",
    category: "Operations",
    originModule: "Inspections",
    creationMethod: "system_generated",
    primaryRecord: record("Inspections", "INS-2041"),
    relatedRecords: [registryRecord("Units", "UNIT-4B", "Inspected unit")],
    relatedEntities: [tenants.elena, properties.meridian, units.fourB],
    file: pdf("inspection-INS-2041.pdf", 734208),
    description: "Completed move-in inspection checklist and summary.",
    tags: ["move-in", "inspection"],
    status: "active",
    createdAt: ago(14, 13),
    createdBy: "Inspection workflow",
  }),
  seedDocument({
    id: "DOC-10449",
    name: "Northline Plumbing vendor invoice",
    documentType: "Vendor invoice",
    category: "Vendor records",
    originModule: "Vendors",
    creationMethod: "imported",
    primaryRecord: record("Vendors", "VBL-0219"),
    relatedRecords: [
      registryRecord("Expenses", "EXP-0117", "Recorded as expense"),
      registryRecord("Invoicing", "INV-1007", "Supporting customer invoice"),
    ],
    relatedEntities: [vendors.northline, properties.meridian, units.fourB],
    file: pdf("northline-invoice-apr-2026.pdf", 192512),
    description: "Imported vendor invoice for the Unit 4B plumbing repair.",
    tags: ["vendor", "plumbing", "imported"],
    status: "active",
    createdAt: ago(19, 10),
    createdBy: "Accounting import",
  }),
  seedDocument({
    id: "DOC-10434",
    name: "April 2026 bank statement",
    documentType: "Bank statement",
    category: "Accounting",
    originModule: "Accounting",
    creationMethod: "imported",
    primaryRecord: record("Accounting", "ACC-2026-APR"),
    relatedRecords: [],
    relatedEntities: [properties.meridian, properties.alder],
    file: pdf("bank-statement-2026-04.pdf", 402653),
    description: "Bank statement imported for the April 2026 reconciliation.",
    tags: ["bank", "reconciliation", "april 2026"],
    status: "active",
    createdAt: ago(25, 9),
    createdBy: "Jordan Lee",
  }),
  seedDocument({
    id: "DOC-10431",
    name: "Lease addendum - parking allocation",
    documentType: "Lease addendum",
    category: "Lease & tenancy",
    originModule: "Leases",
    creationMethod: "manual_upload",
    primaryRecord: record("Leases", "LSE-0088"),
    relatedRecords: [
      registryRecord("Tenants", "TEN-1042", "Named tenant"),
      registryRecord("Tenants", "TEN-1110", "Named tenant"),
      registryRecord("Units", "UNIT-4B", "Leased unit"),
      registryRecord("Units", "UNIT-4C", "Leased unit"),
    ],
    relatedEntities: [tenants.elena, tenants.marco, properties.meridian, units.fourB, units.fourC],
    file: pdf("lease-addendum-LSE-0088.pdf", 376832),
    description: "Signed addendum covering the shared parking allocation.",
    tags: ["addendum", "parking", "signed"],
    status: "active",
    createdAt: ago(32, 15),
    createdBy: "Alex Morgan",
  }),
  seedDocument({
    id: "DOC-10422",
    name: "Property insurance certificate - Meridian House",
    documentType: "Insurance policy",
    category: "Property records",
    originModule: "Properties",
    creationMethod: "manual_upload",
    primaryRecord: record("Properties", "PROP-014"),
    relatedRecords: [],
    relatedEntities: [properties.meridian],
    file: pdf("meridian-house-insurance-2026.pdf", 563200),
    description: "Current property insurance certificate on file.",
    tags: ["insurance", "renewal 2026"],
    status: "active",
    createdAt: ago(38, 12),
    createdBy: "Sofia Chen",
  }),
  seedDocument({
    id: "DOC-10418",
    name: "Plumbing repair expense receipt",
    documentType: "Expense receipt",
    category: "Financial",
    originModule: "Expenses",
    creationMethod: "imported",
    primaryRecord: record("Expenses", "EXP-0117"),
    relatedRecords: [registryRecord("Vendors", "VEN-021", "Service provider")],
    relatedEntities: [vendors.northline, properties.meridian, units.fourB],
    file: pdf("receipt-EXP-0117.pdf", 147456),
    description: "Supporting receipt for the Unit 4B maintenance expense.",
    tags: ["expense", "receipt"],
    status: "active",
    createdAt: ago(42, 10),
    createdBy: "Accounting import",
  }),
  seedDocument({
    id: "DOC-10407",
    name: "Rental application - Noah Bennett",
    documentType: "Rental application",
    category: "Applications",
    originModule: "Applications",
    creationMethod: "manual_upload",
    primaryRecord: record("Applications", "APP-0276"),
    relatedRecords: [registryRecord("Units", "UNIT-4C", "Requested unit")],
    relatedEntities: [tenants.noah, properties.meridian, units.fourC],
    file: pdf("application-APP-0276.pdf", 1024000),
    description: "Application materials submitted for Unit 4C.",
    tags: ["application", "screening"],
    status: "active",
    createdAt: ago(47, 11),
    createdBy: "Leasing team",
  }),
  seedDocument({
    id: "DOC-10398",
    name: "May operations summary",
    documentType: "Operational report",
    category: "Operations",
    originModule: "Reports",
    creationMethod: "system_generated",
    primaryRecord: record("Reports", "RPT-2026-05"),
    relatedRecords: [],
    relatedEntities: [properties.meridian, properties.alder],
    file: pdf("operations-summary-2026-05.pdf", 884736),
    description: "Monthly occupancy, maintenance and leasing summary for the portfolio.",
    tags: ["monthly report", "operations"],
    status: "active",
    createdAt: ago(54, 8),
    createdBy: "Reporting service",
  }),
  seedDocument({
    id: "DOC-10382",
    name: "Vendor liability certificate - Lockworks",
    documentType: "Vendor certificate",
    category: "Vendor records",
    originModule: "Vendors",
    creationMethod: "manual_upload",
    primaryRecord: record("Vendors", "VEN-032"),
    relatedRecords: [],
    relatedEntities: [vendors.lockworks, properties.alder],
    file: pdf("lockworks-liability-certificate.pdf", 315392),
    description: "Prior vendor certificate retained for reference.",
    tags: ["vendor", "certificate", "expired"],
    status: "archived",
    createdAt: ago(83, 14),
    createdBy: "Jordan Lee",
    updatedAt: ago(12, 15),
    updatedBy: "Alex Morgan",
  }),
  seedDocument({
    id: "DOC-10370",
    name: "Utility rebate correspondence",
    documentType: "Supporting document",
    category: "General",
    originModule: "Manual Upload",
    creationMethod: "manual_upload",
    primaryRecord: null,
    relatedRecords: [],
    relatedEntities: [],
    file: pdf("utility-rebate-correspondence.pdf", 206848),
    description: "Unlinked correspondence retained in the central document registry.",
    tags: ["utility", "unlinked"],
    status: "active",
    createdAt: ago(91, 10),
    createdBy: "Alex Morgan",
  }),
  seedDocument({
    id: "DOC-10354",
    name: "April rent payment confirmation",
    documentType: "Payment receipt",
    category: "Financial",
    originModule: "Payments",
    creationMethod: "system_generated",
    primaryRecord: record("Payments", "PAY-0041"),
    relatedRecords: [registryRecord("Invoicing", "INV-1004", "Payment allocation")],
    relatedEntities: [tenants.marco, properties.alder, units.twoA],
    file: pdf("receipt-PAY-0041.pdf", 119808),
    description: "Receipt for the April rent payment.",
    tags: ["rent", "receipt", "april 2026"],
    status: "active",
    createdAt: ago(103, 9),
    createdBy: "Payments automation",
  }),
  seedDocument({
    id: "DOC-10342",
    name: "Unit 4B listing photographs",
    documentType: "Supporting document",
    category: "Property records",
    originModule: "Units",
    creationMethod: "manual_upload",
    primaryRecord: record("Units", "UNIT-4B"),
    relatedRecords: [registryRecord("Properties", "PROP-014", "Parent property")],
    relatedEntities: [properties.meridian, units.fourB],
    file: image("UNIT-4B-listing-photo.jpg", 2465792),
    description: "Listing photographs for Unit 4B. Mock metadata only; source image is not stored.",
    tags: ["unit photos", "listing"],
    status: "active",
    createdAt: ago(129, 13),
    createdBy: "Leasing team",
  }),
  seedDocument({
    id: "DOC-10311",
    name: "Alder Court property deed",
    documentType: "Property deed",
    category: "Property records",
    originModule: "Properties",
    creationMethod: "imported",
    primaryRecord: record("Properties", "PROP-029"),
    relatedRecords: [],
    relatedEntities: [properties.alder],
    file: pdf("alder-court-deed.pdf", 1368064),
    description: "Property deed imported into the property records archive.",
    tags: ["deed", "ownership"],
    status: "active",
    createdAt: ago(166, 11),
    createdBy: "Portfolio import",
  }),
];

export const allEntityOptions = [tenants.elena, tenants.marco, tenants.aisha, tenants.noah, properties.meridian, properties.alder, units.fourB, units.fourC, units.twoA, units.twoB, vendors.northline, vendors.lockworks];

export const mockActor = "Alex Morgan";
