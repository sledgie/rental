import { useRef } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { Field } from "../ui/Field";
import { Input, Select, Textarea } from "../ui/Input";
import { Button } from "../ui/Button";
import { PROPERTY_TYPE_LABELS, STATUS_LABELS } from "../../data/mockProperties";
import { isMultiUnitType, type PropertyStatus, type PropertyType } from "../../types/property";
import type { SectionProps } from "./PropertyFormSection";

export function GeneralFields({ form, set, errors }: SectionProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  const onImageSelect = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      set("coverImage", reader.result as string);
      set("coverImageName", file.name);
      set("coverImageFile", file);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-x-5 gap-y-4 md:grid-cols-2">
        <Field label="Property Name" htmlFor="name" required error={errors.name} className="md:col-span-2">
          <Input
            id="name"
            value={form.name}
            invalid={!!errors.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="e.g. Lakeshore Terrace Apartments"
          />
        </Field>

        <Field label="Property Type" htmlFor="propertyType" required error={errors.propertyType}
          hint={isMultiUnitType(form.propertyType) ? "Multi-unit property — unit details are managed per unit after saving." : undefined}>
          <Select
            id="propertyType"
            value={form.propertyType}
            invalid={!!errors.propertyType}
            onChange={(e) => set("propertyType", e.target.value as PropertyType)}
          >
            <option value="">Select a type…</option>
            {Object.entries(PROPERTY_TYPE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </Select>
        </Field>

        <Field label="Property Status" htmlFor="status" required error={errors.status}>
          <Select
            id="status"
            value={form.status}
            invalid={!!errors.status}
            onChange={(e) => set("status", e.target.value as PropertyStatus)}
          >
            <option value="">Select a status…</option>
            {Object.entries(STATUS_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </Select>
        </Field>

        <Field label="Date Acquired" htmlFor="dateAcquired" error={errors.dateAcquired}
          hint="When this property joined your portfolio.">
          <Input
            id="dateAcquired"
            type="date"
            value={form.dateAcquired}
            invalid={!!errors.dateAcquired}
            onChange={(e) => set("dateAcquired", e.target.value)}
            className="[color-scheme:dark]"
          />
        </Field>
      </div>

      <Field label="Description" htmlFor="description" hint="A short internal summary of the property.">
        <Textarea
          id="description"
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder="Describe the property, its condition, and anything notable…"
        />
      </Field>

      <Field label="Property Cover Image" hint="PNG or JPG. Used across listings and reports.">
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => onImageSelect(e.target.files?.[0])}
        />
        {form.coverImage ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <img
              src={form.coverImage}
              alt="Property cover preview"
              className="h-36 w-full max-w-xs rounded-lg border border-moss-700 object-cover"
            />
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                <ImagePlus size={14} /> Replace
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-brick-400 hover:text-brick-300"
                onClick={() => {
                  set("coverImage", null);
                  set("coverImageName", "");
                  set("coverImageFile", null);
                }}
              >
                <Trash2 size={14} /> Remove
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex h-32 w-full max-w-md flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-moss-700 bg-moss-900/60 text-moss-500 transition-colors hover:border-mint-500/50 hover:text-moss-300"
          >
            <ImagePlus size={22} />
            <span className="text-xs font-medium">Click to upload a cover image</span>
          </button>
        )}
      </Field>
    </div>
  );
}
