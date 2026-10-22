import React, { useMemo } from "react";
import { useReportContext } from "../../context/ReportContext";
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Clock,
  CheckCircle2,
  AlertCircle,
  Building2,
  Calendar,
  ArrowUpRight,
  ShieldAlert,
  ArrowRight,
  Filter,
  Plus,
} from "lucide-react";
import { TrendLineChart, HorizontalBarRankingChart } from "../charts/ChartComponents";

export function PerformanceDashboard() {
  const {
    kpis,
    filteredScorecards,
    filteredAttentionList,
    monthlyTrends,
    setDrilldownPropertyId,
    openCreateActionModal,
    setAuditScorecard,
    exportCurrentViewCsv,
    periodDisplayLabel,
    comparisonDisplayLabel,
    setPreviewRecord,
  } = useReportContext();

  const rankingItems = useMemo(() => {
    return [...filteredScorecards]
      .sort((a, b) => (b.overallScore ?? -1) - (a.overallScore ?? -1))
      .map((s) => ({
        id: s.propertyId,
        label: s.propertyName,
        subLabel: `${s.propertyType} • ${s.totalUnits} Units`,
        value: s.overallScore,
        change: s.scoreChange,
        classification: s.classification,
        target: s.targetScore,
      }));
  }, [filteredScorecards]);

  const trendPoints = useMemo(() => {
    return monthlyTrends.map((t) => ({
      label: t.monthLabel,
      current: t.currentScore,
      comparison: t.comparisonScore,
      meta: `WOs: ${t.completedWOs} comp / ${t.openWOs} open • PM Rate: ${t.pmCompletionRate}%`,
    }));
  }, [monthlyTrends]);

  const handleExportCsv = () => {
    const headers = ["Property", "Type", "Units", "Overall Score", "Classification", "Score Change", "Data Coverage %", "Manager"];
    const rows = filteredScorecards.map((s) => [
      s.propertyName,
      s.propertyType,
      s.totalUnits,
      s.overallScore !== null ? s.overallScore.toFixed(1) : "N/A",
      s.classification,
      s.scoreChange !== null ? `${s.scoreChange >= 0 ? "+" : ""}${s.scoreChange}` : "N/A",
      `${s.dataCoveragePercent}%`,
      s.managerName,
    ]);
    const summary = [
      { label: "Overall Portfolio Score", value: `${kpis.overallScore}/100` },
      { label: "Properties Requiring Attention", value: kpis.propertiesAttentionCount },
      { label: "Open Work Orders", value: kpis.openWorkOrdersCount },
      { label: "Overdue Work Orders", value: kpis.overdueWorkOrdersCount },
      { label: "Overdue Inspections", value: kpis.overdueInspectionsCount },
      { label: "PM Completion Rate", value: `${kpis.pmCompletionRate}%` },
      { label: "Avg Resolution Hours", value: `${kpis.avgResolutionHours} hrs` },
      { label: "Lease Renewal Rate", value: `${kpis.leaseRenewalRate}%` },
    ];
    exportCurrentViewCsv("Portfolio Performance Dashboard", headers, rows, summary);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-u-ink tracking-tight">
            Portfolio Performance Dashboard
          </h1>
          <p className="text-xs sm:text-sm text-u-muted mt-1">
            Executive operational health, maintenance trends, risk indicators, and management priorities.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs px-2.5 py-1 rounded-lg bg-u-accent-soft border border-u-accent/30 text-u-accent font-medium">
            Scope: {filteredScorecards.length} Properties Evaluated
          </span>
        </div>
      </div>

      {/* 5.1 Summary KPI Cards (8 metrics with Polarity Awareness) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Overall Portfolio Performance Score */}
        <div
          onClick={() => {
            const firstEligible = filteredScorecards.find((s) => s.overallScore !== null);
            if (firstEligible) setAuditScorecard(firstEligible);
          }}
          className="p-4 rounded-2xl bg-u-card border border-u-line shadow-xs hover:border-u-accent/60 hover:shadow-md transition cursor-pointer group"
        >
          <div className="flex items-center justify-between text-xs text-u-muted">
            <span className="font-semibold text-u-ink2 uppercase tracking-wider text-[11px]">
              Portfolio Health Score
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-u-accent-soft text-u-accent font-bold">
              0 - 100
            </span>
          </div>

          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-u-ink">{kpis.overallScore.toFixed(1)}</span>
            <div className="flex items-center gap-1 text-xs font-semibold text-u-ok">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>+{kpis.overallScoreChange.toFixed(1)}</span>
            </div>
          </div>

          <p className="text-[11px] text-u-muted mt-1">
            Prior: {kpis.overallScorePrevious.toFixed(1)} • Weighted across 5 operational pillars
          </p>
          <div className="mt-2 pt-2 border-t border-u-line flex items-center justify-between text-[11px] text-u-accent font-medium group-hover:translate-x-0.5 transition">
            <span>Audit formula & weights</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* 2. Properties Requiring Attention */}
        <div
          onClick={() => {
            const worst = filteredScorecards.find((s) => s.classification === "Needs Improvement" || s.classification === "Poor");
            if (worst) setDrilldownPropertyId(worst.propertyId);
          }}
          className={`p-4 rounded-2xl bg-u-card border shadow-xs hover:shadow-md transition cursor-pointer group ${
            kpis.propertiesAttentionCount > 0 ? "border-u-warn/30" : "border-u-line"
          }`}
        >
          <div className="flex items-center justify-between text-xs text-u-muted">
            <span className="font-semibold text-u-ink2 uppercase tracking-wider text-[11px]">
              Requires Attention
            </span>
            <AlertTriangle className="w-4 h-4 text-u-warn" />
          </div>

          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-u-warn">{kpis.propertiesAttentionCount}</span>
            <span className="text-xs font-medium text-u-muted">
              {kpis.propertiesAttentionCount === 1 ? "1 property" : `${kpis.propertiesAttentionCount} properties`}
            </span>
          </div>

          <p className="text-[11px] text-u-muted mt-1">
            Properties scoring &lt; 75.0 or with severe SLA / safety findings
          </p>
          <div className="mt-2 pt-2 border-t border-u-line flex items-center justify-between text-[11px] text-u-warn font-medium group-hover:translate-x-0.5 transition">
            <span>Inspect intervention targets</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* 3. Open Work Orders */}
        <div className="p-4 rounded-2xl bg-u-card border border-u-line shadow-xs hover:border-u-line2 hover:shadow-md transition">
          <div className="flex items-center justify-between text-xs text-u-muted">
            <span className="font-semibold text-u-ink2 uppercase tracking-wider text-[11px]">
              Open Work Orders
            </span>
            <Clock className="w-4 h-4 text-u-muted" />
          </div>

          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-u-ink">{kpis.openWorkOrdersCount}</span>
            <div className="flex items-center gap-1 text-xs font-semibold text-u-ok">
              <TrendingDown className="w-3.5 h-3.5" />
              <span>{kpis.openWorkOrdersChange} vs prior</span>
            </div>
          </div>

          <p className="text-[11px] text-u-muted mt-1">
            Active reactive and scheduled maintenance requests in queue
          </p>
          <div className="mt-2 pt-2 border-t border-u-line text-[11px] text-u-muted">
            Backlog reduction trend: Favorable
          </div>
        </div>

        {/* 4. Overdue Work Orders (POLARITY: increase is BAD) */}
        <div
          className={`p-4 rounded-2xl bg-u-card border shadow-xs hover:shadow-md transition ${
            kpis.overdueWorkOrdersCount > 0 ? "border-u-danger/30" : "border-u-line"
          }`}
        >
          <div className="flex items-center justify-between text-xs text-u-muted">
            <span className="font-semibold text-u-ink2 uppercase tracking-wider text-[11px]">
              Overdue Work Orders
            </span>
            <AlertCircle className="w-4 h-4 text-u-danger" />
          </div>

          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-u-danger">{kpis.overdueWorkOrdersCount}</span>
            <div className="flex items-center gap-1 text-xs font-semibold text-u-danger">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>+{kpis.overdueWorkOrdersChange} (Breached SLA)</span>
            </div>
          </div>

          <p className="text-[11px] text-u-muted mt-1">
            WOs that exceeded target SLA response or resolution window
          </p>
          <div className="mt-2 pt-2 border-t border-u-line text-[11px] text-u-danger font-semibold">
            Requires dispatcher intervention
          </div>
        </div>

        {/* 5. Overdue Inspections */}
        <div className="p-4 rounded-2xl bg-u-card border border-u-line shadow-xs hover:shadow-md transition">
          <div className="flex items-center justify-between text-xs text-u-muted">
            <span className="font-semibold text-u-ink2 uppercase tracking-wider text-[11px]">
              Overdue Inspections
            </span>
            <ShieldAlert className="w-4 h-4 text-u-warn" />
          </div>

          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-u-warn">{kpis.overdueInspectionsCount}</span>
            <span className="text-xs text-u-muted">Uncompleted audits</span>
          </div>

          <p className="text-[11px] text-u-muted mt-1">
            Mandatory annual, municipal code, or fire safety audits past target date
          </p>
          <div className="mt-2 pt-2 border-t border-u-line text-[11px] text-u-muted">
            Compliance risk: Moderate
          </div>
        </div>

        {/* 6. Preventive Maintenance Completion Rate */}
        <div className="p-4 rounded-2xl bg-u-card border border-u-line shadow-xs hover:shadow-md transition">
          <div className="flex items-center justify-between text-xs text-u-muted">
            <span className="font-semibold text-u-ink2 uppercase tracking-wider text-[11px]">
              Preventive Maint. Rate
            </span>
            <CheckCircle2 className="w-4 h-4 text-u-ok" />
          </div>

          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-u-ink">{kpis.pmCompletionRate}%</span>
            <div className="flex items-center gap-1 text-xs font-semibold text-u-ok">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>+{kpis.pmCompletionRateChange}%</span>
            </div>
          </div>

          <p className="text-[11px] text-u-muted mt-1">
            Prior: {kpis.pmCompletionRatePrevious}% • Target: &gt; 80% proactive ratio
          </p>
          <div className="mt-2 pt-2 border-t border-u-line text-[11px] text-u-ok font-medium">
            Proactive maintenance index: Strong
          </div>
        </div>

        {/* 7. Average Maintenance Resolution Time (POLARITY: decrease is GOOD) */}
        <div className="p-4 rounded-2xl bg-u-card border border-u-line shadow-xs hover:shadow-md transition">
          <div className="flex items-center justify-between text-xs text-u-muted">
            <span className="font-semibold text-u-ink2 uppercase tracking-wider text-[11px]">
              Avg. Resolution Time
            </span>
            <Clock className="w-4 h-4 text-u-accent" />
          </div>

          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-u-ink">{kpis.avgResolutionHours} hrs</span>
            <div className="flex items-center gap-1 text-xs font-semibold text-u-ok">
              <TrendingDown className="w-3.5 h-3.5" />
              <span>{kpis.avgResolutionHoursChange} hrs (Faster)</span>
            </div>
          </div>

          <p className="text-[11px] text-u-muted mt-1">
            Elapsed duration from creation to verified completion on completed WOs
          </p>
          <div className="mt-2 pt-2 border-t border-u-line text-[11px] text-u-muted">
            Target benchmark: &lt; 24.0 hours
          </div>
        </div>

        {/* 8. Lease Renewal Rate */}
        <div className="p-4 rounded-2xl bg-u-card border border-u-line shadow-xs hover:shadow-md transition">
          <div className="flex items-center justify-between text-xs text-u-muted">
            <span className="font-semibold text-u-ink2 uppercase tracking-wider text-[11px]">
              Lease Renewal Rate
            </span>
            <Building2 className="w-4 h-4 text-u-accent" />
          </div>

          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-u-ink">{kpis.leaseRenewalRate}%</span>
            <div className="flex items-center gap-1 text-xs font-semibold text-u-ok">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>+{kpis.leaseRenewalRateChange}%</span>
            </div>
          </div>

          <p className="text-[11px] text-u-muted mt-1">
            Prior: {kpis.leaseRenewalRatePrevious}% • Eligible leases accepted vs non-renewed
          </p>
          <div className="mt-2 pt-2 border-t border-u-line text-[11px] text-u-accent font-medium">
            Tenant retention health: Stable
          </div>
        </div>
      </div>

      {/* 5.2 Portfolio Trend & 5.3 Property Ranking Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Trend Line Chart (7 cols) */}
        <div className="lg:col-span-7 p-5 rounded-2xl bg-u-card border border-u-line shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-u-line">
            <div>
              <h3 className="text-sm font-bold text-u-ink">Portfolio Performance Trend</h3>
              <p className="text-xs text-u-muted mt-0.5">
                Monthly composite score over time ({periodDisplayLabel}) {comparisonDisplayLabel}
              </p>
            </div>
            <span className="text-[11px] font-medium text-u-muted">Monthly Index</span>
          </div>

          <div className="pt-4">
            <TrendLineChart
              points={trendPoints}
              currentLabel="Current Trend (2024-2025)"
              comparisonLabel="Prior Year Trend"
              valueSuffix=""
              height={220}
            />
          </div>
        </div>

        {/* Horizontal Property Ranking Bar Chart (5 cols) */}
        <div className="lg:col-span-5 p-5 rounded-2xl bg-u-card border border-u-line shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-u-line">
              <div>
                <h3 className="text-sm font-bold text-u-ink">Property Ranking & Benchmark</h3>
                <p className="text-xs text-u-muted mt-0.5">Ranked by overall operational score</p>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-u-s3 text-u-ink2 font-medium">
                Target: 80.0
              </span>
            </div>

            <div className="pt-3">
              <HorizontalBarRankingChart
                items={rankingItems}
                targetValue={80}
                onItemClick={(id) => setDrilldownPropertyId(id)}
              />
            </div>
          </div>

          <div className="pt-3 border-t border-u-line flex items-center justify-between text-xs text-u-muted">
            <span>Click any property to open detail scorecard</span>
            <span className="text-u-accent font-medium flex items-center gap-1">
              {rankingItems.length} properties <ChevronRightIcon />
            </span>
          </div>
        </div>
      </div>

      {/* 5.4 Management Attention Required (Prioritized Operational Action List) */}
      <div className="p-5 rounded-2xl bg-u-card border border-u-line shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-u-line gap-2">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-u-ink">Management Attention Required</h3>
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-u-danger-soft text-u-danger">
                {filteredAttentionList.length} items
              </span>
            </div>
            <p className="text-xs text-u-muted mt-0.5">
              Prioritized interventions derived from safety defects, overdue WOs, failed inspections, and asset risks
            </p>
          </div>

          <button
            onClick={() => openCreateActionModal()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-u-onaccent bg-u-accent hover:bg-u-accent-strong rounded-lg shadow-2xs transition self-start sm:self-auto"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Action Item</span>
          </button>
        </div>

        {filteredAttentionList.length === 0 ? (
          <div className="text-center py-10 text-u-muted">
            <CheckCircle2 className="w-10 h-10 text-u-ok mx-auto mb-2" />
            <p className="text-sm font-semibold text-u-ink2">No Critical Management Attention Items</p>
            <p className="text-xs text-u-muted mt-1">All properties are currently performing within SLA and safety standards.</p>
          </div>
        ) : (
          <div className="divide-y divide-u-line">
            {filteredAttentionList.map((item) => (
              <div
                key={item.id}
                className="py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-u-s2/60 rounded-xl px-2 transition"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        item.severity === "Critical"
                          ? "bg-u-danger text-u-onaccent"
                          : item.severity === "High"
                          ? "bg-u-warn-soft text-u-warn"
                          : "bg-u-accent-soft text-u-accent"
                      }`}
                    >
                      {item.severity}
                    </span>
                    <button
                      onClick={() => setDrilldownPropertyId(item.propertyId)}
                      className="font-bold text-xs text-u-ink hover:text-u-accent transition"
                    >
                      {item.propertyName}
                    </button>
                    <span className="text-[11px] text-u-muted">• {item.category}</span>
                    <span className="text-[11px] text-u-muted">• Identified {item.dateIdentified}</span>
                  </div>

                  <p className="text-xs text-u-ink font-medium">{item.issue}</p>

                  <div className="flex items-center gap-3 text-[11px] text-u-muted">
                    <span>
                      <strong className="text-u-ink2">Recommended Action:</strong> {item.recommendedAction}
                    </span>
                    <span>• Resp: {item.responsiblePerson}</span>
                    <span>• Due: {item.dueDate}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                  <button
                    onClick={() =>
                      openCreateActionModal({
                        propertyId: item.propertyId,
                        issue: item.issue,
                        severity: item.severity,
                        responsiblePerson: item.responsiblePerson,
                        dueDate: item.dueDate,
                        relatedRecordType: item.relatedRecordType,
                        relatedRecordId: item.relatedRecordId,
                      })
                    }
                    className="px-3 py-1.5 text-xs font-semibold text-u-onaccent bg-u-ink2 hover:bg-u-ink2 rounded-lg transition"
                  >
                    Take Action
                  </button>
                  <button
                    onClick={() => setDrilldownPropertyId(item.propertyId)}
                    className="p-1.5 rounded-lg text-u-muted hover:text-u-ink2 hover:bg-u-s3 transition"
                    title="View property detail"
                  >
                    <ArrowUpRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ChevronRightIcon() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}
