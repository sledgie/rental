// "Add Filters" popover (pick a field) and the chip row shown under the toolbar (operator + value per chip).
import { useState } from 'react';
import { Icon } from '../icons.jsx';
import { COL, COLUMNS } from './columns.js';
import { NO_VALUE, OPS, newFilter } from './filters.js';
import { MenuItem, Pop } from './Pop.jsx';

export function AddFilters({ onAdd }) {
  const [q, setQ] = useState('');
  return (
    <Pop width={260} trigger={({ toggle, open }) => <button type="button" className={`tv-btn${open ? ' on' : ''}`} onClick={() => { setQ(''); toggle(); }}><Icon name="filter" size={14} /> Add Filters</button>}>
      {(close) => (
        <div className="tv-picker">
          <input className="tv-in" autoFocus placeholder="Search fields" aria-label="Search filter fields" value={q} onChange={(e) => setQ(e.target.value)} />
          {['Tenant Fields', 'Property Fields'].map((g) => {
            const list = COLUMNS.filter((c) => c.group === g && c.label.toLowerCase().includes(q.trim().toLowerCase()));
            return list.length ? <div key={g}><div className="tv-gh">{g}</div>{list.map((c) => <MenuItem key={c.key} onClick={() => { onAdd(newFilter(c.key)); close(); }}>{c.label}</MenuItem>)}</div> : null;
          })}
        </div>
      )}
    </Pop>
  );
}

function ValueInput({ f, c, set }) {
  const type = c.type === 'date' ? 'date' : c.type === 'money' || c.type === 'number' ? 'number' : 'text';
  const step = c.type === 'money' ? '0.01' : undefined;
  if (c.type === 'enum') {
    return <select className="tv-in sm" aria-label={`${c.label} value`} value={f.value} onChange={(e) => set({ value: e.target.value })}><option value="">Choose...</option>{c.options.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>;
  }
  return (
    <>
      <input className="tv-in sm" type={type} step={step} aria-label={`${c.label} value`} value={f.value} placeholder="Value" onChange={(e) => set({ value: e.target.value })} />
      {f.op === 'between' && <><span className="tv-and">and</span><input className="tv-in sm" type={type} step={step} aria-label={`${c.label} upper value`} value={f.value2} onChange={(e) => set({ value2: e.target.value })} /></>}
    </>
  );
}

export function FilterChips({ filters, onChange, onClear, onSave }) {
  const [naming, setNaming] = useState(false); const [name, setName] = useState('');
  if (!filters.length) return null;
  const set = (id, p) => onChange(filters.map((f) => (f.id === id ? { ...f, ...p } : f)));
  const save = () => { if (name.trim()) { onSave(name.trim()); setNaming(false); setName(''); } };
  return (
    <div className="tv-chips">
      {filters.map((f) => {
        const c = COL[f.field];
        return (
          <span className="tv-chip" key={f.id}>
            <b>{c.label}</b>
            <select className="tv-in sm" aria-label={`${c.label} operator`} value={f.op} onChange={(e) => set(f.id, { op: e.target.value, value2: '' })}>{OPS[c.type].map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
            {!NO_VALUE.has(f.op) && <ValueInput f={f} c={c} set={(p) => set(f.id, p)} />}
            <button type="button" className="tv-ibtn" aria-label={`Remove ${c.label} filter`} onClick={() => onChange(filters.filter((x) => x.id !== f.id))}><Icon name="x" size={12} /></button>
          </span>
        );
      })}
      <button type="button" className="tv-linkbtn" onClick={onClear}>Clear all</button>
      {naming ? (
        <span className="tv-chip"><input className="tv-in sm" autoFocus placeholder="Name this search" aria-label="Saved search name" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setNaming(false); }} />
          <button type="button" className="tv-btn sm pri" onClick={save}>Save</button><button type="button" className="tv-btn sm" onClick={() => setNaming(false)}>Cancel</button></span>
      ) : <button type="button" className="tv-linkbtn" onClick={() => setNaming(true)}>Save Search</button>}
    </div>
  );
}
