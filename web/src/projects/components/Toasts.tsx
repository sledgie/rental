import { createPortal } from "react-dom";
import { useStore } from "../lib/store";
import { cn } from "../utils/cn";

const TONE = {
  success: "border-u-accent/40",
  error: "border-u-danger/40",
  warning: "border-u-warn/40",
  info: "border-u-blue/40",
} as const;

export function Toasts() {
  const { toasts, dismissToast } = useStore();
  if (!toasts.length) return null;
  return createPortal(
    <div className="u-root">
      <div className="pointer-events-none fixed right-4 bottom-4 z-[160] flex w-80 flex-col gap-2">
        {toasts.map((t) => (
          <button
            key={t.id}
            onClick={() => dismissToast(t.id)}
            className={cn("pointer-events-auto animate-ap-slide-up rounded-xl border bg-u-card p-3 text-left shadow-xl", TONE[t.tone])}
          >
            <p className="text-[12px] font-semibold text-u-ink">{t.title}</p>
            {t.description && <p className="mt-0.5 text-[10.5px] leading-relaxed text-u-muted">{t.description}</p>}
          </button>
        ))}
      </div>
    </div>,
    document.body,
  );
}
