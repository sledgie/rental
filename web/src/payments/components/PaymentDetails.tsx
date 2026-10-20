import { useMemo, useState, type ReactNode } from "react";
import type {
  Allocation,
  AuditEvent,
  CreditApplication,
  Invoice,
  InvoiceBalance,
  Lease,
  Payment,
  Property,
  StaffUser,
  Tenant,
  TenantCredit,
  Unit,
} from "../types";
import { fmtCAD, formatDate, formatDateTime, parseToCents, periodLabel } from "../utils/paymentUtils";
import {
  Badge,
  Button,
  Icon,
  inputCls,
  MethodTag,
  Drawer,
  PaymentStatusBadge,
  textareaCls,
} from "./ui";
import { AuditHistory } from "./AuditHistory";
import { cn } from "../utils/cn";

const TONES = ["blue", "violet", "teal", "amber", "rose", "slate"] as const;
const tone = (v: string) => {
  let h = 0;
  for (const ch of v) h = (h * 31 + ch.charCodeAt(0)) % 997;
  return TONES[h % TONES.length];
};
const ini = (name: string) => name.split(/\s+/).filter((w) => /^[A-Za-z0-9]/.test(w)).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

export function PaymentDetails({
  payment,
  tenant,
  lease,
  unit,
  property,
  invoices,
  balances,
  allocations,
  payments,
  credits,
  creditApplications,
  audits,
  users,
  onClose,
  onViewReceipt,
  onPrintReceipt,
  onDownloadReceipt,
  onReverse,
  onRefund,
  onSelectPayment,
}: {
  payment: Payment;
  tenant?: Tenant;
  lease?: Lease;
  unit?: Unit;
  property?: Property;
  invoices: Invoice[];
  balances: Map<string, InvoiceBalance>;
  allocations: Allocation[];
  payments: Payment[];
  credits: TenantCredit[];
  creditApplications: CreditApplication[];
  audits: AuditEvent[];
  users: StaffUser[];
  onClose: () => void;
  onViewReceipt: () => void;
  onPrintReceipt: () => void;
  onDownloadReceipt: () => void;
  onReverse: (reason: string) => void;
  onRefund: (amountCents: number, reason: string) => void;
  onSelectPayment: (paymentId: string) => void;
}) {
  const [confirming, setConfirming] = useState<"reverse" | "refund" | null>(null);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState("");
  const [refundAmountText, setRefundAmountText] = useState((payment.amount / 100).toFixed(2));
  const [refundAmountError, setRefundAmountError] = useState("");

  const invoiceById = useMemo(() => new Map(invoices.map((i) => [i.id, i])), [invoices]);
  const userById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  const paymentAllocations = allocations.filter((a) => a.paymentId === payment.id);
  const reversed = payment.status === "reversed";

  const creditsFromPayment = credits.filter((c) => c.sourcePaymentId === payment.id);
  const creditAppsFromPayment = creditApplications.filter((ca) =>
    creditsFromPayment.some((c) => c.id === ca.creditId),
  );

  const paymentAudits = useMemo(() => {
    const ids = new Set<string>([payment.id, ...(payment.receiptId ? [payment.receiptId] : [])]);
    for (const c of creditsFromPayment) ids.add(c.id);
    return audits.filter((e) => ids.has(e.entityId));
  }, [audits, payment, creditsFromPayment]);

  const related = useMemo(
    () =>
      payments
        .filter((p) => p.tenantId === payment.tenantId && p.id !== payment.id)
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 4),
    [payments, payment],
  );

  const confirm = () => {
    if (reason.trim().length < 5) {
      setReasonError("Please provide a short reason (at least 5 characters) for the audit trail.");
      return;
    }
    if (confirming === "refund") {
      const cents = parseToCents(refundAmountText);
      if (cents === null || cents <= 0) {
        setRefundAmountError("Enter a valid refund amount greater than $0.00.");
        return;
      }
      if (cents > payment.amount) {
        setRefundAmountError(`Refund cannot exceed the payment received (${fmtCAD(payment.amount)}).`);
        return;
      }
      onRefund(cents, reason.trim());
    } else {
      onReverse(reason.trim());
    }
    setConfirming(null);
    setReason("");
    setReasonError("");
  };

  const facts: Array<[string, ReactNode]> = [
    ["Payment ID", <span className="font-mono text-xs">{payment.id}</span>],
    ["Receipt #", <span className="font-mono text-xs">{payment.receiptId ?? "—"}</span>],
    ["Tenant", tenant ? `${tenant.name} (${tenant.number})` : "—"],
    ["Lease", `${lease?.id ?? payment.leaseId} · ${fmtCAD(lease?.monthlyRent ?? 0)}/mo · ${lease?.status ?? ""}`],
    ["Property / Unit", property && unit ? `${property.name} — ${unit.number}` : "—"],
    ["Payment date", formatDate(payment.date)],
    ["Method", <MethodTag method={payment.method} />],
    ["Amount received", <span className="font-display text-base font-semibold tabular-nums">{fmtCAD(payment.amount)}</span>],
    ["Reference", payment.reference ? <span className="font-mono text-xs">{payment.reference}</span> : "—"],
    ["Recorded by", (() => { const u = userById.get(payment.recordedById); return u ? `${u.name} (${u.role})` : payment.recordedById; })()],
    ["Created", formatDateTime(payment.createdAt)],
    ["Notes", payment.notes ?? "—"],
  ];

  return (
    <Drawer
      onClose={onClose}
      labelledBy="pd-title"
      title="Payment record"
      subtitle="Everything about this payment, in one place."
      heading={
        <div className="profile-heading">
          <span className={`avatar avatar-xl avatar-${tone(tenant?.name ?? payment.id)}`} aria-hidden="true">{ini(tenant?.name ?? "?")}</span>
          <div className="profile-identity">
            <h2>{payment.id}</h2>
            <div>
              <span>{tenant?.name ?? "Unknown tenant"} &middot; {formatDate(payment.date)}</span>
              <span className={`status-badge ${payment.status === "reversed" ? "status-terminated" : "status-active"}`}>
                <span className="status-dot" />
                {payment.status === "reversed" ? "Reversed" : "Posted"}
              </span>
              {payment.refund && <span className="status-badge status-expiring"><span className="status-dot" />Refunded {fmtCAD(payment.refund.amount)}</span>}
            </div>
          </div>
        </div>
      }
      footer={(
      <div className="flex flex-wrap items-center justify-between gap-3 py-1">
        <div className="flex flex-wrap items-center gap-2">
          {!reversed && !payment.refund && !confirming && (
            <>
              <Button variant="dangerOutline" size="sm" onClick={() => setConfirming("reverse")}>
                <Icon name="undo" className="h-3.5 w-3.5" />
                Reverse payment…
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setConfirming("refund")}>
                <Icon name="banknote" className="h-3.5 w-3.5" />
                Record refund…
              </Button>
            </>
          )}
          {(reversed || payment.refund) && !confirming && (
            <Badge tone="neutral">Posted transactions are never edited or deleted — history is preserved.</Badge>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={onViewReceipt}>
            <Icon name="eye" className="h-4 w-4" />
            View receipt
          </Button>
          <Button onClick={onPrintReceipt}>
            <Icon name="printer" className="h-4 w-4" />
            Print
          </Button>
          <Button onClick={onDownloadReceipt}>
            <Icon name="chevron-down" className="h-4 w-4" />
            Download
          </Button>
          <Button variant="primary" onClick={onClose}>Close</Button>
        </div>
      </div>
      )}
    >
      <div className="space-y-5 px-1 py-2">
        {reversed && (
          <div className="rounded-lg border border-u-danger/30 bg-u-danger-soft px-4 py-3 text-[13px] text-u-danger" role="alert">
            <p className="flex items-center gap-2 font-semibold">
              <Icon name="undo" className="h-4 w-4 text-u-danger" />
              Reversed{payment.reversedAt ? ` on ${formatDateTime(payment.reversedAt)}` : ""} by{" "}
              {userById.get(payment.reversedById ?? "")?.name ?? payment.reversedById}.
            </p>
            {payment.reversalReason && <p className="mt-1 text-u-danger">Reason: {payment.reversalReason}</p>}
            <p className="mt-1 text-xs text-u-danger">
              The original record is preserved; its allocations no longer count toward invoice balances or collection totals.
            </p>
          </div>
        )}

        {payment.refund && (
          <div className="rounded-lg border border-u-warn/55 bg-u-warn-soft px-4 py-3 text-[13px] text-u-warn" role="alert">
            <p className="flex items-center gap-2 font-semibold">
              <Icon name="banknote" className="h-4 w-4 text-u-warn" />
              {fmtCAD(payment.refund.amount)} refunded on {formatDateTime(payment.refund.at)} by{" "}
              {userById.get(payment.refund.byId)?.name ?? payment.refund.byId}.
            </p>
            <p className="mt-1 text-u-warn">Reason: {payment.refund.reason}</p>
            <p className="mt-1 text-xs text-u-warn">
              A refund returns money; unlike a reversal, the original payment stays posted and still counts toward collections.
            </p>
          </div>
        )}

        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          {facts.map(([k, v]) => (
            <div key={k} className="flex items-baseline justify-between gap-4 border-b border-dashed border-u-line pb-2">
              <dt className="shrink-0 text-u-muted">{k}</dt>
              <dd className="text-right font-medium text-u-ink">{v}</dd>
            </div>
          ))}
        </dl>

        {/* Allocation breakdown */}
        <div>
          <h3 className="text-[11px] font-semibold tracking-wide text-u-muted uppercase">
            Allocation & remaining invoice balances
          </h3>
          <div className="mt-2 overflow-x-auto rounded-lg border border-u-line">
            <table className="w-full min-w-105 text-left text-[13px]">
              <thead>
                <tr className="border-b border-u-line bg-u-s2/70 text-[11px] tracking-wide text-u-muted uppercase">
                  <th className="px-3 py-2 font-semibold">Invoice</th>
                  <th className="px-3 py-2 font-semibold">Rent period</th>
                  <th className="px-3 py-2 text-right font-semibold">Charge</th>
                  <th className={cn("px-3 py-2 text-right font-semibold", reversed && "text-u-danger")}>
                    {reversed ? "Was applied" : "Applied"}
                  </th>
                  <th className="px-3 py-2 text-right font-semibold">Now owing</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-u-line">
                {paymentAllocations.map((a) => {
                  const inv = invoiceById.get(a.invoiceId);
                  const bal = balances.get(a.invoiceId);
                  return (
                    <tr key={a.id}>
                      <td className="px-3 py-2 font-mono text-xs whitespace-nowrap text-u-ink">{a.invoiceId}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-u-ink2">
                        {inv ? periodLabel(inv.periodStart, inv.periodEnd) : "—"}
                      </td>
                      <td className="px-3 py-2 text-right text-u-ink2 tabular-nums">{fmtCAD(bal?.netCharge ?? 0)}</td>
                      <td className={cn("px-3 py-2 text-right font-medium tabular-nums", reversed ? "text-u-danger line-through decoration-u-danger/60" : "text-u-accent")}>
                        {fmtCAD(a.amount)}
                      </td>
                      <td className="px-3 py-2 text-right font-medium text-u-ink tabular-nums">{fmtCAD(bal?.outstanding ?? 0)}</td>
                    </tr>
                  );
                })}
                {paymentAllocations.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-3 text-center text-u-muted">No allocations recorded for this payment.</td>
                  </tr>
                )}
                {creditsFromPayment.map((c) => (
                  <tr key={c.id} className="bg-u-warn-soft/70">
                    <td className="px-3 py-2 font-mono text-xs text-u-warn">{c.id}</td>
                    <td className="px-3 py-2 font-medium text-u-warn" colSpan={2}>Unapplied tenant credit created from this payment</td>
                    <td className={cn("px-3 py-2 text-right font-medium text-u-warn tabular-nums", reversed && "line-through decoration-u-danger/60")}>
                      {fmtCAD(c.originalAmount)}
                    </td>
                    <td className="px-3 py-2 text-right text-[11px] text-u-warn">{reversed ? "invalidated" : "on account"}</td>
                  </tr>
                ))}
                {creditAppsFromPayment.map((ca) => (
                  <tr key={ca.id} className="bg-u-blue-soft/70">
                    <td className="px-3 py-2 font-mono text-xs text-u-blue">{ca.creditId}</td>
                    <td className="px-3 py-2 font-medium text-u-blue" colSpan={2}>Tenant credit applied to {ca.invoiceId}</td>
                    <td className="px-3 py-2 text-right font-medium text-u-blue tabular-nums">{fmtCAD(ca.amount)}</td>
                    <td className="px-3 py-2" />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Audit history */}
        <div>
          <h3 className="text-[11px] font-semibold tracking-wide text-u-muted uppercase">Audit history</h3>
          <div className="mt-3 rounded-lg border border-u-line bg-u-card px-4 py-3.5">
            <AuditHistory events={paymentAudits} users={users} />
          </div>
        </div>

        {/* Related payments */}
        {related.length > 0 && (
          <div>
            <h3 className="text-[11px] font-semibold tracking-wide text-u-muted uppercase">Other payments — {tenant?.name}</h3>
            <ul className="mt-2 divide-y divide-u-line rounded-lg border border-u-line">
              {related.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => onSelectPayment(p.id)}
                    className="flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left text-[13px] transition-colors hover:bg-u-accent-soft/60 focus-visible:bg-u-accent-soft/60 focus-visible:outline-none"
                  >
                    <span className="font-mono text-xs text-u-ink2">{p.id}</span>
                    <span className="text-u-muted tabular-nums">{formatDate(p.date)}</span>
                    <span className={cn("font-display font-semibold tabular-nums", p.status === "reversed" ? "text-u-muted line-through" : "text-u-ink")}>
                      {fmtCAD(p.amount)}
                    </span>
                    <PaymentStatusBadge status={p.status} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Confirmation dialogs */}
        {confirming && (
          <div className="rounded-lg border border-u-danger/30 bg-u-danger-soft/70 px-4 py-3.5" role="alertdialog" aria-label={confirming === "reverse" ? "Confirm reversal" : "Confirm refund"}>
            <p className="flex items-center gap-2 text-sm font-semibold text-u-danger">
              <Icon name="alert" className="h-4 w-4 text-u-danger" />
              {confirming === "reverse" ? "Reverse this payment?" : "Record a refund for this payment?"}
            </p>
            <p className="mt-1 text-[13px] text-u-danger">
              {confirming === "reverse"
                ? `The record stays in the ledger marked as reversed, ${fmtCAD(payment.amount)} stops counting toward collections, invoice balances recalculate, and any credit created by this payment is invalidated.`
                : "A refund returns money to the tenant. The payment stays posted and keeps counting toward collections — use a reversal instead to invalidate it."}
            </p>
            {confirming === "refund" && (
              <>
                <label htmlFor="pd-refund-amount" className="mt-3 block text-xs font-semibold text-u-danger">Refund amount (CAD)</label>
                <input
                  id="pd-refund-amount"
                  type="text"
                  inputMode="decimal"
                  value={refundAmountText}
                  onChange={(e) => { setRefundAmountText(e.target.value); setRefundAmountError(""); }}
                  className={cn(inputCls, "mt-1.5 max-w-40 border-u-danger/30 bg-u-card")}
                  aria-invalid={!!refundAmountError || undefined}
                />
                {refundAmountError && <p className="mt-1 text-xs font-medium text-u-danger">{refundAmountError}</p>}
              </>
            )}
            <label htmlFor="pd-reason" className="mt-3 block text-xs font-semibold text-u-danger">
              Reason <span aria-hidden="true">*</span>
            </label>
            <textarea
              id="pd-reason"
              rows={2}
              value={reason}
              onChange={(e) => { setReason(e.target.value); setReasonError(""); }}
              placeholder={confirming === "reverse" ? "e.g. e-Transfer bounced (NSF), posted in error…" : "e.g. tenant overpaid in error, requested money back…"}
              className={cn(textareaCls, "mt-1.5 border-u-danger/30 bg-u-card focus:border-u-danger/55 focus:ring-u-danger/25")}
              aria-invalid={!!reasonError || undefined}
            />
            {reasonError && <p className="mt-1 text-xs font-medium text-u-danger">{reasonError}</p>}
            <div className="mt-3 flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => { setConfirming(null); setReason(""); setReasonError(""); setRefundAmountError(""); }}>
                Cancel
              </Button>
              <Button size="sm" variant="danger" onClick={confirm}>
                <Icon name={confirming === "reverse" ? "undo" : "banknote"} className="h-3.5 w-3.5" />
                {confirming === "reverse" ? "Confirm reversal" : "Confirm refund"}
              </Button>
            </div>
          </div>
        )}
      </div>

    </Drawer>
  );
}
