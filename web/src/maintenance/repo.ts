// Supabase access for the Maintenance module's shared lists (properties, units, tenants, leases, staff) and for Contractors & Vendors
// (table `vendors`). Row-Level Security decides who may read or write.
import { supabase, toError } from "../lib/supabase";
import { getActiveOrgId } from "../lib/activeOrg";
import { fetchAll } from "../lib/financeData";
import { loadStaff } from "../properties/add/store/refRepo";
import type { Contractor, Lease, Property, StaffMember, Tenant, Unit } from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any -- rows come from untyped PostgREST responses */

export interface Reference {
  properties: Property[];
  units: Unit[];
  tenants: Tenant[];
  leases: Lease[];
  staff: StaffMember[];
  contractors: Contractor[];
  /** the signed-in user, as a staff member (null when they are not a member of the organization) */
  me: StaffMember | null;
}

const num = (v: unknown) => Number(v ?? 0);
const WARNING_DAYS = 60;

function friendly(error: { code?: string; message?: string }, fallback: string): Error {
  if (error.code === "42501") return new Error("You don't have permission to change contractors and vendors.");
  return toError(error, fallback);
}

export async function loadReference(orgId: string): Promise<Reference> {
  const { data: auth } = await supabase.auth.getUser();
  const [properties, units, tenants, leases, parties, leaseUnits, vendors, staff] = await Promise.all([
    fetchAll("properties", "id, name, address_line1, city, state_province, property_type, year_built", orgId, "name"),
    fetchAll("units", "id, property_id, unit_number, bedrooms, bathrooms, square_feet, unit_status", orgId, "unit_number"),
    fetchAll("tenants", "id, first_name, last_name, email, phone, created_at", orgId, "last_name"),
    fetchAll("leases", "id, start_date, end_date, agreed_monthly_rent, status", orgId, "start_date"),
    fetchAll("lease_parties", "lease_id, tenant_id, role, relationship_start_date, relationship_end_date", orgId, "lease_id"),
    fetchAll("lease_units", "lease_id, unit_id", orgId, "lease_id"),
    fetchAll("vendors", "*", orgId, "company_name"),
    loadStaff(orgId).catch(() => []),
  ]);
  const today = new Date().toISOString().slice(0, 10);
  const soon = new Date(Date.now() + WARNING_DAYS * 86400000).toISOString().slice(0, 10);
  const mainOf = (leaseId: string) => parties.find((p: any) => p.lease_id === leaseId && p.role === "main_tenant" && !p.relationship_end_date) ?? parties.find((p: any) => p.lease_id === leaseId);

  const staffMembers: StaffMember[] = staff.map((s) => ({ id: s.id, name: s.name, role: s.role }));
  return {
    properties: properties.map((p: any): Property => ({
      id: p.id, name: p.name, address: p.address_line1, city: [p.city, p.state_province].filter(Boolean).join(", "), type: String(p.property_type).replace(/_/g, " "), yearBuilt: p.year_built ?? 0,
    })),
    units: units.map((u: any): Unit => ({
      id: u.id, propertyId: u.property_id, name: u.unit_number, beds: num(u.bedrooms), baths: num(u.bathrooms), sqft: num(u.square_feet),
      status: ["occupied"].includes(u.unit_status) ? "Occupied" : u.unit_status === "notice" ? "Notice Given" : "Vacant",
    })),
    tenants: tenants.map((t: any): Tenant => {
      const since = parties.filter((p: any) => p.tenant_id === t.id).map((p: any) => p.relationship_start_date).sort()[0];
      return { id: t.id, name: `${t.first_name} ${t.last_name ?? ""}`.trim(), email: t.email ?? "", phone: t.phone ?? "", movedIn: since ?? String(t.created_at).slice(0, 10) };
    }),
    leases: leases.map((l: any): Lease => ({
      id: l.id, unitId: leaseUnits.find((x: any) => x.lease_id === l.id)?.unit_id ?? "", tenantId: mainOf(l.id)?.tenant_id ?? "", start: l.start_date, end: l.end_date ?? l.start_date, rent: num(l.agreed_monthly_rent),
      status: ["terminated", "expired", "archived"].includes(l.status) ? "Ended" : l.status === "active" && l.end_date && l.end_date >= today && l.end_date <= soon ? "Expiring Soon" : "Active",
    })),
    staff: staffMembers,
    contractors: vendors
      .filter((v: any) => ["contractor", "vendor"].includes(v.vendor_type) && !v.archived_at)
      .map((v: any): Contractor => ({
        id: v.id, company: v.company_name, contact: v.contact_name ?? "", phone: v.phone ?? "", email: v.email ?? "", categories: v.categories ?? [], active: v.is_active, notes: v.notes ?? undefined,
      })),
    me: staffMembers.find((s) => s.id === auth.user?.id) ?? null,
  };
}

const row = (c: Partial<Contractor>) => {
  const r: Record<string, unknown> = {};
  if (c.company !== undefined) r.company_name = c.company;
  if (c.contact !== undefined) r.contact_name = c.contact || null;
  if (c.phone !== undefined) r.phone = c.phone || null;
  if (c.email !== undefined) r.email = c.email || null;
  if (c.categories !== undefined) { r.categories = c.categories; r.trade = c.categories[0] ?? null; }
  if (c.active !== undefined) r.is_active = c.active;
  if (c.notes !== undefined) r.notes = c.notes || null;
  return r;
};

export async function createContractor(c: Contractor): Promise<void> {
  const orgId = getActiveOrgId();
  if (!orgId) throw new Error("Select an organization first.");
  const { error } = await supabase.from("vendors").insert({ id: c.id, organization_id: orgId, vendor_type: "contractor", ...row(c) });
  if (error) throw friendly(error, "Unable to save the contractor.");
}

export async function updateContractor(id: string, patch: Partial<Contractor>): Promise<void> {
  const fields = row(patch);
  if (!Object.keys(fields).length) return;
  const res = await supabase.from("vendors").update(fields).eq("id", id).select("id");
  if (res.error) throw friendly(res.error, "Unable to save the contractor.");
  if (!res.data?.length) throw new Error("You don't have permission to change contractors and vendors.");
}
