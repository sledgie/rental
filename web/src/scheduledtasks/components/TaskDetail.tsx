import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, History, MessageSquare, Paperclip, Pencil, Plus, RotateCcw, Repeat, Trash2, XOctagon } from "lucide-react";
import { Overlay } from "../../tenants/components/ui";
import { openDocument, fileSize } from "../../lib/documents";
import { STATUSES, isOpen, type Caps, type Category, type Lookups, type Person, type Series, type Status, type Task, type TaskDetail } from "../types";
import { describe } from "../recurrence";
import * as repo from "../repo";
import { Empty, Initials, PriorityBadge, StatusBadge, cx, formatDate, formatDateTime, formatDays, isOverdue, localDate, timeAgo } from "./ui";

interface Props {
  task: Task;
  orgId: string;
  meId: string;
  caps: Caps;
  categories: Category[];
  people: Person[];
  lookups: Lookups;
  series: Series | undefined;
  onClose: () => void;
  onEdit: () => void;
  onChanged: () => Promise<void> | void;
  onDeleted: () => void;
  notify: (message: string) => void;
}

const named = (list: { id: string; name: string }[], id: string | null) => (id ? list.find((x) => x.id === id)?.name ?? null : null);

/** One task: details, checklist, comments, files, reminders and history. */
export default function TaskDetailDrawer({ task, orgId, meId, caps, categories, people, lookups, series, onClose, onEdit, onChanged, onDeleted, notify }: Props) {
  const [detail, setDetail] = useState<TaskDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [comment, setComment] = useState("");
  const [item, setItem] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState("");
  const [completing, setCompleting] = useState(false);
  const [notes, setNotes] = useState(task.completionNotes);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  const reload = useCallback(async () => {
    try { setDetail(await repo.loadDetail(orgId, task.id)); setError(null); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to load the task."); }
  }, [orgId, task.id]);
  useEffect(() => { void reload(); }, [reload, task.updatedAt]);

  const who = (id: string | null) => (id ? people.find((p) => p.id === id)?.name ?? "Former member" : "System");
  const open = isOpen(task.status);
  const mine = task.assigneeId === meId || task.createdBy === meId;
  const canEditTask = caps.manage && (caps.viewAll || mine || task.collaboratorIds.includes(meId));

  async function run(action: () => Promise<unknown>, done?: string) {
    setBusy(true); setError(null);
    try { await action(); await onChanged(); await reload(); if (done) notify(done); }
    catch (e) { setError(e instanceof Error ? e.message : "Something went wrong."); }
    finally { setBusy(false); }
  }

  const category = categories.find((c) => c.id === task.categoryId);
  const links: [string, string | null][] = [
    ["Property", named(lookups.properties, task.propertyId)], ["Unit", named(lookups.units, task.unitId)], ["Tenant", named(lookups.tenants, task.tenantId)],
    ["Lease", named(lookups.leases, task.leaseId)], ["Maintenance request", named(lookups.maintenance, task.maintenanceRequestId)], ["Vendor", named(lookups.vendors, task.vendorId)],
    ["Project", named(lookups.projects, task.projectId)],
  ];
  const done = detail?.checklist.filter((c) => c.done).length ?? 0;
  const total = detail?.checklist.length ?? 0;

  return (
    <Overlay title={task.title} subtitle={`${task.ref}${task.isRecurring ? " · recurring" : ""}`} drawer wide onClose={onClose} className="st-drawer">
      <div className="u-drawer-scroll"><div className="u-root st space-y-4">
        {error && <div role="alert" className="rounded-lg border border-u-danger/30 bg-u-danger-soft px-3 py-2 text-sm text-u-danger">{error}</div>}

        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={task.status} /><PriorityBadge priority={task.priority} />
          {isOverdue(task) && <span className="rounded-full bg-u-danger-soft px-2 py-0.5 text-[10.5px] font-bold text-u-danger">OVERDUE</span>}
          {category && <span className="inline-flex items-center gap-1.5 text-xs font-medium text-u-ink2"><span className="size-2 rounded-full" style={{ backgroundColor: category.color }} />{category.name}</span>}
        </div>
        {task.description ? <p className="whitespace-pre-wrap text-sm leading-relaxed text-u-ink2">{task.description}</p> : <p className="text-sm text-u-muted">No description.</p>}

        <div className="flex flex-wrap gap-2">
          {canEditTask && <button type="button" className="st-btn" onClick={onEdit}><Pencil size={14} />Edit</button>}
          {canEditTask && open && <button type="button" className="st-btn st-btn-primary" disabled={busy} onClick={() => setCompleting(true)}><CheckCircle2 size={14} />Complete</button>}
          {canEditTask && open && (
            <select aria-label="Change status" className="st-input !w-auto !min-h-[34px] !py-0 text-xs font-semibold" value={task.status} disabled={busy}
              onChange={(e) => void run(() => repo.setStatus(task.id, e.target.value as Status), "Status updated.")}>
              {STATUSES.filter((s) => isOpen(s.value)).map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          )}
          {caps.series && open && <button type="button" className="st-btn st-btn-danger" disabled={busy} onClick={() => setCancelling(true)}><XOctagon size={14} />Cancel task</button>}
          {canEditTask && !open && <button type="button" className="st-btn" disabled={busy} onClick={() => void run(() => repo.reopenTask(task.id), "Task reopened.")}><RotateCcw size={14} />Reopen</button>}
          {caps.series && <button type="button" className="st-btn st-btn-danger" disabled={busy} onClick={() => setConfirmDelete(true)}><Trash2 size={14} />Delete</button>}
        </div>

        {completing && (
          <div className="rounded-xl border border-u-ok/30 bg-u-ok-soft p-3">
            <label htmlFor="st-complete-notes" className="mb-1.5 block text-xs font-semibold text-u-ink2">Completion notes (optional)</label>
            <textarea id="st-complete-notes" className="st-input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What was done…" />
            <div className="mt-2 flex gap-2">
              <button type="button" className="st-btn st-btn-primary" disabled={busy} onClick={() => void run(() => repo.completeTask(task.id, notes.trim() || undefined), "Task completed.").then(() => setCompleting(false))}>Mark complete</button>
              <button type="button" className="st-btn" onClick={() => setCompleting(false)}>Back</button>
            </div>
          </div>
        )}
        {cancelling && (
          <div className="rounded-xl border border-u-danger/30 bg-u-danger-soft p-3">
            <label htmlFor="st-cancel-reason" className="mb-1.5 block text-xs font-semibold text-u-ink2">Reason for cancelling</label>
            <input id="st-cancel-reason" className="st-input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why is this task no longer needed?" />
            <div className="mt-2 flex gap-2">
              <button type="button" className="st-btn st-btn-danger" disabled={busy || !reason.trim()} onClick={() => void run(() => repo.cancelTask(task.id, reason.trim()), "Task cancelled.").then(() => setCancelling(false))}>Confirm cancel</button>
              <button type="button" className="st-btn" onClick={() => setCancelling(false)}>Back</button>
            </div>
          </div>
        )}
        {confirmDelete && (
          <div className="rounded-xl border border-u-danger/30 bg-u-danger-soft p-3 text-sm text-u-ink2">
            <p>Delete <strong className="text-u-ink">{task.ref}</strong> permanently, with its checklist, comments and history? This cannot be undone.</p>
            <div className="mt-2 flex gap-2">
              <button type="button" className="st-btn st-btn-danger" disabled={busy} onClick={() => void run(async () => { await repo.deleteTask(task.id); onDeleted(); })}>Delete task</button>
              <button type="button" className="st-btn" onClick={() => setConfirmDelete(false)}>Keep it</button>
            </div>
          </div>
        )}
        {task.cancelReason && task.status === "cancelled" && <p className="rounded-lg bg-u-s2 px-3 py-2 text-xs text-u-ink2"><strong className="text-u-ink">Cancelled:</strong> {task.cancelReason}</p>}
        {task.completionNotes && <p className="rounded-lg bg-u-ok-soft px-3 py-2 text-xs text-u-ink2"><strong className="text-u-ok">Completion notes:</strong> {task.completionNotes}</p>}

        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl border border-u-line bg-u-s2/50 p-4 text-xs sm:grid-cols-3">
          <div><dt className="text-u-muted">Assigned to</dt><dd className="mt-0.5 flex items-center gap-1.5 font-medium text-u-ink">{task.assigneeId ? <><Initials name={who(task.assigneeId)} size={20} />{who(task.assigneeId)}</> : "Unassigned"}</dd></div>
          <div><dt className="text-u-muted">Due</dt><dd className={cx("mt-0.5 font-medium", isOverdue(task) ? "text-u-danger" : "text-u-ink")}>{formatDate(task.dueDate)}{task.dueTime ? ` · ${task.dueTime}` : ""}</dd></div>
          <div><dt className="text-u-muted">Start</dt><dd className="mt-0.5 font-medium text-u-ink">{formatDate(task.startDate)}</dd></div>
          {links.filter(([, v]) => v).map(([k, v]) => <div key={k}><dt className="text-u-muted">{k}</dt><dd className="mt-0.5 font-medium text-u-ink">{v}</dd></div>)}
          {task.collaboratorIds.length > 0 && <div className="col-span-2"><dt className="text-u-muted">Collaborators</dt><dd className="mt-0.5 font-medium text-u-ink">{task.collaboratorIds.map(who).join(", ")}</dd></div>}
          <div><dt className="text-u-muted">Created</dt><dd className="mt-0.5 font-medium text-u-ink">{who(task.createdBy)} · {formatDate(localDate(task.createdAt))}</dd></div>
        </dl>

        {series && (
          <div className="flex items-start gap-2.5 rounded-xl border border-u-line px-3.5 py-3 text-xs text-u-ink2">
            <Repeat size={15} className="mt-0.5 shrink-0 text-u-accent" />
            <p><strong className="text-u-ink">{describe(series)}</strong> · series is {series.status}{series.nextOccurrenceDate ? ` · next ${formatDate(series.nextOccurrenceDate)}` : ""}. Manage it from the Recurring series tab.</p>
          </div>
        )}

        <section className="rounded-xl border border-u-line p-4">
          <div className="flex items-center justify-between"><h3 className="text-sm font-semibold text-u-ink">Checklist</h3><span className="text-xs text-u-muted">{done}/{total} done</span></div>
          {total > 0 && <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-u-s3"><div className="h-full rounded-full bg-u-ok transition-all" style={{ width: `${(done / total) * 100}%` }} /></div>}
          <ul className="mt-3 space-y-1.5">
            {detail?.checklist.map((c) => (
              <li key={c.id} className="flex items-center gap-2">
                <button type="button" disabled={busy || !canEditTask || !open} onClick={() => void run(() => repo.toggleChecklistItem(c.id, !c.done))} aria-pressed={c.done}
                  className={cx("flex min-w-0 flex-1 items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-sm disabled:cursor-default", c.done ? "border-u-ok/30 bg-u-ok-soft text-u-muted line-through" : "border-u-line text-u-ink hover:bg-u-s2")}>
                  <span className={cx("flex size-5 shrink-0 items-center justify-center rounded-md border text-xs", c.done ? "border-u-ok bg-u-ok text-u-bg" : "border-u-line2")}>{c.done ? "✓" : ""}</span>
                  <span className="truncate">{c.title}</span>
                </button>
                {canEditTask && open && <button type="button" aria-label={`Remove ${c.title}`} className="text-u-muted hover:text-u-danger" onClick={() => void run(() => repo.removeChecklistItem(c.id))}><Trash2 size={14} /></button>}
              </li>
            ))}
            {detail && !total && <li className="text-xs text-u-muted">No checklist items.</li>}
          </ul>
          {canEditTask && open && (
            <div className="mt-3 flex gap-2">
              <input aria-label="New checklist item" className="st-input" value={item} placeholder="Add an item…" onChange={(e) => setItem(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && item.trim()) { e.preventDefault(); const t = item; setItem(""); void run(() => repo.addChecklistItem(orgId, task.id, t, total)); } }} />
              <button type="button" className="st-btn st-btn-primary" aria-label="Add item" disabled={!item.trim() || busy} onClick={() => { const t = item; setItem(""); void run(() => repo.addChecklistItem(orgId, task.id, t, total)); }}><Plus size={15} /></button>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-u-line p-4">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-u-ink"><MessageSquare size={15} />Comments ({detail?.comments.length ?? 0})</h3>
          <ul className="mt-3 space-y-3">
            {detail?.comments.map((c) => (
              <li key={c.id} className="flex gap-2.5"><Initials name={who(c.authorId)} />
                <div className="min-w-0 flex-1 rounded-xl bg-u-s2 px-3 py-2"><p className="text-xs"><strong className="text-u-ink">{who(c.authorId)}</strong> <span className="text-u-muted">· {timeAgo(c.createdAt)}</span></p><p className="mt-0.5 whitespace-pre-wrap text-sm text-u-ink2">{c.body}</p></div></li>
            ))}
            {detail && !detail.comments.length && <li className="text-xs text-u-muted">No comments yet.</li>}
          </ul>
          <div className="mt-3 flex gap-2">
            <input aria-label="Write a comment" className="st-input" value={comment} placeholder="Write a comment…" onChange={(e) => setComment(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && comment.trim()) { e.preventDefault(); const t = comment; setComment(""); void run(() => repo.addComment(orgId, task.id, meId, t)); } }} />
            <button type="button" className="st-btn st-btn-primary" disabled={!comment.trim() || busy} onClick={() => { const t = comment; setComment(""); void run(() => repo.addComment(orgId, task.id, meId, t)); }}>Post</button>
          </div>
        </section>

        <section className="rounded-xl border border-u-line p-4">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-u-ink"><Paperclip size={15} />Files ({detail?.files.length ?? 0})</h3>
          <ul className="mt-3 space-y-1.5">
            {detail?.files.map((f) => (
              <li key={f.id} className="flex items-center gap-2.5 rounded-lg border border-u-line px-3 py-2 text-sm">
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => void openDocument(f.bucket, f.path).catch((e) => setError(e instanceof Error ? e.message : "Unable to open the file."))}>
                  <span className="block truncate font-medium text-u-ink hover:underline">{f.name}</span><span className="text-[11px] text-u-muted">{fileSize(f.sizeBytes)} · {formatDate(localDate(f.uploadedAt))}</span>
                </button>
                {canEditTask && <button type="button" aria-label={`Remove ${f.name}`} className="text-u-muted hover:text-u-danger" onClick={() => void run(() => repo.removeFile(f.id), "File removed.")}><Trash2 size={14} /></button>}
              </li>
            ))}
            {detail && !detail.files.length && <li className="text-xs text-u-muted">No files. Files are stored in Document Center.</li>}
          </ul>
          {canEditTask && (
            <>
              <input ref={file} type="file" className="sr-only" aria-label="Attach a file" onChange={(e) => { const picked = e.target.files?.[0]; e.target.value = ""; if (picked) void run(() => repo.attachFile(orgId, { id: task.id, ref: task.ref }, meId, picked), "File attached."); }} />
              <button type="button" className="st-btn mt-3" disabled={busy} onClick={() => file.current?.click()}><Paperclip size={14} />Attach a file</button>
            </>
          )}
        </section>

        {detail && detail.reminders.length > 0 && (
          <section className="rounded-xl border border-u-line p-4">
            <h3 className="text-sm font-semibold text-u-ink">Reminders</h3>
            <ul className="mt-2 space-y-1 text-xs text-u-ink2">
              {detail.reminders.map((r) => <li key={r.id} className="flex justify-between gap-2"><span>{formatDateTime(r.remindAt)} · {r.channel === "in_app" ? "in the app" : r.channel}</span><span className="text-u-muted">{r.status}</span></li>)}
            </ul>
            <p className="mt-2 text-[11px] text-u-muted">{task.reminder.enabled ? `Reminds ${task.reminder.daysBefore.map(formatDays).join(", ")}.` : "Reminders are off for this task."}</p>
          </section>
        )}

        <section className="rounded-xl border border-u-line p-4">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-u-ink"><History size={15} />History</h3>
          <ol className="mt-3 space-y-2.5 border-l border-u-line pl-4">
            {detail?.activities.map((a) => (
              <li key={a.id} className="relative"><span className="absolute -left-[21px] top-1.5 size-2 rounded-full bg-u-accent" /><p className="text-xs text-u-ink">{a.summary}</p><p className="text-[10.5px] text-u-muted">{a.actorId ? who(a.actorId) : "System"} · {formatDateTime(a.createdAt)}</p></li>
            ))}
            {detail && !detail.activities.length && <li className="text-xs text-u-muted">No history yet.</li>}
          </ol>
        </section>
        {!detail && !error && <Empty title="Loading task…" />}
      </div></div>
    </Overlay>
  );
}
