import { Fragment, useEffect, useMemo, useState } from 'react';
import {
  Activity as ActivityIcon, AlertTriangle, ArrowUpDown, Banknote, Building2,
  CalendarClock, CalendarDays, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight,
  CircleDollarSign, ClipboardList, Download, ExternalLink, Eye, FileText,
  Filter, History, Hourglass, Inbox, Link2, Mail, MapPin, MoreHorizontal,
  Package, Paperclip, Pencil, Phone, Plus, Receipt, RotateCcw, Search, ShieldCheck,
  Siren, Trash2, Unlink, UserCheck, Wrench, X,
} from 'lucide-react';
import { useStore } from '../store';
import {
  Avatar, Chip, ConfirmDialog, DetailItem, EmptyState, GhostButton, Menu, PaymentBadge,
  PrimaryButton, PriorityBadge, SectionTitle, SelectInput, SmallButton, StatusBadge, Tabs,
} from '../ui';
import {
  ApprovalModal, AssignModal, CompleteModal, EstimateModal, LinkExpenseModal,
  ReasonModal, ReplaceApplianceModal, RequestFormModal, UploadModal, VisitModal,
  WorkLogModal, WorkOrderFormModal, type RequestPreset,
} from '../modals';
import { CATEGORIES, OPEN_STATUSES, PRIORITIES, REQUEST_STATUSES, STATUS_TRANSITIONS, type Estimate, type MaintenanceRequest, type Visit } from '../types';
import { assetAgeYears, daysUntil, fmtDate, fmtDateTime, fmtMoney, isOverdue, overdueDays, timeAgo, warrantyState } from '../utils';
import { cn } from '../utils/cn';

export type ModalState =
  | { kind: 'none' }
  | { kind: 'newRequest'; preset?: RequestPreset }
  | { kind: 'editRequest'; req: MaintenanceRequest }
  | { kind: 'assign'; req: MaintenanceRequest }
  | { kind: 'visit'; req: MaintenanceRequest; visit?: Visit }
  | { kind: 'worklog'; req: MaintenanceRequest }
  | { kind: 'estimate'; req: MaintenanceRequest; estimate?: Estimate }
  | { kind: 'approval'; req: MaintenanceRequest; estimate: Estimate; mode: 'approve' | 'reject' | 'revision' }
  | { kind: 'complete'; req: MaintenanceRequest }
  | { kind: 'reason'; req: MaintenanceRequest; action: 'reject' | 'cancel' | 'reopen' }
  | { kind: 'replace'; req: MaintenanceRequest }
  | { kind: 'expenses'; req: MaintenanceRequest }
  | { kind: 'upload'; req: MaintenanceRequest }
  | { kind: 'workorder'; req: MaintenanceRequest }
  | { kind: 'confirmDeleteEstimate'; req: MaintenanceRequest; estimate: Estimate };

// ── Expanded detail ──────────────────────────────────────────────────────────

export function RequestDetail({ req, setModal }: { req: MaintenanceRequest; setModal: (m: ModalState) => void }) {
  const s = useStore();
  const [tab, setTab] = useState('overview');
  const [confirmCancelVisit, setConfirmCancelVisit] = useState<Visit | null>(null);
  const estimates = s.requestEstimates(req.id);
  const visits = s.requestVisits(req.id);
  const logs = s.requestWorkLogs(req.id);
  const docs = s.requestAttachments(req.id);
  const activity = s.requestActivity(req.id);
  const workOrders = s.requestWorkOrders(req.id);
  const property = s.getProperty(req.propertyId);
  const unit = s.getUnit(req.unitId);
  const tenant = s.getTenant(req.tenantId);
  const lease = s.getLease(req.leaseId);
  const asset = s.getAsset(req.assetId);
  const contractor = s.getContractor(req.assignedContractorId);
  const coordinator = s.getStaff(req.assignedStaffId);
  const est = s.estimatedCost(req);
  const actual = s.actualCost(req);
  const finished = req.status === 'Completed' || req.status === 'Closed';
  const transitions = STATUS_TRANSITIONS[req.status];

  const changeStatus = (next: string) => {
    if (next === 'Completed') return setModal({ kind: 'complete', req });
    if (next === 'Rejected') return setModal({ kind: 'reason', req, action: 'reject' });
    if (next === 'Cancelled') return setModal({ kind: 'reason', req, action: 'cancel' });
    if (next === 'In Progress' && finished) return setModal({ kind: 'reason', req, action: 'reopen' });
    if (next === 'Closed') {
      s.setRequestStatus(req.id, 'Closed');
      s.toast(`${req.id} closed.`);
      return;
    }
    s.setRequestStatus(req.id, next as MaintenanceRequest['status']);
    s.toast(`${req.id} → ${next}.`);
  };

  return (
    <div className="animate-ap-slide-up px-5 py-4">
      {/* Detail header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-[15px] font-semibold text-u-ink">{req.title}</h3>
          <StatusBadge status={req.status} />
          <PriorityBadge priority={req.priority} />
          {isOverdue(req) && <Chip tone="red"><AlertTriangle size={11} /> Overdue by {overdueDays(req)}d</Chip>}
          {req.followUpRequired && finished && <Chip tone="amber">Follow-up required</Chip>}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Menu
            trigger={
              <button className="inline-flex items-center gap-1 rounded-lg border border-u-line bg-u-s2 px-2.5 py-1.5 text-[12px] font-medium text-u-ink transition hover:border-u-line2">
                Change Status <ChevronDown size={12} />
              </button>
            }
            items={transitions.map((t) => ({
              label: t === 'In Progress' && finished ? 'Reopen (In Progress)…' : `${t}${t === 'Completed' || t === 'Rejected' || t === 'Cancelled' ? '…' : ''}`,
              danger: t === 'Rejected' || t === 'Cancelled',
              onClick: () => changeStatus(t),
            }))}
          />
          <SmallButton onClick={() => setModal({ kind: 'editRequest', req })}><Pencil size={12} /> Edit</SmallButton>
          <SmallButton onClick={() => setModal({ kind: 'assign', req })}><UserCheck size={12} /> Assign</SmallButton>
          <SmallButton onClick={() => setModal({ kind: 'visit', req })}><CalendarDays size={12} /> Schedule Visit</SmallButton>
          <SmallButton onClick={() => setModal({ kind: 'worklog', req })}><ClipboardList size={12} /> Add Work Log</SmallButton>
          {asset && asset.status !== 'Replaced' && (
            <SmallButton onClick={() => setModal({ kind: 'replace', req })} className="border-u-warn/40 text-u-warn hover:border-u-warn/70">
              <Package size={12} /> Replace Appliance
            </SmallButton>
          )}
          {!finished && (
            <PrimaryButton onClick={() => setModal({ kind: 'complete', req })} className="px-2.5 py-1.5 text-[12px]">
              <CheckCircle2 size={13} /> Complete
            </PrimaryButton>
          )}
        </div>
      </div>

      <div className="mt-3">
        <Tabs
          active={tab}
          onChange={setTab}
          tabs={[
            { key: 'overview', label: 'Overview' },
            { key: 'visits', label: 'Assignment & Visits', count: visits.filter((v) => v.status === 'Scheduled').length || undefined },
            { key: 'worklog', label: 'Work Log', count: logs.length || undefined },
            { key: 'estimates', label: 'Estimates & Approvals', count: estimates.length || undefined },
            { key: 'costs', label: 'Costs & Expenses', count: req.linkedExpenseIds.length || undefined },
            { key: 'documents', label: 'Documents', count: docs.length || undefined },
            { key: 'activity', label: 'Activity', count: activity.length || undefined },
          ]}
        />
      </div>

      <div className="pt-4">
        {tab === 'overview' && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Left: description + details */}
            <div className="space-y-5 lg:col-span-2">
              <div>
                <SectionTitle icon={<FileText size={13} />}>Description</SectionTitle>
                <p className="rounded-xl border border-u-line bg-u-card px-4 py-3 text-[13px] leading-relaxed text-u-ink2">{req.description}</p>
                {req.statusReason && (req.status === 'Rejected' || req.status === 'Cancelled') && (
                  <p className="mt-2 rounded-xl border border-u-danger/25 bg-u-danger/5 px-4 py-3 text-[12.5px] text-u-danger">
                    <b>{req.status} reason:</b> {req.statusReason}
                  </p>
                )}
              </div>
              <div>
                <SectionTitle icon={<ClipboardList size={13} />}>Request Details</SectionTitle>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3.5 rounded-xl border border-u-line bg-u-card px-4 py-3.5 sm:grid-cols-3">
                  <DetailItem label="Request ID">{req.id}</DetailItem>
                  <DetailItem label="Category">{req.category}{req.subcategory ? ` · ${req.subcategory}` : ''}</DetailItem>
                  <DetailItem label="Source">{req.source}</DetailItem>
                  <DetailItem label="Reported">{fmtDateTime(req.reportedAt)}</DetailItem>
                  <DetailItem label="Preferred By">{fmtDate(req.preferredDate)}</DetailItem>
                  <DetailItem label="Target Date">{fmtDate(req.targetDate)}</DetailItem>
                  <DetailItem label="Completed">{req.completedAt ? fmtDate(req.completedAt) : '—'}</DetailItem>
                  <DetailItem label="Reported By">{req.reportedByName} <span className="text-u-muted">({req.reportedByRole})</span></DetailItem>
                  <DetailItem label="Approval Status">{req.approvalStatus}{req.approvedBudget !== undefined ? ` · Budget ${fmtMoney(req.approvedBudget)}` : ''}</DetailItem>
                </dl>
              </div>
              {(req.internalNotes || req.tenantNotes) && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {req.internalNotes && (
                    <div className="rounded-xl border border-u-line bg-u-card px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-u-muted">Internal Notes <span className="normal-case text-u-muted">(staff only)</span></p>
                      <p className="mt-1.5 text-[12.5px] leading-relaxed text-u-ink2">{req.internalNotes}</p>
                    </div>
                  )}
                  {req.tenantNotes && (
                    <div className="rounded-xl border border-u-line bg-u-card px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-u-muted">Tenant-Facing Notes</p>
                      <p className="mt-1.5 text-[12.5px] leading-relaxed text-u-ink2">{req.tenantNotes}</p>
                    </div>
                  )}
                </div>
              )}
              {finished && (
                <div>
                  <SectionTitle icon={<CheckCircle2 size={13} />}>Resolution</SectionTitle>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-3.5 rounded-xl border border-u-ok/20 bg-u-ok/[0.03] px-4 py-3.5 sm:grid-cols-3">
                    <DetailItem label="Outcome">{req.resolutionOutcome ?? '—'}</DetailItem>
                    <DetailItem label="Completed">{fmtDate(req.completedAt)}</DetailItem>
                    <DetailItem label="Final Cost">{fmtMoney(actual)}</DetailItem>
                    <DetailItem label="Final Contractor">{contractor?.company ?? '—'}</DetailItem>
                    <DetailItem label="Verification">{req.verificationStatus ?? '—'}{req.verifiedBy ? ` · ${req.verifiedBy}` : ''}</DetailItem>
                    <DetailItem label="Warranty">{req.warrantyInfo ?? '—'}</DetailItem>
                    <DetailItem label="Completion Notes" className="col-span-2 sm:col-span-3">{req.resolutionNotes ?? '—'}</DetailItem>
                  </dl>
                  <div className="mt-2.5">
                    <SmallButton onClick={() => setModal({ kind: 'reason', req, action: 'reopen' })}><RotateCcw size={12} /> Reopen Request</SmallButton>
                  </div>
                </div>
              )}
              {req.previousCompletions.length > 0 && (
                <div>
                  <SectionTitle icon={<History size={13} />}>Previous Completions (preserved)</SectionTitle>
                  <div className="space-y-2">
                    {req.previousCompletions.map((pc, i) => (
                      <div key={i} className="rounded-xl border border-u-line bg-u-card px-4 py-3 text-[12.5px] text-u-ink2">
                        <span className="font-medium text-u-ink">{pc.outcome}</span> · completed {fmtDate(pc.completedAt)} · final cost {fmtMoney(pc.finalCost)}
                        <p className="mt-1 text-u-ink2">{pc.notes}</p>
                        {pc.reopenedAt && <p className="mt-1 text-[11.5px] text-u-muted">Reopened {fmtDate(pc.reopenedAt)}{pc.reopenReason ? ` — ${pc.reopenReason}` : ''}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right: location, people, asset */}
            <div className="space-y-5">
              <div>
                <SectionTitle icon={<Building2 size={13} />}>Property & Unit</SectionTitle>
                <div className="rounded-xl border border-u-line bg-u-card px-4 py-3.5">
                  <button onClick={() => s.navigate('properties')} className="text-left text-[13.5px] font-semibold text-u-accent transition hover:text-u-accent">
                    {property?.name} <ExternalLink size={11} className="inline" />
                  </button>
                  <p className="mt-0.5 flex items-center gap-1 text-[12px] text-u-muted"><MapPin size={11} /> {property?.address}, {property?.city}</p>
                  <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-3">
                    <DetailItem label="Unit">{unit ? <button onClick={() => s.navigate('units')} className="text-u-accent hover:text-u-accent">{unit.name} <ExternalLink size={10} className="inline" /></button> : 'Common area'}</DetailItem>
                    <DetailItem label="Room / Location">{req.room ?? '—'}</DetailItem>
                    {unit && <DetailItem label="Layout">{unit.beds} bd · {unit.baths} ba · {unit.sqft} sqft</DetailItem>}
                    {lease && <DetailItem label="Lease"><button onClick={() => s.navigate('leases')} className="text-u-accent hover:text-u-accent">{lease.id} <ExternalLink size={10} className="inline" /></button><span className="block text-[11px] text-u-muted">{fmtDate(lease.start)} → {fmtDate(lease.end)}</span></DetailItem>}
                  </dl>
                  {tenant && (
                    <div className="mt-3 border-t border-u-line pt-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={tenant.name} />
                        <div>
                          <button onClick={() => s.navigate('tenants')} className="text-[13px] font-medium text-u-accent hover:text-u-accent">{tenant.name} <ExternalLink size={10} className="inline" /></button>
                          <p className="text-[11.5px] text-u-muted">Tenant since {fmtDate(tenant.movedIn)}</p>
                        </div>
                      </div>
                      <div className="mt-2 space-y-1 text-[12px] text-u-ink2">
                        <p className="flex items-center gap-1.5"><Phone size={11} /> {tenant.phone}</p>
                        <p className="flex items-center gap-1.5"><Mail size={11} /> {tenant.email}</p>
                      </div>
                    </div>
                  )}
                  {(req.accessInstructions || req.preferredAccessTimes || req.petsNote) && (
                    <div className="mt-3 space-y-2 border-t border-u-line pt-3 text-[12px]">
                      {req.accessInstructions && <p><span className="font-medium text-u-ink2">Access: </span><span className="text-u-ink2">{req.accessInstructions}</span></p>}
                      {req.preferredAccessTimes && <p><span className="font-medium text-u-ink2">Preferred times: </span><span className="text-u-ink2">{req.preferredAccessTimes}</span></p>}
                      {req.petsNote && <p><span className="font-medium text-u-ink2">Pets: </span><span className="text-u-ink2">{req.petsNote}</span></p>}
                    </div>
                  )}
                </div>
              </div>

              {asset && <AssetSnapshot assetId={asset.id} req={req} onReplace={() => setModal({ kind: 'replace', req })} />}

              <div>
                <SectionTitle icon={<CircleDollarSign size={13} />}>Cost Summary</SectionTitle>
                <div className="rounded-xl border border-u-line bg-u-card px-4 py-3.5 text-[12.5px]">
                  <div className="space-y-1.5">
                    <div className="flex justify-between"><span className="text-u-muted">Estimated</span><span className="tabular text-u-ink">{est !== null ? fmtMoney(est) : '—'}</span></div>
                    <div className="flex justify-between"><span className="text-u-muted">Approved budget</span><span className="tabular text-u-ink">{fmtMoney(req.approvedBudget)}</span></div>
                    <div className="flex justify-between"><span className="text-u-muted">Actual (linked invoices)</span><span className="font-medium tabular text-u-ink">{fmtMoney(actual)}</span></div>
                    {req.approvedBudget !== undefined && (
                      <div className="flex justify-between border-t border-u-line pt-1.5">
                        <span className="text-u-muted">Remaining budget</span>
                        <span className={cn('font-medium tabular', req.approvedBudget - actual < 0 ? 'text-u-danger' : 'text-u-ok')}>{fmtMoney(req.approvedBudget - actual)}</span>
                      </div>
                    )}
                  </div>
                  <button onClick={() => setTab('costs')} className="mt-2.5 text-[12px] font-medium text-u-accent hover:text-u-accent">Open costs & expenses →</button>
                </div>
              </div>

              {workOrders.length > 0 && (
                <div>
                  <SectionTitle icon={<Wrench size={13} />}>Work Orders</SectionTitle>
                  <div className="space-y-2">
                    {workOrders.map((w) => (
                      <button
                        key={w.id}
                        onClick={() => s.navigate('workorders', { focusRequestId: req.id })}
                        className="flex w-full items-center justify-between gap-2 rounded-xl border border-u-line bg-u-card px-3.5 py-2.5 text-left transition hover:border-u-line2"
                      >
                        <span>
                          <span className="block text-[12.5px] font-medium text-u-ink">{w.id} · {w.title}</span>
                          <span className="text-[11px] text-u-muted">{s.getContractor(w.contractorId)?.company ?? 'Unassigned'}</span>
                        </span>
                        <Chip tone={w.status === 'Completed' ? 'green' : w.status === 'On Hold' ? 'amber' : 'sky'}>{w.status}</Chip>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'visits' && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div>
              <SectionTitle icon={<UserCheck size={13} />} action={<SmallButton onClick={() => setModal({ kind: 'assign', req })}>Change Assignment</SmallButton>}>
                Current Assignment
              </SectionTitle>
              <div className="space-y-3 rounded-xl border border-u-line bg-u-card px-4 py-3.5">
                <DetailItem label="Assigned Contractor">
                  {contractor ? (
                    <span>
                      <span className="font-medium">{contractor.company}</span>
                      <span className="block text-[12px] text-u-muted">{contractor.contact} · {contractor.phone}</span>
                      <span className="block text-[12px] text-u-muted">{contractor.email}</span>
                    </span>
                  ) : <span className="text-u-warn">Not assigned</span>}
                </DetailItem>
                <DetailItem label="Coordinating Staff">{coordinator ? `${coordinator.name} — ${coordinator.role}` : '—'}</DetailItem>
                <DetailItem label="Assigned On">{req.assignedAt ? fmtDateTime(req.assignedAt) : '—'}</DetailItem>
                <DetailItem label="Assignment Status">{req.status}</DetailItem>
                {req.contractorNotes && <DetailItem label="Notes for Contractor">{req.contractorNotes}</DetailItem>}
              </div>
            </div>
            <div className="lg:col-span-2">
              <SectionTitle icon={<CalendarDays size={13} />} action={<PrimaryButton onClick={() => setModal({ kind: 'visit', req })} className="px-2.5 py-1.5 text-[12px]"><Plus size={13} /> Schedule Visit</PrimaryButton>}>
                Visits ({visits.length})
              </SectionTitle>
              {visits.length === 0 ? (
                <EmptyState icon={<CalendarDays size={18} />} title="No visits scheduled yet" body="Schedule an inspection or repair visit. Multiple visits are supported — e.g. diagnose first, return with parts later." />
              ) : (
                <div className="space-y-2">
                  {visits.map((v) => (
                    <div key={v.id} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-u-line bg-u-card px-4 py-3">
                      <div>
                        <p className="text-[13px] font-medium text-u-ink">{v.purpose}</p>
                        <p className="mt-0.5 text-[12px] text-u-muted">
                          {fmtDate(v.date)} · {v.time} · ~{v.durationMins} min
                          {v.contractorId ? ` · ${s.getContractor(v.contractorId)?.company}` : ''}
                          {v.staffId ? ` · ${s.getStaff(v.staffId)?.name}` : ''}
                          {v.workOrderId ? ` · ${v.workOrderId}` : ''}
                        </p>
                        {v.accessArrangements && <p className="text-[12px] text-u-muted">Access: {v.accessArrangements}</p>}
                        {v.notes && <p className="mt-1 text-[12.5px] text-u-ink2">{v.notes}</p>}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Chip tone={v.status === 'Completed' ? 'green' : v.status === 'Cancelled' ? 'red' : v.status === 'Rescheduled' ? 'amber' : 'sky'}>{v.status}</Chip>
                        {v.status === 'Scheduled' && (
                          <>
                            <SmallButton onClick={() => { s.updateVisit(v.id, { status: 'Completed' }, `Visit marked completed: ${v.purpose}`); s.toast('Visit marked completed. Consider adding a work log entry.'); }}>Complete</SmallButton>
                            <SmallButton onClick={() => setModal({ kind: 'visit', req, visit: v })}>Reschedule</SmallButton>
                            <SmallButton onClick={() => setConfirmCancelVisit(v)} className="hover:border-u-danger/50 hover:text-u-danger">Cancel</SmallButton>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'worklog' && (
          <div>
            <SectionTitle icon={<ClipboardList size={13} />} action={<PrimaryButton onClick={() => setModal({ kind: 'worklog', req })} className="px-2.5 py-1.5 text-[12px]"><Plus size={13} /> Add Work Log Entry</PrimaryButton>}>
              Work Log
            </SectionTitle>
            {logs.length === 0 ? (
              <EmptyState icon={<ClipboardList size={18} />} title="No work recorded yet" body="Work log entries build the permanent service history for this request and any linked appliance. Entries are append-only." />
            ) : (
              <div className="space-y-2">
                {logs.map((w) => (
                  <div key={w.id} className="rounded-xl border border-u-line bg-u-card px-4 py-3.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={w.person} size="sm" />
                        <div>
                          <p className="text-[13px] font-medium text-u-ink">{w.person}</p>
                          <p className="text-[11.5px] text-u-muted">{fmtDateTime(w.date)} · {w.hours}h{w.workOrderId ? ` · ${w.workOrderId}` : ''}</p>
                        </div>
                      </div>
                      <div className="flex gap-1.5">
                        <Chip tone={w.outcome === 'Work Completed' ? 'green' : w.outcome.includes('Replacement') ? 'amber' : 'sky'}>{w.outcome}</Chip>
                        {w.followUpRequired && <Chip tone="amber">Follow-up needed</Chip>}
                      </div>
                    </div>
                    <p className="mt-2.5 text-[13px] leading-relaxed text-u-ink2">{w.workPerformed}</p>
                    <div className="mt-2 grid grid-cols-1 gap-2 text-[12.5px] sm:grid-cols-2">
                      {w.diagnosis && <p><span className="font-medium text-u-muted">Diagnosis: </span><span className="text-u-ink2">{w.diagnosis}</span></p>}
                      {w.materials && <p><span className="font-medium text-u-muted">Materials: </span><span className="text-u-ink2">{w.materials}</span></p>}
                    </div>
                    {w.notes && <p className="mt-1.5 text-[12.5px] italic text-u-muted">{w.notes}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'estimates' && (
          <div>
            <SectionTitle icon={<Receipt size={13} />} action={<PrimaryButton onClick={() => setModal({ kind: 'estimate', req })} className="px-2.5 py-1.5 text-[12px]"><Plus size={13} /> New Estimate</PrimaryButton>}>
              Estimates & Approvals
            </SectionTitle>
            <div className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-u-line bg-u-card px-4 py-3 text-[12.5px]">
              <span className="text-u-muted">Request approval status:</span>
              <Chip tone={req.approvalStatus === 'Approved' ? 'green' : req.approvalStatus === 'Pending Approval' ? 'amber' : req.approvalStatus === 'Rejected' ? 'red' : 'zinc'}>{req.approvalStatus}</Chip>
              {req.approvedBudget !== undefined && <span className="text-u-ink2">Approved budget: <b className="tabular">{fmtMoney(req.approvedBudget)}</b></span>}
              <span className="text-u-muted">Approval threshold: {fmtMoney(s.settings.approvalThreshold)} (Settings)</span>
            </div>
            {estimates.length === 0 ? (
              <EmptyState icon={<Receipt size={18} />} title="No estimates yet" body="Record a contractor quotation or internal estimate. Estimates above the approval threshold must be approved before work proceeds — an approved estimate is not a payment." />
            ) : (
              <div className="space-y-2">
                {estimates.map((e) => (
                  <div key={e.id} className="rounded-xl border border-u-line bg-u-card px-4 py-3.5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-[13px] font-medium text-u-ink">{e.id} · {e.label}</p>
                        <p className="mt-0.5 text-[11.5px] text-u-muted">
                          Submitted by {e.submittedBy} · {fmtDate(e.submittedAt)}
                          {e.approvedBy && ` · Approved by ${e.approvedBy} on ${fmtDate(e.approvedAt)}`}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[16px] font-semibold tabular text-u-ink">{fmtMoney(e.total)}</p>
                        <Chip tone={e.status === 'Approved' ? 'green' : e.status === 'Pending Approval' ? 'amber' : e.status === 'Rejected' ? 'red' : e.status === 'Revision Requested' ? 'sky' : 'zinc'}>{e.status}</Chip>
                      </div>
                    </div>
                    <div className="mt-2.5 grid grid-cols-2 gap-2 text-[12px] sm:grid-cols-4">
                      <span className="rounded-lg bg-u-s2 px-2.5 py-1.5"><span className="text-u-muted">Labor </span><b className="tabular text-u-ink">{fmtMoney(e.labor)}</b></span>
                      <span className="rounded-lg bg-u-s2 px-2.5 py-1.5"><span className="text-u-muted">Materials </span><b className="tabular text-u-ink">{fmtMoney(e.materials)}</b></span>
                      <span className="rounded-lg bg-u-s2 px-2.5 py-1.5"><span className="text-u-muted">Other </span><b className="tabular text-u-ink">{fmtMoney(e.other)}</b></span>
                      <span className="rounded-lg bg-u-s2 px-2.5 py-1.5"><span className="text-u-muted">Tax </span><b className="tabular text-u-ink">{fmtMoney(e.tax)}</b></span>
                    </div>
                    {e.notes && <p className="mt-2 text-[12.5px] text-u-ink2">{e.notes}</p>}
                    {req.approvedBudget !== undefined && e.total > req.approvedBudget && e.status !== 'Approved' && (
                      <p className="mt-2 flex items-center gap-1 text-[12px] text-u-warn"><AlertTriangle size={12} /> Exceeds the approved budget of {fmtMoney(req.approvedBudget)}.</p>
                    )}
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {e.status === 'Pending Approval' && (
                        <>
                          <PrimaryButton onClick={() => setModal({ kind: 'approval', req, estimate: e, mode: 'approve' })} className="px-2.5 py-1.5 text-[12px]">Approve Work</PrimaryButton>
                          <SmallButton onClick={() => setModal({ kind: 'approval', req, estimate: e, mode: 'revision' })}>Request Revision</SmallButton>
                          <SmallButton onClick={() => setModal({ kind: 'approval', req, estimate: e, mode: 'reject' })} className="hover:border-u-danger/50 hover:text-u-danger">Reject Estimate</SmallButton>
                        </>
                      )}
                      {(e.status === 'Revision Requested' || e.status === 'Rejected' || e.status === 'Not Required') && (
                        <SmallButton onClick={() => setModal({ kind: 'estimate', req, estimate: e })}><Pencil size={11} /> Revise & Resubmit</SmallButton>
                      )}
                      {e.status === 'Approved' && (
                        <span className="flex items-center gap-1.5 text-[12px] text-u-ok"><CheckCircle2 size={13} /> Approved budget {fmtMoney(e.approvedBudget ?? e.total)}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'costs' && <CostsTab req={req} setModal={setModal} />}

        {tab === 'documents' && (
          <div>
            <SectionTitle icon={<Paperclip size={13} />} action={<PrimaryButton onClick={() => setModal({ kind: 'upload', req })} className="px-2.5 py-1.5 text-[12px]"><Plus size={13} /> Attach Documents</PrimaryButton>}>
              Photos & Documents
            </SectionTitle>
            {docs.length === 0 ? (
              <EmptyState icon={<Paperclip size={18} />} title="No documents attached" body="Attach issue photos, contractor estimates, invoices, receipts and before/after photos. Prototype uploads are session-only." />
            ) : (
              <div className="overflow-hidden rounded-xl border border-u-line">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-u-line bg-u-s2/60 text-left text-[11px] uppercase tracking-wider text-u-muted">
                      <th className="px-3.5 py-2 font-semibold">File</th>
                      <th className="px-3.5 py-2 font-semibold">Category</th>
                      <th className="px-3.5 py-2 font-semibold">Uploaded</th>
                      <th className="px-3.5 py-2 font-semibold">By</th>
                      <th className="px-3.5 py-2 text-right font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {docs.map((doc) => (
                      <tr key={doc.id} className="border-b border-u-line/50 bg-u-card last:border-0">
                        <td className="px-3.5 py-2.5">
                          <span className="flex items-center gap-2 text-[12.5px] font-medium text-u-ink">
                            <FileText size={14} className="shrink-0 text-u-muted" />
                            <span className="truncate">{doc.name}</span>
                            <span className="text-[11px] font-normal text-u-muted">{doc.size}</span>
                            {doc.mock && <Chip tone="amber">Session only</Chip>}
                          </span>
                        </td>
                        <td className="px-3.5 py-2.5 text-[12.5px] text-u-ink2">{doc.category}</td>
                        <td className="px-3.5 py-2.5 text-[12.5px] tabular text-u-ink2">{fmtDate(doc.uploadedAt)}</td>
                        <td className="px-3.5 py-2.5 text-[12.5px] text-u-ink2">{doc.uploadedBy}</td>
                        <td className="px-3.5 py-2.5">
                          <div className="flex justify-end gap-1">
                            <SmallButton
                              onClick={() => {
                                if (doc.url) window.open(doc.url, '_blank');
                                else s.toast('This is a sample file from the demo dataset — no preview is stored. Files you attach can be previewed during the session.', 'info');
                              }}
                            >
                              <Eye size={11} /> Preview
                            </SmallButton>
                            <SmallButton onClick={() => { s.removeAttachment(doc.id); s.toast(`Removed ${doc.name}.`); }} className="hover:border-u-danger/50 hover:text-u-danger">
                              <Trash2 size={11} />
                            </SmallButton>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {tab === 'activity' && (
          <div>
            <SectionTitle icon={<ActivityIcon size={13} />}>Activity History</SectionTitle>
            <div className="relative ml-2 space-y-0 border-l border-u-line pl-5">
              {activity.map((a) => (
                <div key={a.id} className="relative pb-4 last:pb-0">
                  <span className="absolute -left-[25.5px] top-1 h-2 w-2 rounded-full bg-u-accent/70 ring-4 ring-[var(--bg)]" />
                  <p className="text-[13px] text-u-ink">{a.description}</p>
                  <p className="mt-0.5 text-[11.5px] text-u-muted">{a.user} · {fmtDateTime(a.timestamp)} · {timeAgo(a.timestamp)}</p>
                </div>
              ))}
              {activity.length === 0 && <p className="py-4 text-[12.5px] text-u-muted">No activity recorded yet.</p>}
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!confirmCancelVisit}
        onClose={() => setConfirmCancelVisit(null)}
        title="Cancel this visit?"
        body={<>The visit “{confirmCancelVisit?.purpose}” on {fmtDate(confirmCancelVisit?.date)} will be marked as cancelled. The cancellation is recorded in the activity history.</>}
        confirmLabel="Cancel Visit"
        danger
        onConfirm={() => {
          if (confirmCancelVisit) {
            s.updateVisit(confirmCancelVisit.id, { status: 'Cancelled' }, `Visit cancelled: ${confirmCancelVisit.purpose}`);
            s.toast('Visit cancelled.', 'warning');
          }
        }}
      />
    </div>
  );
}

// ── Costs tab ────────────────────────────────────────────────────────────────

function CostsTab({ req, setModal }: { req: MaintenanceRequest; setModal: (m: ModalState) => void }) {
  const s = useStore();
  const est = s.estimatedCost(req);
  const actual = s.actualCost(req);
  const linked = req.linkedExpenseIds.map((id) => s.getExpense(id)).filter(Boolean);
  const remaining = req.approvedBudget !== undefined ? req.approvedBudget - actual : null;
  const varianceBase = req.approvedBudget ?? est;
  const variance = varianceBase !== undefined && varianceBase !== null ? actual - varianceBase : null;

  const cells = [
    { label: 'Estimated Cost', value: est !== null ? fmtMoney(est) : '—' },
    { label: 'Approved Budget', value: fmtMoney(req.approvedBudget) },
    { label: 'Actual Cost (linked)', value: fmtMoney(actual) },
    { label: 'Remaining Budget', value: remaining !== null ? fmtMoney(remaining) : '—', tone: remaining !== null && remaining < 0 ? 'text-u-danger' : 'text-u-ok' },
    { label: `Variance vs ${req.approvedBudget !== undefined ? 'budget' : 'estimate'}`, value: variance !== null ? `${variance > 0 ? '+' : ''}${fmtMoney(variance)}` : '—', tone: variance !== null && variance > 0 ? 'text-u-danger' : 'text-u-ink' },
  ];

  return (
    <div>
      <SectionTitle
        icon={<Banknote size={13} />}
        action={
          <div className="flex gap-1.5">
            <SmallButton onClick={() => setModal({ kind: 'expenses', req })}><Link2 size={12} /> Link Existing Expense</SmallButton>
            <PrimaryButton onClick={() => setModal({ kind: 'expenses', req })} className="px-2.5 py-1.5 text-[12px]"><Plus size={13} /> Create Expense Record</PrimaryButton>
          </div>
        }
      >
        Costs & Expenses
      </SectionTitle>
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-5">
        {cells.map((c) => (
          <div key={c.label} className="rounded-xl border border-u-line bg-u-card px-3.5 py-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-u-muted">{c.label}</p>
            <p className={cn('mt-1 text-[17px] font-semibold tabular text-u-ink', c.tone)}>{c.value}</p>
          </div>
        ))}
      </div>

      <h5 className="mb-2 mt-5 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wider text-u-ink2">
        <Receipt size={13} /> Linked Financial Records (Bills & Expenses)
      </h5>
      {linked.length === 0 ? (
        <EmptyState
          icon={<Receipt size={18} />}
          title="No expenses linked yet"
          body="Actual cost comes from linked invoices in Bills & Expenses — never entered twice. Link an existing invoice or create a new expense record."
          action={<PrimaryButton onClick={() => setModal({ kind: 'expenses', req })} className="px-3 py-2 text-[12px]">Link or Create Expense</PrimaryButton>}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-u-line">
          <table className="w-full">
            <thead>
              <tr className="border-b border-u-line bg-u-s2/60 text-left text-[11px] uppercase tracking-wider text-u-muted">
                <th className="px-3.5 py-2 font-semibold">Expense</th>
                <th className="px-3.5 py-2 font-semibold">Vendor</th>
                <th className="px-3.5 py-2 font-semibold">Category</th>
                <th className="px-3.5 py-2 font-semibold">Date</th>
                <th className="px-3.5 py-2 font-semibold">Payment</th>
                <th className="px-3.5 py-2 text-right font-semibold">Amount</th>
                <th className="px-3.5 py-2" />
              </tr>
            </thead>
            <tbody>
              {linked.map((e) => e && (
                <tr key={e.id} className="border-b border-u-line/50 bg-u-card last:border-0">
                  <td className="px-3.5 py-2.5">
                    <button onClick={() => s.navigate('bills')} className="text-left">
                      <span className="block text-[12.5px] font-medium text-u-accent hover:text-u-accent">{e.id} <ExternalLink size={10} className="inline" /></span>
                      <span className="block max-w-[320px] truncate text-[11.5px] text-u-muted">{e.description}</span>
                    </button>
                  </td>
                  <td className="px-3.5 py-2.5 text-[12.5px] text-u-ink2">{e.vendor}</td>
                  <td className="px-3.5 py-2.5 text-[12.5px] text-u-ink2">{e.category}</td>
                  <td className="px-3.5 py-2.5 text-[12.5px] tabular text-u-ink2">{fmtDate(e.date)}</td>
                  <td className="px-3.5 py-2.5">
                    <PaymentBadge status={e.paymentStatus} />
                    {e.paymentStatus === 'Partially Paid' && e.amountPaid !== undefined && <span className="block text-[11px] text-u-muted">{fmtMoney(e.amountPaid)} paid</span>}
                  </td>
                  <td className="px-3.5 py-2.5 text-right text-[13px] font-medium tabular text-u-ink">{fmtMoney(e.amount)}</td>
                  <td className="px-3.5 py-2.5">
                    <SmallButton onClick={() => { s.unlinkExpense(req.id, e.id); s.toast(`${e.id} unlinked (record kept in Bills & Expenses).`); }}>
                      <Unlink size={11} /> Unlink
                    </SmallButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-[11.5px] leading-relaxed text-u-muted">
        A quotation is an estimate, not an expense. Approving an estimate doesn't pay the bill, and recording an expense doesn't mean the contractor has been paid — payment status always comes from the linked record in Bills & Expenses. Each invoice is counted once.
      </p>
    </div>
  );
}

// ── Asset snapshot + repair-vs-replace ──────────────────────────────────────

function AssetSnapshot({ assetId, req, onReplace }: { assetId: string; req: MaintenanceRequest; onReplace: () => void }) {
  const s = useStore();
  const asset = s.getAsset(assetId);
  if (!asset) return null;
  const ws = warrantyState(asset);
  const age = assetAgeYears(asset);
  const history = s.assetRequests(asset.id);
  const spend = s.assetRepairSpend(asset.id);
  const repairEst = s.estimatedCost(req);
  const failures24mo = history.filter((h) => new Date(h.reportedAt).getTime() > Date.now() - 730 * 86400000).length;
  const repairVsValue = repairEst && asset.purchasePrice ? Math.round((repairEst / asset.purchasePrice) * 100) : null;
  const replacedBy = asset.replacedById ? s.getAsset(asset.replacedById) : undefined;

  return (
    <div>
      <SectionTitle icon={<Package size={13} />} action={<SmallButton onClick={() => s.navigate('assets', { focusAssetId: asset.id })}>Open Asset <ExternalLink size={11} /></SmallButton>}>
        Related Asset
      </SectionTitle>
      <div className="rounded-xl border border-u-line bg-u-card px-4 py-3.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13.5px] font-semibold text-u-ink">{asset.name}</span>
          <Chip tone="zinc">{asset.id}</Chip>
          <Chip tone={asset.status === 'Active' ? 'green' : asset.status === 'Under Repair' || asset.status === 'Under Inspection' ? 'amber' : 'zinc'}>{asset.status}</Chip>
        </div>
        <p className="mt-1 text-[12px] text-u-muted">{asset.brand} {asset.model} · {asset.type} · {asset.room ?? ''}</p>
        {replacedBy && (
          <p className="mt-2 rounded-lg border border-u-line bg-u-s2 px-2.5 py-1.5 text-[12px] text-u-ink2">
            Replaced by <button onClick={() => s.navigate('assets', { focusAssetId: replacedBy.id })} className="font-medium text-u-accent hover:text-u-accent">{replacedBy.id} · {replacedBy.name}</button> on {fmtDate(asset.replacementDate)}
          </p>
        )}
        <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-3">
          <DetailItem label="Age">{age !== null ? `${age.toFixed(1)} yrs` : '—'}<span className="block text-[11px] text-u-muted">bought {fmtDate(asset.purchaseDate)} · {fmtMoney(asset.purchasePrice)}</span></DetailItem>
          <DetailItem label="Condition">{asset.condition}</DetailItem>
          <DetailItem label="Warranty">
            {ws === 'active' && <span className="text-u-ok">Active → {fmtDate(asset.warrantyEnd)}</span>}
            {ws === 'expiring' && <span className="text-u-warn">Expires {fmtDate(asset.warrantyEnd)}</span>}
            {ws === 'expired' && <span className="text-u-danger">Expired {fmtDate(asset.warrantyEnd)}</span>}
            {ws === 'none' && 'None on record'}
          </DetailItem>
          <DetailItem label="Last Service">{fmtDate(asset.lastService)}</DetailItem>
        </dl>

        <div className="mt-3 border-t border-u-line pt-3">
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-u-ink2">
            <ShieldCheck size={12} /> Repair vs. Replace
          </p>
          <div className="space-y-1.5 text-[12.5px]">
            <div className="flex justify-between"><span className="text-u-muted">This repair (estimated)</span><b className="tabular text-u-ink">{repairEst !== null ? fmtMoney(repairEst) : '—'}</b></div>
            {repairVsValue !== null && <div className="flex justify-between"><span className="text-u-muted">Repair as % of purchase price</span><b className={cn('tabular', repairVsValue >= 50 ? 'text-u-warn' : 'text-u-ink')}>{repairVsValue}%</b></div>}
            <div className="flex justify-between"><span className="text-u-muted">Historical repair costs</span><b className="tabular text-u-ink">{fmtMoney(spend)}</b></div>
            <div className="flex justify-between"><span className="text-u-muted">Requests in last 24 months</span><b className="tabular text-u-ink">{failures24mo}</b></div>
            <div className="flex justify-between"><span className="text-u-muted">Lifetime requests</span><b className="tabular text-u-ink">{history.length}</b></div>
          </div>
          {ws === 'active' && (
            <p className="mt-2 rounded-lg border border-u-ok/25 bg-u-ok/5 px-2.5 py-1.5 text-[11.5px] text-u-ok">
              Under warranty until {fmtDate(asset.warrantyEnd)}{asset.warrantyProvider ? ` (${asset.warrantyProvider})` : ''} — check coverage before paying for parts.
            </p>
          )}
          {asset.status !== 'Replaced' && asset.status !== 'Disposed' && (
            <div className="mt-3 flex gap-1.5">
              <SmallButton onClick={onReplace} className="border-u-warn/40 text-u-warn hover:border-u-warn/70">Replace Appliance…</SmallButton>
              <SmallButton onClick={() => s.navigate('assets', { focusAssetId: asset.id })}>Full Service History</SmallButton>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
