import React from 'react';
import { ReportFilterState, Unit } from '../../types/occupancy';
import { OccupancyService } from '../../services/occupancyService';
import { ReportHeader } from './ReportHeader';
import { formatCurrency, formatDate, formatNumber } from '../../utils/formatters';
import { exportToCSV } from '../../utils/exportUtils';
import { FileText, Building, DollarSign, Home, Layers } from 'lucide-react';

interface Report12Props {
  filters: ReportFilterState;
  onBack: () => void;
  onSelectUnit: (unit: Unit) => void;
}

export function Report12RentRoll({ filters, onBack, onSelectUnit }: Report12Props) {
  const { rows, propertyGroups, totals } = OccupancyService.getRentRollOccupancyReport(filters);

  const handleExportCSV = () => {
    exportToCSV({
      filename: `rent-roll-occupancy-${filters.asOfDate}`,
      reportTitle: 'Rent Roll & Occupancy Report',
      reportingPeriod: `As of ${filters.asOfDate}`,
      propertyContext: filters.propertyId === 'all' ? 'All Portfolios' : 'Selected Property',
      columns: [
        { header: 'Property', accessor: (r) => r.propertyName },
        { header: 'Unit Number', accessor: (r) => r.unitNumber },
        { header: 'Unit Type', accessor: (r) => r.unitType },
        { header: 'Occupancy Status', accessor: (r) => r.currentOccupancyStatus },
        { header: 'Tenant Name', accessor: (r) => r.tenantName },
        { header: 'Lease Number', accessor: (r) => r.leaseNumber },
        { header: 'Lease Start', accessor: (r) => formatDate(r.leaseStartDate) },
        { header: 'Lease End', accessor: (r) => formatDate(r.leaseEndDate) },
        { header: 'Contractual Rent', accessor: (r) => formatCurrency(r.contractualRent) },
        { header: 'Market Rent', accessor: (r) => formatCurrency(r.marketRent) },
        { header: 'Rent / Sq Ft', accessor: (r) => r.rentPerSqFt ? `$${r.rentPerSqFt}/yr` : '—' },
        { header: 'Deposit Amount', accessor: (r) => formatCurrency(r.depositAmount) },
      ],
      data: rows,
      summaryNotes: [
        `Inventory: ${totals.totalUnits} Units, ${totals.uniqueLeaseCount} Leases (multi-unit lease accounting demonstrated).`,
        `Total Monthly Contractual Billing: ${formatCurrency(totals.totalContractualMonthlyRent)}.`,
      ],
    });
  };

  return (
    <div className="space-y-6">
      <ReportHeader
        title="Rent Roll & Occupancy Report"
        reportNumber={12}
        description="Master operational rent roll marrying physical unit inventory, tenant tenancy agreements, monthly contractual billings, market spreads, and security deposits."
        asOfDate={filters.asOfDate}
        propertyContext={filters.propertyId === 'all' ? 'Portfolio Wide' : 'Selected Property'}
        onBack={onBack}
        onExportCSV={handleExportCSV}
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="rounded-xl border border-u-line bg-u-card p-3 text-center shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-u-muted">Total Units</span>
          <p className="mt-1 text-xl font-bold text-u-ink font-mono">{totals.totalUnits}</p>
        </div>
        <div className="rounded-xl border border-u-accent/30 bg-u-accent-soft/50 p-3 text-center shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-u-accent">Occupied Units</span>
          <p className="mt-1 text-xl font-bold text-u-accent font-mono">{totals.occupiedUnits}</p>
        </div>
        <div className="rounded-xl border border-u-violet/30 bg-u-violet/10 p-3 text-center shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-u-violet">Unique Active Leases</span>
          <p className="mt-1 text-xl font-bold text-u-violet font-mono">{totals.uniqueLeaseCount}</p>
        </div>
        <div className="rounded-xl border border-u-ok/30 bg-u-ok-soft/50 p-3 text-center shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-u-ok">Monthly Contractual Rent</span>
          <p className="mt-1 text-xl font-bold text-u-ok font-mono">
            {formatCurrency(totals.totalContractualMonthlyRent)}
          </p>
        </div>
        <div className="rounded-xl border border-u-line bg-u-s2 p-3 text-center shadow-xs col-span-2 sm:col-span-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-u-muted">Security Deposits Held</span>
          <p className="mt-1 text-xl font-bold text-u-ink font-mono">{formatCurrency(totals.totalDepositsHeld)}</p>
        </div>
      </div>

      {/* Grouped Tables by Property */}
      <div className="space-y-6">
        {propertyGroups.map((group) => (
          <div key={group.propertyName} className="overflow-hidden rounded-xl border border-u-line bg-u-card shadow-xs">
            {/* Property Section Header */}
            <div className="flex flex-wrap items-center justify-between border-b border-u-line bg-u-s2 px-5 py-3">
              <div className="flex items-center gap-2">
                <Building className="h-4 w-4 text-u-accent" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-u-ink">
                  {group.propertyName}
                </h3>
                <span className="rounded bg-u-line/80 px-2 py-0.5 text-[10px] font-semibold text-u-ink2">
                  {group.unitsCount} units ({group.occupiedCount} occ)
                </span>
              </div>
              <div className="text-xs font-medium text-u-ink2">
                Monthly Billing:{' '}
                <span className="font-bold text-u-accent font-mono">{formatCurrency(group.totalRent)}</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-u-s2/80 text-u-ink2 border-b border-u-line">
                  <tr>
                    <th className="py-2.5 px-4 font-semibold">Unit</th>
                    <th className="py-2.5 px-3 font-semibold">Type</th>
                    <th className="py-2.5 px-3 font-semibold">Status</th>
                    <th className="py-2.5 px-3 font-semibold">Tenant Name</th>
                    <th className="py-2.5 px-3 font-semibold font-mono">Lease #</th>
                    <th className="py-2.5 px-3 font-semibold text-center">Lease End</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Contractual Rent</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Market Rent</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Rent / Sq Ft</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Deposit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-u-line">
                  {group.rows.map((row) => {
                    const fullUnit = OccupancyService.getUnits().find((u) => u.unitId === row.unitId);
                    const isOcc = row.currentOccupancyStatus === 'Occupied';

                    return (
                      <tr
                        key={row.unitId}
                        onClick={() => fullUnit && onSelectUnit(fullUnit)}
                        className="cursor-pointer hover:bg-u-accent-soft/40 transition-colors font-medium text-u-ink"
                      >
                        <td className="py-3 px-4">
                          <span className="font-bold text-u-accent">Unit {row.unitNumber}</span>
                          <span className="text-[10px] text-u-muted block">Fl {row.floor} • {row.rentableAreaSqFt} sq ft</span>
                        </td>
                        <td className="py-3 px-3 text-u-ink2">{row.unitType}</td>
                        <td className="py-3 px-3">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              isOcc
                                ? 'bg-u-accent-soft text-u-accent'
                                : row.currentOccupancyStatus.startsWith('Vacant')
                                ? 'bg-u-warn-soft text-u-warn'
                                : 'bg-u-blue-soft text-u-blue'
                            }`}
                          >
                            {row.currentOccupancyStatus}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <span className={`font-semibold ${isOcc ? 'text-u-ink' : 'text-u-muted italic'}`}>
                            {row.tenantName}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono text-u-ink2">
                          {row.leaseNumber}
                          {row.isMultiUnitLease && (
                            <span className="ml-1 rounded bg-u-violet/15 text-u-violet px-1 py-0.2 text-[9px] font-bold">
                              Multi-Unit
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center text-u-ink2">
                          {row.leaseEndDate ? formatDate(row.leaseEndDate) : '—'}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-u-ink">
                          {row.contractualRent ? formatCurrency(row.contractualRent) : '—'}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-u-ink2">
                          {formatCurrency(row.marketRent)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-u-ink2">
                          {row.rentPerSqFt ? `$${row.rentPerSqFt}/yr` : '—'}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-u-ok">
                          {row.depositAmount > 0 ? formatCurrency(row.depositAmount) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
