import { createPortal } from "react-dom";
import { useEffect, useId, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Info,
  Loader2,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "../utils/cn";
import { lockScroll } from "../../shell/scrollLock";

/* ------------------------------- Buttons ------------------------------- */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "outline" | "subtle";
type ButtonSize = "xs" | "sm" | "md" | "lg" | "icon";

const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    "bg-u-accent text-u-onaccent font-semibold hover:bg-u-accent active:bg-u-accent shadow-[0_10px_30px_-14px_color-mix(in_srgb,var(--accent)_85%,transparent)] border border-u-accent/40",
  secondary:
    "bg-u-ink/[0.045] text-u-ink border border-u-ink/10 hover:bg-u-ink/[0.085] hover:border-u-ink/20",
  ghost: "text-u-ink2 hover:text-u-ink hover:bg-u-ink/[0.055] border border-transparent",
  danger: "bg-u-danger/12 text-u-danger border border-u-danger/25 hover:bg-u-danger/20",
  outline: "border border-u-ink/15 text-u-ink hover:bg-u-ink/[0.05] hover:text-u-ink",
  subtle: "bg-u-s3/70 text-u-ink border border-u-ink/[0.06] hover:bg-u-line2/70",
};

const buttonSizes: Record<ButtonSize, string> = {
  xs: "h-7 px-2.5 text-[11px] gap-1.5 rounded-lg",
  sm: "h-8 px-3 text-xs gap-1.5 rounded-lg",
  md: "h-10 px-4 text-[13px] gap-2 rounded-xl",
  lg: "h-11 px-5 text-sm gap-2 rounded-xl",
  icon: "h-9 w-9 rounded-lg",
};

export function Button({
  variant = "secondary",
  size = "md",
  icon: Icon,
  iconRight: IconRight,
  loading,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon;
  iconRight?: LucideIcon;
  loading?: boolean;
}) {
  return (
    <button
      {...props}
      disabled={props.disabled || loading}
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap font-medium transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-u-accent/50 disabled:cursor-not-allowed disabled:opacity-45",
        buttonVariants[variant],
        buttonSizes[size],
        className,
      )}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : Icon ? <Icon className={size === "xs" ? "h-3.5 w-3.5" : "h-4 w-4"} strokeWidth={1.9} /> : null}
      {children}
      {IconRight ? <IconRight className="h-3.5 w-3.5" strokeWidth={2} /> : null}
    </button>
  );
}

export function IconButton({
  icon: Icon,
  label,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { icon: LucideIcon; label: string }) {
  return (
    <button
      {...props}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-u-ink/[0.07] bg-u-ink/[0.03] text-u-muted transition hover:border-u-ink/15 hover:bg-u-ink/[0.08] hover:text-u-ink",
        className,
      )}
    >
      <Icon className="h-4 w-4" strokeWidth={1.9} />
    </button>
  );
}

/* -------------------------------- Badges -------------------------------- */

export type Tone = "slate" | "sky" | "violet" | "acid" | "amber" | "aqua" | "rose" | "orange";

const tones: Record<Tone, string> = {
  slate: "bg-u-ink/[0.06] text-u-ink2 border-u-ink/10",
  sky: "bg-u-blue/10 text-u-blue border-u-blue/25",
  violet: "bg-u-violet/10 text-u-violet border-u-violet/25",
  acid: "bg-u-accent/12 text-u-accent border-u-accent/30",
  amber: "bg-u-warn/10 text-u-warn border-u-warn/25",
  aqua: "bg-u-ok/10 text-u-ok border-u-ok/25",
  rose: "bg-u-danger/10 text-u-danger border-u-danger/25",
  orange: "bg-u-warn/10 text-u-warn border-u-warn/25",
};

const toneDots: Record<Tone, string> = {
  slate: "bg-u-s3",
  sky: "bg-u-blue",
  violet: "bg-u-violet",
  acid: "bg-u-accent",
  amber: "bg-u-warn",
  aqua: "bg-u-ok",
  rose: "bg-u-danger",
  orange: "bg-u-warn",
};

export function Badge({
  tone = "slate",
  dot,
  icon: Icon,
  children,
  className,
}: {
  tone?: Tone;
  dot?: boolean;
  icon?: LucideIcon;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border px-1.5 py-0.5 text-[10.5px] font-semibold leading-4 tracking-wide", tones[tone], className)}>
      {dot && <span className={cn("h-1.5 w-1.5 rounded-full", toneDots[tone], tone === "acid" && "shadow-[0_0_6px_color-mix(in_srgb,var(--accent)_90%,transparent)]")} />}
      {Icon && <Icon className="h-3 w-3" strokeWidth={2.1} />}
      {children}
    </span>
  );
}

const statusTone: Record<string, Tone> = {
  Draft: "slate",
  Planned: "sky",
  Approved: "violet",
  "In Progress": "acid",
  "On Hold": "amber",
  Completed: "aqua",
  Cancelled: "rose",
  "Not Started": "slate",
  Blocked: "rose",
  "Pending Approval": "amber",
  Rejected: "rose",
  "Partially Paid": "sky",
  Unpaid: "slate",
  Paid: "aqua",
  Overdue: "rose",
  Pass: "aqua",
  Fail: "rose",
  Conditional: "amber",
  Scheduled: "sky",
  Pending: "amber",
  Resolved: "sky",
  Verified: "aqua",
  Open: "rose",
  Inactive: "slate",
  Active: "acid",
  Assigned: "sky",
  Complete: "aqua",
  Released: "slate",
  Low: "slate",
  Normal: "sky",
  High: "amber",
  Emergency: "rose",
  Medium: "amber",
  Critical: "rose",
  Accepted: "aqua",
  Declined: "rose",
  Expired: "slate",
  Ordered: "violet",
  Received: "aqua",
};

export function StatusBadge({ status, dot = true, className }: { status: string; dot?: boolean; className?: string }) {
  return (
    <Badge tone={statusTone[status] ?? "slate"} dot={dot} className={className}>
      {status}
    </Badge>
  );
}

export function PermissionNote({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-u-muted">
      <Info className="h-3 w-3" /> {children}
    </span>
  );
}

/* -------------------------------- Surfaces ------------------------------- */

export function Card({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...props} className={cn("pj-panel rounded-2xl", className)}>
      {children}
    </div>
  );
}

export function SectionHeader({
  title,
  subtitle,
  icon: Icon,
  action,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: LucideIcon;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-3", className)}>
      <div className="flex min-w-0 items-start gap-2.5">
        {Icon && (
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-u-ink/[0.07] bg-u-ink/[0.035] text-u-accent">
            <Icon className="h-3.5 w-3.5" strokeWidth={1.9} />
          </span>
        )}
        <div className="min-w-0">
          <h3 className="text-[13.5px] font-semibold tracking-tight text-u-ink">{title}</h3>
          {subtitle && <p className="mt-0.5 text-[11.5px] leading-relaxed text-u-muted">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  );
}

/* ------------------------------ Progress ------------------------------- */

export function ProgressBar({
  value,
  tone = "acid",
  className,
  height = "h-1.5",
  label,
}: {
  value: number;
  tone?: "acid" | "aqua" | "amber" | "rose" | "sky" | "violet";
  className?: string;
  height?: string;
  label?: string;
}) {
  const safe = Math.max(0, Math.min(100, value));
  const gradients = {
    acid: "from-u-accent to-u-accent",
    aqua: "from-u-ok to-u-ok",
    amber: "from-u-warn to-u-warn",
    rose: "from-u-danger to-u-danger",
    sky: "from-u-blue to-u-blue",
    violet: "from-u-violet to-u-violet",
  };
  return (
    <div className={cn("relative overflow-hidden rounded-full bg-u-ink/[0.07]", height, className)}>
      <div
        className={cn("h-full rounded-full bg-gradient-to-r transition-all duration-700", gradients[tone])}
        style={{ width: `${safe}%` }}
        role="progressbar"
        aria-valuenow={safe}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? "Progress"}
      />
    </div>
  );
}

export function ProgressRing({
  value,
  size = 72,
  stroke = 6,
  tone = "acid",
  children,
  className,
}: {
  value: number;
  size?: number;
  stroke?: number;
  tone?: "acid" | "aqua" | "amber" | "rose" | "sky";
  children?: ReactNode;
  className?: string;
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const safe = Math.max(0, Math.min(100, value));
  const colors = { acid: "var(--accent)", aqua: "var(--ok)", amber: "var(--warn)", rose: "var(--danger)", sky: "var(--blue)" };
  return (
    <div className={cn("relative inline-flex shrink-0 items-center justify-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="color-mix(in srgb, var(--ink) 7%, transparent)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={colors[tone]}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - (safe / 100) * circumference}
          style={{ transition: "stroke-dashoffset .8s cubic-bezier(.16,1,.3,1)", filter: `drop-shadow(0 0 6px ${colors[tone]}55)` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}

export function Sparkline({
  values,
  tone = "acid",
  height = 32,
  width = 92,
}: {
  values: number[];
  tone?: "acid" | "aqua" | "amber" | "rose";
  height?: number;
  width?: number;
}) {
  const colors = { acid: "var(--accent)", aqua: "var(--ok)", amber: "var(--warn)", rose: "var(--danger)" };
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const points = values.map((v, i) => {
    const x = (i / Math.max(values.length - 1, 1)) * width;
    const y = height - ((v - min) / Math.max(max - min, 1)) * (height - 4) - 2;
    return `${x},${y}`;
  });
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      <polyline points={`0,${height} ${points.join(" ")} ${width},${height}`} fill={`${colors[tone]}14`} stroke="none" />
      <polyline points={points.join(" ")} fill="none" stroke={colors[tone]} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={width} cy={points[points.length - 1]?.split(",")[1]} r={2.4} fill={colors[tone]} />
    </svg>
  );
}

/* -------------------------------- Avatars -------------------------------- */

const avatarHues = [76, 168, 202, 262, 22, 320, 44, 148];

export function Avatar({ name, size = "md", className }: { name: string; size?: "xs" | "sm" | "md" | "lg"; className?: string }) {
  const initials = name
    .split(/[\s.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  const hue = avatarHues[name.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0) % avatarHues.length];
  const sizes = { xs: "h-5 w-5 text-[8px]", sm: "h-7 w-7 text-[10px]", md: "h-9 w-9 text-[11px]", lg: "h-12 w-12 text-sm" };
  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full border font-semibold tracking-wide", sizes[size], className)}
      style={{ background: `hsl(${hue} 45% 16%)`, borderColor: `hsl(${hue} 55% 32%)`, color: `hsl(${hue} 80% 76%)` }}
      title={name}
    >
      {initials || "?"}
    </span>
  );
}

/* -------------------------------- Modal -------------------------------- */

export function Modal({
  open,
  onClose,
  title,
  description,
  icon: Icon,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  icon?: LucideIcon;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const unlockScroll = lockScroll();
    return () => {
      document.removeEventListener("keydown", onKey);
      unlockScroll();
    };
  }, [open, onClose]);

  if (!open) return null;
  const widths = { sm: "max-w-md", md: "max-w-2xl", lg: "max-w-4xl", xl: "max-w-5xl" };
  return createPortal(
    <div className="u-root">
    <div className="fixed inset-0 z-[140] flex items-end justify-center sm:items-center" data-modal>
      <div className="absolute inset-0 bg-u-bg/80 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "animate-ap-slide-up relative z-10 flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl border border-u-ink/10 bg-u-card shadow-[0_40px_120px_-20px_rgba(0,0,0,0.9)] sm:rounded-2xl",
          widths[size],
        )}
      >
        <div className="pj-blueprint flex items-start justify-between gap-4 border-b border-u-ink/[0.07] bg-gradient-to-b from-u-ink/[0.045] to-transparent px-5 py-4">
          <div className="flex items-start gap-3">
            {Icon && (
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-u-accent/25 bg-u-accent/10 text-u-accent">
                <Icon className="h-4 w-4" strokeWidth={1.9} />
              </span>
            )}
            <div>
              <h2 className="text-[15px] font-semibold tracking-tight text-u-ink">{title}</h2>
              {description && <p className="mt-0.5 max-w-lg text-xs leading-relaxed text-u-muted">{description}</p>}
            </div>
          </div>
          <IconButton icon={X} label="Close dialog" onClick={onClose} />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-u-ink/[0.07] bg-u-bg/60 px-5 py-3.5">{footer}</div>}
      </div>
    </div>
    </div>,
    document.body,
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  tone = "primary",
  children,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  tone?: "primary" | "danger";
  children?: ReactNode;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} description={description} icon={AlertTriangle} size="sm"
      footer={
        <>
          <Button variant="ghost" size="md" onClick={onClose}>Cancel</Button>
          <Button variant={tone === "danger" ? "danger" : "primary"} size="md" icon={CheckCircle2} onClick={onConfirm}>{confirmLabel}</Button>
        </>
      }
    >
      {children ?? (
        <p className="rounded-xl border border-u-ink/[0.07] bg-u-ink/[0.025] p-3 text-xs leading-relaxed text-u-muted">
          This action is recorded in the project audit trail with your name, the timestamp and the reason provided. Financial history is preserved.
        </p>
      )}
    </Modal>
  );
}

/* -------------------------------- Forms -------------------------------- */

export const inputClass =
  "h-9 w-full rounded-lg border border-u-ink/[0.09] bg-u-bg/80 px-3 text-[12.5px] text-u-ink shadow-inner shadow-u-bg/20 outline-none transition placeholder:text-u-muted hover:border-u-ink/20 focus:border-u-accent/60 focus:ring-2 focus:ring-u-accent/15 disabled:opacity-50";

export function Field({
  label,
  hint,
  error,
  required,
  children,
  className,
  htmlFor,
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
  htmlFor?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="flex items-center gap-1 text-[10.5px] font-semibold uppercase tracking-[0.09em] text-u-muted">
        {label} {required && <span className="text-u-accent">*</span>}
      </label>
      {children}
      {error ? (
        <p className="flex items-center gap-1 text-[10.5px] text-u-danger"><AlertTriangle className="h-3 w-3" /> {error}</p>
      ) : hint ? (
        <p className="text-[10.5px] leading-relaxed text-u-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(inputClass, className)} />;
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={cn(inputClass, "pj-select-chevron appearance-none pr-8", className)}>
      {children}
    </select>
  );
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(inputClass, "h-auto min-h-[76px] resize-y py-2 leading-relaxed", className)} />;
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (checked: boolean) => void; label: string }) {
  const id = useId();
  return (
    <div className="flex items-center gap-2.5">
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn("relative h-5 w-9 shrink-0 rounded-full border transition", checked ? "border-u-accent/50 bg-u-accent/80" : "border-u-ink/10 bg-u-ink/[0.07]")}
      >
        <span className={cn("absolute top-0.5 h-3.5 w-3.5 rounded-full bg-u-bg transition-all", checked ? "left-[18px] bg-u-bg" : "left-0.5 bg-u-s3")} />
      </button>
      <label htmlFor={id} className="cursor-pointer text-xs text-u-ink2">{label}</label>
    </div>
  );
}

/* ------------------------------ Empty / misc ----------------------------- */

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  compact,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-xl border border-dashed border-u-ink/10 bg-u-ink/[0.015] text-center", compact ? "px-4 py-6" : "px-6 py-12")}>
      <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-u-ink/[0.07] bg-u-ink/[0.03] text-u-muted">
        <Icon className="h-5 w-5" strokeWidth={1.6} />
      </span>
      <p className="text-[13px] font-medium text-u-ink">{title}</p>
      {description && <p className="mt-1 max-w-sm text-[11.5px] leading-relaxed text-u-muted">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function InfoNote({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "warning" | "success" }) {
  const styles = {
    info: "border-u-blue/20 bg-u-blue/[0.06] text-u-blue/80",
    warning: "border-u-warn/20 bg-u-warn/[0.06] text-u-warn/80",
    success: "border-u-accent/20 bg-u-accent/[0.055] text-u-accent/80",
  };
  const NoteIcon = tone === "warning" ? AlertTriangle : tone === "success" ? CheckCircle2 : Info;
  return (
    <div className={cn("flex items-start gap-2 rounded-lg border px-3 py-2 text-[11px] leading-relaxed", styles[tone])}>
      <NoteIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.9} />
      <span>{children}</span>
    </div>
  );
}

export function Metric({
  label,
  value,
  hint,
  tone,
  icon,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "default" | "positive" | "warning" | "negative";
  icon?: LucideIcon;
}) {
  const tones = {
    default: "text-u-ink",
    positive: "text-u-accent",
    warning: "text-u-warn",
    negative: "text-u-danger",
  };
  return (
    <div className="rounded-xl border border-u-ink/[0.06] bg-u-ink/[0.02] p-3">
      <p className="flex items-center gap-1 text-[9.5px] font-semibold uppercase tracking-[0.1em] text-u-muted">
        {icon && (() => { const MetricIcon = icon; return <MetricIcon className="h-3 w-3" strokeWidth={2} />; })()} {label}
      </p>
      <p className={cn("mt-1 font-mono text-[15px] font-medium tracking-tight", tones[tone ?? "default"])}>{value}</p>
      {hint && <p className="mt-0.5 text-[10px] leading-tight text-u-muted">{hint}</p>}
    </div>
  );
}

export function LinkRow({ label, value, icon: Icon }: { label: string; value: ReactNode; icon?: LucideIcon }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="flex min-w-0 items-center gap-1.5 text-[11px] text-u-muted">
        {Icon && <Icon className="h-3 w-3 shrink-0" strokeWidth={1.8} />}
        <span className="truncate">{label}</span>
      </span>
      <span className="shrink-0 text-right text-[11px] font-medium text-u-ink">{value}</span>
    </div>
  );
}

export function Breadcrumb({ items }: { items: { label: string; onClick?: () => void }[] }) {
  return (
    <nav className="flex items-center gap-1.5 text-[11px] text-u-muted">
      {items.map((item, index) => (
        <span key={`${item.label}-${index}`} className="flex items-center gap-1.5">
          {index > 0 && <ChevronRight className="h-3 w-3 text-u-muted" />}
          {item.onClick ? (
            <button onClick={item.onClick} className="transition hover:text-u-accent">{item.label}</button>
          ) : (
            <span className={index === items.length - 1 ? "text-u-ink2" : ""}>{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

export function ToneIcon({ icon: Icon, tone = "acid", size = "md" }: { icon: LucideIcon; tone?: Tone; size?: "sm" | "md" | "lg" }) {
  const sizes = { sm: "h-7 w-7", md: "h-9 w-9", lg: "h-11 w-11" };
  const iconSizes = { sm: "h-3.5 w-3.5", md: "h-4 w-4", lg: "h-5 w-5" };
  return (
    <span className={cn("inline-flex shrink-0 items-center justify-center rounded-xl border", sizes[size], tones[tone])}>
      <Icon className={iconSizes[size]} strokeWidth={1.9} />
    </span>
  );
}

export { CheckCircle2, AlertTriangle };
