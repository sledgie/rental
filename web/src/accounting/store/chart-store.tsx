import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
  type Dispatch,
  type ReactNode,
} from "react";
import { isSupabaseConfigured } from "../../lib/supabase";
import { getActiveOrgId, subscribeActiveOrg } from "../../lib/activeOrg";
import * as repo from "../repo";
import { buildSeedChart } from "../coa/seed";
import {
  ancestorChain,
  buildTree,
  childrenMap,
  childrenOf,
  filterAccounts,
  flattenTree,
  insertAccount,
  moveAccount as moveAccountPure,
  setStatusMany,
  updateAccount,
  type FilterResult,
  type FlatRow,
} from "../coa/tree";
import type { Account, AccountDraft, Filters, InsertPosition, Toast } from "../coa/types";

export interface ChartState {
  accounts: Account[];
  expanded: Record<string, boolean>;
  selectedId: string | null;
  filters: Filters;
  toasts: Toast[];
}

export const DEFAULT_FILTERS: Filters = {
  query: "",
  type: "all",
  role: "all",
  status: "all",
  showInactive: true,
};

const newId = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? isSupabaseConfigured
      ? crypto.randomUUID() // the id becomes the row's primary key
      : `acct_${crypto.randomUUID().slice(0, 8)}`
    : `acct_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

/** Codes whose branches start open, so the first paint shows real hierarchy. */
const INITIALLY_OPEN = ["1102", "4110"];

function initialState(): ChartState {
  // with Supabase the chart is loaded for the active organization; nothing from the sample chart is shown
  const accounts = isSupabaseConfigured ? [] : buildSeedChart();
  const expanded: Record<string, boolean> = {};
  for (const node of buildTree(accounts)) expanded[node.account.id] = true;
  for (const code of INITIALLY_OPEN) {
    const account = accounts.find((a) => a.code === code);
    if (!account) continue;
    for (const ancestor of ancestorChain(accounts, account.id)) expanded[ancestor.id] = true;
  }
  const selected = accounts.find((a) => a.code === "1102") ?? accounts[0] ?? null;
  return {
    accounts,
    expanded,
    selectedId: selected?.id ?? null,
    filters: { ...DEFAULT_FILTERS },
    toasts: [],
  };
}

type Action =
  | { type: "accounts/set"; accounts: Account[] }
  | { type: "expanded/toggle"; id: string }
  | { type: "expanded/set"; ids: string[]; open: boolean }
  | { type: "select"; id: string | null }
  | { type: "filters/set"; patch: Partial<Filters> }
  | { type: "filters/clear" }
  | { type: "toast/add"; toast: Toast }
  | { type: "toast/remove"; id: string }
  | { type: "reset" };

function reducer(state: ChartState, action: Action): ChartState {
  switch (action.type) {
    case "accounts/set":
      return { ...state, accounts: action.accounts };
    case "expanded/toggle":
      return { ...state, expanded: { ...state.expanded, [action.id]: !state.expanded[action.id] } };
    case "expanded/set": {
      const expanded = { ...state.expanded };
      for (const id of action.ids) expanded[id] = action.open;
      return { ...state, expanded };
    }
    case "select":
      return { ...state, selectedId: action.id };
    case "filters/set":
      return { ...state, filters: { ...state.filters, ...action.patch } };
    case "filters/clear":
      return { ...state, filters: { ...DEFAULT_FILTERS } };
    case "toast/add":
      return { ...state, toasts: [...state.toasts.slice(-3), action.toast] };
    case "toast/remove":
      return { ...state, toasts: state.toasts.filter((t) => t.id !== action.id) };
    case "reset":
      return initialState();
    default:
      return state;
  }
}

export interface ChartApi {
  toggleExpand: (id: string) => void;
  expandAll: () => void;
  collapseAll: () => void;
  select: (id: string | null) => void;
  /** Expand every ancestor of `id`, then select it. */
  reveal: (id: string | null) => void;
  setFilter: (patch: Partial<Filters>) => void;
  clearFilters: () => void;
  createAccount: (draft: AccountDraft, position: InsertPosition) => Account;
  saveAccount: (id: string, draft: AccountDraft) => void;
  moveAccountTo: (id: string, position: InsertPosition, opts?: { silent?: boolean; withUndo?: boolean }) => void;
  setStatus: (ids: string[], status: Account["status"], label?: string) => void;
  resetDemo: () => void;
  notify: (toast: Omit<Toast, "id">) => void;
  dismissToast: (id: string) => void;
}

export interface ChartContextValue {
  /** false while the chart is loading from Supabase */
  status: { ready: boolean; error: string | null };
  state: ChartState;
  dispatch: Dispatch<Action>;
  api: ChartApi;
  result: FilterResult;
  rows: FlatRow[];
}

const ChartContext = createContext<ChartContextValue | null>(null);

const ancestorIdsOf = (accounts: Account[], id: string | null): string[] =>
  id ? ancestorChain(accounts, id).slice(0, -1).map((a) => a.id) : [];

const draftToAccount = (draft: AccountDraft, parentId: string | null): Account => {
  const now = new Date().toISOString();
  return {
    id: newId(),
    code: draft.code.trim(),
    name: draft.name.trim(),
    parentId,
    type: draft.type,
    classification: draft.classification,
    normalBalance: draft.normalBalance,
    role: draft.role,
    allowDirectPosting: draft.role === "Group" ? false : draft.allowDirectPosting,
    status: draft.status,
    description: draft.description.trim(),
    taxCode: draft.taxCode,
    openingBalance: draft.role === "Group" ? null : draft.openingBalance,
    sortOrder: 0,
    createdAt: now,
    updatedAt: now,
    openItems: 0,
    ytdAmount: draft.openingBalance ?? 0,
  };
};

export function ChartProvider({ children }: { children: ReactNode }) {
  const [state, rawDispatch] = useReducer(reducer, undefined, initialState);
  const stateRef = useRef(state);
  const [status, setStatus] = useState({ ready: !isSupabaseConfigured, error: null as string | null });
  const orgId = useSyncExternalStore(subscribeActiveOrg, getActiveOrgId);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const generation = useRef(0); // bumped by every load: saves queued before it are stale and must not run

  /** Reads the chart for the active organization (the database is the source of truth). */
  const load = useCallback(async () => {
    const org = getActiveOrgId();
    if (!org) return;
    generation.current += 1;
    try {
      const accounts = await repo.loadAccounts(org);
      if (getActiveOrgId() !== org) return; // the user switched organization meanwhile
      stateRef.current = { ...stateRef.current, accounts };
      rawDispatch({ type: "accounts/set", accounts });
      const parents = new Set(accounts.map((a) => a.parentId).filter(Boolean) as string[]);
      rawDispatch({ type: "expanded/set", ids: [...parents], open: true });
      if (!stateRef.current.selectedId || !accounts.some((a) => a.id === stateRef.current.selectedId)) {
        rawDispatch({ type: "select", id: accounts[0]?.id ?? null });
      }
      setStatus({ ready: true, error: null });
    } catch (error) {
      if (getActiveOrgId() === org) setStatus({ ready: true, error: error instanceof Error ? error.message : "Unable to load the chart of accounts." });
    }
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    setStatus({ ready: false, error: null });
    if (orgId) void load();
  }, [orgId, load]);

  /** Every change goes through here; with Supabase a new list of accounts is also written to the database. */
  const dispatch = useCallback<Dispatch<Action>>(
    (action) => {
      if (isSupabaseConfigured && action.type === "accounts/set") {
        const prev = stateRef.current.accounts;
        const gen = generation.current;
        queue.current = queue.current.then(async () => {
          if (gen !== generation.current) return;
          try {
            await repo.persist(prev, action.accounts);
          } catch (error) {
            rawDispatch({ type: "toast/add", toast: { id: newId(), kind: "error", title: "The change was not saved", message: error instanceof Error ? error.message : "Please try again." } });
            await load(); // show what the database really holds
          }
        });
      }
      stateRef.current = reducer(stateRef.current, action);
      rawDispatch(action);
    },
    [load],
  );

  const api = useMemo<ChartApi>(() => {
    const notify = (toast: Omit<Toast, "id">) =>
      dispatch({ type: "toast/add", toast: { ...toast, id: newId() } });

    const parentForPosition = (accounts: Account[], position: InsertPosition): string | null => {
      if (position.kind === "child") return position.parentId;
      if (position.kind === "root") return null;
      return accounts.find((a) => a.id === position.siblingId)?.parentId ?? null;
    };

    return {
      toggleExpand: (id) => dispatch({ type: "expanded/toggle", id }),

      expandAll: () => {
        const map = childrenMap(state.accounts);
        const ids: string[] = [];
        const walk = (parentId: string | null) => {
          for (const a of childrenOf(map, parentId)) {
            if (childrenOf(map, a.id).length) {
              ids.push(a.id);
              walk(a.id);
            }
          }
        };
        walk(null);
        dispatch({ type: "expanded/set", ids, open: true });
      },

      collapseAll: () => {
        const map = childrenMap(state.accounts);
        const ids: string[] = [];
        const walk = (parentId: string | null) => {
          for (const a of childrenOf(map, parentId)) {
            ids.push(a.id);
            walk(a.id);
          }
        };
        walk(null);
        dispatch({ type: "expanded/set", ids, open: false });
      },

      select: (id) => dispatch({ type: "select", id }),

      reveal: (id) => {
        if (!id) {
          dispatch({ type: "select", id: null });
          return;
        }
        const ids = ancestorIdsOf(state.accounts, id);
        if (ids.length) dispatch({ type: "expanded/set", ids, open: true });
        dispatch({ type: "select", id });
      },

      setFilter: (patch) => dispatch({ type: "filters/set", patch }),
      clearFilters: () => dispatch({ type: "filters/clear" }),

      createAccount: (draft, position) => {
        const parentId = parentForPosition(state.accounts, position);
        const account = draftToAccount(draft, parentId);
        const next = insertAccount(state.accounts, account, position);
        dispatch({ type: "accounts/set", accounts: next });

        const open = [...ancestorIdsOf(next, account.id), ...(account.parentId ? [account.parentId] : [])];
        if (open.length) dispatch({ type: "expanded/set", ids: open, open: true });
        dispatch({ type: "select", id: account.id });

        const parent = account.parentId ? next.find((a) => a.id === account.parentId) : null;
        notify({
          kind: "success",
          title: `Account ${account.code} created`,
          message: parent
            ? `Inserted at level ${ancestorChain(next, account.id).length}, under ${parent.code} ${parent.name}.`
            : "Inserted at the top level of the chart.",
        });
        return account;
      },

      saveAccount: (id, draft) => {
        const current = state.accounts.find((a) => a.id === id);
        if (!current) return;
        const changes: Partial<Account> = {
          code: draft.code.trim(),
          name: draft.name.trim(),
          type: draft.type,
          classification: draft.classification,
          normalBalance: draft.normalBalance,
          role: draft.role,
          allowDirectPosting: draft.role === "Group" ? false : draft.allowDirectPosting,
          status: draft.status,
          description: draft.description.trim(),
          taxCode: draft.taxCode,
          openingBalance: draft.role === "Group" ? null : draft.openingBalance,
        };
        let next = updateAccount(state.accounts, id, changes);

        // Hierarchy changes only when the user explicitly picks a different parent.
        if (draft.parentId !== current.parentId) {
          next = moveAccountPure(
            next,
            id,
            draft.parentId ? { kind: "child", parentId: draft.parentId } : { kind: "root" },
          );
        }

        dispatch({ type: "accounts/set", accounts: next });
        const open = ancestorIdsOf(next, id);
        if (open.length) dispatch({ type: "expanded/set", ids: open, open: true });
        dispatch({ type: "select", id });
        notify({
          kind: "success",
          title: `Account ${draft.code.trim()} saved`,
          message:
            draft.parentId !== current.parentId
              ? `${draft.name.trim()} was updated and re-parented as requested.`
              : `${draft.name.trim()} was updated. The hierarchy is unchanged.`,
        });
      },

      moveAccountTo: (id, position, opts) => {
        const account = state.accounts.find((a) => a.id === id);
        if (!account) return;
        const previous = state.accounts;
        const next = moveAccountPure(previous, id, position);
        if (next === previous) {
          notify({
            kind: "error",
            title: "Move blocked",
            message: "That destination would create a circular reference or break type rules.",
          });
          return;
        }
        dispatch({ type: "accounts/set", accounts: next });
        const moved = next.find((a) => a.id === id)!;
        const open = ancestorIdsOf(next, id);
        if (open.length) dispatch({ type: "expanded/set", ids: open, open: true });
        dispatch({ type: "select", id });

        if (opts?.silent) return;
        const destParent = moved.parentId ? next.find((a) => a.id === moved.parentId) : null;
        notify({
          kind: "success",
          title: `Account ${moved.code} moved`,
          message: destParent
            ? `Now under ${destParent.code} ${destParent.name}.`
            : "Now a top-level account.",
          action: opts?.withUndo
            ? {
                label: "Undo",
                run: () => {
                  dispatch({ type: "accounts/set", accounts: previous });
                  dispatch({ type: "select", id });
                  notify({
                    kind: "info",
                    title: "Move reverted",
                    message: `${account.code} ${account.name} is back in its original position.`,
                  });
                },
              }
            : undefined,
        });
      },

      setStatus: (ids, status, label) => {
        const next = setStatusMany(state.accounts, ids, status);
        dispatch({ type: "accounts/set", accounts: next });
        const changed = next.filter((a) => ids.includes(a.id));
        notify({
          kind: status === "Inactive" ? "warning" : "success",
          title:
            status === "Inactive"
              ? `${changed.length} account${changed.length === 1 ? "" : "s"} deactivated`
              : `${changed.length} account${changed.length === 1 ? "" : "s"} reactivated`,
          message: label ?? (changed.length === 1 ? `${changed[0].code} · ${changed[0].name}` : undefined),
        });
      },

      resetDemo: () => {
        if (isSupabaseConfigured) {
          void load();
          return;
        }
        dispatch({ type: "reset" });
        notify({
          kind: "info",
          title: "Demo chart restored",
          message: "In-session changes were discarded. Nothing is stored outside this browser tab.",
        });
      },

      notify,
      dismissToast: (id) => dispatch({ type: "toast/remove", id }),
    };
  }, [state.accounts, dispatch, load]);

  const result = useMemo(
    () => filterAccounts(state.accounts, state.filters),
    [state.accounts, state.filters],
  );
  const rows = useMemo(
    () => flattenTree(state.accounts, state.expanded, result),
    [state.accounts, state.expanded, result],
  );

  const value = useMemo<ChartContextValue>(
    () => ({ status, state, dispatch, api, result, rows }),
    [status, state, dispatch, api, result, rows],
  );

  return <ChartContext.Provider value={value}>{children}</ChartContext.Provider>;
}

export function useChart(): ChartContextValue {
  const ctx = useContext(ChartContext);
  if (!ctx) throw new Error("useChart must be used inside <ChartProvider>");
  return ctx;
}
