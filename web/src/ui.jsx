import { useCallback, useEffect, useState } from 'react';

export function useLoad(fn, deps) {
  const [s, set] = useState({ data: null, error: null, loading: true });
  const load = useCallback(() => {
    set((x) => ({ ...x, loading: true }));
    fn().then((data) => set({ data, error: null, loading: false })).catch((error) => set({ data: null, error, loading: false }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => { load(); }, [load]);
  return { ...s, reload: load };
}

export function Modal({ title, wide, onClose, children, footer }) {
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="ovl" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`dlg${wide ? ' wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="dh"><span>{title}</span><button className="btn sm" aria-label="Close" onClick={onClose}>&#10005;</button></div>
        <div className="db">{children}</div>
        {footer && <div className="df">{footer}</div>}
      </div>
    </div>
  );
}

export function Field({ label, required, hint, error, children }) {
  return (
    <label className="fld">
      <span>{label}{required && <span style={{ color: 'var(--danger)' }}> *</span>}</span>
      {children}
      {hint && <small>{hint}</small>}
      {error && <div className="err">{error}</div>}
    </label>
  );
}

export const Badge = ({ cls, children }) => <span className={`badge ${cls}`}>{children}</span>;

export function Table({ heads, rows, foot, empty = 'Nothing to show.' }) {
  return (
    <div className="tw">
      <table>
        <thead><tr>{heads.map((h, i) => <th key={i} className={h.right ? 'r' : undefined}>{h.label}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className={heads[j].right ? 'r' : undefined}>{c}</td>)}</tr>)}
          {!rows.length && <tr><td colSpan={heads.length} style={{ color: 'var(--muted)' }}>{empty}</td></tr>}
          {foot && <tr>{foot.map((c, j) => <td key={j} className={heads[j].right ? 'r' : undefined}><b>{c}</b></td>)}</tr>}
        </tbody>
      </table>
    </div>
  );
}

export function Status({ loading, error, onRetry }) {
  if (loading) return <div className="center">Loading...</div>;
  if (error) return <div className="card" style={{ borderColor: 'var(--danger)' }}><b className="bad">Could not load data.</b><div className="sub">{error.message}</div>{onRetry && <button className="btn sm" style={{ marginTop: 12 }} onClick={onRetry}>Try again</button>}</div>;
  return null;
}

export function PropertyBar({ properties, property, onProperty, period, onPeriod }) {
  return (
    <div className="bar">
      <select className="sel" aria-label="Property" value={property} onChange={(e) => onProperty(e.target.value)}>
        <option value="all">Rental Business &middot; All Properties</option>
        {(properties || []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      {onPeriod && (
        <select className="sel" aria-label="Period" value={period} onChange={(e) => onPeriod(e.target.value)}>
          <option value="month">Current month</option>
          <option value="ytd">Year to date</option>
        </select>
      )}
    </div>
  );
}

export function useForm(initial, save, onDone) {
  const [f, setF] = useState(initial);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => { const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value; setF((x) => ({ ...x, [k]: v })); };
  const submit = async () => {
    setBusy(true); setErrors({});
    try { onDone(await save(f)); } catch (e) { setErrors(e.errors || { _: e.message }); } finally { setBusy(false); }
  };
  return { f, setF, set, errors, busy, submit };
}

export const FormFooter = ({ busy, onSave, onClose }) => (
  <>
    <button className="btn pri" disabled={busy} onClick={onSave}>{busy ? 'Saving...' : 'Save'}</button>
    <button className="btn" onClick={onClose}>Cancel</button>
  </>
);
export const FormError = ({ errors }) => (errors._ ? <div className="err" role="alert">{errors._}</div> : null);
