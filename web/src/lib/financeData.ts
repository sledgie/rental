// What the Tenants, Units and Properties pages need to know about money: invoices with what is paid and still owed, payments and
// how they were allocated, and credits applied. Read from Supabase once per page load; each page turns it into its own shape.
import { supabase, toError } from "./supabase";

/* eslint-disable @typescript-eslint/no-explicit-any -- rows come from untyped PostgREST responses */

export interface RawInvoice {
  id: string;
  number: string;
  tenantId: string;
  leaseId: string | null;
  unitId: string | null;
  propertyId: string | null;
  type: string;
  /** stored workflow state: draft, pending_approval, open or void */
  status: string;
  issueDate: string;
  dueDate: string;
  total: number;
  paidByPayments: number;
  paidByCredits: number;
  outstanding: number;
  /** days past the due date (0 when not overdue) */
  daysOverdue: number;
  description: string;
}
export interface RawPayment { id: string; number: string; tenantId: string; leaseId: string | null; date: string; method: string; amount: number; reference: string; status: string }
export interface RawAllocation { paymentId: string; invoiceId: string; amount: number }
export interface RawCreditApplication { id: string; invoiceId: string; amount: number; date: string }
export interface FinanceData { invoices: RawInvoice[]; payments: RawPayment[]; allocations: RawAllocation[]; creditApplications: RawCreditApplication[] }

export const emptyFinance = (): FinanceData => ({ invoices: [], payments: [], allocations: [], creditApplications: [] });

const PAGE = 1000; // PostgREST returns at most this many rows per request

/** Reads every row of a query, a page at a time, so large organizations are not silently cut off. */
export async function fetchAll(table: string, columns: string, orgId: string, order?: string): Promise<any[]> {
  const rows: any[] = [];
  for (let from = 0; ; from += PAGE) {
    let query = supabase.from(table).select(columns).eq("organization_id", orgId).range(from, from + PAGE - 1);
    if (order) query = query.order(order);
    const { data, error } = await query;
    if (error) throw toError(error, `Unable to load ${table.replace(/_/g, " ")}.`);
    rows.push(...(data ?? []));
    if ((data ?? []).length < PAGE) return rows;
  }
}

const num = (v: unknown) => Number(v ?? 0);

export async function loadFinance(orgId: string): Promise<FinanceData> {
  const [balances, lines, payments, allocations, applications] = await Promise.all([
    fetchAll("v_invoice_balances", "invoice_id, invoice_number, tenant_id, lease_id, unit_id, property_id, invoice_type, status, issue_date, due_date, total, paid_by_payments, paid_by_credits, outstanding, days_overdue", orgId, "invoice_id"),
    fetchAll("invoice_lines", "invoice_id, description, position", orgId, "position"),
    fetchAll("payments", "id, payment_number, tenant_id, lease_id, payment_date, method, amount, reference, status", orgId, "id"),
    fetchAll("payment_allocations", "payment_id, invoice_id, amount", orgId, "id"),
    fetchAll("credit_note_applications", "id, invoice_id, amount, applied_on", orgId, "id"),
  ]);
  const firstLine = new Map<string, string>();
  for (const l of lines) if (!firstLine.has(l.invoice_id)) firstLine.set(l.invoice_id, l.description);
  return {
    invoices: balances.map((b): RawInvoice => ({
      id: b.invoice_id,
      number: b.invoice_number ?? b.invoice_id,
      tenantId: b.tenant_id,
      leaseId: b.lease_id,
      unitId: b.unit_id,
      propertyId: b.property_id,
      type: b.invoice_type,
      status: b.status,
      issueDate: b.issue_date,
      dueDate: b.due_date,
      total: num(b.total),
      paidByPayments: num(b.paid_by_payments),
      paidByCredits: num(b.paid_by_credits),
      outstanding: num(b.outstanding),
      daysOverdue: num(b.days_overdue),
      description: firstLine.get(b.invoice_id) ?? "Invoice",
    })),
    payments: payments.map((p): RawPayment => ({
      id: p.id, number: p.payment_number ?? p.id, tenantId: p.tenant_id, leaseId: p.lease_id, date: p.payment_date, method: p.method, amount: num(p.amount), reference: p.reference ?? "", status: p.status,
    })),
    allocations: allocations.map((a): RawAllocation => ({ paymentId: a.payment_id, invoiceId: a.invoice_id, amount: num(a.amount) })),
    creditApplications: applications.map((a): RawCreditApplication => ({ id: a.id, invoiceId: a.invoice_id, amount: num(a.amount), date: a.applied_on })),
  };
}

export const round2 = (n: number) => Math.round(n * 100) / 100;
