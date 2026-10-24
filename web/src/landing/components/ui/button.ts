import { cn } from "@lf/utils/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "inverse" | "inverseOutline";
export type ButtonSize = "sm" | "md" | "lg";

const BASE =
  "group/button inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-control font-semibold tracking-[-0.005em] transition-[background-color,border-color,color,box-shadow,translate] duration-200 ease-out active:translate-y-px motion-reduce:active:translate-y-0";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-forest text-white shadow-button hover:bg-forest-hover",
  secondary: "border border-line-strong bg-white text-evergreen shadow-xs hover:border-forest/40 hover:bg-sage-soft",
  ghost: "text-ink hover:bg-evergreen/[0.06] hover:text-evergreen",
  inverse: "bg-ivory text-evergreen shadow-[0_1px_2px_rgb(0_0_0/0.25)] hover:bg-white",
  inverseOutline: "border border-white/25 text-white hover:border-white/50 hover:bg-white/[0.07]",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-9 px-3.5 text-sm",
  md: "h-11 px-5 text-[0.9375rem]",
  lg: "h-12 px-6 text-base",
};

export interface ButtonStyleOptions {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}

/** Shared class recipe for every button-styled link or button on the page. */
export function buttonStyles({ variant = "primary", size = "md", className }: ButtonStyleOptions = {}) {
  return cn(BASE, VARIANTS[variant], SIZES[size], className);
}

/** Trailing arrow that nudges forward when its parent button is hovered. */
export const buttonArrowClass =
  "size-4 shrink-0 transition-transform duration-200 group-hover/button:translate-x-0.5 motion-reduce:transition-none";
