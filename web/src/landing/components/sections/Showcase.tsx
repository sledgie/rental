import { useRef, useState, type ComponentType, type KeyboardEvent } from "react";
import {
  Building2,
  Check,
  FolderLock,
  Landmark,
  LayoutDashboard,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { Container } from "@lf/components/ui/Container";
import { Reveal } from "@lf/components/ui/Reveal";
import { SectionHeading } from "@lf/components/ui/SectionHeading";
import {
  AccountingPreview,
  DocumentsPreview,
  MaintenancePreview,
  PortfolioPreview,
  PropertiesPreview,
  TenantsPreview,
} from "@lf/components/mockups/ShowcasePreviews";
import { cn } from "@lf/utils/cn";

interface ShowcaseView {
  id: string;
  label: string;
  icon: LucideIcon;
  title: string;
  description: string;
  points: string[];
  Preview: ComponentType;
}

const VIEWS: ShowcaseView[] = [
  {
    id: "overview",
    label: "Portfolio Overview",
    icon: LayoutDashboard,
    title: "Your whole portfolio, at a glance",
    description:
      "Review occupancy, receivables, income and expenses across every property, then open the records behind the numbers.",
    points: [
      "Occupancy and receivables by property",
      "Income and expenses from posted accounting entries",
      "Open maintenance alongside the financials",
    ],
    Preview: PortfolioPreview,
  },
  {
    id: "properties",
    label: "Properties and Units",
    icon: Building2,
    title: "Structured records for every property and unit",
    description:
      "Each property and unit receives an automatic identifier, with owners, tenants and leases connected to the right record.",
    points: [
      "Automatic identifiers such as PR-0001 and U-0001",
      "Unit status, rent and tenant in one view",
      "Overlapping leases for the same unit are blocked",
    ],
    Preview: PropertiesPreview,
  },
  {
    id: "tenants",
    label: "Tenants and Leases",
    icon: Users,
    title: "Tenants, leases and history in one profile",
    description:
      "See lease terms, balances, documents and communication history together, so every follow-up starts with context.",
    points: [
      "Lease terms, rent and deposits on each lease",
      "Tenant balance tied to invoices and payments",
      "SMS history and opt-out preferences on record",
    ],
    Preview: TenantsPreview,
  },
  {
    id: "accounting",
    label: "Accounting",
    icon: Landmark,
    title: "Books that stay connected to operations",
    description:
      "Invoices, payments, credit notes and accounting periods sit alongside the properties and tenants they belong to.",
    points: [
      "Invoice status linked to recorded payments",
      "Credit notes for adjustments to issued invoices",
      "Closed periods protect finalized records",
    ],
    Preview: AccountingPreview,
  },
  {
    id: "maintenance",
    label: "Maintenance and Projects",
    icon: Wrench,
    title: "Track repairs from request to completion",
    description:
      "Move requests through a clear workflow, schedule preventive work, and keep larger projects on budget with linked costs and documents.",
    points: [
      "Requests linked to properties, units and expenses",
      "Preventive maintenance schedules",
      "Project budgets, progress and documents",
    ],
    Preview: MaintenancePreview,
  },
  {
    id: "documents",
    label: "Documents and Activity",
    icon: FolderLock,
    title: "Every file and change, accounted for",
    description:
      "Keep leases, receipts, IDs and photos in private storage, and review a chained history of important activity.",
    points: [
      "Private storage with permission-based access",
      "Documents linked to the records they support",
      "Tamper-evident activity history",
    ],
    Preview: DocumentsPreview,
  },
];

export function Showcase() {
  const [active, setActive] = useState(0);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const selectTab = (index: number) => {
    setActive(index);
    tabRefs.current[index]?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const last = VIEWS.length - 1;
    const next: Record<string, number> = {
      ArrowRight: active === last ? 0 : active + 1,
      ArrowLeft: active === 0 ? last : active - 1,
      Home: 0,
      End: last,
    };
    if (!(event.key in next)) return;
    event.preventDefault();
    selectTab(next[event.key]);
  };

  return (
    <section id="platform" aria-labelledby="platform-title" className="py-20 sm:py-24 lg:py-28">
      <Container>
        <Reveal>
          <SectionHeading
            align="center"
            eyebrow="The platform"
            titleId="platform-title"
            title="One workspace. A clearer view of your entire operation."
            description="Move between your portfolio, records and books without switching tools. Select a view to see how the pieces connect."
          />
        </Reveal>

        <Reveal delay={80} className="mt-12">
          <div
            role="tablist"
            aria-label="Product views"
            onKeyDown={onKeyDown}
            className="grid grid-cols-2 gap-1.5 rounded-panel border border-line bg-white p-1.5 shadow-xs sm:grid-cols-3 xl:flex"
          >
            {VIEWS.map((view, index) => {
              const selected = index === active;
              return (
                <button
                  key={view.id}
                  ref={(element) => {
                    tabRefs.current[index] = element;
                  }}
                  type="button"
                  role="tab"
                  id={`showcase-tab-${view.id}`}
                  aria-selected={selected}
                  aria-controls={`showcase-panel-${view.id}`}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => setActive(index)}
                  className={cn(
                    "flex min-h-12 items-center gap-2 rounded-[0.7rem] px-3 py-2 text-left text-[0.8125rem] font-medium leading-tight transition-colors duration-200 sm:text-sm xl:flex-1 xl:justify-center xl:whitespace-nowrap",
                    selected
                      ? "bg-evergreen text-white shadow-[0_1px_2px_rgb(12_42_34/0.3)]"
                      : "text-muted hover:bg-sage-soft hover:text-evergreen",
                  )}
                >
                  <view.icon
                    className={cn("size-4 shrink-0", selected ? "text-mint" : "text-forest/70")}
                    strokeWidth={1.75}
                    aria-hidden="true"
                  />
                  {view.label}
                </button>
              );
            })}
          </div>
        </Reveal>

        <div className="mt-10 lg:mt-12">
          {VIEWS.map((view, index) => {
            const { Preview } = view;
            return (
              <div
                key={view.id}
                role="tabpanel"
                id={`showcase-panel-${view.id}`}
                aria-labelledby={`showcase-tab-${view.id}`}
                hidden={index !== active}
                tabIndex={0}
                className="grid animate-fade-up items-center gap-8 rounded-card focus-visible:outline-offset-8 lg:min-h-[34rem] lg:grid-cols-12 lg:content-start lg:gap-12"
              >
                <div className="lg:col-span-4">
                  <p className="text-sm font-semibold text-forest">{view.label}</p>
                  <h3 className="mt-2 text-2xl font-semibold tracking-tight text-evergreen text-balance">{view.title}</h3>
                  <p className="mt-3 text-base leading-relaxed text-muted text-pretty">{view.description}</p>
                  <ul className="mt-6 space-y-3 border-t border-line pt-6">
                    {view.points.map((point) => (
                      <li key={point} className="flex gap-3 text-[0.9375rem] leading-snug text-ink">
                        <span className="mt-px flex size-5 shrink-0 items-center justify-center rounded-full bg-sage text-forest">
                          <Check className="size-3" strokeWidth={2.75} aria-hidden="true" />
                        </span>
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="min-w-0 lg:col-span-8">
                  <Preview />
                  <p className="mt-3 text-center text-xs text-muted">
                    Illustrative preview with sample data, not customer results.
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
