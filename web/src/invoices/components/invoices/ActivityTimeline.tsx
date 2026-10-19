import {
  Ban,
  CheckCircle2,
  Clock,
  FileClock,
  FilePen,
  FilePlus2,
  Send,
  StickyNote,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { formatDateTime } from "@inv/lib/format";
import type { ActivityEntry, ActivityKind } from "@inv/types/invoice";
import { cn } from "@inv/utils/cn";

const kindIcon: Record<ActivityKind, LucideIcon> = {
  created: FilePlus2,
  edited: FilePen,
  approved: CheckCircle2,
  payment: Wallet,
  paid: CheckCircle2,
  voided: Ban,
  reminder: Clock,
  sent: Send,
  note: StickyNote,
};

const kindColor: Record<ActivityKind, string> = {
  created: "border-accent/40 bg-accent-soft text-brand-ink",
  edited: "border-line-strong bg-surface-3 text-ink-muted",
  approved: "border-accent/40 bg-accent-soft text-brand-ink",
  payment: "border-paid/30 bg-paid/10 text-paid",
  paid: "border-paid/30 bg-paid/10 text-paid",
  voided: "border-overdue/30 bg-overdue/10 text-overdue",
  reminder: "border-unpaid/30 bg-unpaid/10 text-unpaid",
  sent: "border-line-strong bg-surface-3 text-ink-muted",
  note: "border-line-strong bg-surface-3 text-ink-muted",
};

export function ActivityTimeline({ items }: { items: ActivityEntry[] }) {
  return (
    <section aria-label="Activity timeline" className="rounded-xl border border-line bg-surface">
      <header className="flex items-center gap-2 border-b border-line px-4 py-3">
        <FileClock className="size-4 text-ink-faint" />
        <h2 className="text-[14px] font-semibold text-ink">Activity</h2>
        <span className="ml-auto text-[11.5px] text-ink-faint tabular-nums">
          {items.length} {items.length === 1 ? "event" : "events"}
        </span>
      </header>

      <ol className="relative px-4 py-4">
        {items.map((entry, i) => {
          const Icon = kindIcon[entry.kind];
          const last = i === items.length - 1;
          return (
            <li key={entry.id} className="relative flex gap-3 pb-4 last:pb-0">
              {!last ? (
                <span
                  className="absolute left-[13px] top-7 h-[calc(100%-1rem)] w-px bg-line"
                  aria-hidden="true"
                />
              ) : null}
              <span
                className={cn(
                  "z-[1] mt-0.5 grid size-[27px] shrink-0 place-items-center rounded-full border",
                  kindColor[entry.kind]
                )}
              >
                <Icon className="size-3.5" strokeWidth={2.1} />
              </span>
              <div className="min-w-0 flex-1 pt-0.5">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <p className="text-[13px] font-medium text-ink">{entry.label}</p>
                  <time
                    dateTime={entry.at}
                    className="text-[11.5px] text-ink-faint tabular-nums"
                  >
                    {formatDateTime(entry.at)}
                  </time>
                </div>
                {entry.detail ? (
                  <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-muted">
                    {entry.detail}
                  </p>
                ) : null}
                <p className="mt-1 text-[11.5px] text-ink-faint">by {entry.actor}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
