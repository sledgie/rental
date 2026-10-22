import React from 'react';
import { ReportFilterState } from '../../types/occupancy';
import { OccupancyService } from '../../services/occupancyService';
import { ReportHeader } from './ReportHeader';
import { formatCurrency, formatPercent } from '../../utils/formatters';
import { exportToCSV } from '../../utils/exportUtils';
import { DollarSign, Coins, AlertCircle, Percent, Info, TrendingUp } from 'lucide-react';

interface Report5Props {
  filters: ReportFilterState;
  onBack: () => void;
}

export function Report5EconomicOccupancy({ filters, onBack }: Report5Props) {
  const { propertyRows, totals, methodologyNote } = OccupancyService.getEconomicOccupancyReport(filters);

  const handleExportCSV = () => {
    exportToCSV({
      filename: `economic-occupancy-loss-${filters.asOfDate}`,
      reportTitle: 'Economic Occupancy & Vacancy Loss Report',
      reportingPeriod: `Month ending ${filters.asOfDate}`,
      propertyContext: filters.propertyId === 'all' ? 'All Portfolios' : 'Selected Property',
      columns: [
        { header: 'Property Name', accessor: (r) => r.propertyName },
        { header: 'Property Code', accessor: (r) => r.propertyCode },
        { header: 'Rentable Units', accessor: (r) => r.totalRentableUnits },
        { header: 'Potential Rent', accessor: (r) => formatCurrency(r.potentialRent) },
        { header: 'Recognized Revenue', accessor: (r) => formatCurrency(r.recognizedRevenue) },
        { header: 'Vacancy Loss', accessor: (r) => formatCurrency(r.vacancyLoss) },
        { header: 'Concessions', accessor: (r) => formatCurrency(r.concessions) },
        { header: 'Economic Occupancy Rate', accessor: (r) => formatPercent(r.economicOccupancyRate) },
      ],
      data: propertyRows,
      summaryNotes: [
        methodologyNote,
        'Economic Occupancy Rate = Recognized Revenue ÷ Potential Rental Income × 100.',
      ],
    });
  };

  return (
    <div className="space-y-6">
      <ReportHeader
        title="Economic Occupancy & Vacancy Loss Report"
        reportNumber={5}
        description="Compares gross theoretical market potential with actual recognized revenue. Isolates daily vacancy loss and lease concessions from bad debt or uncollected cash."
        asOfDate={filters.asOfDate}
        propertyContext={filters.propertyId === 'all' ? 'Portfolio Wide' : 'Selected Property'}
        onBack={onBack}
        onExportCSV={handleExportCSV}
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="rounded-xl border border-u-line bg-u-card p-3.5 text-center shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-u-muted">
            Potential Rental Income
          </span>
          <p className="mt-1 text-xl font-bold text-u-ink font-mono">
            {formatCurrency(totals.totalPotentialRent)}
          </p>
          <span className="text-[10px] text-u-muted">Monthly gross market</span>
        </div>
        <div className="rounded-xl border border-u-accent/30 bg-u-accent-soft/50 p-3.5 text-center shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-u-accent">
            Recognized Revenue
          </span>
          <p className="mt-1 text-xl font-bold text-u-accent font-mono">
            {formatCurrency(totals.totalRecognizedRevenue)}
          </p>
          <span className="text-[10px] text-u-accent">Contractual billing</span>
        </div>
        <div className="rounded-xl border border-u-danger/30 bg-u-danger-soft/50 p-3.5 text-center shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-u-danger">
            Vacancy Loss
          </span>
          <p className="mt-1 text-xl font-bold text-u-danger font-mono">
            {formatCurrency(totals.totalVacancyLoss)}
          </p>
          <span className="text-[10px] text-u-danger">Daily unearned rent</span>
        </div>
        <div className="rounded-xl border border-u-warn/30 bg-u-warn-soft/50 p-3.5 text-center shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-u-warn">
            Concessions & Discounts
          </span>
          <p className="mt-1 text-xl font-bold text-u-warn font-mono">
            {formatCurrency(totals.totalConcessions)}
          </p>
          <span className="text-[10px] text-u-warn">Contractual variance</span>
        </div>
        <div className="rounded-xl border border-u-ok/30 bg-u-ok-soft/70 p-3.5 text-center shadow-xs col-span-2 sm:col-span-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-u-ok">
            Economic Occupancy
          </span>
          <p className="mt-1 text-2xl font-bold text-u-ok font-mono">
            {formatPercent(totals.economicOccupancyRate)}
          </p>
          <span className="text-[10px] text-u-ok">Revenue capture ratio</span>
        </div>
      </div>

      {/* Financial Table */}
      <div className="overflow-hidden rounded-xl border border-u-line bg-u-card shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-u-s2 text-u-ink2 border-b border-u-line">
              <tr>
                <th className="py-3 px-4 font-semibold">Property</th>
                <th className="py-3 px-3 font-semibold text-center font-mono">Code</th>
                <th className="py-3 px-3 font-semibold text-right">Rentable Units</th>
                <th className="py-3 px-3 font-semibold text-right">Potential Rent</th>
                <th className="py-3 px-3 font-semibold text-right">Recognized Revenue</th>
                <th className="py-3 px-3 font-semibold text-right text-u-danger">Vacancy Loss</th>
                <th className="py-3 px-3 font-semibold text-right text-u-warn">Concessions</th>
                <th className="py-3 px-4 font-semibold text-right text-u-ok">Economic Occ %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-u-line">
              {propertyRows.map((r) => (
                <tr key={r.propertyId} className="hover:bg-u-s2 transition-colors font-medium">
                  <td className="py-3.5 px-4 font-bold text-u-ink">{r.propertyName}</td>
                  <td className="py-3.5 px-3 text-center font-mono text-u-muted">{r.propertyCode}</td>
                  <td className="py-3.5 px-3 text-right font-mono">{r.totalRentableUnits}</td>
                  <td className="py-3.5 px-3 text-right font-mono text-u-ink2">
                    {formatCurrency(r.potentialRent)}
                  </td>
                  <td className="py-3.5 px-3 text-right font-mono text-u-accent font-semibold">
                    {formatCurrency(r.recognizedRevenue)}
                  </td>
                  <td className="py-3.5 px-3 text-right font-mono text-u-danger font-semibold">
                    {formatCurrency(r.vacancyLoss)}
                  </td>
                  <td className="py-3.5 px-3 text-right font-mono text-u-warn">
                    {formatCurrency(r.concessions)}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono font-bold text-u-ok text-sm">
                    {formatPercent(r.economicOccupancyRate)}
                  </td>
                </tr>
              ))}

              {/* Portfolio Total Row */}
              <tr className="bg-u-s3 font-bold text-u-ink border-t-2 border-u-line2">
                <td className="py-3.5 px-4">Portfolio Summary</td>
                <td className="py-3.5 px-3 text-center text-u-muted font-mono">—</td>
                <td className="py-3.5 px-3 text-right font-mono">
                  {propertyRows.reduce((a, b) => a + b.totalRentableUnits, 0)}
                </td>
                <td className="py-3.5 px-3 text-right font-mono">
                  {formatCurrency(totals.totalPotentialRent)}
                </td>
                <td className="py-3.5 px-3 text-right font-mono text-u-accent">
                  {formatCurrency(totals.totalRecognizedRevenue)}
                </td>
                <td className="py-3.5 px-3 text-right font-mono text-u-danger">
                  {formatCurrency(totals.totalVacancyLoss)}
                </td>
                <td className="py-3.5 px-3 text-right font-mono text-u-warn">
                  {formatCurrency(totals.totalConcessions)}
                </td>
                <td className="py-3.5 px-4 text-right font-mono text-u-ok text-sm">
                  {formatPercent(totals.economicOccupancyRate)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Accounting Methodology Footnote */}
      <div className="rounded-xl border border-u-line bg-u-s2 p-4 text-xs text-u-ink2 space-y-2">
        <div className="flex items-center gap-1.5 font-bold text-u-ink">
          <Info className="h-4 w-4 text-u-accent" />
          <span>Accounting Basis & Revenue Definitions</span>
        </div>
        <p className="leading-relaxed">{methodologyNote}</p>
        <p className="leading-relaxed">
          <strong>Important Distinctions:</strong> Unpaid rent or delinquent receivables are not classified as vacancy loss. Concessions represent contractual discounts off market asking rates, not vacancy duration.
        </p>
      </div>
    </div>
  );
}
