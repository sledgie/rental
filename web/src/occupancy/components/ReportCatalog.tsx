import React from 'react';
import { REPORTS_CATALOG } from '../mock/reportsCatalog';
import { FileText, ArrowRight, Clock } from 'lucide-react';

interface ReportCatalogProps {
  reportIds: string[];
  showRecent: boolean;
  recentReportIds: string[];
  onSelectReport: (reportId: string) => void;
  onClear: () => void;
}

/** Recently viewed bar and the grid of report cards. Category tabs and search live in the page's directory panel. */
export function ReportCatalog({ reportIds, showRecent, recentReportIds, onSelectReport, onClear }: ReportCatalogProps) {
  const reports = REPORTS_CATALOG.filter((r) => reportIds.includes(r.id));
  const recent = REPORTS_CATALOG.filter((r) => recentReportIds.includes(r.id));

  return (
    <div className="space-y-5 p-4">
      {showRecent && recent.length > 0 && (
        <div className="rounded-xl border border-u-line bg-u-s2 p-3.5">
          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-u-muted mb-2">
            <Clock className="h-3.5 w-3.5" />
            <span>Recently Viewed Reports</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {recent.map((rec) => (
              <button
                key={rec.id}
                type="button"
                onClick={() => onSelectReport(rec.id)}
                className="flex items-center justify-between rounded-lg border border-u-line bg-u-card p-2.5 text-left hover:border-u-accent transition-colors group"
              >
                <div className="truncate mr-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold text-u-accent font-mono">#{rec.number}</span>
                    <span className="text-xs font-semibold text-u-ink group-hover:text-u-accent truncate">{rec.title}</span>
                  </div>
                  <span className="text-[11px] text-u-muted">{rec.categoryLabel}</span>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-u-muted group-hover:text-u-accent shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {reports.map((report) => (
          <button
            key={report.id}
            type="button"
            onClick={() => onSelectReport(report.id)}
            className="group flex flex-col justify-between rounded-xl border border-u-line bg-u-card p-5 text-left hover:border-u-accent hover:bg-u-s2 transition-colors"
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-u-accent-soft text-[11px] font-bold text-u-accent font-mono">
                  #{report.number}
                </span>
                <div className="flex items-center gap-1.5">
                  {report.isPrimaryScope && (
                    <span className="rounded-full bg-u-ok-soft px-2 py-0.5 text-[10px] font-bold text-u-ok border border-u-ok/30">Primary Scope</span>
                  )}
                  <span className="rounded-full bg-u-s3 px-2 py-0.5 text-[10px] font-medium text-u-ink2">{report.categoryLabel}</span>
                </div>
              </div>
              <h3 className="text-sm font-bold text-u-ink group-hover:text-u-accent transition-colors">{report.title}</h3>
              <p className="mt-1.5 text-xs text-u-muted leading-relaxed">{report.description}</p>
              <div className="mt-3 flex flex-wrap gap-1">
                {report.keyOutputs.map((output) => (
                  <span key={output} className="rounded bg-u-s2 px-1.5 py-0.5 text-[10px] font-medium text-u-ink2 border border-u-line">{output}</span>
                ))}
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-u-line flex items-center justify-between">
              <span className="text-[11px] text-u-muted capitalize">{report.defaultPeriodType} Report</span>
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-u-accent">
                <span>Generate Report</span>
                <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
              </span>
            </div>
          </button>
        ))}
      </div>

      {reports.length === 0 && (
        <div className="rounded-xl border border-dashed border-u-line bg-u-s2 p-12 text-center">
          <FileText className="mx-auto h-8 w-8 text-u-muted mb-2" />
          <h4 className="text-sm font-bold text-u-ink">No matching reports found</h4>
          <p className="text-xs text-u-muted mt-1">Try searching with a different keyword or select &quot;All Reports&quot;.</p>
          <button type="button" onClick={onClear} className="mt-3 rounded-lg bg-u-accent px-3 py-1.5 text-xs font-semibold text-u-onaccent hover:bg-u-accent-strong">
            Clear search
          </button>
        </div>
      )}
    </div>
  );
}
