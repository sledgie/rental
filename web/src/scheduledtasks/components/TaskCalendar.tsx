import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Category, Task } from "../types";
import { statusLabel, priorityLabel } from "../types";
import { cx, formatDate, today } from "./ui";

const parse = (s: string) => { const [y, m, d] = s.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d, 12)); };
const toDay = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (s: string, n: number) => { const d = parse(s); d.setUTCDate(d.getUTCDate() + n); return toDay(d); };
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Month / week / day view of the tasks' due dates. */
export default function TaskCalendar({ tasks, categories, onOpen }: { tasks: Task[]; categories: Category[]; onOpen: (id: string) => void }) {
  const [mode, setMode] = useState<"month" | "week" | "day">("month");
  const [cursor, setCursor] = useState(today());
  const color = useMemo(() => new Map(categories.map((c) => [c.id, c.color])), [categories]);
  const byDay = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of tasks) if (t.dueDate) map.set(t.dueDate, [...(map.get(t.dueDate) ?? []), t]);
    return map;
  }, [tasks]);

  const monthCells = useMemo(() => {
    const cur = parse(cursor);
    const first = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth(), 1, 12));
    const start = new Date(first);
    start.setUTCDate(start.getUTCDate() - first.getUTCDay());
    return Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setUTCDate(d.getUTCDate() + i); return toDay(d); });
  }, [cursor]);
  const weekDays = useMemo(() => { const start = addDays(cursor, -parse(cursor).getUTCDay()); return Array.from({ length: 7 }, (_, i) => addDays(start, i)); }, [cursor]);

  const title = mode === "month" ? parse(cursor).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" }) : mode === "week" ? `Week of ${formatDate(weekDays[0])}` : formatDate(cursor);
  const move = (n: number) => {
    if (mode === "month") { const d = parse(cursor); d.setUTCMonth(d.getUTCMonth() + n); setCursor(toDay(d)); }
    else setCursor(addDays(cursor, n * (mode === "week" ? 7 : 1)));
  };
  const todayStr = today();

  const chip = (t: Task) => (
    <button key={t.id} type="button" onClick={() => onOpen(t.id)} title={`${t.ref} · ${t.title}`}
      className={cx("block w-full truncate rounded-md border-l-[3px] px-1.5 py-0.5 text-left text-[11px] font-medium hover:brightness-95",
        t.status === "completed" ? "bg-u-ok-soft text-u-ok line-through" : t.status === "cancelled" ? "bg-u-s3 text-u-muted line-through" : "bg-u-s2 text-u-ink2")}
      style={{ borderLeftColor: (t.categoryId && color.get(t.categoryId)) || "var(--accent)" }}>
      {t.title}
    </button>
  );

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 border-b border-u-line px-4 py-3">
        <div className="flex items-center gap-1">
          <button type="button" className="st-pg" onClick={() => move(-1)} aria-label="Previous"><ChevronLeft size={15} /></button>
          <button type="button" className="st-btn st-btn-sm" onClick={() => setCursor(todayStr)}>Today</button>
          <button type="button" className="st-pg" onClick={() => move(1)} aria-label="Next"><ChevronRight size={15} /></button>
        </div>
        <h3 className="text-sm font-semibold text-u-ink">{title}</h3>
        <div className="ml-auto flex rounded-lg border border-u-line2 p-0.5">
          {(["month", "week", "day"] as const).map((m) => (
            <button key={m} type="button" onClick={() => setMode(m)} aria-pressed={mode === m}
              className={cx("rounded-md px-3 py-1 text-xs font-semibold capitalize", mode === m ? "bg-u-accent text-u-onaccent" : "text-u-muted hover:text-u-ink")}>{m}</button>
          ))}
        </div>
      </div>

      {mode === "month" && (
        <div>
          <div className="grid grid-cols-7 border-b border-u-line bg-u-s2/70">
            {DAYS.map((d) => <div key={d} className="px-2 py-1.5 text-center text-[10.5px] font-bold uppercase tracking-wide text-u-muted">{d}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {monthCells.map((day) => {
              const inMonth = day.slice(0, 7) === cursor.slice(0, 7);
              const list = byDay.get(day) ?? [];
              return (
                <div key={day} className={cx("min-h-24 border-b border-r border-u-line p-1.5 [&:nth-child(7n)]:border-r-0", !inMonth && "bg-u-s2/50")}>
                  <button type="button" onClick={() => { setCursor(day); setMode("day"); }}
                    className={cx("mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold", day === todayStr ? "bg-u-accent text-u-onaccent" : inMonth ? "text-u-ink2 hover:bg-u-s3" : "text-u-muted")}>
                    {Number(day.slice(8, 10))}
                  </button>
                  <div className="space-y-1">{list.slice(0, 3).map(chip)}</div>
                  {list.length > 3 && <button type="button" onClick={() => { setCursor(day); setMode("day"); }} className="mt-0.5 px-1 text-[10px] font-semibold text-u-muted hover:text-u-ink">+{list.length - 3} more</button>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {mode === "week" && (
        <div className="grid grid-cols-7">
          {weekDays.map((day) => (
            <div key={day} className="min-h-64 border-r border-u-line p-2 last:border-r-0">
              <p className={cx("mb-2 text-center text-xs font-bold", day === todayStr ? "text-u-accent" : "text-u-muted")}>{DAYS[parse(day).getUTCDay()]} · {day.slice(8, 10)}</p>
              <div className="space-y-1.5">{(byDay.get(day) ?? []).map(chip)}</div>
              {!(byDay.get(day) ?? []).length && <p className="text-center text-[11px] text-u-s3">—</p>}
            </div>
          ))}
        </div>
      )}

      {mode === "day" && (
        <div className="space-y-2 p-4">
          {!(byDay.get(cursor) ?? []).length && <p className="py-8 text-center text-sm text-u-muted">No tasks due on {formatDate(cursor)}.</p>}
          {(byDay.get(cursor) ?? []).map((t) => (
            <button key={t.id} type="button" onClick={() => onOpen(t.id)} className="flex w-full items-center gap-3 rounded-xl border border-u-line px-4 py-3 text-left hover:border-u-accent/40 hover:bg-u-s2/60">
              <span className="h-9 w-1.5 rounded-full" style={{ backgroundColor: (t.categoryId && color.get(t.categoryId)) || "var(--accent)" }} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-u-ink">{t.title}</span>
                <span className="block text-xs text-u-muted">{t.ref} · {statusLabel(t.status)} · {priorityLabel(t.priority)}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
