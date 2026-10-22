import { useEffect, useState } from 'react';
import { BarChart3, ClipboardCheck, FileText, HandCoins, LayoutDashboard, Landmark, ListChecks, Percent, Plus, Settings2, Undo2 } from 'lucide-react';
import { Button as TnButton, Overlay } from '../tenants/components/ui';
import { AsyncView } from './shim/react';
import { RouteContext, buildHash, routeFromParams, useVersion, type DepositsRoute } from './shim/store';
import { ensureSeeded } from './db/seed';
import { getCurrentUser, getStaffList } from './lib/session';
import { setUserAction } from './lib/deposits/actions';
import { ROLES } from './lib/deposits/domain';
import DepositsOverview from './app/deposits/page';
import DepositRegisterPage from './app/deposits/register/page';
import CollectionPage from './app/deposits/collection/page';
import ApplicationPage from './app/deposits/application/page';
import RefundsPage from './app/deposits/refunds/page';
import InterestPage from './app/deposits/interest/page';
import ReconciliationPage from './app/deposits/reconciliation/page';
import ReportsPage from './app/deposits/reports/page';
import ConfigurationPage from './app/deposits/configuration/page';
import CreateDepositPage from './app/deposits/new/page';
import DepositDetailPage from './app/deposits/[id]/page';
import './deposits.css';

type Query = Promise<Record<string, string | string[] | undefined>>;
const VIEW_PAGES: Record<string, (props: { searchParams: Query }) => Promise<any>> = {
  overview: DepositsOverview as any,
  register: DepositRegisterPage as any,
  collection: CollectionPage as any,
  application: ApplicationPage as any,
  refunds: RefundsPage as any,
  interest: InterestPage as any,
  reconciliation: ReconciliationPage as any,
  reports: ReportsPage as any,
  configuration: ConfigurationPage as any,
};

const TABS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'register', label: 'Register', icon: ListChecks },
  { id: 'collection', label: 'Collection', icon: HandCoins },
  { id: 'application', label: 'Applications', icon: FileText },
  { id: 'refunds', label: 'Refunds', icon: Undo2 },
  { id: 'interest', label: 'Interest', icon: Percent },
  { id: 'reconciliation', label: 'Reconciliation', icon: ClipboardCheck },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
  { id: 'configuration', label: 'Configuration', icon: Settings2 },
];

/** Replaces the original sidebar "signed in as" switch: lets you view the module as each staff role. */
function RoleSwitch() {
  const version = useVersion();
  const [staff, setStaff] = useState<{ id: string; name: string; role: string }[]>([]);
  const [current, setCurrent] = useState('');
  useEffect(() => {
    let live = true;
    (async () => {
      await ensureSeeded();
      const [rows, user] = await Promise.all([getStaffList(), getCurrentUser()]);
      if (live) {
        setStaff(rows);
        setCurrent(user.id);
      }
    })();
    return () => { live = false; };
  }, [version]);
  if (staff.length === 0) return null;
  const roleLabel = (code: string) => ROLES.find((r) => r.code === code)?.label ?? code;
  return (
    <label className="dp-role">
      Viewing as
      <select
        value={current}
        onChange={(e) => {
          const fd = new FormData();
          fd.set('staffId', e.target.value);
          void setUserAction(fd);
        }}
      >
        {staff.map((s) => <option key={s.id} value={s.id}>{s.name} · {roleLabel(s.role)}</option>)}
      </select>
    </label>
  );
}

export default function Deposits({ params }: { params?: Record<string, string> }) {
  const route: DepositsRoute = routeFromParams(params);
  const queryKey = JSON.stringify(route.query);
  const closeDrawer = () => { window.location.hash = buildHash(route.view, route.query); };
  const goView = (view: string) => { window.location.hash = buildHash(view, {}); };

  return (
    <RouteContext.Provider value={route}>
      <div className="tn dpg">
        <div className="app-shell">
          <div className="main-shell">
            <main className="main-content">
              <div className="page-heading">
                <div>
                  <div className="page-title-line">
                    <h1>Deposits</h1>
                    <span className="muted">Simulated ledger</span>
                  </div>
                  <p>Collect, hold, apply, refund and reconcile tenant deposits, including interest and jurisdiction rules.</p>
                </div>
                <div className="page-heading-actions no-print">
                  <TnButton variant="primary" onClick={() => { window.location.hash = buildHash(route.view, route.query, { isNew: true }); }}>
                    <Plus size={15} />New deposit
                  </TnButton>
                </div>
              </div>

              <section className="directory-panel" aria-label="Deposits">
                <div className="directory-tabs no-print" aria-label="Deposit views">
                  {TABS.map((t) => {
                    const Icon = t.icon;
                    return (
                      <button key={t.id} type="button" className={`directory-tab ${route.view === t.id ? 'selected' : ''}`} aria-pressed={route.view === t.id} onClick={() => goView(t.id)}>
                        <Icon size={14} />{t.label}
                      </button>
                    );
                  })}
                </div>
                <div className="directory-toolbar no-print">
                  <span className="dp-period"><Landmark size={13} style={{ verticalAlign: -2, marginRight: 5 }} />Meridian Property Group · trust account ledger</span>
                  <div className="toolbar-actions"><RoleSwitch /></div>
                </div>
                <div className="u-root dp dp-body">
                  <AsyncView
                    deps={[route.view, queryKey]}
                    render={async () => {
                      await ensureSeeded();
                      const Page = VIEW_PAGES[route.view] || VIEW_PAGES.overview;
                      return Page({ searchParams: Promise.resolve(route.query) });
                    }}
                  />
                </div>
              </section>

              <div className="directory-footnote no-print">
                <span>Demonstration data held in memory for this session. Financial workflows simulate money movement and ledger posting; nothing is saved.</span>
              </div>
            </main>
          </div>
        </div>

        {route.dep && (
          <Overlay title="Deposit record" subtitle="Balances, transactions, interest, refunds and audit trail" drawer wide onClose={closeDrawer} className="dp-drawer">
            <div className="u-drawer-scroll">
              <div className="u-root dp">
                <AsyncView
                  deps={[route.dep, queryKey]}
                  render={async () => {
                    await ensureSeeded();
                    return (DepositDetailPage as any)({ params: Promise.resolve({ id: route.dep }), searchParams: Promise.resolve(route.query) });
                  }}
                />
              </div>
            </div>
          </Overlay>
        )}

        {route.isNew && (
          <Overlay title="New deposit" subtitle="Create the expected deposit obligation for an existing lease" drawer wide onClose={closeDrawer} className="dp-drawer">
            <div className="u-drawer-scroll">
              <div className="u-root dp">
                <AsyncView
                  deps={['new']}
                  render={async () => {
                    await ensureSeeded();
                    return (CreateDepositPage as any)();
                  }}
                />
              </div>
            </div>
          </Overlay>
        )}
      </div>
    </RouteContext.Provider>
  );
}
