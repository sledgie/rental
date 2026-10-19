import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { seedInvoices } from "@inv/data/mockInvoices";
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

interface InvoiceStoreValue {
  invoices: Invoice[];
  getInvoice: (id: string) => Invoice | undefined;
  createInvoice: (draft: Omit<Invoice, "activity" | "notes" | "attachments">) => Invoice;
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

const nid = (prefix: string) =>
  `${prefix}-${Math.random().toString(36).slice(2, 8)}`;

export function InvoiceStoreProvider({ children }: { children: ReactNode }) {
  const [invoices, setInvoices] = useState<Invoice[]>(load);

  useEffect(() => {
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
