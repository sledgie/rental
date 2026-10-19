// Utility responsibility from the lease: how much of a property bill the tenants pay, and who pays it.
// Used by bills.js when a bill is posted. Reads lease_utility / lease_utility_share (see leases.js for the editing side).
import { CURRENT_LEASE } from './db.js';

// The current lease a bill belongs to. A bill for a specific unit uses the lease covering that unit; a bill for the
// property alone only counts when the property has exactly one current lease (e.g. a whole house), otherwise it stays with the landlord.
async function leaseFor(c, b, propertyId, unitId) {
  if (unitId) {
    return (await c.execute(`SELECT RAWTOHEX(l.id) "id", RAWTOHEX(l.unit_id) "leadUnit" FROM lease l JOIN lease_unit lu ON lu.lease_id=l.id
      WHERE lu.unit_id=HEXTORAW(:u) AND l.business_id=HEXTORAW(:b) AND l.status IN ${CURRENT_LEASE}`, { u: unitId, b })).rows[0] || null;
  }
  const ls = (await c.execute(`SELECT RAWTOHEX(id) "id", RAWTOHEX(unit_id) "leadUnit" FROM lease WHERE property_id=HEXTORAW(:p) AND business_id=HEXTORAW(:b) AND status IN ${CURRENT_LEASE}`, { p: propertyId, b })).rows;
  return ls.length === 1 ? ls[0] : null;
}

// Splits `cents` over `weights` (percentages) without losing a cent: the rounding leftovers go to the first people.
export function divide(cents, weights) {
  const total = weights.reduce((a, b) => a + b, 0);
  const out = weights.map((w) => Math.floor((cents * w) / total));
  let left = cents - out.reduce((a, b) => a + b, 0);
  for (let i = 0; left > 0; i = (i + 1) % out.length, left--) out[i] += 1;
  return out;
}

// Returns null when the landlord pays, otherwise { leaseId, unitId, tenantCents, shares: [{ tenantId, cents }] }.
export async function tenantShares(c, b, { propertyId, unitId, type, cents }) {
  const lease = await leaseFor(c, b, propertyId, unitId); if (!lease) return null;
  const u = (await c.execute(`SELECT RAWTOHEX(id) "id", payer "payer", tenant_pct "pct" FROM lease_utility WHERE lease_id=HEXTORAW(:l) AND bill_type=:t`, { l: lease.id, t: type.toUpperCase() })).rows[0];
  if (!u || u.payer === 'LANDLORD') return null;
  const tenantCents = u.payer === 'TENANT' ? cents : Math.round((cents * Number(u.pct)) / 100);
  if (tenantCents <= 0) return null;
  const liable = (await c.execute(`SELECT RAWTOHEX(tenant_id) "id" FROM lease_tenant WHERE lease_id=HEXTORAW(:l) AND role IN ('PRIMARY','CO_TENANT') ORDER BY CASE role WHEN 'PRIMARY' THEN 0 ELSE 1 END, created_at, tenant_id`, { l: lease.id })).rows.map((x) => x.id);
  if (!liable.length) return null;
  const set = (await c.execute(`SELECT RAWTOHEX(tenant_id) "id", pct "pct" FROM lease_utility_share WHERE lease_utility_id=HEXTORAW(:u)`, { u: u.id })).rows.filter((x) => liable.includes(x.id));
  const people = set.length ? set.map((x) => ({ id: x.id, w: Number(x.pct) })) : liable.map((id) => ({ id, w: 1 }));
  const parts = divide(tenantCents, people.map((p) => p.w));
  return { leaseId: lease.id, unitId: unitId || lease.leadUnit, tenantCents, shares: people.map((p, i) => ({ tenantId: p.id, cents: parts[i] })).filter((s) => s.cents > 0) };
}
