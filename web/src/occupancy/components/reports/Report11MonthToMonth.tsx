import React from 'react';
import { ReportFilterState, Lease } from '../../types/occupancy';
import { OccupancyService } from '../../services/occupancyService';
import { ReportHeader } from './ReportHeader';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { exportToCSV } from '../../utils/exportUtils';
import { AlertCircle, Clock, DollarSign, Info } from 'lucide-react';

interface Report11Props {
  filters: ReportFilterState;
  onBack: () => void;
  onSelectLease: (lease: Lease) => void;
}

export function Report11MonthToMonth({ filters, onBack, onSelectLease }: Report11Props) {
  const { rows, totals, legalNote } = OccupancyService.getMonthToMonthTenancyReport(filters);

  const handleExportCSV = () => {
    exportToCSV({
      filename: `month-to-month-tenancies-${filters.asOfDate}`,
      reportTitle: 'Month-to-Month Tenancy Report',
      reportingPeriod: `As of ${filters.asOfDate}`,
      propertyContext: filters.propertyId === 'all' ? 'All Portfolios' : 'Selected Property',
      columns: [
        { header: 'Tenant Name', accessor: (r) => r.tenantName },
        { header: 'Property', accessor: (r) => r.propertyName },
        { header: 'Units', accessor: (r) => r.unitNumbers },
        { header: 'Original Lease End', accessor: (r) => formatDate(r.originalLeaseEndDate) },
        { header: 'Tenancy Status', accessor: (r) => r.tenancyStatus },
        { header: 'Monthly Rent', accessor: (r) => formatCurrency(r.monthlyRent) },
        { header: 'Market Rent', accessor: (r) => formatCurrency(r.marketRent) },
        { header: 'Rent Spread', accessor: (r) => formatCurrency(r.rentSpread) },
        { header: 'Tenancy Start', accessor: (r) => formatDate(r.tenancyStartDate) },
        { header: 'Notice Status', accessor: (r) => r.noticeStatus },
        { header: 'Manager', accessor: (r) => r.assignedPropertyManager },
      ],
      data: rows,
      summaryNotes: [legalNote],
    });
  };

  return (
    <div className="space-y-6">
      <ReportHeader
        title="Month-to-Month Tenancy Report"
        reportNumber={11}
        description="Identifies residential units operating on statutory periodic or month-to-month terms following expiry of fixed terms. Highlights revenue exposure."
        asOfDate={filters.asOfDate}
        propertyContext={filters.propertyId === 'all' ? 'Portfolio Wide' : 'Selected Property'}
        onBack={onBack}
        onExportCSV={handleExportCSV}
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-u-warn/30 bg-u-warn-soft/50 p-4 text-center shadow-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-u-warn">
            Active Periodic Tenancies
          </span>
          <p className="mt-1 text-2xl font-bold text-u-warn font-mono">
            {totals.totalMonthToMonthTenancies} Tenancies
          </p>
        </div>
        <div className="rounded-xl border border-u-danger/30 bg-u-danger-soft/50 p-4 text-center shadow-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-u-danger">
            Monthly Revenue at 30-Day Risk
          </span>
          <p className="mt-1 text-2xl font-bold text-u-danger font-mono">
            {formatCurrency(totals.monthlyRevenueAtRisk)}
          </p>
        </div>
        <div className="rounded-xl border border-u-line bg-u-card p-4 text-center shadow-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-u-muted">
            Average Periodic Tenure
          </span>
          <p className="mt-1 text-2xl font-bold text-u-ink font-mono">
            {totals.averageDurationMonths} Months
          </p>
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
                <th className="py-3 px-3 font-semibold">Unit(s)</th>
                <th className="py-3 px-3 font-semibold text-center">Original Expiry</th>
                <th className="py-3 px-3 font-semibold text-right">Current Rent</th>
                <th className="py-3 px-3 font-semibold text-right">Market Rent</th>
                <th className="py-3 px-3 font-semibold text-right text-u-warn">Rent Spread</th>
                <th className="py-3 px-3 font-semibold text-center">Tenancy Start</th>
                <th className="py-3 px-3 font-semibold">Notice Status</th>
                <th className="py-3 px-4 font-semibold">Manager</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-u-line">
              {rows.map((r) => {
                const fullLease = OccupancyService.getLeases().find((l) => l.leaseId === r.leaseId);

                return (
                  <tr
                    key={r.leaseId}
                    onClick={() => fullLease && onSelectLease(fullLease)}
                    className="cursor-pointer hover:bg-u-accent-soft/40 transition-colors font-medium text-u-ink"
                  >
                    <td className="py-3.5 px-4 font-bold text-u-ink hover:text-u-accent transition-colors">
                      {r.tenantName}
                    </td>
                    <td className="py-3.5 px-3 text-u-ink2">{r.propertyName}</td>
                    <td className="py-3.5 px-3 font-semibold text-u-accent">{r.unitNumbers}</td>
                    <td className="py-3.5 px-3 text-center text-u-ink2">{formatDate(r.originalLeaseEndDate)}</td>
                    <td className="py-3.5 px-3 text-right font-mono font-bold text-u-ink">
                      {formatCurrency(r.monthlyRent)}
                    </td>
                    <td className="py-3.5 px-3 text-right font-mono text-u-ink2">
                      {formatCurrency(r.marketRent)}
                    </td>
                    <td className="py-3.5 px-3 text-right font-mono font-semibold text-u-warn">
                      {formatCurrency(r.rentSpread)}
                    </td>
                    <td className="py-3.5 px-3 text-center text-u-ink2">{formatDate(r.tenancyStartDate)}</td>
                    <td className="py-3.5 px-3">
                      <span className="rounded bg-u-s3 px-2 py-0.5 text-[10px] text-u-ink2 font-medium">
                        {r.noticeStatus}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-u-ink2">{r.assignedPropertyManager}</td>
                  </tr>
                );
              })}

              {rows.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-u-muted">
                    No month-to-month tenancies found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-u-line bg-u-s2 p-4 text-xs text-u-ink2 flex items-start gap-2.5">
        <Info className="h-4 w-4 text-u-accent shrink-0 mt-0.5" />
        <p className="leading-relaxed">{legalNote}</p>
      </div>
    </div>
  );
}
