// Supabase access for the Tenants page. The page works on one in-memory `Database` object and replaces it as a whole after every
// action, so persistence is a diff: `persist(prev, next)` compares the two and writes only the rows that changed, in dependency
// order (tenants -> leases -> lease units -> parties -> party units -> unit status -> activity).
// Tables: tenants, tenant_private_details, tenant_contacts, leases, lease_units, lease_parties, lease_party_units, units, properties.
// Accounts and transactions are derived from invoices and payments, which are not connected yet, so they stay empty here.
import { supabase, toError } from "../lib/supabase";
import { deleteDocument, documentUrls, listDocuments, uploadDocument } from "../lib/documents";
import { getActiveOrgId } from "../lib/activeOrg";
import { loadFinance, round2, type FinanceData } from "../lib/financeData";
import type {
  Account, Activity, Database, Lease, LeaseParty, LeaseUnit, PartyRole, PartyUnit, Property, Tenant, TenantStatus, Transaction, Unit,
} from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any -- rows come from untyped PostgREST responses */

export const emptyDatabase = (): Database => ({
  tenants: [], properties: [], units: [], leases: [], leaseUnits: [], leaseParties: [], partyUnits: [], accounts: [], transactions: [], activities: [],
});

// ------------------------------------------------------------------ label <-> slug maps
const TENANT_STATUS_TO_DB: Record<TenantStatus, string> = { Active: "active", Pending: "pending", Inactive: "inactive", Former: "former" };
const TENANT_STATUS_FROM_DB: Record<string, TenantStatus> = {
  active: "Active", pending: "Pending", inactive: "Inactive", former: "Former", prospect: "Pending", applicant: "Pending",
};
const LEASE_STATUS_TO_DB: Record<Lease["leaseStatus"], string> = {
  Draft: "draft", Pending: "pending_signature", Active: "active", Expired: "expired", Terminated: "terminated",
};
const LEASE_STATUS_FROM_DB: Record<string, Lease["leaseStatus"]> = {
  draft: "Draft", pending_review: "Pending", pending_signature: "Pending", active: "Active", expired: "Expired", terminated: "Terminated", archived: "Expired",
};
const ROLE_TO_DB: Record<PartyRole, string> = { "Main Tenant": "main_tenant", "Co-Tenant": "co_tenant", Occupant: "occupant" };
const ROLE_FROM_DB: Record<string, PartyRole> = { main_tenant: "Main Tenant", co_tenant: "Co-Tenant", occupant: "Occupant", guarantor: "Occupant" };
const UNIT_STATUS_TO_DB: Record<Unit["unitStatus"], string> = { Occupied: "occupied", Reserved: "reserved", Available: "vacant" };
const UNIT_STATUS_FROM_DB: Record<string, Unit["unitStatus"]> = { occupied: "Occupied", notice: "Occupied", reserved: "Reserved" };

const COLORS = ["violet", "blue", "rose", "teal", "amber"];
const colorFor = (id: string) => COLORS[[...id].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 997, 0) % COLORS.length];
const dateOnly = (v: string | null | undefined) => (v ? v.slice(0, 10) : undefined);

// ------------------------------------------------------------------ row <-> model
function toTenant(row: any, dob: Map<string, string>, emergency: Map<string, string>): Tenant {
  return {
    id: row.id,
    tenantNumber: row.tenant_number ?? "",
    firstName: row.first_name,
    middleName: row.middle_name ?? undefined,
    lastName: row.last_name ?? "",
    preferredName: row.preferred_name ?? undefined,
    dateOfBirth: dob.get(row.id),
    phone: row.phone ?? "",
    email: row.email ?? "",
    mailingAddress: row.mailing_address ?? undefined,
    emergencyContact: emergency.get(row.id),
    notes: row.notes ?? undefined,
    classification: row.classification === "main_tenant" ? "Main tenant" : "Individual",
    tenantStatus: TENANT_STATUS_FROM_DB[row.status] ?? "Active",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archivedAt: row.archived_at ?? undefined,
    avatarColor: colorFor(row.id),
  };
}

const tenantRow = (t: Tenant) => ({
  first_name: t.firstName.trim(),
  middle_name: t.middleName?.trim() || null,
  last_name: t.lastName.trim(),
  preferred_name: t.preferredName?.trim() || null,
  email: t.email.trim().toLowerCase() || null,
  phone: t.phone.trim() || null,
  mailing_address: t.mailingAddress?.trim() || null,
  classification: t.classification === "Main tenant" ? "main_tenant" : "individual",
  status: TENANT_STATUS_TO_DB[t.tenantStatus],
  notes: t.notes?.trim() || null,
  archived_at: t.archivedAt ?? null,
});

const toLease = (row: any): Lease => ({
  id: row.id,
  leaseNumber: row.lease_number ?? "",
  startDate: row.start_date,
  endDate: row.end_date ?? row.start_date,
  leaseStatus: LEASE_STATUS_FROM_DB[row.status] ?? "Draft",
  totalContractRent: Number(row.agreed_monthly_rent ?? 0),
  securityDeposit: Number(row.deposit_amount ?? 0),
  terms: row.terms ?? "",
  documentReferences: [], // documents arrive with file storage
  createdAt: dateOnly(row.created_at) ?? row.start_date,
  updatedAt: dateOnly(row.updated_at) ?? row.start_date,
});

const leaseRow = (l: Lease) => ({
  start_date: l.startDate,
  end_date: l.endDate,
  status: LEASE_STATUS_TO_DB[l.leaseStatus],
  agreed_monthly_rent: l.totalContractRent,
  deposit_amount: l.securityDeposit,
  terms: l.terms || null,
});

const toLeaseUnit = (row: any): LeaseUnit => ({
  id: row.id,
  leaseId: row.lease_id,
  unitId: row.unit_id,
  rentAllocation: Number(row.allocated_monthly_rent ?? 0),
  occupancyStartDate: row.start_date,
  occupancyEndDate: row.end_date ?? undefined,
});

const leaseUnitRow = (u: LeaseUnit) => ({
  lease_id: u.leaseId,
  unit_id: u.unitId,
  allocated_monthly_rent: u.rentAllocation,
  start_date: u.occupancyStartDate,
  end_date: u.occupancyEndDate ?? null,
});

const toParty = (row: any): LeaseParty => ({
  id: row.id,
  leaseId: row.lease_id,
  tenantId: row.tenant_id,
  role: ROLE_FROM_DB[row.role] ?? "Occupant",
  isSignatory: row.is_signatory,
  effectiveStartDate: row.relationship_start_date,
  effectiveEndDate: row.relationship_end_date ?? undefined,
});

const partyRow = (p: LeaseParty) => ({
  lease_id: p.leaseId,
  tenant_id: p.tenantId,
  role: ROLE_TO_DB[p.role],
  is_primary_contact: p.role === "Main Tenant" && !p.effectiveEndDate,
  is_signatory: p.isSignatory,
  relationship_start_date: p.effectiveStartDate,
  relationship_end_date: p.effectiveEndDate ?? null,
});

// ------------------------------------------------------------------ load
export async function loadDatabase(orgId: string): Promise<Database> {
  const q = (table: string, columns = "*") => supabase.from(table).select(columns).eq("organization_id", orgId);
  const [tenants, dobs, contacts, properties, units, leases, leaseUnits, parties, partyUnits, events] = await Promise.all([
    q("tenants").order("created_at", { ascending: false }),
    q("tenant_private_details", "tenant_id, date_of_birth"),
    q("tenant_contacts", "tenant_id, name, contact_type").eq("contact_type", "emergency"),
    q("properties", "id, name, address_line1, city").is("archived_at", null),
    q("units", "id, property_id, unit_number, unit_status, bedrooms, square_feet").is("archived_at", null),
    q("leases"),
    q("lease_units"),
    q("lease_parties"),
    q("lease_party_units", "lease_party_id, unit_id"),
    q("activity_events", "id, entity_id, occurred_at, related_record_label, description").eq("entity_type", "tenant").order("occurred_at", { ascending: false }).limit(500),
  ]);
  // sensitive details (date of birth) and the audit trail may be hidden by Row-Level Security: that is an empty result, not a failure
  for (const [name, res] of [["tenants", tenants], ["properties", properties], ["units", units], ["leases", leases], ["lease units", leaseUnits], ["lease parties", parties], ["lease party units", partyUnits]] as const) {
    if (res.error) throw toError(res.error, `Unable to load ${name}.`);
  }
  const dob = new Map<string, string>((dobs.data ?? []).filter((r: any) => r.date_of_birth).map((r: any) => [r.tenant_id, r.date_of_birth]));
  const emergency = new Map<string, string>((contacts.data ?? []).map((r: any) => [r.tenant_id, r.name]));

  const db = emptyDatabase();
  // profile pictures are private: they open through short-lived links (people without access to sensitive details see initials)
  const photoUrls = await documentUrls((tenants.data ?? []).filter((r: any) => r.photo_path).map((r: any) => ({ bucket: "tenant-identification", path: r.photo_path }))).catch(() => new Map<string, string>());
  db.tenants = (tenants.data ?? []).map((r: any) => ({ ...toTenant(r, dob, emergency), photoUrl: r.photo_path ? photoUrls.get(`tenant-identification/${r.photo_path}`) : undefined }));
  db.properties = (properties.data ?? []).map((r: any): Property => ({ id: r.id, name: r.name, address: r.address_line1, city: r.city }));
  db.units = (units.data ?? []).map((r: any): Unit => ({
    id: r.id,
    propertyId: r.property_id,
    unitNumber: r.unit_number,
    unitStatus: UNIT_STATUS_FROM_DB[r.unit_status] ?? "Available",
    bedrooms: Number(r.bedrooms ?? 0),
    area: Number(r.square_feet ?? 0),
  }));
  db.leases = (leases.data ?? []).map(toLease);
  db.leaseUnits = (leaseUnits.data ?? []).map(toLeaseUnit);
  db.leaseParties = (parties.data ?? []).map(toParty);
  db.partyUnits = (partyUnits.data ?? []).map((r: any): PartyUnit => ({ id: `${r.lease_party_id}:${r.unit_id}`, partyId: r.lease_party_id, unitId: r.unit_id }));
  db.activities = (events.data ?? []).map((r: any): Activity => ({
    id: r.id, tenantId: r.entity_id, at: r.occurred_at, label: r.related_record_label || "Activity", description: r.description,
  }));
  // one account per lease, owned by its main tenant
  db.accounts = db.leases.map((l) => ({
    id: `account-${l.id}`,
    label: l.leaseNumber,
    accountType: "Lease" as const,
    tenantId: db.leaseParties.find((p) => p.leaseId === l.id && p.role === "Main Tenant")?.tenantId ?? db.leaseParties.find((p) => p.leaseId === l.id)?.tenantId ?? "",
    leaseId: l.id,
    currency: "CAD" as const,
    nettingRule: "within-account-only" as const,
  }));
  applyFinance(db, await loadFinance(orgId));
  // documents filed against each lease (the files themselves open from the Leases page)
  const docLinks = await supabase.from("document_links").select("document_id, entity_id").eq("organization_id", orgId).eq("entity_type", "lease").limit(5000);
  const docIds = [...new Set((docLinks.data ?? []).map((l: any) => l.document_id as string))];
  if (docIds.length) {
    const docRows: any[] = [];
    for (let k = 0; k < docIds.length; k += 150) {
      const res = await supabase.from("documents").select("id, name, created_at").in("id", docIds.slice(k, k + 150)).is("deleted_at", null);
      docRows.push(...(res.data ?? []));
    }
    const byId = new Map(docRows.map((d) => [d.id, d]));
    const byLease = new Map<string, { id: string; name: string; createdAt: string }[]>();
    for (const l of docLinks.data ?? []) {
      const d = byId.get(l.document_id);
      if (d) byLease.set(l.entity_id, [...(byLease.get(l.entity_id) ?? []), { id: d.id, name: d.name, createdAt: dateOnly(d.created_at) ?? "" }]);
    }
    db.leases = db.leases.map((l) => ({ ...l, documentReferences: byLease.get(l.id) ?? [] }));
  }

  return db;
}

/** Turns invoices, payments and credits into the account ledger the page works with (charges, payments, credits per account). */
function applyFinance(db: Database, finance: FinanceData) {
  const hasLease = new Set(db.leases.map((l) => l.id));
  const accountFor = (tenantId: string, leaseId: string | null) => (leaseId && hasLease.has(leaseId) ? `account-${leaseId}` : `account-tenant-${tenantId}`);
  // invoices that belong to no lease are kept on the tenant's own account
  for (const inv of finance.invoices) {
    const id = accountFor(inv.tenantId, inv.leaseId);
    if (id.startsWith("account-tenant-") && !db.accounts.some((a) => a.id === id)) {
      const tenant = db.tenants.find((t) => t.id === inv.tenantId);
      db.accounts.push({ id, label: tenant ? `${tenant.firstName} ${tenant.lastName}`.trim() : "Tenant account", accountType: "Tenant", tenantId: inv.tenantId, currency: "CAD", nettingRule: "within-account-only" });
    }
  }
  const invoiceById = new Map(finance.invoices.map((i) => [i.id, i]));
  const paymentById = new Map(finance.payments.map((p) => [p.id, p]));
  const accountById = new Map(db.accounts.map((a) => [a.id, a]));
  const base = (inv: { tenantId: string; leaseId: string | null; unitId: string | null }) => {
    const accountId = accountFor(inv.tenantId, inv.leaseId);
    return { accountId, accountType: (accountById.get(accountId)?.accountType ?? "Lease") as Account["accountType"], leaseId: inv.leaseId ?? undefined, unitId: inv.unitId ?? undefined, tenantId: inv.tenantId };
  };
  const out: Transaction[] = [];
  for (const inv of finance.invoices) {
    out.push({
      ...base(inv), id: inv.id, invoiceId: inv.id, transactionType: "Charge", description: `${inv.number} \u2014 ${inv.description}`, amount: round2(inv.total),
      transactionDate: inv.issueDate, dueDate: inv.dueDate, paymentStatus: inv.status === "open" ? "Posted" : inv.status === "void" ? "Voided" : "Draft",
    });
  }
  for (const a of finance.allocations) {
    const inv = invoiceById.get(a.invoiceId);
    const pay = paymentById.get(a.paymentId);
    if (!inv || !pay) continue;
    out.push({
      ...base(inv), id: `${a.paymentId}:${a.invoiceId}`, invoiceId: inv.id, transactionType: "Payment", description: `Payment ${pay.number} for ${inv.number}`, amount: round2(a.amount),
      transactionDate: pay.date, paymentStatus: pay.status === "posted" ? "Posted" : "Voided",
    });
  }
  for (const c of finance.creditApplications) {
    const inv = invoiceById.get(c.invoiceId);
    if (!inv) continue;
    out.push({ ...base(inv), id: `credit:${c.id}`, invoiceId: inv.id, transactionType: "Credit", description: `Credit applied to ${inv.number}`, amount: round2(c.amount), transactionDate: c.date, paymentStatus: "Posted" });
  }
  db.transactions = out;
}

/**
 * Records a payment against an account: spreads the amount over the account's unpaid invoices, oldest due date first,
 * and keeps anything left over as a tenant credit. The database validates every allocation.
 */
export async function postAccountPayment(db: Database, account: Account, amount: number, date: string, description: string): Promise<void> {
  const orgId = getActiveOrgId();
  if (!orgId) throw new Error("Select an organization first.");
  const posted = db.transactions.filter((t) => t.accountId === account.id && t.paymentStatus === "Posted" && t.invoiceId);
  const settled = new Map<string, number>();
  for (const t of posted) if (t.transactionType !== "Charge") settled.set(t.invoiceId!, (settled.get(t.invoiceId!) ?? 0) + t.amount);
  let left = round2(amount);
  const allocations: { invoice_id: string; amount: number }[] = [];
  for (const charge of posted.filter((t) => t.transactionType === "Charge").sort((a, b) => (a.dueDate ?? a.transactionDate).localeCompare(b.dueDate ?? b.transactionDate))) {
    const owed = round2(charge.amount - (settled.get(charge.invoiceId!) ?? 0));
    if (owed <= 0 || left <= 0) continue;
    const part = Math.min(owed, left);
    allocations.push({ invoice_id: charge.invoiceId!, amount: part });
    left = round2(left - part);
  }
  const { error } = await supabase.rpc("record_payment", {
    p_org: orgId, p_tenant: account.tenantId, p_lease: account.leaseId ?? null, p_date: date, p_amount: round2(amount), p_method: "other",
    p_reference: description || null, p_notes: null, p_bank_account: null, p_allocations: allocations, p_keep_credit: left > 0, p_idempotency_key: crypto.randomUUID(),
  });
  if (error) throw friendly(error, "Unable to record the payment.");
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
  if (error.code === "23P01") return new Error("A selected unit already has an active lease during these dates. Choose another unit or lease term.");
  if (error.code === "23505") return new Error("That record already exists (duplicate email, lease number or association).");
  if (error.code === "42501") return new Error("You don't have permission to make this change.");
  return toError(error, fallback);
}

/** Server-assigned numbers (TEN-0001, LSE-00001) that the page should show instead of its provisional ones. */
export type Reconciliation = { tenantNumbers: Map<string, string>; leaseNumbers: Map<string, string> };

export async function persist(prev: Database, next: Database): Promise<Reconciliation> {
  const orgId = getActiveOrgId();
  if (!orgId) throw new Error("Select an organization first.");
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id ?? null;
  const out: Reconciliation = { tenantNumbers: new Map(), leaseNumbers: new Map() };
  const check = (res: { error: any }, fallback: string) => { if (res.error) throw friendly(res.error, fallback); };

  // tenants (+ date of birth, emergency contact)
  const tenants = diff(prev.tenants, next.tenants);
  if (tenants.added.length) {
    const res = await supabase.from("tenants").insert(tenants.added.map((t) => ({ id: t.id, organization_id: orgId, created_by: userId, ...tenantRow(t) }))).select("id, tenant_number");
    check(res, "Unable to save the tenant.");
    (res.data ?? []).forEach((r: any) => out.tenantNumbers.set(r.id, r.tenant_number));
  }
  for (const t of tenants.changed) {
    const res = await supabase.from("tenants").update(tenantRow(t)).eq("id", t.id).select("id");
    check(res, "Unable to save the tenant.");
    if (!res.data?.length) throw new Error("You don't have permission to edit tenants.");
  }
  const prevTenant = new Map(prev.tenants.map((t) => [t.id, t]));
  for (const t of [...tenants.added, ...tenants.changed]) {
    const before = prevTenant.get(t.id);
    if ((before?.dateOfBirth ?? "") !== (t.dateOfBirth ?? "")) {
      const res = t.dateOfBirth
        ? await supabase.from("tenant_private_details").upsert({ organization_id: orgId, tenant_id: t.id, date_of_birth: t.dateOfBirth })
        : await supabase.from("tenant_private_details").delete().eq("tenant_id", t.id);
      check(res, "Unable to save the date of birth.");
    }
    // profile picture: a newly chosen picture arrives as a data URL; a removed one as an empty value
    if ((before?.photoUrl ?? "") !== (t.photoUrl ?? "")) {
      if (t.photoUrl?.startsWith("data:")) {
        const blob = await (await fetch(t.photoUrl)).blob();
        const file = new File([blob], `profile.${blob.type === "image/png" ? "png" : blob.type === "image/webp" ? "webp" : "jpg"}`, { type: blob.type });
        for (const old of (await listDocuments(orgId, ["tenant"], [t.id])).filter((d) => d.category === "Profile photo")) await deleteDocument(old.id);
        const stored = await uploadDocument({
          bucket: "tenant-identification", area: "photos", file, entityType: "tenant", entityId: t.id, entityLabel: `${t.firstName} ${t.lastName}`.trim(), category: "Profile photo",
          originModule: "Tenants", visibility: "restricted", isSensitive: true,
        });
        check(await supabase.from("tenants").update({ photo_path: stored.path }).eq("id", t.id), "Unable to save the profile picture.");
      } else if (!t.photoUrl) {
        for (const old of (await listDocuments(orgId, ["tenant"], [t.id])).filter((d) => d.category === "Profile photo")) await deleteDocument(old.id);
        check(await supabase.from("tenants").update({ photo_path: null }).eq("id", t.id), "Unable to remove the profile picture.");
      }
    }
    if ((before?.emergencyContact ?? "") !== (t.emergencyContact ?? "")) {
      check(await supabase.from("tenant_contacts").delete().eq("tenant_id", t.id).eq("contact_type", "emergency"), "Unable to save the emergency contact.");
      if (t.emergencyContact?.trim()) {
        check(await supabase.from("tenant_contacts").insert({ organization_id: orgId, tenant_id: t.id, contact_type: "emergency", name: t.emergencyContact.trim(), is_primary: true }), "Unable to save the emergency contact.");
      }
    }
  }

  // leases
  const leases = diff(prev.leases, next.leases);
  if (leases.added.length) {
    const res = await supabase.from("leases").insert(leases.added.map((l) => ({ id: l.id, organization_id: orgId, created_by: userId, ...leaseRow(l) }))).select("id, lease_number");
    check(res, "Unable to save the lease.");
    (res.data ?? []).forEach((r: any) => out.leaseNumbers.set(r.id, r.lease_number));
  }
  for (const l of leases.changed) {
    const res = await supabase.from("leases").update(leaseRow(l)).eq("id", l.id).select("id");
    check(res, "Unable to save the lease.");
    if (!res.data?.length) throw new Error("You don't have permission to edit leases.");
  }

  // lease units, parties, party units
  const leaseUnits = diff(prev.leaseUnits, next.leaseUnits);
  if (leaseUnits.added.length) check(await supabase.from("lease_units").insert(leaseUnits.added.map((u) => ({ id: u.id, organization_id: orgId, ...leaseUnitRow(u) }))), "Unable to link the unit to the lease.");
  for (const u of leaseUnits.changed) check(await supabase.from("lease_units").update(leaseUnitRow(u)).eq("id", u.id), "Unable to update the lease unit.");

  const parties = diff(prev.leaseParties, next.leaseParties);
  if (parties.added.length) check(await supabase.from("lease_parties").insert(parties.added.map((p) => ({ id: p.id, organization_id: orgId, ...partyRow(p) }))), "Unable to add the person to the lease.");
  for (const p of parties.changed) check(await supabase.from("lease_parties").update(partyRow(p)).eq("id", p.id), "Unable to update the person on the lease.");

  const key = (u: PartyUnit) => `${u.partyId}:${u.unitId}`;
  const had = new Set(prev.partyUnits.map(key));
  const has = new Set(next.partyUnits.map(key));
  const addedPU = next.partyUnits.filter((u) => !had.has(key(u)));
  if (addedPU.length) check(await supabase.from("lease_party_units").insert(addedPU.map((u) => ({ organization_id: orgId, lease_party_id: u.partyId, unit_id: u.unitId }))), "Unable to assign the person to the unit.");
  for (const u of prev.partyUnits.filter((u) => !has.has(key(u)))) {
    check(await supabase.from("lease_party_units").delete().eq("lease_party_id", u.partyId).eq("unit_id", u.unitId), "Unable to update the unit assignment.");
  }

  // removed links (not produced by the page today, handled for completeness)
  for (const p of parties.removed) check(await supabase.from("lease_parties").delete().eq("id", p.id), "Unable to remove the person from the lease.");
  for (const u of leaseUnits.removed) check(await supabase.from("lease_units").delete().eq("id", u.id), "Unable to unlink the unit.");

  // unit occupancy shown on the Units page
  for (const u of diff(prev.units, next.units).changed) {
    check(await supabase.from("units").update({ unit_status: UNIT_STATUS_TO_DB[u.unitStatus] }).eq("id", u.id), "Unable to update the unit status.");
  }

  // activity feed -> audit trail (written by the database, attributed to the signed-in user)
  for (const a of diff(prev.activities, next.activities).added.reverse()) {
    check(await supabase.rpc("record_activity", {
      p_org: orgId, p_action: "tenant.activity", p_category: "Tenants & Leases", p_description: a.description,
      p_entity_type: "tenant", p_entity_id: a.tenantId, p_label: a.label, p_source_module: "Tenants",
    }), "Unable to record the activity.");
  }
  return out;
}
