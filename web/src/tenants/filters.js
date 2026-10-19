// Filter operators per field type and the function that applies filter chips to rows.
import { COL, fmtCell } from './columns.js';

export const OPS = {
  text: [['contains', 'contains'], ['not_contains', "doesn't contain"], ['is', 'is'], ['is_not', 'is not'], ['empty', 'is empty'], ['not_empty', 'is not empty']],
  enum: [['is', 'is'], ['is_not', 'is not'], ['empty', 'is empty'], ['not_empty', 'is not empty']],
  number: [['eq', 'equals'], ['gt', 'greater than'], ['lt', 'less than'], ['between', 'between'], ['empty', 'is empty'], ['not_empty', 'is not empty']],
  date: [['is', 'is'], ['before', 'before'], ['after', 'after'], ['between', 'between'], ['empty', 'is empty'], ['not_empty', 'is not empty']],
};
OPS.money = OPS.number;
export const NO_VALUE = new Set(['empty', 'not_empty']);
export const newFilter = (field) => ({ id: Math.random().toString(36).slice(2), field, op: OPS[COL[field].type][0][0], value: '', value2: '' });
// A chip with a missing value does not filter yet, so adding a chip does not blank the table.
const ready = (f) => NO_VALUE.has(f.op) || (f.value !== '' && (f.op !== 'between' || f.value2 !== ''));

function test(f, row) {
  const c = COL[f.field]; const v = c.value(row);
  const blank = v === null || v === undefined || v === '';
  if (f.op === 'empty') return blank;
  if (f.op === 'not_empty') return !blank;
  if (c.type === 'text' || c.type === 'enum') {
    const a = String(v ?? '').toLowerCase(); const b = String(f.value).toLowerCase();
    if (f.op === 'is') return a === b;
    if (f.op === 'is_not') return a !== b;
    if (f.op === 'contains') return a.includes(b);
    return !a.includes(b); // not_contains
  }
  if (blank) return false;
  const cents = (x) => (c.type === 'money' ? Math.round(Number(x) * 100) : Number(x));
  const [x, lo, hi] = c.type === 'date' ? [v, f.value, f.value2] : [Number(v), cents(f.value), cents(f.value2)];
  switch (f.op) {
    case 'eq': case 'is': return x === lo;
    case 'gt': case 'after': return x > lo;
    case 'lt': case 'before': return x < lo;
    case 'between': return x >= (lo < hi ? lo : hi) && x <= (lo < hi ? hi : lo);
    default: return true;
  }
}
export const applyFilters = (rows, filters) => { const on = filters.filter(ready); return on.length ? rows.filter((r) => on.every((f) => test(f, r))) : rows; };
export const describe = (f) => {
  const c = COL[f.field]; const op = OPS[c.type].find(([k]) => k === f.op)?.[1];
  if (NO_VALUE.has(f.op)) return `${c.label} ${op}`;
  const v = (x) => (c.type === 'enum' ? fmtCell(c, x) : x);
  return `${c.label} ${op} ${v(f.value)}${f.op === 'between' ? ` and ${v(f.value2)}` : ''}`;
};
