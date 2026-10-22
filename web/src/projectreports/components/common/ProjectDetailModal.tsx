import React, { useState, useEffect } from "react";
import {
  X,
  Building,
  Calendar,
  DollarSign,
  AlertTriangle,
  GitPullRequestDraft,
  CheckSquare2,
  Award,
  History,
  HardHat,
  User,
  Info,
  Clock,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  FileText,
} from "lucide-react";
import { PrDrawer } from "./PrDrawer";
import { useProjectReports } from "../../context/ProjectReportsContext";
import { formatCurrency, formatPct, formatDate } from "../../lib/calculations";

export function ProjectDetailModal() {
  const {
    isProjectModalOpen,
    setIsProjectModalOpen,
    selectedProjectId,
    projects,
    milestones,
    changeOrders,
    risks,
    issues,
    handoverItems,
    outcomeReviews,
    auditLogs,
  } = useProjectReports();

  const [activeTab, setActiveTab] = useState<
    "overview" | "budget" | "schedule" | "risks" | "changes" | "handover" | "outcomes" | "audit"
  >("overview");

  // Reset tab when modal opens
  useEffect(() => {
    if (isProjectModalOpen) {
      setActiveTab("overview");
    }
  }, [isProjectModalOpen]);

  if (!isProjectModalOpen || !selectedProjectId) return null;

  const project = projects.find((p) => p.id === selectedProjectId);
  if (!project) return null;

  const projectMilestones = milestones.filter((m) => m.projectId === project.id);
  const projectChangeOrders = changeOrders.filter((c) => c.projectId === project.id);
  const projectRisks = risks.filter((r) => r.projectId === project.id);
  const projectIssues = issues.filter((i) => i.projectId === project.id);
  const projectHandover = handoverItems.filter((h) => h.projectId === project.id);
  const projectOutcomes = outcomeReviews.filter((o) => o.projectId === project.id);
  const projectLogs = auditLogs.filter((l) => l.projectId === project.id);

  const tabs = [
    { id: "overview", label: "Overview & Scope", icon: Info },
    { id: "budget", label: "Budget & Costs", icon: DollarSign },
    { id: "schedule", label: "Schedule & Milestones", icon: Calendar, badge: projectMilestones.length },
    { id: "risks", label: "Risks & Issues", icon: AlertTriangle, badge: projectRisks.length + projectIssues.length },
    { id: "changes", label: "Change Orders", icon: GitPullRequestDraft, badge: projectChangeOrders.length },
    { id: "handover", label: "Handover Checklist", icon: CheckSquare2, badge: projectHandover.length },
    { id: "outcomes", label: "Outcomes & Benefits", icon: Award, badge: projectOutcomes.length },
    { id: "audit", label: "Audit Trail", icon: History, badge: projectLogs.length },
  ];

  return (
    <PrDrawer title={project.name} subtitle={project.propertyName} onClose={() => setIsProjectModalOpen(false)}>
      <div className="flex flex-col">
        <div className="border-b border-u-line bg-u-s2 px-5 py-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-u-accent bg-u-accent-soft px-2 py-0.5 rounded border border-u-accent/30">
                {project.code}
              </span>
              <span className="text-xs font-medium text-u-muted">• {project.category}</span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                  project.status === "In Progress"
                    ? "bg-u-accent-soft text-u-accent"
                    : project.status === "Completed"
                    ? "bg-u-ok-soft text-u-ok"
                    : project.status === "On Hold"
                    ? "bg-u-warn-soft text-u-warn"
                    : "bg-u-line text-u-ink"
                }`}
              >
                {project.status}
              </span>
              {project.dataCompleteness !== "Complete" && (
                <span className="text-[10px] font-bold bg-u-warn-soft text-u-warn border border-u-warn/30 px-2 py-0.5 rounded">
                  {project.dataCompleteness} Data
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-u-muted mt-0.5">
              <span>
                Property: <strong className="text-u-ink">{project.propertyName}</strong>
              </span>
              {project.buildingName && (
                <span>
                  Building: <strong className="text-u-ink">{project.buildingName}</strong>
                </span>
              )}
              <span>
                PM: <strong className="text-u-ink">{project.managerName}</strong>
              </span>
              <span>
                Contractor: <strong className="text-u-ink">{project.contractorName}</strong>
              </span>
            </div>
          </div>
        </div>
        {/* Tab Navigation */}
        <div className="flex overflow-x-auto border-b border-u-line bg-u-card px-4 scrollbar-none">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 border-b-2 px-3.5 py-3 text-xs font-semibold whitespace-nowrap transition-colors ${
                  isActive
                    ? "border-u-accent/60 text-u-accent"
                    : "border-transparent text-u-muted hover:border-u-line2 hover:text-u-ink"
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? "text-u-accent" : "text-u-muted"}`} />
                <span>{tab.label}</span>
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                      isActive ? "bg-u-accent-soft text-u-accent" : "bg-u-s3 text-u-ink2"
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Tab Content Body */}
        <div className="p-5 bg-u-s2/40 text-u-ink">
          {/* TAB 1: OVERVIEW */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              {/* Highlight summary cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="rounded-xl border border-u-line bg-u-card p-4 shadow-2xs">
                  <span className="text-[11px] font-bold uppercase text-u-muted">Approved Budget</span>
                  <p className="text-lg font-bold text-u-ink mt-1">
                    {formatCurrency(project.currentApprovedBudget)}
                  </p>
                  <span className="text-[11px] text-u-muted">
                    Orig: {formatCurrency(project.originalBudget)}
                  </span>
                </div>
                <div className="rounded-xl border border-u-line bg-u-card p-4 shadow-2xs">
                  <span className="text-[11px] font-bold uppercase text-u-muted">Actual Cost Incurred</span>
                  <p className="text-lg font-bold text-u-ink mt-1">
                    {formatCurrency(project.actualCost)}
                  </p>
                  <span className="text-[11px] text-u-muted">
                    Committed: {formatCurrency(project.committedCost)}
                  </span>
                </div>
                <div className="rounded-xl border border-u-line bg-u-card p-4 shadow-2xs">
                  <span className="text-[11px] font-bold uppercase text-u-muted">Forecast Variance</span>
                  <p
                    className={`text-lg font-bold mt-1 ${
                      project.budgetVariance >= 0 ? "text-u-ok" : "text-u-danger"
                    }`}
                  >
                    {formatCurrency(project.budgetVariance)}
                  </p>
                  <span className="text-[11px] text-u-muted">
                    {project.budgetVariancePct !== null ? formatPct(project.budgetVariancePct) : "N/A"}
                  </span>
                </div>
                <div className="rounded-xl border border-u-line bg-u-card p-4 shadow-2xs">
                  <span className="text-[11px] font-bold uppercase text-u-muted">Schedule Health</span>
                  <p
                    className={`text-lg font-bold mt-1 ${
                      project.scheduleHealth === "On Track"
                        ? "text-u-ok"
                        : project.scheduleHealth === "Delayed"
                        ? "text-u-danger"
                        : "text-u-warn"
                    }`}
                  >
                    {project.scheduleHealth}
                  </p>
                  <span className="text-[11px] text-u-muted">
                    Variance: {project.scheduleVarianceDays > 0 ? `+${project.scheduleVarianceDays}d delay` : `${project.scheduleVarianceDays}d`}
                  </span>
                </div>
              </div>

              {/* Scope & Objective */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-xl border border-u-line bg-u-card p-5 shadow-2xs">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-u-muted mb-2">
                    Scope of Work
                  </h4>
                  <p className="text-xs text-u-ink2 leading-relaxed">{project.scopeDescription}</p>
                </div>
                <div className="rounded-xl border border-u-line bg-u-card p-5 shadow-2xs">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-u-muted mb-2">
                    Strategic Business Objective
                  </h4>
                  <p className="text-xs text-u-ink2 leading-relaxed">{project.businessObjective}</p>
                </div>
              </div>

              {/* Progress & Baseline Status */}
              <div className="rounded-xl border border-u-line bg-u-card p-5 shadow-2xs">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-u-muted">
                    Physical Progress Status
                  </h4>
                  <span className="text-xs text-u-muted">
                    Last updated: {formatDate(project.progressUpdatedAt)} by {project.progressUpdatedBy || "PM"}
                  </span>
                </div>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-xs font-medium mb-1">
                      <span>Reported Actual Progress</span>
                      <strong className="text-u-accent">
                        {project.actualProgress !== null ? `${project.actualProgress}%` : "Not Available"}
                      </strong>
                    </div>
                    <div className="h-2.5 w-full rounded-full bg-u-s3 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-u-accent transition-all"
                        style={{ width: `${project.actualProgress || 0}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs font-medium mb-1">
                      <span>Planned Baseline Progress</span>
                      <strong className="text-u-ink2">
                        {project.plannedProgress !== null ? `${project.plannedProgress}%` : "Baseline Not Confirmed"}
                      </strong>
                    </div>
                    <div className="h-2.5 w-full rounded-full bg-u-s3 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-u-line2 transition-all"
                        style={{ width: `${project.plannedProgress || 0}%` }}
                      />
                    </div>
                  </div>
                </div>
                {project.dataNotes && (
                  <p className="mt-3 text-[11px] text-u-muted bg-u-s2 p-2.5 rounded-lg border border-u-line">
                    <strong>Governance Note:</strong> {project.dataNotes}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: BUDGET & COSTS */}
          {activeTab === "budget" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-xl border border-u-line bg-u-card p-4 shadow-2xs">
                  <span className="text-[10px] font-bold uppercase text-u-muted">Current Approved Budget</span>
                  <p className="text-xl font-bold text-u-ink mt-1">
                    {formatCurrency(project.currentApprovedBudget)}
                  </p>
                  <p className="text-xs text-u-muted mt-1">
                    Base: {formatCurrency(project.originalBudget)} | Revisions: +{formatCurrency(project.approvedRevisions)}
                  </p>
                </div>
                <div className="rounded-xl border border-u-line bg-u-card p-4 shadow-2xs">
                  <span className="text-[10px] font-bold uppercase text-u-muted">Committed & Incurred</span>
                  <p className="text-xl font-bold text-u-ink mt-1">
                    {formatCurrency(project.actualCost + project.committedCost)}
                  </p>
                  <p className="text-xs text-u-muted mt-1">
                    Incurred: {formatCurrency(project.actualCost)} | PO Commitments: {formatCurrency(project.committedCost)}
                  </p>
                </div>
                <div className="rounded-xl border border-u-line bg-u-card p-4 shadow-2xs">
                  <span className="text-[10px] font-bold uppercase text-u-muted">Forecast Final Cost</span>
                  <p className="text-xl font-bold text-u-ink mt-1">
                    {formatCurrency(project.forecastFinalCost)}
                  </p>
                  <p className={`text-xs font-semibold mt-1 ${project.budgetVariance >= 0 ? "text-u-ok" : "text-u-danger"}`}>
                    Variance: {formatCurrency(project.budgetVariance)} ({project.budgetVariancePct !== null ? formatPct(project.budgetVariancePct) : "N/A"})
                  </p>
                </div>
              </div>

              {/* Financial Control Breakdown Table */}
              <div className="rounded-xl border border-u-line bg-u-card overflow-hidden shadow-2xs">
                <div className="px-5 py-3 border-b border-u-line font-bold text-xs text-u-ink">
                  Project Financial Reconciliation Breakdown
                </div>
                <table className="w-full text-left text-xs border-collapse">
                  <tbody className="divide-y divide-u-line">
                    <tr className="hover:bg-u-s2">
                      <td className="py-2.5 px-5 text-u-ink2">Original Approved Baseline Budget</td>
                      <td className="py-2.5 px-5 font-semibold text-right text-u-ink">{formatCurrency(project.originalBudget)}</td>
                    </tr>
                    <tr className="hover:bg-u-s2">
                      <td className="py-2.5 px-5 text-u-ink2">Cumulative Approved Budget Revisions (Change Orders)</td>
                      <td className="py-2.5 px-5 font-semibold text-right text-u-ink">+{formatCurrency(project.approvedRevisions)}</td>
                    </tr>
                    <tr className="bg-u-s2/70 font-bold text-u-ink">
                      <td className="py-2.5 px-5">Current Approved Project Budget</td>
                      <td className="py-2.5 px-5 text-right">{formatCurrency(project.currentApprovedBudget)}</td>
                    </tr>
                    <tr className="hover:bg-u-s2">
                      <td className="py-2.5 px-5 text-u-ink2">Actual Cost Incurred (Recognized Invoices)</td>
                      <td className="py-2.5 px-5 font-semibold text-right text-u-ink">{formatCurrency(project.actualCost)}</td>
                    </tr>
                    <tr className="hover:bg-u-s2">
                      <td className="py-2.5 px-5 text-u-ink2">Outstanding Purchase Orders & Commitments</td>
                      <td className="py-2.5 px-5 font-semibold text-right text-u-ink">{formatCurrency(project.committedCost)}</td>
                    </tr>
                    <tr className="hover:bg-u-s2">
                      <td className="py-2.5 px-5 text-u-ink2">Remaining Approved Budget Balance (Approved - Actual)</td>
                      <td className="py-2.5 px-5 font-semibold text-right text-u-accent">{formatCurrency(project.remainingBudget)}</td>
                    </tr>
                    <tr className="hover:bg-u-s2">
                      <td className="py-2.5 px-5 text-u-ink2">Forecast Cost to Complete (Forecast Final - Actual)</td>
                      <td className="py-2.5 px-5 font-semibold text-right text-u-ink">{formatCurrency(project.forecastRemainingCost)}</td>
                    </tr>
                    <tr className="bg-u-accent-soft/50 font-bold">
                      <td className="py-2.5 px-5 text-u-ink">Forecast Final Variance (Current Approved - Forecast Final)</td>
                      <td className={`py-2.5 px-5 text-right text-sm ${project.budgetVariance >= 0 ? "text-u-ok" : "text-u-danger"}`}>
                        {formatCurrency(project.budgetVariance)} ({project.budgetVariancePct !== null ? formatPct(project.budgetVariancePct) : "N/A"})
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: SCHEDULE & MILESTONES */}
          {activeTab === "schedule" && (
            <div className="space-y-6">
              {/* Timeline Header Summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="rounded-xl border border-u-line bg-u-card p-3 shadow-2xs">
                  <span className="text-[10px] font-bold uppercase text-u-muted">Baseline Start</span>
                  <p className="text-xs font-bold text-u-ink mt-1">{formatDate(project.originalStartDate)}</p>
                  <span className="text-[11px] text-u-muted">Actual: {formatDate(project.actualStartDate)}</span>
                </div>
                <div className="rounded-xl border border-u-line bg-u-card p-3 shadow-2xs">
                  <span className="text-[10px] font-bold uppercase text-u-muted">Baseline Completion</span>
                  <p className="text-xs font-bold text-u-ink mt-1">{formatDate(project.originalEndDate)}</p>
                  <span className="text-[11px] text-u-muted">Locked at kickoff</span>
                </div>
                <div className="rounded-xl border border-u-line bg-u-card p-3 shadow-2xs">
                  <span className="text-[10px] font-bold uppercase text-u-muted">Current Forecast Completion</span>
                  <p className="text-xs font-bold text-u-accent mt-1">{formatDate(project.forecastEndDate)}</p>
                  <span className="text-[11px] text-u-muted">Actual: {formatDate(project.actualEndDate)}</span>
                </div>
                <div className="rounded-xl border border-u-line bg-u-card p-3 shadow-2xs">
                  <span className="text-[10px] font-bold uppercase text-u-muted">Schedule Variance</span>
                  <p className={`text-xs font-bold mt-1 ${project.scheduleVarianceDays > 0 ? "text-u-danger" : "text-u-ok"}`}>
                    {project.scheduleVarianceDays > 0 ? `+${project.scheduleVarianceDays} Days Delayed` : `${project.scheduleVarianceDays} Days`}
                  </p>
                  <span className="text-[11px] text-u-muted">Status: {project.scheduleHealth}</span>
                </div>
              </div>

              {/* Milestones List */}
              <div className="rounded-xl border border-u-line bg-u-card overflow-hidden shadow-2xs">
                <div className="px-5 py-3 border-b border-u-line font-bold text-xs text-u-ink">
                  Project Milestones & Critical Path Deliverables
                </div>
                <div className="divide-y divide-u-line">
                  {projectMilestones.map((m) => (
                    <div key={m.id} className="p-4 hover:bg-u-s2/70 transition-colors">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[11px] font-bold text-u-muted">{m.milestoneCode}</span>
                          <span className="text-xs font-semibold text-u-ink">{m.name}</span>
                        </div>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            m.status === "Completed"
                              ? "bg-u-ok-soft text-u-ok"
                              : m.status === "Delayed"
                              ? "bg-u-danger-soft text-u-danger"
                              : m.status === "In Progress"
                              ? "bg-u-accent-soft text-u-accent"
                              : "bg-u-line text-u-ink2"
                          }`}
                        >
                          {m.status}
                        </span>
                      </div>
                      <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-u-muted">
                        <div>
                          Planned: <strong className="text-u-ink2">{formatDate(m.plannedEnd)}</strong>
                        </div>
                        <div>
                          Forecast: <strong className="text-u-ink2">{formatDate(m.forecastEnd)}</strong>
                        </div>
                        <div>
                          Actual: <strong className="text-u-ink2">{formatDate(m.actualEnd)}</strong>
                        </div>
                        <div>
                          Lead: <strong className="text-u-ink2">{m.responsiblePerson}</strong>
                        </div>
                      </div>
                      {m.notes && <p className="mt-1.5 text-[11px] text-u-ink2 italic">Notes: {m.notes}</p>}
                    </div>
                  ))}
                  {projectMilestones.length === 0 && (
                    <div className="p-6 text-center text-xs text-u-muted">No milestones recorded for this project.</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: RISKS & ISSUES */}
          {activeTab === "risks" && (
            <div className="space-y-6">
              {/* Risks Section */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-u-muted mb-3">
                  Identified Project Risks ({projectRisks.length})
                </h4>
                <div className="space-y-3">
                  {projectRisks.map((r) => (
                    <div key={r.id} className="rounded-xl border border-u-line bg-u-card p-4 shadow-2xs">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-u-muted">{r.riskCode}</span>
                          <span className="font-semibold text-xs text-u-ink">{r.category}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-u-muted">Score: {r.riskScore}/25</span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                              r.currentRating === "Critical"
                                ? "bg-u-danger-soft text-u-danger"
                                : r.currentRating === "High"
                                ? "bg-u-warn-soft text-u-warn"
                                : "bg-u-accent-soft text-u-accent"
                            }`}
                          >
                            {r.currentRating} Risk
                          </span>
                        </div>
                      </div>
                      <p className="mt-2 text-xs text-u-ink2">{r.description}</p>
                      <div className="mt-3 rounded-lg bg-u-s2 p-2.5 text-[11px] text-u-ink2 border border-u-line">
                        <strong className="text-u-ink">Mitigation Strategy:</strong> {r.mitigationStrategy}
                      </div>
                      <div className="mt-2 flex items-center justify-between text-[11px] text-u-muted">
                        <span>Owner: {r.riskOwner}</span>
                        <span>Target Resolution: {formatDate(r.targetResolutionDate)}</span>
                      </div>
                    </div>
                  ))}
                  {projectRisks.length === 0 && (
                    <div className="p-4 rounded-xl border border-u-line bg-u-card text-center text-xs text-u-muted">
                      Zero active risks flagged for this project.
                    </div>
                  )}
                </div>
              </div>

              {/* Issues Section */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-u-muted mb-3">
                  Documented Issues & Blockers ({projectIssues.length})
                </h4>
                <div className="space-y-3">
                  {projectIssues.map((i) => (
                    <div key={i.id} className="rounded-xl border border-u-line bg-u-card p-4 shadow-2xs">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold text-u-muted">{i.issueCode}</span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            i.severity === "Critical" ? "bg-u-danger-soft text-u-danger" : "bg-u-warn-soft text-u-warn"
                          }`}
                        >
                          {i.severity} Severity • {i.status}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-u-ink font-medium">{i.description}</p>
                      <div className="mt-2 text-[11px] text-u-ink2 bg-u-s2 p-2.5 rounded-lg border border-u-line">
                        <strong className="text-u-ink">Resolution Plan:</strong> {i.resolutionNotes || "Action pending."}
                      </div>
                    </div>
                  ))}
                  {projectIssues.length === 0 && (
                    <div className="p-4 rounded-xl border border-u-line bg-u-card text-center text-xs text-u-muted">
                      No open blockers or issues logged.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: CHANGE ORDERS */}
          {activeTab === "changes" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-u-muted">
                  Scope Changes & Budget Variations ({projectChangeOrders.length})
                </h4>
                <span className="text-xs text-u-muted">
                  Approved Revisions: <strong>{formatCurrency(project.approvedRevisions)}</strong>
                </span>
              </div>
              <div className="rounded-xl border border-u-line bg-u-card overflow-hidden shadow-2xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-u-s3 text-[10px] font-bold text-u-ink2 uppercase border-b border-u-line">
                    <tr>
                      <th className="py-2.5 px-3">CO #</th>
                      <th className="py-2.5 px-3">Description & Reason</th>
                      <th className="py-2.5 px-3">Requested By</th>
                      <th className="py-2.5 px-3">Cost Impact</th>
                      <th className="py-2.5 px-3">Schedule Impact</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Approver</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-u-line">
                    {projectChangeOrders.map((co) => (
                      <tr key={co.id} className="hover:bg-u-s2">
                        <td className="py-2.5 px-3 font-mono font-bold text-u-accent">{co.coNumber}</td>
                        <td className="py-2.5 px-3 max-w-[280px]">
                          <div className="font-medium text-u-ink">{co.description}</div>
                          <div className="text-[10px] text-u-muted">Reason: {co.reason}</div>
                        </td>
                        <td className="py-2.5 px-3 text-u-ink2">{co.requestedBy}</td>
                        <td className="py-2.5 px-3 font-semibold text-u-ink">{formatCurrency(co.costImpact)}</td>
                        <td className="py-2.5 px-3 text-u-ink2">{co.scheduleImpactDays > 0 ? `+${co.scheduleImpactDays} days` : "0 days"}</td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              co.status === "Approved"
                                ? "bg-u-ok-soft text-u-ok"
                                : co.status === "Pending"
                                ? "bg-u-warn-soft text-u-warn"
                                : "bg-u-danger-soft text-u-danger"
                            }`}
                          >
                            {co.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-[11px] text-u-ink2">{co.approver || "Pending Committee"}</td>
                      </tr>
                    ))}
                    {projectChangeOrders.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-6 text-center text-xs text-u-muted">
                          No change orders requested on this project.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 6: HANDOVER CHECKLIST */}
          {activeTab === "handover" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-u-muted">
                    Project Handover & Closeout Verification
                  </h4>
                  <p className="text-[11px] text-u-muted">
                    Independent tracking of physical completion, inspections, punchlist, and warranties
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-u-line bg-u-card overflow-hidden shadow-2xs divide-y divide-u-line">
                {projectHandover.map((item) => (
                  <div key={item.id} className="p-4 flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase text-u-accent bg-u-accent-soft px-1.5 py-0.5 rounded">
                          {item.category}
                        </span>
                        <span className="text-xs font-semibold text-u-ink">{item.title}</span>
                      </div>
                      {item.notes && <p className="mt-1 text-xs text-u-ink2">{item.notes}</p>}
                      <div className="mt-1 text-[11px] text-u-muted">
                        {item.completedDate ? `Completed: ${formatDate(item.completedDate)} by ${item.verifiedBy || "Inspector"}` : "Awaiting verification"}
                      </div>
                    </div>
                    <span
                      className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded ${
                        item.status === "Completed"
                          ? "bg-u-ok-soft text-u-ok"
                          : item.status === "Pending"
                          ? "bg-u-warn-soft text-u-warn"
                          : "bg-u-accent-soft text-u-accent"
                      }`}
                    >
                      {item.status}
                    </span>
                  </div>
                ))}
                {projectHandover.length === 0 && (
                  <div className="p-6 text-center text-xs text-u-muted">
                    Handover checklist items not yet generated for this project phase.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 7: OUTCOMES & BENEFITS */}
          {activeTab === "outcomes" && (
            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-u-muted">
                Post-Handover Value & Performance Reviews ({projectOutcomes.length})
              </h4>
              <div className="space-y-4">
                {projectOutcomes.map((rev) => (
                  <div key={rev.id} className="rounded-xl border border-u-line bg-u-card p-5 shadow-2xs space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-u-accent bg-u-accent-soft px-2 py-1 rounded">
                        {rev.reviewMilestone} ({formatDate(rev.reviewDate)})
                      </span>
                      <span className="text-xs font-semibold text-u-ok bg-u-ok-soft px-2 py-0.5 rounded border border-u-ok/30">
                        {rev.qualityAcceptanceStatus}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 rounded-lg bg-u-s2 p-3 text-xs border border-u-line">
                      <div>
                        <span className="text-[10px] font-semibold text-u-muted uppercase">Baseline Level</span>
                        <p className="font-bold text-u-ink mt-0.5">{rev.baselineValue} {rev.unit}</p>
                      </div>
                      <div>
                        <span className="text-[10px] font-semibold text-u-muted uppercase">Target Objective</span>
                        <p className="font-bold text-u-ink mt-0.5">{rev.targetValue} {rev.unit}</p>
                      </div>
                      <div>
                        <span className="text-[10px] font-semibold text-u-muted uppercase">Actual Measured Result</span>
                        <p className="font-bold text-u-ok mt-0.5">{rev.actualValue} {rev.unit}</p>
                      </div>
                    </div>

                    <div className="text-xs space-y-1.5 text-u-ink2">
                      <p><strong>Measured Benefit:</strong> {rev.expectedBenefit}</p>
                      <p><strong>Evidence Source:</strong> {rev.evidenceSource}</p>
                      <p><strong>Lessons Learned:</strong> {rev.lessonsLearned}</p>
                      {rev.followUpActions && <p><strong>Follow-Up Actions:</strong> {rev.followUpActions}</p>}
                    </div>
                  </div>
                ))}
                {projectOutcomes.length === 0 && (
                  <div className="p-6 rounded-xl border border-u-line bg-u-card text-center text-xs text-u-muted">
                    Outcome measurement scheduled for post-handover review (30-day / 90-day post-completion).
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 8: AUDIT TRAIL */}
          {activeTab === "audit" && (
            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-u-muted">
                Governance Audit Trail & Approval History ({projectLogs.length})
              </h4>
              <div className="rounded-xl border border-u-line bg-u-card overflow-hidden shadow-2xs divide-y divide-u-line">
                {projectLogs.map((log) => (
                  <div key={log.id} className="p-4 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-u-ink">{log.action}: {log.entityType}</span>
                      <span className="text-u-muted text-[11px]">{log.timestamp}</span>
                    </div>
                    {log.fieldChanged && (
                      <p className="mt-1 text-[11px] text-u-ink2">
                        Changed <strong className="font-mono">{log.fieldChanged}</strong> from{" "}
                        <span className="line-through text-u-muted">{log.oldValue}</span> to{" "}
                        <strong className="text-u-accent">{log.newValue}</strong>
                      </p>
                    )}
                    <p className="mt-0.5 text-[11px] text-u-muted">Authorized By: {log.changedBy} • {log.notes}</p>
                  </div>
                ))}
                {projectLogs.length === 0 && (
                  <div className="p-6 text-center text-xs text-u-muted">No audit events logged.</div>
                )}
              </div>
            </div>
          )}
        </div>

      </div>
    </PrDrawer>
  );
}
