import { useCallback, useEffect, useMemo, useState } from "react";
import { Bell, BellRing, CheckCheck, ChevronDown, EyeOff, RefreshCw, SearchX, SlidersHorizontal, Trash2, TriangleAlert, X } from "lucide-react";
import { Button as TnButton } from "../tenants/components/ui";
import { FilterField, FilterPopover, SearchField } from "../shell/directory";
import { isSupabaseConfigured } from "../lib/supabase";
import { useOrganization } from "../auth/contexts/OrganizationContext";
import { useNotifications } from "./NotificationsProvider";
import { NotificationRow, cx } from "./components/NotificationRow";
import PreferencesPanel from "./components/PreferencesPanel";
import { advancedCount, applyFilters, groupByDate, isUnread } from "./logic";
import { CATEGORY_META, SEVERITY_META } from "./meta";
import { CATEGORY_ORDER, EMPTY_FILTERS, SEVERITY_ORDER, type AppNotification, type Filters, type Quick } from "./types";
import "./notificationcenter.css";

type Tab = "inbox" | "preferences";
const QUICK: [Quick, string][] = [["all", "All"], ["unread", "Unread"], ["action", "Needs action"], ["high", "High priority"]];
const PAGE_SIZE = 20;

function Empty({ icon, title, hint, children }: { icon?: React.ReactNode; title: string; hint?: string; children?: React.ReactNode }) {
  return (
    <div className="px-6 py-12 text-center">
      {icon ? <div className="mx-auto mb-3 flex justify-center text-u-s3">{icon}</div> : null}
      <h2 className="text-sm font-semibold text-u-ink">{title}</h2>
      {hint ? <p className="mx-auto mt-1 max-w-md text-xs text-u-muted">{hint}</p> : null}
      {children ? <div className="mt-3 flex justify-center gap-2">{children}</div> : null}
    </div>
  );
}

export default function NotificationCenter({ params, notify }: { params?: Record<string, string>; notify?: (message: string) => void }) {
  const { activeOrganization } = useOrganization();
  const nc = useNotifications();
  const say = useCallback((message: string) => notify?.(message), [notify]);
  const failed = useCallback((e: unknown) => say(e instanceof Error ? e.message : "Something went wrong."), [say]);

  const [tab, setTab] = useState<Tab>(params?.tab === "preferences" ? "preferences" : "inbox");
  const [filters, setFilters] = useState<Filters>({ ...EMPTY_FILTERS, query: params?.q ?? "", quick: (QUICK.find((q) => q[0] === params?.quick)?.[0] ?? "all") as Quick });
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmDismiss, setConfirmDismiss] = useState<string[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // opening the page also creates the time-based notifications (overdue invoices, expiring leases, ...)
  const { refresh } = nc;
  useEffect(() => { if (isSupabaseConfigured) void refresh(true); }, [refresh]);
  useEffect(() => { setVisible(PAGE_SIZE); }, [filters]);
  useEffect(() => { if (params?.tab === "preferences") setTab("preferences"); }, [params?.tab]);

  const filtered = useMemo(() => applyFilters(nc.items, filters), [nc.items, filters]);
  const shown = filtered.slice(0, visible);
  const groups = useMemo(() => groupByDate(shown), [shown]);
  const remaining = filtered.length - shown.length;
  // keep the selection to what is still on screen
  useEffect(() => {
    setSelected((prev) => { if (!prev.size) return prev; const ids = new Set(filtered.map((n) => n.id)); const next = new Set([...prev].filter((id) => ids.has(id))); return next.size === prev.size ? prev : next; });
  }, [filtered]);

  const catCount = useMemo(() => { const m = new Map<string, number>(); for (const n of nc.items) m.set(n.category, (m.get(n.category) ?? 0) + 1); return m; }, [nc.items]);
  const set = (patch: Partial<Filters>) => setFilters((f) => ({ ...f, ...patch }));
  const filterCount = advancedCount(filters);
  const allShownSelected = shown.length > 0 && shown.every((n) => selected.has(n.id));

  const toggle = (id: string) => setSelected((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const run = (action: Promise<unknown>, done?: string) => { action.then(() => { if (done) say(done); }, failed); };
  const open = (n: AppNotification) => { if (isUnread(n)) run(nc.markRead([n.id])); };
  const dismiss = (ids: string[]) => { setSelected(new Set()); setConfirmDismiss(null); run(nc.dismiss(ids), ids.length === 1 ? "Notification dismissed." : `${ids.length} notifications dismissed.`); };

  async function markAll() {
    try { const n = await nc.markAllRead(); say(n ? `Marked ${n} notification${n === 1 ? "" : "s"} as read.` : "Everything is already read."); } catch (e) { failed(e); }
  }
  async function reload() {
    setRefreshing(true);
    try { await nc.refresh(true); say("Notifications refreshed."); } catch (e) { failed(e); } finally { setRefreshing(false); }
  }

  const cards = [
    { id: "all" as Quick, label: "All notifications", value: nc.summary.total, sub: "In your inbox", icon: Bell, tone: "bg-u-accent-soft text-u-accent" },
    { id: "unread" as Quick, label: "Unread", value: nc.summary.unread, sub: "Waiting for you", icon: BellRing, tone: "bg-u-blue-soft text-u-blue" },
    { id: "high" as Quick, label: "Urgent", value: nc.summary.urgent, sub: "Unread, high or critical", icon: TriangleAlert, tone: "bg-u-danger-soft text-u-danger" },
  ];

  const inbox = (() => {
    if (!isSupabaseConfigured) return <Empty icon={<Bell size={28} />} title="Notifications need your database connection" hint="Connect the app to Supabase (see web/.env.example) to receive notifications. Nothing is stored in the browser." />;
    if (nc.error && !nc.items.length) return <Empty icon={<TriangleAlert size={28} />} title="Notifications could not be loaded" hint={nc.error}><button type="button" className="nc-btn" onClick={() => void reload()}>Try again</button></Empty>;
    if (!nc.ready) return <Empty title="Loading notifications…" />;
    if (!filtered.length) {
      const any = nc.items.length > 0;
      return (
        <Empty icon={any ? <SearchX size={28} /> : <Bell size={28} />} title={any ? "Nothing matches these filters" : "You're all caught up"}
          hint={any ? "Try a broader search or clear the filters." : "New payments, requests, leases and reminders will show up here as they happen."}>
          {any && <button type="button" className="nc-btn" onClick={() => setFilters(EMPTY_FILTERS)}>Clear filters</button>}
        </Empty>
      );
    }
    return (
      <>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-u-line bg-u-s2/60 px-4 py-2.5">
          <label className="flex items-center gap-2.5 text-xs text-u-muted">
            <input type="checkbox" className="size-4 cursor-pointer accent-[var(--accent)]" checked={allShownSelected} aria-label="Select all shown notifications"
              onChange={() => setSelected(allShownSelected ? new Set() : new Set(shown.map((n) => n.id)))} />
            Showing <b className="text-u-ink">{shown.length}</b> of <b className="text-u-ink">{filtered.length}</b>
          </label>
          {selected.size > 0 && (
            <div role="toolbar" aria-label="Bulk actions" className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-xs font-semibold text-u-accent" role="status">{selected.size} selected</span>
              <button type="button" className="nc-btn" onClick={() => { const ids = [...selected]; run(nc.markRead(ids), `${ids.length} marked as read.`); }}><CheckCheck size={14} />Mark read</button>
              <button type="button" className="nc-btn" onClick={() => { const ids = [...selected]; run(nc.markUnread(ids), `${ids.length} marked as unread.`); }}><EyeOff size={14} />Mark unread</button>
              {confirmDismiss ? (
                <>
                  <span className="text-xs text-u-ink2">Dismiss {confirmDismiss.length}? This only clears your inbox.</span>
                  <button type="button" className="nc-btn nc-btn-danger" onClick={() => dismiss(confirmDismiss)}>Dismiss</button>
                  <button type="button" className="nc-btn" onClick={() => setConfirmDismiss(null)}>Cancel</button>
                </>
              ) : <button type="button" className="nc-btn nc-btn-danger" onClick={() => setConfirmDismiss([...selected])}><Trash2 size={14} />Dismiss</button>}
              <button type="button" className="nc-btn nc-btn-ghost" onClick={() => { setSelected(new Set()); setConfirmDismiss(null); }}><X size={14} />Clear</button>
            </div>
          )}
        </div>
        {groups.map((g) => (
          <section key={g.bucket} aria-label={`${g.label} notifications`}>
            <div className="flex items-center justify-between border-b border-u-line bg-u-s2/40 px-4 py-1.5">
              <h2 className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-u-ink2">{g.label}</h2>
              <span className="text-[11px] text-u-muted">{g.items.length}{g.items.some(isUnread) ? ` · ${g.items.filter(isUnread).length} unread` : ""}</span>
            </div>
            <ul className="divide-y divide-u-line border-b border-u-line">
              {g.items.map((n) => (
                <NotificationRow key={n.id} n={n} selected={selected.has(n.id)} onSelect={toggle} onOpen={open}
                  onMarkRead={(ids) => run(nc.markRead(ids))} onMarkUnread={(ids) => run(nc.markUnread(ids))}
                  onDismiss={(ids) => dismiss(ids)}
                  onSnooze={(item, minutes, label) => run(nc.snooze([item.id], new Date(Date.now() + minutes * 60_000).toISOString()), `Snoozed for ${label.toLowerCase()}.`)} />
              ))}
            </ul>
          </section>
        ))}
        <div className="flex items-center justify-between gap-2 px-4 py-3">
          <p className="text-xs text-u-muted">{remaining > 0 ? `${remaining} older notification${remaining === 1 ? "" : "s"} available` : "End of the list"}</p>
          <button type="button" className="nc-btn" disabled={remaining <= 0} onClick={() => setVisible((v) => v + PAGE_SIZE)}>Load more<ChevronDown size={14} /></button>
        </div>
      </>
    );
  })();

  return <div className="tn nc">
    <div className="app-shell"><div className="main-shell"><main className="main-content">
      <div className="page-heading">
        <div>
          <div className="page-title-line"><h1>Notifications</h1><span className="muted">{nc.ready ? `${nc.summary.unread} unread` : ""}</span></div>
          <p>Payments, leases, maintenance and reminders that need your attention{activeOrganization ? ` in ${activeOrganization.name}` : ""}.</p>
        </div>
        <div className="page-heading-actions no-print">
          <TnButton type="button" variant="secondary" disabled={!nc.ready || refreshing} onClick={() => void reload()}><RefreshCw size={15} />Refresh</TnButton>
          <TnButton type="button" variant="primary" disabled={!nc.ready || nc.summary.unread === 0} onClick={() => void markAll()}><CheckCheck size={15} />Mark all as read</TnButton>
        </div>
      </div>

      <section className="directory-panel" aria-label="Notifications">
        {nc.ready && (
          <div className="u-root nc-body">
            <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-3">
              {cards.map((c) => (
                <button key={c.id} type="button" onClick={() => { setTab("inbox"); set({ quick: c.id }); }} aria-pressed={tab === "inbox" && filters.quick === c.id}
                  className={cx("flex items-center gap-3 rounded-xl border bg-u-card p-3.5 text-left transition-colors hover:border-u-muted", tab === "inbox" && filters.quick === c.id ? "border-u-accent" : "border-u-line")}>
                  <span className={cx("flex size-10 shrink-0 items-center justify-center rounded-lg", c.tone)}><c.icon size={19} /></span>
                  <span className="min-w-0"><span className="block text-xs font-semibold text-u-ink2">{c.label}</span><span className="block text-2xl font-semibold leading-7 tracking-tight text-u-ink">{c.value}</span><span className="block truncate text-[11px] text-u-muted">{c.sub}</span></span>
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="directory-tabs no-print" aria-label="Views">
          <button type="button" className={`directory-tab ${tab === "inbox" ? "selected" : ""}`} aria-pressed={tab === "inbox"} onClick={() => setTab("inbox")}>Inbox{nc.ready ? <span>{nc.summary.total}</span> : null}</button>
          <button type="button" className={`directory-tab ${tab === "preferences" ? "selected" : ""}`} aria-pressed={tab === "preferences"} onClick={() => setTab("preferences")}>Preferences</button>
          <div className="directory-tabs-end"><span className="live-dot" />{isSupabaseConfigured ? "Live · your notifications only" : "Not connected"}</div>
        </div>

        {tab === "inbox" && nc.ready && (
          <>
            <div className="directory-toolbar no-print">
              <SearchField label="Search notifications" placeholder="Search title, details, property…" value={filters.query} onChange={(query) => set({ query })} />
              <div className="toolbar-actions">
                <FilterPopover title="Filter notifications" count={filterCount} onReset={() => setFilters((f) => ({ ...EMPTY_FILTERS, query: f.query, quick: f.quick }))}>
                  <FilterField id="nc-f-cat" label="Category"><select id="nc-f-cat" value={filters.category} onChange={(e) => set({ category: e.target.value as Filters["category"] })}><option value="">All categories</option>{CATEGORY_ORDER.map((c) => <option key={c} value={c}>{CATEGORY_META[c].label}</option>)}</select></FilterField>
                  <FilterField id="nc-f-sev" label="Severity"><select id="nc-f-sev" value={filters.severity} onChange={(e) => set({ severity: e.target.value as Filters["severity"] })}><option value="">All severities</option>{[...SEVERITY_ORDER].reverse().map((s) => <option key={s} value={s}>{SEVERITY_META[s].label}</option>)}</select></FilterField>
                  <FilterField id="nc-f-read" label="Read status"><select id="nc-f-read" value={filters.read} onChange={(e) => set({ read: e.target.value as Filters["read"] })}><option value="">All</option><option value="unread">Unread only</option><option value="read">Read only</option></select></FilterField>
                  <FilterField id="nc-f-prop" label="Property"><select id="nc-f-prop" value={filters.propertyId} onChange={(e) => set({ propertyId: e.target.value })}><option value="">All properties</option>{nc.properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></FilterField>
                  <FilterField id="nc-f-from" label="From"><input id="nc-f-from" type="date" value={filters.from} onChange={(e) => set({ from: e.target.value })} /></FilterField>
                  <FilterField id="nc-f-to" label="To"><input id="nc-f-to" type="date" value={filters.to} onChange={(e) => set({ to: e.target.value })} /></FilterField>
                </FilterPopover>
              </div>
            </div>
            <div className="u-root nc-body">
              <div className="flex flex-wrap gap-1.5 border-b border-u-line px-4 py-3">
                {QUICK.map(([key, label]) => (
                  <button key={key} type="button" className="nc-chip" aria-pressed={filters.quick === key} onClick={() => set({ quick: key })}>
                    {label}{key === "unread" && nc.summary.unread > 0 && <span className="nc-chip-count">{nc.summary.unread}</span>}{key === "action" && nc.summary.action > 0 && <span className="nc-chip-count">{nc.summary.action}</span>}
                  </button>
                ))}
                <span aria-hidden className="mx-1 hidden w-px bg-u-line sm:block" />
                {CATEGORY_ORDER.filter((c) => catCount.get(c)).map((c) => (
                  <button key={c} type="button" className="nc-chip" aria-pressed={filters.category === c} onClick={() => set({ category: filters.category === c ? "" : c })}>
                    <CATEGORY_META_ICON category={c} />{CATEGORY_META[c].short}<span className="text-u-muted">{catCount.get(c)}</span>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        <div className="u-root nc-body">
          {tab === "preferences" && isSupabaseConfigured && nc.ready
            ? <PreferencesPanel preferences={nc.preferences} orgName={activeOrganization?.name ?? "this organization"}
                onChange={(category, patch) => { nc.setPreference(category, patch).then(() => say("Preference saved."), failed); }}
                onReset={() => { nc.resetPreferences().then(() => say("Defaults restored."), failed); }} />
            : tab === "preferences" ? <Empty title="Preferences need your database connection" hint="Connect the app to Supabase to choose what you are notified about." /> : inbox}
        </div>
      </section>
      <div className="directory-footnote no-print"><span><SlidersHorizontal size={12} /> You only see your own notifications. Dismissing one clears your inbox and never changes the invoice, request or lease behind it.</span></div>
    </main></div></div>
  </div>;
}

function CATEGORY_META_ICON({ category }: { category: keyof typeof CATEGORY_META }) {
  const Icon = CATEGORY_META[category].icon;
  return <Icon size={12} aria-hidden />;
}
