import React, { useState } from "react";
import {
  CalendarCheck2,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Filter,
  ArrowUpDown,
  Search,
  ExternalLink,
} from "lucide-react";
import { useProjectReports } from "../../context/ProjectReportsContext";
import { formatPct, formatDate } from "../../lib/calculations";

export function ProgressMilestoneReport() {
  const { projects, milestones, kpis, drillDownProject } = useProjectReports();

  const [milestoneSearch, setMilestoneSearch] = useState("");
  const [milestoneStatusFilter, setMilestoneStatusFilter] = useState("ALL");
  const [sortField, setSortField] = useState<"plannedEnd" | "delayDays">("plannedEnd");
  const [sortAsc, setSortAsc] = useState(true);

  // Filtered milestones
  const filteredMilestones = milestones
    .filter((m) => {
      if (milestoneStatusFilter !== "ALL" && m.status !== milestoneStatusFilter) return false;
      if (
        milestoneSearch &&
        !m.name.toLowerCase().includes(milestoneSearch.toLowerCase()) &&
        !m.responsiblePerson.toLowerCase().includes(milestoneSearch.toLowerCase()) &&
        !m.milestoneCode.toLowerCase().includes(milestoneSearch.toLowerCase())
      ) {
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (sortField === "delayDays") {
        return sortAsc ? a.delayDays - b.delayDays : b.delayDays - a.delayDays;
      }
      return sortAsc
        ? a.plannedEnd.localeCompare(b.plannedEnd)
        : b.plannedEnd.localeCompare(a.plannedEnd);
    });

  const delayedMilestones = milestones.filter((m) => m.delayDays > 0);

  return (
    <div className="space-y-6">
      {/* Header & KPI Summary */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-u-ink">Project Progress & Milestone Tracking</h2>
          <p className="text-xs text-u-muted">
            Evaluating schedule variance against original approved baselines and tracking critical path milestones
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-u-line bg-u-card p-4 shadow-2xs">
          <span className="text-[10px] font-bold uppercase text-u-muted">Milestone Completion Rate</span>
          <p className="text-2xl font-bold text-u-ink mt-1">
            {kpis?.milestoneCompletionRate !== undefined ? `${kpis.milestoneCompletionRate.toFixed(1)}%` : "N/A"}
          </p>
          <p className="text-[11px] text-u-muted mt-1">
            <strong>{kpis?.milestonesCompletedCount ?? 0}</strong> completed of <strong>{kpis?.milestonesDueCount ?? 0}</strong> due in period
          </p>
        </div>

        <div className="rounded-xl border border-u-line bg-u-card p-4 shadow-2xs">
          <span className="text-[10px] font-bold uppercase text-u-muted">Total Milestones Tracked</span>
          <p className="text-2xl font-bold text-u-ink mt-1">{milestones.length}</p>
          <p className="text-[11px] text-u-muted mt-1">Across {projects.length} filtered projects</p>
        </div>

        <div className="rounded-xl border border-u-line bg-u-card p-4 shadow-2xs">
          <span className="text-[10px] font-bold uppercase text-u-danger">Delayed Milestones</span>
          <p className="text-2xl font-bold text-u-danger mt-1">{delayedMilestones.length}</p>
          <p className="text-[11px] text-u-danger mt-1">
            Average delay: {delayedMilestones.length > 0
              ? `${Math.round(delayedMilestones.reduce((acc, m) => acc + m.delayDays, 0) / delayedMilestones.length)} days`
              : "0 days"}
          </p>
        </div>

        <div className="rounded-xl border border-u-line bg-u-card p-4 shadow-2xs">
          <span className="text-[10px] font-bold uppercase text-u-muted">Projects Past Baseline</span>
          <p className="text-2xl font-bold text-u-ink mt-1">{kpis?.delayedProjects ?? 0}</p>
          <p className="text-[11px] text-u-muted mt-1">Forecast completion past approved date</p>
        </div>
      </div>

      {/* 7.1 PROJECT SCHEDULE SUMMARY TABLE */}
      <div className="rounded-2xl border border-u-line bg-u-card p-5 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-u-line">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-u-ink">
              Project Schedule Baselines & Progress Comparison
            </h3>
            <p className="text-[11px] text-u-muted">
              Maintaining original approved baselines separately from revised forecasts
            </p>
          </div>
          <span className="text-xs text-u-muted font-medium">{projects.length} Projects</span>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-u-s2 text-[10px] font-bold text-u-muted uppercase border-b border-u-line">
              <tr>
                <th className="py-2.5 px-3">Project Code</th>
                <th className="py-2.5 px-3">Project & Property</th>
                <th className="py-2.5 px-3">PM & Contractor</th>
                <th className="py-2.5 px-3">Baseline Start</th>
                <th className="py-2.5 px-3">Baseline End</th>
                <th className="py-2.5 px-3">Forecast End</th>
                <th className="py-2.5 px-3">Actual End</th>
                <th className="py-2.5 px-3">Schedule Variance</th>
                <th className="py-2.5 px-3">Planned Progress</th>
                <th className="py-2.5 px-3">Actual Progress</th>
                <th className="py-2.5 px-3">Schedule Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-u-line">
              {projects.map((p) => {
                const isDelayed = p.scheduleVarianceDays > 0;
                return (
                  <tr
                    key={p.id}
                    onClick={() => drillDownProject(p.id)}
                    className="hover:bg-u-accent-soft/40 cursor-pointer transition-colors"
                  >
                    <td className="py-2.5 px-3 font-mono font-bold text-u-accent text-[11px]">{p.code}</td>
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-u-ink truncate max-w-[200px]">{p.name}</div>
                      <div className="text-[10px] text-u-muted">{p.propertyName}</div>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="text-u-ink">{p.managerName}</div>
                      <div className="text-[10px] text-u-muted truncate max-w-[140px]">{p.contractorName}</div>
                    </td>
                    <td className="py-2.5 px-3 text-u-ink2">{formatDate(p.originalStartDate)}</td>
                    <td className="py-2.5 px-3 font-medium text-u-ink">{formatDate(p.originalEndDate)}</td>
                    <td className="py-2.5 px-3 font-medium text-u-ink">{formatDate(p.forecastEndDate)}</td>
                    <td className="py-2.5 px-3 text-u-ink2">{formatDate(p.actualEndDate)}</td>
                    <td className={`py-2.5 px-3 font-semibold ${isDelayed ? "text-u-danger" : "text-u-ok"}`}>
                      {isDelayed ? `+${p.scheduleVarianceDays}d delay` : `${p.scheduleVarianceDays}d`}
                    </td>
                    <td className="py-2.5 px-3">
                      {p.plannedProgress !== null ? (
                        <span className="text-u-ink2 font-medium">{p.plannedProgress}%</span>
                      ) : (
                        <span className="text-[10px] text-u-muted italic">Not Confirmed</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      {p.actualProgress !== null ? (
                        <span className="text-u-accent font-bold">{p.actualProgress}%</span>
                      ) : (
                        <span className="text-[10px] text-u-muted">N/A</span>
                      )}
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
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 7.3 PROGRESS VISUALIZATION: TIMELINE / GANTT VIEW */}
      <div className="rounded-2xl border border-u-line bg-u-card p-5 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-u-line">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-u-ink">
              Project Schedule Timeline & Baseline Comparison
            </h3>
            <p className="text-[11px] text-u-muted">
              Visualizing original approved start/finish vs current forecast completion window
            </p>
          </div>
          <div className="flex items-center gap-3 text-[10px]">
            <span className="flex items-center gap-1">
              <span className="h-2 w-4 rounded bg-u-line" /> Approved Baseline
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-4 rounded bg-u-accent" /> Actual Progress
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-4 rounded bg-u-danger" /> Schedule Extension
            </span>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          {projects.map((p) => {
            // Normalize dates across FY2025 (Jan 2025 - Dec 2025 = 365 days)
            const yearStart = new Date("2025-01-01").getTime();
            const yearEnd = new Date("2025-12-31").getTime();
            const totalSpan = yearEnd - yearStart;

            const pStart = new Date(p.originalStartDate).getTime();
            const pEnd = new Date(p.originalEndDate).getTime();
            const pForecast = new Date(p.forecastEndDate).getTime();

            const leftPct = Math.max(0, Math.min(100, ((pStart - yearStart) / totalSpan) * 100));
            const baselineWidthPct = Math.max(5, Math.min(100 - leftPct, ((pEnd - pStart) / totalSpan) * 100));
            const extensionWidthPct =
              pForecast > pEnd ? Math.min(100 - (leftPct + baselineWidthPct), ((pForecast - pEnd) / totalSpan) * 100) : 0;

            return (
              <div
                key={p.id}
                onClick={() => drillDownProject(p.id)}
                className="group cursor-pointer rounded-xl p-2.5 hover:bg-u-s2 transition-colors"
              >
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-semibold text-u-ink group-hover:text-u-accent transition-colors">
                    <span className="font-mono text-u-muted mr-2">{p.code}</span>
                    {p.name}
                  </span>
                  <span className="text-[11px] text-u-muted">
                    {formatDate(p.originalStartDate)} &rarr; {formatDate(p.forecastEndDate)}{" "}
                    {p.scheduleVarianceDays > 0 && (
                      <strong className="text-u-danger font-bold ml-1">
                        (+{p.scheduleVarianceDays}d delay)
                      </strong>
                    )}
                  </span>
                </div>

                {/* Timeline Bar */}
                <div className="relative h-4 w-full rounded-md bg-u-s3 overflow-hidden flex items-center">
                  {/* Baseline bar */}
                  <div
                    className="absolute h-3 rounded bg-u-line top-0.5"
                    style={{ left: `${leftPct}%`, width: `${baselineWidthPct}%` }}
                  />
                  {/* Extension bar if delayed */}
                  {extensionWidthPct > 0 && (
                    <div
                      className="absolute h-3 rounded-r bg-u-danger top-0.5"
                      style={{ left: `${leftPct + baselineWidthPct}%`, width: `${extensionWidthPct}%` }}
                    />
                  )}
                  {/* Actual progress fill */}
                  <div
                    className="absolute h-3 rounded bg-u-accent top-0.5"
                    style={{ left: `${leftPct}%`, width: `${(baselineWidthPct * (p.actualProgress || 0)) / 100}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Timeline Month Labels */}
        <div className="mt-4 pt-3 border-t border-u-line flex justify-between text-[10px] text-u-muted font-mono">
          <span>Q1 2025</span>
          <span>Q2 2025</span>
          <span>Q3 2025</span>
          <span>Q4 2025</span>
        </div>
      </div>

      {/* 7.2 MILESTONE TRACKING TABLE */}
      <div className="rounded-2xl border border-u-line bg-u-card p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-u-line">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-u-ink">
              Detailed Milestone Register ({filteredMilestones.length})
            </h3>
            <p className="text-[11px] text-u-muted">Filter, search, and audit milestone completion status</p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-u-muted" />
              <input
                type="text"
                placeholder="Search milestones..."
                value={milestoneSearch}
                onChange={(e) => setMilestoneSearch(e.target.value)}
                className="rounded-lg border border-u-line py-1 pl-8 pr-3 text-xs text-u-ink placeholder:text-u-muted"
              />
            </div>

            {/* Status Filter */}
            <select
              value={milestoneStatusFilter}
              onChange={(e) => setMilestoneStatusFilter(e.target.value)}
              className="rounded-lg border border-u-line py-1 px-2.5 text-xs text-u-ink"
            >
              <option value="ALL">All Statuses</option>
              <option value="Completed">Completed</option>
              <option value="In Progress">In Progress</option>
              <option value="Pending">Pending</option>
              <option value="Delayed">Delayed</option>
            </select>

            {/* Sort by Delay */}
            <button
              onClick={() => {
                if (sortField === "delayDays") {
                  setSortAsc(!sortAsc);
                } else {
                  setSortField("delayDays");
                  setSortAsc(false);
                }
              }}
              className="flex items-center gap-1 rounded-lg border border-u-line px-2.5 py-1 text-u-ink2 hover:bg-u-s2 font-medium"
            >
              <ArrowUpDown className="h-3 w-3" />
              <span>Sort by Delay</span>
            </button>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-u-s2 text-[10px] font-bold text-u-muted uppercase border-b border-u-line">
              <tr>
                <th className="py-2.5 px-3">Milestone Code</th>
                <th className="py-2.5 px-3">Milestone Name</th>
                <th className="py-2.5 px-3">Project</th>
                <th className="py-2.5 px-3">Responsible</th>
                <th className="py-2.5 px-3">Planned Start</th>
                <th className="py-2.5 px-3">Planned End</th>
                <th className="py-2.5 px-3">Forecast End</th>
                <th className="py-2.5 px-3">Actual End</th>
                <th className="py-2.5 px-3">Delay (Days)</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-u-line">
              {filteredMilestones.map((m) => (
                <tr
                  key={m.id}
                  onClick={() => drillDownProject(m.projectId)}
                  className="hover:bg-u-accent-soft/40 cursor-pointer transition-colors"
                >
                  <td className="py-2.5 px-3 font-mono font-bold text-u-muted">{m.milestoneCode}</td>
                  <td className="py-2.5 px-3 font-semibold text-u-ink max-w-[200px] truncate">{m.name}</td>
                  <td className="py-2.5 px-3 text-u-ink2 max-w-[150px] truncate">{m.projectName}</td>
                  <td className="py-2.5 px-3 text-u-ink2">{m.responsiblePerson}</td>
                  <td className="py-2.5 px-3 text-u-muted">{formatDate(m.plannedStart)}</td>
                  <td className="py-2.5 px-3 font-medium text-u-ink">{formatDate(m.plannedEnd)}</td>
                  <td className="py-2.5 px-3 text-u-ink2">{formatDate(m.forecastEnd)}</td>
                  <td className="py-2.5 px-3 text-u-ink2">{formatDate(m.actualEnd)}</td>
                  <td className={`py-2.5 px-3 font-semibold ${m.delayDays > 0 ? "text-u-danger" : "text-u-ok"}`}>
                    {m.delayDays > 0 ? `+${m.delayDays}d` : `${m.delayDays}d`}
                  </td>
                  <td className="py-2.5 px-3">
                    <span
                      className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        m.status === "Completed"
                          ? "bg-u-ok-soft text-u-ok"
                          : m.status === "Delayed"
                          ? "bg-u-danger-soft text-u-danger"
                          : m.status === "In Progress"
                          ? "bg-u-accent-soft text-u-accent"
                          : "bg-u-s3 text-u-ink2"
                      }`}
                    >
                      {m.status}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-[11px] text-u-muted max-w-[200px] truncate">
                    {m.notes || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
