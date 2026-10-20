import type { ReactNode } from "react";
import { cn } from "../../utils/cn";
import { Icon, type IconName } from "../../components/ui/Icon";
import type { Tone } from "../../components/ui/primitives";

/** Bordered block with a compact subheading — the unit of composition inside
 *  the expanded row and the profile drawer. */
export function SectionCard({
  icon,
  title,
  meta,
  actions,
  children,
  className,
  bodyClassName,
  step,
}: {
  icon: IconName;
  title: string;
  meta?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  step?: string;
}) {
  return (
    <section className={cn("overflow-hidden rounded-lg border border-u-line2 bg-u-card/55", className)}>
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-u-line2/70 bg-u-s2/45 px-3 py-2">
        <span className="flex h-5.5 w-5.5 items-center justify-center rounded-[5px] border border-u-line2 bg-u-bg text-u-accent">
          <Icon name={icon} size={12} />
        </span>
        <h4 className="font-display text-[12px] font-600 uppercase tracking-[0.11em] text-u-ink2">{title}</h4>
        {step && <span className="u-num rounded bg-u-s3 px-1.5 py-px text-[10px] text-u-muted">{step}</span>}
        {meta && <span className="min-w-0 flex-1 truncate text-[11.5px] text-u-muted">{meta}</span>}
        {!meta && <span className="flex-1" />}
        {actions && <div className="flex flex-wrap items-center gap-1.5">{actions}</div>}
      </header>
      <div className={cn("p-3", bodyClassName)}>{children}</div>
    </section>
  );
}

export function DefGrid({ children, cols = 4, className }: { children: ReactNode; cols?: 2 | 3 | 4 | 6; className?: string }) {
  const grid = {
    2: "sm:grid-cols-2",
    3: "sm:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4",
    6: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6",
  }[cols];
  return <dl className={cn("grid gap-x-4 gap-y-3", grid, className)}>{children}</dl>;
}

export function Def({
  label,
  children,
  mono,
  span,
  className,
}: {
  label: string;
  children: ReactNode;
  mono?: boolean;
  span?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", span && "col-span-2", className)}>
      <dt className="text-[10px] font-semibold uppercase tracking-[0.09em] text-u-muted">{label}</dt>
      <dd className={cn("mt-0.5 text-[12.5px] leading-snug text-u-ink2", mono && "u-num")}>{children}</dd>
    </div>
  );
}

const toneText: Record<Tone, string> = {
  neutral: "text-u-ink2",
  azure: "text-u-accent",
  jade: "text-u-ok",
  amber: "text-u-warn",
  rose: "text-u-danger",
  cyan: "text-u-blue",
  muted: "text-u-muted",
};

export function MiniStat({
  label,
  value,
  tone = "neutral",
  hint,
  icon,
}: {
  label: string;
  value: ReactNode;
  tone?: Tone;
  hint?: ReactNode;
  icon?: IconName;
}) {
  return (
    <div className="rounded-md border border-u-line2 bg-u-bg/55 px-2.5 py-2 transition-colors hover:border-u-line2 hover:bg-u-card">
      <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.09em] text-u-muted">
        {icon && <Icon name={icon} size={10} />}
        {label}
      </p>
      <p className={cn("u-num mt-1 text-[15px] font-600 leading-none", toneText[tone])}>{value}</p>
      {hint && <p className="mt-1 text-[10.5px] leading-snug text-u-muted">{hint}</p>}
    </div>
  );
}

export function MoneyLine({
  label,
  value,
  tone = "neutral",
  strong,
  hint,
}: {
  label: ReactNode;
  value: ReactNode;
  tone?: Tone;
  strong?: boolean;
  hint?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex items-baseline justify-between gap-3 py-1.5",
        strong ? "border-t border-u-line2 pt-2" : "border-t border-u-line2/50 first:border-t-0",
      )}
    >
      <span className={cn("min-w-0 text-[12px]", strong ? "font-600 text-u-ink" : "text-u-muted")}>
        <span className="block truncate">{label}</span>
        {hint && <span className="mt-0.5 block text-[10.5px] leading-snug text-u-muted">{hint}</span>}
      </span>
      <span className={cn("u-num shrink-0 text-[12.5px]", strong && "text-[14px] font-600", toneText[tone])}>{value}</span>
    </div>
  );
}

export function ActionLink({
  icon = "chevronRight",
  children,
  onClick,
  href,
  tone = "azure",
}: {
  icon?: IconName;
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  tone?: "azure" | "neutral";
}) {
  const cls = cn(
    "inline-flex items-center gap-1 rounded text-[11.5px] font-medium underline-offset-2 transition-colors hover:underline",
    tone === "azure" ? "text-u-accent hover:text-u-accent" : "text-u-muted hover:text-u-ink",
  );
  if (href) {
    return (
      <a className={cls} href={`#${href}`}>
        <Icon name={icon} size={11} />
        {children}
      </a>
    );
  }
  return (
    <button type="button" className={cls} onClick={onClick}>
      <Icon name={icon} size={11} />
      {children}
    </button>
  );
}

export function EmptyInline({
  icon = "inbox",
  title,
  body,
  actions,
  compact,
}: {
  icon?: IconName;
  title: string;
  body?: ReactNode;
  actions?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-start gap-2 rounded-md border border-dashed border-u-line2 bg-u-bg/40 sm:flex-row sm:items-center",
        compact ? "px-3 py-2.5" : "px-3.5 py-4",
      )}
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-u-line2 bg-u-s2 text-u-muted">
        <Icon name={icon} size={15} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[12.5px] font-600 text-u-ink2">{title}</p>
        {body && <p className="mt-0.5 text-[11.5px] leading-relaxed text-u-muted">{body}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-1.5">{actions}</div>}
    </div>
  );
}
