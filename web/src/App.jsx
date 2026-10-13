import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';
import { PropertyBar, useLoad } from './ui.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Properties from './pages/Properties.jsx';
import Tenants from './pages/Tenants.jsx';
import Accounts from './pages/Accounts.jsx';
import CreditNotes from './pages/CreditNotes.jsx';
import Vendors from './pages/Vendors.jsx';
import BillSchedule from './pages/BillSchedule.jsx';

const PAGES = { dashboard: Dashboard, properties: Properties, tenants: Tenants, accounts: Accounts, 'credit-notes': CreditNotes, vendors: Vendors, 'bill-schedule': BillSchedule };
const readHash = () => { const [h, q = ''] = window.location.hash.replace('#/', '').split('?'); return { route: PAGES[h] ? h : 'dashboard', params: Object.fromEntries(new URLSearchParams(q)) }; };
const store = { get: (k, d) => { try { return localStorage.getItem(k) || d; } catch { return d; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } } };

export default function App() {
  const [{ route, params }, setLoc] = useState(readHash());
  const [property, setProperty] = useState(store.get('rms.property', 'all'));
  const [period, setPeriod] = useState(store.get('rms.period', 'month'));
  const [toast, setToast] = useState('');
  const [version, setVersion] = useState(0);
  useEffect(() => { const f = () => setLoc(readHash()); window.addEventListener('hashchange', f); return () => window.removeEventListener('hashchange', f); }, []);
  const { data: props } = useLoad(() => api.get('/names'), [version]);
  const notify = useCallback((m) => { setToast(m); setTimeout(() => setToast(''), 2600); }, []);
  const refreshProps = useCallback(() => setVersion((v) => v + 1), []);
  const pickProperty = (v) => { setProperty(v); store.set('rms.property', v); };
  const pickPeriod = (v) => { setPeriod(v); store.set('rms.period', v); };
  const valid = property === 'all' || (props || []).some((p) => p.id === property) || !props;
  const prop = property === 'all' || !valid ? null : property;
  const Page = PAGES[route];
  const link = (r, label, extra = '') => <a className={`nav${extra}${route === r ? ' on' : ''}`} href={`#/${r}`}><b />{label}</a>;
  const soon = (label) => <span className="nav off"><b />{label}<em>Soon</em></span>;
  return (
    <>
      <div className="app">
        <aside className="side">
          <div className="brand"><i />Keystone</div>
          {link('dashboard', 'Dashboard')}{link('properties', 'Properties')}{link('tenants', 'Tenants')}
          {soon('Rent')}{link('credit-notes', 'Credit notes')}{link('vendors', 'Vendors')}{link('bill-schedule', 'Bill schedule')}{soon('Maintenance')}
          <span className="nav" style={{ cursor: 'default' }}><b />Financials</span>
          {link('accounts', 'Chart of accounts', ' subnav')}
          {soon('Documents')}{soon('Reports')}
        </aside>
        <main>
          <PropertyBar properties={props} property={prop || 'all'} onProperty={pickProperty} period={period} onPeriod={route === 'dashboard' ? pickPeriod : undefined} />
          <Page property={prop} period={period} notify={notify} refreshProps={refreshProps} params={params} />
        </main>
      </div>
      <nav className="tabbar" aria-label="Main">
        {[['dashboard', 'Home'], ['properties', 'Properties'], ['tenants', 'Tenants'], ['accounts', 'Accounts']].map(([r, l]) => <a key={r} href={`#/${r}`} className={route === r ? 'on' : ''}>{l}</a>)}
      </nav>
      {toast && <div className="toast" role="status">{toast}</div>}
    </>
  );
}
