export type ReportingPeriod =
  | "this-month"
  | "last-month"
  | "this-quarter"
  | "last-quarter"
  | "ytd"
  | "ltm"
  | "this-year"
  | "last-year"
  | "custom";

export type ComparisonPeriod = "prior-period" | "prior-year" | "target";

export type PropertyClassification = "Excellent" | "Good" | "Needs Improvement" | "Poor" | "Insufficient Data";

export interface GlobalFilterState {
  period: ReportingPeriod;
  customStartDate?: string;
  customEndDate?: string;
  propertyIds: string[]; // empty means all
  buildingId: string; // 'all' or building ID
  propertyType: string; // 'all' or specific type
  managerId: string; // 'all' or specific manager ID
  comparison: ComparisonPeriod;
}

export interface ScoreWeights {
  maintenance: number; // default 25
  condition: number; // default 25
  retention: number; // default 20
  efficiency: number; // default 15
  lifecycle: number; // default 15
}

export interface ScoreThresholds {
  excellent: number; // default 90.0
  good: number; // default 75.0
  needsImprovement: number; // default 60.0
  minDataCoverage: number; // default 60%
}

export interface CategoryScoreDetail {
  categoryKey: "maintenance" | "condition" | "retention" | "efficiency" | "lifecycle";
  name: string;
  weight: number;
  score: number | null; // null if insufficient data
  previousScore: number | null;
  change: number | null;
  status: "Excellent" | "Good" | "Needs Improvement" | "Poor" | "Insufficient Data";
  explanation: string;
  dataCoverage: number; // 0 - 100%
  recordsUsedCount: number;
  supportingMetrics: { label: string; value: string | number; target?: string | number; isFavorable?: boolean }[];
  isEligible: boolean;
}

export interface PropertyScorecard {
  propertyId: string;
  propertyName: string;
  propertyCode: string;
  propertyType: string;
  address: string;
  totalBuildings: number;
  totalUnits: number;
  managerName: string;
  managerId: string;
  overallScore: number | null;
  classification: PropertyClassification;
  previousScore: number | null;
  scoreChange: number | null;
  dataCoveragePercent: number;
  isDataSufficient: boolean;
  totalRecordsCount: number;
  targetScore: number;
  categories: CategoryScoreDetail[];
  scoringFormulaExplanation: string;
}

export interface ManagementAttentionItem {
  id: string;
  propertyId: string;
  propertyName: string;
  issue: string;
  category: "Safety Finding" | "Work Order SLA" | "Asset Risk" | "Inspection Overdue" | "Retention Decline" | "Repeat Issue";
  severity: "Critical" | "High" | "Medium";
  dateIdentified: string;
  responsiblePerson: string;
  recommendedAction: string;
  dueDate: string;
  relatedRecordType: "WorkOrder" | "Inspection" | "Asset" | "Lease";
  relatedRecordId: string;
}

export interface PortfolioKPIs {
  overallScore: number;
  overallScorePrevious: number;
  overallScoreChange: number;
  propertiesAttentionCount: number;
  propertiesAttentionChange: number;
  openWorkOrdersCount: number;
  openWorkOrdersChange: number;
  overdueWorkOrdersCount: number;
  overdueWorkOrdersChange: number;
  overdueInspectionsCount: number;
  overdueInspectionsChange: number;
  pmCompletionRate: number;
  pmCompletionRatePrevious: number;
  pmCompletionRateChange: number;
  avgResolutionHours: number;
  avgResolutionHoursPrevious: number;
  avgResolutionHoursChange: number;
  leaseRenewalRate: number;
  leaseRenewalRatePrevious: number;
  leaseRenewalRateChange: number;
}

export interface MonthlyTrendPoint {
  monthKey: string;
  monthLabel: string;
  currentScore: number;
  comparisonScore: number;
  openWOs: number;
  completedWOs: number;
  pmCompletionRate: number;
  renewalRate: number;
}
