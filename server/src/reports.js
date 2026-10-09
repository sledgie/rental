import { rows, businessId } from './db.js';
import { today } from './util.js';

/* ---------- pure aggregation (no database access, easy to test) ---------- */
export const nat = (l) => (l.type === 'ASSET' || l.type === 'EXPENSE' ? l.dr - l.cr : l.cr - l.dr);
const sum = (ls, pred) => ls.reduce((s, l) => (pred(l) ? s + nat(l) : s), 0);
export function summarize(ls) {
  const income = sum(ls, (l) => l.type === 'INCOME');
  const expenses = sum(ls, (l) => l.type === 'EXPENSE');
  const opex = sum(ls, (l) => l.type === 'EXPENSE' && l.subtype !== 'Financing');
  const cash = ls.filter((l) => l.type === 'ASSET' && l.subtype === 'Bank' && l.source !== 'OPENING').reduce((s, l) => s + l.dr - l.cr, 0);
  return { income, expenses, noi: income - opex, opex, cash };
}
export const balanceBy = (ls, systemKey, keyFn) => {
  const m = {};
  ls.filter((l) => l.systemKey === systemKey).forEach((l) => { const k = keyFn(l); m[k] = (m[k] || 0) + nat(l); });
  return m;
};
export function periodRange(period, t = today()) {
  const [y, m] = t.split('-');
  return { from: period === 'ytd' ? `${y}-01-01` : `${y}-${m}-01`, to: t };
}
export function lastMonths(n, t = today()) {
  const out = []; let y = +t.slice(0, 4), m = +t.slice(5, 7);
  for (let i = 0; i < n; i++) { out.unshift({ key: `${y}-${String(m).padStart(2, '0')}`, label: new Date(Date.UTC(y, m - 1, 1)).toLocaleString('en-CA', { month: 'short', timeZone: 'UTC' }) }); m--; if (m === 0) { m = 12; y--; } }
  return out;
}
export function buildDashboard({ lines, period, units, props, leases, tenants, t = today() }) {
  const r = periodRange(period, t);
  const inRange = lines.filter((l) => l.date >= r.from && l.date <= r.to);
  const s = summarize(inRange);
  const arByTenant = balanceBy(lines, 'AR', (l) => l.tenantId || '');
  const outstanding = Object.values(arByTenant).reduce((a, b) => a + b, 0);
  const billsDue = Object.values(balanceBy(lines, 'AP', () => 'x')).reduce((a, b) => a + b, 0);
  const series = lastMonths(6, t).map((m) => { const ms = summarize(lines.filter((l) => l.date.startsWith(m.key))); return { n: m.label, i: ms.income, e: ms.expenses }; });
  const noiByProperty = props.map((p) => ({ id: p.id, name: p.name, noi: summarize(inRange.filter((l) => l.propertyId === p.id)).noi }));
  const occupied = units.filter((u) => u.status === 'OCCUPIED').length;
  const alerts = [];
  const late = Object.entries(arByTenant).filter(([, v]) => v > 0);
  if (late.length) alerts.push({ tone: 'danger', t: 'Late rent', s: `${late.length} tenant${late.length > 1 ? 's' : ''} owe $${Math.round(late.reduce((a, [, v]) => a + v, 0) / 100).toLocaleString('en-CA')}` });
  if (billsDue > 0) alerts.push({ tone: 'danger', t: 'Bills due', s: `$${Math.round(billsDue / 100).toLocaleString('en-CA')} open` });
  const vac = units.filter((u) => u.status === 'VACANT').length;
  if (vac) alerts.push({ tone: 'warn', t: 'Vacant units', s: `${vac} unit${vac > 1 ? 's' : ''} available` });
  leases.forEach((l) => alerts.push({ tone: 'warn', t: 'Lease ending soon', s: `${l.propertyName}, Unit ${l.unitNumber}, ${l.tenantName}, ends ${l.endDate}` }));
  const label = period === 'ytd' ? 'Year to date' : new Date(t + 'T00:00:00Z').toLocaleString('en-CA', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  return { label, kpis: { income: s.income, expenses: s.expenses, noi: s.noi, cash: s.cash, outstanding, billsDue, occupied, units: units.length, occupancyPct: units.length ? Math.round((occupied / units.length) * 100) : 0 }, series, noiByProperty, alerts };
}
export function buildDrill({ kind, lines, period, names, t = today() }) {
  const r = periodRange(period, t);
  const inRange = lines.filter((l) => l.date >= r.from && l.date <= r.to);
  const pn = (id) => (id ? names.properties[id] || 'Unknown' : 'Business (no property)');
  const group = (type) => {
    const m = {};
    inRange.filter((l) => l.type === type).forEach((l) => { const k = `${l.accountId}|${l.propertyId || ''}`; (m[k] ||= { label: `${l.code} - ${l.accountName}`, p: pn(l.propertyId), v: 0 }).v += nat(l); });
    const rs = Object.values(m).filter((x) => x.v !== 0).sort((a, b) => b.v - a.v);
    return { columns: [{ label: 'Account' }, { label: 'Property' }, { label: 'Amount', money: true }], rows: rs.map((x) => [x.label, x.p, x.v]), total: ['Total', '', rs.reduce((a, x) => a + x.v, 0)] };
  };
  if (kind === 'income') return { title: 'Rental income', ...group('INCOME') };
  if (kind === 'expenses') return { title: 'Expenses', ...group('EXPENSE') };
  if (kind === 'noi') {
    const ids = Object.keys(names.properties);
    const rs = ids.map((id) => { const s = summarize(inRange.filter((l) => l.propertyId === id)); return [names.properties[id], s.income, s.opex, s.noi]; });
    const s0 = summarize(inRange);
    return { title: 'Net operating income by property', columns: [{ label: 'Property' }, { label: 'Income', money: true }, { label: 'Operating expenses', money: true }, { label: 'NOI', money: true }], rows: rs, total: ['Business total', s0.income, s0.opex, s0.noi] };
  }
  if (kind === 'cash') {
    const m = {};
    inRange.filter((l) => l.type === 'ASSET' && l.subtype === 'Bank' && l.source !== 'OPENING').forEach((l) => { const o = (m[l.propertyId || ''] ||= { i: 0, o: 0 }); o.i += l.dr; o.o += l.cr; });
    const rs = Object.entries(m).map(([k, o]) => [pn(k), o.i, o.o, o.i - o.o]);
    return { title: 'Cash flow by property', columns: [{ label: 'Property' }, { label: 'Money in', money: true }, { label: 'Money out', money: true }, { label: 'Net', money: true }], rows: rs, total: ['Total', '', '', rs.reduce((a, x) => a + x[3], 0)] };
  }
  if (kind === 'ar') {
    const m = {};
    lines.filter((l) => l.systemKey === 'AR').forEach((l) => { const k = `${l.propertyId || ''}|${l.unit || ''}|${l.tenantId || ''}`; m[k] = (m[k] || 0) + l.dr - l.cr; });
    const rs = Object.entries(m).filter(([, v]) => v !== 0).map(([k, v]) => { const [p, u, tn] = k.split('|'); return [pn(p), u || '-', names.tenants[tn] || '-', v]; });
    return { title: 'Outstanding rent', columns: [{ label: 'Property' }, { label: 'Unit' }, { label: 'Tenant' }, { label: 'Amount', money: true }], rows: rs, total: ['Total', '', '', rs.reduce((a, x) => a + x[3], 0)] };
  }
  if (kind === 'ap') {
    const rs = lines.filter((l) => l.systemKey === 'AP').map((l) => [l.date, l.memo || '', pn(l.propertyId), l.cr - l.dr]);
    return { title: 'Bills due', columns: [{ label: 'Date' }, { label: 'Description' }, { label: 'Property' }, { label: 'Amount', money: true }], rows: rs, total: ['Total', '', '', rs.reduce((a, x) => a + x[3], 0)] };
  }
  return null;
}

/* ---------- database access ---------- */
export async function loadLines({ to = today(), property = null } = {}) {
  const b = await businessId(); const binds = { b, t: to };
  let w = "l.business_id=HEXTORAW(:b) AND l.entry_date<=TO_DATE(:t,'YYYY-MM-DD')";
  if (property) { w += ' AND l.property_id=HEXTORAW(:p)'; binds.p = property; }
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
  const b = await businessId(); const binds = { b }; let w = '';
  if (property) { w = ' AND property_id=HEXTORAW(:p)'; binds.p = property; }
  return rows(`SELECT RAWTOHEX(id) "id", RAWTOHEX(property_id) "propertyId", status "status" FROM unit WHERE business_id=HEXTORAW(:b)${w}`, binds);
}
export async function loadEndingLeases(property = null, days = 60) {
  const b = await businessId(); const binds = { b, d: days }; let w = '';
  if (property) { w = ' AND l.property_id=HEXTORAW(:p)'; binds.p = property; }
  return rows(`SELECT p.name "propertyName", u.unit_number "unitNumber", t.first_name || ' ' || t.last_name "tenantName", TO_CHAR(l.end_date,'YYYY-MM-DD') "endDate"
    FROM lease l JOIN unit u ON u.id=l.unit_id JOIN property p ON p.id=l.property_id JOIN tenant t ON t.id=l.tenant_id
    WHERE l.business_id=HEXTORAW(:b) AND l.status='ACTIVE' AND l.end_date BETWEEN TRUNC(SYSDATE) AND TRUNC(SYSDATE)+:d${w} ORDER BY l.end_date`, binds);
}
export async function dashboard(property, period) {
  const [lines, units, names, leases] = await Promise.all([loadLines({ property }), loadUnits(property), loadNames(), loadEndingLeases(property)]);
  const props = names.propertyList.filter((p) => !property || p.id === property);
  return buildDashboard({ lines, period, units, props, leases, tenants: names.tenants });
}
export async function drill(kind, property, period) {
  const [lines, names] = await Promise.all([loadLines({ property }), loadNames()]);
  if (property) names.properties = { [property]: names.properties[property] };
  return buildDrill({ kind, lines, period, names });
}
export async function arByTenant(property = null) { return balanceBy(await loadLines({ property }), 'AR', (l) => l.tenantId || ''); }
