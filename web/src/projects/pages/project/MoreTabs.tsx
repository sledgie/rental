import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Ban,
  CalendarClock,
  CalendarRange,
  Camera,
  Check,
  CheckCircle2,
  CircleDollarSign,
  Clock,
  Download,
  Eye,
  FileBadge,
  FileCheck2,
  FileDiff,
  FileSignature,
  FileText,
  GitPullRequest,
  HardHat,
  History,
  Image,
  Info,
  LockKeyhole,
  Paperclip,
  Plus,
  Receipt,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  Sparkles,
  Stamp,
  Timer,
  TrendingUp,
  Upload,
  UserRound,
  Wallet,
  X,
} from "lucide-react";
import { useStore } from "../../lib/store";
import {
  approvedChangeOrderTotal,
  approvedScheduleImpact,
  canCompleteProject,
  currentApprovedBudget,
  dateLong,
  dateShort,
  daysBetween,
  money,
  parseMoneyToCents,
  projectFinancials,
  TODAY,
} from "../../lib/finance";
import type { ChangeOrder, Deficiency, DocumentCategory, Inspection, Project } from "../../lib/types";
import { Avatar, Badge, Button, Card, EmptyState, Field, InfoNote, Input, Modal, ProgressRing, SectionHeader, Select, StatusBadge, Textarea, ToneIcon } from "../../components/ui";
import { cn } from "../../utils/cn";

/* ----------------------------- Quotes & POs ------------------------------ */

export function CommercialTab({ project }: { project: Project }) {
  const quoteValue = project.quotes.reduce((sum, quote) => sum + quote.totalCents, 0);
  const accepted = project.quotes.filter((q) => q.status === "Accepted").reduce((sum, q) => sum + q.totalCents, 0);
  const poValue = project.purchaseOrders.reduce((sum, po) => sum + po.totalCents, 0);
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="flex items-center gap-3 p-3.5"><ToneIcon icon={FileSignature} tone="violet" /><div><p className="text-[9.5px] uppercase tracking-[0.1em] text-u-muted">Quotes received</p><p className="font-mono text-[17px] text-u-ink">{project.quotes.length}</p><p className="text-[9.5px] text-u-muted">{money(quoteValue, { compact: true })} total value</p></div></Card>
        <Card className="flex items-center gap-3 p-3.5"><ToneIcon icon={CheckCircle2} tone="acid" /><div><p className="text-[9.5px] uppercase tracking-[0.1em] text-u-muted">Accepted quote value</p><p className="font-mono text-[17px] text-u-ink">{money(accepted, { compact: true })}</p><p className="text-[9.5px] text-u-muted">Becomes the contract baseline</p></div></Card>
        <Card className="flex items-center gap-3 p-3.5"><ToneIcon icon={Receipt} tone="sky" /><div><p className="text-[9.5px] uppercase tracking-[0.1em] text-u-muted">Purchase orders</p><p className="font-mono text-[17px] text-u-ink">{project.purchaseOrders.length}</p><p className="text-[9.5px] text-u-muted">{money(poValue, { compact: true })} approved value</p></div></Card>
        <Card className="flex items-center gap-3 p-3.5"><ToneIcon icon={Clock} tone="amber" /><div><p className="text-[9.5px] uppercase tracking-[0.1em] text-u-muted">Awaiting decision</p><p className="font-mono text-[17px] text-u-ink">{project.quotes.filter((q) => q.status === "Pending").length}</p><p className="text-[9.5px] text-u-muted">Quotes pending acceptance</p></div></Card>
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-u-ink/[0.06] px-4 py-3"><SectionHeader icon={FileSignature} title="Contractor quotes" subtitle="Issued quotes with tax breakdown and acceptance status" /><Badge tone="slate">Read-only in demo</Badge></div>
        {project.quotes.length === 0 ? (
          <div className="p-4"><EmptyState icon={FileSignature} title="No quotes on file" description="Request quotes from contractors in the directory to establish a priced scope." /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left">
              <thead className="border-b border-u-ink/[0.05] bg-u-ink/[0.014] text-[9px] uppercase tracking-[0.09em] text-u-muted"><tr><th className="px-4 py-2 font-semibold">Quote / contractor</th><th className="px-2 py-2 font-semibold">Issued / expires</th><th className="px-2 py-2 font-semibold">Description</th><th className="px-2 py-2 text-right font-semibold">Subtotal</th><th className="px-2 py-2 text-right font-semibold">Tax</th><th className="px-2 py-2 text-right font-semibold">Total</th><th className="px-2 py-2 font-semibold">Status</th><th className="px-3 py-2" /></tr></thead>
              <tbody className="divide-y divide-u-ink/[0.045]">
                {project.quotes.map((quote) => (
                  <tr key={quote.id} className="text-[11px] hover:bg-u-ink/[0.018]">
                    <td className="px-4 py-2.5"><p className="font-mono text-[10.5px] font-medium text-u-ink">{quote.number}</p><p className="text-[9.5px] text-u-muted">{quote.contractorName}</p></td>
                    <td className="px-2 py-2.5"><p className="text-[10px] text-u-ink2">{dateLong(quote.issueDate)}</p><p className={cn("text-[9px]", quote.expiryDate < TODAY ? "text-u-danger" : "text-u-muted")}>Expires {dateLong(quote.expiryDate)}</p></td>
                    <td className="max-w-[240px] px-2 py-2.5"><p className="truncate text-[10px] text-u-muted">{quote.description}</p></td>
                    <td className="px-2 py-2.5 text-right font-mono text-[10px] text-u-ink2">{money(quote.subtotalCents)}</td>
                    <td className="px-2 py-2.5 text-right font-mono text-[10px] text-u-muted">{money(quote.taxCents)}<span className="ml-1 text-[8.5px] text-u-muted">{quote.taxRate}%</span></td>
                    <td className="px-2 py-2.5 text-right font-mono text-[10.5px] text-u-ink">{money(quote.totalCents)}</td>
                    <td className="px-2 py-2.5"><StatusBadge status={quote.status} /></td>
                    <td className="px-3 py-2.5">{quote.attachmentName && <span title={quote.attachmentName} className="flex h-6 w-6 items-center justify-center rounded text-u-muted"><Paperclip className="h-3 w-3" /></span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-u-ink/[0.06] px-4 py-3"><SectionHeader icon={Receipt} title="Purchase orders" subtitle="Approved items, quantities and expected delivery" /><Badge tone="slate">{project.purchaseOrders.length} POs</Badge></div>
        {project.purchaseOrders.length === 0 ? (
          <div className="p-4"><EmptyState icon={Receipt} title="No purchase orders" description="Issue a purchase order for approved materials and long-lead items." /></div>
        ) : (
          <div className="divide-y divide-u-ink/[0.05]">
            {project.purchaseOrders.map((po) => (
              <div key={po.id} className="flex flex-wrap items-center gap-2 px-4 py-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-u-ink/[0.07] bg-u-ink/[0.03] text-u-violet"><Receipt className="h-3.5 w-3.5" /></span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-1.5 text-[11.5px] font-medium text-u-ink"><span className="font-mono">{po.number}</span> · {po.vendorName} <StatusBadge status={po.status} /></p>
                  <p className="truncate text-[9.5px] text-u-muted">{po.items}</p>
                  <p className="mt-0.5 text-[9px] text-u-muted">Approved {dateLong(po.approvalDate)} by {po.approvedBy} · Expected {dateLong(po.expectedDelivery)}</p>
                </div>
                <div className="text-right"><p className="font-mono text-[11.5px] text-u-ink">{money(po.totalCents)}</p><p className="text-[9px] text-u-muted">{po.quantity} item{po.quantity === 1 ? "" : "s"} · tax {money(po.taxCents)}</p></div>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between border-t border-u-ink/[0.06] bg-u-ink/[0.012] px-4 py-2 text-[9.5px] text-u-muted"><span className="flex items-center gap-1"><ShieldCheck className="h-3 w-3" /> Committed value is captured from awarded contracts and approved purchase orders.</span><span>{money(projectFinancials(project).committed)} committed</span></div>
      </Card>
    </div>
  );
}

/* ------------------------------ Change orders ----------------------------- */

export function ChangeOrdersTab({ project }: { project: Project }) {
  const { addChangeOrder, decideChangeOrder } = useStore();
  const [open, setOpen] = useState(false);
  const [rejecting, setRejecting] = useState<ChangeOrder | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const approved = project.changeOrders.filter((c) => c.approval === "Approved");
  const pending = project.changeOrders.filter((c) => c.approval === "Pending Approval");

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="flex items-center gap-3 p-3.5"><ToneIcon icon={CircleDollarSign} tone="acid" /><div><p className="text-[9.5px] uppercase tracking-[0.1em] text-u-muted">Approved impact</p><p className={cn("font-mono text-[17px]", approvedChangeOrderTotal(project) >= 0 ? "text-u-ink" : "text-u-accent")}>{approvedChangeOrderTotal(project) >= 0 ? "+" : "−"}{money(Math.abs(approvedChangeOrderTotal(project)))}</p><p className="text-[9.5px] text-u-muted">{approved.length} approved change orders</p></div></Card>
        <Card className="flex items-center gap-3 p-3.5"><ToneIcon icon={CalendarRange} tone="sky" /><div><p className="text-[9.5px] uppercase tracking-[0.1em] text-u-muted">Approved schedule impact</p><p className="font-mono text-[17px] text-u-ink">{approvedScheduleImpact(project)} days</p><p className="text-[9.5px] text-u-muted">Applied to approved schedule</p></div></Card>
        <Card className="flex items-center gap-3 p-3.5"><ToneIcon icon={Clock} tone="amber" /><div><p className="text-[9.5px] uppercase tracking-[0.1em] text-u-muted">Awaiting approval</p><p className={cn("font-mono text-[17px]", pending.length ? "text-u-warn" : "text-u-ink")}>{pending.length}</p><p className="text-[9.5px] text-u-muted">No budget impact until approved</p></div></Card>
        <Card className="flex items-center gap-3 p-3.5"><ToneIcon icon={Wallet} tone="violet" /><div><p className="text-[9.5px] uppercase tracking-[0.1em] text-u-muted">Current approved budget</p><p className="font-mono text-[17px] text-u-ink">{money(currentApprovedBudget(project))}</p><p className="text-[9.5px] text-u-muted">Original {money(project.originalBudgetCents)}</p></div></Card>
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-u-ink/[0.06] px-4 py-3">
          <SectionHeader icon={FileDiff} title="Change-order register" subtitle="Scope, budget and schedule changes with approval trace" />
          <Button variant="primary" size="sm" icon={Plus} onClick={() => setOpen(true)}>Request change</Button>
        </div>
        {project.changeOrders.length === 0 ? (
          <div className="p-4"><EmptyState icon={FileDiff} title="No change orders" description="Scope, budget or schedule changes must be captured through an approved change order." action={<Button size="sm" variant="primary" icon={Plus} onClick={() => setOpen(true)}>Create change order</Button>} /></div>
        ) : (
          <div className="divide-y divide-u-ink/[0.05]">
            {project.changeOrders.map((co) => (
              <div key={co.id} className="px-4 py-3">
                <div className="flex flex-wrap items-start gap-2">
                  <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border", co.approval === "Approved" ? "border-u-ok/25 bg-u-ok/10 text-u-ok" : co.approval === "Rejected" ? "border-u-danger/25 bg-u-danger/10 text-u-danger" : "border-u-warn/25 bg-u-warn/10 text-u-warn")}><FileDiff className="h-4 w-4" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-1.5"><span className="font-mono text-[11.5px] font-semibold text-u-ink">{co.number}</span><StatusBadge status={co.approval} /><span className="text-[9.5px] text-u-muted">Requested {dateLong(co.dateRequested)} by {co.requestedBy}</span></p>
                    <p className="mt-1 text-[11.5px] text-u-ink">{co.description}</p>
                    <p className="mt-0.5 text-[10px] text-u-muted"><span className="text-u-muted">Reason:</span> {co.reason}</p>
                    {co.supportingDocument && <p className="mt-1 flex items-center gap-1 text-[9.5px] text-u-muted"><Paperclip className="h-2.5 w-2.5" /> {co.supportingDocument}</p>}
                    {co.approval === "Rejected" && co.rejectionReason && <p className="mt-1 rounded border border-u-danger/20 bg-u-danger/[0.06] px-2 py-1 text-[9.5px] text-u-danger/80">Rejected: {co.rejectionReason}</p>}
                  </div>
                  <div className="text-right">
                    <p className={cn("font-mono text-[12px]", co.approval === "Pending Approval" ? "text-u-ink2" : co.costDeltaCents >= 0 ? "text-u-warn" : "text-u-accent")}>{co.costDeltaCents >= 0 ? "+" : "−"}{money(Math.abs(co.costDeltaCents))}</p>
                    <p className="text-[9.5px] text-u-muted">{co.scheduleImpactDays >= 0 ? "+" : ""}{co.scheduleImpactDays} days schedule</p>
                    {co.approval === "Approved" ? <p className="mt-0.5 text-[9px] text-u-ok">Approved {dateLong(co.approvalDate)}</p> : co.approval === "Pending Approval" ? (
                      <div className="mt-1 flex items-center gap-1">
                        <Button size="xs" variant="primary" icon={Check} onClick={() => decideChangeOrder(project.id, co.id, true)}>Approve</Button>
                        <Button size="xs" variant="danger" icon={X} onClick={() => { setRejecting(co); setRejectReason(""); }}>Reject</Button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-start gap-1 border-t border-u-ink/[0.06] bg-u-ink/[0.012] px-4 py-2 text-[9.5px] text-u-muted"><Info className="mt-0.5 h-3 w-3 shrink-0" /> Only approved change orders update the current approved budget and approved schedule. Original values and decision history are retained.</div>
      </Card>

      <NewChangeOrderModal open={open} onClose={() => setOpen(false)} project={project} onAdd={addChangeOrder} />

      <Modal open={!!rejecting} onClose={() => setRejecting(null)} title={`Reject ${rejecting?.number ?? "change order"}`} description="A reason is required and will be recorded in the audit trail." icon={Ban} size="sm"
        footer={<><Button variant="ghost" size="sm" onClick={() => setRejecting(null)}>Cancel</Button><Button variant="danger" size="sm" icon={X} onClick={() => { if (!rejecting) return; if (!rejectReason.trim()) return; decideChangeOrder(project.id, rejecting.id, false, rejectReason); setRejecting(null); }}>Reject change order</Button></>}>
        <Field label="Rejection reason" required><Textarea rows={3} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Why is this change not approved?" /></Field>
      </Modal>
    </div>
  );
}

function NewChangeOrderModal({ open, onClose, project, onAdd }: { open: boolean; onClose: () => void; project: Project; onAdd: (projectId: string, co: Omit<ChangeOrder, "id" | "projectId">) => { ok: boolean; error?: string } }) {
  const [form, setForm] = useState({ description: "", reason: "", requestedBy: "Avery Chen", dateRequested: TODAY, costDelta: "", scheduleImpact: "0", supportingDocument: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const submit = () => {
    const nextErrors: Record<string, string> = {};
    if (!form.description.trim()) nextErrors.description = "Describe the requested change.";
    if (!form.reason.trim()) nextErrors.reason = "A reason is required.";
    if (!form.supportingDocument) nextErrors.supportingDocument = "Attach a supporting quote or document.";
    if (!form.costDelta || Number.isNaN(Number(form.costDelta))) nextErrors.costDelta = "Enter the cost impact (use a negative value for a decrease).";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    const amount = parseMoneyToCents(form.costDelta);
    const result = onAdd(project.id, {
      number: `CO-${String(project.changeOrders.length + 1).padStart(2, "0")}`,
      description: form.description.trim(),
      reason: form.reason.trim(),
      requestedBy: form.requestedBy,
      dateRequested: form.dateRequested,
      costDeltaCents: Math.abs(amount) * (Number(form.costDelta) < 0 ? -1 : 1),
      scheduleImpactDays: Number.parseInt(form.scheduleImpact, 10) || 0,
      supportingDocument: form.supportingDocument,
      approval: "Pending Approval",
    });
    if (result.ok) { onClose(); setForm({ ...form, description: "", reason: "", costDelta: "", scheduleImpact: "0", supportingDocument: "" }); }
    else setErrors({ form: result.error ?? "Unable to create change order." });
  };
  return (
    <Modal open={open} onClose={onClose} title="Request change order" description="Pending changes do not affect the approved budget or schedule until approved." icon={FileDiff}
      footer={<><Button variant="ghost" size="md" onClick={onClose}>Cancel</Button><Button variant="primary" size="md" icon={GitPullRequest} onClick={submit}>Submit for approval</Button></>}>
      <div className="space-y-3">
        {errors.form && <InfoNote tone="warning">{errors.form}</InfoNote>}
        <Field label="Description of requested change" required error={errors.description}><Textarea rows={2} value={form.description} onChange={(e) => setForm((c) => ({ ...c, description: e.target.value }))} placeholder="What is changing in scope, budget or schedule?" /></Field>
        <Field label="Reason" required error={errors.reason}><Input value={form.reason} onChange={(e) => setForm((c) => ({ ...c, reason: e.target.value }))} placeholder="Why is this change necessary?" /></Field>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Requesting person"><Input value={form.requestedBy} onChange={(e) => setForm((c) => ({ ...c, requestedBy: e.target.value }))} /></Field>
          <Field label="Date requested"><Input type="date" value={form.dateRequested} onChange={(e) => setForm((c) => ({ ...c, dateRequested: e.target.value }))} /></Field>
          <Field label="Cost impact (CAD)" required error={errors.costDelta} hint="Negative for a decrease"><Input value={form.costDelta} onChange={(e) => setForm((c) => ({ ...c, costDelta: e.target.value }))} placeholder="1,850" /></Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Schedule impact (days)" hint="Negative for early completion"><Input type="number" value={form.scheduleImpact} onChange={(e) => setForm((c) => ({ ...c, scheduleImpact: e.target.value }))} /></Field>
          <Field label="Supporting quote / document" required error={errors.supportingDocument}>
            <label className="flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-dashed border-u-ink/15 bg-u-bg/60 px-3 text-[11px] text-u-muted hover:border-u-accent/40 hover:text-u-ink"><Paperclip className="h-3.5 w-3.5" /> {form.supportingDocument || "Attach supporting document"}<input type="file" className="hidden" onChange={(e) => setForm((c) => ({ ...c, supportingDocument: e.target.files?.[0]?.name ?? "" }))} /></label>
          </Field>
        </div>
        <InfoNote>The change order is submitted as Pending Approval. Finance permission is required to approve, and the full decision history is retained.</InfoNote>
      </div>
    </Modal>
  );
}

/* -------------------------------- Schedule ------------------------------- */

export function ScheduleTab({ project }: { project: Project }) {
  const { setMilestoneStatus } = useStore();
  const completed = project.milestones.filter((m) => m.status === "Completed").length;
  const overdue = project.milestones.filter((m) => m.status !== "Completed" && m.plannedDate < TODAY);
  const dateBounds = useMemo(() => {
    const dates = [...project.tasks.flatMap((task) => [task.plannedStart, task.plannedFinish]), project.plannedStart, project.estimatedCompletion].filter(Boolean).sort();
    const start = dates[0] ?? project.plannedStart;
    const end = dates[dates.length - 1] ?? project.estimatedCompletion;
    const total = Math.max(1, daysBetween(start, end));
    return { start, end, total };
  }, [project]);

  const barPosition = (start: string, end: string) => {
    const left = Math.max(0, (daysBetween(dateBounds.start, start) / dateBounds.total) * 100);
    const width = Math.max(3, (Math.max(1, daysBetween(start, end)) / dateBounds.total) * 100);
    return { left: `${Math.min(97, left)}%`, width: `${Math.min(100 - Math.min(97, left), width)}%` };
  };

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="flex items-center gap-3 p-3.5"><ProgressRing value={project.milestones.length ? (completed / project.milestones.length) * 100 : 0} size={46} stroke={4}><span className="font-mono text-[10px]">{project.milestones.length ? Math.round((completed / project.milestones.length) * 100) : 0}%</span></ProgressRing><div><p className="text-[9.5px] uppercase tracking-[0.1em] text-u-muted">Milestones</p><p className="font-mono text-[15px] text-u-ink">{completed}/{project.milestones.length}</p></div></Card>
        <Card className="flex items-center gap-3 p-3.5"><ToneIcon icon={Timer} tone={overdue.length ? "amber" : "aqua"} /><div><p className="text-[9.5px] uppercase tracking-[0.1em] text-u-muted">Overdue milestones</p><p className={cn("font-mono text-[17px]", overdue.length ? "text-u-warn" : "text-u-ink")}>{overdue.length}</p><p className="text-[9.5px] text-u-muted">Past planned date</p></div></Card>
        <Card className="flex items-center gap-3 p-3.5"><ToneIcon icon={CalendarClock} tone="sky" /><div><p className="text-[9.5px] uppercase tracking-[0.1em] text-u-muted">Planned completion</p><p className="font-mono text-[13px] text-u-ink">{dateLong(project.estimatedCompletion)}</p><p className={cn("text-[9.5px]", project.estimatedCompletion < TODAY && project.status !== "Completed" ? "text-u-danger" : "text-u-muted")}>{project.estimatedCompletion < TODAY && project.status !== "Completed" ? `${daysBetween(project.estimatedCompletion, TODAY)} days past due` : `${daysBetween(TODAY, project.estimatedCompletion)} days remaining`}</p></div></Card>
        <Card className="flex items-center gap-3 p-3.5"><ToneIcon icon={Timer} tone="violet" /><div><p className="text-[9.5px] uppercase tracking-[0.1em] text-u-muted">Overdue tasks</p><p className="font-mono text-[17px] text-u-ink">{project.tasks.filter((t) => t.status !== "Completed" && t.plannedFinish < TODAY).length}</p><p className="text-[9.5px] text-u-muted">Work packages past finish</p></div></Card>
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-u-ink/[0.06] px-4 py-3">
          <SectionHeader icon={CalendarRange} title="Task schedule" subtitle={`${dateShort(dateBounds.start)} → ${dateShort(dateBounds.end)} · planned works`} />
          <div className="flex items-center gap-2 text-[9px] text-u-muted"><span className="flex items-center gap-1"><span className="h-1.5 w-3 rounded-full bg-u-accent/80" /> Planned</span><span className="flex items-center gap-1"><span className="h-1.5 w-3 rounded-full bg-u-danger/70" /> Overdue</span><span className="flex items-center gap-1"><span className="h-1.5 w-3 rounded-full bg-u-ok/70" /> Completed</span></div>
        </div>
        <div className="hidden grid-cols-[180px_1fr] border-b border-u-ink/[0.05] bg-u-ink/[0.014] px-4 py-1.5 text-[8.5px] uppercase tracking-[0.08em] text-u-muted lg:grid">
          <span>Work package</span><div className="flex justify-between">{[0, 0.25, 0.5, 0.75, 1].map((ratio) => { const date = new Date(`${dateBounds.start}T12:00:00`); date.setDate(date.getDate() + Math.round(dateBounds.total * ratio)); return <span key={ratio}>{date.toLocaleDateString("en-CA", { month: "short", day: "numeric" })}</span>; })}</div>
        </div>
        <div className="divide-y divide-u-ink/[0.04]">
          {project.tasks.map((task) => {
            const bar = barPosition(task.plannedStart, task.plannedFinish);
            const isOverdue = task.status !== "Completed" && task.plannedFinish < TODAY;
            const tone = task.status === "Completed" ? "bg-u-ok/75" : task.status === "Blocked" || isOverdue ? "bg-u-danger/70" : task.status === "In Progress" ? "bg-u-accent/80" : "bg-u-blue/55";
            return (
              <div key={task.id} className="px-3 py-2 lg:grid lg:grid-cols-[180px_1fr] lg:items-center lg:gap-3 lg:px-4">
                <div className="min-w-0">
                  <p className="truncate text-[10.5px] font-medium text-u-ink">{task.name}</p>
                  <p className="truncate text-[8.5px] text-u-muted">{task.assigneeName}</p>
                </div>
                <div className="relative mt-1.5 h-5 lg:mt-0">
                  <div className="absolute inset-x-0 top-1/2 h-px bg-u-ink/[0.05]" />
                  <div className="absolute top-1/2 flex h-4 -translate-y-1/2 items-center overflow-hidden rounded-[4px]" style={{ left: bar.left, width: bar.width }}>
                    <div className={cn("h-full w-full rounded-[4px]", tone)} />
                    <span className="absolute inset-0 flex items-center px-1.5 font-mono text-[8px] font-medium text-u-onaccent/90">{task.status === "Completed" ? "Complete" : `${dateShort(task.plannedStart)}–${dateShort(task.plannedFinish)}`}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-u-ink/[0.06] px-4 py-3"><SectionHeader icon={Stamp} title="Milestones" subtitle="Standard template, customised per project" /><Badge tone="slate">{project.milestones.length} milestones</Badge></div>
        <div className="divide-y divide-u-ink/[0.045]">
          {project.milestones.map((milestone, index) => {
            const missed = milestone.status !== "Completed" && milestone.plannedDate < TODAY;
            return (
              <div key={milestone.id} className="flex items-center gap-2.5 px-4 py-2.5">
                <div className="flex flex-col items-center">
                  <span className={cn("flex h-6 w-6 items-center justify-center rounded-full border", milestone.status === "Completed" ? "border-u-ok/30 bg-u-ok/15 text-u-ok" : missed ? "border-u-danger/30 bg-u-danger/10 text-u-danger" : "border-u-ink/12 bg-u-ink/[0.03] text-u-muted")}>
                    {milestone.status === "Completed" ? <Check className="h-3 w-3" /> : missed ? <AlertTriangle className="h-3 w-3" /> : <span className="font-mono text-[8px]">{index + 1}</span>}
                  </span>
                  {index < project.milestones.length - 1 && <span className="mt-0.5 h-3 w-px bg-u-ink/10" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-1.5 text-[11.5px] font-medium text-u-ink">{milestone.name}{milestone.requiresInspection && <ShieldCheck className="h-3 w-3 text-u-ok/80" />}{missed && <Badge tone="rose">Missed</Badge>}</p>
                  <p className="truncate text-[9.5px] text-u-muted">{milestone.description || milestone.notes || "—"} · {milestone.responsible}</p>
                </div>
                <div className="hidden text-right sm:block">
                  <p className="font-mono text-[10px] text-u-ink2">{dateLong(milestone.plannedDate)}</p>
                  <p className={cn("text-[9px]", milestone.actualDate ? "text-u-ok" : missed ? "text-u-danger" : "text-u-muted")}>{milestone.actualDate ? `Actual ${dateLong(milestone.actualDate)}` : missed ? "No actual date" : "Planned"}</p>
                </div>
                <Select value={milestone.status} onChange={(e) => setMilestoneStatus(project.id, milestone.id, e.target.value as "Pending" | "In Progress" | "Completed")} className="h-7 w-[108px] text-[10px]" aria-label={`Status for ${milestone.name}`}>
                  {["Pending", "In Progress", "Completed"].map((status) => <option key={status}>{status}</option>)}
                </Select>
              </div>
            );
          })}
        </div>
        <div className="border-t border-u-ink/[0.06] bg-u-ink/[0.012] px-4 py-2 text-[9.5px] text-u-muted">Milestones flagged with a shield require a passed inspection before completion. Standard templates can be customised for each project.</div>
      </Card>
    </div>
  );
}

/* ------------------------------- Inspections ------------------------------ */

export function InspectionsTab({ project }: { project: Project }) {
  const { resolveDeficiency } = useStore();
  const [inspectionOpen, setInspectionOpen] = useState(false);
  const [resolving, setResolving] = useState<Deficiency | null>(null);
  const [resolution, setResolution] = useState("");
  const checks = canCompleteProject(project);
  const openDeficiencies = project.deficiencies.filter((d) => d.status === "Open" || d.status === "In Progress");
  const completionItems = [
    { label: "Failed inspections corrected", passed: !checks.failedInspectionOutstanding, detail: checks.failedInspectionOutstanding ? "A failed inspection requires a later passing reinspection" : "No outstanding inspection failures" },
    { label: "Final inspection passed", passed: !checks.finalInspectionOutstanding, detail: checks.finalInspectionOutstanding ? "Record a passing final inspection" : "Final inspection passed" },
    { label: "Deficiencies resolved", passed: openDeficiencies.length === 0, detail: openDeficiencies.length ? `${openDeficiencies.length} open or in progress` : "No outstanding deficiencies" },
    { label: "Project completion approved", passed: project.status === "Completed", detail: project.status === "Completed" ? "Project closed" : "Completion is blocked by the checks above" },
    { label: "Unit readiness confirmed", passed: project.readinessApproved, detail: project.readinessApproved ? "Readiness approved" : "Separate readiness approval required" },
  ];

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="flex items-center gap-3 p-3.5"><ToneIcon icon={ShieldCheck} tone="aqua" /><div><p className="text-[9.5px] uppercase tracking-[0.1em] text-u-muted">Inspections</p><p className="font-mono text-[17px] text-u-ink">{project.inspections.length}</p><p className="text-[9.5px] text-u-muted">{project.inspections.filter((i) => i.result === "Pass").length} passed</p></div></Card>
        <Card className="flex items-center gap-3 p-3.5"><ToneIcon icon={ShieldAlert} tone={openDeficiencies.length ? "rose" : "acid"} /><div><p className="text-[9.5px] uppercase tracking-[0.1em] text-u-muted">Open deficiencies</p><p className={cn("font-mono text-[17px]", openDeficiencies.length ? "text-u-danger" : "text-u-accent")}>{openDeficiencies.length}</p><p className="text-[9.5px] text-u-muted">of {project.deficiencies.length} total</p></div></Card>
        <Card className="flex items-center gap-3 p-3.5"><ToneIcon icon={ShieldX} tone="amber" /><div><p className="text-[9.5px] uppercase tracking-[0.1em] text-u-muted">Failed / conditional</p><p className="font-mono text-[17px] text-u-ink">{project.inspections.filter((i) => i.result === "Fail" || i.result === "Conditional").length}</p><p className="text-[9.5px] text-u-muted">Requires corrective action</p></div></Card>
        <Card className={cn("flex items-center gap-3 p-3.5", !checks.allowed && "border-u-warn/20")}><ToneIcon icon={checks.allowed ? CheckCircle2 : Timer} tone={checks.allowed ? "acid" : "amber"} /><div><p className="text-[9.5px] uppercase tracking-[0.1em] text-u-muted">Closure status</p><p className={cn("text-[12px] font-semibold", checks.allowed ? "text-u-accent" : "text-u-warn")}>{checks.allowed ? "Ready to close" : "Blocked"}</p><p className="truncate text-[9.5px] text-u-muted">{checks.allowed ? "Requirements satisfied" : checks.reasons[0]}</p></div></Card>
      </div>

      <div className="grid gap-3 xl:grid-cols-[1.55fr_1fr]">
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-u-ink/[0.06] px-4 py-3"><SectionHeader icon={FileCheck2} title="Inspection register" subtitle="Checklists, findings and reinspection dates" /><Button variant="primary" size="sm" icon={Plus} onClick={() => setInspectionOpen(true)}>Record inspection</Button></div>
          {project.inspections.length === 0 ? (
            <div className="p-4"><EmptyState icon={FileCheck2} title="No inspections recorded" description="Record required inspections and any findings. Failed inspections raise corrective deficiencies." action={<Button size="sm" variant="primary" icon={Plus} onClick={() => setInspectionOpen(true)}>Record inspection</Button>} /></div>
          ) : (
            <div className="divide-y divide-u-ink/[0.05]">
              {project.inspections.map((inspection) => (
                <div key={inspection.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-start gap-2">
                    <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg border", inspection.result === "Pass" ? "border-u-ok/25 bg-u-ok/10 text-u-ok" : inspection.result === "Fail" ? "border-u-danger/25 bg-u-danger/10 text-u-danger" : inspection.result === "Conditional" ? "border-u-warn/25 bg-u-warn/10 text-u-warn" : "border-u-blue/25 bg-u-blue/10 text-u-blue")}><ShieldCheck className="h-4 w-4" /></span>
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-1.5 text-[11.5px] font-semibold text-u-ink">{inspection.type}<StatusBadge status={inspection.result} /></p>
                      <p className="text-[9.5px] text-u-muted">{dateLong(inspection.date)} · {inspection.inspector}{inspection.reinspectionDate ? ` · Reinspect ${dateLong(inspection.reinspectionDate)}` : ""}</p>
                      {inspection.findings && <p className="mt-1 text-[10.5px] leading-relaxed text-u-ink2">{inspection.findings}</p>}
                      {inspection.correctiveActions && <p className="mt-1 rounded border border-u-ink/[0.06] bg-u-ink/[0.02] px-2 py-1 text-[10px] text-u-muted"><span className="text-u-muted">Corrective action:</span> {inspection.correctiveActions}</p>}
                    </div>
                  </div>
                  {inspection.checklist.length > 0 && (
                    <div className="mt-2 grid gap-1 sm:grid-cols-2">
                      {inspection.checklist.map((item) => (
                        <div key={item.label} className="flex items-center gap-1.5 rounded border border-u-ink/[0.05] bg-u-ink/[0.015] px-2 py-1 text-[9.5px]">
                          {item.passed ? <CheckCircle2 className="h-3 w-3 shrink-0 text-u-ok" /> : <X className="h-3 w-3 shrink-0 text-u-danger" />}
                          <span className={item.passed ? "text-u-muted" : "text-u-danger/80"}>{item.label}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {inspection.attachments.length > 0 && <div className="mt-1.5 flex flex-wrap gap-1.5">{inspection.attachments.map((file) => <Badge key={file} tone="slate" icon={Paperclip}>{file}</Badge>)}</div>}
                </div>
              ))}
            </div>
          )}
        </Card>

        <div className="space-y-3">
          <Card className="overflow-hidden">
            <div className="border-b border-u-ink/[0.06] px-4 py-3"><SectionHeader icon={CheckCircle2} title="Completion requirements" subtitle="Project closure separates from unit readiness" /></div>
            <div className="space-y-1.5 p-3">
              {completionItems.map((item) => (
                <div key={item.label} className={cn("flex items-start gap-2 rounded-lg border px-2.5 py-2", item.passed ? "border-u-ok/20 bg-u-ok/[0.04]" : "border-u-warn/20 bg-u-warn/[0.04]")}>
                  {item.passed ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-u-ok" /> : <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-u-warn" />}
                  <div><p className="text-[10.5px] font-medium text-u-ink">{item.label}</p><p className="text-[9px] text-u-muted">{item.detail}</p></div>
                </div>
              ))}
            </div>
            <div className="border-t border-u-ink/[0.06] px-4 py-2 text-[9px] text-u-muted">Outstanding required deficiencies prevent project completion. Availability is updated separately.</div>
          </Card>

          <Card className="overflow-hidden">
            <div className="border-b border-u-ink/[0.06] px-4 py-3"><SectionHeader icon={ShieldAlert} title="Deficiencies" subtitle="Resolution needs evidence and verification" /></div>
            {project.deficiencies.length === 0 ? (
              <div className="p-3"><EmptyState compact icon={CheckCircle2} title="No deficiencies" description="No corrective items have been raised for this project." /></div>
            ) : (
              <div className="divide-y divide-u-ink/[0.05]">
                {project.deficiencies.map((item) => (
                  <div key={item.id} className="px-3 py-2.5">
                    <div className="flex items-start gap-2">
                      <span className={cn("mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full", item.severity === "Critical" ? "bg-u-danger" : item.severity === "High" ? "bg-u-warn" : item.severity === "Medium" ? "bg-u-warn" : "bg-u-s3")} />
                      <div className="min-w-0 flex-1">
                        <p className="text-[10.5px] leading-snug text-u-ink">{item.description}</p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-1 text-[9px] text-u-muted">{item.severity} · {item.assignedTo} · Due <span className={item.dueDate < TODAY && item.status !== "Verified" ? "text-u-danger" : ""}>{dateShort(item.dueDate)}</span></p>
                        {item.resolutionNotes && <p className="mt-1 text-[9px] italic text-u-muted">{item.resolutionNotes}</p>}
                      </div>
                      <div className="flex flex-col items-end gap-1"><StatusBadge status={item.status} />{["Open", "In Progress"].includes(item.status) && <Button size="xs" variant="secondary" icon={Check} onClick={() => { setResolving(item); setResolution(""); }}>Resolve</Button>}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      <InspectionModal open={inspectionOpen} onClose={() => setInspectionOpen(false)} project={project} />
      <Modal open={!!resolving} onClose={() => setResolving(null)} title="Resolve deficiency" description={resolving?.description ?? ""} icon={CheckCircle2} size="sm"
        footer={<><Button variant="ghost" size="sm" onClick={() => setResolving(null)}>Cancel</Button><Button variant="primary" size="sm" icon={Check} onClick={() => { if (!resolving || !resolution.trim()) return; const result = resolveDeficiency(project.id, resolving.id, resolution); if (result.ok) setResolving(null); }}>Mark resolved</Button></>}>
        <div className="space-y-3">
          <Field label="Resolution notes" required hint="Describe the corrective work and evidence."><Textarea rows={3} value={resolution} onChange={(e) => setResolution(e.target.value)} placeholder="Second coat applied, corner reinforcement installed, photo evidence uploaded…" /></Field>
          <InfoNote>A deficiency is marked resolved for verification. Completion still requires verified status where configured.</InfoNote>
        </div>
      </Modal>
    </div>
  );
}

function InspectionModal({ open, onClose, project }: { open: boolean; onClose: () => void; project: Project }) {
  const { addInspection } = useStore();
  const [form, setForm] = useState({ type: "Rough-in inspection", date: TODAY, inspector: "", result: "Pass" as Inspection["result"], findings: "", correctiveActions: "", reinspectionDate: "", notes: "", taskId: "", photo: "" });
  const [checks, setChecks] = useState([
    { label: "Work conforms to approved scope", passed: true },
    { label: "Permits and approvals posted", passed: true },
    { label: "Life-safety and code compliance", passed: true },
  ]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const submit = () => {
    const nextErrors: Record<string, string> = {};
    if (!form.inspector.trim()) nextErrors.inspector = "Inspector is required.";
    if (!form.date) nextErrors.date = "Inspection date is required.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    const result = addInspection(project.id, {
      projectId: project.id,
      taskId: form.taskId || undefined,
      type: form.type,
      date: form.date,
      inspector: form.inspector,
      checklist: checks,
      result: form.result,
      findings: form.findings,
      attachments: form.photo ? [form.photo] : [],
      correctiveActions: form.correctiveActions,
      reinspectionDate: form.reinspectionDate || undefined,
      notes: form.notes,
    });
    if (result.ok) onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title="Record inspection" description="Inspection results are linked to the project and optionally a task. Failures should generate corrective deficiencies." icon={ShieldCheck}
      footer={<><Button variant="ghost" size="md" onClick={onClose}>Cancel</Button><Button variant="primary" size="md" icon={Check} onClick={submit}>Save inspection</Button></>}>
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Inspection type" required><Select value={form.type} onChange={(e) => setForm((c) => ({ ...c, type: e.target.value }))}>{["Rough-in inspection", "Waterproofing & tile inspection", "Electrical inspection", "Plumbing inspection", "Final inspection", "Internal QA walk"].map((t) => <option key={t}>{t}</option>)}</Select></Field>
          <Field label="Related task"><Select value={form.taskId} onChange={(e) => setForm((c) => ({ ...c, taskId: e.target.value }))}><option value="">Project-level</option>{project.tasks.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select></Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Inspection date" required error={errors.date}><Input type="date" value={form.date} onChange={(e) => setForm((c) => ({ ...c, date: e.target.value }))} /></Field>
          <Field label="Inspector" required error={errors.inspector}><Input value={form.inspector} onChange={(e) => setForm((c) => ({ ...c, inspector: e.target.value }))} placeholder="Name / authority" /></Field>
          <Field label="Result" required><Select value={form.result} onChange={(e) => setForm((c) => ({ ...c, result: e.target.value as Inspection["result"] }))}>{["Pass", "Fail", "Conditional", "Scheduled"].map((r) => <option key={r}>{r}</option>)}</Select></Field>
        </div>
        <div className="rounded-xl border border-u-ink/[0.07] bg-u-ink/[0.02] p-2.5">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-u-muted">Checklist</p>
          {checks.map((check, index) => (
            <label key={check.label} className="flex items-center gap-2 py-0.5 text-[10.5px] text-u-ink2">
              <input type="checkbox" className="h-3 w-3 accent-u-accent" checked={check.passed} onChange={(e) => setChecks((current) => current.map((c, i) => (i === index ? { ...c, passed: e.target.checked } : c)))} />
              {check.label}
            </label>
          ))}
        </div>
        <Field label="Findings"><Textarea rows={2} value={form.findings} onChange={(e) => setForm((c) => ({ ...c, findings: e.target.value }))} placeholder="What did the inspector identify?" /></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Corrective actions"><Textarea rows={2} value={form.correctiveActions} onChange={(e) => setForm((c) => ({ ...c, correctiveActions: e.target.value }))} placeholder="Actions required before reinspection" /></Field>
          <div className="space-y-3">
            <Field label="Reinspection date"><Input type="date" value={form.reinspectionDate} onChange={(e) => setForm((c) => ({ ...c, reinspectionDate: e.target.value }))} /></Field>
            <Field label="Photos / report"><label className="flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-dashed border-u-ink/15 bg-u-bg/60 px-3 text-[11px] text-u-muted hover:border-u-accent/40 hover:text-u-ink"><Paperclip className="h-3.5 w-3.5" /> {form.photo || "Attach inspection report or photo"}<input type="file" className="hidden" onChange={(e) => setForm((c) => ({ ...c, photo: e.target.files?.[0]?.name ?? "" }))} /></label></Field>
          </div>
        </div>
        <InfoNote tone="warning">A failed or conditional result will block project completion until a reinspection passes and deficiencies are verified.</InfoNote>
      </div>
    </Modal>
  );
}

/* --------------------------------- Documents ------------------------------- */

const docCategories: DocumentCategory[] = ["Photo", "Quote", "Contract", "Purchase Order", "Invoice", "Receipt", "Permit", "Inspection Report", "Change Order", "Warranty", "Product Manual", "Proof of Payment", "Other"];

export function DocumentsTab({ project }: { project: Project }) {
  const { addDocument, notify } = useStore();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<"All" | DocumentCategory>("All");
  const [stage, setStage] = useState<"All" | "Before" | "During" | "After">("All");
  const photos = project.documents.filter((doc) => doc.category === "Photo" && doc.url);
  const filtered = project.documents.filter((doc) => (category === "All" || doc.category === category) && (stage === "All" || doc.stage === stage));
  const expiring = project.documents.filter((doc) => doc.expiryDate && daysBetween(TODAY, doc.expiryDate) < 90);

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="flex items-center gap-3 p-3.5"><ToneIcon icon={Camera} tone="violet" /><div><p className="text-[9.5px] uppercase tracking-[0.1em] text-u-muted">Photos</p><p className="font-mono text-[17px] text-u-ink">{photos.length}</p><p className="text-[9.5px] text-u-muted">Before · during · after</p></div></Card>
        <Card className="flex items-center gap-3 p-3.5"><ToneIcon icon={FileText} tone="sky" /><div><p className="text-[9.5px] uppercase tracking-[0.1em] text-u-muted">Documents</p><p className="font-mono text-[17px] text-u-ink">{project.documents.length}</p><p className="text-[9.5px] text-u-muted">All categories</p></div></Card>
        <Card className="flex items-center gap-3 p-3.5"><ToneIcon icon={ShieldAlert} tone={expiring.length ? "amber" : "slate"} /><div><p className="text-[9.5px] uppercase tracking-[0.1em] text-u-muted">Expiring &lt; 90 days</p><p className={cn("font-mono text-[17px]", expiring.length ? "text-u-warn" : "text-u-ink")}>{expiring.length}</p><p className="text-[9.5px] text-u-muted">Permits & warranties</p></div></Card>
        <Card className="flex items-center gap-3 p-3.5"><ToneIcon icon={LockKeyhole} tone="acid" /><div><p className="text-[9.5px] uppercase tracking-[0.1em] text-u-muted">Access level</p><p className="text-[12px] font-semibold text-u-ink">Project team</p><p className="text-[9.5px] text-u-muted">Signed URLs · private storage</p></div></Card>
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-u-ink/[0.06] px-4 py-3"><SectionHeader icon={Camera} title="Photo timeline" subtitle="Before, during and after evidence for the unit" /><Badge tone="slate">{photos.length} photos</Badge></div>
        <div className="grid gap-2.5 p-3 sm:grid-cols-2 lg:grid-cols-4">
          {photos.slice(0, 4).map((photo) => (
            <div key={photo.id} className="group overflow-hidden rounded-xl border border-u-ink/[0.07] bg-u-bg/50">
              <div className="relative h-28 overflow-hidden">
                <img src={photo.url} alt={photo.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" loading="lazy" />
                <div className="absolute inset-0 bg-gradient-to-t from-u-bg/85 via-transparent to-transparent" />
                <Badge tone={photo.stage === "Before" ? "amber" : photo.stage === "After" ? "aqua" : "sky"} className="absolute left-1.5 top-1.5">{photo.stage ?? "Photo"}</Badge>
                <button onClick={() => notify("Photo preview", "info", `${photo.name} — secured project media preview.`)} className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-md bg-u-bg/70 text-u-ink opacity-0 transition group-hover:opacity-100"><Eye className="h-3 w-3" /></button>
                <div className="absolute inset-x-0 bottom-0 p-2"><p className="truncate text-[10px] font-medium text-u-ink">{photo.name}</p><p className="text-[8.5px] text-u-muted">{dateShort(photo.uploadDate)} · {photo.uploader}</p></div>
              </div>
            </div>
          ))}
          {photos.length === 0 && <div className="col-span-full p-3"><EmptyState compact icon={Camera} title="No site photos yet" description="Upload before, during and after photos to build the renovation record." /></div>}
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-u-ink/[0.06] px-4 py-3">
          <SectionHeader icon={FileText} title="Project document repository" subtitle="Centralised, permission-controlled files linked to tasks and financial records" />
          <div className="flex flex-wrap items-center gap-1.5">
            <Select value={category} onChange={(e) => setCategory(e.target.value as typeof category)} className="h-8 w-[136px] text-[11px]" aria-label="Filter by document category"><option value="All">All categories</option>{docCategories.map((c) => <option key={c}>{c}</option>)}</Select>
            <Button variant="primary" size="sm" icon={Upload} onClick={() => setOpen(true)}>Upload</Button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1 border-b border-u-ink/[0.06] px-4 py-1.5">
          {(["All", "Before", "During", "After"] as const).map((item) => (
            <button key={item} onClick={() => setStage(item)} className={cn("rounded px-2 py-1 text-[10px] transition", stage === item ? "bg-u-ink/[0.08] text-u-ink" : "text-u-muted hover:text-u-ink2")}>{item === "All" ? "All stages" : item}</button>
          ))}
          <span className="ml-auto text-[9px] text-u-muted">{filtered.length} files · max 25 MB each</span>
        </div>
        {filtered.length === 0 ? (
          <div className="p-4"><EmptyState icon={FileText} title="No documents match" description="Adjust the category or stage filters, or upload a document." action={<Button size="sm" variant="primary" icon={Upload} onClick={() => setOpen(true)}>Upload document</Button>} /></div>
        ) : (
          <div className="divide-y divide-u-ink/[0.045]">
            {filtered.map((docItem) => {
              const isPhoto = docItem.category === "Photo";
              return (
                <div key={docItem.id} className="flex items-center gap-2.5 px-4 py-2.5 transition hover:bg-u-ink/[0.015]">
                  <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border", isPhoto ? "border-u-violet/20 bg-u-violet/[0.07] text-u-violet" : docItem.fileType === "PDF" ? "border-u-danger/20 bg-u-danger/[0.07] text-u-danger" : "border-u-blue/20 bg-u-blue/[0.07] text-u-blue")}>
                    {isPhoto ? <Image className="h-3.5 w-3.5" /> : docItem.fileType === "PDF" ? <FileText className="h-3.5 w-3.5" /> : <FileBadge className="h-3.5 w-3.5" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-1.5 truncate text-[11px] font-medium text-u-ink">{docItem.name}{docItem.expiryDate && <Badge tone={docItem.expiryDate < TODAY ? "rose" : daysBetween(TODAY, docItem.expiryDate) < 90 ? "amber" : "slate"}>{docItem.expiryDate < TODAY ? "Expired" : `Expires ${dateShort(docItem.expiryDate)}`}</Badge>}</p>
                    <p className="flex flex-wrap items-center gap-x-1.5 text-[9px] text-u-muted"><span className="font-mono">{docItem.id}</span> · {docItem.category} · {docItem.fileType} · {docItem.size} · {docItem.uploader} · {dateShort(docItem.uploadDate)}{docItem.taskId ? ` · ${project.tasks.find((t) => t.id === docItem.taskId)?.name ?? docItem.taskId}` : ""}{docItem.financialRecord ? ` · ${docItem.financialRecord}` : ""}</p>
                  </div>
                  <Badge tone="slate" className="hidden sm:inline-flex">{docItem.visibility}</Badge>
                  <button onClick={() => notify("Document preview", "info", `${docItem.name} is served through a private, expiring URL in the secure repository.`)} aria-label="Preview document" className="flex h-7 w-7 items-center justify-center rounded border border-u-ink/[0.07] text-u-muted hover:text-u-ink"><Eye className="h-3 w-3" /></button>
                  <button onClick={() => notify("Download started", "success", `${docItem.name} — mock download from secure storage.`)} aria-label="Download document" className="flex h-7 w-7 items-center justify-center rounded border border-u-ink/[0.07] text-u-muted hover:text-u-ink"><Download className="h-3 w-3" /></button>
                </div>
              );
            })}
          </div>
        )}
        <div className="flex items-center gap-1 border-t border-u-ink/[0.06] bg-u-ink/[0.012] px-4 py-2 text-[9px] text-u-muted"><LockKeyhole className="h-3 w-3" /> Files are validated by type and size. Private document URLs are never exposed publicly; access follows project permissions.</div>
      </Card>

      <UploadDocumentModal open={open} onClose={() => setOpen(false)} project={project} onUpload={addDocument} />
    </div>
  );
}

function UploadDocumentModal({ open, onClose, project, onUpload }: { open: boolean; onClose: () => void; project: Project; onUpload: (projectId: string, document: Omit<import("../../lib/types").ProjectDocument, "id" | "uploadDate" | "uploader">) => { ok: boolean; error?: string } }) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<DocumentCategory>("Photo");
  const [stage, setStage] = useState<"Before" | "During" | "After">("During");
  const [taskId, setTaskId] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [visibility, setVisibility] = useState<"Internal" | "Team" | "Restricted">("Team");
  const [fileType, setFileType] = useState("PDF");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const submit = () => {
    if (!name.trim()) { setErrors({ name: "Select a file or provide a document name." }); return; }
    const result = onUpload(project.id, {
      projectId: project.id,
      name,
      category,
      fileType,
      size: "742 KB",
      taskId: taskId || undefined,
      expiryDate: expiryDate || undefined,
      stage: category === "Photo" ? stage : undefined,
      visibility,
    });
    if (result.ok) { onClose(); setName(""); setErrors({}); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Upload to project repository" description="Mock storage: file metadata is recorded against the project and audit trail." icon={Upload}
      footer={<><Button variant="ghost" size="md" onClick={onClose}>Cancel</Button><Button variant="primary" size="md" icon={Check} onClick={submit}>Upload document</Button></>}>
      <div className="space-y-3">
        <label className={cn("pj-dot-grid flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-4 py-6 text-center transition hover:border-u-accent/40 hover:bg-u-ink/[0.02]", errors.name ? "border-u-danger/40" : "border-u-ink/15")}>
          <Upload className="h-5 w-5 text-u-muted" />
          <p className="mt-1.5 text-[11.5px] font-medium text-u-ink">{name || "Click to select a file"}</p>
          <p className="mt-0.5 text-[9.5px] text-u-muted">PDF, JPG, PNG, DOCX, XLSX · max 25 MB</p>
          <input type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg,.docx,.xlsx" onChange={(e) => { const file = e.target.files?.[0]; if (file) { setName(file.name); setFileType(file.name.split(".").pop()?.toUpperCase() ?? "PDF"); const categoryGuess = /invoice/i.test(file.name) ? "Invoice" : /quote/i.test(file.name) ? "Quote" : /permit/i.test(file.name) ? "Permit" : /\.(jpg|jpeg|png)$/i.test(file.name) ? "Photo" : "Other"; setCategory(categoryGuess as DocumentCategory); setErrors({}); } }} />
        </label>
        {errors.name && <p className="text-[10px] text-u-danger">{errors.name}</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Document name"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Final inspection report.pdf" /></Field>
          <Field label="Category"><Select value={category} onChange={(e) => setCategory(e.target.value as DocumentCategory)}>{docCategories.map((c) => <option key={c}>{c}</option>)}</Select></Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {category === "Photo" && <Field label="Photo stage"><Select value={stage} onChange={(e) => setStage(e.target.value as typeof stage)}>{["Before", "During", "After"].map((s) => <option key={s}>{s}</option>)}</Select></Field>}
          <Field label="Related task"><Select value={taskId} onChange={(e) => setTaskId(e.target.value)}><option value="">None</option>{project.tasks.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select></Field>
          <Field label="Expiry date (optional)"><Input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} /></Field>
          <Field label="Visibility"><Select value={visibility} onChange={(e) => setVisibility(e.target.value as typeof visibility)}>{["Internal", "Team", "Restricted"].map((v) => <option key={v}>{v}</option>)}</Select></Field>
        </div>
        <InfoNote>Only configured file types are accepted. Documents with expiry dates appear in compliance alerts.</InfoNote>
      </div>
    </Modal>
  );
}

/* --------------------------------- Activity -------------------------------- */

const activityIcon = (kind: string) => {
  if (kind === "budget") return Wallet;
  if (kind === "invoice") return Receipt;
  if (kind === "payment") return CircleDollarSign;
  if (kind === "task") return CheckCircle2;
  if (kind === "document") return FileText;
  if (kind === "inspection") return ShieldCheck;
  if (kind === "change") return FileDiff;
  if (kind === "assignment") return HardHat;
  if (kind === "created") return Sparkles;
  return TrendingUp;
};

export function ActivityTab({ project }: { project: Project }) {
  const [kind, setKind] = useState<"all" | "status" | "budget" | "invoice" | "payment" | "task" | "inspection" | "document" | "change">("all");
  const filtered = project.activity.filter((entry) => kind === "all" || entry.kind === kind);
  return (
    <div className="grid gap-3 xl:grid-cols-[1.6fr_1fr]">
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-u-ink/[0.06] px-4 py-3"><SectionHeader icon={History} title="Activity & audit history" subtitle="Every important change records who, what and when" /><Badge tone="slate" icon={LockKeyhole}>{project.activity.length} events</Badge></div>
        <div className="pj-no-scrollbar flex items-center gap-1 overflow-x-auto border-b border-u-ink/[0.06] px-3 py-1.5">
          {(["all", "status", "budget", "invoice", "payment", "task", "inspection", "document", "change"] as const).map((item) => (
            <button key={item} onClick={() => setKind(item)} className={cn("whitespace-nowrap rounded px-2 py-1 text-[10px] capitalize transition", kind === item ? "bg-u-ink/[0.09] text-u-ink" : "text-u-muted hover:text-u-ink2")}>{item}</button>
          ))}
        </div>
        <div className="p-3">
          {filtered.map((entry, index) => {
            const Icon = activityIcon(entry.kind);
            return (
              <div key={entry.id} className="flex gap-2.5">
                <div className="flex flex-col items-center">
                  <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full border", entry.kind === "payment" || entry.kind === "change" ? "border-u-accent/25 bg-u-accent/[0.08] text-u-accent" : entry.kind === "inspection" ? "border-u-ok/25 bg-u-ok/[0.08] text-u-ok" : "border-u-ink/10 bg-u-ink/[0.04] text-u-muted")}><Icon className="h-3 w-3" /></span>
                  {index < filtered.length - 1 && <span className="my-0.5 w-px flex-1 bg-u-ink/[0.07]" />}
                </div>
                <div className="min-w-0 flex-1 pb-3">
                  <div className="flex flex-wrap items-center gap-1.5"><p className="text-[11.5px] font-medium text-u-ink">{entry.action}</p><Badge tone="slate">{entry.kind}</Badge></div>
                  <p className="mt-0.5 text-[10.5px] leading-relaxed text-u-muted">{entry.detail}</p>
                  <p className="mt-0.5 flex items-center gap-1 text-[9px] text-u-muted"><Avatar name={entry.actor} size="xs" className="mr-1" /> {entry.actor} · {dateLong(entry.at.slice(0, 10))} at {entry.at.slice(11, 16)}</p>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && <EmptyState compact icon={History} title="No events in this filter" description="Audit entries appear here as the project changes." />}
        </div>
      </Card>

      <div className="space-y-3">
        <Card className="overflow-hidden">
          <div className="border-b border-u-ink/[0.06] px-4 py-3"><SectionHeader icon={FileSignature} title="Record integrity" subtitle="Created and modified audit information" /></div>
          <div className="space-y-2 p-3">
            {[
              { label: "Created by", value: project.createdBy, date: project.createdAt },
              { label: "Last modified by", value: project.modifiedBy, date: project.modifiedAt },
              { label: "Readiness approved by", value: project.readinessApprovedBy ?? "Not yet approved", date: project.actualReadyDate },
            ].map((row) => (
              <div key={row.label} className="flex items-start gap-2 rounded-lg border border-u-ink/[0.06] bg-u-ink/[0.02] p-2">
                <UserRound className="mt-0.5 h-3.5 w-3.5 text-u-muted" />
                <div className="min-w-0 flex-1"><p className="text-[9px] uppercase tracking-[0.08em] text-u-muted">{row.label}</p><p className="truncate text-[10.5px] text-u-ink">{row.value}</p><p className="text-[9px] text-u-muted">{row.date ? dateLong(row.date.slice(0, 10)) : "—"}</p></div>
              </div>
            ))}
          </div>
        </Card>
        <Card className="overflow-hidden">
          <div className="border-b border-u-ink/[0.06] px-4 py-3"><SectionHeader icon={LockKeyhole} title="Audited event types" subtitle="Immutable history retained after cancellation or archiving" /></div>
          <div className="grid grid-cols-2 gap-1.5 p-3">
            {["Budget modifications", "Status transitions", "Contractor assignments", "Invoice approvals", "Payment corrections", "Change-order approvals", "Inspection results", "Project closure"].map((item) => (
              <div key={item} className="flex items-center gap-1.5 rounded border border-u-ink/[0.05] bg-u-ink/[0.015] px-2 py-1.5 text-[9.5px] text-u-muted"><Check className="h-2.5 w-2.5 shrink-0 text-u-accent/80" /> {item}</div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
