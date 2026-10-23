import { supabase, toError } from "../../lib/supabase";
import type { Invitation, Organization, Role, User } from "../lib/types";
import { invitationStatus, isValidEmail } from "../lib/format";
import type { InvitationWithContext } from "./mockInvitationService";
import { organizationFromRow, roleFromDb, roleToDb } from "./supabaseMappers";

/* eslint-disable @typescript-eslint/no-explicit-any -- rows come from untyped PostgREST responses */

const INVITATION_DAYS = 7;

function toInvitation(row: any): Invitation {
  return {
    id: row.id,
    token: "", // only a hash is stored; the raw token is never exposed
    organizationId: row.organization_id,
    email: row.email,
    role: roleFromDb(row.role),
    inviterId: row.invited_by ?? "",
    status: row.status,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  };
}

/** Invitations addressed to the caller. Organization and inviter names come from an RPC because RLS hides non-member organizations. */
export async function listInvitationsForEmail(_email: string): Promise<InvitationWithContext[]> {
  const { data, error } = await supabase.rpc("list_my_invitations");
  if (error) throw toError(error);
  return (data ?? []).map((row: any) => {
    const invitation = toInvitation(row);
    return {
      ...invitation,
      organization: {
        id: row.organization_id,
        name: row.organization_name,
        businessType: "Other",
        country: "",
        currency: "",
        timezone: "",
        status: row.organization_status,
        createdAt: row.created_at,
        plan: "Starter",
      } as Organization,
      inviterName: row.inviter_name,
      effectiveStatus: invitationStatus(invitation),
    };
  });
}

export async function listInvitationsForOrganization(organizationId: string): Promise<InvitationWithContext[]> {
  const [{ data: rows, error }, { data: org }] = await Promise.all([
    supabase
      .from("organization_invitations")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false }),
    supabase.from("organizations").select("*").eq("id", organizationId).maybeSingle(),
  ]);
  if (error) throw toError(error);
  const inviterIds = [...new Set((rows ?? []).map((row: any) => row.invited_by).filter(Boolean))];
  const { data: profiles } = inviterIds.length
    ? await supabase.from("profiles").select("id, full_name, email").in("id", inviterIds)
    : { data: [] };
  const names = new Map((profiles ?? []).map((p: any) => [p.id, p.full_name || p.email]));
  const organization = org ? organizationFromRow(org) : undefined;
  return (rows ?? []).map((row: any) => {
    const invitation = toInvitation(row);
    return {
      ...invitation,
      organization,
      inviterName: names.get(row.invited_by) ?? "Workspace team",
      effectiveStatus: invitationStatus(invitation),
    };
  });
}

/**
 * Creates the invitation row. NOTE: no email is sent. The invitee signs up (or signs in) with this exact
 * address and finds the invitation waiting on the onboarding screen.
 */
export async function createInvitation(input: {
  actorId: string;
  organizationId: string;
  email: string;
  role: Role;
}): Promise<Invitation> {
  const email = input.email.trim().toLowerCase();
  if (!isValidEmail(email)) throw new Error("Enter a valid email address.");
  if (input.role === "Owner") throw new Error("Owner access cannot be granted by invitation.");

  // Already a member? Co-members' profiles are readable, so compare against them.
  const { data: members } = await supabase
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", input.organizationId);
  const memberIds = (members ?? []).map((member: any) => member.user_id);
  if (memberIds.length) {
    const { data: match } = await supabase.from("profiles").select("id").in("id", memberIds).ilike("email", email).limit(1);
    if (match && match.length) throw new Error("That person already belongs to this organization.");
  }

  const { data, error } = await supabase
    .from("organization_invitations")
    .insert({
      organization_id: input.organizationId,
      email,
      role: roleToDb(input.role),
      invited_by: input.actorId,
      expires_at: new Date(Date.now() + INVITATION_DAYS * 86400000).toISOString(),
    })
    .select("*")
    .single();
  if (error) {
    if (error.code === "23505") throw new Error("There is already a pending invitation for that email address.");
    throw toError(error);
  }
  return toInvitation(data);
}

export async function acceptInvitation(invitationId: string, _user: User): Promise<Organization> {
  const { data: organizationId, error } = await supabase.rpc("accept_invitation", { p_invitation: invitationId });
  if (error) {
    if (/expired/i.test(error.message)) throw new Error("This invitation has expired. Ask the organization for a new one.");
    if (/not found/i.test(error.message)) throw new Error("This invitation was issued to a different email address or no longer exists.");
    if (/is (accepted|declined|revoked)/i.test(error.message)) throw new Error(`This invitation is no longer pending (${error.message.split(" ").pop()}).`);
    throw toError(error);
  }
  const { data, error: readError } = await supabase.from("organizations").select("*").eq("id", organizationId).single();
  if (readError) throw toError(readError);
  return organizationFromRow(data);
}

export async function declineInvitation(invitationId: string, _user: User): Promise<void> {
  const { error } = await supabase.rpc("decline_invitation", { p_invitation: invitationId });
  if (error) throw new Error("Only pending invitations addressed to you can be declined.");
}

export async function revokeInvitation(input: {
  actorId: string;
  organizationId: string;
  invitationId: string;
}): Promise<void> {
  const { data, error } = await supabase
    .from("organization_invitations")
    .update({ status: "revoked", responded_at: new Date().toISOString() })
    .eq("id", input.invitationId)
    .eq("organization_id", input.organizationId)
    .eq("status", "pending")
    .select("id");
  if (error) throw toError(error);
  if (!data || data.length === 0) throw new Error("Only pending invitations can be revoked.");
}

export async function resendInvitation(input: {
  actorId: string;
  organizationId: string;
  invitationId: string;
}): Promise<Invitation> {
  const { data: current, error: readError } = await supabase
    .from("organization_invitations")
    .select("*")
    .eq("id", input.invitationId)
    .eq("organization_id", input.organizationId)
    .maybeSingle();
  if (readError) throw toError(readError);
  if (!current) throw new Error("Invitation not found.");
  if (current.status === "accepted") throw new Error("Accepted invitations do not need to be resent.");
  if (current.status === "revoked") throw new Error("Revoked invitations cannot be resent. Create a new invitation.");

  const { data, error } = await supabase
    .from("organization_invitations")
    .update({
      status: "pending",
      responded_at: null,
      resend_count: current.resend_count + 1,
      expires_at: new Date(Date.now() + INVITATION_DAYS * 86400000).toISOString(),
    })
    .eq("id", input.invitationId)
    .eq("organization_id", input.organizationId)
    .select("*");
  if (error) {
    if (error.code === "23505") throw new Error("There is already a pending invitation for that email address.");
    throw toError(error);
  }
  if (!data || data.length === 0) throw new Error("Only an Owner or Administrator can manage invitations.");
  return toInvitation(data[0]);
}
