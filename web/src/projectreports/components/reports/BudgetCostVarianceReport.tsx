import React, { useState } from "react";
import {
  DollarSign,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  FileCheck2,
  Calendar,
  Layers,
  BarChart3,
  Filter,
} from "lucide-react";
import { useProjectReports } from "../../context/ProjectReportsContext";
import { formatCurrency, formatPct, formatDate } from "../../lib/calculations";

export function BudgetCostVarianceReport() {
  const { projects, spending, changeOrders, kpis, drillDownProject } = useProjectReports();
  const [budgetFilter, setBudgetFilter] = useState<string>("ALL");

  const filteredProjects = projects.filter((p) => {
    if (budgetFilter === "OVERRUN") return p.budgetVariance < 0;
    if (budgetFilter === "SAVINGS") return p.budgetVariance > 0;
    if (budgetFilter === "CRITICAL") return p.budgetHealth === "Critical";
    if (budgetFilter === "WARNING") return p.budgetHealth === "Warning";
    return true;
  });

  // Monthly Spending aggregation from monthly_spending records
  const monthlyTotalsMap: Record<string, { budget: number; committed: number; actual: number }> = {};
  spending.forEach((s) => {
    if (!monthlyTotalsMap[s.period]) {
      monthlyTotalsMap[s.period] = { budget: 0, committed: 0, actual: 0 };
    }
    monthlyTotalsMap[s.period].budget += s.budgetAllocated;
    monthlyTotalsMap[s.period].committed += s.committedAmount;
    monthlyTotalsMap[s.period].actual += s.actualIncurred;
  });

  const sortedPeriods = Object.keys(monthlyTotalsMap).sort();

  return (
    <div className="space-y-6">
      {/* Report Header */}
      <div>
        <h2 className="text-base font-bold text-u-ink">Project Budget & Cost Variance Control</h2>
        <p className="text-xs text-u-muted">
          Tracking commitments, actual invoice drawdowns, and forecast final cost against approved baselines
        </p>
      </div>

      {/* 8.1 REQUIRED FINANCIAL METRICS SUMMARY */}
      {kpis?.financials && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <div className="rounded-xl border border-u-line bg-u-card p-3.5 shadow-2xs">
            <span className="text-[10px] font-bold uppercase text-u-muted">Original Approved</span>
            <p className="text-base font-bold text-u-ink mt-1">
              {formatCurrency(kpis.financials.totalOriginalBudget)}
            </p>
            <span className="text-[10px] text-u-muted">Baseline allocation</span>
          </div>

          <div className="rounded-xl border border-u-line bg-u-card p-3.5 shadow-2xs">
            <span className="text-[10px] font-bold uppercase text-u-muted">Approved Revisions</span>
            <p className="text-base font-bold text-u-accent mt-1">
              +{formatCurrency(kpis.financials.totalApprovedRevisions)}
            </p>
            <span className="text-[10px] text-u-accent font-medium">Via authorized change orders</span>
          </div>

          <div className="rounded-xl border border-u-line bg-u-card p-3.5 shadow-2xs">
            <span className="text-[10px] font-bold uppercase text-u-muted">Current Approved</span>
            <p className="text-base font-bold text-u-ink mt-1">
              {formatCurrency(kpis.financials.totalCurrentBudget)}
            </p>
            <span className="text-[10px] text-u-muted">Base + Revisions</span>
          </div>

          <div className="rounded-xl border border-u-line bg-u-card p-3.5 shadow-2xs">
            <span className="text-[10px] font-bold uppercase text-u-muted">Actual Cost Incurred</span>
            <p className="text-base font-bold text-u-ink mt-1">
              {formatCurrency(kpis.financials.totalActualCost)}
            </p>
            <span className="text-[10px] text-u-muted">Recognized invoice spend</span>
          </div>

          <div className="rounded-xl border border-u-line bg-u-card p-3.5 shadow-2xs">
            <span className="text-[10px] font-bold uppercase text-u-muted">Committed (POs)</span>
            <p className="text-base font-bold text-u-ink mt-1">
              {formatCurrency(kpis.financials.totalCommittedCost)}
            </p>
            <span className="text-[10px] text-u-muted">Contractual commitments</span>
          </div>

          <div className="rounded-xl border border-u-line bg-u-card p-3.5 shadow-2xs">
            <span className="text-[10px] font-bold uppercase text-u-muted">Forecast Variance</span>
            <p className={`text-base font-bold mt-1 ${
              kpis.financials.totalBudgetVariance >= 0 ? "text-u-ok" : "text-u-danger"
            }`}>
              {formatCurrency(kpis.financials.totalBudgetVariance)}
            </p>
            <span className="text-[10px] text-u-muted">
              {kpis.financials.totalBudgetVariancePct !== null ? formatPct(kpis.financials.totalBudgetVariancePct) : "N/A"}
            </span>
          </div>
        </div>
      )}

      {/* 8.4 CHARTS: MONTHLY SPENDING & VARIANCE BY PROJECT */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Incurred vs Committed Chart */}
        <div className="rounded-2xl border border-u-line bg-u-card p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-u-line">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-u-ink">
                Monthly Project Incurred Spending & Commitments
              </h3>
              <p className="text-[11px] text-u-muted">Aggregated from dated project cost expenditure records</p>
            </div>
            <div className="flex items-center gap-3 text-[10px]">
              <span className="flex items-center gap-1 font-medium text-u-accent">
                <span className="h-2 w-2 rounded bg-u-accent" /> Incurred
              </span>
              <span className="flex items-center gap-1 font-medium text-u-ink2">
                <span className="h-2 w-2 rounded bg-u-line" /> Budget Allocated
              </span>
            </div>
          </div>

          <div className="mt-6 flex items-end justify-between gap-3 h-48 pt-4 px-2">
            {sortedPeriods.map((period) => {
              const data = monthlyTotalsMap[period];
              const maxVal = 200000;
              const actualH = Math.min(100, (data.actual / maxVal) * 100);
              const budgetH = Math.min(100, (data.budget / maxVal) * 100);

              return (
                <div key={period} className="flex-1 flex flex-col items-center h-full justify-end group">
                  <div className="w-full flex items-end justify-center gap-1 h-36">
                    <div
                      className="w-3 rounded-t bg-u-line group-hover:bg-u-line transition-all"
                      style={{ height: `${budgetH}%` }}
                      title={`${period} Budget: ${formatCurrency(data.budget)}`}
                    />
                    <div
                      className="w-3 rounded-t bg-u-accent group-hover:bg-u-accent-strong transition-all"
                      style={{ height: `${actualH}%` }}
                      title={`${period} Actual: ${formatCurrency(data.actual)}`}
                    />
                  </div>
                  <span className="text-[10px] text-u-muted mt-2 font-mono">
                    {period.split("-")[1]}/{period.split("-")[0].slice(2)}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="mt-3 text-[11px] text-u-muted pt-3 border-t border-u-line">
            Actual invoice drawdowns reflect verified progress payment certificates submitted by general contractors.
          </div>
        </div>

        {/* Forecast Variance by Project Bar Comparison */}
        <div className="rounded-2xl border border-u-line bg-u-card p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-u-line">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-u-ink">
                Budget Variance by Project ($)
              </h3>
              <p className="text-[11px] text-u-muted">Approved Budget minus Forecast Final Cost</p>
            </div>
            <div className="flex items-center gap-3 text-[10px]">
              <span className="text-u-ok font-bold">Positive = Savings</span>
              <span className="text-u-danger font-bold">Negative = Overrun</span>
            </div>
          </div>

          <div className="mt-4 space-y-3 max-h-56 overflow-y-auto pr-1">
            {projects.map((p) => {
              const isOverrun = p.budgetVariance < 0;
              const absVal = Math.abs(p.budgetVariance);
              const barWidth = Math.min(100, (absVal / 50000) * 100);

              return (
                <div
                  key={p.id}
                  onClick={() => drillDownProject(p.id)}
                  className="cursor-pointer group rounded-lg p-1.5 hover:bg-u-s2 transition-colors"
                >
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-semibold text-u-ink group-hover:text-u-accent transition-colors truncate max-w-[220px]">
                      {p.name}
                    </span>
                    <span className={`font-bold ${isOverrun ? "text-u-danger" : "text-u-ok"}`}>
                      {formatCurrency(p.budgetVariance)} ({p.budgetVariancePct !== null ? formatPct(p.budgetVariancePct) : "N/A"})
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-u-s3 overflow-hidden flex">
                    <div
                      className={`h-full rounded-full transition-all ${isOverrun ? "bg-u-danger" : "bg-u-ok"}`}
                      style={{ width: `${Math.max(5, barWidth)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-3 text-[11px] text-u-muted pt-3 border-t border-u-line">
            Zero-budget initiatives display "N/A" safely without generating division errors.
          </div>
        </div>
      </div>

      {/* 8.2 BUDGET SUMMARY TABLE */}
      <div className="rounded-2xl border border-u-line bg-u-card p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-u-line">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-u-ink">
              Project Financial Control & Variance Register ({filteredProjects.length})
            </h3>
            <p className="text-[11px] text-u-muted">
              Reconciling baselines, revisions, recognized invoices, commitments, and forecast final costs
            </p>
          </div>

          {/* Quick Filter buttons */}
          <div className="flex items-center gap-1.5 text-xs">
            <button
              onClick={() => setBudgetFilter("ALL")}
              className={`rounded-lg px-2.5 py-1 font-medium transition-colors ${
                budgetFilter === "ALL" ? "bg-u-ink2 text-u-onaccent" : "bg-u-s3 text-u-ink2 hover:bg-u-line"
              }`}
            >
              All Projects
            </button>
            <button
              onClick={() => setBudgetFilter("OVERRUN")}
              className={`rounded-lg px-2.5 py-1 font-medium transition-colors ${
                budgetFilter === "OVERRUN" ? "bg-u-danger text-u-onaccent" : "bg-u-danger-soft text-u-danger hover:bg-u-danger-soft"
              }`}
            >
              Overrun Only
            </button>
            <button
              onClick={() => setBudgetFilter("CRITICAL")}
              className={`rounded-lg px-2.5 py-1 font-medium transition-colors ${
                budgetFilter === "CRITICAL" ? "bg-u-danger text-u-onaccent" : "bg-u-s3 text-u-ink2 hover:bg-u-line"
              }`}
            >
              Critical (&gt;10%)
            </button>
            <button
              onClick={() => setBudgetFilter("SAVINGS")}
              className={`rounded-lg px-2.5 py-1 font-medium transition-colors ${
                budgetFilter === "SAVINGS" ? "bg-u-ok text-u-onaccent" : "bg-u-ok-soft text-u-ok hover:bg-u-ok-soft"
              }`}
            >
              Savings
            </button>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-u-s2 text-[10px] font-bold text-u-muted uppercase border-b border-u-line">
              <tr>
                <th className="py-2.5 px-3">Project Code</th>
                <th className="py-2.5 px-3">Project & Property</th>
                <th className="py-2.5 px-3">PM</th>
                <th className="py-2.5 px-3">Original Budget</th>
                <th className="py-2.5 px-3">Revisions</th>
                <th className="py-2.5 px-3">Current Budget</th>
                <th className="py-2.5 px-3">Actual Cost</th>
                <th className="py-2.5 px-3">Committed</th>
                <th className="py-2.5 px-3">Forecast Cost</th>
                <th className="py-2.5 px-3">Remaining Budget</th>
                <th className="py-2.5 px-3">Variance ($)</th>
                <th className="py-2.5 px-3">Variance (%)</th>
                <th className="py-2.5 px-3">Budget Health</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-u-line">
              {filteredProjects.map((p) => {
                const isOverrun = p.budgetVariance < 0;
                return (
                  <tr
                    key={p.id}
                    onClick={() => drillDownProject(p.id)}
                    className="hover:bg-u-accent-soft/40 cursor-pointer transition-colors"
                  >
                    <td className="py-2.5 px-3 font-mono font-bold text-u-accent text-[11px]">{p.code}</td>
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-u-ink truncate max-w-[180px]">{p.name}</div>
                      <div className="text-[10px] text-u-muted">{p.propertyName}</div>
                    </td>
                    <td className="py-2.5 px-3 text-u-ink2">{p.managerName}</td>
                    <td className="py-2.5 px-3 text-u-ink2">{formatCurrency(p.originalBudget)}</td>
                    <td className="py-2.5 px-3 text-u-accent font-medium">+{formatCurrency(p.approvedRevisions)}</td>
                    <td className="py-2.5 px-3 font-semibold text-u-ink">{formatCurrency(p.currentApprovedBudget)}</td>
                    <td className="py-2.5 px-3 text-u-ink">{formatCurrency(p.actualCost)}</td>
                    <td className="py-2.5 px-3 text-u-ink2">{formatCurrency(p.committedCost)}</td>
                    <td className="py-2.5 px-3 font-medium text-u-ink">{formatCurrency(p.forecastFinalCost)}</td>
                    <td className="py-2.5 px-3 text-u-accent font-semibold">{formatCurrency(p.remainingBudget)}</td>
                    <td className={`py-2.5 px-3 font-bold ${isOverrun ? "text-u-danger" : "text-u-ok"}`}>
                      {formatCurrency(p.budgetVariance)}
                    </td>
                    <td className={`py-2.5 px-3 font-bold ${isOverrun ? "text-u-danger" : "text-u-ok"}`}>
                      {p.budgetVariancePct !== null ? formatPct(p.budgetVariancePct) : "N/A"}
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          p.budgetHealth === "Healthy"
                            ? "bg-u-ok-soft text-u-ok"
                            : p.budgetHealth === "Warning"
                            ? "bg-u-warn-soft text-u-warn"
                            : p.budgetHealth === "At Risk"
                            ? "bg-u-warn-soft text-u-warn"
                            : "bg-u-danger-soft text-u-danger"
                        }`}
                      >
                        {p.budgetHealth}
                      </span>
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
