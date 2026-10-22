import { db } from "../db/memory";
import { ensureSeeded } from "../db/seed";
import {
  properties as propTable,
  buildings as bldTable,
  projectManagers as pmTable,
  contractors as ctrTable,
  projects as prjTable,
  milestones as mlsTable,
  monthlySpending as spdTable,
  changeOrders as coTable,
  risks as rskTable,
  issues as issTable,
  handoverItems as hoTable,
  outcomeReviews as orTable,
  auditLogs as logTable,
} from "../db/schema";
import {
  Project,
  Property,
  Building,
  ProjectManager,
  Contractor,
  Milestone,
  MonthlySpend,
  ChangeOrder,
  Risk,
  Issue,
  HandoverItem,
  OutcomeReview,
  AuditLog,
  FilterState,
  ThresholdSettings,
  ManagementException,
} from "./types";
import {
  DEFAULT_THRESHOLDS,
  calculateScheduleVariance,
  determineScheduleHealth,
  determineBudgetHealth,
  generateManagementExceptions,
  diffDays,
} from "./calculations";

export function fetchFullProjectReportsData(
  filters?: Partial<FilterState>,
  thresholds: ThresholdSettings = DEFAULT_THRESHOLDS
) {
  ensureSeeded();
  try {
    // 1. Fetch raw data from database
    const [
      dbProps,
      dbBlds,
      dbPms,
      dbCtrs,
      dbPrjs,
      dbMls,
      dbSpd,
      dbCos,
      dbRsks,
      dbIss,
      dbHos,
      dbOrs,
      dbLogs,
    ] = [
      db.rows(propTable),
      db.rows(bldTable),
      db.rows(pmTable),
      db.rows(ctrTable),
      db.rows(prjTable),
      db.rows(mlsTable),
      db.rows(spdTable),
      db.rows(coTable),
      db.rows(rskTable),
      db.rows(issTable),
      db.rows(hoTable),
      db.rows(orTable),
      db.rows(logTable),
    ];

    // Create lookup maps
    const propMap = new Map(dbProps.map((p) => [p.id, p]));
    const bldMap = new Map(dbBlds.map((b) => [b.id, b]));
    const pmMap = new Map(dbPms.map((m) => [m.id, m]));
    const ctrMap = new Map(dbCtrs.map((c) => [c.id, c]));

    // Format properties & buildings
    const properties: Property[] = dbProps.map((p) => ({
      id: p.id,
      name: p.name,
      code: p.code,
      address: p.address,
      city: p.city,
      state: p.state,
      totalUnits: p.totalUnits ?? 0,
      propertyType: p.propertyType,
    }));

    const buildings: Building[] = dbBlds.map((b) => ({
      id: b.id,
      propertyId: b.propertyId,
      name: b.name,
      code: b.code,
      floors: b.floors ?? 1,
      units: b.units ?? 0,
    }));

    const projectManagers: ProjectManager[] = dbPms.map((m) => ({
      id: m.id,
      name: m.name,
      email: m.email,
      phone: m.phone,
      title: m.title,
      department: m.department,
    }));

    const contractors: Contractor[] = dbCtrs.map((c) => ({
      id: c.id,
      name: c.name,
      trade: c.trade,
      contactPerson: c.contactPerson,
      email: c.email,
      phone: c.phone,
      complianceStatus: c.complianceStatus,
      insuranceExpiry: c.insuranceExpiry,
      rating: c.rating,
    }));

    // Process and enrich projects
    const allProjects: Project[] = dbPrjs.map((p) => {
      const origBudget = parseFloat(p.originalBudget || "0");
      const revisions = parseFloat(p.approvedRevisions || "0");
      const currentApprovedBudget = origBudget + revisions;
      const committed = parseFloat(p.committedCost || "0");
      const actual = parseFloat(p.actualCost || "0");
      const forecastFinal = parseFloat(p.forecastFinalCost || "0");
      const plannedProg = p.plannedProgress ? parseFloat(p.plannedProgress) : null;
      const actualProg = p.actualProgress ? parseFloat(p.actualProgress) : null;

      const scheduleVarianceDays = calculateScheduleVariance(
        p.status,
        p.originalEndDate,
        p.forecastEndDate,
        p.actualEndDate
      );

      const budgetVariance = currentApprovedBudget - forecastFinal;
      const budgetVariancePct = currentApprovedBudget > 0 ? (budgetVariance / currentApprovedBudget) * 100 : null;
      const remainingBudget = currentApprovedBudget - actual;
      const forecastRemainingCost = forecastFinal - actual;

      const scheduleHealth = determineScheduleHealth(p.status, scheduleVarianceDays, thresholds);
      const budgetHealth = determineBudgetHealth(
        origBudget,
        revisions,
        actual,
        forecastFinal,
        actualProg,
        thresholds
      );

      const prop = propMap.get(p.propertyId);
      const bld = p.buildingId ? bldMap.get(p.buildingId) : undefined;
      const pm = pmMap.get(p.managerId);
      const ctr = ctrMap.get(p.contractorId);

      return {
        id: p.id,
        code: p.code,
        name: p.name,
        propertyId: p.propertyId,
        buildingId: p.buildingId,
        managerId: p.managerId,
        contractorId: p.contractorId,
        category: p.category as any,
        status: p.status as any,
        originalStartDate: p.originalStartDate,
        originalEndDate: p.originalEndDate,
        forecastEndDate: p.forecastEndDate,
        actualStartDate: p.actualStartDate,
        actualEndDate: p.actualEndDate,
        originalBudget: origBudget,
        approvedRevisions: revisions,
        currentApprovedBudget,
        committedCost: committed,
        actualCost: actual,
        forecastFinalCost: forecastFinal,
        plannedProgress: plannedProg,
        actualProgress: actualProg,
        progressUpdatedAt: p.progressUpdatedAt,
        progressUpdatedBy: p.progressUpdatedBy,
        scopeDescription: p.scopeDescription,
        businessObjective: p.businessObjective,
        dataCompleteness: p.dataCompleteness as any,
        dataNotes: p.dataNotes,
        propertyName: prop?.name,
        buildingName: bld?.name,
        managerName: pm?.name,
        contractorName: ctr?.name,
        budgetVariance,
        budgetVariancePct,
        remainingBudget,
        forecastRemainingCost,
        scheduleVarianceDays,
        scheduleHealth,
        budgetHealth,
      };
    });

    // Project map for quick lookup
    const prjMap = new Map(allProjects.map((p) => [p.id, p]));

    // Format milestones
    const allMilestones: Milestone[] = dbMls.map((m) => {
      const prj = prjMap.get(m.projectId);
      const delayDays = m.status === "Completed" && m.actualEnd
        ? diffDays(m.actualEnd, m.plannedEnd)
        : diffDays(m.forecastEnd, m.plannedEnd);

      return {
        id: m.id,
        milestoneCode: m.milestoneCode,
        projectId: m.projectId,
        projectName: prj?.name,
        propertyName: prj?.propertyName,
        name: m.name,
        plannedStart: m.plannedStart,
        plannedEnd: m.plannedEnd,
        forecastEnd: m.forecastEnd,
        actualEnd: m.actualEnd,
        responsiblePerson: m.responsiblePerson,
        dependency: m.dependency,
        status: m.status as any,
        notes: m.notes,
        delayDays,
      };
    });

    // Format monthly spending
    const allSpending: MonthlySpend[] = dbSpd.map((s) => ({
      id: s.id,
      projectId: s.projectId,
      period: s.period,
      budgetAllocated: parseFloat(s.budgetAllocated || "0"),
      committedAmount: parseFloat(s.committedAmount || "0"),
      actualIncurred: parseFloat(s.actualIncurred || "0"),
    }));

    // Format change orders
    const allChangeOrders: ChangeOrder[] = dbCos.map((c) => {
      const prj = prjMap.get(c.projectId);
      return {
        id: c.id,
        coNumber: c.coNumber,
        projectId: c.projectId,
        projectName: prj?.name,
        propertyName: prj?.propertyName,
        requestDate: c.requestDate,
        requestedBy: c.requestedBy,
        description: c.description,
        reason: c.reason,
        scopeReference: c.scopeReference,
        costImpact: parseFloat(c.costImpact || "0"),
        scheduleImpactDays: c.scheduleImpactDays ?? 0,
        status: c.status as any,
        approver: c.approver,
        approvalDate: c.approvalDate,
        budgetRevisionId: c.budgetRevisionId,
        supportingDocs: c.supportingDocs,
      };
    });

    // Format risks
    const allRisks: Risk[] = dbRsks.map((r) => {
      const prj = prjMap.get(r.projectId);
      const prob = r.probability ?? 3;
      const imp = r.impact ?? 3;
      return {
        id: r.id,
        riskCode: r.riskCode,
        projectId: r.projectId,
        projectName: prj?.name,
        propertyName: prj?.propertyName,
        category: r.category,
        description: r.description,
        probability: prob,
        impact: imp,
        riskScore: prob * imp,
        inherentRating: r.inherentRating as any,
        currentRating: r.currentRating as any,
        residualRating: r.residualRating as any,
        identifiedDate: r.identifiedDate,
        riskOwner: r.riskOwner,
        mitigationStrategy: r.mitigationStrategy,
        targetResolutionDate: r.targetResolutionDate,
        status: r.status as any,
      };
    });

    // Format issues
    const nowStr = new Date().toISOString().split("T")[0];
    const allIssues: Issue[] = dbIss.map((i) => {
      const prj = prjMap.get(i.projectId);
      const isOverdue = (i.status === "Open" || i.status === "Escalated") && i.resolutionTarget < nowStr;
      return {
        id: i.id,
        issueCode: i.issueCode,
        projectId: i.projectId,
        projectName: prj?.name,
        propertyName: prj?.propertyName,
        description: i.description,
        severity: i.severity as any,
        identifiedDate: i.identifiedDate,
        responsiblePerson: i.responsiblePerson,
        resolutionTarget: i.resolutionTarget,
        actualResolutionDate: i.actualResolutionDate,
        status: i.status as any,
        scheduleImpactDays: i.scheduleImpactDays ?? 0,
        costImpact: parseFloat(i.costImpact || "0"),
        resolutionNotes: i.resolutionNotes,
        isOverdue,
      };
    });

    // Format handover items
    const allHandoverItems: HandoverItem[] = dbHos.map((h) => {
      const prj = prjMap.get(h.projectId);
      return {
        id: h.id,
        projectId: h.projectId,
        projectName: prj?.name,
        propertyName: prj?.propertyName,
        category: h.category,
        itemKey: h.itemKey,
        title: h.title,
        required: h.required ?? true,
        status: h.status as any,
        completedDate: h.completedDate,
        verifiedBy: h.verifiedBy,
        notes: h.notes,
        waiverReason: h.waiverReason,
      };
    });

    // Format outcome reviews
    const allOutcomeReviews: OutcomeReview[] = dbOrs.map((o) => {
      const prj = prjMap.get(o.projectId);
      return {
        id: o.id,
        projectId: o.projectId,
        projectName: prj?.name,
        propertyName: prj?.propertyName,
        reviewDate: o.reviewDate,
        reviewMilestone: o.reviewMilestone,
        reviewer: o.reviewer,
        originalObjective: o.originalObjective,
        expectedBenefit: o.expectedBenefit,
        baselineValue: o.baselineValue,
        targetValue: o.targetValue,
        actualValue: o.actualValue,
        unit: o.unit,
        realizationRate: o.realizationRate ? parseFloat(o.realizationRate) : null,
        evidenceSource: o.evidenceSource,
        lessonsLearned: o.lessonsLearned,
        followUpActions: o.followUpActions,
        qualityAcceptanceStatus: o.qualityAcceptanceStatus,
        outstandingDefects: o.outstandingDefects ?? 0,
      };
    });

    // Format audit logs
    const allAuditLogs: AuditLog[] = dbLogs.map((l) => ({
      id: l.id,
      projectId: l.projectId,
      entityType: l.entityType,
      action: l.action,
      fieldChanged: l.fieldChanged,
      oldValue: l.oldValue,
      newValue: l.newValue,
      changedBy: l.changedBy,
      timestamp: l.timestamp,
      notes: l.notes,
    }));

    // Filter projects based on criteria
    const filteredProjects = applyProjectFilters(allProjects, filters);
    const filteredProjectIds = new Set(filteredProjects.map((p) => p.id));

    // Filter children records based on filtered projects
    const filteredMilestones = allMilestones.filter((m) => filteredProjectIds.has(m.projectId));
    const filteredSpending = allSpending.filter((s) => filteredProjectIds.has(s.projectId));
    const filteredChangeOrders = allChangeOrders.filter((c) => filteredProjectIds.has(c.projectId));
    const filteredRisks = allRisks.filter((r) => {
      if (!filteredProjectIds.has(r.projectId)) return false;
      if (filters?.riskLevel && filters.riskLevel !== "ALL" && r.currentRating !== filters.riskLevel) return false;
      return true;
    });
    const filteredIssues = allIssues.filter((i) => filteredProjectIds.has(i.projectId));
    const filteredHandover = allHandoverItems.filter((h) => filteredProjectIds.has(h.projectId));
    const filteredOutcomes = allOutcomeReviews.filter((o) => filteredProjectIds.has(o.projectId));
    const filteredLogs = allAuditLogs.filter((l) => filteredProjectIds.has(l.projectId));

    // Date range / period boundaries
    const dateRange = getDateRangeBounds(filters?.period, filters?.customStartDate, filters?.customEndDate);

    // Compute Milestones Due & Completion Rate for the Period
    const milestonesDueInPeriod = filteredMilestones.filter((m) => {
      if (!dateRange) return true;
      return m.plannedEnd >= dateRange.start && m.plannedEnd <= dateRange.end;
    });
    const milestonesCompletedInPeriod = milestonesDueInPeriod.filter((m) => m.status === "Completed");
    const milestoneCompletionRate =
      milestonesDueInPeriod.length > 0
        ? (milestonesCompletedInPeriod.length / milestonesDueInPeriod.length) * 100
        : 100;

    // Completed projects during the period
    const projectsCompletedDuringPeriod = filteredProjects.filter((p) => {
      if (p.status !== "Completed") return false;
      if (!p.actualEndDate) return true;
      if (!dateRange) return true;
      return p.actualEndDate >= dateRange.start && p.actualEndDate <= dateRange.end;
    });

    // Management exceptions
    const managementExceptions = generateManagementExceptions(
      filteredProjects,
      filteredRisks,
      filteredIssues,
      filteredChangeOrders,
      filteredMilestones
    );

    // Portfolio KPI Summary
    const totalProjects = filteredProjects.length;
    const activeProjects = filteredProjects.filter((p) => p.status === "In Progress" || p.status === "Approved").length;
    const pendingApproval = filteredProjects.filter((p) => p.status === "Pending Approval" || p.status === "Proposed").length;
    const completedProjects = filteredProjects.filter((p) => p.status === "Completed").length;
    const onHoldProjects = filteredProjects.filter((p) => p.status === "On Hold").length;
    const delayedProjects = filteredProjects.filter((p) => p.scheduleHealth === "Delayed").length;
    const atRiskProjects = filteredProjects.filter((p) => p.scheduleHealth === "At Risk" || p.budgetHealth === "At Risk").length;
    const overBudgetProjects = filteredProjects.filter((p) => p.budgetHealth === "Critical" || p.budgetHealth === "At Risk").length;
    const upcomingMilestones = filteredMilestones.filter((m) => m.status !== "Completed" && m.status !== "Cancelled").length;
    const criticalIssues = filteredIssues.filter((i) => i.severity === "Critical" && i.status !== "Resolved").length;

    // Financial totals (no double counting!)
    const totalOriginalBudget = filteredProjects.reduce((acc, p) => acc + p.originalBudget, 0);
    const totalApprovedRevisions = filteredProjects.reduce((acc, p) => acc + p.approvedRevisions, 0);
    const totalCurrentBudget = filteredProjects.reduce((acc, p) => acc + p.currentApprovedBudget, 0);
    const totalCommittedCost = filteredProjects.reduce((acc, p) => acc + p.committedCost, 0);
    const totalActualCost = filteredProjects.reduce((acc, p) => acc + p.actualCost, 0);
    const totalForecastFinalCost = filteredProjects.reduce((acc, p) => acc + p.forecastFinalCost, 0);
    const totalForecastRemainingCost = totalForecastFinalCost - totalActualCost;
    const totalBudgetVariance = totalCurrentBudget - totalForecastFinalCost;
    const totalBudgetVariancePct = totalCurrentBudget > 0 ? (totalBudgetVariance / totalCurrentBudget) * 100 : null;

    // Change Order totals
    const approvedChangeOrders = filteredChangeOrders.filter((c) => c.status === "Approved");
    const pendingChangeOrders = filteredChangeOrders.filter((c) => c.status === "Pending");
    const rejectedChangeOrders = filteredChangeOrders.filter((c) => c.status === "Rejected");
    const cancelledChangeOrders = filteredChangeOrders.filter((c) => c.status === "Cancelled");
    const totalApprovedCostChange = approvedChangeOrders.reduce((acc, c) => acc + c.costImpact, 0);
    const totalPendingCostExposure = pendingChangeOrders.reduce((acc, c) => acc + c.costImpact, 0);
    const totalApprovedScheduleDays = approvedChangeOrders.reduce((acc, c) => acc + c.scheduleImpactDays, 0);

    return {
      properties,
      buildings,
      projectManagers,
      contractors,
      projects: filteredProjects,
      allProjectsRaw: allProjects,
      milestones: filteredMilestones,
      spending: filteredSpending,
      changeOrders: filteredChangeOrders,
      risks: filteredRisks,
      issues: filteredIssues,
      handoverItems: filteredHandover,
      outcomeReviews: filteredOutcomes,
      auditLogs: filteredLogs,
      managementExceptions,
      kpis: {
        totalProjects,
        activeProjects,
        pendingApproval,
        completedProjects,
        completedDuringPeriod: projectsCompletedDuringPeriod.length,
        onHoldProjects,
        delayedProjects,
        atRiskProjects,
        overBudgetProjects,
        upcomingMilestones,
        criticalIssues,
        milestonesDueCount: milestonesDueInPeriod.length,
        milestonesCompletedCount: milestonesCompletedInPeriod.length,
        milestoneCompletionRate,
        financials: {
          totalOriginalBudget,
          totalApprovedRevisions,
          totalCurrentBudget,
          totalCommittedCost,
          totalActualCost,
          totalForecastFinalCost,
          totalForecastRemainingCost,
          totalBudgetVariance,
          totalBudgetVariancePct,
        },
        changeOrders: {
          totalCount: filteredChangeOrders.length,
          approvedCount: approvedChangeOrders.length,
          pendingCount: pendingChangeOrders.length,
          rejectedCount: rejectedChangeOrders.length,
          cancelledCount: cancelledChangeOrders.length,
          totalApprovedCostChange,
          totalPendingCostExposure,
          totalApprovedScheduleDays,
        },
      },
    };
  } catch (error) {
    console.error("Error fetching project reports data:", error);
    throw error;
  }
}

function applyProjectFilters(projects: Project[], filters?: Partial<FilterState>): Project[] {
  if (!filters) return projects;

  return projects.filter((p) => {
    if (filters.propertyId && filters.propertyId !== "ALL" && p.propertyId !== filters.propertyId) return false;
    if (filters.buildingId && filters.buildingId !== "ALL" && p.buildingId !== filters.buildingId) return false;
    if (filters.projectId && filters.projectId !== "ALL" && p.id !== filters.projectId) return false;
    if (filters.category && filters.category !== "ALL" && p.category !== filters.category) return false;
    if (filters.managerId && filters.managerId !== "ALL" && p.managerId !== filters.managerId) return false;
    if (filters.contractorId && filters.contractorId !== "ALL" && p.contractorId !== filters.contractorId) return false;
    if (filters.status && filters.status !== "ALL" && p.status !== filters.status) return false;

    // Date bounds filtering
    const range = getDateRangeBounds(filters.period, filters.customStartDate, filters.customEndDate);
    if (range) {
      const pStart = p.actualStartDate || p.originalStartDate;
      const pEnd = p.actualEndDate || p.forecastEndDate;
      // Project is active or intersects with period if pStart <= range.end && pEnd >= range.start
      if (pStart > range.end || pEnd < range.start) {
        return false;
      }
    }

    return true;
  });
}

export function getDateRangeBounds(period?: string, customStart?: string, customEnd?: string): { start: string; end: string } | null {
  if (!period || period === "ALL") return null;

  switch (period) {
    case "FY2025":
      return { start: "2025-01-01", end: "2025-12-31" };
    case "FY2026":
      return { start: "2026-01-01", end: "2026-12-31" };
    case "Q1-2025":
      return { start: "2025-01-01", end: "2025-03-31" };
    case "Q2-2025":
      return { start: "2025-04-01", end: "2025-06-30" };
    case "Q3-2025":
      return { start: "2025-07-01", end: "2025-09-30" };
    case "Q4-2025":
      return { start: "2025-10-01", end: "2025-12-31" };
    case "Q1-2026":
      return { start: "2026-01-01", end: "2026-03-31" };
    case "LAST_12M":
      return { start: "2024-10-01", end: "2025-09-30" };
    case "CUSTOM":
      if (customStart && customEnd) {
        return { start: customStart, end: customEnd };
      }
      return null;
    default:
      return null;
  }
}
