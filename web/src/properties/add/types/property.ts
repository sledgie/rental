export type PropertyType =
  | "detached_house"
  | "semi_detached_house"
  | "townhouse"
  | "condominium"
  | "multi_unit_residential"
  | "apartment_building"
  | "commercial"
  | "mixed_use"
  | "other";

export type PropertyStatus = "active" | "inactive" | "under_renovation" | "sold";

export type OwnershipType = "individual" | "joint" | "corporation" | "other";

export type FurnishingStatus = "furnished" | "unfurnished" | "mixed" | "not_applicable";

export type UtilityResponsibility = "owner" | "tenant" | "shared" | "not_applicable";

export type TaxFrequency = "monthly" | "quarterly" | "annually" | "other";

export type AreaUnit = "sqft" | "sqm";

export type LotSizeUnit = "sqft" | "sqm" | "acres" | "hectares";

export interface Owner {
  id: string;
  name: string;
  type: "individual" | "organization";
  email: string;
  phone?: string;
}

export interface StaffMember {
  id: string;
  name: string;
  role: string;
}

export interface ManagementCompany {
  id: string;
  name: string;
}

export interface Vendor {
  id: string;
  name: string;
  trade: string;
}

export interface PropertyDocument {
  id: string;
  fileName: string;
  fileSize: number;
  category: string;
  uploadDate: string;
  expiryDate?: string;
  notes?: string;
  /** a newly chosen file, uploaded when the property is saved */
  file?: File;
  /** where a stored file lives; opened through a short-lived link */
  bucket?: string;
  path?: string;
}

export interface OwnerShare {
  ownerId: string;
  percentage: string;
}

export interface PropertyFormData {
  // Section 1 — General
  name: string;
  propertyType: PropertyType | "";
  status: PropertyStatus | "";
  description: string;
  coverImage: string | null; // data URL for preview
  coverImageName: string;
  /** a newly chosen cover picture, uploaded when the property is saved */
  coverImageFile?: File | null;
  dateAcquired: string;

  // Section 2 — Address
  country: string;
  streetAddress: string;
  unitSuite: string;
  city: string;
  provinceState: string;
  postalCode: string;
  timeZone: string;

  // Section 3 — Configuration
  buildingType: string;
  numberOfUnits: string;
  yearBuilt: string;
  totalBuildingArea: string;
  areaUnit: AreaUnit;
  lotSize: string;
  lotSizeUnit: LotSizeUnit;
  parkingSpaces: string;
  amenities: string[];
  furnishingStatus: FurnishingStatus | "";
  generalFeatures: string;
  bedrooms: string;
  bathrooms: string;
  parkingDetails: string;

  // Section 4 — Ownership & Management
  ownerId: string;
  ownershipType: OwnershipType | "";
  ownerShares: OwnerShare[];
  propertyManagerId: string;
  managementCompanyId: string;
  managementStartDate: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  managementAgreementFile: string;

  // Section 5 — Financial
  purchasePrice: string;
  purchaseDate: string;
  currentEstimatedValue: string;
  propertyTaxAmount: string;
  propertyTaxFrequency: TaxFrequency | "";
  insuranceProvider: string;
  insurancePolicyExpiry: string;
  mortgageLender: string;
  mortgageReference: string;
  defaultCurrency: string;
  defaultExpenseCategory: string;

  // Section 6 — Utilities
  electricityProvider: string;
  electricityAccountRef: string;
  waterSewerProvider: string;
  gasProvider: string;
  internetProvider: string;
  wasteProvider: string;
  heatingType: string;
  waterHeatingType: string;
  utilityResponsibility: UtilityResponsibility | "";

  // Section 7 — Documents
  documents: PropertyDocument[];

  // Section 8 — Maintenance defaults
  defaultMaintenanceContact: string;
  preferredContractorIds: string[];
  maintenanceInstructions: string;
  lastInspectionDate: string;
  nextInspectionDate: string;
  warrantyExpiryDate: string;
  accessInstructions: string;
}

export interface PropertyRecord extends PropertyFormData {
  id: string;
  createdAt: string;
  isDraft: boolean;
}

export const MULTI_UNIT_TYPES: PropertyType[] = [
  "multi_unit_residential",
  "apartment_building",
  "mixed_use",
  "commercial",
];

export const SINGLE_UNIT_TYPES: PropertyType[] = [
  "detached_house",
  "semi_detached_house",
  "townhouse",
  "condominium",
];

export function isMultiUnitType(t: PropertyType | ""): boolean {
  return t !== "" && MULTI_UNIT_TYPES.includes(t);
}

export function isSingleUnitType(t: PropertyType | ""): boolean {
  return t !== "" && SINGLE_UNIT_TYPES.includes(t);
}
