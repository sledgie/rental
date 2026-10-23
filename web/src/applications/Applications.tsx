import { isSupabaseConfigured } from "../lib/supabase";
// Applications directory in the same format as the Properties, Leases, Units and Payments pages: tabs, search, sortable master rows,
// an inline summary (chevron) and a side drawer for the full application (View). The store, screening/document/decision sections and
// dialogs come from the applications module.
import { Fragment, useEffect, useMemo, useState } from "react";
import {
  Archive,
  ArrowDown,
  ArrowDownUp,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ClipboardList,
  Download,
  Eye,
  FilePlus2,
  Home,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import { Button, DataField, EmptyState, IconButton, SectionTitle } from "../tenants/components/ui";
import { FilterCheckbox, FilterField, FilterPopover, SearchField, SortControl } from "../shell/directory";
import { useStore } from "./state/store";
import type { ApplicationStatus } from "./data/types";
import { currency, formatDate, relativeDays } from "./lib/format";
import { filterRows, rowModel, sortApplications, SORT_LABELS, type RowModel, type SortKey } from "./parts/helpers";
import type { DialogRequest } from "./parts/detail/dialogTypes";
import { NewApplicationWizard } from "./parts/NewApplicationWizard";
import { CreateLeaseModal } from "./parts/CreateLeaseModal";
import { DialogHost } from "./parts/detail/DialogHost";
import { ExpandedApplication } from "./parts/detail/ExpandedApplication";
import { Drawer } from "./components/ui/Overlay";
import { Toasts } from "./components/ui/Misc";

type Tab = "all" | "New" | "Under Review" | "Awaiting Information" | "Approved" | "Waitlisted" | "Declined" | "closed";
const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "All applications" },
  { key: "New", label: "New" },
  { key: "Under Review", label: "Under review" },
  { key: "Awaiting Information", label: "Awaiting info" },
  { key: "Approved", label: "Approved" },
  { key: "Waitlisted", label: "Waitlisted" },
  { key: "Declined", label: "Declined" },
  { key: "closed", label: "Closed" },
];
const CLOSED: ApplicationStatus[] = ["Withdrawn", "Archived", "Draft"];
const STATUS_CLASS: Record<ApplicationStatus, string> = {
  New: "status-pending",
  "Under Review": "status-expiring",
  "Awaiting Information": "status-draft",
  Approved: "status-active",
  Declined: "status-terminated",
  Waitlisted: "status-occupied",
  Withdrawn: "status-former",
  Archived: "status-former",
  Draft: "status-draft",
};
const COLORS = ["blue", "violet", "teal", "amber", "rose", "slate"] as const;
const colorFor = (s: string) => {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) % 997;
  return COLORS[h % COLORS.length];
};
const initials = (name: string) => name.split(/\s+/).filter((w) => /^[A-Za-z0-9]/.test(w)).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
const inTab = (r: RowModel, tab: Tab) => (tab === "all" ? true : tab === "closed" ? CLOSED.includes(r.application.status) : r.application.status === tab);

export default function Applications({ params }: { params?: Record<string, string> } = {}) {
  const { state, can } = useStore();
  const [tab, setTab] = useState<Tab>("all");
  const [query, setQuery] = useState("");
  const [propertyId, setPropertyId] = useState("All");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("dateApplied");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [leaseFor, setLeaseFor] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ applicationId: string; request: DialogRequest } | null>(null);

  // deep links: #/applications?application=<id or number> opens the drawer, ?status=New filters, ?new=1 opens the wizard
  useEffect(() => {
    if (!params) return;
    if (params.status && TABS.some((t) => t.key === params.status)) setTab(params.status as Tab);
    if (params.application) {
      const a = state.applications.find((x) => x.id === params.application || x.applicationNumber === params.application);
      if (a) setDrawerId(a.id);
    }
    if (params.new === "1") setWizardOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params?.application, params?.status, params?.new]);

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

  const models = useMemo(() => state.applications.map((a) => rowModel(state, a)), [state]);
  const sorted = useMemo(
    () => sortApplications(filterRows(models, { query, status: "All", propertyId, unitId: "All", from, to }).filter((r) => inTab(r, tab)), sortKey, sortDir),
    [models, query, propertyId, from, to, tab, sortKey, sortDir],
  );
  const activeFilterCount = [query, propertyId !== "All", from, to].filter(Boolean).length;
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);
  const popoverCount = [propertyId !== "All", from, to].filter(Boolean).length;
  const resetPopover = () => { setPropertyId("All"); setFrom(""); setTo(""); setPage(1); };
  const reset = () => { setTab("all"); setQuery(""); setPropertyId("All"); setFrom(""); setTo(""); setPage(1); };
  const sortBy = (key: SortKey) => {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir(key === "applicant" || key === "status" ? "asc" : "desc"); }
    setPage(1);
  };
  const sortIcon = (key: SortKey) => (sortKey === key ? (sortDir === "desc" ? <ArrowDown size={12} /> : <ArrowUp size={12} />) : <ArrowUpDown size={11} />);
  const ariaSort = (key: SortKey) => (sortKey === key ? (sortDir === "desc" ? "descending" : "ascending") : undefined);
  const view = (id: string) => { setDrawerId(id); setMenu(null); };
  const ask = (applicationId: string, request: DialogRequest) => { setDialog({ applicationId, request }); setMenu(null); };

  const exportCsv = () => {
    const q = (v: unknown) => { const s = v === null || v === undefined ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const csv = [
      ["Application", "Applicant", "Email", "Property", "Unit", "Move-in", "Monthly rent", "Applied", "Status", "Documents"],
      ...sorted.map((r) => [r.application.applicationNumber, r.primaryName, r.primaryEmail, r.propertyName, r.unitLine, r.application.requestedMoveInDate, r.application.proposedRent ?? r.application.advertisedRent, r.application.submittedAt.slice(0, 10), r.application.status, r.docCount]),
    ].map((row) => row.map(q).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `applications-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(a.href);
  };

  const drawerApp = drawerId ? state.applications.find((a) => a.id === drawerId) : undefined;
  const drawerModel = drawerApp ? models.find((m) => m.application.id === drawerApp.id) : undefined;

  return (
    <div className="tn">
      <div className="app-shell">
        <div className="main-shell">
          <main className="main-content">
            <div className="page-heading">
              <div>
                <div className="page-title-line"><h1>Applications</h1></div>
                <p>Review rental applications, manage prospective tenants, and track applicants from submission to lease creation.</p>
              </div>
              <div className="page-heading-actions">
                <Button onClick={exportCsv}><Download size={15} />Export</Button>
                <Button variant="primary" onClick={() => setWizardOpen(true)}><Plus size={17} />New application</Button>
              </div>
            </div>

            <section className="directory-panel" aria-label="Application directory">
              <div className="directory-tabs" aria-label="Filter applications">
                {TABS.map((t) => (
                  <button key={t.key} className={`directory-tab ${tab === t.key ? "selected" : ""}`} aria-pressed={tab === t.key} onClick={() => { setTab(t.key); setPage(1); }}>
                    {t.label}<span>{models.filter((r) => inTab(r, t.key)).length}</span>
                  </button>
                ))}
                <div className="directory-tabs-end"><span className="live-dot" />{isSupabaseConfigured ? "Live" : "Demo data"}</div>
              </div>
              <div className="directory-toolbar">
                <SearchField label="Search applications" placeholder="Search application ID, applicant, email, property or unit..." value={query} onChange={(v) => { setQuery(v); setPage(1); }} />
                <div className="toolbar-actions">
                  <FilterPopover title="Filter applications" count={popoverCount} onReset={resetPopover}>
                    <FilterField id="app-property-filter" label="Property">
                      <select id="app-property-filter" value={propertyId} onChange={(e) => { setPropertyId(e.target.value); setPage(1); }}>
                        <option value="All">All properties</option>
                        {state.properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </FilterField>
                    <FilterField id="app-from-filter" label="Applied on or after">
                      <input id="app-from-filter" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
                    </FilterField>
                    <FilterField id="app-to-filter" label="Applied on or before">
                      <input id="app-to-filter" type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
                    </FilterField>
                  </FilterPopover>
                  <SortControl
                    label="Sort applications"
                    value={sortKey}
                    defaultValue="dateApplied"
                    descending={sortDir === "desc"}
                    options={SORT_LABELS.map((x) => ({ value: x.key, label: x.label }))}
                    onChange={(k) => { setSortKey(k as SortKey); setSortDir(k === "applicant" || k === "status" || k === "id" ? "asc" : "desc"); setPage(1); }}
                    onToggle={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
                  />
                </div>
              </div>

              <div className="tenant-table-wrap">
                <table className="tenant-table">
                  <caption className="sr-only">Application directory. Expand an application for a summary; open it for screening, documents, decision and activity.</caption>
                  <colgroup><col className="col-expand" /><col className="col-tenant" style={{ width: 230 }} /><col className="col-email" style={{ width: 190 }} /><col className="col-phone" style={{ width: 150 }} /><col className="col-units" style={{ width: 180 }} /><col className="col-balance" style={{ width: 130 }} /><col className="col-status" style={{ width: 140 }} /><col className="col-actions" /></colgroup>
                  <thead>
                    <tr>
                      <th className="expand-cell"><span className="sr-only">Expand</span></th>
                      <th aria-sort={ariaSort("applicant")}><button onClick={() => sortBy("applicant")}>Applicant{sortIcon("applicant")}</button></th>
                      <th className="email-cell">Property / unit</th>
                      <th className="phone-cell" aria-sort={ariaSort("moveIn")}><button onClick={() => sortBy("moveIn")}>Move-in{sortIcon("moveIn")}</button></th>
                      <th className="units-cell" aria-sort={ariaSort("dateApplied")}><button onClick={() => sortBy("dateApplied")}>Applied{sortIcon("dateApplied")}</button></th>
                      <th className="balance-cell" aria-sort={ariaSort("rent")}><button onClick={() => sortBy("rent")}>Monthly rent{sortIcon("rent")}</button></th>
                      <th className="status-cell" aria-sort={ariaSort("status")}><button onClick={() => sortBy("status")}>Status{sortIcon("status")}</button></th>
                      <th className="actions-cell">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paged.map((r) => {
                      const a = r.application;
                      const open = expanded === a.id;
                      const rent = a.proposedRent ?? a.advertisedRent;
                      return (
                        <Fragment key={a.id}>
                          <tr className={`tenant-row ${open ? "tenant-row-expanded" : ""}`}>
                            <td className="expand-cell">
                              <IconButton label={`${open ? "Collapse" : "Expand"} ${a.applicationNumber}`} className="expand-button" onClick={() => setExpanded(open ? null : a.id)} aria-expanded={open} aria-controls={`details-${a.id}`}>
                                <ChevronRight size={15} className={open ? "chevron-expanded" : ""} />
                              </IconButton>
                            </td>
                            <td className="tenant-cell">
                              <div className="tenant-identity">
                                <span className={`avatar avatar-md avatar-${colorFor(r.primaryName)}`} aria-hidden="true">{initials(r.primaryName)}</span>
                                <div>
                                  <button className="tenant-name" onClick={() => view(a.id)}>{r.primaryName}</button>
                                  <span className="tenant-number" title={r.primaryEmail}>{a.applicationNumber}</span>
                                </div>
                              </div>
                            </td>
                            <td className="email-cell" title={`${r.propertyName}\n${r.propertyAddress}`}>
                              <a>{r.propertyName}</a>
                              <span className="tenant-number">{r.unitLine}{a.unitReservation !== "None" ? ` · ${a.unitReservation}` : ""}</span>
                            </td>
                            <td className="phone-cell"><a>{formatDate(a.requestedMoveInDate)}</a><span className="tenant-number">{relativeDays(a.requestedMoveInDate)}</span></td>
                            <td className="units-cell">
                              <a>{formatDate(a.submittedAt)}</a>
                              <span className="tenant-number">{r.coApplicants.length} co-applicant{r.coApplicants.length === 1 ? "" : "s"} · {r.docCount} doc{r.docCount === 1 ? "" : "s"}</span>
                            </td>
                            <td className="balance-cell">
                              <span className="balance-value">{currency(rent)}</span>
                              <span className="tenant-number">{a.proposedRent != null && a.proposedRent !== a.advertisedRent ? "proposed" : "advertised"}</span>
                            </td>
                            <td className="status-cell"><span className={`status-badge ${STATUS_CLASS[a.status]}`}><span className="status-dot" />{a.status}</span></td>
                            <td className="actions-cell">
                              <div className="row-actions">
                                <IconButton label={`View ${a.applicationNumber}`} onClick={() => view(a.id)}><Eye size={15} /></IconButton>
                                <IconButton label={`Edit ${a.applicationNumber}`} onClick={() => ask(a.id, { kind: "editApplication" })}><Pencil size={14} /></IconButton>
                                <div className="row-more-anchor" data-row-menu>
                                  <IconButton label={`More actions for ${a.applicationNumber}`} onClick={() => setMenu(menu === a.id ? null : a.id)} aria-expanded={menu === a.id}><MoreHorizontal size={17} /></IconButton>
                                  {menu === a.id && (
                                    <div className="row-menu" style={{ width: 210 }}>
                                      <button onClick={() => view(a.id)}><Eye size={14} />View application</button>
                                      <button onClick={() => { const p = state.parties.find((x) => x.applicationId === a.id && x.isPrimary); if (p) ask(a.id, { kind: "editParty", partyId: p.id }); else setMenu(null); }}><Pencil size={14} />Edit primary applicant</button>
                                      <button disabled={!can("applications.decision.write")} onClick={() => ask(a.id, { kind: "status" })}><ClipboardList size={14} />Change status</button>
                                      <button onClick={() => ask(a.id, { kind: "requestInfo" })}><MessageSquare size={14} />Request information</button>
                                      <button onClick={() => ask(a.id, { kind: "uploadDocs" })}><FilePlus2 size={14} />Add document</button>
                                      <button onClick={() => ask(a.id, { kind: "communication" })}><MessageSquare size={14} />Log communication</button>
                                      <div className="menu-divider" />
                                      <button disabled={a.status !== "Approved"} onClick={() => { if (a.createdLeaseId) ask(a.id, { kind: "viewLease" }); else { setLeaseFor(a.id); setMenu(null); } }}><Home size={14} />{a.createdLeaseId ? "View linked lease" : "Create lease"}</button>
                                      <button className="danger-menu-item" onClick={() => ask(a.id, { kind: "archiveApplication" })}><Archive size={14} />Archive application</button>
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
                                    <span>APPLICATION SUMMARY</span>
                                    <button className="text-link" onClick={() => view(a.id)}>Open full application</button>
                                  </div>
                                  <div className="expanded-grid">
                                    <section className="detail-section is-compact">
                                      <SectionTitle title="Applicants" />
                                      <dl className="lease-facts">
                                        <DataField label="Primary">{r.primaryName}</DataField>
                                        <DataField label="Co-applicants">{r.coApplicantNames || "None"}</DataField>
                                        <DataField label="Proposed occupants">{r.occupantNames || "None"}</DataField>
                                      </dl>
                                    </section>
                                    <section className="detail-section is-compact">
                                      <SectionTitle title="Request" />
                                      <dl className="lease-facts">
                                        <DataField label="Requested term">{a.requestedLeaseTerm} months</DataField>
                                        <DataField label="Source">{a.applicationSource}</DataField>
                                        <DataField label="Documents">{r.docCount}</DataField>
                                        <DataField label="Notes">{a.internalNotes || "—"}</DataField>
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
                  title={models.length ? "No applications found" : "Your application directory starts here"}
                  description={models.length ? "Try a different search or adjust your filters." : "Create an application to start screening prospective tenants."}
                  action={<Button onClick={models.length ? reset : () => setWizardOpen(true)}>{models.length ? "Clear search & filters" : "New application"}</Button>}
                />
              )}
              <div className="table-pagination">
                <p>Showing <strong>{sorted.length ? (safePage - 1) * pageSize + 1 : 0}-{Math.min(safePage * pageSize, sorted.length)}</strong> of <strong>{sorted.length}</strong> applications</p>
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
              <span><ShieldCheck size={13} />Screening data is masked for staff without the screening permission. {isSupabaseConfigured ? "Documents are stored privately. Messages and e-signatures are not sent from here; they are recorded only." : "Document storage, messaging and e-signature are simulated."}</span>
              <span>{isSupabaseConfigured ? "Saved to your organization" : <>Demo data<span className="footnote-separator">&middot;</span>Nothing persists after a refresh</>}</span>
            </div>
          </main>
        </div>
      </div>

      <Drawer
        open={!!drawerApp}
        onClose={() => setDrawerId(null)}
        title="Application profile"
        subtitle="Everything about this application, in one place."
        heading={
          drawerModel && drawerApp ? (
            <div className="profile-heading">
              <span className={`avatar avatar-xl avatar-${colorFor(drawerModel.primaryName)}`} aria-hidden="true">{initials(drawerModel.primaryName)}</span>
              <div className="profile-identity">
                <h2>{drawerModel.primaryName}</h2>
                <div>
                  <span>{drawerApp.applicationNumber} &middot; {drawerModel.propertyName} &middot; {drawerModel.unitLine}</span>
                  <span className={`status-badge ${STATUS_CLASS[drawerApp.status]}`}><span className="status-dot" />{drawerApp.status}</span>
                </div>
              </div>
              <Button className="profile-edit-button" onClick={() => ask(drawerApp.id, { kind: "editApplication" })}><Pencil size={14} />Edit application</Button>
            </div>
          ) : undefined
        }
      >
        {drawerApp && <ExpandedApplication key={drawerApp.id} applicationId={drawerApp.id} onCollapse={() => setDrawerId(null)} />}
      </Drawer>

      <NewApplicationWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onCreated={(id) => { setTab("all"); setDrawerId(id); }}
      />
      {leaseFor && <CreateLeaseModal applicationId={leaseFor} onClose={() => setLeaseFor(null)} onViewLease={(id) => ask(id, { kind: "viewLease" })} />}
      {dialog && (
        <DialogHost
          key={`${dialog.applicationId}-${dialog.request.kind}-${JSON.stringify(dialog.request)}`}
          applicationId={dialog.applicationId}
          dialog={dialog.request}
          onClose={() => setDialog(null)}
        />
      )}
      <Toasts />
    </div>
  );
}
