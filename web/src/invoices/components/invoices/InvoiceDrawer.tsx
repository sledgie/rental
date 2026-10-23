// Full invoice record in a side drawer, the invoice counterpart of the Properties / Leases / Units profile drawers.
// Opened by the Eye icon (or a row click) in the register: #/invoices?id=INV-... shows it over the list. Chrome uses the Tenants module's
// drawer styles (.tn); the invoice sections inside are the existing invoice components.
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "@inv/router";
import {
  Building2,
  CheckCircle2,
  CreditCard,
  Download,
  Mail,
  MapPin,
  Pencil,
  Phone,
  ReceiptText,
  SearchX,
  Tag,
  User,
  X,
  Ban,
  FileText,
  CalendarRange,
} from "lucide-react";
import { Button, IconButton } from "../../../tenants/components/ui";
import { ConfirmDialog } from "@inv/components/ui/ConfirmDialog";
import { useToast } from "@inv/components/ui/Toast";
import { RecordPaymentModal } from "./RecordPaymentModal";
import { ActivityTimeline } from "./ActivityTimeline";
import { AttachmentsNotes } from "./AttachmentsNotes";
import { InvoiceFormModal, type InvoiceFormValues } from "./InvoiceFormModal";
import { InvoiceLineItems } from "./InvoiceLineItems";
import { InvoiceStatusBadge } from "./InvoiceStatusBadge";
import { InvoiceSummary } from "./InvoiceSummary";
import { PaymentHistory } from "./PaymentHistory";
import { formatCAD, formatDate } from "@inv/lib/format";
import { useInvoices } from "@inv/store/InvoiceStore";
import { invoiceBalance, invoicePaid, invoiceTotal, statusLabels, typeLabels } from "@inv/types/invoice";

type Tab = "overview" | "items" | "payments" | "notes" | "activity";
const TABS: { key: Tab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "items", label: "Line items" },
  { key: "payments", label: "Payments" },
  { key: "notes", label: "Notes & files" },
  { key: "activity", label: "Activity" },
];
const COLORS = ["blue", "violet", "teal", "amber", "rose", "slate"] as const;
const colorFor = (s: string) => {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) % 997;
  return COLORS[h % COLORS.length];
};
const initials = (name: string) => name.split(/\s+/).filter((w) => /^[A-Za-z0-9]/.test(w)).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

export function InvoiceDrawer({ id }: { id: string }) {
  const navigate = useNavigate();
  const toast = useToast();
  const { getInvoice, updateInvoice, recordPayment, voidInvoice, approveInvoice, addNote, invoices, refs } = useInvoices();
  const properties = refs.properties;
  const invoice = getInvoice(id);
  const [tab, setTab] = useState<Tab>("overview");
  const [editOpen, setEditOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [voidOpen, setVoidOpen] = useState(false);
  const close = () => navigate("/invoices");

  useEffect(() => {
    // Escape closes the drawer unless a dialog is open on top of it
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && document.querySelectorAll('[role="dialog"]').length <= 1) navigate("/invoices");
    };
    window.addEventListener("keydown", onKey, true);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = prev;
    };
  }, [navigate]);

  const nextId = (() => {
    const nums = invoices.map((i) => Number(i.id.split("-").pop())).filter((n) => Number.isFinite(n)) as number[];
    return `INV-2026-${String((nums.length ? Math.max(...nums) : 0) + 1).padStart(3, "0")}`;
  })();

  const submitEdit = (values: InvoiceFormValues) => {
    if (!invoice) return;
    updateInvoice(invoice.id, {
      tenantId: values.tenantId,
      unitId: values.unitId,
      leaseId: values.leaseId,
      propertyName: values.propertyName,
      propertyId: values.propertyId,
      unit: values.unit,
      leaseRef: values.leaseRef,
      type: values.type,
      issueDate: values.issueDate,
      dueDate: values.dueDate,
      billingPeriodStart: values.billingPeriodStart,
      billingPeriodEnd: values.billingPeriodEnd,
      discount: values.discount,
      memo: values.memo || undefined,
      lineItems: values.lineItems.filter((i) => i.description.trim() !== ""),
    });
    setEditOpen(false);
    toast({ kind: "success", title: `${invoice.id} updated`, body: "Saved to the demo session." });
  };

  const locked = invoice?.status === "void";
  const needsApproval = invoice?.status === "draft" || invoice?.status === "pending_approval";
  const prop = invoice ? properties.find((p) => p.id === invoice.propertyId) : undefined;

  return createPortal(
    <div className="tn">
      <div className="overlay-backdrop drawer-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
        <div className="overlay-panel drawer-panel profile-drawer invoice-drawer" role="dialog" aria-modal="true" aria-labelledby="invoice-drawer-title">
          <div className="overlay-header">
            <div>
              <h2 id="invoice-drawer-title">Invoice record</h2>
              <p>Everything about this invoice, in one place.</p>
            </div>
            <IconButton label="Close invoice record" onClick={close}><X size={20} /></IconButton>
          </div>

          {!invoice ? (
            <div className="profile-body">
              <div className="inv-embed rd contents">
                <div className="mx-auto max-w-lg px-6 py-16 text-center">
                  <div className="mx-auto grid size-11 place-items-center rounded-full border border-line bg-surface-2">
                    <SearchX className="size-5 text-ink-faint" />
                  </div>
                  <p className="mt-4 text-[15px] font-medium text-ink">Invoice not found</p>
                  <p className="mx-auto mt-1.5 max-w-sm text-[13px] leading-relaxed text-ink-muted">
                    No invoice matching <span className="text-ink">{id}</span> exists in the demo register. It may have been reset or never created.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="profile-heading">
                <span className={`avatar avatar-xl avatar-${colorFor(invoice.tenant.name)}`} aria-hidden="true">{initials(invoice.tenant.name)}</span>
                <div className="profile-identity">
                  <h2>{invoice.id}</h2>
                  <div>
                    <span>{invoice.tenant.name} &middot; {invoice.propertyName} &middot; Unit {invoice.unit}</span>
                    <span className="rd contents"><InvoiceStatusBadge status={invoice.status} /></span>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                  <Button onClick={() => setEditOpen(true)} disabled={locked || !needsApproval}><Pencil size={14} />Edit invoice</Button>
                  {needsApproval ? (
                    <Button
                      variant="primary"
                      onClick={() => {
                        approveInvoice(invoice.id);
                        toast({ kind: "success", title: `${invoice.id} approved`, body: "Status moved to Unpaid and queued for delivery (demo only)." });
                      }}
                    >
                      <CheckCircle2 size={14} />Approve
                    </Button>
                  ) : (
                    <Button variant="primary" onClick={() => setPayOpen(true)} disabled={locked}><CreditCard size={14} />Record payment</Button>
                  )}
                </div>
              </div>
              <nav className="profile-tabs" aria-label="Invoice sections">
                {TABS.map((t) => (
                  <button key={t.key} className={t.key === tab ? "selected" : ""} aria-current={t.key === tab ? "page" : undefined} onClick={() => setTab(t.key)}>
                    {t.label}
                  </button>
                ))}
              </nav>

              <div className="profile-body" key={tab}>
                <div className="inv-embed rd contents">
                  <div className="space-y-4">
                    {tab === "overview" && (
                      <>
                        <InvoiceSummary invoice={invoice} />
                        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                          <InfoCard title="Billed to" icon={<User className="size-4 text-ink-faint" />}>
                            <p className="text-[15px] font-medium text-ink">{invoice.tenant.name}</p>
                            <Row icon={<Mail className="size-3.5" />} value={invoice.tenant.email} />
                            <Row icon={<Phone className="size-3.5" />} value={invoice.tenant.phone} />
                            <Row icon={<ReceiptText className="size-3.5" />} value={`Lease ${invoice.leaseRef}`} />
                          </InfoCard>
                          <InfoCard title="Property & unit" icon={<Building2 className="size-4 text-ink-faint" />}>
                            <p className="text-[15px] font-medium text-ink">{invoice.propertyName}</p>
                            <Row icon={<MapPin className="size-3.5" />} value={prop?.city ?? "Toronto, ON"} />
                            <Row icon={<Tag className="size-3.5" />} value={`Unit ${invoice.unit}`} />
                            <Row icon={<FileText className="size-3.5" />} value={`${typeLabels[invoice.type]} invoice`} />
                          </InfoCard>
                        </div>
                        <section aria-label="Billing details" className="rounded-xl border border-line bg-surface">
                          <header className="flex items-center gap-2 border-b border-line px-4 py-3">
                            <CalendarRange className="size-4 text-ink-faint" />
                            <h3 className="text-[14px] font-semibold text-ink">Billing details</h3>
                          </header>
                          <dl className="divide-y divide-line text-[13px]">
                            <Detail label="Invoice date" value={formatDate(invoice.issueDate)} />
                            <Detail label="Due date" value={formatDate(invoice.dueDate)} />
                            <Detail label="Billing period" value={`${formatDate(invoice.billingPeriodStart)} – ${formatDate(invoice.billingPeriodEnd)}`} />
                            <Detail label="Invoice type" value={typeLabels[invoice.type]} />
                            <Detail label="Status" value={statusLabels[invoice.status]} />
                            <Detail label="Currency" value="Canadian dollar (CAD)" />
                            <Detail label="Total invoiced" value={formatCAD(invoiceTotal(invoice))} mono />
                            <Detail label="Amount paid" value={formatCAD(invoicePaid(invoice))} mono />
                            <Detail label="Balance due" value={formatCAD(invoiceBalance(invoice))} mono strong />
                            {invoice.discount > 0 ? <Detail label="Credits applied" value={`−${formatCAD(invoice.discount)}`} mono /> : null}
                          </dl>
                        </section>
                        {invoice.memo ? (
                          <section className="rounded-xl border border-unpaid/25 bg-unpaid/[0.06] p-4">
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-unpaid">Billing note</p>
                            <p className="mt-1.5 text-[13px] leading-relaxed text-ink-muted">{invoice.memo}</p>
                          </section>
                        ) : null}
                      </>
                    )}
                    {tab === "items" && <InvoiceLineItems invoice={invoice} />}
                    {tab === "payments" && <PaymentHistory invoice={invoice} onRecordPayment={() => setPayOpen(true)} />}
                    {tab === "notes" && (
                      <AttachmentsNotes
                        invoice={invoice}
                        onAddNote={(body) => {
                          addNote(invoice.id, body);
                          toast({ kind: "success", title: "Note added" });
                        }}
                      />
                    )}
                    {tab === "activity" && <ActivityTimeline items={invoice.activity} />}
                  </div>
                </div>
              </div>

              <div className="profile-footer-actions rd contents">
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", padding: "12px 26px", borderTop: "1px solid var(--line)" }}>
                  <Button onClick={() => toast({ kind: "info", title: "Download PDF — placeholder", body: "This prototype does not generate files or send live notifications." })}><Download size={14} />Download PDF</Button>
                  <Button variant="danger" onClick={() => setVoidOpen(true)} disabled={locked}><Ban size={14} />Void invoice</Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {invoice && (needsApproval ? (
        <InvoiceFormModal open={editOpen} mode="edit" invoice={invoice} nextId={nextId} onClose={() => setEditOpen(false)} onSubmit={submitEdit} />
      ) : null)}
      {invoice && payOpen ? (
        <RecordPaymentModal
          open
          invoice={invoice}
          onClose={() => setPayOpen(false)}
          onSubmit={(input) => {
            recordPayment(invoice.id, input);
            toast({ kind: "success", title: `Payment recorded on ${invoice.id}`, body: `${formatCAD(input.amount)} applied · balance and status recalculated.` });
            setPayOpen(false);
          }}
        />
      ) : null}
      {invoice && (
        <ConfirmDialog
          open={voidOpen}
          title={`Void ${invoice.id}?`}
          body="The outstanding balance will be cleared from collections and the invoice will stay in the register marked as void. This cannot be undone in the prototype."
          confirmLabel="Void invoice"
          onCancel={() => setVoidOpen(false)}
          onConfirm={() => {
            voidInvoice(invoice.id, "Voided from the invoice record.");
            toast({ kind: "warning", title: `${invoice.id} voided`, body: "Balance cleared from collections in the demo ledger." });
          }}
        />
      )}
    </div>,
    document.body,
  );
}

/* ---------- local presentation helpers ---------- */

function InfoCard({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-surface">
      <header className="flex items-center gap-2 border-b border-line px-4 py-3">
        {icon}
        <h3 className="text-[14px] font-semibold text-ink">{title}</h3>
      </header>
      <div className="space-y-1.5 px-4 py-3.5">{children}</div>
    </section>
  );
}

function Row({ icon, value }: { icon: ReactNode; value: string }) {
  return (
    <p className="flex items-center gap-2 text-[12.5px] text-ink-muted">
      <span className="text-ink-faint">{icon}</span>
      <span className="truncate">{value}</span>
    </p>
  );
}

function Detail({ label, value, mono, strong }: { label: string; value: string; mono?: boolean; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-4 py-2.5">
      <dt className="shrink-0 text-ink-muted">{label}</dt>
      <dd className={`text-right tabular-nums ${strong ? "text-[14px] font-semibold text-ink" : "text-ink"} ${mono ? "tnum" : ""}`}>{value}</dd>
    </div>
  );
}
