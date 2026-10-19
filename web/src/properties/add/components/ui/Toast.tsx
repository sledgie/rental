import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";
import { cn } from "../../utils/cn";

type ToastKind = "success" | "warning" | "info";

interface ToastItem {
  id: number;
  kind: ToastKind;
  title: string;
  message?: string;
}

interface ToastContextValue {
  toast: (kind: ToastKind, title: string, message?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const toast = useCallback((kind: ToastKind, title: string, message?: string) => {
    const id = nextId++;
    setToasts((t) => [...t, { id, kind, title, message }]);
    window.setTimeout(() => dismiss(id), 5000);
  }, [dismiss]);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[60] flex w-80 flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "flex items-start gap-3 rounded-lg border bg-moss-900 p-3.5 shadow-xl animate-[toast-in_.25s_ease-out]",
              t.kind === "success" && "border-sage-700/60",
              t.kind === "warning" && "border-sand-700/60",
              t.kind === "info" && "border-mint-700/60"
            )}
          >
            {t.kind === "success" && <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-sage-400" />}
            {t.kind === "warning" && <AlertTriangle size={18} className="mt-0.5 shrink-0 text-sand-400" />}
            {t.kind === "info" && <Info size={18} className="mt-0.5 shrink-0 text-mint-400" />}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-moss-100">{t.title}</p>
              {t.message && <p className="mt-0.5 text-xs text-moss-400">{t.message}</p>}
            </div>
            <button
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss notification"
              className="text-moss-500 hover:text-moss-200"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
