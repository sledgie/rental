// In-memory audit trail that replaces the module's database. Events are seeded once per session and
// chained with SHA-256 hashes exactly as the original repository did; exports append an audit event.
import { sha256 } from "./sha256";
import { isSupabaseConfigured, supabase } from "../../lib/supabase";
import { fetchAll } from "../../lib/financeData";

/* eslint-disable @typescript-eslint/no-explicit-any -- rows come from untyped PostgREST responses */
import { propertyRows, sampleEvents, tenantRows, unitRows } from "./seed";
import {
  actionLabel, formatActorType,
  type ActivityAction, type ActivityChange, type ActivityError, type ActivityEventDTO, type ActivityFilterOptions, type ActivityFilters,
  type ActivityListResponse, type ActivitySummary, type ActorType, type Category, type EntityType, type Outcome, type Severity,
} from "./types";

export type ActivityInput = {
  id?: string;
  occurredAt?: Date;
  recordedAt?: Date;
  actorId: string;
  actorType: ActorType;
  actorDisplayName: string;
  action: ActivityAction;
  category: Category;
  description: string;
  entityType: EntityType;
  entityId: string;
  relatedRecordLabel?: string;
  propertyId?: string | null;
  unitId?: string | null;
  tenantId?: string | null;
  changes?: ActivityChange[];
  outcome?: Outcome;
  severity?: Severity;
  sourceModule: string;
  correlationId?: string;
  reason?: string | null;
  metadata?: Record<string, unknown>;
  error?: ActivityError | null;
};

type StoredEvent = Required<Omit<ActivityInput, "reason" | "error" | "propertyId" | "unitId" | "tenantId">> & {
  reason: string | null; error: ActivityError | null; propertyId: string | null; unitId: string | null; tenantId: string | null;
  previousHash: string; eventHash: string;
};

/** What the signed-in user may see and do. */
export type AccessContext = { userId: string; userName: string; canViewTenants: boolean; canViewSensitive: boolean; canExport: boolean };

const GENESIS_HASH = "0".repeat(64);
const events: StoredEvent[] = [];
let version = 0;
const listeners = new Set<() => void>();
export const subscribeActivity = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const activityVersion = () => version;

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(",")}}`;
}

let counter = 0;
const newId = (prefix: string) => `${prefix}_${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 8)}`;

function append(input: ActivityInput): StoredEvent {
  const previousHash = events.length ? events[events.length - 1].eventHash : GENESIS_HASH;
  const base = {
    id: input.id ?? newId("evt"),
    occurredAt: input.occurredAt ?? new Date(),
    recordedAt: input.recordedAt ?? new Date(),
    actorId: input.actorId,
    actorType: input.actorType,
    actorDisplayName: input.actorDisplayName,
    action: input.action,
    category: input.category,
    description: input.description,
    entityType: input.entityType,
    entityId: input.entityId,
    relatedRecordLabel: input.relatedRecordLabel ?? input.entityId,
    propertyId: input.propertyId ?? null,
    unitId: input.unitId ?? null,
    tenantId: input.tenantId ?? null,
    changes: input.changes ?? [],
    outcome: input.outcome ?? "success",
    severity: input.severity ?? "informational",
    sourceModule: input.sourceModule,
    correlationId: input.correlationId ?? newId("cor"),
    reason: input.reason ?? null,
    metadata: input.metadata ?? {},
    error: input.error ?? null,
    previousHash,
  };
  const eventHash = sha256(stableStringify({ ...base, occurredAt: base.occurredAt.toISOString(), recordedAt: base.recordedAt.toISOString() }));
  const stored = { ...base, eventHash } as StoredEvent;
  events.push(stored);
  version += 1;
  listeners.forEach((listener) => listener());
  return stored;
}

// with Supabase the trail is the organization's own (activity_events), read by loadActivityFromDatabase; nothing is seeded
let seeded = isSupabaseConfigured;
function ensureSeeded() {
  if (seeded) return;
  seeded = true;
  [...sampleEvents].sort((a, b) => (a.occurredAt?.getTime() ?? 0) - (b.occurredAt?.getTime() ?? 0)).forEach(append);
  version = 0;
}

type PropertyRow = { id: string; name: string; address: string; city: string };
type UnitRow = { id: string; propertyId: string; unitNumber: string; monthlyRent: number; occupancy: string };
type TenantRow = { id: string; name: string; email: string; status: string };
let properties: PropertyRow[] = isSupabaseConfigured ? [] : (propertyRows as unknown as PropertyRow[]);
let units: UnitRow[] = isSupabaseConfigured ? [] : (unitRows as unknown as UnitRow[]);
let propertyById = new Map(properties.map((row) => [row.id, row]));
let unitById = new Map(units.map((row) => [row.id, row]));
let tenantById = new Map<string, TenantRow>(isSupabaseConfigured ? [] : (tenantRows as unknown as TenantRow[]).map((row) => [row.id, row]));
let loadedFor: string | null = null;

/** Reads the organization's audit trail and the property, unit and tenant names it refers to (Supabase mode). */
export async function loadActivityFromDatabase(orgId: string, force = false): Promise<void> {
  if (!isSupabaseConfigured || (!force && loadedFor === orgId)) return;
  const [rows, props, unitList, tenants] = await Promise.all([
    fetchAll("activity_events", "id, occurred_at, recorded_at, actor_id, actor_type, actor_display_name, action, category, description, entity_type, entity_id, related_record_label, property_id, unit_id, tenant_id, changes, outcome, severity, source_module, correlation_id, reason, metadata, error, previous_hash, event_hash, chain_seq", orgId, "chain_seq"),
    fetchAll("properties", "id, name, address_line1, city", orgId, "name"),
    fetchAll("units", "id, property_id, unit_number, market_rent, unit_status", orgId, "unit_number"),
    fetchAll("tenants", "id, first_name, last_name, email, status", orgId, "last_name"),
  ]);
  properties = props.map((p: any) => ({ id: p.id, name: p.name, address: p.address_line1 ?? "", city: p.city ?? "" }));
  units = unitList.map((u: any) => ({ id: u.id, propertyId: u.property_id, unitNumber: u.unit_number, monthlyRent: Number(u.market_rent ?? 0), occupancy: String(u.unit_status).replace(/_/g, " ") }));
  propertyById = new Map(properties.map((row) => [row.id, row]));
  unitById = new Map(units.map((row) => [row.id, row]));
  tenantById = new Map(tenants.map((t: any) => [t.id, { id: t.id, name: `${t.first_name} ${t.last_name ?? ""}`.trim(), email: t.email ?? "", status: t.status }]));
  const stored = rows.map((r: any): StoredEvent => ({
    id: r.id, occurredAt: new Date(r.occurred_at), recordedAt: new Date(r.recorded_at), actorId: r.actor_id ?? r.actor_type, actorType: r.actor_type, actorDisplayName: r.actor_display_name,
    action: r.action as ActivityAction, category: r.category as Category, description: r.description, entityType: r.entity_type as EntityType, entityId: r.entity_id, relatedRecordLabel: r.related_record_label || r.entity_id,
    propertyId: r.property_id, unitId: r.unit_id, tenantId: r.tenant_id, changes: Array.isArray(r.changes) ? r.changes : [], outcome: r.outcome, severity: r.severity, sourceModule: r.source_module ?? "",
    correlationId: r.correlation_id ?? "", reason: r.reason, metadata: r.metadata ?? {}, error: r.error, previousHash: r.previous_hash, eventHash: r.event_hash,
  }));
  events.splice(0, events.length, ...stored);
  loadedFor = orgId;
  version += 1;
  listeners.forEach((listener) => listener());
}

/** Actions that occur in the trail (Supabase mode), so the action filter offers what modules really record. */
export function recordedActions(): string[] {
  return [...new Set(events.map((e) => e.action as string))].sort();
}

function toDTO(event: StoredEvent, ctx: AccessContext): ActivityEventDTO {
  const metadata = { ...event.metadata };
  if (!ctx.canViewSensitive) for (const key of ["ipAddress", "userAgent", "requestId", "providerReference"]) delete metadata[key];
  return {
    id: event.id,
    occurredAt: event.occurredAt.toISOString(),
    recordedAt: event.recordedAt.toISOString(),
    actorId: event.actorId,
    actorType: event.actorType,
    actorDisplayName: event.actorDisplayName,
    action: event.action,
    category: event.category,
    description: event.description,
    entityType: event.entityType,
    entityId: event.entityId,
    relatedRecordLabel: event.relatedRecordLabel,
    propertyId: event.propertyId,
    propertyName: event.propertyId ? propertyById.get(event.propertyId)?.name ?? null : null,
    unitId: event.unitId,
    unitNumber: event.unitId ? unitById.get(event.unitId)?.unitNumber ?? null : null,
    tenantId: ctx.canViewTenants ? event.tenantId : null,
    tenantName: ctx.canViewTenants && event.tenantId ? tenantById.get(event.tenantId)?.name ?? null : null,
    changes: event.changes.map((change) => (change.sensitivity === "restricted" && !ctx.canViewSensitive ? { ...change, previousValue: null, newValue: null } : change)),
    outcome: event.outcome,
    severity: event.severity,
    sourceModule: event.sourceModule,
    correlationId: event.correlationId,
    reason: event.reason,
    metadata,
    error: event.error,
    previousHash: event.previousHash,
    eventHash: event.eventHash,
  };
}

const GROUPS: Record<string, (event: StoredEvent) => boolean> = {
  financial: (e) => e.category === "Accounting & Finance",
  propertyTenant: (e) => e.category === "Properties & Units" || e.category === "Tenants & Leases",
  documentLease: (e) => e.category === "Documents & eSignatures" || e.category === "Tenants & Leases",
  security: (e) => e.category === "Users & Security",
  failedDenied: (e) => e.outcome === "failure" || e.outcome === "denied",
};

function dateBoundary(value: string, end = false) {
  if (!value) return null;
  const date = new Date(value.length === 10 ? `${value}T${end ? "23:59:59.999" : "00:00:00.000"}Z` : value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function matches(event: StoredEvent, filters: ActivityFilters, ctx: AccessContext) {
  const from = dateBoundary(filters.from), to = dateBoundary(filters.to, true);
  if (from && event.occurredAt < from) return false;
  if (to && event.occurredAt > to) return false;
  if (filters.actorId && event.actorId !== filters.actorId) return false;
  if (filters.actorType && event.actorType !== filters.actorType) return false;
  if (filters.category && event.category !== filters.category) return false;
  if (filters.action && event.action !== filters.action) return false;
  if (filters.propertyId && event.propertyId !== filters.propertyId) return false;
  if (filters.unitId && event.unitId !== filters.unitId) return false;
  if (filters.entityType && event.entityType !== filters.entityType) return false;
  if (filters.entityId && event.entityId !== filters.entityId) return false;
  if (filters.outcome && event.outcome !== filters.outcome) return false;
  if (filters.severity && event.severity !== filters.severity) return false;
  if (filters.q) {
    const q = filters.q.toLowerCase();
    const haystack = [
      event.description, event.actorDisplayName, event.id, event.entityId, event.relatedRecordLabel, event.correlationId,
      event.propertyId ? propertyById.get(event.propertyId)?.name : "", event.unitId ? unitById.get(event.unitId)?.unitNumber : "",
      String(event.metadata.recordNumber ?? ""), ctx.canViewTenants && event.tenantId ? tenantById.get(event.tenantId)?.name : "",
    ];
    if (!haystack.some((value) => value && String(value).toLowerCase().includes(q))) return false;
  }
  return true;
}

const SORTERS: Record<string, (e: StoredEvent) => string | number> = {
  occurredAt: (e) => e.occurredAt.getTime(),
  actorDisplayName: (e) => e.actorDisplayName.toLowerCase(),
  action: (e) => e.action,
  category: (e) => e.category,
  outcome: (e) => e.outcome,
  severity: (e) => e.severity,
};

function filtered(filters: ActivityFilters, ctx: AccessContext, withGroup: boolean) {
  ensureSeeded();
  const group = withGroup ? GROUPS[filters.group] : undefined;
  const key = SORTERS[filters.sort] ?? SORTERS.occurredAt;
  const dir = filters.direction === "asc" ? 1 : -1;
  return events.filter((event) => matches(event, filters, ctx) && (!group || group(event))).sort((a, b) => {
    const x = key(a), y = key(b);
    if (x !== y) return (x < y ? -1 : 1) * dir;
    return b.occurredAt.getTime() - a.occurredAt.getTime() || (b.id < a.id ? -1 : 1);
  });
}

function summaryFor(filters: ActivityFilters, ctx: AccessContext): ActivitySummary {
  const rows = filtered(filters, ctx, false);
  const count = (predicate: (e: StoredEvent) => boolean) => rows.filter(predicate).length;
  return { total: rows.length, financial: count(GROUPS.financial), propertyTenant: count(GROUPS.propertyTenant), documentLease: count(GROUPS.documentLease), security: count(GROUPS.security), failedDenied: count(GROUPS.failedDenied) };
}

function filterOptions(): ActivityFilterOptions {
  ensureSeeded();
  const actors = new Map<string, { id: string; name: string; type: ActorType }>();
  events.forEach((e) => actors.set(e.actorId, { id: e.actorId, name: e.actorDisplayName, type: e.actorType }));
  return {
    actors: [...actors.values()].sort((a, b) => a.name.localeCompare(b.name)),
    properties: [...properties].sort((a, b) => a.name.localeCompare(b.name)).map(({ id, name }) => ({ id, name })),
    units: [...units].map((u) => ({ id: u.id, number: u.unitNumber, propertyId: u.propertyId, propertyName: propertyById.get(u.propertyId)?.name ?? "" }))
      .sort((a, b) => a.propertyName.localeCompare(b.propertyName) || a.number.localeCompare(b.number, undefined, { numeric: true })),
  };
}

export function getActivityLogs(filters: ActivityFilters, ctx: AccessContext): ActivityListResponse {
  const rows = filtered(filters, ctx, true);
  const total = rows.length;
  const page = Math.min(filters.page, Math.max(1, Math.ceil(total / filters.pageSize)));
  return {
    items: rows.slice((page - 1) * filters.pageSize, page * filters.pageSize).map((e) => toDTO(e, ctx)),
    total, page, pageSize: filters.pageSize, totalPages: Math.max(1, Math.ceil(total / filters.pageSize)),
    summary: summaryFor(filters, ctx), options: filterOptions(), sampleData: !isSupabaseConfigured,
  };
}

export function getActivityById(id: string, ctx: AccessContext) {
  ensureSeeded();
  const event = events.find((e) => e.id === id);
  return event ? toDTO(event, ctx) : null;
}

export function getRelatedActivities(entityType: string, entityId: string, ctx: AccessContext, excludeId?: string, limit = 100) {
  ensureSeeded();
  const direct = (e: StoredEvent) => e.entityType === entityType && e.entityId === entityId;
  const related = (e: StoredEvent) => {
    if (entityType === "property") return e.propertyId === entityId;
    if (entityType === "unit") return e.unitId === entityId || direct(e);
    if (entityType === "tenant") return e.tenantId === entityId || direct(e);
    if (["invoice", "lease", "project", "message", "signature_request"].includes(entityType)) return direct(e) || e.correlationId === `cor_${entityId}`;
    return direct(e);
  };
  return events.filter((e) => related(e) && e.id !== excludeId).sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime()).slice(0, limit).map((e) => toDTO(e, ctx));
}

export function getRecordTimeline(entityType: string, entityId: string, ctx: AccessContext) {
  const list = getRelatedActivities(entityType, entityId, ctx);
  let title = list[0]?.relatedRecordLabel ?? entityId;
  let subtitle = `${entityType.replaceAll("_", " ")} · ${entityId}`;
  if (entityType === "property") {
    const record = propertyById.get(entityId);
    if (record) { title = record.name; subtitle = `${record.address} · ${record.city}`; }
  } else if (entityType === "unit") {
    const record = unitById.get(entityId);
    if (record) { title = `${propertyById.get(record.propertyId)?.name ?? "Property"} · Unit ${record.unitNumber}`; subtitle = `Monthly rent $${Number(record.monthlyRent).toLocaleString("en-US")} · ${record.occupancy}`; }
  } else if (entityType === "tenant" && ctx.canViewTenants) {
    const record = tenantById.get(entityId);
    if (record) { title = record.name; subtitle = `${record.status} tenant · ${record.email}`; }
  }
  return { title, subtitle, entityType, entityId, events: list };
}

function csvCell(value: unknown) {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[\s\u0000-\u001f]*[=+\-@]/.test(text) || /^[\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

/** Builds the filtered CSV (no before/after values) and records the export itself in the audit trail. */
export function exportActivityLogs(filters: ActivityFilters, ctx: AccessContext) {
  const rows = filtered({ ...filters, page: 1 }, ctx, true).map((e) => toDTO(e, ctx));
  const headers = ["Event ID", "Timestamp", "Actor", "Actor Type", "Action", "Category", "Description", "Property", "Unit", "Related Record", "Result", "Severity"];
  const lines = rows.map((event) => [
    event.id, event.occurredAt, event.actorDisplayName, formatActorType(event.actorType), actionLabel(event.action), event.category, event.description,
    event.propertyName ?? "", event.unitNumber ?? "", event.relatedRecordLabel, event.outcome, event.severity,
  ].map(csvCell).join(","));
  const csv = `﻿${headers.map(csvCell).join(",")}\r\n${lines.join("\r\n")}${lines.length ? "\r\n" : ""}`;
  const fileName = `activity-logs-${new Date().toISOString().slice(0, 10)}.csv`;
  const audit = append({
    actorId: ctx.userId, actorType: "user", actorDisplayName: ctx.userName, action: "audit.exported", category: "Users & Security",
    description: `Activity log export created: ${rows.length} records (CSV).`, entityType: "audit_export", entityId: newId("exp"), relatedRecordLabel: fileName,
    sourceModule: "Activity Logs", severity: "warning", reason: "User-initiated filtered audit export",
    metadata: { rowCount: rows.length, format: "CSV", filterFields: Object.entries(filters).filter(([, value]) => Boolean(value)).map(([key]) => key), changeValuesIncluded: false, sampleWorkspace: !isSupabaseConfigured },
  });
  if (isSupabaseConfigured && loadedFor) {
    // the export itself is recorded in the organization's audit trail
    void supabase.rpc("record_activity", {
      p_org: loadedFor, p_action: "audit.exported", p_category: "Users & Security", p_description: audit.description, p_entity_type: "audit_export", p_entity_id: audit.entityId,
      p_label: fileName, p_severity: "warning", p_reason: "User-initiated filtered audit export", p_metadata: { rowCount: rows.length, format: "CSV" }, p_source_module: "Activity Logs",
    });
  }
  return { csv, rowCount: rows.length, fileName, auditEventId: audit.id };
}
