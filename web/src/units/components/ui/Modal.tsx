import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "../../utils/cn";
import { Button, IconButton, Pill, type Tone } from "./primitives";
import { Icon, type IconName } from "./Icon";
import { lockScroll } from "../../../shell/scrollLock";

function useDismiss(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    const unlockScroll = lockScroll();
    window.addEventListener("keydown", onKey);
    return () => {
      unlockScroll();
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);
}

export function Overlay({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  useDismiss(open, onClose);
  if (!open) return null;
  return createPortal(
    <div className="u-root">
    <div className="fixed inset-0 z-[145] flex items-end justify-center sm:items-center">
      <div
        className="absolute inset-0 bg-u-bg/78 backdrop-blur-[3px]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        className="animate-u-fade-up relative z-10 max-h-[92vh] w-full overflow-hidden rounded-t-xl border border-u-line2 bg-u-card shadow-[0_40px_120px_-30px_rgba(0,0,0,0.9)] sm:max-w-lg sm:rounded-xl"
      >
        {children}
      </div>
    </div>
    </div>,
    document.body,
  );
}

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  icon,
  children,
  footer,
  width = "sm",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: ReactNode;
  icon?: IconName;
  children: ReactNode;
  footer?: ReactNode;
  width?: "sm" | "md" | "lg";
}) {
  const widths = { sm: "sm:max-w-lg", md: "sm:max-w-2xl", lg: "sm:max-w-4xl" }[width];
  useDismiss(open, onClose);
  if (!open) return null;
  return createPortal(
    <div className="u-root">
    <div className="fixed inset-0 z-[140] flex items-end justify-center sm:items-center sm:p-6">
      <div className="absolute inset-0 bg-u-bg/78 backdrop-blur-[3px]" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "animate-u-fade-up relative z-10 flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-xl border border-u-line2 bg-u-card shadow-[0_40px_120px_-30px_rgba(0,0,0,0.9)] sm:rounded-xl",
          widths,
        )}
      >
        <header className="flex items-start gap-3 border-b border-u-line2 bg-u-s2/60 px-4 py-3">
          {icon && (
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-u-accent/35 bg-u-accent/12 text-u-accent">
              <Icon name={icon} size={14} />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-[15px] font-600 text-u-ink">{title}</h2>
            {subtitle && <p className="mt-0.5 text-[12px] leading-relaxed text-u-muted">{subtitle}</p>}
          </div>
          <IconButton label="Close" icon="x" onClick={onClose} />
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{children}</div>
        {footer && (
          <footer className="flex items-center justify-end gap-2 border-t border-u-line2 bg-u-s2/60 px-4 py-3">
            {footer}
          </footer>
        )}
      </div>
    </div>
    </div>,
    document.body,
  );
}

/** Right-hand side drawer in the app's standard profile-drawer chrome (same as Properties / Tenants): header, optional profile heading and
 *  tabs, scrolling body and optional footer. The body and footer are module (Tailwind) content, so they sit inside a .u-root. */
export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  heading,
  tabs,
  children,
  footer,
  labelledBy,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: ReactNode;
  heading?: ReactNode;
  tabs?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: "sm" | "md" | "lg" | "xl";
  labelledBy?: string;
}) {
  useDismiss(open, onClose);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (open) ref.current?.focus({ preventScroll: true });
  }, [open]);
  if (!open) return null;

  return createPortal(
    <div className="tn">
      <div
        className="overlay-backdrop drawer-backdrop"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={labelledBy} className="overlay-panel drawer-panel profile-drawer u-drawer-wide">
          <div className="overlay-header">
            <div>
              <h2 id={labelledBy}>{title}</h2>
              {subtitle && <p>{subtitle}</p>}
            </div>
            <button type="button" className="icon-button" aria-label="Close" title="Close" onClick={onClose}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </div>
          {heading}
          {tabs}
          <div className="u-drawer-scroll"><div className="u-root">{children}</div></div>
          {footer && <div className="u-drawer-foot"><div className="u-root">{footer}</div></div>}
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
  body,
  confirmLabel = "Confirm",
  tone = "rose",
  icon = "alert",
  details,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  body: ReactNode;
  confirmLabel?: string;
  tone?: Tone;
  icon?: IconName;
  details?: ReactNode;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      icon={icon}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={tone === "rose" ? "danger" : "primary"}
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-3 text-[13px] leading-relaxed text-u-ink2">{body}</div>
      {details && (
        <div className="mt-3 rounded-md border border-u-line2 bg-u-bg/70 p-3 text-[12px] text-u-muted">
          {details}
        </div>
      )}
    </Modal>
  );
}

export function Callout({
  tone = "azure",
  icon = "info",
  title,
  children,
  className,
}: {
  tone?: Tone;
  icon?: IconName;
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-md border px-3 py-2.5 text-[12px] leading-relaxed",
        tone === "amber" && "border-u-warn/30 bg-u-warn/8 text-u-warn/90",
        tone === "rose" && "border-u-danger/30 bg-u-danger/8 text-u-danger/90",
        tone === "azure" && "border-u-accent/30 bg-u-accent/8 text-u-accent/90",
        tone === "jade" && "border-u-ok/30 bg-u-ok/8 text-u-ok/90",
        tone === "cyan" && "border-u-blue/30 bg-u-blue/8 text-u-blue/90",
        tone === "neutral" && "border-u-line2 bg-u-s2/60 text-u-muted",
        tone === "muted" && "border-u-line2 bg-u-bg/50 text-u-muted",
        className,
      )}
    >
      <Icon name={icon} size={14} className="mt-[1px] shrink-0" />
      <div className="min-w-0">
        {title && <p className="font-600 text-u-ink">{title}</p>}
        {children}
      </div>
    </div>
  );
}

export function BadgeCount({ n, tone = "neutral" }: { n: number; tone?: Tone }) {
  if (!n) return null;
  return <Pill tone={tone}>{n}</Pill>;
}
