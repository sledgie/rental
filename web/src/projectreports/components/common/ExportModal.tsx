import React, { useRef } from "react";
import { X, Printer, Download, FileSpreadsheet, Building2, CheckCircle2, AlertTriangle, ShieldCheck } from "lucide-react";
import { useProjectReports } from "../../context/ProjectReportsContext";
import { formatCurrency, formatPct, formatDate } from "../../lib/calculations";

export function ExportModal() {
  const {
    isExportModalOpen,
    setIsExportModalOpen,
    exportReportType,
    projects,
    milestones,
    changeOrders,
    risks,
    issues,
    filters,
    kpis,
    properties,
  } = useProjectReports();

  const printRef = useRef<HTMLDivElement>(null);

  if (!isExportModalOpen) return null;

  const reportTitles: Record<string, string> = {
    portfolio: "Project Portfolio Executive Dashboard",
    progress: "Project Progress & Milestone Tracking Report",
    budget: "Project Budget & Cost Variance Control Report",
    contractors: "Contractor & Vendor Delivery Performance Report",
    risks: "Project Risk, Blocker & Issue Register",
    "change-orders": "Change Order & Scope Modification Audit Report",
    handover: "Project Handover, Acceptance & Closeout Report",
    outcomes: "Post-Completion Outcome & Value Realization Report",
  };

  const currentTitle = reportTitles[exportReportType] || "Project Management Report";

  // CSV Generator
  const downloadCsv = () => {
    let headers: string[] = [];
    let rows: (string | number)[][] = [];
    let filename = `Apex-Project-Report-${exportReportType}-${new Date().toISOString().slice(0, 10)}.csv`;

    if (exportReportType === "portfolio" || exportReportType === "budget") {
      headers = [
        "Project Code",
        "Project Name",
        "Property",
        "Category",
        "Status",
        "Project Manager",
        "Contractor",
        "Original Budget",
        "Approved Revisions",
        "Current Approved Budget",
        "Committed Cost",
        "Actual Cost",
        "Forecast Final Cost",
        "Budget Variance ($)",
        "Budget Variance (%)",
        "Schedule Variance (Days)",
        "Schedule Health",
        "Budget Health",
        "Data Completeness",
      ];
      rows = projects.map((p) => [
        p.code,
        `"${p.name.replace(/"/g, '""')}"`,
        `"${p.propertyName || ""}"`,
        p.category,
        p.status,
        p.managerName || "",
        `"${p.contractorName || ""}"`,
        p.originalBudget,
        p.approvedRevisions,
        p.currentApprovedBudget,
        p.committedCost,
        p.actualCost,
        p.forecastFinalCost,
        p.budgetVariance,
        p.budgetVariancePct !== null ? p.budgetVariancePct.toFixed(1) : "N/A",
        p.scheduleVarianceDays,
        p.scheduleHealth,
        p.budgetHealth,
        p.dataCompleteness,
      ]);
    } else if (exportReportType === "progress") {
      headers = [
        "Milestone Code",
        "Milestone Name",
        "Project Code",
        "Project Name",
        "Responsible",
        "Planned Start",
        "Planned End",
        "Forecast End",
        "Actual End",
        "Status",
        "Delay (Days)",
        "Notes",
      ];
      rows = milestones.map((m) => [
        m.milestoneCode,
        `"${m.name.replace(/"/g, '""')}"`,
        m.projectId,
        `"${m.projectName || ""}"`,
        `"${m.responsiblePerson}"`,
        m.plannedStart,
        m.plannedEnd,
        m.forecastEnd,
        m.actualEnd || "",
        m.status,
        m.delayDays,
        `"${(m.notes || "").replace(/"/g, '""')}"`,
      ]);
    } else if (exportReportType === "change-orders") {
      headers = [
        "CO Number",
        "Project Name",
        "Request Date",
        "Requested By",
        "Description",
        "Reason",
        "Cost Impact ($)",
        "Schedule Impact (Days)",
        "Status",
        "Approver",
        "Approval Date",
      ];
      rows = changeOrders.map((c) => [
        c.coNumber,
        `"${c.projectName || ""}"`,
        c.requestDate,
        `"${c.requestedBy}"`,
        `"${c.description.replace(/"/g, '""')}"`,
        c.reason,
        c.costImpact,
        c.scheduleImpactDays,
        c.status,
        c.approver || "",
        c.approvalDate || "",
      ]);
    } else if (exportReportType === "risks") {
      headers = [
        "Risk Code",
        "Project Name",
        "Category",
        "Description",
        "Probability",
        "Impact",
        "Risk Score (1-25)",
        "Inherent Rating",
        "Current Rating",
        "Owner",
        "Target Date",
        "Status",
      ];
      rows = risks.map((r) => [
        r.riskCode,
        `"${r.projectName || ""}"`,
        r.category,
        `"${r.description.replace(/"/g, '""')}"`,
        r.probability,
        r.impact,
        r.riskScore,
        r.inherentRating,
        r.currentRating,
        `"${r.riskOwner}"`,
        r.targetResolutionDate,
        r.status,
      ]);
    } else {
      // General project dump
      headers = ["Project Code", "Project Name", "Property", "Category", "Status", "Budget", "Actual Cost", "Variance"];
      rows = projects.map((p) => [
        p.code,
        `"${p.name.replace(/"/g, '""')}"`,
        `"${p.propertyName || ""}"`,
        p.category,
        p.status,
        p.currentApprovedBudget,
        p.actualCost,
        p.budgetVariance,
      ]);
    }

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  const appliedProperty = properties.find((p) => p.id === filters.propertyId)?.name || "All Properties";

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl bg-u-card shadow-2xl border border-u-line">
        {/* Modal Top Bar */}
        <div className="flex items-center justify-between border-b border-u-line px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-u-accent-soft text-u-accent border border-u-accent/30">
              <Printer className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-u-ink">Executive Report Export Preview</h3>
              <p className="text-xs text-u-muted">Official management distribution format</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={downloadCsv}
              className="flex items-center gap-1.5 rounded-lg border border-u-line2 bg-u-card px-3 py-1.5 text-xs font-semibold text-u-ink2 hover:bg-u-s2 transition-colors shadow-xs"
            >
              <Download className="h-3.5 w-3.5 text-u-ink2" />
              <span>Export CSV (Data)</span>
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 rounded-lg bg-u-accent px-3.5 py-1.5 text-xs font-semibold text-u-onaccent hover:bg-u-accent-strong transition-colors shadow-xs"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Print / Save as PDF</span>
            </button>
            <button
              onClick={() => setIsExportModalOpen(false)}
              className="rounded-lg p-1.5 text-u-muted hover:bg-u-s3 hover:text-u-ink2 ml-2"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Container */}
        <div ref={printRef} className="flex-1 overflow-y-auto p-8 text-u-ink bg-u-card" id="printable-report">
          {/* Header */}
          <div className="flex items-start justify-between border-b-2 border-u-accent/60 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-u-accent" />
                <span className="text-xs font-bold uppercase tracking-wider text-u-accent">
                  Apex Rental Management System
                </span>
              </div>
              <h1 className="text-xl font-bold tracking-tight text-u-ink mt-1">{currentTitle}</h1>
              <p className="text-xs text-u-muted mt-0.5">Asset Preservation & Capital Projects Governance</p>
            </div>
            <div className="text-right text-xs text-u-muted">
              <p className="font-semibold text-u-ink">Generated: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>
              <p>Period: <span className="font-medium text-u-ink2">{filters.period}</span></p>
              <p>Scope: <span className="font-medium text-u-ink2">{appliedProperty}</span></p>
            </div>
          </div>

          {/* Applied Filter Summary Badges */}
          <div className="my-4 flex flex-wrap items-center gap-2 rounded-lg bg-u-s2 p-3 text-xs border border-u-line">
            <span className="font-semibold text-u-ink2">Applied Filter Constraints:</span>
            <span className="rounded bg-u-card px-2 py-0.5 border border-u-line text-u-ink2">Period: {filters.period}</span>
            <span className="rounded bg-u-card px-2 py-0.5 border border-u-line text-u-ink2">Property: {appliedProperty}</span>
            <span className="rounded bg-u-card px-2 py-0.5 border border-u-line text-u-ink2">Category: {filters.category}</span>
            <span className="rounded bg-u-card px-2 py-0.5 border border-u-line text-u-ink2">Status: {filters.status}</span>
            <span className="rounded bg-u-card px-2 py-0.5 border border-u-line text-u-ink2">Total Projects Evaluated: {projects.length}</span>
          </div>

          {/* Executive KPI Summary Table */}
          {kpis && (
            <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-lg border border-u-line p-3 bg-u-s2/50">
                <span className="text-[10px] font-semibold text-u-muted uppercase">Total Portfolio Budget</span>
                <p className="text-base font-bold text-u-ink mt-0.5">
                  {formatCurrency(kpis.financials?.totalCurrentBudget)}
                </p>
                <span className="text-[10px] text-u-muted">Original: {formatCurrency(kpis.financials?.totalOriginalBudget)}</span>
              </div>
              <div className="rounded-lg border border-u-line p-3 bg-u-s2/50">
                <span className="text-[10px] font-semibold text-u-muted uppercase">Actual Incurred Cost</span>
                <p className="text-base font-bold text-u-ink mt-0.5">
                  {formatCurrency(kpis.financials?.totalActualCost)}
                </p>
                <span className="text-[10px] text-u-muted">Committed: {formatCurrency(kpis.financials?.totalCommittedCost)}</span>
              </div>
              <div className="rounded-lg border border-u-line p-3 bg-u-s2/50">
                <span className="text-[10px] font-semibold text-u-muted uppercase">Forecast Variance</span>
                <p className={`text-base font-bold mt-0.5 ${
                  (kpis.financials?.totalBudgetVariance || 0) >= 0 ? "text-u-ok" : "text-u-danger"
                }`}>
                  {formatCurrency(kpis.financials?.totalBudgetVariance)}
                </p>
                <span className="text-[10px] text-u-muted">
                  {kpis.financials?.totalBudgetVariancePct !== null ? formatPct(kpis.financials?.totalBudgetVariancePct) : "N/A"}
                </span>
              </div>
              <div className="rounded-lg border border-u-line p-3 bg-u-s2/50">
                <span className="text-[10px] font-semibold text-u-muted uppercase">Schedule Delivery</span>
                <p className="text-base font-bold text-u-ink mt-0.5">
                  {kpis.milestoneCompletionRate?.toFixed(1)}% Milestones On-Time
                </p>
                <span className="text-[10px] text-u-muted">{kpis.delayedProjects || 0} Projects Delayed</span>
              </div>
            </div>
          )}

          {/* Project Records Table */}
          <div className="rounded-xl border border-u-line overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-u-s3 text-[10px] font-bold text-u-ink2 uppercase border-b border-u-line">
                <tr>
                  <th className="py-2.5 px-3">Project Code</th>
                  <th className="py-2.5 px-3">Project & Property</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3">Approved Budget</th>
                  <th className="py-2.5 px-3">Actual Incurred</th>
                  <th className="py-2.5 px-3">Forecast Cost</th>
                  <th className="py-2.5 px-3">Variance</th>
                  <th className="py-2.5 px-3">Schedule</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-u-line font-medium">
                {projects.map((p) => (
                  <tr key={p.id} className="hover:bg-u-s2">
                    <td className="py-2 px-3 font-mono text-[11px] text-u-accent font-semibold">{p.code}</td>
                    <td className="py-2 px-3">
                      <div className="font-semibold text-u-ink truncate max-w-[200px]">{p.name}</div>
                      <div className="text-[10px] text-u-muted">{p.propertyName}</div>
                    </td>
                    <td className="py-2 px-3 text-u-ink2">{p.category}</td>
                    <td className="py-2 px-3 text-u-ink">{formatCurrency(p.currentApprovedBudget)}</td>
                    <td className="py-2 px-3 text-u-ink2">{formatCurrency(p.actualCost)}</td>
                    <td className="py-2 px-3 text-u-ink2">{formatCurrency(p.forecastFinalCost)}</td>
                    <td className={`py-2 px-3 font-semibold ${p.budgetVariance >= 0 ? "text-u-ok" : "text-u-danger"}`}>
                      {formatCurrency(p.budgetVariance)}
                    </td>
                    <td className="py-2 px-3">
                      <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                        p.scheduleHealth === "On Track" ? "bg-u-ok-soft text-u-ok" :
                        p.scheduleHealth === "Delayed" ? "bg-u-danger-soft text-u-danger" :
                        p.scheduleHealth === "Completed" ? "bg-u-accent-soft text-u-accent" :
                        "bg-u-warn-soft text-u-warn"
                      }`}>
                        {p.scheduleHealth}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-u-ink2 text-[11px]">{p.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Definitions & Methodology */}
          <div className="mt-8 border-t border-u-line pt-4 text-[10px] text-u-muted space-y-1">
            <p className="font-bold text-u-ink2 uppercase tracking-wider">Methodology & Governance Disclaimers:</p>
            <p>
              • <strong>Schedule Variance:</strong> Calculated as Forecast Completion minus Approved Baseline Completion date. Positive values indicate calendar-day delay.
            </p>
            <p>
              • <strong>Budget Variance:</strong> Current Approved Budget minus Forecast Final Cost. Positive denotes savings; negative indicates projected overrun.
            </p>
            <p>
              • <strong>Commitments:</strong> Contractual Purchase Orders not yet recognized as actual invoices. Commitments and actual expenditures are never double-counted.
            </p>
            <p>
              • <strong>Data Completeness:</strong> Handover documentation, warranty certifications, and deficiency clearings are tracked independently of physical construction completion.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
