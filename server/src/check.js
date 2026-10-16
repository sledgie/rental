// Quick connection test: npm run check
import 'dotenv/config';
import { initPool, closePool, rows } from './db.js';

const url = process.env.DATABASE_URL || '';
try {
  await initPool();
  const who = await rows('SELECT current_user "u", current_database() "d"');
  const t = await rows("SELECT COUNT(*) \"n\" FROM information_schema.tables WHERE table_schema='public'");
  console.log(`Connected to ${who[0].d} as ${who[0].u}. Tables in the public schema: ${t[0].n} (database/schema_supabase.sql creates 50).`);
} catch (e) {
  console.error('Connection failed:', e.message);
  // Safe diagnostics: never prints the password.
  console.error('--- what the server read from server/.env ---');
  try { const u = new URL(url); console.error(`host: ${u.hostname}  port: ${u.port || '(default)'}  user: ${decodeURIComponent(u.username)}  database: ${u.pathname.slice(1)}  password length: ${decodeURIComponent(u.password).length}`); }
  catch { console.error(url ? 'DATABASE_URL is not a valid URL. If the password has special characters (@ : / # ?), URL-encode them.' : 'DATABASE_URL is empty.'); }
  process.exitCode = 1;
} finally { await closePool().catch(() => {}); }
