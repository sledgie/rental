// Fills the Property Performance tables from the organization's real records (Supabase mode). The scoring engine (./dataService,
// ../lib/scoring) then works as with the sample data.
//   work orders       <- maintenance requests (SLA target by priority, repeat issues on the same unit/category within 90 days)
//   inspections       <- project inspections (results) and preventive schedules (scheduled / overdue)
//   findings          <- project deficiencies         assets <- assets (+ requests per asset)
//   capital projects  <- projects                     leases <- leases (+ renewals)
//   managers          <- your staff                   buildings: one per property (buildings are not tracked separately)
// Unit turnover logs and tenant complaints are not recorded yet, so those inputs stay empty and the scores say so.
import { db } from "./memory";
import { fetchAll } from "../../lib/financeData";
import { loadStaff } from "../../properties/add/store/refRepo";
import { assets, buildings, capitalProjects, inspectionFindings, inspections, leases, managementActions, properties, propertyManagers, scoringConfigurations, tenantComplaints, turnoverRecords, units, workOrders } from "./schema";

/* eslint-disable @typescript-eslint/no-explicit-any -- rows come from untyped PostgREST responses */

const num = (v: unknown) => Number(v ?? 0);
const day = (v: string | null | undefined) => (v ? String(v).slice(0, 10) : null);
const hoursBetween = (a: string, b: string) => Math.max(0, (Date.parse(b) - Date.parse(a)) / 3600000);
const SLA_HOURS: Record<string, number> = { emergency: 4, high: 24, normal: 72, low: 168 };
const PRIORITY: Record<string, string> = { emergency: "Emergency", high: "High", normal: "Medium", low: "Low" };
const CONDITION_SCORE: Record<string, number> = { excellent: 95, good: 80, fair: 62, poor: 40, failed: 20 };
const USEFUL_LIFE: [RegExp, number][] = [[/roof/i, 25], [/hvac|furnace|boiler|heat|air|chiller/i, 15], [/water heater|tank/i, 10], [/fridge|refrigerator|stove|range|oven|dishwasher|washer|dryer|appliance/i, 12], [/elevator/i, 25], [/window|door/i, 30], [/floor|carpet/i, 10]];

let loadedFor: string | null = null;

export async function loadPerformanceData(orgId: string, force = false): Promise<void> {
  if (!force && loadedFor === orgId) return;
  const today = new Date().toISOString().slice(0, 10);
  const now = new Date().toISOString();
  const [props, unitRows, requests, visits, schedules, projectInspections, deficiencies, assetRows, projects, leaseRows, leaseUnits, parties, tenants, renewals, vendors, staff] = await Promise.all([
    fetchAll("properties", "id, code, name, property_type, address_line1, city, state_province, postal_code, year_built, property_manager_id, archived_at", orgId, "name"),
    fetchAll("units", "id, property_id, unit_number, floor, bedrooms, bathrooms, square_feet, unit_status, archived_at", orgId, "unit_number"),
    fetchAll("maintenance_requests", "id, request_number, property_id, unit_id, asset_id, category, priority, status, title, description, reported_at, completed_at, assigned_staff_id, assigned_vendor_id, resolution_notes, created_at", orgId, "reported_at"),
    fetchAll("maintenance_visits", "request_id, visit_date, status", orgId, "visit_date"),
    fetchAll("maintenance_schedules", "id, schedule_number, task, category, property_id, unit_id, frequency, last_completed, next_due, is_active", orgId, "next_due"),
    fetchAll("project_inspections", "id, project_id, inspection_type, inspection_date, inspector, result", orgId, "inspection_date"),
    fetchAll("project_deficiencies", "id, project_id, inspection_id, description, severity, assigned_to, due_date, status, resolution_notes, reinspection_date", orgId, "due_date"),
    fetchAll("assets", "id, asset_number, name, asset_type, property_id, install_date, purchase_date, purchase_price, condition, status, last_inspection, next_service", orgId, "name"),
    fetchAll("projects", "id, project_number, name, property_id, project_type, description, planned_start, estimated_completion, actual_start, actual_completion, status, original_budget, priority, archived_at", orgId, "planned_start"),
    fetchAll("leases", "id, lease_number, status, start_date, end_date", orgId, "start_date"),
    fetchAll("lease_units", "lease_id, unit_id", orgId, "lease_id"),
    fetchAll("lease_parties", "lease_id, tenant_id, role", orgId, "lease_id"),
    fetchAll("tenants", "id, first_name, last_name", orgId, "last_name"),
    fetchAll("lease_renewals", "original_lease_id, status, created_at", orgId, "created_at"),
    fetchAll("vendors", "id, company_name", orgId, "company_name"),
    loadStaff(orgId).catch(() => []),
  ]);
  const staffName = new Map(staff.map((s): [string, string] => [s.id, s.name]));
  const vendorName = new Map<string, string>(vendors.map((v: any) => [v.id, v.company_name]));
  const tenantName = new Map<string, string>(tenants.map((t: any) => [t.id, `${t.first_name} ${t.last_name ?? ""}`.trim()]));
  const projectProperty = new Map<string, string>(projects.map((p: any) => [p.id, p.property_id]));
  const unitProperty = new Map<string, string>(unitRows.map((u: any) => [u.id, u.property_id]));
  const liveProps = props.filter((p: any) => !p.archived_at);

  db.reset();
  db.insert(scoringConfigurations).values({ id: "default-config" });

  const managerIds = [...new Set(liveProps.map((p: any) => p.property_manager_id).filter(Boolean))] as string[];
  db.insert(propertyManagers).values(managerIds.map((id) => ({ id, name: staffName.get(id) ?? "Team member", email: "", phone: "", role: "Property Manager" })));

  // ---- work orders (maintenance requests)
  const reqs = requests.filter((r: any) => !["draft", "rejected"].includes(r.status));
  const woRows = reqs.map((r: any) => {
    const reported = r.reported_at ?? r.created_at;
    const target = SLA_HOURS[r.priority] ?? 72;
    const done = ["completed", "closed"].includes(r.status) && r.completed_at;
    const duration = done ? hoursBetween(reported, r.completed_at) : null;
    const repeat = reqs.some((o: any) => o.id !== r.id && o.unit_id && o.unit_id === r.unit_id && o.category === r.category && (o.reported_at ?? o.created_at) < reported && hoursBetween(o.reported_at ?? o.created_at, reported) <= 90 * 24);
    const firstVisit = visits.filter((v: any) => v.request_id === r.id).map((v: any) => v.visit_date).sort()[0] ?? null;
    return {
      id: r.id, woNumber: r.request_number ?? r.id, propertyId: r.property_id, buildingId: `bld-${r.property_id}`, unitId: r.unit_id ?? null, category: r.category, priority: PRIORITY[r.priority] ?? "Medium",
      maintenanceType: /preventive|inspection|schedule/i.test(`${r.title} ${r.description ?? ""}`) ? "Preventive" : "Reactive", reportedDate: day(reported), scheduledDate: firstVisit, completedDate: done ? day(r.completed_at) : null,
      targetSlaHours: target, actualDurationHours: duration === null ? null : duration.toFixed(2), slaCompliant: done ? (duration ?? 0) <= target : hoursBetween(reported, now) <= target,
      status: done ? "Completed" : r.status === "cancelled" ? "Cancelled" : r.status === "on_hold" ? "Pending Parts" : ["in_progress", "assigned"].includes(r.status) ? "In Progress" : "Open",
      assignedTo: r.assigned_vendor_id ? vendorName.get(r.assigned_vendor_id) ?? "Vendor" : r.assigned_staff_id ? staffName.get(r.assigned_staff_id) ?? "Staff" : "Unassigned",
      assignedRole: r.assigned_vendor_id ? "Vendor" : "In-House Tech", resolutionNotes: r.resolution_notes ?? null, isRepeatIssue: repeat,
    };
  });
  db.insert(workOrders).values(woRows);

  // contractor on-time rate per property: vendor work completed within its target time
  const onTime = new Map<string, number>();
  for (const p of liveProps) {
    const vendorDone = woRows.filter((w: any) => w.propertyId === p.id && w.assignedRole === "Vendor" && w.status === "Completed");
    // with no vendor work yet, the on-time rate of all completed work stands in
    const sample = vendorDone.length ? vendorDone : woRows.filter((w: any) => w.propertyId === p.id && w.status === "Completed");
    if (sample.length) onTime.set(p.id, Math.round((sample.filter((w: any) => w.slaCompliant).length / sample.length) * 100));
  }

  db.insert(properties).values(liveProps.map((p: any) => {
    const own = unitRows.filter((u: any) => u.property_id === p.id && !u.archived_at);
    return {
      id: p.id, code: p.code ?? "", name: p.name, type: String(p.property_type ?? "").replace(/_/g, " "), address: p.address_line1 ?? "", city: p.city ?? "", state: p.state_province ?? "", zip: p.postal_code ?? "",
      yearBuilt: p.year_built ?? null, totalBuildings: 1, totalUnits: own.length, managerId: p.property_manager_id ?? "", targetScore: "80.0", active: true,
      hasSufficientData: own.length > 0 && woRows.some((w: any) => w.propertyId === p.id), contractorOnTimeRate: onTime.get(p.id) ?? null,
    };
  }));
  db.insert(buildings).values(liveProps.map((p: any) => ({ id: `bld-${p.id}`, propertyId: p.id, name: "Main building", floors: 1, unitsCount: unitRows.filter((u: any) => u.property_id === p.id && !u.archived_at).length })));
  db.insert(units).values(unitRows.filter((u: any) => !u.archived_at).map((u: any) => ({
    id: u.id, propertyId: u.property_id, buildingId: `bld-${u.property_id}`, unitNumber: u.unit_number, floor: Number.parseInt(String(u.floor ?? ""), 10) || 1, bedrooms: num(u.bedrooms), bathrooms: String(num(u.bathrooms)),
    squareFeet: num(u.square_feet), status: ["occupied", "notice"].includes(u.unit_status) ? "Occupied" : ["vacant", "reserved"].includes(u.unit_status) ? "Vacant Ready" : "Vacant Not Ready",
  })));

  // ---- inspections: results of project inspections, and preventive schedules (overdue when past due)
  const SCORE: Record<string, number> = { pass: 90, conditional: 70, fail: 45 };
  const RESULT: Record<string, string> = { pass: "Pass", conditional: "Pass with Notes", fail: "Fail" };
  db.insert(inspections).values([
    ...projectInspections.map((i: any) => ({
      id: i.id, refNumber: i.inspection_type, propertyId: projectProperty.get(i.project_id) ?? "", buildingId: null, unitId: null, inspectionType: i.inspection_type, scheduledDate: day(i.inspection_date),
      inspectionDate: i.result === "scheduled" ? null : day(i.inspection_date), inspectorName: i.inspector ?? "", status: i.result === "scheduled" ? (day(i.inspection_date)! < today ? "Overdue" : "Scheduled") : "Completed",
      overallResult: RESULT[i.result] ?? null, conditionScore: SCORE[i.result] ?? null, completionDate: i.result === "scheduled" ? null : day(i.inspection_date),
    })),
    ...schedules.filter((s: any) => s.is_active).map((s: any) => ({
      id: s.id, refNumber: s.schedule_number ?? s.task, propertyId: s.property_id, buildingId: null, unitId: s.unit_id ?? null, inspectionType: s.task, scheduledDate: day(s.next_due),
      inspectionDate: null, inspectorName: "", status: day(s.next_due)! < today ? "Overdue" : "Scheduled", overallResult: null, conditionScore: null, completionDate: day(s.last_completed),
    })),
  ]);
  db.insert(inspectionFindings).values(deficiencies.map((d: any) => ({
    id: d.id, inspectionId: d.inspection_id ?? null, propertyId: projectProperty.get(d.project_id) ?? "", severity: ({ low: "Low", medium: "Medium", high: "High", critical: "Critical" } as Record<string, string>)[d.severity] ?? "Medium",
    category: "General", description: d.description, correctiveActionRequired: d.resolution_notes ?? "", assignedTo: d.assigned_to ?? "", dueDate: day(d.due_date),
    resolutionStatus: ["resolved", "verified"].includes(d.status) ? "Resolved" : d.status === "in_progress" ? "In Progress" : "Open", resolvedDate: ["resolved", "verified"].includes(d.status) ? day(d.reinspection_date) : null,
  })));

  // ---- assets
  db.insert(assets).values(assetRows.filter((a: any) => !["retired", "disposed", "replaced"].includes(a.status)).map((a: any) => {
    const installed = day(a.install_date) ?? day(a.purchase_date);
    const life = USEFUL_LIFE.find(([re]) => re.test(`${a.asset_type} ${a.name}`))?.[1] ?? 15;
    const age = installed ? (Date.parse(today) - Date.parse(installed)) / (365.25 * 86400000) : null;
    const remaining = age === null ? life : Math.round((life - age) * 10) / 10;
    const repairs = reqs.filter((r: any) => r.asset_id === a.id).length;
    const stale = reqs.some((r: any) => r.asset_id === a.id && !["completed", "closed", "cancelled"].includes(r.status) && hoursBetween(r.reported_at ?? r.created_at, now) > 90 * 24);
    const condition = String(a.condition ?? "good");
    return {
      id: a.id, assetTag: a.asset_number ?? a.id, propertyId: a.property_id, buildingId: `bld-${a.property_id}`, componentName: a.name, category: a.asset_type, installDate: installed, estimatedUsefulLifeYears: life,
      remainingUsefulLifeYears: String(remaining), conditionRating: condition === "failed" ? "Critical" : condition[0].toUpperCase() + condition.slice(1), conditionScore: CONDITION_SCORE[condition] ?? 75,
      lastInspectionDate: day(a.last_inspection), repairCount: repairs, replacementPriority: condition === "failed" || remaining <= 0 ? "Critical" : condition === "poor" || remaining <= 2 ? "High" : remaining <= 5 ? "Medium" : "Low",
      deferredMaintenance: stale, estimatedReplacementCost: num(a.purchase_price) || 5000,
    };
  }));

  // ---- capital projects
  const PROJECT_STATUS: Record<string, string> = { draft: "Planning", planned: "Planning", approved: "Approved", in_progress: "In Progress", on_hold: "On Hold", completed: "Completed", cancelled: "Cancelled" };
  db.insert(capitalProjects).values(projects.filter((p: any) => !p.archived_at).map((p: any) => ({
    id: p.id, projectCode: p.project_number ?? p.id, propertyId: p.property_id, title: p.name, assetCategory: String(p.project_type).replace(/_/g, " "), scopeDescription: p.description ?? "",
    plannedStartDate: day(p.planned_start), plannedCompletionDate: day(p.estimated_completion), actualStartDate: day(p.actual_start), actualCompletionDate: day(p.actual_completion),
    status: PROJECT_STATUS[p.status] ?? "Planning", estimatedBudget: num(p.original_budget), priority: ({ low: "Low", normal: "Medium", high: "High", emergency: "Critical" } as Record<string, string>)[p.priority] ?? "Medium",
  })));

  // ---- leases and renewal outcomes
  db.insert(leases).values(leaseRows.filter((l: any) => !["draft", "archived"].includes(l.status)).map((l: any) => {
    const unitId = leaseUnits.find((x: any) => x.lease_id === l.id)?.unit_id ?? null;
    const tenant = (parties.find((p: any) => p.lease_id === l.id && p.role === "main_tenant") ?? parties.find((p: any) => p.lease_id === l.id))?.tenant_id;
    const renewal = renewals.filter((r: any) => r.original_lease_id === l.id).pop();
    const ended = ["terminated", "expired"].includes(l.status) || (day(l.end_date) ?? "9999") < today;
    const outcome = renewal ? (["approved", "signed"].includes(renewal.status) ? "Renewed" : "Pending") : ended && ["terminated", "expired"].includes(l.status) ? "Non-Renewed" : null;
    const end = day(l.end_date) ?? today;
    const months = Math.max(0, Math.round((Date.parse(end < today ? end : today) - Date.parse(day(l.start_date)!)) / (30.44 * 86400000)));
    return {
      id: l.id, leaseNumber: l.lease_number ?? l.id, propertyId: unitId ? unitProperty.get(unitId) ?? "" : "", unitId, tenantName: tenant ? tenantName.get(tenant) ?? "" : "", startDate: day(l.start_date), endDate: day(l.end_date),
      tenancyDurationMonths: months, status: outcome === "Renewed" ? "Renewed" : ["terminated", "expired"].includes(l.status) ? "Moved Out" : "Active",
      renewalEligible: ended || !!renewal, renewalOfferDate: renewal ? day(renewal.created_at) : null, renewalOutcome: outcome, departureReason: null, complaintCount: 0,
    };
  }));

  db.insert(turnoverRecords).values([]);
  db.insert(tenantComplaints).values([]);
  db.insert(managementActions).values([]);
  loadedFor = orgId;
}
