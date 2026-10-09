// Pure demo-data builder (no database access). Mirrors the ledger used by the earlier prototype.
import { randomUUID } from 'node:crypto';
const id = () => randomUUID().replace(/-/g, '').toUpperCase();

export function buildSeed() {
  const business = { id: id(), name: 'Demo Rental Business' };
  const A = [
    ['1000', 'Operating Account', 'ASSET', 'Bank', null], ['1010', 'Savings Account', 'ASSET', 'Bank', null],
    ['1100', 'Accounts Receivable', 'ASSET', 'Receivable', 'AR'], ['1500', 'Rental Properties', 'ASSET', 'Fixed asset', null],
    ['2000', 'Accounts Payable', 'LIABILITY', 'Payable', 'AP'], ['2100', 'Security Deposits Held', 'LIABILITY', 'Tenant deposits', null],
    ['2200', 'Tenant Credits', 'LIABILITY', 'Credit notes', 'TENANT_CREDITS'], ['2300', 'Mortgage Payable', 'LIABILITY', 'Long-term debt', null],
    ['3000', "Owner's Equity", 'EQUITY', 'Equity', null], ['3900', 'Retained Earnings', 'EQUITY', 'Equity', 'RETAINED_EARNINGS'],
    ['4000', 'Rental Income', 'INCOME', 'Rent', 'RENT_INCOME'], ['4100', 'Late Fee Income', 'INCOME', 'Fees', null], ['4900', 'Rent Adjustments', 'INCOME', 'Contra income', null],
    ['5000', 'Repairs and Maintenance', 'EXPENSE', 'Operating', null], ['5100', 'Utilities', 'EXPENSE', 'Operating', null], ['5200', 'Insurance', 'EXPENSE', 'Operating', null],
    ['5300', 'Property Tax', 'EXPENSE', 'Operating', null], ['5400', 'Mortgage Interest', 'EXPENSE', 'Financing', null], ['5500', 'Landscaping', 'EXPENSE', 'Operating', null],
    ['5600', 'Management Fees', 'EXPENSE', 'Operating', null], ['5700', 'Accounting Fees', 'EXPENSE', 'Business', null],
  ];
  const accounts = A.map(([code, name, type, subtype, systemKey]) => ({ id: id(), business_id: business.id, code, name, type, subtype, system_key: systemKey, parent_id: null, is_active: 1, description: null }));
  const acc = (code) => accounts.find((a) => a.code === code).id;

  const P = [['p1', '123 Main Street', 'MULTI_FAMILY'], ['p2', '456 King Street', 'APARTMENT_BUILDING'], ['p3', '789 Queen Street', 'MULTI_FAMILY']];
  const properties = P.map(([key, name, type]) => ({ key, id: id(), business_id: business.id, name, type, address_line1: name, city: 'Toronto', region: 'ON', postal_code: 'M5V 0A0' }));
  const pid = (k) => properties.find((p) => p.key === k).id;

  const U = [['u101', 'p1', '101', '1 bed', 1, 210000, 'OCCUPIED'], ['u102', 'p1', '102', '3 bed', 3, 310000, 'OCCUPIED'], ['u103', 'p1', '103', '3 bed', 3, 325000, 'OCCUPIED'], ['u104', 'p1', '104', '2 bed', 2, 260000, 'VACANT'],
    ['u201', 'p2', '201', '2 bed', 2, 360000, 'OCCUPIED'], ['u202', 'p2', '202', '2 bed', 2, 360000, 'OCCUPIED'],
    ['u301', 'p3', '301', '2 bed', 2, 280000, 'OCCUPIED'], ['u302', 'p3', '302', '2 bed', 2, 280000, 'OCCUPIED'], ['u303', 'p3', '303', '2 bed', 2, 280000, 'VACANT']];
  const units = U.map(([key, p, number, type, beds, rent, status]) => ({ key, id: id(), business_id: business.id, property_id: pid(p), unit_number: number, unit_type: type, bedrooms: beds, bathrooms: 1, market_rent_cents: rent, status }));
  const uid = (k) => units.find((u) => u.key === k).id;

  const T = [['t1', 'John', 'Smith', 'u101', '2026-09-01', '2027-08-31'], ['t2', 'Jane', 'Doe', 'u102', '2025-11-08', '2026-11-07'], ['t3', 'Bob', 'Wilson', 'u103', '2026-03-01', '2027-02-28'],
    ['t4', 'Maria', 'Lopez', 'u201', '2025-06-01', '2027-05-31'], ['t5', 'David', 'Chen', 'u202', '2025-08-01', '2027-07-31'], ['t6', 'Amir', 'Hassan', 'u301', '2024-10-01', '2027-09-30'], ['t7', 'Sofia', 'Rossi', 'u302', '2025-02-01', '2027-01-31']];
  const tenants = T.map(([key, f, l, , moveIn]) => ({ key, id: id(), business_id: business.id, first_name: f, last_name: l, email: `${f}.${l}@example.com`.toLowerCase(), status: 'ACTIVE', move_in_date: moveIn }));
  const tid = (k) => tenants.find((t) => t.key === k).id;
  const leases = T.map(([key, , , u, start, end]) => { const un = units.find((x) => x.key === u); return { id: id(), business_id: business.id, property_id: un.property_id, unit_id: un.id, tenant_id: tid(key), status: 'ACTIVE', start_date: start, end_date: end, monthly_rent_cents: un.market_rent_cents }; });

  let n = 0;
  const L = (code, dr = 0, cr = 0, p = null, u = null, t = null) => ({ accountId: acc(code), dr, cr, propertyId: p ? pid(p) : null, unitId: u ? uid(u) : null, tenantId: t ? tid(t) : null });
  const E = (date, memo, source, lines) => ({ id: id(), entry_number: ++n, entry_date: date, memo, source, lines });
  const entries = [E('2026-01-01', 'Opening balances', 'OPENING', [L('1500', 78000000), L('1000', 4000000), L('1010', 1500000), L('2100', 0, 1735000), L('2300', 0, 61200000), L('3000', 0, 20565000)])];
  const PR = [['p1', 845000, 186200], ['p2', 720000, 142000], ['p3', 560000, 118000]];
  const split = [['5000', 0.2], ['5100', 0.25], ['5200', 0.1], ['5300', 0.3], ['5500', 0.05], ['5600', 0.1]];
  for (let m = 1; m <= 10; m++) {
    const mm = String(m).padStart(2, '0');
    PR.forEach(([p, rent, exp]) => {
      if (m === 10 && p === 'p1') entries.push(E('2026-10-01', 'October rent', 'RENT_CHARGE', [L('1000', 420000, 0, p), L('1100', 50000, 0, p, 'u101', 't1'), L('1100', 120000, 0, p, 'u102', 't2'), L('1100', 255000, 0, p, 'u103', 't3'), L('4000', 0, 845000, p)]));
      else entries.push(E(`2026-${mm}-01`, m === 10 ? 'October rent' : `Rent ${mm}`, 'RENT_CHARGE', [L('1000', rent, 0, p), L('4000', 0, rent, p)]));
      let left = exp; const lines = [];
      split.forEach(([code, pct], i) => { const amt = i === split.length - 1 ? left : Math.round(exp * pct); left -= amt; lines.push(L(code, amt, 0, p)); });
      lines.push(L('1000', 0, exp, p));
      entries.push(E(m === 10 ? '2026-10-05' : `2026-${mm}-15`, 'Operating expenses', 'EXPENSE', lines));
    });
  }
  entries.push(E('2026-09-20', 'Electricity bill, overdue', 'BILL', [L('5100', 42000, 0, 'p1'), L('2000', 0, 42000, 'p1')]));
  entries.push(E('2026-09-20', 'Credit notes CN-0001 and CN-0003', 'MANUAL', [L('4900', 50000, 0, 'p1'), L('2200', 0, 50000, 'p1')]));
  entries.push(E('2026-10-08', 'Credit note CN-0002, overpayment', 'MANUAL', [L('1000', 75000, 0, 'p1'), L('2200', 0, 75000, 'p1')]));
  return { business, accounts, properties, units, tenants, leases, entries };
}
