import { Building2, Calculator, Check, Crown, Eye, UserCog, Wrench, type LucideIcon } from "lucide-react";
import { Container } from "@lf/components/ui/Container";
import { Reveal } from "@lf/components/ui/Reveal";
import { IconTile } from "@lf/components/ui/IconTile";
import { SectionHeading } from "@lf/components/ui/SectionHeading";
import { TeamPreview } from "@lf/components/mockups/TeamPreview";

const HIGHLIGHTS = [
  "Invite team members",
  "Suspend user access",
  "Assign role-based permissions",
  "Owner-controlled organizations",
  "At least one owner in every organization",
  "Switch between authorized workspaces with one account",
];

/* Illustrative role examples — not final role definitions. */
const ROLES: { icon: LucideIcon; name: string; description: string }[] = [
  { icon: Crown, name: "Owner", description: "Controls the organization, its members and its settings." },
  { icon: UserCog, name: "Administrator", description: "Helps manage team members and workspace settings." },
  { icon: Building2, name: "Property Manager", description: "Works with properties, units, tenants, leases and maintenance." },
  { icon: Calculator, name: "Accountant or Bookkeeper", description: "Works with invoices, payments, expenses and the books." },
  { icon: Wrench, name: "Maintenance Staff", description: "Handles maintenance requests and project work." },
  { icon: Eye, name: "Read-Only User", description: "Views records without making changes." },
];

export function Teams() {
  return (
    <section id="teams" aria-labelledby="teams-title" className="py-20 sm:py-24 lg:py-28">
      <Container>
        <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-16">
          <Reveal className="lg:col-span-5">
            <SectionHeading
              eyebrow="Designed for property management teams"
              titleId="teams-title"
              title="The right access for the right people."
              description="Your bookkeeper does not need the same access as your maintenance team. L.O.F.T. supports role-based access so teams can work from the same workspace with appropriate permissions."
            />
            <ul className="mt-8 grid gap-x-6 gap-y-3.5 sm:grid-cols-2">
              {HIGHLIGHTS.map((highlight) => (
                <li key={highlight} className="flex gap-2.5 text-[0.9375rem] leading-snug text-ink">
                  <span className="mt-px flex size-5 shrink-0 items-center justify-center rounded-full bg-sage text-forest">
                    <Check className="size-3" strokeWidth={2.75} aria-hidden="true" />
                  </span>
                  {highlight}
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal delay={120} className="min-w-0 lg:col-span-7">
            <TeamPreview />
          </Reveal>
        </div>

        <div className="mt-20">
          <div className="flex flex-col gap-2 border-b border-line pb-5 sm:flex-row sm:items-end sm:justify-between">
            <h3 className="text-xl font-semibold tracking-tight text-evergreen">Example roles</h3>
            <p className="text-sm text-muted">Role names and access descriptions shown here are illustrative examples.</p>
          </div>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ROLES.map((role, index) => (
              <Reveal as="li" key={role.name} delay={(index % 3) * 70}>
                <div className="flex h-full gap-4 rounded-card border border-line bg-white p-5 shadow-card transition-[box-shadow,border-color] duration-300 hover:border-line-strong hover:shadow-card-hover">
                  <IconTile icon={role.icon} />
                  <div className="min-w-0">
                    <p className="font-semibold text-evergreen">{role.name}</p>
                    <p className="mt-1 text-sm leading-relaxed text-muted">{role.description}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </ul>
        </div>
      </Container>
    </section>
  );
}
