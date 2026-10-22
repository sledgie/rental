import React, { useState } from 'react';
import { ReportFilterState, Unit } from '../../types/occupancy';
import { OccupancyService } from '../../services/occupancyService';
import { ReportHeader } from './ReportHeader';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { exportToCSV } from '../../utils/exportUtils';
import { AlertTriangle, Clock, Filter, ArrowUpDown } from 'lucide-react';

interface Report13Props {
  filters: ReportFilterState;
  onBack: () => void;
  onSelectUnit: (unit: Unit) => void;
}

export function Report13LongTermVacancy({ filters, onBack, onSelectUnit }: Report13Props) {
  const [thresholdDays, setThresholdDays] = useState<number>(filters.thresholdDays || 30);
  const [sortBy, setSortBy] = useState<'days' | 'loss'>('days');

  const { rows, totals } = OccupancyService.getLongTermVacancyReport({
    ...filters,
    thresholdDays,
  });

  const sortedRows = [...rows].sort((a, b) => {
    if (sortBy === 'loss') return b.estimatedVacancyLoss - a.estimatedVacancyLoss;
    return b.daysVacant - a.daysVacant;
  });

  const handleExportCSV = () => {
    exportToCSV({
      filename: `long-term-vacancy-${thresholdDays}d-${filters.asOfDate}`,
      reportTitle: `Long-Term Vacancy Report (> ${thresholdDays} Days)`,
      reportingPeriod: `As of ${filters.asOfDate}`,
      propertyContext: filters.propertyId === 'all' ? 'All Portfolios' : 'Selected Property',
      columns: [
        { header: 'Property', accessor: (r) => r.propertyName },
        { header: 'Unit', accessor: (r) => r.unitNumber },
        { header: 'Unit Type', accessor: (r) => r.unitType },
        { header: 'Floor', accessor: (r) => r.floor },
        { header: 'Vacancy Start Date', accessor: (r) => formatDate(r.vacancyStartDate) },
        { header: 'Days Vacant', accessor: (r) => r.daysVacant },
        { header: 'Monthly Rent', accessor: (r) => formatCurrency(r.monthlyPotentialRent) },
        { header: 'Accrued Loss', accessor: (r) => formatCurrency(r.estimatedVacancyLoss) },
        { header: 'Readiness Status', accessor: (r) => r.readinessStatus },
        { header: 'Vacancy Reason', accessor: (r) => r.reasonForVacancy },
        { header: 'Assigned Agent', accessor: (r) => r.assignedAgent },
      ],
      data: sortedRows,
      summaryNotes: [
        `Analysis threshold: Vacant >= ${thresholdDays} days as of ${filters.asOfDate}.`,
        'Accrued loss calculated as (Monthly Potential Rent ÷ 30.417) × Days Vacant.',
      ],
    });
  };

  return (
    <div className="space-y-6">
      <ReportHeader
        title="Long-Term Vacancy Report"
        reportNumber={13}
        description="Identifies inventory with prolonged downtime exceeding operational tolerance thresholds. Diagnoses blockers across renovation, maintenance, and marketing."
        asOfDate={filters.asOfDate}
        propertyContext={filters.propertyId === 'all' ? 'Portfolio Wide' : 'Selected Property'}
        onBack={onBack}
        onExportCSV={handleExportCSV}
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-u-danger/30 bg-u-danger-soft/50 p-3.5 text-center shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-u-danger">
            Units Exceeding {thresholdDays} Days
          </span>
          <p className="mt-1 text-2xl font-bold text-u-danger font-mono">{totals.qualifyingUnits}</p>
        </div>
        <div className="rounded-xl border border-u-danger/30 bg-u-danger-soft/50 p-3.5 text-center shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-u-danger">
            Total Accrued Vacancy Loss
          </span>
          <p className="mt-1 text-2xl font-bold text-u-danger font-mono">
            {formatCurrency(totals.totalAccruedLoss)}
          </p>
        </div>
        <div className="rounded-xl border border-u-warn/30 bg-u-warn-soft/50 p-3.5 text-center shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-u-warn">
            Monthly Potential Rent Stalled
          </span>
          <p className="mt-1 text-2xl font-bold text-u-warn font-mono">
            {formatCurrency(totals.monthlyRevenueAtRisk)}
          </p>
        </div>
        <div className="rounded-xl border border-u-line bg-u-card p-3.5 text-center shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-u-muted">
            Average Days Vacant
          </span>
          <p className="mt-1 text-2xl font-bold text-u-ink font-mono">
            {totals.avgDaysVacant} Days
          </p>
        </div>
      </div>

      {/* Threshold and Sort Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-u-line bg-u-card p-3 shadow-xs">
        <div className="flex items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-u-accent" />
          <span className="text-xs font-semibold text-u-ink2">Threshold:</span>
          {[
            { label: '30+ Days', val: 30 },
            { label: '60+ Days', val: 60 },
            { label: '90+ Days', val: 90 },
          ].map((th) => (
            <button
              key={th.val}
              type="button"
              onClick={() => setThresholdDays(th.val)}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                thresholdDays === th.val
                  ? 'bg-u-danger text-u-onaccent shadow-xs'
                  : 'bg-u-s2 border border-u-line text-u-ink2 hover:bg-u-s3'
              }`}
            >
              {th.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-u-muted">Sort By:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="rounded-lg border border-u-line bg-u-s2 py-1 px-2.5 text-xs text-u-ink2 focus:outline-none"
          >
            <option value="days">Longest Vacancy Duration</option>
            <option value="loss">Highest Accrued Loss</option>
          </select>
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
                <th className="py-3 px-3 font-semibold">Type</th>
                <th className="py-3 px-3 font-semibold text-center">Vacancy Start</th>
                <th className="py-3 px-3 font-semibold text-right">Days Vacant</th>
                <th className="py-3 px-3 font-semibold text-right">Potential Rent</th>
                <th className="py-3 px-3 font-semibold text-right text-u-danger">Accrued Loss</th>
                <th className="py-3 px-3 font-semibold">Readiness Status</th>
                <th className="py-3 px-3 font-semibold">Root Cause / Reason</th>
                <th className="py-3 px-4 font-semibold">Assigned Agent</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-u-line">
              {sortedRows.map((r) => {
                const fullUnit = OccupancyService.getUnits().find((u) => u.unitId === r.unitId);

                return (
                  <tr
                    key={r.unitId}
                    onClick={() => fullUnit && onSelectUnit(fullUnit)}
                    className="cursor-pointer hover:bg-u-accent-soft/40 transition-colors font-medium text-u-ink"
                  >
                    <td className="py-3.5 px-4 font-bold text-u-ink">{r.propertyName}</td>
                    <td className="py-3.5 px-3 font-bold text-u-accent">Unit {r.unitNumber}</td>
                    <td className="py-3.5 px-3 text-u-ink2">{r.unitType}</td>
                    <td className="py-3.5 px-3 text-center text-u-muted font-mono">{formatDate(r.vacancyStartDate)}</td>
                    <td className="py-3.5 px-3 text-right font-mono font-bold">
                      <span className="rounded bg-u-danger-soft text-u-danger px-2 py-0.5">
                        {r.daysVacant} d
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-right font-mono text-u-ink2">
                      {formatCurrency(r.monthlyPotentialRent)}
                    </td>
                    <td className="py-3.5 px-3 text-right font-mono font-bold text-u-danger">
                      {formatCurrency(r.estimatedVacancyLoss)}
                    </td>
                    <td className="py-3.5 px-3">
                      <span className="rounded-full bg-u-s3 text-u-ink2 px-2 py-0.5 text-[10px] font-bold">
                        {r.readinessStatus}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-u-ink2 max-w-xs">{r.reasonForVacancy}</td>
                    <td className="py-3.5 px-4 text-u-ink2">{r.assignedAgent}</td>
                  </tr>
                );
              })}

              {sortedRows.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-u-muted">
                    No units exceed {thresholdDays} days of vacancy.
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
