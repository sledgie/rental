// Top bar: global tenant search, quick-create menu, and the help / mail / notifications / account buttons.
import { useState } from 'react';
import { useTenantDb, searchTenants } from '../tenants/store';
import { Icon } from '../icons.jsx';
import { MenuItem, Pop } from './Pop.jsx';
import { useAuth } from '../auth/contexts/AuthContext';
import { useOrganization } from '../auth/contexts/OrganizationContext';
import NotificationBell from '../notificationcenter/NotificationBell';
import { useAvatarUrl } from '../auth/lib/avatar';

const RECORDS = [['Tenant', '#/tenants?new=1'], ['Property', '#/properties?new=1'], ['Vendor', '#/vendors']];
const ACTIVITIES = [['Invoice', null], ['Payments', null], ['Credit Notes', '#/credit-notes'], ['Bill Schedules', '#/bill-schedule']];

function Search() {
  const [q, setQ] = useState(''); const [open, setOpen] = useState(false);
  const [db] = useTenantDb();
  const t = q.trim();
  const hits = t ? searchTenants(db, t).slice(0, 8) : [];
  return (
    <div className="tv-search">
      <Icon name="search" size={15} />
      <input type="search" value={q} placeholder="Search By Name, Phone Number, Email" aria-label="Search tenants by name, phone number or email"
        onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)} onChange={(e) => { setQ(e.target.value); setOpen(true); }} />
      {open && t && (
        <div className="tv-results">
          {hits.map((x) => <a key={x.id} href={`#/tenants?tenant=${x.id}`} onClick={() => { setQ(''); setOpen(false); }}><b>{x.firstName} {x.lastName}</b><span>{[x.phone, x.email].filter(Boolean).join(' \u00b7 ') || 'No contact details'}</span></a>)}
          {!hits.length && <div className="tv-empty">No tenants match &ldquo;{t}&rdquo;.</div>}
        </div>
      )}
    </div>
  );
}

export default function TopBar({ notify, onMenu, menuOpen }) {
  const { user, signOut } = useAuth();
  const { activeOrganization, activeRole, workspaces } = useOrganization();
  const soon = (what) => () => notify(`${what} is not available yet.`);
  const avatarUrl = useAvatarUrl(user?.avatarPath);
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
        <NotificationBell notify={notify} />
        <Pop align="right" width={230} trigger={({ toggle }) => <button type="button" className="tv-avatar" aria-label="Account menu" onClick={toggle}>{avatarUrl ? <img src={avatarUrl} alt="" style={{ width: '100%', height: '100%', borderRadius: 'inherit', objectFit: 'cover' }} /> : <Icon name="user" size={16} />}</button>}>
          {(close) => (
            <>
              {user && <div className="tv-gh" style={{ textTransform: 'none' }}>{user.fullName}<br /><span style={{ fontWeight: 400 }}>{activeOrganization?.name}{activeRole ? ` · ${activeRole}` : ''}</span></div>}
              <div className="tv-sep" />
              <MenuItem onClick={() => { close(); window.location.hash = '#/system-settings?cat=personal&anchor=personal-account'; }}>My profile &amp; photo</MenuItem>
              <MenuItem onClick={() => { close(); window.location.hash = '#/system-settings?cat=personal'; }}>Personal preferences</MenuItem>
              <MenuItem onClick={() => { close(); window.location.hash = '#/organization'; }}>Organization settings</MenuItem>
              {workspaces.length > 1 && <MenuItem onClick={() => { close(); window.location.hash = '#/organizations/select'; }}>Switch organization</MenuItem>}
              <div className="tv-sep" />
              <MenuItem onClick={async () => { close(); await signOut(); window.location.hash = '#/login'; }}>Sign out</MenuItem>
            </>
          )}
        </Pop>
      </div>
    </header>
  );
}
