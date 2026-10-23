// Supabase access for the Units page (tables `properties` and `units`). Translates between the page's own Unit / Property
// shapes and database rows. Row-Level Security decides who may read or write.
import { supabase, toError } from "../lib/supabase";
import { getActiveOrgId } from "../lib/activeOrg";
import { loadFinance, round2 } from "../lib/financeData";
import type {
  ActivityEvent, ActivityKind, Furnished, Inspection, Lease, LeaseParty, LeaseUnit, PartyRole, Property, Tenant, Transaction, TxType, Unit, UnitCondition, UnitStatus,
} from "./data/types";

/* eslint-disable @typescript-eslint/no-explicit-any -- rows come from untyped PostgREST responses */

const STATUS_TO_DB: Record<UnitStatus, string> = {
  Occupied: "occupied",
  Vacant: "vacant",
  Reserved: "reserved",
  "Under Maintenance": "under_maintenance",
  Inactive: "unavailable",
};
// the database has finer states than the page; fold them into the closest label
const STATUS_FROM_DB: Record<string, UnitStatus> = {
  occupied: "Occupied",
  notice: "Occupied",
  vacant: "Vacant",
  reserved: "Reserved",
  under_maintenance: "Under Maintenance",
  renovation: "Under Maintenance",
  turnover: "Under Maintenance",
  unavailable: "Inactive",
};
const FURNISHED_TO_DB: Record<Furnished, string> = { Furnished: "furnished", "Partially Furnished": "partially_furnished", Unfurnished: "unfurnished" };
const FURNISHED_FROM_DB: Record<string, Furnished> = { furnished: "Furnished", partially_furnished: "Partially Furnished", unfurnished: "Unfurnished" };
const CONDITION_TO_DB: Record<UnitCondition, string> = { Excellent: "excellent", Good: "good", Fair: "fair", "Needs Work": "needs_work" };
const CONDITION_FROM_DB: Record<string, UnitCondition> = { excellent: "Excellent", good: "Good", fair: "Fair", needs_work: "Needs Work" };
const PROPERTY_TYPE: Record<string, Property["propertyType"]> = {
  townhouse: "Townhome Row",
  semi_detached_house: "Duplex",
  mixed_use: "Loft Conversion",
};

const str = (v: unknown) => (v === null || v === undefined || v === "" ? undefined : String(v));

function toInspection(row: any): Inspection | undefined {
  const last = str(row.last_inspection_date);
  const next = str(row.next_inspection_date);
  if (!last && !next) return undefined;
  const today = new Date().toISOString().slice(0, 10);
  return {
    status: next && next < today ? "Overdue" : next ? "Scheduled" : "Passed",
    lastInspectionDate: last,
    nextInspectionDate: next,
    inspector: str(row.inspector),
  };
}

export function toUnit(row: any): Unit {
  return {
    id: row.id,
    code: row.unit_code ?? undefined,
    propertyId: row.property_id,
    unitNumber: row.unit_number,
    unitType: (row.unit_type as Unit["unitType"]) || "Apartment",
    bedrooms: row.bedrooms === null ? null : Number(row.bedrooms),
    bathrooms: row.bathrooms === null ? null : Number(row.bathrooms),
    squareFootage: row.square_feet,
    floor: row.floor,
    furnished: FURNISHED_FROM_DB[row.furnished] ?? "Unfurnished",
    parkingDetails: row.parking_details,
    storageDetails: row.storage_details,
    appliances: row.appliances ?? [],
    utilitiesIncluded: row.utilities_included ?? [],
    accessibilityFeatures: row.accessibility_features ?? [],
    yearRenovated: row.year_renovated ?? undefined,
    unitCondition: CONDITION_FROM_DB[row.unit_condition] ?? "Good",
    unitStatus: STATUS_FROM_DB[row.unit_status] ?? "Vacant",
    advertisedRent: row.advertised_rent === null ? null : Number(row.advertised_rent),
    availabilityDate: row.available_on,
    inspection: toInspection(row),
    notes: str(row.notes),
    archived: row.archived_at !== null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toProperty(row: any): Property {
  return {
    id: row.id,
    propertyName: row.name,
    address: [row.address_line1, row.address_line2].filter(Boolean).join(", "),
    city: row.city,
    province: row.state_province ?? "",
    postalCode: row.postal_code ?? "—",
    propertyType: PROPERTY_TYPE[row.property_type] ?? "Apartment Building",
    yearBuilt: row.year_built ?? new Date().getFullYear(),
    manager: "Unassigned",
  };
}

/** Only the keys present in `p` are written, so a partial update never clears other columns. */
function patchToRow(p: Partial<Unit>, current?: Unit): Record<string, unknown> {
  const r: Record<string, unknown> = {};
  const has = (k: keyof Unit) => k in p;
  if (has("propertyId")) r.property_id = p.propertyId;
  if (has("unitNumber")) r.unit_number = p.unitNumber?.trim();
  if (has("unitType")) r.unit_type = p.unitType;
  if (has("bedrooms")) r.bedrooms = p.bedrooms;
  if (has("bathrooms")) r.bathrooms = p.bathrooms;
  if (has("squareFootage")) r.square_feet = p.squareFootage;
  if (has("floor")) r.floor = p.floor;
  if (has("furnished")) r.furnished = FURNISHED_TO_DB[p.furnished!];
  if (has("parkingDetails")) r.parking_details = p.parkingDetails;
  if (has("storageDetails")) r.storage_details = p.storageDetails;
  if (has("appliances")) r.appliances = p.appliances ?? [];
  if (has("utilitiesIncluded")) r.utilities_included = p.utilitiesIncluded ?? [];
  if (has("accessibilityFeatures")) r.accessibility_features = p.accessibilityFeatures ?? [];
  if (has("yearRenovated")) r.year_renovated = p.yearRenovated ?? null;
  if (has("unitCondition")) r.unit_condition = CONDITION_TO_DB[p.unitCondition!];
  // a unit in a finer database state (e.g. "notice") shows as its closest label; only write the status when the user really changed it
  if (has("unitStatus") && (!current || current.unitStatus !== p.unitStatus)) r.unit_status = STATUS_TO_DB[p.unitStatus!];
  if (has("advertisedRent")) r.advertised_rent = p.advertisedRent ?? null;
  if (has("availabilityDate")) r.available_on = p.availabilityDate || null;
  if (has("notes")) r.notes = p.notes ?? null;
  if (has("archived")) r.archived_at = p.archived ? new Date().toISOString() : null;
  return r;
}

function friendly(error: { code?: string; message?: string }, fallback: string): Error {
  if (error.code === "23505") return new Error("A unit with this number already exists on this property.");
  if (error.code === "42501") return new Error("You don't have permission to change units.");
  return toError(error, fallback);
}

export interface Loaded {
  properties: Property[];
  units: Unit[];
  tenants: Tenant[];
  leases: Lease[];
  leaseUnits: LeaseUnit[];
  leaseParties: LeaseParty[];
  transactions: Transaction[];
  activity: ActivityEvent[];
}

export async function loadAll(orgId: string): Promise<Loaded> {
  const q = (table: string, columns = "*") => supabase.from(table).select(columns).eq("organization_id", orgId);
  const [props, units, tenants, leases, leaseUnits, parties, events, finance] = await Promise.all([
    q("properties").is("archived_at", null).order("name"),
    q("units").order("created_at"),
    q("tenants", "id, first_name, last_name, email, phone, occupation, notes, created_at").is("archived_at", null),
    q("leases").order("created_at"),
    q("lease_units").order("created_at"),
    q("lease_parties").order("created_at"),
    q("activity_events", "id, entity_id, occurred_at, actor_display_name, related_record_label, description").eq("entity_type", "unit").order("occurred_at", { ascending: false }).limit(500),
    loadFinance(orgId),
  ]);
  // the audit trail may be hidden by Row-Level Security: that is an empty feed, not a failure
  for (const [name, res] of [["properties", props], ["units", units], ["tenants", tenants], ["leases", leases], ["lease units", leaseUnits], ["lease parties", parties]] as const) {
    if (res.error) throw toError(res.error, `Unable to load ${name}.`);
  }
  return {
    properties: (props.data ?? []).map(toProperty),
    units: (units.data ?? []).map(toUnit),
    tenants: (tenants.data ?? []).map(toTenant),
    leases: (leases.data ?? []).map(toLease),
    leaseUnits: (leaseUnits.data ?? []).map(toLeaseUnit),
    leaseParties: (parties.data ?? []).map(toLeaseParty),
    transactions: buildTransactions(finance),
    activity: (events.data ?? []).map((r: any): ActivityEvent => ({
      id: r.id,
      unitId: r.entity_id,
      kind: (KINDS as string[]).includes(r.related_record_label) ? (r.related_record_label as ActivityKind) : "record",
      message: r.description,
      actor: r.actor_display_name,
      at: r.occurred_at,
    })),
  };
}

// ------------------------------------------------------------------ ledger rows (invoices, payments, credits applied)
const INVOICE_TYPE: Record<string, TxType> = {
  rent: "Rent Charge", utilities: "Utility Charge", maintenance: "Maintenance Charge", late_fee: "Late Fee", deposit: "Other Charge", other: "Other Charge",
};
const METHOD: Record<string, NonNullable<Transaction["method"]>> = {
  etransfer: "E-Transfer", card: "Credit Card", cheque: "Cheque", pre_authorized_debit: "Pre-authorized Debit", cash: "Cash", bank_transfer: "Bank Transfer", other: "Bank Transfer",
};

/** One ledger row per invoice (charge), per payment allocation (payment) and per credit applied; only invoices tied to a unit are listed. */
function buildTransactions(finance: Awaited<ReturnType<typeof loadFinance>>): Transaction[] {
  const todayIso = new Date().toISOString().slice(0, 10);
  const invoices = new Map(finance.invoices.filter((i) => i.unitId).map((i) => [i.id, i]));
  const payments = new Map(finance.payments.map((p) => [p.id, p]));
  const out: Transaction[] = [];
  for (const inv of invoices.values()) {
    const posted = inv.status === "open";
    out.push({
      id: inv.id, accountId: `unit-${inv.unitId}`, accountType: "Unit", leaseId: inv.leaseId, unitId: inv.unitId, tenantId: inv.tenantId,
      transactionType: INVOICE_TYPE[inv.type] ?? "Other Charge", description: `${inv.number} \u2014 ${inv.description}`, amount: round2(inv.total),
      transactionDate: inv.issueDate, dueDate: inv.dueDate, transactionStatus: posted ? "Posted" : inv.status === "void" ? "Void" : "Draft",
      amountPaid: round2(inv.paidByPayments),
      paymentStatus: !posted ? undefined : inv.outstanding <= 0 ? "Paid" : inv.paidByPayments > 0 || inv.paidByCredits > 0 ? "Partial" : inv.dueDate > todayIso ? "Not Due" : "Unpaid",
    });
  }
  for (const a of finance.allocations) {
    const inv = invoices.get(a.invoiceId);
    const pay = payments.get(a.paymentId);
    if (!inv || !pay) continue;
    out.push({
      id: `${a.paymentId}:${a.invoiceId}`, accountId: `unit-${inv.unitId}`, accountType: "Unit", leaseId: inv.leaseId, unitId: inv.unitId, tenantId: inv.tenantId,
      transactionType: "Rent Payment", description: `Payment ${pay.number} for ${inv.number}`, amount: round2(a.amount), transactionDate: pay.date,
      transactionStatus: pay.status === "posted" ? "Posted" : "Void", method: METHOD[pay.method] ?? "Bank Transfer", reference: pay.reference || pay.number,
    });
  }
  for (const c of finance.creditApplications) {
    const inv = invoices.get(c.invoiceId);
    if (!inv) continue;
    out.push({
      id: `credit:${c.id}`, accountId: `unit-${inv.unitId}`, accountType: "Unit", leaseId: inv.leaseId, unitId: inv.unitId, tenantId: inv.tenantId,
      transactionType: "Credit", description: `Credit applied to ${inv.number}`, amount: round2(c.amount), transactionDate: c.date, transactionStatus: "Posted",
    });
  }
  return out;
}

// ------------------------------------------------------------------ tenants, leases, lease links (read + diff-persist)
const KINDS: ActivityKind[] = ["status", "lease", "tenant", "finance", "maintenance", "record", "system"];
const LEASE_STATUS_FROM_DB: Record<string, Lease["leaseStatus"]> = {
  draft: "Draft", pending_review: "Pending", pending_signature: "Pending", active: "Active", expired: "Expired", terminated: "Terminated", archived: "Expired",
};
const LEASE_STATUS_TO_DB: Record<Lease["leaseStatus"], string> = { Draft: "draft", Pending: "pending_signature", Active: "active", Expired: "expired", Terminated: "terminated" };
const ROLE_FROM_DB: Record<string, PartyRole> = { main_tenant: "Main Tenant", co_tenant: "Co-Tenant", occupant: "Occupant", guarantor: "Guarantor" };
const ROLE_TO_DB: Record<PartyRole, string> = { "Main Tenant": "main_tenant", "Co-Tenant": "co_tenant", Occupant: "occupant", Guarantor: "guarantor" };
const today = () => new Date().toISOString().slice(0, 10);
const hue = (id: string) => [...id].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 360, 7);

const toTenant = (r: any): Tenant => ({
  id: r.id,
  firstName: r.first_name,
  lastName: r.last_name ?? "",
  email: r.email ?? "",
  phone: r.phone ?? "",
  occupation: r.occupation ?? undefined,
  tenantSince: String(r.created_at).slice(0, 10),
  avatarHue: hue(r.id),
  notes: r.notes ?? undefined,
});
const tenantRow = (t: Tenant) => ({
  first_name: t.firstName.trim(), last_name: t.lastName.trim(), email: t.email.trim().toLowerCase() || null, phone: t.phone.trim() || null,
  occupation: t.occupation?.trim() || null, notes: t.notes?.trim() || null,
});

const toLease = (r: any): Lease => ({
  id: r.id,
  leaseNumber: r.lease_number ?? "",
  startDate: r.start_date,
  endDate: r.end_date ?? r.start_date,
  leaseStatus: LEASE_STATUS_FROM_DB[r.status] ?? "Draft",
  totalContractRent: Number(r.agreed_monthly_rent ?? 0),
  rentDueDay: r.rent_due_day,
  securityDeposit: Number(r.deposit_amount ?? 0),
  renewalTerms: r.renewal_terms ?? "",
  terms: r.terms ?? undefined,
  documentReferences: [], // documents arrive with file storage
  terminatedOn: r.terminated_on ?? undefined,
  terminationReason: r.termination_reason ?? undefined,
});
const leaseRow = (l: Lease) => ({
  start_date: l.startDate, end_date: l.endDate || null, status: LEASE_STATUS_TO_DB[l.leaseStatus], agreed_monthly_rent: l.totalContractRent,
  rent_due_day: l.rentDueDay || 1, deposit_amount: l.securityDeposit || 0, renewal_terms: l.renewalTerms || null, terms: l.terms || null,
  terminated_on: l.terminatedOn || null, termination_reason: l.terminationReason || null,
});

const toLeaseUnit = (r: any): LeaseUnit => ({
  id: r.id, leaseId: r.lease_id, unitId: r.unit_id,
  rentAllocation: r.allocated_monthly_rent === null ? null : Number(r.allocated_monthly_rent),
  occupancyStartDate: r.start_date, occupancyEndDate: r.end_date ?? null,
});
const leaseUnitRow = (u: LeaseUnit) => ({
  lease_id: u.leaseId, unit_id: u.unitId, allocated_monthly_rent: u.rentAllocation, start_date: u.occupancyStartDate || today(), end_date: u.occupancyEndDate || null,
});

const toLeaseParty = (r: any): LeaseParty => ({
  id: r.id, leaseId: r.lease_id, tenantId: r.tenant_id, role: ROLE_FROM_DB[r.role] ?? "Occupant", isSignatory: r.is_signatory,
  effectiveStartDate: r.relationship_start_date, effectiveEndDate: r.relationship_end_date ?? null,
});
const partyRow = (p: LeaseParty) => ({
  lease_id: p.leaseId, tenant_id: p.tenantId, role: ROLE_TO_DB[p.role] ?? "occupant", is_primary_contact: p.role === "Main Tenant" && !p.effectiveEndDate,
  is_signatory: p.isSignatory, relationship_start_date: p.effectiveStartDate || today(), relationship_end_date: p.effectiveEndDate || null,
});

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
function diff<T extends { id: string }>(prev: T[], next: T[]) {
  const before = new Map(prev.map((r) => [r.id, r]));
  const after = new Map(next.map((r) => [r.id, r]));
  return {
    added: next.filter((r) => !before.has(r.id)),
    changed: next.filter((r) => before.has(r.id) && !same(before.get(r.id), r)),
    removed: prev.filter((r) => !after.has(r.id)),
  };
}

type Rentals = Pick<Loaded, "tenants" | "leases" | "leaseUnits" | "leaseParties" | "activity">;

/** True when something the database stores about tenants, leases or the unit activity feed differs. */
export const rentalsChanged = (prev: Rentals, next: Rentals) =>
  prev.tenants !== next.tenants || prev.leases !== next.leases || prev.leaseUnits !== next.leaseUnits || prev.leaseParties !== next.leaseParties || prev.activity !== next.activity;

function rentalError(error: { code?: string; message?: string }, fallback: string): Error {
  if (error.code === "23P01") return new Error("A selected unit already has an active lease during these dates.");
  if (error.code === "23505") return new Error("That record already exists (for example a second primary contact, or a duplicate email).");
  if (error.code === "42501") return new Error("You don't have permission to make this change.");
  return toError(error, fallback);
}

/** Writes the tenant / lease changes between two states. Returns the lease numbers the database assigned (LSE-00001). */
export async function persistRentals(prev: Rentals, next: Rentals): Promise<Map<string, string>> {
  const orgId = getActiveOrgId();
  if (!orgId) throw new Error("Select an organization first.");
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id ?? null;
  const numbers = new Map<string, string>();
  const check = (res: { error: any }, fallback: string) => { if (res.error) throw rentalError(res.error, fallback); };

  const tenants = diff(prev.tenants, next.tenants);
  if (tenants.added.length) check(await supabase.from("tenants").insert(tenants.added.map((t) => ({ id: t.id, organization_id: orgId, created_by: userId, ...tenantRow(t) }))), "Unable to save the tenant.");
  for (const t of tenants.changed) check(await supabase.from("tenants").update(tenantRow(t)).eq("id", t.id), "Unable to save the tenant.");

  const leases = diff(prev.leases, next.leases);
  if (leases.added.length) {
    const res = await supabase.from("leases").insert(leases.added.map((l) => ({ id: l.id, organization_id: orgId, created_by: userId, ...leaseRow(l) }))).select("id, lease_number");
    check(res, "Unable to save the lease.");
    (res.data ?? []).forEach((r: any) => numbers.set(r.id, r.lease_number));
  }
  for (const l of leases.changed) {
    const res = await supabase.from("leases").update(leaseRow(l)).eq("id", l.id).select("id");
    check(res, "Unable to save the lease.");
    if (!res.data?.length) throw new Error("You don't have permission to edit leases.");
  }

  const links = diff(prev.leaseUnits, next.leaseUnits);
  if (links.added.length) check(await supabase.from("lease_units").insert(links.added.map((u) => ({ id: u.id, organization_id: orgId, ...leaseUnitRow(u) }))), "Unable to link the unit to the lease.");
  for (const u of links.changed) check(await supabase.from("lease_units").update(leaseUnitRow(u)).eq("id", u.id), "Unable to update the lease unit.");

  const parties = diff(prev.leaseParties, next.leaseParties);
  for (const p of parties.changed) check(await supabase.from("lease_parties").update(partyRow(p)).eq("id", p.id), "Unable to update the person on the lease.");
  if (parties.added.length) check(await supabase.from("lease_parties").insert(parties.added.map((p) => ({ id: p.id, organization_id: orgId, ...partyRow(p) }))), "Unable to add the person to the lease.");

  // unit activity feed -> audit trail (written by the database, attributed to the signed-in user)
  for (const a of diff(prev.activity, next.activity).added.reverse()) {
    check(await supabase.rpc("record_activity", {
      p_org: orgId, p_action: "unit.activity", p_category: "Properties & Units", p_description: a.message,
      p_entity_type: "unit", p_entity_id: a.unitId, p_label: a.kind, p_source_module: "Units", p_unit_id: a.unitId,
    }), "Unable to record the activity.");
  }
  return numbers;
}

export async function insertUnit(draft: Omit<Unit, "id" | "code" | "createdAt" | "updatedAt" | "archived">): Promise<Unit> {
  const orgId = getActiveOrgId();
  if (!orgId) throw new Error("Select an organization first.");
  const { data, error } = await supabase
    .from("units")
    .insert({ ...patchToRow(draft as Partial<Unit>), organization_id: orgId })
    .select("*")
    .single();
  if (error) throw friendly(error, "Unable to create the unit.");
  return toUnit(data);
}

export async function updateUnit(id: string, patch: Partial<Unit>, current?: Unit): Promise<Unit> {
  const row = patchToRow(patch, current);
  if (!Object.keys(row).length && current) return current;
  const { data, error } = await supabase.from("units").update(row).eq("id", id).select("*");
  if (error) throw friendly(error, "Unable to save the unit.");
  // RLS filters out rows the caller may not change instead of raising
  if (!data?.length) throw new Error("You don't have permission to change this unit.");
  return toUnit(data[0]);
}
