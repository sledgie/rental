// npm run seed          -> fills an empty schema with demo data
// npm run seed:reset    -> deletes the data first, then seeds again
import 'dotenv/config';
import { initPool, closePool, tx, rows, insert, oracledb } from './db.js';
import { buildSeed } from './seedData.js';

const reset = process.argv.includes('--reset');
const strip = (o) => { const { key, ...rest } = o; return rest; };
try {
  await initPool();
  const existing = await rows('SELECT COUNT(*) "n" FROM business');
  if (existing[0].n > 0 && !reset) { console.log('Data already exists. Use "npm run seed:reset" to wipe and reseed.'); process.exit(0); }
  const s = buildSeed();
  await tx(async (c) => {
    if (reset) for (const t of ['journal_entry_line', 'journal_entry', 'lease', 'tenant', 'unit', 'property', 'account', 'business']) await c.execute(`DELETE FROM ${t}`);
    await insert(c, 'business', s.business);
    for (const a of s.accounts) await insert(c, 'account', a);
    for (const p of s.properties) await insert(c, 'property', strip(p));
    for (const u of s.units) await insert(c, 'unit', strip(u));
    for (const t of s.tenants) await insert(c, 'tenant', strip(t));
    for (const l of s.leases) await insert(c, 'lease', l);
    for (const e of s.entries) await insert(c, 'journal_entry', { id: e.id, business_id: s.business.id, entry_number: e.entry_number, entry_date: e.entry_date, memo: e.memo, source: e.source });
    const binds = s.entries.flatMap((e) => e.lines.map((l) => ({ id: crypto.randomUUID().replace(/-/g, '').toUpperCase(), eid: e.id, bid: s.business.id, aid: l.accountId, dr: l.dr, cr: l.cr, pid: l.propertyId, unitid: l.unitId, tid: l.tenantId, d: e.entry_date, memo: e.memo })));
    await c.executeMany(`INSERT INTO journal_entry_line (id, entry_id, business_id, account_id, debit_cents, credit_cents, property_id, unit_id, tenant_id, entry_date, memo)
      VALUES (HEXTORAW(:id), HEXTORAW(:eid), HEXTORAW(:bid), HEXTORAW(:aid), :dr, :cr, HEXTORAW(:pid), HEXTORAW(:unitid), HEXTORAW(:tid), TO_DATE(:d,'YYYY-MM-DD'), :memo)`, binds,
      { bindDefs: { id: { type: oracledb.STRING, maxSize: 32 }, eid: { type: oracledb.STRING, maxSize: 32 }, bid: { type: oracledb.STRING, maxSize: 32 }, aid: { type: oracledb.STRING, maxSize: 32 }, dr: { type: oracledb.NUMBER }, cr: { type: oracledb.NUMBER }, pid: { type: oracledb.STRING, maxSize: 32 }, unitid: { type: oracledb.STRING, maxSize: 32 }, tid: { type: oracledb.STRING, maxSize: 32 }, d: { type: oracledb.STRING, maxSize: 10 }, memo: { type: oracledb.STRING, maxSize: 255 } } });
  });
  console.log('Seeded demo data: 1 business, 21 accounts, 3 properties, 9 units, 7 tenants, 7 leases, ledger entries.');
} catch (e) { console.error('Seed failed:', e.message); process.exitCode = 1; }
finally { await closePool().catch(() => {}); }
