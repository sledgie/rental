import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { lockScroll } from "../../../shell/scrollLock";

/** Right-hand side drawer in the app's standard profile-drawer chrome (same as Properties / Tenants): header, profile heading, scrolling
 *  body. The body is module (Tailwind) content, so it sits inside a .u-root. */
export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  heading,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: ReactNode;
  heading?: ReactNode;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    // Escape closes the drawer only when no dialog is open on top of it
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !document.querySelector("[data-modal]") && onClose();
    window.addEventListener("keydown", onKey, true);
    const unlockScroll = lockScroll();
    return () => {
      window.removeEventListener("keydown", onKey, true);
      unlockScroll();
    };
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div className="tn">
      <div className="overlay-backdrop drawer-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div role="dialog" aria-modal="true" aria-label={title} className="overlay-panel drawer-panel profile-drawer u-drawer-wide">
          <div className="overlay-header">
            <div>
              <h2>{title}</h2>
              {subtitle && <p>{subtitle}</p>}
            </div>
            <button type="button" className="icon-button" aria-label="Close" title="Close" onClick={onClose}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </div>
          {heading}
          <div className="u-drawer-scroll"><div className="u-root">{children}</div></div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
