import { useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import { useChart } from "../store/chart-store";
import { MAX_DEPTH } from "../coa/taxonomy";
import { ancestorChain, childrenOf, childrenMap } from "../coa/tree";
import type { TreeAction } from "../coa/actions";
import { cn } from "../utils/cn";
import {
  Ban,
  ChildPlus,
  ChevronDown,
  ChevronRight,
  Eye,
  InsertAfter,
  InsertBefore,
  MoveIcon,
  Pencil,
  Power,
} from "./Icons";

export interface MenuRequest {
  accountId: string;
  x: number;
  y: number;
}

interface Item {
  key: string;
  label: string;
  icon: ReactNode;
  run: () => void;
  tone?: "danger" | "accent";
  shortcut?: string;
  dividerBefore?: boolean;
}

const MENU_W = 250;

export function AccountContextMenu({
  request,
  onClose,
  onAction,
}: {
  request: MenuRequest | null;
  onClose: () => void;
  onAction: (action: TreeAction) => void;
}) {
  const { state, api } = useChart();
  const ref = useRef<HTMLDivElement>(null);
  const account = useMemo(
    () => state.accounts.find((a) => a.id === request?.accountId) ?? null,
    [state.accounts, request?.accountId],
  );

  useLayoutEffect(() => {
    if (!request || !ref.current) return;
    const el = ref.current;
    const h = el.offsetHeight;
    const x = Math.min(request.x, window.innerWidth - MENU_W - 10);
    const y = Math.min(request.y, window.innerHeight - h - 10);
    el.style.left = `${Math.max(8, x)}px`;
    el.style.top = `${Math.max(8, y)}px`;
  }, [request]);

  useEffect(() => {
    if (!request) return;
    const down = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("mousedown", down, true);
    document.addEventListener("keydown", key);
    window.addEventListener("resize", onClose);
    return () => {
      document.removeEventListener("mousedown", down, true);
      document.removeEventListener("keydown", key);
      window.removeEventListener("resize", onClose);
    };
  }, [request, onClose]);

  useEffect(() => {
    if (request) {
      const first = ref.current?.querySelector<HTMLButtonElement>("button[data-item]");
      first?.focus();
    }
  }, [request]);

  if (!request || !account) return null;

  const map = childrenMap(state.accounts);
  const kids = childrenOf(map, account.id);
  const depth = ancestorChain(state.accounts, account.id).length - 1;
  const expanded = !!state.expanded[account.id];
  const canHaveChildren =
    account.role === "Group" && account.status === "Active" && depth < MAX_DEPTH - 1;

  const go = (action: TreeAction) => {
    onClose();
    onAction(action);
  };

  const items: Item[] = [
    {
      key: "view",
      label: "View details",
      icon: <Eye />,
      run: () => go({ kind: "view", id: account.id }),
    },
    ...(canHaveChildren
      ? [
          {
            key: "child",
            label: "Add child account",
            icon: <ChildPlus />,
            tone: "accent" as const,
            run: () => go({ kind: "create", position: { kind: "child", parentId: account.id } }),
          },
        ]
      : []),
    {
      key: "before",
      label: "Insert account before",
      icon: <InsertBefore />,
      dividerBefore: true,
      run: () => go({ kind: "create", position: { kind: "before", siblingId: account.id } }),
    },
    {
      key: "after",
      label: "Insert account after",
      icon: <InsertAfter />,
      run: () => go({ kind: "create", position: { kind: "after", siblingId: account.id } }),
    },
    {
      key: "edit",
      label: "Edit account",
      icon: <Pencil />,
      dividerBefore: true,
      run: () => go({ kind: "edit", id: account.id }),
    },
    {
      key: "move",
      label: "Move account…",
      icon: <MoveIcon />,
      run: () => go({ kind: "move", id: account.id }),
    },
    ...(kids.length
      ? [
          {
            key: "toggle",
            label: expanded ? "Collapse children" : "Expand children",
            icon: expanded ? <ChevronDown /> : <ChevronRight />,
            run: () => {
              onClose();
              api.toggleExpand(account.id);
            },
          },
        ]
      : []),
    account.status === "Active"
      ? {
          key: "deactivate",
          label: "Deactivate account",
          icon: <Ban />,
          tone: "danger" as const,
          dividerBefore: true,
          run: () => go({ kind: "deactivate", id: account.id }),
        }
      : {
          key: "reactivate",
          label: "Reactivate account",
          icon: <Power />,
          tone: "accent" as const,
          dividerBefore: true,
          run: () => go({ kind: "reactivate", id: account.id }),
        },
  ];

  return (
    <div
      ref={ref}
      role="menu"
      aria-label={`Actions for ${account.code} ${account.name}`}
      className="fixed z-[60] w-[250px] overflow-hidden rounded-[8px] border border-u-line bg-u-card py-1 shadow-[0_18px_44px_-14px_rgba(20,24,26,.42)] animate-coa-pop-in"
      style={{ left: -9999, top: -9999 }}
    >
      <div className="flex items-baseline gap-2 border-b border-u-line px-3 pt-1.5 pb-2">
        <span className="font-mono text-[11.5px] font-semibold text-u-accent tabular">{account.code}</span>
        <span className="truncate text-[12px] font-medium text-u-ink">{account.name}</span>
      </div>
      <div className="max-h-[min(60vh,420px)] overflow-y-auto py-1 coa-scroll">
        {items.map((item) => (
          <div key={item.key}>
            {item.dividerBefore && <div className="my-1 h-px bg-u-line" />}
            <button
              data-item
              type="button"
              role="menuitem"
              onClick={item.run}
              className={cn(
                "flex w-full items-center gap-2.5 px-3 py-[7px] text-left text-[12.5px] transition-colors duration-100",
                item.tone === "danger"
                  ? "text-u-danger hover:bg-u-danger-soft"
                  : item.tone === "accent"
                    ? "text-u-accent hover:bg-u-accent-soft"
                    : "text-u-ink2 hover:bg-u-s3 hover:text-u-ink",
              )}
            >
              <span className="shrink-0 opacity-80">{item.icon}</span>
              <span className="truncate">{item.label}</span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
