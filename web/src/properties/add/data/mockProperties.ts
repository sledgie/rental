import type {
  ManagementCompany,
  Owner,
  PropertyFormData,
  PropertyRecord,
  StaffMember,
  Vendor,
} from "../types/property";

export const INITIAL_OWNERS: Owner[] = [
  { id: "own-001", name: "Marcus Delacroix", type: "individual", email: "marcus.d@example.com", phone: "+1 (416) 555-0142" },
  { id: "own-002", name: "Helena Vasquez", type: "individual", email: "helena.v@example.com", phone: "+1 (604) 555-0178" },
  { id: "own-003", name: "Northgate Holdings Inc.", type: "organization", email: "assets@northgate.ca", phone: "+1 (416) 555-0190" },
  { id: "own-004", name: "Cedarline Capital Corp.", type: "organization", email: "portfolio@cedarline.ca" },
];

export const STAFF: StaffMember[] = [
  { id: "stf-001", name: "Aisha Rahman", role: "Senior Property Manager" },
  { id: "stf-002", name: "Daniel Okafor", role: "Property Manager" },
  { id: "stf-003", name: "Sophie Tremblay", role: "Regional Manager" },
  { id: "stf-004", name: "Liam Chen", role: "Assistant Manager" },
];

export const MANAGEMENT_COMPANIES: ManagementCompany[] = [
  { id: "mgc-001", name: "Keystone Property Group" },
  { id: "mgc-002", name: "Maplewood Management Ltd." },
  { id: "mgc-003", name: "UrbanNest Residential Services" },
];

export const VENDORS: Vendor[] = [
  { id: "vnd-001", name: "Apex Plumbing & Heating", trade: "Plumbing" },
  { id: "vnd-002", name: "Brightline Electric", trade: "Electrical" },
  { id: "vnd-003", name: "NorthPeak Roofing", trade: "Roofing" },
  { id: "vnd-004", name: "GreenScape Grounds", trade: "Landscaping" },
  { id: "vnd-005", name: "ClearView HVAC", trade: "HVAC" },
  { id: "vnd-006", name: "Summit Painting Co.", trade: "Painting" },
];

export const AMENITIES_OPTIONS = [
  "In-suite Laundry",
  "Shared Laundry",
  "Elevator",
  "Gym / Fitness Room",
  "Rooftop Terrace",
  "Storage Lockers",
  "Bike Storage",
  "Underground Parking",
  "EV Charging",
  "Security System",
  "Intercom",
  "Air Conditioning",
  "Balconies",
  "Pet Friendly",
  "Backyard",
  "Dishwasher",
];

export const DOCUMENT_CATEGORIES = [
  "Ownership Documents",
  "Purchase Agreement",
  "Insurance Documents",
  "Inspection Reports",
  "Building Permits",
  "Warranties",
  "Floor Plans",
  "Property Tax Statements",
  "Fire Safety Documents",
  "Other",
];

export const EXPENSE_CATEGORIES = [
  "General Maintenance",
  "Repairs",
  "Utilities",
  "Insurance",
  "Property Tax",
  "Landscaping",
  "Capital Improvement",
  "Management Fees",
];

export const HEATING_TYPES = [
  "Forced Air (Gas)",
  "Forced Air (Electric)",
  "Baseboard Electric",
  "Radiant / Hydronic",
  "Heat Pump",
  "Boiler",
  "Geothermal",
  "Other",
];

export const WATER_HEATING_TYPES = [
  "Gas Tank",
  "Electric Tank",
  "Tankless (Gas)",
  "Tankless (Electric)",
  "Heat Pump Water Heater",
  "Solar",
  "Other",
];

export const BUILDING_TYPES = [
  "Low-rise (1–3 storeys)",
  "Mid-rise (4–11 storeys)",
  "High-rise (12+ storeys)",
  "Detached Structure",
  "Row / Attached",
  "Converted Building",
  "Other",
];

export const COUNTRIES = [
  "Canada",
  "United States",
  "United Kingdom",
  "Australia",
  "Germany",
  "France",
  "Other",
];

export const TIME_ZONES = [
  "America/St_Johns (NST)",
  "America/Halifax (AST)",
  "America/Toronto (EST)",
  "America/Winnipeg (CST)",
  "America/Edmonton (MST)",
  "America/Vancouver (PST)",
  "America/New_York (EST)",
  "America/Chicago (CST)",
  "America/Denver (MST)",
  "America/Los_Angeles (PST)",
  "Europe/London (GMT)",
  "Europe/Paris (CET)",
  "Australia/Sydney (AEST)",
];

/** Rough province/state → timezone suggestion (Canada + a few US states). */
export const REGION_TIMEZONE_MAP: Record<string, string> = {
  on: "America/Toronto (EST)",
  ontario: "America/Toronto (EST)",
  qc: "America/Toronto (EST)",
  quebec: "America/Toronto (EST)",
  bc: "America/Vancouver (PST)",
  "british columbia": "America/Vancouver (PST)",
  ab: "America/Edmonton (MST)",
  alberta: "America/Edmonton (MST)",
  mb: "America/Winnipeg (CST)",
  manitoba: "America/Winnipeg (CST)",
  sk: "America/Winnipeg (CST)",
  saskatchewan: "America/Winnipeg (CST)",
  ns: "America/Halifax (AST)",
  "nova scotia": "America/Halifax (AST)",
  nb: "America/Halifax (AST)",
  "new brunswick": "America/Halifax (AST)",
  pe: "America/Halifax (AST)",
  "prince edward island": "America/Halifax (AST)",
  nl: "America/St_Johns (NST)",
  newfoundland: "America/St_Johns (NST)",
  ny: "America/New_York (EST)",
  "new york": "America/New_York (EST)",
  ca: "America/Los_Angeles (PST)",
  california: "America/Los_Angeles (PST)",
  tx: "America/Chicago (CST)",
  texas: "America/Chicago (CST)",
};

export const CURRENCIES = ["CAD", "USD", "GBP", "EUR", "AUD"];

export const PROPERTY_TYPE_LABELS: Record<string, string> = {
  detached_house: "Detached House",
  semi_detached_house: "Semi-Detached House",
  townhouse: "Townhouse",
  condominium: "Condominium",
  multi_unit_residential: "Multi-Unit Residential",
  apartment_building: "Apartment Building",
  commercial: "Commercial",
  mixed_use: "Mixed-Use",
  other: "Other",
};

export const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  inactive: "Inactive",
  under_renovation: "Under Renovation",
  sold: "Sold",
};

export const OWNERSHIP_TYPE_LABELS: Record<string, string> = {
  individual: "Individual",
  joint: "Joint Ownership",
  corporation: "Corporation",
  other: "Other",
};

export function emptyPropertyForm(): PropertyFormData {
  return {
    name: "",
    propertyType: "",
    status: "active",
    description: "",
    coverImage: null,
    coverImageName: "",
    dateAcquired: "",
    country: "Canada",
    streetAddress: "",
    unitSuite: "",
    city: "",
    provinceState: "",
    postalCode: "",
    timeZone: "",
    buildingType: "",
    numberOfUnits: "1",
    yearBuilt: "",
    totalBuildingArea: "",
    areaUnit: "sqft",
    lotSize: "",
    lotSizeUnit: "sqft",
    parkingSpaces: "",
    amenities: [],
    furnishingStatus: "",
    generalFeatures: "",
    bedrooms: "",
    bathrooms: "",
    parkingDetails: "",
    ownerId: "",
    ownershipType: "",
    ownerShares: [],
    propertyManagerId: "",
    managementCompanyId: "",
    managementStartDate: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    managementAgreementFile: "",
    purchasePrice: "",
    purchaseDate: "",
    currentEstimatedValue: "",
    propertyTaxAmount: "",
    propertyTaxFrequency: "",
    insuranceProvider: "",
    insurancePolicyExpiry: "",
    mortgageLender: "",
    mortgageReference: "",
    defaultCurrency: "CAD",
    defaultExpenseCategory: "",
    electricityProvider: "",
    electricityAccountRef: "",
    waterSewerProvider: "",
    gasProvider: "",
    internetProvider: "",
    wasteProvider: "",
    heatingType: "",
    waterHeatingType: "",
    utilityResponsibility: "",
    documents: [],
    defaultMaintenanceContact: "",
    preferredContractorIds: [],
    maintenanceInstructions: "",
    lastInspectionDate: "",
    nextInspectionDate: "",
    warrantyExpiryDate: "",
    accessInstructions: "",
  };
}

