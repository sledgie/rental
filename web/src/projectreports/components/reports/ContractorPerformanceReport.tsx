import React, { useState } from "react";
import {
  HardHat,
  ShieldCheck,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Award,
  ChevronRight,
  ExternalLink,
  FileText,
  Search,
} from "lucide-react";
import { useProjectReports } from "../../context/ProjectReportsContext";
import { formatCurrency, formatPct, formatDate } from "../../lib/calculations";

export function ContractorPerformanceReport() {
  const { contractors, projects, milestones, changeOrders, handoverItems, drillDownProject } = useProjectReports();
  const [selectedContractorId, setSelectedContractorId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Calculate objective contractor scorecard metrics
  const contractorMetrics = contractors.map((ctr) => {
    const assignedProjects = projects.filter((p) => p.contractorId === ctr.id);
    const assignedProjectIds = new Set(assignedProjects.map((p) => p.id));
    const completedProjects = assignedProjects.filter((p) => p.status === "Completed");

    const ctrMilestones = milestones.filter((m) => assignedProjectIds.has(m.projectId));
    const completedMilestones = ctrMilestones.filter((m) => m.status === "Completed");
    const onTimeMilestones = completedMilestones.filter((m) => (m.delayDays || 0) <= 0);
    const onTimeRate =
      completedMilestones.length > 0 ? (onTimeMilestones.length / completedMilestones.length) * 100 : 100;

    const delayedMilestones = ctrMilestones.filter((m) => (m.delayDays || 0) > 0);
    const totalDelayDays = delayedMilestones.reduce((acc, m) => acc + m.delayDays, 0);
    const avgDelay = delayedMilestones.length > 0 ? Math.round(totalDelayDays / delayedMilestones.length) : 0;

    const ctrChangeOrders = changeOrders.filter((c) => assignedProjectIds.has(c.projectId));
    const approvedCOs = ctrChangeOrders.filter((c) => c.status === "Approved");

    const ctrHandover = handoverItems.filter((h) => assignedProjectIds.has(h.projectId));
    const completedHandover = ctrHandover.filter((h) => h.status === "Completed");
    const docRate = ctrHandover.length > 0 ? (completedHandover.length / ctrHandover.length) * 100 : 100;

    return {
      contractor: ctr,
      projectsAssigned: assignedProjects.length,
      projectsCompleted: completedProjects.length,
      milestonesTotal: ctrMilestones.length,
      milestonesOnTime: onTimeMilestones.length,
      milestonesLate: completedMilestones.length - onTimeMilestones.length,
      onTimeMilestoneRate: onTimeRate,
      averageDelayDays: avgDelay,
      changeOrderCount: ctrChangeOrders.length,
      approvedCOValue: approvedCOs.reduce((acc, c) => acc + c.costImpact, 0),
      documentationRate: docRate,
      assignedProjectsList: assignedProjects,
      changeOrdersList: ctrChangeOrders,
      milestonesList: ctrMilestones,
    };
  });

  const filteredMetrics = contractorMetrics.filter((m) => {
    if (!searchQuery) return true;
    return (
      m.contractor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.contractor.trade.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const activeContractor = selectedContractorId
    ? contractorMetrics.find((m) => m.contractor.id === selectedContractorId)
    : filteredMetrics[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-base font-bold text-u-ink">Contractor & Vendor Delivery Performance</h2>
        <p className="text-xs text-u-muted">
          Objective evaluation of schedule adherence, milestone delivery, change order frequency, and handover documentation
        </p>
      </div>

      {/* 9.1 COMPARISON TABLE */}
      <div className="rounded-2xl border border-u-line bg-u-card p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-u-line">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-u-ink">
              Contractor Scorecards & Benchmark Registry
            </h3>
            <p className="text-[11px] text-u-muted">Click a contractor row to inspect detailed performance breakdown</p>
          </div>

          <div className="relative">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-u-muted" />
            <input
              type="text"
              placeholder="Search vendor or trade..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="rounded-lg border border-u-line py-1 pl-8 pr-3 text-xs text-u-ink placeholder:text-u-muted"
            />
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-u-s2 text-[10px] font-bold text-u-muted uppercase border-b border-u-line">
              <tr>
                <th className="py-2.5 px-3">Contractor / Trade</th>
                <th className="py-2.5 px-3">Compliance & Insurance</th>
                <th className="py-2.5 px-3">Projects Active / Done</th>
                <th className="py-2.5 px-3">Milestone On-Time Rate</th>
                <th className="py-2.5 px-3">Avg Delay</th>
                <th className="py-2.5 px-3">Change Orders</th>
                <th className="py-2.5 px-3">Documentation Score</th>
                <th className="py-2.5 px-3">Audit Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-u-line">
              {filteredMetrics.map((row) => {
                const isSelected = activeContractor?.contractor.id === row.contractor.id;
                return (
                  <tr
                    key={row.contractor.id}
                    onClick={() => setSelectedContractorId(row.contractor.id)}
                    className={`cursor-pointer transition-colors ${
                      isSelected ? "bg-u-accent-soft/70 font-medium" : "hover:bg-u-s2"
                    }`}
                  >
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-u-ink">{row.contractor.name}</div>
                      <div className="text-[10px] text-u-muted">{row.contractor.trade}</div>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`h-2 w-2 rounded-full ${
                            row.contractor.complianceStatus.includes("Active") ? "bg-u-ok" : "bg-u-warn"
                          }`}
                        />
                        <span className="text-u-ink2">{row.contractor.complianceStatus}</span>
                      </div>
                      <div className="text-[10px] text-u-muted">Exp: {row.contractor.insuranceExpiry}</div>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="font-semibold text-u-ink">
                        {row.projectsAssigned} assigned ({row.projectsCompleted} completed)
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-bold ${
                            row.onTimeMilestoneRate >= 80
                              ? "text-u-ok"
                              : row.onTimeMilestoneRate >= 60
                              ? "text-u-warn"
                              : "text-u-danger"
                          }`}
                        >
                          {row.onTimeMilestoneRate.toFixed(1)}%
                        </span>
                        <span className="text-[10px] text-u-muted">
                          ({row.milestonesOnTime}/{row.milestonesOnTime + row.milestonesLate})
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`font-semibold ${row.averageDelayDays > 7 ? "text-u-danger" : "text-u-ink2"}`}>
                        {row.averageDelayDays > 0 ? `+${row.averageDelayDays} days` : "0 days"}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-u-ink2">
                      <span>{row.changeOrderCount} COs ({formatCurrency(row.approvedCOValue)})</span>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 rounded-full bg-u-s3 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-u-accent"
                            style={{ width: `${row.documentationRate}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-u-ink2 font-semibold">{row.documentationRate.toFixed(0)}%</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedContractorId(row.contractor.id);
                        }}
                        className="text-xs text-u-accent hover:text-u-accent font-medium flex items-center gap-1"
                      >
                        Inspect Dossier <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 9.3 CONTRACTOR DETAIL DOSSIER */}
      {activeContractor && (
        <div className="rounded-2xl border border-u-accent/80 bg-u-card p-5 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-u-line">
            <div>
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-u-accent-soft text-u-accent">
                  <HardHat className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-u-ink">{activeContractor.contractor.name}</h3>
                  <p className="text-xs text-u-muted">
                    Trade: {activeContractor.contractor.trade} • Contact: {activeContractor.contractor.contactPerson} ({activeContractor.contractor.phone})
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="rounded-lg bg-u-ok-soft px-2.5 py-1 text-xs font-semibold text-u-ok border border-u-ok/30">
                Compliance: {activeContractor.contractor.complianceStatus}
              </span>
              <span className="rounded-lg bg-u-s3 px-2.5 py-1 text-xs text-u-ink2">
                Insurance Expiry: {activeContractor.contractor.insuranceExpiry}
              </span>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Assigned Projects */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-u-ink2 mb-2">
                Assigned Capital Projects ({activeContractor.assignedProjectsList.length})
              </h4>
              <div className="space-y-2.5">
                {activeContractor.assignedProjectsList.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => drillDownProject(p.id)}
                    className="cursor-pointer rounded-xl border border-u-line bg-u-s2 p-3 hover:bg-u-accent-soft/50 hover:border-u-accent/30 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-u-accent">{p.code}</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        p.scheduleHealth === "On Track" ? "bg-u-ok-soft text-u-ok" : "bg-u-danger-soft text-u-danger"
                      }`}>
                        {p.scheduleHealth}
                      </span>
                    </div>
                    <p className="font-semibold text-xs text-u-ink mt-1">{p.name}</p>
                    <div className="mt-1.5 flex items-center justify-between text-[11px] text-u-muted">
                      <span>Budget: {formatCurrency(p.currentApprovedBudget)}</span>
                      <span>Progress: {p.actualProgress || 0}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Change Orders Log */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-u-ink2 mb-2">
                Change Orders Originated ({activeContractor.changeOrdersList.length})
              </h4>
              <div className="space-y-2.5">
                {activeContractor.changeOrdersList.map((co) => (
                  <div key={co.id} className="rounded-xl border border-u-line bg-u-s2 p-3 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-u-ink">{co.coNumber}</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        co.status === "Approved" ? "bg-u-ok-soft text-u-ok" : "bg-u-warn-soft text-u-warn"
                      }`}>
                        {co.status}
                      </span>
                    </div>
                    <p className="text-u-ink2 mt-1">{co.description}</p>
                    <div className="mt-1 flex items-center justify-between text-[11px] text-u-muted">
                      <span>Cost: {formatCurrency(co.costImpact)}</span>
                      <span>Reason: {co.reason}</span>
                    </div>
                  </div>
                ))}
                {activeContractor.changeOrdersList.length === 0 && (
                  <div className="p-4 rounded-xl border border-u-line text-center text-xs text-u-muted">
                    No change orders submitted by this contractor.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
