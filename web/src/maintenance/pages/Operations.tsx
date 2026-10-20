import { Fragment, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, CalendarClock, CalendarDays, CheckCircle2, ChevronDown, ClipboardList,
  ExternalLink, ListChecks, MoreHorizontal, Pencil, Plus, Power, Search, Wrench, X,
} from 'lucide-react';
import { useStore } from '../store';
import {
  Avatar, Chip, ConfirmDialog, DetailItem, EmptyState, Menu, PrimaryButton,
  PriorityBadge, SectionTitle, SelectInput, SmallButton,
} from '../ui';
import {
  CompleteWorkOrderModal, PreventiveFormModal, RequestFormModal, VisitModal,
  WorkLogModal, WorkOrderFormModal,
} from '../modals';
import { WORKORDER_STATUSES, type PreventiveSchedule, type WorkOrder } from '../types';
import { daysUntil, fmtDate, fmtMoney, todayISO } from '../utils';
import { cn } from '../utils/cn';

export function woTone(status: string): 'green' | 'amber' | 'red' | 'zinc' | 'sky' | 'teal' {
  switch (status) {
    case 'Completed': return 'green';
    case 'In Progress': return 'sky';
    case 'Scheduled': return 'teal';
    case 'On Hold': return 'amber';
    case 'Cancelled': return 'red';
    default: return 'zinc';
  }
}

export function WorkOrderDetail({ wo, onEdit, onComplete, onVisit, onWorklog }: { wo: WorkOrder; onEdit: () => void; onComplete: () => void; onVisit: () => void; onWorklog: () => void }) {
  const s = useStore();
  const req = s.requests.find((r) => r.id === wo.requestId);
  const visits = s.visits.filter((v) => v.workOrderId === wo.id);
  const logs = s.workLogs.filter((l) => l.workOrderId === wo.id);
  const expense = wo.linkedExpenseId ? s.getExpense(wo.linkedExpenseId) : undefined;
  const contractor = s.getContractor(wo.contractorId);

  return (
    <div className="animate-ap-slide-up">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h3 className="text-[15px] font-semibold text-u-ink">{wo.title}</h3>
        <Chip tone={woTone(wo.status)}>{wo.status}</Chip>
        <PriorityBadge priority={wo.priority} />
        <span className="ml-auto flex flex-wrap gap-1.5">
          <SmallButton onClick={onEdit}><Pencil size={12} /> Edit</SmallButton>
          <SmallButton onClick={onVisit}><CalendarDays size={12} /> Schedule Visit</SmallButton>
          <SmallButton onClick={onWorklog}><ClipboardList size={12} /> Add Work Log</SmallButton>
          {wo.status !== 'Completed' && wo.status !== 'Cancelled' && (
            <PrimaryButton onClick={onComplete} className="px-2.5 py-1.5 text-[12px]"><CheckCircle2 size={13} /> Complete</PrimaryButton>
          )}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div>
          <SectionTitle icon={<Wrench size={13} />}>Job Details</SectionTitle>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-3.5 rounded-xl border border-u-line bg-u-card px-4 py-3.5">
            <DetailItem label="Request">
              <button onClick={() => s.navigate('requests', { focusRequestId: wo.requestId })} className="text-u-accent hover:text-u-accent">{wo.requestId} <ExternalLink size={10} className="inline" /></button>
            </DetailItem>
            <DetailItem label="Property / Unit">{s.getProperty(req?.propertyId)?.name} · {s.getUnit(req?.unitId)?.name ?? 'Common Area'}</DetailItem>
            <DetailItem label="Contractor">{contractor ? `${contractor.company} (${contractor.contact}, ${contractor.phone})` : 'Unassigned'}</DetailItem>
            <DetailItem label="Staff Owner">{s.getStaff(wo.staffId)?.name ?? '—'}</DetailItem>
            <DetailItem label="Scheduled">{fmtDate(wo.scheduledDate)}</DetailItem>
            <DetailItem label="Target">{fmtDate(wo.targetDate)}</DetailItem>
            <DetailItem label="Estimate">{fmtMoney(wo.estimate)}</DetailItem>
            <DetailItem label="Approved Budget">{fmtMoney(wo.approvedBudget)}</DetailItem>
            <DetailItem label="Actual Cost">{fmtMoney(wo.actualCost)}</DetailItem>
            <DetailItem label="Linked Expense">{expense ? <button onClick={() => s.navigate('bills')} className="text-u-accent hover:text-u-accent">{expense.id} · {fmtMoney(expense.amount)}</button> : '—'}</DetailItem>
            <DetailItem label="Work Description" className="col-span-2">{wo.description}</DetailItem>
            {wo.scope && <DetailItem label="Scope of Work" className="col-span-2">{wo.scope}</DetailItem>}
            {wo.completionNotes && <DetailItem label="Completion Notes" className="col-span-2">{wo.completionNotes}</DetailItem>}
          </dl>
          {wo.status !== 'Completed' && wo.status !== 'Cancelled' && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {(['Draft', 'Awaiting Assignment', 'Scheduled', 'In Progress', 'On Hold'] as const).filter((st) => st !== wo.status).map((st) => (
                <SmallButton key={st} onClick={() => { s.updateWorkOrder(wo.id, { status: st }, `Work order ${wo.id} → ${st}`); s.toast(`${wo.id} → ${st}.`); }}>
                  → {st}
                </SmallButton>
              ))}
            </div>
          )}
        </div>
        <div>
          <SectionTitle icon={<CalendarDays size={13} />}>Visits ({visits.length})</SectionTitle>
          {visits.length === 0 ? (
            <p className="rounded-xl border border-u-line bg-u-card px-4 py-3 text-[12.5px] text-u-muted">No visits recorded for this work order.</p>
          ) : (
            <div className="space-y-2">
              {visits.map((v) => (
                <div key={v.id} className="rounded-xl border border-u-line bg-u-card px-3.5 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[12.5px] font-medium text-u-ink">{v.purpose}</span>
                    <Chip tone={v.status === 'Completed' ? 'green' : v.status === 'Cancelled' ? 'red' : 'sky'}>{v.status}</Chip>
                  </div>
                  <p className="mt-0.5 text-[11.5px] text-u-muted">{fmtDate(v.date)} · {v.time} · ~{v.durationMins} min</p>
                </div>
              ))}
            </div>
          )}
        </div>
        <div>
          <SectionTitle icon={<ClipboardList size={13} />}>Work Log ({logs.length})</SectionTitle>
          {logs.length === 0 ? (
            <p className="rounded-xl border border-u-line bg-u-card px-4 py-3 text-[12.5px] text-u-muted">No work log entries yet.</p>
          ) : (
            <div className="space-y-2">
              {logs.map((l) => (
                <div key={l.id} className="rounded-xl border border-u-line bg-u-card px-3.5 py-2.5">
                  <div className="flex items-center gap-2">
                    <Avatar name={l.person} size="sm" />
                    <span className="text-[12.5px] font-medium text-u-ink">{l.person}</span>
                    <span className="ml-auto text-[11px] text-u-muted">{fmtDate(l.date)} · {l.hours}h</span>
                  </div>
                  <p className="mt-1.5 text-[12.5px] leading-relaxed text-u-ink2">{l.workPerformed}</p>
                  <p className="mt-1 text-[11px] text-u-muted">{l.outcome}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

