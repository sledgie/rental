import { Building2, Check, House, Users, type LucideIcon } from "lucide-react";
import { Container } from "@lf/components/ui/Container";
import { Reveal } from "@lf/components/ui/Reveal";
import { IconTile } from "@lf/components/ui/IconTile";
import { SectionHeading } from "@lf/components/ui/SectionHeading";

const AUDIENCES: { icon: LucideIcon; title: string; description: string; points: string[] }[] = [
  {
    icon: House,
    title: "Independent Landlords",
    description:
      "Keep your properties, leases, expenses, and rental records organized without relying on disconnected spreadsheets.",
    points: ["Leases and expenses by property", "Payments recorded with receipt records"],
  },
  {
    icon: Building2,
    title: "Property Management Companies",
    description:
      "Manage multiple properties and units while maintaining organized records, financial visibility, and structured team access.",
    points: ["Portfolio-wide occupancy and receivables", "Double-entry books behind transactions"],
  },
  {
    icon: Users,
    title: "Property Management Teams",
    description:
      "Give bookkeepers, managers, and maintenance staff a shared operational workspace with appropriate permissions.",
    points: ["Role-based access for each member", "Maintenance linked to properties and expenses"],
  },
];

const PHOTO = "https://images.pexels.com/photos/24709792/pexels-photo-24709792.jpeg?auto=compress&cs=tinysrgb&fit=crop";

export function Audience() {
  return (
    <section id="who-its-for" aria-labelledby="audience-title" className="py-20 sm:py-24 lg:py-28">
      <Container>
        <Reveal>
          <SectionHeading
            eyebrow="Who it's for"
            titleId="audience-title"
            title="Built for the people who keep rental businesses running."
          />
        </Reveal>

        <div className="mt-12 grid gap-5 lg:mt-14 lg:grid-cols-12">
          <Reveal className="hidden sm:block lg:col-span-5">
            <figure className="relative h-full overflow-hidden rounded-panel border border-line bg-sage">
              <img
                src={`${PHOTO}&w=800&h=1000`}
                srcSet={`${PHOTO}&w=480&h=600 480w, ${PHOTO}&w=800&h=1000 800w, ${PHOTO}&w=1200&h=1500 1200w`}
                sizes="(min-width: 1024px) 40vw, 100vw"
                alt="Sunlit facade of a modern residential building with stacked balconies"
                width={800}
                height={1000}
                loading="lazy"
                decoding="async"
                className="aspect-[16/9] h-full w-full object-cover object-[50%_35%] saturate-[0.85] lg:aspect-auto lg:min-h-[30rem]"
              />
              <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-evergreen/45 via-evergreen/0 to-evergreen/0" />
              <div aria-hidden="true" className="absolute inset-x-4 bottom-4 rounded-lg border border-white/50 bg-white/90 p-3 shadow-float backdrop-blur-sm sm:max-w-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-xs font-semibold text-ink">Harbor View Apartments</span>
                  <span className="font-mono text-[10px] text-muted">PR-0001</span>
                </div>
                <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted">
                  <span>16 units</span>
                  <span aria-hidden="true">·</span>
                  <span>15 occupied</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-medium text-amber-ink">Sample record</span>
                </div>
              </div>
            </figure>
          </Reveal>

          <ul className="grid gap-5 lg:col-span-7">
            {AUDIENCES.map((audience, index) => (
              <Reveal as="li" key={audience.title} delay={index * 90}>
                <div className="flex h-full flex-col gap-5 rounded-card border border-line bg-white p-6 shadow-card transition-[box-shadow,border-color] duration-300 hover:border-line-strong hover:shadow-card-hover sm:flex-row sm:p-7">
                  <IconTile icon={audience.icon} size="lg" />
                  <div className="min-w-0">
                    <h3 className="text-lg font-semibold tracking-tight text-evergreen">{audience.title}</h3>
                    <p className="mt-2 text-[0.9375rem] leading-relaxed text-muted">{audience.description}</p>
                    <ul className="mt-4 flex flex-wrap gap-2">
                      {audience.points.map((point) => (
                        <li
                          key={point}
                          className="inline-flex items-center gap-1.5 rounded-full border border-line bg-ivory px-2.5 py-1 text-xs font-medium text-ink"
                        >
                          <Check className="size-3 text-forest" strokeWidth={2.75} aria-hidden="true" />
                          {point}
                        </li>
                      ))}
                    </ul>
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
