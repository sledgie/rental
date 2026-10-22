import Link from "../../../shim/link";
import { PageHeader, Card, Badge, Money, EmptyState, Callout, StatusBadge, DefinitionList } from "../../../components/ui";
import { loadDepositModule, parseFilters, applyFilters } from "../../../lib/deposits/service";
import { getCurrentUser } from "../../../lib/session";
import { can, depositTypeLabel } from "../../../lib/deposits/domain";
import { formatCurrency } from "../../../lib/money";
import { formatDate } from "../../../lib/dates";
import { RecordCollectionDialog } from "../../../components/deposit-actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Deposit collection" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function CollectionPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const filters = parseFilters(params);
  const data = await loadDepositModule();
  const user = await getCurrentUser();
  const allowed = can(user.role, "record_collection");
  const queue = applyFilters(data.deposits, { ...filters, attention: false }, data.today).filter(
    (row) => row.balances.uncollectedCents > 0 && !["cancelled", "closed", "transferred"].includes(row.deposit.status),
  );
  const requestedId = typeof params.deposit === "string" ? params.deposit : "";
  const selected = data.deposits.find((d) => d.deposit.id === requestedId) ?? queue[0] ?? null;
  const payments = selected
    ? data.unlinkedDepositPayments.filter((p) => p.tenantId === selected.deposit.tenantId && p.leaseId === selected.deposit.leaseId)
    : [];
  const overdue = queue.filter((row) => row.deposit.expectedDate < data.today);

  return (
    <div className="stack" style={{ gap: 14 }}>
      <PageHeader
        breadcrumb={[{ label: "Deposits", href: "/deposits" }, { label: "Collection" }]}
        title="Deposit collection"
        description="Record full or partial collections against expected deposits. Existing Payments records are linked rather than duplicated, and each collection posts exactly one journal entry."
        meta={
          <>
            <span>{queue.length} deposits awaiting collection</span>
            <span>·</span>
            <span>{formatCurrency(queue.reduce((a, d) => a + d.balances.uncollectedCents, 0))} outstanding expected</span>
            <span>·</span>
            <span>{overdue.length} past the expected date</span>
          </>
        }
        actions={<Link href="/deposits/register?status=expected" className="btn btn-sm">Open register</Link>}
      />

      {!allowed && <Callout tone="danger" title="Permission required">Your role cannot record collections. Switch to a role with the record-collection permission.</Callout>}
      {overdue.length > 0 && (
        <Callout tone="warning" title={`${overdue.length} deposit collection(s) past the expected date`}>
          Follow up with the tenant or document an authorized cancellation. Cancelling does not erase any collection already recorded.
        </Callout>
      )}

      <Card title="Collection queue" subtitle="Expected and partially received deposits across all properties." padded={false}>
        {queue.length === 0 ? (
          <EmptyState title="Nothing awaiting collection" description="All expected deposits have been fully received or cancelled." action={<Link href="/deposits/new" className="btn">Create a deposit</Link>} />
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr><th>Deposit</th><th>Tenant / lease</th><th>Property</th><th>Type</th><th>Expected</th><th className="num">Required</th><th className="num">Collected</th><th className="num">Remaining</th><th>Status</th><th>Action</th></tr>
              </thead>
              <tbody>
                {queue.map((row) => (
                  <tr key={row.deposit.id} className={selected?.deposit.id === row.deposit.id ? "selected" : ""}>
                    <td><Link href={`/deposits/collection?deposit=${row.deposit.id}`} className="strong">{row.deposit.reference}</Link></td>
                    <td>{row.tenant?.name}<div className="small muted">{row.lease?.reference}</div></td>
                    <td>{row.property?.name}<div className="small muted">Unit {row.unit?.label}</div></td>
                    <td className="small">{depositTypeLabel(row.deposit.depositType)}</td>
                    <td className={`nowrap ${row.deposit.expectedDate < data.today ? "strong" : ""}`} style={row.deposit.expectedDate < data.today ? { color: "var(--dp-danger)" } : undefined}>{formatDate(row.deposit.expectedDate)}</td>
                    <td className="num"><Money cents={row.deposit.requiredAmountCents} /></td>
                    <td className="num"><Money cents={row.balances.receivedCents} /></td>
                    <td className="num"><Money cents={row.balances.uncollectedCents} tone="negative" /></td>
                    <td><StatusBadge status={row.deposit.status} /></td>
                    <td><Link href={`/deposits/collection?deposit=${row.deposit.id}`} className="btn btn-sm">Select</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {selected && (
        <div className="grid-2">
          <Card title={`Collect against ${selected.deposit.reference}`} subtitle={`${depositTypeLabel(selected.deposit.depositType)} · ${selected.tenant?.name}`}>
            <DefinitionList
              items={[
                { term: "Required amount", value: <Money cents={selected.deposit.requiredAmountCents} /> },
                { term: "Collected to date", value: <Money cents={selected.balances.receivedCents} /> },
                { term: "Remaining expected", value: <Money cents={selected.balances.uncollectedCents} /> },
                { term: "Expected date", value: formatDate(selected.deposit.expectedDate) },
                { term: "Applicable rule", value: selected.rule ? selected.rule.legalReference : <Badge tone="danger">No rule configured — collection blocked</Badge> },
                { term: "Permitted maximum", value: selected.maxCents != null ? formatCurrency(selected.maxCents) : "No fixed maximum (documented basis required)" },
                { term: "Accounting", value: `Debit ${selected.deposit.cashAccountCode} / Credit ${selected.deposit.liabilityAccountCode}` },
                { term: "Liability account", value: data.lookups.accounts.find((a) => a.code === selected.deposit.liabilityAccountCode)?.name ?? "Unmapped" },
              ]}
            />
            <div className="divider" />
            <div className="btn-row">
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
                canRecord={allowed}
              />
              <Link href={`/deposits/${selected.deposit.id}`} className="btn btn-sm">Full details</Link>
            </div>
            <p className="hint" style={{ marginBottom: 0 }}>
              Partial collections keep the remaining amount expected and update the record to Partially received. A collection cannot exceed the permitted maximum for the applicable rule.
            </p>
          </Card>

          <Card title="Unlinked Payments records" subtitle="Deposit-type payments from the Payments module that are not yet linked to a deposit ledger entry." padded={false}>
            {payments.length === 0 ? (
              <EmptyState title="No unlinked deposit payments" description="The collection workflow will create a simulated payment record and link it automatically." />
            ) : (
              <div className="table-wrap">
                <table className="data">
                  <thead><tr><th>Payment</th><th>Date</th><th>Method</th><th className="num">Amount</th></tr></thead>
                  <tbody>
                    {payments.map((payment) => (
                      <tr key={payment.id}>
                        <td className="mono small">{payment.reference}</td>
                        <td>{formatDate(payment.receivedAt)}</td>
                        <td className="small">{payment.method}</td>
                        <td className="num"><Money cents={payment.amountCents} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="card-body">
              <Callout tone="info" title="No duplicate payments">
                Linking an existing payment requires the amounts to match exactly. A payment can only fund one deposit ledger entry — the database enforces uniqueness on the payment link.
              </Callout>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
