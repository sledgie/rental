import { addDays, change, fmtDate, fmtMonth, parseISO } from "./format";

/* ------------------------------------------------------------------ types */
export const SEGMENTS = ["Urban core", "Coastal", "Suburban", "Mountain"] as const;
export type Segment = (typeof SEGMENTS)[number];

export const PROPERTY_TYPES = ["Apartment", "Loft", "House", "Condo", "Studio"] as const;
export type PropertyType = (typeof PROPERTY_TYPES)[number];

export type ChannelKey = "direct" | "airbnb" | "booking" | "vrbo";

export interface Property {
  id: string;
  name: string;
  city: string;
  state: string;
  segment: Segment;
  type: PropertyType;
  units: number;
  adrBase: number;
  occBase: number;
  rating: number;
  reviews: number;
  channels: Record<ChannelKey, number>;
}

export interface DayRow {
  date: string;
  propertyId: string;
  revenue: number;
  nights: number;
  available: number;
  bookings: number;
  inquiries: number;
  adr: number;
}

export interface Totals {
  revenue: number;
  nights: number;
  available: number;
  bookings: number;
  inquiries: number;
  occupancy: number;
  adr: number;
}

export interface DateRange {
  start: string;
  end: string;
}

export interface SeriesPoint {
  key: string;
  label: string;
  fullLabel: string;
  revenue: number;
  nights: number;
  available: number;
  bookings: number;
  occupancy: number;
  adr: number;
}

export type MetricKey = "revenue" | "occupancy" | "bookings";

/* -------------------------------------------------------------- properties */
export const PROPERTIES: Property[] = [
  {
    id: "atelier",
    name: "The Atelier Lofts",
    city: "Austin",
    state: "TX",
    segment: "Urban core",
    type: "Loft",
    units: 18,
    adrBase: 212,
    occBase: 0.84,
    rating: 4.88,
    reviews: 342,
    channels: { direct: 0.46, airbnb: 0.3, booking: 0.14, vrbo: 0.1 },
  },
  {
    id: "harborline",
    name: "Harborline Residences",
    city: "San Diego",
    state: "CA",
    segment: "Coastal",
    type: "Apartment",
    units: 24,
    adrBase: 268,
    occBase: 0.81,
    rating: 4.76,
    reviews: 508,
    channels: { direct: 0.32, airbnb: 0.38, booking: 0.18, vrbo: 0.12 },
  },
  {
    id: "maplevine",
    name: "Maple & Vine Homes",
    city: "Portland",
    state: "OR",
    segment: "Suburban",
    type: "House",
    units: 12,
    adrBase: 186,
    occBase: 0.78,
    rating: 4.72,
    reviews: 226,
    channels: { direct: 0.41, airbnb: 0.29, booking: 0.12, vrbo: 0.18 },
  },
  {
    id: "cedarpeak",
    name: "Cedar Peak Chalets",
    city: "Boulder",
    state: "CO",
    segment: "Mountain",
    type: "House",
    units: 12,
    adrBase: 318,
    occBase: 0.72,
    rating: 4.92,
    reviews: 189,
    channels: { direct: 0.5, airbnb: 0.24, booking: 0.1, vrbo: 0.16 },
  },
  {
    id: "bellwether",
    name: "The Bellwether",
    city: "Nashville",
    state: "TN",
    segment: "Urban core",
    type: "Apartment",
    units: 21,
    adrBase: 198,
    occBase: 0.86,
    rating: 4.71,
    reviews: 463,
    channels: { direct: 0.35, airbnb: 0.41, booking: 0.15, vrbo: 0.09 },
  },
  {
    id: "saltmarsh",
    name: "Saltmarsh Cottages",
    city: "Savannah",
    state: "GA",
    segment: "Coastal",
    type: "House",
    units: 9,
    adrBase: 232,
    occBase: 0.78,
    rating: 4.83,
    reviews: 164,
    channels: { direct: 0.44, airbnb: 0.27, booking: 0.15, vrbo: 0.14 },
  },
  {
    id: "lumen",
    name: "Lumen Studio Suites",
    city: "Seattle",
    state: "WA",
    segment: "Urban core",
    type: "Studio",
    units: 26,
    adrBase: 176,
    occBase: 0.88,
    rating: 4.65,
    reviews: 612,
    channels: { direct: 0.29, airbnb: 0.42, booking: 0.21, vrbo: 0.08 },
  },
  {
    id: "juniper",
    name: "Juniper Row",
    city: "Denver",
    state: "CO",
    segment: "Urban core",
    type: "Condo",
    units: 15,
    adrBase: 204,
    occBase: 0.82,
    rating: 4.74,
    reviews: 278,
    channels: { direct: 0.38, airbnb: 0.33, booking: 0.19, vrbo: 0.1 },
  },
  {
    id: "palmpine",
    name: "Palm & Pine Villas",
    city: "Miami",
    state: "FL",
    segment: "Coastal",
    type: "House",
    units: 8,
    adrBase: 356,
    occBase: 0.74,
    rating: 4.9,
    reviews: 147,
    channels: { direct: 0.52, airbnb: 0.22, booking: 0.12, vrbo: 0.14 },
  },
  {
    id: "willowbrook",
    name: "Willowbrook Duplexes",
    city: "Minneapolis",
    state: "MN",
    segment: "Suburban",
    type: "House",
    units: 14,
    adrBase: 168,
    occBase: 0.79,
    rating: 4.6,
    reviews: 203,
    channels: { direct: 0.47, airbnb: 0.26, booking: 0.13, vrbo: 0.14 },
  },
  {
    id: "granite",
    name: "Granite Ridge Cabins",
    city: "Lake Tahoe",
    state: "CA",
    segment: "Mountain",
    type: "House",
    units: 10,
    adrBase: 289,
    occBase: 0.7,
    rating: 4.87,
    reviews: 132,
    channels: { direct: 0.55, airbnb: 0.23, booking: 0.08, vrbo: 0.14 },
  },
  {
    id: "cooper",
    name: "Cooper Street Flats",
    city: "Chicago",
    state: "IL",
    segment: "Urban core",
    type: "Apartment",
    units: 19,
    adrBase: 224,
    occBase: 0.83,
    rating: 4.69,
    reviews: 397,
    channels: { direct: 0.34, airbnb: 0.37, booking: 0.2, vrbo: 0.09 },
  },
];

export const PROPERTY_BY_ID: Record<string, Property> = Object.fromEntries(
  PROPERTIES.map((p) => [p.id, p])
);

export const SEGMENT_META: Record<Segment, { label: string; color: string }> = {
  "Urban core": { label: "Urban core", color: "var(--c1)" },
  Coastal: { label: "Coastal", color: "var(--c2)" },
  Suburban: { label: "Suburban", color: "var(--c3)" },
  Mountain: { label: "Mountain", color: "var(--c4)" },
};

export const CHANNEL_META: { key: ChannelKey; label: string; color: string }[] = [
  { key: "direct", label: "Direct", color: "var(--c1)" },
  { key: "airbnb", label: "Airbnb", color: "var(--c2)" },
  { key: "booking", label: "Booking.com", color: "var(--c3)" },
  { key: "vrbo", label: "Vrbo", color: "var(--c4)" },
];

/* -------------------------------------------------------------------- time */
export const TODAY = "2026-06-30";
const DAY_COUNT = 800;
export const DATA_START = addDays(TODAY, -(DAY_COUNT - 1));

export function daysInclusive(start: string, end: string): number {
  return Math.round((parseISO(end).getTime() - parseISO(start).getTime()) / 86_400_000) + 1;
}

export function eachDay(start: string, end: string): string[] {
  const out: string[] = [];
  const total = daysInclusive(start, end);
  for (let i = 0; i < total; i++) out.push(addDays(start, i));
  return out;
}

export function previousRange(range: DateRange): DateRange {
  const length = daysInclusive(range.start, range.end);
  return { start: addDays(range.start, -length), end: addDays(range.start, -1) };
}

export type RangePreset = "7d" | "30d" | "90d" | "6m" | "12m" | "ytd" | "custom";

export const RANGE_PRESETS: { id: Exclude<RangePreset, "custom">; label: string }[] = [
  { id: "7d", label: "Last 7 days" },
  { id: "30d", label: "Last 30 days" },
  { id: "90d", label: "Last 90 days" },
  { id: "6m", label: "Last 6 months" },
  { id: "12m", label: "Last 12 months" },
  { id: "ytd", label: "Year to date" },
];

export const PRESET_LABEL: Record<RangePreset, string> = {
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  "6m": "Last 6 months",
  "12m": "Last 12 months",
  ytd: "Year to date",
  custom: "Custom range",
};

export function presetRange(preset: RangePreset): DateRange {
  switch (preset) {
    case "7d":
      return { start: addDays(TODAY, -6), end: TODAY };
    case "90d":
      return { start: addDays(TODAY, -89), end: TODAY };
    case "6m":
      return { start: addDays(TODAY, -181), end: TODAY };
    case "12m":
      return { start: addDays(TODAY, -364), end: TODAY };
    case "ytd":
      return { start: `${TODAY.slice(0, 4)}-01-01`, end: TODAY };
    case "30d":
    default:
      return { start: addDays(TODAY, -29), end: TODAY };
  }
}

/* ---------------------------------------------------------------- generator */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function dayOfYear(date: Date) {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  return Math.floor((date.getTime() - start) / 86_400_000);
}

function buildDailyRows(): DayRow[] {
  const rows: DayRow[] = [];
  PROPERTIES.forEach((property, propertyIndex) => {
    const random = mulberry32(9_173 + propertyIndex * 2_011);
    for (let i = 0; i < DAY_COUNT; i++) {
      const date = addDays(DATA_START, i);
      const parsed = parseISO(date);
      const dow = parsed.getUTCDay();
      const season = Math.sin(((dayOfYear(parsed) - 100) / 365) * Math.PI * 2) * 0.09;
      const weekend = dow === 5 || dow === 6 ? 0.23 : dow === 0 ? 0.08 : dow === 1 ? -0.07 : -0.015;
      const growth = (i / DAY_COUNT) * 0.05 - 0.02;
      const noise = (random() - 0.5) * 0.08;
      // The -0.1 offset keeps the on-the-books curve inside a realistic range
      // once midweek seasonality and weekend lifts are applied.
      let occupancy = property.occBase - 0.1 + season + weekend + growth + noise;
      const dip = random();
      if (dip < 0.009) occupancy *= 0.52;
      else if (dip < 0.02) occupancy = Math.min(0.99, occupancy + 0.12);
      occupancy = clamp(occupancy, 0.34, 0.985);

      const adr = Math.round(
        property.adrBase * (1 + season * 0.5 + growth * 0.6 + (random() - 0.5) * 0.09)
      );
      const nights = property.units * occupancy;
      const avgStay = 3.1 + random() * 1.7;
      const bookings = Math.max(1, Math.round(nights / avgStay));
      const inquiries = Math.round(bookings * (2.15 + random() * 1.35));

      rows.push({
        date,
        propertyId: property.id,
        revenue: Math.round(nights * adr),
        nights: Math.round(nights * 10) / 10,
        available: property.units,
        bookings,
        inquiries,
        adr,
      });
    }
  });
  return rows;
}

export const DAILY: DayRow[] = buildDailyRows();

/* --------------------------------------------------------------- aggregating */
export function filterRows(rows: DayRow[], range: DateRange, segments: Segment[]): DayRow[] {
  const all = segments.length === 0 || segments.length === SEGMENTS.length;
  const allowed = new Set(segments);
  return rows.filter((row) => {
    if (row.date < range.start || row.date > range.end) return false;
    if (all) return true;
    return allowed.has(PROPERTY_BY_ID[row.propertyId].segment);
  });
}

export function aggregate(rows: DayRow[]): Totals {
  let revenue = 0;
  let nights = 0;
  let available = 0;
  let bookings = 0;
  let inquiries = 0;
  for (const row of rows) {
    revenue += row.revenue;
    nights += row.nights;
    available += row.available;
    bookings += row.bookings;
    inquiries += row.inquiries;
  }
  return {
    revenue,
    nights,
    available,
    bookings,
    inquiries,
    occupancy: available ? nights / available : 0,
    adr: nights ? revenue / nights : 0,
  };
}

export function propertiesInSegments(segments: Segment[]): Property[] {
  if (segments.length === 0 || segments.length === SEGMENTS.length) return PROPERTIES;
  return PROPERTIES.filter((p) => segments.includes(p.segment));
}

/**
 * Daily / weekly / monthly buckets. The granularity scales with the selected
 * range so every chart stays readable while remaining grounded in daily data.
 */
export function buildSeries(rows: DayRow[], range: DateRange): SeriesPoint[] {
  const total = daysInclusive(range.start, range.end);
  const mode: "day" | "week" | "month" = total > 150 ? "month" : total > 45 ? "week" : "day";
  const points = new Map<string, SeriesPoint>();

  for (let i = 0; i < total; i++) {
    const date = addDays(range.start, i);
    let key = date;
    let label = fmtDate(date, "short");
    let fullLabel = fmtDate(date, "medium");

    if (mode === "week") {
      const index = Math.floor(i / 7);
      const bucketStart = addDays(range.start, index * 7);
      key = `w${index}`;
      label = fmtDate(bucketStart, "short");
      fullLabel = `${fmtDate(bucketStart, "medium").replace(/, \d{4}$/, "")} – ${fmtDate(
        addDays(bucketStart, 6),
        "medium"
      )}`;
    } else if (mode === "month") {
      key = date.slice(0, 7);
      label = fmtMonth(`${key}-01`);
      fullLabel = new Intl.DateTimeFormat("en-US", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      }).format(parseISO(`${key}-01`));
    }

    if (!points.has(key)) {
      points.set(key, {
        key,
        label,
        fullLabel,
        revenue: 0,
        nights: 0,
        available: 0,
        bookings: 0,
        occupancy: 0,
        adr: 0,
      });
    }
  }

  for (const row of rows) {
    const offset = daysInclusive(range.start, row.date) - 1;
    if (offset < 0) continue;
    const key =
      mode === "day" ? row.date : mode === "week" ? `w${Math.floor(offset / 7)}` : row.date.slice(0, 7);
    const point = points.get(key);
    if (!point) continue;
    point.revenue += row.revenue;
    point.nights += row.nights;
    point.available += row.available;
    point.bookings += row.bookings;
  }

  return [...points.values()].map((point) => ({
    ...point,
    occupancy: point.available ? point.nights / point.available : 0,
    adr: point.nights ? point.revenue / point.nights : 0,
  }));
}

export function metricValue(point: SeriesPoint, metric: MetricKey): number {
  if (metric === "occupancy") return point.occupancy;
  if (metric === "bookings") return point.bookings;
  return point.revenue;
}

/* ------------------------------------------------------------------- donors */
export interface ChannelSlice {
  key: ChannelKey | string;
  label: string;
  value: number;
  pct: number;
  color: string;
}

export function channelBreakdown(rows: DayRow[]): ChannelSlice[] {
  const perProperty = new Map<string, number>();
  for (const row of rows) {
    perProperty.set(row.propertyId, (perProperty.get(row.propertyId) ?? 0) + row.revenue);
  }
  const slices = CHANNEL_META.map((channel) => {
    let value = 0;
    perProperty.forEach((revenue, id) => {
      value += revenue * (PROPERTY_BY_ID[id]?.channels[channel.key] ?? 0);
    });
    return { ...channel, value, pct: 0 };
  });
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  return slices.map((slice) => ({ ...slice, pct: total ? slice.value / total : 0 }));
}

export interface WeekdayPoint {
  label: string;
  short: string;
  bookings: number;
  prevBookings: number;
  revenue: number;
  prevRevenue: number;
}

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function weekdayBreakdown(rows: DayRow[], previousRows: DayRow[]): WeekdayPoint[] {
  const current = WEEKDAY_LABELS.map((label) => ({
    label,
    short: label,
    bookings: 0,
    revenue: 0,
    days: new Set<string>(),
  }));
  for (const row of rows) {
    const dow = parseISO(row.date).getUTCDay();
    current[dow].bookings += row.bookings;
    current[dow].revenue += row.revenue;
    current[dow].days.add(row.date);
  }

  const previous = WEEKDAY_LABELS.map(() => ({ bookings: 0, revenue: 0, days: 0 }));
  const prevDays = new Map<string, number>();
  for (const row of previousRows) {
    const dow = parseISO(row.date).getUTCDay();
    previous[dow].bookings += row.bookings;
    previous[dow].revenue += row.revenue;
    prevDays.set(row.date, dow);
  }
  // Count unique dates per weekday in the comparison period.
  const prevDaySet = [...prevDays.keys()];
  const prevCounts = new Array(7).fill(0);
  prevDaySet.forEach((date) => {
    prevCounts[parseISO(date).getUTCDay()] += 1;
  });

  return current.map((day, index) => ({
    label: day.label,
    short: day.short,
    bookings: day.days.size ? day.bookings / day.days.size : 0,
    revenue: day.days.size ? day.revenue / day.days.size : 0,
    prevBookings: prevCounts[index] ? previous[index].bookings / prevCounts[index] : 0,
    prevRevenue: prevCounts[index] ? previous[index].revenue / prevCounts[index] : 0,
  }));
}

/* ---------------------------------------------------------------- benchmarks */
export type PerfStatus = "Excellent" | "On track" | "Attention";

export interface PropertyPerformance {
  property: Property;
  revenue: number;
  nights: number;
  bookings: number;
  occupancy: number;
  adr: number;
  prevRevenue: number;
  prevOccupancy: number;
  delta: number;
  status: PerfStatus;
}

export function performanceByProperty(rows: DayRow[], previousRows: DayRow[]): PropertyPerformance[] {
  const current = new Map<string, DayRow[]>();
  const previous = new Map<string, DayRow[]>();
  for (const row of rows) {
    const bucket = current.get(row.propertyId);
    if (bucket) bucket.push(row);
    else current.set(row.propertyId, [row]);
  }
  for (const row of previousRows) {
    const bucket = previous.get(row.propertyId);
    if (bucket) bucket.push(row);
    else previous.set(row.propertyId, [row]);
  }

  return [...current.entries()].map(([id, propertyRows]) => {
    const property = PROPERTY_BY_ID[id];
    const totals = aggregate(propertyRows);
    const priorTotals = aggregate(previous.get(id) ?? []);
    const status: PerfStatus =
      totals.occupancy >= 0.88 ? "Excellent" : totals.occupancy >= 0.8 ? "On track" : "Attention";
    return {
      property,
      revenue: totals.revenue,
      nights: totals.nights,
      bookings: totals.bookings,
      occupancy: totals.occupancy,
      adr: totals.adr,
      prevRevenue: priorTotals.revenue,
      prevOccupancy: priorTotals.occupancy,
      delta: change(totals.revenue, priorTotals.revenue),
      status,
    };
  });
}

export function bestProperty(performance: PropertyPerformance[]): PropertyPerformance | null {
  if (!performance.length) return null;
  return [...performance].sort((a, b) => b.revenue - a.revenue)[0];
}

export function sampleEvery<T>(items: T[], count: number): T[] {
  if (items.length <= count) return items;
  const out: T[] = [];
  const step = (items.length - 1) / (count - 1);
  for (let i = 0; i < count; i++) out.push(items[Math.round(i * step)]);
  return out;
}


