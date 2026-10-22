import Link from "../../../shim/link";
import { PageHeader, Card, Badge, Money, EmptyState, Callout, KpiCard } from "../../../components/ui";
import { loadDepositModule } from "../../../lib/deposits/service";
import { getCurrentUser } from "../../../lib/session";
import { REFUND_STATUS_LABELS, can, depositTypeLabel } from "../../../lib/deposits/domain";
import { formatCurrency } from "../../../lib/money";
import { diffDays, formatDate, formatDateTime } from "../../../lib/dates";
import { RefundDecisionDialog, RefundProcessDialog, RefundRequestDialog } from "../../../components/deposit-actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Deposit refunds" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function RefundsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const data = await loadDepositModule();
  const user = await getCurrentUser();
  const statusFilter = typeof params.status === "string" ? params.status : "open";
  const depositFilter = typeof params.deposit === "string" ? params.deposit : "";

  const refunds = data.refunds.filter((refund) => {
    if (statusFilter === "open" && !["requested", "approved"].includes(refund.status)) return false;
    if (statusFilter === "completed" && refund.status !== "completed") return false;
    if (statusFilter === "rejected" && !["rejected", "reversed", "failed"].includes(refund.status)) return false;
    if (depositFilter && refund.depositId !== depositFilter) return false;
    return true;
  });

  const openRefunds = data.refunds.filter((r) => ["requested", "approved"].includes(r.status));
  const completed = data.refunds.filter((r) => r.status === "completed");
  const avgDays = completed.length
    ? Math.round(
        completed.reduce((acc, r) => acc + diffDays(r.requestedAt, r.completedAt ? r.completedAt.toISOString().slice(0, 10) : data.today), 0) / completed.length,
      )
    : 0;

  const eligible = data.deposits.filter(
    (row) =>
      row.balances.principalOutstandingCents + row.balances.interestOutstandingCents > 0 &&
      !row.openRefund &&
      !["cancelled", "draft", "closed", "expected"].includes(row.deposit.status),
  );
  const selected = depositFilter ? data.deposits.find((d) => d.deposit.id === depositFilter) ?? null : null;

  return (
    <div className="stack" style={{ gap: 14 }}>
      <PageHeader
        breadcrumb={[{ label: "Deposits", href: "/deposits" }, { label: "Refunds" }]}
        title="Deposit refunds"
        description="Request, approve and process refunds with segregation of duties. A refund is never marked complete before the simulated payment step, and eligibility is re-validated at every stage."
        meta={<><span>{openRefunds.length} open refund requests</span><span>·</span><span>{formatCurrency(openRefunds.reduce((a, r) => a + (r.approvedPrincipalCents ?? r.requestedPrincipalCents) + (r.approvedInterestCents ?? r.requestedInterestCents), 0))} outstanding</span></>}
        actions={<Link href="/deposits/register?status=refund_pending" className="btn btn-sm">Deposits with refunds</Link>}
      />

      <div className="kpi-grid">
        <KpiCard label="Awaiting approval" valueCents={openRefunds.filter((r) => r.status === "requested").reduce((a, r) => a + r.requestedPrincipalCents + r.requestedInterestCents, 0)} count={openRefunds.filter((r) => r.status === "requested").length} hint="Refunds that require a second approver" href="/deposits/refunds?status=open" tone="warning" />
        <KpiCard label="Approved — awaiting payment" valueCents={openRefunds.filter((r) => r.status === "approved").reduce((a, r) => a + (r.approvedPrincipalCents ?? 0) + (r.approvedInterestCents ?? 0), 0)} count={openRefunds.filter((r) => r.status === "approved").length} hint="Approved but not yet paid; liability still held" href="/deposits/refunds?status=open" tone="accent" />
        <KpiCard label="Refunds completed" valueCents={completed.reduce((a, r) => a + (r.approvedPrincipalCents ?? 0) + (r.approvedInterestCents ?? 0), 0)} count={completed.length} hint="Simulated payments completed and liabilities released" href="/deposits/refunds?status=completed" tone="success" />
        <KpiCard label="Average processing time" valueCents={0} count={avgDays} isCount hint="Calendar days from request to completed payment (demo data)" href="/deposits/reports?report=refund" tone="info" />
      </div>

      <div className="row" style={{ gap: 6 }}>
        {[
          { key: "open", label: "Open" },
          { key: "all", label: "All refunds" },
          { key: "completed", label: "Completed" },
          { key: "rejected", label: "Rejected / reversed" },
        ].map((tab) => (
          <Link key={tab.key} href={`/deposits/refunds?status=${tab.key}${depositFilter ? `&deposit=${depositFilter}` : ""}`} className={`btn btn-sm ${statusFilter === tab.key ? "btn-primary" : ""}`}>{tab.label}</Link>
        ))}
      </div>

      {selected && (
        <Card title={`Refund for ${selected.deposit.reference}`} subtitle={`${selected.tenant?.name} · ${depositTypeLabel(selected.deposit.depositType)} · held ${formatCurrency(selected.balances.principalOutstandingCents)} principal + ${formatCurrency(selected.balances.interestOutstandingCents)} interest`}>
          {selected.refundBlockReason && <Callout tone="warning" title="Refund eligibility">{selected.refundBlockReason}</Callout>}
          <div className="btn-row" style={{ marginTop: 10 }}>
            <RefundRequestDialog
              deposit={{ id: selected.deposit.id, reference: selected.deposit.reference, tenantName: selected.tenant?.name ?? "", status: selected.deposit.status }}
              maxPrincipalCents={selected.refundablePrincipalCents}
              maxInterestCents={selected.balances.interestOutstandingCents}
              canRequest={can(user.role, "request_refund")}
              blockedReason={selected.refundBlockReason}
              devicesSummary={selected.devices.length ? `${selected.devices.reduce((a, d) => a + Math.max(0, d.quantityIssued - d.quantityReturned), 0)} access device(s) outstanding. Only documented replacement cost may be retained.` : undefined}
            />
            <Link href={`/deposits/${selected.deposit.id}`} className="btn btn-sm">Open deposit</Link>
          </div>
        </Card>
      )}

      <Card title="Refund register" subtitle="Request, approval and payment are tracked separately with full references." padded={false}>
        {refunds.length === 0 ? (
          <EmptyState title="No refunds for this view" description="Refund requests you create will appear here with their approval and payment status." />
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Refund ref</th><th>Deposit / tenant</th><th>Property · unit</th><th>Type</th><th>Requested</th>
                  <th className="num">Requested</th><th className="num">Approved</th><th>Method</th><th>Status</th><th>Due</th><th>Approval</th><th>Payment ref</th><th>Completed</th><th>Action</th>
                </tr>
              </thead>
              <tbody>
                {refunds.map((refund) => {
                  const deposit = refund.deposit;
                  const requested = refund.requestedPrincipalCents + refund.requestedInterestCents;
                  const approved = (refund.approvedPrincipalCents ?? 0) + (refund.approvedInterestCents ?? 0);
                  const payment = refund.paymentId ? data.payments.find((p) => p.id === refund.paymentId) : null;
                  return (
                    <tr key={refund.id}>
                      <td className="strong">{refund.reference}</td>
                      <td>{deposit ? <Link href={`/deposits/${deposit.deposit.id}`} className="strong">{deposit.deposit.reference}</Link> : "—"}<div className="small muted">{deposit?.tenant?.name}</div></td>
                      <td className="small">{deposit?.property?.name}<div className="muted">{deposit?.unit?.label}</div></td>
                      <td className="small">{deposit ? depositTypeLabel(deposit.deposit.depositType) : "—"}</td>
                      <td className="small nowrap">{formatDate(refund.requestedAt)}</td>
                      <td className="num"><Money cents={requested} /></td>
                      <td className="num"><Money cents={approved} /></td>
                      <td className="small">{refund.method.toUpperCase()}</td>
                      <td><Badge tone={refund.status === "completed" ? "success" : refund.status === "rejected" || refund.status === "reversed" ? "danger" : "warning"}>{REFUND_STATUS_LABELS[refund.status] ?? refund.status}</Badge></td>
                      <td className="small nowrap">{refund.dueDate ? formatDate(refund.dueDate) : "—"}</td>
                      <td className="small">{refund.approvalStatus}{refund.approvedBy ? <div className="muted">{refund.approvedBy.replace("staff-", "")}</div> : null}</td>
                      <td className="mono small">{payment?.reference ?? refund.paymentId ?? "—"}</td>
                      <td className="small">{refund.completedAt ? formatDateTime(refund.completedAt) : "—"}</td>
                      <td>
                        <div className="btn-row">
                          {refund.status === "requested" && (
                            <RefundDecisionDialog refund={{ id: refund.id, reference: refund.reference, requested, requester: refund.requestedBy }} canApprove={can(user.role, "approve_refund")} isRequester={refund.requestedBy === user.id} />
                          )}
                          {refund.status === "approved" && (
                            <RefundProcessDialog refund={{ id: refund.id, reference: refund.reference, principal: refund.approvedPrincipalCents ?? 0, interest: refund.approvedInterestCents ?? 0, dueDate: refund.dueDate }} canProcess={can(user.role, "process_refund")} />
                          )}
                          {!["requested", "approved"].includes(refund.status) && <span className="small muted">Closed</span>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="card-body">
          <Callout tone="info" title="Refund controls">
            Refunds cannot exceed the available principal or interest. Approval requires a different user with the approve-refund permission.
            Completion requires the separate payment permission and creates a simulated payment plus a balanced journal. Failed or reversed payments restore the balance through an auditable correction.
          </Callout>
        </div>
      </Card>

      <Card title="Deposits eligible for a refund request" subtitle="Held balances with no open refund. Eligibility is re-validated server-side on submission." padded={false}>
        {eligible.length === 0 ? (
          <EmptyState title="No refundable deposits" description="All held deposits either have an open refund or are not refundable under the applicable rules." />
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>Deposit</th><th>Tenant</th><th>Type</th><th>Jurisdiction</th><th className="num">Principal held</th><th className="num">Interest outstanding</th><th>Eligibility</th><th>Action</th></tr></thead>
              <tbody>
                {eligible.map((row) => (
                  <tr key={row.deposit.id}>
                    <td><Link href={`/deposits/refunds?deposit=${row.deposit.id}`} className="strong">{row.deposit.reference}</Link></td>
                    <td>{row.tenant?.name}<div className="small muted">Unit {row.unit?.label}</div></td>
                    <td className="small">{depositTypeLabel(row.deposit.depositType)}</td>
                    <td className="small">{row.deposit.jurisdiction} {row.deposit.leaseType}</td>
                    <td className="num"><Money cents={row.balances.principalOutstandingCents} /></td>
                    <td className="num"><Money cents={row.balances.interestOutstandingCents} /></td>
                    <td className="small" style={{ maxWidth: 260 }}>{row.refundBlockReason ? <Badge tone="warning">Blocked</Badge> : <Badge tone="success">Refundable {formatCurrency(row.refundablePrincipalCents)}</Badge>}{row.devices.length > 0 && <div className="muted">{row.devices.reduce((a, d) => a + Math.max(0, d.quantityIssued - d.quantityReturned), 0)} device(s) outstanding</div>}</td>
                    <td>
                      <RefundRequestDialog
                        deposit={{ id: row.deposit.id, reference: row.deposit.reference, tenantName: row.tenant?.name ?? "", status: row.deposit.status }}
                        maxPrincipalCents={row.refundablePrincipalCents}
                        maxInterestCents={row.balances.interestOutstandingCents}
                        canRequest={can(user.role, "request_refund")}
                        blockedReason={row.refundBlockReason}
                        devicesSummary={row.devices.length ? "Key deposit: retention limited to documented replacement cost of unreturned devices." : undefined}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

