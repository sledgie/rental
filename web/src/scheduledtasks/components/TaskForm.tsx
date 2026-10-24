import { useMemo, useState } from "react";
import { Plus, Repeat, Trash2 } from "lucide-react";
import { Overlay } from "../../tenants/components/ui";
import { PRIORITIES, STATUSES, isOpen, type Caps, type Category, type Frequency, type Lookups, type Person, type Task, type TaskInput } from "../types";
import { describe, upcoming } from "../recurrence";
import { Field, cx, formatDate, today } from "./ui";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function emptyInput(assigneeId: string): TaskInput {
  const d = today();
  return {
    title: "", description: "", categoryId: "", priority: "normal", status: "not_started", propertyId: "", unitId: "", tenantId: "", leaseId: "", maintenanceRequestId: "",
    vendorId: "", projectId: "", assigneeId, startDate: d, dueDate: d, dueTime: "", completionNotes: "", reminderEnabled: true, reminderDays: 1, checklist: [], recurrence: null,
  };
}
export function inputFromTask(t: Task): TaskInput {
  return {
    title: t.title, description: t.description, categoryId: t.categoryId ?? "", priority: t.priority, status: t.status, propertyId: t.propertyId ?? "", unitId: t.unitId ?? "",
    tenantId: t.tenantId ?? "", leaseId: t.leaseId ?? "", maintenanceRequestId: t.maintenanceRequestId ?? "", vendorId: t.vendorId ?? "", projectId: t.projectId ?? "",
    assigneeId: t.assigneeId ?? "", startDate: t.startDate ?? "", dueDate: t.dueDate ?? "", dueTime: t.dueTime ?? "", completionNotes: t.completionNotes,
    reminderEnabled: t.reminder.enabled, reminderDays: t.reminder.daysBefore[0] ?? 1, checklist: [], recurrence: null,
  };
}

interface Props {
  task: Task | null;
  caps: Caps;
  meId: string;
  categories: Category[];
  people: Person[];
  lookups: Lookups;
  onClose: () => void;
  onSave: (input: TaskInput, scope: "single" | "future" | "all") => Promise<void>;
}

/** Create / edit drawer. Editing a task that belongs to a recurring series asks which occurrences the change applies to. */
export default function TaskForm({ task, caps, meId, categories, people, lookups, onClose, onSave }: Props) {
  const editing = !!task;
  const [f, setF] = useState<TaskInput>(() => (task ? inputFromTask(task) : emptyInput(meId)));
  const [repeat, setRepeat] = useState(false);
  const [rec, setRec] = useState<{ frequency: Frequency; interval: number; daysOfWeek: number[]; monthMode: "day" | "relative"; monthDay: number; monthWeek: number; monthWeekday: number; endDate: string }>(
    { frequency: "weekly", interval: 1, daysOfWeek: [1], monthMode: "day", monthDay: 1, monthWeek: 1, monthWeekday: 1, endDate: "" });
  const [newItem, setNewItem] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [askScope, setAskScope] = useState(false);
  const [scope, setScope] = useState<"single" | "future" | "all">("single");
  const terminal = task ? !isOpen(task.status) : false;
  const set = <K extends keyof TaskInput>(k: K, v: TaskInput[K]) => setF((p) => ({ ...p, [k]: v }));
  const frequency = rec.frequency;

  const units = useMemo(() => (f.propertyId ? lookups.units.filter((u) => u.propertyId === f.propertyId) : lookups.units), [lookups.units, f.propertyId]);
  const previewRule = useMemo(() => repeat && f.dueDate ? ({
    frequency, interval: rec.interval, daysOfWeek: rec.daysOfWeek, monthDay: frequency === "monthly" && rec.monthMode === "day" ? rec.monthDay : null,
    monthWeek: frequency === "monthly" && rec.monthMode === "relative" ? rec.monthWeek : null, monthWeekday: frequency === "monthly" && rec.monthMode === "relative" ? rec.monthWeekday : null,
    startDate: f.dueDate, endDate: rec.endDate || null,
  }) : null, [repeat, f.dueDate, rec, frequency]);

  async function submit(chosen: "single" | "future" | "all") {
    setError(null);
    if (!f.title.trim()) return setError("Task title is required.");
    if (!repeat && !f.dueDate) return setError("Due date is required for one-time tasks.");
    if (repeat && !f.dueDate) return setError("Choose the first due date of the series.");
    if (f.startDate && f.dueDate && f.dueDate < f.startDate) return setError("Due date cannot be earlier than start date.");
    if (repeat && (frequency === "weekly" || frequency === "custom") && !rec.daysOfWeek.length) return setError("Pick at least one weekday.");
    if (task?.recurrenceId && chosen === "single" && !askScope) { setAskScope(true); return; }
    setSaving(true);
    try {
      await onSave({ ...f, recurrence: repeat && !editing ? rec : null }, chosen);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save the task.");
      setSaving(false);
    }
  }

  const addItem = () => { const v = newItem.trim(); if (v) { set("checklist", [...f.checklist, v]); setNewItem(""); } };
  const lockedAssign = !caps.assign;

  return (
    <Overlay title={editing ? "Edit task" : "Create task"} subtitle={editing ? `Ref ${task!.ref}` : "Assignment, schedule, checklist and reminders"} drawer wide onClose={onClose} className="st-drawer">
      <form onSubmit={(e) => { e.preventDefault(); void submit(scope); }} className="flex min-h-0 flex-1 flex-col">
        <div className="u-drawer-scroll"><div className="u-root st space-y-5">
          {error && <div role="alert" className="rounded-lg border border-u-danger/30 bg-u-danger-soft px-3 py-2 text-sm text-u-danger">{error}</div>}
          {terminal && <div className="rounded-lg border border-u-warn/30 bg-u-warn-soft px-3 py-2 text-xs text-u-warn">This task is {task!.status}. Its history is preserved: only the completion notes can change. Reopen it to edit the rest.</div>}

          {askScope && task?.recurrenceId && (
            <div className="rounded-xl border border-u-warn/40 bg-u-warn-soft p-4">
              <p className="text-sm font-semibold text-u-ink">This task is part of a recurring series. Apply the changes to:</p>
              <div className="mt-2 space-y-1.5">
                {([["single", "This occurrence only", "Dates and everything else change on this task only."],
                   ["future", "This and later open occurrences", caps.series ? "Completed and cancelled ones are never changed. Dates stay as they are." : "Needs the series manager permission."],
                   ["all", "Every open occurrence of the series", caps.series ? "Also updates the series template used for new occurrences." : "Needs the series manager permission."]] as const).map(([v, label, hint]) => (
                  <label key={v} className={cx("flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2 text-sm", scope === v ? "border-u-accent bg-u-card" : "border-u-line bg-u-card/60", v !== "single" && !caps.series && "opacity-50")}>
                    <input type="radio" name="scope" checked={scope === v} disabled={v !== "single" && !caps.series} onChange={() => setScope(v)} className="mt-1" />
                    <span><span className="block font-semibold text-u-ink">{label}</span><span className="block text-xs text-u-muted">{hint}</span></span>
                  </label>
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                <button type="button" className="st-btn st-btn-primary" disabled={saving} onClick={() => void submit(scope)}>{saving ? "Saving…" : "Apply"}</button>
                <button type="button" className="st-btn" onClick={() => setAskScope(false)}>Back</button>
              </div>
            </div>
          )}

          <fieldset disabled={terminal} className="space-y-4 border-0 p-0">
            <Field label="Task title" htmlFor="st-title" required>
              <input id="st-title" className="st-input" value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Quarterly fire extinguisher inspection" data-autofocus />
            </Field>
            <Field label="Description" htmlFor="st-desc">
              <textarea id="st-desc" className="st-input" rows={3} value={f.description} onChange={(e) => set("description", e.target.value)} placeholder="Scope, acceptance criteria, access notes…" />
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="Category" htmlFor="st-cat">
                <select id="st-cat" className="st-input" value={f.categoryId} onChange={(e) => set("categoryId", e.target.value)}>
                  <option value="">None</option>{categories.filter((c) => c.isActive || c.id === f.categoryId).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
              <Field label="Priority" htmlFor="st-prio">
                <select id="st-prio" className="st-input" value={f.priority} onChange={(e) => set("priority", e.target.value as TaskInput["priority"])}>{PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</select>
              </Field>
              {!editing && (
                <Field label="Status" htmlFor="st-status">
                  <select id="st-status" className="st-input" value={f.status} onChange={(e) => set("status", e.target.value as TaskInput["status"])}>
                    {STATUSES.filter((s) => isOpen(s.value)).map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </Field>
              )}
            </div>

            <section className="rounded-xl border border-u-line bg-u-s2/60 p-4">
              <p className="mb-3 text-[10.5px] font-bold uppercase tracking-[0.08em] text-u-muted">Assignment & schedule</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Assigned to" htmlFor="st-assignee" required hint={lockedAssign ? "Your role can only assign tasks to yourself." : undefined}>
                  <select id="st-assignee" className="st-input" value={f.assigneeId} onChange={(e) => set("assigneeId", e.target.value)}>
                    <option value="">Unassigned</option>
                    {people.map((p) => <option key={p.id} value={p.id} disabled={lockedAssign && p.id !== meId}>{p.name}{p.id === meId ? " (you)" : ""}</option>)}
                  </select>
                </Field>
                <Field label="Due time (optional)" htmlFor="st-time"><input id="st-time" type="time" className="st-input" value={f.dueTime} onChange={(e) => set("dueTime", e.target.value)} /></Field>
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <Field label="Start date" htmlFor="st-start"><input id="st-start" type="date" className="st-input" value={f.startDate} onChange={(e) => set("startDate", e.target.value)} /></Field>
                <Field label={repeat ? "First due date" : "Due date"} htmlFor="st-due" required><input id="st-due" type="date" className="st-input" value={f.dueDate} min={f.startDate || undefined} onChange={(e) => set("dueDate", e.target.value)} /></Field>
                <Field label="Reminder" htmlFor="st-remind" hint="Delivered in the app (a notification).">
                  <div className="flex items-center gap-2">
                    <input type="checkbox" aria-label="Send a reminder" checked={f.reminderEnabled} onChange={(e) => set("reminderEnabled", e.target.checked)} />
                    <select id="st-remind" className="st-input" value={f.reminderDays} disabled={!f.reminderEnabled} onChange={(e) => set("reminderDays", Number(e.target.value))}>
                      <option value={0}>On the due date</option><option value={1}>1 day before</option><option value={3}>3 days before</option><option value={7}>7 days before</option>
                    </select>
                  </div>
                </Field>
              </div>
            </section>

            <section className="rounded-xl border border-u-line bg-u-s2/60 p-4">
              <p className="mb-3 text-[10.5px] font-bold uppercase tracking-[0.08em] text-u-muted">Linked records</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Property" htmlFor="st-prop"><select id="st-prop" className="st-input" value={f.propertyId} onChange={(e) => { set("propertyId", e.target.value); set("unitId", ""); }}>
                  <option value="">None</option>{lookups.properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
                <Field label="Unit" htmlFor="st-unit"><select id="st-unit" className="st-input" value={f.unitId} onChange={(e) => set("unitId", e.target.value)}>
                  <option value="">None</option>{units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></Field>
                <Field label="Tenant" htmlFor="st-tenant"><select id="st-tenant" className="st-input" value={f.tenantId} onChange={(e) => set("tenantId", e.target.value)}>
                  <option value="">None</option>{lookups.tenants.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Field>
                <Field label="Lease" htmlFor="st-lease"><select id="st-lease" className="st-input" value={f.leaseId} onChange={(e) => set("leaseId", e.target.value)}>
                  <option value="">None</option>{lookups.leases.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></Field>
                <Field label="Maintenance request" htmlFor="st-mr"><select id="st-mr" className="st-input" value={f.maintenanceRequestId} onChange={(e) => set("maintenanceRequestId", e.target.value)}>
                  <option value="">None</option>{lookups.maintenance.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></Field>
                <Field label="Vendor" htmlFor="st-vendor"><select id="st-vendor" className="st-input" value={f.vendorId} onChange={(e) => set("vendorId", e.target.value)}>
                  <option value="">None</option>{lookups.vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</select></Field>
                <Field label="Project" htmlFor="st-project" className="sm:col-span-2"><select id="st-project" className="st-input" value={f.projectId} onChange={(e) => set("projectId", e.target.value)}>
                  <option value="">None</option>{lookups.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
              </div>
            </section>

            {!editing && (
              <section className="rounded-xl border border-u-line p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.08em] text-u-muted"><Repeat size={13} /> Recurring schedule</p>
                  <label className={cx("flex items-center gap-2 text-sm text-u-ink2", !caps.series && "opacity-50")}>
                    <input type="checkbox" checked={repeat} disabled={!caps.series} onChange={(e) => setRepeat(e.target.checked)} /> Repeat this task
                  </label>
                </div>
                {!caps.series && <p className="mt-1 text-[11px] text-u-muted">Your role cannot create recurring series.</p>}
                {repeat && (
                  <div className="mt-3 grid gap-4 sm:grid-cols-2">
                    <Field label="Frequency" htmlFor="st-freq"><select id="st-freq" className="st-input" value={rec.frequency} onChange={(e) => setRec({ ...rec, frequency: e.target.value as Frequency })}>
                      {["daily", "weekly", "monthly", "quarterly", "yearly", "custom"].map((x) => <option key={x} value={x}>{x[0].toUpperCase() + x.slice(1)}</option>)}</select></Field>
                    <Field label="Every" htmlFor="st-int"><input id="st-int" type="number" min={1} max={52} className="st-input" value={rec.interval} onChange={(e) => setRec({ ...rec, interval: Math.max(1, Number(e.target.value) || 1) })} /></Field>
                    {(frequency === "weekly" || frequency === "custom") && (
                      <div className="sm:col-span-2">
                        <span className="mb-1.5 block text-[12px] font-semibold text-u-ink2">Days of the week</span>
                        <div className="flex flex-wrap gap-1.5">
                          {DAYS.map((d, i) => <button key={d} type="button" className="st-chip" aria-pressed={rec.daysOfWeek.includes(i)} onClick={() => setRec({ ...rec, daysOfWeek: rec.daysOfWeek.includes(i) ? rec.daysOfWeek.filter((x) => x !== i) : [...rec.daysOfWeek, i] })}>{d}</button>)}
                        </div>
                      </div>
                    )}
                    {frequency === "monthly" && (
                      <div className="space-y-2 sm:col-span-2">
                        <div className="flex gap-2">
                          <button type="button" className="st-chip" aria-pressed={rec.monthMode === "day"} onClick={() => setRec({ ...rec, monthMode: "day" })}>Day of the month</button>
                          <button type="button" className="st-chip" aria-pressed={rec.monthMode === "relative"} onClick={() => setRec({ ...rec, monthMode: "relative" })}>Relative (2nd Monday…)</button>
                        </div>
                        {rec.monthMode === "day" ? <input aria-label="Day of the month" type="number" min={1} max={31} className="st-input" value={rec.monthDay} onChange={(e) => setRec({ ...rec, monthDay: Math.min(31, Math.max(1, Number(e.target.value) || 1)) })} /> : (
                          <div className="grid grid-cols-2 gap-2">
                            <select aria-label="Which week" className="st-input" value={rec.monthWeek} onChange={(e) => setRec({ ...rec, monthWeek: Number(e.target.value) })}><option value={1}>First</option><option value={2}>Second</option><option value={3}>Third</option><option value={4}>Fourth</option><option value={-1}>Last</option></select>
                            <select aria-label="Which weekday" className="st-input" value={rec.monthWeekday} onChange={(e) => setRec({ ...rec, monthWeekday: Number(e.target.value) })}>{DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}</select>
                          </div>
                        )}
                      </div>
                    )}
                    <Field label="End date (optional)" htmlFor="st-end"><input id="st-end" type="date" className="st-input" value={rec.endDate} onChange={(e) => setRec({ ...rec, endDate: e.target.value })} /></Field>
                    {previewRule && (
                      <div className="rounded-lg bg-u-s2 px-3 py-2 text-xs text-u-ink2 sm:col-span-2">
                        <p className="font-semibold text-u-ink">{describe(previewRule)}</p>
                        <p className="mt-0.5 text-u-muted">Starts {formatDate(f.dueDate)}; then {upcoming(previewRule, f.dueDate, 3).map(formatDate).join(", ") || "no further dates"}.</p>
                      </div>
                    )}
                    <p className="text-[11px] text-u-muted sm:col-span-2">Each occurrence has its own status, assignee, comments and history. Five upcoming occurrences are created now; more are added when the schedule runs.</p>
                  </div>
                )}
              </section>
            )}

            {!editing && (
              <section className="rounded-xl border border-u-line p-4">
                <p className="mb-2 text-[10.5px] font-bold uppercase tracking-[0.08em] text-u-muted">Checklist</p>
                <div className="flex gap-2">
                  <input aria-label="New checklist item" className="st-input" value={newItem} placeholder="Add a checklist item…" onChange={(e) => setNewItem(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addItem(); } }} />
                  <button type="button" className="st-btn st-btn-primary" onClick={addItem} aria-label="Add item"><Plus size={15} /></button>
                </div>
                <ul className="mt-2 space-y-1.5">
                  {f.checklist.map((c, i) => (
                    <li key={i} className="flex items-center justify-between rounded-lg bg-u-s2 px-3 py-1.5 text-sm text-u-ink"><span>☐ {c}</span>
                      <button type="button" aria-label={`Remove ${c}`} onClick={() => set("checklist", f.checklist.filter((_, j) => j !== i))} className="text-u-muted hover:text-u-danger"><Trash2 size={14} /></button></li>
                  ))}
                </ul>
              </section>
            )}
          </fieldset>

          {editing && (
            <Field label="Completion notes" htmlFor="st-notes"><textarea id="st-notes" className="st-input" rows={2} value={f.completionNotes} onChange={(e) => set("completionNotes", e.target.value)} placeholder="What was done…" /></Field>
          )}
        </div></div>
        <div className="u-root st">
          <div className="flex justify-end gap-2 border-t border-u-line px-5 py-3">
            <button type="button" className="st-btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="st-btn st-btn-primary" disabled={saving}>{saving ? "Saving…" : editing ? "Save changes" : repeat ? "Create series" : "Create task"}</button>
          </div>
        </div>
      </form>
    </Overlay>
  );
}
