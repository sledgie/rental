import type { PeriodPreset, ReportFilters } from "../types";
import { APP_TODAY } from "../data/constants";

export function parseDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function formatISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDays(iso: string, days: number): string {
  const date = parseDate(iso);
  date.setDate(date.getDate() + days);
  return formatISO(date);
}

export function addMonths(iso: string, months: number): string {
  const date = parseDate(iso);
  date.setMonth(date.getMonth() + months);
  return formatISO(date);
}

export function startOfMonth(iso: string): string {
  const date = parseDate(iso);
  date.setDate(1);
  return formatISO(date);
}

export function endOfMonth(iso: string): string {
  const date = parseDate(iso);
  date.setMonth(date.getMonth() + 1, 0);
  return formatISO(date);
}

export function startOfQuarter(iso: string): string {
  const date = parseDate(iso);
  const q = Math.floor(date.getMonth() / 3) * 3;
  date.setMonth(q, 1);
  return formatISO(date);
}

export function endOfQuarter(iso: string): string {
  const date = parseDate(startOfQuarter(iso));
  date.setMonth(date.getMonth() + 3, 0);
  return formatISO(date);
}

export function compareISO(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

export function inRange(date: string, start: string, end: string): boolean {
  return date >= start && date <= end;
}

export function monthsInRange(start: string, end: string): string[] {
  const months: string[] = [];
  let cursor = startOfMonth(start);
  const last = startOfMonth(end);
  while (cursor <= last) {
    months.push(cursor);
    cursor = addMonths(cursor, 1);
    cursor = startOfMonth(cursor);
  }
  return months;
}

export function monthLabel(iso: string): string {
  return parseDate(iso).toLocaleDateString("en-CA", { month: "short", year: "numeric" });
}

export function longDate(iso: string): string {
  return parseDate(iso).toLocaleDateString("en-CA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function formatPeriodLabel(start: string, end: string): string {
  if (start === end) return longDate(start);
  return `${longDate(start)} – ${longDate(end)}`;
}

export function daysBetween(a: string, b: string): number {
  const ms = parseDate(b).getTime() - parseDate(a).getTime();
  return Math.round(ms / 86400000);
}

export function resolvePeriod(
  preset: PeriodPreset,
  today = APP_TODAY,
  customStart?: string,
  customEnd?: string,
  fiscalYear?: number,
): { startDate: string; endDate: string; asOfDate: string; fiscalYear: number } {
  const todayDate = parseDate(today);
  const year = todayDate.getFullYear();
  const fy = fiscalYear ?? (todayDate.getMonth() === 0 && todayDate.getDate() < 2 ? year - 1 : year);

  switch (preset) {
    case "this-month": {
      const start = startOfMonth(today);
      return { startDate: start, endDate: today, asOfDate: today, fiscalYear: year };
    }
    case "last-month": {
      const last = addMonths(startOfMonth(today), -1);
      return {
        startDate: startOfMonth(last),
        endDate: endOfMonth(last),
        asOfDate: endOfMonth(last),
        fiscalYear: parseDate(last).getFullYear(),
      };
    }
    case "this-quarter": {
      const start = startOfQuarter(today);
      return { startDate: start, endDate: today, asOfDate: today, fiscalYear: year };
    }
    case "last-quarter": {
      const start = addMonths(startOfQuarter(today), -3);
      const end = endOfQuarter(start);
      return {
        startDate: startOfMonth(start),
        endDate: end,
        asOfDate: end,
        fiscalYear: parseDate(end).getFullYear(),
      };
    }
    case "ytd": {
      const start = `${year}-01-01`;
      return { startDate: start, endDate: today, asOfDate: today, fiscalYear: year };
    }
    case "last-year": {
      const y = year - 1;
      return {
        startDate: `${y}-01-01`,
        endDate: `${y}-12-31`,
        asOfDate: `${y}-12-31`,
        fiscalYear: y,
      };
    }
    case "fiscal-year": {
      return {
        startDate: `${fy}-01-01`,
        endDate: fy === year ? today : `${fy}-12-31`,
        asOfDate: fy === year ? today : `${fy}-12-31`,
        fiscalYear: fy,
      };
    }
    case "custom": {
      const start = customStart && customEnd && customStart > customEnd ? customEnd : (customStart ?? `${year}-01-01`);
      const end = customStart && customEnd && customStart > customEnd ? customStart : (customEnd ?? today);
      return {
        startDate: start,
        endDate: end,
        asOfDate: end,
        fiscalYear: parseDate(end).getFullYear(),
      };
    }
    default:
      return { startDate: `${year - 1}-01-01`, endDate: `${year - 1}-12-31`, asOfDate: `${year - 1}-12-31`, fiscalYear: year - 1 };
  }
}

export function previousPeriod(start: string, end: string): { startDate: string; endDate: string } {
  const days = daysBetween(start, end) + 1;
  const prevEnd = addDays(start, -1);
  const prevStart = addDays(prevEnd, -(days - 1));
  return { startDate: prevStart, endDate: prevEnd };
}

export function defaultFilters(today = APP_TODAY): ReportFilters {
  const resolved = resolvePeriod("last-year", today);
  return {
    periodPreset: "last-year",
    startDate: resolved.startDate,
    endDate: resolved.endDate,
    asOfDate: resolved.asOfDate,
    fiscalYear: resolved.fiscalYear,
    propertyId: "all",
    portfolioId: "all",
    ownerId: "all",
    accountId: "all",
    tenantId: "all",
    unitId: "all",
    vendorId: "all",
    transactionType: "all",
    transactionStatus: "posted",
    paymentMethod: "all",
    bankAccountId: "all",
    accountingBasis: "accrual",
    comparison: true,
  };
}

export const PRESET_LABELS: Record<PeriodPreset, string> = {
  "this-month": "This Month",
  "last-month": "Last Month",
  "this-quarter": "This Quarter",
  "last-quarter": "Last Quarter",
  ytd: "Year to Date",
  "last-year": "Last Year",
  "fiscal-year": "Fiscal Year",
  custom: "Custom",
};
