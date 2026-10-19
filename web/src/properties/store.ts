// In-memory (demo) property list. Lives at module level so added/edited properties survive moving between pages,
// and resets on a browser refresh. Nothing is sent to the server.
import { useSyncExternalStore } from "react";
import { properties as seed, type Property } from "./data/properties";
import type { PropertyRecord } from "./add/types/property";

let list: Property[] = [...seed];
// full add/edit-form record per property code (sample properties have none until they are edited)
const records = new Map<string, PropertyRecord>();
export const getRecord = (code: string) => records.get(code);
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const useProperties = () =>
  useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => list,
  );

export const nextPropertyCode = () => {
  const nums = list.map((p) => Number(p.code.split("-").pop())).filter(Number.isFinite);
  return `PR-${(nums.length ? Math.max(...nums) : 1000) + 1}`;
};

/** Adds a property, or replaces the one whose code matches. */
export function saveProperty(p: Property, record?: PropertyRecord) {
  if (record) records.set(p.code, record);
  list = list.some((x) => x.code === p.code) ? list.map((x) => (x.code === p.code ? p : x)) : [...list, p];
  emit();
}

export function resetProperties() {
  list = [...seed];
  records.clear();
  emit();
}
