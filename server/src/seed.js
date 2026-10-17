// npm run seed          -> fills an empty schema with demo data
// npm run seed:reset    -> deletes the data first, then seeds again
import 'dotenv/config';
import { initPool, closePool, tx, rows, insert, insertMany, newId } from './db.js';
import { buildSeed } from './seedData.js';

const reset = process.argv.includes('--reset');
const strip = (o) => { const { key, ...rest } = o; return rest; };
try {
  await initPool();
  const existing = await rows('SELECT COUNT(*) "n" FROM business');
  if (existing[0].n > 0 && !reset) { console.log('Data already exists. Use "npm run seed:reset" to wipe and reseed.'); process.exit(0); }
  const s = buildSeed();
  await tx(async (c) => {
    if (reset) for (const t of ['credit_note_line', 'credit_note', 'journal_entry_line', 'journal_entry', 'bill_schedule_run', 'bill_schedule', 'vendor', 'lease_tenant', 'lease', 'tenant', 'unit', 'property', 'account', 'business']) await c.execute(`DELETE FROM ${t}`);
    await insert(c, 'business', s.business);
    await insertMany(c, 'account', s.accounts);
    await insertMany(c, 'property', s.properties.map(strip));
    await insertMany(c, 'unit', s.units.map(strip));
    await insertMany(c, 'tenant', s.tenants.map(strip));
    await insertMany(c, 'lease', s.leases);
    await insertMany(c, 'lease_tenant', s.members.map((m) => ({ id: newId(), ...m })));
    await insertMany(c, 'journal_entry', s.entries.map((e) => ({ id: e.id, business_id: s.business.id, entry_number: e.entry_number, entry_date: e.entry_date, memo: e.memo, source: e.source })));
    await insertMany(c, 'journal_entry_line', s.entries.flatMap((e) => e.lines.map((l) => ({ id: newId(), entry_id: e.id, business_id: s.business.id, account_id: l.accountId, debit_cents: l.dr, credit_cents: l.cr, property_id: l.propertyId, unit_id: l.unitId, tenant_id: l.tenantId, entry_date: e.entry_date, memo: e.memo }))));
  });
  console.log('Seeded demo data: 1 business, 26 accounts, 3 properties, 9 units, 9 tenants, 7 leases (one household with a co-tenant and an occupant), ledger entries.');
} catch (e) { console.error('Seed failed:', e.message); process.exitCode = 1; }
finally { await closePool().catch(() => {}); }
