// Fills the report tables from the organization's real projects (Supabase mode). The report engine (../lib/data-service) then works exactly as
// with the sample data. What the database does not record yet — risks, handover checklists and outcome reviews — stays empty, and buildings
// are not tracked separately from properties.
//   projects          <- projects (+ change orders, team, invoices, expenses, tasks for cost, revisions and progress)
//   milestones        <- project_milestones          change orders <- project_change_orders
//   monthly spending  <- project expenses + invoices issues        <- project_deficiencies
//   audit log         <- activity_events "project.*" contractors   <- vendors on the project team / invoices
import { db } from "./memory";
import { supabase } from "../../lib/supabase";
import { fetchAll } from "../../lib/financeData";
import { loadStaff } from "../../properties/add/store/refRepo";
import { auditLogs, changeOrders, contractors, issues, milestones, monthlySpending, projectManagers, projects, properties } from "./schema";

/* eslint-disable @typescript-eslint/no-explicit-any -- rows come from untyped PostgREST responses */

let loadedFor: string | null = null;

const num = (v: unknown) => Number(v ?? 0);
const money = (v: number) => v.toFixed(2);
const day = (v: string | null | undefined) => (v ? String(v).slice(0, 10) : "");
const addDays = (date: string, days: number) => {
  if (!date) return date;
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};
const months = (start: string, end: string) => {
  const out: string[] = [];
  if (!start || !end || end < start) return out;
  const d = new Date(`${start.slice(0, 7)}-01T12:00:00`);
  while (d.toISOString().slice(0, 7) <= end.slice(0, 7) && out.length < 120) {
    out.push(d.toISOString().slice(0, 7));
    d.setMonth(d.getMonth() + 1);
  }
  return out;
};

const CATEGORY: Record<string, string> = {
  renovation: "Renovation", repair: "Major Repair", maintenance: "Major Repair", upgrade: "Building Upgrade", restoration: "Capital Improvement", other: "Capital Improvement",
};
const STATUS: Record<string, string> = {
  draft: "Proposed", planned: "Pending Approval", approved: "Approved", in_progress: "In Progress", on_hold: "On Hold", completed: "Completed", cancelled: "Cancelled",
};
const CO_STATUS: Record<string, string> = { approved: "Approved", rejected: "Rejected", cancelled: "Cancelled", draft: "Pending", pending_approval: "Pending" };
const SEVERITY: Record<string, string> = { low: "Low", medium: "Medium", high: "High", critical: "Critical" };
const ISSUE_STATUS: Record<string, string> = { open: "Open", in_progress: "In Progress", resolved: "Resolved", verified: "Resolved" };

/** Reads the organization's project data into the report tables. Re-reads when `force` is set or the organization changed. */
export async function loadReportData(orgId: string, force = false): Promise<void> {
  if (!force && loadedFor === orgId) return;
  const today = new Date().toISOString().slice(0, 10);
  const [props, units, prjs, team, tasks, invoices, lines, expenses, cos, mls, defs, inspections, vendors, staff, events] = await Promise.all([
    fetchAll("properties", "id, code, name, address_line1, city, state_province, property_type", orgId, "name"),
    fetchAll("units", "id, property_id", orgId, "property_id"),
    fetchAll("projects", "*", orgId, "created_at"),
    fetchAll("project_team_members", "project_id, vendor_id, contract_amount, status", orgId, "project_id"),
    fetchAll("project_tasks", "project_id, status, estimated_cost", orgId, "project_id"),
    fetchAll("project_invoices", "id, project_id, vendor_id, invoice_date, discount, approval_status", orgId, "invoice_date"),
    fetchAll("project_invoice_lines", "invoice_id, subtotal, tax_amount", orgId, "invoice_id"),
    fetchAll("project_expenses", "project_id, expense_date, total, approval_status, source_invoice_id", orgId, "expense_date"),
    fetchAll("project_change_orders", "*", orgId, "date_requested"),
    fetchAll("project_milestones", "*", orgId, "planned_date"),
    fetchAll("project_deficiencies", "*", orgId, "due_date"),
    fetchAll("project_inspections", "id, inspection_date", orgId, "inspection_date"),
    fetchAll("vendors", "id, company_name, contact_name, email, phone, trade, categories, rating, insurance_expiry, is_active", orgId, "company_name"),
    loadStaff(orgId).catch(() => []),
    supabase.from("activity_events").select("id, actor_display_name, occurred_at, related_record_label, description, metadata").eq("organization_id", orgId).like("action", "project.%").order("occurred_at", { ascending: false }).limit(1000),
  ]);
  const staffName = new Map(staff.map((s) => [s.id, s.name]));
  const vendorOf = new Map<string, any>(vendors.map((v: any) => [v.id, v]));
  const invoiceTotal = new Map<string, number>();
  for (const l of lines) invoiceTotal.set(l.invoice_id, (invoiceTotal.get(l.invoice_id) ?? 0) + num(l.subtotal) + num(l.tax_amount));
  const totalOf = (i: any) => Math.max(0, (invoiceTotal.get(i.id) ?? 0) - num(i.discount));
  const numberOf = new Map<string, string>(prjs.map((p: any) => [p.id, p.project_number ?? p.id]));
  const rowOfNumber = new Map<string, string>(prjs.map((p: any) => [p.project_number ?? p.id, p.id]));

  db.reset();
  db.insert(properties).values(props.map((p: any) => ({
    id: p.id, name: p.name, code: p.code ?? "", address: p.address_line1 ?? "", city: p.city ?? "", state: p.state_province ?? "", totalUnits: units.filter((u: any) => u.property_id === p.id).length,
    propertyType: String(p.property_type ?? "").replace(/_/g, " "),
  })));

  // managers: staff members, or the name typed on the project
  const managers = new Map<string, { id: string; name: string }>();
  for (const p of prjs) {
    const id = p.manager_id ?? (p.manager_name ? `name:${p.manager_name}` : "unassigned");
    managers.set(id, { id, name: (p.manager_id ? staffName.get(p.manager_id) : undefined) ?? p.manager_name ?? "Unassigned" });
  }
  db.insert(projectManagers).values([...managers.values()].map((m) => ({ id: m.id, name: m.name, email: "", phone: null, title: "Project Manager", department: "Projects" })));

  // contractors on the projects (team members first, then invoicing vendors)
  const mainContractor = new Map<string, string>();
  for (const t of team) if (!mainContractor.has(t.project_id)) mainContractor.set(t.project_id, t.vendor_id);
  for (const i of invoices) if (!mainContractor.has(i.project_id)) mainContractor.set(i.project_id, i.vendor_id);
  const usedVendors = new Set<string>([...team.map((t: any) => t.vendor_id), ...invoices.map((i: any) => i.vendor_id)]);
  db.insert(contractors).values([...usedVendors].map((id) => vendorOf.get(id)).filter(Boolean).map((v: any) => ({
    id: v.id, name: v.company_name, trade: v.trade ?? v.categories?.[0] ?? "", contactPerson: v.contact_name ?? "", email: v.email ?? "", phone: v.phone ?? null,
    complianceStatus: !v.is_active ? "Inactive" : v.insurance_expiry && day(v.insurance_expiry) < today ? "Insurance Expired" : "Active & Verified", insuranceExpiry: day(v.insurance_expiry), rating: v.rating === null ? null : String(v.rating),
  })));

  const projectRows = prjs.map((p: any) => {
    const approvedCos = cos.filter((c: any) => c.project_id === p.id && c.approval_status === "approved");
    const revisions = approvedCos.reduce((s: number, c: any) => s + num(c.cost_delta), 0);
    const delayDays = approvedCos.reduce((s: number, c: any) => s + num(c.schedule_impact_days), 0);
    const approvedInvoices = invoices.filter((i: any) => i.project_id === p.id && i.approval_status === "approved");
    const invoicedIds = new Set(approvedInvoices.map((i: any) => i.id));
    const directExpenses = expenses.filter((e: any) => e.project_id === p.id && e.approval_status === "approved" && !(e.source_invoice_id && invoicedIds.has(e.source_invoice_id)));
    const actual = approvedInvoices.reduce((s: number, i: any) => s + totalOf(i), 0) + directExpenses.reduce((s: number, e: any) => s + num(e.total), 0);
    const contracts = team.filter((t: any) => t.project_id === p.id && t.status !== "released").reduce((s: number, t: any) => s + num(t.contract_amount), 0);
    const committed = Math.max(contracts, actual);
    const budget = num(p.original_budget) + revisions;
    const done = p.status === "completed";
    const forecastFinal = done ? actual : Math.max(committed, actual, budget);
    const start = day(p.planned_start);
    const end = day(p.estimated_completion);
    const span = start && end ? Math.max(1, (Date.parse(end) - Date.parse(start)) / 86400000) : 0;
    const elapsed = start ? Math.max(0, (Date.parse(today) - Date.parse(start)) / 86400000) : 0;
    const planned = done ? 100 : span ? Math.min(100, Math.round((elapsed / span) * 100)) : null;
    const own = tasks.filter((t: any) => t.project_id === p.id);
    const weight = own.reduce((s: number, t: any) => s + (num(t.estimated_cost) || 1), 0);
    const doneWeight = own.filter((t: any) => t.status === "completed").reduce((s: number, t: any) => s + (num(t.estimated_cost) || 1), 0);
    const progress = done ? 100 : own.length ? Math.round((doneWeight / weight) * 100) : null;
    const complete = num(p.original_budget) > 0 && start && end;
    return {
      id: p.id, code: numberOf.get(p.id), name: p.name, propertyId: p.property_id, buildingId: null, managerId: p.manager_id ?? (p.manager_name ? `name:${p.manager_name}` : "unassigned"),
      contractorId: mainContractor.get(p.id) ?? "", category: CATEGORY[p.project_type] ?? "Capital Improvement", status: STATUS[p.status] ?? "Proposed",
      originalStartDate: start, originalEndDate: end, forecastEndDate: done ? day(p.actual_completion) || end : addDays(end, delayDays), actualStartDate: day(p.actual_start) || null, actualEndDate: day(p.actual_completion) || null,
      originalBudget: money(num(p.original_budget)), approvedRevisions: money(revisions), committedCost: money(committed), actualCost: money(actual), forecastFinalCost: money(forecastFinal),
      plannedProgress: planned === null ? null : String(planned), actualProgress: progress === null ? null : String(progress), progressUpdatedAt: day(p.updated_at) || null, progressUpdatedBy: null,
      scopeDescription: p.description ?? "", businessObjective: p.reason ?? "", dataCompleteness: complete ? (own.length ? "Complete" : "Partial") : "Incomplete",
      dataNotes: complete ? null : "Budget or planned dates are missing.", createdAt: p.created_at,
    };
  });
  db.insert(projects).values(projectRows);

  db.insert(milestones).values(prjs.flatMap((p: any) => {
    const mine = mls.filter((m: any) => m.project_id === p.id).sort((a: any, b: any) => String(a.planned_date).localeCompare(String(b.planned_date)));
    return mine.map((m: any, i: number) => ({
      id: m.id, milestoneCode: `${numberOf.get(p.id)}-M${i + 1}`, projectId: p.id, name: m.name, plannedStart: i ? day(mine[i - 1].planned_date) : day(p.planned_start) || day(m.planned_date),
      plannedEnd: day(m.planned_date), forecastEnd: day(m.actual_date) || day(m.planned_date), actualEnd: day(m.actual_date) || null, responsiblePerson: m.responsible ?? "", dependency: i ? mine[i - 1].name : null,
      status: m.status === "completed" ? "Completed" : m.status === "in_progress" ? "In Progress" : day(m.planned_date) < today ? "Delayed" : "Pending", notes: m.notes ?? null,
    }));
  }));

  db.insert(monthlySpending).values(projectRows.flatMap((p: any) => {
    const periods = months(p.originalStartDate, p.forecastEndDate || p.originalEndDate);
    const extra = new Set<string>();
    const incurred = new Map<string, number>();
    const committed = new Map<string, number>();
    for (const i of invoices.filter((x: any) => x.project_id === p.id && x.approval_status !== "rejected" && x.approval_status !== "cancelled")) {
      const m = day(i.invoice_date).slice(0, 7);
      extra.add(m);
      committed.set(m, (committed.get(m) ?? 0) + totalOf(i));
      if (i.approval_status === "approved") incurred.set(m, (incurred.get(m) ?? 0) + totalOf(i));
    }
    for (const e of expenses.filter((x: any) => x.project_id === p.id && x.approval_status === "approved" && !x.source_invoice_id)) {
      const m = day(e.expense_date).slice(0, 7);
      extra.add(m);
      incurred.set(m, (incurred.get(m) ?? 0) + num(e.total));
      committed.set(m, (committed.get(m) ?? 0) + num(e.total));
    }
    const all = [...new Set([...periods, ...extra])].sort();
    const perMonth = periods.length ? (num(p.originalBudget) + num(p.approvedRevisions)) / periods.length : 0;
    return all.map((period) => ({
      id: `${p.id}-${period}`, projectId: p.id, period, budgetAllocated: money(periods.includes(period) ? perMonth : 0), committedAmount: money(committed.get(period) ?? 0), actualIncurred: money(incurred.get(period) ?? 0),
    }));
  }));

  db.insert(changeOrders).values(cos.map((c: any) => ({
    id: c.id, coNumber: `${numberOf.get(c.project_id)} ${c.co_number}`, projectId: c.project_id, requestDate: day(c.date_requested), requestedBy: c.requested_by ?? "", description: c.description, reason: c.reason ?? "",
    scopeReference: "", costImpact: money(num(c.cost_delta)), scheduleImpactDays: num(c.schedule_impact_days), status: CO_STATUS[c.approval_status] ?? "Pending",
    approver: c.approver_id ? staffName.get(c.approver_id) ?? null : null, approvalDate: day(c.approval_date) || null, budgetRevisionId: null, supportingDocs: null,
  })));

  const inspectionDate = new Map<string, string>(inspections.map((i: any) => [i.id, day(i.inspection_date)]));
  db.insert(issues).values(prjs.flatMap((p: any) => defs.filter((d: any) => d.project_id === p.id).map((d: any, i: number) => ({
    id: d.id, issueCode: `${numberOf.get(p.id)}-D${i + 1}`, projectId: p.id, description: d.description, severity: SEVERITY[d.severity] ?? "Medium",
    identifiedDate: (d.inspection_id ? inspectionDate.get(d.inspection_id) : "") || day(d.due_date), responsiblePerson: d.assigned_to ?? "", resolutionTarget: day(d.due_date),
    actualResolutionDate: ["resolved", "verified"].includes(d.status) ? day(d.reinspection_date) || null : null, status: ISSUE_STATUS[d.status] ?? "Open", scheduleImpactDays: 0, costImpact: "0",
    resolutionNotes: d.resolution_notes ?? null,
  }))));

  db.insert(auditLogs).values((events.data ?? []).filter((e: any) => rowOfNumber.has(e.metadata?.projectId)).map((e: any) => ({
    id: e.id, projectId: rowOfNumber.get(e.metadata.projectId), entityType: e.metadata?.kind ?? "project", action: e.related_record_label || e.metadata?.action || "Updated", fieldChanged: null,
    oldValue: null, newValue: null, changedBy: e.actor_display_name, timestamp: String(e.occurred_at).replace("T", " ").slice(0, 19), notes: e.description,
  })));

  loadedFor = orgId;
}
