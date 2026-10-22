import React, { useState } from 'react';
import { ReportFilterState } from '../../types/occupancy';
import { OccupancyService } from '../../services/occupancyService';
import { ReportHeader } from './ReportHeader';
import { OccupancyTrendChart } from '../charts/OccupancyTrendChart';
import { formatPercent, formatNumber } from '../../utils/formatters';
import { exportToCSV } from '../../utils/exportUtils';
import { TrendingUp, ArrowDownRight, ArrowUpRight, Calendar, Info } from 'lucide-react';

interface Report4Props {
  filters: ReportFilterState;
  onBack: () => void;
}

export function Report4OccupancyTrend({ filters, onBack }: Report4Props) {
  const [selectedRange, setSelectedRange] = useState<'3m' | '6m' | '12m'>('12m');

  const { trendTimeline, tableRows, calculationNotice } = OccupancyService.getOccupancyTrend(filters);

  // Filter timeline based on selected slice
  let filteredTimeline = trendTimeline;
  if (selectedRange === '3m') {
    filteredTimeline = trendTimeline.slice(-3);
  } else if (selectedRange === '6m') {
    filteredTimeline = trendTimeline.slice(-6);
  }

  const handleExportCSV = () => {
    exportToCSV({
      filename: `historical-occupancy-trend-${filters.asOfDate}`,
      reportTitle: 'Historical Occupancy Trend Report',
      reportingPeriod: `12 Months ending ${filters.asOfDate}`,
      propertyContext: filters.propertyId === 'all' ? 'All Portfolios' : 'Selected Property',
      columns: [
        { header: 'Period', accessor: (r) => r.periodLabel },
        { header: 'Property', accessor: (r) => r.propertyName },
        { header: 'Total Rentable Units', accessor: (r) => r.totalRentableUnits },
        { header: 'Occupied Units', accessor: (r) => r.occupiedUnits },
        { header: 'Vacant Units', accessor: (r) => r.vacantUnits },
        { header: 'Occupancy Rate', accessor: (r) => formatPercent(r.occupancyRate) },
        { header: 'Vacancy Rate', accessor: (r) => formatPercent(r.vacancyRate) },
        { header: 'Move-Ins', accessor: (r) => r.moveIns },
        { header: 'Move-Outs', accessor: (r) => r.moveOuts },
      ],
      data: tableRows,
      summaryNotes: [
        calculationNotice,
        'Physical Occupancy = Occupied Rentable Units ÷ Total Rentable Units × 100.',
      ],
    });
  };

  return (
    <div className="space-y-6">
      <ReportHeader
        title="Historical Occupancy Trend Report"
        reportNumber={4}
        description="Effective-dated historical occupancy performance across monthly snapshot intervals. Tracks leasing velocity, move-in and move-out counts, and capacity utilization."
        asOfDate={filters.asOfDate}
        propertyContext={filters.propertyId === 'all' ? 'Portfolio Wide' : 'Selected Property'}
        onBack={onBack}
        onExportCSV={handleExportCSV}
      />

      {/* Range Preset Selector */}
      <div className="flex items-center justify-between rounded-xl border border-u-line bg-u-card p-3 shadow-xs">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-u-accent" />
          <span className="text-xs font-semibold text-u-ink2">Display Timeline:</span>
          {(['3m', '6m', '12m'] as const).map((rng) => (
            <button
              key={rng}
              type="button"
              onClick={() => setSelectedRange(rng)}
              className={`rounded-lg px-3 py-1 text-xs font-semibold transition-all ${
                selectedRange === rng
                  ? 'bg-u-accent text-u-onaccent shadow-xs'
                  : 'bg-u-s2 border border-u-line text-u-ink2 hover:bg-u-s3'
              }`}
            >
              {rng === '3m' ? 'Last 3 Months' : rng === '6m' ? 'Last 6 Months' : 'Last 12 Months'}
            </button>
          ))}
        </div>

        <div className="text-xs text-u-muted">
          Periods analyzed: <span className="font-bold text-u-ink">{filteredTimeline.length} months</span>
        </div>
      </div>

      {/* Visual Chart */}
      <OccupancyTrendChart
        data={filteredTimeline}
        title={`Physical Occupancy Trend (${selectedRange.toUpperCase()})`}
        targetRate={95.0}
      />

      {/* Detailed Monthly Table */}
      <div className="overflow-hidden rounded-xl border border-u-line bg-u-card shadow-xs">
        <div className="px-5 py-3.5 border-b border-u-line bg-u-s2 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-u-ink2">
            Historical Snapshot Ledger
          </h3>
          <span className="text-xs text-u-muted">Monthly Effective Records</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-u-s2 text-u-ink2 border-b border-u-line">
              <tr>
                <th className="py-3 px-4 font-semibold">Period</th>
                <th className="py-3 px-3 font-semibold">Property</th>
                <th className="py-3 px-3 font-semibold text-right">Rentable Units</th>
                <th className="py-3 px-3 font-semibold text-right">Occupied</th>
                <th className="py-3 px-3 font-semibold text-right">Vacant</th>
                <th className="py-3 px-3 font-semibold text-right">Occupancy %</th>
                <th className="py-3 px-3 font-semibold text-right">Vacancy %</th>
                <th className="py-3 px-3 font-semibold text-right text-u-ok">Move-Ins</th>
                <th className="py-3 px-4 font-semibold text-right text-u-danger">Move-Outs</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-u-line">
              {tableRows.map((r, idx) => (
                <tr key={`${r.period}-${r.propertyId}-${idx}`} className="hover:bg-u-s2 transition-colors">
                  <td className="py-3 px-4 font-bold text-u-ink font-mono">{r.periodLabel}</td>
                  <td className="py-3 px-3 text-u-ink2 font-medium">{r.propertyName}</td>
                  <td className="py-3 px-3 text-right font-mono">{r.totalRentableUnits}</td>
                  <td className="py-3 px-3 text-right font-mono text-u-accent font-semibold">{r.occupiedUnits}</td>
                  <td className="py-3 px-3 text-right font-mono text-u-warn">{r.vacantUnits}</td>
                  <td className="py-3 px-3 text-right font-mono font-bold text-u-ok">
                    {formatPercent(r.occupancyRate)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-u-ink2">
                    {formatPercent(r.vacancyRate)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-semibold text-u-ok">
                    +{r.moveIns}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-semibold text-u-danger">
                    -{r.moveOuts}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Historical Calculation Note */}
      <div className="rounded-xl border border-u-line bg-u-s2 p-4 text-xs text-u-ink2 flex items-start gap-2.5">
        <Info className="h-4 w-4 text-u-accent shrink-0 mt-0.5" />
        <p className="leading-relaxed">{calculationNotice}</p>
      </div>
    </div>
  );
}
