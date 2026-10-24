import { useEffect, useRef, useState } from "react";
import { CheckCheck, ChevronRight, Clock, EyeOff, MoreHorizontal, X } from "lucide-react";
import { formatFull, formatRelative, isUnread } from "../logic";
import { CATEGORY_META, SEVERITY_META, notificationIcon } from "../meta";
import type { AppNotification } from "../types";

export const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(" ");

export const SNOOZE_OPTIONS = [
  { label: "1 hour", minutes: 60 },
  { label: "Until tomorrow", minutes: 60 * 24 },
  { label: "1 week", minutes: 60 * 24 * 7 },
];
export const snoozeUntil = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString();

export function SeverityBadge({ severity }: { severity: AppNotification["severity"] }) {
  const meta = SEVERITY_META[severity];
  return <span title={meta.description} className={cx("inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[10.5px] font-semibold", meta.badge)}>{meta.label}</span>;
}
export function CategoryBadge({ category }: { category: AppNotification["category"] }) {
  const meta = CATEGORY_META[category];
  return <span className={cx("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[10.5px] font-semibold", meta.tone)}><meta.icon size={11} aria-hidden />{meta.short}</span>;
}

/** A small "more" menu that closes on outside click or Escape. */
function MoreMenu({ n, onSnooze, onToggleRead }: { n: AppNotification; onSnooze: (minutes: number) => void; onToggleRead: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return undefined;
    const away = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc); };
  }, [open]);
  const unread = isUnread(n);
  return (
    <div className="relative" ref={ref}>
      <button type="button" className="nc-btn nc-btn-ghost" aria-haspopup="menu" aria-expanded={open} aria-label={`More actions for ${n.title}`} onClick={() => setOpen(!open)}><MoreHorizontal size={14} />More</button>
      {open && (
        <div role="menu" className="absolute right-0 z-20 mt-1 w-48 rounded-lg border border-u-line bg-u-card p-1 shadow-lg">
          <p className="px-2.5 pb-1 pt-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-u-muted">Remind me again</p>
          {SNOOZE_OPTIONS.map((o) => (
            <button key={o.label} type="button" role="menuitem" className="nc-menu-item" onClick={() => { setOpen(false); onSnooze(o.minutes); }}><Clock size={14} className="text-u-muted" />{o.label}</button>
          ))}
          <div className="my-1 border-t border-u-line" />
          <button type="button" role="menuitem" className="nc-menu-item" onClick={() => { setOpen(false); onToggleRead(); }}>
            {unread ? <CheckCheck size={14} className="text-u-muted" /> : <EyeOff size={14} className="text-u-muted" />}{unread ? "Mark as read" : "Mark as unread"}
          </button>
        </div>
      )}
    </div>
  );
}

export interface RowProps {
  n: AppNotification;
  selected: boolean;
  onSelect: (id: string) => void;
  onOpen: (n: AppNotification) => void;
  onMarkRead: (ids: string[]) => void;
  onMarkUnread: (ids: string[]) => void;
  onDismiss: (ids: string[]) => void;
  onSnooze: (n: AppNotification, minutes: number, label: string) => void;
}

export function NotificationRow({ n, selected, onSelect, onOpen, onMarkRead, onMarkUnread, onDismiss, onSnooze }: RowProps) {
  const Icon = notificationIcon(n.category, n.eventType);
  const unread = isUnread(n);
  const urgent = n.severity === "critical" || n.severity === "high";
  return (
    <li className={cx("relative flex gap-3 px-3 py-3.5 sm:px-4", unread ? "bg-u-accent-soft/40" : "hover:bg-u-s2/60", selected && "bg-u-accent-soft/70")}>
      {urgent && <span aria-hidden className={cx("absolute inset-y-0 left-0 w-[3px]", SEVERITY_META[n.severity].bar)} />}
      <div className="pt-1.5"><input type="checkbox" className="size-4 cursor-pointer accent-[var(--accent)]" checked={selected} onChange={() => onSelect(n.id)} aria-label={`Select notification: ${n.title}`} /></div>
      <span aria-hidden className={cx("mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg", CATEGORY_META[n.category].tone)}><Icon size={17} /></span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-2">
            {unread ? <span role="img" aria-label="Unread" title="Unread" className="mt-[7px] size-2 shrink-0 rounded-full bg-u-accent" /> : <span aria-hidden className="mt-[7px] size-2 shrink-0" />}
            <div className="min-w-0">
              <h3 className={cx("text-sm leading-5 text-u-ink", unread ? "font-semibold" : "font-medium")}>
                {n.actionRoute ? <a href={n.actionRoute} className="hover:underline" onClick={() => onOpen(n)}>{n.title}</a> : n.title}
              </h3>
              {n.message && <p className="mt-0.5 text-[13px] leading-5 text-u-muted">{n.message}</p>}
            </div>
          </div>
          <time dateTime={n.createdAt} title={formatFull(n.createdAt)} className="shrink-0 pt-0.5 text-[11px] text-u-muted">{formatRelative(n.createdAt)}</time>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <SeverityBadge severity={n.severity} />
          <CategoryBadge category={n.category} />
          {n.actionRequired && unread && <span className="inline-flex items-center rounded-full border border-u-line2 px-2 py-0.5 text-[10.5px] font-semibold text-u-ink2">Action needed</span>}
          {n.propertyName && <span className="truncate rounded-full border border-u-line px-2 py-0.5 text-[10.5px] text-u-muted">{n.propertyName}</span>}
        </div>
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          {n.actionRoute && <a href={n.actionRoute} className="nc-btn" onClick={() => onOpen(n)}>{n.actionLabel ?? "Open"}<ChevronRight size={13} /></a>}
          {unread
            ? <button type="button" className="nc-btn nc-btn-ghost" onClick={() => onMarkRead([n.id])}><CheckCheck size={14} />Mark read</button>
            : <button type="button" className="nc-btn nc-btn-ghost" onClick={() => onMarkUnread([n.id])}><EyeOff size={14} />Mark unread</button>}
          <MoreMenu n={n} onToggleRead={() => (unread ? onMarkRead([n.id]) : onMarkUnread([n.id]))} onSnooze={(minutes) => onSnooze(n, minutes, SNOOZE_OPTIONS.find((o) => o.minutes === minutes)?.label ?? "")} />
          <button type="button" className="nc-btn nc-btn-ghost ml-auto text-u-danger" onClick={() => onDismiss([n.id])} aria-label={`Dismiss ${n.title}`}><X size={14} />Dismiss</button>
        </div>
      </div>
    </li>
  );
}
