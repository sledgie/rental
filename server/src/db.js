import pg from 'pg';
import { randomUUID } from 'node:crypto';

// Row values the API expects as plain JS numbers / date strings, not pg's defaults (strings for bigint and numeric, Date for date).
pg.types.setTypeParser(20, Number);       // bigint (COUNT, SUM)
pg.types.setTypeParser(1700, Number);     // numeric
pg.types.setTypeParser(1082, (v) => v);   // date stays 'YYYY-MM-DD'

let pool;
export async function initPool() {
  const { DATABASE_URL, DATABASE_SSL } = process.env;
  if (!DATABASE_URL) throw new Error('Missing DATABASE_URL. Copy server/.env.example to server/.env and paste your Supabase connection string.');
  pool = new pg.Pool({ connectionString: DATABASE_URL, max: 4, ssl: DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false } });
  pool.on('error', (e) => console.error('Idle database connection error:', e.message));
  await pool.query('SELECT 1'); // fail fast on a bad connection string
  return pool;
}
export async function closePool() { if (pool) await pool.end(); }

// The SQL in this project uses named binds (:name). pg wants $1, $2, so convert, skipping '...' literals and :: casts.
function compile(sql, binds = {}) {
  const names = []; const values = [];
  const text = sql.replace(/'(?:[^']|'')*'|(?<![:\w]):([A-Za-z_]\w*)/g, (m, name) => {
    if (!name) return m;
    if (!(name in binds)) throw new Error(`Missing bind :${name}`);
    let i = names.indexOf(name);
    if (i < 0) { names.push(name); values.push(binds[name] === undefined ? null : binds[name]); i = names.length - 1; }
    return `$${i + 1}`;
  });
  return { text, values };
}
const run = async (client, sql, binds) => {
  const { text, values } = compile(sql, binds);
  const r = await client.query(text, values);
  return { rows: r.rows, rowsAffected: r.rowCount };
};

export const query = (sql, binds = {}) => run(pool, sql, binds);
export async function rows(sql, binds = {}) { return (await query(sql, binds)).rows; }
// Runs fn(conn) in one transaction; conn.execute(sql, binds) -> { rows, rowsAffected }.
export async function tx(fn) {
  const client = await pool.connect();
  const conn = { execute: (sql, binds = {}) => run(client, sql, binds), query: (text, values) => client.query(text, values) };
  try { await client.query('BEGIN'); const r = await fn(conn); await client.query('COMMIT'); return r; }
  catch (e) { try { await client.query('ROLLBACK'); } catch { /* ignore */ } throw e; }
  finally { client.release(); }
}

export const newId = () => randomUUID();
export async function insert(conn, table, row) {
  const cols = Object.keys(row).filter((k) => row[k] !== undefined);
  await conn.query(`INSERT INTO ${table} (${cols.join(',')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(',')})`, cols.map((c) => row[c]));
}
// Many rows in one statement (all rows must have the same keys). Chunked to stay under the 65,535 parameter limit.
export async function insertMany(conn, table, list) {
  if (!list.length) return;
  const cols = Object.keys(list[0]); const per = Math.max(1, Math.floor(60000 / cols.length));
  for (let s = 0; s < list.length; s += per) {
    const part = list.slice(s, s + per);
    await conn.query(`INSERT INTO ${table} (${cols.join(',')}) VALUES ${part.map((_, r) => `(${cols.map((__, c) => `$${r * cols.length + c + 1}`).join(',')})`).join(',')}`, part.flatMap((row) => cols.map((c) => row[c] ?? null)));
  }
}
export async function update(conn, table, id, fields) {
  const cols = Object.keys(fields).filter((k) => fields[k] !== undefined);
  await conn.query(`UPDATE ${table} SET ${cols.map((c, i) => `${c}=$${i + 1}`).join(',')} WHERE id=$${cols.length + 1}`, [...cols.map((c) => fields[c]), id]);
}

// A lease that ties a tenant to a unit (signed or not yet started).
export const CURRENT_LEASE = "('ACTIVE','DRAFT')";
// Optional " AND <col>=:p" clause for queries that can be narrowed to one property; adds :p to binds.
export function byProperty(col, property, binds) {
  if (!property) return '';
  binds.p = property;
  return ` AND ${col}=:p`;
}

let bid;
export async function businessId() {
  if (!bid) {
    const r = await rows('SELECT id::text "id" FROM business ORDER BY created_at LIMIT 1');
    if (!r.length) throw new Error('No business found. Run database/schema_supabase.sql in the Supabase SQL Editor, then: npm run seed');
    bid = r[0].id;
  }
  return bid;
}
