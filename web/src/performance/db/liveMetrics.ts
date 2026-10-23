// Portfolio KPIs and monthly trends computed from the loaded records (Supabase mode). "Previous" values are the same measures as they stood
// 30 days ago; each trend month is the portfolio as it stood at that month's end. The sample data uses fixed figures instead.
import type { MonthlyTrendPoint, PortfolioKPIs, ScoreThresholds, ScoreWeights } from "../types/performance";
import { computePropertyScorecards, fetchFullReportingData } from "./dataService";

/* eslint-disable @typescript-eslint/no-explicit-any -- rows come from the in-memory tables */

type Data = ReturnType<typeof fetchFullReportingData>;
const round1 = (n: number) => Math.round(n * 10) / 10;
const pct = (part: number, whole: number) => (whole ? round1((part / whole) * 100) : 0);
const OPEN = new Set(["Open", "In Progress", "Pending Parts"]);

/** The records as they stood on `date`: later work is not reported yet, and work completed later was still open. */
function asOf(data: Data, date: string): Data {
  const workOrders = data.workOrders
    .filter((w: any) => w.reportedDate && w.reportedDate <= date)
    .map((w: any) => (w.completedDate && w.completedDate > date ? { ...w, status: "Open", completedDate: null, actualDurationHours: null } : w));
  return {
    ...data,
    workOrders,
    inspections: data.inspections.filter((i: any) => !i.scheduledDate || i.scheduledDate <= date || i.status !== "Scheduled"),
    findings: data.findings.filter((f: any) => !f.dueDate || f.dueDate <= date || f.resolutionStatus !== "Resolved"),
    leases: data.leases.filter((l: any) => l.startDate && l.startDate <= date),
  };
}

function measures(data: Data, weights: ScoreWeights, thresholds: ScoreThresholds) {
  const cards = computePropertyScorecards(data, weights, thresholds).filter((c) => c.overallScore !== null);
  const wos = data.workOrders.filter((w: any) => w.status !== "Cancelled");
  const open = wos.filter((w: any) => OPEN.has(w.status));
  const preventive = wos.filter((w: any) => w.maintenanceType === "Preventive");
  const durations = wos.filter((w: any) => w.status === "Completed").map((w: any) => Number(w.actualDurationHours)).filter((n: number) => n > 0);
  const eligible = data.leases.filter((l: any) => l.renewalEligible);
  return {
    score: cards.length ? round1(cards.reduce((s, c) => s + (c.overallScore ?? 0), 0) / cards.length) : 0,
    attention: computePropertyScorecards(data, weights, thresholds).filter((s) => s.classification === "Needs Improvement" || s.classification === "Poor").length,
    open: open.length,
    overdue: open.filter((w: any) => w.slaCompliant === false).length,
    overdueInspections: data.inspections.filter((i: any) => i.status === "Overdue").length,
    pm: pct(preventive.filter((w: any) => w.status === "Completed").length, preventive.length),
    resolution: durations.length ? round1(durations.reduce((a: number, b: number) => a + b, 0) / durations.length) : 0,
    renewal: pct(eligible.filter((l: any) => l.renewalOutcome === "Renewed").length, eligible.length),
  };
}

export function computeLiveKPIs(data: Data, weights: ScoreWeights, thresholds: ScoreThresholds): PortfolioKPIs {
  const now = measures(data, weights, thresholds);
  const then = measures(asOf(data, new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)), weights, thresholds);
  return {
    overallScore: now.score, overallScorePrevious: then.score, overallScoreChange: round1(now.score - then.score),
    propertiesAttentionCount: now.attention, propertiesAttentionChange: now.attention - then.attention,
    openWorkOrdersCount: now.open, openWorkOrdersChange: now.open - then.open,
    overdueWorkOrdersCount: now.overdue, overdueWorkOrdersChange: now.overdue - then.overdue,
    overdueInspectionsCount: now.overdueInspections, overdueInspectionsChange: now.overdueInspections - then.overdueInspections,
    pmCompletionRate: now.pm, pmCompletionRatePrevious: then.pm, pmCompletionRateChange: round1(now.pm - then.pm),
    avgResolutionHours: now.resolution, avgResolutionHoursPrevious: then.resolution, avgResolutionHoursChange: round1(now.resolution - then.resolution),
    leaseRenewalRate: now.renewal, leaseRenewalRatePrevious: then.renewal, leaseRenewalRateChange: round1(now.renewal - then.renewal),
  };
}

export function computeLiveTrends(data: Data, weights: ScoreWeights, thresholds: ScoreThresholds): MonthlyTrendPoint[] {
  const out: MonthlyTrendPoint[] = [];
  const first = new Date();
  first.setDate(1);
  for (let back = 5; back >= 0; back--) {
    const start = new Date(first.getFullYear(), first.getMonth() - back, 1, 12);
    const end = back === 0 ? new Date() : new Date(start.getFullYear(), start.getMonth() + 1, 0, 12);
    const monthKey = start.toISOString().slice(0, 7);
    const snapshot = asOf(data, end.toISOString().slice(0, 10));
    const m = measures(snapshot, weights, thresholds);
    out.push({
      monthKey, monthLabel: start.toLocaleString("en-US", { month: "short", year: "numeric" }), currentScore: m.score, comparisonScore: out.length ? out[out.length - 1].currentScore : m.score,
      openWOs: m.open, completedWOs: data.workOrders.filter((w: any) => w.completedDate && w.completedDate.slice(0, 7) === monthKey).length, pmCompletionRate: m.pm, renewalRate: m.renewal,
    });
  }
  return out;
}
