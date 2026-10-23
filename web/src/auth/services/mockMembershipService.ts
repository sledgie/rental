import { getDatabase, mutateDatabase } from "../mock/store";
import type { Membership, MembershipStatus, Organization, Role, User } from "../lib/types";
import { assert, simulate } from "./mockApi";
import { appendActivity } from "./mockActivityService";

export interface MembershipWithUser {
  membership: Membership;
  user: User;
  isLastActiveOwner: boolean;
}

export interface UserWorkspace {
  organization: Organization;
  membership: Membership;
}

export async function getActiveOrganizationId(userId: string): Promise<string | null> {
  const db = getDatabase();
  const stored = db.activeOrganizationByUser[userId] ?? null;
  if (!stored) return null;
  const valid = db.memberships.some(
    (membership) =>
      membership.userId === userId &&
      membership.organizationId === stored &&
      membership.status === "active"
  );
  return valid ? stored : null;
}

export async function listUserWorkspaces(userId: string): Promise<UserWorkspace[]> {
  return simulate(() => {
    const db = getDatabase();
    return db.memberships
      .filter((membership) => membership.userId === userId && membership.status === "active")
      .map((membership) => ({
        membership,
        organization: db.organizations.find((org) => org.id === membership.organizationId),
      }))
      .filter((row): row is UserWorkspace => Boolean(row.organization?.status === "active"))
      .sort((a, b) => a.organization.name.localeCompare(b.organization.name));
  });
}

export async function listUserSuspendedWorkspaces(userId: string): Promise<UserWorkspace[]> {
  return simulate(() => {
    const db = getDatabase();
    return db.memberships
      .filter((membership) => membership.userId === userId && membership.status === "suspended")
      .map((membership) => ({
        membership,
        organization: db.organizations.find((org) => org.id === membership.organizationId),
      }))
      .filter((row): row is UserWorkspace => Boolean(row.organization));
  }, 200);
}

export async function listOrganizationMembers(organizationId: string): Promise<MembershipWithUser[]> {
  return simulate(() => {
    const db = getDatabase();
    const ownerCount = db.memberships.filter(
      (membership) =>
        membership.organizationId === organizationId &&
        membership.role === "Owner" &&
        membership.status === "active"
    ).length;
    const rank: Record<Role, number> = {
      Owner: 0,
      Administrator: 1,
      "Property Manager": 2,
      Accountant: 3,
      "Maintenance Staff": 4,
      "Read-Only / Auditor": 5,
    };
    return db.memberships
      .filter((membership) => membership.organizationId === organizationId)
      .map((membership) => {
        const user = db.users.find((candidate) => candidate.id === membership.userId);
        return user
          ? {
              membership,
              user,
              isLastActiveOwner:
                membership.role === "Owner" &&
                membership.status === "active" &&
                ownerCount === 1,
            }
          : null;
      })
      .filter((row): row is MembershipWithUser => Boolean(row))
      .sort((a, b) => {
        if (a.membership.status !== b.membership.status) {
          return a.membership.status === "active" ? -1 : 1;
        }
        return rank[a.membership.role] - rank[b.membership.role];
      });
  });
}

export async function switchActiveOrganization(userId: string, organizationId: string): Promise<Organization> {
  return simulate(() => {
    const db = getDatabase();
    const membership = db.memberships.find(
      (candidate) =>
        candidate.userId === userId &&
        candidate.organizationId === organizationId &&
        candidate.status === "active"
    );
    assert(membership, "You do not have active access to that organization.");
    const organization = db.organizations.find(
      (org) => org.id === organizationId && org.status === "active"
    );
    assert(organization, "That organization is not available.");
    mutateDatabase((draft) => {
      draft.activeOrganizationByUser[userId] = organizationId;
    });
    return organization;
  }, 380);
}

function assertManager(
  db: ReturnType<typeof getDatabase>,
  actorId: string,
  organizationId: string
): Membership {
  const membership = db.memberships.find(
    (candidate) =>
      candidate.userId === actorId &&
      candidate.organizationId === organizationId &&
      candidate.status === "active"
  );
  assert(membership, "You do not have access to this organization.");
  assert(
    membership.role === "Owner" || membership.role === "Administrator",
    "Only an Owner or Administrator can manage members."
  );
  return membership;
}

function activeOwnerCount(db: ReturnType<typeof getDatabase>, organizationId: string): number {
  return db.memberships.filter(
    (membership) =>
      membership.organizationId === organizationId &&
      membership.role === "Owner" &&
      membership.status === "active"
  ).length;
}

export async function updateMembershipRole(input: {
  actorId: string;
  organizationId: string;
  membershipId: string;
  role: Role;
  actorName: string;
}): Promise<Membership> {
  assert(input.role !== "Owner", "Use ownership transfer to assign the Owner role.");
  return simulate(
    () =>
      mutateDatabase((db) => {
        const actor = assertManager(db, input.actorId, input.organizationId);
        const target = db.memberships.find(
          (membership) =>
            membership.id === input.membershipId &&
            membership.organizationId === input.organizationId
        );
        assert(target, "Membership not found in this organization.");
        assert(target.userId !== input.actorId, "You cannot change your own role.");
        assert(target.status === "active", "Reactivate this membership before changing its role.");
        if (target.role === "Owner") {
          assert(actor.role === "Owner", "Only an Owner can change another Owner's role.");
          assert(activeOwnerCount(db, input.organizationId) > 1, "Transfer ownership before changing the last Owner's role.");
        }
        const previous = target.role;
        target.role = input.role;
        const targetUser = db.users.find((user) => user.id === target.userId);
        appendActivity(db, {
          organizationId: input.organizationId,
          actorUserId: input.actorId,
          action: "Member role updated",
          detail: `${targetUser?.fullName ?? "A member"} changed from ${previous} to ${input.role}.`,
          type: "member",
        });
        return target;
      }),
    620
  );
}

export async function setMembershipStatus(input: {
  actorId: string;
  organizationId: string;
  membershipId: string;
  status: MembershipStatus;
}): Promise<Membership> {
  return simulate(
    () =>
      mutateDatabase((db) => {
        const actor = assertManager(db, input.actorId, input.organizationId);
        const target = db.memberships.find(
          (membership) =>
            membership.id === input.membershipId &&
            membership.organizationId === input.organizationId
        );
        assert(target, "Membership not found in this organization.");
        assert(target.userId !== input.actorId, "You cannot suspend your own membership.");
        if (target.role === "Owner") {
          assert(actor.role === "Owner", "Only an Owner can suspend another Owner.");
          assert(activeOwnerCount(db, input.organizationId) > 1, "Transfer ownership before suspending the last Owner.");
        }
        target.status = input.status;
        if (input.status === "suspended") {
          const org = db.organizations.find((organization) => organization.id === input.organizationId);
          if (db.activeOrganizationByUser[target.userId] === input.organizationId) {
            db.activeOrganizationByUser[target.userId] = null;
          }
          const targetUser = db.users.find((user) => user.id === target.userId);
          appendActivity(db, {
            organizationId: input.organizationId,
            actorUserId: input.actorId,
            action: "Membership suspended",
            detail: `${targetUser?.fullName ?? "A member"} lost access to ${org?.name ?? "the organization"}.`,
            type: "member",
          });
        } else {
          const targetUser = db.users.find((user) => user.id === target.userId);
          appendActivity(db, {
            organizationId: input.organizationId,
            actorUserId: input.actorId,
            action: "Membership reactivated",
            detail: `${targetUser?.fullName ?? "A member"} regained access as ${target.role}.`,
            type: "member",
          });
        }
        return target;
      }),
    620
  );
}

export async function removeMembership(input: {
  actorId: string;
  organizationId: string;
  membershipId: string;
}): Promise<void> {
  return simulate(
    () =>
      mutateDatabase((db) => {
        const actor = assertManager(db, input.actorId, input.organizationId);
        const target = db.memberships.find(
          (membership) =>
            membership.id === input.membershipId &&
            membership.organizationId === input.organizationId
        );
        assert(target, "Membership not found in this organization.");
        assert(target.userId !== input.actorId, "You cannot remove your own membership.");
        if (target.role === "Owner") {
          assert(actor.role === "Owner", "Only an Owner can remove another Owner.");
          assert(activeOwnerCount(db, input.organizationId) > 1, "Transfer ownership before removing the last Owner.");
        }
        const targetUser = db.users.find((user) => user.id === target.userId);
        db.memberships = db.memberships.filter((membership) => membership.id !== target.id);
        if (db.activeOrganizationByUser[target.userId] === input.organizationId) {
          db.activeOrganizationByUser[target.userId] = null;
        }
        appendActivity(db, {
          organizationId: input.organizationId,
          actorUserId: input.actorId,
          action: "Member removed",
          detail: `${targetUser?.fullName ?? "A member"} was removed from the organization.`,
          type: "member",
        });
      }),
    620
  );
}

export async function transferOwnership(input: {
  actorId: string;
  organizationId: string;
  membershipId: string;
}): Promise<void> {
  return simulate(
    () =>
      mutateDatabase((db) => {
        const actor = db.memberships.find(
          (membership) =>
            membership.userId === input.actorId &&
            membership.organizationId === input.organizationId &&
            membership.status === "active"
        );
        assert(actor?.role === "Owner", "Only the current Owner can transfer ownership.");
        const target = db.memberships.find(
          (membership) =>
            membership.id === input.membershipId &&
            membership.organizationId === input.organizationId
        );
        assert(target, "Membership not found in this organization.");
        assert(target.userId !== input.actorId, "You already own this organization.");
        assert(target.status === "active", "Choose an active member to become the new Owner.");
        assert(target.role !== "Owner", "That member is already an Owner.");

        target.role = "Owner";
        actor.role = "Administrator";
        const actorUser = db.users.find((user) => user.id === actor.userId);
        const targetUser = db.users.find((user) => user.id === target.userId);
        appendActivity(db, {
          organizationId: input.organizationId,
          actorUserId: input.actorId,
          action: "Ownership transferred",
          detail: `${actorUser?.fullName ?? "Owner"} transferred ownership to ${targetUser?.fullName ?? "a member"}.`,
          type: "organization",
        });
      }),
    760
  );
}

