// The ▾ menu on each grid header: pin, add a column to the left/right, sort, hide.
import { useState } from 'react';
import { Icon } from '../icons.jsx';
import { COL, COLUMNS } from './columns.js';
import { MenuItem, Pop } from './Pop.jsx';

// Searchable list of fields that are not on the grid; picking one shows it next to `anchor`.
function Picker({ cols, side, anchor, onAdd, onBack }) {
  const [q, setQ] = useState('');
  const hidden = COLUMNS.filter((c) => !cols.find((s) => s.key === c.key)?.visible && c.label.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <div className="tv-picker">
      <button type="button" className="tv-back-btn" onClick={onBack}><Icon name="left" size={13} /> Add column to {side}</button>
      <input className="tv-in" autoFocus placeholder="Search fields" value={q} onChange={(e) => setQ(e.target.value)} />
      {['Tenant Fields', 'Property Fields'].map((g) => {
        const list = hidden.filter((c) => c.group === g);
        return list.length ? <div key={g}><div className="tv-gh">{g}</div>{list.map((c) => <MenuItem key={c.key} onClick={() => onAdd(c.key, anchor, side)}>{c.label}</MenuItem>)}</div> : null;
      })}
      {!hidden.length && <div className="tv-empty">No more fields to add.</div>}
    </div>
  );
}

export default function ColumnMenu({ col, cols, sort, onSort, onPin, onHide, onAdd }) {
  const [view, setView] = useState('main');
  const def = COL[col.key]; const sorted = sort.key === col.key ? sort.dir : null;
  return (
    <Pop width={230} className="tv-colmenu" trigger={({ toggle }) => <button type="button" className="tv-hbtn" aria-label={`${def.label} column menu`} onClick={() => { setView('main'); toggle(); }}><Icon name="down" size={12} /></button>}>
      {(close) => view === 'main' ? (
        <>
          <MenuItem onClick={() => setView('pin')}>Pin Column <Icon name="right" size={12} style={{ marginLeft: 'auto' }} /></MenuItem>
          <MenuItem onClick={() => setView('right')}>Add Column to Right</MenuItem>
          <MenuItem onClick={() => setView('left')}>Add Column to Left</MenuItem>
          <div className="tv-sep" />
          <MenuItem onClick={() => { onSort(col.key, 'asc'); close(); }}>Sort Ascending{sorted === 'asc' ? ' ✓' : ''}</MenuItem>
          <MenuItem onClick={() => { onSort(col.key, 'desc'); close(); }}>Sort Descending{sorted === 'desc' ? ' ✓' : ''}</MenuItem>
          <div className="tv-sep" />
          <MenuItem disabled={def.alwaysVisible} title={def.alwaysVisible ? 'The Name column is always shown.' : undefined} onClick={() => { onHide(col.key); close(); }}>Hide Column</MenuItem>
        </>
      ) : view === 'pin' ? (
        <>
          <button type="button" className="tv-back-btn" onClick={() => setView('main')}><Icon name="left" size={13} /> Pin Column</button>
          <MenuItem onClick={() => { onPin(col.key, 'left'); close(); }}>Pin to left{col.pin === 'left' ? ' ✓' : ''}</MenuItem>
          <MenuItem onClick={() => { onPin(col.key, 'right'); close(); }}>Pin to right{col.pin === 'right' ? ' ✓' : ''}</MenuItem>
          {col.pin && <MenuItem onClick={() => { onPin(col.key, null); close(); }}>Unpin</MenuItem>}
        </>
      ) : <Picker cols={cols} side={view} anchor={col.key} onBack={() => setView('main')} onAdd={(k, a, s) => { onAdd(k, a, s); close(); }} />}
    </Pop>
  );
}
