import { createPortal } from "react-dom";
import type { ReactNode } from "react";
import { cn } from "../../utils/cn";
import { initials } from "../../lib/format";
import { useStore } from "../../state/store";
import { IconCheck, IconInfo, IconWarn, IconX, IconChevronLeft, IconChevronRight } from "../icons";

/* --------------------------------- Panel --------------------------------- */

export function Panel({
  children,
  className,
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-u-line bg-u-card/80 shadow-[0_1px_0_0_rgba(255,255,255,0.02)_inset]",
        padded && "p-4",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function SectionHeader({
  id,
  icon,
  title,
  description,
  actions,
  className,
}: {
  id?: string;
  icon?: ReactNode;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div id={id} className={cn("flex flex-wrap items-start justify-between gap-3 scroll-mt-28", className)}>
      <div className="flex min-w-0 items-start gap-2.5">
        {icon && (
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-u-line2 bg-u-s2 text-u-muted">
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <h3 className="text-[13px] font-semibold tracking-wide text-u-ink">{title}</h3>
          {description && <p className="mt-0.5 text-[11.5px] leading-relaxed text-u-muted">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-1.5">{actions}</div>}
    </div>
  );
}

/* -------------------------------- Tooltip -------------------------------- */

export function Tooltip({
  label,
  children,
  side = "top",
  className,
}: {
  label: ReactNode;
  children: ReactNode;
  side?: "top" | "bottom";
  className?: string;
}) {
  return (
    <span className={cn("ap-ttip inline-flex max-w-full", className)}>
      {children}
      <span
        role="tooltip"
        className={cn(
          "ap-ttip-body pointer-events-none absolute left-1/2 z-40 w-max max-w-64 -translate-x-1/2 rounded-md border border-u-line2 bg-u-s2 px-2 py-1 text-left text-[11px] leading-snug font-normal whitespace-pre-line text-u-ink2 shadow-xl shadow-u-bg/50",
          side === "top" ? "bottom-[calc(100%+6px)]" : "top-[calc(100%+6px)]",
        )}
      >
        {label}
      </span>
    </span>
  );
}

/* ------------------------------- Empty state ----------------------------- */

export function EmptyState({
  icon,
  title,
  message,
  action,
}: {
  icon?: ReactNode;
  title: string;
  message: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      {icon && (
        <span className="mb-1 flex h-10 w-10 items-center justify-center rounded-xl border border-u-line2 bg-u-s2 text-u-muted">
          {icon}
        </span>
      )}
      <p className="text-[13px] font-semibold text-u-ink">{title}</p>
      <p className="max-w-md text-xs leading-relaxed text-u-muted">{message}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/* -------------------------------- Info rows ------------------------------ */

export function InfoGrid({
  children,
  cols = 3,
  className,
}: {
  children: ReactNode;
  cols?: 2 | 3 | 4;
  className?: string;
}) {
  return (
    <dl
      className={cn(
        "grid gap-x-6 gap-y-3",
        cols === 2 && "sm:grid-cols-2",
        cols === 3 && "sm:grid-cols-2 lg:grid-cols-3",
        cols === 4 && "sm:grid-cols-2 lg:grid-cols-4",
        className,
      )}
    >
      {children}
    </dl>
  );
}

export function Info({
  label,
  value,
  className,
  mono,
}: {
  label: string;
  value: ReactNode;
  className?: string;
  mono?: boolean;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="text-[10.5px] font-medium tracking-wide text-u-muted uppercase">{label}</dt>
      <dd
        className={cn(
          "mt-0.5 text-[13px] leading-snug break-words text-u-ink",
          mono && "font-mono text-[12px]",
        )}
      >
        {value ?? "—"}
      </dd>
    </div>
  );
}

/* --------------------------------- Avatar -------------------------------- */

export function Avatar({
  name,
  size = "md",
  tone = "default",
}: {
  name: string;
  size?: "xs" | "sm" | "md";
  tone?: "default" | "muted";
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full border border-u-line2 bg-u-s3 font-medium text-u-ink2",
        size === "xs" && "h-5 w-5 text-[9px]",
        size === "sm" && "h-6 w-6 text-[10px]",
        size === "md" && "h-8 w-8 text-[11px]",
        tone === "muted" && "border-dashed text-u-muted",
      )}
    >
      {initials(name)}
    </span>
  );
}

/* ------------------------------- Progress bar ---------------------------- */

export function ProgressBar({ value, tone = "brand" }: { value: number; tone?: "brand" | "amber" }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-u-s3">
      <div
        className={cn("h-full rounded-full transition-all", tone === "brand" ? "bg-u-accent" : "bg-u-warn")}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

/* ------------------------------- Pagination ------------------------------ */

export function Pagination({
  page,
  pageCount,
  total,
  pageSize,
  onPageSize,
  onPage,
}: {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  onPageSize: (n: number) => void;
  onPage: (n: number) => void;
}) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-u-line bg-u-s2/60 px-3 py-2.5">
      <div className="flex items-center gap-3 text-[11.5px] text-u-muted">
        <span>
          Showing <span className="text-u-ink2">{from}–{to}</span> of{" "}
          <span className="text-u-ink2">{total}</span>
        </span>
        <span className="hidden h-3 w-px bg-u-line2 sm:block" />
        <label className="hidden items-center gap-1.5 sm:flex">
          Rows
          <select
            value={pageSize}
            onChange={(e) => onPageSize(Number(e.target.value))}
            className="rounded-md border border-u-line2 bg-u-s2 px-1.5 py-0.5 text-[11.5px] text-u-ink focus:border-u-accent focus:outline-none"
          >
            {[10, 25, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPage(Math.max(1, page - 1))}
          disabled={page <= 1}
          aria-label="Previous page"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-u-line text-u-muted transition-colors hover:border-u-line2 hover:text-u-ink disabled:opacity-40"
        >
          <IconChevronLeft />
        </button>
        {Array.from({ length: pageCount }, (_, i) => i + 1)
          .filter((p) => p === 1 || p === pageCount || Math.abs(p - page) <= 1)
          .map((p, idx, arr) => (
            <span key={p} className="flex items-center">
              {idx > 0 && arr[idx - 1] !== p - 1 && (
                <span className="px-1 text-[11px] text-u-muted">…</span>
              )}
              <button
                type="button"
                onClick={() => onPage(p)}
                aria-current={p === page ? "page" : undefined}
                className={cn(
                  "inline-flex h-7 min-w-7 items-center justify-center rounded-md border px-1.5 text-[11.5px] transition-colors",
                  p === page
                    ? "border-u-accent/60 bg-u-accent/15 text-u-accent"
                    : "border-u-line text-u-muted hover:border-u-line2 hover:text-u-ink",
                )}
              >
                {p}
              </button>
            </span>
          ))}
        <button
          type="button"
          onClick={() => onPage(Math.min(pageCount, page + 1))}
          disabled={page >= pageCount}
          aria-label="Next page"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-u-line text-u-muted transition-colors hover:border-u-line2 hover:text-u-ink disabled:opacity-40"
        >
          <IconChevronRight />
        </button>
      </div>
    </div>
  );
}

/* --------------------------------- Toasts -------------------------------- */

const toastTone = {
  info: { cls: "border-u-line2 bg-u-s2 text-u-ink", Icon: IconInfo },
  success: { cls: "border-u-ok/35 bg-u-ok/10 text-u-ok", Icon: IconCheck },
  warn: { cls: "border-u-warn/35 bg-u-warn/10 text-u-warn", Icon: IconWarn },
  error: { cls: "border-u-danger/35 bg-u-danger/10 text-u-danger", Icon: IconWarn },
};

export function Toasts() {
  const { state, dispatch } = useStore();
  return createPortal(
    <div className="u-root">
    <div className="pointer-events-none fixed right-4 bottom-4 z-[160] flex w-80 flex-col gap-2">
      {state.toasts.map((t) => {
        const { cls, Icon } = toastTone[t.variant];
        return (
          <div
            key={t.id}
            role="status"
            className={cn(
              "pointer-events-auto flex items-start gap-2.5 rounded-lg border px-3 py-2.5 shadow-xl shadow-u-bg/40 animate-ap-slide-up",
              cls,
            )}
          >
            <Icon className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-[12.5px] font-semibold">{t.title}</p>
              {t.description && (
                <p className="mt-0.5 text-[11.5px] leading-snug opacity-80">{t.description}</p>
              )}
              {t.simulated && (
                <p className="mt-1 text-[10.5px] tracking-wide uppercase opacity-70">
                  Simulated — no backend call
                </p>
              )}
            </div>
            <button
              type="button"
              aria-label="Dismiss notification"
              onClick={() => dispatch({ type: "DISMISS_TOAST", id: t.id })}
              className="opacity-60 transition-opacity hover:opacity-100"
            >
              <IconX width={13} height={13} />
            </button>
          </div>
        );
      })}
    </div>
    </div>,
    document.body,
  );
}
