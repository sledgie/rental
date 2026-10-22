import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { useChart } from "../store/chart-store";
import { MAX_DEPTH } from "../coa/taxonomy";
import {
  ancestorChain,
  byId,
  childrenMap,
  childrenOf,
  descendantIds,
  filtersActive,
} from "../coa/tree";
import { validateMove } from "../coa/validation";
import type { TreeAction } from "../coa/actions";
import type { Account, InsertPosition } from "../coa/types";
import { cn } from "../utils/cn";
import { AccountTreeRow, type DropZone, type RowDragState } from "./AccountTreeRow";
import { AccountContextMenu, type MenuRequest } from "./AccountContextMenu";
import { Button, Highlight, IconButton, Note } from "./ui";
import { CornerDownRight, Keyboard, Search } from "./Icons";

const NO_DRAG: RowDragState = { draggingId: null, targetId: null, zone: null, valid: true };

export function AccountTree({
  onAction,
  onRequestMove,
}: {
  onAction: (action: TreeAction) => void;
  onRequestMove: (id: string, position: InsertPosition) => void;
}) {
  const { state, api, rows, result } = useChart();
  const [menu, setMenu] = useState<MenuRequest | null>(null);
  const [drag, setDrag] = useState<RowDragState>(NO_DRAG);
  const [rootDrop, setRootDrop] = useState(false);
  const [focusedId, setFocusedId] = useState<string | null>(state.selectedId);
  const rowRefs = useRef(new Map<string, HTMLDivElement>());
  const scrollRef = useRef<HTMLDivElement>(null);

  const map = useMemo(() => byId(state.accounts), [state.accounts]);
  const childMap = useMemo(() => childrenMap(state.accounts), [state.accounts]);

  useEffect(() => {
    if (state.selectedId) setFocusedId(state.selectedId);
  }, [state.selectedId]);

  useEffect(() => {
    if (focusedId && !rows.some((r) => r.account.id === focusedId)) {
      setFocusedId(rows[0]?.account.id ?? null);
    }
  }, [rows, focusedId]);

  const focusRow = useCallback((id: string | null, select = true) => {
    if (!id) return;
    setFocusedId(id);
    if (select) api.select(id);
    const el = rowRefs.current.get(id);
    el?.scrollIntoView({ block: "nearest" });
    el?.focus({ preventScroll: true });
  }, [api]);

  const select = (id: string) => {
    api.select(id);
    setFocusedId(id);
    rowRefs.current.get(id)?.focus({ preventScroll: true });
  };

  /* ------------------------------------------------------------ keyboard nav */
  const onTreeKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!rows.length) return;
    const index = Math.max(0, rows.findIndex((r) => r.account.id === focusedId));
    const row = rows[index];
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        focusRow(rows[Math.min(rows.length - 1, index + 1)]?.account.id ?? null);
        break;
      case "ArrowUp":
        e.preventDefault();
        focusRow(rows[Math.max(0, index - 1)]?.account.id ?? null);
        break;
      case "Home":
        e.preventDefault();
        focusRow(rows[0].account.id);
        break;
      case "End":
        e.preventDefault();
        focusRow(rows[rows.length - 1].account.id);
        break;
      case "ArrowRight": {
        e.preventDefault();
        if (!row) break;
        if (row.hasChildren && !row.expanded) api.toggleExpand(row.account.id);
        else if (row.hasChildren) focusRow(rows[index + 1]?.account.id ?? null);
        break;
      }
      case "ArrowLeft": {
        e.preventDefault();
        if (!row) break;
        if (row.hasChildren && row.expanded) api.toggleExpand(row.account.id);
        else if (row.account.parentId) focusRow(row.account.parentId);
        break;
      }
      default:
        break;
    }
  };

  /* ------------------------------------------------------------- drag & drop */
  const subtreeDepth = (id: string): number => {
    let max = 0;
    const walk = (nodeId: string, d: number) => {
      max = Math.max(max, d);
      for (const c of childrenOf(childMap, nodeId)) walk(c.id, d + 1);
    };
    walk(id, 0);
    return max;
  };

  const zoneFor = (e: DragEvent<HTMLDivElement>): DropZone => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientY - rect.top) / rect.height;
    if (ratio < 0.3) return "before";
    if (ratio > 0.7) return "after";
    return "child";
  };

  const resolveDrop = (dragId: string, target: Account, zone: DropZone) => {
    const dragged = map.get(dragId);
    if (!dragged) return null;
    const canAcceptChild =
      target.role === "Group" &&
      target.status === "Active" &&
      target.type === dragged.type &&
      target.id !== dragId &&
      !descendantIds(state.accounts, dragId).has(target.id) &&
      ancestorChain(state.accounts, target.id).length + subtreeDepth(dragId) < MAX_DEPTH;

    const effectiveZone: DropZone = zone === "child" && !canAcceptChild ? "after" : zone;
    const newParentId = effectiveZone === "child" ? target.id : target.parentId;
    const position: InsertPosition =
      effectiveZone === "child"
        ? { kind: "child", parentId: target.id }
        : effectiveZone === "before"
          ? { kind: "before", siblingId: target.id }
          : { kind: "after", siblingId: target.id };
    const check = validateMove(state.accounts, dragId, newParentId);
    return { zone: effectiveZone, position, newParentId, valid: check.ok, errors: check.errors };
  };

  const onDragStart = (e: DragEvent<HTMLDivElement>, account: Account) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", account.id);
    setDrag({ draggingId: account.id, targetId: null, zone: null, valid: true });
    select(account.id);
  };

  const onDragOverRow = (e: DragEvent<HTMLDivElement>, target: Account) => {
    const dragId = drag.draggingId ?? e.dataTransfer.getData("text/plain");
    if (!dragId || dragId === target.id) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const resolved = resolveDrop(dragId, target, zoneFor(e));
    if (!resolved) return;
    setDrag((prev) =>
      prev.targetId === target.id && prev.zone === resolved.zone && prev.valid === resolved.valid
        ? prev
        : { draggingId: dragId, targetId: target.id, zone: resolved.zone, valid: resolved.valid },
    );
  };

  const onDropRow = (e: DragEvent<HTMLDivElement>, target: Account) => {
    e.preventDefault();
    const dragId = drag.draggingId ?? e.dataTransfer.getData("text/plain");
    setDrag(NO_DRAG);
    if (!dragId || dragId === target.id) return;
    const resolved = resolveDrop(dragId, target, zoneFor(e));
    if (!resolved) return;
    if (!resolved.valid) {
      api.notify({
        kind: "error",
        title: "Move blocked",
        message: resolved.errors[0] ?? "That destination is not valid for this account.",
      });
      return;
    }
    const dragged = map.get(dragId)!;
    if (dragged.parentId !== resolved.newParentId) onRequestMove(dragId, resolved.position);
    else api.moveAccountTo(dragId, resolved.position, { withUndo: true });
  };

  const onRootDragOver = (e: DragEvent<HTMLDivElement>) => {
    if (!drag.draggingId) return;
    e.preventDefault();
    setRootDrop(true);
  };
  const onRootDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setRootDrop(false);
    const dragId = drag.draggingId;
    setDrag(NO_DRAG);
    if (!dragId) return;
    const dragged = map.get(dragId);
    if (!dragged) return;
    const check = validateMove(state.accounts, dragId, null);
    if (!check.ok) {
      api.notify({ kind: "error", title: "Move blocked", message: check.errors[0] });
      return;
    }
    if (dragged.parentId !== null) onRequestMove(dragId, { kind: "root" });
    else api.moveAccountTo(dragId, { kind: "root" }, { withUndo: true });
  };

  /* ------------------------------------------------------------------ render */
  const filtering = filtersActive(state.filters);
  const total = state.accounts.length;
  const shown = filtering ? result.count : total;
  const activeCount = state.accounts.filter((a) => a.status === "Active").length;

  return (
    <section
      aria-label="Account tree"
      className="flex h-full min-h-0 flex-col overflow-hidden bg-u-card"
    >
      <header className="flex items-center justify-between gap-3 border-b border-u-line bg-u-s2 px-3 py-2">
        <div className="flex items-baseline gap-2 min-w-0">
          <h2 className="text-[13px] font-semibold tracking-[-0.01em] text-u-ink">
            Account hierarchy
          </h2>
          <span className="truncate text-[11.5px] text-u-muted tabular">
            {filtering ? (
              <>
                <strong className="font-semibold text-u-ink2">{shown}</strong> match{shown === 1 ? "" : "es"} of{" "}
                {total}
              </>
            ) : (
              <>
                {total} accounts · {activeCount} active
              </>
            )}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <IconButton
            label="Expand all groups"
            onClick={api.expandAll}
            className="hidden sm:inline-flex"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m7 9 5-5 5 5M7 15l5 5 5-5" />
            </svg>
          </IconButton>
          <IconButton label="Collapse all groups" onClick={api.collapseAll} className="hidden sm:inline-flex">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m7 4 5 5 5-5M7 20l5-5 5 5" />
            </svg>
          </IconButton>
        </div>
      </header>

      {/* column header */}
      <div className="flex items-center gap-2 border-b border-u-line bg-u-card px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.09em] text-u-muted">
        <span className="w-5" />
        <span className="w-[58px] sm:w-[64px]">Code</span>
        <span className="flex-1">
          Account name <span className="hidden font-normal normal-case tracking-normal text-u-muted/80 lg:inline">· type, role and status</span>
        </span>
        <span className="w-[84px] text-right">Actions</span>
      </div>

      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto coa-scroll"
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setDrag(NO_DRAG);
        }}
      >
        {rows.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-16 text-center animate-coa-fade-up">
            <span className="flex h-12 w-12 items-center justify-center rounded-full border border-u-line bg-u-s3 text-u-muted">
              <Search className="h-5 w-5" />
            </span>
            <div>
              <p className="text-[14px] font-semibold text-u-ink">No accounts match</p>
              <p className="mt-1 max-w-[38ch] text-[12.5px] leading-relaxed text-u-muted">
                {state.filters.query
                  ? <>Nothing matches “<span className="font-medium text-u-ink2">{state.filters.query}</span>” with the current filters.</>
                  : "The current filter combination excludes every account in the chart."}
              </p>
            </div>
            <Button variant="secondary" size="sm" onClick={api.clearFilters}>
              Clear search and filters
            </Button>
          </div>
        ) : (
          <div
            role="tree"
            aria-label="Chart of accounts tree"
            aria-multiselectable={false}
            onKeyDown={onTreeKeyDown}
            className="py-0.5"
          >
            {rows.map((row) => (
              <AccountTreeRow
                key={row.account.id}
                row={row}
                query={state.filters.query}
                selected={state.selectedId === row.account.id}
                focused={focusedId === row.account.id}
                contextOnly={!!result.matched && !row.isMatch}
                drag={drag}
                onToggle={api.toggleExpand}
                onSelect={select}
                onOpenMenu={(account, x, y) => setMenu({ accountId: account.id, x, y })}
                onAction={onAction}
                onDragStart={onDragStart}
                onDragOverRow={onDragOverRow}
                onDropRow={onDropRow}
                onDragEnd={() => setDrag(NO_DRAG)}
                registerRef={(id, el) => {
                  if (el) rowRefs.current.set(id, el);
                  else rowRefs.current.delete(id);
                }}
              />
            ))}

            <div
              onDragOver={onRootDragOver}
              onDragLeave={() => setRootDrop(false)}
              onDrop={onRootDrop}
              className={cn(
                "mx-2 my-2 flex items-center justify-center gap-2 rounded-[7px] border border-dashed px-3 py-2.5 text-[12px] transition-all duration-150",
                drag.draggingId
                  ? rootDrop
                    ? "border-u-accent bg-u-accent-soft text-u-accent"
                    : "border-u-line bg-u-s3 text-u-muted"
                  : "hidden",
              )}
            >
              <CornerDownRight className="h-3.5 w-3.5" />
              Release to place at the top level of the chart
            </div>
          </div>
        )}
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 border-t border-u-line bg-u-s2 px-3 py-2 text-[11px] text-u-muted">
        <span className="flex items-center gap-1.5">
          <Keyboard className="h-3.5 w-3.5" />
          <kbd className="rounded-[3px] border border-u-line bg-u-card px-1 font-mono text-[10px] text-u-ink2">↑↓</kbd>
          navigate
          <kbd className="ml-1 rounded-[3px] border border-u-line bg-u-card px-1 font-mono text-[10px] text-u-ink2">←→</kbd>
          collapse / expand
          <kbd className="ml-1 hidden rounded-[3px] border border-u-line bg-u-card px-1 font-mono text-[10px] text-u-ink2 sm:inline">⇧F10</kbd>
          <span className="hidden sm:inline">row menu</span>
          <kbd className="ml-1 hidden rounded-[3px] border border-u-line bg-u-card px-1 font-mono text-[10px] text-u-ink2 lg:inline">N</kbd>
          <span className="hidden lg:inline">new account</span>
          <kbd className="ml-1 hidden rounded-[3px] border border-u-line bg-u-card px-1 font-mono text-[10px] text-u-ink2 lg:inline">/</kbd>
          <span className="hidden lg:inline">search</span>
        </span>
        <span className="hidden items-center gap-1.5 md:flex">
          Drag a row onto another to re-parent or reorder
          {filtering && (
            <em className="not-italic text-u-warn">
              · filtered view — order still resolves against the full chart
            </em>
          )}
        </span>
      </footer>

      {filtering && rows.length > 0 && (
        <div className="border-t border-u-line bg-u-s2 px-3 py-2">
          <Note tone="info">
            Parent accounts are kept so the path to each match stays visible.{" "}
            <Highlight text={`${shown} account${shown === 1 ? "" : "s"}`} query={state.filters.query} />{" "}
            matched directly — the hierarchy itself is untouched.
          </Note>
        </div>
      )}

      <AccountContextMenu request={menu} onClose={() => setMenu(null)} onAction={onAction} />
    </section>
  );
}
