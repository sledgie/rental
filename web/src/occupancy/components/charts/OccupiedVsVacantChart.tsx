import React from 'react';
import { formatPercent } from '../../utils/formatters';

interface PropertyBarItem {
  propertyName: string;
  propertyCode: string;
  totalUnits: number;
  rentableUnits: number;
  occupiedUnits: number;
  vacantUnits: number;
  reservedUnits: number;
  unavailableUnits: number;
  occupancyRate: number;
}

interface OccupiedVsVacantChartProps {
  data: PropertyBarItem[];
  onSelectProperty?: (propertyCode: string) => void;
}

export function OccupiedVsVacantChart({ data, onSelectProperty }: OccupiedVsVacantChartProps) {
  return (
    <div className="rounded-xl border border-u-line bg-u-card p-5 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-sm font-semibold text-u-ink">Occupancy Distribution by Property</h3>
          <p className="text-xs text-u-muted">Unit inventory allocation: occupied, vacant, reserved, and unavailable</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-u-accent"></span>
            <span className="text-u-ink2">Occupied</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-u-warn"></span>
            <span className="text-u-ink2">Vacant</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-u-blue"></span>
            <span className="text-u-ink2">Reserved / Pre-Leased</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-u-line"></span>
            <span className="text-u-ink2">Unavailable</span>
          </div>
        </div>
      </div>

      <div className="space-y-3.5">
        {data.map((item) => {
          const occPct = (item.occupiedUnits / item.totalUnits) * 100;
          const vacPct = (item.vacantUnits / item.totalUnits) * 100;
          const resPct = (item.reservedUnits / item.totalUnits) * 100;
          const unavPct = (item.unavailableUnits / item.totalUnits) * 100;

          return (
            <div
              key={item.propertyCode}
              onClick={() => onSelectProperty?.(item.propertyCode)}
              className="group cursor-pointer rounded-lg p-2.5 -mx-2 hover:bg-u-s2 transition-colors"
            >
              <div className="flex items-center justify-between text-xs mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-u-ink group-hover:text-u-accent transition-colors">
                    {item.propertyName}
                  </span>
                  <span className="rounded bg-u-s3 px-1.5 py-0.2 text-[10px] font-mono text-u-muted">
                    {item.propertyCode}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-u-muted font-mono text-[11px]">
                    {item.occupiedUnits} / {item.rentableUnits} rentable occ.
                  </span>
                  <span className="font-bold text-u-accent min-w-12 text-right">
                    {formatPercent(item.occupancyRate)}
                  </span>
                </div>
              </div>

              {/* Stacked Progress Bar */}
              <div className="flex h-3 w-full overflow-hidden rounded-full bg-u-s3">
                {occPct > 0 && (
                  <div
                    style={{ width: `${occPct}%` }}
                    className="bg-u-accent transition-all duration-300 hover:opacity-90"
                    title={`Occupied: ${item.occupiedUnits} units (${formatPercent(occPct)})`}
                  />
                )}
                {resPct > 0 && (
                  <div
                    style={{ width: `${resPct}%` }}
                    className="bg-u-blue transition-all duration-300 hover:opacity-90"
                    title={`Reserved: ${item.reservedUnits} units (${formatPercent(resPct)})`}
                  />
                )}
                {vacPct > 0 && (
                  <div
                    style={{ width: `${vacPct}%` }}
                    className="bg-u-warn transition-all duration-300 hover:opacity-90"
                    title={`Vacant: ${item.vacantUnits} units (${formatPercent(vacPct)})`}
                  />
                )}
                {unavPct > 0 && (
                  <div
                    style={{ width: `${unavPct}%` }}
                    className="bg-u-line transition-all duration-300 hover:opacity-90"
                    title={`Unavailable: ${item.unavailableUnits} units (${formatPercent(unavPct)})`}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
