// Page toolbar: quick-view toggle + title on the left; filters, Add Tenant split button and table settings on the right.
import { Icon } from '../icons.jsx';
import { AddFilters } from './FilterBuilder.jsx';
import { MenuItem, Pop } from './Pop.jsx';

export default function Toolbar({ title, count, quickOpen, onQuick, onAddFilter, onAdd, onSettings }) {
  return (
    <div className="tv-toolbar">
      <div className="tv-tl">
        <button type="button" className={`tv-ibtn lg${quickOpen ? ' on' : ''}`} aria-pressed={quickOpen} aria-label="Toggle quick view panel" title="Quick view" onClick={onQuick}><Icon name="panel" size={16} /></button>
        <h1 className="tv-title">{title} <span>({count})</span></h1>
      </div>
      <div className="tv-tr">
        <AddFilters onAdd={onAddFilter} />
        <span className="tv-split">
          <button type="button" className="tv-btn pri" onClick={() => onAdd(undefined)}><Icon name="plus" size={14} /> Add Tenant</button>
          <Pop align="right" width={180} trigger={({ toggle }) => <button type="button" className="tv-btn pri caret" aria-label="More ways to add a tenant" onClick={toggle}><Icon name="down" size={12} /></button>}>
            {(close) => [['primary', 'Primary Tenant'], ['co_tenant', 'Co-tenant'], ['occupant', 'Occupant']].map(([k, l]) => <MenuItem key={k} onClick={() => { close(); onAdd(k); }}>{l}</MenuItem>)}
          </Pop>
        </span>
        <button type="button" className="tv-ibtn lg" aria-label="Customize table" title="Customize table" onClick={onSettings}><Icon name="sliders" size={16} /></button>
      </div>
    </div>
  );
}
