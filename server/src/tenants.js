import { Router } from 'express';
import { rows, tx, insert, update, newId, businessId, byProperty, CURRENT_LEASE } from './db.js';
import { arByTenant } from './reports.js';
import { fail, HttpError, wrap, TENANT_STATUS, inv, today, addYear, text, optText } from './util.js';

export const router = Router();
const TI = inv(TENANT_STATUS);
const OCC = new Set(['active', 'pending_out']);
// Lease and unit status that go with a (non-past) tenant status.
const occupancy = (status) => (OCC.has(status) ? { lease: 'ACTIVE', unit: 'OCCUPIED' } : { lease: 'DRAFT', unit: 'RESERVED' });
// A unit can hold several tenants (co-tenants), so its status follows all of its current leases:
// any signed lease -> occupied, only drafts -> reserved, none -> vacant (maintenance/unavailable are left alone).
async function syncUnit(c, unitId) {
  const r = (await c.execute(`SELECT NVL(SUM(CASE WHEN status='ACTIVE' THEN 1 ELSE 0 END),0) "a", COUNT(*) "n" FROM lease WHERE unit_id=HEXTORAW(:u) AND status IN ${CURRENT_LEASE}`, { u: unitId })).rows[0];
  await c.execute(`UPDATE unit SET status=:s WHERE id=HEXTORAW(:u) AND status NOT IN ('MAINTENANCE','UNAVAILABLE')`, { s: r.a > 0 ? 'OCCUPIED' : r.n > 0 ? 'RESERVED' : 'VACANT', u: unitId });
}

router.get('/', wrap(async (req, res) => {
  const b = await businessId(); const binds = { b };
  const w = byProperty('l.property_id', req.query.property, binds);
  const r = await rows(`SELECT RAWTOHEX(t.id) "id", t.first_name "first", t.last_name "last", t.email "email", t.phone "phone", t.photo_data "photo", t.status "status",
      TO_CHAR(t.move_in_date,'YYYY-MM-DD') "moveIn", RAWTOHEX(l.unit_id) "unitId", u.unit_number "unitNumber", RAWTOHEX(l.property_id) "propertyId", pr.name "propertyName", l.monthly_rent_cents "rent"
    FROM tenant t LEFT JOIN lease l ON l.tenant_id=t.id AND l.status IN ${CURRENT_LEASE} LEFT JOIN unit u ON u.id=l.unit_id LEFT JOIN property pr ON pr.id=l.property_id
    WHERE t.business_id=HEXTORAW(:b)${w} ORDER BY t.last_name, t.first_name`, binds);
  const ar = await arByTenant(req.query.property || null);
  res.json(r.map((x) => ({ ...x, status: TI[x.status], balance: ar[x.id] || 0 })));
}));

async function unitState(unitId) {
  const r = await rows(`SELECT RAWTOHEX(property_id) "propertyId", status "status", market_rent_cents "rent" FROM unit WHERE id=HEXTORAW(:u)`, { u: unitId });
  if (!r.length) return null;
  const t = await rows(`SELECT RAWTOHEX(tenant_id) "tenantId" FROM lease WHERE unit_id=HEXTORAW(:u) AND status IN ${CURRENT_LEASE}`, { u: unitId });
  return { ...r[0], tenantIds: t.map((x) => x.tenantId) };
}
async function currentLease(tenantId) {
  const r = await rows(`SELECT RAWTOHEX(id) "id", RAWTOHEX(unit_id) "unitId" FROM lease WHERE tenant_id=HEXTORAW(:t) AND status IN ${CURRENT_LEASE}`, { t: tenantId });
  return r[0] || null;
}
async function validate(d, id) {
  const e = {};
  if (!text(d.first)) e.first = 'Enter a first name.';
  if (!text(d.last)) e.last = 'Enter a last name.';
  if (d.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email.trim())) e.email = 'Enter a valid email address.';
  if (!TENANT_STATUS[d.status]) e.status = 'Choose a status.';
  if (d.status !== 'past' && d.status !== 'applicant' && !d.unitId) e.unit = 'Choose a unit for this status.';
  if (d.unitId && d.status !== 'past') {
    const u = await unitState(d.unitId);
    if (!u) e.unit = 'Unit not found.';
    else if ((u.status === 'MAINTENANCE' || u.status === 'UNAVAILABLE') && !u.tenantIds.includes(id)) e.unit = 'That unit is not available.';
  }
  if (d.status === 'active' && !d.moveIn) e.moveIn = 'Enter the move-in date.';
  if (d.photo && (typeof d.photo !== 'string' || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(d.photo))) e.photo = 'Use a JPEG, PNG or WebP picture.';
  else if (d.photo && d.photo.length > 300000) e.photo = 'That picture is too large. Choose a smaller one.';
  fail(e);
}
async function attach(c, b, tenantId, d) {
  const u = await unitState(d.unitId); const start = d.moveIn || today(); const s = occupancy(d.status);
  await insert(c, 'lease', { id: newId(), business_id: b, property_id: u.propertyId, unit_id: d.unitId, tenant_id: tenantId, status: s.lease, start_date: start, end_date: addYear(start), monthly_rent_cents: u.rent || 0 });
  await syncUnit(c, d.unitId);
}
async function detach(c, lease) {
  await c.execute(`UPDATE lease SET status='TERMINATED', terminated_at=TO_DATE(:d,'YYYY-MM-DD') WHERE id=HEXTORAW(:l)`, { d: today(), l: lease.id });
  await syncUnit(c, lease.unitId);
}
const fields = (d) => ({ first_name: text(d.first), last_name: text(d.last), email: optText(d.email), phone: optText(d.phone), status: TENANT_STATUS[d.status], move_in_date: d.moveIn || null, ...(d.photo === undefined ? {} : { photo_data: d.photo || null }) });

router.post('/', wrap(async (req, res) => {
  const d = req.body || {}; await validate(d, null); const b = await businessId(); const id = newId();
  await tx(async (c) => { await insert(c, 'tenant', { id, business_id: b, ...fields(d) }); if (d.unitId && d.status !== 'past') await attach(c, b, id, d); });
  res.status(201).json({ id });
}));
router.put('/:id', wrap(async (req, res) => {
  const d = req.body || {}; const id = req.params.id; await validate(d, id); const b = await businessId();
  const lease = await currentLease(id);
  await tx(async (c) => {
    if (d.status === 'past') { if (lease) await detach(c, lease); }
    else if (lease && d.unitId === lease.unitId) {
      const s = occupancy(d.status);
      await c.execute('UPDATE lease SET status=:s WHERE id=HEXTORAW(:l)', { s: s.lease, l: lease.id });
      await syncUnit(c, lease.unitId);
    } else { if (lease) await detach(c, lease); if (d.unitId) await attach(c, b, id, d); }
    await update(c, 'tenant', id, { ...fields(d), ...(d.status === 'past' ? { move_out_date: today() } : {}) });
  });
  res.json({ id });
}));
router.post('/:id/move-out', wrap(async (req, res) => {
  const id = req.params.id;
  const t = await rows('SELECT RAWTOHEX(id) "id" FROM tenant WHERE id=HEXTORAW(:i)', { i: id }); if (!t.length) throw new HttpError(404, 'Tenant not found.');
  const lease = await currentLease(id);
  await tx(async (c) => { if (lease) await detach(c, lease); await update(c, 'tenant', id, { status: 'PAST', move_out_date: today() }); });
  res.json({ id });
}));
