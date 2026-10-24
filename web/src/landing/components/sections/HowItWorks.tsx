import type { ComponentType } from "react";
import { Building2, Check, DoorOpen, Users } from "lucide-react";
import { Container } from "@lf/components/ui/Container";
import { Reveal } from "@lf/components/ui/Reveal";
import { SectionHeading } from "@lf/components/ui/SectionHeading";
import { LogoMark } from "@lf/components/brand/Logo";
import { Avatar, StatusPill } from "@lf/components/mockups/primitives";

/* Small decorative step illustrations (sample content). */

function WorkspaceStep() {
  return (
    <div className="rounded-lg border border-line bg-white p-3 shadow-xs">
      <div className="flex items-center gap-2">
        <LogoMark className="size-5" />
        <span className="text-2xs font-semibold text-ink">Create your organization</span>
      </div>
      <div className="mt-3 text-3xs font-medium text-muted">Organization name</div>
      <div className="mt-1 flex h-8 items-center rounded-md border border-forest/40 bg-white px-2.5 text-xs text-ink ring-2 ring-forest/10">
        Northgate Rentals
      </div>
      <div className="mt-2.5 flex items-center justify-between">
        <span className="text-3xs text-muted">Your role</span>
        <StatusPill tone="evergreen" dot={false}>
          Owner
        </StatusPill>
      </div>
    </div>
  );
}

function RecordsStep() {
  const rows = [
    { icon: Building2, label: "Harbor View Apartments", meta: "PR-0001" },
    { icon: DoorOpen, label: "16 units", meta: "U-0001 – U-0016" },
    { icon: Users, label: "14 tenants · 14 leases", meta: "Linked" },
  ];
  return (
    <div className="space-y-1.5 rounded-lg border border-line bg-white p-3 shadow-xs">
      {rows.map(({ icon: Icon, label, meta }) => (
        <div key={label} className="flex items-center gap-2 rounded-md bg-ivory px-2 py-1.5">
          <Icon className="size-3.5 shrink-0 text-forest" strokeWidth={1.75} />
          <span className="min-w-0 flex-1 truncate text-2xs font-medium text-ink">{label}</span>
          <span className="shrink-0 font-mono text-[9.5px] text-muted">{meta}</span>
          <Check className="size-3 shrink-0 text-forest" strokeWidth={2.5} />
        </div>
      ))}
    </div>
  );
}

function OperateStep() {
  const bars = [52, 60, 57, 66, 63, 72, 69, 78];
  return (
    <div className="rounded-lg border border-line bg-white p-3 shadow-xs">
      <div className="flex items-center justify-between text-2xs">
        <span className="font-semibold text-ink">Portfolio report</span>
        <span className="text-3xs text-muted">Last 8 months</span>
      </div>
      <div className="mt-2.5 flex h-11 items-end gap-1">
        {bars.map((height, index) => (
          <span
            key={index}
            className={index === bars.length - 1 ? "flex-1 rounded-t-sm bg-forest" : "flex-1 rounded-t-sm bg-forest/35"}
            style={{ height: `${height}%` }}
          />
        ))}
      </div>
      <div className="mt-2.5 flex items-center justify-between border-t border-line pt-2">
        <span className="flex -space-x-1.5">
          {["AM", "PN", "SC", "LO"].map((initials, index) => (
            <Avatar key={initials} initials={initials} tone={index} className="size-5 text-[8px] ring-2 ring-white" />
          ))}
        </span>
        <span className="text-3xs text-muted">Team working from shared records</span>
      </div>
    </div>
  );
}

const STEPS: { title: string; description: string; Visual: ComponentType }[] = [
  {
    title: "Set Up Your Workspace",
    description: "Create an account, establish your organization, and configure the workspace for your rental business.",
    Visual: WorkspaceStep,
  },
  {
    title: "Add Your Properties and Records",
    description: "Organize properties, units, tenants, leases, financial records, and maintenance information.",
    Visual: RecordsStep,
  },
  {
    title: "Manage Operations and Understand Your Numbers",
    description:
      "Work from connected property and financial records, coordinate your team, and review portfolio reports.",
    Visual: OperateStep,
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" aria-labelledby="how-title" className="border-y border-line bg-white py-20 sm:py-24 lg:py-28">
      <Container>
        <Reveal>
          <SectionHeading
            align="center"
            eyebrow="How it works"
            titleId="how-title"
            title="Bring your rental business into one workspace."
            description="Three steps from a new account to a connected view of your operations."
          />
        </Reveal>

        <ol className="mt-14 grid gap-12 lg:mt-16 lg:grid-cols-3 lg:gap-8">
          {STEPS.map(({ title, description, Visual }, index) => (
            <Reveal as="li" key={title} delay={index * 100} className="relative flex gap-5 lg:block">
              {index < STEPS.length - 1 && (
                <span
                  aria-hidden="true"
                  className="absolute -bottom-12 left-6 top-14 w-px bg-gradient-to-b from-forest/45 to-line lg:-right-4 lg:bottom-auto lg:left-16 lg:top-6 lg:h-px lg:w-auto lg:bg-gradient-to-r"
                />
              )}
              <span className="relative z-10 flex size-12 shrink-0 items-center justify-center rounded-full border border-forest/25 bg-white text-sm font-semibold text-evergreen shadow-xs ring-4 ring-white tabular-nums">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div className="min-w-0 flex-1 lg:mt-6">
                <p className="text-eyebrow font-semibold uppercase text-forest">Step {index + 1}</p>
                <h3 className="mt-2 text-xl font-semibold tracking-tight text-evergreen text-balance">{title}</h3>
                <p className="mt-2 text-[0.9375rem] leading-relaxed text-muted">{description}</p>
                <div aria-hidden="true" className="mt-6 rounded-xl border border-line bg-sage-soft p-3">
                  <Visual />
                </div>
              </div>
            </Reveal>
          ))}
        </ol>
      </Container>
    </section>
  );
}
