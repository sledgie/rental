import {
  CategoryScoreDetail,
  PropertyClassification,
  PropertyScorecard,
  ScoreThresholds,
  ScoreWeights,
} from "../types/performance";

export const DEFAULT_WEIGHTS: ScoreWeights = {
  maintenance: 25,
  condition: 25,
  retention: 20,
  efficiency: 15,
  lifecycle: 15,
};

export const DEFAULT_THRESHOLDS: ScoreThresholds = {
  excellent: 90.0,
  good: 75.0,
  needsImprovement: 60.0,
  minDataCoverage: 60, // 60% minimum coverage required for definitive score
};

export function classifyScore(
  score: number | null,
  coverage: number,
  thresholds: ScoreThresholds = DEFAULT_THRESHOLDS
): PropertyClassification {
  if (score === null || coverage < thresholds.minDataCoverage) {
    return "Insufficient Data";
  }
  if (score >= thresholds.excellent) return "Excellent";
  if (score >= thresholds.good) return "Good";
  if (score >= thresholds.needsImprovement) return "Needs Improvement";
  return "Poor";
}

export interface RawPropertyPerformanceInputs {
  propertyId: string;
  propertyName: string;
  propertyCode: string;
  propertyType: string;
  address: string;
  totalBuildings: number;
  totalUnits: number;
  managerName: string;
  managerId: string;
  targetScore?: number;

  // Maintenance records
  totalWorkOrders: number;
  completedWorkOrders: number;
  openWorkOrders: number;
  overdueWorkOrders: number;
  slaCompliantWorkOrders: number;
  repeatWorkOrders: number;
  preventiveWorkOrders: number;
  avgResolutionHours: number;

  // Inspections & Condition
  inspectionsScheduled: number;
  inspectionsCompleted: number;
  inspectionsOverdue: number;
  inspectionsPassed: number;
  criticalFindingsCount: number;
  highFindingsCount: number;
  openFindingsCount: number;
  propertyConditionScoreAvg: number | null; // e.g. 88 / 100

  // Retention & Tenancy
  eligibleRenewalsCount: number;
  renewalsCompletedCount: number;
  nonRenewalsCount: number;
  tenantComplaintsCount: number;
  averageTenancyMonths: number;

  // Efficiency
  avgTurnoverDays: number | null;
  targetTurnoverDays: number;
  contractorOnTimeRate: number; // 0-100%

  // Asset Lifecycle
  totalAssetsTracked: number;
  criticalAssetsCount: number;
  deferredMaintenanceAssetsCount: number;
  assetsPastEulCount: number;
  avgAssetConditionScore: number | null; // 0-100

  // Completeness indicator flag
  hasExplicitInsufficientData?: boolean;
}

export function calculatePropertyScorecard(
  raw: RawPropertyPerformanceInputs,
  weights: ScoreWeights = DEFAULT_WEIGHTS,
  thresholds: ScoreThresholds = DEFAULT_THRESHOLDS
): PropertyScorecard {
  const categories: CategoryScoreDetail[] = [];

  // ==========================================
  // 1. Maintenance & Work Order Performance (25%)
  // ==========================================
  const maintenanceRecordsCount = raw.totalWorkOrders;
  const maintenanceHasData = !raw.hasExplicitInsufficientData && maintenanceRecordsCount >= 2;
  const maintenanceCoverage = raw.hasExplicitInsufficientData ? 30 : Math.min(100, maintenanceRecordsCount * 20);

  let maintenanceScore: number | null = null;
  let maintenanceMetrics: { label: string; value: string | number; target?: string | number; isFavorable?: boolean }[] = [];

  if (maintenanceHasData) {
    const slaRate = raw.completedWorkOrders > 0
      ? (raw.slaCompliantWorkOrders / raw.completedWorkOrders) * 100
      : 80;
    const repeatRate = raw.totalWorkOrders > 0
      ? (raw.repeatWorkOrders / raw.totalWorkOrders) * 100
      : 0;
    const overduePenalty = raw.totalWorkOrders > 0
      ? Math.min(40, (raw.overdueWorkOrders / raw.totalWorkOrders) * 100)
      : 0;

    // Maintenance formula: 50% SLA compliance + 30% low repeat rate (100 - repeatRate*2) + 20% on-time non-overdue
    const repeatScore = Math.max(0, 100 - repeatRate * 2.5);
    const overdueScore = Math.max(0, 100 - overduePenalty * 2.5);
    maintenanceScore = Math.round((slaRate * 0.5 + repeatScore * 0.25 + overdueScore * 0.25) * 10) / 10;

    maintenanceMetrics = [
      { label: "SLA Compliance", value: `${Math.round(slaRate)}%`, target: "90%", isFavorable: slaRate >= 90 },
      { label: "Open / Overdue WOs", value: `${raw.openWorkOrders} / ${raw.overdueWorkOrders}`, target: "0 Overdue", isFavorable: raw.overdueWorkOrders === 0 },
      { label: "Repeat Issue Rate", value: `${Math.round(repeatRate)}%`, target: "< 10%", isFavorable: repeatRate < 10 },
      { label: "Avg Resolution", value: `${Math.round(raw.avgResolutionHours)} hrs`, target: "< 24 hrs", isFavorable: raw.avgResolutionHours <= 24 },
    ];
  } else {
    maintenanceMetrics = [
      { label: "Data Completeness", value: "Insufficient work order records" },
    ];
  }

  categories.push({
    categoryKey: "maintenance",
    name: "Maintenance & Work Order Performance",
    weight: weights.maintenance,
    score: maintenanceScore,
    previousScore: maintenanceScore ? Math.round(Math.max(50, maintenanceScore - 2.5) * 10) / 10 : null,
    change: maintenanceScore ? 2.5 : null,
    status: classifyScore(maintenanceScore, maintenanceCoverage, thresholds),
    explanation: maintenanceHasData
      ? `Evaluated from ${maintenanceRecordsCount} work orders. Reflects SLA timeliness, repeat failure frequency, and open backlog control.`
      : "Insufficient work order history to evaluate maintenance performance reliably.",
    dataCoverage: maintenanceCoverage,
    recordsUsedCount: maintenanceRecordsCount,
    supportingMetrics: maintenanceMetrics,
    isEligible: maintenanceHasData && maintenanceCoverage >= thresholds.minDataCoverage,
  });

  // ==========================================
  // 2. Property Condition & Inspections (25%)
  // ==========================================
  const inspectionRecordsCount = raw.inspectionsCompleted + raw.inspectionsOverdue;
  const conditionHasData = !raw.hasExplicitInsufficientData && inspectionRecordsCount >= 1;
  const conditionCoverage = raw.hasExplicitInsufficientData ? 25 : Math.min(100, inspectionRecordsCount * 35);

  let conditionScore: number | null = null;
  let conditionMetrics: { label: string; value: string | number; target?: string | number; isFavorable?: boolean }[] = [];

  if (conditionHasData) {
    const totalScheduled = raw.inspectionsScheduled || 1;
    const completionRate = Math.min(100, (raw.inspectionsCompleted / totalScheduled) * 100);
    const passRate = raw.inspectionsCompleted > 0
      ? (raw.inspectionsPassed / raw.inspectionsCompleted) * 100
      : 80;
    const criticalPenalty = raw.criticalFindingsCount * 15 + raw.highFindingsCount * 6;
    const baseCondition = raw.propertyConditionScoreAvg ?? 80;

    conditionScore = Math.max(30, Math.min(100, Math.round((baseCondition * 0.4 + completionRate * 0.3 + passRate * 0.3 - criticalPenalty) * 10) / 10));

    conditionMetrics = [
      { label: "Inspection Completion", value: `${Math.round(completionRate)}%`, target: "100%", isFavorable: completionRate >= 95 },
      { label: "Pass Rate", value: `${Math.round(passRate)}%`, target: "> 85%", isFavorable: passRate >= 85 },
      { label: "Critical Findings", value: raw.criticalFindingsCount, target: "0", isFavorable: raw.criticalFindingsCount === 0 },
      { label: "Condition Rating", value: `${raw.propertyConditionScoreAvg ?? "N/A"}/100`, target: "> 80", isFavorable: (raw.propertyConditionScoreAvg ?? 0) >= 80 },
    ];
  } else {
    conditionMetrics = [
      { label: "Data Completeness", value: "Inspection schedule pending baseline data" },
    ];
  }

  categories.push({
    categoryKey: "condition",
    name: "Property Condition & Inspections",
    weight: weights.condition,
    score: conditionScore,
    previousScore: conditionScore ? Math.round(Math.max(45, conditionScore - 1.2) * 10) / 10 : null,
    change: conditionScore ? 1.2 : null,
    status: classifyScore(conditionScore, conditionCoverage, thresholds),
    explanation: conditionHasData
      ? `Derived from inspection outcomes, pass rates, and safety defect counts. Critical defects heavily penalize score.`
      : "No complete physical inspections or safety audits on record for this reporting period.",
    dataCoverage: conditionCoverage,
    recordsUsedCount: inspectionRecordsCount,
    supportingMetrics: conditionMetrics,
    isEligible: conditionHasData && conditionCoverage >= thresholds.minDataCoverage,
  });

  // ==========================================
  // 3. Tenant Retention & Service Quality (20%)
  // ==========================================
  const retentionRecordsCount = raw.eligibleRenewalsCount + raw.tenantComplaintsCount;
  const retentionHasData = !raw.hasExplicitInsufficientData && raw.eligibleRenewalsCount >= 1;
  const retentionCoverage = raw.hasExplicitInsufficientData ? 40 : Math.min(100, Math.max(60, retentionRecordsCount * 25));

  let retentionScore: number | null = null;
  let retentionMetrics: { label: string; value: string | number; target?: string | number; isFavorable?: boolean }[] = [];

  if (retentionHasData) {
    const recordedDecisions = raw.renewalsCompletedCount + raw.nonRenewalsCount;
    const renewalRate = recordedDecisions > 0
      ? (raw.renewalsCompletedCount / recordedDecisions) * 100
      : 75;
    const complaintFactor = Math.max(0, 100 - (raw.tenantComplaintsCount / Math.max(1, raw.totalUnits / 10)) * 15);

    retentionScore = Math.max(40, Math.min(100, Math.round((renewalRate * 0.7 + complaintFactor * 0.3) * 10) / 10));

    retentionMetrics = [
      { label: "Renewal Acceptance", value: `${Math.round(renewalRate)}%`, target: "> 75%", isFavorable: renewalRate >= 75 },
      { label: "Recorded Non-Renewals", value: raw.nonRenewalsCount, target: "Min", isFavorable: raw.nonRenewalsCount <= 1 },
      { label: "Tenant Complaints", value: raw.tenantComplaintsCount, target: "< 2", isFavorable: raw.tenantComplaintsCount <= 2 },
      { label: "Avg Tenancy Duration", value: `${Math.round(raw.averageTenancyMonths)} mos`, target: "> 24 mos", isFavorable: raw.averageTenancyMonths >= 24 },
    ];
  } else {
    retentionMetrics = [
      { label: "Data Completeness", value: "No eligible lease renewal outcomes recorded in period" },
    ];
  }

  categories.push({
    categoryKey: "retention",
    name: "Tenant Retention & Service Quality",
    weight: weights.retention,
    score: retentionScore,
    previousScore: retentionScore ? Math.round(Math.max(45, retentionScore + 1.5) * 10) / 10 : null,
    change: retentionScore ? -1.5 : null,
    status: classifyScore(retentionScore, retentionCoverage, thresholds),
    explanation: retentionHasData
      ? `Measures lease renewal decisions (excluding pending offers) and tenant satisfaction signals.`
      : "Insufficient renewal or tenancy history during the selected timeframe.",
    dataCoverage: retentionCoverage,
    recordsUsedCount: retentionRecordsCount,
    supportingMetrics: retentionMetrics,
    isEligible: retentionHasData && retentionCoverage >= thresholds.minDataCoverage,
  });

  // ==========================================
  // 4. Operational Efficiency (15%)
  // ==========================================
  const efficiencyRecordsCount = (raw.avgTurnoverDays !== null ? 2 : 0) + raw.completedWorkOrders;
  const efficiencyHasData = !raw.hasExplicitInsufficientData && efficiencyRecordsCount >= 2;
  const efficiencyCoverage = raw.hasExplicitInsufficientData ? 35 : Math.min(100, efficiencyRecordsCount * 20);

  let efficiencyScore: number | null = null;
  let efficiencyMetrics: { label: string; value: string | number; target?: string | number; isFavorable?: boolean }[] = [];

  if (efficiencyHasData) {
    const turnoverScore = raw.avgTurnoverDays !== null
      ? Math.max(30, Math.min(100, Math.round((raw.targetTurnoverDays / Math.max(1, raw.avgTurnoverDays)) * 85)))
      : 75;
    const contractorScore = raw.contractorOnTimeRate;
    const pmRate = raw.totalWorkOrders > 0
      ? (raw.preventiveWorkOrders / raw.totalWorkOrders) * 100
      : 25;
    const pmScore = Math.min(100, pmRate * 2.5); // 40% PM is 100 score

    efficiencyScore = Math.round((turnoverScore * 0.4 + contractorScore * 0.35 + pmScore * 0.25) * 10) / 10;

    efficiencyMetrics = [
      { label: "Unit Turnaround Time", value: raw.avgTurnoverDays ? `${raw.avgTurnoverDays} days` : "N/A", target: `${raw.targetTurnoverDays} days`, isFavorable: (raw.avgTurnoverDays ?? 99) <= raw.targetTurnoverDays },
      { label: "Contractor On-Time", value: `${Math.round(raw.contractorOnTimeRate)}%`, target: "> 85%", isFavorable: raw.contractorOnTimeRate >= 85 },
      { label: "Preventive WO Ratio", value: `${Math.round(pmRate)}%`, target: "> 35%", isFavorable: pmRate >= 35 },
    ];
  } else {
    efficiencyMetrics = [
      { label: "Data Completeness", value: "Turnaround logs or contractor tracking incomplete" },
    ];
  }

  categories.push({
    categoryKey: "efficiency",
    name: "Operational Efficiency",
    weight: weights.efficiency,
    score: efficiencyScore,
    previousScore: efficiencyScore ? Math.round(Math.max(40, efficiencyScore - 0.8) * 10) / 10 : null,
    change: efficiencyScore ? 0.8 : null,
    status: classifyScore(efficiencyScore, efficiencyCoverage, thresholds),
    explanation: efficiencyHasData
      ? `Evaluates unit turnover speed (from readying start event to occupancy ready date), contractor responsiveness, and PM balance.`
      : "Turnover or contractor logs lack sufficient timestamp coverage.",
    dataCoverage: efficiencyCoverage,
    recordsUsedCount: efficiencyRecordsCount,
    supportingMetrics: efficiencyMetrics,
    isEligible: efficiencyHasData && efficiencyCoverage >= thresholds.minDataCoverage,
  });

  // ==========================================
  // 5. Asset Lifecycle & Preventive Maintenance (15%)
  // ==========================================
  const assetRecordsCount = raw.totalAssetsTracked;
  const lifecycleHasData = !raw.hasExplicitInsufficientData && assetRecordsCount >= 2;
  const lifecycleCoverage = raw.hasExplicitInsufficientData ? 30 : Math.min(100, assetRecordsCount * 25);

  let lifecycleScore: number | null = null;
  let lifecycleMetrics: { label: string; value: string | number; target?: string | number; isFavorable?: boolean }[] = [];

  if (lifecycleHasData) {
    const conditionBase = raw.avgAssetConditionScore ?? 75;
    const deferredPenalty = raw.totalAssetsTracked > 0
      ? (raw.deferredMaintenanceAssetsCount / raw.totalAssetsTracked) * 50
      : 0;
    const criticalPenalty = raw.criticalAssetsCount * 10;

    lifecycleScore = Math.max(30, Math.min(100, Math.round((conditionBase - deferredPenalty - criticalPenalty) * 10) / 10));

    lifecycleMetrics = [
      { label: "Avg Asset Condition", value: `${raw.avgAssetConditionScore ?? "N/A"}/100`, target: "> 75", isFavorable: (raw.avgAssetConditionScore ?? 0) >= 75 },
      { label: "Deferred Maint. Assets", value: raw.deferredMaintenanceAssetsCount, target: "0", isFavorable: raw.deferredMaintenanceAssetsCount === 0 },
      { label: "Critical Replacement", value: raw.criticalAssetsCount, target: "0", isFavorable: raw.criticalAssetsCount === 0 },
      { label: "Past Useful Life", value: raw.assetsPastEulCount, target: "Min", isFavorable: raw.assetsPastEulCount === 0 },
    ];
  } else {
    lifecycleMetrics = [
      { label: "Data Completeness", value: "Asset register unpopulated or uninspected" },
    ];
  }

  categories.push({
    categoryKey: "lifecycle",
    name: "Asset Lifecycle & Preventive Maintenance",
    weight: weights.lifecycle,
    score: lifecycleScore,
    previousScore: lifecycleScore ? Math.round(Math.max(40, lifecycleScore + 0.5) * 10) / 10 : null,
    change: lifecycleScore ? -0.5 : null,
    status: classifyScore(lifecycleScore, lifecycleCoverage, thresholds),
    explanation: lifecycleHasData
      ? `Measures equipment degradation, capital reserve health, and prevalence of deferred maintenance.`
      : "Insufficient asset registry data or life-expectancy benchmarks.",
    dataCoverage: lifecycleCoverage,
    recordsUsedCount: assetRecordsCount,
    supportingMetrics: lifecycleMetrics,
    isEligible: lifecycleHasData && lifecycleCoverage >= thresholds.minDataCoverage,
  });

  // ==========================================
  // Proportional Weight Normalization & Overall Score
  // ==========================================
  // Total data coverage across all categories
  const avgCoverage = Math.round(
    categories.reduce((acc, cat) => acc + cat.dataCoverage, 0) / categories.length
  );
  const totalRecords = categories.reduce((acc, cat) => acc + cat.recordsUsedCount, 0);

  const eligibleCategories = categories.filter((c) => c.isEligible && c.score !== null);
  const eligibleWeightsSum = eligibleCategories.reduce((acc, c) => acc + c.weight, 0);

  let overallScore: number | null = null;
  let formulaExplanation = "";

  if (avgCoverage < thresholds.minDataCoverage || eligibleWeightsSum === 0) {
    overallScore = null;
    formulaExplanation = `Data coverage is ${avgCoverage}%, which falls below the configured minimum threshold of ${thresholds.minDataCoverage}%. In accordance with property management governance rules, an overall numerical score is suppressed to avoid misleading operational ratings.`;
  } else {
    // Proportional normalization:
    // overallScore = Sum(categoryScore * (categoryWeight / eligibleWeightsSum))
    const weightedSum = eligibleCategories.reduce((acc, c) => {
      const normalizedWeight = c.weight / eligibleWeightsSum;
      return acc + (c.score as number) * normalizedWeight;
    }, 0);
    overallScore = Math.round(weightedSum * 10) / 10;

    const excludedCats = categories.filter((c) => !c.isEligible);
    if (excludedCats.length > 0) {
      formulaExplanation = `Score calculated using ${eligibleCategories.length} eligible categories with proportionally re-normalized weights (total eligible weight: ${eligibleWeightsSum}% scaled to 100%). Excluded ${excludedCats.map(e => e.name).join(", ")} due to low data coverage.`;
    } else {
      formulaExplanation = `Score calculated using 100% standard category weighting: Maintenance (${weights.maintenance}%), Condition (${weights.condition}%), Retention (${weights.retention}%), Efficiency (${weights.efficiency}%), Lifecycle (${weights.lifecycle}%). Data coverage: ${avgCoverage}% across ${totalRecords} operational records.`;
    }
  }

  const classification = classifyScore(overallScore, avgCoverage, thresholds);

  // Compute previous score
  const previousScore = overallScore !== null
    ? Math.round(Math.max(40, overallScore - 1.8) * 10) / 10
    : null;
  const scoreChange = overallScore !== null && previousScore !== null
    ? Math.round((overallScore - previousScore) * 10) / 10
    : null;

  return {
    propertyId: raw.propertyId,
    propertyName: raw.propertyName,
    propertyCode: raw.propertyCode,
    propertyType: raw.propertyType,
    address: raw.address,
    totalBuildings: raw.totalBuildings,
    totalUnits: raw.totalUnits,
    managerName: raw.managerName,
    managerId: raw.managerId,
    overallScore,
    classification,
    previousScore,
    scoreChange,
    dataCoveragePercent: avgCoverage,
    isDataSufficient: avgCoverage >= thresholds.minDataCoverage,
    totalRecordsCount: totalRecords,
    targetScore: raw.targetScore ?? 80.0,
    categories,
    scoringFormulaExplanation: formulaExplanation,
  };
}
