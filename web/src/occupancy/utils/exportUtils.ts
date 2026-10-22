export interface ExportColumn<T> {
  header: string;
  accessor: (item: T) => string | number | null | undefined;
}

export function exportToCSV<T>({
  filename,
  reportTitle,
  reportingPeriod,
  propertyContext,
  columns,
  data,
  summaryNotes,
}: {
  filename: string;
  reportTitle: string;
  reportingPeriod: string;
  propertyContext: string;
  columns: ExportColumn<T>[];
  data: T[];
  summaryNotes?: string[];
}) {
  const lines: string[] = [];

  // Metadata headers
  lines.push(`"${reportTitle.replace(/"/g, '""')}"`);
  lines.push(`"Reporting Period / As-Of: ${reportingPeriod.replace(/"/g, '""')}"`);
  lines.push(`"Portfolio / Property: ${propertyContext.replace(/"/g, '""')}"`);
  lines.push(`"Generated: ${new Date().toLocaleString('en-CA')}"`);
  lines.push(''); // Empty line before table

  // Table Column Headers
  const headerLine = columns.map((col) => `"${col.header.replace(/"/g, '""')}"`).join(',');
  lines.push(headerLine);

  // Table Data Rows
  data.forEach((item) => {
    const row = columns.map((col) => {
      const val = col.accessor(item);
      if (val === null || val === undefined) {
        return '""';
      }
      return `"${String(val).replace(/"/g, '""')}"`;
    });
    lines.push(row.join(','));
  });

  // Summary Notes & Definitions
  if (summaryNotes && summaryNotes.length > 0) {
    lines.push('');
    lines.push('"--- REPORT NOTES & DEFINITIONS ---"');
    summaryNotes.forEach((note) => {
      lines.push(`"${note.replace(/"/g, '""')}"`);
    });
  }

  const csvContent = lines.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
