import React, { useState } from 'react';
import { formatPercent } from '../../utils/formatters';

interface TrendItem {
  period: string;
  periodLabel: string;
  occupancyRate: number;
  totalRentableUnits: number;
  occupiedUnits: number;
  vacantUnits: number;
  moveIns?: number;
  moveOuts?: number;
}

interface OccupancyTrendChartProps {
  data: TrendItem[];
  height?: number;
  title?: string;
  targetRate?: number;
}

export function OccupancyTrendChart({
  data,
  height = 240,
  title = '12-Month Physical Occupancy Trend',
  targetRate = 95.0,
}: OccupancyTrendChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return (
      <div className="flex h-56 items-center justify-center rounded-xl border border-dashed border-u-line bg-u-s2 text-xs text-u-muted">
        No historical trend data available for current selection.
      </div>
    );
  }

  const paddingLeft = 45;
  const paddingRight = 25;
  const paddingTop = 25;
  const paddingBottom = 35;
  const chartWidth = 720;
  const chartHeight = height;

  const minRate = Math.max(60, Math.floor(Math.min(...data.map((d) => d.occupancyRate)) / 5) * 5 - 5);
  const maxRate = 100;

  const getX = (index: number) => {
    if (data.length <= 1) return paddingLeft;
    return paddingLeft + (index / (data.length - 1)) * (chartWidth - paddingLeft - paddingRight);
  };

  const getY = (val: number) => {
    const clamped = Math.max(minRate, Math.min(maxRate, val));
    const ratio = (clamped - minRate) / (maxRate - minRate);
    return chartHeight - paddingBottom - ratio * (chartHeight - paddingTop - paddingBottom);
  };

  // Build path coordinates
  const points = data.map((d, i) => `${getX(i)},${getY(d.occupancyRate)}`).join(' ');
  const areaPath = `M ${getX(0)},${chartHeight - paddingBottom} L ${points} L ${getX(
    data.length - 1
  )},${chartHeight - paddingBottom} Z`;

  // Target line Y coordinate
  const targetY = getY(targetRate);

  // Y-axis ticks
  const yTicks = [minRate, Math.round((minRate + maxRate) / 2), maxRate];

  return (
    <div className="rounded-xl border border-u-line bg-u-card p-5 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-sm font-semibold text-u-ink">{title}</h3>
          <p className="text-xs text-u-muted">
            Effective monthly physical occupancy rate across selected portfolio
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs font-medium text-u-ink2">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-u-accent"></span>
            <span>Occupancy Rate</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 bg-u-ok border-t border-dashed border-u-ok/60"></span>
            <span>Portfolio Target ({targetRate}%)</span>
          </div>
        </div>
      </div>

      <div className="relative w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="w-full h-auto min-w-[580px]"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="occGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.28" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines & Y Axis Ticks */}
          {yTicks.map((tick) => {
            const y = getY(tick);
            return (
              <g key={tick}>
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={chartWidth - paddingRight}
                  y2={y}
                  stroke="var(--line)"
                  strokeDasharray="4 4"
                />
                <text
                  x={paddingLeft - 8}
                  y={y + 4}
                  textAnchor="end"
                  className="text-[10px] fill-u-muted font-mono"
                >
                  {tick}%
                </text>
              </g>
            );
          })}

          {/* Target Reference Line */}
          <line
            x1={paddingLeft}
            y1={targetY}
            x2={chartWidth - paddingRight}
            y2={targetY}
            stroke="var(--ok)"
            strokeWidth="1.5"
            strokeDasharray="4 3"
          />

          {/* Shaded Area */}
          <path d={areaPath} fill="url(#occGradient)" />

          {/* Line Path */}
          <polyline
            fill="none"
            stroke="var(--accent-strong)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={points}
          />

          {/* Data Points */}
          {data.map((d, i) => {
            const cx = getX(i);
            const cy = getY(d.occupancyRate);
            const isHovered = hoveredIndex === i;

            return (
              <g key={d.period} className="cursor-pointer" onMouseEnter={() => setHoveredIndex(i)} onMouseLeave={() => setHoveredIndex(null)}>
                {/* Invisible larger hit target */}
                <circle cx={cx} cy={cy} r="12" fill="transparent" />
                <circle
                  cx={cx}
                  cy={cy}
                  r={isHovered ? 6 : 4}
                  fill="var(--card)"
                  stroke="var(--accent-strong)"
                  strokeWidth={isHovered ? 3 : 2}
                  className="transition-all duration-150"
                />

                {/* X-axis label */}
                <text
                  x={cx}
                  y={chartHeight - 12}
                  textAnchor="middle"
                  className={`text-[10px] font-medium transition-colors ${
                    isHovered ? 'fill-u-accent font-bold' : 'fill-u-muted'
                  }`}
                >
                  {d.periodLabel}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Hover Tooltip Overlay */}
        {hoveredIndex !== null && data[hoveredIndex] && (
          <div
            className="absolute -top-1 pointer-events-none z-10 rounded-lg border border-u-line bg-u-ink2/95 px-3 py-2 text-xs text-u-onaccent shadow-xl backdrop-blur-xs transform -translate-x-1/2"
            style={{
              left: `${(getX(hoveredIndex) / chartWidth) * 100}%`,
            }}
          >
            <div className="font-semibold text-u-s3 border-b border-u-line2/60 pb-1 mb-1">
              {data[hoveredIndex].periodLabel}
            </div>
            <div className="flex items-center justify-between gap-3 text-u-s3">
              <span>Occupancy:</span>
              <span className="font-bold text-u-ok">
                {formatPercent(data[hoveredIndex].occupancyRate)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 text-[11px] text-u-muted">
              <span>Occupied:</span>
              <span className="font-medium text-u-onaccent">{data[hoveredIndex].occupiedUnits} / {data[hoveredIndex].totalRentableUnits} units</span>
            </div>
            {data[hoveredIndex].moveIns !== undefined && (
              <div className="flex items-center justify-between gap-3 text-[11px] text-u-muted">
                <span>Move-Ins / Outs:</span>
                <span className="text-u-onaccent">
                  +{data[hoveredIndex].moveIns} / -{data[hoveredIndex].moveOuts}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
