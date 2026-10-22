import React from 'react';
import { formatPercent, formatNumber } from '../../utils/formatters';
import { ArrowDown, CheckCircle2 } from 'lucide-react';

interface FunnelProps {
  inquiries: number;
  applicationsReceived: number;
  applicationsApproved: number;
  leasesOffered: number;
  leasesSigned: number;
  completedMoveIns: number;
  avgTimeToLeaseDays: number;
}

export function LeasingFunnelChart({
  inquiries,
  applicationsReceived,
  applicationsApproved,
  leasesOffered,
  leasesSigned,
  completedMoveIns,
  avgTimeToLeaseDays,
}: FunnelProps) {
  const stages = [
    {
      name: 'Prospect Inquiries',
      count: inquiries,
      color: 'bg-u-accent',
      widthPct: 100,
      conversionFromPrev: null,
    },
    {
      name: 'Applications Received',
      count: applicationsReceived,
      color: 'bg-u-blue',
      widthPct: inquiries > 0 ? (applicationsReceived / inquiries) * 100 : 0,
      conversionFromPrev: inquiries > 0 ? (applicationsReceived / inquiries) * 100 : 0,
      metricLabel: 'Inquiry → App Rate',
    },
    {
      name: 'Applications Approved',
      count: applicationsApproved,
      color: 'bg-u-violet',
      widthPct: inquiries > 0 ? (applicationsApproved / inquiries) * 100 : 0,
      conversionFromPrev: applicationsReceived > 0 ? (applicationsApproved / applicationsReceived) * 100 : 0,
      metricLabel: 'Underwriting Approval',
    },
    {
      name: 'Leases Offered',
      count: leasesOffered,
      color: 'bg-u-violet',
      widthPct: inquiries > 0 ? (leasesOffered / inquiries) * 100 : 0,
      conversionFromPrev: applicationsApproved > 0 ? (leasesOffered / applicationsApproved) * 100 : 0,
      metricLabel: 'Offer Rate',
    },
    {
      name: 'Leases Signed',
      count: leasesSigned,
      color: 'bg-u-ok',
      widthPct: inquiries > 0 ? (leasesSigned / inquiries) * 100 : 0,
      conversionFromPrev: leasesOffered > 0 ? (leasesSigned / leasesOffered) * 100 : 0,
      metricLabel: 'Offer Acceptance',
    },
    {
      name: 'Completed Move-Ins',
      count: completedMoveIns,
      color: 'bg-u-blue',
      widthPct: inquiries > 0 ? (completedMoveIns / inquiries) * 100 : 0,
      conversionFromPrev: leasesSigned > 0 ? (completedMoveIns / leasesSigned) * 100 : 0,
      metricLabel: 'Move-in Execution',
    },
  ];

  // Overall App-to-Lease Ratio
  const appToLeaseRatio = applicationsReceived > 0 ? (leasesSigned / applicationsReceived) * 100 : 0;

  return (
    <div className="rounded-xl border border-u-line bg-u-card p-5 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-5 border-b border-u-line pb-4">
        <div>
          <h3 className="text-sm font-semibold text-u-ink">Leasing Conversion Pipeline</h3>
          <p className="text-xs text-u-muted">Stage-by-stage velocity and conversion metrics</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="rounded-lg bg-u-ok-soft px-3 py-1.5 border border-u-ok/30 text-center">
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-u-ok">
              App-to-Lease
            </span>
            <span className="text-sm font-bold text-u-ok">{formatPercent(appToLeaseRatio)}</span>
          </div>
          <div className="rounded-lg bg-u-accent-soft px-3 py-1.5 border border-u-accent/30 text-center">
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-u-accent">
              Avg Days to Lease
            </span>
            <span className="text-sm font-bold text-u-accent">{avgTimeToLeaseDays} Days</span>
          </div>
        </div>
      </div>

      <div className="space-y-4 max-w-2xl mx-auto">
        {stages.map((stage, idx) => {
          return (
            <div key={stage.name} className="relative">
              {idx > 0 && stage.conversionFromPrev !== null && (
                <div className="flex items-center justify-center my-1">
                  <div className="flex items-center gap-1.5 rounded-full bg-u-s3 px-2.5 py-0.5 text-[10px] font-medium text-u-ink2 border border-u-line">
                    <ArrowDown className="h-3 w-3 text-u-muted" />
                    <span>{stage.metricLabel}:</span>
                    <span className="font-bold text-u-ink">{formatPercent(stage.conversionFromPrev)}</span>
                  </div>
                </div>
              )}

              <div className="overflow-hidden rounded-lg border border-u-line bg-u-s2 p-3 hover:border-u-line2 transition-all">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-semibold text-u-ink">{stage.name}</span>
                  <span className="font-mono text-sm font-bold text-u-ink">
                    {formatNumber(stage.count)}
                  </span>
                </div>

                <div className="h-2.5 w-full rounded-full bg-u-line overflow-hidden">
                  <div
                    className={`h-full ${stage.color} rounded-full transition-all duration-500`}
                    style={{ width: `${Math.max(8, stage.widthPct)}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
