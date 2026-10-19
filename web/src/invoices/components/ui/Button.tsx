import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@inv/utils/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "subtle";
type Size = "sm" | "md" | "icon";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  children?: ReactNode;
}

const variants: Record<Variant, string> = {
  primary:
    "bg-accent text-[#07130d] hover:bg-accent-hover border border-accent/60 shadow-[0_1px_0_0_rgba(255,255,255,0.06)_inset]",
  secondary:
    "bg-surface-2 text-ink border border-line-strong hover:bg-surface-3 hover:border-[#3a4a3e]",
  ghost: "bg-transparent text-ink-muted border border-transparent hover:bg-surface-2 hover:text-ink",
  subtle: "bg-accent-soft text-[#8ce2bf] border border-accent/30 hover:bg-[#1b3327]",
  danger:
    "bg-transparent text-overdue border border-overdue/35 hover:bg-overdue/10 hover:border-overdue/60",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-2.5 text-[13px] gap-1.5 rounded-md",
  md: "h-9 px-3.5 text-sm gap-2 rounded-lg",
  icon: "h-8 w-8 rounded-md justify-center",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "secondary", size = "md", className, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center font-medium whitespace-nowrap transition-colors duration-150 select-none",
        "disabled:opacity-45 disabled:pointer-events-none",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    />
  )
);
Button.displayName = "Button";
