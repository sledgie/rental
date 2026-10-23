export const ACTOR_TYPES = ["user", "system", "scheduled_job", "integration"] as const;
export const OUTCOMES = ["success", "failure", "denied", "pending"] as const;
export const SEVERITIES = ["informational", "warning", "critical"] as const;

export const CATEGORIES = [
  "Properties & Units",
  "Tenants & Leases",
  "Accounting & Finance",
  "Maintenance & Repairs",
  "Projects & Renovations",
  "Documents & eSignatures",
  "Communications",
  "Users & Security",
] as const;

export const ACTIONS = [
  "property.created", "property.updated", "property.archived", "property.management_changed",
  "unit.created", "unit.updated", "unit.occupancy_changed", "unit.rent_updated",
  "tenant.created", "tenant.updated", "tenant.assigned", "tenant.moved", "tenant.id_uploaded",
  "lease.created", "lease.uploaded", "lease.updated", "lease.signature_sent", "lease.signed",
  "lease.renewed", "tenancy.activated", "tenancy.ended",
  "invoice.created", "invoice.updated", "invoice.voided", "invoice.paid",
  "payment.recorded", "payment.allocation_changed", "payment.reversed",
  "expense.created", "expense.updated", "vendor_bill.submitted", "vendor_bill.approved",
  "vendor_bill.rejected", "journal.created", "journal.adjusted", "reconciliation.completed",
  "report.generated", "report.exported", "account.allocation_changed",
  "maintenance.submitted", "maintenance.updated", "work_order.assigned", "contractor.assigned",
  "appointment.scheduled", "appointment.rescheduled", "quote.submitted", "repair.approved",
  "work_order.completed", "maintenance.cancelled",
  "project.created", "project.updated", "project.budget_changed", "project.schedule_changed",
  "project.contractor_assigned", "project.expense_recorded", "milestone.completed",
  "project.approved", "project.rejected", "project.cancelled", "project.closed",
  "document.uploaded", "document.replaced", "document.downloaded", "document.shared",
  "document.permissions_changed", "signature.request_created", "signature.request_sent",
  "document.signed", "signature.declined", "document.archived",
  "email_template.created", "email_template.updated", "email_template.activated",
  "email_template.deactivated", "automation.created", "automation.updated", "automation.activated",
  "automation.deactivated", "email.initiated", "sms.initiated", "notification.queued",
  "delivery.failed", "communication.bulk_initiated", "delivery.provider_accepted",
  "delivery.delivered", "delivery.opened",
  "user.invited", "user.activated", "user.deactivated", "user.role_changed",
  "user.permissions_changed", "auth.login_succeeded", "auth.login_failed", "auth.account_locked",
  "auth.password_reset_requested", "auth.password_reset_completed", "security.settings_changed",
  "access.denied", "audit.exported", "audit.settings_changed", "audit.retention_completed",
] as const;

export const ENTITY_TYPES = [
  "property", "unit", "tenant", "lease", "invoice", "payment", "expense", "vendor_bill",
  "journal_entry", "maintenance_request", "work_order", "contractor", "project", "document",
  "signature_request", "email_template", "automation_rule", "message", "user", "report", "audit_export", "audit_policy",
] as const;

export type ActorType = (typeof ACTOR_TYPES)[number];
export type Outcome = (typeof OUTCOMES)[number];
export type Severity = (typeof SEVERITIES)[number];
export type Category = (typeof CATEGORIES)[number];
export type ActivityAction = (typeof ACTIONS)[number];
export type EntityType = (typeof ENTITY_TYPES)[number];

export type ChangeSensitivity = "normal" | "restricted";
export type ChangeKind = "added" | "removed" | "modified";

export type ActivityChange = {
  field: string;
  label: string;
  previousValue: string | null;
  newValue: string | null;
  valueType?: "text" | "currency" | "date" | "datetime" | "number" | "boolean" | "permission";
  changeType: ChangeKind;
  sensitivity?: ChangeSensitivity;
  currency?: string;
};

export type ActivityError = {
  code: string;
  message: string;
  retryable?: boolean;
};

export type ActivityEventDTO = {
  id: string;
  occurredAt: string;
  recordedAt: string;
  actorId: string;
  actorType: ActorType;
  actorDisplayName: string;
  action: ActivityAction;
  category: Category;
  description: string;
  entityType: EntityType;
  entityId: string;
  relatedRecordLabel: string;
  propertyId: string | null;
  propertyName: string | null;
  unitId: string | null;
  unitNumber: string | null;
  tenantId: string | null;
  tenantName: string | null;
  changes: ActivityChange[];
  outcome: Outcome;
  severity: Severity;
  sourceModule: string;
  correlationId: string;
  reason: string | null;
  metadata: Record<string, unknown>;
  error: ActivityError | null;
  previousHash: string | null;
  eventHash: string;
};

export type ActivitySummary = {
  total: number;
  financial: number;
  propertyTenant: number;
  documentLease: number;
  security: number;
  failedDenied: number;
};

export type ActivityFilters = {
  q: string;
  from: string;
  to: string;
  actorId: string;
  actorType: string;
  category: string;
  action: string;
  propertyId: string;
  unitId: string;
  entityType: string;
  entityId: string;
  outcome: string;
  severity: string;
  group: string;
  sort: string;
  direction: "asc" | "desc";
  page: number;
  pageSize: number;
};

export type ActivityFilterOptions = {
  actors: { id: string; name: string; type: ActorType }[];
  properties: { id: string; name: string }[];
  units: { id: string; number: string; propertyId: string; propertyName: string }[];
};

export type ActivityListResponse = {
  items: ActivityEventDTO[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  summary: ActivitySummary;
  options: ActivityFilterOptions;
  sampleData: boolean;
};

export const DEFAULT_FILTERS: ActivityFilters = {
  q: "", from: "", to: "", actorId: "", actorType: "", category: "", action: "",
  propertyId: "", unitId: "", entityType: "", entityId: "", outcome: "", severity: "", group: "",
  sort: "occurredAt", direction: "desc", page: 1, pageSize: 10,
};

export function actionLabel(action: string) {
  return action
    .split(".")
    .map((part) => part.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase()))
    .join(" · ");
}

export function formatActorType(type: string) {
  return ({ user: "User", system: "System", scheduled_job: "Scheduled Job", integration: "Integration" } as Record<string, string>)[type] ?? type;
}
