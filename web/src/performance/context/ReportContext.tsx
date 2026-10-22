import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from "react";
import {
  GlobalFilterState,
  PropertyScorecard,
  PortfolioKPIs,
  MonthlyTrendPoint,
  ManagementAttentionItem,
  ScoreWeights,
  ScoreThresholds,
  ReportingPeriod,
  ComparisonPeriod,
} from "../types/performance";
import { DEFAULT_WEIGHTS, DEFAULT_THRESHOLDS } from "../lib/scoring";
import { exportReportToCsv, triggerPrintReport } from "../lib/export";
import { db } from "../db/memory";
import { computePortfolioKPIs, computePropertyScorecards, fetchFullReportingData, getDeterministicMonthlyTrends, getManagementAttentionList } from "../db/dataService";

interface RawApiData {
  properties: any[];
  managers: any[];
  buildings: any[];
  units: any[];
  workOrders: any[];
  inspections: any[];
  findings: any[];
  assets: any[];
  projects: any[];
  leases: any[];
  turnovers: any[];
  complaints: any[];
  actions: any[];
  weights: ScoreWeights;
  thresholds: ScoreThresholds;
  scorecards: PropertyScorecard[];
  kpis: PortfolioKPIs;
  trends: MonthlyTrendPoint[];
  attentionList: ManagementAttentionItem[];
}

interface ReportContextType {
  // Data
  isLoading: boolean;
  isRecalculating: boolean;
  lastUpdated: string;
  error: string | null;
  rawData: RawApiData | null;

  // Filters
  filters: GlobalFilterState;
  setFilter: <K extends keyof GlobalFilterState>(key: K, value: GlobalFilterState[K]) => void;
  resetFilters: () => void;
  recalculateData: () => Promise<void>;

  // Weights & scoring config
  weights: ScoreWeights;
  setWeights: React.Dispatch<React.SetStateAction<ScoreWeights>>;
  thresholds: ScoreThresholds;
  resetWeightsToDefault: () => void;

  // Filtered views
  filteredProperties: any[];
  filteredScorecards: PropertyScorecard[];
  filteredWorkOrders: any[];
  filteredInspections: any[];
  filteredFindings: any[];
  filteredAssets: any[];
  filteredProjects: any[];
  filteredLeases: any[];
  filteredTurnovers: any[];
  filteredComplaints: any[];
  filteredActions: any[];
  filteredAttentionList: ManagementAttentionItem[];
  kpis: PortfolioKPIs;
  monthlyTrends: MonthlyTrendPoint[];

  // Period presentation
  periodDisplayLabel: string;
  comparisonDisplayLabel: string;

  // Drilldown & Modals
  drilldownPropertyId: string | null;
  setDrilldownPropertyId: (id: string | null) => void;
  selectedScorecard: PropertyScorecard | null;

  // Record preview modal
  previewRecord: { type: "workOrder" | "inspection" | "asset" | "lease"; record: any } | null;
  setPreviewRecord: (preview: { type: "workOrder" | "inspection" | "asset" | "lease"; record: any } | null) => void;

  // Management Action creation & tracking
  isActionModalOpen: boolean;
  actionModalPrefill: Partial<any> | null;
  openCreateActionModal: (prefill?: Partial<any>) => void;
  closeCreateActionModal: () => void;
  createManagementAction: (actionData: any) => Promise<boolean>;
  updateManagementAction: (id: string, updates: any) => Promise<boolean>;

  // Scoring config modal
  isConfigModalOpen: boolean;
  setIsConfigModalOpen: (open: boolean) => void;

  // Score audit / formula modal
  auditScorecard: PropertyScorecard | null;
  setAuditScorecard: (card: PropertyScorecard | null) => void;

  // Actions drawer
  isActionDrawerOpen: boolean;
  setIsActionDrawerOpen: (open: boolean) => void;

  // Exports
  exportCurrentViewCsv: (title: string, headers: string[], rows: (string | number)[][], summary?: { label: string; value: string | number }[]) => void;
  triggerPrint: () => void;
}

const defaultFilterState: GlobalFilterState = {
  period: "this-quarter",
  propertyIds: [],
  buildingId: "all",
  propertyType: "all",
  managerId: "all",
  comparison: "prior-period",
};

const ReportContext = createContext<ReportContextType | null>(null);

export function ReportProvider({ children }: { children: ReactNode }) {
  const [rawData, setRawData] = useState<RawApiData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>("");

  const [filters, setFilters] = useState<GlobalFilterState>(defaultFilterState);
  const [weights, setWeights] = useState<ScoreWeights>(DEFAULT_WEIGHTS);
  const [thresholds, setThresholds] = useState<ScoreThresholds>(DEFAULT_THRESHOLDS);

  const [drilldownPropertyId, setDrilldownPropertyId] = useState<string | null>(null);
  const [previewRecord, setPreviewRecord] = useState<{ type: "workOrder" | "inspection" | "asset" | "lease"; record: any } | null>(null);
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [actionModalPrefill, setActionModalPrefill] = useState<Partial<any> | null>(null);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [auditScorecard, setAuditScorecard] = useState<PropertyScorecard | null>(null);
  const [isActionDrawerOpen, setIsActionDrawerOpen] = useState(false);

  // Load initial data
  const loadData = async (weightsParam?: ScoreWeights) => {
    try {
      setIsRecalculating(true);
      const activeWeights = weightsParam || weights;
      const base = fetchFullReportingData();
      const scorecards = computePropertyScorecards(base, activeWeights, base.thresholds);
      const data = {
        ...base,
        weights: activeWeights,
        scorecards,
        kpis: computePortfolioKPIs(scorecards),
        trends: getDeterministicMonthlyTrends(),
        attentionList: getManagementAttentionList(base),
      } as RawApiData;
      setRawData(data);
      setThresholds(data.thresholds || DEFAULT_THRESHOLDS);
      setLastUpdated(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
      setError(null);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to fetch reporting data");
    } finally {
      setIsLoading(false);
      setIsRecalculating(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const recalculateData = async () => {
    await loadData(weights);
  };

  const setFilter = <K extends keyof GlobalFilterState>(key: K, value: GlobalFilterState[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const resetFilters = () => {
    setFilters(defaultFilterState);
  };

  const resetWeightsToDefault = () => {
    setWeights(DEFAULT_WEIGHTS);
    loadData(DEFAULT_WEIGHTS);
  };

  // Human-readable labels
  const periodDisplayLabel = useMemo(() => {
    switch (filters.period) {
      case "this-month":
        return "This Month (Feb 2025)";
      case "last-month":
        return "Last Month (Jan 2025)";
      case "this-quarter":
        return "This Quarter (Q1 2025)";
      case "last-quarter":
        return "Last Quarter (Q4 2024)";
      case "ytd":
        return "Year to Date (YTD 2025)";
      case "ltm":
        return "Last 12 Months (LTM)";
      case "this-year":
        return "This Year (2025)";
      case "last-year":
        return "Last Year (2024)";
      case "custom":
        return filters.customStartDate && filters.customEndDate
          ? `${filters.customStartDate} to ${filters.customEndDate}`
          : "Custom Date Range";
      default:
        return "This Quarter (Q1 2025)";
    }
  }, [filters.period, filters.customStartDate, filters.customEndDate]);

  const comparisonDisplayLabel = useMemo(() => {
    switch (filters.comparison) {
      case "prior-period":
        return "vs. Prior Period (Q4 2024)";
      case "prior-year":
        return "vs. Prior Year (Q1 2024)";
      case "target":
        return "vs. Configured Target (80.0)";
      default:
        return "vs. Prior Period";
    }
  }, [filters.comparison]);

  // Reactive Data Filtering based on Global Filters
  const filteredProperties = useMemo(() => {
    if (!rawData) return [];
    return rawData.properties.filter((p) => {
      if (filters.propertyIds.length > 0 && !filters.propertyIds.includes(p.id)) {
        return false;
      }
      if (filters.propertyType !== "all" && p.type !== filters.propertyType) {
        return false;
      }
      if (filters.managerId !== "all" && p.managerId !== filters.managerId) {
        return false;
      }
      return true;
    });
  }, [rawData, filters.propertyIds, filters.propertyType, filters.managerId]);

  const activePropertyIds = useMemo(() => {
    return new Set(filteredProperties.map((p) => p.id));
  }, [filteredProperties]);

  const filteredScorecards = useMemo(() => {
    if (!rawData) return [];
    return rawData.scorecards.filter((s) => activePropertyIds.has(s.propertyId));
  }, [rawData, activePropertyIds]);

  const filteredWorkOrders = useMemo(() => {
    if (!rawData) return [];
    return rawData.workOrders.filter((w) => {
      if (!activePropertyIds.has(w.propertyId)) return false;
      if (filters.buildingId !== "all" && w.buildingId !== filters.buildingId) return false;
      return true;
    });
  }, [rawData, activePropertyIds, filters.buildingId]);

  const filteredInspections = useMemo(() => {
    if (!rawData) return [];
    return rawData.inspections.filter((i) => {
      if (!activePropertyIds.has(i.propertyId)) return false;
      if (filters.buildingId !== "all" && i.buildingId !== filters.buildingId) return false;
      return true;
    });
  }, [rawData, activePropertyIds, filters.buildingId]);

  const filteredFindings = useMemo(() => {
    if (!rawData) return [];
    return rawData.findings.filter((f) => activePropertyIds.has(f.propertyId));
  }, [rawData, activePropertyIds]);

  const filteredAssets = useMemo(() => {
    if (!rawData) return [];
    return rawData.assets.filter((a) => {
      if (!activePropertyIds.has(a.propertyId)) return false;
      if (filters.buildingId !== "all" && a.buildingId !== filters.buildingId) return false;
      return true;
    });
  }, [rawData, activePropertyIds, filters.buildingId]);

  const filteredProjects = useMemo(() => {
    if (!rawData) return [];
    return rawData.projects.filter((p) => activePropertyIds.has(p.propertyId));
  }, [rawData, activePropertyIds]);

  const filteredLeases = useMemo(() => {
    if (!rawData) return [];
    return rawData.leases.filter((l) => activePropertyIds.has(l.propertyId));
  }, [rawData, activePropertyIds]);

  const filteredTurnovers = useMemo(() => {
    if (!rawData) return [];
    return rawData.turnovers.filter((t) => activePropertyIds.has(t.propertyId));
  }, [rawData, activePropertyIds]);

  const filteredComplaints = useMemo(() => {
    if (!rawData) return [];
    return rawData.complaints.filter((c) => activePropertyIds.has(c.propertyId));
  }, [rawData, activePropertyIds]);

  const filteredActions = useMemo(() => {
    if (!rawData) return [];
    return rawData.actions.filter((a) => activePropertyIds.has(a.propertyId));
  }, [rawData, activePropertyIds]);

  const filteredAttentionList = useMemo(() => {
    if (!rawData) return [];
    return rawData.attentionList.filter((a) => activePropertyIds.has(a.propertyId));
  }, [rawData, activePropertyIds]);

  // Calculate dynamic KPIs reconciled with filtered dataset
  const kpis = useMemo<PortfolioKPIs>(() => {
    if (!rawData) {
      return {
        overallScore: 0,
        overallScorePrevious: 0,
        overallScoreChange: 0,
        propertiesAttentionCount: 0,
        propertiesAttentionChange: 0,
        openWorkOrdersCount: 0,
        openWorkOrdersChange: 0,
        overdueWorkOrdersCount: 0,
        overdueWorkOrdersChange: 0,
        overdueInspectionsCount: 0,
        overdueInspectionsChange: 0,
        pmCompletionRate: 0,
        pmCompletionRatePrevious: 0,
        pmCompletionRateChange: 0,
        avgResolutionHours: 0,
        avgResolutionHoursPrevious: 0,
        avgResolutionHoursChange: 0,
        leaseRenewalRate: 0,
        leaseRenewalRatePrevious: 0,
        leaseRenewalRateChange: 0,
      };
    }

    const eligibleScores = filteredScorecards
      .map((s) => s.overallScore)
      .filter((s): s is number => s !== null);
    const avgScore = eligibleScores.length > 0
      ? Math.round((eligibleScores.reduce((a, b) => a + b, 0) / eligibleScores.length) * 10) / 10
      : 0;

    const attentionCount = filteredScorecards.filter(
      (s) => s.classification === "Needs Improvement" || s.classification === "Poor"
    ).length;

    const openWOs = filteredWorkOrders.filter(
      (w) => w.status === "Open" || w.status === "In Progress" || w.status === "Pending Parts"
    ).length;

    const overdueWOs = filteredWorkOrders.filter(
      (w) => w.slaCompliant === false && w.status !== "Completed"
    ).length;

    const overdueInsps = filteredInspections.filter((i) => i.status === "Overdue").length;

    const pmWOs = filteredWorkOrders.filter((w) => w.maintenanceType === "Preventive");
    const pmRate = filteredWorkOrders.length > 0
      ? Math.round((pmWOs.length / filteredWorkOrders.length) * 1000) / 10
      : 84.5;

    const completedWODurations = filteredWorkOrders
      .filter((w) => w.status === "Completed" && w.actualDurationHours)
      .map((w) => Number(w.actualDurationHours));
    const avgRes = completedWODurations.length > 0
      ? Math.round((completedWODurations.reduce((a, b) => a + b, 0) / completedWODurations.length) * 10) / 10
      : 21.4;

    const eligibleLeases = filteredLeases.filter((l) => l.renewalEligible === true);
    const renewedLeases = eligibleLeases.filter((l) => l.renewalOutcome === "Renewed");
    const renewalRate = eligibleLeases.length > 0
      ? Math.round((renewedLeases.length / eligibleLeases.length) * 1000) / 10
      : 78.2;

    return {
      overallScore: avgScore || rawData.kpis.overallScore,
      overallScorePrevious: rawData.kpis.overallScorePrevious,
      overallScoreChange: Math.round(((avgScore || rawData.kpis.overallScore) - rawData.kpis.overallScorePrevious) * 10) / 10,
      propertiesAttentionCount: attentionCount,
      propertiesAttentionChange: 0,
      openWorkOrdersCount: openWOs,
      openWorkOrdersChange: -2,
      overdueWorkOrdersCount: overdueWOs,
      overdueWorkOrdersChange: 1,
      overdueInspectionsCount: overdueInsps,
      overdueInspectionsChange: 0,
      pmCompletionRate: pmRate,
      pmCompletionRatePrevious: rawData.kpis.pmCompletionRatePrevious,
      pmCompletionRateChange: Math.round((pmRate - rawData.kpis.pmCompletionRatePrevious) * 10) / 10,
      avgResolutionHours: avgRes,
      avgResolutionHoursPrevious: rawData.kpis.avgResolutionHoursPrevious,
      avgResolutionHoursChange: Math.round((avgRes - rawData.kpis.avgResolutionHoursPrevious) * 10) / 10,
      leaseRenewalRate: renewalRate,
      leaseRenewalRatePrevious: rawData.kpis.leaseRenewalRatePrevious,
      leaseRenewalRateChange: Math.round((renewalRate - rawData.kpis.leaseRenewalRatePrevious) * 10) / 10,
    };
  }, [rawData, filteredScorecards, filteredWorkOrders, filteredInspections, filteredLeases]);

  const monthlyTrends = useMemo(() => {
    return rawData?.trends ?? [];
  }, [rawData]);

  const selectedScorecard = useMemo(() => {
    if (!drilldownPropertyId || !rawData) return null;
    return rawData.scorecards.find((s) => s.propertyId === drilldownPropertyId) || null;
  }, [drilldownPropertyId, rawData]);

  // Management Action helper functions
  const openCreateActionModal = (prefill?: Partial<any>) => {
    setActionModalPrefill(prefill || null);
    setIsActionModalOpen(true);
  };

  const closeCreateActionModal = () => {
    setIsActionModalOpen(false);
    setActionModalPrefill(null);
  };

  const createManagementAction = async (actionData: any): Promise<boolean> => {
    const today = new Date().toISOString().slice(0, 10);
    const action = {
      id: `act-${Date.now()}`,
      actionRef: `ACT-2025-${Math.floor(100 + Math.random() * 900)}`,
      propertyId: actionData.propertyId || "prop-1",
      relatedType: actionData.relatedType || "Operational",
      relatedRecordRef: actionData.relatedRecordRef || "N/A",
      issueDescription: actionData.issueDescription || "General property management action item",
      priority: actionData.priority || "Medium",
      assignedTo: actionData.assignedTo || "Unassigned",
      dateCreated: today,
      dueDate: actionData.dueDate || new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
      status: actionData.status || "Open",
      resolutionNotes: actionData.resolutionNotes || null,
      completionDate: actionData.status === "Completed" ? today : null,
    };
    db.insert("managementActions").values(action);
    setRawData((prev) => (prev ? { ...prev, actions: [action, ...prev.actions] } : prev));
    closeCreateActionModal();
    return true;
  };

  const updateManagementAction = async (id: string, updates: any): Promise<boolean> => {
    const patch: Record<string, any> = { ...updates };
    if (updates.status === "Completed") patch.completionDate = new Date().toISOString().slice(0, 10);
    else if (updates.status === "Open" || updates.status === "In Progress" || updates.status === "Blocked") patch.completionDate = null;
    db.update("managementActions", id, patch);
    setRawData((prev) => (prev ? { ...prev, actions: prev.actions.map((a) => (a.id === id ? { ...a, ...patch } : a)) } : prev));
    return true;
  };

  // CSV Export utility
  const exportCurrentViewCsv = (
    title: string,
    headers: string[],
    rows: (string | number)[][],
    summary?: { label: string; value: string | number }[]
  ) => {
    const scopeDesc =
      filters.propertyIds.length === 1
        ? filteredProperties[0]?.name || "Single Property"
        : `${filteredProperties.length} Properties in Portfolio`;

    const filtersDesc = `Period: ${periodDisplayLabel} | Comparison: ${comparisonDisplayLabel} | Type: ${filters.propertyType}`;

    const lowCoverage = filteredScorecards.some((s) => !s.isDataSufficient);
    const coverageWarning = lowCoverage
      ? "One or more properties have insufficient data coverage (< 60%) - overall scores excluded."
      : undefined;

    exportReportToCsv({
      reportTitle: title,
      scopeDescription: scopeDesc,
      reportingPeriod: periodDisplayLabel,
      generatedDate: new Date().toLocaleString(),
      filtersApplied: filtersDesc,
      dataCoverageWarning: coverageWarning,
      summaryMetrics: summary,
      tableHeaders: headers,
      tableRows: rows,
    });
  };

  const triggerPrint = () => {
    triggerPrintReport();
  };

  return (
    <ReportContext.Provider
      value={{
        isLoading,
        isRecalculating,
        lastUpdated,
        error,
        rawData,
        filters,
        setFilter,
        resetFilters,
        recalculateData,
        weights,
        setWeights,
        thresholds,
        resetWeightsToDefault,
        filteredProperties,
        filteredScorecards,
        filteredWorkOrders,
        filteredInspections,
        filteredFindings,
        filteredAssets,
        filteredProjects,
        filteredLeases,
        filteredTurnovers,
        filteredComplaints,
        filteredActions,
        filteredAttentionList,
        kpis,
        monthlyTrends,
        periodDisplayLabel,
        comparisonDisplayLabel,
        drilldownPropertyId,
        setDrilldownPropertyId,
        selectedScorecard,
        previewRecord,
        setPreviewRecord,
        isActionModalOpen,
        actionModalPrefill,
        openCreateActionModal,
        closeCreateActionModal,
        createManagementAction,
        updateManagementAction,
        isConfigModalOpen,
        setIsConfigModalOpen,
        auditScorecard,
        setAuditScorecard,
        isActionDrawerOpen,
        setIsActionDrawerOpen,
        exportCurrentViewCsv,
        triggerPrint,
      }}
    >
      {children}
    </ReportContext.Provider>
  );
}

export function useReportContext() {
  const ctx = useContext(ReportContext);
  if (!ctx) {
    throw new Error("useReportContext must be used within a ReportProvider");
  }
  return ctx;
}
