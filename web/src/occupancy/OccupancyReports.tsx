import { useEffect, useMemo, useState } from 'react';
import { BarChart3, Download } from 'lucide-react';
import { Button as TnButton } from '../tenants/components/ui';
import { FilterField, FilterPopover, SearchField } from '../shell/directory';
import { SummaryCards } from './components/SummaryCards';
import { ReportCatalog } from './components/ReportCatalog';
import { OccupancyTrendChart } from './components/charts/OccupancyTrendChart';
import { OccupiedVsVacantChart } from './components/charts/OccupiedVsVacantChart';
import { UnitDetailModal } from './components/modals/UnitDetailModal';
import { LeaseDetailModal } from './components/modals/LeaseDetailModal';
import { Report1OccupancySummary } from './components/reports/Report1OccupancySummary';
import { Report2VacancyAvailable } from './components/reports/Report2VacancyAvailable';
import { Report3LeaseExpiration } from './components/reports/Report3LeaseExpiration';
import { Report4OccupancyTrend } from './components/reports/Report4OccupancyTrend';
import { Report5EconomicOccupancy } from './components/reports/Report5EconomicOccupancy';
import { Report6OccupancyPropertyFloor } from './components/reports/Report6OccupancyPropertyFloor';
import { Report7UnitReadiness } from './components/reports/Report7UnitReadiness';
import { Report8LeasingPipeline } from './components/reports/Report8LeasingPipeline';
import { Report9LeaseCommencement } from './components/reports/Report9LeaseCommencement';
import { Report10MoveInMoveOut } from './components/reports/Report10MoveInMoveOut';
import { Report11MonthToMonth } from './components/reports/Report11MonthToMonth';
import { Report12RentRoll } from './components/reports/Report12RentRoll';
import { Report13LongTermVacancy } from './components/reports/Report13LongTermVacancy';
import { Report14FutureAvailability } from './components/reports/Report14FutureAvailability';
import { Report15OccupancyExceptions } from './components/reports/Report15OccupancyExceptions';
import type { CurrentOccupancyStatus, Lease, ReportCategory, ReportFilterState, Unit, UnitType } from './types/occupancy';
import { OccupancyService } from './services/occupancyService';
import { loadOccupancyData } from './services/liveData';
import { isSupabaseConfigured } from '../lib/supabase';
import { useOrganization } from '../auth/contexts/OrganizationContext';
import { MOCK_PROPERTIES } from './mock/properties';
import { REPORTS_CATALOG } from './mock/reportsCatalog';
import { exportToCSV } from './utils/exportUtils';
import { formatCurrency, formatPercent } from './utils/formatters';
import './occupancy.css';

const PORTFOLIO = isSupabaseConfigured ? 'Portfolio' : 'Metropolitan Living Portfolio';
const TODAY = new Date().toISOString().slice(0, 10);
const monthBounds = () => {
  const d = new Date();
  return { startDate: `${TODAY.slice(0, 7)}-01`, endDate: new Date(d.getFullYear(), d.getMonth() + 1, 0, 12).toISOString().slice(0, 10) };
};

const DEFAULT_FILTERS: ReportFilterState = {
  asOfDate: isSupabaseConfigured ? TODAY : '2026-10-24',
  dateRange: isSupabaseConfigured ? monthBounds() : { startDate: '2026-10-01', endDate: '2026-10-31' },
  periodPreset: 'today',
  propertyId: 'all',
  unitType: 'all',
  occupancyStatus: 'all',
  readinessStatus: 'all',
  searchQuery: '',
  thresholdDays: 30,
  expiryWindowDays: 60,
};

const UNIT_TYPES: UnitType[] = ['Studio', '1 Bedroom', '1 Bedroom + Den', '2 Bedroom', '2 Bedroom + Den', '3 Bedroom', 'Penthouse'];
const STATUSES: CurrentOccupancyStatus[] = [
  'Occupied', 'Vacant — Ready', 'Vacant — Needs Cleaning', 'Vacant — Under Maintenance', 'Vacant — Under Renovation', 'Reserved', 'Leased — Awaiting Move-In', 'Unavailable',
];
const PERIODS = [
  { id: 'today', label: 'Today (Snapshot)' },
  { id: '30days', label: 'Next 30 Days' },
  { id: '60days', label: 'Next 60 Days' },
  { id: '90days', label: 'Next 90 Days' },
  { id: 'currentMonth', label: 'Current Month (Oct 2026)' },
  { id: 'q4-2026', label: 'Q4 2026' },
  { id: 'last12months', label: 'Last 12 Months' },
];
const CATEGORY_TABS: { id: ReportCategory; label: string }[] = [
  { id: 'all', label: 'All reports' },
  { id: 'core', label: 'Core Occupancy' },
  { id: 'operational', label: 'Operational & Turnover' },
  { id: 'financial', label: 'Financial & Rent Roll' },
  { id: 'pipeline', label: 'Leasing Funnel' },
  { id: 'data-quality', label: 'Data Quality & Exceptions' },
];

const goReport = (id?: string) => {
  window.location.hash = id ? `#/occupancy-reports?report=${encodeURIComponent(id)}` : '#/occupancy-reports';
};

const daysBetween = (from: string, to: string) => Math.max(0, Math.floor((new Date(to).getTime() - new Date(from).getTime()) / 86400000));

export default function OccupancyReports({ params }: { params?: Record<string, string> }) {
  const activeReportId = params?.report || null;
  const [category, setCategory] = useState<ReportCategory>('all');
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<ReportFilterState>(DEFAULT_FILTERS);
  // Supabase mode: the reports are built from the organization's units, leases, tenants and applications
  const { activeOrganization } = useOrganization();
  const [loadState, setLoadState] = useState<{ loading: boolean; error: string | null }>({ loading: isSupabaseConfigured, error: null });
  useEffect(() => {
    if (!isSupabaseConfigured || !activeOrganization) return;
    let live = true;
    setLoadState({ loading: true, error: null });
    loadOccupancyData(activeOrganization.id)
      .then(() => { if (live) { setLoadState({ loading: false, error: null }); setFilters((f) => ({ ...f })); } })
      .catch((error) => { console.error('Occupancy Reports load failed:', error); if (live) setLoadState({ loading: false, error: `Could not load your occupancy data: ${error instanceof Error ? error.message : 'unknown error'}` }); });
    return () => { live = false; };
  }, [activeOrganization]);
  const [recent, setRecent] = useState<string[]>(['report-occupancy-summary', 'report-vacancy-available', 'report-lease-expiration']);
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  const [selectedLease, setSelectedLease] = useState<Lease | null>(null);

  useEffect(() => { window.scrollTo?.(0, 0); }, [activeReportId]);

  const patch = (next: Partial<ReportFilterState>) => setFilters((prev) => ({ ...prev, ...next }));
  const reset = () => setFilters(DEFAULT_FILTERS);
  const open = (id: string | null) => {
    if (id) setRecent((prev) => [id, ...prev.filter((x) => x !== id)].slice(0, 3));
    goReport(id ?? undefined);
  };

  const popoverCount =
    (filters.propertyId !== 'all' ? 1 : 0) + (filters.unitType !== 'all' ? 1 : 0) + (filters.occupancyStatus !== 'all' ? 1 : 0) +
    (filters.periodPreset !== DEFAULT_FILTERS.periodPreset ? 1 : 0) + (filters.asOfDate !== DEFAULT_FILTERS.asOfDate ? 1 : 0) +
    (filters.thresholdDays !== DEFAULT_FILTERS.thresholdDays ? 1 : 0);

  const filterPopover = (
    <FilterPopover title="Report filters" count={popoverCount} onReset={reset}>
      <FilterField id="occ-asof" label="As-of date">
        <input id="occ-asof" type="date" value={filters.asOfDate} onChange={(e) => patch({ asOfDate: e.target.value })} />
      </FilterField>
      <FilterField id="occ-prop" label="Property">
        <select id="occ-prop" value={filters.propertyId} onChange={(e) => patch({ propertyId: e.target.value })}>
          <option value="all">All portfolio ({MOCK_PROPERTIES.length} properties)</option>
          {MOCK_PROPERTIES.map((p) => <option key={p.propertyId} value={p.propertyId}>{p.propertyName} ({p.propertyCode})</option>)}
        </select>
      </FilterField>
      <FilterField id="occ-period" label="Period">
        <select id="occ-period" value={filters.periodPreset} onChange={(e) => patch({ periodPreset: e.target.value as ReportFilterState['periodPreset'] })}>
          {PERIODS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
      </FilterField>
      <FilterField id="occ-type" label="Unit type">
        <select id="occ-type" value={filters.unitType} onChange={(e) => patch({ unitType: e.target.value })}>
          <option value="all">All unit types</option>
          {UNIT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </FilterField>
      <FilterField id="occ-status" label="Occupancy status">
        <select id="occ-status" value={filters.occupancyStatus} onChange={(e) => patch({ occupancyStatus: e.target.value })}>
          <option value="all">All occupancy statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </FilterField>
      <FilterField id="occ-threshold" label="Vacancy duration threshold">
        <select id="occ-threshold" value={filters.thresholdDays} onChange={(e) => patch({ thresholdDays: Number(e.target.value) })}>
          <option value={0}>Any duration</option>
          <option value={30}>Vacant 30+ days</option>
          <option value={60}>Vacant 60+ days (critical)</option>
          <option value={90}>Vacant 90+ days (severe)</option>
        </select>
      </FilterField>
    </FilterPopover>
  );

  const summaryMetrics = useMemo(() => OccupancyService.getLandingSummaryMetrics(filters.asOfDate, filters.propertyId), [filters]);
  const { propertyRows } = useMemo(() => OccupancyService.getOccupancySummary(filters), [filters]);
  const { trendTimeline } = useMemo(() => OccupancyService.getOccupancyTrend(filters), [filters]);

  const exportSnapshot = () => {
    exportToCSV({
      filename: `portfolio-occupancy-snapshot-${filters.asOfDate}`,
      reportTitle: 'Portfolio Occupancy & Leasing Snapshot',
      reportingPeriod: `As of ${filters.asOfDate}`,
      propertyContext: PORTFOLIO,
      columns: [
        { header: 'Property Name', accessor: (r) => r.propertyName },
        { header: 'Property Code', accessor: (r) => r.propertyCode },
        { header: 'Total Units', accessor: (r) => r.totalUnits },
        { header: 'Rentable Units', accessor: (r) => r.rentableUnits },
        { header: 'Occupied Units', accessor: (r) => r.occupiedUnits },
        { header: 'Vacant Units', accessor: (r) => r.vacantUnits },
        { header: 'Reserved Units', accessor: (r) => r.reservedUnits },
        { header: 'Unavailable Units', accessor: (r) => r.unavailableUnits },
        { header: 'Occupancy Rate', accessor: (r) => formatPercent(r.occupancyRate) },
        { header: 'Vacancy Rate', accessor: (r) => formatPercent(r.vacancyRate) },
      ],
      data: propertyRows,
      summaryNotes: [
        `Physical Occupancy: ${formatPercent(summaryMetrics.physicalOccupancyRate)} across ${summaryMetrics.rentableUnits} rentable units.`,
        `Potential Monthly Vacancy Loss: ${formatCurrency(summaryMetrics.potentialVacancyLoss)}.`,
      ],
    });
  };

  const q = query.trim().toLowerCase();
  const visibleIds = REPORTS_CATALOG.filter((r) => {
    if (category !== 'all' && r.category !== category) return false;
    if (!q) return true;
    return r.title.toLowerCase().includes(q) || r.description.toLowerCase().includes(q) || r.keyOutputs.some((o) => o.toLowerCase().includes(q));
  }).map((r) => r.id);

  const back = () => open(null);
  const reportView = (id: string) => {
    const common = { filters, onBack: back };
    const unit = { onSelectUnit: setSelectedUnit };
    const lease = { onSelectLease: setSelectedLease };
    switch (id) {
      case 'report-occupancy-summary': return <Report1OccupancySummary {...common} {...unit} />;
      case 'report-vacancy-available': return <Report2VacancyAvailable {...common} {...unit} />;
      case 'report-lease-expiration': return <Report3LeaseExpiration {...common} {...lease} />;
      case 'report-historical-trend': return <Report4OccupancyTrend {...common} />;
      case 'report-economic-occupancy': return <Report5EconomicOccupancy {...common} />;
      case 'report-occupancy-property-floor': return <Report6OccupancyPropertyFloor {...common} {...unit} />;
      case 'report-unit-readiness': return <Report7UnitReadiness {...common} {...unit} />;
      case 'report-leasing-pipeline': return <Report8LeasingPipeline {...common} />;
      case 'report-lease-commencement': return <Report9LeaseCommencement {...common} {...lease} />;
      case 'report-movein-moveout': return <Report10MoveInMoveOut {...common} />;
      case 'report-month-to-month': return <Report11MonthToMonth {...common} {...lease} />;
      case 'report-rent-roll': return <Report12RentRoll {...common} {...unit} />;
      case 'report-long-term-vacancy': return <Report13LongTermVacancy {...common} {...unit} />;
      case 'report-future-availability': return <Report14FutureAvailability {...common} {...unit} />;
      case 'report-occupancy-exceptions': return <Report15OccupancyExceptions {...common} />;
      default: return null;
    }
  };

  const activeView = activeReportId ? reportView(activeReportId) : null;

  const unitDays = selectedUnit?.vacancyStartDate ? daysBetween(selectedUnit.vacancyStartDate, filters.asOfDate) : 0;

  return (
    <div className="tn occ">
      <div className="app-shell">
        <div className="main-shell">
          <main className="main-content">
            {activeView ? (
              <>
                <section className="directory-panel no-print" aria-label="Report filters">
                  <div className="directory-toolbar">
                    <SearchField label="Filter units or tenants" placeholder="Filter units or tenants..." value={filters.searchQuery} onChange={(v) => patch({ searchQuery: v })} />
                    <div className="toolbar-actions">{filterPopover}</div>
                  </div>
                </section>
                <div className="u-root pt-5">{activeView}</div>
              </>
            ) : (
              <>
                <div className="page-heading">
                  <div>
                    <div className="page-title-line">
                      <h1>Occupancy Reports</h1>
                      <span className="muted">{REPORTS_CATALOG.length} reports</span>
                    </div>
                    <p>Monitor portfolio occupancy, available units, lease expirations, turnover and rental performance.</p>
                    {loadState.loading ? <p className="text-u-muted">Loading your units and leases…</p> : loadState.error ? <p className="text-u-danger font-semibold">{loadState.error}</p> : null}
                  </div>
                  <div className="page-heading-actions">
                    <TnButton onClick={() => open('report-occupancy-summary')}><BarChart3 size={15} />Quick summary</TnButton>
                    <TnButton variant="primary" onClick={exportSnapshot}><Download size={15} />Export portfolio CSV</TnButton>
                  </div>
                </div>

                <div className="u-root space-y-5 pb-5">
                  <SummaryCards metrics={summaryMetrics} asOfDate={filters.asOfDate} onOpenReport={open} />
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    <OccupancyTrendChart data={trendTimeline.slice(-6)} title="Portfolio Physical Occupancy Trend (Last 6 Months)" targetRate={95.0} />
                    <OccupiedVsVacantChart
                      data={propertyRows}
                      onSelectProperty={(code) => {
                        const p = MOCK_PROPERTIES.find((prop) => prop.propertyCode === code);
                        if (p) patch({ propertyId: p.propertyId });
                      }}
                    />
                  </div>
                </div>

                <section className="directory-panel" aria-label="Report catalog">
                  <div className="directory-tabs" aria-label="Report categories">
                    {CATEGORY_TABS.map((t) => (
                      <button key={t.id} type="button" className={`directory-tab ${category === t.id ? 'selected' : ''}`} aria-pressed={category === t.id} onClick={() => setCategory(t.id)}>
                        {t.label}<span>{t.id === 'all' ? REPORTS_CATALOG.length : REPORTS_CATALOG.filter((r) => r.category === t.id).length}</span>
                      </button>
                    ))}
                  </div>
                  <div className="directory-toolbar">
                    <SearchField label="Search reports" placeholder="Search all reports..." value={query} onChange={setQuery} />
                    <div className="toolbar-actions">{filterPopover}</div>
                  </div>
                  <div className="u-root">
                    <ReportCatalog
                      reportIds={visibleIds}
                      showRecent={!q && category === 'all'}
                      recentReportIds={recent}
                      onSelectReport={open}
                      onClear={() => { setQuery(''); setCategory('all'); }}
                    />
                  </div>
                </section>

                <div className="directory-footnote">
                  <span>Mock portfolio data for {PORTFOLIO}; figures are illustrative and not connected to a live leasing backend.</span>
                </div>
              </>
            )}
          </main>
        </div>
      </div>

      {selectedUnit && (
        <UnitDetailModal
          unit={selectedUnit}
          property={MOCK_PROPERTIES.find((p) => p.propertyId === selectedUnit.propertyId)}
          activeLease={OccupancyService.getLeases().find((l) => l.unitIds.includes(selectedUnit.unitId) && l.tenancyStatus !== 'Terminated')}
          tenant={OccupancyService.getTenants().find((t) => {
            const l = OccupancyService.getLeases().find((lease) => lease.unitIds.includes(selectedUnit.unitId));
            return l ? l.tenantId === t.tenantId : false;
          })}
          daysVacant={unitDays}
          accruedLoss={Math.round((selectedUnit.marketRent / 30.417) * unitDays)}
          onClose={() => setSelectedUnit(null)}
          onOpenLease={(leaseId) => {
            const l = OccupancyService.getLeases().find((lease) => lease.leaseId === leaseId);
            if (l) { setSelectedUnit(null); setSelectedLease(l); }
          }}
        />
      )}
      {selectedLease && (
        <LeaseDetailModal
          lease={selectedLease}
          property={MOCK_PROPERTIES.find((p) => p.propertyId === selectedLease.propertyId)}
          tenant={OccupancyService.getTenants().find((t) => t.tenantId === selectedLease.tenantId)}
          units={OccupancyService.getUnits().filter((u) => selectedLease.unitIds.includes(u.unitId))}
          onClose={() => setSelectedLease(null)}
        />
      )}
    </div>
  );
}
