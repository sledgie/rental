// Right-hand drawer in the app's standard profile-drawer chrome (same as Payments / Properties / Tenants) for one account's details.
import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

export function AccountDrawer({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector("[data-modal]")) onClose();
    };
    window.addEventListener("keydown", onKey, true);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return createPortal(
    <div className="tn">
      <div
        className="overlay-backdrop drawer-backdrop"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div role="dialog" aria-modal="true" aria-labelledby="coa-drawer-title" className="overlay-panel drawer-panel profile-drawer">
          <div className="overlay-header">
            <div>
              <h2 id="coa-drawer-title">{title}</h2>
              {subtitle && <p>{subtitle}</p>}
            </div>
            <button type="button" className="icon-button" aria-label="Close" title="Close" onClick={onClose}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </div>
          <div className="u-drawer-scroll">
            <div className="u-root">{children}</div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
