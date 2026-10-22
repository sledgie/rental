import React from 'react';
import { ReportFilterState, Unit } from '../../types/occupancy';
import { OccupancyService } from '../../services/occupancyService';
import { ReportHeader } from './ReportHeader';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { exportToCSV } from '../../utils/exportUtils';
import { Calendar, Clock, UserCheck, AlertCircle } from 'lucide-react';

interface Report14Props {
  filters: ReportFilterState;
  onBack: () => void;
  onSelectUnit: (unit: Unit) => void;
}

export function Report14FutureAvailability({ filters, onBack, onSelectUnit }: Report14Props) {
  const { rows, totals } = OccupancyService.getFutureAvailabilityReport(filters);

  const handleExportCSV = () => {
    exportToCSV({
      filename: `pre-leased-future-availability-${filters.asOfDate}`,
      reportTitle: 'Pre-Leased & Future Availability Report',
      reportingPeriod: `As of ${filters.asOfDate}`,
      propertyContext: filters.propertyId === 'all' ? 'All Portfolios' : 'Selected Property',
      columns: [
        { header: 'Property', accessor: (r) => r.propertyName },
        { header: 'Unit', accessor: (r) => r.unitNumber },
        { header: 'Category', accessor: (r) => r.category },
        { header: 'Current Status', accessor: (r) => r.currentStatus },
        { header: 'Current Tenant', accessor: (r) => r.currentTenant || '—' },
        { header: 'Scheduled Vacancy', accessor: (r) => formatDate(r.scheduledVacancyDate) },
        { header: 'Future Available', accessor: (r) => formatDate(r.futureAvailabilityDate) },
        { header: 'Next Lease Start', accessor: (r) => formatDate(r.nextLeaseStartDate) },
        { header: 'Next Tenant', accessor: (r) => r.nextTenant || '—' },
        { header: 'Expected Rent', accessor: (r) => formatCurrency(r.expectedMonthlyRent) },
      ],
      data: rows,
      summaryNotes: [
        'Future availability represents projected inventory shifts and is not counted as current physical vacancy before the effective date.',
      ],
    });
  };

  return (
    <div className="space-y-6">
      <ReportHeader
        title="Pre-Leased & Future Availability Report"
        reportNumber={14}
        description="Forward-looking projection of inventory turnover. Tracks occupied suites with confirmed move-out notices, pre-leased incoming leases, and future release dates."
        asOfDate={filters.asOfDate}
        propertyContext={filters.propertyId === 'all' ? 'Portfolio Wide' : 'Selected Property'}
        onBack={onBack}
        onExportCSV={handleExportCSV}
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-u-blue/30 bg-u-blue-soft/50 p-3.5 text-center shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-u-blue">
            Leased for Future Move-In
          </span>
          <p className="mt-1 text-2xl font-bold text-u-blue font-mono">
            {totals.leasedForFutureMoveIn} Units
          </p>
        </div>
        <div className="rounded-xl border border-u-violet/30 bg-u-violet/10 p-3.5 text-center shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-u-violet">
            Vacant but Reserved
          </span>
          <p className="mt-1 text-2xl font-bold text-u-violet font-mono">
            {totals.vacantReserved} Units
          </p>
        </div>
        <div className="rounded-xl border border-u-warn/30 bg-u-warn-soft/50 p-3.5 text-center shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-u-warn">
            Occupied (Notice Received)
          </span>
          <p className="mt-1 text-2xl font-bold text-u-warn font-mono">
            {totals.occupiedPendingVacancy} Units
          </p>
        </div>
        <div className="rounded-xl border border-u-ok/30 bg-u-ok-soft/50 p-3.5 text-center shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-u-ok">
            Vacant & Available Now
          </span>
          <p className="mt-1 text-2xl font-bold text-u-ok font-mono">
            {totals.currentlyAvailable} Units
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-u-line bg-u-card shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-u-s2 text-u-ink2 border-b border-u-line">
              <tr>
                <th className="py-3 px-4 font-semibold">Property</th>
                <th className="py-3 px-3 font-semibold">Unit</th>
                <th className="py-3 px-3 font-semibold">Inventory Category</th>
                <th className="py-3 px-3 font-semibold">Current Tenant</th>
                <th className="py-3 px-3 font-semibold text-center">Scheduled Vacancy</th>
                <th className="py-3 px-3 font-semibold text-center">Future Available Date</th>
                <th className="py-3 px-3 font-semibold text-center">Next Lease Start</th>
                <th className="py-3 px-3 font-semibold">Next Tenant</th>
                <th className="py-3 px-4 font-semibold text-right">Expected Rent</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-u-line">
              {rows.map((r) => {
                const fullUnit = OccupancyService.getUnits().find((u) => u.unitId === r.unitId);

                return (
                  <tr
                    key={r.unitId}
                    onClick={() => fullUnit && onSelectUnit(fullUnit)}
                    className="cursor-pointer hover:bg-u-accent-soft/40 transition-colors font-medium text-u-ink"
                  >
                    <td className="py-3.5 px-4 font-bold text-u-ink">{r.propertyName}</td>
                    <td className="py-3.5 px-3 font-bold text-u-accent">Unit {r.unitNumber}</td>
                    <td className="py-3.5 px-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          r.category === 'Leased for Future Move-In'
                            ? 'bg-u-blue-soft text-u-blue'
                            : r.category === 'Vacant but Reserved'
                            ? 'bg-u-violet/15 text-u-violet'
                            : r.category === 'Occupied — Vacancy Scheduled'
                            ? 'bg-u-warn-soft text-u-warn'
                            : 'bg-u-ok-soft text-u-ok'
                        }`}
                      >
                        {r.category}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-u-ink2">{r.currentTenant || '—'}</td>
                    <td className="py-3.5 px-3 text-center text-u-ink2 font-mono">
                      {formatDate(r.scheduledVacancyDate)}
                    </td>
                    <td className="py-3.5 px-3 text-center text-u-ink2 font-mono">
                      {formatDate(r.futureAvailabilityDate)}
                    </td>
                    <td className="py-3.5 px-3 text-center font-mono font-semibold text-u-accent">
                      {formatDate(r.nextLeaseStartDate)}
                    </td>
                    <td className="py-3.5 px-3 font-semibold text-u-blue">{r.nextTenant || '— Unassigned —'}</td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-u-ink">
                      {formatCurrency(r.expectedMonthlyRent)}
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
