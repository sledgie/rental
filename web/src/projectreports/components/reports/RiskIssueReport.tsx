import React, { useState } from "react";
import {
  AlertTriangle,
  ShieldAlert,
  Flame,
  CheckCircle2,
  Clock,
  Filter,
  Search,
  ChevronDown,
} from "lucide-react";
import { useProjectReports } from "../../context/ProjectReportsContext";
import { formatCurrency, formatDate } from "../../lib/calculations";

export function RiskIssueReport() {
  const { risks, issues, projects, drillDownProject } = useProjectReports();
  const [activeTab, setActiveTab] = useState<"risks" | "issues">("risks");
  const [riskSeverityFilter, setRiskSeverityFilter] = useState("ALL");
  const [issueSeverityFilter, setIssueSeverityFilter] = useState("ALL");
  const [selectedCell, setSelectedCell] = useState<{ prob: number; imp: number } | null>(null);

  const filteredRisks = risks.filter((r) => {
    if (riskSeverityFilter !== "ALL" && r.currentRating !== riskSeverityFilter) return false;
    if (selectedCell && (r.probability !== selectedCell.prob || r.impact !== selectedCell.imp)) return false;
    return true;
  });

  const filteredIssues = issues.filter((i) => {
    if (issueSeverityFilter !== "ALL" && i.severity !== issueSeverityFilter) return false;
    return true;
  });

  const criticalIssuesCount = issues.filter((i) => i.severity === "Critical" && i.status !== "Resolved").length;
  const overdueIssuesCount = issues.filter((i) => i.isOverdue).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-base font-bold text-u-ink">Project Risk & Issue Management</h2>
        <p className="text-xs text-u-muted">
          Consolidated registry of project risks, blockers, probability-impact ratings, and remediation plans
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-u-line bg-u-card p-4 shadow-2xs">
          <span className="text-[10px] font-bold uppercase text-u-muted">Total Active Risks</span>
          <p className="text-2xl font-bold text-u-ink mt-1">{risks.length}</p>
          <span className="text-[11px] text-u-muted">Across active project portfolio</span>
        </div>

        <div className="rounded-xl border border-u-danger/30 bg-u-danger-soft/40 p-4 shadow-2xs">
          <span className="text-[10px] font-bold uppercase text-u-danger">Critical Open Issues</span>
          <p className="text-2xl font-bold text-u-danger mt-1">{criticalIssuesCount}</p>
          <span className="text-[11px] text-u-danger font-medium">Require immediate PM escalation</span>
        </div>

        <div className="rounded-xl border border-u-warn/30 bg-u-warn-soft/40 p-4 shadow-2xs">
          <span className="text-[10px] font-bold uppercase text-u-warn">Overdue Blockers</span>
          <p className="text-2xl font-bold text-u-warn mt-1">{overdueIssuesCount}</p>
          <span className="text-[11px] text-u-warn font-medium">Past targeted resolution date</span>
        </div>

        <div className="rounded-xl border border-u-line bg-u-card p-4 shadow-2xs">
          <span className="text-[10px] font-bold uppercase text-u-muted">Resolved Issues</span>
          <p className="text-2xl font-bold text-u-ok mt-1">
            {issues.filter((i) => i.status === "Resolved").length}
          </p>
          <span className="text-[11px] text-u-muted">Documented fixes deployed</span>
        </div>
      </div>

      {/* 10.3 RISK MATRIX 5X5 HEATMAP */}
      <div className="rounded-2xl border border-u-line bg-u-card p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-u-line">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-u-ink">
              5×5 Probability vs Impact Risk Heatmap
            </h3>
            <p className="text-[11px] text-u-muted">
              ISO 31000 risk scoring (Score = Probability × Impact, 1 to 25). Click any cell to filter risks.
            </p>
          </div>
          {selectedCell && (
            <button
              onClick={() => setSelectedCell(null)}
              className="text-xs font-semibold text-u-accent hover:text-u-accent bg-u-accent-soft px-2 py-0.5 rounded"
            >
              Clear Matrix Filter (P:{selectedCell.prob}, I:{selectedCell.imp})
            </button>
          )}
        </div>

        <div className="mt-6 flex flex-col md:flex-row items-center gap-6">
          {/* Matrix Grid */}
          <div className="flex flex-col items-center">
            <span className="text-[10px] font-bold text-u-muted uppercase tracking-widest mb-1">
              &uarr; Probability (1 - 5)
            </span>
            <div className="grid grid-cols-5 gap-1.5 p-2 rounded-xl bg-u-s2 border border-u-line">
              {[5, 4, 3, 2, 1].map((prob) =>
                [1, 2, 3, 4, 5].map((imp) => {
                  const score = prob * imp;
                  const matchingRisks = risks.filter((r) => r.probability === prob && r.impact === imp);
                  const isSelected = selectedCell?.prob === prob && selectedCell?.imp === imp;

                  let cellColor = "bg-u-ok-soft text-u-ok";
                  if (score >= 15) cellColor = "bg-u-danger text-u-onaccent";
                  else if (score >= 8) cellColor = "bg-u-warn text-u-ink";
                  else if (score >= 4) cellColor = "bg-u-warn-soft text-u-warn";

                  return (
                    <button
                      key={`${prob}-${imp}`}
                      onClick={() => setSelectedCell(isSelected ? null : { prob, imp })}
                      className={`h-11 w-11 rounded-lg flex flex-col items-center justify-center text-xs font-bold transition-all relative ${cellColor} ${
                        isSelected ? "ring-3 ring-u-accent/60 scale-105 z-10" : "hover:opacity-90"
                      }`}
                    >
                      <span>{score}</span>
                      {matchingRisks.length > 0 && (
                        <span className="text-[9px] bg-black/30 text-u-onaccent rounded-full px-1 leading-tight mt-0.5">
                          {matchingRisks.length}
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
            <span className="text-[10px] font-bold text-u-muted uppercase tracking-widest mt-2">
              Impact (1 - 5) &rarr;
            </span>
          </div>

          {/* Legend and explanation */}
          <div className="flex-1 space-y-3 text-xs text-u-ink2">
            <div className="rounded-xl border border-u-line bg-u-s2 p-4">
              <h4 className="font-bold text-u-ink text-xs mb-2">Enterprise Risk Scoring Thresholds:</h4>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded bg-u-danger" />
                  <span>Critical Risk (Score 15 - 25)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded bg-u-warn" />
                  <span>High Risk (Score 8 - 14)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded bg-u-warn-soft border border-u-warn/30" />
                  <span>Medium Risk (Score 4 - 7)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded bg-u-ok-soft border border-u-ok/30" />
                  <span>Low Risk (Score 1 - 3)</span>
                </div>
              </div>
            </div>
            <p className="text-[11px] text-u-muted">
              Inherent risk represents raw unmitigated exposure; current rating accounts for active engineering controls and contractor warranties.
            </p>
          </div>
        </div>
      </div>

      {/* REGISTERS TAB SWITCHER */}
      <div className="flex items-center gap-2 border-b border-u-line pb-2">
        <button
          onClick={() => setActiveTab("risks")}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-colors ${
            activeTab === "risks"
              ? "bg-u-accent text-u-onaccent shadow-xs"
              : "bg-u-s3 text-u-ink2 hover:bg-u-line"
          }`}
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          <span>Risk Register ({filteredRisks.length})</span>
        </button>
        <button
          onClick={() => setActiveTab("issues")}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-colors ${
            activeTab === "issues"
              ? "bg-u-accent text-u-onaccent shadow-xs"
              : "bg-u-s3 text-u-ink2 hover:bg-u-line"
          }`}
        >
          <Flame className="h-3.5 w-3.5" />
          <span>Active Issues & Blockers ({filteredIssues.length})</span>
        </button>
      </div>

      {/* 10.1 RISK REGISTER TABLE */}
      {activeTab === "risks" && (
        <div className="rounded-2xl border border-u-line bg-u-card p-5 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-u-line">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-u-ink">
                Consolidated Risk Register
              </h3>
              <p className="text-[11px] text-u-muted">Documented risks, ratings, and mitigation actions</p>
            </div>
            <select
              value={riskSeverityFilter}
              onChange={(e) => setRiskSeverityFilter(e.target.value)}
              className="rounded-lg border border-u-line py-1 px-2.5 text-xs text-u-ink"
            >
              <option value="ALL">All Risk Ratings</option>
              <option value="Critical">Critical</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-u-s2 text-[10px] font-bold text-u-muted uppercase border-b border-u-line">
                <tr>
                  <th className="py-2.5 px-3">Risk Code</th>
                  <th className="py-2.5 px-3">Project</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3">Description</th>
                  <th className="py-2.5 px-3">P × I (Score)</th>
                  <th className="py-2.5 px-3">Rating</th>
                  <th className="py-2.5 px-3">Owner</th>
                  <th className="py-2.5 px-3">Mitigation Strategy</th>
                  <th className="py-2.5 px-3">Target Date</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-u-line">
                {filteredRisks.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => drillDownProject(r.projectId)}
                    className="hover:bg-u-accent-soft/40 cursor-pointer transition-colors"
                  >
                    <td className="py-2.5 px-3 font-mono font-bold text-u-muted">{r.riskCode}</td>
                    <td className="py-2.5 px-3 font-semibold text-u-ink max-w-[160px] truncate">{r.projectName}</td>
                    <td className="py-2.5 px-3 text-u-ink2">{r.category}</td>
                    <td className="py-2.5 px-3 text-u-ink2 max-w-[240px] truncate">{r.description}</td>
                    <td className="py-2.5 px-3 font-bold text-u-ink">
                      {r.probability} × {r.impact} = {r.riskScore}
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          r.currentRating === "Critical"
                            ? "bg-u-danger-soft text-u-danger"
                            : r.currentRating === "High"
                            ? "bg-u-warn-soft text-u-warn"
                            : "bg-u-accent-soft text-u-accent"
                        }`}
                      >
                        {r.currentRating}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-u-ink2">{r.riskOwner}</td>
                    <td className="py-2.5 px-3 text-u-ink2 max-w-[200px] truncate">{r.mitigationStrategy}</td>
                    <td className="py-2.5 px-3 text-u-ink2">{formatDate(r.targetResolutionDate)}</td>
                    <td className="py-2.5 px-3">
                      <span className="text-[10px] font-semibold text-u-ink2 bg-u-s3 px-1.5 py-0.5 rounded">
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 10.2 ISSUE REGISTER TABLE */}
      {activeTab === "issues" && (
        <div className="rounded-2xl border border-u-line bg-u-card p-5 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-u-line">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-u-ink">
                Active Issues & Blocker Register
              </h3>
              <p className="text-[11px] text-u-muted">Schedule delays, cost escalations, and resolution targets</p>
            </div>
            <select
              value={issueSeverityFilter}
              onChange={(e) => setIssueSeverityFilter(e.target.value)}
              className="rounded-lg border border-u-line py-1 px-2.5 text-xs text-u-ink"
            >
              <option value="ALL">All Severities</option>
              <option value="Critical">Critical</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-u-s2 text-[10px] font-bold text-u-muted uppercase border-b border-u-line">
                <tr>
                  <th className="py-2.5 px-3">Issue Code</th>
                  <th className="py-2.5 px-3">Project</th>
                  <th className="py-2.5 px-3">Description</th>
                  <th className="py-2.5 px-3">Severity</th>
                  <th className="py-2.5 px-3">Responsible</th>
                  <th className="py-2.5 px-3">Schedule Impact</th>
                  <th className="py-2.5 px-3">Cost Impact</th>
                  <th className="py-2.5 px-3">Target Date</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Resolution Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-u-line">
                {filteredIssues.map((iss) => (
                  <tr
                    key={iss.id}
                    onClick={() => drillDownProject(iss.projectId)}
                    className="hover:bg-u-accent-soft/40 cursor-pointer transition-colors"
                  >
                    <td className="py-2.5 px-3 font-mono font-bold text-u-muted">{iss.issueCode}</td>
                    <td className="py-2.5 px-3 font-semibold text-u-ink max-w-[160px] truncate">{iss.projectName}</td>
                    <td className="py-2.5 px-3 text-u-ink2 max-w-[240px] truncate">{iss.description}</td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          iss.severity === "Critical"
                            ? "bg-u-danger-soft text-u-danger"
                            : iss.severity === "High"
                            ? "bg-u-warn-soft text-u-warn"
                            : "bg-u-s3 text-u-ink2"
                        }`}
                      >
                        {iss.severity}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-u-ink2">{iss.responsiblePerson}</td>
                    <td className="py-2.5 px-3 font-medium text-u-ink">
                      {iss.scheduleImpactDays > 0 ? `+${iss.scheduleImpactDays}d` : "0d"}
                    </td>
                    <td className="py-2.5 px-3 font-medium text-u-ink">{formatCurrency(iss.costImpact)}</td>
                    <td className="py-2.5 px-3 text-u-ink2">{formatDate(iss.resolutionTarget)}</td>
                    <td className="py-2.5 px-3">
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                        iss.status === "Resolved" ? "bg-u-ok-soft text-u-ok" : "bg-u-warn-soft text-u-warn"
                      }`}>
                        {iss.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-[11px] text-u-muted max-w-[200px] truncate">
                      {iss.resolutionNotes || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
