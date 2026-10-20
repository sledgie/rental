import {
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ComponentProps,
  type ReactNode,
} from "react";
import { cn } from "../../utils/cn";
import { Icon, type IconName } from "./Icon";
import { initials as toInitials } from "../../lib/format";

export type Tone = "neutral" | "azure" | "jade" | "amber" | "rose" | "cyan" | "muted";

const toneClasses: Record<Tone, string> = {
  neutral: "bg-u-s3 text-u-ink2 border-u-line2",
  azure: "bg-u-accent/12 text-u-accent border-u-accent/35",
  jade: "bg-u-ok/12 text-u-ok border-u-ok/35",
  amber: "bg-u-warn/12 text-u-warn border-u-warn/35",
  rose: "bg-u-danger/12 text-u-danger border-u-danger/35",
  cyan: "bg-u-blue/12 text-u-blue border-u-blue/35",
  muted: "bg-u-s2 text-u-muted border-u-line2",
};

const dotClasses: Record<Tone, string> = {
  neutral: "bg-u-s3",
  azure: "bg-u-accent",
  jade: "bg-u-ok",
  amber: "bg-u-warn",
  rose: "bg-u-danger",
  cyan: "bg-u-blue",
  muted: "bg-u-s3",
};

/* -------------------------------- Button -------------------------------- */

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "link";
  size?: "xs" | "sm" | "md";
  icon?: IconName;
  iconRight?: IconName;
  loading?: boolean;
};

export function Button({
  variant = "secondary",
  size = "sm",
  icon,
  iconRight,
  loading,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center gap-1.5 font-medium rounded-md border transition-all duration-150 select-none disabled:opacity-45 disabled:pointer-events-none active:translate-y-[0.5px] whitespace-nowrap";
  const sizes = {
    xs: "h-6.5 px-2 text-[11px]",
    sm: "h-8 px-2.5 text-[12.5px]",
    md: "h-9.5 px-3.5 text-[13.5px]",
  }[size];
  const variants = {
    primary:
      "bg-u-accent border-u-accent/60 text-u-onaccent shadow-[0_1px_0_rgba(255,255,255,0.16)_inset,0_6px_18px_-8px_color-mix(in_srgb,var(--accent)_70%,transparent)] hover:bg-u-accent hover:border-u-accent/70",
    secondary: "bg-u-s3 border-u-line2 text-u-ink2 hover:bg-u-s3 hover:border-u-line hover:text-u-ink",
    ghost: "bg-transparent border-transparent text-u-muted hover:bg-u-s3 hover:text-u-ink",
    danger: "bg-u-danger/12 border-u-danger/40 text-u-danger hover:bg-u-danger/22",
    link: "bg-transparent border-transparent text-u-accent hover:text-u-accent px-0 underline-offset-4 hover:underline",
  }[variant];

  return (
    <button className={cn(base, sizes, variants, className)} disabled={disabled || loading} {...rest}>
      {loading ? (
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-[1.5px] border-current border-t-transparent" />
      ) : (
        icon && <Icon name={icon} size={size === "xs" ? 12 : 14} />
      )}
      {children}
      {iconRight && <Icon name={iconRight} size={size === "xs" ? 12 : 14} />}
    </button>
  );
}

export function IconButton({
  label,
  icon,
  className,
  size = 14,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; icon: IconName; size?: number }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-7 w-7 items-center justify-center rounded-md text-u-muted transition-colors hover:bg-u-s3 hover:text-u-ink",
        className,
      )}
      {...rest}
    >
      <Icon name={icon} size={size} />
    </button>
  );
}

/* --------------------------------- Pill --------------------------------- */

export function Pill({
  tone = "neutral",
  children,
  dot,
  pulse,
  icon,
  className,
  title,
}: {
  tone?: Tone;
  children: ReactNode;
  dot?: boolean;
  pulse?: boolean;
  icon?: IconName;
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-[2px] text-[11px] font-medium leading-[16px] tracking-[0.01em]",
        toneClasses[tone],
        className,
      )}
    >
      {dot && <StatusDot tone={tone} pulse={pulse} />}
      {icon && <Icon name={icon} size={11} />}
      {children}
    </span>
  );
}

export function StatusDot({ tone = "neutral", pulse, className }: { tone?: Tone; pulse?: boolean; className?: string }) {
  return (
    <span className={cn("relative inline-flex h-1.5 w-1.5 shrink-0", className)}>
      {pulse && (
        <span
          className={cn("absolute inset-0 rounded-full animate-u-ping-soft", dotClasses[tone])}
          aria-hidden="true"
        />
      )}
      <span className={cn("relative h-1.5 w-1.5 rounded-full", dotClasses[tone])} />
    </span>
  );
}

/* -------------------------------- Panels -------------------------------- */

export function Panel({
  children,
  className,
  as: As = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: React.ElementType;
}) {
  return <As className={cn("rounded-lg border border-u-line2 bg-u-card/85", className)}>{children}</As>;
}

export function SectionHeading({
  title,
  meta,
  action,
  icon,
  className,
}: {
  title: string;
  meta?: ReactNode;
  action?: ReactNode;
  icon?: IconName;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-3", className)}>
      <div className="flex items-center gap-2">
        {icon && (
          <span className="flex h-5 w-5 items-center justify-center rounded-[5px] border border-u-line2 bg-u-s2 text-u-accent">
            <Icon name={icon} size={12} />
          </span>
        )}
        <h3 className="font-display text-[12.5px] font-600 uppercase tracking-[0.1em] text-u-ink2">{title}</h3>
        {meta && <span className="text-[11px] text-u-muted">{meta}</span>}
      </div>
      {action}
    </div>
  );
}

export function KeyValue({
  label,
  children,
  className,
  mono,
}: {
  label: string;
  children: ReactNode;
  className?: string;
  mono?: boolean;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="text-[10.5px] font-medium uppercase tracking-[0.09em] text-u-muted">{label}</dt>
      <dd className={cn("mt-0.5 truncate text-[12.5px] text-u-ink2", mono && "u-num")}>{children}</dd>
    </div>
  );
}

/* --------------------------------- Form --------------------------------- */

export function Field({
  label,
  hint,
  error,
  required,
  children,
  className,
}: {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="text-[11.5px] font-medium text-u-muted">
          {label}
          {required && <span className="ml-1 text-u-danger">*</span>}
        </span>
        {hint && <span className="text-[10.5px] text-u-muted">{hint}</span>}
      </span>
      {children}
      {error && (
        <span className="mt-1 flex items-center gap-1 text-[11px] text-u-danger">
          <Icon name="alert" size={11} />
          {error}
        </span>
      )}
    </label>
  );
}

const controlBase =
  "w-full rounded-md border bg-u-bg/80 px-2.5 text-[13px] text-u-ink placeholder:text-u-muted transition-colors focus:border-u-accent focus:bg-u-bg focus:outline-none focus:ring-2 focus:ring-u-accent/20 disabled:opacity-50";

export function TextInput({
  className,
  invalid,
  ...rest
}: ComponentProps<"input"> & { invalid?: boolean }) {
  return (
    <input
      className={cn(controlBase, "h-9", invalid ? "border-u-danger/60" : "border-u-line2", className)}
      {...rest}
    />
  );
}

export function TextArea({
  className,
  invalid,
  ...rest
}: ComponentProps<"textarea"> & { invalid?: boolean }) {
  return (
    <textarea
      className={cn(controlBase, "py-2 leading-relaxed", invalid ? "border-u-danger/60" : "border-u-line2", className)}
      {...rest}
    />
  );
}

export function Select({
  className,
  invalid,
  children,
  ...rest
}: ComponentProps<"select"> & { invalid?: boolean }) {
  return (
    <div className="relative">
      <select
        className={cn(
          controlBase,
          "h-9 appearance-none pr-7",
          invalid ? "border-u-danger/60" : "border-u-line2",
          className,
        )}
        {...rest}
      >
        {children}
      </select>
      <Icon
        name="chevronDown"
        size={13}
        className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-u-muted"
      />
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="group inline-flex items-center gap-2 text-[12.5px] text-u-ink2 hover:text-u-ink"
    >
      <span
        className={cn(
          "relative h-4.5 w-8 rounded-full border transition-colors duration-200",
          checked ? "border-u-accent/60 bg-u-accent/70" : "border-u-line2 bg-u-s3",
        )}
      >
        <span
          className={cn(
            "absolute top-[1px] h-3 w-3 rounded-full bg-u-ink shadow transition-all duration-200",
            checked ? "left-[17px]" : "left-[2px]",
          )}
        />
      </span>
      {label}
    </button>
  );
}

/* ------------------------------ Empty state ----------------------------- */

export function EmptyState({
  icon = "inbox",
  title,
  body,
  action,
  compact,
}: {
  icon?: IconName;
  title: string;
  body?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed border-u-line2 bg-u-bg/45 text-center",
        compact ? "px-4 py-5" : "px-6 py-9",
      )}
    >
      <span className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg border border-u-line2 bg-u-s2 text-u-muted">
        <Icon name={icon} size={15} />
      </span>
      <p className="font-display text-[13px] font-600 text-u-ink2">{title}</p>
      {body && <p className="mt-1 max-w-md text-[12px] leading-relaxed text-u-muted">{body}</p>}
      {action && <div className="mt-3 flex flex-wrap items-center justify-center gap-2">{action}</div>}
    </div>
  );
}

/* -------------------------------- Avatars ------------------------------- */

export function Avatar({
  first,
  last,
  hue,
  size = 30,
  ring,
}: {
  first: string;
  last: string;
  hue: number;
  size?: number;
  ring?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-display font-600",
        ring && "ring-2 ring-u-line2",
      )}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        color: `hsl(${hue} 82% 82%)`,
        background: `linear-gradient(150deg, hsl(${hue} 46% 22%), hsl(${hue} 40% 14%))`,
        border: `1px solid hsl(${hue} 42% 32%)`,
      }}
      aria-hidden="true"
    >
      {toInitials(first, last)}
    </span>
  );
}

export function Thumb({
  src,
  alt,
  fallbackIcon = "building",
  className,
  rounded = "rounded-md",
}: {
  src?: string | null;
  alt: string;
  fallbackIcon?: IconName;
  className?: string;
  rounded?: string;
}) {
  const [failed, setFailed] = useState(false);
  const showImage = src && !failed;
  return (
    <span
      className={cn(
        "relative inline-block shrink-0 overflow-hidden border border-u-line2 bg-u-s2",
        rounded,
        className,
      )}
    >
      {showImage ? (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center bg-[linear-gradient(140deg,var(--surface-3),var(--card))] text-u-muted">
          <Icon name={fallbackIcon} size={16} />
        </span>
      )}
    </span>
  );
}

/* --------------------------------- Tabs --------------------------------- */

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  className,
}: {
  tabs: Array<{ id: T; label: string; count?: number; icon?: IconName }>;
  value: T;
  onChange: (id: T) => void;
  className?: string;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [value]);
  return (
    <div
      ref={listRef}
      role="tablist"
      className={cn("flex items-center gap-0.5 overflow-x-auto border-b border-u-line2 px-1", className)}
    >
      {tabs.map((t) => {
        const active = t.id === value;
        return (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(t.id)}
            className={cn(
              "relative flex shrink-0 items-center gap-1.5 px-2.5 py-2.5 text-[12.5px] font-medium transition-colors",
              active ? "text-u-ink" : "text-u-muted hover:text-u-ink2",
            )}
          >
            {t.icon && <Icon name={t.icon} size={13} />}
            {t.label}
            {t.count !== undefined && (
              <span
                className={cn(
                  "u-num rounded-full px-1.5 py-px text-[10px]",
                  active ? "bg-u-accent/18 text-u-accent" : "bg-u-s3 text-u-muted",
                )}
              >
                {t.count}
              </span>
            )}
            <span
              className={cn(
                "absolute inset-x-2 -bottom-px h-[2px] rounded-full transition-all duration-250",
                active ? "bg-u-accent opacity-100" : "opacity-0",
              )}
            />
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------- Progress ------------------------------- */

export function Progress({
  value,
  tone = "azure",
  className,
  height = 4,
}: {
  value: number;
  tone?: Tone;
  className?: string;
  height?: number;
}) {
  const [w, setW] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setW(Math.min(100, Math.max(0, value))));
    return () => cancelAnimationFrame(id);
  }, [value]);
  return (
    <span
      className={cn("block w-full overflow-hidden rounded-full bg-u-s3", className)}
      style={{ height }}
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <span
        className={cn("block h-full rounded-full transition-[width] duration-700 ease-out", dotClasses[tone])}
        style={{ width: `${w}%` }}
      />
    </span>
  );
}

/* ------------------------------- Sparkline ------------------------------ */

export function Sparkline({
  data,
  width = 132,
  height = 34,
  tone = "var(--accent)",
  fill = true,
}: {
  data: number[];
  width?: number;
  height?: number;
  tone?: string;
  fill?: boolean;
}) {
  const max = Math.max(...data, 1);
  const step = data.length > 1 ? width / (data.length - 1) : width;
  const pts = data.map((v, i) => [i * step, height - (v / max) * (height - 4) - 2] as const);
  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const area = `${line} L${width},${height} L0,${height} Z`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      {fill && <path d={area} fill={tone} opacity={0.13} />}
      <path d={line} fill="none" stroke={tone} strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" />
      {pts.length > 0 && (
        <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r={2.2} fill={tone} />
      )}
    </svg>
  );
}

/* -------------------------------- CountUp ------------------------------- */

export function CountUp({ value, format, duration = 620 }: { value: number; format: (n: number) => string; duration?: number }) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  useEffect(() => {
    const from = fromRef.current;
    const delta = value - from;
    if (Math.abs(delta) < 0.005) {
      setDisplay(value);
      fromRef.current = value;
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(from + delta * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <>{format(display)}</>;
}

/* ------------------------------- Skeleton ------------------------------- */

export function Skeleton({ className }: { className?: string }) {
  return <span className={cn("u-skeleton block", className)} />;
}

/* -------------------------------- Tooltip ------------------------------- */

export function Tip({ content, children, side = "top" }: { content: ReactNode; children: ReactNode; side?: "top" | "bottom" }) {
  return (
    <span className="group/tip relative inline-flex">
      {children}
      <span
        role="tooltip"
        className={cn(
          "pointer-events-none absolute left-1/2 z-50 w-max max-w-[260px] -translate-x-1/2 rounded-md border border-u-line2 bg-u-bg/97 px-2 py-1.5 text-[11px] leading-snug text-u-ink2 opacity-0 shadow-xl transition-all duration-150 group-hover/tip:opacity-100",
          side === "top" ? "bottom-[calc(100%+6px)]" : "top-[calc(100%+6px)]",
        )}
      >
        {content}
      </span>
    </span>
  );
}
