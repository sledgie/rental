import { supabase, toError } from "../../lib/supabase";
import type { Membership, MembershipStatus, Organization, Role } from "../lib/types";
import type { MembershipWithUser, UserWorkspace } from "./mockMembershipService";
import { membershipFromRow, organizationFromRow, roleFromDb, roleToDb, userFromProfile } from "./supabaseMappers";

/* eslint-disable @typescript-eslint/no-explicit-any -- rows come from untyped PostgREST responses */

export async function getActiveOrganizationId(userId: string): Promise<string | null> {
  const { data } = await supabase
    .from("user_preferences")
    .select("active_organization_id")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.active_organization_id ?? null;
}

export async function listUserWorkspaces(userId: string): Promise<UserWorkspace[]> {
  const { data, error } = await supabase
    .from("organization_members")
    .select("*, organizations(*)")
    .eq("user_id", userId)
    .eq("status", "active");
  if (error) throw toError(error);
  return (data ?? [])
    .filter((row: any) => row.organizations?.status === "active")
    .map((row: any) => ({ membership: membershipFromRow(row), organization: organizationFromRow(row.organizations) }))
    .sort((a, b) => a.organization.name.localeCompare(b.organization.name));
}

/** RLS hides an organization from a suspended member, so the names come from a small SECURITY DEFINER RPC (migration 012). */
export async function listUserSuspendedWorkspaces(userId: string): Promise<UserWorkspace[]> {
  const { data, error } = await supabase.rpc("list_my_suspended_workspaces");
  if (error) throw toError(error);
  return (data ?? []).map((row: any) => ({
    membership: {
      id: row.membership_id,
      userId,
      organizationId: row.organization_id,
      role: roleFromDb(row.role),
      status: "suspended" as MembershipStatus,
      dateJoined: row.joined_at,
    },
    organization: {
      id: row.organization_id,
      name: row.organization_name,
      businessType: "Other",
      country: "",
      currency: "",
      timezone: "",
      status: "active",
      createdAt: row.joined_at,
      plan: "Starter",
    } as Organization,
  }));
}

export async function listOrganizationMembers(organizationId: string): Promise<MembershipWithUser[]> {
  const { data: members, error } = await supabase
    .from("organization_members")
    .select("*")
    .eq("organization_id", organizationId);
  if (error) throw toError(error);
  const ids = (members ?? []).map((member: any) => member.user_id);
  const { data: profiles, error: profileError } = ids.length
    ? await supabase.from("profiles").select("*").in("id", ids)
    : { data: [], error: null };
  if (profileError) throw toError(profileError);

  const byId = new Map((profiles ?? []).map((profile: any) => [profile.id, profile]));
  const ownerCount = (members ?? []).filter((m: any) => m.role === "owner" && m.status === "active").length;
  const rank: Record<Role, number> = {
    Owner: 0,
    Administrator: 1,
    "Property Manager": 2,
    Accountant: 3,
    "Maintenance Staff": 4,
    "Read-Only / Auditor": 5,
  };
  return (members ?? [])
    .filter((member: any) => byId.has(member.user_id))
    .map((member: any) => {
      const membership = membershipFromRow(member);
      return {
        membership,
        user: userFromProfile(byId.get(member.user_id)),
        isLastActiveOwner: membership.role === "Owner" && membership.status === "active" && ownerCount === 1,
      };
    })
    .sort((a, b) => {
      if (a.membership.status !== b.membership.status) return a.membership.status === "active" ? -1 : 1;
      return rank[a.membership.role] - rank[b.membership.role];
    });
}

export async function switchActiveOrganization(_userId: string, organizationId: string): Promise<Organization> {
  const { error } = await supabase.rpc("switch_active_organization", { p_org: organizationId });
  if (error) throw new Error("You do not have active access to that organization.");
  const { data, error: readError } = await supabase.from("organizations").select("*").eq("id", organizationId).single();
  if (readError) throw toError(readError);
  if (data.status !== "active") throw new Error("That organization is not available.");
  return organizationFromRow(data);
}

async function loadTarget(organizationId: string, membershipId: string): Promise<any> {
  const { data, error } = await supabase
    .from("organization_members")
    .select("*")
    .eq("id", membershipId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error) throw toError(error);
  if (!data) throw new Error("Membership not found in this organization.");
  return data;
}

/** RLS answers "may the caller change this row"; an update that touches no rows means the answer was no. */
async function updateMember(organizationId: string, membershipId: string, patch: Record<string, string>): Promise<Membership> {
  const { data, error } = await supabase
    .from("organization_members")
    .update(patch)
    .eq("id", membershipId)
    .eq("organization_id", organizationId)
    .select("*");
  if (error) throw toError(error);
  if (!data || data.length === 0) throw new Error("Only an Owner or Administrator can manage members.");
  return membershipFromRow(data[0]);
}

export async function updateMembershipRole(input: {
  actorId: string;
  organizationId: string;
  membershipId: string;
  role: Role;
  actorName: string;
}): Promise<Membership> {
  if (input.role === "Owner") throw new Error("Use ownership transfer to assign the Owner role.");
  const target = await loadTarget(input.organizationId, input.membershipId);
  if (target.user_id === input.actorId) throw new Error("You cannot change your own role.");
  if (target.status !== "active") throw new Error("Reactivate this membership before changing its role.");
  return updateMember(input.organizationId, input.membershipId, { role: roleToDb(input.role) });
}

export async function setMembershipStatus(input: {
  actorId: string;
  organizationId: string;
  membershipId: string;
  status: MembershipStatus;
}): Promise<Membership> {
  const target = await loadTarget(input.organizationId, input.membershipId);
  if (target.user_id === input.actorId) throw new Error("You cannot suspend your own membership.");
  return updateMember(input.organizationId, input.membershipId, { status: input.status });
}

export async function removeMembership(input: {
  actorId: string;
  organizationId: string;
  membershipId: string;
}): Promise<void> {
  const target = await loadTarget(input.organizationId, input.membershipId);
  if (target.user_id === input.actorId) throw new Error("You cannot remove your own membership.");
  const { data, error } = await supabase
    .from("organization_members")
    .delete()
    .eq("id", input.membershipId)
    .eq("organization_id", input.organizationId)
    .select("id");
  if (error) throw toError(error);
  if (!data || data.length === 0) throw new Error("Only an Owner or Administrator can manage members.");
}

export async function transferOwnership(input: {
  actorId: string;
  organizationId: string;
  membershipId: string;
}): Promise<void> {
  const target = await loadTarget(input.organizationId, input.membershipId);
  if (target.user_id === input.actorId) throw new Error("You already own this organization.");
  if (target.status !== "active") throw new Error("Choose an active member to become the new Owner.");
  if (target.role === "owner") throw new Error("That member is already an Owner.");
  const { error } = await supabase.rpc("transfer_ownership", {
    p_org: input.organizationId,
    p_new_owner: target.user_id,
  });
  if (error) throw toError(error);
}
