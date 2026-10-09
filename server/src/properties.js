import { Router } from 'express';
import { rows, tx, insert, update, newId, businessId, byProperty, CURRENT_LEASE } from './db.js';
import { loadLines } from './reports.js';
import { summarize, inPeriod } from './ledger.js';
import { fail, HttpError, wrap, PROPERTY_TYPE, UNIT_STATUSES, inv, text, optText } from './util.js';

export const properties = Router();
export const units = Router();
const PT = inv(PROPERTY_TYPE);

properties.get('/', wrap(async (req, res) => {
  const b = await businessId();
  const ps = await rows(`SELECT RAWTOHEX(id) "id", name "name", type "type", address_line1 "address", city "city", region "region", postal_code "postalCode" FROM property WHERE business_id=HEXTORAW(:b) ORDER BY name`, { b });
  const us = await rows(`SELECT RAWTOHEX(property_id) "pid", COUNT(*) "n", SUM(CASE WHEN status='OCCUPIED' THEN 1 ELSE 0 END) "occ" FROM unit WHERE business_id=HEXTORAW(:b) GROUP BY property_id`, { b });
  const ls = inPeriod(await loadLines(), 'month');
  res.json(ps.map((p) => { const u = us.find((x) => x.pid === p.id) || { n: 0, occ: 0 }; const s = summarize(ls.filter((l) => l.propertyId === p.id)); return { ...p, type: PT[p.type], unitCount: u.n, occupied: u.occ, income: s.income, noi: s.noi }; }));
}));
const ADDRESS_REQUIRED = { address: 'Enter the street address.', city: 'Enter the city.', region: 'Enter the province or state.', postalCode: 'Enter the postal code.' };
async function validateProperty(d, id) {
  const e = {}; const name = text(d.name); const b = await businessId();
  if (!name) e.name = 'Enter a property name.';
  else if ((await rows(`SELECT RAWTOHEX(id) "id" FROM property WHERE business_id=HEXTORAW(:b) AND LOWER(name)=LOWER(:n)`, { b, n: name })).some((x) => x.id !== id)) e.name = 'A property with this name already exists.';
  if (!PROPERTY_TYPE[d.type]) e.type = 'Choose a property type.';
  for (const [k, msg] of Object.entries(ADDRESS_REQUIRED)) if (!text(d[k])) e[k] = msg;
  fail(e);
}
const propFields = (d) => ({ name: text(d.name), type: PROPERTY_TYPE[d.type], address_line1: text(d.address), city: text(d.city), region: text(d.region), postal_code: text(d.postalCode) });
properties.post('/', wrap(async (req, res) => {
  const d = req.body || {}; await validateProperty(d, null); const id = newId(); const b = await businessId();
  await tx((c) => insert(c, 'property', { id, business_id: b, ...propFields(d) })); res.status(201).json({ id });
}));
properties.put('/:id', wrap(async (req, res) => {
  const d = req.body || {}; await validateProperty(d, req.params.id);
  await tx((c) => update(c, 'property', req.params.id, propFields(d))); res.json({ id: req.params.id });
}));

/* ---------------- units ---------------- */
units.get('/', wrap(async (req, res) => {
  const b = await businessId(); const binds = { b };
  const w = byProperty('u.property_id', req.query.property, binds);
  const r = await rows(`SELECT RAWTOHEX(u.id) "id", RAWTOHEX(u.property_id) "propertyId", p.name "propertyName", u.unit_number "number", u.unit_type "type",
      u.bedrooms "bedrooms", u.bathrooms "bathrooms", u.market_rent_cents "rent", u.status "status", RAWTOHEX(l.tenant_id) "tenantId", t.first_name || ' ' || t.last_name "tenantName"
    FROM unit u JOIN property p ON p.id=u.property_id LEFT JOIN lease l ON l.unit_id=u.id AND l.status IN ${CURRENT_LEASE} LEFT JOIN tenant t ON t.id=l.tenant_id
    WHERE u.business_id=HEXTORAW(:b)${w} ORDER BY p.name, u.unit_number`, binds);
  res.json(r.map((x) => ({ ...x, status: x.status.toLowerCase() })));
}));
async function validateUnit(d, id) {
  const e = {}; const b = await businessId(); const num = text(d.number);
  const self = id ? (await rows(`SELECT RAWTOHEX(l.tenant_id) "tenantId", RAWTOHEX(u.property_id) "propertyId" FROM unit u LEFT JOIN lease l ON l.unit_id=u.id AND l.status IN ${CURRENT_LEASE} WHERE u.id=HEXTORAW(:i)`, { i: id }))[0] : null;
  if (id && !self) throw new HttpError(404, 'Unit not found.');
  const tenanted = !!self?.tenantId;
  if (!d.propertyId) e.propertyId = 'Choose a property.';
  if (!num) e.number = 'Enter a unit number.';
  else if (d.propertyId && (await rows(`SELECT RAWTOHEX(id) "id" FROM unit WHERE business_id=HEXTORAW(:b) AND property_id=HEXTORAW(:p) AND LOWER(unit_number)=LOWER(:n)`, { b, p: d.propertyId, n: num })).some((x) => x.id !== id)) e.number = 'This unit number already exists in the property.';
  const rent = parseFloat(d.rent); if (Number.isNaN(rent) || rent < 0) e.rent = 'Enter the monthly rent (0 or more).';
  if (!UNIT_STATUSES.includes(d.status)) e.status = 'Choose a status.';
  if (d.status === 'occupied' && !tenanted) e.status = 'Assign a tenant to make a unit occupied.';
  if (tenanted && d.status !== 'occupied' && d.status !== 'reserved') e.status = 'Move the tenant out before changing this status.';
  if (tenanted && d.propertyId !== self.propertyId) e.propertyId = 'Move the tenant out before changing the property.';
  fail(e);
}
const unitFields = (d) => ({ property_id: d.propertyId, unit_number: text(d.number), unit_type: optText(d.type), bedrooms: parseFloat(d.beds) || 0, bathrooms: parseFloat(d.baths) || 0, market_rent_cents: Math.round(parseFloat(d.rent) * 100), status: d.status.toUpperCase() });
units.post('/', wrap(async (req, res) => {
  const d = req.body || {}; await validateUnit(d, null); const id = newId(); const b = await businessId();
  await tx((c) => insert(c, 'unit', { id, business_id: b, ...unitFields(d) })); res.status(201).json({ id });
}));
units.put('/:id', wrap(async (req, res) => {
  const d = req.body || {}; await validateUnit(d, req.params.id);
  await tx((c) => update(c, 'unit', req.params.id, unitFields(d))); res.json({ id: req.params.id });
}));
