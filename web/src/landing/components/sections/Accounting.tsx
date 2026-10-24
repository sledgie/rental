import { CalendarCheck, Landmark, Receipt, ReceiptText, Scale, Undo2, type LucideIcon } from "lucide-react";
import { Container } from "@lf/components/ui/Container";
import { Reveal } from "@lf/components/ui/Reveal";
import { IconTile } from "@lf/components/ui/IconTile";
import { Eyebrow } from "@lf/components/ui/SectionHeading";
import { AccountingLedger } from "@lf/components/mockups/AccountingLedger";

const CAPABILITIES: { icon: LucideIcon; title: string; description: string }[] = [
  {
    icon: Scale,
    title: "Double-entry accounting",
    description: "Financial transactions are supported by balanced journal entries, helping keep the books consistent.",
  },
  {
    icon: ReceiptText,
    title: "Invoices and payments",
    description:
      "Manage rental invoices, record payments, and maintain the relationship between billing and accounting records.",
  },
  {
    icon: Landmark,
    title: "Bank accounts and reconciliation",
    description: "Organize bank accounts and reconcile transactions against recorded financial activity.",
  },
  {
    icon: Receipt,
    title: "Expenses and receipts",
    description:
      "Keep expenses connected to the appropriate business records and issue receipt records when payments are posted.",
  },
  {
    icon: CalendarCheck,
    title: "Financial period controls",
    description: "Support closed accounting periods and protect issued financial records from unauthorized changes.",
  },
  {
    icon: Undo2,
    title: "Credit notes and refunds",
    description: "Manage adjustments and refunds through appropriate financial records.",
  },
];

export function Accounting() {
  return (
    <section
      id="accounting"
      aria-labelledby="accounting-title"
      className="relative isolate overflow-hidden border-y border-line bg-sage-soft py-20 sm:py-24 lg:py-32"
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[560px] bg-blueprint mask-fade-bottom" />

      <Container>
        <div className="grid gap-6 lg:grid-cols-12 lg:items-end lg:gap-12">
          <Reveal className="lg:col-span-7">
            <Eyebrow>Accounting built in</Eyebrow>
            <h2 id="accounting-title" className="mt-3 max-w-2xl text-title font-semibold text-evergreen text-balance">
              Property management is only half the picture.
            </h2>
          </Reveal>
          <Reveal delay={80} className="lg:col-span-5">
            <p className="text-lead text-muted text-pretty">
              L.O.F.T. connects the operational side of your rental business with the financial records behind it.
              Track the work, record the money, and understand how your portfolio is performing.
            </p>
          </Reveal>
        </div>

        <Reveal delay={120} className="mt-12 lg:mt-14">
          <AccountingLedger />
          <p className="mt-3 text-center text-xs text-muted">
            Illustrative records with sample data. Account names and numbers are examples.
          </p>
        </Reveal>

        <ul className="mt-16 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {CAPABILITIES.map((capability, index) => (
            <Reveal as="li" key={capability.title} delay={(index % 3) * 70} className="border-t border-line-strong/80 pt-6">
              <IconTile icon={capability.icon} tone="white" />
              <h3 className="mt-4 text-lg font-semibold tracking-tight text-evergreen">{capability.title}</h3>
              <p className="mt-2 text-[0.9375rem] leading-relaxed text-muted">{capability.description}</p>
            </Reveal>
          ))}
        </ul>
      </Container>
    </section>
  );
}
