import { CalendarClock, CheckCircle2, Wallet } from "lucide-react";
import { InvoiceStatusBadge } from "./InvoiceStatusBadge";
import { dueLabel, formatCAD, formatDate, percent } from "@inv/lib/format";
import { invoiceBalance, invoicePaid, invoiceTotal, type Invoice } from "@inv/types/invoice";
import { cn } from "@inv/utils/cn";

export function InvoiceSummary({ invoice }: { invoice: Invoice }) {
  const total = invoiceTotal(invoice);
  const paid = invoicePaid(invoice);
  const balance = invoiceBalance(invoice);
  const pct = percent(paid, total);
  const settled = balance <= 0.004;

  return (
    <section
      aria-label="Financial summary"
      className="grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2 xl:grid-cols-5"
    >
      <Stat
        label="Invoice total"
        value={formatCAD(total)}
        hint={`${invoice.currency} · ${invoice.lineItems.length} line ${invoice.lineItems.length === 1 ? "item" : "items"}`}
      />
      <Stat
        label="Amount paid"
        value={formatCAD(paid)}
        hint={paid > 0 ? `${invoice.payments.length} payment(s) recorded` : "No payments yet"}
        tone={paid > 0 ? "paid" : undefined}
      />
      <div className="bg-surface p-4 sm:col-span-1">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
          Outstanding balance
        </p>
        <p
          className={cn(
            "mt-1.5 text-[26px] font-semibold leading-none tabular-nums",
            invoice.status === "void"
              ? "text-ink-faint line-through decoration-1"
              : settled
                ? "text-paid"
                : "text-ink"
          )}
        >
          {formatCAD(invoice.status === "void" ? 0 : balance)}
        </p>
        {invoice.status === "void" ? (
          <p className="mt-1.5 text-[11.5px] text-ink-faint">Void invoices carry no balance</p>
        ) : (
          <div className="mt-3">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
              <div
                className={cn("h-full rounded-full", settled ? "bg-paid" : "bg-accent")}
                style={{ width: `${settled ? 100 : pct}%` }}
              />
            </div>
            <p className="mt-1.5 text-[11.5px] text-ink-faint tabular-nums">
              {settled ? "Fully settled" : `${pct}% collected`}
            </p>
          </div>
        )}
      </div>
      <Stat
        label="Due date"
        value={formatDate(invoice.dueDate)}
        hint={invoice.status === "void" ? "Voided" : dueLabel(invoice.dueDate)}
        icon={<CalendarClock className="size-3.5" />}
        tone={
          !settled && invoice.status !== "void" && dueLabel(invoice.dueDate).includes("late")
            ? "overdue"
            : undefined
        }
      />
      <div className="bg-surface p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
          Payment status
        </p>
        <div className="mt-2">
          <InvoiceStatusBadge status={invoice.status} />
        </div>
        <p className="mt-2.5 flex items-center gap-1.5 text-[11.5px] text-ink-faint">
          {settled && invoice.status !== "void" ? (
            <>
              <CheckCircle2 className="size-3.5 text-paid" /> Nothing outstanding
            </>
          ) : (
            <>
              <Wallet className="size-3.5" />
              {invoice.status === "void" ? "No collection expected" : "Awaiting collection"}
            </>
          )}
        </p>
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  hint,
  icon,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: React.ReactNode;
  tone?: "paid" | "overdue";
}) {
  return (
    <div className="bg-surface p-4">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
        {icon}
        {label}
      </p>
      <p
        className={cn(
          "mt-1.5 text-[19px] font-semibold leading-tight tabular-nums",
          tone === "paid" ? "text-paid" : tone === "overdue" ? "text-overdue" : "text-ink"
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 text-[11.5px] text-ink-faint">{hint}</p> : null}
    </div>
  );
}
