// Vendors: who the business pays. Bills link to a vendor through journal_entry_line.vendor_id.
import { Router } from 'express';
import { rows, tx, insert, update, newId, businessId } from './db.js';
import { fail, HttpError, wrap, text, optText } from './util.js';

export const router = Router();

router.get('/', wrap(async (req, res) => {
  const b = await businessId();
  res.json(await rows(`SELECT RAWTOHEX(v.id) "id", v.company "company", v.contact_name "contact", v.phone "phone", v.email "email", NVL(x.n,0) "bills", NVL(x.total,0) "total"
    FROM vendor v LEFT JOIN (
      SELECT l.vendor_id vid, COUNT(*) n, SUM(l.credit_cents) total FROM journal_entry_line l JOIN journal_entry e ON e.id=l.entry_id JOIN account a ON a.id=l.account_id
      WHERE a.system_key='AP' AND e.source='BILL' AND e.status='POSTED' AND l.vendor_id IS NOT NULL GROUP BY l.vendor_id) x ON x.vid=v.id
    WHERE v.business_id=HEXTORAW(:b) AND v.archived_at IS NULL ORDER BY LOWER(v.company)`, { b }));
}));

async function validate(d, id, b) {
  const e = {}; const name = text(d.company);
  if (!name) e.company = 'Enter the vendor name.';
  else if ((await rows(`SELECT RAWTOHEX(id) "id" FROM vendor WHERE business_id=HEXTORAW(:b) AND archived_at IS NULL AND LOWER(company)=LOWER(:n)`, { b, n: name })).some((x) => x.id !== id)) e.company = 'A vendor with this name already exists.';
  if (d.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email.trim())) e.email = 'Enter a valid email address.';
  fail(e);
}
const fields = (d) => ({ company: text(d.company), contact_name: optText(d.contact), phone: optText(d.phone), email: optText(d.email) });

router.post('/', wrap(async (req, res) => {
  const d = req.body || {}; const b = await businessId(); await validate(d, null, b); const id = newId();
  await tx((c) => insert(c, 'vendor', { id, business_id: b, ...fields(d) }));
  res.status(201).json({ id, company: text(d.company) });
}));
router.put('/:id', wrap(async (req, res) => {
  const d = req.body || {}; const id = req.params.id; const b = await businessId();
  if (!(await rows('SELECT 1 "x" FROM vendor WHERE id=HEXTORAW(:i) AND business_id=HEXTORAW(:b)', { i: id, b })).length) throw new HttpError(404, 'Vendor not found.');
  await validate(d, id, b);
  await tx((c) => update(c, 'vendor', id, fields(d)));
  res.json({ id });
}));
