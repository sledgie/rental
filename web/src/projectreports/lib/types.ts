export type ProjectCategory =
  | "Renovation"
  | "Capital Improvement"
  | "Major Repair"
  | "Building Upgrade"
  | "Equipment Replacement"
  | "Energy Efficiency"
  | "Compliance and Safety"
  | "Infrastructure Improvement";

export type ProjectStatus =
  | "Proposed"
  | "Pending Approval"
  | "Approved"
  | "In Progress"
  | "On Hold"
  | "Completed"
  | "Cancelled";

export type ScheduleHealth = "On Track" | "At Risk" | "Delayed" | "Completed" | "On Hold";

export type BudgetHealth = "Healthy" | "Warning" | "At Risk" | "Critical";

export type RiskRating = "Low" | "Medium" | "High" | "Critical";

export type ChangeOrderStatus = "Approved" | "Pending" | "Rejected" | "Cancelled";

export type IssueSeverity = "Critical" | "High" | "Medium" | "Low";

export type IssueStatus = "Open" | "In Progress" | "Resolved" | "Escalated";

export type HandoverStatus = "Completed" | "Pending" | "In Review" | "Waived" | "Not Applicable";

export interface Property {
  id: string;
  name: string;
  code: string;
  address: string;
  city: string;
  state: string;
  totalUnits: number;
  propertyType: string;
}

export interface Building {
  id: string;
  propertyId: string;
  name: string;
  code: string;
  floors: number;
  units: number;
}

export interface ProjectManager {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  title: string;
  department: string;
}

export interface Contractor {
  id: string;
  name: string;
  trade: string;
  contactPerson: string;
  email: string;
  phone?: string | null;
  complianceStatus: string;
  insuranceExpiry: string;
  rating?: string | null;
}

export interface Project {
  id: string;
  code: string;
  name: string;
  propertyId: string;
  buildingId?: string | null;
  managerId: string;
  contractorId: string;
  category: ProjectCategory;
  status: ProjectStatus;
  originalStartDate: string;
  originalEndDate: string;
  forecastEndDate: string;
  actualStartDate?: string | null;
  actualEndDate?: string | null;
  originalBudget: number;
  approvedRevisions: number;
  committedCost: number;
  actualCost: number;
  forecastFinalCost: number;
  plannedProgress?: number | null;
  actualProgress?: number | null;
  progressUpdatedAt?: string | null;
  progressUpdatedBy?: string | null;
  scopeDescription: string;
  businessObjective: string;
  dataCompleteness: "Complete" | "Partial" | "Incomplete";
  dataNotes?: string | null;
  createdAt?: string;

  // Joined/Calculated fields
  propertyName?: string;
  buildingName?: string;
  managerName?: string;
  contractorName?: string;
  currentApprovedBudget: number;
  budgetVariance: number; // approved - forecast
  budgetVariancePct: number | null;
  remainingBudget: number; // approved - actual
  forecastRemainingCost: number; // forecast - actual
  scheduleVarianceDays: number; // positive = delay
  scheduleHealth: ScheduleHealth;
  budgetHealth: BudgetHealth;
}

export interface Milestone {
  id: string;
  milestoneCode: string;
  projectId: string;
  projectName?: string;
  propertyName?: string;
  name: string;
  plannedStart: string;
  plannedEnd: string;
  forecastEnd: string;
  actualEnd?: string | null;
  responsiblePerson: string;
  dependency?: string | null;
  status: "Completed" | "In Progress" | "Pending" | "Delayed" | "Cancelled";
  notes?: string | null;
  delayDays: number;
}

export interface MonthlySpend {
  id: string;
  projectId: string;
  period: string; // YYYY-MM
  budgetAllocated: number;
  committedAmount: number;
  actualIncurred: number;
}

export interface ChangeOrder {
  id: string;
  coNumber: string;
  projectId: string;
  projectName?: string;
  propertyName?: string;
  requestDate: string;
  requestedBy: string;
  description: string;
  reason: string;
  scopeReference: string;
  costImpact: number;
  scheduleImpactDays: number;
  status: ChangeOrderStatus;
  approver?: string | null;
  approvalDate?: string | null;
  budgetRevisionId?: string | null;
  supportingDocs?: string | null;
}

export interface Risk {
  id: string;
  riskCode: string;
  projectId: string;
  projectName?: string;
  propertyName?: string;
  category: string;
  description: string;
  probability: number; // 1-5
  impact: number; // 1-5
  riskScore: number; // prob * impact (1-25)
  inherentRating: RiskRating;
  currentRating: RiskRating;
  residualRating: RiskRating;
  identifiedDate: string;
  riskOwner: string;
  mitigationStrategy: string;
  targetResolutionDate: string;
  status: "Active" | "Mitigated" | "Closed" | "Accepted";
}

export interface Issue {
  id: string;
  issueCode: string;
  projectId: string;
  projectName?: string;
  propertyName?: string;
  description: string;
  severity: IssueSeverity;
  identifiedDate: string;
  responsiblePerson: string;
  resolutionTarget: string;
  actualResolutionDate?: string | null;
  status: IssueStatus;
  scheduleImpactDays: number;
  costImpact: number;
  resolutionNotes?: string | null;
  isOverdue: boolean;
}

export interface HandoverItem {
  id: string;
  projectId: string;
  projectName?: string;
  propertyName?: string;
  category: string;
  itemKey: string;
  title: string;
  required: boolean;
  status: HandoverStatus;
  completedDate?: string | null;
  verifiedBy?: string | null;
  notes?: string | null;
  waiverReason?: string | null;
}

export interface OutcomeReview {
  id: string;
  projectId: string;
  projectName?: string;
  propertyName?: string;
  reviewDate: string;
  reviewMilestone: string;
  reviewer: string;
  originalObjective: string;
  expectedBenefit: string;
  baselineValue: string;
  targetValue: string;
  actualValue: string;
  unit: string;
  realizationRate?: number | null;
  evidenceSource: string;
  lessonsLearned: string;
  followUpActions?: string | null;
  qualityAcceptanceStatus: string;
  outstandingDefects: number;
}

export interface AuditLog {
  id: string;
  projectId: string;
  entityType: string;
  action: string;
  fieldChanged?: string | null;
  oldValue?: string | null;
  newValue?: string | null;
  changedBy: string;
  timestamp: string;
  notes?: string | null;
}

export interface FilterState {
  period: string; // "ALL", "FY2025", "FY2026", "Q1-2025", "Q2-2025", "Q3-2025", "Q4-2025", "LAST_12M", "CUSTOM"
  customStartDate: string;
  customEndDate: string;
  propertyId: string; // "ALL" or specific
  buildingId: string; // "ALL" or specific
  projectId: string; // "ALL" or specific
  category: string; // "ALL" or specific
  managerId: string; // "ALL" or specific
  contractorId: string; // "ALL" or specific
  status: string; // "ALL" or specific
  riskLevel: string; // "ALL" or specific
  comparisonPeriod: "NONE" | "PREVIOUS_PERIOD" | "PREVIOUS_YEAR";
}

export interface ThresholdSettings {
  warningProgressThreshold: number; // default 85%
  warningBudgetConsumption: number; // default 90%
  atRiskOverrunPct: number; // default 10%
  criticalOverrunPct: number; // default 10%
  delayedDaysWarning: number; // default 7 days
}

export interface ManagementException {
  id: string;
  type: "BUDGET_OVERRUN" | "SCHEDULE_DELAY" | "CRITICAL_RISK" | "OVERDUE_MILESTONE" | "PENDING_CHANGE_ORDER" | "DOCUMENTATION_DEFICIENCY";
  severity: "Critical" | "High" | "Medium";
  title: string;
  projectId: string;
  projectCode: string;
  projectName: string;
  propertyName: string;
  responsiblePerson: string;
  dueDate: string;
  impact: string;
  recommendation: string;
}
