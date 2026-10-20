import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { CheckCircle2, Info, TriangleAlert, X } from "lucide-react";
import { cn } from "@inv/utils/cn";

type ToastKind = "success" | "info" | "warning";

interface Toast {
  id: number;
  kind: ToastKind;
  title: string;
  body?: string;
}

const ToastContext = createContext<{
  toast: (t: { kind?: ToastKind; title: string; body?: string }) => void;
} | null>(null);

let counter = 0;

const icons: Record<ToastKind, ReactNode> = {
  success: <CheckCircle2 className="size-4 text-paid" />,
  info: <Info className="size-4 text-accent-hover" />,
  warning: <TriangleAlert className="size-4 text-unpaid" />,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    ({ kind = "info", title, body }: { kind?: ToastKind; title: string; body?: string }) => {
      const id = ++counter;
      setItems((prev) => [...prev.slice(-2), { id, kind, title, body }]);
      window.setTimeout(() => dismiss(id), 4200);
    },
    [dismiss]
  );

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed bottom-4 right-4 z-[160] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2"
      >
        {items.map((t) => (
          <div
            key={t.id}
            className={cn(
              "animate-slide-up pointer-events-auto flex items-start gap-3 rounded-lg border border-line-strong bg-elevated px-3.5 py-3 shadow-xl shadow-black/50"
            )}
          >
            <span className="mt-0.5 shrink-0">{icons[t.kind]}</span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium text-ink">{t.title}</p>
              {t.body ? (
                <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">{t.body}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss notification"
              className="-mr-1 -mt-0.5 grid size-6 place-items-center rounded text-ink-faint transition-colors hover:text-ink"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx.toast;
}
