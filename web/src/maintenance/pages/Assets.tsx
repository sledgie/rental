import { Fragment, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, ArrowRight, CalendarClock, ChevronDown, ExternalLink, FileText,
  History, MoreHorizontal, Package, Pencil, Plus, Receipt, RefreshCw, Search,
  ShieldCheck, Trash2, Upload, Wrench, X,
} from 'lucide-react';
import { useStore } from '../store';
import {
  Chip, DetailItem, EmptyState, GhostButton, Menu, PaymentBadge, PrimaryButton,
  PriorityBadge, SectionTitle, SelectInput, SmallButton, StatusBadge,
} from '../ui';
import { AssetFormModal, ReplaceApplianceModal, RequestFormModal } from '../modals';
import { ASSET_CONDITIONS, ASSET_STATUSES, ASSET_TYPES, type Asset } from '../types';
import { assetAgeYears, daysUntil, fmtDate, fmtMoney, warrantyState } from '../utils';
import { cn } from '../utils/cn';

export function conditionTone(c: string): 'green' | 'amber' | 'red' | 'zinc' | 'teal' {
  if (c === 'Excellent') return 'teal';
  if (c === 'Good') return 'green';
  if (c === 'Fair') return 'amber';
  return 'red';
}
export function statusTone(st: string): 'green' | 'amber' | 'red' | 'zinc' | 'sky' {
  if (st === 'Active') return 'green';
  if (st === 'Under Repair' || st === 'Under Inspection') return 'amber';
  return 'zinc';
}

export function AssetDetail({ asset, onEdit, onReplace, onNewRequest, onUpload }: { asset: Asset; onEdit: () => void; onReplace: () => void; onNewRequest: () => void; onUpload: () => void }) {
  const s = useStore();
  const requests = s.assetRequests(asset.id);
  const expenses = s.assetExpenses(asset.id);
  const docs = s.attachments.filter((d) => d.assetId === asset.id);
  const ws = warrantyState(asset);
  const replacedBy = asset.replacedById ? s.getAsset(asset.replacedById) : undefined;
  const replacedFrom = asset.replacedFromId ? s.getAsset(asset.replacedFromId) : undefined;
  const schedules = s.schedules.filter((sc) => sc.assetId === asset.id);

  return (
    <div className="animate-ap-slide-up">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h3 className="text-[15px] font-semibold text-u-ink">{asset.name}</h3>
        <Chip>{asset.id}</Chip>
        <Chip tone={statusTone(asset.status)}>{asset.status}</Chip>
        <Chip tone={conditionTone(asset.condition)}>{asset.condition}</Chip>
        {ws === 'expiring' && <Chip tone="amber"><AlertTriangle size={11} /> Warranty expires in {daysUntil(asset.warrantyEnd)} days</Chip>}
        <span className="ml-auto flex gap-1.5">
          <SmallButton onClick={onNewRequest}><Wrench size={12} /> New Request</SmallButton>
          <SmallButton onClick={onEdit}><Pencil size={12} /> Edit</SmallButton>
          {!['Replaced', 'Disposed', 'Retired'].includes(asset.status) && (
            <SmallButton onClick={onReplace} className="border-u-warn/40 text-u-warn hover:border-u-warn/70"><RefreshCw size={12} /> Replace Appliance</SmallButton>
          )}
        </span>
      </div>

      {(replacedBy || replacedFrom) && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-u-line bg-u-card px-4 py-3 text-[12.5px] text-u-ink2">
          <History size={14} className="text-u-muted" />
          {replacedFrom && (
            <span>
              This asset replaced <b className="text-u-ink">{replacedFrom.id} · {replacedFrom.name}</b> ({replacedFrom.brand} {replacedFrom.model}) on {fmtDate(replacedFrom.replacementDate)}.
              {replacedFrom.replacementReason && <span className="text-u-ink2"> Reason: {replacedFrom.replacementReason}</span>}
            </span>
          )}
          {replacedBy && (
            <span className="inline-flex items-center gap-1.5">
              Replaced by <b className="text-u-ink">{replacedBy.id} · {replacedBy.name}</b> on {fmtDate(asset.replacementDate)} <ArrowRight size={12} className="text-u-muted" />
              <button onClick={() => s.navigate('assets', { focusAssetId: replacedBy.id })} className="font-medium text-u-accent hover:text-u-accent">View current asset</button>
            </span>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div>
          <SectionTitle icon={<Package size={13} />}>Identification</SectionTitle>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-3.5 rounded-xl border border-u-line bg-u-card px-4 py-3.5">
            <DetailItem label="Asset ID">{asset.id}</DetailItem>
            <DetailItem label="Type">{asset.type}</DetailItem>
            <DetailItem label="Brand">{asset.brand ?? '—'}</DetailItem>
            <DetailItem label="Model">{asset.model ?? '—'}</DetailItem>
            <DetailItem label="Serial Number">{asset.serial ?? '—'}</DetailItem>
            <DetailItem label="Room">{asset.room ?? '—'}</DetailItem>
            <DetailItem label="Property">{s.getProperty(asset.propertyId)?.name}</DetailItem>
            <DetailItem label="Unit">{s.getUnit(asset.unitId)?.name ?? 'Property-level'}</DetailItem>
          </dl>
          <SectionTitle icon={<CalendarClock size={13} />}> <span className="ml-1">Condition & Lifecycle</span></SectionTitle>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-3.5 rounded-xl border border-u-line bg-u-card px-4 py-3.5">
            <DetailItem label="Condition">{asset.condition}</DetailItem>
            <DetailItem label="Age">{assetAgeYears(asset)?.toFixed(1) ?? '—'} yrs</DetailItem>
            <DetailItem label="Installed">{fmtDate(asset.installDate)}</DetailItem>
            <DetailItem label="Last Inspection">{fmtDate(asset.lastInspection)}</DetailItem>
            <DetailItem label="Last Service">{fmtDate(asset.lastService)}</DetailItem>
            <DetailItem label="Next Service">{fmtDate(asset.nextService)}</DetailItem>
            {asset.retiredDate && <DetailItem label="Retired">{fmtDate(asset.retiredDate)}</DetailItem>}
            {asset.disposalNotes && <DetailItem label="Disposal Notes" className="col-span-2">{asset.disposalNotes}</DetailItem>}
          </dl>
          {schedules.length > 0 && (
            <>
              <SectionTitle icon={<CalendarClock size={13} />}> <span className="ml-1">Preventive Schedules</span></SectionTitle>
              <div className="space-y-2">
                {schedules.map((sc) => (
                  <button key={sc.id} onClick={() => s.navigate('preventive')} className="flex w-full items-center justify-between rounded-xl border border-u-line bg-u-card px-3.5 py-2.5 text-left transition hover:border-u-line2">
                    <span>
                      <span className="block text-[12.5px] font-medium text-u-ink">{sc.task}</span>
                      <span className="text-[11px] text-u-muted">{sc.frequency} · next due {fmtDate(sc.nextDue)}</span>
                    </span>
                    <ExternalLink size={12} className="text-u-muted" />
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <div>
          <SectionTitle icon={<ShieldCheck size={13} />}>Purchase & Warranty</SectionTitle>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-3.5 rounded-xl border border-u-line bg-u-card px-4 py-3.5">
            <DetailItem label="Purchase Date">{fmtDate(asset.purchaseDate)}</DetailItem>
            <DetailItem label="Purchase Price">{fmtMoney(asset.purchasePrice)}</DetailItem>
            <DetailItem label="Supplier">{asset.supplier ?? '—'}</DetailItem>
            <DetailItem label="Warranty Provider">{asset.warrantyProvider ?? '—'}</DetailItem>
            <DetailItem label="Warranty Start">{fmtDate(asset.warrantyStart)}</DetailItem>
            <DetailItem label="Warranty Expiry">
              {fmtDate(asset.warrantyEnd)}
              {ws === 'active' && <span className="ml-1.5 text-[11px] font-medium text-u-ok">ACTIVE</span>}
              {ws === 'expiring' && <span className="ml-1.5 text-[11px] font-medium text-u-warn">EXPIRING</span>}
              {ws === 'expired' && <span className="ml-1.5 text-[11px] font-medium text-u-danger">EXPIRED</span>}
            </DetailItem>
            <DetailItem label="Warranty Reference">{asset.warrantyRef ?? '—'}</DetailItem>
            <DetailItem label="Coverage Notes">{asset.warrantyNotes ?? '—'}</DetailItem>
            <DetailItem label="Lifetime Repair Costs"><span className="font-semibold tabular">{fmtMoney(s.assetRepairSpend(asset.id))}</span></DetailItem>
            <DetailItem label="Linked Requests">{requests.length}</DetailItem>
          </dl>

          <SectionTitle icon={<FileText size={13} />} action={<SmallButton onClick={onUpload}><Upload size={12} /> Upload</SmallButton>}>Documents ({docs.length})</SectionTitle>
          <div className="rounded-xl border border-u-line bg-u-card px-4 py-3">
            {docs.length === 0 ? (
              <p className="text-[12.5px] text-u-muted">No documents on file. Upload the purchase receipt, warranty print-out or manual.</p>
            ) : docs.map((d) => (
              <div key={d.id} className="flex items-center justify-between gap-2 py-1.5 text-[12.5px]">
                <span className="flex min-w-0 items-center gap-2 text-u-ink">
                  <FileText size={13} className="shrink-0 text-u-muted" />
                  {d.url || d.path ? <button type="button" onClick={() => s.openAttachment(d)} className="truncate text-u-accent hover:underline">{d.name}</button> : <span className="truncate">{d.name}</span>}
                </span>
                <span className="flex shrink-0 items-center gap-2 text-[11px] text-u-muted">
                  {d.category} · {d.size} · {fmtDate(d.uploadedAt)}
                  <button onClick={() => s.removeAttachment(d.id)} className="text-u-muted transition hover:text-u-danger" aria-label={`Remove ${d.name}`}><Trash2 size={12} /></button>
                </span>
              </div>
            ))}
          </div>

          <SectionTitle icon={<Receipt size={13} />}> <span className="ml-1">Related Expenses</span></SectionTitle>
          <div className="space-y-2">
            {expenses.length === 0 && <p className="rounded-xl border border-u-line bg-u-card px-4 py-3 text-[12.5px] text-u-muted">No expenses recorded against this asset.</p>}
            {expenses.map((e) => (
              <div key={e.id} className="flex items-center justify-between gap-2 rounded-xl border border-u-line bg-u-card px-3.5 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-[12.5px] font-medium text-u-ink">{e.description}</p>
                  <p className="text-[11px] text-u-muted">{e.id} · {fmtDate(e.date)} · {e.category}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <PaymentBadge status={e.paymentStatus} />
                  <span className="text-[12.5px] font-semibold tabular text-u-ink">{fmtMoney(e.amount)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <SectionTitle icon={<Wrench size={13} />}>Service & Repair History</SectionTitle>
          {requests.length === 0 ? (
            <p className="rounded-xl border border-u-line bg-u-card px-4 py-3 text-[12.5px] text-u-muted">No maintenance requests linked to this asset yet.</p>
          ) : (
            <div className="space-y-2">
              {requests.map((r) => (
                <button
                  key={r.id}
                  onClick={() => s.navigate('requests', { focusRequestId: r.id })}
                  className="w-full rounded-xl border border-u-line bg-u-card px-3.5 py-3 text-left transition hover:border-u-line2"
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-[12.5px] font-medium text-u-ink">{r.title}</span>
                    <StatusBadge status={r.status} />
                  </span>
                  <span className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-u-muted">
                    <span>{r.id}</span>
                    <PriorityBadge priority={r.priority} />
                    <span>Reported {fmtDate(r.reportedAt)}</span>
                    {s.actualCost(r) > 0 && <span className="tabular text-u-ink2">Cost {fmtMoney(s.actualCost(r))}</span>}
                    {r.resolutionOutcome && <span>Outcome: {r.resolutionOutcome}</span>}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
