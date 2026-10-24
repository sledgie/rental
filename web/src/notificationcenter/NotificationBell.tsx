// The bell in the top bar: unread count and the latest notifications. The full inbox is the Notifications page.
import { CheckCheck } from "lucide-react";
import { Icon } from "../icons.jsx";
import { Pop } from "../shell/Pop.jsx";
import { useNotifications } from "./NotificationsProvider";
import { cx } from "./components/NotificationRow";
import { formatRelative, isUnread } from "./logic";
import { CATEGORY_META, notificationIcon } from "./meta";
import "./notificationcenter.css";

const RECENT = 6;

export default function NotificationBell({ notify }: { notify?: (message: string) => void }) {
  const nc = useNotifications();
  const unread = nc.summary.unread;
  const recent = nc.items.slice(0, RECENT);
  const say = (e: unknown) => notify?.(e instanceof Error ? e.message : "Something went wrong.");

  return (
    <Pop align="right" width={380} trigger={({ toggle, open }: { toggle: () => void; open: boolean }) => (
      <button type="button" className={cx("tv-ibtn lg nc-bell", open && "on")} aria-haspopup="menu" aria-expanded={open} title="Notifications" onClick={toggle}
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}>
        <Icon name="bell" size={17} />
        {unread > 0 && <span className="nc-bell-badge" aria-hidden>{unread > 99 ? "99+" : unread}</span>}
      </button>
    )}>
      {(close: () => void) => (
        <div className="u-root nc-menu">
          <div className="flex items-center justify-between gap-2 border-b border-u-line px-3 py-2.5">
            <div className="min-w-0"><p className="text-sm font-semibold text-u-ink">Notifications</p><p className="truncate text-[11px] text-u-muted">{!nc.configured ? "Not connected" : unread > 0 ? `${unread} unread` : "All caught up"}</p></div>
            <button type="button" className="nc-btn nc-btn-ghost" disabled={unread === 0} onClick={() => { nc.markAllRead().catch(say); }}><CheckCheck size={14} />Mark all read</button>
          </div>
          <div role="feed" aria-label="Recent notifications" className="max-h-[min(26rem,65vh)] divide-y divide-u-line overflow-y-auto">
            {!nc.configured ? <p className="px-4 py-8 text-center text-xs text-u-muted">Connect the app to Supabase to receive notifications.</p>
              : !nc.ready ? <p className="px-4 py-8 text-center text-xs text-u-muted">Loading…</p>
              : !recent.length ? <p className="px-4 py-8 text-center text-xs text-u-muted">No notifications yet.</p>
              : recent.map((n) => {
                const Glyph = notificationIcon(n.category, n.eventType);
                const fresh = isUnread(n);
                const body = (
                  <>
                    <span aria-hidden className={cx("mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg", CATEGORY_META[n.category].tone)}><Glyph size={15} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start gap-1.5">
                        {fresh && <span role="img" aria-label="Unread" className="mt-1.5 size-2 shrink-0 rounded-full bg-u-accent" />}
                        <span className={cx("line-clamp-2 text-[13px] leading-5 text-u-ink", fresh && "font-semibold")}>{n.title}</span>
                      </span>
                      {n.message && <span className="mt-0.5 line-clamp-2 block text-xs leading-4 text-u-muted">{n.message}</span>}
                      <span className="mt-1 block text-[11px] text-u-muted">{formatRelative(n.createdAt)}{n.propertyName ? ` · ${n.propertyName}` : ""}</span>
                    </span>
                  </>
                );
                const cls = cx("flex items-start gap-3 px-3 py-3 text-left no-underline", fresh ? "bg-u-accent-soft/40" : "bg-u-card", "hover:bg-u-s2");
                return n.actionRoute
                  ? <a key={n.id} href={n.actionRoute} className={cls} onClick={() => { close(); if (fresh) nc.markRead([n.id]).catch(say); }}>{body}</a>
                  : <button key={n.id} type="button" className={cx(cls, "w-full border-0")} onClick={() => { if (fresh) nc.markRead([n.id]).catch(say); }}>{body}</button>;
              })}
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-u-line bg-u-s2/60 px-3 py-2.5">
            <a href="#/notifications" className="text-xs font-semibold text-u-accent no-underline hover:underline" onClick={close}>View all notifications</a>
            <a href="#/notifications?tab=preferences" className="text-xs text-u-muted no-underline hover:text-u-ink" onClick={close}>Preferences</a>
          </div>
        </div>
      )}
    </Pop>
  );
}
