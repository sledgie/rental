import { Ban, Check, CircleCheck, CircleX, Database, IdCard, Lock } from "lucide-react";
import { cn } from "@lf/utils/cn";
import { StatusPill } from "./primitives";

/* Decorative security illustrations. Sample organizations and records only. */

const RECORD_TYPES = ["Properties", "Tenants", "Ledger", "Documents"];

function OrgBox({ name, initials, tone }: { name: string; initials: string; tone: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-line bg-white p-2.5 shadow-xs">
      <div className="flex items-center gap-1.5">
        <span className={cn("flex size-5 shrink-0 items-center justify-center rounded text-[8px] font-bold", tone)}>{initials}</span>
        <span className="truncate text-3xs font-semibold text-ink">{name}</span>
      </div>
      <ul className="mt-2 space-y-1">
        {RECORD_TYPES.map((record) => (
          <li key={record} className="flex items-center gap-1.5 rounded bg-ivory px-1.5 py-1 text-[9.5px] text-muted">
            <span className="size-1 rounded-full bg-forest/50" />
            {record}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function IsolationDiagram() {
  return (
    <div className="flex h-full flex-col justify-center gap-3">
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-stretch gap-2">
        <OrgBox name="Northgate Rentals" initials="NR" tone="bg-sage text-forest" />
        <div className="flex flex-col items-center py-1">
          <span className="flex-1 border-l border-dashed border-line-strong" />
          <span className="my-1 flex size-7 items-center justify-center rounded-full border border-line bg-white text-forest shadow-xs">
            <Lock className="size-3.5" />
          </span>
          <span className="flex-1 border-l border-dashed border-line-strong" />
        </div>
        <OrgBox name="Cedar Row Holdings" initials="CR" tone="bg-amber-soft text-amber-ink" />
      </div>
      <div className="flex items-center justify-center gap-1.5 rounded-md border border-line bg-white px-3 py-2 text-center text-3xs text-muted">
        <Database className="size-3 shrink-0 text-forest" />
        Database-level policies scope records to their organization
      </div>
    </div>
  );
}

export function DocumentAccessVisual() {
  const access: [string, boolean][] = [
    ["Owner", true],
    ["Property Manager", true],
    ["Maintenance Staff", false],
    ["Read-Only User", false],
  ];
  return (
    <div className="flex h-full items-center">
      <div className="w-full rounded-lg border border-line bg-white p-3 shadow-xs">
        <div className="flex items-center gap-2">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-sage-soft text-forest ring-1 ring-inset ring-line">
            <IdCard className="size-3.5" strokeWidth={1.75} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-2xs font-semibold text-ink">Tenant ID — J. Alvarez.jpg</div>
            <div className="text-3xs text-muted">Private storage · tenant record</div>
          </div>
          <StatusPill tone="rose" dot={false}>
            <Lock className="size-2.5" /> Restricted
          </StatusPill>
        </div>
        <ul className="mt-3 space-y-2 border-t border-line pt-2.5">
          {access.map(([role, allowed]) => (
            <li key={role} className="flex items-center justify-between text-3xs">
              <span className="text-ink">{role}</span>
              {allowed ? (
                <span className="flex items-center gap-1 font-medium text-forest">
                  <Check className="size-3" strokeWidth={2.5} /> Can view
                </span>
              ) : (
                <span className="flex items-center gap-1 text-muted">
                  <Ban className="size-3" /> No access
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

const CHAIN = [
  { seq: "1042", action: "Lease agreement uploaded", hash: "7f3a…c21e", prev: "91bd…04aa" },
  { seq: "1043", action: "Payment PMT-00087 posted", hash: "2c8e…9f10", prev: "7f3a…c21e" },
  { seq: "1044", action: "Receipt RCT-00001 issued", hash: "e5d1…3b72", prev: "2c8e…9f10" },
];

export function AuditChainVisual() {
  return (
    <ol className="flex h-full flex-col justify-center">
      {CHAIN.map((entry, index) => (
        <li key={entry.seq}>
          {index > 0 && (
            <div className="ml-5 flex h-3.5 items-stretch">
              <span className="w-px bg-forest/40" />
            </div>
          )}
          <div className="rounded-md border border-line bg-white px-2.5 py-1.5 shadow-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-3xs font-semibold text-ink">{entry.action}</span>
              <span className="shrink-0 font-mono text-[9px] text-muted">#{entry.seq}</span>
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-1 font-mono text-[9px] text-muted">
              <span>prev {entry.prev}</span>
              <span aria-hidden="true">→</span>
              <span className="text-forest">hash {entry.hash}</span>
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

const CHECKS: { ok: boolean; title: string; detail: string; result: string }[] = [
  { ok: true, title: "Journal entry JE-00311", detail: "Debits $1,650.00 = credits $1,650.00", result: "Accepted" },
  { ok: false, title: "Unbalanced draft entry", detail: "Debits $500.00 ≠ credits $450.00", result: "Rejected · must balance" },
  { ok: false, title: "Edit to issued invoice INV-00124", detail: "Issued invoices are locked", result: "Rejected · use a credit note" },
  { ok: false, title: "Second posting of PMT-00087", detail: "Payment is already posted", result: "Rejected · duplicate" },
];

export function IntegrityChecks() {
  return (
    <div
      role="img"
      aria-label="Illustrative constraint checks with sample records: a balanced journal entry is accepted, while an unbalanced entry, an edit to an issued invoice and a duplicate payment posting are rejected."
      className="@container"
    >
      <ul aria-hidden="true" className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-white">
        {CHECKS.map((check) => (
          <li key={check.title} className="flex items-center gap-3 px-3.5 py-2.5">
            {check.ok ? (
              <CircleCheck className="size-4 shrink-0 text-forest" strokeWidth={2} />
            ) : (
              <CircleX className="size-4 shrink-0 text-rose" strokeWidth={2} />
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-2xs font-semibold text-ink">{check.title}</span>
              <span className="block truncate text-3xs text-muted">{check.detail}</span>
            </span>
            <StatusPill tone={check.ok ? "green" : "rose"} dot={false} className="hidden @sm:inline-flex">
              {check.result}
            </StatusPill>
          </li>
        ))}
      </ul>
    </div>
  );
}
