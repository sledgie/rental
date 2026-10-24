// Pure helpers for the inbox: what is active, summaries, filters, date groups and wording. No data access here.
import { CATEGORY_META, SEVERITY_META } from "./meta";
import type { AppNotification, Filters } from "./types";

/** In the inbox = not snoozed into the future and not expired (dismissed rows are never loaded). */
export function isActive(n: AppNotification, now: Date = new Date()): boolean {
  if (n.snoozedUntil && new Date(n.snoozedUntil).getTime() > now.getTime()) return false;
  if (n.expiresAt && new Date(n.expiresAt).getTime() < now.getTime()) return false;
  return true;
}
export const isUnread = (n: AppNotification) => n.readAt === null;
export const isUrgent = (n: AppNotification) => SEVERITY_META[n.severity].weight >= SEVERITY_META.high.weight;

export interface Summary { total: number; unread: number; urgent: number; action: number }
export function summarize(list: AppNotification[]): Summary {
  const unread = list.filter(isUnread);
  return { total: list.length, unread: unread.length, urgent: unread.filter(isUrgent).length, action: unread.filter((n) => n.actionRequired).length };
}

const localDay = (iso: string) => new Date(iso).toLocaleDateString("en-CA");

function matchesQuery(n: AppNotification, raw: string): boolean {
  const q = raw.trim().toLowerCase();
  if (!q) return true;
  const hay = [n.title, n.message, n.propertyName, n.eventType.replace(/_/g, " "), CATEGORY_META[n.category].label, SEVERITY_META[n.severity].label].filter(Boolean).join(" ").toLowerCase();
  return q.split(/\s+/).every((token) => hay.includes(token));
}

export function applyFilters(list: AppNotification[], f: Filters): AppNotification[] {
  return list.filter((n) => {
    if (f.quick === "unread" && !isUnread(n)) return false;
    if (f.quick === "action" && !(n.actionRequired && isUnread(n))) return false;
    if (f.quick === "high" && !isUrgent(n)) return false;
    if (f.category && n.category !== f.category) return false;
    if (f.severity && n.severity !== f.severity) return false;
    if (f.read === "unread" && !isUnread(n)) return false;
    if (f.read === "read" && isUnread(n)) return false;
    if (f.propertyId && n.propertyId !== f.propertyId) return false;
    if (f.from && localDay(n.createdAt) < f.from) return false;
    if (f.to && localDay(n.createdAt) > f.to) return false;
    return matchesQuery(n, f.query);
  });
}

/** How many filters beyond the quick chip and the search box are applied (shown on the Filter button). */
export const advancedCount = (f: Filters) => [f.category, f.severity, f.read, f.propertyId, f.from, f.to].filter(Boolean).length;

/* ---------------------------------------------------------------- date groups */

export type Bucket = "today" | "yesterday" | "this_week" | "earlier";
export const BUCKET_LABEL: Record<Bucket, string> = { today: "Today", yesterday: "Yesterday", this_week: "Earlier this week", earlier: "Earlier" };
const BUCKET_ORDER: Bucket[] = ["today", "yesterday", "this_week", "earlier"];

const startOfDay = (d: Date) => { const c = new Date(d); c.setHours(0, 0, 0, 0); return c; };

export function bucketOf(iso: string, now: Date = new Date()): Bucket {
  const created = new Date(iso).getTime();
  const today = startOfDay(now);
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  const week = new Date(today); week.setDate(today.getDate() - ((today.getDay() + 6) % 7));       // Monday
  if (created >= today.getTime()) return "today";
  if (created >= yesterday.getTime()) return "yesterday";
  if (created >= week.getTime()) return "this_week";
  return "earlier";
}

export interface Group { bucket: Bucket; label: string; items: AppNotification[] }
export function groupByDate(list: AppNotification[], now: Date = new Date()): Group[] {
  const by = new Map<Bucket, AppNotification[]>();
  for (const n of list) { const b = bucketOf(n.createdAt, now); by.set(b, [...(by.get(b) ?? []), n]); }
  return BUCKET_ORDER.filter((b) => by.has(b)).map((b) => ({ bucket: b, label: BUCKET_LABEL[b], items: by.get(b)! }));
}

export const newestFirst = (list: AppNotification[]) => [...list].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

/* ---------------------------------------------------------------- wording */

export function formatFull(iso: string): string {
  return new Date(iso).toLocaleString("en-CA", { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function formatRelative(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  const minutes = Math.round((now.getTime() - date.getTime()) / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 60 * 24) { const h = Math.floor(minutes / 60); return `${h}h ago`; }
  const time = date.toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit" });
  if (bucketOf(iso, now) === "yesterday") return `Yesterday, ${time}`;
  if (minutes < 60 * 24 * 7) return `${date.toLocaleDateString("en-CA", { weekday: "short" })}, ${time}`;
  return date.toLocaleDateString("en-CA", { month: "short", day: "numeric", year: date.getFullYear() === now.getFullYear() ? undefined : "numeric" });
}
