import { Router } from 'express';
import { rows, tx, insert, update, newId, businessId } from './db.js';
import { loadLines, loadNames } from './reports.js';
import { nat, NO_PROPERTY } from './ledger.js';
import { fail, HttpError, ACCOUNT_TYPES, wrap, text, optText } from './util.js';

export const router = Router();

async function listAccounts(property = null) {
  const b = await businessId();
  const accs = await rows(`SELECT RAWTOHEX(id) "id", code "code", name "name", type "type", subtype "subtype", system_key "systemKey",
      RAWTOHEX(parent_id) "parentId", is_active "active", description "description" FROM account WHERE business_id=HEXTORAW(:b) ORDER BY code`, { b });
  const own = {};
  (await loadLines({ property })).forEach((l) => { own[l.accountId] = (own[l.accountId] || 0) + nat(l); });
  const kids = (id) => accs.filter((a) => a.parentId === id);
  const rolled = (id) => (own[id] || 0) + kids(id).reduce((s, k) => s + rolled(k.id), 0);
  return accs.map((a) => ({ ...a, type: a.type.toLowerCase(), system: !!a.systemKey, active: a.active === 1, balance: rolled(a.id) }));
}
const descendants = (accs, id) => accs.filter((a) => a.parentId === id).flatMap((k) => [k.id, ...descendants(accs, k.id)]);

function validate(d, id, accs) {
  const e = {}; const self = id ? accs.find((a) => a.id === id) : null;
  if (!ACCOUNT_TYPES.includes(d.type)) e.type = 'Choose an account type.';
  const name = text(d.name);
  if (!name) e.name = 'Enter an account name.'; else if (name.length > 80) e.name = 'Keep the name under 80 characters.';
  const code = text(d.code);
  if (!code) e.code = 'Enter an account code.';
  else if (!/^[A-Za-z0-9.-]{1,12}$/.test(code)) e.code = 'Use letters, numbers, dots or dashes (max 12).';
  else if (accs.some((a) => a.code === code && a.id !== id)) e.code = 'That code is already used.';
  if (d.sub) {
    const p = accs.find((a) => a.id === d.parentId);
    if (!p) e.parent = 'Choose a parent account.';
    else if (p.type !== d.type) e.parent = 'The parent must be the same type.';
    else if (!p.active) e.parent = 'The parent account is inactive.';
    else if (id && (p.id === id || descendants(accs, id).includes(p.id))) e.parent = 'An account cannot sit under itself.';
  }
  if (self && self.system && (d.type !== self.type || code !== self.code)) e.code = 'System accounts keep their code and type.';
  if (self && d.type !== self.type && accs.some((a) => a.parentId === id)) e.type = 'Move or remove the sub-accounts first.';
  return e;
}
const fields = (d) => ({ code: text(d.code), name: text(d.name), type: d.type.toUpperCase(), parent_id: d.sub ? d.parentId : null, description: optText(d.description) });

router.get('/', wrap(async (req, res) => res.json(await listAccounts(req.query.property || null))));
router.post('/', wrap(async (req, res) => {
  const d = req.body || {}; const accs = await listAccounts(); fail(validate(d, null, accs));
  const b = await businessId(); const id = newId();
  await tx((c) => insert(c, 'account', { id, business_id: b, ...fields(d), subtype: null, system_key: null, is_active: 1 }));
  res.status(201).json({ id });
}));
router.put('/:id', wrap(async (req, res) => {
  const d = req.body || {}; const id = req.params.id; const accs = await listAccounts();
  if (!accs.some((a) => a.id === id)) throw new HttpError(404, 'Account not found.');
  fail(validate(d, id, accs));
  await tx((c) => update(c, 'account', id, fields(d)));
  res.json({ id });
}));
router.post('/:id/active', wrap(async (req, res) => {
  const id = req.params.id; const active = !!req.body?.active; const accs = await listAccounts();
  const a = accs.find((x) => x.id === id); if (!a) throw new HttpError(404, 'Account not found.');
  if (!active) {
    if (a.system) throw new HttpError(400, 'System accounts cannot be deactivated.');
    if (a.balance !== 0) throw new HttpError(400, 'This account has a balance. Clear it before deactivating.');
    if (accs.some((k) => k.parentId === id && k.active)) throw new HttpError(400, 'Deactivate its sub-accounts first.');
  } else if (a.parentId && !accs.find((p) => p.id === a.parentId).active) throw new HttpError(400, 'Activate the parent account first.');
  await tx((c) => update(c, 'account', id, { is_active: active ? 1 : 0 }));
  res.json({ id, active });
}));
router.get('/:id/ledger', wrap(async (req, res) => {
  const [ls, names] = await Promise.all([loadLines({ property: req.query.property || null }), loadNames()]);
  const out = ls.filter((l) => l.accountId === req.params.id).map((l) => ({ date: l.date, memo: l.memo, property: l.propertyId ? names.properties[l.propertyId] : NO_PROPERTY, debit: l.dr, credit: l.cr }));
  res.json(out.reverse());
}));
