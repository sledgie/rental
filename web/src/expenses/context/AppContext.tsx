import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createInitialState } from "../data/sampleFinancials";
import type {
  Bill,
  PageId,
  ProviderPayment,
  RecurringSchedule,
  ReminderSettings,
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
  addBill: (bill: Omit<Bill, "id" | "documents"> & { id?: string; documents?: SupportingDocument[] }) => string;
  updateBill: (id: string, patch: Partial<Bill>) => void;
  deleteBill: (id: string) => void;
  addPayment: (payment: Omit<ProviderPayment, "id">) => void;
  addRecovery: (recovery: Omit<TenantRecovery, "id">) => void;
  updateAllocations: (billId: string, allocations: TenantAllocation[]) => void;
  addDocument: (billId: string, doc: Omit<SupportingDocument, "id" | "billId">) => void;
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
  const initial = useMemo(() => createInitialState(), []);
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

  const addBill: AppContextValue["addBill"] = useCallback((bill) => {
    const id = bill.id ?? `BILL-${new Date().getFullYear()}-${uid("B").slice(-4)}`;
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
    setBills((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  }, []);

  const deleteBill = useCallback((id: string) => {
    setBills((prev) => prev.filter((b) => b.id !== id));
    setPayments((prev) => prev.filter((p) => p.billId !== id));
    setRecoveries((prev) => prev.filter((r) => r.billId !== id));
  }, []);

  const addPayment = useCallback((payment: Omit<ProviderPayment, "id">) => {
    setPayments((prev) => [{ ...payment, id: uid("PAY") }, ...prev]);
  }, []);

  const addRecovery = useCallback((recovery: Omit<TenantRecovery, "id">) => {
    setRecoveries((prev) => [{ ...recovery, id: uid("REC") }, ...prev]);
  }, []);

  const updateAllocations = useCallback((billId: string, allocations: TenantAllocation[]) => {
    setBills((prev) => prev.map((b) => (b.id === billId ? { ...b, allocations } : b)));
  }, []);

  const addDocument = useCallback(
    (billId: string, doc: Omit<SupportingDocument, "id" | "billId">) => {
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
    [],
  );

  const addSchedule: AppContextValue["addSchedule"] = useCallback((schedule) => {
    const id = schedule.id ?? uid("SCH");
    setSchedules((prev) => [{ ...schedule, id }, ...prev]);
    return id;
  }, []);

  const updateSchedule = useCallback((id: string, patch: Partial<RecurringSchedule>) => {
    setSchedules((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }, []);

  const setScheduleStatus = useCallback((id: string, status: RecurringSchedule["status"]) => {
    setSchedules((prev) => prev.map((s) => (s.id === id ? { ...s, status } : s)));
  }, []);

  const value = useMemo(
    () => ({
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
