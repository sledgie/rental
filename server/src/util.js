export class ValidationError extends Error { constructor(errors) { super('Validation failed'); this.errors = errors; } }
export class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
export function fail(errors) { if (Object.keys(errors).length) throw new ValidationError(errors); }
export const today = () => process.env.AS_OF_DATE || new Date().toISOString().slice(0, 10);
export function addYear(d) { const x = new Date(d + 'T00:00:00Z'); x.setUTCFullYear(x.getUTCFullYear() + 1); x.setUTCDate(x.getUTCDate() - 1); return x.toISOString().slice(0, 10); }
export const inv = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [v, k]));
export const text = (v) => (v || '').trim();
export const optText = (v) => text(v) || null;
export const periodParam = (v) => (v === 'ytd' ? 'ytd' : 'month');
export const TENANT_STATUS = { applicant: 'APPLICANT', active: 'ACTIVE', pending_in: 'PENDING_MOVE_IN', pending_out: 'PENDING_MOVE_OUT', past: 'PAST' };
export const PROPERTY_TYPE = { 'Single family': 'SINGLE_FAMILY', 'Multi-family': 'MULTI_FAMILY', 'Apartment building': 'APARTMENT_BUILDING', Condo: 'CONDO', Commercial: 'COMMERCIAL', 'Mixed use': 'MIXED_USE', Other: 'OTHER' };
export const UNIT_STATUSES = ['occupied', 'vacant', 'reserved', 'maintenance', 'unavailable'];
export const ACCOUNT_TYPES = ['asset', 'liability', 'equity', 'income', 'expense'];
export const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
