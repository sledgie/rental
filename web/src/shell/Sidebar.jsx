// Dark navy sidebar driven by navConfig.js: quick action, collapsible groups, icon-rail collapse and a mobile drawer.
import { useEffect, useState } from 'react';
import { Icon } from '../icons.jsx';
import { BRAND, NAV, QUICK_ACTION, groupOf } from './navConfig.js';

function useMedia(query) {
  const [on, setOn] = useState(() => window.matchMedia(query).matches);
  useEffect(() => { const m = window.matchMedia(query); const f = () => setOn(m.matches); m.addEventListener('change', f); f(); return () => m.removeEventListener('change', f); }, [query]);
  return on;
}

export default function Sidebar({ route, collapsed, onToggle, mobileOpen, onClose }) {
  const mobile = useMedia('(max-width: 720px)');
  const tablet = useMedia('(max-width: 1024px)'); // tablets always get the icon rail
  const rail = !mobile && (collapsed || tablet);
  const [open, setOpen] = useState(() => new Set([groupOf(route), 'dashboard-group']));
  const [quickOpen, setQuickOpen] = useState(true);
  useEffect(() => { const g = groupOf(route); if (g) setOpen((s) => (s.has(g) ? s : new Set(s).add(g))); }, [route]);
  useEffect(() => {
    if (!mobileOpen) return undefined;
    const f = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, [mobileOpen, onClose]);
  const flip = (id) => setOpen((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const active = groupOf(route);
  const tip = (label) => (rail ? { 'data-tip': label } : {});

  const link = (item) => {
    const on = route === item.id;
    return (
      <a key={item.id} href={`#/${item.id}`} className={`ns-item${on ? ' on' : ''}`} aria-current={on ? 'page' : undefined} aria-label={item.label} onClick={onClose} {...tip(item.label)}>
        <Icon name={item.icon} size={18} /><span className="ns-lbl">{item.label}</span>
      </a>
    );
  };

  return (
    <>
      {mobileOpen && <div className="ns-scrim" onClick={onClose} aria-hidden="true" />}
      <aside id="app-sidebar" className={`ns${rail ? ' rail' : ''}${mobileOpen ? ' show' : ''}`} aria-label="Main navigation" aria-hidden={mobile && !mobileOpen ? true : undefined}>
        <div className="ns-head">
          <a href={`#/${BRAND.home}`} className="ns-brand" aria-label={`${BRAND.name} - go to Dashboard`} onClick={onClose} {...tip(BRAND.name)}>
            <span className="ns-logo"><Icon name={BRAND.icon} size={20} /></span>
            <span className="ns-lbl"><b>{BRAND.name}</b><small>{BRAND.subtitle}</small></span>
          </a>
          {mobile && <button type="button" className="ns-x" onClick={onClose} aria-label="Close navigation"><Icon name="x" size={18} /></button>}
        </div>

        <div className="ns-scroll">
          <div className="ns-quick">
            {!rail && (
              <button type="button" className="ns-gh" aria-expanded={quickOpen} aria-controls="ns-quick-body" onClick={() => setQuickOpen(!quickOpen)}>
                <span>Quick Actions</span><Icon name={quickOpen ? 'down' : 'right'} size={14} />
              </button>
            )}
            {(rail || quickOpen) && (
              <div id="ns-quick-body">
                <a href={`#/${QUICK_ACTION.id}`} className={`ns-cta${route === QUICK_ACTION.id ? ' on' : ''}`} aria-label={QUICK_ACTION.label} onClick={onClose} {...tip(QUICK_ACTION.label)}>
                  <Icon name="plus" size={18} /><span className="ns-lbl">{QUICK_ACTION.label}</span>
                </a>
              </div>
            )}
          </div>

          {NAV.map((g) => {
            const isOpen = open.has(g.id);
            const hasActive = active === g.id;
            return (
              <div key={g.id} className={`ns-group${hasActive ? ' has-active' : ''}`}>
                {!rail && (
                  <button type="button" className="ns-gh" aria-expanded={isOpen} aria-controls={`ns-g-${g.id}`} onClick={() => flip(g.id)}>
                    <span>{g.label}{hasActive && !isOpen && <i className="ns-dot" role="img" aria-label="contains the current page" />}</span>
                    <Icon name={isOpen ? 'down' : 'right'} size={14} />
                  </button>
                )}
                {(rail || isOpen) && <div id={`ns-g-${g.id}`} className="ns-items">{g.items.map(link)}</div>}
              </div>
            );
          })}
        </div>

        {!mobile && (
          <div className="ns-foot">
            <button type="button" className="ns-item ns-collapse" onClick={onToggle} disabled={tablet} aria-label={rail ? 'Expand sidebar' : 'Collapse sidebar'} {...tip(rail ? 'Expand sidebar' : 'Collapse sidebar')}>
              <Icon name="panel" size={18} /><span className="ns-lbl">Collapse sidebar</span>
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
