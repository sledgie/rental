export type ISODate = string;

export type ProjectType =
  | "Renovation"
  | "Repair"
  | "Maintenance"
  | "Upgrade"
  | "Restoration"
  | "Other";

export type Priority = "Low" | "Normal" | "High" | "Emergency";

export type ProjectStatus =
  | "Draft"
  | "Planned"
  | "Approved"
  | "In Progress"
  | "On Hold"
  | "Completed"
  | "Cancelled";

export type TaskStatus = "Not Started" | "In Progress" | "Blocked" | "Completed";
export type WorkCategory =
  | "Demolition"
  | "Electrical"
  | "Plumbing"
  | "Painting"
  | "Flooring"
  | "Kitchen"
  | "Bathroom"
  | "Cleanup"
  | "Inspection"
  | "General";

export type ApprovalStatus =
  | "Draft"
  | "Pending Approval"
  | "Approved"
  | "Rejected"
  | "Cancelled";

export type PaymentStatus = "Unpaid" | "Partially Paid" | "Paid" | "Overdue";
export type Occupancy = "Occupied" | "Vacant" | "Vacating" | "Ready for rent";
export type PaymentMethod = "EFT" | "Cheque" | "Credit Card" | "Cash" | "Wire Transfer";

export type ExpenseCategory =
  | "Labor"
  | "Materials"
  | "Plumbing & Electrical Supplies"
  | "Equipment Rental"
  | "Permits & Inspections"
  | "Contractor Services"
  | "Delivery & Transportation"
  | "Waste Removal"
  | "Other";

export type DocumentCategory =
  | "Photo"
  | "Quote"
  | "Contract"
  | "Purchase Order"
  | "Invoice"
  | "Receipt"
  | "Permit"
  | "Inspection Report"
  | "Change Order"
  | "Warranty"
  | "Product Manual"
  | "Proof of Payment"
  | "Other";

export type MilestoneStatus = "Pending" | "In Progress" | "Completed";
export type InspectionResult = "Scheduled" | "Pass" | "Fail" | "Conditional";
export type DeficiencyStatus = "Open" | "In Progress" | "Resolved" | "Verified";

export interface Unit {
  id: string;
  propertyId: string;
  number: string;
  beds: number;
  baths: number;
  sqft: number;
  marketRentCents: number;
  occupancy: Occupancy;
  tenantName?: string;
  leaseEnd?: ISODate;
}

export interface Property {
  id: string;
  name: string;
  address: string;
  city: string;
  image: string;
  propertyType: string;
  yearBuilt: number;
  units: Unit[];
}

export interface Contractor {
  id: string;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  trade: string;
  license: string;
  insuranceProvider: string;
  insuranceExpiry: ISODate;
  wsib: string;
  wsibExpiry: ISODate;
  pricingModel: "Fixed Price" | "Hourly" | "Daily" | "Cost Plus";
  agreedRate: string;
  paymentTerms: string;
  notes: string;
  active: boolean;
  rating: number;
  workers: { name: string; role: string; phone?: string }[];
  documents: { name: string; type: string; addedAt: ISODate }[];
}

export interface ProjectTeamMember {
  id: string;
  contractorId: string;
  role: string;
  responsibilities: string;
  contractAmountCents: number;
  startDate: ISODate;
  endDate: ISODate;
  status: "Assigned" | "Active" | "Complete" | "Released";
  workerName?: string;
}

export interface Task {
  id: string;
  projectId: string;
  name: string;
  description: string;
  category: WorkCategory;
  assigneeType: "Contractor" | "Worker" | "Internal";
  contractorId?: string;
  assigneeName: string;
  plannedStart: ISODate;
  plannedFinish: ISODate;
  actualStart?: ISODate;
  actualFinish?: ISODate;
  estimatedCostCents: number;
  actualCostCents: number;
  status: TaskStatus;
  priority: Priority;
  dependencies: string[];
  completionNotes?: string;
  beforePhoto?: string;
  afterPhoto?: string;
  inspectionRequired: boolean;
  createdBy: string;
  createdAt: ISODate;
  modifiedBy: string;
  modifiedAt: ISODate;
}

export interface Expense {
  id: string;
  projectId: string;
  taskId?: string;
  date: ISODate;
  category: ExpenseCategory;
  description: string;
  vendor: string;
  quantity: number;
  uom: string;
  unitPriceCents: number;
  subtotalCents: number;
  discountCents: number;
  taxRate: number;
  taxAmountCents: number;
  totalCents: number;
  receiptNumber: string;
  attachmentName?: string;
  approval: ApprovalStatus;
  notes: string;
  createdBy: string;
  createdAt: ISODate;
  sourceInvoiceId?: string;
}

export interface InvoiceLine {
  id: string;
  description: string;
  quantity: number;
  uom: string;
  unitPriceCents: number;
  taxRate: number;
}

export interface Invoice {
  id: string;
  number: string;
  projectId: string;
  vendorId: string;
  vendorName: string;
  poId?: string;
  taskId?: string;
  invoiceDate: ISODate;
  receivedDate: ISODate;
  dueDate: ISODate;
  lines: InvoiceLine[];
  discountCents: number;
  approval: ApprovalStatus;
  notes: string;
  attachmentName?: string;
  createdBy: string;
  createdAt: ISODate;
}

export interface PaymentAllocation {
  invoiceId: string;
  amountCents: number;
}

export interface Payment {
  id: string;
  projectId: string;
  payeeId: string;
  payeeName: string;
  date: ISODate;
  amountCents: number;
  method: PaymentMethod;
  reference: string;
  allocations: PaymentAllocation[];
  notes: string;
  proofName?: string;
  recordedBy: string;
  createdAt: ISODate;
}

export interface ChangeOrder {
  id: string;
  projectId: string;
  number: string;
  description: string;
  reason: string;
  requestedBy: string;
  dateRequested: ISODate;
  costDeltaCents: number;
  scheduleImpactDays: number;
  supportingDocument?: string;
  approval: ApprovalStatus;
  approver?: string;
  approvalDate?: ISODate;
  rejectionReason?: string;
}

export interface Quote {
  id: string;
  projectId: string;
  contractorId: string;
  contractorName: string;
  number: string;
  issueDate: ISODate;
  expiryDate: ISODate;
  description: string;
  subtotalCents: number;
  taxRate: number;
  taxCents: number;
  totalCents: number;
  status: "Pending" | "Accepted" | "Declined" | "Expired";
  attachmentName?: string;
}

export interface PurchaseOrder {
  id: string;
  projectId: string;
  number: string;
  vendorName: string;
  items: string;
  quantity: number;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  expectedDelivery: ISODate;
  approvedBy: string;
  approvalDate: ISODate;
  status: "Draft" | "Approved" | "Ordered" | "Received" | "Cancelled";
}

export interface Milestone {
  id: string;
  projectId: string;
  name: string;
  description: string;
  plannedDate: ISODate;
  actualDate?: ISODate;
  status: MilestoneStatus;
  responsible: string;
  notes: string;
  requiresInspection: boolean;
}

export interface InspectionChecklistItem {
  label: string;
  passed: boolean;
}

export interface Inspection {
  id: string;
  projectId: string;
  taskId?: string;
  type: string;
  date: ISODate;
  inspector: string;
  checklist: InspectionChecklistItem[];
  result: InspectionResult;
  findings: string;
  attachments: string[];
  correctiveActions: string;
  reinspectionDate?: ISODate;
  notes: string;
}

export interface Deficiency {
  id: string;
  projectId: string;
  inspectionId?: string;
  description: string;
  severity: "Low" | "Medium" | "High" | "Critical";
  assignedTo: string;
  dueDate: ISODate;
  status: DeficiencyStatus;
  resolutionNotes?: string;
  completionEvidence?: string;
  reinspectionDate?: ISODate;
}

export interface ProjectDocument {
  id: string;
  projectId: string;
  name: string;
  category: DocumentCategory;
  fileType: string;
  size: string;
  uploadDate: ISODate;
  uploader: string;
  taskId?: string;
  financialRecord?: string;
  expiryDate?: ISODate;
  url?: string;
  /** where the file is stored (Supabase Storage) */
  bucket?: string;
  path?: string;
  stage?: "Before" | "During" | "After";
  visibility: "Internal" | "Team" | "Restricted";
}

export interface ActivityEntry {
  id: string;
  projectId: string;
  at: ISODate;
  actor: string;
  action: string;
  detail: string;
  kind:
    | "status"
    | "budget"
    | "invoice"
    | "payment"
    | "task"
    | "document"
    | "inspection"
    | "change"
    | "created"
    | "assignment";
}

/** a file stored for one record of a project (expense receipt, invoice, proof of payment, change-order document, inspection report) */
export interface StoredAttachment {
  bucket: string;
  path: string;
  name: string;
}

export interface Project {
  id: string;
  name: string;
  propertyId: string;
  propertyName: string;
  unitId: string;
  unitNumber: string;
  type: ProjectType;
  description: string;
  reason: string;
  priority: Priority;
  status: ProjectStatus;
  manager: string;
  createdBy: string;
  createdAt: ISODate;
  modifiedBy: string;
  modifiedAt: ISODate;
  plannedStart: ISODate;
  estimatedCompletion: ISODate;
  actualStart?: ISODate;
  actualCompletion?: ISODate;
  occupancyStatus: Occupancy;
  tenantName?: string;
  mustVacate: boolean;
  tenantNotifications: { date: ISODate; channel: string; note: string }[];
  accessRequirements: string;
  moveOutDate?: ISODate;
  expectedReadyDate: ISODate;
  actualReadyDate?: ISODate;
  utilityShutdowns: string;
  lostRentCents: number;
  readinessApproved: boolean;
  readinessApprovedBy?: string;
  originalBudgetCents: number;
  contingencyCents: number;
  internalNotes: string;
  archived: boolean;
  tasks: Task[];
  team: ProjectTeamMember[];
  expenses: Expense[];
  invoices: Invoice[];
  payments: Payment[];
  changeOrders: ChangeOrder[];
  quotes: Quote[];
  purchaseOrders: PurchaseOrder[];
  milestones: Milestone[];
  inspections: Inspection[];
  deficiencies: Deficiency[];
  documents: ProjectDocument[];
  /** stored files by the id of the record they belong to */
  attachmentFiles?: Record<string, StoredAttachment>;
  activity: ActivityEntry[];
}

export interface ProjectDraft {
  name: string;
  propertyId: string;
  unitId: string;
  type: ProjectType;
  description: string;
  reason: string;
  priority: Priority;
  manager: string;
  plannedStart: ISODate;
  estimatedCompletion: ISODate;
  occupancyStatus: Occupancy;
  originalBudget: string;
  contingency: string;
  mustVacate: boolean;
  accessRequirements: string;
  internalNotes: string;
}
