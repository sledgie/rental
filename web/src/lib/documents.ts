// Files and photos in Supabase Storage, registered as rows in `documents` / `document_versions` and linked to business records through
// `document_links` (see database/migrations/003 and 008). Objects are stored as <organization_id>/<area>/<record id>/<uuid>-<file name> in a
// private bucket and opened through short-lived signed links. Row-Level Security and the storage policies decide who may read or write.
import { supabase, toError } from "./supabase";
import { getActiveOrgId } from "./activeOrg";
import { fetchAll } from "./financeData";

/* eslint-disable @typescript-eslint/no-explicit-any -- rows come from untyped PostgREST responses */

export type DocumentBucket = "maintenance-attachments" | "project-documents" | "lease-documents" | "finance-documents" | "property-images" | "tenant-identification";
export type EntityType =
  | "property" | "unit" | "tenant" | "lease" | "vendor" | "maintenance_request" | "work_order" | "asset" | "project" | "project_task" | "invoice" | "payment"
  | "expense" | "bill" | "bank_account" | "deposit" | "project_expense" | "project_invoice";

export interface StoredDocument {
  id: string;
  name: string;
  category: string;
  documentType: string;
  sizeBytes: number;
  mimeType: string;
  uploadedBy: string;
  uploadedAt: string;
  expiryDate?: string;
  visibility: "internal" | "team" | "restricted";
  stage?: "before" | "during" | "after";
  bucket: string;
  path: string;
  entityType: EntityType;
  entityId: string;
  description?: string;
}

export const MAX_FILE_BYTES = 25 * 1024 * 1024;

export function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const safeName = (name: string) => name.replace(/[^\w.\- ]+/g, "_").replace(/\s+/g, " ").trim().slice(0, 120) || "file";

function friendly(error: { message?: string; statusCode?: string | number } | null, fallback: string): Error {
  const message = String(error?.message ?? "");
  if (/mime type/i.test(message)) return new Error("That file type is not allowed here. Use a PDF, image or common office document.");
  if (/exceeded the maximum allowed size|payload too large|too large/i.test(message)) return new Error("That file is too large (the limit is 25 MB).");
  if (/row-level security|violates|not authorized|permission/i.test(message)) return new Error("You don't have permission to add or change files here.");
  if (/bucket not found/i.test(message)) return new Error("File storage is not set up yet. Run migration 008_storage_policies.sql in Supabase.");
  return toError(error as any, fallback);
}

export interface UploadOptions {
  /** document id; pass one when the screen already shows the file (so a reload does not duplicate it) */
  id?: string;
  bucket: DocumentBucket;
  /** folder under the organization, e.g. "requests" */
  area: string;
  file: File;
  entityType: EntityType;
  entityId: string;
  entityLabel?: string;
  category: string;
  documentType?: string;
  originModule: string;
  stage?: "before" | "during" | "after";
  visibility?: "internal" | "team" | "restricted";
  expiryDate?: string;
  isSensitive?: boolean;
  /** a second record the file also belongs to (e.g. a project document for one task) */
  alsoLinkTo?: { entityType: EntityType; entityId: string; entityLabel?: string };
  /** display title when it differs from the file name */
  title?: string;
  status?: "active" | "archived" | "draft" | "awaiting_signature" | "signed" | "superseded" | "expired";
  signatureStatus?: "not_required" | "pending" | "signed" | "declined";
  documentDate?: string;
  description?: string;
  /** id of the version row (when the screen already shows it) and its number */
  versionId?: string;
  versionNumber?: number;
  /** free text kept with this version (e.g. its own signature details) */
  versionNotes?: string;
  /** add this file as a new version of the existing document with this id (`id` must be that document) */
  newVersionOf?: boolean;
}

/** Uploads the file, registers it as a document with a first version, and links it to the record. */
export async function uploadDocument(o: UploadOptions): Promise<StoredDocument> {
  const orgId = getActiveOrgId();
  if (!orgId) throw new Error("Select an organization first.");
  if (o.file.size > MAX_FILE_BYTES) throw new Error(`${o.file.name} is too large (the limit is 25 MB).`);
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id ?? null;
  const documentId = o.id ?? crypto.randomUUID();
  const path = `${orgId}/${o.area}/${o.entityId}/${crypto.randomUUID()}-${safeName(o.file.name)}`;
  const isNewVersion = !!o.newVersionOf;

  const up = await supabase.storage.from(o.bucket).upload(path, o.file, { contentType: o.file.type || "application/octet-stream", upsert: false });
  if (up.error) throw friendly(up.error, "Unable to upload the file.");

  const versionId = o.versionId ?? crypto.randomUUID();
  const cleanup = async () => { await supabase.storage.from(o.bucket).remove([path]); };
  try {
    if (!isNewVersion) {
      const doc = await supabase.from("documents").insert({
        id: documentId, organization_id: orgId, name: o.title ?? o.file.name, document_type: o.documentType ?? o.category, category: o.category, origin_module: o.originModule, creation_method: "manual_upload",
        visibility: o.visibility ?? "internal", expiry_date: o.expiryDate ?? null, is_sensitive: !!o.isSensitive, uploaded_by: userId, status: o.status ?? "active",
        signature_status: o.signatureStatus ?? "not_required", document_date: o.documentDate ?? null, description: o.description ?? null,
      });
      if (doc.error) throw friendly(doc.error, "Unable to save the document.");
    }
    const version = await supabase.from("document_versions").insert({
      id: versionId, organization_id: orgId, document_id: documentId, version_number: o.versionNumber ?? 1, storage_bucket: o.bucket, storage_path: path, file_name: o.file.name, mime_type: o.file.type || null,
      size_bytes: o.file.size, uploaded_by: userId, notes: o.versionNotes ?? null,
    }).select("id").single();
    if (version.error) throw friendly(version.error, "Unable to save the document.");
    const current = await supabase.from("documents").update(
      isNewVersion
        ? { current_version_id: version.data.id, name: o.title ?? o.file.name, status: o.status ?? "active", signature_status: o.signatureStatus ?? "not_required", document_date: o.documentDate ?? null, expiry_date: o.expiryDate ?? null }
        : { current_version_id: version.data.id },
    ).eq("id", documentId);
    if (current.error) throw friendly(current.error, "Unable to save the document.");
    if (!isNewVersion) {
      const link = await supabase.from("document_links").insert({
        organization_id: orgId, document_id: documentId, entity_type: o.entityType, entity_id: o.entityId, entity_label: o.entityLabel ?? null, stage: o.stage ?? null,
      });
      if (link.error) throw friendly(link.error, "Unable to link the document.");
      if (o.alsoLinkTo) {
        const second = await supabase.from("document_links").insert({
          organization_id: orgId, document_id: documentId, entity_type: o.alsoLinkTo.entityType, entity_id: o.alsoLinkTo.entityId, entity_label: o.alsoLinkTo.entityLabel ?? null, stage: o.stage ?? null,
        });
        if (second.error) throw friendly(second.error, "Unable to link the document.");
      }
    }
  } catch (error) {
    if (isNewVersion) await supabase.from("document_versions").delete().eq("id", versionId);
    else await supabase.from("documents").delete().eq("id", documentId); // removes the version and links with it
    await cleanup();
    throw error;
  }
  return {
    id: documentId, name: o.file.name, category: o.category, documentType: o.documentType ?? o.category, sizeBytes: o.file.size, mimeType: o.file.type, uploadedBy: "", uploadedAt: new Date().toISOString(),
    expiryDate: o.expiryDate, visibility: o.visibility ?? "internal", stage: o.stage, bucket: o.bucket, path, entityType: o.entityType, entityId: o.entityId,
  };
}

/** Documents linked to records of the given types (any record of that type when `entityIds` is omitted). */
export async function listDocuments(orgId: string, entityTypes: EntityType[], entityIds?: string[]): Promise<StoredDocument[]> {
  const links = (await fetchAll("document_links", "document_id, entity_type, entity_id, stage", orgId, "created_at")).filter(
    (l: any) => entityTypes.includes(l.entity_type) && (!entityIds || entityIds.includes(l.entity_id)),
  );
  if (!links.length) return [];
  const ids = [...new Set<string>(links.map((l: any) => l.document_id))];
  const documents: any[] = [];
  const versions: any[] = [];
  for (let i = 0; i < ids.length; i += 150) {
    const chunk = ids.slice(i, i + 150);
    const [d, v] = await Promise.all([
      supabase.from("documents").select("id, name, document_type, category, visibility, expiry_date, uploaded_by, created_at, description").in("id", chunk).is("deleted_at", null),
      supabase.from("document_versions").select("document_id, version_number, storage_bucket, storage_path, mime_type, size_bytes").in("document_id", chunk).order("version_number", { ascending: false }),
    ]);
    if (d.error) throw friendly(d.error, "Unable to load documents.");
    if (v.error) throw friendly(v.error, "Unable to load documents.");
    documents.push(...(d.data ?? []));
    versions.push(...(v.data ?? []));
  }
  const uploaders = [...new Set(documents.map((d) => d.uploaded_by).filter(Boolean))];
  const names = new Map<string, string>();
  if (uploaders.length) {
    const p = await supabase.from("profiles").select("id, full_name, email").in("id", uploaders);
    for (const row of p.data ?? []) names.set(row.id, row.full_name || row.email);
  }
  const byId = new Map(documents.map((d) => [d.id, d]));
  const latest = new Map<string, any>();
  for (const v of versions) if (!latest.has(v.document_id)) latest.set(v.document_id, v);
  return links.flatMap((l: any): StoredDocument[] => {
    const d = byId.get(l.document_id);
    const v = latest.get(l.document_id);
    if (!d || !v) return [];
    return [{
      id: d.id, name: d.name, category: d.category, documentType: d.document_type, sizeBytes: Number(v.size_bytes ?? 0), mimeType: v.mime_type ?? "", uploadedBy: names.get(d.uploaded_by) ?? "Team member",
      uploadedAt: d.created_at, expiryDate: d.expiry_date ?? undefined, visibility: d.visibility, stage: l.stage ?? undefined, bucket: v.storage_bucket, path: v.storage_path, entityType: l.entity_type, entityId: l.entity_id, description: d.description ?? undefined,
    }];
  });
}

/** A short-lived link to open or download the file. */
export async function documentUrl(bucket: string, path: string, downloadAs?: string): Promise<string> {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 300, downloadAs ? { download: downloadAs } : undefined);
  if (error || !data) throw friendly(error, "Unable to open the file.");
  return data.signedUrl;
}

/** Links that open for an hour, for pictures shown inline. Files that cannot be signed are left out. */
export async function documentUrls(items: { bucket: string; path: string }[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const byBucket = new Map<string, string[]>();
  for (const i of items) byBucket.set(i.bucket, [...(byBucket.get(i.bucket) ?? []), i.path]);
  for (const [bucket, paths] of byBucket) {
    const { data } = await supabase.storage.from(bucket).createSignedUrls(paths, 3600);
    for (const row of data ?? []) if (row.signedUrl && row.path) out.set(`${bucket}/${row.path}`, row.signedUrl);
  }
  return out;
}

/** Opens a stored file in a new tab. */
export async function openDocument(bucket: string, path: string): Promise<void> {
  const url = await documentUrl(bucket, path);
  window.open(url, "_blank", "noopener");
}

/** Stores a picture (or other plain file) that is referenced by a path on its record, not registered as a document. Returns the path. */
export async function uploadObject(bucket: DocumentBucket, area: string, recordId: string, file: File): Promise<string> {
  const orgId = getActiveOrgId();
  if (!orgId) throw new Error("Select an organization first.");
  if (file.size > MAX_FILE_BYTES) throw new Error(`${file.name} is too large (the limit is 25 MB).`);
  const path = `${orgId}/${area}/${recordId}/${crypto.randomUUID()}-${safeName(file.name)}`;
  const up = await supabase.storage.from(bucket).upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false });
  if (up.error) throw friendly(up.error, "Unable to upload the file.");
  return path;
}

/** Deletes stored objects (best effort: a leftover file is harmless, a failure never blocks the screen). */
export async function removeObjects(bucket: DocumentBucket, paths: string[]): Promise<void> {
  if (paths.length) await supabase.storage.from(bucket).remove(paths);
}

/** Changes the details of a stored document (category, expiry date, notes). */
export async function updateDocumentDetails(id: string, patch: { category?: string; expiryDate?: string | null; description?: string | null }): Promise<void> {
  const fields: Record<string, unknown> = {};
  if (patch.category !== undefined) { fields.category = patch.category; fields.document_type = patch.category; }
  if (patch.expiryDate !== undefined) fields.expiry_date = patch.expiryDate || null;
  if (patch.description !== undefined) fields.description = patch.description || null;
  if (!Object.keys(fields).length) return;
  const { error } = await supabase.from("documents").update(fields).eq("id", id);
  if (error) throw friendly(error, "Unable to save the document details.");
}

/** Removes the document from the lists (kept for the retention period; the file itself is not deleted). */
export async function deleteDocument(id: string): Promise<void> {
  const { error } = await supabase.from("documents").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) throw friendly(error, "Unable to remove the document.");
}
