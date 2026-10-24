// One shared copy of the signed-in member's notifications for the top-bar bell and the Notifications page.
// Changes are applied on screen first and rolled back by re-reading when the database refuses them.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAuth } from "../auth/contexts/AuthContext";
import { useOrganization } from "../auth/contexts/OrganizationContext";
import { isSupabaseConfigured } from "../lib/supabase";
import { isActive, newestFirst, summarize, type Summary } from "./logic";
import * as repo from "./repo";
import { defaultPreferences, type AppNotification, type Category, type Preference, type Preferences } from "./types";

const POLL_MS = 60_000;

interface Value {
  configured: boolean;
  ready: boolean;
  error: string | null;
  orgId: string | null;
  /** Active notifications (not snoozed, not expired), newest first. */
  items: AppNotification[];
  summary: Summary;
  properties: { id: string; name: string }[];
  preferences: Preferences;
  /** Re-read; with `events` also create the time-based notifications first. */
  refresh: (events?: boolean) => Promise<void>;
  markRead: (ids: string[]) => Promise<void>;
  markUnread: (ids: string[]) => Promise<void>;
  dismiss: (ids: string[]) => Promise<void>;
  snooze: (ids: string[], until: string) => Promise<void>;
  markAllRead: () => Promise<number>;
  setPreference: (category: Category, patch: Partial<Preference>) => Promise<void>;
  resetPreferences: () => Promise<void>;
}

const Ctx = createContext<Value | null>(null);

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { activeOrganization } = useOrganization();
  const orgId = activeOrganization?.id ?? null;
  const meId = user?.id ?? null;
  const live = isSupabaseConfigured && !!orgId && !!meId;

  const [all, setAll] = useState<AppNotification[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [properties, setProperties] = useState<{ id: string; name: string }[]>([]);
  const [preferences, setPreferences] = useState<Preferences>(defaultPreferences());
  const [now, setNow] = useState(() => new Date());
  const scope = useRef({ orgId, meId });
  scope.current = { orgId, meId };

  const reread = useCallback(async () => {
    const { orgId: o, meId: m } = scope.current;
    if (!o || !m || !isSupabaseConfigured) return;
    try {
      const rows = await repo.list(o, m);
      if (scope.current.orgId === o) { setAll(rows); setError(null); }
    } catch (e) { if (scope.current.orgId === o) setError(e instanceof Error ? e.message : "Unable to load notifications."); }
  }, []);

  const refresh = useCallback(async (events = false) => {
    const { orgId: o } = scope.current;
    if (!o || !isSupabaseConfigured) return;
    if (events) { try { await repo.runEvents(o); } catch { /* the inbox still loads */ } }
    await reread();
  }, [reread]);

  // a new organization (or sign-in): start clean, create the time-based notifications once, then read everything
  useEffect(() => {
    setAll([]); setReady(false); setError(null); setPreferences(defaultPreferences());
    if (!live || !orgId || !meId) return undefined;
    let cancelled = false;
    (async () => {
      try { await repo.runEvents(orgId); } catch { /* the inbox still loads */ }
      const [, prefs, props] = await Promise.all([
        reread(),
        repo.loadPreferences(orgId, meId).catch(() => null),
        repo.listProperties(orgId).catch(() => []),
      ]);
      if (cancelled) return;
      if (prefs) setPreferences(prefs);
      setProperties(props);
      setReady(true);
    })();
    return () => { cancelled = true; };
  }, [live, orgId, meId, reread]);

  // new notifications arrive from other people's actions: look again every minute and when the tab regains focus
  useEffect(() => {
    if (!live) return undefined;
    const tick = () => { setNow(new Date()); if (document.visibilityState === "visible") void reread(); };
    const timer = window.setInterval(tick, POLL_MS);
    const onFocus = () => { setNow(new Date()); void reread(); };
    window.addEventListener("focus", onFocus);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", onFocus); };
  }, [live, reread]);

  const patch = useCallback((ids: string[], change: (n: AppNotification) => AppNotification | null) => {
    const set = new Set(ids);
    setAll((rows) => rows.flatMap((n) => { if (!set.has(n.id)) return [n]; const next = change(n); return next ? [next] : []; }));
  }, []);

  const guard = useCallback(async (run: () => Promise<void>) => {
    try { await run(); } catch (e) { await reread(); throw e; }
  }, [reread]);

  const markRead = useCallback((ids: string[]) => { const at = new Date().toISOString(); patch(ids, (n) => ({ ...n, readAt: n.readAt ?? at })); return guard(() => repo.markRead(ids, at)); }, [patch, guard]);
  const markUnread = useCallback((ids: string[]) => { patch(ids, (n) => ({ ...n, readAt: null })); return guard(() => repo.markUnread(ids)); }, [patch, guard]);
  const dismiss = useCallback((ids: string[]) => { const at = new Date().toISOString(); patch(ids, () => null); return guard(() => repo.dismiss(ids, at)); }, [patch, guard]);
  const snooze = useCallback((ids: string[], until: string) => { patch(ids, (n) => ({ ...n, snoozedUntil: until })); return guard(() => repo.snooze(ids, until)); }, [patch, guard]);

  const markAllRead = useCallback(async () => {
    const { orgId: o, meId: m } = scope.current;
    if (!o || !m) return 0;
    const at = new Date().toISOString();
    const count = all.filter((n) => n.readAt === null && isActive(n)).length;
    setAll((rows) => rows.map((n) => (n.readAt === null ? { ...n, readAt: at } : n)));
    await guard(() => repo.markAllRead(o, m, at));
    return count;
  }, [all, guard]);

  const setPreference = useCallback(async (category: Category, change: Partial<Preference>) => {
    const { orgId: o, meId: m } = scope.current;
    if (!o || !m) return;
    const next = { ...preferences[category], ...change };
    setPreferences((p) => ({ ...p, [category]: next }));
    try { await repo.savePreference(o, m, category, next); }
    catch (e) { setPreferences((p) => ({ ...p, [category]: preferences[category] })); throw e; }
  }, [preferences]);

  const resetPreferences = useCallback(async () => {
    const { orgId: o, meId: m } = scope.current;
    if (!o || !m) return;
    const before = preferences;
    setPreferences(defaultPreferences());
    try { await repo.resetPreferences(o, m); } catch (e) { setPreferences(before); throw e; }
  }, [preferences]);

  const items = useMemo(() => newestFirst(all.filter((n) => isActive(n, now))), [all, now]);
  const summary = useMemo(() => summarize(items), [items]);

  const value = useMemo<Value>(() => ({
    configured: isSupabaseConfigured, ready, error, orgId, items, summary, properties, preferences,
    refresh, markRead, markUnread, dismiss, snooze, markAllRead, setPreference, resetPreferences,
  }), [ready, error, orgId, items, summary, properties, preferences, refresh, markRead, markUnread, dismiss, snooze, markAllRead, setPreference, resetPreferences]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useNotifications(): Value {
  const value = useContext(Ctx);
  if (!value) throw new Error("useNotifications must be used inside NotificationsProvider");
  return value;
}
