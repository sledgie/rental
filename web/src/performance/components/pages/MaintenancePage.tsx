import React, { useState, useMemo } from "react";
import { useReportContext } from "../../context/ReportContext";
import {
  Wrench,
  Clock,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Filter,
  Search,
  Download,
  ArrowUpDown,
  RefreshCw,
  Plus,
} from "lucide-react";
import {
  DonutPieChart,
  AgingDistributionChart,
  TrendLineChart,
} from "../charts/ChartComponents";

export function MaintenancePage() {
  const {
    filteredWorkOrders,
    rawData,
    setPreviewRecord,
    openCreateActionModal,
    exportCurrentViewCsv,
    periodDisplayLabel,
  } = useReportContext();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [onlyRepeats, setOnlyRepeats] = useState(false);
  const [sortField, setSortField] = useState<string>("reportedDate");
  const [sortAsc, setSortAsc] = useState(false);

  // Exclude cancelled records from operational calculations per rule #4
  const activeWOs = useMemo(() => {
    return filteredWorkOrders.filter((w) => w.status !== "Cancelled");
  }, [filteredWorkOrders]);

  const completedWOs = useMemo(() => {
    return activeWOs.filter((w) => w.status === "Completed");
  }, [activeWOs]);

  const openWOs = useMemo(() => {
    return activeWOs.filter(
      (w) => w.status === "Open" || w.status === "In Progress" || w.status === "Pending Parts"
    );
  }, [activeWOs]);

  const overdueWOs = useMemo(() => {
    return activeWOs.filter((w) => w.slaCompliant === false && w.status !== "Completed");
  }, [activeWOs]);

  const urgentWOs = useMemo(() => {
    return activeWOs.filter((w) => w.priority === "Urgent" || w.priority === "High");
  }, [activeWOs]);

  const repeatWOs = useMemo(() => {
    return activeWOs.filter((w) => w.isRepeatIssue === true);
  }, [activeWOs]);

  const preventiveWOs = useMemo(() => {
    return activeWOs.filter((w) => w.maintenanceType === "Preventive");
  }, [activeWOs]);

  // SLA compliance calculation on completed work orders
  const slaMetCount = completedWOs.filter((w) => w.slaCompliant === true).length;
  const slaComplianceRate = completedWOs.length > 0
    ? Math.round((slaMetCount / completedWOs.length) * 1000) / 10
    : 100;

  // Average & Median resolution times for COMPLETED work orders only
  const completedDurations = completedWOs
    .map((w) => Number(w.actualDurationHours))
    .filter((n) => !isNaN(n) && n > 0)
    .sort((a, b) => a - b);

  const avgResolutionHours = completedDurations.length > 0
    ? Math.round((completedDurations.reduce((a, b) => a + b, 0) / completedDurations.length) * 10) / 10
    : 0;

  const medianResolutionHours = completedDurations.length > 0
    ? completedDurations[Math.floor(completedDurations.length / 2)]
    : 0;

  const repeatIssueRate = activeWOs.length > 0
    ? Math.round((repeatWOs.length / activeWOs.length) * 1000) / 10
    : 0;

  const pmRate = activeWOs.length > 0
    ? Math.round((preventiveWOs.length / activeWOs.length) * 1000) / 10
    : 0;

  // Backlog aging distribution for OPEN work orders
  const agingBuckets = useMemo(() => {
    const today = new Date("2025-02-15").getTime();
    let b0to7 = 0;
    let b8to14 = 0;
    let b15to30 = 0;
    let b30plus = 0;

    openWOs.forEach((w) => {
      const reported = new Date(w.reportedDate).getTime();
      const ageDays = Math.max(0, Math.floor((today - reported) / (1000 * 60 * 60 * 24)));
      if (ageDays <= 7) b0to7++;
      else if (ageDays <= 14) b8to14++;
      else if (ageDays <= 30) b15to30++;
      else b30plus++;
    });

    return [
      { label: "0–7 Days (Normal)", count: b0to7, color: "var(--ok)" },
      { label: "8–14 Days (Aging)", count: b8to14, color: "var(--accent)" },
      { label: "15–30 Days (Escalated)", count: b15to30, color: "#f59e0b" },
      { label: "30+ Days (Critical Backlog)", count: b30plus, color: "#ef4444" },
    ];
  }, [openWOs]);

  // Donut slices
  const statusSlices = [
    { label: "Completed", value: completedWOs.length, color: "var(--ok)" },
    { label: "Open / In Progress", value: openWOs.length, color: "var(--accent)" },
    { label: "Overdue", value: overdueWOs.length, color: "#ef4444" },
  ];

  const prioritySlices = [
    { label: "Urgent", value: activeWOs.filter((w) => w.priority === "Urgent").length, color: "#ef4444" },
    { label: "High", value: activeWOs.filter((w) => w.priority === "High").length, color: "#f59e0b" },
    { label: "Medium", value: activeWOs.filter((w) => w.priority === "Medium").length, color: "var(--accent)" },
    { label: "Low", value: activeWOs.filter((w) => w.priority === "Low").length, color: "#94a3b8" },
  ];

  // Filtering for table
  const displayedWorkOrders = useMemo(() => {
    return activeWOs
      .filter((w) => {
        if (statusFilter !== "all" && w.status !== statusFilter) return false;
        if (priorityFilter !== "all" && w.priority !== priorityFilter) return false;
        if (onlyRepeats && !w.isRepeatIssue) return false;
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          const matchWo = w.woNumber.toLowerCase().includes(q);
          const matchCat = w.category.toLowerCase().includes(q);
          const matchAssignee = w.assignedTo.toLowerCase().includes(q);
          return matchWo || matchCat || matchAssignee;
        }
        return true;
      })
      .sort((a, b) => {
        const valA = a[sortField as keyof typeof a];
        const valB = b[sortField as keyof typeof b];
        if (valA === valB) return 0;
        if (valA === null || valA === undefined) return 1;
        if (valB === null || valB === undefined) return -1;
        if (sortAsc) return valA > valB ? 1 : -1;
        return valA < valB ? 1 : -1;
      });
  }, [activeWOs, statusFilter, priorityFilter, onlyRepeats, searchQuery, sortField, sortAsc]);

  const handleExportCsv = () => {
    const headers = [
      "WO Number",
      "Property",
      "Category",
      "Priority",
      "Type",
      "Reported Date",
      "Completed Date",
      "Duration (Hours)",
      "SLA Status",
      "Assigned To",
      "Repeat Issue",
    ];
    const rows = displayedWorkOrders.map((w) => {
      const prop = rawData?.properties.find((p) => p.id === w.propertyId);
      return [
        w.woNumber,
        prop?.name || w.propertyId,
        w.category,
        w.priority,
        w.maintenanceType,
        w.reportedDate,
        w.completedDate || "Open",
        w.actualDurationHours || "N/A",
        w.slaCompliant === true ? "Met" : w.slaCompliant === false ? "Breached" : "Pending",
        w.assignedTo,
        w.isRepeatIssue ? "Yes" : "No",
      ];
    });
    const summary = [
      { label: "Total Work Orders", value: activeWOs.length },
      { label: "Completed", value: completedWOs.length },
      { label: "Open Backlog", value: openWOs.length },
      { label: "Overdue", value: overdueWOs.length },
      { label: "SLA Compliance Rate", value: `${slaComplianceRate}%` },
      { label: "Average Resolution", value: `${avgResolutionHours} hrs` },
      { label: "Repeat Issue Rate", value: `${repeatIssueRate}%` },
      { label: "PM Completion Rate", value: `${pmRate}%` },
    ];
    exportCurrentViewCsv("Maintenance & Asset Condition Report", headers, rows, summary);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-u-ink tracking-tight">
            Maintenance & Asset Condition Report
          </h1>
          <p className="text-xs sm:text-sm text-u-muted mt-1">
            Evaluates work order resolution velocity, SLA compliance, repeat failure incidence, and backlog aging.
          </p>
        </div>
        <button
          onClick={handleExportCsv}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-u-ink2 bg-u-card border border-u-line rounded-lg shadow-2xs hover:bg-u-s2 self-start sm:self-auto"
        >
          <Download className="w-3.5 h-3.5 text-u-ok" />
          <span>Export Maintenance CSV</span>
        </button>
      </div>

      {/* 7.1 Required Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-3.5 rounded-xl bg-u-card border border-u-line shadow-2xs">
          <span className="text-[10px] font-semibold text-u-muted uppercase">Created Orders</span>
          <div className="text-2xl font-bold text-u-ink mt-0.5">{activeWOs.length}</div>
          <span className="text-[11px] text-u-muted">During {periodDisplayLabel}</span>
        </div>

        <div className="p-3.5 rounded-xl bg-u-card border border-u-line shadow-2xs">
          <span className="text-[10px] font-semibold text-u-muted uppercase">Completed</span>
          <div className="text-2xl font-bold text-u-ok mt-0.5">{completedWOs.length}</div>
          <span className="text-[11px] text-u-muted">{activeWOs.length > 0 ? Math.round((completedWOs.length / activeWOs.length) * 100) : 0}% completion</span>
        </div>

        <div className="p-3.5 rounded-xl bg-u-card border border-u-line shadow-2xs">
          <span className="text-[10px] font-semibold text-u-muted uppercase">Open / Backlog</span>
          <div className="text-2xl font-bold text-u-ink mt-0.5">{openWOs.length}</div>
          <span className="text-[11px] text-u-muted">{overdueWOs.length} overdue</span>
        </div>

        <div className="p-3.5 rounded-xl bg-u-card border border-u-line shadow-2xs">
          <span className="text-[10px] font-semibold text-u-muted uppercase">SLA Compliance</span>
          <div className="text-2xl font-bold text-u-accent mt-0.5">{slaComplianceRate}%</div>
          <span className="text-[11px] text-u-muted">Target: &gt; 90%</span>
        </div>

        <div className="p-3.5 rounded-xl bg-u-card border border-u-line shadow-2xs">
          <span className="text-[10px] font-semibold text-u-muted uppercase">Avg / Median Time</span>
          <div className="text-xl font-bold text-u-ink mt-0.5">{avgResolutionHours}h / {medianResolutionHours}h</div>
          <span className="text-[11px] text-u-muted">Completed orders only</span>
        </div>

        <div className="p-3.5 rounded-xl bg-u-card border border-u-line shadow-2xs">
          <span className="text-[10px] font-semibold text-u-muted uppercase">Repeat Issue Rate</span>
          <div className={`text-2xl font-bold mt-0.5 ${repeatIssueRate > 10 ? "text-u-warn" : "text-u-ink"}`}>
            {repeatIssueRate}%
          </div>
          <span className="text-[11px] text-u-muted">60-day component window</span>
        </div>
      </div>

      {/* 7.2 Charts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Status Distribution */}
        <div className="p-5 rounded-2xl bg-u-card border border-u-line shadow-xs">
          <h3 className="text-xs font-bold text-u-ink uppercase tracking-wider mb-3">
            Work Orders by Status
          </h3>
          <DonutPieChart slices={statusSlices} centerValue={activeWOs.length} centerTitle="Total WOs" />
        </div>

        {/* Priority Breakdown */}
        <div className="p-5 rounded-2xl bg-u-card border border-u-line shadow-xs">
          <h3 className="text-xs font-bold text-u-ink uppercase tracking-wider mb-3">
            Orders by Priority
          </h3>
          <DonutPieChart slices={prioritySlices} centerValue={urgentWOs.length} centerTitle="Urgent/High" />
        </div>

        {/* Backlog Aging */}
        <div className="p-5 rounded-2xl bg-u-card border border-u-line shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-u-ink uppercase tracking-wider">
              Open Backlog Aging
            </h3>
            <span className="text-[11px] font-semibold text-u-muted">{openWOs.length} active in queue</span>
          </div>
          <AgingDistributionChart buckets={agingBuckets} />
          <p className="text-[10px] text-u-muted mt-3 pt-2 border-t border-u-line">
            Aging calculated separately from completed duration to prevent metric distortion.
          </p>
        </div>
      </div>

      {/* 7.3 Maintenance Detail Table with Filters & Search */}
      <div className="p-6 rounded-2xl bg-u-card border border-u-line shadow-xs">
        {/* Table Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-u-line">
          <div>
            <h3 className="text-base font-bold text-u-ink">Work Order Operational Records</h3>
            <p className="text-xs text-u-muted mt-0.5">
              Click any row to inspect resolution notes, timeline timestamps, or dispatch actions
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-u-muted absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Search WO#, category, tech..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="text-xs pl-8 pr-3 py-1.5 border border-u-line2 rounded-lg bg-u-s2 focus:bg-u-card text-u-ink"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs border border-u-line2 rounded-lg px-2.5 py-1.5 bg-u-s2 text-u-ink"
            >
              <option value="all">All Statuses</option>
              <option value="Completed">Completed</option>
              <option value="Open">Open</option>
              <option value="In Progress">In Progress</option>
            </select>

            {/* Priority Filter */}
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="text-xs border border-u-line2 rounded-lg px-2.5 py-1.5 bg-u-s2 text-u-ink"
            >
              <option value="all">All Priorities</option>
              <option value="Urgent">Urgent</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>

            {/* Repeat Filter Toggle */}
            <button
              onClick={() => setOnlyRepeats(!onlyRepeats)}
              className={`text-xs px-2.5 py-1.5 rounded-lg border font-medium transition ${
                onlyRepeats
                  ? "bg-u-warn-soft border-u-warn/30 text-u-warn"
                  : "bg-u-s2 border-u-line2 text-u-ink2 hover:bg-u-s3"
              }`}
            >
              Repeats Only ({repeatWOs.length})
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto mt-4">
          <table className="min-w-full text-xs divide-y divide-u-line">
            <thead className="bg-u-s2 text-u-ink2 font-semibold">
              <tr>
                <th
                  onClick={() => {
                    setSortField("woNumber");
                    setSortAsc(!sortAsc);
                  }}
                  className="px-3 py-2.5 text-left cursor-pointer hover:text-u-ink"
                >
                  <div className="flex items-center gap-1">
                    <span>WO Number</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="px-3 py-2.5 text-left">Property & Unit</th>
                <th className="px-3 py-2.5 text-left">Category</th>
                <th className="px-3 py-2.5 text-left">Priority</th>
                <th className="px-3 py-2.5 text-left">Type</th>
                <th className="px-3 py-2.5 text-left">Reported Date</th>
                <th className="px-3 py-2.5 text-left">Assigned Tech</th>
                <th className="px-3 py-2.5 text-left">Status</th>
                <th className="px-3 py-2.5 text-right">Duration</th>
                <th className="px-3 py-2.5 text-center">SLA Compliance</th>
                <th className="px-3 py-2.5 text-center">Repeat?</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-u-line bg-u-card">
              {displayedWorkOrders.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-u-muted">
                    No work order records match the applied criteria.
                  </td>
                </tr>
              ) : (
                displayedWorkOrders.map((wo) => {
                  const prop = rawData?.properties.find((p) => p.id === wo.propertyId);
                  return (
                    <tr
                      key={wo.id}
                      onClick={() => setPreviewRecord({ type: "workOrder", record: wo })}
                      className="hover:bg-u-s2/70 cursor-pointer transition"
                    >
                      <td className="px-3 py-3 font-mono font-bold text-u-accent">{wo.woNumber}</td>
                      <td className="px-3 py-3">
                        <div className="font-medium text-u-ink">{prop?.name}</div>
                        <div className="text-[10px] text-u-muted">{wo.unitId ? `Unit ${wo.unitId.replace("u-", "")}` : "Common Area"}</div>
                      </td>
                      <td className="px-3 py-3 font-medium text-u-ink">{wo.category}</td>
                      <td className="px-3 py-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            wo.priority === "Urgent"
                              ? "bg-u-danger-soft text-u-danger font-bold"
                              : wo.priority === "High"
                              ? "bg-u-warn-soft text-u-warn"
                              : "bg-u-s3 text-u-ink2"
                          }`}
                        >
                          {wo.priority}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            wo.maintenanceType === "Preventive"
                              ? "bg-u-ok-soft text-u-ok"
                              : "bg-u-s3 text-u-ink2"
                          }`}
                        >
                          {wo.maintenanceType}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-u-muted font-medium">{wo.reportedDate}</td>
                      <td className="px-3 py-3 text-u-ink2">
                        <div>{wo.assignedTo}</div>
                        <div className="text-[10px] text-u-muted">{wo.assignedRole}</div>
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                            wo.status === "Completed"
                              ? "bg-u-ok-soft text-u-ok"
                              : wo.status === "In Progress"
                              ? "bg-u-accent-soft text-u-accent"
                              : "bg-u-warn-soft text-u-warn"
                          }`}
                        >
                          {wo.status}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-u-ink font-semibold">
                        {wo.actualDurationHours ? `${wo.actualDurationHours}h` : "--"}
                      </td>
                      <td className="px-3 py-3 text-center">
                        {wo.slaCompliant === true ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-u-ok-soft text-u-ok border border-u-ok/30">
                            Met ({wo.targetSlaHours}h)
                          </span>
                        ) : wo.slaCompliant === false ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-u-danger-soft text-u-danger border border-u-danger/30">
                            Breached
                          </span>
                        ) : (
                          <span className="text-[10px] text-u-muted">Target {wo.targetSlaHours}h</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-center">
                        {wo.isRepeatIssue ? (
                          <span className="px-1.5 py-0.5 rounded bg-u-warn-soft text-u-warn font-bold text-[10px]" title={wo.repeatRootAsset || "Repeat defect"}>
                            REPEAT
                          </span>
                        ) : (
                          <span className="text-u-s3">--</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
