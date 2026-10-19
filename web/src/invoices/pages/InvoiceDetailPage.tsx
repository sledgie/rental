import { useState } from "react";
import { Link, useParams } from "@inv/router";
import {
  ArrowLeft,
  Building2,
  CalendarRange,
  ChevronRight,
  Copy,
  FileText,
  Mail,
  MapPin,
  Phone,
  ReceiptText,
  SearchX,
  Tag,
  User,
} from "lucide-react";
import { Button } from "@inv/components/ui/Button";
import { ConfirmDialog } from "@inv/components/ui/ConfirmDialog";
import { useToast } from "@inv/components/ui/Toast";
import { RecordPaymentModal } from "@inv/components/invoices/RecordPaymentModal";
import { ActivityTimeline } from "@inv/components/invoices/ActivityTimeline";
import { AttachmentsNotes } from "@inv/components/invoices/AttachmentsNotes";
import { InvoiceDetailHeader } from "@inv/components/invoices/InvoiceDetailHeader";
import { InvoiceFormModal, type InvoiceFormValues } from "@inv/components/invoices/InvoiceFormModal";
import { InvoiceLineItems } from "@inv/components/invoices/InvoiceLineItems";
import { InvoiceSummary } from "@inv/components/invoices/InvoiceSummary";
import { PaymentHistory } from "@inv/components/invoices/PaymentHistory";
import { properties } from "@inv/data/mockInvoices";
import { formatCAD, formatDate } from "@inv/lib/format";
import { useInvoices } from "@inv/store/InvoiceStore";
import { invoiceBalance, invoicePaid, invoiceTotal, statusLabels, typeLabels } from "@inv/types/invoice";

export default function InvoiceDetailPage() {
  const { id = "" } = useParams();
  const toast = useToast();
  const { getInvoice, updateInvoice, recordPayment, voidInvoice, approveInvoice, addNote, invoices } =
    useInvoices();
  const invoice = getInvoice(id);

  const [editOpen, setEditOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [voidOpen, setVoidOpen] = useState(false);

  if (!invoice) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-line bg-surface px-6 py-16 text-center">
        <div className="mx-auto grid size-11 place-items-center rounded-full border border-line bg-surface-2">
          <SearchX className="size-5 text-ink-faint" />
        </div>
        <p className="mt-4 text-[15px] font-medium text-ink">Invoice not found</p>
        <p className="mx-auto mt-1.5 max-w-sm text-[13px] leading-relaxed text-ink-muted">
          {id ? (
            <>
              No invoice matching <span className="text-ink">{id}</span> exists in the demo register.
              It may have been reset or never created.
            </>
          ) : (
            "No invoice identifier was supplied."
          )}
        </p>
        <div className="mt-5 flex justify-center">
          <Link to="/invoices">
            <Button variant="secondary">
              <ArrowLeft className="size-4" />
              Back to Invoices
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const nextId = (() => {
    const nums = invoices
      .map((i) => Number(i.id.split("-").pop()))
      .filter((n) => Number.isFinite(n)) as number[];
    return `INV-2026-${String((nums.length ? Math.max(...nums) : 0) + 1).padStart(3, "0")}`;
  })();

  const editable = invoice.status === "draft" || invoice.status === "pending_approval";
  const balance = invoiceBalance(invoice);

  const submitEdit = (values: InvoiceFormValues) => {
    updateInvoice(invoice.id, {
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

  return (
    <>
      <InvoiceDetailHeader
        invoice={invoice}
        onEdit={() => setEditOpen(true)}
        onRecordPayment={() => setPayOpen(true)}
        onApprove={() => {
          approveInvoice(invoice.id);
          toast({
            kind: "success",
            title: `${invoice.id} approved`,
            body: "Status moved to Unpaid and queued for delivery (demo only).",
          });
        }}
        onVoid={() => setVoidOpen(true)}
      />

      <div className="space-y-4">
        <InvoiceSummary invoice={invoice} />

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          {/* Main column */}
          <div className="space-y-4 xl:col-span-2">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <InfoCard
                title="Billed to"
                icon={<User className="size-4 text-ink-faint" />}
                headerRight={
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      navigator.clipboard
                        ?.writeText(`${invoice.tenant.name} · ${invoice.tenant.email}`)
                        .catch(() => undefined);
                      toast({ kind: "success", title: "Tenant contact copied" });
                    }}
                  >
                    <Copy className="size-3.5" />
                    Copy
                  </Button>
                }
              >
                <p className="text-[15px] font-medium text-ink">{invoice.tenant.name}</p>
                <Row icon={<Mail className="size-3.5" />} value={invoice.tenant.email} />
                <Row icon={<Phone className="size-3.5" />} value={invoice.tenant.phone} />
                <Row icon={<ReceiptText className="size-3.5" />} value={`Lease ${invoice.leaseRef}`} />
              </InfoCard>

              <InfoCard
                title="Property & unit"
                icon={<Building2 className="size-4 text-ink-faint" />}
                headerRight={
                  <span className="text-[11.5px] text-ink-faint">
                    {properties.find((p) => p.id === invoice.propertyId)?.units ?? "—"} units
                  </span>
                }
              >
                <p className="text-[15px] font-medium text-ink">{invoice.propertyName}</p>
                <Row
                  icon={<MapPin className="size-3.5" />}
                  value={
                    properties.find((p) => p.id === invoice.propertyId)?.city ??
                    "Toronto, ON"
                  }
                />
                <Row icon={<Tag className="size-3.5" />} value={`Unit ${invoice.unit}`} />
                <Row
                  icon={<FileText className="size-3.5" />}
                  value={`${typeLabels[invoice.type]} invoice`}
                />
              </InfoCard>
            </div>

            <InvoiceLineItems invoice={invoice} />

            <PaymentHistory invoice={invoice} onRecordPayment={() => setPayOpen(true)} />

            <AttachmentsNotes
              invoice={invoice}
              onAddNote={(body) => {
                addNote(invoice.id, body);
                toast({ kind: "success", title: "Note added" });
              }}
            />
          </div>

          {/* Side column */}
          <div className="space-y-4">
            <section
              aria-label="Billing details"
              className="rounded-xl border border-line bg-surface"
            >
              <header className="flex items-center gap-2 border-b border-line px-4 py-3">
                <CalendarRange className="size-4 text-ink-faint" />
                <h2 className="text-[14px] font-semibold text-ink">Billing details</h2>
              </header>
              <dl className="divide-y divide-line text-[13px]">
                <Detail label="Invoice date" value={formatDate(invoice.issueDate)} />
                <Detail label="Due date" value={formatDate(invoice.dueDate)} />
                <Detail
                  label="Billing period"
                  value={`${formatDate(invoice.billingPeriodStart)} – ${formatDate(
                    invoice.billingPeriodEnd
                  )}`}
                />
                <Detail label="Invoice type" value={typeLabels[invoice.type]} />
                <Detail label="Status" value={statusLabels[invoice.status]} />
                <Detail label="Currency" value="Canadian dollar (CAD)" />
                <Detail
                  label="Total invoiced"
                  value={formatCAD(invoiceTotal(invoice))}
                  mono
                />
                <Detail label="Amount paid" value={formatCAD(invoicePaid(invoice))} mono />
                <Detail label="Balance due" value={formatCAD(balance)} mono strong />
                {invoice.discount > 0 ? (
                  <Detail label="Credits applied" value={`−${formatCAD(invoice.discount)}`} mono />
                ) : null}
              </dl>
            </section>

            {invoice.memo ? (
              <section className="rounded-xl border border-unpaid/25 bg-unpaid/[0.06] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-unpaid">
                  Billing note
                </p>
                <p className="mt-1.5 text-[13px] leading-relaxed text-ink-muted">{invoice.memo}</p>
              </section>
            ) : null}

            <ActivityTimeline items={invoice.activity} />

            <div className="rounded-xl border border-line bg-surface p-4">
              <p className="text-[12.5px] text-ink-muted">
                Need another invoice from this lease?
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link to="/invoices">
                  <Button variant="secondary" size="sm">
                    <ArrowLeft className="size-3.5" />
                    Back to register
                  </Button>
                </Link>
                <Button
                  size="sm"
                  variant="subtle"
                  onClick={() =>
                    toast({
                      kind: "info",
                      title: "Tenant ledger unavailable",
                      body: "Only the invoice module is implemented in this prototype.",
                    })
                  }
                >
                  View tenant ledger
                  <ChevronRight className="size-3.5" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {editable ? (
        <InvoiceFormModal
          open={editOpen}
          mode="edit"
          invoice={invoice}
          nextId={nextId}
          onClose={() => setEditOpen(false)}
          onSubmit={submitEdit}
        />
      ) : null}

      {payOpen ? (
        <RecordPaymentModal
          open
          invoice={invoice}
          onClose={() => setPayOpen(false)}
          onSubmit={(input) => {
            recordPayment(invoice.id, input);
            toast({
              kind: "success",
              title: `Payment recorded on ${invoice.id}`,
              body: `${formatCAD(input.amount)} applied · balance and status recalculated.`,
            });
            setPayOpen(false);
          }}
        />
      ) : null}

      <ConfirmDialog
        open={voidOpen}
        title={`Void ${invoice.id}?`}
        body="The outstanding balance will be cleared from collections and the invoice will stay in the register marked as void. This cannot be undone in the prototype."
        confirmLabel="Void invoice"
        onCancel={() => setVoidOpen(false)}
        onConfirm={() => {
          voidInvoice(invoice.id, "Voided from the invoice detail page.");
          toast({
            kind: "warning",
            title: `${invoice.id} voided`,
            body: "Balance cleared from collections in the demo ledger.",
          });
        }}
      />
    </>
  );
}

/* ---------- local presentation helpers ---------- */

function InfoCard({
  title,
  icon,
  headerRight,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-line bg-surface">
      <header className="flex items-center gap-2 border-b border-line px-4 py-3">
        {icon}
        <h2 className="text-[14px] font-semibold text-ink">{title}</h2>
        {headerRight ? <span className="ml-auto">{headerRight}</span> : null}
      </header>
      <div className="space-y-1.5 px-4 py-3.5">{children}</div>
    </section>
  );
}

function Row({ icon, value }: { icon: React.ReactNode; value: string }) {
  return (
    <p className="flex items-center gap-2 text-[12.5px] text-ink-muted">
      <span className="text-ink-faint">{icon}</span>
      <span className="truncate">{value}</span>
    </p>
  );
}

function Detail({
  label,
  value,
  mono,
  strong,
}: {
  label: string;
  value: string;
  mono?: boolean;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-4 py-2.5">
      <dt className="shrink-0 text-ink-muted">{label}</dt>
      <dd
        className={`text-right tabular-nums ${
          strong ? "text-[14px] font-semibold text-ink" : "text-ink"
        } ${mono ? "tnum" : ""}`}
      >
        {value}
      </dd>
    </div>
  );
}


