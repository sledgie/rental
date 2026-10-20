import { cn } from "../../utils/cn";
import type { ReactNode } from "react";

type Tone =
  | "neutral"
  | "teal"
  | "amber"
  | "rose"
  | "sky"
  | "violet"
  | "emerald"
  | "orange";

const tones: Record<Tone, string> = {
  neutral: "bg-u-ink/6 text-u-ink2 border-u-ink/10",
  teal: "bg-u-accent/12 text-u-accent border-u-accent/20",
  amber: "bg-u-warn/12 text-u-warn border-u-warn/20",
  rose: "bg-u-danger/12 text-u-danger border-u-danger/25",
  sky: "bg-u-blue/12 text-u-blue border-u-blue/20",
  violet: "bg-u-violet/12 text-u-violet border-u-violet/20",
  emerald: "bg-u-ok/12 text-u-ok border-u-ok/20",
  orange: "bg-u-warn/12 text-u-warn border-u-warn/20",
};

export function Badge({
  tone = "neutral",
  children,
  className,
  dot,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium tracking-wide whitespace-nowrap",
        tones[tone],
        className,
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}
