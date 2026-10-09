// Pure ledger aggregation: no database access, so it can be tested on plain line objects
// (the shape returned by loadLines in reports.js).
import { today } from './util.js';

export const NO_PROPERTY = 'Business (no property)';

// Natural balance: assets and expenses grow with debits, everything else with credits.
export const nat = (l) => (l.type === 'ASSET' || l.type === 'EXPENSE' ? l.dr - l.cr : l.cr - l.dr);
const sum = (ls, pred) => ls.reduce((s, l) => (pred(l) ? s + nat(l) : s), 0);
const total = (xs) => xs.reduce((a, b) => a + b, 0);
const isCash = (l) => l.type === 'ASSET' && l.subtype === 'Bank' && l.source !== 'OPENING';
const dollars = (c) => `$${Math.round(c / 100).toLocaleString('en-CA')}`;
const plural = (n, word) => `${n} ${word}${n > 1 ? 's' : ''}`;

export function summarize(ls) {
  const income = sum(ls, (l) => l.type === 'INCOME');
  const expenses = sum(ls, (l) => l.type === 'EXPENSE');
  const opex = sum(ls, (l) => l.type === 'EXPENSE' && l.subtype !== 'Financing');
  const cash = ls.filter(isCash).reduce((s, l) => s + l.dr - l.cr, 0);
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
export function inPeriod(ls, period, t = today()) {
  const r = periodRange(period, t);
  return ls.filter((l) => l.date >= r.from && l.date <= r.to);
}
export function lastMonths(n, t = today()) {
  const out = []; let y = +t.slice(0, 4), m = +t.slice(5, 7);
  for (let i = 0; i < n; i++) { out.unshift({ key: `${y}-${String(m).padStart(2, '0')}`, label: new Date(Date.UTC(y, m - 1, 1)).toLocaleString('en-CA', { month: 'short', timeZone: 'UTC' }) }); m--; if (m === 0) { m = 12; y--; } }
  return out;
}

export function buildDashboard({ lines, period, units, props, leases, t = today() }) {
  const inRange = inPeriod(lines, period, t);
  const s = summarize(inRange);
  const arByTenant = balanceBy(lines, 'AR', (l) => l.tenantId || '');
  const outstanding = total(Object.values(arByTenant));
  const billsDue = sum(lines, (l) => l.systemKey === 'AP');
  const series = lastMonths(6, t).map((m) => { const ms = summarize(lines.filter((l) => l.date.startsWith(m.key))); return { n: m.label, i: ms.income, e: ms.expenses }; });
  const noiByProperty = props.map((p) => ({ id: p.id, name: p.name, noi: summarize(inRange.filter((l) => l.propertyId === p.id)).noi }));
  const occupied = units.filter((u) => u.status === 'OCCUPIED').length;
  const vacant = units.filter((u) => u.status === 'VACANT').length;
  const late = Object.values(arByTenant).filter((v) => v > 0);
  const alerts = [];
  if (late.length) alerts.push({ tone: 'danger', t: 'Late rent', s: `${plural(late.length, 'tenant')} owe ${dollars(total(late))}` });
  if (billsDue > 0) alerts.push({ tone: 'danger', t: 'Bills due', s: `${dollars(billsDue)} open` });
  if (vacant) alerts.push({ tone: 'warn', t: 'Vacant units', s: `${plural(vacant, 'unit')} available` });
  leases.forEach((l) => alerts.push({ tone: 'warn', t: 'Lease ending soon', s: `${l.propertyName}, Unit ${l.unitNumber}, ${l.tenantName}, ends ${l.endDate}` }));
  const label = period === 'ytd' ? 'Year to date' : new Date(t + 'T00:00:00Z').toLocaleString('en-CA', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  return { label, kpis: { income: s.income, expenses: s.expenses, noi: s.noi, cash: s.cash, outstanding, billsDue, occupied, units: units.length, occupancyPct: units.length ? Math.round((occupied / units.length) * 100) : 0 }, series, noiByProperty, alerts };
}

const col = (label) => ({ label });
const moneyCol = (label) => ({ label, money: true });
const lastColTotal = (rs) => total(rs.map((r) => r[r.length - 1]));

export function buildDrill({ kind, lines, period, names, t = today() }) {
  const inRange = inPeriod(lines, period, t);
  const pn = (id) => (id ? names.properties[id] || 'Unknown' : NO_PROPERTY);
  const byAccount = (type) => {
    const m = {};
    inRange.filter((l) => l.type === type).forEach((l) => { const k = `${l.accountId}|${l.propertyId || ''}`; (m[k] ||= { label: `${l.code} - ${l.accountName}`, p: pn(l.propertyId), v: 0 }).v += nat(l); });
    const rs = Object.values(m).filter((x) => x.v !== 0).sort((a, b) => b.v - a.v).map((x) => [x.label, x.p, x.v]);
    return { columns: [col('Account'), col('Property'), moneyCol('Amount')], rows: rs, total: ['Total', '', lastColTotal(rs)] };
  };
  switch (kind) {
    case 'income': return { title: 'Rental income', ...byAccount('INCOME') };
    case 'expenses': return { title: 'Expenses', ...byAccount('EXPENSE') };
    case 'noi': {
      const rs = Object.keys(names.properties).map((id) => { const s = summarize(inRange.filter((l) => l.propertyId === id)); return [names.properties[id], s.income, s.opex, s.noi]; });
      const s0 = summarize(inRange);
      return { title: 'Net operating income by property', columns: [col('Property'), moneyCol('Income'), moneyCol('Operating expenses'), moneyCol('NOI')], rows: rs, total: ['Business total', s0.income, s0.opex, s0.noi] };
    }
    case 'cash': {
      const m = {};
      inRange.filter(isCash).forEach((l) => { const o = (m[l.propertyId || ''] ||= { i: 0, o: 0 }); o.i += l.dr; o.o += l.cr; });
      const rs = Object.entries(m).map(([k, o]) => [pn(k), o.i, o.o, o.i - o.o]);
      return { title: 'Cash flow by property', columns: [col('Property'), moneyCol('Money in'), moneyCol('Money out'), moneyCol('Net')], rows: rs, total: ['Total', '', '', lastColTotal(rs)] };
    }
    case 'ar': {
      const m = {};
      lines.filter((l) => l.systemKey === 'AR').forEach((l) => { const k = `${l.propertyId || ''}|${l.unit || ''}|${l.tenantId || ''}`; m[k] = (m[k] || 0) + l.dr - l.cr; });
      const rs = Object.entries(m).filter(([, v]) => v !== 0).map(([k, v]) => { const [p, u, tn] = k.split('|'); return [pn(p), u || '-', names.tenants[tn] || '-', v]; });
      return { title: 'Outstanding rent', columns: [col('Property'), col('Unit'), col('Tenant'), moneyCol('Amount')], rows: rs, total: ['Total', '', '', lastColTotal(rs)] };
    }
    case 'ap': {
      const rs = lines.filter((l) => l.systemKey === 'AP').map((l) => [l.date, l.memo || '', pn(l.propertyId), l.cr - l.dr]);
      return { title: 'Bills due', columns: [col('Date'), col('Description'), col('Property'), moneyCol('Amount')], rows: rs, total: ['Total', '', '', lastColTotal(rs)] };
    }
    default: return null;
  }
}
