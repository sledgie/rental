import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { cn } from "../utils/cn";

export type ToastVariant = "success" | "error" | "info";

export interface ToastInput {
  title: string;
  description?: string;
  variant?: ToastVariant;
}

interface ToastItem extends ToastInput {
  id: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  toast: (input: ToastInput) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const styles: Record<ToastVariant, { icon: typeof Info; accent: string; iconBg: string }> = {
  success: {
    icon: CheckCircle2,
    accent: "text-u-ok",
    iconBg: "bg-u-ok-soft ring-u-ok/30",
  },
  error: {
    icon: AlertTriangle,
    accent: "text-u-danger",
    iconBg: "bg-u-danger-soft ring-u-danger/30",
  },
  info: {
    icon: Info,
    accent: "text-u-accent",
    iconBg: "bg-u-accent-soft ring-u-accent/30",
  },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback(
    (input: ToastInput) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const next: ToastItem = { ...input, id, variant: input.variant ?? "info" };
      setItems((current) => [...current.slice(-3), next]);
      window.setTimeout(() => dismiss(id), 4800);
    },
    [dismiss]
  );

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed inset-x-4 bottom-4 z-[120] flex flex-col items-end gap-2 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-[380px]"
      >
        {items.map((item) => {
          const style = styles[item.variant];
          const Icon = style.icon;
          return (
            <div
              key={item.id}
              role="status"
              className="animate-scale-in pointer-events-auto flex w-full items-start gap-3 rounded-xl border border-u-line bg-u-card p-3.5 shadow-pop"
            >
              <span className={cn("mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg ring-1", style.iconBg)}>
                <Icon className={cn("size-4", style.accent)} aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-u-ink">{item.title}</p>
                {item.description ? (
                  <p className="mt-0.5 text-[12px] leading-relaxed text-u-muted">{item.description}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => dismiss(item.id)}
                aria-label="Dismiss notification"
                className="rounded-md p-1 text-u-muted transition hover:bg-u-s3 hover:text-u-ink2"
              >
                <X className="size-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside ToastProvider");
  return context;
}
