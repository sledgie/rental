import { useMemo } from "react";
import { useChart } from "../store/chart-store";
import {
  CLASSIFICATIONS,
  MAX_DEPTH,
  ROLE_META,
  TYPE_META,
  formatDate,
  formatDateTime,
  money,
} from "../coa/taxonomy";
import { ancestorChain, childrenOf, childrenMap, descendantIds } from "../coa/tree";
import type { TreeAction } from "../coa/actions";
import { cn } from "../utils/cn";
import { Badge, Button, Highlight, IconButton, StatusPill } from "./ui";
import {
  ArrowLeft,
  Ban,
  ChildPlus,
  ChevronRight,
  CornerDownRight,
  Eye,
  InsertAfter,
  InsertBefore,
  Ledger,
  MoveIcon,
  Pencil,
  Power,
} from "./Icons";

interface Props {
  onAction: (action: TreeAction) => void;
  variant?: "panel" | "sheet";
  onBack?: () => void;
  query?: string;
}

function Meta({
  label,
  children,
  delay,
}: {
  label: string;
  children: React.ReactNode;
  delay: number;
}) {
  return (
    <div
      className="border-t border-u-line py-2.5 animate-coa-fade-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      <dt className="mb-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-u-muted">{label}</dt>
      <dd className="text-[12.5px] leading-snug text-u-ink2">{children}</dd>
    </div>
  );
}

export function AccountDetailsPanel({ onAction, variant = "panel", onBack, query = "" }: Props) {
  const { state, api } = useChart();
  const account = useMemo(
    () => state.accounts.find((a) => a.id === state.selectedId) ?? null,
    [state.accounts, state.selectedId],
  );
  const childMap = useMemo(() => childrenMap(state.accounts), [state.accounts]);

  if (!account) {
    return (
      <aside
        className={cn(
          "flex h-full min-h-[320px] flex-col items-center justify-center gap-3 rounded-[10px] border border-dashed border-u-line bg-u-s2 px-6 py-16 text-center",
          variant === "sheet" && "border-0",
        )}
      >
        <span className="flex h-11 w-11 items-center justify-center rounded-full border border-u-line bg-u-card text-u-muted">
          <Ledger className="h-5 w-5" />
        </span>
        <div>
          <p className="text-[14px] font-semibold text-u-ink">No account selected</p>
          <p className="mx-auto mt-1 max-w-[34ch] text-[12.5px] leading-relaxed text-u-muted">
            Choose a row in the tree to inspect its type, normal balance, posting eligibility and children.
          </p>
        </div>
      </aside>
    );
  }

  const meta = TYPE_META[account.type];
  const chain = ancestorChain(state.accounts, account.id);
  const parent = account.parentId ? state.accounts.find((a) => a.id === account.parentId) ?? null : null;
  const kids = childrenOf(childMap, account.id);
  const siblings = childrenOf(childMap, account.parentId);
  const sibIndex = siblings.findIndex((s) => s.id === account.id);
  const depth = chain.length - 1;
  const descendants = descendantIds(state.accounts, account.id);
  const activeKids = kids.filter((k) => k.status === "Active");
  const canHaveChildren = account.role === "Group" && account.status === "Active" && depth < MAX_DEPTH - 1;
  const inactive = account.status === "Inactive";
  const openItems = [...descendants].reduce(
    (sum, id) => sum + (state.accounts.find((a) => a.id === id)?.openItems ?? 0),
    0,
  );
  const rollup = [...descendants].reduce((sum, id) => {
    const a = state.accounts.find((x) => x.id === id);
    if (!a || a.role !== "Posting") return sum;
    return sum + (a.openingBalance ?? 0) * (a.normalBalance === "Debit" ? 1 : -1);
  }, 0);

  const goParent = (id: string) => {
    api.reveal(id);
    onBack?.();
  };

  return (
    <aside
      key={account.id}
      aria-label={`Details for ${account.code} ${account.name}`}
      className={cn(
        "flex h-full min-h-0 flex-col overflow-hidden rounded-[10px] border border-u-line bg-u-card shadow-[0_1px_2px_rgba(20,24,26,.04)]",
        variant === "sheet" && "rounded-none border-0 shadow-none",
      )}
    >
      {/* header */}
      <header className="border-b border-u-line bg-gradient-to-b from-u-s2 to-u-card px-4 py-3.5">
        <nav aria-label="Account breadcrumb" className="mb-2 flex flex-wrap items-center gap-x-1 gap-y-1 text-[11.5px] text-u-muted">
          {variant === "sheet" && onBack && (
            <button
              type="button"
              onClick={onBack}
              className="mr-1 inline-flex items-center gap-1 rounded-[5px] border border-u-line bg-u-card px-1.5 py-0.5 text-[11.5px] font-medium text-u-ink2 transition-colors hover:border-u-accent hover:text-u-accent lg:hidden"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Tree
            </button>
          )}
          <span className="uppercase tracking-[0.08em]">Chart of Accounts</span>
          {chain.map((node) => (
            <span key={node.id} className="flex items-center gap-1">
              <ChevronRight className="h-3 w-3 opacity-60" />
              {node.id === account.id ? (
                <span className="font-medium text-u-ink2">
                  <Highlight text={node.code} query={query} />
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => goParent(node.id)}
                  className="rounded-[3px] transition-colors hover:text-u-accent hover:underline"
                >
                  {node.code} {node.name}
                </button>
              )}
            </span>
          ))}
        </nav>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <span className="font-mono text-[19px] leading-none font-semibold text-u-accent tabular">
                <Highlight text={account.code} query={query} />
              </span>
              <StatusPill status={account.status} />
            </div>
            <h2 className="mt-1.5 text-[19px] leading-tight font-semibold tracking-[-0.015em] text-u-ink">
              <Highlight text={account.name} query={query} />
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <Badge className={meta.chip} dot={meta.dot}>
                {meta.label}
              </Badge>
              <Badge className={ROLE_META[account.role].chip}>{ROLE_META[account.role].label}</Badge>
              {account.classification && (
                <Badge className="border-u-line bg-u-s3 text-u-ink2">{account.classification}</Badge>
              )}
              <Badge
                className={cn(
                  account.allowDirectPosting
                    ? "border-u-ok/30 bg-u-ok-soft text-u-ok"
                    : "border-u-line bg-u-s3 text-u-muted",
                )}
              >
                {account.allowDirectPosting ? "Direct posting" : "No direct posting"}
              </Badge>
            </div>
          </div>
        </div>

        <div className="mt-3.5 flex flex-wrap gap-1.5">
          <Button variant="primary" size="sm" onClick={() => onAction({ kind: "edit", id: account.id })}>
            <Pencil className="h-3.5 w-3.5" /> Edit account
          </Button>
          {canHaveChildren && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                onAction({ kind: "create", position: { kind: "child", parentId: account.id } })
              }
            >
              <ChildPlus className="h-3.5 w-3.5" /> Add child
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={() => onAction({ kind: "move", id: account.id })}>
            <MoveIcon className="h-3.5 w-3.5" /> Move
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              onAction({ kind: "create", position: { kind: "before", siblingId: account.id } })
            }
            title="Insert a sibling account before this one"
            className="hidden sm:inline-flex"
          >
            <InsertBefore className="h-3.5 w-3.5" /> Before
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onAction({ kind: "create", position: { kind: "after", siblingId: account.id } })}
            title="Insert a sibling account after this one"
            className="hidden sm:inline-flex"
          >
            <InsertAfter className="h-3.5 w-3.5" /> After
          </Button>
          {inactive ? (
            <Button variant="secondary" size="sm" onClick={() => onAction({ kind: "reactivate", id: account.id })}>
              <Power className="h-3.5 w-3.5" /> Reactivate
            </Button>
          ) : (
            <Button variant="secondary" size="sm" onClick={() => onAction({ kind: "deactivate", id: account.id })}>
              <Ban className="h-3.5 w-3.5" /> Deactivate
            </Button>
          )}
        </div>
      </header>

      {/* body */}
      <div className="min-h-0 flex-1 overflow-y-auto coa-scroll">
        <div className="grid grid-cols-2 gap-x-5 px-4 pt-1 pb-3">
          <Meta label="Account type" delay={0}>
            <span className="font-medium text-u-ink">{meta.label}</span>
            <span className="ml-1.5 text-u-muted">({meta.rangeLabel})</span>
          </Meta>
          <Meta label="Classification" delay={30}>
            {account.classification ?? <span className="text-u-muted">Not set</span>}
            {account.classification && !CLASSIFICATIONS[account.type].includes(account.classification) && (
              <span className="ml-1 text-u-warn">· outside {account.type} list</span>
            )}
          </Meta>
          <Meta label="Normal balance" delay={60}>
            <span className="font-medium text-u-ink">{account.normalBalance}</span>
            {account.normalBalance !== meta.normalBalance && (
              <span className="ml-1 text-u-warn">· differs from {meta.normalBalance} default</span>
            )}
          </Meta>
          <Meta label="Posting eligibility" delay={90}>
            {account.role === "Group" ? (
              <span>
                Group account — accepts no journal lines; rolls up{" "}
                <span className="font-medium text-u-ink">{kids.length}</span> child
                {kids.length === 1 ? "" : "ren"}.
              </span>
            ) : account.allowDirectPosting ? (
              <span>Posting account — journal lines may be posted directly.</span>
            ) : (
              <span className="text-u-warn">Posting account, but direct posting is disabled.</span>
            )}
          </Meta>
          <Meta label="Parent account" delay={120}>
            {parent ? (
              <button
                type="button"
                onClick={() => goParent(parent.id)}
                className="group inline-flex items-center gap-1.5 rounded-[5px] border border-u-line bg-u-s2 px-1.5 py-0.5 font-mono text-[11.5px] text-u-ink2 transition-colors hover:border-u-accent hover:text-u-accent"
              >
                {parent.code}
                <span className="font-sans">{parent.name}</span>
                <Eye className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-70" />
              </button>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-u-ink2">
                <CornerDownRight className="h-3.5 w-3.5 text-u-muted" /> Top level of the chart
              </span>
            )}
          </Meta>
          <Meta label="Hierarchy position" delay={150}>
            Level {depth + 1}
            {parent ? ` of ${MAX_DEPTH}` : ""} · sibling {sibIndex + 1} of {siblings.length}
          </Meta>
          <Meta label="Tax code" delay={180}>
            {account.taxCode ? (
              <span className="font-mono text-[12px] font-medium text-u-ink">{account.taxCode}</span>
            ) : (
              <span className="text-u-muted">Not applicable</span>
            )}
          </Meta>
          <Meta label="Opening balance" delay={210}>
            <span className="font-mono tabular">{money(account.openingBalance)}</span>
            {account.role === "Group" && (
              <span className="ml-1.5 text-u-muted">
                (roll-up <span className="font-mono tabular">{money(rollup)}</span>)
              </span>
            )}
          </Meta>
          <Meta label="Status" delay={240}>
            <StatusPill status={account.status} />
            {inactive && <span className="ml-1.5 text-u-muted">Closed to new postings</span>}
          </Meta>
          <Meta label="Sub-ledger references" delay={270}>
            {openItems > 0 ? (
              <span className="text-u-ink2">
                <span className="font-mono font-semibold tabular">{openItems}</span> open item
                {openItems === 1 ? "" : "s"} across this branch
              </span>
            ) : (
              <span className="text-u-muted">None — safe to deactivate</span>
            )}
          </Meta>
        </div>

        {account.description && (
          <div className="mx-4 mb-4 rounded-[7px] border border-u-line bg-u-s2 px-3 py-2.5 animate-coa-fade-up" style={{ animationDelay: "240ms" }}>
            <p className="mb-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-u-muted">Description</p>
            <p className="text-[12.5px] leading-relaxed text-u-ink2">{account.description}</p>
          </div>
        )}

        {/* children */}
        <div className="border-t border-u-line px-4 py-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.09em] text-u-muted">
              Child accounts
              <span className="ml-1.5 font-mono text-u-ink2 tabular">{kids.length}</span>
            </h3>
            {canHaveChildren && (
              <IconButton
                label="Add child account"
                onClick={() =>
                  onAction({ kind: "create", position: { kind: "child", parentId: account.id } })
                }
              >
                <ChildPlus className="h-4 w-4" />
              </IconButton>
            )}
          </div>

          {kids.length === 0 ? (
            <p className="rounded-[6px] border border-dashed border-u-line px-3 py-3 text-[12px] text-u-muted">
              {account.role === "Group"
                ? "This group has no children yet. Add one to start building the branch."
                : "Posting accounts are leaves — they cannot hold child accounts."}
            </p>
          ) : (
            <ul className="space-y-1">
              {kids.map((kid, i) => (
                <li key={kid.id} className="animate-coa-fade-up" style={{ animationDelay: `${i * 35}ms` }}>
                  <button
                    type="button"
                    onClick={() => goParent(kid.id)}
                    className="group flex w-full items-center gap-2.5 rounded-[6px] border border-u-line bg-u-card px-2.5 py-1.5 text-left transition-all duration-150 hover:border-u-accent/40 hover:bg-u-accent-soft/40"
                  >
                    <span className="font-mono text-[12px] font-medium text-u-ink2 tabular group-hover:text-u-accent">
                      {kid.code}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[12.5px] text-u-ink2 group-hover:text-u-ink">
                      {kid.name}
                    </span>
                    {kid.status === "Inactive" && <StatusPill status="Inactive" />}
                    <span
                      className={cn(
                        "hidden rounded-[4px] border px-1.5 py-[1px] text-[10px] font-semibold uppercase tracking-[0.05em] sm:inline-flex",
                        ROLE_META[kid.role].chip,
                      )}
                    >
                      {kid.role}
                    </span>
                    <ChevronRight className="h-3.5 w-3.5 text-u-muted transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-u-accent" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {activeKids.length > 0 && inactive && (
            <p className="mt-2 text-[11.5px] text-u-warn">
              {activeKids.length} active child account{activeKids.length === 1 ? "" : "s"} remain under this
              inactive parent — reactivate the parent or deactivate the branch.
            </p>
          )}
        </div>

        {/* audit */}
        <div className="border-t border-u-line bg-u-s2 px-4 py-3 text-[11.5px] text-u-muted">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span>
              Created <span className="text-u-ink2">{formatDateTime(account.createdAt)}</span>
            </span>
            <span>
              Updated <span className="text-u-ink2">{formatDate(account.updatedAt)}</span>
            </span>
            <span className="font-mono">
              id <span className="text-u-ink2">{account.id}</span>
            </span>
          </div>
          <p className="mt-2 leading-relaxed">
            YTD activity (mock): <span className="font-mono text-u-ink2 tabular">{money(account.ytdAmount)}</span>. Session
            data only — nothing is persisted to a database.
          </p>
        </div>
      </div>
    </aside>
  );
}
