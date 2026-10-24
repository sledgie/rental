import {
  Building2,
  CalendarClock,
  FileText,
  History,
  IdCard,
  Image as ImageIcon,
  Link2,
  Lock,
  MessageSquareText,
  NotebookPen,
  Paperclip,
  Plus,
  Receipt,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@lf/utils/cn";
import {
  AppWindow,
  Avatar,
  ChartLegend,
  Crumbs,
  IdTag,
  Panel,
  ProgressBar,
  StatCard,
  StatusPill,
  type Tone,
} from "./primitives";

/* All data in this file is illustrative sample data — not customer results. */

const TH = "text-3xs font-medium uppercase tracking-[0.06em] text-muted";

/* ======================================================================== */
/* 1. Portfolio overview                                                    */
/* ======================================================================== */

const MONTHS = ["Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May"];
const INCOME = [61.8, 62.1, 62.8, 63.0, 63.4, 63.9, 64.2, 64.8, 65.1, 65.9, 66.4, 66.9];
const EXPENSES = [12.9, 15.8, 13.1, 12.4, 18.9, 13.7, 14.1, 12.8, 13.3, 21.6, 13.9, 14.3];

const PROPERTIES = [
  { name: "Harbor View Apartments", id: "PR-0001", units: 16, occupancy: 94, receivable: "$3,140.00", open: 2 },
  { name: "Maple Court", id: "PR-0002", units: 8, occupancy: 88, receivable: "$2,375.00", open: 2 },
  { name: "Cedar Row Townhomes", id: "PR-0003", units: 6, occupancy: 100, receivable: "$0.00", open: 1 },
  { name: "Linden Street Duplex", id: "PR-0004", units: 2, occupancy: 100, receivable: "$1,200.00", open: 0 },
];

function linePath(values: number[], max: number, width: number, height: number) {
  const step = width / (values.length - 1);
  return values
    .map((value, index) => `${index === 0 ? "M" : "L"}${(index * step).toFixed(2)} ${(height - (value / max) * height).toFixed(2)}`)
    .join(" ");
}

export function PortfolioPreview() {
  const width = 320;
  const height = 96;
  const income = linePath(INCOME, 80, width, height);
  const expenses = linePath(EXPENSES, 80, width, height);
  const propertyCols = "grid-cols-[minmax(0,1fr)_6.25rem_4.75rem] @md:grid-cols-[minmax(0,1fr)_2.5rem_7rem_5rem_2.5rem]";

  return (
    <AppWindow
      label="Illustrative portfolio overview with sample data: May rental income, operating expenses and net, a 12-month income and expense chart, and occupancy, receivables and open maintenance requests for four properties."
      toolbar={<Crumbs items={["Reports", "Portfolio overview"]} />}
    >
      <div className="space-y-3 bg-canvas p-3 @lg:p-4">
        <div className="grid grid-cols-3 gap-2">
          <StatCard label="Rental income · May" value="$66,900.00" meta="+0.8% vs. April" />
          <StatCard label="Operating expenses" value="$14,286.40" meta="Posted in May" />
          <StatCard label="Net · May" value="$52,613.60" meta="Income − expenses" />
        </div>

        <Panel
          title="Income and expenses"
          meta="Last 12 months · from posted entries"
          action={
            <ChartLegend
              items={[
                { label: "Income", swatch: "bg-forest" },
                { label: "Expenses", swatch: "bg-amber" },
              ]}
            />
          }
        >
          <div className="relative h-[7.25rem]">
            <svg
              viewBox={`0 0 ${width} ${height}`}
              preserveAspectRatio="none"
              className="absolute inset-x-0 top-1 h-24 w-full overflow-visible"
            >
              {[0, 0.25, 0.5, 0.75, 1].map((fraction) => (
                <line
                  key={fraction}
                  x1="0"
                  x2={width}
                  y1={height * fraction}
                  y2={height * fraction}
                  className="stroke-line"
                  strokeDasharray="3 3"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
              <path d={`${income} L${width} ${height} L0 ${height} Z`} className="fill-forest/10" />
              <path d={income} fill="none" className="stroke-forest" strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
              <path d={`${expenses} L${width} ${height} L0 ${height} Z`} className="fill-amber/10" />
              <path d={expenses} fill="none" className="stroke-amber" strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            </svg>
            <div className="absolute inset-x-0 bottom-0 flex justify-between text-[9px] text-muted">
              {MONTHS.map((month) => (
                <span key={month}>{month}</span>
              ))}
            </div>
          </div>
        </Panel>

        <Panel title="Properties" meta="4 of 12 shown" bodyClassName="p-0">
          <div className={cn("grid items-center gap-x-3 border-b border-line/80 px-3 py-1.5", propertyCols, TH)}>
            <span>Property</span>
            <span className="hidden @md:block">Units</span>
            <span>Occupancy</span>
            <span className="text-right">Receivable</span>
            <span className="hidden text-right @md:block">Open</span>
          </div>
          {PROPERTIES.map((property) => (
            <div
              key={property.id}
              className={cn("grid items-center gap-x-3 border-b border-line/60 px-3 py-2 last:border-b-0", propertyCols)}
            >
              <span className="min-w-0">
                <span className="block truncate text-2xs font-medium text-ink">{property.name}</span>
                <span className="block font-mono text-[9.5px] text-muted">{property.id}</span>
              </span>
              <span className="hidden text-2xs text-ink tabular-nums @md:block">{property.units}</span>
              <span className="flex items-center gap-1.5">
                <ProgressBar value={property.occupancy} className="h-1 flex-1" />
                <span className="w-7 text-right text-3xs font-medium text-ink tabular-nums">{property.occupancy}%</span>
              </span>
              <span className="text-right text-2xs font-medium text-ink tabular-nums">{property.receivable}</span>
              <span className="hidden text-right text-2xs text-muted tabular-nums @md:block">{property.open}</span>
            </div>
          ))}
        </Panel>
      </div>
    </AppWindow>
  );
}

/* ======================================================================== */
/* 2. Properties and units                                                  */
/* ======================================================================== */

const UNITS: { unit: string; id: string; layout: string; status: string; tone: Tone; tenant: string; rent: string }[] = [
  { unit: "1A", id: "U-0017", layout: "1 bd · 1 ba", status: "Occupied", tone: "green", tenant: "H. Brooks", rent: "$1,350.00" },
  { unit: "1B", id: "U-0018", layout: "1 bd · 1 ba", status: "Occupied", tone: "green", tenant: "M. Lee", rent: "$1,350.00" },
  { unit: "2A", id: "U-0019", layout: "2 bd · 1 ba", status: "Occupied", tone: "green", tenant: "T. Rivera", rent: "$1,600.00" },
  { unit: "2B", id: "U-0020", layout: "2 bd · 1 ba", status: "Occupied", tone: "green", tenant: "J. Alvarez", rent: "$1,600.00" },
  { unit: "3A", id: "U-0021", layout: "2 bd · 2 ba", status: "Vacant", tone: "neutral", tenant: "—", rent: "$1,725.00" },
];

function Field({ label, value, error }: { label: string; value: string; error?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="text-3xs font-medium text-muted">{label}</div>
      <div
        className={cn(
          "mt-1 flex h-7 items-center truncate rounded-md border bg-white px-2 text-2xs text-ink",
          error ? "border-rose/60 ring-2 ring-rose/10" : "border-line",
        )}
      >
        {value}
      </div>
    </div>
  );
}

export function PropertiesPreview() {
  const unitCols = "grid-cols-[2.25rem_minmax(0,1fr)_4.5rem] @md:grid-cols-[2.25rem_3.5rem_minmax(0,1fr)_4.25rem_4.5rem]";
  return (
    <AppWindow
      label="Illustrative property record with sample data for Maple Court (PR-0002): eight units with automatic identifiers such as U-0017, unit status, tenants and rent, and a new-lease form showing an error because the dates overlap an existing lease for the same unit."
      toolbar={<Crumbs items={["Properties", "Maple Court"]} />}
    >
      <div className="space-y-3 bg-canvas p-3 @lg:p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-white p-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-sage text-forest">
              <Building2 className="size-4" strokeWidth={1.75} />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="truncate text-[13px] font-semibold text-ink">Maple Court</span>
                <IdTag>PR-0002</IdTag>
              </div>
              <div className="truncate text-3xs text-muted">214 Maple Avenue · Owner: Brennan Family Trust</div>
            </div>
          </div>
          <div className="flex gap-1.5">
            {[
              { label: "Units", value: "8" },
              { label: "Occupied", value: "7" },
              { label: "Vacant", value: "1" },
            ].map((stat) => (
              <span key={stat.label} className="rounded-md border border-line bg-ivory px-2 py-1 text-center">
                <span className="block text-[12px] font-semibold leading-tight text-ink tabular-nums">{stat.value}</span>
                <span className="block text-[9px] text-muted">{stat.label}</span>
              </span>
            ))}
          </div>
        </div>

        <div className="grid gap-3 @3xl:grid-cols-5">
          <Panel className="@3xl:col-span-3" title="Units" meta="5 of 8 shown" bodyClassName="p-0">
            <div className={cn("grid items-center gap-x-2.5 border-b border-line/80 px-3 py-1.5", unitCols, TH)}>
              <span>Unit</span>
              <span className="hidden @md:block">ID</span>
              <span>Status · tenant</span>
              <span className="hidden @md:block">Layout</span>
              <span className="text-right">Rent</span>
            </div>
            {UNITS.map((unit) => (
              <div key={unit.id} className={cn("grid items-center gap-x-2.5 border-b border-line/60 px-3 py-[7px] last:border-b-0", unitCols)}>
                <span className="text-2xs font-semibold text-ink">{unit.unit}</span>
                <span className="hidden font-mono text-[9.5px] text-muted @md:block">{unit.id}</span>
                <span className="flex min-w-0 items-center gap-1.5">
                  <StatusPill tone={unit.tone}>{unit.status}</StatusPill>
                  <span className="truncate text-3xs text-muted">{unit.tenant}</span>
                </span>
                <span className="hidden text-3xs text-muted @md:block">{unit.layout}</span>
                <span className="text-right text-2xs font-medium text-ink tabular-nums">{unit.rent}</span>
              </div>
            ))}
          </Panel>

          <Panel className="@3xl:col-span-2" title="New lease" meta="Unit 2B · U-0020" bodyClassName="space-y-2">
            <Field label="Tenant" value="Jordan Alvarez" />
            <div className="grid grid-cols-2 gap-2">
              <Field label="Start date" value="Jun 1, 2026" error />
              <Field label="End date" value="May 31, 2027" />
            </div>
            <Field label="Monthly rent" value="$1,650.00" />
            <div className="flex gap-2 rounded-md border border-rose/25 bg-rose-soft p-2 text-3xs text-rose">
              <TriangleAlert className="mt-px size-3.5 shrink-0" strokeWidth={2} />
              <span>
                <span className="block font-semibold">Dates overlap lease L-0042</span>
                U-0020 is leased through Jun 30, 2026. Leases for the same unit can&rsquo;t overlap.
              </span>
            </div>
            <div className="flex justify-end gap-1.5 pt-0.5">
              <span className="rounded-md border border-line px-2.5 py-1 text-3xs font-medium text-muted">Cancel</span>
              <span className="rounded-md bg-forest/40 px-2.5 py-1 text-3xs font-semibold text-white">Save lease</span>
            </div>
          </Panel>
        </div>
      </div>
    </AppWindow>
  );
}

/* ======================================================================== */
/* 3. Tenants and leases                                                    */
/* ======================================================================== */

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <span className="text-3xs text-muted">{label}</span>
      <span className="min-w-0 truncate text-right text-2xs text-ink">{children}</span>
    </div>
  );
}

function Detail({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <div className="text-3xs text-muted">{label}</div>
      <div className="mt-0.5 truncate text-2xs font-medium text-ink tabular-nums">{value}</div>
    </div>
  );
}

export function TenantsPreview() {
  return (
    <AppWindow
      label="Illustrative tenant profile with sample data for Jordan Alvarez: contact details, SMS opt-in status and a zero balance, active lease L-0042 with term, rent and deposit, a notice that the lease ends in 47 days, private documents and communication history including an SMS sent from a template."
      toolbar={<Crumbs items={["Tenants", "Jordan Alvarez"]} />}
    >
      <div className="grid gap-3 bg-canvas p-3 @lg:p-4 @2xl:grid-cols-5">
        <Panel className="@2xl:col-span-2" bodyClassName="p-3.5">
          <div className="flex items-center gap-3">
            <Avatar initials="JA" className="size-10 text-xs" />
            <div className="min-w-0">
              <div className="truncate text-[13px] font-semibold text-ink">Jordan Alvarez</div>
              <div className="truncate text-3xs text-muted">Tenant · Maple Court, Unit 2B</div>
            </div>
          </div>
          <div className="mt-3 divide-y divide-line/70 border-y border-line/70">
            <InfoRow label="Phone">(555) 014-2290</InfoRow>
            <InfoRow label="Email">jordan.a@example.com</InfoRow>
            <InfoRow label="Tenant since">Jul 1, 2025</InfoRow>
            <InfoRow label="SMS">
              <StatusPill tone="green">Opted in</StatusPill>
            </InfoRow>
            <InfoRow label="Balance">
              <span className="font-semibold text-forest tabular-nums">$0.00</span>
            </InfoRow>
          </div>
          <div className="mt-3">
            <div className={TH}>Documents</div>
            {["Lease agreement — L-0042.pdf", "Tenant ID — J. Alvarez.jpg"].map((name) => (
              <div key={name} className="mt-1.5 flex items-center gap-2 text-2xs text-ink">
                <FileText className="size-3 shrink-0 text-forest" />
                <span className="min-w-0 flex-1 truncate">{name}</span>
                <Lock className="size-3 shrink-0 text-muted" />
              </div>
            ))}
          </div>
        </Panel>

        <div className="min-w-0 space-y-3 @2xl:col-span-3">
          <Panel
            title={
              <span className="flex items-center gap-2">
                Lease <span className="font-mono font-medium text-muted">L-0042</span>
              </span>
            }
            action={<StatusPill tone="green">Active</StatusPill>}
          >
            <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 @md:grid-cols-3">
              <Detail label="Term" value="Jul 1, 2025 – Jun 30, 2026" className="col-span-2 @md:col-span-1" />
              <Detail label="Monthly rent" value="$1,600.00" />
              <Detail label="Parking" value="$50.00" />
              <Detail label="Deposit held" value="$1,600.00" />
              <Detail label="Rent due" value="1st of the month" />
            </div>
            <div className="mt-3 flex items-center gap-2 rounded-md bg-amber-soft px-2.5 py-1.5 text-3xs font-medium text-amber-ink">
              <CalendarClock className="size-3.5 shrink-0" />
              Lease ends in 47 days · renewal not started
            </div>
          </Panel>

          <Panel title="Communication history" meta="SMS and notes" bodyClassName="p-0">
            <ul className="divide-y divide-line/70">
              <li className="flex gap-2.5 px-3 py-2.5">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-sage text-forest">
                  <MessageSquareText className="size-3" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 text-3xs text-muted">
                    <span className="font-semibold text-ink">SMS · “Rent reminder” template</span>
                    <span>May 28 · Priya N.</span>
                  </div>
                  <p className="mt-1 rounded-md bg-sage-soft px-2 py-1.5 text-2xs leading-snug text-ink">
                    Hi Jordan, a reminder that June rent is due on the 1st. Reply STOP to opt out.
                  </p>
                  <div className="mt-1 text-3xs text-muted">Sent via Twilio · saved to communication history</div>
                </div>
              </li>
              <li className="flex gap-2.5 px-3 py-2.5">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-[#eef0ed] text-muted">
                  <NotebookPen className="size-3" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 text-3xs text-muted">
                    <span className="font-semibold text-ink">Note</span>
                    <span>May 3 · Sam C.</span>
                  </div>
                  <p className="mt-0.5 truncate text-2xs text-ink">Payment PMT-00087 recorded · receipt RCT-00001 issued</p>
                </div>
              </li>
            </ul>
          </Panel>
        </div>
      </div>
    </AppWindow>
  );
}

/* ======================================================================== */
/* 4. Accounting                                                            */
/* ======================================================================== */

const INVOICES: { no: string; who: string; unit: string; date: string; amount: string; status: string; tone: Tone; note?: string }[] = [
  { no: "INV-00127", who: "T. Rivera", unit: "U-0019", date: "May 1", amount: "$1,600.00", status: "Open", tone: "amber" },
  { no: "INV-00124", who: "J. Alvarez", unit: "U-0020", date: "May 1", amount: "$1,650.00", status: "Paid", tone: "green", note: "RCT-00001" },
  { no: "INV-00122", who: "H. Brooks", unit: "U-0017", date: "May 1", amount: "$1,350.00", status: "Partially paid", tone: "sky" },
  { no: "CN-00007", who: "T. Rivera", unit: "U-0019", date: "May 9", amount: "−$75.00", status: "Applied", tone: "neutral", note: "to INV-00127" },
  { no: "INV-00119", who: "M. Lee", unit: "U-0018", date: "May 1", amount: "$1,350.00", status: "Paid", tone: "green", note: "RCT-00056" },
];

const PERIODS = [
  { label: "Feb 2026", closed: true },
  { label: "Mar 2026", closed: true },
  { label: "Apr 2026", closed: true },
  { label: "May 2026", closed: false },
];

export function AccountingPreview() {
  const invoiceCols = "grid-cols-[minmax(0,1fr)_4.75rem_5.5rem] @md:grid-cols-[5.5rem_minmax(0,1fr)_3rem_4.75rem_5.5rem]";
  return (
    <AppWindow
      label="Illustrative accounting screen with sample data: open receivables, May collections and credit notes, a list of invoices and a credit note with their payment status and receipt references, and accounting periods where February to April 2026 are closed and May is open."
      toolbar={<Crumbs items={["Accounting", "Invoices"]} />}
    >
      <div className="space-y-3 bg-canvas p-3 @lg:p-4">
        <div className="grid grid-cols-3 gap-2">
          <StatCard label="Open receivables" value="$8,420.00" meta="6 invoices" accent />
          <StatCard label="Collected · May" value="$58,480.00" meta="41 payments recorded" />
          <StatCard label="Credit notes · May" value="$75.00" meta="1 issued" />
        </div>

        <Panel
          title="Invoices and credit notes"
          meta="May 2026"
          bodyClassName="p-0"
          action={
            <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-forest px-2 py-1 text-3xs font-semibold text-white">
              <Plus className="size-3" /> New invoice
            </span>
          }
        >
          <div className={cn("grid items-center gap-x-3 border-b border-line/80 px-3 py-1.5", invoiceCols, TH)}>
            <span>Number</span>
            <span className="hidden @md:block">Tenant · unit</span>
            <span className="hidden @md:block">Issued</span>
            <span className="text-right">Amount</span>
            <span className="text-right">Status</span>
          </div>
          {INVOICES.map((invoice) => (
            <div key={invoice.no} className={cn("grid items-center gap-x-3 border-b border-line/60 px-3 py-[7px] last:border-b-0", invoiceCols)}>
              <span className="min-w-0">
                <span className="block font-mono text-[10.5px] font-medium text-ink">{invoice.no}</span>
                <span className="block truncate text-[9.5px] text-muted @md:hidden">
                  {invoice.who} · {invoice.unit}
                </span>
              </span>
              <span className="hidden min-w-0 truncate text-2xs text-ink @md:block">
                {invoice.who} <span className="font-mono text-[9.5px] text-muted">· {invoice.unit}</span>
              </span>
              <span className="hidden text-3xs text-muted @md:block">{invoice.date}</span>
              <span className="text-right text-2xs font-semibold text-ink tabular-nums">{invoice.amount}</span>
              <span className="flex flex-col items-end gap-0.5">
                <StatusPill tone={invoice.tone}>{invoice.status}</StatusPill>
                {invoice.note && <span className="font-mono text-[9px] text-muted">{invoice.note}</span>}
              </span>
            </div>
          ))}
        </Panel>

        <div className="rounded-lg border border-line bg-white p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-2xs font-semibold text-ink">Accounting periods</span>
            <span className="text-3xs text-muted">Closed periods are locked to new postings</span>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-1.5 @md:grid-cols-4">
            {PERIODS.map((period) => (
              <div
                key={period.label}
                className={cn(
                  "flex items-center justify-between rounded-md border px-2 py-1.5 text-3xs",
                  period.closed ? "border-line bg-ivory text-muted" : "border-forest/30 bg-sage-soft font-semibold text-forest",
                )}
              >
                <span>{period.label}</span>
                {period.closed ? (
                  <span className="flex items-center gap-1">
                    <Lock className="size-3" /> Closed
                  </span>
                ) : (
                  <span>Open</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppWindow>
  );
}

/* ======================================================================== */
/* 5. Maintenance and projects                                              */
/* ======================================================================== */

interface BoardCard {
  id: string;
  title: string;
  where: string;
  tag: string;
  tone: Tone;
  note?: string;
  expense?: string;
}

const BOARD: { title: string; count: number; cards: BoardCard[] }[] = [
  {
    title: "New",
    count: 2,
    cards: [
      { id: "MR-0115", title: "Dishwasher not draining", where: "Cedar Row · Unit 4", tag: "Medium", tone: "amber" },
      { id: "MR-0108", title: "Hallway light out", where: "Cedar Row · Common area", tag: "Low", tone: "neutral" },
    ],
  },
  {
    title: "Scheduled",
    count: 2,
    cards: [
      { id: "MR-0110", title: "HVAC filter replacement", where: "Harbor View · All units", tag: "Preventive", tone: "sky", note: "Every 90 days · May 20" },
      { id: "MR-0114", title: "Window latch repair", where: "Maple Court · Unit 2B", tag: "Low", tone: "neutral", note: "May 16" },
    ],
  },
  {
    title: "In progress",
    count: 1,
    cards: [
      { id: "MR-0112", title: "Leaking kitchen faucet", where: "Maple Court · Unit 2A", tag: "High", tone: "rose", expense: "EXP-0091 · $320.00" },
    ],
  },
  {
    title: "Completed",
    count: 3,
    cards: [{ id: "MR-0106", title: "Smoke detector battery", where: "Harbor View · Unit 112", tag: "Done", tone: "green", note: "Closed May 9" }],
  },
];

export function MaintenancePreview() {
  return (
    <AppWindow
      label="Illustrative maintenance board with sample data: requests organized into New, Scheduled, In progress and Completed, including a recurring preventive HVAC task and a repair linked to expense EXP-0091, plus a roof replacement project at 61% of its budget with linked documents and expenses."
      toolbar={<Crumbs items={["Maintenance", "Board"]} />}
    >
      <div className="space-y-3 bg-canvas p-3 @lg:p-4">
        <div className="grid grid-cols-2 gap-2 @2xl:grid-cols-4">
          {BOARD.map((column) => (
            <div key={column.title} className="min-w-0 rounded-lg border border-line/70 bg-[#f2f4f1] p-1.5">
              <div className="flex items-center justify-between px-1 pb-1.5 pt-0.5">
                <span className="text-3xs font-semibold uppercase tracking-[0.06em] text-muted">{column.title}</span>
                <span className="rounded bg-white px-1 text-[9px] font-semibold text-muted tabular-nums">{column.count}</span>
              </div>
              <div className="space-y-1.5">
                {column.cards.map((card) => (
                  <div key={card.id} className="rounded-md border border-line bg-white p-2 shadow-xs">
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-mono text-[9.5px] text-muted">{card.id}</span>
                      <StatusPill tone={card.tone} dot={false}>
                        {card.tag}
                      </StatusPill>
                    </div>
                    <div className="mt-1 truncate text-2xs font-medium text-ink">{card.title}</div>
                    <div className="truncate text-3xs text-muted">{card.where}</div>
                    {card.note && <div className="mt-1 truncate text-[9.5px] text-muted">{card.note}</div>}
                    {card.expense && (
                      <div className="mt-1.5 flex items-center gap-1 rounded bg-ivory px-1.5 py-0.5 text-[9.5px] text-evergreen">
                        <Receipt className="size-3 shrink-0 text-forest" />
                        <span className="truncate">{card.expense}</span>
                      </div>
                    )}
                  </div>
                ))}
                {column.count > column.cards.length && (
                  <div className="px-1 text-[9.5px] text-muted">+{column.count - column.cards.length} more</div>
                )}
              </div>
            </div>
          ))}
        </div>

        <Panel
          title={
            <span className="flex items-center gap-2">
              Roof replacement <IdTag>PJ-0004</IdTag>
            </span>
          }
          meta="Project · Cedar Row Townhomes (PR-0003)"
          action={<StatusPill tone="sky">In progress</StatusPill>}
        >
          <div className="grid gap-3 @md:grid-cols-[minmax(0,1fr)_auto] @md:items-center">
            <div className="min-w-0">
              <div className="flex items-center justify-between gap-2 text-3xs text-muted">
                <span className="truncate">
                  Spent <span className="font-semibold text-ink tabular-nums">$11,240.00</span> of $18,500.00 budget
                </span>
                <span className="font-semibold text-ink tabular-nums">61%</span>
              </div>
              <ProgressBar value={61} className="mt-1.5" />
            </div>
            <div className="flex flex-wrap gap-1.5 text-3xs text-muted">
              <span className="inline-flex items-center gap-1 rounded-md border border-line bg-ivory px-1.5 py-0.5">
                <Paperclip className="size-3" /> 3 documents
              </span>
              <span className="inline-flex items-center gap-1 rounded-md border border-line bg-ivory px-1.5 py-0.5">
                <Receipt className="size-3" /> 4 linked expenses
              </span>
            </div>
          </div>
        </Panel>
      </div>
    </AppWindow>
  );
}

/* ======================================================================== */
/* 6. Documents and activity                                                */
/* ======================================================================== */

const DOCUMENTS: { name: string; linked: string; access: string; tone: Tone; icon: LucideIcon }[] = [
  { name: "Lease agreement — L-0042.pdf", linked: "Lease · U-0020", access: "Private", tone: "neutral", icon: FileText },
  { name: "Tenant ID — J. Alvarez.jpg", linked: "Tenant record", access: "Restricted", tone: "rose", icon: IdCard },
  { name: "Receipt RCT-00001.pdf", linked: "Invoice INV-00124", access: "Private", tone: "neutral", icon: Receipt },
  { name: "Roof quote — PJ-0004.pdf", linked: "Project PJ-0004", access: "Private", tone: "neutral", icon: FileText },
  { name: "Unit 2A photos (8)", linked: "Unit U-0019", access: "Team", tone: "green", icon: ImageIcon },
];

const AUDIT = [
  { time: "10:42", action: "Receipt RCT-00001 issued", actor: "System", hash: "e5d1…3b72", prev: "2c8e…9f10" },
  { time: "10:42", action: "Payment PMT-00087 posted", actor: "Sam C.", hash: "2c8e…9f10", prev: "7f3a…c21e" },
  { time: "09:15", action: "Lease agreement uploaded", actor: "Priya N.", hash: "7f3a…c21e", prev: "91bd…04aa" },
];

export function DocumentsPreview() {
  return (
    <AppWindow
      label="Illustrative documents and activity screen with sample data: leases, receipts, tenant IDs, project quotes and unit photos in private storage with access levels, linked to their records, next to an activity history where each entry references the previous entry's hash."
      toolbar={<Crumbs items={["Documents", "All files"]} />}
    >
      <div className="grid gap-3 bg-canvas p-3 @lg:p-4 @3xl:grid-cols-5">
        <Panel className="@3xl:col-span-3" title="Documents" meta="Private storage · access by role" bodyClassName="p-0">
          <ul className="divide-y divide-line/70">
            {DOCUMENTS.map((doc) => (
              <li key={doc.name} className="flex items-center gap-2.5 px-3 py-2">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-sage-soft text-forest ring-1 ring-inset ring-line">
                  <doc.icon className="size-3.5" strokeWidth={1.75} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-2xs font-medium text-ink">{doc.name}</span>
                  <span className="flex items-center gap-1 truncate text-3xs text-muted">
                    <Link2 className="size-3 shrink-0" /> {doc.linked}
                  </span>
                </span>
                <StatusPill tone={doc.tone} dot={false}>
                  <Lock className="size-2.5" /> {doc.access}
                </StatusPill>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel
          className="@3xl:col-span-2"
          title={
            <span className="flex items-center gap-1.5">
              <History className="size-3 text-forest" /> Activity history
            </span>
          }
          meta="Chained entries"
        >
          <ol className="relative space-y-3">
            <span className="absolute bottom-3 left-[5px] top-2 w-px bg-line-strong" />
            {AUDIT.map((entry) => (
              <li key={entry.hash} className="relative pl-5">
                <span className="absolute left-0 top-1 size-[11px] rounded-full border-2 border-white bg-forest ring-1 ring-forest/30" />
                <div className="flex items-center justify-between gap-2 text-3xs text-muted">
                  <span>
                    {entry.time} · {entry.actor}
                  </span>
                </div>
                <div className="truncate text-2xs font-medium text-ink">{entry.action}</div>
                <div className="mt-1 flex flex-wrap items-center gap-1 font-mono text-[9px] text-muted">
                  <span className="rounded bg-ivory px-1 ring-1 ring-inset ring-line">prev {entry.prev}</span>
                  <span>→</span>
                  <span className="rounded bg-sage px-1 text-forest">hash {entry.hash}</span>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-3 border-t border-line pt-2 text-3xs text-muted">Each entry references the previous entry&rsquo;s hash.</p>
        </Panel>
      </div>
    </AppWindow>
  );
}
