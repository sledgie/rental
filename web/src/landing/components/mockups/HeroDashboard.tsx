import {
  Banknote,
  Bell,
  Building2,
  ChartColumn,
  ChevronDown,
  DoorOpen,
  FileText,
  FolderKanban,
  FolderLock,
  Landmark,
  LayoutDashboard,
  MessageSquare,
  Search,
  Settings,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@lf/utils/cn";
import { LogoMark } from "@lf/components/brand/Logo";
import { AppWindow, Avatar, ChartLegend, Panel, ProgressBar, StatCard, StatusPill, type Tone } from "./primitives";

/* Illustrative sample data — not customer results. ----------------------- */

const SIDEBAR: { label: string; icon: LucideIcon; active?: boolean }[] = [
  { label: "Overview", icon: LayoutDashboard, active: true },
  { label: "Properties", icon: Building2 },
  { label: "Units", icon: DoorOpen },
  { label: "Tenants", icon: Users },
  { label: "Leases", icon: FileText },
  { label: "Maintenance", icon: Wrench },
  { label: "Projects", icon: FolderKanban },
  { label: "Accounting", icon: Landmark },
  { label: "Documents", icon: FolderLock },
  { label: "Messages", icon: MessageSquare },
  { label: "Reports", icon: ChartColumn },
];

const COLLECTION = [
  { month: "Dec", billed: 64.2, collected: 63.7 },
  { month: "Jan", billed: 64.8, collected: 64.3 },
  { month: "Feb", billed: 65.1, collected: 64.9 },
  { month: "Mar", billed: 65.9, collected: 65.4 },
  { month: "Apr", billed: 66.4, collected: 66.0 },
  { month: "May", billed: 66.9, collected: 58.5 },
];

const TRANSACTIONS: {
  title: string;
  meta: string;
  ref: string;
  amount: string;
  status: string;
  tone: Tone;
  icon: LucideIcon;
  iconTone: string;
}[] = [
  {
    title: "Rent payment",
    meta: "Unit 104 · Harbor View",
    ref: "RCT-00058",
    amount: "+$1,475.00",
    status: "Posted",
    tone: "green",
    icon: Banknote,
    iconTone: "bg-sage text-forest",
  },
  {
    title: "Plumbing repair",
    meta: "Unit 2A · Maple Court",
    ref: "EXP-0091",
    amount: "−$320.00",
    status: "Posted",
    tone: "green",
    icon: Wrench,
    iconTone: "bg-rose-soft text-rose",
  },
  {
    title: "Rent invoice",
    meta: "Unit 2A · Maple Court",
    ref: "INV-00127",
    amount: "$1,600.00",
    status: "Open",
    tone: "amber",
    icon: FileText,
    iconTone: "bg-amber-soft text-amber-ink",
  },
  {
    title: "Rent payment",
    meta: "Unit 3 · Cedar Row",
    ref: "RCT-00057",
    amount: "+$2,100.00",
    status: "Posted",
    tone: "green",
    icon: Banknote,
    iconTone: "bg-sage text-forest",
  },
];

const REQUESTS: { id: string; title: string; where: string; status: string; tone: Tone; priority: string }[] = [
  { id: "MR-0112", title: "Leaking kitchen faucet", where: "Maple Court · Unit 2A", status: "In progress", tone: "sky", priority: "bg-rose" },
  { id: "MR-0110", title: "HVAC filter replacement", where: "Harbor View · Preventive", status: "Scheduled", tone: "neutral", priority: "bg-amber" },
  { id: "MR-0108", title: "Hallway light out", where: "Cedar Row · Common area", status: "New", tone: "amber", priority: "bg-line-strong" },
];

const LEASES = [
  { unit: "Unit 2B · Maple Court", tenant: "J. Alvarez", date: "Jun 30", days: "47 days" },
  { unit: "Unit 104 · Harbor View", tenant: "E. Petrova", date: "Jul 10", days: "57 days" },
  { unit: "Unit 5 · Cedar Row", tenant: "S. Okafor", date: "Jul 12", days: "59 days" },
];

const ACTIVITY = [
  { initials: "PN", tone: 0, text: "Payment posted · receipt RCT-00058 issued", time: "2m" },
  { initials: "SC", tone: 2, text: "Journal entry JE-00342 posted · balanced", time: "1h" },
  { initials: "LO", tone: 1, text: "MR-0112 moved to In progress", time: "3h" },
];

/* ------------------------------------------------------------------------ */

function Sidebar() {
  return (
    <div className="hidden w-12 shrink-0 flex-col items-center gap-0.5 border-r border-line bg-white py-3 @xl:flex @3xl:w-40 @3xl:items-stretch @3xl:px-2">
      {SIDEBAR.map(({ label, icon: Icon, active }) => (
        <span
          key={label}
          className={cn(
            "flex size-7 items-center justify-center rounded-md text-muted @3xl:w-full @3xl:justify-start @3xl:gap-2 @3xl:px-2",
            active && "bg-sage text-evergreen",
          )}
        >
          <Icon className="size-3.5 shrink-0" strokeWidth={1.8} />
          <span className="hidden truncate text-2xs font-medium @3xl:inline">{label}</span>
        </span>
      ))}
      <span className="mt-auto flex size-7 items-center justify-center rounded-md text-muted @3xl:w-full @3xl:justify-start @3xl:gap-2 @3xl:px-2">
        <Settings className="size-3.5 shrink-0" strokeWidth={1.8} />
        <span className="hidden text-2xs font-medium @3xl:inline">Settings</span>
      </span>
    </div>
  );
}

function CollectionChart() {
  const max = 70;
  return (
    <div className="relative h-[100px]">
      {/* Gridlines share the exact box of the bar area */}
      <div className="absolute inset-x-0 bottom-4 top-1">
        {[1, 0.5, 0].map((fraction) => (
          <div
            key={fraction}
            className="absolute inset-x-0 flex items-center gap-1.5"
            style={{ bottom: `${fraction * 100}%`, transform: "translateY(50%)" }}
          >
            <span className="w-7 text-right text-[9px] leading-none text-muted tabular-nums">
              {fraction === 0 ? "$0" : `$${Math.round(max * fraction)}k`}
            </span>
            <span className="flex-1 border-t border-dashed border-line" />
          </div>
        ))}
      </div>
      <div className="absolute inset-y-0 left-9 right-0 top-1 flex items-end gap-1.5">
        {COLLECTION.map((point) => (
          <div key={point.month} className="flex h-full flex-1 flex-col items-center justify-end">
            <div className="flex h-[calc(100%-16px)] w-full items-end justify-center gap-[3px]">
              <span
                className="w-[34%] max-w-3 rounded-t-[2px] bg-sage ring-1 ring-inset ring-forest/10"
                style={{ height: `${(point.billed / max) * 100}%` }}
              />
              <span
                className="w-[34%] max-w-3 rounded-t-[2px] bg-forest"
                style={{ height: `${(point.collected / max) * 100}%` }}
              />
            </div>
            <span className="h-4 pt-1 text-[9px] leading-3 text-muted">{point.month}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function OccupancyDonut() {
  // 45 occupied, 1 make-ready, 2 vacant of 48 units (circumference = 100).
  return (
    <div className="flex items-center gap-3">
      <div className="relative size-[78px] shrink-0">
        <svg viewBox="0 0 36 36" className="size-full -rotate-90">
          <circle cx="18" cy="18" r="15.9155" fill="none" className="stroke-sage" strokeWidth="3.6" />
          <circle cx="18" cy="18" r="15.9155" fill="none" className="stroke-forest" strokeWidth="3.6" strokeDasharray="93.75 6.25" />
          <circle
            cx="18"
            cy="18"
            r="15.9155"
            fill="none"
            className="stroke-amber"
            strokeWidth="3.6"
            strokeDasharray="2.08 97.92"
            strokeDashoffset="-93.75"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[13px] font-semibold leading-none text-ink tabular-nums">93.8%</span>
          <span className="mt-0.5 text-[9px] text-muted">occupied</span>
        </div>
      </div>
      <ul className="min-w-0 flex-1 space-y-1.5 text-3xs">
        {[
          { label: "Occupied", value: 45, swatch: "bg-forest" },
          { label: "Vacant", value: 2, swatch: "bg-sage ring-1 ring-inset ring-forest/15" },
          { label: "Make-ready", value: 1, swatch: "bg-amber" },
        ].map((row) => (
          <li key={row.label} className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-1.5 text-muted">
              <span className={cn("size-2 shrink-0 rounded-sm", row.swatch)} />
              <span className="truncate">{row.label}</span>
            </span>
            <span className="font-semibold text-ink tabular-nums">{row.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function HeroDashboard() {
  return (
    <AppWindow
      label="Illustrative L.O.F.T. dashboard with sample data: a portfolio overview of 12 properties and 48 units at 93.8% occupancy, $8,420.00 in rent receivables, a six-month rent collection chart, recent transactions, open maintenance requests, upcoming lease expirations and recent team activity."
      caption="Illustrative product preview. All figures are sample data, not customer results."
      toolbar={
        <>
          <span className="flex min-w-0 items-center gap-1.5 text-2xs font-semibold text-ink">
            <LogoMark className="size-4 shrink-0" />
            <span className="truncate">Northgate Rentals</span>
            <ChevronDown className="size-3 shrink-0 text-muted" />
          </span>
          <span className="ml-1 hidden h-6 w-full max-w-60 items-center gap-1.5 rounded-md border border-line bg-white px-2 text-3xs text-muted @xl:flex">
            <Search className="size-3 shrink-0" />
            <span className="truncate">Search properties, tenants, invoices…</span>
          </span>
        </>
      }
      toolbarEnd={
        <span className="hidden items-center gap-2 @md:flex">
          <Bell className="size-3.5 text-muted" />
          <Avatar initials="AM" className="size-5 text-[8px]" />
        </span>
      }
    >
      <div className="flex">
        <Sidebar />

        <div className="min-w-0 flex-1 space-y-2.5 bg-canvas p-3 @lg:p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[13px] font-semibold tracking-tight text-ink">Portfolio overview</div>
              <div className="mt-0.5 truncate text-3xs text-muted">All properties · as of May 14, 2026</div>
            </div>
            <span className="hidden shrink-0 rounded-md border border-line bg-white p-0.5 text-3xs font-medium text-muted @md:flex">
              <span className="rounded bg-sage px-2 py-0.5 text-evergreen">Month</span>
              <span className="px-2 py-0.5">Quarter</span>
              <span className="px-2 py-0.5">Year</span>
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 @lg:grid-cols-4">
            <StatCard label="Properties" value="12" meta="48 units in portfolio" />
            <StatCard label="Occupancy" value="93.8%" meta="45 of 48 units">
              <ProgressBar value={93.8} className="mt-1.5 h-1" />
            </StatCard>
            <StatCard label="Rent receivable" value="$8,420.00" meta="6 open invoices" accent />
            <StatCard label="Collected · May" value="$58,480.00" meta="of $66,900.00 billed" />
          </div>

          <div className="grid gap-2.5 @lg:grid-cols-5">
            <Panel
              className="@lg:col-span-3"
              title="Rent collection"
              meta="Billed vs. collected · last 6 months"
              action={
                <ChartLegend
                  items={[
                    { label: "Billed", swatch: "bg-sage ring-1 ring-inset ring-forest/15" },
                    { label: "Collected", swatch: "bg-forest" },
                  ]}
                />
              }
            >
              <CollectionChart />
            </Panel>
            <Panel className="hidden @lg:col-span-2 @lg:block" title="Occupancy" meta="48 units · 12 properties">
              <OccupancyDonut />
            </Panel>
          </div>

          <div className="grid gap-2.5 @lg:grid-cols-5">
            <Panel
              className="@lg:col-span-3"
              title="Recent transactions"
              action={<span className="shrink-0 text-3xs font-semibold text-forest">View ledger</span>}
              bodyClassName="p-0"
            >
              <ul className="divide-y divide-line/70">
                {TRANSACTIONS.map((transaction) => (
                  <li key={transaction.ref} className="flex items-center gap-2 px-3 py-[7px]">
                    <span
                      className={cn(
                        "flex size-6 shrink-0 items-center justify-center rounded-md",
                        transaction.iconTone,
                      )}
                    >
                      <transaction.icon className="size-3" strokeWidth={2} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-2xs font-medium text-ink">{transaction.title}</span>
                      <span className="block truncate text-3xs text-muted">{transaction.meta}</span>
                    </span>
                    <span className="hidden font-mono text-3xs text-muted @sm:block">{transaction.ref}</span>
                    <span className="w-[4.5rem] shrink-0 text-right text-2xs font-semibold text-ink tabular-nums">
                      {transaction.amount}
                    </span>
                    <StatusPill tone={transaction.tone} className="hidden w-[3.6rem] justify-center @3xs:inline-flex">
                      {transaction.status}
                    </StatusPill>
                  </li>
                ))}
              </ul>
            </Panel>

            <Panel className="hidden @lg:col-span-2 @lg:block" title="Maintenance requests" meta="3 open" bodyClassName="space-y-2.5">
              {REQUESTS.map((request) => (
                <div key={request.id} className="flex items-start gap-2">
                  <span className={cn("mt-[5px] size-1.5 shrink-0 rounded-full", request.priority)} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-2xs font-medium text-ink">{request.title}</span>
                    <span className="block truncate text-3xs text-muted">
                      {request.id} · {request.where}
                    </span>
                  </span>
                  <StatusPill tone={request.tone}>{request.status}</StatusPill>
                </div>
              ))}
            </Panel>
          </div>

          <div className="hidden gap-2.5 @lg:grid @lg:grid-cols-2">
            <Panel title="Lease expirations" meta="Next 60 days" bodyClassName="p-0">
              <ul className="divide-y divide-line/70">
                {LEASES.map((lease) => (
                  <li key={lease.unit} className="flex items-center gap-2 px-3 py-[7px]">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-2xs font-medium text-ink">{lease.unit}</span>
                      <span className="block truncate text-3xs text-muted">
                        {lease.tenant} · ends {lease.date}
                      </span>
                    </span>
                    <StatusPill tone="amber" dot={false}>
                      {lease.days}
                    </StatusPill>
                  </li>
                ))}
              </ul>
            </Panel>
            <Panel title="Recent activity" meta="Today" bodyClassName="p-0">
              <ul className="divide-y divide-line/70">
                {ACTIVITY.map((item) => (
                  <li key={item.text} className="flex items-center gap-2 px-3 py-[9px]">
                    <Avatar initials={item.initials} tone={item.tone} className="size-5 text-[8px]" />
                    <span className="min-w-0 flex-1 truncate text-3xs text-ink">{item.text}</span>
                    <span className="shrink-0 text-3xs text-muted">{item.time}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>
        </div>
      </div>
    </AppWindow>
  );
}
