import { useState } from "react";
import {
  currency,
  propertyCollectionRate,
  propertyOccupied,
  propertyRentRoll,
  propertyTenants,
  severityOf,
  statusMeta,
  type Property,
  type Unit,
} from "../data/properties";
import { Avatar, AvatarStack, Bar, Donut, HeatStrip, Sparkline } from "./charts";
import { Alert, Bed, Calendar, Check, Clock, Mail, Phone, Ruler, Send, Users } from "./icons";
import { cn } from "../utils/cn";

function StatTile({
  icon,
  label,
  value,
  sub,
  tone = "slate",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  tone?: "slate" | "indigo" | "emerald" | "rose";
}) {
  const tones = {
    slate: "text-ink-2 bg-surface-2",
    indigo: "text-mint-600 dark:text-mint-300 bg-mint-100 dark:bg-mint-400/15",
    emerald: "text-sage-600 dark:text-sage-400 bg-sage-100 dark:bg-sage-400/15",
    rose: "text-brick-600 dark:text-brick-400 bg-brick-100 dark:bg-brick-400/15",
  };
  return (
    <div className="group rounded-xl border border-hairline/80 bg-surface/80 p-3 shadow-sm transition hover:-translate-y-0.5 hover:border-mint-200 dark:hover:border-mint-400/30 dark:border-mint-400/30 hover:shadow-md">
      <div className="flex items-center gap-2">
        <span className={cn("flex h-7 w-7 items-center justify-center rounded-lg", tones[tone])}>{icon}</span>
        <span className="text-[10px] font-bold uppercase tracking-wider text-ink-3">{label}</span>
      </div>
      <p className="mt-2 text-lg font-bold tabular-nums leading-none text-ink">{value}</p>
      {sub && <p className="mt-1 text-[11px] text-ink-3">{sub}</p>}
    </div>
  );
}

function DueCell({ unit }: { unit: Unit }) {
  if (unit.status === "vacant") return <span className="text-xs text-ink-3">—</span>;
  const overdue = unit.dueInDays < 0;
  const label = overdue ? `${Math.abs(unit.dueInDays)}d overdue` : `in ${unit.dueInDays}d`;
  return (
    <div className="flex items-center gap-1.5">
      {overdue ? (
        <Alert className="h-3.5 w-3.5 text-brick-500" />
      ) : (
        <Clock className="h-3.5 w-3.5 text-ink-3" />
      )}
      <span className={cn("text-xs font-semibold", overdue ? "text-brick-600 dark:text-brick-400" : "text-ink-2")}>{label}</span>
    </div>
  );
}

function UnitRow({ unit, index }: { unit: Unit; index: number }) {
  const [open, setOpen] = useState(false);
  const meta = statusMeta[unit.status];
  const sev = severityOf(unit.balance, unit.rent);
  const ratio = unit.rent ? Math.min(unit.balance / unit.rent, 2) : 0;
  const occupied = unit.tenants.length > 0 && unit.status !== "vacant";

  return (
    <>
      <tr
        className={cn(
          "border-b border-hairline-2 transition-colors last:border-0 hover:bg-mint-50 dark:bg-mint-400/10/40 dark:hover:bg-mint-400/10",
          sev === "bad" && "bg-brick-50 dark:bg-brick-400/10/30 dark:bg-brick-400/[0.08]",
        )}
      >
        {/* unit id */}
        <td className="whitespace-nowrap px-3 py-3">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setOpen((o) => !o)}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-hairline bg-surface text-ink-3 transition hover:border-mint-300 dark:hover:border-mint-400/40 hover:text-mint-600 dark:hover:text-mint-300 dark:text-mint-300"
              aria-label="Toggle tenant details"
            >
              <svg
                viewBox="0 0 24 24"
                className={cn("h-3.5 w-3.5 transition-transform duration-300", open && "rotate-90")}
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m9 6 6 6-6 6" />
              </svg>
            </button>
            <div>
              <p className="font-mono text-sm font-bold text-ink">#{unit.unit}</p>
              <p className="text-[10px] font-medium uppercase tracking-wide text-ink-3">
                {unit.beds} bd · {unit.baths} ba · {unit.sqft.toLocaleString()} sf
              </p>
            </div>
          </div>
        </td>

        {/* occupants */}
        <td className="px-3 py-3">
          {occupied ? (
            <div className="flex items-center gap-2.5">
              <AvatarStack names={unit.tenants.map((t) => t.name)} max={3} />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink">
                  {unit.tenants[0].name}
                </p>
                <p className="text-[11px] text-ink-3">
                  {unit.tenants.length === 1
                    ? "1 resident"
                    : `+ ${unit.tenants.length - 1} more in unit`}
                </p>
              </div>
            </div>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2 py-1 text-[11px] font-semibold text-ink-2">
              <span className="h-1.5 w-1.5 rounded-full bg-gry-400" /> Ready to lease
            </span>
          )}
        </td>

        {/* lease */}
        <td className="whitespace-nowrap px-3 py-3 text-xs font-medium text-ink-2">{unit.leaseEnd}</td>

        {/* rent */}
        <td className="whitespace-nowrap px-3 py-3 text-right">
          <span className="text-sm font-semibold tabular-nums text-ink-2">{currency(unit.rent)}</span>
        </td>

        {/* balance */}
        <td className="whitespace-nowrap px-3 py-3">
          <div className="flex flex-col items-end gap-1">
            <span
              className={cn(
                "text-sm font-bold tabular-nums",
                sev === "good" && "text-sage-600 dark:text-sage-400",
                sev === "warn" && "text-sand-600 dark:text-sand-400",
                sev === "bad" && "text-brick-600 dark:text-brick-400",
              )}
            >
              {unit.balance === 0 ? "Paid" : currency(unit.balance)}
            </span>
            {unit.balance > 0 && (
              <div className="w-28">
                <Bar
                  value={ratio / 2}
                  tone={sev === "bad" ? "rose" : "amber"}
                  delay={index * 60}
                  height={5}
                />
                <p className="mt-0.5 text-right text-[10px] font-semibold text-ink-3">
                  {ratio.toFixed(1)}× rent
                </p>
              </div>
            )}
          </div>
        </td>

        {/* due */}
        <td className="whitespace-nowrap px-3 py-3">
          <DueCell unit={unit} />
        </td>

        {/* history */}
        <td className="px-3 py-3">
          <div className="flex flex-col items-center gap-1">
            <HeatStrip history={unit.history} />
            <span className="text-[10px] font-semibold text-ink-3">
              {unit.history.length ? `${Math.round((unit.history.reduce((a, b) => a + b, 0) / unit.history.length) * 100)}% on-time` : "No history yet"}
            </span>
          </div>
        </td>

        {/* status */}
        <td className="whitespace-nowrap px-3 py-3">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ring-1",
              meta.chip,
            )}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
            {meta.label}
          </span>
        </td>
      </tr>

      {/* tenant sub-detail */}
      <tr>
        <td colSpan={8} className="p-0">
          <div
            className={cn(
              "grid overflow-hidden bg-canvas/80 transition-[grid-template-rows,opacity] duration-400 ease-in-out",
              open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
            )}
          >
            <div className="overflow-hidden">
              <div className="grid gap-2 px-4 py-3 sm:grid-cols-2 lg:grid-cols-3">
                {unit.tenants.map((t) => (
                  <div
                    key={t.name}
                    className="flex items-center gap-3 rounded-xl border border-hairline bg-surface px-3 py-2.5 shadow-sm"
                  >
                    <Avatar name={t.name} size={34} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink">{t.name}</p>
                      <p className="text-[11px] text-ink-3">
                        {t.role} · since {t.since}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "rounded-lg px-2 py-1 text-[10px] font-bold uppercase tracking-wide",
                        unit.balance > 0 ? "bg-brick-50 dark:bg-brick-400/10 text-brick-600 dark:text-brick-400" : "bg-sage-50 dark:bg-sage-400/10 text-sage-600 dark:text-sage-400",
                      )}
                    >
                      {unit.tenants.length > 0
                        ? currency(Math.round(unit.balance / unit.tenants.length))
                        : "$0"}
                    </span>
                  </div>
                ))}
                {unit.tenants.length === 0 && (
                  <div className="flex items-center gap-3 rounded-xl border border-dashed border-hairline-strong bg-surface px-3 py-2.5">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-2 text-ink-3">
                      <Bed className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-ink-2">No active lease</p>
                      <p className="text-[11px] text-ink-3">Unit is vacant — marketing in progress</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </td>
      </tr>
    </>
  );
}

export default function PropertyDetail({ property, onEdit }: { property: Property; onEdit?: () => void }) {
  const occupied = propertyOccupied(property);
  const rate = propertyCollectionRate(property);
  const rentRoll = propertyRentRoll(property);
  const balance = property.units.reduce((s, u) => s + u.balance, 0);
  const tenants = propertyTenants(property);
  const risk = property.units.filter((u) => u.status === "delinquent").length;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-mint-100 dark:border-mint-400/20 bg-surface-2/60 p-4 ">
      {/* decorative grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "linear-gradient(to right, var(--grid-line) 1px, transparent 1px), linear-gradient(to bottom, var(--grid-line) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
        }}
      />
      <div className="relative">
        {/* panel header */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-mint-500 to-mint-600 text-gry-950 shadow-none">
              <Users className="h-4.5 w-4.5" />
            </span>
            <div>
              <h4 className="text-sm font-bold text-ink">Unit-level ledger</h4>
              <p className="text-[11px] text-ink-2">
                {property.units.length} units · {tenants} residents · updated 4 min ago
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onEdit && (
              <button
                type="button"
                onClick={onEdit}
                className="inline-flex items-center gap-1.5 rounded-lg bg-surface px-3 py-1.5 text-xs font-semibold text-ink-2 ring-1 ring-hairline transition hover:bg-surface-2/70 hover:text-mint-600 dark:hover:text-mint-300"
              >
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                </svg>
                Edit property
              </button>
            )}
            <button className="inline-flex items-center gap-1.5 rounded-lg bg-surface px-3 py-1.5 text-xs font-semibold text-ink-2 ring-1 ring-hairline transition hover:bg-surface-2/70 hover:text-mint-600 dark:hover:text-mint-300 dark:text-mint-300">
              <Send className="h-3.5 w-3.5" /> Remind all
            </button>
            <button className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-mint-600 to-mint-600 px-3 py-1.5 text-xs font-semibold text-gry-950 shadow-md shadow-none transition hover:brightness-110">
              <Check className="h-3.5 w-3.5" /> Post payments
            </button>
          </div>
        </div>

        {/* analytics row */}
        <div className="mb-4 grid gap-3 lg:grid-cols-[1.35fr_1fr]">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatTile
              icon={<Users className="h-4 w-4" />}
              label="Occupancy"
              value={`${occupied}/${property.units.length}`}
              sub={`${Math.round((occupied / property.units.length) * 100)}% leased`}
              tone="indigo"
            />
            <StatTile
              icon={<Calendar className="h-4 w-4" />}
              label="Monthly rent roll"
              value={currency(rentRoll)}
              sub="gross potential"
              tone="emerald"
            />
            <StatTile
              icon={<Alert className="h-4 w-4" />}
              label="Units at risk"
              value={String(risk)}
              sub={risk ? "legal escalation advised" : "portfolio healthy"}
              tone="rose"
            />
            <StatTile
              icon={<Ruler className="h-4 w-4" />}
              label="Avg sq ft"
              value={Math.round(
                property.units.reduce((s, u) => s + u.sqft, 0) / property.units.length,
              ).toLocaleString()}
              sub={`built ${property.yearBuilt}`}
            />
            <StatTile
              icon={<Bed className="h-4 w-4" />}
              label="Avg rent"
              value={currency(Math.round(rentRoll / property.units.length))}
              sub="per unit"
            />
            <StatTile
              icon={<Check className="h-4 w-4" />}
              label="On-time rate"
              value={`${Math.round(rate * 100)}%`}
              sub="trailing 12 months"
              tone={rate > 0.85 ? "emerald" : "rose"}
            />
          </div>

          <div className="flex flex-col gap-3 rounded-xl border border-hairline/80 bg-surface/85 p-3 shadow-sm sm:flex-row sm:items-center">
            <div className="flex flex-col items-center gap-1">
              <Donut
                value={rate}
                size={104}
                thickness={11}
                tone={rate > 0.85 ? "emerald" : rate > 0.7 ? "amber" : "rose"}
                sublabel="collected"
              />
              <div className="flex items-center gap-3 text-[10px] font-semibold text-ink-2">
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-sage-500" /> On time
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-sand-400" /> Late
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-brick-500" /> Missed
                </span>
              </div>
            </div>
            <div className="flex-1 border-t border-hairline-2 pt-3 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-ink-3">
                Outstanding balance trend
              </p>
              <p className="mt-0.5 text-xl font-bold tabular-nums text-ink">
                {currency(balance)}
              </p>
              <Sparkline
                data={property.trend}
                width={200}
                height={54}
                className="mt-2 w-full"
                stroke={balance > rentRoll * 0.5 ? "#f3907f" : "#5ecba2"}
                fillFrom={balance > rentRoll * 0.5 ? "rgba(196,105,93,.28)" : "rgba(212,164,55,.24)"}
              />
              <div className="mt-1 flex justify-between text-[9px] font-medium text-ink-3">
                <span>12 mo ago</span>
                <span>today</span>
              </div>
            </div>
          </div>
        </div>

        {/* manager strip */}
        <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-hairline/80 bg-surface/80 px-4 py-3 shadow-sm">
          <Avatar name={property.manager} size={36} />
          <div className="min-w-0">
            <p className="text-sm font-bold text-ink">{property.manager}</p>
            <p className="text-[11px] text-ink-3">Regional property manager · since {property.acquired}</p>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-medium text-ink-2">
            <span className="inline-flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5 text-mint-400" /> {property.managerPhone}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5 text-mint-400" /> {property.managerEmail}
            </span>
          </div>
        </div>

        {/* units table */}
        <div className="overflow-hidden rounded-xl border border-hairline bg-surface shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-left">
              <thead>
                <tr className="bg-gradient-to-r from-surface-2 to-canvas text-[10px] font-bold uppercase tracking-wider text-ink-2">
                  <th className="px-3 py-2.5">Unit #</th>
                  <th className="px-3 py-2.5">Occupants</th>
                  <th className="px-3 py-2.5">Lease ends</th>
                  <th className="px-3 py-2.5 text-right">Rent</th>
                  <th className="px-3 py-2.5 text-right">Balance owed</th>
                  <th className="px-3 py-2.5">Due</th>
                  <th className="px-3 py-2.5 text-center">12-mo pay history</th>
                  <th className="px-3 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody>
                {property.units.map((u, i) => (
                  <UnitRow key={u.unit} unit={u} index={i} />
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-hairline bg-canvas/80 text-xs font-bold text-ink">
                  <td className="px-3 py-2.5" colSpan={3}>
                    {property.units.length} units total
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{currency(rentRoll)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-brick-600 dark:text-brick-400">{currency(balance)}</td>
                  <td colSpan={3} className="px-3 py-2.5 text-right text-[11px] font-semibold text-ink-3">
                    {balance === 0
                      ? "100% collected"
                      : `${Math.round((1 - balance / (rentRoll + balance)) * 100)}% collected this cycle`}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
