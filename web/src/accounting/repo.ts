// Supabase access for the Chart of Accounts (table `accounts`, view `v_trial_balance`). The page edits one list of accounts and replaces it
// as a whole after every action, so persistence is a diff between the old and the new list. The database enforces the tree rules
// (parents must be group accounts, no cycles, at most 8 levels) and the unique account codes.
import { supabase, toError } from "../lib/supabase";
import { getActiveOrgId } from "../lib/activeOrg";
import type { Account } from "./coa/types";
import type { AccountType } from "./coa/taxonomy";

/* eslint-disable @typescript-eslint/no-explicit-any -- rows come from untyped PostgREST responses */

const TYPE_FROM_DB: Record<string, AccountType> = {
  asset: "Asset", liability: "Liability", equity: "Equity", revenue: "Revenue", operating_cost: "Operating Cost",
  administrative_expense: "Administrative Expense", other_income: "Other Income", other_expense: "Other Expense",
};
const TYPE_TO_DB = Object.fromEntries(Object.entries(TYPE_FROM_DB).map(([slug, label]) => [label, slug])) as Record<AccountType, string>;

const PAGE = 1000; // PostgREST returns at most this many rows per request

async function fetchAll(table: string, columns: string, orgId: string, order: string): Promise<any[]> {
  const rows: any[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from(table).select(columns).eq("organization_id", orgId).order(order).range(from, from + PAGE - 1);
    if (error) throw toError(error, "Unable to load the chart of accounts.");
    rows.push(...(data ?? []));
    if ((data ?? []).length < PAGE) return rows;
  }
}

export async function loadAccounts(orgId: string): Promise<Account[]> {
  const [accounts, balances] = await Promise.all([
    fetchAll("accounts", "*", orgId, "sort_order"),
    supabase.from("v_trial_balance").select("account_id, net_debit").eq("organization_id", orgId),
  ]);
  // posted activity per account (the trial balance may be hidden by Row-Level Security: then no activity is shown)
  const net = new Map((balances.data ?? []).map((b: any) => [b.account_id, Number(b.net_debit)]));
  return accounts.map((r: any): Account => {
    const debitNormal = r.normal_balance === "debit";
    const balance = net.get(r.id) ?? 0;
    return {
      id: r.id,
      code: r.code,
      name: r.name,
      parentId: r.parent_id ?? null,
      type: TYPE_FROM_DB[r.account_type] ?? "Asset",
      classification: r.classification ?? null,
      normalBalance: debitNormal ? "Debit" : "Credit",
      role: r.role === "group" ? "Group" : "Posting",
      allowDirectPosting: r.allow_direct_posting,
      status: r.status === "active" ? "Active" : "Inactive",
      description: r.description ?? "",
      taxCode: r.tax_code ?? null,
      openingBalance: r.opening_balance === null ? null : Number(r.opening_balance),
      sortOrder: r.sort_order,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      openItems: 0, // the database decides what blocks a change; see the error message it returns
      ytdAmount: debitNormal ? balance : -balance,
    };
  });
}

const row = (a: Account) => ({
  code: a.code,
  name: a.name,
  parent_id: a.parentId,
  account_type: TYPE_TO_DB[a.type],
  classification: a.classification,
  normal_balance: a.normalBalance === "Debit" ? "debit" : "credit",
  role: a.role === "Group" ? "group" : "posting",
  allow_direct_posting: a.role === "Group" ? false : a.allowDirectPosting,
  status: a.status === "Active" ? "active" : "inactive",
  description: a.description || null,
  tax_code: a.taxCode,
  opening_balance: a.role === "Group" ? null : a.openingBalance,
  sort_order: a.sortOrder,
});

function friendly(error: { code?: string; message?: string }, fallback: string): Error {
  if (error.code === "23505") return new Error("An account with this code already exists.");
  if (error.code === "42501" || error.code === "23514" || error.code === "23503") return new Error(error.message || fallback);
  return toError(error, fallback);
}

/** Writes the difference between two versions of the chart: new accounts (parents first), then every account that changed. */
export async function persist(prev: Account[], next: Account[]): Promise<void> {
  const orgId = getActiveOrgId();
  if (!orgId) throw new Error("Select an organization first.");
  const before = new Map(prev.map((a) => [a.id, a]));
  const nextById = new Map(next.map((a) => [a.id, a]));
  const same = (a: Account, b: Account) => JSON.stringify(row(a)) === JSON.stringify(row(b));

  const depth = (a: Account): number => {
    let d = 0;
    for (let cur: Account | undefined = a; cur?.parentId && d < 20; cur = nextById.get(cur.parentId)) d += 1;
    return d;
  };
  const added = next.filter((a) => !before.has(a.id)).sort((a, b) => depth(a) - depth(b));
  for (const a of added) {
    const { error } = await supabase.from("accounts").insert({ id: a.id, organization_id: orgId, ...row(a) });
    if (error) throw friendly(error, "Unable to save the account.");
  }
  // an account moved under a new group must be written after that group has its own final values
  const changed = next.filter((a) => before.has(a.id) && !same(before.get(a.id)!, a)).sort((a, b) => depth(a) - depth(b));
  for (const a of changed) {
    const res = await supabase.from("accounts").update(row(a)).eq("id", a.id).select("id");
    if (res.error) throw friendly(res.error, "Unable to save the account.");
    if (!res.data?.length) throw new Error("You don't have permission to edit the chart of accounts.");
  }
}
