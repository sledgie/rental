import React, { useState } from "react";
import { useReportContext } from "../../context/ReportContext";
import {
  Building2,
  Sliders,
  Calculator,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Info,
  Calendar,
  Layers,
  ChevronRight,
  ExternalLink,
} from "lucide-react";

export function ScorecardPage({ onNavigateTab }: { onNavigateTab?: (tab: string) => void }) {
  const {
    filteredScorecards,
    weights,
    setIsConfigModalOpen,
    setAuditScorecard,
    setDrilldownPropertyId,
    periodDisplayLabel,
    exportCurrentViewCsv,
  } = useReportContext();

  const [selectedPropId, setSelectedPropId] = useState<string>(
    filteredScorecards[0]?.propertyId || ""
  );

  const activeCard =
    filteredScorecards.find((s) => s.propertyId === selectedPropId) ||
    filteredScorecards[0];

  const handleExportCsv = () => {
    if (!activeCard) return;
    const headers = [
      "Category",
      "Configured Weight",
      "Current Score",
      "Previous Score",
      "Change",
      "Status",
      "Coverage %",
      "Records Used",
    ];
    const rows = activeCard.categories.map((c) => [
      c.name,
      `${c.weight}%`,
      c.score !== null ? c.score.toFixed(1) : "N/A",
      c.previousScore !== null ? c.previousScore.toFixed(1) : "N/A",
      c.change !== null ? `${c.change >= 0 ? "+" : ""}${c.change}` : "N/A",
      c.status,
      `${c.dataCoverage}%`,
      c.recordsUsedCount,
    ]);
    const summary = [
      { label: "Property Name", value: activeCard.propertyName },
      { label: "Overall Score", value: activeCard.overallScore !== null ? `${activeCard.overallScore}/100` : "Insufficient Data" },
      { label: "Classification", value: activeCard.classification },
      { label: "Data Coverage", value: `${activeCard.dataCoveragePercent}%` },
    ];
    exportCurrentViewCsv(`Scorecard - ${activeCard.propertyName}`, headers, rows, summary);
  };

  if (!activeCard) {
    return (
      <div className="p-12 text-center text-u-muted bg-u-card rounded-2xl border border-u-line">
        <Building2 className="w-12 h-12 mx-auto text-u-s3 mb-2" />
        <p className="text-base font-semibold text-u-ink2">No Properties Match Applied Filter</p>
        <p className="text-xs text-u-muted mt-1">Adjust property or manager filters in the global filter bar above.</p>
      </div>
    );
  }

  const navigateToCategoryReport = (key: string) => {
    if (!onNavigateTab) return;
    switch (key) {
      case "maintenance":
        onNavigateTab("maintenance");
        break;
      case "condition":
        onNavigateTab("inspections");
        break;
      case "retention":
        onNavigateTab("retention");
        break;
      case "efficiency":
        onNavigateTab("efficiency");
        break;
      case "lifecycle":
        onNavigateTab("lifecycle");
        break;
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-u-ink tracking-tight">
            Property Performance Scorecard
          </h1>
          <p className="text-xs sm:text-sm text-u-muted mt-1">
            Comprehensive evaluation across the 5 core operational performance categories.
          </p>
        </div>

        {/* Quick Property Switcher */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-u-muted whitespace-nowrap">Evaluate Property:</label>
          <select
            value={activeCard.propertyId}
            onChange={(e) => setSelectedPropId(e.target.value)}
            className="text-xs font-medium bg-u-card border border-u-line2 rounded-lg px-3 py-1.5 shadow-2xs text-u-ink"
          >
            {filteredScorecards.map((s) => (
              <option key={s.propertyId} value={s.propertyId}>
                {s.propertyName} ({s.classification})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 6.1 Property Summary Card */}
      <div className="p-6 rounded-2xl bg-u-card border border-u-line shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-u-line">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs px-2 py-0.5 rounded bg-u-s3 text-u-ink2 font-bold">
                {activeCard.propertyCode}
              </span>
              <h2 className="text-xl font-bold text-u-ink">{activeCard.propertyName}</h2>
              <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-u-accent-soft text-u-accent">
                {activeCard.propertyType}
              </span>
            </div>
            <p className="text-xs text-u-muted">
              {activeCard.address} • {activeCard.totalBuildings} Buildings • {activeCard.totalUnits} Units • Assigned Manager: <strong className="text-u-ink2">{activeCard.managerName}</strong>
            </p>
            <div className="flex items-center gap-4 text-xs text-u-muted pt-1">
              <span>Period: <strong className="text-u-ink">{periodDisplayLabel}</strong></span>
              <span>•</span>
              <span>Target Benchmark: <strong className="text-u-ink">{activeCard.targetScore.toFixed(1)}</strong></span>
            </div>
          </div>

          {/* Large Overall Score Badge & Data Completeness Indicator */}
          <div className="flex items-center gap-5 shrink-0">
            {/* Score box */}
            <div
              onClick={() => setAuditScorecard(activeCard)}
              className="p-4 rounded-2xl bg-u-s2 border border-u-line hover:border-u-accent/60 hover:shadow-md transition cursor-pointer text-center min-w-[130px] group"
              title="Click to view full mathematical audit and formula breakdown"
            >
              <div className="text-[10px] font-bold text-u-muted uppercase tracking-wider">
                Overall Score
              </div>
              <div className="mt-1 flex items-baseline justify-center gap-1">
                <span className="text-3xl font-extrabold text-u-ink">
                  {activeCard.overallScore !== null ? activeCard.overallScore.toFixed(1) : "N/A"}
                </span>
                <span className="text-xs text-u-muted">/ 100</span>
              </div>
              <span
                className={`inline-block mt-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                  activeCard.classification === "Excellent"
                    ? "bg-u-ok-soft text-u-ok"
                    : activeCard.classification === "Good"
                    ? "bg-u-accent-soft text-u-accent"
                    : activeCard.classification === "Needs Improvement"
                    ? "bg-u-warn-soft text-u-warn"
                    : activeCard.classification === "Insufficient Data"
                    ? "bg-u-line text-u-ink"
                    : "bg-u-danger-soft text-u-danger"
                }`}
              >
                {activeCard.classification}
              </span>

              {activeCard.scoreChange !== null && (
                <div className="mt-1 text-[11px] font-semibold text-u-ok flex items-center justify-center gap-0.5">
                  <TrendingUp className="w-3 h-3" />
                  <span>+{activeCard.scoreChange} vs prior</span>
                </div>
              )}
            </div>

            {/* Coverage Box */}
            <div className="p-4 rounded-2xl bg-u-s2 border border-u-line text-center min-w-[130px]">
              <div className="text-[10px] font-bold text-u-muted uppercase tracking-wider">
                Data Completeness
              </div>
              <div className="mt-1 flex items-baseline justify-center gap-1">
                <span className={`text-2xl font-bold ${activeCard.dataCoveragePercent >= 60 ? "text-u-accent" : "text-u-warn"}`}>
                  {activeCard.dataCoveragePercent}%
                </span>
              </div>
              <span className="text-[10px] text-u-muted block mt-1">
                {activeCard.totalRecordsCount} logs verified
              </span>
              <span
                className={`inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded ${
                  activeCard.isDataSufficient
                    ? "bg-u-ok-soft text-u-ok"
                    : "bg-u-warn-soft text-u-warn"
                }`}
              >
                {activeCard.isDataSufficient ? "Sufficient Data" : "Low Coverage (<60%)"}
              </span>
            </div>
          </div>
        </div>

        {/* 6.2 Configurable Weighting Banner & Rules */}
        <div className="pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-u-ink2">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-u-accent shrink-0" />
            <span>
              Configured Weights: Maintenance (<strong>{weights.maintenance}%</strong>), Condition (<strong>{weights.condition}%</strong>), Retention (<strong>{weights.retention}%</strong>), Efficiency (<strong>{weights.efficiency}%</strong>), Lifecycle (<strong>{weights.lifecycle}%</strong>).
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsConfigModalOpen(true)}
              className="px-2.5 py-1 rounded-lg border border-u-line bg-u-card hover:bg-u-s2 font-medium text-u-ink2 transition"
            >
              Adjust Model Weights
            </button>
            <button
              onClick={() => setAuditScorecard(activeCard)}
              className="px-2.5 py-1 rounded-lg bg-u-accent-soft hover:bg-u-accent-soft font-medium text-u-accent transition"
            >
              View Calculation Details
            </button>
          </div>
        </div>
      </div>

      {/* 6.4 Scorecard Detail Table */}
      <div className="p-6 rounded-2xl bg-u-card border border-u-line shadow-xs">
        <div className="flex items-center justify-between pb-4 border-b border-u-line">
          <div>
            <h3 className="text-base font-bold text-u-ink">Performance Category Detail</h3>
            <p className="text-xs text-u-muted mt-0.5">
              Breakdown of operational categories, weights, current scores, and supporting metric indicators
            </p>
          </div>
        </div>

        <div className="overflow-x-auto mt-4">
          <table className="min-w-full text-xs divide-y divide-u-line">
            <thead className="bg-u-s2 text-u-ink2 font-semibold">
              <tr>
                <th className="px-4 py-3 text-left">Category</th>
                <th className="px-3 py-3 text-center">Weight</th>
                <th className="px-3 py-3 text-center">Score</th>
                <th className="px-3 py-3 text-center">Previous</th>
                <th className="px-3 py-3 text-center">Change</th>
                <th className="px-3 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-left">Supporting Metrics</th>
                <th className="px-3 py-3 text-right">Drill-Down</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-u-line bg-u-card">
              {activeCard.categories.map((cat) => (
                <tr key={cat.categoryKey} className="hover:bg-u-s2/70 transition">
                  {/* Category Name & Explanation */}
                  <td className="px-4 py-3.5 max-w-xs">
                    <div className="font-bold text-u-ink text-sm">{cat.name}</div>
                    <div className="text-[11px] text-u-muted mt-0.5 leading-relaxed">
                      {cat.explanation}
                    </div>
                    <div className="text-[10px] text-u-muted mt-1">
                      Coverage: {cat.dataCoverage}% • {cat.recordsUsedCount} records used
                    </div>
                  </td>

                  {/* Weight */}
                  <td className="px-3 py-3.5 text-center font-bold text-u-ink2">
                    {cat.weight}%
                  </td>

                  {/* Score */}
                  <td className="px-3 py-3.5 text-center">
                    <span className="text-base font-extrabold text-u-ink">
                      {cat.score !== null ? cat.score.toFixed(1) : "N/A"}
                    </span>
                  </td>

                  {/* Previous */}
                  <td className="px-3 py-3.5 text-center font-medium text-u-muted">
                    {cat.previousScore !== null ? cat.previousScore.toFixed(1) : "--"}
                  </td>

                  {/* Change */}
                  <td className="px-3 py-3.5 text-center font-semibold">
                    {cat.change !== null ? (
                      <span className={cat.change >= 0 ? "text-u-ok" : "text-u-danger"}>
                        {cat.change >= 0 ? `+${cat.change}` : cat.change}
                      </span>
                    ) : (
                      <span className="text-u-muted">--</span>
                    )}
                  </td>

                  {/* Status Badge */}
                  <td className="px-3 py-3.5 text-center">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${
                        cat.status === "Excellent"
                          ? "bg-u-ok-soft text-u-ok"
                          : cat.status === "Good"
                          ? "bg-u-accent-soft text-u-accent"
                          : cat.status === "Needs Improvement"
                          ? "bg-u-warn-soft text-u-warn"
                          : cat.status === "Insufficient Data"
                          ? "bg-u-line text-u-ink"
                          : "bg-u-danger-soft text-u-danger"
                      }`}
                    >
                      {cat.status}
                    </span>
                  </td>

                  {/* Supporting Metrics Chips */}
                  <td className="px-4 py-3.5">
                    <div className="flex flex-wrap gap-1.5">
                      {cat.supportingMetrics.map((m, idx) => (
                        <span
                          key={idx}
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium border ${
                            m.isFavorable === false
                              ? "bg-u-danger-soft border-u-danger/30 text-u-danger"
                              : "bg-u-s2 border-u-line text-u-ink2"
                          }`}
                        >
                          <span className="text-u-muted">{m.label}:</span>
                          <strong className="text-u-ink">{m.value}</strong>
                        </span>
                      ))}
                    </div>
                  </td>

                  {/* View Details */}
                  <td className="px-3 py-3.5 text-right">
                    <button
                      onClick={() => navigateToCategoryReport(cat.categoryKey)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-u-accent hover:text-u-accent hover:bg-u-accent-soft rounded-lg transition"
                    >
                      <span>View</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
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
