// Top bar: global tenant search, quick-create menu, and the help / mail / notifications / account buttons.
import { useRef, useState } from 'react';
import { api } from '../api.js';
import { Icon } from '../icons.jsx';
import { MenuItem, Pop } from '../tenants/Pop.jsx';

const RECORDS = [['Tenant', '#/tenants?new=1'], ['Property', '#/properties?new=1'], ['Vendor', '#/vendors']];
const ACTIVITIES = [['Invoice', null], ['Payments', null], ['Credit Notes', '#/credit-notes'], ['Bill Schedules', '#/bill-schedule']];

function Search() {
  const [q, setQ] = useState(''); const [list, setList] = useState(null); const [open, setOpen] = useState(false); const loaded = useRef(false);
  const load = () => { if (loaded.current) return; loaded.current = true; api.get('/tenants').then(setList).catch(() => { loaded.current = false; }); };
  const t = q.trim().toLowerCase();
  const hits = t && list ? list.filter((x) => `${x.first} ${x.last} ${x.phone || ''} ${x.email || ''}`.toLowerCase().includes(t)).slice(0, 8) : [];
  return (
    <div className="tv-search">
      <Icon name="search" size={15} />
      <input type="search" value={q} placeholder="Search By Name, Phone Number, Email" aria-label="Search tenants by name, phone number or email"
        onFocus={() => { load(); setOpen(true); }} onBlur={() => setTimeout(() => setOpen(false), 150)} onChange={(e) => { setQ(e.target.value); setOpen(true); }} />
      {open && t && (
        <div className="tv-results">
          {hits.map((x) => <a key={x.id} href={`#/tenants?tenant=${x.id}`} onClick={() => { setQ(''); setOpen(false); }}><b>{x.first} {x.last}</b><span>{[x.phone, x.email].filter(Boolean).join(' · ') || 'No contact details'}</span></a>)}
          {list && !hits.length && <div className="tv-empty">No tenants match &ldquo;{q.trim()}&rdquo;.</div>}
          {!list && <div className="tv-empty">Searching...</div>}
        </div>
      )}
    </div>
  );
}

export default function TopBar({ notify, onMenu, menuOpen, theme, onTheme }) {
  const soon = (what) => () => notify(`${what} is not available yet.`);
  return (
    <header className="tv-top">
      <button type="button" className="tv-ibtn lg tv-menu-btn" onClick={onMenu} aria-label="Open navigation" aria-expanded={!!menuOpen} aria-controls="app-sidebar"><Icon name="menu" size={20} /></button>
      <Search />
      <div className="tv-topr">
        <Pop align="right" width={300} trigger={({ toggle }) => <button type="button" className="tv-plus" aria-label="Quick create" title="Quick create" onClick={toggle}><Icon name="plus" size={18} /></button>}>
          {(close) => (
            <div className="tv-cols2">
              <div><div className="tv-gh">Add Records</div>{RECORDS.map(([l, h]) => <MenuItem key={l} onClick={() => { close(); window.location.hash = h; }}>{l}</MenuItem>)}</div>
              <div><div className="tv-gh">Add Activities</div>{ACTIVITIES.map(([l, h]) => <MenuItem key={l} disabled={!h} title={h ? undefined : 'Coming soon'} onClick={() => { close(); window.location.hash = h; }}>{l}</MenuItem>)}</div>
            </div>
          )}
        </Pop>
        <button type="button" className="tv-ibtn lg" aria-label="Help" title="Help" onClick={soon('Help')}><Icon name="help" size={17} /></button>
        <button type="button" className="tv-ibtn lg" aria-label="Compose email" title="Email" onClick={soon('Email')}><Icon name="mail" size={17} /></button>
        <button type="button" className="tv-ibtn lg" aria-label="Notifications" title="Notifications" onClick={soon('Notifications')}><Icon name="bell" size={17} /></button>
        <Pop align="right" width={200} trigger={({ toggle }) => <button type="button" className="tv-avatar" aria-label="Account menu" onClick={toggle}><Icon name="user" size={16} /></button>}>
          {(close) => (
            <>
              <div className="tv-gh">Theme</div>
              {[['dark', 'Dark theme'], ['light', 'Light theme']].map(([t, label]) => (
                <button key={t} type="button" role="menuitemradio" aria-checked={theme === t} className="tv-mi" onClick={() => { onTheme(t); close(); }}>
                  <span style={{ flex: 1 }}>{label}</span>{theme === t && <Icon name="check" size={14} />}
                </button>
              ))}
              <div className="tv-sep" />
              <MenuItem disabled title="Coming soon" onClick={close}>Profile</MenuItem>
              <MenuItem disabled title="Coming soon" onClick={close}>Sign out</MenuItem>
            </>
          )}
        </Pop>
      </div>
    </header>
  );
}
