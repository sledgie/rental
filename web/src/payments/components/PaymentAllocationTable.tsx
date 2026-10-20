import type { Invoice, InvoiceBalance } from "../types";
import { fmtCAD, formatDate, parseToCents, sumCents } from "../utils/paymentUtils";
import { Icon, InvoiceStatusBadge } from "./ui";
import { cn } from "../utils/cn";

/**
 * Multi-invoice allocation interface.
 * Desktop: wide table. Mobile: stacked invoice cards. Same fields either way.
 */
export function PaymentAllocationTable({
  invoices,
  balances,
  selectedIds,
  onToggle,
  onToggleAll,
  applyAmounts,
  onApplyAmount,
}: {
  invoices: Invoice[];
  balances: Map<string, InvoiceBalance>;
  selectedIds: string[];
  onToggle: (invoiceId: string) => void;
  onToggleAll: (select: boolean) => void;
  applyAmounts: Record<string, string>;
  onApplyAmount: (invoiceId: string, text: string) => void;
}) {
  const allSelected = invoices.length > 0 && selectedIds.length === invoices.length;

  const balanceAfter = (inv: Invoice): number => {
    const bal = balances.get(inv.id);
    const applied = parseToCents(applyAmounts[inv.id] ?? "") ?? 0;
    return Math.max(0, (bal?.outstanding ?? 0) - applied);
  };

  const rowError = (inv: Invoice): string | undefined => {
    const raw = applyAmounts[inv.id] ?? "";
    if (raw === "") return undefined;
    const bal = balances.get(inv.id);
    const cents = parseToCents(raw);
    if (cents === null) return "Invalid amount";
    if (cents < 0) return "Cannot be negative";
    if (bal && cents > bal.outstanding) return `Max ${fmtCAD(bal.outstanding)}`;
    return undefined;
  };

  const amountInput = (inv: Invoice, compact?: boolean) => {
    const err = rowError(inv);
    return (
      <div className={cn("relative", compact ? "w-28" : "w-30")}>
        <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-xs text-u-muted">$</span>
        <input
          type="number"
          min="0"
          step="0.01"
          inputMode="decimal"
          placeholder="0.00"
          aria-label={`Amount to apply to invoice ${inv.id}`}
          aria-invalid={!!err || undefined}
          value={applyAmounts[inv.id] ?? ""}
          onChange={(e) => onApplyAmount(inv.id, e.target.value)}
          className={cn(
            "h-8.5 w-full rounded-md border bg-u-card pr-2 pl-6 text-right text-[13px] font-medium tabular-nums shadow-xs transition-colors",
            "focus:outline-none focus:ring-2",
            err
              ? "border-u-danger/55 text-u-danger focus:border-u-danger/55 focus:ring-u-danger/25"
              : "border-u-line text-u-ink hover:border-u-line2 focus:border-u-accent focus:ring-u-accent/25",
          )}
        />
        {err && (
          <p className="absolute top-full left-0 mt-0.5 text-[10px] font-medium whitespace-nowrap text-u-danger">{err}</p>
        )}
      </div>
    );
  };

  return (
    <div>
      {/* Desktop / tablet table */}
      <div className="hidden overflow-x-auto rounded-lg border border-u-line bg-u-card md:block">
        <table className="w-full min-w-[860px] border-collapse text-left text-[13px]">
          <thead>
            <tr className="border-b border-u-line bg-u-s2/70 text-[11px] tracking-wide text-u-muted uppercase">
              <th className="px-3 py-2.5">
                <input
                  type="checkbox"
                  aria-label="Select all outstanding invoices"
                  className="h-4 w-4 accent-u-accent"
                  checked={allSelected}
                  onChange={(e) => onToggleAll(e.target.checked)}
                />
              </th>
              <th className="px-3 py-2.5 font-semibold">Invoice #</th>
              <th className="px-3 py-2.5 font-semibold">Rent period</th>
              <th className="px-3 py-2.5 font-semibold">Due date</th>
              <th className="px-3 py-2.5 text-right font-semibold">Original</th>
              <th className="px-3 py-2.5 text-right font-semibold">Previously paid</th>
              <th className="px-3 py-2.5 text-right font-semibold">Outstanding</th>
              <th className="px-3 py-2.5 text-right font-semibold">Amount to apply</th>
              <th className="px-3 py-2.5 text-right font-semibold">Balance after</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-u-line">
            {invoices.map((inv) => {
              const bal = balances.get(inv.id);
              const selected = selectedIds.includes(inv.id);
              const applied = parseToCents(applyAmounts[inv.id] ?? "") ?? 0;
              return (
                <tr key={inv.id} className={cn("transition-colors", selected ? "bg-u-accent-soft/70" : "hover:bg-u-s2/60")}>
                  <td className="px-3 py-2.5">
                    <input
                      type="checkbox"
                      aria-label={`Select invoice ${inv.id}`}
                      className="h-4 w-4 accent-u-accent"
                      checked={selected}
                      onChange={() => onToggle(inv.id)}
                    />
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs whitespace-nowrap">
                    <span className="font-semibold text-u-ink">{inv.id}</span>
                    {inv.adjustments.length > 0 && (
                      <span
                        title={inv.adjustments.map((a) => `${a.label}: ${a.amount < 0 ? "−" : ""}${fmtCAD(Math.abs(a.amount))}`).join("\n")}
                        className="ml-1.5 cursor-help rounded bg-u-warn-soft px-1 py-0.5 text-[10px] font-semibold text-u-warn"
                      >
                        adj
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <span className="font-medium text-u-ink">
                      {new Date(`${inv.periodStart}T00:00:00`).toLocaleDateString("en-CA", { month: "long", year: "numeric" })}
                    </span>
                    {bal?.overdue && <span className="ml-1.5 text-[11px] font-semibold text-u-danger">overdue</span>}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-u-ink2 tabular-nums">{formatDate(inv.dueDate)}</td>
                  <td className="px-3 py-2.5 text-right text-u-ink2 tabular-nums">{fmtCAD(bal?.netCharge ?? inv.originalAmount)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {(bal?.paid ?? 0) > 0 ? <span className="text-u-accent">{fmtCAD(bal?.paid ?? 0)}</span> : <span className="text-u-muted">—</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right font-semibold text-u-ink tabular-nums">{fmtCAD(bal?.outstanding ?? 0)}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex justify-end">{amountInput(inv)}</div>
                  </td>
                  <td className={cn("px-3 py-2.5 text-right font-medium tabular-nums", applied > 0 ? "text-u-accent" : "text-u-muted")}>
                    {fmtCAD(balanceAfter(inv))}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-u-line bg-u-s2/70">
              <td colSpan={6} className="px-3 py-2.5 text-[11px] font-semibold tracking-wide text-u-muted uppercase">
                Selected totals
              </td>
              <td className="px-3 py-2.5 text-right font-display font-semibold text-u-ink tabular-nums">
                {fmtCAD(sumCents(invoices.filter((i) => selectedIds.includes(i.id)).map((i) => balances.get(i.id)?.outstanding ?? 0)))}
              </td>
              <td className="px-3 py-2.5 text-right font-display font-semibold text-u-accent tabular-nums">
                {fmtCAD(sumCents(invoices.map((i) => parseToCents(applyAmounts[i.id] ?? "") ?? 0)))}
              </td>
              <td className="px-3 py-2.5 text-right font-display font-semibold text-u-ink tabular-nums">
                {fmtCAD(sumCents(invoices.filter((i) => selectedIds.includes(i.id)).map(balanceAfter)))}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Mobile stacked cards */}
      <ul className="space-y-2.5 md:hidden">
        {invoices.map((inv) => {
          const bal = balances.get(inv.id);
          const selected = selectedIds.includes(inv.id);
          const applied = parseToCents(applyAmounts[inv.id] ?? "") ?? 0;
          return (
            <li
              key={inv.id}
              className={cn(
                "rounded-lg border bg-u-card p-3.5 transition-colors",
                selected ? "border-u-accent/50 bg-u-accent-soft/60 ring-1 ring-u-accent/30" : "border-u-line",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <label className="flex flex-1 cursor-pointer items-start gap-2.5">
                  <input
                    type="checkbox"
                    aria-label={`Select invoice ${inv.id}`}
                    className="mt-0.5 h-4 w-4 accent-u-accent"
                    checked={selected}
                    onChange={() => onToggle(inv.id)}
                  />
                  <span>
                    <span className="flex items-center gap-2 font-mono text-xs font-semibold text-u-ink">
                      {inv.id}
                      <InvoiceStatusBadge status={bal?.status ?? "open"} />
                    </span>
                    <span className="mt-0.5 block text-[13px] font-medium text-u-ink">
                      {new Date(`${inv.periodStart}T00:00:00`).toLocaleDateString("en-CA", { month: "long", year: "numeric" })}
                    </span>
                    <span className="block text-xs text-u-muted">Due {formatDate(inv.dueDate)}</span>
                  </span>
                </label>
                {amountInput(inv, true)}
              </div>
              <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-dashed border-u-line pt-2.5 text-center">
                {[
                  ["Original", fmtCAD(bal?.netCharge ?? inv.originalAmount), "text-u-ink2"],
                  ["Paid so far", fmtCAD(bal?.paid ?? 0), "text-u-accent"],
                  ["Outstanding", fmtCAD(bal?.outstanding ?? 0), "text-u-ink font-semibold"],
                ].map(([label, value, cls]) => (
                  <div key={label}>
                    <dt className="text-[10px] tracking-wide text-u-muted uppercase">{label}</dt>
                    <dd className={cn("mt-0.5 text-[13px] font-medium tabular-nums", cls)}>{value}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-2 flex items-center justify-between rounded-md bg-u-card/70 px-2.5 py-1.5 text-xs">
                <span className="text-u-muted">Balance after this payment</span>
                <span className={cn("font-display font-semibold tabular-nums", applied > 0 ? "text-u-accent" : "text-u-ink2")}>
                  {fmtCAD(balanceAfter(inv))}
                </span>
              </p>
              {rowError(inv) && (
                <p className="mt-1.5 flex items-center gap-1 text-[11px] font-medium text-u-danger">
                  <Icon name="alert" className="h-3 w-3" />
                  {rowError(inv)}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
