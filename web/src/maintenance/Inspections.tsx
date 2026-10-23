import { isSupabaseConfigured } from "../lib/supabase";
// Inspections & preventive schedules in the shared directory format. Each schedule is a recurring inspection or service task (alarm checks,
// furnace servicing, filter changes...) that can be completed, or turned into a maintenance request / work order when it falls due.
import { Fragment, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, ArrowUpRight, CalendarClock, CheckCircle2, ChevronRight, ClipboardList, Eye, ListChecks, MapPin,
  MoreHorizontal, Pencil, Plus, Power, ShieldCheck, Users, Wrench,
} from "lucide-react";
import { Button, DataField, EmptyState, IconButton, SectionTitle, TextLink } from "../tenants/components/ui";
import { FilterCheckbox, FilterField, FilterPopover, SearchField, SortControl } from "../shell/directory";
import { Drawer } from "../projects/components/Drawer";
import { useStore } from "./store";
import { PreventiveFormModal, RequestFormModal } from "./modals";
import { ConfirmDialog, PrimaryButton, SmallButton } from "./ui";
import { Toasts } from "./Toasts";
import { Pager, StatusPill, colorFor, initialsOf, useRowMenu, type Tone } from "./common";
import { FREQUENCIES, type PreventiveSchedule } from "./types";
import { daysUntil, fmtDate, fmtMoney, todayISO } from "./utils";
import { cn } from "./utils/cn";

type Tab = "all" | "overdue" | "soon" | "upcoming" | "paused";
type SortKey = "due" | "task" | "cost" | "last";
const shortCat = (c: string) => (c === "Heating, Ventilation & Air Conditioning" ? "HVAC" : c);
const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "All schedules" },
  { key: "overdue", label: "Overdue" },
  { key: "soon", label: "Due in 14 days" },
  { key: "upcoming", label: "Upcoming" },
  { key: "paused", label: "Paused" },
];

function dueState(sc: PreventiveSchedule): { label: string; tone: Tone; kind: Tab } {
  if (!sc.active) return { label: "Paused", tone: "neutral", kind: "paused" };
  const d = daysUntil(sc.nextDue) ?? 0;
  if (d < 0) return { label: `Overdue ${Math.abs(d)}d`, tone: "danger", kind: "overdue" };
  if (d === 0) return { label: "Due today", tone: "warn", kind: "soon" };
  if (d <= 14) return { label: `Due in ${d}d`, tone: "warn", kind: "soon" };
  return { label: `Due in ${d}d`, tone: "ok", kind: "upcoming" };
}

export default function Inspections({ params }: { params?: Record<string, string> } = {}) {
  const s = useStore();
  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  const [fProperty, setFProperty] = useState("");
  const [fFrequency, setFFrequency] = useState("");
  const [fCategory, setFCategory] = useState("");
  const [sort, setSort] = useState<SortKey>("due");
  const [desc, setDesc] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<PreventiveSchedule | null>(null);
  const [genRequest, setGenRequest] = useState<PreventiveSchedule | null>(null);
  const [completeConfirm, setCompleteConfirm] = useState<PreventiveSchedule | null>(null);
  const [doneChecklist, setDoneChecklist] = useState<Record<string, Set<number>>>({});
  const { menu, setMenu } = useRowMenu();

  // deep links: ?schedule=PM-301 opens the record, ?expand=<id> opens the row, ?status=overdue|soon|upcoming|paused, ?new=1
  useEffect(() => {
    if (!params) return;
    if (params.status && TABS.some((t) => t.key === params.status)) setTab(params.status as Tab);
    if (params.schedule) setDrawerId(params.schedule);
    if (params.expand) setExpanded(params.expand);
    if (params.new === "1") { setEditing(null); setFormOpen(true); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params?.schedule, params?.expand, params?.status, params?.new]);

  const categories = useMemo(() => [...new Set(s.schedules.map((sc) => sc.category))].sort(), [s.schedules]);
  const inTab = (sc: PreventiveSchedule, t: Tab) => t === "all" || dueState(sc).kind === t;
  const tabCount = (t: Tab) => s.schedules.filter((sc) => inTab(sc, t)).length;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = s.schedules.filter((sc) => {
      if (!inTab(sc, tab)) return false;
      if (fProperty && sc.propertyId !== fProperty) return false;
      if (fFrequency && sc.frequency !== fFrequency) return false;
      if (fCategory && sc.category !== fCategory) return false;
      if (!q) return true;
      return [sc.id, sc.task, sc.category, sc.frequency, sc.instructions ?? "", s.getProperty(sc.propertyId)?.name ?? "", s.getUnit(sc.unitId)?.name ?? "", s.getAsset(sc.assetId)?.name ?? "", s.getContractor(sc.contractorId)?.company ?? ""].join(" ").toLowerCase().includes(q);
    });
    list.sort((a, b) => {
      let cmp = 0;
      if (sort === "task") cmp = a.task.localeCompare(b.task);
      else if (sort === "cost") cmp = (a.estimatedCost ?? 0) - (b.estimatedCost ?? 0);
      else if (sort === "last") cmp = (a.lastCompleted ?? "").localeCompare(b.lastCompleted ?? "");
      else cmp = a.nextDue.localeCompare(b.nextDue);
      return desc ? -cmp : cmp;
    });
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.schedules, tab, search, fProperty, fFrequency, fCategory, sort, desc]);

  const activeFilters = [fProperty, fFrequency, fCategory].filter(Boolean).length;
  const resetFilters = () => { setFProperty(""); setFFrequency(""); setFCategory(""); setPage(1); };
  const reset = () => { setTab("all"); setSearch(""); setSort("due"); setDesc(false); resetFilters(); };
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice((Math.min(page, totalPages) - 1) * pageSize, Math.min(page, totalPages) * pageSize);
  const sortBy = (key: SortKey) => {
    if (sort === key) setDesc(!desc);
    else { setSort(key); setDesc(false); }
    setPage(1);
  };
  const sortIcon = (key: SortKey) => (sort === key ? (desc ? <ArrowDown size={12} /> : <ArrowUp size={12} />) : <ArrowUpDown size={11} />);
  const ariaSort = (key: SortKey) => (sort === key ? (desc ? "descending" : "ascending") : undefined);
  const view = (id: string) => { setDrawerId(id); setMenu(null); };
  const edit = (sc: PreventiveSchedule) => { setEditing(sc); setFormOpen(true); setMenu(null); };
  const drawerSchedule = drawerId ? s.schedules.find((sc) => sc.id === drawerId) : undefined;

  const toggleCheck = (id: string, idx: number) => {
    setDoneChecklist((prev) => {
      const set = new Set(prev[id] ?? []);
      if (set.has(idx)) set.delete(idx); else set.add(idx);
      return { ...prev, [id]: set };
    });
  };
  const toggleActive = (sc: PreventiveSchedule) => { s.updateSchedule(sc.id, { active: !sc.active }); s.toast(`${sc.id} ${sc.active ? "paused" : "activated"}.`, "info"); setMenu(null); };

  const generateWorkOrder = (sc: PreventiveSchedule) => {
    // Create a maintenance request from the schedule, then a work order under it
    const reqId = s.nextRequestId();
    s.addRequest({
      id: reqId, title: sc.task, description: `Preventive maintenance task generated from schedule ${sc.id}. ${sc.instructions ?? ""}`.trim(),
      category: sc.category, priority: "Normal", status: sc.contractorId ? "Assigned" : "New",
      propertyId: sc.propertyId, unitId: sc.unitId, assetId: sc.assetId,
      reportedByName: s.currentUser.name, reportedByRole: "Property Manager", source: "Preventive Maintenance",
      reportedAt: new Date().toISOString(), targetDate: sc.nextDue < todayISO() ? todayISO() : sc.nextDue,
      assignedStaffId: s.currentUser.id, assignedContractorId: sc.contractorId,
      approvalStatus: "Not Required", linkedExpenseIds: [], previousCompletions: [], createdBy: s.currentUser.name,
    }, `Generated from preventive schedule ${sc.id}`);
    const woId = s.nextWorkOrderId();
    setTimeout(() => {
      s.addWorkOrder({
        id: woId, requestId: reqId, title: sc.task, description: sc.instructions ?? sc.task,
        scope: sc.checklist.length ? `Checklist:\n${sc.checklist.map((c) => `• ${c}`).join("\n")}` : undefined,
        contractorId: sc.contractorId, priority: "Normal", targetDate: sc.nextDue,
        status: sc.contractorId ? "Scheduled" : "Awaiting Assignment", estimate: sc.estimatedCost,
        createdAt: new Date().toISOString(),
      });
    }, 0);
    s.toast(`Request ${reqId} and work order created from schedule ${sc.id}.`);
    s.navigate("requests", { focusRequestId: reqId });
  };

  const placeOf = (sc: PreventiveSchedule) => `${sc.unitId ? s.getUnit(sc.unitId)?.name : "Whole property"}${sc.assetId ? ` · ${s.getAsset(sc.assetId)?.name ?? sc.assetId}` : ""}`;

  return (
    <div className="tn">
      <div className="app-shell">
        <div className="main-shell">
          <main className="main-content">
            <div className="page-heading">
              <div>
                <div className="page-title-line"><h1>Inspections</h1></div>
                <p>Recurring inspections and servicing that prevent breakdowns, and keep warranties valid.</p>
              </div>
              <div className="page-heading-actions">
                <Button variant="primary" onClick={() => { setEditing(null); setFormOpen(true); }}><Plus size={17} />New schedule</Button>
              </div>
            </div>

            <section className="directory-panel" aria-label="Inspection schedules">
              <div className="directory-tabs" aria-label="Filter schedules">
                {TABS.map((t) => (
                  <button key={t.key} className={`directory-tab ${tab === t.key ? "selected" : ""}`} aria-pressed={tab === t.key} onClick={() => { setTab(t.key); setPage(1); }}>
                    {t.label}<span>{tabCount(t.key)}</span>
                  </button>
                ))}
                <div className="directory-tabs-end"><span className="live-dot" />{isSupabaseConfigured ? "Live" : "Demo data"}</div>
              </div>
              <div className="directory-toolbar">
                <SearchField label="Search schedules" placeholder="Search task, property, unit, asset or contractor..." value={search} onChange={(v) => { setSearch(v); setPage(1); }} />
                <div className="toolbar-actions">
                  <FilterPopover title="Filter schedules" count={activeFilters} onReset={resetFilters}>
                    <FilterField id="in-property-filter" label="Property">
                      <select id="in-property-filter" value={fProperty} onChange={(e) => { setFProperty(e.target.value); setPage(1); }}>
                        <option value="">All properties</option>
                        {s.properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </FilterField>
                    <FilterField id="in-frequency-filter" label="Frequency">
                      <select id="in-frequency-filter" value={fFrequency} onChange={(e) => { setFFrequency(e.target.value); setPage(1); }}>
                        <option value="">Any frequency</option>
                        {FREQUENCIES.map((f) => <option key={f}>{f}</option>)}
                      </select>
                    </FilterField>
                    <FilterField id="in-category-filter" label="Category">
                      <select id="in-category-filter" value={fCategory} onChange={(e) => { setFCategory(e.target.value); setPage(1); }}>
                        <option value="">All categories</option>
                        {categories.map((c) => <option key={c}>{c}</option>)}
                      </select>
                    </FilterField>
                  </FilterPopover>
                  <SortControl
                    label="Sort schedules"
                    value={sort}
                    defaultValue="due"
                    descending={desc}
                    options={[{ value: "task", label: "Task name" }, { value: "last", label: "Last completed" }, { value: "cost", label: "Estimated cost" }]}
                    onChange={(k) => { setSort(k as SortKey); setDesc(k === "cost" || k === "last"); setPage(1); }}
                    onToggle={() => setDesc(!desc)}
                  />
                </div>
              </div>

              <div className="tenant-table-wrap">
                <table className="tenant-table">
                  <caption className="sr-only">Inspection and preventive schedules. Expand a schedule for its main details; open it for the checklist and actions.</caption>
                  <colgroup><col className="col-expand" /><col className="col-tenant" style={{ width: 270 }} /><col className="col-email" style={{ width: 200 }} /><col className="col-phone" style={{ width: 140 }} /><col className="col-units" style={{ width: 150 }} /><col className="col-balance" style={{ width: 120 }} /><col className="col-status" style={{ width: 130 }} /><col className="col-actions" /></colgroup>
                  <thead>
                    <tr>
                      <th className="expand-cell"><span className="sr-only">Expand</span></th>
                      <th aria-sort={ariaSort("task")}><button onClick={() => sortBy("task")}>Inspection / task{sortIcon("task")}</button></th>
                      <th className="email-cell">Property / unit</th>
                      <th className="phone-cell">Frequency</th>
                      <th className="units-cell" aria-sort={ariaSort("due")}><button onClick={() => sortBy("due")}>Next due{sortIcon("due")}</button></th>
                      <th className="balance-cell" aria-sort={ariaSort("cost")}><button onClick={() => sortBy("cost")}>Est. cost{sortIcon("cost")}</button></th>
                      <th className="status-cell">Status</th>
                      <th className="actions-cell">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paged.map((sc) => {
                      const open = expanded === sc.id;
                      const due = dueState(sc);
                      const contractor = s.getContractor(sc.contractorId);
                      return (
                        <Fragment key={sc.id}>
                          <tr className={`tenant-row ${open ? "tenant-row-expanded" : ""}`} style={sc.active ? undefined : { opacity: 0.65 }}>
                            <td className="expand-cell">
                              <IconButton label={`${open ? "Collapse" : "Expand"} ${sc.id}`} className="expand-button" onClick={() => setExpanded(open ? null : sc.id)} aria-expanded={open} aria-controls={`details-${sc.id}`}>
                                <ChevronRight size={15} className={open ? "chevron-expanded" : ""} />
                              </IconButton>
                            </td>
                            <td className="tenant-cell">
                              <div className="tenant-identity">
                                <span className={`avatar avatar-md avatar-${colorFor(sc.category)}`} aria-hidden="true">{initialsOf(sc.category)}</span>
                                <div>
                                  <button className="tenant-name" onClick={() => view(sc.id)}>{sc.task}</button>
                                  <span className="tenant-number">{sc.id} · {shortCat(sc.category)}</span>
                                </div>
                              </div>
                            </td>
                            <td className="email-cell"><a>{s.getProperty(sc.propertyId)?.name}</a><span className="tenant-number">{placeOf(sc)}</span></td>
                            <td className="phone-cell"><a>{sc.frequency}{sc.frequency === "Custom" ? ` (${sc.customDays}d)` : ""}</a><span className="tenant-number">{sc.lastCompleted ? `last ${fmtDate(sc.lastCompleted)}` : "never done"}</span></td>
                            <td className="units-cell"><a className={due.tone === "danger" ? "red-text" : undefined}>{fmtDate(sc.nextDue)}</a><span className={`tenant-number ${due.tone === "danger" ? "red-text" : ""}`}>{due.label}</span></td>
                            <td className="balance-cell"><span className="balance-value">{fmtMoney(sc.estimatedCost)}</span><span className="tenant-number">{contractor ? contractor.company : "in-house"}</span></td>
                            <td className="status-cell"><StatusPill tone={due.tone}>{due.kind === "paused" ? "Paused" : due.kind === "overdue" ? "Overdue" : due.kind === "soon" ? "Due soon" : "Scheduled"}</StatusPill></td>
                            <td className="actions-cell">
                              <div className="row-actions">
                                <IconButton label={`View ${sc.id}`} onClick={() => view(sc.id)}><Eye size={15} /></IconButton>
                                <div className="row-more-anchor" data-row-menu>
                                  <IconButton label={`More actions for ${sc.id}`} onClick={() => setMenu(menu === sc.id ? null : sc.id)} aria-expanded={menu === sc.id}><MoreHorizontal size={17} /></IconButton>
                                  {menu === sc.id && (
                                    <div className="row-menu" style={{ width: 230 }}>
                                      <button onClick={() => view(sc.id)}><Eye size={14} />View schedule</button>
                                      <button onClick={() => edit(sc)}><Pencil size={14} />Edit schedule</button>
                                      <button disabled={!sc.active} onClick={() => { setCompleteConfirm(sc); setMenu(null); }}><CheckCircle2 size={14} />Mark complete</button>
                                      <button disabled={!sc.active} onClick={() => { setGenRequest(sc); setMenu(null); }}><Wrench size={14} />Generate request</button>
                                      <button disabled={!sc.active} onClick={() => { generateWorkOrder(sc); setMenu(null); }}><ClipboardList size={14} />Generate request + work order</button>
                                      <div className="menu-divider" />
                                      <button onClick={() => toggleActive(sc)}><Power size={14} />{sc.active ? "Pause schedule" : "Activate schedule"}</button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                          {open && (
                            <tr className="detail-row" id={`details-${sc.id}`}>
                              <td colSpan={8}>
                                <div className="expanded-detail">
                                  <div className="expanded-detail-top">
                                    <span>SCHEDULE DETAILS</span>
                                    <TextLink onClick={() => view(sc.id)}>Open schedule<ArrowUpRight size={12} /></TextLink>
                                  </div>
                                  <div className="expanded-grid">
                                    <section className="detail-section is-compact">
                                      <SectionTitle icon={<CalendarClock size={15} />} title="Schedule" />
                                      <dl className="lease-facts">
                                        <DataField label="Frequency">{sc.frequency}</DataField>
                                        <DataField label="Last done">{fmtDate(sc.lastCompleted)}</DataField>
                                        <DataField label="Next due">{fmtDate(sc.nextDue)}</DataField>
                                        <DataField label="Estimated cost">{fmtMoney(sc.estimatedCost)}</DataField>
                                      </dl>
                                    </section>
                                    <section className="detail-section is-compact">
                                      <SectionTitle icon={<MapPin size={15} />} title="Where" />
                                      <dl className="lease-facts">
                                        <DataField label="Property">{s.getProperty(sc.propertyId)?.name ?? "—"}</DataField>
                                        <DataField label="Unit">{sc.unitId ? s.getUnit(sc.unitId)?.name : "Whole property"}</DataField>
                                        <DataField label="Asset">{s.getAsset(sc.assetId)?.name ?? "—"}</DataField>
                                      </dl>
                                    </section>
                                    <section className="detail-section is-compact">
                                      <SectionTitle icon={<Users size={15} />} title="Who" />
                                      <dl className="lease-facts">
                                        <DataField label="Contractor">{contractor?.company ?? "In-house / unassigned"}</DataField>
                                        <DataField label="Checklist items">{sc.checklist.length}</DataField>
                                      </dl>
                                    </section>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {!paged.length && (
                <EmptyState
                  title={s.schedules.length ? "No schedules found" : "No inspection schedules yet"}
                  description={s.schedules.length ? "Try a different search or adjust your filters." : "Create recurring tasks like alarm inspections, furnace servicing and filter changes."}
                  action={<Button onClick={s.schedules.length ? reset : () => { setEditing(null); setFormOpen(true); }}>{s.schedules.length ? "Clear search & filters" : "New schedule"}</Button>}
                />
              )}
              <Pager total={filtered.length} page={page} pageSize={pageSize} noun="schedules" setPage={setPage} setPageSize={setPageSize} />
            </section>
            <div className="directory-footnote">
              <span><ShieldCheck size={13} />{isSupabaseConfigured ? "Due dates are shown here; no automatic reminders are sent yet." : "Prototype: due indicators only. No background jobs or external reminders are running."}</span>
              <span><CalendarClock size={13} />All amounts in CAD{!isSupabaseConfigured && <><span className="footnote-separator">&middot;</span>Demo data</>}</span>
            </div>
          </main>
        </div>
      </div>

      <Drawer open={!!drawerSchedule} onClose={() => setDrawerId(null)} title="Inspection schedule" subtitle={drawerSchedule ? `${drawerSchedule.id} · ${s.getProperty(drawerSchedule.propertyId)?.name ?? ""}` : undefined}>
        {drawerSchedule && (() => {
          const sc = drawerSchedule;
          const due = dueState(sc);
          const asset = s.getAsset(sc.assetId);
          const checked = doneChecklist[sc.id] ?? new Set<number>();
          return (
            <div className="px-5 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-[15px] font-semibold text-u-ink">{sc.task}</h3>
                <StatusPill tone={due.tone}>{due.label}</StatusPill>
              </div>
              <p className="mt-1 text-[12px] text-u-muted">{sc.id} · {shortCat(sc.category)} · {s.getProperty(sc.propertyId)?.name} · {placeOf(sc)}</p>
              {due.kind === "overdue" && (
                <p className="mt-3 flex items-center gap-2 rounded-xl border border-u-warn/25 bg-u-warn/5 px-4 py-2.5 text-[12.5px] text-u-warn"><AlertTriangle size={14} /> This task is past due. Generate a request or work order to get it scheduled.</p>
              )}
              <div className="mt-4 grid grid-cols-2 gap-2 text-[12px] sm:grid-cols-4">
                <span className="rounded-lg bg-u-s2 px-2.5 py-1.5"><span className="text-u-muted">Frequency </span><b className="text-u-ink">{sc.frequency}{sc.frequency === "Custom" ? ` (${sc.customDays}d)` : ""}</b></span>
                <span className="rounded-lg bg-u-s2 px-2.5 py-1.5"><span className="text-u-muted">Last done </span><b className="tabular text-u-ink">{fmtDate(sc.lastCompleted)}</b></span>
                <span className="rounded-lg bg-u-s2 px-2.5 py-1.5"><span className="text-u-muted">Next due </span><b className={cn("tabular", due.tone === "danger" ? "text-u-danger" : "text-u-ink")}>{fmtDate(sc.nextDue)}</b></span>
                <span className="rounded-lg bg-u-s2 px-2.5 py-1.5"><span className="text-u-muted">Est. cost </span><b className="tabular text-u-ink">{fmtMoney(sc.estimatedCost)}</b></span>
              </div>
              <p className="mt-3 text-[12.5px] text-u-muted">
                {sc.contractorId ? `Contractor: ${s.getContractor(sc.contractorId)?.company}` : "Handled in-house / unassigned"}
                {asset && <span className="block">Asset: {asset.id} · {asset.name}</span>}
                {sc.instructions && <span className="mt-1 block text-u-ink2">{sc.instructions}</span>}
              </p>
              {sc.checklist.length > 0 && (
                <div className="mt-4 rounded-lg border border-u-line bg-u-s2/50 px-3 py-2.5">
                  <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-u-muted"><ListChecks size={12} /> Checklist · {checked.size}/{sc.checklist.length}</p>
                  <div className="space-y-1">
                    {sc.checklist.map((item, i) => (
                      <label key={i} className="flex cursor-pointer items-center gap-2 text-[12.5px] text-u-ink2">
                        <input type="checkbox" checked={checked.has(i)} onChange={() => toggleCheck(sc.id, i)} className="h-3.5 w-3.5 accent-u-accent" />
                        <span className={checked.has(i) ? "text-u-muted line-through" : ""}>{item}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              <div className="mt-4 flex flex-wrap gap-1.5">
                <PrimaryButton onClick={() => setCompleteConfirm(sc)} disabled={!sc.active} className="px-2.5 py-1.5 text-[12px]"><CheckCircle2 size={13} /> Mark Complete</PrimaryButton>
                <SmallButton onClick={() => setGenRequest(sc)} disabled={!sc.active}><Wrench size={12} /> Generate Request</SmallButton>
                <SmallButton onClick={() => generateWorkOrder(sc)} disabled={!sc.active}><ClipboardList size={12} /> Generate Request + Work Order</SmallButton>
                <SmallButton onClick={() => edit(sc)}><Pencil size={12} /> Edit</SmallButton>
                <SmallButton onClick={() => toggleActive(sc)}><Power size={12} /> {sc.active ? "Pause" : "Activate"}</SmallButton>
              </div>
            </div>
          );
        })()}
      </Drawer>

      <PreventiveFormModal open={formOpen} onClose={() => setFormOpen(false)} schedule={editing} />
      <RequestFormModal
        open={!!genRequest}
        onClose={() => setGenRequest(null)}
        preset={genRequest ? {
          propertyId: genRequest.propertyId, unitId: genRequest.unitId, assetId: genRequest.assetId,
          title: genRequest.task, category: genRequest.category, source: "Preventive Maintenance",
          description: `Scheduled preventive task (${genRequest.id}, ${genRequest.frequency}). ${genRequest.instructions ?? ""}${genRequest.checklist.length ? `\n\nChecklist:\n${genRequest.checklist.map((c) => `• ${c}`).join("\n")}` : ""}`,
        } : undefined}
        onSaved={(id) => s.navigate("requests", { focusRequestId: id })}
      />
      <ConfirmDialog
        open={!!completeConfirm}
        onClose={() => setCompleteConfirm(null)}
        title={`Complete “${completeConfirm?.task}”?`}
        body={<>This sets the last-completed date to today and recalculates the next due date from the <b className="text-u-ink">{completeConfirm?.frequency.toLowerCase()}</b> schedule. Checklist progress will reset.</>}
        confirmLabel="Mark Complete"
        onConfirm={() => {
          if (completeConfirm) {
            s.completeSchedule(completeConfirm.id);
            setDoneChecklist((p) => ({ ...p, [completeConfirm.id]: new Set() }));
          }
        }}
      />
      <Toasts />
    </div>
  );
}
