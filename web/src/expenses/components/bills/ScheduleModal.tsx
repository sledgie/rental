import { Button } from "../ui/Button";
import { Checkbox, Field, Input, Select, Textarea } from "../ui/Field";
import { Modal } from "../ui/Modal";
import { ProviderSelect } from "./ProviderSelect";
import { useApp } from "../../context/AppContext";
import { properties, providers, tenants, unitsForProperty } from "../../data/catalog";
import type {
  AllocationMethod,
  BillCategory,
  Frequency,
  RecurringSchedule,
  ResponsibleParty,
  ScheduleStatus,
} from "../../types";
import { todayISO } from "../../utils/format";
import { useEffect, useMemo, useState } from "react";

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
const freqs: Frequency[] = ["weekly", "monthly", "quarterly", "semi-annually", "annually", "custom"];
const methods: AllocationMethod[] = ["none", "percentage", "fixed", "manual", "equal_split"];

interface Draft {
  name: string;
  category: BillCategory;
  providerId: string;
  propertyId: string;
  unitId: string;
  accountNumber: string;
  frequency: Frequency;
  customFrequencyNote: string;
  expectedAmount: string;
  nextExpectedDate: string;
  dueDateRule: string;
  responsibleParty: ResponsibleParty;
  allocationMethod: AllocationMethod;
  allocationPercentage: string;
  allocationFixedAmount: string;
  allocationTenantIds: string[];
  notes: string;
  status: ScheduleStatus;
  remind7: boolean;
  remind3: boolean;
  remind0: boolean;
  remindAfter: boolean;
}

function empty(): Draft {
  return {
    name: "",
    category: "hydro",
    providerId: providers[0]?.id ?? "",
    propertyId: properties[0]?.id ?? "",
    unitId: "",
    accountNumber: "",
    frequency: "monthly",
    customFrequencyNote: "",
    expectedAmount: "",
    nextExpectedDate: todayISO(),
    dueDateRule: "15 days after invoice date",
    responsibleParty: "landlord",
    allocationMethod: "none",
    allocationPercentage: "30",
    allocationFixedAmount: "",
    allocationTenantIds: [],
    notes: "",
    status: "active",
    remind7: true,
    remind3: true,
    remind0: true,
    remindAfter: true,
  };
}

function fromSchedule(s: RecurringSchedule): Draft {
  return {
    name: s.name,
    category: s.category,
    providerId: s.providerId,
    propertyId: s.propertyId,
    unitId: s.unitId ?? "",
    accountNumber: s.accountNumber ?? "",
    frequency: s.frequency,
    customFrequencyNote: s.customFrequencyNote ?? "",
    expectedAmount: s.expectedAmount != null ? String(s.expectedAmount) : "",
    nextExpectedDate: s.nextExpectedDate,
    dueDateRule: s.dueDateRule,
    responsibleParty: s.responsibleParty,
    allocationMethod: s.allocationMethod,
    allocationPercentage: s.allocationPercentage != null ? String(s.allocationPercentage) : "30",
    allocationFixedAmount: s.allocationFixedAmount != null ? String(s.allocationFixedAmount) : "",
    allocationTenantIds: s.allocationTenantIds,
    notes: s.notes ?? "",
    status: s.status,
    remind7: s.reminderDays.includes(7),
    remind3: s.reminderDays.includes(3),
    remind0: s.reminderDays.includes(0),
    remindAfter: s.reminderDays.includes(-1) || s.reminderDays.includes(0),
  };
}

export function ScheduleModal({
  open,
  onClose,
  edit,
}: {
  open: boolean;
  onClose: () => void;
  edit?: RecurringSchedule | null;
}) {
  const { addSchedule, updateSchedule, pushToast } = useApp();
  const [draft, setDraft] = useState<Draft>(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const units = useMemo(() => unitsForProperty(draft.propertyId), [draft.propertyId]);
  const propertyTenants = tenants.filter((t) => units.some((u) => u.id === t.unitId));

  useEffect(() => {
    if (!open) return;
    setDraft(edit ? fromSchedule(edit) : empty());
    setErrors({});
  }, [open, edit]);

  function reminderDays() {
    const days: number[] = [];
    if (draft.remind7) days.push(7);
    if (draft.remind3) days.push(3);
    if (draft.remind0) days.push(0);
    if (draft.remindAfter) days.push(-1);
    return days;
  }

  function save() {
    const next: Record<string, string> = {};
    if (!draft.name.trim()) next.name = "Schedule name is required.";
    if (!draft.nextExpectedDate) next.nextExpectedDate = "Next expected date is required.";
    if (draft.allocationMethod !== "none" && draft.allocationTenantIds.length === 0) {
      next.tenants = "Select tenants for the allocation rule.";
    }
    setErrors(next);
    if (Object.keys(next).length) return;

    const payload: Omit<RecurringSchedule, "id"> = {
      name: draft.name,
      category: draft.category,
      providerId: draft.providerId,
      propertyId: draft.propertyId,
      unitId: draft.unitId || undefined,
      accountNumber: draft.accountNumber || undefined,
      frequency: draft.frequency,
      customFrequencyNote: draft.customFrequencyNote || undefined,
      expectedAmount: draft.expectedAmount ? Number(draft.expectedAmount) : undefined,
      nextExpectedDate: draft.nextExpectedDate,
      dueDateRule: draft.dueDateRule,
      responsibleParty: draft.responsibleParty,
      allocationMethod: draft.allocationMethod,
      allocationPercentage:
        draft.allocationMethod === "percentage" ? Number(draft.allocationPercentage) : undefined,
      allocationFixedAmount:
        draft.allocationMethod === "fixed" || draft.allocationMethod === "manual"
          ? Number(draft.allocationFixedAmount)
          : undefined,
      allocationTenantIds: draft.allocationMethod === "none" ? [] : draft.allocationTenantIds,
      notes: draft.notes || undefined,
      status: draft.status,
      reminderDays: reminderDays(),
    };

    if (edit) {
      updateSchedule(edit.id, payload);
      pushToast("Recurring schedule updated. Existing invoices were not changed.");
    } else {
      addSchedule(payload);
      pushToast("Schedule added. This is an expected bill, not an actual invoice.");
    }
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title={edit ? "Edit recurring schedule" : "Add recurring schedule"}
      subtitle="Schedules forecast future bills. They never mark a provider invoice as paid."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save}>{edit ? "Save schedule" : "Create schedule"}</Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Schedule name" error={errors.name} className="sm:col-span-2">
          <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        </Field>
        <Field label="Bill category">
          <Select
            value={draft.category}
            onChange={(e) => setDraft({ ...draft, category: e.target.value as BillCategory })}
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c.replace("_", " ")}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Service provider">
          <ProviderSelect value={draft.providerId} onChange={(id) => setDraft({ ...draft, providerId: id })} />
        </Field>
        <Field label="Property">
          <Select
            value={draft.propertyId}
            onChange={(e) =>
              setDraft({ ...draft, propertyId: e.target.value, unitId: "", allocationTenantIds: [] })
            }
          >
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Unit (if applicable)">
          <Select value={draft.unitId} onChange={(e) => setDraft({ ...draft, unitId: e.target.value })}>
            <option value="">Entire property</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Account number">
          <Input
            value={draft.accountNumber}
            onChange={(e) => setDraft({ ...draft, accountNumber: e.target.value })}
          />
        </Field>
        <Field label="Billing frequency">
          <Select
            value={draft.frequency}
            onChange={(e) => setDraft({ ...draft, frequency: e.target.value as Frequency })}
          >
            {freqs.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </Select>
        </Field>
        {draft.frequency === "custom" && (
          <Field label="Custom frequency note" className="sm:col-span-2">
            <Input
              value={draft.customFrequencyNote}
              onChange={(e) => setDraft({ ...draft, customFrequencyNote: e.target.value })}
            />
          </Field>
        )}
        <Field label="Expected amount (optional, CAD)" hint="Forecast only — not an invoice.">
          <Input
            type="number"
            min="0"
            step="0.01"
            value={draft.expectedAmount}
            onChange={(e) => setDraft({ ...draft, expectedAmount: e.target.value })}
          />
        </Field>
        <Field label="Next expected date" error={errors.nextExpectedDate}>
          <Input
            type="date"
            value={draft.nextExpectedDate}
            onChange={(e) => setDraft({ ...draft, nextExpectedDate: e.target.value })}
          />
        </Field>
        <Field label="Typical due date / due-date rule" className="sm:col-span-2">
          <Input
            value={draft.dueDateRule}
            onChange={(e) => setDraft({ ...draft, dueDateRule: e.target.value })}
          />
        </Field>
        <Field label="Responsible party">
          <Select
            value={draft.responsibleParty}
            onChange={(e) => setDraft({ ...draft, responsibleParty: e.target.value as ResponsibleParty })}
          >
            <option value="landlord">Landlord</option>
            <option value="tenant">Tenant</option>
            <option value="shared">Shared</option>
          </Select>
        </Field>
        <Field label="Tenant allocation rule">
          <Select
            value={draft.allocationMethod}
            onChange={(e) => setDraft({ ...draft, allocationMethod: e.target.value as AllocationMethod })}
          >
            {methods.map((m) => (
              <option key={m} value={m}>
                {m.replace("_", " ")}
              </option>
            ))}
          </Select>
        </Field>
        {draft.allocationMethod === "percentage" && (
          <Field label="Percentage">
            <Input
              type="number"
              value={draft.allocationPercentage}
              onChange={(e) => setDraft({ ...draft, allocationPercentage: e.target.value })}
            />
          </Field>
        )}
        {(draft.allocationMethod === "fixed" || draft.allocationMethod === "manual") && (
          <Field label="Amount (CAD)">
            <Input
              type="number"
              value={draft.allocationFixedAmount}
              onChange={(e) => setDraft({ ...draft, allocationFixedAmount: e.target.value })}
            />
          </Field>
        )}
        {draft.allocationMethod !== "none" && (
          <Field label="Tenants in rule" error={errors.tenants} className="sm:col-span-2">
            <div className="grid gap-1.5 rounded-lg border border-u-line2 bg-u-bg p-2 sm:grid-cols-2">
              {propertyTenants.map((t) => (
                <label key={t.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="accent-u-accent"
                    checked={draft.allocationTenantIds.includes(t.id)}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        allocationTenantIds: e.target.checked
                          ? [...draft.allocationTenantIds, t.id]
                          : draft.allocationTenantIds.filter((id) => id !== t.id),
                      })
                    }
                  />
                  {t.name}
                </label>
              ))}
            </div>
          </Field>
        )}
        <Field label="Notes" className="sm:col-span-2">
          <Textarea value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
        </Field>
        <Field label="Schedule status">
          <Select
            value={draft.status}
            onChange={(e) => setDraft({ ...draft, status: e.target.value as ScheduleStatus })}
          >
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="inactive">Inactive</option>
          </Select>
        </Field>
        <div className="space-y-2 rounded-lg border border-u-line2 bg-u-bg p-3">
          <p className="text-xs font-medium text-u-ink2">Reminder indicators (in-app only)</p>
          <Checkbox label="7 days before due date" checked={draft.remind7} onChange={(v) => setDraft({ ...draft, remind7: v })} />
          <Checkbox label="3 days before due date" checked={draft.remind3} onChange={(v) => setDraft({ ...draft, remind3: v })} />
          <Checkbox label="On the due date" checked={draft.remind0} onChange={(v) => setDraft({ ...draft, remind0: v })} />
          <Checkbox
            label="After the due date if unpaid"
            checked={draft.remindAfter}
            onChange={(v) => setDraft({ ...draft, remindAfter: v })}
          />
        </div>
      </div>
    </Modal>
  );
}
