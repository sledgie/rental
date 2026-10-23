import { isSupabaseConfigured } from "../lib/supabase";
// Assets & equipment in the shared directory format: tabs, search, Tenants-style filters, master rows with an inline summary and a side drawer (View).
import { Fragment, useEffect, useMemo, useState } from "react";
import {
  ArrowDown, ArrowUp, ArrowUpDown, ArrowUpRight, CalendarClock, ChevronRight, Download, Eye, MapPin, MoreHorizontal, Package, Pencil, Plus, RefreshCw,
  ShieldCheck, Upload, Wrench,
} from "lucide-react";
import { Button, DataField, EmptyState, IconButton, SectionTitle, TextLink } from "../tenants/components/ui";
import { FilterField, FilterPopover, SearchField, SortControl } from "../shell/directory";
import { Drawer } from "../projects/components/Drawer";
import { useStore } from "./store";
import { AssetDetail } from "./pages/Assets";
import { AssetFormModal, ReplaceApplianceModal, RequestFormModal, UploadModal } from "./modals";
import { Toasts } from "./Toasts";
import { Pager, StatusPill, colorFor, initialsOf, useRowMenu, type Tone } from "./common";
import { ASSET_CONDITIONS, ASSET_STATUSES, ASSET_TYPES, type Asset } from "./types";
import { assetAgeYears, daysUntil, fmtDate, fmtMoney, warrantyState } from "./utils";

type Tab = "all" | "service" | "warranty" | "expiring" | "attention" | "retired";
type SortKey = "name" | "purchased" | "age" | "repairs" | "warranty";
const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "All assets" },
  { key: "service", label: "In service" },
  { key: "warranty", label: "Under warranty" },
  { key: "expiring", label: "Warranty expiring" },
  { key: "attention", label: "Needs attention" },
  { key: "retired", label: "Retired & replaced" },
];
const IN_SERVICE = ["Active", "Under Inspection", "Under Repair"];
const GONE = ["Replaced", "Retired", "Disposed"];
const STATUS_TONE = (st: string): Tone => (st === "Active" ? "ok" : st === "Under Repair" || st === "Under Inspection" ? "warn" : "neutral");
const CONDITION_CLASS = (c: string) => (c === "Poor" || c === "Failed" ? "red-text" : c === "Fair" ? "amber-text" : "");

export default function Assets({ params }: { params?: Record<string, string> } = {}) {
  const s = useStore();
  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  const [fProperty, setFProperty] = useState("");
  const [fUnit, setFUnit] = useState("");
  const [fType, setFType] = useState("");
  const [fCondition, setFCondition] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [fWarranty, setFWarranty] = useState("");
  const [sort, setSort] = useState<SortKey>("name");
  const [desc, setDesc] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Asset | null>(null);
  const [replacing, setReplacing] = useState<Asset | null>(null);
  const [newRequestAsset, setNewRequestAsset] = useState<Asset | null>(null);
  const [uploadFor, setUploadFor] = useState<string | null>(null);
  const { menu, setMenu } = useRowMenu();

  // deep links: ?asset=AST-101 opens the record, ?expand=<id> opens the row, ?q=<search>, ?new=1
  useEffect(() => {
    if (!params) return;
    if (params.status && TABS.some((t) => t.key === params.status)) setTab(params.status as Tab);
    if (params.q) setSearch(params.q);
    if (params.asset) setDrawerId(params.asset);
    if (params.expand) setExpanded(params.expand);
    if (params.new === "1") { setEditing(null); setFormOpen(true); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params?.asset, params?.expand, params?.status, params?.q, params?.new]);

  const inTab = (a: Asset, t: Tab) => {
    if (t === "service") return IN_SERVICE.includes(a.status);
    if (t === "warranty") return IN_SERVICE.includes(a.status) && warrantyState(a) === "active";
    if (t === "expiring") return IN_SERVICE.includes(a.status) && warrantyState(a) === "expiring";
    if (t === "attention") return IN_SERVICE.includes(a.status) && (a.condition === "Poor" || a.condition === "Failed" || a.status === "Under Repair");
    if (t === "retired") return GONE.includes(a.status);
    return true;
  };
  const tabCount = (t: Tab) => s.assets.filter((a) => inTab(a, t)).length;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = s.assets.filter((a) => {
      if (!inTab(a, tab)) return false;
      if (fProperty && a.propertyId !== fProperty) return false;
      if (fUnit && a.unitId !== fUnit) return false;
      if (fType && a.type !== fType) return false;
      if (fCondition && a.condition !== fCondition) return false;
      if (fStatus && a.status !== fStatus) return false;
      if (fWarranty && warrantyState(a) !== fWarranty) return false;
      if (!q) return true;
      return [a.id, a.name, a.type, a.brand ?? "", a.model ?? "", a.serial ?? "", s.getProperty(a.propertyId)?.name ?? "", s.getUnit(a.unitId)?.name ?? ""].join(" ").toLowerCase().includes(q);
    });
    list.sort((a, b) => {
      let cmp = 0;
      if (sort === "purchased") cmp = (a.purchaseDate ?? "").localeCompare(b.purchaseDate ?? "");
      else if (sort === "age") cmp = (assetAgeYears(a) ?? -1) - (assetAgeYears(b) ?? -1);
      else if (sort === "repairs") cmp = s.assetRepairSpend(a.id) - s.assetRepairSpend(b.id);
      else if (sort === "warranty") cmp = (a.warrantyEnd ?? "9999").localeCompare(b.warrantyEnd ?? "9999");
      else cmp = a.name.localeCompare(b.name);
      return desc ? -cmp : cmp;
    });
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.assets, s.requests, s.expenses, tab, search, fProperty, fUnit, fType, fCondition, fStatus, fWarranty, sort, desc]);

  const activeFilters = [fProperty, fUnit, fType, fCondition, fStatus, fWarranty].filter(Boolean).length;
  const resetFilters = () => { setFProperty(""); setFUnit(""); setFType(""); setFCondition(""); setFStatus(""); setFWarranty(""); setPage(1); };
  const reset = () => { setTab("all"); setSearch(""); setSort("name"); setDesc(false); resetFilters(); };
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice((Math.min(page, totalPages) - 1) * pageSize, Math.min(page, totalPages) * pageSize);
  const sortBy = (key: SortKey) => {
    if (sort === key) setDesc(!desc);
    else { setSort(key); setDesc(key === "repairs"); }
    setPage(1);
  };
  const sortIcon = (key: SortKey) => (sort === key ? (desc ? <ArrowDown size={12} /> : <ArrowUp size={12} />) : <ArrowUpDown size={11} />);
  const ariaSort = (key: SortKey) => (sort === key ? (desc ? "descending" : "ascending") : undefined);
  const view = (id: string) => { setDrawerId(id); setMenu(null); };
  const edit = (a: Asset) => { setEditing(a); setFormOpen(true); setMenu(null); };
  const drawerAsset = drawerId ? s.getAsset(drawerId) : undefined;
  const liveReplacing = replacing ? s.getAsset(replacing.id) ?? replacing : null;

  const exportCSV = () => {
    const headers = ["Asset ID", "Name", "Type", "Property", "Unit", "Brand", "Model", "Serial", "Purchased", "Warranty end", "Condition", "Status", "Repair costs"];
    const rows = filtered.map((a) => [a.id, a.name, a.type, s.getProperty(a.propertyId)?.name ?? "", s.getUnit(a.unitId)?.name ?? "Property-level", a.brand ?? "", a.model ?? "", a.serial ?? "", a.purchaseDate ?? "", a.warrantyEnd ?? "", a.condition, a.status, s.assetRepairSpend(a.id)]);
    const esc = (v: unknown) => `"${String(v).replace(/"/g, '""')}"`;
    const url = URL.createObjectURL(new Blob([[headers.map(esc).join(","), ...rows.map((row) => row.map(esc).join(","))].join("\n")], { type: "text/csv" }));
    const el = document.createElement("a");
    el.href = url; el.download = "assets.csv"; el.click();
    URL.revokeObjectURL(url);
    s.toast(`Exported ${filtered.length} asset${filtered.length === 1 ? "" : "s"} to CSV.`);
  };

  return (
    <div className="tn">
      <div className="app-shell">
        <div className="main-shell">
          <main className="main-content">
            <div className="page-heading">
              <div>
                <div className="page-title-line"><h1>Assets &amp; equipment</h1></div>
                <p>Inventory, warranties, condition and lifetime service history for every appliance and system.</p>
              </div>
              <div className="page-heading-actions">
                <Button onClick={exportCSV}><Download size={15} />Export</Button>
                <Button variant="primary" onClick={() => { setEditing(null); setFormOpen(true); }}><Plus size={17} />New asset</Button>
              </div>
            </div>

            <section className="directory-panel" aria-label="Asset directory">
              <div className="directory-tabs" aria-label="Filter assets">
                {TABS.map((t) => (
                  <button key={t.key} className={`directory-tab ${tab === t.key ? "selected" : ""}`} aria-pressed={tab === t.key} onClick={() => { setTab(t.key); setPage(1); }}>
                    {t.label}<span>{tabCount(t.key)}</span>
                  </button>
                ))}
                <div className="directory-tabs-end"><span className="live-dot" />{isSupabaseConfigured ? "Live" : "Demo data"}</div>
              </div>
              <div className="directory-toolbar">
                <SearchField label="Search assets" placeholder="Search asset ID, name, brand, model, serial or location..." value={search} onChange={(v) => { setSearch(v); setPage(1); }} />
                <div className="toolbar-actions">
                  <FilterPopover title="Filter assets" count={activeFilters} onReset={resetFilters}>
                    <FilterField id="as-property-filter" label="Property">
                      <select id="as-property-filter" value={fProperty} onChange={(e) => { setFProperty(e.target.value); setFUnit(""); setPage(1); }}>
                        <option value="">All properties</option>
                        {s.properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </FilterField>
                    <FilterField id="as-unit-filter" label="Unit">
                      <select id="as-unit-filter" value={fUnit} disabled={!fProperty} onChange={(e) => { setFUnit(e.target.value); setPage(1); }}>
                        <option value="">{fProperty ? "All units" : "Pick a property first"}</option>
                        {s.unitsForProperty(fProperty).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                      </select>
                    </FilterField>
                    <FilterField id="as-type-filter" label="Type">
                      <select id="as-type-filter" value={fType} onChange={(e) => { setFType(e.target.value); setPage(1); }}>
                        <option value="">All types</option>
                        {ASSET_TYPES.map((t) => <option key={t}>{t}</option>)}
                      </select>
                    </FilterField>
                    <FilterField id="as-condition-filter" label="Condition">
                      <select id="as-condition-filter" value={fCondition} onChange={(e) => { setFCondition(e.target.value); setPage(1); }}>
                        <option value="">Any condition</option>
                        {ASSET_CONDITIONS.map((c) => <option key={c}>{c}</option>)}
                      </select>
                    </FilterField>
                    <FilterField id="as-status-filter" label="Status">
                      <select id="as-status-filter" value={fStatus} onChange={(e) => { setFStatus(e.target.value); setPage(1); }}>
                        <option value="">Any status</option>
                        {ASSET_STATUSES.map((st) => <option key={st}>{st}</option>)}
                      </select>
                    </FilterField>
                    <FilterField id="as-warranty-filter" label="Warranty">
                      <select id="as-warranty-filter" value={fWarranty} onChange={(e) => { setFWarranty(e.target.value); setPage(1); }}>
                        <option value="">Any warranty</option>
                        <option value="active">Warranty active</option>
                        <option value="expiring">Expiring within 90 days</option>
                        <option value="expired">Warranty expired</option>
                        <option value="none">No warranty recorded</option>
                      </select>
                    </FilterField>
                  </FilterPopover>
                  <SortControl
                    label="Sort assets"
                    value={sort}
                    defaultValue="name"
                    descending={desc}
                    options={[{ value: "purchased", label: "Purchase date" }, { value: "age", label: "Age" }, { value: "repairs", label: "Repair costs" }, { value: "warranty", label: "Warranty expiry" }]}
                    onChange={(k) => { setSort(k as SortKey); setDesc(k === "repairs" || k === "age"); setPage(1); }}
                    onToggle={() => setDesc(!desc)}
                  />
                </div>
              </div>

              <div className="tenant-table-wrap">
                <table className="tenant-table">
                  <caption className="sr-only">Assets and equipment. Expand an asset for its main details; open it for warranty, documents and service history.</caption>
                  <colgroup><col className="col-expand" /><col className="col-tenant" style={{ width: 250 }} /><col className="col-email" style={{ width: 190 }} /><col className="col-phone" style={{ width: 150 }} /><col className="col-units" style={{ width: 160 }} /><col className="col-balance" style={{ width: 130 }} /><col className="col-status" style={{ width: 140 }} /><col className="col-actions" /></colgroup>
                  <thead>
                    <tr>
                      <th className="expand-cell"><span className="sr-only">Expand</span></th>
                      <th aria-sort={ariaSort("name")}><button onClick={() => sortBy("name")}>Asset{sortIcon("name")}</button></th>
                      <th className="email-cell">Property / unit</th>
                      <th className="phone-cell" aria-sort={ariaSort("age")}><button onClick={() => sortBy("age")}>Condition{sortIcon("age")}</button></th>
                      <th className="units-cell" aria-sort={ariaSort("warranty")}><button onClick={() => sortBy("warranty")}>Warranty{sortIcon("warranty")}</button></th>
                      <th className="balance-cell" aria-sort={ariaSort("repairs")}><button onClick={() => sortBy("repairs")}>Repairs{sortIcon("repairs")}</button></th>
                      <th className="status-cell">Status</th>
                      <th className="actions-cell">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paged.map((a) => {
                      const open = expanded === a.id;
                      const ws = warrantyState(a);
                      const age = assetAgeYears(a);
                      return (
                        <Fragment key={a.id}>
                          <tr className={`tenant-row ${open ? "tenant-row-expanded" : ""}`} style={GONE.includes(a.status) ? { opacity: 0.65 } : undefined}>
                            <td className="expand-cell">
                              <IconButton label={`${open ? "Collapse" : "Expand"} ${a.id}`} className="expand-button" onClick={() => setExpanded(open ? null : a.id)} aria-expanded={open} aria-controls={`details-${a.id}`}>
                                <ChevronRight size={15} className={open ? "chevron-expanded" : ""} />
                              </IconButton>
                            </td>
                            <td className="tenant-cell">
                              <div className="tenant-identity">
                                <span className={`avatar avatar-md avatar-${colorFor(a.type)}`} aria-hidden="true">{initialsOf(a.type)}</span>
                                <div>
                                  <button className="tenant-name" onClick={() => view(a.id)}>{a.name}</button>
                                  <span className="tenant-number">{a.id}{age !== null ? ` · ${age.toFixed(1)} yrs old` : ""}</span>
                                </div>
                              </div>
                            </td>
                            <td className="email-cell"><a>{s.getProperty(a.propertyId)?.name}</a><span className="tenant-number">{s.getUnit(a.unitId)?.name ?? "Property-level"}{a.room ? ` · ${a.room}` : ""}</span></td>
                            <td className="phone-cell"><a className={CONDITION_CLASS(a.condition)}>{a.condition}</a><span className="tenant-number">{a.type}</span></td>
                            <td className="units-cell">
                              <a className={ws === "expiring" ? "amber-text" : undefined}>{ws === "active" ? "Active" : ws === "expiring" ? "Expiring" : ws === "expired" ? "Expired" : "None recorded"}</a>
                              <span className="tenant-number">{ws === "none" ? "—" : ws === "expiring" ? `${fmtDate(a.warrantyEnd)} · ${daysUntil(a.warrantyEnd)}d left` : `to ${fmtDate(a.warrantyEnd)}`}</span>
                            </td>
                            <td className="balance-cell"><span className="balance-value">{fmtMoney(s.assetRepairSpend(a.id))}</span><span className="tenant-number">{a.lastService ? `serviced ${fmtDate(a.lastService)}` : "never serviced"}</span></td>
                            <td className="status-cell"><StatusPill tone={STATUS_TONE(a.status)}>{a.status}</StatusPill></td>
                            <td className="actions-cell">
                              <div className="row-actions">
                                <IconButton label={`View ${a.id}`} onClick={() => view(a.id)}><Eye size={15} /></IconButton>
                                <div className="row-more-anchor" data-row-menu>
                                  <IconButton label={`More actions for ${a.id}`} onClick={() => setMenu(menu === a.id ? null : a.id)} aria-expanded={menu === a.id}><MoreHorizontal size={17} /></IconButton>
                                  {menu === a.id && (
                                    <div className="row-menu" style={{ width: 210 }}>
                                      <button onClick={() => view(a.id)}><Eye size={14} />View asset</button>
                                      <button onClick={() => edit(a)}><Pencil size={14} />Edit asset</button>
                                      <button onClick={() => { setNewRequestAsset(a); setMenu(null); }}><Wrench size={14} />New maintenance request</button>
                                      <button onClick={() => { setUploadFor(a.id); setMenu(null); }}><Upload size={14} />Upload documents</button>
                                      <div className="menu-divider" />
                                      <button disabled={["Replaced", "Disposed"].includes(a.status)} onClick={() => { setReplacing(a); setMenu(null); }}><RefreshCw size={14} />Replace appliance…</button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                          {open && (
                            <tr className="detail-row" id={`details-${a.id}`}>
                              <td colSpan={8}>
                                <div className="expanded-detail">
                                  <div className="expanded-detail-top">
                                    <span>ASSET DETAILS</span>
                                    <TextLink onClick={() => view(a.id)}>Open asset record<ArrowUpRight size={12} /></TextLink>
                                  </div>
                                  <div className="expanded-grid">
                                    <section className="detail-section is-compact">
                                      <SectionTitle icon={<Package size={15} />} title="Identification" />
                                      <dl className="lease-facts">
                                        <DataField label="Brand">{a.brand ?? "—"}</DataField>
                                        <DataField label="Model">{a.model ?? "—"}</DataField>
                                        <DataField label="Serial number">{a.serial ?? "—"}</DataField>
                                        <DataField label="Installed">{fmtDate(a.installDate)}</DataField>
                                      </dl>
                                    </section>
                                    <section className="detail-section is-compact">
                                      <SectionTitle icon={<ShieldCheck size={15} />} title="Warranty" />
                                      <dl className="lease-facts">
                                        <DataField label="Provider">{a.warrantyProvider ?? "—"}</DataField>
                                        <DataField label="Expiry">{fmtDate(a.warrantyEnd)}</DataField>
                                        <DataField label="Purchased">{fmtDate(a.purchaseDate)}</DataField>
                                        <DataField label="Purchase price">{fmtMoney(a.purchasePrice)}</DataField>
                                      </dl>
                                    </section>
                                    <section className="detail-section is-compact">
                                      <SectionTitle icon={<CalendarClock size={15} />} title="Service" />
                                      <dl className="lease-facts">
                                        <DataField label="Last service">{fmtDate(a.lastService)}</DataField>
                                        <DataField label="Next service">{fmtDate(a.nextService)}</DataField>
                                        <DataField label="Requests">{s.assetRequests(a.id).length}</DataField>
                                        <DataField label="Location"><MapPin size={11} style={{ display: "inline", marginRight: 3 }} />{a.room ?? "—"}</DataField>
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
                  title={s.assets.length ? "No assets found" : "Your asset register starts here"}
                  description={s.assets.length ? "Try a different search or adjust your filters." : "Add appliances and systems to track warranties and service history."}
                  action={<Button onClick={s.assets.length ? reset : () => { setEditing(null); setFormOpen(true); }}>{s.assets.length ? "Clear search & filters" : "New asset"}</Button>}
                />
              )}
              <Pager total={filtered.length} page={page} pageSize={pageSize} noun="assets" setPage={setPage} setPageSize={setPageSize} />
            </section>
            <div className="directory-footnote">
              <span><ShieldCheck size={13} />Replaced and retired assets stay visible so their history is never lost.</span>
              <span><CalendarClock size={13} />All amounts in CAD{!isSupabaseConfigured && <><span className="footnote-separator">&middot;</span>Demo data</>}</span>
            </div>
          </main>
        </div>
      </div>

      <Drawer open={!!drawerAsset} onClose={() => setDrawerId(null)} title="Asset record" subtitle={drawerAsset ? `${drawerAsset.id} · ${drawerAsset.name}` : undefined}>
        {drawerAsset && (
          <div className="px-5 py-4">
            <AssetDetail asset={drawerAsset} onEdit={() => edit(drawerAsset)} onReplace={() => setReplacing(drawerAsset)} onNewRequest={() => setNewRequestAsset(drawerAsset)} onUpload={() => setUploadFor(drawerAsset.id)} />
          </div>
        )}
      </Drawer>

      <UploadModal open={!!uploadFor} onClose={() => setUploadFor(null)} assetId={uploadFor ?? undefined} />
      <AssetFormModal open={formOpen} onClose={() => setFormOpen(false)} asset={editing} onSaved={(id) => setDrawerId(id)} />
      <ReplaceApplianceModal
        open={!!replacing}
        onClose={() => setReplacing(null)}
        asset={liveReplacing}
        request={liveReplacing ? s.assetRequests(liveReplacing.id).find((r) => !["Completed", "Closed", "Cancelled", "Rejected"].includes(r.status)) ?? null : null}
        onDone={(newId) => { setDrawerId(newId); setSearch(""); }}
      />
      <RequestFormModal
        open={!!newRequestAsset}
        onClose={() => setNewRequestAsset(null)}
        preset={newRequestAsset ? { assetId: newRequestAsset.id, propertyId: newRequestAsset.propertyId, unitId: newRequestAsset.unitId, category: "Appliance", title: `${newRequestAsset.name} — issue reported` } : undefined}
        onSaved={(id) => s.navigate("requests", { focusRequestId: id })}
      />
      <Toasts />
    </div>
  );
}
