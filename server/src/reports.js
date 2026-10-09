// Database access for reports. The aggregation itself lives in ledger.js.
import { rows, businessId, byProperty } from './db.js';
import { today } from './util.js';
import { balanceBy, buildDashboard, buildDrill } from './ledger.js';

export async function loadLines({ to = today(), property = null } = {}) {
  const b = await businessId(); const binds = { b, t: to };
  const w = "l.business_id=HEXTORAW(:b) AND l.entry_date<=TO_DATE(:t,'YYYY-MM-DD')" + byProperty('l.property_id', property, binds);
  return rows(`SELECT RAWTOHEX(l.account_id) "accountId", a.code "code", a.name "accountName", a.type "type", a.subtype "subtype", a.system_key "systemKey",
      l.debit_cents "dr", l.credit_cents "cr", RAWTOHEX(l.property_id) "propertyId", u.unit_number "unit", RAWTOHEX(l.tenant_id) "tenantId",
      TO_CHAR(l.entry_date,'YYYY-MM-DD') "date", e.memo "memo", e.source "source"
    FROM journal_entry_line l JOIN journal_entry e ON e.id=l.entry_id JOIN account a ON a.id=l.account_id LEFT JOIN unit u ON u.id=l.unit_id
    WHERE ${w} ORDER BY l.entry_date, e.entry_number`, binds);
}
export async function loadNames() {
  const b = await businessId();
  const ps = await rows('SELECT RAWTOHEX(id) "id", name "name" FROM property WHERE business_id=HEXTORAW(:b) ORDER BY name', { b });
  const ts = await rows('SELECT RAWTOHEX(id) "id", first_name || \' \' || last_name "name" FROM tenant WHERE business_id=HEXTORAW(:b)', { b });
  return { properties: Object.fromEntries(ps.map((p) => [p.id, p.name])), tenants: Object.fromEntries(ts.map((x) => [x.id, x.name])), propertyList: ps };
}
export async function loadUnits(property = null) {
  const b = await businessId(); const binds = { b };
  const w = byProperty('property_id', property, binds);
  return rows(`SELECT RAWTOHEX(id) "id", RAWTOHEX(property_id) "propertyId", status "status" FROM unit WHERE business_id=HEXTORAW(:b)${w}`, binds);
}
export async function loadEndingLeases(property = null, days = 60) {
  const b = await businessId(); const binds = { b, d: days };
  const w = byProperty('l.property_id', property, binds);
  return rows(`SELECT p.name "propertyName", u.unit_number "unitNumber", t.first_name || ' ' || t.last_name "tenantName", TO_CHAR(l.end_date,'YYYY-MM-DD') "endDate"
    FROM lease l JOIN unit u ON u.id=l.unit_id JOIN property p ON p.id=l.property_id JOIN tenant t ON t.id=l.tenant_id
    WHERE l.business_id=HEXTORAW(:b) AND l.status='ACTIVE' AND l.end_date BETWEEN TRUNC(SYSDATE) AND TRUNC(SYSDATE)+:d${w} ORDER BY l.end_date`, binds);
}
export async function dashboard(property, period) {
  const [lines, units, names, leases] = await Promise.all([loadLines({ property }), loadUnits(property), loadNames(), loadEndingLeases(property)]);
  const props = names.propertyList.filter((p) => !property || p.id === property);
  return buildDashboard({ lines, period, units, props, leases });
}
export async function drill(kind, property, period) {
  const [lines, names] = await Promise.all([loadLines({ property }), loadNames()]);
  if (property) names.properties = { [property]: names.properties[property] };
  return buildDrill({ kind, lines, period, names });
}
export async function arByTenant(property = null) { return balanceBy(await loadLines({ property }), 'AR', (l) => l.tenantId || ''); }
