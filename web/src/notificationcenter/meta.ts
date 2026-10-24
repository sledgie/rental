import {
  AlertTriangle, Building2, CalendarClock, CircleDollarSign, ClipboardList, FileSignature, FileText, Landmark, MessageSquareWarning, Receipt, ShieldCheck, Users, Wrench,
  type LucideIcon,
} from "lucide-react";
import type { Category, Severity } from "./types";

export const CATEGORY_META: Record<Category, { label: string; short: string; icon: LucideIcon; tone: string; description: string }> = {
  financial: { label: "Financial", short: "Financial", icon: CircleDollarSign, tone: "bg-u-ok-soft text-u-ok", description: "Overdue and upcoming rent and invoices, payments recorded or reversed." },
  properties_leases: { label: "Properties & Leases", short: "Leases", icon: Building2, tone: "bg-u-accent-soft text-u-accent", description: "New applications and leases that are about to end." },
  maintenance_projects: { label: "Maintenance & Projects", short: "Maintenance", icon: Wrench, tone: "bg-u-warn-soft text-u-warn", description: "Urgent and assigned requests, work orders past their target date." },
  tasks: { label: "Tasks & Reminders", short: "Tasks", icon: ClipboardList, tone: "bg-u-accent-soft text-u-accent", description: "Reminders you asked for on scheduled tasks." },
  team_organization: { label: "Team & Organization", short: "Team", icon: Users, tone: "bg-u-blue-soft text-u-blue", description: "New members, role changes, suspensions and expired invitations." },
  communications_documents: { label: "Communications & Documents", short: "Comms", icon: FileText, tone: "bg-u-blue-soft text-u-blue", description: "Messages that failed to send and conversations that need you." },
  system: { label: "System", short: "System", icon: ShieldCheck, tone: "bg-u-danger-soft text-u-danger", description: "Problems with integrations or the platform." },
};

export const SEVERITY_META: Record<Severity, { label: string; description: string; badge: string; bar: string; weight: number }> = {
  critical: { label: "Critical", description: "Serious incident requiring immediate attention", badge: "bg-u-danger-soft text-u-danger", bar: "bg-u-danger", weight: 3 },
  high: { label: "High", description: "Time-sensitive operational or financial issue", badge: "bg-u-warn-soft text-u-warn", bar: "bg-u-warn", weight: 2 },
  normal: { label: "Normal", description: "Routine task, reminder, or meaningful business update", badge: "bg-u-accent-soft text-u-accent", bar: "bg-u-accent", weight: 1 },
  informational: { label: "Informational", description: "Non-urgent status update", badge: "bg-u-s3 text-u-ink2", bar: "bg-u-s3", weight: 0 },
};

/** Finer icons for the events the database produces (and a few the module defined for later). */
const EVENT_ICONS: Record<string, LucideIcon> = {
  rent_payment_overdue: Receipt, invoice_overdue: Receipt, invoice_due_soon: Receipt, rent_payment_recorded: CircleDollarSign, payment_reversed: AlertTriangle,
  payment_operation_failed: AlertTriangle, bank_reconciliation_attention: Landmark, lease_expiring: FileSignature, application_received: FileSignature,
  maintenance_request_urgent: AlertTriangle, maintenance_request_assigned: Wrench, work_order_overdue: AlertTriangle, work_order_deadline: Wrench,
  task_reminder: CalendarClock, invitation_accepted: Users, invitation_expired: Users, role_changed: Users, user_access_suspended: ShieldCheck,
  sms_delivery_failed: MessageSquareWarning, message_delivery_failed: MessageSquareWarning, integration_failed: AlertTriangle,
};

export const notificationIcon = (category: Category, eventType: string): LucideIcon => EVENT_ICONS[eventType] ?? CATEGORY_META[category].icon;
