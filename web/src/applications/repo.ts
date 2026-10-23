// Supabase access for the Applications module: properties and units (reference), people (tenants with status prospect/applicant), staff, and
// applications with their applicants, screening reviews, communications, documents, activity and the lease created from them.
// The store keeps everything in one reducer state that is replaced after every action, so persistence is a diff:
// `persist(prev, next, me)` writes the rows that changed, in dependency order
// (people -> applications -> applicants -> reviews -> communications -> leases -> documents -> activity).
// Files live in the private `tenant-identification` bucket (applicant paperwork is sensitive) and open through short-lived links.
import { supabase, toError } from "../lib/supabase";
import { getActiveOrgId } from "../lib/activeOrg";
import { fetchAll } from "../lib/financeData";
import { loadStaff } from "../properties/add/store/refRepo";
import { updateDocumentDetails, uploadDocument } from "../lib/documents";
import {
  PERMISSIONS,
  type Application, type ApplicationActivity, type ApplicationCommunication, type ApplicationDocument, type ApplicationParty, type ApplicationReview, type ApplicationSource,
  type ApplicationStatus, type DocumentCategory, type DocumentStatus, type Lease, type Person, type Property, type ScreeningStatus, type Staff, type Tenant, type Unit, type UnitStatus,
} from "./data/types";

/* eslint-disable @typescript-eslint/no-explicit-any -- rows come from untyped PostgREST responses */

export interface Loaded {
  me: Staff | null;
  staff: Staff[];
  properties: Property[];
  units: Unit[];
  people: Person[];
  tenants: Tenant[];
  leases: Lease[];
  applications: Application[];
  parties: ApplicationParty[];
  documents: ApplicationDocument[];
  reviews: ApplicationReview[];
  activities: ApplicationActivity[];
  communications: ApplicationCommunication[];
}
export interface Slices {
  people: Person[];
  leases: Lease[];
  applications: Application[];
  parties: ApplicationParty[];
  documents: ApplicationDocument[];
  reviews: ApplicationReview[];
  activities: ApplicationActivity[];
  communications: ApplicationCommunication[];
}
export const emptySlices = (): Slices => ({ people: [], leases: [], applications: [], parties: [], documents: [], reviews: [], activities: [], communications: [] });

// ------------------------------------------------------------------ labels <-> database slugs
const slug = (v: string) => v.toLowerCase().replace(/&/g, " ").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
const label = <T extends string>(value: string | null | undefined, list: readonly T[]): T => list.find((l) => slug(l) === value) ?? list[0];
const STATUSES = ["Draft", "New", "Under Review", "Awaiting Information", "Approved", "Declined", "Waitlisted", "Withdrawn", "Archived"] as const;
const SOURCES = ["Website", "Referral", "Walk-in", "Listing Portal", "Manually Entered", "Transfer"] as const;
const RESERVATION = ["None", "Soft Hold", "Reserved"] as const;
const ROLES = ["Primary Applicant", "Co-Applicant", "Proposed Occupant"] as const;
const CONTACT = ["Email", "Phone", "Text Message", "Mail"] as const;
const SCREENING = ["Not Started", "In Progress", "Waiting for Information", "Completed", "Not Applicable"] as const;
const SIGNATURE = ["Not Sent", "Sent", "Signed", "Not Applicable"] as const;
const REVIEW_TYPES = ["Completeness Check", "Reference Check", "Employment & Income", "Credit Check", "Rental History", "Identity Verification", "Final Review"] as const;
const METHODS = ["Phone Call", "Email", "Text Message", "In Person", "Letter", "Portal Message"] as const;
const FOLLOW_UP = ["Open", "Completed", "Overdue"] as const;
const DOC_STATUS = ["Received", "Under Review", "Accepted", "Needs Replacement"] as const;
const BUCKET = "tenant-identification";

const num = (v: unknown) => Number(v ?? 0);
const opt = <T,>(v: T | null | undefined) => (v === null || v === undefined || v === "" ? undefined : v);
const dateOnly = (v: string | null | undefined) => (v ? String(v).slice(0, 10) : "");
const uuid = (v: unknown) => (typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v) ? v : null);
const extension = (name: string) => (name.includes(".") ? name.split(".").pop()!.toUpperCase() : "FILE");
const splitName = (full: string) => {
  const parts = full.trim().split(/\s+/);
  return { first: parts[0] || "Applicant", last: parts.slice(1).join(" ") };
};

function friendly(error: { code?: string; message?: string }, fallback: string): Error {
  if (error.code === "42501") return new Error("You don't have permission to change applications.");
  if (error.code === "23505") return new Error("A record with the same number already exists, or this unit is already reserved by another application.");
  if (["23514", "23503"].includes(error.code ?? "")) return new Error(error.message || fallback);
  return toError(error, fallback);
}
const check = (res: { error: any }, fallback: string) => { if (res.error) throw friendly(res.error, fallback); };

// ------------------------------------------------------------------ load
export async function loadAll(orgId: string): Promise<Loaded> {
  const { data: auth } = await supabase.auth.getUser();
  const [properties, units, tenants, applications, parties, reviews, communications, documents, versions, links, leases, leaseUnits, leaseParties, staffList, events, profiles] = await Promise.all([
    fetchAll("properties", "id, name, address_line1, city, state_province, postal_code, property_type, year_built, property_manager_id", orgId, "name"),
    fetchAll("units", "id, property_id, unit_number, unit_type, unit_status, bedrooms, bathrooms, square_feet, advertised_rent, available_on, parking_spaces, parking_fee, pet_policy, notes", orgId, "unit_number"),
    fetchAll("tenants", "id, tenant_number, first_name, last_name, preferred_name, email, phone, mailing_address, status, created_at", orgId, "last_name"),
    fetchAll("applications", "*", orgId, "created_at"),
    fetchAll("application_parties", "*", orgId, "created_at"),
    fetchAll("application_reviews", "*", orgId, "created_at"),
    fetchAll("application_communications", "*", orgId, "created_at"),
    fetchAll("documents", "*", orgId, "created_at"),
    fetchAll("document_versions", "*", orgId, "version_number"),
    fetchAll("document_links", "document_id, entity_type, entity_id", orgId, "created_at"),
    fetchAll("leases", "id, lease_number, status, start_date, end_date, agreed_monthly_rent, deposit_amount, notes, created_at", orgId, "created_at"),
    fetchAll("lease_units", "lease_id, unit_id", orgId, "lease_id"),
    fetchAll("lease_parties", "lease_id, tenant_id, role", orgId, "lease_id"),
    loadStaff(orgId).catch(() => []),
    supabase.from("activity_events").select("id, entity_id, occurred_at, actor_display_name, related_record_label, description, metadata").eq("organization_id", orgId).eq("entity_type", "application").order("occurred_at", { ascending: false }).limit(5000),
    supabase.from("profiles").select("id, full_name, email"),
  ]);
  const names = new Map<string, string>((profiles.data ?? []).map((p: any) => [p.id, p.full_name || p.email]));
  const everything = Object.values(PERMISSIONS) as string[];
  const staff: Staff[] = staffList.map((s) => ({ id: s.id, name: s.name, role: String(s.role), email: "", permissions: everything }));
  const me = staff.find((s) => s.id === auth.user?.id) ?? (auth.user ? { id: auth.user.id, name: names.get(auth.user.id) ?? auth.user.email ?? "You", role: "Team member", email: auth.user.email ?? "", permissions: everything } : null);
  if (me && !staff.some((s) => s.id === me.id)) staff.push(me);

  const appIds = new Set(applications.map((a: any) => a.id));
  const live = documents.filter((d: any) => !d.deleted_at);
  const appOfDoc = new Map<string, string>();
  const partyOfDoc = new Map<string, string>();
  for (const l of links) {
    if (l.entity_type === "application" && appIds.has(l.entity_id)) appOfDoc.set(l.document_id, l.entity_id);
    if (l.entity_type === "application_party") partyOfDoc.set(l.document_id, l.entity_id);
  }
  const propertyName = new Map(properties.map((p: any) => [p.id, p.name]));
  void propertyName;

  const docs: ApplicationDocument[] = [];
  for (const d of live) {
    const appId = appOfDoc.get(d.id);
    if (!appId) continue;
    const mine = versions.filter((v: any) => v.document_id === d.id).sort((a: any, b: any) => a.version_number - b.version_number);
    if (!mine.length) continue;
    const last = mine[mine.length - 1];
    docs.push({
      id: d.id, applicationId: appId, applicationPartyId: partyOfDoc.get(d.id), title: d.name, category: d.category as DocumentCategory, fileName: last.file_name, fileType: extension(last.file_name), fileSize: num(last.size_bytes),
      uploadedAt: dateOnly(last.created_at), uploadedBy: names.get(last.uploaded_by) ?? "Team member", versionNumber: last.version_number, previousVersionId: mine.length > 1 ? mine[mine.length - 2].id : undefined,
      status: d.status === "archived" ? "Archived" : label(d.review_status, DOC_STATUS) as DocumentStatus, storageReference: `${last.storage_bucket}/${last.storage_path}`, notes: opt(d.description),
      versions: mine.map((v: any) => ({ id: v.id, versionNumber: v.version_number, fileName: v.file_name, fileSize: num(v.size_bytes), fileType: extension(v.file_name), uploadedAt: dateOnly(v.created_at), uploadedBy: names.get(v.uploaded_by) ?? "Team member", notes: opt(v.notes) })),
      deletedAt: null, retentionUntil: opt(dateOnly(d.retention_until)),
    });
  }

  const numberOf = new Map<string, string>(applications.map((a: any) => [a.id, a.application_number ?? a.id]));
  const leaseUnitOf = new Map<string, string>(leaseUnits.map((l: any) => [l.lease_id, l.unit_id]));
  const createdLeases = leases.filter((l: any) => applications.some((a: any) => a.created_lease_id === l.id));
  return {
    me, staff,
    properties: properties.map((p: any): Property => ({
      id: p.id, name: p.name, addressLine1: p.address_line1, city: p.city ?? "", state: p.state_province ?? "", postalCode: p.postal_code ?? "", propertyType: String(p.property_type).replace(/_/g, " "), yearBuilt: p.year_built ?? 0, managerId: p.property_manager_id ?? "",
    })),
    units: units.map((u: any): Unit => ({
      id: u.id, propertyId: u.property_id, unitNumber: u.unit_number, unitType: u.unit_type ?? "", bedrooms: num(u.bedrooms), bathrooms: num(u.bathrooms), squareFeet: num(u.square_feet), advertisedRent: num(u.advertised_rent),
      status: ({ occupied: "Occupied", vacant: "Vacant", notice: "Notice", renovation: "Renovation", reserved: "Reserved" } as Record<string, UnitStatus>)[u.unit_status] ?? "Vacant",
      availableFrom: dateOnly(u.available_on), parkingSpaces: num(u.parking_spaces), parkingFee: num(u.parking_fee), petPolicy: u.pet_policy ?? "", notes: opt(u.notes),
    })),
    people: tenants.map((t: any): Person => ({
      id: t.id, fullName: `${t.first_name} ${t.last_name ?? ""}`.trim(), preferredName: opt(t.preferred_name), email: t.email ?? "", phone: t.phone ?? "", currentAddress: t.mailing_address ?? "", tenantId: t.id,
    })),
    tenants: tenants.map((t: any): Tenant => ({
      id: t.id, code: t.tenant_number ?? t.id, personId: t.id, status: ["active", "pending"].includes(t.status) ? "Current" : t.status === "former" || t.status === "inactive" ? "Former" : "Prospect", balanceCents: 0, since: dateOnly(t.created_at),
    })),
    leases: createdLeases.map((l: any): Lease => {
      const app = applications.find((a: any) => a.created_lease_id === l.id);
      return {
        id: l.id, leaseNumber: l.lease_number ?? l.id, propertyId: app?.property_id ?? "", unitId: leaseUnitOf.get(l.id) ?? app?.unit_id ?? "", applicationId: app?.id,
        tenantPersonIds: leaseParties.filter((p: any) => p.lease_id === l.id && p.role !== "occupant").map((p: any) => p.tenant_id), occupantNames: [], startDate: l.start_date, endDate: l.end_date ?? l.start_date,
        monthlyRent: num(l.agreed_monthly_rent), securityDeposit: num(l.deposit_amount), termMonths: 12,
        status: ({ draft: "Draft", pending_signature: "Pending Signature", active: "Active", expired: "Expired", terminated: "Terminated" } as Record<string, Lease["status"]>)[l.status] ?? "Draft",
        createdAt: dateOnly(l.created_at), notes: opt(l.notes),
      };
    }),
    applications: applications.map((a: any): Application => ({
      id: a.id, applicationNumber: numberOf.get(a.id)!, status: label(a.status, STATUSES) as ApplicationStatus, propertyId: a.property_id, unitId: a.unit_id, requestedMoveInDate: dateOnly(a.requested_move_in_date),
      requestedLeaseTerm: a.requested_lease_term_months ?? 12, advertisedRent: num(a.advertised_rent), proposedRent: a.proposed_rent === null ? null : num(a.proposed_rent), applicationSource: label(a.source, SOURCES) as ApplicationSource,
      assignedReviewerId: a.assigned_reviewer_id ?? null, submittedAt: dateOnly(a.submitted_at) || dateOnly(a.created_at), updatedAt: dateOnly(a.updated_at), internalNotes: a.internal_notes ?? "", createdLeaseId: opt(a.created_lease_id),
      unitReservation: label(a.unit_reservation, RESERVATION) as Application["unitReservation"], proposedOccupants: a.proposed_occupants ?? 0, parkingRequired: a.parking_required ?? "", petInfo: a.pet_info ?? "",
      rentalPreferences: a.rental_preferences ?? "", completeness: a.completeness ?? 0,
    })),
    parties: parties.map((p: any): ApplicationParty => ({
      id: p.id, applicationId: p.application_id, personId: opt(p.tenant_id), role: label(p.role, ROLES) as ApplicationParty["role"], isPrimary: p.is_primary, fullName: p.full_name, preferredName: opt(p.preferred_name), email: p.email ?? "",
      phone: p.phone ?? "", currentAddress: opt(p.current_address), preferredContact: label(p.preferred_contact, CONTACT) as ApplicationParty["preferredContact"], relationship: p.relationship ?? "", incomeMonthly: p.income_monthly === null ? undefined : num(p.income_monthly),
      employment: opt(p.employment), screeningStatus: label(p.screening_status, SCREENING) as ScreeningStatus, requiredDocuments: p.required_documents ?? [], signatureRequired: p.signature_required,
      signatureStatus: label(p.signature_status, SIGNATURE) as ApplicationParty["signatureStatus"], notes: opt(p.notes),
    })),
    documents: docs,
    reviews: reviews.map((r: any): ApplicationReview => ({
      id: r.id, applicationId: r.application_id, reviewerId: r.reviewer_id ?? "", reviewType: label(r.review_type, REVIEW_TYPES) as ApplicationReview["reviewType"], status: label(r.status, SCREENING) as ScreeningStatus,
      startedAt: opt(dateOnly(r.started_at)), reviewedAt: opt(dateOnly(r.reviewed_at)), notes: opt(r.notes), followUpRequired: r.follow_up_required, followUpDate: opt(dateOnly(r.follow_up_date)),
    })),
    communications: communications.map((c: any): ApplicationCommunication => ({
      id: c.id, applicationId: c.application_id, applicationPartyId: opt(c.application_party_id), contactMethod: label(c.contact_method, METHODS) as ApplicationCommunication["contactMethod"], subject: c.subject, summary: c.summary ?? "",
      createdAt: c.created_at, createdBy: names.get(c.created_by) ?? "Team member", followUpRequired: c.follow_up_required, followUpDate: opt(dateOnly(c.follow_up_date)), followUpStatus: c.follow_up_status ? (label(c.follow_up_status, FOLLOW_UP) as ApplicationCommunication["followUpStatus"]) : undefined,
    })),
    activities: (events.data ?? []).filter((e: any) => appIds.has(e.entity_id)).map((e: any): ApplicationActivity => ({
      id: e.id, applicationId: e.entity_id, activityType: (e.metadata?.type ?? "application_updated") as ApplicationActivity["activityType"], description: e.description, details: e.metadata?.details ?? undefined, createdAt: e.occurred_at, createdBy: e.actor_display_name,
    })),
  };
}

// ------------------------------------------------------------------ persist (diff)
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
function diff<T extends { id: string }>(prev: T[], next: T[]) {
  const before = new Map(prev.map((r) => [r.id, r]));
  const after = new Map(next.map((r) => [r.id, r]));
  return {
    added: next.filter((r) => !before.has(r.id)),
    changed: next.filter((r) => before.has(r.id) && !same(before.get(r.id), r)),
    removed: prev.filter((r) => !after.has(r.id)),
  };
}
const date = (v: string | undefined | null) => (v ? v : null);
/** documents without the in-browser File objects, so a File never counts as a change */
const bare = (d: ApplicationDocument): ApplicationDocument => ({ ...d, file: undefined, versions: d.versions.map((v) => ({ ...v, file: undefined })) });

export async function persist(prev: Slices, next: Slices, me: { id: string } | null): Promise<void> {
  const orgId = getActiveOrgId();
  if (!orgId) throw new Error("Select an organization first.");
  const userId = uuid(me?.id);

  // people created while taking an application (they become tenants with status "applicant")
  const personRow = (p: Person) => {
    const { first, last } = splitName(p.fullName);
    return { first_name: first, last_name: last, preferred_name: p.preferredName ?? null, email: p.email && p.email !== "—" ? p.email : null, phone: p.phone && p.phone !== "—" ? p.phone : null, mailing_address: p.currentAddress || null };
  };
  const people = diff(prev.people, next.people);
  if (people.added.length) check(await supabase.from("tenants").insert(people.added.map((p) => ({ id: p.id, organization_id: orgId, created_by: userId, status: "applicant", ...personRow(p) }))), "Unable to save the applicant.");

  // applications
  const appRow = (a: Application) => ({
    status: slug(a.status), property_id: a.propertyId, unit_id: a.unitId, requested_move_in_date: date(a.requestedMoveInDate), requested_lease_term_months: a.requestedLeaseTerm || null, advertised_rent: a.advertisedRent,
    proposed_rent: a.proposedRent, source: slug(a.applicationSource), assigned_reviewer_id: uuid(a.assignedReviewerId), submitted_at: date(a.submittedAt), internal_notes: a.internalNotes || null,
    unit_reservation: slug(a.unitReservation), proposed_occupants: a.proposedOccupants, parking_required: a.parkingRequired || null, pet_info: a.petInfo || null, rental_preferences: a.rentalPreferences || null,
    completeness: Math.max(0, Math.min(100, Math.round(a.completeness))),
  });
  const apps = diff(prev.applications, next.applications);
  if (apps.added.length) check(await supabase.from("applications").insert(apps.added.map((a) => ({ id: a.id, organization_id: orgId, application_number: a.applicationNumber, ...appRow(a) }))), "Unable to save the application.");
  for (const a of apps.changed) {
    const res = await supabase.from("applications").update(appRow(a)).eq("id", a.id).select("id");
    check(res, "Unable to save the application.");
    if (!res.data?.length) throw new Error("You don't have permission to change applications.");
  }

  // applicants
  const partyRow = (p: ApplicationParty) => ({
    application_id: p.applicationId, tenant_id: uuid(p.personId), role: slug(p.role), is_primary: p.isPrimary, full_name: p.fullName, preferred_name: p.preferredName ?? null, email: p.email && p.email !== "—" ? p.email : null,
    phone: p.phone && p.phone !== "—" ? p.phone : null, current_address: p.currentAddress ?? null, preferred_contact: slug(p.preferredContact), relationship: p.relationship || null, income_monthly: p.incomeMonthly ?? null,
    employment: p.employment ?? null, screening_status: slug(p.screeningStatus), required_documents: p.requiredDocuments, signature_required: p.signatureRequired, signature_status: slug(p.signatureStatus), notes: p.notes ?? null,
  });
  const parties = diff(prev.parties, next.parties);
  for (const p of parties.removed) check(await supabase.from("application_parties").delete().eq("id", p.id), "Unable to remove the applicant.");
  // a new primary applicant must not clash with the one it replaces, so demotions are written first
  for (const p of parties.changed.filter((x) => !x.isPrimary)) check(await supabase.from("application_parties").update(partyRow(p)).eq("id", p.id), "Unable to save the applicant.");
  if (parties.added.length) check(await supabase.from("application_parties").insert(parties.added.map((p) => ({ id: p.id, organization_id: orgId, ...partyRow(p) }))), "Unable to save the applicant.");
  for (const p of parties.changed.filter((x) => x.isPrimary)) check(await supabase.from("application_parties").update(partyRow(p)).eq("id", p.id), "Unable to save the applicant.");

  // screening reviews
  const reviewRow = (r: ApplicationReview) => ({
    application_id: r.applicationId, reviewer_id: uuid(r.reviewerId), review_type: slug(r.reviewType), status: slug(r.status), started_at: date(r.startedAt), reviewed_at: date(r.reviewedAt), notes: r.notes ?? null,
    follow_up_required: r.followUpRequired, follow_up_date: date(r.followUpDate),
  });
  const reviews = diff(prev.reviews, next.reviews);
  if (reviews.added.length) check(await supabase.from("application_reviews").insert(reviews.added.map((r) => ({ id: r.id, organization_id: orgId, ...reviewRow(r) }))), "Unable to save the review.");
  for (const r of reviews.changed) check(await supabase.from("application_reviews").update(reviewRow(r)).eq("id", r.id), "Unable to save the review.");

  // communications
  const commRow = (c: ApplicationCommunication) => ({
    application_id: c.applicationId, application_party_id: uuid(c.applicationPartyId), contact_method: slug(c.contactMethod), subject: c.subject, summary: c.summary || null, follow_up_required: c.followUpRequired,
    follow_up_date: date(c.followUpDate), follow_up_status: c.followUpStatus ? slug(c.followUpStatus) : null,
  });
  const comms = diff(prev.communications, next.communications);
  if (comms.added.length) check(await supabase.from("application_communications").insert(comms.added.map((c) => ({ id: c.id, organization_id: orgId, created_by: userId, ...commRow(c) }))), "Unable to save the communication.");
  for (const c of comms.changed) check(await supabase.from("application_communications").update(commRow(c)).eq("id", c.id), "Unable to save the communication.");

  // leases created from an application: the lease, its unit and its tenants (the application keeps the link)
  for (const l of diff(prev.leases, next.leases).added) {
    check(await supabase.from("leases").insert({
      id: l.id, organization_id: orgId, lease_number: l.leaseNumber, status: "pending_signature", start_date: l.startDate, end_date: date(l.endDate), agreed_monthly_rent: l.monthlyRent, deposit_amount: l.securityDeposit,
      tenancy_status: "fixed_term", occupancy_status: "not_yet_occupied", notes: [l.notes, l.occupantNames.length ? `Occupants: ${l.occupantNames.join(", ")}` : ""].filter(Boolean).join(" · ") || null, created_by: userId,
    }), "Unable to create the lease.");
    check(await supabase.from("lease_units").insert({ organization_id: orgId, lease_id: l.id, unit_id: l.unitId, allocated_monthly_rent: l.monthlyRent, start_date: l.startDate, end_date: date(l.endDate) }), "Unable to link the lease to its unit.");
    const people = [...new Set(l.tenantPersonIds)];
    if (people.length) {
      check(await supabase.from("lease_parties").insert(people.map((tenant_id, i) => ({
        organization_id: orgId, lease_id: l.id, tenant_id, role: i === 0 ? "main_tenant" : "co_tenant", is_primary_contact: i === 0, is_signatory: true, signature_status: "pending", relationship_start_date: l.startDate,
      }))), "Unable to add the tenants to the lease.");
    }
    check(await supabase.from("applications").update({ created_lease_id: l.id }).eq("id", l.applicationId!), "Unable to link the application to its lease.");
  }

  // documents: files upload now that the application exists; later edits change the document's details
  const docs = diff(prev.documents.map(bare), next.documents.map(bare));
  const nextDoc = new Map(next.documents.map((d) => [d.id, d]));
  const prevDoc = new Map(prev.documents.map((d) => [d.id, d]));
  const numberOf = new Map(next.applications.map((a) => [a.id, a.applicationNumber]));
  const reviewStatus = (s: DocumentStatus) => (s === "Archived" ? null : slug(s));
  for (const d of docs.added) {
    const full = nextDoc.get(d.id)!;
    const first = full.versions[0];
    if (!first?.file) continue; // an entry without a file cannot be stored
    await uploadDocument({
      id: d.id, versionId: first.id, versionNumber: 1, bucket: BUCKET, area: "applications", file: first.file, entityType: "application", entityId: d.applicationId, entityLabel: numberOf.get(d.applicationId), category: d.category,
      documentType: d.category, originModule: "Applications", title: d.title, description: d.notes || undefined, visibility: "restricted", isSensitive: true,
      alsoLinkTo: d.applicationPartyId ? { entityType: "application_party", entityId: d.applicationPartyId } : undefined,
    });
    check(await supabase.from("documents").update({ review_status: reviewStatus(d.status) ?? "received" }).eq("id", d.id), "Unable to save the document.");
  }
  for (const d of docs.changed) {
    const before = prevDoc.get(d.id)!;
    const full = nextDoc.get(d.id)!;
    for (const v of full.versions.filter((x) => !before.versions.some((b) => b.id === x.id))) {
      if (!v.file) continue;
      await uploadDocument({
        id: d.id, versionId: v.id, versionNumber: v.versionNumber, newVersionOf: true, bucket: BUCKET, area: "applications", file: v.file, entityType: "application", entityId: d.applicationId, category: d.category,
        documentType: d.category, originModule: "Applications", title: d.title, description: d.notes || undefined, status: "active", versionNotes: v.notes,
      });
    }
    if (d.title !== before.title || d.category !== before.category || (d.notes ?? "") !== (before.notes ?? "") || d.status !== before.status || d.deletedAt !== before.deletedAt) {
      const res = await supabase.from("documents").update({
        name: d.title, category: d.category, document_type: d.category, description: d.notes || null, status: d.status === "Archived" ? "archived" : "active", review_status: reviewStatus(d.status),
        archived_at: d.status === "Archived" ? new Date().toISOString() : null, deleted_at: d.deletedAt ? new Date().toISOString() : null,
      }).eq("id", d.id).select("id");
      check(res, "Unable to save the document.");
      void updateDocumentDetails;
    }
  }

  // activity history -> audit trail
  for (const a of diff(prev.activities, next.activities).added.reverse()) {
    await supabase.rpc("record_activity", {
      p_org: orgId, p_action: `application.${a.activityType}`, p_category: "Applications", p_description: a.description, p_entity_type: "application", p_entity_id: a.applicationId, p_label: a.activityType,
      p_metadata: { type: a.activityType, details: a.details ?? null }, p_source_module: "Applications",
    });
  }
}
