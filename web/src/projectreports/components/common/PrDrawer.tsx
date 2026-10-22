// Right-hand drawer in the app's standard profile-drawer chrome (same as Payments / Properties / Tenants).
import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export function PrDrawer({ title, subtitle, onClose, children }: { title: ReactNode; subtitle?: ReactNode; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey, true);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return createPortal(
    <div className="tn">
      <div className="overlay-backdrop drawer-backdrop" style={{ zIndex: 120 }} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div role="dialog" aria-modal="true" aria-label="Details" className="overlay-panel drawer-panel profile-drawer">
          <div className="overlay-header">
            <div>
              <h2>{title}</h2>
              {subtitle && <p>{subtitle}</p>}
            </div>
            <button type="button" className="icon-button" aria-label="Close" title="Close" onClick={onClose}><X size={20} /></button>
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
