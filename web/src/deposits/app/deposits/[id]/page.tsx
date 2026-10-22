import Link from "../../../shim/link";
import { notFound } from "../../../shim/store";
import { PageHeader, Card, StatusBadge, Badge, Money, EmptyState, Callout, DefinitionList, Progress } from "../../../components/ui";
import { loadDepositModule, getOpenInvoices } from "../../../lib/deposits/service";
import { getCurrentUser } from "../../../lib/session";
import {
  TXN_TYPE_LABELS,
  REFUND_STATUS_LABELS,
  PURPOSE_LABELS,
  can,
  depositTypeLabel,
  statusLabel,
} from "../../../lib/deposits/domain";
import { formatCurrency } from "../../../lib/money";
import { formatDate, formatDateTime } from "../../../lib/dates";
import { balanceFormula as formula } from "../../../lib/deposits/engine";
import {
  AccrueInterestDialog,
  ApplicationDialog,
  CancelDepositDialog,
  CloseDepositDialog,
  EditDraftDialog,
  KeyDeviceDialog,
  PrintButton,
  ReconcileDepositDialog,
  RecordCollectionDialog,
  RefundRequestDialog,
  RefundDecisionDialog,
  RefundProcessDialog,
  ReverseTransactionDialog,
  SettleInterestDialog,
} from "../../../components/deposit-actions";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function DepositDetailPage({ params, searchParams }: Props) {
  const { id } = await params;
  const query = await searchParams;
  const from = typeof query.from === "string" ? query.from : "";
  const data = await loadDepositModule();
  const row = data.deposits.find((d) => d.deposit.id === id);
  if (!row) notFound();
  const user = await getCurrentUser();
  const invoices = await getOpenInvoices(row.deposit.leaseId);
  const payments = data.unlinkedDepositPayments.filter((p) => p.tenantId === row.deposit.tenantId);
  const audit = data.audit.filter((a) => a.entityId === row.deposit.id).slice(0, 12);
  const refunds = row.refunds;
  const openRefund = row.openRefund;
  const interestTxns = row.txns.filter((t) => t.classification === "interest");
  const applicationTxns = row.txns.filter((t) => t.txnType === "application");
  const principalBreakdown = [
    { label: "Original required amount", value: row.deposit.requiredAmountCents, hint: "Legal requirement at creation (rule snapshot)" },
    { label: "Total principal collected", value: row.balances.receivedCents, hint: "Sum of posted collections" },
    { label: "Valid principal adjustments", value: row.balances.adjustmentsCents + row.balances.reversalsCents, hint: "Adjustments and controlled reversals" },
    { label: "Principal applied", value: row.balances.appliedCents, hint: "Permitted applications only" },
    { label: "Principal refunded", value: row.balances.refundedCents, hint: "Completed simulated refunds" },
    { label: "Principal outstanding", value: row.balances.principalOutstandingCents, hint: "Held or still expected obligation" },
  ];
  const interestBreakdown = [
    { label: "Interest accrued (posted)", value: row.balances.interestAccruedCents },
    { label: "Interest paid", value: row.balances.interestPaidCents },
    { label: "Interest credited", value: row.balances.interestCreditedCents },
    { label: "Interest adjustments", value: row.balances.interestReversedCents },
    { label: "Interest outstanding", value: row.balances.interestOutstandingCents },
    { label: "Unposted accrual estimate", value: row.interestPreview?.totalCents ?? 0 },
  ];

  const canRecord = can(user.role, "record_collection");
  const canApply = can(user.role, "apply_deposit");
  const canRefundRequest = can(user.role, "request_refund");
  const canApprove = can(user.role, "approve_refund");
  const canProcessRefund = can(user.role, "process_refund");
  const canInterest = can(user.role, "process_interest");
  const canReconcile = can(user.role, "reconcile_deposits");

  return (
    <div className="stack" style={{ gap: 14 }}>
      <PageHeader
        breadcrumb={[
          { label: "Deposits", href: "/deposits" },
          { label: "Register", href: `/deposits/register${from ? `?${from}` : ""}` },
          { label: row.deposit.reference },
        ]}
        title={`${row.deposit.reference} · ${depositTypeLabel(row.deposit.depositType)}`}
        description={`${row.tenant?.name ?? "No tenant"} · ${row.property?.name ?? "No property"} · Unit ${row.unit?.label ?? "—"} · Lease ${row.lease?.reference ?? "—"}`}
        meta={
          <>
            <StatusBadge status={row.deposit.status} />
            <span>{row.deposit.jurisdiction} {row.deposit.leaseType}</span>
            <span>·</span>
            <span>{row.deposit.source === "seed" ? "Deterministic demo record" : "Created in this session"}</span>
            <span>·</span>
            <span>Last updated {formatDateTime(row.deposit.updatedAt)}</span>
          </>
        }
        actions={
          <>
            <Link href={`/deposits/register${from ? `?${from}` : ""}`} className="btn btn-sm">Back to register</Link>
            <PrintButton label="Print receipt / PDF" />
          </>
        }
      />

      {row.issues.length > 0 && (
        <div className="grid-2-even">
          {row.issues.slice(0, 2).map((issue) => (
            <Callout key={issue.label} tone={issue.severity === "overdue" ? "danger" : issue.severity === "warning" ? "warning" : "info"} title={issue.severity === "overdue" ? "Overdue action" : undefined}>
              {issue.label} <Link href={issue.href} style={{ textDecoration: "underline" }}>Resolve</Link>
            </Callout>
          ))}
        </div>
      )}

      <div className="btn-row no-print">
        <RecordCollectionDialog
          deposit={{ ...row.deposit, uncollectedCents: row.balances.uncollectedCents, receivedCents: row.balances.receivedCents, requiredCents: row.deposit.requiredAmountCents, cashAccount: row.deposit.cashAccountCode, liabilityAccount: row.deposit.liabilityAccountCode, tenantName: row.tenant?.name ?? "" }}
          payments={payments.map((p) => ({ id: p.id, reference: p.reference, amountCents: p.amountCents, receivedAt: p.receivedAt, method: p.method }))}
          canRecord={canRecord}
        />
        <ApplicationDialog
          deposit={{
            id: row.deposit.id,
            reference: row.deposit.reference,
            tenantName: row.tenant?.name ?? "",
            depositType: row.deposit.depositType,
            outstandingCents: row.balances.principalOutstandingCents,
            oneMonthRentCents: row.lease?.monthlyRentCents ?? 0,
            receivableAccount: row.deposit.receivableAccountCode ?? "1200",
            liabilityAccount: row.deposit.liabilityAccountCode,
            status: row.deposit.status,
          }}
          purposes={row.rule?.applicationPurposes ?? []}
          invoices={invoices.map((i) => ({ id: i.id, reference: i.reference, periodLabel: i.periodLabel, amountCents: i.amountCents, status: i.status }))}
          canApply={canApply}
          approvalRequired={Boolean(row.rule?.approvalRequired)}
          invoiceHint="Ontario residential last month's rent may only be applied to the final rental period invoice."
        />
        <RefundRequestDialog
          deposit={{ id: row.deposit.id, reference: row.deposit.reference, tenantName: row.tenant?.name ?? "", status: row.deposit.status }}
          maxPrincipalCents={row.refundablePrincipalCents}
          maxInterestCents={row.balances.interestOutstandingCents}
          canRequest={canRefundRequest}
          blockedReason={row.refundBlockReason}
        />
        {openRefund && <RefundDecisionDialog refund={{ id: openRefund.id, reference: openRefund.reference, requested: openRefund.requestedPrincipalCents + openRefund.requestedInterestCents, requester: openRefund.requestedBy }} canApprove={canApprove} isRequester={openRefund.requestedBy === user.id} />}
        {openRefund && openRefund.status === "approved" && (
          <RefundProcessDialog refund={{ id: openRefund.id, reference: openRefund.reference, principal: openRefund.approvedPrincipalCents ?? 0, interest: openRefund.approvedInterestCents ?? 0, dueDate: openRefund.dueDate }} canProcess={canProcessRefund} />
        )}
        <ReconcileDepositDialog deposit={{ id: row.deposit.id, reference: row.deposit.reference, current: row.deposit.reconciliationStatus }} canReconcile={canReconcile} />
        <CloseDepositDialog deposit={{ id: row.deposit.id, reference: row.deposit.reference }} canClose={canReconcile && ["applied", "refunded"].includes(row.deposit.status)} />
        <CancelDepositDialog deposit={{ id: row.deposit.id, reference: row.deposit.reference }} canCancel={can(user.role, "edit_draft") && ["draft", "expected"].includes(row.deposit.status)} />
        <EditDraftDialog
          deposit={{ id: row.deposit.id, reference: row.deposit.reference, requiredCents: row.deposit.requiredAmountCents, expectedDate: row.deposit.expectedDate, liabilityAccount: row.deposit.liabilityAccountCode, cashAccount: row.deposit.cashAccountCode }}
          accounts={data.lookups.accounts}
          canEdit={can(user.role, "edit_draft") && row.deposit.status === "draft"}
        />
      </div>

      <div className="grid-2">
        <Card title="Deposit information" subtitle="Tenant, lease, jurisdiction and the rule version applied to this record.">
          <div className="grid-2-even" style={{ gap: 16 }}>
            <DefinitionList
              items={[
                { term: "Deposit reference", value: row.deposit.reference },
                { term: "Tenant", value: row.tenant?.name ?? "—" },
                { term: "Property", value: `${row.property?.name ?? "—"} · ${row.property?.building ?? ""}` },
                { term: "Unit", value: row.unit?.label ?? "—" },
                { term: "Lease", value: row.lease?.reference ?? "—" },
                { term: "Lease term", value: `${formatDate(row.lease?.startDate)} → ${formatDate(row.lease?.endDate)}` },
                { term: "Jurisdiction", value: `${row.deposit.jurisdiction} ${row.deposit.leaseType}` },
                { term: "Responsible staff", value: row.responsible?.name ?? "Unassigned" },
              ]}
            />
            <DefinitionList
              items={[
                { term: "Required amount", value: <Money cents={row.deposit.requiredAmountCents} /> },
                { term: "Date expected", value: formatDate(row.deposit.expectedDate) },
                { term: "Date received", value: row.deposit.firstReceivedDate ? formatDate(row.deposit.firstReceivedDate) : "Not yet received" },
                { term: "Applicable rule", value: row.rule ? `${row.rule.legalReference} (from ${formatDate(row.rule.effectiveFrom)})` : <Badge tone="warning">Not configured</Badge> },
                { term: "Rule at creation", value: row.ruleAtExpected ? `${row.ruleAtExpected.id} · ${row.ruleAtExpected.effectiveFrom}` : "No historical rule" },
                { term: "Interest", value: row.rule?.interestApplicable ? `${row.rule.interestFrequency} · ${row.rule.interestMethod}` : "Not applicable" },
                { term: "Liability account", value: `${row.deposit.liabilityAccountCode} · ${data.lookups.accounts.find((a) => a.code === row.deposit.liabilityAccountCode)?.name ?? "Unmapped"}` },
                { term: "Bank / cash account", value: `${row.deposit.cashAccountCode} · ${data.lookups.accounts.find((a) => a.code === row.deposit.cashAccountCode)?.name ?? "Unmapped"}` },
                { term: "Receivable account", value: row.deposit.receivableAccountCode ?? "1200" },
              ]}
            />
          </div>
          <div className="divider" />
          <div className="grid-2-even" style={{ gap: 12 }}>
            <div>
              <div className="small muted" style={{ marginBottom: 4 }}>Notes</div>
              <p className="small" style={{ margin: 0, lineHeight: 1.55 }}>{row.deposit.notes ?? "No notes recorded."}</p>
            </div>
            <div>
              <div className="small muted" style={{ marginBottom: 4 }}>Documents</div>
              {row.deposit.documents.length === 0 ? <p className="small muted" style={{ margin: 0 }}>No supporting documents attached. {row.rule?.requiredDocuments.length ? `Required: ${row.rule.requiredDocuments.join(", ")}.` : ""}</p> : (
                <ul className="small" style={{ margin: 0, paddingLeft: 16 }}>
                  {row.deposit.documents.map((doc) => <li key={doc.name}>{doc.name} <span className="muted">({doc.kind})</span></li>)}
                </ul>
              )}
            </div>
          </div>
        </Card>

        <div className="stack" style={{ gap: 14 }}>
          <Card title="Financial summary" subtitle="Principal and interest are kept strictly separate.">
            <div className="grid-2-even" style={{ gap: 14 }}>
              <div>
                <div className="small strong" style={{ marginBottom: 6 }}>Principal</div>
                {principalBreakdown.map((item) => (
                  <div className="between" key={item.label} style={{ fontSize: 12, padding: "3px 0" }}>
                    <span className="muted" title={item.hint}>{item.label}</span>
                    <Money cents={item.value} />
                  </div>
                ))}
              </div>
              <div>
                <div className="small strong" style={{ marginBottom: 6 }}>Interest</div>
                {interestBreakdown.map((item) => (
                  <div className="between" key={item.label} style={{ fontSize: 12, padding: "3px 0" }}>
                    <span className="muted">{item.label}</span>
                    <Money cents={item.value} />
                  </div>
                ))}
              </div>
            </div>
            <div className="divider" />
            <div className="between">
              <span className="strong">Total remaining obligation</span>
              <Money cents={row.balances.totalRemainingCents} className="strong" />
            </div>
            <Progress value={row.balances.receivedCents} total={Math.max(1, row.deposit.requiredAmountCents)} />
            <p className="hint" style={{ marginTop: 8, marginBottom: 0 }}>{formula(row.deposit.depositType as "last_month_rent")}</p>
            <p className="hint" style={{ margin: "4px 0 0" }}>Interest is never combined with principal unless the applicable rule requires it.</p>
          </Card>

          {row.deposit.interestApplicable && (
            <Card
              title="Interest"
              subtitle={row.rule ? `${row.rule.interestFrequency} · ${row.rule.interestMethod} · next due ${formatDate(row.interestDueDate)}` : "Rule not configured"}
              actions={
                canInterest ? (
                  <AccrueInterestDialog
                    deposit={{ id: row.deposit.id, reference: row.deposit.reference }}
                    periodStart={row.interestWindowStart}
                    periodEnd={data.today}
                    calculatedCents={row.interestPreview?.totalCents ?? 0}
                    canPost={Boolean(row.rule?.interestApplicable && row.interestPreview?.totalCents)}
                    blockedReason={!row.rule?.interestApplicable ? "Interest does not apply under the effective rule." : (row.interestPreview?.totalCents ?? 0) <= 0 ? "No interest is available to accrue for the current period." : null}
                    segments={(row.interestPreview?.segments ?? []).map((s) => ({ start: s.start, end: s.end, days: s.days, eligiblePrincipalCents: s.eligiblePrincipalCents, annualRateBps: s.annualRateBps, interestCents: s.interestCents }))}
                  />
                ) : (
                  <span className="small muted">Interest processing requires the process-interest permission.</span>
                )
              }
            >
              <div className="grid-2-even" style={{ gap: 8, fontSize: 12 }}>
                <div className="between"><span className="muted">Accrual from</span><span>{formatDate(row.interestWindowStart)}</span></div>
                <div className="between"><span className="muted">Last posted period end</span><span>{row.lastAccrualEnd ? formatDate(row.lastAccrualEnd) : "None"}</span></div>
                <div className="between"><span className="muted">Blended rate</span><span>{((row.interestPreview?.blendedRateBps ?? 0) / 100).toFixed(2)}%</span></div>
                <div className="between"><span className="muted">Eligible principal</span><Money cents={row.interestPreview?.eligiblePrincipalCents ?? 0} /></div>
                <div className="between"><span className="muted">Unposted estimate</span><Money cents={row.interestPreview?.totalCents ?? 0} /></div>
                <div className="between"><span className="muted">Posted outstanding</span><Money cents={row.balances.interestOutstandingCents} /></div>
              </div>
              <div className="divider" />
              <div className="small strong" style={{ marginBottom: 4 }}>Rate history (effective-dated)</div>
              {row.rates.length === 0 ? <p className="small muted" style={{ margin: 0 }}>No rate history configured for this jurisdiction / type.</p> : (
                <ul className="small" style={{ margin: 0, paddingLeft: 16 }}>
                  {row.rates.map((rate) => (
                    <li key={rate.id}>{formatDate(rate.effectiveFrom)} → {rate.effectiveTo ? formatDate(rate.effectiveTo) : "open"} · {(rate.annualRateBps / 100).toFixed(2)}% <span className="muted">{rate.source}</span></li>
                  ))}
                </ul>
              )}
              {canInterest && row.balances.interestOutstandingCents > 0 && (
                <div style={{ marginTop: 10 }}>
                  <SettleInterestDialog
                    deposit={{ id: row.deposit.id, reference: row.deposit.reference }}
                    outstandingCents={row.balances.interestOutstandingCents}
                    invoices={invoices.map((i) => ({ id: i.id, reference: i.reference, periodLabel: i.periodLabel, amountCents: i.amountCents }))}
                    canPost={canInterest}
                  />
                </div>
              )}
            </Card>
          )}
        </div>
      </div>

      {row.devices.length > 0 && (
        <Card title="Key, fob and access device tracking" subtitle="Refundable key deposits: retention is limited to the documented replacement cost of devices not returned." padded={false}>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Device</th><th>Identifier</th><th className="num">Issued</th><th className="num">Returned</th><th className="num">Outstanding</th>
                  <th className="num">Replacement cost</th><th>Return date</th><th>Condition</th><th>Action</th>
                </tr>
              </thead>
              <tbody>
                {row.devices.map((device) => (
                  <tr key={device.id}>
                    <td className="strong">{device.deviceType.replaceAll("_", " ")}</td>
                    <td className="mono">{device.identifier}</td>
                    <td className="num">{device.quantityIssued}</td>
                    <td className="num">{device.quantityReturned}</td>
                    <td className="num">{Math.max(0, device.quantityIssued - device.quantityReturned)}</td>
                    <td className="num"><Money cents={device.replacementCostCents} /></td>
                    <td>{device.returnDate ? formatDate(device.returnDate) : "—"}</td>
                    <td>{device.returnCondition ?? "—"}</td>
                    <td>
                      <KeyDeviceDialog
                        device={{ id: device.id, identifier: device.identifier, issued: device.quantityIssued, returned: device.quantityReturned, condition: device.returnCondition, replacementCostCents: device.replacementCostCents }}
                        canUpdate={canRecord}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <div className="grid-2">
        <Card title="Refunds" subtitle="Request, approval and payment are separate controlled steps." padded={false}>
          {refunds.length === 0 ? (
            <EmptyState title="No refunds recorded" description="Refund requests for this deposit will appear here with their approval and payment status." />
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr><th>Refund</th><th>Requested</th><th className="num">Principal</th><th className="num">Interest</th><th>Status</th><th>Approval</th><th>Completed</th><th>Action</th></tr>
                </thead>
                <tbody>
                  {refunds.map((refund) => (
                    <tr key={refund.id}>
                      <td className="strong">{refund.reference}<div className="small muted">{formatDate(refund.requestedAt)}</div></td>
                      <td className="small">{refund.requestedBy.replace("staff-", "")}<div className="small muted">{refund.method.toUpperCase()}</div></td>
                      <td className="num"><Money cents={refund.approvedPrincipalCents ?? refund.requestedPrincipalCents} /></td>
                      <td className="num"><Money cents={refund.approvedInterestCents ?? refund.requestedInterestCents} /></td>
                      <td><Badge tone={refund.status === "completed" ? "success" : refund.status === "rejected" ? "danger" : "warning"}>{REFUND_STATUS_LABELS[refund.status] ?? refund.status}</Badge></td>
                      <td className="small">{refund.approvalStatus}{refund.approvedBy ? <div className="small muted">by {refund.approvedBy.replace("staff-", "")}</div> : null}</td>
                      <td className="small">{refund.completedAt ? formatDateTime(refund.completedAt) : "—"}</td>
                      <td>
                        {refund.status === "approved" && (
                          <RefundProcessDialog refund={{ id: refund.id, reference: refund.reference, principal: refund.approvedPrincipalCents ?? 0, interest: refund.approvedInterestCents ?? 0, dueDate: refund.dueDate }} canProcess={canProcessRefund} />
                        )}
                        {refund.status === "requested" && (
                          <RefundDecisionDialog refund={{ id: refund.id, reference: refund.reference, requested: refund.requestedPrincipalCents + refund.requestedInterestCents, requester: refund.requestedBy }} canApprove={canApprove} isRequester={refund.requestedBy === user.id} />
                        )}
                        {!["approved", "requested"].includes(refund.status) && <span className="small muted">No action</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title="Permitted applications" subtitle="Each application must reference an authorized obligation and cannot double-count income." padded={false}>
          {applicationTxns.length === 0 ? (
            <EmptyState title="No applications" description="Last month's rent applications and permitted commercial deductions appear here." />
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead><tr><th>Date</th><th>Purpose</th><th>Linked record</th><th className="num">Amount</th><th>Ledger</th></tr></thead>
                <tbody>
                  {applicationTxns.map((txn) => (
                    <tr key={txn.id}>
                      <td>{formatDate(txn.occurredAt)}</td>
                      <td>{PURPOSE_LABELS[txn.purpose ?? ""] ?? txn.purpose ?? "—"}</td>
                      <td className="mono small">{txn.invoiceId ?? "—"}</td>
                      <td className="num"><Money cents={Math.abs(txn.signedAmountCents)} /></td>
                      <td className="mono small">{txn.reference}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <Card
        title="Transaction history"
        subtitle="Chronological ledger of every deposit event. Posted transactions are immutable — corrections use controlled reversals."
        padded={false}
        id="history"
      >
        {row.txns.length === 0 ? (
          <EmptyState title="No ledger activity" description="No collections, applications, refunds, interest or adjustments have been recorded for this deposit." />
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Ledger ref</th><th>Date</th><th>Transaction</th><th className="num">Amount</th><th>Classification</th>
                  <th>Payment / invoice</th><th>Journal</th><th>User</th><th>Notes / document</th><th>Action</th>
                </tr>
              </thead>
              <tbody>
                {row.txns.map((txn) => (
                  <tr key={txn.id}>
                    <td className="mono">{txn.reference}<div className="small muted">{txn.source === "seed" ? "demo" : "session"}</div></td>
                    <td className="nowrap">{formatDate(txn.occurredAt)}</td>
                    <td>
                      <span className="strong">{TXN_TYPE_LABELS[txn.txnType] ?? txn.txnType.replaceAll("_", " ")}</span>
                      {txn.purpose && <div className="small muted">{PURPOSE_LABELS[txn.purpose] ?? txn.purpose}</div>}
                      {txn.periodStart && <div className="small muted">{formatDate(txn.periodStart)} → {formatDate(txn.periodEnd)}</div>}
                    </td>
                    <td className="num"><Money cents={txn.signedAmountCents} signed /></td>
                    <td className="small">{txn.classification}</td>
                    <td className="small mono">{txn.paymentId ?? txn.invoiceId ?? "—"}</td>
                    <td className="small mono">{txn.journalEntryId ?? <Badge tone="warning">Not posted</Badge>}</td>
                    <td className="small">{txn.userId.replace("staff-", "")}</td>
                    <td className="small" style={{ maxWidth: 240 }}>
                      {txn.notes}
                      {txn.documentRef && <div className="muted">{txn.documentRef}</div>}
                      {txn.approvalRef && <div className="muted">Approval {txn.approvalRef}</div>}
                      {txn.reversalOfTxnId && <div className="muted">Reversal of {txn.reversalOfTxnId}</div>}
                    </td>
                    <td>
                      {canReconcile && txn.classification !== "none" && !row.txns.some((t) => t.reversalOfTxnId === txn.id) && txn.txnType !== "reversal" ? (
                        <ReverseTransactionDialog txn={{ id: txn.id, reference: txn.reference, type: txn.txnType, amountCents: txn.signedAmountCents }} canReverse={canReconcile} />
                      ) : (
                        <span className="small muted">Immutable</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="grid-2">
        <Card title="Accounting entries" subtitle="Deposits are liabilities, not income. Every posting is simulated in this environment." padded={false}>
          {row.journals.length === 0 ? (
            <EmptyState title="No journal entries posted" description={row.glVarianceCents !== 0 ? "The subledger carries a balance with no accounting entry — this is a reconciliation exception." : "No accounting entries are linked to this deposit."} />
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead><tr><th>Entry</th><th>Date</th><th>Description</th><th>Account</th><th className="num">Debit</th><th className="num">Credit</th></tr></thead>
                <tbody>
                  {row.journals.map(({ entry, lines }) =>
                    lines.map((line, index) => (
                      <tr key={line.id}>
                        <td className="mono">{index === 0 ? entry.reference : ""}</td>
                        <td>{index === 0 ? formatDate(entry.entryDate) : ""}</td>
                        <td className="small">{index === 0 ? entry.description : ""}</td>
                        <td className="small">{line.accountCode} · {data.lookups.accounts.find((a) => a.code === line.accountCode)?.name ?? ""}</td>
                        <td className="num">{line.debitCents ? formatCurrency(line.debitCents) : "—"}</td>
                        <td className="num">{line.creditCents ? formatCurrency(line.creditCents) : "—"}</td>
                      </tr>
                    )),
                  )}
                </tbody>
              </table>
            </div>
          )}
          <div className="card-body">
            <div className="grid-3">
              <div><div className="small muted">Subledger balance (principal + interest)</div><Money cents={row.balances.totalRemainingCents} /></div>
              <div><div className="small muted">Liability control account balance</div><Money cents={row.glLiabilityCents} /></div>
              <div><div className="small muted">Variance</div><Money cents={row.glVarianceCents} tone={row.glVarianceCents === 0 ? "positive" : "negative"} /></div>
            </div>
            <p className="hint" style={{ marginBottom: 0 }}>Reconciliation never adjusts the general ledger to match the subledger automatically.</p>
          </div>
        </Card>

        <Card title="Audit trail" subtitle="User, timestamp, action and values for every change to this deposit." padded={false}>
          {audit.length === 0 ? (
            <EmptyState title="No audit events in this session" description="Seeded records include a representative audit history; new actions append here." />
          ) : (
            <div className="card-body">
              <div className="timeline">
                {audit.map((event) => (
                  <div className="timeline-item" key={event.id}>
                    <div className="between">
                      <span className="strong small">{event.action}</span>
                      <span className="small muted">{formatDateTime(event.createdAt)}</span>
                    </div>
                    <div className="small muted">by {event.userId.replace("staff-", "")}{event.reason ? ` · ${event.reason}` : ""}</div>
                    {event.newValue && <div className="mono small" style={{ marginTop: 3, color: "var(--dp-muted)" }}>{JSON.stringify(event.newValue).slice(0, 180)}</div>}
                    {event.relatedRef && <div className="small muted">Ref: {event.relatedRef}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>

      <Card title="Record controls" subtitle="Lifecycle status and disposition">
        <div className="grid-4">
          <div><div className="small muted">Current status</div><StatusBadge status={row.deposit.status} /></div>
          <div><div className="small muted">Reconciliation</div><Badge tone={row.deposit.reconciliationStatus === "reconciled" ? "success" : row.deposit.reconciliationStatus === "exception" ? "danger" : "warning"}>{row.deposit.reconciliationStatus.replaceAll("_", " ")}</Badge></div>
          <div><div className="small muted">Closed</div><div className="small">{row.deposit.closedAt ? formatDate(row.deposit.closedAt) : "Open"}</div></div>
          <div><div className="small muted">Cancellation</div><div className="small">{row.deposit.cancelledAt ? `${formatDate(row.deposit.cancelledAt)} — ${row.deposit.cancellationReason}` : "Not cancelled"}</div></div>
        </div>
        <div className="divider" />
        <div className="between">
          <p className="hint" style={{ margin: 0 }}>
            Status: {statusLabel(row.deposit.status)}. Finalized transactions cannot be edited or deleted; use the reversal workflow on the transaction history.
            {row.devices.length > 0 ? " Key deposits require device returns before refunds can be processed." : ""}
          </p>
          <Link href="/deposits/reports?report=audit" className="btn btn-sm no-print">Open audit report</Link>
        </div>
      </Card>
    </div>
  );
}
