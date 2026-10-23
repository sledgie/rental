// Lease data shared by the Leases page and the Dashboard. Module-level so it survives page changes.
// Demo mode: an in-memory sample. With Supabase: loaded for the active organization, and every change the page makes is saved by
// comparing the old and the new data (see ./repo.ts). A failed save is reported and the data is reloaded.
import { useSyncExternalStore } from "react";
import { createInitialData, type LeaseData } from "./leaseData";
import { isSupabaseConfigured } from "../lib/supabase";
import { getActiveOrgId, subscribeActiveOrg } from "../lib/activeOrg";
import * as repo from "./repo";

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

let db: LeaseData = isSupabaseConfigured ? repo.emptyLeaseData() : createInitialData();
let status = { ready: !isSupabaseConfigured, error: null as string | null };
const setStatus = (next: typeof status) => {
  status = next;
  emit();
};

const errorListeners = new Set<(message: string) => void>();
/** Registers a handler that is told when saving a change to the database failed. Returns the unsubscribe function. */
export const onLeaseSyncError = (cb: (message: string) => void) => {
  errorListeners.add(cb);
  return () => errorListeners.delete(cb);
};

let generation = 0; // bumped by every reload: saves queued before it are stale and must not run
let queue: Promise<void> = Promise.resolve();

export async function reloadLeaseData(silent = false) {
  if (!isSupabaseConfigured) return;
  const org = getActiveOrgId();
  const gen = ++generation;
  if (!org) {
    db = repo.emptyLeaseData();
    return setStatus({ ready: false, error: null });
  }
  if (!silent) setStatus({ ready: false, error: null });
  try {
    const loaded = await repo.loadLeaseData(org);
    if (gen !== generation || getActiveOrgId() !== org) return;
    db = loaded;
    setStatus({ ready: true, error: null });
  } catch (error) {
    if (gen !== generation) return;
    setStatus({ ready: true, error: error instanceof Error ? error.message : "Unable to load leases." });
  }
}

function applyServerNumbers(rec: repo.Reconciliation) {
  if (!rec.leaseNumbers.size) return;
  db = { ...db, leases: db.leases.map((l) => (rec.leaseNumbers.has(l.id) ? { ...l, leaseNumber: rec.leaseNumbers.get(l.id)! } : l)) };
  emit();
}

function save(prev: LeaseData, next: LeaseData) {
  const gen = generation;
  queue = queue.then(async () => {
    if (gen !== generation) return;
    try {
      applyServerNumbers(await repo.persist(prev, next));
    } catch (error) {
      const message = error instanceof Error ? error.message : "The change could not be saved.";
      errorListeners.forEach((cb) => cb(message));
      await reloadLeaseData(true); // show what the database really contains
    }
  });
}

if (isSupabaseConfigured) {
  subscribeActiveOrg(() => void reloadLeaseData());
  void reloadLeaseData();
}

export const useLeaseDataStatus = () => useSyncExternalStore(subscribe, () => status);

const setLeaseData = (next: LeaseData | ((current: LeaseData) => LeaseData)) => {
  const prev = db;
  db = typeof next === "function" ? next(db) : next;
  emit();
  if (isSupabaseConfigured) save(prev, db);
};

export function useLeaseData(): [LeaseData, typeof setLeaseData] {
  const value = useSyncExternalStore(subscribe, () => db);
  return [value, setLeaseData];
}
