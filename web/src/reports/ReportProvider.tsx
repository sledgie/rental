import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getDataset } from "./lib/data";
import type { BudgetLine, ReportFilters } from "./lib/types";
import { defaultFilters, resolvePeriod } from "./lib/utils/dates";

interface ReportContextValue {
  filters: ReportFilters;
  patchFilters: (patch: Partial<ReportFilters>) => void;
  resetFilters: () => void;
  recentlyUsed: string[];
  markUsed: (reportId: string) => void;
  budgetOverrides: BudgetLine[];
  setBudgetAmount: (line: BudgetLine) => void;
  matchOverrides: Record<string, boolean>;
  toggleMatch: (bankTxnId: string, matched: boolean) => void;
}

const Ctx = createContext<ReportContextValue | null>(null);

// Per-session convenience only; the page works the same when storage is blocked.
function readStore<T>(key: string, fallback: T): T {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function writeStore(key: string, value: unknown) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

export function ReportProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState<ReportFilters>(() => ({ ...defaultFilters(), ...readStore("fr-filters", {}) }));
  const [recentlyUsed, setRecentlyUsed] = useState<string[]>(() => readStore("fr-recent", []));
  const [budgetOverrides, setBudgetOverrides] = useState<BudgetLine[]>(() => readStore("fr-budget", []));
  const [matchOverrides, setMatchOverrides] = useState<Record<string, boolean>>(() => readStore("fr-match", {}));

  useEffect(() => writeStore("fr-filters", filters), [filters]);
  useEffect(() => writeStore("fr-recent", recentlyUsed), [recentlyUsed]);
  useEffect(() => writeStore("fr-budget", budgetOverrides), [budgetOverrides]);
  useEffect(() => writeStore("fr-match", matchOverrides), [matchOverrides]);

  const patchFilters = useCallback((patch: Partial<ReportFilters>) => {
    setFilters((prev) => {
      const next = { ...prev, ...patch };
      if (patch.periodPreset || patch.startDate || patch.endDate || patch.fiscalYear) {
        const resolved = resolvePeriod(next.periodPreset, getDataset().today, next.startDate, next.endDate, next.fiscalYear);
        if (patch.periodPreset && patch.periodPreset !== "custom") {
          next.startDate = resolved.startDate;
          next.endDate = resolved.endDate;
          next.asOfDate = resolved.asOfDate;
          next.fiscalYear = resolved.fiscalYear;
        } else if (patch.startDate || patch.endDate) {
          if (next.endDate < next.startDate) {
            const swap = next.startDate;
            next.startDate = next.endDate;
            next.endDate = swap;
          }
          next.periodPreset = "custom";
          next.asOfDate = next.endDate;
        } else if (patch.fiscalYear) {
          const fy = resolvePeriod("fiscal-year", getDataset().today, undefined, undefined, next.fiscalYear);
          next.startDate = fy.startDate;
          next.endDate = fy.endDate;
          next.asOfDate = fy.asOfDate;
        }
      }
      return next;
    });
  }, []);

  const markUsed = useCallback((id: string) => {
    setRecentlyUsed((prev) => (prev[0] === id ? prev : [id, ...prev.filter((x) => x !== id)].slice(0, 6)));
  }, []);

  const setBudgetAmount = useCallback((line: BudgetLine) => {
    const keyOf = (b: BudgetLine) => `${b.propertyId}-${b.accountId}-${b.fiscalYear}-${b.period}-${b.month}`;
    setBudgetOverrides((prev) => [...prev.filter((b) => keyOf(b) !== keyOf(line)), line]);
  }, []);

  const toggleMatch = useCallback((id: string, matched: boolean) => {
    setMatchOverrides((prev) => ({ ...prev, [id]: matched }));
  }, []);

  const resetFilters = useCallback(() => setFilters(defaultFilters()), []);

  const value = useMemo<ReportContextValue>(
    () => ({ filters, patchFilters, resetFilters, recentlyUsed, markUsed, budgetOverrides, setBudgetAmount, matchOverrides, toggleMatch }),
    [filters, recentlyUsed, budgetOverrides, matchOverrides, patchFilters, resetFilters, markUsed, setBudgetAmount, toggleMatch],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useReportContext() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useReportContext must be used within ReportProvider");
  return ctx;
}
