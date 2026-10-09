const BASE = import.meta.env.VITE_API_URL || '';

async function req(path, method = 'GET', body) {
  const r = await fetch(`${BASE}/api${path}`, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(j.message || 'Request failed'); e.errors = j.errors; throw e; }
  return j;
}
export const api = {
  get: (p) => req(p),
  post: (p, b = {}) => req(p, 'POST', b),
  put: (p, b) => req(p, 'PUT', b),
};
export const qs = (o) => { const p = new URLSearchParams(Object.entries(o).filter(([, v]) => v)); const s = p.toString(); return s ? `?${s}` : ''; };
