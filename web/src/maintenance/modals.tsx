import { isSupabaseConfigured } from '../lib/supabase';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, Building2, CheckCircle2, ClipboardList, FileUp,
  Info, Link2, Plus, RefreshCw, Replace, Search, UserCheck, Wrench, X,
} from 'lucide-react';
import { useStore } from './store';
import {
  DrawerSection, Field, FormDrawer, FormError, FormSection, GhostButton, Modal, MoneyInput, PaymentBadge, PrimaryButton,
  SelectInput, TextArea, TextInput, Chip,
} from './ui';
import {
  ASSET_CONDITIONS, ASSET_STATUSES, ASSET_TYPES, CATEGORIES,
  ASSET_DOC_CATEGORIES, DOC_CATEGORIES, EXPENSE_CATEGORIES, FREQUENCIES, PRIORITIES, RESOLUTION_OUTCOMES,
  SOURCES, SUBCATEGORIES, VISIT_OUTCOMES, WORKORDER_STATUSES,
} from './types';
import type {
  Asset, Estimate, MaintenanceRequest, PreventiveSchedule, Priority,
  RequestStatus, Visit, WorkOrder,
} from './types';
import { assetAgeYears, fileSize, fmtDate, fmtMoney, nowISO, todayISO, uid, warrantyState } from './utils';
import { cn } from './utils/cn';

const num = (v: string) => {
  const n = parseFloat(v);
  return Number.isNaN(n) ? 0 : n;
};

interface StagedFile {
  name: string;
  size: string;
  url?: string;
  file?: File;
}

function stageFiles(files: FileList | null): StagedFile[] {
  if (!files) return [];
  return Array.from(files).map((f) => ({ name: f.name, size: fileSize(f.size), url: URL.createObjectURL(f), file: f }));
}


// Multi-file picker for asset documents (receipts, warranty print-outs, manuals ...): each staged file carries its own category.
interface StagedDoc extends StagedFile { category: string }
const guessDocCategory = (name: string) =>
  /warrant/i.test(name) ? 'Warranty Document' : /receipt/i.test(name) ? 'Receipt' : /invoice/i.test(name) ? 'Invoice' : /manual|guide/i.test(name) ? 'Manual / Guide' : /\.(png|jpe?g|webp|heic)$/i.test(name) ? 'Photo' : 'Receipt';

function AssetDocsField({ docs, onChange }: { docs: StagedDoc[]; onChange: (d: StagedDoc[]) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const add = (list: FileList | null) => onChange([...docs, ...stageFiles(list).map((f) => ({ ...f, category: guessDocCategory(f.name) }))]);
  return (
    <div className="space-y-2.5">
      <button
        type="button"
        onClick={() => ref.current?.click()}
        className="flex w-full flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-u-line bg-u-s2/50 px-4 py-6 text-u-ink2 transition hover:border-u-accent/50 hover:text-u-ink"
      >
        <FileUp size={22} />
        <span className="text-[13px] font-medium">Click to choose receipts, warranty print-outs, manuals or photos</span>
        <span className="text-[11.5px] text-u-muted">Multiple files supported. Pick a category for each file.</span>
      </button>
      <input ref={ref} type="file" multiple className="hidden" onChange={(e) => { add(e.target.files); e.target.value = ''; }} />
      {docs.map((d, i) => (
        <div key={i} className="flex items-center gap-2 rounded-lg border border-u-line bg-u-s2 px-3 py-1.5 text-[12px] text-u-ink2">
          <span className="min-w-0 flex-1 truncate">{d.name} <span className="text-u-muted">· {d.size}</span></span>
          <select value={d.category} onChange={(e) => onChange(docs.map((x, j) => (j === i ? { ...x, category: e.target.value } : x)))} className="rounded-md border border-u-line bg-u-card px-2 py-1 text-[11.5px] text-u-ink outline-none">
            {ASSET_DOC_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <button type="button" onClick={() => onChange(docs.filter((_, x) => x !== i))} className="text-u-muted hover:text-u-danger" aria-label={`Remove ${d.name}`}><X size={13} /></button>
        </div>
      ))}
    </div>
  );
}

function saveAssetDocs(s: ReturnType<typeof useStore>, assetId: string, docs: StagedDoc[]) {
  docs.forEach((d) => s.addAttachment({ id: uid('AT'), assetId, name: d.name, category: d.category, size: d.size, uploadedBy: s.currentUser.name, uploadedAt: nowISO(), url: d.url, mock: true }, d.file));
}

// ═════════════════════════════════════════════════════════════════════════════
// New / Edit Maintenance Request
// ═════════════════════════════════════════════════════════════════════════════

export interface RequestPreset {
  propertyId?: string;
  unitId?: string;
  assetId?: string;
  title?: string;
  category?: string;
  source?: string;
  description?: string;
}

export function RequestFormModal({
  open, onClose, editing, preset, onSaved,
}: {
  open: boolean;
  onClose: () => void;
  editing?: MaintenanceRequest | null;
  preset?: RequestPreset;
  onSaved?: (id: string) => void;
}) {
  const s = useStore();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [subcategory, setSubcategory] = useState('');
  const [priority, setPriority] = useState<Priority>('Normal');
  const [reportedDate, setReportedDate] = useState(todayISO());
  const [preferredDate, setPreferredDate] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [source, setSource] = useState('Tenant');
  const [reportedByName, setReportedByName] = useState('');
  const [initialStatus, setInitialStatus] = useState<RequestStatus>('New');
  const [internalNotes, setInternalNotes] = useState('');
  const [propertyId, setPropertyId] = useState('');
  const [unitId, setUnitId] = useState('');
  const [room, setRoom] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [accessInstructions, setAccessInstructions] = useState('');
  const [hasAsset, setHasAsset] = useState(false);
  const [assetId, setAssetId] = useState('');
  const [newAsset, setNewAsset] = useState({ name: '', type: 'Other Equipment', brand: '', model: '' });
  const [createAsset, setCreateAsset] = useState(false);
  const [staffId, setStaffId] = useState('');
  const [contractorId, setContractorId] = useState('');
  const [apptDate, setApptDate] = useState('');
  const [apptTime, setApptTime] = useState('09:00');
  const [contractorNotes, setContractorNotes] = useState('');
  const [docCategory, setDocCategory] = useState('Initial Issue Photo');
  const [files, setFiles] = useState<StagedFile[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setFiles([]);
    if (editing) {
      setTitle(editing.title); setDescription(editing.description); setCategory(editing.category);
      setSubcategory(editing.subcategory ?? ''); setPriority(editing.priority);
      setReportedDate(editing.reportedAt.slice(0, 10)); setPreferredDate(editing.preferredDate ?? '');
      setTargetDate(editing.targetDate ?? ''); setSource(editing.source);
      setReportedByName(editing.reportedByName); setInternalNotes(editing.internalNotes ?? '');
      setPropertyId(editing.propertyId); setUnitId(editing.unitId ?? ''); setRoom(editing.room ?? '');
      setTenantId(editing.tenantId ?? ''); setAccessInstructions(editing.accessInstructions ?? '');
      setHasAsset(!!editing.assetId); setAssetId(editing.assetId ?? ''); setCreateAsset(false);
      setStaffId(editing.assignedStaffId ?? ''); setContractorId(editing.assignedContractorId ?? '');
      setContractorNotes(editing.contractorNotes ?? ''); setApptDate(''); 
    } else {
      setTitle(preset?.title ?? ''); setDescription(preset?.description ?? '');
      setCategory(preset?.category ?? ''); setSubcategory(''); setPriority('Normal');
      setReportedDate(todayISO()); setPreferredDate(''); setTargetDate('');
      setSource(preset?.source ?? 'Tenant'); setReportedByName(''); setInitialStatus('New');
      setInternalNotes(''); setPropertyId(preset?.propertyId ?? ''); setUnitId(preset?.unitId ?? '');
      setRoom(''); setTenantId(''); setAccessInstructions('');
      setHasAsset(!!preset?.assetId); setAssetId(preset?.assetId ?? ''); setCreateAsset(false);
      setStaffId(s.currentUser.id); setContractorId(''); setContractorNotes(''); setApptDate('');
      setNewAsset({ name: '', type: 'Other Equipment', brand: '', model: '' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing?.id]);

  const units = propertyId ? s.unitsForProperty(propertyId) : [];
  const lease = unitId ? s.leaseForUnit(unitId) : undefined;
  const leaseTenant = lease ? s.getTenant(lease.tenantId) : undefined;
  const propertyAssets = s.assets.filter(
    (a) => a.propertyId === propertyId && a.status !== 'Replaced' && a.status !== 'Disposed' && (!unitId || !a.unitId || a.unitId === unitId)
  );
  const selectedAsset = s.getAsset(assetId);

  useEffect(() => {
    if (lease && !editing) setTenantId(lease.tenantId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lease?.id]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!title.trim()) e.title = 'A title is required.';
    if (!description.trim()) e.description = 'Describe the issue.';
    if (!category) e.category = 'Select a category.';
    if (!propertyId) e.propertyId = 'Select a property.';
    if (hasAsset && createAsset && !newAsset.name.trim()) e.newAsset = 'Give the new asset a name.';
    if (targetDate && reportedDate && targetDate < reportedDate) e.targetDate = 'Target date cannot be before the reported date.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const save = (mode: 'draft' | 'create' | 'createAssign') => {
    if (!validate()) return;
    const finalTenantId = tenantId || undefined;
    const finalLeaseId = lease?.id;
    const reporterName = reportedByName.trim() || (finalTenantId ? s.getTenant(finalTenantId)?.name : undefined) || s.currentUser.name;

    let finalAssetId = hasAsset ? assetId || undefined : undefined;
    if (hasAsset && createAsset) {
      finalAssetId = s.nextAssetId();
      s.addAsset({
        id: finalAssetId, name: newAsset.name.trim(), type: newAsset.type, propertyId,
        unitId: unitId || undefined, room: room || undefined, brand: newAsset.brand || undefined,
        model: newAsset.model || undefined, condition: 'Fair', status: 'Under Inspection',
      });
    }

    const status: RequestStatus = editing
      ? editing.status
      : mode === 'draft'
        ? 'Draft'
        : mode === 'createAssign' && contractorId
          ? 'Assigned'
          : initialStatus;

    const base = {
      title: title.trim(), description: description.trim(), category,
      subcategory: subcategory || undefined, priority, propertyId,
      unitId: unitId || undefined, room: room || undefined,
      tenantId: finalTenantId, leaseId: finalLeaseId, assetId: finalAssetId,
      reportedByName: reporterName, reportedByRole: source, source,
      preferredDate: preferredDate || undefined, targetDate: targetDate || undefined,
      internalNotes: internalNotes || undefined, accessInstructions: accessInstructions || undefined,
      assignedStaffId: staffId || undefined,
      assignedContractorId: contractorId || undefined,
      contractorNotes: contractorNotes || undefined,
    };

    if (editing) {
      s.updateRequest(editing.id, base, 'Request details updated');
      s.toast(`${editing.id} updated.`);
      onSaved?.(editing.id);
      onClose();
      return;
    }

    const id = s.nextRequestId();
    const req: MaintenanceRequest = {
      id, ...base, status,
      reportedAt: new Date(reportedDate + 'T' + new Date().toTimeString().slice(0, 8)).toISOString(),
      assignedAt: contractorId ? nowISO() : undefined,
      approvalStatus: 'Not Required', linkedExpenseIds: [], previousCompletions: [],
      createdBy: s.currentUser.name,
    };
    s.addRequest(req, `Request created${mode === 'draft' ? ' as draft' : ''} (source: ${source})`);
    if (files.length) {
      files.forEach((f) =>
        s.addAttachment({
          id: uid('AT'), requestId: id, name: f.name, category: docCategory, size: f.size,
          uploadedBy: s.currentUser.name, uploadedAt: nowISO(), url: f.url, mock: true,
        }, f.file)
      );
    }
    if (apptDate && contractorId) {
      s.addVisit({
        id: uid('V'), requestId: id, contractorId, purpose: 'Initial visit',
        date: apptDate, time: apptTime, durationMins: 60, status: 'Scheduled',
        accessArrangements: accessInstructions || undefined,
      });
    }
    s.toast(mode === 'draft' ? `Draft ${id} saved.` : `Request ${id} created${status === 'Assigned' ? ' and assigned' : ''}.`);
    onSaved?.(id);
    onClose();
  };

  return (
    <FormDrawer
      open={open}
      onClose={onClose}
      title={editing ? `Edit request ${editing.id}` : 'New maintenance request'}
      note={editing ? undefined : <>Will be created as <span className="u-num">{s.nextRequestId()}</span></>}
      subtitle={editing ? 'Changes are recorded in the activity history.' : 'Log an issue, locate it, and optionally assign it right away.'}
      footer={
        <>
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          {editing ? (
            <PrimaryButton onClick={() => save('create')}>Save Changes</PrimaryButton>
          ) : (
            <>
              <GhostButton onClick={() => save('draft')}>Save as Draft</GhostButton>
              <GhostButton onClick={() => save('create')}>Create Request</GhostButton>
              <PrimaryButton onClick={() => save('createAssign')}>Create & Assign</PrimaryButton>
            </>
          )}
        </>
      }
    >
      <div className="space-y-4">
        <DrawerSection step="A" title="Issue information" note="What is wrong">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Request Title" required error={errors.title} className="sm:col-span-2">
              <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Refrigerator not cooling" />
            </Field>
            <Field label="Description" required error={errors.description} className="sm:col-span-2">
              <TextArea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the problem, when it started, and any troubleshooting already done…" />
            </Field>
            <Field label="Category" required error={errors.category}>
              <SelectInput value={category} onChange={(e) => { setCategory(e.target.value); setSubcategory(''); }}>
                <option value="">Select category…</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </SelectInput>
            </Field>
            <Field label="Subcategory">
              <SelectInput value={subcategory} onChange={(e) => setSubcategory(e.target.value)} disabled={!category}>
 <option value="">—</option>
                {(SUBCATEGORIES[category] ?? []).map((c) => <option key={c} value={c}>{c}</option>)}
              </SelectInput>
            </Field>
            <Field label="Priority" required>
              <div className="flex gap-1.5">
                {PRIORITIES.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    className={cn(
                      'flex-1 rounded-lg border px-2 py-2 text-[12px] font-medium transition',
                      priority === p
                        ? p === 'Emergency'
                          ? 'border-u-danger/60 bg-u-danger/15 text-u-danger'
                          : 'border-u-accent/60 bg-u-accent/10 text-u-accent'
                        : 'border-u-line bg-u-s2 text-u-ink2 hover:text-u-ink'
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Source">
              <SelectInput value={source} onChange={(e) => setSource(e.target.value)}>
                {SOURCES.map((x) => <option key={x} value={x}>{x}</option>)}
              </SelectInput>
            </Field>
            <Field label="Reported By (name)">
              <TextInput value={reportedByName} onChange={(e) => setReportedByName(e.target.value)} placeholder={leaseTenant ? leaseTenant.name : 'Name of reporter'} />
            </Field>
            <Field label="Reported Date">
              <TextInput type="date" value={reportedDate} onChange={(e) => setReportedDate(e.target.value)} />
            </Field>
            <Field label="Preferred Completion Date">
              <TextInput type="date" value={preferredDate} onChange={(e) => setPreferredDate(e.target.value)} />
            </Field>
            <Field label="Target Completion Date" error={errors.targetDate}>
              <TextInput type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
            </Field>
            {!editing && (
              <Field label="Initial Status">
                <SelectInput value={initialStatus} onChange={(e) => setInitialStatus(e.target.value as RequestStatus)}>
                  <option value="New">New</option>
                  <option value="Under Review">Under Review</option>
                  <option value="Draft">Draft</option>
                </SelectInput>
              </Field>
            )}
            <Field label="Internal Notes" className={!editing ? '' : 'sm:col-span-2'}>
              <TextInput value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} placeholder="Visible to staff only" />
            </Field>
          </div>
          {priority === 'Emergency' && (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-u-danger/30 bg-u-danger/10 px-3 py-2 text-[12px] text-u-danger">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              Emergency priority — target first response within {s.settings.emergencyResponseHours} hours (configurable in Settings). This request will be pinned to the top of the queue.
            </div>
          )}
        </DrawerSection>

        <DrawerSection step="B" title="Location" note="Where it is">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Property" required error={errors.propertyId}>
              <SelectInput value={propertyId} onChange={(e) => { setPropertyId(e.target.value); setUnitId(''); setAssetId(''); }}>
                <option value="">Select property…</option>
                {s.properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </SelectInput>
            </Field>
            <Field label="Unit" hint="Leave blank for common areas or property-level equipment.">
              <SelectInput value={unitId} onChange={(e) => setUnitId(e.target.value)} disabled={!propertyId}>
                <option value="">Common area / whole property</option>
                {units.map((u) => <option key={u.id} value={u.id}>{u.name} · {u.beds}bd · {u.status}</option>)}
              </SelectInput>
            </Field>
            <Field label="Room / Location">
              <TextInput value={room} onChange={(e) => setRoom(e.target.value)} placeholder="e.g. Kitchen, Basement, Hallway" />
            </Field>
            <Field label="Related Tenant">
              <SelectInput value={tenantId} onChange={(e) => setTenantId(e.target.value)}>
                <option value="">— None —</option>
                {s.tenants.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </SelectInput>
            </Field>
            <Field label="Access Instructions" className="sm:col-span-2">
              <TextInput value={accessInstructions} onChange={(e) => setAccessInstructions(e.target.value)} placeholder="Lock box, gate code, tenant availability…" />
            </Field>
          </div>
          {lease && leaseTenant && (
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-u-accent/20 bg-u-accent/5 px-3 py-2 text-[12px] text-u-ink2">
              <span className="font-medium text-u-accent">Active lease found</span>
              <span>Tenant: <b className="text-u-ink">{leaseTenant.name}</b></span>
              <span>Lease {lease.id}: {fmtDate(lease.start)} → {fmtDate(lease.end)}</span>
              <span>Rent {fmtMoney(lease.rent)}/mo</span>
            </div>
          )}
        </DrawerSection>

        <DrawerSection step="C" title="Appliance / equipment" note="Optional">
          <div className="flex items-center gap-2">
            <span className="text-[12.5px] text-u-ink2">Is this request related to an appliance or equipment?</span>
            {(['No', 'Yes'] as const).map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setHasAsset(opt === 'Yes')}
                className={cn(
                  'rounded-lg border px-3 py-1.5 text-[12px] font-medium transition',
                  (opt === 'Yes') === hasAsset ? 'border-u-accent/60 bg-u-accent/10 text-u-accent' : 'border-u-line bg-u-s2 text-u-ink2'
                )}
              >
                {opt}
              </button>
            ))}
          </div>
          {hasAsset && (
            <div className="mt-3 space-y-3">
              {!createAsset ? (
                <>
                  <Field label="Select Existing Asset">
                    <SelectInput value={assetId} onChange={(e) => setAssetId(e.target.value)} disabled={!propertyId}>
                      <option value="">{propertyId ? 'Select asset…' : 'Select a property first'}</option>
                      {propertyAssets.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.id} · {a.name}{a.brand ? ` (${a.brand})` : ''}{a.unitId ? ` · ${s.getUnit(a.unitId)?.name ?? ''}` : ''}
                        </option>
                      ))}
                    </SelectInput>
                  </Field>
                  {selectedAsset && (
                    <div className="rounded-lg border border-u-line bg-u-card px-3 py-2.5 text-[12px] text-u-ink2">
                      <div className="flex flex-wrap gap-x-4 gap-y-1">
                        <span><b className="text-u-ink">{selectedAsset.name}</b> · {selectedAsset.brand} {selectedAsset.model}</span>
                        <span>Age: {assetAgeYears(selectedAsset)?.toFixed(1) ?? '—'} yrs</span>
                        <span>Condition: {selectedAsset.condition}</span>
                        <span>
                          Warranty:{' '}
                          {warrantyState(selectedAsset) === 'active' ? <span className="text-u-ok">Active until {fmtDate(selectedAsset.warrantyEnd)}</span>
                            : warrantyState(selectedAsset) === 'expiring' ? <span className="text-u-warn">Expiring {fmtDate(selectedAsset.warrantyEnd)}</span>
                            : warrantyState(selectedAsset) === 'expired' ? <span className="text-u-danger">Expired {fmtDate(selectedAsset.warrantyEnd)}</span>
                            : 'None on record'}
                        </span>
                        <span>Recorded repair costs: {fmtMoney(s.assetRepairSpend(selectedAsset.id))}</span>
                      </div>
                    </div>
                  )}
                  <button type="button" onClick={() => setCreateAsset(true)} className="text-[12px] font-medium text-u-accent hover:text-u-accent">
                    Asset not listed? Create a new asset record →
                  </button>
                </>
              ) : (
                <div className="rounded-lg border border-u-line bg-u-card p-3">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Field label="Asset Name" required error={errors.newAsset}>
                      <TextInput value={newAsset.name} onChange={(e) => setNewAsset({ ...newAsset, name: e.target.value })} placeholder="e.g. Kitchen Refrigerator" />
                    </Field>
                    <Field label="Asset Type">
                      <SelectInput value={newAsset.type} onChange={(e) => setNewAsset({ ...newAsset, type: e.target.value })}>
                        {ASSET_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                      </SelectInput>
                    </Field>
                    <Field label="Brand">
                      <TextInput value={newAsset.brand} onChange={(e) => setNewAsset({ ...newAsset, brand: e.target.value })} />
                    </Field>
                    <Field label="Model">
                      <TextInput value={newAsset.model} onChange={(e) => setNewAsset({ ...newAsset, model: e.target.value })} />
                    </Field>
                  </div>
                  <button type="button" onClick={() => setCreateAsset(false)} className="mt-2 text-[12px] font-medium text-u-ink2 hover:text-u-ink">
                    ← Back to existing assets
                  </button>
                </div>
              )}
            </div>
          )}
        </DrawerSection>

        <DrawerSection step="D" title="Assignment" note="Optional">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Assigned Staff">
              <SelectInput value={staffId} onChange={(e) => setStaffId(e.target.value)}>
                <option value="">Unassigned</option>
                {s.staff.map((m) => <option key={m.id} value={m.id}>{m.name} — {m.role}</option>)}
              </SelectInput>
            </Field>
            <Field label="Contractor / Company">
              <SelectInput value={contractorId} onChange={(e) => setContractorId(e.target.value)}>
                <option value="">Assign later</option>
                {s.contractors.filter((c) => c.active).map((c) => <option key={c.id} value={c.id}>{c.company}</option>)}
              </SelectInput>
            </Field>
            <Field label="Preferred Appointment Date">
              <TextInput type="date" value={apptDate} onChange={(e) => setApptDate(e.target.value)} />
            </Field>
            <Field label="Appointment Time">
              <TextInput type="time" value={apptTime} onChange={(e) => setApptTime(e.target.value)} />
            </Field>
            <Field label="Notes for Contractor" className="sm:col-span-2">
              <TextInput value={contractorNotes} onChange={(e) => setContractorNotes(e.target.value)} placeholder="Anything the contractor should know or bring" />
            </Field>
          </div>
        </DrawerSection>

        {!editing && (
          <DrawerSection step="E" title="Attachments" note="Optional">
            <div className="flex flex-wrap items-end gap-3">
              <Field label="Document Category" className="w-56">
                <SelectInput value={docCategory} onChange={(e) => setDocCategory(e.target.value)}>
                  {DOC_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </SelectInput>
              </Field>
              <GhostButton onClick={() => fileRef.current?.click()}>
                <FileUp size={14} /> Add Photos / Documents
              </GhostButton>
              <input
                ref={fileRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => { setFiles((f) => [...f, ...stageFiles(e.target.files)]); e.target.value = ''; }}
              />
            </div>
            {files.length > 0 && (
              <ul className="mt-3 space-y-1.5">
                {files.map((f, i) => (
                  <li key={i} className="flex items-center justify-between rounded-lg border border-u-line bg-u-card px-3 py-1.5 text-[12px] text-u-ink2">
                    <span className="truncate">{f.name} <span className="text-u-muted">· {f.size}</span></span>
                    <button type="button" onClick={() => setFiles(files.filter((_, x) => x !== i))} className="text-u-muted hover:text-u-danger"><X size={13} /></button>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 flex items-center gap-1.5 text-[11px] text-u-muted">
              <Info size={12} /> {isSupabaseConfigured ? 'Files are stored securely and only visible to your team.' : 'Prototype upload: files are referenced locally for this session only and are not stored on a server.'}
            </p>
          </DrawerSection>
        )}
      </div>
    </FormDrawer>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Assign staff / contractor
// ═════════════════════════════════════════════════════════════════════════════

export function AssignModal({ open, onClose, request }: { open: boolean; onClose: () => void; request: MaintenanceRequest | null }) {
  const s = useStore();
  const [staffId, setStaffId] = useState('');
  const [contractorId, setContractorId] = useState('');
  const [notes, setNotes] = useState('');
  const [markAssigned, setMarkAssigned] = useState(true);
  const [adding, setAdding] = useState(false);
  const [nc, setNc] = useState({ company: '', contact: '', phone: '', email: '', category: 'General Repairs' });

  useEffect(() => {
    if (!open || !request) return;
    setStaffId(request.assignedStaffId ?? '');
    setContractorId(request.assignedContractorId ?? '');
    setNotes(request.contractorNotes ?? '');
    setMarkAssigned(true);
    setAdding(false);
  }, [open, request?.id]);

  if (!request) return null;

  const save = () => {
    let cid = contractorId;
    if (adding && nc.company.trim()) {
      cid = uid('C');
      s.addContractor({ id: cid, company: nc.company.trim(), contact: nc.contact || '—', phone: nc.phone, email: nc.email, categories: [nc.category], active: true });
    }
    const patch: Partial<MaintenanceRequest> = {
      assignedStaffId: staffId || undefined,
      assignedContractorId: cid || undefined,
      contractorNotes: notes || undefined,
      assignedAt: nowISO(),
    };
    const who = [
      cid ? s.contractors.find((c) => c.id === cid)?.company ?? nc.company : null,
      staffId ? s.getStaff(staffId)?.name : null,
    ].filter(Boolean).join(' · ');
    if (markAssigned && ['New', 'Under Review', 'Approved', 'On Hold', 'Draft'].includes(request.status)) {
      s.setRequestStatus(request.id, 'Assigned', { extra: patch, silent: true });
      s.logActivity(request.id, 'assignment', `Assigned to ${who || '—'} (status → Assigned)`);
    } else {
      s.updateRequest(request.id, patch, `Assignment updated: ${who || 'unassigned'}`, 'assignment');
    }
    s.toast(`Assignment saved for ${request.id}.`);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Assign — ${request.id}`}
      subtitle={request.title}
      footer={
        <>
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton onClick={save}>Save Assignment</PrimaryButton>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Assigned Staff (Coordinator)">
          <SelectInput value={staffId} onChange={(e) => setStaffId(e.target.value)}>
            <option value="">Unassigned</option>
            {s.staff.map((m) => <option key={m.id} value={m.id}>{m.name} — {m.role}</option>)}
          </SelectInput>
        </Field>
        {!adding ? (
          <Field label="Contractor / Company">
            <SelectInput value={contractorId} onChange={(e) => setContractorId(e.target.value)}>
              <option value="">In-house / not yet assigned</option>
              {s.contractors.filter((c) => c.active).map((c) => (
                <option key={c.id} value={c.id}>{c.company} — {c.categories.join(', ')}</option>
              ))}
            </SelectInput>
            <button type="button" onClick={() => setAdding(true)} className="mt-1.5 text-[12px] font-medium text-u-accent hover:text-u-accent">
              + Add a new contractor
            </button>
          </Field>
        ) : (
          <div className="rounded-xl border border-u-line bg-u-s2/60 p-3">
            <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-u-ink2">New Contractor</p>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <Field label="Company Name" required><TextInput value={nc.company} onChange={(e) => setNc({ ...nc, company: e.target.value })} /></Field>
              <Field label="Contact Person"><TextInput value={nc.contact} onChange={(e) => setNc({ ...nc, contact: e.target.value })} /></Field>
              <Field label="Phone"><TextInput value={nc.phone} onChange={(e) => setNc({ ...nc, phone: e.target.value })} /></Field>
              <Field label="Email"><TextInput value={nc.email} onChange={(e) => setNc({ ...nc, email: e.target.value })} /></Field>
              <Field label="Service Category" className="sm:col-span-2">
                <SelectInput value={nc.category} onChange={(e) => setNc({ ...nc, category: e.target.value })}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </SelectInput>
              </Field>
            </div>
            <button type="button" onClick={() => setAdding(false)} className="mt-2 text-[12px] text-u-ink2 hover:text-u-ink">← Choose existing contractor</button>
          </div>
        )}
        <Field label="Notes for Contractor">
          <TextArea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Access details, parts to bring, scope reminders…" />
        </Field>
        <label className="flex items-center gap-2 text-[12.5px] text-u-ink2">
          <input type="checkbox" checked={markAssigned} onChange={(e) => setMarkAssigned(e.target.checked)} className="h-4 w-4 rounded border-u-line bg-u-s2 accent-u-accent" />
          Move request status to <b>Assigned</b>
        </label>
      </div>
    </Modal>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Schedule / reschedule a visit
// ═════════════════════════════════════════════════════════════════════════════

export function VisitModal({
  open, onClose, request, visit,
}: {
  open: boolean; onClose: () => void; request: MaintenanceRequest | null; visit?: Visit | null;
}) {
  const s = useStore();
  const [purpose, setPurpose] = useState('Inspection / diagnosis visit');
  const [contractorId, setContractorId] = useState('');
  const [staffId, setStaffId] = useState('');
  const [workOrderId, setWorkOrderId] = useState('');
  const [date, setDate] = useState(todayISO());
  const [time, setTime] = useState('09:00');
  const [duration, setDuration] = useState('60');
  const [access, setAccess] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!open || !request) return;
    if (visit) {
      setPurpose(visit.purpose); setContractorId(visit.contractorId ?? ''); setStaffId(visit.staffId ?? '');
      setWorkOrderId(visit.workOrderId ?? ''); setDate(visit.date); setTime(visit.time);
      setDuration(String(visit.durationMins)); setAccess(visit.accessArrangements ?? ''); setNotes(visit.notes ?? '');
    } else {
      setPurpose('Inspection / diagnosis visit'); setContractorId(request.assignedContractorId ?? '');
      setStaffId(''); setWorkOrderId(''); setDate(todayISO()); setTime('09:00'); setDuration('60');
      setAccess(request.accessInstructions ?? ''); setNotes('');
    }
  }, [open, request?.id, visit?.id]);

  if (!request) return null;
  const wos = s.requestWorkOrders(request.id);

  const save = () => {
    const payload = {
      purpose, contractorId: contractorId || undefined, staffId: staffId || undefined,
      workOrderId: workOrderId || undefined, date, time, durationMins: Math.max(15, num(duration) || 60),
      accessArrangements: access || undefined, notes: notes || undefined,
    };
    if (visit) {
      s.updateVisit(visit.id, { ...payload, status: 'Scheduled' }, `Visit rescheduled: ${purpose} on ${fmtDate(date)} at ${time}`);
      s.toast('Visit rescheduled.');
    } else {
      s.addVisit({ id: uid('V'), requestId: request.id, status: 'Scheduled', ...payload });
      s.toast('Visit scheduled.');
    }
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={visit ? `Reschedule Visit — ${request.id}` : `Schedule Visit — ${request.id}`}
      subtitle={request.title}
      footer={
        <>
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton onClick={save}>{visit ? 'Reschedule' : 'Schedule Visit'}</PrimaryButton>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Visit Purpose" className="sm:col-span-2">
          <TextInput value={purpose} onChange={(e) => setPurpose(e.target.value)} />
        </Field>
        <Field label="Contractor">
          <SelectInput value={contractorId} onChange={(e) => setContractorId(e.target.value)}>
            <option value="">— None —</option>
            {s.contractors.filter((c) => c.active).map((c) => <option key={c.id} value={c.id}>{c.company}</option>)}
          </SelectInput>
        </Field>
        <Field label="Staff Attending">
          <SelectInput value={staffId} onChange={(e) => setStaffId(e.target.value)}>
            <option value="">— None —</option>
            {s.staff.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </SelectInput>
        </Field>
        <Field label="Date"><TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="Time"><TextInput type="time" value={time} onChange={(e) => setTime(e.target.value)} /></Field>
        <Field label="Estimated Duration (minutes)"><TextInput type="number" min="15" step="15" value={duration} onChange={(e) => setDuration(e.target.value)} /></Field>
        <Field label="Link to Work Order">
          <SelectInput value={workOrderId} onChange={(e) => setWorkOrderId(e.target.value)}>
            <option value="">— Request level —</option>
            {wos.map((w) => <option key={w.id} value={w.id}>{w.id} · {w.title}</option>)}
          </SelectInput>
        </Field>
        <Field label="Access Arrangements" className="sm:col-span-2">
          <TextInput value={access} onChange={(e) => setAccess(e.target.value)} placeholder="Tenant home, lock box, call on arrival…" />
        </Field>
        <Field label="Notes" className="sm:col-span-2">
          <TextArea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Add work log entry
// ═════════════════════════════════════════════════════════════════════════════

export function WorkLogModal({
  open, onClose, request, workOrderId,
}: {
  open: boolean; onClose: () => void; request: MaintenanceRequest | null; workOrderId?: string;
}) {
  const s = useStore();
  const [date, setDate] = useState(todayISO());
  const [time, setTime] = useState('09:00');
  const [person, setPerson] = useState('');
  const [woId, setWoId] = useState('');
  const [work, setWork] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [materials, setMaterials] = useState('');
  const [hours, setHours] = useState('1');
  const [outcome, setOutcome] = useState(VISIT_OUTCOMES[0]);
  const [followUp, setFollowUp] = useState(false);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !request) return;
    setDate(todayISO()); setWork(''); setDiagnosis(''); setMaterials(''); setNotes(''); setError('');
    setWoId(workOrderId ?? ''); setFollowUp(false); setOutcome(VISIT_OUTCOMES[0]); setHours('1');
    const c = s.getContractor(request.assignedContractorId);
    setPerson(c ? `${c.contact} (${c.company})` : s.currentUser.name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, request?.id]);

  if (!request) return null;
  const wos = s.requestWorkOrders(request.id);
  const people = [
    ...s.staff.map((m) => m.name),
    ...s.contractors.map((c) => `${c.contact} (${c.company})`),
  ];

  const save = () => {
    if (!work.trim()) { setError('Describe the work performed.'); return; }
    if (!person.trim()) { setError('Record who performed the work.'); return; }
    s.addWorkLog({
      id: uid('WL'), requestId: request.id, workOrderId: woId || undefined,
      date: new Date(`${date}T${time}:00`).toISOString(), person: person.trim(),
      workPerformed: work.trim(), diagnosis: diagnosis || undefined, materials: materials || undefined,
      hours: Math.max(0, num(hours)), outcome, followUpRequired: followUp, notes: notes || undefined,
    });
    if (request.status === 'Assigned' || request.status === 'Approved') {
      s.setRequestStatus(request.id, 'In Progress', { silent: true });
      s.logActivity(request.id, 'status', 'Status changed to In Progress (work started)');
    }
    s.toast('Work log entry added.');
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Add Work Log — ${request.id}`}
      subtitle={request.title}
      wide
      footer={
        <>
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton onClick={save}>Add Entry</PrimaryButton>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Date"><TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="Time"><TextInput type="time" value={time} onChange={(e) => setTime(e.target.value)} /></Field>
        <Field label="Performed By" required>
          <TextInput value={person} onChange={(e) => setPerson(e.target.value)} list="wl-people" placeholder="Name (company)" />
          <datalist id="wl-people">{people.map((p) => <option key={p} value={p} />)}</datalist>
        </Field>
        <Field label="Work Order">
          <SelectInput value={woId} onChange={(e) => setWoId(e.target.value)}>
            <option value="">— Request level —</option>
            {wos.map((w) => <option key={w.id} value={w.id}>{w.id} · {w.title}</option>)}
          </SelectInput>
        </Field>
        <Field label="Work Performed" required error={error} className="sm:col-span-2">
          <TextArea value={work} onChange={(e) => setWork(e.target.value)} placeholder="What was done during this visit…" />
        </Field>
        <Field label="Diagnosis" className="sm:col-span-2">
          <TextInput value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} placeholder="Root cause, if identified" />
        </Field>
        <Field label="Materials / Parts Used">
          <TextInput value={materials} onChange={(e) => setMaterials(e.target.value)} placeholder="e.g. OEM drain pump 00631200" />
        </Field>
        <Field label="Time Spent (hours)">
          <TextInput type="number" min="0" step="0.25" value={hours} onChange={(e) => setHours(e.target.value)} />
        </Field>
        <Field label="Visit Outcome">
          <SelectInput value={outcome} onChange={(e) => setOutcome(e.target.value)}>
            {VISIT_OUTCOMES.map((o) => <option key={o} value={o}>{o}</option>)}
          </SelectInput>
        </Field>
        <Field label="Notes">
          <TextInput value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <label className="flex items-center gap-2 text-[12.5px] text-u-ink2 sm:col-span-2">
          <input type="checkbox" checked={followUp} onChange={(e) => setFollowUp(e.target.checked)} className="h-4 w-4 accent-u-accent" />
          Follow-up visit required
        </label>
      </div>
    </Modal>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Estimate create / edit
// ═════════════════════════════════════════════════════════════════════════════

export function EstimateModal({
  open, onClose, request, estimate,
}: {
  open: boolean; onClose: () => void; request: MaintenanceRequest | null; estimate?: Estimate | null;
}) {
  const s = useStore();
  const [label, setLabel] = useState('');
  const [contractorId, setContractorId] = useState('');
  const [labor, setLabor] = useState('');
  const [materials, setMaterials] = useState('');
  const [other, setOther] = useState('');
  const [tax, setTax] = useState('');
  const [notes, setNotes] = useState('');
  const [submit, setSubmit] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !request) return;
    setError('');
    if (estimate) {
      setLabel(estimate.label); setContractorId(estimate.contractorId ?? '');
      setLabor(String(estimate.labor)); setMaterials(String(estimate.materials));
      setOther(String(estimate.other)); setTax(String(estimate.tax)); setNotes(estimate.notes ?? '');
      setSubmit(estimate.status === 'Pending Approval');
    } else {
      setLabel(''); setContractorId(request.assignedContractorId ?? '');
      setLabor(''); setMaterials(''); setOther(''); setTax(''); setNotes(''); setSubmit(true);
    }
  }, [open, request?.id, estimate?.id]);

  const total = num(labor) + num(materials) + num(other) + num(tax);
  if (!request) return null;
  const overThreshold = total > s.settings.approvalThreshold;
  const overBudget = request.approvedBudget !== undefined && total > request.approvedBudget;

  const save = () => {
    if ([labor, materials, other, tax].some((v) => num(v) < 0)) { setError('Amounts cannot be negative.'); return; }
    if (total <= 0) { setError('Enter at least one cost line so the total is above $0.'); return; }
    if (!label.trim()) { setError('Give the estimate a label (e.g. contractor name + scope).'); return; }
    const status = submit ? 'Pending Approval' : 'Not Required';
    if (estimate) {
      s.updateEstimate(estimate.id, {
        label: label.trim(), contractorId: contractorId || undefined,
        labor: num(labor), materials: num(materials), other: num(other), tax: num(tax), total,
        notes: notes || undefined, status,
      }, `Estimate ${estimate.id} revised (${fmtMoney(total)})${submit ? ' — resubmitted for approval' : ''}`);
    } else {
      const c = s.getContractor(contractorId);
      s.addEstimate({
        id: s.nextEstimateId(), requestId: request.id, contractorId: contractorId || undefined,
        label: label.trim(), labor: num(labor), materials: num(materials), other: num(other), tax: num(tax), total,
        status, submittedBy: c ? `${c.contact} (${c.company})` : s.currentUser.name,
        submittedAt: nowISO(), notes: notes || undefined,
      }, `Estimate submitted: ${label.trim()} (${fmtMoney(total)})${submit ? ' — pending approval' : ''}`);
    }
    if (submit) {
      const patch: Partial<MaintenanceRequest> = { approvalStatus: 'Pending Approval' };
      if (['New', 'Under Review', 'Assigned', 'Draft'].includes(request.status)) patch.status = 'Awaiting Approval';
      s.updateRequest(request.id, patch);
    }
    s.toast(submit ? 'Estimate submitted for approval.' : 'Estimate recorded.');
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${estimate ? 'Revise' : 'New'} Estimate — ${request.id}`}
      subtitle={request.title}
      footer={
        <>
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton onClick={save}>{submit ? 'Submit for Approval' : 'Save Estimate'}</PrimaryButton>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Estimate Label" required error={error}>
          <TextInput value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. FixIt quote #9102 — drain pump replacement" />
        </Field>
        <Field label="Contractor">
          <SelectInput value={contractorId} onChange={(e) => setContractorId(e.target.value)}>
            <option value="">Internal / staff estimate</option>
            {s.contractors.filter((c) => c.active).map((c) => <option key={c.id} value={c.id}>{c.company}</option>)}
          </SelectInput>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Estimated Labor"><MoneyInput value={labor} onChange={setLabor} /></Field>
          <Field label="Estimated Materials"><MoneyInput value={materials} onChange={setMaterials} /></Field>
          <Field label="Other Charges"><MoneyInput value={other} onChange={setOther} /></Field>
          <Field label="Taxes"><MoneyInput value={tax} onChange={setTax} /></Field>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-u-line bg-u-s2 px-3 py-2">
          <span className="text-[12px] font-medium text-u-ink2">Total Estimated Cost</span>
          <span className="text-[16px] font-semibold tabular text-u-ink">{fmtMoney(total)}</span>
        </div>
        {overBudget && (
          <div className="flex items-start gap-2 rounded-lg border border-u-warn/30 bg-u-warn/10 px-3 py-2 text-[12px] text-u-warn">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            This estimate exceeds the currently approved budget of {fmtMoney(request.approvedBudget)}. A new approval will be required.
          </div>
        )}
        <Field label="Notes"><TextArea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Scope assumptions, exclusions, validity period…" /></Field>
        <label className="flex items-start gap-2 text-[12.5px] text-u-ink2">
          <input type="checkbox" checked={submit} onChange={(e) => setSubmit(e.target.checked)} className="mt-0.5 h-4 w-4 accent-u-accent" />
          <span>
            Submit for approval
            <span className="block text-[11.5px] text-u-muted">
              {overThreshold
                ? `Required — total exceeds the ${fmtMoney(s.settings.approvalThreshold)} approval threshold (Settings).`
                : `Estimates above ${fmtMoney(s.settings.approvalThreshold)} require approval. Uncheck only for pre-authorized work.`}
            </span>
          </span>
        </label>
      </div>
    </Modal>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Approval decision (approve / reject / request revision)
// ═════════════════════════════════════════════════════════════════════════════

export function ApprovalModal({
  open, onClose, request, estimate, mode,
}: {
  open: boolean; onClose: () => void; request: MaintenanceRequest | null;
  estimate: Estimate | null; mode: 'approve' | 'reject' | 'revision';
}) {
  const s = useStore();
  const [budget, setBudget] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !estimate) return;
    setBudget(String(estimate.total)); setNotes(''); setError('');
  }, [open, estimate?.id]);

  if (!request || !estimate) return null;

  const save = () => {
    if (mode !== 'approve' && !notes.trim()) { setError('Please record the reason so the contractor and team can act on it.'); return; }
    if (mode === 'approve') {
      const approvedBudget = Math.max(0, num(budget));
      s.updateEstimate(estimate.id, {
        status: 'Approved', approvedBy: s.currentUser.name, approvedAt: nowISO(),
        approvedBudget, notes: notes || estimate.notes,
      }, `Estimate ${estimate.id} approved — budget ${fmtMoney(approvedBudget)}${notes ? `: ${notes}` : ''}`);
      const patch: Partial<MaintenanceRequest> = { approvalStatus: 'Approved', approvedBudget };
      if (request.status === 'Awaiting Approval') patch.status = 'Approved';
      s.updateRequest(request.id, patch);
      s.toast('Estimate approved. Work can be scheduled.');
    } else if (mode === 'reject') {
      s.updateEstimate(estimate.id, { status: 'Rejected', notes: notes.trim() }, `Estimate ${estimate.id} rejected — ${notes.trim()}`);
      const patch: Partial<MaintenanceRequest> = { approvalStatus: 'Rejected' };
      if (request.status === 'Awaiting Approval') patch.status = 'Under Review';
      s.updateRequest(request.id, patch);
      s.toast('Estimate rejected. Request returned to Under Review.', 'warning');
    } else {
      s.updateEstimate(estimate.id, { status: 'Revision Requested', notes: notes.trim() }, `Revision requested on estimate ${estimate.id} — ${notes.trim()}`);
      const patch: Partial<MaintenanceRequest> = { approvalStatus: 'Revision Requested' };
      if (request.status === 'Awaiting Approval') patch.status = 'Under Review';
      s.updateRequest(request.id, patch);
      s.toast('Revision requested from contractor.', 'info');
    }
    onClose();
  };

  const titles = { approve: 'Approve Estimate', reject: 'Reject Estimate', revision: 'Request Revised Estimate' };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${titles[mode]} — ${request.id}`}
      subtitle={`${estimate.id} · ${estimate.label} · ${fmtMoney(estimate.total)}`}
      footer={
        <>
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton onClick={save} className={mode === 'reject' ? 'bg-u-danger text-u-onaccent hover:bg-u-danger' : undefined}>
            {mode === 'approve' ? 'Approve Work' : mode === 'reject' ? 'Reject Estimate' : 'Request Revision'}
          </PrimaryButton>
        </>
      }
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2 rounded-lg border border-u-line bg-u-s2 px-3 py-2.5 text-[12px]">
          <span className="text-u-muted">Labor</span><span className="text-right tabular text-u-ink">{fmtMoney(estimate.labor)}</span>
          <span className="text-u-muted">Materials</span><span className="text-right tabular text-u-ink">{fmtMoney(estimate.materials)}</span>
          <span className="text-u-muted">Other</span><span className="text-right tabular text-u-ink">{fmtMoney(estimate.other)}</span>
          <span className="text-u-muted">Tax</span><span className="text-right tabular text-u-ink">{fmtMoney(estimate.tax)}</span>
          <span className="border-t border-u-line pt-1.5 font-medium text-u-ink2">Total</span>
          <span className="border-t border-u-line pt-1.5 text-right font-semibold tabular text-u-ink">{fmtMoney(estimate.total)}</span>
        </div>
        {mode === 'approve' && (
          <Field label="Approved Budget" hint="Defaults to the estimate total. Approving a budget does not record payment — payment status comes from the linked invoice in Bills & Expenses.">
            <MoneyInput value={budget} onChange={setBudget} />
          </Field>
        )}
        <Field label={mode === 'approve' ? 'Approval Notes' : 'Reason'} required={mode !== 'approve'} error={error}>
          <TextArea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={mode === 'approve' ? 'Optional conditions or instructions…' : 'Explain what needs to change…'} />
        </Field>
      </div>
    </Modal>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Complete request
// ═════════════════════════════════════════════════════════════════════════════

export function CompleteModal({ open, onClose, request }: { open: boolean; onClose: () => void; request: MaintenanceRequest | null }) {
  const s = useStore();
  const [outcome, setOutcome] = useState<string>('Repaired');
  const [date, setDate] = useState(todayISO());
  const [notes, setNotes] = useState('');
  const [verifiedBy, setVerifiedBy] = useState('');
  const [verification, setVerification] = useState('Pending Verification');
  const [warranty, setWarranty] = useState('');
  const [followUp, setFollowUp] = useState(false);
  const [closeAfter, setCloseAfter] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setOutcome('Repaired'); setDate(todayISO()); setNotes(''); setVerifiedBy(s.currentUser.name);
    setVerification('Pending Verification'); setWarranty(''); setFollowUp(false); setCloseAfter(false); setError('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, request?.id]);

  if (!request) return null;
  const actual = s.actualCost(request);

  const save = () => {
    if (!notes.trim()) { setError('Completion notes are required before a request can be marked completed.'); return; }
    s.updateRequest(request.id, {
      status: closeAfter ? 'Closed' : 'Completed',
      completedAt: date,
      resolutionOutcome: outcome as MaintenanceRequest['resolutionOutcome'],
      resolutionNotes: notes.trim(),
      verifiedBy: verifiedBy || undefined,
      verificationStatus: verification as MaintenanceRequest['verificationStatus'],
      warrantyInfo: warranty || undefined,
      followUpRequired: followUp,
    }, `Request ${closeAfter ? 'completed & closed' : 'completed'} — outcome: ${outcome}. Final recorded cost ${fmtMoney(actual)}.`, 'completion');
    // Mark scheduled visits as completed if in the past
    s.requestVisits(request.id)
      .filter((v) => v.status === 'Scheduled' && v.date <= todayISO())
      .forEach((v) => s.updateVisit(v.id, { status: 'Completed' }));
    s.toast(`${request.id} marked completed.`);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Complete Request — ${request.id}`}
      subtitle={request.title}
      footer={
        <>
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton onClick={save}><CheckCircle2 size={15} /> Mark Completed</PrimaryButton>
        </>
      }
    >
      <div className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Resolution Outcome" required>
            <SelectInput value={outcome} onChange={(e) => setOutcome(e.target.value)}>
              {RESOLUTION_OUTCOMES.map((o) => <option key={o} value={o}>{o}</option>)}
            </SelectInput>
          </Field>
          <Field label="Completion Date"><TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        </div>
        <Field label="Completion Notes" required error={error} hint="What was done, test results, and anything the next technician should know.">
          <TextArea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Replaced drain pump, ran two full cycles with no leaks or errors. Tenant confirmed operation." />
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Verified By">
            <SelectInput value={verifiedBy} onChange={(e) => setVerifiedBy(e.target.value)}>
              <option value="">— Not yet —</option>
              {s.staff.map((m) => <option key={m.id} value={m.name}>{m.name}</option>)}
            </SelectInput>
          </Field>
          <Field label="Verification Status">
            <SelectInput value={verification} onChange={(e) => setVerification(e.target.value)}>
              <option>Pending Verification</option>
              <option>Verified</option>
              <option>Not Verified</option>
            </SelectInput>
          </Field>
        </div>
        <Field label="Warranty Information (for the repair)">
          <TextInput value={warranty} onChange={(e) => setWarranty(e.target.value)} placeholder="e.g. 12-month parts & labor warranty from FixIt" />
        </Field>
        <div className="rounded-lg border border-u-line bg-u-s2 px-3 py-2.5 text-[12.5px] text-u-ink2">
          Final recorded cost: <b className="tabular text-u-ink">{fmtMoney(actual)}</b>
          <span className="text-u-muted"> ({request.linkedExpenseIds.length} linked expense{request.linkedExpenseIds.length === 1 ? '' : 's'})</span>
          {actual === 0 && <span className="mt-1 block text-u-warn">No costs recorded yet. Link the contractor invoice in the Costs tab so actuals are tracked.</span>}
          {request.approvedBudget !== undefined && actual > request.approvedBudget && (
            <span className="mt-1 block text-u-danger">Actual cost exceeds the approved budget of {fmtMoney(request.approvedBudget)} by {fmtMoney(actual - request.approvedBudget)}.</span>
          )}
        </div>
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-[12.5px] text-u-ink2">
            <input type="checkbox" checked={followUp} onChange={(e) => setFollowUp(e.target.checked)} className="h-4 w-4 accent-u-accent" />
            Follow-up required
          </label>
          <label className="flex items-center gap-2 text-[12.5px] text-u-ink2">
            <input type="checkbox" checked={closeAfter} onChange={(e) => setCloseAfter(e.target.checked)} className="h-4 w-4 accent-u-accent" />
            Close immediately (skip verification queue)
          </label>
        </div>
      </div>
    </Modal>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Generic reason prompt (reject / cancel / reopen)
// ═════════════════════════════════════════════════════════════════════════════

export function ReasonModal({
  open, onClose, title, label, confirmLabel, danger, onSubmit,
}: {
  open: boolean; onClose: () => void; title: string; label: string;
  confirmLabel: string; danger?: boolean; onSubmit: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  useEffect(() => { if (open) { setReason(''); setError(''); } }, [open]);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <GhostButton onClick={onClose}>Back</GhostButton>
          <PrimaryButton
            className={danger ? 'bg-u-danger text-u-onaccent hover:bg-u-danger' : undefined}
            onClick={() => {
              if (!reason.trim()) { setError('A reason is required for the audit trail.'); return; }
              onSubmit(reason.trim());
              onClose();
            }}
          >
            {confirmLabel}
          </PrimaryButton>
        </>
      }
    >
      <Field label={label} required error={error}>
        <TextArea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="This is recorded in the activity history…" />
      </Field>
    </Modal>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Replace appliance workflow
// ═════════════════════════════════════════════════════════════════════════════

export function ReplaceApplianceModal({
  open, onClose, asset, request, onDone,
}: {
  open: boolean; onClose: () => void; asset: Asset | null;
  request?: MaintenanceRequest | null; onDone?: (newAssetId: string) => void;
}) {
  const s = useStore();
  const [reason, setReason] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [repairEstimate, setRepairEstimate] = useState('');
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [serial, setSerial] = useState('');
  const [supplier, setSupplier] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(todayISO());
  const [price, setPrice] = useState('');
  const [delivery, setDelivery] = useState('');
  const [install, setInstall] = useState('');
  const [disposal, setDisposal] = useState('');
  const [taxes, setTaxes] = useState('');
  const [warrantyProvider, setWarrantyProvider] = useState('');
  const [warrantyEnd, setWarrantyEnd] = useState('');
  const [warrantyRef, setWarrantyRef] = useState('');
  const [replacementDate, setReplacementDate] = useState(todayISO());
  const [notes, setNotes] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<'Paid' | 'Unpaid'>('Unpaid');
  const [completeRequest, setCompleteRequest] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !asset) return;
    setReason(''); setDiagnosis(''); setError('');
    setName(asset.name); setBrand(''); setModel(''); setSerial(''); setSupplier('');
    setPurchaseDate(todayISO()); setReplacementDate(todayISO());
    setPrice(''); setDelivery(''); setInstall(''); setDisposal(''); setTaxes('');
    setWarrantyProvider(''); setWarrantyEnd(''); setWarrantyRef(''); setNotes('');
    setPaymentStatus('Unpaid'); setCompleteRequest(true);
    if (request) {
      const est = s.estimatedCost(request);
      setRepairEstimate(est ? String(est) : '');
    } else setRepairEstimate('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, asset?.id]);

  if (!asset) return null;
  const total = num(price) + num(delivery) + num(install) + num(disposal) + num(taxes);
  const age = assetAgeYears(asset);
  const priorSpend = s.assetRepairSpend(asset.id);
  const priorRequests = s.assetRequests(asset.id).length;
  const ws = warrantyState(asset);

  const save = () => {
    if (!reason.trim()) { setError('Record why the appliance is being replaced.'); return; }
    if (!name.trim()) { setError('Name the replacement appliance.'); return; }
    if (num(price) < 0 || total < 0) { setError('Costs cannot be negative.'); return; }
    const newId = s.nextAssetId();

    // 1) Create the new asset (old record is preserved, never deleted)
    s.addAsset({
      id: newId, name: name.trim(), type: asset.type, propertyId: asset.propertyId,
      unitId: asset.unitId, room: asset.room, brand: brand || undefined, model: model || undefined,
      serial: serial || undefined, purchaseDate: purchaseDate || undefined,
      purchasePrice: num(price) || undefined, supplier: supplier || undefined,
      installDate: replacementDate || undefined, warrantyStart: purchaseDate || undefined,
      warrantyEnd: warrantyEnd || undefined, warrantyProvider: warrantyProvider || undefined,
      warrantyRef: warrantyRef || undefined, condition: 'Excellent', status: 'Active',
      replacedFromId: asset.id,
    });

    // 2) Retire the old asset with a link to its replacement
    s.updateAsset(asset.id, {
      status: 'Replaced', replacedById: newId, replacementReason: reason.trim(),
      replacementDate, retiredDate: replacementDate,
      disposalNotes: notes || asset.disposalNotes,
    });

    // 3) Record costs in Bills & Expenses (financial source of truth)
    const expenseIds: string[] = [];
    if (num(price) > 0) {
      const eid = s.nextExpenseId();
      expenseIds.push(eid);
      s.addExpense({
        id: eid, description: `${name.trim()} (${brand} ${model}) — replacement for ${asset.id}`.replace(/\s+/g, ' ').trim(),
        vendor: supplier || 'Appliance supplier', propertyId: asset.propertyId, unitId: asset.unitId,
        category: 'Appliance Purchase', amount: num(price) + num(taxes), date: purchaseDate || todayISO(),
        paymentStatus, linkedAssetId: newId, linkedRequestId: request?.id,
      });
    }
    const services = num(delivery) + num(install) + num(disposal);
    if (services > 0) {
      const eid = s.nextExpenseId();
      // nextExpenseId is derived from state that hasn't flushed yet — offset if purchase expense was also added
      const finalId = expenseIds.length ? eid.replace(/(\d+)$/, (m) => String(parseInt(m, 10) + 1)) : eid;
      expenseIds.push(finalId);
      s.addExpense({
        id: finalId, description: `Delivery, installation & disposal — ${name.trim()} (${newId})`,
        vendor: supplier || 'Installer', contractorId: request?.assignedContractorId,
        propertyId: asset.propertyId, unitId: asset.unitId, category: 'Maintenance & Repairs',
        amount: services, date: replacementDate || todayISO(), paymentStatus, linkedRequestId: request?.id,
      });
    }

    // 4) Tie back to the maintenance request (asset history + actual costs)
    if (request) {
      const merged = Array.from(new Set([...request.linkedExpenseIds, ...expenseIds]));
      const patch: Partial<MaintenanceRequest> = { linkedExpenseIds: merged };
      if (completeRequest && request.status !== 'Completed' && request.status !== 'Closed') {
        patch.status = 'Completed';
        patch.completedAt = replacementDate || todayISO();
        patch.resolutionOutcome = 'Replaced';
        patch.resolutionNotes = `Appliance replaced. ${diagnosis ? `Diagnosis: ${diagnosis}. ` : ''}Reason: ${reason.trim()} Old asset ${asset.id} retained as Replaced; new asset ${newId} (${brand} ${model}) installed. Total replacement cost ${fmtMoney(total)}.`;
        patch.verificationStatus = 'Pending Verification';
      }
      s.updateRequest(request.id, patch);
      s.logActivity(request.id, 'replacement',
        `Asset ${asset.id} replaced by ${newId} (${brand || ''} ${model || name}). Total replacement cost ${fmtMoney(total)} recorded in Bills & Expenses (${expenseIds.join(', ') || 'no expense'}).`);
      if (completeRequest) s.logActivity(request.id, 'completion', 'Request completed — outcome: Replaced.');
    }
    s.toast(`${asset.id} replaced by ${newId}. History preserved; costs linked to Bills & Expenses.`);
    onDone?.(newId);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Replace Appliance — ${asset.id}`}
      subtitle="The existing asset and its full history are preserved and marked as Replaced."
      xwide
      footer={
        <>
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton onClick={save}><Replace size={15} /> Record Replacement</PrimaryButton>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-u-line bg-u-s2/60 p-3.5">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-u-ink2">Repair vs. replace — current asset</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[12.5px] sm:grid-cols-3">
            <span className="text-u-muted">Asset</span><span className="text-u-ink sm:col-span-2">{asset.name} · {asset.brand} {asset.model}</span>
            <span className="text-u-muted">Age</span><span className="text-u-ink sm:col-span-2">{age !== null ? `${age.toFixed(1)} years` : '—'} (purchased {fmtDate(asset.purchaseDate)} for {fmtMoney(asset.purchasePrice)})</span>
            <span className="text-u-muted">Warranty</span>
            <span className="sm:col-span-2">
              {ws === 'active' && <span className="text-u-ok">Active until {fmtDate(asset.warrantyEnd)} — consider a warranty claim first</span>}
              {ws === 'expiring' && <span className="text-u-warn">Expires {fmtDate(asset.warrantyEnd)}</span>}
              {ws === 'expired' && <span className="text-u-danger">Expired {fmtDate(asset.warrantyEnd)}</span>}
              {ws === 'none' && <span className="text-u-ink2">No warranty on record</span>}
            </span>
            <span className="text-u-muted">Recorded repair costs</span><span className="text-u-ink sm:col-span-2">{fmtMoney(priorSpend)} across {priorRequests} linked request{priorRequests === 1 ? '' : 's'}</span>
            <span className="text-u-muted">Condition / Status</span><span className="text-u-ink sm:col-span-2">{asset.condition} · {asset.status}</span>
          </div>
        </div>

        <FormSection title="Decision" icon={<ClipboardList size={14} />}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Replacement Reason" required error={error} className="sm:col-span-2">
              <TextArea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Compressor failure; $780 repair on a 9-year-old unit is not economical." />
            </Field>
            <Field label="Diagnosis"><TextInput value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} placeholder="Technician's finding" /></Field>
            <Field label="Repair Estimate (for the record)"><MoneyInput value={repairEstimate} onChange={setRepairEstimate} /></Field>
          </div>
        </FormSection>

        <FormSection title="Replacement Appliance" icon={<RefreshCw size={14} />}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Appliance Name" required><TextInput value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <Field label="Supplier"><TextInput value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="e.g. ApplianceWorld" /></Field>
            <Field label="Brand"><TextInput value={brand} onChange={(e) => setBrand(e.target.value)} /></Field>
            <Field label="Model Number"><TextInput value={model} onChange={(e) => setModel(e.target.value)} /></Field>
            <Field label="Serial Number (if available)"><TextInput value={serial} onChange={(e) => setSerial(e.target.value)} /></Field>
            <Field label="Purchase Date"><TextInput type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} /></Field>
            <Field label="Warranty Provider"><TextInput value={warrantyProvider} onChange={(e) => setWarrantyProvider(e.target.value)} /></Field>
            <Field label="Warranty Expiry"><TextInput type="date" value={warrantyEnd} onChange={(e) => setWarrantyEnd(e.target.value)} /></Field>
            <Field label="Warranty Reference"><TextInput value={warrantyRef} onChange={(e) => setWarrantyRef(e.target.value)} /></Field>
            <Field label="Replacement / Install Date"><TextInput type="date" value={replacementDate} onChange={(e) => setReplacementDate(e.target.value)} /></Field>
          </div>
        </FormSection>

        <FormSection title="Replacement Cost" icon={<Link2 size={14} />}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Field label="Purchase Price"><MoneyInput value={price} onChange={setPrice} /></Field>
            <Field label="Delivery"><MoneyInput value={delivery} onChange={setDelivery} /></Field>
            <Field label="Installation"><MoneyInput value={install} onChange={setInstall} /></Field>
            <Field label="Disposal / Haul-Away"><MoneyInput value={disposal} onChange={setDisposal} /></Field>
            <Field label="Taxes"><MoneyInput value={taxes} onChange={setTaxes} /></Field>
            <Field label="Invoice Payment Status">
              <SelectInput value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value as 'Paid' | 'Unpaid')}>
                <option value="Unpaid">Unpaid</option>
                <option value="Paid">Paid</option>
              </SelectInput>
            </Field>
          </div>
          <div className="mt-3 flex items-center justify-between rounded-lg border border-u-line bg-u-card px-3 py-2">
            <span className="text-[12px] text-u-ink2">Total replacement cost → recorded in Bills & Expenses</span>
            <span className="text-[16px] font-semibold tabular text-u-ink">{fmtMoney(total)}</span>
          </div>
          <Field label="Notes (incl. disposal details)" className="mt-3">
            <TextArea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Old unit hauled away by supplier; refrigerant recovery certificate on file…" />
          </Field>
          {request && (
            <label className="mt-3 flex items-center gap-2 text-[12.5px] text-u-ink2">
              <input type="checkbox" checked={completeRequest} onChange={(e) => setCompleteRequest(e.target.checked)} className="h-4 w-4 accent-u-accent" />
              Mark {request.id} as Completed with outcome “Replaced” and link these costs
            </label>
          )}
        </FormSection>
      </div>
    </Modal>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Link existing expense / create expense
// ═════════════════════════════════════════════════════════════════════════════

export function LinkExpenseModal({ open, onClose, request }: { open: boolean; onClose: () => void; request: MaintenanceRequest | null }) {
  const s = useStore();
  const [tab, setTab] = useState<'link' | 'create'>('link');
  const [query, setQuery] = useState('');
  const [desc, setDesc] = useState('');
  const [vendor, setVendor] = useState('');
  const [contractorId, setContractorId] = useState('');
  const [category, setCategory] = useState('Maintenance & Repairs');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayISO());
  const [dueDate, setDueDate] = useState('');
  const [payStatus, setPayStatus] = useState('Unpaid');
  const [invoiceRef, setInvoiceRef] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !request) return;
    setTab('link'); setQuery(''); setError('');
    setDesc(''); setVendor(''); setAmount(''); setInvoiceRef(''); setDueDate('');
    setContractorId(request.assignedContractorId ?? '');
    setDate(todayISO());
  }, [open, request?.id]);

  const liveRequest = request ? s.requests.find((r) => r.id === request.id) ?? request : null;
  const candidates = useMemo(() => {
    if (!liveRequest) return [];
    const q = query.toLowerCase();
    return s.expenses.filter((e) => {
      const matches = !q || `${e.id} ${e.description} ${e.vendor} ${e.invoiceRef ?? ''}`.toLowerCase().includes(q);
      return matches;
    });
  }, [s.expenses, query, liveRequest]);

  if (!liveRequest) return null;

  const createExpense = () => {
    if (!desc.trim()) { setError('Describe the expense.'); return; }
    if (num(amount) <= 0) { setError('Enter an amount above $0.'); return; }
    const c = s.getContractor(contractorId);
    const id = s.nextExpenseId();
    s.addExpense({
      id, description: desc.trim(), vendor: vendor || c?.company || '—',
      contractorId: contractorId || undefined, propertyId: liveRequest.propertyId, unitId: liveRequest.unitId,
      category, amount: num(amount), date, dueDate: dueDate || undefined,
      paymentStatus: payStatus as never, invoiceRef: invoiceRef || undefined,
    });
    // link after creation (state flush ordering handled by direct patch)
    setTimeout(() => s.linkExpense(liveRequest.id, id), 0);
    s.toast(`Expense ${id} created in Bills & Expenses and linked.`);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Costs — ${liveRequest.id}`}
      subtitle="Link invoices from Bills & Expenses. Amounts are counted once and stay owned by the financial record."
      wide
      footer={
        tab === 'create' ? (
          <>
            <GhostButton onClick={() => setTab('link')}>Back to Link</GhostButton>
            <PrimaryButton onClick={createExpense}>Create & Link Expense</PrimaryButton>
          </>
        ) : (
          <>
            <GhostButton onClick={onClose}>Done</GhostButton>
            <PrimaryButton onClick={() => setTab('create')}><Plus size={14} /> Create Expense Record</PrimaryButton>
          </>
        )
      }
    >
      {tab === 'link' ? (
        <div>
          <div className="relative mb-3">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-u-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search expenses by ID, vendor, description, invoice #…"
              className="w-full rounded-lg border border-u-line bg-u-s2 py-2 pl-9 pr-3 text-[13px] text-u-ink outline-none placeholder:text-u-muted focus:border-u-accent/60"
            />
          </div>
          <div className="max-h-80 space-y-1.5 overflow-y-auto pr-1">
            {candidates.map((e) => {
              const linkedHere = liveRequest.linkedExpenseIds.includes(e.id);
              const linkedElsewhere = !!e.linkedRequestId && e.linkedRequestId !== liveRequest.id && !linkedHere;
              return (
                <label
                  key={e.id}
                  className={cn(
                    'flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 transition',
                    linkedHere ? 'border-u-accent/40 bg-u-accent/5' : 'border-u-line bg-u-s2/60 hover:border-u-line2',
                    linkedElsewhere && 'cursor-not-allowed opacity-50'
                  )}
                >
                  <input
                    type="checkbox"
                    checked={linkedHere}
                    disabled={linkedElsewhere}
                    onChange={(ev) => (ev.target.checked ? s.linkExpense(liveRequest.id, e.id) : s.unlinkExpense(liveRequest.id, e.id))}
                    className="mt-1 h-4 w-4 shrink-0 accent-u-accent"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-[12px] font-semibold text-u-ink">{e.id}</span>
                      <PaymentBadge status={e.paymentStatus} />
                      {linkedElsewhere && <Chip tone="zinc">Linked to {e.linkedRequestId}</Chip>}
                    </span>
                    <span className="mt-0.5 block truncate text-[12.5px] text-u-ink2">{e.description}</span>
                    <span className="text-[11.5px] text-u-muted">{e.vendor} · {fmtDate(e.date)} · {e.category}{e.invoiceRef ? ` · Inv ${e.invoiceRef}` : ''}</span>
                  </span>
                  <span className="text-[13px] font-semibold tabular text-u-ink">{fmtMoney(e.amount)}</span>
                </label>
              );
            })}
            {candidates.length === 0 && <p className="py-6 text-center text-[12.5px] text-u-muted">No expenses match your search.</p>}
          </div>
          <p className="mt-3 flex items-start gap-1.5 text-[11.5px] text-u-muted">
            <Info size={12} className="mt-0.5 shrink-0" />
            An invoice already linked to another request can't be linked again — this prevents double-counting. Payment status shown here comes from Bills & Expenses.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Description" required error={error} className="sm:col-span-2">
            <TextInput value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="e.g. ProFlow invoice — P-trap replacement" />
          </Field>
          <Field label="Contractor (optional)">
            <SelectInput value={contractorId} onChange={(e) => setContractorId(e.target.value)}>
              <option value="">— None —</option>
              {s.contractors.filter((c) => c.active).map((c) => <option key={c.id} value={c.id}>{c.company}</option>)}
            </SelectInput>
          </Field>
          <Field label="Vendor (if not a contractor)"><TextInput value={vendor} onChange={(e) => setVendor(e.target.value)} /></Field>
          <Field label="Category">
            <SelectInput value={category} onChange={(e) => setCategory(e.target.value)}>
              {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </SelectInput>
          </Field>
          <Field label="Amount" required><MoneyInput value={amount} onChange={setAmount} /></Field>
          <Field label="Invoice Date"><TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Due Date"><TextInput type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></Field>
          <Field label="Payment Status" hint="Recording an expense does not mean the contractor has been paid.">
            <SelectInput value={payStatus} onChange={(e) => setPayStatus(e.target.value)}>
              <option>Unpaid</option><option>Paid</option><option>Partially Paid</option><option>Overdue</option>
            </SelectInput>
          </Field>
          <Field label="Invoice Reference"><TextInput value={invoiceRef} onChange={(e) => setInvoiceRef(e.target.value)} /></Field>
        </div>
      )}
    </Modal>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Upload documents (mock, session-only)
// ═════════════════════════════════════════════════════════════════════════════

export function UploadModal({
  open, onClose, requestId, assetId,
}: {
  open: boolean; onClose: () => void; requestId?: string; assetId?: string;
}) {
  const s = useStore();
  const [category, setCategory] = useState('Initial Issue Photo');
  const [files, setFiles] = useState<StagedFile[]>([]);
  const [assetDocs, setAssetDocs] = useState<StagedDoc[]>([]);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => { if (open) { setFiles([]); setAssetDocs([]); setCategory('Initial Issue Photo'); } }, [open]);

  if (assetId && !requestId) {
    const saveDocs = () => {
      saveAssetDocs(s, assetId, assetDocs);
      if (assetDocs.length) s.toast(`${assetDocs.length} document${assetDocs.length === 1 ? '' : 's'} added to ${assetId} .`, 'info');
      onClose();
    };
    return (
      <Modal
        open={open}
        onClose={onClose}
        title="Upload Asset Documents"
        subtitle={`For ${assetId}`}
        footer={<><GhostButton onClick={onClose}>Cancel</GhostButton><PrimaryButton onClick={saveDocs} disabled={assetDocs.length === 0}>Upload {assetDocs.length || ''} Document{assetDocs.length === 1 ? '' : 's'}</PrimaryButton></>}
      >
        <div className="space-y-3">
          <AssetDocsField docs={assetDocs} onChange={setAssetDocs} />
          <div className="flex items-start gap-2 rounded-lg border border-u-warn/25 bg-u-warn/5 px-3 py-2 text-[11.5px] text-u-warn/90">
            <Info size={13} className="mt-0.5 shrink-0" />
            {isSupabaseConfigured ? 'Files are stored securely and only visible to your team.' : 'Prototype note: no file server is connected. Documents can be opened during this browser session only and will not persist after a refresh.'}
          </div>
        </div>
      </Modal>
    );
  }

  const save = () => {
    files.forEach((f) =>
      s.addAttachment({
        id: uid('AT'), requestId, assetId, name: f.name, category, size: f.size,
        uploadedBy: s.currentUser.name, uploadedAt: nowISO(), url: f.url, mock: true,
      }, f.file)
    );
    if (files.length) s.toast(`${files.length} file${files.length === 1 ? '' : 's'} attached.`, 'info');
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Attach Documents"
      subtitle={requestId ? `For ${requestId}` : assetId ? `For ${assetId}` : undefined}
      footer={
        <>
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton onClick={save} disabled={files.length === 0}>Attach {files.length || ''} File{files.length === 1 ? '' : 's'}</PrimaryButton>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Document Category">
          <SelectInput value={category} onChange={(e) => setCategory(e.target.value)}>
            {DOC_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </SelectInput>
        </Field>
        <button
          type="button"
          onClick={() => ref.current?.click()}
          className="flex w-full flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-u-line bg-u-s2/50 px-4 py-8 text-u-ink2 transition hover:border-u-accent/50 hover:text-u-ink"
        >
          <FileUp size={22} />
          <span className="text-[13px] font-medium">Click to choose photos or documents</span>
          <span className="text-[11.5px] text-u-muted">Multiple files supported</span>
        </button>
        <input ref={ref} type="file" multiple className="hidden" onChange={(e) => { setFiles((f) => [...f, ...stageFiles(e.target.files)]); e.target.value = ''; }} />
        {files.map((f, i) => (
          <div key={i} className="flex items-center justify-between rounded-lg border border-u-line bg-u-s2 px-3 py-1.5 text-[12px] text-u-ink2">
            <span className="truncate">{f.name} <span className="text-u-muted">· {f.size}</span></span>
            <button type="button" onClick={() => setFiles(files.filter((_, x) => x !== i))} className="text-u-muted hover:text-u-danger"><X size={13} /></button>
          </div>
        ))}
        <div className="flex items-start gap-2 rounded-lg border border-u-warn/25 bg-u-warn/5 px-3 py-2 text-[11.5px] text-u-warn/90">
          <Info size={13} className="mt-0.5 shrink-0" />
          {isSupabaseConfigured ? 'Files are stored securely and only visible to your team.' : 'Prototype note: no file server is connected. Attachments are previewable during this browser session only and will not persist after a refresh.'}
        </div>
      </div>
    </Modal>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Asset create / edit
// ═════════════════════════════════════════════════════════════════════════════

export function AssetFormModal({
  open, onClose, asset, onSaved,
}: {
  open: boolean; onClose: () => void; asset?: Asset | null; onSaved?: (id: string) => void;
}) {
  const s = useStore();
  const empty = {
    name: '', type: 'Refrigerator', propertyId: '', unitId: '', room: '', brand: '', model: '', serial: '',
    purchaseDate: '', purchasePrice: '', supplier: '', installDate: '', warrantyStart: '', warrantyEnd: '',
    warrantyProvider: '', warrantyRef: '', warrantyNotes: '', condition: 'Good', status: 'Active',
    lastInspection: '', lastService: '', nextService: '', disposalNotes: '',
  };
  const [f, setF] = useState(empty);
  const [docs, setDocs] = useState<StagedDoc[]>([]);
  const [error, setError] = useState('');
  const set = (k: keyof typeof empty, v: string) => setF((prev) => ({ ...prev, [k]: v }));

  useEffect(() => {
    if (!open) return;
    setError('');
    setDocs([]);
    if (asset) {
      setF({
        name: asset.name, type: asset.type, propertyId: asset.propertyId, unitId: asset.unitId ?? '',
        room: asset.room ?? '', brand: asset.brand ?? '', model: asset.model ?? '', serial: asset.serial ?? '',
        purchaseDate: asset.purchaseDate ?? '', purchasePrice: asset.purchasePrice ? String(asset.purchasePrice) : '',
        supplier: asset.supplier ?? '', installDate: asset.installDate ?? '', warrantyStart: asset.warrantyStart ?? '',
        warrantyEnd: asset.warrantyEnd ?? '', warrantyProvider: asset.warrantyProvider ?? '',
        warrantyRef: asset.warrantyRef ?? '', warrantyNotes: asset.warrantyNotes ?? '',
        condition: asset.condition, status: asset.status, lastInspection: asset.lastInspection ?? '',
        lastService: asset.lastService ?? '', nextService: asset.nextService ?? '',
        disposalNotes: asset.disposalNotes ?? '',
      });
    } else setF(empty);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, asset?.id]);

  const save = () => {
    if (!f.name.trim()) { setError('Asset name is required.'); return; }
    if (!f.propertyId) { setError('Select the property where this asset is installed.'); return; }
    if (num(f.purchasePrice) < 0) { setError('Purchase price cannot be negative.'); return; }
    const payload: Omit<Asset, 'id'> = {
      name: f.name.trim(), type: f.type, propertyId: f.propertyId, unitId: f.unitId || undefined,
      room: f.room || undefined, brand: f.brand || undefined, model: f.model || undefined,
      serial: f.serial || undefined, purchaseDate: f.purchaseDate || undefined,
      purchasePrice: f.purchasePrice ? num(f.purchasePrice) : undefined, supplier: f.supplier || undefined,
      installDate: f.installDate || undefined, warrantyStart: f.warrantyStart || undefined,
      warrantyEnd: f.warrantyEnd || undefined, warrantyProvider: f.warrantyProvider || undefined,
      warrantyRef: f.warrantyRef || undefined, warrantyNotes: f.warrantyNotes || undefined,
      condition: f.condition as Asset['condition'], status: f.status as Asset['status'],
      lastInspection: f.lastInspection || undefined, lastService: f.lastService || undefined,
      nextService: f.nextService || undefined, disposalNotes: f.disposalNotes || undefined,
      replacedById: asset?.replacedById, replacedFromId: asset?.replacedFromId,
      replacementReason: asset?.replacementReason, replacementDate: asset?.replacementDate,
      retiredDate: asset?.retiredDate,
    };
    if (asset) {
      s.updateAsset(asset.id, payload);
      saveAssetDocs(s, asset.id, docs);
      s.toast(`${asset.id} updated.`);
      onSaved?.(asset.id);
    } else {
      const id = s.nextAssetId();
      s.addAsset({ id, ...payload });
      saveAssetDocs(s, id, docs);
      s.toast(`Asset ${id} created.`);
      onSaved?.(id);
    }
    onClose();
  };

  return (
    <FormDrawer
      open={open}
      onClose={onClose}
      title={asset ? `Edit asset ${asset.id}` : 'New asset / appliance'}
      subtitle={asset ? 'Changes are recorded in the activity history.' : 'Registers the asset only; no service or work order is created automatically.'}
      note={asset ? undefined : <>Will be created as <span className="u-num">{s.nextAssetId()}</span></>}
      footer={
        <>
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton onClick={save}>{asset ? 'Save Changes' : 'Create Asset'}</PrimaryButton>
        </>
      }
    >
      <div className="space-y-4">
        <FormError message={error} />
        <DrawerSection step="A" title="Identification" note="Required: name and property">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Asset Name" required><TextInput value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Kitchen Refrigerator" /></Field>
            <Field label="Asset Type">
              <SelectInput value={f.type} onChange={(e) => set('type', e.target.value)}>
                {ASSET_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </SelectInput>
            </Field>
            <Field label="Room / Location"><TextInput value={f.room} onChange={(e) => set('room', e.target.value)} /></Field>
            <Field label="Brand"><TextInput value={f.brand} onChange={(e) => set('brand', e.target.value)} /></Field>
            <Field label="Model Number"><TextInput value={f.model} onChange={(e) => set('model', e.target.value)} /></Field>
            <Field label="Serial Number"><TextInput value={f.serial} onChange={(e) => set('serial', e.target.value)} /></Field>
            <Field label="Property" required>
              <SelectInput value={f.propertyId} onChange={(e) => { set('propertyId', e.target.value); set('unitId', ''); }}>
                <option value="">Select property…</option>
                {s.properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </SelectInput>
            </Field>
            <Field label="Unit">
              <SelectInput value={f.unitId} onChange={(e) => set('unitId', e.target.value)} disabled={!f.propertyId}>
                <option value="">Property-level / common</option>
                {s.unitsForProperty(f.propertyId).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </SelectInput>
            </Field>
            <Field label="Condition">
              <SelectInput value={f.condition} onChange={(e) => set('condition', e.target.value)}>
                {ASSET_CONDITIONS.map((c) => <option key={c} value={c}>{c}</option>)}
              </SelectInput>
            </Field>
          </div>
        </DrawerSection>
        <DrawerSection step="B" title="Purchase & warranty" note="Optional">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Purchase Date"><TextInput type="date" value={f.purchaseDate} onChange={(e) => set('purchaseDate', e.target.value)} /></Field>
            <Field label="Purchase Price"><MoneyInput value={f.purchasePrice} onChange={(v) => set('purchasePrice', v)} /></Field>
            <Field label="Supplier"><TextInput value={f.supplier} onChange={(e) => set('supplier', e.target.value)} /></Field>
            <Field label="Installation Date"><TextInput type="date" value={f.installDate} onChange={(e) => set('installDate', e.target.value)} /></Field>
            <Field label="Warranty Start"><TextInput type="date" value={f.warrantyStart} onChange={(e) => set('warrantyStart', e.target.value)} /></Field>
            <Field label="Warranty Expiry"><TextInput type="date" value={f.warrantyEnd} onChange={(e) => set('warrantyEnd', e.target.value)} /></Field>
            <Field label="Warranty Provider"><TextInput value={f.warrantyProvider} onChange={(e) => set('warrantyProvider', e.target.value)} /></Field>
            <Field label="Warranty Reference"><TextInput value={f.warrantyRef} onChange={(e) => set('warrantyRef', e.target.value)} /></Field>
            <Field label="Warranty Coverage Notes"><TextInput value={f.warrantyNotes} onChange={(e) => set('warrantyNotes', e.target.value)} /></Field>
          </div>
        </DrawerSection>
        <DrawerSection step="C" title="Lifecycle" note="Retired assets keep their history">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Status" hint="Retired/replaced assets keep their full history.">
              <SelectInput value={f.status} onChange={(e) => set('status', e.target.value)}>
                {ASSET_STATUSES.map((st) => <option key={st} value={st}>{st}</option>)}
              </SelectInput>
            </Field>
            <Field label="Last Inspection"><TextInput type="date" value={f.lastInspection} onChange={(e) => set('lastInspection', e.target.value)} /></Field>
            <Field label="Last Service"><TextInput type="date" value={f.lastService} onChange={(e) => set('lastService', e.target.value)} /></Field>
            <Field label="Next Recommended Service"><TextInput type="date" value={f.nextService} onChange={(e) => set('nextService', e.target.value)} /></Field>
            <Field label="Disposal / Retirement Notes" className="sm:col-span-2"><TextInput value={f.disposalNotes} onChange={(e) => set('disposalNotes', e.target.value)} /></Field>
          </div>
        </DrawerSection>
        <DrawerSection step="D" title="Documents" note="Optional">
          <AssetDocsField docs={docs} onChange={setDocs} />
          {asset && <p className="mt-2 text-[11.5px] text-u-muted">New files are added to the asset's existing documents. Manage existing ones from the asset record.</p>}
        </DrawerSection>
      </div>
    </FormDrawer>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Work order create / edit + completion
// ═════════════════════════════════════════════════════════════════════════════

export function WorkOrderFormModal({
  open, onClose, workOrder, presetRequest,
}: {
  open: boolean; onClose: () => void; workOrder?: WorkOrder | null; presetRequest?: MaintenanceRequest | null;
}) {
  const s = useStore();
  const [requestId, setRequestId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [scope, setScope] = useState('');
  const [contractorId, setContractorId] = useState('');
  const [staffId, setStaffId] = useState('');
  const [priority, setPriority] = useState<Priority>('Normal');
  const [scheduledDate, setScheduledDate] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [status, setStatus] = useState<string>('Awaiting Assignment');
  const [estimate, setEstimate] = useState('');
  const [approvedBudget, setApprovedBudget] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    if (workOrder) {
      setRequestId(workOrder.requestId); setTitle(workOrder.title); setDescription(workOrder.description);
      setScope(workOrder.scope ?? ''); setContractorId(workOrder.contractorId ?? ''); setStaffId(workOrder.staffId ?? '');
      setPriority(workOrder.priority); setScheduledDate(workOrder.scheduledDate ?? ''); setTargetDate(workOrder.targetDate ?? '');
      setStatus(workOrder.status); setEstimate(workOrder.estimate ? String(workOrder.estimate) : '');
      setApprovedBudget(workOrder.approvedBudget ? String(workOrder.approvedBudget) : '');
    } else {
      setRequestId(presetRequest?.id ?? ''); setTitle(''); setDescription(presetRequest?.description ?? '');
      setScope(''); setContractorId(presetRequest?.assignedContractorId ?? ''); setStaffId(presetRequest?.assignedStaffId ?? '');
      setPriority(presetRequest?.priority ?? 'Normal'); setScheduledDate(''); setTargetDate(presetRequest?.targetDate ?? '');
      setStatus('Awaiting Assignment'); setEstimate(''); setApprovedBudget(presetRequest?.approvedBudget ? String(presetRequest.approvedBudget) : '');
    }
  }, [open, workOrder?.id, presetRequest?.id]);

  const save = () => {
    if (!requestId) { setError('Select the related maintenance request.'); return; }
    if (!title.trim()) { setError('Give the work order a title.'); return; }
    const payload = {
      requestId, title: title.trim(), description: description.trim(), scope: scope || undefined,
      contractorId: contractorId || undefined, staffId: staffId || undefined, priority,
      scheduledDate: scheduledDate || undefined, targetDate: targetDate || undefined,
      status: status as WorkOrder['status'],
      estimate: estimate ? num(estimate) : undefined,
      approvedBudget: approvedBudget ? num(approvedBudget) : undefined,
    };
    if (workOrder) {
      s.updateWorkOrder(workOrder.id, payload, `Work order ${workOrder.id} updated`);
      s.toast(`${workOrder.id} updated.`);
    } else {
      const id = s.nextWorkOrderId();
      s.addWorkOrder({ id, ...payload, createdAt: nowISO() });
      s.toast(`Work order ${id} created.`);
    }
    onClose();
  };

  return (
    <FormDrawer
      open={open}
      onClose={onClose}
      title={workOrder ? `Edit work order ${workOrder.id}` : 'New work order'}
      subtitle={workOrder ? 'Changes are recorded in the activity history.' : 'Creates a work order against an existing maintenance request.'}
      note={workOrder ? undefined : <>Will be created as <span className="u-num">{s.nextWorkOrderId()}</span></>}
      footer={
        <>
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton onClick={save}>{workOrder ? 'Save Changes' : 'Create Work Order'}</PrimaryButton>
        </>
      }
    >
      <FormError message={error} />

      <DrawerSection step="A" title="Request & scope" note="Required: a work order belongs to a request">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Related Maintenance Request" required className="sm:col-span-2">
            <SelectInput value={requestId} onChange={(e) => setRequestId(e.target.value)} disabled={!!presetRequest || !!workOrder}>
              <option value="">Select request…</option>
              {s.requests.map((r) => <option key={r.id} value={r.id}>{r.id} · {r.title} ({r.status})</option>)}
            </SelectInput>
          </Field>
          <Field label="Title" required className="sm:col-span-2"><TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Replace drain pump & test" /></Field>
          <Field label="Work Description" className="sm:col-span-2"><TextArea value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
          <Field label="Scope of Work" className="sm:col-span-2"><TextArea value={scope} onChange={(e) => setScope(e.target.value)} placeholder="Inclusions, exclusions, authorization limits…" /></Field>
        </div>
      </DrawerSection>

      <DrawerSection step="B" title="Assignment & schedule" note="Optional">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Contractor">
            <SelectInput value={contractorId} onChange={(e) => setContractorId(e.target.value)}>
              <option value="">Unassigned</option>
              {s.contractors.filter((c) => c.active).map((c) => <option key={c.id} value={c.id}>{c.company}</option>)}
            </SelectInput>
          </Field>
          <Field label="Assigned Staff">
            <SelectInput value={staffId} onChange={(e) => setStaffId(e.target.value)}>
              <option value="">Unassigned</option>
              {s.staff.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </SelectInput>
          </Field>
          <Field label="Priority">
            <SelectInput value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
              {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
            </SelectInput>
          </Field>
          <Field label="Status">
            <SelectInput value={status} onChange={(e) => setStatus(e.target.value)}>
              {WORKORDER_STATUSES.map((st) => <option key={st} value={st}>{st}</option>)}
            </SelectInput>
          </Field>
          <Field label="Scheduled Date"><TextInput type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} /></Field>
          <Field label="Target Completion"><TextInput type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} /></Field>
        </div>
      </DrawerSection>

      <DrawerSection step="C" title="Budget" note="Optional">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Estimate"><MoneyInput value={estimate} onChange={setEstimate} /></Field>
          <Field label="Approved Budget"><MoneyInput value={approvedBudget} onChange={setApprovedBudget} /></Field>
        </div>
      </DrawerSection>
    </FormDrawer>
  );
}

export function CompleteWorkOrderModal({
  open, onClose, workOrder,
}: {
  open: boolean; onClose: () => void; workOrder: WorkOrder | null;
}) {
  const s = useStore();
  const [notes, setNotes] = useState('');
  const [actualCost, setActualCost] = useState('');
  const [createExpense, setCreateExpense] = useState(true);
  const [invoiceRef, setInvoiceRef] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !workOrder) return;
    setNotes(''); setInvoiceRef(''); setError(''); setCreateExpense(true);
    setActualCost(workOrder.actualCost ? String(workOrder.actualCost) : workOrder.estimate ? String(workOrder.estimate) : '');
  }, [open, workOrder?.id]);

  if (!workOrder) return null;
  const req = s.requests.find((r) => r.id === workOrder.requestId);

  const save = () => {
    if (!notes.trim()) { setError('Completion notes are required.'); return; }
    const cost = num(actualCost);
    let expenseId: string | undefined;
    if (createExpense && cost > 0) {
      expenseId = s.nextExpenseId();
      const c = s.getContractor(workOrder.contractorId);
      s.addExpense({
        id: expenseId, description: `${workOrder.title} (${workOrder.id})`,
        vendor: c?.company ?? 'In-house', contractorId: workOrder.contractorId,
        propertyId: req?.propertyId, unitId: req?.unitId, category: 'Maintenance & Repairs',
        amount: cost, date: todayISO(), paymentStatus: 'Unpaid', invoiceRef: invoiceRef || undefined,
        linkedRequestId: workOrder.requestId, linkedWorkOrderId: workOrder.id,
      });
      if (req && !req.linkedExpenseIds.includes(expenseId)) {
        const eid = expenseId;
        setTimeout(() => s.updateRequest(req.id, { linkedExpenseIds: [...req.linkedExpenseIds, eid] }), 0);
      }
    }
    s.updateWorkOrder(workOrder.id, {
      status: 'Completed', completionNotes: notes.trim(),
      actualCost: cost || undefined, linkedExpenseId: expenseId ?? workOrder.linkedExpenseId,
    }, `Work order ${workOrder.id} completed${cost ? ` — actual cost ${fmtMoney(cost)}` : ''}${expenseId ? ` (expense ${expenseId} created in Bills & Expenses)` : ''}`);
    s.toast(`${workOrder.id} completed.`);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Complete Work Order ${workOrder.id}`}
      subtitle={workOrder.title}
      footer={
        <>
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton onClick={save}><CheckCircle2 size={15} /> Complete Work Order</PrimaryButton>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Completion Notes" required error={error}>
          <TextArea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Work performed, parts used, test results…" />
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Actual Cost"><MoneyInput value={actualCost} onChange={setActualCost} /></Field>
          <Field label="Invoice Reference"><TextInput value={invoiceRef} onChange={(e) => setInvoiceRef(e.target.value)} /></Field>
        </div>
        <label className="flex items-start gap-2 text-[12.5px] text-u-ink2">
          <input type="checkbox" checked={createExpense} onChange={(e) => setCreateExpense(e.target.checked)} className="mt-0.5 h-4 w-4 accent-u-accent" />
          <span>
            Create a matching expense in Bills & Expenses and link it to this request
            <span className="block text-[11.5px] text-u-muted">Uncheck if the invoice already exists there — link it from the request's Costs tab instead to avoid duplicates.</span>
          </span>
        </label>
      </div>
    </Modal>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Preventive maintenance schedule form
// ═════════════════════════════════════════════════════════════════════════════

export function PreventiveFormModal({
  open, onClose, schedule,
}: {
  open: boolean; onClose: () => void; schedule?: PreventiveSchedule | null;
}) {
  const s = useStore();
  const empty = {
    task: '', category: 'General Repairs', propertyId: '', unitId: '', assetId: '',
    frequency: 'Annual', customDays: '30', lastCompleted: '', nextDue: todayISO(),
    contractorId: '', estimatedCost: '', checklist: '', instructions: '', active: true,
  };
  const [f, setF] = useState(empty);
  const [error, setError] = useState('');
  const set = (k: keyof typeof empty, v: string | boolean) => setF((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    if (!open) return;
    setError('');
    if (schedule) {
      setF({
        task: schedule.task, category: schedule.category, propertyId: schedule.propertyId,
        unitId: schedule.unitId ?? '', assetId: schedule.assetId ?? '', frequency: schedule.frequency,
        customDays: schedule.customDays ? String(schedule.customDays) : '30',
        lastCompleted: schedule.lastCompleted ?? '', nextDue: schedule.nextDue,
        contractorId: schedule.contractorId ?? '', estimatedCost: schedule.estimatedCost ? String(schedule.estimatedCost) : '',
        checklist: schedule.checklist.join('\n'), instructions: schedule.instructions ?? '', active: schedule.active,
      });
    } else setF(empty);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, schedule?.id]);

  const save = () => {
    if (!f.task.trim()) { setError('Give the task a name.'); return; }
    if (!f.propertyId) { setError('Select a property.'); return; }
    if (!f.nextDue) { setError('Set the next due date.'); return; }
    const payload: Omit<PreventiveSchedule, 'id'> = {
      task: f.task.trim(), category: f.category, propertyId: f.propertyId,
      unitId: f.unitId || undefined, assetId: f.assetId || undefined,
      frequency: f.frequency as PreventiveSchedule['frequency'],
      customDays: f.frequency === 'Custom' ? Math.max(1, num(f.customDays)) : undefined,
      lastCompleted: f.lastCompleted || undefined, nextDue: f.nextDue,
      contractorId: f.contractorId || undefined,
      estimatedCost: f.estimatedCost ? num(f.estimatedCost) : undefined,
      checklist: f.checklist.split('\n').map((x) => x.trim()).filter(Boolean),
      instructions: f.instructions || undefined, active: f.active,
    };
    if (schedule) {
      s.updateSchedule(schedule.id, payload);
      s.toast(`${schedule.id} updated.`);
    } else {
      const id = s.nextScheduleId();
      s.addSchedule({ id, ...payload });
      s.toast(`Schedule ${id} created.`);
    }
    onClose();
  };

  const propertyAssets = s.assets.filter((a) => a.propertyId === f.propertyId && ['Active', 'Under Inspection', 'Under Repair'].includes(a.status));

  return (
    <FormDrawer
      open={open}
      onClose={onClose}
      title={schedule ? `Edit schedule ${schedule.id}` : 'New inspection schedule'}
      subtitle={schedule ? 'Changes are recorded in the activity history.' : 'A recurring inspection or service task for a property, unit or asset.'}
      note={schedule ? undefined : <>Will be created as <span className="u-num">{s.nextScheduleId()}</span></>}
      footer={
        <>
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton onClick={save}>{schedule ? 'Save Changes' : 'Create Schedule'}</PrimaryButton>
        </>
      }
    >
      <FormError message={error} />

      <DrawerSection step="A" title="Task" note="Required: name and frequency">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Task Name" required className="sm:col-span-2">
            <TextInput value={f.task} onChange={(e) => set('task', e.target.value)} placeholder="e.g. Annual furnace service & safety check" />
          </Field>
          <Field label="Category">
            <SelectInput value={f.category} onChange={(e) => set('category', e.target.value)}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </SelectInput>
          </Field>
          <Field label="Frequency">
            <SelectInput value={f.frequency} onChange={(e) => set('frequency', e.target.value)}>
              {FREQUENCIES.map((x) => <option key={x} value={x}>{x}</option>)}
            </SelectInput>
          </Field>
          {f.frequency === 'Custom' && (
            <Field label="Custom Interval (days)"><TextInput type="number" min="1" value={f.customDays} onChange={(e) => set('customDays', e.target.value)} /></Field>
          )}
        </div>
      </DrawerSection>

      <DrawerSection step="B" title="Location & asset" note="Property is required">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Property" required>
            <SelectInput value={f.propertyId} onChange={(e) => { set('propertyId', e.target.value); set('unitId', ''); set('assetId', ''); }}>
              <option value="">Select property…</option>
              {s.properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </SelectInput>
          </Field>
          <Field label="Unit / Common Area">
            <SelectInput value={f.unitId} onChange={(e) => set('unitId', e.target.value)} disabled={!f.propertyId}>
              <option value="">Whole property / common areas</option>
              {s.unitsForProperty(f.propertyId).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </SelectInput>
          </Field>
          <Field label="Related Asset" className="sm:col-span-2">
            <SelectInput value={f.assetId} onChange={(e) => set('assetId', e.target.value)} disabled={!f.propertyId}>
              <option value="">— None —</option>
              {propertyAssets.map((a) => <option key={a.id} value={a.id}>{a.id} · {a.name}</option>)}
            </SelectInput>
          </Field>
        </div>
      </DrawerSection>

      <DrawerSection step="C" title="Schedule & assignment" note="Next due date is required">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Assigned Contractor">
            <SelectInput value={f.contractorId} onChange={(e) => set('contractorId', e.target.value)}>
              <option value="">In-house / TBD</option>
              {s.contractors.filter((c) => c.active).map((c) => <option key={c.id} value={c.id}>{c.company}</option>)}
            </SelectInput>
          </Field>
          <Field label="Estimated Cost"><MoneyInput value={f.estimatedCost} onChange={(v) => set('estimatedCost', v)} /></Field>
          <Field label="Last Completed"><TextInput type="date" value={f.lastCompleted} onChange={(e) => set('lastCompleted', e.target.value)} /></Field>
          <Field label="Next Due Date" required><TextInput type="date" value={f.nextDue} onChange={(e) => set('nextDue', e.target.value)} /></Field>
          <Field label="Status">
            <div className="flex h-[38px] items-center gap-2">
              <button
                type="button"
                onClick={() => set('active', !f.active)}
                className={cn('relative h-5.5 w-10 rounded-full transition', f.active ? 'bg-u-accent' : 'bg-u-s3')}
                style={{ height: 22 }}
              >
                <span className={cn('absolute top-0.5 h-[18px] w-[18px] rounded-full bg-u-ink transition-all', f.active ? 'left-[20px]' : 'left-0.5')} />
              </button>
              <span className="text-[12.5px] text-u-ink2">{f.active ? 'Active' : 'Inactive'}</span>
            </div>
          </Field>
        </div>
      </DrawerSection>

      <DrawerSection step="D" title="Checklist & instructions" note="Optional">
        <div className="grid grid-cols-1 gap-3">
          <Field label="Checklist (one item per line)">
            <TextArea value={f.checklist} onChange={(e) => set('checklist', e.target.value)} placeholder={'Inspect heat exchanger\nClean burners\nTest CO levels'} />
          </Field>
          <Field label="Instructions">
            <TextArea value={f.instructions} onChange={(e) => set('instructions', e.target.value)} />
          </Field>
        </div>
      </DrawerSection>
    </FormDrawer>
  );
}
