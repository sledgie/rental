// Property list shared by every page. With Supabase configured it is loaded from the database for the active organization and
// reloaded after each save; without it, it is an in-memory demo list that resets on a browser refresh.
import { useSyncExternalStore } from "react";
import { properties as seed, type Property } from "./data/properties";
import type { PropertyRecord } from "./add/types/property";
import { isSupabaseConfigured } from "../lib/supabase";
import { getActiveOrgId, subscribeActiveOrg } from "../lib/activeOrg";
import * as repo from "./repo";

let list: Property[] = isSupabaseConfigured ? [] : [...seed];
// full add/edit-form record per property code (demo properties have none until they are edited)
let records = new Map<string, PropertyRecord>();
export const getRecord = (code: string) => records.get(code);
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

type Status = { ready: boolean; error: string | null };
let status: Status = { ready: !isSupabaseConfigured, error: null };
const setStatus = (next: Status) => {
  status = next;
  emit();
};

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

export const useProperties = () => useSyncExternalStore(subscribe, () => list);
/** `ready` is false while the first load for the active organization is running. */
export const usePropertiesStatus = () => useSyncExternalStore(subscribe, () => status);

export async function reloadProperties(silent = false) {
  const org = getActiveOrgId();
  if (!isSupabaseConfigured) return;
  if (!org) {
    list = [];
    records = new Map();
    setStatus({ ready: false, error: null });
    return;
  }
  if (!silent) setStatus({ ready: false, error: null });
  try {
    const loaded = await repo.loadAll(org);
    if (getActiveOrgId() !== org) return; // the user switched organization meanwhile
    list = loaded.properties;
    records = loaded.records;
    setStatus({ ready: true, error: null });
  } catch (error) {
    if (getActiveOrgId() !== org) return;
    setStatus({ ready: true, error: error instanceof Error ? error.message : "Unable to load properties." });
  }
}

if (isSupabaseConfigured) {
  subscribeActiveOrg(() => void reloadProperties());
  void reloadProperties();
}

export const nextPropertyCode = () => {
  // the database assigns the real code (PR-0001, ...) when the property is inserted
  if (isSupabaseConfigured) return "PR-NEW";
  const nums = list.map((p) => Number(p.code.split("-").pop())).filter(Number.isFinite);
  return `PR-${(nums.length ? Math.max(...nums) : 1000) + 1}`;
};

/**
 * Adds a property, or replaces the one whose code matches. Demo mode is synchronous; with Supabase it resolves with the
 * saved property's code once the database has accepted it, and rejects with a readable message otherwise.
 */
export function saveProperty(p: Property, record?: PropertyRecord): Promise<string> | void {
  if (isSupabaseConfigured) {
    if (!record) return Promise.reject(new Error("Nothing to save."));
    return repo.save(record).then(async (code) => {
      await reloadProperties(true);
      return code;
    });
  }
  if (record) records.set(p.code, record);
  list = list.some((x) => x.code === p.code) ? list.map((x) => (x.code === p.code ? p : x)) : [...list, p];
  emit();
}

export function resetProperties() {
  list = isSupabaseConfigured ? [] : [...seed];
  records.clear();
  emit();
}
