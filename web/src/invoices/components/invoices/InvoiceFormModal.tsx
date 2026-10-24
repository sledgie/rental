import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@inv/components/ui/Button";
import { Fieldset, Input, Select } from "@inv/components/ui/Field";
import { Modal } from "@inv/components/ui/Modal";
import { useToast } from "@inv/components/ui/Toast";
import { useInvoices } from "@inv/store/InvoiceStore";
import { isSupabaseConfigured } from "../../../lib/supabase";
import { formatCAD, todayISO } from "@inv/lib/format";
import {
  invoiceSubtotal,
  invoiceTaxTotal,
  type Invoice,
  type InvoiceLineItem,
  type InvoiceStatus,
  type InvoiceType,
  type LineItemCategory,
} from "@inv/types/invoice";

const categories: LineItemCategory[] = [
  "Rent",
  "Utilities",
  "Maintenance",
  "Parking",
  "Storage",
  "Fees",
  "Other",
];

const emptyItem = (): InvoiceLineItem => ({
  id: `li-${Math.random().toString(36).slice(2, 8)}`,
  description: "",
  category: "Rent",
  quantity: 1,
  unitPrice: 0,
  taxRate: 0,
});

export interface InvoiceFormValues {
  id: string;
  /** database ids, filled in by the pickers when Supabase is connected */
  tenantId?: string;
  unitId?: string;
  leaseId?: string;
  tenantName: string;
  propertyId: string;
  propertyName: string;
  unit: string;
  leaseRef: string;
  type: InvoiceType;
  status: InvoiceStatus;
  issueDate: string;
  dueDate: string;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  discount: number;
  memo: string;
  lineItems: InvoiceLineItem[];
}

interface InvoiceFormModalProps {
  open: boolean;
  mode: "create" | "edit";
  invoice?: Invoice;
  /** Next available invoice ID, computed by the caller. */
  nextId: string;
  onClose: () => void;
  onSubmit: (values: InvoiceFormValues) => void;
}

const initialsOf = (name: string) =>
  name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");

export function InvoiceFormModal({
  open,
  mode,
  invoice,
  nextId,
  onClose,
  onSubmit,
}: InvoiceFormModalProps) {
  const toast = useToast();
  const { refs } = useInvoices();
  const properties = refs.properties;
  const tenants = refs.tenants.map((t) => t.name);
  const [values, setValues] = useState<InvoiceFormValues>(() => blank(nextId));

  useEffect(() => {
    if (!open) return;
    setValues(
      invoice
        ? {
            id: invoice.id,
            tenantId: invoice.tenantId,
            unitId: invoice.unitId,
            leaseId: invoice.leaseId,
            tenantName: invoice.tenant.name,
            propertyId: invoice.propertyId,
            propertyName: invoice.propertyName,
            unit: invoice.unit,
            leaseRef: invoice.leaseRef,
            type: invoice.type,
            status: invoice.status,
            issueDate: invoice.issueDate,
            dueDate: invoice.dueDate,
            billingPeriodStart: invoice.billingPeriodStart,
            billingPeriodEnd: invoice.billingPeriodEnd,
            discount: invoice.discount,
            memo: invoice.memo ?? "",
            lineItems: invoice.lineItems.map((i) => ({ ...i })),
          }
        : blank(nextId)
    );
  }, [open, invoice, nextId]);

  const patch = (p: Partial<InvoiceFormValues>) => setValues((v) => ({ ...v, ...p }));

  const totals = useMemo(() => {
    const subtotal = invoiceSubtotal({ lineItems: values.lineItems } as Invoice);
    const tax = invoiceTaxTotal({ lineItems: values.lineItems } as Invoice);
    const total = Math.max(0, subtotal + tax - (values.discount || 0));
    return { subtotal, tax, total };
  }, [values.lineItems, values.discount]);

  const valid =
    values.tenantName.trim() !== "" &&
    values.unit.trim() !== "" &&
    values.issueDate !== "" &&
    values.dueDate !== "" &&
    values.lineItems.some((i) => i.description.trim() !== "" && i.unitPrice > 0);

  const submit = () => {
    if (!valid) {
      toast({
        kind: "warning",
        title: "Some required fields are missing",
        body: "Add a tenant, unit, dates and at least one priced line item.",
      });
      return;
    }
    onSubmit(values);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      width="max-w-4xl"
      title={mode === "create" ? "Create invoice" : `Edit ${invoice?.id ?? "invoice"}`}
      description={
        mode === "create"
          ? isSupabaseConfigured ? "Charges are calculated in Canadian dollars. The invoice is saved as a draft unless you choose Unpaid." : "Charges are calculated in Canadian dollars. Nothing is sent to tenants from this prototype."
          : isSupabaseConfigured ? "Only draft and pending invoices can be edited. Issued invoices must be voided and re-issued." : "Changes apply to the demo record stored in this browser session."
      }
      footer={
        <>
          <span className="mr-auto text-[12px] text-ink-muted tabular-nums">
            New total <span className="font-semibold text-ink">{formatCAD(totals.total)}</span> CAD
          </span>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} disabled={!valid}>
            {mode === "create" ? "Create invoice" : "Save changes"}
          </Button>
        </>
      }
    >
      <div className="max-h-[62vh] space-y-4 overflow-y-auto scrollbar-thin pr-1">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Fieldset label="Invoice ID">
            <Input value={isSupabaseConfigured && mode === "create" ? "Assigned on save" : values.id} readOnly className="opacity-70" />
          </Fieldset>
          <Fieldset label="Invoice type">
            <Select
              value={values.type}
              onChange={(e) => patch({ type: e.target.value as InvoiceType })}
            >
              {(["rent", "utilities", "maintenance", "other"] as InvoiceType[]).map((t) => (
                <option key={t} value={t}>
                  {t[0].toUpperCase() + t.slice(1)}
                </option>
              ))}
            </Select>
          </Fieldset>
          <Fieldset label="Status">
            <Select
              value={values.status}
              onChange={(e) => patch({ status: e.target.value as InvoiceStatus })}
            >
              {(["draft", "pending_approval", "unpaid"] as InvoiceStatus[]).map((s) => (
                <option key={s} value={s}>
                  {s === "pending_approval"
                    ? "Pending Approval"
                    : s[0].toUpperCase() + s.slice(1)}
                </option>
              ))}
            </Select>
          </Fieldset>
          <Fieldset label="Lease reference">
            {isSupabaseConfigured ? (
              <Select
                value={values.leaseId ?? ""}
                disabled={!values.tenantId}
                onChange={(e) => {
                  const lease = refs.leases.find((l) => l.id === e.target.value);
                  patch({ leaseId: e.target.value || undefined, leaseRef: lease?.number ?? "" });
                }}
              >
                <option value="">{values.tenantId ? "No lease" : "Choose a tenant first"}</option>
                {refs.leases.filter((l) => l.tenantId === values.tenantId).map((l) => (
                  <option key={l.id} value={l.id}>{l.number}</option>
                ))}
              </Select>
            ) : (
              <Input
                value={values.leaseRef}
                onChange={(e) => patch({ leaseRef: e.target.value })}
                placeholder="LSE-2026-0000"
              />
            )}
          </Fieldset>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2">
            <Fieldset label="Tenant">
              {isSupabaseConfigured ? (
                <Select
                  value={values.tenantId ?? ""}
                  onChange={(e) => {
                    const tenant = refs.tenants.find((t) => t.id === e.target.value);
                    patch({ tenantId: e.target.value || undefined, tenantName: tenant?.name ?? "", leaseId: undefined, leaseRef: "" });
                  }}
                >
                  <option value="">Select a tenant…</option>
                  {refs.tenants.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </Select>
              ) : (
                <Select
                  value={values.tenantName}
                  onChange={(e) => patch({ tenantName: e.target.value })}
                >
                  <option value="">Select a tenant…</option>
                  {tenants.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </Select>
              )}
            </Fieldset>
          </div>
          <div className="sm:col-span-2">
            <Fieldset label="Property">
              <Select
                value={values.propertyId}
                onChange={(e) => {
                  const p = properties.find((x) => x.id === e.target.value);
                  patch({ propertyId: e.target.value, propertyName: p?.name ?? "", unitId: undefined, unit: "" });
                }}
              >
                <option value="">Select a property…</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {p.city}
                  </option>
                ))}
              </Select>
            </Fieldset>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Fieldset label="Unit">
            {isSupabaseConfigured ? (
              <Select
                value={values.unitId ?? ""}
                disabled={!values.propertyId}
                onChange={(e) => {
                  const unit = refs.units.find((u) => u.id === e.target.value);
                  patch({ unitId: e.target.value || undefined, unit: unit?.number ?? "" });
                }}
              >
                <option value="">{values.propertyId ? "Select a unit…" : "Choose a property first"}</option>
                {refs.units.filter((u) => u.propertyId === values.propertyId).map((u) => (
                  <option key={u.id} value={u.id}>{u.number}</option>
                ))}
              </Select>
            ) : (
              <Input
                value={values.unit}
                onChange={(e) => patch({ unit: e.target.value })}
                placeholder="101"
              />
            )}
          </Fieldset>
          <Fieldset label="Invoice date">
            <Input
              type="date"
              value={values.issueDate}
              onChange={(e) => patch({ issueDate: e.target.value })}
            />
          </Fieldset>
          <Fieldset label="Due date">
            <Input
              type="date"
              value={values.dueDate}
              onChange={(e) => patch({ dueDate: e.target.value })}
            />
          </Fieldset>
          <Fieldset label="Discount (CAD)">
            <Input
              type="number"
              min={0}
              step={5}
              value={values.discount || ""}
              onChange={(e) => patch({ discount: Number(e.target.value) || 0 })}
              placeholder="0.00"
            />
          </Fieldset>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Fieldset label="Billing period start">
            <Input
              type="date"
              value={values.billingPeriodStart}
              onChange={(e) => patch({ billingPeriodStart: e.target.value })}
            />
          </Fieldset>
          <Fieldset label="Billing period end">
            <Input
              type="date"
              value={values.billingPeriodEnd}
              onChange={(e) => patch({ billingPeriodEnd: e.target.value })}
            />
          </Fieldset>
          <div className="col-span-2">
            <Fieldset label="Internal memo" hint="optional">
              <Input
                value={values.memo}
                onChange={(e) => patch({ memo: e.target.value })}
                placeholder="Context for your team…"
              />
            </Fieldset>
          </div>
        </div>

        {/* Line items */}
        <div className="rounded-lg border border-line bg-surface-2/50">
          <div className="flex items-center justify-between border-b border-line px-3 py-2.5">
            <p className="text-[12px] font-semibold uppercase tracking-wide text-ink-muted">
              Line items
            </p>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => patch({ lineItems: [...values.lineItems, emptyItem()] })}
            >
              <Plus className="size-3.5" />
              Add line
            </Button>
          </div>
          <div className="space-y-2 p-3">
            {values.lineItems.map((item, idx) => (
              <div
                key={item.id}
                className="grid grid-cols-2 items-end gap-2 rounded-lg border border-line bg-surface p-2 lg:grid-cols-[repeat(24,minmax(0,1fr))]"
              >
                <div className="col-span-2 lg:col-span-8">
                  <p className="mb-1 text-[10.5px] uppercase tracking-wide text-ink-faint">
                    Description
                  </p>
                  <Input
                    value={item.description}
                    onChange={(e) => {
                      const lineItems = [...values.lineItems];
                      lineItems[idx] = { ...item, description: e.target.value };
                      patch({ lineItems });
                    }}
                    placeholder="Monthly rent — Unit 101"
                    className="h-8 text-[13px]"
                  />
                </div>
                <div className="lg:col-span-4">
                  <p className="mb-1 text-[10.5px] uppercase tracking-wide text-ink-faint">
                    Category
                  </p>
                  <Select
                    value={item.category}
                    onChange={(e) => {
                      const lineItems = [...values.lineItems];
                      lineItems[idx] = {
                        ...item,
                        category: e.target.value as LineItemCategory,
                      };
                      patch({ lineItems });
                    }}
                    className="h-8 text-[13px]"
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="lg:col-span-2">
                  <p className="mb-1 text-[10.5px] uppercase tracking-wide text-ink-faint">Qty</p>
                  <Input
                    type="number"
                    min={1}
                    step={1}
                    value={item.quantity}
                    onChange={(e) => {
                      const lineItems = [...values.lineItems];
                      lineItems[idx] = { ...item, quantity: Number(e.target.value) || 0 };
                      patch({ lineItems });
                    }}
                    className="h-8 text-[13px]"
                  />
                </div>
                <div className="lg:col-span-3">
                  <p className="mb-1 text-[10.5px] uppercase tracking-wide text-ink-faint">
                    Unit $
                  </p>
                  <Input
                    type="number"
                    min={0}
                    step={10}
                    value={item.unitPrice || ""}
                    onChange={(e) => {
                      const lineItems = [...values.lineItems];
                      lineItems[idx] = { ...item, unitPrice: Number(e.target.value) || 0 };
                      patch({ lineItems });
                    }}
                    className="h-8 text-[13px]"
                  />
                </div>
                <div className="lg:col-span-2">
                  <p className="mb-1 text-[10.5px] uppercase tracking-wide text-ink-faint">
                    Tax %
                  </p>
                  <Select
                    value={item.taxRate}
                    onChange={(e) => {
                      const lineItems = [...values.lineItems];
                      lineItems[idx] = { ...item, taxRate: Number(e.target.value) };
                      patch({ lineItems });
                    }}
                    className="h-8 text-[13px]"
                  >
                    {[0, 5, 13, 15].map((r) => (
                      <option key={r} value={r}>
                        {r === 0 ? "Exempt" : `${r}%`}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="flex items-center justify-between gap-2 lg:col-span-3 lg:justify-end">
                  <span className="text-[12.5px] text-ink-muted tabular-nums lg:hidden">
                    Line total
                  </span>
                  <span className="text-[13px] font-medium text-ink tabular-nums">
                    {formatCAD(item.quantity * item.unitPrice * (1 + item.taxRate / 100))}
                  </span>
                  <button
                    type="button"
                    aria-label={`Remove line ${idx + 1}`}
                    onClick={() =>
                      patch({
                        lineItems: values.lineItems.filter((_, i) => i !== idx),
                      })
                    }
                    className="grid size-8 place-items-center rounded-md text-ink-faint transition-colors hover:bg-overdue/10 hover:text-overdue"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            ))}
            {values.lineItems.length === 0 ? (
              <p className="py-4 text-center text-[12.5px] text-ink-muted">
                No line items yet — add one to price this invoice.
              </p>
            ) : (
              <dl className="flex flex-wrap justify-end gap-x-6 gap-y-1 pt-1 text-[12.5px]">
                <div className="flex gap-2">
                  <dt className="text-ink-muted">Subtotal</dt>
                  <dd className="tabular-nums text-ink">{formatCAD(totals.subtotal)}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="text-ink-muted">Tax</dt>
                  <dd className="tabular-nums text-ink">{formatCAD(totals.tax)}</dd>
                </div>
                <div className="flex gap-2 font-semibold">
                  <dt className="text-ink">Total</dt>
                  <dd className="tabular-nums text-ink">{formatCAD(totals.total)}</dd>
                </div>
              </dl>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

function blank(nextId: string): InvoiceFormValues {
  const period = new Date(todayISO());
  return {
    id: nextId,
    tenantName: "",
    propertyId: "",
    propertyName: "",
    unit: "",
    leaseRef: "",
    type: "rent",
    status: "draft",
    issueDate: todayISO(),
    dueDate: new Date(period.getFullYear(), period.getMonth(), period.getDate() + 14)
      .toISOString()
      .slice(0, 10),
    billingPeriodStart: todayISO(),
    billingPeriodEnd: new Date(period.getFullYear(), period.getMonth() + 1, 0)
      .toISOString()
      .slice(0, 10),
    discount: 0,
    memo: "",
    lineItems: [emptyItem()],
  };
}

export { initialsOf };
