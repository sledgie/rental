import type { ReportResult } from "../types";
import { csvEscape, formatMoneyPlain } from "./currency";

export function reportToCsv(result: ReportResult): string {
  const lines: string[] = [];
  lines.push(csvEscape(result.title));
  lines.push(csvEscape(result.companyName));
  lines.push(csvEscape(result.propertyLabel));
  lines.push(csvEscape(result.periodLabel));
  if (result.basisLabel) lines.push(csvEscape(result.basisLabel));
  lines.push(csvEscape(`Generated ${result.generatedAt}`));
  lines.push("");
  const headers = result.columns.map((c) => csvEscape(c.label));
  lines.push(headers.join(","));
  result.rows.forEach((row) => {
    const values = result.columns.map((col) => {
      if (col.key === "label") return csvEscape(row.label);
      if (col.key === "amount") return csvEscape(formatMoneyPlain(row.amount));
      if (col.key === "priorAmount") return csvEscape(row.priorAmount == null ? "" : formatMoneyPlain(row.priorAmount));
      if (col.key === "accountCode") return csvEscape(row.accountCode ?? "");
      const meta = row.meta ?? {};
      const raw = meta[col.key];
      if (typeof raw === "number") {
        return col.format === "money" ? csvEscape(formatMoneyPlain(raw)) : csvEscape(raw);
      }
      return csvEscape(raw ?? "");
    });
    lines.push(values.join(","));
  });
  if (result.notes.length) {
    lines.push("");
    lines.push("Notes");
    result.notes.forEach((n) => lines.push(csvEscape(n)));
  }
  return lines.join("\r\n");
}

export function downloadCsv(result: ReportResult) {
  const csv = reportToCsv(result);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const start = result.filters.startDate;
  const end = result.filters.endDate;
  const filename = `${result.reportId}-${start}-to-${end}.csv`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function printReport() {
  window.print();
}
