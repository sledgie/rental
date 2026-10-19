// Demo tenant database (in memory). Module-level so the top-bar search and the Tenants page share it and it survives page changes.
import { useSyncExternalStore } from "react";
import type { Database } from "./types";
import { createMockDatabase } from "./data/mockData";
import { DEFAULT_WARNING_DAYS, filterTenants } from "./lib/domain";

const listeners = new Set<() => void>();
let db: Database = createMockDatabase();
let warningDays = DEFAULT_WARNING_DAYS;
export const getWarningDays = () => warningDays;
export const setWarningDays = (days: number) => {
  warningDays = days;
  listeners.forEach((l) => l());
};
export const useWarningDays = () =>
  useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => warningDays,
  );

export function useTenantDb(): [Database, (next: Database) => void] {
  const value = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => db,
  );
  return [
    value,
    (next) => {
      db = next;
      listeners.forEach((l) => l());
    },
  ];
}

/** Tenants matching a name, tenant id, phone, email, property or unit (used by the top-bar search). */
export const searchTenants = (database: Database, search: string) =>
  filterTenants(database, {
    search, status: "All Tenants", outstanding: false, expiring: false, includeArchived: false,
    propertyId: "", sort: "default", descending: false, warningDays: DEFAULT_WARNING_DAYS,
  });
