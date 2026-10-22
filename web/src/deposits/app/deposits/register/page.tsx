import Link from "../../../shim/link";
import { PageHeader, Card, StatusBadge, Badge, Money, EmptyState, Callout, Progress, FilterCard, GetForm } from "../../../components/ui";
import {
  loadDepositModule,
  parseFilters,
  applyFilters,
  sortDeposits,
  paginate,
  filtersToQuery,
  getOpenInvoices,
} from "../../../lib/deposits/service";
import { DEPOSIT_STATUSES, DEPOSIT_TYPE_LABELS, DEPOSIT_TYPES, JURISDICTIONS, LEASE_TYPES, depositTypeLabel, statusLabel } from "../../../lib/deposits/domain";
import { formatCurrency } from "../../../lib/money";
import { formatDate, formatDateTime } from "../../../lib/dates";
import { getCurrentUser } from "../../../lib/session";
import { can } from "../../../lib/deposits/domain";
import {
  ApplicationDialog,
  EditDraftDialog,
  ReconcileDepositDialog,
  RecordCollectionDialog,
  RefundRequestDialog,
} from "../../../components/deposit-actions";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const PAGE_SIZE = 9;

const SORTS: { key: string; label: string; align?: "num" }[] = [
  { key: "reference", label: "Deposit ref" },
  { key: "tenant", label: "Tenant" },
  { key: "property", label: "Property · unit" },
  { key: "type", label: "Type" },
  { key: "expected", label: "Expected", align: "num" },
  { key: "received", label: "Received", align: "num" },
  { key: "required", label: "Required", align: "num" },
  { key: "collected", label: "Collected", align: "num" },
  { key: "applied", label: "Applied", align: "num" },
  { key: "refunded", label: "Refunded", align: "num" },
  { key: "outstanding", label: "Outstanding", align: "num" },
  { key: "status", label: "Status" },
  { key: "updated", label: "Updated", align: "num" },
];

export default async function DepositRegisterPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const filters = parseFilters(params);
  const data = await loadDepositModule();
  const user = await getCurrentUser();
  const filtered = sortDeposits(applyFilters(data.deposits, filters, data.today), filters.sort, filters.dir);
  const page = paginate(filtered, filters.page, PAGE_SIZE);
  const selectedId = typeof params.selected === "string" ? params.selected : "";
  const selected = data.deposits.find((d) => d.deposit.id === selectedId) ?? page.rows[0] ?? null;
  const invoices = selected ? await getOpenInvoices(selected.deposit.leaseId) : [];

  const baseQuery = filtersToQuery({ ...filters, page: page.page });
  const linkFor = (overrides: Record<string, string | number | boolean | undefined>) => {
    const query = filtersToQuery({ ...filters, page: page.page, ...overrides });
    return `/deposits/register${query ? `?${query}` : ""}`;
  };
  const sortLink = (key: string) => {
    const dir = filters.sort === key && filters.dir === "desc" ? "asc" : "desc";
    const query = filtersToQuery({ ...filters, sort: key, dir, page: 1, selected: selected?.deposit.id });
    return `/deposits/register${query ? `?${query}` : ""}`;
  };

  const totalOutstanding = filtered.reduce((acc, d) => acc + d.balances.totalRemainingCents, 0);
  const payments = data.unlinkedDepositPayments.filter((p) => p.tenantId === selected?.deposit.tenantId).slice(0, 6);
  const canRecord = can(user.role, "record_collection");
  const canApply = can(user.role, "apply_deposit");
  const canRefund = can(user.role, "request_refund");
  const canReconcile = can(user.role, "reconcile_deposits");
  const canEditDraft = can(user.role, "edit_draft");

  return (
    <div className="stack" style={{ gap: 14 }}>
      <PageHeader
        title="Deposit register"
        description="The primary working screen for every tenant deposit. Select a record to review balances, obligations and permitted actions without leaving the register."
        meta={
          <>
            <span>{filtered.length} records after filters</span>
            <span>·</span>
            <span>Outstanding obligation {formatCurrency(totalOutstanding)}</span>
            <span>·</span>
            <span>Signed in as {user.name}</span>
          </>
        }
        actions={
          <>
            <Link href={`/api/deposits/export?report=liability&${baseQuery}`} className="btn btn-sm">Export register (CSV)</Link>
            <Link href="/deposits/register?attention=1" className="btn btn-sm">Attention only</Link>
            {can(user.role, "create_deposit") && <Link href="/deposits/new" className="btn btn-primary btn-sm">Create deposit</Link>}
          </>
        }
      />

      <FilterCard title="Filters" subtitle="Search, column filters, date ranges and balance/reconciliation criteria. Filters are preserved when opening a detail record.">
        <GetForm className="filter-bar">
          <label className="field" style={{ gridColumn: "span 2" }}>
            <span className="label">Search</span>
            <input className="input" name="q" defaultValue={filters.q} placeholder="Deposit ref, tenant, property, unit, lease or notes" />
          </label>
          <label className="field">
            <span className="label">Tenant</span>
            <select className="select" name="tenantId" defaultValue={filters.tenantId}>
              <option value="">All tenants</option>
              {data.lookups.tenants.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </label>
          <label className="field">
            <span className="label">Property</span>
            <select className="select" name="propertyId" defaultValue={filters.propertyId}>
              <option value="">All properties</option>
              {data.lookups.properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <label className="field">
            <span className="label">Unit</span>
            <select className="select" name="unitId" defaultValue={filters.unitId}>
              <option value="">All units</option>
              {data.lookups.units.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
            </select>
          </label>
          <label className="field">
            <span className="label">Lease</span>
            <select className="select" name="leaseId" defaultValue={filters.leaseId}>
              <option value="">All leases</option>
              {data.lookups.leases.map((l) => <option key={l.id} value={l.id}>{l.reference}</option>)}
            </select>
          </label>
          <label className="field">
            <span className="label">Deposit type</span>
            <select className="select" name="depositType" defaultValue={filters.depositType}>
              <option value="">All types</option>
              {DEPOSIT_TYPES.map((t) => <option key={t} value={t}>{DEPOSIT_TYPE_LABELS[t]}</option>)}
            </select>
          </label>
          <label className="field">
            <span className="label">Status</span>
            <select className="select" name="status" defaultValue={filters.status}>
              <option value="">All statuses</option>
              {DEPOSIT_STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
            </select>
          </label>
          <label className="field">
            <span className="label">Jurisdiction</span>
            <select className="select" name="jurisdiction" defaultValue={filters.jurisdiction}>
              <option value="">All</option>
              {JURISDICTIONS.map((j) => <option key={j.code} value={j.code}>{j.code}</option>)}
            </select>
          </label>
          <label className="field">
            <span className="label">Lease type</span>
            <select className="select" name="leaseType" defaultValue={filters.leaseType}>
              <option value="">All</option>
              {LEASE_TYPES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
            </select>
          </label>
          <label className="field">
            <span className="label">Expected from</span>
            <input className="input" type="date" name="expectedFrom" defaultValue={filters.expectedFrom} />
          </label>
          <label className="field">
            <span className="label">Expected to</span>
            <input className="input" type="date" name="expectedTo" defaultValue={filters.expectedTo} />
          </label>
          <label className="field">
            <span className="label">Received from</span>
            <input className="input" type="date" name="receivedFrom" defaultValue={filters.receivedFrom} />
          </label>
          <label className="field">
            <span className="label">Outstanding balance</span>
            <select className="select" name="balance" defaultValue={filters.balance}>
              <option value="">Any balance</option>
              <option value="outstanding">Outstanding &gt; 0</option>
              <option value="zero">Fully settled</option>
            </select>
          </label>
          <label className="field">
            <span className="label">Interest status</span>
            <select className="select" name="interestStatus" defaultValue={filters.interestStatus}>
              <option value="">Any interest status</option>
              <option value="due">Past due</option>
              <option value="outstanding">Outstanding posted interest</option>
              <option value="none">No interest obligation</option>
            </select>
          </label>
          <label className="field">
            <span className="label">Reconciliation</span>
            <select className="select" name="reconStatus" defaultValue={filters.reconStatus}>
              <option value="">Any reconciliation status</option>
              <option value="exception">Exception</option>
              <option value="not_reviewed">Not reviewed</option>
              <option value="reconciled">Reconciled</option>
            </select>
          </label>
          <div className="btn-row">
            <button type="submit" className="btn btn-primary">Apply filters</button>
            <Link href="/deposits/register" className="btn">Reset filters</Link>
          </div>
        </GetForm>
      </FilterCard>

      <div className="master-detail">
        <Card
          title={`Deposit records (${filtered.length})`}
          subtitle={`Page ${page.page} of ${page.pages} · sorted by ${filters.sort} ${filters.dir}`}
          padded={false}
          actions={<span className="small muted">Total outstanding {formatCurrency(totalOutstanding)}</span>}
        >
          {filtered.length === 0 ? (
            <EmptyState
              title="No deposits match these filters"
              description="Broaden the filters or reset to see the full register. Nothing has been hidden by a posting or status change."
              action={<Link href="/deposits/register" className="btn">Reset filters</Link>}
            />
          ) : (
            <>
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      {SORTS.map((sort) => (
                        <th key={sort.key} className={sort.align === "num" ? "num" : ""}>
                          <Link href={sortLink(sort.key)} title={`Sort by ${sort.label}`}>
                            {sort.label}
                            {filters.sort === sort.key ? <span aria-hidden> {filters.dir === "asc" ? "▲" : "▼"}</span> : null}
                          </Link>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {page.rows.map((row) => (
                      <tr key={row.deposit.id} className={selected?.deposit.id === row.deposit.id ? "selected" : ""}>
                        <td>
                          <Link href={linkFor({ selected: row.deposit.id })} className="strong">{row.deposit.reference}</Link>
                          <div className="small muted">{row.deposit.source === "seed" ? "Demo record" : "Captured in app"}</div>
                        </td>
                        <td>{row.tenant?.name}<div className="small muted">{row.deposit.jurisdiction} {row.deposit.leaseType}</div></td>
                        <td>{row.property?.name}<div className="small muted">{row.property?.building} · Unit {row.unit?.label}</div></td>
                        <td className="small">{depositTypeLabel(row.deposit.depositType)}</td>
                        <td className="num">{formatDate(row.deposit.expectedDate)}</td>
                        <td className="num">{row.deposit.firstReceivedDate ? formatDate(row.deposit.firstReceivedDate) : "—"}</td>
                        <td className="num"><Money cents={row.deposit.requiredAmountCents} /></td>
                        <td className="num"><Money cents={row.balances.receivedCents} /></td>
                        <td className="num">
                          <Money cents={row.balances.appliedCents} />
                          {row.balances.interestOutstandingCents !== 0 && <div className="small muted">int. <Money cents={row.balances.interestOutstandingCents} /></div>}
                        </td>
                        <td className="num"><Money cents={row.balances.refundedCents} /></td>
                        <td className="num"><Money cents={row.balances.totalRemainingCents} tone={row.balances.totalRemainingCents > 0 ? "negative" : "muted"} /></td>
                        <td>
                          <StatusBadge status={row.deposit.status} />
                          {row.issues.some((i) => i.severity === "overdue") && <div style={{ marginTop: 3 }}><Badge tone="danger" dot>Overdue action</Badge></div>}
                        </td>
                        <td className="small nowrap">{formatDateTime(row.deposit.updatedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={6}>Filtered totals</td>
                      <td className="num">{formatCurrency(filtered.reduce((a, d) => a + d.deposit.requiredAmountCents, 0))}</td>
                      <td className="num">{formatCurrency(filtered.reduce((a, d) => a + d.balances.receivedCents, 0))}</td>
                      <td className="num">{formatCurrency(filtered.reduce((a, d) => a + d.balances.appliedCents, 0))}</td>
                      <td className="num">{formatCurrency(filtered.reduce((a, d) => a + d.balances.refundedCents, 0))}</td>
                      <td className="num">{formatCurrency(totalOutstanding)}</td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              </div>
              <div className="between" style={{ padding: "10px 14px", borderTop: "1px solid var(--dp-line)" }}>
                <span className="small muted">
                  Showing {(page.page - 1) * PAGE_SIZE + 1}–{Math.min(page.page * PAGE_SIZE, filtered.length)} of {filtered.length}
                </span>
                <div className="pagination">
                  <Link href={linkFor({ page: Math.max(1, page.page - 1) })} className={`btn btn-sm ${page.page === 1 ? "disabled" : ""}`} aria-disabled={page.page === 1}>Previous</Link>
                  {Array.from({ length: page.pages }, (_, i) => i + 1).slice(0, 8).map((p) => (
                    <Link key={p} href={linkFor({ page: p })} className={`btn btn-sm ${p === page.page ? "btn-primary" : ""}`}>{p}</Link>
                  ))}
                  <Link href={linkFor({ page: Math.min(page.pages, page.page + 1) })} className="btn btn-sm" aria-disabled={page.page === page.pages}>Next</Link>
                </div>
              </div>
            </>
          )}
        </Card>

        <div className="detail-panel stack" style={{ gap: 12 }}>
          {!selected ? (
            <Card title="Select a deposit"><EmptyState title="No record selected" description="Choose a deposit from the register to review its balances and permitted actions." /></Card>
          ) : (
            <>
              <Card
                title={selected.deposit.reference}
                subtitle={`${depositTypeLabel(selected.deposit.depositType)} · ${selected.tenant?.name ?? "No tenant"}`}
                actions={<StatusBadge status={selected.deposit.status} />}
              >
                <div className="stack" style={{ gap: 10 }}>
                  <div className="grid-2-even" style={{ gap: 10 }}>
                    <div>
                      <div className="small muted">Property · unit</div>
                      <div className="strong">{selected.property?.name}</div>
                      <div className="small muted">{selected.property?.building} · Unit {selected.unit?.label}</div>
                    </div>
                    <div>
                      <div className="small muted">Lease</div>
                      <div className="strong">{selected.lease?.reference}</div>
                      <div className="small muted">{formatDate(selected.lease?.startDate)} → {formatDate(selected.lease?.endDate)}</div>
                    </div>
                  </div>
                  <div>
                    <div className="between small"><span className="muted">Principal collected</span><Money cents={selected.balances.receivedCents} /></div>
                    <Progress value={selected.balances.receivedCents} total={selected.deposit.requiredAmountCents} />
                    <div className="small muted" style={{ marginTop: 3 }}>
                      {formatCurrency(selected.balances.receivedCents)} of {formatCurrency(selected.deposit.requiredAmountCents)} required
                    </div>
                  </div>
                  <div className="grid-2-even" style={{ gap: 8 }}>
                    <div><div className="small muted">Principal held</div><Money cents={selected.balances.principalOutstandingCents} /></div>
                    <div><div className="small muted">Interest outstanding</div><Money cents={selected.balances.interestOutstandingCents} /></div>
                    <div><div className="small muted">Applied</div><Money cents={selected.balances.appliedCents} /></div>
                    <div><div className="small muted">Refunded</div><Money cents={selected.balances.refundedCents} /></div>
                    <div><div className="small muted">Unposted interest</div><Money cents={selected.interestPreview?.totalCents ?? 0} /></div>
                    <div><div className="small muted">Total obligation</div><Money cents={selected.balances.totalRemainingCents} /></div>
                  </div>

                  {selected.issues.length > 0 && (
                    <div className="stack" style={{ gap: 6 }}>
                      {selected.issues.slice(0, 3).map((issue) => (
                        <Callout key={issue.label} tone={issue.severity === "overdue" ? "danger" : issue.severity === "warning" ? "warning" : "info"}>
                          {issue.label}
                        </Callout>
                      ))}
                    </div>
                  )}

                  <div className="btn-row no-print">
                    <RecordCollectionDialog
                      deposit={{
                        id: selected.deposit.id,
                        reference: selected.deposit.reference,
                        tenantName: selected.tenant?.name ?? "",
                        uncollectedCents: selected.balances.uncollectedCents,
                        receivedCents: selected.balances.receivedCents,
                        requiredCents: selected.deposit.requiredAmountCents,
                        cashAccount: selected.deposit.cashAccountCode,
                        liabilityAccount: selected.deposit.liabilityAccountCode,
                        expectedDate: selected.deposit.expectedDate,
                        status: selected.deposit.status,
                      }}
                      payments={payments.map((p) => ({ id: p.id, reference: p.reference, amountCents: p.amountCents, receivedAt: p.receivedAt, method: p.method }))}
                      canRecord={canRecord}
                    />
                    <ApplicationDialog
                      deposit={{
                        id: selected.deposit.id,
                        reference: selected.deposit.reference,
                        tenantName: selected.tenant?.name ?? "",
                        depositType: selected.deposit.depositType,
                        outstandingCents: selected.balances.principalOutstandingCents,
                        oneMonthRentCents: selected.lease?.monthlyRentCents ?? selected.balances.principalOutstandingCents,
                        receivableAccount: selected.deposit.receivableAccountCode ?? "1200",
                        liabilityAccount: selected.deposit.liabilityAccountCode,
                        status: selected.deposit.status,
                      }}
                      purposes={selected.rule?.applicationPurposes ?? []}
                      invoices={invoices.map((i) => ({ id: i.id, reference: i.reference, periodLabel: i.periodLabel, amountCents: i.amountCents, status: i.status }))}
                      canApply={canApply}
                      approvalRequired={Boolean(selected.rule?.approvalRequired)}
                    />
                    <RefundRequestDialog
                      deposit={{ id: selected.deposit.id, reference: selected.deposit.reference, tenantName: selected.tenant?.name ?? "", status: selected.deposit.status }}
                      maxPrincipalCents={selected.refundablePrincipalCents}
                      maxInterestCents={selected.balances.interestOutstandingCents}
                      canRequest={canRefund}
                      blockedReason={selected.refundBlockReason}
                      devicesSummary={selected.devices.length ? `${selected.devices.length} device record(s) — ${selected.devices.reduce((a, d) => a + Math.max(0, d.quantityIssued - d.quantityReturned), 0)} outstanding. Refundable balance recalculated against documented replacement cost.` : undefined}
                    />
                    <ReconcileDepositDialog deposit={{ id: selected.deposit.id, reference: selected.deposit.reference, current: selected.deposit.reconciliationStatus }} canReconcile={canReconcile} />
                    <EditDraftDialog
                      deposit={{ id: selected.deposit.id, reference: selected.deposit.reference, requiredCents: selected.deposit.requiredAmountCents, expectedDate: selected.deposit.expectedDate, liabilityAccount: selected.deposit.liabilityAccountCode, cashAccount: selected.deposit.cashAccountCode }}
                      accounts={data.lookups.accounts}
                      canEdit={canEditDraft && ["draft", "expected"].includes(selected.deposit.status)}
                    />
                  </div>

                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <Link href={`/deposits/${selected.deposit.id}?from=${encodeURIComponent(baseQuery)}`} className="btn btn-sm btn-primary">Open full details</Link>
                    <Link href={`/deposits/${selected.deposit.id}?from=${encodeURIComponent(baseQuery)}#history`} className="btn btn-sm">Transaction history</Link>
                  </div>
                </div>
              </Card>
              <Card title="Recent ledger activity">
                {selected.txns.length === 0 ? (
                  <EmptyState title="No transactions yet" description="This deposit has no finalized activity. Recording a collection creates the first ledger entry." />
                ) : (
                  <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 9 }}>
                    {selected.txns.slice(-4).reverse().map((txn) => (
                      <li key={txn.id} className="between" style={{ fontSize: 12 }}>
                        <span>
                          <span className="strong">{txn.txnType.replaceAll("_", " ")}</span>
                          <div className="small muted">{formatDate(txn.occurredAt)} · {txn.reference}</div>
                        </span>
                        <Money cents={txn.signedAmountCents} signed />
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export const metadata = { title: "Deposit register" };
