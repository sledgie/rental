// Lease terms the contract window will edit: which units a lease covers and who pays each utility.
//   units      one contract can cover several units (a family in three units) or the whole property
//   utilities  per bill type: landlord pays, tenants pay, or a percentage split; the tenants' part can be shared
//              between tenants by percentage (equal when no shares are given). See recharge.js for how bills use this.
import { Router } from 'express';
import { rows, tx, insert, newId, businessId, CURRENT_LEASE } from './db.js';
import { BILL_TYPES, UTILITY_TYPES } from './bills.js';
import { syncUnit } from './tenants.js';
import { fail, HttpError, wrap } from './util.js';

export const router = Router();
const PAYER = { landlord: 'LANDLORD', tenant: 'TENANT', split: 'SPLIT' };
const PAYER_NAME = Object.fromEntries(Object.entries(PAYER).map(([k, v]) => [v, k]));

async function findLease(id) {
  const b = await businessId();
  const l = (await rows(`SELECT RAWTOHEX(id) "id", RAWTOHEX(property_id) "propertyId", RAWTOHEX(unit_id) "leadUnit", status "status", monthly_rent_cents "rent" FROM lease WHERE id=HEXTORAW(:i) AND business_id=HEXTORAW(:b)`, { i: id, b }))[0];
  if (!l) throw new HttpError(404, 'Lease not found.');
  return l;
}
const isCurrent = (l) => l.status === 'ACTIVE' || l.status === 'DRAFT';

router.get('/:id', wrap(async (req, res) => {
  const l = await findLease(req.params.id);
  const [units, members, utils, shares] = await Promise.all([
    rows(`SELECT RAWTOHEX(u.id) "id", u.unit_number "number", lu.rent_cents "rent" FROM lease_unit lu JOIN unit u ON u.id=lu.unit_id WHERE lu.lease_id=HEXTORAW(:l) ORDER BY u.unit_number`, { l: l.id }),
    rows(`SELECT RAWTOHEX(t.id) "id", t.first_name || ' ' || t.last_name "name", lt.role "role" FROM lease_tenant lt JOIN tenant t ON t.id=lt.tenant_id WHERE lt.lease_id=HEXTORAW(:l) ORDER BY CASE lt.role WHEN 'PRIMARY' THEN 0 WHEN 'CO_TENANT' THEN 1 ELSE 2 END, t.last_name`, { l: l.id }),
    rows(`SELECT RAWTOHEX(id) "id", bill_type "type", payer "payer", tenant_pct "pct" FROM lease_utility WHERE lease_id=HEXTORAW(:l)`, { l: l.id }),
    rows(`SELECT RAWTOHEX(s.lease_utility_id) "uid", RAWTOHEX(s.tenant_id) "tenantId", s.pct "pct" FROM lease_utility_share s JOIN lease_utility u ON u.id=s.lease_utility_id WHERE u.lease_id=HEXTORAW(:l)`, { l: l.id }),
  ]);
  const byType = Object.fromEntries(utils.map((u) => [u.type.toLowerCase(), u]));
  res.json({
    id: l.id, propertyId: l.propertyId, leadUnitId: l.leadUnit, status: l.status.toLowerCase(), rent: l.rent / 100,
    units: units.map((u) => ({ id: u.id, number: u.number, rent: u.rent == null ? null : u.rent / 100 })),
    members: members.map((m) => ({ id: m.id, name: m.name, role: m.role.toLowerCase() })),
    utilities: UTILITY_TYPES.map((type) => { // every utility is listed; one without a row is paid by the landlord
      const u = byType[type];
      return { type, label: BILL_TYPES[type].label, payer: u ? PAYER_NAME[u.payer] : 'landlord', tenantPct: u ? Number(u.pct) : 0,
        shares: u ? shares.filter((s) => s.uid === u.id).map((s) => ({ tenantId: s.tenantId, pct: Number(s.pct) })) : [] };
    }),
  });
}));

// Body: { unitIds: [...] } or { wholeProperty: true }, optionally { rent } (the contract's total monthly rent in dollars).
router.put('/:id/units', wrap(async (req, res) => {
  const d = req.body || {}; const l = await findLease(req.params.id); const e = {};
  if (!isCurrent(l)) throw new HttpError(400, 'Only a current lease can be changed.');
  const free = await rows(`SELECT RAWTOHEX(u.id) "id", u.status "status" FROM unit u WHERE u.property_id=HEXTORAW(:p) AND u.archived_at IS NULL
    AND NOT EXISTS (SELECT 1 FROM lease_unit lu JOIN lease o ON o.id=lu.lease_id WHERE lu.unit_id=u.id AND o.id<>HEXTORAW(:l) AND o.status IN ${CURRENT_LEASE})`, { p: l.propertyId, l: l.id });
  const ok = new Map(free.map((u) => [u.id, u.status]));
  const want = d.wholeProperty ? free.filter((u) => u.status !== 'MAINTENANCE' && u.status !== 'UNAVAILABLE').map((u) => u.id) : (Array.isArray(d.unitIds) ? [...new Set(d.unitIds)] : []);
  if (d.wholeProperty) {
    const blocked = await rows(`SELECT COUNT(*) "n" FROM unit u WHERE u.property_id=HEXTORAW(:p) AND u.archived_at IS NULL AND u.id NOT IN (SELECT lu.unit_id FROM lease_unit lu WHERE lu.lease_id=HEXTORAW(:l))
      AND EXISTS (SELECT 1 FROM lease_unit x JOIN lease o ON o.id=x.lease_id WHERE x.unit_id=u.id AND o.id<>HEXTORAW(:l) AND o.status IN ${CURRENT_LEASE})`, { p: l.propertyId, l: l.id });
    if (blocked[0].n) e.unitIds = 'Another lease is using a unit in this property. End it first, or choose the units yourself.';
  }
  if (!want.includes(l.leadUnit)) want.push(l.leadUnit); // the lead unit always stays
  if (!e.unitIds && want.some((u) => !ok.has(u))) e.unitIds = 'Choose units in this property that are not on another lease.';
  else if (!e.unitIds && want.some((u) => u !== l.leadUnit && (ok.get(u) === 'MAINTENANCE' || ok.get(u) === 'UNAVAILABLE'))) e.unitIds = 'One of those units is not available.';
  let cents = null;
  if (d.rent !== undefined && d.rent !== null && d.rent !== '') { cents = Math.round(Number(d.rent) * 100); if (!Number.isFinite(cents) || cents < 0) e.rent = 'Enter the total monthly rent (0 or more).'; }
  fail(e);
  await tx(async (c) => {
    const have = (await c.execute('SELECT RAWTOHEX(unit_id) "id" FROM lease_unit WHERE lease_id=HEXTORAW(:l)', { l: l.id })).rows.map((x) => x.id);
    for (const u of have.filter((x) => !want.includes(x))) await c.execute('DELETE FROM lease_unit WHERE lease_id=HEXTORAW(:l) AND unit_id=HEXTORAW(:u)', { l: l.id, u });
    for (const u of want.filter((x) => !have.includes(x))) await insert(c, 'lease_unit', { id: newId(), lease_id: l.id, unit_id: u });
    if (cents !== null) await c.execute('UPDATE lease SET monthly_rent_cents=:r WHERE id=HEXTORAW(:l)', { r: cents, l: l.id });
    for (const u of new Set([...have, ...want])) await syncUnit(c, u); // dropped units become vacant, new ones follow the lease
  });
  res.json({ id: l.id, unitIds: want });
}));

// Body: { utilities: [{ type, payer: 'landlord'|'tenant'|'split', tenantPct, shares: [{ tenantId, pct }] }] }. Types left out stay as they are.
router.put('/:id/utilities', wrap(async (req, res) => {
  const l = await findLease(req.params.id); const list = Array.isArray(req.body?.utilities) ? req.body.utilities : [];
  if (!isCurrent(l)) throw new HttpError(400, 'Only a current lease can be changed.');
  const liable = new Set((await rows(`SELECT RAWTOHEX(tenant_id) "id" FROM lease_tenant WHERE lease_id=HEXTORAW(:l) AND role IN ('PRIMARY','CO_TENANT')`, { l: l.id })).map((x) => x.id));
  const e = {}; const clean = [];
  list.forEach((u, i) => {
    const key = `utilities.${i}`; const payer = PAYER[u.payer];
    if (!UTILITY_TYPES.includes(u.type)) { e[key] = 'Choose a utility.'; return; }
    if (!payer) { e[key] = 'Choose who pays.'; return; }
    const pct = payer === 'SPLIT' ? Number(u.tenantPct) : payer === 'TENANT' ? 100 : 0;
    if (payer === 'SPLIT' && !(pct > 0 && pct < 100)) { e[key] = 'Enter the tenants\' share, above 0 and below 100 percent.'; return; }
    const shares = payer === 'LANDLORD' ? [] : (Array.isArray(u.shares) ? u.shares : []);
    if (shares.length) {
      if (shares.some((s) => !liable.has(s.tenantId) || !(Number(s.pct) > 0))) { e[key] = 'Split between the primary and co-tenants only, each with a percentage above 0.'; return; }
      if (new Set(shares.map((s) => s.tenantId)).size !== shares.length) { e[key] = 'List each tenant once.'; return; }
      if (Math.abs(shares.reduce((a, s) => a + Number(s.pct), 0) - 100) > 0.01) { e[key] = 'The tenants\' percentages must add up to 100.'; return; }
    }
    clean.push({ type: u.type.toUpperCase(), payer, pct, shares });
  });
  fail(e);
  await tx(async (c) => {
    for (const u of clean) {
      await c.execute('DELETE FROM lease_utility WHERE lease_id=HEXTORAW(:l) AND bill_type=:t', { l: l.id, t: u.type }); // shares go with it (ON DELETE CASCADE)
      if (u.payer === 'LANDLORD') continue; // no row means the landlord pays
      const id = newId();
      await insert(c, 'lease_utility', { id, lease_id: l.id, bill_type: u.type, payer: u.payer, tenant_pct: u.pct });
      for (const s of u.shares) await insert(c, 'lease_utility_share', { id: newId(), lease_utility_id: id, tenant_id: s.tenantId, pct: Number(s.pct) });
    }
  });
  res.json({ id: l.id });
}));
