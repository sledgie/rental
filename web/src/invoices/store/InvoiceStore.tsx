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
import { properties as demoProperties, seedInvoices, tenants as demoTenants } from "@inv/data/mockInvoices";
import { isSupabaseConfigured } from "../../lib/supabase";
import { getActiveOrgId, subscribeActiveOrg } from "../../lib/activeOrg";
import * as repo from "../repo";
import {
  invoiceBalance,
  invoicePaid,
  invoiceTotal,
  type ActivityEntry,
  type ActivityKind,
  type Invoice,
  type InvoiceStatus,
  type Payment,
} from "@inv/types/invoice";

const STORAGE_KEY = "prop-ledger.invoices.v1";

const load = (): Invoice[] => {
  if (isSupabaseConfigured) return []; // the database is the source of truth
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedInvoices;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return seedInvoices;
    return parsed as Invoice[];
  } catch {
    return seedInvoices;
  }
};

const nowStamp = () => new Date().toISOString();

/** Status recompute used whenever money moves or a draft is issued. */
export const deriveStatus = (
  invoice: Pick<Invoice, "status" | "payments" | "lineItems" | "discount">
): InvoiceStatus => {
  if (invoice.status === "draft") return "draft";
  if (invoice.status === "pending_approval") return "pending_approval";
  if (invoice.status === "void") return "void";
  const total = invoiceTotal(invoice as Invoice);
  const paid = invoicePaid(invoice as Invoice);
  if (paid <= 0) return "unpaid";
  if (paid + 0.004 >= total) return "paid";
  return "partially_paid";
};

const demoRefs: repo.Refs = {
  tenants: demoTenants.map((name) => ({ id: name, name, email: "", phone: "" })),
  properties: demoProperties,
  units: [],
  leases: [],
};

// A save that failed is reported through this channel (the provider sits above the toast container).
const errorListeners = new Set<(message: string) => void>();
export const onInvoiceSyncError = (cb: (message: string) => void) => {
  errorListeners.add(cb);
  return () => errorListeners.delete(cb);
};

interface InvoiceStoreValue {
  invoices: Invoice[];
  /** people, properties, units and leases the forms pick from */
  refs: repo.Refs;
  /** false while the first load from Supabase is running */
  ready: boolean;
  loadError: string | null;
  reload: () => Promise<void>;
  getInvoice: (id: string) => Invoice | undefined;
  /** With Supabase this resolves once the database accepted the invoice, with the invoice as numbered by the database. */
  createInvoice: (draft: Omit<Invoice, "activity" | "notes" | "attachments">) => Invoice | Promise<Invoice>;
  updateInvoice: (id: string, patch: Partial<Invoice>) => Invoice | undefined;
  recordPayment: (
    id: string,
    payment: { date: string; method: Payment["method"]; reference: string; amount: number; notes?: string }
  ) => Invoice | undefined;
  voidInvoice: (id: string, reason?: string) => void;
  approveInvoice: (id: string) => void;
  addNote: (id: string, body: string) => void;
  resetDemoData: () => void;
}

const InvoiceStoreContext = createContext<InvoiceStoreValue | null>(null);

/** Fields of an invoice patch that the database stores. */
const toInput = (patch: Partial<Invoice>): Partial<repo.InvoiceInput> => {
  const input: Partial<repo.InvoiceInput> = {};
  if ("tenantId" in patch) input.tenantId = patch.tenantId;
  if ("leaseId" in patch) input.leaseId = patch.leaseId;
  if ("propertyId" in patch) input.propertyId = patch.propertyId;
  if ("unitId" in patch) input.unitId = patch.unitId;
  if ("type" in patch) input.type = patch.type;
  if ("issueDate" in patch) input.issueDate = patch.issueDate;
  if ("dueDate" in patch) input.dueDate = patch.dueDate;
  if ("billingPeriodStart" in patch) input.billingPeriodStart = patch.billingPeriodStart;
  if ("billingPeriodEnd" in patch) input.billingPeriodEnd = patch.billingPeriodEnd;
  if ("discount" in patch) input.discount = patch.discount;
  if ("memo" in patch) input.memo = patch.memo;
  if ("lineItems" in patch) input.lineItems = patch.lineItems;
  return input;
};

const nid = (prefix: string) =>
  `${prefix}-${Math.random().toString(36).slice(2, 8)}`;

export function InvoiceStoreProvider({ children }: { children: ReactNode }) {
  const [invoices, setInvoices] = useState<Invoice[]>(load);
  const [refs, setRefs] = useState<repo.Refs>(isSupabaseConfigured ? repo.emptyRefs() : demoRefs);
  const [ready, setReady] = useState(!isSupabaseConfigured);
  const [loadError, setLoadError] = useState<string | null>(null);
  const orgId = useSyncExternalStore(subscribeActiveOrg, getActiveOrgId);

  const reload = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    const org = getActiveOrgId();
    if (!org) return;
    try {
      const loaded = await repo.loadAll(org);
      if (getActiveOrgId() !== org) return; // the user switched organization meanwhile
      setInvoices(loaded.invoices);
      setRefs(loaded.refs);
      setLoadError(null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Unable to load invoices.");
    } finally {
      if (getActiveOrgId() === org) setReady(true);
    }
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    setReady(false);
    setInvoices([]);
    if (orgId) void reload();
  }, [orgId, reload]);

  /** Runs a database write for a change already shown on screen; on failure it says why and shows what the database holds. */
  const sync = useCallback(
    (work: () => Promise<unknown>) => {
      if (!isSupabaseConfigured) return;
      work()
        .catch((error) => errorListeners.forEach((cb) => cb(error instanceof Error ? error.message : "The change could not be saved.")))
        .finally(() => void reload());
    },
    [reload]
  );

  useEffect(() => {
    if (isSupabaseConfigured) return; // invoices live in the database
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(invoices));
    } catch {
      /* storage unavailable — session-only persistence */
    }
  }, [invoices]);

  const getInvoice = useCallback(
    (id: string) => invoices.find((i) => i.id.toLowerCase() === id.toLowerCase()),
    [invoices]
  );

  const withActivity = (
    inv: Invoice,
    kind: ActivityKind,
    label: string,
    detail?: string,
    actor = "Dana Whitmore"
  ): ActivityEntry[] => [
    { id: nid("ac"), kind, label, detail, actor, at: nowStamp() },
    ...inv.activity,
  ];

  const createInvoice: InvoiceStoreValue["createInvoice"] = useCallback((draft) => {
    if (isSupabaseConfigured) {
      return repo
        .createInvoice({
          tenantId: draft.tenantId, leaseId: draft.leaseId, propertyId: draft.propertyId, unitId: draft.unitId, type: draft.type, status: draft.status,
          issueDate: draft.issueDate, dueDate: draft.dueDate, billingPeriodStart: draft.billingPeriodStart, billingPeriodEnd: draft.billingPeriodEnd,
          discount: draft.discount, memo: draft.memo, lineItems: draft.lineItems,
        })
        .then(async (number) => {
          const org = getActiveOrgId();
          const loaded = org ? await repo.loadAll(org) : null;
          if (loaded) {
            setInvoices(loaded.invoices);
            setRefs(loaded.refs);
          }
          return loaded?.invoices.find((i) => i.id === number) ?? ({ ...draft, id: number, activity: [], notes: [], attachments: [] } as Invoice);
        });
    }
    const next: Invoice = {
      ...draft,
      attachments: [
        {
          id: nid("at"),
          name: `${draft.id}.pdf`,
          kind: "pdf",
          size: "128 KB",
          uploadedBy: "You",
          uploadedAt: draft.issueDate,
        },
      ],
      notes: [],
      activity: [
        {
          id: nid("ac"),
          kind: "created",
          label: "Invoice created",
          detail: `Generated for ${draft.propertyName} · Unit ${draft.unit}.`,
          actor: "You",
          at: nowStamp(),
        },
      ],
    };
    setInvoices((prev) => [next, ...prev]);
    return next;
  }, []);

  const updateInvoice: InvoiceStoreValue["updateInvoice"] = useCallback((id, patch) => {
    sync(() => repo.updateInvoice(id, toInput(patch)));
    let updated: Invoice | undefined;
    setInvoices((prev) =>
      prev.map((inv) => {
        if (inv.id !== id) return inv;
        const merged: Invoice = { ...inv, ...patch };
        if (inv.status !== "draft" && merged.status === "draft") merged.status = inv.status;
        updated = {
          ...merged,
          activity: withActivity(inv, "edited", "Invoice edited", "Line items or billing details changed."),
        };
        return updated;
      })
    );
    return updated;
  }, []);

  const recordPayment: InvoiceStoreValue["recordPayment"] = useCallback((id, input) => {
    sync(() => repo.recordPayment(id, input));
    let updated: Invoice | undefined;
    setInvoices((prev) =>
      prev.map((inv) => {
        if (inv.id !== id) return inv;
        const payment: Payment = {
          id: nid("pm"),
          invoiceId: inv.id,
          ...input,
        };
        const withPayment: Invoice = { ...inv, payments: [...inv.payments, payment] };
        const settled = invoiceBalance(withPayment) <= 0.004;
        const status: InvoiceStatus =
          inv.status === "draft" || inv.status === "pending_approval"
            ? inv.status === "draft"
              ? "draft"
              : "pending_approval"
            : deriveStatus(withPayment);
        const next: Invoice = {
          ...withPayment,
          status,
          activity: [
            {
              id: nid("ac"),
              kind: "payment",
              label: "Payment recorded",
              detail: `${payment.method} · ${payment.reference}`,
              actor: "You",
              at: nowStamp(),
            },
            ...(settled
              ? [
                  {
                    id: nid("ac"),
                    kind: "paid" as ActivityKind,
                    label: "Invoice marked as paid",
                    detail: "Balance cleared in full.",
                    actor: "System",
                    at: nowStamp(),
                  },
                ]
              : []),
            ...inv.activity,
          ],
        };
        updated = next;
        return next;
      })
    );
    return updated;
  }, []);

  const voidInvoice: InvoiceStoreValue["voidInvoice"] = useCallback((id, reason) => {
    sync(() => repo.voidInvoice(id, reason));
    setInvoices((prev) =>
      prev.map((inv) =>
        inv.id === id
          ? {
              ...inv,
              status: "void",
              activity: withActivity(
                inv,
                "voided",
                "Invoice voided",
                reason?.trim() ? reason : "Voided from the invoice register."
              ),
            }
          : inv
      )
    );
  }, []);

  const approveInvoice: InvoiceStoreValue["approveInvoice"] = useCallback((id) => {
    sync(() => repo.approveInvoice(id));
    setInvoices((prev) =>
      prev.map((inv) =>
        inv.id === id && (inv.status === "draft" || inv.status === "pending_approval")
          ? {
              ...inv,
              status: deriveStatus({ ...inv, status: "unpaid" }),
              activity: [
                {
                  id: nid("ac"),
                  kind: "approved",
                  label: "Invoice approved",
                  detail: "Approved and queued for delivery to the tenant.",
                  actor: "You",
                  at: nowStamp(),
                },
                ...inv.activity,
              ],
            }
          : inv
      )
    );
  }, []);

  const addNote: InvoiceStoreValue["addNote"] = useCallback((id, body) => {
    sync(() => repo.addNote(id, body));
    setInvoices((prev) =>
      prev.map((inv) =>
        inv.id === id
          ? {
              ...inv,
              notes: [
                ...inv.notes,
                {
                  id: nid("nt"),
                  author: "You",
                  createdAt: nowStamp(),
                  body,
                },
              ],
              activity: withActivity(inv, "note", "Internal note added"),
            }
          : inv
      )
    );
  }, []);

  const resetDemoData = useCallback(() => {
    if (isSupabaseConfigured) {
      void reload(); // nothing to reset: the data lives in the database
      return;
    }
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* noop */
    }
    setInvoices(seedInvoices);
  }, []);

  const value = useMemo(
    () => ({
      invoices,
      refs,
      ready,
      loadError,
      reload,
      getInvoice,
      createInvoice,
      updateInvoice,
      recordPayment,
      voidInvoice,
      approveInvoice,
      addNote,
      resetDemoData,
    }),
    [
      invoices,
      refs,
      ready,
      loadError,
      reload,
      getInvoice,
      createInvoice,
      updateInvoice,
      recordPayment,
      voidInvoice,
      approveInvoice,
      addNote,
      resetDemoData,
    ]
  );

  return (
    <InvoiceStoreContext.Provider value={value}>
      {children}
    </InvoiceStoreContext.Provider>
  );
}

export function useInvoices(): InvoiceStoreValue {
  const ctx = useContext(InvoiceStoreContext);
  if (!ctx) throw new Error("useInvoices must be used inside <InvoiceStoreProvider>");
  return ctx;
}
