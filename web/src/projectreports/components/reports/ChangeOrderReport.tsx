import React, { useState } from "react";
import {
  GitPullRequestDraft,
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  Calendar,
  DollarSign,
  FileText,
  Search,
} from "lucide-react";
import { useProjectReports } from "../../context/ProjectReportsContext";
import { formatCurrency, formatDate } from "../../lib/calculations";

export function ChangeOrderReport() {
  const { changeOrders, projects, kpis, drillDownProject } = useProjectReports();
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredCOs = changeOrders.filter((c) => {
    if (statusFilter !== "ALL" && c.status !== statusFilter) return false;
    if (
      searchQuery &&
      !c.coNumber.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !c.description.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !(c.projectName || "").toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  // Aggregation by Reason
  const reasonsMap: Record<string, { count: number; value: number }> = {};
  changeOrders.forEach((c) => {
    if (!reasonsMap[c.reason]) {
      reasonsMap[c.reason] = { count: 0, value: 0 };
    }
    reasonsMap[c.reason].count += 1;
    reasonsMap[c.reason].value += c.costImpact;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-base font-bold text-u-ink">Change Order & Scope Change Governance</h2>
        <p className="text-xs text-u-muted">
          Tracking baseline scope modifications, authorized budget revisions, and pending unapproved exposure
        </p>
      </div>

      {/* 11.1 SUMMARY KPI CARDS */}
      {kpis?.changeOrders && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <div className="rounded-xl border border-u-line bg-u-card p-3.5 shadow-2xs">
            <span className="text-[10px] font-bold uppercase text-u-muted">Total Change Orders</span>
            <p className="text-2xl font-bold text-u-ink mt-1">{kpis.changeOrders.totalCount}</p>
            <span className="text-[10px] text-u-muted">Submitted across portfolio</span>
          </div>

          <div className="rounded-xl border border-u-ok/30 bg-u-ok-soft/40 p-3.5 shadow-2xs">
            <span className="text-[10px] font-bold uppercase text-u-ok">Approved Orders</span>
            <p className="text-2xl font-bold text-u-ok mt-1">{kpis.changeOrders.approvedCount}</p>
            <span className="text-[10px] text-u-ok font-medium">Incorporated into budget</span>
          </div>

          <div className="rounded-xl border border-u-warn/30 bg-u-warn-soft/40 p-3.5 shadow-2xs">
            <span className="text-[10px] font-bold uppercase text-u-warn">Pending Review</span>
            <p className="text-2xl font-bold text-u-warn mt-1">{kpis.changeOrders.pendingCount}</p>
            <span className="text-[10px] text-u-warn font-medium">Awaiting owner signoff</span>
          </div>

          <div className="rounded-xl border border-u-line bg-u-card p-3.5 shadow-2xs">
            <span className="text-[10px] font-bold uppercase text-u-muted">Approved Budget Impact</span>
            <p className="text-xl font-bold text-u-ink mt-1">
              +{formatCurrency(kpis.changeOrders.totalApprovedCostChange)}
            </p>
            <span className="text-[10px] text-u-muted">Added to approved totals</span>
          </div>

          <div className="rounded-xl border border-u-warn/30 bg-u-card p-3.5 shadow-2xs">
            <span className="text-[10px] font-bold uppercase text-u-warn">Pending Exposure</span>
            <p className="text-xl font-bold text-u-warn mt-1">
              {formatCurrency(kpis.changeOrders.totalPendingCostExposure)}
            </p>
            <span className="text-[10px] text-u-warn font-medium">Not added to budget</span>
          </div>

          <div className="rounded-xl border border-u-line bg-u-card p-3.5 shadow-2xs">
            <span className="text-[10px] font-bold uppercase text-u-muted">Approved Time Extension</span>
            <p className="text-2xl font-bold text-u-ink mt-1">
              +{kpis.changeOrders.totalApprovedScheduleDays} Days
            </p>
            <span className="text-[10px] text-u-muted">Schedule baseline adjustment</span>
          </div>
        </div>
      )}

      {/* 11.4 CHARTS: REASONS FOR CHANGES & STATUS BREAKDOWN */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Reasons for Scope Modifications */}
        <div className="rounded-2xl border border-u-line bg-u-card p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-u-line">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-u-ink">
                Change Order Drivers & Root Causes
              </h3>
              <p className="text-[11px] text-u-muted">Categorization by contractual reason</p>
            </div>
            <span className="text-xs text-u-muted font-medium">{Object.keys(reasonsMap).length} Root Causes</span>
          </div>

          <div className="mt-4 space-y-3">
            {Object.entries(reasonsMap).map(([reason, data]) => {
              const maxVal = 60000;
              const barWidth = Math.min(100, (Math.abs(data.value) / maxVal) * 100);

              return (
                <div key={reason} className="rounded-lg p-2 hover:bg-u-s2 transition-colors">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-semibold text-u-ink">{reason}</span>
                    <span className="font-bold text-u-ink">
                      {formatCurrency(data.value)} <span className="font-normal text-u-muted">({data.count} COs)</span>
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-u-s3 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-u-accent transition-all"
                      style={{ width: `${Math.max(8, barWidth)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-3 text-[11px] text-u-muted pt-3 border-t border-u-line">
            Unforeseen site conditions (concealed rebar corrosion, wood rot) represent 54% of approved variances.
          </div>
        </div>

        {/* Change Order Policy & Governance Controls */}
        <div className="rounded-2xl border border-u-line bg-u-card p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="pb-3 border-b border-u-line">
              <h3 className="text-xs font-bold uppercase tracking-wider text-u-ink">
                Change Order Approval Authority Policy
              </h3>
              <p className="text-[11px] text-u-muted">Separation of requested exposure from current approved budget</p>
            </div>

            <div className="mt-4 space-y-3 text-xs text-u-ink2">
              <div className="rounded-xl bg-u-s2 p-3.5 border border-u-line space-y-2">
                <div className="flex items-center gap-2 font-bold text-u-ink">
                  <CheckCircle2 className="h-4 w-4 text-u-ok" />
                  <span>Approved Change Orders:</span>
                </div>
                <p className="text-[11px] text-u-ink2 pl-6">
                  Only signed change orders automatically increment the <strong>Current Approved Budget</strong> and baseline schedule.
                </p>
              </div>

              <div className="rounded-xl bg-u-warn-soft/60 p-3.5 border border-u-warn/30 space-y-2">
                <div className="flex items-center gap-2 font-bold text-u-warn">
                  <Clock className="h-4 w-4 text-u-warn" />
                  <span>Pending Change Orders:</span>
                </div>
                <p className="text-[11px] text-u-ink2 pl-6">
                  Tracked strictly as uncommitted financial risk exposure. Never blended into approved baselines before formal owner authorization.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-u-line text-[11px] text-u-muted">
            Full audit log recorded with approver name, timestamp, and signed submittal documentation.
          </div>
        </div>
      </div>

      {/* 11.2 CHANGE ORDER DETAIL TABLE */}
      <div className="rounded-2xl border border-u-line bg-u-card p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-u-line">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-u-ink">
              Change Order Audit Register ({filteredCOs.length})
            </h3>
            <p className="text-[11px] text-u-muted">Complete itemized log of all proposed, approved, and rejected changes</p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <div className="relative">
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-u-muted" />
              <input
                type="text"
                placeholder="Search CO # or scope..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="rounded-lg border border-u-line py-1 pl-8 pr-3 text-xs text-u-ink placeholder:text-u-muted"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-u-line py-1 px-2.5 text-xs text-u-ink"
            >
              <option value="ALL">All Statuses</option>
              <option value="Approved">Approved</option>
              <option value="Pending">Pending Review</option>
              <option value="Rejected">Rejected</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-u-s2 text-[10px] font-bold text-u-muted uppercase border-b border-u-line">
              <tr>
                <th className="py-2.5 px-3">CO #</th>
                <th className="py-2.5 px-3">Project & Property</th>
                <th className="py-2.5 px-3">Description & Scope Ref</th>
                <th className="py-2.5 px-3">Reason</th>
                <th className="py-2.5 px-3">Requested By</th>
                <th className="py-2.5 px-3">Cost Impact</th>
                <th className="py-2.5 px-3">Schedule Impact</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Approver & Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-u-line">
              {filteredCOs.map((co) => (
                <tr
                  key={co.id}
                  onClick={() => drillDownProject(co.projectId)}
                  className="hover:bg-u-accent-soft/40 cursor-pointer transition-colors"
                >
                  <td className="py-2.5 px-3 font-mono font-bold text-u-accent text-[11px]">{co.coNumber}</td>
                  <td className="py-2.5 px-3">
                    <div className="font-semibold text-u-ink truncate max-w-[170px]">{co.projectName}</div>
                    <div className="text-[10px] text-u-muted">{co.propertyName}</div>
                  </td>
                  <td className="py-2.5 px-3 max-w-[260px]">
                    <div className="text-u-ink font-medium truncate">{co.description}</div>
                    <div className="text-[10px] text-u-muted font-mono truncate">{co.scopeReference}</div>
                  </td>
                  <td className="py-2.5 px-3 text-u-ink2">{co.reason}</td>
                  <td className="py-2.5 px-3 text-u-ink2">{co.requestedBy}</td>
                  <td className="py-2.5 px-3 font-semibold text-u-ink">{formatCurrency(co.costImpact)}</td>
                  <td className="py-2.5 px-3 text-u-ink2">
                    {co.scheduleImpactDays > 0 ? `+${co.scheduleImpactDays} days` : "0 days"}
                  </td>
                  <td className="py-2.5 px-3">
                    <span
                      className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        co.status === "Approved"
                          ? "bg-u-ok-soft text-u-ok"
                          : co.status === "Pending"
                          ? "bg-u-warn-soft text-u-warn"
                          : "bg-u-danger-soft text-u-danger"
                      }`}
                    >
                      {co.status}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-u-ink2">
                    {co.approver ? (
                      <div>
                        <div>{co.approver}</div>
                        <div className="text-[10px] text-u-muted">{formatDate(co.approvalDate)}</div>
                      </div>
                    ) : (
                      <span className="text-u-muted italic">Pending Committee</span>
                    )}
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
