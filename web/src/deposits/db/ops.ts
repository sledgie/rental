// Tiny in-memory replacement for the pieces of drizzle-orm the module used: table definitions and the eq/and/isNotNull operators.
export type Column = { table: string; name: string };
export type Table = { __name: string; __defaults: Record<string, unknown>; [column: string]: any };
export type Cond = ((row: Record<string, any>) => boolean) | undefined;

export function defineTable(name: string, columns: string[], defaults: Record<string, unknown>): Table {
  const table: Table = { __name: name, __defaults: defaults };
  for (const col of columns) table[col] = { table: name, name: col } as Column;
  return table;
}

export const eq = (col: Column, value: unknown): Cond => (row) => row[col.name] === value;
export const isNotNull = (col: Column): Cond => (row) => row[col.name] != null;
export const and =
  (...conds: Cond[]): Cond =>
  (row) =>
    conds.every((c) => !c || c(row));

export const sql = (..._args: unknown[]) => undefined;
