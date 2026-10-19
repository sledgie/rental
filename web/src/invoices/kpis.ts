// Register totals shown on the Invoices page strip and in the Invoices group on the Dashboard.
import { useMemo } from "react";
import { todayISO } from "@inv/lib/format";
import { invoiceBalance, type Invoice } from "@inv/types/invoice";

export function useInvoiceKpis(invoices: Invoice[]) {
  return useMemo(() => {
    const open = invoices
      .map((inv) => ({ inv, balance: invoiceBalance(inv) }))
      .filter(({ inv, balance }) => balance > 0 && !["draft", "void", "pending_approval"].includes(inv.status));
    const outstanding = open.reduce((s, r) => s + r.balance, 0);
    const overdueRows = open.filter(({ inv }) => inv.dueDate < todayISO());
    const overdueTotal = overdueRows.reduce((s, r) => s + r.balance, 0);
    const collected = invoices.reduce((s, inv) => s + inv.payments.reduce((ps, p) => ps + p.amount, 0), 0);
    const drafts = invoices.filter((i) => i.status === "draft").length;
    return { outstanding, openCount: open.length, overdue: overdueRows.length, overdueTotal, collected, drafts, total: invoices.length };
  }, [invoices]);
}
