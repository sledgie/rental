// Renovation projects in the same format as the Properties, Leases, Units, Payments, Applications and Expenses pages: tabs, search, the shared
// Tenants-style filters, sortable master rows, an inline summary (chevron) and a side drawer with the full project record (View).
// The store, finance rules, tabbed project detail and the new-project wizard come from the renovation-project module.
import { Fragment, useEffect, useMemo, useState } from "react";
import {
  Archive,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ArrowUpRight,
  Ban,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Download,
  Eye,
  FileText,
  HardHat,
  MoreHorizontal,
  Plus,
  RotateCcw,
  ShieldCheck,
  DoorOpen,
} from "lucide-react";
import { Button, DataField, EmptyState, IconButton, SectionTitle, TextLink } from "../tenants/components/ui";
import { FilterCheckbox, FilterField, FilterPopover, SearchField, SortControl } from "../shell/directory";
import { useStore } from "./lib/store";
import { isSupabaseConfigured } from "../lib/supabase";
import { dateLong, dateShort, money, projectFinancials, projectProgress } from "./lib/finance";
import { exportProjectsCsv } from "./lib/export";
import type { Project, ProjectStatus } from "./lib/types";
import { NewProjectModal } from "./components/NewProjectModal";
import { ProjectDetailPage } from "./pages/ProjectDetail";
import { Drawer } from "./components/Drawer";
import { Toasts } from "./components/Toasts";
import { ConfirmDialog, Field, Modal, Button as ModuleButton, InfoNote, Textarea } from "./components/ui";

type Tab = "all" | ProjectStatus;
type SortKey = "priority" | "due" | "budget" | "completion" | "name";
const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "All projects" },
  { key: "In Progress", label: "In progress" },
  { key: "Approved", label: "Approved" },
  { key: "Planned", label: "Planned" },
  { key: "Draft", label: "Draft" },
  { key: "On Hold", label: "On hold" },
  { key: "Completed", label: "Completed" },
  { key: "Cancelled", label: "Cancelled" },
];
const STATUS_CLASS: Record<ProjectStatus, string> = {
  Draft: "status-draft",
  Planned: "status-pending",
  Approved: "status-occupied",
  "In Progress": "status-active",
  "On Hold": "status-expiring",
  Completed: "status-reserved",
  Cancelled: "status-terminated",
};
const HEALTH_CLASS = { "On track": "", "At risk": "amber-text", "Over budget": "red-text" } as const;
const COLORS = ["blue", "violet", "teal", "amber", "rose", "slate"] as const;
const colorFor = (s: string) => {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) % 997;
  return COLORS[h % COLORS.length];
};
const initials = (name: string) => name.split(/\s+/).filter((w) => /^[A-Za-z0-9]/.test(w)).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
const PRIORITY_RANK: Record<string, number> = { Emergency: 0, High: 1, Normal: 2, Low: 3 };

export default function Projects({ params }: { params?: Record<string, string> } = {}) {
  const { projects, contractors, properties, toggleArchive, transitionProject, notify } = useStore();
  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [propsFilter, setPropsFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [managerFilter, setManagerFilter] = useState("");
  const [healthFilter, setHealthFilter] = useState("");
  const [contractorFilter, setContractorFilter] = useState("");
  const [dueBefore, setDueBefore] = useState("");
  const [sort, setSort] = useState<SortKey>("priority");
  const [desc, setDesc] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<Project | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Project | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  // deep links: #/projects?project=PRJ-1001 opens the drawer, ?status=In%20Progress filters, ?new=1 opens the wizard, ?expand=<id> opens the row
  useEffect(() => {
    if (!params) return;
    if (params.status && TABS.some((t) => t.key === params.status)) setTab(params.status as Tab);
    if (params.project) setDrawerId(params.project);
    if (params.expand) setExpanded(params.expand);
    if (params.new === "1") setWizardOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params?.project, params?.expand, params?.status, params?.new]);

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

  const visible = useMemo(() => projects.filter((p) => showArchived || !p.archived), [projects, showArchived]);
  const types = useMemo(() => [...new Set(projects.map((p) => p.type))].sort(), [projects]);
  const managers = useMemo(() => [...new Set(projects.map((p) => p.manager))].sort(), [projects]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = visible.filter((p) => {
      if (tab !== "all" && p.status !== tab) return false;
      if (propsFilter && p.propertyId !== propsFilter) return false;
      if (typeFilter && p.type !== typeFilter) return false;
      if (managerFilter && p.manager !== managerFilter) return false;
      if (healthFilter && projectFinancials(p).budgetHealth !== healthFilter) return false;
      if (contractorFilter && !p.team.some((m) => m.contractorId === contractorFilter)) return false;
      if (dueBefore && p.estimatedCompletion > dueBefore) return false;
      if (!q) return true;
      return [p.name, p.id, p.propertyName, p.unitNumber, p.manager, p.description, p.type].join(" ").toLowerCase().includes(q);
    });
    list.sort((a, b) => {
      let cmp = 0;
      if (sort === "budget") cmp = projectFinancials(b).currentBudget - projectFinancials(a).currentBudget;
      else if (sort === "completion") cmp = projectProgress(b) - projectProgress(a);
      else if (sort === "due") cmp = a.estimatedCompletion.localeCompare(b.estimatedCompletion);
      else if (sort === "name") cmp = a.name.localeCompare(b.name);
      else cmp = (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9) || a.estimatedCompletion.localeCompare(b.estimatedCompletion);
      return desc ? -cmp : cmp;
    });
    return list;
  }, [visible, tab, search, propsFilter, typeFilter, managerFilter, healthFilter, contractorFilter, dueBefore, sort, desc]);

  const activeFilters = [showArchived, propsFilter, typeFilter, managerFilter, healthFilter, contractorFilter, dueBefore].filter(Boolean).length;
  const resetFilters = () => { setShowArchived(false); setPropsFilter(""); setTypeFilter(""); setManagerFilter(""); setHealthFilter(""); setContractorFilter(""); setDueBefore(""); setPage(1); };
  const reset = () => { setTab("all"); setSearch(""); setSort("priority"); setDesc(false); resetFilters(); };
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const sortBy = (key: SortKey) => {
    if (sort === key) setDesc(!desc);
    else { setSort(key); setDesc(false); }
    setPage(1);
  };
  const sortIcon = (key: SortKey) => (sort === key ? (desc ? <ArrowDown size={12} /> : <ArrowUp size={12} />) : <ArrowUpDown size={11} />);
  const ariaSort = (key: SortKey) => (sort === key ? (desc ? "descending" : "ascending") : undefined);
  const view = (id: string) => { setDrawerId(id); setMenu(null); };
  const tabCount = (t: Tab) => visible.filter((p) => t === "all" || p.status === t).length;
  const drawerProject = drawerId ? projects.find((p) => p.id === drawerId) : undefined;

  const doCancel = () => {
    if (!cancelTarget) return;
    if (!cancelReason.trim()) {
      notify("Cancellation reason required", "warning", "Financial and audit records are retained when a project is cancelled.");
      return;
    }
    const result = transitionProject(cancelTarget.id, "Cancelled", cancelReason);
    if (!result.ok) notify("Unable to cancel", "error", result.error);
    else { setCancelTarget(null); setCancelReason(""); }
  };

  return (
    <div className="tn">
      <div className="app-shell">
        <div className="main-shell">
          <main className="main-content">
            <div className="page-heading">
              <div>
                <div className="page-title-line"><h1>Projects</h1></div>
                <p>Plan, fund and deliver unit improvements, with budgets, inspections and unit readiness in one auditable record.</p>
              </div>
              <div className="page-heading-actions">
                <Button onClick={() => exportProjectsCsv(filtered, contractors)}><Download size={15} />Export</Button>
                <Button variant="primary" onClick={() => setWizardOpen(true)}><Plus size={17} />New project</Button>
              </div>
            </div>

            <section className="directory-panel" aria-label="Project directory">
              <div className="directory-tabs" aria-label="Filter projects">
                {TABS.map((t) => (
                  <button key={t.key} className={`directory-tab ${tab === t.key ? "selected" : ""}`} aria-pressed={tab === t.key} onClick={() => { setTab(t.key); setPage(1); }}>
                    {t.label}<span>{tabCount(t.key)}</span>
                  </button>
                ))}
                <div className="directory-tabs-end"><span className="live-dot" />{isSupabaseConfigured ? "Live" : "Demo data"}</div>
              </div>
              <div className="directory-toolbar">
                <SearchField label="Search projects" placeholder="Search project, property, unit, manager or description..." value={search} onChange={(v) => { setSearch(v); setPage(1); }} />
                <div className="toolbar-actions">
                  <FilterPopover title="Filter projects" count={activeFilters} onReset={resetFilters}>
                    <FilterCheckbox checked={showArchived} onChange={(v) => { setShowArchived(v); setPage(1); }} label="Include archived projects" hint="Historical records remain available" />
                    <FilterField id="project-property-filter" label="Property">
                      <select id="project-property-filter" value={propsFilter} onChange={(e) => { setPropsFilter(e.target.value); setPage(1); }}>
                        <option value="">All properties</option>
                        {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </FilterField>
                    <FilterField id="project-type-filter" label="Project type">
                      <select id="project-type-filter" value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}>
                        <option value="">All types</option>
                        {types.map((t) => <option key={t}>{t}</option>)}
                      </select>
                    </FilterField>
                    <FilterField id="project-manager-filter" label="Manager">
                      <select id="project-manager-filter" value={managerFilter} onChange={(e) => { setManagerFilter(e.target.value); setPage(1); }}>
                        <option value="">All managers</option>
                        {managers.map((m) => <option key={m}>{m}</option>)}
                      </select>
                    </FilterField>
                    <FilterField id="project-health-filter" label="Budget health">
                      <select id="project-health-filter" value={healthFilter} onChange={(e) => { setHealthFilter(e.target.value); setPage(1); }}>
                        <option value="">Any health</option>
                        <option>On track</option>
                        <option>At risk</option>
                        <option>Over budget</option>
                      </select>
                    </FilterField>
                    <FilterField id="project-contractor-filter" label="Contractor">
                      <select id="project-contractor-filter" value={contractorFilter} onChange={(e) => { setContractorFilter(e.target.value); setPage(1); }}>
                        <option value="">All contractors</option>
                        {contractors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </FilterField>
                    <FilterField id="project-due-filter" label="Completion due on or before">
                      <input id="project-due-filter" type="date" value={dueBefore} onChange={(e) => { setDueBefore(e.target.value); setPage(1); }} />
                    </FilterField>
                  </FilterPopover>
                  <SortControl
                    label="Sort projects"
                    value={sort}
                    defaultValue="priority"
                    descending={desc}
                    options={[{ value: "due", label: "Completion date" }, { value: "budget", label: "Approved budget" }, { value: "completion", label: "Progress" }, { value: "name", label: "Project name" }]}
                    onChange={(k) => { setSort(k as SortKey); setDesc(k === "budget" || k === "completion"); setPage(1); }}
                    onToggle={() => setDesc(!desc)}
                  />
                </div>
              </div>

              <div className="tenant-table-wrap">
                <table className="tenant-table">
                  <caption className="sr-only">Project directory. Expand a project for its team and readiness; open it for tasks, budget, invoices, inspections and documents.</caption>
                  <colgroup><col className="col-expand" /><col className="col-tenant" style={{ width: 250 }} /><col className="col-email" style={{ width: 190 }} /><col className="col-phone" style={{ width: 150 }} /><col className="col-units" style={{ width: 150 }} /><col className="col-balance" style={{ width: 140 }} /><col className="col-status" style={{ width: 120 }} /><col className="col-actions" /></colgroup>
                  <thead>
                    <tr>
                      <th className="expand-cell"><span className="sr-only">Expand</span></th>
                      <th aria-sort={ariaSort("name")}><button onClick={() => sortBy("name")}>Project{sortIcon("name")}</button></th>
                      <th className="email-cell">Property / unit</th>
                      <th className="phone-cell" aria-sort={ariaSort("due")}><button onClick={() => sortBy("due")}>Completion{sortIcon("due")}</button></th>
                      <th className="units-cell" aria-sort={ariaSort("completion")}><button onClick={() => sortBy("completion")}>Progress{sortIcon("completion")}</button></th>
                      <th className="balance-cell" aria-sort={ariaSort("budget")}><button onClick={() => sortBy("budget")}>Budget{sortIcon("budget")}</button></th>
                      <th className="status-cell">Status</th>
                      <th className="actions-cell">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paged.map((p) => {
                      const open = expanded === p.id;
                      const fin = projectFinancials(p);
                      const progress = projectProgress(p);
                      const team = p.team.map((m) => ({ m, c: contractors.find((c) => c.id === m.contractorId) }));
                      return (
                        <Fragment key={p.id}>
                          <tr className={`tenant-row ${open ? "tenant-row-expanded" : ""}`} style={p.archived ? { opacity: 0.65 } : undefined}>
                            <td className="expand-cell">
                              <IconButton label={`${open ? "Collapse" : "Expand"} ${p.id}`} className="expand-button" onClick={() => setExpanded(open ? null : p.id)} aria-expanded={open} aria-controls={`details-${p.id}`}>
                                <ChevronRight size={15} className={open ? "chevron-expanded" : ""} />
                              </IconButton>
                            </td>
                            <td className="tenant-cell">
                              <div className="tenant-identity">
                                <span className={`avatar avatar-md avatar-${colorFor(p.type)}`} aria-hidden="true">{initials(p.name)}</span>
                                <div>
                                  <button className="tenant-name" onClick={() => view(p.id)}>{p.name}</button>
                                  <span className="tenant-number" title={`${p.type} · ${p.priority} priority`}>{p.id}</span>
                                </div>
                              </div>
                            </td>
                            <td className="email-cell"><a>{p.propertyName}</a><span className="tenant-number">Unit {p.unitNumber}</span></td>
                            <td className="phone-cell"><a>{dateShort(p.estimatedCompletion)}</a><span className="tenant-number">{p.priority} priority</span></td>
                            <td className="units-cell"><a>{progress}% complete</a><span className={`tenant-number ${HEALTH_CLASS[fin.budgetHealth]}`}>{fin.budgetHealth}</span></td>
                            <td className="balance-cell"><span className="balance-value">{money(fin.currentBudget)}</span><span className="tenant-number">{money(fin.incurred)} incurred</span></td>
                            <td className="status-cell"><span className={`status-badge ${STATUS_CLASS[p.status]}`}><span className="status-dot" />{p.status}</span></td>
                            <td className="actions-cell">
                              <div className="row-actions">
                                <IconButton label={`View ${p.id}`} onClick={() => view(p.id)}><Eye size={15} /></IconButton>
                                <div className="row-more-anchor" data-row-menu>
                                  <IconButton label={`More actions for ${p.id}`} onClick={() => setMenu(menu === p.id ? null : p.id)} aria-expanded={menu === p.id}><MoreHorizontal size={17} /></IconButton>
                                  {menu === p.id && (
                                    <div className="row-menu" style={{ width: 200 }}>
                                      <button onClick={() => view(p.id)}><Eye size={14} />View project</button>
                                      <button onClick={() => { setArchiveTarget(p); setMenu(null); }}>{p.archived ? <RotateCcw size={14} /> : <Archive size={14} />}{p.archived ? "Restore project" : "Archive project"}</button>
                                      <div className="menu-divider" />
                                      <button className="danger-menu-item" disabled={p.status === "Completed" || p.status === "Cancelled"} onClick={() => { setCancelTarget(p); setMenu(null); }}><Ban size={14} />Cancel project</button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                          {open && (
                            <tr className="detail-row" id={`details-${p.id}`}>
                              <td colSpan={8}>
                                <div className="expanded-detail">
                                  <div className="expanded-detail-top">
                                    <span>PROJECT DETAILS</span>
                                    <TextLink onClick={() => view(p.id)}>Open project record<ArrowUpRight size={12} /></TextLink>
                                  </div>
                                  <div className="expanded-grid">
                                    <section className="detail-section is-compact">
                                      <SectionTitle icon={<FileText size={15} />} title="Project information" />
                                      <dl className="lease-facts">
                                        <DataField label="Type">{p.type}</DataField>
                                        <DataField label="Priority">{p.priority}</DataField>
                                        <DataField label="Manager">{p.manager}</DataField>
                                        <DataField label="Planned start">{dateLong(p.plannedStart)}</DataField>
                                        <DataField label="Est. completion">{dateLong(p.estimatedCompletion)}</DataField>
                                      </dl>
                                    </section>
                                    <section className="detail-section is-compact">
                                      <SectionTitle icon={<HardHat size={15} />} title={`Team (${team.length})`} />
                                      {team.length ? (
                                        <dl className="lease-facts">
                                          {team.slice(0, 5).map(({ m, c }) => <DataField key={m.id} label={m.role}>{c?.name ?? "Unknown contractor"}</DataField>)}
                                        </dl>
                                      ) : (
                                        <EmptyState compact title="No contractors" description="Assign a contractor from the project record." />
                                      )}
                                    </section>
                                    <section className="detail-section is-compact">
                                      <SectionTitle icon={<DoorOpen size={15} />} title="Unit readiness" />
                                      <dl className="lease-facts">
                                        <DataField label="Occupancy">{p.occupancyStatus}</DataField>
                                        <DataField label="Tenant">{p.tenantName ?? "—"}</DataField>
                                        <DataField label="Expected ready">{dateLong(p.expectedReadyDate)}</DataField>
                                        <DataField label="Readiness approved">{p.readinessApproved ? "Yes" : "Not yet"}</DataField>
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
                  title={projects.length ? "No projects found" : "Your project directory starts here"}
                  description={projects.length ? "Try a different search or adjust your filters." : "Create a project to plan budgets, tasks and inspections."}
                  action={<Button onClick={projects.length ? reset : () => setWizardOpen(true)}>{projects.length ? "Clear search & filters" : "New project"}</Button>}
                />
              )}
              <div className="table-pagination">
                <p>Showing <strong>{filtered.length ? (safePage - 1) * pageSize + 1 : 0}-{Math.min(safePage * pageSize, filtered.length)}</strong> of <strong>{filtered.length}</strong> projects</p>
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
              <span><ShieldCheck size={13} />Budget, committed and incurred figures are derived from approved records. Cancelling or archiving keeps the full audit trail.</span>
              <span><CalendarClock size={13} />All amounts in CAD{!isSupabaseConfigured && <><span className="footnote-separator">&middot;</span>Demo data</>}</span>
            </div>
          </main>
        </div>
      </div>

      <Drawer
        open={!!drawerProject}
        onClose={() => setDrawerId(null)}
        title="Project record"
        subtitle="Everything about this project, in one place."
      >
        {drawerProject && <ProjectDetailPage projectId={drawerProject.id} onBack={() => setDrawerId(null)} />}
      </Drawer>

      <NewProjectModal open={wizardOpen} onClose={() => setWizardOpen(false)} onCreated={(id) => { setWizardOpen(false); setTab("all"); setDrawerId(id); }} />
      <ConfirmDialog
        open={!!archiveTarget}
        onClose={() => setArchiveTarget(null)}
        onConfirm={() => { if (archiveTarget) { toggleArchive(archiveTarget.id, !archiveTarget.archived); setArchiveTarget(null); } }}
        title={archiveTarget?.archived ? "Restore this project?" : "Archive this project?"}
        description={archiveTarget ? `${archiveTarget.id} — ${archiveTarget.name}` : ""}
        confirmLabel={archiveTarget?.archived ? "Restore project" : "Archive project"}
        tone={archiveTarget?.archived ? "primary" : "danger"}
      />
      <Modal
        open={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        title="Cancel project"
        description="Cancellation is a terminal status. History and financial records are preserved."
        footer={<><ModuleButton variant="ghost" size="md" onClick={() => setCancelTarget(null)}>Keep project</ModuleButton><ModuleButton variant="danger" size="md" icon={Ban} onClick={doCancel}>Cancel project</ModuleButton></>}
      >
        <div className="space-y-3">
          <InfoNote tone="warning">All tasks, invoices, payments and documents remain available after cancellation.</InfoNote>
          <Field label="Cancellation reason" required><Textarea rows={3} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="e.g. Owner accepted insurance settlement" /></Field>
        </div>
      </Modal>
      <Toasts />
    </div>
  );
}
