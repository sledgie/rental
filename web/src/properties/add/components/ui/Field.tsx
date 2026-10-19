import type { ReactNode } from "react";
import { cn } from "../../utils/cn";

interface FieldProps {
  label: string;
  htmlFor?: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}

export function Field({ label, htmlFor, required, error, hint, children, className }: FieldProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-[13px] font-medium text-moss-300">
        {label}
        {required && <span className="text-mint-400 ml-0.5">*</span>}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-brick-400">{error}</p>
      ) : hint ? (
        <p className="text-xs text-moss-500">{hint}</p>
      ) : null}
    </div>
  );
}

export const inputBase = cn(
  "w-full rounded-lg bg-moss-900 border border-moss-700/80 text-moss-100 text-sm",
  "placeholder:text-moss-500 px-3 h-9.5",
  "focus:outline-none focus:ring-2 focus:ring-mint-500/60 focus:border-mint-500/60",
  "transition-colors disabled:opacity-50"
);

export const inputError = "border-brick-500/70 focus:ring-brick-500/50 focus:border-brick-500/60";
