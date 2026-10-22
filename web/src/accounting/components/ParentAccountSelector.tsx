import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { TOP_LEVEL_LABEL, TYPE_META, type AccountType } from "../coa/taxonomy";
import { ancestorChain, buildTree, descendantIds } from "../coa/tree";
import { parentBlockReason } from "../coa/validation";
import type { Account, TreeNode } from "../coa/types";
import { cn } from "../utils/cn";
import { Check, ChevronRight, CornerDownRight, Search, X } from "./Icons";

interface OptionRow {
  account: Account | null; // null = the top-level pseudo option
  depth: number;
  valid: boolean;
  reason: string | null;
  hasChildren: boolean;
  expanded: boolean;
}

interface Props {
  value: string | null;
  type: AccountType;
  editingId: string | null;
  accounts: Account[];
  onChange: (id: string | null) => void;
  invalid?: boolean;
  id?: string;
}

export function ParentAccountSelector({
  value,
  type,
  editingId,
  accounts,
  onChange,
  invalid,
  id,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [active, setActive] = useState(0);
  const [openIds, setOpenIds] = useState<Record<string, boolean>>({});
  const [rect, setRect] = useState<{ top: number; left: number; width: number; maxH: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selected = value ? accounts.find((a) => a.id === value) ?? null : null;
  const selectedPath = selected ? ancestorChain(accounts, selected.id) : [];
  const subtreeDepth = useMemo(() => {
    if (!editingId) return 0;
    const blocked = descendantIds(accounts, editingId);
    let max = 0;
    const walk = (nodeId: string, d: number) => {
      max = Math.max(max, d);
      for (const a of accounts) if (a.parentId === nodeId) walk(a.id, d + 1);
    };
    walk(editingId, 0);
    return blocked.size ? max : 0;
  }, [accounts, editingId]);

  const isCandidateValid = (a: Account) =>
    parentBlockReason(a, { accounts, type, editingId, subtreeDepth }) === null;

  /* keep the path to the current value open */
  useEffect(() => {
    if (!selectedPath.length) return;
    setOpenIds((prev) => {
      const next = { ...prev };
      for (const node of selectedPath.slice(0, -1)) next[node.id] = true;
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const position = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    const spaceBelow = window.innerHeight - r.bottom - 16;
    const spaceAbove = r.top - 16;
    const maxH = Math.max(180, Math.min(340, Math.max(spaceBelow, spaceAbove)));
    const below = spaceBelow >= Math.min(240, maxH);
    setRect({
      left: Math.max(8, Math.min(r.left, window.innerWidth - r.width - 8)),
      width: r.width,
      maxH,
      top: below ? r.bottom + 5 : Math.max(8, r.top - maxH - 5),
    });
  };

  useLayoutEffect(() => {
    if (open) position();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onScrollResize = () => position();
    window.addEventListener("scroll", onScrollResize, true);
    window.addEventListener("resize", onScrollResize);
    const down = (e: MouseEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || btnRef.current?.contains(t)) return;
      setOpen(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
        btnRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", down, true);
    document.addEventListener("keydown", key, true);
    return () => {
      window.removeEventListener("scroll", onScrollResize, true);
      window.removeEventListener("resize", onScrollResize);
      document.removeEventListener("mousedown", down, true);
      document.removeEventListener("keydown", key, true);
    };
  }, [open]);

  /* --------------------------------------------------------------- options */
  const rows = useMemo<OptionRow[]>(() => {
    const q = query.trim().toLowerCase();
    const tree = buildTree(accounts);
    const out: OptionRow[] = [];

    const matchNode = (node: TreeNode): boolean => {
      if (!q) return true;
      if (node.account.code.toLowerCase().includes(q) || node.account.name.toLowerCase().includes(q))
        return true;
      return node.children.some(matchNode);
    };

    const walk = (nodes: TreeNode[], depth: number) => {
      for (const node of nodes) {
        if (q && !matchNode(node)) continue;
        const valid = isCandidateValid(node.account);
        if (!showAll && !valid && !node.children.some((c) => isCandidateValid(c.account))) {
          // keep the branch only if a deeper descendant is a valid parent
          const deep = hasValidDescendant(node);
          if (!deep) continue;
        }
        out.push({
          account: node.account,
          depth,
          valid,
          reason: valid ? null : parentBlockReason(node.account, { accounts, type, editingId, subtreeDepth }),
          hasChildren: node.children.length > 0,
          expanded: q ? true : (openIds[node.account.id] ?? false),
        });
        const isOpen = q ? true : (openIds[node.account.id] ?? false);
        if (isOpen && node.children.length) walk(node.children, depth + 1);
      }
    };

    const hasValidDescendant = (node: TreeNode): boolean =>
      node.children.some((c) => isCandidateValid(c.account) || hasValidDescendant(c));

    walk(tree, 0);
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts, query, showAll, openIds, type, editingId, subtreeDepth]);

  const selectable = useMemo(
    () => [
      { key: "__top__", label: TOP_LEVEL_LABEL, account: null as Account | null },
      ...rows.filter((r) => r.valid || showAll).map((r) => ({ key: r.account!.id, label: r.account!.name, account: r.account })),
    ],
    [rows, showAll],
  );

  useEffect(() => setActive(0), [query, open]);

  const commit = (id: string | null) => {
    onChange(id);
    setOpen(false);
    setQuery("");
    btnRef.current?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(selectable.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const pick = selectable[active];
      if (pick) {
        const row = rows.find((r) => r.account?.id === pick.key);
        if (pick.account === null) commit(null);
        else if (!row || row.valid) commit(pick.key);
      }
    } else if (e.key === "Home") {
      e.preventDefault();
      setActive(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActive(selectable.length - 1);
    }
  };

  const meta = TYPE_META[type];
  const blockedCount = accounts.length - accounts.filter(isCandidateValid).length;

  return (
    <div className="relative">
      <button
        ref={btnRef}
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          setOpen((o) => !o);
          position();
        }}
        onKeyDown={onKeyDown}
        className={cn(
          "flex h-9 w-full items-center gap-2 rounded-[6px] border bg-u-card px-2.5 text-left text-[13px] transition-all duration-150 hover:border-u-line2 focus:border-u-accent focus:ring-2 focus:ring-u-accent/15 focus:outline-none",
          invalid ? "border-u-danger/70 bg-u-s2" : "border-u-line",
        )}
      >
        {selected ? (
          <span className="flex min-w-0 flex-1 items-center gap-2">
            <span className="font-mono text-[12.5px] font-medium text-u-accent tabular">{selected.code}</span>
            <span className="truncate text-u-ink">{selected.name}</span>
          </span>
        ) : (
          <span className="flex min-w-0 flex-1 items-center gap-2 text-u-ink2">
            <CornerDownRight className="h-3.5 w-3.5 text-u-muted" />
            {TOP_LEVEL_LABEL}
            <span className="text-u-muted">— no parent</span>
          </span>
        )}
        {selected && (
          <span
            role="button"
            tabIndex={-1}
            aria-label="Clear parent (make top-level)"
            onClick={(e) => {
              e.stopPropagation();
              commit(null);
            }}
            className="rounded-[4px] p-0.5 text-u-muted transition-colors hover:bg-u-s3 hover:text-u-ink"
          >
            <X className="h-3.5 w-3.5" />
          </span>
        )}
        <ChevronRight className={cn("h-4 w-4 shrink-0 text-u-muted transition-transform duration-200", open && "rotate-90")} />
      </button>

      {open && rect && (
        <div
          ref={panelRef}
          role="listbox"
          aria-label="Choose a parent account"
          className="fixed z-[70] overflow-hidden rounded-[8px] border border-u-line bg-u-card shadow-[0_20px_48px_-16px_rgba(20,24,26,.45)] animate-coa-pop-in"
          style={{ left: rect.left, top: rect.top, width: rect.width, maxHeight: rect.maxH }}
          onKeyDown={onKeyDown}
        >
          <div className="flex items-center gap-2 border-b border-u-line bg-u-s2 px-2.5 py-2">
            <Search className="h-3.5 w-3.5 shrink-0 text-u-muted" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search code or name…"
              aria-label="Search parent accounts"
              className="h-6 flex-1 bg-transparent text-[12.5px] text-u-ink placeholder:text-u-muted focus:outline-none"
            />
            <span className="shrink-0 rounded-[4px] border border-u-line bg-u-card px-1.5 py-[1px] text-[10px] font-semibold tracking-[0.04em] text-u-muted uppercase">
              {meta.short} only
            </span>
          </div>

          <div ref={listRef} className="overflow-y-auto py-1 coa-scroll" style={{ maxHeight: rect.maxH - 88 }}>
            <button
              type="button"
              role="option"
              aria-selected={value === null}
              onMouseEnter={() => setActive(0)}
              onClick={() => commit(null)}
              className={cn(
                "flex w-full items-center gap-2 px-2.5 py-[7px] text-left text-[12.5px] transition-colors duration-100",
                active === 0 ? "bg-u-accent-soft" : "hover:bg-u-s3",
                value === null ? "text-u-accent" : "text-u-ink2",
              )}
            >
              <CornerDownRight className="h-3.5 w-3.5 shrink-0 opacity-70" />
              <span className="flex-1 font-medium">{TOP_LEVEL_LABEL}</span>
              <span className="text-[10.5px] text-u-muted">no parent</span>
              {value === null && <Check className="h-3.5 w-3.5 shrink-0" strokeWidth={2.4} />}
            </button>
            <div className="my-1 h-px bg-u-line" />

            {rows.length === 0 && (
              <p className="px-3 py-4 text-center text-[12px] text-u-muted">
                No account matches “{query}”.
              </p>
            )}

            {rows.map((row) => {
              const acc = row.account!;
              const activeIndex = selectable.findIndex((s) => s.key === acc.id);
              const isActive = activeIndex === active && activeIndex >= 0;
              return (
                <div key={acc.id} className="flex items-stretch">
                  <span style={{ width: row.depth * 14 }} className="shrink-0" />
                  {row.hasChildren ? (
                    <button
                      type="button"
                      tabIndex={-1}
                      aria-label={row.expanded ? `Collapse ${acc.name}` : `Expand ${acc.name}`}
                      onClick={() =>
                        setOpenIds((prev) => ({ ...prev, [acc.id]: !prev[acc.id] }))
                      }
                      className="flex w-5 shrink-0 items-center justify-center rounded-[4px] text-u-muted hover:bg-u-s3 hover:text-u-ink"
                    >
                      <ChevronRight className={cn("h-3 w-3 transition-transform duration-200", row.expanded && "rotate-90")} />
                    </button>
                  ) : (
                    <span className="w-5 shrink-0" />
                  )}
                  <button
                    type="button"
                    role="option"
                    aria-selected={value === acc.id}
                    disabled={!row.valid && !showAll}
                    onMouseEnter={() => activeIndex >= 0 && setActive(activeIndex)}
                    onClick={() => row.valid && commit(acc.id)}
                    title={row.reason ?? `${acc.code} ${acc.name}`}
                    className={cn(
                      "flex min-w-0 flex-1 items-center gap-2 py-[6px] pr-2 text-left text-[12.5px] transition-colors duration-100",
                      !row.valid && "cursor-not-allowed opacity-45",
                      row.valid && isActive && "bg-u-accent-soft",
                      row.valid && !isActive && "hover:bg-u-s3",
                      value === acc.id ? "text-u-accent" : "text-u-ink2",
                    )}
                  >
                    <span className="font-mono text-[11.5px] font-medium tabular">{acc.code}</span>
                    <span className={cn("min-w-0 flex-1 truncate", acc.role === "Group" && "font-medium")}>
                      {acc.name}
                    </span>
                    {acc.role === "Posting" && (
                      <span className="shrink-0 text-[10px] tracking-[0.04em] text-u-muted uppercase">leaf</span>
                    )}
                    {acc.status === "Inactive" && (
                      <span className="shrink-0 text-[10px] tracking-[0.04em] text-u-muted uppercase">off</span>
                    )}
                    {row.reason && showAll && (
                      <span className="max-w-[45%] shrink-0 truncate text-[10px] text-u-warn">{row.reason}</span>
                    )}
                    {value === acc.id && <Check className="h-3.5 w-3.5 shrink-0" strokeWidth={2.4} />}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-u-line bg-u-s2 px-2.5 py-1.5 text-[11px] text-u-muted">
            <label className="flex cursor-pointer items-center gap-1.5 select-none">
              <input
                type="checkbox"
                checked={showAll}
                onChange={(e) => setShowAll(e.target.checked)}
                className="h-3 w-3 accent-u-accent"
              />
              Show all accounts ({blockedCount} unavailable)
            </label>
            <span className="hidden sm:inline">↑↓ move · ⏎ select</span>
          </div>
        </div>
      )}
    </div>
  );
}
