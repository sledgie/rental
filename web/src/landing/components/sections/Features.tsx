import type { ComponentType } from "react";
import { Building2, ChartColumn, Check, FolderLock, MessageSquareText, Workflow, Wrench, type LucideIcon } from "lucide-react";
import { Container } from "@lf/components/ui/Container";
import { Reveal } from "@lf/components/ui/Reveal";
import { IconTile } from "@lf/components/ui/IconTile";
import { SectionHeading } from "@lf/components/ui/SectionHeading";
import {
  AutomationMini,
  CommsMini,
  DocumentsMini,
  MaintenanceMini,
  PropertiesMini,
  ReportsMini,
} from "@lf/components/mockups/FeatureMinis";

interface Feature {
  id: string;
  icon: LucideIcon;
  category: string;
  title: string;
  description: string;
  notes: string[];
  /** Distinguishes configurable capabilities from always-on features. */
  tag?: string;
  Mini: ComponentType;
}

const FEATURES: Feature[] = [
  {
    id: "feature-properties",
    icon: Building2,
    category: "Properties, Units and Tenants",
    title: "Everything connected to the right property.",
    description:
      "Manage property records, units, owners, tenant details, and lease relationships in one structured workspace.",
    notes: ["Automatic identifiers such as PR-0001 and U-0001", "Lease overlap prevention for the same unit"],
    Mini: PropertiesMini,
  },
  {
    id: "feature-maintenance",
    icon: Wrench,
    category: "Maintenance and Projects",
    title: "From the first repair request to a full renovation.",
    description:
      "Track maintenance requests, schedule preventive maintenance, associate expenses with repairs, and organize larger property projects with budgets and documents.",
    notes: ["Preventive maintenance schedules", "Project budgets, progress and documents"],
    Mini: MaintenanceMini,
  },
  {
    id: "feature-communication",
    icon: MessageSquareText,
    category: "Communication and Templates",
    title: "Keep every important conversation accountable.",
    description:
      "Organize tenant communications, reuse message templates, and send SMS messages through the configured Twilio integration.",
    notes: ["SMS respects tenant opt-out settings", "Messages are kept in a communication record"],
    tag: "Requires Twilio configuration",
    Mini: CommsMini,
  },
  {
    id: "feature-automation",
    icon: Workflow,
    category: "Automation",
    title: "Reduce repetitive work with rules.",
    description: "Configure trigger-and-action rules for supported events, reminders, and follow-ups.",
    notes: ["Trigger-and-action rule configuration", "Rules apply to supported events"],
    tag: "Rule configuration",
    Mini: AutomationMini,
  },
  {
    id: "feature-documents",
    icon: FolderLock,
    category: "Documents and Records",
    title: "Keep important documents organized and protected.",
    description:
      "Organize leases, receipts, IDs, and property photos in private storage, with access controlled by permissions.",
    notes: ["Sensitive files are limited to authorized users", "Private storage for leases, receipts, IDs and photos"],
    Mini: DocumentsMini,
  },
  {
    id: "feature-reports",
    icon: ChartColumn,
    category: "Reports and Portfolio Insights",
    title: "See your portfolio beyond individual units.",
    description:
      "Review occupancy, property performance, project progress, and financial reporting across your whole portfolio.",
    notes: ["Occupancy and property performance", "Project progress and financial reporting"],
    Mini: ReportsMini,
  },
];

export function Features() {
  return (
    <section id="features" aria-labelledby="features-title" className="py-20 sm:py-24 lg:py-28">
      <Container>
        <Reveal>
          <SectionHeading
            eyebrow="Platform features"
            titleId="features-title"
            title="Everything your rental operation runs on, connected."
            description="Six core capabilities share the same records, so the work your team does and the numbers you report stay connected."
          />
        </Reveal>

        <ul className="mt-12 grid gap-5 md:grid-cols-2 lg:mt-14 lg:grid-cols-3">
          {FEATURES.map((feature, index) => {
            const { Mini } = feature;
            return (
              <Reveal as="li" key={feature.id} delay={(index % 3) * 80} className="h-full">
                <article
                  id={feature.id}
                  aria-labelledby={`${feature.id}-title`}
                  className="group flex h-full flex-col overflow-hidden rounded-card border border-line bg-white shadow-card transition-[translate,box-shadow,border-color] duration-300 ease-soft hover:-translate-y-1 hover:border-line-strong hover:shadow-card-hover motion-reduce:hover:translate-y-0"
                >
                  <div aria-hidden="true" className="relative h-52 overflow-hidden border-b border-line bg-sage-soft/80 p-4 sm:p-5">
                    <div className="absolute inset-0 bg-blueprint opacity-70 mask-fade-center" />
                    <div className="relative transition-transform duration-500 ease-soft group-hover:-translate-y-0.5">
                      <Mini />
                    </div>
                  </div>

                  <div className="flex flex-1 flex-col p-6">
                    <div className="flex items-center gap-2.5">
                      <IconTile icon={feature.icon} size="sm" />
                      <span className="text-sm font-semibold text-forest">{feature.category}</span>
                    </div>
                    <h3
                      id={`${feature.id}-title`}
                      className="mt-4 text-lg font-semibold leading-snug tracking-tight text-evergreen text-balance"
                    >
                      {feature.title}
                    </h3>
                    <p className="mt-2 text-[0.9375rem] leading-relaxed text-muted">{feature.description}</p>

                    <div className="mt-auto pt-5">
                      <ul className="space-y-2 border-t border-line pt-4">
                        {feature.notes.map((note) => (
                          <li key={note} className="flex gap-2.5 text-sm leading-snug text-ink">
                            <Check className="mt-0.5 size-3.5 shrink-0 text-forest" strokeWidth={2.5} aria-hidden="true" />
                            {note}
                          </li>
                        ))}
                      </ul>
                      {feature.tag && (
                        <p className="mt-4 inline-flex items-center rounded-full border border-line bg-ivory px-2.5 py-1 text-xs font-medium text-muted">
                          {feature.tag}
                        </p>
                      )}
                    </div>
                  </div>
                </article>
              </Reveal>
            );
          })}
        </ul>

        <p className="mt-8 text-center text-xs text-muted">Feature previews are illustrative and use sample data.</p>
      </Container>
    </section>
  );
}
