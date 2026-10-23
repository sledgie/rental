import { isSupabaseConfigured } from "../lib/supabase";
import { useEffect } from 'react';
import { AlertTriangle, Award, CalendarCheck2, CheckSquare2, DollarSign, GitPullRequestDraft, HardHat, LayoutDashboard, RefreshCw, Sliders, Printer } from 'lucide-react';
import { Button as TnButton, IconButton } from '../tenants/components/ui';
import { FilterField, FilterPopover } from '../shell/directory';
import { ProjectReportsProvider, useProjectReports } from './context/ProjectReportsContext';
import { ProjectDetailModal } from './components/common/ProjectDetailModal';
import { ThresholdModal } from './components/common/ThresholdModal';
import { ExportModal } from './components/common/ExportModal';
import { PortfolioDashboard } from './components/reports/PortfolioDashboard';
import { ProgressMilestoneReport } from './components/reports/ProgressMilestoneReport';
import { BudgetCostVarianceReport } from './components/reports/BudgetCostVarianceReport';
import { ContractorPerformanceReport } from './components/reports/ContractorPerformanceReport';
import { RiskIssueReport } from './components/reports/RiskIssueReport';
import { ChangeOrderReport } from './components/reports/ChangeOrderReport';
import { CompletionHandoverReport } from './components/reports/CompletionHandoverReport';
import { OutcomeBenefitsReport } from './components/reports/OutcomeBenefitsReport';
import './projectreports.css';

const TABS = [
  { id: 'portfolio', label: 'Portfolio Dashboard', icon: LayoutDashboard },
  { id: 'progress', label: 'Progress & Milestones', icon: CalendarCheck2 },
  { id: 'budget', label: 'Budget & Cost Variance', icon: DollarSign },
  { id: 'contractors', label: 'Contractor Delivery', icon: HardHat },
  { id: 'risks', label: 'Risks & Issues', icon: AlertTriangle },
  { id: 'change-orders', label: 'Change Orders', icon: GitPullRequestDraft },
  { id: 'handover', label: 'Completion & Handover', icon: CheckSquare2 },
  { id: 'outcomes', label: 'Outcomes & Benefits', icon: Award },
];

const PERIOD_LABELS: Record<string, string> = {
  ALL: 'All time', FY2025: 'Fiscal year 2025', 'Q1-2025': 'Q1 2025', 'Q2-2025': 'Q2 2025', 'Q3-2025': 'Q3 2025', 'Q4-2025': 'Q4 2025',
  FY2026: 'Fiscal year 2026', 'Q1-2026': 'Q1 2026', LAST_12M: 'Last 12 months', CUSTOM: 'Custom range',
};

const CATEGORIES = ['Renovation', 'Capital Improvement', 'Major Repair', 'Building Upgrade', 'Equipment Replacement', 'Energy Efficiency', 'Compliance and Safety', 'Infrastructure Improvement'];
const STATUSES = ['In Progress', 'Completed', 'Pending Approval', 'Proposed', 'On Hold', 'Cancelled'];

function ProjectReportsView({ initialTab }: { initialTab?: string }) {
  const {
    filters, updateFilter, resetFilters, loading, error, refreshData, properties, buildings, projectManagers, contractors, projects,
    activeReportTab, setActiveReportTab, setIsThresholdModalOpen, setIsExportModalOpen, setExportReportType,
  } = useProjectReports();

  useEffect(() => {
    if (initialTab && TABS.some((t) => t.id === initialTab)) setActiveReportTab(initialTab);
  }, [initialTab]); // eslint-disable-line react-hooks/exhaustive-deps

  const availableBuildings = filters.propertyId === 'ALL' ? buildings : buildings.filter((b) => b.propertyId === filters.propertyId);
  const filterCount = Object.entries(filters).filter(([k, v]) => {
    if (k === 'comparisonPeriod') return v !== 'NONE';
    if (k === 'customStartDate' || k === 'customEndDate') return v !== '';
    return v !== 'ALL';
  }).length;

  const openExport = () => {
    setExportReportType(activeReportTab);
    setIsExportModalOpen(true);
  };

  return (
    <div className="tn pr">
      <div className="app-shell">
        <div className="main-shell">
          <main className="main-content">
            <div className="page-heading">
              <div>
                <div className="page-title-line">
                  <h1>Project Reports</h1>
                  <span className="muted">{projects.length} projects</span>
                </div>
                <p>Budget versus actual, schedule, risk, contractor delivery and benefits across renovation and capital projects.</p>
              </div>
              <div className="page-heading-actions no-print">
                <TnButton onClick={() => setIsThresholdModalOpen(true)}><Sliders size={15} />Alert thresholds</TnButton>
                <TnButton variant="primary" onClick={openExport}><Printer size={15} />Export / Print</TnButton>
              </div>
            </div>

            <section className="directory-panel" aria-label="Project reports">
              <div className="directory-tabs no-print" aria-label="Project report views">
                {TABS.map((t) => {
                  const Icon = t.icon;
                  return (
                    <button key={t.id} type="button" className={`directory-tab ${activeReportTab === t.id ? 'selected' : ''}`} aria-pressed={activeReportTab === t.id} onClick={() => setActiveReportTab(t.id)}>
                      <Icon size={14} />{t.label}
                    </button>
                  );
                })}
              </div>
              <div className="directory-toolbar no-print">
                <span className="pr-period">{PERIOD_LABELS[filters.period] || filters.period}</span>
                <div className="toolbar-actions">
                  <IconButton label="Refresh data" onClick={() => refreshData()}><RefreshCw size={15} /></IconButton>
                  <FilterPopover title="Report filters" count={filterCount} onReset={resetFilters}>
                    <FilterField id="pr-period" label="Period">
                      <select id="pr-period" value={filters.period} onChange={(e) => updateFilter('period', e.target.value)}>
                        <option value="ALL">All time</option>
                        <option value="FY2025">Fiscal year 2025</option>
                        <option value="Q1-2025">Q1 2025 (Jan - Mar)</option>
                        <option value="Q2-2025">Q2 2025 (Apr - Jun)</option>
                        <option value="Q3-2025">Q3 2025 (Jul - Sep)</option>
                        <option value="Q4-2025">Q4 2025 (Oct - Dec)</option>
                        <option value="FY2026">Fiscal year 2026</option>
                        <option value="Q1-2026">Q1 2026 (Jan - Mar)</option>
                        <option value="LAST_12M">Last 12 months</option>
                        <option value="CUSTOM">Custom date range...</option>
                      </select>
                    </FilterField>
                    {filters.period === 'CUSTOM' && (
                      <>
                        <FilterField id="pr-from" label="From">
                          <input id="pr-from" type="date" value={filters.customStartDate} onChange={(e) => updateFilter('customStartDate', e.target.value)} />
                        </FilterField>
                        <FilterField id="pr-to" label="To">
                          <input id="pr-to" type="date" value={filters.customEndDate} onChange={(e) => updateFilter('customEndDate', e.target.value)} />
                        </FilterField>
                      </>
                    )}
                    <FilterField id="pr-property" label="Property">
                      <select id="pr-property" value={filters.propertyId} onChange={(e) => updateFilter('propertyId', e.target.value)}>
                        <option value="ALL">All properties ({properties.length})</option>
                        {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </FilterField>
                    <FilterField id="pr-building" label="Building">
                      <select id="pr-building" value={filters.buildingId} onChange={(e) => updateFilter('buildingId', e.target.value)}>
                        <option value="ALL">All buildings</option>
                        {availableBuildings.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                      </select>
                    </FilterField>
                    <FilterField id="pr-category" label="Category">
                      <select id="pr-category" value={filters.category} onChange={(e) => updateFilter('category', e.target.value)}>
                        <option value="ALL">All categories</option>
                        {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </FilterField>
                    <FilterField id="pr-status" label="Status">
                      <select id="pr-status" value={filters.status} onChange={(e) => updateFilter('status', e.target.value)}>
                        <option value="ALL">All statuses</option>
                        {STATUSES.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </FilterField>
                    <FilterField id="pr-contractor" label="Contractor">
                      <select id="pr-contractor" value={filters.contractorId} onChange={(e) => updateFilter('contractorId', e.target.value)}>
                        <option value="ALL">All contractors</option>
                        {contractors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </FilterField>
                    <FilterField id="pr-manager" label="Project manager">
                      <select id="pr-manager" value={filters.managerId} onChange={(e) => updateFilter('managerId', e.target.value)}>
                        <option value="ALL">All project managers</option>
                        {projectManagers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                      </select>
                    </FilterField>
                    <FilterField id="pr-project" label="Project">
                      <select id="pr-project" value={filters.projectId} onChange={(e) => updateFilter('projectId', e.target.value)}>
                        <option value="ALL">All projects</option>
                        {projects.map((p) => <option key={p.id} value={p.id}>{p.code} · {p.name}</option>)}
                      </select>
                    </FilterField>
                    <FilterField id="pr-risk" label="Risk level">
                      <select id="pr-risk" value={filters.riskLevel} onChange={(e) => updateFilter('riskLevel', e.target.value)}>
                        <option value="ALL">All risk levels</option>
                        <option value="Critical">Critical only</option>
                        <option value="High">High and critical</option>
                        <option value="Medium">Medium</option>
                        <option value="Low">Low</option>
                      </select>
                    </FilterField>
                    <FilterField id="pr-compare" label="Compare to">
                      <select id="pr-compare" value={filters.comparisonPeriod} onChange={(e) => updateFilter('comparisonPeriod', e.target.value)}>
                        <option value="NONE">None (current only)</option>
                        <option value="PREVIOUS_PERIOD">Previous period</option>
                        <option value="PREVIOUS_YEAR">Previous year baseline</option>
                      </select>
                    </FilterField>
                  </FilterPopover>
                </div>
              </div>

              <div className="u-root pr-body">
                {loading && <p className="pr-note">Reconciling project data...</p>}
                {error && <p className="pr-note">Could not load project data: {error}</p>}
                {!loading && !error && (
                  <>
                    {activeReportTab === 'portfolio' && <PortfolioDashboard />}
                    {activeReportTab === 'progress' && <ProgressMilestoneReport />}
                    {activeReportTab === 'budget' && <BudgetCostVarianceReport />}
                    {activeReportTab === 'contractors' && <ContractorPerformanceReport />}
                    {activeReportTab === 'risks' && <RiskIssueReport />}
                    {activeReportTab === 'change-orders' && <ChangeOrderReport />}
                    {activeReportTab === 'handover' && <CompletionHandoverReport />}
                    {activeReportTab === 'outcomes' && <OutcomeBenefitsReport />}
                  </>
                )}
              </div>
            </section>

            <div className="directory-footnote no-print">
              <span>{isSupabaseConfigured ? "Built from your projects. Risks, handover checklists and outcome reviews are not recorded yet, so those sections stay empty." : "Mock project data held in memory for this session; nothing is saved."}</span>
            </div>
          </main>
        </div>
      </div>

      <div className="u-root">
        <ProjectDetailModal />
        <ThresholdModal />
        <ExportModal />
      </div>
    </div>
  );
}

export default function ProjectReports({ params }: { params?: Record<string, string> }) {
  return (
    <ProjectReportsProvider>
      <ProjectReportsView initialTab={params?.tab} />
    </ProjectReportsProvider>
  );
}
