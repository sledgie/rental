import { Info } from "lucide-react";
import { Field } from "../ui/Field";
import { Input, Select } from "../ui/Input";
import { HEATING_TYPES, WATER_HEATING_TYPES } from "../../data/mockProperties";
import type { UtilityResponsibility } from "../../types/property";
import type { SectionProps } from "./PropertyFormSection";

export function UtilitiesFields({ form, set }: SectionProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-x-5 gap-y-4 md:grid-cols-2">
        <Field label="Electricity Provider" htmlFor="electricityProvider">
          <Input
            id="electricityProvider"
            value={form.electricityProvider}
            onChange={(e) => set("electricityProvider", e.target.value)}
            placeholder="e.g. Toronto Hydro"
          />
        </Field>

        <Field label="Electricity Account Reference" htmlFor="electricityAccountRef" hint="Internal reference only — do not store login credentials.">
          <Input
            id="electricityAccountRef"
            value={form.electricityAccountRef}
            onChange={(e) => set("electricityAccountRef", e.target.value)}
            placeholder="e.g. ACCT-889023"
          />
        </Field>

        <Field label="Water & Sewer Provider" htmlFor="waterSewerProvider">
          <Input
            id="waterSewerProvider"
            value={form.waterSewerProvider}
            onChange={(e) => set("waterSewerProvider", e.target.value)}
            placeholder="e.g. City of Toronto"
          />
        </Field>

        <Field label="Gas Provider" htmlFor="gasProvider">
          <Input
            id="gasProvider"
            value={form.gasProvider}
            onChange={(e) => set("gasProvider", e.target.value)}
            placeholder="e.g. Enbridge Gas"
          />
        </Field>

        <Field label="Internet Provider" htmlFor="internetProvider">
          <Input
            id="internetProvider"
            value={form.internetProvider}
            onChange={(e) => set("internetProvider", e.target.value)}
            placeholder="e.g. Bell / Rogers"
          />
        </Field>

        <Field label="Waste Collection Provider" htmlFor="wasteProvider">
          <Input
            id="wasteProvider"
            value={form.wasteProvider}
            onChange={(e) => set("wasteProvider", e.target.value)}
            placeholder="e.g. Municipal collection"
          />
        </Field>

        <Field label="Heating Type" htmlFor="heatingType">
          <Select
            id="heatingType"
            value={form.heatingType}
            onChange={(e) => set("heatingType", e.target.value)}
          >
            <option value="">Select…</option>
            {HEATING_TYPES.map((h) => (
              <option key={h} value={h}>{h}</option>
            ))}
          </Select>
        </Field>

        <Field label="Water Heating Type" htmlFor="waterHeatingType">
          <Select
            id="waterHeatingType"
            value={form.waterHeatingType}
            onChange={(e) => set("waterHeatingType", e.target.value)}
          >
            <option value="">Select…</option>
            {WATER_HEATING_TYPES.map((h) => (
              <option key={h} value={h}>{h}</option>
            ))}
          </Select>
        </Field>

        <Field label="Utility Responsibility" htmlFor="utilityResponsibility" hint="Default responsibility for utility costs at this property.">
          <Select
            id="utilityResponsibility"
            value={form.utilityResponsibility}
            onChange={(e) => set("utilityResponsibility", e.target.value as UtilityResponsibility)}
          >
            <option value="">Select…</option>
            <option value="owner">Owner</option>
            <option value="tenant">Tenant</option>
            <option value="shared">Shared</option>
            <option value="not_applicable">Not Applicable</option>
          </Select>
        </Field>
      </div>

      <div className="flex items-start gap-3 rounded-lg border border-moss-800 bg-moss-900/70 p-3.5">
        <Info size={15} className="mt-0.5 shrink-0 text-moss-500" />
        <p className="text-xs leading-relaxed text-moss-500">
          These values act as property-level defaults. Individual units can override any of them
          later from the Units module.
        </p>
      </div>
    </div>
  );
}
