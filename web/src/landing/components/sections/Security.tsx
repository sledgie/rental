import type { ComponentType } from "react";
import { FolderLock, History, Layers, Scale, type LucideIcon } from "lucide-react";
import { Container } from "@lf/components/ui/Container";
import { Reveal } from "@lf/components/ui/Reveal";
import { IconTile } from "@lf/components/ui/IconTile";
import { Eyebrow, SectionHeading } from "@lf/components/ui/SectionHeading";
import {
  AuditChainVisual,
  DocumentAccessVisual,
  IntegrityChecks,
  IsolationDiagram,
} from "@lf/components/mockups/SecurityVisuals";
import { SampleBadge } from "@lf/components/mockups/primitives";

const PILLARS: { icon: LucideIcon; title: string; description: string; Visual: ComponentType }[] = [
  {
    icon: Layers,
    title: "Organization-level data separation",
    description:
      "Database-level isolation helps prevent one organization's records from being accessed by another organization.",
    Visual: IsolationDiagram,
  },
  {
    icon: FolderLock,
    title: "Permission-controlled documents",
    description: "Private document storage and access controls help restrict sensitive files to authorized users.",
    Visual: DocumentAccessVisual,
  },
  {
    icon: History,
    title: "Tamper-evident activity history",
    description: "A chained audit trail is designed to make unauthorized changes to historical records detectable.",
    Visual: AuditChainVisual,
  },
];

export function Security() {
  return (
    <section id="security" aria-labelledby="security-title" className="border-y border-line bg-white py-20 sm:py-24 lg:py-28">
      <Container>
        <Reveal>
          <SectionHeading
            align="center"
            eyebrow="Security, isolation and accountability"
            titleId="security-title"
            title="Your records deserve more than a shared spreadsheet."
            description="Property records, tenant information, financial activity, and sensitive documents require careful access control. L.O.F.T. is designed around organization-level data separation, role-based permissions, and traceable activity."
          />
        </Reveal>

        <ul className="mt-14 grid gap-5 lg:grid-cols-3">
          {PILLARS.map(({ icon, title, description, Visual }, index) => (
            <Reveal as="li" key={title} delay={index * 90} className="h-full">
              <article className="flex h-full flex-col overflow-hidden rounded-card border border-line bg-white shadow-card">
                <div aria-hidden="true" className="h-64 border-b border-line bg-ivory p-4 sm:p-5">
                  <Visual />
                </div>
                <div className="flex flex-1 flex-col p-6">
                  <IconTile icon={icon} size="sm" />
                  <h3 className="mt-4 text-lg font-semibold tracking-tight text-evergreen">{title}</h3>
                  <p className="mt-2 text-[0.9375rem] leading-relaxed text-muted">{description}</p>
                </div>
              </article>
            </Reveal>
          ))}
        </ul>

        <Reveal className="mt-5">
          <div className="grid overflow-hidden rounded-card border border-line bg-ivory lg:grid-cols-12">
            <div className="p-6 sm:p-8 lg:col-span-5">
              <IconTile icon={Scale} size="sm" />
              <Eyebrow className="mt-5">Supporting feature</Eyebrow>
              <h3 className="mt-2 text-xl font-semibold tracking-tight text-evergreen">
                Financial integrity at the database level
              </h3>
              <p className="mt-3 text-[0.9375rem] leading-relaxed text-muted">
                Accounting constraints and transaction rules help protect balanced entries and prevent unauthorized
                changes to issued invoices and duplicate financial postings.
              </p>
            </div>
            <div className="border-t border-line bg-sage-soft p-4 sm:p-6 lg:col-span-7 lg:border-l lg:border-t-0">
              <div className="mb-3 flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-evergreen">Constraint checks</span>
                <SampleBadge />
              </div>
              <IntegrityChecks />
            </div>
          </div>
        </Reveal>

        <p className="mx-auto mt-8 max-w-2xl text-center text-sm leading-relaxed text-muted">
          These descriptions reflect how L.O.F.T. is designed. They are not a third-party certification or a guarantee
          of regulatory compliance.
        </p>
      </Container>
    </section>
  );
}
