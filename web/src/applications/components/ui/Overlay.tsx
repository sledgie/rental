import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "../../utils/cn";
import { Button, IconButton } from "./Button";
import { IconX, IconWarn } from "../icons";

/* --------------------------------- Modal --------------------------------- */

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const width = {
    sm: "max-w-md",
    md: "max-w-xl",
    lg: "max-w-3xl",
    xl: "max-w-5xl",
  }[size];

  return createPortal(
    <div className="u-root">
    <div className="fixed inset-0 z-[140] flex items-start justify-center overflow-y-auto bg-u-bg/70 p-4 backdrop-blur-[2px] animate-ap-in">
      <div
        role="dialog"
        aria-modal="true"
        data-modal
        aria-label={title}
        className={cn(
          "mt-[6vh] w-full rounded-xl border border-u-line2 bg-u-card shadow-2xl shadow-u-bg/60 animate-ap-slide-up",
          width,
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-u-line px-5 py-3.5">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-u-ink">{title}</h2>
            {description && (
              <p className="mt-0.5 text-xs leading-relaxed text-u-muted">{description}</p>
            )}
          </div>
          <IconButton label="Close dialog" onClick={onClose}>
            <IconX />
          </IconButton>
        </div>
        <div className="max-h-[64vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-u-line bg-u-s2 px-5 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>
    </div>,
    document.body,
  );
}

/* --------------------------------- Drawer -------------------------------- */

export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  heading,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: ReactNode;
  heading?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
}) {
  useEffect(() => {
    if (!open) return;
    // Escape closes the drawer only when no dialog is open on top of it
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !document.querySelector("[data-modal]") && onClose();
    window.addEventListener("keydown", onKey, true);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  // Standard profile-drawer chrome (same as Properties / Tenants); body and footer are module (Tailwind) content inside a .u-root.
  return createPortal(
    <div className="tn">
      <div
        className="overlay-backdrop drawer-backdrop"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div role="dialog" aria-modal="true" aria-label={title} className="overlay-panel drawer-panel profile-drawer u-drawer-wide">
          <div className="overlay-header">
            <div>
              <h2>{title}</h2>
              {subtitle && <p>{subtitle}</p>}
            </div>
            <button type="button" className="icon-button" aria-label="Close panel" title="Close" onClick={onClose}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </div>
          {heading}
          <div className="u-drawer-scroll"><div className="u-root">{children}</div></div>
          {footer && <div className="u-drawer-foot"><div className="u-root">{footer}</div></div>}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ----------------------------- Confirm dialog ---------------------------- */

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  tone = "primary",
  requireReason,
  reasonPlaceholder = "Reason or internal note (optional)",
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  tone?: "primary" | "danger";
  requireReason?: boolean;
  reasonPlaceholder?: string;
  onCancel: () => void;
  onConfirm: (reason?: string) => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant={tone === "danger" ? "danger" : "primary"}
            onClick={() => {
              const field = document.getElementById("confirm-reason") as HTMLTextAreaElement | null;
              onConfirm(field?.value || undefined);
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="flex gap-2.5">
          <IconWarn className="mt-px h-4 w-4 shrink-0 text-u-warn" />
          <div className="text-[13px] leading-relaxed text-u-ink2">{message}</div>
        </div>
        {requireReason && (
          <textarea
            id="confirm-reason"
            rows={3}
            placeholder={reasonPlaceholder}
            className="w-full rounded-lg border border-u-line2 bg-u-s2 px-3 py-2 text-[13px] text-u-ink placeholder:text-u-muted focus:border-u-accent focus:outline-none"
          />
        )}
      </div>
    </Modal>
  );
}
