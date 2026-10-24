// Supabase access for the Notification Center (public.notifications, public.notification_preferences and process_notification_events from
// database/migrations/023_notification_center.sql). Row-Level Security limits every query to the signed-in member's own notifications; the
// browser can change only read_at, dismissed_at and snoozed_until. This file reads, writes and maps rows.
import { supabase, toError } from "../lib/supabase";
import { CATEGORY_ORDER, defaultPreferences, type AppNotification, type Category, type Preference, type Preferences, type Severity } from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any -- rows come from untyped PostgREST responses */

const LIMIT = 500;
const check = (res: { error: any }, fallback: string) => { if (res.error) throw toError(res.error, fallback); };

function toNotification(r: any, propertyName: string | null): AppNotification {
  return {
    id: r.id, organizationId: r.organization_id, category: r.category, severity: r.severity, eventType: r.notification_type, title: r.title, message: r.body ?? "",
    entityType: r.entity_type, entityId: r.entity_id, propertyId: r.property_id, propertyName, actionLabel: r.action_label, actionRoute: r.action_route,
    actionRequired: !!r.action_required, createdAt: r.created_at, readAt: r.read_at, snoozedUntil: r.snoozed_until, expiresAt: r.expires_at,
  };
}

/** The member's notifications in one organization, newest first (dismissed ones are left out). */
export async function list(orgId: string, userId: string): Promise<AppNotification[]> {
  const res = await supabase.from("notifications").select("*").eq("organization_id", orgId).eq("user_id", userId).is("dismissed_at", null)
    .order("created_at", { ascending: false }).limit(LIMIT);
  check(res, "Unable to load notifications.");
  const rows = (res.data ?? []) as any[];
  const ids = [...new Set(rows.map((r) => r.property_id).filter(Boolean))] as string[];
  const names = new Map<string, string>();
  if (ids.length) {
    const props = await supabase.from("properties").select("id, name").eq("organization_id", orgId).in("id", ids);
    for (const p of (props.data ?? []) as any[]) names.set(p.id, p.name);
  }
  return rows.map((r) => toNotification(r, r.property_id ? names.get(r.property_id) ?? null : null));
}

/** Properties of the organization, for the filter. */
export async function listProperties(orgId: string): Promise<{ id: string; name: string }[]> {
  const res = await supabase.from("properties").select("id, name").eq("organization_id", orgId).order("name");
  check(res, "Unable to load properties.");
  return ((res.data ?? []) as any[]).map((p) => ({ id: p.id, name: p.name }));
}

/** Creates the notifications that are about time passing (overdue invoices, expiring leases, ...). Safe to repeat. */
export async function runEvents(orgId: string): Promise<number> {
  const { data, error } = await supabase.rpc("process_notification_events", { p_org: orgId });
  if (error) throw toError(error, "Unable to refresh notifications.");
  return Number((data as any)?.created ?? 0);
}

const stamp = (ids: string[], patch: Record<string, string | null>) => supabase.from("notifications").update(patch).in("id", ids);

export async function markRead(ids: string[], at: string): Promise<void> { if (ids.length) check(await stamp(ids, { read_at: at }), "Unable to mark as read."); }
export async function markUnread(ids: string[]): Promise<void> { if (ids.length) check(await stamp(ids, { read_at: null }), "Unable to mark as unread."); }
export async function dismiss(ids: string[], at: string): Promise<void> { if (ids.length) check(await stamp(ids, { dismissed_at: at }), "Unable to dismiss."); }
export async function snooze(ids: string[], until: string): Promise<void> { if (ids.length) check(await stamp(ids, { snoozed_until: until }), "Unable to snooze."); }

export async function markAllRead(orgId: string, userId: string, at: string): Promise<void> {
  check(await supabase.from("notifications").update({ read_at: at }).eq("organization_id", orgId).eq("user_id", userId).is("read_at", null).is("dismissed_at", null), "Unable to mark all as read.");
}

/* ---------------------------------------------------------------- preferences */

export async function loadPreferences(orgId: string, userId: string): Promise<Preferences> {
  const res = await supabase.from("notification_preferences").select("category, enabled, minimum_severity").eq("organization_id", orgId).eq("user_id", userId);
  check(res, "Unable to load notification preferences.");
  const prefs = defaultPreferences();
  for (const r of (res.data ?? []) as any[]) if (CATEGORY_ORDER.includes(r.category)) prefs[r.category as Category] = { enabled: !!r.enabled, minimumSeverity: r.minimum_severity as Severity };
  return prefs;
}

export async function savePreference(orgId: string, userId: string, category: Category, pref: Preference): Promise<void> {
  check(await supabase.from("notification_preferences").upsert(
    { organization_id: orgId, user_id: userId, category, enabled: pref.enabled, minimum_severity: pref.minimumSeverity },
    { onConflict: "organization_id,user_id,category" }), "Unable to save the preference.");
}

export async function resetPreferences(orgId: string, userId: string): Promise<void> {
  check(await supabase.from("notification_preferences").delete().eq("organization_id", orgId).eq("user_id", userId), "Unable to restore the defaults.");
}
