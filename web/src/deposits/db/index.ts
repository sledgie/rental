// In-memory stand-in for the Drizzle `db` handle. Same call shapes as the original (select/insert/update/delete/transaction),
// executed lazily when awaited, over a plain object store.
import type { Cond, Table } from "./ops";

const store: Record<string, Record<string, any>[]> = {};
const rowsOf = (table: Table) => (store[table.__name] ||= []);
const clone = <T,>(v: T): T => (v !== null && typeof v === "object" && !(v instanceof Date) ? JSON.parse(JSON.stringify(v)) : v);

function withDefaults(table: Table, row: Record<string, any>) {
  const filled: Record<string, any> = { ...row };
  for (const [key, value] of Object.entries(table.__defaults)) {
    if (filled[key] === undefined) filled[key] = typeof value === "function" ? (value as () => unknown)() : clone(value);
  }
  return filled;
}

const keyOf = (table: Table) => (table.__name === "appMeta" ? "key" : table.__name === "chartOfAccounts" ? "code" : "id");

function thenable<T>(run: () => T) {
  return {
    then<R1 = T, R2 = never>(ok?: ((v: T) => R1 | PromiseLike<R1>) | null, fail?: ((e: unknown) => R2 | PromiseLike<R2>) | null) {
      return new Promise<T>((resolve, reject) => {
        try {
          resolve(run());
        } catch (e) {
          reject(e);
        }
      }).then(ok, fail);
    },
  };
}

function select(projection?: Record<string, { name: string }>) {
  return {
    from(table: Table) {
      const build = (cond?: Cond) => {
        const run = () => {
          const rows = rowsOf(table).filter((r) => !cond || cond(r));
          return rows.map((r) => (projection ? Object.fromEntries(Object.entries(projection).map(([k, c]) => [k, r[c.name]])) : { ...r }));
        };
        return Object.assign(thenable(run), { where: (c: Cond) => build(c) });
      };
      return build();
    },
  };
}

function insert(table: Table) {
  return {
    values(input: Record<string, any> | Record<string, any>[]) {
      let onConflict: "none" | "nothing" | { set: Record<string, any> } = "none";
      const run = () => {
        const list = Array.isArray(input) ? input : [input];
        const rows = rowsOf(table);
        const key = keyOf(table);
        const inserted: Record<string, any>[] = [];
        for (const item of list) {
          const existing = rows.find((r) => r[key] === item[key]);
          if (existing) {
            if (onConflict === "nothing") continue;
            if (typeof onConflict === "object") {
              Object.assign(existing, onConflict.set);
              inserted.push({ ...existing });
              continue;
            }
            throw new Error(`Duplicate ${table.__name} ${String(item[key])}`);
          }
          const row = withDefaults(table, item);
          rows.push(row);
          inserted.push({ ...row });
        }
        return inserted;
      };
      const builder: any = thenable(run);
      builder.onConflictDoNothing = () => {
        onConflict = "nothing";
        return builder;
      };
      builder.onConflictDoUpdate = (opts: { set: Record<string, any> }) => {
        onConflict = { set: opts.set };
        return builder;
      };
      builder.returning = () => builder;
      return builder;
    },
  };
}

function update(table: Table) {
  return {
    set(patch: Record<string, any>) {
      return {
        where(cond: Cond) {
          return thenable(() => {
            for (const r of rowsOf(table)) if (!cond || cond(r)) Object.assign(r, patch);
          });
        },
      };
    },
  };
}

function remove(table: Table) {
  return {
    where(cond: Cond) {
      return thenable(() => {
        store[table.__name] = rowsOf(table).filter((r) => cond && !cond(r));
      });
    },
  };
}

export const db = {
  select,
  insert,
  update,
  delete: remove,
  // No rollback: the original used one transaction per action, and the in-memory store is only a demo.
  transaction: async <T,>(fn: (tx: typeof db) => Promise<T>): Promise<T> => fn(db),
  execute: async (..._args: unknown[]) => undefined,
};
