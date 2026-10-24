import { Fragment, type ReactNode } from "react";
import {
  ArrowRight,
  Banknote,
  Building2,
  CircleCheck,
  DoorOpen,
  FileText,
  Landmark,
  Lock,
  Receipt,
  Scale,
  UserRound,
  Wrench,
} from "lucide-react";
import { cn } from "@lf/utils/cn";
import { AppWindow, Crumbs, LinkChip, ProgressBar, StatusPill } from "./primitives";

/* Illustrative sample data — not customer results. */

const TRAIL = [
  { icon: FileText, label: "Invoice", id: "INV-00124" },
  { icon: Banknote, label: "Payment", id: "PMT-00087" },
  { icon: Receipt, label: "Receipt", id: "RCT-00001" },
  { icon: Scale, label: "Journal entry", id: "JE-00311" },
];

const JOURNAL_LINES: { code: string; name: string; debit?: string; credit?: string }[] = [
  { code: "1010", name: "Operating bank account", debit: "$1,650.00" },
  { code: "1200", name: "Accounts receivable — tenants", credit: "$1,650.00" },
];

const JOURNAL_COLS = "grid grid-cols-[minmax(0,1fr)_5rem_5rem] gap-x-3 @md:grid-cols-[minmax(0,1fr)_6rem_6rem]";

function AmountLine({ label, value, strong, muted }: { label: ReactNode; value: string; strong?: boolean; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className={cn("min-w-0 truncate", strong ? "font-semibold text-ink" : muted ? "text-muted" : "text-ink")}>{label}</span>
      <span className={cn("shrink-0 tabular-nums", strong ? "font-semibold text-ink" : muted ? "text-muted" : "text-ink")}>{value}</span>
    </div>
  );
}

function InvoiceCard() {
  return (
    <div className="@container min-w-0 rounded-lg border border-line bg-white">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5 border-b border-line px-3.5 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <FileText className="size-3.5 shrink-0 text-forest" />
            <span className="text-[13px] font-semibold text-ink">Invoice INV-00124</span>
            <StatusPill tone="green">Paid</StatusPill>
          </div>
          <div className="mt-1 truncate text-3xs text-muted">Jordan Alvarez · Maple Court, Unit 2B</div>
        </div>
        <div className="text-3xs leading-relaxed text-muted @xs:text-right">
          <div>Issued May 1, 2026</div>
          <div>Due May 5, 2026</div>
        </div>
      </div>
      <div className="space-y-2 px-3.5 py-3 text-2xs">
        <AmountLine label="Monthly rent — May 2026" value="$1,600.00" />
        <AmountLine label="Parking space P-12" value="$50.00" />
        <div className="border-t border-dashed border-line pt-2">
          <AmountLine label="Invoice total" value="$1,650.00" strong />
        </div>
        <AmountLine
          muted
          label={
            <span className="flex min-w-0 items-center gap-1.5">
              <Banknote className="size-3 shrink-0 text-forest" />
              <span className="truncate">Payment PMT-00087 · May 3 · bank transfer</span>
            </span>
          }
          value="−$1,650.00"
        />
        <div className="flex items-center justify-between rounded-md bg-sage-soft px-2 py-1.5 font-semibold text-evergreen">
          <span>Balance due</span>
          <span className="tabular-nums">$0.00</span>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-[#fafaf7] px-3.5 py-2 text-3xs">
        <span className="flex items-center gap-1.5 font-medium text-evergreen">
          <Receipt className="size-3 text-forest" />
          Receipt <span className="font-mono">RCT-00001</span> issued May 3
        </span>
        <span className="flex items-center gap-1 text-muted">
          <Lock className="size-3" /> Issued · edits locked
        </span>
      </div>
    </div>
  );
}

function JournalCard() {
  return (
    <div className="@container min-w-0 rounded-lg border border-forest/30 bg-white ring-4 ring-forest/[0.05]">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5 border-b border-line px-3.5 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Scale className="size-3.5 shrink-0 text-forest" />
            <span className="text-[13px] font-semibold text-ink">Journal entry JE-00311</span>
            <StatusPill tone="evergreen">Balanced</StatusPill>
          </div>
          <div className="mt-1 truncate text-3xs text-muted">Source: payment PMT-00087 applied to INV-00124</div>
        </div>
        <div className="text-3xs leading-relaxed text-muted @sm:text-right">
          <div>Posted May 3, 2026</div>
          <div>Period May 2026 · open</div>
        </div>
      </div>

      <div className="px-3.5 py-2.5">
        <div className={cn(JOURNAL_COLS, "border-b border-line pb-1.5 text-3xs font-medium uppercase tracking-[0.06em] text-muted")}>
          <span>Account</span>
          <span className="text-right">Debit</span>
          <span className="text-right">Credit</span>
        </div>
        {JOURNAL_LINES.map((line) => (
          <div key={line.code} className={cn(JOURNAL_COLS, "items-center border-b border-line/70 py-2 text-2xs")}>
            <span className="flex min-w-0 items-center gap-2">
              <span className="font-mono text-3xs text-muted">{line.code}</span>
              <span className="truncate text-ink">{line.name}</span>
            </span>
            <span className="text-right text-ink tabular-nums">{line.debit ?? "—"}</span>
            <span className="text-right text-ink tabular-nums">{line.credit ?? "—"}</span>
          </div>
        ))}
        <div className={cn(JOURNAL_COLS, "items-center pt-2 text-2xs font-semibold text-ink")}>
          <span>Totals</span>
          <span className="text-right tabular-nums">$1,650.00</span>
          <span className="text-right tabular-nums">$1,650.00</span>
        </div>
        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 rounded-md border border-forest/20 bg-sage-soft px-2.5 py-1.5 text-3xs">
          <span className="flex items-center gap-1.5 font-semibold text-forest">
            <CircleCheck className="size-3.5" /> Debits equal credits
          </span>
          <span className="text-muted tabular-nums">Difference $0.00</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 border-t border-line bg-[#fafaf7] px-3.5 py-2">
        <LinkChip icon={Building2}>PR-0002 · Maple Court</LinkChip>
        <LinkChip icon={DoorOpen}>U-0020 · Unit 2B</LinkChip>
        <LinkChip icon={UserRound}>J. Alvarez</LinkChip>
      </div>
    </div>
  );
}

function ExpenseCard() {
  return (
    <div className="min-w-0 rounded-lg border border-line bg-white p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-rose-soft text-rose">
            <Wrench className="size-3.5" />
          </span>
          <div className="min-w-0">
            <div className="truncate text-2xs font-semibold text-ink">Plumbing repair — kitchen faucet</div>
            <div className="font-mono text-3xs text-muted">EXP-0091 · May 13, 2026</div>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-[13px] font-semibold text-ink tabular-nums">$320.00</div>
          <StatusPill tone="green" className="mt-1">
            Posted
          </StatusPill>
        </div>
      </div>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        <LinkChip icon={Building2}>Maple Court · PR-0002</LinkChip>
        <LinkChip icon={DoorOpen}>Unit 2A · U-0019</LinkChip>
        <LinkChip icon={Wrench}>Request MR-0112</LinkChip>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 border-t border-line pt-2.5 text-3xs">
        <div className="min-w-0">
          <div className="text-muted">Debit</div>
          <div className="mt-0.5 truncate font-medium text-ink">6100 · Repairs and maintenance</div>
        </div>
        <div className="min-w-0">
          <div className="text-muted">Credit</div>
          <div className="mt-0.5 truncate font-medium text-ink">1010 · Operating bank account</div>
        </div>
      </div>
    </div>
  );
}

function ReconciliationCard() {
  return (
    <div className="min-w-0 rounded-lg border border-line bg-white p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-sage text-forest">
            <Landmark className="size-3.5" />
          </span>
          <div className="min-w-0">
            <div className="truncate text-2xs font-semibold text-ink">Bank reconciliation</div>
            <div className="truncate text-3xs text-muted">Operating account ···· 4821</div>
          </div>
        </div>
        <StatusPill tone="sky">In progress</StatusPill>
      </div>
      <div className="mt-3">
        <div className="flex items-center justify-between gap-2 text-3xs">
          <span className="font-medium text-ink">May 2026 statement</span>
          <span className="text-muted tabular-nums">38 of 41 matched</span>
        </div>
        <ProgressBar value={92.7} className="mt-1.5" />
        <div className="mt-1 text-3xs text-muted">3 transactions to review</div>
      </div>
      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 rounded-md bg-sage-soft px-2.5 py-1.5 text-3xs">
        <span className="font-medium text-ink">April 2026</span>
        <span className="flex items-center gap-1 font-semibold text-forest">
          <CircleCheck className="size-3" /> Reconciled · difference $0.00
        </span>
      </div>
    </div>
  );
}

export function AccountingLedger() {
  return (
    <AppWindow
      label="Illustrative accounting records with sample data: invoice INV-00124 for Maple Court Unit 2B paid by payment PMT-00087, receipt RCT-00001, journal entry JE-00311 with equal debit and credit totals of $1,650.00, a plumbing expense linked to its property, unit and maintenance request, and bank reconciliation status."
      toolbar={<Crumbs items={["Accounting", "Invoices", "INV-00124"]} />}
    >
      <div className="space-y-3 bg-canvas p-3 @lg:p-5">
        <div className="flex flex-wrap items-center gap-1.5">
          {TRAIL.map((step, index) => (
            <Fragment key={step.id}>
              {index > 0 && <ArrowRight className="size-3 shrink-0 text-muted/60" />}
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-3xs",
                  index === TRAIL.length - 1 ? "border-forest/30 bg-sage text-evergreen" : "border-line bg-white text-ink",
                )}
              >
                <step.icon className="size-3 shrink-0 text-forest" />
                <span className="hidden text-muted @md:inline">{step.label}</span>
                <span className="font-mono font-medium">{step.id}</span>
              </span>
            </Fragment>
          ))}
          <span className="ml-auto hidden text-3xs text-muted @3xl:inline">Linked records · one transaction</span>
        </div>

        <div className="grid gap-3 @3xl:grid-cols-12">
          <div className="min-w-0 @3xl:col-span-5">
            <InvoiceCard />
          </div>
          <div className="min-w-0 @3xl:col-span-7">
            <JournalCard />
          </div>
        </div>

        <div className="grid gap-3 @2xl:grid-cols-2">
          <ExpenseCard />
          <ReconciliationCard />
        </div>
      </div>
    </AppWindow>
  );
}
