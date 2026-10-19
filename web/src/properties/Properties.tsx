import { useEffect, useMemo, useState } from "react";
import type { PropertyRecord } from "./add/types/property";
import {
  currency,
  propertyBalance,
  propertyOccupied,
  propertyRentRoll,
  type Property,
} from "./data/properties";
import { Avatar, Bar, Donut, Sparkline, useCountUp } from "./components/charts";
import PropertyTable, { type SortKey } from "./components/PropertyTable";
import { PropertyForm } from "./add/components/properties/PropertyForm";
import { ToastProvider } from "./add/components/ui/Toast";
import { toProperty, toRecord } from "./add/convert";
import { getRecord, saveProperty, useProperties } from "./store";
import {
  Alert,
  Check,
  ChevronsDown,
  ChevronsUp,
  Download,
  Layers,
  Search,
  Send,
  Sparkle,
  Users,
  Wallet,
} from "./components/icons";
import { cn } from "./utils/cn";

type FilterKey = "all" | "delinquent" | "current" | "vacant";

const FILTERS: { key: FilterKey; label: string; dot: string }[] = [
  { key: "all", label: "All properties", dot: "bg-gry-400" },
  { key: "delinquent", label: "With arrears", dot: "bg-brick-500" },
  { key: "current", label: "Fully current", dot: "bg-sage-500" },
  { key: "vacant", label: "Has vacancy", dot: "bg-sand-500" },
];

export default function Properties({
  params,
  notify,
}: {
  params?: Record<string, string>;
  notify?: (message: string) => void;
}) {
  const properties = useProperties();
  // null = closed; { property: null } = adding; { property } = editing
  const [form, setForm] = useState<{ property: Property | null } | null>(null);

  // "+ Property" in the top bar links here with ?new=1
  useEffect(() => {
    if (!params?.new) return;
    setForm({ property: null });
    window.history.replaceState(null, "", "#/properties");
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  }, [params?.new]);

  const onSave = (record: PropertyRecord) => {
    const prev = properties.find((x) => x.code === record.id);
    const p = toProperty(record, prev);
    saveProperty(p, record);
    setForm(null);
    if (!prev) setExpanded((s) => new Set(s).add(p.code));
  };

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [sort, setSort] = useState<SortKey>("balance");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["PR-1042"]));
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    let out = properties.filter((p) => {
      if (q) {
        const hay = [
          p.code,
          p.name,
          p.address1,
          p.city,
          p.state,
          p.manager,
          ...p.units.flatMap((u) => [u.unit, ...u.tenants.map((t) => t.name)]),
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      const bal = propertyBalance(p);
      if (filter === "delinquent" && bal === 0) return false;
      if (filter === "current" && bal !== 0) return false;
      if (filter === "vacant" && !p.units.some((u) => u.status === "vacant" || u.status === "notice")) return false;
      return true;
    });

    const cmp: Record<SortKey, (a: Property, b: Property) => number> = {
      code: (a, b) => a.code.localeCompare(b.code),
      name: (a, b) => a.name.localeCompare(b.name),
      units: (a, b) => a.units.length - b.units.length,
      balance: (a, b) => propertyBalance(a) - propertyBalance(b),
    };
    out = [...out].sort(cmp[sort]);
    if (dir === "desc") out.reverse();
    return out;
  }, [query, filter, sort, dir, properties]);

  const totals = useMemo(() => {
    const balance = rows.reduce((s, p) => s + propertyBalance(p), 0);
    const rent = rows.reduce((s, p) => s + propertyRentRoll(p), 0);
    const units = rows.reduce((s, p) => s + p.units.length, 0);
    const occ = rows.reduce((s, p) => s + propertyOccupied(p), 0);
    const residents = rows.reduce((s, p) => s + p.units.reduce((a, u) => a + u.tenants.length, 0), 0);
    const withArrears = rows.filter((p) => propertyBalance(p) > 0).length;
    return { balance, rent, units, occ, residents, withArrears };
  }, [rows]);

  const portfolioBalance = properties.reduce((s, p) => s + propertyBalance(p), 0);
  const portfolioRent = properties.reduce((s, p) => s + propertyRentRoll(p), 0);
  const allUnits = properties.reduce((s, p) => s + p.units.length, 0);
  const allOcc = properties.reduce((s, p) => s + propertyOccupied(p), 0);
  const delinquentUnits = properties
    .flatMap((p) => p.units)
    .filter((u) => u.status === "delinquent").length;

  const animatedBalance = useCountUp(portfolioBalance);
  const collectionRate = 1 - portfolioBalance / (portfolioRent + portfolioBalance);

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const allOpen = rows.length > 0 && rows.every((p) => expanded.has(p.code));

  const onSort = (k: SortKey) => {
    if (k === sort) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSort(k);
      setDir(k === "name" || k === "code" ? "asc" : "desc");
    }
  };

  // contribution of each property to total arrears (stacked bar)
  const contributions = [...properties]
    .map((p) => ({ name: p.name, bal: propertyBalance(p) }))
    .sort((a, b) => b.bal - a.bal);
  const maxContribution = Math.max(...contributions.map((c) => c.bal), 1);
  const contributionColors = [
    "bg-mint-500",
    "bg-mint-500",
    "bg-mint-500",
    "bg-mint-500",
    "bg-mint-500",
    "bg-mint-500",
    "bg-mint-500",
    "bg-mint-500",
  ];

  const list = (
    <div className="rd page-glow bg-canvas text-ink">
      <main className="mx-auto max-w-[1500px] px-4 pb-24 pt-6 sm:px-6">
        {/* ---------------- page heading ---------------- */}
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
                Properties
              </h1>
              <span className="rounded-full bg-surface px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-mint-600 dark:text-mint-300 ring-1 ring-mint-200 dark:ring-mint-400/30">
                Master / detail
              </span>
              <button
                type="button"
                onClick={() => setForm({ property: null })}
                className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-mint-500 to-mint-600 px-3 py-1.5 text-xs font-bold text-gry-950 shadow-md transition hover:brightness-110"
              >
                <span aria-hidden="true" className="text-base leading-none">+</span> Add property
              </button>
            </div>
            <p className="mt-1 max-w-2xl text-sm text-ink-2">
              Each property is a master row — click the{" "}
              <span className="inline-flex h-4 w-4 translate-y-0.5 items-center justify-center rounded border border-hairline-strong text-ink-2">
                <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </span>{" "}
              to drop down its unit-level detail: who lives there and exactly what they owe.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-2xl border border-hairline bg-surface/80 p-2 shadow-sm backdrop-blur">
            <Donut
              value={collectionRate}
              size={58}
              thickness={7}
              tone="indigo"
              label={`${Math.round(collectionRate * 100)}%`}
            />
            <div className="pr-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-ink-3">Collected</p>
              <p className="text-sm font-bold text-ink">
                {currency(portfolioRent)}{" "}
                <span className="font-medium text-ink-3">/ {currency(portfolioRent + portfolioBalance)}</span>
              </p>
              <p className="text-[11px] font-semibold text-brick-500">
                {currency(portfolioBalance)} outstanding
              </p>
            </div>
          </div>
        </div>

        {/* ---------------- arrears distribution ---------------- */}
        <div className="mb-5 rounded-2xl border border-hairline bg-surface p-4 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-ink-2">
                Arrears concentration by property
              </p>
              <p className="text-[11px] text-ink-3">
                Top contributors to the {currency(portfolioBalance)} portfolio balance
              </p>
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
                    className={cn("h-full rounded-full transition-all duration-1000 ease-out", contributionColors[i])}
                    style={{ width: `${Math.max(1.5, (c.bal / maxContribution) * 100)}%`, opacity: 1 - i * 0.07 }}
                  />
                </div>
                <span className="w-20 shrink-0 text-right text-[11px] font-bold tabular-nums text-ink">
                  {currency(c.bal)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ---------------- toolbar ---------------- */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative min-w-[240px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search property, address, unit # or resident…"
              className="w-full rounded-xl border border-hairline bg-surface py-2.5 pl-9 pr-3 text-sm text-ink shadow-sm outline-none transition placeholder:text-ink-3 focus:border-mint-400 focus:ring-4 focus:ring-mint-100 dark:ring-mint-400/20"
            />
          </div>

          <div className="flex items-center gap-1 rounded-xl border border-hairline bg-surface p-1 shadow-sm">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition",
                  filter === f.key
                    ? "bg-gradient-to-r from-mint-600 to-mint-600 text-gry-950 shadow-sm"
                    : "text-ink-2 hover:bg-surface-2",
                )}
              >
                <span className={cn("h-1.5 w-1.5 rounded-full", f.dot)} />
                {f.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                setExpanded(allOpen ? new Set() : new Set(rows.map((p) => p.code)))
              }
              className="inline-flex items-center gap-1.5 rounded-xl border border-hairline bg-surface px-3 py-2.5 text-xs font-bold text-ink-2 shadow-sm transition hover:border-mint-300 dark:hover:border-mint-400/40 hover:text-mint-600 dark:hover:text-mint-300 dark:text-mint-300"
            >
              {allOpen ? <ChevronsUp className="h-4 w-4" /> : <ChevronsDown className="h-4 w-4" />}
              {allOpen ? "Collapse all" : "Expand all"}
            </button>
            <div className="hidden items-center gap-3 rounded-xl border border-hairline bg-surface px-3 py-2.5 text-xs font-semibold text-ink-2 shadow-sm sm:flex">
              <span>
                <span className="font-extrabold text-ink">{rows.length}</span> properties
              </span>
              <span className="h-4 w-px bg-surface-3" />
              <span>
                <span className="font-extrabold text-ink">{totals.units}</span> units
              </span>
              <span className="h-4 w-px bg-surface-3" />
              <span>
                <span className="font-extrabold text-brick-600 dark:text-brick-400">{currency(totals.balance)}</span> shown
              </span>
            </div>
          </div>
        </div>

        {/* ---------------- table ---------------- */}
        <PropertyTable
          rows={rows}
          expanded={expanded}
          toggle={toggle}
          selected={selected}
          toggleSelect={toggleSelect}
          sort={sort}
          dir={dir}
          onSort={onSort}
          onEdit={(p) => setForm({ property: p })}
        />

        <p className="mt-4 text-center text-[11px] text-ink-3">
          Showing {rows.length} of {properties.length} properties · {totals.units} units ·{" "}
          {totals.residents} residents · demo data
        </p>
      </main>

      {/* ---------------- selection action bar ---------------- */}
      <div
        className={cn(
          "fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-5 transition-all duration-300",
          selected.size > 0 ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-6 opacity-0",
        )}
      >
        <div className="flex items-center gap-3 rounded-2xl border border-gry-700/40 bg-gry-900/95 px-4 py-3 text-white shadow-2xl ring-1 ring-white/10 backdrop-blur dark:bg-gry-800/95 dark:shadow-black/60">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-mint-500/20 text-mint-300">
            <Check className="h-4 w-4" />
          </span>
          <p className="text-sm font-semibold">
            {selected.size} {selected.size === 1 ? "property" : "properties"} selected
          </p>
          <span className="h-6 w-px bg-surface/15" />
          <button className="inline-flex items-center gap-1.5 rounded-xl bg-surface/10 px-3 py-1.5 text-xs font-bold transition hover:bg-surface/20">
            <Send className="h-3.5 w-3.5" /> Send reminders
          </button>
          <button className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-mint-500 to-mint-500 px-3 py-1.5 text-xs font-bold shadow-lg transition hover:brightness-110">
            <Download className="h-3.5 w-3.5" /> Export statement
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="rounded-lg px-2 py-1 text-xs font-semibold text-ink-3 transition hover:text-white"
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  );

  const formView = form && (
    <div className="rd bg-canvas text-ink">
      <div className="mx-auto max-w-6xl px-4 pb-24 pt-6 sm:px-6">
        <PropertyForm
          key={form.property?.code ?? "new"}
          existing={form.property ? getRecord(form.property.code) ?? toRecord(form.property) : undefined}
          onSave={onSave}
          onClose={() => setForm(null)}
        />
      </div>
    </div>
  );

  // the toast container renders outside the page wrapper, so give it the .rd colour scope too
  return (
    <div className="rd contents">
      <ToastProvider>{formView ?? list}</ToastProvider>
    </div>
  );
}
