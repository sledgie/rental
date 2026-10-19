// Right-hand drawer: choose which columns show and in what order.
import { Icon } from '../icons.jsx';
import { COL } from './columns.js';

export default function CustomizeTableDrawer({ cols, onCols, onReset, onClose }) {
  const set = (key, p) => onCols(cols.map((s) => (s.key === key ? { ...s, ...p } : s)));
  const shift = (i, d) => { const n = [...cols]; const j = i + d; if (j < 0 || j >= n.length) return; [n[i], n[j]] = [n[j], n[i]]; onCols(n); };
  return (
    <div className="tv-drawer" role="dialog" aria-label="Customize table">
      <div className="tv-dhead"><b>Customize Table</b><button type="button" className="tv-ibtn" aria-label="Close" onClick={onClose}><Icon name="x" size={14} /></button></div>
      <div className="tv-dbody">
        <p className="tv-hint">Tick the columns to show. Use the arrows to change their order. Drag headers or the edges of a header on the table to reorder and resize.</p>
        {cols.map((s, i) => {
          const c = COL[s.key];
          return (
            <div className="tv-crow" key={s.key}>
              <label><input type="checkbox" checked={s.visible} disabled={c.alwaysVisible} onChange={(e) => set(s.key, { visible: e.target.checked })} /> {c.label}<small>{c.group === 'Tenant Fields' ? 'Tenant' : 'Property'}</small></label>
              <span>
                <button type="button" className="tv-ibtn" aria-label={`Move ${c.label} up`} disabled={i === 0} onClick={() => shift(i, -1)}><Icon name="up" size={12} /></button>
                <button type="button" className="tv-ibtn" aria-label={`Move ${c.label} down`} disabled={i === cols.length - 1} onClick={() => shift(i, 1)}><Icon name="down" size={12} /></button>
              </span>
            </div>
          );
        })}
      </div>
      <div className="tv-dfoot"><button type="button" className="tv-btn" onClick={onReset}>Reset to default</button><button type="button" className="tv-btn pri" onClick={onClose}>Done</button></div>
    </div>
  );
}
