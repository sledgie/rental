import { cn } from "../../utils/cn";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type Size = "sm" | "md" | "lg";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  icon,
  className,
  children,
  ...props
}: Props) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all disabled:cursor-not-allowed disabled:opacity-40",
        variant === "primary" &&
          "bg-u-accent text-u-onaccent shadow-[0_0_0_1px_color-mix(in_srgb,var(--accent)_30%,transparent)] hover:bg-u-accent",
        variant === "secondary" &&
          "bg-u-s3 text-u-ink hover:bg-u-line2 border border-u-line2",
        variant === "ghost" && "text-u-ink2 hover:bg-u-s3 hover:text-u-ink",
        variant === "danger" && "bg-u-danger/15 text-u-danger hover:bg-u-danger/25 border border-u-danger/30",
        variant === "outline" &&
          "border border-u-accent/40 text-u-accent hover:bg-u-accent-soft",
        size === "sm" && "h-8 px-2.5 text-xs",
        size === "md" && "h-9 px-3.5 text-sm",
        size === "lg" && "h-11 px-4 text-sm",
        className,
      )}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
}
