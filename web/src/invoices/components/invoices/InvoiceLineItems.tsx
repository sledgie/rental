import { BadgePercent, ReceiptText } from "lucide-react";
import { formatCAD } from "@inv/lib/format";
import {
  invoiceSubtotal,
  invoiceTaxTotal,
  invoiceTotal,
  lineItemSubtotal,
  lineItemTax,
  lineItemTotal,
  type Invoice,
} from "@inv/types/invoice";
import { cn } from "@inv/utils/cn";

const categoryStyles: Record<string, string> = {
  Rent: "border-accent/25 bg-accent-soft text-brand-ink",
  Utilities: "border-info/25 bg-info/10 text-info-ink",
  Maintenance: "border-unpaid/25 bg-unpaid/10 text-unpaid",
  Parking: "border-line-strong bg-surface-3 text-ink-muted",
  Storage: "border-line-strong bg-surface-3 text-ink-muted",
  Fees: "border-line-strong bg-surface-3 text-ink-muted",
  Other: "border-line-strong bg-surface-3 text-ink-muted",
};

export function InvoiceLineItems({ invoice }: { invoice: Invoice }) {
  const subtotal = invoiceSubtotal(invoice);
  const tax = invoiceTaxTotal(invoice);
  const total = invoiceTotal(invoice);

  return (
    <section
      aria-label="Invoice breakdown"
      className="overflow-hidden rounded-xl border border-line bg-surface"
    >
      <header className="flex items-center gap-2 border-b border-line px-4 py-3">
        <ReceiptText className="size-4 text-ink-faint" />
        <h2 className="text-[14px] font-semibold text-ink">Invoice breakdown</h2>
        <span className="ml-auto text-[11.5px] text-ink-faint">
          {invoice.lineItems.length} line {invoice.lineItems.length === 1 ? "item" : "items"} · all
          amounts in CAD
        </span>
      </header>

      <div className="scrollbar-thin overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-line bg-surface-2/60">
              {["Description", "Category", "Quantity", "Unit price", "Tax", "Line total"].map(
                (h, i) => (
                  <th
                    key={h}
                    scope="col"
                    className={cn(
                      "px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-ink-faint",
                      i >= 2 && "text-right",
                      i === 0 && "w-[38%]"
                    )}
                  >
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {invoice.lineItems.map((item) => (
              <tr key={item.id} className="border-b border-line/70 last:border-0">
                <td className="px-4 py-3 text-[13.5px] text-ink">{item.description}</td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      "inline-flex rounded border px-1.5 py-0.5 text-[11px] font-medium",
                      categoryStyles[item.category] ?? categoryStyles.Other
                    )}
                  >
                    {item.category}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-[13px] text-ink-muted tabular-nums">
                  {item.quantity}
                </td>
                <td className="px-4 py-3 text-right text-[13px] text-ink-muted tabular-nums">
                  {formatCAD(item.unitPrice)}
                </td>
                <td className="px-4 py-3 text-right text-[13px] text-ink-muted tabular-nums">
                  {item.taxRate === 0 ? "Exempt" : `${item.taxRate}%`}
                  <span className="mt-0.5 block text-[11px] text-ink-faint tabular-nums">
                    {formatCAD(lineItemTax(item))}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-[13.5px] font-medium text-ink tabular-nums">
                  {formatCAD(lineItemTotal(item))}
                  <span className="mt-0.5 block text-[11px] font-normal text-ink-faint tabular-nums">
                    {formatCAD(lineItemSubtotal(item))} + tax
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end border-t border-line bg-surface-2/40 px-4 py-3">
        <dl className="w-full max-w-sm space-y-2 text-[13px]">
          <div className="flex items-center justify-between">
            <dt className="text-ink-muted">Subtotal</dt>
            <dd className="tabular-nums text-ink">{formatCAD(subtotal)}</dd>
          </div>
          {invoice.discount > 0 ? (
            <div className="flex items-center justify-between text-paid">
              <dt className="flex items-center gap-1.5">
                <BadgePercent className="size-3.5" /> Discounts & credits
              </dt>
              <dd className="tabular-nums">−{formatCAD(invoice.discount)}</dd>
            </div>
          ) : null}
          <div className="flex items-center justify-between">
            <dt className="text-ink-muted">Tax total</dt>
            <dd className="tabular-nums text-ink">{formatCAD(tax)}</dd>
          </div>
          <div className="flex items-center justify-between border-t border-line pt-2.5">
            <dt className="text-[13.5px] font-semibold text-ink">Invoice total</dt>
            <dd className="text-[16px] font-semibold tabular-nums text-ink">
              {formatCAD(total)}{" "}
              <span className="text-[11.5px] font-normal text-ink-faint">CAD</span>
            </dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
