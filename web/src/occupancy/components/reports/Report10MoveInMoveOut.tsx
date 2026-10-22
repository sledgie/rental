import React from 'react';
import { ReportFilterState } from '../../types/occupancy';
import { OccupancyService } from '../../services/occupancyService';
import { ReportHeader } from './ReportHeader';
import { formatDate } from '../../utils/formatters';
import { exportToCSV } from '../../utils/exportUtils';
import { ArrowUpRight, ArrowDownLeft, Shuffle, Building2, Info } from 'lucide-react';

interface Report10Props {
  filters: ReportFilterState;
  onBack: () => void;
}

export function Report10MoveInMoveOut({ filters, onBack }: Report10Props) {
  const { rows, totals, auditNote } = OccupancyService.getMoveInMoveOutReport(filters);

  const handleExportCSV = () => {
    exportToCSV({
      filename: `movein-moveout-${filters.asOfDate}`,
      reportTitle: 'Move-In / Move-Out Report',
      reportingPeriod: `As of ${filters.asOfDate}`,
      propertyContext: filters.propertyId === 'all' ? 'All Portfolios' : 'Selected Property',
      columns: [
        { header: 'Tenant Name', accessor: (r) => r.tenantName },
        { header: 'Property', accessor: (r) => r.propertyName },
        { header: 'Unit', accessor: (r) => r.unitNumber },
        { header: 'Lease Number', accessor: (r) => r.leaseNumber },
        { header: 'Movement Type', accessor: (r) => r.movementType },
        { header: 'Scheduled Date', accessor: (r) => formatDate(r.scheduledDate) },
        { header: 'Actual Date', accessor: (r) => formatDate(r.actualDate) },
        { header: 'Previous Status', accessor: (r) => r.previousUnitStatus },
        { header: 'New Status', accessor: (r) => r.newUnitStatus },
        { header: 'Turnover Ref', accessor: (r) => r.turnoverReference },
      ],
      data: rows,
      summaryNotes: [auditNote],
    });
  };

  return (
    <div className="space-y-6">
      <ReportHeader
        title="Move-In / Move-Out Report"
        reportNumber={10}
        description="Comprehensive audit log of tenant movement events including move-ins, move-outs, and intra-portfolio unit transfers."
        asOfDate={filters.asOfDate}
        propertyContext={filters.propertyId === 'all' ? 'Portfolio Wide' : 'Selected Property'}
        onBack={onBack}
        onExportCSV={handleExportCSV}
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-u-line bg-u-card p-3.5 text-center shadow-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-u-muted">Total Movements</span>
          <p className="mt-1 text-2xl font-bold text-u-ink font-mono">{totals.totalEvents}</p>
        </div>
        <div className="rounded-xl border border-u-ok/30 bg-u-ok-soft/50 p-3.5 text-center shadow-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-u-ok">Move-Ins</span>
          <p className="mt-1 text-2xl font-bold text-u-ok font-mono">{totals.moveIns}</p>
        </div>
        <div className="rounded-xl border border-u-danger/30 bg-u-danger-soft/50 p-3.5 text-center shadow-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-u-danger">Move-Outs</span>
          <p className="mt-1 text-2xl font-bold text-u-danger font-mono">{totals.moveOuts}</p>
        </div>
        <div className="rounded-xl border border-u-blue/30 bg-u-blue-soft/50 p-3.5 text-center shadow-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-u-blue">Intra-Portfolio Transfers</span>
          <p className="mt-1 text-2xl font-bold text-u-blue font-mono">{totals.transfers}</p>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-u-line bg-u-card shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-u-s2 text-u-ink2 border-b border-u-line">
              <tr>
                <th className="py-3 px-4 font-semibold">Tenant</th>
                <th className="py-3 px-3 font-semibold">Property</th>
                <th className="py-3 px-3 font-semibold">Unit</th>
                <th className="py-3 px-3 font-semibold">Movement Type</th>
                <th className="py-3 px-3 font-semibold text-center">Scheduled Date</th>
                <th className="py-3 px-3 font-semibold text-center">Actual Date</th>
                <th className="py-3 px-3 font-semibold">Previous Status</th>
                <th className="py-3 px-3 font-semibold">New Status</th>
                <th className="py-3 px-4 font-semibold">Turnover Ref</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-u-line">
              {rows.map((r) => {
                const isMoveIn = r.movementType === 'Move-In';
                const isMoveOut = r.movementType === 'Move-Out';
                const isTransfer = r.movementType.includes('Transfer');

                return (
                  <tr key={r.movementId} className="hover:bg-u-s2 transition-colors font-medium text-u-ink">
                    <td className="py-3 px-4 font-bold text-u-ink">{r.tenantName}</td>
                    <td className="py-3 px-3 text-u-ink2">{r.propertyName}</td>
                    <td className="py-3 px-3 font-semibold text-u-accent">{r.unitNumber}</td>
                    <td className="py-3 px-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                          isMoveIn
                            ? 'bg-u-ok-soft text-u-ok'
                            : isMoveOut
                            ? 'bg-u-danger-soft text-u-danger'
                            : 'bg-u-blue-soft text-u-blue'
                        }`}
                      >
                        {isMoveIn && <ArrowDownLeft className="h-3 w-3" />}
                        {isMoveOut && <ArrowUpRight className="h-3 w-3" />}
                        {isTransfer && <Shuffle className="h-3 w-3" />}
                        <span>{r.movementType}</span>
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center text-u-ink2 font-mono">{formatDate(r.scheduledDate)}</td>
                    <td className="py-3 px-3 text-center font-mono">
                      {r.actualDate ? (
                        <span className="font-semibold text-u-ink">{formatDate(r.actualDate)}</span>
                      ) : (
                        <span className="text-u-warn bg-u-warn-soft rounded px-1 py-0.5">Scheduled</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-u-ink2">{r.previousUnitStatus}</td>
                    <td className="py-3 px-3 font-medium text-u-ink">{r.newUnitStatus}</td>
                    <td className="py-3 px-4 font-mono text-u-muted">{r.turnoverReference}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-u-line bg-u-s2 p-4 text-xs text-u-ink2 flex items-start gap-2.5">
        <Info className="h-4 w-4 text-u-accent shrink-0 mt-0.5" />
        <p className="leading-relaxed">{auditNote}</p>
      </div>
    </div>
  );
}
