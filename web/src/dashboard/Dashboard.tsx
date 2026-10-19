import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/utils/cn";
import {
  DAILY,
  PRESET_LABEL,
  SEGMENTS,
  SEGMENT_META,
  aggregate,
  bestProperty,
  buildSeries,
  channelBreakdown,
  filterRows,
  performanceByProperty,
  presetRange,
  previousRange,
  propertiesInSegments,
  weekdayBreakdown,
  type DateRange,
  type MetricKey,
  type RangePreset,
  type Segment,
} from "@/lib/data";
import { fmtDate, fmtRange, money, moneyFull, numberFull, pct, signedPct } from "@/lib/format";
import { Icon } from "./components/Icon";
import { Card, Delta, IconButton, Segmented, Switch } from "./components/ui";
import { ActiveFilters, DateRangeControl, SegmentControl } from "./components/Filters";
import { KpiCards } from "./components/KpiCards";
import { DonutChart, TrendChart, WeekdayBars, type WeekdayMetric } from "./components/charts";
import { PropertiesTable } from "./components/PropertiesTable";
import PropertyKpis from "../properties/PropertyKpis";
import PropertyArrears from "../properties/PropertyArrears";
import { useInvoices } from "@inv/store/InvoiceStore";
import { useInvoiceKpis } from "@inv/kpis";
import { formatCAD } from "@inv/lib/format";
import { useTenantDb, useWarningDays } from "../tenants/store";
import { dashboardSummary, leaseStatus, money as tenantMoney } from "../tenants/lib/domain";

export default function Dashboard({ notify }: { notify?: (message: string) => void }) {
  const { invoices } = useInvoices();
  const invoiceKpis = useInvoiceKpis(invoices);
  const [tenantDb] = useTenantDb();
  const warningDays = useWarningDays();
  const tenantSummary = useMemo(() => dashboardSummary(tenantDb), [tenantDb]);
  const expiringLeases = tenantDb.leases.filter((l) => leaseStatus(l, warningDays) === "Expiring").length;
  /* ---------------------------------------------------------------- filters */
  const [preset, setPreset] = useState<RangePreset>("30d");
  const [range, setRange] = useState<DateRange>(() => presetRange("30d"));
  const [segments, setSegments] = useState<Segment[]>([...SEGMENTS]);
  const [search, setSearch] = useState("");
  const [metric, setMetric] = useState<MetricKey>("revenue");
  const [compare, setCompare] = useState(true);
  const [weekdayMetric, setWeekdayMetric] = useState<WeekdayMetric>("bookings");

  /* ------------------------------------------------------------------ shell */
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState("2 min ago");
  const refreshTimer = useRef<number | null>(null);
  const showToast = useCallback((message: string) => notify?.(message), [notify]);

  useEffect(
    () => () => {
      if (refreshTimer.current) window.clearTimeout(refreshTimer.current);
    },
    []
  );

  /* --------------------------------------------------------------- derived */
  const segmentKey = segments.join("|");
  const rangeKey = `${range.start}:${range.end}`;

  const derived = useMemo(() => {
    const previous = previousRange(range);
    const currentRows = filterRows(DAILY, range, segments);
    const previousRows = filterRows(DAILY, previous, segments);
    const totals = aggregate(currentRows);
    const priorTotals = aggregate(previousRows);
    const buckets = buildSeries(currentRows, range);
    const priorBuckets = buildSeries(previousRows, previous);
    const performance = performanceByProperty(currentRows, previousRows);
    const channels = channelBreakdown(currentRows);
    const priorChannels = channelBreakdown(previousRows);
    const weekday = weekdayBreakdown(currentRows, previousRows);
    const properties = propertiesInSegments(segments);
    const units = properties.reduce((sum, property) => sum + property.units, 0);
    const top = [...performance].sort((a, b) => b.revenue - a.revenue);
    const leader = bestProperty(performance);
    const fastest = [...performance].sort((a, b) => b.delta - a.delta)[0] ?? null;
    const peakWeekday = [...weekday].sort(
      (a, b) =>
        (weekdayMetric === "bookings" ? b.bookings - a.bookings : b.revenue - a.revenue)
    )[0];
    return {
      previousRange: previous,
      totals,
      priorTotals,
      buckets,
      priorBuckets,
      performance,
      top,
      channels,
      priorChannels,
      weekday,
      peakWeekday,
      properties,
      units,
      leader,
      fastest,
    };
  }, [rangeKey, segmentKey, weekdayMetric]);

  const days = Math.round(
    (new Date(`${range.end}T00:00:00Z`).getTime() - new Date(`${range.start}T00:00:00Z`).getTime()) /
      86_400_000
  ) + 1;
  const granularity = days > 150 ? "Monthly" : days > 45 ? "Weekly" : "Daily";
  const totalRevenue = derived.totals.revenue;
  const topFourRevenue = derived.top.slice(0, 4).reduce((sum, row) => sum + row.revenue, 0);
  const topShare = totalRevenue ? topFourRevenue / totalRevenue : 0;
  const channelGrowth = derived.channels[0]
    ? derived.priorChannels[0]?.value
      ? ((derived.channels[0].value - derived.priorChannels[0].value) /
          derived.priorChannels[0].value) *
        100
      : null
    : null;

  /* --------------------------------------------------------------- actions */
  const applyRange = (nextPreset: RangePreset, nextRange: DateRange) => {
    setPreset(nextPreset);
    setRange(nextRange);
  };

  const resetFilters = () => {
    setPreset("30d");
    setRange(presetRange("30d"));
    setSegments([...SEGMENTS]);
    setSearch("");
    showToast("Filters reset to the last 30 days");
  };

  const removeSegment = (segment: Segment) => {
    const next = segments.filter((value) => value !== segment);
    setSegments(next.length ? next : [...SEGMENTS]);
  };

  const handleRefresh = () => {
    if (refreshing) return;
    setRefreshing(true);
    if (refreshTimer.current) window.clearTimeout(refreshTimer.current);
    refreshTimer.current = window.setTimeout(() => {
      setRefreshing(false);
      setLastUpdated("just now");
      showToast("Portfolio metrics refreshed");
    }, 850);
  };

  const handleExport = () => {
    const ordered = [...derived.performance].sort((a, b) => b.revenue - a.revenue);
    const header = [
      "Property",
      "City",
      "State",
      "Segment",
      "Type",
      "Units",
      "Occupancy",
      "ADR",
      "Bookings",
      "Revenue",
      "vs prior %",
      "Status",
    ];
    const rows = ordered.map((row) => [
      row.property.name,
      row.property.city,
      row.property.state,
      row.property.segment,
      row.property.type,
      row.property.units,
      (row.occupancy * 100).toFixed(1) + "%",
      Math.round(row.adr),
      row.bookings,
      Math.round(row.revenue),
      row.prevRevenue ? row.delta.toFixed(1) : "",
      row.status,
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `rentnest-portfolio_${range.start}_${range.end}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast(`Exported ${ordered.length} properties · ${fmtRange(range.start, range.end)}`);
  };

  const handleShare = () => {
    const share = async () => {
      try {
        await navigator.clipboard.writeText(window.location.href);
        showToast("Report link copied to clipboard");
      } catch {
        showToast("Could not copy the link");
      }
    };
    void share();
  };

  const handleSelectProperty = (name: string) => {
    setSearch(name);
    document.querySelector("#properties")?.scrollIntoView({ behavior: "smooth", block: "start" });
    showToast(`Filtered performance table to ${name}`);
  };

  const scrollTo = (id: string) =>
    document.querySelector(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

  /* ------------------------------------------------------------------- view */
  return (
    <div className="rd bg-canvas text-ink">
        <div id="overview" className="relative scroll-mt-20">
          <div className="page-glow pointer-events-none absolute inset-x-0 top-0 h-[380px]" aria-hidden="true" />
          <div className="relative mx-auto max-w-[1480px] px-4 pb-10 pt-6 sm:px-6 lg:px-8">
            {/* header */}
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface px-1.5 py-1 text-[9.5px] font-semibold uppercase tracking-[0.1em] text-muted">
                    <Icon name="building" size={10} />
                    Owner workspace
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-positive-soft px-2 py-1 text-[10px] font-semibold text-positive">
                    <span className="live-dot h-1.5 w-1.5 rounded-full bg-positive" />
                    Live data
                  </span>
                  <span className="text-[10.5px] text-muted">Updated {lastUpdated}</span>
                </div>
                <h1 className="mt-2.5 font-display text-[26px] font-semibold leading-tight tracking-[-0.03em] text-ink sm:text-[31px]">
                  Portfolio overview
                </h1>
                <p className="mt-1 max-w-[540px] text-[12.5px] leading-relaxed text-muted">
                  You&apos;re tracking{" "}
                  <span className="font-medium text-ink-2">{derived.properties.length} properties</span> across{" "}
                  <span className="font-medium text-ink-2">{derived.units} units</span> — here&apos;s how{" "}
                  {fmtRange(range.start, range.end)} is performing.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <IconButton
                  icon="refresh"
                  label="Refresh dashboard"
                  onClick={handleRefresh}
                  className={cn("border border-line bg-surface text-ink-2", refreshing && "text-brand")}
                />
                <button
                  type="button"
                  onClick={handleExport}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-[11.5px] font-semibold text-ink transition hover:bg-surface-2"
                >
                  <Icon name="download" size={14} className="text-muted" />
                  Export
                </button>
                <button
                  type="button"
                  onClick={handleShare}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-[11.5px] font-semibold text-white shadow-sm transition hover:bg-brand-strong dark:text-[#07130d]"
                >
                  <Icon name="share" size={14} />
                  Share report
                </button>
              </div>
            </div>

            {/* filter bar */}
            <div className="mt-5 flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-surface p-2 card-shadow sm:p-2.5">
              <DateRangeControl preset={preset} range={range} onChange={applyRange} />
              <SegmentControl segments={segments} onChange={setSegments} />
              <div className="hidden h-6 w-px bg-line sm:block" />
              <div className="hidden items-center gap-1.5 pl-0.5 text-[10.5px] text-muted sm:flex">
                <Icon name="home" size={12} />
                <span className="tnum">
                  {derived.properties.length} properties · {derived.units} units
                </span>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <span className="hidden items-center gap-1.5 rounded-full bg-surface-2 px-2 py-1 text-[10px] font-medium text-muted md:flex">
                  <Icon name="clock" size={11} />
                  {PRESET_LABEL[preset]} · {days} days
                </span>
                <button
                  type="button"
                  onClick={handleRefresh}
                  aria-label="Refresh metrics"
                  className="hidden h-7 items-center gap-1.5 rounded-md border border-line bg-surface px-2 text-[10.5px] font-semibold text-ink-2 transition hover:bg-surface-2 sm:inline-flex"
                >
                  <Icon name="refresh" size={11} className={refreshing ? "spin" : ""} />
                  <span>{refreshing ? "Refreshing" : "Refresh"}</span>
                </button>
              </div>
            </div>
            <ActiveFilters
              preset={preset}
              range={range}
              segments={segments}
              onRemoveSegment={removeSegment}
              onReset={resetFilters}
            />

            {/* KPI cards */}
            <div className="mt-6 flex items-end justify-between gap-3">
              <div>
                <h2 className="font-display text-[15px] font-semibold text-ink">Key metrics</h2>
                <p className="mt-0.5 text-[11px] text-muted">
                  Compared with {fmtRange(derived.previousRange.start, derived.previousRange.end)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => showToast("Metric definitions are available in the data dictionary")}
                className="hidden items-center gap-1 text-[10.5px] font-medium text-muted transition hover:text-ink sm:flex"
              >
                <Icon name="info" size={12} />
                Metric definitions
              </button>
            </div>
            <div className="mt-3">
              <KpiCards
                totals={derived.totals}
                previous={derived.priorTotals}
                buckets={derived.buckets}
                propertyCount={derived.properties.length}
              />
            </div>

            {/* properties group (portfolio receivables, rent roll, occupancy, units) */}
            <div className="mt-8 flex items-end justify-between gap-3">
              <div>
                <h2 className="font-display text-[15px] font-semibold text-ink">Properties</h2>
                <p className="mt-0.5 text-[11px] text-muted">Receivables, rent roll, occupancy and units across your properties</p>
              </div>
              <a
                href="#/properties"
                className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-brand transition hover:underline"
              >
                View properties
                <Icon name="arrowRight" size={11} />
              </a>
            </div>
            <div className="mt-3">
              <PropertyKpis />
            </div>
            <div className="mt-3">
              <PropertyArrears />
            </div>

            {/* invoices group (register totals) */}
            <div className="mt-8 flex items-end justify-between gap-3">
              <div>
                <h2 className="font-display text-[15px] font-semibold text-ink">Invoices</h2>
                <p className="mt-0.5 text-[11px] text-muted">What is owed, what is late and what has been collected</p>
              </div>
              <a
                href="#/invoices"
                className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-brand transition hover:underline"
              >
                View invoices
                <Icon name="arrowRight" size={11} />
              </a>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { label: "Outstanding", value: formatCAD(invoiceKpis.outstanding), hint: `${invoiceKpis.openCount} open invoices`, icon: "wallet" as const, tone: "text-ink" },
                { label: "Overdue", value: formatCAD(invoiceKpis.overdueTotal), hint: `${invoiceKpis.overdue} invoices past due`, icon: "clock" as const, tone: "text-negative" },
                { label: "Collected to date", value: formatCAD(invoiceKpis.collected), hint: "All recorded payments", icon: "check" as const, tone: "text-positive" },
                { label: "In register", value: String(invoiceKpis.total), hint: `${invoiceKpis.drafts} drafts pending`, icon: "report" as const, tone: "text-ink" },
              ].map((k) => (
                <a key={k.label} href="#/invoices" className="group block">
                  <Card className="fade-rise p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-brand">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[11.5px] font-medium text-muted">{k.label}</p>
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-muted transition-colors group-hover:bg-brand-soft group-hover:text-brand">
                        <Icon name={k.icon} size={15} />
                      </span>
                    </div>
                    <p className={cn("mt-2.5 font-display text-[27px] font-semibold leading-none tracking-[-0.035em] tnum", k.tone)}>
                      {k.value}
                    </p>
                    <p className="mt-3 border-t border-line-soft pt-2.5 text-[10.5px] text-muted">{k.hint}</p>
                  </Card>
                </a>
              ))}
            </div>

            {/* tenants group (directory totals) */}
            <div className="mt-8 flex items-end justify-between gap-3">
              <div>
                <h2 className="font-display text-[15px] font-semibold text-ink">Tenants</h2>
                <p className="mt-0.5 text-[11px] text-muted">Tenants, active leases and what is still owed</p>
              </div>
              <a
                href="#/tenants"
                className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-brand transition hover:underline"
              >
                View tenants
                <Icon name="arrowRight" size={11} />
              </a>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {[
                {
                  label: "Total tenants",
                  value: String(tenantSummary.tenants),
                  unit: "tenants",
                  hint: `Across ${tenantDb.properties.length} properties in your portfolio`,
                  icon: "users" as const,
                  href: "#/tenants",
                  tone: "text-ink",
                },
                {
                  label: "Active leases",
                  value: String(tenantSummary.activeLeases),
                  unit: "leases",
                  hint: `${expiringLeases} expiring in the next ${warningDays} days`,
                  icon: "report" as const,
                  href: "#/tenants?expiring=1",
                  tone: "text-ink",
                },
                {
                  label: "Outstanding balances",
                  value: tenantMoney(tenantSummary.outstanding),
                  unit: "CAD",
                  hint: `${tenantSummary.outstandingAccounts} accounts with an outstanding balance`,
                  icon: "wallet" as const,
                  href: "#/tenants?outstanding=1",
                  tone: tenantSummary.outstanding > 0 ? "text-amber" : "text-ink",
                },
              ].map((k) => (
                <a key={k.label} href={k.href} className="group block">
                  <Card className="fade-rise p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-brand">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[11.5px] font-medium text-muted">{k.label}</p>
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-muted transition-colors group-hover:bg-brand-soft group-hover:text-brand">
                        <Icon name={k.icon} size={15} />
                      </span>
                    </div>
                    <p className={cn("mt-2.5 font-display text-[27px] font-semibold leading-none tracking-[-0.035em] tnum", k.tone)}>
                      {k.value}
                      <span className="ml-1.5 text-[11px] font-medium tracking-normal text-muted">{k.unit}</span>
                    </p>
                    <p className="mt-3 border-t border-line-soft pt-2.5 text-[10.5px] text-muted">{k.hint}</p>
                  </Card>
                </a>
              ))}
            </div>

            {/* trend + channel mix */}
            <div id="performance" className="mt-3 grid scroll-mt-24 grid-cols-1 gap-3 xl:grid-cols-3">
              <Card className="fade-rise p-4 sm:p-5 xl:col-span-2">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-display text-[16px] font-semibold text-ink">Performance trend</h2>
                      <span className="rounded-full bg-surface-3 px-1.5 py-0.5 text-[9.5px] font-semibold text-muted">
                        {granularity}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11.5px] text-muted">
                      {metric === "revenue"
                        ? "Gross booking revenue"
                        : metric === "occupancy"
                          ? "Weighted portfolio occupancy"
                          : "Confirmed bookings"}{" "}
                      · {fmtRange(range.start, range.end)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Segmented
                      ariaLabel="Choose trend metric"
                      size="sm"
                      value={metric}
                      onChange={setMetric}
                      options={[
                        { value: "revenue", label: "Revenue" },
                        { value: "occupancy", label: "Occupancy" },
                        { value: "bookings", label: "Bookings" },
                      ]}
                    />
                    <div className="flex items-center gap-2 rounded-lg border border-line bg-surface-2 px-2 py-1.5">
                      <Switch
                        checked={compare}
                        onChange={setCompare}
                        label="Compare with previous period"
                        id="compare-toggle"
                      />
                      <span className="text-[10.5px] font-medium text-muted">Compare</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5">
                  <span className="flex items-center gap-1.5 text-[10.5px] font-medium text-ink-2">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{
                        background:
                          metric === "revenue" ? "var(--c1)" : metric === "occupancy" ? "var(--c2)" : "var(--c4)",
                      }}
                    />
                    Current period
                  </span>
                  {compare && (
                    <span className="flex items-center gap-1.5 text-[10.5px] text-muted">
                      <span className="flex items-center gap-0.5">
                        <span className="h-[2px] w-2 rounded-full bg-muted" />
                        <span className="h-[2px] w-2 rounded-full bg-muted" />
                      </span>
                      Previous period
                    </span>
                  )}
                  <span className="ml-auto text-[10px] text-muted tnum">
                    {derived.buckets.length} {granularity.toLowerCase()} points
                  </span>
                </div>

                <div className="mt-4">
                  <TrendChart
                    buckets={derived.buckets}
                    previousBuckets={derived.priorBuckets}
                    metric={metric}
                    compare={compare}
                  />
                </div>

                <div className="mt-4 flex flex-col gap-2 rounded-xl border border-line-soft bg-surface-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                  <p className="flex items-start gap-2 text-[10.5px] leading-relaxed text-muted">
                    <Icon name="sparkles" size={13} className="mt-0.5 shrink-0 text-brand" />
                    <span>
                      <span className="font-semibold text-ink-2">
                        {derived.leader?.property.name ?? "No properties"}
                      </span>{" "}
                      leads on revenue ({money(derived.leader?.revenue ?? 0)})
                      {derived.fastest ? (
                        <>
                          , while{" "}
                          <span className="font-semibold text-ink-2">
                            {derived.fastest.property.name.replace(/^The\s+/i, "")}
                          </span>{" "}
                          {derived.fastest.delta >= 0 ? "grew" : "moved"}{" "}
                          <span
                            className={cn(
                              "font-semibold",
                              derived.fastest.delta >= 0 ? "text-positive" : "text-negative"
                            )}
                          >
                            {signedPct(derived.fastest.delta)}
                          </span>
                          .
                        </>
                      ) : (
                        "."
                      )}
                    </span>
                  </p>
                  <button
                    type="button"
                    onClick={() => scrollTo("#properties")}
                    className="inline-flex shrink-0 items-center gap-1 self-start text-[10.5px] font-semibold text-brand transition hover:underline sm:self-auto"
                  >
                    View properties
                    <Icon name="arrowRight" size={11} />
                  </button>
                </div>
              </Card>

              <Card id="channels" className="fade-rise scroll-mt-24 p-4 sm:p-5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="font-display text-[16px] font-semibold text-ink">Revenue by channel</h2>
                    <p className="mt-0.5 text-[11.5px] text-muted">Booked revenue by booking source</p>
                  </div>
                  <span className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-lg bg-surface-2 text-muted">
                    <Icon name="target" size={14} />
                  </span>
                </div>
                <div className="mt-4">
                  <DonutChart data={derived.channels} totalLabel="Booked revenue" />
                </div>
                <div className="mt-3 flex items-center justify-between gap-2 border-t border-line-soft pt-3">
                  <p className="flex items-center gap-1.5 text-[10.5px] text-muted">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: derived.channels[0]?.color }} />
                    {derived.channels[0]?.label ?? "Direct"} is{" "}
                    <span className="font-semibold text-ink-2">{pct(derived.channels[0]?.pct ?? 0, 0)}</span> of revenue
                  </p>
                  <Delta value={channelGrowth} compact />
                </div>
              </Card>
            </div>

            {/* weekday pace + top performers */}
            <div id="weekday" className="mt-3 grid scroll-mt-24 grid-cols-1 gap-3 xl:grid-cols-3">
              <Card className="fade-rise p-4 sm:p-5 xl:col-span-2">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-display text-[16px] font-semibold text-ink">Booking pace by weekday</h2>
                      {derived.peakWeekday && (
                        <span className="hidden rounded-full bg-brand-soft px-1.5 py-0.5 text-[9.5px] font-semibold text-brand-ink sm:inline">
                          Peak: {derived.peakWeekday.short}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-[11.5px] text-muted">
                      Average {weekdayMetric === "bookings" ? "confirmed bookings" : "revenue"} per day ·{" "}
                      {fmtDate(range.start, "short")} – {fmtDate(range.end, "short")}
                    </p>
                  </div>
                  <Segmented
                    ariaLabel="Choose weekday bar metric"
                    size="sm"
                    value={weekdayMetric}
                    onChange={setWeekdayMetric}
                    options={[
                      { value: "bookings", label: "Bookings" },
                      { value: "revenue", label: "Revenue" },
                    ]}
                  />
                </div>
                <WeekdayBars data={derived.weekday} metric={weekdayMetric} />
                <div className="mt-4 grid grid-cols-3 divide-x divide-line-soft border-t border-line-soft pt-3">
                  {[
                    {
                      label: "Peak day",
                      value: derived.peakWeekday?.short ?? "—",
                      detail: derived.peakWeekday
                        ? weekdayMetric === "bookings"
                          ? `${numberFull(Math.round(derived.peakWeekday.bookings))} avg bookings`
                          : `${money(derived.peakWeekday.revenue)} avg revenue`
                        : "No data",
                    },
                    {
                      label: "Weekend lift",
                      value: (() => {
                        const weekend = derived.weekday.filter((day) => day.short === "Sat" || day.short === "Sun");
                        const midweek = derived.weekday.filter((day) => day.short === "Tue" || day.short === "Wed");
                        const w = weekdayMetric === "bookings" ? "bookings" : "revenue";
                        const weekendAvg =
                          weekend.reduce((sum, day) => sum + day[w], 0) / Math.max(1, weekend.length);
                        const midAvg = midweek.reduce((sum, day) => sum + day[w], 0) / Math.max(1, midweek.length);
                        return midAvg ? signedPct(((weekendAvg - midAvg) / midAvg) * 100, 0) : "—";
                      })(),
                      detail: "vs. Tue–Wed average",
                    },
                    {
                      label: "Quietest day",
                      value:
                        [...derived.weekday].sort((a, b) =>
                          weekdayMetric === "bookings" ? a.bookings - b.bookings : a.revenue - b.revenue
                        )[0]?.short ?? "—",
                      detail: `${numberFull(days)} days analysed`,
                    },
                  ].map((insight) => (
                    <div key={insight.label} className="px-3 first:pl-0">
                      <p className="text-[9px] font-semibold uppercase tracking-[0.07em] text-muted">
                        {insight.label}
                      </p>
                      <p className="mt-1 font-display text-[17px] font-semibold leading-none tracking-tight text-ink tnum">
                        {insight.value}
                      </p>
                      <p className="mt-1 truncate text-[10px] text-muted">{insight.detail}</p>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="fade-rise flex flex-col p-4 sm:p-5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="font-display text-[16px] font-semibold text-ink">Top performers</h2>
                    <p className="mt-0.5 text-[11.5px] text-muted">Ranked by gross booking revenue</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => scrollTo("#properties")}
                    className="flex items-center gap-1 text-[10.5px] font-semibold text-brand transition hover:underline"
                  >
                    View all
                    <Icon name="arrowRight" size={11} />
                  </button>
                </div>
                <div className="mt-2 flex-1 divide-y divide-line-soft">
                  {derived.top.slice(0, 4).map((row, index) => (
                    <button
                      key={row.property.id}
                      type="button"
                      onClick={() => handleSelectProperty(row.property.name)}
                      className="group flex w-full items-center gap-2.5 py-3 text-left transition-colors hover:bg-surface-2/60"
                    >
                      <span className="w-4 shrink-0 text-[10px] font-semibold text-muted tnum">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-[11px] font-bold text-ink-2 transition-colors group-hover:bg-brand-soft group-hover:text-brand-ink">
                        {row.property.name
                          .replace(/^The\s+/i, "")
                          .split(" ")
                          .slice(0, 2)
                          .map((word) => word[0])
                          .join("")}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate text-[12px] font-semibold text-ink">{row.property.name}</span>
                          <span className="shrink-0 text-[11.5px] font-semibold text-ink tnum">{money(row.revenue)}</span>
                        </span>
                        <span className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted">
                          <span
                            className="h-1.5 w-1.5 shrink-0 rounded-full"
                            style={{ background: SEGMENT_META[row.property.segment].color }}
                          />
                          <span className="truncate">{row.property.city}</span>
                          <span className="text-line">|</span>
                          <span className="tnum">{pct(row.occupancy, 0)} occ.</span>
                        </span>
                        <span className="mt-1.5 flex items-center gap-2">
                          <span className="h-1 flex-1 overflow-hidden rounded-full bg-surface-3">
                            <span
                              className="block h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${Math.min(100, row.occupancy * 100)}%`,
                                background: SEGMENT_META[row.property.segment].color,
                              }}
                            />
                          </span>
                          <Delta value={row.prevRevenue ? row.delta : null} compact className="px-1 py-0" />
                        </span>
                      </span>
                    </button>
                  ))}
                  {!derived.top.length && (
                    <p className="py-8 text-center text-[11px] text-muted">No properties in this selection.</p>
                  )}
                </div>
                <div className="mt-2 flex items-center justify-between gap-2 border-t border-line-soft pt-3 text-[10.5px] text-muted">
                  <span>
                    Top 4 drive <span className="font-semibold text-ink-2 tnum">{pct(topShare, 0)}</span> of revenue
                  </span>
                  <span className="flex items-center gap-1 tnum">
                    <Icon name="wallet" size={11} />
                    {moneyFull(totalRevenue)}
                  </span>
                </div>
              </Card>
            </div>

            {/* table */}
            <div className="mt-3">
              <PropertiesTable
                rows={derived.performance}
                search={search}
                onSearchChange={setSearch}
                onExport={handleExport}
                onShowToast={showToast}
              />
            </div>

            <footer className="mt-6 flex flex-col items-center justify-between gap-2 border-t border-line pt-4 text-[10.5px] text-muted sm:flex-row">
              <p>
                © 2026 RentNest · Sample data generated for Jun 30, 2026 · Amounts in USD
              </p>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => showToast("Data dictionary: metrics are aggregated from 800 days of nightly stays")}
                  className="transition hover:text-ink"
                >
                  Data dictionary
                </button>
                <span className="h-3 w-px bg-line" />
                <button
                  type="button"
                  onClick={() => showToast("All systems operational · last checked just now")}
                  className="flex items-center gap-1 transition hover:text-ink"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-positive" />
                  Status
                </button>
                <span className="h-3 w-px bg-line" />
                <button type="button" onClick={() => showToast("Privacy policy · demo environment")} className="transition hover:text-ink">
                  Privacy
                </button>
              </div>
            </footer>
          </div>
        </div>
    </div>
  );
}
