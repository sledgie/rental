import Link from "../../shim/link";
import { PageHeader, Card, KpiCard, DemoNote, Callout, StatusBadge, EmptyState, Money, Badge, FilterCard, GetForm } from "../../components/ui";
import { BarList, Donut, GroupedMonthlyChart } from "../../components/charts";
import { loadDepositModule, parseFilters, applyFilters, summariseDeposits, monthTotals, filtersToQuery } from "../../lib/deposits/service";
import { DEPOSIT_STATUSES, DEPOSIT_TYPE_LABELS, DEPOSIT_TYPES, JURISDICTIONS, LEASE_TYPES, depositTypeLabel, statusLabel } from "../../lib/deposits/domain";
import { lastMonths } from "../../lib/dates";
import { formatCurrency } from "../../lib/money";
import { getCurrentUser } from "../../lib/session";
import { can } from "../../lib/deposits/domain";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function DepositsDashboardPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const filters = parseFilters(params);
  const data = await loadDepositModule();
  const user = await getCurrentUser();
  const rows = applyFilters(data.deposits, filters, data.today);
  const { kpis, summary } = summariseDeposits(rows, data.today);

  const byType = DEPOSIT_TYPES.map((type) => ({
    label: DEPOSIT_TYPE_LABELS[type],
    value: rows.filter((r) => r.deposit.depositType === type && !["cancelled", "draft"].includes(r.deposit.status)).reduce((acc, r) => acc + r.balances.principalOutstandingCents + r.balances.interestOutstandingCents, 0),
  })).filter((r) => r.value > 0);

  const byProperty = data.lookups.properties
    .map((property) => ({
      label: `${property.name} (${property.jurisdiction})`,
      value: rows.filter((r) => r.deposit.propertyId === property.id && !["cancelled", "draft"].includes(r.deposit.status)).reduce((acc, r) => acc + r.balances.principalOutstandingCents + r.balances.interestOutstandingCents, 0),
    }))
    .filter((r) => r.value > 0);

  const lifecycle = DEPOSIT_STATUSES.map((status) => ({
    label: statusLabel(status),
    value: rows.filter((r) => r.deposit.status === status).reduce((acc, r) => acc + r.balances.principalOutstandingCents + r.balances.interestOutstandingCents, 0),
    count: rows.filter((r) => r.deposit.status === status).length,
  })).filter((r) => r.count > 0);

  const months = lastMonths(6, data.today);
  const totals = monthTotals(rows);
  const series = months.map((month) => totals.get(month.key) ?? { received: 0, applied: 0, refunded: 0, interest: 0 });

  const interestBuckets = new Map<string, number>();
  for (const row of rows) {
    if (!row.deposit.interestApplicable) continue;
    const amount = row.balances.interestOutstandingCents + (row.interestPreview?.totalCents ?? 0);
    if (amount <= 0) continue;
    const key = row.interestDueDate ? row.interestDueDate.slice(0, 7) : "No due date";
    interestBuckets.set(key, (interestBuckets.get(key) ?? 0) + amount);
  }

  const attention = rows
    .flatMap((row) =>
      row.issues
        .filter((issue) => issue.severity !== "info")
        .map((issue) => ({
          deposit: row,
          issue,
        })),
    )
    .sort((a, b) => (a.issue.severity === b.issue.severity ? 0 : a.issue.severity === "overdue" ? -1 : 1))
    .slice(0, 8);

  const reconOpen = data.reconciliations.filter((r) => r.status !== "resolved");
  const query = filtersToQuery({
    propertyId: filters.propertyId,
    depositType: filters.depositType,
    status: filters.status,
    jurisdiction: filters.jurisdiction,
    leaseType: filters.leaseType,
    expectedFrom: filters.expectedFrom,
    expectedTo: filters.expectedTo,
  });

  return (
    <div className="stack" style={{ gap: 16 }}>
      <PageHeader
        title="Deposits dashboard"
        description="Executive view of tenant deposit obligations, collections, refunds, interest and reconciliation exposure. Every figure drills down to the underlying register records."
        meta={
          <>
            <span>As of {data.today}</span>
            <span>·</span>
            <span>{summary.recordCount} deposit records</span>
            <span>·</span>
            <span>{rows.filter((r) => r.deposit.source === "seed").length} demo records</span>
            <span>·</span>
            <span>Signed in as {user.name} ({user.title})</span>
          </>
        }
        actions={
          <>
            <Link href={`/api/deposits/export?report=liability&${query}`} className="btn btn-sm">Export register (CSV)</Link>
            <Link href="/deposits/register" className="btn btn-sm">Open register</Link>
            {can(user.role, "create_deposit") && <Link href="/deposits/new" className="btn btn-primary btn-sm">Create deposit</Link>}
          </>
        }
      />

      <DemoNote />

      <FilterCard title="Dashboard filters" subtitle="All KPI cards, charts and attention lists respond to these filters.">
        <GetForm className="filter-bar">
          <label className="field">
            <span className="label">Property</span>
            <select className="select" name="propertyId" defaultValue={filters.propertyId}>
              <option value="">All properties</option>
              {data.lookups.properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <label className="field">
            <span className="label">Deposit type</span>
            <select className="select" name="depositType" defaultValue={filters.depositType}>
              <option value="">All types</option>
              {DEPOSIT_TYPES.map((type) => <option key={type} value={type}>{DEPOSIT_TYPE_LABELS[type]}</option>)}
            </select>
          </label>
          <label className="field">
            <span className="label">Jurisdiction</span>
            <select className="select" name="jurisdiction" defaultValue={filters.jurisdiction}>
              <option value="">All jurisdictions</option>
              {JURISDICTIONS.map((j) => <option key={j.code} value={j.code}>{j.label}</option>)}
            </select>
          </label>
          <label className="field">
            <span className="label">Lease type</span>
            <select className="select" name="leaseType" defaultValue={filters.leaseType}>
              <option value="">All lease types</option>
              {LEASE_TYPES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
            </select>
          </label>
          <label className="field">
            <span className="label">Status</span>
            <select className="select" name="status" defaultValue={filters.status}>
              <option value="">All statuses</option>
              {DEPOSIT_STATUSES.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}
            </select>
          </label>
          <label className="field">
            <span className="label">Expected from</span>
            <input className="input" type="date" name="expectedFrom" defaultValue={filters.expectedFrom} />
          </label>
          <div className="btn-row">
            <button type="submit" className="btn btn-primary">Apply filters</button>
            <Link href="/deposits" className="btn">Reset</Link>
          </div>
        </GetForm>
      </FilterCard>

      <div className="kpi-grid">
        {kpis.map(({ key, ...kpi }) => (
          <KpiCard key={key} {...kpi} />
        ))}
      </div>

      <div className="grid-2">
        <Card title="Monthly deposit activity" subtitle="Simulated collections, applications and refunds by month for the filtered population.">
          <GroupedMonthlyChart
            labels={months.map((m) => m.label)}
            series={[
              { name: "Collections", values: series.map((s) => s.received), color: "var(--accent)" },
              { name: "Applications", values: series.map((s) => s.applied), color: "var(--blue)" },
              { name: "Refunds", values: series.map((s) => s.refunded), color: "var(--warn)" },
            ]}
          />
        </Card>
        <Card title="Lifecycle distribution" subtitle="Deposit obligations by lifecycle status (amounts, not counts).">
          {lifecycle.length === 0 ? (
            <EmptyState title="No deposits match the filters" description="Adjust the filters or reset to view the whole portfolio." />
          ) : (
            <Donut
              data={lifecycle.map((l) => ({ label: `${l.label} (${l.count})`, value: l.value }))}
              centerLabel="Liability"
              centerValue={formatCurrency(summary.liabilityCents, { compact: true })}
            />
          )}
        </Card>
      </div>

      <div className="grid-3">
        <Card title="Deposit balances by type" subtitle="Principal + interest obligations">
          <BarList data={byType} />
        </Card>
        <Card title="Deposit balances by property" subtitle="Cross-property exposure">
          <BarList data={byProperty} />
        </Card>
        <Card title="Interest obligations by due period" subtitle="Posted outstanding plus unposted accrual estimates">
          {interestBuckets.size === 0 ? (
            <p className="muted small" style={{ margin: 0 }}>No interest obligations for the selected filters.</p>
          ) : (
            <BarList data={Array.from(interestBuckets.entries()).sort().map(([key, value]) => ({ label: key === "No due date" ? key : key, value }))} />
          )}
        </Card>
      </div>

      <div className="grid-2">
        <Card
          title="Attention required"
          subtitle="Deposits with overdue, partial, refund, interest, configuration or reconciliation issues."
          padded={false}
          actions={<Link href="/deposits/register?attention=1" className="btn btn-sm">View all in register</Link>}
        >
          {attention.length === 0 ? (
            <EmptyState title="Nothing requires attention" description="No overdue, partial or configuration exceptions for the selected filters." />
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Deposit / tenant</th>
                    <th>Property</th>
                    <th>Issue</th>
                    <th>Responsible</th>
                    <th>Due</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {attention.map(({ deposit, issue }) => (
                    <tr key={`${deposit.deposit.id}-${issue.label}`}>
                      <td>
                        <Link href={`/deposits/${deposit.deposit.id}`} className="strong">{deposit.deposit.reference}</Link>
                        <div className="small muted">{deposit.tenant?.name}</div>
                        <div className="small muted">{depositTypeLabel(deposit.deposit.depositType)}</div>
                      </td>
                      <td className="small">
                        {deposit.property?.name}
                        <div className="muted">{deposit.unit?.label}</div>
                      </td>
                      <td className="small" style={{ maxWidth: 260 }}>
                        <Badge tone={issue.severity === "overdue" ? "danger" : "warning"} dot>{issue.severity === "overdue" ? "Overdue" : "Pending"}</Badge>
                        <div style={{ marginTop: 3 }}>{issue.label}</div>
                      </td>
                      <td className="small">{deposit.responsible?.name ?? "Unassigned"}</td>
                      <td className="small nowrap">{deposit.deposit.expectedDate}<div className="muted">{statusLabel(deposit.deposit.status)}</div></td>
                      <td><Link href={issue.href} className="btn btn-sm">Open</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <div className="stack">
          <Card title="Reconciliation exceptions" subtitle="Differences are identified, never forced." padded={false}>
            {reconOpen.length === 0 ? (
              <EmptyState title="No open reconciliation differences" />
            ) : (
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr><th>Item</th><th>Deposit</th><th className="num">Difference</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    {reconOpen.slice(0, 5).map((item) => (
                      <tr key={item.id}>
                        <td><Link href={`/deposits/reconciliation?item=${item.id}`} className="strong">{item.reference}</Link><div className="small muted">{item.reason?.slice(0, 60)}…</div></td>
                        <td className="small">{item.depositReference}</td>
                        <td className="num"><Money cents={Math.abs(item.differenceCents)} /></td>
                        <td><Badge tone={item.status === "resolved" ? "success" : item.status === "correction_required" ? "danger" : "warning"}>{item.status.replaceAll("_", " ")}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card title="Quick access">
            <div className="grid-2-even" style={{ gap: 8 }}>
              <Link href="/deposits/collection" className="btn">Record a collection</Link>
              <Link href="/deposits/application" className="btn">Apply a deposit</Link>
              <Link href="/deposits/refunds" className="btn">Process refunds</Link>
              <Link href="/deposits/interest" className="btn">Interest register</Link>
              <Link href="/deposits/reports" className="btn">Deposit reports</Link>
              <Link href="/deposits/reconciliation" className="btn">Reconciliation</Link>
            </div>
            <div className="divider" />
            <p className="hint" style={{ margin: 0 }}>
              Amounts are shown in CAD. Record counts are shown separately from money amounts so the KPIs cannot be misread.
              {data.deposits.some((d) => !d.rule) ? " One or more deposits have no effective rule and require authorized configuration." : ""}
            </p>
          </Card>

          <Callout tone="warning" title="Jurisdiction enforcement is active">
            Prohibited Ontario residential categories (security/damage, pet and utility deposits) are blocked in the collection workflow. Seeded legacy records are flagged for review rather than treated as permitted.
          </Callout>
        </div>
      </div>
    </div>
  );
}

export const metadata = { title: "Deposits dashboard" };
