import { CLASSIFICATIONS, MAX_DEPTH, TYPE_META, type AccountType } from "./taxonomy";
import {
  activeChildren,
  ancestorChain,
  byId,
  childrenOf,
  childrenMap,
  descendantIds,
  subtreeIds,
} from "./tree";
import type { Account, AccountDraft, FieldErrors } from "./types";

export type Warnings = FieldErrors;

export interface ValidationResult {
  errors: FieldErrors;
  warnings: Warnings;
}

export interface ValidateContext {
  accounts: Account[];
  /** id of the account being edited, or null when creating. */
  editingId: string | null;
  /** parent id the account had when editing started — unchanged parents are grandfathered. */
  originalParentId?: string | null;
}

const CODE_RE = /^\d{3,6}$/;

export function validateDraft(draft: AccountDraft, ctx: ValidateContext): ValidationResult {
  const errors: FieldErrors = {};
  const warnings: Warnings = {};
  const map = byId(ctx.accounts);
  const code = draft.code.trim();
  const name = draft.name.trim();

  /* code */
  if (!code) errors.code = "Account code is required.";
  else if (!CODE_RE.test(code)) errors.code = "Use 3–6 digits, e.g. 4120.";
  else {
    const clash = ctx.accounts.find(
      (a) => a.code.toLowerCase() === code.toLowerCase() && a.id !== ctx.editingId,
    );
    if (clash) errors.code = `Code ${clash.code} is already used by “${clash.name}”. Codes must be unique.`;
    const [lo, hi] = TYPE_META[draft.type].range;
    const n = Number.parseInt(code, 10);
    if (!Number.isNaN(n) && (n < lo || n > hi)) {
      warnings.code = `Outside the conventional ${draft.type} range (${TYPE_META[draft.type].rangeLabel}). Allowed, but it will sort away from its peers.`;
    }
  }

  /* name */
  if (!name) errors.name = "Account name is required.";
  else if (name.length > 80) errors.name = "Keep the name to 80 characters or fewer.";
  else {
    const twin = ctx.accounts.find(
      (a) =>
        a.id !== ctx.editingId &&
        (a.parentId ?? null) === draft.parentId &&
        a.name.trim().toLowerCase() === name.toLowerCase(),
    );
    if (twin) errors.name = `“${twin.name}” (${twin.code}) already exists at this level.`;
  }

  /* parent / hierarchy */
  if (draft.parentId) {
    const parent = map.get(draft.parentId);
    if (!parent) errors.parentId = "The selected parent account no longer exists.";
    else {
      const unchanged = ctx.editingId !== null && ctx.originalParentId === draft.parentId;
      if (parent.role !== "Group") {
        errors.parentId = `${parent.code} ${parent.name} is a posting account. Posting accounts cannot hold children — convert it to a group account first.`;
      } else if (parent.status !== "Active" && !unchanged) {
        errors.parentId = `${parent.code} ${parent.name} is inactive and cannot accept new children.`;
      } else if (parent.type !== draft.type) {
        errors.parentId = `Account type must match the parent’s category. ${parent.code} is a ${parent.type} account, so the child must also be ${parent.type}.`;
      } else if (ctx.editingId && parent.id === ctx.editingId) {
        errors.parentId = "An account cannot be its own parent.";
      } else if (ctx.editingId && descendantIds(ctx.accounts, ctx.editingId).has(parent.id)) {
        errors.parentId = "Circular reference: an account cannot be moved beneath one of its own descendants.";
      } else if (depthBelow(ctx.accounts, draft.parentId) + 1 >= MAX_DEPTH) {
        errors.parentId = `Maximum nesting depth of ${MAX_DEPTH} levels reached.`;
      }
    }
  }

  /* role + posting rules */
  if (draft.role === "Group" && draft.allowDirectPosting) {
    errors.role = "Group accounts roll up their children and cannot accept direct postings.";
  }
  if (draft.role === "Posting" && ctx.editingId) {
    const kids = childrenOf(childrenMap(ctx.accounts), ctx.editingId);
    if (kids.length) {
      errors.role = `This account has ${kids.length} child account${kids.length === 1 ? "" : "s"} (${kids
        .slice(0, 3)
        .map((k) => k.code)
        .join(", ")}${kids.length > 3 ? "…" : ""}). Move them elsewhere or keep this account as a group before making it a posting account.`;
    }
  }
  if (draft.role === "Group" && draft.openingBalance !== null && draft.openingBalance !== 0) {
    errors.openingBalance = "Group accounts roll up their children — remove the opening balance.";
  }

  /* classification */
  if (draft.classification && !CLASSIFICATIONS[draft.type].includes(draft.classification)) {
    errors.classification = `“${draft.classification}” is not a valid ${draft.type} classification.`;
  }

  /* normal balance */
  if (draft.normalBalance !== TYPE_META[draft.type].normalBalance) {
    warnings.normalBalance = `${draft.type} accounts normally carry a ${TYPE_META[draft.type].normalBalance} balance. Saved as ${draft.normalBalance}.`;
  }

  /* status */
  if (draft.status === "Inactive" && ctx.editingId) {
    const kids = activeChildren(ctx.accounts, ctx.editingId);
    if (kids.length) {
      errors.status = `${kids.length} active child account${kids.length === 1 ? "" : "s"} would be orphaned under an inactive parent. Use “Deactivate account” from the row menu to cascade, or deactivate the children first.`;
    }
  }

  return { errors, warnings };
}

const depthBelow = (accounts: Account[], id: string | null): number => {
  if (!id) return -1;
  const map = childrenMap(accounts);
  let max = 0;
  const walk = (nodeId: string, d: number) => {
    max = Math.max(max, d);
    for (const c of childrenOf(map, nodeId)) walk(c.id, d + 1);
  };
  walk(id, 0);
  return max;
};

/** Why a candidate cannot be the parent — `null` means it is a valid choice. */
export function parentBlockReason(
  candidate: Account,
  opts: { accounts: Account[]; type: AccountType; editingId: string | null; subtreeDepth?: number },
): string | null {
  if (opts.editingId && candidate.id === opts.editingId) return "Cannot be its own parent";
  if (opts.editingId && descendantIds(opts.accounts, opts.editingId).has(candidate.id))
    return "Descendant of this account";
  if (candidate.role !== "Group") return "Posting account — no children";
  if (candidate.status !== "Active") return "Inactive";
  if (candidate.type !== opts.type) return `Type is ${candidate.type}`;
  const depth = ancestorChain(opts.accounts, candidate.id).length - 1;
  if (depth + 1 + (opts.subtreeDepth ?? 0) >= MAX_DEPTH) return `Exceeds ${MAX_DEPTH}-level depth`;
  return null;
}

export interface MoveCheck {
  ok: boolean;
  errors: string[];
  warnings: string[];
  destinationPath: string;
  descendants: number;
}

export function validateMove(
  accounts: Account[],
  id: string,
  newParentId: string | null,
): MoveCheck {
  const map = byId(accounts);
  const account = map.get(id);
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!account) return { ok: false, errors: ["Account not found."], warnings, destinationPath: "", descendants: 0 };

  const descendants = descendantIds(accounts, id).size;
  const parent = newParentId ? map.get(newParentId) : null;
  const currentParent = account.parentId;

  if (newParentId === currentParent) {
    warnings.push("This is the account’s current parent — only the sibling order will change.");
  }
  if (parent) {
    if (parent.id === id) errors.push("An account cannot be moved beneath itself.");
    else if (descendantIds(accounts, id).has(parent.id))
      errors.push("Circular reference: the destination is one of this account’s own descendants.");
    else if (parent.role !== "Group")
      errors.push(`${parent.code} ${parent.name} is a posting account and cannot hold children.`);
    else if (parent.status !== "Active")
      errors.push(`${parent.code} ${parent.name} is inactive and cannot accept children.`);
    else if (parent.type !== account.type)
      errors.push(
        `Type conflict: ${account.code} is a ${account.type} account and ${parent.code} is a ${parent.type} account. Change the account type first, or choose a ${account.type} destination.`,
      );
    else {
      const depth = ancestorChain(accounts, parent.id).length; // parent depth + 1
      const subtree = depthBelow(accounts, id);
      if (depth + subtree >= MAX_DEPTH)
        errors.push(`This move would push the subtree past the ${MAX_DEPTH}-level depth limit.`);
    }
  }
  if (parent && descendants > 0) {
    warnings.push(
      `${descendants} descendant account${descendants === 1 ? "" : "s"} travel with this account and will be re-grouped in every report.`,
    );
  }
  if (parent && parent.id !== currentParent) {
    warnings.push(
      "Balance-sheet and income-statement groupings, trial-balance exports and any connected integrations key off this hierarchy. Review reports after committing.",
    );
  }

  const chain = parent ? ancestorChain(accounts, parent.id) : [];
  const destinationPath = chain.length
    ? [...chain, account].map((a) => `${a.code} ${a.name}`).join(" › ")
    : `${account.code} ${account.name} (top level)`;

  return { ok: errors.length === 0, errors, warnings, destinationPath, descendants };
}

export interface DeactivatePlan {
  activeDescendants: Account[];
  cascadeIds: string[];
  needsCascade: boolean;
  hasReferences: boolean;
  openItems: number;
  messages: string[];
}

export function deactivatePlan(accounts: Account[], account: Account): DeactivatePlan {
  const ids = subtreeIds(accounts, account.id).filter((x) => x !== account.id);
  const map = byId(accounts);
  const activeDescendants = ids.filter((i) => map.get(i)?.status === "Active").map((i) => map.get(i)!);
  const openItems = ids.reduce((sum, i) => sum + (map.get(i)?.openItems ?? 0), 0) + account.openItems;
  const messages: string[] = [];
  if (activeDescendants.length)
    messages.push(
      `${activeDescendants.length} active descendant account${activeDescendants.length === 1 ? "" : "s"} sit under ${account.code}. Deactivating the parent alone would leave them orphaned, so the whole branch must be deactivated together.`,
    );
  if (openItems > 0)
    messages.push(
      `This branch carries ${openItems} open sub-ledger reference${openItems === 1 ? "" : "s"} (unpaid invoices, tenant ledgers, journals). Historical entries stay intact, but the accounts stop accepting new postings.`,
    );
  return {
    activeDescendants,
    cascadeIds: [account.id, ...ids],
    needsCascade: activeDescendants.length > 0,
    hasReferences: openItems > 0,
    openItems,
    messages,
  };
}

export const typeSummary = (accounts: Account[]) =>
  (Object.keys(TYPE_META) as AccountType[]).map((type) => {
    const list = accounts.filter((a) => a.type === type);
    return {
      type,
      total: list.length,
      active: list.filter((a) => a.status === "Active").length,
      posting: list.filter((a) => a.role === "Posting").length,
      balance: list
        .filter((a) => a.role === "Posting")
        .reduce((sum, a) => sum + (a.openingBalance ?? 0) * (a.normalBalance === "Debit" ? 1 : -1), 0),
    };
  });
