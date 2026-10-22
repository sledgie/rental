import React, { useState, useEffect } from "react";
import { useReportContext } from "../../context/ReportContext";
import { X, CheckCircle2, AlertCircle } from "lucide-react";

export function ManagementActionModal() {
  const {
    isActionModalOpen,
    closeCreateActionModal,
    actionModalPrefill,
    rawData,
    createManagementAction,
  } = useReportContext();

  const [propertyId, setPropertyId] = useState("");
  const [issueDescription, setIssueDescription] = useState("");
  const [priority, setPriority] = useState<"Critical" | "High" | "Medium" | "Low">("High");
  const [assignedTo, setAssignedTo] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [relatedType, setRelatedType] = useState<string>("Operational");
  const [relatedRecordRef, setRelatedRecordRef] = useState("");
  const [status, setStatus] = useState("Open");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (actionModalPrefill) {
      setPropertyId(actionModalPrefill.propertyId || (rawData?.properties[0]?.id ?? "prop-1"));
      setIssueDescription(actionModalPrefill.issue || actionModalPrefill.issueDescription || "");
      setPriority(actionModalPrefill.severity || actionModalPrefill.priority || "High");
      setAssignedTo(actionModalPrefill.responsiblePerson || actionModalPrefill.assignedTo || "Marcus Vance");
      setDueDate(actionModalPrefill.dueDate || new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10));
      setRelatedType(actionModalPrefill.relatedRecordType || actionModalPrefill.relatedType || "Operational");
      setRelatedRecordRef(actionModalPrefill.relatedRecordId || actionModalPrefill.relatedRecordRef || "N/A");
    } else {
      setPropertyId(rawData?.properties[0]?.id ?? "prop-1");
      setIssueDescription("");
      setPriority("High");
      setAssignedTo("Marcus Vance");
      setDueDate(new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10));
      setRelatedType("Operational");
      setRelatedRecordRef("N/A");
    }
    setFeedback(null);
  }, [actionModalPrefill, rawData, isActionModalOpen]);

  if (!isActionModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!issueDescription.trim()) {
      setFeedback("Please enter an issue description");
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    const success = await createManagementAction({
      propertyId,
      issueDescription,
      priority,
      assignedTo,
      dueDate,
      relatedType,
      relatedRecordRef,
      status,
    });

    setIsSubmitting(false);
    if (!success) {
      setFeedback("Failed to save action item. Please try again.");
    }
  };

  const properties = rawData?.properties || [];
  const managers = rawData?.managers || [];

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="bg-u-card rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-u-line animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-u-line flex items-center justify-between bg-u-s2/70">
          <div>
            <h3 className="text-base font-semibold text-u-ink">Create Management Action</h3>
            <p className="text-xs text-u-muted">Assign an operational task to resolve a performance finding</p>
          </div>
          <button
            onClick={closeCreateActionModal}
            className="p-1 rounded-lg text-u-muted hover:text-u-ink2 hover:bg-u-s3"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {feedback && (
            <div className="p-3 rounded-lg bg-u-danger-soft border border-u-danger/30 text-xs text-u-danger flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{feedback}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-u-ink2 mb-1">Target Property</label>
            <select
              value={propertyId}
              onChange={(e) => setPropertyId(e.target.value)}
              className="w-full text-xs rounded-lg border border-u-line2 bg-u-card px-3 py-2 text-u-ink focus:outline-none focus:ring-2 focus:ring-u-accent/20"
            >
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-u-ink2 mb-1">Issue Description & Next Action</label>
            <textarea
              rows={3}
              value={issueDescription}
              onChange={(e) => setIssueDescription(e.target.value)}
              placeholder="Describe the operational risk, finding, or corrective directive..."
              className="w-full text-xs rounded-lg border border-u-line2 bg-u-card p-3 text-u-ink focus:outline-none focus:ring-2 focus:ring-u-accent/20"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-u-ink2 mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="w-full text-xs rounded-lg border border-u-line2 bg-u-card px-3 py-2 text-u-ink"
              >
                <option value="Critical">Critical (Immediate)</option>
                <option value="High">High (Urgent)</option>
                <option value="Medium">Medium (Standard)</option>
                <option value="Low">Low (Routine)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-u-ink2 mb-1">Assigned Person</label>
              <select
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                className="w-full text-xs rounded-lg border border-u-line2 bg-u-card px-3 py-2 text-u-ink"
              >
                {managers.map((m) => (
                  <option key={m.id} value={m.name}>
                    {m.name} ({m.role.split(" ")[0]})
                  </option>
                ))}
                <option value="Carlos Mendez">Carlos Mendez (Lead Tech)</option>
                <option value="Mike Higgins">Mike Higgins (Tech)</option>
                <option value="Brad Thorne">Brad Thorne (Tech)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-u-ink2 mb-1">Target Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full text-xs rounded-lg border border-u-line2 bg-u-card px-3 py-2 text-u-ink"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-u-ink2 mb-1">Related Record Ref</label>
              <input
                type="text"
                value={relatedRecordRef}
                onChange={(e) => setRelatedRecordRef(e.target.value)}
                placeholder="e.g. WO-2025-0501 or INSP-007"
                className="w-full text-xs rounded-lg border border-u-line2 bg-u-card px-3 py-2 text-u-ink"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-u-line flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={closeCreateActionModal}
              className="px-4 py-2 text-xs font-medium text-u-ink2 hover:text-u-ink rounded-lg hover:bg-u-s3 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-u-onaccent bg-u-accent hover:bg-u-accent-strong rounded-lg shadow-xs transition disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSubmitting ? "Saving..." : "Create Action Item"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
