import { cn } from "@/utils/cn";
import { sampleEvery, type SeriesPoint, type Totals } from "@/lib/data";
import { change, money, moneyFull, numberFull, pct } from "@/lib/format";
import { Icon, type IconName } from "./Icon";
import { Card, Delta } from "./ui";
import { Sparkline } from "./charts";

interface Kpi {
  label: string;
  value: string;
  delta: number | null;
  kind: "percent" | "points";
  spark: number[];
  color: string;
  icon: IconName;
  footer: string;
  footnote: string;
}

function sparkOf(buckets: SeriesPoint[], key: "revenue" | "occupancy" | "bookings" | "adr") {
  return sampleEvery(buckets, 16).map((bucket) => bucket[key]);
}

export function KpiCards({
  totals,
  previous,
  buckets,
  propertyCount,
}: {
  totals: Totals;
  previous: Totals;
  buckets: SeriesPoint[];
  propertyCount: number;
}) {
  const conversion = totals.inquiries ? totals.bookings / totals.inquiries : 0;
  const cards: Kpi[] = [
    {
      label: "Gross booking revenue",
      value: money(totals.revenue),
      delta: previous.revenue ? change(totals.revenue, previous.revenue) : null,
      kind: "percent",
      spark: sparkOf(buckets, "revenue"),
      color: "var(--c1)",
      icon: "wallet",
      footer: `${pct(totals.occupancy)} occupancy · ${moneyFull(totals.adr)} ADR`,
      footnote: `Exactly ${moneyFull(totals.revenue)} across all selected rentals.`,
    },
    {
      label: "Occupancy rate",
      value: pct(totals.occupancy),
      delta: previous.available ? (totals.occupancy - previous.occupancy) * 100 : null,
      kind: "points",
      spark: sparkOf(buckets, "occupancy"),
      color: "var(--c2)",
      icon: "building",
      footer: `${numberFull(totals.nights)} of ${numberFull(totals.available)} unit-nights sold`,
      footnote: `${numberFull(totals.nights)} booked nights out of ${numberFull(totals.available)} available.`,
    },
    {
      label: "Confirmed bookings",
      value: numberFull(totals.bookings),
      delta: previous.bookings ? change(totals.bookings, previous.bookings) : null,
      kind: "percent",
      spark: sparkOf(buckets, "bookings"),
      color: "var(--c4)",
      icon: "calendar",
      footer: `${numberFull(totals.inquiries)} inquiries · ${pct(conversion, 0)} conversion`,
      footnote: `${numberFull(totals.inquiries)} inquiries converted to confirmed stays.`,
    },
    {
      label: "Average daily rate",
      value: moneyFull(totals.adr),
      delta: previous.adr ? change(totals.adr, previous.adr) : null,
      kind: "percent",
      spark: sparkOf(buckets, "adr"),
      color: "var(--c3)",
      icon: "trend",
      footer: `${propertyCount} ${propertyCount === 1 ? "property" : "properties"} · ${numberFull(totals.nights)} nights`,
      footnote: `Blended ADR from ${numberFull(totals.nights)} booked nights.`,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card, index) => (
        <Card
          key={card.label}
          className={cn(
            "fade-rise group overflow-hidden p-4 hover:-translate-y-0.5 hover:border-[var(--line)]",
            "transition-all duration-300"
          )}
        >
          <div style={{ animationDelay: `${index * 55}ms` }}>
            <div className="flex items-start justify-between gap-2">
              <p className="text-[11.5px] font-medium text-muted">{card.label}</p>
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-muted transition-colors group-hover:bg-brand-soft group-hover:text-brand">
                <Icon name={card.icon} size={15} />
              </span>
            </div>
            <div className="mt-2.5 flex items-end justify-between gap-2">
              <div className="min-w-0">
                <p
                  className="font-display text-[27px] font-semibold leading-none tracking-[-0.035em] text-ink tnum"
                  title={card.footnote}
                >
                  {card.value}
                </p>
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                  <Delta value={card.delta} kind={card.kind} compact />
                  <span className="text-[10.5px] text-muted">vs. prior</span>
                </div>
              </div>
              <div className="mb-0.5 shrink-0 opacity-80 transition-opacity group-hover:opacity-100">
                <Sparkline values={card.spark} color={card.color} width={78} height={32} />
              </div>
            </div>
            <div className="mt-3.5 flex items-center gap-1.5 border-t border-line-soft pt-2.5">
              <Icon name="info" size={11} className="shrink-0 text-muted" />
              <p className="truncate text-[10.5px] text-muted" title={card.footnote}>
                {card.footer}
              </p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
