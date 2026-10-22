import React from "react";
import { useReportContext } from "../../context/ReportContext";
import { X, Wrench, ClipboardCheck, Box, Calendar, User, Clock, AlertTriangle } from "lucide-react";

export function RecordDetailModal() {
  const { previewRecord, setPreviewRecord, openCreateActionModal, rawData } = useReportContext();

  if (!previewRecord) return null;

  const { type, record } = previewRecord;
  const prop = rawData?.properties.find((p) => p.id === record.propertyId);

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="bg-u-card rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-u-line animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-u-line flex items-center justify-between bg-u-s2/70">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-u-accent-soft text-u-accent">
              {type === "workOrder" && <Wrench className="w-5 h-5" />}
              {type === "inspection" && <ClipboardCheck className="w-5 h-5" />}
              {type === "asset" && <Box className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-base font-semibold text-u-ink">
                {type === "workOrder" && `Work Order: ${record.woNumber}`}
                {type === "inspection" && `Inspection: ${record.refNumber}`}
                {type === "asset" && `Asset: ${record.assetTag}`}
              </h3>
              <p className="text-xs text-u-muted">{prop?.name || "Property Record"}</p>
            </div>
          </div>
          <button
            onClick={() => setPreviewRecord(null)}
            className="p-1 rounded-lg text-u-muted hover:text-u-ink2 hover:bg-u-s3"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 text-xs">
          {type === "workOrder" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-2.5 rounded-lg bg-u-s2 border border-u-line">
                  <span className="text-u-muted block text-[10px]">CATEGORY</span>
                  <span className="font-semibold text-u-ink text-sm">{record.category}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-u-s2 border border-u-line">
                  <span className="text-u-muted block text-[10px]">PRIORITY</span>
                  <span className="font-semibold text-u-ink text-sm">{record.priority}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-u-s2 border border-u-line">
                  <span className="text-u-muted block text-[10px]">STATUS</span>
                  <span className="font-semibold text-u-ink text-sm">{record.status}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-u-s2 border border-u-line">
                  <span className="text-u-muted block text-[10px]">SLA TIMELINESS</span>
                  <span
                    className={`font-semibold text-sm ${
                      record.slaCompliant ? "text-u-ok" : "text-u-danger"
                    }`}
                  >
                    {record.slaCompliant === true
                      ? "Compliant (Within SLA)"
                      : record.slaCompliant === false
                      ? "Breached SLA"
                      : "Pending SLA Target"}
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-u-muted font-medium">Timestamps & Assignment:</span>
                <div className="p-3 bg-u-s2 rounded-lg border border-u-line space-y-1">
                  <div>Reported Date: <span className="font-semibold">{record.reportedDate}</span></div>
                  <div>Scheduled: <span className="font-semibold">{record.scheduledDate || "N/A"}</span></div>
                  <div>Completed: <span className="font-semibold">{record.completedDate || "Open/Pending"}</span></div>
                  <div>Assigned To: <span className="font-semibold">{record.assignedTo} ({record.assignedRole})</span></div>
                  {record.actualDurationHours && (
                    <div>Elapsed Duration: <span className="font-semibold">{record.actualDurationHours} hours</span> (Target: {record.targetSlaHours}h)</div>
                  )}
                </div>
              </div>

              {record.resolutionNotes && (
                <div className="space-y-1">
                  <span className="text-u-muted font-medium">Resolution Notes:</span>
                  <p className="p-3 bg-u-s2 rounded-lg border border-u-line text-u-ink2">
                    {record.resolutionNotes}
                  </p>
                </div>
              )}

              {record.isRepeatIssue && (
                <div className="p-3 rounded-lg bg-u-warn-soft border border-u-warn/30 text-u-warn flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>Classified as Repeat Issue within 60-day window ({record.repeatRootAsset})</span>
                </div>
              )}
            </>
          )}

          {type === "inspection" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-2.5 rounded-lg bg-u-s2 border border-u-line">
                  <span className="text-u-muted block text-[10px]">TYPE</span>
                  <span className="font-semibold text-u-ink text-sm">{record.inspectionType}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-u-s2 border border-u-line">
                  <span className="text-u-muted block text-[10px]">OUTCOME</span>
                  <span className="font-semibold text-u-ink text-sm">{record.overallResult || "Pending"}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-u-s2 border border-u-line">
                  <span className="text-u-muted block text-[10px]">CONDITION SCORE</span>
                  <span className="font-semibold text-u-ink text-sm">{record.conditionScore ? `${record.conditionScore}/100` : "N/A"}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-u-s2 border border-u-line">
                  <span className="text-u-muted block text-[10px]">STATUS</span>
                  <span className="font-semibold text-u-ink text-sm">{record.status}</span>
                </div>
              </div>

              <div className="p-3 bg-u-s2 rounded-lg border border-u-line space-y-1">
                <div>Scheduled Date: <span className="font-semibold">{record.scheduledDate}</span></div>
                <div>Completed Date: <span className="font-semibold">{record.completionDate || "Not completed"}</span></div>
                <div>Auditing Inspector: <span className="font-semibold">{record.inspectorName}</span></div>
              </div>
            </>
          )}

          {type === "asset" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-2.5 rounded-lg bg-u-s2 border border-u-line">
                  <span className="text-u-muted block text-[10px]">COMPONENT</span>
                  <span className="font-semibold text-u-ink text-sm">{record.componentName}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-u-s2 border border-u-line">
                  <span className="text-u-muted block text-[10px]">CONDITION</span>
                  <span className="font-semibold text-u-ink text-sm">{record.conditionRating}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-u-s2 border border-u-line">
                  <span className="text-u-muted block text-[10px]">REMAINING USEFUL LIFE</span>
                  <span className="font-semibold text-u-ink text-sm">{record.remainingUsefulLifeYears} years</span>
                </div>
                <div className="p-2.5 rounded-lg bg-u-s2 border border-u-line">
                  <span className="text-u-muted block text-[10px]">REPLACEMENT ESTIMATE</span>
                  <span className="font-semibold text-u-ink text-sm">${record.estimatedReplacementCost?.toLocaleString()}</span>
                </div>
              </div>

              <div className="p-3 bg-u-s2 rounded-lg border border-u-line space-y-1">
                <div>Install Date: <span className="font-semibold">{record.installDate}</span></div>
                <div>Expected Useful Life (EUL): <span className="font-semibold">{record.estimatedUsefulLifeYears} years</span></div>
                <div>Lifetime Repair Count: <span className="font-semibold">{record.repairCount} work orders</span></div>
                <div>Replacement Priority: <span className="font-semibold">{record.replacementPriority}</span></div>
              </div>
            </>
          )}

          {/* Action Trigger */}
          <div className="pt-3 border-t border-u-line flex items-center justify-between">
            <button
              onClick={() => {
                const desc =
                  type === "workOrder"
                    ? `Resolve WO #${record.woNumber} (${record.category})`
                    : type === "inspection"
                    ? `Follow up inspection #${record.refNumber}`
                    : `Address asset risk for ${record.componentName}`;

                openCreateActionModal({
                  propertyId: record.propertyId,
                  issue: desc,
                  relatedRecordType: type === "workOrder" ? "WorkOrder" : type === "inspection" ? "Inspection" : "Asset",
                  relatedRecordId: record.id || record.woNumber || record.refNumber,
                });
                setPreviewRecord(null);
              }}
              className="text-xs px-3 py-1.5 text-u-onaccent bg-u-accent hover:bg-u-accent-strong rounded-lg font-medium transition"
            >
              Create Action Item From This Record
            </button>
            <button
              onClick={() => setPreviewRecord(null)}
              className="text-xs px-3 py-1.5 text-u-ink2 hover:bg-u-s3 rounded-lg"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
