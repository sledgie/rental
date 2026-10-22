// Minimal in-memory replacement for the Drizzle `db` handle: the seed inserts rows here and the data service reads them back.
import { DEFAULTS } from "./schema";

const store: Record<string, Record<string, unknown>[]> = {};

export const db = {
  insert(table: string) {
    return {
      values(values: Record<string, unknown> | Record<string, unknown>[]) {
        const rows = Array.isArray(values) ? values : [values];
        const defaults = DEFAULTS[table] || {};
        const list = (store[table] ||= []);
        for (const row of rows) {
          const filled: Record<string, unknown> = { ...row };
          for (const [key, value] of Object.entries(defaults)) {
            if (filled[key] === undefined) filled[key] = typeof value === "function" ? (value as () => unknown)() : value;
          }
          list.push(filled);
        }
      },
    };
  },
  update(table: string, id: string, patch: Record<string, unknown>) {
    const row = (store[table] || []).find((r) => r.id === id);
    if (row) Object.assign(row, patch);
  },
  rows(table: string): any[] {
    return (store[table] || []).map((r) => ({ ...r }));
  },
  reset() {
    for (const key of Object.keys(store)) delete store[key];
  },
};
