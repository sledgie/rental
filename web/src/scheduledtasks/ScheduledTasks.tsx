import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, ClipboardList, Clock, Plus, Repeat, SearchX, ShieldAlert } from "lucide-react";
import { Button as TnButton } from "../tenants/components/ui";
import { FilterField, FilterPopover, SearchField } from "../shell/directory";
import { useAuth } from "../auth/contexts/AuthContext";
import { useOrganization } from "../auth/contexts/OrganizationContext";
import { isSupabaseConfigured } from "../lib/supabase";
import { PRIORITIES, STATUSES, capsFor, isOpen, type Priority, type Series, type Task, type TaskInput } from "./types";
import * as repo from "./repo";
import type { Workspace } from "./repo";
import TaskCalendar from "./components/TaskCalendar";
import TaskForm from "./components/TaskForm";
import TaskDetailDrawer from "./components/TaskDetail";
import SeriesTab from "./components/SeriesTab";
import CategoriesTab from "./components/CategoriesTab";
import { Empty, Initials, PriorityBadge, StatusBadge, cx, formatDate, isOverdue, localDate, today } from "./components/ui";
import "./scheduledtasks.css";

type Tab = "list" | "calendar" | "series" | "categories";
const TABS: [Tab, string][] = [["list", "List"], ["calendar", "Calendar"], ["series", "Recurring series"], ["categories", "Categories"]];
const QUICK = [["all", "All tasks"], ["my", "My tasks"], ["overdue", "Overdue"], ["today", "Due today"], ["upcoming", "Upcoming"], ["completed", "Completed"], ["recurring", "Recurring"]] as const;
type Quick = (typeof QUICK)[number][0];
const EMPTY_FILTERS = { categoryId: "", priority: "", status: "", propertyId: "", assigneeId: "", dueFrom: "", dueTo: "" };
const PAGE_SIZE = 15;
const RANK: Record<string, number> = { low: 0, normal: 1, high: 2, urgent: 3 };

function SortButton({ label, column, sort, dir, onSort }: { label: string; column: string; sort: string; dir: "asc" | "desc"; onSort: (c: string) => void }) {
  const active = sort === column;
  return (
    <button type="button" onClick={() => onSort(column)} className={cx("inline-flex items-center gap-1 whitespace-nowrap text-left text-[10px] font-bold uppercase tracking-[0.08em]", active ? "text-u-ink" : "text-u-muted hover:text-u-ink")}>
      {label}{active ? (dir === "asc" ? <ArrowUp size={11} /> : <ArrowDown size={11} />) : <ArrowUpDown size={11} className="opacity-50" />}
    </button>
  );
}

export default function ScheduledTasks({ params, notify }: { params?: Record<string, string>; notify?: (message: string) => void }) {
  const { user } = useAuth();
  const { activeOrganization, activeRole } = useOrganization();
  const orgId = activeOrganization?.id ?? null;
  const meId = user?.id ?? "";
  const caps = useMemo(() => capsFor(activeRole), [activeRole]);
  const say = useCallback((message: string) => notify?.(message), [notify]);

  const [ws, setWs] = useState<Workspace | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<Tab>("list");
  const [quick, setQuick] = useState<Quick>((QUICK.find((q) => q[0] === params?.quick)?.[0] ?? "all") as Quick);
  const [search, setSearch] = useState(params?.search ?? "");
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [sort, setSort] = useState("due");
  const [dir, setDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(params?.task ?? null);
  const [form, setForm] = useState<{ task: Task | null } | null>(null);

  const load = useCallback(async () => {
    if (!orgId) return;
    try { setWs(await repo.loadWorkspace(orgId)); setLoadError(null); }
    catch (e) { setLoadError(e instanceof Error ? e.message : "Unable to load tasks."); }
  }, [orgId]);

  // open: let series managers top up occurrences / overdue flags / reminders first, then read everything
  useEffect(() => {
    if (!isSupabaseConfigured || !orgId) return;
    let cancelled = false;
    (async () => {
      if (caps.series) { try { await repo.runSchedule(orgId); } catch { /* the page still loads */ } }
      if (!cancelled) await load();
    })();
    return () => { cancelled = true; };
  }, [orgId, caps.series, load]);

  useEffect(() => { setPage(1); }, [quick, search, filters, tab]);

  const tasks = ws?.tasks ?? [];
  const people = ws?.people ?? [];
  const personName = useCallback((id: string | null) => (id ? people.find((p) => p.id === id)?.name ?? "Former member" : "Unassigned"), [people]);
  const categoryOf = useCallback((id: string | null) => ws?.categories.find((c) => c.id === id), [ws]);

  const summary = useMemo(() => {
    const t = today(), month = t.slice(0, 7);
    return {
      open: tasks.filter((x) => isOpen(x.status)).length,
      dueToday: tasks.filter((x) => isOpen(x.status) && x.dueDate === t).length,
      overdue: tasks.filter(isOverdue).length,
      upcoming: tasks.filter((x) => isOpen(x.status) && !!x.dueDate && x.dueDate > t).length,
      doneThisMonth: tasks.filter((x) => x.status === "completed" && !!x.completedAt && localDate(x.completedAt).slice(0, 7) === month).length,
    };
  }, [tasks]);

  const filtered = useMemo(() => {
    const t = today();
    const q = search.trim().toLowerCase();
    const list = tasks.filter((x) => {
      if (quick === "my" && x.assigneeId !== meId && !x.collaboratorIds.includes(meId)) return false;
      if (quick === "overdue" && !isOverdue(x)) return false;
      if (quick === "today" && !(isOpen(x.status) && x.dueDate === t)) return false;
      if (quick === "upcoming" && !(isOpen(x.status) && !!x.dueDate && x.dueDate >= t)) return false;
      if (quick === "completed" && x.status !== "completed") return false;
      if (quick === "recurring" && !x.isRecurring) return false;
      if (filters.categoryId && x.categoryId !== filters.categoryId) return false;
      if (filters.priority && x.priority !== filters.priority) return false;
      if (filters.status && x.status !== filters.status) return false;
      if (filters.propertyId && x.propertyId !== filters.propertyId) return false;
      if (filters.assigneeId && x.assigneeId !== filters.assigneeId) return false;
      if (filters.dueFrom && (!x.dueDate || x.dueDate < filters.dueFrom)) return false;
      if (filters.dueTo && (!x.dueDate || x.dueDate > filters.dueTo)) return false;
      if (q) {
        const hay = [x.title, x.description, x.ref, x.completionNotes, categoryOf(x.categoryId)?.name, ws?.lookups.properties.find((p) => p.id === x.propertyId)?.name,
          ws?.lookups.units.find((u) => u.id === x.unitId)?.name, ws?.lookups.tenants.find((tn) => tn.id === x.tenantId)?.name, personName(x.assigneeId)].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    const sign = dir === "asc" ? 1 : -1;
    const key = (x: Task): string | number => (sort === "title" ? x.title.toLowerCase() : sort === "priority" ? RANK[x.priority] : sort === "status" ? x.status : sort === "assignee" ? personName(x.assigneeId).toLowerCase() : x.dueDate ?? "9999");
    return [...list].sort((a, b) => { const ka = key(a), kb = key(b); return (ka < kb ? -1 : ka > kb ? 1 : a.ref.localeCompare(b.ref)) * sign; });
  }, [tasks, quick, search, filters, sort, dir, meId, ws, personName, categoryOf]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const shown = filtered.slice((Math.min(page, pages) - 1) * PAGE_SIZE, Math.min(page, pages) * PAGE_SIZE);
  const sortBy = (c: string) => { if (sort === c) setDir(dir === "asc" ? "desc" : "asc"); else { setSort(c); setDir("asc"); } };
  const filterCount = Object.values(filters).filter(Boolean).length;
  const selected = selectedId ? tasks.find((x) => x.id === selectedId) ?? null : null;
  const seriesOf = (t: Task): Series | undefined => ws?.series.find((s) => s.id === t.recurrenceId);
  const counts = useMemo(() => { const m = new Map<string, number>(); for (const x of tasks) if (x.categoryId) m.set(x.categoryId, (m.get(x.categoryId) ?? 0) + 1); return m; }, [tasks]);

  async function guarded(action: () => Promise<unknown>, done?: string) {
    setBusy(true);
    try { await action(); await load(); if (done) say(done); }
    catch (e) { say(e instanceof Error ? e.message : "Something went wrong."); }
    finally { setBusy(false); }
  }

  async function save(input: TaskInput, scope: "single" | "future" | "all") {
    if (!orgId) return;
    if (!form?.task) {
      await repo.createTask(orgId, input);
      setForm(null); await load(); say(input.recurrence ? "Recurring series created." : "Task created.");
      return;
    }
    await repo.updateTask(form.task.id, input);
    let message = "Task saved.";
    if (scope !== "single") { const r = await repo.updateSeriesOccurrences(form.task.id, input, scope); message = `Series updated: ${r.applied} open occurrence${r.applied === 1 ? "" : "s"} changed${r.skipped ? `, ${r.skipped} finished one${r.skipped === 1 ? "" : "s"} left as they were` : ""}.`; }
    setForm(null); await load(); say(message);
  }

  const cards = [
    { label: "Open", value: summary.open, sub: "Not completed or cancelled", icon: ClipboardList, tone: "bg-u-accent-soft text-u-accent" },
    { label: "Due today", value: summary.dueToday, sub: formatDate(today()), icon: Clock, tone: "bg-u-warn-soft text-u-warn" },
    { label: "Overdue", value: summary.overdue, sub: "Need attention", icon: AlertTriangle, tone: "bg-u-danger-soft text-u-danger" },
    { label: "Upcoming", value: summary.upcoming, sub: "After today", icon: CalendarDays, tone: "bg-u-blue-soft text-u-blue" },
    { label: "Done this month", value: summary.doneThisMonth, sub: "Completed", icon: CheckCircle2, tone: "bg-u-ok-soft text-u-ok" },
  ];

  const body = (() => {
    if (!isSupabaseConfigured) return <Empty icon={<ClipboardList size={28} />} title="Scheduled Tasks needs your database connection" hint="Connect the app to Supabase (see web/.env.example) to create and track tasks. Nothing is stored in the browser." />;
    if (loadError) return <Empty icon={<ShieldAlert size={28} />} title="Tasks could not be loaded" hint={loadError} />;
    if (!ws) return <Empty title="Loading tasks…" />;
    if (tab === "series") return <SeriesTab series={ws.series} tasks={tasks} caps={caps} busy={busy} onOpen={setSelectedId} onAction={(id, a) => void guarded(async () => { const r = await repo.seriesAction(id, a); if (a === "generate") say(r.count ? `${r.count} occurrence${r.count === 1 ? "" : "s"} created.` : "Nothing new to create yet."); else say(`Series ${a === "pause" ? "paused" : a === "resume" ? "resumed" : "cancelled"}.`); })} onRunSchedule={() => void guarded(async () => { const r = await repo.runSchedule(orgId!); say(`Schedule run: ${r.generated} new occurrence${r.generated === 1 ? "" : "s"}, ${r.overdue} newly overdue, ${r.reminders} reminder${r.reminders === 1 ? "" : "s"} delivered.`); })} />;
    if (tab === "categories") return <CategoriesTab categories={ws.categories} counts={counts} caps={caps} busy={busy} onCreate={(n, c) => void guarded(() => repo.createCategory(orgId!, n, c), "Category added.")} onUpdate={(id, p) => void guarded(() => repo.updateCategory(id, p), "Category updated.")} />;
    return (
      <>
        <div className="flex flex-wrap gap-1.5 border-b border-u-line px-4 py-3">
          {QUICK.map(([key, label]) => (
            <button key={key} type="button" className="st-chip" aria-pressed={quick === key} onClick={() => setQuick(key)}>
              {label}{key === "overdue" && summary.overdue > 0 && <span className="rounded-full bg-u-danger px-1.5 text-[10px] font-bold text-u-bg">{summary.overdue}</span>}
            </button>
          ))}
        </div>
        {tab === "calendar" ? <TaskCalendar tasks={filtered} categories={ws.categories} onOpen={setSelectedId} /> : !shown.length ? (
          <Empty icon={<SearchX size={28} />} title={tasks.length ? "No tasks match these filters" : "No tasks yet"} hint={tasks.length ? "Try a broader search or clear the filters." : caps.manage ? "Create your first task to start planning work." : "Tasks assigned to you will appear here."} />
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[920px] text-left">
                <thead><tr className="border-b border-u-line bg-u-s2/70">
                  <th className="px-4 py-3"><SortButton label="Task" column="title" sort={sort} dir={dir} onSort={sortBy} /></th>
                  <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-[0.08em] text-u-muted">Category</th>
                  <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-[0.08em] text-u-muted">Property</th>
                  <th className="px-3 py-3"><SortButton label="Assignee" column="assignee" sort={sort} dir={dir} onSort={sortBy} /></th>
                  <th className="px-3 py-3"><SortButton label="Priority" column="priority" sort={sort} dir={dir} onSort={sortBy} /></th>
                  <th className="px-3 py-3"><SortButton label="Status" column="status" sort={sort} dir={dir} onSort={sortBy} /></th>
                  <th className="px-3 py-3"><SortButton label="Due" column="due" sort={sort} dir={dir} onSort={sortBy} /></th>
                  <th className="w-12 px-3 py-3"><span className="sr-only">Actions</span></th>
                </tr></thead>
                <tbody className="divide-y divide-u-line">
                  {shown.map((t) => {
                    const cat = categoryOf(t.categoryId);
                    const over = isOverdue(t);
                    const mine = t.assigneeId === meId || t.createdBy === meId || t.collaboratorIds.includes(meId);
                    return (
                      <tr key={t.id} tabIndex={0} className="cursor-pointer hover:bg-u-s2/70 focus:bg-u-s2/70 focus:outline-none" onClick={() => setSelectedId(t.id)}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectedId(t.id); } }}>
                        <td className="max-w-72 px-4 py-3">
                          <p className="truncate text-sm font-semibold text-u-ink">{t.isRecurring && <Repeat size={12} className="mr-1.5 inline text-u-accent" aria-label="Recurring" />}{t.title}</p>
                          <p className="text-[11px] text-u-muted">{t.ref}{over && <span className="ml-1.5 font-bold text-u-danger">OVERDUE</span>}</p>
                        </td>
                        <td className="px-3 py-3 text-xs text-u-ink2">{cat ? <span className="inline-flex items-center gap-1.5 whitespace-nowrap"><span className="size-2 rounded-full" style={{ backgroundColor: cat.color }} />{cat.name}</span> : <span className="text-u-s3">—</span>}</td>
                        <td className="whitespace-nowrap px-3 py-3 text-xs text-u-ink2">{ws.lookups.properties.find((p) => p.id === t.propertyId)?.name ?? "—"}{t.unitId && <span className="block text-[10px] text-u-muted">Unit {ws.lookups.units.find((u) => u.id === t.unitId)?.name}</span>}</td>
                        <td className="px-3 py-3 text-xs text-u-ink2">{t.assigneeId ? <span className="inline-flex items-center gap-1.5 whitespace-nowrap"><Initials name={personName(t.assigneeId)} size={22} />{personName(t.assigneeId).split(" ")[0]}</span> : <span className="text-u-muted">Unassigned</span>}</td>
                        <td className="px-3 py-3"><PriorityBadge priority={t.priority} /></td>
                        <td className="px-3 py-3"><StatusBadge status={t.status} /></td>
                        <td className={cx("whitespace-nowrap px-3 py-3 text-xs", over ? "font-bold text-u-danger" : "text-u-ink2")}>{formatDate(t.dueDate)}{t.dueTime ? <span className="text-u-muted"> · {t.dueTime}</span> : null}</td>
                        <td className="px-3 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                          {isOpen(t.status) && caps.manage && (caps.viewAll || mine) && <button type="button" className="st-pg" title="Mark complete" aria-label={`Complete ${t.title}`} disabled={busy} onClick={() => void guarded(() => repo.completeTask(t.id), "Task completed.")}><CheckCircle2 size={15} /></button>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="divide-y divide-u-line md:hidden">
              {shown.map((t) => (
                <article key={t.id} tabIndex={0} className="cursor-pointer p-4 hover:bg-u-s2/70" onClick={() => setSelectedId(t.id)}>
                  <p className="text-sm font-semibold text-u-ink">{t.title}</p>
                  <p className="mt-0.5 text-[11px] text-u-muted">{t.ref} · due {formatDate(t.dueDate)} · {personName(t.assigneeId)}</p>
                  <div className="mt-2 flex flex-wrap gap-2"><StatusBadge status={t.status} /><PriorityBadge priority={t.priority} /></div>
                </article>
              ))}
            </div>
            <div className="flex flex-col items-center justify-between gap-3 border-t border-u-line px-4 py-3 text-[11px] text-u-muted sm:flex-row">
              <span>{(Math.min(page, pages) - 1) * PAGE_SIZE + 1}–{Math.min(Math.min(page, pages) * PAGE_SIZE, filtered.length)} of {filtered.length}</span>
              <div className="flex items-center gap-1">
                <button type="button" className="st-pg" disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label="Previous page"><ChevronLeft size={15} /></button>
                <span className="px-2">Page {Math.min(page, pages)} of {pages}</span>
                <button type="button" className="st-pg" disabled={page >= pages} onClick={() => setPage(page + 1)} aria-label="Next page"><ChevronRight size={15} /></button>
              </div>
            </div>
          </>
        )}
      </>
    );
  })();

  return <div className="tn st">
    <div className="app-shell"><div className="main-shell"><main className="main-content">
      <div className="page-heading">
        <div>
          <div className="page-title-line"><h1>Scheduled Tasks</h1><span className="muted">{ws ? `${summary.open} open` : ""}</span></div>
          <p>Work assignments with due dates, recurrence, checklists and reminders. Workflow Automation (event rules) is a separate area.</p>
        </div>
        <div className="page-heading-actions no-print">
          <TnButton type="button" variant="primary" disabled={!ws || !caps.manage} title={caps.manage ? undefined : "Your role cannot create tasks"} onClick={() => setForm({ task: null })}><Plus size={15} />Create task</TnButton>
        </div>
      </div>

      <section className="directory-panel" aria-label="Scheduled tasks">
        {ws && (
          <div className="u-root st-body">
            <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 xl:grid-cols-5">
              {cards.map((c) => (
                <div key={c.label} className="rounded-xl border border-u-line bg-u-card p-3.5">
                  <div className="flex items-center justify-between"><span className={cx("flex size-8 items-center justify-center rounded-lg", c.tone)}><c.icon size={16} /></span><span className="text-2xl font-semibold tracking-tight text-u-ink">{c.value}</span></div>
                  <p className="mt-2 text-xs font-semibold text-u-ink">{c.label}</p><p className="text-[10.5px] text-u-muted">{c.sub}</p>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="directory-tabs no-print" aria-label="Views">
          {TABS.map(([value, label]) => (
            <button key={value} type="button" className={`directory-tab ${tab === value ? "selected" : ""}`} aria-pressed={tab === value} onClick={() => setTab(value)}>{label}{value === "series" && ws ? <span>{ws.series.length}</span> : value === "list" ? <span>{filtered.length}</span> : null}</button>
          ))}
          <div className="directory-tabs-end"><span className="live-dot" />{isSupabaseConfigured ? "Live · your organization's tasks" : "Not connected"}</div>
        </div>
        {(tab === "list" || tab === "calendar") && ws && (
          <div className="directory-toolbar no-print">
            <SearchField label="Search tasks" placeholder="Search title, reference, property, unit, tenant, assignee…" value={search} onChange={setSearch} />
            <div className="toolbar-actions">
              <FilterPopover title="Filter tasks" count={filterCount} onReset={() => setFilters(EMPTY_FILTERS)}>
                <FilterField id="st-f-cat" label="Category"><select id="st-f-cat" value={filters.categoryId} onChange={(e) => setFilters({ ...filters, categoryId: e.target.value })}><option value="">All categories</option>{ws.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></FilterField>
                <FilterField id="st-f-prio" label="Priority"><select id="st-f-prio" value={filters.priority} onChange={(e) => setFilters({ ...filters, priority: e.target.value })}><option value="">All priorities</option>{PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</select></FilterField>
                <FilterField id="st-f-status" label="Status"><select id="st-f-status" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}><option value="">All statuses</option>{STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select></FilterField>
                <FilterField id="st-f-prop" label="Property"><select id="st-f-prop" value={filters.propertyId} onChange={(e) => setFilters({ ...filters, propertyId: e.target.value })}><option value="">All properties</option>{ws.lookups.properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></FilterField>
                <FilterField id="st-f-who" label="Assignee"><select id="st-f-who" value={filters.assigneeId} onChange={(e) => setFilters({ ...filters, assigneeId: e.target.value })}><option value="">Everyone</option>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></FilterField>
                <FilterField id="st-f-from" label="Due from"><input id="st-f-from" type="date" value={filters.dueFrom} onChange={(e) => setFilters({ ...filters, dueFrom: e.target.value })} /></FilterField>
                <FilterField id="st-f-to" label="Due to"><input id="st-f-to" type="date" value={filters.dueTo} onChange={(e) => setFilters({ ...filters, dueTo: e.target.value })} /></FilterField>
              </FilterPopover>
            </div>
          </div>
        )}
        <div className="u-root st-body">{body}</div>
      </section>
      <div className="directory-footnote no-print"><span><ShieldAlert size={12} /> You see the tasks your role allows. Completed and cancelled tasks keep their history; every change is recorded.</span></div>
    </main></div></div>

    {form && ws && orgId && (
      <TaskForm task={form.task} caps={caps} meId={meId} categories={ws.categories} people={ws.people} lookups={ws.lookups} onClose={() => setForm(null)} onSave={save} />
    )}
    {selected && ws && orgId && !form && (
      <TaskDetailDrawer key={selected.id} task={selected} orgId={orgId} meId={meId} caps={caps} categories={ws.categories} people={ws.people} lookups={ws.lookups} series={seriesOf(selected)}
        onClose={() => setSelectedId(null)} onEdit={() => setForm({ task: selected })} onChanged={load} onDeleted={() => { setSelectedId(null); void load(); say("Task deleted."); }} notify={say} />
    )}
  </div>;
}
