/**
 * Derivation + calculation layer. Pure functions only: every figure shown in
 * the Units module is computed here from the related entities, never stored
 * twice and never hard-coded in a component.
 */
import { EXPIRY_WARNING_DAYS, TODAY } from "./mockData";
import type {
  ActivityEvent,
  Database,
  DocumentRecord,
  Lease,
  LeaseParty,
  LeaseUnit,
  MaintenanceRequest,
  Project,
  Property,
  Tenant,
  Transaction,
  Unit,
  UnitStatus,
} from "./types";
import { daysUntil, isoDate, monthKey, startOfDay } from "../lib/format";

export type DerivedLeaseStatus =
  | "Active"
  | "Expiring"
  | "Pending"
  | "Draft"
  | "Expired"
  | "Terminated"
  | "None";

const RECEIVABLE_TYPES = new Set([
  "Rent Charge",
  "Late Fee",
  "Utility Charge",
  "Parking Fee",
  "Maintenance Charge",
]);
const PAYMENT_TYPES = new Set(["Rent Payment"]);
const CREDIT_TYPES = new Set(["Credit", "Adjustment"]);
const EXPENSE_TYPES = new Set(["Maintenance Expense"]);

const todayIso = isoDate(TODAY);

/* ------------------------------ primitives ----------------------------- */

export const byId = <T extends { id: string }>(rows: T[]) => {
  const map = new Map<string, T>();
  for (const r of rows) map.set(r.id, r);
  return map;
};

export function getProperty(db: Database, id: string): Property | undefined {
  return db.properties.find((p) => p.id === id);
}

export function getTenant(db: Database, id: string): Tenant | undefined {
  return db.tenants.find((t) => t.id === id);
}

export function tenantName(t: Tenant): string {
  return `${t.firstName} ${t.lastName}`;
}

export function unitsOnLease(db: Database, leaseId: string): LeaseUnit[] {
  return db.leaseUnits.filter((lu) => lu.leaseId === leaseId);
}

export function leasePartiesFor(db: Database, leaseId: string): LeaseParty[] {
  const order = { "Main Tenant": 0, "Co-Tenant": 1, Guarantor: 2, Occupant: 3 } as const;
  return db.leaseParties
    .filter((lp) => lp.leaseId === leaseId)
    .sort((a, b) => order[a.role] - order[b.role] || a.effectiveStartDate.localeCompare(b.effectiveStartDate));
}

/** Lease status as the business reads it today, derived from the record. */
export function effectiveLeaseStatus(lease: Lease, warningDays = EXPIRY_WARNING_DAYS): DerivedLeaseStatus {
  const { startDate, endDate, leaseStatus } = lease;
  if (leaseStatus === "Terminated") return "Terminated";
  if (leaseStatus === "Draft") return "Draft";
  if (endDate < todayIso) return "Expired";
  if (startDate > todayIso) return "Pending";
  if (leaseStatus === "Pending") return "Pending";
  return daysUntil(endDate) <= warningDays ? "Expiring" : "Active";
}

export function isCurrentStatus(s: DerivedLeaseStatus): boolean {
  return s === "Active" || s === "Expiring";
}

/* ----------------------------- lease context ---------------------------- */

export interface LeaseContext {
  /** every lease that has ever touched this unit, newest first */
  all: Array<{ lease: Lease; link: LeaseUnit; status: DerivedLeaseStatus }>;
  current: { lease: Lease; link: LeaseUnit; status: DerivedLeaseStatus } | null;
  /** issued but not yet in term — an incoming occupancy relationship */
  pending: { lease: Lease; link: LeaseUnit; status: DerivedLeaseStatus } | null;
  /** being prepared only — never treated as an occupancy relationship */
  draft: { lease: Lease; link: LeaseUnit; status: DerivedLeaseStatus } | null;
  /** most recent expired lease while the unit is still occupied (holdover) */
  holdover: { lease: Lease; link: LeaseUnit; status: DerivedLeaseStatus } | null;
  history: Array<{ lease: Lease; link: LeaseUnit; status: DerivedLeaseStatus }>;
  /** contractual rent attributable to THIS unit for the current period */
  currentRent: number | null;
  /** where currentRent came from — used for labelling and for the summary rule */
  rentBasis: "allocation" | "single-unit-lease" | "holdover" | "unallocated" | "none";
  /** lease-level total, shown separately when the lease spans several units */
  leaseTotalRent: number | null;
  sharedUnits: Array<{ unitId: string; unitNumber: string; allocation: number | null }>;
  daysToExpiry: number | null;
  derivedStatus: DerivedLeaseStatus;
}

export function leaseContextFor(db: Database, unit: Unit): LeaseContext {
  const links = db.leaseUnits.filter((lu) => lu.unitId === unit.id);
  const all = links
    .map((link) => {
      const lease = db.leases.find((l) => l.id === link.leaseId);
      if (!lease) return null;
      return { lease, link, status: effectiveLeaseStatus(lease) };
    })
    .filter((x): x is { lease: Lease; link: LeaseUnit; status: DerivedLeaseStatus } => x !== null)
    .sort((a, b) => b.lease.endDate.localeCompare(a.lease.endDate));

  const current = all.find((e) => isCurrentStatus(e.status)) ?? null;

  const pending = all.find((e) => e.status === "Pending") ?? null;
  const draft = all.find((e) => e.status === "Draft") ?? null;

  const holdover =
    !current && unit.unitStatus === "Occupied"
      ? (all.find((e) => e.status === "Expired") ?? null)
      : null;

  const history = all.filter(
    (e) => e !== current && e !== pending && e !== holdover && e !== draft,
  );

  let currentRent: number | null = null;
  let rentBasis: LeaseContext["rentBasis"] = "none";
  let leaseTotalRent: number | null = null;
  let sharedUnits: LeaseContext["sharedUnits"] = [];
  let daysToExpiry: number | null = null;
  let derivedStatus: DerivedLeaseStatus = "None";

  const applicable = current ?? holdover;

  if (applicable) {
    const { lease, link, status } = applicable;
    const peers = unitsOnLease(db, lease.id);
    leaseTotalRent = lease.totalContractRent;
    sharedUnits = peers.map((p) => ({
      unitId: p.unitId,
      unitNumber: db.units.find((u) => u.id === p.unitId)?.unitNumber ?? p.unitId,
      allocation: p.rentAllocation,
    }));
    derivedStatus = status;
    daysToExpiry = daysUntil(lease.endDate);

    if (link.rentAllocation !== null && link.rentAllocation !== undefined) {
      currentRent = link.rentAllocation;
      rentBasis = "allocation";
    } else if (peers.length === 1) {
      currentRent = lease.totalContractRent;
      rentBasis = "single-unit-lease";
    } else {
      // Shared lease with no recorded split — refuse to invent a unit figure.
      currentRent = null;
      rentBasis = "unallocated";
    }
    if (!current && holdover && rentBasis !== "unallocated") rentBasis = "holdover";
  } else if (pending) {
    derivedStatus = pending.status;
    leaseTotalRent = pending.lease.totalContractRent;
    const peers = unitsOnLease(db, pending.lease.id);
    sharedUnits = peers.map((p) => ({
      unitId: p.unitId,
      unitNumber: db.units.find((u) => u.id === p.unitId)?.unitNumber ?? p.unitId,
      allocation: p.rentAllocation,
    }));
    daysToExpiry = daysUntil(pending.lease.endDate);
    currentRent = null;
    rentBasis = "none";
  } else if (draft) {
    // A draft lease is preparation only: no term, no rent roll, no occupancy.
    derivedStatus = "Draft";
    leaseTotalRent = draft.lease.totalContractRent;
    daysToExpiry = null;
    currentRent = null;
    rentBasis = "none";
  }

  return { all, current, pending, draft, holdover, history, currentRent, rentBasis, leaseTotalRent, sharedUnits, daysToExpiry, derivedStatus };
}

/* --------------------------- tenants / people --------------------------- */

export interface OccupantRow {
  tenant: Tenant;
  party: LeaseParty;
  lease: Lease;
  leaseNumber: string;
  occupancyStart: string;
  /** other units this same person is tied to right now */
  otherUnits: Array<{ unitId: string; unitNumber: string; propertyName: string; role: string }>;
}

/**
 * People associated with the unit through applicable lease relationships.
 * Derived from lease parties — never stored on the unit.
 */
export function occupantsFor(db: Database, unit: Unit, ctx: LeaseContext): OccupantRow[] {
  const entry = ctx.current ?? ctx.holdover ?? ctx.pending;
  if (!entry) return [];
  const occupancyStart = entry.link.occupancyStartDate;
  return leasePartiesFor(db, entry.lease.id)
    // An association with an end date is history, not current occupancy.
    .filter((party) => !party.effectiveEndDate)
    .map((party) => {
      const tenant = getTenant(db, party.tenantId);
      if (!tenant) return null;
      const otherLinks = db.leaseUnits.filter((lu) => lu.unitId !== unit.id);
      const otherUnits = otherLinks
        .map((lu) => {
          const lease = db.leases.find((l) => l.id === lu.leaseId);
          if (!lease) return null;
          const status = effectiveLeaseStatus(lease);
          const otherUnit = db.units.find((x) => x.id === lu.unitId);
          // In term, or expired while the person is still in occupation (holdover).
          const applicable =
            isCurrentStatus(status) || (status === "Expired" && otherUnit?.unitStatus === "Occupied");
          if (!applicable) return null;
          const isParty = db.leaseParties.some(
            (lp) => lp.leaseId === lease.id && lp.tenantId === tenant.id,
          );
          if (!isParty) return null;
          const u = db.units.find((x) => x.id === lu.unitId);
          const p = u ? getProperty(db, u.propertyId) : undefined;
          if (!u) return null;
          const role = db.leaseParties.find((lp) => lp.leaseId === lease.id && lp.tenantId === tenant.id)?.role ?? "Tenant";
          return { unitId: u.id, unitNumber: u.unitNumber, propertyName: p?.propertyName ?? "", role };
        })
        .filter((x): x is { unitId: string; unitNumber: string; propertyName: string; role: string } => x !== null);

      return {
        tenant,
        party,
        lease: entry.lease,
        leaseNumber: entry.lease.leaseNumber,
        occupancyStart: party.effectiveStartDate ?? occupancyStart,
        otherUnits,
      };
    })
    .filter((x): x is OccupantRow => x !== null);
}

/* ------------------------------- finance -------------------------------- */

export interface MonthlyPoint {
  key: string;
  label: string;
  billed: number;
  collected: number;
}

export interface FinancialSummary {
  billedThisMonth: number;
  collectedThisMonth: number;
  outstandingGross: number;
  credits: number;
  outstandingNet: number;
  overdueGross: number;
  overdueNet: number;
  otherChargesOpen: number;
  maintenanceExpenseRecent: number;
  securityDeposit: number | null;
  status: "Overdue" | "Outstanding" | "Clear" | "No Activity";
  series: MonthlyPoint[];
  recent: Transaction[];
  /** posted-ineligible rows, surfaced so the exclusion rule is visible */
  excluded: { draft: number; voided: number; scheduled: number };
  collectionRate: number | null;
}

function txMonthOffsets(count: number): number[] {
  return Array.from({ length: count }, (_, i) => i - (count - 1));
}

export function financialsFor(db: Database, unit: Unit, ctx: LeaseContext): FinancialSummary {
  const all = db.transactions.filter((t) => t.unitId === unit.id);
  const posted = all.filter((t) => t.transactionStatus === "Posted");
  const excluded = {
    draft: all.filter((t) => t.transactionStatus === "Draft").length,
    voided: all.filter((t) => t.transactionStatus === "Void").length,
    scheduled: all.filter((t) => t.transactionStatus === "Scheduled").length,
  };

  const currentMonth = monthKey(TODAY);

  const receivables = posted.filter((t) => RECEIVABLE_TYPES.has(t.transactionType));
  const payments = posted.filter((t) => PAYMENT_TYPES.has(t.transactionType));
  const credits = posted.filter((t) => CREDIT_TYPES.has(t.transactionType));
  const expenses = posted.filter((t) => EXPENSE_TYPES.has(t.transactionType));

  const billedThisMonth = receivables
    .filter((t) => monthKey(t.transactionDate) === currentMonth)
    .reduce((s, t) => s + t.amount, 0);

  const collectedThisMonth = payments
    .filter((t) => monthKey(t.transactionDate) === currentMonth)
    .reduce((s, t) => s + t.amount, 0);

  const openCharges = receivables.filter(
    (t) => t.amount - (t.amountPaid ?? (t.paymentStatus === "Paid" ? t.amount : 0)) > 0.005,
  );
  const balanceOf = (t: Transaction) =>
    t.amount - (t.amountPaid ?? (t.paymentStatus === "Paid" ? t.amount : 0));

  const outstandingGross = openCharges.reduce((s, t) => s + balanceOf(t), 0);
  const creditTotal = credits.reduce((s, t) => s + t.amount, 0);
  // Credits apply within this unit's account only — never across units.
  const outstandingNet = Math.max(0, outstandingGross - creditTotal);

  const overdueCharges = openCharges.filter((t) => !!t.dueDate && t.dueDate < todayIso);
  const overdueGross = overdueCharges.reduce((s, t) => s + balanceOf(t), 0);
  const overdueNet = Math.max(0, overdueGross - creditTotal);

  const otherChargesOpen = openCharges
    .filter((t) => t.transactionType !== "Rent Charge")
    .reduce((s, t) => s + balanceOf(t), 0);

  const cutoff90 = isoDate(new Date(startOfDay(TODAY).getTime() - 90 * 86_400_000));
  const maintenanceExpenseRecent = expenses
    .filter((t) => t.transactionDate >= cutoff90)
    .reduce((s, t) => s + t.amount, 0);

  const series: MonthlyPoint[] = txMonthOffsets(6).map((offset) => {
    const key = monthKey(new Date(TODAY.getFullYear(), TODAY.getMonth() + offset, 1));
    return {
      key,
      label: new Date(TODAY.getFullYear(), TODAY.getMonth() + offset, 1).toLocaleDateString("en-CA", {
        month: "short",
      }),
      billed: receivables
        .filter((t) => monthKey(t.transactionDate) === key && t.transactionType === "Rent Charge")
        .reduce((s, t) => s + t.amount, 0),
      collected: payments
        .filter((t) => monthKey(t.transactionDate) === key)
        .reduce((s, t) => s + t.amount, 0),
    };
  });

  const trailingBilled = series.slice(0, 5).reduce((s, p) => s + p.billed, 0);
  const trailingCollected = series.slice(0, 5).reduce((s, p) => s + p.collected, 0);
  const collectionRate = trailingBilled > 0 ? (trailingCollected / trailingBilled) * 100 : null;

  const recent = [...all].sort((a, b) => b.transactionDate.localeCompare(a.transactionDate)).slice(0, 8);

  let status: FinancialSummary["status"] = "No Activity";
  if (posted.length > 0) {
    if (overdueGross > 0.005) status = "Overdue";
    else if (outstandingNet > 0.005) status = "Outstanding";
    else status = "Clear";
  }

  return {
    billedThisMonth,
    collectedThisMonth,
    outstandingGross,
    credits: creditTotal,
    outstandingNet,
    overdueGross,
    overdueNet,
    otherChargesOpen,
    maintenanceExpenseRecent,
    securityDeposit: ctx.current?.lease.securityDeposit ?? ctx.holdover?.lease.securityDeposit ?? null,
    status,
    series,
    recent,
    excluded,
    collectionRate,
  };
}

/* --------------------------- maintenance side --------------------------- */

export interface MaintenanceSummary {
  open: MaintenanceRequest[];
  active: MaintenanceRequest[];
  recentCompleted: MaintenanceRequest[];
  openCount: number;
  lastServiceDate: string | null;
  projects: Project[];
  activeProjects: Project[];
  expense90d: number;
  inspectionOverdue: boolean;
  inspectionSoon: boolean;
}

export function maintenanceFor(db: Database, unit: Unit): MaintenanceSummary {
  const reqs = db.maintenance
    .filter((m) => m.unitId === unit.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const active = reqs.filter((r) => r.status === "Open" || r.status === "In Progress" || r.status === "Overdue");
  const completed = reqs.filter((r) => r.status === "Completed");
  const projects = db.projects
    .filter((p) => p.unitIds.includes(unit.id))
    .sort((a, b) => b.startDate.localeCompare(a.startDate));
  const lastServiceDate = completed[0]?.completedDate ?? null;
  const exp = financialsCache.get(unit.id);

  return {
    open: reqs,
    active,
    recentCompleted: completed.slice(0, 3),
    openCount: active.length,
    lastServiceDate,
    projects,
    activeProjects: projects.filter((p) => p.status === "Active" || p.status === "Planning"),
    expense90d: exp?.maintenanceExpenseRecent ?? 0,
    inspectionOverdue: unit.inspection?.status === "Overdue",
    inspectionSoon:
      !!unit.inspection?.nextInspectionDate &&
      unit.inspection.nextInspectionDate >= todayIso &&
      daysUntil(unit.inspection.nextInspectionDate) <= 30,
  };
}

/* ---------------------------- row view model ---------------------------- */

export interface UnitRow {
  unit: Unit;
  property?: Property;
  ctx: LeaseContext;
  occupants: OccupantRow[];
  financials: FinancialSummary;
  maintenance: MaintenanceSummary;
  documents: DocumentRecord[];
  activity: ActivityEvent[];
  conflicts: string[];
  mainTenantName: string | null;
  searchText: string;
}

/** Cross-checks that stop status changes contradicting lease/occupancy data. */
export function statusConflicts(unit: Unit, ctx: LeaseContext): string[] {
  const flags: string[] = [];
  const s = unit.unitStatus;
  if (s === "Occupied" && !ctx.current) {
    flags.push(
      ctx.holdover
        ? `Occupied on an expired lease (${ctx.holdover.lease.leaseNumber}) — holdover, needs review`
        : "Occupied with no current lease on record",
    );
  }
  if ((s === "Vacant" || s === "Under Maintenance") && ctx.current) {
    flags.push(`Unit is ${s} but lease ${ctx.current.lease.leaseNumber} is still in term`);
  }
  if (s === "Reserved" && !ctx.pending) {
    flags.push("Reserved without a pending or draft lease");
  }
  if (s === "Occupied" && !ctx.current && ctx.pending) {
    flags.push(`Occupied before lease ${ctx.pending.lease.leaseNumber} starts`);
  }
  if (ctx.current && ctx.current.lease.startDate > todayIso) {
    flags.push("Current lease has not started yet");
  }
  if (ctx.rentBasis === "unallocated") {
    flags.push("Shared lease without a rent allocation — unit rent not reported");
  }
  return flags;
}

export function buildUnitRow(db: Database, unit: Unit): UnitRow {
  const ctx = leaseContextFor(db, unit);
  const occupants = occupantsFor(db, unit, ctx);
  const financials = financialsFor(db, unit, ctx);
  financialsCache.set(unit.id, financials);
  const maintenance = maintenanceFor(db, unit);
  const property = getProperty(db, unit.propertyId);

  const mainParty =
    occupants.find((o) => o.party.role === "Main Tenant") ??
    occupants.find((o) => o.party.isSignatory) ??
    occupants[0];
  const mainTenantName = mainParty ? tenantName(mainParty.tenant) : null;

  const searchText = [
    unit.unitNumber,
    unit.id,
    unit.unitType,
    unit.unitStatus,
    property?.propertyName,
    property?.address,
    property?.city,
    property?.postalCode,
    ctx.all.map((a) => a.lease.leaseNumber).join(" "),
    ...occupants.flatMap((o) => [
      tenantName(o.tenant),
      o.tenant.email,
      o.tenant.phone,
      o.tenant.id,
      o.party.role,
    ]),
    ctx.rentBasis,
    unit.notes ?? "",
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return {
    unit,
    property,
    ctx,
    occupants,
    financials,
    maintenance,
    documents: db.documents.filter((doc) => doc.unitId === unit.id),
    activity: db.activity
      .filter((a) => a.unitId === unit.id)
      .sort((a, b) => b.at.localeCompare(a.at)),
    conflicts: statusConflicts(unit, ctx),
    mainTenantName,
    searchText,
  };
}

/** Small cache so maintenance summaries can reuse already-computed finance. */
const financialsCache = new Map<string, FinancialSummary>();

export function buildAllRows(db: Database): UnitRow[] {
  financialsCache.clear();
  return db.units.map((u) => buildUnitRow(db, u));
}

/* -------------------------------- summary ------------------------------- */

export interface PortfolioSummary {
  totalUnits: number;
  countedUnits: number;
  inactiveUnits: number;
  archivedUnits: number;
  occupied: number;
  vacant: number;
  reserved: number;
  underMaintenance: number;
  occupancyRate: number;
  monthlyRent: number;
  rentFromSharedLeases: number;
  unallocatedUnits: number;
  outstandingTotal: number;
  overdueTotal: number;
  expiringSoon: number;
  expiredWithOccupancy: number;
  openMaintenance: number;
  activeProjects: number;
  billedThisMonth: number;
  collectedThisMonth: number;
  collectionRate: number | null;
  series: MonthlyPoint[];
  byProperty: Array<{ property: Property; units: number; occupied: number; rent: number }>;
}

export function computeSummary(rows: UnitRow[], db: Database): PortfolioSummary {
  const active = rows.filter((r) => !r.unit.archived);
  const counted = active.filter((r) => r.unit.unitStatus !== "Inactive");
  const statusCount = (s: UnitStatus) => counted.filter((r) => r.unit.unitStatus === s).length;

  const rentRows = counted.filter((r) => r.ctx.current && r.ctx.currentRent !== null);
  const monthlyRent = rentRows.reduce((s, r) => s + (r.ctx.currentRent ?? 0), 0);
  const rentFromSharedLeases = rentRows.filter((r) => r.ctx.sharedUnits.length > 1).length;
  const unallocatedUnits = counted.filter((r) => r.ctx.rentBasis === "unallocated").length;

  const billed = counted.reduce((s, r) => s + r.financials.billedThisMonth, 0);
  const collected = counted.reduce((s, r) => s + r.financials.collectedThisMonth, 0);

  const seriesKeys = txMonthOffsets(6).map(
    (o) => monthKey(new Date(TODAY.getFullYear(), TODAY.getMonth() + o, 1)),
  );
  const series: MonthlyPoint[] = seriesKeys.map((key, i) => ({
    key,
    label: new Date(TODAY.getFullYear(), TODAY.getMonth() + i - 5, 1).toLocaleDateString("en-CA", {
      month: "short",
    }),
    billed: counted.reduce(
      (s, r) => s + (r.financials.series.find((p) => p.key === key)?.billed ?? 0),
      0,
    ),
    collected: counted.reduce(
      (s, r) => s + (r.financials.series.find((p) => p.key === key)?.collected ?? 0),
      0,
    ),
  }));

  const byProperty = db.properties.map((p) => {
    const rowsFor = counted.filter((r) => r.unit.propertyId === p.id);
    return {
      property: p,
      units: rowsFor.length,
      occupied: rowsFor.filter((r) => r.unit.unitStatus === "Occupied").length,
      rent: rowsFor.reduce((s, r) => s + (r.ctx.current?.lease && r.ctx.currentRent ? r.ctx.currentRent : 0), 0),
    };
  });

  return {
    totalUnits: rows.length,
    countedUnits: counted.length,
    inactiveUnits: active.filter((r) => r.unit.unitStatus === "Inactive").length,
    archivedUnits: rows.filter((r) => r.unit.archived).length,
    occupied: statusCount("Occupied"),
    vacant: statusCount("Vacant"),
    reserved: statusCount("Reserved"),
    underMaintenance: statusCount("Under Maintenance"),
    occupancyRate: counted.length ? (statusCount("Occupied") / counted.length) * 100 : 0,
    monthlyRent,
    rentFromSharedLeases,
    unallocatedUnits,
    outstandingTotal: counted.reduce((s, r) => s + r.financials.outstandingNet, 0),
    overdueTotal: counted.reduce((s, r) => s + r.financials.overdueNet, 0),
    expiringSoon: counted.filter((r) => r.ctx.derivedStatus === "Expiring").length,
    expiredWithOccupancy: counted.filter((r) => r.ctx.holdover).length,
    openMaintenance: counted.reduce((s, r) => s + r.maintenance.openCount, 0),
    activeProjects: db.projects.filter((p) => p.status === "Active").length,
    billedThisMonth: billed,
    collectedThisMonth: collected,
    collectionRate: billed > 0 ? (collected / billed) * 100 : null,
    series,
    byProperty,
  };
}

/* --------------------------- search / filter ---------------------------- */

export type LeaseFilter =
  | "all"
  | "none"
  | "Pending"
  | "Active"
  | "Expiring"
  | "Expired"
  | "Terminated";
export type FinancialFilter = "all" | "clear" | "outstanding" | "overdue";

export interface UnitFilters {
  query: string;
  propertyId: string;
  status: UnitStatus | "all";
  lease: LeaseFilter;
  financial: FinancialFilter;
  unitType: string;
  bedrooms: string;
  expiryWithin: string;
  workInProgress: boolean;
}

export const emptyFilters: UnitFilters = {
  query: "",
  propertyId: "all",
  status: "all",
  lease: "all",
  financial: "all",
  unitType: "all",
  bedrooms: "all",
  expiryWithin: "all",
  workInProgress: false,
};

export function filterRows(rows: UnitRow[], f: UnitFilters): UnitRow[] {
  const q = f.query.trim().toLowerCase();
  const terms = q ? q.split(/\s+/) : [];

  return rows.filter((r) => {
    if (terms.length && !terms.every((t) => r.searchText.includes(t))) return false;
    if (f.propertyId !== "all" && r.unit.propertyId !== f.propertyId) return false;
    if (f.status !== "all" && r.unit.unitStatus !== f.status) return false;
    if (f.unitType !== "all" && r.unit.unitType !== f.unitType) return false;
    if (f.bedrooms !== "all") {
      const bd = r.unit.bedrooms;
      if (f.bedrooms === "studio" && bd !== 0) return false;
      if (f.bedrooms === "1" && bd !== 1) return false;
      if (f.bedrooms === "2" && bd !== 2) return false;
      if (f.bedrooms === "3+" && (bd === null || bd < 3)) return false;
      if (f.bedrooms === "unknown" && bd !== null) return false;
    }

    switch (f.lease) {
      case "none":
        if (r.ctx.current || r.ctx.holdover) return false;
        break;
      case "Pending":
        if (r.ctx.derivedStatus !== "Pending") return false;
        break;
      case "Active":
        if (r.ctx.derivedStatus !== "Active") return false;
        break;
      case "Expiring":
        if (r.ctx.derivedStatus !== "Expiring") return false;
        break;
      case "Expired":
        if (r.ctx.derivedStatus !== "Expired" && !r.ctx.holdover) return false;
        break;
      case "Terminated":
        if (!r.ctx.all.some((a) => a.status === "Terminated")) return false;
        break;
      default:
        break;
    }

    if (f.financial === "clear" && r.financials.outstandingNet > 0.005) return false;
    if (f.financial === "outstanding" && r.financials.outstandingNet <= 0.005) return false;
    if (f.financial === "overdue" && r.financials.overdueNet <= 0.005) return false;

    if (f.expiryWithin !== "all" && f.expiryWithin !== "none") {
      const within = Number(f.expiryWithin);
      const days = r.ctx.daysToExpiry;
      if (days === null) return false;
      if (Number.isNaN(within)) return false;
      if (!(days >= 0 && days <= within)) return false;
    }
    if (f.expiryWithin === "none" && r.ctx.daysToExpiry !== null) return false;

    if (f.workInProgress) {
      if (r.maintenance.openCount === 0 && r.maintenance.activeProjects.length === 0) return false;
    }
    return true;
  });
}

export type SortKey =
  | "property"
  | "unitNumber"
  | "rent"
  | "status"
  | "expiry"
  | "balance"
  | "bedrooms";
export interface SortState {
  key: SortKey;
  dir: "asc" | "desc";
}

const STATUS_ORDER: Record<UnitStatus, number> = {
  Occupied: 0,
  Reserved: 1,
  Vacant: 2,
  "Under Maintenance": 3,
  Inactive: 4,
};

const LEASE_ORDER: Record<DerivedLeaseStatus, number> = {
  Expiring: 0,
  Active: 1,
  Pending: 2,
  Draft: 3,
  Expired: 4,
  Terminated: 5,
  None: 6,
};

export function sortRows(rows: UnitRow[], sort: SortState): UnitRow[] {
  const dir = sort.dir === "asc" ? 1 : -1;
  const tie = (a: UnitRow, b: UnitRow) =>
    (a.property?.propertyName ?? "").localeCompare(b.property?.propertyName ?? "") ||
    naturalCompare(a.unit.unitNumber, b.unit.unitNumber);

  /** Missing values always sink to the bottom, whatever the direction. */
  const nullable = (av: number | null, bv: number | null): number | null => {
    if (av === null && bv === null) return null;
    if (av === null) return 1;
    if (bv === null) return -1;
    return (av - bv) * dir;
  };

  return [...rows].sort((a, b) => {
    switch (sort.key) {
      case "property":
      case "unitNumber":
        return tie(a, b) * (sort.key === "property" ? dir : dir);
      case "rent": {
        const cmp = nullable(a.ctx.currentRent, b.ctx.currentRent);
        if (cmp !== null) return cmp;
        const adv = nullable(a.unit.advertisedRent ?? null, b.unit.advertisedRent ?? null);
        return adv !== null ? adv : tie(a, b);
      }
      case "status":
        return (
          (STATUS_ORDER[a.unit.unitStatus] - STATUS_ORDER[b.unit.unitStatus]) * dir || tie(a, b)
        );
      case "expiry": {
        const order = (LEASE_ORDER[a.ctx.derivedStatus] - LEASE_ORDER[b.ctx.derivedStatus]) * dir;
        if (order !== 0) return order;
        const cmp = nullable(a.ctx.daysToExpiry, b.ctx.daysToExpiry);
        return cmp !== null ? cmp : tie(a, b);
      }
      case "balance":
        return (a.financials.outstandingNet - b.financials.outstandingNet) * dir || tie(a, b);
      case "bedrooms": {
        const cmp = nullable(a.unit.bedrooms, b.unit.bedrooms);
        return cmp !== null ? cmp : tie(a, b);
      }
      default:
        return tie(a, b);
    }
  });
}

export function naturalCompare(a: string, b: string): number {
  const ax = a.match(/\d+/g)?.map(Number) ?? [];
  const bx = b.match(/\d+/g)?.map(Number) ?? [];
  const alpha = a.replace(/\d+/g, "").localeCompare(b.replace(/\d+/g, ""));
  if (alpha !== 0) return alpha;
  for (let i = 0; i < Math.max(ax.length, bx.length); i++) {
    const diff = (ax[i] ?? -1) - (bx[i] ?? -1);
    if (diff !== 0) return diff;
  }
  return a.localeCompare(b);
}

/* ------------------------------ ID generation --------------------------- */

/** Follows the existing convention: U-<property sequence><zero-padded n>. */
export function nextUnitId(db: Database, propertyId: string): string {
  const seq = propertyId.replace(/\D/g, "").padStart(2, "0");
  const existing = db.units
    .filter((u) => u.propertyId === propertyId)
    .map((u) => Number(u.id.split("-")[1] ?? 0))
    .filter((n) => !Number.isNaN(n));
  const next = (existing.length ? Math.max(...existing) : Number(`${seq}00`)) + 1;
  return `U-${next}`;
}

export function nextLeaseNumber(db: Database): string {
  const nums = db.leases.map((l) => Number(l.leaseNumber.replace(/\D/g, ""))).filter((n) => !Number.isNaN(n));
  return `LSE-${(nums.length ? Math.max(...nums) : 2700) + 1}`;
}

export function isUnitNumberTaken(db: Database, propertyId: string, unitNumber: string, ignoreUnitId?: string) {
  return db.units.some(
    (u) =>
      u.id !== ignoreUnitId &&
      u.propertyId === propertyId &&
      u.unitNumber.trim().toLowerCase() === unitNumber.trim().toLowerCase(),
  );
}

export function unitLabel(db: Database, unitId: string): string {
  const u = db.units.find((x) => x.id === unitId);
  if (!u) return unitId;
  const p = getProperty(db, u.propertyId);
  return `${u.unitNumber} · ${p?.propertyName ?? ""}`;
}
