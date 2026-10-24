// Scheduled Tasks: the shapes the screens use. Rows are mapped from snake_case database columns in repo.ts.
export type Priority = "low" | "normal" | "high" | "urgent";
export type Status = "not_started" | "in_progress" | "blocked" | "completed" | "cancelled";
export type Frequency = "daily" | "weekly" | "monthly" | "quarterly" | "yearly" | "custom";
export type SeriesStatus = "active" | "paused" | "cancelled" | "completed";

export const PRIORITIES: { value: Priority; label: string }[] = [
  { value: "low", label: "Low" }, { value: "normal", label: "Normal" }, { value: "high", label: "High" }, { value: "urgent", label: "Urgent" },
];
export const STATUSES: { value: Status; label: string }[] = [
  { value: "not_started", label: "Not started" }, { value: "in_progress", label: "In progress" }, { value: "blocked", label: "Blocked" },
  { value: "completed", label: "Completed" }, { value: "cancelled", label: "Cancelled" },
];
export const priorityLabel = (p: string) => PRIORITIES.find((x) => x.value === p)?.label ?? p;
export const statusLabel = (s: string) => STATUSES.find((x) => x.value === s)?.label ?? s;
export const isOpen = (s: string) => s !== "completed" && s !== "cancelled";

export interface Reminder { enabled: boolean; daysBefore: number[]; channels: string[] }

export interface Task {
  id: string;
  ref: string;
  title: string;
  description: string;
  categoryId: string | null;
  priority: Priority;
  status: Status;
  propertyId: string | null;
  unitId: string | null;
  tenantId: string | null;
  leaseId: string | null;
  maintenanceRequestId: string | null;
  vendorId: string | null;
  projectId: string | null;
  assigneeId: string | null;
  collaboratorIds: string[];
  startDate: string | null;
  dueDate: string | null;
  dueTime: string | null;
  timezone: string;
  isRecurring: boolean;
  recurrenceId: string | null;
  occurrenceDate: string | null;
  completionNotes: string;
  completedAt: string | null;
  completedBy: string | null;
  cancelledAt: string | null;
  cancelReason: string;
  reminder: Reminder;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Category { id: string; name: string; slug: string; color: string; icon: string; isSystem: boolean; isActive: boolean }

export interface Series {
  id: string;
  title: string;
  frequency: Frequency;
  interval: number;
  daysOfWeek: number[];
  monthDay: number | null;
  monthWeek: number | null;
  monthWeekday: number | null;
  startDate: string;
  endDate: string | null;
  timezone: string;
  status: SeriesStatus;
  nextOccurrenceDate: string | null;
  lastGeneratedDate: string | null;
}

export interface Person { id: string; name: string; role: string }
export interface Named { id: string; name: string }
export interface Lookups {
  properties: Named[];
  units: (Named & { propertyId: string })[];
  tenants: Named[];
  leases: Named[];
  vendors: Named[];
  maintenance: Named[];
  projects: Named[];
}

export interface ChecklistItem { id: string; title: string; done: boolean; doneBy: string | null; doneAt: string | null; position: number }
export interface TaskComment { id: string; body: string; authorId: string | null; createdAt: string }
export interface TaskActivity { id: string; action: string; summary: string; actorId: string | null; createdAt: string }
export interface TaskReminder { id: string; remindAt: string; channel: string; status: string }
export interface TaskFile { id: string; name: string; sizeBytes: number; mimeType: string; uploadedAt: string; bucket: string; path: string }
export interface TaskDetail { checklist: ChecklistItem[]; comments: TaskComment[]; activities: TaskActivity[]; reminders: TaskReminder[]; files: TaskFile[] }

/** What the signed-in role can do. The database enforces the same rules; this only decides which buttons to show. */
export interface Caps { viewAll: boolean; manage: boolean; assign: boolean; series: boolean }
export function capsFor(role: string | null): Caps {
  switch (role) {
    case "Owner": case "Administrator": case "Property Manager": return { viewAll: true, manage: true, assign: true, series: true };
    case "Accountant": return { viewAll: true, manage: true, assign: false, series: false };
    case "Maintenance Staff": return { viewAll: false, manage: true, assign: false, series: false };
    case "Read-Only / Auditor": return { viewAll: true, manage: false, assign: false, series: false };
    default: return { viewAll: false, manage: false, assign: false, series: false };
  }
}

/** The create / edit form's values. */
export interface TaskInput {
  title: string;
  description: string;
  categoryId: string;
  priority: Priority;
  status: Status;
  propertyId: string;
  unitId: string;
  tenantId: string;
  leaseId: string;
  maintenanceRequestId: string;
  vendorId: string;
  projectId: string;
  assigneeId: string;
  startDate: string;
  dueDate: string;
  dueTime: string;
  completionNotes: string;
  reminderEnabled: boolean;
  reminderDays: number;
  checklist: string[];
  recurrence: null | {
    frequency: Frequency;
    interval: number;
    daysOfWeek: number[];
    monthMode: "day" | "relative";
    monthDay: number;
    monthWeek: number;
    monthWeekday: number;
    endDate: string;
  };
}
