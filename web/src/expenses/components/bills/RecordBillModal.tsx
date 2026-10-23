import { isSupabaseConfigured } from "../../../lib/supabase";
import { Button } from "../ui/Button";
import { Field, Input, Select, Textarea } from "../ui/Field";
import { Modal } from "../ui/Modal";
import { ProviderSelect } from "./ProviderSelect";
import { useApp } from "../../context/AppContext";
import { properties, providers, tenants, unitsForProperty } from "../../data/catalog";
import type {
  AllocationMethod,
  Bill,
  BillCategory,
  CalculationBasis,
  Frequency,
  RecurringSchedule,
  TenantAllocation,
} from "../../types";
import { allocationsExceedBill } from "../../utils/bills";
import { addDays, todayISO, toISODate, uid } from "../../utils/format";
import { useEffect, useMemo, useState, useRef } from "react";

const categories: BillCategory[] = [
  "hydro",
  "gas",
  "water",
  "internet",
  "insurance",
  "property_tax",
  "maintenance",
  "other",
];

const methods: AllocationMethod[] = ["none", "percentage", "fixed", "manual", "equal_split"];

function advanceExpected(iso: string, frequency: Frequency): string {
  const d = new Date(`${iso}T00:00:00`);
  if (frequency === "weekly") d.setDate(d.getDate() + 7);
  else if (frequency === "monthly") d.setMonth(d.getMonth() + 1);
  else if (frequency === "quarterly") d.setMonth(d.getMonth() + 3);
  else if (frequency === "semi-annually") d.setMonth(d.getMonth() + 6);
  else if (frequency === "annually") d.setFullYear(d.getFullYear() + 1);
  else d.setMonth(d.getMonth() + 1);
  return toISODate(d);
}

interface Draft {
  name: string;
  category: BillCategory;
  providerId: string;
  propertyId: string;
  unitIds: string[];
  invoiceNumber: string;
  accountNumber: string;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  invoiceDate: string;
  dueDate: string;
  amount: string;
  notes: string;
  scheduleId?: string;
  method: AllocationMethod;
  tenantIds: string[];
  percentage: string;
  fixedAmount: string;
  basis: CalculationBasis;
  attachmentName: string;
}

function emptyDraft(): Draft {
  return {
    name: "",
    category: "hydro",
    providerId: providers[0]?.id ?? "",
    propertyId: properties[0]?.id ?? "",
    unitIds: [],
    invoiceNumber: "",
    accountNumber: "",
    billingPeriodStart: addDays(todayISO(), -30),
    billingPeriodEnd: todayISO(),
    invoiceDate: todayISO(),
    dueDate: addDays(todayISO(), 15),
    amount: "",
    notes: "",
    method: "none",
    tenantIds: [],
    percentage: "30",
    fixedAmount: "",
    basis: "actual",
    attachmentName: "",
  };
}

function fromSchedule(s: RecurringSchedule): Draft {
  return {
    name: s.name,
    category: s.category,
    providerId: s.providerId,
    propertyId: s.propertyId,
    unitIds: s.unitId ? [s.unitId] : [],
    invoiceNumber: "",
    accountNumber: s.accountNumber ?? "",
    billingPeriodStart: addDays(todayISO(), -30),
    billingPeriodEnd: todayISO(),
    invoiceDate: todayISO(),
    dueDate: addDays(todayISO(), 15),
    amount: s.expectedAmount != null ? String(s.expectedAmount) : "",
    notes: `Recorded from schedule ${s.id}. Expected amount was ${s.expectedAmount != null ? s.expectedAmount.toFixed(2) : "n/a"} CAD — enter the actual invoice amount.`,
    scheduleId: s.id,
    method: s.allocationMethod,
    tenantIds: s.allocationTenantIds,
    percentage: s.allocationPercentage != null ? String(s.allocationPercentage) : "30",
    fixedAmount: s.allocationFixedAmount != null ? String(s.allocationFixedAmount) : "",
    basis: "actual",
    attachmentName: "",
  };
}

function buildAllocations(draft: Draft): TenantAllocation[] {
  if (draft.method === "none" || draft.tenantIds.length === 0) return [];
  return draft.tenantIds.map((tid) => {
    const tenant = tenants.find((t) => t.id === tid);
    return {
      id: uid("alloc"),
      tenantId: tid,
      unitId: tenant?.unitId ?? draft.unitIds[0] ?? "",
      method: draft.method,
      percentage: draft.method === "percentage" ? Number(draft.percentage) || 0 : undefined,
      fixedAmount:
        draft.method === "fixed" ? Number(draft.fixedAmount) || 0 : undefined,
      manualAmount:
        draft.method === "manual" ? Number(draft.fixedAmount) || 0 : undefined,
      calculationBasis: draft.basis,
    };
  });
}

export function RecordBillModal({
  open,
  onClose,
  schedule,
  editBill,
}: {
  open: boolean;
  onClose: () => void;
  schedule?: RecurringSchedule | null;
  editBill?: Bill | null;
}) {
  const { addBill, updateBill, updateSchedule, pushToast } = useApp();
  const attachmentFile = useRef<File | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    if (editBill) {
      const first = editBill.allocations[0];
      setDraft({
        name: editBill.name,
        category: editBill.category,
        providerId: editBill.providerId,
        propertyId: editBill.propertyId,
        unitIds: editBill.unitIds,
        invoiceNumber: editBill.invoiceNumber ?? "",
        accountNumber: editBill.accountNumber ?? "",
        billingPeriodStart: editBill.billingPeriodStart,
        billingPeriodEnd: editBill.billingPeriodEnd,
        invoiceDate: editBill.invoiceDate,
        dueDate: editBill.dueDate,
        amount: String(editBill.amount),
        notes: editBill.notes ?? "",
        scheduleId: editBill.scheduleId,
        method: first?.method ?? "none",
        tenantIds: editBill.allocations.map((a) => a.tenantId),
        percentage: first?.percentage != null ? String(first.percentage) : "30",
        fixedAmount: String(first?.fixedAmount ?? first?.manualAmount ?? ""),
        basis: first?.calculationBasis ?? "actual",
        attachmentName: "",
      });
    } else if (schedule) {
      setDraft(fromSchedule(schedule));
    } else {
      setDraft(emptyDraft());
    }
    setErrors({});
  }, [open, schedule, editBill]);

  const propertyUnits = useMemo(
    () => unitsForProperty(draft.propertyId),
    [draft.propertyId],
  );
  const propertyTenants = useMemo(
    () =>
      tenants.filter((t) => propertyUnits.some((u) => u.id === t.unitId)),
    [propertyUnits],
  );

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!draft.name.trim()) next.name = "Bill name is required.";
    if (!draft.amount || Number(draft.amount) <= 0) next.amount = "Enter the actual invoice amount.";
    if (!draft.invoiceDate) next.invoiceDate = "Invoice date is required.";
    if (!draft.dueDate) next.dueDate = "Due date is required.";
    if (!draft.billingPeriodStart || !draft.billingPeriodEnd) {
      next.period = "Billing period is required.";
    }
    if (draft.method !== "none" && draft.tenantIds.length === 0) {
      next.tenants = "Select at least one tenant for recovery.";
    }
    if (draft.method === "percentage") {
      const p = Number(draft.percentage);
      if (Number.isNaN(p) || p <= 0 || p > 100) next.percentage = "Enter a percentage between 0 and 100.";
    }
    if ((draft.method === "fixed" || draft.method === "manual") && Number(draft.fixedAmount) <= 0) {
      next.fixedAmount = "Enter a positive amount.";
    }
    const amount = Number(draft.amount) || 0;
    const allocs = buildAllocations(draft);
    if (allocationsExceedBill(amount, allocs)) {
      next.alloc = "Tenant allocations exceed the actual invoice amount.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function save() {
    if (!validate()) return;
    const amount = Number(draft.amount);
    const allocations = buildAllocations(draft);
    const documents = draft.attachmentName
      ? [
          {
            id: uid("DOC"),
            billId: editBill?.id ?? "",
            name: "Invoice attachment",
            type: "invoice" as const,
            mockFileName: draft.attachmentName,
            addedAt: todayISO(),
          },
        ]
      : [];

    if (editBill) {
      updateBill(editBill.id, {
        name: draft.name,
        category: draft.category,
        providerId: draft.providerId,
        propertyId: draft.propertyId,
        unitIds: draft.unitIds,
        invoiceNumber: draft.invoiceNumber || undefined,
        accountNumber: draft.accountNumber || undefined,
        billingPeriodStart: draft.billingPeriodStart,
        billingPeriodEnd: draft.billingPeriodEnd,
        invoiceDate: draft.invoiceDate,
        dueDate: draft.dueDate,
        amount,
        notes: draft.notes,
        allocations,
      });
      pushToast("Bill updated. Actual invoice amount preserved as source of truth.");
    } else {
      addBill({
        name: draft.name,
        category: draft.category,
        providerId: draft.providerId,
        propertyId: draft.propertyId,
        unitIds: draft.unitIds,
        invoiceNumber: draft.invoiceNumber || undefined,
        accountNumber: draft.accountNumber || undefined,
        billingPeriodStart: draft.billingPeriodStart,
        billingPeriodEnd: draft.billingPeriodEnd,
        invoiceDate: draft.invoiceDate,
        dueDate: draft.dueDate,
        amount,
        notes: draft.notes,
        scheduleId: draft.scheduleId,
        allocations,
        reminderDays: [7, 3, 0],
        documents: documents.map((d) => ({ ...d, billId: "" })),
        files: attachmentFile.current ? [attachmentFile.current] : [],
      });
      attachmentFile.current = null;
      pushToast("Actual bill recorded. Provider balance and tenant recovery are tracked separately.");
      if (schedule) {
        updateSchedule(schedule.id, {
          nextExpectedDate: advanceExpected(schedule.nextExpectedDate, schedule.frequency),
        });
      }
    }
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title={editBill ? "Edit bill" : schedule ? "Record actual bill from schedule" : "Record new bill"}
      subtitle="Enter the actual invoice amount independently of any expected recurring amount."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save}>{editBill ? "Save changes" : "Record bill"}</Button>
        </>
      }
    >
      {schedule && (
        <div className="mb-4 rounded-lg border border-u-accent/20 bg-u-accent/8 px-3 py-2 text-xs text-u-accent">
          Prefilling from {schedule.id} · {schedule.name}. Expected amount{" "}
          {schedule.expectedAmount != null ? `$${schedule.expectedAmount.toFixed(2)}` : "not set"} is a forecast
          only — it does not mark anything paid.
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Bill name" error={errors.name} className="sm:col-span-2">
          <Input value={draft.name} onChange={(e) => set("name", e.target.value)} placeholder="Hydro — Unit 101" />
        </Field>
        <Field label="Category">
          <Select
            value={draft.category}
            onChange={(e) => set("category", e.target.value as BillCategory)}
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c.replace("_", " ")}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Service provider">
          <ProviderSelect value={draft.providerId} onChange={(id) => set("providerId", id)} />
        </Field>
        <Field label="Property">
          <Select
            value={draft.propertyId}
            onChange={(e) =>
              setDraft((d) => ({ ...d, propertyId: e.target.value, unitIds: [], tenantIds: [] }))
            }
          >
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Unit (optional)" hint="Leave empty for building-level bills.">
          <Select
            value={draft.unitIds[0] ?? ""}
            onChange={(e) => set("unitIds", e.target.value ? [e.target.value] : [])}
          >
            <option value="">Entire property</option>
            {propertyUnits.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Invoice number">
          <Input value={draft.invoiceNumber} onChange={(e) => set("invoiceNumber", e.target.value)} />
        </Field>
        <Field label="Account number (optional)">
          <Input value={draft.accountNumber} onChange={(e) => set("accountNumber", e.target.value)} />
        </Field>
        <Field label="Billing period start" error={errors.period}>
          <Input
            type="date"
            value={draft.billingPeriodStart}
            onChange={(e) => set("billingPeriodStart", e.target.value)}
          />
        </Field>
        <Field label="Billing period end">
          <Input
            type="date"
            value={draft.billingPeriodEnd}
            onChange={(e) => set("billingPeriodEnd", e.target.value)}
          />
        </Field>
        <Field label="Invoice date" error={errors.invoiceDate}>
          <Input type="date" value={draft.invoiceDate} onChange={(e) => set("invoiceDate", e.target.value)} />
        </Field>
        <Field label="Due date" error={errors.dueDate}>
          <Input type="date" value={draft.dueDate} onChange={(e) => set("dueDate", e.target.value)} />
        </Field>
        <Field
          label="Actual invoice amount (CAD)"
          error={errors.amount}
          hint="Source of truth. Not overwritten by expected schedule amounts."
        >
          <Input
            type="number"
            min="0"
            step="0.01"
            value={draft.amount}
            onChange={(e) => set("amount", e.target.value)}
            placeholder="200.00"
          />
        </Field>
        <Field label="Tenant allocation rule" error={errors.alloc}>
          <Select
            value={draft.method}
            onChange={(e) => set("method", e.target.value as AllocationMethod)}
          >
            {methods.map((m) => (
              <option key={m} value={m}>
                {m === "none"
                  ? "No tenant recovery"
                  : m === "percentage"
                    ? "Percentage of actual bill"
                    : m === "fixed"
                      ? "Fixed amount"
                      : m === "manual"
                        ? "Manually entered amount"
                        : "Equal split among selected tenants"}
              </option>
            ))}
          </Select>
        </Field>
        {draft.method !== "none" && (
          <Field
            label="Tenants responsible"
            error={errors.tenants}
            className="sm:col-span-2"
            hint="Selecting multiple tenants will not duplicate recovery of the same share."
          >
            <div className="grid gap-1.5 rounded-lg border border-u-line2 bg-u-bg p-2 sm:grid-cols-2">
              {propertyTenants.map((t) => (
                <label key={t.id} className="flex items-center gap-2 text-sm text-u-ink">
                  <input
                    type="checkbox"
                    checked={draft.tenantIds.includes(t.id)}
                    onChange={(e) =>
                      set(
                        "tenantIds",
                        e.target.checked
                          ? [...draft.tenantIds, t.id]
                          : draft.tenantIds.filter((id) => id !== t.id),
                      )
                    }
                    className="accent-u-accent"
                  />
                  {t.name}
                </label>
              ))}
              {propertyTenants.length === 0 && (
                <p className="px-1 py-2 text-xs text-u-muted">No tenants on this property.</p>
              )}
            </div>
          </Field>
        )}
        {draft.method === "percentage" && (
          <>
            <Field label="Allocation percentage" error={errors.percentage}>
              <Input
                type="number"
                min="0"
                max="100"
                value={draft.percentage}
                onChange={(e) => set("percentage", e.target.value)}
              />
            </Field>
            <Field label="Calculation basis">
              <Select
                value={draft.basis}
                onChange={(e) => set("basis", e.target.value as CalculationBasis)}
              >
                <option value="actual">Actual invoice amount (default)</option>
                <option value="expected">Expected recurring amount</option>
              </Select>
            </Field>
          </>
        )}
        {(draft.method === "fixed" || draft.method === "manual") && (
          <Field
            label={draft.method === "fixed" ? "Fixed amount per tenant (CAD)" : "Manual amount per tenant (CAD)"}
            error={errors.fixedAmount}
          >
            <Input
              type="number"
              min="0"
              step="0.01"
              value={draft.fixedAmount}
              onChange={(e) => set("fixedAmount", e.target.value)}
            />
          </Field>
        )}
        <Field label="Notes" className="sm:col-span-2">
          <Textarea value={draft.notes} onChange={(e) => set("notes", e.target.value)} />
        </Field>
        <Field
          label="Invoice attachment"
          hint={isSupabaseConfigured ? "PDF or image, up to 25 MB. Stored securely with the bill." : "Prototype upload — files are not persisted to storage."}
          className="sm:col-span-2"
        >
          <Input
            type="file"
            onChange={(e) => { attachmentFile.current = e.target.files?.[0] ?? null; set("attachmentName", e.target.files?.[0]?.name ?? ""); }}
          />
          {draft.attachmentName && (
            <p className="mt-1 text-[11px] text-u-accent">{isSupabaseConfigured ? "Will be uploaded when you save" : "Queued locally"}: {draft.attachmentName}</p>
          )}
        </Field>
      </div>
    </Modal>
  );
}
