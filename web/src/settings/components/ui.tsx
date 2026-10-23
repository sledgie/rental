import {
  AlertCircle,
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  GripVertical,
  Info,
  Loader2,
  Lock,
  Plus,
  Trash2,
  X,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useId, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "../../auth/utils/cn";
import type { ListItem, ToastMessage, ToastTone } from "../types";

/* ------------------------------------------------------------------ */
/* Buttons                                                             */
/* ------------------------------------------------------------------ */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "soft";
type ButtonSize = "sm" | "md" | "lg";

const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    "bg-u-accent text-u-onaccent shadow-sm shadow-u-accent/20 hover:bg-u-accent-strong focus-visible:ring-u-accent/60 disabled:bg-u-accent ",
  secondary:
    "border border-u-line bg-u-card text-u-ink2 shadow-sm hover:border-u-line2 hover:bg-u-s2 focus-visible:ring-u-line2    ",
  ghost:
    "text-u-ink2 hover:bg-u-s3 hover:text-u-ink focus-visible:ring-u-line2   ",
  danger:
    "border border-u-danger/30 bg-u-card text-u-danger shadow-sm hover:bg-u-danger-soft focus-visible:ring-u-danger/60    ",
  soft:
    "bg-u-accent-soft text-u-accent hover:bg-u-accent-soft focus-visible:ring-u-accent/60   ",
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: "h-8 gap-1.5 rounded-lg px-2.5 text-[12.5px]",
  md: "h-9.5 gap-2 rounded-lg px-3.5 text-[13px]",
  lg: "h-10.5 gap-2 rounded-xl px-4 text-sm",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon;
  iconRight?: LucideIcon;
  loading?: boolean;
  children?: ReactNode;
}

export function Button({
  variant = "secondary",
  size = "md",
  icon: Icon,
  iconRight: IconRight,
  loading,
  children,
  className,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={cn(
        "inline-flex select-none items-center justify-center font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-u-card disabled:opacity-60 ",
        buttonVariants[variant],
        buttonSizes[size],
        className,
      )}
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : Icon ? <Icon className="h-3.5 w-3.5" /> : null}
      {children}
      {IconRight && !loading ? <IconRight className="h-3.5 w-3.5" /> : null}
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
        "inline-flex h-8 w-8 items-center justify-center rounded-lg text-u-muted transition hover:bg-u-s3 hover:text-u-ink disabled:opacity-40   ",
        className,
      )}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Badges & status                                                     */
/* ------------------------------------------------------------------ */

type BadgeTone = "gray" | "blue" | "green" | "amber" | "red" | "violet" | "indigo";

const badgeTones: Record<BadgeTone, string> = {
  gray: "bg-u-s3 text-u-ink2 ring-u-line2/10   ",
  blue: "bg-u-accent-soft text-u-accent ring-u-accent/15   ",
  green: "bg-u-ok-soft text-u-ok ring-u-ok/15   ",
  amber: "bg-u-warn-soft text-u-warn ring-u-warn/20   ",
  red: "bg-u-danger-soft text-u-danger ring-u-danger/15   ",
  violet: "bg-u-violet/15 text-u-violet ring-u-violet/15   ",
  indigo: "bg-u-accent-soft text-u-accent ring-u-accent/15   ",
};

export function Badge({
  tone = "gray",
  dot,
  icon: Icon,
  children,
  className,
}: {
  tone?: BadgeTone;
  dot?: boolean;
  icon?: LucideIcon;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset",
        badgeTones[tone],
        className,
      )}
    >
      {dot ? <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" /> : null}
      {Icon ? <Icon className="h-3 w-3" /> : null}
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Cards                                                               */
/* ------------------------------------------------------------------ */

export function Card({ children, className, id }: { children: ReactNode; className?: string; id?: string }) {
  return (
    <div
      id={id}
      className={cn(
        "scroll-mt-24 overflow-hidden rounded-2xl border border-u-line/80 bg-u-card shadow-[0_1px_2px_rgba(15,23,42,0.03)]  ",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  description,
  icon: Icon,
  aside,
  className,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  aside?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-3 border-b border-u-line px-5 py-4 sm:px-6 ", className)}>
      <div className="flex min-w-0 items-start gap-3">
        {Icon ? (
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-u-s2 text-u-muted ring-1 ring-u-line/70   ">
            <Icon className="h-4 w-4" />
          </span>
        ) : null}
        <div className="min-w-0">
          <h3 className="text-[14px] font-semibold tracking-[-0.01em] text-u-ink ">{title}</h3>
          {description ? (
            <p className="mt-0.5 max-w-2xl text-[12.5px] leading-relaxed text-u-muted ">{description}</p>
          ) : null}
        </div>
      </div>
      {aside ? <div className="flex shrink-0 items-center gap-2">{aside}</div> : null}
    </div>
  );
}

export function CardBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("px-5 py-5 sm:px-6", className)}>{children}</div>;
}

/* ------------------------------------------------------------------ */
/* Form controls                                                       */
/* ------------------------------------------------------------------ */

export function Field({
  label,
  hint,
  error,
  required,
  badge,
  children,
  className,
}: {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  badge?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      {label ? (
        <div className="mb-1.5 flex flex-wrap items-center gap-2">
          <label className="text-[12.5px] font-medium text-u-ink2 ">
            {label}
            {required ? <span className="ml-0.5 text-u-danger">*</span> : null}
          </label>
          {badge}
        </div>
      ) : null}
      {children}
      {error ? (
        <p className="mt-1.5 flex items-start gap-1 text-[11.5px] font-medium text-u-danger ">
          <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-[11.5px] leading-relaxed text-u-muted ">{hint}</p>
      ) : null}
    </div>
  );
}

const controlBase =
  "w-full rounded-lg border bg-u-card text-[13px] text-u-ink shadow-[0_1px_2px_rgba(15,23,42,0.03)] outline-none transition placeholder:text-u-muted focus:border-u-accent/60 focus:ring-2 focus:ring-u-accent/15 disabled:cursor-not-allowed disabled:bg-u-s2 disabled:text-u-muted       ";

export function Input({
  invalid,
  icon: Icon,
  prefix,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean; icon?: LucideIcon; prefix?: string }) {
  return (
    <div className="relative">
      {prefix ? (
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-[12.5px] font-medium text-u-muted ">
          {prefix}
        </span>
      ) : Icon ? (
        <Icon className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-u-muted " />
      ) : null}
      <input
        {...props}
        className={cn(
          controlBase,
          "h-9.5 px-3",
          prefix ? "pl-12" : Icon ? "pl-9" : "",
          invalid
            ? "border-u-danger/30 focus:border-u-danger/60 focus:ring-u-danger/15 "
            : "border-u-line ",
          className,
        )}
      />
    </div>
  );
}

export function Select({
  invalid,
  children,
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  return (
    <div className="relative">
      <select
        {...props}
        className={cn(
          controlBase,
          "h-9.5 appearance-none px-3 pr-9",
          invalid ? "border-u-danger/30 " : "border-u-line ",
          className,
        )}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-u-muted " />
    </div>
  );
}

export function Textarea({
  invalid,
  className,
  rows = 4,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return (
    <textarea
      {...props}
      rows={rows}
      className={cn(
        controlBase,
        "resize-y px-3 py-2.5 text-[13px] leading-relaxed",
        invalid ? "border-u-danger/30 " : "border-u-line ",
        className,
      )}
    />
  );
}

export function Toggle({
  checked,
  onChange,
  disabled,
  label,
  size = "md",
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label: string;
  size?: "sm" | "md";
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex shrink-0 items-center rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-u-accent/60 focus-visible:ring-offset-2 disabled:opacity-45 ",
        size === "sm" ? "h-4.5 w-8" : "h-5.5 w-10",
        checked ? "bg-u-accent" : "bg-u-line ",
      )}
    >
      <span
        className={cn(
          "inline-block rounded-full bg-u-card shadow-sm transition-transform duration-200",
          size === "sm" ? "h-3.5 w-3.5 translate-x-0.5" : "h-4.5 w-4.5 translate-x-0.5",
          checked ? (size === "sm" ? "translate-x-4" : "translate-x-[20px]") : "",
        )}
      />
    </button>
  );
}

export function SettingRow({
  title,
  description,
  badge,
  children,
  className,
  icon: Icon,
}: {
  title: string;
  description?: string;
  badge?: ReactNode;
  children: ReactNode;
  className?: string;
  icon?: LucideIcon;
}) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-x-8 gap-y-3 py-3.5", className)}>
      <div className="flex min-w-0 flex-1 items-start gap-3">
        {Icon ? (
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-u-s2 text-u-muted ring-1 ring-u-line/70   ">
            <Icon className="h-3.5 w-3.5" />
          </span>
        ) : null}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[13px] font-medium text-u-ink ">{title}</p>
            {badge}
          </div>
          {description ? (
            <p className="mt-0.5 max-w-xl text-[12px] leading-relaxed text-u-muted ">{description}</p>
          ) : null}
        </div>
      </div>
      <div className="shrink-0 pt-0.5">{children}</div>
    </div>
  );
}

export function Checkbox({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex cursor-pointer items-start gap-2.5 rounded-lg py-1.5",
        disabled && "cursor-not-allowed opacity-60",
      )}
    >
      <span className="relative mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
          className="peer h-4 w-4 cursor-pointer appearance-none rounded border border-u-line2 bg-u-card transition checked:border-u-accent/60 checked:bg-u-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-u-accent/30 disabled:cursor-not-allowed    "
        />
        <Check className="pointer-events-none absolute h-3 w-3 text-u-onaccent opacity-0 peer-checked:opacity-100" strokeWidth={3} />
      </span>
      <span className="min-w-0">
        <span className="block text-[12.5px] font-medium leading-5 text-u-ink2 ">{label}</span>
        {description ? (
          <span className="mt-0.5 block text-[11.5px] leading-relaxed text-u-muted ">{description}</span>
        ) : null}
      </span>
    </label>
  );
}

export function Segmented({
  options,
  value,
  onChange,
  disabled,
  size = "md",
}: {
  options: Array<{ value: string; label: string; icon?: LucideIcon }>;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  size?: "sm" | "md";
}) {
  return (
    <div className="inline-flex flex-wrap items-center gap-0.5 rounded-lg bg-u-s3 p-0.5 ">
      {options.map((option) => {
        const Icon = option.icon;
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            disabled={disabled}
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-u-accent/40 disabled:opacity-50",
              size === "sm" ? "h-6.5 px-2 text-[11.5px]" : "h-7.5 px-2.5 text-[12px]",
              active
                ? "bg-u-card text-u-ink shadow-sm ring-1 ring-u-line2/5   "
                : "text-u-muted hover:text-u-ink  ",
            )}
          >
            {Icon ? <Icon className="h-3 w-3" /> : null}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function RadioCards({
  options,
  value,
  onChange,
  disabled,
  columns = 2,
}: {
  options: Array<{ value: string; label: string; description?: string; badge?: ReactNode }>;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  columns?: 1 | 2 | 3;
}) {
  return (
    <div
      role="radiogroup"
      className={cn(
        "grid gap-2",
        columns === 2 ? "sm:grid-cols-2" : columns === 3 ? "sm:grid-cols-3" : "grid-cols-1",
      )}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={cn(
              "group flex items-start gap-2.5 rounded-lg border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-u-accent/30 disabled:opacity-60",
              active
                ? "border-u-accent/60 bg-u-accent-soft/40 ring-1 ring-u-accent/20  "
                : "border-u-line bg-u-card hover:border-u-line2 hover:bg-u-s2/60    ",
            )}
          >
            <span
              className={cn(
                "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition",
                active ? "border-u-accent/60 bg-u-accent" : "border-u-line2 bg-u-card  ",
              )}
            >
              {active ? <span className="h-1.5 w-1.5 rounded-full bg-u-card" /> : null}
            </span>
            <span className="min-w-0">
              <span className="flex flex-wrap items-center gap-1.5 text-[12.5px] font-medium text-u-ink ">
                {option.label}
                {option.badge}
              </span>
              {option.description ? (
                <span className="mt-0.5 block text-[11.5px] leading-relaxed text-u-muted ">
                  {option.description}
                </span>
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* List editor                                                         */
/* ------------------------------------------------------------------ */

export function ListEditor({
  items,
  onChange,
  readOnly,
  allowDisable = false,
  placeholder = "Add a new item",
  addLabel = "Add item",
  emptyLabel = "No items configured yet.",
}: {
  items: ListItem[];
  onChange: (items: ListItem[]) => void;
  readOnly?: boolean;
  allowDisable?: boolean;
  placeholder?: string;
  addLabel?: string;
  emptyLabel?: string;
}) {
  const [newLabel, setNewLabel] = useState("");

  const addItem = () => {
    const label = newLabel.trim();
    if (!label || readOnly) return;
    onChange([...items, { id: `item_${Math.random().toString(36).slice(2, 8)}`, label, ...(allowDisable ? { enabled: true } : {}) }]);
    setNewLabel("");
  };

  return (
    <div className="space-y-2">
      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-u-line px-4 py-5 text-center text-[12px] text-u-muted  ">
          {emptyLabel}
        </div>
      ) : (
        <div className="space-y-1.5">
          {items.map((item, index) => (
            <div
              key={item.id}
              className={cn(
                "group flex items-center gap-2 rounded-lg border border-u-line bg-u-card px-2 py-1.5  ",
                item.enabled === false && "bg-u-s2/60 opacity-70 ",
              )}
            >
              <GripVertical className="h-3.5 w-3.5 shrink-0 text-u-s3 " />
              <input
                value={item.label}
                disabled={readOnly}
                aria-label={`Item ${index + 1}`}
                onChange={(event) => {
                  const next = items.map((entry) => (entry.id === item.id ? { ...entry, label: event.target.value } : entry));
                  onChange(next);
                }}
                className="h-7 min-w-0 flex-1 bg-transparent text-[12.5px] text-u-ink2 outline-none placeholder:text-u-muted disabled:cursor-not-allowed "
              />
              {allowDisable ? (
                <span
                  className={cn(
                    "hidden rounded px-1.5 py-0.5 text-[10px] font-medium sm:inline",
                    item.enabled === false
                      ? "bg-u-s3 text-u-muted  "
                      : "bg-u-ok-soft text-u-ok  ",
                  )}
                >
                  {item.enabled === false ? "Disabled" : "Enabled"}
                </span>
              ) : null}
              {allowDisable ? (
                <IconButton
                  icon={item.enabled === false ? EyeOff : Eye}
                  label={item.enabled === false ? `Enable ${item.label}` : `Disable ${item.label}`}
                  disabled={readOnly}
                  onClick={() =>
                    onChange(items.map((entry) => (entry.id === item.id ? { ...entry, enabled: entry.enabled === false } : entry)))
                  }
                  className="h-7 w-7"
                />
              ) : null}
              <IconButton
                icon={Trash2}
                label={`Remove ${item.label}`}
                disabled={readOnly}
                onClick={() => onChange(items.filter((entry) => entry.id !== item.id))}
                className="h-7 w-7 hover:bg-u-danger-soft hover:text-u-danger "
              />
            </div>
          ))}
        </div>
      )}
      {!readOnly ? (
        <div className="flex items-center gap-2 pt-0.5">
          <Input
            value={newLabel}
            onChange={(event) => setNewLabel(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addItem();
              }
            }}
            placeholder={placeholder}
            className="h-8.5 text-[12.5px]"
          />
          <Button type="button" variant="secondary" size="sm" icon={Plus} onClick={addItem} disabled={!newLabel.trim()} className="h-8.5 shrink-0">
            {addLabel}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Feedback & disclosure                                               */
/* ------------------------------------------------------------------ */

const calloutTones = {
  info: {
    wrap: "border-u-accent/80 bg-u-accent-soft/60  ",
    icon: "text-u-accent ",
    title: "text-u-accent ",
    body: "text-u-accent/80 ",
    Icon: Info,
  },
  warning: {
    wrap: "border-u-warn/80 bg-u-warn-soft/60  ",
    icon: "text-u-warn ",
    title: "text-u-warn ",
    body: "text-u-warn/80 ",
    Icon: AlertTriangle,
  },
  danger: {
    wrap: "border-u-danger/80 bg-u-danger-soft/50  ",
    icon: "text-u-danger ",
    title: "text-u-danger ",
    body: "text-u-danger/80 ",
    Icon: AlertTriangle,
  },
  neutral: {
    wrap: "border-u-line bg-u-s2/70  ",
    icon: "text-u-muted ",
    title: "text-u-ink ",
    body: "text-u-ink2 ",
    Icon: Info,
  },
  success: {
    wrap: "border-u-ok/80 bg-u-ok-soft/50  ",
    icon: "text-u-ok ",
    title: "text-u-ok ",
    body: "text-u-ok/80 ",
    Icon: CheckCircle2,
  },
};

export function Callout({
  tone = "info",
  title,
  children,
  action,
  className,
  icon: CustomIcon,
}: {
  tone?: keyof typeof calloutTones;
  title?: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
  icon?: LucideIcon;
}) {
  const style = calloutTones[tone];
  const Icon = CustomIcon ?? style.Icon;
  return (
    <div className={cn("flex items-start gap-3 rounded-xl border px-4 py-3.5", style.wrap, className)}>
      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", style.icon)} />
      <div className="min-w-0 flex-1">
        {title ? <p className={cn("text-[12.5px] font-semibold", style.title)}>{title}</p> : null}
        <div className={cn("text-[12px] leading-relaxed", style.body, title && "mt-0.5")}>{children}</div>
        {action ? <div className="mt-2">{action}</div> : null}
      </div>
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-u-line px-6 py-9 text-center ">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-u-s2 text-u-muted ring-1 ring-u-line/70   ">
        <Icon className="h-5 w-5" />
      </span>
      <p className="mt-3 text-[13px] font-medium text-u-ink ">{title}</p>
      <p className="mt-1 max-w-sm text-[12px] leading-relaxed text-u-muted ">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function MetaRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <span className="text-[12px] text-u-muted ">{label}</span>
      <span className="text-right text-[12px] font-medium text-u-ink2 ">{children}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Modal & drawer                                                      */
/* ------------------------------------------------------------------ */

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  icon: Icon,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
  icon?: LucideIcon;
}) {
  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 animate-fade bg-u-ink2/40 backdrop-blur-[2px]" onClick={onClose} />
      <div
        className={cn(
          "animate-rise relative flex max-h-[90vh] w-full flex-col overflow-hidden rounded-2xl border border-u-line bg-u-card shadow-2xl shadow-u-line2/20  ",
          size === "sm" ? "max-w-md" : size === "lg" ? "max-w-2xl" : "max-w-lg",
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-u-line px-5 py-4 ">
          <div className="flex items-start gap-3">
            {Icon ? (
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-u-accent-soft text-u-accent ring-1 ring-u-accent/10   ">
                <Icon className="h-4 w-4" />
              </span>
            ) : null}
            <div>
              <h2 className="text-[14.5px] font-semibold text-u-ink ">{title}</h2>
              {description ? <p className="mt-0.5 text-[12px] leading-relaxed text-u-muted ">{description}</p> : null}
            </div>
          </div>
          <IconButton icon={X} label="Close dialog" onClick={onClose} />
        </div>
        {children ? <div className="overflow-y-auto px-5 py-4">{children}</div> : null}
        {footer ? (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-u-line bg-u-s2/60 px-5 py-3  ">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function Drawer({
  open,
  onClose,
  title,
  description,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 animate-fade bg-u-ink2/35 backdrop-blur-[2px]" onClick={onClose} />
      <div className="animate-rise absolute inset-y-0 right-0 flex w-full max-w-lg flex-col border-l border-u-line bg-u-card shadow-2xl  ">
        <div className="flex items-start justify-between gap-4 border-b border-u-line px-5 py-4 ">
          <div>
            <h2 className="text-[15px] font-semibold text-u-ink ">{title}</h2>
            {description ? <p className="mt-0.5 text-[12px] text-u-muted ">{description}</p> : null}
          </div>
          <IconButton icon={X} label="Close panel" onClick={onClose} />
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer ? (
          <div className="flex items-center justify-end gap-2 border-t border-u-line bg-u-s2/60 px-5 py-3  ">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Toasts                                                              */
/* ------------------------------------------------------------------ */

const toastStyles: Record<ToastTone, { icon: LucideIcon; iconClass: string; bar: string }> = {
  success: { icon: CheckCircle2, iconClass: "text-u-ok ", bar: "bg-u-ok" },
  error: { icon: XCircle, iconClass: "text-u-danger ", bar: "bg-u-danger" },
  info: { icon: Info, iconClass: "text-u-accent ", bar: "bg-u-accent" },
};

export function Toasts({ toasts, onDismiss }: { toasts: ToastMessage[]; onDismiss: (id: number) => void }) {
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[90] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2" aria-live="polite">
      {toasts.map((toast) => {
        const style = toastStyles[toast.tone];
        const Icon = style.icon;
        return (
          <div
            key={toast.id}
            className="animate-toast pointer-events-auto relative flex items-start gap-3 overflow-hidden rounded-xl border border-u-line bg-u-card px-3.5 py-3 shadow-lg shadow-u-line2/10  "
          >
            <span className={cn("absolute inset-y-0 left-0 w-0.5", style.bar)} />
            <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", style.iconClass)} />
            <div className="min-w-0 flex-1">
              <p className="text-[12.5px] font-medium text-u-ink ">{toast.message}</p>
              {toast.description ? (
                <p className="mt-0.5 text-[11.5px] leading-relaxed text-u-muted ">{toast.description}</p>
              ) : null}
            </div>
            <IconButton icon={X} label="Dismiss notification" onClick={() => onDismiss(toast.id)} className="h-6 w-6" />
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Misc                                                                */
/* ------------------------------------------------------------------ */

export function SectionHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-u-muted ">
        {eyebrow}
        <ChevronRight className="h-3 w-3" />
        <span className="text-u-muted ">{title}</span>
      </div>
      <p className="mt-1.5 max-w-2xl text-[12.5px] leading-relaxed text-u-muted ">{description}</p>
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("h-4 w-4 animate-spin", className)} />;
}

export function ProtectedBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-u-s3 px-2 py-0.5 text-[10.5px] font-medium text-u-muted ring-1 ring-inset ring-u-line2/10   ">
      <Lock className="h-2.5 w-2.5" />
      Protected
    </span>
  );
}

export { buttonSizes, buttonVariants, badgeTones };
