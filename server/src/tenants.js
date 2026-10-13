// Tenants and households. A unit has one lease; the people on it have roles:
//   primary    responsible for the rent (lease.tenant_id points at this person), receives statements
//   co_tenant  also on the lease and liable; can pay
//   occupant   lives there (e.g. a child) but is not on the lease and owes nothing
// lease_tenant only holds people on a current lease. The balance belongs to the household (see householdBalances).
import { Router } from 'express';
import { rows, query, tx, insert, update, newId, businessId, byProperty, CURRENT_LEASE } from './db.js';
import { householdBalances } from './reports.js';
import { fail, HttpError, wrap, TENANT_STATUS, inv, today, addYear, text, optText } from './util.js';

export const router = Router();
const TI = inv(TENANT_STATUS);
const ROLE = { primary: 'PRIMARY', co_tenant: 'CO_TENANT', occupant: 'OCCUPANT' };
const RI = inv(ROLE);
const run = (c, sql, binds) => (c ? c.execute(sql, binds) : query(sql, binds)); // inside a transaction when `c` is given

// A unit's status follows its current lease: signed -> occupied, draft -> reserved, none -> vacant (maintenance/unavailable are left alone).
async function syncUnit(c, unitId) {
  const r = (await c.execute(`SELECT NVL(SUM(CASE WHEN status='ACTIVE' THEN 1 ELSE 0 END),0) "a", COUNT(*) "n" FROM lease WHERE unit_id=HEXTORAW(:u) AND status IN ${CURRENT_LEASE}`, { u: unitId })).rows[0];
  await c.execute(`UPDATE unit SET status=:s WHERE id=HEXTORAW(:u) AND status NOT IN ('MAINTENANCE','UNAVAILABLE')`, { s: r.a > 0 ? 'OCCUPIED' : r.n > 0 ? 'RESERVED' : 'VACANT', u: unitId });
}
// The lease is signed (ACTIVE) when its primary tenant is active or leaving, otherwise still a draft.
async function refreshLease(c, leaseId) {
  const r = (await c.execute(`SELECT t.status "status", RAWTOHEX(l.unit_id) "unitId" FROM lease l JOIN tenant t ON t.id=l.tenant_id WHERE l.id=HEXTORAW(:l)`, { l: leaseId })).rows[0];
  if (!r) return;
  await c.execute(`UPDATE lease SET status=:s WHERE id=HEXTORAW(:l) AND status IN ${CURRENT_LEASE}`, { s: r.status === 'ACTIVE' || r.status === 'PENDING_MOVE_OUT' ? 'ACTIVE' : 'DRAFT', l: leaseId });
  await syncUnit(c, r.unitId);
}

const memberOf = async (c, tenantId) => (await run(c, `SELECT RAWTOHEX(l.id) "leaseId", RAWTOHEX(l.unit_id) "unitId", lt.role "role" FROM lease_tenant lt JOIN lease l ON l.id=lt.lease_id
  WHERE lt.tenant_id=HEXTORAW(:t) AND l.status IN ${CURRENT_LEASE}`, { t: tenantId })).rows[0] || null;
const leaseOnUnit = async (c, unitId) => (await run(c, `SELECT RAWTOHEX(id) "id" FROM lease WHERE unit_id=HEXTORAW(:u) AND status IN ${CURRENT_LEASE}`, { u: unitId })).rows[0] || null;
const coTenants = async (c, leaseId) => (await run(c, `SELECT RAWTOHEX(tenant_id) "id" FROM lease_tenant WHERE lease_id=HEXTORAW(:l) AND role='CO_TENANT' ORDER BY created_at, tenant_id`, { l: leaseId })).rows;
const setRole = (c, leaseId, tenantId, role) => c.execute('UPDATE lease_tenant SET role=:r WHERE lease_id=HEXTORAW(:l) AND tenant_id=HEXTORAW(:t)', { r: role, l: leaseId, t: tenantId });

// Makes `tenantId` the household's primary; the previous primary becomes a co-tenant.
async function setPrimary(c, leaseId, tenantId) {
  const old = (await c.execute('SELECT RAWTOHEX(tenant_id) "id" FROM lease WHERE id=HEXTORAW(:l)', { l: leaseId })).rows[0].id;
  if (old === tenantId) return;
  await setRole(c, leaseId, old, 'CO_TENANT');
  await c.execute('UPDATE lease SET tenant_id=HEXTORAW(:t) WHERE id=HEXTORAW(:l)', { t: tenantId, l: leaseId });
  if (!(await setRole(c, leaseId, tenantId, 'PRIMARY')).rowsAffected) await insert(c, 'lease_tenant', { id: newId(), lease_id: leaseId, tenant_id: tenantId, role: 'PRIMARY' });
}

// Puts a tenant on a unit: the first person starts the lease as primary, later people join as co-tenants or occupants.
async function join(c, b, tenantId, d) {
  const lease = await leaseOnUnit(c, d.unitId);
  if (!lease) {
    const u = await unitState(d.unitId); const start = d.moveIn || today(); const id = newId();
    await insert(c, 'lease', { id, business_id: b, property_id: u.propertyId, unit_id: d.unitId, tenant_id: tenantId, status: 'DRAFT', start_date: start, end_date: addYear(start), monthly_rent_cents: u.rent || 0 });
    await insert(c, 'lease_tenant', { id: newId(), lease_id: id, tenant_id: tenantId, role: 'PRIMARY' });
    return id;
  }
  const want = ROLE[d.role] ? d.role : 'co_tenant';
  await insert(c, 'lease_tenant', { id: newId(), lease_id: lease.id, tenant_id: tenantId, role: want === 'primary' ? 'CO_TENANT' : ROLE[want] });
  if (want === 'primary') await setPrimary(c, lease.id, tenantId);
  return lease.id;
}
// Takes a tenant off their unit. A leaving primary hands over to the first co-tenant; if nobody liable is left the lease ends.
async function leave(c, tenantId) {
  const m = await memberOf(c, tenantId); if (!m) return;
  await c.execute('DELETE FROM lease_tenant WHERE lease_id=HEXTORAW(:l) AND tenant_id=HEXTORAW(:t)', { l: m.leaseId, t: tenantId });
  if (m.role === 'PRIMARY') {
    const next = (await coTenants(c, m.leaseId))[0];
    if (next) await setPrimary(c, m.leaseId, next.id);
    else {
      await c.execute(`UPDATE lease SET status='TERMINATED', terminated_at=TO_DATE(:d,'YYYY-MM-DD') WHERE id=HEXTORAW(:l)`, { d: today(), l: m.leaseId });
      const left = (await c.execute('SELECT RAWTOHEX(tenant_id) "id" FROM lease_tenant WHERE lease_id=HEXTORAW(:l)', { l: m.leaseId })).rows; // occupants move out with the household
      await c.execute('DELETE FROM lease_tenant WHERE lease_id=HEXTORAW(:l)', { l: m.leaseId });
      for (const o of left) await update(c, 'tenant', o.id, { status: 'PAST', move_out_date: today() });
      await syncUnit(c, m.unitId);
      return;
    }
  }
  await refreshLease(c, m.leaseId);
}

router.get('/', wrap(async (req, res) => {
  const b = await businessId(); const binds = { b };
  const w = byProperty('l.property_id', req.query.property, binds);
  const r = await rows(`SELECT RAWTOHEX(t.id) "id", t.first_name "first", t.last_name "last", t.email "email", t.phone "phone", t.photo_data "photo", t.status "status",
      TO_CHAR(t.move_in_date,'YYYY-MM-DD') "moveIn", RAWTOHEX(l.id) "leaseId", lt.role "role", RAWTOHEX(l.unit_id) "unitId", u.unit_number "unitNumber", RAWTOHEX(l.property_id) "propertyId", pr.name "propertyName", l.monthly_rent_cents "rent"
    FROM tenant t LEFT JOIN lease_tenant lt ON lt.tenant_id=t.id LEFT JOIN lease l ON l.id=lt.lease_id AND l.status IN ${CURRENT_LEASE}
      LEFT JOIN unit u ON u.id=l.unit_id LEFT JOIN property pr ON pr.id=l.property_id
    WHERE t.business_id=HEXTORAW(:b)${w} ORDER BY t.last_name, t.first_name`, binds);
  const hh = await householdBalances(req.query.property || null);
  // Occupants are not liable, so they show no balance; everyone else on a lease shows the household's.
  res.json(r.map((x) => ({ ...x, status: TI[x.status], role: x.role ? RI[x.role] : null, balance: x.role === 'OCCUPANT' ? 0 : (hh.byTenant[x.id] ?? hh.own[x.id] ?? 0) })));
}));

async function unitState(unitId) {
  const r = await rows(`SELECT RAWTOHEX(property_id) "propertyId", status "status", market_rent_cents "rent" FROM unit WHERE id=HEXTORAW(:u)`, { u: unitId });
  if (!r.length) return null;
  const t = await rows(`SELECT RAWTOHEX(lt.tenant_id) "tenantId" FROM lease_tenant lt JOIN lease l ON l.id=lt.lease_id WHERE l.unit_id=HEXTORAW(:u) AND l.status IN ${CURRENT_LEASE}`, { u: unitId });
  return { ...r[0], tenantIds: t.map((x) => x.tenantId) };
}
async function validate(d, id) {
  const e = {};
  if (!text(d.first)) e.first = 'Enter a first name.';
  if (!text(d.last)) e.last = 'Enter a last name.';
  if (d.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email.trim())) e.email = 'Enter a valid email address.';
  if (!TENANT_STATUS[d.status]) e.status = 'Choose a status.';
  if (d.status !== 'past' && d.status !== 'applicant' && !d.unitId) e.unit = 'Choose a unit for this status.';
  if (d.role && !ROLE[d.role]) e.role = 'Choose a role.';
  if (d.unitId && d.status !== 'past') {
    const u = await unitState(d.unitId);
    if (!u) e.unit = 'Unit not found.';
    else if ((u.status === 'MAINTENANCE' || u.status === 'UNAVAILABLE') && !u.tenantIds.includes(id)) e.unit = 'That unit is not available.';
    // The only primary cannot step down unless a co-tenant can take over.
    const m = id ? await memberOf(null, id) : null;
    if (m && m.unitId === d.unitId && m.role === 'PRIMARY' && ROLE[d.role] && d.role !== 'primary' && !(await coTenants(null, m.leaseId)).length) e.role = 'Every unit needs a primary tenant. Make another person a co-tenant first.';
  }
  if (d.status === 'active' && !d.moveIn) e.moveIn = 'Enter the move-in date.';
  if (d.photo && (typeof d.photo !== 'string' || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(d.photo))) e.photo = 'Use a JPEG, PNG or WebP picture.';
  else if (d.photo && d.photo.length > 300000) e.photo = 'That picture is too large. Choose a smaller one.';
  fail(e);
}
const fields = (d) => ({ first_name: text(d.first), last_name: text(d.last), email: optText(d.email), phone: optText(d.phone), status: TENANT_STATUS[d.status], move_in_date: d.moveIn || null, ...(d.photo === undefined ? {} : { photo_data: d.photo || null }) });

router.post('/', wrap(async (req, res) => {
  const d = req.body || {}; await validate(d, null); const b = await businessId(); const id = newId();
  await tx(async (c) => {
    await insert(c, 'tenant', { id, business_id: b, ...fields(d) });
    if (d.unitId && d.status !== 'past') await refreshLease(c, await join(c, b, id, d));
  });
  res.status(201).json({ id });
}));
router.put('/:id', wrap(async (req, res) => {
  const d = req.body || {}; const id = req.params.id; await validate(d, id); const b = await businessId();
  await tx(async (c) => {
    const m = await memberOf(c, id);
    if (d.status === 'past') await leave(c, id);
    else if (m && d.unitId === m.unitId) {
      const want = ROLE[d.role] ? d.role : RI[m.role];
      if (want !== RI[m.role]) {
        if (want === 'primary') await setPrimary(c, m.leaseId, id);
        else {
          if (m.role === 'PRIMARY') await setPrimary(c, m.leaseId, (await coTenants(c, m.leaseId))[0].id); // validated: a co-tenant exists
          await setRole(c, m.leaseId, id, ROLE[want]);
        }
      }
    } else { if (m) await leave(c, id); if (d.unitId) await join(c, b, id, d); }
    await update(c, 'tenant', id, { ...fields(d), ...(d.status === 'past' ? { move_out_date: today() } : {}) });
    const now = await memberOf(c, id); if (now) await refreshLease(c, now.leaseId);
  });
  res.json({ id });
}));
router.post('/:id/move-out', wrap(async (req, res) => {
  const id = req.params.id;
  const t = await rows('SELECT RAWTOHEX(id) "id" FROM tenant WHERE id=HEXTORAW(:i)', { i: id }); if (!t.length) throw new HttpError(404, 'Tenant not found.');
  await tx(async (c) => { await leave(c, id); await update(c, 'tenant', id, { status: 'PAST', move_out_date: today() }); });
  res.json({ id });
}));
