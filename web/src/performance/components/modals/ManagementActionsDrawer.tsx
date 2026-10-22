import React, { useState } from "react";
import { useReportContext } from "../../context/ReportContext";
import {
  X,
  ListTodo,
  Plus,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Calendar,
  User,
  ExternalLink,
} from "lucide-react";

export function ManagementActionsDrawer() {
  const {
    isActionDrawerOpen,
    setIsActionDrawerOpen,
    filteredActions,
    rawData,
    openCreateActionModal,
    updateManagementAction,
  } = useReportContext();

  const [activeTab, setActiveTab] = useState<"All" | "Open" | "In Progress" | "Overdue" | "Completed">("All");
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);
  const [statusUpdate, setStatusUpdate] = useState<string>("");
  const [notesUpdate, setNotesUpdate] = useState<string>("");

  if (!isActionDrawerOpen) return null;

  const today = new Date("2025-02-15"); // deterministic reference date

  const actionsWithOverdueFlag = (filteredActions || []).map((action) => {
    const isOverdue =
      action.status !== "Completed" &&
      action.status !== "Cancelled" &&
      new Date(action.dueDate) < today;
    return { ...action, isOverdue };
  });

  const displayedActions = actionsWithOverdueFlag.filter((action) => {
    if (activeTab === "All") return true;
    if (activeTab === "Overdue") return action.isOverdue;
    return action.status === activeTab;
  });

  const overdueCount = actionsWithOverdueFlag.filter((a) => a.isOverdue).length;

  const handleSaveUpdate = async (id: string) => {
    if (!statusUpdate && !notesUpdate) return;
    await updateManagementAction(id, {
      ...(statusUpdate ? { status: statusUpdate } : {}),
      ...(notesUpdate ? { resolutionNotes: notesUpdate } : {}),
    });
    setSelectedActionId(null);
    setStatusUpdate("");
    setNotesUpdate("");
  };

  return (
    <div className="fixed inset-0 z-[120] overflow-hidden bg-black/40 backdrop-blur-2xs flex justify-end">
      <div className="w-full max-w-xl bg-u-card h-full shadow-2xl flex flex-col border-l border-u-line animate-in slide-in-from-right duration-200">
        {/* Drawer Header */}
        <div className="px-6 py-4 border-b border-u-line flex items-center justify-between bg-u-s2/70">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-u-accent-soft text-u-accent">
              <ListTodo className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-u-ink">Management Action Tracking</h2>
              <p className="text-xs text-u-muted">Track and resolve operational interventions across properties</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => openCreateActionModal()}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-u-onaccent bg-u-accent hover:bg-u-accent-strong rounded-lg transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Action</span>
            </button>
            <button
              onClick={() => setIsActionDrawerOpen(false)}
              className="p-1 rounded-lg text-u-muted hover:text-u-ink2 hover:bg-u-s3"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="px-6 pt-3 pb-2 border-b border-u-line flex items-center gap-2 overflow-x-auto">
          {(["All", "Open", "In Progress", "Overdue", "Completed"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
                activeTab === tab
                  ? "bg-u-ink2 text-u-onaccent"
                  : "bg-u-s3 text-u-ink2 hover:bg-u-line"
              }`}
            >
              <span>{tab}</span>
              {tab === "Overdue" && overdueCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-u-danger text-u-onaccent font-bold">
                  {overdueCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Actions List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {displayedActions.length === 0 ? (
            <div className="text-center py-12 text-u-muted">
              <ListTodo className="w-10 h-10 mx-auto text-u-s3 mb-2" />
              <p className="text-sm font-medium">No actions found for "{activeTab}"</p>
              <p className="text-xs text-u-muted mt-1">Actions created from performance findings appear here.</p>
            </div>
          ) : (
            displayedActions.map((action) => {
              const prop = rawData?.properties.find((p) => p.id === action.propertyId);
              const isSelected = selectedActionId === action.id;

              return (
                <div
                  key={action.id}
                  className={`p-4 rounded-xl border transition ${
                    action.isOverdue
                      ? "border-u-danger/30 bg-u-danger-soft/30"
                      : "border-u-line bg-u-card hover:border-u-line2"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono font-bold text-u-ink2">{action.actionRef}</span>
                        <span className="text-xs font-medium text-u-ink">• {prop?.name || "Property"}</span>
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                            action.priority === "Critical"
                              ? "bg-u-danger-soft text-u-danger"
                              : action.priority === "High"
                              ? "bg-u-warn-soft text-u-warn"
                              : "bg-u-accent-soft text-u-accent"
                          }`}
                        >
                          {action.priority}
                        </span>
                        {action.isOverdue && (
                          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-u-danger text-u-onaccent flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> Overdue
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-medium text-u-ink mt-2">{action.issueDescription}</p>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-u-muted border-t border-u-line pt-2">
                    <div className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-u-muted" />
                      <span>{action.assignedTo}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-u-muted" />
                      <span>Due: {action.dueDate}</span>
                    </div>
                    <div className="flex items-center gap-1.5 col-span-2">
                      <span className="font-medium text-u-muted">Ref:</span>
                      <span className="font-mono text-u-ink2">{action.relatedRecordRef || "N/A"}</span>
                      <span className="text-u-muted">({action.relatedType})</span>
                    </div>
                  </div>

                  {action.resolutionNotes && (
                    <div className="mt-2 p-2 rounded bg-u-s2 text-[11px] text-u-ink2 border border-u-line">
                      <span className="font-semibold text-u-ink2">Notes: </span>
                      {action.resolutionNotes}
                    </div>
                  )}

                  {/* Edit / Status Quick Action Toggle */}
                  <div className="mt-3 flex items-center justify-between pt-2 border-t border-u-line">
                    <span
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                        action.status === "Completed"
                          ? "bg-u-ok-soft text-u-ok"
                          : action.status === "In Progress"
                          ? "bg-u-warn-soft text-u-warn"
                          : "bg-u-s3 text-u-ink2"
                      }`}
                    >
                      {action.status}
                    </span>

                    <button
                      onClick={() => {
                        setSelectedActionId(isSelected ? null : action.id);
                        setStatusUpdate(action.status);
                        setNotesUpdate(action.resolutionNotes || "");
                      }}
                      className="text-xs text-u-accent hover:text-u-accent font-medium"
                    >
                      {isSelected ? "Close Update" : "Update Status"}
                    </button>
                  </div>

                  {isSelected && (
                    <div className="mt-3 p-3 bg-u-s2 rounded-lg border border-u-line space-y-2 animate-in fade-in duration-100">
                      <div>
                        <label className="block text-[11px] font-semibold text-u-ink2 mb-1">Status</label>
                        <select
                          value={statusUpdate}
                          onChange={(e) => setStatusUpdate(e.target.value)}
                          className="w-full text-xs rounded border border-u-line2 p-1.5 bg-u-card"
                        >
                          <option value="Open">Open</option>
                          <option value="In Progress">In Progress</option>
                          <option value="Blocked">Blocked</option>
                          <option value="Completed">Completed</option>
                          <option value="Cancelled">Cancelled</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-u-ink2 mb-1">Resolution Notes</label>
                        <textarea
                          rows={2}
                          value={notesUpdate}
                          onChange={(e) => setNotesUpdate(e.target.value)}
                          placeholder="Add progress note or completion details..."
                          className="w-full text-xs rounded border border-u-line2 p-2 bg-u-card"
                        />
                      </div>
                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          onClick={() => setSelectedActionId(null)}
                          className="px-2.5 py-1 text-xs text-u-ink2 hover:bg-u-line rounded"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleSaveUpdate(action.id)}
                          className="px-3 py-1 text-xs text-u-onaccent bg-u-accent hover:bg-u-accent-strong rounded font-medium"
                        >
                          Save Changes
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
