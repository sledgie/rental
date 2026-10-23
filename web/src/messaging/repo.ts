// Supabase access for the Messages page: people you can message (staff, tenants, vendors, owners), the records a conversation can be about,
// and conversations with their participants, messages (+ attachments), stars, read state, history events, announcements and the shared
// message templates. The page keeps everything in React state and replaces lists after every action, so persistence is a diff:
// `persist(prev, next, meId)` writes the rows that changed. Nothing is delivered by email or text from here: messages are recorded only.
import { supabase, toError } from "../lib/supabase";
import { getActiveOrgId } from "../lib/activeOrg";
import { fetchAll, loadFinance } from "../lib/financeData";
import { loadStaff } from "../properties/add/store/refRepo";
import { documentUrls, uploadDocument } from "../lib/documents";
import type {
  Announcement, Attachment, Conversation, ConversationAuditLog, Inspection, Invoice, Lease, MaintenanceRequest, Message, MessageCategory, MessageTemplate, Property, Tenant, Unit, User, UserRole, Vendor,
} from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any -- rows come from untyped PostgREST responses */

export interface Loaded {
  me: User | null;
  users: User[];
  properties: Property[];
  units: Unit[];
  tenants: Tenant[];
  leases: Lease[];
  maintenanceRequests: MaintenanceRequest[];
  invoices: Invoice[];
  vendors: Vendor[];
  inspections: Inspection[];
  conversations: Conversation[];
  messages: Message[];
  auditLogs: ConversationAuditLog[];
  announcements: Announcement[];
  templates: MessageTemplate[];
  readTracker: Record<string, boolean>;
}
export interface Slices {
  conversations: Conversation[];
  messages: Message[];
  auditLogs: ConversationAuditLog[];
  announcements: Announcement[];
  templates: MessageTemplate[];
  readTracker: Record<string, boolean>;
}
export const emptySlices = (): Slices => ({ conversations: [], messages: [], auditLogs: [], announcements: [], templates: [], readTracker: {} });

type Kind = "staff" | "tenant" | "vendor" | "owner";
/** who an id belongs to (staff are profiles; tenants, vendors and owners are their own records) */
const kindOf = new Map<string, Kind>();
const unitProperty = new Map<string, string>();
const BUCKET = "lease-documents";
const READ_KEY = "loft.messages.read";

const uuid = (v: unknown) => (typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v) ? v : null);
const num = (v: unknown) => Number(v ?? 0);
const dateOnly = (v: string | null | undefined) => (v ? String(v).slice(0, 10) : "");
const opt = <T,>(v: T | null | undefined) => (v === null || v === undefined || v === "" ? undefined : v);

function friendly(error: { code?: string; message?: string }, fallback: string): Error {
  if (error.code === "42501") return new Error("You don't have permission to make this change.");
  if (["23514", "23503", "23505"].includes(error.code ?? "")) return new Error(error.message || fallback);
  return toError(error, fallback);
}
const check = (res: { error: any }, fallback: string) => { if (res.error) throw friendly(res.error, fallback); };

const staffRole = (role: string): UserRole => {
  const r = role.toLowerCase();
  if (/account|finance/.test(r)) return "accounting_staff";
  if (/mainten/.test(r)) return "maintenance_staff";
  if (/leas/.test(r)) return "leasing_staff";
  if (/admin|owner/.test(r)) return "admin";
  return "property_manager";
};

/** read state kept in this browser for conversations you are not a participant of */
const localRead = (): Record<string, boolean> => {
  try { return JSON.parse(localStorage.getItem(READ_KEY) ?? "{}"); } catch { return {}; }
};
const saveLocalRead = (read: Record<string, boolean>) => {
  try { localStorage.setItem(READ_KEY, JSON.stringify(read)); } catch { /* storage may be unavailable */ }
};

// ------------------------------------------------------------------ load
export async function loadAll(orgId: string): Promise<Loaded> {
  const { data: auth } = await supabase.auth.getUser();
  const meId = auth.user?.id ?? "";
  const [staff, profiles, properties, units, tenants, leases, leaseUnits, parties, vendors, owners, requests, conversations, participants, stars, messages, attachments, events, announcements, targets, acks, templates] =
    await Promise.all([
      loadStaff(orgId).catch(() => []),
      supabase.from("profiles").select("id, full_name, email, phone"),
      fetchAll("properties", "id, name, address_line1, city, state_province, property_manager_id", orgId, "name"),
      fetchAll("units", "id, property_id, unit_number, floor, bedrooms, bathrooms, square_feet, market_rent, advertised_rent, unit_status", orgId, "unit_number"),
      fetchAll("tenants", "id, first_name, last_name, email, phone, status, created_at", orgId, "last_name"),
      fetchAll("leases", "id, lease_number, status, start_date, end_date, agreed_monthly_rent, deposit_amount", orgId, "start_date"),
      fetchAll("lease_units", "lease_id, unit_id", orgId, "lease_id"),
      fetchAll("lease_parties", "lease_id, tenant_id, role, relationship_start_date, relationship_end_date", orgId, "lease_id"),
      fetchAll("vendors", "id, company_name, contact_name, email, phone, trade, categories, rating, vendor_type, archived_at", orgId, "company_name"),
      fetchAll("owners", "id, name, email, phone, archived_at", orgId, "name"),
      fetchAll("maintenance_requests", "id, request_number, title, description, property_id, unit_id, tenant_id, priority, status, created_at, category, assigned_staff_id, assigned_vendor_id", orgId, "created_at"),
      fetchAll("conversations", "*", orgId, "updated_at"),
      fetchAll("conversation_participants", "*", orgId, "joined_at"),
      fetchAll("conversation_stars", "conversation_id, user_id", orgId, "starred_at"),
      fetchAll("messages", "*", orgId, "created_at"),
      fetchAll("message_attachments", "message_id, document_id", orgId, "message_id"),
      fetchAll("conversation_events", "*", orgId, "created_at"),
      fetchAll("announcements", "*", orgId, "created_at"),
      fetchAll("announcement_targets", "announcement_id, property_id, unit_id", orgId, "announcement_id"),
      fetchAll("announcement_acknowledgements", "announcement_id, user_id, tenant_id", orgId, "acknowledged_at"),
      fetchAll("message_templates", "id, name, category, subject, body, available_variables, status, recipient_configuration, created_by, updated_at", orgId, "updated_at"),
    ]);
  const finance = await loadFinance(orgId).catch(() => null);
  const profile = new Map<string, any>((profiles.data ?? []).map((p: any) => [p.id, p]));

  kindOf.clear();
  unitProperty.clear();
  const unitInfo = new Map<string, any>(units.map((u: any) => [u.id, u]));
  for (const u of units) unitProperty.set(u.id, u.property_id);
  const propertyName = new Map<string, string>(properties.map((p: any) => [p.id, p.name]));
  const activeLeases = new Map<string, any>(leases.filter((l: any) => l.status === "active").map((l: any) => [l.id, l]));
  const tenantLease = (tenantId: string) => {
    const party = parties.find((p: any) => p.tenant_id === tenantId && !p.relationship_end_date && activeLeases.has(p.lease_id)) ?? parties.find((p: any) => p.tenant_id === tenantId);
    if (!party) return null;
    const unitId = leaseUnits.find((lu: any) => lu.lease_id === party.lease_id)?.unit_id;
    return { party, lease: leases.find((l: any) => l.id === party.lease_id), unitId };
  };

  const users: User[] = [];
  for (const s of staff) {
    kindOf.set(s.id, "staff");
    const p = profile.get(s.id);
    users.push({ id: s.id, name: s.name, email: p?.email ?? "", phone: p?.phone ?? "", role: staffRole(String(s.role)), title: String(s.role), isStaff: true });
  }
  if (meId && !kindOf.has(meId)) {
    kindOf.set(meId, "staff");
    const p = profile.get(meId);
    users.push({ id: meId, name: p?.full_name || auth.user?.email || "You", email: p?.email ?? auth.user?.email ?? "", phone: p?.phone ?? "", role: "property_manager", title: "Team member", isStaff: true });
  }
  for (const t of tenants) {
    kindOf.set(t.id, "tenant");
    const link = tenantLease(t.id);
    const unit = link?.unitId ? unitInfo.get(link.unitId) : undefined;
    users.push({
      id: t.id, name: `${t.first_name} ${t.last_name ?? ""}`.trim(), email: t.email ?? "", phone: t.phone ?? "", role: "tenant", title: "Tenant", isStaff: false,
      companyOrUnit: unit ? `${propertyName.get(unit.property_id) ?? ""} · Unit ${unit.unit_number}` : undefined,
    });
  }
  const liveVendors = vendors.filter((v: any) => !v.archived_at);
  for (const v of liveVendors) {
    kindOf.set(v.id, "vendor");
    users.push({ id: v.id, name: v.company_name, email: v.email ?? "", phone: v.phone ?? "", role: "vendor", title: v.trade ?? v.categories?.[0] ?? "Vendor", isStaff: false, companyOrUnit: v.contact_name ?? undefined });
  }
  for (const o of owners.filter((x: any) => !x.archived_at)) {
    kindOf.set(o.id, "owner");
    users.push({ id: o.id, name: o.name, email: o.email ?? "", phone: o.phone ?? "", role: "landlord", title: "Owner", isStaff: false });
  }

  // attachments: stored files open through short-lived links
  const docIds = [...new Set(attachments.map((a: any) => a.document_id))];
  const docs = new Map<string, any>();
  const versions = new Map<string, any>();
  for (let i = 0; i < docIds.length; i += 150) {
    const chunk = docIds.slice(i, i + 150);
    const [d, v] = await Promise.all([
      supabase.from("documents").select("id, name, created_at, uploaded_by").in("id", chunk),
      supabase.from("document_versions").select("document_id, version_number, storage_bucket, storage_path, mime_type, size_bytes").in("document_id", chunk).order("version_number"),
    ]);
    for (const row of d.data ?? []) docs.set(row.id, row);
    for (const row of v.data ?? []) versions.set(row.document_id, row);
  }
  const urls = await documentUrls([...versions.values()].map((v) => ({ bucket: v.storage_bucket, path: v.storage_path }))).catch(() => new Map<string, string>());
  const attachmentsOf = (messageId: string): Attachment[] =>
    attachments.filter((a: any) => a.message_id === messageId).flatMap((a: any): Attachment[] => {
      const d = docs.get(a.document_id);
      const v = versions.get(a.document_id);
      if (!d || !v) return [];
      return [{ id: d.id, messageId, filename: d.name, mimeType: v.mime_type ?? "", sizeBytes: num(v.size_bytes), mockUrl: urls.get(`${v.storage_bucket}/${v.storage_path}`), uploadedBy: d.uploaded_by ?? "", uploadedAt: d.created_at }];
    });

  const lastMessageAt = new Map<string, string>();
  for (const m of messages) lastMessageAt.set(m.conversation_id, m.created_at);
  const readTracker: Record<string, boolean> = { ...localRead() };
  for (const p of participants.filter((x: any) => x.user_id === meId)) {
    const last = lastMessageAt.get(p.conversation_id);
    readTracker[p.conversation_id] = !last || (!!p.last_read_at && p.last_read_at >= last);
  }

  const balanceOf = new Map<string, number>();
  for (const inv of finance?.invoices ?? []) balanceOf.set(inv.tenantId, (balanceOf.get(inv.tenantId) ?? 0) + inv.outstanding);
  const today = new Date().toISOString().slice(0, 10);

  return {
    me: users.find((u) => u.id === meId) ?? null,
    users,
    properties: properties.map((p: any): Property => {
      const own = units.filter((u: any) => u.property_id === p.id);
      return {
        id: p.id, name: p.name, address: p.address_line1 ?? "", city: [p.city, p.state_province].filter(Boolean).join(", "), unitsCount: own.length,
        occupiedCount: own.filter((u: any) => ["occupied", "notice"].includes(u.unit_status)).length, managerId: p.property_manager_id ?? "", image: "",
      };
    }),
    units: units.map((u: any): Unit => {
      const lease = leaseUnits.find((lu: any) => lu.unit_id === u.id && activeLeases.has(lu.lease_id));
      const tenant = lease ? parties.find((p: any) => p.lease_id === lease.lease_id && p.role === "main_tenant")?.tenant_id : undefined;
      return {
        id: u.id, propertyId: u.property_id, unitNumber: u.unit_number, floor: Number(u.floor) || 0, bedrooms: num(u.bedrooms), bathrooms: num(u.bathrooms), sqft: num(u.square_feet),
        monthlyRent: num(u.market_rent ?? u.advertised_rent), status: ["occupied", "notice"].includes(u.unit_status) ? "occupied" : ["under_maintenance", "renovation"].includes(u.unit_status) ? "maintenance" : "vacant", tenantId: tenant,
      };
    }),
    tenants: tenants.map((t: any): Tenant => {
      const link = tenantLease(t.id);
      return {
        id: t.id, name: `${t.first_name} ${t.last_name ?? ""}`.trim(), email: t.email ?? "", phone: t.phone ?? "", unitId: link?.unitId ?? "", propertyId: link?.unitId ? unitProperty.get(link.unitId) ?? "" : "",
        leaseId: link?.lease?.id ?? "", moveInDate: dateOnly(link?.party?.relationship_start_date ?? t.created_at), outstandingBalance: balanceOf.get(t.id) ?? 0, depositAmount: num(link?.lease?.deposit_amount),
        status: ["active"].includes(t.status) ? "active" : ["former", "inactive"].includes(t.status) ? "past" : "pending",
      };
    }),
    leases: leases.map((l: any): Lease => {
      const unitId = leaseUnits.find((lu: any) => lu.lease_id === l.id)?.unit_id ?? "";
      const end = l.end_date ?? "";
      const soon = end && end >= today && end <= new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10);
      return {
        id: l.id, leaseNumber: l.lease_number ?? l.id, tenantId: parties.find((p: any) => p.lease_id === l.id && p.role === "main_tenant")?.tenant_id ?? "", propertyId: unitProperty.get(unitId) ?? "", unitId,
        startDate: l.start_date, endDate: end, monthlyRent: num(l.agreed_monthly_rent), depositAmount: num(l.deposit_amount),
        status: ["terminated", "expired", "archived"].includes(l.status) ? "terminated" : soon ? "expiring_soon" : l.status === "active" ? "active" : "renewal_pending",
      };
    }),
    maintenanceRequests: requests.map((r: any): MaintenanceRequest => ({
      id: r.id, requestNumber: r.request_number ?? r.id, title: r.title, description: r.description ?? "", propertyId: r.property_id, unitId: r.unit_id ?? "", tenantId: r.tenant_id ?? "",
      priority: r.priority === "emergency" ? "urgent" : r.priority, status: r.status === "completed" || r.status === "closed" ? "completed" : r.status === "in_progress" ? "in_progress" : r.status === "assigned" ? "assigned" : r.status === "on_hold" ? "parts_pending" : "new",
      assignedStaffId: opt(r.assigned_staff_id), assignedVendorId: opt(r.assigned_vendor_id), createdAt: r.created_at, category: r.category,
    })),
    invoices: (finance?.invoices ?? []).filter((i) => i.status !== "void" && i.status !== "draft").map((i): Invoice => ({
      id: i.id, invoiceNumber: i.number, tenantId: i.tenantId, propertyId: i.propertyId ?? "", unitId: i.unitId ?? "", amount: i.total, dueDate: i.dueDate,
      status: i.outstanding <= 0 ? "paid" : i.daysOverdue > 0 ? "overdue" : "unpaid", type: i.type === "late_fee" ? "late_fee" : i.type === "utilities" ? "utilities" : i.type === "maintenance" ? "repairs" : "rent", description: i.description,
    })),
    vendors: liveVendors.map((v: any): Vendor => ({
      id: v.id, name: v.company_name, category: v.trade ?? v.categories?.[0] ?? "", contactPerson: v.contact_name ?? "", email: v.email ?? "", phone: v.phone ?? "", rating: num(v.rating),
      activeJobsCount: requests.filter((r: any) => r.assigned_vendor_id === v.id && !["completed", "closed", "cancelled", "rejected"].includes(r.status)).length,
    })),
    inspections: [],
    conversations: conversations.map((c: any): Conversation => ({
      id: c.id, subject: c.subject, category: c.category, priority: c.priority, status: c.status, visibility: c.visibility, primaryChannel: c.primary_channel,
      participantIds: participants.filter((p: any) => p.conversation_id === c.id).map((p: any) => p.user_id ?? p.tenant_id ?? p.vendor_id ?? p.owner_id),
      assignedTo: opt(c.assigned_to), assignedAt: opt(c.assigned_at), assignedBy: opt(c.assigned_by), assignmentNotes: opt(c.assignment_notes), relatedEntityType: opt(c.related_entity_type),
      relatedEntityId: opt(c.related_entity_id), relatedEntityRef: opt(c.related_entity_ref), createdBy: c.created_by ?? "", createdAt: c.created_at, updatedAt: c.updated_at, archivedAt: opt(c.archived_at),
      resolvedAt: opt(c.resolved_at), starredBy: stars.filter((s: any) => s.conversation_id === c.id).map((s: any) => s.user_id), tags: c.tags ?? [],
    })),
    messages: messages.map((m: any): Message => ({
      id: m.id, conversationId: m.conversation_id, senderId: m.sender_user_id ?? m.sender_tenant_id ?? m.sender_vendor_id ?? m.sender_owner_id ?? "system", body: m.body, createdAt: m.created_at, editedAt: opt(m.edited_at),
      channel: m.channel, deliveryStatus: m.delivery_status === "draft" ? "draft" : m.delivery_status === "read" || m.delivery_status === "simulated_read" ? "simulated_read" : m.delivery_status === "sent" || m.delivery_status === "simulated_sent" ? "simulated_sent" : "simulated_delivered",
      isInternalNote: m.is_internal_note, attachments: attachmentsOf(m.id), replyToMessageId: opt(m.reply_to_message_id),
    })),
    auditLogs: events.map((e: any): ConversationAuditLog => ({
      id: e.id, conversationId: e.conversation_id, eventType: e.event_type, actorId: e.actor_id ?? "", timestamp: e.created_at, oldValue: opt(e.old_value), newValue: opt(e.new_value), notes: opt(e.notes),
    })).reverse(),
    announcements: announcements.map((a: any): Announcement => {
      const mine = targets.filter((t: any) => t.announcement_id === a.id);
      return {
        id: a.id, title: a.title, body: a.body, category: a.category as MessageCategory, targetAudience: a.target_audience, targetPropertyIds: [...new Set(mine.map((t: any) => t.property_id))] as string[],
        targetUnitIds: mine.filter((t: any) => t.unit_id).map((t: any) => t.unit_id), createdBy: a.created_by ?? "", createdAt: a.created_at, scheduledAt: opt(a.scheduled_at), publishedAt: opt(a.published_at),
        expiresAt: opt(a.expires_at), priority: a.priority, acknowledgementRequired: a.acknowledgement_required, status: a.status,
        acknowledgedUserIds: acks.filter((k: any) => k.announcement_id === a.id).map((k: any) => k.user_id ?? k.tenant_id), channels: a.channels ?? [],
      };
    }).reverse(),
    templates: templates.map((t: any): MessageTemplate => ({
      id: t.id, name: t.name, category: t.category as MessageCategory, subject: t.subject ?? "", body: t.body ?? "", availableVariables: t.available_variables ?? [],
      intendedAudience: t.recipient_configuration?.audience ?? "tenants", status: t.status === "active" ? "active" : "inactive", createdBy: t.created_by ?? "", updatedAt: t.updated_at,
    })),
    readTracker,
  };
}

// ------------------------------------------------------------------ persist (diff)
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
function diff<T extends { id: string }>(prev: T[], next: T[]) {
  const before = new Map(prev.map((r) => [r.id, r]));
  const after = new Map(next.map((r) => [r.id, r]));
  return { added: next.filter((r) => !before.has(r.id)), changed: next.filter((r) => before.has(r.id) && !same(before.get(r.id), r)), removed: prev.filter((r) => !after.has(r.id)) };
}
const participantRow = (orgId: string, conversationId: string, id: string) => {
  const kind = kindOf.get(id) ?? "staff";
  return {
    organization_id: orgId, conversation_id: conversationId, participant_type: kind, user_id: kind === "staff" ? id : null, tenant_id: kind === "tenant" ? id : null,
    vendor_id: kind === "vendor" ? id : null, owner_id: kind === "owner" ? id : null,
  };
};
const plain = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

export async function persist(prev: Slices, next: Slices, meId: string): Promise<void> {
  const orgId = getActiveOrgId();
  if (!orgId) throw new Error("Select an organization first.");
  const me = uuid(meId);

  // conversations (+ participants and your star)
  const convRow = (c: Conversation) => ({
    subject: c.subject, category: c.category, priority: c.priority, status: c.status, visibility: c.visibility, primary_channel: c.primaryChannel, assigned_to: uuid(c.assignedTo),
    assigned_at: c.assignedAt ?? null, assigned_by: uuid(c.assignedBy), assignment_notes: c.assignmentNotes ?? null, related_entity_type: c.relatedEntityType ?? null, related_entity_id: uuid(c.relatedEntityId),
    related_entity_ref: c.relatedEntityRef ?? null, tags: c.tags ?? [], archived_at: c.archivedAt ?? null, resolved_at: c.resolvedAt ?? null,
  });
  const convs = diff(prev.conversations.map((c) => ({ ...c, draftBody: undefined })), next.conversations.map((c) => ({ ...c, draftBody: undefined })));
  if (convs.added.length) check(await supabase.from("conversations").insert(convs.added.map((c) => ({ id: c.id, organization_id: orgId, created_by: me, ...convRow(c) }))), "Unable to save the conversation.");
  for (const c of convs.changed) {
    const before = prev.conversations.find((x) => x.id === c.id)!;
    if (!same(convRow(before), convRow(c))) check(await supabase.from("conversations").update(convRow(c)).eq("id", c.id), "Unable to save the conversation.");
  }
  for (const c of [...convs.added, ...convs.changed]) {
    const before = prev.conversations.find((x) => x.id === c.id);
    const fresh = [...new Set(c.participantIds)].filter((id) => !before?.participantIds.includes(id) && uuid(id));
    if (fresh.length) check(await supabase.from("conversation_participants").insert(fresh.map((id) => participantRow(orgId, c.id, id))), "Unable to add the participants.");
    if (me) {
      const was = before?.starredBy.includes(me) ?? false;
      const is = c.starredBy.includes(me);
      if (is && !was) check(await supabase.from("conversation_stars").insert({ organization_id: orgId, conversation_id: c.id, user_id: me }), "Unable to star the conversation.");
      if (!is && was) check(await supabase.from("conversation_stars").delete().eq("conversation_id", c.id).eq("user_id", me), "Unable to unstar the conversation.");
    }
  }

  // messages (+ attached files)
  for (const m of diff(prev.messages, next.messages).added) {
    const kind = kindOf.get(m.senderId);
    check(await supabase.from("messages").insert({
      id: m.id, organization_id: orgId, conversation_id: m.conversationId, sender_type: kind ?? "system", sender_user_id: kind === "staff" ? uuid(m.senderId) : null,
      sender_tenant_id: kind === "tenant" ? m.senderId : null, sender_vendor_id: kind === "vendor" ? m.senderId : null, sender_owner_id: kind === "owner" ? m.senderId : null, body: m.body, channel: m.channel,
      delivery_status: m.deliveryStatus, is_internal_note: m.isInternalNote, reply_to_message_id: uuid(m.replyToMessageId),
    }), "Unable to save the message.");
    for (const a of m.attachments) {
      if (!a.file) continue;
      const documentId = crypto.randomUUID();
      check(await supabase.from("documents").insert({
        id: documentId, organization_id: orgId, name: a.filename, document_type: "Message attachment", category: "Correspondence", origin_module: "Messages", creation_method: "manual_upload", uploaded_by: me,
      }), "Unable to save the attachment.");
      try {
        await uploadDocument({ id: documentId, newVersionOf: true, versionNumber: 1, bucket: BUCKET, area: "messages", file: a.file, entityType: "property", entityId: m.conversationId, category: "Correspondence", originModule: "Messages", title: a.filename, status: "active" });
        check(await supabase.from("message_attachments").insert({ organization_id: orgId, message_id: m.id, document_id: documentId }), "Unable to attach the file.");
      } catch (error) {
        await supabase.from("documents").delete().eq("id", documentId);
        throw error;
      }
    }
  }

  // history events (append-only)
  const events = diff(prev.auditLogs, next.auditLogs).added.reverse();
  if (events.length) {
    check(await supabase.from("conversation_events").insert(events.map((e) => ({
      organization_id: orgId, conversation_id: e.conversationId, event_type: e.eventType, actor_id: uuid(e.actorId) ?? me, old_value: e.oldValue ?? null, new_value: e.newValue ?? null, notes: e.notes ?? null,
    }))), "Unable to record the conversation history.");
  }

  // announcements (+ targets and acknowledgements)
  const annRow = (a: Announcement) => ({
    title: a.title, body: a.body, category: a.category, target_audience: a.targetAudience, priority: a.priority, acknowledgement_required: a.acknowledgementRequired, status: a.status, channels: a.channels,
    scheduled_at: a.scheduledAt || null, published_at: a.publishedAt || null, expires_at: a.expiresAt || null,
  });
  const anns = diff(prev.announcements, next.announcements);
  for (const a of anns.added) {
    check(await supabase.from("announcements").insert({ id: a.id, organization_id: orgId, created_by: me, ...annRow(a) }), "Unable to save the announcement.");
    const rows = [
      ...(a.targetUnitIds ?? []).filter((u) => unitProperty.has(u)).map((unit_id) => ({ organization_id: orgId, announcement_id: a.id, property_id: unitProperty.get(unit_id)!, unit_id })),
      ...(a.targetPropertyIds ?? []).filter((p) => uuid(p) && !(a.targetUnitIds ?? []).some((u) => unitProperty.get(u) === p)).map((property_id) => ({ organization_id: orgId, announcement_id: a.id, property_id, unit_id: null })),
    ];
    if (rows.length) check(await supabase.from("announcement_targets").insert(rows), "Unable to save the announcement audience.");
  }
  for (const a of anns.changed) {
    const before = prev.announcements.find((x) => x.id === a.id)!;
    if (!same(annRow(before), annRow(a))) check(await supabase.from("announcements").update(annRow(a)).eq("id", a.id), "Unable to save the announcement.");
    const acked = a.acknowledgedUserIds.filter((id) => !before.acknowledgedUserIds.includes(id) && uuid(id));
    if (acked.length) {
      check(await supabase.from("announcement_acknowledgements").insert(acked.map((id) => ({
        organization_id: orgId, announcement_id: a.id, user_id: kindOf.get(id) === "tenant" ? null : id, tenant_id: kindOf.get(id) === "tenant" ? id : null,
      }))), "Unable to record the acknowledgement.");
    }
  }

  // reply templates (the same library as the Message Templates page)
  const tplRow = (t: MessageTemplate) => ({
    name: t.name, category: t.category, subject: t.subject, body: t.body, plain_text_body: plain(t.body), available_variables: t.availableVariables, status: t.status, recipient_configuration: { audience: t.intendedAudience },
  });
  const tpls = diff(prev.templates, next.templates);
  for (const t of tpls.added) check(await supabase.from("message_templates").insert({ id: t.id, organization_id: orgId, channel: "email", created_by: me, ...tplRow(t) }), "Unable to save the template.");
  for (const t of tpls.changed) check(await supabase.from("message_templates").update(tplRow(t)).eq("id", t.id), "Unable to save the template.");
  for (const t of tpls.removed) check(await supabase.from("message_templates").delete().eq("id", t.id), "Unable to delete the template.");

  // read state: kept on your participant row, or in this browser when you are not a participant
  const changedRead = Object.keys(next.readTracker).filter((id) => next.readTracker[id] !== prev.readTracker[id]);
  if (changedRead.length) {
    const local = localRead();
    for (const id of changedRead) {
      local[id] = next.readTracker[id];
      if (me && uuid(id)) await supabase.from("conversation_participants").update({ last_read_at: next.readTracker[id] ? new Date().toISOString() : null }).eq("conversation_id", id).eq("user_id", me);
    }
    saveLocalRead(local);
  }
}
