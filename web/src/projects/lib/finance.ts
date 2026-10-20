import type {
  Invoice,
  InvoiceLine,
  Payment,
  Project,
  ProjectStatus,
  Task,
} from "./types";

/** All money is handled as integer cents. Never sum floats for currency. */
export const TODAY = "2026-02-16";

export const money = (cents: number, opts: { compact?: boolean; cents?: boolean } = {}) => {
  const value = cents / 100;
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    notation: opts.compact && Math.abs(value) >= 1000 ? "compact" : "standard",
    maximumFractionDigits: opts.compact && Math.abs(value) >= 1000 ? 1 : opts.cents ? 2 : 0,
    minimumFractionDigits: opts.compact && Math.abs(value) >= 1000 ? 0 : opts.cents ? 2 : 0,
  }).format(value);
};

export const parseMoneyToCents = (input: string): number => {
  const cleaned = input.replace(/[^0-9.-]/g, "");
  const value = Number.parseFloat(cleaned);
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100);
};

export const dateLong = (iso?: string) =>
  iso
    ? new Date(`${iso}T12:00:00`).toLocaleDateString("en-CA", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "—";

export const dateShort = (iso?: string) =>
  iso
    ? new Date(`${iso}T12:00:00`).toLocaleDateString("en-CA", {
        month: "short",
        day: "numeric",
      })
    : "—";

export const daysBetween = (from: string, to: string) =>
  Math.round(
    (new Date(`${to}T12:00:00`).getTime() - new Date(`${from}T12:00:00`).getTime()) /
      86_400_000,
  );

export const isOverdue = (date?: string) => !!date && date < TODAY;

export const invoiceSubtotal = (inv: Invoice) =>
  inv.lines.reduce(
    (sum, l) => sum + Math.round(l.quantity * l.unitPriceCents),
    0,
  );

export const lineNet = (line: InvoiceLine) => Math.round(line.quantity * line.unitPriceCents);

export const invoiceTaxes = (inv: Invoice) => {
  const gross = invoiceSubtotal(inv);
  const discountRatio = gross === 0 ? 1 : Math.max(0, gross - inv.discountCents) / gross;
  const byRate = new Map<number, number>();
  inv.lines.forEach((line) => {
    const net = Math.round(lineNet(line) * discountRatio);
    byRate.set(line.taxRate, (byRate.get(line.taxRate) ?? 0) + net);
  });
  return Array.from(byRate.entries()).map(([rate, base]) => ({
    rate,
    baseCents: base,
    taxCents: Math.round((base * rate) / 100),
  }));
};

export const invoiceTaxTotal = (inv: Invoice) =>
  invoiceTaxes(inv).reduce((sum, t) => sum + t.taxCents, 0);

export const invoiceTotal = (inv: Invoice) =>
  invoiceSubtotal(inv) - inv.discountCents + invoiceTaxTotal(inv);

export const paymentsForInvoice = (invoiceId: string, payments: Payment[]) =>
  payments.reduce(
    (sum, p) =>
      sum +
      p.allocations
        .filter((a) => a.invoiceId === invoiceId)
        .reduce((s, a) => s + a.amountCents, 0),
    0,
  );

export const invoicePaid = (inv: Invoice, payments: Payment[]) =>
  paymentsForInvoice(inv.id, payments);

export const invoiceBalance = (inv: Invoice, payments: Payment[]) =>
  Math.max(0, invoiceTotal(inv) - invoicePaid(inv, payments));

/** Only approved invoices contribute to invoiced/incurred totals. */
export const invoiceIsBillable = (inv: Invoice) => inv.approval === "Approved";

export const paymentStatusFor = (
  inv: Invoice,
  payments: Payment[],
): "Unpaid" | "Partially Paid" | "Paid" | "Overdue" => {
  if (inv.approval === "Rejected" || inv.approval === "Cancelled") return "Unpaid";
  const total = invoiceTotal(inv);
  const paid = invoicePaid(inv, payments);
  if (paid >= total && total > 0) return "Paid";
  if (paid > 0) return "Partially Paid";
  return inv.dueDate < TODAY ? "Overdue" : "Unpaid";
};

export const approvedChangeOrderTotal = (project: Project) =>
  project.changeOrders
    .filter((c) => c.approval === "Approved")
    .reduce((sum, c) => sum + c.costDeltaCents, 0);

export const approvedScheduleImpact = (project: Project) =>
  project.changeOrders
    .filter((c) => c.approval === "Approved")
    .reduce((sum, c) => sum + c.scheduleImpactDays, 0);

export const currentApprovedBudget = (project: Project) =>
  project.originalBudgetCents + approvedChangeOrderTotal(project);

export interface ProjectFinancials {
  originalBudget: number;
  budgetChanges: number;
  currentBudget: number;
  contingency: number;
  committed: number;
  incurred: number;
  invoiced: number;
  paid: number;
  outstanding: number;
  forecastFinal: number;
  variance: number;
  remaining: number;
  utilisation: number;
  overBudget: boolean;
  budgetHealth: "On track" | "At risk" | "Over budget";
  pendingInvoices: number;
  outstandingPayables: number;
  approvedExpenseTotal: number;
  invoiceDerivedCost: number;
}

/**
 * Financial definitions (no double counting):
 * - Committed  = active project contracts (the award value, not cash).
 * - Incurred   = approved operating expenses + approved invoices not already
 *                represented by an expense. Invoices are the controlling
 *                cost record for contracted work.
 * - Invoiced   = billable invoices, independent from expenses.
 * - Paid       = recorded payment transactions (cash out).
 * - Outstanding = invoiced − paid. Never added to incurred.
 * - Forecast   = incurred + open committed balance not yet invoiced.
 */
export const projectFinancials = (project: Project): ProjectFinancials => {
  const originalBudget = project.originalBudgetCents;
  const budgetChanges = approvedChangeOrderTotal(project);
  const currentBudget = originalBudget + budgetChanges;

  const committed = project.team
    .filter((t) => t.status === "Active" || t.status === "Assigned")
    .reduce((sum, t) => sum + t.contractAmountCents, 0);

  const approvedExpenseTotal = project.expenses
    .filter((e) => e.approval === "Approved" && !e.sourceInvoiceId)
    .reduce((sum, e) => sum + e.totalCents, 0);

  const billable = project.invoices.filter(invoiceIsBillable);
  const invoiced = billable.reduce((sum, i) => sum + invoiceTotal(i), 0);
  const paid = project.payments.reduce((sum, p) => sum + p.amountCents, 0);
  const outstandingPayables = Math.max(0, invoiced - paid);

  const invoiceDerivedCost = billable.reduce((sum, i) => sum + invoiceTotal(i), 0);
  const incurred = approvedExpenseTotal + invoiceDerivedCost;
  const openCommitted = Math.max(0, committed - invoiced);
  const forecastFinal = Math.max(incurred + openCommitted, paid);
  const variance = currentBudget - forecastFinal;
  const remaining = currentBudget - incurred;
  const utilisation = currentBudget === 0 ? 0 : Math.round((incurred / currentBudget) * 1000) / 10;
  const overBudget = forecastFinal > currentBudget;
  const budgetHealth: ProjectFinancials["budgetHealth"] = overBudget
    ? "Over budget"
    : utilisation >= 80 || variance < currentBudget * 0.08
      ? "At risk"
      : "On track";

  return {
    originalBudget,
    budgetChanges,
    currentBudget,
    contingency: project.contingencyCents,
    committed,
    incurred,
    invoiced,
    paid,
    outstanding: outstandingPayables,
    forecastFinal,
    variance,
    remaining,
    utilisation,
    overBudget,
    budgetHealth,
    pendingInvoices: project.invoices.filter((i) => i.approval === "Pending Approval").length,
    outstandingPayables,
    approvedExpenseTotal,
    invoiceDerivedCost,
  };
};

export const taskProgress = (tasks: Task[]) => {
  if (!tasks.length) return 0;
  const complete = tasks.filter((t) => t.status === "Completed").length;
  return Math.round((complete / tasks.length) * 100);
};

export const projectProgress = (project: Project) => {
  const taskPct = taskProgress(project.tasks);
  const milestonePct = project.milestones.length
    ? Math.round(
        (project.milestones.filter((m) => m.status === "Completed").length /
          project.milestones.length) *
          100,
      )
    : 0;
  if (project.status === "Completed") return 100;
  if (project.status === "Draft" || project.status === "Planned") return Math.min(taskPct, 15);
  return Math.round(taskPct * 0.6 + milestonePct * 0.4);
};

export const projectHealthFlags = (project: Project) => {
  const fin = projectFinancials(project);
  const overdueTasks = project.tasks.filter(
    (t) => t.status !== "Completed" && t.plannedFinish < TODAY,
  );
  const missedMilestones = project.milestones.filter(
    (m) => m.status !== "Completed" && m.plannedDate < TODAY,
  );
  const openDeficiencies = project.deficiencies.filter(
    (d) => d.status === "Open" || d.status === "In Progress",
  );
  const pendingChangeOrders = project.changeOrders.filter(
    (c) => c.approval === "Pending Approval",
  );
  const pendingInvoices = project.invoices.filter((i) => i.approval === "Pending Approval");
  const expiringDocs = project.documents.filter(
    (d) => d.expiryDate && d.expiryDate >= TODAY && daysBetween(TODAY, d.expiryDate) <= 45,
  );
  const delayed =
    project.status !== "Completed" &&
    project.status !== "Cancelled" &&
    project.estimatedCompletion < TODAY;
  return {
    overlay: overdueTasks.length,
    missedMilestones: missedMilestones.length,
    openDeficiencies: openDeficiencies.length,
    pendingChangeOrders: pendingChangeOrders.length,
    pendingInvoices: pendingInvoices.length,
    expiringDocs: expiringDocs.length,
    delayed,
    fin,
  };
};

export const isActiveStatus = (status: ProjectStatus) =>
  status === "In Progress" || status === "Approved" || status === "On Hold";

export const nextStatuses: Record<ProjectStatus, ProjectStatus[]> = {
  Draft: ["Planned", "Cancelled"],
  Planned: ["Approved", "Draft", "Cancelled"],
  Approved: ["In Progress", "On Hold", "Cancelled"],
  "In Progress": ["On Hold", "Completed", "Cancelled"],
  "On Hold": ["In Progress", "Cancelled"],
  Completed: [],
  Cancelled: [],
};

export const canCompleteProject = (project: Project) => {
  const openDeficiencies = project.deficiencies.filter(
    (d) => d.status === "Open" || d.status === "In Progress",
  );
  // A failed inspection is cleared only by a later passing inspection of the
  // same type. A historical failure stays in the audit trail.
  const failedInspectionOutstanding = project.inspections.some(
    (inspection) =>
      inspection.result === "Fail" &&
      !project.inspections.some(
        (later) =>
          later.result === "Pass" &&
          later.type === inspection.type &&
          later.date > inspection.date,
      ),
  );
  const finalInspectionPassed = project.inspections.some(
    (inspection) => inspection.result === "Pass" && inspection.type.toLowerCase().includes("final"),
  );
  const finalInspectionOutstanding = !finalInspectionPassed;
  const reasons: string[] = [];
  if (openDeficiencies.length)
    reasons.push(`${openDeficiencies.length} open deficien${openDeficiencies.length === 1 ? "y" : "ies"}`);
  if (failedInspectionOutstanding) reasons.push("A failed inspection must be reinspected and passed");
  if (finalInspectionOutstanding) reasons.push("A final inspection must be recorded and passed");
  return {
    allowed: reasons.length === 0,
    reasons,
    finalInspectionOutstanding,
    failedInspectionOutstanding,
    openDeficiencyCount: openDeficiencies.length,
  };
};

export const taxLabel = (rate: number) =>
  rate === 0 ? "Tax exempt" : rate === 13 ? `HST ${rate}%` : rate === 5 ? `GST ${rate}%` : `${rate}% tax`;
