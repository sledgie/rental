import oracledb from 'oracledb';
import { randomUUID } from 'node:crypto';

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
oracledb.fetchAsString = [oracledb.CLOB];

let pool;
export async function initPool() {
  const { ORACLE_USER, ORACLE_PASSWORD, ORACLE_CONNECT_STRING, ORACLE_WALLET_DIR, ORACLE_WALLET_PASSWORD } = process.env;
  if (!ORACLE_USER || !ORACLE_PASSWORD || !ORACLE_CONNECT_STRING) {
    throw new Error('Missing ORACLE_USER, ORACLE_PASSWORD or ORACLE_CONNECT_STRING. Copy server/.env.example to server/.env and fill it in.');
  }
  const cfg = { user: ORACLE_USER, password: ORACLE_PASSWORD, connectString: ORACLE_CONNECT_STRING, poolMin: 0, poolMax: 4, poolIncrement: 1 };
  if (ORACLE_WALLET_DIR) { cfg.configDir = ORACLE_WALLET_DIR; cfg.walletLocation = ORACLE_WALLET_DIR; if (ORACLE_WALLET_PASSWORD) cfg.walletPassword = ORACLE_WALLET_PASSWORD; }
  pool = await oracledb.createPool(cfg);
  return pool;
}
export async function closePool() { if (pool) await pool.close(5); }

export async function withConn(fn) { const c = await pool.getConnection(); try { return await fn(c); } finally { await c.close(); } }
export async function query(sql, binds = {}) { return withConn((c) => c.execute(sql, binds)); }
export async function rows(sql, binds = {}) { return (await query(sql, binds)).rows; }
export async function tx(fn) {
  const c = await pool.getConnection();
  try { const r = await fn(c); await c.commit(); return r; }
  catch (e) { try { await c.rollback(); } catch { /* ignore */ } throw e; }
  finally { await c.close(); }
}

export const newId = () => randomUUID().replace(/-/g, '').toUpperCase();
const RAWCOL = /(^id$|_id$)/;
const DATECOL = new Set(['entry_date', 'start_date', 'end_date', 'move_in_date', 'move_out_date', 'terminated_at', 'available_on']);
const ph = (c) => (RAWCOL.test(c) ? `HEXTORAW(:${c})` : DATECOL.has(c) ? `TO_DATE(:${c},'YYYY-MM-DD')` : `:${c}`);
export async function insert(conn, table, row) {
  const cols = Object.keys(row).filter((k) => row[k] !== undefined);
  const binds = Object.fromEntries(cols.map((c) => [c, row[c]]));
  await conn.execute(`INSERT INTO ${table} (${cols.join(',')}) VALUES (${cols.map(ph).join(',')})`, binds);
}
export async function update(conn, table, id, fields) {
  const cols = Object.keys(fields).filter((k) => fields[k] !== undefined);
  const set = cols.map((c) => `${c}=${ph(c)}`).join(',');
  await conn.execute(`UPDATE ${table} SET ${set} WHERE id=HEXTORAW(:rid)`, { ...Object.fromEntries(cols.map((c) => [c, fields[c]])), rid: id });
}

// A lease that ties a tenant to a unit (signed or not yet started).
export const CURRENT_LEASE = "('ACTIVE','DRAFT')";
// Optional " AND <col>=:p" clause for queries that can be narrowed to one property; adds :p to binds.
export function byProperty(col, property, binds) {
  if (!property) return '';
  binds.p = property;
  return ` AND ${col}=HEXTORAW(:p)`;
}

let bid;
export async function businessId() {
  if (!bid) {
    const r = await rows('SELECT RAWTOHEX(id) "id" FROM business ORDER BY created_at FETCH FIRST 1 ROWS ONLY');
    if (!r.length) throw new Error('No business found. Run the schema script in FreeSQL, then: npm run seed');
    bid = r[0].id;
  }
  return bid;
}
export { oracledb };
