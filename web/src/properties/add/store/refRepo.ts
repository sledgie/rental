// Supabase access for the lists the property form picks from: owners, management companies, and staff (the organization's members).
import { supabase, toError } from "../../../lib/supabase";
import { roleFromDb } from "../../../auth/services/supabaseMappers";
import type { ManagementCompany, Owner, StaffMember, Vendor } from "../types/property";

/* eslint-disable @typescript-eslint/no-explicit-any -- rows come from untyped PostgREST responses */

const toOwner = (row: any): Owner => ({
  id: row.id,
  name: row.name,
  type: row.owner_type,
  email: row.email ?? "",
  phone: row.phone ?? undefined,
});

export async function loadOwners(orgId: string): Promise<Owner[]> {
  const { data, error } = await supabase.from("owners").select("*").eq("organization_id", orgId).is("archived_at", null).order("name");
  if (error) throw toError(error, "Unable to load owners.");
  return (data ?? []).map(toOwner);
}

export async function insertOwner(orgId: string, owner: Omit<Owner, "id">): Promise<Owner> {
  const { data, error } = await supabase
    .from("owners")
    .insert({ organization_id: orgId, name: owner.name, owner_type: owner.type, email: owner.email || null, phone: owner.phone ?? null })
    .select("*")
    .single();
  if (error) {
    if (error.code === "42501") throw new Error("You don't have permission to add owners.");
    throw toError(error, "Unable to create the owner.");
  }
  return toOwner(data);
}

export async function loadCompanies(orgId: string): Promise<ManagementCompany[]> {
  const { data, error } = await supabase.from("management_companies").select("id, name").eq("organization_id", orgId).is("archived_at", null).order("name");
  if (error) throw toError(error, "Unable to load management companies.");
  return (data ?? []).map((row: any) => ({ id: row.id, name: row.name }));
}

export async function insertCompany(orgId: string, name: string): Promise<ManagementCompany> {
  const { data, error } = await supabase.from("management_companies").insert({ organization_id: orgId, name }).select("id, name").single();
  if (error) {
    if (error.code === "42501") throw new Error("You don't have permission to add management companies.");
    throw toError(error, "Unable to create the management company.");
  }
  return { id: data.id, name: data.name };
}

/** Contractors and vendors the organization works with (the property form's "preferred contractors"). */
export async function loadVendors(orgId: string): Promise<Vendor[]> {
  const { data, error } = await supabase.from("vendors").select("id, company_name, trade, categories, vendor_type").eq("organization_id", orgId).in("vendor_type", ["contractor", "vendor"]).is("archived_at", null).eq("is_active", true).order("company_name");
  if (error) throw toError(error, "Unable to load contractors.");
  return (data ?? []).map((v: any) => ({ id: v.id, name: v.company_name, trade: v.trade ?? v.categories?.[0] ?? "" }));
}

/** Property managers are the organization's active members. */
export async function loadStaff(orgId: string): Promise<StaffMember[]> {
  const { data: members, error } = await supabase.from("organization_members").select("user_id, role").eq("organization_id", orgId).eq("status", "active");
  if (error) throw toError(error, "Unable to load staff.");
  const ids = (members ?? []).map((m: any) => m.user_id);
  if (!ids.length) return [];
  const { data: profiles, error: profileError } = await supabase.from("profiles").select("id, full_name, email").in("id", ids);
  if (profileError) throw toError(profileError, "Unable to load staff.");
  const byId = new Map((profiles ?? []).map((p: any) => [p.id, p]));
  return (members ?? [])
    .filter((m: any) => byId.has(m.user_id))
    .map((m: any) => {
      const p: any = byId.get(m.user_id);
      return { id: m.user_id, name: p.full_name || p.email || "Unknown", role: roleFromDb(m.role) };
    })
    .sort((a: StaffMember, b: StaffMember) => a.name.localeCompare(b.name));
}
