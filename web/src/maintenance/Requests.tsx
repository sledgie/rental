// Maintenance requests in the same format as the Properties, Leases, Units, Payments, Applications, Expenses and Projects pages: tabs, search,
// the shared Tenants-style filters, sortable master rows, an inline summary (chevron) and a side drawer with the full request record (View).
// The store, tabbed request record (visits, work log, estimates, costs, documents, activity) and every dialog come from the maintenance module.
import { Fragment, useEffect, useMemo, useState } from "react";
import {
  ArrowDown, ArrowUp, ArrowUpDown, ArrowUpRight, CalendarDays, CheckCircle2, ChevronRight, ClipboardList, Download, ExternalLink, Eye, MapPin,
  MoreHorizontal, Package, Paperclip, Pencil, Plus, RotateCcw, ShieldCheck, CalendarClock, UserCheck, Wrench, Users,
} from "lucide-react";
import { Button, DataField, EmptyState, IconButton, SectionTitle, TextLink } from "../tenants/components/ui";
import { FilterField, FilterPopover, SearchField, SortControl } from "../shell/directory";
import { Drawer } from "../projects/components/Drawer";
import { useStore } from "./store";
import { RequestDetail, type ModalState } from "./pages/Maintenance";
import {
  ApprovalModal, AssignModal, CompleteModal, EstimateModal, LinkExpenseModal, ReasonModal, ReplaceApplianceModal, RequestFormModal,
  UploadModal, VisitModal, WorkLogModal, WorkOrderFormModal,
} from "./modals";
import { Toasts } from "./Toasts";
import { Pager, StatusPill, colorFor, initialsOf, useRowMenu, type Tone } from "./common";
import { CATEGORIES, OPEN_STATUSES, PRIORITIES, REQUEST_STATUSES, type MaintenanceRequest, type Priority, type RequestStatus } from "./types";
import { daysUntil, fmtDate, fmtMoney, isOverdue, overdueDays, timeAgo } from "./utils";

type Tab = "all" | "open" | "urgent" | "awaiting" | "inprogress" | "overdue" | "closed";
type SortKey = "reportedAt" | "priority" | "target" | "cost" | "title";
const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "All requests" },
  { key: "open", label: "Open" },
  { key: "urgent", label: "Emergency / High" },
  { key: "awaiting", label: "Awaiting approval" },
  { key: "inprogress", label: "In progress" },
  { key: "overdue", label: "Overdue" },
  { key: "closed", label: "Completed" },
];
export const REQUEST_TONE: Record<RequestStatus, Tone> = {
  Draft: "neutral", New: "pending", "Under Review": "pending", "Awaiting Approval": "warn", Approved: "good", Assigned: "info",
  "In Progress": "ok", "On Hold": "warn", Completed: "good", Closed: "neutral", Rejected: "danger", Cancelled: "danger",
};
export const PRIORITY_TEXT: Record<Priority, string> = { Emergency: "red-text", High: "amber-text", Normal: "", Low: "" };
const PRIORITY_RANK: Record<string, number> = { Emergency: 0, High: 1, Normal: 2, Low: 3 };

export default function MaintenanceRequests({ params }: { params?: Record<string, string> } = {}) {
  const s = useStore();
  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  const [fProperty, setFProperty] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [fPriority, setFPriority] = useState("");
  const [fCategory, setFCategory] = useState("");
  const [fContractor, setFContractor] = useState("");
  const [fAsset, setFAsset] = useState("");
  const [fFrom, setFFrom] = useState("");
  const [fTargetBefore, setFTargetBefore] = useState("");
  const [sort, setSort] = useState<SortKey>("reportedAt");
  const [desc, setDesc] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>({ kind: "none" });
  const { menu, setMenu } = useRowMenu();
  const closeModal = () => setModal({ kind: "none" });

  // deep links: #/maintenance-requests?request=MR-1001 opens the record, ?expand=<id> opens the row, ?status=<tab or status>, ?q=<search>, ?new=1
  useEffect(() => {
    if (!params) return;
    if (params.status) {
      if (TABS.some((t) => t.key === params.status)) setTab(params.status as Tab);
      else if ((REQUEST_STATUSES as string[]).includes(params.status)) setFStatus(params.status);
    }
    if (params.q) setSearch(params.q);
    if (params.request) setDrawerId(params.request);
    if (params.expand) setExpanded(params.expand);
    if (params.new === "1") setModal({ kind: "newRequest" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params?.request, params?.expand, params?.status, params?.q, params?.new]);

  const inTab = (r: MaintenanceRequest, t: Tab) => {
    if (t === "open") return OPEN_STATUSES.includes(r.status);
    if (t === "urgent") return OPEN_STATUSES.includes(r.status) && (r.priority === "Emergency" || r.priority === "High");
    if (t === "awaiting") return r.status === "Awaiting Approval";
    if (t === "inprogress") return r.status === "In Progress";
    if (t === "overdue") return isOverdue(r);
    if (t === "closed") return r.status === "Completed" || r.status === "Closed";
    return true;
  };
  const tabCount = (t: Tab) => s.requests.filter((r) => inTab(r, t)).length;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = s.requests.filter((r) => {
      if (!inTab(r, tab)) return false;
      if (fProperty && r.propertyId !== fProperty) return false;
      if (fStatus && r.status !== fStatus) return false;
      if (fPriority && r.priority !== fPriority) return false;
      if (fCategory && r.category !== fCategory) return false;
      if (fContractor && r.assignedContractorId !== fContractor) return false;
      if (fAsset && r.assetId !== fAsset) return false;
      if (fFrom && r.reportedAt.slice(0, 10) < fFrom) return false;
      if (fTargetBefore && (!r.targetDate || r.targetDate > fTargetBefore)) return false;
      if (!q) return true;
      return [
        r.id, r.title, r.description, r.reportedByName, r.category, r.status, r.priority,
        s.getProperty(r.propertyId)?.name ?? "", s.getUnit(r.unitId)?.name ?? "", s.getTenant(r.tenantId)?.name ?? "",
        s.getContractor(r.assignedContractorId)?.company ?? "", s.getAsset(r.assetId)?.name ?? "", s.getStaff(r.assignedStaffId)?.name ?? "",
      ].join(" ").toLowerCase().includes(q);
    });
    list.sort((a, b) => {
      let cmp = 0;
      if (sort === "priority") cmp = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
      else if (sort === "target") cmp = (a.targetDate ?? "9999").localeCompare(b.targetDate ?? "9999");
      else if (sort === "cost") cmp = Math.max(s.estimatedCost(a) ?? 0, s.actualCost(a)) - Math.max(s.estimatedCost(b) ?? 0, s.actualCost(b));
      else if (sort === "title") cmp = a.title.localeCompare(b.title);
      else cmp = a.reportedAt.localeCompare(b.reportedAt);
      return desc ? -cmp : cmp;
    });
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.requests, s.estimates, s.expenses, tab, search, fProperty, fStatus, fPriority, fCategory, fContractor, fAsset, fFrom, fTargetBefore, sort, desc]);

  const activeFilters = [fProperty, fStatus, fPriority, fCategory, fContractor, fAsset, fFrom, fTargetBefore].filter(Boolean).length;
  const resetFilters = () => { setFProperty(""); setFStatus(""); setFPriority(""); setFCategory(""); setFContractor(""); setFAsset(""); setFFrom(""); setFTargetBefore(""); setPage(1); };
  const reset = () => { setTab("all"); setSearch(""); setSort("reportedAt"); setDesc(true); resetFilters(); };
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice((Math.min(page, totalPages) - 1) * pageSize, Math.min(page, totalPages) * pageSize);
  const sortBy = (key: SortKey) => {
    if (sort === key) setDesc(!desc);
    else { setSort(key); setDesc(key === "reportedAt"); }
    setPage(1);
  };
  const sortIcon = (key: SortKey) => (sort === key ? (desc ? <ArrowDown size={12} /> : <ArrowUp size={12} />) : <ArrowUpDown size={11} />);
  const ariaSort = (key: SortKey) => (sort === key ? (desc ? "descending" : "ascending") : undefined);
  const view = (id: string) => { setDrawerId(id); setMenu(null); };
  const act = (m: ModalState) => { setModal(m); setMenu(null); };

  const drawerRequest = drawerId ? s.requests.find((r) => r.id === drawerId) : undefined;
  const modalRequest = modal.kind !== "none" && modal.kind !== "newRequest" ? (modal as { req: MaintenanceRequest }).req : null;
  const liveModalRequest = modalRequest ? s.requests.find((r) => r.id === modalRequest.id) ?? modalRequest : null;

  const exportCSV = () => {
    const headers = ["Request ID", "Title", "Property", "Unit", "Category", "Priority", "Status", "Reported By", "Assigned To", "Reported", "Target", "Estimated Cost", "Actual Cost"];
    const rows = filtered.map((r) => [
      r.id, r.title, s.getProperty(r.propertyId)?.name ?? "", s.getUnit(r.unitId)?.name ?? "Common Area", r.category, r.priority, r.status, r.reportedByName,
      s.getContractor(r.assignedContractorId)?.company ?? s.getStaff(r.assignedStaffId)?.name ?? "", r.reportedAt.slice(0, 10), r.targetDate ?? "", s.estimatedCost(r) ?? "", s.actualCost(r),
    ]);
    const esc = (v: unknown) => `"${String(v).replace(/"/g, '""')}"`;
    const csv = [headers.map(esc).join(","), ...rows.map((row) => row.map(esc).join(","))].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url; a.download = "maintenance-requests.csv"; a.click();
    URL.revokeObjectURL(url);
    s.toast(`Exported ${filtered.length} request${filtered.length === 1 ? "" : "s"} to CSV.`);
  };

  return (
    <div className="tn">
      <div className="app-shell">
        <div className="main-shell">
          <main className="main-content">
            <div className="page-heading">
              <div>
                <div className="page-title-line"><h1>Maintenance requests</h1></div>
                <p>Triage, assign, track and cost every repair across your portfolio.</p>
              </div>
              <div className="page-heading-actions">
                <Button onClick={exportCSV}><Download size={15} />Export</Button>
                <Button variant="primary" onClick={() => setModal({ kind: "newRequest" })}><Plus size={17} />New request</Button>
              </div>
            </div>

            <section className="directory-panel" aria-label="Maintenance request directory">
              <div className="directory-tabs" aria-label="Filter requests">
                {TABS.map((t) => (
                  <button key={t.key} className={`directory-tab ${tab === t.key ? "selected" : ""}`} aria-pressed={tab === t.key} onClick={() => { setTab(t.key); setPage(1); }}>
                    {t.label}<span>{tabCount(t.key)}</span>
                  </button>
                ))}
                <div className="directory-tabs-end"><span className="live-dot" />Demo data</div>
              </div>
              <div className="directory-toolbar">
                <SearchField label="Search requests" placeholder="Search ID, title, tenant, property, unit, contractor or appliance..." value={search} onChange={(v) => { setSearch(v); setPage(1); }} />
                <div className="toolbar-actions">
                  <FilterPopover title="Filter requests" count={activeFilters} onReset={resetFilters}>
                    <FilterField id="mr-property-filter" label="Property">
                      <select id="mr-property-filter" value={fProperty} onChange={(e) => { setFProperty(e.target.value); setPage(1); }}>
                        <option value="">All properties</option>
                        {s.properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </FilterField>
                    <FilterField id="mr-status-filter" label="Status">
                      <select id="mr-status-filter" value={fStatus} onChange={(e) => { setFStatus(e.target.value); setPage(1); }}>
                        <option value="">Any status</option>
                        {REQUEST_STATUSES.map((st) => <option key={st}>{st}</option>)}
                      </select>
                    </FilterField>
                    <FilterField id="mr-priority-filter" label="Priority">
                      <select id="mr-priority-filter" value={fPriority} onChange={(e) => { setFPriority(e.target.value); setPage(1); }}>
                        <option value="">Any priority</option>
                        {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
                      </select>
                    </FilterField>
                    <FilterField id="mr-category-filter" label="Category">
                      <select id="mr-category-filter" value={fCategory} onChange={(e) => { setFCategory(e.target.value); setPage(1); }}>
                        <option value="">All categories</option>
                        {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                      </select>
                    </FilterField>
                    <FilterField id="mr-contractor-filter" label="Contractor">
                      <select id="mr-contractor-filter" value={fContractor} onChange={(e) => { setFContractor(e.target.value); setPage(1); }}>
                        <option value="">All contractors</option>
                        {s.contractors.map((c) => <option key={c.id} value={c.id}>{c.company}{c.active ? "" : " (inactive)"}</option>)}
                      </select>
                    </FilterField>
                    <FilterField id="mr-asset-filter" label="Asset / appliance">
                      <select id="mr-asset-filter" value={fAsset} onChange={(e) => { setFAsset(e.target.value); setPage(1); }}>
                        <option value="">All assets</option>
                        {s.assets.map((a) => <option key={a.id} value={a.id}>{a.id} · {a.name}</option>)}
                      </select>
                    </FilterField>
                    <FilterField id="mr-from-filter" label="Reported on or after">
                      <input id="mr-from-filter" type="date" value={fFrom} onChange={(e) => { setFFrom(e.target.value); setPage(1); }} />
                    </FilterField>
                    <FilterField id="mr-target-filter" label="Target date on or before">
                      <input id="mr-target-filter" type="date" value={fTargetBefore} onChange={(e) => { setFTargetBefore(e.target.value); setPage(1); }} />
                    </FilterField>
                  </FilterPopover>
                  <SortControl
                    label="Sort requests"
                    value={sort}
                    defaultValue="reportedAt"
                    descending={desc}
                    options={[{ value: "priority", label: "Priority" }, { value: "target", label: "Target date" }, { value: "cost", label: "Cost" }, { value: "title", label: "Title" }]}
                    onChange={(k) => { setSort(k as SortKey); setDesc(k === "cost" || k === "reportedAt"); setPage(1); }}
                    onToggle={() => setDesc(!desc)}
                  />
                </div>
              </div>

              <div className="tenant-table-wrap">
                <table className="tenant-table">
                  <caption className="sr-only">Maintenance requests. Expand a request for its main details; open it for visits, work log, estimates, costs and documents.</caption>
                  <colgroup><col className="col-expand" /><col className="col-tenant" style={{ width: 260 }} /><col className="col-email" style={{ width: 190 }} /><col className="col-phone" style={{ width: 160 }} /><col className="col-units" style={{ width: 160 }} /><col className="col-balance" style={{ width: 130 }} /><col className="col-status" style={{ width: 140 }} /><col className="col-actions" /></colgroup>
                  <thead>
                    <tr>
                      <th className="expand-cell"><span className="sr-only">Expand</span></th>
                      <th aria-sort={ariaSort("title")}><button onClick={() => sortBy("title")}>Request{sortIcon("title")}</button></th>
                      <th className="email-cell">Property / unit</th>
                      <th className="phone-cell" aria-sort={ariaSort("target")}><button onClick={() => sortBy("target")}>Target{sortIcon("target")}</button></th>
                      <th className="units-cell" aria-sort={ariaSort("priority")}><button onClick={() => sortBy("priority")}>Priority{sortIcon("priority")}</button></th>
                      <th className="balance-cell" aria-sort={ariaSort("cost")}><button onClick={() => sortBy("cost")}>Cost{sortIcon("cost")}</button></th>
                      <th className="status-cell">Status</th>
                      <th className="actions-cell">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paged.map((r) => {
                      const open = expanded === r.id;
                      const est = s.estimatedCost(r);
                      const actual = s.actualCost(r);
                      const overdue = isOverdue(r);
                      const finished = r.status === "Completed" || r.status === "Closed";
                      const assignee = s.getContractor(r.assignedContractorId)?.company ?? s.getStaff(r.assignedStaffId)?.name;
                      const docs = s.requestAttachments(r.id).length;
                      const property = s.getProperty(r.propertyId);
                      const unit = s.getUnit(r.unitId);
                      return (
                        <Fragment key={r.id}>
                          <tr className={`tenant-row ${open ? "tenant-row-expanded" : ""}`}>
                            <td className="expand-cell">
                              <IconButton label={`${open ? "Collapse" : "Expand"} ${r.id}`} className="expand-button" onClick={() => setExpanded(open ? null : r.id)} aria-expanded={open} aria-controls={`details-${r.id}`}>
                                <ChevronRight size={15} className={open ? "chevron-expanded" : ""} />
                              </IconButton>
                            </td>
                            <td className="tenant-cell">
                              <div className="tenant-identity">
                                <span className={`avatar avatar-md avatar-${colorFor(r.category)}`} aria-hidden="true">{initialsOf(r.category)}</span>
                                <div>
                                  <button className="tenant-name" onClick={() => view(r.id)}>{r.title}</button>
                                  <span className="tenant-number">{r.id}{r.assetId ? ` · ${r.assetId}` : ""}{docs ? ` · ${docs} file${docs === 1 ? "" : "s"}` : ""}</span>
                                </div>
                              </div>
                            </td>
                            <td className="email-cell"><a>{property?.name}</a><span className="tenant-number">{unit?.name ?? "Common area"}{r.room ? ` · ${r.room}` : ""}</span></td>
                            <td className="phone-cell">
                              <a className={overdue ? "red-text" : undefined}>{r.targetDate ? fmtDate(r.targetDate) : "No target"}</a>
                              <span className={`tenant-number ${overdue ? "red-text" : ""}`}>{overdue ? `Overdue ${overdueDays(r)}d` : `Reported ${timeAgo(r.reportedAt)}`}</span>
                            </td>
                            <td className="units-cell"><a className={PRIORITY_TEXT[r.priority]}>{r.priority}</a><span className="tenant-number">{r.category === "Heating, Ventilation & Air Conditioning" ? "HVAC" : r.category}</span></td>
                            <td className="balance-cell"><span className="balance-value">{actual > 0 ? fmtMoney(actual) : est !== null ? fmtMoney(est) : "—"}</span><span className="tenant-number">{actual > 0 ? (est !== null ? `${fmtMoney(est)} estimated` : "actual") : est !== null ? "estimated" : "no cost yet"}</span></td>
                            <td className="status-cell"><StatusPill tone={REQUEST_TONE[r.status]}>{r.status}</StatusPill></td>
                            <td className="actions-cell">
                              <div className="row-actions">
                                <IconButton label={`View ${r.id}`} onClick={() => view(r.id)}><Eye size={15} /></IconButton>
                                <div className="row-more-anchor" data-row-menu>
                                  <IconButton label={`More actions for ${r.id}`} onClick={() => setMenu(menu === r.id ? null : r.id)} aria-expanded={menu === r.id}><MoreHorizontal size={17} /></IconButton>
                                  {menu === r.id && (
                                    <div className="row-menu" style={{ width: 220 }}>
                                      <button onClick={() => view(r.id)}><Eye size={14} />View request</button>
                                      <button onClick={() => act({ kind: "editRequest", req: r })}><Pencil size={14} />Edit request</button>
                                      <button onClick={() => act({ kind: "assign", req: r })}><UserCheck size={14} />Assign staff / contractor</button>
                                      <button onClick={() => act({ kind: "visit", req: r })}><CalendarDays size={14} />Schedule visit</button>
                                      <button onClick={() => act({ kind: "worklog", req: r })}><ClipboardList size={14} />Add work log entry</button>
                                      <button onClick={() => act({ kind: "workorder", req: r })}><Wrench size={14} />Create work order</button>
                                      <div className="menu-divider" />
                                      {finished
                                        ? <button onClick={() => act({ kind: "reason", req: r, action: "reopen" })}><RotateCcw size={14} />Reopen request</button>
                                        : <button onClick={() => act({ kind: "complete", req: r })}><CheckCircle2 size={14} />Mark completed…</button>}
                                      <button onClick={() => s.navigate("workorders", { focusRequestId: r.id })}><ExternalLink size={14} />Go to work orders</button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                          {open && (
                            <tr className="detail-row" id={`details-${r.id}`}>
                              <td colSpan={8}>
                                <div className="expanded-detail">
                                  <div className="expanded-detail-top">
                                    <span>REQUEST DETAILS</span>
                                    <TextLink onClick={() => view(r.id)}>Open request record<ArrowUpRight size={12} /></TextLink>
                                  </div>
                                  <div className="expanded-grid">
                                    <section className="detail-section is-compact">
                                      <SectionTitle icon={<ClipboardList size={15} />} title="Request information" />
                                      <dl className="lease-facts">
                                        <DataField label="Category">{r.category}{r.subcategory ? ` · ${r.subcategory}` : ""}</DataField>
                                        <DataField label="Source">{r.source}</DataField>
                                        <DataField label="Reported by">{r.reportedByName}</DataField>
                                        <DataField label="Reported">{fmtDate(r.reportedAt)}</DataField>
                                        <DataField label="Approval">{r.approvalStatus}</DataField>
                                      </dl>
                                    </section>
                                    <section className="detail-section is-compact">
                                      <SectionTitle icon={<Users size={15} />} title="Assignment" />
                                      <dl className="lease-facts">
                                        <DataField label="Assigned to">{assignee ?? "Unassigned"}</DataField>
                                        <DataField label="Coordinator">{s.getStaff(r.assignedStaffId)?.name ?? "—"}</DataField>
                                        <DataField label="Next visit">{(() => { const v = s.requestVisits(r.id).filter((x) => x.status === "Scheduled").sort((a, b) => a.date.localeCompare(b.date))[0]; return v ? `${fmtDate(v.date)} · ${v.time}` : "None scheduled"; })()}</DataField>
                                        <DataField label="Work orders">{s.requestWorkOrders(r.id).length}</DataField>
                                      </dl>
                                    </section>
                                    <section className="detail-section is-compact">
                                      <SectionTitle icon={<MapPin size={15} />} title="Location" />
                                      <dl className="lease-facts">
                                        <DataField label="Property">{property?.name ?? "—"}</DataField>
                                        <DataField label="Unit">{unit?.name ?? "Common area"}</DataField>
                                        <DataField label="Tenant">{s.getTenant(r.tenantId)?.name ?? "—"}</DataField>
                                        <DataField label="Asset">{s.getAsset(r.assetId)?.name ?? "—"}</DataField>
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
                  title={s.requests.length ? "No requests found" : "Your request queue starts here"}
                  description={s.requests.length ? "Try a different search or adjust your filters." : "Log a maintenance request to triage, assign and cost it."}
                  action={<Button onClick={s.requests.length ? reset : () => setModal({ kind: "newRequest" })}>{s.requests.length ? "Clear search & filters" : "New request"}</Button>}
                />
              )}
              <Pager total={filtered.length} page={page} pageSize={pageSize} noun="requests" setPage={setPage} setPageSize={setPageSize} />
            </section>
            <div className="directory-footnote">
              <span><ShieldCheck size={13} />Costs combine approved estimates with linked invoices. Completed requests are reopened, never overwritten, so history stays intact.</span>
              <span><CalendarClock size={13} />All amounts in CAD<span className="footnote-separator">&middot;</span>Demo data</span>
            </div>
          </main>
        </div>
      </div>

      <Drawer open={!!drawerRequest} onClose={() => setDrawerId(null)} title="Maintenance request" subtitle={drawerRequest ? `${drawerRequest.id} · ${s.getProperty(drawerRequest.propertyId)?.name ?? ""}` : undefined}>
        {drawerRequest && <RequestDetail req={drawerRequest} setModal={setModal} />}
      </Drawer>

      {/* ── Dialogs ─────────────────────────────────────────────────────────── */}
      <RequestFormModal
        open={modal.kind === "newRequest"}
        onClose={closeModal}
        preset={modal.kind === "newRequest" ? modal.preset : undefined}
        onSaved={(id) => { setTab("all"); setDrawerId(id); setPage(1); }}
      />
      <RequestFormModal open={modal.kind === "editRequest"} onClose={closeModal} editing={liveModalRequest} />
      <AssignModal open={modal.kind === "assign"} onClose={closeModal} request={liveModalRequest} />
      <VisitModal open={modal.kind === "visit"} onClose={closeModal} request={liveModalRequest} visit={modal.kind === "visit" ? modal.visit : undefined} />
      <WorkLogModal open={modal.kind === "worklog"} onClose={closeModal} request={liveModalRequest} />
      <EstimateModal open={modal.kind === "estimate"} onClose={closeModal} request={liveModalRequest} estimate={modal.kind === "estimate" ? modal.estimate : undefined} />
      <ApprovalModal open={modal.kind === "approval"} onClose={closeModal} request={liveModalRequest} estimate={modal.kind === "approval" ? modal.estimate : null} mode={modal.kind === "approval" ? modal.mode : "approve"} />
      <CompleteModal open={modal.kind === "complete"} onClose={closeModal} request={liveModalRequest} />
      <ReasonModal
        open={modal.kind === "reason"}
        onClose={closeModal}
        title={
          modal.kind === "reason"
            ? modal.action === "reject" ? `Reject Request ${modal.req.id}` : modal.action === "cancel" ? `Cancel Request ${modal.req.id}` : `Reopen Request ${modal.req.id}`
            : ""
        }
        label={modal.kind === "reason" && modal.action === "reopen" ? "Why is this request being reopened?" : "Reason (recorded in activity history)"}
        confirmLabel={modal.kind === "reason" ? (modal.action === "reopen" ? "Reopen Request" : modal.action === "reject" ? "Reject Request" : "Cancel Request") : ""}
        danger={modal.kind === "reason" && modal.action !== "reopen"}
        onSubmit={(reason) => {
          if (modal.kind !== "reason" || !liveModalRequest) return;
          if (modal.action === "reopen") {
            // Preserve the previous completion (with its true final cost), then reopen
            s.updateRequest(liveModalRequest.id, {
              status: "In Progress",
              previousCompletions: [
                ...liveModalRequest.previousCompletions,
                {
                  completedAt: liveModalRequest.completedAt ?? "",
                  outcome: liveModalRequest.resolutionOutcome ?? "Repaired",
                  notes: liveModalRequest.resolutionNotes ?? "",
                  finalCost: s.actualCost(liveModalRequest),
                  reopenedAt: new Date().toISOString(),
                  reopenReason: reason,
                },
              ],
              completedAt: undefined,
              resolutionOutcome: undefined,
              resolutionNotes: undefined,
              verificationStatus: "Not Verified",
              followUpRequired: false,
            });
            s.logActivity(liveModalRequest.id, "reopen", `Request reopened — ${reason}`);
            s.toast(`${liveModalRequest.id} reopened. Prior completion preserved in history.`);
          } else {
            s.setRequestStatus(liveModalRequest.id, modal.action === "reject" ? "Rejected" : "Cancelled", { reason });
            s.toast(`${liveModalRequest.id} ${modal.action === "reject" ? "rejected" : "cancelled"}.`, "warning");
          }
        }}
      />
      <ReplaceApplianceModal open={modal.kind === "replace"} onClose={closeModal} asset={liveModalRequest?.assetId ? s.getAsset(liveModalRequest.assetId) ?? null : null} request={liveModalRequest} />
      <LinkExpenseModal open={modal.kind === "expenses"} onClose={closeModal} request={liveModalRequest} />
      <UploadModal open={modal.kind === "upload"} onClose={closeModal} requestId={liveModalRequest?.id} />
      <WorkOrderFormModal open={modal.kind === "workorder"} onClose={closeModal} presetRequest={liveModalRequest} />
      <Toasts />
    </div>
  );
}
