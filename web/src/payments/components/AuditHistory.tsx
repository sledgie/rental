import { useMemo, useState } from "react";
import type { AuditEvent, StaffUser } from "../types";
import { ACTION_LABELS, formatDateTime } from "../utils/paymentUtils";
import { Badge, Button, EmptyState, Icon } from "./ui";
import { cn } from "../utils/cn";

function actionTone(action: AuditEvent["action"]): "pine" | "red" | "amber" | "sky" | "neutral" {
  if (action === "payment.reversed" || action === "credit.invalidated" || action === "invoice.cancelled") return "red";
  if (action === "refund.recorded") return "amber";
  if (action.startsWith("credit")) return "sky";
  if (action.startsWith("receipt")) return "neutral";
  return "pine";
}

/** Compact audit timeline, used inside the payment detail modal. */
export function AuditHistory({ events, users }: { events: AuditEvent[]; users: StaffUser[] }) {
  const userById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  const sorted = useMemo(() => [...events].sort((a, b) => b.at.localeCompare(a.at)), [events]);

  if (sorted.length === 0) {
    return <p className="rounded-lg bg-u-s2 px-3.5 py-3 text-[13px] text-u-muted">No audit events recorded for this payment.</p>;
  }

  return (
    <ol className="space-y-0">
      {sorted.map((e, i) => {
        const user = userById.get(e.userId);
        return (
          <li key={e.id} className="relative flex gap-3 pb-4 last:pb-0">
            {i < sorted.length - 1 && <span className="absolute top-5 left-[7px] h-full w-px bg-u-line" aria-hidden="true" />}
            <span
              className={cn(
                "relative mt-1.5 h-[15px] w-[15px] shrink-0 rounded-full border-2 border-u-card ring-1",
                actionTone(e.action) === "red" ? "bg-u-danger ring-u-danger/55" : actionTone(e.action) === "amber" ? "bg-u-warn ring-u-warn/55" : actionTone(e.action) === "sky" ? "bg-u-blue ring-u-blue/55" : actionTone(e.action) === "neutral" ? "bg-u-muted ring-u-line2" : "bg-u-accent ring-u-accent/55",
              )}
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <Badge tone={actionTone(e.action)}>{ACTION_LABELS[e.action]}</Badge>
                <span className="font-mono text-[10px] text-u-muted">{e.id}</span>
                <span className="ml-auto text-[11px] whitespace-nowrap text-u-muted tabular-nums">{formatDateTime(e.at)}</span>
              </div>
              <p className="mt-1 text-[13px] text-u-ink2">{e.summary}</p>
              <p className="mt-0.5 text-[11.5px] text-u-muted">
                by {user ? `${user.name} (${user.role})` : e.userId}
                {e.reason ? ` · reason: ${e.reason}` : ""}
              </p>
              {(e.prev || e.next) && (
                <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 font-mono text-[10.5px] text-u-muted">
                  {e.prev && <span className="rounded bg-u-danger-soft px-1.5 py-0.5 text-u-danger">prev: {Object.entries(e.prev).map(([k, v]) => `${k}=${v}`).join(", ")}</span>}
                  {e.next && <span className="rounded bg-u-accent-soft px-1.5 py-0.5 text-u-accent">new: {Object.entries(e.next).map(([k, v]) => `${k}=${v}`).join(", ")}</span>}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

const LIMIT = 40;

/** Page-level audit trail panel. */
export function AuditTrailPanel({ audits, users }: { audits: AuditEvent[]; users: StaffUser[] }) {
  const [actionFilter, setActionFilter] = useState("");
  const [visible, setVisible] = useState(LIMIT);
  const userById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);

  const filtered = useMemo(() => {
    const sorted = [...audits].sort((a, b) => b.at.localeCompare(a.at));
    return actionFilter ? sorted.filter((e) => e.action === actionFilter) : sorted;
  }, [audits, actionFilter]);

  const shown = filtered.slice(0, visible);
  const actions = useMemo(() => [...new Set(audits.map((e) => e.action))].sort(), [audits]);

  return (
    <section aria-label="Audit trail" className="overflow-hidden rounded-xl bg-u-card ring-1 ring-u-line shadow-sm shadow-black/5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-u-line bg-u-s2/50 px-4 py-3">
        <div className="flex items-center gap-2">
          <Icon name="clock" className="h-4 w-4 text-u-muted" />
          <h2 className="font-display text-sm font-semibold tracking-tight text-u-ink">Audit trail</h2>
          <Badge tone="neutral">{filtered.length} events</Badge>
        </div>
        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor="audit-action-filter">Filter by action</label>
          <select
            id="audit-action-filter"
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setVisible(LIMIT);
            }}
            className="h-8 rounded-md border border-u-line bg-u-card px-2 text-xs font-medium text-u-ink2 focus:border-u-accent focus:outline-none focus:ring-2 focus:ring-u-accent/25"
          >
            <option value="">All actions</option>
            {actions.map((a) => (
              <option key={a} value={a}>{ACTION_LABELS[a]}</option>
            ))}
          </select>
        </div>
      </div>
      <p className="border-b border-u-line bg-u-warn-soft/60 px-4 py-2 text-[11px] text-u-warn">
        Demonstration audit log stored in frontend state only — not a tamper-proof production audit system.
      </p>
      {shown.length === 0 ? (
        <EmptyState icon="clock" title="No audit events match this filter" />
      ) : (
        <ul className="divide-y divide-u-line">
          {shown.map((e) => {
            const user = userById.get(e.userId);
            return (
              <li key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-[13px] transition-colors hover:bg-u-s2/60">
                <span className="w-32 shrink-0 text-[11.5px] whitespace-nowrap text-u-muted tabular-nums">{formatDateTime(e.at)}</span>
                <Badge tone={actionTone(e.action)} className="w-36 justify-center">{ACTION_LABELS[e.action]}</Badge>
                <span className="font-mono text-[11px] whitespace-nowrap text-u-ink2">{e.entityId}</span>
                <span className="min-w-0 flex-1 truncate text-u-ink2">{e.summary}</span>
                <span className="text-[11.5px] whitespace-nowrap text-u-muted">{user?.name ?? e.userId}</span>
              </li>
            );
          })}
        </ul>
      )}
      {filtered.length > visible && (
        <div className="border-t border-u-line px-4 py-3 text-center">
          <Button size="sm" variant="ghost" onClick={() => setVisible((v) => v + LIMIT)}>
            Show more ({filtered.length - visible} remaining)
          </Button>
        </div>
      )}
    </section>
  );
}
