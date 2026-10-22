import type { AccountType } from "./taxonomy";

export type AccountRole = "Group" | "Posting";
export type AccountStatus = "Active" | "Inactive";
export type NormalBalance = "Debit" | "Credit";

/**
 * Canonical account record. `id` is a stable surrogate key — account codes are
 * *not* identifiers because they may legitimately change over time.
 */
export interface Account {
  id: string;
  code: string;
  name: string;
  parentId: string | null;
  type: AccountType;
  classification: string | null;
  normalBalance: NormalBalance;
  role: AccountRole;
  allowDirectPosting: boolean;
  status: AccountStatus;
  description: string;
  taxCode: string | null;
  openingBalance: number | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  /** Mock sub-ledger references (open AR/AP items, journals) — drives deactivation guards. */
  openItems: number;
  /** Mock year-to-date activity, used only for display. */
  ytdAmount: number;
}

/** Everything the form owns; `id`/timestamps/sortOrder are assigned by the store. */
export interface AccountDraft {
  code: string;
  name: string;
  parentId: string | null;
  type: AccountType;
  classification: string | null;
  normalBalance: NormalBalance;
  role: AccountRole;
  allowDirectPosting: boolean;
  status: AccountStatus;
  description: string;
  taxCode: string | null;
  openingBalance: number | null;
}

export interface TreeNode {
  account: Account;
  children: TreeNode[];
  depth: number;
}

/** Where a newly created account should land in its sibling list. */
export type InsertPosition =
  | { kind: "root" }
  | { kind: "child"; parentId: string }
  | { kind: "before"; siblingId: string }
  | { kind: "after"; siblingId: string };

export interface Filters {
  query: string;
  type: AccountType | "all";
  role: AccountRole | "all";
  status: AccountStatus | "all";
  showInactive: boolean;
}

export type FieldErrors = Partial<Record<keyof AccountDraft | "form", string>>;

export interface ToastAction {
  label: string;
  run: () => void;
}

export interface Toast {
  id: string;
  kind: "success" | "error" | "info" | "warning";
  title: string;
  message?: string;
  action?: ToastAction;
}
