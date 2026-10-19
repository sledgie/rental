import { useEffect, useRef, useState } from "react";
import { useChartPalette, type Tone } from "../theme";
import { cn } from "../utils/cn";

/* ------------------------------------------------------------------ */
/* Sparkline / area chart                                              */
/* ------------------------------------------------------------------ */

export function Sparkline({
  data,
  width = 120,
  height = 36,
  tone = "indigo",
  stroke,
  fillFrom,
  fillTo,
  strokeWidth = 2,
  showDot = true,
  className,
}: {
  data: number[];
  width?: number;
  height?: number;
  tone?: Tone;
  stroke?: string;
  fillFrom?: string;
  fillTo?: string;
  strokeWidth?: number;
  showDot?: boolean;
  className?: string;
}) {
  const pal = useChartPalette();
  const id = useRef(`sg-${Math.random().toString(36).slice(2, 9)}`).current;
  if (!data.length) return null;

  const t = pal.tone[tone];
  const lineColor = stroke ?? t.stroke;
  const top = fillFrom ?? t.fill;
  const bottom = fillTo ?? "rgba(0,0,0,0)";

  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const pad = strokeWidth + 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * (width - pad * 2) + pad;
    const y = height - pad - ((v - min) / span) * (height - pad * 2);
    return [x, y] as const;
  });
  const line = pts
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(" ");
  const area = `${line} L${width - pad},${height} L${pad},${height} Z`;
  const last = pts[pts.length - 1];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={cn("overflow-visible", className)}
      style={{ width, height }}
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={top} />
          <stop offset="100%" stopColor={bottom} />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path
        d={line}
        fill="none"
        stroke={lineColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        style={{
          strokeDasharray: 1,
          strokeDashoffset: 0,
          animation: "draw 1.4s ease-out both",
        }}
      />
      {showDot && (
        <>
          <circle cx={last[0]} cy={last[1]} r={strokeWidth + 1.6} fill="var(--c-surface)" />
          <circle cx={last[0]} cy={last[1]} r={strokeWidth * 0.9} fill={lineColor} />
        </>
      )}
      <style>{`@keyframes draw { from { stroke-dashoffset: 1 } to { stroke-dashoffset: 0 } }`}</style>
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Donut / gauge                                                       */
/* ------------------------------------------------------------------ */

export function Donut({
  value,
  size = 92,
  thickness = 10,
  track,
  color,
  color2,
  tone,
  label,
  sublabel,
}: {
  value: number; // 0..1
  size?: number;
  thickness?: number;
  track?: string;
  color?: string;
  color2?: string;
  tone?: Tone;
  label?: string;
  sublabel?: string;
}) {
  const pal = useChartPalette();
  const id = useRef(`dg-${Math.random().toString(36).slice(2, 9)}`).current;
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, value));
  const t = tone ? pal.tone[tone] : null;

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={color ?? t?.from ?? pal.tone.indigo.from} />
            <stop offset="100%" stopColor={color2 ?? t?.to ?? pal.tone.indigo.to} />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={track ?? pal.track}
          strokeWidth={thickness}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#${id})`}
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          style={{ transition: "stroke-dashoffset 900ms cubic-bezier(.22,1,.36,1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-base font-bold tabular-nums text-ink">{label ?? `${Math.round(pct * 100)}%`}</span>
        {sublabel && (
          <span className="text-[9px] font-semibold uppercase tracking-wider text-ink-3">
            {sublabel}
          </span>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Radial segmented meter                                              */
/* ------------------------------------------------------------------ */

export function SegmentedMeter({
  total,
  filled,
  size = 46,
  tone = "emerald",
}: {
  total: number;
  filled: number;
  size?: number;
  tone?: "emerald" | "amber" | "rose" | "indigo";
}) {
  const on = {
    emerald: "bg-sage-500",
    amber: "bg-sand-500",
    rose: "bg-brick-500",
    indigo: "bg-mint-500",
  }[tone];
  return (
    <div className="flex items-end gap-[3px]" style={{ height: size }}>
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={cn(
            "w-[5px] rounded-sm transition-all duration-500",
            i < filled ? on : "bg-surface-3",
          )}
          style={{ height: `${28 + (i % 3) * 22}%`, transitionDelay: `${i * 28}ms` }}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Avatar stack                                                        */
/* ------------------------------------------------------------------ */

const palette = [
  "from-gry-600 to-gry-700",
  "from-gry-500 to-gry-600",
  "from-gry-600 to-gry-700",
  "from-gry-500 to-gry-600",
];

const hash = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 9973;
  return h;
};

export function initials(name: string) {
  return name
    .replace(/[^A-Za-z &-]/g, "")
    .split(/\s+|&/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export function Avatar({
  name,
  size = 28,
  ring = "ring-surface",
  className,
}: {
  name: string;
  size?: number;
  ring?: string;
  className?: string;
}) {
  const grad = palette[hash(name) % palette.length];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br font-semibold text-gry-100 ring-2",
        grad,
        ring,
        className,
      )}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      title={name}
    >
      {initials(name)}
    </span>
  );
}

export function AvatarStack({ names, max = 4 }: { names: string[]; max?: number }) {
  const shown = names.slice(0, max);
  const extra = names.length - shown.length;
  return (
    <div className="flex items-center">
      <div className="flex -space-x-2">
        {shown.map((n) => (
          <Avatar key={n} name={n} size={28} />
        ))}
        {extra > 0 && (
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-surface-3 text-[10px] font-bold text-ink-2 ring-2 ring-surface">
            +{extra}
          </span>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 12-month payment heat strip                                         */
/* ------------------------------------------------------------------ */

export function HeatStrip({ history, className }: { history: number[]; className?: string }) {
  return (
    <div className={cn("flex items-center gap-[2px]", className)}>
      {history.map((v, i) => (
        <span
          key={i}
          title={`Month ${i + 1}: ${v === 1 ? "on time" : v === 0.5 ? "late" : "missed"}`}
          className={cn(
            "h-6 w-[6px] rounded-[2px] transition-all duration-300",
            v === 1
              ? "bg-sage-400 dark:bg-sage-400"
              : v === 0.5
                ? "bg-sand-400 dark:bg-sand-400"
                : "bg-brick-400 dark:bg-brick-500",
          )}
          style={{ transitionDelay: `${i * 22}ms` }}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Progress bar                                                        */
/* ------------------------------------------------------------------ */

export function Bar({
  value,
  tone = "indigo",
  height = 6,
  delay = 0,
  className,
}: {
  value: number; // 0..1
  tone?: "indigo" | "emerald" | "amber" | "rose" | "slate";
  height?: number;
  delay?: number;
  className?: string;
}) {
  const tones = {
    indigo: "from-mint-400 to-mint-500",
    emerald: "from-sage-400 to-sage-500",
    amber: "from-sand-400 to-sand-500",
    rose: "from-brick-400 to-brick-500",
    slate: "from-gry-400 to-gry-500 dark:from-gry-500 dark:to-gry-400",
  };
  return (
    <div
      className={cn("w-full overflow-hidden rounded-full bg-surface-3", className)}
      style={{ height }}
    >
      <div
        className={cn(
          "h-full rounded-full bg-gradient-to-r transition-[width] duration-700 ease-out",
          tones[tone],
        )}
        style={{
          width: `${Math.max(2, Math.min(100, value * 100))}%`,
          transitionDelay: `${delay}ms`,
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Animated number                                                     */
/* ------------------------------------------------------------------ */

export function useCountUp(target: number, duration = 900) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setVal(target * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return val;
}

/* ------------------------------------------------------------------ */
/* Expanding panel (height animated)                                   */
/* ------------------------------------------------------------------ */

export function Collapse({
  open,
  children,
  className,
}: {
  open: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [h, setH] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setH(el.scrollHeight));
    ro.observe(el);
    setH(el.scrollHeight);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      className={cn(
        "overflow-hidden transition-[max-height,opacity] duration-500 ease-[cubic-bezier(.22,1,.36,1)]",
        className,
      )}
      style={{
        maxHeight: open ? h : 0,
        opacity: open ? 1 : 0,
      }}
      aria-hidden={!open}
    >
      <div ref={ref}>{children}</div>
    </div>
  );
}
