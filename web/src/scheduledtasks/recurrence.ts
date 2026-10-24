// Client copy of the database's recurrence rules (private.task_series_matches in migration 022), used only to describe a schedule and
// preview its next dates in the form. The database is what actually generates occurrences. All maths is on calendar dates.
import type { Frequency } from "./types";

export interface RuleInput {
  frequency: Frequency;
  interval: number;
  daysOfWeek: number[];
  monthDay: number | null;
  monthWeek: number | null;
  monthWeekday: number | null;
  startDate: string;
  endDate: string | null;
}

const DAY = 86400000;
const parse = (s: string) => { const [y, m, d] = s.split("-").map(Number); return Date.UTC(y, m - 1, d); };
const fmt = (t: number) => new Date(t).toISOString().slice(0, 10);
const dim = (t: number) => { const d = new Date(t); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate(); };
const dow = (t: number) => new Date(t).getUTCDay();
const mondayOf = (t: number) => t - ((dow(t) + 6) % 7) * DAY;

function matches(t: number, r: RuleInput): boolean {
  const start = parse(r.startDate);
  if (t < start) return false;
  const iv = Math.max(1, r.interval || 1);
  const d = new Date(t), s = new Date(start);
  if (r.frequency === "daily" || (r.frequency === "custom" && r.daysOfWeek.length === 0)) return Math.round((t - start) / DAY) % iv === 0;
  if (r.frequency === "weekly" || r.frequency === "custom") {
    const days = r.daysOfWeek.length ? r.daysOfWeek : [dow(start)];
    if (!days.includes(dow(t))) return false;
    return Math.round((mondayOf(t) - mondayOf(start)) / (7 * DAY)) % iv === 0;
  }
  const months = (d.getUTCFullYear() - s.getUTCFullYear()) * 12 + (d.getUTCMonth() - s.getUTCMonth());
  if (r.frequency === "monthly") {
    if (months % iv !== 0) return false;
    if (r.monthWeek != null && r.monthWeekday != null) {
      const first = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
      let expected: number;
      if (r.monthWeek === -1) { const last = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), dim(t)); expected = last - ((dow(last) - r.monthWeekday + 7) % 7) * DAY; }
      else expected = first + (Math.min(1 + ((r.monthWeekday - dow(first) + 7) % 7) + (r.monthWeek - 1) * 7, dim(t)) - 1) * DAY;
      return expected === t;
    }
    if (r.monthDay) return d.getUTCDate() === Math.min(r.monthDay, dim(t));
    return d.getUTCDate() === Math.min(s.getUTCDate(), dim(t));
  }
  if (r.frequency === "quarterly") return months % (3 * iv) === 0 && d.getUTCDate() === Math.min(s.getUTCDate(), dim(t));
  if (r.frequency === "yearly") return (d.getUTCFullYear() - s.getUTCFullYear()) % iv === 0 && d.getUTCMonth() === s.getUTCMonth() && d.getUTCDate() === Math.min(s.getUTCDate(), dim(t));
  return false;
}

/** The next `count` dates after `after` (or from the start date when `after` is null). */
export function upcoming(r: RuleInput, after: string | null, count = 3): string[] {
  const out: string[] = [];
  const end = r.endDate ? parse(r.endDate) : null;
  let t = after ? Math.max(parse(after) + DAY, parse(r.startDate)) : parse(r.startDate);
  for (let i = 0; i < 366 * 5 + 10 && out.length < count; i++, t += DAY) {
    if (end != null && t > end) break;
    if (matches(t, r)) out.push(fmt(t));
  }
  return out;
}

const NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const ordinal = (n: number) => (n === -1 ? "last" : ["", "1st", "2nd", "3rd", "4th", "5th"][n] ?? `${n}th`);
export function describe(r: Pick<RuleInput, "frequency" | "interval" | "daysOfWeek" | "monthDay" | "monthWeek" | "monthWeekday">): string {
  const iv = Math.max(1, r.interval || 1);
  const days = r.daysOfWeek.map((d) => NAMES[d]).join(", ");
  switch (r.frequency) {
    case "daily": return iv === 1 ? "Daily" : `Every ${iv} days`;
    case "weekly": return `${iv === 1 ? "Weekly" : `Every ${iv} weeks`}${days ? ` on ${days}` : ""}`;
    case "monthly":
      if (r.monthWeek != null && r.monthWeekday != null) return `Monthly on the ${ordinal(r.monthWeek)} ${NAMES[r.monthWeekday]}`;
      if (r.monthDay) return `${iv === 1 ? "Monthly" : `Every ${iv} months`} on day ${r.monthDay}`;
      return iv === 1 ? "Monthly" : `Every ${iv} months`;
    case "quarterly": return iv === 1 ? "Quarterly" : `Every ${iv} quarters`;
    case "yearly": return iv === 1 ? "Yearly" : `Every ${iv} years`;
    default: return `Custom${iv > 1 ? ` (every ${iv})` : ""}${days ? ` on ${days}` : ""}`;
  }
}
