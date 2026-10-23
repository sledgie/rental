import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { isSupabaseConfigured } from "../../lib/supabase";
import { getActiveOrgId, subscribeActiveOrg } from "../../lib/activeOrg";
import * as repo from "../repo";
import { providers as catalogProviders, replaceCatalog } from "../data/catalog";
import { createInitialState } from "../data/sampleFinancials";
import type {
  Bill,
  BillCategory,
  PageId,
  ProviderPayment,
  RecurringSchedule,
  ReminderSettings,
  ServiceProvider,
  SupportingDocument,
  TenantAllocation,
  TenantRecovery,
} from "../types";
import { uid } from "../utils/format";

interface Toast {
  id: string;
  message: string;
  tone: "success" | "error" | "info";
}

interface AppContextValue {
  /** false while the first load from Supabase is running */
  ready: boolean;
  loadError: string | null;
  reload: () => Promise<void>;
  /** Adds a service provider (saved to the database when connected) and returns it. */
  addProvider: (input: { name: string; category: BillCategory }) => Promise<ServiceProvider>;
  page: PageId;
  setPage: (page: PageId) => void;
  bills: Bill[];
  schedules: RecurringSchedule[];
  payments: ProviderPayment[];
  recoveries: TenantRecovery[];
  reminderSettings: ReminderSettings;
  setReminderSettings: (s: ReminderSettings) => void;
  toasts: Toast[];
  pushToast: (message: string, tone?: Toast["tone"]) => void;
  dismissToast: (id: string) => void;
  addBill: (bill: Omit<Bill, "id" | "documents"> & { id?: string; documents?: SupportingDocument[]; files?: File[] }) => string;
  updateBill: (id: string, patch: Partial<Bill>) => void;
  deleteBill: (id: string) => void;
  addPayment: (payment: Omit<ProviderPayment, "id">) => void;
  addRecovery: (recovery: Omit<TenantRecovery, "id">) => void;
  updateAllocations: (billId: string, allocations: TenantAllocation[]) => void;
  addDocument: (billId: string, doc: Omit<SupportingDocument, "id" | "billId">, file?: File) => void;
  addSchedule: (schedule: Omit<RecurringSchedule, "id"> & { id?: string }) => string;
  updateSchedule: (id: string, patch: Partial<RecurringSchedule>) => void;
  setScheduleStatus: (id: string, status: RecurringSchedule["status"]) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

const defaultReminders: ReminderSettings = {
  daysBefore: [7, 3],
  notifyOnDueDate: true,
  notifyAfterIfUnpaid: true,
  dueSoonDays: 7,
};

export function AppProvider({ children }: { children: ReactNode }) {
  const initial = useMemo(() => (isSupabaseConfigured ? { bills: [], schedules: [], payments: [], recoveries: [] } : createInitialState()), []);
  const [ready, setReady] = useState(!isSupabaseConfigured);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [, setCatalogVersion] = useState(0); // the provider list is a shared array; bump this to re-render after it changes
  const orgId = useSyncExternalStore(subscribeActiveOrg, getActiveOrgId);
  const [page, setPage] = useState<PageId>("bills");
  const [bills, setBills] = useState<Bill[]>(initial.bills);
  const [schedules, setSchedules] = useState<RecurringSchedule[]>(initial.schedules);
  const [payments, setPayments] = useState<ProviderPayment[]>(initial.payments);
  const [recoveries, setRecoveries] = useState<TenantRecovery[]>(initial.recoveries);
  const [reminderSettings, setReminderSettings] = useState<ReminderSettings>(defaultReminders);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const pushToast = useCallback((message: string, tone: Toast["tone"] = "success") => {
    const id = uid("toast");
    setToasts((t) => [...t, { id, message, tone }]);
    window.setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, 3200);
  }, []);

  const reload = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    const org = getActiveOrgId();
    if (!org) return;
    try {
      const loaded = await repo.loadAll(org);
      if (getActiveOrgId() !== org) return; // the user switched organization meanwhile
      replaceCatalog(loaded.catalog); // the lists first, so the bills below never point at something missing
      setBills(loaded.state.bills);
      setSchedules(loaded.state.schedules);
      setPayments(loaded.state.payments);
      setRecoveries(loaded.state.recoveries);
      setLoadError(null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Unable to load bills.");
    } finally {
      if (getActiveOrgId() === org) setReady(true);
    }
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    setReady(false);
    if (orgId) void reload();
  }, [orgId, reload]);

  /** Runs a database write for a change already shown on screen; on failure it says why and shows what the database holds. */
  const sync = useCallback(
    (work: () => Promise<unknown>) => {
      if (!isSupabaseConfigured) return;
      work()
        .catch((error) => pushToast(error instanceof Error ? error.message : "The change could not be saved.", "error"))
        .finally(() => void reload());
    },
    [pushToast, reload],
  );

  const addProvider: AppContextValue["addProvider"] = useCallback(async (input) => {
    const provider: ServiceProvider = isSupabaseConfigured
      ? await repo.createProvider(input)
      : { id: uid("prov"), name: input.name.trim(), category: input.category, email: "", phone: "" };
    catalogProviders.push(provider);
    setCatalogVersion((v) => v + 1);
    return provider;
  }, []);

  const addBill: AppContextValue["addBill"] = useCallback((bill) => {
    const id = bill.id ?? `BILL-${new Date().getFullYear()}-${uid("B").slice(-4)}`;
    const { files, ...fields } = bill;
    sync(async () => {
      const number = await repo.createBill(fields);
      // the bill's attachment is stored once the bill exists
      for (const file of files ?? []) await repo.uploadBillDocument(number, file, "invoice");
    });
    setBills((prev) => [
      {
        ...bill,
        id,
        documents: (bill.documents ?? []).map((d) => ({ ...d, billId: id })),
      },
      ...prev,
    ]);
    return id;
  }, []);

  const updateBill = useCallback((id: string, patch: Partial<Bill>) => {
    sync(() => repo.updateBill(id, patch));
    setBills((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  }, []);

  const deleteBill = useCallback((id: string) => {
    sync(() => repo.cancelBill(id));
    setBills((prev) => prev.filter((b) => b.id !== id));
    setPayments((prev) => prev.filter((p) => p.billId !== id));
    setRecoveries((prev) => prev.filter((r) => r.billId !== id));
  }, []);

  const addPayment = useCallback((payment: Omit<ProviderPayment, "id">) => {
    sync(() => repo.addPayment(payment));
    setPayments((prev) => [{ ...payment, id: uid("PAY") }, ...prev]);
  }, []);

  const addRecovery = useCallback((recovery: Omit<TenantRecovery, "id">) => {
    sync(() => repo.addRecovery(recovery));
    setRecoveries((prev) => [{ ...recovery, id: uid("REC") }, ...prev]);
  }, []);

  const updateAllocations = useCallback((billId: string, allocations: TenantAllocation[]) => {
    sync(() => repo.replaceAllocations(billId, allocations));
    setBills((prev) => prev.map((b) => (b.id === billId ? { ...b, allocations } : b)));
  }, []);

  const addDocument = useCallback(
    (billId: string, doc: Omit<SupportingDocument, "id" | "billId">, file?: File) => {
      if (isSupabaseConfigured && file) sync(() => repo.uploadBillDocument(billId, file, doc.type));
      setBills((prev) =>
        prev.map((b) =>
          b.id === billId
            ? {
                ...b,
                documents: [
                  ...b.documents,
                  { ...doc, id: uid("DOC"), billId },
                ],
              }
            : b,
        ),
      );
    },
    [sync],
  );

  const addSchedule: AppContextValue["addSchedule"] = useCallback((schedule) => {
    const id = schedule.id ?? uid("SCH");
    sync(() => repo.createSchedule(schedule));
    setSchedules((prev) => [{ ...schedule, id }, ...prev]);
    return id;
  }, []);

  const updateSchedule = useCallback((id: string, patch: Partial<RecurringSchedule>) => {
    sync(() => repo.updateSchedule(id, patch));
    setSchedules((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }, []);

  const setScheduleStatus = useCallback((id: string, status: RecurringSchedule["status"]) => {
    sync(() => repo.updateSchedule(id, { status }));
    setSchedules((prev) => prev.map((s) => (s.id === id ? { ...s, status } : s)));
  }, []);

  const value = useMemo(
    () => ({
      ready,
      loadError,
      reload,
      addProvider,
      page,
      setPage,
      bills,
      schedules,
      payments,
      recoveries,
      reminderSettings,
      setReminderSettings,
      toasts,
      pushToast,
      dismissToast,
      addBill,
      updateBill,
      deleteBill,
      addPayment,
      addRecovery,
      updateAllocations,
      addDocument,
      addSchedule,
      updateSchedule,
      setScheduleStatus,
    }),
    [
      ready,
      loadError,
      reload,
      addProvider,
      page,
      bills,
      schedules,
      payments,
      recoveries,
      reminderSettings,
      toasts,
      pushToast,
      dismissToast,
      addBill,
      updateBill,
      deleteBill,
      addPayment,
      addRecovery,
      updateAllocations,
      addDocument,
      addSchedule,
      updateSchedule,
      setScheduleStatus,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
