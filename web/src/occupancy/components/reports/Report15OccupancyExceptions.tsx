import React, { useState } from 'react';
import { ReportFilterState, OccupancyException } from '../../types/occupancy';
import { OccupancyService } from '../../services/occupancyService';
import { ReportHeader } from './ReportHeader';
import { formatDate } from '../../utils/formatters';
import { exportToCSV } from '../../utils/exportUtils';
import { ExceptionReviewModal } from '../modals/ExceptionReviewModal';
import { ShieldAlert, AlertTriangle, CheckCircle2, Clock, CheckCheck } from 'lucide-react';

interface Report15Props {
  filters: ReportFilterState;
  onBack: () => void;
}

export function Report15OccupancyExceptions({ filters, onBack }: Report15Props) {
  const [selectedException, setSelectedException] = useState<OccupancyException | null>(null);
  const [statusRefreshCount, setStatusRefreshCount] = useState(0);

  const { rows, totals } = OccupancyService.getOccupancyExceptions(filters);

  const handleUpdateStatus = (exceptionId: string, status: 'Open' | 'Under Review' | 'Resolved') => {
    OccupancyService.updateExceptionStatus(exceptionId, status);
    setStatusRefreshCount((c) => c + 1);
  };

  const handleExportCSV = () => {
    exportToCSV({
      filename: `occupancy-exceptions-${filters.asOfDate}`,
      reportTitle: 'Occupancy Exception Report',
      reportingPeriod: `As of ${filters.asOfDate}`,
      propertyContext: filters.propertyId === 'all' ? 'All Portfolios' : 'Selected Property',
      columns: [
        { header: 'Exception Type', accessor: (r) => r.exceptionType },
        { header: 'Severity', accessor: (r) => r.severity },
        { header: 'Property', accessor: (r) => r.propertyName },
        { header: 'Unit', accessor: (r) => r.unitNumber },
        { header: 'Related Lease', accessor: (r) => r.leaseNumber || '—' },
        { header: 'Description', accessor: (r) => r.description },
        { header: 'Recommended Action', accessor: (r) => r.recommendedAction },
        { header: 'Resolution Status', accessor: (r) => r.status },
        { header: 'Detected Date', accessor: (r) => formatDate(r.detectedDate) },
      ],
      data: rows,
      summaryNotes: [
        'Diagnostic data-quality report. Manual review required before updating operational source records.',
      ],
    });
  };

  return (
    <div className="space-y-6">
      <ReportHeader
        title="Occupancy Exception Report"
        reportNumber={15}
        description="Diagnostic system audit identifying data conflicts, expired unreviewed leases, overlapping agreements, and rentable classification anomalies."
        asOfDate={filters.asOfDate}
        propertyContext={filters.propertyId === 'all' ? 'Portfolio Wide' : 'Selected Property'}
        onBack={onBack}
        onExportCSV={handleExportCSV}
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-u-danger/30 bg-u-danger-soft/50 p-3.5 text-center shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-u-danger">
            Critical Severity
          </span>
          <p className="mt-1 text-2xl font-bold text-u-danger font-mono">{totals.criticalCount}</p>
        </div>
        <div className="rounded-xl border border-u-warn/30 bg-u-warn-soft/50 p-3.5 text-center shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-u-warn">
            High Severity
          </span>
          <p className="mt-1 text-2xl font-bold text-u-warn font-mono">{totals.highCount}</p>
        </div>
        <div className="rounded-xl border border-u-accent/30 bg-u-accent-soft/50 p-3.5 text-center shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-u-accent">
            Open / Under Review
          </span>
          <p className="mt-1 text-2xl font-bold text-u-accent font-mono">
            {totals.openCount + totals.underReviewCount}
          </p>
        </div>
        <div className="rounded-xl border border-u-ok/30 bg-u-ok-soft/50 p-3.5 text-center shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-u-ok">
            Resolved Exceptions
          </span>
          <p className="mt-1 text-2xl font-bold text-u-ok font-mono">{totals.resolvedCount}</p>
        </div>
      </div>

      {/* Exceptions Table */}
      <div className="overflow-hidden rounded-xl border border-u-line bg-u-card shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-u-s2 text-u-ink2 border-b border-u-line">
              <tr>
                <th className="py-3 px-4 font-semibold">Severity</th>
                <th className="py-3 px-3 font-semibold">Exception Type</th>
                <th className="py-3 px-3 font-semibold">Property & Unit</th>
                <th className="py-3 px-3 font-semibold">Conflict Description</th>
                <th className="py-3 px-3 font-semibold">Recommended Remediation</th>
                <th className="py-3 px-3 font-semibold text-center">Status</th>
                <th className="py-3 px-4 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-u-line">
              {rows.map((r) => {
                const isCritical = r.severity === 'Critical';
                const isHigh = r.severity === 'High';

                return (
                  <tr key={r.exceptionId} className="hover:bg-u-s2 transition-colors font-medium text-u-ink">
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                          isCritical
                            ? 'bg-u-danger-soft text-u-danger border border-u-danger/30'
                            : isHigh
                            ? 'bg-u-warn-soft text-u-warn border border-u-warn/30'
                            : 'bg-u-s3 text-u-ink2 border border-u-line'
                        }`}
                      >
                        <ShieldAlert className="h-3 w-3" />
                        <span>{r.severity}</span>
                      </span>
                    </td>
                    <td className="py-3.5 px-3 font-bold text-u-ink">{r.exceptionType}</td>
                    <td className="py-3.5 px-3">
                      <span className="font-semibold text-u-accent">{r.propertyName}</span>
                      <span className="text-u-muted block text-[11px]">Unit {r.unitNumber}</span>
                    </td>
                    <td className="py-3.5 px-3 text-u-ink2 max-w-xs">{r.description}</td>
                    <td className="py-3.5 px-3 text-u-accent bg-u-accent-soft/40 p-2 rounded-lg max-w-xs">
                      {r.recommendedAction}
                    </td>
                    <td className="py-3.5 px-3 text-center">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                          r.status === 'Resolved'
                            ? 'bg-u-ok-soft text-u-ok'
                            : r.status === 'Under Review'
                            ? 'bg-u-accent-soft text-u-accent'
                            : 'bg-u-warn-soft text-u-warn'
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedException(r)}
                        className="rounded-lg border border-u-line bg-u-card px-2.5 py-1 text-xs font-semibold text-u-accent hover:bg-u-accent-soft transition-colors shadow-2xs"
                      >
                        Review Action
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Exception Review Modal */}
      {selectedException && (
        <ExceptionReviewModal
          exception={selectedException}
          onClose={() => setSelectedException(null)}
          onUpdateStatus={handleUpdateStatus}
        />
      )}
    </div>
  );
}
