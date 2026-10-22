import React, { useEffect } from "react";
import { Icon } from "./icons";

// ---------------------------------------------------------------------------
// Button
// ---------------------------------------------------------------------------

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "success" | "outline";

const BUTTON_STYLES: Record<ButtonVariant, string> = {
  primary: "bg-u-accent text-u-onaccent hover:bg-u-accent-strong border border-transparent shadow-sm",
  secondary: "bg-u-card text-u-ink2 hover:bg-u-s2 border border-u-line2 shadow-sm",
  ghost: "bg-transparent text-u-ink2 hover:bg-u-s3 border border-transparent",
  danger: "bg-u-danger text-u-onaccent hover:bg-u-danger border border-transparent shadow-sm",
  success: "bg-u-ok text-u-onaccent hover:bg-u-ok border border-transparent shadow-sm",
  outline: "bg-transparent text-u-accent hover:bg-u-accent-soft border border-u-accent/30",
};

export function Button({
  variant = "secondary",
  size = "md",
  icon,
  children,
  className = "",
  disabled,
  title,
  onClick,
}: {
  variant?: ButtonVariant;
  size?: "sm" | "md";
  icon?: string;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  title?: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
        size === "sm" ? "px-2.5 py-1.5 text-xs" : "px-3.5 py-2 text-sm"
      } ${BUTTON_STYLES[variant]} ${className}`}
    >
      {icon && <Icon name={icon} className={size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4"} />}
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Badge / status pills
// ---------------------------------------------------------------------------

const BADGE_STYLES: Record<string, string> = {
  matched: "bg-u-ok-soft text-u-ok border-u-ok/30",
  suggested: "bg-u-blue-soft text-u-blue border-u-blue/30",
  unmatched: "bg-u-warn-soft text-u-warn border-u-warn/30",
  outstanding: "bg-u-violet/15 text-u-violet border-u-violet/30",
  review: "bg-u-warn-soft text-u-warn border-u-warn/30",
  ready: "bg-u-accent-soft text-u-accent border-u-accent/30",
  reconciled: "bg-u-ok-soft text-u-ok border-u-ok/30",
  cancelled: "bg-u-s3 text-u-muted border-u-line",
  duplicate: "bg-u-danger-soft text-u-danger border-u-danger/30",
  neutral: "bg-u-s3 text-u-ink2 border-u-line",
  high: "bg-u-ok-soft text-u-ok border-u-ok/30",
  medium: "bg-u-blue-soft text-u-blue border-u-blue/30",
  low: "bg-u-warn-soft text-u-warn border-u-warn/30",
  none: "bg-u-s3 text-u-muted border-u-line",
};

export function Badge({ kind = "neutral", children, dot = false }: { kind?: keyof typeof BADGE_STYLES; children: React.ReactNode; dot?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${BADGE_STYLES[kind] ?? BADGE_STYLES.neutral}`}>
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export function reconStatusBadge(status: string) {
  const map: Record<string, keyof typeof BADGE_STYLES> = {
    "Not Started": "neutral",
    "In Progress": "suggested",
    "Needs Review": "review",
    "Ready to Finalize": "ready",
    Reconciled: "reconciled",
    Reopened: "outstanding",
    Cancelled: "cancelled",
  };
  return <Badge kind={map[status] ?? "neutral"} dot>{status}</Badge>;
}

export function matchBadge(status: string) {
  const map: Record<string, keyof typeof BADGE_STYLES> = {
    Matched: "matched",
    "Suggested Match": "suggested",
    Unmatched: "unmatched",
    Outstanding: "outstanding",
    Duplicate: "duplicate",
  };
  return <Badge kind={map[status] ?? "neutral"} dot>{status}</Badge>;
}

export function confidenceBadge(level: string) {
  const kind = ({ High: "high", Medium: "medium", Low: "low", None: "none" } as Record<string, keyof typeof BADGE_STYLES>)[level] ?? "none";
  return <Badge kind={kind}>{level} Confidence</Badge>;
}

// ---------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------

export function Card({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={`rounded-xl border border-u-line bg-u-card shadow-sm ${className}`}>
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, icon, action }: { title: React.ReactNode; subtitle?: React.ReactNode; icon?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-u-line px-5 py-4">
      <div className="flex items-start gap-3">
        {icon && (
          <div className="mt-0.5 w-9 h-9 rounded-lg bg-u-accent-soft text-u-accent flex items-center justify-center shrink-0">
            <Icon name={icon} className="w-5 h-5" />
          </div>
        )}
        <div>
          <h2 className="text-sm font-semibold text-u-ink">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-u-muted">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "slate",
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: string;
  tone?: "slate" | "indigo" | "amber" | "emerald" | "rose" | "violet";
}) {
  const tones: Record<string, string> = {
    slate: "bg-u-s2 text-u-ink2",
    indigo: "bg-u-accent-soft text-u-accent",
    amber: "bg-u-warn-soft text-u-warn",
    emerald: "bg-u-ok-soft text-u-ok",
    rose: "bg-u-danger-soft text-u-danger",
    violet: "bg-u-violet/15 text-u-violet",
  };
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-u-muted">{label}</p>
        {icon && (
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${tones[tone]}`}>
            <Icon name={icon} className="w-4 h-4" />
          </div>
        )}
      </div>
      <p className="mt-2 text-2xl font-semibold text-u-ink tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-u-muted">{hint}</p>}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Form controls
// ---------------------------------------------------------------------------

export function Field({ label, hint, children, className = "" }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="block text-xs font-medium text-u-ink2 mb-1">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-u-muted">{hint}</span>}
    </label>
  );
}

const INPUT_BASE =
  "w-full rounded-lg border border-u-line2 bg-u-card px-3 py-2 text-sm text-u-ink placeholder:text-u-muted focus:border-u-accent/60 focus:outline-none focus:ring-2 focus:ring-u-accent/30 disabled:bg-u-s2 disabled:text-u-muted";

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${INPUT_BASE} ${props.className ?? ""}`} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={`${INPUT_BASE} ${props.className ?? ""}`}>
      {props.children}
    </select>
  );
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${INPUT_BASE} ${props.className ?? ""}`} />;
}

export function Checkbox({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label?: React.ReactNode; disabled?: boolean }) {
  return (
    <label className={`inline-flex items-center gap-2 text-sm text-u-ink2 ${disabled ? "opacity-50" : ""}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 rounded border-u-line2 text-u-accent focus:ring-u-accent/60"
      />
      {label}
    </label>
  );
}

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;
  const widths = { sm: "max-w-md", md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-4xl" };
  return (
    <div className="fixed inset-0 z-[120] flex items-start justify-center overflow-y-auto bg-u-ink2/50 p-4" onClick={onClose}>
      <div
        className={`w-full ${widths[size]} my-8 rounded-2xl bg-u-card shadow-2xl border border-u-line`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-u-line px-6 py-4">
          <div>
            <h3 className="text-base font-semibold text-u-ink">{title}</h3>
            {subtitle && <p className="mt-1 text-xs text-u-muted">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-u-muted hover:bg-u-s3 hover:text-u-ink2">
            <Icon name="x" className="w-5 h-5" />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 border-t border-u-line px-6 py-4">{footer}</div>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Drawer (slide-over)
// ---------------------------------------------------------------------------

export function Drawer({
  open,
  onClose,
  title,
  children,
  width = "max-w-xl",
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
  width?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[120] flex justify-end bg-u-ink2/40" onClick={onClose}>
      <div className={`h-full w-full ${width} bg-u-card shadow-2xl flex flex-col`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-u-line px-5 py-4">
          <h3 className="text-sm font-semibold text-u-ink">{title}</h3>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-u-muted hover:bg-u-s3">
            <Icon name="x" className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Alert / empty state / progress
// ---------------------------------------------------------------------------

export function Alert({ kind = "info", children }: { kind?: "info" | "warning" | "danger" | "success"; children: React.ReactNode }) {
  const styles: Record<string, string> = {
    info: "bg-u-blue-soft border-u-blue/30 text-u-blue",
    warning: "bg-u-warn-soft border-u-warn/30 text-u-warn",
    danger: "bg-u-danger-soft border-u-danger/30 text-u-danger",
    success: "bg-u-ok-soft border-u-ok/30 text-u-ok",
  };
  return (
    <div className={`flex items-start gap-2 rounded-lg border px-3.5 py-2.5 text-xs ${styles[kind]}`}>
      <Icon name={kind === "danger" ? "alert" : kind === "success" ? "check" : "info"} className="w-4 h-4 mt-0.5 shrink-0" />
      <div className="whitespace-pre-wrap">{children}</div>
    </div>
  );
}

export function EmptyState({ icon = "search", title, description, action }: { icon?: string; title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
      <div className="w-12 h-12 rounded-xl bg-u-s3 text-u-muted flex items-center justify-center">
        <Icon name={icon} className="w-6 h-6" />
      </div>
      <p className="text-sm font-medium text-u-ink2">{title}</p>
      {description && <p className="text-xs text-u-muted max-w-sm">{description}</p>}
      {action}
    </div>
  );
}

export function ProgressBar({ value, max, tone = "indigo" }: { value: number; max: number; tone?: "indigo" | "emerald" | "amber" }) {
  const pct = max <= 0 ? 0 : Math.min(100, Math.round((value / max) * 100));
  const tones: Record<string, string> = {
    indigo: "bg-u-accent",
    emerald: "bg-u-ok",
    amber: "bg-u-warn",
  };
  return (
    <div className="w-full h-2 rounded-full bg-u-line">
      <div className={`h-2 rounded-full ${tones[tone]} transition-all`} style={{ width: `${pct}%` }} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Table helpers
// ---------------------------------------------------------------------------

export function Th({ className = "", children, sortable, onSort, sortDir }: { className?: string; children?: React.ReactNode; sortable?: boolean; onSort?: () => void; sortDir?: "asc" | "desc" }) {
  return (
    <th className={`px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-u-muted whitespace-nowrap ${sortable ? "cursor-pointer select-none hover:text-u-ink2" : ""} ${className}`} onClick={sortable ? onSort : undefined}>
      <span className="inline-flex items-center gap-1">
        {children}
        {sortable && (
          <span className="text-[10px] text-u-muted">
            {sortDir === "asc" ? "▲" : sortDir === "desc" ? "▼" : "⇅"}
          </span>
        )}
      </span>
    </th>
  );
}

export function Td({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return <td className={`px-3 py-2.5 text-sm text-u-ink2 ${className}`}>{children}</td>;
}

export function DataTableWrap({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-u-line bg-u-card shadow-sm">
      <table className="min-w-full border-collapse">{children}</table>
    </div>
  );
}

export function Toolbar({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2">{children}</div>;
}

export function SegmentedTabs<T extends string>({ tabs, active, onChange }: { tabs: { key: T; label: string; icon?: string; badge?: number }[]; active: T; onChange: (k: T) => void }) {
  return (
    <div className="flex gap-1 overflow-x-auto rounded-xl border border-u-line bg-u-s3 p-1">
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          onClick={() => onChange(t.key)}
          className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
            active === t.key ? "bg-u-card text-u-accent shadow-sm" : "text-u-muted hover:text-u-ink2"
          }`}
        >
          {t.icon && <Icon name={t.icon} className="w-3.5 h-3.5" />}
          {t.label}
          {t.badge !== undefined && (
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${active === t.key ? "bg-u-accent-soft text-u-accent" : "bg-u-line text-u-muted"}`}>{t.badge}</span>
          )}
        </button>
      ))}
    </div>
  );
}
