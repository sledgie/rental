import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../../utils/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
}

const variants: Record<Variant, string> = {
  primary:
    "bg-mint-600 hover:bg-mint-500 text-moss-950 border border-transparent focus-visible:ring-mint-400",
  secondary:
    "bg-moss-800 hover:bg-moss-700 text-moss-100 border border-moss-700 focus-visible:ring-moss-500",
  outline:
    "bg-transparent hover:bg-moss-800/60 text-moss-200 border border-moss-700 focus-visible:ring-moss-500",
  ghost:
    "bg-transparent hover:bg-moss-800/60 text-moss-300 border border-transparent focus-visible:ring-moss-500",
  danger:
    "bg-brick-600/90 hover:bg-brick-600 text-moss-950 border border-transparent focus-visible:ring-brick-400",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-9.5 px-4 text-sm",
  lg: "h-11 px-5 text-sm",
};

export function Button({ variant = "secondary", size = "md", className, children, ...rest }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-moss-950",
        "disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap",
        variants[variant],
        sizes[size],
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
