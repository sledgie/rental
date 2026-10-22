import React, { useState, useMemo } from "react";
import { useReportContext } from "../../context/ReportContext";
import {
  Trophy,
  TrendingUp,
  TrendingDown,
  Building2,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Download,
  Info,
  ChevronRight,
  Filter,
} from "lucide-react";
import { HorizontalBarRankingChart } from "../charts/ChartComponents";

export function BenchmarkingPage() {
  const {
    filteredScorecards,
    setDrilldownPropertyId,
    setAuditScorecard,
    exportCurrentViewCsv,
    periodDisplayLabel,
  } = useReportContext();

  const [dimension, setDimension] = useState<
    "overall" | "maintenance" | "condition" | "retention" | "efficiency" | "lifecycle"
  >("overall");

  // Sorted list based on chosen dimension
  const rankedScorecards = useMemo(() => {
    return [...filteredScorecards].sort((a, b) => {
      if (dimension === "overall") {
        return (b.overallScore ?? -1) - (a.overallScore ?? -1);
      }
      const scoreA = a.categories.find((c) => c.categoryKey === dimension)?.score ?? -1;
      const scoreB = b.categories.find((c) => c.categoryKey === dimension)?.score ?? -1;
      return scoreB - scoreA;
    });
  }, [filteredScorecards, dimension]);

  const rankingChartItems = useMemo(() => {
    return rankedScorecards.map((s) => {
      let val: number | null = s.overallScore;
      if (dimension !== "overall") {
        val = s.categories.find((c) => c.categoryKey === dimension)?.score ?? null;
      }
      return {
        id: s.propertyId,
        label: s.propertyName,
        subLabel: `${s.propertyType} • ${s.totalUnits} Units`,
        value: val,
        change: s.scoreChange,
        classification: s.classification,
        target: s.targetScore,
      };
    });
  }, [rankedScorecards, dimension]);

  const topPerformer = rankedScorecards[0];
  const needsAttention = rankedScorecards.find(
    (s) => s.classification === "Needs Improvement" || s.classification === "Poor"
  );

  const handleExportCsv = () => {
    const headers = [
      "Rank",
      "Property",
      "Type",
      "Units",
      "Overall Score",
      "Classification",
      "Coverage %",
      "Maintenance Score",
      "Condition Score",
      "Retention Score",
      "Efficiency Score",
      "Lifecycle Score",
    ];
    const rows = rankedScorecards.map((s, idx) => {
      const getCat = (k: string) => {
        const cat = s.categories.find((c) => c.categoryKey === k);
        return cat?.score !== null && cat?.score !== undefined ? cat.score.toFixed(1) : "N/A";
      };
      return [
        idx + 1,
        s.propertyName,
        s.propertyType,
        s.totalUnits,
        s.overallScore !== null ? s.overallScore.toFixed(1) : "Insufficient Data",
        s.classification,
        `${s.dataCoveragePercent}%`,
        getCat("maintenance"),
        getCat("condition"),
        getCat("retention"),
        getCat("efficiency"),
        getCat("lifecycle"),
      ];
    });
    exportCurrentViewCsv("Property Benchmarking & Ranking Report", headers, rows);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-u-ink tracking-tight">
            Property Benchmarking & Ranking Report
          </h1>
          <p className="text-xs sm:text-sm text-u-muted mt-1">
            Comparative performance ranking across operational dimensions, portfolio targets, and peer groups.
          </p>
        </div>

        <button
          onClick={handleExportCsv}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-u-ink2 bg-u-card border border-u-line rounded-lg shadow-2xs hover:bg-u-s2 self-start sm:self-auto"
        >
          <Download className="w-3.5 h-3.5 text-u-ok" />
          <span>Export Benchmarks CSV</span>
        </button>
      </div>

      {/* Dimension Switcher Tabs */}
      <div className="p-2 bg-u-card rounded-xl border border-u-line shadow-2xs flex flex-wrap items-center gap-1.5 text-xs font-medium">
        <span className="text-u-muted px-2 font-semibold uppercase text-[10px]">Rank By:</span>
        {(
          [
            { id: "overall", label: "Overall Score" },
            { id: "maintenance", label: "Maintenance Performance" },
            { id: "condition", label: "Condition & Safety" },
            { id: "retention", label: "Tenant Retention" },
            { id: "efficiency", label: "Operating Efficiency" },
            { id: "lifecycle", label: "Asset Lifecycle" },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setDimension(tab.id)}
            className={`px-3 py-1.5 rounded-lg transition ${
              dimension === tab.id
                ? "bg-u-accent text-u-onaccent font-semibold shadow-xs"
                : "text-u-ink2 hover:bg-u-s3"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Highlights & Fair Comparison Rules */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Top Performer Card */}
        {topPerformer && (
          <div
            onClick={() => setDrilldownPropertyId(topPerformer.propertyId)}
            className="p-4 rounded-xl bg-u-ok-soft/70 border border-u-ok/30 shadow-xs cursor-pointer hover:bg-u-ok-soft transition"
          >
            <div className="flex items-center justify-between text-xs font-semibold text-u-ok">
              <span className="flex items-center gap-1.5">
                <Trophy className="w-4 h-4 text-u-ok" />
                Portfolio Leader
              </span>
              <span className="px-2 py-0.5 rounded bg-u-ok-soft text-u-ok text-[10px] font-bold">
                RANK #1
              </span>
            </div>
            <div className="mt-2">
              <h4 className="text-base font-bold text-u-ink">{topPerformer.propertyName}</h4>
              <p className="text-xs text-u-ink2">
                Score: <strong className="text-u-ok">{topPerformer.overallScore?.toFixed(1) ?? "N/A"}</strong> • {topPerformer.classification}
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-u-ok/30 text-[11px] text-u-ok flex items-center justify-between">
              <span>Coverage: {topPerformer.dataCoveragePercent}%</span>
              <span>Open Profile &rarr;</span>
            </div>
          </div>
        )}

        {/* Priority Intervention Card */}
        {needsAttention ? (
          <div
            onClick={() => setDrilldownPropertyId(needsAttention.propertyId)}
            className="p-4 rounded-xl bg-u-warn-soft/70 border border-u-warn/30 shadow-xs cursor-pointer hover:bg-u-warn-soft transition"
          >
            <div className="flex items-center justify-between text-xs font-semibold text-u-warn">
              <span className="flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-u-warn" />
                Intervention Target
              </span>
              <span className="px-2 py-0.5 rounded bg-u-warn-soft text-u-warn text-[10px] font-bold">
                NEEDS ATTENTION
              </span>
            </div>
            <div className="mt-2">
              <h4 className="text-base font-bold text-u-ink">{needsAttention.propertyName}</h4>
              <p className="text-xs text-u-ink2">
                Score: <strong className="text-u-warn">{needsAttention.overallScore?.toFixed(1) ?? "N/A"}</strong> • {needsAttention.classification}
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-u-warn/30 text-[11px] text-u-warn flex items-center justify-between">
              <span>Requires action plan</span>
              <span>Open Profile &rarr;</span>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-u-s2 border border-u-line shadow-xs flex items-center justify-center text-xs text-u-muted">
            No properties requiring urgent improvement
          </div>
        )}

        {/* 12.3 Fair Comparison Rules Box */}
        <div className="p-4 rounded-xl bg-u-card border border-u-line shadow-xs space-y-1 text-xs">
          <div className="flex items-center gap-1.5 font-bold text-u-ink">
            <Info className="w-4 h-4 text-u-accent" />
            <span>Fair Comparison Governance Rules</span>
          </div>
          <p className="text-u-ink2 text-[11px] leading-relaxed">
            Properties are ranked against consistent formulas across identical reporting periods. Newly acquired properties with low coverage (&lt;60%) are classified as <em>Insufficient Data</em> rather than awarded zero or artificial ratings.
          </p>
        </div>
      </div>

      {/* Horizontal Ranking Chart */}
      <div className="p-6 rounded-2xl bg-u-card border border-u-line shadow-xs">
        <div className="flex items-center justify-between pb-4 border-b border-u-line">
          <div>
            <h3 className="text-base font-bold text-u-ink">
              {dimension === "overall" ? "Overall Operational Score Ranking" : `Ranked by ${dimension.toUpperCase()} Performance`}
            </h3>
            <p className="text-xs text-u-muted mt-0.5">Target Portfolio Benchmark: 80.0 / 100</p>
          </div>
          <span className="text-xs text-u-muted">Click property bar to open full profile</span>
        </div>

        <div className="pt-4">
          <HorizontalBarRankingChart
            items={rankingChartItems}
            targetValue={80}
            onItemClick={(id) => setDrilldownPropertyId(id)}
          />
        </div>
      </div>

      {/* Comprehensive Benchmarking Table */}
      <div className="p-6 rounded-2xl bg-u-card border border-u-line shadow-xs">
        <div className="flex items-center justify-between pb-4 border-b border-u-line">
          <div>
            <h3 className="text-base font-bold text-u-ink">Multi-Category Benchmarking Matrix</h3>
            <p className="text-xs text-u-muted mt-0.5">
              Side-by-side operational comparison across all 5 scoring pillars
            </p>
          </div>
        </div>

        <div className="overflow-x-auto mt-4">
          <table className="min-w-full text-xs divide-y divide-u-line">
            <thead className="bg-u-s2 text-u-ink2 font-semibold">
              <tr>
                <th className="px-3 py-2.5 text-center">Rank</th>
                <th className="px-3 py-2.5 text-left">Property</th>
                <th className="px-3 py-2.5 text-left">Type</th>
                <th className="px-3 py-2.5 text-center">Units</th>
                <th className="px-3 py-2.5 text-center font-bold text-u-ink">Overall</th>
                <th className="px-3 py-2.5 text-center">Coverage</th>
                <th className="px-3 py-2.5 text-center">Maintenance (25%)</th>
                <th className="px-3 py-2.5 text-center">Condition (25%)</th>
                <th className="px-3 py-2.5 text-center">Retention (20%)</th>
                <th className="px-3 py-2.5 text-center">Efficiency (15%)</th>
                <th className="px-3 py-2.5 text-center">Lifecycle (15%)</th>
                <th className="px-3 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-u-line bg-u-card">
              {rankedScorecards.map((s, idx) => {
                const getScore = (key: string) => {
                  const cat = s.categories.find((c) => c.categoryKey === key);
                  return cat?.score !== null && cat?.score !== undefined ? (
                    <span
                      className={`font-semibold ${
                        cat.score >= 80 ? "text-u-ok" : cat.score >= 65 ? "text-u-ink" : "text-u-danger"
                      }`}
                    >
                      {cat.score.toFixed(1)}
                    </span>
                  ) : (
                    <span className="text-u-muted italic">N/A</span>
                  );
                };

                return (
                  <tr key={s.propertyId} className="hover:bg-u-s2/70 transition">
                    <td className="px-3 py-3 text-center font-bold text-u-muted">
                      #{idx + 1}
                    </td>
                    <td className="px-3 py-3">
                      <button
                        onClick={() => setDrilldownPropertyId(s.propertyId)}
                        className="font-bold text-u-ink hover:text-u-accent text-left transition"
                      >
                        {s.propertyName}
                      </button>
                      <div className="text-[10px] text-u-muted">{s.managerName}</div>
                    </td>
                    <td className="px-3 py-3 text-u-ink2">{s.propertyType}</td>
                    <td className="px-3 py-3 text-center text-u-ink2 font-medium">{s.totalUnits}</td>
                    <td className="px-3 py-3 text-center">
                      <span className="text-sm font-extrabold text-u-ink">
                        {s.overallScore !== null ? s.overallScore.toFixed(1) : "N/A"}
                      </span>
                      <div className="text-[10px] text-u-muted font-semibold">{s.classification}</div>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                          s.dataCoveragePercent >= 60 ? "bg-u-ok-soft text-u-ok" : "bg-u-warn-soft text-u-warn"
                        }`}
                      >
                        {s.dataCoveragePercent}%
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center font-mono">{getScore("maintenance")}</td>
                    <td className="px-3 py-3 text-center font-mono">{getScore("condition")}</td>
                    <td className="px-3 py-3 text-center font-mono">{getScore("retention")}</td>
                    <td className="px-3 py-3 text-center font-mono">{getScore("efficiency")}</td>
                    <td className="px-3 py-3 text-center font-mono">{getScore("lifecycle")}</td>
                    <td className="px-3 py-3 text-right">
                      <button
                        onClick={() => setDrilldownPropertyId(s.propertyId)}
                        className="px-2.5 py-1 text-xs font-semibold text-u-accent hover:text-u-accent hover:bg-u-accent-soft rounded-lg transition"
                      >
                        Profile
                      </button>
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
