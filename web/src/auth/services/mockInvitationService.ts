import { getDatabase, mutateDatabase } from "../mock/store";
import type { Invitation, Membership, Organization, Role, User } from "../lib/types";
import { invitationStatus, isValidEmail } from "../lib/format";
import { assert, makeId, normalizeEmail, simulate } from "./mockApi";
import { appendActivity } from "./mockActivityService";

export interface InvitationWithContext extends Invitation {
  organization: Organization | undefined;
  inviterName: string;
  effectiveStatus: Invitation["status"];
}

function decorate(invitation: Invitation, db: ReturnType<typeof getDatabase>): InvitationWithContext {
  return {
    ...invitation,
    organization: db.organizations.find((org) => org.id === invitation.organizationId),
    inviterName: db.users.find((user) => user.id === invitation.inviterId)?.fullName ?? "Workspace team",
    effectiveStatus: invitationStatus(invitation),
  };
}

export async function listInvitationsForEmail(email: string): Promise<InvitationWithContext[]> {
  return simulate(() => {
    const db = getDatabase();
    return db.invitations
      .filter((invitation) => normalizeEmail(invitation.email) === normalizeEmail(email))
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
      .map((invitation) => decorate(invitation, db));
  }, 420);
}

export async function listInvitationsForOrganization(
  organizationId: string
): Promise<InvitationWithContext[]> {
  return simulate(() => {
    const db = getDatabase();
    return db.invitations
      .filter((invitation) => invitation.organizationId === organizationId)
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
      .map((invitation) => decorate(invitation, db));
  }, 420);
}

function requireManager(
  db: ReturnType<typeof getDatabase>,
  actorId: string,
  organizationId: string
) {
  const membership = db.memberships.find(
    (candidate) =>
      candidate.userId === actorId &&
      candidate.organizationId === organizationId &&
      candidate.status === "active"
  );
  assert(membership, "You do not have access to this organization.");
  assert(
    membership.role === "Owner" || membership.role === "Administrator",
    "Only an Owner or Administrator can manage invitations."
  );
  return membership;
}

export async function createInvitation(input: {
  actorId: string;
  organizationId: string;
  email: string;
  role: Role;
}): Promise<Invitation> {
  const email = normalizeEmail(input.email);
  assert(isValidEmail(email), "Enter a valid email address.");
  assert(input.role !== "Owner", "Owner access cannot be granted by invitation.");
  return simulate(
    () =>
      mutateDatabase((db) => {
        requireManager(db, input.actorId, input.organizationId);
        const organization = db.organizations.find((org) => org.id === input.organizationId);
        assert(organization, "Organization not found.");
        const existingMember = db.memberships.find(
          (membership) =>
            membership.organizationId === input.organizationId &&
            db.users.find((user) => user.id === membership.userId)?.email.toLowerCase() === email
        );
        assert(!existingMember, "That person already belongs to this organization.");
        const duplicate = db.invitations.find(
          (invitation) =>
            invitation.organizationId === input.organizationId &&
            normalizeEmail(invitation.email) === email &&
            invitationStatus(invitation) === "pending"
        );
        assert(!duplicate, "There is already a pending invitation for that email address.");

        const created: Invitation = {
          id: makeId("invitation"),
          token: makeId("inv-tok"),
          organizationId: input.organizationId,
          email,
          role: input.role,
          inviterId: input.actorId,
          status: "pending",
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
        };
        db.invitations.push(created);
        const actor = db.users.find((user) => user.id === input.actorId);
        appendActivity(db, {
          organizationId: input.organizationId,
          actorUserId: input.actorId,
          action: "Invitation sent",
          detail: `${actor?.fullName ?? "A manager"} invited ${email} as ${input.role}.`,
          type: "invitation",
        });
        return created;
      }),
    720
  );
}

export async function acceptInvitation(invitationId: string, user: User): Promise<Organization> {
  return simulate(
    () =>
      mutateDatabase((db) => {
        const invitation = db.invitations.find((candidate) => candidate.id === invitationId);
        assert(invitation, "That invitation could not be found.");
        assert(
          normalizeEmail(invitation.email) === normalizeEmail(user.email),
          "This invitation was issued to a different email address."
        );
        assert(
          invitation.status === "pending",
          invitation.status === "accepted"
            ? "This invitation has already been accepted."
            : invitation.status === "revoked"
              ? "This invitation was revoked by the organization."
              : invitation.status === "declined"
                ? "This invitation was declined."
                : "This invitation has expired."
        );
        assert(
          new Date(invitation.expiresAt).getTime() > Date.now(),
          "This invitation has expired. Ask the organization for a new one."
        );
        const organization = db.organizations.find((org) => org.id === invitation.organizationId);
        assert(organization?.status === "active", "That organization is no longer available.");

        const existing = db.memberships.find(
          (membership) =>
            membership.userId === user.id &&
            membership.organizationId === invitation.organizationId
        );
        if (existing) {
          assert(
            existing.status !== "active",
            "You already have an active membership in this organization."
          );
          throw new Error("Your membership in this organization is suspended. Contact an Owner.");
        }

        const membership: Membership = {
          id: makeId("membership"),
          userId: user.id,
          organizationId: invitation.organizationId,
          role: invitation.role,
          status: "active",
          dateJoined: new Date().toISOString(),
        };
        db.memberships.push(membership);
        invitation.status = "accepted";
        db.activeOrganizationByUser[user.id] = organization.id;
        appendActivity(db, {
          organizationId: organization.id,
          actorUserId: user.id,
          action: "Invitation accepted",
          detail: `${user.fullName} joined as ${invitation.role}.`,
          type: "member",
        });
        return organization;
      }),
    760
  );
}

export async function declineInvitation(invitationId: string, user: User): Promise<void> {
  return simulate(
    () =>
      mutateDatabase((db) => {
        const invitation = db.invitations.find((candidate) => candidate.id === invitationId);
        assert(invitation, "That invitation could not be found.");
        assert(
          normalizeEmail(invitation.email) === normalizeEmail(user.email),
          "This invitation was issued to a different email address."
        );
        assert(invitation.status === "pending", "Only pending invitations can be declined.");
        assert(
          new Date(invitation.expiresAt).getTime() > Date.now(),
          "This invitation has already expired."
        );
        invitation.status = "declined";
        appendActivity(db, {
          organizationId: invitation.organizationId,
          actorUserId: user.id,
          action: "Invitation declined",
          detail: `${user.fullName} declined the invitation to join as ${invitation.role}.`,
          type: "invitation",
        });
      }),
    520
  );
}

export async function revokeInvitation(input: {
  actorId: string;
  organizationId: string;
  invitationId: string;
}): Promise<void> {
  return simulate(
    () =>
      mutateDatabase((db) => {
        requireManager(db, input.actorId, input.organizationId);
        const invitation = db.invitations.find(
          (candidate) =>
            candidate.id === input.invitationId &&
            candidate.organizationId === input.organizationId
        );
        assert(invitation, "Invitation not found.");
        assert(invitation.status === "pending", "Only pending invitations can be revoked.");
        invitation.status = "revoked";
        appendActivity(db, {
          organizationId: input.organizationId,
          actorUserId: input.actorId,
          action: "Invitation revoked",
          detail: `Revoked the invitation for ${invitation.email}.`,
          type: "invitation",
        });
      }),
    520
  );
}

export async function resendInvitation(input: {
  actorId: string;
  organizationId: string;
  invitationId: string;
}): Promise<Invitation> {
  return simulate(
    () =>
      mutateDatabase((db) => {
        requireManager(db, input.actorId, input.organizationId);
        const invitation = db.invitations.find(
          (candidate) =>
            candidate.id === input.invitationId &&
            candidate.organizationId === input.organizationId
        );
        assert(invitation, "Invitation not found.");
        assert(
          invitationStatus(invitation) !== "accepted",
          "Accepted invitations do not need to be resent."
        );
        assert(
          invitation.status !== "revoked",
          "Revoked invitations cannot be resent. Create a new invitation."
        );
        invitation.status = "pending";
        invitation.createdAt = new Date().toISOString();
        invitation.expiresAt = new Date(Date.now() + 7 * 86400000).toISOString();
        appendActivity(db, {
          organizationId: input.organizationId,
          actorUserId: input.actorId,
          action: "Invitation resent",
          detail: `Re-sent the invitation to ${invitation.email}.`,
          type: "invitation",
        });
        return invitation;
      }),
    620
  );
}

