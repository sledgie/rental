import { createPortal } from "react-dom";
import {
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import { cn } from "../utils/cn";
import type { InvoiceStatus, PaymentMethod, PaymentStatus } from "../types";
import { METHOD_LABELS } from "../utils/paymentUtils";
import { lockScroll } from "../../shell/scrollLock";

// ---------------------------------------------------------------------------
// Icons (stroke-based, lucide-style)
// ---------------------------------------------------------------------------

const ICON_PATHS = {
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.35-4.35" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  x: <path d="M18 6 6 18M6 6l12 12" />,
  "chevron-down": <path d="m6 9 6 6 6-6" />,
  "chevron-left": <path d="m15 18-6-6 6-6" />,
  "chevron-right": <path d="m9 18 6-6-6-6" />,
  printer: (
    <>
      <path d="M6 9V3h12v6" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect x="6" y="14" width="12" height="8" rx="1" />
    </>
  ),
  eye: (
    <>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  undo: (
    <>
      <path d="M3 12a9 9 0 1 0 2.64-6.36L3 8" />
      <path d="M3 3v5h5" />
    </>
  ),
  check: <path d="M20 6 9 17l-5-5" />,
  alert: (
    <>
      <path d="M21.73 18l-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <path d="M12 9v4M12 17h.01" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" />
    </>
  ),
  building: (
    <>
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <path d="M9 22v-4h6v4" />
      <path d="M8 6h.01M16 6h.01M8 10h.01M16 10h.01M8 14h.01M16 14h.01M12 6h.01M12 10h.01M12 14h.01" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </>
  ),
  sort: (
    <>
      <path d="m3 16 4 4 4-4M7 20V4" />
      <path d="m21 8-4-4-4 4M17 4v16" />
    </>
  ),
  receipt: (
    <>
      <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" />
      <path d="M14 8H8M14 12H8M14 16H8" />
    </>
  ),
  filter: <path d="M22 3H2l8 9.46V19l4 2v-8.54Z" />,
  card: (
    <>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
    </>
  ),
  banknote: (
    <>
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M6 12h.01M18 12h.01" />
    </>
  ),
  mail: (
    <>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </>
  ),
  refresh: (
    <>
      <path d="M3 12a9 9 0 0 1 15.74-6L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-15.74 6L3 16" />
      <path d="M3 21v-5h5" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" />
    </>
  ),
  wallet: (
    <>
      <path d="M20 7H5a2 2 0 0 1-2-2 2 2 0 0 1 2-2h13v4" />
      <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1" />
      <path d="M16 13h.01" />
    </>
  ),
} as const;

export type IconName = keyof typeof ICON_PATHS;

export function Icon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("h-4 w-4 shrink-0", className)}
      aria-hidden="true"
    >
      {ICON_PATHS[name]}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------------

const BUTTON_VARIANTS = {
  primary:
    "bg-u-accent text-u-onaccent shadow-sm hover:bg-u-accent-strong active:bg-u-accent-strong focus-visible:ring-u-accent/60",
  secondary:
    "bg-u-card text-u-ink ring-1 ring-inset ring-u-line shadow-xs hover:bg-u-s2 hover:ring-u-line2 focus-visible:ring-u-accent/50",
  ghost: "text-u-ink2 hover:bg-u-bg/5 hover:text-u-ink focus-visible:ring-u-accent/50",
  danger:
    "bg-u-danger text-u-bg shadow-sm hover:bg-u-danger active:bg-u-danger focus-visible:ring-u-danger/60",
  dangerOutline:
    "bg-u-danger-soft/60 text-u-danger ring-1 ring-inset ring-u-danger/30 hover:bg-u-danger-soft focus-visible:ring-u-danger/50",
} as const;

const BUTTON_SIZES = {
  xs: "h-7 px-2.5 text-xs gap-1.5 rounded-md",
  sm: "h-8 px-3 text-xs gap-1.5 rounded-lg",
  md: "h-9.5 px-4 text-sm gap-2 rounded-lg",
  lg: "h-11 px-5 text-sm gap-2 rounded-lg",
} as const;

export function Button({
  variant = "secondary",
  size = "md",
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof BUTTON_VARIANTS;
  size?: keyof typeof BUTTON_SIZES;
}) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center justify-center font-medium transition-colors duration-150 select-none",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-u-bg",
        "disabled:pointer-events-none disabled:opacity-50",
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Badges
// ---------------------------------------------------------------------------

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: "pine" | "amber" | "red" | "neutral" | "sky";
  className?: string;
  children: ReactNode;
}) {
  const tones = {
    pine: "bg-u-accent-soft text-u-accent ring-u-accent/20",
    amber: "bg-u-warn-soft text-u-warn ring-u-warn/25",
    red: "bg-u-danger-soft text-u-danger ring-u-danger/20",
    neutral: "bg-u-s3 text-u-ink2 ring-u-line2/20",
    sky: "bg-u-blue-soft text-u-blue ring-u-blue/20",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset whitespace-nowrap",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  if (status === "reversed") {
    return (
      <Badge tone="red">
        <Icon name="undo" className="h-3 w-3" />
        Reversed
      </Badge>
    );
  }
  return (
    <Badge tone="pine">
      <span className="h-1.5 w-1.5 rounded-full bg-u-accent" />
      Posted
    </Badge>
  );
}

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  if (status === "paid")
    return (
      <Badge tone="pine">
        <Icon name="check" className="h-3 w-3" />
        Paid
      </Badge>
    );
  if (status === "partial") return <Badge tone="amber">Partially paid</Badge>;
  if (status === "overdue") return <Badge tone="red">Overdue</Badge>;
  if (status === "cancelled")
    return (
      <Badge tone="neutral" className="line-through decoration-u-line2">
        Cancelled
      </Badge>
    );
  return <Badge tone="neutral">Open</Badge>;
}

const METHOD_ICONS: Record<PaymentMethod, IconName> = {
  etransfer: "mail",
  cash: "banknote",
  card: "card",
};

export function MethodTag({ method, compact }: { method: PaymentMethod; compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-u-ink2">
      <Icon name={METHOD_ICONS[method]} className="h-3.5 w-3.5 text-u-muted" />
      <span className="whitespace-nowrap">
        {compact && method === "card" ? "Card (external)" : METHOD_LABELS[method]}
      </span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Form primitives
// ---------------------------------------------------------------------------

export const inputCls =
  "h-9.5 w-full rounded-lg border border-u-line bg-u-card px-3 text-sm text-u-ink placeholder:text-u-muted shadow-xs transition-colors hover:border-u-line2 focus:border-u-accent focus:outline-none focus:ring-2 focus:ring-u-accent/25 aria-[invalid=true]:border-u-danger aria-[invalid=true]:focus:ring-u-danger/25";

export const textareaCls =
  "w-full rounded-lg border border-u-line bg-u-card px-3 py-2 text-sm text-u-ink placeholder:text-u-muted shadow-xs transition-colors hover:border-u-line2 focus:border-u-accent focus:outline-none focus:ring-2 focus:ring-u-accent/25";

export function Field({
  label,
  htmlFor,
  required,
  error,
  hint,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="block text-[13px] font-medium text-u-ink2">
        {label}
        {required && (
          <span className="text-u-danger" aria-hidden="true">
            {" "}
            *
          </span>
        )}
      </label>
      {children}
      {error ? (
        <p className="flex items-center gap-1 text-xs font-medium text-u-danger" role="alert">
          <Icon name="alert" className="h-3.5 w-3.5" />
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-u-muted">{hint}</p>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------

const MODAL_SIZES = {
  sm: "max-w-md",
  md: "max-w-xl",
  lg: "max-w-3xl",
  xl: "max-w-5xl",
} as const;

export function Modal({
  onClose,
  size = "md",
  labelledBy,
  children,
}: {
  onClose: () => void;
  size?: keyof typeof MODAL_SIZES;
  labelledBy?: string;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const unlockScroll = lockScroll();
    return () => {
      window.removeEventListener("keydown", onKey);
      unlockScroll();
    };
  }, [onClose]);

  return createPortal(
    <div className="u-root">
    <div
      className="fixed inset-0 z-[140] overflow-y-auto bg-u-bg/70 p-4 sm:p-6 animate-p-fade"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        data-modal
        aria-labelledby={labelledBy}
        className={cn(
          "mx-auto my-[3vh] w-full rounded-xl bg-u-card shadow-2xl ring-1 ring-u-line2/10 animate-p-rise",
          MODAL_SIZES[size],
        )}
      >
        {children}
      </div>
    </div>
    </div>,
    document.body,
  );
}

/** Right-hand side drawer in the app's standard profile-drawer chrome (same as Properties / Tenants): header, profile heading, scrolling
 *  body and footer. Body and footer are module (Tailwind) content, so they sit inside a .u-root. */
export function Drawer({
  onClose,
  labelledBy,
  title,
  subtitle,
  heading,
  footer,
  children,
}: {
  onClose: () => void;
  labelledBy?: string;
  title: string;
  subtitle?: ReactNode;
  heading?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector("[data-modal]")) onClose();
    };
    window.addEventListener("keydown", onKey, true);
    const unlockScroll = lockScroll();
    return () => {
      window.removeEventListener("keydown", onKey, true);
      unlockScroll();
    };
  }, [onClose]);

  return createPortal(
    <div className="tn">
      <div
        className="overlay-backdrop drawer-backdrop"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div role="dialog" aria-modal="true" aria-labelledby={labelledBy} className="overlay-panel drawer-panel profile-drawer u-drawer-wide">
          <div className="overlay-header">
            <div>
              <h2 id={labelledBy}>{title}</h2>
              {subtitle && <p>{subtitle}</p>}
            </div>
            <button type="button" className="icon-button" aria-label="Close" title="Close" onClick={onClose}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </div>
          {heading}
          <div className="u-drawer-scroll"><div className="u-root">{children}</div></div>
          {footer && <div className="u-drawer-foot"><div className="u-root">{footer}</div></div>}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function ModalHeader({
  id,
  title,
  subtitle,
  onClose,
  children,
}: {
  id?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  onClose: () => void;
  children?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-u-line px-6 py-4">
      <div className="min-w-0">
        <h2 id={id} className="font-display text-lg font-semibold tracking-tight text-u-ink">
          {title}
        </h2>
        {subtitle && <div className="mt-0.5 text-[13px] text-u-muted">{subtitle}</div>}
        {children}
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close dialog"
        className="rounded-lg p-1.5 text-u-muted transition-colors hover:bg-u-s3 hover:text-u-ink2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-u-accent/50"
      >
        <Icon name="x" className="h-5 w-5" />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty state / skeleton
// ---------------------------------------------------------------------------

export function EmptyState({
  icon = "search",
  title,
  message,
  action,
}: {
  icon?: IconName;
  title: string;
  message?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-u-s3 text-u-muted">
        <Icon name={icon} className="h-5 w-5" />
      </div>
      <p className="font-display text-sm font-semibold text-u-ink">{title}</p>
      {message && <p className="max-w-sm text-[13px] text-u-muted">{message}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("p-skeleton", className)} aria-hidden="true" />;
}

// ---------------------------------------------------------------------------
// Toasts
// ---------------------------------------------------------------------------

export interface ToastItem {
  id: number;
  tone: "success" | "info" | "danger";
  title: string;
  message?: string;
}

// ---------------------------------------------------------------------------
// Animated number (respects prefers-reduced-motion)
// ---------------------------------------------------------------------------

export function useCountUp(target: number, duration = 550): number {
  const [value, setValue] = useState(target);
  const fromRef = useRef(target);
  const frameRef = useRef(0);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const from = fromRef.current;
    if (reduce || from === target) {
      fromRef.current = target;
      setValue(target);
      return;
    }
    const start = performance.now();
    const tick = (t: number) => {
      const progress = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(from + (target - from) * eased);
      setValue(current);
      if (progress < 1) frameRef.current = requestAnimationFrame(tick);
      else fromRef.current = target;
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [target, duration]);

  return value;
}

export function ToastStack({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: number) => void;
}) {
  return createPortal(
    <div className="u-root">
    <div
      aria-live="polite"
      className="no-print pointer-events-none fixed right-4 bottom-4 z-[160] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2"
    >
      {toasts.map((t) => {
        const tone =
          t.tone === "success"
            ? { bar: "bg-u-accent", icon: "check" as IconName, iconCls: "bg-u-accent-soft text-u-accent" }
            : t.tone === "danger"
              ? { bar: "bg-u-danger", icon: "undo" as IconName, iconCls: "bg-u-danger-soft text-u-danger" }
              : { bar: "bg-u-blue", icon: "info" as IconName, iconCls: "bg-u-blue-soft text-u-blue" };
        return (
          <div
            key={t.id}
            role="status"
            className="pointer-events-auto relative flex items-start gap-3 overflow-hidden rounded-lg bg-u-card py-3 pr-3 pl-4 shadow-lg ring-1 ring-u-line2/10 animate-p-toast-in"
          >
            <span className={cn("absolute inset-y-0 left-0 w-1", tone.bar)} />
            <span className={cn("mt-0.5 flex h-6 w-6 items-center justify-center rounded-full", tone.iconCls)}>
              <Icon name={tone.icon} className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-u-ink">{t.title}</p>
              {t.message && <p className="mt-0.5 text-xs text-u-muted">{t.message}</p>}
            </div>
            <button
              type="button"
              onClick={() => onDismiss(t.id)}
              aria-label="Dismiss notification"
              className="rounded-md p-1 text-u-muted hover:bg-u-s3 hover:text-u-ink2"
            >
              <Icon name="x" className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
    </div>,
    document.body,
  );
}
