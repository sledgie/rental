import { createPortal } from "react-dom";
import { useApp } from "../../context/AppContext";
import { cn } from "../../utils/cn";

export function Toasts() {
  const { toasts, dismissToast } = useApp();
  if (!toasts.length) return null;
  return createPortal(
    <div className="u-root">
      <div className="pointer-events-none fixed right-4 bottom-4 z-[160] flex flex-col gap-2">
        {toasts.map((t) => (
          <button
            key={t.id}
            onClick={() => dismissToast(t.id)}
            className={cn(
              "pointer-events-auto animate-ap-slide-up rounded-lg border bg-u-card px-3 py-2 text-left text-sm shadow-lg",
              t.tone === "success" && "border-u-accent/40 text-u-accent",
              t.tone === "error" && "border-u-danger/40 text-u-danger",
              t.tone === "info" && "border-u-blue/40 text-u-blue",
            )}
          >
            {t.message}
          </button>
        ))}
      </div>
    </div>,
    document.body,
  );
}
