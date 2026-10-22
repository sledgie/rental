import React from 'react';
import { useApp } from '../context/AppContext';
import { RelatedEntityType } from '../types';
import {
  Building2,
  FileText,
  Wrench,
  Receipt,
  ShieldCheck,
  ExternalLink,
} from 'lucide-react';
import { getPriorityBadge } from '../utils/formatters';

interface RelatedRecordCardProps {
  entityType?: RelatedEntityType;
  entityId?: string;
  referenceLabel?: string;
}

export const RelatedRecordCard: React.FC<RelatedRecordCardProps> = ({
  entityType,
  entityId,
  referenceLabel,
}) => {
  const {
    properties,
    leases,
    maintenanceRequests,
    invoices,
    inspections,
    vendors,
    setActiveModule,
  } = useApp();

  if (!entityType || !entityId) {
    return (
      <div className="p-4 bg-u-s2 border border-u-line rounded-xl text-center text-xs text-u-muted">
        No business record directly linked to this conversation.
      </div>
    );
  }

  // Render specific record cards
  if (entityType === 'maintenance') {
    const wo = maintenanceRequests.find((m) => m.id === entityId);
    if (!wo) return null;
    const priority = getPriorityBadge(wo.priority);
    const assignedVendor = vendors.find((v) => v.id === wo.assignedVendorId);

    return (
      <div className="p-4 bg-u-card border border-u-line rounded-xl shadow-xs space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-u-warn-soft text-u-warn">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-u-muted uppercase tracking-wider">
                Maintenance Work Order
              </span>
              <h4 className="text-xs sm:text-sm font-bold text-u-ink leading-snug">
                {wo.requestNumber}: {wo.title}
              </h4>
            </div>
          </div>
          <button
            onClick={() => setActiveModule('maintenance')}
            className="flex items-center gap-1 text-xs text-u-accent hover:text-u-accent font-semibold shrink-0"
          >
            <span>View Ticket</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>

        <p className="text-xs text-u-ink2 line-clamp-2">{wo.description}</p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-u-line text-xs">
          <div>
            <span className="text-[10px] text-u-muted block font-medium">Status</span>
            <span className="font-semibold text-u-ink capitalize">{wo.status.replace('_', ' ')}</span>
          </div>
          <div>
            <span className="text-[10px] text-u-muted block font-medium">Priority</span>
            <span className={`inline-block font-semibold ${priority.text}`}>{priority.label}</span>
          </div>
          <div>
            <span className="text-[10px] text-u-muted block font-medium">Estimated Cost</span>
            <span className="font-semibold text-u-ink">${wo.estimatedCost ?? 0}</span>
          </div>
          <div>
            <span className="text-[10px] text-u-muted block font-medium">Assigned Vendor</span>
            <span className="font-semibold text-u-ink truncate block">
              {assignedVendor?.name || 'In-House Staff'}
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (entityType === 'invoice') {
    const inv = invoices.find((i) => i.id === entityId);
    if (!inv) return null;

    return (
      <div className="p-4 bg-u-card border border-u-line rounded-xl shadow-xs space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-u-ok-soft text-u-ok">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-u-muted uppercase tracking-wider">
                Financial Invoice
              </span>
              <h4 className="text-xs sm:text-sm font-bold text-u-ink leading-snug">
                {inv.invoiceNumber} — {inv.description}
              </h4>
            </div>
          </div>
          <button
            onClick={() => setActiveModule('invoices')}
            className="flex items-center gap-1 text-xs text-u-accent hover:text-u-accent font-semibold shrink-0"
          >
            <span>Billing Details</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-u-line text-xs">
          <div>
            <span className="text-[10px] text-u-muted block font-medium">Billed Amount</span>
            <span className="font-bold text-u-ink text-sm">${inv.amount.toFixed(2)}</span>
          </div>
          <div>
            <span className="text-[10px] text-u-muted block font-medium">Payment Status</span>
            <span
              className={`font-semibold capitalize ${
                inv.status === 'paid'
                  ? 'text-u-ok'
                  : inv.status === 'disputed'
                  ? 'text-u-warn font-bold'
                  : 'text-u-danger'
              }`}
            >
              {inv.status}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-u-muted block font-medium">Due Date</span>
            <span className="font-semibold text-u-ink">
              {new Date(inv.dueDate).toLocaleDateString()}
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (entityType === 'lease') {
    const l = leases.find((item) => item.id === entityId);
    if (!l) return null;

    return (
      <div className="p-4 bg-u-card border border-u-line rounded-xl shadow-xs space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-u-accent-soft text-u-accent">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-u-muted uppercase tracking-wider">
                Lease Agreement
              </span>
              <h4 className="text-xs sm:text-sm font-bold text-u-ink leading-snug">
                Contract #{l.leaseNumber}
              </h4>
            </div>
          </div>
          <button
            onClick={() => setActiveModule('leases')}
            className="flex items-center gap-1 text-xs text-u-accent hover:text-u-accent font-semibold shrink-0"
          >
            <span>Lease Overview</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-u-line text-xs">
          <div>
            <span className="text-[10px] text-u-muted block font-medium">Monthly Rent</span>
            <span className="font-bold text-u-ink">${l.monthlyRent} / mo</span>
          </div>
          <div>
            <span className="text-[10px] text-u-muted block font-medium">Term Conclusion</span>
            <span className="font-semibold text-u-ink">
              {new Date(l.endDate).toLocaleDateString()}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-u-muted block font-medium">Agreement Status</span>
            <span className="font-semibold text-u-warn capitalize">
              {l.status.replace('_', ' ')}
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (entityType === 'property') {
    const p = properties.find((item) => item.id === entityId);
    if (!p) return null;

    return (
      <div className="p-4 bg-u-card border border-u-line rounded-xl shadow-xs space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-u-accent-soft text-u-accent">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-u-muted uppercase tracking-wider">
                Property Building
              </span>
              <h4 className="text-xs sm:text-sm font-bold text-u-ink leading-snug">{p.name}</h4>
              <p className="text-[11px] text-u-muted">{p.address}, {p.city}</p>
            </div>
          </div>
          <button
            onClick={() => setActiveModule('properties')}
            className="flex items-center gap-1 text-xs text-u-accent hover:text-u-accent font-semibold shrink-0"
          >
            <span>Property Hub</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-u-line text-xs">
          <div>
            <span className="text-[10px] text-u-muted block font-medium">Total Units</span>
            <span className="font-semibold text-u-ink">{p.unitsCount} Units</span>
          </div>
          <div>
            <span className="text-[10px] text-u-muted block font-medium">Occupancy</span>
            <span className="font-semibold text-u-ok">
              {p.occupiedCount}/{p.unitsCount} ({Math.round((p.occupiedCount / p.unitsCount) * 100)}%)
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (entityType === 'inspection') {
    const ins = inspections.find((item) => item.id === entityId);
    if (!ins) return null;

    return (
      <div className="p-4 bg-u-card border border-u-line rounded-xl shadow-xs space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-u-violet/15 text-u-violet">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-u-muted uppercase tracking-wider">
                Safety & Compliance
              </span>
              <h4 className="text-xs sm:text-sm font-bold text-u-ink leading-snug">
                {ins.inspectionNumber} — {ins.type.replace('_', ' ')}
              </h4>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-u-line text-xs">
          <div>
            <span className="text-[10px] text-u-muted block font-medium">Scheduled Date</span>
            <span className="font-semibold text-u-ink">{ins.scheduledDate}</span>
          </div>
          <div>
            <span className="text-[10px] text-u-muted block font-medium">Lead Inspector</span>
            <span className="font-semibold text-u-ink">{ins.inspectorName}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 bg-u-s2 border border-u-line rounded-lg text-xs text-u-ink2">
      Linked Record Reference: <strong>{referenceLabel || `${entityType} #${entityId}`}</strong>
    </div>
  );
};
