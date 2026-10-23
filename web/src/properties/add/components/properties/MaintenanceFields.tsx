import { Hammer } from "lucide-react";
import { Field } from "../ui/Field";
import { Input, Textarea } from "../ui/Input";
import { TagSelect } from "../ui/TagSelect";
import { useAppStore } from "../../store/AppStore";
import type { SectionProps } from "./PropertyFormSection";

export function MaintenanceFields({ form, set, errors }: SectionProps) {
  const { vendors: VENDORS } = useAppStore();
  const vendorLabels = VENDORS.map((v) => `${v.name} · ${v.trade}`);
  const selectedLabels = form.preferredContractorIds
    .map((id) => {
      const v = VENDORS.find((x) => x.id === id);
      return v ? `${v.name} · ${v.trade}` : null;
    })
    .filter((x): x is string => x !== null);

  const onVendorsChange = (labels: string[]) => {
    const ids = labels
      .map((l) => VENDORS.find((v) => `${v.name} · ${v.trade}` === l)?.id)
      .filter((x): x is string => !!x);
    set("preferredContractorIds", ids);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-x-5 gap-y-4 md:grid-cols-2">
        <Field label="Default Maintenance Contact" htmlFor="defaultMaintenanceContact">
          <Input
            id="defaultMaintenanceContact"
            value={form.defaultMaintenanceContact}
            onChange={(e) => set("defaultMaintenanceContact", e.target.value)}
            placeholder="e.g. Building superintendent — Marco"
          />
        </Field>

        <Field label="Warranty Expiry Date" htmlFor="warrantyExpiryDate">
          <Input
            id="warrantyExpiryDate"
            type="date"
            value={form.warrantyExpiryDate}
            onChange={(e) => set("warrantyExpiryDate", e.target.value)}
            className="[color-scheme:dark]"
          />
        </Field>

        <Field label="Last Inspection Date" htmlFor="lastInspectionDate">
          <Input
            id="lastInspectionDate"
            type="date"
            value={form.lastInspectionDate}
            onChange={(e) => set("lastInspectionDate", e.target.value)}
            className="[color-scheme:dark]"
          />
        </Field>

        <Field label="Next Inspection Date" htmlFor="nextInspectionDate" error={errors.nextInspectionDate}>
          <Input
            id="nextInspectionDate"
            type="date"
            value={form.nextInspectionDate}
            invalid={!!errors.nextInspectionDate}
            onChange={(e) => set("nextInspectionDate", e.target.value)}
            className="[color-scheme:dark]"
          />
        </Field>
      </div>

      <Field label="Preferred Contractors" hint="Select from your existing vendor list.">
        <TagSelect options={vendorLabels} value={selectedLabels} onChange={onVendorsChange} />
      </Field>

      <Field label="Maintenance Instructions" htmlFor="maintenanceInstructions">
        <Textarea
          id="maintenanceInstructions"
          value={form.maintenanceInstructions}
          onChange={(e) => set("maintenanceInstructions", e.target.value)}
          placeholder="e.g. Always notify tenants 24h before non-emergency work…"
        />
      </Field>

      <Field label="Property Access Instructions" htmlFor="accessInstructions" hint="Lockbox locations, key procedures, alarm notes.">
        <Textarea
          id="accessInstructions"
          value={form.accessInstructions}
          onChange={(e) => set("accessInstructions", e.target.value)}
          placeholder="e.g. Lockbox at side entrance, code shared with assigned vendors only…"
        />
      </Field>

      <div className="flex items-start gap-3 rounded-lg border border-sand-500/25 bg-sand-500/8 p-4">
        <Hammer size={16} className="mt-0.5 shrink-0 text-sand-400" />
        <p className="text-[13px] leading-relaxed text-moss-300">
          Renovation budgets, contractor invoices, materials, and schedules are managed in the{" "}
          <span className="font-medium text-sand-300">Renovation Projects</span> module and will
          reference this property.
        </p>
      </div>
    </div>
  );
}
