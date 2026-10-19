// TEMPORARY lease terms window (units covered + who pays utilities). It will be replaced by the contract window.
// Opened from the Tenants page ("Lease" button). Talks to /api/leases/:id (see server/src/leases.js).
import { useState } from 'react';
import { api } from './api.js';
import { Field, FormError, Modal, Status, useLoad } from './ui.jsx';

const PAYERS = [['landlord', 'Landlord pays'], ['tenant', 'Tenants pay all'], ['split', 'Split landlord / tenants']];
const num = (v) => (v === '' || v === null || v === undefined ? NaN : Number(v));

function UtilityRow({ u, liable, onChange, error }) {
  const set = (patch) => onChange({ ...u, ...patch });
  const unequal = u.shares !== null;
  const total = unequal ? u.shares.reduce((a, s) => a + (num(s.pct) || 0), 0) : 100;
  const toggle = (on) => set({ shares: on ? liable.map((m) => ({ tenantId: m.id, pct: String(Math.round((100 / liable.length) * 100) / 100) })) : null });
  return (
    <div className="card" style={{ padding: 12, marginBottom: 10 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12, alignItems: 'end' }}>
        <b>{u.label}</b>
        <select className="inp" aria-label={`${u.label} paid by`} value={u.payer} onChange={(e) => set({ payer: e.target.value })}>{PAYERS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
      </div>
      {u.payer === 'split' && (
        <Field label="Tenants pay (%)" hint={`The landlord pays the other ${Number.isFinite(num(u.tenantPct)) ? Math.round((100 - num(u.tenantPct)) * 100) / 100 : '...'}%.`}>
          <input className="inp" type="number" min="1" max="99" step="0.01" value={u.tenantPct} onChange={(e) => set({ tenantPct: e.target.value })} />
        </Field>
      )}
      {u.payer !== 'landlord' && liable.length > 1 && (
        <div style={{ marginTop: 8 }}>
          <label><input type="checkbox" checked={unequal} onChange={(e) => toggle(e.target.checked)} /> Share between tenants unequally (otherwise equally)</label>
          {unequal && (
            <div style={{ marginTop: 6 }}>
              {liable.map((m) => (
                <div key={m.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12, marginBottom: 4 }}>
                  <span>{m.name}</span>
                  <input className="inp" type="number" min="0" step="0.01" aria-label={`${m.name} share of ${u.label}`} value={u.shares.find((s) => s.tenantId === m.id)?.pct ?? ''}
                    onChange={(e) => set({ shares: u.shares.map((s) => (s.tenantId === m.id ? { ...s, pct: e.target.value } : s)) })} />
                </div>
              ))}
              <div className="sub" style={{ margin: 0, color: Math.abs(total - 100) > 0.01 ? 'var(--danger)' : undefined }}>Total {Math.round(total * 100) / 100}% (must be 100%)</div>
            </div>
          )}
        </div>
      )}
      {error && <div className="err">{error}</div>}
    </div>
  );
}

function Editor({ lease, units, onClose, onSaved }) {
  const memberIds = new Set(lease.members.map((m) => m.id));
  const liable = lease.members.filter((m) => m.role !== 'occupant');
  const mine = units.filter((u) => u.propertyId === lease.propertyId);
  const [chosen, setChosen] = useState(new Set(lease.units.map((u) => u.id)));
  const [rent, setRent] = useState(String(lease.rent));
  const [utils, setUtils] = useState(lease.utilities.map((u) => ({ ...u, tenantPct: u.payer === 'split' ? String(u.tenantPct) : '', shares: u.shares.length ? u.shares.map((s) => ({ ...s, pct: String(s.pct) })) : null })));
  const [errors, setErrors] = useState({}); const [busy, setBusy] = useState(false);
  const blocked = (u) => u.id !== lease.leadUnitId && (['maintenance', 'unavailable'].includes(u.status) || u.tenants.some((t) => !memberIds.has(t.id)));
  const flip = (id) => setChosen((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const whole = () => setChosen(new Set(mine.filter((u) => !blocked(u) || chosen.has(u.id)).map((u) => u.id)));

  const save = async () => {
    setBusy(true); setErrors({});
    try {
      await api.put(`/leases/${lease.id}/units`, { unitIds: [...chosen], rent: rent === '' ? undefined : rent });
      await api.put(`/leases/${lease.id}/utilities`, { utilities: utils.map((u) => ({ type: u.type, payer: u.payer, tenantPct: num(u.tenantPct), shares: u.payer !== 'landlord' && u.shares ? u.shares.map((s) => ({ tenantId: s.tenantId, pct: num(s.pct) })) : [] })) });
      onSaved('Lease terms saved');
    } catch (e) { setErrors(e.errors || { _: e.message }); } finally { setBusy(false); }
  };
  return (
    <Modal title="Lease terms" wide onClose={onClose} footer={<><button className="btn pri" disabled={busy} onClick={save}>{busy ? 'Saving...' : 'Save'}</button><button className="btn" onClick={onClose}>Cancel</button></>}>
      <FormError errors={errors} />
      <div className="sub">Temporary window. People on this lease: {lease.members.map((m) => `${m.name} (${m.role.replace('_', '-')})`).join(', ')}.</div>
      <h4 style={{ margin: '12px 0 6px' }}>Units on this contract</h4>
      {errors.unitIds && <div className="err">{errors.unitIds}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 6 }}>
        {mine.map((u) => (
          <label key={u.id} style={{ opacity: blocked(u) ? 0.5 : 1 }}>
            <input type="checkbox" checked={chosen.has(u.id)} disabled={u.id === lease.leadUnitId || (blocked(u) && !chosen.has(u.id))} onChange={() => flip(u.id)} /> {u.number}
            <span className="sub" style={{ margin: 0, fontSize: 12 }}> {u.id === lease.leadUnitId ? 'main unit' : blocked(u) ? 'not free' : u.status}</span>
          </label>
        ))}
      </div>
      <div style={{ margin: '8px 0' }}><button className="btn sm" type="button" onClick={whole}>Whole property</button></div>
      <Field label="Total monthly rent for the contract ($)" error={errors.rent} hint="One rent for all the units on this contract."><input className="inp" type="number" min="0" step="0.01" value={rent} onChange={(e) => setRent(e.target.value)} /></Field>
      <h4 style={{ margin: '12px 0 6px' }}>Who pays the utilities</h4>
      {utils.map((u, i) => <UtilityRow key={u.type} u={u} liable={liable} error={errors[`utilities.${i}`]} onChange={(n) => setUtils((l) => l.map((x, j) => (j === i ? n : x)))} />)}
    </Modal>
  );
}

export default function LeaseTerms({ leaseId, onClose, onSaved }) {
  const lease = useLoad(() => api.get(`/leases/${leaseId}`), [leaseId]);
  const units = useLoad(() => api.get('/units'), []);
  const err = lease.error || units.error;
  if (!lease.data || !units.data) return <Modal title="Lease terms" onClose={onClose}><Status loading={!err} error={err} onRetry={() => { lease.reload(); units.reload(); }} /></Modal>;
  return <Editor lease={lease.data} units={units.data} onClose={onClose} onSaved={onSaved} />;
}
