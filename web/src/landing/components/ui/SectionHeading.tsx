import type { ReactNode } from "react";
import { cn } from "@lf/utils/cn";

type Tone = "light" | "dark";

export function Eyebrow({ children, tone = "light", className }: { children: ReactNode; tone?: Tone; className?: string }) {
  return (
    <p className={cn("text-eyebrow font-semibold uppercase", tone === "dark" ? "text-mint" : "text-forest", className)}>
      {children}
    </p>
  );
}

interface SectionHeadingProps {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  /** Used by the parent <section aria-labelledby>. */
  titleId: string;
  align?: "left" | "center";
  tone?: Tone;
  className?: string;
}

/** Eyebrow + H2 + supporting copy, used to open every major section. */
export function SectionHeading({
  eyebrow,
  title,
  description,
  titleId,
  align = "left",
  tone = "light",
  className,
}: SectionHeadingProps) {
  const dark = tone === "dark";
  return (
    <div className={cn("max-w-3xl", align === "center" && "mx-auto text-center", className)}>
      {eyebrow && <Eyebrow tone={tone}>{eyebrow}</Eyebrow>}
      <h2
        id={titleId}
        className={cn("mt-3 text-title font-semibold text-balance", dark ? "text-ivory" : "text-evergreen")}
      >
        {title}
      </h2>
      {description && (
        <div className={cn("mt-5 text-lead text-pretty", dark ? "text-white/70" : "text-muted")}>{description}</div>
      )}
    </div>
  );
}
