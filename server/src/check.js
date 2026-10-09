// Quick connection test: npm run check
import 'dotenv/config';
import { initPool, closePool, rows } from './db.js';

const { ORACLE_USER: u = '', ORACLE_PASSWORD: p = '', ORACLE_CONNECT_STRING: cs = '' } = process.env;
try {
  await initPool();
  const who = await rows('SELECT USER "u" FROM dual');
  const t = await rows('SELECT COUNT(*) "n" FROM user_tables');
  console.log(`Connected as ${who[0].u}. Tables in this schema: ${t[0].n} (the schema script creates 47).`);
} catch (e) {
  console.error('Connection failed:', e.message);
  // Safe diagnostics: never prints the password itself.
  console.error('--- what the server read from server/.env ---');
  console.error(`user:            "${u}" (${u.length} characters)`);
  console.error(`password length: ${p.length} characters`);
  console.error(`connect string:  "${cs}"`);
  if (u !== u.trim() || p !== p.trim() || cs !== cs.trim()) console.error('WARNING: a value has a space at the start or end.');
  if (/[#$"'\\\s]/.test(p)) console.error('NOTE: the password contains a special character (# $ quote backslash or space). Wrap the value in double quotes in .env.');
  process.exitCode = 1;
} finally { await closePool().catch(() => {}); }
