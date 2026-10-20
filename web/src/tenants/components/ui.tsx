import {
  useEffect,
  useId,
  useRef,
  type ReactNode,
  type ButtonHTMLAttributes,
} from "react";
import { createPortal } from "react-dom";
import {
  Check,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  FileText,
  LoaderCircle,
  X,
} from "lucide-react";
import type { Tenant } from "../types";
import { fullName } from "../lib/domain";
import { lockScroll } from "../../shell/scrollLock";

export function Avatar({
  tenant,
  size = "md",
}: {
  tenant: Tenant;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
}) {
  return (
    <span
      className={`avatar avatar-${size} avatar-${tenant.avatarColor}`}
      aria-label={fullName(tenant)}
    >
      {tenant.photoUrl ? (
        <img src={tenant.photoUrl} alt="" />
      ) : (
        `${tenant.firstName[0] ?? ""}${tenant.lastName[0] ?? ""}`
      )}
    </span>
  );
}

export function StatusBadge({
  status,
  small = false,
}: {
  status: string;
  small?: boolean;
}) {
  return (
    <span
      className={`status-badge status-${status.toLowerCase().replace(/ /g, "-")} ${small ? "status-small" : ""}`}
    >
      <span className="status-dot" />
      {status}
    </span>
  );
}

export function Button({
  children,
  variant = "secondary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={`button button-${variant} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function IconButton({
  label,
  children,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={`icon-button ${className}`}
      aria-label={label}
      title={label}
      {...props}
    >
      {children}
    </button>
  );
}

export function EmptyState({
  title,
  description,
  action,
  compact = false,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={`empty-state ${compact ? "empty-compact" : ""}`}>
      <div className="empty-icon">
        <FileText size={compact ? 20 : 27} strokeWidth={1.5} />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}

export function SectionTitle({
  icon,
  title,
  action,
}: {
  icon?: ReactNode;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="section-title">
      <h3>
        {icon}
        {title}
      </h3>
      {action}
    </div>
  );
}

let openOverlays = 0;
function syncOverlayAccessibility(excluding?: Element | null) {
  const root = document.getElementById("root");
  if (root) root.inert = openOverlays > 0;
  const backdrops = [
    ...document.querySelectorAll<HTMLElement>(".overlay-backdrop"),
  ].filter((node) => node !== excluding);
  backdrops.forEach((node, index) => {
    node.inert = index < backdrops.length - 1;
  });
}

export function Overlay({
  title,
  subtitle,
  children,
  onClose,
  drawer = false,
  wide = false,
  className = "",
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onClose: () => void;
  drawer?: boolean;
  wide?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const titleId = useId();
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    openOverlays += 1;
    const unlockScroll = lockScroll();
    const container = ref.current;
    syncOverlayAccessibility();
    const first =
      container?.querySelector<HTMLElement>("[data-autofocus]") ??
      container?.querySelector<HTMLElement>(
        'button, input, select, textarea, [tabindex="0"]',
      );
    first?.focus();
    const handleKey = (event: KeyboardEvent) => {
      const overlays = document.querySelectorAll('[data-overlay="true"]');
      if (overlays[overlays.length - 1] !== container) return;
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current();
      }
      if (event.key === "Tab" && container) {
        const elements = [
          ...container.querySelectorAll<HTMLElement>(
            'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]',
          ),
        ].filter((e) => e.offsetParent !== null);
        const firstElement = elements[0];
        const lastElement = elements[elements.length - 1];
        if (!container.contains(document.activeElement)) {
          event.preventDefault();
          firstElement?.focus();
        } else if (event.shiftKey && document.activeElement === firstElement) {
          event.preventDefault();
          lastElement?.focus();
        } else if (!event.shiftKey && document.activeElement === lastElement) {
          event.preventDefault();
          firstElement?.focus();
        }
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => {
      openOverlays -= 1;
      unlockScroll();
      syncOverlayAccessibility(container?.parentElement);
      document.removeEventListener("keydown", handleKey);
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, []);
  return createPortal(
    <div className="tn">
    <div
      className={`overlay-backdrop ${drawer ? "drawer-backdrop" : ""}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        data-overlay="true"
        className={`overlay-panel ${drawer ? "drawer-panel" : "modal-panel"} ${wide ? "panel-wide" : ""} ${className}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="overlay-header">
          <div>
            <h2 id={titleId}>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <IconButton label="Close dialog" onClick={onClose}>
            <X size={20} />
          </IconButton>
        </div>
        {children}
      </div>
    </div>,
    </div>,
    document.body,
  );
}

export function Toast({
  message,
  type = "success",
  onClose,
}: {
  message: string;
  type?: "success" | "error";
  onClose: () => void;
}) {
  useEffect(() => {
    const timer = window.setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);
  return (
    <div
      className={`toast toast-${type}`}
      role={type === "error" ? "alert" : "status"}
    >
      {type === "success" ? (
        <CheckCircle2 size={19} />
      ) : (
        <CircleHelp size={19} />
      )}
      <span>{message}</span>
      <IconButton label="Dismiss notification" onClick={onClose}>
        <X size={15} />
      </IconButton>
    </div>
  );
}

export function DataField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="data-field">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export function TextLink({
  children,
  onClick,
  arrow = false,
  className = "",
}: {
  children: ReactNode;
  onClick: () => void;
  arrow?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={`text-link ${className}`}
      onClick={onClick}
    >
      {children}
      {arrow && <ChevronRight size={14} />}
    </button>
  );
}

export function Signatory({ value }: { value: boolean }) {
  return (
    <span className={`signatory ${value ? "is-signatory" : ""}`}>
      {value ? <Check size={11} /> : null}
      {value ? "Signatory" : "Non-signatory"}
    </span>
  );
}

export function SavingIndicator() {
  return <LoaderCircle className="spin" size={16} />;
}
