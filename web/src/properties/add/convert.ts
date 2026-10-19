// Maps between the add/edit form's record and the table's Property model.
import type { Property, Unit } from "../data/properties";
import type { PropertyRecord, PropertyType } from "./types/property";
import { isMultiUnitType } from "./types/property";
import { COUNTRIES, STAFF, emptyPropertyForm } from "./data/mockProperties";

const TO_TABLE: Record<string, Property["type"]> = {
  multi_unit_residential: "Multifamily", apartment_building: "Multifamily", condominium: "Multifamily", other: "Multifamily",
  mixed_use: "Mixed-Use", commercial: "Mixed-Use",
  townhouse: "Townhomes", semi_detached_house: "Townhomes", detached_house: "Townhomes",
};
const FROM_TABLE: Record<Property["type"], PropertyType> = {
  Multifamily: "multi_unit_residential", "Mixed-Use": "mixed_use", Townhomes: "townhouse",
  Student: "multi_unit_residential", "Senior Living": "multi_unit_residential",
};

const monthYear = (iso: string) => {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("en-US", { month: "short", year: "numeric" });
};

const vacantUnit = (name: string): Unit => ({
  unit: name, beds: 0, baths: 0, sqft: 0, rent: 0, balance: 0, dueInDays: 0,
  status: "vacant", leaseEnd: "—", tenants: [], history: [],
});

/** Form record -> table row. Existing units (and their residents/balances) are kept; the unit count follows the form. */
export function toProperty(r: PropertyRecord, prev?: Property): Property {
  const count = Math.min(500, isMultiUnitType(r.propertyType) ? Math.max(1, Number(r.numberOfUnits) || 1) : 1);
  const units = (prev?.units ?? []).slice(0, count);
  const taken = new Set(units.map((u) => u.unit));
  for (let i = units.length + 1; units.length < count; i++) {
    const name = count === 1 ? "Main" : String(i);
    if (!taken.has(name)) { units.push(vacantUnit(name)); taken.add(name); }
  }
  // shrinking below the number of occupied units would hide residents, so keep those
  (prev?.units ?? []).slice(count).filter((u) => u.tenants.length).forEach((u) => units.push(u));
  return {
    code: r.id,
    name: r.name.trim(),
    type: TO_TABLE[r.propertyType] ?? "Multifamily",
    address1: [r.streetAddress, r.unitSuite].filter(Boolean).join(", "),
    city: r.city,
    state: r.provinceState,
    zip: r.postalCode,
    manager: STAFF.find((s) => s.id === r.propertyManagerId)?.name ?? prev?.manager ?? "Unassigned",
    managerPhone: r.emergencyContactPhone || prev?.managerPhone || "—",
    managerEmail: prev?.managerEmail ?? "—",
    acquired: r.dateAcquired ? monthYear(r.dateAcquired) : prev?.acquired ?? "—",
    yearBuilt: Number(r.yearBuilt) || prev?.yearBuilt || new Date().getFullYear(),
    trend: prev?.trend ?? Array(12).fill(0),
    units,
  };
}

/** Table row -> form record, for editing the sample properties that were never entered through the form. */
export function toRecord(p: Property): PropertyRecord {
  return {
    ...emptyPropertyForm(),
    id: p.code,
    createdAt: new Date().toISOString(),
    isDraft: false,
    name: p.name,
    propertyType: FROM_TABLE[p.type],
    status: "active",
    streetAddress: p.address1,
    city: p.city,
    provinceState: p.state,
    postalCode: p.zip,
    country: COUNTRIES.includes("United States") ? "United States" : COUNTRIES[0],
    numberOfUnits: String(p.units.length),
    yearBuilt: String(p.yearBuilt),
    propertyManagerId: STAFF.find((s) => s.name === p.manager)?.id ?? "",
  };
}
