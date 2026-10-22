import { loadDepositModule, parseFilters, applyFilters } from "./service";
import { REPORT_DEFINITIONS, buildReport, type ReportKey } from "./reports";
import { ensureSeeded } from "../../db/seed";

function escapeCsv(value: string | number | undefined): string {
  if (value == null) return "";
  const text = String(value);
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

/** Builds the selected deposit report as CSV and saves it from the browser (was a Next.js route handler). */
export async function downloadReportCsv(params: Record<string, string>): Promise<void> {
  await ensureSeeded();
  const requested = params.report ?? "liability";
  const key: ReportKey = (REPORT_DEFINITIONS.some((r) => r.key === requested) ? requested : "liability") as ReportKey;

  const filters = parseFilters(params);
  const data = await loadDepositModule();
  const filtered = applyFilters(data.deposits, filters, data.today);
  const report = buildReport(key, filtered, data, data.today);

  const lines: string[] = [];
  lines.push(`Meridian Property Group — ${report.title}`);
  lines.push(`Generated,${new Date().toISOString()}`);
  lines.push(`Filters,${escapeCsv(JSON.stringify({ q: filters.q, propertyId: filters.propertyId, depositType: filters.depositType, status: filters.status, jurisdiction: filters.jurisdiction, expectedFrom: filters.expectedFrom, expectedTo: filters.expectedTo }))}`);
  lines.push("All amounts are simulated demo data. This export does not represent real money movement or a production ledger.");
  lines.push("");
  lines.push(report.columns.map((c) => escapeCsv(c.label)).join(","));
  for (const row of report.rows) {
    lines.push(
      report.columns
        .map((column) => {
          const value = row[column.key];
          if (column.type === "currency" && typeof value === "number") return (value / 100).toFixed(2);
          if (column.type === "percent" && typeof value === "number") return (value / 100).toFixed(2);
          return escapeCsv(value);
        })
        .join(","),
    );
  }
  if (report.totals) {
    lines.push("");
    lines.push(
      ["TOTALS", ...report.columns.slice(1).map((column) => {
        const total = report.totals?.[column.key];
        if (total == null) return "";
        return column.type === "currency" || column.type === "percent" ? (total / 100).toFixed(2) : String(total);
      })].map(escapeCsv).join(","),
    );
  }

  const blob = new Blob([`﻿${lines.join("\n")}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `deposits-${key}-${data.today}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
