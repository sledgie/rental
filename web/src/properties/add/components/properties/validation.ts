import type { PropertyFormData } from "../../types/property";

export type FormErrors = Partial<Record<string, string>>;

export const SECTIONS = [
  { id: "general", label: "General Information" },
  { id: "address", label: "Property Address" },
  { id: "configuration", label: "Configuration" },
  { id: "ownership", label: "Ownership & Management" },
  { id: "financial", label: "Financial Information" },
  { id: "utilities", label: "Utilities & Services" },
  { id: "documents", label: "Documents & Compliance" },
  { id: "maintenance", label: "Maintenance Defaults" },
] as const;

export type SectionId = (typeof SECTIONS)[number]["id"];

export const FIELD_SECTION: Record<string, SectionId> = {
  name: "general",
  propertyType: "general",
  status: "general",
  dateAcquired: "general",
  country: "address",
  streetAddress: "address",
  city: "address",
  provinceState: "address",
  postalCode: "address",
  numberOfUnits: "configuration",
  yearBuilt: "configuration",
  totalBuildingArea: "configuration",
  lotSize: "configuration",
  parkingSpaces: "configuration",
  bedrooms: "configuration",
  bathrooms: "configuration",
  ownerId: "ownership",
  ownerShares: "ownership",
  emergencyContactPhone: "ownership",
  purchasePrice: "financial",
  currentEstimatedValue: "financial",
  propertyTaxAmount: "financial",
  purchaseDate: "financial",
  insurancePolicyExpiry: "financial",
  nextInspectionDate: "maintenance",
};

const isBlank = (v: string) => v.trim() === "";

function positiveNumber(v: string): boolean {
  const n = Number(v);
  return !Number.isNaN(n) && n > 0;
}

function nonNegativeNumber(v: string): boolean {
  const n = Number(v);
  return !Number.isNaN(n) && n >= 0;
}

function positiveInteger(v: string): boolean {
  return /^\d+$/.test(v.trim()) && Number(v) > 0;
}

export function validateProperty(form: PropertyFormData, draft = false): FormErrors {
  const e: FormErrors = {};

  // --- General ---
  if (isBlank(form.name)) e.name = "Property name is required.";

  if (draft) return e; // drafts only need a name

  if (!form.propertyType) e.propertyType = "Select a property type.";
  if (!form.status) e.status = "Select a property status.";
  if (form.dateAcquired && new Date(form.dateAcquired) > new Date()) {
    e.dateAcquired = "Date acquired cannot be in the future.";
  }

  // --- Address ---
  if (isBlank(form.country)) e.country = "Country is required.";
  if (isBlank(form.streetAddress)) e.streetAddress = "Street address is required.";
  if (isBlank(form.city)) e.city = "City is required.";
  if (isBlank(form.provinceState)) e.provinceState = "Province or state is required.";
  if (isBlank(form.postalCode)) e.postalCode = "Postal / ZIP code is required.";

  // --- Configuration ---
  if (isBlank(form.numberOfUnits)) {
    e.numberOfUnits = "Number of units is required.";
  } else if (!positiveInteger(form.numberOfUnits)) {
    e.numberOfUnits = "Enter a whole number greater than zero.";
  }
  if (form.yearBuilt) {
    const y = Number(form.yearBuilt);
    const max = new Date().getFullYear() + 1;
    if (!/^\d{4}$/.test(form.yearBuilt) || y < 1800 || y > max) {
      e.yearBuilt = `Enter a 4-digit year between 1800 and ${max}.`;
    }
  }
  if (form.totalBuildingArea && !positiveNumber(form.totalBuildingArea))
    e.totalBuildingArea = "Enter a positive number.";
  if (form.lotSize && !positiveNumber(form.lotSize)) e.lotSize = "Enter a positive number.";
  if (form.parkingSpaces && !nonNegativeNumber(form.parkingSpaces))
    e.parkingSpaces = "Enter zero or a positive number.";
  if (form.bedrooms && !nonNegativeNumber(form.bedrooms)) e.bedrooms = "Enter zero or a positive number.";
  if (form.bathrooms && !nonNegativeNumber(form.bathrooms)) e.bathrooms = "Enter zero or a positive number.";

  // --- Ownership ---
  if (!form.ownerId) e.ownerId = "Select or create a property owner.";
  if (form.ownershipType === "joint" && form.ownerShares.length > 0) {
    const sum = form.ownerShares.reduce((acc, s) => acc + (Number(s.percentage) || 0), 0);
    if (Math.abs(sum - 100) > 0.01) {
      e.ownerShares = `Ownership percentages must total 100% (currently ${sum}%).`;
    }
  }
  if (form.emergencyContactPhone && !/^[\d\s()+.-]{7,}$/.test(form.emergencyContactPhone)) {
    e.emergencyContactPhone = "Enter a valid phone number.";
  }

  // --- Financial ---
  if (form.purchasePrice && !positiveNumber(form.purchasePrice))
    e.purchasePrice = "Enter a positive amount.";
  if (form.currentEstimatedValue && !positiveNumber(form.currentEstimatedValue))
    e.currentEstimatedValue = "Enter a positive amount.";
  if (form.propertyTaxAmount && !positiveNumber(form.propertyTaxAmount))
    e.propertyTaxAmount = "Enter a positive amount.";
  if (form.purchaseDate && new Date(form.purchaseDate) > new Date())
    e.purchaseDate = "Purchase date cannot be in the future.";

  // --- Maintenance ---
  if (
    form.lastInspectionDate &&
    form.nextInspectionDate &&
    new Date(form.nextInspectionDate) <= new Date(form.lastInspectionDate)
  ) {
    e.nextInspectionDate = "Next inspection must be after the last inspection.";
  }

  return e;
}

export function errorCountBySection(errors: FormErrors): Record<SectionId, number> {
  const counts = Object.fromEntries(SECTIONS.map((s) => [s.id, 0])) as Record<SectionId, number>;
  for (const [key, value] of Object.entries(errors)) {
    if (!value) continue;
    const sec = FIELD_SECTION[key];
    if (sec) counts[sec] += 1;
  }
  return counts;
}

export function formatCurrency(value: string | number, currency = "CAD"): string {
  const n = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(n);
}
