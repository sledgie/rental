import { cn } from "@lf/utils/cn";

type Tone = "light" | "dark";

/**
 * L.O.F.T. mark: a roofline (the property) above two equal ledger lines
 * (balanced books). `tone` refers to the background the mark sits on.
 */
export function LogoMark({ className, tone = "light" }: { className?: string; tone?: Tone }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true" focusable="false">
      <rect width="32" height="32" rx="8" className={tone === "light" ? "fill-evergreen" : "fill-white/10"} />
      {tone === "dark" && (
        <rect x="0.5" y="0.5" width="31" height="31" rx="7.5" fill="none" className="stroke-white/15" />
      )}
      <path
        d="M8.5 15.25 16 8.75l7.5 6.5"
        fill="none"
        className="stroke-ivory"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M11 19.5h10" className="stroke-ivory" strokeWidth="2.25" strokeLinecap="round" />
      <path d="M11 23.75h10" className="stroke-mint" strokeWidth="2.25" strokeLinecap="round" />
    </svg>
  );
}

/** Text-first wordmark — the acronym stays recognisable without the mark. */
export function Wordmark({ tone = "light", className }: { tone?: Tone; className?: string }) {
  const dot = tone === "light" ? "text-forest" : "text-mint";
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark tone={tone} className="size-8 shrink-0" />
      <span
        className={cn(
          "text-[1.1875rem] font-bold leading-none tracking-[0.08em]",
          tone === "light" ? "text-evergreen" : "text-ivory",
        )}
      >
        L<span className={dot}>.</span>O<span className={dot}>.</span>F<span className={dot}>.</span>T
        <span className={dot}>.</span>
      </span>
    </span>
  );
}
