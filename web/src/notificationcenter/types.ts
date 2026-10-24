// Notification Center types. Rows come from public.notifications (migration 023); the database decides who receives what, this file only describes it.

export type Category = "financial" | "properties_leases" | "maintenance_projects" | "team_organization" | "communications_documents" | "tasks" | "system";
export type Severity = "critical" | "high" | "normal" | "informational";

export interface AppNotification {
  id: string;
  organizationId: string;
  category: Category;
  severity: Severity;
  /** Granular event, e.g. rent_payment_overdue (the notification_type column). */
  eventType: string;
  title: string;
  message: string;
  entityType: string | null;
  entityId: string | null;
  propertyId: string | null;
  propertyName: string | null;
  actionLabel: string | null;
  /** A hash route such as #/payments?payment=… */
  actionRoute: string | null;
  actionRequired: boolean;
  createdAt: string;
  readAt: string | null;
  snoozedUntil: string | null;
  expiresAt: string | null;
}

export type Quick = "all" | "unread" | "action" | "high";

export interface Filters {
  query: string;
  quick: Quick;
  category: Category | "";
  severity: Severity | "";
  read: "" | "unread" | "read";
  propertyId: string;
  /** yyyy-mm-dd, local dates */
  from: string;
  to: string;
}

export const EMPTY_FILTERS: Filters = { query: "", quick: "all", category: "", severity: "", read: "", propertyId: "", from: "", to: "" };

export const CATEGORY_ORDER: Category[] = ["financial", "properties_leases", "maintenance_projects", "tasks", "team_organization", "communications_documents", "system"];
export const SEVERITY_ORDER: Severity[] = ["informational", "normal", "high", "critical"];

export interface Preference { enabled: boolean; minimumSeverity: Severity }
export type Preferences = Record<Category, Preference>;

/** What a category requires when the member has not chosen anything. Must match private.notification_default_minimum in migration 023. */
export const DEFAULT_MINIMUM: Record<Category, Severity> = {
  financial: "informational", properties_leases: "informational", maintenance_projects: "normal", tasks: "informational",
  team_organization: "informational", communications_documents: "normal", system: "high",
};

export const defaultPreferences = (): Preferences =>
  Object.fromEntries(CATEGORY_ORDER.map((c) => [c, { enabled: true, minimumSeverity: DEFAULT_MINIMUM[c] }])) as Preferences;
