import { useState } from 'react';
import { Award, BarChart2, ClipboardCheck, Download, Layers, LayoutDashboard, ListTodo, Printer, RefreshCw, Settings2, Users, Wrench, Zap } from 'lucide-react';
import { Button as TnButton, IconButton } from '../tenants/components/ui';
import { FilterCheckbox, FilterField, FilterPopover } from '../shell/directory';
import { ReportProvider, useReportContext } from './context/ReportContext';
import { ManagementActionModal } from './components/modals/ManagementActionModal';
import { ManagementActionsDrawer } from './components/modals/ManagementActionsDrawer';
import { ScoreConfigModal } from './components/modals/ScoreConfigModal';
import { ScoreAuditModal } from './components/modals/ScoreAuditModal';
import { PropertyDrillDownModal } from './components/modals/PropertyDrillDownModal';
import { RecordDetailModal } from './components/modals/RecordDetailModal';
import { PerformanceDashboard } from './components/pages/PerformanceDashboard';
import { ScorecardPage } from './components/pages/ScorecardPage';
import { MaintenancePage } from './components/pages/MaintenancePage';
import { InspectionPage } from './components/pages/InspectionPage';
import { EfficiencyPage } from './components/pages/EfficiencyPage';
import { RetentionPage } from './components/pages/RetentionPage';
import { LifecyclePage } from './components/pages/LifecyclePage';
import { BenchmarkingPage } from './components/pages/BenchmarkingPage';
import './performance.css';

type SubTab = 'dashboard' | 'scorecard' | 'maintenance' | 'inspections' | 'efficiency' | 'retention' | 'lifecycle' | 'benchmarking';

const TABS: { id: SubTab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'scorecard', label: 'Scorecard', icon: Award },
  { id: 'maintenance', label: 'Maintenance & Condition', icon: Wrench },
  { id: 'inspections', label: 'Inspections & Safety', icon: ClipboardCheck },
  { id: 'efficiency', label: 'Operating Efficiency', icon: Zap },
  { id: 'retention', label: 'Tenant Retention', icon: Users },
  { id: 'lifecycle', label: 'Asset Lifecycle & Capital', icon: Layers },
  { id: 'benchmarking', label: 'Benchmarking & Ranking', icon: BarChart2 },
];

function PropertyPerformanceView({ initialTab }: { initialTab?: string }) {
  const {
    isLoading, error, rawData, filters, setFilter, resetFilters, recalculateData, isRecalculating, periodDisplayLabel, comparisonDisplayLabel,
    exportCurrentViewCsv, triggerPrint, kpis, filteredActions, setIsActionDrawerOpen, setIsConfigModalOpen,
  } = useReportContext();
  const [tab, setTab] = useState<SubTab>(TABS.some((t) => t.id === initialTab) ? (initialTab as SubTab) : 'dashboard');

  const allProps = rawData?.properties || [];
  const allManagers = rawData?.managers || [];
  const allBuildings = rawData?.buildings || [];
  const availableBuildings = allBuildings.filter((b) => filters.propertyIds.length === 0 || filters.propertyIds.includes(b.propertyId));
  const propertyTypes = Array.from(new Set(allProps.map((p) => p.type)));
  const overdueActions = (filteredActions || []).filter((a) => a.status !== 'Completed' && a.status !== 'Cancelled' && new Date(a.dueDate) < new Date('2025-02-15')).length;

  const togglePropertyId = (id: string, checked: boolean) => {
    const current = filters.propertyIds.length === 0 ? allProps.map((p) => p.id) : filters.propertyIds;
    const next = checked ? [...current, id] : current.filter((p) => p !== id);
    setFilter('propertyIds', next.length === allProps.length ? [] : next);
  };

  const filterCount =
    (filters.period !== 'this-quarter' ? 1 : 0) + (filters.propertyIds.length ? 1 : 0) + (filters.buildingId !== 'all' ? 1 : 0) +
    (filters.propertyType !== 'all' ? 1 : 0) + (filters.managerId !== 'all' ? 1 : 0) + (filters.comparison !== 'prior-period' ? 1 : 0);

  const handleCsvExport = () => {
    exportCurrentViewCsv(`Property-Performance-${tab.toUpperCase()}`, ['Metric', 'Value'], [
      ['Report Tab', tab],
      ['Portfolio Health Score', `${kpis.overallScore}/100`],
      ['Properties Evaluated', rawData?.properties.length || 0],
    ]);
  };

  if (isLoading || error) {
    return (
      <div className="tn pp">
        <div className="app-shell"><div className="main-shell"><main className="main-content">
          <div className="page-heading"><div><h1>Property Performance</h1><p>{error ? `Could not load the report data: ${error}` : 'Calculating property scores...'}</p></div></div>
        </main></div></div>
      </div>
    );
  }

  return (
    <div className="tn pp">
      <div className="app-shell">
        <div className="main-shell">
          <main className="main-content">
            <div className="page-heading">
              <div>
                <div className="page-title-line">
                  <h1>Property Performance</h1>
                  <span className="muted">{allProps.length} properties</span>
                </div>
                <p>Weighted scores for maintenance, condition, retention, efficiency and asset lifecycle across the portfolio.</p>
              </div>
              <div className="page-heading-actions no-print">
                <TnButton onClick={() => setIsActionDrawerOpen(true)}>
                  <ListTodo size={15} />Actions{overdueActions > 0 ? ` (${overdueActions} overdue)` : ''}
                </TnButton>
                <TnButton onClick={() => setIsConfigModalOpen(true)}><Settings2 size={15} />Score weights</TnButton>
                <TnButton onClick={handleCsvExport}><Download size={15} />CSV</TnButton>
                <TnButton variant="primary" onClick={triggerPrint}><Printer size={15} />Print / PDF</TnButton>
              </div>
            </div>

            <section className="directory-panel" aria-label="Property performance reports">
              <div className="directory-tabs no-print" aria-label="Performance reports">
                {TABS.map((t) => {
                  const Icon = t.icon;
                  return (
                    <button key={t.id} type="button" className={`directory-tab ${tab === t.id ? 'selected' : ''}`} aria-pressed={tab === t.id} onClick={() => setTab(t.id)}>
                      <Icon size={14} />{t.label}
                    </button>
                  );
                })}
              </div>
              <div className="directory-toolbar no-print">
                <span className="pp-period">{periodDisplayLabel} · {comparisonDisplayLabel}</span>
                <div className="toolbar-actions">
                  <IconButton label={isRecalculating ? 'Recalculating' : 'Recalculate scores'} disabled={isRecalculating} onClick={() => recalculateData()}>
                    <RefreshCw size={15} />
                  </IconButton>
                  <FilterPopover title="Report filters" count={filterCount} onReset={resetFilters}>
                    <FilterField id="pp-period" label="Period">
                      <select id="pp-period" value={filters.period} onChange={(e) => setFilter('period', e.target.value as typeof filters.period)}>
                        <option value="this-month">This Month (Feb 2025)</option>
                        <option value="last-month">Last Month (Jan 2025)</option>
                        <option value="this-quarter">This Quarter (Q1 2025)</option>
                        <option value="last-quarter">Last Quarter (Q4 2024)</option>
                        <option value="ytd">Year to Date (YTD)</option>
                        <option value="ltm">Last 12 Months (LTM)</option>
                        <option value="this-year">This Year (2025)</option>
                        <option value="last-year">Last Year (2024)</option>
                        <option value="custom">Custom range...</option>
                      </select>
                    </FilterField>
                    {filters.period === 'custom' && (
                      <>
                        <FilterField id="pp-from" label="From">
                          <input id="pp-from" type="date" value={filters.customStartDate || '2025-01-01'} onChange={(e) => setFilter('customStartDate', e.target.value)} />
                        </FilterField>
                        <FilterField id="pp-to" label="To">
                          <input id="pp-to" type="date" value={filters.customEndDate || '2025-02-28'} onChange={(e) => setFilter('customEndDate', e.target.value)} />
                        </FilterField>
                      </>
                    )}
                    <FilterField id="pp-props" label="Properties">
                      <div>
                        {allProps.map((p) => (
                          <FilterCheckbox
                            key={p.id}
                            label={p.name}
                            hint={`${p.type} • ${p.totalUnits} units`}
                            checked={filters.propertyIds.length === 0 || filters.propertyIds.includes(p.id)}
                            onChange={(checked) => togglePropertyId(p.id, checked)}
                          />
                        ))}
                      </div>
                    </FilterField>
                    <FilterField id="pp-building" label="Building">
                      <select id="pp-building" value={filters.buildingId} onChange={(e) => setFilter('buildingId', e.target.value)} disabled={filters.propertyIds.length > 1}>
                        <option value="all">All buildings ({availableBuildings.length})</option>
                        {availableBuildings.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                      </select>
                    </FilterField>
                    <FilterField id="pp-type" label="Property type">
                      <select id="pp-type" value={filters.propertyType} onChange={(e) => setFilter('propertyType', e.target.value)}>
                        <option value="all">All types</option>
                        {propertyTypes.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </FilterField>
                    <FilterField id="pp-manager" label="Manager">
                      <select id="pp-manager" value={filters.managerId} onChange={(e) => setFilter('managerId', e.target.value)}>
                        <option value="all">All managers</option>
                        {allManagers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                      </select>
                    </FilterField>
                    <FilterField id="pp-compare" label="Compare to">
                      <select id="pp-compare" value={filters.comparison} onChange={(e) => setFilter('comparison', e.target.value as typeof filters.comparison)}>
                        <option value="prior-period">Prior period (Q4 2024)</option>
                        <option value="prior-year">Prior year (Q1 2024)</option>
                        <option value="target">Configured target</option>
                      </select>
                    </FilterField>
                  </FilterPopover>
                </div>
              </div>

              <div className="u-root pp-body">
                {tab === 'dashboard' && <PerformanceDashboard />}
                {tab === 'scorecard' && <ScorecardPage onNavigateTab={(t: string) => setTab(t as SubTab)} />}
                {tab === 'maintenance' && <MaintenancePage />}
                {tab === 'inspections' && <InspectionPage />}
                {tab === 'efficiency' && <EfficiencyPage />}
                {tab === 'retention' && <RetentionPage />}
                {tab === 'lifecycle' && <LifecyclePage />}
                {tab === 'benchmarking' && <BenchmarkingPage />}
              </div>
            </section>

            <div className="directory-footnote no-print">
              <span>Mock operations data held in memory for this session; scores are recalculated in the browser, and management actions are not saved.</span>
            </div>
          </main>
        </div>
      </div>

      <div className="u-root">
        <ManagementActionModal />
        <ManagementActionsDrawer />
        <ScoreConfigModal />
        <ScoreAuditModal />
        <PropertyDrillDownModal />
        <RecordDetailModal />
      </div>
    </div>
  );
}

export default function PropertyPerformance({ params }: { params?: Record<string, string> }) {
  return (
    <ReportProvider>
      <PropertyPerformanceView initialTab={params?.tab} />
    </ReportProvider>
  );
}
