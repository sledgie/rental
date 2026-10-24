import type {
  ActivityType,
  BusinessType,
  Membership,
  Organization,
  Role,
  User,
} from "../lib/types";

/** The database stores snake_case slugs; the UI uses display labels. */
const ROLE_TO_DB: Record<Role, string> = {
  Owner: "owner",
  Administrator: "administrator",
  "Property Manager": "property_manager",
  Accountant: "accountant",
  "Maintenance Staff": "maintenance_staff",
  "Read-Only / Auditor": "read_only",
};
const ROLE_FROM_DB = Object.fromEntries(
  Object.entries(ROLE_TO_DB).map(([label, slug]) => [slug, label])
) as Record<string, Role>;

const BUSINESS_TO_DB: Record<BusinessType, string> = {
  "Individual Landlord": "individual_landlord",
  "Property Management Company": "property_management_company",
  "Real Estate Business": "real_estate_business",
  Other: "other",
};
const BUSINESS_FROM_DB = Object.fromEntries(
  Object.entries(BUSINESS_TO_DB).map(([label, slug]) => [slug, label])
) as Record<string, BusinessType>;

export const roleToDb = (role: Role): string => ROLE_TO_DB[role];
export const roleFromDb = (slug: string): Role => ROLE_FROM_DB[slug] ?? "Read-Only / Auditor";
export const businessTypeToDb = (type: BusinessType): string => BUSINESS_TO_DB[type];

/* eslint-disable @typescript-eslint/no-explicit-any -- rows come from untyped PostgREST responses */
export function organizationFromRow(row: any): Organization {
  const plan = String(row.plan);
  return {
    id: row.id,
    name: row.name,
    businessType: BUSINESS_FROM_DB[row.business_type] ?? "Other",
    country: row.country,
    currency: String(row.currency).trim(),
    timezone: row.timezone,
    status: row.status,
    createdAt: row.created_at,
    plan: (plan.charAt(0).toUpperCase() + plan.slice(1)) as Organization["plan"],
  };
}

export function membershipFromRow(row: any): Membership {
  return {
    id: row.id,
    userId: row.user_id,
    organizationId: row.organization_id,
    role: roleFromDb(row.role),
    status: row.status,
    dateJoined: row.joined_at,
  };
}

export function userFromProfile(profile: any, extra?: { emailVerified?: boolean }): User {
  return {
    id: profile.id,
    fullName: profile.full_name || profile.email || "Unknown user",
    email: profile.email ?? "",
    password: "", // credentials never reach the browser
    status: profile.status === "active" ? "active" : "inactive",
    emailVerified: extra?.emailVerified ?? true,
    createdAt: profile.created_at,
    phone: profile.phone ?? "",
    jobTitle: profile.job_title ?? "",
    avatarPath: profile.avatar_path ?? "",
  };
}

/** The audit trail is organized by category/entity; the Activity Logs page groups by these five types. */
export function activityTypeFromEvent(event: { action: string; entity_type: string }): ActivityType {
  if (event.action.startsWith("invitation.") || event.entity_type === "invitation") return "invitation";
  if (event.action.startsWith("user.") || event.entity_type === "user") return "member";
  if (event.entity_type === "organization" || event.action.startsWith("security.")) return "organization";
  if (event.entity_type === "property" || event.entity_type === "unit") return "property";
  if (event.action.startsWith("auth.")) return "auth";
  return "organization";
}

/** "user.role_changed" -> "User role changed" */
export function humanizeAction(action: string): string {
  const text = action.replace(/[._]/g, " ").trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}
