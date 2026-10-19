import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/utils/cn";
import { Icon, type IconName } from "./Icon";

export function Card({
  children,
  className,
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <div
      id={id}
      className={cn(
        "rounded-2xl border border-line bg-surface card-shadow transition-colors duration-300",
        className
      )}
    >
      {children}
    </div>
  );
}

interface DeltaProps {
  value: number | null;
  kind?: "percent" | "points";
  className?: string;
  compact?: boolean;
  invert?: boolean;
}

export function Delta({ value, kind = "percent", className, compact, invert }: DeltaProps) {
  if (value === null || Number.isNaN(value)) {
    return (
      <span className={cn("text-xs font-medium text-muted", className)} title="No comparison data">
        — no prior data
      </span>
    );
  }
  const positive = invert ? value < 0 : value >= 0;
  const flat = Math.abs(value) < 0.05;
  const display = flat
    ? "0.0" + (kind === "points" ? " pts" : "%")
    : `${value > 0 ? "+" : ""}${value.toFixed(1)}${kind === "points" ? " pts" : "%"}`;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-semibold tnum",
        compact ? "px-1.5 py-0.5 text-[11px]" : "px-2 py-1 text-xs",
        flat
          ? "bg-surface-3 text-muted"
          : positive
            ? "bg-positive-soft text-positive"
            : "bg-negative-soft text-negative",
        className
      )}
    >
      {!flat && (
        <Icon
          name={value > 0 ? "arrowUpRight" : "arrowDownRight"}
          size={compact ? 11 : 13}
          strokeWidth={2.2}
        />
      )}
      {display}
    </span>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  size = "md",
  className,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex items-center gap-0.5 rounded-lg border border-line bg-surface-2 p-0.5",
        className
      )}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={selected}
            className={cn(
              "rounded-[7px] font-medium transition-all duration-200",
              size === "sm" ? "px-2.5 py-1 text-[11px]" : "px-3 py-1.5 text-xs",
              selected
                ? "bg-surface text-ink shadow-[0_1px_2px_rgba(17,23,19,0.12)]"
                : "text-muted hover:text-ink"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  id,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  id?: string;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-[20px] w-[34px] shrink-0 items-center rounded-full border transition-colors duration-200",
        checked ? "border-brand bg-brand" : "border-line bg-surface-3"
      )}
    >
      <span
        className={cn(
          "block h-[14px] w-[14px] rounded-full bg-white shadow-sm transition-transform duration-200 dark:bg-[#0d1510]",
          checked ? "translate-x-[17px]" : "translate-x-[2px]"
        )}
      />
    </button>
  );
}

export function Badge({
  children,
  tone = "neutral",
  className,
  dot,
}: {
  children: ReactNode;
  tone?: "neutral" | "positive" | "amber" | "brand";
  className?: string;
  dot?: boolean;
}) {
  const toneClass = {
    neutral: "bg-surface-3 text-ink-2",
    positive: "bg-positive-soft text-positive",
    amber: "bg-amber-soft text-amber",
    brand: "bg-brand-soft text-brand-ink",
  }[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-medium leading-none",
        toneClass,
        className
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export function IconButton({
  icon,
  label,
  onClick,
  className,
  badge,
  children,
}: {
  icon?: IconName;
  label: string;
  onClick?: () => void;
  className?: string;
  badge?: number;
  children?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-transparent text-muted transition-all duration-200 hover:border-line hover:bg-surface-2 hover:text-ink",
        className
      )}
    >
      {icon && <Icon name={icon} size={18} />}
      {children}
      {badge ? (
        <span className="absolute right-1.5 top-1.5 flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-brand px-1 text-[9px] font-bold leading-none text-white dark:text-[#06110c]">
          {badge}
        </span>
      ) : null}
    </button>
  );
}

export function ProgressBar({
  value,
  color = "var(--c1)",
  className,
  trackClassName,
}: {
  value: number;
  color?: string;
  className?: string;
  trackClassName?: string;
}) {
  return (
    <div
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-surface-3", trackClassName)}
      aria-hidden="true"
    >
      <div
        className={cn("h-full rounded-full transition-all duration-700 ease-out", className)}
        style={{ width: `${Math.min(100, Math.max(0, value * 100))}%`, background: color }}
      />
    </div>
  );
}

export function useDismiss<T extends HTMLElement>(active: boolean, onDismiss: () => void) {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    if (!active) return;
    const onPointerDown = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) onDismiss();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onDismiss();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [active, onDismiss]);
  return ref;
}

export function EmptyState({
  title,
  description,
  icon = "search",
  action,
}: {
  title: string;
  description: string;
  icon?: IconName;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-surface-3 text-muted">
        <Icon name={icon} size={20} />
      </div>
      <p className="text-sm font-semibold text-ink">{title}</p>
      <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="relative flex h-8 w-8 items-center justify-center rounded-[10px] bg-[#14211a] shadow-[inset_0_1px_0_rgba(255,255,255,0.14)] dark:bg-[var(--lime)]">
        <Icon
          name="key"
          size={17}
          strokeWidth={2}
          className="text-[var(--lime)] dark:text-[#122016]"
        />
      </div>
      {!compact && (
        <span className="font-display text-[19px] font-semibold tracking-[-0.04em] text-ink">
          keyline
        </span>
      )}
    </div>
  );
}
