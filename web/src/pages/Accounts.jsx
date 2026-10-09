import { useEffect, useMemo, useState } from 'react';
import { api, qs } from '../api.js';
import { money } from '../format.js';
import { Badge, Field, FormError, FormFooter, Modal, Status, Table, useForm, useLoad } from '../ui.jsx';

const TYPES = [['asset', 'Assets', 'Asset'], ['liability', 'Liabilities', 'Liability'], ['equity', 'Equity', 'Equity'], ['income', 'Income', 'Income'], ['expense', 'Expenses', 'Expense']];
const RANGE = { asset: 1000, liability: 2000, equity: 3000, income: 4000, expense: 5000 };
const byCode = (a, b) => (a.code < b.code ? -1 : a.code > b.code ? 1 : 0);

function suggest(type, parentId, accounts) {
  const used = new Set(accounts.map((a) => a.code));
  if (parentId) {
    const p = accounts.find((a) => a.id === parentId); const base = parseInt(p?.code, 10);
    if (Number.isNaN(base)) return '';
    for (let i = 1; i < 10; i++) { const c = String(base + i * 10); if (!used.has(c)) return c; }
    for (let c = base + 1; c < base + 100; c++) if (!used.has(String(c))) return String(c);
    return '';
  }
  const lo = RANGE[type]; let mx = lo - 100;
  accounts.forEach((a) => { const n = parseInt(a.code, 10); if (a.type === type && !a.parentId && !Number.isNaN(n) && n >= lo && n < lo + 900 && n > mx) mx = n; });
  let c = Math.floor(mx / 100) * 100 + 100; while (used.has(String(c))) c += 100;
  return String(c);
}
const descendants = (accs, id) => accs.filter((a) => a.parentId === id).flatMap((k) => [k.id, ...descendants(accs, k.id)]);

function AccountForm({ account, accounts, onClose, onSaved }) {
  const sys = account?.system;
  const form = useForm(
    { type: account?.type || 'expense', name: account?.name || '', sub: !!account?.parentId, parentId: account?.parentId || '', code: account?.code || '', description: account?.description || '' },
    (f) => (account ? api.put(`/accounts/${account.id}`, f) : api.post('/accounts', f)),
    () => onSaved(account ? 'Account saved' : 'Account created'),
  );
  const { f, setF, set, errors } = form;
  const [touched, setTouched] = useState(!!account);
  const parents = useMemo(() => {
    const bad = account ? [account.id, ...descendants(accounts, account.id)] : [];
    return accounts.filter((a) => a.type === f.type && a.active && !bad.includes(a.id)).sort(byCode);
  }, [accounts, account, f.type]);
  useEffect(() => { if (!touched && !sys) setF((x) => ({ ...x, code: suggest(x.type, x.sub ? x.parentId : null, accounts) })); }, [f.type, f.sub, f.parentId, touched, sys, accounts, setF]);
  return (
    <Modal title={account ? 'Edit account' : 'New account'} onClose={onClose} footer={<FormFooter busy={form.busy} onSave={form.submit} onClose={onClose} />}>
      <FormError errors={errors} />
      <Field label="Account type" required hint="Decides where the account appears in reports" error={errors.type}>
        <select className="inp" value={f.type} disabled={sys} onChange={(e) => setF((x) => ({ ...x, type: e.target.value, parentId: '' }))}>{TYPES.map((t) => <option key={t[0]} value={t[0]}>{t[2]}</option>)}</select>
      </Field>
      <Field label="Account name" required error={errors.name}><input className="inp" maxLength={80} value={f.name} onChange={set('name')} placeholder="e.g. Snow Removal" /></Field>
      <label className="chk"><input type="checkbox" checked={f.sub} onChange={set('sub')} />Make this a sub-account</label>
      {f.sub && (
        <Field label="Parent account" required hint="Only active accounts of the same type are listed" error={errors.parent}>
          <select className="inp" value={f.parentId} onChange={set('parentId')}><option value="">Select a parent account</option>{parents.map((p) => <option key={p.id} value={p.id}>{p.code} &middot; {p.name}</option>)}</select>
        </Field>
      )}
      <Field label="Account code" required hint={account ? undefined : 'Suggested next free code. You can change it.'} error={errors.code}>
        <input className="inp" maxLength={12} value={f.code} disabled={sys} onChange={(e) => { setTouched(true); set('code')(e); }} />
      </Field>
      <Field label="Description" error={errors.description}><textarea className="inp" value={f.description} onChange={set('description')} placeholder="What is this account used for?" /></Field>
    </Modal>
  );
}

function Ledger({ account, property, onClose }) {
  const { data, error, loading } = useLoad(() => api.get(`/accounts/${account.id}/ledger${qs({ property })}`), [account.id, property]);
  const d = (data || []).reduce((s, l) => s + l.debit, 0), c = (data || []).reduce((s, l) => s + l.credit, 0);
  return (
    <Modal title={`${account.code} \u00b7 ${account.name}`} wide onClose={onClose}>
      <Status loading={loading} error={error} />
      {data && <Table heads={[{ label: 'Date' }, { label: 'Description' }, { label: 'Property' }, { label: 'Debit', right: true }, { label: 'Credit', right: true }]} rows={data.map((l) => [l.date, l.memo, l.property, l.debit ? money(l.debit) : '', l.credit ? money(l.credit) : ''])} foot={['Total', '', '', money(d), money(c)]} />}
    </Modal>
  );
}

export default function Accounts({ property, notify }) {
  const { data: accounts, error, loading, reload } = useLoad(() => api.get(`/accounts${qs({ property })}`), [property]);
  const [tab, setTab] = useState('all'); const [q, setQ] = useState(''); const [inactive, setInactive] = useState(false);
  const [modal, setModal] = useState(null);
  const sections = useMemo(() => {
    if (!accounts) return [];
    const kids = (id) => accounts.filter((a) => a.parentId === id).sort(byCode);
    const needle = q.trim().toLowerCase();
    return TYPES.filter((t) => tab === 'all' || tab === t[0]).map((t) => {
      const list = []; const walk = (a, d) => { list.push({ a, d }); kids(a.id).forEach((k) => walk(k, d + 1)); };
      accounts.filter((a) => a.type === t[0] && !a.parentId).sort(byCode).forEach((a) => walk(a, 0));
      return { t, list: list.filter((x) => (inactive || x.a.active) && (!needle || `${x.a.code} ${x.a.name}`.toLowerCase().includes(needle))) };
    }).filter((s) => s.list.length);
  }, [accounts, tab, q, inactive]);
  const toggle = async (a) => { try { await api.post(`/accounts/${a.id}/active`, { active: !a.active }); notify(`${a.active ? 'Deactivated' : 'Activated'} ${a.name}`); reload(); } catch (e) { notify(e.message); } };
  const saved = (m) => { setModal(null); notify(m); reload(); };
  return (
    <>
      <div className="bar"><div><h1>Chart of accounts</h1><div className="sub">Balances up to today{property ? ' for the selected property' : ''}</div></div><button className="btn pri" style={{ marginLeft: 'auto' }} onClick={() => setModal({ kind: 'form' })}>New account</button></div>
      <div className="bar">
        {[['all', 'All'], ...TYPES.map((t) => [t[0], t[1]])].map(([k, l]) => <button key={k} className={`chip${tab === k ? ' on' : ''}`} onClick={() => setTab(k)}>{l}</button>)}
        <label className="chk" style={{ marginLeft: 'auto', fontWeight: 600 }}><input type="checkbox" checked={inactive} onChange={(e) => setInactive(e.target.checked)} />Show inactive</label>
        <label style={{ minWidth: 200 }}><span style={{ position: 'absolute', left: -9999 }}>Search accounts</span><input className="inp" placeholder="Search by code or name" value={q} onChange={(e) => setQ(e.target.value)} /></label>
      </div>
      <Status loading={loading} error={error} onRetry={reload} />
      {accounts && (
        <div className="card" style={{ padding: 8 }}><div className="tw"><table>
          <thead><tr><th style={{ width: 90 }}>Code</th><th>Account</th><th>Detail type</th><th className="r">Balance</th><th /></tr></thead>
          <tbody>
            {sections.map((s) => [
              <tr key={s.t[0]} className="grp"><td colSpan="5">{s.t[1]}</td></tr>,
              ...s.list.map(({ a, d }) => (
                <tr key={a.id} style={a.active ? undefined : { opacity: 0.6 }}>
                  <td style={{ color: 'var(--muted)', fontWeight: 700 }}>{a.code}</td>
                  <td style={{ paddingLeft: 12 + d * 22 }}>{d > 0 && <span style={{ color: 'var(--muted)' }}>&#8627; </span>}<b>{a.name}</b> {a.system && <Badge cls="b-sys">System</Badge>}{!a.active && <> <Badge cls="b-off">Inactive</Badge></>}
                    {accounts.some((k) => k.parentId === a.id) && <div className="sub" style={{ fontSize: 12, margin: 0 }}>includes sub-accounts</div>}</td>
                  <td>{a.subtype || '-'}</td>
                  <td className="r"><b>{money(a.balance)}</b></td>
                  <td className="r" style={{ whiteSpace: 'nowrap' }}>
                    <button className="btn link" onClick={() => setModal({ kind: 'ledger', a })}>Ledger</button>
                    <button className="btn link" onClick={() => setModal({ kind: 'form', a })}>Edit</button>
                    {!a.system && <button className={`btn link${a.active ? ' dng' : ''}`} onClick={() => toggle(a)}>{a.active ? 'Deactivate' : 'Activate'}</button>}
                  </td>
                </tr>
              )),
            ])}
            {!sections.length && <tr><td colSpan="5" style={{ color: 'var(--muted)' }}>No accounts match.</td></tr>}
          </tbody>
        </table></div></div>
      )}
      {modal?.kind === 'form' && <AccountForm account={modal.a} accounts={accounts} onClose={() => setModal(null)} onSaved={saved} />}
      {modal?.kind === 'ledger' && <Ledger account={modal.a} property={property} onClose={() => setModal(null)} />}
    </>
  );
}
