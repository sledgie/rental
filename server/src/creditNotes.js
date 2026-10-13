// Credit notes: money the business owes a tenant, held as a Tenant Credits liability until it is used.
// Issuing posts  Dr Rent Adjustments / Cr Tenant Credits  (tenant, unit and property tagged on both lines).
import { Router } from 'express';
import { rows, tx, insert, newId, businessId, byProperty, CURRENT_LEASE } from './db.js';
import { fail, HttpError, wrap, today, text, optText } from './util.js';

export const router = Router();
const STATUS = { DRAFT: 'draft', OPEN: 'open', PARTIALLY_APPLIED: 'partial', APPLIED: 'applied', VOID: 'void' };
const MAX_CENTS = 10000000; // $100,000 per credit note

router.get('/', wrap(async (req, res) => {
  const b = await businessId(); const binds = { b };
  const w = byProperty('l.property_id', req.query.property, binds);
  const r = await rows(`SELECT RAWTOHEX(cn.id) "id", cn.doc_number "number", cn.subject "subject", cn.reason "reason", cn.status "status",
      TO_CHAR(cn.issue_date,'YYYY-MM-DD') "date", cn.amount_cents "amount", cn.applied_cents "applied", RAWTOHEX(cn.tenant_id) "tenantId",
      t.first_name || ' ' || t.last_name "tenantName", p.name "propertyName", u.unit_number "unitNumber"
    FROM credit_note cn JOIN tenant t ON t.id=cn.tenant_id LEFT JOIN lease l ON l.id=cn.lease_id LEFT JOIN property p ON p.id=l.property_id LEFT JOIN unit u ON u.id=l.unit_id
    WHERE cn.business_id=HEXTORAW(:b)${w} ORDER BY cn.issue_date DESC, cn.doc_number DESC`, binds);
  res.json(r.map((x) => ({ ...x, status: STATUS[x.status], available: x.status === 'VOID' || x.status === 'DRAFT' ? 0 : x.amount - x.applied })));
}));

async function validate(d) {
  const e = {};
  if (!d.tenantId) e.tenant = 'Choose a tenant.';
  else if (!(await rows('SELECT 1 "x" FROM tenant WHERE id=HEXTORAW(:t)', { t: d.tenantId })).length) e.tenant = 'Tenant not found.';
  const cents = Math.round(Number(d.amount) * 100);
  if (!d.amount || !Number.isFinite(cents) || cents <= 0) e.amount = 'Enter an amount greater than zero.';
  else if (cents > MAX_CENTS) e.amount = 'Keep the amount under $100,000.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date || '')) e.date = 'Enter the credit note date.';
  if (!text(d.reason)) e.reason = 'Enter the reason for this credit.';
  fail(e);
  return cents;
}
async function accountId(b, where) {
  const r = await rows(`SELECT RAWTOHEX(id) "id" FROM account WHERE business_id=HEXTORAW(:b) AND is_active=1 AND (${where}) ORDER BY code FETCH FIRST 1 ROWS ONLY`, { b });
  if (!r.length) throw new HttpError(400, 'A required system account is missing from the chart of accounts (Tenant Credits or Rent Adjustments).');
  return r[0].id;
}

router.post('/', wrap(async (req, res) => {
  const d = req.body || {}; const cents = await validate(d); const b = await businessId();
  const [credits, adjust] = await Promise.all([accountId(b, "system_key='TENANT_CREDITS'"), accountId(b, "system_key='RENT_ADJUSTMENTS' OR code='4900'")]);
  const lease = (await rows(`SELECT RAWTOHEX(id) "id", RAWTOHEX(unit_id) "unitId", RAWTOHEX(property_id) "propertyId" FROM lease WHERE tenant_id=HEXTORAW(:t) AND status IN ${CURRENT_LEASE}`, { t: d.tenantId }))[0] || {};
  const id = newId(); const entryId = newId(); let number;
  await tx(async (c) => {
    const nEntry = (await c.execute('SELECT NVL(MAX(entry_number),0)+1 "n" FROM journal_entry WHERE business_id=HEXTORAW(:b)', { b })).rows[0].n;
    const nCn = (await c.execute(`SELECT NVL(MAX(TO_NUMBER(SUBSTR(doc_number,4))),0)+1 "n" FROM credit_note WHERE business_id=HEXTORAW(:b) AND REGEXP_LIKE(doc_number,'^CN-[0-9]+$')`, { b })).rows[0].n;
    number = `CN-${String(nCn).padStart(4, '0')}`;
    const memo = `Credit note ${number}: ${text(d.reason)}`.slice(0, 255);
    await insert(c, 'journal_entry', { id: entryId, business_id: b, entry_number: nEntry, entry_date: d.date, memo, source: 'MANUAL', source_type: 'credit_note', source_id: id });
    const tag = { business_id: b, entry_id: entryId, entry_date: d.date, property_id: lease.propertyId, unit_id: lease.unitId, tenant_id: d.tenantId, lease_id: lease.id };
    await insert(c, 'journal_entry_line', { id: newId(), account_id: adjust, debit_cents: cents, credit_cents: 0, ...tag });
    await insert(c, 'journal_entry_line', { id: newId(), account_id: credits, debit_cents: 0, credit_cents: cents, ...tag });
    await insert(c, 'credit_note', { id: id, business_id: b, tenant_id: d.tenantId, lease_id: lease.id, doc_number: number, subject: optText(d.subject), status: 'OPEN',
      customer_notes: optText(d.notes), issue_date: d.date, amount_cents: cents, applied_cents: 0, reason: text(d.reason), journal_entry_id: entryId });
    await insert(c, 'credit_note_line', { id: newId(), credit_note_id: id, account_id: adjust, description: text(d.reason), quantity: 1, rate_cents: cents, discount_cents: 0, amount_cents: cents, line_position: 1 });
  });
  res.status(201).json({ id, number });
}));

// Cancels an unused credit note by posting the opposite entry.
router.post('/:id/void', wrap(async (req, res) => {
  const id = req.params.id; const b = await businessId();
  const cn = (await rows(`SELECT status "status", applied_cents "applied", RAWTOHEX(journal_entry_id) "entryId", doc_number "number" FROM credit_note WHERE id=HEXTORAW(:i) AND business_id=HEXTORAW(:b)`, { i: id, b }))[0];
  if (!cn) throw new HttpError(404, 'Credit note not found.');
  if (cn.status === 'VOID') throw new HttpError(400, 'This credit note is already void.');
  if (cn.applied > 0) throw new HttpError(400, 'Part of this credit has already been used, so it cannot be voided.');
  const ls = await rows(`SELECT RAWTOHEX(account_id) "accountId", debit_cents "dr", credit_cents "cr", RAWTOHEX(property_id) "propertyId", RAWTOHEX(unit_id) "unitId", RAWTOHEX(tenant_id) "tenantId", RAWTOHEX(lease_id) "leaseId"
    FROM journal_entry_line WHERE entry_id=HEXTORAW(:e)`, { e: cn.entryId });
  const rev = newId();
  await tx(async (c) => {
    const n = (await c.execute('SELECT NVL(MAX(entry_number),0)+1 "n" FROM journal_entry WHERE business_id=HEXTORAW(:b)', { b })).rows[0].n;
    await insert(c, 'journal_entry', { id: rev, business_id: b, entry_number: n, entry_date: today(), memo: `Void credit note ${cn.number}`, source: 'REVERSAL', source_type: 'credit_note', source_id: id, reversal_of_id: cn.entryId });
    for (const l of ls) await insert(c, 'journal_entry_line', { id: newId(), business_id: b, entry_id: rev, account_id: l.accountId, debit_cents: l.cr, credit_cents: l.dr, entry_date: today(), property_id: l.propertyId, unit_id: l.unitId, tenant_id: l.tenantId, lease_id: l.leaseId });
    await c.execute(`UPDATE journal_entry SET status='REVERSED' WHERE id=HEXTORAW(:e)`, { e: cn.entryId });
    await c.execute(`UPDATE credit_note SET status='VOID', voided_at=SYSTIMESTAMP WHERE id=HEXTORAW(:i)`, { i: id });
  });
  res.json({ id });
}));
