// In-memory stand-in for the original Drizzle/PostgreSQL schema: each table is just its name, plus column defaults.
export const properties = "properties";
export const buildings = "buildings";
export const projectManagers = "projectManagers";
export const contractors = "contractors";
export const projects = "projects";
export const milestones = "milestones";
export const monthlySpending = "monthlySpending";
export const changeOrders = "changeOrders";
export const risks = "risks";
export const issues = "issues";
export const handoverItems = "handoverItems";
export const outcomeReviews = "outcomeReviews";
export const auditLogs = "auditLogs";

export const DEFAULTS: Record<string, Record<string, unknown>> = {
  properties: { totalUnits: 0, propertyType: "Multifamily", createdAt: () => new Date() },
  buildings: { floors: 1, units: 0 },
  projectManagers: { title: "Project Manager", department: "Capital Projects" },
  contractors: { complianceStatus: "Active & Verified", rating: "4.5" },
  projects: { originalBudget: "0", approvedRevisions: "0", committedCost: "0", actualCost: "0", forecastFinalCost: "0", plannedProgress: "0", actualProgress: "0", dataCompleteness: "Complete", createdAt: () => new Date() },
  milestones: {  },
  monthlySpending: { budgetAllocated: "0", committedAmount: "0", actualIncurred: "0" },
  changeOrders: { costImpact: "0", scheduleImpactDays: 0 },
  risks: { probability: 3, impact: 3, inherentRating: "Medium", currentRating: "Medium", residualRating: "Low", status: "Active" },
  issues: { scheduleImpactDays: 0, costImpact: "0" },
  handoverItems: { required: true, status: "Pending" },
  outcomeReviews: { qualityAcceptanceStatus: "Accepted", outstandingDefects: 0 },
  auditLogs: {  },
};
