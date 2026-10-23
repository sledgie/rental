import { isSupabaseConfigured } from '../lib/supabase';
import type { Asset, MaintenanceRequest } from './types';
import { TERMINAL_STATUSES } from './types';

/** ISO date (yyyy-mm-dd) offset by N days from today */
export function dOff(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

/** ISO datetime offset by N days, at a given hour */
export function dtOff(days: number, hour = 9, min = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, min, 0, 0);
  return d.toISOString();
}

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayISO(): string {
  return toISODate(new Date());
}

export function nowISO(): string {
  return new Date().toISOString();
}

export function addDays(iso: string, days: number): string {
  const d = new Date(iso + (iso.length === 10 ? 'T12:00:00' : ''));
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

/** Whole days from today until the given date (negative = past) */
export function daysUntil(iso?: string): number | null {
  if (!iso) return null;
  const target = new Date(iso.length === 10 ? iso + 'T12:00:00' : iso);
  const now = new Date();
  now.setHours(12, 0, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / 86400000);
}

export function fmtDate(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso.length === 10 ? iso + 'T12:00:00' : iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function fmtDateTime(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return (
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
    ', ' +
    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  );
}

export function fmtMoney(n?: number | null): string {
  if (n === undefined || n === null) return '—';
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: n % 1 === 0 ? 0 : 2 });
}

export function fmtMoneyFull(n?: number | null): string {
  if (n === undefined || n === null) return '—';
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

/** A request is overdue when its target date has passed and it is not finished. */
export function isOverdue(req: MaintenanceRequest): boolean {
  if (TERMINAL_STATUSES.includes(req.status) || req.status === 'Draft') return false;
  const du = daysUntil(req.targetDate);
  return du !== null && du < 0;
}

export function overdueDays(req: MaintenanceRequest): number {
  const du = daysUntil(req.targetDate);
  return du !== null && du < 0 ? Math.abs(du) : 0;
}

/** Age of an asset in years (1 decimal) from purchase/install date */
export function assetAgeYears(asset: Asset): number | null {
  const start = asset.purchaseDate || asset.installDate;
  if (!start) return null;
  const diff = Date.now() - new Date(start + 'T12:00:00').getTime();
  return Math.max(0, diff / (365.25 * 86400000));
}

export type WarrantyState = 'active' | 'expiring' | 'expired' | 'none';

export function warrantyState(asset: Asset): WarrantyState {
  if (!asset.warrantyEnd) return 'none';
  const du = daysUntil(asset.warrantyEnd);
  if (du === null) return 'none';
  if (du < 0) return 'expired';
  if (du <= 90) return 'expiring';
  return 'active';
}

export function uid(prefix: string): string {
  // with Supabase the ids of saved records become database primary keys, so they must be real UUIDs
  if (isSupabaseConfigured) return crypto.randomUUID();
  return prefix + Math.random().toString(36).slice(2, 9).toUpperCase();
}

export function initials(name: string): string {
  return name
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function fileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export const FREQUENCY_DAYS: Record<string, number> = {
  Weekly: 7,
  Monthly: 30,
  Quarterly: 91,
  'Semi-Annual': 182,
  Annual: 365,
};

export function nextDueDate(frequency: string, customDays: number | undefined, fromISO: string): string {
  const days = frequency === 'Custom' ? customDays || 30 : FREQUENCY_DAYS[frequency] || 30;
  return addDays(fromISO, days);
}
