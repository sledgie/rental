import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { ArrowDown, ArrowRight, ArrowUp, ArrowUpDown, Check, ChevronLeft, ChevronRight, Download, SearchX, ShieldAlert } from "lucide-react";
import { Button as TnButton, Overlay } from "../tenants/components/ui";
import { FilterField, FilterPopover, SearchField } from "../shell/directory";
import { useAuth } from "../auth/contexts/AuthContext";
import { useOrganization } from "../auth/contexts/OrganizationContext";
import { ACTIONS, ACTOR_TYPES, CATEGORIES, DEFAULT_FILTERS, ENTITY_TYPES, OUTCOMES, SEVERITIES, actionLabel, formatActorType, type ActivityFilters } from "./lib/types";
import { filtersToSearchParams, parseActivityFilters } from "./lib/filters";
import { formatDateTime, formatRelativeTime } from "./lib/format";
import { activityVersion, exportActivityLogs, getActivityById, getActivityLogs, getRecordTimeline, getRelatedActivities, loadActivityFromDatabase, recordedActions, subscribeActivity, type AccessContext } from "./lib/store";
import { isSupabaseConfigured } from "../lib/supabase";
import { ActivityDetail } from "./components/ActivityDetail";
import { RecordTimeline } from "./components/RecordTimeline";
import { ActorAvatar, CategoryBadge, RecordLink, ResultBadge, SeverityIndicator } from "./components/ui";
import "./activitylogs.css";

const TABS = [
  ["", "All activity", "total"],
  ["financial", "Financial", "financial"],
  ["propertyTenant", "Property & tenant", "propertyTenant"],
  ["documentLease", "Documents & leases", "documentLease"],
  ["security", "Security", "security"],
  ["failedDenied", "Failed or denied", "failedDenied"],
] as const;

const isoDate = (date: Date) => date.toISOString().slice(0, 10);
const daysBack = (days: number) => { const from = new Date(); from.setDate(from.getDate() - days); return { from: isoDate(from), to: isoDate(new Date()) }; };

function SortButton({ label, column, filters, onSort }: { label: string; column: string; filters: ActivityFilters; onSort: (column: string) => void }) {
  const active = filters.sort === column;
  return <button type="button" onClick={() => onSort(column)} className={`inline-flex items-center gap-1 whitespace-nowrap text-left text-[10px] font-bold uppercase tracking-[0.08em] ${active ? "text-u-accent" : "text-u-muted hover:text-u-ink"}`}>{label}{active ? (filters.direction === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ArrowUpDown size={11} />}</button>;
}

export default function ActivityLogs({ params, notify }: { params?: Record<string, string>; notify?: (message: string) => void }) {
  const { user } = useAuth();
  const { activeRole, activeOrganization } = useOrganization();
  const [loadError, setLoadError] = useState<string | null>(null);
  // Supabase mode: read the organization's audit trail each time the page opens
  useEffect(() => {
    if (!isSupabaseConfigured || !activeOrganization) return;
    setLoadError(null);
    loadActivityFromDatabase(activeOrganization.id, true).catch((error) => setLoadError(error instanceof Error ? error.message : "Unable to load the activity log."));
  }, [activeOrganization]);
  const manager = activeRole === "Owner" || activeRole === "Administrator";
  const ctx = useMemo<AccessContext>(() => ({
    userId: user?.id ?? "anonymous", userName: user?.fullName ?? "Unknown user",
    canViewTenants: activeRole !== "Maintenance Staff", canViewSensitive: manager, canExport: manager || activeRole === "Accountant",
  }), [user, activeRole, manager]);

  const [filters, setFilters] = useState<ActivityFilters>(() => parseActivityFilters(new URLSearchParams(params)));
  const [searchDraft, setSearchDraft] = useState(filters.q);
  const [exportOpen, setExportOpen] = useState(false);
  const selectedId = params?.event ?? "";
  const record = params?.view === "record" && params.entityType && params.entityId ? { entityType: params.entityType, entityId: params.entityId } : null;
  const version = useSyncExternalStore(subscribeActivity, activityVersion);

  useEffect(() => {
    const timer = setTimeout(() => setFilters((previous) => (previous.q === searchDraft ? previous : { ...previous, q: searchDraft, page: 1 })), 300);
    return () => clearTimeout(timer);
  }, [searchDraft]);

  // keep the address bar in step with the filters without triggering a route change
  useEffect(() => {
    if (record) return;
    const query = filtersToSearchParams(filters);
    if (selectedId) query.set("event", selectedId);
    const text = query.toString();
    window.history.replaceState(null, "", `#/activity-logs${text ? `?${text}` : ""}`);
  }, [filters, selectedId, record]);

  const data = useMemo(() => getActivityLogs(filters, ctx), [filters, ctx, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const selected = useMemo(() => (selectedId ? getActivityById(selectedId, ctx) : null), [selectedId, ctx, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const related = useMemo(() => (selected ? getRelatedActivities(selected.entityType, selected.entityId, ctx, selected.id, 12) : []), [selected, ctx]);
  const timeline = useMemo(() => (record ? getRecordTimeline(record.entityType, record.entityId, ctx) : null), [record?.entityType, record?.entityId, ctx, version]); // eslint-disable-line react-hooks/exhaustive-deps

  const update = <K extends keyof ActivityFilters>(key: K, value: ActivityFilters[K]) => setFilters((previous) => ({ ...previous, [key]: value, page: 1 }));
  const clear = () => { setSearchDraft(""); setFilters({ ...DEFAULT_FILTERS, pageSize: filters.pageSize }); };
  const sortBy = (column: string) => setFilters((previous) => ({ ...previous, sort: column, direction: previous.sort === column && previous.direction === "desc" ? "asc" : "desc", page: 1 }));
  const openEvent = (id: string) => { window.location.hash = `#/activity-logs?${(() => { const q = filtersToSearchParams(filters); q.set("event", id); return q.toString(); })()}`; };
  const closeEvent = () => { const q = filtersToSearchParams(filters).toString(); window.location.hash = `#/activity-logs${q ? `?${q}` : ""}`; };
  const popoverCount = [filters.actorId, filters.actorType, filters.category, filters.action, filters.propertyId, filters.unitId, filters.entityType, filters.outcome, filters.severity, filters.from, filters.to].filter(Boolean).length;
  const units = filters.propertyId ? data.options.units.filter((unit) => unit.propertyId === filters.propertyId) : data.options.units;
  const firstRow = data.total ? (data.page - 1) * data.pageSize + 1 : 0;
  const lastRow = Math.min(data.page * data.pageSize, data.total);

  function download() {
    const result = exportActivityLogs(filters, ctx);
    const url = URL.createObjectURL(new Blob([result.csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = result.fileName;
    document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
    setExportOpen(false);
    notify?.(`CSV downloaded · ${result.rowCount} records. Export recorded in the audit trail.`);
  }

  return <div className="tn alg">
    <div className="app-shell"><div className="main-shell"><main className="main-content">
      <div className="page-heading">
        <div>
          <div className="page-title-line"><h1>Activity Logs</h1><span className="muted">{data.summary.total.toLocaleString()} events</span></div>
          <p>Track important actions, changes and system events across your rental property business. The audit trail is append-only.</p>
        </div>
        <div className="page-heading-actions no-print">
          <TnButton type="button" variant="primary" disabled={!ctx.canExport} title={ctx.canExport ? undefined : "Your role cannot export the audit trail"} onClick={() => setExportOpen(true)}><Download size={15} />Export CSV</TnButton>
        </div>
      </div>

      <section className="directory-panel" aria-label="Activity records">
        {record && timeline ? (
          <div className="u-root alg-body"><RecordTimeline title={timeline.title} subtitle={timeline.subtitle} entityType={timeline.entityType} entityId={timeline.entityId} events={timeline.events} /></div>
        ) : <>
          <div className="directory-tabs no-print" aria-label="Filter activity by group">
            {TABS.map(([value, label, key]) => (
              <button key={value} type="button" className={`directory-tab ${filters.group === value ? "selected" : ""}`} aria-pressed={filters.group === value} onClick={() => update("group", value)}>{label}<span>{data.summary[key as keyof typeof data.summary]}</span></button>
            ))}
            <div className="directory-tabs-end"><span className="live-dot" />{isSupabaseConfigured ? (loadError ?? "Live · your organization's audit trail") : "Sample data · held in memory for this session"}</div>
          </div>
          <div className="directory-toolbar no-print">
            <SearchField label="Search activity" placeholder="Search description, actor, property, unit, record or event ID..." value={searchDraft} onChange={setSearchDraft} />
            <div className="toolbar-actions">
              <FilterPopover title="Filter activity" count={popoverCount} onReset={() => setFilters((previous) => ({ ...DEFAULT_FILTERS, q: previous.q, group: previous.group, pageSize: previous.pageSize }))}>
                <FilterField id="al-actor" label="Actor"><select id="al-actor" value={filters.actorId} onChange={(e) => update("actorId", e.target.value)}><option value="">All users & actors</option>{data.options.actors.map((actor) => <option key={actor.id} value={actor.id}>{actor.name} · {formatActorType(actor.type)}</option>)}</select></FilterField>
                <FilterField id="al-atype" label="Actor type"><select id="al-atype" value={filters.actorType} onChange={(e) => update("actorType", e.target.value)}><option value="">All actor types</option>{ACTOR_TYPES.map((type) => <option key={type} value={type}>{formatActorType(type)}</option>)}</select></FilterField>
                <FilterField id="al-category" label="Category"><select id="al-category" value={filters.category} onChange={(e) => update("category", e.target.value)}><option value="">All categories</option>{CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select></FilterField>
                <FilterField id="al-action" label="Action type"><select id="al-action" value={filters.action} onChange={(e) => update("action", e.target.value)}><option value="">All action types</option>{(isSupabaseConfigured ? recordedActions() : ACTIONS).map((action) => <option key={action} value={action}>{actionLabel(action)}</option>)}</select></FilterField>
                <FilterField id="al-property" label="Property"><select id="al-property" value={filters.propertyId} onChange={(e) => setFilters((previous) => ({ ...previous, propertyId: e.target.value, unitId: "", page: 1 }))}><option value="">All properties</option>{data.options.properties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}</select></FilterField>
                <FilterField id="al-unit" label="Unit"><select id="al-unit" value={filters.unitId} onChange={(e) => update("unitId", e.target.value)}><option value="">All units</option>{units.map((unit) => <option key={unit.id} value={unit.id}>{unit.propertyName} · {unit.number}</option>)}</select></FilterField>
                <FilterField id="al-entity" label="Related entity type"><select id="al-entity" value={filters.entityType} onChange={(e) => update("entityType", e.target.value)}><option value="">All entity types</option>{ENTITY_TYPES.map((type) => <option key={type} value={type}>{type.replaceAll("_", " ")}</option>)}</select></FilterField>
                <FilterField id="al-outcome" label="Result"><select id="al-outcome" value={filters.outcome} onChange={(e) => update("outcome", e.target.value)}><option value="">All results</option>{OUTCOMES.map((outcome) => <option key={outcome} value={outcome}>{outcome[0].toUpperCase() + outcome.slice(1)}</option>)}</select></FilterField>
                <FilterField id="al-severity" label="Severity"><select id="al-severity" value={filters.severity} onChange={(e) => update("severity", e.target.value)}><option value="">All severities</option>{SEVERITIES.map((severity) => <option key={severity} value={severity}>{severity[0].toUpperCase() + severity.slice(1)}</option>)}</select></FilterField>
                <FilterField id="al-range" label="Date range">
                  <select id="al-range" value={filters.from || filters.to ? "custom" : ""} onChange={(e) => { const days = Number(e.target.value); setFilters((previous) => ({ ...previous, ...(days ? daysBack(days) : { from: "", to: "" }), page: 1 })); }}>
                    <option value="">All time</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option>{filters.from || filters.to ? <option value="custom" disabled>Custom range</option> : null}
                  </select>
                </FilterField>
                <FilterField id="al-from" label="From"><input id="al-from" type="date" value={filters.from} onChange={(e) => update("from", e.target.value)} /></FilterField>
                <FilterField id="al-to" label="To"><input id="al-to" type="date" value={filters.to} onChange={(e) => update("to", e.target.value)} /></FilterField>
              </FilterPopover>
            </div>
          </div>

          <div className="u-root alg-body">
            {!data.items.length ? (
              <div className="px-6 py-14 text-center"><SearchX size={28} className="mx-auto text-u-s3" /><h2 className="mt-3 text-sm font-semibold text-u-ink">No activity matches these filters</h2><p className="mt-1 text-xs text-u-muted">Try a broader date range, remove a filter, or search by a different record or event ID.</p><button type="button" className="alg-btn mt-4" onClick={clear}>Clear all filters</button></div>
            ) : <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[960px] text-left">
                  <thead><tr className="border-b border-u-line bg-u-s2/70">
                    <th className="px-4 py-3"><SortButton label="Date & time" column="occurredAt" filters={filters} onSort={sortBy} /></th>
                    <th className="px-3 py-3"><SortButton label="User / actor" column="actorDisplayName" filters={filters} onSort={sortBy} /></th>
                    <th className="px-3 py-3"><SortButton label="Activity" column="action" filters={filters} onSort={sortBy} /></th>
                    <th className="px-3 py-3"><SortButton label="Category" column="category" filters={filters} onSort={sortBy} /></th>
                    <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-[0.08em] text-u-muted">Property</th>
                    <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-[0.08em] text-u-muted">Related record</th>
                    <th className="px-3 py-3"><SortButton label="Result" column="outcome" filters={filters} onSort={sortBy} /></th>
                    <th className="w-10 px-3 py-3"><span className="sr-only">Open</span></th>
                  </tr></thead>
                  <tbody className="divide-y divide-u-line">
                    {data.items.map((event) => (
                      <tr key={event.id} tabIndex={0} onClick={() => openEvent(event.id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openEvent(event.id); } }} className="cursor-pointer hover:bg-u-s2/70 focus:bg-u-s2/70 focus:outline-none">
                        <td className="whitespace-nowrap px-4 py-3.5"><p className="text-xs font-medium text-u-ink">{formatDateTime(event.occurredAt)}</p><p className="mt-0.5 text-[10px] text-u-muted">{formatRelativeTime(event.occurredAt)}</p></td>
                        <td className="px-3 py-3.5"><div className="flex items-center gap-2"><ActorAvatar name={event.actorDisplayName} actorType={event.actorType} /><div className="min-w-0"><p className="truncate text-xs font-medium text-u-ink">{event.actorDisplayName}</p><p className="text-[10px] text-u-muted">{formatActorType(event.actorType)}</p></div></div></td>
                        <td className="max-w-[320px] px-3 py-3.5"><p className="line-clamp-2 text-xs text-u-ink">{event.description}</p><p className="mt-1 flex items-center gap-1.5 text-[10px] text-u-muted"><SeverityIndicator severity={event.severity} />{actionLabel(event.action)}</p></td>
                        <td className="px-3 py-3.5"><CategoryBadge category={event.category} /></td>
                        <td className="px-3 py-3.5 text-xs text-u-ink2">{event.propertyName ?? "Workspace"}{event.unitNumber ? <span className="block text-[10px] text-u-muted">Unit {event.unitNumber}</span> : null}</td>
                        <td className="px-3 py-3.5 text-xs" onClick={(e) => e.stopPropagation()}><RecordLink event={event} label={event.relatedRecordLabel} className="max-w-[160px] truncate" /></td>
                        <td className="px-3 py-3.5"><ResultBadge outcome={event.outcome} /></td>
                        <td className="px-3 py-3.5 text-u-s3"><ArrowRight size={15} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="divide-y divide-u-line md:hidden">
                {data.items.map((event) => (
                  <article key={event.id} tabIndex={0} onClick={() => openEvent(event.id)} className="cursor-pointer p-4 hover:bg-u-s2/70">
                    <div className="flex items-start gap-3"><ActorAvatar name={event.actorDisplayName} actorType={event.actorType} />
                      <div className="min-w-0 flex-1"><p className="text-xs font-semibold leading-5 text-u-ink">{event.description}</p><p className="mt-1 text-[10px] text-u-muted">{event.actorDisplayName} · {formatRelativeTime(event.occurredAt)}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2"><CategoryBadge category={event.category} /><ResultBadge outcome={event.outcome} /></div></div></div>
                  </article>
                ))}
              </div>
              <div className="flex flex-col items-center justify-between gap-3 border-t border-u-line px-4 py-3 text-[11px] text-u-muted sm:flex-row">
                <div className="flex items-center gap-3"><span>{firstRow}–{lastRow} of {data.total}</span>
                  <label className="flex items-center gap-1.5">Rows<select aria-label="Rows per page" value={filters.pageSize} onChange={(e) => update("pageSize", Number(e.target.value))} className="alg-select">{[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}</select></label></div>
                <div className="flex items-center gap-1">
                  <button type="button" className="alg-pg" disabled={data.page <= 1} onClick={() => update("page", data.page - 1)} aria-label="Previous page"><ChevronLeft size={15} /></button>
                  <span className="px-2">Page {data.page} of {data.totalPages}</span>
                  <button type="button" className="alg-pg" disabled={data.page >= data.totalPages} onClick={() => update("page", data.page + 1)} aria-label="Next page"><ChevronRight size={15} /></button>
                </div>
              </div>
            </>}
          </div>
        </>}
      </section>
      <div className="directory-footnote no-print"><span><ShieldAlert size={12} /> Audit events are append-only. Change values and secrets are never included in CSV exports.</span></div>
    </main></div></div>

    {selected && !record && (
      <Overlay title={selected.description} subtitle={`Activity details · ${selected.id}`} drawer wide onClose={closeEvent} className="alg-drawer">
        <div className="u-drawer-scroll"><div className="u-root alg">
          <div className="px-5 py-5 sm:px-6"><ActivityDetail event={selected} related={related} canViewRecords canViewSensitive={ctx.canViewSensitive} onNavigate={openEvent} /></div>
        </div></div>
      </Overlay>
    )}

    {exportOpen && (
      <Overlay title="Export filtered activity?" subtitle="The CSV follows the active search, tab and filters." onClose={() => setExportOpen(false)} className="alg-modal">
        <div className="u-root alg"><div className="space-y-4 px-5 py-5">
          <p className="text-sm text-u-ink2">Your CSV will include <strong className="text-u-ink">{data.total.toLocaleString()} matching events</strong>{isSupabaseConfigured ? "" : " from the sample workspace"}.</p>
          <div className="rounded-xl bg-u-s2 p-3.5 text-xs leading-5 text-u-ink2">
            {["Before/after values are excluded", "Untrusted cells are formula-escaped", "This sensitive export will be audit logged"].map((line) => <p key={line} className="flex items-center gap-2 py-0.5"><Check size={14} className="text-u-ok" />{line}</p>)}
          </div>
          <div className="flex justify-end gap-2"><button type="button" className="alg-btn" onClick={() => setExportOpen(false)}>Cancel</button><button type="button" className="alg-btn alg-btn-primary" onClick={download}><Download size={14} />Download CSV</button></div>
        </div></div>
      </Overlay>
    )}
  </div>;
}
