import React, { useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Calendar,
  DollarSign,
  ArrowRight,
  ShieldAlert,
  ChevronRight,
  PieChart,
  BarChart3,
  ListFilter,
  Layers,
  Sparkles,
} from "lucide-react";
import { useProjectReports } from "../../context/ProjectReportsContext";
import { formatCurrency, formatPct, formatDate } from "../../lib/calculations";

export function PortfolioDashboard() {
  const {
    projects,
    milestones,
    managementExceptions,
    kpis,
    drillDownProject,
    updateFilter,
    setActiveReportTab,
  } = useProjectReports();

  const [scheduleFilter, setScheduleFilter] = useState<string | null>(null);

  if (!kpis) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center text-xs text-u-muted">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-u-accent/60 border-t-transparent mx-auto mb-2" />
          Loading portfolio executive metrics...
        </div>
      </div>
    );
  }

  // Distribution for Schedule Health
  const scheduleCounts = {
    "On Track": projects.filter((p) => p.scheduleHealth === "On Track").length,
    "At Risk": projects.filter((p) => p.scheduleHealth === "At Risk").length,
    Delayed: projects.filter((p) => p.scheduleHealth === "Delayed").length,
    Completed: projects.filter((p) => p.scheduleHealth === "Completed").length,
    "On Hold": projects.filter((p) => p.scheduleHealth === "On Hold").length,
  };

  const displayedProjects = scheduleFilter
    ? projects.filter((p) => p.scheduleHealth === scheduleFilter)
    : projects;

  // Upcoming Milestones (next 30-60 days)
  const upcomingMilestonesList = milestones
    .filter((m) => m.status !== "Completed" && m.status !== "Cancelled")
    .sort((a, b) => a.plannedEnd.localeCompare(b.plannedEnd))
    .slice(0, 6);

  // Completion Trend Data (Monthly completions)
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const completionsByMonth = [
    { month: "Jan", scheduled: 0, actual: 0, onTime: 0, late: 0 },
    { month: "Feb", scheduled: 1, actual: 0, onTime: 0, late: 0 },
    { month: "Mar", scheduled: 1, actual: 0, onTime: 0, late: 0 },
    { month: "Apr", scheduled: 0, actual: 0, onTime: 0, late: 0 },
    { month: "May", scheduled: 2, actual: 2, onTime: 2, late: 0 }, // PRJ-06 & PRJ-10
    { month: "Jun", scheduled: 1, actual: 0, onTime: 0, late: 0 },
    { month: "Jul", scheduled: 0, actual: 1, onTime: 0, late: 1 }, // PRJ-05 completed late
    { month: "Aug", scheduled: 1, actual: 0, onTime: 0, late: 0 },
    { month: "Sep", scheduled: 3, actual: 0, onTime: 0, late: 0 }, // PRJ-01, PRJ-02, PRJ-12
    { month: "Oct", scheduled: 2, actual: 0, onTime: 0, late: 0 },
    { month: "Nov", scheduled: 1, actual: 0, onTime: 0, late: 0 },
    { month: "Dec", scheduled: 1, actual: 0, onTime: 0, late: 0 },
  ];

  return (
    <div className="space-y-6">
      {/* 6.1 SUMMARY KPI CARDS */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-base font-bold text-u-ink">Portfolio Executive Health</h2>
            <p className="text-xs text-u-muted">Live operational & fiscal status across all active initiatives</p>
          </div>
          <span className="text-xs text-u-muted font-medium bg-u-s3 px-2.5 py-1 rounded-lg">
            {projects.length} Total Initiatives Evaluated
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
          {/* Card 1: Active Projects */}
          <div
            onClick={() => updateFilter("status", "In Progress")}
            className="cursor-pointer rounded-xl border border-u-line bg-u-card p-4 shadow-2xs hover:border-u-accent/30 hover:shadow-xs transition-all"
          >
            <div className="flex items-center justify-between text-u-muted">
              <span className="text-[11px] font-bold uppercase tracking-wider">Active Projects</span>
              <Layers className="h-4 w-4 text-u-accent" />
            </div>
            <p className="text-2xl font-bold text-u-ink mt-2">{kpis.activeProjects}</p>
            <div className="mt-2 flex items-center justify-between text-[11px] text-u-muted">
              <span>{kpis.pendingApproval} Pending Approval</span>
              <span className="text-u-accent font-medium">Filter &rarr;</span>
            </div>
          </div>

          {/* Card 2: Delayed Projects */}
          <div
            onClick={() => {
              setScheduleFilter(scheduleFilter === "Delayed" ? null : "Delayed");
            }}
            className={`cursor-pointer rounded-xl border p-4 shadow-2xs transition-all ${
              scheduleFilter === "Delayed"
                ? "border-u-danger/60 bg-u-danger-soft/40 ring-2 ring-u-danger/20"
                : "border-u-line bg-u-card hover:border-u-danger/30"
            }`}
          >
            <div className="flex items-center justify-between text-u-muted">
              <span className="text-[11px] font-bold uppercase tracking-wider text-u-danger">Delayed</span>
              <Clock className="h-4 w-4 text-u-danger" />
            </div>
            <p className="text-2xl font-bold text-u-danger mt-2">{kpis.delayedProjects}</p>
            <div className="mt-2 flex items-center justify-between text-[11px] text-u-muted">
              <span>&gt; 7 days past baseline</span>
              <span className="text-u-danger font-medium">View List &rarr;</span>
            </div>
          </div>

          {/* Card 3: At-Risk Projects */}
          <div
            onClick={() => {
              setScheduleFilter(scheduleFilter === "At Risk" ? null : "At Risk");
            }}
            className={`cursor-pointer rounded-xl border p-4 shadow-2xs transition-all ${
              scheduleFilter === "At Risk"
                ? "border-u-warn/60 bg-u-warn-soft/40 ring-2 ring-u-warn/20"
                : "border-u-line bg-u-card hover:border-u-warn/30"
            }`}
          >
            <div className="flex items-center justify-between text-u-muted">
              <span className="text-[11px] font-bold uppercase tracking-wider text-u-warn">At Risk</span>
              <AlertTriangle className="h-4 w-4 text-u-warn" />
            </div>
            <p className="text-2xl font-bold text-u-warn mt-2">{kpis.atRiskProjects}</p>
            <div className="mt-2 flex items-center justify-between text-[11px] text-u-muted">
              <span>Schedule or budget alert</span>
              <span className="text-u-warn font-medium">View &rarr;</span>
            </div>
          </div>

          {/* Card 4: Over-Budget Projects */}
          <div
            onClick={() => setActiveReportTab("budget")}
            className="cursor-pointer rounded-xl border border-u-line bg-u-card p-4 shadow-2xs hover:border-u-danger/30 hover:shadow-xs transition-all"
          >
            <div className="flex items-center justify-between text-u-muted">
              <span className="text-[11px] font-bold uppercase tracking-wider text-u-ink2">Over-Budget</span>
              <DollarSign className="h-4 w-4 text-u-danger" />
            </div>
            <p className="text-2xl font-bold text-u-danger mt-2">{kpis.overBudgetProjects}</p>
            <div className="mt-2 flex items-center justify-between text-[11px] text-u-muted">
              <span>Forecast exceeds approved</span>
              <span className="text-u-accent font-medium">Budget Tab &rarr;</span>
            </div>
          </div>

          {/* Card 5: Milestone Completion */}
          <div
            onClick={() => setActiveReportTab("progress")}
            className="cursor-pointer rounded-xl border border-u-line bg-u-card p-4 shadow-2xs hover:border-u-accent/30 hover:shadow-xs transition-all"
          >
            <div className="flex items-center justify-between text-u-muted">
              <span className="text-[11px] font-bold uppercase tracking-wider text-u-ink2">Milestone Delivery</span>
              <CheckCircle2 className="h-4 w-4 text-u-ok" />
            </div>
            <p className="text-2xl font-bold text-u-ink mt-2">
              {kpis.milestoneCompletionRate?.toFixed(1)}%
            </p>
            <div className="mt-2 flex items-center justify-between text-[11px] text-u-muted">
              <span>{kpis.milestonesCompletedCount} of {kpis.milestonesDueCount} due on-time</span>
              <span className="text-u-accent font-medium">Drill-Down &rarr;</span>
            </div>
          </div>
        </div>
      </div>

      {/* 6.2 & 6.3 CHARTS ROW: SCHEDULE HEALTH & BUDGET HEALTH */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Section 6.2: Portfolio Schedule Health Distribution */}
        <div className="rounded-2xl border border-u-line bg-u-card p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-u-line">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-u-ink">
                Portfolio Schedule Health Distribution
              </h3>
              <p className="text-[11px] text-u-muted">Click any segment to filter project list below</p>
            </div>
            {scheduleFilter && (
              <button
                onClick={() => setScheduleFilter(null)}
                className="text-[11px] font-semibold text-u-accent hover:text-u-accent bg-u-accent-soft px-2 py-0.5 rounded"
              >
                Clear Filter ({scheduleFilter})
              </button>
            )}
          </div>

          <div className="mt-5 space-y-3.5">
            {[
              { label: "On Track", count: scheduleCounts["On Track"], color: "bg-u-ok", text: "text-u-ok", border: "border-u-ok/30" },
              { label: "At Risk", count: scheduleCounts["At Risk"], color: "bg-u-warn", text: "text-u-warn", border: "border-u-warn/30" },
              { label: "Delayed", count: scheduleCounts.Delayed, color: "bg-u-danger", text: "text-u-danger", border: "border-u-danger/30" },
              { label: "Completed", count: scheduleCounts.Completed, color: "bg-u-accent", text: "text-u-accent", border: "border-u-accent/30" },
              { label: "On Hold", count: scheduleCounts["On Hold"], color: "bg-u-line2", text: "text-u-ink2", border: "border-u-line" },
            ].map((seg) => {
              const pct = projects.length > 0 ? (seg.count / projects.length) * 100 : 0;
              const isSelected = scheduleFilter === seg.label;
              return (
                <div
                  key={seg.label}
                  onClick={() => setScheduleFilter(isSelected ? null : seg.label)}
                  className={`group cursor-pointer rounded-xl p-2.5 transition-all ${
                    isSelected ? "bg-u-s3 ring-2 ring-u-accent/20" : "hover:bg-u-s2"
                  }`}
                >
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-semibold text-u-ink flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${seg.color}`} />
                      {seg.label}
                    </span>
                    <span className="font-medium text-u-ink2">
                      <strong>{seg.count}</strong> projects ({pct.toFixed(0)}%)
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-u-s3 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${seg.color} transition-all`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 pt-3 border-t border-u-line text-[11px] text-u-muted">
            <strong>Governance Rule:</strong> Schedule health is assessed against approved baseline dates, forecast milestones, and active risk registers. Completed historical milestones do not trigger delay flags if the project forecast is on track.
          </div>
        </div>

        {/* Section 6.3: Portfolio Budget Health */}
        <div className="rounded-2xl border border-u-line bg-u-card p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-u-line">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-u-ink">
                Portfolio Budget Health & Reconciliation
              </h3>
              <p className="text-[11px] text-u-muted">Distinguishing approved baselines, commitments & actuals</p>
            </div>
            <span className={`text-xs font-bold px-2 py-0.5 rounded ${
              (kpis.financials?.totalBudgetVariance || 0) >= 0 ? "bg-u-ok-soft text-u-ok" : "bg-u-danger-soft text-u-danger"
            }`}>
              {(kpis.financials?.totalBudgetVariance || 0) >= 0 ? "Favorable" : "Deficit Exposure"}
            </span>
          </div>

          <div className="mt-4 space-y-3 text-xs">
            {/* Metric Rows */}
            <div className="flex items-center justify-between py-2 border-b border-u-line">
              <span className="text-u-ink2">Original Approved Baseline Budget</span>
              <strong className="text-u-ink">{formatCurrency(kpis.financials?.totalOriginalBudget)}</strong>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-u-line">
              <span className="text-u-ink2">Cumulative Approved Budget Revisions</span>
              <strong className="text-u-accent">+{formatCurrency(kpis.financials?.totalApprovedRevisions)}</strong>
            </div>

            <div className="flex items-center justify-between py-2 bg-u-s2 px-3 rounded-lg border border-u-line font-bold text-u-ink">
              <span>Current Approved Project Budget</span>
              <span>{formatCurrency(kpis.financials?.totalCurrentBudget)}</span>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-u-line">
              <span className="text-u-ink2">Actual Cost Incurred (Recognized Spend)</span>
              <strong className="text-u-ink">{formatCurrency(kpis.financials?.totalActualCost)}</strong>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-u-line">
              <span className="text-u-ink2">Total Outstanding Commitments (Purchase Orders)</span>
              <strong className="text-u-ink">{formatCurrency(kpis.financials?.totalCommittedCost)}</strong>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-u-line">
              <span className="text-u-ink2">Forecast Final Cost at Handover</span>
              <strong className="text-u-ink">{formatCurrency(kpis.financials?.totalForecastFinalCost)}</strong>
            </div>

            <div className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-u-accent-soft/70 border border-u-accent/30 font-bold">
              <span className="text-u-ink">Portfolio Forecast Budget Variance</span>
              <span className={`${(kpis.financials?.totalBudgetVariance || 0) >= 0 ? "text-u-ok" : "text-u-danger"}`}>
                {formatCurrency(kpis.financials?.totalBudgetVariance)} (
                {kpis.financials?.totalBudgetVariancePct !== null ? formatPct(kpis.financials?.totalBudgetVariancePct) : "N/A"})
              </span>
            </div>
          </div>

          <div className="mt-3 text-[11px] text-u-muted">
            <strong>Accounting Control:</strong> Commitments and recognized actual expenditures are reconciled independently to eliminate double-counting.
          </div>
        </div>
      </div>

      {/* 6.4 PROJECT COMPLETION TREND & 6.5 UPCOMING MILESTONES */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Section 6.4: Monthly Project Completion Trend */}
        <div className="rounded-2xl border border-u-line bg-u-card p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-u-line">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-u-ink">
                Monthly Project Completion Trend (2025)
              </h3>
              <p className="text-[11px] text-u-muted">Scheduled baselines vs actual on-time vs delayed handovers</p>
            </div>
            <div className="flex items-center gap-3 text-[10px]">
              <span className="flex items-center gap-1 font-medium text-u-ink2">
                <span className="h-2 w-2 rounded bg-u-line" /> Scheduled
              </span>
              <span className="flex items-center gap-1 font-medium text-u-ok">
                <span className="h-2 w-2 rounded bg-u-ok" /> On-Time
              </span>
              <span className="flex items-center gap-1 font-medium text-u-danger">
                <span className="h-2 w-2 rounded bg-u-danger" /> Late
              </span>
            </div>
          </div>

          <div className="mt-6 flex items-end justify-between gap-2 h-44 pt-4 px-2">
            {completionsByMonth.map((m) => {
              const maxVal = 4;
              const scheduledH = (m.scheduled / maxVal) * 100;
              const onTimeH = (m.onTime / maxVal) * 100;
              const lateH = (m.late / maxVal) * 100;

              return (
                <div key={m.month} className="flex-1 flex flex-col items-center h-full justify-end group">
                  <div className="w-full flex items-end justify-center gap-0.5 h-32 relative">
                    {m.scheduled > 0 && (
                      <div
                        className="w-2.5 rounded-t bg-u-line transition-all group-hover:bg-u-line"
                        style={{ height: `${scheduledH}%` }}
                        title={`${m.month}: ${m.scheduled} scheduled`}
                      />
                    )}
                    {m.onTime > 0 && (
                      <div
                        className="w-2.5 rounded-t bg-u-ok transition-all group-hover:bg-u-ok"
                        style={{ height: `${onTimeH}%` }}
                        title={`${m.month}: ${m.onTime} completed on time`}
                      />
                    )}
                    {m.late > 0 && (
                      <div
                        className="w-2.5 rounded-t bg-u-danger transition-all group-hover:bg-u-danger"
                        style={{ height: `${lateH}%` }}
                        title={`${m.month}: ${m.late} completed late`}
                      />
                    )}
                  </div>
                  <span className="text-[10px] text-u-muted mt-2 font-medium">{m.month}</span>
                </div>
              );
            })}
          </div>

          <div className="mt-3 text-[11px] text-u-muted pt-3 border-t border-u-line">
            Approved baseline completion dates are strictly locked and compared with certified closeout acceptance dates.
          </div>
        </div>

        {/* Section 6.5: Upcoming Milestones */}
        <div className="rounded-2xl border border-u-line bg-u-card p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-u-line">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-u-ink">
                Upcoming Critical Path Milestones
              </h3>
              <p className="text-[11px] text-u-muted">Key deliverables scheduled in current cycle</p>
            </div>
            <button
              onClick={() => setActiveReportTab("progress")}
              className="text-xs font-medium text-u-accent hover:text-u-accent"
            >
              All Milestones &rarr;
            </button>
          </div>

          <div className="mt-3 divide-y divide-u-line">
            {upcomingMilestonesList.map((m) => (
              <div
                key={m.id}
                onClick={() => drillDownProject(m.projectId)}
                className="py-2.5 flex items-start justify-between gap-3 hover:bg-u-s2 p-2 rounded-lg cursor-pointer transition-colors"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] font-bold text-u-muted">{m.milestoneCode}</span>
                    <span className="text-xs font-semibold text-u-ink">{m.name}</span>
                  </div>
                  <p className="text-[11px] text-u-muted mt-0.5">
                    {m.projectName} • {m.responsiblePerson}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-xs font-bold text-u-ink">{formatDate(m.forecastEnd)}</span>
                  <div>
                    <span
                      className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${
                        m.status === "Delayed"
                          ? "bg-u-danger-soft text-u-danger"
                          : m.status === "In Progress"
                          ? "bg-u-accent-soft text-u-accent"
                          : "bg-u-s3 text-u-ink2"
                      }`}
                    >
                      {m.status}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 6.6 MANAGEMENT ATTENTION REQUIRED (PRIORITIZED EXCEPTIONS) */}
      <div className="rounded-2xl border border-u-danger/80 bg-u-card p-5 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-u-danger/30">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-u-danger-soft text-u-danger">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-u-ink">
                Management Attention Required ({managementExceptions.length} Prioritized Exceptions)
              </h3>
              <p className="text-xs text-u-muted">
                Rule-based algorithmic exceptions flagged for executive escalation and remedial action
              </p>
            </div>
          </div>
          <span className="text-xs font-semibold text-u-danger bg-u-danger-soft px-2.5 py-1 rounded-lg border border-u-danger/30">
            Escalation Threshold Active
          </span>
        </div>

        <div className="mt-4 space-y-3">
          {managementExceptions.map((exc) => (
            <div
              key={exc.id}
              onClick={() => drillDownProject(exc.projectId)}
              className="cursor-pointer rounded-xl border border-u-line bg-u-s2/50 p-3.5 hover:bg-u-s3/70 transition-all hover:border-u-line2"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      exc.severity === "Critical"
                        ? "bg-u-danger text-u-onaccent"
                        : exc.severity === "High"
                        ? "bg-u-warn text-u-onaccent"
                        : "bg-u-ink2 text-u-onaccent"
                    }`}
                  >
                    {exc.severity}
                  </span>
                  <span className="text-xs font-bold text-u-ink">{exc.title}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-u-muted">
                  <span>Due / Target: <strong className="text-u-ink2">{formatDate(exc.dueDate)}</strong></span>
                  <span className="text-u-accent font-semibold hover:underline flex items-center gap-1">
                    Drill-down <ChevronRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </div>

              <div className="mt-2 text-xs text-u-ink2">
                <p>
                  <strong>Project:</strong> {exc.projectName} ({exc.propertyName}) • <strong>Owner:</strong> {exc.responsiblePerson}
                </p>
                <p className="mt-0.5 text-u-ink2">
                  <strong>Impact:</strong> {exc.impact}
                </p>
                <div className="mt-2 rounded-lg bg-u-card p-2.5 text-[11px] text-u-ink2 border border-u-line/80">
                  <strong className="text-u-accent">Recommended Action:</strong> {exc.recommendation}
                </div>
              </div>
            </div>
          ))}

          {managementExceptions.length === 0 && (
            <div className="p-8 text-center text-xs text-u-muted">
              Zero management exceptions currently flagged. All projects are operating within tolerance limits.
            </div>
          )}
        </div>
      </div>

      {/* FILTERED PROJECT RECONCILIATION TABLE */}
      <div className="rounded-2xl border border-u-line bg-u-card p-5 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-u-line">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-u-ink">
              Portfolio Project Register {scheduleFilter ? `(Filtered by: ${scheduleFilter})` : ""}
            </h3>
            <p className="text-[11px] text-u-muted">Click any row to open the complete Project Control Dossier</p>
          </div>
          <span className="text-xs font-semibold text-u-ink2">{displayedProjects.length} Projects Shown</span>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-u-s2 text-[10px] font-bold text-u-muted uppercase border-b border-u-line">
              <tr>
                <th className="py-2.5 px-3">Project Code</th>
                <th className="py-2.5 px-3">Name & Property</th>
                <th className="py-2.5 px-3">Manager</th>
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-3">Approved Budget</th>
                <th className="py-2.5 px-3">Forecast Cost</th>
                <th className="py-2.5 px-3">Variance</th>
                <th className="py-2.5 px-3">Schedule</th>
                <th className="py-2.5 px-3">Progress</th>
                <th className="py-2.5 px-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-u-line">
              {displayedProjects.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => drillDownProject(p.id)}
                  className="hover:bg-u-accent-soft/40 cursor-pointer transition-colors"
                >
                  <td className="py-2.5 px-3 font-mono font-bold text-u-accent text-[11px]">{p.code}</td>
                  <td className="py-2.5 px-3">
                    <div className="font-semibold text-u-ink truncate max-w-[220px]">{p.name}</div>
                    <div className="text-[10px] text-u-muted">{p.propertyName}</div>
                  </td>
                  <td className="py-2.5 px-3 text-u-ink2">{p.managerName}</td>
                  <td className="py-2.5 px-3 text-u-ink2">{p.category}</td>
                  <td className="py-2.5 px-3 font-medium text-u-ink">{formatCurrency(p.currentApprovedBudget)}</td>
                  <td className="py-2.5 px-3 font-medium text-u-ink">{formatCurrency(p.forecastFinalCost)}</td>
                  <td className={`py-2.5 px-3 font-semibold ${p.budgetVariance >= 0 ? "text-u-ok" : "text-u-danger"}`}>
                    {formatCurrency(p.budgetVariance)}
                  </td>
                  <td className="py-2.5 px-3">
                    <span
                      className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        p.scheduleHealth === "On Track"
                          ? "bg-u-ok-soft text-u-ok"
                          : p.scheduleHealth === "Delayed"
                          ? "bg-u-danger-soft text-u-danger"
                          : p.scheduleHealth === "Completed"
                          ? "bg-u-accent-soft text-u-accent"
                          : "bg-u-warn-soft text-u-warn"
                      }`}
                    >
                      {p.scheduleHealth}
                    </span>
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-u-ink2">
                        {p.actualProgress !== null ? `${p.actualProgress}%` : "N/A"}
                      </span>
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-[11px] text-u-ink2">{p.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
