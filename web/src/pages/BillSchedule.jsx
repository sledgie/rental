import { useState } from 'react';
import { api } from '../api.js';
import { money } from '../format.js';
import { DueBadge, ScheduleForm, repeatText, useScheduleActions } from '../billing.jsx';
import { Chips, PageHeader, Status, useLoad } from '../ui.jsx';

const TABS = [['all', 'All'], ['attention', 'Needs attention'], ['ok', 'Upcoming'], ['inactive', 'Paused / finished']];
const needsAction = (s) => s.state === 'overdue' || s.state === 'soon';

export default function BillSchedule({ property, notify }) {
  const ss = useLoad(() => api.get(`/bill-schedules${property ? `?property=${property}` : ''}`), [property]);
  const ps = useLoad(() => api.get('/properties'), []);
  const vs = useLoad(() => api.get('/vendors'), []);
  const [tab, setTab] = useState('all'); const [modal, setModal] = useState(null);
  const actions = useScheduleActions(notify, ss.reload);
  const data = ss.data || [];
  const shown = data.filter((s) => tab === 'all' || (tab === 'attention' && needsAction(s)) || (tab === 'ok' && s.state === 'ok') || (tab === 'inactive' && (s.state === 'paused' || s.state === 'done')));
  const saved = (m) => { setModal(null); notify(m); ss.reload(); vs.reload(); };
  const toggle = async (s) => { try { await api.post(`/bill-schedules/${s.id}/active`, { active: !s.active }); notify(s.active ? 'Schedule paused' : 'Schedule resumed'); ss.reload(); } catch (e) { notify(e.message); } };
  const remove = async (s) => {
    if (!window.confirm('Delete this schedule? Bills already posted stay in your books.')) return;
    try { await api.del(`/bill-schedules/${s.id}`); notify('Schedule deleted'); ss.reload(); } catch (e) { notify(e.message); }
  };
  const late = data.filter((s) => s.state === 'overdue').length; const soon = data.filter((s) => s.state === 'soon').length;
  return (
    <>
      <PageHeader title="Bill schedule" sub={<>{data.length} schedules &middot; {late} overdue &middot; {soon} due soon</>} action="New schedule" onAction={() => setModal({})} />
      <div className="bar"><Chips options={TABS} value={tab} onChange={setTab} /></div>
      <Status loading={ss.loading && !ss.data} error={ss.error} onRetry={ss.reload} />
      {ss.data && (
        <div className="card" style={{ padding: 8 }}><div className="tw"><table>
          <thead><tr><th>Bill</th><th>Vendor</th><th>Property</th><th>Repeats</th><th className="r">Amount</th><th>Ends</th><th>Status</th><th /></tr></thead>
          <tbody>
            {shown.map((s) => (
              <tr key={s.id}>
                <td><b>{s.label}</b></td><td>{s.vendorName}</td><td>{s.propertyName}</td><td>{repeatText(s)}</td><td className="r">{money(s.amount)}</td><td>{s.end || 'Never'}</td>
                <td><DueBadge s={s} /></td>
                <td className="r" style={{ whiteSpace: 'nowrap' }}>
                  {needsAction(s) && <button className="btn link" onClick={() => actions.post(s)}>Post bill</button>}
                  {needsAction(s) && <button className="btn link" onClick={() => actions.skip(s)}>Skip</button>}
                  {s.overdue > 1 && <button className="btn link" onClick={() => actions.skipAll(s)}>Skip all overdue</button>}
                  <button className="btn link" onClick={() => setModal({ s })}>Edit</button>
                  {s.state !== 'done' && <button className="btn link" onClick={() => toggle(s)}>{s.active ? 'Pause' : 'Resume'}</button>}
                  <button className="btn link dng" onClick={() => remove(s)}>Delete</button>
                </td>
              </tr>
            ))}
            {!shown.length && <tr><td colSpan="8" style={{ color: 'var(--muted)' }}>No schedules here. Add one for a bill that repeats, like monthly electricity.</td></tr>}
          </tbody>
        </table></div></div>
      )}
      {modal && <ScheduleForm schedule={modal.s} property={property ? (ps.data || []).find((p) => p.id === property) : null} properties={ps.data || []} vendors={vs.data || []} onClose={() => setModal(null)} onSaved={saved} />}
    </>
  );
}
