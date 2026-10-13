// Pieces shared by the Properties, Bill schedule, Vendors and Dashboard pages.
import { useState } from 'react';
import { api } from './api.js';
import { money } from './format.js';
import { Badge, Field, FormError, FormFooter, Modal, useForm } from './ui.jsx';

export const BILL_TYPES = [['electricity', 'Electricity'], ['water', 'Water'], ['internet', 'Internet'], ['maintenance', 'Maintenance'], ['repairs', 'Repairs']];
export const todayStr = () => new Date().toISOString().slice(0, 10);
const FREQUENCIES = [['daily', 'Daily'], ['weekly', 'Weekly'], ['monthly', 'Monthly'], ['custom', 'Custom']];
const UNITS = [['day', 'days'], ['week', 'weeks'], ['month', 'months']];

// Text box that suggests saved vendors as you type. Picking one links the bill to it; any other text becomes a new vendor.
export function VendorPicker({ vendors, value, vendorId, onChange }) {
  const [open, setOpen] = useState(false);
  const q = value.trim().toLowerCase();
  const matches = vendors.filter((v) => !q || v.company.toLowerCase().includes(q)).slice(0, 6);
  const exact = vendors.some((v) => v.company.toLowerCase() === q);
  return (
    <div className="menu" style={{ display: 'block' }}>
      <input className="inp" style={{ width: '100%', boxSizing: 'border-box' }} role="combobox" aria-expanded={open} aria-autocomplete="list" autoComplete="off" value={value} placeholder="Start typing a vendor name"
        onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)} onChange={(e) => { onChange(e.target.value, null); setOpen(true); }} />
      {open && matches.length > 0 && !(exact && vendorId) && (
        <div className="menu-list" role="listbox" style={{ right: 0 }}>
          {matches.map((v) => <button key={v.id} role="option" onMouseDown={(e) => e.preventDefault()} onClick={() => { onChange(v.company, v.id); setOpen(false); }}>{v.company}{v.contact && <small style={{ color: 'var(--muted)', marginLeft: 8 }}>{v.contact}</small>}</button>)}
        </div>
      )}
      {q && !vendorId && !exact && <small style={{ color: 'var(--muted)' }}>New vendor: &ldquo;{value.trim()}&rdquo; will be added to Vendors.</small>}
    </div>
  );
}

// The little status pill for a schedule: overdue, due soon, next date, paused or finished.
export function DueBadge({ s }) {
  if (s.state === 'overdue') return <Badge cls="b-bad">{s.overdue} overdue</Badge>;
  if (s.state === 'soon') return <Badge cls="b-warn">{s.daysUntil === 0 ? 'Due today' : `Due in ${s.daysUntil} day${s.daysUntil === 1 ? '' : 's'}`}</Badge>;
  if (s.state === 'paused') return <Badge cls="b-off">Paused</Badge>;
  if (s.state === 'done') return <Badge cls="b-off">Finished</Badge>;
  return <Badge cls="b-ok">Next {s.next}</Badge>;
}
export const repeatText = (s) => (s.frequency === 'custom' ? `Every ${s.every} ${UNITS.find(([k]) => k === s.unit.toLowerCase())[1]}` : FREQUENCIES.find(([k]) => k === s.frequency)[1]);

// Post the next occurrence as a real bill, or skip it.
export function useScheduleActions(notify, reload) {
  const run = async (fn, msg) => { try { await fn(); notify(msg); reload(); } catch (e) { notify(e.message); } };
  return {
    post: (s) => run(() => api.post(`/bill-schedules/${s.id}/post`), `${s.label} bill posted for ${s.vendorName}`),
    skip: (s) => run(() => api.post(`/bill-schedules/${s.id}/skip`), `${s.label} bill skipped`),
    skipAll: (s) => run(() => api.post(`/bill-schedules/${s.id}/skip`, { all: true }), `Overdue ${s.label.toLowerCase()} bills skipped`),
  };
}

export function ScheduleForm({ schedule, property, properties, vendors, type, onClose, onSaved }) {
  const form = useForm(
    {
      type: schedule?.type || type || 'electricity', propertyId: schedule?.propertyId || property?.id || properties[0]?.id || '',
      vendorId: schedule?.vendorId || null, payee: schedule?.vendorName || '', amount: schedule ? (schedule.amount / 100).toFixed(2) : '',
      frequency: schedule?.frequency || 'monthly', every: schedule?.every || 1, unit: (schedule?.unit || 'MONTH').toLowerCase(),
      start: schedule?.start || todayStr(), end: schedule?.end || '', notes: schedule?.notes || '',
    },
    (f) => (schedule ? api.put(`/bill-schedules/${schedule.id}`, f) : api.post('/bill-schedules', f)),
    () => onSaved(schedule ? 'Schedule saved' : 'Bill schedule added'),
  );
  const { f, set, setF, errors } = form;
  const custom = f.frequency === 'custom';
  return (
    <Modal title={schedule ? 'Edit bill schedule' : 'New bill schedule'} onClose={onClose} footer={<FormFooter busy={form.busy} onSave={form.submit} onClose={onClose} />}>
      <FormError errors={errors} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Field label="Bill type" required error={errors.type}><select className="inp" value={f.type} onChange={set('type')}>{BILL_TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
        <Field label="Property" required error={errors.propertyId}><select className="inp" value={f.propertyId} onChange={set('propertyId')}>{properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
      </div>
      <Field label="Vendor" required hint="Pick a saved vendor or type a new one" error={errors.payee}>
        <VendorPicker vendors={vendors} value={f.payee} vendorId={f.vendorId} onChange={(payee, vendorId) => setF((x) => ({ ...x, payee, vendorId }))} />
      </Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Field label="Amount each time ($)" required error={errors.amount}><input className="inp" type="number" min="0" step="0.01" inputMode="decimal" value={f.amount} onChange={set('amount')} placeholder="0.00" /></Field>
        <Field label="Repeats" required error={errors.frequency}><select className="inp" value={f.frequency} onChange={set('frequency')}>{FREQUENCIES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
      </div>
      {custom && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Field label="Repeat every" required error={errors.every}><input className="inp" type="number" min="1" max="365" step="1" value={f.every} onChange={set('every')} /></Field>
          <Field label="Unit" required error={errors.unit}><select className="inp" value={f.unit} onChange={set('unit')}>{UNITS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Field label="First due date" required error={errors.start}><input className="inp" type="date" value={f.start} onChange={set('start')} /></Field>
        <Field label={custom ? 'Repeat until' : 'Repeat until (optional)'} required={custom} hint={custom ? undefined : 'Leave empty to keep repeating'} error={errors.end}><input className="inp" type="date" value={f.end} onChange={set('end')} /></Field>
      </div>
      <Field label="Notes"><textarea className="inp" rows="2" value={f.notes} onChange={set('notes')} /></Field>
      <div className="sub">You are reminded 7 days before each due date, and again when it is overdue. Nothing is posted until you press Post bill.</div>
    </Modal>
  );
}

// One schedule as a compact row with its Post / Skip buttons (property cards and the dashboard).
export function ScheduleRow({ s, actions, showProperty }) {
  const actionable = s.state === 'overdue' || s.state === 'soon';
  return (
    <div className="alert" style={{ alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <div style={{ flex: 1, minWidth: 160 }}>
        <b>{s.label}</b> &middot; {s.vendorName} &middot; {money(s.amount)}
        <div className="sub" style={{ fontSize: 12, margin: 0 }}>{showProperty ? `${s.propertyName} · ` : ''}{repeatText(s)}{s.next ? ` · due ${s.next}` : ''}</div>
      </div>
      <DueBadge s={s} />
      {actionable && actions && <><button className="btn sm" onClick={() => actions.post(s)}>Post bill</button><button className="btn link" onClick={() => actions.skip(s)}>Skip</button></>}
    </div>
  );
}
