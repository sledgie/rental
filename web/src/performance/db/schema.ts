// In-memory stand-in for the original Drizzle/PostgreSQL schema: each table is just its name, plus column defaults.
export const properties = "properties";
export const propertyManagers = "propertyManagers";
export const buildings = "buildings";
export const units = "units";
export const workOrders = "workOrders";
export const inspections = "inspections";
export const inspectionFindings = "inspectionFindings";
export const assets = "assets";
export const capitalProjects = "capitalProjects";
export const leases = "leases";
export const turnoverRecords = "turnoverRecords";
export const tenantComplaints = "tenantComplaints";
export const managementActions = "managementActions";
export const scoringConfigurations = "scoringConfigurations";

export const DEFAULTS: Record<string, Record<string, unknown>> = {
  properties: { totalBuildings: 1, targetScore: "80.0", active: true, hasSufficientData: true, createdAt: () => new Date() },
  propertyManagers: { role: "Senior Property Manager" },
  buildings: { floors: 3 },
  units: { floor: 1, bedrooms: 2, bathrooms: "1.5", squareFeet: 850, status: "Occupied" },
  workOrders: { status: "Open", assignedRole: "In-House Tech", isRepeatIssue: false },
  inspections: {  },
  inspectionFindings: { resolutionStatus: "Open" },
  assets: { conditionScore: 80, repairCount: 0, deferredMaintenance: false, estimatedReplacementCost: 5000 },
  capitalProjects: {  },
  leases: { renewalEligible: true, complaintCount: 0 },
  turnoverRecords: { targetDays: 7 },
  tenantComplaints: { resolved: true, resolutionDays: 2 },
  managementActions: { status: "Open" },
  scoringConfigurations: { maintenanceWeight: 25, conditionWeight: 25, retentionWeight: 20, efficiencyWeight: 15, lifecycleWeight: 15, minDataCoverageThreshold: 60, excellentThreshold: "90.0", goodThreshold: "75.0", needsImprovementThreshold: "60.0", updatedAt: () => new Date() },
};
