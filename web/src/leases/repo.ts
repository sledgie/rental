// Supabase access for the Leases page. Like the Tenants page, it works on one in-memory `LeaseData` object that is replaced after every
// action, so persistence is a diff: `persist(prev, next)` writes only the rows that changed, in dependency order
// (people -> leases -> additional charges -> lease units -> parties -> renewals -> activity).
// Tables: leases, lease_additional_charges, lease_units, lease_parties, lease_renewals, tenants, units, properties, activity_events.
// Lease documents live in Supabase Storage (bucket lease-documents) and are registered in documents / document_versions / document_links.
// A lease document group is one `documents` row and each version of it is a `document_versions` row; on screen every version is its own entry.
import { supabase, toError } from "../lib/supabase";
import { getActiveOrgId } from "../lib/activeOrg";
import { loadStaff } from "../properties/add/store/refRepo";
import { fetchAll } from "../lib/financeData";
import { uploadDocument } from "../lib/documents";
import type {
  AdditionalCharge, Lease, LeaseActivity, LeaseData, LeaseParty, LeaseRenewal, LeaseStatus, LeaseUnit, PartyRole, Property, SignatureStatus,
  TenancyStatus, TenantRecord, Unit, DocumentStatus, LeaseDocument,
} from "./leaseData";

/* eslint-disable @typescript-eslint/no-explicit-any -- rows come from untyped PostgREST responses */

export const emptyLeaseData = (): LeaseData => ({
  properties: [], units: [], leases: [], leaseUnits: [], people: [], parties: [], documents: [], renewals: [], transactions: [], activities: [],
});

// ------------------------------------------------------------------ label <-> slug maps
const invert = <T extends string>(map: Record<string, T>): Record<string, string> => Object.fromEntries(Object.entries(map).map(([k, v]) => [v, k]));

const LEASE_STATUS_FROM_DB: Record<string, LeaseStatus> = {
  draft: "Draft", pending_review: "Pending Review", pending_signature: "Pending Signature", active: "Active", expired: "Expired", terminated: "Terminated", archived: "Archived",
};
const LEASE_STATUS_TO_DB: Record<string, string> = { ...invert(LEASE_STATUS_FROM_DB), Expiring: "active" }; // "Expiring" is derived, never stored
const TENANCY_FROM_DB: Record<string, TenancyStatus> = { fixed_term: "Fixed-term", periodic: "Periodic", at_will: "At will", other: "Other" };
const TENANCY_TO_DB = invert(TENANCY_FROM_DB);
const OCCUPANCY_FROM_DB: Record<string, Lease["occupancyStatus"]> = { occupied: "Occupied", vacant: "Vacant", not_yet_occupied: "Not yet occupied", unknown: "Unknown" };
const OCCUPANCY_TO_DB = invert(OCCUPANCY_FROM_DB);
const FREQUENCY_FROM_DB: Record<string, string> = { weekly: "Weekly", biweekly: "Bi-weekly", monthly: "Monthly", quarterly: "Quarterly", annually: "Annually", other: "Other" };
const FREQUENCY_TO_DB: Record<string, string> = { ...invert(FREQUENCY_FROM_DB as Record<string, any>) };
const ROLE_FROM_DB: Record<string, PartyRole> = { main_tenant: "Main Tenant", co_tenant: "Co-Tenant", occupant: "Occupant", guarantor: "Guarantor" };
const ROLE_TO_DB = invert(ROLE_FROM_DB);
const SIGNATURE_FROM_DB: Record<string, SignatureStatus> = { not_required: "Not required", pending: "Pending", signed: "Signed", declined: "Declined" };
const SIGNATURE_TO_DB = invert(SIGNATURE_FROM_DB);
const RENEWAL_STATUS_FROM_DB: Record<string, LeaseRenewal["status"]> = {
  draft: "Draft", pending_review: "Pending Review", pending_signature: "Pending Signature", approved: "Approved", signed: "Signed",
};
const RENEWAL_STATUS_TO_DB = invert(RENEWAL_STATUS_FROM_DB);
const PERSON_STATUS_TO_DB: Record<string, string> = { Active: "active", Former: "former", Prospect: "prospect", Archived: "former" };

const todayISO = () => new Date().toISOString().slice(0, 10);
const dateOnly = (v: string | null | undefined) => (v ? v.slice(0, 10) : undefined);
const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));
const num = (v: unknown) => Number(v ?? 0);
const WARNING_DAYS = 60;

/** "Expiring" is not a database status: an active lease ending within the warning window is shown as expiring. */
function displayStatus(status: string, endDate: string | null): LeaseStatus {
  const base = LEASE_STATUS_FROM_DB[status] ?? "Draft";
  if (base !== "Active" || !endDate) return base;
  const days = (new Date(`${endDate}T12:00:00`).getTime() - Date.now()) / 86400000;
  return days >= 0 && days <= WARNING_DAYS ? "Expiring" : base;
}

// ------------------------------------------------------------------ row <-> model
const splitName = (name: string) => {
  const parts = name.trim().split(/\s+/);
  return { first_name: parts[0] || name.trim(), last_name: parts.slice(1).join(" ") };
};

const personRow = (p: TenantRecord) => ({
  ...splitName(p.name),
  email: p.email.trim().toLowerCase() || null,
  phone: p.phone.trim() || null,
  mailing_address: p.mailingAddress.trim() || null,
  status: PERSON_STATUS_TO_DB[p.recordStatus] ?? "active",
  archived_at: p.recordStatus === "Archived" ? new Date().toISOString() : null,
});

const leaseRow = (l: Lease) => {
  const f = l.financialTerms;
  return {
    name: l.name || null,
    lease_type: l.leaseType || null,
    tenancy_status: TENANCY_TO_DB[l.tenancyStatus] ?? "fixed_term",
    status: LEASE_STATUS_TO_DB[l.status] ?? "draft",
    start_date: l.startDate || todayISO(),
    end_date: l.endDate || null,
    renewal_eligible: l.renewalEligible,
    renewal_deadline: l.renewalDeadline || null,
    notice_period_days: l.noticePeriodDays ?? null,
    occupancy_status: OCCUPANCY_TO_DB[l.occupancyStatus] ?? "unknown",
    notes: l.notes || null,
    agreed_monthly_rent: f.agreedMonthlyRent ?? 0,
    rent_due_day: f.rentDueDay || 1,
    payment_frequency: FREQUENCY_TO_DB[f.paymentFrequency] ?? "monthly",
    payment_method: f.paymentMethod || null,
    deposit_type: f.depositType || null,
    deposit_amount: f.depositAmount || 0,
    deposit_permitted: f.depositPermitted ?? null,
    parking_fees: f.parkingFees || 0,
    storage_fees: f.storageFees || 0,
    utilities: f.utilities || null,
    rent_increase_details: f.rentIncreaseDetails || null,
    financial_effective_date: f.effectiveDate || null,
    financial_notes: f.notes || null,
  };
};

const toLease = (row: any, charges: AdditionalCharge[], creator: string): Lease => ({
  id: row.id,
  leaseNumber: row.lease_number ?? "",
  name: row.name ?? row.lease_number ?? "Lease",
  leaseType: row.lease_type ?? "Residential",
  tenancyStatus: TENANCY_FROM_DB[row.tenancy_status] ?? "Fixed-term",
  status: displayStatus(row.status, row.end_date),
  startDate: row.start_date,
  endDate: row.end_date ?? undefined,
  renewalEligible: row.renewal_eligible,
  renewalDeadline: row.renewal_deadline ?? undefined,
  noticePeriodDays: row.notice_period_days ?? undefined,
  createdAt: dateOnly(row.created_at) ?? row.start_date,
  updatedAt: dateOnly(row.updated_at) ?? row.start_date,
  createdBy: creator,
  notes: str(row.notes),
  occupancyStatus: OCCUPANCY_FROM_DB[row.occupancy_status] ?? "Unknown",
  financialTerms: {
    agreedMonthlyRent: num(row.agreed_monthly_rent) > 0 ? num(row.agreed_monthly_rent) : undefined,
    rentDueDay: row.rent_due_day,
    depositType: str(row.deposit_type),
    depositAmount: num(row.deposit_amount),
    depositPermitted: row.deposit_permitted ?? undefined,
    additionalCharges: charges,
    parkingFees: num(row.parking_fees),
    storageFees: num(row.storage_fees),
    utilities: str(row.utilities),
    rentIncreaseDetails: str(row.rent_increase_details),
    effectiveDate: row.financial_effective_date ?? undefined,
    paymentFrequency: FREQUENCY_FROM_DB[row.payment_frequency] ?? "Monthly",
    paymentMethod: str(row.payment_method),
    notes: str(row.financial_notes),
  },
});

const DOC_STATUS_FROM_DB: Record<string, DocumentStatus> = {
  draft: "Draft", awaiting_signature: "Awaiting Signature", signed: "Signed", active: "Active", superseded: "Superseded", archived: "Archived", expired: "Expired",
};
const DOC_STATUS_TO_DB = invert(DOC_STATUS_FROM_DB) as Record<DocumentStatus, "draft" | "awaiting_signature" | "signed" | "active" | "superseded" | "archived" | "expired">;
const DOC_SIGNATURE_FROM_DB: Record<string, SignatureStatus> = { not_required: "Not required", pending: "Pending", signed: "Signed", declined: "Declined" };
const DOC_SIGNATURE_TO_DB = invert(DOC_SIGNATURE_FROM_DB) as Record<SignatureStatus, "not_required" | "pending" | "signed" | "declined">;
const BUCKET = "lease-documents";

/** What belongs to one version (not to the document as a whole) is kept as JSON in the version's notes. */
const versionNotes = (d: LeaseDocument) => JSON.stringify({ n: d.notes, st: d.status, sg: d.signatureStatus, sd: d.signedDate, sb: d.signedBy, ex: d.expiryDate, dd: d.documentDate });

async function loadDocuments(orgId: string, names: Map<string, string>): Promise<LeaseDocument[]> {
  const found = await supabase.from("document_links").select("document_id, entity_id").eq("organization_id", orgId).eq("entity_type", "lease").limit(5000);
  if (found.error) throw toError(found.error, "Unable to load documents.");
  const leaseLinks = found.data ?? [];
  if (!leaseLinks.length) return [];
  const leaseOf = new Map<string, string>(leaseLinks.map((l: any) => [l.document_id, l.entity_id]));
  const ids = [...leaseOf.keys()];
  const documents: any[] = [];
  const versions: any[] = [];
  for (let i = 0; i < ids.length; i += 150) {
    const chunk = ids.slice(i, i + 150);
    const [d, v] = await Promise.all([
      supabase.from("documents").select("*").in("id", chunk).is("deleted_at", null),
      supabase.from("document_versions").select("*").in("document_id", chunk).order("version_number"),
    ]);
    if (d.error) throw toError(d.error, "Unable to load documents.");
    if (v.error) throw toError(v.error, "Unable to load documents.");
    documents.push(...(d.data ?? []));
    versions.push(...(v.data ?? []));
  }
  const out: LeaseDocument[] = [];
  for (const d of documents) {
    const mine = versions.filter((v) => v.document_id === d.id);
    mine.forEach((v, index) => {
      let meta: any = {};
      try { meta = v.notes ? JSON.parse(v.notes) : {}; } catch { meta = { n: v.notes }; }
      const latest = index === mine.length - 1;
      out.push({
        id: v.id, leaseId: leaseOf.get(d.id)!, title: d.name, category: d.category as LeaseDocument["category"], originalFileName: v.file_name, fileType: v.mime_type ?? "", fileSize: Number(v.size_bytes ?? 0),
        uploadedAt: dateOnly(v.created_at) ?? todayISO(), uploadedBy: names.get(v.uploaded_by) ?? "Team member", documentDate: meta.dd ?? dateOnly(d.document_date) ?? undefined, versionNumber: v.version_number,
        previousVersionId: index > 0 ? mine[index - 1].id : undefined, versionGroupId: d.id, expiryDate: meta.ex ?? (latest ? dateOnly(d.expiry_date) : undefined) ?? undefined,
        signatureStatus: (meta.sg as SignatureStatus) ?? DOC_SIGNATURE_FROM_DB[d.signature_status] ?? "Not required", status: latest ? DOC_STATUS_FROM_DB[d.status] ?? "Draft" : "Superseded",
        storageReference: `${v.storage_bucket}/${v.storage_path}`, notes: meta.n ?? d.description ?? "", signedDate: meta.sd, signedBy: meta.sb,
      });
    });
  }
  return out;
}

// ------------------------------------------------------------------ load
export async function loadLeaseData(orgId: string): Promise<LeaseData> {
  const q = (table: string, columns = "*") => supabase.from(table).select(columns).eq("organization_id", orgId);
  const [properties, units, tenants, leases, charges, leaseUnits, parties, renewals, events, staff] = await Promise.all([
    q("properties", "id, name, address_line1, city, state_province, postal_code").is("archived_at", null),
    q("units", "id, property_id, unit_number, unit_type, unit_status, bedrooms, bathrooms, market_rent, advertised_rent, notes").is("archived_at", null),
    q("tenants", "id, first_name, last_name, email, phone, mailing_address, status, archived_at"),
    q("leases").order("created_at", { ascending: false }),
    q("lease_additional_charges").order("position"),
    q("lease_units").order("created_at"),
    q("lease_parties").order("created_at"),
    q("lease_renewals").order("created_at", { ascending: false }),
    q("activity_events", "id, entity_id, occurred_at, actor_display_name, related_record_label, description").eq("entity_type", "lease").order("occurred_at", { ascending: false }).limit(500),
    loadStaff(orgId).catch(() => []),
  ]);
  // the audit trail may be hidden by Row-Level Security: that is an empty feed, not a failure
  for (const [name, res] of [["properties", properties], ["units", units], ["people", tenants], ["leases", leases], ["lease charges", charges], ["lease units", leaseUnits], ["lease parties", parties], ["renewals", renewals]] as const) {
    if (res.error) throw toError(res.error, `Unable to load ${name}.`);
  }
  const names = new Map(staff.map((s) => [s.id, s.name]));
  const chargesByLease = new Map<string, AdditionalCharge[]>();
  for (const c of charges.data ?? []) chargesByLease.set(c.lease_id, [...(chargesByLease.get(c.lease_id) ?? []), { label: c.label, amount: num(c.amount) }]);

  return {
    properties: (properties.data ?? []).map((r: any): Property => ({
      id: r.id, name: r.name, address: r.address_line1, city: [r.city, [r.state_province, r.postal_code].filter(Boolean).join(" ")].filter(Boolean).join(", "),
    })),
    units: (units.data ?? []).map((r: any): Unit => {
      const beds = r.bedrooms === null ? null : num(r.bedrooms);
      const baths = r.bathrooms === null ? null : num(r.bathrooms);
      return {
        id: r.id,
        propertyId: r.property_id,
        number: r.unit_number,
        type: r.unit_type || (beds !== null ? `${beds === 0 ? "Studio" : `${beds} bed`}${baths !== null ? ` / ${baths} bath` : ""}` : "Unit"),
        status: ["occupied", "notice"].includes(r.unit_status) ? "Occupied" : ["turnover", "renovation", "under_maintenance"].includes(r.unit_status) ? "Turnover" : "Vacant",
        marketRent: num(r.market_rent ?? r.advertised_rent),
        notes: str(r.notes),
      };
    }),
    people: (tenants.data ?? []).map((r: any): TenantRecord => ({
      id: r.id,
      name: `${r.first_name} ${r.last_name ?? ""}`.trim(),
      email: str(r.email),
      phone: str(r.phone),
      mailingAddress: str(r.mailing_address),
      recordStatus: r.archived_at ? "Archived" : r.status === "former" ? "Former" : ["prospect", "applicant"].includes(r.status) ? "Prospect" : "Active",
      isTenantRecord: true,
    })),
    leases: (leases.data ?? []).map((r: any) => toLease(r, chargesByLease.get(r.id) ?? [], names.get(r.created_by) ?? "Team member")),
    leaseUnits: (leaseUnits.data ?? []).map((r: any): LeaseUnit => ({
      id: r.id, leaseId: r.lease_id, unitId: r.unit_id, allocatedMonthlyRent: num(r.allocated_monthly_rent), startDate: r.start_date, endDate: r.end_date ?? undefined, notes: str(r.notes),
    })),
    parties: (parties.data ?? []).map((r: any): LeaseParty => ({
      id: r.id, leaseId: r.lease_id, personId: r.tenant_id, role: ROLE_FROM_DB[r.role] ?? "Occupant", isPrimaryContact: r.is_primary_contact, isSignatory: r.is_signatory,
      signatureStatus: SIGNATURE_FROM_DB[r.signature_status] ?? "Not required", relationshipStartDate: r.relationship_start_date,
      relationshipEndDate: r.relationship_end_date ?? undefined, relationship: r.relationship ?? undefined, notes: str(r.notes),
    })),
    documents: await loadDocuments(orgId, names),
    renewals: (renewals.data ?? []).map((r: any): LeaseRenewal => ({
      id: r.id, originalLeaseId: r.original_lease_id, successorLeaseId: r.successor_lease_id ?? undefined, type: r.renewal_type === "amendment" ? "Amendment" : "Renewal",
      proposedStartDate: r.proposed_start_date ?? undefined, proposedEndDate: r.proposed_end_date ?? undefined, proposedRent: r.proposed_rent === null ? undefined : num(r.proposed_rent),
      effectiveDate: r.effective_date ?? undefined, reminderDate: r.reminder_date ?? undefined, status: RENEWAL_STATUS_FROM_DB[r.status] ?? "Draft",
      relatedDocumentIds: [], notes: str(r.notes), createdAt: dateOnly(r.created_at) ?? todayISO(),
    })),
    transactions: [],
    activities: (events.data ?? []).map((r: any): LeaseActivity => ({
      id: r.id, leaseId: r.entity_id, date: dateOnly(r.occurred_at) ?? todayISO(), user: r.actor_display_name, action: r.related_record_label || "Activity", details: r.description,
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

function friendly(error: { code?: string; message?: string }, fallback: string): Error {
  if (error.code === "23P01") return new Error("One or more units already have an active lease during these dates.");
  if (error.code === "23505") return new Error("That record already exists (for example a second primary contact, or a duplicate email).");
  if (error.code === "23514") return new Error("A value is outside what the database allows (check dates and amounts).");
  if (error.code === "42501") return new Error("You don't have permission to make this change.");
  return toError(error, fallback);
}

/** Server-assigned lease numbers (LSE-00001) that the page should show instead of its provisional ones. */
export type Reconciliation = { leaseNumbers: Map<string, string> };

export async function persist(prev: LeaseData, next: LeaseData): Promise<Reconciliation> {
  const orgId = getActiveOrgId();
  if (!orgId) throw new Error("Select an organization first.");
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id ?? null;
  const out: Reconciliation = { leaseNumbers: new Map() };
  const check = (res: { error: any }, fallback: string) => { if (res.error) throw friendly(res.error, fallback); };
  const leaseStart = new Map(next.leases.map((l) => [l.id, l.startDate || todayISO()]));

  // people created from the lease wizard
  const people = diff(prev.people, next.people);
  if (people.added.length) check(await supabase.from("tenants").insert(people.added.map((p) => ({ id: p.id, organization_id: orgId, created_by: userId, ...personRow(p) }))), "Unable to save the new person.");
  for (const p of people.changed) check(await supabase.from("tenants").update(personRow(p)).eq("id", p.id), "Unable to save the person.");

  // leases (+ additional charges)
  const leases = diff(prev.leases, next.leases);
  if (leases.added.length) {
    const res = await supabase.from("leases").insert(leases.added.map((l) => ({ id: l.id, organization_id: orgId, created_by: userId, ...leaseRow(l) }))).select("id, lease_number");
    check(res, "Unable to save the lease.");
    (res.data ?? []).forEach((r: any) => out.leaseNumbers.set(r.id, r.lease_number));
  }
  const prevLease = new Map(prev.leases.map((l) => [l.id, l]));
  for (const l of leases.changed) {
    const res = await supabase.from("leases").update(leaseRow(l)).eq("id", l.id).select("id");
    check(res, "Unable to save the lease.");
    if (!res.data?.length) throw new Error("You don't have permission to edit leases.");
  }
  for (const l of [...leases.added, ...leases.changed]) {
    const before = prevLease.get(l.id)?.financialTerms.additionalCharges ?? [];
    if (!same(before, l.financialTerms.additionalCharges)) {
      check(await supabase.from("lease_additional_charges").delete().eq("lease_id", l.id), "Unable to save the additional charges.");
      if (l.financialTerms.additionalCharges.length) {
        check(await supabase.from("lease_additional_charges").insert(l.financialTerms.additionalCharges.map((c, position) => ({ organization_id: orgId, lease_id: l.id, label: c.label, amount: c.amount, position }))), "Unable to save the additional charges.");
      }
    }
  }

  // lease units
  const unitRow = (u: LeaseUnit) => ({
    lease_id: u.leaseId, unit_id: u.unitId, allocated_monthly_rent: u.allocatedMonthlyRent,
    start_date: u.startDate || leaseStart.get(u.leaseId) || todayISO(), end_date: u.endDate || null, notes: u.notes || null,
  });
  const links = diff(prev.leaseUnits, next.leaseUnits);
  if (links.added.length) check(await supabase.from("lease_units").insert(links.added.map((u) => ({ id: u.id, organization_id: orgId, ...unitRow(u) }))), "Unable to link the unit to the lease.");
  for (const u of links.changed) check(await supabase.from("lease_units").update(unitRow(u)).eq("id", u.id), "Unable to update the lease unit.");

  // parties
  const partyRow = (p: LeaseParty) => ({
    lease_id: p.leaseId, tenant_id: p.personId, role: ROLE_TO_DB[p.role] ?? "occupant", is_primary_contact: p.isPrimaryContact, is_signatory: p.isSignatory,
    signature_status: SIGNATURE_TO_DB[p.signatureStatus] ?? "not_required", relationship_start_date: p.relationshipStartDate || todayISO(),
    relationship_end_date: p.relationshipEndDate || null, relationship: p.relationship || null, notes: p.notes || null,
  });
  const parties = diff(prev.parties, next.parties);
  // an ended or removed primary contact must be written first so a new one does not collide with it
  for (const p of parties.removed) check(await supabase.from("lease_parties").delete().eq("id", p.id), "Unable to remove the person from the lease.");
  for (const p of parties.changed) check(await supabase.from("lease_parties").update(partyRow(p)).eq("id", p.id), "Unable to update the person on the lease.");
  if (parties.added.length) check(await supabase.from("lease_parties").insert(parties.added.map((p) => ({ id: p.id, organization_id: orgId, ...partyRow(p) }))), "Unable to add the person to the lease.");
  for (const u of links.removed) check(await supabase.from("lease_units").delete().eq("id", u.id), "Unable to unlink the unit.");

  // renewals and amendments
  const renewalRow = (r: LeaseRenewal) => ({
    original_lease_id: r.originalLeaseId, successor_lease_id: r.successorLeaseId ?? null, renewal_type: r.type === "Amendment" ? "amendment" : "renewal",
    proposed_start_date: r.proposedStartDate || null, proposed_end_date: r.proposedEndDate || null, proposed_rent: r.proposedRent ?? null,
    effective_date: r.effectiveDate || null, reminder_date: r.reminderDate || null, status: RENEWAL_STATUS_TO_DB[r.status] ?? "draft", notes: r.notes || null,
  });
  const renewals = diff(prev.renewals, next.renewals);
  if (renewals.added.length) check(await supabase.from("lease_renewals").insert(renewals.added.map((r) => ({ id: r.id, organization_id: orgId, created_by: userId, ...renewalRow(r) }))), "Unable to save the renewal.");
  for (const r of renewals.changed) check(await supabase.from("lease_renewals").update(renewalRow(r)).eq("id", r.id), "Unable to update the renewal.");
  for (const r of renewals.removed) check(await supabase.from("lease_renewals").delete().eq("id", r.id), "Unable to remove the renewal.");

  // documents: files are uploaded now that the lease exists; later edits only change the document's details
  const stripped = (d: LeaseDocument) => ({ ...d, uploadProgress: undefined, file: undefined });
  const documents = diff(prev.documents.map(stripped), next.documents.map(stripped));
  const nextById = new Map(next.documents.map((d) => [d.id, d]));
  const leaseNo = new Map(next.leases.map((l) => [l.id, l.leaseNumber]));
  for (const d of documents.added) {
    const full = nextById.get(d.id)!;
    if (!full.file) continue; // an entry without a file cannot be stored
    const isNewVersion = !!d.previousVersionId;
    await uploadDocument({
      id: d.versionGroupId, versionId: d.id, versionNumber: d.versionNumber, newVersionOf: isNewVersion, bucket: BUCKET, area: "leases", file: full.file, entityType: "lease", entityId: d.leaseId,
      entityLabel: leaseNo.get(d.leaseId), category: d.category, documentType: d.category, originModule: "Leases", title: d.title, status: DOC_STATUS_TO_DB[d.status] ?? "draft",
      signatureStatus: DOC_SIGNATURE_TO_DB[d.signatureStatus] ?? "not_required", documentDate: d.documentDate, expiryDate: d.expiryDate, description: d.notes || undefined, versionNotes: versionNotes(d),
    });
  }
  for (const d of documents.changed) {
    const isLatest = !next.documents.some((x) => x.versionGroupId === d.versionGroupId && x.versionNumber > d.versionNumber);
    check(await supabase.from("document_versions").update({ notes: versionNotes(d) }).eq("id", d.id), "Unable to save the document.");
    if (isLatest) {
      check(await supabase.from("documents").update({
        name: d.title, category: d.category, document_type: d.category, status: DOC_STATUS_TO_DB[d.status] ?? "draft", signature_status: DOC_SIGNATURE_TO_DB[d.signatureStatus] ?? "not_required",
        document_date: d.documentDate || null, expiry_date: d.expiryDate || null, description: d.notes || null,
      }).eq("id", d.versionGroupId), "Unable to save the document.");
    }
  }
  for (const d of documents.removed) {
    if (next.documents.some((x) => x.versionGroupId === d.versionGroupId)) check(await supabase.from("document_versions").delete().eq("id", d.id), "Unable to remove the document version.");
    else check(await supabase.from("documents").update({ deleted_at: new Date().toISOString() }).eq("id", d.versionGroupId), "Unable to remove the document.");
  }

  // activity feed -> audit trail (written by the database, attributed to the signed-in user)
  for (const a of diff(prev.activities, next.activities).added.reverse()) {
    check(await supabase.rpc("record_activity", {
      p_org: orgId, p_action: "lease.activity", p_category: "Tenants & Leases", p_description: a.details,
      p_entity_type: "lease", p_entity_id: a.leaseId, p_label: a.action, p_source_module: "Leases",
    }), "Unable to record the activity.");
  }
  return out;
}
