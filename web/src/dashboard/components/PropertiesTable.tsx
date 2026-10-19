import { Fragment, useEffect, useMemo, useState } from "react";
import { cn } from "@/utils/cn";
import {
  CHANNEL_META,
  PROPERTY_TYPES,
  SEGMENT_META,
  type PerfStatus,
  type PropertyPerformance,
  type PropertyType,
} from "@/lib/data";
import { moneyFull, numberFull, pct } from "@/lib/format";
import { Icon } from "./Icon";
import { Card, Delta, EmptyState } from "./ui";

type SortKey = "name" | "units" | "occupancy" | "adr" | "bookings" | "revenue" | "delta";
type SortDir = "asc" | "desc";
type StatusFilter = "All" | PerfStatus;
const PAGE_SIZE = 6;

const STATUS_STYLES: Record<PerfStatus, { dot: string; className: string }> = {
  Excellent: { dot: "bg-positive", className: "bg-positive-soft text-positive" },
  "On track": { dot: "bg-[var(--c4)]", className: "bg-surface-3 text-ink-2" },
  Attention: { dot: "bg-amber", className: "bg-amber-soft text-amber" },
};

function StatusPill({ status }: { status: PerfStatus }) {
  const style = STATUS_STYLES[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-semibold leading-none",
        style.className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", style.dot)} />
      {status}
    </span>
  );
}

function SortButton({
  label,
  column,
  sortKey,
  sortDir,
  onSort,
  align = "left",
}: {
  label: string;
  column: SortKey;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (column: SortKey) => void;
  align?: "left" | "right";
}) {
  const active = sortKey === column;
  return (
    <button
      type="button"
      onClick={() => onSort(column)}
      className={cn(
        "group inline-flex items-center gap-1 whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.07em] transition-colors",
        align === "right" && "flex-row-reverse",
        active ? "text-ink" : "text-muted hover:text-ink-2"
      )}
    >
      {label}
      <span className="flex flex-col leading-none">
        <Icon
          name="chevronUp"
          size={9}
          strokeWidth={2.4}
          className={cn(
            "-mb-[3px]",
            active && sortDir === "asc" ? "text-brand" : "text-line-soft group-hover:text-muted dark:text-[#2e3a31]"
          )}
        />
        <Icon
          name="chevronDown"
          size={9}
          strokeWidth={2.4}
          className={active && sortDir === "desc" ? "text-brand" : "text-line-soft group-hover:text-muted dark:text-[#2e3a31]"}
        />
      </span>
    </button>
  );
}

export function PropertiesTable({
  rows,
  search,
  onSearchChange,
  onExport,
  onShowToast,
}: {
  rows: PropertyPerformance[];
  search: string;
  onSearchChange: (value: string) => void;
  onExport: () => void;
  onShowToast: (message: string) => void;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("revenue");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [typeFilter, setTypeFilter] = useState<"All" | PropertyType>("All");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows
      .filter((row) => {
        if (typeFilter !== "All" && row.property.type !== typeFilter) return false;
        if (statusFilter !== "All" && row.status !== statusFilter) return false;
        if (!query) return true;
        const haystack = `${row.property.name} ${row.property.city} ${row.property.state} ${row.property.type} ${row.property.segment}`.toLowerCase();
        return haystack.includes(query);
      })
      .sort((a, b) => {
        let compare = 0;
        switch (sortKey) {
          case "name":
            compare = a.property.name.localeCompare(b.property.name);
            break;
          case "units":
            compare = a.property.units - b.property.units;
            break;
          case "occupancy":
            compare = a.occupancy - b.occupancy;
            break;
          case "adr":
            compare = a.adr - b.adr;
            break;
          case "bookings":
            compare = a.bookings - b.bookings;
            break;
          case "delta":
            compare = a.delta - b.delta;
            break;
          case "revenue":
          default:
            compare = a.revenue - b.revenue;
            break;
        }
        return sortDir === "asc" ? compare : -compare;
      });
  }, [rows, search, typeFilter, statusFilter, sortKey, sortDir]);

  useEffect(() => {
    setPage(1);
  }, [search, typeFilter, statusFilter, sortKey, sortDir]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const visible = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const start = filtered.length ? (safePage - 1) * PAGE_SIZE + 1 : 0;
  const end = Math.min(filtered.length, safePage * PAGE_SIZE);

  const handleSort = (column: SortKey) => {
    if (column === sortKey) {
      setSortDir((direction) => (direction === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(column);
      setSortDir(column === "name" ? "asc" : "desc");
    }
  };

  const hasFilters = Boolean(search) || typeFilter !== "All" || statusFilter !== "All";
  const clearFilters = () => {
    onSearchChange("");
    setTypeFilter("All");
    setStatusFilter("All");
  };

  return (
    <Card id="properties" className="fade-rise overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-line p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-display text-[16px] font-semibold text-ink">Property performance</h2>
            <span className="rounded-full bg-surface-3 px-1.5 py-0.5 text-[9.5px] font-semibold text-muted tnum">
              {filtered.length}/{rows.length}
            </span>
          </div>
          <p className="mt-0.5 text-[11.5px] text-muted">
            Every property, benchmarked against the previous period.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-1 sm:flex-none">
            <Icon
              name="search"
              size={13}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted"
            />
            <input
              type="search"
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Search properties…"
              aria-label="Search property performance"
              className="h-8 w-full rounded-lg border border-line bg-surface-2 pl-7.5 pr-7 text-[11.5px] text-ink outline-none transition-all placeholder:text-muted focus:border-brand focus:bg-surface sm:w-[186px]"
              style={{ paddingLeft: 28 }}
            />
            {search && (
              <button
                type="button"
                onClick={() => onSearchChange("")}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
              >
                <Icon name="x" size={11} />
              </button>
            )}
          </div>
          <div className="relative">
            <select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value as "All" | PropertyType)}
              aria-label="Filter by property type"
              className="h-8 appearance-none rounded-lg border border-line bg-surface-2 pl-2.5 pr-7 text-[11.5px] font-medium text-ink-2 outline-none transition hover:text-ink focus:border-brand"
            >
              <option value="All">All types</option>
              {PROPERTY_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
            <Icon
              name="chevronDown"
              size={12}
              className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted"
            />
          </div>
          <div className="relative lg:hidden">
            <select
              value={`${sortKey}:${sortDir}`}
              onChange={(event) => {
                const [nextKey, nextDir] = event.target.value.split(":") as [SortKey, SortDir];
                setSortKey(nextKey);
                setSortDir(nextDir);
              }}
              aria-label="Sort properties"
              className="h-8 appearance-none rounded-lg border border-line bg-surface-2 pl-2.5 pr-7 text-[11.5px] font-medium text-ink-2 outline-none focus:border-brand"
            >
              <option value="revenue:desc">Top revenue</option>
              <option value="delta:desc">Biggest gain</option>
              <option value="occupancy:desc">Highest occupancy</option>
              <option value="adr:desc">Highest ADR</option>
              <option value="bookings:desc">Most bookings</option>
              <option value="name:asc">Name A–Z</option>
            </select>
            <Icon
              name="chevronDown"
              size={12}
              className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted"
            />
          </div>
          <button
            type="button"
            onClick={onExport}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 text-[11.5px] font-semibold text-ink transition-colors hover:bg-surface-2"
          >
            <Icon name="download" size={13} className="text-muted" />
            Export
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 border-b border-line bg-surface-2/60 px-4 py-2.5 sm:px-5">
        {(["All", "Excellent", "On track", "Attention"] as StatusFilter[]).map((status) => {
          const selected = statusFilter === status;
          const count =
            status === "All" ? rows.length : rows.filter((row) => row.status === status).length;
          return (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              aria-pressed={selected}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10.5px] font-medium transition-colors duration-200",
                selected
                  ? "border-brand bg-brand text-white dark:text-[#07130d]"
                  : "border-line bg-surface text-muted hover:border-[var(--muted)] hover:text-ink"
              )}
            >
              {status !== "All" && (
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    selected ? "bg-current opacity-80" : STATUS_STYLES[status].dot
                  )}
                />
              )}
              {status}
              <span className={cn("tnum", selected ? "opacity-70" : "text-muted/70")}>{count}</span>
            </button>
          );
        })}
        <div className="ml-auto flex items-center gap-2">
          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-brand hover:underline"
            >
              <Icon name="x" size={10} strokeWidth={2.4} />
              Clear filters
            </button>
          )}
          <span className="hidden text-[10.5px] text-muted sm:inline">Click a row for detail</span>
        </div>
      </div>

      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full min-w-[880px] border-collapse text-left">
          <thead>
            <tr className="border-b border-line bg-surface">
              <th scope="col" className="py-2.5 pl-4 pr-2 sm:pl-5">
                <SortButton label="Property" column="name" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              </th>
              <th scope="col" className="px-2 py-2.5 text-right">
                <span className="inline-flex justify-end">
                  <SortButton label="Units" column="units" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} align="right" />
                </span>
              </th>
              <th scope="col" className="px-2 py-2.5">
                <SortButton label="Occupancy" column="occupancy" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              </th>
              <th scope="col" className="px-2 py-2.5 text-right">
                <SortButton label="ADR" column="adr" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} align="right" />
              </th>
              <th scope="col" className="px-2 py-2.5 text-right">
                <SortButton label="Bookings" column="bookings" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} align="right" />
              </th>
              <th scope="col" className="px-2 py-2.5 text-right">
                <SortButton label="Revenue" column="revenue" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} align="right" />
              </th>
              <th scope="col" className="px-2 py-2.5">
                <SortButton label="vs. prior" column="delta" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              </th>
              <th scope="col" className="py-2.5 pl-1 pr-4 sm:pr-5">
                <span className="sr-only">Details</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => {
              const isOpen = expanded === row.property.id;
              const segmentColor = SEGMENT_META[row.property.segment].color;
              const topChannel = CHANNEL_META.reduce((best, channel) =>
                row.property.channels[channel.key] > row.property.channels[best.key] ? channel : best
              );
              return (
                <Fragment key={row.property.id}>
                  <tr
                    className={cn(
                      "cursor-pointer border-b border-line-soft transition-colors duration-150",
                      isOpen ? "bg-surface-2" : "hover:bg-surface-2/70"
                    )}
                    onClick={() => setExpanded(isOpen ? null : row.property.id)}
                  >
                    <td className="py-2.5 pl-4 pr-2 sm:pl-5">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold"
                          style={{
                            color: segmentColor,
                            background: "var(--surface-3)",
                          }}
                        >
                          {row.property.name
                            .replace(/^The\s+/i, "")
                            .split(" ")
                            .slice(0, 2)
                            .map((word) => word[0])
                            .join("")}
                        </span>
                        <span className="min-w-0">
                          <span className="flex items-center gap-1.5">
                            <span className="truncate text-[12.5px] font-semibold text-ink">{row.property.name}</span>
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: segmentColor }} />
                          </span>
                          <span className="mt-0.5 block truncate text-[10px] text-muted">
                            {row.property.city}, {row.property.state} · {row.property.type}
                          </span>
                        </span>
                      </div>
                    </td>
                    <td className="px-2 py-2.5 text-right text-[11.5px] text-ink-2 tnum">{row.property.units}</td>
                    <td className="px-2 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-surface-3 sm:block">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${Math.min(100, row.occupancy * 100)}%`,
                              background: segmentColor,
                            }}
                          />
                        </div>
                        <span className="text-[11.5px] font-medium text-ink tnum">{pct(row.occupancy)}</span>
                      </div>
                    </td>
                    <td className="px-2 py-2.5 text-right text-[11.5px] text-ink-2 tnum">{moneyFull(row.adr)}</td>
                    <td className="px-2 py-2.5 text-right text-[11.5px] text-ink-2 tnum">{numberFull(row.bookings)}</td>
                    <td className="px-2 py-2.5 text-right text-[12px] font-semibold text-ink tnum">
                      {moneyFull(row.revenue)}
                    </td>
                    <td className="px-2 py-2.5">
                      <div className="flex flex-col items-start gap-1">
                        <Delta value={row.prevRevenue ? row.delta : null} compact />
                        <StatusPill status={row.status} />
                      </div>
                    </td>
                    <td className="py-2.5 pl-1 pr-4 text-right sm:pr-5">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setExpanded(isOpen ? null : row.property.id);
                        }}
                        aria-expanded={isOpen}
                        aria-label={`${isOpen ? "Hide" : "Show"} details for ${row.property.name}`}
                        className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted transition hover:bg-surface-3 hover:text-ink"
                      >
                        <Icon
                          name="chevronDown"
                          size={13}
                          className={cn("transition-transform duration-200", isOpen && "rotate-180")}
                        />
                      </button>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="border-b border-line-soft bg-surface-2">
                      <td colSpan={8} className="px-4 pb-4 pt-1 sm:px-5">
                        <div className="fade-rise grid grid-cols-2 gap-3 rounded-xl border border-line bg-surface p-3.5 md:grid-cols-4">
                          <div>
                            <p className="text-[9.5px] font-semibold uppercase tracking-[0.08em] text-muted">Nights sold</p>
                            <p className="mt-1 text-[14px] font-semibold text-ink tnum">{numberFull(row.nights)}</p>
                          </div>
                          <div>
                            <p className="text-[9.5px] font-semibold uppercase tracking-[0.08em] text-muted">Avg. booking value</p>
                            <p className="mt-1 text-[14px] font-semibold text-ink tnum">
                              {moneyFull(row.bookings ? row.revenue / row.bookings : 0)}
                            </p>
                          </div>
                          <div>
                            <p className="text-[9.5px] font-semibold uppercase tracking-[0.08em] text-muted">Top channel</p>
                            <p className="mt-1 flex items-center gap-1.5 text-[12px] font-semibold text-ink">
                              <span className="h-1.5 w-1.5 rounded-full" style={{ background: topChannel.color }} />
                              {topChannel.label} · {pct(row.property.channels[topChannel.key], 0)}
                            </p>
                          </div>
                          <div>
                            <p className="text-[9.5px] font-semibold uppercase tracking-[0.08em] text-muted">Guest rating</p>
                            <p className="mt-1 flex items-center gap-1 text-[12px] font-semibold text-ink">
                              <Icon name="star" size={12} className="text-amber" />
                              {row.property.rating.toFixed(2)}
                              <span className="font-normal text-muted tnum">({row.property.reviews})</span>
                            </p>
                          </div>
                          <div className="col-span-2 md:col-span-3">
                            <p className="text-[9.5px] font-semibold uppercase tracking-[0.08em] text-muted">Occupancy vs. prior</p>
                            <div className="mt-2 flex items-center gap-3">
                              <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-surface-3">
                                <div
                                  className="absolute inset-y-0 left-0 rounded-full opacity-40"
                                  style={{ width: `${Math.min(100, row.prevOccupancy * 100)}%`, background: "var(--muted)" }}
                                />
                                <div
                                  className="absolute inset-y-0 left-0 rounded-full"
                                  style={{ width: `${Math.min(100, row.occupancy * 100)}%`, background: segmentColor }}
                                />
                              </div>
                              <span className="text-[10.5px] text-muted tnum">
                                {pct(row.prevOccupancy)} → <span className="font-semibold text-ink">{pct(row.occupancy)}</span>
                              </span>
                            </div>
                          </div>
                          <div className="flex items-end justify-end">
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                onShowToast(`Opening ${row.property.name} — property workspace`);
                              }}
                              className="inline-flex h-7 items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 text-[10.5px] font-semibold text-ink transition hover:bg-surface-2"
                            >
                              View property
                              <Icon name="arrowUpRight" size={11} />
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {!visible.length && (
              <tr>
                <td colSpan={8}>
                  <EmptyState
                    title="No properties match these filters"
                    description="Try adjusting the search, property type or status filters. Your date range and portfolio selection still apply."
                    action={
                      <button
                        type="button"
                        onClick={clearFilters}
                        className="rounded-lg bg-brand px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-brand-strong dark:text-[#07130d]"
                      >
                        Clear all filters
                      </button>
                    }
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="divide-y divide-line-soft lg:hidden">
        {visible.map((row, index) => {
          const isOpen = expanded === row.property.id;
          const segmentColor = SEGMENT_META[row.property.segment].color;
          return (
            <div key={row.property.id} className={cn("transition-colors", isOpen && "bg-surface-2")}>
              <div className="flex items-start gap-2.5 p-4">
                <span className="mt-0.5 w-4 shrink-0 text-[10px] font-semibold text-muted tnum">
                  {String((safePage - 1) * PAGE_SIZE + index + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-[12.5px] font-semibold text-ink">{row.property.name}</p>
                      <p className="mt-0.5 truncate text-[10px] text-muted">
                        {row.property.city}, {row.property.state} · {row.property.type} · {row.property.units} units
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <Delta value={row.prevRevenue ? row.delta : null} compact />
                      <button
                        type="button"
                        onClick={() => setExpanded(isOpen ? null : row.property.id)}
                        aria-expanded={isOpen}
                        aria-label={`${isOpen ? "Hide" : "Show"} details for ${row.property.name}`}
                        className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-line bg-surface text-muted transition hover:text-ink"
                      >
                        <Icon
                          name="chevronDown"
                          size={12}
                          className={cn("transition-transform duration-200", isOpen && "rotate-180")}
                        />
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <div>
                      <p className="text-[9px] font-semibold uppercase tracking-[0.07em] text-muted">Occupancy</p>
                      <p className="mt-0.5 text-[12.5px] font-semibold text-ink tnum">{pct(row.occupancy)}</p>
                      <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-surface-3">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(100, row.occupancy * 100)}%`, background: segmentColor }}
                        />
                      </div>
                    </div>
                    <div>
                      <p className="text-[9px] font-semibold uppercase tracking-[0.07em] text-muted">ADR</p>
                      <p className="mt-0.5 text-[12.5px] font-semibold text-ink tnum">{moneyFull(row.adr)}</p>
                      <p className="mt-1 text-[9.5px] text-muted tnum">{numberFull(row.bookings)} bkgs</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] font-semibold uppercase tracking-[0.07em] text-muted">Revenue</p>
                      <p className="mt-0.5 text-[12.5px] font-semibold text-ink tnum">{moneyFull(row.revenue)}</p>
                      <div className="mt-1 flex justify-end">
                        <StatusPill status={row.status} />
                      </div>
                    </div>
                  </div>

                  <div className="mt-2 flex items-center gap-1.5 border-t border-line-soft pt-2 text-[10px] text-muted">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: segmentColor }} />
                    {row.property.segment}
                    <span className="text-line">·</span>
                    <Icon name="star" size={10} className="text-amber" />
                    {row.property.rating.toFixed(2)}
                    <button
                      type="button"
                      onClick={() => onShowToast(`Opening ${row.property.name} — property workspace`)}
                      className="ml-auto inline-flex items-center gap-1 font-semibold text-brand"
                    >
                      Details
                      <Icon name="arrowUpRight" size={10} />
                    </button>
                  </div>
                </div>
              </div>

              {isOpen && (
                <div className="fade-rise border-t border-line-soft px-4 py-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[9px] font-semibold uppercase tracking-[0.07em] text-muted">Nights sold</p>
                      <p className="mt-0.5 text-[12.5px] font-semibold text-ink tnum">{numberFull(row.nights)}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-semibold uppercase tracking-[0.07em] text-muted">Avg. booking</p>
                      <p className="mt-0.5 text-[12.5px] font-semibold text-ink tnum">
                        {moneyFull(row.bookings ? row.revenue / row.bookings : 0)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[9px] font-semibold uppercase tracking-[0.07em] text-muted">Prior occupancy</p>
                      <p className="mt-0.5 text-[12.5px] font-semibold text-ink tnum">{pct(row.prevOccupancy)}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-semibold uppercase tracking-[0.07em] text-muted">Reviews</p>
                      <p className="mt-0.5 text-[12.5px] font-semibold text-ink tnum">{numberFull(row.property.reviews)}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onShowToast(`Opening ${row.property.name} — property workspace`)}
                    className="mt-3 inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border border-line bg-surface text-[11px] font-semibold text-ink"
                  >
                    View property
                    <Icon name="arrowUpRight" size={11} />
                  </button>
                </div>
              )}
            </div>
          );
        })}
        {!visible.length && (
          <EmptyState
            title="No properties match these filters"
            description="Try adjusting the search, property type or status filters."
            action={
              <button
                type="button"
                onClick={clearFilters}
                className="rounded-lg bg-brand px-3 py-1.5 text-[11px] font-semibold text-white dark:text-[#07130d]"
              >
                Clear all filters
              </button>
            }
          />
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 sm:px-5">
        <p className="text-[10.5px] text-muted tnum">
          Showing <span className="font-semibold text-ink-2">{start}–{end}</span> of{" "}
          <span className="font-semibold text-ink-2">{filtered.length}</span> properties
        </p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setPage(Math.max(1, safePage - 1))}
            disabled={safePage === 1}
            aria-label="Previous page"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-line bg-surface text-muted transition hover:bg-surface-2 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Icon name="chevronLeft" size={13} />
          </button>
          {Array.from({ length: pageCount }, (_, index) => index + 1).map((pageNumber) => (
            <button
              key={pageNumber}
              type="button"
              onClick={() => setPage(pageNumber)}
              aria-current={safePage === pageNumber ? "page" : undefined}
              className={cn(
                "inline-flex h-7 min-w-7 items-center justify-center rounded-md border px-1.5 text-[10.5px] font-semibold transition",
                safePage === pageNumber
                  ? "border-brand bg-brand text-white dark:text-[#07130d]"
                  : "border-line bg-surface text-muted hover:bg-surface-2 hover:text-ink"
              )}
            >
              {pageNumber}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setPage(Math.min(pageCount, safePage + 1))}
            disabled={safePage === pageCount}
            aria-label="Next page"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-line bg-surface text-muted transition hover:bg-surface-2 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Icon name="chevronRight" size={13} />
          </button>
        </div>
      </div>
    </Card>
  );
}
