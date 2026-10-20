// Invoice register in the same table design as the Tenants and Properties pages (the Tenants module's .tn styles).
import { Fragment, useEffect, useRef, useState } from "react";
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
  CreditCard,
  Download,
  Eye,
  FileText,
  User,
  FilePlus2,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Ban,
  X,
} from "lucide-react";
import { Button, DataField, EmptyState, IconButton, SectionTitle, TextLink } from "../../../tenants/components/ui";
import { useNavigate } from "@inv/router";
import { dueLabel, formatCAD, formatDate } from "@inv/lib/format";
import { DEMO_TODAY, properties } from "@inv/data/mockInvoices";
import {
  invoiceBalance,
  invoiceTotal,
  statusLabels,
  typeLabels,
  type Invoice,
  type InvoiceFilters,
  type InvoiceStatus,
  type InvoiceType,
} from "@inv/types/invoice";
import type { SortField, SortState } from "./InvoiceTable";

const TABS: { key: InvoiceStatus | "all"; label: string }[] = [
  { key: "all", label: "All invoices" },
  { key: "unpaid", label: "Unpaid" },
  { key: "partially_paid", label: "Partially paid" },
  { key: "overdue", label: "Overdue" },
  { key: "paid", label: "Paid" },
  { key: "draft", label: "Draft" },
  { key: "void", label: "Void" },
];

/** invoice status -> the Tenants module's badge colours */
const BADGE: Record<InvoiceStatus, string> = {
  paid: "status-active",
  partially_paid: "status-reserved",
  unpaid: "status-expiring",
  overdue: "status-terminated",
  draft: "status-draft",
  pending_approval: "status-pending",
  void: "status-voided",
};

const SORTS: { key: SortField; label: string }[] = [
  { key: "id", label: "Invoice ID" },
  { key: "issueDate", label: "Invoice date" },
  { key: "dueDate", label: "Due date" },
  { key: "total", label: "Total amount" },
  { key: "balance", label: "Balance due" },
  { key: "status", label: "Status" },
];

const COLORS = ["blue", "violet", "teal", "amber", "rose", "slate"] as const;
const colorFor = (s: string) => {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) % 997;
  return COLORS[h % COLORS.length];
};

export interface InvoiceRegisterProps {
  allInvoices: Invoice[];
  pageRows: Invoice[];
  totalItems: number;
  filters: InvoiceFilters;
  onFilterChange: (patch: Partial<InvoiceFilters>) => void;
  onClear: () => void;
  activeCount: number;
  tenants: string[];
  sort: SortState;
  onSort: (field: SortField) => void;
  onDirection: () => void;
  page: number;
  pageSize: number;
  onPage: (page: number) => void;
  onPageSize: (size: number) => void;
  onCreate: () => void;
  onExport: () => void;
  onEdit: (invoice: Invoice) => void;
  onRecordPayment: (invoice: Invoice) => void;
  onVoid: (invoice: Invoice) => void;
  onDownload: (invoice: Invoice) => void;
  onResetDemo: () => void;
}

export function InvoiceRegister(p: InvoiceRegisterProps) {
  const navigate = useNavigate();
  const [filterOpen, setFilterOpen] = useState(false);
  const [menu, setMenu] = useState<string | null>(null);
  // #/invoices?expand=INV-2026-009 opens that invoice's summary row
  const [expanded, setExpanded] = useState<string | null>(() => new URLSearchParams(window.location.hash.split("?")[1] ?? "").get("expand"));
  const filterRef = useRef<HTMLDivElement>(null);
  const { filters, sort } = p;
  const totalPages = Math.max(1, Math.ceil(p.totalItems / p.pageSize));
  const safePage = Math.min(p.page, totalPages);
  // the status tabs own the status filter, so the popover only holds the other filters
  const popoverActive = p.activeCount - Number(filters.status !== "all") - Number(!!filters.query.trim());

  useEffect(() => {
    if (!filterOpen && !menu) return;
    const close = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (filterOpen && !filterRef.current?.contains(t)) setFilterOpen(false);
      if (menu && !t.closest("[data-row-menu]")) setMenu(null);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setFilterOpen(false);
        setMenu(null);
      }
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", key);
    };
  }, [filterOpen, menu]);

  const open = (id: string) => navigate(`/invoices/${id}`);
  const sortIcon = (k: SortField) => (sort.field === k ? (sort.direction === "desc" ? <ArrowDown size={12} /> : <ArrowUp size={12} />) : <ArrowUpDown size={11} />);
  const ariaSort = (k: SortField) => (sort.field === k ? (sort.direction === "asc" ? "ascending" : "descending") : undefined);
  const count = (key: InvoiceStatus | "all") => (key === "all" ? p.allInvoices.length : p.allInvoices.filter((i) => i.status === key).length);
  const sortableTh = (k: SortField, label: string, cls = "") => (
    <th className={cls} aria-sort={ariaSort(k)}>
      <button onClick={() => p.onSort(k)}>
        {label}
        {sortIcon(k)}
      </button>
    </th>
  );

  return (
    <div className="tn">
      <div className="app-shell">
        <div className="main-shell">
          <main className="main-content">
            <div className="page-heading">
              <div>
                <div className="page-title-line">
                  <h1>Invoices</h1>
                </div>
                <p>Manage and track tenant invoices across your properties.</p>
              </div>
              <div className="page-heading-actions">
                <Button onClick={p.onExport}>
                  <Download size={15} />
                  Export
                </Button>
                <Button variant="primary" onClick={p.onCreate}>
                  <Plus size={17} />
                  Create invoice
                </Button>
              </div>
            </div>

            <section className="directory-panel" aria-label="Invoice register">
              <div className="directory-tabs" aria-label="Filter invoices by status">
                {TABS.map((t) => (
                  <button
                    key={t.key}
                    className={`directory-tab ${filters.status === t.key ? "selected" : ""}`}
                    aria-pressed={filters.status === t.key}
                    onClick={() => p.onFilterChange({ status: t.key })}
                  >
                    {t.label}
                    <span>{count(t.key)}</span>
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
                    aria-label="Search invoices"
                    placeholder="Search invoice ID, tenant, property or unit..."
                    value={filters.query}
                    onChange={(e) => p.onFilterChange({ query: e.target.value })}
                  />
                  {filters.query && (
                    <IconButton label="Clear search" onClick={() => p.onFilterChange({ query: "" })}>
                      <X size={14} />
                    </IconButton>
                  )}
                </div>
                <div className="toolbar-actions">
                  <div className="filter-anchor" ref={filterRef}>
                    <Button className={popoverActive > 0 ? "filters-active" : ""} aria-expanded={filterOpen} onClick={() => setFilterOpen(!filterOpen)}>
                      <SlidersHorizontal size={15} />
                      Filters
                      {popoverActive > 0 && <span className="filter-count">{popoverActive}</span>}
                      <ChevronDown size={13} />
                    </Button>
                    {filterOpen && (
                      <div className="filter-popover">
                        <div className="popover-title">
                          Filter invoices
                          <button
                            onClick={() =>
                              p.onFilterChange({ propertyId: "all", type: "all", due: "all", customFrom: "", customTo: "", tenant: "all", minAmount: "", maxAmount: "" })
                            }
                          >
                            Reset
                          </button>
                        </div>
                        <div className="popover-field">
                          <label htmlFor="inv-property">Property</label>
                          <select id="inv-property" value={filters.propertyId} onChange={(e) => p.onFilterChange({ propertyId: e.target.value })}>
                            <option value="all">All properties</option>
                            {properties.map((pr) => (
                              <option key={pr.id} value={pr.id}>
                                {pr.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="popover-field">
                          <label htmlFor="inv-tenant">Tenant</label>
                          <select id="inv-tenant" value={filters.tenant} onChange={(e) => p.onFilterChange({ tenant: e.target.value })}>
                            <option value="all">All tenants</option>
                            {p.tenants.map((t) => (
                              <option key={t} value={t}>
                                {t}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="popover-field">
                          <label htmlFor="inv-type">Invoice type</label>
                          <select id="inv-type" value={filters.type} onChange={(e) => p.onFilterChange({ type: e.target.value as InvoiceType | "all" })}>
                            <option value="all">All types</option>
                            {(Object.keys(typeLabels) as InvoiceType[]).map((t) => (
                              <option key={t} value={t}>
                                {typeLabels[t]}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="popover-field">
                          <label htmlFor="inv-due">Due date</label>
                          <select id="inv-due" value={filters.due} onChange={(e) => p.onFilterChange({ due: e.target.value as InvoiceFilters["due"] })}>
                            <option value="all">All dates</option>
                            <option value="overdue">Overdue</option>
                            <option value="this_week">Due this week</option>
                            <option value="this_month">Due this month</option>
                            <option value="custom">Custom range</option>
                          </select>
                        </div>
                        {filters.due === "custom" && (
                          <div className="popover-field">
                            <label htmlFor="inv-from">From / to</label>
                            <input id="inv-from" type="date" value={filters.customFrom} onChange={(e) => p.onFilterChange({ customFrom: e.target.value })} />
                            <input aria-label="To date" type="date" value={filters.customTo} onChange={(e) => p.onFilterChange({ customTo: e.target.value })} />
                          </div>
                        )}
                        <div className="popover-field">
                          <label htmlFor="inv-min">Amount (min / max)</label>
                          <input id="inv-min" inputMode="decimal" placeholder="Min" value={filters.minAmount} onChange={(e) => p.onFilterChange({ minAmount: e.target.value })} />
                          <input aria-label="Maximum amount" inputMode="decimal" placeholder="Max" value={filters.maxAmount} onChange={(e) => p.onFilterChange({ maxAmount: e.target.value })} />
                        </div>
                        <Button variant="primary" className="apply-filters" onClick={() => setFilterOpen(false)}>
                          Show results
                        </Button>
                      </div>
                    )}
                  </div>
                  <label className="sort-control">
                    <ArrowDownUp size={15} />
                    <span className="sr-only">Sort invoices</span>
                    <select aria-label="Sort invoices" value={sort.field} onChange={(e) => p.onSort(e.target.value as SortField)}>
                      {SORTS.map((s) => (
                        <option key={s.key} value={s.key}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={13} />
                  </label>
                  <IconButton className="sort-direction" label={sort.direction === "desc" ? "Sort ascending" : "Sort descending"} onClick={p.onDirection}>
                    {sort.direction === "desc" ? <ArrowDown size={16} /> : <ArrowUp size={16} />}
                  </IconButton>
                </div>
              </div>

              <div className="tenant-table-wrap">
                <table className="tenant-table">
                  <caption className="sr-only">Invoice register. Open an invoice to see its line items, payments and activity.</caption>
                  <colgroup>
                    <col className="col-expand" />
                    <col style={{ width: "10%" }} />
                    <col style={{ width: "17%" }} />
                    <col style={{ width: "14%" }} />
                    <col style={{ width: "8%" }} />
                    <col style={{ width: "9%" }} />
                    <col style={{ width: "9%" }} />
                    <col style={{ width: "9%" }} />
                    <col style={{ width: "12%" }} />
                    <col style={{ width: "9%" }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th className="expand-cell"><span className="sr-only">Expand</span></th>
                      {sortableTh("id", "Invoice")}
                      <th>Tenant</th>
                      <th className="email-cell">Property / unit</th>
                      {sortableTh("issueDate", "Issued", "phone-cell")}
                      {sortableTh("dueDate", "Due")}
                      {sortableTh("total", "Total", "balance-cell")}
                      {sortableTh("balance", "Balance", "balance-cell")}
                      {sortableTh("status", "Status", "status-cell")}
                      <th className="actions-cell">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {p.pageRows.map((inv) => {
                      const total = invoiceTotal(inv);
                      const balance = invoiceBalance(inv);
                      const voided = inv.status === "void";
                      const overdue =
                        inv.status === "overdue" ||
                        (balance > 0 && !["void", "draft", "pending_approval"].includes(inv.status) && new Date(`${inv.dueDate}T23:59:59`) < new Date(DEMO_TODAY));
                      const editable = inv.status === "draft" || inv.status === "pending_approval";
                      const isOpen = expanded === inv.id;
                      return (
                        <Fragment key={inv.id}>
                        <tr className={`tenant-row ${isOpen ? "tenant-row-expanded" : ""}`} style={voided ? { opacity: 0.6 } : undefined}>
                          <td className="expand-cell">
                            <IconButton
                              label={`${isOpen ? "Collapse" : "Expand"} invoice ${inv.id}`}
                              className="expand-button"
                              onClick={() => setExpanded(isOpen ? null : inv.id)}
                              aria-expanded={isOpen}
                              aria-controls={`details-${inv.id}`}
                            >
                              <ChevronRight size={15} className={isOpen ? "chevron-expanded" : ""} />
                            </IconButton>
                          </td>
                          <td className="tenant-cell">
                            <button className="tenant-name" onClick={() => open(inv.id)} aria-label={`Open invoice ${inv.id} for ${inv.tenant.name}`}>
                              {inv.id}
                            </button>
                            <span className="tenant-number" title={`${typeLabels[inv.type]} invoice`}>{inv.leaseRef}</span>
                          </td>
                          <td className="tenant-cell">
                            <div className="tenant-identity">
                              <span className={`avatar avatar-sm avatar-${colorFor(inv.tenant.name)}`} aria-hidden="true">
                                {inv.tenant.avatarInitials}
                              </span>
                              <div>
                                <a>{inv.tenant.name}</a>
                                <span className="tenant-number">{inv.tenant.email}</span>
                              </div>
                            </div>
                          </td>
                          <td className="email-cell" title={`${inv.propertyName}, unit ${inv.unit}`}>
                            <a>{inv.propertyName}</a>
                            <span className="tenant-number">Unit {inv.unit}</span>
                          </td>
                          <td className="phone-cell">
                            <a>{formatDate(inv.issueDate)}</a>
                          </td>
                          <td>
                            <a style={{ fontSize: 10, color: overdue ? undefined : "inherit" }} className={overdue ? "red-text" : undefined}>
                              {formatDate(inv.dueDate)}
                            </a>
                            <span className={`tenant-number ${overdue ? "red-text" : ""}`}>{voided ? "—" : balance <= 0 ? "Settled" : dueLabel(inv.dueDate)}</span>
                          </td>
                          <td className="balance-cell">
                            <span className="balance-value" style={{ color: "inherit" }}>
                              {formatCAD(total)}
                            </span>
                          </td>
                          <td className="balance-cell">
                            <span className={`balance-value ${balance <= 0 ? "green-text" : overdue ? "red-text" : ""}`}>{formatCAD(balance)}</span>
                          </td>
                          <td className="status-cell">
                            <span className={`status-badge ${BADGE[inv.status]}`}>
                              <span className="status-dot" />
                              {statusLabels[inv.status]}
                            </span>
                          </td>
                          <td className="actions-cell">
                            <div className="row-actions">
                              <IconButton label={`View invoice ${inv.id}`} onClick={() => open(inv.id)}>
                                <Eye size={15} />
                              </IconButton>
                              <IconButton label={`Edit invoice ${inv.id}`} disabled={!editable} onClick={() => p.onEdit(inv)}>
                                <Pencil size={14} />
                              </IconButton>
                              <div className="row-more-anchor" data-row-menu>
                                <IconButton label={`More actions for invoice ${inv.id}`} aria-expanded={menu === inv.id} onClick={() => setMenu(menu === inv.id ? null : inv.id)}>
                                  <MoreHorizontal size={17} />
                                </IconButton>
                                {menu === inv.id && (
                                  <div className="row-menu">
                                    <button onClick={() => { open(inv.id); setMenu(null); }}>
                                      <Eye size={14} />
                                      View invoice
                                    </button>
                                    <button disabled={voided || balance <= 0} onClick={() => { p.onRecordPayment(inv); setMenu(null); }}>
                                      <CreditCard size={14} />
                                      Record payment
                                    </button>
                                    <button onClick={() => { p.onDownload(inv); setMenu(null); }}>
                                      <Download size={14} />
                                      Download PDF
                                    </button>
                                    <div className="menu-divider" />
                                    <button className="danger-menu-item" disabled={voided} onClick={() => { p.onVoid(inv); setMenu(null); }}>
                                      <Ban size={14} />
                                      {voided ? "Invoice voided" : "Void invoice"}
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                        {isOpen && (
                          <tr className="detail-row" id={`details-${inv.id}`}>
                            <td colSpan={10}>
                              <div className="expanded-detail">
                                <div className="expanded-detail-top">
                                  <span>INVOICE DETAILS</span>
                                  <TextLink onClick={() => open(inv.id)}>
                                    Open invoice record
                                    <ArrowUpRight size={12} />
                                  </TextLink>
                                </div>
                                <div className="expanded-grid">
                                  <section className="detail-section is-compact">
                                    <SectionTitle icon={<User size={15} />} title="Billed to" />
                                    <dl className="lease-facts">
                                      <DataField label="Tenant">{inv.tenant.name}</DataField>
                                      <DataField label="Email"><a href={`mailto:${inv.tenant.email}`}>{inv.tenant.email}</a></DataField>
                                      <DataField label="Phone"><a href={`tel:${inv.tenant.phone.replace(/[^+\d]/g, "")}`}>{inv.tenant.phone}</a></DataField>
                                      <DataField label="Lease">{inv.leaseRef}</DataField>
                                    </dl>
                                  </section>
                                  <section className="detail-section is-compact">
                                    <SectionTitle icon={<FileText size={15} />} title="Billing details" />
                                    <dl className="lease-facts">
                                      <DataField label="Invoice type">{typeLabels[inv.type]}</DataField>
                                      <DataField label="Invoice date">{formatDate(inv.issueDate)}</DataField>
                                      <DataField label="Due date">{formatDate(inv.dueDate)}</DataField>
                                      <DataField label="Billing period">{formatDate(inv.billingPeriodStart)} &ndash; {formatDate(inv.billingPeriodEnd)}</DataField>
                                    </dl>
                                  </section>
                                  <section className="detail-section is-compact">
                                    <SectionTitle icon={<Building2 size={15} />} title="Property & unit" />
                                    <dl className="lease-facts">
                                      <DataField label="Property">{inv.propertyName}</DataField>
                                      <DataField label="Location">{properties.find((x) => x.id === inv.propertyId)?.city ?? "—"}</DataField>
                                      <DataField label="Unit">{inv.unit}</DataField>
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

              {!p.pageRows.length && (
                <EmptyState
                  title={p.allInvoices.length ? "No invoices found" : "Your invoice register starts here"}
                  description={p.allInvoices.length ? "Try a different search or adjust your filters." : "Create your first invoice to start tracking what tenants owe."}
                  action={<Button onClick={p.allInvoices.length ? p.onClear : p.onCreate}>{p.allInvoices.length ? "Clear search & filters" : "Create your first invoice"}</Button>}
                />
              )}

              <div className="table-pagination">
                <p>
                  Showing{" "}
                  <strong>
                    {p.totalItems ? (safePage - 1) * p.pageSize + 1 : 0}-{Math.min(safePage * p.pageSize, p.totalItems)}
                  </strong>{" "}
                  of <strong>{p.totalItems}</strong> invoices
                </p>
                <div className="pagination-controls">
                  <label className="page-size">
                    <span>Rows per page</span>
                    <select aria-label="Rows per page" value={p.pageSize} onChange={(e) => p.onPageSize(Number(e.target.value))}>
                      {[10, 20, 50].map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="pagination-buttons">
                    <IconButton className="first-page" label="First page" disabled={safePage === 1} onClick={() => p.onPage(1)}>
                      <ChevronsLeft size={15} />
                    </IconButton>
                    <IconButton label="Previous page" disabled={safePage === 1} onClick={() => p.onPage(safePage - 1)}>
                      <ChevronLeft size={15} />
                    </IconButton>
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter((n) => totalPages <= 5 || Math.abs(n - safePage) <= 1 || n === 1 || n === totalPages)
                      .map((n, i, arr) => (
                        <Fragment key={n}>
                          {i > 0 && n - arr[i - 1] > 1 && <span className="pagination-ellipsis">...</span>}
                          <button className={`page-number ${safePage === n ? "selected" : ""}`} aria-label={`Page ${n}`} aria-current={safePage === n ? "page" : undefined} onClick={() => p.onPage(n)}>
                            {n}
                          </button>
                        </Fragment>
                      ))}
                    <IconButton label="Next page" disabled={safePage === totalPages} onClick={() => p.onPage(safePage + 1)}>
                      <ChevronRight size={15} />
                    </IconButton>
                    <IconButton className="last-page" label="Last page" disabled={safePage === totalPages} onClick={() => p.onPage(totalPages)}>
                      <ChevronsRight size={15} />
                    </IconButton>
                  </div>
                </div>
              </div>
            </section>

            <div className="directory-footnote">
              <span>
                <ShieldCheck size={13} />
                Demonstration data &mdash; {p.allInvoices.length} invoices across {properties.length} properties. Changes persist in this browser only.
              </span>
              <span>
                <button className="text-link" onClick={p.onResetDemo}>
                  <FilePlus2 size={11} /> Reset demo data
                </button>
                <span className="footnote-separator">&middot;</span>All amounts in CAD
              </span>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
