import {
  ArrowRight,
  Check,
  DoorOpen,
  FileSpreadsheet,
  FileText,
  Folder,
  FolderLock,
  Landmark,
  Mail,
  Receipt,
  Scale,
  StickyNote,
  UserRound,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";
import { Container } from "@lf/components/ui/Container";
import { Reveal } from "@lf/components/ui/Reveal";
import { Eyebrow } from "@lf/components/ui/SectionHeading";
import { StatusPill, type Tone } from "@lf/components/mockups/primitives";

const WITHOUT = [
  "Spreadsheets for rent and occupancy.",
  "Separate banking records and expense lists.",
  "Leases buried in folders.",
  "Maintenance requests scattered across messages.",
  "Manual reminders and follow-ups.",
  "Time-consuming financial reconciliation.",
];

const WITH = [
  "Properties, units, tenants, and leases in connected records.",
  "Accounting entries linked to financial transactions.",
  "Maintenance requests linked to properties and expenses.",
  "Documents organized in private storage.",
  "Communication history recorded in one place.",
  "Portfolio and financial reports from a centralized workspace.",
];

const FRAGMENTS: { icon: LucideIcon; label: string; rotate: number }[] = [
  { icon: FileSpreadsheet, label: "rent-roll-FINAL-v3.xlsx", rotate: -3 },
  { icon: Landmark, label: "Bank app · 37 uncategorized", rotate: 2 },
  { icon: Mail, label: "Re: Re: Fwd: faucet still leaking", rotate: -1.5 },
  { icon: Folder, label: "Shared drive / Leases / scans", rotate: 2.5 },
  { icon: Receipt, label: "IMG_4471.jpg", rotate: -2 },
  { icon: StickyNote, label: "Note: follow up on Unit 3B", rotate: 1.5 },
];

/* Illustrative sample record. */
const LINKED: { icon: LucideIcon; label: string; value: string; status?: string; tone?: Tone }[] = [
  { icon: UserRound, label: "Tenant", value: "Jordan Alvarez" },
  { icon: FileText, label: "Lease", value: "L-0042 · ends Jun 30", status: "Active", tone: "green" },
  { icon: Receipt, label: "Invoice", value: "INV-00124 · $1,650.00", status: "Paid", tone: "green" },
  { icon: Scale, label: "Journal", value: "JE-00311 · Dr = Cr", status: "Balanced", tone: "evergreen" },
  { icon: Wrench, label: "Request", value: "MR-0114 · Window latch", status: "Scheduled", tone: "sky" },
  { icon: FolderLock, label: "Documents", value: "3 files", status: "Private", tone: "neutral" },
];

function ScatteredTools() {
  return (
    <div
      aria-hidden="true"
      className="mt-6 flex min-h-60 flex-wrap content-center items-center justify-center gap-2.5 rounded-xl border border-dashed border-line-strong bg-white/40 p-5"
    >
      {FRAGMENTS.map(({ icon: Icon, label, rotate }) => (
        <span
          key={label}
          style={{ transform: `rotate(${rotate}deg)` }}
          className="inline-flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-2 text-xs text-muted shadow-xs"
        >
          <Icon className="size-3.5 shrink-0 text-[#97a19b]" strokeWidth={1.75} />
          {label}
        </span>
      ))}
    </div>
  );
}

function ConnectedRecord() {
  return (
    <div aria-hidden="true" className="mt-6 flex min-h-60 items-center rounded-xl border border-line bg-sage-soft p-2.5 sm:p-4">
      <div className="@container w-full min-w-0 rounded-lg border border-line bg-white shadow-xs">
        <div className="flex items-center justify-between gap-3 border-b border-line px-3.5 py-2.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-sage text-forest">
              <DoorOpen className="size-3.5" strokeWidth={1.75} />
            </span>
            <div className="min-w-0">
              <div className="truncate text-[13px] font-semibold text-ink">Unit 2B · Maple Court</div>
              <div className="truncate font-mono text-[10.5px] text-muted">U-0020 · PR-0002</div>
            </div>
          </div>
          <StatusPill tone="green">Occupied</StatusPill>
        </div>
        <ul className="relative px-3 py-2 @sm:px-3.5">
          <span className="absolute bottom-5 left-[1.375rem] top-5 w-px bg-line-strong @sm:left-[1.5rem]" />
          {LINKED.map(({ icon: Icon, label, value, status, tone }) => (
            <li key={label} className="relative flex items-center gap-3 py-[5px]">
              <span className="relative z-10 flex size-5 shrink-0 items-center justify-center rounded-full border border-line bg-white text-forest">
                <Icon className="size-3" strokeWidth={2} />
              </span>
              {/* Stacked label/value on narrow cards, single line from @sm */}
              <span className="min-w-0 flex-1 @sm:flex @sm:items-center @sm:gap-3">
                <span className="block text-[10px] leading-tight text-muted @sm:w-16 @sm:shrink-0 @sm:text-[11px]">{label}</span>
                <span className="block min-w-0 truncate text-[11px] font-medium text-ink @sm:flex-1">{value}</span>
              </span>
              {status && <StatusPill tone={tone}>{status}</StatusPill>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function ProblemSolution() {
  return (
    <section id="why-loft" aria-labelledby="why-title" className="border-y border-line bg-white py-20 sm:py-24 lg:py-28">
      <Container>
        <div className="grid gap-6 lg:grid-cols-12 lg:items-end lg:gap-12">
          <Reveal className="lg:col-span-7">
            <Eyebrow>Why L.O.F.T.</Eyebrow>
            <h2 id="why-title" className="mt-3 max-w-2xl text-title font-semibold text-evergreen text-balance">
              Your rental business shouldn&rsquo;t live in five different places.
            </h2>
          </Reveal>
          <Reveal delay={80} className="space-y-4 text-lead text-muted text-pretty lg:col-span-5">
            <p>
              Spreadsheets track the rent. Banking apps show the money. Emails contain the conversations. Shared
              folders hold the leases. Receipts end up somewhere else.
            </p>
            <p>
              When everything is disconnected, it becomes harder to follow up, keep records organized, and understand
              the financial performance of your portfolio.
            </p>
          </Reveal>
        </div>

        <div className="relative mt-14 grid gap-5 lg:grid-cols-2 lg:gap-6">
          <Reveal as="article" className="rounded-panel border border-line bg-ivory p-6 sm:p-8">
            <header className="flex items-center gap-3">
              <span className="flex size-8 items-center justify-center rounded-full bg-[#ebe9e1] text-muted" aria-hidden="true">
                <X className="size-4" strokeWidth={2.25} />
              </span>
              <h3 className="text-lg font-semibold text-ink">Without L.O.F.T.</h3>
            </header>
            <ScatteredTools />
            <ul className="mt-7 space-y-3">
              {WITHOUT.map((item) => (
                <li key={item} className="flex gap-3 text-[0.9375rem] leading-relaxed text-muted">
                  <X className="mt-1 size-4 shrink-0 text-[#a3aba6]" strokeWidth={2} aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal
            as="article"
            delay={100}
            className="rounded-panel border border-forest/20 bg-white p-6 shadow-card ring-4 ring-forest/[0.04] sm:p-8"
          >
            <header className="flex items-center gap-3">
              <span className="flex size-8 items-center justify-center rounded-full bg-forest text-white" aria-hidden="true">
                <Check className="size-4" strokeWidth={2.5} />
              </span>
              <h3 className="text-lg font-semibold text-evergreen">With L.O.F.T.</h3>
            </header>
            <ConnectedRecord />
            <ul className="mt-7 space-y-3">
              {WITH.map((item) => (
                <li key={item} className="flex gap-3 text-[0.9375rem] leading-relaxed text-ink">
                  <Check className="mt-1 size-4 shrink-0 text-forest" strokeWidth={2.5} aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </Reveal>

          <span
            aria-hidden="true"
            className="absolute left-1/2 top-1/2 z-10 hidden size-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-white text-forest shadow-card lg:flex"
          >
            <ArrowRight className="size-4" />
          </span>
        </div>
      </Container>
    </section>
  );
}
