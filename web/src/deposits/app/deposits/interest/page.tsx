import Link from "../../../shim/link";
import { PageHeader, Card, Badge, Money, EmptyState, Callout, KpiCard, DefinitionList, StatusBadge } from "../../../components/ui";
import { loadDepositModule } from "../../../lib/deposits/service";
import { getCurrentUser } from "../../../lib/session";
import { can, depositTypeLabel } from "../../../lib/deposits/domain";
import { formatCurrency } from "../../../lib/money";
import { formatDate } from "../../../lib/dates";
import { AccrueInterestDialog, SettleInterestDialog } from "../../../components/deposit-actions";
import { db } from "../../../db";
import * as schema from "../../../db/schema";
import { eq } from "../../../db/ops";

export const dynamic = "force-dynamic";
export const metadata = { title: "Deposit interest" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function InterestPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const data = await loadDepositModule();
  const user = await getCurrentUser();
  const allowed = can(user.role, "process_interest");
  const dueOnly = params.filter === "due";
  const requestedId = typeof params.deposit === "string" ? params.deposit : "";

  const register = data.deposits
    .filter((row) => row.deposit.interestApplicable && row.deposit.status !== "cancelled")
    .filter((row) => (dueOnly ? row.interestOverdue || (row.interestPreview?.totalCents ?? 0) > 0 || row.balances.interestOutstandingCents > 0 : true))
    .sort((a, b) => (a.interestDueDate ?? "9999") < (b.interestDueDate ?? "9999") ? -1 : 1);

  const selected = data.deposits.find((d) => d.deposit.id === requestedId) ?? register[0] ?? null;
  const invoices = selected
    ? await db
        .select()
        .from(schema.rentInvoices)
        .where(eq(schema.rentInvoices.leaseId, selected.deposit.leaseId))
    : [];
  const openInvoices = invoices.filter((i) => i.status === "open");

  const totalOutstanding = register.reduce((a, d) => a + d.balances.interestOutstandingCents, 0);
  const totalUnposted = register.reduce((a, d) => a + (d.interestPreview?.totalCents ?? 0), 0);
  const overdueCount = register.filter((d) => d.interestOverdue).length;
  const accruedTotal = register.reduce((a, d) => a + d.balances.interestAccruedCents, 0);

  return (
    <div className="stack" style={{ gap: 14 }}>
      <PageHeader
        breadcrumb={[{ label: "Deposits", href: "/deposits" }, { label: "Interest" }]}
        title="Deposit interest"
        description="Interest obligations calculated from effective-dated statutory or policy rates. Calculations are previewed and approved before posting — opening this page never accrues interest automatically."
        meta={<><span>{register.length} interest-bearing deposits</span><span>·</span><span>{overdueCount} past their obligation date</span><span>·</span><span>Rates use actual/365 simple interest with half-up cent rounding</span></>}
        actions={
          <>
            <Link href="/deposits/interest?filter=due" className={`btn btn-sm ${dueOnly ? "btn-primary" : ""}`}>Due / pending only</Link>
            <Link href="/deposits/interest" className="btn btn-sm">All interest-bearing</Link>
            <Link href="/deposits/configuration#rates" className="btn btn-sm">Rate history</Link>
          </>
        }
      />

      <div className="kpi-grid">
        <KpiCard label="Posted interest outstanding" valueCents={totalOutstanding} hint="Interest accrued but not yet paid or credited" href="/deposits/interest" tone="warning" />
        <KpiCard label="Unposted accrual estimate" valueCents={totalUnposted} hint="Calculated from effective-dated rates — not yet posted" href="/deposits/interest" tone="accent" />
        <KpiCard label="Total interest accrued" valueCents={accruedTotal} hint="Lifetime posted interest accruals for interest-bearing deposits" href="/deposits/reports?report=interest" tone="info" />
        <KpiCard label="Overdue interest obligations" valueCents={0} count={overdueCount} isCount hint="Deposits whose interest obligation date has passed (record count)" href="/deposits/register?interestStatus=due" tone="danger" />
      </div>

      <Callout tone="info" title="How interest is calculated">
        Interest accrues on principal held (collected minus applied minus refunded), split into segments whenever the effective annual rate or the eligible principal changes.
        Each segment uses <span className="mono">principal × annual rate × days ÷ 365</span>, rounded half-up to the cent. Rates are effective-dated and never overwritten, so historical periods re-calculate with the rates that applied then.
      </Callout>

      <Card title="Interest register" subtitle="Rate, eligible principal, periods, paid and credited amounts, and outstanding obligations." padded={false}>
        {register.length === 0 ? (
          <EmptyState title="No interest-bearing deposits" description="Interest applies only where the configured jurisdiction and lease-type rule provides for it." />
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr><th>Deposit</th><th>Tenant / lease</th><th>Type</th><th>Rule</th><th className="num">Eligible principal</th><th>Accrual period</th><th className="num">Rate</th><th className="num">Posted accrued</th><th className="num">Paid / credited</th><th className="num">Outstanding</th><th className="num">Unposted</th><th>Due</th><th>Status</th></tr>
              </thead>
              <tbody>
                {register.map((row) => (
                  <tr key={row.deposit.id} className={selected?.deposit.id === row.deposit.id ? "selected" : ""}>
                    <td><Link href={`/deposits/interest?deposit=${row.deposit.id}`} className="strong">{row.deposit.reference}</Link><div className="small muted">{row.deposit.jurisdiction}</div></td>
                    <td>{row.tenant?.name}<div className="small muted">{row.lease?.reference}</div></td>
                    <td className="small">{depositTypeLabel(row.deposit.depositType)}</td>
                    <td className="small">{row.rule ? `${row.rule.interestFrequency} · ${row.rule.interestMethod}` : <Badge tone="danger">No rule</Badge>}</td>
                    <td className="num"><Money cents={row.interestPreview?.eligiblePrincipalCents ?? row.balances.principalOutstandingCents} /></td>
                    <td className="small">{row.lastAccrualEnd ? `${formatDate(row.lastAccrualEnd)} → ${formatDate(data.today)}` : `${formatDate(row.interestWindowStart)} → ${formatDate(data.today)}`}</td>
                    <td className="num">{((row.interestPreview?.blendedRateBps ?? 0) / 100).toFixed(2)}%</td>
                    <td className="num"><Money cents={row.balances.interestAccruedCents} /></td>
                    <td className="num"><Money cents={row.balances.interestPaidCents + row.balances.interestCreditedCents} /></td>
                    <td className="num"><Money cents={row.balances.interestOutstandingCents} tone={row.balances.interestOutstandingCents > 0 ? "negative" : "muted"} /></td>
                    <td className="num"><Money cents={row.interestPreview?.totalCents ?? 0} tone="muted" /></td>
                    <td className="small nowrap">{row.interestDueDate ? formatDate(row.interestDueDate) : "—"}{row.interestOverdue && <div><Badge tone="danger" dot>Past due</Badge></div>}</td>
                    <td><StatusBadge status={row.deposit.status} /></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={7}>Totals</td>
                  <td className="num">{formatCurrency(accruedTotal)}</td>
                  <td className="num">{formatCurrency(register.reduce((a, d) => a + d.balances.interestPaidCents + d.balances.interestCreditedCents, 0))}</td>
                  <td className="num">{formatCurrency(totalOutstanding)}</td>
                  <td className="num">{formatCurrency(totalUnposted)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>

      {selected && (
        <div className="grid-2">
          <Card title={`Calculation details — ${selected.deposit.reference}`} subtitle="Segments reflect rate changes and principal movements. Posted amounts are immutable.">
            <DefinitionList
              items={[
                { term: "Interest start", value: formatDate(selected.interestWindowStart) },
                { term: "Last posted period end", value: selected.lastAccrualEnd ? formatDate(selected.lastAccrualEnd) : "No accrual posted" },
                { term: "Next obligation date", value: selected.interestDueDate ? formatDate(selected.interestDueDate) : "—" },
                { term: "Method", value: "Simple, actual days / 365, no compounding, half-up cent rounding" },
                { term: "Eligible principal", value: <Money cents={selected.interestPreview?.eligiblePrincipalCents ?? 0} /> },
                { term: "Blended annual rate", value: `${((selected.interestPreview?.blendedRateBps ?? 0) / 100).toFixed(2)}%` },
                { term: "Calculated unposted interest", value: <Money cents={selected.interestPreview?.totalCents ?? 0} /> },
                { term: "Posted interest outstanding", value: <Money cents={selected.balances.interestOutstandingCents} /> },
              ]}
            />
            <div className="divider" />
            <div className="table-wrap" style={{ border: "1px solid var(--dp-line)", borderRadius: 10 }}>
              <table className="data">
                <thead><tr><th>Segment</th><th className="num">Days</th><th className="num">Principal</th><th className="num">Rate</th><th className="num">Interest</th></tr></thead>
                <tbody>
                  {(selected.interestPreview?.segments ?? []).length === 0 && <tr><td colSpan={5} className="muted">No eligible unposted interest for this deposit.</td></tr>}
                  {(selected.interestPreview?.segments ?? []).map((segment) => (
                    <tr key={`${segment.start}-${segment.annualRateBps}`}>
                      <td className="small">{formatDate(segment.start)} → {formatDate(segment.end)}</td>
                      <td className="num">{segment.days}</td>
                      <td className="num"><Money cents={segment.eligiblePrincipalCents} /></td>
                      <td className="num">{(segment.annualRateBps / 100).toFixed(2)}%</td>
                      <td className="num"><Money cents={segment.interestCents} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="btn-row" style={{ marginTop: 12 }}>
              <AccrueInterestDialog
                deposit={{ id: selected.deposit.id, reference: selected.deposit.reference }}
                periodStart={selected.interestWindowStart}
                periodEnd={data.today}
                calculatedCents={selected.interestPreview?.totalCents ?? 0}
                canPost={allowed && (selected.interestPreview?.totalCents ?? 0) > 0}
                blockedReason={!allowed ? "Your role cannot process interest." : (selected.interestPreview?.totalCents ?? 0) <= 0 ? "No unposted interest is available for this deposit." : null}
                segments={(selected.interestPreview?.segments ?? []).map((s) => ({ start: s.start, end: s.end, days: s.days, eligiblePrincipalCents: s.eligiblePrincipalCents, annualRateBps: s.annualRateBps, interestCents: s.interestCents }))}
              />
              {selected.balances.interestOutstandingCents > 0 && (
                <SettleInterestDialog
                  deposit={{ id: selected.deposit.id, reference: selected.deposit.reference }}
                  outstandingCents={selected.balances.interestOutstandingCents}
                  invoices={openInvoices.map((i) => ({ id: i.id, reference: i.reference, periodLabel: i.periodLabel, amountCents: i.amountCents }))}
                  canPost={allowed}
                />
              )}
              <Link href={`/deposits/${selected.deposit.id}`} className="btn btn-sm">Open deposit</Link>
            </div>
          </Card>

          <div className="stack" style={{ gap: 14 }}>
            <Card title="Interest postings" subtitle="Accruals, payments and credits for this deposit." padded={false}>
              {selected.txns.filter((t) => t.classification === "interest").length === 0 ? (
                <EmptyState title="No interest posted" description="Post an accrual after reviewing the calculation. No interest is posted automatically." />
              ) : (
                <div className="table-wrap">
                  <table className="data">
                    <thead><tr><th>Date</th><th>Type</th><th className="num">Amount</th><th>Period / rate</th><th>Journal</th></tr></thead>
                    <tbody>
                      {selected.txns.filter((t) => t.classification === "interest").map((txn) => (
                        <tr key={txn.id}>
                          <td className="small nowrap">{formatDate(txn.occurredAt)}</td>
                          <td className="small strong">{txn.txnType.replaceAll("_", " ")}</td>
                          <td className="num"><Money cents={txn.signedAmountCents} signed /></td>
                          <td className="small">{txn.periodStart ? `${formatDate(txn.periodStart)} → ${formatDate(txn.periodEnd)}` : "—"}{txn.rateBps ? <div className="muted">{(txn.rateBps / 100).toFixed(2)}% blended</div> : null}</td>
                          <td className="mono small">{txn.journalEntryId ?? <Badge tone="warning">Not posted</Badge>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
            <Card title="Rate history" subtitle="Effective-dated rates applied to this deposit's jurisdiction and type.">
              {selected.rates.length === 0 ? <p className="small muted" style={{ margin: 0 }}>No rate history configured.</p> : (
                <div className="table-wrap">
                  <table className="data">
                    <thead><tr><th>Effective from</th><th>Effective to</th><th className="num">Annual rate</th><th>Source</th></tr></thead>
                    <tbody>
                      {selected.rates.map((rate) => (
                        <tr key={rate.id}>
                          <td>{formatDate(rate.effectiveFrom)}</td>
                          <td>{rate.effectiveTo ? formatDate(rate.effectiveTo) : "Open"}</td>
                          <td className="num">{(rate.annualRateBps / 100).toFixed(2)}%</td>
                          <td className="small">{rate.source}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
