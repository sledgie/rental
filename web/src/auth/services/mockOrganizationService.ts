import { getDatabase, mutateDatabase } from "../mock/store";
import type { Membership, Organization, OrganizationInput } from "../lib/types";
import { assert, makeId, simulate } from "./mockApi";
import { appendActivity } from "./mockActivityService";

function validateInput(input: OrganizationInput) {
  assert(input.name.trim().length >= 2, "Organization name must be at least 2 characters.");
  assert(input.name.trim().length <= 60, "Organization name must be 60 characters or fewer.");
  assert(!!input.businessType, "Choose a business type.");
  assert(!!input.country, "Choose a country.");
  assert(!!input.currency, "Choose a default currency.");
  assert(!!input.timezone, "Choose a time zone.");
}

/**
 * Creates the organization, the Owner membership, the active-workspace pointer
 * and the first activity entry in a single persisted mutation. If validation or
 * persistence fails, nothing is written.
 */
export async function createOrganizationWithOwner(
  actorId: string,
  input: OrganizationInput
): Promise<Organization> {
  validateInput(input);
  return simulate(
    () =>
      mutateDatabase((db) => {
        const actor = db.users.find((user) => user.id === actorId);
        assert(actor, "Your session has expired. Please sign in again.");

        const organization: Organization = {
          id: makeId("org"),
          name: input.name.trim(),
          businessType: input.businessType,
          country: input.country,
          currency: input.currency,
          timezone: input.timezone,
          status: "active",
          createdAt: new Date().toISOString(),
          plan: "Starter",
        };
        const membership: Membership = {
          id: makeId("membership"),
          userId: actor.id,
          organizationId: organization.id,
          role: "Owner",
          status: "active",
          dateJoined: new Date().toISOString(),
        };

        db.organizations.push(organization);
        db.memberships.push(membership);
        db.activeOrganizationByUser[actor.id] = organization.id;
        appendActivity(db, {
          organizationId: organization.id,
          actorUserId: actor.id,
          action: "Organization created",
          detail: `${actor.fullName} created ${organization.name} and became Owner.`,
          type: "organization",
        });
        return organization;
      }),
    900
  );
}

export async function resolveEntryRoute(userId: string): Promise<string> {
  return simulate(() => {
    const db = getDatabase();
    const activeMemberships = db.memberships.filter(
      (membership) => membership.userId === userId && membership.status === "active"
    );
    if (activeMemberships.length === 0) return "/onboarding";

    const stored = db.activeOrganizationByUser[userId] ?? null;
    if (stored && activeMemberships.some((membership) => membership.organizationId === stored)) {
      return "/app/dashboard";
    }
    if (activeMemberships.length === 1) return "/app/dashboard";
    return "/organizations/select";
  }, 220);
}

export async function updateOrganization(
  actorId: string,
  organizationId: string,
  input: OrganizationInput
): Promise<Organization> {
  validateInput(input);
  return simulate(
    () =>
      mutateDatabase((db) => {
        const actorMembership = db.memberships.find(
          (membership) =>
            membership.userId === actorId &&
            membership.organizationId === organizationId &&
            membership.status === "active"
        );
        assert(actorMembership, "You do not have access to this organization.");
        assert(
          actorMembership.role === "Owner" || actorMembership.role === "Administrator",
          "Only an Owner or Administrator can update organization settings."
        );
        const organization = db.organizations.find((org) => org.id === organizationId);
        assert(organization, "Organization not found.");

        const changed: string[] = [];
        if (organization.name !== input.name.trim()) changed.push("name");
        if (organization.businessType !== input.businessType) changed.push("business type");
        if (organization.country !== input.country) changed.push("country");
        if (organization.currency !== input.currency) changed.push("currency");
        if (organization.timezone !== input.timezone) changed.push("time zone");

        organization.name = input.name.trim();
        organization.businessType = input.businessType;
        organization.country = input.country;
        organization.currency = input.currency;
        organization.timezone = input.timezone;

        appendActivity(db, {
          organizationId,
          actorUserId: actorId,
          action: "Organization settings updated",
          detail: changed.length
            ? `Updated ${changed.join(", ")}.`
            : "Saved organization profile without changes.",
          type: "organization",
        });
        return organization;
      }),
    700
  );
}

