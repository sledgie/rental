// Bill schedules: bills that are expected on a repeating basis (daily, weekly, monthly, or every N days/weeks/months).
// Each due date that has not been posted or skipped is "pending"; pending dates in the past are overdue.
// Posting an occurrence creates a real bill (bills.js) linked to the schedule's vendor and property.
import { Router } from 'express';
import { rows, tx, insert, update, newId, businessId, byProperty } from './db.js';
import { postBill, BILL_TYPES } from './bills.js';
import { occurrences, status } from './recurrence.js';
import { fail, HttpError, wrap, today, text, optText } from './util.js';

export const router = Router();
const FREQ = { DAILY: [1, 'DAY'], WEEKLY: [1, 'WEEK'], MONTHLY: [1, 'MONTH'] };
const UNITS = ['DAY', 'WEEK', 'MONTH'];
const MAX_CENTS = 10000000;
const isDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v || '');

const SELECT = `SELECT RAWTOHEX(s.id) "id", s.bill_type "type", RAWTOHEX(s.property_id) "propertyId", p.name "propertyName", RAWTOHEX(s.vendor_id) "vendorId", v.company "vendorName",
    s.amount_cents "amount", s.frequency "frequency", s.repeat_every "every", s.repeat_unit "unit", TO_CHAR(s.start_date,'YYYY-MM-DD') "start", TO_CHAR(s.end_date,'YYYY-MM-DD') "end",
    s.notes "notes", s.is_active "active"
  FROM bill_schedule s JOIN property p ON p.id=s.property_id JOIN vendor v ON v.id=s.vendor_id`;

async function handledDates(ids) {
  const m = {}; ids.forEach((i) => { m[i] = new Set(); });
  if (!ids.length) return m;
  const binds = Object.fromEntries(ids.map((id, i) => [`i${i}`, id]));
  const r = await rows(`SELECT RAWTOHEX(schedule_id) "id", TO_CHAR(due_date,'YYYY-MM-DD') "d" FROM bill_schedule_run WHERE schedule_id IN (${ids.map((_, i) => `HEXTORAW(:i${i})`).join(',')})`, binds);
  r.forEach((x) => m[x.id].add(x.d));
  return m;
}
const shape = (x, handled, t) => {
  const s = { ...x, active: x.active === 1, label: BILL_TYPES[x.type.toLowerCase()]?.label || x.type, type: x.type.toLowerCase(), frequency: x.frequency.toLowerCase(), start: x.start, end: x.end, every: x.every, unit: x.unit };
  return { ...s, ...status({ start: s.start, end: s.end, every: s.every, unit: s.unit, active: s.active }, handled, t) };
};

// Every schedule with where it stands today. Used by the schedule page, the property cards and the dashboard.
export async function listSchedules(property = null, t = today()) {
  const b = await businessId(); const binds = { b };
  const w = byProperty('s.property_id', property, binds);
  const list = await rows(`${SELECT} WHERE s.business_id=HEXTORAW(:b)${w} ORDER BY p.name, v.company`, binds);
  const handled = await handledDates(list.map((x) => x.id));
  return list.map((x) => shape(x, handled[x.id], t));
}
export const ATTENTION = new Set(['overdue', 'soon']);

router.get('/', wrap(async (req, res) => res.json(await listSchedules(req.query.property || null))));

async function validate(d) {
  const e = {};
  if (!BILL_TYPES[d.type]) e.type = 'Choose a bill type.';
  if (!d.propertyId || !(await rows('SELECT 1 "x" FROM property WHERE id=HEXTORAW(:p)', { p: d.propertyId })).length) e.propertyId = 'Choose a property.';
  if (!d.vendorId && !text(d.payee)) e.payee = 'Choose or enter a vendor.';
  const cents = Math.round(Number(d.amount) * 100);
  if (!d.amount || !Number.isFinite(cents) || cents <= 0) e.amount = 'Enter an amount greater than zero.';
  else if (cents > MAX_CENTS) e.amount = 'Keep the amount under $100,000.';
  let every = 1; let unit = 'MONTH';
  if (!FREQ[String(d.frequency).toUpperCase()] && String(d.frequency).toUpperCase() !== 'CUSTOM') e.frequency = 'Choose how often it repeats.';
  else if (FREQ[String(d.frequency).toUpperCase()]) [every, unit] = FREQ[String(d.frequency).toUpperCase()];
  else {
    every = Number(d.every); unit = String(d.unit).toUpperCase();
    if (!Number.isInteger(every) || every < 1 || every > 365) e.every = 'Enter a whole number from 1 to 365.';
    if (!UNITS.includes(unit)) e.unit = 'Choose days, weeks or months.';
  }
  if (!isDate(d.start)) e.start = 'Enter the start date.';
  if (String(d.frequency).toUpperCase() === 'CUSTOM' && !isDate(d.end)) e.end = 'Enter the end date for a custom schedule.';
  else if (d.end && !isDate(d.end)) e.end = 'Enter a valid end date.';
  else if (d.end && isDate(d.start) && d.end < d.start) e.end = 'The end date cannot be before the start date.';
  fail(e);
  return { cents, every, unit };
}
async function vendorFor(c, b, d) {
  if (d.vendorId) {
    if (!(await c.execute('SELECT 1 "x" FROM vendor WHERE id=HEXTORAW(:v) AND business_id=HEXTORAW(:b)', { v: d.vendorId, b })).rows.length) throw new HttpError(400, 'Vendor not found.');
    return d.vendorId;
  }
  const name = text(d.payee);
  const same = (await c.execute(`SELECT RAWTOHEX(id) "id" FROM vendor WHERE business_id=HEXTORAW(:b) AND archived_at IS NULL AND LOWER(company)=LOWER(:n)`, { b, n: name })).rows[0];
  if (same) return same.id;
  const id = newId(); await insert(c, 'vendor', { id, business_id: b, company: name }); return id;
}
const fields = (d, p, vendorId) => ({ property_id: d.propertyId, vendor_id: vendorId, bill_type: d.type.toUpperCase(), amount_cents: p.cents, frequency: String(d.frequency).toUpperCase(), repeat_every: p.every, repeat_unit: p.unit, start_date: d.start, end_date: d.end || null, notes: optText(d.notes) });

router.post('/', wrap(async (req, res) => {
  const d = req.body || {}; const p = await validate(d); const b = await businessId(); const id = newId();
  await tx(async (c) => insert(c, 'bill_schedule', { id, business_id: b, ...fields(d, p, await vendorFor(c, b, d)), is_active: 1 }));
  res.status(201).json({ id });
}));
router.put('/:id', wrap(async (req, res) => {
  const d = req.body || {}; const id = req.params.id; const b = await businessId(); await findOne(id);
  const p = await validate(d);
  await tx(async (c) => update(c, 'bill_schedule', id, fields(d, p, await vendorFor(c, b, d))));
  res.json({ id });
}));
router.post('/:id/active', wrap(async (req, res) => {
  const id = req.params.id; await findOne(id); const active = !!req.body?.active;
  await tx((c) => update(c, 'bill_schedule', id, { is_active: active ? 1 : 0 })); res.json({ id, active });
}));
router.delete('/:id', wrap(async (req, res) => {
  const id = req.params.id; await findOne(id);
  await tx((c) => c.execute('DELETE FROM bill_schedule WHERE id=HEXTORAW(:i)', { i: id })); res.json({ id });
}));

async function findOne(id) {
  const b = await businessId();
  const x = (await rows(`${SELECT} WHERE s.id=HEXTORAW(:i) AND s.business_id=HEXTORAW(:b)`, { i: id, b }))[0];
  if (!x) throw new HttpError(404, 'Schedule not found.');
  return x;
}
// Occurrences still waiting (not posted or skipped), up to and including the next one due.
async function pendingDates(x, t) {
  const handled = (await handledDates([x.id]))[x.id];
  const sch = shape(x, handled, t);
  if (!sch.active) throw new HttpError(400, 'This schedule is paused. Resume it first.');
  const upTo = sch.next || t;
  return { sch, dates: occurrences({ start: sch.start, end: sch.end, every: sch.every, unit: sch.unit }, upTo).filter((dt) => !handled.has(dt)) };
}

// Turns the next pending occurrence (or body.due) into a real bill.
router.post('/:id/post', wrap(async (req, res) => {
  const t = today(); const x = await findOne(req.params.id); const { dates } = await pendingDates(x, t);
  const due = req.body?.due || dates[0];
  if (!due || !dates.includes(due)) throw new HttpError(400, 'Nothing is waiting to be posted for this schedule.');
  const date = due < t ? due : t;
  const id = await postBill({ type: x.type.toLowerCase(), propertyId: x.propertyId, vendorId: x.vendorId, amount: x.amount / 100, date, due, notes: x.notes },
    (c, entryId) => insert(c, 'bill_schedule_run', { id: newId(), schedule_id: x.id, due_date: due, status: 'POSTED', journal_entry_id: entryId }));
  res.status(201).json({ id, due });
}));
// Marks the next pending occurrence (or every overdue one, with body.all) as not needed.
router.post('/:id/skip', wrap(async (req, res) => {
  const t = today(); const x = await findOne(req.params.id); const { dates } = await pendingDates(x, t);
  const pick = req.body?.all ? dates.filter((dt) => dt < t) : dates.slice(0, 1);
  if (!pick.length) throw new HttpError(400, 'Nothing is waiting for this schedule.');
  await tx(async (c) => { for (const dt of pick) await insert(c, 'bill_schedule_run', { id: newId(), schedule_id: x.id, due_date: dt, status: 'SKIPPED' }); });
  res.json({ skipped: pick.length });
}));
