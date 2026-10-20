// Payments directory in the same format as the Properties, Leases and Units pages: tabs, search, sortable master rows, an inline
// detail panel (chevron) and a side drawer for the full payment (View). Ledger, wizard, receipt and audit trail come from the payments module.
import { Fragment, useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowDownUp,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Download,
  Eye,
  FileText,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
  SquareCheck,
  X,
} from "lucide-react";
import { Button, DataField, EmptyState, IconButton, SectionTitle } from "../tenants/components/ui";
import { FilterCheckbox, FilterField, FilterPopover, SearchField, SortControl } from "../shell/directory";
import { usePayments } from "./store";
import type { Payment, PaymentMethod } from "./types";
import { fmtCAD, formatDate, METHOD_LABELS, METHOD_SHORT, periodLabel } from "./utils/paymentUtils";
import { PaymentForm } from "./components/PaymentForm";
import { PaymentDetails } from "./components/PaymentDetails";
import { ReceiptPreview } from "./components/ReceiptPreview";
import { AuditTrailPanel } from "./components/AuditHistory";
import { ToastStack } from "./components/ui";

type Tab = "all" | "posted" | "reversed" | "refunded";
type SortKey = "date" | "tenant" | "amount";
const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "All payments" },
  { key: "posted", label: "Posted" },
  { key: "reversed", label: "Reversed" },
  { key: "refunded", label: "Refunded" },
];
const COLORS = ["blue", "violet", "teal", "amber", "rose", "slate"] as const;
const colorFor = (s: string) => {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) % 997;
  return COLORS[h % COLORS.length];
};
const initials = (name: string) => name.split(/\s+/).filter((w) => /^[A-Za-z0-9]/.test(w)).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
const inTab = (p: Payment, tab: Tab) => tab === "all" || (tab === "refunded" ? !!p.refund : p.status === tab);

export default function Payments({ params }: { params?: Record<string, string> } = {}) {
  const ledger = usePayments();
  const {
    payments, allocations, balances, loading, INVOICES, TENANTS, LEASES, UNITS, PROPERTIES, USERS,
    currentUserId, setCurrentUserId, formOpen, setFormOpen, detailsId, setDetailsId, receiptForId, setReceiptForId, lastAddedId,
    toasts, setToasts, credits, creditBalances, creditApplications, audits, handlePost, handleReverse, handleRefund, handleReset,
    runAcceptanceTest, lookup, receiptArgsFor, printReceiptFor, downloadReceiptFor, detailsPayment, receiptPayment,
  } = ledger;

  const [tab, setTab] = useState<Tab>("all");
  const [query, setQuery] = useState("");
  const [propertyFilter, setPropertyFilter] = useState("");
  const [tenantFilter, setTenantFilter] = useState("");
  const [methodFilter, setMethodFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [desc, setDesc] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [menu, setMenu] = useState<string | null>(null);

  // deep links: #/payments?payment=PAY-2026-0157 opens the drawer, ?status=posted|reversed|refunded filters, ?new=1 opens the wizard
  useEffect(() => {
    if (!params) return;
    if (params.payment) setDetailsId(params.payment);
    if (params.status && TABS.some((t) => t.key === params.status)) setTab(params.status as Tab);
    if (params.new === "1") setFormOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params?.payment, params?.status, params?.new]);

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

  const rows = useMemo(() => {
    const tenantById = new Map(TENANTS.map((t) => [t.id, t]));
    const leaseById = new Map(LEASES.map((l) => [l.id, l]));
    const unitById = new Map(UNITS.map((u) => [u.id, u]));
    const propertyById = new Map(PROPERTIES.map((p) => [p.id, p]));
    const invoiceById = new Map(INVOICES.map((i) => [i.id, i]));
    const userById = new Map(USERS.map((u) => [u.id, u]));
    return payments.map((payment) => {
      const lease = leaseById.get(payment.leaseId);
      const unit = lease ? unitById.get(lease.unitId) : undefined;
      const property = unit ? propertyById.get(unit.propertyId) : undefined;
      const lines = allocations
        .filter((a) => a.paymentId === payment.id)
        .map((a) => ({ allocation: a, invoice: invoiceById.get(a.invoiceId) }))
        .filter((l) => l.invoice)
        .sort((a, b) => a.invoice!.dueDate.localeCompare(b.invoice!.dueDate));
      const first = lines[0]?.invoice;
      const summary = first
        ? lines.length === 1
          ? periodLabel(first.periodStart, first.periodEnd)
          : `${periodLabel(first.periodStart, first.periodEnd)} +${lines.length - 1} more`
        : "No invoice";
      return {
        payment,
        tenant: tenantById.get(payment.tenantId),
        tenantName: tenantById.get(payment.tenantId)?.name ?? "Unknown tenant",
        propertyId: property?.id ?? "",
        propertyName: property?.name ?? "—",
        unitNumber: unit?.number ?? "",
        lines,
        summary,
        recordedBy: userById.get(payment.recordedById)?.name ?? payment.recordedById,
      };
    });
  }, [payments, allocations, TENANTS, LEASES, UNITS, PROPERTIES, INVOICES, USERS]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = rows.filter((r) => {
      const p = r.payment;
      if (!inTab(p, tab)) return false;
      if (q && !`${r.tenantName} ${p.id} ${p.receiptId ?? ""} ${p.reference ?? ""}`.toLowerCase().includes(q)) return false;
      if (propertyFilter && r.propertyId !== propertyFilter) return false;
      if (tenantFilter && p.tenantId !== tenantFilter) return false;
      if (methodFilter && p.method !== (methodFilter as PaymentMethod)) return false;
      if (dateFrom && p.date < dateFrom) return false;
      if (dateTo && p.date > dateTo) return false;
      return true;
    });
    list.sort((a, b) => {
      const cmp = sortKey === "date" ? a.payment.date.localeCompare(b.payment.date) : sortKey === "tenant" ? a.tenantName.localeCompare(b.tenantName) : a.payment.amount - b.payment.amount;
      return desc ? -cmp : cmp;
    });
    return list;
  }, [rows, tab, query, propertyFilter, tenantFilter, methodFilter, dateFrom, dateTo, sortKey, desc]);

  const activeFilterCount = [query, propertyFilter, tenantFilter, methodFilter, dateFrom, dateTo].filter(Boolean).length;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const popoverCount = [propertyFilter, tenantFilter, methodFilter, dateFrom, dateTo].filter(Boolean).length;
  const resetPopover = () => { setPropertyFilter(""); setTenantFilter(""); setMethodFilter(""); setDateFrom(""); setDateTo(""); setPage(1); };
  const reset = () => { setTab("all"); setQuery(""); setPropertyFilter(""); setTenantFilter(""); setMethodFilter(""); setDateFrom(""); setDateTo(""); setPage(1); };
  const sortBy = (key: SortKey) => {
    if (sortKey === key) setDesc(!desc);
    else { setSortKey(key); setDesc(key !== "tenant"); }
    setPage(1);
  };
  const sortIcon = (key: SortKey) => (sortKey === key ? (desc ? <ArrowDown size={12} /> : <ArrowUp size={12} />) : <ArrowUpDown size={11} />);
  const ariaSort = (key: SortKey) => (sortKey === key ? (desc ? "descending" : "ascending") : undefined);
  const view = (id: string) => { setDetailsId(id); setMenu(null); };

  const exportCsv = () => {
    const q = (v: unknown) => { const s = v === null || v === undefined ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const csv = [
      ["Payment ID", "Receipt", "Date", "Tenant", "Property", "Unit", "Method", "Reference", "Amount", "Status", "Refunded", "Recorded by"],
      ...filtered.map((r) => [r.payment.id, r.payment.receiptId, r.payment.date, r.tenantName, r.propertyName, r.unitNumber, METHOD_LABELS[r.payment.method], r.payment.reference, (r.payment.amount / 100).toFixed(2), r.payment.status, r.payment.refund ? (r.payment.refund.amount / 100).toFixed(2) : "", r.recordedBy]),
    ].map((row) => row.map(q).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `payments-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(a.href);
  };

  return (
    <div className="tn">
      <div className="app-shell">
        <div className="main-shell">
          <main className="main-content">
            <div className="page-heading">
              <div>
                <div className="page-title-line"><h1>Payments</h1></div>
                <p>Record rent payments, allocate them across invoices, track partial payments and issue receipts.</p>
              </div>
              <div className="page-heading-actions">
                <label className="sort-control" style={{ minWidth: 250 }} title="Recorded on payments, reversals, refunds and audit events">
                  <span className="sr-only">Acting as</span>
                  <select aria-label="Acting staff user" value={currentUserId} onChange={(e) => setCurrentUserId(e.target.value)}>
                    {USERS.map((u) => <option key={u.id} value={u.id}>{u.name} · {u.role}</option>)}
                  </select>
                  <ChevronDown size={13} />
                </label>
                <Button onClick={runAcceptanceTest} title="Posts the $1,000.00 two-invoice scenario and verifies the result"><SquareCheck size={15} />Run acceptance test</Button>
                <Button onClick={handleReset}><RotateCcw size={15} />Reset demo data</Button>
                <Button onClick={exportCsv}><Download size={15} />Export</Button>
                <Button variant="primary" onClick={() => setFormOpen(true)}><Plus size={17} />New payment</Button>
              </div>
            </div>

            <section className="directory-panel" aria-label="Payment directory">
              <div className="directory-tabs" aria-label="Filter payments">
                {TABS.map((t) => (
                  <button key={t.key} className={`directory-tab ${tab === t.key ? "selected" : ""}`} aria-pressed={tab === t.key} onClick={() => { setTab(t.key); setPage(1); }}>
                    {t.label}<span>{payments.filter((p) => inTab(p, t.key)).length}</span>
                  </button>
                ))}
                <div className="directory-tabs-end"><span className="live-dot" />Demo data</div>
              </div>
              <div className="directory-toolbar">
                <SearchField label="Search payments" placeholder="Search payment ID, receipt number, tenant or reference..." value={query} onChange={(v) => { setQuery(v); setPage(1); }} />
                <div className="toolbar-actions">
                  <FilterPopover title="Filter payments" count={popoverCount} onReset={resetPopover}>
                    <FilterField id="pay-property-filter" label="Property">
                      <select id="pay-property-filter" value={propertyFilter} onChange={(e) => { setPropertyFilter(e.target.value); setPage(1); }}>
                        <option value="">All properties</option>
                        {PROPERTIES.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </FilterField>
                    <FilterField id="pay-tenant-filter" label="Tenant">
                      <select id="pay-tenant-filter" value={tenantFilter} onChange={(e) => { setTenantFilter(e.target.value); setPage(1); }}>
                        <option value="">All tenants</option>
                        {TENANTS.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    </FilterField>
                    <FilterField id="pay-method-filter" label="Payment method">
                      <select id="pay-method-filter" value={methodFilter} onChange={(e) => { setMethodFilter(e.target.value); setPage(1); }}>
                        <option value="">Any method</option>
                        {(Object.keys(METHOD_LABELS) as PaymentMethod[]).map((m) => <option key={m} value={m}>{METHOD_LABELS[m]}</option>)}
                      </select>
                    </FilterField>
                    <FilterField id="pay-from-filter" label="Paid on or after">
                      <input id="pay-from-filter" type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} />
                    </FilterField>
                    <FilterField id="pay-to-filter" label="Paid on or before">
                      <input id="pay-to-filter" type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} />
                    </FilterField>
                  </FilterPopover>
                  <SortControl
                    label="Sort payments"
                    value={sortKey}
                    defaultValue="date"
                    descending={desc}
                    options={[{ value: "tenant", label: "Tenant" }, { value: "amount", label: "Amount" }]}
                    onChange={(k) => { setSortKey(k as SortKey); setDesc(k !== "tenant"); setPage(1); }}
                    onToggle={() => setDesc(!desc)}
                  />
                </div>
              </div>

              <div className="tenant-table-wrap">
                <table className="tenant-table">
                  <caption className="sr-only">Payment directory. Expand a payment for its allocations; open it for the full record, receipt and audit history.</caption>
                  <colgroup><col className="col-expand" /><col className="col-tenant" style={{ width: 230 }} /><col className="col-email" style={{ width: 190 }} /><col className="col-phone" style={{ width: 150 }} /><col className="col-units" style={{ width: 170 }} /><col className="col-balance" style={{ width: 130 }} /><col className="col-status" style={{ width: 110 }} /><col className="col-actions" /></colgroup>
                  <thead>
                    <tr>
                      <th className="expand-cell"><span className="sr-only">Expand</span></th>
                      <th aria-sort={ariaSort("tenant")}><button onClick={() => sortBy("tenant")}>Payment{sortIcon("tenant")}</button></th>
                      <th className="email-cell">Property / unit</th>
                      <th className="phone-cell" aria-sort={ariaSort("date")}><button onClick={() => sortBy("date")}>Date{sortIcon("date")}</button></th>
                      <th className="units-cell">Applied to</th>
                      <th className="balance-cell" aria-sort={ariaSort("amount")}><button onClick={() => sortBy("amount")}>Amount{sortIcon("amount")}</button></th>
                      <th className="status-cell">Status</th>
                      <th className="actions-cell">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paged.map((r) => {
                      const p = r.payment;
                      const open = expanded === p.id;
                      return (
                        <Fragment key={p.id}>
                          <tr className={`tenant-row ${open ? "tenant-row-expanded" : ""}`} style={lastAddedId === p.id ? { animation: "p-row-flash 2s ease-out 1" } : undefined}>
                            <td className="expand-cell">
                              <IconButton label={`${open ? "Collapse" : "Expand"} payment ${p.id}`} className="expand-button" onClick={() => setExpanded(open ? null : p.id)} aria-expanded={open} aria-controls={`details-${p.id}`}>
                                <ChevronRight size={15} className={open ? "chevron-expanded" : ""} />
                              </IconButton>
                            </td>
                            <td className="tenant-cell">
                              <div className="tenant-identity">
                                <span className={`avatar avatar-md avatar-${colorFor(r.tenantName)}`} aria-hidden="true">{initials(r.tenantName)}</span>
                                <div>
                                  <button className="tenant-name" onClick={() => view(p.id)}>{r.tenantName}</button>
                                  <span className="tenant-number">{p.id}<span>{p.receiptId ?? "No receipt"}</span></span>
                                </div>
                              </div>
                            </td>
                            <td className="email-cell"><a>{r.propertyName}</a><span className="tenant-number">{r.unitNumber ? `Unit ${r.unitNumber}` : ""}</span></td>
                            <td className="phone-cell"><a>{formatDate(p.date)}</a><span className="tenant-number">{METHOD_SHORT[p.method]}</span></td>
                            <td className="units-cell"><a>{r.summary}</a><span className="tenant-number">{r.lines.length} allocation{r.lines.length === 1 ? "" : "s"}</span></td>
                            <td className="balance-cell">
                              <span className={`balance-value ${p.status === "reversed" ? "red-text" : ""}`} style={p.status === "reversed" ? { textDecoration: "line-through" } : undefined}>{fmtCAD(p.amount)}</span>
                              {p.refund && <span className="overdue-label">{fmtCAD(p.refund.amount)} refunded</span>}
                            </td>
                            <td className="status-cell">
                              {p.status === "reversed" ? (
                                <span className="status-badge status-terminated"><span className="status-dot" />Reversed</span>
                              ) : p.refund ? (
                                <span className="status-badge status-expiring"><span className="status-dot" />Refunded</span>
                              ) : (
                                <span className="status-badge status-active"><span className="status-dot" />Posted</span>
                              )}
                            </td>
                            <td className="actions-cell">
                              <div className="row-actions">
                                <IconButton label={`View payment ${p.id}`} onClick={() => view(p.id)}><Eye size={15} /></IconButton>
                                <IconButton label={`Receipt for ${p.id}`} onClick={() => setReceiptForId(p.id)}><FileText size={15} /></IconButton>
                                <div className="row-more-anchor" data-row-menu>
                                  <IconButton label={`More actions for ${p.id}`} onClick={() => setMenu(menu === p.id ? null : p.id)} aria-expanded={menu === p.id}><MoreHorizontal size={17} /></IconButton>
                                  {menu === p.id && (
                                    <div className="row-menu">
                                      <button onClick={() => view(p.id)}><Eye size={14} />View details</button>
                                      <button onClick={() => { setReceiptForId(p.id); setMenu(null); }}><FileText size={14} />View receipt</button>
                                      <button onClick={() => { downloadReceiptFor(p.id); setMenu(null); }}><Download size={14} />Download receipt</button>
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
                                    <span>PAYMENT SUMMARY</span>
                                    <button className="text-link" onClick={() => view(p.id)}>View full payment</button>
                                  </div>
                                  <div className="expanded-grid">
                                    <section className="detail-section is-compact">
                                      <SectionTitle title="Allocation" />
                                      {r.lines.length ? (
                                        <dl className="lease-facts">
                                          {r.lines.map((l) => (
                                            <DataField key={l.allocation.id} label={`${l.invoice!.number} · ${periodLabel(l.invoice!.periodStart, l.invoice!.periodEnd)}`}>
                                              {fmtCAD(l.allocation.amount)} <span className="muted">· {balances.get(l.invoice!.id)?.outstanding ? `${fmtCAD(balances.get(l.invoice!.id)!.outstanding)} still owing` : "paid in full"}</span>
                                            </DataField>
                                          ))}
                                        </dl>
                                      ) : (
                                        <EmptyState compact title="Nothing allocated" description="The full amount is held as tenant credit." />
                                      )}
                                    </section>
                                    <section className="detail-section is-compact">
                                      <SectionTitle title="Payment information" />
                                      <dl className="lease-facts">
                                        <DataField label="Method">{METHOD_LABELS[p.method]}</DataField>
                                        <DataField label="Reference">{p.reference || "—"}</DataField>
                                        <DataField label="Recorded by">{r.recordedBy}</DataField>
                                        <DataField label="Notes">{p.notes || "—"}</DataField>
                                        {p.status === "reversed" && <DataField label="Reversal reason">{p.reversalReason || "—"}</DataField>}
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
                  title={loading ? "Loading payments..." : payments.length ? "No payments found" : "Your payment ledger starts here"}
                  description={loading ? "Fetching the payment ledger." : payments.length ? "Try a different search or adjust your filters." : "Record your first payment to start allocating rent."}
                  action={loading ? undefined : <Button onClick={payments.length ? reset : () => setFormOpen(true)}>{payments.length ? "Clear search & filters" : "New payment"}</Button>}
                />
              )}
              <div className="table-pagination">
                <p>Showing <strong>{filtered.length ? (safePage - 1) * pageSize + 1 : 0}-{Math.min(safePage * pageSize, filtered.length)}</strong> of <strong>{filtered.length}</strong> payments</p>
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

            <div className="u-root" style={{ marginTop: 18 }}>
              <AuditTrailPanel audits={audits} users={USERS} />
            </div>
            <div className="directory-footnote">
              <span><ShieldCheck size={13} />Balances are derived from invoices, allocations and credits, never stored.</span>
              <span>All amounts in CAD<span className="footnote-separator">&middot;</span>Demo data, nothing persists after a refresh</span>
            </div>
          </main>
        </div>
      </div>

      {formOpen && (
        <PaymentForm tenants={TENANTS} leases={LEASES} units={UNITS} properties={PROPERTIES} invoices={INVOICES} payments={payments} credits={credits} balances={balances} creditBalances={creditBalances} onCancel={() => setFormOpen(false)} onPost={handlePost} />
      )}
      {detailsPayment && (
        <PaymentDetails
          key={`${detailsPayment.id}-${detailsPayment.status}-${detailsPayment.refund?.at ?? ""}`}
          payment={detailsPayment}
          {...lookup(detailsPayment)}
          invoices={INVOICES}
          balances={balances}
          allocations={allocations}
          payments={payments}
          credits={credits}
          creditApplications={creditApplications}
          audits={audits}
          users={USERS}
          onClose={() => setDetailsId(null)}
          onViewReceipt={() => setReceiptForId(detailsPayment.id)}
          onPrintReceipt={() => printReceiptFor(detailsPayment.id)}
          onDownloadReceipt={() => downloadReceiptFor(detailsPayment.id)}
          onReverse={(reason) => handleReverse(detailsPayment.id, reason)}
          onRefund={(amountCents, reason) => handleRefund(detailsPayment.id, amountCents, reason)}
          onSelectPayment={setDetailsId}
        />
      )}
      {receiptPayment && (
        <ReceiptPreview
          key={receiptPayment.id}
          {...receiptArgsFor(receiptPayment)}
          onClose={() => setReceiptForId(null)}
          onPrint={() => printReceiptFor(receiptPayment.id)}
          onDownload={() => downloadReceiptFor(receiptPayment.id)}
        />
      )}
      <ToastStack toasts={toasts} onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))} />
    </div>
  );
}
