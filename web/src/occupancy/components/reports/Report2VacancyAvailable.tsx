import React, { useState } from 'react';
import { ReportFilterState, Unit } from '../../types/occupancy';
import { OccupancyService } from '../../services/occupancyService';
import { ReportHeader } from './ReportHeader';
import { formatCurrency, formatDate, formatNumber } from '../../utils/formatters';
import { exportToCSV } from '../../utils/exportUtils';
import { AlertCircle, Clock, CheckCircle2, Wrench, Sparkles, Filter, Calendar } from 'lucide-react';

interface Report2Props {
  filters: ReportFilterState;
  onBack: () => void;
  onSelectUnit: (unit: Unit) => void;
}

export function Report2VacancyAvailable({ filters, onBack, onSelectUnit }: Report2Props) {
  const [selectedThreshold, setSelectedThreshold] = useState<number>(filters.thresholdDays || 0);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { rows, totals } = OccupancyService.getVacancyReport(filters);

  // Additional local filters
  const filteredRows = rows.filter((r) => {
    if (selectedThreshold > 0 && r.daysVacant < selectedThreshold) return false;
    if (statusFilter !== 'all' && r.currentOccupancyStatus !== statusFilter) return false;
    return true;
  });

  const handleExportCSV = () => {
    exportToCSV({
      filename: `vacancy-available-${filters.asOfDate}`,
      reportTitle: 'Vacancy & Available Units Report',
      reportingPeriod: `As of ${filters.asOfDate}`,
      propertyContext: filters.propertyId === 'all' ? 'All Portfolios' : 'Selected Property',
      columns: [
        { header: 'Property', accessor: (r) => r.propertyName },
        { header: 'Unit', accessor: (r) => r.unitNumber },
        { header: 'Unit Type', accessor: (r) => r.unitType },
        { header: 'Floor', accessor: (r) => r.floor },
        { header: 'Market Rent', accessor: (r) => formatCurrency(r.marketRent) },
        { header: 'Asking Rent', accessor: (r) => formatCurrency(r.askingRent) },
        { header: 'Vacancy Start Date', accessor: (r) => formatDate(r.vacancyStartDate) },
        { header: 'Days Vacant', accessor: (r) => r.daysVacant },
        { header: 'Accrued Loss', accessor: (r) => formatCurrency(r.accruedVacancyLoss) },
        { header: 'Readiness Status', accessor: (r) => r.readinessStatus },
        { header: 'Expected Available', accessor: (r) => formatDate(r.expectedAvailableDate) },
        { header: 'Next Move-In', accessor: (r) => formatDate(r.nextScheduledMoveInDate) },
        { header: 'Agent', accessor: (r) => r.assignedLeasingAgent || '—' },
      ],
      data: filteredRows,
      summaryNotes: [
        `Days Vacant calculated from vacancy start date through as-of date: ${filters.asOfDate}.`,
        'Accrued vacancy loss represents (Monthly Market Rent ÷ 30.417) × Days Vacant.',
      ],
    });
  };

  return (
    <div className="space-y-6">
      <ReportHeader
        title="Vacancy & Available Units Report"
        reportNumber={2}
        description="Comprehensive audit of unleased and available units, turnover readiness pipelines, days vacant calculated from as-of date, and scheduled move-ins."
        asOfDate={filters.asOfDate}
        propertyContext={filters.propertyId === 'all' ? 'Portfolio Wide' : 'Filtered Property'}
        onBack={onBack}
        onExportCSV={handleExportCSV}
      />

      {/* Metric Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="rounded-xl border border-u-line bg-u-card p-3 text-center shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-u-muted">Vacant / Available</span>
          <p className="mt-1 text-xl font-bold text-u-ink font-mono">{totals.totalVacantUnits}</p>
        </div>
        <div className="rounded-xl border border-u-ok/30 bg-u-ok-soft/50 p-3 text-center shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-u-ok">Ready for Rent</span>
          <p className="mt-1 text-xl font-bold text-u-ok font-mono">{totals.readyUnits}</p>
        </div>
        <div className="rounded-xl border border-u-warn/30 bg-u-warn-soft/50 p-3 text-center shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-u-warn">Cleaning & Turn</span>
          <p className="mt-1 text-xl font-bold text-u-warn font-mono">{totals.cleaningUnits}</p>
        </div>
        <div className="rounded-xl border border-u-danger/30 bg-u-danger-soft/50 p-3 text-center shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-u-danger">Maint / Renovation</span>
          <p className="mt-1 text-xl font-bold text-u-danger font-mono">{totals.maintenanceUnits}</p>
        </div>
        <div className="rounded-xl border border-u-blue/30 bg-u-blue-soft/50 p-3 text-center shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-u-blue">Reserved / Leased</span>
          <p className="mt-1 text-xl font-bold text-u-blue font-mono">{totals.reservedOrLeasedUnits}</p>
        </div>
        <div className="rounded-xl border border-u-line bg-u-card p-3 text-center shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-u-muted">Avg Days Vacant</span>
          <p className="mt-1 text-xl font-bold text-u-accent font-mono">{totals.avgDaysVacant} Days</p>
        </div>
      </div>

      {/* Local Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-u-line bg-u-card p-3 shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-u-muted flex items-center gap-1">
            <Filter className="h-3.5 w-3.5" />
            Duration Threshold:
          </span>
          {[
            { label: 'All Vacant', val: 0 },
            { label: '> 30 Days', val: 30 },
            { label: '> 60 Days', val: 60 },
            { label: '> 90 Days', val: 90 },
          ].map((t) => (
            <button
              key={t.val}
              type="button"
              onClick={() => setSelectedThreshold(t.val)}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                selectedThreshold === t.val
                  ? 'bg-u-accent text-u-onaccent shadow-xs'
                  : 'bg-u-s2 border border-u-line text-u-ink2 hover:bg-u-s3'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-u-muted">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-u-line bg-u-s2 py-1 px-2.5 text-xs text-u-ink2 focus:outline-none"
          >
            <option value="all">All Vacancy Statuses</option>
            <option value="Vacant — Ready">Vacant — Ready</option>
            <option value="Vacant — Needs Cleaning">Vacant — Needs Cleaning</option>
            <option value="Vacant — Under Maintenance">Vacant — Under Maintenance</option>
            <option value="Vacant — Under Renovation">Vacant — Under Renovation</option>
            <option value="Reserved">Reserved</option>
            <option value="Leased — Awaiting Move-In">Leased — Awaiting Move-In</option>
          </select>
        </div>
      </div>

      {/* Vacancy Table */}
      <div className="overflow-hidden rounded-xl border border-u-line bg-u-card shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-u-s2 text-u-ink2 border-b border-u-line">
              <tr>
                <th className="py-3 px-4 font-semibold">Property</th>
                <th className="py-3 px-3 font-semibold">Unit</th>
                <th className="py-3 px-3 font-semibold">Type</th>
                <th className="py-3 px-3 font-semibold text-center">Floor</th>
                <th className="py-3 px-3 font-semibold text-right">Market Rent</th>
                <th className="py-3 px-3 font-semibold text-right">Asking Rent</th>
                <th className="py-3 px-3 font-semibold text-center">Vacancy Start</th>
                <th className="py-3 px-3 font-semibold text-right">Days Vacant</th>
                <th className="py-3 px-3 font-semibold text-right">Accrued Loss</th>
                <th className="py-3 px-3 font-semibold">Readiness Status</th>
                <th className="py-3 px-3 font-semibold text-center">Available Date</th>
                <th className="py-3 px-4 font-semibold">Assigned Agent / Tenant</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-u-line">
              {filteredRows.map((row) => {
                const fullUnit = OccupancyService.getUnits().find((u) => u.unitId === row.unitId);

                // Highlight severe vacancy (>60 days red, >30 days amber)
                const isSevere = row.daysVacant >= 60;
                const isModerate = row.daysVacant >= 30 && row.daysVacant < 60;

                return (
                  <tr
                    key={row.unitId}
                    onClick={() => fullUnit && onSelectUnit(fullUnit)}
                    className="cursor-pointer hover:bg-u-accent-soft/40 transition-colors"
                  >
                    <td className="py-3 px-4 font-semibold text-u-ink">{row.propertyName}</td>
                    <td className="py-3 px-3 font-bold text-u-accent">Unit {row.unitNumber}</td>
                    <td className="py-3 px-3 text-u-ink2">{row.unitType}</td>
                    <td className="py-3 px-3 text-center text-u-muted font-mono">{row.floor}</td>
                    <td className="py-3 px-3 text-right font-mono text-u-ink2">{formatCurrency(row.marketRent)}</td>
                    <td className="py-3 px-3 text-right font-mono font-semibold text-u-ink">
                      {formatCurrency(row.askingRent)}
                    </td>
                    <td className="py-3 px-3 text-center text-u-muted">{formatDate(row.vacancyStartDate)}</td>
                    <td className="py-3 px-3 text-right font-mono font-bold">
                      <span
                        className={`rounded px-2 py-0.5 ${
                          isSevere
                            ? 'bg-u-danger-soft text-u-danger'
                            : isModerate
                            ? 'bg-u-warn-soft text-u-warn'
                            : 'text-u-ink'
                        }`}
                      >
                        {row.daysVacant} d
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-u-danger font-semibold">
                      {formatCurrency(row.accruedVacancyLoss)}
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          row.readinessStatus === 'Ready for Leasing'
                            ? 'bg-u-ok-soft text-u-ok'
                            : row.readinessStatus === 'Leased — Awaiting Move-In'
                            ? 'bg-u-blue-soft text-u-blue'
                            : row.readinessStatus === 'Cleaning Required'
                            ? 'bg-u-warn-soft text-u-warn'
                            : 'bg-u-danger-soft text-u-danger'
                        }`}
                      >
                        {row.readinessStatus}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center text-u-ink2">
                      {row.expectedAvailableDate ? formatDate(row.expectedAvailableDate) : 'Immediate'}
                    </td>
                    <td className="py-3 px-4">
                      {row.futureTenant ? (
                        <div>
                          <span className="font-semibold text-u-blue">Pre-Leased: {row.futureTenant}</span>
                          <span className="text-[10px] text-u-muted block">Move-in {formatDate(row.nextScheduledMoveInDate)}</span>
                        </div>
                      ) : (
                        <span className="text-u-ink2">{row.assignedLeasingAgent || '—'}</span>
                      )}
                    </td>
                  </tr>
                );
              })}

              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={12} className="py-8 text-center text-u-muted">
                    No vacant units match the selected threshold and status filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
