import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../../utils/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "success" | "subtle";
type Size = "xs" | "sm" | "md";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  trailingIcon?: ReactNode;
  block?: boolean;
}

const variants: Record<Variant, string> = {
  primary:
    "bg-u-accent text-u-onaccent border border-u-accent hover:bg-u-accent-strong hover:border-u-accent shadow-[0_1px_0_0_rgba(255,255,255,0.08)_inset]",
  secondary:
    "bg-u-s2 text-u-ink border border-u-line2 hover:bg-u-s3 hover:border-u-accent/60",
  ghost: "bg-transparent text-u-ink2 border border-transparent hover:bg-u-s2 hover:text-u-ink",
  danger:
    "bg-u-danger/12 text-u-danger border border-u-danger/35 hover:bg-u-danger/20 hover:text-u-danger",
  success:
    "bg-u-ok/12 text-u-ok border border-u-ok/35 hover:bg-u-ok/20",
  subtle: "bg-u-card text-u-ink2 border border-u-line hover:bg-u-s2 hover:text-u-ink",
};

const sizes: Record<Size, string> = {
  xs: "h-6.5 px-2 text-[11px] gap-1 rounded-md",
  sm: "h-8 px-2.5 text-xs gap-1.5 rounded-md",
  md: "h-9 px-3.5 text-[13px] gap-2 rounded-lg",
};

export function Button({
  variant = "secondary",
  size = "sm",
  icon,
  trailingIcon,
  block,
  className,
  children,
  ...rest
}: Props) {
  return (
    <button
      type="button"
      {...rest}
      className={cn(
        "inline-flex select-none items-center justify-center font-medium transition-colors duration-100 disabled:cursor-not-allowed disabled:opacity-45",
        variants[variant],
        sizes[size],
        block && "w-full",
        className,
      )}
    >
      {icon}
      {children}
      {trailingIcon}
    </button>
  );
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  children: ReactNode;
  tone?: "default" | "danger";
}

export function IconButton({ label, tone = "default", className, children, ...rest }: IconButtonProps) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      {...rest}
      className={cn(
        "inline-flex h-7 w-7 items-center justify-center rounded-md border border-transparent text-u-muted transition-colors hover:border-u-line2 hover:bg-u-s3 hover:text-u-ink disabled:opacity-40",
        tone === "danger" && "hover:border-u-danger/40 hover:bg-u-danger/10 hover:text-u-danger",
        className,
      )}
    >
      {children}
    </button>
  );
}
