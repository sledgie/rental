import { MAX_DEPTH, TYPE_META, type AccountType } from "./taxonomy";
import type { Account, Filters, InsertPosition, TreeNode } from "./types";

export const ROOT_KEY = "__root__";

/* ------------------------------------------------------------------ indexes */

export function byId(accounts: Account[]): Map<string, Account> {
  const m = new Map<string, Account>();
  for (const a of accounts) m.set(a.id, a);
  return m;
}

export const numericCode = (code: string): number => {
  const n = Number.parseInt(code, 10);
  return Number.isNaN(n) ? Number.MAX_SAFE_INTEGER : n;
};

export const compareSiblings = (a: Account, b: Account): number =>
  a.sortOrder - b.sortOrder || numericCode(a.code) - numericCode(b.code) || a.name.localeCompare(b.name);

export function childrenMap(accounts: Account[]): Map<string, Account[]> {
  const m = new Map<string, Account[]>();
  m.set(ROOT_KEY, []);
  for (const a of accounts) {
    const key = a.parentId ?? ROOT_KEY;
    const list = m.get(key);
    if (list) list.push(a);
    else m.set(key, [a]);
  }
  for (const list of m.values()) list.sort(compareSiblings);
  return m;
}

export const childrenOf = (map: Map<string, Account[]>, id: string | null): Account[] =>
  map.get(id ?? ROOT_KEY) ?? [];

export function buildTree(accounts: Account[]): TreeNode[] {
  const map = childrenMap(accounts);
  const walk = (parentId: string | null, depth: number): TreeNode[] =>
    childrenOf(map, parentId).map((account) => ({
      account,
      depth,
      children: walk(account.id, depth + 1),
    }));
  return walk(null, 0);
}

export function descendantIds(accounts: Account[], id: string): Set<string> {
  const map = childrenMap(accounts);
  const out = new Set<string>();
  const stack = [...childrenOf(map, id)];
  while (stack.length) {
    const node = stack.pop()!;
    out.add(node.id);
    stack.push(...childrenOf(map, node.id));
  }
  return out;
}

/** Root → node inclusive. */
export function ancestorChain(accounts: Account[], id: string): Account[] {
  const map = byId(accounts);
  const chain: Account[] = [];
  let cursor = map.get(id);
  let guard = 0;
  while (cursor && guard < 64) {
    chain.unshift(cursor);
    cursor = cursor.parentId ? map.get(cursor.parentId) : undefined;
    guard += 1;
  }
  return chain;
}

export const depthOf = (accounts: Account[], id: string): number =>
  ancestorChain(accounts, id).length - 1;

export function subtreeIds(accounts: Account[], id: string): string[] {
  return [id, ...descendantIds(accounts, id)];
}

export const activeChildren = (accounts: Account[], id: string): Account[] => {
  const map = childrenMap(accounts);
  return childrenOf(map, id).filter((c) => c.status === "Active");
};

export const pathLabel = (accounts: Account[], id: string): string =>
  ancestorChain(accounts, id)
    .map((a) => `${a.code} ${a.name}`)
    .join(" › ");

/* ------------------------------------------------------- immutable mutations */

/** Reassign deterministic 10-step sort orders to a sibling list. */
function renumber(list: Account[]): Account[] {
  return list.map((a, i) => (a.sortOrder === (i + 1) * 10 ? a : { ...a, sortOrder: (i + 1) * 10 }));
}

function resolvePosition(
  accounts: Account[],
  map: Map<string, Account[]>,
  position: InsertPosition,
): { parentId: string | null; index: number } {
  switch (position.kind) {
    case "root":
      return { parentId: null, index: childrenOf(map, null).length };
    case "child":
      return { parentId: position.parentId, index: childrenOf(map, position.parentId).length };
    case "before":
    case "after": {
      const target = accounts.find((a) => a.id === position.siblingId);
      if (!target) return { parentId: null, index: 0 };
      const list = childrenOf(map, target.parentId);
      const at = list.findIndex((a) => a.id === target.id);
      return {
        parentId: target.parentId,
        index: position.kind === "before" ? Math.max(0, at) : at + 1,
      };
    }
  }
}

export function insertAccount(
  accounts: Account[],
  account: Account,
  position: InsertPosition,
): Account[] {
  const map = childrenMap(accounts);
  const { parentId, index } = resolvePosition(accounts, map, position);
  const siblings = [...childrenOf(map, parentId)];
  siblings.splice(Math.max(0, Math.min(index, siblings.length)), 0, { ...account, parentId });
  const next = renumber(siblings);
  const others = accounts.filter((a) => (a.parentId ?? ROOT_KEY) !== (parentId ?? ROOT_KEY));
  return [...others, ...next];
}

export function updateAccount(
  accounts: Account[],
  id: string,
  changes: Partial<Account>,
): Account[] {
  return accounts.map((a) =>
    a.id === id ? { ...a, ...changes, updatedAt: new Date().toISOString() } : a,
  );
}

/**
 * Re-parent and/or reorder an account. Descendants keep their `parentId`, so the
 * whole subtree travels with the moved node and cannot be orphaned.
 */
export function moveAccount(
  accounts: Account[],
  id: string,
  position: InsertPosition,
): Account[] {
  const map = byId(accounts);
  const target = map.get(id);
  if (!target) return accounts;
  const blocked = new Set([id, ...descendantIds(accounts, id)]);
  if (position.kind === "child" && blocked.has(position.parentId)) return accounts;
  if ((position.kind === "before" || position.kind === "after") && blocked.has(position.siblingId))
    return accounts;

  const childMap = childrenMap(accounts);
  const resolved = resolvePosition(accounts, childMap, position);
  if (resolved.parentId !== null && blocked.has(resolved.parentId)) return accounts;

  const fromKey = target.parentId ?? ROOT_KEY;
  const toKey = resolved.parentId ?? ROOT_KEY;

  const source = childrenOf(childMap, fromKey).filter((a) => a.id !== id);
  let destination = fromKey === toKey ? source : [...childrenOf(childMap, toKey)];
  const moved = { ...target, parentId: resolved.parentId };
  const index = Math.max(0, Math.min(resolved.index, destination.length));
  destination.splice(index, 0, moved);
  destination = renumber(destination);

  const touched = new Set<string>([...source.map((a) => a.id), ...destination.map((a) => a.id)]);
  const untouched = accounts.filter((a) => !touched.has(a.id));
  const fromList = fromKey === toKey ? [] : renumber(source);
  return [...untouched, ...fromList, ...destination];
}

export function setStatusMany(
  accounts: Account[],
  ids: string[],
  status: Account["status"],
): Account[] {
  const set = new Set(ids);
  const now = new Date().toISOString();
  return accounts.map((a) => (set.has(a.id) && a.status !== status ? { ...a, status, updatedAt: now } : a));
}

/* --------------------------------------------------------------- code ranges */

export function suggestNextCode(
  accounts: Account[],
  parentId: string | null,
  type: AccountType,
): string | null {
  const [lo, hi] = TYPE_META[type].range;
  const used = new Set(accounts.map((a) => Number.parseInt(a.code, 10)));
  const free = (n: number) => n >= lo && n <= hi && !used.has(n);
  const map = childrenMap(accounts);
  const candidates: number[] = [];

  const siblings = childrenOf(map, parentId).map((a) => Number.parseInt(a.code, 10)).filter((n) => !Number.isNaN(n));
  if (siblings.length) {
    const max = Math.max(...siblings);
    for (let n = max + 1; n <= max + 40 && n <= hi; n += 1) candidates.push(n);
  }
  if (parentId) {
    const pc = Number.parseInt(map.get(parentId)?.[0]?.code ?? byId(accounts).get(parentId)?.code ?? "", 10);
    if (!Number.isNaN(pc)) {
      for (let k = 1; k <= 9; k += 1) candidates.push(pc * 10 + k);
      for (let k = 1; k <= 20; k += 1) candidates.push(pc + k);
    }
  }
  for (let n = Math.ceil(lo / 100) * 100; n <= hi; n += 100) candidates.push(n);
  for (let n = lo; n <= hi; n += 1) candidates.push(n);

  const hit = candidates.find(free);
  return hit === undefined ? null : String(hit);
}

/* -------------------------------------------------------------- search/filter */

export interface FilterResult {
  matched: Set<string> | null;
  visible: Set<string> | null;
  forceOpen: Set<string> | null;
  count: number;
}

export const filtersActive = (f: Filters): boolean =>
  f.query.trim() !== "" || f.type !== "all" || f.role !== "all" || f.status !== "all" || !f.showInactive;

export function filterAccounts(accounts: Account[], filters: Filters): FilterResult {
  if (!filtersActive(filters)) return { matched: null, visible: null, forceOpen: null, count: accounts.length };

  const q = filters.query.trim().toLowerCase();
  const matched = new Set<string>();
  for (const a of accounts) {
    if (!filters.showInactive && a.status === "Inactive") continue;
    if (filters.type !== "all" && a.type !== filters.type) continue;
    if (filters.role !== "all" && a.role !== filters.role) continue;
    if (filters.status !== "all" && a.status !== filters.status) continue;
    if (q && !a.code.toLowerCase().includes(q) && !a.name.toLowerCase().includes(q)) continue;
    matched.add(a.id);
  }

  const visible = new Set<string>(matched);
  const forceOpen = new Set<string>();
  const parents = new Map(accounts.map((a) => [a.id, a.parentId]));
  for (const id of matched) {
    let p = parents.get(id) ?? null;
    let guard = 0;
    while (p && guard < 64) {
      visible.add(p);
      forceOpen.add(p);
      p = parents.get(p) ?? null;
      guard += 1;
    }
  }
  return { matched, visible, forceOpen, count: matched.size };
}

export interface FlatRow {
  account: Account;
  depth: number;
  hasChildren: boolean;
  expanded: boolean;
  isMatch: boolean;
  childCount: number;
}

export function flattenTree(
  accounts: Account[],
  expanded: Record<string, boolean>,
  result: FilterResult,
): FlatRow[] {
  const tree = buildTree(accounts);
  const rows: FlatRow[] = [];
  const walk = (nodes: TreeNode[]) => {
    for (const node of nodes) {
      if (result.visible && !result.visible.has(node.account.id)) continue;
      const hasChildren = node.children.some(
        (c) => !result.visible || result.visible.has(c.account.id),
      );
      const isOpen = result.forceOpen?.has(node.account.id)
        ? true
        : hasChildren
          ? expanded[node.account.id] ?? false
          : false;
      rows.push({
        account: node.account,
        depth: node.depth,
        hasChildren,
        expanded: isOpen,
        isMatch: result.matched ? result.matched.has(node.account.id) : false,
        childCount: node.children.length,
      });
      if (isOpen && hasChildren) walk(node.children);
    }
  };
  walk(tree);
  return rows;
}

export const canExpandDepth = (accounts: Account[], id: string): boolean =>
  depthOf(accounts, id) < MAX_DEPTH - 1;
