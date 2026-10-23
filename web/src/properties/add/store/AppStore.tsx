// Lists for the property form: owners, management companies and staff. Demo mode keeps them in memory; with Supabase they are loaded
// for the active organization and saved to the database. Properties themselves live in ../../store.
import { useSyncExternalStore } from "react";
import type { ManagementCompany, Owner, StaffMember, Vendor } from "../types/property";
import { INITIAL_OWNERS, MANAGEMENT_COMPANIES, STAFF, VENDORS } from "../data/mockProperties";
import { nextPropertyCode } from "../../store";
import { isSupabaseConfigured } from "../../../lib/supabase";
import { getActiveOrgId, subscribeActiveOrg } from "../../../lib/activeOrg";
import * as repo from "./refRepo";

type State = { owners: Owner[]; companies: ManagementCompany[]; staff: StaffMember[]; vendors: Vendor[] };

let state: State = isSupabaseConfigured
  ? { owners: [], companies: [], staff: [], vendors: [] }
  : { owners: [...INITIAL_OWNERS], companies: [...MANAGEMENT_COMPANIES], staff: [...STAFF], vendors: [...VENDORS] };
const listeners = new Set<() => void>();
const set = (next: State) => {
  state = next;
  listeners.forEach((l) => l());
};

export async function reloadRefData() {
  const org = getActiveOrgId();
  if (!isSupabaseConfigured) return;
  if (!org) return set({ owners: [], companies: [], staff: [], vendors: [] });
  try {
    const [owners, companies, staff, vendors] = await Promise.all([repo.loadOwners(org), repo.loadCompanies(org), repo.loadStaff(org), repo.loadVendors(org)]);
    if (getActiveOrgId() === org) set({ owners, companies, staff, vendors });
  } catch {
    // the form still works with empty lists; the Properties page shows its own load error
  }
}

if (isSupabaseConfigured) {
  subscribeActiveOrg(() => void reloadRefData());
  void reloadRefData();
}

const needOrg = () => {
  const org = getActiveOrgId();
  if (!org) throw new Error("Select an organization first.");
  return org;
};

export function useAppStore() {
  const snapshot = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
  );
  return {
    owners: snapshot.owners,
    managementCompanies: snapshot.companies,
    staff: snapshot.staff,
    vendors: snapshot.vendors,
    /** Demo mode returns the owner at once; with Supabase it resolves with the saved owner (real id). */
    addOwner: (o: Owner): Owner | Promise<Owner> => {
      if (isSupabaseConfigured) {
        return repo.insertOwner(needOrg(), o).then((saved) => {
          set({ ...state, owners: [...state.owners, saved].sort((a, b) => a.name.localeCompare(b.name)) });
          return saved;
        });
      }
      set({ ...state, owners: [...state.owners, o] });
      return o;
    },
    addManagementCompany: (name: string): ManagementCompany | Promise<ManagementCompany> => {
      if (isSupabaseConfigured) {
        return repo.insertCompany(needOrg(), name).then((saved) => {
          set({ ...state, companies: [...state.companies, saved].sort((a, b) => a.name.localeCompare(b.name)) });
          return saved;
        });
      }
      const company = { id: `mgc-${Date.now().toString(36)}`, name };
      set({ ...state, companies: [...state.companies, company] });
      return company;
    },
    getOwner: (id: string) => snapshot.owners.find((o) => o.id === id),
  };
}

/** A property record's id doubles as the table's property code (PR-1043). */
export const generatePropertyId = () => nextPropertyCode();
