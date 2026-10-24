import { useState } from "react";
import { Pause, Play, RefreshCw, Repeat, XOctagon } from "lucide-react";
import type { Caps, Series, Task } from "../types";
import { describe } from "../recurrence";
import { Empty, StatusBadge, cx, formatDate } from "./ui";

const TONE: Record<string, string> = { active: "bg-u-ok-soft text-u-ok", paused: "bg-u-warn-soft text-u-warn", cancelled: "bg-u-s3 text-u-muted", completed: "bg-u-s3 text-u-muted" };

/** Recurring series: every series with its schedule, next date and occurrences, plus pause / resume / generate / cancel. */
export default function SeriesTab({ series, tasks, caps, busy, onAction, onRunSchedule, onOpen }: {
  series: Series[];
  tasks: Task[];
  caps: Caps;
  busy: boolean;
  onAction: (id: string, action: "pause" | "resume" | "cancel" | "generate") => void;
  onRunSchedule: () => void;
  onOpen: (taskId: string) => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  return (
    <div className="space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-3xl text-xs text-u-muted">{series.length} series. Each occurrence is its own task (status, assignee, comments, history). Missed occurrences stay open. Dates are calendar dates, so daylight-saving changes never move them.</p>
        {caps.series && <button type="button" className="st-btn" disabled={busy} onClick={onRunSchedule}><RefreshCw size={14} />Run schedule now</button>}
      </div>
      {!caps.series && <p className="rounded-lg bg-u-warn-soft px-3 py-2 text-xs text-u-warn">Your role can view series but not change them.</p>}
      {series.map((s) => {
        const occ = tasks.filter((t) => t.recurrenceId === s.id).sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));
        return (
          <div key={s.id} className="overflow-hidden rounded-xl border border-u-line bg-u-card">
            <div className="flex flex-wrap items-center gap-3 px-4 py-3">
              <span className="flex size-9 items-center justify-center rounded-lg bg-u-accent-soft text-u-accent"><Repeat size={16} /></span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-u-ink">{s.title}</p>
                <p className="text-xs text-u-muted">{describe(s)} · {occ.length} occurrences · from {formatDate(s.startDate)}{s.endDate ? ` to ${formatDate(s.endDate)}` : ", no end"}</p>
              </div>
              <span className={cx("rounded-full px-2.5 py-0.5 text-[10.5px] font-bold uppercase", TONE[s.status])}>{s.status}</span>
              <div className="text-right text-xs"><p className="font-semibold text-u-ink2">Next: {formatDate(s.nextOccurrenceDate)}</p><p className="text-u-muted">Last created: {formatDate(s.lastGeneratedDate)}</p></div>
              <div className="flex flex-wrap gap-1.5">
                <button type="button" className="st-btn st-btn-sm" aria-expanded={expanded === s.id} onClick={() => setExpanded(expanded === s.id ? null : s.id)}>{expanded === s.id ? "Hide" : "Occurrences"}</button>
                {caps.series && s.status === "active" && <button type="button" className="st-btn st-btn-sm" disabled={busy} onClick={() => onAction(s.id, "pause")}><Pause size={12} />Pause</button>}
                {caps.series && s.status === "paused" && <button type="button" className="st-btn st-btn-sm" disabled={busy} onClick={() => onAction(s.id, "resume")}><Play size={12} />Resume</button>}
                {caps.series && s.status === "active" && <button type="button" className="st-btn st-btn-sm" disabled={busy} title="Create the next occurrences (never duplicates a day)" onClick={() => onAction(s.id, "generate")}><RefreshCw size={12} />Generate</button>}
                {caps.series && (s.status === "active" || s.status === "paused") && <button type="button" className="st-btn st-btn-sm st-btn-danger" disabled={busy} onClick={() => setConfirm(s.id)}><XOctagon size={12} />Cancel</button>}
              </div>
            </div>
            {confirm === s.id && (
              <div className="flex flex-wrap items-center gap-2 border-t border-u-line bg-u-danger-soft px-4 py-2.5 text-xs text-u-ink2">
                <span>Cancel this series? Open occurrences are cancelled; completed ones are kept.</span>
                <button type="button" className="st-btn st-btn-sm st-btn-danger" disabled={busy} onClick={() => { setConfirm(null); onAction(s.id, "cancel"); }}>Cancel series</button>
                <button type="button" className="st-btn st-btn-sm" onClick={() => setConfirm(null)}>Keep it</button>
              </div>
            )}
            {expanded === s.id && (
              <div className="border-t border-u-line bg-u-s2/50 px-4 py-3">
                <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                  {occ.map((o) => (
                    <button key={o.id} type="button" onClick={() => onOpen(o.id)} className="flex items-center justify-between gap-2 rounded-lg border border-u-line bg-u-card px-3 py-2 text-left hover:border-u-accent/40">
                      <span className="min-w-0"><span className="block truncate text-xs font-semibold text-u-ink">{o.ref}</span><span className="block text-[11px] text-u-muted">Due {formatDate(o.dueDate)}</span></span>
                      <StatusBadge status={o.status} />
                    </button>
                  ))}
                  {!occ.length && <p className="text-xs text-u-muted">No occurrences visible to you.</p>}
                </div>
              </div>
            )}
          </div>
        );
      })}
      {!series.length && <div className="rounded-xl border border-dashed border-u-line"><Empty icon={<Repeat size={26} />} title="No recurring series yet" hint="Create a task and switch on “Repeat this task”." /></div>}
    </div>
  );
}
