import React, { useState } from 'react';
import { formatPercent, formatCurrency, formatNumber } from '../utils/formatters';
import {
  TrendingUp,
  TrendingDown,
  Building,
  Home,
  FileClock,
  Coins,
  ArrowUpRight,
  Info,
} from 'lucide-react';

interface SummaryCardsProps {
  metrics: {
    physicalOccupancyRate: number;
    physicalVacancyRate: number;
    totalUnits: number;
    rentableUnits: number;
    occupiedUnits: number;
    vacantUnits: number;
    reservedUnits: number;
    unavailableUnits: number;
    upcomingExpirations: number;
    potentialVacancyLoss: number;
    historicalComparison: {
      prevMonthPeriod: string;
      occupancyRateChange: number;
    };
  };
  asOfDate: string;
  onOpenReport: (reportId: string) => void;
}

export function SummaryCards({ metrics, asOfDate, onOpenReport }: SummaryCardsProps) {
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);

  const cards = [
    {
      id: 'occupancy-rate',
      reportId: 'report-occupancy-summary',
      title: 'Physical Occupancy Rate',
      type: 'Current Snapshot' as const,
      value: formatPercent(metrics.physicalOccupancyRate),
      subValue: `${metrics.occupiedUnits} of ${metrics.rentableUnits} rentable units`,
      icon: Building,
      color: 'blue',
      change: metrics.historicalComparison.occupancyRateChange,
      changeLabel: `vs ${metrics.historicalComparison.prevMonthPeriod}`,
      tooltip:
        'Calculation: Occupied Rentable Units ÷ Total Rentable Units × 100. Unavailable administrative units are excluded from denominator.',
    },
    {
      id: 'vacant-units',
      reportId: 'report-vacancy-available',
      title: 'Vacant Units',
      type: 'Current Snapshot' as const,
      value: `${metrics.vacantUnits} Units`,
      subValue: `${formatPercent(metrics.physicalVacancyRate)} physical vacancy`,
      icon: Home,
      color: 'amber',
      extraBadge: `${metrics.reservedUnits} reserved / awaiting move-in`,
      tooltip:
        'Total rentable units currently unleased and vacant on as-of date. Excludes reserved units with active holding deposits.',
    },
    {
      id: 'upcoming-expirations',
      reportId: 'report-lease-expiration',
      title: 'Upcoming Lease Expirations',
      type: 'Configurable Window (60d)' as const,
      value: `${metrics.upcomingExpirations} Leases`,
      subValue: 'Expiring within next 60 days',
      icon: FileClock,
      color: 'purple',
      extraBadge: 'Requires renewal action',
      tooltip:
        'Number of active fixed-term leases reaching contract expiration within 60 days from reporting as-of date.',
    },
    {
      id: 'vacancy-loss',
      reportId: 'report-economic-occupancy',
      title: 'Potential Vacancy Loss',
      type: 'Period Estimated' as const,
      value: formatCurrency(metrics.potentialVacancyLoss),
      subValue: 'Accrued loss for vacant days this month',
      icon: Coins,
      color: 'rose',
      tooltip:
        'Estimated rental revenue unearned due to vacant units: Daily Asking Market Rent (Monthly Rent ÷ 30.417) × Vacant Days.',
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => {
        const IconComponent = card.icon;

        return (
          <div
            key={card.id}
            className="group relative flex flex-col justify-between rounded-xl border border-u-line bg-u-card p-5 shadow-xs hover:border-u-accent/60 hover:shadow-md transition-all duration-200"
          >
            {/* Top row: Title, Type badge, Tooltip trigger */}
            <div>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold uppercase tracking-wider text-u-muted">
                    {card.title}
                  </span>
                  {/* Tooltip trigger */}
                  <div className="relative inline-block">
                    <button
                      type="button"
                      onMouseEnter={() => setActiveTooltip(card.id)}
                      onMouseLeave={() => setActiveTooltip(null)}
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveTooltip(activeTooltip === card.id ? null : card.id);
                      }}
                      className="text-u-muted hover:text-u-ink2 focus:outline-none"
                    >
                      <Info className="h-3.5 w-3.5" />
                    </button>
                    {activeTooltip === card.id && (
                      <div className="absolute left-1/2 bottom-full mb-2 -translate-x-1/2 w-60 rounded-lg border border-u-line2 bg-u-ink2/95 p-2.5 text-[11px] font-normal text-u-s3 shadow-xl z-30">
                        {card.tooltip}
                      </div>
                    )}
                  </div>
                </div>

                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                    card.color === 'blue'
                      ? 'bg-u-accent-soft text-u-accent'
                      : card.color === 'amber'
                      ? 'bg-u-warn-soft text-u-warn'
                      : card.color === 'purple'
                      ? 'bg-u-violet/15 text-u-violet'
                      : 'bg-u-danger-soft text-u-danger'
                  }`}
                >
                  <IconComponent className="h-4 w-4" />
                </div>
              </div>

              {/* Metric Value */}
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl font-bold tracking-tight text-u-ink font-mono">
                  {card.value}
                </span>
                {card.change !== undefined && (
                  <span
                    className={`inline-flex items-center text-xs font-semibold ${
                      card.change >= 0 ? 'text-u-ok' : 'text-u-danger'
                    }`}
                  >
                    {card.change >= 0 ? (
                      <TrendingUp className="mr-0.5 h-3.5 w-3.5" />
                    ) : (
                      <TrendingDown className="mr-0.5 h-3.5 w-3.5" />
                    )}
                    {card.change >= 0 ? `+${card.change.toFixed(1)}%` : `${card.change.toFixed(1)}%`}
                  </span>
                )}
              </div>

              <p className="mt-1 text-xs text-u-muted">{card.subValue}</p>

              {card.extraBadge && (
                <div className="mt-2">
                  <span className="inline-flex items-center rounded-full bg-u-s3 px-2 py-0.5 text-[10px] font-medium text-u-ink2">
                    {card.extraBadge}
                  </span>
                </div>
              )}
            </div>

            {/* Bottom clickable action to related report */}
            <div className="mt-4 pt-3 border-t border-u-line flex items-center justify-between text-xs">
              <span className="text-[11px] font-medium text-u-muted">
                {card.type}
              </span>
              <button
                type="button"
                onClick={() => onOpenReport(card.reportId)}
                className="inline-flex items-center gap-1 font-semibold text-u-accent hover:text-u-accent transition-colors group-hover:translate-x-0.5"
              >
                <span>Open Report</span>
                <ArrowUpRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
