import { useState } from 'react';
import { api, qs } from '../api.js';
import { money0 } from '../format.js';
import { Badge, Field, FormError, FormFooter, Modal, PageHeader, Status, useForm, useLoad } from '../ui.jsx';

const PTYPES = ['Single family', 'Multi-family', 'Apartment building', 'Condo', 'Commercial', 'Mixed use', 'Other'];
const USTATUS = { occupied: ['Occupied', 'b-ok'], vacant: ['Vacant', 'b-warn'], reserved: ['Reserved', 'b-sys'], maintenance: ['Maintenance', 'b-bad'], unavailable: ['Unavailable', 'b-off'] };

const Stat = ({ label, children }) => <div><div className="sub" style={{ margin: 0, fontSize: 12, fontWeight: 600 }}>{label}</div>{children}</div>;

function PropertyForm({ property, onClose, onSaved }) {
  const form = useForm(
    { name: property?.name || '', type: property?.type || 'Multi-family', address: property?.address || '', city: property?.city || '', region: property?.region || 'ON', postalCode: property?.postalCode || '' },
    (f) => (property ? api.put(`/properties/${property.id}`, f) : api.post('/properties', f)),
    () => onSaved(property ? 'Property saved' : 'Property added'),
  );
  const { f, set, errors } = form;
  return (
    <Modal title={property ? 'Edit property' : 'New property'} onClose={onClose} footer={<FormFooter busy={form.busy} onSave={form.submit} onClose={onClose} />}>
      <FormError errors={errors} />
      <Field label="Property name" required error={errors.name}><input className="inp" maxLength={80} value={f.name} onChange={set('name')} placeholder="e.g. 123 Main Street" /></Field>
      <Field label="Property type" required error={errors.type}><select className="inp" value={f.type} onChange={set('type')}>{PTYPES.map((t) => <option key={t}>{t}</option>)}</select></Field>
      <Field label="Street address" required error={errors.address}><input className="inp" value={f.address} onChange={set('address')} /></Field>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12 }}>
        <Field label="City" required error={errors.city}><input className="inp" value={f.city} onChange={set('city')} /></Field>
        <Field label="Province" required error={errors.region}><input className="inp" value={f.region} onChange={set('region')} /></Field>
        <Field label="Postal code" required error={errors.postalCode}><input className="inp" value={f.postalCode} onChange={set('postalCode')} /></Field>
      </div>
    </Modal>
  );
}

function UnitForm({ unit, properties, defaultProperty, onClose, onSaved }) {
  const form = useForm(
    { propertyId: unit?.propertyId || defaultProperty || properties[0]?.id || '', number: unit?.number || '', type: unit?.type || '', beds: unit?.bedrooms ?? '', baths: unit?.bathrooms ?? '', rent: unit ? (unit.rent / 100).toFixed(2) : '', status: unit?.status || 'vacant' },
    (f) => (unit ? api.put(`/units/${unit.id}`, f) : api.post('/units', f)),
    () => onSaved(unit ? 'Unit saved' : 'Unit added'),
  );
  const { f, set, errors } = form;
  return (
    <Modal title={unit ? 'Edit unit' : 'New unit'} onClose={onClose} footer={<FormFooter busy={form.busy} onSave={form.submit} onClose={onClose} />}>
      <FormError errors={errors} />
      <Field label="Property" required error={errors.propertyId}><select className="inp" value={f.propertyId} onChange={set('propertyId')}>{properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
      <Field label="Unit number" required error={errors.number}><input className="inp" maxLength={12} value={f.number} onChange={set('number')} placeholder="e.g. 105" /></Field>
      <Field label="Unit type"><input className="inp" value={f.type} onChange={set('type')} placeholder="e.g. 2 bed" /></Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Field label="Bedrooms"><input className="inp" type="number" min="0" step="0.5" value={f.beds} onChange={set('beds')} /></Field>
        <Field label="Bathrooms"><input className="inp" type="number" min="0" step="0.5" value={f.baths} onChange={set('baths')} /></Field>
      </div>
      <Field label="Monthly rent" required error={errors.rent}><input className="inp" type="number" min="0" step="0.01" value={f.rent} onChange={set('rent')} placeholder="0.00" /></Field>
      <Field label="Status" required hint="Occupied is set by assigning a tenant" error={errors.status}><select className="inp" value={f.status} onChange={set('status')}>{Object.entries(USTATUS).map(([k, v]) => <option key={k} value={k}>{v[0]}</option>)}</select></Field>
    </Modal>
  );
}

export default function Properties({ property, notify, refreshProps }) {
  const ps = useLoad(() => api.get('/properties'), []);
  const us = useLoad(() => api.get(`/units${qs({ property })}`), [property]);
  const [modal, setModal] = useState(null);
  const reload = () => { ps.reload(); us.reload(); refreshProps(); };
  const saved = (m) => { setModal(null); notify(m); reload(); };
  const list = (ps.data || []).filter((p) => !property || p.id === property);
  const units = us.data || [];
  const occ = units.filter((u) => u.status === 'occupied').length;
  return (
    <>
      <PageHeader title="Properties" sub={<>{list.length} {list.length === 1 ? 'property' : 'properties'} &middot; {units.length} units &middot; {occ} occupied</>} action="Add property" onAction={() => setModal({ kind: 'prop' })} />
      <Status loading={ps.loading && !ps.data} error={ps.error} onRetry={ps.reload} />
      <div className="grid two">
        {list.map((p) => { const pc = p.unitCount ? Math.round((p.occupied / p.unitCount) * 100) : 0; return (
          <div className="card" key={p.id}>
            <div className="bar" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}><div><b style={{ fontSize: 17 }}>{p.name}</b><div className="sub" style={{ margin: '2px 0 0' }}>{p.address}, {p.city}</div></div><Badge cls="b-sys">{p.type}</Badge></div>
            <div className="grid" style={{ gridTemplateColumns: 'repeat(3,1fr)', margin: '16px 0' }}>
              <Stat label="Income"><b>{money0(p.income)}</b></Stat>
              <Stat label="NOI"><b className="good">{money0(p.noi)}</b></Stat>
              <Stat label="Units"><b>{p.unitCount}</b></Stat>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 12 }}><span>Occupancy &middot; {p.occupied} of {p.unitCount} units</span><span>{pc}%</span></div>
            <div className="hb"><i style={{ width: `${pc}%` }} /></div>
            <div className="bar" style={{ marginTop: 14 }}><button className="btn sm" onClick={() => setModal({ kind: 'prop', p })}>Edit</button><button className="btn sm" onClick={() => setModal({ kind: 'unit', defaultProperty: p.id })}>Add unit</button></div>
          </div>); })}
      </div>
      <div className="card" style={{ padding: 8 }}>
        <div className="bar" style={{ padding: '12px 12px 0', justifyContent: 'space-between' }}><b style={{ fontSize: 16 }}>Units</b><button className="btn sm" onClick={() => setModal({ kind: 'unit' })}>Add unit</button></div>
        <Status loading={us.loading && !us.data} error={us.error} onRetry={us.reload} />
        <div className="tw"><table>
          <thead><tr><th>Unit</th><th>Property</th><th>Type</th><th>Tenant</th><th className="r">Rent</th><th>Status</th><th /></tr></thead>
          <tbody>
            {units.map((u) => <tr key={u.id}><td><b>{u.number}</b></td><td>{u.propertyName}</td><td>{u.type || '-'}</td><td>{u.tenantName || '-'}</td><td className="r">{money0(u.rent || 0)}</td><td><Badge cls={USTATUS[u.status][1]}>{USTATUS[u.status][0]}</Badge></td><td className="r"><button className="btn link" onClick={() => setModal({ kind: 'unit', u })}>Edit</button></td></tr>)}
            {!units.length && !us.loading && <tr><td colSpan="7" style={{ color: 'var(--muted)' }}>No units yet. Add one to a property.</td></tr>}
          </tbody>
        </table></div>
      </div>
      {modal?.kind === 'prop' && <PropertyForm property={modal.p} onClose={() => setModal(null)} onSaved={saved} />}
      {modal?.kind === 'unit' && <UnitForm unit={modal.u} properties={ps.data || []} defaultProperty={modal.defaultProperty || property} onClose={() => setModal(null)} onSaved={saved} />}
    </>
  );
}
