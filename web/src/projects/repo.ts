// Supabase access for the Projects module: properties and units (reference), contractors (table `vendors`), and each project with its
// tasks, team, budget expenses, invoices, payments, change orders, quotes, purchase orders, milestones, inspections, deficiencies,
// tenant notifications and activity history.
// The store keeps the whole project tree in memory and replaces it after every action, so persistence is a diff: `persist(prev, next)` writes
// the rows that changed, in dependency order. A project is identified on screen by its number (PRJ-0001); the map below turns a number back
// into the row id. Everything below a project (tasks, invoices, ...) already carries its row id (uuid). Documents are not stored yet.
import { supabase, toError } from "../lib/supabase";
import { getActiveOrgId } from "../lib/activeOrg";
import { fetchAll } from "../lib/financeData";
import { documentUrls, fileSize, listDocuments } from "../lib/documents";
import type {
  ActivityEntry, ApprovalStatus, ChangeOrder, Contractor, Deficiency, Expense, ExpenseCategory, Inspection, Invoice, Milestone, Occupancy, Payment, PaymentMethod,
  Priority, Project, ProjectDocument, ProjectStatus, ProjectTeamMember, ProjectType, PurchaseOrder, Quote, Task, WorkCategory, Property,
} from "./lib/types";

/* eslint-disable @typescript-eslint/no-explicit-any -- rows come from untyped PostgREST responses */

export interface Reference { properties: Property[]; contractors: Contractor[]; staff: { id: string; name: string }[]; me: { id: string; name: string } | null }

// ------------------------------------------------------------------ labels <-> database slugs
const slug = (v: string) => v.toLowerCase().replace(/&/g, " ").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
const label = <T extends string>(value: string | null | undefined, list: readonly T[]): T => list.find((l) => slug(l) === value) ?? list[0];
const TYPES = ["Renovation", "Repair", "Maintenance", "Upgrade", "Restoration", "Other"] as const;
const PRIORITIES = ["Low", "Normal", "High", "Emergency"] as const;
const STATUSES = ["Draft", "Planned", "Approved", "In Progress", "On Hold", "Completed", "Cancelled"] as const;
const OCCUPANCY = ["Occupied", "Vacant", "Vacating", "Ready for rent"] as const;
const APPROVAL = ["Draft", "Pending Approval", "Approved", "Rejected", "Cancelled"] as const;
const CATEGORIES = ["Demolition", "Electrical", "Plumbing", "Painting", "Flooring", "Kitchen", "Bathroom", "Cleanup", "Inspection", "General"] as const;
const EXPENSE_CATEGORIES = ["Labor", "Materials", "Plumbing & Electrical Supplies", "Equipment Rental", "Permits & Inspections", "Contractor Services", "Delivery & Transportation", "Waste Removal", "Other"] as const;
const METHODS = ["EFT", "Cheque", "Credit Card", "Cash", "Wire Transfer"] as const;
const TASK_STATUS = ["Not Started", "In Progress", "Blocked", "Completed"] as const;
const ASSIGNEE = ["Contractor", "Worker", "Internal"] as const;
const TEAM_STATUS = ["Assigned", "Active", "Complete", "Released"] as const;
const MILESTONE_STATUS = ["Pending", "In Progress", "Completed"] as const;
const INSPECTION_RESULT = ["Scheduled", "Pass", "Fail", "Conditional"] as const;
const SEVERITY = ["Low", "Medium", "High", "Critical"] as const;
const DEFICIENCY_STATUS = ["Open", "In Progress", "Resolved", "Verified"] as const;
const QUOTE_STATUS = ["Pending", "Accepted", "Declined", "Expired"] as const;
const PO_STATUS = ["Draft", "Approved", "Ordered", "Received", "Cancelled"] as const;
const PRICING = ["Fixed Price", "Hourly", "Daily", "Cost Plus"] as const;

const cents = (v: unknown) => Math.round(Number(v ?? 0) * 100);
const money = (c: number) => Math.round(c) / 100;
const opt = <T,>(v: T | null | undefined) => (v === null || v === undefined || v === "" ? undefined : v);
const dateOnly = (v: string | null | undefined) => (v ? String(v).slice(0, 10) : undefined);
const uuid = (v: unknown) => (typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v) ? v : null);

const projectRow = new Map<string, string>();
/** Row id behind a project number (needed to link a file to its project). */
export const projectRowId = (number: string) => projectRow.get(number);
let staffByName = new Map<string, string>();
const rowFor = (map: Map<string, string>, key: string) => {
  let id = map.get(key);
  if (!id) { id = crypto.randomUUID(); map.set(key, id); }
  return id;
};
function friendly(error: { code?: string; message?: string }, fallback: string): Error {
  if (error.code === "42501") return new Error("You don't have permission to change projects.");
  if (["23514", "23503", "23505"].includes(error.code ?? "")) {
    if (error.code === "23505") return new Error("A record with the same number already exists. Check the invoice, change order or project number.");
    return new Error(error.message || fallback);
  }
  return toError(error, fallback);
}
const check = (res: { error: any }, fallback: string) => { if (res.error) throw friendly(res.error, fallback); };

// ------------------------------------------------------------------ load
export async function loadReference(orgId: string, staff: { id: string; name: string }[]): Promise<Reference> {
  const { data: auth } = await supabase.auth.getUser();
  const [properties, units, leases, leaseUnits, parties, tenants, vendors, workers] = await Promise.all([
    fetchAll("properties", "id, name, address_line1, city, state_province, property_type, year_built", orgId, "name"),
    fetchAll("units", "id, property_id, unit_number, bedrooms, bathrooms, square_feet, unit_status, market_rent", orgId, "unit_number"),
    fetchAll("leases", "id, end_date, status", orgId, "start_date"),
    fetchAll("lease_units", "lease_id, unit_id", orgId, "lease_id"),
    fetchAll("lease_parties", "lease_id, tenant_id, role, relationship_end_date", orgId, "lease_id"),
    fetchAll("tenants", "id, first_name, last_name", orgId, "last_name"),
    fetchAll("vendors", "*", orgId, "company_name"),
    fetchAll("vendor_workers", "vendor_id, name, role, phone", orgId, "name"),
  ]);
  const tenantName = new Map(tenants.map((t: any) => [t.id, `${t.first_name} ${t.last_name ?? ""}`.trim()]));
  const activeLeases = new Map<string, any>(leases.filter((l: any) => l.status === "active").map((l: any) => [l.id, l]));
  const occupant = (unitId: string) => {
    const link = leaseUnits.find((lu: any) => lu.unit_id === unitId && activeLeases.has(lu.lease_id));
    if (!link) return {};
    const party = parties.find((p: any) => p.lease_id === link.lease_id && p.role === "main_tenant" && !p.relationship_end_date) ?? parties.find((p: any) => p.lease_id === link.lease_id);
    return { tenantName: party ? tenantName.get(party.tenant_id) : undefined, leaseEnd: dateOnly(activeLeases.get(link.lease_id)?.end_date) };
  };
  return {
    properties: properties.map((p: any): Property => ({
      id: p.id, name: p.name, address: p.address_line1, city: [p.city, p.state_province].filter(Boolean).join(", "), image: "", propertyType: String(p.property_type).replace(/_/g, " "), yearBuilt: p.year_built ?? 0,
      units: units.filter((u: any) => u.property_id === p.id).map((u: any) => ({
        id: u.id, propertyId: p.id, number: u.unit_number, beds: Number(u.bedrooms ?? 0), baths: Number(u.bathrooms ?? 0), sqft: Number(u.square_feet ?? 0), marketRentCents: cents(u.market_rent),
        occupancy: (u.unit_status === "occupied" || u.unit_status === "notice" ? "Occupied" : u.unit_status === "turnover" ? "Vacating" : "Vacant") as Occupancy, ...occupant(u.id),
      })),
    })),
    contractors: vendors.filter((v: any) => ["contractor", "vendor"].includes(v.vendor_type) && !v.archived_at).map((v: any): Contractor => ({
      id: v.id, name: v.company_name, contactPerson: v.contact_name ?? "", phone: v.phone ?? "", email: v.email ?? "", address: v.address ?? "", trade: v.trade ?? v.categories?.[0] ?? "", license: v.license_number ?? "",
      insuranceProvider: v.insurance_provider ?? "", insuranceExpiry: dateOnly(v.insurance_expiry) ?? "", wsib: v.wsib_number ?? "", wsibExpiry: dateOnly(v.wsib_expiry) ?? "",
      pricingModel: label(v.pricing_model, PRICING) as Contractor["pricingModel"], agreedRate: v.agreed_rate ?? "", paymentTerms: v.payment_terms ?? "", notes: v.notes ?? "", active: v.is_active, rating: Number(v.rating ?? 0),
      workers: workers.filter((w: any) => w.vendor_id === v.id).map((w: any) => ({ name: w.name, role: w.role ?? "", phone: opt(w.phone) })), documents: [],
    })),
    staff,
    me: staff.find((s) => s.id === auth.user?.id) ?? null,
  };
}

export async function loadProjects(orgId: string, staff: { id: string; name: string }[]): Promise<Project[]> {
  const [projects, notifications, team, tasks, deps, invoices, lines, pos, expenses, payments, allocations, cos, quotes, milestones, inspections, deficiencies, vendors, tenants, events] = await Promise.all([
    fetchAll("projects", "*", orgId, "created_at"),
    fetchAll("project_tenant_notifications", "*", orgId, "notified_on"),
    fetchAll("project_team_members", "*", orgId, "start_date"),
    fetchAll("project_tasks", "*", orgId, "planned_start"),
    fetchAll("project_task_dependencies", "task_id, depends_on_id", orgId, "task_id"),
    fetchAll("project_invoices", "*", orgId, "invoice_date"),
    fetchAll("project_invoice_lines", "*", orgId, "position"),
    fetchAll("project_purchase_orders", "*", orgId, "po_number"),
    fetchAll("project_expenses", "*", orgId, "expense_date"),
    fetchAll("project_payments", "*", orgId, "payment_date"),
    fetchAll("project_payment_allocations", "payment_id, invoice_id, amount", orgId, "payment_id"),
    fetchAll("project_change_orders", "*", orgId, "co_number"),
    fetchAll("project_quotes", "*", orgId, "issue_date"),
    fetchAll("project_milestones", "*", orgId, "planned_date"),
    fetchAll("project_inspections", "*", orgId, "inspection_date"),
    fetchAll("project_deficiencies", "*", orgId, "due_date"),
    fetchAll("vendors", "id, company_name", orgId, "company_name"),
    fetchAll("tenants", "id, first_name, last_name", orgId, "last_name"),
    supabase.from("activity_events").select("id, actor_display_name, occurred_at, description, metadata").eq("organization_id", orgId).like("action", "project.%").order("occurred_at", { ascending: false }).limit(5000),
  ]);
  const nameOf = new Map(staff.map((s) => [s.id, s.name]));
  staffByName = new Map(staff.map((s) => [s.name, s.id]));
  const vendorName = new Map(vendors.map((v: any) => [v.id, v.company_name]));
  const tenantName = new Map(tenants.map((t: any) => [t.id, `${t.first_name} ${t.last_name ?? ""}`.trim()]));
  const files = await listDocuments(orgId, ["project", "project_task", "project_expense", "project_invoice"]).catch(() => []);
  const photoUrls = await documentUrls(files.filter((f) => f.mimeType.startsWith("image/")).map((f) => ({ bucket: f.bucket, path: f.path }))).catch(() => new Map<string, string>());
  const [propertyRows, unitRows] = await Promise.all([fetchAll("properties", "id, name", orgId, "name"), fetchAll("units", "id, unit_number", orgId, "unit_number")]);
  const propertyName = new Map(propertyRows.map((p: any) => [p.id, p.name]));
  const unitNumber = new Map(unitRows.map((u: any) => [u.id, u.unit_number]));

  projectRow.clear();
  const numberOf = new Map<string, string>();
  for (const p of projects) { const n = p.project_number ?? p.id; numberOf.set(p.id, n); projectRow.set(n, p.id); }
  const by = <T extends { project_id: string }>(rows: T[], id: string) => rows.filter((r) => r.project_id === id);
  const taskDeps = (taskId: string) => deps.filter((d: any) => d.task_id === taskId).map((d: any) => d.depends_on_id);
  const allocationsOf = (paymentId: string) => allocations.filter((a: any) => a.payment_id === paymentId).map((a: any) => ({ invoiceId: a.invoice_id, amountCents: cents(a.amount) }));
  const activityOf = (n: string): ActivityEntry[] => (events.data ?? []).filter((e: any) => e.metadata?.projectId === n).map((e: any): ActivityEntry => ({
    id: e.id, projectId: n, at: e.occurred_at, actor: e.actor_display_name, action: e.metadata?.action ?? "Updated", detail: e.description, kind: e.metadata?.kind ?? "status",
  }));

  return projects.map((p: any): Project => {
    const n = numberOf.get(p.id)!;
    return {
      id: n, name: p.name, propertyId: p.property_id, propertyName: propertyName.get(p.property_id) ?? "", unitId: p.unit_id ?? "", unitNumber: unitNumber.get(p.unit_id) ?? "",
      type: label(p.project_type, TYPES) as ProjectType, description: p.description ?? "", reason: p.reason ?? "", priority: label(p.priority, PRIORITIES) as Priority, status: label(p.status, STATUSES) as ProjectStatus,
      manager: p.manager_name ?? nameOf.get(p.manager_id) ?? "", createdBy: nameOf.get(p.created_by) ?? "Team member", createdAt: p.created_at, modifiedBy: nameOf.get(p.created_by) ?? "Team member", modifiedAt: p.updated_at,
      plannedStart: dateOnly(p.planned_start) ?? "", estimatedCompletion: dateOnly(p.estimated_completion) ?? "", actualStart: dateOnly(p.actual_start), actualCompletion: dateOnly(p.actual_completion),
      occupancyStatus: label(p.occupancy_status, OCCUPANCY) as Occupancy, tenantName: p.tenant_id ? tenantName.get(p.tenant_id) : undefined, mustVacate: p.must_vacate,
      tenantNotifications: by(notifications, p.id).map((t: any) => ({ date: t.notified_on, channel: t.channel, note: t.note ?? "" })), accessRequirements: p.access_requirements ?? "",
      moveOutDate: dateOnly(p.move_out_date), expectedReadyDate: dateOnly(p.expected_ready_date) ?? "", actualReadyDate: dateOnly(p.actual_ready_date), utilityShutdowns: p.utility_shutdowns ?? "",
      lostRentCents: cents(p.lost_rent), readinessApproved: p.readiness_approved, readinessApprovedBy: p.readiness_approved_by ? nameOf.get(p.readiness_approved_by) : undefined,
      originalBudgetCents: cents(p.original_budget), contingencyCents: cents(p.contingency), internalNotes: p.internal_notes ?? "", archived: !!p.archived_at,
      tasks: by(tasks, p.id).map((t: any): Task => ({
        id: t.id, projectId: n, name: t.name, description: t.description ?? "", category: label(t.category, CATEGORIES) as WorkCategory, assigneeType: label(t.assignee_type, ASSIGNEE) as Task["assigneeType"], contractorId: opt(t.vendor_id),
        assigneeName: t.assignee_name ?? "", plannedStart: dateOnly(t.planned_start) ?? "", plannedFinish: dateOnly(t.planned_finish) ?? "", actualStart: dateOnly(t.actual_start), actualFinish: dateOnly(t.actual_finish),
        estimatedCostCents: cents(t.estimated_cost), actualCostCents: cents(t.actual_cost), status: label(t.status, TASK_STATUS) as Task["status"], priority: label(t.priority, PRIORITIES) as Priority, dependencies: taskDeps(t.id),
        completionNotes: opt(t.completion_notes), beforePhoto: opt(t.before_photo_path), afterPhoto: opt(t.after_photo_path), inspectionRequired: t.inspection_required, createdBy: nameOf.get(t.created_by) ?? "Team member",
        createdAt: t.created_at, modifiedBy: nameOf.get(t.created_by) ?? "Team member", modifiedAt: t.updated_at,
      })),
      team: by(team, p.id).map((m: any): ProjectTeamMember => ({
        id: m.id, contractorId: m.vendor_id, role: m.role, responsibilities: m.responsibilities ?? "", contractAmountCents: cents(m.contract_amount), startDate: dateOnly(m.start_date) ?? "", endDate: dateOnly(m.end_date) ?? "",
        status: label(m.status, TEAM_STATUS) as ProjectTeamMember["status"], workerName: opt(m.worker_name),
      })),
      expenses: by(expenses, p.id).map((e: any): Expense => ({
        attachmentName: fileName(files, "project_expense", e.id),
        id: e.id, projectId: n, taskId: opt(e.task_id), date: e.expense_date, category: label(e.category, EXPENSE_CATEGORIES) as ExpenseCategory, description: e.description, vendor: e.vendor_name ?? vendorName.get(e.vendor_id) ?? "",
        quantity: Number(e.quantity), uom: e.uom, unitPriceCents: cents(e.unit_price), subtotalCents: cents(e.subtotal), discountCents: cents(e.discount), taxRate: Number(e.tax_rate), taxAmountCents: cents(e.tax_amount),
        totalCents: cents(e.total), receiptNumber: e.receipt_number ?? "", approval: label(e.approval_status, APPROVAL) as ApprovalStatus, notes: e.notes ?? "", createdBy: nameOf.get(e.created_by) ?? "Team member",
        createdAt: e.created_at, sourceInvoiceId: opt(e.source_invoice_id),
      })),
      invoices: by(invoices, p.id).map((i: any): Invoice => ({
        attachmentName: fileName(files, "project_invoice", i.id),
        id: i.id, number: i.invoice_number, projectId: n, vendorId: i.vendor_id, vendorName: vendorName.get(i.vendor_id) ?? "", poId: opt(i.purchase_order_id), taskId: opt(i.task_id), invoiceDate: i.invoice_date,
        receivedDate: dateOnly(i.received_date) ?? i.invoice_date, dueDate: i.due_date, discountCents: cents(i.discount), approval: label(i.approval_status, APPROVAL) as ApprovalStatus, notes: i.notes ?? "",
        createdBy: nameOf.get(i.created_by) ?? "Team member", createdAt: i.created_at,
        lines: lines.filter((l: any) => l.invoice_id === i.id).map((l: any) => ({ id: l.id, description: l.description, quantity: Number(l.quantity), uom: l.uom, unitPriceCents: cents(l.unit_price), taxRate: Number(l.tax_rate) })),
      })),
      payments: by(payments, p.id).map((y: any): Payment => ({
        proofName: markerFile(files, p.id, "payment", y.id),
        id: y.id, projectId: n, payeeId: y.payee_vendor_id, payeeName: vendorName.get(y.payee_vendor_id) ?? "", date: y.payment_date, amountCents: cents(y.amount), method: label(y.method, METHODS) as PaymentMethod,
        reference: y.reference ?? "", allocations: allocationsOf(y.id), notes: y.notes ?? "", recordedBy: nameOf.get(y.recorded_by) ?? "Team member", createdAt: y.created_at,
      })),
      changeOrders: by(cos, p.id).map((c: any): ChangeOrder => ({
        id: c.id, projectId: n, number: c.co_number, description: c.description, reason: c.reason ?? "", requestedBy: c.requested_by ?? "", dateRequested: c.date_requested, costDeltaCents: cents(c.cost_delta),
        scheduleImpactDays: c.schedule_impact_days, supportingDocument: markerFile(files, p.id, "change_order", c.id), approval: label(c.approval_status, APPROVAL) as ApprovalStatus, approver: c.approver_id ? nameOf.get(c.approver_id) : undefined,
        approvalDate: dateOnly(c.approval_date), rejectionReason: opt(c.rejection_reason),
      })),
      quotes: by(quotes, p.id).map((q: any): Quote => ({
        id: q.id, projectId: n, contractorId: q.vendor_id, contractorName: vendorName.get(q.vendor_id) ?? "", number: q.quote_number, issueDate: q.issue_date, expiryDate: dateOnly(q.expiry_date) ?? "",
        description: q.description ?? "", subtotalCents: cents(q.subtotal), taxRate: Number(q.tax_rate), taxCents: cents(q.tax), totalCents: cents(q.total), status: label(q.status, QUOTE_STATUS) as Quote["status"],
      })),
      purchaseOrders: by(pos, p.id).map((o: any): PurchaseOrder => ({
        id: o.id, projectId: n, number: o.po_number, vendorName: o.vendor_name, items: o.items ?? "", quantity: Number(o.quantity ?? 0), subtotalCents: cents(o.subtotal), taxCents: cents(o.tax), totalCents: cents(o.total),
        expectedDelivery: dateOnly(o.expected_delivery) ?? "", approvedBy: o.approved_by ? nameOf.get(o.approved_by) ?? "" : "", approvalDate: dateOnly(o.approval_date) ?? "", status: label(o.status, PO_STATUS) as PurchaseOrder["status"],
      })),
      milestones: by(milestones, p.id).map((m: any): Milestone => ({
        id: m.id, projectId: n, name: m.name, description: m.description ?? "", plannedDate: m.planned_date, actualDate: dateOnly(m.actual_date), status: label(m.status, MILESTONE_STATUS) as Milestone["status"],
        responsible: m.responsible ?? "", notes: m.notes ?? "", requiresInspection: m.requires_inspection,
      })),
      inspections: by(inspections, p.id).map((i: any): Inspection => ({
        id: i.id, projectId: n, taskId: opt(i.task_id), type: i.inspection_type, date: i.inspection_date, inspector: i.inspector ?? "", checklist: Array.isArray(i.checklist) ? i.checklist : [],
        result: label(i.result, INSPECTION_RESULT) as Inspection["result"], findings: i.findings ?? "", attachments: markerFile(files, p.id, "inspection", i.id) ? [markerFile(files, p.id, "inspection", i.id)!] : [], correctiveActions: i.corrective_actions ?? "", reinspectionDate: dateOnly(i.reinspection_date), notes: i.notes ?? "",
      })),
      deficiencies: by(deficiencies, p.id).map((d: any): Deficiency => ({
        id: d.id, projectId: n, inspectionId: opt(d.inspection_id), description: d.description, severity: label(d.severity, SEVERITY) as Deficiency["severity"], assignedTo: d.assigned_to ?? "", dueDate: dateOnly(d.due_date) ?? "",
        status: label(d.status, DEFICIENCY_STATUS) as Deficiency["status"], resolutionNotes: opt(d.resolution_notes), completionEvidence: opt(d.completion_evidence), reinspectionDate: dateOnly(d.reinspection_date),
      })),
      attachmentFiles: (() => {
        const out: Record<string, { bucket: string; path: string; name: string }> = {};
        for (const f of files) {
          const marker = /^(payment|change_order|inspection):(.+)$/.exec(f.description ?? "");
          const key = f.entityType === "project_expense" || f.entityType === "project_invoice" ? f.entityId : f.entityType === "project" && f.entityId === p.id && marker ? marker[2] : null;
          if (key) out[key] = { bucket: f.bucket, path: f.path, name: f.name };
        }
        return out;
      })(),
      documents: (() => {
        const mine = files.filter((f) => f.entityType === "project" && f.entityId === p.id);
        const taskLink = (docId: string) => files.find((f) => f.id === docId && f.entityType === "project_task")?.entityId;
        return mine.map((f): ProjectDocument => ({
          id: f.id, projectId: n, name: f.name, category: f.category as ProjectDocument["category"], fileType: (f.name.split(".").pop() ?? "").toUpperCase() || "FILE", size: fileSize(f.sizeBytes),
          uploadDate: f.uploadedAt.slice(0, 10), uploader: f.uploadedBy, taskId: taskLink(f.id), expiryDate: f.expiryDate, bucket: f.bucket, path: f.path,
          url: photoUrls.get(`${f.bucket}/${f.path}`), stage: f.stage ? ((f.stage[0].toUpperCase() + f.stage.slice(1)) as ProjectDocument["stage"]) : undefined,
          visibility: (f.visibility[0].toUpperCase() + f.visibility.slice(1)) as ProjectDocument["visibility"],
        }));
      })(),
      activity: activityOf(n),
    };
  });
}

/** name of the file stored for a payment / change order / inspection of a project (recorded as a project document tagged "kind:id") */
const markerFile = (files: { entityType: string; entityId: string; name: string; description?: string }[], projectRow: string, kind: string, id: string) =>
  files.find((f) => f.entityType === "project" && f.entityId === projectRow && f.description === `${kind}:${id}`)?.name;

/** name of the file stored for a project expense / invoice (when there is one) */
const fileName = (files: { entityType: string; entityId: string; name: string }[], entityType: string, entityId: string) => files.find((f) => f.entityType === entityType && f.entityId === entityId)?.name;

// ------------------------------------------------------------------ persist (diff)
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
function diff<T extends { id: string }>(prev: T[], next: T[]) {
  const before = new Map(prev.map((r) => [r.id, r]));
  return { added: next.filter((r) => !before.has(r.id)), changed: next.filter((r) => before.has(r.id) && !same(before.get(r.id), r)) };
}
const staffId = (name: string | undefined) => (name ? staffByName.get(name) ?? null : null);
const date = (v: string | undefined) => v || null;

export async function persist(prev: Project[], next: Project[], me: { id: string } | null): Promise<void> {
  const orgId = getActiveOrgId();
  if (!orgId) throw new Error("Select an organization first.");
  const userId = uuid(me?.id);
  const before = new Map(prev.map((p) => [p.id, p]));

  const coreFields = (p: Project) => ({
    name: p.name, property_id: p.propertyId, unit_id: uuid(p.unitId), project_type: slug(p.type), description: p.description || null, reason: p.reason || null, priority: slug(p.priority), status: slug(p.status),
    manager_id: staffId(p.manager), manager_name: p.manager || null, planned_start: date(p.plannedStart), estimated_completion: date(p.estimatedCompletion), actual_start: date(p.actualStart), actual_completion: date(p.actualCompletion),
    occupancy_status: slug(p.occupancyStatus), must_vacate: p.mustVacate, access_requirements: p.accessRequirements || null, move_out_date: date(p.moveOutDate), expected_ready_date: date(p.expectedReadyDate),
    actual_ready_date: date(p.actualReadyDate), utility_shutdowns: p.utilityShutdowns || null, lost_rent: money(p.lostRentCents), readiness_approved: p.readinessApproved, readiness_approved_by: staffId(p.readinessApprovedBy),
    original_budget: money(p.originalBudgetCents), contingency: money(p.contingencyCents), internal_notes: p.internalNotes || null, archived_at: p.archived ? new Date().toISOString() : null,
  });

  // ---- projects first (everything else points at them)
  for (const p of next) {
    const old = before.get(p.id);
    if (!old) {
      check(await supabase.from("projects").insert({ id: rowFor(projectRow, p.id), organization_id: orgId, project_number: p.id, created_by: userId, ...coreFields(p) }), "Unable to save the project.");
    } else if (!same(coreFields(old), coreFields(p))) {
      const res = await supabase.from("projects").update(coreFields(p)).eq("id", projectRow.get(p.id)!).select("id");
      check(res, "Unable to save the project.");
      if (!res.data?.length) throw new Error("You don't have permission to change projects.");
    }
  }

  for (const p of next) {
    const old = before.get(p.id);
    const pid = projectRow.get(p.id)!;
    const o = old ?? ({ tasks: [], team: [], expenses: [], invoices: [], payments: [], changeOrders: [], milestones: [], inspections: [], deficiencies: [], tenantNotifications: [], activity: [] } as unknown as Project);

    const team = diff(o.team, p.team);
    const teamRow = (m: ProjectTeamMember) => ({ vendor_id: m.contractorId, role: m.role, responsibilities: m.responsibilities || null, contract_amount: money(m.contractAmountCents), start_date: date(m.startDate), end_date: date(m.endDate), status: slug(m.status), worker_name: m.workerName ?? null });
    if (team.added.length) check(await supabase.from("project_team_members").insert(team.added.map((m) => ({ id: m.id, organization_id: orgId, project_id: pid, ...teamRow(m) }))), "Unable to save the contractor assignment.");
    for (const m of team.changed) check(await supabase.from("project_team_members").update(teamRow(m)).eq("id", m.id), "Unable to save the contractor assignment.");

    const tasks = diff(o.tasks, p.tasks);
    const taskRow = (t: Task) => ({
      name: t.name, description: t.description || null, category: slug(t.category), assignee_type: slug(t.assigneeType), vendor_id: uuid(t.contractorId), assignee_name: t.assigneeName || null, planned_start: date(t.plannedStart),
      planned_finish: date(t.plannedFinish), actual_start: date(t.actualStart), actual_finish: date(t.actualFinish), estimated_cost: money(t.estimatedCostCents), actual_cost: money(t.actualCostCents), status: slug(t.status),
      priority: slug(t.priority), completion_notes: t.completionNotes ?? null, before_photo_path: t.beforePhoto ?? null, after_photo_path: t.afterPhoto ?? null, inspection_required: t.inspectionRequired,
    });
    if (tasks.added.length) check(await supabase.from("project_tasks").insert(tasks.added.map((t) => ({ id: t.id, organization_id: orgId, project_id: pid, created_by: userId, ...taskRow(t) }))), "Unable to save the task.");
    for (const t of tasks.changed) check(await supabase.from("project_tasks").update(taskRow(t)).eq("id", t.id), "Unable to save the task.");
    for (const t of [...tasks.added, ...tasks.changed]) {
      if (same(o.tasks.find((x) => x.id === t.id)?.dependencies ?? [], t.dependencies)) continue;
      check(await supabase.from("project_task_dependencies").delete().eq("task_id", t.id), "Unable to save task dependencies.");
      const wanted = [...new Set(t.dependencies)].filter((d) => d !== t.id);
      if (wanted.length) check(await supabase.from("project_task_dependencies").insert(wanted.map((d) => ({ organization_id: orgId, task_id: t.id, depends_on_id: d }))), "Unable to save task dependencies.");
    }

    const invoices = diff(o.invoices, p.invoices);
    const invoiceRow = (i: Invoice) => ({
      invoice_number: i.number, vendor_id: i.vendorId, task_id: uuid(i.taskId), purchase_order_id: uuid(i.poId), invoice_date: i.invoiceDate, received_date: date(i.receivedDate), due_date: i.dueDate, discount: money(i.discountCents),
      approval_status: slug(i.approval), notes: i.notes || null,
    });
    if (invoices.added.length) check(await supabase.from("project_invoices").insert(invoices.added.map((i) => ({ id: i.id, organization_id: orgId, project_id: pid, created_by: userId, ...invoiceRow(i) }))), "Unable to save the invoice.");
    for (const i of invoices.changed) check(await supabase.from("project_invoices").update(invoiceRow(i)).eq("id", i.id), "Unable to save the invoice.");
    for (const i of [...invoices.added, ...invoices.changed]) {
      if (same(o.invoices.find((x) => x.id === i.id)?.lines ?? [], i.lines)) continue;
      check(await supabase.from("project_invoice_lines").delete().eq("invoice_id", i.id), "Unable to save the invoice lines.");
      if (i.lines.length) check(await supabase.from("project_invoice_lines").insert(i.lines.map((l, position) => ({ id: uuid(l.id) ?? crypto.randomUUID(), organization_id: orgId, invoice_id: i.id, position, description: l.description, quantity: l.quantity, uom: l.uom, unit_price: money(l.unitPriceCents), tax_rate: l.taxRate }))), "Unable to save the invoice lines.");
    }

    const expenses = diff(o.expenses, p.expenses);
    const expenseRow = (e: Expense) => ({
      task_id: uuid(e.taskId), source_invoice_id: uuid(e.sourceInvoiceId), expense_date: e.date, category: slug(e.category), description: e.description, vendor_name: e.vendor || null, quantity: e.quantity, uom: e.uom || "ea",
      unit_price: money(e.unitPriceCents), discount: money(e.discountCents), tax_rate: e.taxRate, receipt_number: e.receiptNumber || null, approval_status: slug(e.approval), notes: e.notes || null,
    });
    if (expenses.added.length) check(await supabase.from("project_expenses").insert(expenses.added.map((e) => ({ id: e.id, organization_id: orgId, project_id: pid, created_by: userId, ...expenseRow(e) }))), "Unable to save the expense.");
    for (const e of expenses.changed) check(await supabase.from("project_expenses").update(expenseRow(e)).eq("id", e.id), "Unable to save the expense.");

    // payments are recorded once (the database checks the allocations against the invoice balances)
    for (const y of diff(o.payments, p.payments).added) {
      check(await supabase.from("project_payments").insert({
        id: y.id, organization_id: orgId, project_id: pid, payee_vendor_id: y.payeeId, payment_date: y.date, amount: money(y.amountCents), method: slug(y.method), reference: y.reference || null, notes: y.notes || null, recorded_by: userId,
      }), "Unable to save the payment.");
      if (y.allocations.length) check(await supabase.from("project_payment_allocations").insert(y.allocations.map((a) => ({ organization_id: orgId, payment_id: y.id, invoice_id: a.invoiceId, amount: money(a.amountCents) }))), "Unable to save the payment allocations.");
    }

    const orders = diff(o.changeOrders, p.changeOrders);
    const coRow = (c: ChangeOrder) => ({
      co_number: c.number, description: c.description, reason: c.reason || null, requested_by: c.requestedBy || null, date_requested: c.dateRequested, cost_delta: money(c.costDeltaCents), schedule_impact_days: c.scheduleImpactDays,
      approval_status: slug(c.approval), approver_id: staffId(c.approver), approval_date: date(c.approvalDate), rejection_reason: c.rejectionReason ?? null,
    });
    if (orders.added.length) check(await supabase.from("project_change_orders").insert(orders.added.map((c) => ({ id: c.id, organization_id: orgId, project_id: pid, ...coRow(c) }))), "Unable to save the change order.");
    for (const c of orders.changed) check(await supabase.from("project_change_orders").update(coRow(c)).eq("id", c.id), "Unable to save the change order.");

    const milestones = diff(o.milestones, p.milestones);
    const milestoneRow = (m: Milestone) => ({ name: m.name, description: m.description || null, planned_date: m.plannedDate, actual_date: date(m.actualDate), status: slug(m.status), responsible: m.responsible || null, notes: m.notes || null, requires_inspection: m.requiresInspection });
    if (milestones.added.length) check(await supabase.from("project_milestones").insert(milestones.added.map((m) => ({ id: m.id, organization_id: orgId, project_id: pid, ...milestoneRow(m) }))), "Unable to save the milestones.");
    for (const m of milestones.changed) check(await supabase.from("project_milestones").update(milestoneRow(m)).eq("id", m.id), "Unable to save the milestone.");

    const inspections = diff(o.inspections, p.inspections);
    const inspectionRow = (i: Inspection) => ({
      task_id: uuid(i.taskId), inspection_type: i.type, inspection_date: i.date, inspector: i.inspector || null, checklist: i.checklist, result: slug(i.result), findings: i.findings || null,
      corrective_actions: i.correctiveActions || null, reinspection_date: date(i.reinspectionDate), notes: i.notes || null,
    });
    if (inspections.added.length) check(await supabase.from("project_inspections").insert(inspections.added.map((i) => ({ id: i.id, organization_id: orgId, project_id: pid, ...inspectionRow(i) }))), "Unable to save the inspection.");
    for (const i of inspections.changed) check(await supabase.from("project_inspections").update(inspectionRow(i)).eq("id", i.id), "Unable to save the inspection.");

    const deficiencies = diff(o.deficiencies, p.deficiencies);
    const deficiencyRow = (d: Deficiency) => ({
      inspection_id: uuid(d.inspectionId), description: d.description, severity: slug(d.severity), assigned_to: d.assignedTo || null, due_date: date(d.dueDate), status: slug(d.status),
      resolution_notes: d.resolutionNotes ?? null, completion_evidence: d.completionEvidence ?? null, reinspection_date: date(d.reinspectionDate),
    });
    if (deficiencies.added.length) check(await supabase.from("project_deficiencies").insert(deficiencies.added.map((d) => ({ id: d.id, organization_id: orgId, project_id: pid, ...deficiencyRow(d) }))), "Unable to save the deficiency.");
    for (const d of deficiencies.changed) check(await supabase.from("project_deficiencies").update(deficiencyRow(d)).eq("id", d.id), "Unable to save the deficiency.");

    if (!same(o.tenantNotifications, p.tenantNotifications)) {
      check(await supabase.from("project_tenant_notifications").delete().eq("project_id", pid), "Unable to save the tenant notifications.");
      if (p.tenantNotifications.length) check(await supabase.from("project_tenant_notifications").insert(p.tenantNotifications.map((t) => ({ organization_id: orgId, project_id: pid, notified_on: t.date, channel: t.channel, note: t.note || null }))), "Unable to save the tenant notifications.");
    }

    // activity history -> audit trail (best-effort: a logging failure never undoes a saved change)
    for (const a of diff(o.activity, p.activity).added) {
      await supabase.rpc("record_activity", {
        p_org: orgId, p_action: `project.${a.kind}`, p_category: "Projects", p_description: a.detail, p_entity_type: "project", p_entity_id: p.id, p_label: a.action,
        p_metadata: { projectId: p.id, kind: a.kind, action: a.action }, p_source_module: "Projects",
      });
    }
  }
}
