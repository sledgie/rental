// Arrears concentration by property (moved from the Properties page to the Properties group on the Dashboard).
import { currency, propertyBalance } from "./data/properties";
import { useProperties } from "./store";
import { cn } from "./utils/cn";

export default function PropertyArrears() {
  const properties = useProperties();
  const portfolioBalance = properties.reduce((s, p) => s + propertyBalance(p), 0);
  const contributions = properties
    .map((p) => ({ name: p.name, bal: propertyBalance(p) }))
    .sort((a, b) => b.bal - a.bal);
  const maxContribution = Math.max(...contributions.map((c) => c.bal), 1);

  return (
    <div className="rounded-2xl border border-hairline bg-surface p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-ink-2">Arrears concentration by property</p>
          <p className="text-[11px] text-ink-3">Top contributors to the {currency(portfolioBalance)} portfolio balance</p>
        </div>
        <div className="flex items-center gap-3 text-[10px] font-semibold text-ink-2">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-mint-500" /> Highest
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-mint-500/40" /> Lowest
          </span>
        </div>
      </div>
      <div className="space-y-2">
        {contributions.map((c, i) => (
          <div key={c.name} className="flex items-center gap-3">
            <span className="w-40 shrink-0 truncate text-[11px] font-semibold text-ink-2">{c.name}</span>
            <div className="h-4 flex-1 overflow-hidden rounded-full bg-surface-2">
              <div
                className={cn("h-full rounded-full bg-mint-500 transition-all duration-1000 ease-out")}
                style={{ width: `${Math.max(1.5, (c.bal / maxContribution) * 100)}%`, opacity: Math.max(0.3, 1 - i * 0.07) }}
              />
            </div>
            <span className="w-20 shrink-0 text-right text-[11px] font-bold tabular-nums text-ink">{currency(c.bal)}</span>
          </div>
        ))}
        {!contributions.length && <p className="py-4 text-center text-xs text-ink-3">No properties yet.</p>}
      </div>
    </div>
  );
}
