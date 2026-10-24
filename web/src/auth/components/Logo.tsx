import { cn } from "../utils/cn";

export function BrandMark({ className, size = "md" }: { className?: string; size?: "sm" | "md" | "lg" }) {
  const dimensions = {
    sm: "size-8 rounded-[10px]",
    md: "size-9 rounded-xl",
    lg: "size-11 rounded-[14px]",
  } as const;
  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden bg-gradient-to-br from-[#1d6650] to-[#123d32] ring-1 ring-white/25 shadow-[0_6px_16px_-6px_rgba(12,42,34,0.7)]",
        dimensions[size],
        className
      )}
      aria-hidden
    >
      <span className="absolute inset-0 bg-[radial-gradient(circle_at_30%_10%,rgba(255,255,255,0.45),transparent_55%)]" />
      <svg viewBox="0 0 24 24" fill="none" className={size === "sm" ? "size-4" : size === "lg" ? "size-6" : "size-5"}>
        <path d="M5 19V9.6L12 5l7 4.6V19" stroke="white" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M9 19v-5.2h6V19" stroke="white" strokeOpacity=".75" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M15.6 7.1 20 4.6" stroke="white" strokeOpacity=".6" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    </span>
  );
}

export function Logo({
  className,
  theme = "light",
  size = "md",
  withWordmark = true,
}: {
  className?: string;
  theme?: "light" | "dark";
  size?: "sm" | "md" | "lg";
  withWordmark?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <BrandMark size={size} />
      {withWordmark ? (
        <span className="flex flex-col leading-none">
          <span
            className={cn(
              "font-semibold tracking-[-0.035em]",
              size === "lg" ? "text-[22px]" : size === "sm" ? "text-[15px]" : "text-[17px]",
              theme === "dark" ? "text-u-onaccent" : "text-u-ink"
            )}
          >
            L.O.F.T.
          </span>
          {size !== "sm" ? (
            <span
              className={cn(
                "mt-0.5 text-[8.5px] font-medium uppercase tracking-[0.22em]",
                theme === "dark" ? "text-u-muted" : "text-u-muted"
              )}
            >
              Landlord Operations &amp; Financial Tracking
            </span>
          ) : null}
        </span>
      ) : null}
    </span>
  );
}
