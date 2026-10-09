import { Router } from 'express';
import { rows, tx, insert, update, newId, businessId } from './db.js';
import { arByTenant } from './reports.js';
import { fail, HttpError, wrap, TENANT_STATUS, inv, today, addYear } from './util.js';

export const router = Router();
const TI = inv(TENANT_STATUS);
const OCC = new Set(['active', 'pending_out']);

router.get('/', wrap(async (req, res) => {
  const b = await businessId(); const binds = { b }; let w = '';
  if (req.query.property) { w = ' AND l.property_id=HEXTORAW(:p)'; binds.p = req.query.property; }
  const r = await rows(`SELECT RAWTOHEX(t.id) "id", t.first_name "first", t.last_name "last", t.email "email", t.phone "phone", t.status "status",
      TO_CHAR(t.move_in_date,'YYYY-MM-DD') "moveIn", RAWTOHEX(l.unit_id) "unitId", u.unit_number "unitNumber", RAWTOHEX(l.property_id) "propertyId", pr.name "propertyName", l.monthly_rent_cents "rent"
    FROM tenant t LEFT JOIN lease l ON l.tenant_id=t.id AND l.status IN ('ACTIVE','DRAFT') LEFT JOIN unit u ON u.id=l.unit_id LEFT JOIN property pr ON pr.id=l.property_id
    WHERE t.business_id=HEXTORAW(:b)${w} ORDER BY t.last_name, t.first_name`, binds);
  const ar = await arByTenant(req.query.property || null);
  res.json(r.map((x) => ({ ...x, status: TI[x.status], balance: ar[x.id] || 0 })));
}));

async function unitState(unitId) {
  const r = await rows(`SELECT RAWTOHEX(u.property_id) "propertyId", u.status "status", u.market_rent_cents "rent", RAWTOHEX(l.tenant_id) "tenantId"
    FROM unit u LEFT JOIN lease l ON l.unit_id=u.id AND l.status IN ('ACTIVE','DRAFT') WHERE u.id=HEXTORAW(:u)`, { u: unitId });
  return r[0] || null;
}
async function currentLease(tenantId) {
  const r = await rows(`SELECT RAWTOHEX(id) "id", RAWTOHEX(unit_id) "unitId" FROM lease WHERE tenant_id=HEXTORAW(:t) AND status IN ('ACTIVE','DRAFT')`, { t: tenantId });
  return r[0] || null;
}
async function validate(d, id) {
  const e = {};
  if (!(d.first || '').trim()) e.first = 'Enter a first name.';
  if (!(d.last || '').trim()) e.last = 'Enter a last name.';
  if (d.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email.trim())) e.email = 'Enter a valid email address.';
  if (!TENANT_STATUS[d.status]) e.status = 'Choose a status.';
  if (d.status !== 'past' && d.status !== 'applicant' && !d.unitId) e.unit = 'Choose a unit for this status.';
  if (d.unitId && d.status !== 'past') {
    const u = await unitState(d.unitId);
    if (!u) e.unit = 'Unit not found.';
    else if (u.tenantId && u.tenantId !== id) e.unit = 'That unit already has a tenant.';
    else if ((u.status === 'MAINTENANCE' || u.status === 'UNAVAILABLE') && u.tenantId !== id) e.unit = 'That unit is not available.';
  }
  if (d.status === 'active' && !d.moveIn) e.moveIn = 'Enter the move-in date.';
  fail(e);
}
async function attach(c, b, tenantId, d) {
  const u = await unitState(d.unitId); const start = d.moveIn || today();
  const occ = OCC.has(d.status);
  await insert(c, 'lease', { id: newId(), business_id: b, property_id: u.propertyId, unit_id: d.unitId, tenant_id: tenantId, status: occ ? 'ACTIVE' : 'DRAFT', start_date: start, end_date: addYear(start), monthly_rent_cents: u.rent || 0 });
  await c.execute('UPDATE unit SET status=:s WHERE id=HEXTORAW(:u)', { s: occ ? 'OCCUPIED' : 'RESERVED', u: d.unitId });
}
async function detach(c, lease) {
  await c.execute(`UPDATE lease SET status='TERMINATED', terminated_at=TO_DATE(:d,'YYYY-MM-DD') WHERE id=HEXTORAW(:l)`, { d: today(), l: lease.id });
  await c.execute(`UPDATE unit SET status='VACANT' WHERE id=HEXTORAW(:u)`, { u: lease.unitId });
}
const fields = (d) => ({ first_name: d.first.trim(), last_name: d.last.trim(), email: (d.email || '').trim() || null, phone: (d.phone || '').trim() || null, status: TENANT_STATUS[d.status], move_in_date: d.moveIn || null });

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
      const occ = OCC.has(d.status);
      await c.execute('UPDATE lease SET status=:s WHERE id=HEXTORAW(:l)', { s: occ ? 'ACTIVE' : 'DRAFT', l: lease.id });
      await c.execute('UPDATE unit SET status=:s WHERE id=HEXTORAW(:u)', { s: occ ? 'OCCUPIED' : 'RESERVED', u: lease.unitId });
    } else { if (lease) await detach(c, lease); if (d.unitId) await attach(c, b, id, d); }
    await update(c, 'tenant', id, { ...fields(d), ...(d.status === 'past' ? { move_out_date: today() } : {}) });
  });
  res.json({ id });
}));
router.post('/:id/move-out', wrap(async (req, res) => {
  const id = req.params.id; const lease = await currentLease(id);
  const t = await rows('SELECT RAWTOHEX(id) "id" FROM tenant WHERE id=HEXTORAW(:i)', { i: id }); if (!t.length) throw new HttpError(404, 'Tenant not found.');
  await tx(async (c) => { if (lease) await detach(c, lease); await update(c, 'tenant', id, { status: 'PAST', move_out_date: today() }); });
  res.json({ id });
}));
