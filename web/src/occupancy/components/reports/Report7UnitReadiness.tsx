import React from 'react';
import { ReportFilterState, Unit } from '../../types/occupancy';
import { OccupancyService } from '../../services/occupancyService';
import { ReportHeader } from './ReportHeader';
import { formatDate, formatNumber, formatCurrency } from '../../utils/formatters';
import { exportToCSV } from '../../utils/exportUtils';
import { Wrench, CheckCircle2, Clock, AlertCircle, ArrowRight, ShieldCheck } from 'lucide-react';

interface Report7Props {
  filters: ReportFilterState;
  onBack: () => void;
  onSelectUnit: (unit: Unit) => void;
}

export function Report7UnitReadiness({ filters, onBack, onSelectUnit }: Report7Props) {
  const { rows, totals } = OccupancyService.getUnitTurnoverReport(filters);

  const handleExportCSV = () => {
    exportToCSV({
      filename: `unit-readiness-turnover-${filters.asOfDate}`,
      reportTitle: 'Unit Readiness & Turnover Report',
      reportingPeriod: `As of ${filters.asOfDate}`,
      propertyContext: filters.propertyId === 'all' ? 'All Portfolios' : 'Selected Property',
      columns: [
        { header: 'Property', accessor: (r) => r.propertyName },
        { header: 'Unit', accessor: (r) => r.unitNumber },
        { header: 'Previous Tenant', accessor: (r) => r.previousTenantName },
        { header: 'Move-Out Date', accessor: (r) => formatDate(r.moveOutDate) },
        { header: 'Inspection Status', accessor: (r) => r.inspectionStatus },
        { header: 'Cleaning Status', accessor: (r) => r.cleaningStatus },
        { header: 'Maintenance Status', accessor: (r) => r.maintenanceStatus },
        { header: 'Renovation Status', accessor: (r) => r.renovationStatus },
        { header: 'Ready Date', accessor: (r) => formatDate(r.readyForRentDate) },
        { header: 'Days to Ready', accessor: (r) => r.daysToReady ?? 'In Progress' },
        { header: 'Total Turnover Days', accessor: (r) => r.totalTurnoverDays },
        { header: 'Next Tenant', accessor: (r) => r.nextTenantName || '— Unassigned —' },
        { header: 'Next Move-In', accessor: (r) => formatDate(r.nextMoveInDate) },
        { header: 'Estimated Cost', accessor: (r) => formatCurrency(r.estimatedCost) },
      ],
      data: rows,
      summaryNotes: [
        `Average Days to Ready: ${totals.avgDaysToReady} days (from completed turnovers).`,
        `Average Total Turnover: ${totals.avgTotalTurnoverDays} days from move-out through current as-of date.`,
      ],
    });
  };

  return (
    <div className="space-y-6">
      <ReportHeader
        title="Unit Readiness & Turnover Report"
        reportNumber={7}
        description="Operational oversight tracking turnaround velocity from outgoing tenant inspection through cleaning, repair, renovation, and rent-readiness signoff."
        asOfDate={filters.asOfDate}
        propertyContext={filters.propertyId === 'all' ? 'Portfolio Wide' : 'Selected Property'}
        onBack={onBack}
        onExportCSV={handleExportCSV}
      />

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="rounded-xl border border-u-accent/30 bg-u-accent-soft/50 p-3 text-center shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-u-accent">Avg Days to Ready</span>
          <p className="mt-1 text-2xl font-bold text-u-accent font-mono">{totals.avgDaysToReady} Days</p>
        </div>
        <div className="rounded-xl border border-u-line bg-u-card p-3 text-center shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-u-muted">Avg Total Turn Days</span>
          <p className="mt-1 text-2xl font-bold text-u-ink font-mono">{totals.avgTotalTurnoverDays} Days</p>
        </div>
        <div className="rounded-xl border border-u-warn/30 bg-u-warn-soft/50 p-3 text-center shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-u-warn">Inspection Pending</span>
          <p className="mt-1 text-2xl font-bold text-u-warn font-mono">{totals.awaitingInspection}</p>
        </div>
        <div className="rounded-xl border border-u-danger/30 bg-u-danger-soft/50 p-3 text-center shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-u-danger">Awaiting Maint</span>
          <p className="mt-1 text-2xl font-bold text-u-danger font-mono">{totals.awaitingMaintenance}</p>
        </div>
        <div className="rounded-xl border border-u-ok/30 bg-u-ok-soft/50 p-3 text-center shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-u-ok">Ready for Rent</span>
          <p className="mt-1 text-2xl font-bold text-u-ok font-mono">{totals.readyForLeasing}</p>
        </div>
        <div className="rounded-xl border border-u-blue/30 bg-u-blue-soft/50 p-3 text-center shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-u-blue">Leased / Pending Move</span>
          <p className="mt-1 text-2xl font-bold text-u-blue font-mono">{totals.leasedAwaitingMoveIn}</p>
        </div>
      </div>

      {/* Turnover Pipeline Table */}
      <div className="overflow-hidden rounded-xl border border-u-line bg-u-card shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-u-s2 text-u-ink2 border-b border-u-line">
              <tr>
                <th className="py-3 px-4 font-semibold">Unit & Property</th>
                <th className="py-3 px-3 font-semibold">Previous Tenant</th>
                <th className="py-3 px-3 font-semibold text-center">Move-Out</th>
                <th className="py-3 px-3 font-semibold text-center">Inspection</th>
                <th className="py-3 px-3 font-semibold text-center">Cleaning</th>
                <th className="py-3 px-3 font-semibold text-center">Maintenance</th>
                <th className="py-3 px-3 font-semibold text-center">Renovation</th>
                <th className="py-3 px-3 font-semibold text-center">Ready Date</th>
                <th className="py-3 px-3 font-semibold text-right">Days to Ready</th>
                <th className="py-3 px-3 font-semibold text-right">Turn Days</th>
                <th className="py-3 px-4 font-semibold">Next Tenant</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-u-line">
              {rows.map((r) => {
                const fullUnit = OccupancyService.getUnits().find((u) => u.unitId === r.unitId);

                return (
                  <tr
                    key={r.readinessRecordId}
                    onClick={() => fullUnit && onSelectUnit(fullUnit)}
                    className="cursor-pointer hover:bg-u-accent-soft/40 transition-colors font-medium text-u-ink"
                  >
                    <td className="py-3.5 px-4">
                      <div>
                        <span className="font-bold text-u-accent">Unit {r.unitNumber}</span>
                        <span className="text-[11px] text-u-muted block">{r.propertyName}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-3 text-u-ink2">{r.previousTenantName}</td>
                    <td className="py-3.5 px-3 text-center text-u-muted">{formatDate(r.moveOutDate)}</td>

                    {/* Inspection */}
                    <td className="py-3.5 px-3 text-center">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          r.inspectionStatus === 'Complete'
                            ? 'bg-u-ok-soft text-u-ok'
                            : 'bg-u-warn-soft text-u-warn'
                        }`}
                      >
                        {r.inspectionStatus}
                      </span>
                    </td>

                    {/* Cleaning */}
                    <td className="py-3.5 px-3 text-center">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          r.cleaningStatus === 'Complete'
                            ? 'bg-u-ok-soft text-u-ok'
                            : r.cleaningStatus === 'In Progress'
                            ? 'bg-u-accent-soft text-u-accent'
                            : 'bg-u-warn-soft text-u-warn'
                        }`}
                      >
                        {r.cleaningStatus}
                      </span>
                    </td>

                    {/* Maintenance */}
                    <td className="py-3.5 px-3 text-center">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          r.maintenanceStatus === 'Complete'
                            ? 'bg-u-ok-soft text-u-ok'
                            : r.maintenanceStatus === 'In Progress'
                            ? 'bg-u-accent-soft text-u-accent'
                            : r.maintenanceStatus === 'Required'
                            ? 'bg-u-danger-soft text-u-danger'
                            : 'bg-u-s3 text-u-ink2'
                        }`}
                      >
                        {r.maintenanceStatus}
                      </span>
                    </td>

                    {/* Renovation */}
                    <td className="py-3.5 px-3 text-center">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          r.renovationStatus === 'Complete'
                            ? 'bg-u-ok-soft text-u-ok'
                            : r.renovationStatus === 'In Progress'
                            ? 'bg-u-violet/15 text-u-violet'
                            : r.renovationStatus === 'Required'
                            ? 'bg-u-danger-soft text-u-danger'
                            : 'bg-u-s3 text-u-muted'
                        }`}
                      >
                        {r.renovationStatus}
                      </span>
                    </td>

                    <td className="py-3.5 px-3 text-center font-mono text-u-ink2">
                      {r.readyForRentDate ? formatDate(r.readyForRentDate) : '— In Progress —'}
                    </td>
                    <td className="py-3.5 px-3 text-right font-mono font-bold text-u-accent">
                      {r.daysToReady !== null ? `${r.daysToReady} d` : '—'}
                    </td>
                    <td className="py-3.5 px-3 text-right font-mono font-bold text-u-ink">
                      {r.totalTurnoverDays} d
                    </td>
                    <td className="py-3.5 px-4">
                      {r.nextTenantName ? (
                        <div>
                          <span className="font-bold text-u-blue">{r.nextTenantName}</span>
                          <span className="text-[10px] text-u-muted block">Move-In {formatDate(r.nextMoveInDate)}</span>
                        </div>
                      ) : (
                        <span className="text-u-muted italic">Unassigned</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
