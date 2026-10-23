import { isSupabaseConfigured } from "../lib/supabase";
// Expenses & Bills in the same format as the Properties, Leases, Units, Payments and Applications pages: tabs, search, the shared Tenants-style
// filters, sortable master rows, an inline summary (chevron) and a side drawer for the full bill (View). Recurring schedules are a tab.
// Ledger, schedules, allocation and the record/payment/recovery dialogs come from the expense module.
import { Fragment, useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ArrowUpRight,
  Banknote,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  FileText,
  Eye,
  Landmark,
  Bell,
  MoreHorizontal,
  Pause,
  Pencil,
  Play,
  Plus,
  Power,
  Receipt,
  ShieldCheck,
  Trash2,
  Users,
  Wallet,
} from "lucide-react";
import { Button, DataField, EmptyState, IconButton, SectionTitle, TextLink } from "../tenants/components/ui";
import { FilterField, FilterPopover, SearchField, SortControl } from "../shell/directory";
import { useApp } from "./context/AppContext";
import { getProvider, getTenant, getUnit, properties, propertyLabel, providers, units } from "./data/catalog";
import type { Bill, BillFilters, DueStatus, ProviderPaymentStatus, RecurringSchedule, SortDir, SortKey } from "./types";
import { dueStatus, landlordShare, providerBalance, providerStatus, recoveryOutstanding, recoveryStatus, sumPayments, sumRecoveries, totalTenantShare } from "./utils/bills";
import { allocationMethodLabel, categoryLabel, formatCAD, formatDate, formatDateRange, frequencyLabel } from "./utils/format";
import { Drawer } from "./components/ui/Drawer";
import { Toasts } from "./components/ui/Toasts";
import { ConfirmDialog } from "./components/ui/Modal";
import { AllocationModal } from "./components/bills/AllocationModal";
import { ExpandedBill } from "./components/bills/ExpandedBill";
import { RecordBillModal } from "./components/bills/RecordBillModal";
import { RecordPaymentModal } from "./components/bills/RecordPaymentModal";
import { RecordRecoveryModal } from "./components/bills/RecordRecoveryModal";
import { ScheduleModal } from "./components/bills/ScheduleModal";
import { Button as ModuleButton } from "./components/ui/Button";

type Tab = "all" | DueStatus | "schedules";
const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "All bills" },
  { key: "overdue", label: "Overdue" },
  { key: "due_soon", label: "Due soon" },
  { key: "upcoming", label: "Upcoming" },
  { key: "settled", label: "Settled" },
  { key: "schedules", label: "Recurring schedules" },
];
const emptyFilters: BillFilters = { query: "", propertyId: "", unitId: "", category: "", providerId: "", paymentStatus: "", recoveryStatus: "", dueFrom: "", dueTo: "" };
const COLORS = ["blue", "violet", "teal", "amber", "rose", "slate"] as const;
const colorFor = (s: string) => {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) % 997;
  return COLORS[h % COLORS.length];
};
const initials = (name: string) => name.split(/\s+/).filter((w) => /^[A-Za-z0-9]/.test(w)).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
const PAYMENT_LABEL: Record<ProviderPaymentStatus, string> = { unpaid: "Unpaid", partially_paid: "Partially paid", paid: "Paid" };
const PAYMENT_CLASS: Record<ProviderPaymentStatus, string> = { unpaid: "status-pending", partially_paid: "status-expiring", paid: "status-active" };
const SCHEDULE_CLASS = { active: "status-active", paused: "status-expiring", inactive: "status-former" } as const;

export default function Expenses({ params }: { params?: Record<string, string> } = {}) {
  const { bills, schedules, payments, recoveries, reminderSettings, deleteBill, setScheduleStatus, pushToast, ready, loadError, reload } = useApp();

  // tenants, leases or properties may have changed on other pages since the last load
  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [tab, setTab] = useState<Tab>("all");
  const [filters, setFilters] = useState<BillFilters>(emptyFilters);
  const [sortKey, setSortKey] = useState<SortKey>("dueDate");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [scheduleDrawerId, setScheduleDrawerId] = useState<string | null>(null);
  const [expandedSchedule, setExpandedSchedule] = useState<string | null>(null);
  const [billOpen, setBillOpen] = useState(false);
  const [schedulePrefill, setSchedulePrefill] = useState<RecurringSchedule | null>(null);
  const [editBill, setEditBill] = useState<Bill | null>(null);
  const [payBill, setPayBill] = useState<Bill | null>(null);
  const [recoverBill, setRecoverBill] = useState<Bill | null>(null);
  const [recoverTenant, setRecoverTenant] = useState<string | undefined>();
  const [allocBill, setAllocBill] = useState<Bill | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [editSchedule, setEditSchedule] = useState<RecurringSchedule | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Bill | null>(null);
  const [pendingStatus, setPendingStatus] = useState<{ schedule: RecurringSchedule; status: RecurringSchedule["status"] } | null>(null);

  // deep links: #/expenses?bill=BILL-2026-001 opens the drawer, ?status=overdue|due_soon|upcoming|settled|schedules filters, ?new=1 opens the form
  useEffect(() => {
    if (!params) return;
    if (params.status && TABS.some((t) => t.key === params.status)) setTab(params.status as Tab);
    if (params.bill) setDrawerId(params.bill);
    if (params.schedule) setScheduleDrawerId(params.schedule);
    if (params.expand) { setExpanded(params.expand); setExpandedSchedule(params.expand); }
    if (params.new === "1") setBillOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params?.bill, params?.schedule, params?.expand, params?.status, params?.new]);

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

  const dueOf = (b: Bill) => dueStatus(b, payments, reminderSettings.dueSoonDays);
  const setFilter = <K extends keyof BillFilters>(key: K, value: BillFilters[K]) => {
    setFilters((f) => ({ ...f, [key]: value, ...(key === "propertyId" ? { unitId: "" } : {}) }));
    setPage(1);
  };
  const unitOptions = useMemo(() => (filters.propertyId ? units.filter((u) => u.propertyId === filters.propertyId) : units), [filters.propertyId]);

  const filtered = useMemo(() => {
    const q = filters.query.trim().toLowerCase();
    const list = bills.filter((b) => {
      if (tab !== "all" && tab !== "schedules" && dueStatus(b, payments, reminderSettings.dueSoonDays) !== tab) return false;
      if (filters.propertyId && b.propertyId !== filters.propertyId) return false;
      if (filters.unitId && !b.unitIds.includes(filters.unitId)) return false;
      if (filters.category && b.category !== filters.category) return false;
      if (filters.providerId && b.providerId !== filters.providerId) return false;
      if (filters.paymentStatus && providerStatus(b, payments) !== filters.paymentStatus) return false;
      if (filters.recoveryStatus && recoveryStatus(b, recoveries) !== filters.recoveryStatus) return false;
      if (filters.dueFrom && b.dueDate < filters.dueFrom) return false;
      if (filters.dueTo && b.dueDate > filters.dueTo) return false;
      if (q) {
        const hay = [b.name, b.id, b.invoiceNumber, getProvider(b.providerId)?.name, propertyLabel(b.propertyId, b.unitIds), ...b.unitIds.map((id) => getUnit(id)?.name)].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    list.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "dueDate") cmp = a.dueDate.localeCompare(b.dueDate);
      if (sortKey === "amount") cmp = a.amount - b.amount;
      if (sortKey === "property") cmp = propertyLabel(a.propertyId).localeCompare(propertyLabel(b.propertyId));
      if (sortKey === "status") cmp = dueOf(a).localeCompare(dueOf(b));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bills, tab, filters, sortKey, sortDir, payments, recoveries, reminderSettings.dueSoonDays]);

  const activeFilters = [filters.propertyId, filters.unitId, filters.category, filters.providerId, filters.paymentStatus, filters.recoveryStatus, filters.dueFrom, filters.dueTo].filter(Boolean).length;
  const resetFilters = () => { setFilters((f) => ({ ...emptyFilters, query: f.query })); setPage(1); };
  const reset = () => { setFilters(emptyFilters); setTab("all"); setPage(1); };
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const sortBy = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir(key === "dueDate" ? "asc" : "desc"); }
    setPage(1);
  };
  const sortIcon = (key: SortKey) => (sortKey === key ? (sortDir === "desc" ? <ArrowDown size={12} /> : <ArrowUp size={12} />) : <ArrowUpDown size={11} />);
  const ariaSort = (key: SortKey) => (sortKey === key ? (sortDir === "desc" ? "descending" : "ascending") : undefined);
  const view = (id: string) => { setDrawerId(id); setMenu(null); };
  const openEdit = (b: Bill) => { setEditBill(b); setSchedulePrefill(null); setBillOpen(true); setMenu(null); };
  const unpaid = bills.filter((b) => sumPayments(payments, b.id) < b.amount);
  const tabCount = (t: Tab) => (t === "schedules" ? schedules.length : t === "all" ? bills.length : bills.filter((b) => dueOf(b) === t).length);

  const exportCsv = () => {
    const q = (v: unknown) => { const s = v === null || v === undefined ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const csv = [
      ["Bill ID", "Bill", "Category", "Provider", "Property / unit", "Period", "Invoice date", "Due date", "Amount", "Provider status", "Recovery status"],
      ...filtered.map((b) => [b.id, b.name, categoryLabel(b.category), getProvider(b.providerId)?.name, propertyLabel(b.propertyId, b.unitIds), formatDateRange(b.billingPeriodStart, b.billingPeriodEnd), b.invoiceDate, b.dueDate, b.amount.toFixed(2), providerStatus(b, payments), recoveryStatus(b, recoveries)]),
    ].map((row) => row.map(q).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `bills-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(a.href);
  };

  const drawerSchedule = scheduleDrawerId ? schedules.find((x) => x.id === scheduleDrawerId) : undefined;
  const scheduleBills = drawerSchedule ? bills.filter((b) => b.scheduleId === drawerSchedule.id) : [];
  const drawerBill = drawerId ? bills.find((b) => b.id === drawerId) : undefined;
  const onRecover = (bill: Bill, tenantId?: string) => { setRecoverBill(bill); setRecoverTenant(tenantId); };

  const statusBadge = (b: Bill) => {
    if (dueOf(b) === "overdue") return <span className="status-badge status-terminated"><span className="status-dot" />Overdue</span>;
    const s = providerStatus(b, payments);
    return <span className={`status-badge ${PAYMENT_CLASS[s]}`}><span className="status-dot" />{PAYMENT_LABEL[s]}</span>;
  };

  if (isSupabaseConfigured && (!ready || loadError)) {
    return (
      <div className="tn">
        <div className="app-shell">
          <div className="main-shell">
            <main className="main-content">
              <EmptyState
                title={loadError ? "We couldn't load your bills" : "Loading bills\u2026"}
                description={loadError ?? "Fetching your bills and schedules."}
              />
            </main>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="tn">
      <div className="app-shell">
        <div className="main-shell">
          <main className="main-content">
            <div className="page-heading">
              <div>
                <div className="page-title-line"><h1>Expenses &amp; Bills</h1></div>
                <p>Provider invoices and tenant reimbursements are tracked independently: paying the provider never clears a tenant&rsquo;s share.</p>
              </div>
              <div className="page-heading-actions">
                <Button onClick={() => { setEditSchedule(null); setScheduleOpen(true); }}><CalendarPlus size={15} />Add schedule</Button>
                <Button disabled={!unpaid.length} onClick={() => setPayBill(unpaid[0] ?? null)}><Wallet size={15} />Record payment</Button>
                <Button onClick={exportCsv}><ArrowUpRight size={15} />Export</Button>
                <Button variant="primary" onClick={() => { setEditBill(null); setSchedulePrefill(null); setBillOpen(true); }}><Plus size={17} />Record bill</Button>
              </div>
            </div>

            <section className="directory-panel" aria-label="Bills directory">
              <div className="directory-tabs" aria-label="Filter bills">
                {TABS.map((t) => (
                  <button key={t.key} className={`directory-tab ${tab === t.key ? "selected" : ""}`} aria-pressed={tab === t.key} onClick={() => { setTab(t.key); setPage(1); }}>
                    {t.label}<span>{tabCount(t.key)}</span>
                  </button>
                ))}
                {!isSupabaseConfigured && <div className="directory-tabs-end"><span className="live-dot" />Demo data</div>}
              </div>

              {tab !== "schedules" && (
                <div className="directory-toolbar">
                  <SearchField label="Search bills" placeholder="Search bill name, provider, invoice #, property or unit..." value={filters.query} onChange={(v) => setFilter("query", v)} />
                  <div className="toolbar-actions">
                    <FilterPopover title="Filter bills" count={activeFilters} onReset={resetFilters}>
                      <FilterField id="bill-property-filter" label="Property">
                        <select id="bill-property-filter" value={filters.propertyId} onChange={(e) => setFilter("propertyId", e.target.value)}>
                          <option value="">All properties</option>
                          {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      </FilterField>
                      <FilterField id="bill-unit-filter" label="Unit">
                        <select id="bill-unit-filter" value={filters.unitId} onChange={(e) => setFilter("unitId", e.target.value)}>
                          <option value="">All units</option>
                          {unitOptions.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>
                      </FilterField>
                      <FilterField id="bill-category-filter" label="Category">
                        <select id="bill-category-filter" value={filters.category} onChange={(e) => setFilter("category", e.target.value)}>
                          <option value="">All categories</option>
                          {["hydro", "gas", "water", "internet", "insurance", "property_tax", "maintenance", "other"].map((c) => <option key={c} value={c}>{c.replace("_", " ")}</option>)}
                        </select>
                      </FilterField>
                      <FilterField id="bill-provider-filter" label="Provider">
                        <select id="bill-provider-filter" value={filters.providerId} onChange={(e) => setFilter("providerId", e.target.value)}>
                          <option value="">All providers</option>
                          {providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      </FilterField>
                      <FilterField id="bill-payment-filter" label="Provider payment status">
                        <select id="bill-payment-filter" value={filters.paymentStatus} onChange={(e) => setFilter("paymentStatus", e.target.value)}>
                          <option value="">Any status</option>
                          <option value="unpaid">Unpaid</option>
                          <option value="partially_paid">Partially paid</option>
                          <option value="paid">Paid</option>
                        </select>
                      </FilterField>
                      <FilterField id="bill-recovery-filter" label="Tenant recovery status">
                        <select id="bill-recovery-filter" value={filters.recoveryStatus} onChange={(e) => setFilter("recoveryStatus", e.target.value)}>
                          <option value="">Any status</option>
                          <option value="not_recoverable">Not recoverable</option>
                          <option value="recovery_pending">Recovery pending</option>
                          <option value="partially_recovered">Partially recovered</option>
                          <option value="fully_recovered">Fully recovered</option>
                        </select>
                      </FilterField>
                      <FilterField id="bill-from-filter" label="Due on or after">
                        <input id="bill-from-filter" type="date" value={filters.dueFrom} onChange={(e) => setFilter("dueFrom", e.target.value)} />
                      </FilterField>
                      <FilterField id="bill-to-filter" label="Due on or before">
                        <input id="bill-to-filter" type="date" value={filters.dueTo} onChange={(e) => setFilter("dueTo", e.target.value)} />
                      </FilterField>
                    </FilterPopover>
                    <SortControl
                      label="Sort bills"
                      value={sortKey}
                      defaultValue="dueDate"
                      descending={sortDir === "desc"}
                      options={[{ value: "amount", label: "Amount" }, { value: "property", label: "Property" }, { value: "status", label: "Due status" }]}
                      onChange={(k) => { setSortKey(k as SortKey); setSortDir("desc"); setPage(1); }}
                      onToggle={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
                    />
                  </div>
                </div>
              )}

              {tab !== "schedules" ? (
                <>
                  <div className="tenant-table-wrap">
                    <table className="tenant-table">
                      <caption className="sr-only">Bills. Expand a bill for its provider payments and tenant recovery; open it for allocations, documents and reminders.</caption>
                      <colgroup><col className="col-expand" /><col className="col-tenant" style={{ width: 230 }} /><col className="col-email" style={{ width: 200 }} /><col className="col-phone" style={{ width: 150 }} /><col className="col-units" style={{ width: 190 }} /><col className="col-balance" style={{ width: 130 }} /><col className="col-status" style={{ width: 120 }} /><col className="col-actions" /></colgroup>
                      <thead>
                        <tr>
                          <th className="expand-cell"><span className="sr-only">Expand</span></th>
                          <th>Bill</th>
                          <th className="email-cell" aria-sort={ariaSort("property")}><button onClick={() => sortBy("property")}>Provider / property{sortIcon("property")}</button></th>
                          <th className="phone-cell" aria-sort={ariaSort("dueDate")}><button onClick={() => sortBy("dueDate")}>Due date{sortIcon("dueDate")}</button></th>
                          <th className="units-cell">Period / invoice</th>
                          <th className="balance-cell" aria-sort={ariaSort("amount")}><button onClick={() => sortBy("amount")}>Amount{sortIcon("amount")}</button></th>
                          <th className="status-cell" aria-sort={ariaSort("status")}><button onClick={() => sortBy("status")}>Status{sortIcon("status")}</button></th>
                          <th className="actions-cell">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paged.map((b) => {
                          const open = expanded === b.id;
                          const provider = getProvider(b.providerId);
                          const owed = providerBalance(b, payments);
                          return (
                            <Fragment key={b.id}>
                              <tr className={`tenant-row ${open ? "tenant-row-expanded" : ""}`}>
                                <td className="expand-cell">
                                  <IconButton label={`${open ? "Collapse" : "Expand"} ${b.id}`} className="expand-button" onClick={() => setExpanded(open ? null : b.id)} aria-expanded={open} aria-controls={`details-${b.id}`}>
                                    <ChevronRight size={15} className={open ? "chevron-expanded" : ""} />
                                  </IconButton>
                                </td>
                                <td className="tenant-cell">
                                  <div className="tenant-identity">
                                    <span className={`avatar avatar-md avatar-${colorFor(b.category)}`} aria-hidden="true">{initials(categoryLabel(b.category))}</span>
                                    <div>
                                      <button className="tenant-name" onClick={() => view(b.id)}>{b.name}</button>
                                      <span className="tenant-number" title={categoryLabel(b.category)}>{b.id}</span>
                                    </div>
                                  </div>
                                </td>
                                <td className="email-cell" title={propertyLabel(b.propertyId, b.unitIds)}><a>{provider?.name ?? "—"}</a><span className="tenant-number">{propertyLabel(b.propertyId, b.unitIds)}</span></td>
                                <td className="phone-cell"><a>{formatDate(b.dueDate)}</a><span className="tenant-number">Invoiced {formatDate(b.invoiceDate)}</span></td>
                                <td className="units-cell"><a>{formatDateRange(b.billingPeriodStart, b.billingPeriodEnd)}</a><span className="tenant-number">{b.invoiceNumber ?? "No invoice number"}</span></td>
                                <td className="balance-cell">
                                  <span className="balance-value">{formatCAD(b.amount)}</span>
                                  {owed > 0.005 ? <span className="overdue-label">{formatCAD(owed)} owing</span> : <span className="tenant-number">paid in full</span>}
                                </td>
                                <td className="status-cell">{statusBadge(b)}</td>
                                <td className="actions-cell">
                                  <div className="row-actions">
                                    <IconButton label={`View ${b.id}`} onClick={() => view(b.id)}><Eye size={15} /></IconButton>
                                    <IconButton label={`Edit ${b.id}`} onClick={() => openEdit(b)}><Pencil size={14} /></IconButton>
                                    <div className="row-more-anchor" data-row-menu>
                                      <IconButton label={`More actions for ${b.id}`} onClick={() => setMenu(menu === b.id ? null : b.id)} aria-expanded={menu === b.id}><MoreHorizontal size={17} /></IconButton>
                                      {menu === b.id && (
                                        <div className="row-menu" style={{ width: 210 }}>
                                          <button onClick={() => view(b.id)}><Eye size={14} />View bill</button>
                                          <button disabled={owed <= 0} onClick={() => { setPayBill(b); setMenu(null); }}><Wallet size={14} />Record provider payment</button>
                                          <button onClick={() => { onRecover(b); setMenu(null); }}><Users size={14} />Record tenant recovery</button>
                                          <button onClick={() => { setAllocBill(b); setMenu(null); }}><Receipt size={14} />Edit allocation</button>
                                          <div className="menu-divider" />
                                          <button className="danger-menu-item" onClick={() => { setPendingDelete(b); setMenu(null); }}><Trash2 size={14} />Delete bill</button>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </td>
                              </tr>
                              {open && (
                                <tr className="detail-row" id={`details-${b.id}`}>
                                  <td colSpan={8}>
                                    <div className="expanded-detail">
                                      <div className="expanded-detail-top">
                                        <span>BILL DETAILS</span>
                                        <TextLink onClick={() => view(b.id)}>Open full bill<ArrowUpRight size={12} /></TextLink>
                                      </div>
                                      <div className="expanded-grid">
                                        <section className="detail-section is-compact">
                                          <SectionTitle icon={<FileText size={15} />} title="Bill information" />
                                          <dl className="lease-facts">
                                            <DataField label="Provider">{provider?.name ?? "—"}</DataField>
                                            <DataField label="Account number">{b.accountNumber ?? "—"}</DataField>
                                            <DataField label="Invoice number">{b.invoiceNumber ?? "—"}</DataField>
                                            <DataField label="Billing period">{formatDateRange(b.billingPeriodStart, b.billingPeriodEnd)}</DataField>
                                            <DataField label="Due date">{formatDate(b.dueDate)}</DataField>
                                          </dl>
                                        </section>
                                        <section className="detail-section is-compact">
                                          <SectionTitle icon={<Landmark size={15} />} title="Provider payments" />
                                          <dl className="lease-facts">
                                            <DataField label="Invoice amount">{formatCAD(b.amount)}</DataField>
                                            <DataField label="Paid to provider">{formatCAD(sumPayments(payments, b.id))}</DataField>
                                            <DataField label="Remaining balance">{formatCAD(owed)}</DataField>
                                          </dl>
                                        </section>
                                        <section className="detail-section is-compact">
                                          <SectionTitle icon={<Banknote size={15} />} title="Tenant recovery" />
                                          <dl className="lease-facts">
                                            <DataField label="Tenant share">{formatCAD(totalTenantShare(b))}</DataField>
                                            <DataField label="Landlord share">{formatCAD(landlordShare(b))}</DataField>
                                            <DataField label="Recovered">{formatCAD(sumRecoveries(recoveries, b.id))}</DataField>
                                            <DataField label="Still to recover">{formatCAD(recoveryOutstanding(b, recoveries))}</DataField>
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
                      title={bills.length ? "No bills found" : "Your bills register starts here"}
                      description={bills.length ? "Try a different search or adjust your filters." : "Record a bill to start tracking provider invoices and tenant recoveries."}
                      action={<Button onClick={bills.length ? reset : () => setBillOpen(true)}>{bills.length ? "Clear search & filters" : "Record your first bill"}</Button>}
                    />
                  )}
                  <div className="table-pagination">
                    <p>Showing <strong>{filtered.length ? (safePage - 1) * pageSize + 1 : 0}-{Math.min(safePage * pageSize, filtered.length)}</strong> of <strong>{filtered.length}</strong> bills</p>
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
                </>
              ) : (
                <div className="tenant-table-wrap">
                  <table className="tenant-table">
                    <caption className="sr-only">Recurring schedules: expected future bills only.</caption>
                    <colgroup><col className="col-expand" /><col className="col-tenant" style={{ width: 215 }} /><col className="col-email" style={{ width: 185 }} /><col className="col-phone" style={{ width: 145 }} /><col className="col-units" style={{ width: 190 }} /><col className="col-balance" style={{ width: 105 }} /><col className="col-status" style={{ width: 100 }} /><col className="col-actions" /></colgroup>
                    <thead>
                      <tr>
                        <th className="expand-cell"><span className="sr-only">Expand</span></th>
                        <th>Schedule</th>
                        <th className="email-cell">Provider / property</th>
                        <th className="phone-cell">Frequency</th>
                        <th className="units-cell">Tenant rule</th>
                        <th className="balance-cell">Expected</th>
                        <th className="status-cell">Status</th>
                        <th className="actions-cell">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {schedules.map((s) => {
                        const key = `sch-${s.id}`;
                        const open = expandedSchedule === s.id;
                        const recorded = bills.filter((b) => b.scheduleId === s.id);
                        return (
                          <Fragment key={s.id}>
                          <tr className={`tenant-row ${open ? "tenant-row-expanded" : ""}`}>
                            <td className="expand-cell">
                              <IconButton label={`${open ? "Collapse" : "Expand"} ${s.id}`} className="expand-button" onClick={() => setExpandedSchedule(open ? null : s.id)} aria-expanded={open} aria-controls={`schedule-details-${s.id}`}>
                                <ChevronRight size={15} className={open ? "chevron-expanded" : ""} />
                              </IconButton>
                            </td>
                            <td className="tenant-cell">
                              <div className="tenant-identity">
                                <span className={`avatar avatar-md avatar-${colorFor(s.category)}`} aria-hidden="true">{initials(categoryLabel(s.category))}</span>
                                <div><button className="tenant-name" onClick={() => setScheduleDrawerId(s.id)}>{s.name}</button><span className="tenant-number" title={categoryLabel(s.category)}>{s.id}</span></div>
                              </div>
                            </td>
                            <td className="email-cell"><a>{getProvider(s.providerId)?.name}</a><span className="tenant-number">{propertyLabel(s.propertyId, s.unitId ? [s.unitId] : [])}</span></td>
                            <td className="phone-cell"><a>{frequencyLabel(s.frequency)}{s.customFrequencyNote ? ` · ${s.customFrequencyNote}` : ""}</a><span className="tenant-number">Next {formatDate(s.nextExpectedDate)}</span></td>
                            <td className="units-cell">
                              <a>{allocationMethodLabel(s.allocationMethod)}{s.allocationPercentage != null ? ` · ${s.allocationPercentage}%` : ""}{s.allocationFixedAmount != null ? ` · ${formatCAD(s.allocationFixedAmount)}` : ""}</a>
                              <span className="tenant-number">{s.allocationTenantIds.map((id) => getTenant(id)?.name).join(", ") || s.dueDateRule}</span>
                            </td>
                            <td className="balance-cell"><span className="balance-value">{s.expectedAmount != null ? formatCAD(s.expectedAmount) : "—"}</span></td>
                            <td className="status-cell"><span className={`status-badge ${SCHEDULE_CLASS[s.status]}`}><span className="status-dot" />{s.status[0].toUpperCase() + s.status.slice(1)}</span></td>
                            <td className="actions-cell">
                              <div className="row-actions">
                                <IconButton label={`View schedule ${s.id}`} onClick={() => setScheduleDrawerId(s.id)}><Eye size={15} /></IconButton>
                                <IconButton label={`Record actual bill for ${s.id}`} disabled={s.status !== "active"} onClick={() => { setEditBill(null); setSchedulePrefill(s); setBillOpen(true); }}><Plus size={15} /></IconButton>
                                <IconButton label={`Edit ${s.id}`} onClick={() => { setEditSchedule(s); setScheduleOpen(true); }}><Pencil size={14} /></IconButton>
                                <div className="row-more-anchor" data-row-menu>
                                  <IconButton label={`More actions for ${s.id}`} onClick={() => setMenu(menu === key ? null : key)} aria-expanded={menu === key}><MoreHorizontal size={17} /></IconButton>
                                  {menu === key && (
                                    <div className="row-menu" style={{ width: 200 }}>
                                      <button onClick={() => { setScheduleDrawerId(s.id); setMenu(null); }}><Eye size={14} />View schedule</button>
                                      <button disabled={s.status !== "active"} onClick={() => { setEditBill(null); setSchedulePrefill(s); setBillOpen(true); setMenu(null); }}><Plus size={14} />Record actual bill</button>
                                      <button onClick={() => { setEditSchedule(s); setScheduleOpen(true); setMenu(null); }}><Pencil size={14} />Edit schedule</button>
                                      <div className="menu-divider" />
                                      {s.status === "active" && <button onClick={() => { setPendingStatus({ schedule: s, status: "paused" }); setMenu(null); }}><Pause size={14} />Pause schedule</button>}
                                      {s.status === "paused" && <button onClick={() => { setPendingStatus({ schedule: s, status: "active" }); setMenu(null); }}><Play size={14} />Resume schedule</button>}
                                      {s.status !== "inactive" ? (
                                        <button className="danger-menu-item" onClick={() => { setPendingStatus({ schedule: s, status: "inactive" }); setMenu(null); }}><Power size={14} />Deactivate</button>
                                      ) : (
                                        <button onClick={() => { setPendingStatus({ schedule: s, status: "active" }); setMenu(null); }}><Play size={14} />Reactivate</button>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                          {open && (
                            <tr className="detail-row" id={`schedule-details-${s.id}`}>
                              <td colSpan={8}>
                                <div className="expanded-detail">
                                  <div className="expanded-detail-top">
                                    <span>SCHEDULE DETAILS</span>
                                    <TextLink onClick={() => setScheduleDrawerId(s.id)}>Open full schedule<ArrowUpRight size={12} /></TextLink>
                                  </div>
                                  <div className="expanded-grid">
                                    <section className="detail-section is-compact">
                                      <SectionTitle icon={<FileText size={15} />} title="Schedule information" />
                                      <dl className="lease-facts">
                                        <DataField label="Category">{categoryLabel(s.category)}</DataField>
                                        <DataField label="Account number">{s.accountNumber ?? "—"}</DataField>
                                        <DataField label="Due date rule">{s.dueDateRule}</DataField>
                                        <DataField label="Next expected">{formatDate(s.nextExpectedDate)}</DataField>
                                        <DataField label="Responsible party">{s.responsibleParty[0].toUpperCase() + s.responsibleParty.slice(1)}</DataField>
                                      </dl>
                                    </section>
                                    <section className="detail-section is-compact">
                                      <SectionTitle icon={<Users size={15} />} title="Tenant cost rule" />
                                      <dl className="lease-facts">
                                        <DataField label="Method">{allocationMethodLabel(s.allocationMethod)}</DataField>
                                        <DataField label="Share">{s.allocationPercentage != null ? `${s.allocationPercentage}%` : s.allocationFixedAmount != null ? formatCAD(s.allocationFixedAmount) : "—"}</DataField>
                                        <DataField label="Tenants">{s.allocationTenantIds.map((id) => getTenant(id)?.name).join(", ") || "None, landlord carries 100%"}</DataField>
                                      </dl>
                                    </section>
                                    <section className="detail-section is-compact">
                                      <SectionTitle icon={<Receipt size={15} />} title={`Recorded bills (${recorded.length})`} />
                                      {recorded.length ? (
                                        <dl className="lease-facts">
                                          {recorded.slice(0, 4).map((b) => (
                                            <DataField key={b.id} label={b.id}>{formatCAD(b.amount)} <span className="muted">&middot; due {formatDate(b.dueDate)}</span></DataField>
                                          ))}
                                        </dl>
                                      ) : (
                                        <EmptyState compact title="No bills yet" description="Record an actual bill from this schedule when the invoice arrives." />
                                      )}
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
                  {!schedules.length && <EmptyState title="No recurring schedules" description="Add a schedule to track expected future bills." action={<Button onClick={() => setScheduleOpen(true)}>Add schedule</Button>} />}
                </div>
              )}
            </section>
            <div className="directory-footnote">
              <span><ShieldCheck size={13} />Account in the landlord&rsquo;s name: the provider invoice and each tenant&rsquo;s reimbursement are separate ledgers.</span>
              <span>All amounts in CAD{!isSupabaseConfigured && <><span className="footnote-separator">&middot;</span>Demo data, nothing persists after a refresh</>}</span>
            </div>
          </main>
        </div>
      </div>

      <Drawer
        open={!!drawerBill}
        onClose={() => setDrawerId(null)}
        title="Bill record"
        subtitle="Everything about this bill, in one place."
        heading={
          drawerBill ? (
            <div className="profile-heading">
              <span className={`avatar avatar-xl avatar-${colorFor(drawerBill.category)}`} aria-hidden="true">{initials(categoryLabel(drawerBill.category))}</span>
              <div className="profile-identity">
                <h2>{drawerBill.name}</h2>
                <div>
                  <span>{drawerBill.id} &middot; {getProvider(drawerBill.providerId)?.name} &middot; {propertyLabel(drawerBill.propertyId, drawerBill.unitIds)}</span>
                  {statusBadge(drawerBill)}
                </div>
              </div>
              <Button className="profile-edit-button" onClick={() => openEdit(drawerBill)}><Pencil size={14} />Edit bill</Button>
            </div>
          ) : undefined
        }
      >
        {drawerBill && <ExpandedBill bill={drawerBill} onPay={() => setPayBill(drawerBill)} onRecover={(tid) => onRecover(drawerBill, tid)} onEditAlloc={() => setAllocBill(drawerBill)} />}
      </Drawer>

      <Drawer
        open={!!drawerSchedule}
        onClose={() => setScheduleDrawerId(null)}
        title="Schedule record"
        subtitle="Everything about this recurring schedule, in one place."
        heading={
          drawerSchedule ? (
            <div className="profile-heading">
              <span className={`avatar avatar-xl avatar-${colorFor(drawerSchedule.category)}`} aria-hidden="true">{initials(categoryLabel(drawerSchedule.category))}</span>
              <div className="profile-identity">
                <h2>{drawerSchedule.name}</h2>
                <div>
                  <span>{drawerSchedule.id} &middot; {getProvider(drawerSchedule.providerId)?.name} &middot; {propertyLabel(drawerSchedule.propertyId, drawerSchedule.unitId ? [drawerSchedule.unitId] : [])}</span>
                  <span className={`status-badge ${SCHEDULE_CLASS[drawerSchedule.status]}`}><span className="status-dot" />{drawerSchedule.status[0].toUpperCase() + drawerSchedule.status.slice(1)}</span>
                </div>
              </div>
              <Button className="profile-edit-button" onClick={() => { setEditSchedule(drawerSchedule); setScheduleOpen(true); }}><Pencil size={14} />Edit schedule</Button>
            </div>
          ) : undefined
        }
      >
        {drawerSchedule && (
          <div className="grid gap-4 p-1 lg:grid-cols-2">
            <section className="rounded-xl border border-u-line2 bg-u-card p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-u-ink"><FileText className="h-4 w-4 text-u-accent" />Schedule details</div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                {([
                  ["Category", categoryLabel(drawerSchedule.category)],
                  ["Service provider", getProvider(drawerSchedule.providerId)?.name ?? "—"],
                  ["Property / unit", propertyLabel(drawerSchedule.propertyId, drawerSchedule.unitId ? [drawerSchedule.unitId] : [])],
                  ["Account number", drawerSchedule.accountNumber ?? "—"],
                  ["Frequency", `${frequencyLabel(drawerSchedule.frequency)}${drawerSchedule.customFrequencyNote ? ` · ${drawerSchedule.customFrequencyNote}` : ""}`],
                  ["Expected amount", drawerSchedule.expectedAmount != null ? formatCAD(drawerSchedule.expectedAmount) : "—"],
                  ["Next expected", formatDate(drawerSchedule.nextExpectedDate)],
                  ["Due date rule", drawerSchedule.dueDateRule],
                  ["Responsible party", drawerSchedule.responsibleParty[0].toUpperCase() + drawerSchedule.responsibleParty.slice(1)],
                ] as [string, string][]).map(([k, v]) => (
                  <div key={k}><dt className="text-u-muted">{k}</dt><dd className="mt-0.5 text-u-ink">{v}</dd></div>
                ))}
              </dl>
              {drawerSchedule.notes && <p className="mt-3 text-xs leading-5 text-u-ink2">{drawerSchedule.notes}</p>}
              <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-u-muted">
                <Bell className="h-3.5 w-3.5 text-u-warn" />Reminders:
                {drawerSchedule.reminderDays.length ? drawerSchedule.reminderDays.map((d) => (
                  <span key={d} className="rounded-full border border-u-warn/30 bg-u-warn-soft px-2 py-0.5 text-u-warn">{d < 0 ? "After due if unpaid" : d === 0 ? "On due date" : `${d} days before`}</span>
                )) : <span>None</span>}
              </div>
            </section>

            <section className="rounded-xl border border-u-line2 bg-u-card p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-u-ink"><Users className="h-4 w-4 text-u-violet" />Tenant cost rule</div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                <div><dt className="text-u-muted">Method</dt><dd className="mt-0.5 text-u-ink">{allocationMethodLabel(drawerSchedule.allocationMethod)}</dd></div>
                <div><dt className="text-u-muted">Share</dt><dd className="mt-0.5 text-u-ink">{drawerSchedule.allocationPercentage != null ? `${drawerSchedule.allocationPercentage}%` : drawerSchedule.allocationFixedAmount != null ? formatCAD(drawerSchedule.allocationFixedAmount) : "—"}</dd></div>
                <div className="col-span-2"><dt className="text-u-muted">Tenants</dt><dd className="mt-0.5 text-u-ink">{drawerSchedule.allocationTenantIds.map((id) => getTenant(id)?.name).join(", ") || "No tenant recovery: the landlord carries 100%"}</dd></div>
              </dl>
              <div className="mt-4 flex flex-wrap gap-2">
                <ModuleButton disabled={drawerSchedule.status !== "active"} onClick={() => { setEditBill(null); setSchedulePrefill(drawerSchedule); setBillOpen(true); }}>Record actual bill</ModuleButton>
                {drawerSchedule.status === "active" && <ModuleButton variant="secondary" onClick={() => setPendingStatus({ schedule: drawerSchedule, status: "paused" })}>Pause</ModuleButton>}
                {drawerSchedule.status === "paused" && <ModuleButton variant="secondary" onClick={() => setPendingStatus({ schedule: drawerSchedule, status: "active" })}>Resume</ModuleButton>}
                {drawerSchedule.status !== "inactive" ? (
                  <ModuleButton variant="danger" onClick={() => setPendingStatus({ schedule: drawerSchedule, status: "inactive" })}>Deactivate</ModuleButton>
                ) : (
                  <ModuleButton variant="secondary" onClick={() => setPendingStatus({ schedule: drawerSchedule, status: "active" })}>Reactivate</ModuleButton>
                )}
              </div>
              {drawerSchedule.status !== "active" && <p className="mt-2 text-[11px] text-u-muted">Only active schedules can generate a new expected bill.</p>}
            </section>

            <section className="rounded-xl border border-u-line2 bg-u-card p-4 lg:col-span-2">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-u-ink"><Receipt className="h-4 w-4 text-u-warn" />Bills recorded from this schedule</div>
              {scheduleBills.length ? (
                <table className="w-full text-left text-xs">
                  <thead className="text-u-muted"><tr><th className="py-1.5 font-medium">Bill</th><th className="py-1.5 font-medium">Due</th><th className="py-1.5 font-medium">Amount</th><th className="py-1.5 font-medium">Status</th></tr></thead>
                  <tbody>
                    {scheduleBills.map((b) => (
                      <tr key={b.id} className="border-t border-u-line">
                        <td className="py-1.5"><button className="text-u-accent hover:underline" onClick={() => { setScheduleDrawerId(null); setDrawerId(b.id); }}>{b.id}</button> <span className="text-u-muted">{b.name}</span></td>
                        <td className="py-1.5 text-u-ink2">{formatDate(b.dueDate)}</td>
                        <td className="py-1.5 text-u-ink">{formatCAD(b.amount)}</td>
                        <td className="py-1.5 text-u-ink2">{PAYMENT_LABEL[providerStatus(b, payments)]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-xs text-u-muted">No actual bills have been recorded from this schedule yet.</p>
              )}
            </section>
          </div>
        )}
      </Drawer>

      <RecordBillModal open={billOpen} onClose={() => { setBillOpen(false); setEditBill(null); setSchedulePrefill(null); }} schedule={schedulePrefill} editBill={editBill} />
      <RecordPaymentModal open={!!payBill} onClose={() => setPayBill(null)} bill={payBill} />
      <RecordRecoveryModal open={!!recoverBill} onClose={() => { setRecoverBill(null); setRecoverTenant(undefined); }} bill={recoverBill} presetTenantId={recoverTenant} />
      <AllocationModal open={!!allocBill} onClose={() => setAllocBill(null)} bill={allocBill} />
      <ScheduleModal open={scheduleOpen} onClose={() => { setScheduleOpen(false); setEditSchedule(null); }} edit={editSchedule} />
      <ConfirmDialog
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        destructive
        confirmLabel="Delete bill"
        title="Delete this bill?"
        message="This removes the invoice and its related provider payments and tenant recoveries from this session. Historical records should normally be retained."
        onConfirm={() => {
          if (pendingDelete) {
            deleteBill(pendingDelete.id);
            setDrawerId(null);
            pushToast("Bill removed from this workspace session.");
          }
        }}
      />
      <ConfirmDialog
        open={!!pendingStatus}
        onClose={() => setPendingStatus(null)}
        confirmLabel={pendingStatus?.status === "inactive" ? "Deactivate" : pendingStatus?.status === "paused" ? "Pause" : "Update status"}
        title="Change schedule status?"
        message="Historical invoices and payments are kept. A paused or inactive schedule will not generate new expected bills."
        onConfirm={() => {
          if (pendingStatus) {
            setScheduleStatus(pendingStatus.schedule.id, pendingStatus.status);
            pushToast(`Schedule marked ${pendingStatus.status}.`);
          }
        }}
      />
      <Toasts />
    </div>
  );
}
