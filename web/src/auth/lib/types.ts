/**
 * Shared domain types for the Rentflow prototype.
 * The UI depends on these types, not on the mock storage implementation.
 */

export type UserStatus = "active" | "inactive";

export interface User {
  id: string;
  fullName: string;
  email: string;
  password: string;
  status: UserStatus;
  emailVerified: boolean;
  createdAt: string;
}

export type BusinessType =
  | "Individual Landlord"
  | "Property Management Company"
  | "Real Estate Business"
  | "Other";

export type OrganizationStatus = "active" | "inactive";

export interface Organization {
  id: string;
  name: string;
  businessType: BusinessType;
  country: string;
  currency: string;
  timezone: string;
  status: OrganizationStatus;
  createdAt: string;
  plan: "Starter" | "Growth" | "Scale";
}

export type Role =
  | "Owner"
  | "Administrator"
  | "Property Manager"
  | "Accountant"
  | "Maintenance Staff"
  | "Read-Only / Auditor";

export type MembershipStatus = "active" | "suspended";

export interface Membership {
  id: string;
  userId: string;
  organizationId: string;
  role: Role;
  status: MembershipStatus;
  dateJoined: string;
}

export type InvitationStatus = "pending" | "accepted" | "declined" | "expired" | "revoked";

export interface Invitation {
  id: string;
  token: string;
  organizationId: string;
  email: string;
  role: Role;
  inviterId: string;
  status: InvitationStatus;
  createdAt: string;
  expiresAt: string;
}

export type ActivityType =
  | "organization"
  | "member"
  | "invitation"
  | "billing"
  | "property"
  | "auth";

export interface ActivityLog {
  id: string;
  organizationId: string;
  actorUserId: string;
  action: string;
  detail: string;
  type: ActivityType;
  createdAt: string;
}

export interface MockDatabase {
  users: User[];
  organizations: Organization[];
  memberships: Membership[];
  invitations: Invitation[];
  activityLogs: ActivityLog[];
  activeOrganizationByUser: Record<string, string | null>;
}

export interface SignUpInput {
  fullName: string;
  email: string;
  password: string;
}

export interface OrganizationInput {
  name: string;
  businessType: BusinessType;
  country: string;
  currency: string;
  timezone: string;
}

