import React, { useState, useMemo } from "react";
import { useReportContext } from "../../context/ReportContext";
import {
  ClipboardCheck,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Filter,
  Search,
  Download,
  Plus,
  ArrowRight,
  ShieldCheck,
  Building,
} from "lucide-react";
import { DonutPieChart } from "../charts/ChartComponents";

export function InspectionPage() {
  const {
    filteredInspections,
    filteredFindings,
    rawData,
    setPreviewRecord,
    openCreateActionModal,
    exportCurrentViewCsv,
    periodDisplayLabel,
  } = useReportContext();

  const [activeSubTab, setActiveSubTab] = useState<"audits" | "findings">("audits");
  const [resultFilter, setResultFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const scheduledCount = filteredInspections.length;
  const completedCount = filteredInspections.filter((i) => i.status === "Completed").length;
  const overdueCount = filteredInspections.filter((i) => i.status === "Overdue").length;

  const completionRate = scheduledCount > 0
    ? Math.round((completedCount / scheduledCount) * 1000) / 10
    : 100;

  const completedWithResult = filteredInspections.filter(
    (i) => i.status === "Completed" && i.overallResult
  );
  const passedCount = completedWithResult.filter(
    (i) => i.overallResult === "Pass" || i.overallResult === "Pass with Notes"
  ).length;
  const passRate = completedWithResult.length > 0
    ? Math.round((passedCount / completedWithResult.length) * 1000) / 10
    : 0;

  const conditionScores = filteredInspections
    .map((i) => i.conditionScore)
    .filter((s): s is number => s !== null && s !== undefined);
  const avgConditionScore = conditionScores.length > 0
    ? Math.round((conditionScores.reduce((a, b) => a + b, 0) / conditionScores.length) * 10) / 10
    : 84.5;

  const criticalFindings = filteredFindings.filter((f) => f.severity === "Critical");
  const highFindings = filteredFindings.filter((f) => f.severity === "High");
  const overdueFindings = filteredFindings.filter((f) => f.resolutionStatus === "Overdue");
  const openFindings = filteredFindings.filter((f) => f.resolutionStatus !== "Resolved");

  // Chart slices
  const resultSlices = [
    { label: "Passed Clean", value: completedWithResult.filter((i) => i.overallResult === "Pass").length, color: "var(--ok)" },
    { label: "Pass w/ Notes", value: completedWithResult.filter((i) => i.overallResult === "Pass with Notes").length, color: "var(--accent)" },
    { label: "Failed Audit", value: completedWithResult.filter((i) => i.overallResult === "Fail").length, color: "#ef4444" },
    { label: "Overdue Audit", value: overdueCount, color: "#f59e0b" },
  ];

  const severitySlices = [
    { label: "Critical Hazard", value: criticalFindings.length, color: "#ef4444" },
    { label: "High Severity", value: highFindings.length, color: "#f59e0b" },
    { label: "Medium", value: filteredFindings.filter((f) => f.severity === "Medium").length, color: "var(--accent)" },
    { label: "Low Defect", value: filteredFindings.filter((f) => f.severity === "Low").length, color: "#94a3b8" },
  ];

  const handleExportCsv = () => {
    if (activeSubTab === "audits") {
      const headers = ["Ref Number", "Property", "Type", "Scheduled Date", "Inspector", "Status", "Outcome", "Score"];
      const rows = filteredInspections.map((i) => {
        const prop = rawData?.properties.find((p) => p.id === i.propertyId);
        return [
          i.refNumber,
          prop?.name || i.propertyId,
          i.inspectionType,
          i.scheduledDate,
          i.inspectorName,
          i.status,
          i.overallResult || "N/A",
          i.conditionScore ? `${i.conditionScore}/100` : "N/A",
        ];
      });
      exportCurrentViewCsv("Property Condition & Inspection Audits", headers, rows);
    } else {
      const headers = ["Property", "Severity", "Category", "Description", "Corrective Action", "Assigned", "Due Date", "Status"];
      const rows = filteredFindings.map((f) => {
        const prop = rawData?.properties.find((p) => p.id === f.propertyId);
        return [
          prop?.name || f.propertyId,
          f.severity,
          f.category,
          f.description,
          f.correctiveActionRequired,
          f.assignedTo || "Unassigned",
          f.dueDate,
          f.resolutionStatus,
        ];
      });
      exportCurrentViewCsv("Inspection Findings & Corrective Actions", headers, rows);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-u-ink tracking-tight">
            Property Condition & Inspection Report
          </h1>
          <p className="text-xs sm:text-sm text-u-muted mt-1">
            Physical safety assessments, municipal compliance audits, defect discoveries, and corrective workflows.
          </p>
        </div>
        <button
          onClick={handleExportCsv}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-u-ink2 bg-u-card border border-u-line rounded-lg shadow-2xs hover:bg-u-s2 self-start sm:self-auto"
        >
          <Download className="w-3.5 h-3.5 text-u-ok" />
          <span>Export Inspection CSV</span>
        </button>
      </div>

      {/* 8.1 Required Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-3.5 rounded-xl bg-u-card border border-u-line shadow-2xs">
          <span className="text-[10px] font-semibold text-u-muted uppercase">Inspections Scheduled</span>
          <div className="text-2xl font-bold text-u-ink mt-0.5">{scheduledCount}</div>
          <span className="text-[11px] text-u-muted">{completedCount} completed</span>
        </div>

        <div className="p-3.5 rounded-xl bg-u-card border border-u-line shadow-2xs">
          <span className="text-[10px] font-semibold text-u-muted uppercase">Completion Rate</span>
          <div className="text-2xl font-bold text-u-accent mt-0.5">{completionRate}%</div>
          <span className="text-[11px] text-u-muted">{overdueCount} overdue audits</span>
        </div>

        <div className="p-3.5 rounded-xl bg-u-card border border-u-line shadow-2xs">
          <span className="text-[10px] font-semibold text-u-muted uppercase">Audit Pass Rate</span>
          <div className="text-2xl font-bold text-u-ok mt-0.5">{passRate}%</div>
          <span className="text-[11px] text-u-muted">Of completed inspections</span>
        </div>

        <div className="p-3.5 rounded-xl bg-u-card border border-u-line shadow-2xs">
          <span className="text-[10px] font-semibold text-u-muted uppercase">Avg Condition Score</span>
          <div className="text-2xl font-bold text-u-ink mt-0.5">{avgConditionScore}</div>
          <span className="text-[11px] text-u-muted">Physical score (0–100)</span>
        </div>

        <div className="p-3.5 rounded-xl bg-u-card border border-u-line shadow-2xs">
          <span className="text-[10px] font-semibold text-u-muted uppercase">Critical Findings</span>
          <div className={`text-2xl font-bold mt-0.5 ${criticalFindings.length > 0 ? "text-u-danger" : "text-u-ink"}`}>
            {criticalFindings.length}
          </div>
          <span className="text-[11px] text-u-muted">Immediate safety risk</span>
        </div>

        <div className="p-3.5 rounded-xl bg-u-card border border-u-line shadow-2xs">
          <span className="text-[10px] font-semibold text-u-muted uppercase">Overdue Corrective</span>
          <div className={`text-2xl font-bold mt-0.5 ${overdueFindings.length > 0 ? "text-u-danger" : "text-u-ink"}`}>
            {overdueFindings.length}
          </div>
          <span className="text-[11px] text-u-muted">Actions past due date</span>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-5 rounded-2xl bg-u-card border border-u-line shadow-xs">
          <h3 className="text-xs font-bold text-u-ink uppercase tracking-wider mb-3">
            Inspection Outcomes & Status
          </h3>
          <DonutPieChart slices={resultSlices} centerValue={scheduledCount} centerTitle="Total Audits" />
        </div>

        <div className="p-5 rounded-2xl bg-u-card border border-u-line shadow-xs">
          <h3 className="text-xs font-bold text-u-ink uppercase tracking-wider mb-3">
            Discovered Findings by Severity
          </h3>
          <DonutPieChart slices={severitySlices} centerValue={filteredFindings.length} centerTitle="Total Defects" />
        </div>
      </div>

      {/* Sub-Tabs: Inspections vs Findings */}
      <div className="p-6 rounded-2xl bg-u-card border border-u-line shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-u-line">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveSubTab("audits")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeSubTab === "audits"
                  ? "bg-u-ink2 text-u-onaccent"
                  : "bg-u-s3 text-u-ink2 hover:bg-u-line"
              }`}
            >
              Inspections Schedule ({filteredInspections.length})
            </button>
            <button
              onClick={() => setActiveSubTab("findings")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                activeSubTab === "findings"
                  ? "bg-u-ink2 text-u-onaccent"
                  : "bg-u-s3 text-u-ink2 hover:bg-u-line"
              }`}
            >
              <span>Findings & Defects ({filteredFindings.length})</span>
              {criticalFindings.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-u-danger text-u-onaccent text-[10px]">
                  {criticalFindings.length} Critical
                </span>
              )}
            </button>
          </div>

          <p className="text-xs text-u-muted">
            Note: Legal compliance is recorded only when confirmed by municipal certifying authorities.
          </p>
        </div>

        {/* Tab A: Inspection Audits */}
        {activeSubTab === "audits" && (
          <div className="overflow-x-auto mt-4">
            <table className="min-w-full text-xs divide-y divide-u-line">
              <thead className="bg-u-s2 text-u-ink2 font-semibold">
                <tr>
                  <th className="px-3 py-2.5 text-left">Ref Number</th>
                  <th className="px-3 py-2.5 text-left">Property</th>
                  <th className="px-3 py-2.5 text-left">Inspection Type</th>
                  <th className="px-3 py-2.5 text-left">Scheduled Date</th>
                  <th className="px-3 py-2.5 text-left">Inspector / Authority</th>
                  <th className="px-3 py-2.5 text-left">Status</th>
                  <th className="px-3 py-2.5 text-center">Outcome</th>
                  <th className="px-3 py-2.5 text-center">Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-u-line bg-u-card">
                {filteredInspections.map((insp) => {
                  const prop = rawData?.properties.find((p) => p.id === insp.propertyId);
                  return (
                    <tr
                      key={insp.id}
                      onClick={() => setPreviewRecord({ type: "inspection", record: insp })}
                      className="hover:bg-u-s2 cursor-pointer transition"
                    >
                      <td className="px-3 py-3 font-mono font-bold text-u-accent">{insp.refNumber}</td>
                      <td className="px-3 py-3 font-medium text-u-ink">{prop?.name}</td>
                      <td className="px-3 py-3 font-medium text-u-ink">{insp.inspectionType}</td>
                      <td className="px-3 py-3 text-u-muted font-medium">{insp.scheduledDate}</td>
                      <td className="px-3 py-3 text-u-ink2">{insp.inspectorName}</td>
                      <td className="px-3 py-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            insp.status === "Completed"
                              ? "bg-u-ok-soft text-u-ok"
                              : insp.status === "Overdue"
                              ? "bg-u-danger-soft text-u-danger font-bold"
                              : "bg-u-s3 text-u-ink2"
                          }`}
                        >
                          {insp.status}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            insp.overallResult === "Pass"
                              ? "bg-u-ok-soft text-u-ok"
                              : insp.overallResult === "Pass with Notes"
                              ? "bg-u-accent-soft text-u-accent"
                              : insp.overallResult === "Fail"
                              ? "bg-u-danger-soft text-u-danger font-bold"
                              : "text-u-muted"
                          }`}
                        >
                          {insp.overallResult || "--"}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center font-bold text-u-ink">
                        {insp.conditionScore ? `${insp.conditionScore}/100` : "--"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab B: Findings & Defect Items */}
        {activeSubTab === "findings" && (
          <div className="space-y-3 mt-4">
            {filteredFindings.map((f) => {
              const prop = rawData?.properties.find((p) => p.id === f.propertyId);
              return (
                <div
                  key={f.id}
                  className={`p-4 rounded-xl border transition ${
                    f.severity === "Critical"
                      ? "bg-u-danger-soft/40 border-u-danger/30"
                      : f.severity === "High"
                      ? "bg-u-warn-soft/40 border-u-warn/30"
                      : "bg-u-card border-u-line"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            f.severity === "Critical"
                              ? "bg-u-danger text-u-onaccent"
                              : f.severity === "High"
                              ? "bg-u-warn text-u-onaccent"
                              : "bg-u-accent-soft text-u-accent"
                          }`}
                        >
                          {f.severity}
                        </span>
                        <strong className="text-u-ink text-xs">{prop?.name}</strong>
                        <span className="text-u-muted">• Category: {f.category}</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            f.resolutionStatus === "Resolved"
                              ? "bg-u-ok-soft text-u-ok"
                              : f.resolutionStatus === "Overdue"
                              ? "bg-u-danger-soft text-u-danger"
                              : "bg-u-warn-soft text-u-warn"
                          }`}
                        >
                          {f.resolutionStatus}
                        </span>
                      </div>

                      <p className="text-xs font-semibold text-u-ink">{f.description}</p>
                      <p className="text-xs text-u-ink2">
                        <span className="font-semibold text-u-ink2">Corrective Action:</span>{" "}
                        {f.correctiveActionRequired}
                      </p>

                      <div className="flex items-center gap-4 text-[11px] text-u-muted pt-1">
                        <span>Assigned to: <strong>{f.assignedTo || "Unassigned"}</strong></span>
                        <span>Due Date: <strong>{f.dueDate}</strong></span>
                        {f.resolvedDate && <span>Resolved On: <strong>{f.resolvedDate}</strong></span>}
                      </div>
                    </div>

                    <button
                      onClick={() =>
                        openCreateActionModal({
                          propertyId: f.propertyId,
                          issue: `Finding: ${f.description}`,
                          severity: f.severity,
                          assignedTo: f.assignedTo,
                          dueDate: f.dueDate,
                          relatedRecordType: "Inspection",
                          relatedRecordId: f.id,
                        })
                      }
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-u-onaccent bg-u-accent hover:bg-u-accent-strong rounded-lg shadow-2xs transition self-start shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Create Management Action</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
