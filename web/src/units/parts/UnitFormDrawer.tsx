import { useMemo, useState } from "react";
import { cn } from "../utils/cn";
import type { Database, Unit, UnitCondition, UnitStatus } from "../data/types";
import { isUnitNumberTaken, nextUnitId } from "../data/selectors";
import { isoDate, money } from "../lib/format";
import { TODAY } from "../data/mockData";
import { isSupabaseConfigured } from "../../lib/supabase";
import { useStore } from "../store/appStore";
import { Icon } from "../components/ui/Icon";
import { Button, Field, Pill, Select, TextArea, TextInput } from "../components/ui/primitives";
import { Callout, Drawer } from "../components/ui/Modal";

type Draft = {
  propertyId: string;
  unitNumber: string;
  unitId: string;
  unitType: Unit["unitType"];
  floor: string;
  bedrooms: string;
  bathrooms: string;
  squareFootage: string;
  furnished: Unit["furnished"];
  parkingDetails: string;
  storageDetails: string;
  appliances: string;
  utilitiesIncluded: string;
  accessibilityFeatures: string;
  yearRenovated: string;
  unitCondition: UnitCondition;
  unitStatus: UnitStatus;
  advertisedRent: string;
  availabilityDate: string;
  notes: string;
};

const UNIT_TYPES: Unit["unitType"][] = [
  "Apartment",
  "Studio",
  "Loft",
  "Townhouse",
  "Duplex Unit",
  "Commercial",
];

function toDraft(unit: Unit | null, db: Database, propertyId: string): Draft {
  if (unit) {
    return {
      propertyId: unit.propertyId,
      unitNumber: unit.unitNumber,
      unitId: unit.id,
      unitType: unit.unitType,
      floor: unit.floor ?? "",
      bedrooms: unit.bedrooms === null ? "" : String(unit.bedrooms),
      bathrooms: unit.bathrooms === null ? "" : String(unit.bathrooms),
      squareFootage: unit.squareFootage === null ? "" : String(unit.squareFootage),
      furnished: unit.furnished,
      parkingDetails: unit.parkingDetails ?? "",
      storageDetails: unit.storageDetails ?? "",
      appliances: (unit.appliances ?? []).join(", "),
      utilitiesIncluded: (unit.utilitiesIncluded ?? []).join(", "),
      accessibilityFeatures: (unit.accessibilityFeatures ?? []).join(", "),
      yearRenovated: unit.yearRenovated === undefined ? "" : String(unit.yearRenovated),
      unitCondition: unit.unitCondition,
      unitStatus: unit.unitStatus,
      advertisedRent: unit.advertisedRent === null || unit.advertisedRent === undefined ? "" : String(unit.advertisedRent),
      availabilityDate: unit.availabilityDate ?? "",
      notes: unit.notes ?? "",
    };
  }
  return {
    propertyId,
    unitNumber: "",
    unitId: nextUnitId(db, propertyId),
    unitType: "Apartment",
    floor: "",
    bedrooms: "1",
    bathrooms: "1",
    squareFootage: "",
    furnished: "Unfurnished",
    parkingDetails: "",
    storageDetails: "",
    appliances: "",
    utilitiesIncluded: "",
    accessibilityFeatures: "",
    yearRenovated: "",
    unitCondition: "Good",
    unitStatus: "Vacant",
    advertisedRent: "",
    availabilityDate: "",
    notes: "",
  };
}

const splitList = (v: string) =>
  v
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

function SectionLabel({ step, title, note }: { step: string; title: string; note?: string }) {
  return (
    <div className="mb-2.5 flex items-center gap-2 border-b border-u-line2 pb-1.5">
      <span className="u-num flex h-5 w-5 items-center justify-center rounded border border-u-accent/35 bg-u-accent/12 text-[10.5px] font-600 text-u-accent">
        {step}
      </span>
      <h3 className="font-display text-[12px] font-600 uppercase tracking-[0.11em] text-u-ink2">{title}</h3>
      {note && <span className="ml-auto text-[10.5px] text-u-muted">{note}</span>}
    </div>
  );
}

export function UnitFormDrawer({
  open,
  mode,
  unit,
  db,
  defaultPropertyId,
  onClose,
}: {
  open: boolean;
  mode: "create" | "edit";
  unit: Unit | null;
  db: Database;
  defaultPropertyId?: string;
  onClose: () => void;
}) {
  const { addUnit, updateUnit, pushToast, log } = useStore();
  const [draft, setDraft] = useState<Draft>(() =>
    toDraft(unit, db, defaultPropertyId ?? db.properties[0]?.id ?? ""),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [ackConflict, setAckConflict] = useState(false);
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setErrors((e) => (e[key as string] ? { ...e, [key as string]: "" } : e));
  };

  const generatedId = useMemo(
    () => (isSupabaseConfigured && mode === "create" ? "Assigned on save" : mode === "create" ? nextUnitId(db, draft.propertyId) : draft.unitId),
    [mode, db, draft.propertyId, draft.unitId],
  );

  const propertyChanging = mode === "edit" && unit !== null && draft.propertyId !== unit.propertyId;

  /** Does this unit have an applicable in-term lease right now? */
  const hasCurrentLease = useMemo(() => {
    if (mode === "create") return false;
    const target = unit?.id;
    if (!target) return false;
    const today = isoDate(TODAY);
    return db.leaseUnits.some((lu) => {
      if (lu.unitId !== target) return false;
      const lease = db.leases.find((l) => l.id === lu.leaseId);
      if (!lease) return false;
      return lease.leaseStatus === "Active" && lease.startDate <= today && lease.endDate >= today;
    });
  }, [mode, unit, db.leaseUnits, db.leases]);

  const conflict =
    (draft.unitStatus === "Occupied" && !hasCurrentLease) ||
    ((draft.unitStatus === "Vacant" || draft.unitStatus === "Reserved") && hasCurrentLease);

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!draft.propertyId) e.propertyId = "A unit must belong to an existing property.";
    if (!draft.unitNumber.trim()) e.unitNumber = "Unit number is required.";
    else if (isUnitNumberTaken(db, draft.propertyId, draft.unitNumber, unit?.id))
      e.unitNumber = `Unit ${draft.unitNumber.trim()} already exists on this property. Unit numbers must be unique within a property.`;
    if (draft.bedrooms !== "" && (Number.isNaN(Number(draft.bedrooms)) || Number(draft.bedrooms) < 0))
      e.bedrooms = "Enter 0 for a studio or leave blank if unknown.";
    if (draft.bathrooms !== "" && (Number.isNaN(Number(draft.bathrooms)) || Number(draft.bathrooms) < 0))
      e.bathrooms = "Enter a number, e.g. 1 or 1.5.";
    if (draft.squareFootage !== "" && (Number.isNaN(Number(draft.squareFootage)) || Number(draft.squareFootage) <= 0))
      e.squareFootage = "Enter a positive area or leave blank.";
    if (draft.advertisedRent !== "" && (Number.isNaN(Number(draft.advertisedRent)) || Number(draft.advertisedRent) < 0))
      e.advertisedRent = "Enter a positive amount or leave blank.";
    if (draft.yearRenovated !== "") {
      const y = Number(draft.yearRenovated);
      if (Number.isNaN(y) || y < 1900 || y > new Date().getFullYear() + 1) e.yearRenovated = "Enter a plausible year.";
    }
    if (draft.unitStatus === "Vacant" && !draft.availabilityDate && mode === "create")
      e.availabilityDate = "Add an availability date so the unit can be marketed.";
    if (conflict && !ackConflict)
      e.conflict = "Acknowledge the status conflict, or choose a status that matches the lease data.";
    setErrors(e);
    return Object.keys(e).filter((k) => e[k]).length === 0;
  }

  async function save() {
    if (!validate()) {
      pushToast({
        tone: "rose",
        title: "Check the highlighted fields",
        message: "The unit was not saved — fix the validation errors and try again.",
      });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        propertyId: draft.propertyId,
        unitNumber: draft.unitNumber.trim(),
        unitType: draft.unitType,
        bedrooms: draft.bedrooms === "" ? null : Number(draft.bedrooms),
        bathrooms: draft.bathrooms === "" ? null : Number(draft.bathrooms),
        squareFootage: draft.squareFootage === "" ? null : Number(draft.squareFootage),
        floor: draft.floor.trim() || null,
        furnished: draft.furnished,
        parkingDetails: draft.parkingDetails.trim() || null,
        storageDetails: draft.storageDetails.trim() || null,
        appliances: splitList(draft.appliances),
        utilitiesIncluded: splitList(draft.utilitiesIncluded),
        accessibilityFeatures: splitList(draft.accessibilityFeatures),
        yearRenovated: draft.yearRenovated === "" ? undefined : Number(draft.yearRenovated),
        unitCondition: draft.unitCondition,
        unitStatus: draft.unitStatus,
        advertisedRent: draft.advertisedRent === "" ? null : Number(draft.advertisedRent),
        availabilityDate: draft.availabilityDate || null,
        notes: draft.notes.trim() || undefined,
        imageUrl: unit?.imageUrl,
        inspection: unit?.inspection,
      };

      if (mode === "create") {
        const created = await addUnit({ ...payload, archived: false } as Omit<Unit, "id" | "createdAt" | "updatedAt" | "archived">);
        pushToast({
          tone: "jade",
          title: `Unit ${created.unitNumber} created`,
          message: `${created.code ?? created.id} added to ${db.properties.find((p) => p.id === created.propertyId)?.propertyName}. No lease or tenant was created — contractual rent stays at “—” until a lease is issued.`,
        });
      } else if (unit) {
        await updateUnit(unit.id, payload);
        if (propertyChanging) {
          log(unit.id, "record", `Unit reassigned from ${unit.propertyId} to ${draft.propertyId}`);
        }
        pushToast({
          tone: "jade",
          title: `Unit ${draft.unitNumber} updated`,
          message: propertyChanging
            ? "Saved, including the property reassignment. Lease and tenant records were left untouched."
            : "Unit attributes saved. Lease contractual rent and tenant associations were not modified.",
        });
      }
      setSaving(false);
      onClose();
    } catch (error) {
      setSaving(false);
      pushToast({ tone: "rose", title: "The unit was not saved", message: error instanceof Error ? error.message : "Something went wrong. Please try again." });
    }
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      labelledBy="unit-form-title"
      title={mode === "create" ? "Add unit" : `Edit unit ${unit?.unitNumber ?? ""}`}
      subtitle={
        mode === "create"
          ? "Creates the unit record only — no lease, tenant or rent is generated automatically."
          : "Unit attributes only. Contractual rent lives on the lease and is never edited from here."
      }
      footer={
        <div className="flex flex-wrap items-center gap-2 px-4 py-3">
          <span className="text-[11px] text-u-muted">
            {mode === "create" ? (
              <>
                Will be created as <span className="u-num text-u-muted">{generatedId}</span>
              </>
            ) : (
              <>
                Last updated <span className="u-num text-u-muted">{unit ? isoDate(new Date(unit.updatedAt)) : "—"}</span>
              </>
            )}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="md" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" size="md" icon="check" loading={saving} onClick={save}>
              {mode === "create" ? "Create unit" : "Save changes"}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-5 p-4">
        {/* A — property association */}
        <section>
          <SectionLabel step="A" title="Property association" note="Required — units always belong to a property" />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Property"
              required
              error={errors.propertyId}
              hint="Existing property records only"
              className="sm:col-span-2"
            >
              <Select
                value={draft.propertyId}
                invalid={!!errors.propertyId}
                onChange={(e) => {
                  set("propertyId", e.target.value);
                  if (mode === "create") set("unitId", nextUnitId(db, e.target.value));
                }}
              >
                <option value="">Select a property…</option>
                {db.properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.propertyName} — {p.address}, {p.city} ({p.id})
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          {propertyChanging && (
            <Callout className="mt-2" tone="amber" icon="alert" title="Reassigning this unit to another property">
              Ownership relationships, reporting and the generated unit ID convention all follow the property. Existing
              leases and transactions stay attached to the unit and remain in its history.
            </Callout>
          )}
          <p className="mt-2 text-[11px] text-u-muted">
            New properties are created in the Properties module — this form never creates or duplicates a property
            record.
          </p>
        </section>

        {/* B — identification */}
        <section>
          <SectionLabel step="B" title="Unit identification" note="Unit numbers are unique within a property" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Unit number" required error={errors.unitNumber}>
              <TextInput
                value={draft.unitNumber}
                invalid={!!errors.unitNumber}
                placeholder="e.g. 402"
                onChange={(e) => set("unitNumber", e.target.value)}
              />
            </Field>
            <Field label="Unit ID" hint="Auto-generated">
              <div className="flex h-9 items-center gap-1.5 rounded-md border border-u-line2 bg-u-bg/50 px-2.5">
                <Icon name="spark" size={12} className="text-u-accent" />
                <span className="u-num text-[13px] text-u-ink2">{generatedId}</span>
              </div>
            </Field>
            <Field label="Unit type" required>
              <Select value={draft.unitType} onChange={(e) => set("unitType", e.target.value as Unit["unitType"])}>
                {UNIT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Floor / level" hint="Optional">
              <TextInput value={draft.floor} placeholder="e.g. 4 or 1–2" onChange={(e) => set("floor", e.target.value)} />
            </Field>
          </div>
        </section>

        {/* C — specifications */}
        <section>
          <SectionLabel step="C" title="Unit specifications" note="Leave blank when a measurement is unknown" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Bedrooms" error={errors.bedrooms} hint="0 = studio">
              <Select value={draft.bedrooms} invalid={!!errors.bedrooms} onChange={(e) => set("bedrooms", e.target.value)}>
                <option value="">Not recorded</option>
                {["0", "1", "2", "3", "4", "5", "6"].map((n) => (
                  <option key={n} value={n}>
                    {n === "0" ? "Studio (0)" : n}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Bathrooms" error={errors.bathrooms}>
              <TextInput
                type="number"
                step="0.5"
                min="0"
                value={draft.bathrooms}
                invalid={!!errors.bathrooms}
                placeholder="e.g. 1.5"
                onChange={(e) => set("bathrooms", e.target.value)}
              />
            </Field>
            <Field label="Square footage" error={errors.squareFootage}>
              <TextInput
                type="number"
                min="0"
                value={draft.squareFootage}
                invalid={!!errors.squareFootage}
                placeholder="e.g. 950"
                onChange={(e) => set("squareFootage", e.target.value)}
              />
            </Field>
            <Field label="Furnished">
              <Select value={draft.furnished} onChange={(e) => set("furnished", e.target.value as Unit["furnished"])}>
                {["Unfurnished", "Partially Furnished", "Furnished"].map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Parking allocation">
              <TextInput value={draft.parkingDetails} placeholder="e.g. 1 underground space (P2-31)" onChange={(e) => set("parkingDetails", e.target.value)} />
            </Field>
            <Field label="Storage">
              <TextInput value={draft.storageDetails} placeholder="e.g. Locker B-04" onChange={(e) => set("storageDetails", e.target.value)} />
            </Field>
            <Field label="Year renovated" error={errors.yearRenovated}>
              <TextInput
                type="number"
                value={draft.yearRenovated}
                invalid={!!errors.yearRenovated}
                placeholder="e.g. 2023"
                onChange={(e) => set("yearRenovated", e.target.value)}
              />
            </Field>
            <Field label="Unit condition">
              <Select value={draft.unitCondition} onChange={(e) => set("unitCondition", e.target.value as UnitCondition)}>
                {["Excellent", "Good", "Fair", "Needs Work"].map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Appliances" hint="comma separated" className="sm:col-span-2">
              <TextInput value={draft.appliances} placeholder="Fridge, Stove, Dishwasher" onChange={(e) => set("appliances", e.target.value)} />
            </Field>
            <Field label="Utilities included" hint="comma separated">
              <TextInput value={draft.utilitiesIncluded} placeholder="Heat, Water" onChange={(e) => set("utilitiesIncluded", e.target.value)} />
            </Field>
            <Field label="Accessibility features" hint="comma separated">
              <TextInput
                value={draft.accessibilityFeatures}
                placeholder="Step-free entrance"
                onChange={(e) => set("accessibilityFeatures", e.target.value)}
              />
            </Field>
            <Field label="Internal notes" className="sm:col-span-2 lg:col-span-4">
              <TextArea
                rows={3}
                value={draft.notes}
                placeholder="Anything the team should know about this unit — not shown to tenants."
                onChange={(e) => set("notes", e.target.value)}
              />
            </Field>
          </div>
        </section>

        {/* D — status & rental */}
        <section>
          <SectionLabel step="D" title="Status & rental information" note="Occupancy status is separate from lease status" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Occupancy status" required>
              <Select value={draft.unitStatus} onChange={(e) => set("unitStatus", e.target.value as UnitStatus)}>
                {(["Occupied", "Vacant", "Reserved", "Under Maintenance", "Inactive"] as UnitStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Advertised rent" error={errors.advertisedRent} hint="Marketing only">
              <TextInput
                type="number"
                min="0"
                step="0.01"
                value={draft.advertisedRent}
                invalid={!!errors.advertisedRent}
                placeholder="e.g. 2450"
                onChange={(e) => set("advertisedRent", e.target.value)}
              />
            </Field>
            <Field label="Available from" error={errors.availabilityDate}>
              <TextInput
                type="date"
                value={draft.availabilityDate}
                invalid={!!errors.availabilityDate}
                onChange={(e) => set("availabilityDate", e.target.value)}
              />
            </Field>
            <div className="flex items-end">
              <div className="flex flex-wrap gap-1.5 pb-1">
                <Pill tone="muted">Contractual rent: derived from lease</Pill>
              </div>
            </div>
          </div>

          {conflict && (
            <Callout className="mt-2" tone="amber" icon="alert" title="This status contradicts the lease data">
              <p>
                {draft.unitStatus === "Occupied"
                  ? "No lease is in term for this unit, so marking it Occupied creates a holdover-style exception."
                  : "A lease is currently in term for this unit, so it cannot be reported as available."}
              </p>
              <label className="mt-2 flex cursor-pointer items-start gap-2 text-[12px] text-u-ink2">
                <input
                  type="checkbox"
                  checked={ackConflict}
                  onChange={(e) => {
                    setAckConflict(e.target.checked);
                    setErrors((x) => ({ ...x, conflict: "" }));
                  }}
                  className={cn(
                    "mt-0.5 h-3.5 w-3.5 shrink-0 accent-[var(--accent)]",
                    errors.conflict && "outline outline-1 outline-u-danger",
                  )}
                />
                I understand — save anyway and flag the unit for review.
              </label>
              {errors.conflict && (
                <p className="mt-1 flex items-center gap-1 text-[11px] text-u-danger">
                  <Icon name="alert" size={11} />
                  {errors.conflict}
                </p>
              )}
            </Callout>
          )}

          <Callout className="mt-2" tone="azure" icon="info">
            Advertised rent is what the unit is marketed at. Contractual rent is always derived from the applicable lease
            and its allocation —{draft.advertisedRent ? ` advertising at ${money(Number(draft.advertisedRent))}` : " no rate is set"} does not
            change the rent roll.
          </Callout>
        </section>
      </div>
    </Drawer>
  );
}
