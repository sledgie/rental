import type { ComponentType, ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@lf/utils/cn";

/**
 * Building blocks for the illustrative product previews.
 * Every preview is wrapped in <AppWindow>, which exposes a single accessible
 * description (role="img") and hides the decorative sample UI from assistive
 * technology. All figures shown in previews are sample data.
 */

export type Tone = "green" | "amber" | "rose" | "sky" | "neutral" | "evergreen";

export function SampleBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border border-amber/25 bg-amber-soft px-1.5 py-0.5 text-3xs font-semibold uppercase tracking-[0.06em] text-amber-ink",
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-amber" />
      Sample data
    </span>
  );
}

export function Crumbs({ items }: { items: string[] }) {
  return (
    <span className="flex min-w-0 items-center gap-1 text-2xs text-muted">
      {items.map((item, index) => (
        <span
          key={item}
          className={cn("flex min-w-0 items-center gap-1", index === items.length - 1 && "font-medium text-ink")}
        >
          {index > 0 && <ChevronRight className="size-3 shrink-0 text-line-strong" />}
          <span className="truncate">{item}</span>
        </span>
      ))}
    </span>
  );
}

interface AppWindowProps {
  /** Accessible description of the illustrative screen. */
  label: string;
  toolbar?: ReactNode;
  toolbarEnd?: ReactNode;
  caption?: ReactNode;
  className?: string;
  frameClassName?: string;
  children: ReactNode;
}

export function AppWindow({ label, toolbar, toolbarEnd, caption, className, frameClassName, children }: AppWindowProps) {
  return (
    <figure className={cn("relative", className)}>
      <div
        role="img"
        aria-label={label}
        className={cn(
          "@container overflow-hidden rounded-card border border-line bg-white shadow-mockup",
          frameClassName,
        )}
      >
        <div aria-hidden="true">
          <div className="flex h-9 items-center gap-3 border-b border-line bg-[#fafaf7] px-3">
            <span className="flex shrink-0 items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-[#e2e6e2]" />
              <span className="size-2.5 rounded-full bg-[#e2e6e2]" />
              <span className="size-2.5 rounded-full bg-[#e2e6e2]" />
            </span>
            <div className="flex min-w-0 flex-1 items-center gap-2">{toolbar}</div>
            {toolbarEnd}
            <SampleBadge />
          </div>
          {children}
        </div>
      </div>
      {caption && <figcaption className="mt-3 text-center text-xs leading-relaxed text-muted">{caption}</figcaption>}
    </figure>
  );
}

interface PanelProps {
  title?: ReactNode;
  meta?: ReactNode;
  action?: ReactNode;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}

/** Card inside a preview. It is its own container-query context. */
export function Panel({ title, meta, action, className, bodyClassName, children }: PanelProps) {
  return (
    <div className={cn("@container min-w-0 rounded-lg border border-line bg-white", className)}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-2 border-b border-line/80 px-3 py-2">
          <div className="min-w-0">
            {title && <div className="truncate text-2xs font-semibold text-ink">{title}</div>}
            {meta && <div className="truncate text-3xs text-muted">{meta}</div>}
          </div>
          {action}
        </div>
      )}
      <div className={cn("p-3", bodyClassName)}>{children}</div>
    </div>
  );
}

const PILL_TONES: Record<Tone, string> = {
  green: "bg-sage text-forest",
  amber: "bg-amber-soft text-amber-ink",
  rose: "bg-rose-soft text-rose",
  sky: "bg-sky-soft text-sky",
  neutral: "bg-[#eef0ed] text-muted",
  evergreen: "bg-evergreen text-white",
};

export function StatusPill({
  tone = "neutral",
  dot = true,
  className,
  children,
}: {
  tone?: Tone;
  dot?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-1.5 py-[3px] text-3xs font-semibold leading-none",
        PILL_TONES[tone],
        className,
      )}
    >
      {dot && <span className="size-1.5 shrink-0 rounded-full bg-current opacity-70" />}
      {children}
    </span>
  );
}

const AVATAR_TONES = [
  "bg-sage text-forest",
  "bg-amber-soft text-amber-ink",
  "bg-sky-soft text-sky",
  "bg-[#ece8f3] text-[#5a4a78]",
  "bg-rose-soft text-rose",
  "bg-[#e9ece9] text-ink",
];

export function Avatar({ initials, tone = 0, className }: { initials: string; tone?: number; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex size-6 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold",
        AVATAR_TONES[tone % AVATAR_TONES.length],
        className,
      )}
    >
      {initials}
    </span>
  );
}

export function IdTag({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded border border-line bg-ivory px-1 font-mono text-[10px] leading-4 text-evergreen",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function ProgressBar({
  value,
  tone = "forest",
  className,
}: {
  value: number;
  tone?: "forest" | "amber" | "sky";
  className?: string;
}) {
  const fill = { forest: "bg-forest", amber: "bg-amber", sky: "bg-sky" }[tone];
  return (
    <span className={cn("block h-1.5 w-full overflow-hidden rounded-full bg-sage", className)}>
      <span className={cn("block h-full rounded-full", fill)} style={{ width: `${Math.min(100, value)}%` }} />
    </span>
  );
}

export function StatCard({
  label,
  value,
  meta,
  accent,
  children,
}: {
  label: string;
  value: string;
  meta?: string;
  accent?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-line bg-white p-2.5">
      <div className="flex items-center justify-between gap-2 text-3xs font-medium text-muted">
        <span className="truncate">{label}</span>
        {accent && <span className="size-1.5 shrink-0 rounded-full bg-amber" />}
      </div>
      <div className="mt-1 truncate text-[13px] font-semibold leading-tight tracking-tight text-ink tabular-nums @md:text-[15px]">
        {value}
      </div>
      {meta && <div className="mt-0.5 truncate text-3xs text-muted">{meta}</div>}
      {children}
    </div>
  );
}

export function ChartLegend({ items }: { items: { label: string; swatch: string }[] }) {
  return (
    <span className="flex shrink-0 items-center gap-2.5 text-3xs text-muted">
      {items.map((item) => (
        <span key={item.label} className="flex items-center gap-1">
          <span className={cn("size-2 rounded-sm", item.swatch)} />
          {item.label}
        </span>
      ))}
    </span>
  );
}

export function LinkChip({ icon: Icon, children }: { icon: ComponentType<{ className?: string }>; children: ReactNode }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-md border border-line bg-white px-1.5 py-0.5 text-3xs text-evergreen">
      <Icon className="size-3 shrink-0 text-forest" />
      <span className="truncate">{children}</span>
    </span>
  );
}
