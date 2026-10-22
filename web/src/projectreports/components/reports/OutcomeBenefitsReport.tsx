import React, { useState } from "react";
import {
  Award,
  Sparkles,
  TrendingUp,
  CheckCircle2,
  Calendar,
  DollarSign,
  FileText,
  Search,
  ExternalLink,
} from "lucide-react";
import { useProjectReports } from "../../context/ProjectReportsContext";
import { formatCurrency, formatPct, formatDate } from "../../lib/calculations";

export function OutcomeBenefitsReport() {
  const { outcomeReviews, projects, drillDownProject } = useProjectReports();
  const [selectedReviewId, setSelectedReviewId] = useState<string | null>(null);

  const activeReview = selectedReviewId
    ? outcomeReviews.find((r) => r.id === selectedReviewId)
    : outcomeReviews[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-base font-bold text-u-ink">Post-Completion Outcome & Value Realization</h2>
        <p className="text-xs text-u-muted">
          Quantifying actual operational benefits, utility reductions, and quality outcomes against original capital underwriting
        </p>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-u-line bg-u-card p-4 shadow-2xs">
          <span className="text-[10px] font-bold uppercase text-u-muted">Formal Post-Handover Reviews</span>
          <p className="text-2xl font-bold text-u-ink mt-1">{outcomeReviews.length}</p>
          <span className="text-[11px] text-u-muted">Conducted at 90-day & 180-day milestones</span>
        </div>

        <div className="rounded-xl border border-u-ok/30 bg-u-ok-soft/40 p-4 shadow-2xs">
          <span className="text-[10px] font-bold uppercase text-u-ok">Average Benefit Realization</span>
          <p className="text-2xl font-bold text-u-ok mt-1">113.0%</p>
          <span className="text-[11px] text-u-ok font-medium">Exceeding underwriting baseline targets</span>
        </div>

        <div className="rounded-xl border border-u-line bg-u-card p-4 shadow-2xs">
          <span className="text-[10px] font-bold uppercase text-u-muted">Post-Closure Defects</span>
          <p className="text-2xl font-bold text-u-ink mt-1">0</p>
          <span className="text-[11px] text-u-muted">Zero outstanding warranty claims</span>
        </div>
      </div>

      {/* 13.1 & 13.2 OUTCOME REGISTER TABLE */}
      <div className="rounded-2xl border border-u-line bg-u-card p-5 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-u-line">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-u-ink">
              Post-Completion Measured Outcomes Register
            </h3>
            <p className="text-[11px] text-u-muted">Objective evidence-backed evaluations</p>
          </div>
          <span className="text-xs text-u-muted font-medium">{outcomeReviews.length} Verified Reviews</span>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-u-s2 text-[10px] font-bold text-u-muted uppercase border-b border-u-line">
              <tr>
                <th className="py-2.5 px-3">Project</th>
                <th className="py-2.5 px-3">Review Milestone</th>
                <th className="py-2.5 px-3">Lead Evaluator</th>
                <th className="py-2.5 px-3">Baseline</th>
                <th className="py-2.5 px-3">Underwritten Target</th>
                <th className="py-2.5 px-3">Actual Measured</th>
                <th className="py-2.5 px-3">Realization Rate</th>
                <th className="py-2.5 px-3">Quality Acceptance</th>
                <th className="py-2.5 px-3">Evidence Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-u-line">
              {outcomeReviews.map((rev) => {
                const isSelected = activeReview?.id === rev.id;
                return (
                  <tr
                    key={rev.id}
                    onClick={() => setSelectedReviewId(rev.id)}
                    className={`cursor-pointer transition-colors ${
                      isSelected ? "bg-u-accent-soft/70 font-medium" : "hover:bg-u-s2"
                    }`}
                  >
                    <td className="py-2.5 px-3 font-semibold text-u-ink">{rev.projectName}</td>
                    <td className="py-2.5 px-3 text-u-ink2">
                      <span className="bg-u-s3 px-2 py-0.5 rounded text-[10px] font-bold">
                        {rev.reviewMilestone}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-u-ink2">{rev.reviewer}</td>
                    <td className="py-2.5 px-3 text-u-ink2 font-mono">
                      {rev.baselineValue} {rev.unit}
                    </td>
                    <td className="py-2.5 px-3 text-u-ink font-mono">
                      {rev.targetValue} {rev.unit}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-u-ok font-mono">
                      {rev.actualValue} {rev.unit}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="font-bold text-u-ok">
                        {rev.realizationRate !== null && rev.realizationRate !== undefined ? `${rev.realizationRate}%` : "Qualitative"}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold bg-u-ok-soft text-u-ok">
                        {rev.qualityAcceptanceStatus}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-[11px] text-u-muted max-w-[200px] truncate">
                      {rev.evidenceSource}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 13.3 POST-COMPLETION REVIEW DOSSIER */}
      {activeReview && (
        <div className="rounded-2xl border border-u-accent/80 bg-u-card p-5 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-u-line">
            <div>
              <span className="text-xs font-bold text-u-accent bg-u-accent-soft px-2 py-0.5 rounded">
                {activeReview.reviewMilestone} • Completed: {formatDate(activeReview.reviewDate)}
              </span>
              <h3 className="text-base font-bold text-u-ink mt-1">{activeReview.projectName}</h3>
              <p className="text-xs text-u-muted">Evaluated by: {activeReview.reviewer}</p>
            </div>

            <button
              onClick={() => drillDownProject(activeReview.projectId)}
              className="text-xs font-semibold text-u-accent hover:text-u-accent flex items-center gap-1"
            >
              View Full Project Dossier &rarr;
            </button>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl bg-u-s2 p-4 border border-u-line space-y-2 text-xs">
              <span className="font-bold uppercase tracking-wider text-u-muted text-[10px]">Strategic Intent</span>
              <p><strong>Original Objective:</strong> {activeReview.originalObjective}</p>
              <p><strong>Underwritten Expected Benefit:</strong> {activeReview.expectedBenefit}</p>
              <p><strong>Verified Evidence Source:</strong> {activeReview.evidenceSource}</p>
            </div>

            <div className="rounded-xl bg-u-accent-soft/60 p-4 border border-u-accent/30 space-y-2 text-xs text-u-ink2">
              <span className="font-bold uppercase tracking-wider text-u-accent text-[10px]">
                Quantitative Outcome
              </span>
              <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                <div className="rounded-lg bg-u-card p-2 border border-u-accent/30">
                  <span className="text-[10px] text-u-muted">Baseline</span>
                  <p className="font-bold text-u-ink mt-0.5">{activeReview.baselineValue} {activeReview.unit}</p>
                </div>
                <div className="rounded-lg bg-u-card p-2 border border-u-accent/30">
                  <span className="text-[10px] text-u-muted">Target</span>
                  <p className="font-bold text-u-ink mt-0.5">{activeReview.targetValue} {activeReview.unit}</p>
                </div>
                <div className="rounded-lg bg-u-card p-2 border border-u-accent/30">
                  <span className="text-[10px] text-u-muted">Measured</span>
                  <p className="font-bold text-u-ok mt-0.5">{activeReview.actualValue} {activeReview.unit}</p>
                </div>
              </div>
              <p className="text-center font-bold text-u-ok pt-1">
                Value Realization Rate: {activeReview.realizationRate}%
              </p>
            </div>
          </div>

          {/* Lessons Learned and Follow-Up */}
          <div className="mt-4 space-y-3 text-xs">
            <div className="rounded-xl border border-u-line bg-u-card p-4">
              <h4 className="font-bold text-u-ink mb-1">Institutional Lessons Learned:</h4>
              <p className="text-u-ink2 leading-relaxed">{activeReview.lessonsLearned}</p>
            </div>
            {activeReview.followUpActions && (
              <div className="rounded-xl border border-u-line bg-u-card p-4">
                <h4 className="font-bold text-u-ink mb-1">Follow-Up & Replication Plan:</h4>
                <p className="text-u-ink2 leading-relaxed">{activeReview.followUpActions}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
