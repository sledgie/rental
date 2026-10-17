// Property bills (electricity, water, ...). Posting a bill books  Dr <expense account> / Cr Accounts Payable,
// tagged with the property, so it shows on the dashboard (expenses, bills due) and in the Chart of Accounts.
import { Router } from 'express';
import { rows, tx, insert, newId, businessId } from './db.js';
import { fail, HttpError, wrap, text } from './util.js';

export const router = Router();
// Each bill type has its own expense sub-account in the Chart of Accounts (created on first use if missing).
export const BILL_TYPES = {
  electricity: { label: 'Electricity', key: 'BILL_ELECTRICITY', code: '5110', parent: '5100' },
  water: { label: 'Water', key: 'BILL_WATER', code: '5120', parent: '5100' },
  internet: { label: 'Internet', key: 'BILL_INTERNET', code: '5130', parent: '5100' },
  maintenance: { label: 'Maintenance', key: 'BILL_MAINTENANCE', code: '5010', parent: '5000' },
  repairs: { label: 'Repairs', key: 'BILL_REPAIRS', code: '5020', parent: '5000' },
};
const MAX_CENTS = 10000000; // $100,000 per bill

export async function ensureBillAccount(c, b, t) {
  const find = async (sql, binds) => (await c.execute(sql, { b, ...binds })).rows[0];
  const have = await find(`SELECT id::text "id" FROM account WHERE business_id=:b AND system_key=:k`, { k: t.key });
  if (have) return have.id;
  const parent = await find(`SELECT id::text "id" FROM account WHERE business_id=:b AND code=:c`, { c: t.parent });
  let code = Number(t.code);
  while (await find(`SELECT 1 "x" FROM account WHERE business_id=:b AND code=:c`, { c: String(code) })) code += 1;
  const id = newId();
  await insert(c, 'account', { id, business_id: b, code: String(code), name: t.label, type: 'EXPENSE', subtype: 'Operating', system_key: t.key, parent_id: parent?.id || null, is_active: 1 });
  return id;
}

// Validates and posts one bill. `after(conn, entryId)` runs in the same transaction (the schedule uses it to mark an occurrence posted).
export async function postBill(d, after) {
  const e = {}; const t = BILL_TYPES[d.type];
  if (!t) e.type = 'Choose a bill type.';
  if (!d.propertyId || !(await rows('SELECT 1 "x" FROM property WHERE id=:p', { p: d.propertyId })).length) e.propertyId = 'Choose a property.';
  const cents = Math.round(Number(d.amount) * 100);
  if (!d.amount || !Number.isFinite(cents) || cents <= 0) e.amount = 'Enter an amount greater than zero.';
  else if (cents > MAX_CENTS) e.amount = 'Keep the amount under $100,000.';
  const isDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v || '');
  if (!isDate(d.date)) e.date = 'Enter the bill date.';
  if (!isDate(d.due)) e.due = 'Enter the due date.'; else if (isDate(d.date) && d.due < d.date) e.due = 'The due date cannot be before the bill date.';
  fail(e);
  const b = await businessId();
  const ap = (await rows(`SELECT id::text "id" FROM account WHERE business_id=:b AND system_key='AP' AND is_active=1`, { b }))[0];
  if (!ap) throw new HttpError(400, 'Accounts Payable is missing from the chart of accounts.');
  const entryId = newId(); let vendorId = d.vendorId || null; const payee = text(d.payee);
  if (vendorId && !(await rows('SELECT 1 "x" FROM vendor WHERE id=:v AND business_id=:b', { v: vendorId, b })).length) throw new HttpError(400, 'Vendor not found.');
  if (!vendorId && !payee) fail({ payee: 'Choose or enter a vendor.' });
  await tx(async (c) => {
    if (!vendorId) { // typed name: reuse a vendor with the same name, otherwise add one
      const same = (await c.execute(`SELECT id::text "id" FROM vendor WHERE business_id=:b AND archived_at IS NULL AND LOWER(company)=LOWER(:n)`, { b, n: payee })).rows[0];
      vendorId = same?.id || newId();
      if (!same) await insert(c, 'vendor', { id: vendorId, business_id: b, company: payee });
    }
    const company = (await c.execute('SELECT company "company" FROM vendor WHERE id=:v', { v: vendorId })).rows[0].company;
    const expense = await ensureBillAccount(c, b, t);
    const n = (await c.execute('SELECT COALESCE(MAX(entry_number),0)+1 "n" FROM journal_entry WHERE business_id=:b', { b })).rows[0].n;
    const memo = `${t.label} bill, ${company} (due ${d.due})${text(d.notes) ? `: ${text(d.notes)}` : ''}`.slice(0, 255);
    await insert(c, 'journal_entry', { id: entryId, business_id: b, entry_number: n, entry_date: d.date, memo, source: 'BILL' });
    const tag = { business_id: b, entry_id: entryId, entry_date: d.date, property_id: d.propertyId, vendor_id: vendorId };
    await insert(c, 'journal_entry_line', { id: newId(), account_id: expense, debit_cents: cents, credit_cents: 0, ...tag });
    await insert(c, 'journal_entry_line', { id: newId(), account_id: ap.id, debit_cents: 0, credit_cents: cents, ...tag });
    if (after) await after(c, entryId);
  });
  return entryId;
}

router.post('/', wrap(async (req, res) => res.status(201).json({ id: await postBill(req.body || {}) })));
