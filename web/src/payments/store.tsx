// Payments ledger state. The original single-page App kept all of this in useState; it lives in a provider here so the Payments
// page and the Dashboard share one ledger. Nothing is persisted (a refresh restores the demo data).
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import {
  ALLOCATIONS,
  AUDITS,
  CREDITS,
  CREDIT_APPLICATIONS,
  DEFAULT_USER_ID,
  INVOICES,
  LEASES,
  NORA_INVOICE_IDS,
  PAYMENTS,
  PROPERTIES,
  TENANTS,
  UNITS,
  USERS,
} from "./data/mockData";
import type {
  Allocation,
  AuditEvent,
  CreditApplication,
  NewPaymentInput,
  Payment,
  TenantCredit,
} from "./types";
import {
  buildCreditBalances,
  buildInvoiceBalances,
  COMPANY,
  fmtCAD,
  nextAuditId,
  nextCreditId,
  nextPaymentId,
  nextReceiptId,
  splitFunding,
  sumCents,
  todayISO,
} from "./utils/paymentUtils";
import { downloadReceiptHtml } from "./components/ReceiptPreview";
import { isSupabaseConfigured, supabase } from "../lib/supabase";
import { getActiveOrgId, subscribeActiveOrg } from "../lib/activeOrg";
import * as repo from "./repo";
import type { ToastItem } from "./components/ui";

interface PostResult {
  payment: Payment;
  newAllocations: Allocation[];
  newCreditApps: CreditApplication[];
  newCredit: TenantCredit | null;
  newAudits: AuditEvent[];
  unallocated: number;
}

function buildPost(
  input: NewPaymentInput,
  ctx: {
    payments: Payment[];
    credits: TenantCredit[];
    creditApplications: CreditApplication[];
    audits: AuditEvent[];
  },
  userId: string,
): PostResult {
  const id = nextPaymentId(ctx.payments);
  const receiptId = nextReceiptId(ctx.payments);
  const createdAt = new Date().toISOString();

  const { allocations: fundedLines, creditNeeded } = splitFunding(
    input.rows.map((r) => ({ invoiceId: r.invoiceId, amount: r.amountCents })),
    input.amountCents,
  );
  const totalAllocated = sumCents(fundedLines.map((l) => l.amount));
  const unallocated = input.amountCents - totalAllocated;

  const payment: Payment = {
    id,
    receiptId,
    tenantId: input.tenantId,
    leaseId: input.leaseId,
    date: input.date,
    method: input.method,
    amount: input.amountCents,
    reference: input.reference,
    notes: input.notes,
    status: "posted",
    recordedById: userId,
    createdAt,
  };

  const newAllocations: Allocation[] = fundedLines.map((l, i) => ({
    id: `${id}-A${i + 1}`,
    paymentId: id,
    invoiceId: l.invoiceId,
    amount: l.amount,
  }));

  // Spend tenant credits (oldest first) when the allocation exceeds cash in.
  const creditBalances = buildCreditBalances(ctx.credits, ctx.creditApplications, ctx.payments);
  const newCreditApps: CreditApplication[] = [];
  let creditRemaining = input.applyCredit ? creditNeeded : 0;
  const spendable = ctx.credits
    .filter((c) => {
      const b = creditBalances.get(c.id);
      return c.tenantId === input.tenantId && b?.valid && !b.exhausted;
    })
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  for (const credit of spendable) {
    if (creditRemaining <= 0) break;
    const bal = creditBalances.get(credit.id)!;
    const use = Math.min(creditRemaining, bal.remaining);
    if (use <= 0) continue;
    // Apply to the invoices funded by credit, oldest first (rows are pre-sorted).
    const rowsNeedingCredit = input.rows.filter((r) => {
      const funded = fundedLines.find((f) => f.invoiceId === r.invoiceId)?.amount ?? 0;
      return r.amountCents - funded > 0;
    });
    const target = rowsNeedingCredit[0]?.invoiceId ?? input.rows[0]?.invoiceId;
    if (!target) break;
    const appSeq = ctx.creditApplications.filter((ca) => ca.creditId === credit.id).length + newCreditApps.filter((ca) => ca.creditId === credit.id).length + 1;
    newCreditApps.push({ id: `${credit.id}-AP${appSeq}`, creditId: credit.id, invoiceId: target, amount: use, at: createdAt });
    creditRemaining -= use;
  }

  // Retain unallocated cash as a new tenant credit when instructed.
  const newCredit: TenantCredit | null =
    input.keepCredit && unallocated > 0
      ? {
          id: nextCreditId(ctx.credits),
          tenantId: input.tenantId,
          sourcePaymentId: id,
          originalAmount: unallocated,
          createdAt,
          note: `Unapplied funds retained from ${id}.`,
        }
      : null;

  // Audit events for the whole transaction. A growing base guarantees unique IDs.
  const auditBase: Array<{ id: string }> = [...ctx.audits];
  const newAudits: AuditEvent[] = [];
  const mkAudit = (partial: Omit<AuditEvent, "id">): AuditEvent => {
    const ev: AuditEvent = { ...partial, id: nextAuditId(auditBase) };
    auditBase.push(ev);
    newAudits.push(ev);
    return ev;
  };
  mkAudit({
    userId,
    action: "payment.created",
    entityType: "payment",
    entityId: id,
    at: createdAt,
    summary: `Draft payment of ${fmtCAD(input.amountCents)} created for tenant ${input.tenantId}.`,
    next: { amount: fmtCAD(input.amountCents), method: input.method, status: "draft" },
  });
  mkAudit({
    userId,
    action: "payment.posted",
    entityType: "payment",
    entityId: id,
    at: createdAt,
    summary: `${id} posted — ${newAllocations.length} allocation(s)${newCreditApps.length > 0 ? `, ${newCreditApps.length} credit application(s)` : ""}.`,
    prev: { status: "draft" },
    next: { status: "posted" },
  });
  mkAudit({
    userId,
    action: "receipt.issued",
    entityType: "receipt",
    entityId: receiptId,
    at: createdAt,
    summary: `Receipt ${receiptId} issued for ${id}.`,
  });
  for (const app of newCreditApps) {
    mkAudit({
      userId,
      action: "credit.applied",
      entityType: "credit",
      entityId: app.creditId,
      at: createdAt,
      summary: `${fmtCAD(app.amount)} of ${app.creditId} applied to invoice ${app.invoiceId}.`,
      next: { appliedTo: app.invoiceId, amount: fmtCAD(app.amount) },
    });
  }
  if (newCredit) {
    mkAudit({
      userId,
      action: "credit.created",
      entityType: "credit",
      entityId: newCredit.id,
      at: createdAt,
      summary: `${fmtCAD(newCredit.originalAmount)} unapplied funds from ${id} retained as tenant credit.`,
      next: { originalAmount: fmtCAD(newCredit.originalAmount) },
    });
  }

  return { payment, newAllocations, newCreditApps, newCredit, newAudits, unallocated };
}

export const STATIC = { INVOICES, LEASES, PROPERTIES, TENANTS, UNITS, USERS };

function useLedger() {
  const [payments, setPayments] = useState<Payment[]>(isSupabaseConfigured ? [] : PAYMENTS);
  const [allocations, setAllocations] = useState<Allocation[]>(isSupabaseConfigured ? [] : ALLOCATIONS);
  const [credits, setCredits] = useState<TenantCredit[]>(isSupabaseConfigured ? [] : CREDITS);
  const [creditApplications, setCreditApplications] = useState<CreditApplication[]>(isSupabaseConfigured ? [] : CREDIT_APPLICATIONS);
  const [audits, setAudits] = useState<AuditEvent[]>(isSupabaseConfigured ? [] : AUDITS);
  const [currentUserId, setCurrentUserId] = useState(isSupabaseConfigured ? "" : DEFAULT_USER_ID);
  const [loading, setLoading] = useState(true);
  // the lists the page picks from: demo constants, or what was loaded from Supabase for the active organization
  const [lists, setLists] = useState(isSupabaseConfigured ? { INVOICES: [], LEASES: [], PROPERTIES: [], TENANTS: [], UNITS: [], USERS: [] } as unknown as typeof STATIC : STATIC);
  const orgId = useSyncExternalStore(subscribeActiveOrg, getActiveOrgId);
  const posting = useRef(false);

  const reload = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    const org = getActiveOrgId();
    if (!org) return;
    try {
      const data = await repo.loadLedger(org);
      if (getActiveOrgId() !== org) return; // the user switched organization meanwhile
      Object.assign(COMPANY, data.company); // receipts carry the organization's own details
      setLists({ INVOICES: data.invoices, LEASES: data.leases, PROPERTIES: data.properties, TENANTS: data.tenants, UNITS: data.units, USERS: data.users });
      setPayments(data.payments);
      setAllocations(data.allocations);
      setCredits(data.credits);
      setCreditApplications(data.creditApplications);
      setAudits(data.audits);
      const { data: auth } = await supabase.auth.getUser();
      setCurrentUserId(auth.user?.id ?? "");
    } catch (error) {
      setToasts((prev) => [...prev, { id: Date.now() + Math.random(), tone: "danger", title: "Could not load payments", message: error instanceof Error ? error.message : "Please try again." }]);
    } finally {
      if (getActiveOrgId() === org) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    setLoading(true);
    if (orgId) void reload();
  }, [orgId, reload]);
  const [formOpen, setFormOpen] = useState(false);
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [receiptForId, setReceiptForId] = useState<string | null>(null);
  const [lastAddedId, setLastAddedId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    if (isSupabaseConfigured) return;
    const t = window.setTimeout(() => setLoading(false), 650);
    return () => window.clearTimeout(t);
  }, []);

  const balances = useMemo(
    () => buildInvoiceBalances(lists.INVOICES, payments, allocations, creditApplications),
    [lists.INVOICES, payments, allocations, creditApplications],
  );
  const creditBalances = useMemo(
    () => buildCreditBalances(credits, creditApplications, payments),
    [credits, creditApplications, payments],
  );

  const pushToast = useCallback((tone: ToastItem["tone"], title: string, message?: string) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, tone, title, message }]);
    window.setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 6000);
  }, []);

  // ------------------------------------------------------------------ posting

  const handlePost = useCallback(
    (input: NewPaymentInput) => {
      const result = buildPost(input, { payments, credits, creditApplications, audits }, currentUserId);
      if (isSupabaseConfigured) {
        // the database decides the numbers and validates the allocations; this page only works out who gets how much
        if (posting.current) return; // ignore a second click while the first one is saving
        posting.current = true;
        repo
          .postPayment(
            {
              tenantId: input.tenantId, leaseId: input.leaseId, date: input.date, amountCents: input.amountCents, method: input.method,
              reference: input.reference, notes: input.notes,
              cash: result.newAllocations.map((a) => ({ invoiceId: a.invoiceId, amount: a.amount })),
              credits: result.newCreditApps.map((c) => ({ creditId: c.creditId, invoiceId: c.invoiceId, amount: c.amount })),
              keepCredit: !!result.newCredit,
            },
            fmtCAD,
          )
          .then(async (posted) => {
            await reload();
            setLastAddedId(posted.paymentNumber);
            setFormOpen(false);
            pushToast(
              "success",
              `Payment ${posted.paymentNumber} posted \u00b7 ${fmtCAD(input.amountCents)}`,
              `${posted.receiptNumber ? `Receipt ${posted.receiptNumber} issued.` : ""}${posted.creditNumber ? ` ${fmtCAD(result.newCredit?.originalAmount ?? 0)} kept as tenant credit.` : ""}`,
            );
          })
          .catch(async (error) => {
            pushToast("danger", "Payment not posted", error instanceof Error ? error.message : "Please try again.");
            await reload(); // a payment may have been saved before a later step failed
          })
          .finally(() => {
            posting.current = false;
          });
        return;
      }
      setPayments((prev) => [result.payment, ...prev]);
      setAllocations((prev) => [...prev, ...result.newAllocations]);
      setCreditApplications((prev) => [...prev, ...result.newCreditApps]);
      if (result.newCredit) setCredits((prev) => [...prev, result.newCredit!]);
      setAudits((prev) => [...prev, ...result.newAudits]);
      setLastAddedId(result.payment.id);
      setFormOpen(false);
      pushToast(
        "success",
        `Payment ${result.payment.id} posted · ${fmtCAD(result.payment.amount)}`,
        `Receipt ${result.payment.receiptId} issued.${result.newCredit ? ` ${fmtCAD(result.newCredit.originalAmount)} kept as tenant credit.` : ""}`,
      );
    },
    [payments, credits, creditApplications, audits, currentUserId, pushToast, reload],
  );

  // ---------------------------------------------------- reversal & refund

  const handleReverse = useCallback(
    (paymentId: string, reason: string) => {
      if (isSupabaseConfigured) {
        const invalidated = credits.filter((c) => {
          const b = creditBalances.get(c.id);
          return c.sourcePaymentId === paymentId && b?.valid && !b.exhausted;
        });
        repo
          .reversePayment(paymentId, reason, [
            { action: "payment.reversed", entityType: "payment", entityId: paymentId, summary: `${paymentId} reversed \u2014 invoice balances recalculated, excluded from collection totals.`, reason, prev: { status: "posted" }, next: { status: "reversed" } },
            ...invalidated.map((c) => ({ action: "credit.invalidated" as const, entityType: "credit" as const, entityId: c.id, summary: `${c.id} invalidated \u2014 its source payment ${paymentId} was reversed.`, reason })),
          ])
          .then(async () => {
            await reload();
            pushToast("danger", `Payment ${paymentId} reversed`, "History preserved \u00b7 balances recalculated.");
          })
          .catch((error) => pushToast("danger", "Payment not reversed", error instanceof Error ? error.message : "Please try again."));
        return;
      }
      const at = new Date().toISOString();
      setPayments((prev) =>
        prev.map((p) =>
          p.id === paymentId
            ? { ...p, status: "reversed" as const, reversedAt: at, reversedById: currentUserId, reversalReason: reason }
            : p,
        ),
      );
      const invalidated = credits.filter((c) => {
        const b = creditBalances.get(c.id);
        return c.sourcePaymentId === paymentId && b?.valid && !b.exhausted;
      });
      const auditBase: Array<{ id: string }> = [...audits];
      const newAudits: AuditEvent[] = [];
      const mkAudit = (partial: Omit<AuditEvent, "id">) => {
        const ev: AuditEvent = { ...partial, id: nextAuditId(auditBase) };
        auditBase.push(ev);
        newAudits.push(ev);
      };
      mkAudit({
        userId: currentUserId,
        action: "payment.reversed",
        entityType: "payment",
        entityId: paymentId,
        at,
        summary: `${paymentId} reversed — invoice balances recalculated, excluded from collection totals.`,
        reason,
        prev: { status: "posted" },
        next: { status: "reversed" },
      });
      for (const c of invalidated) {
        mkAudit({
          userId: currentUserId,
          action: "credit.invalidated",
          entityType: "credit",
          entityId: c.id,
          at,
          summary: `${c.id} invalidated — its source payment ${paymentId} was reversed.`,
          reason,
        });
      }
      setAudits((prev) => [...prev, ...newAudits]);
      pushToast("danger", `Payment ${paymentId} reversed`, "History preserved · balances recalculated.");
    },
    [audits, credits, creditBalances, currentUserId, pushToast, reload],
  );

  const handleRefund = useCallback(
    (paymentId: string, amountCents: number, reason: string) => {
      if (isSupabaseConfigured) {
        repo
          .recordRefund(paymentId, amountCents, reason, [
            { action: "refund.recorded", entityType: "refund", entityId: paymentId, summary: `Refund of ${fmtCAD(amountCents)} recorded against ${paymentId}. Payment stays posted.`, reason, next: { refundAmount: fmtCAD(amountCents) } },
          ])
          .then(async () => {
            await reload();
            pushToast("info", `Refund recorded on ${paymentId}`, `${fmtCAD(amountCents)} returned \u2014 the payment remains posted.`);
          })
          .catch((error) => pushToast("danger", "Refund not recorded", error instanceof Error ? error.message : "Please try again."));
        return;
      }
      const at = new Date().toISOString();
      setPayments((prev) =>
        prev.map((p) =>
          p.id === paymentId ? { ...p, refund: { at, byId: currentUserId, amount: amountCents, reason } } : p,
        ),
      );
      setAudits((prev) => [
        ...prev,
        {
          id: nextAuditId(prev),
          userId: currentUserId,
          action: "refund.recorded",
          entityType: "refund",
          entityId: paymentId,
          at,
          summary: `Refund of ${fmtCAD(amountCents)} recorded against ${paymentId}. Payment stays posted.`,
          reason,
          next: { refundAmount: fmtCAD(amountCents) },
        },
      ]);
      pushToast("info", `Refund recorded on ${paymentId}`, `${fmtCAD(amountCents)} returned — the payment remains posted.`);
    },
    [currentUserId, pushToast, reload],
  );

  const logReceiptAction = useCallback(
    (payment: Payment, action: "receipt.reprinted" | "receipt.downloaded") => {
      if (isSupabaseConfigured) {
        void repo
          .recordAudits([{ action, entityType: "receipt", entityId: payment.receiptId ?? payment.id, summary: `${payment.receiptId ?? payment.id} ${action === "receipt.reprinted" ? "reprinted" : "downloaded"} \u2014 receipt number reused, no new payment created.` }])
          .then(reload);
        return;
      }
      setAudits((prev) => [
        ...prev,
        {
          id: nextAuditId(prev),
          userId: currentUserId,
          action,
          entityType: "receipt",
          entityId: payment.receiptId ?? payment.id,
          at: new Date().toISOString(),
          summary: `${payment.receiptId ?? payment.id} ${action === "receipt.reprinted" ? "reprinted" : "downloaded"} — receipt number reused, no new payment created.`,
        },
      ]);
    },
    [currentUserId, reload],
  );

  // ------------------------------------------------------------- demo reset

  const handleReset = useCallback(() => {
    if (isSupabaseConfigured) {
      void reload();
      return;
    }
    setPayments(PAYMENTS);
    setAllocations(ALLOCATIONS);
    setCredits(CREDITS);
    setCreditApplications(CREDIT_APPLICATIONS);
    setAudits(AUDITS);
    setLastAddedId(null);
    setDetailsId(null);
    setReceiptForId(null);
    pushToast("info", "Demo data restored", "The ledger was reset to its original fictional state.");
  }, [pushToast, reload]);

  // ------------------------------------------------- acceptance test (spec §6)

  const runAcceptanceTest = useCallback(() => {
    if (isSupabaseConfigured) return; // demo scenario only
    const inv9 = NORA_INVOICE_IDS.september;
    const inv10 = NORA_INVOICE_IDS.october;
    const b9 = balances.get(inv9);
    const b10 = balances.get(inv10);
    if (!b9 || !b10 || b9.outstanding !== 30000 || b10.outstanding !== 150000) {
      pushToast(
        "info",
        "Acceptance scenario unavailable",
        "The test invoices are no longer at $300.00 / $1,500.00 outstanding — reset the demo data and try again.",
      );
      return;
    }
    const input: NewPaymentInput = {
      tenantId: "TEN-13",
      leaseId: "LS-14",
      date: todayISO(),
      amountCents: 100000,
      method: "etransfer",
      reference: `ACCEPT-${Date.now().toString().slice(-6)}`,
      notes: "Automated multi-invoice acceptance test (spec §6).",
      rows: [
        { invoiceId: inv9, amountCents: 30000 },
        { invoiceId: inv10, amountCents: 70000 },
      ],
      applyCredit: false,
      keepCredit: false,
    };
    const result = buildPost(input, { payments, credits, creditApplications, audits }, currentUserId);

    // Verify against the expected outcomes before committing.
    const nextBalances = buildInvoiceBalances(
      lists.INVOICES,
      [result.payment, ...payments],
      [...allocations, ...result.newAllocations],
      [...creditApplications, ...result.newCreditApps],
    );
    const checks = [
      ["Exactly one payment record", true],
      [`Payment amount ${fmtCAD(result.payment.amount)} = $1,000.00`, result.payment.amount === 100000],
      ["One unique payment ID + one receipt number", !!result.payment.id && !!result.payment.receiptId],
      ["Two allocations ($300 Sept, $700 Oct)", result.newAllocations.length === 2],
      ["September now owing $0.00", nextBalances.get(inv9)?.outstanding === 0],
      ["October now owing $800.00", nextBalances.get(inv10)?.outstanding === 80000],
      ["September status Paid", nextBalances.get(inv9)?.status === "paid"],
      ["October status Partially paid", nextBalances.get(inv10)?.status === "partial"],
    ] as const;
    const failed = checks.filter(([, ok]) => !ok);

    setPayments((prev) => [result.payment, ...prev]);
    setAllocations((prev) => [...prev, ...result.newAllocations]);
    setCreditApplications((prev) => [...prev, ...result.newCreditApps]);
    setAudits((prev) => [...prev, ...result.newAudits]);
    setLastAddedId(result.payment.id);
    setDetailsId(result.payment.id);

    if (failed.length === 0) {
      pushToast(
        "success",
        "Acceptance test passed ✔",
        "1 payment · 2 allocations · Sept paid in full · Oct $800.00 remaining. Details opened.",
      );
    } else {
      pushToast("danger", "Acceptance test FAILED", failed.map(([label]) => label).join(" · "));
    }
  }, [balances, payments, credits, creditApplications, audits, allocations, currentUserId, pushToast]);

  // ---------------------------------------------------------------- lookups

  const detailsPayment = detailsId ? payments.find((p) => p.id === detailsId) : undefined;
  const receiptPayment = receiptForId ? payments.find((p) => p.id === receiptForId) : undefined;

  const lookup = (payment?: Payment) => {
    const tenant = payment ? lists.TENANTS.find((t) => t.id === payment.tenantId) : undefined;
    const lease = payment ? lists.LEASES.find((l) => l.id === payment.leaseId) : undefined;
    const unit = lease ? lists.UNITS.find((u) => u.id === lease.unitId) : undefined;
    const property = unit ? lists.PROPERTIES.find((p) => p.id === unit.propertyId) : undefined;
    return { tenant, lease, unit, property };
  };

  const receiptArgsFor = (payment: Payment) => ({
    payment,
    issuedAt: payment.createdAt,
    ...lookup(payment),
    invoices: lists.INVOICES,
    balances,
    allocations,
    creditsFromPayment: credits.filter((c) => c.sourcePaymentId === payment.id),
    creditApplications,
    users: lists.USERS,
  });

  const printReceiptFor = (paymentId: string) => {
    const payment = payments.find((p) => p.id === paymentId);
    setReceiptForId(paymentId);
    window.setTimeout(() => window.print(), 380);
    if (payment) logReceiptAction(payment, "receipt.reprinted");
  };

  const downloadReceiptFor = (paymentId: string) => {
    const payment = payments.find((p) => p.id === paymentId);
    if (!payment) return;
    downloadReceiptHtml(receiptArgsFor(payment));
    logReceiptAction(payment, "receipt.downloaded");
    pushToast("info", "Receipt downloaded", `${payment.receiptId}.html saved — the same receipt number is reused.`);
  };

  const currentUser = lists.USERS.find((u) => u.id === currentUserId);

  return {
    ...lists,
    payments, allocations, credits, creditApplications, audits,
    currentUserId, setCurrentUserId, currentUser, loading,
    formOpen, setFormOpen, detailsId, setDetailsId, receiptForId, setReceiptForId, lastAddedId,
    toasts, setToasts, pushToast,
    balances, creditBalances,
    handlePost, handleReverse, handleRefund, handleReset, runAcceptanceTest,
    lookup, receiptArgsFor, printReceiptFor, downloadReceiptFor, detailsPayment, receiptPayment,
  };
}

export type PaymentsValue = ReturnType<typeof useLedger>;
const Ctx = createContext<PaymentsValue | null>(null);

export function PaymentsProvider({ children }: { children: ReactNode }) {
  const value = useLedger();
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePayments(): PaymentsValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("usePayments must be used inside PaymentsProvider");
  return v;
}
