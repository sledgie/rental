import { useEffect, useMemo, useState } from 'react';
import { api, qs } from '../api.js';
import { money, money0 } from '../format.js';
import { Avatar, PhotoField } from '../photo.jsx';
import { Badge, Chips, Field, FormError, FormFooter, Modal, PageHeader, SearchBox, Status, useForm, useLoad } from '../ui.jsx';

const TSTATUS = { applicant: ['Applicant', 'b-sys'], active: ['Active', 'b-ok'], pending_in: ['Pending move-in', 'b-warn'], pending_out: ['Pending move-out', 'b-warn'], past: ['Past tenant', 'b-off'] };
const TABS = [['all', 'All'], ['active', 'Active'], ['applicant', 'Applicants'], ['pending_in', 'Pending move-in'], ['pending_out', 'Pending move-out'], ['past', 'Past']];

function TenantForm({ tenant, units, presetUnit, onClose, onSaved }) {
  const form = useForm(
    { first: tenant?.first || '', last: tenant?.last || '', email: tenant?.email || '', phone: tenant?.phone || '', status: tenant?.status || (presetUnit ? 'active' : 'applicant'), unitId: tenant?.unitId || presetUnit || '', photo: tenant?.photo || '', moveIn: tenant?.moveIn || (presetUnit ? new Date().toISOString().slice(0, 10) : '') },
    (f) => (tenant ? api.put(`/tenants/${tenant.id}`, f) : api.post('/tenants', f)),
    () => onSaved(tenant ? 'Tenant saved' : 'Tenant added'),
  );
  const { f, set, setF, errors } = form;
  const options = useMemo(() => units.filter((u) => !['maintenance', 'unavailable'].includes(u.status) || u.tenants.some((t) => t.id === tenant?.id)), [units, tenant]);
  return (
    <Modal title={tenant ? 'Edit tenant' : 'New tenant'} onClose={onClose} footer={<FormFooter busy={form.busy} onSave={form.submit} onClose={onClose} />}>
      <FormError errors={errors} />
      <PhotoField label="Picture" hint="Shown when you hover over the tenant on the Properties page. A default picture is used without one." value={f.photo} name={`${f.first} ${f.last}`} onChange={(photo) => setF((x) => ({ ...x, photo }))} error={errors.photo} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Field label="First name" required error={errors.first}><input className="inp" value={f.first} onChange={set('first')} /></Field>
        <Field label="Last name" required error={errors.last}><input className="inp" value={f.last} onChange={set('last')} /></Field>
      </div>
      <Field label="Email" error={errors.email}><input className="inp" type="email" value={f.email} onChange={set('email')} placeholder="name@example.com" /></Field>
      <Field label="Phone"><input className="inp" type="tel" value={f.phone} onChange={set('phone')} /></Field>
      <Field label="Status" required error={errors.status}><select className="inp" value={f.status} onChange={set('status')}>{Object.entries(TSTATUS).map(([k, v]) => <option key={k} value={k}>{v[0]}</option>)}</select></Field>
      <Field label="Unit" hint="A unit can have more than one tenant. Choosing one creates the lease." error={errors.unit}>
        <select className="inp" value={f.unitId} onChange={set('unitId')}><option value="">None</option>{options.map((u) => <option key={u.id} value={u.id}>{u.propertyName} &middot; {u.number} &middot; {money0(u.rent || 0)}/mo</option>)}</select>
      </Field>
      <Field label="Move-in date" error={errors.moveIn}><input className="inp" type="date" value={f.moveIn} onChange={set('moveIn')} /></Field>
    </Modal>
  );
}

export default function Tenants({ property, notify, refreshProps, params = {} }) {
  const { data, error, loading, reload } = useLoad(() => api.get(`/tenants${qs({ property })}`), [property]);
  const us = useLoad(() => api.get('/units'), []);
  const [tab, setTab] = useState('all'); const [q, setQ] = useState(''); const [modal, setModal] = useState(null);
  const list = (data || []).filter((t) => (tab === 'all' || t.status === tab) && (!q.trim() || `${t.first} ${t.last} ${t.email || ''}`.toLowerCase().includes(q.trim().toLowerCase())));
  const saved = (m) => { setModal(null); notify(m); reload(); us.reload(); refreshProps(); };
  const moveOut = async (t) => { try { await api.post(`/tenants/${t.id}/move-out`); notify(`${t.first} ${t.last} moved out`); reload(); us.reload(); } catch (e) { notify(e.message); } };
  // Links from the Properties page: #/tenants?tenant=ID opens that tenant, #/tenants?add=UNIT_ID starts a new tenant for the unit.
  useEffect(() => {
    if (params.add && us.data) setModal({ unit: params.add });
    else if (params.tenant && data) { const t = data.find((x) => x.id === params.tenant); if (t) setModal({ t }); else notify('Tenant not found'); }
  }, [params.add, params.tenant, data, us.data]); // eslint-disable-line react-hooks/exhaustive-deps
  const close = () => { setModal(null); if (params.add || params.tenant) window.location.hash = '#/tenants'; };
  const active = (data || []).filter((t) => t.status === 'active').length;
  return (
    <>
      <PageHeader title="Tenants" sub={<>{active} active &middot; {(data || []).length} total</>} action="Add tenant" onAction={() => setModal({})} />
      <div className="bar">
        <Chips options={TABS} value={tab} onChange={setTab} />
        <SearchBox label="Search tenants" value={q} onChange={setQ} style={{ marginLeft: 'auto' }} />
      </div>
      <Status loading={loading && !data} error={error} onRetry={reload} />
      {data && (
        <div className="card" style={{ padding: 8 }}><div className="tw"><table>
          <thead><tr><th>Tenant</th><th>Unit</th><th className="r">Rent</th><th className="r">Balance</th><th>Status</th><th /></tr></thead>
          <tbody>
            {list.map((t) => (
              <tr key={t.id}>
                <td><div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Avatar photo={t.photo} size={34} name={`${t.first} ${t.last}`} /><div><b>{t.first} {t.last}</b><div className="sub" style={{ margin: 0, fontSize: 12 }}>{t.email || 'No email'}</div></div></div></td>
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
      {modal && <TenantForm tenant={modal.t} presetUnit={modal.unit} units={us.data || []} onClose={close} onSaved={(m) => { saved(m); close(); }} />}
    </>
  );
}
