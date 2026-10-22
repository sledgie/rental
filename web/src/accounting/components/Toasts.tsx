import { useEffect } from "react";
import { useChart } from "../store/chart-store";
import type { Toast } from "../coa/types";
import { cn } from "../utils/cn";
import { AlertTriangle, Check, Info, X } from "./Icons";

const TONES = {
  success: { bar: "bg-u-ok", icon: <Check className="h-4 w-4" />, chip: "border-u-ok/30 bg-u-ok-soft text-u-ok" },
  error: {
    bar: "bg-u-danger",
    icon: <AlertTriangle className="h-4 w-4" />,
    chip: "border-u-danger/30 bg-u-danger-soft text-u-danger",
  },
  warning: {
    bar: "bg-u-warn",
    icon: <AlertTriangle className="h-4 w-4" />,
    chip: "border-u-warn/30 bg-u-warn-soft text-u-warn",
  },
  info: { bar: "bg-u-accent", icon: <Info className="h-4 w-4" />, chip: "border-u-ok/30 bg-u-accent-soft text-u-accent" },
} as const;

function ToastCard({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  useEffect(() => {
    const t = window.setTimeout(() => onDismiss(toast.id), toast.action ? 8000 : 4200);
    return () => window.clearTimeout(t);
  }, [toast, onDismiss]);

  const tone = TONES[toast.kind];
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-auto relative w-[min(92vw,360px)] overflow-hidden rounded-[8px] border border-u-line bg-u-card shadow-[0_16px_40px_-16px_rgba(20,24,26,.45)] animate-coa-toast-in"
    >
      <span className={cn("absolute inset-y-0 left-0 w-[3px]", tone.bar)} />
      <div className="flex items-start gap-2.5 py-2.5 pr-2.5 pl-3.5">
        <span className={cn("mt-[1px] flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] border", tone.chip)}>
          {tone.icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[12.5px] leading-tight font-semibold text-u-ink">{toast.title}</p>
          {toast.message && <p className="mt-1 text-[11.5px] leading-snug text-u-muted">{toast.message}</p>}
          {toast.action && (
            <button
              type="button"
              onClick={() => {
                toast.action?.run();
                onDismiss(toast.id);
              }}
              className="mt-1.5 rounded-[4px] border border-u-line bg-u-s2 px-1.5 py-0.5 text-[11px] font-semibold text-u-accent transition-colors hover:border-u-accent hover:bg-u-accent-soft"
            >
              {toast.action.label}
            </button>
          )}
        </div>
        <button
          type="button"
          aria-label="Dismiss notification"
          onClick={() => onDismiss(toast.id)}
          className="shrink-0 rounded-[4px] p-1 text-u-muted transition-colors hover:bg-u-s3 hover:text-u-ink"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <span
        className={cn("absolute bottom-0 left-0 h-[2px] w-full origin-left", tone.bar)}
        style={{ animation: "toast-bar 4.2s linear both", opacity: 0.35 }}
      />
    </div>
  );
}

export function Toasts() {
  const { state, api } = useChart();
  return (
    <div className="pointer-events-none fixed right-3 bottom-3 z-[80] flex flex-col-reverse gap-2 sm:right-5 sm:bottom-5">
      {state.toasts.map((t) => (
        <ToastCard key={t.id} toast={t} onDismiss={api.dismissToast} />
      ))}
    </div>
  );
}
