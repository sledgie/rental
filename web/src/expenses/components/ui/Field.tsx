import { cn } from "../../utils/cn";
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

export function Field({
  label,
  error,
  hint,
  children,
  className,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 block text-xs font-medium tracking-wide text-u-ink2">{label}</span>
      {children}
      {hint && !error && <p className="mt-1 text-[11px] text-u-muted">{hint}</p>}
      {error && <p className="mt-1 text-[11px] text-u-danger">{error}</p>}
    </label>
  );
}

const control =
  "w-full rounded-lg border border-u-line2 bg-u-bg px-3 py-2 text-sm text-u-ink outline-none transition placeholder:text-u-muted/70 focus:border-u-accent/50 focus:ring-2 focus:ring-u-accent/15";

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(control, props.className)} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn(control, props.className)} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(control, "min-h-[84px] resize-y", props.className)} />;
}

export function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-u-ink">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-u-line2 bg-u-bg text-u-accent accent-u-accent"
      />
      {label}
    </label>
  );
}
