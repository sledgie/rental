// Supabase access for the Maintenance records: requests (+ earlier completions), estimates, visits, work logs, work orders, assets,
// inspection schedules (+ checklists), the expenses linked to them, and the activity history.
// The module works on lists that its store replaces after every action, so persistence is a diff: `persist(prev, next)` writes the rows
// that changed, in dependency order (assets -> requests -> work orders -> estimates / visits / work logs -> expenses -> schedules -> activity).
// Inside the screens, requests, work orders, assets, schedules and expenses are identified by their human number (MR-2026-0001, WO-1, AST-1,
// PM-0001, EXP-1); the maps below turn a number back into the row id. Row-Level Security decides who may read or write.
import { supabase, toError } from "../lib/supabase";
import { getActiveOrgId } from "../lib/activeOrg";
import { fetchAll } from "../lib/financeData";
import { fileSize, listDocuments } from "../lib/documents";
import type {
  ActivityEvent, Attachment, ApprovalStatus, Asset, AssetCondition, AssetStatus, Estimate, Expense, Frequency, MaintenanceRequest, PreventiveSchedule, Priority,
  RequestStatus, ResolutionOutcome, StaffMember, Visit, WorkLogEntry, WorkOrder, WorkOrderStatus,
} from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any -- rows come from untyped PostgREST responses */

export interface Records {
  requests: MaintenanceRequest[];
  estimates: Estimate[];
  visits: Visit[];
  workLogs: WorkLogEntry[];
  workOrders: WorkOrder[];
  assets: Asset[];
  expenses: Expense[];
  schedules: PreventiveSchedule[];
  activity: ActivityEvent[];
  /** files are stored by uploadDocument, not by persist(); they are only read here */
  attachments: Attachment[];
}
export const emptyRecords = (): Records => ({ requests: [], estimates: [], visits: [], workLogs: [], workOrders: [], assets: [], expenses: [], schedules: [], activity: [], attachments: [] });

/** Row ids behind the numbers shown on screen (needed to link a file to its record). */
export const rowIdOf = (kind: 'request' | 'asset' | 'workOrder', number: string): string | undefined => (kind === 'request' ? requestRow : kind === 'asset' ? assetRow : workOrderRow).get(number);

// ------------------------------------------------------------------ labels <-> database slugs
const slug = (v: string) => v.toLowerCase().replace(/[\s-]+/g, "_");
const label = <T extends string>(value: string | null | undefined, list: readonly T[]): T => list.find((l) => slug(l) === value) ?? list[0];
const REQUEST_STATUS = ["Draft", "New", "Under Review", "Awaiting Approval", "Approved", "Assigned", "In Progress", "On Hold", "Completed", "Closed", "Rejected", "Cancelled"] as const;
const APPROVAL = ["Not Required", "Pending Approval", "Approved", "Rejected", "Revision Requested"] as const;
const OUTCOME = ["Repaired", "Replaced", "No Fault Found", "Unable to Repair", "Deferred", "Cancelled"] as const;
const PRIORITY = ["Emergency", "High", "Normal", "Low"] as const;
const WO_STATUS = ["Draft", "Awaiting Assignment", "Scheduled", "In Progress", "On Hold", "Completed", "Cancelled"] as const;
const ASSET_STATUS = ["Active", "Under Inspection", "Under Repair", "Replaced", "Retired", "Disposed"] as const;
const CONDITION = ["Excellent", "Good", "Fair", "Poor", "Failed"] as const;
const FREQUENCY = ["Weekly", "Monthly", "Quarterly", "Semi-Annual", "Annual", "Custom"] as const;
const VISIT_STATUS = ["Scheduled", "Completed", "Cancelled", "Rescheduled"] as const;
const VERIFICATION = ["Verified", "Pending Verification", "Not Verified"] as const;
const PAYMENT_STATUS = ["Paid", "Unpaid", "Partially Paid", "Overdue"] as const;

const num = (v: unknown) => Number(v ?? 0);
const opt = <T,>(v: T | null | undefined) => (v === null || v === undefined || v === "" ? undefined : v);
const dateOnly = (v: string | null | undefined) => (v ? String(v).slice(0, 10) : undefined);
const uuid = (v: unknown) => (typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v) ? v : null);

// ------------------------------------------------------------------ number -> row id maps
const requestRow = new Map<string, string>();
const workOrderRow = new Map<string, string>();
const assetRow = new Map<string, string>();
const scheduleRow = new Map<string, string>();
const expenseRow = new Map<string, string>();
const projectRow = new Map<string, string>();
let staffByName = new Map<string, string>();
let categoryIdByName = new Map<string, string>();
let fallbackCategory: string | null = null;

const need = (map: Map<string, string>, key: string | undefined | null, what: string) => {
  if (!key) return null;
  const id = map.get(key);
  if (!id) throw new Error(`${what} ${key} could not be found. Refresh the page and try again.`);
  return id;
};
const rowFor = (map: Map<string, string>, key: string) => {
  let id = map.get(key);
  if (!id) { id = crypto.randomUUID(); map.set(key, id); }
  return id;
};
function friendly(error: { code?: string; message?: string }, fallback: string): Error {
  if (error.code === "42501") return new Error(error.message || "You don't have permission to make this change.");
  if (["23514", "23503", "23505"].includes(error.code ?? "")) return new Error(error.message || fallback);
  return toError(error, fallback);
}
const check = (res: { error: any }, fallback: string) => { if (res.error) throw friendly(res.error, fallback); };

// ------------------------------------------------------------------ load
export async function loadRecords(orgId: string, staff: StaffMember[]): Promise<Records> {
  const [requests, completions, workOrders, estimates, visits, logs, assets, schedules, checklist, expenses, categories, vendors, projects, events] = await Promise.all([
    fetchAll("maintenance_requests", "*", orgId, "created_at"),
    fetchAll("maintenance_request_completions", "*", orgId, "completed_at"),
    fetchAll("maintenance_work_orders", "*", orgId, "created_at"),
    fetchAll("maintenance_estimates", "*", orgId, "submitted_at"),
    fetchAll("maintenance_visits", "*", orgId, "visit_date"),
    fetchAll("maintenance_work_logs", "*", orgId, "log_date"),
    fetchAll("assets", "*", orgId, "created_at"),
    fetchAll("maintenance_schedules", "*", orgId, "next_due"),
    fetchAll("maintenance_schedule_checklist_items", "schedule_id, position, label", orgId, "position"),
    fetchAll("expenses", "*", orgId, "expense_date"),
    fetchAll("expense_categories", "id, name", orgId, "name"),
    fetchAll("vendors", "id, company_name", orgId, "company_name"),
    fetchAll("projects", "id, project_number", orgId, "project_number"),
    supabase.from("activity_events").select("id, actor_display_name, occurred_at, action, description, entity_id, metadata").eq("organization_id", orgId).like("action", "maintenance.%").order("occurred_at", { ascending: false }).limit(2000),
  ]);
  // the audit trail may be hidden by Row-Level Security: that is an empty history, not a failure
  const nameOf = new Map(staff.map((s) => [s.id, s.name]));
  staffByName = new Map(staff.map((s) => [s.name, s.id]));
  categoryIdByName = new Map(categories.map((c: any) => [c.name, c.id]));
  fallbackCategory = categoryIdByName.get("Repairs & Maintenance") ?? categories[0]?.id ?? null;
  const vendorName = new Map(vendors.map((v: any) => [v.id, v.company_name]));

  projectRow.clear();
  const projectNo = new Map<string, string>();
  for (const p of projects) { const n = p.project_number ?? p.id; projectNo.set(p.id, n); projectRow.set(n, p.id); }
  requestRow.clear(); workOrderRow.clear(); assetRow.clear(); scheduleRow.clear(); expenseRow.clear();
  const requestNo = new Map<string, string>();
  for (const r of requests) { const n = r.request_number ?? r.id; requestNo.set(r.id, n); requestRow.set(n, r.id); }
  const woNo = new Map<string, string>();
  for (const w of workOrders) { const n = w.work_order_number ?? w.id; woNo.set(w.id, n); workOrderRow.set(n, w.id); }
  const assetNo = new Map<string, string>();
  for (const a of assets) { const n = a.asset_number ?? a.id; assetNo.set(a.id, n); assetRow.set(n, a.id); }
  const scheduleNo = new Map<string, string>();
  for (const s of schedules) { const n = s.schedule_number ?? s.id; scheduleNo.set(s.id, n); scheduleRow.set(n, s.id); }
  const expenseNo = new Map<string, string>();
  for (const e of expenses) { const n = e.expense_number ?? e.id; expenseNo.set(e.id, n); expenseRow.set(n, e.id); }

  const files = await listDocuments(orgId, ["maintenance_request", "asset", "work_order"]).catch(() => []);
  const attachments: Attachment[] = files.flatMap((f): Attachment[] => {
    const number = f.entityType === "maintenance_request" ? requestNo.get(f.entityId) : f.entityType === "asset" ? assetNo.get(f.entityId) : woNo.get(f.entityId);
    if (!number) return [];
    return [{
      id: f.id, name: f.name, category: f.category, size: fileSize(f.sizeBytes), uploadedBy: f.uploadedBy, uploadedAt: f.uploadedAt, bucket: f.bucket, path: f.path,
      requestId: f.entityType === "maintenance_request" ? number : undefined, assetId: f.entityType === "asset" ? number : undefined, workOrderId: f.entityType === "work_order" ? number : undefined,
    }];
  });

  const expensesByRequest = new Map<string, string[]>();
  for (const e of expenses) if (e.maintenance_request_id) expensesByRequest.set(e.maintenance_request_id, [...(expensesByRequest.get(e.maintenance_request_id) ?? []), expenseNo.get(e.id)!]);
  const expenseByWorkOrder = new Map<string, string>();
  for (const e of expenses) if (e.work_order_id) expenseByWorkOrder.set(e.work_order_id, expenseNo.get(e.id)!);
  const completionsBy = new Map<string, any[]>();
  for (const c of completions) completionsBy.set(c.request_id, [...(completionsBy.get(c.request_id) ?? []), c]);

  return {
    attachments,
    requests: requests.map((r: any): MaintenanceRequest => ({
      id: requestNo.get(r.id)!, title: r.title, description: r.description ?? "", category: r.category, subcategory: opt(r.subcategory), priority: label(r.priority, PRIORITY) as Priority,
      status: label(r.status, REQUEST_STATUS) as RequestStatus, propertyId: r.property_id, unitId: opt(r.unit_id), room: opt(r.room), tenantId: opt(r.tenant_id), leaseId: opt(r.lease_id),
      assetId: r.asset_id ? assetNo.get(r.asset_id) : undefined, reportedByName: r.reported_by_name ?? "", reportedByRole: r.reported_by_role ?? "", source: r.source ?? "", reportedAt: r.reported_at,
      preferredDate: opt(r.preferred_date), targetDate: opt(r.target_date), completedAt: opt(r.completed_at), assignedStaffId: opt(r.assigned_staff_id), assignedContractorId: opt(r.assigned_vendor_id),
      assignedAt: opt(r.assigned_at), internalNotes: opt(r.internal_notes), tenantNotes: opt(r.tenant_notes), contractorNotes: opt(r.contractor_notes), accessInstructions: opt(r.access_instructions),
      preferredAccessTimes: opt(r.preferred_access_times), petsNote: opt(r.pets_note), approvalStatus: label(r.approval_status, APPROVAL) as ApprovalStatus,
      approvedBudget: r.approved_budget === null ? undefined : num(r.approved_budget), resolutionOutcome: r.resolution_outcome ? (label(r.resolution_outcome, OUTCOME) as ResolutionOutcome) : undefined,
      resolutionNotes: opt(r.resolution_notes), verifiedBy: r.verified_by ? nameOf.get(r.verified_by) : undefined,
      verificationStatus: r.verification_status ? (label(r.verification_status, VERIFICATION) as MaintenanceRequest["verificationStatus"]) : undefined, warrantyInfo: opt(r.warranty_info),
      followUpRequired: r.follow_up_required, statusReason: opt(r.status_reason), linkedExpenseIds: expensesByRequest.get(r.id) ?? [], linkedProjectId: r.linked_project_id ? projectNo.get(r.linked_project_id) : undefined,
      previousCompletions: (completionsBy.get(r.id) ?? []).map((c: any) => ({
        completedAt: c.completed_at, outcome: label(c.outcome, OUTCOME) as ResolutionOutcome, notes: c.notes ?? "", finalCost: num(c.final_cost), reopenedAt: opt(c.reopened_at), reopenReason: opt(c.reopen_reason),
      })),
      createdBy: nameOf.get(r.created_by) ?? "Team member",
    })),
    estimates: estimates.map((e: any): Estimate => ({
      id: e.id, requestId: requestNo.get(e.request_id)!, contractorId: opt(e.vendor_id), label: e.label, labor: num(e.labor), materials: num(e.materials), other: num(e.other), tax: num(e.tax), total: num(e.total),
      status: label(e.status, APPROVAL) as ApprovalStatus, submittedBy: nameOf.get(e.submitted_by) ?? "Team member", submittedAt: e.submitted_at, approvedBy: e.approved_by ? nameOf.get(e.approved_by) : undefined,
      approvedAt: opt(e.approved_at), approvedBudget: e.approved_budget === null ? undefined : num(e.approved_budget), notes: opt(e.notes),
    })),
    visits: visits.map((v: any): Visit => ({
      id: v.id, requestId: requestNo.get(v.request_id)!, workOrderId: v.work_order_id ? woNo.get(v.work_order_id) : undefined, contractorId: opt(v.vendor_id), staffId: opt(v.staff_id), purpose: v.purpose,
      date: v.visit_date, time: v.visit_time ? String(v.visit_time).slice(0, 5) : "09:00", durationMins: v.duration_minutes ?? 60, status: label(v.status, VISIT_STATUS) as Visit["status"],
      accessArrangements: opt(v.access_arrangements), notes: opt(v.notes),
    })),
    workLogs: logs.map((l: any): WorkLogEntry => ({
      id: l.id, requestId: requestNo.get(l.request_id)!, workOrderId: l.work_order_id ? woNo.get(l.work_order_id) : undefined, date: l.log_date, person: l.person, workPerformed: l.work_performed,
      diagnosis: opt(l.diagnosis), materials: opt(l.materials), hours: num(l.hours), outcome: l.outcome ?? "", followUpRequired: l.follow_up_required, notes: opt(l.notes),
    })),
    workOrders: workOrders.map((w: any): WorkOrder => ({
      id: woNo.get(w.id)!, requestId: requestNo.get(w.request_id)!, title: w.title, description: w.description ?? "", scope: opt(w.scope), contractorId: opt(w.vendor_id), staffId: opt(w.staff_id),
      priority: label(w.priority, PRIORITY) as Priority, scheduledDate: opt(w.scheduled_date), targetDate: opt(w.target_date), status: label(w.status, WO_STATUS) as WorkOrderStatus,
      estimate: w.estimate === null ? undefined : num(w.estimate), approvedBudget: w.approved_budget === null ? undefined : num(w.approved_budget), actualCost: w.actual_cost === null ? undefined : num(w.actual_cost),
      completionNotes: opt(w.completion_notes), linkedExpenseId: expenseByWorkOrder.get(w.id), createdAt: w.created_at,
    })),
    assets: assets.map((a: any): Asset => ({
      id: assetNo.get(a.id)!, name: a.name, type: a.asset_type, propertyId: a.property_id, unitId: opt(a.unit_id), room: opt(a.room), brand: opt(a.brand), model: opt(a.model), serial: opt(a.serial_number),
      purchaseDate: dateOnly(a.purchase_date), purchasePrice: a.purchase_price === null ? undefined : num(a.purchase_price), supplier: opt(a.supplier), installDate: dateOnly(a.install_date),
      warrantyStart: dateOnly(a.warranty_start), warrantyEnd: dateOnly(a.warranty_end), warrantyProvider: opt(a.warranty_provider), warrantyRef: opt(a.warranty_reference), warrantyNotes: opt(a.warranty_notes),
      condition: label(a.condition, CONDITION) as AssetCondition, status: label(a.status, ASSET_STATUS) as AssetStatus, lastInspection: dateOnly(a.last_inspection), lastService: dateOnly(a.last_service),
      nextService: dateOnly(a.next_service), replacedById: a.replaced_by_id ? assetNo.get(a.replaced_by_id) : undefined, replacedFromId: assets.find((x: any) => x.replaced_by_id === a.id) ? assetNo.get(assets.find((x: any) => x.replaced_by_id === a.id)!.id) : undefined,
      replacementReason: opt(a.replacement_reason), replacementDate: dateOnly(a.replacement_date), retiredDate: dateOnly(a.retired_date), disposalNotes: opt(a.disposal_notes),
    })),
    expenses: expenses
      .filter((e: any) => e.maintenance_request_id || e.work_order_id || e.asset_id || e.category_label)
      .map((e: any): Expense => ({
        id: expenseNo.get(e.id)!, description: e.description, vendor: e.vendor_name ?? vendorName.get(e.vendor_id) ?? "", contractorId: opt(e.vendor_id), propertyId: opt(e.property_id), unitId: opt(e.unit_id),
        category: e.category_label ?? categories.find((c: any) => c.id === e.category_id)?.name ?? "Other", amount: num(e.amount), date: e.expense_date, dueDate: dateOnly(e.due_date),
        paymentStatus: label(e.payment_status, PAYMENT_STATUS) as Expense["paymentStatus"], amountPaid: e.amount_paid === null ? undefined : num(e.amount_paid), invoiceRef: opt(e.invoice_ref),
        linkedRequestId: e.maintenance_request_id ? requestNo.get(e.maintenance_request_id) : undefined, linkedWorkOrderId: e.work_order_id ? woNo.get(e.work_order_id) : undefined,
        linkedAssetId: e.asset_id ? assetNo.get(e.asset_id) : undefined,
      })),
    schedules: schedules.map((s: any): PreventiveSchedule => ({
      id: scheduleNo.get(s.id)!, task: s.task, category: s.category, propertyId: s.property_id, unitId: opt(s.unit_id), assetId: s.asset_id ? assetNo.get(s.asset_id) : undefined,
      frequency: label(s.frequency, FREQUENCY) as Frequency, customDays: opt(s.custom_days), lastCompleted: dateOnly(s.last_completed), nextDue: s.next_due, contractorId: opt(s.vendor_id),
      estimatedCost: s.estimated_cost === null ? undefined : num(s.estimated_cost), checklist: checklist.filter((c: any) => c.schedule_id === s.id).map((c: any) => c.label), instructions: opt(s.instructions), active: s.is_active,
    })),
    activity: (events.data ?? []).map((e: any): ActivityEvent => ({
      id: e.id, requestId: e.metadata?.requestId ?? undefined, assetId: e.metadata?.assetId ?? undefined, type: e.metadata?.type ?? String(e.action).split(".")[1], description: e.description, user: e.actor_display_name, timestamp: e.occurred_at,
    })),
  };
}

// ------------------------------------------------------------------ persist (diff)
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
function diff<T extends { id: string }>(prev: T[], next: T[]) {
  const before = new Map(prev.map((r) => [r.id, r]));
  return { added: next.filter((r) => !before.has(r.id)), changed: next.filter((r) => before.has(r.id) && !same(before.get(r.id), r)) };
}
const staffId = (name: string | undefined) => (name ? staffByName.get(name) ?? null : null);
const catId = (name: string | undefined) => (name ? categoryIdByName.get(name) : undefined) ?? categoryIdByName.get(CATEGORY_ALIAS[name ?? ""] ?? "") ?? fallbackCategory;
const CATEGORY_ALIAS: Record<string, string> = {
  "Maintenance & Repairs": "Repairs & Maintenance", Landscaping: "Landscaping & Snow Removal", "Property Tax": "Property Taxes", "Legal & Professional": "Legal", Utilities: "Electricity",
};

export async function persist(prev: Records, next: Records, me: StaffMember | null): Promise<void> {
  const orgId = getActiveOrgId();
  if (!orgId) throw new Error("Select an organization first.");
  const userId = uuid(me?.id);
  const reqId = (n: string | undefined) => need(requestRow, n, "Request");
  const woId = (n: string | undefined) => need(workOrderRow, n, "Work order");
  const assetId = (n: string | undefined) => need(assetRow, n, "Asset");

  // ---- assets (a replacement link is written after both assets exist)
  const assetFields = (a: Asset) => ({
    name: a.name, asset_type: a.type, property_id: a.propertyId, unit_id: uuid(a.unitId), room: a.room ?? null, brand: a.brand ?? null, model: a.model ?? null, serial_number: a.serial ?? null,
    purchase_date: a.purchaseDate ?? null, purchase_price: a.purchasePrice ?? null, supplier: a.supplier ?? null, install_date: a.installDate ?? null, warranty_start: a.warrantyStart ?? null,
    warranty_end: a.warrantyEnd ?? null, warranty_provider: a.warrantyProvider ?? null, warranty_reference: a.warrantyRef ?? null, warranty_notes: a.warrantyNotes ?? null, condition: slug(a.condition),
    status: slug(a.status), last_inspection: a.lastInspection ?? null, last_service: a.lastService ?? null, next_service: a.nextService ?? null, replacement_reason: a.replacementReason ?? null,
    replacement_date: a.replacementDate ?? null, retired_date: a.retiredDate ?? null, disposal_notes: a.disposalNotes ?? null,
  });
  const assets = diff(prev.assets, next.assets);
  if (assets.added.length) check(await supabase.from("assets").insert(assets.added.map((a) => ({ id: rowFor(assetRow, a.id), organization_id: orgId, asset_number: a.id, ...assetFields(a) }))), "Unable to save the asset.");
  for (const a of assets.changed) check(await supabase.from("assets").update(assetFields(a)).eq("id", assetId(a.id)), "Unable to save the asset.");
  for (const a of [...assets.added, ...assets.changed]) {
    const before = prev.assets.find((x) => x.id === a.id)?.replacedById;
    if (a.replacedById !== before) check(await supabase.from("assets").update({ replaced_by_id: a.replacedById ? assetId(a.replacedById) : null }).eq("id", assetId(a.id)), "Unable to link the replacement asset.");
  }

  // ---- requests (a project created after the last load is looked up by its number)
  const unknownProjects = [...new Set(next.requests.map((r) => r.linkedProjectId).filter((n): n is string => !!n && !projectRow.has(n)))];
  if (unknownProjects.length) {
    const found = await supabase.from("projects").select("id, project_number").eq("organization_id", orgId).in("project_number", unknownProjects);
    for (const p of found.data ?? []) projectRow.set(p.project_number, p.id);
  }
  const requestFields = (r: MaintenanceRequest) => ({
    title: r.title, description: r.description || null, category: r.category, subcategory: r.subcategory ?? null, priority: slug(r.priority), status: slug(r.status), property_id: r.propertyId,
    unit_id: uuid(r.unitId), room: r.room ?? null, tenant_id: uuid(r.tenantId), lease_id: uuid(r.leaseId), asset_id: r.assetId ? assetId(r.assetId) : null, reported_by_name: r.reportedByName || null,
    reported_by_role: r.reportedByRole || null, source: r.source || null, reported_at: r.reportedAt, preferred_date: r.preferredDate ?? null, target_date: r.targetDate ?? null, completed_at: r.completedAt ?? null,
    assigned_staff_id: uuid(r.assignedStaffId), assigned_vendor_id: uuid(r.assignedContractorId), assigned_at: r.assignedAt ?? null, internal_notes: r.internalNotes ?? null, tenant_notes: r.tenantNotes ?? null,
    contractor_notes: r.contractorNotes ?? null, access_instructions: r.accessInstructions ?? null, preferred_access_times: r.preferredAccessTimes ?? null, pets_note: r.petsNote ?? null,
    approval_status: slug(r.approvalStatus), approved_budget: r.approvedBudget ?? null, resolution_outcome: r.resolutionOutcome ? slug(r.resolutionOutcome) : null, resolution_notes: r.resolutionNotes ?? null,
    verified_by: staffId(r.verifiedBy), verification_status: r.verificationStatus ? slug(r.verificationStatus) : null, warranty_info: r.warrantyInfo ?? null, follow_up_required: !!r.followUpRequired,
    status_reason: r.statusReason ?? null, linked_project_id: r.linkedProjectId ? projectRow.get(r.linkedProjectId) ?? null : null,
  });
  const requests = diff(prev.requests, next.requests);
  if (requests.added.length) {
    check(await supabase.from("maintenance_requests").insert(requests.added.map((r) => ({ id: rowFor(requestRow, r.id), organization_id: orgId, request_number: r.id, created_by: userId, ...requestFields(r) }))), "Unable to save the request.");
  }
  for (const r of requests.changed) {
    const res = await supabase.from("maintenance_requests").update(requestFields(r)).eq("id", reqId(r.id)).select("id");
    check(res, "Unable to save the request.");
    if (!res.data?.length) throw new Error("You don't have permission to change maintenance requests.");
  }
  for (const r of [...requests.added, ...requests.changed]) {
    const before = prev.requests.find((x) => x.id === r.id)?.previousCompletions ?? [];
    if (same(before, r.previousCompletions)) continue;
    check(await supabase.from("maintenance_request_completions").delete().eq("request_id", reqId(r.id)), "Unable to save the earlier completions.");
    if (r.previousCompletions.length) {
      check(await supabase.from("maintenance_request_completions").insert(r.previousCompletions.map((c) => ({
        organization_id: orgId, request_id: reqId(r.id), completed_at: c.completedAt, outcome: slug(c.outcome), notes: c.notes || null, final_cost: c.finalCost, reopened_at: c.reopenedAt ?? null, reopen_reason: c.reopenReason ?? null,
      }))), "Unable to save the earlier completions.");
    }
  }

  // ---- work orders
  const woFields = (w: WorkOrder) => ({
    request_id: reqId(w.requestId), title: w.title, description: w.description || null, scope: w.scope ?? null, vendor_id: uuid(w.contractorId), staff_id: uuid(w.staffId), priority: slug(w.priority),
    scheduled_date: w.scheduledDate ?? null, target_date: w.targetDate ?? null, status: slug(w.status), estimate: w.estimate ?? null, approved_budget: w.approvedBudget ?? null, actual_cost: w.actualCost ?? null,
    completion_notes: w.completionNotes ?? null, completed_at: w.status === "Completed" ? new Date().toISOString() : null,
  });
  const orders = diff(prev.workOrders, next.workOrders);
  if (orders.added.length) check(await supabase.from("maintenance_work_orders").insert(orders.added.map((w) => ({ id: rowFor(workOrderRow, w.id), organization_id: orgId, work_order_number: w.id, ...woFields(w) }))), "Unable to save the work order.");
  for (const w of orders.changed) check(await supabase.from("maintenance_work_orders").update(woFields(w)).eq("id", woId(w.id)), "Unable to save the work order.");

  // ---- estimates, visits, work logs (their ids are already row ids)
  const estimateFields = (e: Estimate) => ({
    request_id: reqId(e.requestId), vendor_id: uuid(e.contractorId), label: e.label, labor: e.labor, materials: e.materials, other: e.other, tax: e.tax, status: slug(e.status), submitted_by: staffId(e.submittedBy) ?? userId,
    submitted_at: e.submittedAt, approved_by: staffId(e.approvedBy), approved_at: e.approvedAt ?? null, approved_budget: e.approvedBudget ?? null, notes: e.notes ?? null,
  });
  const estimates = diff(prev.estimates, next.estimates);
  if (estimates.added.length) check(await supabase.from("maintenance_estimates").insert(estimates.added.map((e) => ({ id: e.id, organization_id: orgId, ...estimateFields(e) }))), "Unable to save the estimate.");
  for (const e of estimates.changed) check(await supabase.from("maintenance_estimates").update(estimateFields(e)).eq("id", e.id), "Unable to save the estimate.");

  const visitFields = (v: Visit) => ({
    request_id: reqId(v.requestId), work_order_id: v.workOrderId ? woId(v.workOrderId) : null, vendor_id: uuid(v.contractorId), staff_id: uuid(v.staffId), purpose: v.purpose, visit_date: v.date,
    visit_time: v.time ? `${v.time.slice(0, 5)}:00` : null, duration_minutes: v.durationMins || null, status: slug(v.status), access_arrangements: v.accessArrangements ?? null, notes: v.notes ?? null,
  });
  const visits = diff(prev.visits, next.visits);
  if (visits.added.length) check(await supabase.from("maintenance_visits").insert(visits.added.map((v) => ({ id: v.id, organization_id: orgId, ...visitFields(v) }))), "Unable to save the visit.");
  for (const v of visits.changed) check(await supabase.from("maintenance_visits").update(visitFields(v)).eq("id", v.id), "Unable to save the visit.");

  const logFields = (l: WorkLogEntry) => ({
    request_id: reqId(l.requestId), work_order_id: l.workOrderId ? woId(l.workOrderId) : null, log_date: l.date, person: l.person, work_performed: l.workPerformed, diagnosis: l.diagnosis ?? null,
    materials: l.materials ?? null, hours: l.hours, outcome: l.outcome || null, follow_up_required: l.followUpRequired, notes: l.notes ?? null,
  });
  const logs = diff(prev.workLogs, next.workLogs);
  if (logs.added.length) check(await supabase.from("maintenance_work_logs").insert(logs.added.map((l) => ({ id: l.id, organization_id: orgId, created_by: userId, ...logFields(l) }))), "Unable to save the work log.");
  for (const l of logs.changed) check(await supabase.from("maintenance_work_logs").update(logFields(l)).eq("id", l.id), "Unable to save the work log.");

  // ---- expenses linked to requests, work orders and assets
  const expenseFields = (e: Expense) => {
    const category = catId(e.category);
    if (!category) throw new Error("Your organization has no expense categories yet, so this expense cannot be saved.");
    if (!(e.amount > 0)) throw new Error("An expense needs an amount greater than zero.");
    return {
      property_id: uuid(e.propertyId), unit_id: uuid(e.propertyId ? e.unitId : undefined), category_id: category, vendor_id: uuid(e.contractorId), work_order_id: e.linkedWorkOrderId ? woId(e.linkedWorkOrderId) : null,
      maintenance_request_id: e.linkedRequestId ? reqId(e.linkedRequestId) : null, asset_id: e.linkedAssetId ? assetId(e.linkedAssetId) : null, expense_date: e.date, amount: e.amount, tax_amount: 0,
      description: e.description, status: "posted", due_date: e.dueDate ?? null, payment_status: slug(e.paymentStatus), amount_paid: e.amountPaid ?? null, invoice_ref: e.invoiceRef ?? null,
      vendor_name: e.vendor || null, category_label: e.category,
    };
  };
  const expenses = diff(prev.expenses, next.expenses);
  if (expenses.added.length) check(await supabase.from("expenses").insert(expenses.added.map((e) => ({ id: rowFor(expenseRow, e.id), organization_id: orgId, expense_number: e.id, created_by: userId, ...expenseFields(e) }))), "Unable to save the expense.");
  for (const e of expenses.changed) check(await supabase.from("expenses").update(expenseFields(e)).eq("id", need(expenseRow, e.id, "Expense")), "Unable to save the expense.");
  // linking an existing expense to a request is a change on the request side
  for (const r of next.requests) {
    const before = prev.requests.find((x) => x.id === r.id);
    if (!before) continue;
    for (const eid of r.linkedExpenseIds.filter((x) => !before.linkedExpenseIds.includes(x))) check(await supabase.from("expenses").update({ maintenance_request_id: reqId(r.id) }).eq("id", need(expenseRow, eid, "Expense")), "Unable to link the expense.");
    for (const eid of before.linkedExpenseIds.filter((x) => !r.linkedExpenseIds.includes(x))) check(await supabase.from("expenses").update({ maintenance_request_id: null }).eq("id", need(expenseRow, eid, "Expense")), "Unable to unlink the expense.");
  }

  // ---- inspection schedules and their checklists
  const scheduleFields = (s: PreventiveSchedule) => ({
    task: s.task, category: s.category, property_id: s.propertyId, unit_id: uuid(s.unitId), asset_id: s.assetId ? assetId(s.assetId) : null, frequency: slug(s.frequency), custom_days: s.frequency === "Custom" ? s.customDays ?? 30 : null,
    last_completed: s.lastCompleted ?? null, next_due: s.nextDue, vendor_id: uuid(s.contractorId), estimated_cost: s.estimatedCost ?? null, instructions: s.instructions ?? null, is_active: s.active,
  });
  const schedules = diff(prev.schedules, next.schedules);
  if (schedules.added.length) check(await supabase.from("maintenance_schedules").insert(schedules.added.map((s) => ({ id: rowFor(scheduleRow, s.id), organization_id: orgId, schedule_number: s.id, ...scheduleFields(s) }))), "Unable to save the schedule.");
  for (const s of schedules.changed) check(await supabase.from("maintenance_schedules").update(scheduleFields(s)).eq("id", need(scheduleRow, s.id, "Schedule")), "Unable to save the schedule.");
  for (const s of [...schedules.added, ...schedules.changed]) {
    const before = prev.schedules.find((x) => x.id === s.id)?.checklist ?? [];
    if (same(before, s.checklist)) continue;
    const id = need(scheduleRow, s.id, "Schedule")!;
    check(await supabase.from("maintenance_schedule_checklist_items").delete().eq("schedule_id", id), "Unable to save the checklist.");
    if (s.checklist.length) check(await supabase.from("maintenance_schedule_checklist_items").insert(s.checklist.map((label, position) => ({ organization_id: orgId, schedule_id: id, position, label }))), "Unable to save the checklist.");
  }

  // ---- activity history -> audit trail (best-effort: a logging failure never undoes a saved change)
  for (const a of diff(prev.activity, next.activity).added) {
    const type = (a.type || "activity").toLowerCase().replace(/[^a-z]+/g, "_").replace(/^_+|_+$/g, "") || "activity";
    await supabase.rpc("record_activity", {
      p_org: orgId, p_action: `maintenance.${type}`, p_category: "Maintenance & Repairs", p_description: a.description, p_entity_type: a.assetId && !a.requestId ? "asset" : "maintenance_request",
      p_entity_id: a.requestId ?? a.assetId ?? "", p_label: a.type, p_metadata: { requestId: a.requestId ?? null, assetId: a.assetId ?? null, type: a.type }, p_source_module: "Maintenance",
    });
  }
}
