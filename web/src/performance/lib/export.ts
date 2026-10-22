export interface ExportOptions {
  reportTitle: string;
  scopeDescription: string;
  reportingPeriod: string;
  generatedDate: string;
  filtersApplied: string;
  dataCoverageWarning?: string;
  summaryMetrics?: { label: string; value: string | number }[];
  tableHeaders: string[];
  tableRows: (string | number)[][];
}

export function exportReportToCsv(options: ExportOptions) {
  const lines: string[] = [];

  // Metadata headers
  lines.push(`"${options.reportTitle}"`);
  lines.push(`"Portfolio Scope:","${options.scopeDescription}"`);
  lines.push(`"Reporting Period:","${options.reportingPeriod}"`);
  lines.push(`"Generation Date:","${options.generatedDate}"`);
  lines.push(`"Filters Applied:","${options.filtersApplied}"`);
  if (options.dataCoverageWarning) {
    lines.push(`"Data Completeness Warning:","${options.dataCoverageWarning}"`);
  }
  lines.push("");

  // Summary Metrics Section if provided
  if (options.summaryMetrics && options.summaryMetrics.length > 0) {
    lines.push('"--- Summary Metrics ---"');
    options.summaryMetrics.forEach((m) => {
      lines.push(`"${m.label}","${m.value}"`);
    });
    lines.push("");
  }

  // Data Table
  lines.push('"--- Detailed Record Data ---"');
  lines.push(options.tableHeaders.map((h) => `"${h.replace(/"/g, '""')}"`).join(","));

  options.tableRows.forEach((row) => {
    lines.push(
      row
        .map((cell) => {
          const str = cell !== null && cell !== undefined ? String(cell) : "";
          return `"${str.replace(/"/g, '""')}"`;
        })
        .join(",")
    );
  });

  const csvContent = lines.join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const filename = `${options.reportTitle.toLowerCase().replace(/[^a-z0-9]/g, "-")}-${new Date().toISOString().slice(0, 10)}.csv`;
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function triggerPrintReport() {
  window.print();
}
