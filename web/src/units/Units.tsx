// Units directory in the same format as the Properties and Leases pages: tabs, search, sortable master rows, an inline
// detail panel (chevron) and a side drawer for the full profile (View). The data, drawers and sections come from the units module.
import { Fragment, useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowDownUp,
  ArrowUp,
  ArrowUpDown,
  ArrowUpRight,
  Building2,
  FileText,
  Users,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Download,
  Eye,
  MoreHorizontal,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
  Archive,
  X,
} from "lucide-react";
import { Button, DataField, EmptyState, IconButton, SectionTitle, TextLink } from "../tenants/components/ui";
import { FilterCheckbox, FilterField, FilterPopover, SearchField, SortControl } from "../shell/directory";
import { useStore } from "./store/appStore";
import { isSupabaseConfigured } from "../lib/supabase";
import {
  emptyFilters,
  filterRows,
  sortRows,
  type SortKey,
  type SortState,
  type UnitFilters,
  type UnitRow,
} from "./data/selectors";
import type { UnitStatus } from "./data/types";
import { tenantName, type DerivedLeaseStatus } from "./data/selectors";
import { formatDate, money, money0 } from "./lib/format";
import { ConfirmDialog } from "./components/ui/Modal";
import { Toasts } from "./components/ui/Toasts";
import { UnitProfileDrawer } from "./parts/UnitProfileDrawer";
import { UnitFormDrawer } from "./parts/UnitFormDrawer";

type Tab = "all" | UnitStatus | "archived";
const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "All units" },
  { key: "Occupied", label: "Occupied" },
  { key: "Vacant", label: "Vacant" },
  { key: "Reserved", label: "Reserved" },
  { key: "Under Maintenance", label: "Under maintenance" },
  { key: "archived", label: "Archived" },
];
const STATUS_CLASS: Record<UnitStatus, string> = {
  Occupied: "status-occupied",
  Vacant: "status-pending",
  Reserved: "status-draft",
  "Under Maintenance": "status-expiring",
  Inactive: "status-former",
};
const SORTS: { key: SortKey; label: string }[] = [
  { key: "property", label: "Property" },
  { key: "unitNumber", label: "Unit number" },
  { key: "rent", label: "Monthly rent" },
  { key: "status", label: "Status" },
  { key: "expiry", label: "Lease expiry" },
  { key: "balance", label: "Balance" },
  { key: "bedrooms", label: "Bedrooms" },
];

const COLORS = ["blue", "violet", "teal", "amber", "rose", "slate"] as const;
const initialsOf = (name: string) => name.split(/\s+/).filter((w) => /^[A-Za-z0-9]/.test(w)).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
const colorFor = (s: string) => {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) % 997;
  return COLORS[h % COLORS.length];
};

const inTab = (r: UnitRow, tab: Tab) =>
  tab === "archived" ? r.unit.archived : !r.unit.archived && (tab === "all" || r.unit.unitStatus === tab);

function specs(r: UnitRow) {
  const u = r.unit;
  return [
    u.bedrooms === null ? "—" : u.bedrooms === 0 ? "Studio" : `${u.bedrooms} bd`,
    u.bathrooms === null ? "—" : `${u.bathrooms} ba`,
    u.squareFootage ? `${u.squareFootage.toLocaleString("en-CA")} ft²` : "—",
  ].join(" · ");
}

function toCsv(rows: UnitRow[]) {
  const q = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = ["Unit ID", "Unit number", "Property", "City", "Type", "Bedrooms", "Bathrooms", "Sq ft", "Status", "Lease number", "Lease status", "Lease end", "Monthly rent", "Main tenant", "Outstanding", "Overdue", "Open work orders"];
  const lines = rows.map((r) =>
    [
      r.unit.id, r.unit.unitNumber, r.property?.propertyName, r.property?.city, r.unit.unitType, r.unit.bedrooms, r.unit.bathrooms, r.unit.squareFootage,
      r.unit.unitStatus, r.ctx.current?.lease.leaseNumber ?? r.ctx.holdover?.lease.leaseNumber ?? r.ctx.pending?.lease.leaseNumber, r.ctx.derivedStatus,
      r.ctx.current?.lease.endDate, r.ctx.currentRent, r.mainTenantName, r.financials.outstandingNet.toFixed(2), r.financials.overdueNet.toFixed(2), r.maintenance.openCount,
    ].map(q).join(","),
  );
  return [head.join(","), ...lines].join("\n");
}

const LEASE_STATUS_CLASS: Record<DerivedLeaseStatus, string> = {
  Active: "status-active",
  Expiring: "status-expiring",
  Expired: "status-expired",
  Terminated: "status-terminated",
  Pending: "status-pending",
  Draft: "status-draft",
  None: "status-former",
};

/** Master-detail panel: main details only (unit, tenants, lease). Financials, maintenance and the rest live in the profile drawer. */
function ExpandedUnit({ row, onView }: { row: UnitRow; onView: () => void }) {
  const u = row.unit;
  const entry = row.ctx.current ?? row.ctx.holdover ?? row.ctx.pending ?? row.ctx.draft;
  const lease = entry?.lease;
  return (
    <div className="expanded-detail">
      <div className="expanded-detail-top">
        <span>UNIT DETAILS</span>
        <TextLink onClick={onView}>
          Open unit profile
          <ArrowUpRight size={12} />
        </TextLink>
      </div>
      <div className="expanded-grid">
        <section className="detail-section is-compact">
          <SectionTitle icon={<Building2 size={15} />} title="Unit information" />
          <dl className="lease-facts">
            <DataField label="Property">{row.property?.propertyName ?? "—"}</DataField>
            <DataField label="Address">{row.property ? `${row.property.address}, ${row.property.city}, ${row.property.province} ${row.property.postalCode}` : "—"}</DataField>
            <DataField label="Type">{u.unitType}</DataField>
            <DataField label="Layout">{specs(row)}</DataField>
            <DataField label="Floor / furnishing">{u.floor ?? "—"} <span className="muted">&middot; {u.furnished}</span></DataField>
            <DataField label="Condition">{u.unitCondition}</DataField>
          </dl>
        </section>

        <section className="detail-section is-compact">
          <SectionTitle icon={<Users size={15} />} title={`Tenants (${row.occupants.length})`} />
          {row.occupants.length ? (
            <div className="people-list" style={{ maxHeight: 330, overflowY: "auto" }}>
              {row.occupants.map((o) => {
                const name = tenantName(o.tenant);
                return (
                  <div className="person-item" key={o.party.id}>
                    <span className={`avatar avatar-sm avatar-${colorFor(name)}`} aria-hidden="true">{initialsOf(name)}</span>
                    <div className="person-content">
                      <div className="person-name-line"><span className="person-name">{name}</span></div>
                      <div className="person-relationship"><div className="person-role">{o.party.role}</div></div>
                      <div className="person-contact-peek">
                        {o.tenant.phone && <a href={`tel:${o.tenant.phone.replace(/[^+\d]/g, "")}`}>{o.tenant.phone}</a>}
                        {o.tenant.email && <a href={`mailto:${o.tenant.email}`}>{o.tenant.email}</a>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState compact title="No tenants" description="Tenants appear here once the unit is on a lease." />
          )}
        </section>

        <section className="detail-section is-compact">
          <SectionTitle icon={<FileText size={15} />} title="Lease details" />
          {lease ? (
            <dl className="lease-facts">
              <DataField label="Lease number">{lease.leaseNumber}</DataField>
              <DataField label="Start date">{formatDate(lease.startDate)}</DataField>
              <DataField label="End date">{formatDate(lease.endDate)}</DataField>
              <DataField label="Status">
                <span className={`status-badge ${LEASE_STATUS_CLASS[row.ctx.derivedStatus]}`}><span className="status-dot" />{row.ctx.derivedStatus}</span>
              </DataField>
            </dl>
          ) : (
            <EmptyState compact title="No lease" description="This unit has no current, pending or draft lease." />
          )}
        </section>
      </div>
    </div>
  );
}

export default function Units({ params }: { params?: Record<string, string> } = {}) {
  const { db, rows, loading, archiveUnit, restoreUnit, pushToast, refresh } = useStore();

  // the Properties page may have added units since the last load
  useEffect(() => {
    if (isSupabaseConfigured) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [tab, setTab] = useState<Tab>("all");
  const [filters, setFilters] = useState<UnitFilters>(emptyFilters);
  const [sort, setSort] = useState<SortState>({ key: "property", dir: "asc" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [form, setForm] = useState<{ mode: "create" | "edit"; unitId: string | null } | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<UnitRow | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<UnitRow | null>(null);

  // deep links: #/units?unit=U-2003 opens that unit's drawer; ?status=Vacant, ?lease=Expiring, ?financial=overdue pre-filter the list
  useEffect(() => {
    if (!params) return;
    const patch: Partial<UnitFilters> = {};
    if (params.q) patch.query = params.q;
    if (params.lease) patch.lease = params.lease as UnitFilters["lease"];
    if (params.financial) patch.financial = params.financial as UnitFilters["financial"];
    if (Object.keys(patch).length) setFilters((f) => ({ ...f, ...patch }));
    if (params.status && TABS.some((t) => t.key === params.status)) setTab(params.status as Tab);
    if (params.unit) setProfileId(params.unit);
    if (params.expand) setExpandedId(params.expand);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params?.unit, params?.expand, params?.status, params?.lease, params?.financial, params?.q]);

  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest("[data-row-menu]")) setMenu(null);
    };
    const key = (e: KeyboardEvent) => e.key === "Escape" && setMenu(null);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", key);
    };
  }, [menu]);

  const sorted = useMemo(() => sortRows(filterRows(rows, filters).filter((r) => inTab(r, tab)), sort), [rows, filters, tab, sort]);
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);
  const properties = db.properties;
  const unitTypes = useMemo(() => Array.from(new Set(db.units.map((u) => u.unitType))).sort(), [db.units]);
  const activeFilterCount = [filters.query, filters.propertyId !== "all", filters.lease !== "all", filters.financial !== "all", filters.unitType !== "all", filters.bedrooms !== "all"].filter(Boolean).length;
  const patch = (p: Partial<UnitFilters>) => { setFilters((f) => ({ ...f, ...p })); setPage(1); };
  const reset = () => { setFilters(emptyFilters); setTab("all"); setPage(1); };
  const popoverCount = [filters.propertyId !== "all", filters.lease !== "all", filters.financial !== "all", filters.unitType !== "all", filters.bedrooms !== "all", filters.workInProgress].filter(Boolean).length;
  const resetFilters = () => { setFilters((f) => ({ ...emptyFilters, query: f.query })); setPage(1); };

  const sortBy = (key: SortKey) => {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
    setPage(1);
  };
  const sortIcon = (key: SortKey) => (sort.key === key ? (sort.dir === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ArrowUpDown size={11} />);
  const ariaSort = (key: SortKey) => (sort.key === key ? (sort.dir === "asc" ? "ascending" : "descending") : undefined);

  const exportCsv = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([toCsv(sorted)], { type: "text/csv;charset=utf-8" }));
    a.download = `units-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(a.href);
    pushToast({ tone: "azure", title: "Export ready", message: `${sorted.length} unit${sorted.length === 1 ? "" : "s"} exported with the current filters and sort.` });
  };

  const profileRow = profileId ? rows.find((r) => r.unit.id === profileId) ?? null : null;
  const formUnit = form?.unitId ? db.units.find((u) => u.id === form.unitId) ?? null : null;
  const openProfile = (id: string) => { setProfileId(id); setMenu(null); };

  return (
    <div className="tn">
      <div className="app-shell">
        <div className="main-shell">
          <main className="main-content">
            <div className="page-heading">
              <div>
                <div className="page-title-line"><h1>Units</h1></div>
                <p>Manage rental units, occupancy, leases, income, and maintenance.</p>
              </div>
              <div className="page-heading-actions">
                <Button onClick={exportCsv}><Download size={15} />Export</Button>
                <Button variant="primary" onClick={() => setForm({ mode: "create", unitId: null })}><Plus size={17} />Add unit</Button>
              </div>
            </div>

            <section className="directory-panel" aria-label="Unit directory">
              <div className="directory-tabs" aria-label="Filter units">
                {TABS.map((t) => (
                  <button key={t.key} className={`directory-tab ${tab === t.key ? "selected" : ""}`} aria-pressed={tab === t.key} onClick={() => { setTab(t.key); setPage(1); }}>
                    {t.label}<span>{rows.filter((r) => inTab(r, t.key)).length}</span>
                  </button>
                ))}
                <div className="directory-tabs-end"><span className="live-dot" />{isSupabaseConfigured ? "Live" : "Demo data"}</div>
              </div>
              <div className="directory-toolbar">
                <SearchField label="Search units" placeholder="Search unit, property, tenant, lease or phone..." value={filters.query} onChange={(v) => patch({ query: v })} />
                <div className="toolbar-actions">
                  <FilterPopover title="Filter units" count={popoverCount} onReset={resetFilters}>
                    <FilterCheckbox checked={filters.workInProgress} onChange={(v) => patch({ workInProgress: v })} label="Work in progress" hint="Open work orders or active projects" />
                    <FilterField id="unit-property-filter" label="Property">
                      <select id="unit-property-filter" value={filters.propertyId} onChange={(e) => patch({ propertyId: e.target.value })}>
                        <option value="all">All properties</option>
                        {properties.map((p) => <option key={p.id} value={p.id}>{p.propertyName}</option>)}
                      </select>
                    </FilterField>
                    <FilterField id="unit-lease-filter" label="Lease status">
                      <select id="unit-lease-filter" value={filters.lease} onChange={(e) => patch({ lease: e.target.value as UnitFilters["lease"] })}>
                        <option value="all">Any lease</option>
                        <option value="none">No lease</option>
                        <option value="Pending">Pending</option>
                        <option value="Active">Active</option>
                        <option value="Expiring">Expiring soon</option>
                        <option value="Expired">Expired</option>
                        <option value="Terminated">Terminated</option>
                      </select>
                    </FilterField>
                    <FilterField id="unit-financial-filter" label="Balance">
                      <select id="unit-financial-filter" value={filters.financial} onChange={(e) => patch({ financial: e.target.value as UnitFilters["financial"] })}>
                        <option value="all">Any balance</option>
                        <option value="clear">Paid up</option>
                        <option value="outstanding">Outstanding</option>
                        <option value="overdue">Overdue</option>
                      </select>
                    </FilterField>
                    <FilterField id="unit-type-filter" label="Unit type">
                      <select id="unit-type-filter" value={filters.unitType} onChange={(e) => patch({ unitType: e.target.value })}>
                        <option value="all">All types</option>
                        {unitTypes.map((t) => <option key={t}>{t}</option>)}
                      </select>
                    </FilterField>
                    <FilterField id="unit-bedrooms-filter" label="Bedrooms">
                      <select id="unit-bedrooms-filter" value={filters.bedrooms} onChange={(e) => patch({ bedrooms: e.target.value })}>
                        <option value="all">Any bedrooms</option>
                        <option value="studio">Studio</option>
                        <option value="1">1 bedroom</option>
                        <option value="2">2 bedrooms</option>
                        <option value="3+">3+ bedrooms</option>
                      </select>
                    </FilterField>
                  </FilterPopover>
                  <SortControl
                    label="Sort units"
                    value={sort.key}
                    defaultValue="property"
                    descending={sort.dir === "desc"}
                    options={SORTS.map((x) => ({ value: x.key, label: x.label }))}
                    onChange={(k) => { setSort({ key: k as SortKey, dir: "asc" }); setPage(1); }}
                    onToggle={() => setSort((x) => ({ ...x, dir: x.dir === "asc" ? "desc" : "asc" }))}
                  />
                </div>
              </div>

              <div className="tenant-table-wrap">
                <table className="tenant-table">
                  <caption className="sr-only">Unit directory. Expand a unit for its tenants, lease, financials and maintenance; open the profile for documents and history.</caption>
                  <colgroup><col className="col-expand" /><col className="col-tenant" style={{ width: 200 }} /><col className="col-email" style={{ width: 190 }} /><col className="col-phone" style={{ width: 175 }} /><col className="col-units" style={{ width: 190 }} /><col className="col-balance" style={{ width: 130 }} /><col className="col-status" style={{ width: 120 }} /><col className="col-actions" /></colgroup>
                  <thead>
                    <tr>
                      <th className="expand-cell"><span className="sr-only">Expand</span></th>
                      <th aria-sort={ariaSort("unitNumber")}><button onClick={() => sortBy("unitNumber")}>Unit{sortIcon("unitNumber")}</button></th>
                      <th className="email-cell" aria-sort={ariaSort("property")}><button onClick={() => sortBy("property")}>Property{sortIcon("property")}</button></th>
                      <th className="phone-cell" aria-sort={ariaSort("bedrooms")}><button onClick={() => sortBy("bedrooms")}>Layout{sortIcon("bedrooms")}</button></th>
                      <th className="units-cell" aria-sort={ariaSort("expiry")}><button onClick={() => sortBy("expiry")}>Tenant / lease{sortIcon("expiry")}</button></th>
                      <th className="balance-cell" aria-sort={ariaSort("rent")}><button onClick={() => sortBy("rent")}>Monthly rent{sortIcon("rent")}</button></th>
                      <th className="status-cell" aria-sort={ariaSort("status")}><button onClick={() => sortBy("status")}>Status{sortIcon("status")}</button></th>
                      <th className="actions-cell">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paged.map((r) => {
                      const u = r.unit;
                      const open = expandedId === u.id;
                      const lease = r.ctx.current?.lease ?? r.ctx.holdover?.lease ?? r.ctx.pending?.lease;
                      const owing = r.financials.outstandingNet > 0;
                      return (
                        <Fragment key={u.id}>
                          <tr className={`tenant-row ${open ? "tenant-row-expanded" : ""}`}>
                            <td className="expand-cell">
                              <IconButton label={`${open ? "Collapse" : "Expand"} unit ${u.unitNumber}`} className="expand-button" onClick={() => setExpandedId(open ? null : u.id)} aria-expanded={open} aria-controls={`details-${u.id}`}>
                                <ChevronRight size={15} className={open ? "chevron-expanded" : ""} />
                              </IconButton>
                            </td>
                            <td className="tenant-cell">
                              <div className="tenant-identity">
                                <span className={`avatar avatar-md avatar-${colorFor(u.id)}`} aria-hidden="true">{u.unitNumber.slice(0, 3)}</span>
                                <div>
                                  <button className="tenant-name" onClick={() => openProfile(u.id)}>Unit {u.unitNumber}</button>
                                  <span className="tenant-number">{u.code ?? u.id}<span>{u.unitType}</span></span>
                                </div>
                              </div>
                            </td>
                            <td className="email-cell" title={r.property ? `${r.property.address}, ${r.property.city}` : ""}>
                              <a>{r.property?.propertyName ?? "—"}</a>
                              <span className="tenant-number">{r.property ? `${r.property.city}, ${r.property.province}` : ""}</span>
                            </td>
                            <td className="phone-cell"><a>{specs(r)}</a><span className="tenant-number">{u.furnished}</span></td>
                            <td className="units-cell">
                              <a>{r.mainTenantName ?? "No tenant"}</a>
                              <span className="tenant-number">{lease ? `${lease.leaseNumber} · ${r.ctx.derivedStatus}` : "No active lease"}</span>
                            </td>
                            <td className="balance-cell">
                              {r.ctx.currentRent === null ? (
                                <span className="balance-value zero-balance">{r.ctx.rentBasis === "unallocated" ? "Unallocated" : u.advertisedRent ? money(u.advertisedRent) : "—"}</span>
                              ) : (
                                <span className="balance-value">{money(r.ctx.currentRent)}</span>
                              )}
                              {owing ? (
                                <span className="overdue-label">{r.financials.overdueNet > 0 ? `${money0(r.financials.overdueNet)} overdue` : `${money0(r.financials.outstandingNet)} owing`}</span>
                              ) : (
                                <span className="tenant-number">{r.ctx.currentRent === null ? (u.advertisedRent ? "advertised" : "no current lease") : r.ctx.rentBasis === "allocation" && r.ctx.sharedUnits.length > 1 ? `shared · ${r.ctx.sharedUnits.length} units` : "per month"}</span>
                              )}
                            </td>
                            <td className="status-cell">
                              {u.archived ? (
                                <span className="status-badge status-former"><span className="status-dot" />Archived</span>
                              ) : (
                                <span className={`status-badge ${STATUS_CLASS[u.unitStatus]}`}><span className="status-dot" />{u.unitStatus}</span>
                              )}
                            </td>
                            <td className="actions-cell">
                              <div className="row-actions">
                                <IconButton label={`View unit ${u.unitNumber}`} onClick={() => openProfile(u.id)}><Eye size={15} /></IconButton>
                                <IconButton label={`Edit unit ${u.unitNumber}`} onClick={() => setForm({ mode: "edit", unitId: u.id })}><Pencil size={14} /></IconButton>
                                <div className="row-more-anchor" data-row-menu>
                                  <IconButton label={`More actions for unit ${u.unitNumber}`} onClick={() => setMenu(menu === u.id ? null : u.id)} aria-expanded={menu === u.id}><MoreHorizontal size={17} /></IconButton>
                                  {menu === u.id && (
                                    <div className="row-menu">
                                      <button onClick={() => openProfile(u.id)}><Eye size={14} />View profile</button>
                                      <button onClick={() => { setForm({ mode: "edit", unitId: u.id }); setMenu(null); }}><Pencil size={14} />Edit unit</button>
                                      <div className="menu-divider" />
                                      {u.archived ? (
                                        <button onClick={() => { setRestoreTarget(r); setMenu(null); }}><RotateCcw size={14} />Restore unit</button>
                                      ) : (
                                        <button onClick={() => { setArchiveTarget(r); setMenu(null); }}><Archive size={14} />Archive unit</button>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                          {open && (
                            <tr className="detail-row" id={`details-${u.id}`}>
                              <td colSpan={8}>
                                <ExpandedUnit row={r} onView={() => openProfile(u.id)} />
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
                  title={loading ? "Loading units..." : rows.length ? "No units found" : "Your unit register starts here"}
                  description={loading ? "Fetching the unit register." : rows.length ? "Try a different search or adjust your filters." : "Add your first unit to start tracking occupancy and rent."}
                  action={loading ? undefined : <Button onClick={rows.length ? reset : () => setForm({ mode: "create", unitId: null })}>{rows.length ? "Clear search & filters" : "Add your first unit"}</Button>}
                />
              )}
              <div className="table-pagination">
                <p>Showing <strong>{sorted.length ? (safePage - 1) * pageSize + 1 : 0}-{Math.min(safePage * pageSize, sorted.length)}</strong> of <strong>{sorted.length}</strong> units</p>
                <div className="pagination-controls">
                  <label className="page-size">
                    <span>Rows per page</span>
                    <select aria-label="Rows per page" value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}><option value={8}>8</option><option value={16}>16</option><option value={24}>24</option></select>
                  </label>
                  <div className="pagination-buttons">
                    <IconButton className="first-page" label="First page" disabled={safePage === 1} onClick={() => setPage(1)}><ChevronsLeft size={15} /></IconButton>
                    <IconButton label="Previous page" disabled={safePage === 1} onClick={() => setPage(safePage - 1)}><ChevronLeft size={15} /></IconButton>
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter((n) => totalPages <= 5 || Math.abs(n - safePage) <= 1 || n === 1 || n === totalPages)
                      .map((n, i, arr) => (
                        <Fragment key={n}>
                          {i > 0 && n - arr[i - 1] > 1 && <span className="pagination-ellipsis">...</span>}
                          <button className={`page-number ${safePage === n ? "selected" : ""}`} aria-label={`Page ${n}`} aria-current={safePage === n ? "page" : undefined} onClick={() => setPage(n)}>{n}</button>
                        </Fragment>
                      ))}
                    <IconButton label="Next page" disabled={safePage === totalPages} onClick={() => setPage(safePage + 1)}><ChevronRight size={15} /></IconButton>
                    <IconButton className="last-page" label="Last page" disabled={safePage === totalPages} onClick={() => setPage(totalPages)}><ChevronsRight size={15} /></IconButton>
                  </div>
                </div>
              </div>
            </section>
            <div className="directory-footnote">
              <span><ShieldCheck size={13} />Contract rent comes from leases; advertised rent is shown only for units with no current lease.</span>
              <span>All amounts in CAD{!isSupabaseConfigured && <><span className="footnote-separator">&middot;</span>Demo data</>}</span>
            </div>
          </main>
        </div>
      </div>

      <UnitProfileDrawer row={profileRow} db={db} onClose={() => setProfileId(null)} onEdit={(id) => { setProfileId(null); setForm({ mode: "edit", unitId: id }); }} />
      {form && <UnitFormDrawer key={`${form.mode}-${form.unitId ?? "new"}`} open mode={form.mode} unit={formUnit} db={db} onClose={() => setForm(null)} />}

      <ConfirmDialog
        open={!!archiveTarget}
        onClose={() => setArchiveTarget(null)}
        title={`Archive unit ${archiveTarget?.unit.unitNumber ?? ""}?`}
        confirmLabel="Archive unit"
        body={
          <>
            <p>{archiveTarget?.unit.unitNumber} at {archiveTarget?.property?.propertyName} will be withdrawn from the active register. It stops appearing in occupancy and rent reporting.</p>
            {archiveTarget?.ctx.current && (
              <p className="text-u-warn">This unit still has lease {archiveTarget.ctx.current.lease.leaseNumber} in term. End or transfer the lease before archiving to keep occupancy data consistent.</p>
            )}
          </>
        }
        details={archiveTarget && <p>Historical leases ({archiveTarget.ctx.all.length}), tenants ({archiveTarget.occupants.length}), transactions, maintenance, documents and activity are all preserved.</p>}
        onConfirm={async () => {
          if (!archiveTarget) return;
          if (!(await archiveUnit(archiveTarget.unit.id))) return;
          pushToast({ tone: "amber", title: `Unit ${archiveTarget.unit.unitNumber} archived`, message: "All history retained. Restore it any time from the row menu." });
          setExpandedId(null);
        }}
      />
      <ConfirmDialog
        open={!!restoreTarget}
        onClose={() => setRestoreTarget(null)}
        tone="azure"
        icon="refresh"
        title={`Restore unit ${restoreTarget?.unit.unitNumber ?? ""}?`}
        confirmLabel="Restore to register"
        body={<p>The unit returns to active reporting. Its historical records are untouched.</p>}
        onConfirm={async () => {
          if (!restoreTarget) return;
          if (!(await restoreUnit(restoreTarget.unit.id))) return;
          pushToast({ tone: "jade", title: `Unit ${restoreTarget.unit.unitNumber} restored`, message: "Back in active reporting." });
        }}
      />
      <Toasts />
    </div>
  );
}
