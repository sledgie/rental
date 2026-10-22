import { useState } from 'react';
import { Archive, Banknote, BarChart3, FileUp, History, LayoutDashboard, Link2, ListX, Play, RotateCcw, Settings2 } from 'lucide-react';
import { Button as TnButton, Overlay } from '../tenants/components/ui';
import { StoreProvider, useStore } from './lib/store';
import { RouteContext, buildHash, routeFromParams, type ReconRoute } from './shim/route';
import { StartReconModal } from './components/recon/StartReconModal';
import Dashboard from './pages/Dashboard';
import Matching from './pages/Matching';
import Unmatched from './pages/Unmatched';
import HistoryPage from './pages/History';
import HistoryDetail from './pages/HistoryDetail';
import Reports from './pages/Reports';
import Imports from './pages/Imports';
import Settings from './pages/Settings';
import Workspace from './pages/Workspace';
import './bankrecon.css';

const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'matching', label: 'Matching', icon: Link2 },
  { id: 'unmatched', label: 'Unmatched', icon: ListX },
  { id: 'history', label: 'History', icon: History },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
  { id: 'imports', label: 'Imports & mapping', icon: FileUp },
  { id: 'settings', label: 'Settings', icon: Settings2 },
];

const VIEWS: Record<string, () => JSX.Element> = {
  dashboard: Dashboard,
  matching: Matching,
  unmatched: Unmatched,
  history: HistoryPage,
  reports: Reports,
  imports: Imports,
  settings: Settings,
};

function Page({ route }: { route: ReconRoute }) {
  const { state, user, setUser, resetDemo } = useStore();
  const [startOpen, setStartOpen] = useState(false);
  const View = VIEWS[route.tab] || Dashboard;
  const goTab = (tab: string) => { window.location.hash = buildHash({ tab }); };
  const closeOverlay = () => { window.location.hash = buildHash({ tab: route.tab, query: route.query }); };

  return (
    <div className="tn br">
      <div className="app-shell">
        <div className="main-shell">
          <main className="main-content">
            <div className="page-heading">
              <div>
                <div className="page-title-line">
                  <h1>Bank Reconciliation</h1>
                  <span className="muted">Simulated bank data</span>
                </div>
                <p>Compare bank statements against accounting records, investigate differences and finalize monthly reconciliations.</p>
              </div>
              <div className="page-heading-actions no-print">
                <TnButton variant="primary" onClick={() => setStartOpen(true)}><Play size={15} />Start reconciliation</TnButton>
              </div>
            </div>

            <section className="directory-panel" aria-label="Bank reconciliation">
              <div className="directory-tabs no-print" aria-label="Reconciliation views">
                {TABS.map((t) => {
                  const Icon = t.icon;
                  return (
                    <button key={t.id} type="button" className={`directory-tab ${!route.ws && route.tab === t.id ? 'selected' : ''}`} aria-pressed={!route.ws && route.tab === t.id} onClick={() => goTab(t.id)}>
                      <Icon size={14} />{t.label}
                    </button>
                  );
                })}
              </div>
              <div className="directory-toolbar no-print">
                <span className="br-period"><Archive size={13} style={{ verticalAlign: -2, marginRight: 5 }} />{state.accounts.length} bank accounts · demonstration data</span>
                <div className="toolbar-actions">
                  <TnButton onClick={() => { window.location.hash = '#/banks'; }}><Banknote size={14} />Manage banks</TnButton>
                  <label className="br-role">
                    Viewing as
                    <select value={user.id} onChange={(e) => setUser(e.target.value)}>
                      {state.users.map((u) => <option key={u.id} value={u.id}>{u.name} · {u.role}</option>)}
                    </select>
                  </label>
                  <TnButton onClick={() => { if (window.confirm('Reset all reconciliation demo data to its original state?')) resetDemo(); }}><RotateCcw size={14} />Reset demo</TnButton>
                </div>
              </div>
              <div className="u-root br-body">
                {route.ws ? (
                  <div className="space-y-4">
                    <div><button type="button" className="br-back" onClick={closeOverlay}>← Back to {TABS.find((t) => t.id === route.tab)?.label ?? 'dashboard'}</button></div>
                    <Workspace accountId={route.ws} />
                  </div>
                ) : (
                  <View />
                )}
              </div>
            </section>

            <div className="directory-footnote no-print">
              <span>Demonstration data is stored in this browser only. No bank connection exists and no funds move.</span>
            </div>
          </main>
        </div>
      </div>

      {route.detail && (
        <Overlay title="Reconciliation record" subtitle="Summary, matches, adjustments and audit trail" drawer wide onClose={closeOverlay} className="br-drawer">
          <div className="u-drawer-scroll">
            <div className="u-root"><HistoryDetail id={route.detail} /></div>
          </div>
        </Overlay>
      )}

      <div className="u-root">
        <StartReconModal open={startOpen} onClose={() => setStartOpen(false)} />
      </div>
    </div>
  );
}

export default function BankReconciliation({ params }: { params?: Record<string, string> }) {
  const route = routeFromParams(params);
  return (
    <StoreProvider>
      <RouteContext.Provider value={route}>
        <Page route={route} />
      </RouteContext.Provider>
    </StoreProvider>
  );
}
