import React, { useState } from 'react';
import { OccupancyException } from '../../types/occupancy';
import { X, ShieldAlert, CheckCircle, Clock } from 'lucide-react';

interface ExceptionReviewModalProps {
  exception: OccupancyException | null;
  onClose: () => void;
  onUpdateStatus: (exceptionId: string, status: 'Open' | 'Under Review' | 'Resolved') => void;
}

export function ExceptionReviewModal({
  exception,
  onClose,
  onUpdateStatus,
}: ExceptionReviewModalProps) {
  const [selectedStatus, setSelectedStatus] = useState<'Open' | 'Under Review' | 'Resolved'>(
    exception?.status || 'Open'
  );

  if (!exception) return null;

  const handleSave = () => {
    onUpdateStatus(exception.exceptionId, selectedStatus);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-u-ink2/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="relative w-full max-w-lg rounded-2xl bg-u-card shadow-2xl border border-u-line overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-u-line px-6 py-4 bg-u-s2">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-u-warn-soft text-u-warn">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-u-ink">Review Occupancy Exception</h3>
              <p className="text-xs text-u-muted">{exception.propertyName} • Unit {exception.unitNumber}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-u-muted hover:bg-u-line/60 hover:text-u-ink2 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 text-xs text-u-ink2">
          <div className="rounded-xl border border-u-line bg-u-s2 p-3.5 space-y-1">
            <span className="font-semibold text-u-muted text-[11px] uppercase tracking-wider">
              Exception Classification
            </span>
            <p className="font-bold text-u-ink text-sm">{exception.exceptionType}</p>
            <p className="text-u-ink2 leading-relaxed mt-1">{exception.description}</p>
          </div>

          <div className="rounded-xl border border-u-accent/30 bg-u-accent-soft/50 p-3.5">
            <span className="font-semibold text-u-accent text-[11px] uppercase tracking-wider block mb-1">
              Recommended Remediation
            </span>
            <p className="text-u-ink2 leading-relaxed">{exception.recommendedAction}</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-u-ink2 mb-2">
              Update Resolution Status:
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['Open', 'Under Review', 'Resolved'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setSelectedStatus(st)}
                  className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-all ${
                    selectedStatus === st
                      ? 'border-u-accent/60 bg-u-accent text-u-onaccent shadow-xs'
                      : 'border-u-line bg-u-card text-u-ink2 hover:bg-u-s2'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 border-t border-u-line bg-u-s2 px-6 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-u-line2 bg-u-card px-3.5 py-1.5 text-xs font-semibold text-u-ink2 hover:bg-u-s2 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="rounded-lg bg-u-accent px-4 py-1.5 text-xs font-semibold text-u-onaccent hover:bg-u-accent-strong transition-colors shadow-xs"
          >
            Save Status
          </button>
        </div>
      </div>
    </div>
  );
}
