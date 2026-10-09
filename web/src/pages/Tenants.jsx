import { useMemo, useState } from 'react';
import { api, qs } from '../api.js';
import { money, money0 } from '../format.js';
import { Badge, Field, FormError, FormFooter, Modal, Status, useForm, useLoad } from '../ui.jsx';

const TSTATUS = { applicant: ['Applicant', 'b-sys'], active: ['Active', 'b-ok'], pending_in: ['Pending move-in', 'b-warn'], pending_out: ['Pending move-out', 'b-warn'], past: ['Past tenant', 'b-off'] };

function TenantForm({ tenant, units, onClose, onSaved }) {
  const form = useForm(
    { first: tenant?.first || '', last: tenant?.last || '', email: tenant?.email || '', phone: tenant?.phone || '', status: tenant?.status || 'applicant', unitId: tenant?.unitId || '', moveIn: tenant?.moveIn || '' },
    (f) => (tenant ? api.put(`/tenants/${tenant.id}`, f) : api.post('/tenants', f)),
    () => onSaved(tenant ? 'Tenant saved' : 'Tenant added'),
  );
  const { f, set, errors } = form;
  const options = useMemo(() => units.filter((u) => (!u.tenantId || u.tenantId === tenant?.id) && (!['maintenance', 'unavailable'].includes(u.status) || u.tenantId === tenant?.id)), [units, tenant]);
  return (
    <Modal title={tenant ? 'Edit tenant' : 'New tenant'} onClose={onClose} footer={<FormFooter busy={form.busy} onSave={form.submit} onClose={onClose} />}>
      <FormError errors={errors} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Field label="First name" required error={errors.first}><input className="inp" value={f.first} onChange={set('first')} /></Field>
        <Field label="Last name" required error={errors.last}><input className="inp" value={f.last} onChange={set('last')} /></Field>
      </div>
      <Field label="Email" error={errors.email}><input className="inp" type="email" value={f.email} onChange={set('email')} placeholder="name@example.com" /></Field>
      <Field label="Phone"><input className="inp" type="tel" value={f.phone} onChange={set('phone')} /></Field>
      <Field label="Status" required error={errors.status}><select className="inp" value={f.status} onChange={set('status')}>{Object.entries(TSTATUS).map(([k, v]) => <option key={k} value={k}>{v[0]}</option>)}</select></Field>
      <Field label="Unit" hint="Only available units are listed. Choosing one creates the lease." error={errors.unit}>
        <select className="inp" value={f.unitId} onChange={set('unitId')}><option value="">None</option>{options.map((u) => <option key={u.id} value={u.id}>{u.propertyName} &middot; {u.number} &middot; {money0(u.rent || 0)}/mo</option>)}</select>
      </Field>
      <Field label="Move-in date" error={errors.moveIn}><input className="inp" type="date" value={f.moveIn} onChange={set('moveIn')} /></Field>
    </Modal>
  );
}

export default function Tenants({ property, notify, refreshProps }) {
  const { data, error, loading, reload } = useLoad(() => api.get(`/tenants${qs({ property })}`), [property]);
  const us = useLoad(() => api.get('/units'), []);
  const [tab, setTab] = useState('all'); const [q, setQ] = useState(''); const [modal, setModal] = useState(null);
  const list = (data || []).filter((t) => (tab === 'all' || t.status === tab) && (!q.trim() || `${t.first} ${t.last} ${t.email || ''}`.toLowerCase().includes(q.trim().toLowerCase())));
  const saved = (m) => { setModal(null); notify(m); reload(); us.reload(); refreshProps(); };
  const moveOut = async (t) => { try { await api.post(`/tenants/${t.id}/move-out`); notify(`${t.first} ${t.last} moved out`); reload(); us.reload(); } catch (e) { notify(e.message); } };
  const active = (data || []).filter((t) => t.status === 'active').length;
  return (
    <>
      <div className="bar"><div><h1>Tenants</h1><div className="sub">{active} active &middot; {(data || []).length} total</div></div><button className="btn pri" style={{ marginLeft: 'auto' }} onClick={() => setModal({})}>Add tenant</button></div>
      <div className="bar">
        {[['all', 'All'], ['active', 'Active'], ['applicant', 'Applicants'], ['pending_in', 'Pending move-in'], ['pending_out', 'Pending move-out'], ['past', 'Past']].map(([k, l]) => <button key={k} className={`chip${tab === k ? ' on' : ''}`} onClick={() => setTab(k)}>{l}</button>)}
        <label style={{ marginLeft: 'auto', minWidth: 200 }}><span style={{ position: 'absolute', left: -9999 }}>Search tenants</span><input className="inp" placeholder="Search tenants" value={q} onChange={(e) => setQ(e.target.value)} /></label>
      </div>
      <Status loading={loading && !data} error={error} onRetry={reload} />
      {data && (
        <div className="card" style={{ padding: 8 }}><div className="tw"><table>
          <thead><tr><th>Tenant</th><th>Unit</th><th className="r">Rent</th><th className="r">Balance</th><th>Status</th><th /></tr></thead>
          <tbody>
            {list.map((t) => (
              <tr key={t.id}>
                <td><div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><span style={{ width: 34, height: 34, borderRadius: 17, background: 'var(--blue-soft)', color: 'var(--blue)', fontWeight: 800, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>{(t.first[0] || '') + (t.last[0] || '')}</span><div><b>{t.first} {t.last}</b><div className="sub" style={{ margin: 0, fontSize: 12 }}>{t.email || 'No email'}</div></div></div></td>
                <td>{t.unitNumber ? `${t.propertyName} \u00b7 ${t.unitNumber}` : '-'}</td>
                <td className="r">{t.rent ? money0(t.rent) : '-'}</td>
                <td className="r">{t.balance > 0 ? <b className="bad">{money(t.balance)}</b> : money(t.balance)}</td>
                <td><Badge cls={TSTATUS[t.status][1]}>{TSTATUS[t.status][0]}</Badge></td>
                <td className="r" style={{ whiteSpace: 'nowrap' }}><button className="btn link" onClick={() => setModal({ t })}>Edit</button>{(t.status === 'active' || t.status === 'pending_out') && <button className="btn link dng" onClick={() => moveOut(t)}>Move out</button>}</td>
              </tr>
            ))}
            {!list.length && <tr><td colSpan="6" style={{ color: 'var(--muted)' }}>No tenants match.</td></tr>}
          </tbody>
        </table></div></div>
      )}
      {modal && <TenantForm tenant={modal.t} units={us.data || []} onClose={() => setModal(null)} onSaved={saved} />}
    </>
  );
}
