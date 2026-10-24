import type { LucideIcon } from "lucide-react";
import { cn } from "@lf/utils/cn";

type Size = "sm" | "md" | "lg";
type Tone = "sage" | "white" | "evergreen" | "dark" | "amber";

const SIZES: Record<Size, string> = {
  sm: "size-7 rounded-md [&>svg]:size-3.5",
  md: "size-9 rounded-lg [&>svg]:size-[18px]",
  lg: "size-11 rounded-xl [&>svg]:size-5",
};

const TONES: Record<Tone, string> = {
  sage: "bg-sage text-forest",
  white: "border border-line bg-white text-forest shadow-xs",
  evergreen: "bg-evergreen text-mint",
  dark: "bg-white/10 text-mint ring-1 ring-white/10",
  amber: "bg-amber-soft text-amber-ink",
};

interface IconTileProps {
  icon: LucideIcon;
  size?: Size;
  tone?: Tone;
  className?: string;
}

/** Small, restrained icon container used for feature and capability labels. */
export function IconTile({ icon: Icon, size = "md", tone = "sage", className }: IconTileProps) {
  return (
    <span
      aria-hidden="true"
      className={cn("inline-flex shrink-0 items-center justify-center", SIZES[size], TONES[tone], className)}
    >
      <Icon strokeWidth={1.75} />
    </span>
  );
}
