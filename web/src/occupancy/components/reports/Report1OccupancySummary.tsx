import React, { useState } from 'react';
import { ReportFilterState, Unit, Property } from '../../types/occupancy';
import { OccupancyService } from '../../services/occupancyService';
import { ReportHeader } from './ReportHeader';
import { formatPercent, formatCurrency, formatDate } from '../../utils/formatters';
import { exportToCSV } from '../../utils/exportUtils';
import { ChevronDown, ChevronRight, Building, Home, CheckCircle2, AlertCircle, Info, ExternalLink } from 'lucide-react';

interface Report1Props {
  filters: ReportFilterState;
  onBack: () => void;
  onSelectUnit: (unit: Unit) => void;
}

export function Report1OccupancySummary({ filters, onBack, onSelectUnit }: Report1Props) {
  const [expandedPropertyIds, setExpandedPropertyIds] = useState<Record<string, boolean>>({
    'prop-mcr': true, // Expand first property by default
  });

  const { propertyRows, totals } = OccupancyService.getOccupancySummary(filters);

  const toggleExpand = (propId: string) => {
    setExpandedPropertyIds((prev) => ({
      ...prev,
      [propId]: !prev[propId],
    }));
  };

  const handleExportCSV = () => {
    exportToCSV({
      filename: `occupancy-summary-${filters.asOfDate}`,
      reportTitle: 'Occupancy Summary Report',
      reportingPeriod: `As of ${filters.asOfDate}`,
      propertyContext: filters.propertyId === 'all' ? 'All Portfolios' : 'Single Property',
      columns: [
        { header: 'Property Name', accessor: (r) => r.propertyName },
        { header: 'Property Code', accessor: (r) => r.propertyCode },
        { header: 'Total Units', accessor: (r) => r.totalUnits },
        { header: 'Rentable Units', accessor: (r) => r.rentableUnits },
        { header: 'Occupied Units', accessor: (r) => r.occupiedUnits },
        { header: 'Vacant Units', accessor: (r) => r.vacantUnits },
        { header: 'Reserved Units', accessor: (r) => r.reservedUnits },
        { header: 'Unavailable Units', accessor: (r) => r.unavailableUnits },
        { header: 'Occupancy Rate', accessor: (r) => formatPercent(r.occupancyRate) },
        { header: 'Vacancy Rate', accessor: (r) => formatPercent(r.vacancyRate) },
      ],
      data: propertyRows,
      summaryNotes: [
        'Physical Occupancy Rate = Occupied Rentable Units ÷ Total Rentable Units × 100.',
        'Physical Vacancy Rate = Vacant Rentable Units ÷ Total Rentable Units × 100.',
        'Unavailable units (staff suites/mechanical conversions) are excluded from the rentable inventory denominator.',
      ],
    });
  };

  return (
    <div className="space-y-6">
      <ReportHeader
        title="Occupancy Summary Report"
        reportNumber={1}
        description="Comprehensive physical capacity and occupancy metrics across portfolio properties. Expand any property to inspect unit-level tenancy and status."
        asOfDate={filters.asOfDate}
        propertyContext={filters.propertyId === 'all' ? 'Portfolio Wide (5 Properties)' : propertyRows[0]?.propertyName}
        onBack={onBack}
        onExportCSV={handleExportCSV}
      />

      {/* Summary KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        <div className="rounded-xl border border-u-line bg-u-card p-3 text-center shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-u-muted">Total Units</span>
          <p className="mt-1 text-lg font-bold text-u-ink font-mono">{totals.totalUnits}</p>
        </div>
        <div className="rounded-xl border border-u-line bg-u-card p-3 text-center shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-u-muted">Rentable Units</span>
          <p className="mt-1 text-lg font-bold text-u-ink font-mono">{totals.rentableUnits}</p>
        </div>
        <div className="rounded-xl border border-u-accent/30 bg-u-accent-soft/50 p-3 text-center shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-u-accent">Occupied</span>
          <p className="mt-1 text-lg font-bold text-u-accent font-mono">{totals.occupiedUnits}</p>
        </div>
        <div className="rounded-xl border border-u-warn/30 bg-u-warn-soft/50 p-3 text-center shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-u-warn">Vacant</span>
          <p className="mt-1 text-lg font-bold text-u-warn font-mono">{totals.vacantUnits}</p>
        </div>
        <div className="rounded-xl border border-u-blue/30 bg-u-blue-soft/50 p-3 text-center shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-u-blue">Reserved / Pre-Leased</span>
          <p className="mt-1 text-lg font-bold text-u-blue font-mono">{totals.reservedUnits}</p>
        </div>
        <div className="rounded-xl border border-u-line bg-u-s2 p-3 text-center shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-u-muted">Unavailable</span>
          <p className="mt-1 text-lg font-bold text-u-ink2 font-mono">{totals.unavailableUnits}</p>
        </div>
        <div className="rounded-xl border border-u-ok/30 bg-u-ok-soft/60 p-3 text-center shadow-xs sm:col-span-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-u-ok">Physical Occupancy</span>
          <p className="mt-1 text-xl font-bold text-u-ok font-mono">{formatPercent(totals.occupancyRate)}</p>
        </div>
        <div className="rounded-xl border border-u-warn/30 bg-u-warn-soft/60 p-3 text-center shadow-xs sm:col-span-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-u-warn">Physical Vacancy</span>
          <p className="mt-1 text-xl font-bold text-u-warn font-mono">{formatPercent(totals.vacancyRate)}</p>
        </div>
      </div>

      {/* Main Table */}
      <div className="overflow-hidden rounded-xl border border-u-line bg-u-card shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-u-s2 text-u-ink2 border-b border-u-line">
              <tr>
                <th className="py-3 px-4 font-semibold">Property</th>
                <th className="py-3 px-3 font-semibold text-center">Code</th>
                <th className="py-3 px-3 font-semibold text-right">Total Units</th>
                <th className="py-3 px-3 font-semibold text-right">Rentable Units</th>
                <th className="py-3 px-3 font-semibold text-right">Occupied</th>
                <th className="py-3 px-3 font-semibold text-right">Vacant</th>
                <th className="py-3 px-3 font-semibold text-right">Reserved</th>
                <th className="py-3 px-3 font-semibold text-right">Unavailable</th>
                <th className="py-3 px-3 font-semibold text-right">Occupancy %</th>
                <th className="py-3 px-4 font-semibold text-right">Vacancy %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-u-line">
              {propertyRows.map((prop) => {
                const isExpanded = !!expandedPropertyIds[prop.propertyId];

                return (
                  <React.Fragment key={prop.propertyId}>
                    <tr
                      onClick={() => toggleExpand(prop.propertyId)}
                      className="cursor-pointer hover:bg-u-accent-soft/40 transition-colors font-medium text-u-ink"
                    >
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className="text-u-muted hover:text-u-ink2"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleExpand(prop.propertyId);
                            }}
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4 text-u-accent" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </button>
                          <span className="font-bold text-u-ink hover:text-u-accent transition-colors">
                            {prop.propertyName}
                          </span>
                          <span className="text-[11px] text-u-muted">
                            ({prop.city}, {prop.province})
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-3 text-center font-mono text-u-muted">{prop.propertyCode}</td>
                      <td className="py-3.5 px-3 text-right font-mono">{prop.totalUnits}</td>
                      <td className="py-3.5 px-3 text-right font-mono font-semibold">{prop.rentableUnits}</td>
                      <td className="py-3.5 px-3 text-right font-mono text-u-accent">{prop.occupiedUnits}</td>
                      <td className="py-3.5 px-3 text-right font-mono text-u-warn">{prop.vacantUnits}</td>
                      <td className="py-3.5 px-3 text-right font-mono text-u-blue">{prop.reservedUnits}</td>
                      <td className="py-3.5 px-3 text-right font-mono text-u-muted">{prop.unavailableUnits}</td>
                      <td className="py-3.5 px-3 text-right font-mono font-bold text-u-ok">
                        {formatPercent(prop.occupancyRate)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-u-warn">
                        {formatPercent(prop.vacancyRate)}
                      </td>
                    </tr>

                    {/* Expandable Unit-Level Breakdown */}
                    {isExpanded && (
                      <tr className="bg-u-s2/70 border-b border-u-line">
                        <td colSpan={10} className="p-4">
                          <div className="rounded-lg border border-u-line bg-u-card p-3 shadow-2xs space-y-2">
                            <div className="flex items-center justify-between text-xs pb-2 border-b border-u-line">
                              <span className="font-bold text-u-ink2">
                                Unit Inventory ({prop.units.length} units at {prop.propertyName})
                              </span>
                              <span className="text-[11px] text-u-muted">
                                Click any unit to view details & maintenance history
                              </span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 pt-1">
                              {prop.units.map((u) => {
                                const isOcc = u.status === 'Occupied';
                                const isVac = u.status.startsWith('Vacant');
                                const isRes = u.status === 'Reserved' || u.status === 'Leased — Awaiting Move-In';
                                const isUnav = u.status === 'Unavailable';

                                const fullUnit = OccupancyService.getUnits().find((raw) => raw.unitId === u.unitId);

                                return (
                                  <div
                                    key={u.unitId}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (fullUnit) onSelectUnit(fullUnit);
                                    }}
                                    className={`cursor-pointer rounded-lg border p-2.5 transition-all text-xs hover:shadow-xs ${
                                      isOcc
                                        ? 'border-u-accent/30 bg-u-accent-soft/30 hover:border-u-accent/60'
                                        : isVac
                                        ? 'border-u-warn/30 bg-u-warn-soft/40 hover:border-u-warn/60'
                                        : isRes
                                        ? 'border-u-blue/30 bg-u-blue-soft/30 hover:border-u-blue/60'
                                        : 'border-u-line bg-u-s3/60'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="font-bold text-u-ink">Unit {u.unitNumber}</span>
                                      <span className="text-[10px] text-u-muted font-medium">Floor {u.floor}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-[11px] text-u-ink2 mb-1.5">
                                      <span>{u.unitType}</span>
                                      <span className="font-mono">{u.rentableAreaSqFt} sq ft</span>
                                    </div>
                                    <div className="flex items-center justify-between pt-1 border-t border-u-line/60">
                                      <span
                                        className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                                          isOcc
                                            ? 'bg-u-accent-soft text-u-accent'
                                            : isVac
                                            ? 'bg-u-warn-soft text-u-warn'
                                            : isRes
                                            ? 'bg-u-blue-soft text-u-blue'
                                            : 'bg-u-line text-u-ink2'
                                        }`}
                                      >
                                        {u.status}
                                      </span>
                                      <span className="font-mono font-semibold text-u-ink text-[11px]">
                                        {formatCurrency(u.contractualRent || u.marketRent)}
                                      </span>
                                    </div>
                                    {u.tenantName && (
                                      <p className="mt-1 text-[10px] text-u-muted truncate">
                                        Tenant: <span className="text-u-ink font-medium">{u.tenantName}</span>
                                      </p>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}

              {/* Portfolio Total Row */}
              <tr className="bg-u-s3/90 font-bold text-u-ink border-t-2 border-u-line2">
                <td className="py-3.5 px-4">
                  <div className="flex items-center gap-1.5">
                    <Building className="h-4 w-4 text-u-accent" />
                    <span>Portfolio Total ({totals.totalProperties} Properties)</span>
                  </div>
                </td>
                <td className="py-3.5 px-3 text-center text-u-muted font-mono">—</td>
                <td className="py-3.5 px-3 text-right font-mono">{totals.totalUnits}</td>
                <td className="py-3.5 px-3 text-right font-mono">{totals.rentableUnits}</td>
                <td className="py-3.5 px-3 text-right font-mono text-u-accent">{totals.occupiedUnits}</td>
                <td className="py-3.5 px-3 text-right font-mono text-u-warn">{totals.vacantUnits}</td>
                <td className="py-3.5 px-3 text-right font-mono text-u-blue">{totals.reservedUnits}</td>
                <td className="py-3.5 px-3 text-right font-mono text-u-muted">{totals.unavailableUnits}</td>
                <td className="py-3.5 px-3 text-right font-mono text-u-ok text-sm">
                  {formatPercent(totals.occupancyRate)}
                </td>
                <td className="py-3.5 px-4 text-right font-mono text-u-warn text-sm">
                  {formatPercent(totals.vacancyRate)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Footnote & Calculation Standards */}
      <div className="rounded-xl border border-u-line bg-u-s2 p-4 text-xs text-u-ink2 space-y-1.5">
        <div className="flex items-center gap-1.5 font-bold text-u-ink">
          <Info className="h-4 w-4 text-u-accent" />
          <span>Occupancy Calculation Guidelines</span>
        </div>
        <p className="leading-relaxed">
          <strong>Physical Occupancy Rate:</strong> Occupied Rentable Units ÷ Total Rentable Units × 100 ({totals.occupiedUnits} ÷ {totals.rentableUnits} = {formatPercent(totals.occupancyRate)}).
        </p>
        <p className="leading-relaxed">
          <strong>Inventory Treatment:</strong> Reserved units with holding deposits ({totals.reservedUnits}) are not counted as occupied until physical commencement. Non-rentable administrative suites ({totals.unavailableUnits}) are excluded from the rentable inventory pool.
        </p>
      </div>
    </div>
  );
}
