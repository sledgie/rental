import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
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
} from "../lib/types";
import { fetchFullProjectReportsData } from "../lib/data-service";
import { DEFAULT_THRESHOLDS } from "../lib/calculations";

export const DEFAULT_FILTERS: FilterState = {
  period: "ALL",
  customStartDate: "",
  customEndDate: "",
  propertyId: "ALL",
  buildingId: "ALL",
  projectId: "ALL",
  category: "ALL",
  managerId: "ALL",
  contractorId: "ALL",
  status: "ALL",
  riskLevel: "ALL",
  comparisonPeriod: "NONE",
};

interface ReportsContextType {
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  updateFilter: (key: keyof FilterState, value: any) => void;
  resetFilters: () => void;
  thresholds: ThresholdSettings;
  setThresholds: React.Dispatch<React.SetStateAction<ThresholdSettings>>;

  // Data
  loading: boolean;
  error: string | null;
  properties: Property[];
  buildings: Building[];
  projectManagers: ProjectManager[];
  contractors: Contractor[];
  projects: Project[];
  milestones: Milestone[];
  spending: MonthlySpend[];
  changeOrders: ChangeOrder[];
  risks: Risk[];
  issues: Issue[];
  handoverItems: HandoverItem[];
  outcomeReviews: OutcomeReview[];
  auditLogs: AuditLog[];
  managementExceptions: ManagementException[];
  kpis: any;

  // Modals & Drill-down
  selectedProjectId: string | null;
  setSelectedProjectId: (id: string | null) => void;
  isProjectModalOpen: boolean;
  setIsProjectModalOpen: (open: boolean) => void;
  isThresholdModalOpen: boolean;
  setIsThresholdModalOpen: (open: boolean) => void;
  isExportModalOpen: boolean;
  setIsExportModalOpen: (open: boolean) => void;
  exportReportType: string;
  setExportReportType: (type: string) => void;

  // Active sub-report tab
  activeReportTab: string;
  setActiveReportTab: (tab: string) => void;

  refreshData: () => Promise<void>;
  drillDownProject: (projectId: string) => void;
}

const ProjectReportsContext = createContext<ReportsContextType | undefined>(undefined);

export function ProjectReportsProvider({ children }: { children: React.ReactNode }) {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [thresholds, setThresholds] = useState<ThresholdSettings>(DEFAULT_THRESHOLDS);
  const [activeReportTab, setActiveReportTab] = useState<string>("portfolio");

  // Modals
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isThresholdModalOpen, setIsThresholdModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportReportType, setExportReportType] = useState<string>("portfolio");

  // Data State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [projectManagers, setProjectManagers] = useState<ProjectManager[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [spending, setSpending] = useState<MonthlySpend[]>([]);
  const [changeOrders, setChangeOrders] = useState<ChangeOrder[]>([]);
  const [risks, setRisks] = useState<Risk[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [handoverItems, setHandoverItems] = useState<HandoverItem[]>([]);
  const [outcomeReviews, setOutcomeReviews] = useState<OutcomeReview[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [managementExceptions, setManagementExceptions] = useState<ManagementException[]>([]);
  const [kpis, setKpis] = useState<any>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data: any = fetchFullProjectReportsData(filters, thresholds);

      setProperties(data.properties || []);
      setBuildings(data.buildings || []);
      setProjectManagers(data.projectManagers || []);
      setContractors(data.contractors || []);
      setProjects(data.projects || []);
      setMilestones(data.milestones || []);
      setSpending(data.spending || []);
      setChangeOrders(data.changeOrders || []);
      setRisks(data.risks || []);
      setIssues(data.issues || []);
      setHandoverItems(data.handoverItems || []);
      setOutcomeReviews(data.outcomeReviews || []);
      setAuditLogs(data.auditLogs || []);
      setManagementExceptions(data.managementExceptions || []);
      setKpis(data.kpis || null);
    } catch (err: any) {
      console.error("Project reports error:", err);
      setError(err.message || "An error occurred while loading project reports.");
    } finally {
      setLoading(false);
    }
  }, [filters, thresholds]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const updateFilter = (key: keyof FilterState, value: any) => {
    setFilters((prev) => {
      const updated = { ...prev, [key]: value };
      // If changing property, reset building if not matching
      if (key === "propertyId" && value !== "ALL") {
        updated.buildingId = "ALL";
      }
      return updated;
    });
  };

  const resetFilters = () => {
    setFilters(DEFAULT_FILTERS);
  };

  const drillDownProject = (projectId: string) => {
    setSelectedProjectId(projectId);
    setIsProjectModalOpen(true);
  };

  return (
    <ProjectReportsContext.Provider
      value={{
        filters,
        setFilters,
        updateFilter,
        resetFilters,
        thresholds,
        setThresholds,
        loading,
        error,
        properties,
        buildings,
        projectManagers,
        contractors,
        projects,
        milestones,
        spending,
        changeOrders,
        risks,
        issues,
        handoverItems,
        outcomeReviews,
        auditLogs,
        managementExceptions,
        kpis,
        selectedProjectId,
        setSelectedProjectId,
        isProjectModalOpen,
        setIsProjectModalOpen,
        isThresholdModalOpen,
        setIsThresholdModalOpen,
        isExportModalOpen,
        setIsExportModalOpen,
        exportReportType,
        setExportReportType,
        activeReportTab,
        setActiveReportTab,
        refreshData: fetchData,
        drillDownProject,
      }}
    >
      {children}
    </ProjectReportsContext.Provider>
  );
}

export function useProjectReports() {
  const context = useContext(ProjectReportsContext);
  if (!context) {
    throw new Error("useProjectReports must be used within a ProjectReportsProvider");
  }
  return context;
}
