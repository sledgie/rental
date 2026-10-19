import { useEffect, useId, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { cn } from "@/utils/cn";
import {
  metricValue,
  type ChannelSlice,
  type MetricKey,
  type SeriesPoint,
  type WeekdayPoint,
} from "@/lib/data";
import { compact, money, moneyFull, numberFull, pct } from "@/lib/format";

/* ------------------------------------------------------------------ helpers */
function smoothPath(points: [number, number][]) {
  if (!points.length) return "";
  if (points.length === 1) return `M${points[0][0]},${points[0][1]}`;
  let d = `M${points[0][0]},${points[0][1]}`;
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1];
    const [x1, y1] = points[i];
    const mid = (x1 - x0) * 0.45;
    d += ` C${x0 + mid},${y0} ${x1 - mid},${y1} ${x1},${y1}`;
  }
  return d;
}

function niceMax(value: number) {
  if (!Number.isFinite(value) || value <= 0) return 1;
  const exponent = Math.floor(Math.log10(value));
  const base = 10 ** exponent;
  const fraction = value / base;
  const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 2.5 ? 2.5 : fraction <= 5 ? 5 : 10;
  return nice * base;
}

function useWidth<T extends HTMLElement>(
  initial = typeof window === "undefined" ? 560 : Math.max(260, Math.min(780, window.innerWidth - 100))
) {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(initial);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect.width;
      if (next && next > 0) setWidth(next);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return { ref, width };
}

const tooltipClass =
  "pointer-events-none absolute z-30 min-w-[142px] rounded-xl bg-[var(--tooltip)] px-3 py-2 text-[var(--tooltip-ink)] shadow-pop";

/* --------------------------------------------------------------- sparkline */
export function Sparkline({
  values,
  color = "var(--c1)",
  width = 92,
  height = 34,
  className,
}: {
  values: number[];
  color?: string;
  width?: number;
  height?: number;
  className?: string;
}) {
  const rawId = useId();
  const id = `spark-${rawId.replace(/[:]/g, "")}`;
  const data = values.length > 1 ? values : values.length === 1 ? [values[0], values[0]] : [0, 0];
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const pad = 3;
  const points: [number, number][] = data.map((value, index) => [
    (index / (data.length - 1)) * width,
    pad + (1 - (value - min) / span) * (height - pad * 2),
  ]);
  const line = smoothPath(points);
  const area = `${line} L${width},${height} L0,${height} Z`;
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={cn("overflow-visible", className)}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        className="chart-line"
      />
      <circle cx={points[points.length - 1][0]} cy={points[points.length - 1][1]} r={2.4} fill={color} />
    </svg>
  );
}

/* ------------------------------------------------------------------- trend */
const METRIC_CONFIG: Record<
  MetricKey,
  { label: string; color: string; tick: (v: number) => string; full: (v: number) => string }
> = {
  revenue: { label: "Revenue", color: "var(--c1)", tick: money, full: moneyFull },
  occupancy: { label: "Occupancy", color: "var(--c2)", tick: (v) => pct(v, 0), full: (v) => pct(v) },
  bookings: { label: "Bookings", color: "var(--c4)", tick: (v) => compact(v, 1), full: numberFull },
};

export function TrendChart({
  buckets,
  previousBuckets,
  metric,
  compare,
}: {
  buckets: SeriesPoint[];
  previousBuckets: SeriesPoint[];
  metric: MetricKey;
  compare: boolean;
}) {
  const { ref, width } = useWidth<HTMLDivElement>();
  const rawId = useId();
  const id = `trend-${rawId.replace(/[:]/g, "")}`;
  const [hover, setHover] = useState<number | null>(null);

  const compactChart = width < 560;
  const H = compactChart ? 218 : 284;
  const pad = {
    top: 16,
    right: compactChart ? 8 : 14,
    bottom: 28,
    left: compactChart ? 44 : 56,
  };
  const plotW = Math.max(10, width - pad.left - pad.right);
  const plotH = H - pad.top - pad.bottom;
  const config = METRIC_CONFIG[metric];

  const current = useMemo(() => buckets.map((b) => metricValue(b, metric)), [buckets, metric]);
  const previous = useMemo(
    () => (compare ? previousBuckets.slice(0, buckets.length).map((b) => metricValue(b, metric)) : []),
    [previousBuckets, buckets.length, metric, compare]
  );

  const allValues = [...current, ...previous];
  const maxValue = metric === "occupancy" ? 1 : niceMax(Math.max(0.0001, ...allValues));
  const xAt = (index: number) =>
    pad.left + (current.length <= 1 ? plotW / 2 : (index / (current.length - 1)) * plotW);
  const yAt = (value: number) => pad.top + (1 - Math.min(value, maxValue) / maxValue) * plotH;

  const currentPoints: [number, number][] = current.map((value, index) => [xAt(index), yAt(value)]);
  const previousPoints: [number, number][] = previous.map((value, index) => [xAt(index), yAt(value)]);
  const linePath = smoothPath(currentPoints);
  const baseline = pad.top + plotH;
  const areaPath = currentPoints.length
    ? `${linePath} L${xAt(current.length - 1)},${baseline} L${xAt(0)},${baseline} Z`
    : "";

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => ({
    value: maxValue * (1 - ratio),
    y: pad.top + ratio * plotH,
  }));

  const labelIndices = useMemo(() => {
    const n = buckets.length;
    const maxTicks = compactChart ? 4 : 7;
    if (n <= maxTicks) return buckets.map((_, i) => i);
    const step = Math.ceil((n - 1) / (maxTicks - 1));
    const list: number[] = [];
    for (let i = 0; i < n; i += step) list.push(i);
    if (list[list.length - 1] !== n - 1) list.push(n - 1);
    return list;
  }, [buckets, compactChart]);

  const handleMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || !current.length) return;
    const x = ((event.clientX - rect.left) / rect.width) * width;
    const ratio = (x - pad.left) / plotW;
    const index = Math.round(ratio * (current.length - 1));
    setHover(Math.max(0, Math.min(current.length - 1, index)));
  };

  if (!buckets.length) {
    return <div className="grid h-64 place-items-center text-xs text-muted">No data for this range.</div>;
  }

  const activeIndex = hover;
  const active = activeIndex !== null ? buckets[activeIndex] : null;
  const activeValue = activeIndex !== null ? current[activeIndex] : 0;
  const prevValue = activeIndex !== null ? previous[activeIndex] : undefined;
  const leftPct = activeIndex !== null ? (xAt(activeIndex) / width) * 100 : 0;
  const activeY = activeIndex !== null ? yAt(current[activeIndex]) : 0;
  const align = leftPct < 18 ? "left" : leftPct > 78 ? "right" : "center";

  return (
    <div ref={ref} className="relative w-full select-none">
      <svg
        width={width}
        height={H}
        viewBox={`0 0 ${width} ${H}`}
        className="block touch-none"
        role="img"
        aria-label={`${config.label} trend across ${buckets.length} periods`}
        onPointerMove={handleMove}
        onPointerLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={config.color} stopOpacity="0.24" />
            <stop offset="70%" stopColor={config.color} stopOpacity="0.05" />
            <stop offset="100%" stopColor={config.color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {ticks.map((tick, index) => (
          <g key={index}>
            <line
              x1={pad.left}
              x2={width - pad.right}
              y1={tick.y}
              y2={tick.y}
              stroke="var(--grid)"
              strokeWidth={1}
              strokeDasharray={index === ticks.length - 1 ? undefined : "3 5"}
              vectorEffect="non-scaling-stroke"
            />
            <text
              x={pad.left - 8}
              y={tick.y + 3}
              textAnchor="end"
              fontSize={compactChart ? 9.5 : 10.5}
              fill="var(--muted)"
              className="tnum"
            >
              {config.tick(tick.value)}
            </text>
          </g>
        ))}

        {activeIndex !== null && (
          <line
            x1={xAt(activeIndex)}
            x2={xAt(activeIndex)}
            y1={pad.top - 4}
            y2={baseline}
            stroke="var(--brand)"
            strokeOpacity="0.35"
            strokeWidth={1}
            strokeDasharray="3 4"
            vectorEffect="non-scaling-stroke"
          />
        )}

        <path d={areaPath} fill={`url(#${id})`} className="chart-area" />
        {compare && previousPoints.length > 1 && (
          <path
            d={smoothPath(previousPoints)}
            fill="none"
            stroke="var(--muted)"
            strokeOpacity="0.55"
            strokeWidth={1.5}
            strokeDasharray="5 5"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            className="chart-area"
          />
        )}
        <path
          key={`line-${metric}-${buckets.length}-${buckets[0]?.key}-${buckets[buckets.length - 1]?.key}`}
          d={linePath}
          fill="none"
          stroke={config.color}
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={1}
          vectorEffect="non-scaling-stroke"
          className="chart-line"
        />

        {activeIndex !== null && (
          <g>
            {compare && prevValue !== undefined && previousPoints[activeIndex] && (
              <circle
                cx={previousPoints[activeIndex][0]}
                cy={previousPoints[activeIndex][1]}
                r={3.4}
                fill="var(--surface)"
                stroke="var(--muted)"
                strokeWidth={1.8}
              />
            )}
            <circle cx={xAt(activeIndex)} cy={activeY} r={8} fill={config.color} fillOpacity={0.16} />
            <circle
              cx={xAt(activeIndex)}
              cy={activeY}
              r={3.8}
              fill="var(--surface)"
              stroke={config.color}
              strokeWidth={2.2}
            />
          </g>
        )}

        {labelIndices.map((index) => {
          const point = buckets[index];
          if (!point) return null;
          const nearEdge = index === 0;
          const farEdge = index === buckets.length - 1;
          return (
            <text
              key={`${point.key}-${index}`}
              x={xAt(index)}
              y={H - 8}
              textAnchor={nearEdge ? "start" : farEdge ? "end" : "middle"}
              fontSize={compactChart ? 9.5 : 10.5}
              fill="var(--muted)"
            >
              {point.label}
            </text>
          );
        })}
      </svg>

      {active && activeIndex !== null && (
        <div
          className={tooltipClass}
          style={{
            left: `${leftPct}%`,
            top: Math.max(activeY, 72),
            transform: `translate(${align === "left" ? "0" : align === "right" ? "-100%" : "-50%"}, -118%)`,
          }}
        >
          <p className="text-[10px] font-medium uppercase tracking-wide opacity-65">{active.fullLabel}</p>
          <div className="mt-1.5 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ background: config.color }} />
            <span className="text-[17px] font-semibold leading-none tnum">{config.full(activeValue)}</span>
          </div>
          <p className="mt-1 text-[11px] opacity-70">{config.label}</p>
          {compare && prevValue !== undefined && (
            <div className="mt-1.5 flex items-center justify-between gap-4 border-t border-white/15 pt-1.5 text-[10.5px] opacity-80 dark:border-black/10">
              <span className="opacity-75">Previous</span>
              <span className="tnum">{config.full(prevValue)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------- donut */
export function DonutChart({
  data,
  totalLabel = "Total revenue",
  format = money,
  formatFull = moneyFull,
}: {
  data: ChannelSlice[];
  totalLabel?: string;
  format?: (n: number) => string;
  formatFull?: (n: number) => string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const size = 204;
  const center = size / 2;
  const radius = 74;
  const circumference = 2 * Math.PI * radius;
  const gap = 4;
  const total = data.reduce((sum, slice) => sum + slice.value, 0);
  let offset = 0;

  const focused = active !== null ? data[active] : null;

  return (
    <div className="@container">
      <div className="flex flex-col items-center gap-4 @[380px]:flex-row @[380px]:items-center @[380px]:gap-6">
      <div className="relative mx-auto shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-label="Revenue share by channel">
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="var(--surface-3)"
            strokeWidth={22}
          />
          <g transform={`rotate(-90 ${center} ${center})`}>
            {data.map((slice, index) => {
              const length = slice.pct * circumference;
              const dash = `${Math.max(length - gap, 0.5)} ${circumference - Math.max(length - gap, 0.5)}`;
              const element = (
                <circle
                  key={slice.key}
                  cx={center}
                  cy={center}
                  r={radius}
                  fill="none"
                  stroke={slice.color}
                  strokeWidth={active === index ? 28 : 22}
                  strokeDasharray={dash}
                  strokeDashoffset={-offset}
                  strokeLinecap="butt"
                  className="donut-seg cursor-pointer"
                  opacity={active === null || active === index ? 1 : 0.4}
                  onPointerEnter={() => setActive(index)}
                  onPointerLeave={() => setActive(null)}
                />
              );
              offset += length;
              return element;
            })}
          </g>
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="max-w-[104px] truncate text-[9px] font-semibold uppercase leading-none tracking-[0.08em] text-muted">
            {focused ? focused.label : totalLabel}
          </span>
          <span className="mt-1.5 font-display text-[23px] font-semibold leading-none tracking-[-0.03em] text-ink tnum">
            {format(focused ? focused.value : total)}
          </span>
          <span className="mt-1.5 text-[10px] leading-none text-muted tnum">
            {focused ? `${(focused.pct * 100).toFixed(1)}% of revenue` : `${data.length} channels`}
          </span>
        </div>
      </div>

      <div className="mt-5 grid w-full grid-cols-1 gap-1.5 @[380px]:mt-0 @[380px]:flex-1">
        {data.map((slice, index) => (
          <button
            key={slice.key}
            type="button"
            onPointerEnter={() => setActive(index)}
            onPointerLeave={() => setActive(null)}
            onFocus={() => setActive(index)}
            onBlur={() => setActive(null)}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors duration-200",
              active === index ? "bg-surface-2" : "hover:bg-surface-2"
            )}
          >
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: slice.color }} />
            <span className="flex-1 truncate text-xs font-medium text-ink-2">{slice.label}</span>
            <span className="text-xs font-semibold text-ink tnum">{format(slice.value)}</span>
            <span className="w-11 text-right text-[11px] text-muted tnum">{(slice.pct * 100).toFixed(1)}%</span>
          </button>
        ))}
      </div>
      <p className="sr-only">
        {data.map((slice) => `${slice.label}: ${formatFull(slice.value)}`).join(", ")}
      </p>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- bar chart */
export type WeekdayMetric = "bookings" | "revenue";

export function WeekdayBars({
  data,
  metric,
}: {
  data: WeekdayPoint[];
  metric: WeekdayMetric;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const valueOf = (point: WeekdayPoint, prev: boolean) =>
    metric === "bookings" ? (prev ? point.prevBookings : point.bookings) : prev ? point.prevRevenue : point.revenue;

  const max = niceMax(
    Math.max(0.0001, ...data.flatMap((point) => [valueOf(point, false), valueOf(point, true)])) * 1.02
  );
  const format = metric === "bookings" ? (v: number) => compact(v, 0) : (v: number) => money(v);
  const formatFull = metric === "bookings" ? (v: number) => `${numberFull(v)} bookings` : (v: number) => moneyFull(v);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => max * (1 - ratio));
  const peak = Math.max(...data.map((point) => valueOf(point, false)));

  return (
    <div>
      <div className="mt-5 flex gap-2.5">
        <div className="flex h-[178px] w-8 shrink-0 flex-col justify-between pb-0 text-right text-[9.5px] leading-none text-muted tnum sm:h-[196px] sm:w-9 sm:text-[10px]">
          {ticks.map((tick, index) => (
            <span key={index}>{format(tick)}</span>
          ))}
        </div>
        <div className="relative h-[178px] flex-1 sm:h-[196px]">
          <div className="absolute inset-0 flex flex-col justify-between">
            {ticks.map((_, index) => (
              <span
                key={index}
                className={cn("block w-full border-t", index === ticks.length - 1 ? "border-line" : "border-dashed border-line-soft")}
              />
            ))}
          </div>
          <div className="absolute inset-0 flex items-end justify-between gap-0.5 px-0.5 sm:gap-1">
            {data.map((point, index) => {
              const value = valueOf(point, false);
              const prevValue = valueOf(point, true);
              const isPeak = value === peak && value > 0;
              return (
                <div
                  key={point.short}
                  className="group relative flex h-full flex-1 flex-col justify-end rounded-t-md transition-colors duration-200 hover:bg-surface-2"
                  onPointerEnter={() => setHover(index)}
                  onPointerLeave={() => setHover(null)}
                >
                  <div className="flex h-full w-full items-end justify-center gap-[2px] px-1 sm:gap-1.5 sm:px-2">
                    <div
                      className="bar-fill w-[38%] max-w-[16px] rounded-t-[3px]"
                      style={{
                        height: `${Math.max(1.5, (value / max) * 100)}%`,
                        background: isPeak ? "var(--brand)" : "var(--c1)",
                        opacity: hover === null || hover === index ? 1 : 0.55,
                      }}
                    />
                    <div
                      className="bar-fill w-[26%] max-w-[10px] rounded-t-[3px]"
                      style={{
                        height: `${Math.max(1, (prevValue / max) * 100)}%`,
                        background: "var(--bar-prev)",
                      }}
                    />
                  </div>
                  {hover === index && (
                    <div
                      className={cn(tooltipClass, "bottom-full left-1/2 mb-2 -translate-x-1/2")}
                      style={{ minWidth: 148 }}
                    >
                      <p className="text-[10px] font-medium uppercase tracking-wide opacity-65">{point.label} average</p>
                      <p className="mt-1 text-[15px] font-semibold leading-none tnum">{formatFull(value)}</p>
                      <div className="mt-1.5 flex items-center justify-between gap-4 border-t border-white/15 pt-1.5 text-[10px] opacity-80 dark:border-black/10">
                        <span>Previous</span>
                        <span className="tnum">{formatFull(prevValue)}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="mt-2.5 flex pl-[42px] sm:pl-[46px]">
        {data.map((point, index) => (
          <span
            key={point.short}
            className={cn(
              "flex-1 text-center text-[10px] font-medium sm:text-[11px]",
              hover === index ? "text-ink" : "text-muted"
            )}
          >
            {point.short}
          </span>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-4 border-t border-line-soft pt-3">
        <span className="flex items-center gap-1.5 text-[11px] text-muted">
          <span className="h-2 w-2 rounded-sm" style={{ background: "var(--c1)" }} /> Current period
        </span>
        <span className="flex items-center gap-1.5 text-[11px] text-muted">
          <span className="h-2 w-2 rounded-sm" style={{ background: "var(--bar-prev)" }} /> Previous period
        </span>
        <span className="ml-auto hidden text-[11px] text-muted sm:inline">Hover a day for detail</span>
      </div>
    </div>
  );
}
