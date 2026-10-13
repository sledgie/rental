import { useState } from 'react';
import { api } from '../api.js';
import { money } from '../format.js';
import { DueBadge } from '../billing.jsx';
import { Field, FormError, FormFooter, Modal, PageHeader, SearchBox, Status, useForm, useLoad } from '../ui.jsx';

function VendorForm({ vendor, onClose, onSaved }) {
  const form = useForm(
    { company: vendor?.company || '', contact: vendor?.contact || '', phone: vendor?.phone || '', email: vendor?.email || '' },
    (f) => (vendor ? api.put(`/vendors/${vendor.id}`, f) : api.post('/vendors', f)),
    () => onSaved(vendor ? 'Vendor saved' : 'Vendor added'),
  );
  const { f, set, errors } = form;
  return (
    <Modal title={vendor ? 'Edit vendor' : 'New vendor'} onClose={onClose} footer={<FormFooter busy={form.busy} onSave={form.submit} onClose={onClose} />}>
      <FormError errors={errors} />
      <Field label="Vendor name" required error={errors.company}><input className="inp" value={f.company} onChange={set('company')} placeholder="e.g. City Hydro" /></Field>
      <Field label="Contact person"><input className="inp" value={f.contact} onChange={set('contact')} /></Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Field label="Phone"><input className="inp" type="tel" value={f.phone} onChange={set('phone')} /></Field>
        <Field label="Email" error={errors.email}><input className="inp" type="email" value={f.email} onChange={set('email')} /></Field>
      </div>
    </Modal>
  );
}

// Most urgent schedule for a vendor, as a badge with its bill type.
function vendorSchedules(all, vendorId) {
  const mine = (all || []).filter((s) => s.vendorId === vendorId);
  if (!mine.length) return '-';
  const order = { overdue: 0, soon: 1, ok: 2, paused: 3, done: 4 };
  const top = [...mine].sort((a, b) => order[a.state] - order[b.state])[0];
  return <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>{top.label}<DueBadge s={top} />{mine.length > 1 && <small>+{mine.length - 1}</small>}</span>;
}

export default function Vendors({ notify }) {
  const { data, error, loading, reload } = useLoad(() => api.get('/vendors'), []);
  const ss = useLoad(() => api.get('/bill-schedules'), []);
  const [q, setQ] = useState(''); const [modal, setModal] = useState(null);
  const list = (data || []).filter((v) => !q.trim() || `${v.company} ${v.contact || ''} ${v.email || ''}`.toLowerCase().includes(q.trim().toLowerCase()));
  const saved = (m) => { setModal(null); notify(m); reload(); };
  return (
    <>
      <PageHeader title="Vendors" sub={<>{(data || []).length} vendors &middot; bills added from the Properties page are linked here</>} action="Add vendor" onAction={() => setModal({})} />
      <div className="bar"><SearchBox label="Search vendors" value={q} onChange={setQ} style={{ marginLeft: 'auto' }} /></div>
      <Status loading={loading && !data} error={error} onRetry={reload} />
      {data && (
        <div className="card" style={{ padding: 8 }}><div className="tw"><table>
          <thead><tr><th>Vendor</th><th>Contact</th><th>Phone</th><th>Email</th><th>Scheduled bills</th><th className="r">Bills</th><th className="r">Total billed</th><th /></tr></thead>
          <tbody>
            {list.map((v) => (
              <tr key={v.id}>
                <td><b>{v.company}</b></td><td>{v.contact || '-'}</td><td>{v.phone || '-'}</td><td>{v.email || '-'}</td>
                <td>{vendorSchedules(ss.data, v.id)}</td><td className="r">{v.bills}</td><td className="r">{money(v.total)}</td>
                <td className="r"><button className="btn link" onClick={() => setModal({ v })}>Edit</button></td>
              </tr>
            ))}
            {!list.length && <tr><td colSpan="8" style={{ color: 'var(--muted)' }}>No vendors yet. They are added here or while entering a bill.</td></tr>}
          </tbody>
        </table></div></div>
      )}
      {modal && <VendorForm vendor={modal.v} onClose={() => setModal(null)} onSaved={saved} />}
    </>
  );
}
