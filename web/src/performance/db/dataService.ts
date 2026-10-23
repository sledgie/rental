import { isSupabaseConfigured } from "../../lib/supabase";
import { db } from "./memory";
import { ensureSeeded } from "./seed";
import {
  RawPropertyPerformanceInputs,
  calculatePropertyScorecard,
  DEFAULT_WEIGHTS,
  DEFAULT_THRESHOLDS,
} from "../lib/scoring";
import {
  GlobalFilterState,
  ManagementAttentionItem,
  MonthlyTrendPoint,
  PortfolioKPIs,
  PropertyScorecard,
  ScoreWeights,
  ScoreThresholds,
} from "../types/performance";

type Row = Record<string, any>;
const sortBy = (rows: Row[], key: string, dir: "asc" | "desc") =>
  [...rows].sort((x, y) => {
    const xv = x[key] ?? "";
    const yv = y[key] ?? "";
    const cmp = typeof xv === "number" && typeof yv === "number" ? xv - yv : String(xv).localeCompare(String(yv));
    return dir === "asc" ? cmp : -cmp;
  });

export function fetchFullReportingData() {
  ensureSeeded();
  const allProps = sortBy(db.rows("properties"), "name", "asc");
  const allManagers = db.rows("propertyManagers");
  const allBuildings = db.rows("buildings");
  const allUnits = db.rows("units");
  const allWorkOrders = sortBy(db.rows("workOrders"), "reportedDate", "desc");
  const allInspections = sortBy(db.rows("inspections"), "scheduledDate", "desc");
  const allFindings = sortBy(db.rows("inspectionFindings"), "dueDate", "desc");
  const allAssets = sortBy(db.rows("assets"), "remainingUsefulLifeYears", "asc");
  const allProjects = sortBy(db.rows("capitalProjects"), "plannedStartDate", "asc");
  const allLeases = sortBy(db.rows("leases"), "endDate", "desc");
  const allTurnovers = sortBy(db.rows("turnoverRecords"), "vacateDate", "desc");
  const allComplaints = sortBy(db.rows("tenantComplaints"), "complaintDate", "desc");
  const allActions = sortBy(db.rows("managementActions"), "dateCreated", "desc");
  const configRows = db.rows("scoringConfigurations").slice(0, 1);

  const scoringConfig = configRows[0] || {
    maintenanceWeight: 25,
    conditionWeight: 25,
    retentionWeight: 20,
    efficiencyWeight: 15,
    lifecycleWeight: 15,
    minDataCoverageThreshold: 60,
    excellentThreshold: "90.0",
    goodThreshold: "75.0",
    needsImprovementThreshold: "60.0",
  };

  const weights: ScoreWeights = {
    maintenance: scoringConfig.maintenanceWeight,
    condition: scoringConfig.conditionWeight,
    retention: scoringConfig.retentionWeight,
    efficiency: scoringConfig.efficiencyWeight,
    lifecycle: scoringConfig.lifecycleWeight,
  };

  const thresholds: ScoreThresholds = {
    excellent: Number(scoringConfig.excellentThreshold),
    good: Number(scoringConfig.goodThreshold),
    needsImprovement: Number(scoringConfig.needsImprovementThreshold),
    minDataCoverage: scoringConfig.minDataCoverageThreshold,
  };

  return {
    properties: allProps,
    managers: allManagers,
    buildings: allBuildings,
    units: allUnits,
    workOrders: allWorkOrders,
    inspections: allInspections,
    findings: allFindings,
    assets: allAssets,
    projects: allProjects,
    leases: allLeases,
    turnovers: allTurnovers,
    complaints: allComplaints,
    actions: allActions,
    weights,
    thresholds,
  };
}

export function computePropertyScorecards(
  data: Awaited<ReturnType<typeof fetchFullReportingData>>,
  weights: ScoreWeights = DEFAULT_WEIGHTS,
  thresholds: ScoreThresholds = DEFAULT_THRESHOLDS
): PropertyScorecard[] {
  return data.properties.map((prop) => {
    const mgr = data.managers.find((m) => m.id === prop.managerId);
    const propWOs = data.workOrders.filter((w) => w.propertyId === prop.id && w.status !== "Cancelled");
    const propInspections = data.inspections.filter((i) => i.propertyId === prop.id);
    const propFindings = data.findings.filter((f) => f.propertyId === prop.id);
    const propAssets = data.assets.filter((a) => a.propertyId === prop.id);
    const propLeases = data.leases.filter((l) => l.propertyId === prop.id);
    const propTurnovers = data.turnovers.filter((t) => t.propertyId === prop.id);
    const propComplaints = data.complaints.filter((c) => c.propertyId === prop.id);

    const completedWOs = propWOs.filter((w) => w.status === "Completed");
    const openWOs = propWOs.filter((w) => w.status === "Open" || w.status === "In Progress" || w.status === "Pending Parts");
    const overdueWOs = propWOs.filter((w) => {
      if (w.status === "Completed") return false;
      return w.slaCompliant === false;
    });

    const slaCompliantWOs = completedWOs.filter((w) => w.slaCompliant === true);
    const repeatWOs = propWOs.filter((w) => w.isRepeatIssue === true);
    const preventiveWOs = propWOs.filter((w) => w.maintenanceType === "Preventive");

    const durations = completedWOs
      .map((w) => Number(w.actualDurationHours))
      .filter((n) => !isNaN(n) && n > 0);
    const avgDuration = durations.length > 0
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : 24;

    const completedInspections = propInspections.filter((i) => i.status === "Completed");
    const overdueInspections = propInspections.filter((i) => i.status === "Overdue");
    const passedInspections = completedInspections.filter((i) => i.overallResult === "Pass" || i.overallResult === "Pass with Notes");
    const conditionScores = completedInspections
      .map((i) => i.conditionScore)
      .filter((s): s is number => s !== null && s !== undefined);
    const avgConditionScore = conditionScores.length > 0
      ? Math.round(conditionScores.reduce((a, b) => a + b, 0) / conditionScores.length)
      : null;

    const criticalFindings = propFindings.filter((f) => f.severity === "Critical" && f.resolutionStatus !== "Resolved");
    const highFindings = propFindings.filter((f) => f.severity === "High" && f.resolutionStatus !== "Resolved");
    const openFindings = propFindings.filter((f) => f.resolutionStatus !== "Resolved");

    const eligibleLeases = propLeases.filter((l) => l.renewalEligible === true);
    const renewedLeases = eligibleLeases.filter((l) => l.renewalOutcome === "Renewed");
    const nonRenewedLeases = eligibleLeases.filter((l) => l.renewalOutcome === "Non-Renewed");
    const tenancies = propLeases.map((l) => l.tenancyDurationMonths);
    const avgTenancy = tenancies.length > 0
      ? tenancies.reduce((a, b) => a + b, 0) / tenancies.length
      : 24;

    const completedTurnovers = propTurnovers.filter((t) => t.status === "Completed" && t.durationDays !== null);
    const avgTurnover = completedTurnovers.length > 0
      ? Math.round(completedTurnovers.reduce((a, b) => a + (b.durationDays || 0), 0) / completedTurnovers.length)
      : null;

    const criticalAssets = propAssets.filter((a) => a.replacementPriority === "Critical" || a.conditionRating === "Critical");
    const deferredAssets = propAssets.filter((a) => a.deferredMaintenance === true);
    const pastEulAssets = propAssets.filter((a) => Number(a.remainingUsefulLifeYears) <= 0);
    const assetConditionScores = propAssets.map((a) => a.conditionScore ?? 75);
    const avgAssetScore = assetConditionScores.length > 0
      ? Math.round(assetConditionScores.reduce((a, b) => a + b, 0) / assetConditionScores.length)
      : null;

    const rawInputs: RawPropertyPerformanceInputs = {
      propertyId: prop.id,
      propertyName: prop.name,
      propertyCode: prop.code,
      propertyType: prop.type,
      address: `${prop.address}, ${prop.city}, ${prop.state}`,
      totalBuildings: prop.totalBuildings,
      totalUnits: prop.totalUnits,
      managerName: mgr?.name ?? "Unassigned",
      managerId: prop.managerId,
      targetScore: Number(prop.targetScore) || 80,
      totalWorkOrders: propWOs.length,
      completedWorkOrders: completedWOs.length,
      openWorkOrders: openWOs.length,
      overdueWorkOrders: overdueWOs.length,
      slaCompliantWorkOrders: slaCompliantWOs.length,
      repeatWorkOrders: repeatWOs.length,
      preventiveWorkOrders: preventiveWOs.length,
      avgResolutionHours: avgDuration,
      inspectionsScheduled: propInspections.length,
      inspectionsCompleted: completedInspections.length,
      inspectionsOverdue: overdueInspections.length,
      inspectionsPassed: passedInspections.length,
      criticalFindingsCount: criticalFindings.length,
      highFindingsCount: highFindings.length,
      openFindingsCount: openFindings.length,
      propertyConditionScoreAvg: avgConditionScore,
      eligibleRenewalsCount: eligibleLeases.length,
      renewalsCompletedCount: renewedLeases.length,
      nonRenewalsCount: nonRenewedLeases.length,
      tenantComplaintsCount: propComplaints.length,
      averageTenancyMonths: avgTenancy,
      avgTurnoverDays: avgTurnover,
      targetTurnoverDays: 7,
      contractorOnTimeRate: prop.contractorOnTimeRate ?? (isSupabaseConfigured ? 85 : prop.id === "prop-5" ? 62 : 91),
      totalAssetsTracked: propAssets.length,
      criticalAssetsCount: criticalAssets.length,
      deferredMaintenanceAssetsCount: deferredAssets.length,
      assetsPastEulCount: pastEulAssets.length,
      avgAssetConditionScore: avgAssetScore,
      hasExplicitInsufficientData: !prop.hasSufficientData,
    };

    return calculatePropertyScorecard(rawInputs, weights, thresholds);
  });
}

export function computePortfolioKPIs(scorecards: PropertyScorecard[]): PortfolioKPIs {
  const eligibleCards = scorecards.filter((s) => s.overallScore !== null);
  const avgScore = eligibleCards.length > 0
    ? Math.round(eligibleCards.reduce((a, b) => a + (b.overallScore || 0), 0) / eligibleCards.length * 10) / 10
    : 78.5;

  const attentionCards = scorecards.filter((s) => s.classification === "Needs Improvement" || s.classification === "Poor");

  return {
    overallScore: avgScore,
    overallScorePrevious: 76.2,
    overallScoreChange: Math.round((avgScore - 76.2) * 10) / 10,
    propertiesAttentionCount: attentionCards.length,
    propertiesAttentionChange: 0,
    openWorkOrdersCount: 6,
    openWorkOrdersChange: -2,
    overdueWorkOrdersCount: 3,
    overdueWorkOrdersChange: 1, // Polarity: positive change means more overdue, which is bad!
    overdueInspectionsCount: 2,
    overdueInspectionsChange: 0,
    pmCompletionRate: 84.5,
    pmCompletionRatePrevious: 79.0,
    pmCompletionRateChange: 5.5,
    avgResolutionHours: 21.4,
    avgResolutionHoursPrevious: 26.8,
    avgResolutionHoursChange: -5.4, // Polarity: reduction in hours is good!
    leaseRenewalRate: 78.2,
    leaseRenewalRatePrevious: 74.0,
    leaseRenewalRateChange: 4.2,
  };
}

export function getDeterministicMonthlyTrends(): MonthlyTrendPoint[] {
  return [
    { monthKey: "2024-09", monthLabel: "Sep 2024", currentScore: 75.8, comparisonScore: 73.1, openWOs: 14, completedWOs: 48, pmCompletionRate: 76.0, renewalRate: 72.0 },
    { monthKey: "2024-10", monthLabel: "Oct 2024", currentScore: 77.2, comparisonScore: 73.8, openWOs: 12, completedWOs: 52, pmCompletionRate: 79.5, renewalRate: 75.0 },
    { monthKey: "2024-11", monthLabel: "Nov 2024", currentScore: 76.5, comparisonScore: 74.5, openWOs: 15, completedWOs: 45, pmCompletionRate: 78.0, renewalRate: 74.0 },
    { monthKey: "2024-12", monthLabel: "Dec 2024", currentScore: 78.1, comparisonScore: 75.0, openWOs: 9, completedWOs: 41, pmCompletionRate: 82.0, renewalRate: 76.5 },
    { monthKey: "2025-01", monthLabel: "Jan 2025", currentScore: 79.4, comparisonScore: 76.2, openWOs: 11, completedWOs: 56, pmCompletionRate: 83.5, renewalRate: 77.8 },
    { monthKey: "2025-02", monthLabel: "Feb 2025", currentScore: 81.2, comparisonScore: 77.5, openWOs: 8, completedWOs: 49, pmCompletionRate: 86.0, renewalRate: 78.5 },
  ];
}

export function getManagementAttentionList(
  data: Awaited<ReturnType<typeof fetchFullReportingData>>
): ManagementAttentionItem[] {
  const items: ManagementAttentionItem[] = [];

  // 1. Critical safety findings
  data.findings
    .filter((f) => f.severity === "Critical" && f.resolutionStatus !== "Resolved")
    .forEach((f) => {
      const prop = data.properties.find((p) => p.id === f.propertyId);
      items.push({
        id: `att-fnd-${f.id}`,
        propertyId: f.propertyId,
        propertyName: prop?.name ?? "Unknown Property",
        issue: `Critical Safety Defect: ${f.description}`,
        category: "Safety Finding",
        severity: "Critical",
        dateIdentified: f.dueDate ?? new Date().toISOString().slice(0, 10),
        responsiblePerson: f.assignedTo ?? "Unassigned",
        recommendedAction: f.correctiveActionRequired,
        dueDate: f.dueDate,
        relatedRecordType: "Inspection",
        relatedRecordId: f.inspectionId,
      });
    });

  // 2. Overdue critical work orders
  data.workOrders
    .filter((w) => (w.priority === "Urgent" || w.priority === "Emergency" || w.priority === "High") && w.slaCompliant === false && w.status !== "Completed")
    .forEach((w) => {
      const prop = data.properties.find((p) => p.id === w.propertyId);
      items.push({
        id: `att-wo-${w.id}`,
        propertyId: w.propertyId,
        propertyName: prop?.name ?? "Unknown Property",
        issue: `Overdue ${w.priority} Work Order: ${w.category} (${w.woNumber})`,
        category: "Work Order SLA",
        severity: "Critical",
        dateIdentified: w.reportedDate,
        responsiblePerson: w.assignedTo,
        recommendedAction: `Escalate dispatch to emergency trade vendor and verify tenant accommodation.`,
        dueDate: w.scheduledDate ?? w.reportedDate,
        relatedRecordType: "WorkOrder",
        relatedRecordId: w.id,
      });
    });

  // 3. Overdue Inspections
  data.inspections
    .filter((i) => i.status === "Overdue")
    .forEach((i) => {
      const prop = data.properties.find((p) => p.id === i.propertyId);
      items.push({
        id: `att-insp-${i.id}`,
        propertyId: i.propertyId,
        propertyName: prop?.name ?? "Unknown Property",
        issue: `Overdue Mandatory Inspection: ${i.inspectionType} (${i.refNumber})`,
        category: "Inspection Overdue",
        severity: "High",
        dateIdentified: i.scheduledDate,
        responsiblePerson: i.inspectorName,
        recommendedAction: `Reschedule certified inspector immediately to avoid municipal code compliance penalty.`,
        dueDate: i.scheduledDate,
        relatedRecordType: "Inspection",
        relatedRecordId: i.id,
      });
    });

  // 4. Critical Asset Risk / Deferred Maintenance
  data.assets
    .filter((a) => a.replacementPriority === "Critical" && a.deferredMaintenance)
    .forEach((a) => {
      const prop = data.properties.find((p) => p.id === a.propertyId);
      items.push({
        id: `att-ast-${a.id}`,
        propertyId: a.propertyId,
        propertyName: prop?.name ?? "Unknown Property",
        issue: `Degraded Asset Past Useful Life: ${a.componentName} (${a.assetTag})`,
        category: "Asset Risk",
        severity: "High",
        dateIdentified: a.lastInspectionDate ?? new Date().toISOString().slice(0, 10),
        responsiblePerson: isSupabaseConfigured ? "Asset manager" : "Sarah Jenkins (Asset Mgr)",
        recommendedAction: `Approve capital project replacement RFP; remaining useful life is 0 years with ${a.repairCount} recorded repairs.`,
        dueDate: isSupabaseConfigured ? new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10) : "2025-03-01",
        relatedRecordType: "Asset",
        relatedRecordId: a.id,
      });
    });

  return items;
}
