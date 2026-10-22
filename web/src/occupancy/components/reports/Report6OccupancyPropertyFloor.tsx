import React, { useState } from 'react';
import { ReportFilterState, Unit } from '../../types/occupancy';
import { OccupancyService } from '../../services/occupancyService';
import { ReportHeader } from './ReportHeader';
import { formatCurrency, formatPercent } from '../../utils/formatters';
import { exportToCSV } from '../../utils/exportUtils';
import { Layers, Home, Building2, ChevronDown, ChevronRight } from 'lucide-react';

interface Report6Props {
  filters: ReportFilterState;
  onBack: () => void;
  onSelectUnit: (unit: Unit) => void;
}

export function Report6OccupancyPropertyFloor({ filters, onBack, onSelectUnit }: Report6Props) {
  const [groupBy, setGroupBy] = useState<'unitType' | 'property' | 'floor'>('unitType');
  const [expandedKeys, setExpandedKeys] = useState<Record<string, boolean>>({});

  const { rows, totals } = OccupancyService.getOccupancyByPropertyUnitTypeFloor(filters, groupBy);

  const toggleExpand = (key: string) => {
    setExpandedKeys((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleExportCSV = () => {
    exportToCSV({
      filename: `occupancy-by-${groupBy}-${filters.asOfDate}`,
      reportTitle: `Occupancy Breakdown by ${groupBy === 'unitType' ? 'Unit Type' : groupBy === 'property' ? 'Property' : 'Floor'}`,
      reportingPeriod: `As of ${filters.asOfDate}`,
      propertyContext: filters.propertyId === 'all' ? 'All Portfolios' : 'Selected Property',
      columns: [
        { header: 'Category / Group', accessor: (r) => r.label },
        { header: 'Total Units', accessor: (r) => r.totalUnits },
        { header: 'Occupied Units', accessor: (r) => r.occupiedUnits },
        { header: 'Vacant Units', accessor: (r) => r.vacantUnits },
        { header: 'Reserved Units', accessor: (r) => r.reservedUnits },
        { header: 'Occupancy Rate', accessor: (r) => formatPercent(r.occupancyRate) },
        { header: 'Avg Contractual Rent', accessor: (r) => formatCurrency(r.averageContractualRent) },
        { header: 'Avg Market Rent', accessor: (r) => formatCurrency(r.averageMarketRent) },
      ],
      data: rows,
      summaryNotes: [
        'Average contractual rent is calculated strictly from active lease records, excluding null values from zero-averaging distortion.',
      ],
    });
  };

  return (
    <div className="space-y-6">
      <ReportHeader
        title="Occupancy by Property, Unit Type & Floor"
        reportNumber={6}
        description="Cross-sectional performance comparison across property cohorts, architectural floor tiers, and unit classifications."
        asOfDate={filters.asOfDate}
        propertyContext={filters.propertyId === 'all' ? 'Portfolio Wide' : 'Selected Property'}
        onBack={onBack}
        onExportCSV={handleExportCSV}
      />

      {/* Grouping Toggle Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-u-line bg-u-card p-3 shadow-xs">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-u-accent" />
          <span className="text-xs font-semibold text-u-ink2">Group By Dimension:</span>
          {[
            { id: 'unitType', label: 'Unit Type' },
            { id: 'floor', label: 'Floor Level' },
            { id: 'property', label: 'Property' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setGroupBy(tab.id as any);
                setExpandedKeys({});
              }}
              className={`rounded-lg px-3 py-1 text-xs font-semibold transition-all ${
                groupBy === tab.id
                  ? 'bg-u-accent text-u-onaccent shadow-xs'
                  : 'bg-u-s2 border border-u-line text-u-ink2 hover:bg-u-s3'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="text-xs text-u-muted">
          Portfolio Occupancy:{' '}
          <span className="font-bold text-u-ok font-mono">{formatPercent(totals.occupancyRate)}</span>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-u-line bg-u-card shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-u-s2 text-u-ink2 border-b border-u-line">
              <tr>
                <th className="py-3 px-4 font-semibold">Group Dimension</th>
                <th className="py-3 px-3 font-semibold text-right">Rentable Units</th>
                <th className="py-3 px-3 font-semibold text-right">Occupied</th>
                <th className="py-3 px-3 font-semibold text-right">Vacant</th>
                <th className="py-3 px-3 font-semibold text-right">Reserved</th>
                <th className="py-3 px-3 font-semibold text-right">Occupancy %</th>
                <th className="py-3 px-3 font-semibold text-right">Avg Contractual Rent</th>
                <th className="py-3 px-4 font-semibold text-right">Avg Market Rent</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-u-line">
              {rows.map((r) => {
                const isExpanded = !!expandedKeys[r.key];

                return (
                  <React.Fragment key={r.key}>
                    <tr
                      onClick={() => toggleExpand(r.key)}
                      className="cursor-pointer hover:bg-u-accent-soft/40 transition-colors font-medium"
                    >
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <button type="button" className="text-u-muted">
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4 text-u-accent" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </button>
                          <span className="font-bold text-u-ink">{r.label}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-3 text-right font-mono">{r.totalUnits}</td>
                      <td className="py-3.5 px-3 text-right font-mono text-u-accent font-semibold">{r.occupiedUnits}</td>
                      <td className="py-3.5 px-3 text-right font-mono text-u-warn">{r.vacantUnits}</td>
                      <td className="py-3.5 px-3 text-right font-mono text-u-blue">{r.reservedUnits}</td>
                      <td className="py-3.5 px-3 text-right font-mono font-bold text-u-ok">
                        {formatPercent(r.occupancyRate)}
                      </td>
                      <td className="py-3.5 px-3 text-right font-mono font-semibold text-u-ink">
                        {formatCurrency(r.averageContractualRent)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-u-ink2">
                        {formatCurrency(r.averageMarketRent)}
                      </td>
                    </tr>

                    {/* Drill-Down Units for this group */}
                    {isExpanded && (
                      <tr className="bg-u-s2/70 border-b border-u-line">
                        <td colSpan={8} className="p-4">
                          <div className="rounded-lg border border-u-line bg-u-card p-3 space-y-2">
                            <span className="text-xs font-bold text-u-ink2 block mb-2">
                              Units in {r.label} ({r.unitList.length} units)
                            </span>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                              {r.unitList.map((u) => {
                                const fullUnit = OccupancyService.getUnits().find((raw) => raw.unitId === u.unitId);
                                const isOcc = u.currentOccupancyStatus === 'Occupied';

                                return (
                                  <div
                                    key={u.unitId}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (fullUnit) onSelectUnit(fullUnit);
                                    }}
                                    className="cursor-pointer rounded-lg border border-u-line bg-u-s2/60 p-2 text-xs hover:border-u-accent/60 hover:bg-u-card transition-all"
                                  >
                                    <div className="flex items-center justify-between">
                                      <span className="font-bold text-u-ink">Unit {u.unitNumber}</span>
                                      <span
                                        className={`rounded px-1.5 py-0.2 text-[10px] font-bold ${
                                          isOcc ? 'bg-u-accent-soft text-u-accent' : 'bg-u-warn-soft text-u-warn'
                                        }`}
                                      >
                                        {u.currentOccupancyStatus}
                                      </span>
                                    </div>
                                    <div className="flex items-center justify-between text-u-muted mt-1">
                                      <span>Floor {u.floor} • {u.unitType}</span>
                                      <span className="font-mono font-semibold text-u-ink">
                                        {formatCurrency(u.contractualRent || u.marketRent)}
                                      </span>
                                    </div>
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
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
