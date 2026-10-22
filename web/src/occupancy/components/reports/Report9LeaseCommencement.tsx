import React from 'react';
import { ReportFilterState, Lease } from '../../types/occupancy';
import { OccupancyService } from '../../services/occupancyService';
import { ReportHeader } from './ReportHeader';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { exportToCSV } from '../../utils/exportUtils';
import { Calendar, DollarSign, ShieldCheck } from 'lucide-react';

interface Report9Props {
  filters: ReportFilterState;
  onBack: () => void;
  onSelectLease: (lease: Lease) => void;
}

export function Report9LeaseCommencement({ filters, onBack, onSelectLease }: Report9Props) {
  const { rows, totals } = OccupancyService.getLeaseCommencementReport(filters);

  const handleExportCSV = () => {
    exportToCSV({
      filename: `lease-commencements-${filters.asOfDate}`,
      reportTitle: 'Lease Commencement Report',
      reportingPeriod: `As of ${filters.asOfDate}`,
      propertyContext: filters.propertyId === 'all' ? 'All Portfolios' : 'Selected Property',
      columns: [
        { header: 'Tenant Name', accessor: (r) => r.tenantName },
        { header: 'Property', accessor: (r) => r.propertyName },
        { header: 'Units', accessor: (r) => r.unitNumbers },
        { header: 'Lease Number', accessor: (r) => r.leaseNumber },
        { header: 'Contractual Start Date', accessor: (r) => formatDate(r.leaseStartDate) },
        { header: 'Physical Move-In Date', accessor: (r) => formatDate(r.moveInDate) },
        { header: 'Monthly Rent', accessor: (r) => formatCurrency(r.monthlyRent) },
        { header: 'Deposit Amount', accessor: (r) => formatCurrency(r.depositAmount) },
        { header: 'Deposit Status', accessor: (r) => r.depositStatus },
        { header: 'Lease Status', accessor: (r) => r.leaseStatus },
        { header: 'Manager', accessor: (r) => r.assignedPropertyManager },
      ],
      data: rows,
      summaryNotes: [
        'Contractual lease commencement is distinguished from actual physical key handover and tenant move-in date.',
      ],
    });
  };

  return (
    <div className="space-y-6">
      <ReportHeader
        title="Lease Commencement Report"
        reportNumber={9}
        description="Audit of executed tenancy agreements and commencement dates. Verifies whether contract start dates align with physical tenant move-ins."
        asOfDate={filters.asOfDate}
        propertyContext={filters.propertyId === 'all' ? 'Portfolio Wide' : 'Selected Property'}
        onBack={onBack}
        onExportCSV={handleExportCSV}
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-u-line bg-u-card p-4 text-center shadow-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-u-muted">Total Leases Executed</span>
          <p className="mt-1 text-2xl font-bold text-u-ink font-mono">{totals.totalLeasesCommenced}</p>
        </div>
        <div className="rounded-xl border border-u-accent/30 bg-u-accent-soft/50 p-4 text-center shadow-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-u-accent">New Monthly Revenue</span>
          <p className="mt-1 text-2xl font-bold text-u-accent font-mono">{formatCurrency(totals.totalMonthlyRevenue)}</p>
        </div>
        <div className="rounded-xl border border-u-ok/30 bg-u-ok-soft/50 p-4 text-center shadow-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-u-ok">Security Escrow Deposits</span>
          <p className="mt-1 text-2xl font-bold text-u-ok font-mono">{formatCurrency(totals.totalDepositsHeld)}</p>
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
                <th className="py-3 px-3 font-semibold font-mono">Lease #</th>
                <th className="py-3 px-3 font-semibold text-center">Contract Start</th>
                <th className="py-3 px-3 font-semibold text-center">Physical Move-In</th>
                <th className="py-3 px-3 font-semibold text-right">Monthly Rent</th>
                <th className="py-3 px-3 font-semibold text-right">Deposit</th>
                <th className="py-3 px-3 font-semibold">Lease Status</th>
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
                    <td className="py-3 px-4 font-bold text-u-ink hover:text-u-accent transition-colors">
                      {r.tenantName}
                    </td>
                    <td className="py-3 px-3 text-u-ink2">{r.propertyName}</td>
                    <td className="py-3 px-3 font-semibold text-u-accent">{r.unitNumbers}</td>
                    <td className="py-3 px-3 font-mono text-u-ink2">{r.leaseNumber}</td>
                    <td className="py-3 px-3 text-center text-u-ink">{formatDate(r.leaseStartDate)}</td>
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[11px] ${
                          r.isMoveInPending ? 'bg-u-warn-soft text-u-warn font-bold' : 'text-u-ink'
                        }`}
                      >
                        {formatDate(r.moveInDate)}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-semibold text-u-ink">
                      {formatCurrency(r.monthlyRent)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-u-ok">
                      {formatCurrency(r.depositAmount)}
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          r.leaseStatus === 'Active'
                            ? 'bg-u-ok-soft text-u-ok'
                            : r.leaseStatus === 'Pending Move-In'
                            ? 'bg-u-blue-soft text-u-blue'
                            : 'bg-u-s3 text-u-ink2'
                        }`}
                      >
                        {r.leaseStatus}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-u-ink2">{r.assignedPropertyManager}</td>
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
