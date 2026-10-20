import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  Banknote,
  Boxes,
  Check,
  CircleDollarSign,
  CreditCard,
  Download,
  FileCheck2,
  FilePlus2,
  HardHat,
  Info,
  LockKeyhole,
  Package,
  Paperclip,
  Plus,
  ReceiptText,
  ShieldCheck,
  Trash2,
  Trash,
  Truck,
  Wallet,
  Wrench,
  X,
} from "lucide-react";
import { useStore } from "../../lib/store";
import {
  dateLong,
  invoiceBalance,
  invoicePaid,
  invoiceSubtotal,
  invoiceTaxes,
  invoiceTotal,
  money,
  parseMoneyToCents,
  paymentStatusFor,
  projectFinancials,
  TODAY,
} from "../../lib/finance";
import type { ApprovalStatus, ExpenseCategory, InvoiceLine, PaymentMethod, Project } from "../../lib/types";
import { Badge, Button, Card, EmptyState, Field, InfoNote, Input, Metric, Modal, ProgressBar, SectionHeader, Select, StatusBadge, Textarea, ToneIcon } from "../../components/ui";
import { cn } from "../../utils/cn";

const expenseCategories: ExpenseCategory[] = ["Labor", "Materials", "Plumbing & Electrical Supplies", "Equipment Rental", "Permits & Inspections", "Contractor Services", "Delivery & Transportation", "Waste Removal", "Other"];

const categoryIcon = (category: ExpenseCategory) => {
  if (category === "Labor" || category === "Contractor Services") return HardHat;
  if (category === "Materials") return Package;
  if (category === "Plumbing & Electrical Supplies") return Wrench;
  if (category === "Equipment Rental") return Boxes;
  if (category === "Permits & Inspections") return FileCheck2;
  if (category === "Delivery & Transportation") return Truck;
  if (category === "Waste Removal") return Trash;
  return CircleDollarSign;
};

function MetricStrip({ project }: { project: Project }) {
  const fin = projectFinancials(project);
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      <Metric label="Original budget" value={money(fin.originalBudget)} hint="Preserved permanently" />
      <Metric label="Approved changes" value={`${fin.budgetChanges >= 0 ? "+" : "−"}${money(Math.abs(fin.budgetChanges))}`} tone={fin.budgetChanges === 0 ? "default" : fin.budgetChanges > 0 ? "warning" : "positive"} hint={`${project.changeOrders.filter((c) => c.approval === "Approved").length} approved COs`} />
      <Metric label="Current approved" value={money(fin.currentBudget)} tone="default" hint="Original + approved changes" />
      <Metric label="Committed" value={money(fin.committed)} hint="Awarded contract value" />
      <Metric label="Incurred" value={money(fin.incurred)} tone="positive" hint="Approved expenses + invoices" />
      <Metric label="Contingency" value={money(fin.contingency)} hint="Held inside budget" />
      <Metric label="Invoiced" value={money(fin.invoiced)} hint="Billable invoices" />
      <Metric label="Paid" value={money(fin.paid)} tone="positive" hint="Recorded payments" />
      <Metric label="Outstanding" value={money(fin.outstanding)} tone={fin.outstanding > 0 ? "warning" : "default"} hint="Invoiced − paid" />
      <Metric label="Forecast final" value={money(fin.forecastFinal)} hint="Incurred + open committed" />
      <Metric label="Remaining budget" value={money(fin.remaining)} tone={fin.remaining < 0 ? "negative" : "positive"} hint="Current − incurred" />
      <Metric label="Budget variance" value={`${fin.variance < 0 ? "−" : ""}${money(Math.abs(fin.variance))}`} tone={fin.variance < 0 ? "negative" : "positive"} hint="Budget − forecast" />
    </div>
  );
}

export function BudgetTab({ project }: { project: Project }) {
  const { setExpenseApproval } = useStore();
  const [expenseOpen, setExpenseOpen] = useState(false);
  const fin = projectFinancials(project);
  const approvedExpenses = project.expenses.filter((e) => e.approval === "Approved");
  const pendingExpenses = project.expenses.filter((e) => e.approval === "Pending Approval");
  const totalExpenses = project.expenses.reduce((sum, e) => sum + e.totalCents, 0);
  const incurredPct = fin.currentBudget ? Math.min(100, (fin.incurred / fin.currentBudget) * 100) : 0;
  const openCommitted = Math.max(0, fin.committed - fin.invoiced);
  const committedPct = fin.currentBudget ? Math.min(100, (openCommitted / fin.currentBudget) * 100) : 0;

  return (
    <div className="space-y-3">
      <MetricStrip project={project} />

      <div className="grid gap-3 xl:grid-cols-[1.5fr_1fr]">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-u-ink/[0.06] px-4 py-3">
            <SectionHeader icon={Wallet} title="Budget utilisation" subtitle="How the current approved budget is consumed" />
            <Badge tone={fin.overBudget ? "rose" : fin.budgetHealth === "At risk" ? "amber" : "acid"} dot>{fin.budgetHealth}</Badge>
          </div>
          <div className="p-4">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="text-[9.5px] uppercase tracking-[0.1em] text-u-muted">Current approved</p>
                <p className="font-mono text-[26px] font-medium tracking-tight text-u-ink">{money(fin.currentBudget)}</p>
                <p className="text-[10px] text-u-muted">{money(fin.incurred)} incurred · {money(fin.remaining)} remaining</p>
              </div>
              <div className="text-right">
                <p className="text-[9.5px] uppercase tracking-[0.1em] text-u-muted">Forecast final</p>
                <p className={cn("font-mono text-[18px]", fin.overBudget ? "text-u-danger" : "text-u-accent")}>{money(fin.forecastFinal)}</p>
                <p className="text-[10px] text-u-muted">{fin.variance >= 0 ? `${money(fin.variance)} under budget` : `${money(Math.abs(fin.variance))} over budget`}</p>
              </div>
            </div>
            <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-u-ink/[0.06]">
              <div className="bg-gradient-to-r from-u-accent to-u-accent" style={{ width: `${incurredPct}%` }} />
              <div className="bg-u-ok/45" style={{ width: `${committedPct}%` }} />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-[9.5px] text-u-muted">
              <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-u-accent" /> Incurred {money(fin.incurred)}</span>
              <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-u-ok/60" /> Committed not invoiced {money(openCommitted)}</span>
              <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-u-ink/20" /> Unallocated {money(Math.max(0, fin.remaining - openCommitted))}</span>
            </div>
            {fin.overBudget && (
              <div className="mt-3"><InfoNote tone="warning">Forecast final cost exceeds the current approved budget by {money(Math.abs(fin.variance))}. Raise a change order or reduce scope before approving further commitments.</InfoNote></div>
            )}
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <Definition icon={HardHat} label="Committed" value={money(fin.committed)} hint="Awarded contract values. Not cash." />
              <Definition icon={ReceiptText} label="Invoiced" value={money(fin.invoiced)} hint="Billable invoices. Not necessarily paid." />
              <Definition icon={Banknote} label="Paid" value={money(fin.paid)} hint="Separate payment transactions." />
            </div>
            <p className="mt-2 flex items-start gap-1 text-[9.5px] leading-relaxed text-u-muted"><LockKeyhole className="mt-0.5 h-3 w-3 shrink-0" /> Committed, incurred, invoiced and paid represent different stages of the same money and are never added together as separate costs.</p>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-u-ink/[0.06] px-4 py-3"><SectionHeader icon={FileCheck2} title="Budget revisions" subtitle="Traceable to approved change orders" /></div>
          <div className="divide-y divide-u-ink/[0.05]">
            <div className="flex items-center justify-between px-4 py-2.5">
              <div><p className="text-[11px] text-u-ink2">Original approved budget</p><p className="text-[9.5px] text-u-muted">Preserved at project approval</p></div>
              <span className="font-mono text-[11.5px] text-u-ink">{money(fin.originalBudget)}</span>
            </div>
            {project.changeOrders.filter((c) => c.approval === "Approved").map((co) => (
              <div key={co.id} className="flex items-center justify-between px-4 py-2.5">
                <div className="min-w-0 pr-2"><p className="truncate text-[11px] text-u-ink2">{co.number} · {co.description}</p><p className="text-[9.5px] text-u-muted">Approved {dateLong(co.approvalDate)} by {co.approver}</p></div>
                <span className={cn("shrink-0 font-mono text-[11px]", co.costDeltaCents >= 0 ? "text-u-warn" : "text-u-accent")}>{co.costDeltaCents >= 0 ? "+" : "−"}{money(Math.abs(co.costDeltaCents))}</span>
              </div>
            ))}
            {project.changeOrders.filter((c) => c.approval === "Pending Approval").map((co) => (
              <div key={co.id} className="flex items-center justify-between px-4 py-2.5 opacity-70">
                <div className="min-w-0 pr-2"><p className="truncate text-[11px] text-u-muted">{co.number} · {co.description}</p><p className="text-[9.5px] text-u-warn/80">Pending — no budget impact</p></div>
                <span className="shrink-0 font-mono text-[11px] text-u-muted">{co.costDeltaCents >= 0 ? "+" : "−"}{money(Math.abs(co.costDeltaCents))}</span>
              </div>
            ))}
            <div className="flex items-center justify-between bg-u-ink/[0.02] px-4 py-2.5">
              <p className="text-[11px] font-semibold text-u-ink">Current approved budget</p>
              <span className="font-mono text-[12px] font-semibold text-u-accent">{money(fin.currentBudget)}</span>
            </div>
          </div>
          <div className="border-t border-u-ink/[0.06] px-4 py-2 text-[9.5px] text-u-muted">Only approved change orders update the current approved budget or schedule.</div>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-u-ink/[0.06] px-4 py-3">
          <SectionHeader icon={ReceiptText} title="Expenses" subtitle="Manually recorded costs from receipts, suppliers and contractors" />
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone="slate">{project.expenses.length} records</Badge>
            {pendingExpenses.length > 0 && <Badge tone="amber" icon={AlertTriangle}>{pendingExpenses.length} pending</Badge>}
            <Button variant="primary" size="sm" icon={Plus} onClick={() => setExpenseOpen(true)}>Record expense</Button>
          </div>
        </div>
        {project.expenses.length === 0 ? (
          <div className="p-4"><EmptyState icon={ReceiptText} title="No expenses recorded" description="Record materials, labour, permits and equipment directly, or from an approved invoice." action={<Button size="sm" variant="primary" icon={Plus} onClick={() => setExpenseOpen(true)}>Record first expense</Button>} /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left">
              <thead className="border-b border-u-ink/[0.05] bg-u-ink/[0.014] text-[9px] uppercase tracking-[0.09em] text-u-muted">
                <tr><th className="px-4 py-2 font-semibold">Date / category</th><th className="px-2 py-2 font-semibold">Description / vendor</th><th className="px-2 py-2 font-semibold">Task</th><th className="px-2 py-2 text-right font-semibold">Qty × unit</th><th className="px-2 py-2 text-right font-semibold">Tax</th><th className="px-2 py-2 text-right font-semibold">Total</th><th className="px-2 py-2 font-semibold">Approval</th><th className="px-3 py-2" /></tr>
              </thead>
              <tbody className="divide-y divide-u-ink/[0.045]">
                {project.expenses.map((expense) => {
                  const Icon = categoryIcon(expense.category);
                  const task = project.tasks.find((t) => t.id === expense.taskId);
                  return (
                    <tr key={expense.id} className="text-[11px] transition hover:bg-u-ink/[0.018]">
                      <td className="px-4 py-2.5">
                        <div className="flex items-start gap-2">
                          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-u-ink/[0.07] bg-u-ink/[0.03] text-u-ink2"><Icon className="h-3 w-3" /></span>
                          <div><p className="font-mono text-[10px] text-u-ink2">{dateLong(expense.date)}</p><p className="text-[9px] text-u-muted">{expense.category}</p></div>
                        </div>
                      </td>
                      <td className="max-w-[230px] px-2 py-2.5"><p className="truncate text-[11px] font-medium text-u-ink">{expense.description}</p><p className="truncate text-[9.5px] text-u-muted">{expense.vendor}{expense.receiptNumber ? ` · ${expense.receiptNumber}` : ""}</p></td>
                      <td className="max-w-[150px] px-2 py-2.5"><p className="truncate text-[10px] text-u-muted">{task?.name ?? "Project-level"}</p></td>
                      <td className="px-2 py-2.5 text-right"><p className="font-mono text-[10px] text-u-ink2">{expense.quantity} {expense.uom} × {money(expense.unitPriceCents)}</p>{expense.discountCents > 0 && <p className="text-[9px] text-u-accent">−{money(expense.discountCents)} disc.</p>}</td>
                      <td className="px-2 py-2.5 text-right"><p className="font-mono text-[10px] text-u-muted">{money(expense.taxAmountCents)}</p><p className="text-[9px] text-u-muted">{expense.taxRate}%</p></td>
                      <td className="px-2 py-2.5 text-right font-mono text-[11px] text-u-ink">{money(expense.totalCents, { cents: true })}</td>
                      <td className="px-2 py-2.5"><StatusBadge status={expense.approval} /></td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center justify-end gap-1">
                          {expense.attachmentName && <span title={expense.attachmentName} className="flex h-6 w-6 items-center justify-center rounded text-u-muted"><Paperclip className="h-3 w-3" /></span>}
                          {expense.approval === "Pending Approval" && (
                            <>
                              <button onClick={() => setExpenseApproval(project.id, expense.id, "Approved")} aria-label="Approve expense" className="flex h-6 w-6 items-center justify-center rounded border border-u-accent/25 bg-u-accent/10 text-u-accent hover:bg-u-accent/20"><Check className="h-3 w-3" /></button>
                              <button onClick={() => setExpenseApproval(project.id, expense.id, "Rejected")} aria-label="Reject expense" className="flex h-6 w-6 items-center justify-center rounded border border-u-danger/25 bg-u-danger/10 text-u-danger hover:bg-u-danger/20"><X className="h-3 w-3" /></button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-u-ink/[0.06] bg-u-ink/[0.012] px-4 py-2">
          <span className="flex items-center gap-1 text-[9.5px] text-u-muted"><ShieldCheck className="h-3 w-3" /> {approvedExpenses.length} approved · {pendingExpenses.length} pending approval · tax stored per transaction</span>
          <span className="font-mono text-[10px] text-u-ink2">{money(totalExpenses)} total recorded</span>
        </div>
      </Card>

      <AddExpenseModal open={expenseOpen} onClose={() => setExpenseOpen(false)} project={project} />
    </div>
  );
}

function Definition({ icon: Icon, label, value, hint }: { icon: typeof HardHat; label: string; value: string; hint: string }) {
  return (
    <div className="rounded-lg border border-u-ink/[0.06] bg-u-bg/50 p-2">
      <p className="flex items-center gap-1 text-[8.5px] font-semibold uppercase tracking-[0.1em] text-u-muted"><Icon className="h-3 w-3" /> {label}</p>
      <p className="mt-0.5 font-mono text-[12px] text-u-ink">{value}</p>
      <p className="text-[8.5px] text-u-muted">{hint}</p>
    </div>
  );
}

function AddExpenseModal({ open, onClose, project }: { open: boolean; onClose: () => void; project: Project }) {
  const { addExpense } = useStore();
  const [form, setForm] = useState({
    date: TODAY,
    category: "Materials" as ExpenseCategory,
    description: "",
    vendor: "",
    taskId: "",
    quantity: "1",
    uom: "ea",
    unitPrice: "",
    discount: "",
    taxRate: "13",
    receiptNumber: "",
    approval: "Approved" as ApprovalStatus,
    notes: "",
    attachmentName: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const quantity = Number.parseFloat(form.quantity) || 0;
  const unitPrice = parseMoneyToCents(form.unitPrice);
  const subtotal = Math.round(quantity * unitPrice);
  const discount = parseMoneyToCents(form.discount);
  const taxRate = Number.parseFloat(form.taxRate) || 0;
  const tax = Math.round(((subtotal - discount) * taxRate) / 100);
  const total = subtotal - discount + tax;

  const submit = () => {
    const nextErrors: Record<string, string> = {};
    if (!form.description.trim()) nextErrors.description = "Description is required.";
    if (!form.vendor.trim()) nextErrors.vendor = "Vendor or payee is required.";
    if (quantity <= 0) nextErrors.quantity = "Quantity must be greater than zero.";
    if (!form.unitPrice || unitPrice <= 0) nextErrors.unitPrice = "Enter a valid unit price.";
    if (discount > subtotal) nextErrors.discount = "Discount cannot exceed the subtotal.";
    if (taxRate < 0 || taxRate > 30) nextErrors.taxRate = "Tax rate must be 0–30%.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    const result = addExpense(project.id, {
      date: form.date,
      category: form.category,
      description: form.description.trim(),
      vendor: form.vendor.trim(),
      taskId: form.taskId || undefined,
      quantity,
      uom: form.uom,
      unitPriceCents: unitPrice,
      subtotalCents: subtotal,
      discountCents: discount,
      taxRate,
      taxAmountCents: tax,
      totalCents: total,
      receiptNumber: form.receiptNumber,
      attachmentName: form.attachmentName || undefined,
      approval: form.approval,
      notes: form.notes,
    });
    if (result.ok) {
      onClose();
      setForm({ ...form, description: "", vendor: "", unitPrice: "", discount: "", receiptNumber: "", notes: "", attachmentName: "", taskId: "" });
    } else setErrors({ form: result.error ?? "Unable to record expense." });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record expense"
      description="Enter receipt-level detail. Quantities, prices and taxes are validated; tax rates are stored per transaction."
      icon={ReceiptText}
      size="lg"
      footer={<><Button variant="ghost" size="md" onClick={onClose}>Cancel</Button><Button variant="primary" size="md" icon={Check} onClick={submit}>Record {money(total)} expense</Button></>}
    >
      <div className="space-y-3">
        {errors.form && <InfoNote tone="warning">{errors.form}</InfoNote>}
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Expense date"><Input type="date" value={form.date} onChange={(e) => setForm((c) => ({ ...c, date: e.target.value }))} /></Field>
          <Field label="Category"><Select value={form.category} onChange={(e) => setForm((c) => ({ ...c, category: e.target.value as ExpenseCategory }))}>{expenseCategories.map((c) => <option key={c}>{c}</option>)}</Select></Field>
          <Field label="Related task (optional)"><Select value={form.taskId} onChange={(e) => setForm((c) => ({ ...c, taskId: e.target.value }))}><option value="">Project-level</option>{project.tasks.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select></Field>
        </div>
        <Field label="Description" required error={errors.description}><Input value={form.description} onChange={(e) => setForm((c) => ({ ...c, description: e.target.value }))} placeholder="e.g. Porcelain tile & trim package" /></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Vendor / contractor / payee" required error={errors.vendor}><Input value={form.vendor} onChange={(e) => setForm((c) => ({ ...c, vendor: e.target.value }))} placeholder="Supplier or payee name" /></Field>
          <Field label="Invoice / receipt number"><Input value={form.receiptNumber} onChange={(e) => setForm((c) => ({ ...c, receiptNumber: e.target.value }))} placeholder="HTS-8891" /></Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-5">
          <Field label="Quantity" required error={errors.quantity}><Input type="number" min="0" step="0.01" value={form.quantity} onChange={(e) => setForm((c) => ({ ...c, quantity: e.target.value }))} /></Field>
          <Field label="Unit of measure"><Select value={form.uom} onChange={(e) => setForm((c) => ({ ...c, uom: e.target.value }))}>{["ea", "lot", "hr", "day", "bin", "sqft", "LF", "sheet"].map((u) => <option key={u}>{u}</option>)}</Select></Field>
          <Field label="Unit price (CAD)" required error={errors.unitPrice}><Input inputMode="decimal" value={form.unitPrice} onChange={(e) => setForm((c) => ({ ...c, unitPrice: e.target.value }))} placeholder="0.00" /></Field>
          <Field label="Discount (CAD)" error={errors.discount}><Input inputMode="decimal" value={form.discount} onChange={(e) => setForm((c) => ({ ...c, discount: e.target.value }))} placeholder="0.00" /></Field>
          <Field label="Tax rate (%)" hint="GST, HST or exempt" error={errors.taxRate}><Input type="number" min="0" max="30" step="0.001" value={form.taxRate} onChange={(e) => setForm((c) => ({ ...c, taxRate: e.target.value }))} /></Field>
        </div>
        <div className="grid gap-2 rounded-xl border border-u-ink/[0.07] bg-u-ink/[0.025] p-3 sm:grid-cols-4">
          <div><p className="text-[8.5px] uppercase tracking-wide text-u-muted">Subtotal</p><p className="font-mono text-[12px] text-u-ink">{money(subtotal, { cents: true })}</p></div>
          <div><p className="text-[8.5px] uppercase tracking-wide text-u-muted">Discount</p><p className="font-mono text-[12px] text-u-accent">−{money(discount, { cents: true })}</p></div>
          <div><p className="text-[8.5px] uppercase tracking-wide text-u-muted">Tax @ {taxRate}%</p><p className="font-mono text-[12px] text-u-ink">{money(tax, { cents: true })}</p></div>
          <div><p className="text-[8.5px] uppercase tracking-wide text-u-muted">Total</p><p className="font-mono text-[13px] font-medium text-u-accent">{money(total, { cents: true })}</p></div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Approval status"><Select value={form.approval} onChange={(e) => setForm((c) => ({ ...c, approval: e.target.value as ApprovalStatus }))}><option>Approved</option><option>Pending Approval</option><option>Draft</option></Select></Field>
          <Field label="Supporting attachment">
            <label className="flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-dashed border-u-ink/15 bg-u-bg/60 px-3 text-[11px] text-u-muted hover:border-u-accent/40 hover:text-u-ink">
              <Paperclip className="h-3.5 w-3.5" /> {form.attachmentName || "Attach receipt (PDF, JPG, PNG)"}
              <input type="file" accept=".pdf,.png,.jpg,.jpeg" className="hidden" onChange={(e) => setForm((c) => ({ ...c, attachmentName: e.target.files?.[0]?.name ?? "" }))} />
            </label>
          </Field>
        </div>
        <Field label="Notes"><Textarea rows={2} value={form.notes} onChange={(e) => setForm((c) => ({ ...c, notes: e.target.value }))} placeholder="Internal notes for audit…" /></Field>
      </div>
    </Modal>
  );
}

/* ------------------------------- Invoices tab ------------------------------ */

const paymentMethods: PaymentMethod[] = ["EFT", "Cheque", "Credit Card", "Cash", "Wire Transfer"];

export function InvoicesTab({ project }: { project: Project }) {
  const { setInvoiceApproval, notify } = useStore();
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentInvoice, setPaymentInvoice] = useState<string | undefined>();
  const [filter, setFilter] = useState<"All" | "Pending Approval" | "Approved" | "Rejected">("All");
  const [expanded, setExpanded] = useState<string | null>(project.invoices[0]?.id ?? null);
  const fin = projectFinancials(project);
  const invoices = project.invoices.filter((invoice) => filter === "All" || invoice.approval === filter);
  const overdue = project.invoices.filter((invoice) => paymentStatusFor(invoice, project.payments) === "Overdue");

  const startPayment = (invoiceId?: string) => {
    setPaymentInvoice(invoiceId);
    setPaymentOpen(true);
  };

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="flex items-center gap-3 p-3.5"><ToneIcon icon={ReceiptText} tone="sky" /><div><p className="text-[9.5px] uppercase tracking-[0.1em] text-u-muted">Invoiced</p><p className="font-mono text-[17px] text-u-ink">{money(fin.invoiced)}</p><p className="text-[9.5px] text-u-muted">{project.invoices.length} invoices</p></div></Card>
        <Card className="flex items-center gap-3 p-3.5"><ToneIcon icon={Banknote} tone="acid" /><div><p className="text-[9.5px] uppercase tracking-[0.1em] text-u-muted">Paid</p><p className="font-mono text-[17px] text-u-ink">{money(fin.paid)}</p><p className="text-[9.5px] text-u-muted">{project.payments.length} payment transactions</p></div></Card>
        <Card className={cn("flex items-center gap-3 p-3.5", fin.outstanding > 0 && "border-u-warn/20")}><ToneIcon icon={Wallet} tone="amber" /><div><p className="text-[9.5px] uppercase tracking-[0.1em] text-u-muted">Outstanding</p><p className="font-mono text-[17px] text-u-ink">{money(fin.outstanding)}</p><p className="text-[9.5px] text-u-muted">Invoiced − paid allocations</p></div></Card>
        <Card className={cn("flex items-center gap-3 p-3.5", overdue.length && "border-u-danger/20")}><ToneIcon icon={AlertTriangle} tone={overdue.length ? "rose" : "slate"} /><div><p className="text-[9.5px] uppercase tracking-[0.1em] text-u-muted">Overdue</p><p className={cn("font-mono text-[17px]", overdue.length ? "text-u-danger" : "text-u-ink")}>{overdue.length}</p><p className="text-[9.5px] text-u-muted">{fin.pendingInvoices} pending approval</p></div></Card>
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-u-ink/[0.06] px-4 py-3">
          <SectionHeader icon={ReceiptText} title="Invoices & payments" subtitle="Contractor and supplier invoices with separate approval and payment status" />
          <div className="flex flex-wrap items-center gap-1.5">
            <div className="flex items-center rounded-lg border border-u-ink/[0.07] p-0.5">
              {(["All", "Pending Approval", "Approved", "Rejected"] as const).map((status) => (
                <button key={status} onClick={() => setFilter(status)} className={cn("rounded px-2 py-1 text-[10px] transition", filter === status ? "bg-u-ink/[0.09] text-u-ink" : "text-u-muted hover:text-u-ink2")}>{status === "Pending Approval" ? "Pending" : status}</button>
              ))}
            </div>
            <Button variant="secondary" size="sm" icon={FilePlus2} onClick={() => setInvoiceOpen(true)}>Add invoice</Button>
            <Button variant="primary" size="sm" icon={CreditCard} onClick={() => startPayment()}>Record payment</Button>
          </div>
        </div>

        {invoices.length === 0 ? (
          <div className="p-4"><EmptyState icon={ReceiptText} title="No invoices in this view" description="Record a contractor or supplier invoice, then approve it. Approval is separate from payment." action={<Button size="sm" variant="primary" icon={FilePlus2} onClick={() => setInvoiceOpen(true)}>Add invoice</Button>} /></div>
        ) : (
          <div className="divide-y divide-u-ink/[0.055]">
            {invoices.map((invoice) => {
              const paid = invoicePaid(invoice, project.payments);
              const balance = invoiceBalance(invoice, project.payments);
              const total = invoiceTotal(invoice);
              const paymentStatus = paymentStatusFor(invoice, project.payments);
              const tasks = project.tasks.find((t) => t.id === invoice.taskId);
              const isOpen = expanded === invoice.id;
              const taxes = invoiceTaxes(invoice);
              return (
                <div key={invoice.id} className="transition hover:bg-u-ink/[0.012]">
                  <div className="flex flex-wrap items-start gap-2 px-3 py-3 sm:px-4">
                    <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border", invoice.approval === "Rejected" ? "border-u-danger/25 bg-u-danger/10 text-u-danger" : invoice.approval === "Approved" ? "border-u-ok/25 bg-u-ok/10 text-u-ok" : "border-u-warn/25 bg-u-warn/10 text-u-warn")}>
                      <ReceiptText className="h-4 w-4" />
                    </span>
                    <button onClick={() => setExpanded(isOpen ? null : invoice.id)} className="min-w-0 flex-1 text-left">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-[12px] font-semibold text-u-ink">{invoice.number}</span>
                        <StatusBadge status={invoice.approval} />
                        <StatusBadge status={paymentStatus} dot={false} />
                        {paymentStatus === "Overdue" && <span className="flex items-center gap-0.5 text-[9px] text-u-danger"><AlertTriangle className="h-2.5 w-2.5" /> past due</span>}
                      </span>
                      <span className="mt-0.5 block text-[10.5px] text-u-muted">{invoice.vendorName} <span className="text-u-muted">·</span> Invoiced {dateLong(invoice.invoiceDate)} <span className="text-u-muted">·</span> Due <span className={invoice.dueDate < TODAY && balance > 0 ? "text-u-danger" : ""}>{dateLong(invoice.dueDate)}</span>{tasks ? <> <span className="text-u-muted">·</span> {tasks.name}</> : null}</span>
                      {invoice.attachmentName && <span className="mt-0.5 flex items-center gap-1 text-[9px] text-u-muted"><Paperclip className="h-2.5 w-2.5" /> {invoice.attachmentName}</span>}
                    </button>
                    <div className="ml-auto flex items-center gap-3">
                      <div className="text-right">
                        <p className="font-mono text-[13px] text-u-ink">{money(total, { cents: true })}</p>
                        <p className="text-[9.5px] text-u-muted">{money(balance, { cents: true })} outstanding</p>
                      </div>
                      <div className="flex items-center gap-1">
                        {invoice.approval === "Pending Approval" && (
                          <>
                            <Button size="xs" variant="secondary" icon={Check} onClick={() => setInvoiceApproval(project.id, invoice.id, "Approved")} className="hidden sm:inline-flex">Approve</Button>
                            <button onClick={() => setInvoiceApproval(project.id, invoice.id, "Rejected")} aria-label="Reject invoice" className="flex h-7 w-7 items-center justify-center rounded-md border border-u-danger/25 bg-u-danger/10 text-u-danger hover:bg-u-danger/20"><X className="h-3.5 w-3.5" /></button>
                          </>
                        )}
                        {invoice.approval === "Approved" && balance > 0 && (
                          <Button size="xs" variant="secondary" icon={CreditCard} onClick={() => startPayment(invoice.id)} className="hidden sm:inline-flex">Pay</Button>
                        )}
                        <button onClick={() => setExpanded(isOpen ? null : invoice.id)} aria-label="Toggle invoice detail" className="flex h-7 w-7 items-center justify-center rounded-md text-u-muted hover:bg-u-ink/[0.05] hover:text-u-ink"><ArrowDown className={cn("h-3.5 w-3.5 transition", isOpen && "rotate-180")} /></button>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 px-4 pb-2 pl-[52px]">
                    <div className="flex min-w-[150px] flex-1 items-center gap-2">
                      <ProgressBar value={total ? (paid / total) * 100 : 0} tone={paid >= total && total > 0 ? "aqua" : paid > 0 ? "amber" : "sky"} height="h-1" />
                      <span className="shrink-0 font-mono text-[9px] text-u-muted">{money(paid)} / {money(total)}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[9px] text-u-muted">
                      <span className="rounded border border-u-ink/[0.07] px-1 py-0.5">{invoice.approval === "Pending Approval" ? "Approval required" : "Approval ≠ payment"}</span>
                      <span className="flex items-center gap-1"><LockKeyhole className="h-2.5 w-2.5" /> {invoice.createdBy}</span>
                    </div>
                  </div>

                  {isOpen && (
                    <div className="animate-ap-slide-up border-t border-u-ink/[0.04] bg-u-ink/[0.012] px-4 py-3 sm:pl-[52px]">
                      <div className="grid gap-3 lg:grid-cols-[1.6fr_1fr]">
                        <div className="overflow-hidden rounded-lg border border-u-ink/[0.06]">
                          <table className="w-full text-left">
                            <thead className="bg-u-ink/[0.025] text-[8.5px] uppercase tracking-[0.08em] text-u-muted"><tr><th className="px-2.5 py-1.5 font-semibold">Line item</th><th className="px-2 py-1.5 text-right font-semibold">Qty</th><th className="px-2 py-1.5 text-right font-semibold">Unit price</th><th className="px-2 py-1.5 text-right font-semibold">Tax</th><th className="px-2.5 py-1.5 text-right font-semibold">Net</th></tr></thead>
                            <tbody className="divide-y divide-u-ink/[0.04]">
                              {invoice.lines.map((line) => (
                                <tr key={line.id} className="text-[10.5px] text-u-ink2"><td className="px-2.5 py-1.5">{line.description}</td><td className="px-2 py-1.5 text-right font-mono">{line.quantity} {line.uom}</td><td className="px-2 py-1.5 text-right font-mono">{money(line.unitPriceCents, { cents: true })}</td><td className="px-2 py-1.5 text-right font-mono">{line.taxRate}%</td><td className="px-2.5 py-1.5 text-right font-mono text-u-ink">{money(Math.round(line.quantity * line.unitPriceCents), { cents: true })}</td></tr>
                              ))}
                            </tbody>
                          </table>
                          <div className="space-y-0.5 border-t border-u-ink/[0.06] bg-u-ink/[0.015] px-2.5 py-2 text-[10px]">
                            <div className="flex justify-between text-u-muted"><span>Subtotal</span><span className="font-mono">{money(invoiceSubtotal(invoice), { cents: true })}</span></div>
                            {invoice.discountCents > 0 && <div className="flex justify-between text-u-accent"><span>Discount</span><span className="font-mono">−{money(invoice.discountCents, { cents: true })}</span></div>}
                            {taxes.map((tax) => <div key={tax.rate} className="flex justify-between text-u-muted"><span>{tax.rate === 13 ? "HST" : tax.rate === 5 ? "GST" : "Tax"} @ {tax.rate}% on {money(tax.baseCents)}</span><span className="font-mono">{money(tax.taxCents, { cents: true })}</span></div>)}
                            <div className="flex justify-between border-t border-u-ink/[0.07] pt-1 font-medium text-u-ink"><span>Invoice total</span><span className="font-mono">{money(total, { cents: true })}</span></div>
                            <div className="flex justify-between text-u-ok"><span>Paid to date</span><span className="font-mono">{money(paid, { cents: true })}</span></div>
                            <div className="flex justify-between text-u-warn"><span>Outstanding balance</span><span className="font-mono">{money(balance, { cents: true })}</span></div>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="rounded-lg border border-u-ink/[0.06] bg-u-bg/50 p-2.5">
                            <p className="text-[8.5px] font-semibold uppercase tracking-[0.1em] text-u-muted">Invoice metadata</p>
                            <div className="mt-1 space-y-1 text-[10px]">
                              <div className="flex justify-between"><span className="text-u-muted">Received</span><span className="text-u-ink2">{dateLong(invoice.receivedDate)}</span></div>
                              <div className="flex justify-between"><span className="text-u-muted">PO reference</span><span className="font-mono text-u-ink2">{invoice.poId ?? "—"}</span></div>
                              <div className="flex justify-between"><span className="text-u-muted">Approval</span><StatusBadge status={invoice.approval} dot={false} /></div>
                              <div className="flex justify-between"><span className="text-u-muted">Payment status</span><StatusBadge status={paymentStatus} dot={false} /></div>
                            </div>
                          </div>
                          {invoice.notes && <div className="rounded-lg border border-u-ink/[0.06] bg-u-ink/[0.02] p-2.5 text-[10px] leading-relaxed text-u-muted">{invoice.notes}</div>}
                          <div className="flex flex-wrap gap-1.5">
                            {invoice.attachmentName && <Button size="xs" variant="subtle" icon={Download} onClick={() => notify("Document preview", "info", `${invoice.attachmentName} is stored in the secured project repository.`)}>Attachment</Button>}
                            {invoice.approval === "Pending Approval" && <Button size="xs" variant="primary" icon={Check} onClick={() => setInvoiceApproval(project.id, invoice.id, "Approved")}>Approve invoice</Button>}
                            {invoice.approval === "Approved" && balance > 0 && <Button size="xs" variant="secondary" icon={CreditCard} onClick={() => startPayment(invoice.id)}>Record payment</Button>}
                          </div>
                          <p className="flex items-start gap-1 text-[9px] leading-relaxed text-u-muted"><Info className="mt-0.5 h-2.5 w-2.5 shrink-0" /> Payment status is calculated from allocations and the invoice due date. Approving an invoice never marks it paid.</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-u-ink/[0.06] bg-u-ink/[0.012] px-4 py-2 text-[9.5px] text-u-muted">
          <span className="flex items-center gap-1"><ShieldCheck className="h-3 w-3" /> Duplicate invoice numbers are flagged within the vendor context before saving.</span>
          <span className="font-mono">{project.invoices.length} invoices · {project.payments.length} payments</span>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-u-ink/[0.06] px-4 py-3">
          <SectionHeader icon={CreditCard} title="Payment history" subtitle="Separate cash transactions allocated to approved invoices" />
          <div className="flex items-center gap-1.5">
            <Badge tone="aqua">{money(fin.paid)} paid</Badge>
            <Button variant="secondary" size="sm" icon={Plus} onClick={() => startPayment()}>Record payment</Button>
          </div>
        </div>
        {project.payments.length === 0 ? (
          <div className="p-4"><EmptyState compact icon={CreditCard} title="No payments recorded" description="Payments are separate transactions allocated against approved invoices." /></div>
        ) : (
          <div className="divide-y divide-u-ink/[0.05]">
            {project.payments.map((payment) => (
              <div key={payment.id} className="flex flex-wrap items-center gap-2 px-4 py-2.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-u-ok/20 bg-u-ok/[0.08] text-u-ok"><Banknote className="h-3.5 w-3.5" /></span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-1.5 text-[11px] font-medium text-u-ink"><span className="font-mono">{payment.id}</span> · {payment.payeeName} <Badge tone="slate">{payment.method}</Badge></p>
                  <p className="text-[9.5px] text-u-muted">{dateLong(payment.date)} · Ref {payment.reference} · Allocated to {payment.allocations.map((a) => project.invoices.find((i) => i.id === a.invoiceId)?.number ?? a.invoiceId).join(", ")}</p>
                  {payment.notes && <p className="mt-0.5 text-[9.5px] italic text-u-muted">{payment.notes}</p>}
                </div>
                <div className="text-right">
                  <p className="font-mono text-[12px] text-u-ok">{money(payment.amountCents, { cents: true })}</p>
                  <p className="text-[9px] text-u-muted">Recorded by {payment.recordedBy}</p>
                </div>
                {payment.proofName && <Button size="xs" variant="ghost" icon={Download} onClick={() => notify("Proof of payment", "info", payment.proofName)} className="hidden sm:inline-flex">Proof</Button>}
              </div>
            ))}
          </div>
        )}
      </Card>

      <AddInvoiceModal open={invoiceOpen} onClose={() => setInvoiceOpen(false)} project={project} />
      <RecordPaymentModal open={paymentOpen} onClose={() => setPaymentOpen(false)} project={project} defaultInvoiceId={paymentInvoice} />
    </div>
  );
}

function AddInvoiceModal({ open, onClose, project }: { open: boolean; onClose: () => void; project: Project }) {
  const { contractors, addInvoice, findDuplicateInvoice } = useStore();
  const [vendorId, setVendorId] = useState(project.team[0]?.contractorId ?? "");
  const [customVendor, setCustomVendor] = useState("");
  const [number, setNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(TODAY);
  const [receivedDate, setReceivedDate] = useState(TODAY);
  const [dueDate, setDueDate] = useState("");
  const [discount, setDiscount] = useState("");
  const [notes, setNotes] = useState("");
  const [attachmentName, setAttachmentName] = useState("");
  const [taskId, setTaskId] = useState("");
  const [poId, setPoId] = useState("");
  const [acknowledgedDuplicate, setAcknowledgedDuplicate] = useState(false);
  const [lines, setLines] = useState<Omit<InvoiceLine, "id">[]>([{ description: "", quantity: 1, uom: "lot", unitPriceCents: 0, taxRate: 13 }]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const vendorName = vendorId === "CUSTOM" ? customVendor : contractors.find((c) => c.id === vendorId)?.name ?? "";
  const duplicate = vendorId && number ? findDuplicateInvoice(vendorId, number) : undefined;
  const subtotal = lines.reduce((sum, line) => sum + Math.round(line.quantity * line.unitPriceCents), 0);
  const discountCents = parseMoneyToCents(discount);
  const taxGroups = useMemo(() => {
    const map = new Map<number, number>();
    lines.forEach((line) => {
      const net = Math.round(line.quantity * line.unitPriceCents);
      map.set(line.taxRate, (map.get(line.taxRate) ?? 0) + net);
    });
    return Array.from(map.entries()).map(([rate, base]) => ({ rate, base, tax: Math.round(((base - (subtotal ? (discountCents * base) / subtotal : 0)) * rate) / 100) }));
  }, [lines, subtotal, discountCents]);
  const taxTotal = taxGroups.reduce((sum, group) => sum + group.tax, 0);
  const total = subtotal - discountCents + taxTotal;

  const updateLine = (index: number, patch: Partial<Omit<InvoiceLine, "id">>) => setLines((current) => current.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  const removeLine = (index: number) => setLines((current) => current.filter((_, i) => i !== index));

  const submit = () => {
    const nextErrors: Record<string, string> = {};
    if (!vendorId || (vendorId === "CUSTOM" && !customVendor.trim())) nextErrors.vendorId = "Select or enter a vendor.";
    if (!number.trim()) nextErrors.number = "Invoice number is required.";
    if (!dueDate) nextErrors.dueDate = "Payment due date is required.";
    if (dueDate && dueDate < invoiceDate) nextErrors.dueDate = "Due date cannot precede the invoice date.";
    if (!lines.some((line) => line.description.trim() && line.quantity > 0 && line.unitPriceCents > 0)) nextErrors.lines = "Add at least one complete line item.";
    if (discountCents > subtotal) nextErrors.lines = "Invoice discount cannot exceed the line-item subtotal.";
    if (duplicate && !acknowledgedDuplicate) nextErrors.duplicate = "Review the possible duplicate invoice before saving.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    const result = addInvoice(project.id, {
      number: number.trim(),
      vendorId,
      vendorName,
      invoiceDate,
      receivedDate,
      dueDate,
      discountCents,
      lines: lines.map((line, index) => ({ ...line, id: `${number || "INV"}-L${index + 1}` })),
      approval: "Pending Approval",
      notes,
      attachmentName: attachmentName || undefined,
      taskId: taskId || undefined,
      poId: poId || undefined,
    });
    if (result.ok) {
      onClose();
      setNumber(""); setLines([{ description: "", quantity: 1, uom: "lot", unitPriceCents: 0, taxRate: 13 }]); setAttachmentName(""); setNotes(""); setAcknowledgedDuplicate(false); setDiscount("");
    } else setErrors({ form: result.error ?? "Unable to record invoice." });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record contractor invoice"
      description="Invoices are submitted for approval. Payment status remains independent and is derived from allocations."
      icon={FilePlus2}
      size="lg"
      footer={<><Button variant="ghost" size="md" onClick={onClose}>Cancel</Button><Button variant="primary" size="md" icon={Check} onClick={submit}>Submit invoice · {money(total, { cents: true })}</Button></>}
    >
      <div className="space-y-3">
        {errors.form && <InfoNote tone="warning">{errors.form}</InfoNote>}
        {duplicate && (
          <div className="rounded-lg border border-u-warn/25 bg-u-warn/[0.07] p-2.5">
            <p className="flex items-center gap-1 text-[11px] font-semibold text-u-warn"><AlertTriangle className="h-3.5 w-3.5" /> Possible duplicate invoice</p>
            <p className="mt-0.5 text-[10.5px] leading-relaxed text-u-warn/70">Invoice {duplicate.number} already exists for {duplicate.vendorName} on project {duplicate.projectId} ({duplicate.approval}). Review before creating another record.</p>
            <label className="mt-1.5 flex items-center gap-1.5 text-[10px] text-u-warn/80"><input type="checkbox" className="h-3 w-3 accent-u-warn" checked={acknowledgedDuplicate} onChange={(e) => setAcknowledgedDuplicate(e.target.checked)} /> I have reviewed this and confirm it is a different invoice.</label>
            {errors.duplicate && <p className="mt-1 text-[10px] text-u-danger">{errors.duplicate}</p>}
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Contractor / vendor" required error={errors.vendorId} className="sm:col-span-1">
            <Select value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
              <option value="">Select vendor…</option>
              {contractors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              <option value="CUSTOM">Other supplier…</option>
            </Select>
            {vendorId === "CUSTOM" && <Input className="mt-1.5" value={customVendor} onChange={(e) => setCustomVendor(e.target.value)} placeholder="Supplier name" />}
          </Field>
          <Field label="Invoice number" required error={errors.number}><Input value={number} onChange={(e) => { setNumber(e.target.value); setAcknowledgedDuplicate(false); }} placeholder="e.g. HR-2088" /></Field>
          <Field label="Related task (optional)"><Select value={taskId} onChange={(e) => setTaskId(e.target.value)}><option value="">Project-level</option>{project.tasks.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select></Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-4">
          <Field label="Invoice date"><Input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} /></Field>
          <Field label="Received date"><Input type="date" value={receivedDate} onChange={(e) => setReceivedDate(e.target.value)} /></Field>
          <Field label="Payment due" required error={errors.dueDate}><Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></Field>
          <Field label="Related PO"><Select value={poId} onChange={(e) => setPoId(e.target.value)}><option value="">None</option>{project.purchaseOrders.map((po) => <option key={po.id} value={po.id}>{po.number}</option>)}</Select></Field>
        </div>

        <div className="rounded-xl border border-u-ink/[0.07]">
          <div className="flex items-center justify-between border-b border-u-ink/[0.06] px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-u-muted">Invoice line items</p>
            <Button size="xs" variant="secondary" icon={Plus} onClick={() => setLines((current) => [...current, { description: "", quantity: 1, uom: "ea", unitPriceCents: 0, taxRate: 13 }])}>Add line</Button>
          </div>
          <div className="space-y-1.5 p-2">
            {lines.map((line, index) => (
              <div key={index} className="grid grid-cols-12 gap-1.5">
                <Input className="col-span-12 sm:col-span-5" value={line.description} onChange={(e) => updateLine(index, { description: e.target.value })} placeholder="Description" />
                <Input className="col-span-3 sm:col-span-1" type="number" min="0" step="0.01" value={line.quantity} onChange={(e) => updateLine(index, { quantity: Number.parseFloat(e.target.value) || 0 })} aria-label="Quantity" />
                <Select className="col-span-3 sm:col-span-1" value={line.uom} onChange={(e) => updateLine(index, { uom: e.target.value })}>{["lot", "ea", "hr", "day", "sqft", "LF"].map((u) => <option key={u}>{u}</option>)}</Select>
                <Input className="col-span-4 sm:col-span-2" inputMode="decimal" placeholder="Unit price" value={line.unitPriceCents ? (line.unitPriceCents / 100).toString() : ""} onChange={(e) => updateLine(index, { unitPriceCents: parseMoneyToCents(e.target.value) })} aria-label="Unit price" />
                <div className="col-span-2"><Input type="number" min="0" max="30" step="0.001" value={line.taxRate} onChange={(e) => updateLine(index, { taxRate: Number.parseFloat(e.target.value) || 0 })} aria-label="Tax rate %" /></div>
                <div className="col-span-2 flex items-center justify-end gap-0.5 sm:col-span-1">
                  <span className="hidden font-mono text-[9px] text-u-muted sm:inline">{money(Math.round(line.quantity * line.unitPriceCents), { compact: true })}</span>
                  <button onClick={() => removeLine(index)} disabled={lines.length === 1} aria-label="Remove line" className="flex h-7 w-7 items-center justify-center rounded text-u-muted hover:bg-u-danger/10 hover:text-u-danger disabled:opacity-30"><Trash2 className="h-3 w-3" /></button>
                </div>
              </div>
            ))}
          </div>
          {errors.lines && <p className="px-3 pb-2 text-[10px] text-u-danger">{errors.lines}</p>}
          <div className="grid gap-2 border-t border-u-ink/[0.06] bg-u-ink/[0.015] p-2.5 sm:grid-cols-[1fr_auto]">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <div><p className="text-[8.5px] uppercase tracking-wide text-u-muted">Subtotal</p><p className="font-mono text-[11px] text-u-ink">{money(subtotal, { cents: true })}</p></div>
              <div><p className="text-[8.5px] uppercase tracking-wide text-u-muted">Tax ({taxGroups.map((g) => `${g.rate}%`).join(", ") || "—"})</p><p className="font-mono text-[11px] text-u-ink">{money(taxTotal, { cents: true })}</p></div>
              <div><p className="text-[8.5px] uppercase tracking-wide text-u-muted">Total</p><p className="font-mono text-[12px] font-medium text-u-accent">{money(total, { cents: true })}</p></div>
            </div>
            <div className="w-full sm:w-[132px]"><Field label="Discount (CAD)"><Input inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0.00" /></Field></div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Invoice attachment" hint="PDF, JPG or PNG · max 10 MB">
            <label className="flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-dashed border-u-ink/15 bg-u-bg/60 px-3 text-[11px] text-u-muted hover:border-u-accent/40 hover:text-u-ink">
              <Paperclip className="h-3.5 w-3.5" /> {attachmentName || "Attach invoice document"}
              <input type="file" accept=".pdf,.png,.jpg,.jpeg" className="hidden" onChange={(e) => setAttachmentName(e.target.files?.[0]?.name ?? "")} />
            </label>
          </Field>
          <Field label="Notes"><Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Approval or reconciliation notes" /></Field>
        </div>
        <InfoNote>Line items and tax totals must reconcile. The invoice is saved as Pending Approval; separate approval permission is required.</InfoNote>
      </div>
    </Modal>
  );
}

function RecordPaymentModal({ open, onClose, project, defaultInvoiceId }: { open: boolean; onClose: () => void; project: Project; defaultInvoiceId?: string }) {
  const { recordPayment, notify } = useStore();
  const availableInvoices = project.invoices.filter((invoice) => invoice.approval === "Approved" && invoiceBalance(invoice, project.payments) > 0);
  const [date, setDate] = useState(TODAY);
  const [method, setMethod] = useState<PaymentMethod>("EFT");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [proofName, setProofName] = useState("");
  const [allocations, setAllocations] = useState<{ invoiceId: string; amount: string }[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    setAllocations([]);
    setReference("");
    setNotes("");
    setProofName("");
    setErrors({});
    setDate(TODAY);
    setMethod("EFT");
  }, [open, defaultInvoiceId]);

  const initialised = useMemo(() => Boolean(defaultInvoiceId) || open, [defaultInvoiceId, open]);
  const effectiveAllocations = allocations.length
    ? allocations
    : defaultInvoiceId
      ? [{ invoiceId: defaultInvoiceId, amount: (invoiceBalance(project.invoices.find((i) => i.id === defaultInvoiceId)!, project.payments) / 100).toFixed(2) }]
      : [];
  const firstInvoice = project.invoices.find((invoice) => invoice.id === effectiveAllocations[0]?.invoiceId);
  const vendorId = firstInvoice?.vendorId;
  const vendorInvoices = availableInvoices.filter((invoice) => !vendorId || invoice.vendorId === vendorId);
  const totalCents = effectiveAllocations.reduce((sum, allocation) => sum + parseMoneyToCents(allocation.amount), 0);

  const setEffective = (next: { invoiceId: string; amount: string }[]) => setAllocations(next);
  const updateAllocation = (index: number, patch: Partial<{ invoiceId: string; amount: string }>) => setEffective(effectiveAllocations.map((allocation, i) => (i === index ? { ...allocation, ...patch } : allocation)));

  const submit = () => {
    const nextErrors: Record<string, string> = {};
    if (!effectiveAllocations.length) nextErrors.allocations = "Add at least one invoice allocation.";
    if (totalCents <= 0) nextErrors.allocations = "Payment amount must be greater than zero.";
    effectiveAllocations.forEach((allocation) => {
      const invoice = project.invoices.find((i) => i.id === allocation.invoiceId);
      if (!invoice) { nextErrors.allocations = "Select a valid invoice."; return; }
      const amount = parseMoneyToCents(allocation.amount);
      const balance = invoiceBalance(invoice, project.payments);
      if (amount > balance) nextErrors.allocations = `Allocation to ${invoice.number} exceeds its available balance of ${money(balance, { cents: true })}.`;
    });
    if (!reference.trim()) nextErrors.reference = "A transaction reference is required.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    const result = recordPayment(project.id, {
      payeeId: firstInvoice?.vendorId ?? "",
      payeeName: firstInvoice?.vendorName ?? "",
      date,
      amountCents: totalCents,
      method,
      reference: reference.trim(),
      allocations: effectiveAllocations.map((allocation) => ({ invoiceId: allocation.invoiceId, amountCents: parseMoneyToCents(allocation.amount) })),
      notes,
      proofName: proofName || undefined,
    });
    if (result.ok) {
      onClose();
      setAllocations([]); setReference(""); setNotes(""); setProofName("");
      notify("Payment recorded", "success", "Invoice balances and outstanding payables were recalculated.");
    } else setErrors({ form: result.error ?? "Unable to record payment." });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record payment"
      description="Payments are recorded separately from expenses and allocated to approved invoices. Allocations cannot exceed the available balance."
      icon={CreditCard}
      footer={<><Button variant="ghost" size="md" onClick={onClose}>Cancel</Button><Button variant="primary" size="md" icon={Banknote} onClick={submit} disabled={!initialised || availableInvoices.length === 0}>Record {money(totalCents, { cents: true })} payment</Button></>}
    >
      {availableInvoices.length === 0 ? (
        <EmptyState icon={ReceiptText} title="No approved invoices available to pay" description="Approve an invoice first. Approval and payment are separate steps, and rejected invoices cannot receive allocations." />
      ) : (
        <div className="space-y-3">
          {errors.form && <InfoNote tone="warning">{errors.form}</InfoNote>}
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Payment date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
            <Field label="Payment method"><Select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>{paymentMethods.map((m) => <option key={m}>{m}</option>)}</Select></Field>
            <Field label="Reference / transaction #" required error={errors.reference}><Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="EFT-889401" /></Field>
          </div>

          <div className="rounded-xl border border-u-ink/[0.07]">
            <div className="flex items-center justify-between border-b border-u-ink/[0.06] px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-u-muted">Allocate to invoices</p>
              <Button
                size="xs"
                variant="secondary"
                icon={Plus}
                disabled={!firstInvoice}
                onClick={() => setEffective([...effectiveAllocations, { invoiceId: "", amount: "" }])}
              >
                Add allocation
              </Button>
            </div>
            <div className="space-y-2 p-2.5">
              {effectiveAllocations.map((allocation, index) => {
                const invoice = project.invoices.find((i) => i.id === allocation.invoiceId);
                const balance = invoice ? invoiceBalance(invoice, project.payments) : 0;
                return (
                  <div key={index} className="grid grid-cols-12 items-end gap-2">
                    <div className="col-span-12 sm:col-span-7">
                      <p className="mb-1 text-[8.5px] uppercase tracking-wide text-u-muted">Invoice</p>
                      <Select value={allocation.invoiceId} onChange={(e) => { const inv = project.invoices.find((i) => i.id === e.target.value); updateAllocation(index, { invoiceId: e.target.value, amount: inv ? (invoiceBalance(inv, project.payments) / 100).toFixed(2) : "" }); }}>
                        <option value="">Select approved invoice…</option>
                        {vendorInvoices.map((invoice) => (
                          <option key={invoice.id} value={invoice.id}>{invoice.number} — {invoice.vendorName} — {money(invoiceBalance(invoice, project.payments))} available</option>
                        ))}
                      </Select>
                    </div>
                    <div className="col-span-8 sm:col-span-3">
                      <p className="mb-1 text-[8.5px] uppercase tracking-wide text-u-muted">Amount (available {money(balance, { cents: true })})</p>
                      <Input inputMode="decimal" value={allocation.amount} onChange={(e) => updateAllocation(index, { amount: e.target.value })} />
                    </div>
                    <div className="col-span-4 flex justify-end sm:col-span-2">
                      <button onClick={() => setEffective(effectiveAllocations.filter((_, i) => i !== index))} disabled={effectiveAllocations.length === 1} aria-label="Remove allocation" className="mb-0.5 flex h-8 w-8 items-center justify-center rounded-md border border-u-ink/[0.07] text-u-muted hover:border-u-danger/30 hover:text-u-danger disabled:opacity-30"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                );
              })}
              {errors.allocations && <p className="flex items-center gap-1 text-[10px] text-u-danger"><AlertTriangle className="h-3 w-3" /> {errors.allocations}</p>}
            </div>
            <div className="grid gap-2 border-t border-u-ink/[0.06] bg-u-ink/[0.015] p-2.5 sm:grid-cols-3">
              <div><p className="text-[8.5px] uppercase tracking-wide text-u-muted">Payee</p><p className="truncate text-[11px] text-u-ink">{firstInvoice?.vendorName ?? "Select an invoice"}</p></div>
              <div><p className="text-[8.5px] uppercase tracking-wide text-u-muted">Allocations</p><p className="text-[11px] text-u-ink">{effectiveAllocations.filter((a) => a.invoiceId).length} invoice{effectiveAllocations.filter((a) => a.invoiceId).length === 1 ? "" : "s"}</p></div>
              <div><p className="text-[8.5px] uppercase tracking-wide text-u-muted">Payment total</p><p className="font-mono text-[13px] font-medium text-u-accent">{money(totalCents, { cents: true })}</p></div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Proof of payment" hint="Confirmation PDF or image"><label className="flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-dashed border-u-ink/15 bg-u-bg/60 px-3 text-[11px] text-u-muted hover:border-u-accent/40 hover:text-u-ink"><Paperclip className="h-3.5 w-3.5" /> {proofName || "Attach proof of payment"}<input type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg" onChange={(e) => setProofName(e.target.files?.[0]?.name ?? "")} /></label></Field>
            <Field label="Payment notes"><Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Progress draw #2 partial payment" /></Field>
          </div>
        </div>
      )}
    </Modal>
  );
}
