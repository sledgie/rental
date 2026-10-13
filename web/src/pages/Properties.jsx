import { useEffect, useRef, useState } from 'react';
import { api, qs } from '../api.js';
import { money, money0 } from '../format.js';
import { Icon, propertyHues } from '../icons.jsx';
import { Avatar, shrinkImage } from '../photo.jsx';
import { BILL_TYPES, ScheduleForm, ScheduleRow, VendorPicker, todayStr, useScheduleActions } from '../billing.jsx';
import { Badge, Chips, Field, FormError, FormFooter, Modal, PageHeader, Status, useForm, useLoad } from '../ui.jsx';

const PTYPES = ['Single family', 'Multi-family', 'Apartment building', 'Condo', 'Commercial', 'Mixed use', 'Other'];
const USTATUS = { occupied: ['Occupied', 'b-ok'], vacant: ['Vacant', 'b-warn'], reserved: ['Reserved', 'b-sys'], maintenance: ['Maintenance', 'b-bad'], unavailable: ['Unavailable', 'b-off'] };



function ImageField({ value, hues, onChange, error }) {
  const [msg, setMsg] = useState('');
  const pick = async (e) => {
    const file = e.target.files?.[0]; e.target.value = ''; if (!file) return;
    try { onChange(await shrinkImage(file)); setMsg(''); } catch (x) { setMsg(x.message); }
  };
  const bg = value ? `url(${value}) center/cover` : `linear-gradient(135deg, hsl(${hues[0]} 70% 55%), hsl(${hues[1]} 75% 40%))`;
  return (
    <Field label="Property picture" hint="Shown with a gradient on the property card. Without one, a gradient and building icon are used." error={error || msg}>
      <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ width: 120, height: 80, borderRadius: 12, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,.9)', flex: 'none' }}>{!value && <Icon name="building" size={34} />}</div>
        <label className="btn sm" style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>{value ? 'Change picture' : 'Choose picture'}<input type="file" accept="image/*" onChange={pick} style={{ display: 'none' }} /></label>
        {value && <button type="button" className="btn link dng" onClick={() => onChange('')}>Remove</button>}
      </div>
    </Field>
  );
}

function PropertyForm({ property, onClose, onSaved }) {
  const form = useForm(
    { name: property?.name || '', type: property?.type || 'Multi-family', address: property?.address || '', city: property?.city || '', region: property?.region || 'ON', postalCode: property?.postalCode || '', image: property?.image || '' },
    (f) => (property ? api.put(`/properties/${property.id}`, f) : api.post('/properties', f)),
    () => onSaved(property ? 'Property saved' : 'Property added'),
  );
  const { f, set, setF, errors } = form;
  return (
    <Modal title={property ? 'Edit property' : 'New property'} onClose={onClose} footer={<FormFooter busy={form.busy} onSave={form.submit} onClose={onClose} />}>
      <FormError errors={errors} />
      <ImageField value={f.image} hues={propertyHues(property?.id || 'new')} onChange={(image) => setF((x) => ({ ...x, image }))} error={errors.image} />
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

function Schedules({ list, actions }) {
  if (!list.length) return null;
  const order = { overdue: 0, soon: 1, ok: 2, paused: 3, done: 4 };
  const sorted = [...list].sort((a, b) => order[a.state] - order[b.state]);
  return (
    <div style={{ marginTop: 14, borderTop: '1px solid var(--line)', paddingTop: 10 }}>
      <b style={{ fontSize: 13 }}>Bill schedule</b>
      {sorted.slice(0, 3).map((x) => <ScheduleRow key={x.id} s={x} actions={actions} />)}
      {sorted.length > 3 && <a className="sub" href="#/bill-schedule" style={{ fontSize: 12 }}>+{sorted.length - 3} more schedules</a>}
    </div>
  );
}

function BillForm({ property, type, vendors, onClose, onSaved }) {
  const form = useForm(
    { type, propertyId: property.id, vendorId: null, payee: '', date: todayStr(), due: todayStr(), amount: '', notes: '' },
    (f) => api.post('/bills', f).then((r) => ({ ...r, type: f.type })),
    (r) => onSaved(`${BILL_TYPES.find(([k]) => k === r.type)?.[1] || 'Expense'} added to ${property.name}`),
  );
  const { f, set, setF, errors } = form;
  return (
    <Modal title={`Add expense · ${property.name}`} onClose={onClose} footer={<FormFooter busy={form.busy} onSave={form.submit} onClose={onClose} />}>
      <FormError errors={errors} />
      <Field label="Bill type" required error={errors.type}><select className="inp" value={f.type} onChange={set('type')}>{BILL_TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
      <Field label="Property"><input className="inp" value={property.name} disabled /></Field>
      <Field label="Vendor" required hint="Pick a saved vendor or type a new one" error={errors.payee}><VendorPicker vendors={vendors} value={f.payee} vendorId={f.vendorId} onChange={(payee, vendorId) => setF((x) => ({ ...x, payee, vendorId }))} /></Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <Field label="Bill date" required error={errors.date}><input className="inp" type="date" value={f.date} onChange={set('date')} /></Field>
        <Field label="Due date" required error={errors.due}><input className="inp" type="date" value={f.due} onChange={set('due')} /></Field>
        <Field label="Amount ($)" required error={errors.amount}><input className="inp" type="number" min="0" step="0.01" inputMode="decimal" value={f.amount} onChange={set('amount')} placeholder="0.00" /></Field>
      </div>
      <Field label="Notes"><textarea className="inp" rows="2" value={f.notes} onChange={set('notes')} /></Field>
      <div className="sub">Posted as an expense in its own Chart of Accounts line and added to Bills due.</div>
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

const TYPE_ICON = { 'Single family': 'house', Condo: 'building' };

const TENANT_STATUS = { applicant: 'Applicant', active: 'Active', pending_in: 'Pending move-in', pending_out: 'Pending move-out', past: 'Past tenant' };

// Tenant name that links to the Tenants page and shows a details card (with picture) on hover or keyboard focus.
function TenantLink({ t, unit }) {
  const [pos, setPos] = useState(null);
  const show = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const left = Math.min(Math.max(8, r.left), window.innerWidth - 300);
    setPos(r.top > 260 ? { left, bottom: window.innerHeight - r.top + 8 } : { left, top: r.bottom + 8 });
  };
  return (
    <>
      <a className="tlink" href={`#/tenants?tenant=${t.id}`} onMouseEnter={show} onMouseLeave={() => setPos(null)} onFocus={show} onBlur={() => setPos(null)} aria-describedby={pos ? `tp-${t.id}` : undefined}>{t.name}</a>
      {pos && (
        <div className="tpop" id={`tp-${t.id}`} role="tooltip" style={pos}>
          <div className="tpop-head">
            <Avatar photo={t.photo} size={64} name={t.name} />
            <div style={{ minWidth: 0 }}><b style={{ fontSize: 16 }}>{t.name}</b><div><Badge cls={t.status === 'active' ? 'b-ok' : t.status === 'past' ? 'b-off' : 'b-warn'}>{TENANT_STATUS[t.status] || t.status}</Badge></div></div>
          </div>
          <div className="tpop-row"><span>Unit</span><b>{unit}</b></div>
          <div className="tpop-row"><span>Email</span><b>{t.email || '-'}</b></div>
          <div className="tpop-row"><span>Phone</span><b>{t.phone || '-'}</b></div>
          <div className="tpop-row"><span>Moved in</span><b>{t.moveIn || '-'}</b></div>
          <div className="tpop-row"><span>Balance</span><b className={t.balance > 0 ? 'bad' : ''}>{t.balance > 0 ? `${money(t.balance)} owing` : 'Paid up'}</b></div>
          <div className="sub" style={{ margin: '8px 0 0', fontSize: 11 }}>Click the name to open in Tenants</div>
        </div>
      )}
    </>
  );
}

// One unit inside a property card: status, rent, pending payment and every tenant (each links to the Tenants page).
function UnitTile({ u, onEdit }) {
  const owing = u.pending > 0;
  return (
    <div className="utile">
      <div className="uhead">
        <span className="uicon"><Icon name="door" size={18} /></span>
        <b>Unit {u.number}</b>
        <Badge cls={USTATUS[u.status][1]}>{USTATUS[u.status][0]}</Badge>
        <button className="btn link" style={{ marginLeft: 'auto', height: 28 }} aria-label={`Edit unit ${u.number}`} onClick={onEdit}><Icon name="pencil" size={14} /></button>
      </div>
      <div className="umeta">
        <span><Icon name="bed" size={14} /> {u.bedrooms || 0} bed</span>
        <span><Icon name="bath" size={14} /> {u.bathrooms || 0} bath</span>
        <span><Icon name="dollar" size={14} /> {money0(u.rent || 0)}/mo</span>
        {u.type && <span className="sub" style={{ margin: 0 }}>{u.type}</span>}
      </div>
      <div className="utenants">
        <Icon name="user" size={15} style={{ marginTop: 3, color: 'var(--muted)' }} />
        <div>
          {u.tenants.length ? u.tenants.map((t, i) => (
            <span key={t.id}>{i > 0 && <span className="sep"> / </span>}<TenantLink t={t} unit={`${u.propertyName} \u00b7 ${u.number}`} /></span>
          )) : <span className="sub" style={{ margin: 0 }}>No tenant</span>}
          {u.status !== 'maintenance' && u.status !== 'unavailable' && <a className="tadd" href={`#/tenants?add=${u.id}`}><Icon name="plus" size={12} /> Add tenant</a>}
        </div>
      </div>
      <div className={`upay ${owing ? 'owe' : 'ok'}`}>
        <Icon name={owing ? 'alert' : 'check'} size={14} />
        {owing ? `Pending payment ${money(u.pending)}` : 'No pending payment'}
      </div>
    </div>
  );
}

const Metric = ({ icon, tone = '', label, children }) => (
  <div className="metric"><span className={`mic ${tone}`}><Icon name={icon} size={18} /></span><div><div className="mlabel">{label}</div><div className="mval">{children}</div></div></div>
);

function PropertyCard({ p, units, schedules, actions, onEdit, onAddUnit, onEditUnit, onBill, onSchedule }) {
  const pc = p.unitCount ? Math.round((p.occupied / p.unitCount) * 100) : 0;
  const [h1, h2] = propertyHues(p.id);
  const owing = units.reduce((n, u) => n + (u.pending > 0 ? u.pending : 0), 0);
  const typeIcon = TYPE_ICON[p.type] || 'building';
  return (
    <article className="card pcard">
      <header className="phero">
        <div className="part" style={{ background: p.image
          ? `linear-gradient(135deg, hsla(${h1} 70% 50% / .5), hsla(${h2} 75% 35% / .65)), url(${p.image}) center/cover`
          : `linear-gradient(135deg, hsl(${h1} 70% 55%), hsl(${h2} 75% 40%))` }} aria-hidden="true">
          {!p.image && <Icon name={typeIcon} size={72} />}
        </div>
        <div className="ptext">
          <span className="ptype"><Icon name={typeIcon} size={14} />{p.type}</span>
          <h2>{p.name}</h2>
          <div className="paddr"><Icon name="pin" size={15} />{p.address}, {p.city}</div>
          <div className="pchips">
            <span className="pchip">{p.unitCount} {p.unitCount === 1 ? 'unit' : 'units'}</span>
            <span className="pchip">{pc}% occupied</span>
            {owing > 0 && <span className="pchip bad">{money0(owing)} pending</span>}
          </div>
        </div>
      </header>
      <div className="pmetrics">
        <Metric icon="dollar" label="Income this month">{money0(p.income)}</Metric>
        <Metric icon="check" tone="ok" label="Net operating income"><span className="good">{money0(p.noi)}</span></Metric>
        <Metric icon="door" label="Occupancy">{p.occupied} of {p.unitCount}</Metric>
        <Metric icon="alert" tone={owing ? 'bad' : 'ok'} label="Pending rent"><span className={owing ? 'bad' : ''}>{money0(owing)}</span></Metric>
      </div>
      <div className="pbody">
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 12 }}><span>Occupancy</span><span>{pc}%</span></div>
        <div className="hb"><i style={{ width: `${pc}%` }} /></div>

        <div className="psec">
          <b><Icon name="door" size={17} /> Units</b>
          <button className="btn sm" onClick={onAddUnit}><Icon name="plus" size={13} /> Add unit</button>
        </div>
        <div className="ugrid">
          {units.map((u) => <UnitTile key={u.id} u={u} onEdit={() => onEditUnit(u)} />)}
          {!units.length && <div className="sub" style={{ margin: 0 }}>No units yet. Add one to this property.</div>}
        </div>

        <div className="pfoot">
          <button className="btn sm" onClick={onEdit}><Icon name="pencil" size={13} /> Edit property</button>
          <button className="btn sm" onClick={onBill}><Icon name="receipt" size={13} /> Add Expenses</button>
          <button className="btn sm" onClick={onSchedule}>Schedule bill</button>
        </div>
        <Schedules list={schedules} actions={actions} />
      </div>
    </article>
  );
}

// Properties side by side: swipe or scroll sideways, use the arrows, or jump with the property chips.
function Carousel({ items, labels, render }) {
  const track = useRef(null); const [i, setI] = useState(0);
  const last = items.length - 1; const at = Math.min(i, Math.max(last, 0));
  const go = (n) => { const el = track.current; const k = Math.max(0, Math.min(last, n)); if (!el?.children[k]) return; el.scrollTo({ left: el.children[k].offsetLeft - el.children[0].offsetLeft, behavior: 'smooth' }); setI(k); };
  const onScroll = () => {
    const el = track.current; if (!el) return;
    let best = 0; let gap = Infinity;
    [...el.children].forEach((c, k) => { const d = Math.abs(c.offsetLeft - el.children[0].offsetLeft - el.scrollLeft); if (d < gap) { gap = d; best = k; } });
    setI(best);
  };
  useEffect(() => { if (i > last && last >= 0) setI(last); }, [i, last]);
  return (
    <section aria-roledescription="carousel" aria-label="Properties">
      {items.length > 1 && (
        <div className="carbar">
          <div className="carchips"><Chips options={labels.map((l, k) => [k, l])} value={at} onChange={go} /></div>
          <div className="carnav"><span>{at + 1} of {items.length}</span>
            <button aria-label="Previous property" disabled={at === 0} onClick={() => go(at - 1)}>&#8249;</button>
            <button aria-label="Next property" disabled={at === last} onClick={() => go(at + 1)}>&#8250;</button>
          </div>
        </div>
      )}
      <div className="car-track" ref={track} onScroll={onScroll} tabIndex={0} onKeyDown={(e) => { if (e.key === 'ArrowRight') go(at + 1); if (e.key === 'ArrowLeft') go(at - 1); }}>
        {items.map((it, k) => <div className="car-item" key={k} role="group" aria-roledescription="slide" aria-label={`${k + 1} of ${items.length}`}>{render(it)}</div>)}
      </div>
    </section>
  );
}

export default function Properties({ property, notify, refreshProps }) {
  const ps = useLoad(() => api.get('/properties'), []);
  const vs = useLoad(() => api.get('/vendors'), []);
  const ss = useLoad(() => api.get('/bill-schedules'), []);
  const actions = useScheduleActions(notify, ss.reload);
  const us = useLoad(() => api.get(`/units${qs({ property })}`), [property]);
  const [modal, setModal] = useState(null);
  const reload = () => { ps.reload(); us.reload(); refreshProps(); };
  const saved = (m) => { setModal(null); notify(m); reload(); vs.reload(); ss.reload(); };
  const list = (ps.data || []).filter((p) => !property || p.id === property);
  const units = us.data || [];
  const occ = units.filter((u) => u.status === 'occupied').length;
  return (
    <>
      <PageHeader title="Properties" sub={<>{list.length} {list.length === 1 ? 'property' : 'properties'} &middot; {units.length} units &middot; {occ} occupied</>} action="Add property" onAction={() => setModal({ kind: 'prop' })} />
      <Status loading={ps.loading && !ps.data} error={ps.error} onRetry={ps.reload} />
      <Status loading={false} error={us.error} onRetry={us.reload} />
      <Carousel items={list} labels={list.map((p) => p.name)} render={(p) => (
        <PropertyCard p={p} units={units.filter((u) => u.propertyId === p.id)} schedules={(ss.data || []).filter((x) => x.propertyId === p.id)} actions={actions}
          onEdit={() => setModal({ kind: 'prop', p })} onAddUnit={() => setModal({ kind: 'unit', defaultProperty: p.id })} onEditUnit={(u) => setModal({ kind: 'unit', u })}
          onBill={() => setModal({ kind: 'bill', p, type: 'electricity' })} onSchedule={() => setModal({ kind: 'schedule', p })} />
      )} />
      {modal?.kind === 'prop' && <PropertyForm property={modal.p} onClose={() => setModal(null)} onSaved={saved} />}
      {modal?.kind === 'bill' && <BillForm property={modal.p} type={modal.type} vendors={vs.data || []} onClose={() => setModal(null)} onSaved={saved} />}
      {modal?.kind === 'schedule' && <ScheduleForm property={modal.p} properties={ps.data || []} vendors={vs.data || []} onClose={() => setModal(null)} onSaved={saved} />}
      {modal?.kind === 'unit' && <UnitForm unit={modal.u} properties={ps.data || []} defaultProperty={modal.defaultProperty || property} onClose={() => setModal(null)} onSaved={saved} />}
    </>
  );
}
