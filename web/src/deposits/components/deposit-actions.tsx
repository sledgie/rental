import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useActionState, formProps } from "../shim/react";
import {
  cancelDepositAction,
  closeDepositAction,
  decideRefundAction,
  postApplicationAction,
  postInterestAccrualAction,
  processRefundAction,
  reconcileDepositAction,
  recordCollectionAction,
  requestRefundAction,
  reverseTransactionAction,
  settleInterestAction,
  updateDraftDepositAction,
  updateKeyDeviceAction,
  updateReconciliationItemAction,
  type ActionState,
} from "../lib/deposits/actions";
import { formatCurrency } from "../lib/money";
import { formatDate, todayISO } from "../lib/dates";
import { APPLICATION_PURPOSES, METHOD_LABELS, PURPOSE_LABELS } from "../lib/deposits/domain";

export type ServerAction = (prev: ActionState, fd: FormData) => Promise<ActionState>;
const initial: ActionState = { ok: false, message: "", errors: [], warnings: [] };

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="field">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="hint">{hint}</span>}
    </label>
  );
}

export function ActionDialog({
  label,
  title,
  description,
  action,
  submitLabel = "Confirm",
  tone = "primary",
  disabledReason,
  size = "sm",
  children,
  successHint,
  variant,
}: {
  label: string;
  title: string;
  description?: ReactNode;
  action: ServerAction;
  submitLabel?: string;
  tone?: "primary" | "success" | "danger" | "secondary";
  disabledReason?: string | null;
  size?: "sm" | "md";
  children?: ReactNode;
  successHint?: string;
  variant?: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(action, initial);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const cls = `btn ${tone === "primary" ? "btn-primary" : tone === "success" ? "btn-success" : tone === "danger" ? "btn-danger" : ""} ${size === "sm" ? "btn-sm" : ""} ${variant ?? ""}`;

  return (
    <>
      <button type="button" className={cls} onClick={() => setOpen(true)} disabled={Boolean(disabledReason)} title={disabledReason ?? undefined}>
        {label}
      </button>
      {open && createPortal(
        <div className="u-root dp" data-overlay="true"><div className="modal-backdrop" onClick={() => setOpen(false)}>
          <div className="modal" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 700 }}>{title}</h2>
                {description && <div className="card-sub">{description}</div>}
              </div>
              <button type="button" className="btn btn-sm" onClick={() => setOpen(false)} aria-label="Close dialog">Close</button>
            </div>
            <form {...formProps(formAction)}>
              <div className="modal-body stack" style={{ gap: 12 }}>
                {disabledReason && <div className="callout callout-warning">{disabledReason}</div>}
                {state.errors.length > 0 && (
                  <div className="callout callout-danger" role="alert">
                    <div>
                      <div className="callout-title">Action blocked</div>
                      <ul style={{ margin: "4px 0 0 16px", padding: 0 }}>
                        {state.errors.map((error) => (
                          <li key={error}>{error}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
                {state.warnings.length > 0 && (
                  <div className="callout callout-warning">
                    <div>
                      <div className="callout-title">Review before confirming</div>
                      <ul style={{ margin: "4px 0 0 16px", padding: 0 }}>
                        {state.warnings.map((warning) => (
                          <li key={warning}>{warning}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
                {state.ok && (
                  <div className="callout callout-success" role="status">
                    <div>
                      <div className="callout-title">Recorded (simulated)</div>
                      <div>{state.message}</div>
                      {successHint && <div className="small" style={{ marginTop: 4 }}>{successHint}</div>}
                    </div>
                  </div>
                )}
                <fieldset disabled={Boolean(disabledReason)} style={{ border: 0, padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 12 }}>
                  {children}
                </fieldset>
              </div>
              <div className="modal-foot">
                <button type="button" className="btn" onClick={() => setOpen(false)}>Cancel</button>
                <button type="submit" className={cls} disabled={pending || Boolean(disabledReason)}>
                  {pending ? "Posting…" : submitLabel}
                </button>
              </div>
            </form>
          </div>
        </div></div>,
        document.body,
      )}
    </>
  );
}

const methods = Object.entries(METHOD_LABELS);

export function RecordCollectionDialog({
  deposit,
  payments,
  canRecord,
  blockedReason,
}: {
  deposit: { id: string; reference: string; tenantName: string; uncollectedCents: number; receivedCents: number; requiredCents: number; cashAccount: string; liabilityAccount: string; expectedDate: string; status: string };
  payments: { id: string; reference: string; amountCents: number; receivedAt: string; method: string }[];
  canRecord: boolean;
  blockedReason?: string | null;
}) {
  return (
    <ActionDialog
      label="Record collection"
      title={`Record collection — ${deposit.reference}`}
      description="Posts a principal collection to the deposit subledger, links or creates a payment, and posts a balanced journal. Simulated: no real funds move."
      action={recordCollectionAction}
      submitLabel="Record simulated collection"
      tone="success"
      size="md"
      disabledReason={!canRecord ? blockedReason ?? "Your role cannot record collections." : blockedReason ?? null}
      successHint="A receipt can be printed from the deposit detail page."
    >
      <input type="hidden" name="depositId" value={deposit.id} />
      <div className="grid-2-even" style={{ gap: 10 }}>
        <Field label={`Amount to collect (remaining ${formatCurrency(deposit.uncollectedCents)})`}>
          <input className="input" name="amount" inputMode="decimal" defaultValue={(deposit.uncollectedCents / 100).toFixed(2)} required />
        </Field>
        <Field label="Collection date">
          <input className="input" type="date" name="receivedDate" defaultValue={todayISO()} max={todayISO()} required />
        </Field>
        <Field label="Method">
          <select className="select" name="method" defaultValue="eft">
            {methods.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </Field>
        <Field label="Link an existing payment" hint="Existing Payments records are linked, never duplicated.">
          <select className="select" name="paymentId" defaultValue="new">
            <option value="new">Create a new simulated payment</option>
            {payments.map((payment) => (
              <option key={payment.id} value={payment.id}>
                {payment.reference} · {formatCurrency(payment.amountCents)} · {formatDate(payment.receivedAt)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Payment reference / receipt note">
          <input className="input" name="paymentReference" placeholder="e.g. EFT-44821" />
        </Field>
        <Field label="Document attached">
          <input className="input" name="receiptNote" placeholder="e.g. Receipt R-11210.pdf" />
        </Field>
      </div>
      <Field label="Notes">
        <textarea className="textarea" name="notes" placeholder="Explain any partial collection, split payment or supporting document." />
      </Field>
      <div className="callout callout-info">
        Accounting preview: Debit {deposit.cashAccount} bank / Credit {deposit.liabilityAccount} deposit liability. Remaining expected today: {formatCurrency(deposit.uncollectedCents)}.
      </div>
    </ActionDialog>
  );
}

export function ApplicationDialog({
  deposit,
  purposes,
  invoices,
  canApply,
  blockedReason,
  approvalRequired,
  invoiceHint,
}: {
  deposit: { id: string; reference: string; tenantName: string; depositType: string; outstandingCents: number; oneMonthRentCents: number; receivableAccount: string; liabilityAccount: string; status: string };
  purposes: string[];
  invoices: { id: string; reference: string; periodLabel: string; amountCents: number; status: string }[];
  canApply: boolean;
  blockedReason?: string | null;
  approvalRequired: boolean;
  invoiceHint?: string;
}) {
  const availablePurposes = purposes.length > 0 ? purposes : APPLICATION_PURPOSES.filter((p) => p !== "damage_beyond_normal_wear" || deposit.depositType !== "last_month_rent");
  return (
    <ActionDialog
      label="Apply deposit"
      title={`Permitted application — ${deposit.reference}`}
      description="Applications must match the configured purposes for the applicable rule. Posting relieves the deposit liability and the linked receivable — no duplicate income."
      action={postApplicationAction}
      submitLabel="Post simulated application"
      tone="primary"
      size="md"
      disabledReason={!canApply ? blockedReason ?? "Your role cannot apply deposits." : availablePurposes.length === 0 ? "The applicable rule does not permit this deposit type to be applied." : null}
    >
      <input type="hidden" name="depositId" value={deposit.id} />
      <div className="grid-2-even" style={{ gap: 10 }}>
        <Field label={`Application amount (held ${formatCurrency(deposit.outstandingCents)})`}>
          <input className="input" name="amount" inputMode="decimal" defaultValue={(Math.min(deposit.outstandingCents, deposit.oneMonthRentCents) / 100).toFixed(2)} required />
        </Field>
        <Field label="Permitted purpose" hint="Only purposes configured on the effective rule are accepted.">
          <select className="select" name="purpose" defaultValue={availablePurposes[0]}>
            {availablePurposes.map((purpose) => (
              <option key={purpose} value={purpose}>{PURPOSE_LABELS[purpose] ?? purpose}</option>
            ))}
          </select>
        </Field>
        <Field label="Linked rent invoice / authorized charge" hint={invoiceHint ?? "Required for the final rental period. Duplicate application is blocked."}>
          <select className="select" name="invoiceId" defaultValue={invoices[0]?.id ?? ""}>
            <option value="">No linked invoice</option>
            {invoices.map((invoice) => (
              <option key={invoice.id} value={invoice.id}>
                {invoice.reference} · {invoice.periodLabel} · {formatCurrency(invoice.amountCents)} · {invoice.status}
              </option>
            ))}
          </select>
        </Field>
        <Field label={approvalRequired ? "Approval reference (required by rule)" : "Approval reference (optional)"}>
          <input className="input" name="approvalRef" placeholder="e.g. APR-2026-0031" required={approvalRequired} />
        </Field>
        <Field label="Supporting document">
          <input className="input" name="documentRef" placeholder="e.g. Final period invoice / inspection report" />
        </Field>
      </div>
      <Field label="Reason and notes">
        <textarea className="textarea" name="notes" placeholder="Describe why the application is permitted and which obligation it settles." />
      </Field>
      <div className="callout callout-info">
        Accounting preview: Debit {deposit.liabilityAccount} / Credit {deposit.receivableAccount}. Remaining held balance after posting:{" "}
        {formatCurrency(Math.max(0, deposit.outstandingCents - Math.min(deposit.outstandingCents, deposit.oneMonthRentCents)))}.
      </div>
    </ActionDialog>
  );
}

export function RefundRequestDialog({
  deposit,
  maxPrincipalCents,
  maxInterestCents,
  canRequest,
  blockedReason,
  devicesSummary,
}: {
  deposit: { id: string; reference: string; tenantName: string; status: string };
  maxPrincipalCents: number;
  maxInterestCents: number;
  canRequest: boolean;
  blockedReason?: string | null;
  devicesSummary?: string;
}) {
  return (
    <ActionDialog
      label="Request refund"
      title={`Request refund — ${deposit.reference}`}
      description="Refund eligibility is validated against the effective rule, lease status and device returns. Approval requirements are applied automatically."
      action={requestRefundAction}
      submitLabel="Submit refund request"
      tone="primary"
      size="md"
      disabledReason={!canRequest ? blockedReason ?? "Your role cannot request refunds." : blockedReason ?? null}
    >
      <input type="hidden" name="depositId" value={deposit.id} />
      {devicesSummary && <div className="callout callout-info">{devicesSummary}</div>}
      <div className="grid-2-even" style={{ gap: 10 }}>
        <Field label={`Principal to refund (max ${formatCurrency(maxPrincipalCents)})`}>
          <input className="input" name="principalAmount" inputMode="decimal" defaultValue={(maxPrincipalCents / 100).toFixed(2)} />
        </Field>
        <Field label={`Interest to refund (outstanding ${formatCurrency(maxInterestCents)})`}>
          <input className="input" name="interestAmount" inputMode="decimal" defaultValue={(maxInterestCents / 100).toFixed(2)} />
        </Field>
        <Field label="Refund method">
          <select className="select" name="method" defaultValue="eft">
            {methods.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </Field>
        <Field label="Requested date">
          <input className="input" type="date" name="requestedAt" defaultValue={todayISO()} required />
        </Field>
        <Field label="Refund due date">
          <input className="input" type="date" name="dueDate" />
        </Field>
        <Field label="Supporting document">
          <input className="input" name="documentRef" placeholder="e.g. Condition report, device return form" />
        </Field>
      </div>
      <Field label="Reason / notes">
        <textarea className="textarea" name="notes" placeholder="Document the refund basis and any retained replacement cost." />
      </Field>
    </ActionDialog>
  );
}

export function RefundDecisionDialog({
  refund,
  canApprove,
  isRequester,
}: {
  refund: { id: string; reference: string; requested: number; requester: string };
  canApprove: boolean;
  isRequester: boolean;
}) {
  return (
    <ActionDialog
      label="Review"
      title={`Approve or reject ${refund.reference}`}
      description={`Requested by ${refund.requester} for ${formatCurrency(refund.requested)}. Available balances are re-validated at approval time.`}
      action={decideRefundAction}
      submitLabel="Record decision"
      tone="primary"
      size="md"
      disabledReason={!canApprove ? "Your role cannot approve refunds." : isRequester ? "Segregation of duties: the requester cannot approve this refund." : null}
    >
      <input type="hidden" name="refundId" value={refund.id} />
      <Field label="Decision">
        <select className="select" name="decision" defaultValue="approve">
          <option value="approve">Approve refund</option>
          <option value="reject">Reject refund</option>
        </select>
      </Field>
      <Field label="Reason / approval reference" hint="Required when rejecting. Recorded in the audit trail.">
        <textarea className="textarea" name="reason" placeholder="e.g. Approved after move-out inspection; inspection report attached." />
      </Field>
      <div className="callout callout-warning">
        Approval does not move money. A separate payment-processing step is required, and the refund cannot be completed without it.
      </div>
    </ActionDialog>
  );
}

export function RefundProcessDialog({
  refund,
  canProcess,
  blockedReason,
}: {
  refund: { id: string; reference: string; principal: number; interest: number; dueDate: string | null };
  canProcess: boolean;
  blockedReason?: string | null;
}) {
  return (
    <ActionDialog
      label="Process refund"
      title={`Process refund ${refund.reference}`}
      description={`Release ${formatCurrency(refund.principal + refund.interest)} (${formatCurrency(refund.principal)} principal + ${formatCurrency(refund.interest)} interest).`}
      action={processRefundAction}
      submitLabel="Process simulated refund"
      tone="success"
      size="md"
      disabledReason={!canProcess ? blockedReason ?? "Your role cannot process refunds." : blockedReason ?? null}
      successHint="A refund receipt is available from the refund register."
    >
      <input type="hidden" name="refundId" value={refund.id} />
      <div className="grid-2-even" style={{ gap: 10 }}>
        <Field label="Completed date">
          <input className="input" type="date" name="completedDate" defaultValue={todayISO()} required />
        </Field>
        <Field label="Method">
          <select className="select" name="method" defaultValue="eft">
            {methods.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </Field>
        <Field label="Payment reference" hint="Duplicate references are blocked.">
          <input className="input" name="paymentReference" placeholder="e.g. EFT-OUT-99213" />
        </Field>
      </div>
      <Field label="Notes">
        <textarea className="textarea" name="notes" placeholder="Payment confirmation details. Simulated — no real transfer." />
      </Field>
      <div className="callout callout-info">
        Accounting preview: Debit deposit liability (and interest payable where applicable) / Credit bank. The refund cannot be marked complete before this simulated payment step.
      </div>
    </ActionDialog>
  );
}

export function AccrueInterestDialog({
  deposit,
  periodStart,
  periodEnd,
  calculatedCents,
  canPost,
  blockedReason,
  segments,
}: {
  deposit: { id: string; reference: string };
  periodStart: string;
  periodEnd: string;
  calculatedCents: number;
  canPost: boolean;
  blockedReason?: string | null;
  segments: { start: string; end: string; days: number; eligiblePrincipalCents: number; annualRateBps: number; interestCents: number }[];
}) {
  return (
    <ActionDialog
      label="Preview & post"
      title={`Interest accrual — ${deposit.reference}`}
      description="Review the effective-dated calculation before posting. Opening the register never posts interest automatically."
      action={postInterestAccrualAction}
      submitLabel="Post interest accrual"
      tone="primary"
      size="md"
      disabledReason={!canPost ? blockedReason ?? "Your role cannot process interest." : blockedReason ?? null}
    >
      <input type="hidden" name="depositId" value={deposit.id} />
      <div className="grid-2-even" style={{ gap: 10 }}>
        <Field label="Period start">
          <input className="input" type="date" name="periodStart" defaultValue={periodStart} required />
        </Field>
        <Field label="Period end">
          <input className="input" type="date" name="periodEnd" defaultValue={periodEnd} required />
        </Field>
      </div>
      <div className="table-wrap" style={{ border: "1px solid var(--dp-line)", borderRadius: 10 }}>
        <table className="data">
          <thead>
            <tr>
              <th>Segment</th>
              <th className="num">Days</th>
              <th className="num">Eligible principal</th>
              <th className="num">Annual rate</th>
              <th className="num">Interest</th>
            </tr>
          </thead>
          <tbody>
            {segments.length === 0 && (
              <tr><td colSpan={5} className="muted">No eligible segments — check the period and interest rate history.</td></tr>
            )}
            {segments.map((segment) => (
              <tr key={`${segment.start}-${segment.annualRateBps}`}>
                <td>{formatDate(segment.start)} → {formatDate(segment.end)}</td>
                <td className="num">{segment.days}</td>
                <td className="num">{formatCurrency(segment.eligiblePrincipalCents)}</td>
                <td className="num">{(segment.annualRateBps / 100).toFixed(2)}%</td>
                <td className="num">{formatCurrency(segment.interestCents)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4}>Calculated interest (actual/365, half-up rounding)</td>
              <td className="num">{formatCurrency(calculatedCents)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="callout callout-warning">
        Posting is a controlled financial action: Debit 6100 interest expense / Credit 2310 interest payable. The same period cannot be accrued twice.
      </div>
    </ActionDialog>
  );
}

export function SettleInterestDialog({
  deposit,
  outstandingCents,
  invoices,
  canPost,
  blockedReason,
}: {
  deposit: { id: string; reference: string };
  outstandingCents: number;
  invoices: { id: string; reference: string; periodLabel: string; amountCents: number }[];
  canPost: boolean;
  blockedReason?: string | null;
}) {
  return (
    <ActionDialog
      label="Pay or credit interest"
      title={`Settle interest — ${deposit.reference}`}
      description={`Posted interest outstanding: ${formatCurrency(outstandingCents)}. Pay it out or credit it against an open rent invoice.`}
      action={settleInterestAction}
      submitLabel="Post interest settlement"
      tone="primary"
      size="md"
      disabledReason={!canPost ? blockedReason ?? "Your role cannot process interest." : blockedReason ?? null}
    >
      <input type="hidden" name="depositId" value={deposit.id} />
      <div className="grid-2-even" style={{ gap: 10 }}>
        <Field label="Amount">
          <input className="input" name="amount" inputMode="decimal" defaultValue={(outstandingCents / 100).toFixed(2)} required />
        </Field>
        <Field label="Settlement method">
          <select className="select" name="mode" defaultValue="payment">
            <option value="payment">Pay to tenant (simulated)</option>
            <option value="credit">Credit against an open rent invoice</option>
          </select>
        </Field>
        <Field label="Rent invoice (for credits)">
          <select className="select" name="invoiceId" defaultValue={invoices[0]?.id ?? ""}>
            <option value="">No invoice</option>
            {invoices.map((invoice) => (
              <option key={invoice.id} value={invoice.id}>
                {invoice.reference} · {invoice.periodLabel} · {formatCurrency(invoice.amountCents)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Date">
          <input className="input" type="date" name="date" defaultValue={todayISO()} required />
        </Field>
        <Field label="Method">
          <select className="select" name="method" defaultValue="eft">
            {methods.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Notes">
        <textarea className="textarea" name="notes" placeholder="e.g. Interest credited against the 2026 rent increase." />
      </Field>
    </ActionDialog>
  );
}

export function KeyDeviceDialog({
  device,
  canUpdate,
}: {
  device: { id: string; identifier: string; issued: number; returned: number; condition: string | null; replacementCostCents: number };
  canUpdate: boolean;
}) {
  return (
    <ActionDialog
      label="Record return"
      title={`Device return — ${device.identifier}`}
      description={`Issued ${device.issued}, returned ${device.returned}. Replacement cost basis ${formatCurrency(device.replacementCostCents)} per device.`}
      action={updateKeyDeviceAction}
      submitLabel="Save return"
      tone="secondary"
      disabledReason={!canUpdate ? "Your role cannot update device returns." : null}
    >
      <input type="hidden" name="deviceId" value={device.id} />
      <div className="grid-2-even" style={{ gap: 10 }}>
        <Field label="Quantity returned" hint={`Maximum ${device.issued}`}>
          <input className="input" name="quantityReturned" type="number" min={device.returned} max={device.issued} defaultValue={device.issued} required />
        </Field>
        <Field label="Return date">
          <input className="input" type="date" name="returnDate" defaultValue={todayISO()} required />
        </Field>
        <Field label="Condition">
          <select className="select" name="returnCondition" defaultValue={device.condition ?? "good"}>
            <option value="good">Good — refundable</option>
            <option value="worn">Worn — refundable</option>
            <option value="damaged">Damaged — document replacement</option>
            <option value="not_returned">Not returned</option>
          </select>
        </Field>
      </div>
      <Field label="Notes">
        <textarea className="textarea" name="notes" placeholder="Document condition and any replacement cost approval. A missing device does not automatically authorize retaining the whole deposit." />
      </Field>
    </ActionDialog>
  );
}

export function ReconcileDepositDialog({
  deposit,
  canReconcile,
}: {
  deposit: { id: string; reference: string; current: string };
  canReconcile: boolean;
}) {
  return (
    <ActionDialog
      label="Reconcile"
      title={`Reconciliation review — ${deposit.reference}`}
      description="Record the review outcome. Reconciliation never forces the accounting balance to match the subledger."
      action={reconcileDepositAction}
      submitLabel="Save review"
      tone="secondary"
      disabledReason={!canReconcile ? "Your role cannot reconcile deposits." : null}
    >
      <input type="hidden" name="depositId" value={deposit.id} />
      <Field label="Reconciliation status">
        <select className="select" name="status" defaultValue={deposit.current === "not_reviewed" ? "under_review" : deposit.current}>
          <option value="under_review">Under review</option>
          <option value="reconciled">Reconciled — no differences</option>
          <option value="exception">Exception — difference unresolved</option>
          <option value="not_reviewed">Reset to not reviewed</option>
        </select>
      </Field>
      <Field label="Reviewer notes">
        <textarea className="textarea" name="notes" placeholder="Explain differences and their resolution." />
      </Field>
    </ActionDialog>
  );
}

export function ReconItemDialog({
  item,
  canManage,
}: {
  item: { id: string; reference: string; current: string };
  canManage: boolean;
}) {
  return (
    <ActionDialog
      label="Update"
      title={`Discrepancy ${item.reference}`}
      description="Mark the item as under review, resolved, or requiring correction. Notes are required to resolve."
      action={updateReconciliationItemAction}
      submitLabel="Save discrepancy"
      tone="secondary"
      disabledReason={!canManage ? "Your role cannot manage reconciliation exceptions." : null}
    >
      <input type="hidden" name="itemId" value={item.id} />
      <Field label="Status">
        <select className="select" name="status" defaultValue={item.current === "open" ? "under_review" : item.current}>
          <option value="open">Open</option>
          <option value="under_review">Under review</option>
          <option value="correction_required">Requires correction</option>
          <option value="resolved">Resolved</option>
        </select>
      </Field>
      <Field label="Resolution notes">
        <textarea className="textarea" name="resolutionNotes" placeholder="Document the investigation and outcome." />
      </Field>
    </ActionDialog>
  );
}

export function ReverseTransactionDialog({
  txn,
  canReverse,
}: {
  txn: { id: string; reference: string; type: string; amountCents: number };
  canReverse: boolean;
}) {
  return (
    <ActionDialog
      label="Reverse"
      title={`Controlled reversal — ${txn.reference}`}
      description={`Posts an equal and opposite ledger entry with a reversing journal. The original ${formatCurrency(txn.amountCents)} transaction stays immutable.`}
      action={reverseTransactionAction}
      submitLabel="Post reversal"
      tone="danger"
      disabledReason={!canReverse ? "Your role cannot post reversals." : null}
    >
      <input type="hidden" name="txnId" value={txn.id} />
      <Field label="Reason for reversal" hint="Required. Recorded in the audit trail with your user and timestamp.">
        <textarea className="textarea" name="reason" required placeholder="e.g. Collection posted to the wrong lease; reversed and re-recorded." />
      </Field>
    </ActionDialog>
  );
}

export function CloseDepositDialog({ deposit, canClose }: { deposit: { id: string; reference: string }; canClose: boolean }) {
  return (
    <ActionDialog
      label="Close deposit"
      title={`Close ${deposit.reference}`}
      description="A deposit can only be closed when principal and interest obligations are fully settled and no refund is open."
      action={closeDepositAction}
      submitLabel="Close deposit"
      tone="secondary"
      disabledReason={!canClose ? "Your role cannot close deposits." : null}
    >
      <input type="hidden" name="depositId" value={deposit.id} />
      <Field label="Closing notes">
        <textarea className="textarea" name="reason" placeholder="e.g. Final rental period settled; obligations complete." />
      </Field>
    </ActionDialog>
  );
}

export function CancelDepositDialog({ deposit, canCancel }: { deposit: { id: string; reference: string }; canCancel: boolean }) {
  return (
    <ActionDialog
      label="Cancel"
      title={`Cancel ${deposit.reference}`}
      description="Cancellation is only permitted before any finalized collection. Existing ledger entries are never deleted."
      action={cancelDepositAction}
      submitLabel="Cancel deposit"
      tone="danger"
      disabledReason={!canCancel ? "Your role cannot cancel deposits." : null}
    >
      <input type="hidden" name="depositId" value={deposit.id} />
      <Field label="Cancellation reason" hint="Required and recorded in the audit trail.">
        <textarea className="textarea" name="reason" required placeholder="e.g. Lease addendum removed the prepaid rent requirement." />
      </Field>
    </ActionDialog>
  );
}

export function EditDraftDialog({
  deposit,
  accounts,
  canEdit,
}: {
  deposit: { id: string; reference: string; requiredCents: number; expectedDate: string; liabilityAccount: string; cashAccount: string };
  accounts: { code: string; name: string; type: string }[];
  canEdit: boolean;
}) {
  return (
    <ActionDialog
      label="Edit draft"
      title={`Edit draft ${deposit.reference}`}
      description="Draft or expected deposits can be edited before any collection. Finalized records are immutable."
      action={updateDraftDepositAction}
      submitLabel="Save draft"
      tone="secondary"
      disabledReason={!canEdit ? "Your role cannot edit draft deposits." : null}
    >
      <input type="hidden" name="depositId" value={deposit.id} />
      <div className="grid-2-even" style={{ gap: 10 }}>
        <Field label="Required amount">
          <input className="input" name="requiredAmount" inputMode="decimal" defaultValue={(deposit.requiredCents / 100).toFixed(2)} required />
        </Field>
        <Field label="Expected date">
          <input className="input" type="date" name="expectedDate" defaultValue={deposit.expectedDate} required />
        </Field>
        <Field label="Liability account">
          <select className="select" name="liabilityAccountCode" defaultValue={deposit.liabilityAccount}>
            {accounts.filter((a) => a.type === "liability").map((account) => (
              <option key={account.code} value={account.code}>{account.code} · {account.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Bank / cash account">
          <select className="select" name="cashAccountCode" defaultValue={deposit.cashAccount}>
            {accounts.filter((a) => a.type === "asset").map((account) => (
              <option key={account.code} value={account.code}>{account.code} · {account.name}</option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Notes">
        <textarea className="textarea" name="notes" />
      </Field>
    </ActionDialog>
  );
}

export function PrintButton({ label = "Print / save PDF" }: { label?: string }) {
  return (
    <button type="button" className="btn btn-sm" onClick={() => window.print()}>
      {label}
    </button>
  );
}
