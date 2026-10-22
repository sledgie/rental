import React from "react";
import { useReportContext } from "../../context/ReportContext";
import { X, Calculator, ShieldCheck, AlertCircle, Info, Database } from "lucide-react";

export function ScoreAuditModal() {
  const { auditScorecard, setAuditScorecard } = useReportContext();

  if (!auditScorecard) return null;

  const card = auditScorecard;
  const eligibleCategories = card.categories.filter((c) => c.isEligible && c.score !== null);
  const eligibleWeightsSum = eligibleCategories.reduce((acc, c) => acc + c.weight, 0);

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="bg-u-card rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden border border-u-line flex flex-col animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-u-line flex items-center justify-between bg-u-s2/70">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-u-accent-soft text-u-accent">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-u-ink">
                Score Methodology & Calculation Audit: {card.propertyName}
              </h3>
              <p className="text-xs text-u-muted">
                {card.propertyType} • Code: {card.propertyCode} • Manager: {card.managerName}
              </p>
            </div>
          </div>
          <button
            onClick={() => setAuditScorecard(null)}
            className="p-1 rounded-lg text-u-muted hover:text-u-ink2 hover:bg-u-s3"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Summary Box */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl border border-u-line bg-u-s2/50">
              <span className="text-[11px] font-semibold text-u-muted uppercase tracking-wider">Overall Score</span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-u-ink">
                  {card.overallScore !== null ? card.overallScore.toFixed(1) : "N/A"}
                </span>
                <span className="text-xs text-u-muted">/ 100</span>
              </div>
              <span
                className={`inline-block mt-1 px-2 py-0.5 rounded text-[11px] font-semibold ${
                  card.classification === "Excellent"
                    ? "bg-u-ok-soft text-u-ok"
                    : card.classification === "Good"
                    ? "bg-u-accent-soft text-u-accent"
                    : card.classification === "Needs Improvement"
                    ? "bg-u-warn-soft text-u-warn"
                    : card.classification === "Insufficient Data"
                    ? "bg-u-line text-u-ink"
                    : "bg-u-danger-soft text-u-danger"
                }`}
              >
                {card.classification}
              </span>
            </div>

            <div className="p-3.5 rounded-xl border border-u-line bg-u-s2/50">
              <span className="text-[11px] font-semibold text-u-muted uppercase tracking-wider">Data Coverage</span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-u-accent">{card.dataCoveragePercent}%</span>
                <span className="text-xs text-u-muted">min 60%</span>
              </div>
              <div className="mt-2 w-full bg-u-line rounded-full h-1.5 overflow-hidden">
                <div
                  className={`h-full ${
                    card.dataCoveragePercent >= 60 ? "bg-u-accent" : "bg-u-warn"
                  }`}
                  style={{ width: `${Math.min(100, card.dataCoveragePercent)}%` }}
                />
              </div>
            </div>

            <div className="p-3.5 rounded-xl border border-u-line bg-u-s2/50">
              <span className="text-[11px] font-semibold text-u-muted uppercase tracking-wider">Records Evaluated</span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-u-ink">{card.totalRecordsCount}</span>
                <span className="text-xs text-u-muted">operational logs</span>
              </div>
              <span className="text-[11px] text-u-muted mt-1 block flex items-center gap-1">
                <Database className="w-3 h-3 text-u-muted" />
                Verified DB Records
              </span>
            </div>
          </div>

          {/* Audit Policy Statement */}
          <div className="p-3.5 rounded-xl bg-u-accent-soft/70 border border-u-accent/30 text-xs text-u-accent space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-u-accent">
              <Info className="w-4 h-4 text-u-accent" />
              <span>Scoring Policy & Normalization Rationale</span>
            </div>
            <p className="text-u-accent/90 leading-relaxed">{card.scoringFormulaExplanation}</p>
          </div>

          {/* Category Breakdown Table */}
          <div>
            <h4 className="text-xs font-semibold text-u-ink mb-2 uppercase tracking-wider">
              Category Weights & Normalized Contribution
            </h4>
            <div className="border border-u-line rounded-xl overflow-hidden shadow-2xs">
              <table className="min-w-full text-xs divide-y divide-u-line">
                <thead className="bg-u-s2 text-u-ink2 font-semibold">
                  <tr>
                    <th className="px-3 py-2 text-left">Category</th>
                    <th className="px-3 py-2 text-center">Config Weight</th>
                    <th className="px-3 py-2 text-center">Coverage</th>
                    <th className="px-3 py-2 text-center">Normalized Weight</th>
                    <th className="px-3 py-2 text-center">Score</th>
                    <th className="px-3 py-2 text-right">Contribution</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-u-line bg-u-card">
                  {card.categories.map((cat) => {
                    const normalizedWeight = cat.isEligible && eligibleWeightsSum > 0
                      ? (cat.weight / eligibleWeightsSum) * 100
                      : 0;
                    const contribution = cat.score !== null && cat.isEligible
                      ? (cat.score * (normalizedWeight / 100))
                      : 0;

                    return (
                      <tr key={cat.categoryKey} className="hover:bg-u-s2/50">
                        <td className="px-3 py-2.5">
                          <div className="font-medium text-u-ink">{cat.name}</div>
                          <div className="text-[10px] text-u-muted">{cat.explanation}</div>
                        </td>
                        <td className="px-3 py-2.5 text-center font-medium text-u-ink2">
                          {cat.weight}%
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                              cat.dataCoverage >= 60
                                ? "bg-u-ok-soft text-u-ok border border-u-ok/30"
                                : "bg-u-warn-soft text-u-warn border border-u-warn/30"
                            }`}
                          >
                            {cat.dataCoverage}%
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-center font-medium text-u-ink">
                          {cat.isEligible ? `${Math.round(normalizedWeight)}%` : <span className="text-u-muted italic">Excluded</span>}
                        </td>
                        <td className="px-3 py-2.5 text-center font-bold text-u-ink">
                          {cat.score !== null ? cat.score.toFixed(1) : "N/A"}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono font-semibold text-u-ink">
                          {cat.isEligible ? `+${contribution.toFixed(1)}` : "--"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-u-s2 font-semibold text-u-ink text-xs">
                  <tr>
                    <td className="px-3 py-2">Total Evaluated Score</td>
                    <td className="px-3 py-2 text-center">100%</td>
                    <td className="px-3 py-2 text-center">{card.dataCoveragePercent}%</td>
                    <td className="px-3 py-2 text-center">100%</td>
                    <td className="px-3 py-2 text-center">--</td>
                    <td className="px-3 py-2 text-right font-bold text-u-accent">
                      {card.overallScore !== null ? card.overallScore.toFixed(1) : "Insufficient Data"}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-u-line flex items-center justify-end bg-u-s2/50">
          <button
            onClick={() => setAuditScorecard(null)}
            className="px-4 py-2 text-xs font-medium text-u-onaccent bg-u-ink2 hover:bg-u-ink2 rounded-lg transition"
          >
            Close Audit Breakdown
          </button>
        </div>
      </div>
    </div>
  );
}
