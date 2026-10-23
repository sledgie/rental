// Supabase access for properties (tables `properties` and `units`). The UI keeps working with its own Property / PropertyRecord
// shapes; this file translates between them and the database rows. Row-Level Security decides who may read or write.
import { supabase, toError } from "../lib/supabase";
import { getActiveOrgId } from "../lib/activeOrg";
import { loadFinance, round2, type FinanceData } from "../lib/financeData";
import type { Property, Tenant, Unit, UnitStatus } from "./data/properties";
import { isMultiUnitType, type PropertyRecord } from "./add/types/property";
import { emptyPropertyForm } from "./add/data/mockProperties";
import { toProperty } from "./add/convert";
import { loadStaff } from "./add/store/refRepo";
import { deleteDocument, documentUrls, listDocuments, removeObjects, updateDocumentDetails, uploadDocument, uploadObject } from "../lib/documents";

/* eslint-disable @typescript-eslint/no-explicit-any -- rows come from untyped PostgREST responses */

/** property code (PR-0001) -> row id, filled by loadAll so edits update the right row */
const idByCode = new Map<string, string>();

const text = (v: string) => (v.trim() === "" ? null : v.trim());
const number = (v: string) => {
  if (v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));

function toRow(r: PropertyRecord) {
  const currency = r.defaultCurrency.trim().toUpperCase();
  return {
    name: r.name.trim(),
    property_type: r.propertyType || "other",
    status: r.status || "active",
    is_draft: r.isDraft,
    property_manager_id: r.propertyManagerId || null,
    management_company_id: r.managementCompanyId || null,
    description: text(r.description),
    date_acquired: text(r.dateAcquired),
    country: r.country || "Canada",
    address_line1: r.streetAddress.trim(),
    address_line2: text(r.unitSuite),
    city: r.city.trim(),
    state_province: text(r.provinceState),
    postal_code: text(r.postalCode),
    timezone: text(r.timeZone),
    building_type: text(r.buildingType),
    year_built: number(r.yearBuilt),
    total_building_area: number(r.totalBuildingArea),
    area_unit: r.areaUnit,
    lot_size: number(r.lotSize),
    lot_size_unit: number(r.lotSize) === null ? null : r.lotSizeUnit,
    parking_spaces: number(r.parkingSpaces) === null ? null : Math.round(number(r.parkingSpaces)!),
    amenities: r.amenities,
    furnishing_status: r.furnishingStatus || null,
    general_features: text(r.generalFeatures),
    bedrooms: number(r.bedrooms),
    bathrooms: number(r.bathrooms),
    parking_details: text(r.parkingDetails),
    ownership_type: r.ownershipType || null,
    management_start_date: text(r.managementStartDate),
    emergency_contact_name: text(r.emergencyContactName),
    emergency_contact_phone: text(r.emergencyContactPhone),
    purchase_price: number(r.purchasePrice),
    purchase_date: text(r.purchaseDate),
    estimated_value: number(r.currentEstimatedValue),
    property_tax_amount: number(r.propertyTaxAmount),
    property_tax_frequency: r.propertyTaxFrequency || null,
    insurance_provider: text(r.insuranceProvider),
    insurance_policy_expiry: text(r.insurancePolicyExpiry),
    mortgage_lender: text(r.mortgageLender),
    mortgage_reference: text(r.mortgageReference),
    default_currency: /^[A-Z]{3}$/.test(currency) ? currency : null,
    electricity_provider: text(r.electricityProvider),
    electricity_account_ref: text(r.electricityAccountRef),
    water_sewer_provider: text(r.waterSewerProvider),
    gas_provider: text(r.gasProvider),
    internet_provider: text(r.internetProvider),
    waste_provider: text(r.wasteProvider),
    heating_type: text(r.heatingType),
    water_heating_type: text(r.waterHeatingType),
    utility_responsibility: r.utilityResponsibility || null,
    default_maintenance_contact: text(r.defaultMaintenanceContact),
    maintenance_instructions: text(r.maintenanceInstructions),
    last_inspection_date: text(r.lastInspectionDate),
    next_inspection_date: text(r.nextInspectionDate),
    warranty_expiry_date: text(r.warrantyExpiryDate),
    access_instructions: text(r.accessInstructions),
  };
}

function toRecord(row: any, unitCount: number, owners: { owner_id: string; ownership_percentage: number }[]): PropertyRecord {
  const sorted = [...owners].sort((a, b) => Number(b.ownership_percentage) - Number(a.ownership_percentage));
  const joint = row.ownership_type === "joint" && sorted.length > 1;
  return {
    ...emptyPropertyForm(),
    id: row.code ?? row.id,
    createdAt: row.created_at,
    isDraft: row.is_draft,
    name: row.name,
    propertyType: row.property_type,
    status: row.status,
    description: str(row.description),
    dateAcquired: str(row.date_acquired),
    country: row.country,
    streetAddress: row.address_line1,
    unitSuite: str(row.address_line2),
    city: row.city,
    provinceState: str(row.state_province),
    postalCode: str(row.postal_code),
    timeZone: str(row.timezone),
    buildingType: str(row.building_type),
    numberOfUnits: String(unitCount),
    yearBuilt: str(row.year_built),
    totalBuildingArea: str(row.total_building_area),
    areaUnit: row.area_unit,
    lotSize: str(row.lot_size),
    lotSizeUnit: row.lot_size_unit ?? "sqft",
    parkingSpaces: str(row.parking_spaces),
    amenities: row.amenities ?? [],
    furnishingStatus: row.furnishing_status ?? "",
    generalFeatures: str(row.general_features),
    bedrooms: str(row.bedrooms),
    bathrooms: str(row.bathrooms),
    parkingDetails: str(row.parking_details),
    ownershipType: row.ownership_type ?? "",
    ownerId: sorted[0]?.owner_id ?? "",
    ownerShares: joint ? sorted.map((o) => ({ ownerId: o.owner_id, percentage: String(Number(o.ownership_percentage)) })) : [],
    propertyManagerId: row.property_manager_id ?? "",
    managementCompanyId: row.management_company_id ?? "",
    managementStartDate: str(row.management_start_date),
    emergencyContactName: str(row.emergency_contact_name),
    emergencyContactPhone: str(row.emergency_contact_phone),
    purchasePrice: str(row.purchase_price),
    purchaseDate: str(row.purchase_date),
    currentEstimatedValue: str(row.estimated_value),
    propertyTaxAmount: str(row.property_tax_amount),
    propertyTaxFrequency: row.property_tax_frequency ?? "",
    insuranceProvider: str(row.insurance_provider),
    insurancePolicyExpiry: str(row.insurance_policy_expiry),
    mortgageLender: str(row.mortgage_lender),
    mortgageReference: str(row.mortgage_reference),
    defaultCurrency: str(row.default_currency).trim() || emptyPropertyForm().defaultCurrency,
    electricityProvider: str(row.electricity_provider),
    electricityAccountRef: str(row.electricity_account_ref),
    waterSewerProvider: str(row.water_sewer_provider),
    gasProvider: str(row.gas_provider),
    internetProvider: str(row.internet_provider),
    wasteProvider: str(row.waste_provider),
    heatingType: str(row.heating_type),
    waterHeatingType: str(row.water_heating_type),
    utilityResponsibility: row.utility_responsibility ?? "",
    defaultMaintenanceContact: str(row.default_maintenance_contact),
    maintenanceInstructions: str(row.maintenance_instructions),
    lastInspectionDate: str(row.last_inspection_date),
    nextInspectionDate: str(row.next_inspection_date),
    warrantyExpiryDate: str(row.warranty_expiry_date),
    accessInstructions: str(row.access_instructions),
  };
}

const UNIT_STATUS: Record<string, UnitStatus> = { occupied: "current", notice: "notice" };

const monthYear = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleString("en-US", { month: "short", year: "numeric" });
const fullDate = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric" });
const RESIDENT_ROLE: Record<string, Tenant["role"]> = { main_tenant: "Leaseholder", co_tenant: "Co-leaseholder", occupant: "Occupant", guarantor: "Occupant" };

/** What the unit's occupying lease says about it; empty when the unit has no current lease. */
type Occupancy = { rent: number; leaseEnd: string; tenants: Tenant[] };

/** What a unit owes and how reliably it pays, from its invoices. */
type UnitMoney = { balance: number; dueInDays: number; overdueDays: number; history: number[] };

const dayDiff = (iso: string, from: string) => Math.round((new Date(`${iso}T12:00:00`).getTime() - new Date(`${from}T12:00:00`).getTime()) / 86400000);

function unitMoney(finance: FinanceData): Map<string, UnitMoney> {
  const today = new Date().toISOString().slice(0, 10);
  const payDate = new Map(finance.payments.filter((p) => p.status === "posted").map((p) => [p.id, p.date]));
  // the date an invoice was last settled: its latest payment allocation or credit application
  const settledOn = new Map<string, string>();
  for (const a of finance.allocations) {
    const d = payDate.get(a.paymentId);
    if (d && d > (settledOn.get(a.invoiceId) ?? "")) settledOn.set(a.invoiceId, d);
  }
  for (const c of finance.creditApplications) if (c.date > (settledOn.get(c.invoiceId) ?? "")) settledOn.set(c.invoiceId, c.date);

  const byUnit = new Map<string, UnitMoney>();
  const sorted = [...finance.invoices].filter((i) => i.unitId && i.status === "open").sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  for (const inv of sorted) {
    const m = byUnit.get(inv.unitId!) ?? { balance: 0, dueInDays: 0, overdueDays: 0, history: [] };
    if (inv.outstanding > 0) {
      m.balance = round2(m.balance + inv.outstanding);
      const days = dayDiff(inv.dueDate, today);
      m.dueInDays = m.dueInDays === 0 ? days : Math.min(m.dueInDays, days);
      m.overdueDays = Math.max(m.overdueDays, inv.daysOverdue);
      if (inv.dueDate <= today) m.history.push(0); // overdue and unpaid: a missed month
    } else if (inv.dueDate <= today) {
      m.history.push((settledOn.get(inv.id) ?? inv.dueDate) <= inv.dueDate ? 1 : 0.5); // paid on time, or late
    }
    byUnit.set(inv.unitId!, m);
  }
  for (const m of byUnit.values()) m.history = m.history.slice(-12);
  return byUnit;
}

function toUnit(row: any, occupancy?: Occupancy, money?: UnitMoney): Unit {
  const base: UnitStatus = UNIT_STATUS[row.unit_status] ?? (occupancy ? "current" : "vacant");
  // an occupied unit that owes rent past its due date is late, and delinquent after 30 days
  const status: UnitStatus = occupancy && money && money.balance > 0 && money.overdueDays > 0 ? (money.overdueDays > 30 ? "delinquent" : "late") : base;
  return {
    unit: row.unit_number,
    beds: Number(row.bedrooms ?? 0),
    baths: Number(row.bathrooms ?? 0),
    sqft: Number(row.square_feet ?? 0),
    rent: occupancy ? occupancy.rent : Number(row.advertised_rent ?? 0),
    balance: money?.balance ?? 0,
    dueInDays: money?.dueInDays ?? 0,
    status,
    leaseEnd: occupancy?.leaseEnd ?? "—",
    tenants: occupancy?.tenants ?? [],
    history: money?.history ?? [],
  };
}

export async function loadAll(orgId: string): Promise<{ properties: Property[]; records: Map<string, PropertyRecord> }> {
  const finance = await loadFinance(orgId).catch(() => null); // balances are optional: without permission the page still lists properties
  const [props, units, links, staff, leaseUnits, leases, parties, partyUnits, tenants] = await Promise.all([
    supabase.from("properties").select("*").eq("organization_id", orgId).is("archived_at", null).order("created_at"),
    supabase
      .from("units")
      .select("id, property_id, unit_number, bedrooms, bathrooms, square_feet, advertised_rent, unit_status")
      .eq("organization_id", orgId)
      .is("archived_at", null),
    supabase.from("property_owners").select("property_id, owner_id, ownership_percentage").eq("organization_id", orgId),
    loadStaff(orgId).catch(() => []),
    supabase.from("lease_units").select("lease_id, unit_id, allocated_monthly_rent").eq("organization_id", orgId).eq("is_occupying", true),
    supabase.from("leases").select("id, end_date").eq("organization_id", orgId).eq("status", "active"),
    supabase.from("lease_parties").select("id, lease_id, tenant_id, role, relationship_start_date, relationship_end_date").eq("organization_id", orgId).is("relationship_end_date", null),
    supabase.from("lease_party_units").select("lease_party_id, unit_id").eq("organization_id", orgId),
    supabase.from("tenants").select("id, first_name, last_name").eq("organization_id", orgId),
  ]);
  if (props.error) throw toError(props.error, "Unable to load properties.");
  if (units.error) throw toError(units.error, "Unable to load units.");
  if (links.error) throw toError(links.error, "Unable to load property owners.");
  for (const res of [leaseUnits, leases, parties, partyUnits, tenants]) if (res.error) throw toError(res.error, "Unable to load residents.");
  const leaseEnd = new Map((leases.data ?? []).map((l: any) => [l.id, l.end_date as string | null]));
  const tenantName = new Map((tenants.data ?? []).map((t: any) => [t.id, `${t.first_name} ${t.last_name ?? ""}`.trim()]));
  const unitsOfParty = new Map<string, Set<string>>();
  for (const pu of partyUnits.data ?? []) unitsOfParty.set(pu.lease_party_id, new Set([...(unitsOfParty.get(pu.lease_party_id) ?? []), pu.unit_id]));
  // a unit's current lease is the occupying one on an active lease; its residents are the people on it who have not left
  const moneyByUnit = finance ? unitMoney(finance) : new Map<string, UnitMoney>();
  const occupancyOf = (unitId: string): Occupancy | undefined => {
    const link = (leaseUnits.data ?? []).find((lu: any) => lu.unit_id === unitId && leaseEnd.has(lu.lease_id));
    if (!link) return undefined;
    const residents = (parties.data ?? [])
      .filter((p: any) => p.lease_id === link.lease_id && (!unitsOfParty.has(p.id) || unitsOfParty.get(p.id)!.has(unitId)))
      .map((p: any): Tenant => ({ name: tenantName.get(p.tenant_id) ?? "Resident", role: RESIDENT_ROLE[p.role] ?? "Occupant", since: monthYear(p.relationship_start_date) }));
    const end = leaseEnd.get(link.lease_id);
    return { rent: Number(link.allocated_monthly_rent ?? 0), leaseEnd: end ? fullDate(end) : "—", tenants: residents };
  };
  const ownersByProperty = new Map<string, any[]>();
  for (const l of links.data ?? []) ownersByProperty.set(l.property_id, [...(ownersByProperty.get(l.property_id) ?? []), l]);
  const staffName = new Map(staff.map((s) => [s.id, s.name]));
  const preferred = await supabase.from("property_preferred_vendors").select("property_id, vendor_id").eq("organization_id", orgId);
  if (preferred.error) throw toError(preferred.error, "Unable to load preferred contractors.");
  const vendorsByProperty = new Map<string, string[]>();
  for (const pv of preferred.data ?? []) vendorsByProperty.set(pv.property_id, [...(vendorsByProperty.get(pv.property_id) ?? []), pv.vendor_id]);

  const unitsByProperty = new Map<string, any[]>();
  for (const u of units.data ?? []) unitsByProperty.set(u.property_id, [...(unitsByProperty.get(u.property_id) ?? []), u]);

  // cover pictures and documents: pictures open through short-lived links, documents list their stored file
  const covered = (props.data ?? []).filter((r: any) => r.cover_image_path);
  const coverUrls = await documentUrls(covered.map((r: any) => ({ bucket: "property-images", path: r.cover_image_path }))).catch(() => new Map<string, string>());
  const files = await listDocuments(orgId, ["property"]).catch(() => []);

  idByCode.clear();
  const records = new Map<string, PropertyRecord>();
  const properties = (props.data ?? []).map((row: any) => {
    const rows = (unitsByProperty.get(row.id) ?? []).sort((a, b) =>
      String(a.unit_number).localeCompare(String(b.unit_number), undefined, { numeric: true }),
    );
    const record: PropertyRecord = {
      ...toRecord(row, rows.length, ownersByProperty.get(row.id) ?? []),
      preferredContractorIds: vendorsByProperty.get(row.id) ?? [],
      coverImage: row.cover_image_path ? coverUrls.get(`property-images/${row.cover_image_path}`) ?? null : null,
      coverImageName: row.cover_image_path ? String(row.cover_image_path).split("/").pop()!.replace(/^[0-9a-f-]{36}-/, "") : "",
      documents: files.filter((f) => f.entityId === row.id).map((f) => ({
        id: f.id, fileName: f.name, fileSize: f.sizeBytes, category: f.category, uploadDate: f.uploadedAt, expiryDate: f.expiryDate, notes: undefined, bucket: f.bucket, path: f.path,
      })),
    };
    idByCode.set(record.id, row.id);
    records.set(record.id, record);
    const property = toProperty(record, { units: rows.map((u) => toUnit(u, occupancyOf(u.id), moneyByUnit.get(u.id))) } as Property);
    return { ...property, manager: staffName.get(row.property_manager_id) ?? "Unassigned" };
  });
  return { properties, records };
}

/** How many units the form asks for (same rule as the table model). */
const wantedUnits = (r: PropertyRecord) => Math.min(500, isMultiUnitType(r.propertyType) ? Math.max(1, Number(r.numberOfUnits) || 1) : 1);

async function saveFiles(orgId: string, id: string, code: string, record: PropertyRecord): Promise<void> {
  const current = await supabase.from("properties").select("cover_image_path").eq("id", id).single();
  const oldPath: string | null = current.data?.cover_image_path ?? null;
  if (record.coverImageFile) {
    const path = await uploadObject("property-images", "covers", id, record.coverImageFile);
    const res = await supabase.from("properties").update({ cover_image_path: path }).eq("id", id);
    if (res.error) throw toError(res.error, "the cover picture could not be saved.");
    if (oldPath) await removeObjects("property-images", [oldPath]);
  } else if (!record.coverImage && oldPath) {
    const res = await supabase.from("properties").update({ cover_image_path: null }).eq("id", id);
    if (res.error) throw toError(res.error, "the cover picture could not be removed.");
    await removeObjects("property-images", [oldPath]);
  }

  const existing = await listDocuments(orgId, ["property"], [id]);
  const keep = new Set(record.documents.filter((d) => !d.file).map((d) => d.id));
  for (const gone of existing.filter((d) => !keep.has(d.id))) await deleteDocument(gone.id);
  for (const d of record.documents) {
    if (d.file) {
      await uploadDocument({
        bucket: "lease-documents", area: "properties", file: d.file, entityType: "property", entityId: id, entityLabel: code, category: d.category, originModule: "Properties",
        expiryDate: d.expiryDate || undefined, description: d.notes || undefined,
      });
    } else {
      const before = existing.find((e) => e.id === d.id);
      if (before && (before.category !== d.category || (before.expiryDate ?? "") !== (d.expiryDate ?? ""))) await updateDocumentDetails(d.id, { category: d.category, expiryDate: d.expiryDate ?? null });
    }
  }
}

/** Creates or updates the property, then adds placeholder units when the form asks for more than exist. Returns the property code. */
export async function save(record: PropertyRecord): Promise<string> {
  const orgId = getActiveOrgId();
  if (!orgId) throw new Error("Select an organization first.");
  const row = toRow(record);
  let id = idByCode.get(record.id);
  let code = record.id;

  if (id) {
    const { data, error } = await supabase.from("properties").update(row).eq("id", id).select("id, code");
    if (error) throw toError(error);
    // RLS filters out rows the caller may not change instead of raising
    if (!data?.length) throw new Error("You don't have permission to edit properties.");
  } else {
    const { data: auth } = await supabase.auth.getUser();
    // `code` is left out on purpose: the database assigns the next PR-#### for this organization
    const { data, error } = await supabase
      .from("properties")
      .insert({ ...row, organization_id: orgId, created_by: auth.user?.id ?? null })
      .select("id, code")
      .single();
    if (error) {
      if (error.code === "42501") throw new Error("You don't have permission to add properties.");
      throw toError(error);
    }
    id = data.id;
    code = data.code ?? data.id;
  }

  const { data: existing, error: unitsError } = await supabase.from("units").select("unit_number").eq("property_id", id);
  if (unitsError) throw toError(unitsError);
  const have = new Set((existing ?? []).map((u: any) => u.unit_number));
  const want = wantedUnits(record);
  if (have.size < want) {
    const toAdd: string[] = [];
    for (let i = 1; have.size + toAdd.length < want; i++) {
      const name = want === 1 ? "Main" : String(i);
      if (!have.has(name)) toAdd.push(name);
      if (want === 1) break;
    }
    if (toAdd.length) {
      const { error } = await supabase
        .from("units")
        .insert(toAdd.map((unit_number) => ({ organization_id: orgId, property_id: id, unit_number, unit_status: "vacant" })));
      if (error) throw toError(error, "The property was saved, but its units could not be created.");
    }
  }

  // owner links: one owner at 100 %, or the joint split, replaced in a single transaction (migration 015)
  const shares =
    record.ownershipType === "joint" && record.ownerShares.length
      ? record.ownerShares.filter((s) => s.ownerId).map((s) => ({ owner_id: s.ownerId, percentage: Number(s.percentage) || 0 }))
      : record.ownerId
        ? [{ owner_id: record.ownerId, percentage: 100 }]
        : [];
  const { error: ownersError } = await supabase.rpc("set_property_owners", { p_property: id, p_owners: shares });
  if (ownersError) throw toError(ownersError, "The property was saved, but its owners could not be saved.");

  // cover picture and documents (the property itself is already saved, so a failure here says so)
  try {
    await saveFiles(orgId, id!, code, record);
  } catch (error) {
    throw new Error(`The property was saved, but ${error instanceof Error ? error.message.replace(/^./, (c) => c.toLowerCase()) : "its files could not be saved."}`);
  }

  // preferred contractors: replace the set
  const wanted = [...new Set(record.preferredContractorIds)];
  const del = await supabase.from("property_preferred_vendors").delete().eq("property_id", id);
  if (del.error) throw toError(del.error, "The property was saved, but its preferred contractors could not be saved.");
  if (wanted.length) {
    const ins = await supabase.from("property_preferred_vendors").insert(wanted.map((vendor_id) => ({ organization_id: orgId, property_id: id, vendor_id })));
    if (ins.error) throw toError(ins.error, "The property was saved, but its preferred contractors could not be saved.");
  }
  return code;
}
