import { dateShort, invoiceTotal, money, projectFinancials, TODAY } from "./finance";
import type { Contractor, Project } from "./types";

const escapeCell = (value: string | number) => {
  const string = String(value ?? "");
  return /[",\n]/.test(string) ? `"${string.replace(/"/g, '""')}"` : string;
};

export function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const content = [headers, ...rows].map((row) => row.map(escapeCell).join(",")).join("\r\n");
  const blob = new Blob([`\uFEFF${content}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function exportProjectsCsv(projects: Project[], contractors: Contractor[]) {
  const headers = [
    "Project ID",
    "Project name",
    "Property",
    "Unit",
    "Type",
    "Status",
    "Priority",
    "Manager",
    "Planned start",
    "Planned completion",
    "Actual completion",
    "Original budget",
    "Approved changes",
    "Current approved budget",
    "Committed",
    "Incurred",
    "Invoiced",
    "Paid",
    "Outstanding payables",
    "Forecast final",
    "Variance",
    "Open deficiencies",
    "Overdue milestones",
    "Contractors",
  ];
  const rows = projects.map((project) => {
    const fin = projectFinancials(project);
    const team = project.team
      .map((member) => contractors.find((c) => c.id === member.contractorId)?.name ?? member.contractorId)
      .join(" | ");
    return [
      project.id,
      project.name,
      project.propertyName,
      project.unitNumber,
      project.type,
      project.status,
      project.priority,
      project.manager,
      project.plannedStart,
      project.estimatedCompletion,
      project.actualCompletion ?? "",
      money(fin.originalBudget),
      money(fin.budgetChanges),
      money(fin.currentBudget),
      money(fin.committed),
      money(fin.incurred),
      money(fin.invoiced),
      money(fin.paid),
      money(fin.outstanding),
      money(fin.forecastFinal),
      money(fin.variance),
      project.deficiencies.filter((d) => d.status === "Open" || d.status === "In Progress").length,
      project.milestones.filter((m) => m.status !== "Completed" && m.plannedDate < TODAY).length,
      team,
    ];
  });
  downloadCsv(`habitat-renovation-projects-${TODAY}.csv`, headers, rows);
}

export function exportInvoiceCsv(projects: Project[]) {
  const rows = projects.flatMap((project) =>
    project.invoices.map((invoice) => {
      const paid = project.payments.reduce(
        (sum, payment) => sum + payment.allocations.filter((a) => a.invoiceId === invoice.id).reduce((s, a) => s + a.amountCents, 0),
        0,
      );
      return [
        invoice.number,
        project.id,
        project.propertyName,
        project.unitNumber,
        invoice.vendorName,
        invoice.invoiceDate,
        invoice.dueDate,
        invoice.approval,
        money(invoiceTotal(invoice)),
        money(paid),
        money(Math.max(0, invoiceTotal(invoice) - paid)),
      ];
    }),
  );
  downloadCsv(
    `habitat-invoices-${TODAY}.csv`,
    ["Invoice", "Project", "Property", "Unit", "Vendor", "Invoice date", "Due date", "Approval", "Total", "Paid", "Balance"],
    rows,
  );
}

export function exportContractorSpendCsv(projects: Project[], contractors: Contractor[]) {
  const rows = contractors.map((contractor) => {
    const relevant = projects.filter((project) => project.team.some((member) => member.contractorId === contractor.id));
    const committed = relevant.reduce(
      (sum, project) => sum + project.team.filter((member) => member.contractorId === contractor.id).reduce((s, member) => s + member.contractAmountCents, 0),
      0,
    );
    const invoiced = relevant.reduce(
      (sum, project) => sum + project.invoices.filter((invoice) => invoice.vendorId === contractor.id).reduce((s, invoice) => s + invoiceTotal(invoice), 0),
      0,
    );
    const paid = relevant.reduce(
      (sum, project) =>
        sum +
        project.payments
          .filter((payment) => payment.payeeId === contractor.id)
          .reduce((s, payment) => s + payment.amountCents, 0),
      0,
    );
    return [contractor.id, contractor.name, contractor.trade, contractor.active ? "Active" : "Inactive", relevant.length, money(committed), money(invoiced), money(paid), contractor.insuranceExpiry];
  });
  downloadCsv(
    `habitat-contractor-spend-${TODAY}.csv`,
    ["Contractor ID", "Contractor", "Trade", "Status", "Projects", "Committed", "Invoiced", "Paid", "Insurance expiry"],
    rows,
  );
}

export function exportReportSummary(projects: Project[]) {
  const rows = projects.map((project) => {
    const fin = projectFinancials(project);
    const delay = project.estimatedCompletion < TODAY && project.status !== "Completed" && project.status !== "Cancelled";
    return [
      project.id,
      project.propertyName,
      project.unitNumber,
      project.name,
      project.status,
      project.manager,
      dateShort(project.plannedStart),
      dateShort(project.estimatedCompletion),
      delay ? "Yes" : "No",
      money(fin.currentBudget),
      money(fin.incurred),
      money(fin.outstanding),
      money(fin.forecastFinal),
      `${fin.utilisation}%`,
      fin.budgetHealth,
    ];
  });
  downloadCsv(
    `habitat-portfolio-summary-${TODAY}.csv`,
    ["Project", "Property", "Unit", "Name", "Status", "Manager", "Start", "Completion", "Delayed", "Current budget", "Incurred", "Outstanding", "Forecast", "Utilisation", "Budget health"],
    rows,
  );
}
