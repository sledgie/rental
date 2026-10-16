// Database access for reports. The aggregation itself lives in ledger.js.
import { rows, businessId, byProperty, CURRENT_LEASE } from './db.js';
import { today } from './util.js';
import { listSchedules, ATTENTION } from './schedules.js';
import { balanceBy, buildDashboard, buildDrill } from './ledger.js';

export async function loadLines({ to = today(), property = null } = {}) {
  const b = await businessId(); const binds = { b, t: to };
  const w = "l.business_id=:b AND l.entry_date<=TO_DATE(:t,'YYYY-MM-DD')" + byProperty('l.property_id', property, binds);
  return rows(`SELECT l.account_id::text "accountId", a.code "code", a.name "accountName", a.type "type", a.subtype "subtype", a.system_key "systemKey",
      l.debit_cents "dr", l.credit_cents "cr", l.property_id::text "propertyId", u.unit_number "unit", l.unit_id::text "unitId", l.tenant_id::text "tenantId",
      TO_CHAR(l.entry_date,'YYYY-MM-DD') "date", e.memo "memo", e.source "source"
    FROM journal_entry_line l JOIN journal_entry e ON e.id=l.entry_id JOIN account a ON a.id=l.account_id LEFT JOIN unit u ON u.id=l.unit_id
    WHERE ${w} ORDER BY l.entry_date, e.entry_number`, binds);
}
export async function loadNames() {
  const b = await businessId();
  const ps = await rows('SELECT id::text "id", name "name" FROM property WHERE business_id=:b ORDER BY name', { b });
  const ts = await rows('SELECT id::text "id", first_name || \' \' || last_name "name" FROM tenant WHERE business_id=:b', { b });
  return { properties: Object.fromEntries(ps.map((p) => [p.id, p.name])), tenants: Object.fromEntries(ts.map((x) => [x.id, x.name])), propertyList: ps };
}
export async function loadUnits(property = null) {
  const b = await businessId(); const binds = { b };
  const w = byProperty('property_id', property, binds);
  return rows(`SELECT id::text "id", property_id::text "propertyId", status "status" FROM unit WHERE business_id=:b${w}`, binds);
}
export async function loadEndingLeases(property = null, days = 60) {
  const b = await businessId(); const binds = { b, d: days };
  const w = byProperty('l.property_id', property, binds);
  return rows(`SELECT p.name "propertyName", u.unit_number "unitNumber", t.first_name || ' ' || t.last_name "tenantName", TO_CHAR(l.end_date,'YYYY-MM-DD') "endDate"
    FROM lease l JOIN unit u ON u.id=l.unit_id JOIN property p ON p.id=l.property_id JOIN tenant t ON t.id=l.tenant_id
    WHERE l.business_id=:b AND l.status='ACTIVE' AND l.end_date BETWEEN CURRENT_DATE AND CURRENT_DATE+(:d)::int${w} ORDER BY l.end_date`, binds);
}
export async function dashboard(property, period) {
  const [lines, units, names, leases] = await Promise.all([loadLines({ property }), loadUnits(property), loadNames(), loadEndingLeases(property)]);
  const props = names.propertyList.filter((p) => !property || p.id === property);
  const out = buildDashboard({ lines, period, units, props, leases });
  // Scheduled bills that are overdue or coming up soon.
  const sched = (await listSchedules(property)).filter((x) => ATTENTION.has(x.state)).sort((a, b) => (a.next < b.next ? -1 : 1));
  out.schedule = sched;
  sched.forEach((x) => out.alerts.push(x.state === 'overdue'
    ? { tone: 'danger', t: 'Scheduled bill overdue', s: `${x.label}, ${x.vendorName}, ${x.propertyName}: ${x.overdue} overdue since ${x.oldestOverdue}` }
    : { tone: 'warn', t: 'Scheduled bill due soon', s: `${x.label}, ${x.vendorName}, ${x.propertyName}: due ${x.next}${x.daysUntil === 0 ? ' (today)' : ` in ${x.daysUntil} day${x.daysUntil === 1 ? '' : 's'}`}` }));
  return out;
}
export async function drill(kind, property, period) {
  const [lines, names] = await Promise.all([loadLines({ property }), loadNames()]);
  if (property) names.properties = { [property]: names.properties[property] };
  return buildDrill({ kind, lines, period, names });
}
export async function arByTenant(property = null) { return balanceBy(await loadLines({ property }), 'AR', (l) => l.tenantId || ''); }

// Rent owed by a household = the receivable of everyone on the current lease (primary, co-tenants and occupants).
// Returns { byTenant, byUnit } for people on a lease and { own } (the person's own receivable) for everyone else.
export async function householdBalances(property = null) {
  const b = await businessId();
  const [own, ms] = await Promise.all([arByTenant(property), rows(`SELECT lt.lease_id::text "leaseId", l.unit_id::text "unitId", lt.tenant_id::text "tenantId"
    FROM lease_tenant lt JOIN lease l ON l.id=lt.lease_id WHERE l.business_id=:b AND l.status IN ${CURRENT_LEASE}`, { b })]);
  const byLease = {};
  ms.forEach((m) => { byLease[m.leaseId] = (byLease[m.leaseId] || 0) + (own[m.tenantId] || 0); });
  const byTenant = {}; const byUnit = {};
  ms.forEach((m) => { byTenant[m.tenantId] = byLease[m.leaseId]; byUnit[m.unitId] = byLease[m.leaseId]; });
  return { byTenant, byUnit, own };
}
