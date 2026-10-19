import type { ReactNode } from "react";
import { cn } from "../../utils/cn";

type Tone = "green" | "amber" | "red" | "gray" | "indigo";

const tones: Record<Tone, string> = {
  green: "bg-sage-500/10 text-sage-400 border-sage-600/40",
  amber: "bg-sand-500/10 text-sand-400 border-sand-600/40",
  red: "bg-brick-500/10 text-brick-400 border-brick-600/40",
  gray: "bg-moss-500/10 text-moss-400 border-moss-600/40",
  indigo: "bg-mint-500/10 text-mint-400 border-mint-600/40",
};

export function Badge({ tone = "gray", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

export function statusTone(status: string): Tone {
  switch (status) {
    case "active":
      return "green";
    case "under_renovation":
      return "amber";
    case "sold":
      return "red";
    default:
      return "gray";
  }
}
