import type { LucideIcon } from "lucide-react";

export type Role =
  | "Owner"
  | "Administrator"
  | "Property Manager"
  | "Accountant"
  | "Maintenance Staff"
  | "Read-Only / Auditor";

export type CategoryId =
  | "general"
  | "financial"
  | "property"
  | "maintenance"
  | "projects"
  | "notifications"
  | "tasks"
  | "workflow"
  | "documents"
  | "security"
  | "data"
  | "personal";

export type CategoryGroup = "workspace" | "operations" | "finance" | "system" | "personal";

export interface Organization {
  id: string;
  name: string;
  shortName: string;
  role: Role;
}

export interface ListItem {
  id: string;
  label: string;
  enabled?: boolean;
}

export interface Member {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: "Active" | "Invited" | "Suspended";
  initials: string;
  avatarTone: string;
  lastActive: string;
}

export interface Invitation {
  id: string;
  email: string;
  role: Role;
  sentAt: string;
  expiresInDays: number;
}

export interface ActivityEvent {
  id: string;
  actor: string;
  actorInitials: string;
  action: string;
  detail?: string;
  at: string;
  category?: CategoryId | "organization-module";
}

export type ToastTone = "success" | "error" | "info";

export interface ToastMessage {
  id: number;
  message: string;
  description?: string;
  tone: ToastTone;
}

export interface UserPreferences {
  theme: "dark" | "light" | "blue";
  landingPage: string;
  language: string;
  tableDensity: "Comfortable" | "Compact" | "Spacious";
  notifications: { email: boolean; desktop: boolean; weeklyDigest: boolean; productUpdates: boolean };
  widgets: { occupancy: boolean; rentCollection: boolean; maintenance: boolean; renewals: boolean };
  reduceMotion: boolean;
}

export interface CategoryDefinition {
  id: CategoryId;
  label: string;
  shortLabel: string;
  description: string;
  group: CategoryGroup;
  icon: LucideIcon;
  scope: "organization" | "user";
  keywords: string[];
}

export interface SearchEntry {
  category: CategoryId;
  label: string;
  anchor: string;
  keywords: string;
}

export type DirectoryTab = "members" | "invitations" | "activity";

export interface PageProps {
  value: any;
  update: (key: string, val: unknown) => void;
  readOnly: boolean;
  errors: Record<string, string>;
  org: Organization;
  prefs?: UserPreferences;
  navigate: (category: CategoryId, anchor?: string) => void;
  openDirectory: (tab: DirectoryTab) => void;
  notify: (message: string, tone?: ToastTone, description?: string) => void;
  activity: ActivityEvent[];
  members: Member[];
}

export type OrgSettings = Record<string, any>;
