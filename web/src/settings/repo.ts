// Supabase access for System Settings: organization settings (one row per category in organization_settings), your personal preferences
// (user_preferences) and the settings history (activity_events, action "settings.*"). Row-Level Security decides who may change what.
import { supabase, toError } from "../lib/supabase";
import type { ActivityEvent, CategoryId, OrgSettings, UserPreferences } from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any -- rows come from untyped PostgREST responses */

/** organization-level categories the database stores (personal preferences live in user_preferences) */
const STORED = new Set(["general", "financial", "property", "maintenance", "projects", "notifications", "tasks", "workflow", "documents", "security", "data"]);

function friendly(error: { code?: string; message?: string }, fallback: string): Error {
  if (error.code === "42501") return new Error("You don't have permission to change these settings.");
  return toError(error, fallback);
}
const initialsOf = (name: string) => name.split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "?";
/** jsonb columns hold objects: a list setting is wrapped so it can be stored */
const wrap = (value: unknown) => (value && typeof value === "object" && !Array.isArray(value) ? value : { __value: value });
const unwrap = (value: any) => (value && typeof value === "object" && "__value" in value && Object.keys(value).length === 1 ? value.__value : value);

export async function loadOrgSettings(orgId: string): Promise<Partial<OrgSettings>> {
  const { data, error } = await supabase.from("organization_settings").select("category, value").eq("organization_id", orgId);
  if (error) throw friendly(error, "Unable to load the settings.");
  const out: Partial<OrgSettings> = {};
  for (const row of data ?? []) out[row.category] = unwrap(row.value);
  return out;
}

export async function saveOrgCategory(orgId: string, category: CategoryId, value: unknown): Promise<void> {
  if (!STORED.has(category)) return;
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase.from("organization_settings").upsert(
    { organization_id: orgId, category, value: wrap(value), updated_by: auth.user?.id ?? null },
    { onConflict: "organization_id,category" },
  );
  if (error) throw friendly(error, "Unable to save the settings.");
}

/** Back to the defaults: the stored row is removed, so the defaults apply again. */
export async function resetOrgCategory(orgId: string, category: CategoryId): Promise<void> {
  if (!STORED.has(category)) return;
  const { error } = await supabase.from("organization_settings").delete().eq("organization_id", orgId).eq("category", category);
  if (error) throw friendly(error, "Unable to reset the settings.");
}

export async function loadPreferences(defaults: UserPreferences): Promise<UserPreferences> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return defaults;
  const { data, error } = await supabase.from("user_preferences").select("*").eq("user_id", auth.user.id).maybeSingle();
  if (error || !data) return defaults;
  return {
    theme: defaults.theme, // the theme always reflects what the app currently shows
    landingPage: data.landing_page ?? defaults.landingPage, language: data.language ?? defaults.language, tableDensity: data.table_density ?? defaults.tableDensity,
    notifications: { ...defaults.notifications, ...(data.notifications ?? {}) }, widgets: { ...defaults.widgets, ...(data.widgets ?? {}) }, reduceMotion: data.reduce_motion ?? defaults.reduceMotion,
  };
}

export async function savePreferences(value: UserPreferences): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Sign in again to save your preferences.");
  const { error } = await supabase.from("user_preferences").upsert({
    user_id: auth.user.id, theme: value.theme, landing_page: value.landingPage, language: value.language, table_density: value.tableDensity, notifications: value.notifications,
    widgets: value.widgets, reduce_motion: value.reduceMotion,
  }, { onConflict: "user_id" });
  if (error) throw friendly(error, "Unable to save your preferences.");
}

export async function loadActivity(orgId: string): Promise<ActivityEvent[]> {
  const { data } = await supabase.from("activity_events").select("id, actor_display_name, occurred_at, related_record_label, description, metadata")
    .eq("organization_id", orgId).like("action", "settings.%").order("occurred_at", { ascending: false }).limit(250);
  // the audit trail may be hidden by Row-Level Security: that is an empty history, not a failure
  return (data ?? []).map((e: any): ActivityEvent => ({
    id: e.id, actor: e.actor_display_name, actorInitials: initialsOf(e.actor_display_name ?? ""), action: e.related_record_label || "Updated settings", detail: e.description || undefined, at: e.occurred_at,
    category: e.metadata?.category ?? undefined,
  }));
}

export async function recordActivity(orgId: string, event: ActivityEvent): Promise<void> {
  await supabase.rpc("record_activity", {
    p_org: orgId, p_action: "settings.updated", p_category: "Users & Security", p_description: event.detail ?? event.action, p_entity_type: "organization_settings",
    p_entity_id: event.category ?? "personal", p_label: event.action, p_metadata: { category: event.category ?? null }, p_source_module: "System Settings",
  });
}
