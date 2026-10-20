// Demo lease data (in memory). Module-level so the Leases page and the Dashboard share it and it survives page changes.
import { useSyncExternalStore } from "react";
import { createInitialData, type LeaseData } from "./leaseData";

const listeners = new Set<() => void>();
let db: LeaseData = createInitialData();

const setLeaseData = (next: LeaseData | ((current: LeaseData) => LeaseData)) => {
  db = typeof next === "function" ? next(db) : next;
  listeners.forEach((l) => l());
};

export function useLeaseData(): [LeaseData, typeof setLeaseData] {
  const value = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => db,
  );
  return [value, setLeaseData];
}
