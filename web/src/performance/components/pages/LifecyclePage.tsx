import React, { useState, useMemo } from "react";
import { useReportContext } from "../../context/ReportContext";
import {
  Layers,
  Box,
  AlertTriangle,
  Clock,
  Calendar,
  Wrench,
  Download,
  CheckCircle2,
  AlertCircle,
  Building,
  Plus,
} from "lucide-react";
import { DonutPieChart, AgingDistributionChart } from "../charts/ChartComponents";

export function LifecyclePage() {
  const {
    filteredAssets,
    filteredProjects,
    rawData,
    setPreviewRecord,
    openCreateActionModal,
    exportCurrentViewCsv,
  } = useReportContext();

  const [conditionFilter, setConditionFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const totalAssetsCount = filteredAssets.length;
  const criticalPriorityAssets = filteredAssets.filter(
    (a) => a.replacementPriority === "Critical" || a.conditionRating === "Critical"
  );
  const deferredAssets = filteredAssets.filter((a) => a.deferredMaintenance === true);
  const zeroRulAssets = filteredAssets.filter((a) => Number(a.remainingUsefulLifeYears) <= 0);

  // Remaining Useful Life (RUL) buckets
  const rulBuckets = useMemo(() => {
    let b0to1 = 0;
    let b1to3 = 0;
    let b3to5 = 0;
    let b5plus = 0;

    filteredAssets.forEach((a) => {
      const rul = Number(a.remainingUsefulLifeYears);
      if (rul <= 1) b0to1++;
      else if (rul <= 3) b1to3++;
      else if (rul <= 5) b3to5++;
      else b5plus++;
    });

    return [
      { label: "0–1 Years (Immediate Capital Need)", count: b0to1, color: "#ef4444" },
      { label: "1–3 Years (Near-Term Planning)", count: b1to3, color: "#f59e0b" },
      { label: "3–5 Years (Mid-Term Horizon)", count: b3to5, color: "var(--accent)" },
      { label: "5+ Years (Routine Monitoring)", count: b5plus, color: "var(--ok)" },
    ];
  }, [filteredAssets]);

  // Condition slices
  const conditionSlices = [
    { label: "Excellent", value: filteredAssets.filter((a) => a.conditionRating === "Excellent").length, color: "var(--ok)" },
    { label: "Good", value: filteredAssets.filter((a) => a.conditionRating === "Good").length, color: "var(--accent)" },
    { label: "Fair", value: filteredAssets.filter((a) => a.conditionRating === "Fair").length, color: "#f59e0b" },
    { label: "Poor / Critical", value: filteredAssets.filter((a) => a.conditionRating === "Poor" || a.conditionRating === "Critical").length, color: "#ef4444" },
  ];

  // Capital projects status slices
  const projectSlices = [
    { label: "Approved / Scheduled", value: filteredProjects.filter((p) => p.status === "Approved").length, color: "var(--ok)" },
    { label: "In Progress", value: filteredProjects.filter((p) => p.status === "In Progress").length, color: "var(--accent)" },
    { label: "Bidding RFP", value: filteredProjects.filter((p) => p.status === "Bidding").length, color: "#f59e0b" },
    { label: "Planning / Scoping", value: filteredProjects.filter((p) => p.status === "Planning").length, color: "#94a3b8" },
  ];

  const displayedAssets = useMemo(() => {
    return filteredAssets.filter((a) => {
      if (conditionFilter !== "all" && a.conditionRating !== conditionFilter) return false;
      if (priorityFilter !== "all" && a.replacementPriority !== priorityFilter) return false;
      if (categoryFilter !== "all" && a.category !== categoryFilter) return false;
      return true;
    });
  }, [filteredAssets, conditionFilter, priorityFilter, categoryFilter]);

  const handleExportCsv = () => {
    const headers = [
      "Asset Tag",
      "Property",
      "Component Name",
      "Category",
      "Install Date",
      "EUL (Yrs)",
      "RUL (Yrs)",
      "Condition",
      "Repair Count",
      "Replacement Priority",
      "Deferred Maint",
      "Replacement Est ($)",
    ];
    const rows = displayedAssets.map((a) => {
      const prop = rawData?.properties.find((p) => p.id === a.propertyId);
      return [
        a.assetTag,
        prop?.name || a.propertyId,
        a.componentName,
        a.category,
        a.installDate,
        a.estimatedUsefulLifeYears,
        a.remainingUsefulLifeYears,
        a.conditionRating,
        a.repairCount || 0,
        a.replacementPriority,
        a.deferredMaintenance ? "YES" : "No",
        a.estimatedReplacementCost || 0,
      ];
    });
    const summary = [
      { label: "Total Assets Evaluated", value: totalAssetsCount },
      { label: "Critical Replacement Priority", value: criticalPriorityAssets.length },
      { label: "Deferred Maintenance Assets", value: deferredAssets.length },
      { label: "Assets Past Useful Life", value: zeroRulAssets.length },
    ];
    exportCurrentViewCsv("Asset Lifecycle & Capital Planning Report", headers, rows, summary);
  };

  const assetCategories = Array.from(new Set(filteredAssets.map((a) => a.category)));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-u-ink tracking-tight">
            Asset Lifecycle & Capital Improvement Report
          </h1>
          <p className="text-xs sm:text-sm text-u-muted mt-1">
            Component useful-life forecasting, replacement prioritization, and capital project tracking.
          </p>
        </div>
        <button
          onClick={handleExportCsv}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-u-ink2 bg-u-card border border-u-line rounded-lg shadow-2xs hover:bg-u-s2 self-start sm:self-auto"
        >
          <Download className="w-3.5 h-3.5 text-u-ok" />
          <span>Export Asset CSV</span>
        </button>
      </div>

      {/* 11.1 Required KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
        <div className="p-3.5 rounded-xl bg-u-card border border-u-line shadow-2xs">
          <span className="text-[10px] font-semibold text-u-muted uppercase">Tracked Assets</span>
          <div className="text-2xl font-bold text-u-ink mt-0.5">{totalAssetsCount}</div>
          <span className="text-[11px] text-u-muted">Major building systems</span>
        </div>

        <div className="p-3.5 rounded-xl bg-u-card border border-u-line shadow-2xs">
          <span className="text-[10px] font-semibold text-u-muted uppercase">Critical Priority</span>
          <div className={`text-2xl font-bold mt-0.5 ${criticalPriorityAssets.length > 0 ? "text-u-danger" : "text-u-ink"}`}>
            {criticalPriorityAssets.length}
          </div>
          <span className="text-[11px] text-u-muted">Immediate capital planning</span>
        </div>

        <div className="p-3.5 rounded-xl bg-u-card border border-u-line shadow-2xs">
          <span className="text-[10px] font-semibold text-u-muted uppercase">Deferred Maintenance</span>
          <div className={`text-2xl font-bold mt-0.5 ${deferredAssets.length > 0 ? "text-u-warn" : "text-u-ink"}`}>
            {deferredAssets.length}
          </div>
          <span className="text-[11px] text-u-muted">Unresolved past due repairs</span>
        </div>

        <div className="p-3.5 rounded-xl bg-u-card border border-u-line shadow-2xs">
          <span className="text-[10px] font-semibold text-u-muted uppercase">Past Useful Life</span>
          <div className="text-2xl font-bold text-u-ink mt-0.5">{zeroRulAssets.length}</div>
          <span className="text-[11px] text-u-muted">0.0 years RUL remaining</span>
        </div>

        <div className="p-3.5 rounded-xl bg-u-card border border-u-line shadow-2xs">
          <span className="text-[10px] font-semibold text-u-muted uppercase">Active Capital Projects</span>
          <div className="text-2xl font-bold text-u-accent mt-0.5">{filteredProjects.length}</div>
          <span className="text-[11px] text-u-muted">In planning or execution</span>
        </div>
      </div>

      {/* 11.3 Charts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Assets by Condition */}
        <div className="p-5 rounded-2xl bg-u-card border border-u-line shadow-xs">
          <h3 className="text-xs font-bold text-u-ink uppercase tracking-wider mb-3">
            Assets by Condition Rating
          </h3>
          <DonutPieChart slices={conditionSlices} centerValue={totalAssetsCount} centerTitle="Total Assets" />
        </div>

        {/* Replacement Schedule by Horizon */}
        <div className="p-5 rounded-2xl bg-u-card border border-u-line shadow-xs">
          <h3 className="text-xs font-bold text-u-ink uppercase tracking-wider mb-3">
            Remaining Useful Life Horizon
          </h3>
          <AgingDistributionChart buckets={rulBuckets} />
        </div>

        {/* Capital Projects Status */}
        <div className="p-5 rounded-2xl bg-u-card border border-u-line shadow-xs">
          <h3 className="text-xs font-bold text-u-ink uppercase tracking-wider mb-3">
            Capital Projects Status
          </h3>
          <DonutPieChart slices={projectSlices} centerValue={filteredProjects.length} centerTitle="Projects" />
        </div>
      </div>

      {/* Active Capital Improvement Projects Table */}
      <div className="p-6 rounded-2xl bg-u-card border border-u-line shadow-xs">
        <div className="flex items-center justify-between pb-4 border-b border-u-line">
          <div>
            <h3 className="text-base font-bold text-u-ink">Active Capital Improvement Projects</h3>
            <p className="text-xs text-u-muted mt-0.5">
              Major preservation initiatives scheduled across the portfolio (excludes operational operating expenses)
            </p>
          </div>
        </div>

        <div className="overflow-x-auto mt-4">
          <table className="min-w-full text-xs divide-y divide-u-line">
            <thead className="bg-u-s2 text-u-ink2 font-semibold">
              <tr>
                <th className="px-3 py-2.5 text-left">Code</th>
                <th className="px-3 py-2.5 text-left">Property</th>
                <th className="px-3 py-2.5 text-left">Project Title</th>
                <th className="px-3 py-2.5 text-left">Category</th>
                <th className="px-3 py-2.5 text-left">Schedule Horizon</th>
                <th className="px-3 py-2.5 text-left">Status</th>
                <th className="px-3 py-2.5 text-left">Priority</th>
                <th className="px-3 py-2.5 text-right">Estimated Budget</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-u-line bg-u-card">
              {filteredProjects.map((proj) => {
                const prop = rawData?.properties.find((p) => p.id === proj.propertyId);
                return (
                  <tr key={proj.id} className="hover:bg-u-s2">
                    <td className="px-3 py-3 font-mono font-bold text-u-accent">{proj.projectCode}</td>
                    <td className="px-3 py-3 font-medium text-u-ink">{prop?.name}</td>
                    <td className="px-3 py-3 font-semibold text-u-ink max-w-xs">{proj.title}</td>
                    <td className="px-3 py-3 text-u-ink2">{proj.assetCategory}</td>
                    <td className="px-3 py-3 text-u-muted font-medium">
                      {proj.plannedStartDate} &rarr; {proj.plannedCompletionDate}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          proj.status === "In Progress"
                            ? "bg-u-accent-soft text-u-accent"
                            : proj.status === "Approved"
                            ? "bg-u-ok-soft text-u-ok"
                            : "bg-u-warn-soft text-u-warn"
                        }`}
                      >
                        {proj.status}
                      </span>
                    </td>
                    <td className="px-3 py-3 font-semibold">
                      <span className={proj.priority === "Critical" ? "text-u-danger font-bold" : "text-u-ink2"}>
                        {proj.priority}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right font-mono font-bold text-u-ink">
                      ${proj.estimatedBudget.toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Asset Register Detail Table with Filters */}
      <div className="p-6 rounded-2xl bg-u-card border border-u-line shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-u-line">
          <div>
            <h3 className="text-base font-bold text-u-ink">Asset Preservation Register</h3>
            <p className="text-xs text-u-muted mt-0.5">
              Click any asset row to review maintenance logs, repair history, or generate an action item
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="text-xs border border-u-line2 rounded-lg px-2.5 py-1.5 bg-u-s2 text-u-ink"
            >
              <option value="all">All Categories</option>
              {assetCategories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            <select
              value={conditionFilter}
              onChange={(e) => setConditionFilter(e.target.value)}
              className="text-xs border border-u-line2 rounded-lg px-2.5 py-1.5 bg-u-s2 text-u-ink"
            >
              <option value="all">All Conditions</option>
              <option value="Excellent">Excellent</option>
              <option value="Good">Good</option>
              <option value="Fair">Fair</option>
              <option value="Poor">Poor</option>
              <option value="Critical">Critical</option>
            </select>

            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="text-xs border border-u-line2 rounded-lg px-2.5 py-1.5 bg-u-s2 text-u-ink"
            >
              <option value="all">All Priorities</option>
              <option value="Critical">Critical</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto mt-4">
          <table className="min-w-full text-xs divide-y divide-u-line">
            <thead className="bg-u-s2 text-u-ink2 font-semibold">
              <tr>
                <th className="px-3 py-2.5 text-left">Tag</th>
                <th className="px-3 py-2.5 text-left">Property</th>
                <th className="px-3 py-2.5 text-left">Component Name</th>
                <th className="px-3 py-2.5 text-left">Category</th>
                <th className="px-3 py-2.5 text-left">Install Date</th>
                <th className="px-3 py-2.5 text-center">Remaining Life</th>
                <th className="px-3 py-2.5 text-center">Condition</th>
                <th className="px-3 py-2.5 text-center">Repairs</th>
                <th className="px-3 py-2.5 text-center">Deferred Maint.</th>
                <th className="px-3 py-2.5 text-center">Priority</th>
                <th className="px-3 py-2.5 text-right">Repl. Budget</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-u-line bg-u-card">
              {displayedAssets.map((asset) => {
                const prop = rawData?.properties.find((p) => p.id === asset.propertyId);
                return (
                  <tr
                    key={asset.id}
                    onClick={() => setPreviewRecord({ type: "asset", record: asset })}
                    className="hover:bg-u-s2 cursor-pointer transition"
                  >
                    <td className="px-3 py-3 font-mono font-bold text-u-accent">{asset.assetTag}</td>
                    <td className="px-3 py-3 font-medium text-u-ink">{prop?.name}</td>
                    <td className="px-3 py-3 font-semibold text-u-ink">{asset.componentName}</td>
                    <td className="px-3 py-3 text-u-ink2">{asset.category}</td>
                    <td className="px-3 py-3 text-u-muted font-medium">{asset.installDate}</td>
                    <td className="px-3 py-3 text-center font-bold text-u-ink">
                      {asset.remainingUsefulLifeYears} yrs
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${
                          asset.conditionRating === "Excellent"
                            ? "bg-u-ok-soft text-u-ok"
                            : asset.conditionRating === "Good"
                            ? "bg-u-accent-soft text-u-accent"
                            : asset.conditionRating === "Fair"
                            ? "bg-u-warn-soft text-u-warn"
                            : "bg-u-danger-soft text-u-danger"
                        }`}
                      >
                        {asset.conditionRating}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center font-mono font-medium text-u-ink2">
                      {asset.repairCount || 0}
                    </td>
                    <td className="px-3 py-3 text-center">
                      {asset.deferredMaintenance ? (
                        <span className="px-1.5 py-0.5 rounded bg-u-danger-soft text-u-danger font-bold text-[10px]">
                          YES
                        </span>
                      ) : (
                        <span className="text-u-s3">No</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span
                        className={`font-semibold ${
                          asset.replacementPriority === "Critical"
                            ? "text-u-danger font-bold"
                            : asset.replacementPriority === "High"
                            ? "text-u-warn font-bold"
                            : "text-u-ink2"
                        }`}
                      >
                        {asset.replacementPriority}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right font-mono font-bold text-u-ink">
                      ${asset.estimatedReplacementCost?.toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
