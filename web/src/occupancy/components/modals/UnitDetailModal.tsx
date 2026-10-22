import React from 'react';
import { OccDrawer } from './OccDrawer';
import { Unit, Property, Lease, Tenant } from '../../types/occupancy';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { X, Home, Building2, Calendar, DollarSign, UserCheck, Wrench, AlertCircle } from 'lucide-react';

interface UnitDetailModalProps {
  unit: Unit | null;
  property?: Property;
  activeLease?: Lease;
  tenant?: Tenant;
  daysVacant?: number;
  accruedLoss?: number;
  onClose: () => void;
  onOpenLease?: (leaseId: string) => void;
}

export function UnitDetailModal({
  unit,
  property,
  activeLease,
  tenant,
  daysVacant = 0,
  accruedLoss = 0,
  onClose,
  onOpenLease,
}: UnitDetailModalProps) {
  if (!unit) return null;

  return (
    <OccDrawer title={`Unit ${unit.unitNumber}`} subtitle={`${property?.propertyName || 'Property record'}${property ? ` • ${property.city}, ${property.province}` : ''}`} onClose={onClose}>
        {/* Modal Body */}
        <div className="space-y-6">
          {/* Status Badges Row */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-u-line bg-u-s2 p-3">
              <span className="block text-[11px] font-medium text-u-muted">Occupancy Status</span>
              <span className="mt-1 inline-block text-xs font-bold text-u-ink">
                {unit.currentOccupancyStatus}
              </span>
            </div>
            <div className="rounded-xl border border-u-line bg-u-s2 p-3">
              <span className="block text-[11px] font-medium text-u-muted">Readiness Status</span>
              <span className="mt-1 inline-block text-xs font-bold text-u-ink">
                {unit.readinessStatus}
              </span>
            </div>
            <div className="rounded-xl border border-u-line bg-u-s2 p-3">
              <span className="block text-[11px] font-medium text-u-muted">Unit Type</span>
              <span className="mt-1 inline-block text-xs font-bold text-u-ink">
                {unit.unitType}
              </span>
            </div>
            <div className="rounded-xl border border-u-line bg-u-s2 p-3">
              <span className="block text-[11px] font-medium text-u-muted">Rentable Area</span>
              <span className="mt-1 inline-block text-xs font-bold text-u-ink font-mono">
                {unit.rentableAreaSqFt} sq ft
              </span>
            </div>
          </div>

          {/* Financial Overview */}
          <div className="rounded-xl border border-u-line p-4 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-u-muted flex items-center gap-1.5">
              <DollarSign className="h-4 w-4 text-u-ok" />
              Rental Financials
            </h4>
            <div className="grid grid-cols-3 gap-4 text-xs">
              <div>
                <span className="text-u-muted">Market Rent:</span>
                <p className="text-sm font-bold text-u-ink">{formatCurrency(unit.marketRent)} / mo</p>
              </div>
              <div>
                <span className="text-u-muted">Current Asking Rent:</span>
                <p className="text-sm font-bold text-u-ink">{formatCurrency(unit.askingRent)} / mo</p>
              </div>
              <div>
                <span className="text-u-muted">Contractual Rent:</span>
                <p className="text-sm font-bold text-u-accent font-mono">
                  {unit.contractualRent ? `${formatCurrency(unit.contractualRent)} / mo` : '— No Active Lease —'}
                </p>
              </div>
            </div>
          </div>

          {/* Current Tenancy / Lease Section */}
          {tenant && activeLease ? (
            <div className="rounded-xl border border-u-accent/30 bg-u-accent-soft/50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-u-accent flex items-center gap-1.5">
                  <UserCheck className="h-4 w-4 text-u-accent" />
                  Active Tenancy Record
                </h4>
                {activeLease && (
                  <button
                    type="button"
                    onClick={() => onOpenLease?.(activeLease.leaseId)}
                    className="text-xs font-semibold text-u-accent hover:text-u-accent underline"
                  >
                    View Lease ({activeLease.leaseNumber})
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <span className="text-u-muted">Primary Tenant:</span>
                  <p className="font-semibold text-u-ink">{tenant.tenantName}</p>
                  <p className="text-[11px] text-u-muted">{tenant.email}</p>
                </div>
                <div>
                  <span className="text-u-muted">Lease Term:</span>
                  <p className="font-medium text-u-ink">
                    {formatDate(activeLease.leaseStartDate)} – {activeLease.leaseEndDate ? formatDate(activeLease.leaseEndDate) : 'Periodic / MTM'}
                  </p>
                </div>
                <div>
                  <span className="text-u-muted">Renewal Status:</span>
                  <p className="font-semibold text-u-ink">{activeLease.renewalStatus}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-u-warn/30 bg-u-warn-soft/40 p-4 space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-u-warn flex items-center gap-1.5">
                <AlertCircle className="h-4 w-4 text-u-warn" />
                Vacancy & Turnover Tracking
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-u-muted">Vacancy Start:</span>
                  <p className="font-semibold text-u-ink">{formatDate(unit.vacancyStartDate)}</p>
                </div>
                <div>
                  <span className="text-u-muted">Days Vacant:</span>
                  <p className="font-bold text-u-warn">{daysVacant} days</p>
                </div>
                <div>
                  <span className="text-u-muted">Accrued Vacancy Loss:</span>
                  <p className="font-bold text-u-danger">{formatCurrency(accruedLoss)}</p>
                </div>
                <div>
                  <span className="text-u-muted">Expected Available:</span>
                  <p className="font-semibold text-u-ink">{formatDate(unit.expectedAvailableDate)}</p>
                </div>
              </div>
              {unit.assignedLeasingAgent && (
                <p className="text-xs text-u-ink2 pt-2 border-t border-u-warn/50">
                  <span className="font-medium text-u-muted">Assigned Agent:</span> {unit.assignedLeasingAgent}
                </p>
              )}
            </div>
          )}

          {/* Operational Notes */}
          {unit.notes && (
            <div className="rounded-lg bg-u-s2 p-3 text-xs text-u-ink2 border border-u-line">
              <span className="font-semibold text-u-ink block mb-1">Administrative Notes:</span>
              <p className="text-u-ink2 leading-relaxed">{unit.notes}</p>
            </div>
          )}
        </div>

    </OccDrawer>
  );
}
