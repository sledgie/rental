import { isSupabaseConfigured } from "../../lib/supabase";
import type {
  Allocation,
  CreditApplication,
  Invoice,
  InvoiceBalance,
  Payment,
  Property,
  StaffUser,
  Tenant,
  TenantCredit,
  Unit,
} from "../types";
import { COMPANY, fmtCAD, formatDate, formatDateTime, METHOD_LABELS, periodLabel } from "../utils/paymentUtils";
import { Button, Icon, Modal } from "./ui";
import { cn } from "../utils/cn";

// ---------------------------------------------------------------------------
// Standalone HTML receipt (used for the downloadable file).
// ---------------------------------------------------------------------------

export function buildReceiptHtml(args: {
  payment: Payment;
  issuedAt?: string;
  tenant?: Tenant;
  unit?: Unit;
  property?: Property;
  invoices: Invoice[];
  balances: Map<string, InvoiceBalance>;
  allocations: Allocation[];
  creditsFromPayment: TenantCredit[];
  creditApplications: CreditApplication[];
  users: StaffUser[];
}): string {
  const { payment, tenant, unit, property, invoices, balances, allocations, creditsFromPayment, users } = args;
  const invById = new Map(invoices.map((i) => [i.id, i]));
  const lines = allocations.filter((a) => a.paymentId === payment.id);
  const totalAllocated = lines.reduce((s, a) => s + a.amount, 0);
  const unallocated = payment.amount - totalAllocated;
  const recordedBy = users.find((u) => u.id === payment.recordedById)?.name ?? payment.recordedById;
  const reversed = payment.status === "reversed";
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8" />
<title>${payment.receiptId ?? payment.id} — Rent Receipt</title>
<style>
  body{font-family:'Courier New',monospace;font-size:13px;color:#1c1e1a;max-width:640px;margin:24px auto;padding:0 16px;}
  h1{font-size:18px;letter-spacing:.12em;margin:0;text-align:center;}
  .center{text-align:center}.muted{color:#6b7063}.rule{border-top:1px dashed #9aa08f;margin:14px 0;}
  table{width:100%;border-collapse:collapse;font-size:12px;}
  th{text-align:left;text-transform:uppercase;font-size:10px;letter-spacing:.1em;color:#6b7063;padding-bottom:6px;}
  td{padding:3px 0;vertical-align:top;}
  .num{text-align:right;font-variant-numeric:tabular-nums;}
  .total{border-top:2px solid #1c1e1a;font-weight:bold;font-size:15px;}
  .badge{display:inline-block;border:1px solid #b45309;background:#fef3c7;color:#92400e;font-size:10px;letter-spacing:.15em;text-transform:uppercase;padding:2px 8px;border-radius:3px;margin-top:6px;}
  .stamp{display:inline-block;border:1px solid #b91c1c;background:#fef2f2;color:#b91c1c;font-size:10px;letter-spacing:.15em;text-transform:uppercase;padding:2px 8px;border-radius:3px;margin-top:6px;margin-left:4px;}
  @media print{body{margin:0;}}
</style></head><body>
<div class="center">
  <h1>${esc(COMPANY.name.toUpperCase())}</h1>
  <p class="muted" style="margin:4px 0;">${esc(COMPANY.address)}<br/>${esc(COMPANY.phone)} · ${esc(COMPANY.email)}</p>
  <div class="rule"></div>
  <p style="letter-spacing:.35em;font-weight:bold;margin:6px 0;">RENT RECEIPT</p>
  ${isSupabaseConfigured ? "" : '<span class="badge">Sample — demo data</span>'}
  ${reversed ? '<span class="stamp">Reversed</span>' : ""}
  ${payment.refund ? '<span class="stamp">Refunded</span>' : ""}
</div>
<div class="rule"></div>
<table>
  <tr><td class="muted">Receipt no.</td><td class="num"><b>${esc(payment.receiptId ?? "—")}</b></td></tr>
  <tr><td class="muted">Payment ID</td><td class="num">${esc(payment.id)}</td></tr>
  <tr><td class="muted">Date issued</td><td class="num">${esc(formatDateTime(args.issuedAt ?? payment.createdAt))}</td></tr>
  <tr><td class="muted">Payment date</td><td class="num">${esc(formatDate(payment.date))}</td></tr>
  <tr><td class="muted">Received from</td><td class="num">${esc(tenant ? `${tenant.name} (${tenant.number})` : "—")}</td></tr>
  <tr><td class="muted">Property / unit</td><td class="num">${esc(property && unit ? `${property.name}, ${unit.number}` : "—")}</td></tr>
  <tr><td class="muted">Payment method</td><td class="num">${esc(METHOD_LABELS[payment.method])}</td></tr>
  <tr><td class="muted">Reference</td><td class="num">${esc(payment.reference ?? "—")}</td></tr>
</table>
<div class="rule"></div>
<table>
  <thead><tr><th>Applied to invoice</th><th>Rent period</th><th class="num">Allocated</th><th class="num">Still owing</th></tr></thead>
  <tbody>
  ${lines
    .map((a) => {
      const inv = invById.get(a.invoiceId);
      const bal = balances.get(a.invoiceId);
      return `<tr><td>${esc(a.invoiceId)}</td><td>${inv ? esc(periodLabel(inv.periodStart, inv.periodEnd)) : "—"}</td><td class="num">${fmtCAD(a.amount)}</td><td class="num">${fmtCAD(bal?.outstanding ?? 0)}</td></tr>`;
    })
    .join("")}
  ${creditsFromPayment
    .map((c) => `<tr><td>${esc(c.id)}</td><td>Unapplied tenant credit</td><td class="num">${fmtCAD(c.originalAmount)}</td><td class="num"></td></tr>`)
    .join("")}
  </tbody>
</table>
<table style="margin-top:10px;">
  <tr><td>Total allocated to invoices</td><td class="num">${fmtCAD(totalAllocated)}</td></tr>
  ${unallocated > 0 ? `<tr><td>Unallocated (retained as tenant credit)</td><td class="num">${fmtCAD(unallocated)}</td></tr>` : ""}
  <tr class="total"><td>TOTAL RECEIVED</td><td class="num" ${reversed ? 'style="color:#b91c1c;text-decoration:line-through;"' : ""}>${fmtCAD(payment.amount)}</td></tr>
</table>
<p class="muted" style="font-size:11px;">Amount received and amount still owing are shown separately. This receipt covers one payment only, regardless of the number of invoices.</p>
${reversed && payment.reversalReason ? `<p style="border:1px solid #fca5a5;background:#fef2f2;color:#991b1b;padding:6px 10px;font-size:11px;">Reversed: ${esc(payment.reversalReason)}</p>` : ""}
<div class="rule"></div>
<p class="center muted" style="font-size:11px;">Recorded by ${esc(recordedBy)} · Issued ${esc(formatDateTime(args.issuedAt ?? payment.createdAt))}<br/>
${isSupabaseConfigured ? "" : "Fictional sample receipt generated for demonstration purposes only. No real transaction occurred."}</p>
</body></html>`;
}

export function downloadReceiptHtml(args: Parameters<typeof buildReceiptHtml>[0]) {
  const html = buildReceiptHtml(args);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${args.payment.receiptId ?? args.payment.id}.html`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// On-screen preview modal
// ---------------------------------------------------------------------------

export function ReceiptPreview({
  payment,
  issuedAt,
  tenant,
  unit,
  property,
  invoices,
  balances,
  allocations,
  creditsFromPayment,
  users,
  onClose,
  onPrint,
  onDownload,
}: {
  payment: Payment;
  issuedAt?: string;
  tenant?: Tenant;
  unit?: Unit;
  property?: Property;
  invoices: Invoice[];
  balances: Map<string, InvoiceBalance>;
  allocations: Allocation[];
  creditsFromPayment: TenantCredit[];
  users: StaffUser[];
  onClose: () => void;
  onPrint: () => void;
  onDownload: () => void;
}) {
  const invoiceById = new Map(invoices.map((i) => [i.id, i]));
  const lines = allocations.filter((a) => a.paymentId === payment.id);
  const totalAllocated = lines.reduce((s, a) => s + a.amount, 0);
  const unallocated = payment.amount - totalAllocated;
  const reversed = payment.status === "reversed";
  const recordedBy = users.find((u) => u.id === payment.recordedById)?.name ?? payment.recordedById;

  return (
    <Modal onClose={onClose} size="md" labelledBy="rc-title">
      <div className="flex items-center justify-between border-b border-rc-ink-100 px-6 py-4">
        <h2 id="rc-title" className="font-display text-lg font-semibold tracking-tight text-rc-ink-900">
          Receipt preview
          <span className="ml-2 font-mono text-xs font-normal text-rc-ink-400">{payment.receiptId}</span>
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close receipt preview"
          className="rounded-lg p-1.5 text-rc-ink-400 transition-colors hover:bg-rc-ink-100 hover:text-rc-ink-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rc-pine-500/50"
        >
          <Icon name="x" className="h-5 w-5" />
        </button>
      </div>

      <div className="bg-rc-ink-100/60 px-4 py-6 sm:px-8">
        {/* The receipt sheet — this element alone is printed. */}
        <div id="print-root" className="mx-auto max-w-105 bg-white px-7 py-8 font-mono text-[12.5px] leading-relaxed text-rc-ink-900 shadow-lg ring-1 ring-rc-ink-950/10">
          <header className="text-center">
            <p className="font-display text-lg font-bold tracking-wide">{COMPANY.name.toUpperCase()}</p>
            <p className="mt-0.5 text-[11px] text-rc-ink-500">{COMPANY.address}</p>
            <p className="text-[11px] text-rc-ink-500">{COMPANY.phone} · {COMPANY.email}</p>
            <div className="my-4 border-t border-dashed border-rc-ink-300" />
            <p className="font-display text-sm font-semibold tracking-[0.35em] text-rc-ink-800">RENT RECEIPT</p>
            {!isSupabaseConfigured && (
              <p className="mt-1.5 inline-block rounded border border-amber-400 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold tracking-widest text-amber-800 uppercase">
                Sample — demo data
              </p>
            )}
            {reversed && (
              <p className="mt-1.5 ml-1 inline-block rounded border border-red-400 bg-red-50 px-2 py-0.5 text-[10px] font-semibold tracking-widest text-red-800 uppercase">
                Reversed
              </p>
            )}
            {payment.refund && (
              <p className="mt-1.5 ml-1 inline-block rounded border border-red-400 bg-red-50 px-2 py-0.5 text-[10px] font-semibold tracking-widest text-red-800 uppercase">
                Refunded
              </p>
            )}
          </header>

          <dl className="mt-5 space-y-1.5">
            {[
              ["Receipt no.", payment.receiptId ?? "—"],
              ["Payment ID", payment.id],
              ["Date issued", formatDateTime(issuedAt ?? payment.createdAt)],
              ["Payment date", formatDate(payment.date)],
              ["Received from", tenant ? `${tenant.name} (${tenant.number})` : "—"],
              ["Property / unit", property && unit ? `${property.name}, ${unit.number}` : "—"],
              ["Payment method", METHOD_LABELS[payment.method]],
              ["Reference", payment.reference ?? "—"],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4">
                <dt className="shrink-0 text-rc-ink-500">{k}</dt>
                <dd className="text-right font-medium">{v}</dd>
              </div>
            ))}
          </dl>

          <div className="my-4 border-t border-dashed border-rc-ink-300" />

          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-left text-[10px] tracking-widest text-rc-ink-500 uppercase">
                <th className="pb-1.5 font-semibold">Applied to</th>
                <th className="pb-1.5 text-right font-semibold">Allocated</th>
                <th className="pb-1.5 text-right font-semibold">Still owing</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((a) => {
                const inv = invoiceById.get(a.invoiceId);
                return (
                  <tr key={a.id}>
                    <td className="py-0.5">
                      {a.invoiceId}
                      {inv && <span className="block text-[10.5px] text-rc-ink-500">Rent — {periodLabel(inv.periodStart, inv.periodEnd)}</span>}
                    </td>
                    <td className="py-0.5 text-right tabular-nums">{fmtCAD(a.amount)}</td>
                    <td className="py-0.5 text-right tabular-nums text-rc-ink-500">{fmtCAD(balances.get(a.invoiceId)?.outstanding ?? 0)}</td>
                  </tr>
                );
              })}
              {creditsFromPayment.map((c) => (
                <tr key={c.id}>
                  <td className="py-0.5 text-amber-800">{c.id} — unapplied tenant credit</td>
                  <td className="py-0.5 text-right tabular-nums text-amber-800">{fmtCAD(c.originalAmount)}</td>
                  <td />
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-3 space-y-1 border-t border-dashed border-rc-ink-300 pt-2.5 text-[12px]">
            <div className="flex justify-between">
              <span className="text-rc-ink-500">Total allocated to invoices</span>
              <span className="tabular-nums">{fmtCAD(totalAllocated)}</span>
            </div>
            {unallocated > 0 && (
              <div className="flex justify-between text-amber-800">
                <span>Unallocated → tenant credit</span>
                <span className="tabular-nums">{fmtCAD(unallocated)}</span>
              </div>
            )}
            <div className="flex items-baseline justify-between border-t-2 border-rc-ink-800 pt-2">
              <span className="text-[11px] font-semibold tracking-widest text-rc-ink-500 uppercase">Total received</span>
              <span className={cn("font-display text-xl font-bold tabular-nums", reversed && "text-red-700 line-through decoration-2")}>
                {fmtCAD(payment.amount)}
              </span>
            </div>
          </div>
          <p className="text-right text-[11px] text-rc-ink-500">CAD · {METHOD_LABELS[payment.method]}</p>

          {reversed && payment.reversalReason && (
            <p className="mt-3 rounded border border-red-300 bg-red-50 px-2.5 py-1.5 text-[11px] text-red-800">
              Reversed: {payment.reversalReason}
            </p>
          )}
          {payment.refund && (
            <p className="mt-3 rounded border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-800">
              Refunded {fmtCAD(payment.refund.amount)} on {formatDate(payment.refund.at.slice(0, 10))}: {payment.refund.reason}
            </p>
          )}

          <footer className="mt-6 border-t border-dashed border-rc-ink-300 pt-3 text-center text-[10.5px] text-rc-ink-500">
            <p>Recorded by {recordedBy} · Issued {formatDateTime(issuedAt ?? payment.createdAt)}</p>
            <p className="mt-1">
              Reprinting reuses this receipt number — no new payment is created.{!isSupabaseConfigured && " Fictional sample receipt for demonstration only."}
            </p>
          </footer>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-rc-ink-100 bg-rc-ink-50/50 px-6 py-4">
        <Button onClick={onClose}>Close</Button>
        <Button onClick={onDownload}>
          <Icon name="chevron-down" className="h-4 w-4" />
          Download
        </Button>
        <Button variant="primary" onClick={onPrint}>
          <Icon name="printer" className="h-4 w-4" />
          Print receipt
        </Button>
      </div>
    </Modal>
  );
}
