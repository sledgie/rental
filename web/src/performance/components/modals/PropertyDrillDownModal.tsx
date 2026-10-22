import React, { useState } from "react";
import { useReportContext } from "../../context/ReportContext";
import {
  X,
  Building,
  Wrench,
  ClipboardCheck,
  Zap,
  Users,
  ShieldAlert,
  ArrowRight,
  Calendar,
  AlertTriangle,
  Plus,
  ExternalLink,
  ChevronRight,
} from "lucide-react";

export function PropertyDrillDownModal() {
  const {
    drilldownPropertyId,
    setDrilldownPropertyId,
    rawData,
    setAuditScorecard,
    openCreateActionModal,
    setPreviewRecord,
  } = useReportContext();

  const [activeTab, setActiveTab] = useState<"overview" | "workOrders" | "inspections" | "assets" | "leases" | "actions">("overview");

  if (!drilldownPropertyId || !rawData) return null;

  const property = rawData.properties.find((p) => p.id === drilldownPropertyId);
  const scorecard = rawData.scorecards.find((s) => s.propertyId === drilldownPropertyId);
  const manager = rawData.managers.find((m) => m.id === property?.managerId);

  const propWorkOrders = rawData.workOrders.filter((w) => w.propertyId === drilldownPropertyId);
  const propInspections = rawData.inspections.filter((i) => i.propertyId === drilldownPropertyId);
  const propFindings = rawData.findings.filter((f) => f.propertyId === drilldownPropertyId);
  const propAssets = rawData.assets.filter((a) => a.propertyId === drilldownPropertyId);
  const propLeases = rawData.leases.filter((l) => l.propertyId === drilldownPropertyId);
  const propActions = rawData.actions.filter((a) => a.propertyId === drilldownPropertyId);

  if (!property || !scorecard) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto">
      <div className="bg-u-card rounded-2xl shadow-2xl max-w-4xl w-full max-h-[92vh] overflow-hidden border border-u-line flex flex-col animate-in fade-in zoom-in-95 duration-150">
        {/* Top Header */}
        <div className="px-6 py-4 border-b border-u-line flex items-start justify-between bg-u-s2/70">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-u-accent-soft border border-u-accent/30 text-u-accent">
              <Building className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold text-u-ink">{property.name}</h2>
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-u-line text-u-ink2">
                  {property.code}
                </span>
                <span className="text-xs px-2 py-0.5 rounded bg-u-accent-soft text-u-accent font-medium">
                  {property.type}
                </span>
                <span
                  className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${
                    scorecard.classification === "Excellent"
                      ? "bg-u-ok-soft text-u-ok"
                      : scorecard.classification === "Good"
                      ? "bg-u-accent-soft text-u-accent"
                      : scorecard.classification === "Needs Improvement"
                      ? "bg-u-warn-soft text-u-warn"
                      : scorecard.classification === "Insufficient Data"
                      ? "bg-u-line text-u-ink"
                      : "bg-u-danger-soft text-u-danger"
                  }`}
                >
                  {scorecard.classification}
                </span>
              </div>
              <p className="text-xs text-u-muted mt-1">
                {property.address}, {property.city}, {property.state} {property.zip} • Built {property.yearBuilt} • {property.totalBuildings} Buildings • {property.totalUnits} Units • Manager: {manager?.name}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => openCreateActionModal({ propertyId: property.id })}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-u-onaccent bg-u-accent hover:bg-u-accent-strong rounded-lg shadow-2xs transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Action</span>
            </button>
            <button
              onClick={() => setDrilldownPropertyId(null)}
              className="p-1 rounded-lg text-u-muted hover:text-u-ink2 hover:bg-u-s3"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="px-6 border-b border-u-line bg-u-card flex items-center gap-2 overflow-x-auto text-xs font-medium">
          <button
            onClick={() => setActiveTab("overview")}
            className={`py-3 px-3 border-b-2 font-medium transition ${
              activeTab === "overview"
                ? "border-u-accent/60 text-u-accent font-semibold"
                : "border-transparent text-u-muted hover:text-u-ink"
            }`}
          >
            Performance Overview
          </button>
          <button
            onClick={() => setActiveTab("workOrders")}
            className={`py-3 px-3 border-b-2 font-medium transition flex items-center gap-1.5 ${
              activeTab === "workOrders"
                ? "border-u-accent/60 text-u-accent font-semibold"
                : "border-transparent text-u-muted hover:text-u-ink"
            }`}
          >
            <span>Work Orders</span>
            <span className="px-1.5 py-0.2 rounded-full bg-u-s3 text-[10px] text-u-ink2 font-semibold">
              {propWorkOrders.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab("inspections")}
            className={`py-3 px-3 border-b-2 font-medium transition flex items-center gap-1.5 ${
              activeTab === "inspections"
                ? "border-u-accent/60 text-u-accent font-semibold"
                : "border-transparent text-u-muted hover:text-u-ink"
            }`}
          >
            <span>Inspections & Findings</span>
            <span className="px-1.5 py-0.2 rounded-full bg-u-s3 text-[10px] text-u-ink2 font-semibold">
              {propInspections.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab("assets")}
            className={`py-3 px-3 border-b-2 font-medium transition flex items-center gap-1.5 ${
              activeTab === "assets"
                ? "border-u-accent/60 text-u-accent font-semibold"
                : "border-transparent text-u-muted hover:text-u-ink"
            }`}
          >
            <span>Assets & Capital</span>
            <span className="px-1.5 py-0.2 rounded-full bg-u-s3 text-[10px] text-u-ink2 font-semibold">
              {propAssets.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab("leases")}
            className={`py-3 px-3 border-b-2 font-medium transition flex items-center gap-1.5 ${
              activeTab === "leases"
                ? "border-u-accent/60 text-u-accent font-semibold"
                : "border-transparent text-u-muted hover:text-u-ink"
            }`}
          >
            <span>Tenancy & Retention</span>
            <span className="px-1.5 py-0.2 rounded-full bg-u-s3 text-[10px] text-u-ink2 font-semibold">
              {propLeases.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab("actions")}
            className={`py-3 px-3 border-b-2 font-medium transition flex items-center gap-1.5 ${
              activeTab === "actions"
                ? "border-u-accent/60 text-u-accent font-semibold"
                : "border-transparent text-u-muted hover:text-u-ink"
            }`}
          >
            <span>Action Items</span>
            <span className="px-1.5 py-0.2 rounded-full bg-u-accent-soft text-[10px] text-u-accent font-bold">
              {propActions.length}
            </span>
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {activeTab === "overview" && (
            <div className="space-y-6">
              {/* Score Banner */}
              <div className="p-4 rounded-xl border border-u-line bg-gradient-to-r from-u-line via-u-card to-u-line flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-u-card border border-u-line shadow-xs flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold text-u-ink leading-none">
                      {scorecard.overallScore !== null ? scorecard.overallScore.toFixed(1) : "N/A"}
                    </span>
                    <span className="text-[10px] font-semibold text-u-muted mt-0.5">SCORE</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-u-ink">
                        Classification: {scorecard.classification}
                      </span>
                      {scorecard.scoreChange !== null && (
                        <span
                          className={`text-xs font-bold ${
                            scorecard.scoreChange >= 0 ? "text-u-ok" : "text-u-danger"
                          }`}
                        >
                          {scorecard.scoreChange >= 0 ? `+${scorecard.scoreChange}` : scorecard.scoreChange} vs prior
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-u-muted mt-0.5">
                      Target Benchmark: {scorecard.targetScore.toFixed(1)} • Operational Coverage: {scorecard.dataCoveragePercent}% ({scorecard.totalRecordsCount} records)
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setAuditScorecard(scorecard)}
                  className="px-3 py-1.5 text-xs font-medium text-u-accent hover:text-u-accent bg-u-accent-soft/70 hover:bg-u-accent-soft rounded-lg transition"
                >
                  View Scoring Formula & Audit
                </button>
              </div>

              {/* 5 Categories Progress Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {scorecard.categories.map((cat) => (
                  <div key={cat.categoryKey} className="p-4 rounded-xl border border-u-line bg-u-card shadow-2xs">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-u-ink">{cat.name}</span>
                          <span className="text-[11px] text-u-muted">({cat.weight}%)</span>
                        </div>
                        <p className="text-[11px] text-u-muted mt-0.5">{cat.explanation}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-base font-bold text-u-ink">
                          {cat.score !== null ? cat.score.toFixed(1) : "N/A"}
                        </span>
                        <div className="text-[10px] text-u-muted">
                          {cat.status}
                        </div>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-2 w-full bg-u-s3 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-full ${
                          cat.score === null
                            ? "bg-u-line"
                            : cat.score >= 80
                            ? "bg-u-ok"
                            : cat.score >= 65
                            ? "bg-u-accent"
                            : cat.score >= 50
                            ? "bg-u-warn"
                            : "bg-u-danger"
                        }`}
                        style={{ width: `${Math.min(100, cat.score ?? 0)}%` }}
                      />
                    </div>

                    {/* Supporting metrics */}
                    <div className="mt-3 grid grid-cols-2 gap-2 pt-2 border-t border-u-line text-[11px]">
                      {cat.supportingMetrics.map((m, idx) => (
                        <div key={idx} className="flex items-center justify-between">
                          <span className="text-u-muted">{m.label}:</span>
                          <span
                            className={`font-semibold ${
                              m.isFavorable === false ? "text-u-danger" : "text-u-ink"
                            }`}
                          >
                            {m.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "workOrders" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-u-ink uppercase tracking-wider">
                  Operational Work Orders ({propWorkOrders.length})
                </h4>
              </div>
              <div className="border border-u-line rounded-xl overflow-hidden">
                <table className="min-w-full text-xs divide-y divide-u-line">
                  <thead className="bg-u-s2 text-u-ink2 font-semibold">
                    <tr>
                      <th className="px-3 py-2 text-left">WO #</th>
                      <th className="px-3 py-2 text-left">Category</th>
                      <th className="px-3 py-2 text-left">Priority</th>
                      <th className="px-3 py-2 text-left">Reported</th>
                      <th className="px-3 py-2 text-left">Assigned</th>
                      <th className="px-3 py-2 text-left">Status</th>
                      <th className="px-3 py-2 text-center">SLA</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-u-line bg-u-card">
                    {propWorkOrders.map((wo) => (
                      <tr
                        key={wo.id}
                        onClick={() => setPreviewRecord({ type: "workOrder", record: wo })}
                        className="hover:bg-u-s2 cursor-pointer"
                      >
                        <td className="px-3 py-2 font-mono font-medium text-u-accent">{wo.woNumber}</td>
                        <td className="px-3 py-2 text-u-ink font-medium">{wo.category}</td>
                        <td className="px-3 py-2">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                              wo.priority === "Urgent"
                                ? "bg-u-danger-soft text-u-danger"
                                : wo.priority === "High"
                                ? "bg-u-warn-soft text-u-warn"
                                : "bg-u-s3 text-u-ink2"
                            }`}
                          >
                            {wo.priority}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-u-muted">{wo.reportedDate}</td>
                        <td className="px-3 py-2 text-u-ink2">{wo.assignedTo}</td>
                        <td className="px-3 py-2 font-medium">{wo.status}</td>
                        <td className="px-3 py-2 text-center">
                          {wo.slaCompliant === true ? (
                            <span className="text-u-ok font-semibold">Met</span>
                          ) : wo.slaCompliant === false ? (
                            <span className="text-u-danger font-semibold">Breached</span>
                          ) : (
                            <span className="text-u-muted">Pending</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === "inspections" && (
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-u-ink uppercase tracking-wider">
                Inspection Audits & Open Findings
              </h4>
              <div className="border border-u-line rounded-xl overflow-hidden">
                <table className="min-w-full text-xs divide-y divide-u-line">
                  <thead className="bg-u-s2 text-u-ink2 font-semibold">
                    <tr>
                      <th className="px-3 py-2 text-left">Ref #</th>
                      <th className="px-3 py-2 text-left">Type</th>
                      <th className="px-3 py-2 text-left">Date</th>
                      <th className="px-3 py-2 text-left">Inspector</th>
                      <th className="px-3 py-2 text-left">Status</th>
                      <th className="px-3 py-2 text-center">Outcome</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-u-line bg-u-card">
                    {propInspections.map((insp) => (
                      <tr
                        key={insp.id}
                        onClick={() => setPreviewRecord({ type: "inspection", record: insp })}
                        className="hover:bg-u-s2 cursor-pointer"
                      >
                        <td className="px-3 py-2 font-mono font-medium text-u-accent">{insp.refNumber}</td>
                        <td className="px-3 py-2 font-medium text-u-ink">{insp.inspectionType}</td>
                        <td className="px-3 py-2 text-u-muted">{insp.scheduledDate}</td>
                        <td className="px-3 py-2 text-u-ink2">{insp.inspectorName}</td>
                        <td className="px-3 py-2 font-medium">{insp.status}</td>
                        <td className="px-3 py-2 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              insp.overallResult === "Pass"
                                ? "bg-u-ok-soft text-u-ok"
                                : insp.overallResult === "Pass with Notes"
                                ? "bg-u-accent-soft text-u-accent"
                                : insp.overallResult === "Fail"
                                ? "bg-u-danger-soft text-u-danger"
                                : "bg-u-s3 text-u-ink2"
                            }`}
                          >
                            {insp.overallResult || insp.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Outstanding Findings */}
              {propFindings.length > 0 && (
                <div className="mt-4">
                  <h5 className="text-xs font-bold text-u-ink2 mb-2">Recorded Findings & Defect Items</h5>
                  <div className="space-y-2">
                    {propFindings.map((f) => (
                      <div
                        key={f.id}
                        className={`p-3 rounded-lg border text-xs flex items-start justify-between gap-3 ${
                          f.severity === "Critical"
                            ? "bg-u-danger-soft/70 border-u-danger/30"
                            : "bg-u-s2 border-u-line"
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-1.5 py-0.2 rounded font-semibold text-[10px] ${
                                f.severity === "Critical" ? "bg-u-danger text-u-onaccent" : "bg-u-warn-soft text-u-warn"
                              }`}
                            >
                              {f.severity}
                            </span>
                            <span className="font-semibold text-u-ink">{f.category}</span>
                            <span className="text-u-muted">• Due: {f.dueDate}</span>
                          </div>
                          <p className="text-u-ink mt-1">{f.description}</p>
                          <p className="text-u-ink2 text-[11px] mt-0.5 font-medium">
                            Action: {f.correctiveActionRequired}
                          </p>
                        </div>
                        <button
                          onClick={() =>
                            openCreateActionModal({
                              propertyId: property.id,
                              issue: `Finding: ${f.description}`,
                              severity: f.severity,
                              assignedTo: f.assignedTo,
                              dueDate: f.dueDate,
                              relatedRecordType: "Inspection",
                              relatedRecordId: f.id,
                            })
                          }
                          className="shrink-0 text-xs px-2.5 py-1 text-u-onaccent bg-u-accent hover:bg-u-accent-strong rounded font-medium"
                        >
                          Create Action
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "assets" && (
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-u-ink uppercase tracking-wider">
                Tracked Assets & Lifecycle Schedule
              </h4>
              <div className="border border-u-line rounded-xl overflow-hidden">
                <table className="min-w-full text-xs divide-y divide-u-line">
                  <thead className="bg-u-s2 text-u-ink2 font-semibold">
                    <tr>
                      <th className="px-3 py-2 text-left">Tag</th>
                      <th className="px-3 py-2 text-left">Component</th>
                      <th className="px-3 py-2 text-left">Category</th>
                      <th className="px-3 py-2 text-center">Condition</th>
                      <th className="px-3 py-2 text-center">Remaining Life</th>
                      <th className="px-3 py-2 text-center">Deferred Maint.</th>
                      <th className="px-3 py-2 text-right">Repl. Est.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-u-line bg-u-card">
                    {propAssets.map((asset) => (
                      <tr
                        key={asset.id}
                        onClick={() => setPreviewRecord({ type: "asset", record: asset })}
                        className="hover:bg-u-s2 cursor-pointer"
                      >
                        <td className="px-3 py-2 font-mono text-u-accent font-medium">{asset.assetTag}</td>
                        <td className="px-3 py-2 font-medium text-u-ink">{asset.componentName}</td>
                        <td className="px-3 py-2 text-u-ink2">{asset.category}</td>
                        <td className="px-3 py-2 text-center">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                              asset.conditionRating === "Excellent"
                                ? "bg-u-ok-soft text-u-ok"
                                : asset.conditionRating === "Good"
                                ? "bg-u-accent-soft text-u-accent"
                                : asset.conditionRating === "Fair"
                                ? "bg-u-warn-soft text-u-warn"
                                : "bg-u-danger-soft text-u-danger"
                            }`}
                          >
                            {asset.conditionRating}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center font-bold text-u-ink">
                          {asset.remainingUsefulLifeYears} yrs
                        </td>
                        <td className="px-3 py-2 text-center">
                          {asset.deferredMaintenance ? (
                            <span className="px-1.5 py-0.5 rounded bg-u-danger-soft text-u-danger font-bold text-[10px]">
                              YES
                            </span>
                          ) : (
                            <span className="text-u-muted">No</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right font-mono font-medium text-u-ink">
                          ${asset.estimatedReplacementCost?.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === "leases" && (
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-u-ink uppercase tracking-wider">
                Leases & Renewal Decisions
              </h4>
              <div className="border border-u-line rounded-xl overflow-hidden">
                <table className="min-w-full text-xs divide-y divide-u-line">
                  <thead className="bg-u-s2 text-u-ink2 font-semibold">
                    <tr>
                      <th className="px-3 py-2 text-left">Lease #</th>
                      <th className="px-3 py-2 text-left">Tenant</th>
                      <th className="px-3 py-2 text-left">Duration</th>
                      <th className="px-3 py-2 text-left">Outcome</th>
                      <th className="px-3 py-2 text-left">Departure Reason</th>
                      <th className="px-3 py-2 text-center">Complaints</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-u-line bg-u-card">
                    {propLeases.map((l) => (
                      <tr key={l.id} className="hover:bg-u-s2">
                        <td className="px-3 py-2 font-mono text-u-accent font-medium">{l.leaseNumber}</td>
                        <td className="px-3 py-2 font-medium text-u-ink">{l.tenantName}</td>
                        <td className="px-3 py-2 text-u-ink2">{l.tenancyDurationMonths} mos</td>
                        <td className="px-3 py-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              l.renewalOutcome === "Renewed"
                                ? "bg-u-ok-soft text-u-ok"
                                : l.renewalOutcome === "Non-Renewed"
                                ? "bg-u-danger-soft text-u-danger"
                                : "bg-u-s3 text-u-ink2"
                            }`}
                          >
                            {l.renewalOutcome || "Active"}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-u-ink2">{l.departureReason || "N/A"}</td>
                        <td className="px-3 py-2 text-center font-bold text-u-ink">
                          {l.complaintCount || 0}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === "actions" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-u-ink uppercase tracking-wider">
                  Operational Action Items ({propActions.length})
                </h4>
                <button
                  onClick={() => openCreateActionModal({ propertyId: property.id })}
                  className="px-2.5 py-1 text-xs font-medium text-u-accent hover:bg-u-accent-soft rounded"
                >
                  + Add Action
                </button>
              </div>
              {propActions.length === 0 ? (
                <div className="text-center py-8 text-u-muted text-xs">
                  No open action items assigned for this property.
                </div>
              ) : (
                <div className="space-y-2">
                  {propActions.map((act) => (
                    <div key={act.id} className="p-3 rounded-lg border border-u-line bg-u-s2/50 text-xs">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-u-ink2">{act.actionRef}</span>
                          <span className="font-semibold text-u-ink">{act.priority}</span>
                          <span className="text-u-muted">• Assigned to {act.assignedTo}</span>
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-u-card border border-u-line">
                          {act.status}
                        </span>
                      </div>
                      <p className="text-u-ink mt-1">{act.issueDescription}</p>
                      <div className="mt-2 text-[11px] text-u-muted flex items-center justify-between">
                        <span>Due: {act.dueDate}</span>
                        <span>Ref: {act.relatedRecordRef}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-u-line flex items-center justify-between bg-u-s2/50">
          <span className="text-xs text-u-muted">
            Property ID: {property.id} • Drizzle PostgreSQL Synced
          </span>
          <button
            onClick={() => setDrilldownPropertyId(null)}
            className="px-4 py-2 text-xs font-medium text-u-ink2 hover:bg-u-line rounded-lg transition"
          >
            Close Property Detail
          </button>
        </div>
      </div>
    </div>
  );
}
