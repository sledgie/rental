import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { useApp } from "../../context/AppContext";
import { getProvider, getTenant, getUnit, propertyLabel } from "../../data/catalog";
import type { Bill, DocumentType } from "../../types";
import { isSupabaseConfigured } from "../../../lib/supabase";
import { openDocument } from "../../../lib/documents";
import {
  landlordShare,
  providerBalance,
  recoveryOutstanding,
  resolvedAllocations,
  sumPayments,
  sumRecoveries,
  totalTenantShare,
} from "../../utils/bills";
import {
  allocationMethodLabel,
  categoryLabel,
  formatCAD,
  formatDate,
  formatDateRange,
  paymentMethodLabel,
  todayISO,
} from "../../utils/format";
import {
  Bell,
  FileText,
  Paperclip,
  Pencil,
  Plus,
  Receipt,
  Upload,
  Wallet,
} from "lucide-react";
import { useRef } from "react";

export function ExpandedBill({
  bill,
  onPay,
  onRecover,
  onEditAlloc,
}: {
  bill: Bill;
  onPay: () => void;
  onRecover: (tenantId?: string) => void;
  onEditAlloc: () => void;
}) {
  const { payments, recoveries, addDocument, pushToast, updateBill } = useApp();
  const paid = sumPayments(payments, bill.id);
  const remaining = providerBalance(bill, payments);
  const tenantTotal = totalTenantShare(bill);
  const recovered = sumRecoveries(recoveries, bill.id);
  const recoverLeft = recoveryOutstanding(bill, recoveries);
  const shares = resolvedAllocations(bill.amount, bill.allocations);
  const billPayments = payments.filter((p) => p.billId === bill.id);
  const billRecoveries = recoveries.filter((r) => r.billId === bill.id);
  const fileRef = useRef<HTMLInputElement>(null);

  function onUpload(type: DocumentType) {
    const input = fileRef.current;
    if (!input) return;
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      addDocument(bill.id, {
        name: file.name,
        type,
        mockFileName: file.name,
        addedAt: todayISO(),
      }, file);
      pushToast(isSupabaseConfigured ? `Uploading “${file.name}”.` : `Mock file “${file.name}” attached locally. Nothing was uploaded to storage.`);
      input.value = "";
    };
    input.click();
  }

  return (
    <div className="grid gap-4 bg-u-bg/80 p-4 lg:grid-cols-2">
      <section className="rounded-xl border border-u-line2 bg-u-card p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-u-ink">
          <FileText className="h-4 w-4 text-u-accent" />
          Bill details
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
          <Item k="Bill ID" v={bill.id} mono />
          <Item k="Bill name" v={bill.name} />
          <Item k="Category" v={categoryLabel(bill.category)} />
          <Item k="Service provider" v={getProvider(bill.providerId)?.name ?? "—"} />
          <Item k="Account number" v={bill.accountNumber ?? "—"} mono />
          <Item k="Invoice number" v={bill.invoiceNumber ?? "—"} mono />
          <Item k="Property / unit" v={propertyLabel(bill.propertyId, bill.unitIds)} />
          <Item k="Billing period" v={formatDateRange(bill.billingPeriodStart, bill.billingPeriodEnd)} />
          <Item k="Invoice date" v={formatDate(bill.invoiceDate)} />
          <Item k="Due date" v={formatDate(bill.dueDate)} />
          <Item k="Actual invoice amount" v={formatCAD(bill.amount)} mono />
          <Item k="Schedule origin" v={bill.scheduleId ?? "One-time bill"} />
        </dl>
        {bill.notes && <p className="mt-3 text-xs leading-5 text-u-ink2">{bill.notes}</p>}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Bell className="h-3.5 w-3.5 text-u-warn" />
          <span className="text-[11px] text-u-muted">Reminders:</span>
          {bill.reminderDays.map((d) => (
            <Badge key={d} tone="amber">
              {d < 0 ? "After due if unpaid" : d === 0 ? "On due date" : `${d} days before`}
            </Badge>
          ))}
          <button
            className="text-[11px] text-u-accent hover:underline"
            onClick={() =>
              updateBill(bill.id, {
                reminderDays: bill.reminderDays.includes(-1)
                  ? bill.reminderDays
                  : [...bill.reminderDays, -1],
              })
            }
          >
            Add overdue indicator
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-u-line2 bg-u-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-u-ink">
            <Wallet className="h-4 w-4 text-u-warn" />
            Provider payments
          </div>
          <Button size="sm" onClick={onPay} disabled={remaining <= 0}>
            Record payment
          </Button>
        </div>
        <div className="mb-3 grid grid-cols-3 gap-2 text-xs">
          <Mini label="Total bill" value={formatCAD(bill.amount)} />
          <Mini label="Amount paid" value={formatCAD(paid)} tone="teal" />
          <Mini label="Remaining balance" value={formatCAD(remaining)} tone="amber" />
        </div>
        <div className="overflow-hidden rounded-lg border border-u-line2">
          <table className="w-full text-left text-xs">
            <thead className="bg-u-s2 text-u-muted">
              <tr>
                <th className="px-2 py-1.5 font-medium">Date</th>
                <th className="px-2 py-1.5 font-medium">Method</th>
                <th className="px-2 py-1.5 font-medium">Reference</th>
                <th className="px-2 py-1.5 font-medium text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {billPayments.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-2 py-3 text-u-muted">
                    No provider payments yet. Paying the tenant does not pay this invoice.
                  </td>
                </tr>
              )}
              {billPayments.map((p) => (
                <tr key={p.id} className="border-t border-u-line">
                  <td className="px-2 py-1.5">{formatDate(p.date)}</td>
                  <td className="px-2 py-1.5">{paymentMethodLabel(p.method)}</td>
                  <td className="px-2 py-1.5 font-mono text-[11px]">{p.referenceNumber ?? "—"}</td>
                  <td className="px-2 py-1.5 text-right font-mono">{formatCAD(p.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {billPayments.some((p) => p.notes) && (
          <ul className="mt-2 space-y-1 text-[11px] text-u-muted">
            {billPayments
              .filter((p) => p.notes)
              .map((p) => (
                <li key={p.id}>
                  {p.id}: {p.notes}
                </li>
              ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-u-line2 bg-u-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-u-ink">
            <Receipt className="h-4 w-4 text-u-violet" />
            Tenant cost allocation
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" icon={<Pencil className="h-3.5 w-3.5" />} onClick={onEditAlloc}>
              Edit allocation
            </Button>
            <Button size="sm" variant="outline" onClick={() => onRecover()} disabled={recoverLeft <= 0}>
              Record reimbursement
            </Button>
          </div>
        </div>
        <div className="mb-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
          <Mini label="Tenant share" value={formatCAD(tenantTotal)} tone="violet" />
          <Mini label="Landlord share" value={formatCAD(landlordShare(bill))} />
          <Mini label="Recovered" value={formatCAD(recovered)} tone="teal" />
          <Mini label="Still to recover" value={formatCAD(recoverLeft)} tone="amber" />
        </div>
        {shares.length === 0 ? (
          <p className="text-xs text-u-muted">Not recoverable — landlord is responsible for 100% of this invoice.</p>
        ) : (
          <div className="space-y-2">
            {shares.map((a) => {
              const rec = sumRecoveries(recoveries, bill.id, a.tenantId);
              const left = Math.max(0, a.share - rec);
              return (
                <div key={a.id} className="rounded-lg border border-u-line p-3 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium text-u-ink">{getTenant(a.tenantId)?.name}</p>
                      <p className="text-u-muted">
                        {getUnit(a.unitId)?.name} · {allocationMethodLabel(a.method)}
                        {a.method === "percentage" ? ` · ${a.percentage}% of ${a.calculationBasis} bill` : ""}
                        {a.method === "fixed" ? ` · ${formatCAD(a.fixedAmount ?? 0)}` : ""}
                      </p>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => onRecover(a.tenantId)} disabled={left <= 0}>
                      Record recovery
                    </Button>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    <Mini label="Calculated share" value={formatCAD(a.share)} />
                    <Mini label="Recovered" value={formatCAD(rec)} tone="teal" />
                    <Mini label="Remaining" value={formatCAD(left)} tone="amber" />
                  </div>
                  {a.notes && <p className="mt-2 text-u-muted">{a.notes}</p>}
                </div>
              );
            })}
          </div>
        )}
        {billRecoveries.length > 0 && (
          <div className="mt-3 overflow-hidden rounded-lg border border-u-line2">
            <table className="w-full text-left text-xs">
              <thead className="bg-u-s2 text-u-muted">
                <tr>
                  <th className="px-2 py-1.5 font-medium">Date</th>
                  <th className="px-2 py-1.5 font-medium">Tenant</th>
                  <th className="px-2 py-1.5 font-medium">Method</th>
                  <th className="px-2 py-1.5 font-medium text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {billRecoveries.map((r) => (
                  <tr key={r.id} className="border-t border-u-line">
                    <td className="px-2 py-1.5">{formatDate(r.date)}</td>
                    <td className="px-2 py-1.5">{getTenant(r.tenantId)?.name}</td>
                    <td className="px-2 py-1.5">{paymentMethodLabel(r.method)}</td>
                    <td className="px-2 py-1.5 text-right font-mono">{formatCAD(r.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-u-line2 bg-u-card p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-u-ink">
          <Paperclip className="h-4 w-4 text-u-blue" />
          Documents
        </div>
        <p className="mb-3 text-[11px] text-u-muted">
          {isSupabaseConfigured ? "Files are stored securely and only visible to your team." : "Mock attachments only. This workspace does not persist files to remote storage."}
        </p>
        <div className="space-y-2">
          {bill.documents.length === 0 && (
            <p className="text-xs text-u-muted">No documents attached.</p>
          )}
          {bill.documents.map((d) => (
            <div
              key={d.id}
              className="flex items-center justify-between rounded-lg border border-u-line px-3 py-2 text-xs"
            >
              <div>
                <p className="text-u-ink">{d.name}</p>
                <p className="text-u-muted">
                  {d.type.split("_").join(" ")} · {d.mockFileName} · {formatDate(d.addedAt)}
                </p>
              </div>
              {d.path && d.bucket ? (
                <button
                  type="button"
                  className="text-xs font-medium text-u-accent hover:underline"
                  onClick={() => openDocument(d.bucket!, d.path!).catch((error) => pushToast(error instanceof Error ? error.message : "The file could not be opened.", "error"))}
                >
                  Open
                </button>
              ) : (
                <Badge tone="neutral">Local mock</Badge>
              )}
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <input ref={fileRef} type="file" className="hidden" />
          <Button size="sm" variant="secondary" icon={<Upload className="h-3.5 w-3.5" />} onClick={() => onUpload("invoice")}>
            Invoice
          </Button>
          <Button size="sm" variant="secondary" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => onUpload("receipt")}>
            Receipt
          </Button>
          <Button size="sm" variant="secondary" onClick={() => onUpload("proof_of_payment")}>
            Proof of payment
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onUpload("other")}>
            Other
          </Button>
        </div>
      </section>
    </div>
  );
}

function Item({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-u-muted">{k}</dt>
      <dd className={mono ? "font-mono text-u-ink" : "text-u-ink"}>{v}</dd>
    </div>
  );
}

function Mini({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "teal" | "amber" | "violet";
}) {
  const color =
    tone === "teal" ? "text-u-accent" : tone === "amber" ? "text-u-warn" : tone === "violet" ? "text-u-violet" : "text-u-ink";
  return (
    <div className="rounded-lg bg-u-s2 px-2 py-2">
      <p className="text-[10px] text-u-muted">{label}</p>
      <p className={`font-mono text-sm ${color}`}>{value}</p>
    </div>
  );
}
