import { Fragment } from "react";
import {
  currency,
  propertyAtRisk,
  propertyBalance,
  propertyOccupied,
  propertyRentRoll,
  severityOf,
  type Property,
} from "../data/properties";
import { Bar, Collapse, Sparkline } from "./charts";
import PropertyDetail from "./PropertyDetail";
import RowMenu from "./RowMenu";
import { Building, ChevronsDown, ChevronsUp, Pin, Users } from "./icons";
import { cn } from "../utils/cn";

export const PencilIcon = () => (
  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </svg>
);

export type SortKey = "code" | "name" | "units" | "balance";

const thumbGrads = [
  "from-gry-700 to-gry-800",
  "from-gry-600 to-gry-700",
  "from-gry-700 to-gry-800",
  "from-gry-600 to-gry-700",
];

const gradFor = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 17 + s.charCodeAt(i)) % 9973;
  return thumbGrads[h % thumbGrads.length];
};

function SortHeader({
  label,
  k,
  sort,
  dir,
  onSort,
  className,
}: {
  label: string;
  k: SortKey;
  sort: SortKey;
  dir: "asc" | "desc";
  onSort: (k: SortKey) => void;
  className?: string;
}) {
  const active = sort === k;
  return (
    <th className={cn("px-3 py-3", className)}>
      <button
        onClick={() => onSort(k)}
        className={cn(
          "group inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.08em] transition",
          active ? "text-mint-600 dark:text-mint-300" : "text-ink-2 hover:text-ink",
          className,
        )}
      >
        {label}
        <span className={cn("transition", active ? "opacity-100" : "opacity-0 group-hover:opacity-40")}>
          {dir === "asc" ? (
            <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
              <path d="m6 15 6-6 6 6" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
              <path d="m6 9 6 6 6-6" />
            </svg>
          )}
        </span>
      </button>
    </th>
  );
}

export default function PropertyTable({
  rows,
  expanded,
  toggle,
  selected,
  toggleSelect,
  sort,
  dir,
  onSort,
  onEdit,
}: {
  rows: Property[];
  expanded: Set<string>;
  toggle: (id: string) => void;
  selected: Set<string>;
  toggleSelect: (id: string) => void;
  sort: SortKey;
  dir: "asc" | "desc";
  onSort: (k: SortKey) => void;
  onEdit?: (p: Property) => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-hairline bg-surface shadow-[0_1px_2px_rgba(15,23,42,.04),0_12px_32px_-12px_rgba(15,23,42,.12)] dark:border-white/10 dark:shadow-[0_1px_2px_rgba(0,0,0,.5),0_18px_44px_-16px_rgba(0,0,0,.9)]">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1000px] border-collapse text-left">
          <thead>
            <tr className="relative border-b border-hairline bg-surface-2">
              <th className="w-10 px-3 py-3.5" />
              <th className="w-10 px-2 py-3.5" />
              <SortHeader label="Property ID" k="code" sort={sort} dir={dir} onSort={onSort} />
              <SortHeader label="Property name" k="name" sort={sort} dir={dir} onSort={onSort} />
              <th className="px-3 py-3.5 text-[10px] font-bold uppercase tracking-[0.08em] text-ink-2">
                Address
              </th>
              <SortHeader
                label="Units"
                k="units"
                sort={sort}
                dir={dir}
                onSort={onSort}
                className="text-center [&]:text-center"
              />
              <SortHeader
                label="Current balance"
                k="balance"
                sort={sort}
                dir={dir}
                onSort={onSort}
                className="text-right [&]:justify-end [&]:text-right"
              />
              <th className="w-24 px-3 py-3.5"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>

          <tbody className="divide-y divide-hairline-2">
            {rows.map((p, idx) => {
              const isOpen = expanded.has(p.code);
              const isSel = selected.has(p.code);
              const bal = propertyBalance(p);
              const rent = propertyRentRoll(p);
              const occ = propertyOccupied(p);
              const risk = propertyAtRisk(p);
              const sev = severityOf(bal, rent);
              const prev = p.trend[p.trend.length - 2] ?? bal;
              const delta = bal - prev;
              const rising = delta > 0;

              return (
                <Fragment key={p.code}>
                  {/* ---------- MASTER ROW ---------- */}
                  <tr
                    key={p.code}
                    onClick={() => toggle(p.code)}
                    className={cn(
                      "group cursor-pointer align-middle transition-colors",
                      isOpen ? "bg-mint-50 dark:bg-mint-400/10/60 dark:bg-mint-400/10" : "hover:bg-surface-2/70",
                      isSel && "bg-gry-50 dark:bg-gry-400/10/70 dark:bg-gry-400/10",
                      sev === "bad" && !isOpen && "bg-brick-50 dark:bg-brick-400/10/25 dark:bg-brick-400/[0.07]",
                    )}
                  >
                    {/* expander */}
                    <td className="relative px-3 py-3">
                      {isOpen && (
                        <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r bg-gradient-to-b from-mint-500 to-mint-500" />
                      )}
                      <span
                        className={cn(
                          "flex h-8 w-8 items-center justify-center rounded-lg border transition-all duration-300",
                          isOpen
                            ? "rotate-45 border-mint-500 dark:border-mint-400 bg-gradient-to-br from-mint-500 to-mint-600 text-gry-950 shadow-none"
                            : "border-hairline bg-surface text-ink-3 group-hover:border-mint-300 dark:hover:border-mint-400/40 group-hover:text-mint-600 dark:hover:text-mint-300 dark:text-mint-300",
                        )}
                      >
                        <svg
                          viewBox="0 0 24 24"
                          className="h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2.6}
                          strokeLinecap="round"
                        >
                          <path d="M12 5v14M5 12h14" />
                        </svg>
                      </span>
                    </td>

                    {/* checkbox */}
                    <td className="px-2 py-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSelect(p.code);
                        }}
                        className={cn(
                          "flex h-4.5 w-4.5 items-center justify-center rounded border transition",
                          isSel
                            ? "border-mint-600 dark:border-mint-400 bg-mint-600 text-gry-950"
                            : "border-hairline-strong bg-surface hover:border-mint-400",
                        )}
                        aria-label={`Select ${p.name}`}
                      >
                        {isSel && (
                          <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round">
                            <path d="m20 6-11 11-5-5" />
                          </svg>
                        )}
                      </button>
                    </td>

                    {/* id */}
                    <td className="whitespace-nowrap px-3 py-3">
                      <span className="rounded-md bg-surface-2 px-2 py-1 font-mono text-[11px] font-bold text-ink-2 group-hover:bg-mint-100 dark:hover:bg-mint-400/15 dark:hover:bg-mint-400/15 group-hover:text-mint-700 dark:hover:text-mint-300 dark:text-mint-300">
                        {p.code}
                      </span>
                    </td>

                    {/* name */}
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-3">
                        <span
                          className={cn(
                            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-md ring-2 ring-surface",
                            gradFor(p.name),
                          )}
                        >
                          <Building className="h-5 w-5" />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-ink group-hover:text-mint-700 dark:hover:text-mint-300 dark:text-mint-300">
                            {p.name}
                          </p>
                          <div className="mt-0.5 flex items-center gap-1.5">
                            <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-ink-2">
                              {p.type}
                            </span>
                            {risk > 0 && (
                              <span className="inline-flex items-center gap-1 rounded bg-brick-100 dark:bg-brick-400/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-brick-600 dark:text-brick-400">
                                <span className="h-1 w-1 animate-pulse rounded-full bg-brick-500" />
                                {risk} at risk
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* address */}
                    <td className="px-3 py-3">
                      <div className="flex items-start gap-2">
                        <Pin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-3" />
                        <div>
                          <p className="text-[13px] font-medium leading-tight text-ink">{p.address1}</p>
                          <p className="text-[11px] text-ink-3">
                            {p.city}, {p.state} {p.zip}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* units */}
                    <td className="px-3 py-3">
                      <div className="flex flex-col items-center gap-1">
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-ink">
                          <Users className="h-3.5 w-3.5 text-ink-3" />
                          {occ}/{p.units.length}
                        </span>
                        <div className="w-16">
                          <Bar
                            value={occ / p.units.length}
                            tone={occ === p.units.length ? "emerald" : "amber"}
                            delay={idx * 40}
                            height={4}
                          />
                        </div>
                      </div>
                    </td>

                    {/* balance */}
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-end gap-3">
                        <div className="flex flex-col items-end">
                          <span
                            className={cn(
                              "text-base font-extrabold tabular-nums leading-none",
                              sev === "good" && "text-sage-600 dark:text-sage-400",
                              sev === "warn" && "text-sand-600 dark:text-sand-400",
                              sev === "bad" && "text-brick-600 dark:text-brick-400",
                            )}
                          >
                            {bal === 0 ? "Paid" : currency(bal)}
                          </span>
                          <span
                            className={cn(
                              "mt-1 inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] font-bold",
                              bal === 0
                                ? "bg-sage-50 dark:bg-sage-400/10 text-sage-600 dark:text-sage-400"
                                : rising
                                  ? "bg-brick-50 dark:bg-brick-400/10 text-brick-600 dark:text-brick-400"
                                  : "bg-sage-50 dark:bg-sage-400/10 text-sage-600 dark:text-sage-400",
                            )}
                          >
                            {bal === 0 ? (
                              "no arrears"
                            ) : (
                              <>
                                {rising ? "▲" : "▼"} {currency(Math.abs(delta))} vs last mo
                              </>
                            )}
                          </span>
                        </div>
                        <Sparkline
                          data={p.trend}
                          width={78}
                          height={30}
                          strokeWidth={1.8}
                          tone={sev === "bad" ? "rose" : sev === "warn" ? "amber" : "indigo"}
                          className="hidden sm:block"
                        />
                      </div>
                    </td>

                    {/* row actions + chevron */}
                    <td className="px-3 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                      {onEdit && (
                        <RowMenu
                          label={`Actions for ${p.name}`}
                          items={[
                            { label: "Edit property", icon: <PencilIcon />, onSelect: () => onEdit(p) },
                            { label: isOpen ? "Hide unit details" : "Show unit details", icon: <ChevronsDown className="h-3.5 w-3.5" />, onSelect: () => toggle(p.code) },
                          ]}
                        />
                      )}
                      <span
                        className={cn(
                          "inline-flex text-gry-300 transition-all duration-300",
                          isOpen ? "rotate-180 text-mint-500 dark:text-mint-300" : "group-hover:text-mint-400",
                        )}
                      >
                        {isOpen ? <ChevronsUp className="h-4 w-4" /> : <ChevronsDown className="h-4 w-4" />}
                      </span>
                      </div>
                    </td>
                  </tr>

                  {/* ---------- DETAIL ROW ---------- */}
                  <tr
                    key={`${p.code}-detail`}
                    className={cn(
                      "transition-colors",
                      isOpen ? "bg-canvas/40" : "bg-transparent",
                    )}
                  >
                    <td colSpan={8} className={cn("px-3 pt-0", isOpen ? "pb-3" : "pb-0")}>
                      <Collapse open={isOpen}>
                        <div style={{ animation: isOpen ? "riseIn .45s ease-out both" : undefined }}>
                          <PropertyDetail property={p} onEdit={onEdit ? () => onEdit(p) : undefined} />
                        </div>
                      </Collapse>
                    </td>
                  </tr>
                </Fragment>
              );
            })}

            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-6 py-16 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-2 text-ink-3">
                    <Pin className="h-6 w-6" />
                  </div>
                  <p className="mt-3 text-sm font-semibold text-ink-2">No properties match your filters</p>
                  <p className="text-xs text-ink-3">Try clearing the search or switching the status filter.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
