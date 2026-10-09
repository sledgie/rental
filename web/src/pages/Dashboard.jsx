import { useState } from 'react';
import { api, qs } from '../api.js';
import { money, money0 } from '../format.js';
import { Modal, Status, Table, useLoad } from '../ui.jsx';

const tone = { danger: 'var(--danger)', warn: 'var(--expense)', blue: 'var(--blue)' };

function Kpi({ label, value, sub, cls, onClick }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag className="card kpi" onClick={onClick} style={onClick ? undefined : { cursor: 'default' }}>
      <div className="l">{label}</div><div className={`v ${cls || ''}`}>{value}</div><div className="s">{sub}</div>
    </Tag>
  );
}

function Chart({ series }) {
  const mx = Math.max(1, ...series.flatMap((s) => [s.i, s.e]));
  return (
    <svg viewBox="0 0 600 230" width="100%" role="img" aria-label="Monthly income versus expenses">
      {series.map((s, i) => {
        const cx = 50 + i * 95, hi = Math.round((s.i / mx) * 170), he = Math.round((s.e / mx) * 170);
        return (
          <g key={s.n}>
            <rect x={cx - 30} y={190 - hi} width="28" height={hi} rx="5" style={{ fill: 'var(--income)' }}><title>{`${s.n} income ${money0(s.i)}`}</title></rect>
            <rect x={cx + 2} y={190 - he} width="28" height={he} rx="5" style={{ fill: 'var(--expense)' }}><title>{`${s.n} expenses ${money0(s.e)}`}</title></rect>
            <text x={cx} y="214" textAnchor="middle" fontSize="12" fontWeight="600" style={{ fill: 'var(--muted)' }}>{s.n}</text>
          </g>
        );
      })}
      <line x1="10" y1="190" x2="590" y2="190" style={{ stroke: 'var(--line)' }} />
    </svg>
  );
}

export default function Dashboard({ property, period, notify }) {
  const { data, error, loading, reload } = useLoad(() => api.get(`/dashboard${qs({ property, period })}`), [property, period]);
  const [drill, setDrill] = useState(null);
  const open = async (kind) => { try { setDrill(await api.get(`/drill${qs({ kind, property, period })}`)); } catch (e) { notify(e.message); } };
  if (loading || error) return <><h1>Business overview</h1><Status loading={loading} error={error} onRetry={reload} /></>;
  const k = data.kpis;
  const nm = Math.max(1, ...data.noiByProperty.map((x) => x.noi));
  const fmt = (c, v) => (c.money && typeof v === 'number' ? money(v) : v);
  return (
    <>
      <div><h1>Business overview</h1><div className="sub">{data.label}</div></div>
      <div className="grid kpis">
        <Kpi label="Rental income" value={money0(k.income)} sub={data.label} onClick={() => open('income')} />
        <Kpi label="Expenses" value={money0(k.expenses)} sub={data.label} onClick={() => open('expenses')} />
        <Kpi label="Net operating income" value={money0(k.noi)} sub={k.income ? `${Math.round((k.noi / k.income) * 100)}% margin` : 'No income yet'} cls="good" onClick={() => open('noi')} />
        <Kpi label="Cash flow" value={money0(k.cash)} sub={data.label} cls={k.cash < 0 ? 'bad' : ''} onClick={() => open('cash')} />
        <Kpi label="Outstanding rent" value={money0(k.outstanding)} sub={k.outstanding ? 'View who owes' : 'All paid'} cls={k.outstanding ? 'bad' : ''} onClick={() => open('ar')} />
        <Kpi label="Bills due" value={money0(k.billsDue)} sub={k.billsDue ? 'Open bills' : 'None open'} onClick={() => open('ap')} />
        <Kpi label="Occupancy" value={`${k.occupancyPct}%`} sub={`${k.occupied} of ${k.units} units occupied`} />
      </div>
      <div className="grid two">
        <div className="card" style={{ gridColumn: 'span 2' }}>
          <div className="bar" style={{ justifyContent: 'space-between' }}>
            <b style={{ fontSize: 16 }}>Income vs expenses</b>
            <span className="sub" style={{ margin: 0, fontSize: 12, fontWeight: 600 }}><span className="dot" style={{ display: 'inline-block', background: 'var(--income)', marginRight: 6 }} />Income <span className="dot" style={{ display: 'inline-block', background: 'var(--expense)', margin: '0 6px 0 12px' }} />Expenses</span>
          </div>
          <Chart series={data.series} />
        </div>
        <div className="card">
          <b style={{ fontSize: 16, display: 'block', marginBottom: 8 }}>Needs attention</b>
          {data.alerts.length ? data.alerts.map((a, i) => (
            <div className="alert" key={i}><span className="dot" style={{ background: tone[a.tone] }} /><div><b>{a.t}</b><div className="sub" style={{ fontSize: 13, margin: 0 }}>{a.s}</div></div></div>
          )) : <div className="sub">Nothing needs attention.</div>}
        </div>
      </div>
      <div className="card">
        <b style={{ fontSize: 16, display: 'block', marginBottom: 14 }}>NOI by property &middot; {data.label}</b>
        {data.noiByProperty.map((x) => (
          <div key={x.id} style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}><span>{x.name}</span><span>{money0(x.noi)}</span></div>
            <div className="hb"><i style={{ width: `${Math.max(0, Math.round((x.noi / nm) * 100))}%` }} /></div>
          </div>
        ))}
      </div>
      {drill && (
        <Modal title={drill.title} wide onClose={() => setDrill(null)}>
          <Table heads={drill.columns.map((c) => ({ label: c.label, right: c.money }))} rows={drill.rows.map((r) => r.map((v, i) => fmt(drill.columns[i], v)))} foot={drill.total.map((v, i) => fmt(drill.columns[i], v))} empty="Nothing to show for this selection." />
        </Modal>
      )}
    </>
  );
}
