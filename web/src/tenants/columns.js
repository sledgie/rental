// Column catalogue for the Tenants grid. `value` gives the raw value used for sorting and filtering; cells render separately in DataGrid.
import { money } from '../format.js';

export const STATUS = { applicant: ['Applicant', 'b-sys'], active: ['Active', 'b-ok'], pending_in: ['Pending move-in', 'b-warn'], pending_out: ['Pending move-out', 'b-warn'], past: ['Past tenant', 'b-off'] };
export const ROLE = { primary: 'Primary tenant', co_tenant: 'Co-tenant', occupant: 'Occupant' };
const statusOpts = Object.entries(STATUS).map(([k, v]) => [k, v[0]]);
const roleOpts = Object.entries(ROLE);

export const COLUMNS = [
  { key: 'name', label: 'Name', group: 'Tenant Fields', type: 'text', width: 240, alwaysVisible: true, value: (r) => `${r.first} ${r.last}`.trim() },
  { key: 'email', label: 'Email', group: 'Tenant Fields', type: 'text', width: 220, value: (r) => r.email || null },
  { key: 'phone', label: 'Phone', group: 'Tenant Fields', type: 'text', width: 150, value: (r) => r.phone || null },
  { key: 'status', label: 'Status', group: 'Tenant Fields', type: 'enum', width: 150, options: statusOpts, value: (r) => r.status },
  { key: 'role', label: 'Role', group: 'Tenant Fields', type: 'enum', width: 140, options: roleOpts, value: (r) => r.role || null },
  { key: 'moveIn', label: 'Move-in date', group: 'Tenant Fields', type: 'date', width: 130, value: (r) => r.moveIn || null },
  { key: 'balance', label: 'Household Balance', group: 'Tenant Fields', type: 'money', width: 160, value: (r) => (r.role === 'occupant' ? null : r.balance) },
  { key: 'property', label: 'Property', group: 'Property Fields', type: 'text', width: 180, value: (r) => r.propertyName || null },
  { key: 'unit', label: 'Unit', group: 'Property Fields', type: 'text', width: 170, value: (r) => (r.unitNumber ? `${r.propertyName} · ${r.unitNumber}` : null) },
  { key: 'rent', label: 'Monthly rent', group: 'Property Fields', type: 'money', width: 130, value: (r) => (r.rent && r.role !== 'occupant' ? r.rent : null) },
];
export const COL = Object.fromEntries(COLUMNS.map((c) => [c.key, c]));
const DEFAULT_VISIBLE = ['name', 'email', 'phone', 'unit', 'balance', 'status'];
// Visible columns first (in the default order), then the hidden ones.
export const defaultState = () => [...DEFAULT_VISIBLE, ...COLUMNS.map((c) => c.key).filter((k) => !DEFAULT_VISIBLE.includes(k))]
  .map((key) => ({ key, width: COL[key].width, pin: key === 'name' ? 'left' : null, visible: DEFAULT_VISIBLE.includes(key) }));
// Saved layouts from an older build may miss columns added since; keep what is saved and append the rest.
export const mergeState = (saved) => {
  const have = new Set(saved.map((s) => s.key));
  return [...saved.filter((s) => COL[s.key]), ...defaultState().filter((s) => !have.has(s.key)).map((s) => ({ ...s, visible: false }))];
};

export const fmtCell = (c, v) => (v === null || v === undefined || v === '' ? null : c.type === 'money' && typeof v === 'number' ? money(v) : c.type === 'enum' ? (c.options.find(([k]) => k === v)?.[1] ?? v) : String(v));
