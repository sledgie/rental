import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { buildSeed, CURRENT_USER } from './data';
import type {
  ActivityEvent, AppSettings, Asset, Attachment, Contractor, Estimate, Expense,
  Lease, MaintenanceRequest, PreventiveSchedule, Project, Property, RequestStatus,
  StaffMember, Tenant, Unit, Visit, WorkLogEntry, WorkOrder,
} from './types';
import { nextDueDate, nowISO, todayISO, uid } from './utils';

export type PageKey =
  | 'dashboard' | 'properties' | 'units' | 'tenants' | 'leases'
  | 'requests' | 'workorders' | 'assets' | 'preventive'
  | 'projects' | 'bills' | 'settings';

export interface Route {
  page: PageKey;
  focusRequestId?: string;
  focusAssetId?: string;
  searchQuery?: string;
  statusFilter?: string;
  nonce: number;
}

export interface Toast {
  id: string;
  message: string;
  kind: 'success' | 'info' | 'warning' | 'error';
}

interface Store {
  // data
  properties: Property[]; units: Unit[]; tenants: Tenant[]; leases: Lease[];
  staff: StaffMember[]; contractors: Contractor[]; requests: MaintenanceRequest[];
  estimates: Estimate[]; visits: Visit[]; workLogs: WorkLogEntry[]; workOrders: WorkOrder[];
  assets: Asset[]; expenses: Expense[]; schedules: PreventiveSchedule[];
  attachments: Attachment[]; activity: ActivityEvent[]; projects: Project[];
  settings: AppSettings; currentUser: StaffMember;
  route: Route; toasts: Toast[];
  // navigation / feedback
  navigate: (page: PageKey, opts?: Partial<Route>) => void;
  toast: (message: string, kind?: Toast['kind']) => void;
  dismissToast: (id: string) => void;
  // lookups
  getProperty: (id?: string) => Property | undefined;
  getUnit: (id?: string) => Unit | undefined;
  getTenant: (id?: string) => Tenant | undefined;
  getLease: (id?: string) => Lease | undefined;
  getContractor: (id?: string) => Contractor | undefined;
  getStaff: (id?: string) => StaffMember | undefined;
  getAsset: (id?: string) => Asset | undefined;
  getExpense: (id?: string) => Expense | undefined;
  unitsForProperty: (propertyId: string) => Unit[];
  leaseForUnit: (unitId?: string) => Lease | undefined;
  // derived maintenance data
  requestEstimates: (requestId: string) => Estimate[];
  requestVisits: (requestId: string) => Visit[];
  requestWorkLogs: (requestId: string) => WorkLogEntry[];
  requestWorkOrders: (requestId: string) => WorkOrder[];
  requestAttachments: (requestId: string) => Attachment[];
  requestActivity: (requestId: string) => ActivityEvent[];
  estimatedCost: (req: MaintenanceRequest) => number | null;
  actualCost: (req: MaintenanceRequest) => number;
  assetRequests: (assetId: string) => MaintenanceRequest[];
  assetRepairSpend: (assetId: string) => number;
  assetExpenses: (assetId: string) => Expense[];
  // id generators
  nextRequestId: () => string;
  nextAssetId: () => string;
  nextWorkOrderId: () => string;
  nextExpenseId: () => string;
  nextEstimateId: () => string;
  nextScheduleId: () => string;
  // actions
  logActivity: (requestId: string | undefined, type: string, description: string, assetId?: string) => void;
  addRequest: (req: MaintenanceRequest, activityNote?: string) => void;
  updateRequest: (id: string, patch: Partial<MaintenanceRequest>, activityDesc?: string, activityType?: string) => void;
  setRequestStatus: (id: string, status: RequestStatus, opts?: { reason?: string; extra?: Partial<MaintenanceRequest>; silent?: boolean }) => void;
  addEstimate: (est: Estimate, activityDesc?: string) => void;
  updateEstimate: (id: string, patch: Partial<Estimate>, activityDesc?: string) => void;
  addVisit: (v: Visit) => void;
  updateVisit: (id: string, patch: Partial<Visit>, activityDesc?: string) => void;
  addWorkLog: (wl: WorkLogEntry) => void;
  addAttachment: (att: Attachment) => void;
  removeAttachment: (id: string) => void;
  addWorkOrder: (wo: WorkOrder) => void;
  updateWorkOrder: (id: string, patch: Partial<WorkOrder>, activityDesc?: string) => void;
  addExpense: (exp: Expense) => void;
  updateExpense: (id: string, patch: Partial<Expense>) => void;
  linkExpense: (requestId: string, expenseId: string) => void;
  unlinkExpense: (requestId: string, expenseId: string) => void;
  addAsset: (a: Asset) => void;
  updateAsset: (id: string, patch: Partial<Asset>) => void;
  addContractor: (c: Contractor) => void;
  updateContractor: (id: string, patch: Partial<Contractor>) => void;
  addSchedule: (s: PreventiveSchedule) => void;
  updateSchedule: (id: string, patch: Partial<PreventiveSchedule>) => void;
  completeSchedule: (id: string) => void;
  updateSettings: (patch: Partial<AppSettings>) => void;
}

const ROUTES: Partial<Record<PageKey, string>> = {
  requests: 'maintenance-requests', workorders: 'work-orders', assets: 'assets', preventive: 'inspections', bills: 'expenses', projects: 'projects',
};

const StoreContext = createContext<Store | null>(null);

export function useStore(): Store {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside StoreProvider');
  return ctx;
}

function nextSeq(ids: string[], segment: number): number {
  let max = 0;
  for (const id of ids) {
    const parts = id.split('-');
    const n = parseInt(parts[segment] ?? '', 10);
    if (!Number.isNaN(n) && n > max) max = n;
  }
  return max + 1;
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [seed] = useState(buildSeed);
  const [requests, setRequests] = useState(seed.requests);
  const [estimates, setEstimates] = useState(seed.estimates);
  const [visits, setVisits] = useState(seed.visits);
  const [workLogs, setWorkLogs] = useState(seed.workLogs);
  const [workOrders, setWorkOrders] = useState(seed.workOrders);
  const [assets, setAssets] = useState(seed.assets);
  const [expenses, setExpenses] = useState(seed.expenses);
  const [schedules, setSchedules] = useState(seed.schedules);
  const [attachments, setAttachments] = useState(seed.attachments);
  const [activity, setActivity] = useState(seed.activity);
  const [contractors, setContractors] = useState(seed.contractors);
  const [settings, setSettings] = useState(seed.settings);
  const route: Route = useMemo(() => ({ page: 'requests', nonce: 0 }), []);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, kind: Toast['kind'] = 'success') => {
    const id = uid('T');
    setToasts((t) => [...t.slice(-3), { id, message, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  // Cross-links between the maintenance pages are hash routes in the host app (#/maintenance-requests?request=MR-1001 ...)
  const navigate = useCallback((page: PageKey, opts?: Partial<Route>) => {
    const target = ROUTES[page] ?? page;
    const q = new URLSearchParams();
    if (opts?.focusRequestId) q.set('request', opts.focusRequestId);
    if (opts?.focusAssetId) q.set('asset', opts.focusAssetId);
    if (opts?.searchQuery) q.set('q', opts.searchQuery);
    if (opts?.statusFilter) q.set('status', opts.statusFilter);
    const qs = q.toString();
    window.location.hash = `#/${target}${qs ? `?${qs}` : ''}`;
  }, []);

  const logActivity = useCallback(
    (requestId: string | undefined, type: string, description: string, assetId?: string) => {
      setActivity((a) => [
        ...a,
        { id: uid('AC'), requestId, assetId, type, description, user: CURRENT_USER.name, timestamp: nowISO() },
      ]);
    },
    []
  );

  // ── lookups ──────────────────────────────────────────────────────────────
  const getProperty = useCallback((id?: string) => seed.properties.find((p) => p.id === id), [seed]);
  const getUnit = useCallback((id?: string) => seed.units.find((u) => u.id === id), [seed]);
  const getTenant = useCallback((id?: string) => seed.tenants.find((t) => t.id === id), [seed]);
  const getLease = useCallback((id?: string) => seed.leases.find((l) => l.id === id), [seed]);
  const getContractor = useCallback((id?: string) => contractors.find((c) => c.id === id), [contractors]);
  const getStaff = useCallback((id?: string) => seed.staff.find((s) => s.id === id), [seed]);
  const getAsset = useCallback((id?: string) => assets.find((a) => a.id === id), [assets]);
  const getExpense = useCallback((id?: string) => expenses.find((e) => e.id === id), [expenses]);
  const unitsForProperty = useCallback((pid: string) => seed.units.filter((u) => u.propertyId === pid), [seed]);
  const leaseForUnit = useCallback(
    (unitId?: string) => seed.leases.find((l) => l.unitId === unitId && l.status !== 'Ended'),
    [seed]
  );

  // ── derived ──────────────────────────────────────────────────────────────
  const requestEstimates = useCallback(
    (rid: string) => estimates.filter((e) => e.requestId === rid).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)),
    [estimates]
  );
  const requestVisits = useCallback(
    (rid: string) => visits.filter((v) => v.requestId === rid).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)),
    [visits]
  );
  const requestWorkLogs = useCallback(
    (rid: string) => workLogs.filter((w) => w.requestId === rid).sort((a, b) => b.date.localeCompare(a.date)),
    [workLogs]
  );
  const requestWorkOrders = useCallback((rid: string) => workOrders.filter((w) => w.requestId === rid), [workOrders]);
  const requestAttachments = useCallback(
    (rid: string) => attachments.filter((a) => a.requestId === rid).sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt)),
    [attachments]
  );
  const requestActivity = useCallback(
    (rid: string) => activity.filter((a) => a.requestId === rid).sort((a, b) => b.timestamp.localeCompare(a.timestamp)),
    [activity]
  );

  const estimatedCost = useCallback(
    (req: MaintenanceRequest): number | null => {
      const ests = estimates.filter((e) => e.requestId === req.id);
      if (ests.length === 0) return null;
      const approved = ests.find((e) => e.status === 'Approved');
      const latest = [...ests].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))[0];
      return (approved ?? latest).total;
    },
    [estimates]
  );

  const actualCost = useCallback(
    (req: MaintenanceRequest): number =>
      req.linkedExpenseIds.reduce((sum, id) => sum + (expenses.find((e) => e.id === id)?.amount ?? 0), 0),
    [expenses]
  );

  const assetRequests = useCallback(
    (assetId: string) => requests.filter((r) => r.assetId === assetId).sort((a, b) => b.reportedAt.localeCompare(a.reportedAt)),
    [requests]
  );

  const assetExpenses = useCallback(
    (assetId: string) => {
      const reqs = requests.filter((r) => r.assetId === assetId);
      const ids = new Set<string>();
      reqs.forEach((r) => r.linkedExpenseIds.forEach((id) => ids.add(id)));
      expenses.filter((e) => e.linkedAssetId === assetId).forEach((e) => ids.add(e.id));
      return expenses.filter((e) => ids.has(e.id)).sort((a, b) => b.date.localeCompare(a.date));
    },
    [requests, expenses]
  );

  /** Recorded repair spend: linked invoice amounts, de-duplicated, excluding
      appliance acquisition and replacement-event invoices. */
  const assetRepairSpend = useCallback(
    (assetId: string) => {
      const seen = new Set<string>();
      let total = 0;
      const add = (e?: Expense) => {
        if (!e || seen.has(e.id)) return;
        seen.add(e.id);
        total += e.amount;
      };
      requests
        .filter((r) => r.assetId === assetId && r.resolutionOutcome !== 'Replaced')
        .forEach((r) => r.linkedExpenseIds.forEach((id) => add(expenses.find((e) => e.id === id))));
      expenses
        .filter((e) => e.linkedAssetId === assetId && e.category !== 'Appliance Purchase')
        .forEach(add);
      return total;
    },
    [requests, expenses]
  );

  // ── ids ──────────────────────────────────────────────────────────────────
  const nextRequestId = useCallback(() => {
    const y = new Date().getFullYear();
    return `MR-${y}-${String(nextSeq(requests.map((r) => r.id), 2)).padStart(4, '0')}`;
  }, [requests]);
  const nextAssetId = useCallback(() => `AST-${nextSeq(assets.map((a) => a.id), 1)}`, [assets]);
  const nextWorkOrderId = useCallback(() => `WO-${nextSeq(workOrders.map((w) => w.id), 1)}`, [workOrders]);
  const nextExpenseId = useCallback(() => `EXP-${nextSeq(expenses.map((e) => e.id), 1)}`, [expenses]);
  const nextEstimateId = useCallback(() => `EST-${nextSeq(estimates.map((e) => e.id), 1)}`, [estimates]);
  const nextScheduleId = useCallback(() => `PM-${nextSeq(schedules.map((s) => s.id), 1)}`, [schedules]);

  // ── actions ──────────────────────────────────────────────────────────────
  const addRequest = useCallback(
    (req: MaintenanceRequest, activityNote?: string) => {
      setRequests((r) => [req, ...r]);
      logActivity(req.id, 'creation', activityNote ?? `Request created (source: ${req.source})`);
    },
    [logActivity]
  );

  const updateRequest = useCallback(
    (id: string, patch: Partial<MaintenanceRequest>, activityDesc?: string, activityType = 'edit') => {
      setRequests((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
      if (activityDesc) logActivity(id, activityType, activityDesc);
    },
    [logActivity]
  );

  const setRequestStatus = useCallback(
    (id: string, status: RequestStatus, opts?: { reason?: string; extra?: Partial<MaintenanceRequest>; silent?: boolean }) => {
      setRequests((rs) =>
        rs.map((r) => {
          if (r.id !== id) return r;
          const patch: Partial<MaintenanceRequest> = { status, ...(opts?.extra ?? {}) };
          if (opts?.reason) patch.statusReason = opts.reason;
          if (status === 'In Progress' && (r.status === 'Completed' || r.status === 'Closed') && r.completedAt) {
            // reopening — preserve prior completion in history
            patch.previousCompletions = [
              ...r.previousCompletions,
              {
                completedAt: r.completedAt,
                outcome: r.resolutionOutcome ?? 'Repaired',
                notes: r.resolutionNotes ?? '',
                finalCost: 0,
                reopenedAt: nowISO(),
                reopenReason: opts?.reason,
              },
            ];
            patch.completedAt = undefined;
            patch.resolutionOutcome = undefined;
            patch.resolutionNotes = undefined;
            patch.verificationStatus = 'Not Verified';
          }
          return { ...r, ...patch };
        })
      );
      if (!opts?.silent) {
        const label =
          status === 'In Progress' && opts?.reason ? `Request reopened — ${opts.reason}` : `Status changed to ${status}${opts?.reason ? ` — ${opts.reason}` : ''}`;
        logActivity(id, 'status', label);
      }
    },
    [logActivity]
  );

  const addEstimate = useCallback(
    (est: Estimate, activityDesc?: string) => {
      setEstimates((e) => [est, ...e]);
      if (activityDesc) logActivity(est.requestId, 'estimate', activityDesc);
    },
    [logActivity]
  );

  const updateEstimate = useCallback(
    (id: string, patch: Partial<Estimate>, activityDesc?: string) => {
      setEstimates((es) => es.map((e) => (e.id === id ? { ...e, ...patch } : e)));
      if (activityDesc) {
        const est = estimates.find((e) => e.id === id);
        if (est) logActivity(est.requestId, 'estimate', activityDesc);
      }
    },
    [estimates, logActivity]
  );

  const addVisit = useCallback(
    (v: Visit) => {
      setVisits((vs) => [...vs, v]);
      logActivity(v.requestId, 'visit', `Visit scheduled: ${v.purpose} on ${v.date} at ${v.time}`);
    },
    [logActivity]
  );

  const updateVisit = useCallback(
    (id: string, patch: Partial<Visit>, activityDesc?: string) => {
      setVisits((vs) => vs.map((v) => (v.id === id ? { ...v, ...patch } : v)));
      if (activityDesc) {
        const v = visits.find((x) => x.id === id);
        if (v) logActivity(v.requestId, 'visit', activityDesc);
      }
    },
    [visits, logActivity]
  );

  const addWorkLog = useCallback(
    (wl: WorkLogEntry) => {
      setWorkLogs((ws) => [wl, ...ws]);
      logActivity(wl.requestId, 'worklog', `Work log added by ${wl.person}: ${wl.outcome}`);
    },
    [logActivity]
  );

  const addAttachment = useCallback(
    (att: Attachment) => {
      setAttachments((a) => [att, ...a]);
      if (att.requestId) logActivity(att.requestId, 'document', `Document added: ${att.name} (${att.category})`);
    },
    [logActivity]
  );

  const removeAttachment = useCallback((id: string) => {
    setAttachments((a) => a.filter((x) => x.id !== id));
  }, []);

  const addWorkOrder = useCallback(
    (wo: WorkOrder) => {
      setWorkOrders((w) => [wo, ...w]);
      logActivity(wo.requestId, 'workorder', `Work order ${wo.id} created: ${wo.title}`);
    },
    [logActivity]
  );

  const updateWorkOrder = useCallback(
    (id: string, patch: Partial<WorkOrder>, activityDesc?: string) => {
      setWorkOrders((ws) => ws.map((w) => (w.id === id ? { ...w, ...patch } : w)));
      if (activityDesc) {
        const wo = workOrders.find((w) => w.id === id);
        if (wo) logActivity(wo.requestId, 'workorder', activityDesc);
      }
    },
    [workOrders, logActivity]
  );

  const addExpense = useCallback((exp: Expense) => setExpenses((e) => [exp, ...e]), []);
  const updateExpense = useCallback(
    (id: string, patch: Partial<Expense>) => setExpenses((es) => es.map((e) => (e.id === id ? { ...e, ...patch } : e))),
    []
  );

  const linkExpense = useCallback(
    (requestId: string, expenseId: string) => {
      setRequests((rs) =>
        rs.map((r) => (r.id === requestId && !r.linkedExpenseIds.includes(expenseId) ? { ...r, linkedExpenseIds: [...r.linkedExpenseIds, expenseId] } : r))
      );
      setExpenses((es) => es.map((e) => (e.id === expenseId ? { ...e, linkedRequestId: requestId } : e)));
      const exp = expenses.find((e) => e.id === expenseId);
      logActivity(requestId, 'expense', `Linked expense ${expenseId}${exp ? ` ($${exp.amount.toLocaleString()})` : ''} from Bills & Expenses`);
    },
    [expenses, logActivity]
  );

  const unlinkExpense = useCallback(
    (requestId: string, expenseId: string) => {
      setRequests((rs) => rs.map((r) => (r.id === requestId ? { ...r, linkedExpenseIds: r.linkedExpenseIds.filter((x) => x !== expenseId) } : r)));
      setExpenses((es) => es.map((e) => (e.id === expenseId ? { ...e, linkedRequestId: undefined } : e)));
      logActivity(requestId, 'expense', `Unlinked expense ${expenseId}`);
    },
    [logActivity]
  );

  const addAsset = useCallback((a: Asset) => setAssets((as) => [a, ...as]), []);
  const updateAsset = useCallback(
    (id: string, patch: Partial<Asset>) => setAssets((as) => as.map((a) => (a.id === id ? { ...a, ...patch } : a))),
    []
  );
  const addContractor = useCallback((c: Contractor) => setContractors((cs) => [...cs, c]), []);
  const updateContractor = useCallback((id: string, patch: Partial<Contractor>) => setContractors((cs) => cs.map((c) => (c.id === id ? { ...c, ...patch } : c))), []);
  const addSchedule = useCallback((s: PreventiveSchedule) => setSchedules((ss) => [s, ...ss]), []);
  const updateSchedule = useCallback(
    (id: string, patch: Partial<PreventiveSchedule>) => setSchedules((ss) => ss.map((s) => (s.id === id ? { ...s, ...patch } : s))),
    []
  );

  const completeSchedule = useCallback(
    (id: string) => {
      setSchedules((ss) =>
        ss.map((s) => {
          if (s.id !== id) return s;
          const done = todayISO();
          return { ...s, lastCompleted: done, nextDue: nextDueDate(s.frequency, s.customDays, done) };
        })
      );
      toast('Preventive task marked complete — next due date recalculated.');
    },
    [toast]
  );

  const updateSettings = useCallback((patch: Partial<AppSettings>) => setSettings((s) => ({ ...s, ...patch })), []);

  const value: Store = useMemo(
    () => ({
      properties: seed.properties, units: seed.units, tenants: seed.tenants, leases: seed.leases,
      staff: seed.staff, contractors, requests, estimates, visits, workLogs, workOrders, assets,
      expenses, schedules, attachments, activity, projects: seed.projects, settings,
      currentUser: CURRENT_USER, route, toasts,
      navigate, toast, dismissToast,
      getProperty, getUnit, getTenant, getLease, getContractor, getStaff, getAsset, getExpense,
      unitsForProperty, leaseForUnit,
      requestEstimates, requestVisits, requestWorkLogs, requestWorkOrders, requestAttachments,
      requestActivity, estimatedCost, actualCost, assetRequests, assetRepairSpend, assetExpenses,
      nextRequestId, nextAssetId, nextWorkOrderId, nextExpenseId, nextEstimateId, nextScheduleId,
      logActivity, addRequest, updateRequest, setRequestStatus, addEstimate, updateEstimate,
      addVisit, updateVisit, addWorkLog, addAttachment, removeAttachment, addWorkOrder,
      updateWorkOrder, addExpense, updateExpense, linkExpense, unlinkExpense, addAsset,
      updateAsset, addContractor, updateContractor, addSchedule, updateSchedule, completeSchedule, updateSettings,
    }),
    [
      seed, contractors, requests, estimates, visits, workLogs, workOrders, assets, expenses,
      schedules, attachments, activity, settings, route, toasts, navigate, toast, dismissToast,
      getProperty, getUnit, getTenant, getLease, getContractor, getStaff, getAsset, getExpense,
      unitsForProperty, leaseForUnit, requestEstimates, requestVisits, requestWorkLogs,
      requestWorkOrders, requestAttachments, requestActivity, estimatedCost, actualCost,
      assetRequests, assetRepairSpend, assetExpenses, nextRequestId, nextAssetId, nextWorkOrderId,
      nextExpenseId, nextEstimateId, nextScheduleId, logActivity, addRequest, updateRequest,
      setRequestStatus, addEstimate, updateEstimate, addVisit, updateVisit, addWorkLog,
      addAttachment, removeAttachment, addWorkOrder, updateWorkOrder, addExpense, updateExpense,
      linkExpense, unlinkExpense, addAsset, updateAsset, addContractor, updateContractor, addSchedule,
      updateSchedule, completeSchedule, updateSettings,
    ]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}
