// Supabase access for Scheduled Tasks (tables and functions from database/migrations/022_scheduled_tasks.sql). The database enforces who may see
// or change what (Row-Level Security, triggers) and writes the task history itself; this file only reads, writes and maps rows.
import { supabase, toError } from "../lib/supabase";
import { fetchAll } from "../lib/financeData";
import { deleteDocument, listDocuments, uploadDocument } from "../lib/documents";
import { loadStaff } from "../properties/add/store/refRepo";
import type {
  Category, ChecklistItem, Lookups, Person, Priority, Series, Status, Task, TaskActivity, TaskComment, TaskDetail, TaskFile, TaskInput, TaskReminder,
} from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any -- rows come from untyped PostgREST responses */

export interface Workspace { tasks: Task[]; categories: Category[]; series: Series[]; people: Person[]; lookups: Lookups }

const opt = (v: string | null | undefined) => (v ? v : null);
const trimTime = (v: string | null) => (v ? v.slice(0, 5) : null);

function friendly(error: { code?: string; message?: string }, fallback: string): Error {
  if (error.code === "42501" || /row-level security/i.test(error.message ?? "")) return new Error(error.message?.includes("needs") || error.message?.includes("only") ? error.message : "You don't have permission to do that.");
  if (["22023", "23514", "23503", "23505", "P0002"].includes(error.code ?? "")) return new Error(error.message || fallback);
  return toError(error, fallback);
}
const check = (res: { error: any }, fallback: string) => { if (res.error) throw friendly(res.error, fallback); };

export function toTask(r: any): Task {
  const prefs = r.reminder_prefs ?? {};
  return {
    id: r.id, ref: r.reference_number ?? "", title: r.title, description: r.description ?? "", categoryId: r.category_id, priority: r.priority, status: r.status,
    propertyId: r.property_id, unitId: r.unit_id, tenantId: r.tenant_id, leaseId: r.lease_id, maintenanceRequestId: r.maintenance_request_id, vendorId: r.vendor_id,
    projectId: r.project_id, assigneeId: r.assignee_id, collaboratorIds: r.collaborator_ids ?? [], startDate: r.start_date, dueDate: r.due_date, dueTime: trimTime(r.due_time),
    timezone: r.timezone, isRecurring: !!r.is_recurring, recurrenceId: r.recurrence_id, occurrenceDate: r.occurrence_date, completionNotes: r.completion_notes ?? "",
    completedAt: r.completed_at, completedBy: r.completed_by, cancelledAt: r.cancelled_at, cancelReason: r.cancel_reason ?? "",
    reminder: { enabled: prefs.enabled !== false, daysBefore: Array.isArray(prefs.daysBefore) ? prefs.daysBefore.map(Number) : [1], channels: prefs.channels ?? ["in_app"] },
    createdBy: r.created_by, createdAt: r.created_at, updatedAt: r.updated_at,
  };
}
const toCategory = (r: any): Category => ({ id: r.id, name: r.name, slug: r.slug, color: r.color, icon: r.icon, isSystem: r.is_system, isActive: r.is_active });
const toSeries = (r: any): Series => ({
  id: r.id, title: r.title, frequency: r.frequency, interval: r.interval, daysOfWeek: (r.days_of_week ?? []).map(Number), monthDay: r.month_day, monthWeek: r.month_week,
  monthWeekday: r.month_weekday, startDate: r.start_date, endDate: r.end_date, timezone: r.timezone, status: r.status, nextOccurrenceDate: r.next_occurrence_date,
  lastGeneratedDate: r.last_generated_date,
});

/** Everything the page shows, read once when it opens (and again after changes). */
export async function loadWorkspace(orgId: string): Promise<Workspace> {
  const [tasks, categories, series, people, properties, units, tenants, leases, vendors, maintenance, projects] = await Promise.all([
    fetchAll("tasks", "*", orgId, "due_date"),
    fetchAll("task_categories", "*", orgId, "name"),
    fetchAll("task_recurrences", "*", orgId, "created_at"),
    loadStaff(orgId),
    fetchAll("properties", "id, name", orgId, "name"),
    fetchAll("units", "id, property_id, unit_number", orgId, "unit_number"),
    fetchAll("tenants", "id, first_name, last_name", orgId, "first_name"),
    fetchAll("leases", "id, lease_number, name", orgId, "lease_number"),
    fetchAll("vendors", "id, company_name", orgId, "company_name"),
    fetchAll("maintenance_requests", "id, request_number, title", orgId, "request_number"),
    fetchAll("projects", "id, name", orgId, "name"),
  ]);
  return {
    tasks: tasks.map(toTask),
    categories: categories.map(toCategory),
    series: series.map(toSeries),
    people: people.map((p) => ({ id: p.id, name: p.name, role: String(p.role ?? "") })),
    lookups: {
      properties: properties.map((p: any) => ({ id: p.id, name: p.name })),
      units: units.map((u: any) => ({ id: u.id, propertyId: u.property_id, name: u.unit_number })),
      tenants: tenants.map((t: any) => ({ id: t.id, name: `${t.first_name} ${t.last_name ?? ""}`.trim() })),
      leases: leases.map((l: any) => ({ id: l.id, name: l.name || l.lease_number || l.id.slice(0, 8) })),
      vendors: vendors.map((v: any) => ({ id: v.id, name: v.company_name })),
      maintenance: maintenance.map((m: any) => ({ id: m.id, name: `${m.request_number ?? ""} ${m.title}`.trim() })),
      projects: projects.map((p: any) => ({ id: p.id, name: p.name })),
    },
  };
}

function payload(i: TaskInput) {
  const r = i.recurrence;
  return {
    title: i.title.trim(), description: i.description, category_id: opt(i.categoryId), priority: i.priority, status: i.status,
    property_id: opt(i.propertyId), unit_id: opt(i.unitId), tenant_id: opt(i.tenantId), lease_id: opt(i.leaseId), maintenance_request_id: opt(i.maintenanceRequestId),
    vendor_id: opt(i.vendorId), project_id: opt(i.projectId), assignee_id: opt(i.assigneeId), start_date: opt(i.startDate), due_date: opt(i.dueDate), due_time: opt(i.dueTime),
    reminder: { enabled: i.reminderEnabled, days_before: [i.reminderDays], channels: ["in_app"] },
    checklist: i.checklist,
    recurrence: r ? {
      frequency: r.frequency, interval: r.interval, days_of_week: r.frequency === "weekly" || r.frequency === "custom" ? r.daysOfWeek : [],
      month_day: r.frequency === "monthly" && r.monthMode === "day" ? r.monthDay : null,
      month_week: r.frequency === "monthly" && r.monthMode === "relative" ? r.monthWeek : null,
      month_weekday: r.frequency === "monthly" && r.monthMode === "relative" ? r.monthWeekday : null,
      start_date: opt(i.dueDate) ?? opt(i.startDate), end_date: opt(r.endDate),
    } : null,
  };
}

export async function createTask(orgId: string, input: TaskInput): Promise<string> {
  const { data, error } = await supabase.rpc("create_scheduled_task", { p_org: orgId, p: payload(input) });
  if (error) throw friendly(error, "Unable to create the task.");
  return data as string;
}

/** Edits one task (columns are checked by the database's rules). */
export async function updateTask(id: string, input: TaskInput): Promise<void> {
  const p = payload(input);
  const res = await supabase.from("tasks").update({
    title: p.title, description: p.description, category_id: p.category_id, priority: p.priority, property_id: p.property_id, unit_id: p.unit_id, tenant_id: p.tenant_id,
    lease_id: p.lease_id, maintenance_request_id: p.maintenance_request_id, vendor_id: p.vendor_id, project_id: p.project_id, assignee_id: p.assignee_id,
    start_date: p.start_date, due_date: p.due_date, due_time: p.due_time, completion_notes: input.completionNotes,
    reminder_prefs: { enabled: input.reminderEnabled, daysBefore: [input.reminderDays], channels: ["in_app"] },
  }).eq("id", id).select("id");
  if (res.error) throw friendly(res.error, "Unable to save the task.");
  if (!res.data?.length) throw new Error("You don't have permission to change this task.");
}

/** Applies the common fields to this and future (or all) open occurrences of a series; dates are never changed series-wide. */
export async function updateSeriesOccurrences(taskId: string, input: TaskInput, scope: "future" | "all"): Promise<{ applied: number; skipped: number }> {
  const p = payload(input);
  const patch = {
    title: p.title, description: p.description, category_id: p.category_id, priority: p.priority, property_id: p.property_id, unit_id: p.unit_id, tenant_id: p.tenant_id,
    lease_id: p.lease_id, maintenance_request_id: p.maintenance_request_id, vendor_id: p.vendor_id, project_id: p.project_id, assignee_id: p.assignee_id, due_time: p.due_time,
  };
  const { data, error } = await supabase.rpc("update_task_series_occurrences", { p_task: taskId, p_patch: patch, p_scope: scope });
  if (error) throw friendly(error, "Unable to update the series.");
  return { applied: Number(data?.applied ?? 0), skipped: Number(data?.skipped ?? 0) };
}

async function patchTask(id: string, patch: Record<string, unknown>, fallback: string) {
  const res = await supabase.from("tasks").update(patch).eq("id", id).select("id");
  if (res.error) throw friendly(res.error, fallback);
  if (!res.data?.length) throw new Error("You don't have permission to change this task.");
}
export const setStatus = (id: string, status: Status) => patchTask(id, { status }, "Unable to change the status.");
export const completeTask = (id: string, notes?: string) => patchTask(id, { status: "completed", ...(notes ? { completion_notes: notes } : {}) }, "Unable to complete the task.");
export const cancelTask = (id: string, reason: string) => patchTask(id, { status: "cancelled", cancel_reason: reason }, "Unable to cancel the task.");
export const reopenTask = (id: string) => patchTask(id, { status: "not_started" }, "Unable to reopen the task.");
export const setPriority = (id: string, priority: Priority) => patchTask(id, { priority }, "Unable to change the priority.");

export async function deleteTask(id: string): Promise<void> {
  const res = await supabase.from("tasks").delete().eq("id", id).select("id");
  if (res.error) throw friendly(res.error, "Unable to delete the task.");
  if (!res.data?.length) throw new Error("Only series managers can delete tasks.");
}

export async function seriesAction(id: string, action: "pause" | "resume" | "cancel" | "generate"): Promise<{ count: number }> {
  const { data, error } = await supabase.rpc("set_task_series_status", { p_series: id, p_action: action, p_count: 6 });
  if (error) throw friendly(error, "Unable to update the series.");
  return { count: Number(data?.count ?? 0) };
}

/** Generates the next 30 days of occurrences, flags overdue tasks and delivers due in-app reminders. */
export async function runSchedule(orgId: string): Promise<{ generated: number; overdue: number; reminders: number }> {
  const { data, error } = await supabase.rpc("process_task_schedule", { p_org: orgId });
  if (error) throw friendly(error, "Unable to run the schedule.");
  return { generated: Number(data?.series_generated ?? 0), overdue: Number(data?.overdue_flagged ?? 0), reminders: Number(data?.reminders_delivered ?? 0) };
}

// ---- one task's checklist, comments, files, history and reminders --------------------------------------------------------------
export async function loadDetail(orgId: string, taskId: string): Promise<TaskDetail> {
  const [checklist, comments, activities, reminders, files] = await Promise.all([
    supabase.from("task_checklist_items").select("*").eq("task_id", taskId).order("position"),
    supabase.from("task_comments").select("*").eq("task_id", taskId).order("created_at"),
    supabase.from("task_activities").select("*").eq("task_id", taskId).order("created_at", { ascending: false }).limit(100),
    supabase.from("task_reminders").select("*").eq("task_id", taskId).order("remind_at"),
    listDocuments(orgId, ["task"], [taskId]),
  ]);
  for (const res of [checklist, comments, activities, reminders]) if (res.error) throw toError(res.error, "Unable to load the task.");
  return {
    checklist: (checklist.data ?? []).map((c: any): ChecklistItem => ({ id: c.id, title: c.title, done: c.is_done, doneBy: c.done_by, doneAt: c.done_at, position: c.position })),
    comments: (comments.data ?? []).map((c: any): TaskComment => ({ id: c.id, body: c.body, authorId: c.author_id, createdAt: c.created_at })),
    activities: (activities.data ?? []).map((a: any): TaskActivity => ({ id: a.id, action: a.action, summary: a.summary, actorId: a.actor_id, createdAt: a.created_at })),
    reminders: (reminders.data ?? []).map((r: any): TaskReminder => ({ id: r.id, remindAt: r.remind_at, channel: r.channel, status: r.status })),
    files: files.map((f): TaskFile => ({ id: f.id, name: f.name, sizeBytes: f.sizeBytes, mimeType: f.mimeType, uploadedAt: f.uploadedAt, bucket: f.bucket, path: f.path })),
  };
}

export async function addChecklistItem(orgId: string, taskId: string, title: string, position: number): Promise<void> {
  check(await supabase.from("task_checklist_items").insert({ organization_id: orgId, task_id: taskId, title: title.trim(), position }), "Unable to add the item.");
}
export async function toggleChecklistItem(id: string, done: boolean): Promise<void> {
  const res = await supabase.from("task_checklist_items").update({ is_done: done }).eq("id", id).select("id");
  if (res.error) throw friendly(res.error, "Unable to update the item.");
  if (!res.data?.length) throw new Error("You don't have permission to change this checklist.");
}
export async function removeChecklistItem(id: string): Promise<void> {
  check(await supabase.from("task_checklist_items").delete().eq("id", id), "Unable to remove the item.");
}

export async function addComment(orgId: string, taskId: string, userId: string, body: string): Promise<void> {
  check(await supabase.from("task_comments").insert({ organization_id: orgId, task_id: taskId, author_id: userId, body: body.trim() }), "Unable to post the comment.");
}

/** Uploads the file to Document Center (linked to the task) and records the attachment. */
export async function attachFile(orgId: string, task: { id: string; ref: string }, userId: string, file: File): Promise<void> {
  const doc = await uploadDocument({
    bucket: "lease-documents", area: "tasks", file, entityType: "task", entityId: task.id, entityLabel: task.ref, category: "Task attachment", originModule: "Scheduled Tasks",
  });
  check(await supabase.from("task_attachments").insert({
    organization_id: orgId, task_id: task.id, document_id: doc.id, file_name: file.name, file_size: file.size, mime_type: file.type || "application/octet-stream", uploaded_by: userId,
  }), "Unable to record the attachment.");
}
export async function removeFile(documentId: string): Promise<void> {
  check(await supabase.from("task_attachments").delete().eq("document_id", documentId), "Unable to remove the attachment.");
  await deleteDocument(documentId);
}

// ---- categories ---------------------------------------------------------------------------------------------------------
export async function createCategory(orgId: string, name: string, color: string): Promise<void> {
  check(await supabase.from("task_categories").insert({ organization_id: orgId, name: name.trim(), color }), "Unable to add the category.");
}
export async function updateCategory(id: string, patch: { name?: string; color?: string; isActive?: boolean }): Promise<void> {
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name.trim();
  if (patch.color !== undefined) row.color = patch.color;
  if (patch.isActive !== undefined) row.is_active = patch.isActive;
  const res = await supabase.from("task_categories").update(row).eq("id", id).select("id");
  if (res.error) throw friendly(res.error, "Unable to update the category.");
  if (!res.data?.length) throw new Error("You don't have permission to change categories.");
}
