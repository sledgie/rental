import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';
import { PropertyBar, useLoad } from './ui.jsx';
import Dashboard from './dashboard/Dashboard';
import './dashboard/dashboard.css';
import Tenants from './tenants/TenantsPage.jsx';
import './shell/shell.css';
import Sidebar from './shell/Sidebar.jsx';
import TopBar from './shell/TopBar.jsx';
import Placeholder from './shell/Placeholder.jsx';
import { NAV_IDS } from './shell/navConfig.js';
import Properties from './properties/Properties';
import Invoices, { NewInvoice } from './invoices/Invoices';
import { InvoiceStoreProvider } from '@inv/store/InvoiceStore';
import Accounts from './pages/Accounts.jsx';
import CreditNotes from './pages/CreditNotes.jsx';
import Vendors from './pages/Vendors.jsx';
import BillSchedule from './pages/BillSchedule.jsx';

const PAGES = { dashboard: Dashboard, properties: Properties, invoices: Invoices, 'invoice-new': NewInvoice, tenants: Tenants, accounts: Accounts, 'credit-notes': CreditNotes, vendors: Vendors, 'bill-schedule': BillSchedule };
const readHash = () => { const [h, q = ''] = window.location.hash.replace('#/', '').split('?'); return { route: PAGES[h] || NAV_IDS.includes(h) ? h : 'dashboard', params: Object.fromEntries(new URLSearchParams(q)) }; };
const store = { get: (k, d) => { try { return localStorage.getItem(k) || d; } catch { return d; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } } };

export default function App() {
  const [{ route, params }, setLoc] = useState(readHash());
  const [property, setProperty] = useState(store.get('rms.property', 'all'));
  const [period, setPeriod] = useState(store.get('rms.period', 'month'));
  const [toast, setToast] = useState('');
  const [collapsed, setCollapsed] = useState(store.get('rms.navCollapsed', '0') === '1');
  const [drawer, setDrawer] = useState(false);
  const [theme, setTheme] = useState(document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');
  const pickTheme = useCallback((t) => { setTheme(t); document.documentElement.dataset.theme = t; store.set('rms.theme', t); }, []);
  const closeDrawer = useCallback(() => setDrawer(false), []);
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
  const flush = route === 'tenants' || route === 'dashboard' || route === 'properties' || route === 'invoices' || route === 'invoice-new'; // the Tenants page lays itself out edge to edge and has its own filters
  return (
    <InvoiceStoreProvider>
      <div className="tv-app">
        <Sidebar route={route} collapsed={collapsed} onToggle={() => { setCollapsed(!collapsed); store.set('rms.navCollapsed', collapsed ? '0' : '1'); }} mobileOpen={drawer} onClose={closeDrawer} />
        <div className="tv-col">
          <TopBar notify={notify} theme={theme} onTheme={pickTheme} onMenu={() => setDrawer(true)} menuOpen={drawer} />
          <main className={`tv-main-wrap${flush ? ' flush' : ''}`}>
            {!flush && PAGES[route] && <PropertyBar properties={props} property={prop || 'all'} onProperty={pickProperty} period={period} onPeriod={route === 'dashboard' ? pickPeriod : undefined} />}
            {Page ? <Page property={prop} period={period} notify={notify} refreshProps={refreshProps} params={params} /> : <Placeholder id={route} />}
          </main>
        </div>
      </div>
      {toast && <div className="toast" role="status">{toast}</div>}
    </InvoiceStoreProvider>
  );
}
