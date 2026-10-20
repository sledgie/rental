import { createPortal } from "react-dom";
import { useStore } from "../../store/appStore";
import { cn } from "../../utils/cn";
import { Icon, type IconName } from "./Icon";

const toneMap: Record<string, { border: string; icon: IconName; color: string }> = {
  jade: { border: "border-u-ok/45", icon: "checkCircle", color: "text-u-ok" },
  azure: { border: "border-u-accent/45", icon: "info", color: "text-u-accent" },
  amber: { border: "border-u-warn/45", icon: "alert", color: "text-u-warn" },
  rose: { border: "border-u-danger/45", icon: "alert", color: "text-u-danger" },
};

export function Toasts() {
  const { toasts, dismissToast } = useStore();
  if (toasts.length === 0) return null;

  return createPortal(
    <div className="u-root">
    <div
      className="pointer-events-none fixed bottom-3 right-3 z-[160] flex w-[min(360px,calc(100vw-24px))] flex-col gap-2"
      role="status"
      aria-live="polite"
    >
      {toasts.map((t) => {
        const tone = toneMap[t.tone] ?? toneMap.azure;
        return (
          <div
            key={t.id}
            className={cn(
              "animate-u-toast pointer-events-auto flex items-start gap-2.5 rounded-lg border bg-u-card/97 px-3 py-2.5 shadow-[0_24px_60px_-24px_rgba(0,0,0,0.95)] backdrop-blur",
              tone.border,
            )}
          >
            <Icon name={tone.icon} size={15} className={cn("mt-px shrink-0", tone.color)} />
            <div className="min-w-0 flex-1">
              <p className="text-[12.5px] font-600 text-u-ink">{t.title}</p>
              {t.message && <p className="mt-0.5 text-[11.5px] leading-relaxed text-u-muted">{t.message}</p>}
            </div>
            <button
              type="button"
              onClick={() => dismissToast(t.id)}
              aria-label="Dismiss notification"
              className="shrink-0 text-u-muted transition-colors hover:text-u-ink2"
            >
              <Icon name="x" size={13} />
            </button>
          </div>
        );
      })}
    </div>
    </div>,
    document.body,
  );
}
