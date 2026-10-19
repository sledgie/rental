// Owners list for the "Ownership & Management" section (demo data, in memory). Properties themselves live in ../../store.
import { useSyncExternalStore } from "react";
import type { Owner } from "../types/property";
import { INITIAL_OWNERS } from "../data/mockProperties";
import { nextPropertyCode } from "../../store";

let owners: Owner[] = [...INITIAL_OWNERS];
const listeners = new Set<() => void>();

export function useAppStore() {
  const list = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => owners,
  );
  return {
    owners: list,
    addOwner: (o: Owner) => {
      owners = [...owners, o];
      listeners.forEach((l) => l());
    },
    getOwner: (id: string) => list.find((o) => o.id === id),
  };
}

/** A property record's id doubles as the table's property code (PR-1043). */
export const generatePropertyId = () => nextPropertyCode();
