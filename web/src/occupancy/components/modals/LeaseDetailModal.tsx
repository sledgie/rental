import React from 'react';
import { OccDrawer } from './OccDrawer';
import { Lease, Property, Tenant, Unit } from '../../types/occupancy';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { X, FileText, Building2, User, Layers, Calendar, DollarSign, ShieldAlert } from 'lucide-react';

interface LeaseDetailModalProps {
  lease: Lease | null;
  property?: Property;
  tenant?: Tenant;
  units?: Unit[];
  onClose: () => void;
}

export function LeaseDetailModal({
  lease,
  property,
  tenant,
  units = [],
  onClose,
}: LeaseDetailModalProps) {
  if (!lease) return null;

  return (
    <OccDrawer title={lease.leaseNumber} subtitle={property?.propertyName} onClose={onClose}>
        {/* Content */}
        <div className="space-y-5 text-xs text-u-ink2">
          {/* Tenant Details */}
          <div className="rounded-xl border border-u-line bg-u-s2/60 p-4 space-y-2">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-u-muted flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-u-accent" />
              Primary Tenant
            </h4>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-u-ink">{tenant?.tenantName || 'Tenant'}</p>
                <p className="text-u-muted">{tenant?.email}</p>
              </div>
              <div className="text-right">
                <p className="text-u-muted">Status</p>
                <span className="font-semibold text-u-ok">{tenant?.tenantStatus || 'Active'}</span>
              </div>
            </div>
          </div>

          {/* Units Included in Lease */}
          <div className="rounded-xl border border-u-line p-4 space-y-2">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-u-muted flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-u-blue" />
              Units Covered ({units.length} units)
            </h4>
            <div className="space-y-1.5">
              {units.map((u) => (
                <div key={u.unitId} className="flex items-center justify-between rounded-lg bg-u-s2 p-2 border border-u-line">
                  <span className="font-bold text-u-ink">Unit {u.unitNumber}</span>
                  <span className="text-u-muted">{u.unitType} • Floor {u.floor}</span>
                  <span className="font-mono text-u-ink2">{u.rentableAreaSqFt} sq ft</span>
                </div>
              ))}
            </div>
          </div>

          {/* Dates & Rent */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-u-line p-3.5 space-y-1">
              <span className="text-u-muted text-[11px] flex items-center gap-1">
                <Calendar className="h-3 w-3 text-u-muted" /> Lease Term
              </span>
              <p className="font-bold text-u-ink">
                {formatDate(lease.leaseStartDate)}
              </p>
              <p className="text-u-muted">
                thru {lease.leaseEndDate ? formatDate(lease.leaseEndDate) : 'Month-to-Month'}
              </p>
            </div>
            <div className="rounded-xl border border-u-line p-3.5 space-y-1">
              <span className="text-u-muted text-[11px] flex items-center gap-1">
                <DollarSign className="h-3 w-3 text-u-muted" /> Monthly Rent
              </span>
              <p className="font-bold text-u-accent text-sm">
                {formatCurrency(lease.monthlyRent)} / mo
              </p>
              <p className="text-u-muted text-[11px]">
                Deposit: {formatCurrency(lease.depositAmount)} ({lease.depositStatus})
              </p>
            </div>
          </div>

          {/* Renewal Status */}
          <div className="rounded-xl border border-u-line p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-u-muted">Renewal Negotiation Status:</span>
              <span className="font-bold text-u-ink">{lease.renewalStatus}</span>
            </div>
            {lease.proposedRenewalRent && (
              <div className="flex items-center justify-between">
                <span className="text-u-muted">Proposed Renewal Rent:</span>
                <span className="font-bold text-u-ok">{formatCurrency(lease.proposedRenewalRent)} / mo</span>
              </div>
            )}
            <div className="flex items-center justify-between text-u-muted pt-1 border-t border-u-line">
              <span>Notice Status:</span>
              <span className="font-medium text-u-ink2">{lease.noticeStatus}</span>
            </div>
            <div className="flex items-center justify-between text-u-muted">
              <span>Assigned Property Manager:</span>
              <span className="font-medium text-u-ink2">{lease.assignedPropertyManager}</span>
            </div>
          </div>
        </div>

    </OccDrawer>
  );
}
