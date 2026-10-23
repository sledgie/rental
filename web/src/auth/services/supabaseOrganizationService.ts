import { supabase, toError } from "../../lib/supabase";
import type { Organization, OrganizationInput } from "../lib/types";
import { businessTypeToDb, organizationFromRow } from "./supabaseMappers";

function validateInput(input: OrganizationInput) {
  if (input.name.trim().length < 2) throw new Error("Organization name must be at least 2 characters.");
  if (input.name.trim().length > 60) throw new Error("Organization name must be 60 characters or fewer.");
  if (!input.businessType) throw new Error("Choose a business type.");
  if (!input.country) throw new Error("Choose a country.");
  if (!input.currency) throw new Error("Choose a default currency.");
  if (!input.timezone) throw new Error("Choose a time zone.");
}

/** One database transaction: organization + Owner membership + defaults + active-workspace pointer + audit entry. */
export async function createOrganizationWithOwner(
  _actorId: string,
  input: OrganizationInput
): Promise<Organization> {
  validateInput(input);
  const { data: id, error } = await supabase.rpc("create_organization", {
    p_name: input.name.trim(),
    p_business_type: businessTypeToDb(input.businessType),
    p_country: input.country,
    p_currency: input.currency,
    p_timezone: input.timezone,
  });
  if (error) throw toError(error, "Unable to create the organization.");
  const { data, error: readError } = await supabase.from("organizations").select("*").eq("id", id).single();
  if (readError) throw toError(readError);
  return organizationFromRow(data);
}

export async function resolveEntryRoute(userId: string): Promise<string> {
  const [{ data: members, error }, { data: prefs }] = await Promise.all([
    supabase.from("organization_members").select("organization_id").eq("user_id", userId).eq("status", "active"),
    supabase.from("user_preferences").select("active_organization_id").eq("user_id", userId).maybeSingle(),
  ]);
  if (error) throw toError(error);
  if (!members || members.length === 0) return "/onboarding";
  const stored = prefs?.active_organization_id ?? null;
  if (stored && members.some((member) => member.organization_id === stored)) return "/app/dashboard";
  return members.length === 1 ? "/app/dashboard" : "/organizations/select";
}

export async function updateOrganization(
  _actorId: string,
  organizationId: string,
  input: OrganizationInput
): Promise<Organization> {
  validateInput(input);
  const { data, error } = await supabase
    .from("organizations")
    .update({
      name: input.name.trim(),
      business_type: businessTypeToDb(input.businessType),
      country: input.country,
      currency: input.currency,
      timezone: input.timezone,
    })
    .eq("id", organizationId)
    .select("*");
  if (error) throw toError(error);
  // RLS filters out rows the caller may not change instead of raising, so "nothing updated" means "not allowed".
  if (!data || data.length === 0) throw new Error("Only an Owner or Administrator can update organization settings.");
  return organizationFromRow(data[0]);
}
