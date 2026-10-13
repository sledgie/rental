import { useMemo, useState } from 'react';
import { api, qs } from '../api.js';
import { money } from '../format.js';
import { Badge, Chips, Field, FormError, FormFooter, Modal, PageHeader, Status, useForm, useLoad } from '../ui.jsx';

const CSTATUS = { draft: ['Draft', 'b-sys'], open: ['Available', 'b-ok'], partial: ['Partly used', 'b-warn'], applied: ['Fully used', 'b-off'], void: ['Void', 'b-off'] };
const TABS = [['all', 'All'], ['open', 'Available'], ['partial', 'Partly used'], ['applied', 'Fully used'], ['void', 'Void']];
const todayStr = () => new Date().toISOString().slice(0, 10);

function CreditNoteForm({ tenants, onClose, onSaved }) {
  const form = useForm(
    { tenantId: '', date: todayStr(), subject: '', amount: '', reason: '', notes: '' },
    (f) => api.post('/credit-notes', f),
    (r) => onSaved(`Credit note ${r.number} issued`),
  );
  const { f, set, errors } = form;
  return (
    <Modal title="New credit note" onClose={onClose} footer={<FormFooter busy={form.busy} onSave={form.submit} onClose={onClose} />}>
      <FormError errors={errors} />
      <Field label="Tenant" required hint="The credit stays on the tenant's account until it is used against future rent." error={errors.tenant}>
        <select className="inp" value={f.tenantId} onChange={set('tenantId')}>
          <option value="">Choose a tenant</option>
          {tenants.map((t) => <option key={t.id} value={t.id}>{t.first} {t.last}{t.unitNumber ? ` · ${t.propertyName} ${t.unitNumber}` : ''}</option>)}
        </select>
      </Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Field label="Credit note date" required error={errors.date}><input className="inp" type="date" value={f.date} onChange={set('date')} /></Field>
        <Field label="Amount ($)" required error={errors.amount}><input className="inp" type="number" min="0" step="0.01" inputMode="decimal" value={f.amount} onChange={set('amount')} placeholder="0.00" /></Field>
      </div>
      <Field label="Subject"><input className="inp" value={f.subject} onChange={set('subject')} placeholder="e.g. Overpayment on September rent" /></Field>
      <Field label="Reason" required error={errors.reason}><textarea className="inp" rows="3" value={f.reason} onChange={set('reason')} placeholder="Why is this credit being given?" /></Field>
      <Field label="Notes for the tenant"><textarea className="inp" rows="2" value={f.notes} onChange={set('notes')} /></Field>
    </Modal>
  );
}

export default function CreditNotes({ property, notify }) {
  const { data, error, loading, reload } = useLoad(() => api.get(`/credit-notes${qs({ property })}`), [property]);
  const ts = useLoad(() => api.get('/tenants'), []);
  const [tab, setTab] = useState('all'); const [modal, setModal] = useState(false);
  const list = (data || []).filter((c) => tab === 'all' || c.status === tab);
  const available = useMemo(() => (data || []).reduce((s, c) => s + c.available, 0), [data]);
  const tenants = (ts.data || []).filter((t) => t.status !== 'past');
  const saved = (m) => { setModal(false); notify(m); reload(); };
  const voidIt = async (c) => { try { await api.post(`/credit-notes/${c.id}/void`); notify(`${c.number} voided`); reload(); } catch (e) { notify(e.message); } };
  return (
    <>
      <PageHeader title="Credit notes" sub={<>{money(available)} in credit available to tenants</>} action="New credit note" onAction={() => setModal(true)} />
      <div className="bar"><Chips options={TABS} value={tab} onChange={setTab} /></div>
      <Status loading={loading && !data} error={error} onRetry={reload} />
      {data && (
        <div className="card" style={{ padding: 8 }}><div className="tw"><table>
          <thead><tr><th>Number</th><th>Tenant</th><th>Date</th><th>Subject</th><th className="r">Amount</th><th className="r">Available</th><th>Status</th><th /></tr></thead>
          <tbody>
            {list.map((c) => (
              <tr key={c.id}>
                <td><b>{c.number}</b></td>
                <td>{c.tenantName}{c.unitNumber && <div className="sub" style={{ margin: 0, fontSize: 12 }}>{c.propertyName} &middot; {c.unitNumber}</div>}</td>
                <td>{c.date}</td>
                <td>{c.subject || c.reason}</td>
                <td className="r">{money(c.amount)}</td>
                <td className="r">{money(c.available)}</td>
                <td><Badge cls={CSTATUS[c.status][1]}>{CSTATUS[c.status][0]}</Badge></td>
                <td className="r">{c.applied === 0 && c.status === 'open' && <button className="btn link dng" onClick={() => voidIt(c)}>Void</button>}</td>
              </tr>
            ))}
            {!list.length && <tr><td colSpan="8" style={{ color: 'var(--muted)' }}>No credit notes yet.</td></tr>}
          </tbody>
        </table></div></div>
      )}
      {modal && <CreditNoteForm tenants={tenants} onClose={() => setModal(false)} onSaved={saved} />}
    </>
  );
}
