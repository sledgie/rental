// ─────────────────────────────────────────────────────────────────────────────
// Keystone Property Management — shared domain types
// Entities are kept separate (normalized) with explicit ID relationships so
// this prototype can be mapped onto a real backend without restructuring.
// ─────────────────────────────────────────────────────────────────────────────

export interface Property {
  id: string;
  name: string;
  address: string;
  city: string;
  type: string;
  yearBuilt: number;
}

export interface Unit {
  id: string;
  propertyId: string;
  name: string;
  beds: number;
  baths: number;
  sqft: number;
  status: 'Occupied' | 'Vacant' | 'Notice Given';
}

export interface Tenant {
  id: string;
  name: string;
  email: string;
  phone: string;
  movedIn: string;
}

export interface Lease {
  id: string;
  unitId: string;
  tenantId: string;
  start: string;
  end: string;
  rent: number;
  status: 'Active' | 'Expiring Soon' | 'Ended';
}

export interface StaffMember {
  id: string;
  name: string;
  role: string;
}

export interface Contractor {
  id: string;
  company: string;
  contact: string;
  phone: string;
  email: string;
  categories: string[];
  active: boolean;
  notes?: string;
}

export type Priority = 'Emergency' | 'High' | 'Normal' | 'Low';

export type RequestStatus =
  | 'Draft'
  | 'New'
  | 'Under Review'
  | 'Awaiting Approval'
  | 'Approved'
  | 'Assigned'
  | 'In Progress'
  | 'On Hold'
  | 'Completed'
  | 'Closed'
  | 'Rejected'
  | 'Cancelled';

export type ApprovalStatus =
  | 'Not Required'
  | 'Pending Approval'
  | 'Approved'
  | 'Rejected'
  | 'Revision Requested';

export type ResolutionOutcome =
  | 'Repaired'
  | 'Replaced'
  | 'No Fault Found'
  | 'Unable to Repair'
  | 'Deferred'
  | 'Cancelled';

export interface PreviousCompletion {
  completedAt: string;
  outcome: ResolutionOutcome;
  notes: string;
  finalCost: number;
  reopenedAt?: string;
  reopenReason?: string;
}

export interface MaintenanceRequest {
  id: string;
  title: string;
  description: string;
  category: string;
  subcategory?: string;
  priority: Priority;
  status: RequestStatus;
  propertyId: string;
  unitId?: string; // undefined = common area / property-level
  room?: string;
  tenantId?: string;
  leaseId?: string;
  assetId?: string;
  reportedByName: string;
  reportedByRole: string;
  source: string;
  reportedAt: string; // ISO datetime
  preferredDate?: string;
  targetDate?: string;
  completedAt?: string;
  assignedStaffId?: string;
  assignedContractorId?: string;
  assignedAt?: string;
  internalNotes?: string;
  tenantNotes?: string;
  contractorNotes?: string;
  accessInstructions?: string;
  preferredAccessTimes?: string;
  petsNote?: string;
  approvalStatus: ApprovalStatus;
  approvedBudget?: number;
  resolutionOutcome?: ResolutionOutcome;
  resolutionNotes?: string;
  verifiedBy?: string;
  verificationStatus?: 'Verified' | 'Pending Verification' | 'Not Verified';
  warrantyInfo?: string;
  followUpRequired?: boolean;
  statusReason?: string; // reason for rejection / cancellation
  linkedExpenseIds: string[];
  linkedProjectId?: string;
  previousCompletions: PreviousCompletion[];
  createdBy: string;
}

export interface Attachment {
  id: string;
  requestId?: string;
  assetId?: string;
  workOrderId?: string;
  name: string;
  category: string;
  size: string;
  uploadedBy: string;
  uploadedAt: string;
  url?: string; // session-only object URL for mock uploads
  mock?: boolean;
}

export interface Estimate {
  id: string;
  requestId: string;
  contractorId?: string;
  label: string;
  labor: number;
  materials: number;
  other: number;
  tax: number;
  total: number;
  status: ApprovalStatus;
  submittedBy: string;
  submittedAt: string;
  approvedBy?: string;
  approvedAt?: string;
  approvedBudget?: number;
  notes?: string;
}

export interface Visit {
  id: string;
  requestId: string;
  workOrderId?: string;
  contractorId?: string;
  staffId?: string;
  purpose: string;
  date: string;
  time: string;
  durationMins: number;
  status: 'Scheduled' | 'Completed' | 'Cancelled' | 'Rescheduled';
  accessArrangements?: string;
  notes?: string;
}

export interface WorkLogEntry {
  id: string;
  requestId: string;
  workOrderId?: string;
  date: string;
  person: string;
  workPerformed: string;
  diagnosis?: string;
  materials?: string;
  hours: number;
  outcome: string;
  followUpRequired: boolean;
  notes?: string;
}

export type WorkOrderStatus =
  | 'Draft'
  | 'Awaiting Assignment'
  | 'Scheduled'
  | 'In Progress'
  | 'On Hold'
  | 'Completed'
  | 'Cancelled';

export interface WorkOrder {
  id: string;
  requestId: string;
  title: string;
  description: string;
  scope?: string;
  contractorId?: string;
  staffId?: string;
  priority: Priority;
  scheduledDate?: string;
  targetDate?: string;
  status: WorkOrderStatus;
  estimate?: number;
  approvedBudget?: number;
  actualCost?: number;
  completionNotes?: string;
  linkedExpenseId?: string;
  createdAt: string;
}

export type AssetStatus =
  | 'Active'
  | 'Under Inspection'
  | 'Under Repair'
  | 'Replaced'
  | 'Retired'
  | 'Disposed';

export type AssetCondition = 'Excellent' | 'Good' | 'Fair' | 'Poor' | 'Failed';

export interface Asset {
  id: string;
  name: string;
  type: string;
  propertyId: string;
  unitId?: string;
  room?: string;
  brand?: string;
  model?: string;
  serial?: string;
  purchaseDate?: string;
  purchasePrice?: number;
  supplier?: string;
  installDate?: string;
  warrantyStart?: string;
  warrantyEnd?: string;
  warrantyProvider?: string;
  warrantyRef?: string;
  warrantyNotes?: string;
  condition: AssetCondition;
  status: AssetStatus;
  lastInspection?: string;
  lastService?: string;
  nextService?: string;
  replacedById?: string;
  replacedFromId?: string;
  replacementReason?: string;
  replacementDate?: string;
  retiredDate?: string;
  disposalNotes?: string;
}

export interface Expense {
  id: string;
  description: string;
  vendor: string;
  contractorId?: string;
  propertyId?: string;
  unitId?: string;
  category: string;
  amount: number;
  date: string;
  dueDate?: string;
  paymentStatus: 'Paid' | 'Unpaid' | 'Partially Paid' | 'Overdue';
  amountPaid?: number;
  invoiceRef?: string;
  linkedRequestId?: string;
  linkedWorkOrderId?: string;
  linkedAssetId?: string;
}

export type Frequency =
  | 'Weekly'
  | 'Monthly'
  | 'Quarterly'
  | 'Semi-Annual'
  | 'Annual'
  | 'Custom';

export interface PreventiveSchedule {
  id: string;
  task: string;
  category: string;
  propertyId: string;
  unitId?: string;
  assetId?: string;
  frequency: Frequency;
  customDays?: number;
  lastCompleted?: string;
  nextDue: string;
  contractorId?: string;
  estimatedCost?: number;
  checklist: string[];
  instructions?: string;
  active: boolean;
}

export interface Project {
  id: string;
  name: string;
  propertyId: string;
  unitId?: string;
  status: 'Planning' | 'In Progress' | 'On Hold' | 'Completed';
  budget: number;
  spent: number;
  progress: number;
  start: string;
  end: string;
}

export interface ActivityEvent {
  id: string;
  requestId?: string;
  assetId?: string;
  type: string;
  description: string;
  user: string;
  timestamp: string;
}

export interface AppSettings {
  emergencyResponseHours: number;
  highResponseHours: number;
  approvalThreshold: number;
}

// ── Option lists ─────────────────────────────────────────────────────────────

export const CATEGORIES = [
  'Plumbing',
  'Electrical',
  'Heating, Ventilation & Air Conditioning',
  'Appliance',
  'Structural',
  'Roofing',
  'Doors and Windows',
  'Pest Control',
  'Painting',
  'Flooring',
  'Landscaping',
  'Safety and Security',
  'Common Areas',
  'General Repairs',
  'Other',
];

export const SUBCATEGORIES: Record<string, string[]> = {
  Plumbing: ['Leak', 'Blocked Drain', 'Toilet', 'Faucet / Fixture', 'Water Heater', 'Low Pressure', 'Other'],
  Electrical: ['Outlet / Switch', 'Lighting', 'Breaker Panel', 'Wiring', 'Appliance Circuit', 'Other'],
  'Heating, Ventilation & Air Conditioning': ['No Heat', 'No Cooling', 'Thermostat', 'Filter', 'Ductwork', 'Noise', 'Other'],
  Appliance: ['Not Working', 'Poor Performance', 'Leaking', 'Noise', 'Door / Seal', 'Other'],
  Structural: ['Wall / Ceiling', 'Foundation', 'Stairs / Railing', 'Other'],
  Roofing: ['Leak', 'Shingles', 'Gutters', 'Flashing', 'Other'],
  'Doors and Windows': ['Won’t Close / Latch', 'Broken Glass', 'Lock', 'Weather Sealing', 'Other'],
  'Pest Control': ['Insects', 'Rodents', 'Wildlife', 'Preventive Treatment', 'Other'],
  Painting: ['Touch-Up', 'Full Room', 'Exterior', 'Other'],
  Flooring: ['Hardwood', 'Tile', 'Carpet', 'Vinyl / Laminate', 'Other'],
  Landscaping: ['Lawn', 'Trees / Shrubs', 'Irrigation', 'Snow Removal', 'Other'],
  'Safety and Security': ['Smoke / CO Alarms', 'Locks', 'Lighting', 'Fire Extinguisher', 'Other'],
  'Common Areas': ['Hallway', 'Laundry Room', 'Parking', 'Exterior', 'Other'],
  'General Repairs': ['Handyman', 'Cosmetic', 'Other'],
  Other: ['Other'],
};

export const PRIORITIES: Priority[] = ['Emergency', 'High', 'Normal', 'Low'];

export const REQUEST_STATUSES: RequestStatus[] = [
  'Draft', 'New', 'Under Review', 'Awaiting Approval', 'Approved', 'Assigned',
  'In Progress', 'On Hold', 'Completed', 'Closed', 'Rejected', 'Cancelled',
];

export const SOURCES = [
  'Tenant', 'Landlord', 'Property Manager', 'Maintenance Staff',
  'Inspection', 'Preventive Maintenance', 'Other',
];

export const DOC_CATEGORIES = [
  'Initial Issue Photo', 'Video', 'Contractor Estimate', 'Work Authorization',
  'Invoice', 'Receipt', 'Before / After Photo', 'Inspection Report',
  'Warranty Document', 'Other',
];

export const ASSET_DOC_CATEGORIES = [
  'Receipt', 'Warranty Document', 'Invoice', 'Manual / Guide', 'Installation Record', 'Service Record', 'Inspection Report', 'Photo', 'Other',
];

export const ASSET_TYPES = [
  'Refrigerator', 'Dishwasher', 'Stove / Oven', 'Microwave', 'Washer', 'Dryer',
  'Furnace', 'Air Conditioner', 'Water Heater', 'Sump Pump',
  'Garage Door Opener', 'Other Equipment',
];

export const ASSET_CONDITIONS: AssetCondition[] = ['Excellent', 'Good', 'Fair', 'Poor', 'Failed'];
export const ASSET_STATUSES: AssetStatus[] = [
  'Active', 'Under Inspection', 'Under Repair', 'Replaced', 'Retired', 'Disposed',
];

export const WORKORDER_STATUSES: WorkOrderStatus[] = [
  'Draft', 'Awaiting Assignment', 'Scheduled', 'In Progress', 'On Hold', 'Completed', 'Cancelled',
];

export const APPROVAL_STATUSES: ApprovalStatus[] = [
  'Not Required', 'Pending Approval', 'Approved', 'Rejected', 'Revision Requested',
];

export const RESOLUTION_OUTCOMES: ResolutionOutcome[] = [
  'Repaired', 'Replaced', 'No Fault Found', 'Unable to Repair', 'Deferred', 'Cancelled',
];

export const COST_CATEGORIES = [
  'Labor', 'Materials and Parts', 'Contractor Services', 'Appliance Purchase',
  'Delivery', 'Installation', 'Disposal', 'Inspection', 'Taxes', 'Other',
];

export const EXPENSE_CATEGORIES = [
  'Maintenance & Repairs', 'Appliance Purchase', 'Utilities', 'Insurance',
  'Property Tax', 'Landscaping', 'Cleaning', 'HOA Fees', 'Legal & Professional', 'Other',
];

export const FREQUENCIES: Frequency[] = [
  'Weekly', 'Monthly', 'Quarterly', 'Semi-Annual', 'Annual', 'Custom',
];

export const VISIT_OUTCOMES = [
  'Work Completed', 'Diagnosis Only — Estimate To Follow', 'Partially Completed',
  'Parts Ordered — Return Visit Needed', 'No Fault Found', 'Unable to Access Unit',
  'Replacement Recommended', 'Other',
];

// Allowed status transitions (flexible — not every request takes every step)
export const STATUS_TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  Draft: ['New', 'Cancelled'],
  New: ['Under Review', 'Awaiting Approval', 'Approved', 'Assigned', 'In Progress', 'Rejected', 'Cancelled'],
  'Under Review': ['Awaiting Approval', 'Approved', 'Assigned', 'In Progress', 'Rejected', 'Cancelled'],
  'Awaiting Approval': ['Approved', 'Under Review', 'Rejected', 'Cancelled'],
  Approved: ['Assigned', 'In Progress', 'On Hold', 'Cancelled'],
  Assigned: ['In Progress', 'Awaiting Approval', 'On Hold', 'Under Review', 'Cancelled'],
  'In Progress': ['On Hold', 'Completed', 'Cancelled'],
  'On Hold': ['In Progress', 'Assigned', 'Under Review', 'Cancelled'],
  Completed: ['Closed', 'In Progress'],
  Closed: ['In Progress'],
  Rejected: ['Under Review', 'New', 'Cancelled'],
  Cancelled: ['New', 'Draft'],
};

export const OPEN_STATUSES: RequestStatus[] = [
  'New', 'Under Review', 'Awaiting Approval', 'Approved', 'Assigned', 'In Progress', 'On Hold',
];

export const TERMINAL_STATUSES: RequestStatus[] = ['Completed', 'Closed', 'Rejected', 'Cancelled'];
