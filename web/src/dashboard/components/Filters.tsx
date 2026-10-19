import { useState } from "react";
import { cn } from "@/utils/cn";
import {
  DATA_START,
  PROPERTIES,
  PRESET_LABEL,
  RANGE_PRESETS,
  SEGMENTS,
  SEGMENT_META,
  TODAY,
  presetRange,
  type DateRange,
  type RangePreset,
  type Segment,
} from "@/lib/data";
import { fmtDate, fmtRange } from "@/lib/format";
import { Icon } from "./Icon";
import { useDismiss } from "./ui";

const triggerClass =
  "inline-flex h-10 w-full items-center justify-between gap-2 rounded-xl border border-line bg-surface px-3 text-xs font-medium text-ink transition-all duration-200 hover:border-[var(--muted)] hover:shadow-sm sm:w-auto sm:justify-start";

export function DateRangeControl({
  preset,
  range,
  onChange,
}: {
  preset: RangePreset;
  range: DateRange;
  onChange: (preset: RangePreset, range: DateRange) => void;
}) {
  const [open, setOpen] = useState(false);
  const [customStart, setCustomStart] = useState(range.start);
  const [customEnd, setCustomEnd] = useState(range.end);
  const ref = useDismiss<HTMLDivElement>(open, () => setOpen(false));

  const applyCustom = () => {
    if (!customStart || !customEnd) return;
    if (customStart > customEnd) return;
    onChange("custom", { start: customStart, end: customEnd });
    setOpen(false);
  };

  const customValid =
    Boolean(customStart) &&
    Boolean(customEnd) &&
    customStart <= customEnd &&
    customStart >= DATA_START &&
    customEnd <= TODAY;

  return (
    <div className="relative min-w-0 flex-1 sm:flex-none" ref={ref}>
      <button
        type="button"
        onClick={() => {
          setCustomStart(range.start);
          setCustomEnd(range.end);
          setOpen((value) => !value);
        }}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={cn(triggerClass, open && "border-[var(--brand)] shadow-sm")}
      >
        <span className="flex min-w-0 items-center gap-2">
          <Icon name="calendar" size={15} className="shrink-0 text-muted" />
          <span className="truncate tnum">
            <span className="hidden sm:inline">{fmtRange(range.start, range.end)}</span>
            <span className="sm:hidden">
              {fmtDate(range.start, "short")} – {fmtDate(range.end, "short")}
            </span>
          </span>
        </span>
        <Icon
          name="chevronDown"
          size={14}
          className={cn("shrink-0 text-muted transition-transform duration-200", open && "rotate-180")}
        />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Choose a date range"
          className="pop-in fixed inset-x-3 top-[72px] z-50 max-h-[calc(100dvh-6rem)] overflow-y-auto overscroll-contain rounded-2xl border border-line bg-surface p-3 shadow-pop sm:absolute sm:inset-x-auto sm:left-0 sm:top-[calc(100%+8px)] sm:max-h-[min(560px,calc(100dvh-9rem))] sm:w-[318px]"
        >
          <div className="flex items-center justify-between px-1 pb-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">Date range</p>
            <span className="rounded-full bg-surface-3 px-2 py-0.5 text-[10px] font-medium text-muted">
              Data to Jun 30, 2026
            </span>
          </div>
          <div className="grid gap-0.5">
            {RANGE_PRESETS.map((option) => {
              const optionRange = presetRange(option.id);
              const selected = preset === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    onChange(option.id, optionRange);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left transition-colors duration-150",
                    selected ? "bg-brand-soft" : "hover:bg-surface-2"
                  )}
                >
                  <span>
                    <span
                      className={cn(
                        "block text-xs font-medium",
                        selected ? "text-brand-ink" : "text-ink"
                      )}
                    >
                      {option.label}
                    </span>
                    <span className="mt-0.5 block text-[10.5px] text-muted tnum">
                      {fmtRange(optionRange.start, optionRange.end)}
                    </span>
                  </span>
                  {selected && <Icon name="check" size={14} className="shrink-0 text-brand" />}
                </button>
              );
            })}
          </div>

          <div className="sticky bottom-0 -mx-3 -mb-3 mt-2 rounded-b-2xl border-t border-line bg-surface px-3 pb-3 pt-3 shadow-[0_-10px_18px_-18px_rgba(0,0,0,0.45)]">
            <p className="px-1 pb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
              Custom range
            </p>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="mb-1 block px-0.5 text-[10px] text-muted">Start</span>
                <input
                  type="date"
                  value={customStart}
                  min={DATA_START}
                  max={customEnd || TODAY}
                  onChange={(event) => setCustomStart(event.target.value)}
                  className="h-8 w-full rounded-lg border border-line bg-surface-2 px-2 text-[11px] text-ink outline-none transition focus:border-brand"
                />
              </label>
              <label className="block">
                <span className="mb-1 block px-0.5 text-[10px] text-muted">End</span>
                <input
                  type="date"
                  value={customEnd}
                  min={customStart || DATA_START}
                  max={TODAY}
                  onChange={(event) => setCustomEnd(event.target.value)}
                  className="h-8 w-full rounded-lg border border-line bg-surface-2 px-2 text-[11px] text-ink outline-none transition focus:border-brand"
                />
              </label>
            </div>
            <button
              type="button"
              disabled={!customValid}
              onClick={applyCustom}
              className="mt-2 h-8 w-full rounded-lg bg-brand text-[11.5px] font-semibold text-white transition hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-45 dark:text-[#07130d]"
            >
              {preset === "custom" ? "Update range" : "Apply custom range"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function SegmentControl({
  segments,
  onChange,
}: {
  segments: Segment[];
  onChange: (segments: Segment[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useDismiss<HTMLDivElement>(open, () => setOpen(false));
  const all = segments.length === SEGMENTS.length;
  const label = all ? "All portfolios" : segments.length === 1 ? segments[0] : `${segments.length} portfolios`;

  const toggle = (segment: Segment) => {
    const next = segments.includes(segment)
      ? segments.filter((value) => value !== segment)
      : [...segments, segment];
    onChange(next.length ? next : [...SEGMENTS]);
  };

  return (
    <div className="relative min-w-0 flex-1 sm:flex-none" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={cn(triggerClass, open && "border-[var(--brand)] shadow-sm")}
      >
        <span className="flex min-w-0 items-center gap-2">
          <Icon name="filter" size={14} className="shrink-0 text-muted" />
          <span className="truncate">{label}</span>
          {!all && (
            <span className="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-brand px-1 text-[9.5px] font-bold leading-none text-white dark:text-[#07130d]">
              {segments.length}
            </span>
          )}
        </span>
        <Icon
          name="chevronDown"
          size={14}
          className={cn("shrink-0 text-muted transition-transform duration-200", open && "rotate-180")}
        />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Filter by portfolio segment"
          className="pop-in absolute right-0 top-[calc(100%+8px)] z-50 w-[286px] max-w-[calc(100vw-2rem)] rounded-2xl border border-line bg-surface p-3 shadow-pop"
        >
          <div className="flex items-center justify-between px-1 pb-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">Segments</p>
            <button
              type="button"
              onClick={() => onChange([...SEGMENTS])}
              className="text-[10.5px] font-medium text-brand hover:underline"
            >
              Select all
            </button>
          </div>

          <button
            type="button"
            role="checkbox"
            aria-checked={all}
            onClick={() => onChange([...SEGMENTS])}
            className="mb-1 flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-surface-2"
          >
            <span
              className={cn(
                "flex h-4 w-4 items-center justify-center rounded-[5px] border transition-colors",
                all ? "border-brand bg-brand text-white dark:text-[#07130d]" : "border-line bg-surface"
              )}
            >
              {all && <Icon name="check" size={11} strokeWidth={3} />}
            </span>
            <span className="flex-1 text-xs font-medium text-ink">All portfolios</span>
            <span className="text-[10.5px] text-muted tnum">{PROPERTIES.length} properties</span>
          </button>

          <div className="grid gap-0.5">
            {SEGMENTS.map((segment) => {
              const checked = segments.includes(segment);
              const properties = PROPERTIES.filter((property) => property.segment === segment);
              const units = properties.reduce((sum, property) => sum + property.units, 0);
              return (
                <button
                  key={segment}
                  type="button"
                  role="checkbox"
                  aria-checked={checked}
                  onClick={() => toggle(segment)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-surface-2"
                >
                  <span
                    className={cn(
                      "flex h-4 w-4 items-center justify-center rounded-[5px] border transition-colors",
                      checked ? "border-brand bg-brand text-white dark:text-[#07130d]" : "border-line bg-surface"
                    )}
                  >
                    {checked && <Icon name="check" size={11} strokeWidth={3} />}
                  </span>
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: SEGMENT_META[segment].color }}
                  />
                  <span className="flex-1 text-xs font-medium text-ink">{segment}</span>
                  <span className="text-[10.5px] text-muted tnum">{units} units</span>
                </button>
              );
            })}
          </div>

          <div className="mt-2 flex items-center justify-between border-t border-line px-1 pt-2.5">
            <span className="text-[10.5px] text-muted tnum">
              {segments.length} of {SEGMENTS.length} selected
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md bg-surface-2 px-2 py-1 text-[10.5px] font-semibold text-ink transition hover:bg-surface-3"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function ActiveFilters({
  preset,
  range,
  segments,
  onRemoveSegment,
  onReset,
}: {
  preset: RangePreset;
  range: DateRange;
  segments: Segment[];
  onRemoveSegment: (segment: Segment) => void;
  onReset: () => void;
}) {
  const all = segments.length === SEGMENTS.length;
  const isDefault = preset === "30d" && all;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5">
      <span className="pr-1 text-[10.5px] font-medium uppercase tracking-[0.08em] text-muted">Active</span>
      <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-[11px] font-medium text-ink-2">
        <Icon name="calendar" size={11} className="text-muted" />
        {PRESET_LABEL[preset]}
        <span className="hidden text-muted tnum sm:inline">· {fmtDate(range.start, "short")} – {fmtDate(range.end, "short")}</span>
      </span>
      {all ? (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-[11px] font-medium text-ink-2">
          <Icon name="building" size={11} className="text-muted" />
          All portfolios
        </span>
      ) : (
        segments.map((segment) => (
          <span
            key={segment}
            className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-[11px] font-medium text-ink-2"
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: SEGMENT_META[segment].color }}
            />
            {segment}
            <button
              type="button"
              onClick={() => onRemoveSegment(segment)}
              aria-label={`Remove ${segment} filter`}
              className="-mr-0.5 rounded-full p-0.5 text-muted transition hover:bg-surface-3 hover:text-ink"
            >
              <Icon name="x" size={10} strokeWidth={2.4} />
            </button>
          </span>
        ))
      )}
      {!isDefault && (
        <button
          type="button"
          onClick={onReset}
          className="ml-1 text-[11px] font-semibold text-brand transition hover:underline"
        >
          Reset
        </button>
      )}
    </div>
  );
}
