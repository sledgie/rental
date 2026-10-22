import { memo, type DragEvent } from "react";
import { MAX_DEPTH, ROLE_META, TYPE_META } from "../coa/taxonomy";
import type { FlatRow } from "../coa/tree";
import type { TreeAction } from "../coa/actions";
import type { Account } from "../coa/types";
import { cn } from "../utils/cn";
import { ChildPlus, ChevronRight, Eye, Kebab, Pencil } from "./Icons";
import { Badge, Highlight } from "./ui";

export type DropZone = "before" | "child" | "after";

export interface RowDragState {
  draggingId: string | null;
  targetId: string | null;
  zone: DropZone | null;
  valid: boolean;
}

interface Props {
  row: FlatRow;
  query: string;
  selected: boolean;
  focused: boolean;
  contextOnly: boolean;
  drag: RowDragState;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
  onOpenMenu: (account: Account, x: number, y: number) => void;
  onAction: (action: TreeAction) => void;
  onDragStart: (e: DragEvent<HTMLDivElement>, account: Account) => void;
  onDragOverRow: (e: DragEvent<HTMLDivElement>, account: Account) => void;
  onDropRow: (e: DragEvent<HTMLDivElement>, account: Account) => void;
  onDragEnd: () => void;
  registerRef: (id: string, el: HTMLDivElement | null) => void;
}

const INDENT = 18;

function AccountTreeRowBase({
  row,
  query,
  selected,
  focused,
  contextOnly,
  drag,
  onToggle,
  onSelect,
  onOpenMenu,
  onAction,
  onDragStart,
  onDragOverRow,
  onDropRow,
  onDragEnd,
  registerRef,
}: Props) {
  const { account, depth, hasChildren, expanded, isMatch, childCount } = row;
  const meta = TYPE_META[account.type];
  const inactive = account.status === "Inactive";
  const canHaveChildren = account.role === "Group" && !inactive && depth < MAX_DEPTH - 1;
  const isDragTarget = drag.targetId === account.id && drag.draggingId !== account.id;
  const showZone = isDragTarget ? drag.zone : null;

  return (
    <div
      ref={(el) => registerRef(account.id, el)}
      role="treeitem"
      data-row-id={account.id}
      aria-level={depth + 1}
      aria-selected={selected}
      aria-expanded={hasChildren ? expanded : undefined}
      tabIndex={focused ? 0 : -1}
      draggable
      onDragStart={(e) => onDragStart(e, account)}
      onDragOver={(e) => onDragOverRow(e, account)}
      onDrop={(e) => onDropRow(e, account)}
      onDragEnd={onDragEnd}
      onClick={() => onSelect(account.id)}
      onDoubleClick={() => hasChildren && onToggle(account.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          onSelect(account.id);
        }
        if (e.key === " ") {
          e.preventDefault();
          if (hasChildren) onToggle(account.id);
        }
        if (e.key === "ContextMenu" || (e.shiftKey && e.key === "F10")) {
          e.preventDefault();
          const rect = e.currentTarget.getBoundingClientRect();
          onOpenMenu(account, rect.right - 200, rect.bottom - 4);
        }
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        onOpenMenu(account, e.clientX, e.clientY);
      }}
      className={cn(
        "group relative flex cursor-default items-center gap-2 border-b border-u-line/70 py-[7px] pr-2 outline-none transition-colors duration-100",
        selected ? "bg-u-accent-soft/70" : "hover:bg-u-s3",
        !selected && focused && "bg-u-s3",
        contextOnly && !selected && "opacity-[0.62]",
        drag.draggingId === account.id && "opacity-35",
      )}
      style={{ paddingLeft: 10 + depth * INDENT }}
    >
      {/* hierarchy guide lines */}
      {depth > 0 && (
        <span className="pointer-events-none absolute inset-y-0 left-0" aria-hidden="true">
          {Array.from({ length: depth }).map((_, i) => (
            <span
              key={i}
              className={cn(
                "absolute top-0 bottom-0 w-px",
                selected ? "bg-u-accent/15" : "bg-u-line group-hover:bg-u-line",
              )}
              style={{ left: 10 + i * INDENT + 9.5 }}
            />
          ))}
        </span>
      )}

      {/* selection bar */}
      <span
        aria-hidden="true"
        className={cn(
          "absolute inset-y-0 left-0 w-[2.5px] transition-all duration-200",
          selected ? "bg-u-accent opacity-100" : "opacity-0",
        )}
      />

      {/* drop indicators */}
      {showZone === "before" && (
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute -top-px right-0 left-0 h-[2px] rounded-full",
            drag.valid ? "bg-u-accent" : "bg-u-danger",
          )}
          style={{ left: 10 + depth * INDENT }}
        />
      )}
      {showZone === "after" && (
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute -bottom-px right-0 left-0 h-[2px] rounded-full",
            drag.valid ? "bg-u-accent" : "bg-u-danger",
          )}
          style={{ left: 10 + depth * INDENT }}
        />
      )}
      {showZone === "child" && (
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-[1px] rounded-[5px] border",
            drag.valid ? "border-u-accent bg-u-accent-soft/50" : "border-u-danger bg-u-danger-soft/40",
          )}
        />
      )}

      {/* expander */}
      {hasChildren ? (
        <button
          type="button"
          tabIndex={-1}
          aria-label={expanded ? `Collapse ${account.name}` : `Expand ${account.name}`}
          onClick={(e) => {
            e.stopPropagation();
            onToggle(account.id);
          }}
          className="relative z-10 flex h-5 w-5 shrink-0 items-center justify-center rounded-[4px] text-u-muted transition-all duration-150 hover:bg-u-s3 hover:text-u-ink"
        >
          <ChevronRight
            className={cn("h-3.5 w-3.5 transition-transform duration-200", expanded && "rotate-90")}
          />
        </button>
      ) : (
        <span className="relative z-10 flex h-5 w-5 shrink-0 items-center justify-center">
          <span className={cn("h-[3px] w-[3px] rounded-full", inactive ? "bg-u-s3" : "bg-u-s3")} />
        </span>
      )}

      {/* code column */}
      <span
        className={cn(
          "relative z-10 w-[58px] shrink-0 font-mono text-[12.5px] font-medium tabular sm:w-[64px]",
          selected ? "text-u-accent" : inactive ? "text-u-muted" : "text-u-ink2",
        )}
      >
        <Highlight text={account.code} query={query} />
      </span>

      {/* name + inline badges */}
      <span className="relative z-10 flex min-w-0 flex-1 items-center gap-2">
        <span
          className={cn(
            "truncate text-[13px] leading-tight",
            account.role === "Group" ? "font-semibold text-u-ink" : "font-normal",
            inactive ? "text-u-muted line-through decoration-u-muted decoration-1" : selected ? "text-u-ink" : "text-u-ink2",
          )}
        >
          <Highlight text={account.name} query={query} />
        </span>

        <span className="hidden shrink-0 items-center gap-1.5 sm:flex">
          <Badge className={meta.chip}>{meta.short}</Badge>
        </span>
        {account.role === "Group" && (
          <span
            className={cn(
              "hidden shrink-0 rounded-[4px] border px-1.5 py-[1px] text-[10px] font-semibold uppercase tracking-[0.05em] md:inline-flex",
              ROLE_META.Group.chip,
            )}
            title={ROLE_META.Group.hint}
          >
            Group{childCount ? ` · ${childCount}` : ""}
          </span>
        )}
        {account.role === "Posting" && !account.allowDirectPosting && (
          <span
            className="hidden shrink-0 rounded-[4px] border border-u-warn/30 bg-u-warn/8 px-1.5 py-[1px] text-[10px] font-semibold uppercase tracking-[0.05em] text-u-warn lg:inline-flex"
            title="Posting account with direct posting disabled"
          >
            No post
          </span>
        )}
        {inactive && (
          <span className="hidden shrink-0 rounded-[4px] border border-u-line bg-u-s3 px-1.5 py-[1px] text-[10px] font-semibold uppercase tracking-[0.05em] text-u-muted lg:inline-flex">
            Inactive
          </span>
        )}
        {isMatch && query.trim() && (
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-u-warn" title="Search match" />
        )}
      </span>

      {/* row actions */}
      <span className="relative z-10 flex w-[112px] shrink-0 items-center justify-end gap-0.5">
        <button
          type="button"
          tabIndex={-1}
          title={`View ${account.code}`}
          aria-label={`View ${account.code} ${account.name}`}
          onClick={(e) => {
            e.stopPropagation();
            onAction({ kind: "view", id: account.id });
          }}
          className="flex h-6 w-6 items-center justify-center rounded-[5px] text-u-muted transition-all duration-150 hover:bg-u-s3 hover:text-u-ink"
        >
          <Eye className="h-3.5 w-3.5" />
        </button>
        {canHaveChildren && (
          <button
            type="button"
            tabIndex={-1}
            title={`Add child account under ${account.code}`}
            aria-label={`Add child account under ${account.code} ${account.name}`}
            onClick={(e) => {
              e.stopPropagation();
              onAction({ kind: "create", position: { kind: "child", parentId: account.id } });
            }}
            className="flex h-6 w-6 items-center justify-center rounded-[5px] text-u-muted transition-all duration-150 hover:bg-u-accent-soft hover:text-u-accent"
          >
            <ChildPlus className="h-3.5 w-3.5" />
          </button>
        )}
        <button
          type="button"
          tabIndex={-1}
          title={`Edit ${account.code}`}
          aria-label={`Edit ${account.code} ${account.name}`}
          onClick={(e) => {
            e.stopPropagation();
            onAction({ kind: "edit", id: account.id });
          }}
          className="flex h-6 w-6 items-center justify-center rounded-[5px] text-u-muted transition-all duration-150 hover:bg-u-s3 hover:text-u-ink"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          tabIndex={-1}
          title={`More actions for ${account.code}`}
          aria-label={`More actions for ${account.code} ${account.name}`}
          aria-haspopup="menu"
          onClick={(e) => {
            e.stopPropagation();
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            onSelect(account.id);
            onOpenMenu(account, rect.right - 232, rect.bottom + 4);
          }}
          className="flex h-6 w-6 items-center justify-center rounded-[5px] text-u-muted transition-all duration-150 hover:bg-u-s3 hover:text-u-ink"
        >
          <Kebab className="h-3.5 w-3.5" />
        </button>
      </span>
    </div>
  );
}

export const AccountTreeRow = memo(AccountTreeRowBase);
