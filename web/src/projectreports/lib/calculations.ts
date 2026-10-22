import { Project, ThresholdSettings, ScheduleHealth, BudgetHealth, ManagementException, Risk, Issue, ChangeOrder, Milestone } from "./types";

export const DEFAULT_THRESHOLDS: ThresholdSettings = {
  warningProgressThreshold: 85,
  warningBudgetConsumption: 90,
  atRiskOverrunPct: 10,
  criticalOverrunPct: 10,
  delayedDaysWarning: 7,
};

export function parseDate(dateStr?: string | null): Date | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

export function diffDays(d1: string | Date, d2: string | Date): number {
  const date1 = typeof d1 === "string" ? new Date(d1) : d1;
  const date2 = typeof d2 === "string" ? new Date(d2) : d2;
  const diffTime = date1.getTime() - date2.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Schedule Variance:
 * For completed projects: Actual completion date minus original approved completion date.
 * For ongoing projects: Current forecast completion date minus original approved completion date.
 * Positive = delay; negative = ahead of schedule.
 */
export function calculateScheduleVariance(
  status: string,
  originalEnd: string,
  forecastEnd: string,
  actualEnd?: string | null
): number {
  if (status === "Completed" && actualEnd) {
    return diffDays(actualEnd, originalEnd);
  }
  return diffDays(forecastEnd, originalEnd);
}

/**
 * Schedule Health determination
 */
export function determineScheduleHealth(
  status: string,
  scheduleVarianceDays: number,
  thresholds: ThresholdSettings = DEFAULT_THRESHOLDS
): ScheduleHealth {
  if (status === "Completed") return "Completed";
  if (status === "On Hold") return "On Hold";
  if (scheduleVarianceDays > thresholds.delayedDaysWarning) return "Delayed";
  if (scheduleVarianceDays > 0) return "At Risk";
  return "On Track";
}

/**
 * Budget Health determination
 * Separates budget consumption from forecast variance
 */
export function determineBudgetHealth(
  originalBudget: number,
  approvedRevisions: number,
  actualCost: number,
  forecastFinalCost: number,
  actualProgress: number | null | undefined,
  thresholds: ThresholdSettings = DEFAULT_THRESHOLDS
): BudgetHealth {
  const currentBudget = originalBudget + approvedRevisions;
  if (currentBudget <= 0) return "Healthy";

  const overrunPct = ((forecastFinalCost - currentBudget) / currentBudget) * 100;

  if (overrunPct > thresholds.criticalOverrunPct) {
    return "Critical";
  }
  if (overrunPct > 0) {
    return "At Risk";
  }

  // Budget consumption warning: spent >90% before substantial completion (progress < 85%)
  const progress = actualProgress ?? 0;
  const consumptionPct = (actualCost / currentBudget) * 100;
  if (consumptionPct >= thresholds.warningBudgetConsumption && progress < thresholds.warningProgressThreshold) {
    return "Warning";
  }

  return "Healthy";
}

/**
 * Safe formatting helpers
 */
export function formatCurrency(val?: number | null, decimals = 0): string {
  if (val === null || val === undefined || isNaN(val)) return "N/A";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(val);
}

export function formatPct(val?: number | null, decimals = 1, includeSign = false): string {
  if (val === null || val === undefined || isNaN(val)) return "N/A";
  const sign = includeSign && val > 0 ? "+" : "";
  return `${sign}${val.toFixed(decimals)}%`;
}

export function formatDate(dateStr?: string | null): string {
  if (!dateStr) return "—";
  const parts = dateStr.split("-");
  if (parts.length === 3) {
    const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }
  return dateStr;
}

/**
 * Generate prioritized management attention items based on documented rules
 */
export function generateManagementExceptions(
  projects: Project[],
  risks: Risk[],
  issues: Issue[],
  changeOrders: ChangeOrder[],
  milestones: Milestone[]
): ManagementException[] {
  const exceptions: ManagementException[] = [];

  // 1. Critical/At-Risk Budget Overruns
  for (const p of projects) {
    if (p.forecastFinalCost > p.currentApprovedBudget && p.status !== "Completed" && p.status !== "Cancelled") {
      const overrun = p.forecastFinalCost - p.currentApprovedBudget;
      const overrunPct = p.currentApprovedBudget > 0 ? (overrun / p.currentApprovedBudget) * 100 : 0;
      exceptions.push({
        id: `EXC-BGT-${p.id}`,
        type: "BUDGET_OVERRUN",
        severity: overrunPct > 10 ? "Critical" : "High",
        title: `Forecast Budget Overrun: ${formatCurrency(overrun)} (${formatPct(overrunPct)})`,
        projectId: p.id,
        projectCode: p.code,
        projectName: p.name,
        propertyName: p.propertyName || "Unknown Property",
        responsiblePerson: p.managerName || "Project Director",
        dueDate: p.forecastEndDate,
        impact: `Current forecast $${p.forecastFinalCost.toLocaleString()} exceeds approved budget $${p.currentApprovedBudget.toLocaleString()}`,
        recommendation: `Conduct scope review with ${p.contractorName || "contractor"}; consider value engineering or submit formal capital budget revision.`,
      });
    }
  }

  // 2. Schedule Delays
  for (const p of projects) {
    if (p.scheduleVarianceDays > 7 && p.status !== "Completed" && p.status !== "Cancelled") {
      exceptions.push({
        id: `EXC-SCH-${p.id}`,
        type: "SCHEDULE_DELAY",
        severity: p.scheduleVarianceDays > 30 ? "Critical" : "High",
        title: `Project Delayed by ${p.scheduleVarianceDays} Days Past Baseline`,
        projectId: p.id,
        projectCode: p.code,
        projectName: p.name,
        propertyName: p.propertyName || "Unknown Property",
        responsiblePerson: p.managerName || "Project Manager",
        dueDate: p.forecastEndDate,
        impact: `Forecast completion shifted from ${formatDate(p.originalEndDate)} to ${formatDate(p.forecastEndDate)}`,
        recommendation: "Review critical path milestones, assess liquidated damages or contractor acceleration plan.",
      });
    }
  }

  // 3. Unresolved Critical/High Issues
  for (const iss of issues) {
    if ((iss.severity === "Critical" || iss.severity === "High") && (iss.status === "Open" || iss.status === "Escalated")) {
      exceptions.push({
        id: `EXC-ISS-${iss.id}`,
        type: "CRITICAL_RISK",
        severity: iss.severity,
        title: `Unresolved ${iss.severity} Issue: ${iss.description.slice(0, 60)}...`,
        projectId: iss.projectId,
        projectCode: iss.projectId,
        projectName: iss.projectName || "Active Project",
        propertyName: iss.propertyName || "Property",
        responsiblePerson: iss.responsiblePerson,
        dueDate: iss.resolutionTarget,
        impact: `Schedule impact: ${iss.scheduleImpactDays} days, Cost impact: ${formatCurrency(iss.costImpact)}`,
        recommendation: iss.resolutionNotes || "Convene weekly escalation meeting with contractor leadership to unblock.",
      });
    }
  }

  // 4. Overdue Milestones
  const nowStr = new Date().toISOString().split("T")[0];
  for (const m of milestones) {
    if (m.status !== "Completed" && m.status !== "Cancelled" && m.plannedEnd < nowStr) {
      const overdueDays = diffDays(nowStr, m.plannedEnd);
      if (overdueDays > 0) {
        exceptions.push({
          id: `EXC-MLS-${m.id}`,
          type: "OVERDUE_MILESTONE",
          severity: overdueDays > 20 ? "High" : "Medium",
          title: `Overdue Milestone: "${m.name}" (${overdueDays} days late)`,
          projectId: m.projectId,
          projectCode: m.milestoneCode,
          projectName: m.projectName || "Project",
          propertyName: m.propertyName || "Property",
          responsiblePerson: m.responsiblePerson,
          dueDate: m.plannedEnd,
          impact: `Planned completion was ${formatDate(m.plannedEnd)}; forecast is ${formatDate(m.forecastEnd)}`,
          recommendation: "Request revised recovery schedule from contractor lead.",
        });
      }
    }
  }

  // 5. Pending Change Orders with Financial Exposure
  for (const co of changeOrders) {
    if (co.status === "Pending" && co.costImpact > 0) {
      exceptions.push({
        id: `EXC-CO-${co.id}`,
        type: "PENDING_CHANGE_ORDER",
        severity: co.costImpact > 20000 ? "High" : "Medium",
        title: `Pending Change Order: ${co.coNumber} (${formatCurrency(co.costImpact)})`,
        projectId: co.projectId,
        projectCode: co.coNumber,
        projectName: co.projectName || "Project",
        propertyName: co.propertyName || "Property",
        responsiblePerson: co.requestedBy,
        dueDate: co.requestDate,
        impact: `Unapproved exposure of ${formatCurrency(co.costImpact)}, +${co.scheduleImpactDays} days schedule effect`,
        recommendation: "Asset Management Committee review required before authorizing contractor work.",
      });
    }
  }

  // Sort exceptions: Critical first, then High, then Medium
  const priorityMap: Record<string, number> = { Critical: 1, High: 2, Medium: 3 };
  return exceptions.sort((a, b) => priorityMap[a.severity] - priorityMap[b.severity]);
}
