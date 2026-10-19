import { Info } from "lucide-react";
import { Field } from "../ui/Field";
import { Input, Select, Textarea } from "../ui/Input";
import { TagSelect } from "../ui/TagSelect";
import { AMENITIES_OPTIONS, BUILDING_TYPES } from "../../data/mockProperties";
import {
  isMultiUnitType,
  isSingleUnitType,
  type AreaUnit,
  type FurnishingStatus,
  type LotSizeUnit,
} from "../../types/property";
import type { SectionProps } from "./PropertyFormSection";

export function ConfigurationFields({ form, set, errors }: SectionProps) {
  const multiUnit = isMultiUnitType(form.propertyType);
  const singleUnit = isSingleUnitType(form.propertyType);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-x-5 gap-y-4 md:grid-cols-2">
        <Field label="Building Type" htmlFor="buildingType">
          <Select
            id="buildingType"
            value={form.buildingType}
            onChange={(e) => set("buildingType", e.target.value)}
          >
            <option value="">Select a building type…</option>
            {BUILDING_TYPES.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </Select>
        </Field>

        <Field label="Number of Units" htmlFor="numberOfUnits" required error={errors.numberOfUnits}
          hint={multiUnit ? "You can create and configure individual units after saving." : undefined}>
          <Input
            id="numberOfUnits"
            type="number"
            min={1}
            step={1}
            value={form.numberOfUnits}
            invalid={!!errors.numberOfUnits}
            onChange={(e) => set("numberOfUnits", e.target.value)}
            placeholder="e.g. 1"
          />
        </Field>

        <Field label="Year Built" htmlFor="yearBuilt" error={errors.yearBuilt}>
          <Input
            id="yearBuilt"
            inputMode="numeric"
            value={form.yearBuilt}
            invalid={!!errors.yearBuilt}
            onChange={(e) => set("yearBuilt", e.target.value)}
            placeholder="e.g. 1998"
          />
        </Field>

        <Field label="Number of Parking Spaces" htmlFor="parkingSpaces" error={errors.parkingSpaces}>
          <Input
            id="parkingSpaces"
            type="number"
            min={0}
            value={form.parkingSpaces}
            invalid={!!errors.parkingSpaces}
            onChange={(e) => set("parkingSpaces", e.target.value)}
            placeholder="e.g. 2"
          />
        </Field>

        <Field label="Total Building Area" htmlFor="totalBuildingArea" error={errors.totalBuildingArea}>
          <div className="flex gap-2">
            <Input
              id="totalBuildingArea"
              type="number"
              min={0}
              value={form.totalBuildingArea}
              invalid={!!errors.totalBuildingArea}
              onChange={(e) => set("totalBuildingArea", e.target.value)}
              placeholder="e.g. 2450"
            />
            <Select
              aria-label="Area unit"
              className="w-28 shrink-0"
              value={form.areaUnit}
              onChange={(e) => set("areaUnit", e.target.value as AreaUnit)}
            >
              <option value="sqft">sq ft</option>
              <option value="sqm">sq m</option>
            </Select>
          </div>
        </Field>

        <Field label="Lot Size" htmlFor="lotSize" error={errors.lotSize}>
          <div className="flex gap-2">
            <Input
              id="lotSize"
              type="number"
              min={0}
              value={form.lotSize}
              invalid={!!errors.lotSize}
              onChange={(e) => set("lotSize", e.target.value)}
              placeholder="e.g. 5800"
            />
            <Select
              aria-label="Lot size unit"
              className="w-28 shrink-0"
              value={form.lotSizeUnit}
              onChange={(e) => set("lotSizeUnit", e.target.value as LotSizeUnit)}
            >
              <option value="sqft">sq ft</option>
              <option value="sqm">sq m</option>
              <option value="acres">acres</option>
              <option value="hectares">ha</option>
            </Select>
          </div>
        </Field>

        <Field label="Furnishing Status" htmlFor="furnishingStatus" className="md:col-span-2">
          <Select
            id="furnishingStatus"
            value={form.furnishingStatus}
            onChange={(e) => set("furnishingStatus", e.target.value as FurnishingStatus)}
            className="md:max-w-xs"
          >
            <option value="">Select…</option>
            <option value="furnished">Furnished</option>
            <option value="unfurnished">Unfurnished</option>
            <option value="mixed">Mixed</option>
            <option value="not_applicable">Not Applicable</option>
          </Select>
        </Field>
      </div>

      <Field label="Amenities" hint="Select everything that applies at the property level.">
        <TagSelect
          options={AMENITIES_OPTIONS}
          value={form.amenities}
          onChange={(v) => set("amenities", v)}
        />
      </Field>

      {singleUnit && (
        <div className="rounded-lg border border-moss-800 bg-moss-900/70 p-4">
          <p className="mb-3 text-[13px] font-medium text-moss-300">Single-Unit Residential Details</p>
          <div className="grid grid-cols-1 gap-x-5 gap-y-4 md:grid-cols-3">
            <Field label="Bedrooms" htmlFor="bedrooms" error={errors.bedrooms}>
              <Input
                id="bedrooms"
                type="number"
                min={0}
                value={form.bedrooms}
                invalid={!!errors.bedrooms}
                onChange={(e) => set("bedrooms", e.target.value)}
                placeholder="e.g. 3"
              />
            </Field>
            <Field label="Bathrooms" htmlFor="bathrooms" error={errors.bathrooms}>
              <Input
                id="bathrooms"
                type="number"
                min={0}
                step={0.5}
                value={form.bathrooms}
                invalid={!!errors.bathrooms}
                onChange={(e) => set("bathrooms", e.target.value)}
                placeholder="e.g. 2.5"
              />
            </Field>
            <Field label="Parking Details" htmlFor="parkingDetails">
              <Input
                id="parkingDetails"
                value={form.parkingDetails}
                onChange={(e) => set("parkingDetails", e.target.value)}
                placeholder="e.g. Double garage + driveway"
              />
            </Field>
          </div>
        </div>
      )}

      {multiUnit && (
        <div className="flex items-start gap-3 rounded-lg border border-mint-500/25 bg-mint-500/8 p-4">
          <Info size={16} className="mt-0.5 shrink-0 text-mint-400" />
          <p className="text-[13px] leading-relaxed text-moss-300">
            Bedrooms, bathrooms, rent amounts, and occupancy are tracked{" "}
            <span className="font-medium text-mint-300">per unit</span> for multi-unit properties.
            After saving, you'll be able to create units from the property page — you don't need to
            enter every unit's details here.
          </p>
        </div>
      )}

      <Field label="General Property Features" htmlFor="generalFeatures" hint="Optional notes about construction, upgrades, or layout.">
        <Textarea
          id="generalFeatures"
          value={form.generalFeatures}
          onChange={(e) => set("generalFeatures", e.target.value)}
          placeholder="e.g. New roof (2022), copper plumbing, upgraded 200A electrical panel…"
        />
      </Field>
    </div>
  );
}
