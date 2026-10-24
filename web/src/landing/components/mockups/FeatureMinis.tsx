import { Ban, Building2, FileText, IdCard, Image as ImageIcon, Lock, Plus, Receipt, ShieldCheck, Workflow } from "lucide-react";
import { cn } from "@lf/utils/cn";
import { Avatar, IdTag, ProgressBar, SampleBadge, StatusPill, type Tone } from "./primitives";

/* Miniature, decorative feature previews. Illustrative sample data only. */

const CARD = "rounded-lg border border-line bg-white shadow-xs";

export function PropertiesMini() {
  const rows: { id: string; unit: string; status: string; tone: Tone; tenant: string }[] = [
    { id: "U-0001", unit: "Unit 101", status: "Occupied", tone: "green", tenant: "D. Whitfield" },
    { id: "U-0002", unit: "Unit 102", status: "Occupied", tone: "green", tenant: "S. Okafor" },
    { id: "U-0003", unit: "Unit 103", status: "Vacant", tone: "neutral", tenant: "—" },
  ];
  return (
    <>
      <div className={CARD}>
        <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2">
          <span className="flex min-w-0 items-center gap-2">
            <Building2 className="size-3.5 shrink-0 text-forest" />
            <span className="truncate text-2xs font-semibold text-ink">Harbor View Apartments</span>
          </span>
          <IdTag>PR-0001</IdTag>
        </div>
        {rows.map((row) => (
          <div key={row.id} className="flex items-center gap-2 border-b border-line/60 px-3 py-1.5 last:border-b-0">
            <span className="font-mono text-[10px] text-muted">{row.id}</span>
            <span className="min-w-0 flex-1 truncate text-2xs text-ink">
              {row.unit} <span className="text-muted">· {row.tenant}</span>
            </span>
            <StatusPill tone={row.tone}>{row.status}</StatusPill>
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-1.5 rounded-md border border-rose/20 bg-rose-soft px-2 py-1.5 text-3xs font-medium text-rose">
        <Ban className="size-3 shrink-0" />
        Overlapping lease blocked for U-0002
      </div>
    </>
  );
}

export function MaintenanceMini() {
  const columns = [
    { title: "New", items: ["Dishwasher not draining"] },
    { title: "Scheduled", items: ["HVAC filters · preventive", "Window latch"] },
    { title: "In progress", items: ["Kitchen faucet leak"] },
  ];
  return (
    <>
      <div className="grid grid-cols-3 gap-1.5">
        {columns.map((column) => (
          <div key={column.title} className="min-w-0 rounded-md border border-line/70 bg-white/70 p-1.5">
            <div className="truncate text-[9px] font-semibold uppercase tracking-[0.06em] text-muted">{column.title}</div>
            <div className="mt-1 space-y-1">
              {column.items.map((item) => (
                <div key={item} className="truncate rounded border border-line bg-white px-1.5 py-1 text-3xs text-ink shadow-xs">
                  {item}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className={cn(CARD, "mt-2 p-2.5")}>
        <div className="flex items-center justify-between gap-2 text-3xs">
          <span className="truncate font-semibold text-ink">
            Roof replacement <span className="font-mono font-normal text-muted">PJ-0004</span>
          </span>
          <span className="font-semibold text-ink tabular-nums">61%</span>
        </div>
        <ProgressBar value={61} className="mt-1.5 h-1" />
        <div className="mt-1.5 truncate text-[9.5px] text-muted">$11,240.00 of $18,500.00 budget · 3 documents</div>
      </div>
    </>
  );
}

export function CommsMini() {
  return (
    <>
      <div className={cn(CARD, "p-2.5")}>
        <div className="flex items-center gap-2">
          <Avatar initials="JA" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-2xs font-semibold text-ink">Jordan Alvarez</div>
            <div className="truncate text-[9.5px] text-muted">Unit 2B · Maple Court</div>
          </div>
          <StatusPill tone="green">SMS opted in</StatusPill>
        </div>
        <div className="ml-auto mt-2 max-w-[90%] rounded-lg rounded-br-sm bg-forest px-2.5 py-1.5 text-3xs leading-snug text-white">
          Hi Jordan, a reminder that June rent is due on the 1st. Reply STOP to opt out.
        </div>
        <div className="mt-1 text-right text-[9.5px] text-muted">Template: Rent reminder · sent via Twilio</div>
      </div>
      <div className={cn(CARD, "mt-2 flex items-center gap-2 px-2.5 py-1.5")}>
        <Avatar initials="HB" tone={1} className="size-5 text-[8px]" />
        <span className="min-w-0 flex-1 truncate text-3xs text-ink">Hannah Brooks</span>
        <StatusPill tone="neutral" dot={false}>
          <Ban className="size-2.5" /> Opted out · SMS off
        </StatusPill>
      </div>
    </>
  );
}

export function AutomationMini() {
  return (
    <div className={cn(CARD, "p-2.5")}>
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5 text-2xs font-semibold text-ink">
          <Workflow className="size-3.5 shrink-0 text-forest" />
          <span className="truncate">Maintenance follow-up</span>
        </span>
        <StatusPill tone="neutral" dot={false}>
          Rule
        </StatusPill>
      </div>
      <div className="mt-2.5">
        <div className="flex items-center gap-2 rounded-md border border-line bg-ivory px-2 py-1.5">
          <span className="rounded bg-evergreen px-1 py-px text-[9px] font-semibold uppercase tracking-[0.06em] text-white">When</span>
          <span className="truncate text-3xs text-ink">A maintenance request is created</span>
        </div>
        <div className="ml-5 h-2.5 w-px bg-line-strong" />
        <div className="flex items-center gap-2 rounded-md border border-line bg-white px-2 py-1.5">
          <span className="rounded bg-forest/10 px-1 py-px text-[9px] font-semibold uppercase tracking-[0.06em] text-forest">Then</span>
          <span className="truncate text-3xs text-ink">Create a follow-up task for the manager</span>
        </div>
        <div className="ml-5 h-2.5 w-px bg-line-strong" />
        <div className="flex items-center gap-1.5 rounded-md border border-dashed border-line-strong px-2 py-1 text-3xs text-muted">
          <Plus className="size-3" /> Add action
        </div>
      </div>
    </div>
  );
}

export function DocumentsMini() {
  const docs = [
    { name: "Lease agreement — L-0042.pdf", access: "Owner, Manager", icon: FileText },
    { name: "Tenant ID — J. Alvarez.jpg", access: "Restricted", icon: IdCard },
    { name: "Receipt RCT-00001.pdf", access: "Accounting", icon: Receipt },
    { name: "Unit 2B photos (8)", access: "Team", icon: ImageIcon },
  ];
  return (
    <>
      <div className={CARD}>
        {docs.map((doc) => (
          <div key={doc.name} className="flex items-center gap-2 border-b border-line/60 px-2.5 py-[7px] last:border-b-0">
            <doc.icon className="size-3.5 shrink-0 text-forest" strokeWidth={1.75} />
            <span className="min-w-0 flex-1 truncate text-3xs text-ink">{doc.name}</span>
            <span className="flex shrink-0 items-center gap-1 text-[9.5px] text-muted">
              <Lock className="size-2.5" />
              {doc.access}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-1.5 text-3xs text-muted">
        <ShieldCheck className="size-3 text-forest" /> Access follows role permissions
      </div>
    </>
  );
}

export function ReportsMini() {
  const rows: [string, number][] = [
    ["Harbor View", 94],
    ["Maple Court", 88],
    ["Cedar Row", 100],
    ["Linden Street", 100],
  ];
  return (
    <>
      <div className={cn(CARD, "p-2.5")}>
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-2xs font-semibold text-ink">Occupancy by property</span>
          <SampleBadge />
        </div>
        <div className="mt-2 space-y-1.5">
          {rows.map(([name, value]) => (
            <div key={name} className="grid grid-cols-[4.75rem_minmax(0,1fr)_2rem] items-center gap-2 text-3xs">
              <span className="truncate text-muted">{name}</span>
              <ProgressBar value={value} className="h-1.5" />
              <span className="text-right font-medium text-ink tabular-nums">{value}%</span>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <div className={cn(CARD, "px-2.5 py-1.5")}>
          <div className="text-[9.5px] text-muted">Net · May</div>
          <div className="text-2xs font-semibold text-ink tabular-nums">$52,613.60</div>
        </div>
        <div className={cn(CARD, "px-2.5 py-1.5")}>
          <div className="text-[9.5px] text-muted">Project progress</div>
          <div className="text-2xs font-semibold text-ink">Roof · 61%</div>
        </div>
      </div>
    </>
  );
}
