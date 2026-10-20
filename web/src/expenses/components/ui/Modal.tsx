import { cn } from "../../utils/cn";
import { X } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  wide,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  wide?: boolean;
  footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="u-root">
    <div className="fixed inset-0 z-[140] flex items-start justify-center overflow-y-auto p-4 sm:p-8" data-modal>
      <div className="animate-ap-in fixed inset-0 bg-u-bg/70 backdrop-blur-sm" onClick={onClose} />
      <div
        className={cn(
          "animate-ap-slide-up relative z-10 my-4 w-full rounded-2xl border border-u-line2 bg-u-card shadow-2xl shadow-u-bg/50",
          wide ? "max-w-3xl" : "max-w-xl",
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-u-line px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-u-ink">{title}</h2>
            {subtitle && <p className="mt-0.5 text-sm text-u-muted">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-u-muted hover:bg-u-s3 hover:text-u-ink"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-u-line px-5 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>
    </div>,
    document.body,
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Confirm",
  destructive,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  destructive?: boolean;
}) {
  if (!open) return null;
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <button
            onClick={onClose}
            className="h-9 rounded-lg px-3.5 text-sm text-u-ink2 hover:bg-u-s3"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={cn(
              "h-9 rounded-lg px-3.5 text-sm font-medium",
              destructive
                ? "bg-u-danger text-u-bg hover:bg-u-danger"
                : "bg-u-accent text-u-onaccent hover:bg-u-accent",
            )}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <p className="text-sm leading-6 text-u-ink2">{message}</p>
    </Modal>
  );
}
