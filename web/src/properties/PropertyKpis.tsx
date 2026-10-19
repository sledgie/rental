// The four portfolio KPI cards for the Properties group on the Dashboard (they used to sit on the Properties page).
import {
  currency,
  propertyBalance,
  propertyOccupied,
  propertyRentRoll,
} from "./data/properties";
import { Avatar, Bar, Sparkline, useCountUp } from "./components/charts";
import { Alert, Check, Layers, Sparkle, Users, Wallet } from "./components/icons";
import { useProperties } from "./store";
import { cn } from "./utils/cn";

function KpiCard({
  icon,
  label,
  value,
  sub,
  tone,
  spark,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  tone: "indigo" | "rose" | "emerald" | "amber";
  spark?: number[];
  accent: React.ReactNode;
}) {
  const tones = {
    indigo: "from-mint-500 to-mint-600 shadow-none",
    rose: "from-brick-500 to-brick-600 shadow-none",
    emerald: "from-sage-500 to-sage-600 shadow-none",
    amber: "from-sand-500 to-sand-600 shadow-none",
  };
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-hairline bg-surface p-4 shadow-[0_1px_2px_rgba(15,23,42,.04)] transition hover:-translate-y-0.5 hover:shadow-lg dark:border-white/10 dark:shadow-[0_1px_2px_rgba(0,0,0,.45)] dark:hover:border-mint-400/30 dark:hover:shadow-[0_16px_36px_-14px_rgba(0,0,0,.85)]">
      <div className={cn("absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r", tones[tone])} />
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.09em] text-ink-3">{label}</p>
          <p className="mt-1.5 text-2xl font-extrabold tabular-nums tracking-tight text-ink">{value}</p>
        </div>
        <span className={cn("flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-md", tones[tone])}>
          {icon}
        </span>
      </div>
      <div className="mt-3 flex items-end justify-between gap-2">
        {accent}
        {spark && (
          <Sparkline
            data={spark}
            width={90}
            height={30}
            tone={tone}
            className="opacity-70 transition group-hover:opacity-100"
          />
        )}
      </div>
      <p className="mt-1 text-[11px] font-medium text-ink-3">{sub}</p>
    </div>
  );
}

export default function PropertyKpis() {
  const properties = useProperties();
  const balance = properties.reduce((s, p) => s + propertyBalance(p), 0);
  const rent = properties.reduce((s, p) => s + propertyRentRoll(p), 0);
  const units = properties.reduce((s, p) => s + p.units.length, 0);
  const occupied = properties.reduce((s, p) => s + propertyOccupied(p), 0);
  const residents = properties.reduce((s, p) => s + p.units.reduce((a, u) => a + u.tenants.length, 0), 0);
  const withArrears = properties.filter((p) => propertyBalance(p) > 0).length;
  const delinquent = properties.flatMap((p) => p.units).filter((u) => u.status === "delinquent").length;
  const animatedBalance = useCountUp(balance);
  const leased = units ? occupied / units : 0;

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard
        icon={<Wallet className="h-4.5 w-4.5" />}
        label="Outstanding balance"
        value={currency(Math.round(animatedBalance))}
        sub={`across ${withArrears} of ${properties.length} properties`}
        tone="rose"
        spark={properties.map((p) => propertyBalance(p)).slice(0, 8)}
        accent={
          <span className="inline-flex items-center gap-1 rounded-lg bg-brick-50 dark:bg-brick-400/10 px-2 py-1 text-[10px] font-bold text-brick-600 dark:text-brick-400">
            <Alert className="h-3 w-3" /> {delinquent} delinquent units
          </span>
        }
      />
      <KpiCard
        icon={<Sparkle className="h-4.5 w-4.5" />}
        label="Monthly rent roll"
        value={currency(rent)}
        sub="gross potential rent"
        tone="emerald"
        spark={[188, 196, 204, 199, 212, 220, 216, 228]}
        accent={
          <span className="inline-flex items-center gap-1 rounded-lg bg-sage-50 dark:bg-sage-400/10 px-2 py-1 text-[10px] font-bold text-sage-600 dark:text-sage-400">
            <Check className="h-3 w-3" /> 100% billed
          </span>
        }
      />
      <KpiCard
        icon={<Users className="h-4.5 w-4.5" />}
        label="Occupancy"
        value={`${occupied}/${units}`}
        sub={`${Math.round(leased * 100)}% of units leased`}
        tone="indigo"
        accent={
          <div className="w-28">
            <Bar value={leased} tone="indigo" height={6} />
          </div>
        }
      />
      <KpiCard
        icon={<Layers className="h-4.5 w-4.5" />}
        label="Units & residents"
        value={`${units}`}
        sub={`${residents} residents on active leases`}
        tone="amber"
        spark={[12, 14, 14, 17, 19, 21, 24, 26]}
        accent={
          <div className="flex -space-x-2">
            {["Dana W", "Owen C", "Renee S", "Alice K"].map((n) => (
              <Avatar key={n} name={n} size={24} />
            ))}
          </div>
        }
      />
    </div>
  );
}
