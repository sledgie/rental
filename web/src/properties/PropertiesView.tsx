// Properties directory in the same format as the Tenants page: tabs, search, sortable master rows and an expandable detail panel.
// Uses the Tenants module's (.tn) styles and small UI parts.
import { Fragment, useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowDownUp,
  ArrowUp,
  ArrowUpDown,
  ArrowUpRight,
  Building2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CircleDollarSign,
  Eye,
  Download,
  Home,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import {
  currency,
  propertyAtRisk,
  propertyBalance,
  propertyCollectionRate,
  propertyOccupied,
  propertyRentRoll,
  propertyTenants,
  type Property,
  type Unit,
} from "./data/properties";
import { PropertyProfile, type ProfileTab } from "./PropertyProfile";
import { Button, DataField, EmptyState, IconButton, SectionTitle, TextLink } from "../tenants/components/ui";

type Tab = "all" | "arrears" | "current" | "vacancy";
type SortKey = "default" | "name" | "balance" | "units";

const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "All properties" },
  { key: "arrears", label: "With arrears" },
  { key: "current", label: "Fully current" },
  { key: "vacancy", label: "Has vacancy" },
];

const COLORS = ["blue", "violet", "teal", "amber", "rose", "slate"] as const;
const initials = (name: string) =>
  name.replace(/^The\s+/i, "").split(/\s+/).slice(0, 2).map((w) => w[0] ?? "").join("").toUpperCase();
const colorFor = (s: string) => {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) % 997;
  return COLORS[h % COLORS.length];
};
const hasVacancy = (p: Property) => p.units.some((u) => u.status === "vacant" || u.status === "notice");

/** One status per property, worst first. */
function statusOf(p: Property): { label: string; cls: string } {
  if (p.units.some((u) => u.status === "delinquent")) return { label: "Delinquent", cls: "status-terminated" };
  if (propertyBalance(p) > 0) return { label: "Arrears", cls: "status-expiring" };
  if (hasVacancy(p)) return { label: "Vacancy", cls: "status-pending" };
  return { label: "Current", cls: "status-active" };
}

function Initials({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  return (
    <span className={`avatar avatar-${size} avatar-${colorFor(name)}`} aria-hidden="true">
      {initials(name)}
    </span>
  );
}

function PropertyBadge({ p }: { p: Property }) {
  const s = statusOf(p);
  return (
    <span className={`status-badge ${s.cls}`}>
      <span className="status-dot" />
      {s.label}
    </span>
  );
}

function unitLabel(u: Unit) {
  return { current: "Current", late: "Late", delinquent: "Delinquent", vacant: "Vacant", notice: "Notice" }[u.status];
}

function ExpandedProperty({ p, onView }: { p: Property; onView: () => void }) {
  const balance = propertyBalance(p);
  const occupied = propertyOccupied(p);
  const residents = p.units.flatMap((u) => u.tenants.map((t) => ({ ...t, unit: u.unit })));
  const risk = propertyAtRisk(p);
  const rate = propertyCollectionRate(p);
  return (
    <div className="expanded-detail">
      <div className="expanded-detail-top">
        <span>PROPERTY DETAILS</span>
        <TextLink onClick={onView}>
          View full profile
          <ArrowUpRight size={12} />
        </TextLink>
      </div>
      <div className="expanded-grid">
        <section className="detail-section is-compact">
          <SectionTitle icon={<Building2 size={15} />} title="Property information" />
          <dl className="lease-facts">
            <DataField label="Type">{p.type}</DataField>
            <DataField label="Address">
              {p.address1}, {p.city}, {p.state} {p.zip}
            </DataField>
            <DataField label="Manager">{p.manager}</DataField>
            <DataField label="Contact">
              {p.managerPhone !== "—" ? <a href={`tel:${p.managerPhone.replace(/[^+\d]/g, "")}`}>{p.managerPhone}</a> : "—"}
              {p.managerEmail !== "—" && (
                <>
                  <br />
                  <a href={`mailto:${p.managerEmail}`}>{p.managerEmail}</a>
                </>
              )}
            </DataField>
            <DataField label="Acquired / built">
              {p.acquired} <span className="muted">&middot; built {p.yearBuilt}</span>
            </DataField>
          </dl>
        </section>

        <section className="detail-section is-compact">
          <SectionTitle icon={<Home size={15} />} title={`Units (${p.units.length})`} />
          <div className="unit-lease-group" style={{ maxHeight: 330, overflowY: "auto" }}>
            {p.units.map((u) => (
              <div className="unit-item" key={u.unit}>
                <div className="unit-item-top">
                  <span className="unit-name">Unit {u.unit}</span>
                  <span className={`occupancy ${u.status === "vacant" ? "historical" : ""}`}>
                    <i />
                    {unitLabel(u)}
                  </span>
                </div>
                <p className="unit-address">
                  {u.beds} bd &middot; {u.baths} ba &middot; {u.sqft.toLocaleString()} sf
                  {u.tenants[0] ? ` · ${u.tenants[0].name}` : ""}
                </p>
                <div className="unit-rent">
                  <span>
                    {currency(u.rent)}
                    <span className="muted"> / mo</span>
                  </span>
                  {u.balance > 0 && <span className="amber-text">{currency(u.balance)} due</span>}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="detail-section is-compact">
          <SectionTitle icon={<Users size={15} />} title="Residents" />
          {residents.length ? (
            <div className="people-list" style={{ maxHeight: 330, overflowY: "auto" }}>
              {residents.map((r) => (
                <div className="person-item" key={`${r.unit}-${r.name}`}>
                  <Initials name={r.name} size="sm" />
                  <div className="person-content">
                    <div className="person-name-line">
                      <span className="person-name">{r.name}</span>
                    </div>
                    <div className="person-relationship">
                      <div className="person-role">
                        {r.role}
                        <span className="dot-separator">&middot;</span>Unit {r.unit}
                      </div>
                    </div>
                    <div className="person-contact-peek">
                      <span>Since {r.since}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState compact title="No residents yet" description="Residents appear here once units are leased." />
          )}
        </section>

        <section className="detail-section is-compact financial-section">
          <SectionTitle icon={<CircleDollarSign size={15} />} title="Financial summary" />
          <div className="financial-balance">
            <span>Outstanding balance</span>
            <strong className={balance > 0 ? (risk > 0 ? "red-text" : "amber-text") : ""}>
              {currency(balance)}
              <small>USD</small>
            </strong>
          </div>
          <dl className="financial-facts">
            <DataField label="Monthly rent roll">{currency(propertyRentRoll(p))}</DataField>
            <DataField label="Occupancy">
              {occupied} of {p.units.length} units
            </DataField>
            <DataField label="On-time payments">{p.units.some((u) => u.history.length) ? `${Math.round(rate * 100)}%` : "No history yet"}</DataField>
            <DataField label="Units at risk">
              <span className={risk > 0 ? "amber-text" : ""}>{risk}</span>
            </DataField>
          </dl>
          {balance === 0 && <span className="settled-note">No outstanding balance</span>}
          <p className="account-scope">
            {propertyTenants(p)} {propertyTenants(p) === 1 ? "resident" : "residents"} across {p.units.length} units.
          </p>
        </section>
      </div>
    </div>
  );
}

export default function PropertiesView({
  properties,
  onAdd,
  onEdit,
  notify,
  openCode,
  onOpened,
}: {
  properties: Property[];
  onAdd: () => void;
  onEdit: (p: Property) => void;
  notify?: (message: string) => void;
  /** property code from a deep link (#/properties?property=PR-1042): open its profile, then call onOpened */
  openCode?: string;
  onOpened?: () => void;
}) {
  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("default");
  const [desc, setDesc] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(() =>
    window.matchMedia("(min-width: 1161px)").matches ? "PR-1042" : null,
  );
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);
  const [menu, setMenu] = useState<string | null>(null);
  const [profile, setProfile] = useState<{ code: string; tab: ProfileTab } | null>(null);
  useEffect(() => {
    if (!openCode) return;
    if (properties.some((x) => x.code === openCode)) setProfile({ code: openCode, tab: "Overview" });
    onOpened?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openCode]);
  const profileProperty = profile ? properties.find((x) => x.code === profile.code) : undefined;

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

  const matches = (p: Property, t: Tab) =>
    t === "all" || (t === "arrears" && propertyBalance(p) > 0) || (t === "current" && propertyBalance(p) === 0) || (t === "vacancy" && hasVacancy(p));

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    let out = properties.filter((p) => {
      if (!matches(p, tab)) return false;
      if (!q) return true;
      const hay = [p.code, p.name, p.address1, p.city, p.state, p.zip, p.manager, ...p.units.flatMap((u) => [u.unit, ...u.tenants.map((t) => t.name)])]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
    if (sort !== "default") {
      const cmp = {
        name: (a: Property, b: Property) => a.name.localeCompare(b.name),
        balance: (a: Property, b: Property) => propertyBalance(a) - propertyBalance(b),
        units: (a: Property, b: Property) => a.units.length - b.units.length,
      }[sort];
      out = [...out].sort(cmp);
      if (desc) out.reverse();
    }
    return out;
  }, [properties, tab, search, sort, desc]);

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginated = rows.slice((safePage - 1) * pageSize, safePage * pageSize);
  const reset = () => { setTab("all"); setSearch(""); setSort("default"); setPage(1); };
  const sortBy = (k: SortKey) => {
    if (sort === k) setDesc(!desc);
    else { setSort(k); setDesc(k !== "name"); }
    setPage(1);
  };
  const sortIcon = (k: SortKey) => (sort === k ? (desc ? <ArrowDown size={12} /> : <ArrowUp size={12} />) : <ArrowUpDown size={11} />);
  const ariaSort = (k: SortKey) => (sort === k ? (desc ? "descending" : "ascending") : undefined);

  const exportCsv = () => {
    const q = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const csv = [
      ["Code", "Property", "Type", "Address", "City", "State", "Manager", "Units", "Occupied", "Balance", "Status"],
      ...rows.map((p) => [p.code, p.name, p.type, p.address1, p.city, p.state, p.manager, p.units.length, propertyOccupied(p), propertyBalance(p), statusOf(p).label]),
    ].map((r) => r.map(q).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `properties-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(a.href);
    notify?.(`Exported ${rows.length} ${rows.length === 1 ? "property" : "properties"} to CSV.`);
  };

  return (
    <div className="tn">
      <div className="app-shell">
        <div className="main-shell">
          <main className="main-content">
            <div className="page-heading">
              <div>
                <div className="page-title-line">
                  <h1>Properties</h1>
                </div>
                <p>Manage properties, units, residents, and balances.</p>
              </div>
              <div className="page-heading-actions">
                <Button onClick={exportCsv}>
                  <Download size={15} />
                  Export
                </Button>
                <Button variant="primary" onClick={onAdd}>
                  <Plus size={17} />
                  Add property
                </Button>
              </div>
            </div>

            <section className="directory-panel" aria-label="Property directory">
              <div className="directory-tabs" aria-label="Filter properties">
                {TABS.map((t) => (
                  <button
                    key={t.key}
                    className={`directory-tab ${tab === t.key ? "selected" : ""}`}
                    aria-pressed={tab === t.key}
                    onClick={() => { setTab(t.key); setPage(1); }}
                  >
                    {t.label}
                    <span>{properties.filter((p) => matches(p, t.key)).length}</span>
                  </button>
                ))}
                <div className="directory-tabs-end">
                  <span className="live-dot" />
                  Demo data
                </div>
              </div>
              <div className="directory-toolbar">
                <div className="search-field">
                  <Search size={17} />
                  <input
                    aria-label="Search properties"
                    placeholder="Search property, address, unit or resident..."
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  />
                  {search && (
                    <IconButton label="Clear search" onClick={() => setSearch("")}>
                      <X size={14} />
                    </IconButton>
                  )}
                </div>
                <div className="toolbar-actions">
                  <label className="sort-control">
                    <ArrowDownUp size={15} />
                    <span className="sr-only">Sort properties</span>
                    <select
                      aria-label="Sort properties"
                      value={sort}
                      onChange={(e) => { const k = e.target.value as SortKey; setSort(k); setDesc(k === "balance" || k === "units"); setPage(1); }}
                    >
                      <option value="default">Sort by</option>
                      <option value="name">Property name</option>
                      <option value="balance">Balance</option>
                      <option value="units">Number of units</option>
                    </select>
                    <ChevronDown size={13} />
                  </label>
                  {sort !== "default" && (
                    <IconButton className="sort-direction" label={desc ? "Sort ascending" : "Sort descending"} onClick={() => setDesc(!desc)}>
                      {desc ? <ArrowDown size={16} /> : <ArrowUp size={16} />}
                    </IconButton>
                  )}
                </div>
              </div>

              <div className="tenant-table-wrap">
                <table className="tenant-table">
                  <caption className="sr-only">
                    Property directory. Expand a property to inspect its units, residents, and balances.
                  </caption>
                  <colgroup>
                    <col className="col-expand" />
                    <col className="col-tenant" />
                    <col className="col-email" />
                    <col className="col-phone" />
                    <col className="col-units" />
                    <col className="col-balance" />
                    <col className="col-status" />
                    <col className="col-actions" />
                  </colgroup>
                  <thead>
                    <tr>
                      <th className="expand-cell"><span className="sr-only">Expand</span></th>
                      <th aria-sort={ariaSort("name")}>
                        <button onClick={() => sortBy("name")}>Property{sortIcon("name")}</button>
                      </th>
                      <th className="email-cell">Address</th>
                      <th className="phone-cell">Manager</th>
                      <th className="units-cell" aria-sort={ariaSort("units")}>
                        <button onClick={() => sortBy("units")}>Units{sortIcon("units")}</button>
                      </th>
                      <th className="balance-cell" aria-sort={ariaSort("balance")}>
                        <button onClick={() => sortBy("balance")}>Balance{sortIcon("balance")}</button>
                      </th>
                      <th className="status-cell">Status</th>
                      <th className="actions-cell">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map((p) => {
                      const open = expanded === p.code;
                      const balance = propertyBalance(p);
                      const risk = propertyAtRisk(p);
                      return (
                        <Fragment key={p.code}>
                          <tr className={`tenant-row ${open ? "tenant-row-expanded" : ""}`}>
                            <td className="expand-cell">
                              <IconButton
                                label={`${open ? "Collapse" : "Expand"} ${p.name}`}
                                className="expand-button"
                                onClick={() => setExpanded(open ? null : p.code)}
                                aria-expanded={open}
                                aria-controls={`details-${p.code}`}
                              >
                                <ChevronRight size={15} className={open ? "chevron-expanded" : ""} />
                              </IconButton>
                            </td>
                            <td className="tenant-cell">
                              <div className="tenant-identity">
                                <Initials name={p.name} />
                                <div>
                                  <button className="tenant-name" onClick={() => setProfile({ code: p.code, tab: "Overview" })}>
                                    {p.name}
                                  </button>
                                  <span className="tenant-number">
                                    {p.code}
                                    <span>{p.type}</span>
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td className="email-cell" title={`${p.address1}, ${p.city}, ${p.state} ${p.zip}`}>
                              <a>{p.address1}</a>
                              <span className="tenant-number">{p.city}, {p.state} {p.zip}</span>
                            </td>
                            <td className="phone-cell"><a>{p.manager}</a></td>
                            <td className="units-cell">
                              <span className="unit-count">{p.units.length.toString().padStart(2, "0")}</span>
                              <span className="tenant-number">{propertyOccupied(p)} leased</span>
                            </td>
                            <td className="balance-cell">
                              <span className={`balance-value ${balance > 0 ? (risk > 0 ? "red-text" : "amber-text") : "zero-balance"}`}>
                                {currency(balance)}
                              </span>
                              {risk > 0 && <span className="overdue-label">{risk} at risk</span>}
                            </td>
                            <td className="status-cell"><PropertyBadge p={p} /></td>
                            <td className="actions-cell">
                              <div className="row-actions">
                                <IconButton label={`View ${p.name}`} onClick={() => setProfile({ code: p.code, tab: "Overview" })}>
                                  <Eye size={15} />
                                </IconButton>
                                <IconButton label={`Edit ${p.name}`} onClick={() => onEdit(p)}>
                                  <Pencil size={14} />
                                </IconButton>
                                <div className="row-more-anchor" data-row-menu>
                                  <IconButton
                                    label={`More actions for ${p.name}`}
                                    onClick={() => setMenu(menu === p.code ? null : p.code)}
                                    aria-expanded={menu === p.code}
                                  >
                                    <MoreHorizontal size={17} />
                                  </IconButton>
                                  {menu === p.code && (
                                    <div className="row-menu">
                                      <button onClick={() => { setProfile({ code: p.code, tab: "Overview" }); setMenu(null); }}>
                                        <Eye size={14} />
                                        View profile
                                      </button>
                                      <button onClick={() => { setProfile({ code: p.code, tab: "Financials" }); setMenu(null); }}>
                                        <CircleDollarSign size={14} />
                                        Financials
                                      </button>
                                      <div className="menu-divider" />
                                      <button onClick={() => { onEdit(p); setMenu(null); }}>
                                        <Pencil size={14} />
                                        Edit property
                                      </button>
                                      <button onClick={() => { setExpanded(open ? null : p.code); setMenu(null); }}>
                                        <Home size={14} />
                                        {open ? "Hide unit details" : "Show unit details"}
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                          {open && (
                            <tr className="detail-row" id={`details-${p.code}`}>
                              <td colSpan={8}>
                                <ExpandedProperty p={p} onView={() => setProfile({ code: p.code, tab: "Overview" })} />
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {!paginated.length && (
                <EmptyState
                  title={properties.length ? "No properties found" : "Your property directory starts here"}
                  description={properties.length ? "Try a different search or adjust your filters." : "Add your first property to start managing its units."}
                  action={<Button onClick={properties.length ? reset : onAdd}>{properties.length ? "Clear search & filters" : "Add your first property"}</Button>}
                />
              )}
              <div className="table-pagination">
                <p>
                  Showing <strong>{rows.length ? (safePage - 1) * pageSize + 1 : 0}-{Math.min(safePage * pageSize, rows.length)}</strong> of <strong>{rows.length}</strong> properties
                </p>
                <div className="pagination-controls">
                  <label className="page-size">
                    <span>Rows per page</span>
                    <select aria-label="Rows per page" value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>
                      <option value={8}>8</option>
                      <option value={16}>16</option>
                      <option value={24}>24</option>
                    </select>
                  </label>
                  <div className="pagination-buttons">
                    <IconButton className="first-page" label="First page" disabled={safePage === 1} onClick={() => setPage(1)}><ChevronsLeft size={15} /></IconButton>
                    <IconButton label="Previous page" disabled={safePage === 1} onClick={() => setPage(safePage - 1)}><ChevronLeft size={15} /></IconButton>
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter((n) => totalPages <= 5 || Math.abs(n - safePage) <= 1 || n === 1 || n === totalPages)
                      .map((n, i, arr) => (
                        <Fragment key={n}>
                          {i > 0 && n - arr[i - 1] > 1 && <span className="pagination-ellipsis">...</span>}
                          <button className={`page-number ${safePage === n ? "selected" : ""}`} aria-label={`Page ${n}`} aria-current={safePage === n ? "page" : undefined} onClick={() => setPage(n)}>
                            {n}
                          </button>
                        </Fragment>
                      ))}
                    <IconButton label="Next page" disabled={safePage === totalPages} onClick={() => setPage(safePage + 1)}><ChevronRight size={15} /></IconButton>
                    <IconButton className="last-page" label="Last page" disabled={safePage === totalPages} onClick={() => setPage(totalPages)}><ChevronsRight size={15} /></IconButton>
                  </div>
                </div>
              </div>
            </section>
            <div className="directory-footnote">
              <span>
                <ShieldCheck size={13} />
                Your records stay connected. Your history stays intact.
              </span>
              <span>
                All amounts in USD<span className="footnote-separator">&middot;</span>Demo data
              </span>
            </div>
          </main>
        </div>
      </div>
      {profile && profileProperty && (
        <PropertyProfile
          key={profile.code}
          property={profileProperty}
          tab={profile.tab}
          onTab={(tab) => setProfile({ ...profile, tab })}
          onClose={() => setProfile(null)}
          onEdit={() => {
            setProfile(null);
            onEdit(profileProperty);
          }}
        />
      )}
    </div>
  );
}
