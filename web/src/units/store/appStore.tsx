import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { isSupabaseConfigured } from "../../lib/supabase";
import { getActiveOrgId, subscribeActiveOrg } from "../../lib/activeOrg";
import * as repo from "../repo";
import { initialDatabase, TODAY } from "../data/mockData";
import {
  buildAllRows,
  computeSummary,
  nextUnitId,
  type PortfolioSummary,
  type UnitRow,
} from "../data/selectors";
import type {
  ActivityKind,
  Database,
  Lease,
  LeaseParty,
  LeaseUnit,
  MaintenanceRequest,
  PartyRole,
  Property,
  Tenant,
  Unit,
} from "../data/types";
import { isoDate } from "../lib/format";
import { nextLeaseNumber } from "../data/selectors";

export interface Toast {
  id: number;
  tone: "jade" | "azure" | "amber" | "rose";
  title: string;
  message?: string;
}

interface StoreValue {
  db: Database;
  rows: UnitRow[];
  summary: PortfolioSummary;
  loading: boolean;
  refresh: () => void;
  /** With Supabase these resolve after the database accepted the change and reject with a readable Error otherwise. */
  addUnit: (draft: Omit<Unit, "id" | "code" | "createdAt" | "updatedAt" | "archived">) => Unit | Promise<Unit>;
  /** `localOnly` skips the database (used for changes whose source record, e.g. a lease, is not persisted yet). */
  updateUnit: (id: string, patch: Partial<Unit>, opts?: { localOnly?: boolean }) => void | Promise<void>;
  /** Resolve to false when the change failed (a toast has already explained why). */
  archiveUnit: (id: string) => boolean | Promise<boolean>;
  restoreUnit: (id: string) => boolean | Promise<boolean>;
  addTenant: (draft: Pick<Tenant, "firstName" | "lastName" | "email" | "phone" | "occupation">) => Tenant;
  addProperty: (draft: {
    propertyName: string;
    address: string;
    city: string;
    postalCode: string;
    manager: string;
  }) => Property;
  linkParty: (p: {
    leaseId: string;
    tenantId: string;
    role: PartyRole;
    isSignatory: boolean;
    startDate: string;
    unitId: string;
  }) => void;
  unlinkParty: (partyId: string, unitId: string) => void;
  updateParty: (partyId: string, patch: Partial<Pick<LeaseParty, "role" | "isSignatory">>) => void;
  createLease: (draft: {
    unitIds: string[];
    allocations: Record<string, number>;
    startDate: string;
    endDate: string;
    leaseStatus: Lease["leaseStatus"];
    totalContractRent: number;
    rentDueDay: number;
    securityDeposit: number;
    parties?: Array<{ tenantId: string; role: PartyRole; isSignatory: boolean }>;
  }) => Lease;
  updateLease: (id: string, patch: Partial<Lease>) => void;
  updateLeaseUnit: (linkId: string, patch: Partial<Omit<LeaseUnit, "id">>) => void;
  updateMaintenance: (id: string, patch: Partial<Omit<MaintenanceRequest, "id">>) => void;
  log: (unitId: string, kind: ActivityKind, message: string) => void;
  toasts: Toast[];
  pushToast: (t: Omit<Toast, "id">) => void;
  dismissToast: (id: number) => void;
}

const StoreContext = createContext<StoreValue | null>(null);

// With Supabase only properties and units come from the database; tenants, leases, finance and the rest stay empty until
// those features are wired, so nothing from the demo dataset leaks into a real organization.
const emptyDatabase: Database = {
  properties: [],
  units: [],
  tenants: [],
  leases: [],
  leaseUnits: [],
  leaseParties: [],
  transactions: [],
  maintenance: [],
  projects: [],
  documents: [],
  activity: [],
};

// With Supabase the ids become database primary keys, so they must be real UUIDs.
const newId = (demoId: string) => (isSupabaseConfigured ? crypto.randomUUID() : demoId);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [db, setDbState] = useState<Database>(isSupabaseConfigured ? emptyDatabase : initialDatabase);
  const dbRef = useRef(db);
  const syncQueue = useRef<Promise<void>>(Promise.resolve());
  const syncGeneration = useRef(0);

  /** Replaces the whole database without saving it (used for what was just loaded from Supabase). */
  const replaceDb = useCallback((next: Database) => {
    dbRef.current = next;
    setDbState(next);
  }, []);

  /**
   * Every change goes through here. With Supabase, tenant / lease / lease-link / unit-activity changes are also written to the database by
   * comparing the old and the new state; a failed save is reported and the real data is reloaded.
   */
  const setDb = useCallback((updater: Database | ((prev: Database) => Database)) => {
    const prev = dbRef.current;
    const next = typeof updater === "function" ? updater(prev) : updater;
    dbRef.current = next;
    setDbState(next);
    if (!isSupabaseConfigured || !repo.rentalsChanged(prev, next)) return;
    const generation = syncGeneration.current;
    syncQueue.current = syncQueue.current.then(async () => {
      if (generation !== syncGeneration.current) return;
      try {
        const numbers = await repo.persistRentals(prev, next);
        if (numbers.size) {
          // show the lease numbers the database assigned instead of the provisional ones
          const current = dbRef.current;
          replaceDb({ ...current, leases: current.leases.map((l) => (numbers.has(l.id) ? { ...l, leaseNumber: numbers.get(l.id)! } : l)) });
        }
      } catch (error) {
        pushToastRef.current?.({ tone: "rose", title: "The change was not saved", message: error instanceof Error ? error.message : "Please try again." });
        void reloadRef.current?.();
      }
    });
  }, [replaceDb]);
  const reloadRef = useRef<(() => Promise<void>) | null>(null);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(1);
  const bootTimer = useRef<number | undefined>(undefined);
  const pushToastRef = useRef<((t: Omit<Toast, "id">) => void) | null>(null);
  const orgId = useSyncExternalStore(subscribeActiveOrg, getActiveOrgId);

  // Demo mode: simulated first fetch so loading skeletons are exercised.
  useMemo(() => {
    if (isSupabaseConfigured || bootTimer.current) return;
    bootTimer.current = window.setTimeout(() => setLoading(false), 620);
  }, []);

  const load = useCallback(async () => {
    const org = getActiveOrgId();
    if (!org) return;
    setLoading(true);
    try {
      const loaded = await repo.loadAll(org);
      if (getActiveOrgId() !== org) return; // the user switched organization meanwhile
      syncGeneration.current += 1; // saves queued before this load are stale
      replaceDb({ ...dbRef.current, ...loaded });
    } catch (error) {
      pushToastRef.current?.({ tone: "rose", title: "Could not load units", message: error instanceof Error ? error.message : "Please try again." });
    } finally {
      if (getActiveOrgId() === org) setLoading(false);
    }
  }, [replaceDb]);
  reloadRef.current = load;

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    if (!orgId) {
      replaceDb(emptyDatabase);
      setLoading(true);
      return;
    }
    void load();
  }, [orgId, load, replaceDb]);

  const rows = useMemo(() => (loading ? [] : buildAllRows(db)), [db, loading]);
  const summary = useMemo(() => computeSummary(rows, db), [rows, db]);

  const pushToast = useCallback((t: Omit<Toast, "id">) => {
    const id = toastId.current++;
    setToasts((prev) => [...prev, { ...t, id }]);
    window.setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 4200);
  }, []);

  pushToastRef.current = pushToast;

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const log = useCallback((unitId: string, kind: ActivityKind, message: string) => {
    setDb((prev) => ({
      ...prev,
      activity: [
        {
          id: `AC-${prev.activity.length + 100}`,
          unitId,
          kind,
          message,
          actor: "You",
          at: new Date().toISOString(),
        },
        ...prev.activity,
      ],
    }));
  }, []);

  const touch = (u: Unit): Unit => ({ ...u, updatedAt: isoDate(TODAY) });

  const addUnit: StoreValue["addUnit"] = useCallback(
    (draft) => {
      if (isSupabaseConfigured) {
        return repo.insertUnit(draft).then((unit) => {
          setDb((prev) => ({
            ...prev,
            units: [...prev.units, unit],
            activity: [
              { id: `AC-${prev.activity.length + 100}`, unitId: unit.id, kind: "record", message: `Unit ${unit.unitNumber} created — no lease or tenant assigned`, actor: "You", at: new Date().toISOString() },
              ...prev.activity,
            ],
          }));
          return unit;
        });
      }
      const id = nextUnitId(db, draft.propertyId);
      const unit: Unit = {
        ...draft,
        id,
        archived: false,
        createdAt: new Date().toISOString(),
        updatedAt: isoDate(TODAY),
      };
      setDb((prev) => ({
        ...prev,
        units: [...prev.units, unit],
        activity: [
          {
            id: `AC-${prev.activity.length + 100}`,
            unitId: id,
            kind: "record",
            message: `Unit ${unit.unitNumber} created — no lease or tenant assigned`,
            actor: "You",
            at: new Date().toISOString(),
          },
          ...prev.activity,
        ],
      }));
      return unit;
    },
    [db],
  );

  const updateUnit: StoreValue["updateUnit"] = useCallback((id, patch, opts) => {
    if (isSupabaseConfigured && !opts?.localOnly) {
      const current = dbRef.current.units.find((u) => u.id === id);
      return repo.updateUnit(id, patch, current).then((saved) => {
        setDb((prev) => ({ ...prev, units: prev.units.map((u) => (u.id === id ? saved : u)) }));
      });
    }
    setDb((prev) => ({
      ...prev,
      units: prev.units.map((u) => (u.id === id ? touch({ ...u, ...patch }) : u)),
    }));
  }, []);

  const archiveUnit: StoreValue["archiveUnit"] = useCallback((id) => {
    if (isSupabaseConfigured) {
      return repo
        .updateUnit(id, { archived: true })
        .then((saved) => {
          setDb((prev) => ({ ...prev, units: prev.units.map((u) => (u.id === id ? saved : u)) }));
          return true;
        })
        .catch((error) => {
          pushToast({ tone: "rose", title: "The unit was not archived", message: error instanceof Error ? error.message : "Please try again." });
          return false;
        });
    }
    setDb((prev) => ({
      ...prev,
      units: prev.units.map((u) => (u.id === id ? touch({ ...u, archived: true }) : u)),
      activity: [
        {
          id: `AC-${prev.activity.length + 100}`,
          unitId: id,
          kind: "record",
          message: "Unit archived — leases, transactions and maintenance history preserved",
          actor: "You",
          at: new Date().toISOString(),
        },
        ...prev.activity,
      ],
    }));
    return true;
  }, [pushToast]);

  const restoreUnit: StoreValue["restoreUnit"] = useCallback((id) => {
    if (isSupabaseConfigured) {
      return repo
        .updateUnit(id, { archived: false })
        .then((saved) => {
          setDb((prev) => ({ ...prev, units: prev.units.map((u) => (u.id === id ? saved : u)) }));
          return true;
        })
        .catch((error) => {
          pushToast({ tone: "rose", title: "The unit was not restored", message: error instanceof Error ? error.message : "Please try again." });
          return false;
        });
    }
    setDb((prev) => ({
      ...prev,
      units: prev.units.map((u) => (u.id === id ? touch({ ...u, archived: false }) : u)),
      activity: [
        {
          id: `AC-${prev.activity.length + 100}`,
          unitId: id,
          kind: "record",
          message: "Unit restored to the active register",
          actor: "You",
          at: new Date().toISOString(),
        },
        ...prev.activity,
      ],
    }));
    return true;
  }, [pushToast]);

  const refresh = useCallback(() => {
    if (isSupabaseConfigured) {
      void load();
      return;
    }
    setLoading(true);
    window.setTimeout(() => setLoading(false), 480);
  }, [load]);

  /* -------------------------- tenants & parties ------------------------- */

  const addTenant: StoreValue["addTenant"] = useCallback((draft) => {
    let created!: Tenant;
    setDb((prev) => {
      const nums = prev.tenants.map((t) => Number(t.id.replace(/\D/g, ""))).filter((n) => !Number.isNaN(n));
      const tenant: Tenant = {
        ...draft,
        id: newId(`T-${(nums.length ? Math.max(...nums) : 100) + 1}`),
        tenantSince: isoDate(TODAY),
        avatarHue: (draft.firstName.charCodeAt(0) * 7 + draft.lastName.charCodeAt(0) * 13) % 360,
      };
      created = tenant;
      return { ...prev, tenants: [...prev.tenants, tenant] };
    });
    return created;
  }, []);

  const addProperty: StoreValue["addProperty"] = useCallback((draft) => {
    let created!: Property;
    setDb((prev) => {
      const nums = prev.properties.map((p) => Number(p.id.replace(/\D/g, ""))).filter((n) => !Number.isNaN(n));
      const property: Property = {
        id: `P-${`${(nums.length ? Math.max(...nums) : 0) + 1}`.padStart(2, "0")}`,
        propertyName: draft.propertyName,
        address: draft.address,
        city: draft.city,
        province: "ON",
        postalCode: draft.postalCode || "—",
        propertyType: "Apartment Building",
        yearBuilt: new Date().getFullYear(),
        manager: draft.manager,
      };
      created = property;
      return { ...prev, properties: [...prev.properties, property] };
    });
    return created;
  }, []);

  const linkParty: StoreValue["linkParty"] = useCallback(({ leaseId, tenantId, role, isSignatory, startDate, unitId }) => {
    setDb((prev) => {
      const id = newId(`LP-${prev.leaseParties.length + 100}`);
      const party: LeaseParty = {
        id,
        leaseId,
        tenantId,
        role,
        isSignatory,
        effectiveStartDate: startDate,
        effectiveEndDate: null,
      };
      const name = (() => {
        const t = prev.tenants.find((x) => x.id === tenantId);
        return t ? `${t.firstName} ${t.lastName}` : tenantId;
      })();
      const lease = prev.leases.find((l) => l.id === leaseId);
      return {
        ...prev,
        leaseParties: [...prev.leaseParties, party],
        activity: [
          {
            id: `AC-${prev.activity.length + 200}`,
            unitId,
            kind: "tenant",
            message: `${name} associated as ${role}${isSignatory ? " (signatory)" : " (non-signatory)"} on ${lease?.leaseNumber ?? leaseId}`,
            actor: "You",
            at: new Date().toISOString(),
          },
          ...prev.activity,
        ],
      };
    });
  }, []);

  const unlinkParty: StoreValue["unlinkParty"] = useCallback((partyId, unitId) => {
    setDb((prev) => ({
      ...prev,
      leaseParties: prev.leaseParties.map((p) =>
        p.id === partyId ? { ...p, effectiveEndDate: isoDate(TODAY) } : p,
      ),
      activity: [
        {
          id: `AC-${prev.activity.length + 200}`,
          unitId,
          kind: "tenant",
          message: "Lease party association ended",
          actor: "You",
          at: new Date().toISOString(),
        },
        ...prev.activity,
      ],
    }));
  }, []);

  const updateParty: StoreValue["updateParty"] = useCallback((partyId, patch) => {
    setDb((prev) => ({
      ...prev,
      leaseParties: prev.leaseParties.map((p) => (p.id === partyId ? { ...p, ...patch } : p)),
    }));
  }, []);

  /* -------------------------------- leases ------------------------------ */

  const createLease: StoreValue["createLease"] = useCallback((draft) => {
    let created!: Lease;
    setDb((prev) => {
      const lease: Lease = {
        id: newId(`L-${prev.leases.length + 2800}`),
        leaseNumber: nextLeaseNumber(prev),
        startDate: draft.startDate,
        endDate: draft.endDate,
        leaseStatus: draft.leaseStatus,
        totalContractRent: draft.totalContractRent,
        rentDueDay: draft.rentDueDay,
        securityDeposit: draft.securityDeposit,
        renewalTerms: "To be confirmed",
        documentReferences: [],
      };
      created = lease;
      const links: LeaseUnit[] = draft.unitIds.map((unitId, i) => ({
        id: newId(`LU-${prev.leaseUnits.length + 100 + i}`),
        leaseId: lease.id,
        unitId,
        rentAllocation: draft.allocations[unitId] ?? null,
        occupancyStartDate: draft.startDate,
      }));
      const parties: LeaseParty[] = (draft.parties ?? []).map((p, i) => ({
        id: newId(`LP-${prev.leaseParties.length + 100 + i}`),
        leaseId: lease.id,
        tenantId: p.tenantId,
        role: p.role,
        isSignatory: p.isSignatory,
        effectiveStartDate: draft.startDate,
        effectiveEndDate: null,
      }));
      const unitId = draft.unitIds[0];
      return {
        ...prev,
        leases: [...prev.leases, lease],
        leaseUnits: [...prev.leaseUnits, ...links],
        leaseParties: [...prev.leaseParties, ...parties],
        activity: [
          {
            id: `AC-${prev.activity.length + 200}`,
            unitId,
            kind: "lease",
            message: `Lease ${lease.leaseNumber} created (${draft.leaseStatus}) covering ${draft.unitIds.length} unit${draft.unitIds.length > 1 ? "s" : ""}`,
            actor: "You",
            at: new Date().toISOString(),
          },
          ...prev.activity,
        ],
      };
    });
    return created;
  }, []);

  const updateLease: StoreValue["updateLease"] = useCallback((id, patch) => {
    setDb((prev) => ({
      ...prev,
      leases: prev.leases.map((l) => (l.id === id ? { ...l, ...patch } : l)),
    }));
  }, []);

  const updateLeaseUnit: StoreValue["updateLeaseUnit"] = useCallback((linkId, patch) => {
    setDb((prev) => ({
      ...prev,
      leaseUnits: prev.leaseUnits.map((lu) => (lu.id === linkId ? { ...lu, ...patch } : lu)),
    }));
  }, []);

  const updateMaintenance: StoreValue["updateMaintenance"] = useCallback((id, patch) => {
    setDb((prev) => ({
      ...prev,
      maintenance: prev.maintenance.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    }));
  }, []);

  const value: StoreValue = {
    db,
    rows,
    summary,
    loading,
    refresh,
    addUnit,
    updateUnit,
    archiveUnit,
    restoreUnit,
    addTenant,
    addProperty,
    linkParty,
    unlinkParty,
    updateParty,
    createLease,
    updateLease,
    updateLeaseUnit,
    updateMaintenance,
    log,
    toasts,
    pushToast,
    dismissToast,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside <StoreProvider>");
  return ctx;
}
