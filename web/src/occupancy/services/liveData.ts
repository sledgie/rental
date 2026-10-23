// Fills the Occupancy Reports data from the organization's real records (Supabase mode). The report engine (./occupancyService) reads the
// shared lists in ../mock/*, so they are replaced in place; with no units or leases every report shows zeros.
//   properties <- properties (+ owners, manager)        units      <- units (+ current / upcoming lease)
//   leases     <- leases, lease_units, lease_parties     tenants    <- tenants on those leases
//   history    <- month-end occupancy rebuilt from lease dates (last 12 months)
//   pipeline   <- applications per month                  moves      <- lease start / end dates
//   exceptions <- simple data checks (occupied without a lease, expired lease still active, lease without rent ...)
// Unit turnover (cleaning / inspection steps) is not recorded yet, so that report stays empty.
import { fetchAll } from "../../lib/financeData";
import { loadStaff } from "../../properties/add/store/refRepo";
import { MOCK_PROPERTIES } from "../mock/properties";
import { MOCK_UNITS } from "../mock/units";
import { MOCK_LEASES } from "../mock/leases";
import { MOCK_TENANTS } from "../mock/tenants";
import { MOCK_HISTORICAL_RECORDS } from "../mock/historical";
import { MOCK_TURNOVER_RECORDS } from "../mock/turnover";
import { MOCK_PIPELINE_DATA } from "../mock/pipeline";
import { MOCK_MOVE_RECORDS } from "../mock/moves";
import { setExceptions } from "./occupancyService";
import type { CurrentOccupancyStatus, HistoricalOccupancyRecord, Lease, LeasingPipelineFunnel, MoveRecord, OccupancyException, Property, ReadinessStatus, Tenant, Unit, UnitType } from "../types/occupancy";

/* eslint-disable @typescript-eslint/no-explicit-any -- rows come from untyped PostgREST responses */

const num = (v: unknown) => Number(v ?? 0);
const day = (v: string | null | undefined) => (v ? String(v).slice(0, 10) : "");
const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const replace = <T,>(target: T[], items: T[]) => { target.splice(0, target.length, ...items); };

export async function loadOccupancyData(orgId: string): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const [props, units, leases, leaseUnits, parties, tenants, owners, links, renewals, applications, staff] = await Promise.all([
    fetchAll("properties", "id, code, name, address_line1, city, state_province, postal_code, property_type, year_built, property_manager_id, archived_at", orgId, "name"),
    fetchAll("units", "id, property_id, unit_number, unit_code, unit_type, unit_status, floor, bedrooms, square_feet, market_rent, advertised_rent, available_on, notes, archived_at, allow_multiple_active_leases", orgId, "unit_number"),
    fetchAll("leases", "id, lease_number, status, tenancy_status, start_date, end_date, agreed_monthly_rent, deposit_amount", orgId, "start_date"),
    fetchAll("lease_units", "lease_id, unit_id, allocated_monthly_rent, start_date, end_date", orgId, "lease_id"),
    fetchAll("lease_parties", "lease_id, tenant_id, role, relationship_start_date, relationship_end_date", orgId, "lease_id"),
    fetchAll("tenants", "id, first_name, last_name, email, phone, status", orgId, "last_name"),
    fetchAll("owners", "id, name", orgId, "name"),
    fetchAll("property_owners", "property_id, owner_id, ownership_percentage", orgId, "property_id"),
    fetchAll("lease_renewals", "original_lease_id, status, proposed_rent", orgId, "created_at"),
    fetchAll("applications", "id, property_id, status, submitted_at, created_at, created_lease_id", orgId, "created_at"),
    loadStaff(orgId).catch(() => []),
  ]);
  const staffName = new Map<string, string>(staff.map((s): [string, string] => [s.id, s.name]));
  const ownerName = new Map<string, string>(owners.map((o: any) => [o.id, o.name]));
  const propertyName = new Map<string, string>(props.map((p: any) => [p.id, p.name]));
  const unitInfo = new Map<string, any>(units.map((u: any) => [u.id, u]));
  const tenantName = new Map<string, string>(tenants.map((t: any) => [t.id, `${t.first_name} ${t.last_name ?? ""}`.trim()]));
  const liveUnits = units.filter((u: any) => !u.archived_at);

  // leases that count for occupancy (drafts and archived records do not)
  const counted = leases.filter((l: any) => !["draft", "archived"].includes(l.status));
  const unitsOf = (leaseId: string) => leaseUnits.filter((x: any) => x.lease_id === leaseId);
  const mainTenant = (leaseId: string) =>
    (parties.find((p: any) => p.lease_id === leaseId && p.role === "main_tenant") ?? parties.find((p: any) => p.lease_id === leaseId))?.tenant_id ?? "";
  const leaseEnd = (l: any) => day(l.end_date);
  const tenancyOf = (l: any): Lease["tenancyStatus"] => {
    if (l.status === "terminated") return "Terminated";
    if (l.status === "expired") return "Expired";
    if (day(l.start_date) > today || ["pending_review", "pending_signature"].includes(l.status)) return "Pending Move-In";
    if (l.tenancy_status === "periodic" || !leaseEnd(l) || leaseEnd(l) < today) return "Month-to-Month";
    return "Active";
  };
  const leaseFor = (unitId: string, when: string) =>
    counted.find((l: any) => {
      if (["terminated", "expired"].includes(l.status) && leaseEnd(l) && leaseEnd(l) < when) return false;
      const link = leaseUnits.find((x: any) => x.lease_id === l.id && x.unit_id === unitId);
      if (!link) return false;
      const start = day(link.start_date) || day(l.start_date);
      const end = day(link.end_date) || (l.tenancy_status === "periodic" || l.status === "active" ? "" : leaseEnd(l));
      return start <= when && (!end || end >= when);
    });

  // ---- tenants
  replace(MOCK_TENANTS, tenants.filter((t: any) => parties.some((p: any) => p.tenant_id === t.id)).map((t: any): Tenant => {
    const own = parties.filter((p: any) => p.tenant_id === t.id);
    const since = own.map((p: any) => day(p.relationship_start_date)).filter(Boolean).sort()[0] ?? "";
    const left = own.every((p: any) => p.relationship_end_date) ? own.map((p: any) => day(p.relationship_end_date)).sort().pop() ?? null : null;
    return {
      tenantId: t.id, tenantName: tenantName.get(t.id) ?? "", email: t.email ?? "", phone: t.phone ?? "",
      tenantStatus: ["former", "inactive"].includes(t.status) ? "Former" : ["prospect", "applicant", "pending"].includes(t.status) ? "Prospective" : "Current", moveInDate: since, moveOutDate: left,
    };
  }));

  // ---- leases
  replace(MOCK_LEASES, counted.map((l: any): Lease => {
    const links = unitsOf(l.id);
    const firstUnit = unitInfo.get(links[0]?.unit_id);
    const renewal = renewals.filter((r: any) => r.original_lease_id === l.id).pop();
    const tenancy = tenancyOf(l);
    const notice = links.some((x: any) => unitInfo.get(x.unit_id)?.unit_status === "notice");
    return {
      leaseId: l.id, leaseNumber: l.lease_number ?? l.id, propertyId: firstUnit?.property_id ?? "", tenantId: mainTenant(l.id), unitIds: links.map((x: any) => x.unit_id), leaseStartDate: day(l.start_date),
      leaseEndDate: leaseEnd(l), monthlyRent: num(l.agreed_monthly_rent), marketRentAtSign: links.reduce((s: number, x: any) => s + num(unitInfo.get(x.unit_id)?.market_rent), 0), depositAmount: num(l.deposit_amount),
      depositStatus: "Held in Escrow", tenancyStatus: tenancy,
      renewalStatus: renewal ? (({ pending_review: "Renewal Discussion", pending_signature: "Renewal Offered", approved: "Renewed", signed: "Renewed" } as Record<string, Lease["renewalStatus"]>)[renewal.status] ?? "Renewal Discussion")
        : tenancy === "Month-to-Month" ? "Month-to-Month" : tenancy === "Expired" ? "Expired" : notice ? "Tenant Moving Out" : "Not Contacted",
      noticeStatus: notice ? "Notice to Vacate Received" : "None", proposedRenewalRent: renewal?.proposed_rent === null || renewal?.proposed_rent === undefined ? undefined : num(renewal.proposed_rent),
      expectedMoveOutDate: leaseEnd(l) || null, assignedPropertyManager: staffName.get(props.find((p: any) => p.id === firstUnit?.property_id)?.property_manager_id) ?? "Unassigned", isMultiUnit: links.length > 1,
    };
  }));

  // ---- units
  replace(MOCK_UNITS, liveUnits.map((u: any): Unit => {
    const current = leaseFor(u.id, today);
    const upcoming = counted.filter((l: any) => unitsOf(l.id).some((x: any) => x.unit_id === u.id) && day(l.start_date) > today).sort((a: any, b: any) => day(a.start_date).localeCompare(day(b.start_date)))[0];
    const status: CurrentOccupancyStatus =
      ["occupied", "notice"].includes(u.unit_status) || current ? "Occupied"
        : upcoming ? "Leased — Awaiting Move-In"
          : u.unit_status === "reserved" ? "Reserved"
            : u.unit_status === "under_maintenance" ? "Vacant — Under Maintenance"
              : u.unit_status === "renovation" ? "Vacant — Under Renovation"
                : u.unit_status === "turnover" ? "Vacant — Needs Cleaning"
                  : u.unit_status === "unavailable" ? "Unavailable" : "Vacant — Ready";
    const readiness: ReadinessStatus =
      status === "Occupied" ? "Completed" : status === "Leased — Awaiting Move-In" ? "Leased — Awaiting Move-In" : status === "Vacant — Needs Cleaning" ? "Cleaning Required"
        : status === "Vacant — Under Maintenance" ? "Maintenance Required" : status === "Vacant — Under Renovation" ? "Renovation Required" : status === "Unavailable" ? "Inspection Pending" : "Ready for Leasing";
    const pastEnds = counted.flatMap((l: any) => unitsOf(l.id).filter((x: any) => x.unit_id === u.id).map((x: any) => day(x.end_date) || leaseEnd(l))).filter((d: string) => d && d < today).sort();
    const beds = u.bedrooms === null ? null : num(u.bedrooms);
    const type = (u.unit_type || (beds === null ? "" : beds === 0 ? "Studio" : `${beds} Bedroom`)) as UnitType;
    const link = current ? leaseUnits.find((x: any) => x.lease_id === current.id && x.unit_id === u.id) : null;
    return {
      unitId: u.id, propertyId: u.property_id, unitNumber: u.unit_number, floor: Number.parseInt(String(u.floor ?? ""), 10) || 0, unitType: type || ("Studio" as UnitType), rentableAreaSqFt: num(u.square_feet),
      marketRent: num(u.market_rent ?? u.advertised_rent), contractualRent: link ? num(link.allocated_monthly_rent) || num(current.agreed_monthly_rent) : null, askingRent: num(u.advertised_rent ?? u.market_rent),
      isRentable: u.unit_status !== "unavailable", readinessStatus: readiness, currentOccupancyStatus: status, vacancyStartDate: status.startsWith("Vacant") ? pastEnds.pop() ?? day(u.available_on) ?? null : null,
      expectedAvailableDate: day(u.available_on) || null, nextScheduledMoveInDate: upcoming ? day(upcoming.start_date) : null, assignedLeasingAgent: null, notes: u.notes ?? undefined,
    };
  }));

  // ---- properties
  replace(MOCK_PROPERTIES, props.filter((p: any) => !p.archived_at).map((p: any): Property => {
    const own = liveUnits.filter((u: any) => u.property_id === p.id);
    const owner = links.filter((l: any) => l.property_id === p.id).sort((a: any, b: any) => num(b.ownership_percentage) - num(a.ownership_percentage))[0];
    return {
      propertyId: p.id, propertyName: p.name, propertyCode: p.code ?? "", address: p.address_line1 ?? "", city: p.city ?? "", province: p.state_province ?? "", postalCode: p.postal_code ?? "",
      propertyType: String(p.property_type ?? "").replace(/_/g, " ") as Property["propertyType"], ownerId: owner?.owner_id ?? "", ownerName: owner ? ownerName.get(owner.owner_id) ?? "" : "",
      totalUnits: own.length, rentableUnits: own.filter((u: any) => u.unit_status !== "unavailable").length, yearBuilt: p.year_built ?? 0, assignedManager: staffName.get(p.property_manager_id) ?? "Unassigned", activeStatus: true,
    };
  }));

  // ---- month-end history for the last 12 months
  const history: HistoricalOccupancyRecord[] = [];
  const now = new Date(`${today.slice(0, 7)}-01T12:00:00`);
  for (let back = 11; back >= 0; back--) {
    const d = new Date(now);
    d.setMonth(d.getMonth() - back);
    const period = d.toISOString().slice(0, 7);
    const monthEnd = back === 0 ? today : new Date(d.getFullYear(), d.getMonth() + 1, 0, 12).toISOString().slice(0, 10);
    for (const p of MOCK_PROPERTIES) {
      const own = liveUnits.filter((u: any) => u.property_id === p.propertyId && u.unit_status !== "unavailable");
      const occupied = own.filter((u: any) => leaseFor(u.id, monthEnd)).length;
      const ids = new Set(own.map((u: any) => u.id));
      const leaseIds = new Set(leaseUnits.filter((x: any) => ids.has(x.unit_id)).map((x: any) => x.lease_id));
      const mine = counted.filter((l: any) => leaseIds.has(l.id));
      const total = own.length;
      history.push({
        period, periodLabel: `${MONTH[d.getMonth()]} ${d.getFullYear()}`, propertyId: p.propertyId, propertyName: p.propertyName, totalRentableUnits: total, occupiedUnits: occupied, vacantUnits: total - occupied,
        reservedUnits: 0, unavailableUnits: liveUnits.filter((u: any) => u.property_id === p.propertyId && u.unit_status === "unavailable").length,
        occupancyRate: total ? Math.round((occupied / total) * 1000) / 10 : 0, vacancyRate: total ? Math.round(((total - occupied) / total) * 1000) / 10 : 0,
        moveIns: mine.filter((l: any) => day(l.start_date).slice(0, 7) === period && day(l.start_date) <= today).length,
        moveOuts: mine.filter((l: any) => leaseEnd(l).slice(0, 7) === period && leaseEnd(l) <= today && ["terminated", "expired"].includes(l.status)).length,
      });
    }
  }
  replace(MOCK_HISTORICAL_RECORDS, history);

  // ---- leasing pipeline per month and property (applications)
  const pipeline = new Map<string, LeasingPipelineFunnel>();
  for (const a of applications.filter((x: any) => x.status !== "draft")) {
    const period = (day(a.submitted_at) || day(a.created_at)).slice(0, 7);
    const key = `${period}|${a.property_id}`;
    const row = pipeline.get(key) ?? { period, propertyId: a.property_id, inquiries: 0, applicationsReceived: 0, applicationsApproved: 0, applicationsDeclined: 0, leasesOffered: 0, leasesSigned: 0, scheduledMoveIns: 0, completedMoveIns: 0, avgTimeToLeaseDays: 0 };
    row.inquiries += 1;
    row.applicationsReceived += 1;
    if (a.status === "approved") { row.applicationsApproved += 1; row.leasesOffered += 1; }
    if (a.status === "declined") row.applicationsDeclined += 1;
    const lease = a.created_lease_id ? leases.find((l: any) => l.id === a.created_lease_id) : null;
    if (lease) {
      row.leasesSigned += 1;
      if (day(lease.start_date) > today) row.scheduledMoveIns += 1; else row.completedMoveIns += 1;
    }
    pipeline.set(key, row);
  }
  replace(MOCK_PIPELINE_DATA, [...pipeline.values()]);

  // ---- move-ins and move-outs (from lease dates)
  const moves: MoveRecord[] = [];
  for (const l of counted) {
    for (const link of unitsOf(l.id)) {
      const unit = unitInfo.get(link.unit_id);
      if (!unit) continue;
      const tenant = mainTenant(l.id);
      const base = { tenantName: tenantName.get(tenant) ?? "", tenantId: tenant, propertyId: unit.property_id, propertyName: propertyName.get(unit.property_id) ?? "", unitNumber: unit.unit_number, unitId: unit.id, leaseNumber: l.lease_number ?? "", turnoverReference: "" };
      const start = day(link.start_date) || day(l.start_date);
      moves.push({ ...base, movementId: `${l.id}-${unit.id}-in`, movementType: "Move-In", scheduledDate: start, actualDate: start <= today ? start : null, previousUnitStatus: "Vacant — Ready", newUnitStatus: "Occupied" });
      const end = day(link.end_date) || leaseEnd(l);
      if (end && ["terminated", "expired"].includes(l.status)) {
        moves.push({ ...base, movementId: `${l.id}-${unit.id}-out`, movementType: "Move-Out", scheduledDate: end, actualDate: end <= today ? end : null, previousUnitStatus: "Occupied", newUnitStatus: "Vacant — Needs Cleaning" });
      }
    }
  }
  replace(MOCK_MOVE_RECORDS, moves);
  replace(MOCK_TURNOVER_RECORDS, []);

  // ---- data checks
  const exceptions: OccupancyException[] = [];
  const add = (type: OccupancyException["exceptionType"], severity: OccupancyException["severity"], unit: any, description: string, recommendedAction: string, leaseNumber?: string) =>
    exceptions.push({
      exceptionId: `${type}-${unit?.id ?? leaseNumber}`, exceptionType: type, severity, propertyId: unit?.property_id ?? "", propertyName: propertyName.get(unit?.property_id) ?? "", unitNumber: unit?.unit_number ?? "",
      unitId: unit?.id, leaseNumber, description, recommendedAction, status: "Open", detectedDate: today,
    });
  for (const u of liveUnits) {
    const current = leaseFor(u.id, today);
    if (["occupied", "notice"].includes(u.unit_status) && !current) add("Occupied with No Active Lease", "High", u, `Unit ${u.unit_number} is marked occupied but no lease covers today.`, "Record the lease or update the unit status.");
    if (u.unit_status === "vacant" && current) add("Vacant with Current Occupancy Record", "Medium", u, `Unit ${u.unit_number} is marked vacant but lease ${current.lease_number} covers today.`, "Update the unit status or end the lease.", current.lease_number);
    const covering = counted.filter((l: any) => unitsOf(l.id).some((x: any) => x.unit_id === u.id) && l.status === "active");
    if (covering.length > 1 && !u.allow_multiple_active_leases) add("Conflicting Overlapping Leases", "Critical", u, `Unit ${u.unit_number} has ${covering.length} active leases.`, "Confirm which lease is current and end the others.");
  }
  for (const l of counted) {
    const unit = unitInfo.get(unitsOf(l.id)[0]?.unit_id);
    if (l.status === "active" && leaseEnd(l) && leaseEnd(l) < today && l.tenancy_status !== "periodic") {
      add("Expired Lease Without Tenancy Review", "Medium", unit, `Lease ${l.lease_number} ended on ${leaseEnd(l)} but is still active.`, "Renew it, convert it to month-to-month, or end it.", l.lease_number);
    }
    if (!num(l.agreed_monthly_rent) && l.status === "active") add("Missing Rent Amount", "High", unit, `Lease ${l.lease_number} has no monthly rent.`, "Enter the agreed rent on the lease.", l.lease_number);
  }
  setExceptions(exceptions);
}
