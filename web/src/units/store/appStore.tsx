import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
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
  addUnit: (draft: Omit<Unit, "id" | "createdAt" | "updatedAt" | "archived">) => Unit;
  updateUnit: (id: string, patch: Partial<Unit>) => void;
  archiveUnit: (id: string) => void;
  restoreUnit: (id: string) => void;
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

export function StoreProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<Database>(initialDatabase);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(1);
  const bootTimer = useRef<number | undefined>(undefined);

  // Simulated first fetch so loading skeletons are exercised.
  useMemo(() => {
    if (bootTimer.current) return;
    bootTimer.current = window.setTimeout(() => setLoading(false), 620);
  }, []);

  const rows = useMemo(() => (loading ? [] : buildAllRows(db)), [db, loading]);
  const summary = useMemo(() => computeSummary(rows, db), [rows, db]);

  const pushToast = useCallback((t: Omit<Toast, "id">) => {
    const id = toastId.current++;
    setToasts((prev) => [...prev, { ...t, id }]);
    window.setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 4200);
  }, []);

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

  const updateUnit: StoreValue["updateUnit"] = useCallback((id, patch) => {
    setDb((prev) => ({
      ...prev,
      units: prev.units.map((u) => (u.id === id ? touch({ ...u, ...patch }) : u)),
    }));
  }, []);

  const archiveUnit: StoreValue["archiveUnit"] = useCallback((id) => {
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
  }, []);

  const restoreUnit: StoreValue["restoreUnit"] = useCallback((id) => {
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
  }, []);

  const refresh = useCallback(() => {
    setLoading(true);
    window.setTimeout(() => setLoading(false), 480);
  }, []);

  /* -------------------------- tenants & parties ------------------------- */

  const addTenant: StoreValue["addTenant"] = useCallback((draft) => {
    let created!: Tenant;
    setDb((prev) => {
      const nums = prev.tenants.map((t) => Number(t.id.replace(/\D/g, ""))).filter((n) => !Number.isNaN(n));
      const tenant: Tenant = {
        ...draft,
        id: `T-${(nums.length ? Math.max(...nums) : 100) + 1}`,
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
      const id = `LP-${prev.leaseParties.length + 100}`;
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
        id: `L-${prev.leases.length + 2800}`,
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
        id: `LU-${prev.leaseUnits.length + 100 + i}`,
        leaseId: lease.id,
        unitId,
        rentAllocation: draft.allocations[unitId] ?? null,
        occupancyStartDate: draft.startDate,
      }));
      const parties: LeaseParty[] = (draft.parties ?? []).map((p, i) => ({
        id: `LP-${prev.leaseParties.length + 100 + i}`,
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
