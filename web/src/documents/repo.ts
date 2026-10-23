// Supabase access for the Document Center: every document in the organization (uploaded here or from Leases, Maintenance, Projects, Expenses,
// Properties ...), the business records it can be linked to, and the actions on it (details, links, new file version, archive, download).
// Tables: documents, document_versions, document_links (+ the records the links point at) and activity_events. Row-Level Security decides who
// may read or write; files live in private Storage buckets and open through short-lived links.
import { supabase, toError } from "../lib/supabase";
import { getActiveOrgId } from "../lib/activeOrg";
import { fetchAll } from "../lib/financeData";
import { documentUrl, documentUrls, uploadDocument } from "../lib/documents";
import type { CreationMethod, DocumentActivity, DocumentRecord, EntityReference, MockBusinessRecord, RecordReference, RelatedRecord } from "./data";

/* eslint-disable @typescript-eslint/no-explicit-any -- rows come from untyped PostgREST responses */

export interface Loaded {
  documents: DocumentRecord[];
  registry: MockBusinessRecord[];
  entities: EntityReference[];
}

export interface SaveValues {
  name: string;
  documentType: string;
  category: string;
  originModule: string;
  creationMethod: CreationMethod;
  primary: RecordReference | null;
  related: RelatedRecord[];
  description: string;
  tags: string[];
  file: File | null;
}

interface Target { entityType: string; rowId: string }

/** "Module::record id" -> the row the link points at */
const targetOf = new Map<string, Target>();
/** document number -> row id */
const documentRow = new Map<string, string>();
const keyOf = (r: { module: string; recordId: string }) => `${r.module}::${r.recordId}`;
const GENERAL_BUCKET = "lease-documents";

function friendly(error: { code?: string; message?: string }, fallback: string): Error {
  if (error.code === "42501") return new Error("You don't have permission to change documents.");
  if (error.code === "23505") return new Error("A record with the same number already exists.");
  return toError(error, fallback);
}
const check = (res: { error: any }, fallback: string) => { if (res.error) throw friendly(res.error, fallback); };
const dateOnly = (v: string | null | undefined) => (v ? String(v) : undefined);
const extensionOf = (name: string) => (name.includes(".") ? name.split(".").pop()!.toLowerCase() : "");

// ------------------------------------------------------------------ the records documents can be linked to
async function loadRegistry(orgId: string): Promise<{ registry: MockBusinessRecord[]; byRow: Map<string, RecordReference>; entities: EntityReference[] }> {
  const [properties, units, tenants, leases, leaseUnits, parties, applications, invoices, payments, requests, workOrders, assets, projects, bills, vendors] = await Promise.all([
    fetchAll("properties", "id, code, name, address_line1", orgId, "name"),
    fetchAll("units", "id, property_id, unit_code, unit_number", orgId, "unit_number"),
    fetchAll("tenants", "id, tenant_number, first_name, last_name", orgId, "last_name"),
    fetchAll("leases", "id, lease_number, status", orgId, "lease_number"),
    fetchAll("lease_units", "lease_id, unit_id", orgId, "lease_id"),
    fetchAll("lease_parties", "lease_id, tenant_id, role, relationship_end_date", orgId, "lease_id"),
    fetchAll("applications", "id, application_number, property_id, unit_id", orgId, "application_number"),
    fetchAll("invoices", "id, invoice_number, tenant_id, property_id, unit_id", orgId, "invoice_number"),
    fetchAll("payments", "id, payment_number, tenant_id", orgId, "payment_number"),
    fetchAll("maintenance_requests", "id, request_number, title, property_id, unit_id", orgId, "request_number"),
    fetchAll("maintenance_work_orders", "id, work_order_number, title, request_id", orgId, "work_order_number"),
    fetchAll("assets", "id, asset_number, name, property_id, unit_id", orgId, "asset_number"),
    fetchAll("projects", "id, project_number, name, property_id, unit_id", orgId, "project_number"),
    fetchAll("bills", "id, bill_number, name, property_id", orgId, "bill_number"),
    fetchAll("vendors", "id, company_name", orgId, "company_name"),
  ]);
  const entity = (entityType: string, entityId: string, entityLabel: string): EntityReference => ({ entityType, entityId, entityLabel });
  const propertyEntity = new Map<string, EntityReference>(properties.map((p: any) => [p.id, entity("Property", p.code ?? p.id, p.name)]));
  const unitInfo = new Map<string, any>(units.map((u: any) => [u.id, u]));
  const unitEntity = (id: string | null | undefined): EntityReference | undefined => {
    const u = id ? unitInfo.get(id) : undefined;
    return u ? entity("Unit", u.unit_code ?? u.unit_number, `${propertyEntity.get(u.property_id)?.entityLabel ?? ""} · Unit ${u.unit_number}`.replace(/^ · /, "")) : undefined;
  };
  const tenantEntity = new Map<string, EntityReference>(tenants.map((t: any) => [t.id, entity("Tenant", t.tenant_number ?? t.id, `${t.first_name} ${t.last_name ?? ""}`.trim())]));
  const compact = (list: (EntityReference | undefined)[]) => list.filter((e): e is EntityReference => !!e);
  const propertyAndUnit = (propertyId?: string | null, unitId?: string | null) => compact([propertyId ? propertyEntity.get(propertyId) : undefined, unitEntity(unitId)]);

  const registry: MockBusinessRecord[] = [];
  const byRow = new Map<string, RecordReference>();
  targetOf.clear();
  const add = (module: string, recordType: string, entityType: string, rowId: string, recordId: string, recordLabel: string, description: string, relatedEntities: EntityReference[]) => {
    const reference: RecordReference = { module, recordType, recordId, recordLabel };
    registry.push({ reference, description, relatedEntities });
    byRow.set(`${entityType}:${rowId}`, reference);
    targetOf.set(keyOf(reference), { entityType, rowId });
  };

  for (const p of properties) add("Properties", "Property", "property", p.id, p.code ?? p.id, p.name, p.address_line1 ?? "", compact([propertyEntity.get(p.id)]));
  for (const u of units) add("Units", "Unit", "unit", u.id, u.unit_code ?? u.unit_number, unitEntity(u.id)?.entityLabel ?? `Unit ${u.unit_number}`, "", propertyAndUnit(u.property_id, u.id));
  for (const t of tenants) add("Tenants", "Tenant", "tenant", t.id, t.tenant_number ?? t.id, tenantEntity.get(t.id)!.entityLabel, "", compact([tenantEntity.get(t.id)]));
  for (const l of leases) {
    const unitIds = leaseUnits.filter((x: any) => x.lease_id === l.id).map((x: any) => x.unit_id);
    const party = parties.find((x: any) => x.lease_id === l.id && x.role === "main_tenant" && !x.relationship_end_date) ?? parties.find((x: any) => x.lease_id === l.id);
    const first = unitInfo.get(unitIds[0]);
    add("Leases", "Lease", "lease", l.id, l.lease_number ?? l.id, [first ? propertyEntity.get(first.property_id)?.entityLabel : "", unitIds.length ? `Unit${unitIds.length > 1 ? "s" : ""} ${unitIds.map((id: string) => unitInfo.get(id)?.unit_number).filter(Boolean).join(", ")}` : ""].filter(Boolean).join(" · ") || l.lease_number,
      party ? `Lease for ${tenantEntity.get(party.tenant_id)?.entityLabel ?? "the tenant"}.` : "",
      compact([party ? tenantEntity.get(party.tenant_id) : undefined, first ? propertyEntity.get(first.property_id) : undefined, ...unitIds.map((id: string) => unitEntity(id))]));
  }
  for (const a of applications) add("Applications", "Application", "application", a.id, a.application_number ?? a.id, `Application ${a.application_number ?? ""}`.trim(), "", propertyAndUnit(a.property_id, a.unit_id));
  for (const i of invoices) add("Invoicing", "Invoice", "invoice", i.id, i.invoice_number ?? i.id, `Invoice ${i.invoice_number ?? ""} · ${tenantEntity.get(i.tenant_id)?.entityLabel ?? ""}`.trim(), "", compact([tenantEntity.get(i.tenant_id), ...propertyAndUnit(i.property_id, i.unit_id)]));
  for (const p of payments) add("Payments", "Payment", "payment", p.id, p.payment_number ?? p.id, `Payment ${p.payment_number ?? ""} · ${tenantEntity.get(p.tenant_id)?.entityLabel ?? ""}`.trim(), "", compact([tenantEntity.get(p.tenant_id)]));
  const requestInfo = new Map<string, any>(requests.map((r: any) => [r.id, r]));
  for (const r of requests) add("Maintenance", "Request", "maintenance_request", r.id, r.request_number ?? r.id, r.title, "", propertyAndUnit(r.property_id, r.unit_id));
  for (const w of workOrders) { const r = requestInfo.get(w.request_id); add("Maintenance", "Work order", "work_order", w.id, w.work_order_number ?? w.id, w.title, "", r ? propertyAndUnit(r.property_id, r.unit_id) : []); }
  for (const a of assets) add("Maintenance", "Asset", "asset", a.id, a.asset_number ?? a.id, a.name, "", propertyAndUnit(a.property_id, a.unit_id));
  for (const p of projects) add("Projects", "Project", "project", p.id, p.project_number ?? p.id, p.name, "", propertyAndUnit(p.property_id, p.unit_id));
  for (const b of bills) add("Expenses", "Bill", "bill", b.id, b.bill_number ?? b.id, b.name, "", propertyAndUnit(b.property_id));
  for (const v of vendors) add("Vendors", "Vendor", "vendor", v.id, v.company_name, v.company_name, "", compact([entity("Vendor", v.id, v.company_name)]));

  const entities = [...propertyEntity.values(), ...tenantEntity.values(), ...units.map((u: any) => unitEntity(u.id)!), ...vendors.map((v: any) => entity("Vendor", v.id, v.company_name))];
  return { registry, byRow, entities };
}

// ------------------------------------------------------------------ load
export async function loadAll(orgId: string): Promise<Loaded> {
  const [{ registry, byRow, entities }, documents, versions, links, events, profiles] = await Promise.all([
    loadRegistry(orgId),
    fetchAll("documents", "*", orgId, "created_at"),
    fetchAll("document_versions", "document_id, version_number, storage_bucket, storage_path, file_name, mime_type, size_bytes", orgId, "version_number"),
    fetchAll("document_links", "document_id, entity_type, entity_id, is_primary, relationship_type", orgId, "created_at"),
    supabase.from("activity_events").select("id, entity_id, occurred_at, actor_display_name, related_record_label, description").eq("organization_id", orgId).eq("entity_type", "document").order("occurred_at").limit(5000),
    supabase.from("profiles").select("id, full_name, email"),
  ]);
  const names = new Map<string, string>((profiles.data ?? []).map((p: any) => [p.id, p.full_name || p.email]));
  const live = documents.filter((d: any) => !d.deleted_at);
  const latest = new Map<string, any>();
  for (const v of versions) latest.set(v.document_id, v); // sorted by version: the last one wins
  const urls = await documentUrls([...latest.values()].filter((v) => live.some((d: any) => d.id === v.document_id)).map((v) => ({ bucket: v.storage_bucket, path: v.storage_path }))).catch(() => new Map<string, string>());
  documentRow.clear();
  const entityRefs = (docId: string) => links.filter((l: any) => l.document_id === docId).flatMap((l: any) => {
    const reference = byRow.get(`${l.entity_type}:${l.entity_id}`);
    return reference ? [{ reference, link: l }] : [];
  });
  const unique = (list: EntityReference[]) => [...new Map(list.map((e) => [`${e.entityType}:${e.entityId}`, e])).values()];

  const out = live.map((d: any): DocumentRecord => {
    const number = d.document_number ?? d.id;
    documentRow.set(number, d.id);
    const v = latest.get(d.id);
    const refs = entityRefs(d.id);
    const primaryLink = refs.find((r) => r.link.is_primary) ?? refs[0];
    const registryOf = (reference: RecordReference) => registry.find((r) => r.reference.module === reference.module && r.reference.recordId === reference.recordId);
    const activity: DocumentActivity[] = [
      { id: `${d.id}-created`, action: "Document created in registry", at: d.created_at, actor: names.get(d.uploaded_by) ?? "Team member" },
      ...(events.data ?? []).filter((e: any) => e.entity_id === number).map((e: any): DocumentActivity => ({ id: e.id, action: e.related_record_label || "Updated", at: e.occurred_at, actor: e.actor_display_name, detail: e.description || undefined })),
    ];
    return {
      id: number, name: d.name, documentType: d.document_type, category: d.category, originModule: d.origin_module, creationMethod: d.creation_method,
      primaryRecord: primaryLink?.reference ?? null,
      relatedRecords: refs.filter((r) => r !== primaryLink).map((r): RelatedRecord => ({ ...r.reference, relationshipType: r.link.relationship_type ?? "Related record" })),
      relatedEntities: unique(refs.flatMap((r) => registryOf(r.reference)?.relatedEntities ?? [])),
      file: v
        ? { fileName: v.file_name, extension: extensionOf(v.file_name), mimeType: v.mime_type ?? undefined, sizeBytes: v.size_bytes === null ? undefined : Number(v.size_bytes), localPreviewUrl: urls.get(`${v.storage_bucket}/${v.storage_path}`), bucket: v.storage_bucket, path: v.storage_path }
        : { fileName: "", extension: "" },
      description: d.description ?? undefined, tags: d.tags ?? [], status: d.status === "archived" ? "archived" : "active",
      createdAt: d.created_at, createdBy: names.get(d.uploaded_by) ?? "Team member", updatedAt: d.updated_at, updatedBy: undefined, activity,
    };
  });
  return { documents: out.sort((a, b) => b.createdAt.localeCompare(a.createdAt)), registry, entities };
}

// ------------------------------------------------------------------ changes
async function logActivity(orgId: string, number: string, action: string, detail?: string) {
  // best effort: a logging failure never undoes a saved change
  await supabase.rpc("record_activity", {
    p_org: orgId, p_action: `document.${action.toLowerCase().replace(/[^a-z]+/g, "_").replace(/^_+|_+$/g, "")}`, p_category: "Documents", p_description: detail ?? action, p_entity_type: "document",
    p_entity_id: number, p_label: action, p_source_module: "Document Center",
  });
}

async function setLinks(orgId: string, docId: string, primary: RecordReference | null, related: RecordReference[]): Promise<void> {
  const wanted = new Map<string, { target: Target; label: string; primary: boolean }>();
  const want = (r: RecordReference, isPrimary: boolean) => {
    const target = targetOf.get(keyOf(r));
    if (target) wanted.set(`${target.entityType}:${target.rowId}`, { target, label: r.recordLabel, primary: isPrimary });
  };
  related.forEach((r) => want(r, false));
  if (primary) want(primary, true);
  const existing = await supabase.from("document_links").select("id, entity_type, entity_id, is_primary").eq("document_id", docId);
  check(existing, "Unable to read the document links.");
  for (const row of existing.data ?? []) {
    const key = `${row.entity_type}:${row.entity_id}`;
    const w = wanted.get(key);
    if (!w) check(await supabase.from("document_links").delete().eq("id", row.id), "Unable to remove a document link.");
    else {
      if (row.is_primary !== w.primary) check(await supabase.from("document_links").update({ is_primary: w.primary }).eq("id", row.id), "Unable to update a document link.");
      wanted.delete(key);
    }
  }
  const fresh = [...wanted.values()];
  if (fresh.length) {
    check(await supabase.from("document_links").insert(fresh.map((w) => ({
      organization_id: orgId, document_id: docId, entity_type: w.target.entityType, entity_id: w.target.rowId, entity_label: w.label, is_primary: w.primary, relationship_type: w.primary ? "Primary record" : "Related record",
    }))), "Unable to link the document.");
  }
}

export async function createDocument(v: SaveValues): Promise<string> {
  const orgId = getActiveOrgId();
  if (!orgId) throw new Error("Select an organization first.");
  const { data: auth } = await supabase.auth.getUser();
  const id = crypto.randomUUID();
  const inserted = await supabase.from("documents").insert({
    id, organization_id: orgId, name: v.name, document_type: v.documentType, category: v.category, origin_module: v.originModule, creation_method: v.creationMethod, description: v.description || null,
    tags: v.tags, status: "active", uploaded_by: auth.user?.id ?? null,
  }).select("document_number").single();
  check(inserted, "Unable to save the document.");
  const number = (inserted.data as any).document_number ?? id;
  documentRow.set(number, id);
  try {
    if (v.file) {
      await uploadDocument({
        id, newVersionOf: true, versionNumber: 1, bucket: GENERAL_BUCKET, area: "documents", file: v.file, entityType: "property", entityId: id, category: v.category, documentType: v.documentType,
        originModule: v.originModule, title: v.name, status: "active", description: v.description || undefined,
      });
    }
    await setLinks(orgId, id, v.primary, v.related);
  } catch (error) {
    await supabase.from("documents").delete().eq("id", id); // do not leave a half-saved document behind
    throw error;
  }
  await logActivity(orgId, number, "Document created in registry", v.file ? `${v.file.name} uploaded` : "Metadata-only document record added");
  return number;
}

export async function updateDocument(number: string, v: SaveValues, before: DocumentRecord): Promise<void> {
  const orgId = getActiveOrgId();
  if (!orgId) throw new Error("Select an organization first.");
  const id = documentRow.get(number);
  if (!id) throw new Error(`Document ${number} could not be found. Refresh the page and try again.`);
  const res = await supabase.from("documents").update({
    name: v.name, document_type: v.documentType, category: v.category, origin_module: v.originModule, creation_method: v.creationMethod, description: v.description || null, tags: v.tags,
  }).eq("id", id).select("id");
  check(res, "Unable to save the document.");
  if (!res.data?.length) throw new Error("You don't have permission to change documents.");
  if (v.file) {
    const last = await supabase.from("document_versions").select("version_number").eq("document_id", id).order("version_number", { ascending: false }).limit(1);
    const next = ((last.data ?? [])[0]?.version_number ?? 0) + 1;
    await uploadDocument({
      id, newVersionOf: true, versionNumber: next, bucket: GENERAL_BUCKET, area: "documents", file: v.file, entityType: "property", entityId: id, category: v.category, documentType: v.documentType,
      originModule: v.originModule, title: v.name, status: before.status, description: v.description || undefined,
    });
  }
  await setLinks(orgId, id, v.primary, v.related);
  const changed = [v.file ? "new file" : "", before.primaryRecord?.recordId !== v.primary?.recordId ? "primary record" : ""].filter(Boolean).join(", ");
  await logActivity(orgId, number, "Metadata updated", changed ? `Changed: ${changed}` : undefined);
}

export async function setArchived(number: string, archived: boolean): Promise<void> {
  const orgId = getActiveOrgId();
  const id = documentRow.get(number);
  if (!orgId || !id) throw new Error(`Document ${number} could not be found. Refresh the page and try again.`);
  const res = await supabase.from("documents").update({ status: archived ? "archived" : "active", archived_at: archived ? new Date().toISOString() : null }).eq("id", id).select("id");
  check(res, "Unable to change the document.");
  if (!res.data?.length) throw new Error("You don't have permission to change documents.");
  await logActivity(orgId, number, archived ? "Document archived" : "Document restored");
}

/** A short-lived link that downloads the stored file under its own name. */
export async function downloadLink(doc: DocumentRecord): Promise<string> {
  const { bucket, path, fileName } = doc.file;
  if (!bucket || !path) throw new Error("This document has no stored file.");
  const orgId = getActiveOrgId();
  const url = await documentUrl(bucket, path, fileName || doc.name);
  if (orgId) void logActivity(orgId, doc.id, "File downloaded");
  return url;
}
