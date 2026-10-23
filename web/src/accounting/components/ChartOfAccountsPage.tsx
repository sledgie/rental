import { isSupabaseConfigured } from "../../lib/supabase";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useChart } from "../store/chart-store";
import { MAX_DEPTH, TYPE_META } from "../coa/taxonomy";
import { ancestorChain, childrenMap, childrenOf } from "../coa/tree";
import { deactivatePlan, validateMove } from "../coa/validation";
import type { TreeAction } from "../coa/actions";
import type { InsertPosition } from "../coa/types";
import { cn } from "../utils/cn";
import { AccountTree } from "./AccountTree";
import { AccountDetailsPanel } from "./AccountDetailsPanel";
import { AccountForm, type FormRequest } from "./AccountForm";
import { ConfirmationDialog, type ConfirmRequest } from "./ConfirmationDialog";
import { MoveAccountDialog, type MoveRequest } from "./MoveAccountDialog";
import { SearchAndFilterToolbar } from "./SearchAndFilterToolbar";
import { Toasts } from "./Toasts";
import { Note } from "./ui";
import { AccountDrawer } from "./AccountDrawer";
import { AlertTriangle, Check, CloudOff } from "./Icons";
import { Plus, RotateCcw } from "lucide-react";
import { Button as TnButton } from "../../tenants/components/ui";

/* ---------------------------------------------------------- integrity strip */

function IntegrityStrip() {
  const { state } = useChart();
  const checks = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of state.accounts) {
      const k = a.code.trim().toLowerCase();
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    const duplicateCodes = [...counts.values()].filter((n) => n > 1).length;

    const map = childrenMap(state.accounts);
    let postingWithChildren = 0;
    let groupsAcceptingPostings = 0;
    let inactiveWithActiveChildren = 0;
    let tooDeep = 0;
    for (const a of state.accounts) {
      const kids = childrenOf(map, a.id);
      if (a.role === "Posting" && kids.length) postingWithChildren += 1;
      if (a.role === "Group" && a.allowDirectPosting) groupsAcceptingPostings += 1;
      if (a.status === "Inactive" && kids.some((k) => k.status === "Active")) inactiveWithActiveChildren += 1;
      if (ancestorChain(state.accounts, a.id).length > MAX_DEPTH) tooDeep += 1;
    }

    let cycles = 0;
    for (const a of state.accounts) {
      const seen = new Set<string>([a.id]);
      let p = a.parentId;
      while (p) {
        if (seen.has(p)) {
          cycles += 1;
          break;
        }
        seen.add(p);
        p = state.accounts.find((x) => x.id === p)?.parentId ?? null;
      }
    }

    return [
      { label: "Unique codes", bad: duplicateCodes, detail: `${duplicateCodes} duplicate${duplicateCodes === 1 ? "" : "s"}` },
      { label: "No cycles", bad: cycles, detail: `${cycles} circular reference${cycles === 1 ? "" : "s"}` },
      { label: "Group / posting rules", bad: postingWithChildren + groupsAcceptingPostings, detail: `${postingWithChildren} posting with children · ${groupsAcceptingPostings} groups open to journals` },
      { label: "Active branches", bad: inactiveWithActiveChildren, detail: `${inactiveWithActiveChildren} inactive parent${inactiveWithActiveChildren === 1 ? "" : "s"} holding active children` },
      { label: `Depth ≤ ${MAX_DEPTH}`, bad: tooDeep, detail: `${tooDeep} account${tooDeep === 1 ? "" : "s"} beyond the limit` },
    ];
  }, [state.accounts]);

  const failures = checks.filter((c) => c.bad > 0);

  return (
    <div className="flex flex-wrap items-center gap-x-1 gap-y-1.5">
      <span
        className={cn(
          "mr-1 inline-flex items-center gap-1.5 rounded-[5px] border px-2 py-[3px] text-[11px] font-semibold",
          failures.length
            ? "border-u-warn/30 bg-u-warn-soft text-u-warn"
            : "border-u-ok/30 bg-u-ok-soft text-u-ok",
        )}
        title={failures.length ? failures.map((f) => `${f.label}: ${f.detail}`).join(" · ") : "Every structural rule passes"}
      >
        {failures.length ? <AlertTriangle className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" strokeWidth={2.4} />}
        {failures.length ? `${failures.length} integrity issue${failures.length === 1 ? "" : "s"}` : "Chart integrity OK"}
      </span>
      {checks.map((c) => (
        <span
          key={c.label}
          title={c.detail}
          className={cn(
            "inline-flex items-center gap-1 rounded-[5px] border px-1.5 py-[3px] text-[10.5px] tracking-[0.02em]",
            c.bad > 0 ? "border-u-danger/30 bg-u-danger-soft text-u-danger" : "border-u-line bg-u-card text-u-muted",
          )}
        >
          <span className={cn("h-1.5 w-1.5 rounded-full", c.bad > 0 ? "bg-u-danger" : "bg-u-ok")} />
          {c.label}
        </span>
      ))}
    </div>
  );
}

/* --------------------------------------------------------------------- page */

export function ChartOfAccountsPage() {
  const { state, api, dispatch, status } = useChart();
  const [formReq, setFormReq] = useState<FormRequest | null>(null);
  const [moveReq, setMoveReq] = useState<MoveRequest | null>(null);
  const [confirmReq, setConfirmReq] = useState<ConfirmRequest | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const selected = useMemo(
    () => state.accounts.find((a) => a.id === state.selectedId) ?? null,
    [state.accounts, state.selectedId],
  );

  /* "n" opens the create form ("/" focuses search, handled by the search field) */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      const typing = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key.toLowerCase() === "n") {
        e.preventDefault();
        setFormReq({ mode: "create", position: { kind: "root" } });
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const requestMove = useCallback(
    (id: string, position: InsertPosition) => {
      const account = state.accounts.find((a) => a.id === id);
      if (!account) return;
      const parentId =
        position.kind === "child"
          ? position.parentId
          : position.kind === "root"
            ? null
            : state.accounts.find((a) => a.id === position.siblingId)?.parentId ?? null;
      const check = validateMove(state.accounts, id, parentId);
      const dest = parentId ? state.accounts.find((a) => a.id === parentId) : null;
      const where =
        position.kind === "before" || position.kind === "after"
          ? `${position.kind} ${state.accounts.find((a) => a.id === position.siblingId)?.code ?? ""}`
          : position.kind === "child"
            ? `as a child of ${dest?.code ?? ""}`
            : "at the top level";

      setConfirmReq({
        title: `Move ${account.code} ${account.name}?`,
        eyebrow: "Hierarchy change — confirmation required",
        tone: check.ok ? "warning" : "danger",
        body: (
          <div className="space-y-3">
            <p>
              You are about to place <span className="font-medium text-u-ink">{account.code} {account.name}</span>{" "}
              {where}.
            </p>
            <div className="rounded-[7px] border border-u-line bg-u-s2 px-3 py-2.5">
              <p className="mb-1 text-[10.5px] font-semibold uppercase tracking-[0.09em] text-u-muted">
                Destination path
              </p>
              <p className="font-mono text-[12px] text-u-ink2">{check.destinationPath}</p>
            </div>
            {check.errors.length > 0 ? (
              <Note tone="danger" title="Blocked">
                <ul className="list-disc space-y-1 pl-4">
                  {check.errors.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              </Note>
            ) : (
              check.warnings.length > 0 && (
                <Note tone="warning" title="Accounting impact">
                  <ul className="list-disc space-y-1 pl-4">
                    {check.warnings.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                </Note>
              )
            )}
          </div>
        ),
        confirmLabel: "Move account",
        ack: check.ok
          ? "I understand this regroups the account in financial reports and any connected integrations."
          : undefined,
        onConfirm: () => {
          if (!check.ok) return;
          api.moveAccountTo(id, position, { withUndo: true });
        },
      });
    },
    [api, state.accounts],
  );

  const handleAction = useCallback(
    (action: TreeAction) => {
      switch (action.kind) {
        case "view":
          api.reveal(action.id);
          setSheetOpen(true);
          break;
        case "edit":
          api.select(action.id);
          setSheetOpen(false); // the form replaces the View drawer
          setFormReq({ mode: "edit", accountId: action.id });
          break;
        case "create":
          setSheetOpen(false);
          setFormReq({ mode: "create", position: action.position });
          break;
        case "move":
          setSheetOpen(false);
          setMoveReq({ id: action.id });
          break;
        case "toggle":
          api.toggleExpand(action.id);
          break;
        case "setExpanded":
          dispatch({ type: "expanded/set", ids: [action.id], open: action.open });
          break;
        case "reactivate": {
          setSheetOpen(false);
          const account = state.accounts.find((a) => a.id === action.id);
          if (!account) break;
          const parent = account.parentId ? state.accounts.find((a) => a.id === account.parentId) : null;
          if (parent && parent.status === "Inactive") {
            setConfirmReq({
              title: `Reactivate ${account.code}?`,
              eyebrow: "Inactive branch",
              tone: "warning",
              body: (
                <p>
                  Its parent <span className="font-medium text-u-ink">{parent.code} {parent.name}</span> is still
                  inactive, so this account stays hidden from active-only pickers until the branch is reopened.
                </p>
              ),
              confirmLabel: "Reactivate account",
              onConfirm: () => api.setStatus([account.id], "Active"),
            });
          } else {
            api.setStatus([account.id], "Active");
          }
          break;
        }
        case "deactivate": {
          setSheetOpen(false);
          const account = state.accounts.find((a) => a.id === action.id);
          if (!account) break;
          const plan = deactivatePlan(state.accounts, account);
          const cascade = plan.needsCascade ? plan.cascadeIds : [account.id];
          setConfirmReq({
            title: `Deactivate ${account.code} ${account.name}?`,
            eyebrow: "Deactivation workflow",
            tone: "danger",
            body: (
              <div className="space-y-3">
                <p>
                  Deactivated accounts stay in the chart for historical reporting but are removed from posting
                  pickers and stop accepting journal lines.
                </p>
                {plan.messages.length > 0 && (
                  <Note tone={plan.needsCascade ? "danger" : "warning"} title="Dependencies found">
                    <ul className="list-disc space-y-1 pl-4">
                      {plan.messages.map((m) => (
                        <li key={m}>{m}</li>
                      ))}
                    </ul>
                  </Note>
                )}
                {plan.activeDescendants.length > 0 && (
                  <div className="rounded-[7px] border border-u-line bg-u-s2 px-3 py-2">
                    <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.09em] text-u-muted">
                      Branch that will be deactivated ({cascade.length})
                    </p>
                    <ul className="grid gap-1 sm:grid-cols-2">
                      {cascade.slice(0, 8).map((id) => {
                        const a = state.accounts.find((x) => x.id === id)!;
                        return (
                          <li key={id} className="flex items-baseline gap-1.5 text-[12px] text-u-ink2">
                            <span className="font-mono text-[11.5px] text-u-muted tabular">{a.code}</span>
                            <span className="truncate">{a.name}</span>
                          </li>
                        );
                      })}
                      {cascade.length > 8 && (
                        <li className="text-[12px] text-u-muted">+{cascade.length - 8} more…</li>
                      )}
                    </ul>
                  </div>
                )}
                {plan.messages.length === 0 && (
                  <p className="text-[12.5px] text-u-muted">
                    No active children and no open sub-ledger references — this account can be deactivated safely
                    and reactivated later.
                  </p>
                )}
              </div>
            ),
            confirmLabel:
              cascade.length > 1 ? `Deactivate ${cascade.length} accounts` : "Deactivate account",
            ack:
              plan.needsCascade || plan.hasReferences
                ? `I understand ${cascade.length} account${cascade.length === 1 ? "" : "s"} will stop accepting postings, and that historical entries remain unchanged.`
                : undefined,
            onConfirm: () =>
              api.setStatus(
                cascade,
                "Inactive",
                `${account.code} ${account.name}${cascade.length > 1 ? ` + ${cascade.length - 1} descendant${cascade.length - 1 === 1 ? "" : "s"}` : ""}`,
              ),
          });
          break;
        }
        default:
          break;
      }
    },
    [api, dispatch, state.accounts],
  );

  const requestReset = () =>
    setConfirmReq({
      title: "Restore the sample chart?",
      eyebrow: "Demo data",
      tone: "warning",
      body: (
        <p>
          Every account you created, edited, moved or deactivated in this session will be discarded and the
          original {state.accounts.length}-account sample chart reloaded. Nothing was ever written to a database.
        </p>
      ),
      confirmLabel: "Reset demo data",
      onConfirm: api.resetDemo,
    });

  if (isSupabaseConfigured && (!status.ready || status.error)) {
    return (
      <div className="tn">
        <div className="app-shell">
          <div className="main-shell">
            <main className="main-content">
              <div className="empty-state">
                <h3>{status.error ? "We couldn't load your chart of accounts" : "Loading chart of accounts…"}</h3>
                <p>{status.error ?? "Fetching your accounts."}</p>
              </div>
            </main>
          </div>
        </div>
      </div>
    );
  }

  const topLevelCount = state.accounts.filter((a) => a.parentId === null).length;
  const groupCount = state.accounts.filter((a) => a.role === "Group").length;

  return (
    <div className="tn">
      <div className="app-shell">
        <div className="main-shell">
          <main className="main-content">
            <div className="page-heading">
              <div>
                <div className="page-title-line">
                  <h1>Chart of Accounts</h1>
                  <span className="muted">{state.accounts.length} accounts · {topLevelCount} root · {groupCount} groups</span>
                </div>
                <p>
                  Expand the hierarchy, insert an account at any level, and manage posting rules without leaving the tree. Codes follow
                  the 1000–8999 convention: {Object.values(TYPE_META).map((m) => m.rangeLabel).join(" · ")}.
                </p>
              </div>
              <div className="page-heading-actions">
                {!isSupabaseConfigured && (
                  <TnButton onClick={requestReset} title="Discard in-session changes and reload the sample chart">
                    <RotateCcw size={15} />
                    Reset demo data
                  </TnButton>
                )}
                <TnButton variant="primary" onClick={() => setFormReq({ mode: "create", position: { kind: "root" } })}>
                  <Plus size={17} />
                  New account
                </TnButton>
              </div>
            </div>

            <div className="u-root">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
                <IntegrityStrip />
                <span className="inline-flex items-center gap-1.5 rounded-[6px] border border-dashed border-u-line bg-u-s2 px-2 py-1 text-[11px] text-u-muted">
                  <CloudOff className="h-3.5 w-3.5" />
                  Demo data · session only · nothing persisted
                </span>
              </div>
            </div>

            <section className="directory-panel" aria-label="Chart of accounts">
              <SearchAndFilterToolbar />
              <div className="u-root border-t border-u-line">
                <div className="h-[calc(100vh-24rem)] min-h-[480px]">
                  <AccountTree onAction={handleAction} onRequestMove={requestMove} />
                </div>
              </div>
            </section>

            <div className="u-root">
              <p className="mt-3 max-w-[110ch] text-[11.5px] leading-relaxed text-u-muted">
                Sample records are illustrative only and are not a claim of compliance with any accounting standard, trust-accounting
                rule or provincial regulation. Account <span className="font-mono">id</span> values are stable surrogate keys; codes are
                never used as identifiers, so they can be renumbered safely.
              </p>
            </div>
          </main>
        </div>
      </div>

      {sheetOpen && selected && (
        <AccountDrawer
          title="Account details"
          subtitle={`${selected.code} · ${selected.name}`}
          onClose={() => setSheetOpen(false)}
        >
          <AccountDetailsPanel variant="sheet" onAction={handleAction} query={state.filters.query} />
        </AccountDrawer>
      )}

      <div className="u-root">
        <AccountForm request={formReq} onClose={() => setFormReq(null)} />
        <MoveAccountDialog request={moveReq} onClose={() => setMoveReq(null)} />
        <ConfirmationDialog request={confirmReq} onClose={() => setConfirmReq(null)} />
        <Toasts />
      </div>
    </div>
  );
}
