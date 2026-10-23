import { isSupabaseConfigured } from "../lib/supabase";
// Work orders in the shared directory format: tabs, search, Tenants-style filters, master rows with an inline summary and a side drawer (View).
import { Fragment, useEffect, useMemo, useState } from "react";
import {
  ArrowDown, ArrowUp, ArrowUpDown, ArrowUpRight, CalendarClock, CalendarDays, CheckCircle2, ChevronRight, ClipboardList, Download, ExternalLink, Eye,
  FileText, MoreHorizontal, Pencil, Plus, ShieldCheck, Users, Wrench, X,
} from "lucide-react";
import { Button, DataField, EmptyState, IconButton, SectionTitle, TextLink } from "../tenants/components/ui";
import { FilterField, FilterPopover, SearchField, SortControl } from "../shell/directory";
import { Drawer } from "../projects/components/Drawer";
import { useStore } from "./store";
import { WorkOrderDetail } from "./pages/Operations";
import { CompleteWorkOrderModal, VisitModal, WorkLogModal, WorkOrderFormModal } from "./modals";
import { ConfirmDialog } from "./ui";
import { Toasts } from "./Toasts";
import { Pager, StatusPill, colorFor, initialsOf, useRowMenu, type Tone } from "./common";
import { PRIORITY_TEXT } from "./Requests";
import { WORKORDER_STATUSES, type WorkOrder } from "./types";
import { daysUntil, fmtDate, fmtMoney } from "./utils";

type Tab = "all" | "open" | "awaiting" | "scheduled" | "inprogress" | "completed";
type SortKey = "created" | "target" | "scheduled" | "cost" | "title";
const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "All work orders" },
  { key: "open", label: "Open" },
  { key: "awaiting", label: "Awaiting contractor" },
  { key: "scheduled", label: "Scheduled" },
  { key: "inprogress", label: "In progress" },
  { key: "completed", label: "Completed" },
];
const WO_TONE: Record<string, Tone> = { Draft: "neutral", "Awaiting Assignment": "pending", Scheduled: "info", "In Progress": "ok", "On Hold": "warn", Completed: "good", Cancelled: "danger" };
const closed = (w: WorkOrder) => w.status === "Completed" || w.status === "Cancelled";

export default function WorkOrders({ params }: { params?: Record<string, string> } = {}) {
  const s = useStore();
  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [fContractor, setFContractor] = useState("");
  const [fPriority, setFPriority] = useState("");
  const [fProperty, setFProperty] = useState("");
  const [sort, setSort] = useState<SortKey>("created");
  const [desc, setDesc] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [formWO, setFormWO] = useState<WorkOrder | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [completing, setCompleting] = useState<WorkOrder | null>(null);
  const [worklogFor, setWorklogFor] = useState<WorkOrder | null>(null);
  const [visitFor, setVisitFor] = useState<WorkOrder | null>(null);
  const [cancelConfirm, setCancelConfirm] = useState<WorkOrder | null>(null);
  const { menu, setMenu } = useRowMenu();

  // deep links: ?request=MR-1001 filters to that request's work orders, ?workorder=WO-1001 opens the record, ?expand=<id>, ?new=1
  useEffect(() => {
    if (!params) return;
    if (params.status && TABS.some((t) => t.key === params.status)) setTab(params.status as Tab);
    if (params.request) {
      setSearch(params.request);
      const first = s.workOrders.find((w) => w.requestId === params.request);
      if (first) setExpanded(first.id);
    }
    if (params.workorder) setDrawerId(params.workorder);
    if (params.expand) setExpanded(params.expand);
    if (params.new === "1") { setFormWO(null); setFormOpen(true); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params?.request, params?.workorder, params?.expand, params?.status, params?.new]);

  const inTab = (w: WorkOrder, t: Tab) => {
    if (t === "open") return !closed(w);
    if (t === "awaiting") return w.status === "Awaiting Assignment" && !w.contractorId;
    if (t === "scheduled") return w.status === "Scheduled";
    if (t === "inprogress") return w.status === "In Progress";
    if (t === "completed") return w.status === "Completed";
    return true;
  };
  const tabCount = (t: Tab) => s.workOrders.filter((w) => inTab(w, t)).length;
  const reqOf = (w: WorkOrder) => s.requests.find((r) => r.id === w.requestId);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = s.workOrders.filter((w) => {
      if (!inTab(w, tab)) return false;
      if (fStatus && w.status !== fStatus) return false;
      if (fContractor && w.contractorId !== fContractor) return false;
      if (fPriority && w.priority !== fPriority) return false;
      if (fProperty && reqOf(w)?.propertyId !== fProperty) return false;
      if (!q) return true;
      const req = reqOf(w);
      return [w.id, w.title, w.description, w.requestId, req?.title ?? "", s.getProperty(req?.propertyId)?.name ?? "", s.getUnit(req?.unitId)?.name ?? "", s.getContractor(w.contractorId)?.company ?? ""].join(" ").toLowerCase().includes(q);
    });
    list.sort((a, b) => {
      let cmp = 0;
      if (sort === "target") cmp = (a.targetDate ?? "9999").localeCompare(b.targetDate ?? "9999");
      else if (sort === "scheduled") cmp = (a.scheduledDate ?? "9999").localeCompare(b.scheduledDate ?? "9999");
      else if (sort === "cost") cmp = Math.max(a.estimate ?? 0, a.actualCost ?? 0) - Math.max(b.estimate ?? 0, b.actualCost ?? 0);
      else if (sort === "title") cmp = a.title.localeCompare(b.title);
      else cmp = a.createdAt.localeCompare(b.createdAt);
      return desc ? -cmp : cmp;
    });
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.workOrders, s.requests, tab, search, fStatus, fContractor, fPriority, fProperty, sort, desc]);

  const activeFilters = [fStatus, fContractor, fPriority, fProperty].filter(Boolean).length;
  const resetFilters = () => { setFStatus(""); setFContractor(""); setFPriority(""); setFProperty(""); setPage(1); };
  const reset = () => { setTab("all"); setSearch(""); setSort("created"); setDesc(true); resetFilters(); };
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice((Math.min(page, totalPages) - 1) * pageSize, Math.min(page, totalPages) * pageSize);
  const sortBy = (key: SortKey) => {
    if (sort === key) setDesc(!desc);
    else { setSort(key); setDesc(key === "created"); }
    setPage(1);
  };
  const sortIcon = (key: SortKey) => (sort === key ? (desc ? <ArrowDown size={12} /> : <ArrowUp size={12} />) : <ArrowUpDown size={11} />);
  const ariaSort = (key: SortKey) => (sort === key ? (desc ? "descending" : "ascending") : undefined);
  const view = (id: string) => { setDrawerId(id); setMenu(null); };
  const edit = (w: WorkOrder) => { setFormWO(w); setFormOpen(true); setMenu(null); };
  const drawerWO = drawerId ? s.workOrders.find((w) => w.id === drawerId) : undefined;

  const exportCSV = () => {
    const headers = ["Work order", "Title", "Request", "Property", "Unit", "Contractor", "Priority", "Status", "Scheduled", "Target", "Estimate", "Actual"];
    const rows = filtered.map((w) => { const r = reqOf(w); return [w.id, w.title, w.requestId, s.getProperty(r?.propertyId)?.name ?? "", s.getUnit(r?.unitId)?.name ?? "Common Area", s.getContractor(w.contractorId)?.company ?? "", w.priority, w.status, w.scheduledDate ?? "", w.targetDate ?? "", w.estimate ?? "", w.actualCost ?? ""]; });
    const esc = (v: unknown) => `"${String(v).replace(/"/g, '""')}"`;
    const url = URL.createObjectURL(new Blob([[headers.map(esc).join(","), ...rows.map((row) => row.map(esc).join(","))].join("\n")], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url; a.download = "work-orders.csv"; a.click();
    URL.revokeObjectURL(url);
    s.toast(`Exported ${filtered.length} work order${filtered.length === 1 ? "" : "s"} to CSV.`);
  };

  const startWork = (w: WorkOrder) => { s.updateWorkOrder(w.id, { status: "In Progress" }, `Work order ${w.id} started`); s.toast(`${w.id} in progress.`); setMenu(null); };

  return (
    <div className="tn">
      <div className="app-shell">
        <div className="main-shell">
          <main className="main-content">
            <div className="page-heading">
              <div>
                <div className="page-title-line"><h1>Work orders</h1></div>
                <p>Contractor jobs, visits and follow-up tasks generated from maintenance requests.</p>
              </div>
              <div className="page-heading-actions">
                <Button onClick={exportCSV}><Download size={15} />Export</Button>
                <Button variant="primary" onClick={() => { setFormWO(null); setFormOpen(true); }}><Plus size={17} />New work order</Button>
              </div>
            </div>

            <section className="directory-panel" aria-label="Work order directory">
              <div className="directory-tabs" aria-label="Filter work orders">
                {TABS.map((t) => (
                  <button key={t.key} className={`directory-tab ${tab === t.key ? "selected" : ""}`} aria-pressed={tab === t.key} onClick={() => { setTab(t.key); setPage(1); }}>
                    {t.label}<span>{tabCount(t.key)}</span>
                  </button>
                ))}
                <div className="directory-tabs-end"><span className="live-dot" />{isSupabaseConfigured ? "Live" : "Demo data"}</div>
              </div>
              <div className="directory-toolbar">
                <SearchField label="Search work orders" placeholder="Search work order, request ID, property or contractor..." value={search} onChange={(v) => { setSearch(v); setPage(1); }} />
                <div className="toolbar-actions">
                  <FilterPopover title="Filter work orders" count={activeFilters} onReset={resetFilters}>
                    <FilterField id="wo-status-filter" label="Status">
                      <select id="wo-status-filter" value={fStatus} onChange={(e) => { setFStatus(e.target.value); setPage(1); }}>
                        <option value="">Any status</option>
                        {WORKORDER_STATUSES.map((st) => <option key={st}>{st}</option>)}
                      </select>
                    </FilterField>
                    <FilterField id="wo-contractor-filter" label="Contractor">
                      <select id="wo-contractor-filter" value={fContractor} onChange={(e) => { setFContractor(e.target.value); setPage(1); }}>
                        <option value="">All contractors</option>
                        {s.contractors.map((c) => <option key={c.id} value={c.id}>{c.company}</option>)}
                      </select>
                    </FilterField>
                    <FilterField id="wo-priority-filter" label="Priority">
                      <select id="wo-priority-filter" value={fPriority} onChange={(e) => { setFPriority(e.target.value); setPage(1); }}>
                        <option value="">Any priority</option>
                        {["Emergency", "High", "Normal", "Low"].map((p) => <option key={p}>{p}</option>)}
                      </select>
                    </FilterField>
                    <FilterField id="wo-property-filter" label="Property">
                      <select id="wo-property-filter" value={fProperty} onChange={(e) => { setFProperty(e.target.value); setPage(1); }}>
                        <option value="">All properties</option>
                        {s.properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </FilterField>
                  </FilterPopover>
                  <SortControl
                    label="Sort work orders"
                    value={sort}
                    defaultValue="created"
                    descending={desc}
                    options={[{ value: "target", label: "Target date" }, { value: "scheduled", label: "Scheduled date" }, { value: "cost", label: "Cost" }, { value: "title", label: "Title" }]}
                    onChange={(k) => { setSort(k as SortKey); setDesc(k === "cost"); setPage(1); }}
                    onToggle={() => setDesc(!desc)}
                  />
                </div>
              </div>

              <div className="tenant-table-wrap">
                <table className="tenant-table">
                  <caption className="sr-only">Work orders. Expand a work order for its main details; open it for visits and the work log.</caption>
                  <colgroup><col className="col-expand" /><col className="col-tenant" style={{ width: 260 }} /><col className="col-email" style={{ width: 200 }} /><col className="col-phone" style={{ width: 170 }} /><col className="col-units" style={{ width: 150 }} /><col className="col-balance" style={{ width: 130 }} /><col className="col-status" style={{ width: 140 }} /><col className="col-actions" /></colgroup>
                  <thead>
                    <tr>
                      <th className="expand-cell"><span className="sr-only">Expand</span></th>
                      <th aria-sort={ariaSort("title")}><button onClick={() => sortBy("title")}>Work order{sortIcon("title")}</button></th>
                      <th className="email-cell">Request / property</th>
                      <th className="phone-cell">Contractor</th>
                      <th className="units-cell" aria-sort={ariaSort("target")}><button onClick={() => sortBy("target")}>Schedule{sortIcon("target")}</button></th>
                      <th className="balance-cell" aria-sort={ariaSort("cost")}><button onClick={() => sortBy("cost")}>Cost{sortIcon("cost")}</button></th>
                      <th className="status-cell">Status</th>
                      <th className="actions-cell">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paged.map((w) => {
                      const open = expanded === w.id;
                      const req = reqOf(w);
                      const contractor = s.getContractor(w.contractorId);
                      const overdue = !!w.targetDate && !closed(w) && (daysUntil(w.targetDate) ?? 0) < 0;
                      return (
                        <Fragment key={w.id}>
                          <tr className={`tenant-row ${open ? "tenant-row-expanded" : ""}`}>
                            <td className="expand-cell">
                              <IconButton label={`${open ? "Collapse" : "Expand"} ${w.id}`} className="expand-button" onClick={() => setExpanded(open ? null : w.id)} aria-expanded={open} aria-controls={`details-${w.id}`}>
                                <ChevronRight size={15} className={open ? "chevron-expanded" : ""} />
                              </IconButton>
                            </td>
                            <td className="tenant-cell">
                              <div className="tenant-identity">
                                <span className={`avatar avatar-md avatar-${colorFor(w.title)}`} aria-hidden="true">{initialsOf(w.title)}</span>
                                <div>
                                  <button className="tenant-name" onClick={() => view(w.id)}>{w.title}</button>
                                  <span className="tenant-number">{w.id}</span>
                                </div>
                              </div>
                            </td>
                            <td className="email-cell"><a onClick={() => s.navigate("requests", { focusRequestId: w.requestId })} style={{ cursor: "pointer" }}>{w.requestId}</a><span className="tenant-number">{s.getProperty(req?.propertyId)?.name} · {s.getUnit(req?.unitId)?.name ?? "Common area"}</span></td>
                            <td className="phone-cell"><a className={contractor ? undefined : "amber-text"} title={contractor?.company} style={{ display: "block", maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{contractor?.company ?? "Unassigned"}</a><span className={`tenant-number ${PRIORITY_TEXT[w.priority]}`}>{w.priority} priority</span></td>
                            <td className="units-cell"><a className={overdue ? "red-text" : undefined}>{w.targetDate ? `Due ${fmtDate(w.targetDate)}` : "No target"}</a><span className={`tenant-number ${overdue ? "red-text" : ""}`}>{overdue ? "Overdue" : w.scheduledDate ? `Scheduled ${fmtDate(w.scheduledDate)}` : "Not scheduled"}</span></td>
                            <td className="balance-cell"><span className="balance-value">{w.actualCost ? fmtMoney(w.actualCost) : fmtMoney(w.estimate)}</span><span className="tenant-number">{w.actualCost ? "actual" : "estimate"}</span></td>
                            <td className="status-cell"><StatusPill tone={WO_TONE[w.status] ?? "neutral"}>{w.status}</StatusPill></td>
                            <td className="actions-cell">
                              <div className="row-actions">
                                <IconButton label={`View ${w.id}`} onClick={() => view(w.id)}><Eye size={15} /></IconButton>
                                <div className="row-more-anchor" data-row-menu>
                                  <IconButton label={`More actions for ${w.id}`} onClick={() => setMenu(menu === w.id ? null : w.id)} aria-expanded={menu === w.id}><MoreHorizontal size={17} /></IconButton>
                                  {menu === w.id && (
                                    <div className="row-menu" style={{ width: 210 }}>
                                      <button onClick={() => view(w.id)}><Eye size={14} />View work order</button>
                                      <button onClick={() => edit(w)}><Pencil size={14} />Edit work order</button>
                                      <button onClick={() => { setVisitFor(w); setMenu(null); }}><CalendarDays size={14} />Schedule a visit</button>
                                      <button onClick={() => { setWorklogFor(w); setMenu(null); }}><ClipboardList size={14} />Add work log</button>
                                      {w.status !== "In Progress" && w.status !== "Completed" && w.status !== "Cancelled" && <button onClick={() => startWork(w)}><Wrench size={14} />Start work</button>}
                                      {w.status !== "Completed" && <button onClick={() => { setCompleting(w); setMenu(null); }}><CheckCircle2 size={14} />Complete work order…</button>}
                                      <div className="menu-divider" />
                                      <button onClick={() => s.navigate("requests", { focusRequestId: w.requestId })}><ExternalLink size={14} />Open request</button>
                                      {w.status !== "Cancelled" && w.status !== "Completed" && <button className="danger-menu-item" onClick={() => { setCancelConfirm(w); setMenu(null); }}><X size={14} />Cancel work order</button>}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                          {open && (
                            <tr className="detail-row" id={`details-${w.id}`}>
                              <td colSpan={8}>
                                <div className="expanded-detail">
                                  <div className="expanded-detail-top">
                                    <span>WORK ORDER DETAILS</span>
                                    <TextLink onClick={() => view(w.id)}>Open work order<ArrowUpRight size={12} /></TextLink>
                                  </div>
                                  <div className="expanded-grid">
                                    <section className="detail-section is-compact">
                                      <SectionTitle icon={<FileText size={15} />} title="Job" />
                                      <dl className="lease-facts">
                                        <DataField label="Request">{w.requestId}</DataField>
                                        <DataField label="Priority">{w.priority}</DataField>
                                        <DataField label="Staff owner">{s.getStaff(w.staffId)?.name ?? "—"}</DataField>
                                        <DataField label="Description">{w.description.length > 70 ? `${w.description.slice(0, 70)}…` : w.description}</DataField>
                                      </dl>
                                    </section>
                                    <section className="detail-section is-compact">
                                      <SectionTitle icon={<Users size={15} />} title="Contractor" />
                                      <dl className="lease-facts">
                                        <DataField label="Company">{contractor?.company ?? "Unassigned"}</DataField>
                                        <DataField label="Contact">{contractor?.contact ?? "—"}</DataField>
                                        <DataField label="Phone">{contractor?.phone ?? "—"}</DataField>
                                      </dl>
                                    </section>
                                    <section className="detail-section is-compact">
                                      <SectionTitle icon={<CalendarClock size={15} />} title="Schedule & cost" />
                                      <dl className="lease-facts">
                                        <DataField label="Scheduled">{fmtDate(w.scheduledDate)}</DataField>
                                        <DataField label="Target">{fmtDate(w.targetDate)}</DataField>
                                        <DataField label="Estimate">{fmtMoney(w.estimate)}</DataField>
                                        <DataField label="Actual">{w.actualCost ? fmtMoney(w.actualCost) : "—"}</DataField>
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
                  title={s.workOrders.length ? "No work orders found" : "No work orders yet"}
                  description={s.workOrders.length ? "Try a different search or adjust your filters." : "Create a work order here, or generate one from a maintenance request."}
                  action={<Button onClick={s.workOrders.length ? reset : () => { setFormWO(null); setFormOpen(true); }}>{s.workOrders.length ? "Clear search & filters" : "New work order"}</Button>}
                />
              )}
              <Pager total={filtered.length} page={page} pageSize={pageSize} noun="work orders" setPage={setPage} setPageSize={setPageSize} />
            </section>
            <div className="directory-footnote">
              <span><ShieldCheck size={13} />Cancelling a work order keeps its parent request open so the work can be re-scoped or reassigned.</span>
              <span><CalendarClock size={13} />All amounts in CAD{!isSupabaseConfigured && <><span className="footnote-separator">&middot;</span>Demo data</>}</span>
            </div>
          </main>
        </div>
      </div>

      <Drawer open={!!drawerWO} onClose={() => setDrawerId(null)} title="Work order" subtitle={drawerWO ? `${drawerWO.id} · ${drawerWO.requestId}` : undefined}>
        {drawerWO && (
          <div className="px-5 py-4">
            <WorkOrderDetail wo={drawerWO} onEdit={() => edit(drawerWO)} onComplete={() => setCompleting(drawerWO)} onVisit={() => setVisitFor(drawerWO)} onWorklog={() => setWorklogFor(drawerWO)} />
          </div>
        )}
      </Drawer>

      <WorkOrderFormModal open={formOpen} onClose={() => setFormOpen(false)} workOrder={formWO} />
      <CompleteWorkOrderModal open={!!completing} onClose={() => setCompleting(null)} workOrder={completing} />
      <WorkLogModal open={!!worklogFor} onClose={() => setWorklogFor(null)} request={worklogFor ? s.requests.find((r) => r.id === worklogFor.requestId) ?? null : null} workOrderId={worklogFor?.id} />
      <VisitModal open={!!visitFor} onClose={() => setVisitFor(null)} request={visitFor ? s.requests.find((r) => r.id === visitFor.requestId) ?? null : null} />
      <ConfirmDialog
        open={!!cancelConfirm}
        onClose={() => setCancelConfirm(null)}
        title={`Cancel ${cancelConfirm?.id}?`}
        body={<>This work order will be marked as cancelled. The parent maintenance request stays open so the work can be re-scoped or reassigned.</>}
        confirmLabel="Cancel Work Order"
        danger
        onConfirm={() => {
          if (cancelConfirm) {
            s.updateWorkOrder(cancelConfirm.id, { status: "Cancelled" }, `Work order ${cancelConfirm.id} cancelled`);
            s.toast(`${cancelConfirm.id} cancelled.`, "warning");
          }
        }}
      />
      <Toasts />
    </div>
  );
}
