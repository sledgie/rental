/** Hash navigation inside the Financial Reports page: no id = the catalog, an id = that report. */
export function go(reportId?: string) {
  window.location.hash = reportId ? `#/financial-reports?report=${encodeURIComponent(reportId)}` : "#/financial-reports";
}
