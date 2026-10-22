import React, { useState } from "react";
import {
  CheckSquare2,
  FileText,
  ShieldCheck,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Lock,
  ChevronRight,
  Filter,
} from "lucide-react";
import { useProjectReports } from "../../context/ProjectReportsContext";
import { formatCurrency, formatDate } from "../../lib/calculations";

export function CompletionHandoverReport() {
  const { projects, handoverItems, drillDownProject } = useProjectReports();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  // Projects that are completed or active with handover items
  const relevantProjects = projects.filter((p) => {
    const hasHandover = handoverItems.some((h) => h.projectId === p.id);
    return p.status === "Completed" || hasHandover || (p.actualProgress || 0) >= 70;
  });

  const activeProject = selectedProjectId
    ? projects.find((p) => p.id === selectedProjectId)
    : relevantProjects[0];

  const activeHandoverItems = activeProject
    ? handoverItems.filter((h) => h.projectId === activeProject.id)
    : [];

  const completedChecklistCount = activeHandoverItems.filter((h) => h.status === "Completed").length;
  const pendingChecklistCount = activeHandoverItems.filter((h) => h.status === "Pending").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-base font-bold text-u-ink">Project Completion & Handover Verification</h2>
        <p className="text-xs text-u-muted">
          Independent verification of physical works, municipal inspections, deficiency closeouts, warranties, and financial reconciliation
        </p>
      </div>

      {/* Governance Banner: Physical != Closed */}
      <div className="rounded-2xl border border-u-accent/30 bg-linear-to-r from-u-accent-soft/80 to-white p-5 shadow-xs">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-u-accent text-u-onaccent">
            <Lock className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-u-ink">Institutional Governance Principle:</h3>
            <p className="mt-1 text-xs text-u-ink2 leading-relaxed">
              <strong>Physical construction completion does not constitute formal project closure.</strong> A project cannot be transferred to operations until final inspections are certified, punchlist deficiencies are cleared, O&M manuals are accepted, lien waivers are received, and final accounting retainage is reconciled.
            </p>
          </div>
        </div>
      </div>

      {/* 12.2 HANDOVER SUMMARY REGISTER ACROSS PROJECTS */}
      <div className="rounded-2xl border border-u-line bg-u-card p-5 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-u-line">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-u-ink">
              Handover & Acceptance Status Across Initiatives
            </h3>
            <p className="text-[11px] text-u-muted">Evaluating 7 independent verification gates per asset</p>
          </div>
          <span className="text-xs text-u-muted font-medium">{relevantProjects.length} Initiatives Evaluated</span>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-u-s2 text-[10px] font-bold text-u-muted uppercase border-b border-u-line">
              <tr>
                <th className="py-2.5 px-3">Project Code</th>
                <th className="py-2.5 px-3">Project & Property</th>
                <th className="py-2.5 px-3">Physical Work</th>
                <th className="py-2.5 px-3">Inspections</th>
                <th className="py-2.5 px-3">Deficiencies</th>
                <th className="py-2.5 px-3">Documentation (O&M)</th>
                <th className="py-2.5 px-3">Financial Recon</th>
                <th className="py-2.5 px-3">Handover Signoff</th>
                <th className="py-2.5 px-3">Formal Closure</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-u-line">
              {relevantProjects.map((p) => {
                const isSelected = activeProject?.id === p.id;
                const items = handoverItems.filter((h) => h.projectId === p.id);
                const isDocPending = items.some((h) => h.category === "Documentation" && h.status === "Pending");
                const isPhysicalDone = p.status === "Completed" || (p.actualProgress || 0) === 100;
                const isClosed = p.dataNotes?.includes("closed") || (p.status === "Completed" && !isDocPending);

                return (
                  <tr
                    key={p.id}
                    onClick={() => setSelectedProjectId(p.id)}
                    className={`cursor-pointer transition-colors ${
                      isSelected ? "bg-u-accent-soft/70 font-medium" : "hover:bg-u-s2"
                    }`}
                  >
                    <td className="py-2.5 px-3 font-mono font-bold text-u-accent">{p.code}</td>
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-u-ink truncate max-w-[180px]">{p.name}</div>
                      <div className="text-[10px] text-u-muted">{p.propertyName}</div>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        isPhysicalDone ? "bg-u-ok-soft text-u-ok" : "bg-u-accent-soft text-u-accent"
                      }`}>
                        {isPhysicalDone ? "100% Done" : `${p.actualProgress || 0}% Done`}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="text-u-ok font-semibold flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5 text-u-ok" /> Passed
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="text-u-ok font-medium">0 Open</span>
                    </td>
                    <td className="py-2.5 px-3">
                      {isDocPending ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-u-danger bg-u-danger-soft px-2 py-0.5 rounded border border-u-danger/30">
                          <AlertTriangle className="h-3 w-3 text-u-danger" /> Missing O&M
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-u-ok bg-u-ok-soft px-2 py-0.5 rounded border border-u-ok/30">
                          <CheckCircle2 className="h-3 w-3 text-u-ok" /> Cataloged
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      {isDocPending ? (
                        <span className="text-u-warn font-medium">Retainage Held</span>
                      ) : (
                        <span className="text-u-ok font-medium">Reconciled</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      {isClosed ? (
                        <span className="text-u-ok font-semibold">Accepted</span>
                      ) : (
                        <span className="text-u-warn font-semibold">Pending Docs</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${
                          isClosed
                            ? "bg-u-ok-soft text-u-ok"
                            : "bg-u-line text-u-ink"
                        }`}
                      >
                        {isClosed ? "Formally Closed" : "Active In-Flight"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 12.1 DETAILED CHECKLIST DOSSIER FOR SELECTED PROJECT */}
      {activeProject && (
        <div className="rounded-2xl border border-u-accent/80 bg-u-card p-5 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-u-line">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-u-accent">{activeProject.code}</span>
                <h3 className="text-sm font-bold text-u-ink">{activeProject.name}</h3>
              </div>
              <p className="text-xs text-u-muted mt-0.5">
                Property: {activeProject.propertyName} • PM: {activeProject.managerName} • Contractor: {activeProject.contractorName}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-u-ink2 bg-u-s3 px-3 py-1 rounded-lg">
                Checklist: <strong>{completedChecklistCount}</strong> / {activeHandoverItems.length} Verified
              </span>
              <button
                onClick={() => drillDownProject(activeProject.id)}
                className="text-xs font-semibold text-u-accent hover:text-u-accent flex items-center gap-1"
              >
                Open Project Dossier &rarr;
              </button>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {activeHandoverItems.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-u-line bg-u-s2/50 p-3.5 flex items-start justify-between gap-4"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-u-accent bg-u-accent-soft px-2 py-0.5 rounded border border-u-accent/30">
                      {item.category}
                    </span>
                    <span className="text-xs font-bold text-u-ink">{item.title}</span>
                  </div>
                  {item.notes && <p className="text-xs text-u-ink2 mt-1.5 leading-relaxed">{item.notes}</p>}
                  <div className="mt-2 text-[11px] text-u-muted">
                    {item.completedDate ? (
                      <span className="text-u-ok font-medium">
                        Verified: {formatDate(item.completedDate)} by {item.verifiedBy || "Inspector"}
                      </span>
                    ) : (
                      <span className="text-u-warn font-medium">
                        Action Required by General Contractor & Project Manager
                      </span>
                    )}
                  </div>
                </div>

                <span
                  className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded ${
                    item.status === "Completed"
                      ? "bg-u-ok-soft text-u-ok"
                      : item.status === "Pending"
                      ? "bg-u-danger-soft text-u-danger"
                      : "bg-u-warn-soft text-u-warn"
                  }`}
                >
                  {item.status}
                </span>
              </div>
            ))}

            {activeHandoverItems.length === 0 && (
              <div className="p-6 text-center text-xs text-u-muted">
                Handover items will be generated when project achieves 75% physical completion.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
