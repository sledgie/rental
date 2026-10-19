// Left panel: tenant views with counts, and the saved searches.
import { useState } from 'react';
import { Icon } from '../icons.jsx';

export const VIEWS = [['all', 'All Tenants'], ['active', 'Active Tenants'], ['applicant', 'Applicants'], ['pending_in', 'Pending Move-in'], ['pending_out', 'Pending Move-out'], ['past', 'Past Tenants']];

function Section({ title, children }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="tv-qsec">
      <button type="button" className="tv-qhead" aria-expanded={open} onClick={() => setOpen(!open)}><Icon name={open ? 'down' : 'right'} size={12} /> {title}</button>
      {open && children}
    </div>
  );
}

export default function QuickViewPanel({ view, onView, counts, saved, activeSaved, onApplySaved, onDeleteSaved }) {
  return (
    <aside className="tv-quick" aria-label="Quick view">
      <Section title="Tenant View">
        {VIEWS.map(([k, label]) => (
          <button key={k} type="button" className={`tv-qitem${view === k && !activeSaved ? ' on' : ''}`} aria-current={view === k && !activeSaved ? 'true' : undefined} onClick={() => onView(k)}>
            <span>{label}</span><em>{counts[k] ?? 0}</em>
          </button>
        ))}
      </Section>
      <Section title="Saved Searches">
        {!saved.length && <div className="tv-empty">Add filters, then choose Save Search.</div>}
        {saved.map((s) => (
          <div key={s.id} className={`tv-qitem${activeSaved === s.id ? ' on' : ''}`}>
            <button type="button" className="tv-qlink" onClick={() => onApplySaved(s)}>{s.name}</button>
            <button type="button" className="tv-ibtn" aria-label={`Delete saved search ${s.name}`} onClick={() => onDeleteSaved(s.id)}><Icon name="x" size={12} /></button>
          </div>
        ))}
      </Section>
    </aside>
  );
}
