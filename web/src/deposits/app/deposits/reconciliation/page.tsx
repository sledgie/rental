import Link from "../../../shim/link";
import { PageHeader, Card, Badge, Money, EmptyState, Callout, KpiCard, DefinitionList } from "../../../components/ui";
import { loadDepositModule } from "../../../lib/deposits/service";
import { getCurrentUser } from "../../../lib/session";
import { RECONCILIATION_STATUS_LABELS, can } from "../../../lib/deposits/domain";
import { formatCurrency } from "../../../lib/money";
import { formatDate } from "../../../lib/dates";
import { ReconItemDialog, ReconcileDepositDialog } from "../../../components/deposit-actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Deposit reconciliation" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ReconciliationPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const data = await loadDepositModule();
  const user = await getCurrentUser();
  const canReconcile = can(user.role, "reconcile_deposits");
  const statusFilter = typeof params.status === "string" ? params.status : "";
  const depositFilter = typeof params.deposit === "string" ? params.deposit : "";

  const active = data.deposits.filter((d) => !["cancelled", "draft"].includes(d.deposit.status));
  const subledger = active.reduce((a, d) => a + d.balances.totalRemainingCents, 0);
  const interestLiability = active.reduce((a, d) => a + d.balances.interestOutstandingCents, 0);
  const principalSubledger = subledger - interestLiability;
  const liabilityAccounts = ["2200", "2210", "2220", "2230", "2240", "2310"];
  const glRows = data.glByAccount.filter((a) => liabilityAccounts.includes(a.code));
  const glLiability = glRows.reduce((a, r) => a + r.balanceCents, 0);
  const glPrincipal = glRows.filter((r) => r.code !== "2310").reduce((a, r) => a + r.balanceCents, 0);
  const glInterest = glRows.filter((r) => r.code === "2310").reduce((a, r) => a + r.balanceCents, 0);
  const bankLines = data.glByAccount.filter((a) => ["1010", "1020"].includes(a.code));
  const bankBalance = data.bankOpeningCents - bankLines.reduce((a, r) => a + r.balanceCents, 0);

  const unpostedTxns = data.deposits.flatMap((d) =>
    d.txns.filter((t) => t.classification !== "none" && !t.journalEntryId).map((t) => ({ deposit: d, txn: t })),
  );
  const outstandingRefunds = data.refunds.filter((r) => ["requested", "approved"].includes(r.status));
  const openRefundCents = outstandingRefunds.reduce((a, r) => a + (r.approvedPrincipalCents ?? r.requestedPrincipalCents) + (r.approvedInterestCents ?? r.requestedInterestCents), 0);
  const items = data.reconciliations
    .filter((item) => (statusFilter ? item.status === statusFilter : true))
    .filter((item) => (depositFilter ? item.depositId === depositFilter : true));
  const unresolved = data.reconciliations.filter((r) => r.status !== "resolved");
  const unresolvedDifference = unresolved.reduce((a, r) => a + Math.abs(r.differenceCents), 0);
  const subledgerVariance = subledger - glLiability;
  const depositVariances = active.filter((d) => d.glVarianceCents !== 0 || d.deposit.reconciliationStatus === "exception");

  return (
    <div className="stack" style={{ gap: 14 }}>
      <PageHeader
        breadcrumb={[{ label: "Deposits", href: "/deposits" }, { label: "Reconciliation" }]}
        title="Deposit reconciliation"
        description="Compare the deposit subledger, general ledger liability accounts and bank/trust balances. Differences are identified and explained — never forced to match automatically."
        meta={<><span>{unresolved.length} open discrepancies</span><span>·</span><span>{unpostedTxns.length} ledger events without a journal</span><span>·</span><span>Reviewer: {user.name}</span></>}
        actions={<><Link href="/deposits/reports?report=reconciliation" className="btn btn-sm">Reconciliation report</Link><Link href="/deposits/register?reconStatus=exception" className="btn btn-sm">Deposits in exception</Link></>}
      />

      <div className="kpi-grid">
        <KpiCard label="Deposit subledger balance" valueCents={subledger} hint={`${formatCurrency(principalSubledger)} principal + ${formatCurrency(interestLiability)} interest`} href="/deposits/register?balance=outstanding" tone="accent" />
        <KpiCard label="GL liability balance" valueCents={glLiability} hint="2200–2240 deposit liabilities plus 2310 interest payable" href="/records/accounts" tone="info" />
        <KpiCard label="Bank / trust deposit balance" valueCents={bankBalance} hint="Opening demo balance plus deposit-related cash movements" href="/records/payments" tone="neutral" />
        <KpiCard label="Unresolved differences" valueCents={unresolvedDifference} count={unresolved.length} hint="Absolute difference across open reconciliation items" href="/deposits/reconciliation?status=open" tone="danger" />
        <KpiCard label="Outstanding refunds" valueCents={openRefundCents} count={outstandingRefunds.length} hint="Requested or approved refunds not yet paid" href="/deposits/refunds" tone="warning" />
        <KpiCard label="Unposted transactions" valueCents={0} count={unpostedTxns.length} isCount hint="Ledger events with no accounting entry (record count)" href="/deposits/reconciliation" tone="warning" />
      </div>

      <div className="grid-2">
        <Card title="Reconciliation logic" subtitle="How each balance is derived and why legitimate differences exist.">
          <DefinitionList
            items={[
              { term: "Subledger", value: "Sum of the deposit transaction ledger: principal held plus posted interest outstanding for active deposits." },
              { term: "General ledger", value: "Credits less debits on deposit liability accounts (2200–2240) and tenant deposit interest payable (2310)." },
              { term: "Bank / trust", value: "Opening demo trust balance plus all deposit-related cash postings. A bank balance is not a deposit liability." },
              { term: "Unmatched items", value: "Collections with no journal, refunds approved but unpaid, and manual accruals requiring correction." },
            ]}
          />
          <div className="divider" />
          <div className="grid-2-even" style={{ gap: 12 }}>
            <div><div className="small muted">Principal: subledger vs GL</div><Money cents={principalSubledger - glPrincipal} tone={principalSubledger === glPrincipal ? "positive" : "negative"} /><div className="hint">{formatCurrency(principalSubledger)} vs {formatCurrency(glPrincipal)}</div></div>
            <div><div className="small muted">Interest: subledger vs GL</div><Money cents={interestLiability - glInterest} tone={interestLiability === glInterest ? "positive" : "negative"} /><div className="hint">{formatCurrency(interestLiability)} vs {formatCurrency(glInterest)}</div></div>
            <div><div className="small muted">Total subledger variance</div><Money cents={subledgerVariance} tone={subledgerVariance === 0 ? "positive" : "negative"} /></div>
            <div><div className="small muted">Open refund liability (timing)</div><Money cents={openRefundCents} /><div className="hint">Included in the subledger and GL, excluded from cash</div></div>
          </div>
        </Card>

        <Card title="Accounting control accounts" subtitle="Liability control balances from posted journal entries." padded={false}>
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>Account</th><th>Name</th><th className="num">Debits</th><th className="num">Credits</th><th className="num">Balance</th></tr></thead>
              <tbody>
                {glRows.map((row) => (
                  <tr key={row.code}>
                    <td className="mono strong">{row.code}</td>
                    <td className="small">{row.name}</td>
                    <td className="num"><Money cents={row.debitCents} /></td>
                    <td className="num"><Money cents={row.creditCents} /></td>
                    <td className="num"><Money cents={row.balanceCents} /></td>
                  </tr>
                ))}
                {bankLines.map((row) => (
                  <tr key={row.code}>
                    <td className="mono strong">{row.code}</td>
                    <td className="small">{row.name} <Badge tone="neutral">asset</Badge></td>
                    <td className="num"><Money cents={row.debitCents} /></td>
                    <td className="num"><Money cents={row.creditCents} /></td>
                    <td className="num"><Money cents={row.debitCents - row.creditCents} /></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr><td colSpan={4}>Total liability control balance</td><td className="num">{formatCurrency(glLiability)}</td></tr>
              </tfoot>
            </table>
          </div>
        </Card>
      </div>

      <Card
        title="Reconciliation detail — discrepancies"
        subtitle="Each item carries its ledger reference, accounting reference, difference, reviewer and resolution status."
        padded={false}
        actions={
          <div className="row" style={{ gap: 5 }}>
            {[{ k: "", l: "All" }, { k: "open", l: "Open" }, { k: "under_review", l: "Under review" }, { k: "correction_required", l: "Correction" }, { k: "resolved", l: "Resolved" }].map((tab) => (
              <Link key={tab.k} href={`/deposits/reconciliation${tab.k ? `?status=${tab.k}` : ""}`} className={`btn btn-sm ${statusFilter === tab.k ? "btn-primary" : ""}`}>{tab.l}</Link>
            ))}
          </div>
        }
      >
        {items.length === 0 ? (
          <EmptyState title="No reconciliation items for this filter" description="Reconciliation exceptions raised by collections, payments or manual accruals appear here for review." />
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr><th>Item</th><th>Deposit</th><th>Ledger ref</th><th>Accounting ref</th><th>Date</th><th className="num">Amount</th><th className="num">Difference</th><th>Reason</th><th>Reviewer</th><th>Status</th><th>Action</th></tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td className="strong">{item.reference}<div className="small muted">{item.source.toUpperCase()}</div></td>
                    <td>{item.depositId ? <Link href={`/deposits/${item.depositId}`}>{item.depositReference}</Link> : item.depositReference}<div className="small muted">{item.deposit?.tenant?.name}</div></td>
                    <td className="mono small">{item.txnRef}</td>
                    <td className="mono small">{item.accountingRef}</td>
                    <td className="small nowrap">{formatDate(item.txnDate)}</td>
                    <td className="num"><Money cents={item.amountCents} /></td>
                    <td className="num"><Money cents={item.differenceCents} tone={item.differenceCents === 0 ? "muted" : "negative"} /></td>
                    <td className="small" style={{ maxWidth: 280 }}>{item.reason}{item.resolutionNotes && <div className="muted">Notes: {item.resolutionNotes}</div>}</td>
                    <td className="small">{item.reviewer?.name ?? "Unassigned"}</td>
                    <td><Badge tone={item.status === "resolved" ? "success" : item.status === "correction_required" ? "danger" : "warning"}>{RECONCILIATION_STATUS_LABELS[item.status] ?? item.status}</Badge></td>
                    <td><ReconItemDialog item={{ id: item.id, reference: item.reference, current: item.status }} canManage={canReconcile} /></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr><td colSpan={6}>Unresolved absolute difference</td><td className="num">{formatCurrency(items.filter((i) => i.status !== "resolved").reduce((a, i) => a + Math.abs(i.differenceCents), 0))}</td><td colSpan={4} /></tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>

      <Card title="Deposit-level subledger vs control account" subtitle="Only records with a variance or an exception flag are listed. Marking reconciled requires every posted ledger event to have an accounting entry." padded={false}>
        {depositVariances.length === 0 ? (
          <EmptyState title="All deposits agree with the control accounts" description="No ledger variance and no open exception for the active deposit population." />
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>Deposit</th><th>Tenant</th><th>Property · unit</th><th className="num">Subledger obligation</th><th className="num">Control account</th><th className="num">Variance</th><th>Status</th><th>Review</th></tr></thead>
              <tbody>
                {depositVariances.map((row) => (
                  <tr key={row.deposit.id}>
                    <td><Link href={`/deposits/${row.deposit.id}`} className="strong">{row.deposit.reference}</Link></td>
                    <td>{row.tenant?.name}</td>
                    <td className="small">{row.property?.name} · {row.unit?.label}</td>
                    <td className="num"><Money cents={row.balances.totalRemainingCents} /></td>
                    <td className="num"><Money cents={row.glLiabilityCents} /></td>
                    <td className="num"><Money cents={row.glVarianceCents} tone={row.glVarianceCents === 0 ? "positive" : "negative"} /></td>
                    <td><Badge tone={row.deposit.reconciliationStatus === "exception" ? "danger" : row.deposit.reconciliationStatus === "reconciled" ? "success" : "warning"}>{row.deposit.reconciliationStatus.replaceAll("_", " ")}</Badge></td>
                    <td><ReconcileDepositDialog deposit={{ id: row.deposit.id, reference: row.deposit.reference, current: row.deposit.reconciliationStatus }} canReconcile={canReconcile} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Callout tone="warning" title="No automatic adjustment">
        This screen never writes an adjusting entry to force agreement. Resolve the underlying source document (post the missing journal, correct the manual accrual, or reverse the transaction)
        and re-run the comparison. {unpostedTxns.length > 0 ? `${unpostedTxns.length} ledger event(s) currently have no accounting entry.` : "All posted ledger events currently have accounting entries."}
      </Callout>
    </div>
  );
}
