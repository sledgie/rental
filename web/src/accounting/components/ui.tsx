import {
  useEffect,
  useRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { cn } from "../utils/cn";
import { AlertTriangle, Check, Info, X } from "./Icons";

/* ------------------------------------------------------------------- buttons */

type Variant = "primary" | "secondary" | "ghost" | "danger" | "quiet";
type Size = "xs" | "sm" | "md";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-u-accent text-u-onaccent border border-u-accent hover:bg-u-accent-strong hover:border-u-accent-strong active:translate-y-px shadow-[0_1px_0_rgba(255,255,255,.18)_inset,0_1px_2px_rgba(15,90,82,.28)]",
  secondary:
    "bg-u-card text-u-ink2 border border-u-line hover:border-u-line2 hover:text-u-ink hover:bg-u-s2 active:translate-y-px",
  ghost: "bg-transparent text-u-ink2 border border-transparent hover:bg-u-s3 hover:text-u-ink",
  danger:
    "bg-u-danger text-u-onaccent border border-u-danger/30 hover:bg-u-danger active:translate-y-px",
  quiet: "bg-u-s3 text-u-ink2 border border-transparent hover:bg-u-s3 hover:text-u-ink",
};

const SIZES: Record<Size, string> = {
  xs: "h-7 px-2 text-[11.5px] gap-1.5 rounded-[5px]",
  sm: "h-8 px-2.5 text-[12.5px] gap-1.5 rounded-[6px]",
  md: "h-9.5 px-3.5 text-[13.5px] gap-2 rounded-[7px]",
};

export function Button({
  variant = "secondary",
  size = "sm",
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex select-none items-center justify-center font-medium tracking-[-0.005em] transition-all duration-150 disabled:pointer-events-none disabled:opacity-45",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function IconButton({
  label,
  className,
  children,
  active,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; active?: boolean }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className={cn(
        "inline-flex h-7 w-7 items-center justify-center rounded-[6px] border border-transparent text-u-muted transition-all duration-150 hover:border-u-line hover:bg-u-card hover:text-u-ink active:translate-y-px disabled:pointer-events-none disabled:opacity-40",
        active && "border-u-line bg-u-card text-u-accent",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/* -------------------------------------------------------------------- badges */

export function Badge({
  className,
  children,
  dot,
}: {
  className?: string;
  children: ReactNode;
  dot?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[4px] border px-1.5 py-[1px] text-[10.5px] font-semibold uppercase tracking-[0.055em] whitespace-nowrap",
        className,
      )}
    >
      {dot && <span className={cn("h-1.5 w-1.5 rounded-full", dot)} />}
      {children}
    </span>
  );
}

export function StatusPill({ status }: { status: "Active" | "Inactive" }) {
  return status === "Active" ? (
    <Badge className="border-u-ok/30 bg-u-ok-soft text-u-ok" dot="bg-u-ok">
      Active
    </Badge>
  ) : (
    <Badge className="border-u-line bg-u-s3 text-u-muted" dot="bg-u-s3">
      Inactive
    </Badge>
  );
}

/* -------------------------------------------------------------------- inputs */

export function Field({
  label,
  hint,
  error,
  warning,
  required,
  htmlFor,
  children,
  className,
  aside,
}: {
  label: string;
  hint?: string;
  error?: string;
  warning?: string;
  required?: boolean;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
  aside?: ReactNode;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <label
          htmlFor={htmlFor}
          className="text-[11px] font-semibold uppercase tracking-[0.08em] text-u-muted"
        >
          {label}
          {required && <span className="ml-1 text-u-danger">*</span>}
        </label>
        {aside}
      </div>
      {children}
      {hint && !error && <p className="mt-1.5 text-[11.5px] leading-snug text-u-muted">{hint}</p>}
      {warning && !error && (
        <p className="mt-1.5 flex gap-1.5 text-[11.5px] leading-snug text-u-warn">
          <AlertTriangle className="mt-[1px] h-3.5 w-3.5 shrink-0" />
          <span>{warning}</span>
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="mt-1.5 flex gap-1.5 text-[11.5px] font-medium leading-snug text-u-danger animate-coa-fade-in"
        >
          <AlertTriangle className="mt-[1px] h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}

const controlBase =
  "w-full rounded-[6px] border bg-u-card px-2.5 text-[13px] text-u-ink transition-all duration-150 placeholder:text-u-muted hover:border-u-line2 focus:border-u-accent focus:ring-2 focus:ring-u-accent/15 focus:outline-none disabled:cursor-not-allowed disabled:bg-u-s3 disabled:text-u-muted";

export function TextInput({
  className,
  invalid,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return (
    <input
      className={cn(controlBase, "h-9", invalid ? "border-u-danger/70 bg-u-s2" : "border-u-line", className)}
      {...rest}
    />
  );
}

export function TextArea({
  className,
  invalid,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return (
    <textarea
      className={cn(
        controlBase,
        "min-h-[76px] resize-y py-2 leading-relaxed",
        invalid ? "border-u-danger/70 bg-u-s2" : "border-u-line",
        className,
      )}
      {...rest}
    />
  );
}

export function Select({
  className,
  invalid,
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  return (
    <div className="relative">
      <select
        className={cn(
          controlBase,
          "h-9 appearance-none pr-7",
          invalid ? "border-u-danger/70 bg-u-s2" : "border-u-line",
          className,
        )}
        {...rest}
      >
        {children}
      </select>
      <svg
        viewBox="0 0 24 24"
        className="pointer-events-none absolute top-1/2 right-2 h-3.5 w-3.5 -translate-y-1/2 text-u-muted"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  id,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  id?: string;
  disabled?: boolean;
}) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "inline-flex items-center gap-2 select-none",
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
      )}
    >
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={cn(
          "relative h-[18px] w-8 shrink-0 rounded-full border transition-colors duration-200 disabled:cursor-not-allowed",
          checked ? "border-u-accent bg-u-accent" : "border-u-line bg-u-s3",
        )}
      >
        <span
          className={cn(
            "absolute top-[2px] h-3 w-3 rounded-full bg-white shadow-sm transition-all duration-200",
            checked ? "left-[15px]" : "left-[2px]",
          )}
        />
      </button>
      <span className="text-[12.5px] text-u-ink2">{label}</span>
    </label>
  );
}

export function Checkbox({
  checked,
  onChange,
  label,
  id,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: ReactNode;
  id?: string;
}) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start gap-2.5 select-none">
      <span
        className={cn(
          "mt-[1px] flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border transition-all duration-150",
          checked ? "border-u-accent bg-u-accent text-u-onaccent" : "border-u-line2 bg-u-card hover:border-u-accent",
        )}
      >
        {checked && <Check className="h-3 w-3" strokeWidth={3} />}
      </span>
      <input
        id={id}
        type="checkbox"
        className="sr-only"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="text-[12.5px] leading-snug text-u-ink2">{label}</span>
    </label>
  );
}

/* -------------------------------------------------------------- overlays */

function useOverlay(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
}

export function Backdrop({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-40 bg-[#14171a]/35 backdrop-blur-[2px] animate-coa-fade-in"
      onClick={onClose}
      aria-hidden="true"
    />
  );
}

export function Dialog({
  open,
  onClose,
  title,
  eyebrow,
  icon,
  tone = "neutral",
  children,
  footer,
  width = "max-w-[560px]",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  eyebrow?: string;
  icon?: ReactNode;
  tone?: "neutral" | "danger" | "warning";
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
}) {
  useOverlay(open, onClose);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (open) {
      const t = window.setTimeout(() => {
        const focusable = ref.current?.querySelector<HTMLElement>(
          "button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex='-1'])",
        );
        focusable?.focus();
      }, 40);
      return () => window.clearTimeout(t);
    }
  }, [open]);
  if (!open) return null;
  return (
    <>
      <Backdrop onClose={onClose} />
      <div className="fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center sm:p-6">
        <div
          ref={ref}
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className={cn(
            "w-full overflow-hidden rounded-[10px] border border-u-line bg-u-card shadow-[0_24px_60px_-18px_rgba(20,24,26,.45)] animate-coa-panel-in",
            width,
          )}
        >
          <header
            className={cn(
              "flex items-start gap-3 border-b border-u-line px-4 py-3.5",
              tone === "danger" && "bg-u-s2",
              tone === "warning" && "bg-u-warn/8",
            )}
          >
            {icon && (
              <span
                className={cn(
                  "mt-[1px] flex h-7 w-7 shrink-0 items-center justify-center rounded-[6px] border",
                  tone === "danger" && "border-u-danger/30 bg-u-danger/8 text-u-danger",
                  tone === "warning" && "border-u-warn/30 bg-u-warn/8 text-u-warn",
                  tone === "neutral" && "border-u-line bg-u-s3 text-u-ink2",
                )}
              >
                {icon}
              </span>
            )}
            <div className="min-w-0 flex-1">
              {eyebrow && (
                <p className="mb-0.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-u-muted">
                  {eyebrow}
                </p>
              )}
              <h2 className="text-[15.5px] leading-tight font-semibold text-u-ink">{title}</h2>
            </div>
            <IconButton label="Close dialog" onClick={onClose}>
              <X className="h-4 w-4" />
            </IconButton>
          </header>
          <div className="max-h-[65vh] overflow-y-auto px-4 py-4 coa-scroll">{children}</div>
          {footer && (
            <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-u-line bg-u-s2 px-4 py-3">
              {footer}
            </footer>
          )}
        </div>
      </div>
    </>
  );
}

export function Drawer({
  open,
  onClose,
  title,
  eyebrow,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  eyebrow?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useOverlay(open, onClose);
  if (!open) return null;
  return (
    <>
      <Backdrop onClose={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[600px] flex-col border-l border-u-line bg-u-card shadow-[-24px_0_60px_-24px_rgba(20,24,26,.5)] animate-coa-sheet-in">
        <header className="flex items-start gap-3 border-b border-u-line px-4 py-3.5 sm:px-5">
          <div className="min-w-0 flex-1">
            {eyebrow && (
              <p className="mb-0.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-u-muted">
                {eyebrow}
              </p>
            )}
            <h2 className="text-[16px] leading-tight font-semibold text-u-ink">{title}</h2>
          </div>
          <IconButton label="Close panel" onClick={onClose}>
            <X className="h-4.5 w-4.5" />
          </IconButton>
        </header>
        <div className="flex-1 overflow-y-auto px-4 py-4 coa-scroll sm:px-5">{children}</div>
        {footer && (
          <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-u-line bg-u-s2 px-4 py-3 sm:px-5">
            {footer}
          </footer>
        )}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ display */

export function Note({
  tone = "info",
  title,
  children,
  icon,
}: {
  tone?: "info" | "warning" | "danger" | "success";
  title?: string;
  children: ReactNode;
  icon?: ReactNode;
}) {
  const tones = {
    info: "border-u-blue/30 bg-u-s3 text-u-blue",
    warning: "border-u-warn/30 bg-u-warn/8 text-u-warn",
    danger: "border-u-danger/30 bg-u-s2 text-u-danger",
    success: "border-u-ok/30 bg-u-s3 text-u-ok",
  } as const;
  return (
    <div className={cn("flex gap-2.5 rounded-[7px] border px-3 py-2.5", tones[tone])}>
      <span className="mt-[1px] shrink-0">{icon ?? <Info className="h-4 w-4" />}</span>
      <div className="min-w-0 text-[12.5px] leading-relaxed">
        {title && <p className="mb-0.5 font-semibold">{title}</p>}
        <div className="opacity-90">{children}</div>
      </div>
    </div>
  );
}

/** Case-insensitive search-term highlighting. */
export function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  if (!q) return <>{text}</>;
  const lower = text.toLowerCase();
  const needle = q.toLowerCase();
  const parts: ReactNode[] = [];
  let i = 0;
  let found = lower.indexOf(needle, i);
  if (found === -1) return <>{text}</>;
  while (found !== -1) {
    if (found > i) parts.push(text.slice(i, found));
    parts.push(
      <mark key={`${found}-${parts.length}`} className="hit">
        {text.slice(found, found + needle.length)}
      </mark>,
    );
    i = found + needle.length;
    found = lower.indexOf(needle, i);
  }
  if (i < text.length) parts.push(text.slice(i));
  return <>{parts}</>;
}
