import React, { useState } from 'react';
import { ReportFilterState, Lease } from '../../types/occupancy';
import { OccupancyService } from '../../services/occupancyService';
import { ReportHeader } from './ReportHeader';
import { formatCurrency, formatDate, formatPercent } from '../../utils/formatters';
import { exportToCSV } from '../../utils/exportUtils';
import { Clock, CheckCircle2, AlertTriangle, ArrowUpRight, DollarSign, Calendar } from 'lucide-react';

interface Report3Props {
  filters: ReportFilterState;
  onBack: () => void;
  onSelectLease: (lease: Lease) => void;
}

export function Report3LeaseExpiration({ filters, onBack, onSelectLease }: Report3Props) {
  const [windowDays, setWindowDays] = useState<number>(filters.expiryWindowDays || 90);

  const { rows, totals } = OccupancyService.getLeaseExpirationReport({
    ...filters,
    expiryWindowDays: windowDays,
  });

  const handleExportCSV = () => {
    exportToCSV({
      filename: `lease-expirations-${windowDays}d-${filters.asOfDate}`,
      reportTitle: 'Lease Expiration & Renewal Report',
      reportingPeriod: `Expiring within ${windowDays} days from ${filters.asOfDate}`,
      propertyContext: filters.propertyId === 'all' ? 'All Portfolios' : 'Selected Property',
      columns: [
        { header: 'Tenant Name', accessor: (r) => r.tenantName },
        { header: 'Property', accessor: (r) => r.propertyName },
        { header: 'Units', accessor: (r) => r.unitNumbers },
        { header: 'Lease Number', accessor: (r) => r.leaseNumber },
        { header: 'Lease Start', accessor: (r) => formatDate(r.leaseStartDate) },
        { header: 'Lease Expiry', accessor: (r) => formatDate(r.leaseEndDate) },
        { header: 'Days to Expiry', accessor: (r) => r.daysUntilExpiry },
        { header: 'Current Monthly Rent', accessor: (r) => formatCurrency(r.currentMonthlyRent) },
        { header: 'Proposed Renewal Rent', accessor: (r) => formatCurrency(r.proposedRenewalRent) },
        { header: 'Renewal Status', accessor: (r) => r.renewalStatus },
        { header: 'Notice Status', accessor: (r) => r.noticeStatus },
        { header: 'Move-Out Date', accessor: (r) => formatDate(r.expectedMoveOutDate) },
        { header: 'Property Manager', accessor: (r) => r.assignedPropertyManager },
      ],
      data: rows,
      summaryNotes: [
        `Eligible renewal cohort denominator: ${totals.totalExpiring} leases expiring within ${windowDays} days.`,
        `Renewal Rate = Renewed Leases ÷ Total Expiring in Cohort × 100 (${totals.renewedCount} ÷ ${totals.totalExpiring} = ${formatPercent(totals.renewalRate)}).`,
      ],
    });
  };

  return (
    <div className="space-y-6">
      <ReportHeader
        title="Lease Expiration & Renewal Report"
        reportNumber={3}
        description="Monitor fixed-term leases approaching maturity, renewal offer statuses, move-out notices, and monthly rental revenue up for renegotiation."
        asOfDate={filters.asOfDate}
        propertyContext={filters.propertyId === 'all' ? 'Portfolio Wide' : 'Selected Property'}
        onBack={onBack}
        onExportCSV={handleExportCSV}
      />

      {/* Cohort KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        <div className="rounded-xl border border-u-line bg-u-card p-3 text-center shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-u-muted">Expiring in Window</span>
          <p className="mt-1 text-xl font-bold text-u-ink font-mono">{totals.totalExpiring} Leases</p>
        </div>
        <div className="rounded-xl border border-u-ok/30 bg-u-ok-soft/50 p-3 text-center shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-u-ok">Renewed</span>
          <p className="mt-1 text-xl font-bold text-u-ok font-mono">{totals.renewedCount}</p>
        </div>
        <div className="rounded-xl border border-u-accent/30 bg-u-accent-soft/50 p-3 text-center shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-u-accent">Renewal Pending</span>
          <p className="mt-1 text-xl font-bold text-u-accent font-mono">{totals.renewalPendingCount}</p>
        </div>
        <div className="rounded-xl border border-u-danger/30 bg-u-danger-soft/50 p-3 text-center shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-u-danger">Moving Out</span>
          <p className="mt-1 text-xl font-bold text-u-danger font-mono">{totals.moveOutExpectedCount}</p>
        </div>
        <div className="rounded-xl border border-u-line bg-u-s2 p-3 text-center shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-u-muted">Not Contacted</span>
          <p className="mt-1 text-xl font-bold text-u-ink2 font-mono">{totals.notContactedCount}</p>
        </div>
        <div className="rounded-xl border border-u-ok/30 bg-u-ok-soft/70 p-3 text-center shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-u-ok">Renewal Rate</span>
          <p className="mt-1 text-xl font-bold text-u-ok font-mono">{formatPercent(totals.renewalRate)}</p>
        </div>
      </div>

      {/* Expiry Window Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-u-line bg-u-card p-3 shadow-xs">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-u-muted flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            Configurable Expiry Horizon:
          </span>
          {[
            { label: '30 Days', val: 30 },
            { label: '60 Days', val: 60 },
            { label: '90 Days', val: 90 },
            { label: '180 Days', val: 180 },
          ].map((w) => (
            <button
              key={w.val}
              type="button"
              onClick={() => setWindowDays(w.val)}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                windowDays === w.val
                  ? 'bg-u-accent text-u-onaccent shadow-xs'
                  : 'bg-u-s2 border border-u-line text-u-ink2 hover:bg-u-s3'
              }`}
            >
              {w.label}
            </button>
          ))}
        </div>

        <div className="text-xs text-u-muted">
          Monthly Rent in Horizon: <span className="font-bold text-u-ink font-mono">{formatCurrency(totals.totalExpiringRent)}</span>
        </div>
      </div>

      {/* Leases Table */}
      <div className="overflow-hidden rounded-xl border border-u-line bg-u-card shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-u-s2 text-u-ink2 border-b border-u-line">
              <tr>
                <th className="py-3 px-4 font-semibold">Tenant Name</th>
                <th className="py-3 px-3 font-semibold">Property</th>
                <th className="py-3 px-3 font-semibold">Unit(s)</th>
                <th className="py-3 px-3 font-semibold font-mono">Lease #</th>
                <th className="py-3 px-3 font-semibold text-center">Expiry Date</th>
                <th className="py-3 px-3 font-semibold text-right">Days Left</th>
                <th className="py-3 px-3 font-semibold text-right">Current Rent</th>
                <th className="py-3 px-3 font-semibold text-right">Proposed Rent</th>
                <th className="py-3 px-3 font-semibold">Renewal Status</th>
                <th className="py-3 px-3 font-semibold">Notice Status</th>
                <th className="py-3 px-4 font-semibold">Assigned Manager</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-u-line">
              {rows.map((row) => {
                const fullLease = OccupancyService.getLeases().find((l) => l.leaseId === row.leaseId);
                const isUrgent = row.daysUntilExpiry <= 30;

                return (
                  <tr
                    key={row.leaseId}
                    onClick={() => fullLease && onSelectLease(fullLease)}
                    className="cursor-pointer hover:bg-u-accent-soft/40 transition-colors"
                  >
                    <td className="py-3.5 px-4 font-bold text-u-ink hover:text-u-accent transition-colors">
                      {row.tenantName}
                    </td>
                    <td className="py-3.5 px-3 text-u-ink2 font-medium">{row.propertyName}</td>
                    <td className="py-3.5 px-3 font-semibold text-u-accent">
                      {row.unitNumbers}
                      {row.isMultiUnit && (
                        <span className="ml-1 rounded bg-u-violet/15 text-u-violet px-1 py-0.2 text-[9px] font-bold">
                          Multi-Unit
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-3 font-mono text-u-ink2">{row.leaseNumber}</td>
                    <td className="py-3.5 px-3 text-center text-u-ink font-medium">
                      {formatDate(row.leaseEndDate)}
                    </td>
                    <td className="py-3.5 px-3 text-right font-mono font-bold">
                      <span
                        className={`rounded px-2 py-0.5 ${
                          isUrgent ? 'bg-u-danger-soft text-u-danger font-bold' : 'text-u-ink'
                        }`}
                      >
                        {row.daysUntilExpiry} d
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-right font-mono font-semibold text-u-ink">
                      {formatCurrency(row.currentMonthlyRent)}
                    </td>
                    <td className="py-3.5 px-3 text-right font-mono text-u-ok font-semibold">
                      {formatCurrency(row.proposedRenewalRent)}
                    </td>
                    <td className="py-3.5 px-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          row.renewalStatus === 'Renewed'
                            ? 'bg-u-ok-soft text-u-ok'
                            : row.renewalStatus === 'Tenant Moving Out'
                            ? 'bg-u-danger-soft text-u-danger'
                            : row.renewalStatus === 'Renewal Offered'
                            ? 'bg-u-accent-soft text-u-accent'
                            : row.renewalStatus === 'Renewal Discussion'
                            ? 'bg-u-blue-soft text-u-blue'
                            : 'bg-u-s3 text-u-ink2'
                        }`}
                      >
                        {row.renewalStatus}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-u-ink2">{row.noticeStatus}</td>
                    <td className="py-3.5 px-4 text-u-ink2">{row.assignedPropertyManager}</td>
                  </tr>
                );
              })}

              {rows.length === 0 && (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-u-muted">
                    No leases expiring within the selected window.
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
