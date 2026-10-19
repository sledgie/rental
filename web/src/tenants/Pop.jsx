// A small popover: renders `trigger({ open, toggle })` and, while open, a fixed-position panel next to it
// (fixed and portalled to <body>, so neither the scrolling table nor a pinned column's stacking layer can cover it). Clicking outside or pressing Escape closes it.
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export function Pop({ trigger, children, align = 'left', width, className = '' }) {
  const ref = useRef(null);
  const [pos, setPos] = useState(null);
  const close = () => setPos(null);
  const toggle = () => {
    if (pos) return close();
    const r = ref.current.getBoundingClientRect();
    setPos({ top: r.bottom + 4, ...(align === 'right' ? { right: Math.max(8, window.innerWidth - r.right) } : { left: Math.max(8, Math.min(r.left, window.innerWidth - (width || 240) - 8)) }) });
  };
  useEffect(() => {
    if (!pos) return undefined;
    const esc = (e) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [pos]);
  return (
    <span className="tv-pop" ref={ref}>
      {trigger({ open: !!pos, toggle })}
      {pos && createPortal(
        <>
          <div className="tv-back" onMouseDown={close} />
          <div className={`tv-menu ${className}`} style={{ ...pos, width, maxHeight: `calc(100vh - ${pos.top + 12}px)` }} role="menu">
            {typeof children === 'function' ? children(close) : children}
          </div>
        </>,
        document.body,
      )}
    </span>
  );
}
export const MenuItem = ({ children, onClick, danger, disabled, title }) => (
  <button type="button" role="menuitem" className={`tv-mi${danger ? ' dng' : ''}`} disabled={disabled} title={title} onClick={onClick}>{children}</button>
);
