// Contractors & vendors in the shared directory format. The reference module only carried a contractor list used by assignment dropdowns,
// so this page gives that list a home: directory with tabs and filters, inline summary, a side drawer with the work history, and an add / edit dialog.
import { Fragment, useEffect, useMemo, useState } from "react";
import {
  ArrowDown, ArrowUp, ArrowUpDown, ArrowUpRight, CalendarClock, ChevronRight, ClipboardList, Download, Eye, FileText, Mail, MoreHorizontal, Pencil, Phone, Plus,
  Power, ShieldCheck, Wrench,
} from "lucide-react";
import { Button, DataField, EmptyState, IconButton, SectionTitle, TextLink } from "../tenants/components/ui";
import { FilterField, FilterPopover, SearchField, SortControl } from "../shell/directory";
import { Drawer } from "../projects/components/Drawer";
import { useStore } from "./store";
import { Toasts } from "./Toasts";
import { Field, GhostButton, Modal, PrimaryButton, TextArea, TextInput, Chip, PriorityBadge, StatusBadge } from "./ui";
import { Pager, StatusPill, colorFor, initialsOf, useRowMenu } from "./common";
import { CATEGORIES, OPEN_STATUSES, type Contractor } from "./types";
import { fmtDate, fmtMoney, uid } from "./utils";
import { cn } from "./utils/cn";

type Tab = "all" | "active" | "inactive";
type SortKey = "company" | "jobs" | "spend";
const TABS: { key: Tab; label: string }[] = [{ key: "all", label: "All contractors" }, { key: "active", label: "Active" }, { key: "inactive", label: "Inactive" }];
const short = (c: string) => (c === "Heating, Ventilation & Air Conditioning" ? "HVAC" : c);

export default function Contractors({ params }: { params?: Record<string, string> } = {}) {
  const s = useStore();
  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  const [fCategory, setFCategory] = useState("");
  const [sort, setSort] = useState<SortKey>("company");
  const [desc, setDesc] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [form, setForm] = useState<{ open: boolean; editing: Contractor | null }>({ open: false, editing: null });
  const { menu, setMenu } = useRowMenu();

  // deep links: ?contractor=C1 opens the record, ?expand=<id> opens the row, ?new=1 opens the form
  useEffect(() => {
    if (!params) return;
    if (params.contractor) setDrawerId(params.contractor);
    if (params.expand) setExpanded(params.expand);
    if (params.new === "1") setForm({ open: true, editing: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params?.contractor, params?.expand, params?.new]);

  const stats = useMemo(() => {
    const map = new Map<string, { jobs: number; open: number; orders: number; spend: number }>();
    for (const c of s.contractors) map.set(c.id, { jobs: 0, open: 0, orders: 0, spend: 0 });
    for (const r of s.requests) {
      const st = r.assignedContractorId ? map.get(r.assignedContractorId) : undefined;
      if (!st) continue;
      st.jobs += 1;
      if (OPEN_STATUSES.includes(r.status)) st.open += 1;
      st.spend += s.actualCost(r);
    }
    for (const w of s.workOrders) { const st = w.contractorId ? map.get(w.contractorId) : undefined; if (st) st.orders += 1; }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.contractors, s.requests, s.workOrders, s.estimates, s.expenses]);
  const statOf = (id: string) => stats.get(id) ?? { jobs: 0, open: 0, orders: 0, spend: 0 };

  const tabCount = (t: Tab) => s.contractors.filter((c) => t === "all" || (t === "active" ? c.active : !c.active)).length;
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = s.contractors.filter((c) => {
      if (tab === "active" && !c.active) return false;
      if (tab === "inactive" && c.active) return false;
      if (fCategory && !c.categories.includes(fCategory)) return false;
      if (!q) return true;
      return [c.id, c.company, c.contact, c.email, c.phone, c.categories.join(" "), c.notes ?? ""].join(" ").toLowerCase().includes(q);
    });
    list.sort((a, b) => {
      let cmp = 0;
      if (sort === "jobs") cmp = statOf(a.id).jobs - statOf(b.id).jobs;
      else if (sort === "spend") cmp = statOf(a.id).spend - statOf(b.id).spend;
      else cmp = a.company.localeCompare(b.company);
      return desc ? -cmp : cmp;
    });
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.contractors, stats, tab, search, fCategory, sort, desc]);

  const activeFilters = [fCategory].filter(Boolean).length;
  const resetFilters = () => { setFCategory(""); setPage(1); };
  const reset = () => { setTab("all"); setSearch(""); setSort("company"); setDesc(false); resetFilters(); };
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice((Math.min(page, totalPages) - 1) * pageSize, Math.min(page, totalPages) * pageSize);
  const sortBy = (key: SortKey) => {
    if (sort === key) setDesc(!desc);
    else { setSort(key); setDesc(key !== "company"); }
    setPage(1);
  };
  const sortIcon = (key: SortKey) => (sort === key ? (desc ? <ArrowDown size={12} /> : <ArrowUp size={12} />) : <ArrowUpDown size={11} />);
  const ariaSort = (key: SortKey) => (sort === key ? (desc ? "descending" : "ascending") : undefined);
  const view = (id: string) => { setDrawerId(id); setMenu(null); };
  const edit = (c: Contractor) => { setForm({ open: true, editing: c }); setMenu(null); };
  const toggleActive = (c: Contractor) => { s.updateContractor(c.id, { active: !c.active }); s.toast(`${c.company} ${c.active ? "deactivated" : "activated"}.`, "info"); setMenu(null); };
  const drawerContractor = drawerId ? s.getContractor(drawerId) : undefined;

  const exportCSV = () => {
    const headers = ["ID", "Company", "Contact", "Phone", "Email", "Categories", "Status", "Requests", "Work orders", "Spend"];
    const rows = filtered.map((c) => [c.id, c.company, c.contact, c.phone, c.email, c.categories.map(short).join("; "), c.active ? "Active" : "Inactive", statOf(c.id).jobs, statOf(c.id).orders, statOf(c.id).spend]);
    const esc = (v: unknown) => `"${String(v).replace(/"/g, '""')}"`;
    const url = URL.createObjectURL(new Blob([[headers.map(esc).join(","), ...rows.map((row) => row.map(esc).join(","))].join("\n")], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url; a.download = "contractors.csv"; a.click();
    URL.revokeObjectURL(url);
    s.toast(`Exported ${filtered.length} contractor${filtered.length === 1 ? "" : "s"} to CSV.`);
  };

  return (
    <div className="tn">
      <div className="app-shell">
        <div className="main-shell">
          <main className="main-content">
            <div className="page-heading">
              <div>
                <div className="page-title-line"><h1>Contractors &amp; vendors</h1></div>
                <p>The trades and suppliers you assign work to, with their service categories, contacts and job history.</p>
              </div>
              <div className="page-heading-actions">
                <Button onClick={exportCSV}><Download size={15} />Export</Button>
                <Button variant="primary" onClick={() => setForm({ open: true, editing: null })}><Plus size={17} />New contractor</Button>
              </div>
            </div>

            <section className="directory-panel" aria-label="Contractor directory">
              <div className="directory-tabs" aria-label="Filter contractors">
                {TABS.map((t) => (
                  <button key={t.key} className={`directory-tab ${tab === t.key ? "selected" : ""}`} aria-pressed={tab === t.key} onClick={() => { setTab(t.key); setPage(1); }}>
                    {t.label}<span>{tabCount(t.key)}</span>
                  </button>
                ))}
                <div className="directory-tabs-end"><span className="live-dot" />Demo data</div>
              </div>
              <div className="directory-toolbar">
                <SearchField label="Search contractors" placeholder="Search company, contact, email, phone or service category..." value={search} onChange={(v) => { setSearch(v); setPage(1); }} />
                <div className="toolbar-actions">
                  <FilterPopover title="Filter contractors" count={activeFilters} onReset={resetFilters}>
                    <FilterField id="ct-category-filter" label="Service category">
                      <select id="ct-category-filter" value={fCategory} onChange={(e) => { setFCategory(e.target.value); setPage(1); }}>
                        <option value="">All categories</option>
                        {CATEGORIES.map((c) => <option key={c} value={c}>{short(c)}</option>)}
                      </select>
                    </FilterField>
                  </FilterPopover>
                  <SortControl
                    label="Sort contractors"
                    value={sort}
                    defaultValue="company"
                    descending={desc}
                    options={[{ value: "jobs", label: "Jobs assigned" }, { value: "spend", label: "Total spend" }]}
                    onChange={(k) => { setSort(k as SortKey); setDesc(true); setPage(1); }}
                    onToggle={() => setDesc(!desc)}
                  />
                </div>
              </div>

              <div className="tenant-table-wrap">
                <table className="tenant-table">
                  <caption className="sr-only">Contractors and vendors. Expand a contractor for its main details; open it for the work history.</caption>
                  <colgroup><col className="col-expand" /><col className="col-tenant" style={{ width: 270 }} /><col className="col-email" style={{ width: 220 }} /><col className="col-phone" style={{ width: 160 }} /><col className="col-units" style={{ width: 170 }} /><col className="col-balance" style={{ width: 130 }} /><col className="col-status" style={{ width: 110 }} /><col className="col-actions" /></colgroup>
                  <thead>
                    <tr>
                      <th className="expand-cell"><span className="sr-only">Expand</span></th>
                      <th aria-sort={ariaSort("company")}><button onClick={() => sortBy("company")}>Company{sortIcon("company")}</button></th>
                      <th className="email-cell">Contact</th>
                      <th className="phone-cell">Phone</th>
                      <th className="units-cell" aria-sort={ariaSort("jobs")}><button onClick={() => sortBy("jobs")}>Jobs{sortIcon("jobs")}</button></th>
                      <th className="balance-cell" aria-sort={ariaSort("spend")}><button onClick={() => sortBy("spend")}>Spend{sortIcon("spend")}</button></th>
                      <th className="status-cell">Status</th>
                      <th className="actions-cell">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paged.map((c) => {
                      const open = expanded === c.id;
                      const st = statOf(c.id);
                      return (
                        <Fragment key={c.id}>
                          <tr className={`tenant-row ${open ? "tenant-row-expanded" : ""}`} style={c.active ? undefined : { opacity: 0.65 }}>
                            <td className="expand-cell">
                              <IconButton label={`${open ? "Collapse" : "Expand"} ${c.company}`} className="expand-button" onClick={() => setExpanded(open ? null : c.id)} aria-expanded={open} aria-controls={`details-${c.id}`}>
                                <ChevronRight size={15} className={open ? "chevron-expanded" : ""} />
                              </IconButton>
                            </td>
                            <td className="tenant-cell">
                              <div className="tenant-identity">
                                <span className={`avatar avatar-md avatar-${colorFor(c.company)}`} aria-hidden="true">{initialsOf(c.company)}</span>
                                <div>
                                  <button className="tenant-name" onClick={() => view(c.id)}>{c.company}</button>
                                  <span className="tenant-number">{c.categories.map(short).join(", ")}</span>
                                </div>
                              </div>
                            </td>
                            <td className="email-cell"><a href={`mailto:${c.email}`}>{c.email}</a><span className="tenant-number">{c.contact}</span></td>
                            <td className="phone-cell"><a href={`tel:${c.phone}`}>{c.phone}</a></td>
                            <td className="units-cell"><a>{st.jobs} request{st.jobs === 1 ? "" : "s"}</a><span className="tenant-number">{st.open} open · {st.orders} work order{st.orders === 1 ? "" : "s"}</span></td>
                            <td className="balance-cell"><span className="balance-value">{fmtMoney(st.spend)}</span><span className="tenant-number">actual cost</span></td>
                            <td className="status-cell"><StatusPill tone={c.active ? "ok" : "neutral"}>{c.active ? "Active" : "Inactive"}</StatusPill></td>
                            <td className="actions-cell">
                              <div className="row-actions">
                                <IconButton label={`View ${c.company}`} onClick={() => view(c.id)}><Eye size={15} /></IconButton>
                                <div className="row-more-anchor" data-row-menu>
                                  <IconButton label={`More actions for ${c.company}`} onClick={() => setMenu(menu === c.id ? null : c.id)} aria-expanded={menu === c.id}><MoreHorizontal size={17} /></IconButton>
                                  {menu === c.id && (
                                    <div className="row-menu" style={{ width: 200 }}>
                                      <button onClick={() => view(c.id)}><Eye size={14} />View contractor</button>
                                      <button onClick={() => edit(c)}><Pencil size={14} />Edit contractor</button>
                                      <button onClick={() => { s.navigate("workorders"); }}><ClipboardList size={14} />Go to work orders</button>
                                      <div className="menu-divider" />
                                      <button className={c.active ? "danger-menu-item" : undefined} onClick={() => toggleActive(c)}><Power size={14} />{c.active ? "Deactivate" : "Activate"}</button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                          {open && (
                            <tr className="detail-row" id={`details-${c.id}`}>
                              <td colSpan={8}>
                                <div className="expanded-detail">
                                  <div className="expanded-detail-top">
                                    <span>CONTRACTOR DETAILS</span>
                                    <TextLink onClick={() => view(c.id)}>Open contractor record<ArrowUpRight size={12} /></TextLink>
                                  </div>
                                  <div className="expanded-grid">
                                    <section className="detail-section is-compact">
                                      <SectionTitle icon={<FileText size={15} />} title="Company" />
                                      <dl className="lease-facts">
                                        <DataField label="Contact">{c.contact}</DataField>
                                        <DataField label="Email">{c.email}</DataField>
                                        <DataField label="Phone">{c.phone}</DataField>
                                      </dl>
                                    </section>
                                    <section className="detail-section is-compact">
                                      <SectionTitle icon={<Wrench size={15} />} title="Services" />
                                      <dl className="lease-facts">
                                        <DataField label="Categories">{c.categories.map(short).join(", ")}</DataField>
                                        <DataField label="Status">{c.active ? "Active" : "Inactive"}</DataField>
                                      </dl>
                                    </section>
                                    <section className="detail-section is-compact">
                                      <SectionTitle icon={<ClipboardList size={15} />} title="Work" />
                                      <dl className="lease-facts">
                                        <DataField label="Requests">{st.jobs}</DataField>
                                        <DataField label="Open requests">{st.open}</DataField>
                                        <DataField label="Work orders">{st.orders}</DataField>
                                        <DataField label="Notes">{c.notes ?? "—"}</DataField>
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
                  title={s.contractors.length ? "No contractors found" : "Your contractor directory starts here"}
                  description={s.contractors.length ? "Try a different search or adjust your filters." : "Add the trades and suppliers you assign work to."}
                  action={<Button onClick={s.contractors.length ? reset : () => setForm({ open: true, editing: null })}>{s.contractors.length ? "Clear search & filters" : "New contractor"}</Button>}
                />
              )}
              <Pager total={filtered.length} page={page} pageSize={pageSize} noun="contractors" setPage={setPage} setPageSize={setPageSize} />
            </section>
            <div className="directory-footnote">
              <span><ShieldCheck size={13} />Inactive contractors stay on past requests but are no longer offered for new assignments.</span>
              <span><CalendarClock size={13} />All amounts in CAD<span className="footnote-separator">&middot;</span>Demo data</span>
            </div>
          </main>
        </div>
      </div>

      <Drawer open={!!drawerContractor} onClose={() => setDrawerId(null)} title="Contractor record" subtitle={drawerContractor ? `${drawerContractor.id} · ${drawerContractor.company}` : undefined}>
        {drawerContractor && <ContractorRecord contractor={drawerContractor} onEdit={() => edit(drawerContractor)} onToggle={() => toggleActive(drawerContractor)} />}
      </Drawer>

      <ContractorForm open={form.open} editing={form.editing} onClose={() => setForm({ open: false, editing: null })} onSaved={(id) => { setTab("all"); setSearch(""); setDrawerId(id); }} />
      <Toasts />
    </div>
  );
}

function ContractorRecord({ contractor: c, onEdit, onToggle }: { contractor: Contractor; onEdit: () => void; onToggle: () => void }) {
  const s = useStore();
  const requests = s.requests.filter((r) => r.assignedContractorId === c.id);
  const orders = s.workOrders.filter((w) => w.contractorId === c.id);
  const spend = requests.reduce((sum, r) => sum + s.actualCost(r), 0);
  return (
    <div className="px-5 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-[15px] font-semibold text-u-ink">{c.company}</h3>
        <Chip tone={c.active ? "green" : "zinc"}>{c.active ? "Active" : "Inactive"}</Chip>
        <span className="ml-auto flex gap-1.5">
          <GhostButton onClick={onEdit} className="px-2.5 py-1.5 text-[12px]"><Pencil size={12} /> Edit</GhostButton>
          <GhostButton onClick={onToggle} danger={c.active} className="px-2.5 py-1.5 text-[12px]"><Power size={12} /> {c.active ? "Deactivate" : "Activate"}</GhostButton>
        </span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[["Requests", requests.length], ["Open", requests.filter((r) => OPEN_STATUSES.includes(r.status)).length], ["Work orders", orders.length], ["Total spend", fmtMoney(spend)]].map(([label, value]) => (
          <div key={label as string} className="rounded-xl border border-u-line bg-u-card p-3.5">
            <div className="tabular text-[20px] font-bold leading-none text-u-ink">{value}</div>
            <div className="mt-1.5 text-[12px] text-u-muted">{label}</div>
          </div>
        ))}
      </div>
      <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-u-muted">Contact</p>
          <div className="space-y-2.5 rounded-xl border border-u-line bg-u-card px-4 py-3.5 text-[12.5px] text-u-ink2">
            <p className="font-medium text-u-ink">{c.contact}</p>
            <p className="flex items-center gap-2"><Phone size={13} className="text-u-muted" />{c.phone}</p>
            <p className="flex items-center gap-2"><Mail size={13} className="text-u-muted" />{c.email}</p>
          </div>
          <p className="mb-2 mt-5 text-[11px] font-semibold uppercase tracking-wide text-u-muted">Service categories</p>
          <div className="flex flex-wrap gap-1.5">{c.categories.map((x) => <Chip key={x} tone="teal">{short(x)}</Chip>)}</div>
          {c.notes && (<><p className="mb-2 mt-5 text-[11px] font-semibold uppercase tracking-wide text-u-muted">Notes</p><p className="rounded-xl border border-u-line bg-u-card px-4 py-3 text-[12.5px] leading-relaxed text-u-ink2">{c.notes}</p></>)}
        </div>
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-u-muted">Requests ({requests.length})</p>
          {requests.length === 0 ? <p className="rounded-xl border border-u-line bg-u-card px-4 py-3 text-[12.5px] text-u-muted">No requests assigned yet.</p> : (
            <div className="space-y-2">
              {requests.map((r) => (
                <button key={r.id} onClick={() => s.navigate("requests", { focusRequestId: r.id })} className="w-full rounded-xl border border-u-line bg-u-card px-3.5 py-2.5 text-left transition hover:border-u-line2">
                  <span className="flex items-center justify-between gap-2"><span className="truncate text-[12.5px] font-medium text-u-ink">{r.title}</span><StatusBadge status={r.status} /></span>
                  <span className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-u-muted"><span>{r.id}</span><PriorityBadge priority={r.priority} /><span>{fmtDate(r.reportedAt)}</span>{s.actualCost(r) > 0 && <span className="tabular text-u-ink2">{fmtMoney(s.actualCost(r))}</span>}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-u-muted">Work orders ({orders.length})</p>
          {orders.length === 0 ? <p className="rounded-xl border border-u-line bg-u-card px-4 py-3 text-[12.5px] text-u-muted">No work orders yet.</p> : (
            <div className="space-y-2">
              {orders.map((w) => (
                <button key={w.id} onClick={() => s.navigate("workorders", { focusRequestId: w.requestId })} className="w-full rounded-xl border border-u-line bg-u-card px-3.5 py-2.5 text-left transition hover:border-u-line2">
                  <span className="flex items-center justify-between gap-2"><span className="truncate text-[12.5px] font-medium text-u-ink">{w.title}</span><Chip tone={w.status === "Completed" ? "green" : w.status === "Cancelled" ? "red" : w.status === "In Progress" ? "sky" : "zinc"}>{w.status}</Chip></span>
                  <span className={cn("mt-1 block text-[11px] text-u-muted")}>{w.id} · target {fmtDate(w.targetDate)} · {w.actualCost ? `actual ${fmtMoney(w.actualCost)}` : `estimate ${fmtMoney(w.estimate)}`}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ContractorForm({ open, editing, onClose, onSaved }: { open: boolean; editing: Contractor | null; onClose: () => void; onSaved: (id: string) => void }) {
  const s = useStore();
  const [company, setCompany] = useState("");
  const [contact, setContact] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [active, setActive] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setCompany(editing?.company ?? ""); setContact(editing?.contact ?? ""); setPhone(editing?.phone ?? ""); setEmail(editing?.email ?? "");
    setCategories(editing?.categories ?? []); setNotes(editing?.notes ?? ""); setActive(editing?.active ?? true); setError("");
  }, [open, editing]);

  const submit = () => {
    if (!company.trim()) return setError("Company name is required.");
    if (!categories.length) return setError("Pick at least one service category.");
    const data = { company: company.trim(), contact: contact.trim(), phone: phone.trim(), email: email.trim(), categories, notes: notes.trim() || undefined, active };
    if (editing) {
      s.updateContractor(editing.id, data);
      s.toast(`${data.company} updated.`);
      onSaved(editing.id);
    } else {
      const id = uid("C");
      s.addContractor({ id, ...data });
      s.toast(`${data.company} added.`);
      onSaved(id);
    }
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? "Edit contractor" : "New contractor"}
      subtitle="Contractors appear in assignment, estimate and work order dropdowns while they are active."
      footer={<><GhostButton onClick={onClose}>Cancel</GhostButton><PrimaryButton onClick={submit}>{editing ? "Save changes" : "Add contractor"}</PrimaryButton></>}
    >
      <div className="space-y-4">
        {error && <p className="rounded-lg border border-u-danger/30 bg-u-danger/10 px-3 py-2 text-[12.5px] text-u-danger">{error}</p>}
        <Field label="Company" required><TextInput value={company} onChange={(e) => setCompany(e.target.value)} placeholder="e.g. ProFlow Plumbing" /></Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Contact person"><TextInput value={contact} onChange={(e) => setContact(e.target.value)} /></Field>
          <Field label="Phone"><TextInput value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
        </div>
        <Field label="Email"><TextInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <Field label="Service categories" required>
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map((cat) => {
              const on = categories.includes(cat);
              return (
                <button key={cat} type="button" onClick={() => setCategories(on ? categories.filter((x) => x !== cat) : [...categories, cat])} className={cn("rounded-full border px-2.5 py-1 text-[12px] font-medium transition", on ? "border-u-accent/50 bg-u-accent/15 text-u-accent" : "border-u-line bg-u-s2 text-u-ink2 hover:border-u-line2")}>
                  {short(cat)}
                </button>
              );
            })}
          </div>
        </Field>
        <Field label="Notes"><TextArea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Terms, after-hours line, preferred jobs…" /></Field>
        <label className="flex items-center gap-2 text-[12.5px] text-u-ink2"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-4 w-4 accent-u-accent" /> Active (available for new assignments)</label>
      </div>
    </Modal>
  );
}
