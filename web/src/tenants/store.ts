// Tenant database shared by the Tenants page, the dashboard and the top-bar search. Module-level so it survives page changes.
// Demo mode: an in-memory sample database. With Supabase: loaded for the active organization, and every change the page makes is
// saved by comparing the old and the new database (see ./repo.ts). A failed save is reported and the database is reloaded.
import { useEffect, useSyncExternalStore } from "react";
import type { Database } from "./types";
import { createMockDatabase } from "./data/mockData";
import { DEFAULT_WARNING_DAYS, filterTenants } from "./lib/domain";
import { isSupabaseConfigured } from "../lib/supabase";
import { getActiveOrgId, subscribeActiveOrg } from "../lib/activeOrg";
import * as repo from "./repo";

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

let db: Database = isSupabaseConfigured ? repo.emptyDatabase() : createMockDatabase();
let status = { ready: !isSupabaseConfigured, error: null as string | null };
const setStatus = (next: typeof status) => {
  status = next;
  emit();
};

let warningDays = DEFAULT_WARNING_DAYS;
export const getWarningDays = () => warningDays;
export const setWarningDays = (days: number) => {
  warningDays = days;
  emit();
};
export const useWarningDays = () => useSyncExternalStore(subscribe, () => warningDays);

// ------------------------------------------------------------------ Supabase sync
const errorListeners = new Set<(message: string) => void>();
/** Registers a handler that is told when saving a change to the database failed. Returns the unsubscribe function. */
export const onTenantSyncError = (cb: (message: string) => void) => {
  errorListeners.add(cb);
  return () => errorListeners.delete(cb);
};
/** Re-registers on every render of the component that calls it; use inside a component. */
export const useTenantSyncErrors = (cb: (message: string) => void) => {
  useEffect(() => onTenantSyncError(cb), [cb]);
};

let generation = 0; // bumped by every reload: saves queued before it are stale and must not run
let queue: Promise<void> = Promise.resolve();

export async function reloadTenantDb(silent = false) {
  if (!isSupabaseConfigured) return;
  const org = getActiveOrgId();
  const gen = ++generation;
  if (!org) {
    db = repo.emptyDatabase();
    return setStatus({ ready: false, error: null });
  }
  if (!silent) setStatus({ ready: false, error: null });
  try {
    const loaded = await repo.loadDatabase(org);
    if (gen !== generation || getActiveOrgId() !== org) return;
    db = loaded;
    setStatus({ ready: true, error: null });
  } catch (error) {
    if (gen !== generation) return;
    setStatus({ ready: true, error: error instanceof Error ? error.message : "Unable to load tenants." });
  }
}

function applyServerNumbers(rec: repo.Reconciliation) {
  if (!rec.tenantNumbers.size && !rec.leaseNumbers.size) return;
  const oldLeaseNumber = new Map(db.leases.map((l) => [l.id, l.leaseNumber]));
  db = {
    ...db,
    tenants: db.tenants.map((t) => (rec.tenantNumbers.has(t.id) ? { ...t, tenantNumber: rec.tenantNumbers.get(t.id)! } : t)),
    leases: db.leases.map((l) => (rec.leaseNumbers.has(l.id) ? { ...l, leaseNumber: rec.leaseNumbers.get(l.id)! } : l)),
    accounts: db.accounts.map((a) =>
      a.leaseId && rec.leaseNumbers.has(a.leaseId) && a.label === oldLeaseNumber.get(a.leaseId) ? { ...a, label: rec.leaseNumbers.get(a.leaseId)! } : a,
    ),
  };
  emit();
}

function save(prev: Database, next: Database) {
  const gen = generation;
  queue = queue.then(async () => {
    if (gen !== generation) return;
    try {
      applyServerNumbers(await repo.persist(prev, next));
    } catch (error) {
      const message = error instanceof Error ? error.message : "The change could not be saved.";
      errorListeners.forEach((cb) => cb(message));
      await reloadTenantDb(true); // show what the database really contains
    }
  });
}

if (isSupabaseConfigured) {
  subscribeActiveOrg(() => void reloadTenantDb());
  void reloadTenantDb();
}

/** Records a payment on an account and reloads the ledger. Rejects with a readable message when the database refuses it. */
export async function payAccount(accountId: string, amount: number, date: string, description: string) {
  const account = db.accounts.find((a) => a.id === accountId);
  if (!account) throw new Error("That account could not be found. Refresh the page and try again.");
  await repo.postAccountPayment(db, account, amount, date, description);
  await reloadTenantDb(true);
}

export const useTenantDbStatus = () => useSyncExternalStore(subscribe, () => status);

export function useTenantDb(): [Database, (next: Database) => void] {
  const value = useSyncExternalStore(subscribe, () => db);
  return [
    value,
    (next) => {
      const prev = db;
      db = next;
      emit();
      if (isSupabaseConfigured) save(prev, next);
    },
  ];
}

/** Tenants matching a name, tenant id, phone, email, property or unit (used by the top-bar search). */
export const searchTenants = (database: Database, search: string) =>
  filterTenants(database, {
    search, status: "All Tenants", outstanding: false, expiring: false, includeArchived: false,
    propertyId: "", sort: "default", descending: false, warningDays: DEFAULT_WARNING_DAYS,
  });
