import { CreditCard, Landmark, ReceiptText, Wallet } from "lucide-react";
import { Button } from "@inv/components/ui/Button";
import { formatCAD, formatDate } from "@inv/lib/format";
import { invoiceBalance, invoiceTotal, type Invoice, type Payment } from "@inv/types/invoice";

const methodIcon: Record<Payment["method"], React.ReactNode> = {
  "Bank Transfer": <Landmark className="size-3.5" />,
  "Credit Card": <CreditCard className="size-3.5" />,
  "E-Transfer": <Wallet className="size-3.5" />,
  Cheque: <ReceiptText className="size-3.5" />,
  Cash: <Wallet className="size-3.5" />,
  "Pre-Authorized Debit": <Landmark className="size-3.5" />,
};

interface PaymentHistoryProps {
  invoice: Invoice;
  onRecordPayment: () => void;
}

export function PaymentHistory({ invoice, onRecordPayment }: PaymentHistoryProps) {
  const total = invoiceTotal(invoice);
  const balance = invoiceBalance(invoice);
  const paid = total - balance;
  const locked = invoice.status === "void";
  const settled = balance <= 0.004;

  return (
    <section
      aria-label="Payment history"
      className="overflow-hidden rounded-xl border border-line bg-surface"
    >
      <header className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
        <CreditCard className="size-4 text-ink-faint" />
        <h2 className="text-[14px] font-semibold text-ink">Payment history</h2>
        <span className="text-[11.5px] text-ink-faint tabular-nums">
          {invoice.payments.length} {invoice.payments.length === 1 ? "entry" : "entries"} recorded
        </span>
        <Button
          size="sm"
          variant="subtle"
          className="ml-auto"
          onClick={onRecordPayment}
          disabled={locked || settled || invoice.status === "draft" || invoice.status === "pending_approval"}
        >
          <Wallet className="size-3.5" />
          Record payment
        </Button>
      </header>

      {invoice.payments.length === 0 ? (
        <div className="px-4 py-10 text-center">
          <div className="mx-auto grid size-10 place-items-center rounded-full border border-line bg-surface-2">
            <Wallet className="size-4 text-ink-faint" />
          </div>
          <p className="mt-3 text-[13.5px] font-medium text-ink">No payments recorded yet</p>
          <p className="mx-auto mt-1 max-w-sm text-[12.5px] leading-relaxed text-ink-muted">
            {locked
              ? "This invoice was voided, so payments can no longer be applied to it."
              : settled
                ? "This invoice is fully settled."
                : `${formatCAD(balance)} is still outstanding. Record a payment to update the balance and status.`}
          </p>
        </div>
      ) : (
        <div className="scrollbar-thin overflow-x-auto">
          <table className="w-full min-w-[680px] border-collapse text-left text-sm">
            <caption className="sr-only">Payments applied to {invoice.id}</caption>
            <thead>
              <tr className="border-b border-line bg-surface-2/60">
                {["Payment date", "Method", "Transaction reference", "Amount paid", "Notes"].map(
                  (h, i) => (
                    <th
                      key={h}
                      scope="col"
                      className={`px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-ink-faint ${
                        i === 3 ? "text-right" : ""
                      }`}
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {invoice.payments.map((p) => (
                <tr key={p.id} className="border-b border-line/70 last:border-0">
                  <td className="whitespace-nowrap px-4 py-3 text-[13px] text-ink tabular-nums">
                    {formatDate(p.date)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 text-[13px] text-ink-muted">
                      <span className="text-ink-faint">{methodIcon[p.method]}</span>
                      {p.method}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-[12px] text-ink-muted">
                    {p.reference}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-[13.5px] font-semibold text-paid tabular-nums">
                    +{formatCAD(p.amount)}
                  </td>
                  <td className="px-4 py-3 text-[12.5px] text-ink-muted">{p.notes ?? "—"}</td>
                </tr>
              ))}
              <tr className="bg-surface-2/40">
                <td colSpan={3} className="px-4 py-3 text-[12.5px] text-ink-muted">
                  Total applied to {invoice.id}
                </td>
                <td className="px-4 py-3 text-right text-[13.5px] font-semibold text-ink tabular-nums">
                  {formatCAD(paid)}
                </td>
                <td className="px-4 py-3 text-right text-[12.5px] text-ink-muted tabular-nums">
                  Balance {formatCAD(balance)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
