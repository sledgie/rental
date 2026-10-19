import { useMemo } from 'react';
import { api } from '../api.js';
import { money0 } from '../format.js';
import { PhotoField } from '../photo.jsx';
import { Field, FormError, FormFooter, Modal, useForm } from '../ui.jsx';
import { STATUS } from './columns.js';

const TSTATUS = STATUS;

// Who is responsible for the unit: shown when someone else already lives there.
function RoleField({ unit, tenantId, value, onChange, error }) {
  if (!unit) return null;
  const others = unit.tenants.filter((t) => t.id !== tenantId);
  if (!others.length) return <div className="sub" style={{ marginTop: -4 }}>The first person on a unit becomes its primary tenant, responsible for the rent.</div>;
  const primary = others.find((t) => t.role === 'primary');
  return (
    <Field label="Role on this unit" required error={error}
      hint={`${primary ? `${primary.name} is the primary tenant. ` : ''}The balance is shared by the whole household. Occupants (for example children) are not on the lease and owe nothing.`}>
      <select className="inp" value={value} onChange={onChange}>
        <option value="co_tenant">Co-tenant (on the lease, can pay)</option>
        <option value="occupant">Occupant (not on the lease)</option>
        <option value="primary">Primary tenant (responsible for the rent)</option>
      </select>
    </Field>
  );
}

export default function TenantForm({ tenant, units, presetUnit, presetRole, onClose, onSaved }) {
  const form = useForm(
    { first: tenant?.first || '', last: tenant?.last || '', email: tenant?.email || '', phone: tenant?.phone || '', status: tenant?.status || (presetUnit ? 'active' : 'applicant'), unitId: tenant?.unitId || presetUnit || '', role: tenant?.role || presetRole || 'co_tenant', photo: tenant?.photo || '', moveIn: tenant?.moveIn || (presetUnit ? new Date().toISOString().slice(0, 10) : '') },
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
      <RoleField unit={units.find((u) => u.id === f.unitId)} tenantId={tenant?.id} value={f.role} onChange={set('role')} error={errors.role} />
      <Field label="Move-in date" error={errors.moveIn}><input className="inp" type="date" value={f.moveIn} onChange={set('moveIn')} /></Field>
    </Modal>
  );
}
