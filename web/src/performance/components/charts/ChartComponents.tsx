import React, { useState } from "react";

// ==========================================
// 1. Line Trend Chart
// ==========================================
export interface LinePoint {
  label: string;
  current: number;
  comparison?: number;
  meta?: string;
}

export function TrendLineChart({
  points,
  currentLabel = "Current Period",
  comparisonLabel = "Comparison Period",
  valueSuffix = "",
  height = 200,
}: {
  points: LinePoint[];
  currentLabel?: string;
  comparisonLabel?: string;
  valueSuffix?: string;
  height?: number;
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  if (points.length === 0) return <div className="text-xs text-u-muted p-6 text-center">No trend data</div>;

  const allVals = points.flatMap((p) => [p.current, p.comparison ?? p.current]);
  const minVal = Math.floor(Math.min(...allVals) * 0.95);
  const maxVal = Math.ceil(Math.max(...allVals) * 1.05) || 100;
  const range = maxVal - minVal || 1;

  const width = 600;
  const paddingX = 40;
  const paddingY = 25;
  const chartW = width - paddingX * 2;
  const chartH = height - paddingY * 2;

  const getX = (idx: number) => paddingX + (idx / Math.max(1, points.length - 1)) * chartW;
  const getY = (val: number) => height - paddingY - ((val - minVal) / range) * chartH;

  const currentPath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${getX(i)} ${getY(p.current)}`)
    .join(" ");

  const hasComparison = points.some((p) => p.comparison !== undefined);
  const compPath = hasComparison
    ? points.map((p, i) => `${i === 0 ? "M" : "L"} ${getX(i)} ${getY(p.comparison ?? p.current)}`).join(" ")
    : "";

  return (
    <div className="relative w-full">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible select-none">
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
          const y = height - paddingY - ratio * chartH;
          const val = Math.round(minVal + ratio * range);
          return (
            <g key={i}>
              <line x1={paddingX} y1={y} x2={width - paddingX} y2={y} stroke="#f1f5f9" strokeWidth="1" />
              <text x={paddingX - 8} y={y + 3} textAnchor="end" className="text-[10px] fill-u-muted">
                {val}
                {valueSuffix}
              </text>
            </g>
          );
        })}

        {/* Comparison Line (Dashed) */}
        {hasComparison && (
          <path d={compPath} fill="none" stroke="#94a3b8" strokeWidth="2" strokeDasharray="4 4" />
        )}

        {/* Current Line */}
        <path d={currentPath} fill="none" stroke="#4f46e5" strokeWidth="2.5" />

        {/* Points & Hover Interactivity */}
        {points.map((p, i) => {
          const cx = getX(i);
          const cy = getY(p.current);
          const isHovered = hoverIndex === i;

          return (
            <g key={i} onMouseEnter={() => setHoverIndex(i)} onMouseLeave={() => setHoverIndex(null)}>
              {/* Vertical guideline on hover */}
              {isHovered && (
                <line x1={cx} y1={paddingY} x2={cx} y2={height - paddingY} stroke="#c7d2fe" strokeWidth="1" strokeDasharray="2 2" />
              )}

              {/* Data circle */}
              <circle
                cx={cx}
                cy={cy}
                r={isHovered ? 6 : 4}
                className="fill-u-accent stroke-white stroke-2 cursor-pointer transition-all"
              />

              {/* Label */}
              <text x={cx} y={height - 8} textAnchor="middle" className="text-[10px] fill-u-muted font-medium">
                {p.label}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Tooltip */}
      {hoverIndex !== null && points[hoverIndex] && (
        <div
          className="absolute z-20 pointer-events-none -top-2 transform -translate-x-1/2 bg-u-ink2 text-u-onaccent text-[11px] rounded-lg px-2.5 py-1.5 shadow-xl transition-all"
          style={{ left: `${(getX(hoverIndex) / width) * 100}%` }}
        >
          <div className="font-semibold text-u-s3">{points[hoverIndex].label}</div>
          <div className="text-u-accent font-bold">
            {currentLabel}: {points[hoverIndex].current}
            {valueSuffix}
          </div>
          {points[hoverIndex].comparison !== undefined && (
            <div className="text-u-muted">
              {comparisonLabel}: {points[hoverIndex].comparison}
              {valueSuffix}
            </div>
          )}
          {points[hoverIndex].meta && (
            <div className="text-[10px] text-u-muted mt-0.5 border-t border-u-line2 pt-0.5">
              {points[hoverIndex].meta}
            </div>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center justify-end gap-4 mt-2 text-xs text-u-muted">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-u-accent rounded" />
          <span>{currentLabel}</span>
        </div>
        {hasComparison && (
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-u-line2 border-b border-dashed" />
            <span>{comparisonLabel}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ==========================================
// 2. Horizontal Ranking Bar Chart
// ==========================================
export interface BarRankingItem {
  id: string;
  label: string;
  subLabel?: string;
  value: number | null;
  change?: number | null;
  classification?: string;
  target?: number;
}

export function HorizontalBarRankingChart({
  items,
  onItemClick,
  targetValue = 80,
}: {
  items: BarRankingItem[];
  onItemClick?: (id: string) => void;
  targetValue?: number;
}) {
  return (
    <div className="space-y-3">
      {items.map((item, index) => {
        const val = item.value ?? 0;
        const isInsufficient = item.value === null;

        const barColor = isInsufficient
          ? "bg-u-line"
          : val >= 90
          ? "bg-u-ok"
          : val >= 75
          ? "bg-u-accent"
          : val >= 60
          ? "bg-u-warn"
          : "bg-u-danger";

        return (
          <div
            key={item.id}
            onClick={() => onItemClick && onItemClick(item.id)}
            className={`p-2.5 rounded-xl border border-u-line hover:border-u-line2 transition group ${
              onItemClick ? "cursor-pointer hover:bg-u-s2/50" : ""
            }`}
          >
            <div className="flex items-center justify-between text-xs mb-1.5">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-u-s3 text-u-ink2 font-bold flex items-center justify-center text-[10px]">
                  {index + 1}
                </span>
                <span className="font-semibold text-u-ink group-hover:text-u-accent transition">
                  {item.label}
                </span>
                {item.subLabel && <span className="text-u-muted text-[11px]">• {item.subLabel}</span>}
              </div>

              <div className="flex items-center gap-2">
                {item.change !== undefined && item.change !== null && (
                  <span
                    className={`text-[11px] font-semibold ${
                      item.change >= 0 ? "text-u-ok" : "text-u-danger"
                    }`}
                  >
                    {item.change >= 0 ? `+${item.change}` : item.change}
                  </span>
                )}
                <span className="font-bold text-u-ink text-sm">
                  {isInsufficient ? "Insufficient Data" : val.toFixed(1)}
                </span>
              </div>
            </div>

            {/* Bar with Target Marker */}
            <div className="relative w-full bg-u-s3 rounded-full h-2.5 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                style={{ width: `${Math.min(100, val)}%` }}
              />
              {/* Target Line */}
              {targetValue && (
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-u-ink2/60 z-10"
                  style={{ left: `${targetValue}%` }}
                  title={`Target Benchmark: ${targetValue}`}
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ==========================================
// 3. Donut Distribution Chart
// ==========================================
export interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

export function DonutPieChart({
  slices,
  centerTitle,
  centerValue,
  size = 140,
}: {
  slices: DonutSlice[];
  centerTitle?: string;
  centerValue?: string | number;
  size?: number;
}) {
  const total = slices.reduce((acc, s) => acc + s.value, 0);
  if (total === 0) return <div className="text-xs text-u-muted p-4 text-center">No records</div>;

  let accumulatedPercent = 0;
  const radius = 40;
  const strokeWidth = 14;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="flex items-center gap-6">
      <div className="relative" style={{ width: size, height: size }}>
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          {slices.map((slice, i) => {
            const percent = slice.value / total;
            const strokeDashoffset = circumference * (1 - percent);
            const rotation = accumulatedPercent * 360;
            accumulatedPercent += percent;

            return (
              <circle
                key={i}
                cx="50"
                cy="50"
                r={radius}
                fill="none"
                stroke={slice.color}
                strokeWidth={strokeWidth}
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                transform={`rotate(${rotation} 50 50)`}
                className="transition-all duration-300 hover:opacity-85"
              />
            );
          })}
        </svg>
        {(centerValue !== undefined || centerTitle) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
            {centerValue !== undefined && (
              <span className="text-lg font-bold text-u-ink leading-none">{centerValue}</span>
            )}
            {centerTitle && <span className="text-[10px] text-u-muted mt-0.5">{centerTitle}</span>}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="space-y-1 text-xs">
        {slices.map((s, idx) => (
          <div key={idx} className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
              <span className="text-u-ink2">{s.label}</span>
            </div>
            <span className="font-semibold text-u-ink">{s.value} ({Math.round((s.value / total) * 100)}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ==========================================
// 4. Backlog Aging Bar Distribution
// ==========================================
export function AgingDistributionChart({
  buckets,
}: {
  buckets: { label: string; count: number; color: string }[];
}) {
  const max = Math.max(...buckets.map((b) => b.count), 1);

  return (
    <div className="space-y-2">
      {buckets.map((b, idx) => (
        <div key={idx} className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="font-medium text-u-ink2">{b.label}</span>
            <span className="font-bold text-u-ink">{b.count} orders</span>
          </div>
          <div className="w-full bg-u-s3 rounded-full h-2 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${(b.count / max) * 100}%`,
                backgroundColor: b.color,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
