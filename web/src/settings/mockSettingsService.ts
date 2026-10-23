import type { ActivityEvent, CategoryId, OrgSettings, UserPreferences } from "./types";
import { clone } from "./utils";

const USER_KEY = "rentora.mock.user-preferences.v1";
const ORG_KEY = "rentora.mock.org-settings.v1";
const ACTIVITY_KEY = "rentora.mock.activity.v1";

function readStore<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return clone(fallback);
    return JSON.parse(raw) as T;
  } catch {
    return clone(fallback);
  }
}

function writeStore(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Persistence is best-effort in this mock prototype.
  }
}

function mergeCategory(defaults: any, saved: any): any {
  if (Array.isArray(defaults) || typeof defaults !== "object" || defaults === null) {
    return saved === undefined ? clone(defaults) : clone(saved);
  }
  if (typeof saved !== "object" || saved === null || Array.isArray(saved)) return clone(defaults);
  return { ...clone(defaults), ...clone(saved) };
}

export function mergeWithDefaults(defaults: OrgSettings, saved: Partial<OrgSettings> | null): OrgSettings {
  const result: OrgSettings = {};
  Object.keys(defaults).forEach((category) => {
    result[category] = mergeCategory(defaults[category], saved?.[category]);
  });
  return result;
}

export function getOrganizationSettings(organizationId: string, defaults: OrgSettings): OrgSettings {
  const all = readStore<Record<string, OrgSettings>>(ORG_KEY, {});
  return mergeWithDefaults(defaults, all[organizationId] ?? null);
}

export function updateOrganizationSettings(
  organizationId: string,
  updates: Partial<OrgSettings>,
  defaults: OrgSettings,
): OrgSettings {
  const all = readStore<Record<string, OrgSettings>>(ORG_KEY, {});
  const existing = mergeWithDefaults(defaults, all[organizationId] ?? null);
  const merged = mergeWithDefaults(defaults, { ...existing, ...clone(updates) });
  all[organizationId] = merged;
  writeStore(ORG_KEY, all);
  return merged;
}

export function resetOrganizationCategory(
  organizationId: string,
  category: CategoryId,
  defaults: OrgSettings,
): OrgSettings {
  const all = readStore<Record<string, OrgSettings>>(ORG_KEY, {});
  const existing = mergeWithDefaults(defaults, all[organizationId] ?? null);
  existing[category] = clone(defaults[category]);
  all[organizationId] = existing;
  writeStore(ORG_KEY, all);
  return existing;
}

export function importOrganizationSettings(
  organizationId: string,
  imported: Partial<OrgSettings>,
  defaults: OrgSettings,
): OrgSettings {
  return updateOrganizationSettings(organizationId, imported, defaults);
}

export function getActivityLog(organizationId: string, seed: ActivityEvent[]): ActivityEvent[] {
  const all = readStore<Record<string, ActivityEvent[]>>(ACTIVITY_KEY, {});
  if (!all[organizationId]) {
    all[organizationId] = clone(seed);
    writeStore(ACTIVITY_KEY, all);
  }
  return all[organizationId];
}

export function appendActivityLog(
  organizationId: string,
  event: ActivityEvent,
  seed: ActivityEvent[],
): ActivityEvent[] {
  const all = readStore<Record<string, ActivityEvent[]>>(ACTIVITY_KEY, {});
  const existing = all[organizationId] ?? clone(seed);
  all[organizationId] = [event, ...existing].slice(0, 250);
  writeStore(ACTIVITY_KEY, all);
  return all[organizationId];
}

export function exportMockSettings(
  organizationId: string,
  organizationName: string,
  defaults: OrgSettings,
): Record<string, unknown> {
  return {
    exportType: "rentora.settings.prototype",
    version: 1,
    generatedAt: new Date().toISOString(),
    organizationId,
    organizationName,
    disclaimer: "Mock configuration exported from a frontend prototype. No live records or credentials are included.",
    settings: getOrganizationSettings(organizationId, defaults),
  };
}


/** Saved personal preferences for a user. The theme is not stored here: it always reflects the theme applied to the app. */
export function getUserPreferences(userId: string, defaults: UserPreferences): UserPreferences {
  const saved = readStore<Record<string, Partial<UserPreferences>>>(USER_KEY, {})[userId];
  return { ...clone(defaults), ...(saved ? clone(saved) : {}), theme: defaults.theme };
}

export function updateUserPreferences(userId: string, value: UserPreferences, defaults: UserPreferences): UserPreferences {
  const all = readStore<Record<string, Partial<UserPreferences>>>(USER_KEY, {});
  all[userId] = clone(value);
  writeStore(USER_KEY, all);
  return getUserPreferences(userId, defaults);
}

export function resetUserPreferences(userId: string, defaults: UserPreferences): UserPreferences {
  const all = readStore<Record<string, Partial<UserPreferences>>>(USER_KEY, {});
  delete all[userId];
  writeStore(USER_KEY, all);
  return clone(defaults);
}
