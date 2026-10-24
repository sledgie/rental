import {
  useEffect,
  useId,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { createPortal } from "react-dom";
import { AlertCircle, ChevronDown, Loader2, X, type LucideIcon } from "lucide-react";
import { cn } from "../utils/cn";
import type { InvitationStatus, MembershipStatus, Role } from "../lib/types";
import { initials, orgGradient } from "../lib/format";

/* ------------------------------------------------------------------ Button */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "dark" | "success";
type ButtonSize = "xs" | "sm" | "md" | "lg";

const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    "bg-u-accent text-u-onaccent shadow-[0_1px_2px_rgba(12,42,34,0.08),inset_0_1px_0_rgba(255,255,255,0.16)] hover:bg-u-accent-strong active:bg-u-accent-strong disabled:bg-u-accent",
  secondary:
    "border border-u-line bg-u-card text-u-ink2 shadow-[0_1px_2px_rgba(12,42,34,0.04)] hover:border-u-line2 hover:bg-u-s2 active:bg-u-s3 disabled:text-u-muted",
  ghost: "text-u-ink2 hover:bg-u-s3 hover:text-u-ink disabled:text-u-s3",
  danger:
    "bg-u-danger text-u-onaccent shadow-[0_1px_2px_rgba(12,42,34,0.08)] hover:bg-u-danger active:bg-u-danger disabled:bg-u-danger",
  dark: "bg-u-ink2 text-u-onaccent hover:bg-u-ink2 active:bg-u-ink2 disabled:bg-u-line2",
  success: "bg-u-ok text-u-onaccent hover:bg-u-ok disabled:bg-u-ok",
};

const buttonSizes: Record<ButtonSize, string> = {
  xs: "h-7 gap-1.5 rounded-md px-2 text-[11.5px]",
  sm: "h-9 gap-1.5 rounded-lg px-3 text-[12.5px]",
  md: "h-10 gap-2 rounded-lg px-4 text-[13px]",
  lg: "h-11 gap-2 rounded-[10px] px-5 text-[13.5px]",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: LucideIcon;
  iconRight?: LucideIcon;
  fullWidth?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  loading,
  icon: Icon,
  iconRight: IconRight,
  fullWidth,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={cn(
        "focus-ring inline-flex select-none items-center justify-center font-medium transition-all duration-150 active:translate-y-px disabled:cursor-not-allowed disabled:active:translate-y-0",
        buttonVariants[variant],
        buttonSizes[size],
        fullWidth && "w-full",
        className
      )}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : Icon ? <Icon className="size-4" aria-hidden /> : null}
      {children}
      {IconRight && !loading ? <IconRight className="size-4" aria-hidden /> : null}
    </button>
  );
}

export function IconButton({
  label,
  icon: Icon,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; icon: LucideIcon }) {
  return (
    <button
      {...props}
      type={props.type ?? "button"}
      aria-label={label}
      title={label}
      className={cn(
        "focus-ring inline-flex size-9 items-center justify-center rounded-lg text-u-muted transition hover:bg-u-s3 hover:text-u-ink disabled:opacity-50",
        className
      )}
    >
      <Icon className="size-[18px]" />
    </button>
  );
}

/* ------------------------------------------------------------------ Fields */

const fieldBase =
  "w-full rounded-lg border bg-u-card text-[13.5px] text-u-ink shadow-[0_1px_2px_rgba(12,42,34,0.03)] transition placeholder:text-u-muted focus:outline-none focus:ring-[3.5px] disabled:cursor-not-allowed disabled:bg-u-s2 disabled:text-u-muted";

function fieldState(error?: string) {
  return error
    ? "border-u-danger/30 focus:border-u-danger/60 focus:ring-u-danger/12"
    : "border-u-line hover:border-u-line2 focus:border-u-accent/60 focus:ring-u-accent/12";
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  children,
  className,
  counter,
}: {
  label?: ReactNode;
  htmlFor?: string;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
  counter?: ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label ? (
        <div className="flex items-baseline justify-between gap-3">
          <label htmlFor={htmlFor} className="text-[12.5px] font-medium text-u-ink2">
            {label}
            {required ? <span className="ml-0.5 text-u-accent">*</span> : null}
          </label>
          {counter}
        </div>
      ) : null}
      {children}
      {error ? (
        <p className="flex items-start gap-1.5 text-[11.5px] font-medium text-u-danger" role="alert">
          <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      ) : hint ? (
        <p className="text-[11.5px] leading-relaxed text-u-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  leftIcon?: LucideIcon;
  rightSlot?: ReactNode;
  fieldClassName?: string;
  counter?: ReactNode;
}

export function TextInput({
  label,
  hint,
  error,
  leftIcon: LeftIcon,
  rightSlot,
  className,
  fieldClassName,
  id,
  required,
  counter,
  ...props
}: TextInputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  return (
    <Field label={label} htmlFor={inputId} hint={hint} error={error} required={required} className={fieldClassName} counter={counter}>
      <div className="relative">
        {LeftIcon ? (
          <LeftIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-u-muted" aria-hidden />
        ) : null}
        <input
          id={inputId}
          aria-invalid={Boolean(error)}
          {...props}
          className={cn(
            fieldBase,
            fieldState(error),
            "h-10.5 px-3.5",
            LeftIcon && "pl-9.5",
            rightSlot && "pr-11",
            className
          )}
        />
        {rightSlot ? <div className="absolute inset-y-0 right-0 flex items-center pr-1.5">{rightSlot}</div> : null}
      </div>
    </Field>
  );
}

export interface SelectInputProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: string;
  error?: string;
  options: { value: string; label: string; disabled?: boolean }[];
  placeholder?: string;
  fieldClassName?: string;
}

export function SelectInput({
  label,
  hint,
  error,
  options,
  placeholder,
  className,
  fieldClassName,
  id,
  required,
  ...props
}: SelectInputProps) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  return (
    <Field label={label} htmlFor={selectId} hint={hint} error={error} required={required} className={fieldClassName}>
      <div className="relative">
        <select
          id={selectId}
          aria-invalid={Boolean(error)}
          {...props}
          className={cn(
            fieldBase,
            fieldState(error),
            "h-10.5 appearance-none px-3.5 pr-9",
            !props.value && "text-u-muted",
            className
          )}
        >
          {placeholder ? <option value="">{placeholder}</option> : null}
          {options.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-u-muted" aria-hidden />
      </div>
    </Field>
  );
}

export function TextArea({
  label,
  error,
  hint,
  id,
  className,
  fieldClassName,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
  error?: string;
  hint?: string;
  fieldClassName?: string;
}) {
  const generatedId = useId();
  const textareaId = id ?? generatedId;
  return (
    <Field label={label} htmlFor={textareaId} error={error} hint={hint} className={fieldClassName}>
      <textarea
        id={textareaId}
        {...props}
        className={cn(fieldBase, fieldState(error), "min-h-24 resize-y p-3.5", className)}
      />
    </Field>
  );
}

export function CheckInput({
  label,
  description,
  error,
  id,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode; description?: ReactNode; error?: string }) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  return (
    <div className={className}>
      <div className="flex items-start gap-2.5">
        <input
          id={inputId}
          type="checkbox"
          {...props}
          className="mt-0.5 size-4 shrink-0 cursor-pointer rounded border-u-line2 text-u-accent focus:ring-u-accent/30"
        />
        <label htmlFor={inputId} className="cursor-pointer text-[12.5px] leading-snug text-u-ink2">
          {label}
          {description ? <span className="mt-1 block text-[11.5px] text-u-muted">{description}</span> : null}
        </label>
      </div>
      {error ? <p className="mt-1 pl-6.5 text-[11.5px] font-medium text-u-danger">{error}</p> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ Badges */

export function Badge({
  children,
  tone = "slate",
  dot,
  className,
}: {
  children: ReactNode;
  tone?: "slate" | "blue" | "indigo" | "emerald" | "amber" | "rose" | "violet" | "cyan";
  dot?: boolean;
  className?: string;
}) {
  const tones = {
    slate: "bg-u-s3 text-u-ink2 ring-u-line/70",
    blue: "bg-u-accent-soft text-u-accent ring-u-accent/70",
    indigo: "bg-u-accent-soft text-u-accent ring-u-accent/70",
    emerald: "bg-u-ok-soft text-u-ok ring-u-ok/70",
    amber: "bg-u-warn-soft text-u-warn ring-u-warn/70",
    rose: "bg-u-danger-soft text-u-danger ring-u-danger/70",
    violet: "bg-u-violet/15 text-u-violet ring-u-violet/70",
    cyan: "bg-u-blue-soft text-u-blue ring-u-blue/70",
  } as const;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10.5px] font-medium ring-1 ring-inset",
        tones[tone],
        className
      )}
    >
      {dot ? <span className="size-1.5 rounded-full bg-current opacity-70" /> : null}
      {children}
    </span>
  );
}

const roleTones: Record<Role, "indigo" | "blue" | "cyan" | "amber" | "violet" | "slate"> = {
  Owner: "indigo",
  Administrator: "blue",
  "Property Manager": "cyan",
  Accountant: "amber",
  "Maintenance Staff": "violet",
  "Read-Only / Auditor": "slate",
};

export function RoleBadge({ role, className }: { role: Role; className?: string }) {
  return (
    <Badge tone={roleTones[role]} className={className}>
      {role === "Owner" ? <span className="text-[9px]">◆</span> : null}
      {role}
    </Badge>
  );
}

export function InvitationStatusBadge({ status }: { status: InvitationStatus }) {
  const map: Record<InvitationStatus, { tone: Parameters<typeof Badge>[0]["tone"]; label: string }> = {
    pending: { tone: "amber", label: "Pending" },
    accepted: { tone: "emerald", label: "Accepted" },
    declined: { tone: "slate", label: "Declined" },
    expired: { tone: "rose", label: "Expired" },
    revoked: { tone: "slate", label: "Revoked" },
  };
  const entry = map[status];
  return (
    <Badge tone={entry.tone} dot>
      {entry.label}
    </Badge>
  );
}

export function MembershipStatusBadge({ status }: { status: MembershipStatus }) {
  return (
    <Badge tone={status === "active" ? "emerald" : "amber"} dot>
      {status === "active" ? "Active" : "Suspended"}
    </Badge>
  );
}

/* ------------------------------------------------------------------- Avatar */

export function Avatar({
  name,
  size = "md",
  className,
  tone,
}: {
  name: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
  tone?: string;
}) {
  const sizes = {
    xs: "size-6 text-[9px]",
    sm: "size-7.5 text-[10px]",
    md: "size-9 text-[11.5px]",
    lg: "size-11 text-[13px]",
    xl: "size-14 text-[16px]",
  } as const;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center rounded-full bg-gradient-to-br font-semibold text-u-onaccent ring-2 ring-white",
        tone ?? orgGradient(name),
        sizes[size],
        className
      )}
      title={name}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

/* -------------------------------------------------------------------- Modal */

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  danger,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
  danger?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;

  const widths = { sm: "max-w-md", md: "max-w-lg", lg: "max-w-2xl" };

  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-end justify-center p-0 sm:items-center sm:p-6">
      <div className="animate-fade-in absolute inset-0 bg-u-ink2/45 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "animate-scale-in relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl border border-u-line bg-u-card shadow-pop sm:rounded-2xl",
          widths[size]
        )}
      >
        <div className="flex items-start gap-4 border-b border-u-line px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-u-ink">{title}</h2>
            {description ? <p className="mt-1 text-[12.5px] leading-relaxed text-u-muted">{description}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="focus-ring -mr-1 rounded-md p-1.5 text-u-muted transition hover:bg-u-s3 hover:text-u-ink2"
          >
            <X className="size-4" />
          </button>
        </div>
        {children ? <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div> : null}
        {footer ? (
          <div className={cn("flex flex-wrap justify-end gap-2 border-t border-u-line px-5 py-3.5", danger && "bg-u-danger-soft/40")}>
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body
  );
}

/* -------------------------------------------------------------------- Misc */

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-xl border border-u-line/80 bg-u-card shadow-[0_1px_2px_rgba(12,42,34,0.04)]", className)}>
      {children}
    </div>
  );
}

export function Spinner({ className, label }: { className?: string; label?: string }) {
  return (
    <div className={cn("flex items-center gap-2 text-u-muted", className)} role="status">
      <Loader2 className="size-4 animate-spin" aria-hidden />
      {label ? <span className="text-xs font-medium">{label}</span> : null}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-u-s3", className)} />;
}

export function Alert({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: "info" | "warning" | "danger" | "success";
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  const styles = {
    info: "border-u-accent/80 bg-u-accent-soft/70 text-u-accent",
    warning: "border-u-warn/80 bg-u-warn-soft/70 text-u-warn",
    danger: "border-u-danger/80 bg-u-danger-soft/70 text-u-danger",
    success: "border-u-ok/80 bg-u-ok-soft/70 text-u-ok",
  } as const;
  const icons = { info: AlertCircle, warning: AlertCircle, danger: AlertCircle, success: AlertCircle };
  const Icon = icons[tone];
  return (
    <div className={cn("flex gap-2.5 rounded-lg border px-3.5 py-3", styles[tone], className)}>
      <Icon className="mt-0.5 size-4 shrink-0 opacity-70" aria-hidden />
      <div className="min-w-0 text-[12.5px] leading-relaxed">
        {title ? <p className="font-semibold">{title}</p> : null}
        <div className={title ? "mt-0.5 opacity-90" : ""}>{children}</div>
      </div>
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-12 text-center", className)}>
      <div className="mb-4 flex size-11 items-center justify-center rounded-xl border border-u-line bg-u-s2 shadow-[0_1px_2px_rgba(12,42,34,0.04)]">
        <Icon className="size-5 text-u-muted" aria-hidden />
      </div>
      <h3 className="text-[13.5px] font-semibold text-u-ink">{title}</h3>
      <p className="mt-1 max-w-sm text-[12.5px] leading-relaxed text-u-muted">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

