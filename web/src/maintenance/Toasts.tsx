import { createPortal } from "react-dom";
import { CheckCircle2, Info, TriangleAlert, X } from "lucide-react";
import { useStore } from "./store";

/** Module toasts, portalled above the drawer (z-160) and themed through the u-* tokens. */
export function Toasts() {
  const s = useStore();
  if (!s.toasts.length) return null;
  const icons = {
    success: <CheckCircle2 size={16} className="text-u-ok" />,
    info: <Info size={16} className="text-u-blue" />,
    warning: <TriangleAlert size={16} className="text-u-warn" />,
    error: <TriangleAlert size={16} className="text-u-danger" />,
  };
  return createPortal(
    <div className="u-root">
      <div className="pointer-events-none fixed right-4 bottom-4 z-[160] flex w-[340px] max-w-[calc(100vw-2rem)] flex-col gap-2">
        {s.toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto flex animate-ap-slide-up items-start gap-2.5 rounded-xl border border-u-line bg-u-s2 px-3.5 py-3 shadow-xl shadow-black/40">
            <span className="mt-px shrink-0">{icons[t.kind]}</span>
            <p className="flex-1 text-[12.5px] leading-snug text-u-ink">{t.message}</p>
            <button onClick={() => s.dismissToast(t.id)} className="shrink-0 text-u-muted transition hover:text-u-ink" aria-label="Dismiss"><X size={13} /></button>
          </div>
        ))}
      </div>
    </div>,
    document.body,
  );
}
