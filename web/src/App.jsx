import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';
import { PropertyBar, useLoad } from './ui.jsx';
import Dashboard from './dashboard/Dashboard';
import './dashboard/dashboard.css';
import './shell/shell.css';
import Sidebar from './shell/Sidebar.jsx';
import TopBar from './shell/TopBar.jsx';
import Placeholder from './shell/Placeholder.jsx';
import { NAV_IDS } from './shell/navConfig.js';
import Properties from './properties/Properties';
import Invoices, { NewInvoice } from './invoices/Invoices';
import { InvoiceStoreProvider } from '@inv/store/InvoiceStore';
import Tenants from './tenants/Tenants';
import './tenants/tenants.css';
import Leases from './leases/Leases';
import Units from './units/Units';
import Payments from './payments/Payments';
import Expenses from './expenses/Expenses';
import Projects from './projects/Projects';
import MaintenanceRequests from './maintenance/Requests';
import WorkOrders from './maintenance/WorkOrders';
import Assets from './maintenance/Assets';
import Inspections from './maintenance/Inspections';
import Contractors from './maintenance/Contractors';
import { StoreProvider as MaintenanceStoreProvider } from './maintenance/store';
import { StoreProvider as ProjectsStoreProvider } from './projects/lib/store';
import { AppProvider as ExpensesProvider } from './expenses/context/AppContext';
import Applications from './applications/Applications';
import { StoreProvider as ApplicationsStoreProvider } from './applications/state/store';
import { PaymentsProvider } from './payments/store';
import { StoreProvider as UnitsStoreProvider } from './units/store/appStore';
import './leases/leases.css';
import DocumentCenter from './documents/DocumentCenter';
import FinancialReports from './reports/FinancialReports';
import OccupancyReports from './occupancy/OccupancyReports';
import PropertyPerformance from './performance/PropertyPerformance';
import ProjectReports from './projectreports/ProjectReports';
import Messages from './messaging/Messages';
import WorkflowAutomation from './automation/WorkflowAutomation';
import MessageTemplates from './msgtemplates/MessageTemplates';
import Banks from './banks/Banks';
import BankReconciliation from './bankrecon/BankReconciliation';
import Deposits from './deposits/Deposits';
import ChartOfAccounts from './accounting/Accounting';
import { ChartProvider } from './accounting/store/chart-store';
import CreditNotes from './pages/CreditNotes.jsx';
import BillSchedule from './pages/BillSchedule.jsx';

const PAGES = { dashboard: Dashboard, tenants: Tenants, leases: Leases, units: Units, payments: Payments, expenses: Expenses, projects: Projects, applications: Applications, properties: Properties, invoices: Invoices, 'invoice-new': NewInvoice, accounts: ChartOfAccounts, documents: DocumentCenter, 'financial-reports': FinancialReports, 'occupancy-reports': OccupancyReports, 'property-performance': PropertyPerformance, 'project-reports': ProjectReports, deposits: Deposits, 'bank-reconciliation': BankReconciliation, banks: Banks, messages: Messages, 'message-templates': MessageTemplates, workflows: WorkflowAutomation, 'credit-notes': CreditNotes, vendors: Contractors, 'maintenance-requests': MaintenanceRequests, 'work-orders': WorkOrders, assets: Assets, inspections: Inspections, 'bill-schedule': BillSchedule };
const readHash = () => { const [h, q = ''] = window.location.hash.replace('#/', '').split('?'); return { route: PAGES[h] || NAV_IDS.includes(h) ? h : 'dashboard', params: Object.fromEntries(new URLSearchParams(q)) }; };
const store = { get: (k, d) => { try { return localStorage.getItem(k) || d; } catch { return d; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } } };

export default function App() {
  const [{ route, params }, setLoc] = useState(readHash());
  const [property, setProperty] = useState(store.get('rms.property', 'all'));
  const [period, setPeriod] = useState(store.get('rms.period', 'month'));
  const [toast, setToast] = useState('');
  const [collapsed, setCollapsed] = useState(store.get('rms.navCollapsed', '0') === '1');
  const [drawer, setDrawer] = useState(false);
  const [theme, setTheme] = useState(document.documentElement.dataset.theme === 'light' ? (document.documentElement.dataset.accent === 'blue' ? 'blue' : 'light') : 'dark');
  const pickTheme = useCallback((t) => { setTheme(t); const root = document.documentElement; root.dataset.theme = t === 'dark' ? 'dark' : 'light'; if (t === 'blue') root.dataset.accent = 'blue'; else delete root.dataset.accent; store.set('rms.theme', t); }, []);
  const closeDrawer = useCallback(() => setDrawer(false), []);
  const [version, setVersion] = useState(0);
  useEffect(() => { const f = () => setLoc(readHash()); window.addEventListener('hashchange', f); return () => window.removeEventListener('hashchange', f); }, []);
  const flush = route === 'tenants' || route === 'leases' || route === 'units' || route === 'payments' || route === 'expenses' || route === 'projects' || route === 'maintenance-requests' || route === 'work-orders' || route === 'assets' || route === 'inspections' || route === 'vendors' || route === 'applications' || route === 'dashboard' || route === 'properties' || route === 'invoices' || route === 'invoice-new' || route === 'accounts' || route === 'documents' || route === 'financial-reports' || route === 'occupancy-reports' || route === 'property-performance' || route === 'project-reports' || route === 'deposits' || route === 'bank-reconciliation' || route === 'banks' || route === 'messages' || route === 'message-templates' || route === 'workflows'; // the Tenants page lays itself out edge to edge and has its own filters
  // the property list only feeds the property bar, which flush pages do not show, so those pages never call the API for it
  const { data: props } = useLoad(() => (flush ? Promise.resolve(null) : api.get('/names')), [version, flush]);
  const notify = useCallback((m) => { setToast(m); setTimeout(() => setToast(''), 2600); }, []);
  const refreshProps = useCallback(() => setVersion((v) => v + 1), []);
  const pickProperty = (v) => { setProperty(v); store.set('rms.property', v); };
  const pickPeriod = (v) => { setPeriod(v); store.set('rms.period', v); };
  const valid = property === 'all' || (props || []).some((p) => p.id === property) || !props;
  const prop = property === 'all' || !valid ? null : property;
  const Page = PAGES[route];
  return (
    <InvoiceStoreProvider>
    <ChartProvider>
    <UnitsStoreProvider>
    <PaymentsProvider>
    <ExpensesProvider>
    <ProjectsStoreProvider>
    <MaintenanceStoreProvider>
    <ApplicationsStoreProvider>
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
    </ApplicationsStoreProvider>
    </MaintenanceStoreProvider>
    </ProjectsStoreProvider>
    </ExpensesProvider>
    </PaymentsProvider>
    </UnitsStoreProvider>
    </ChartProvider>
    </InvoiceStoreProvider>
  );
}
