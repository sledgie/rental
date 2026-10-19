import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "../utils/cn";

export type RowMenuItem = { label: string; icon?: ReactNode; onSelect: () => void };

/** "⋯" actions menu for a table row. Fixed-positioned in a portal so the table's horizontal scroll can't clip it. */
export default function RowMenu({ label, items }: { label: string; items: RowMenuItem[] }) {
  const btn = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const id = useId();
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const open = pos !== null;

  const close = (refocus = true) => {
    setPos(null);
    if (refocus) btn.current?.focus();
  };
  const toggle = () => {
    if (open) return close(false);
    const r = btn.current!.getBoundingClientRect();
    const below = window.innerHeight - r.bottom > 140;
    setPos({ top: below ? r.bottom + 4 : Math.max(8, r.top - 4 - items.length * 38 - 8), right: Math.max(8, window.innerWidth - r.right) });
  };

  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const away = (e: MouseEvent) => {
      if (!menu.current?.contains(e.target as Node) && !btn.current?.contains(e.target as Node)) close(false);
    };
    const hide = () => close(false);
    document.addEventListener("mousedown", away);
    window.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);
    return () => {
      document.removeEventListener("mousedown", away);
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("resize", hide);
    };
  }, [open]);

  const onMenuKey = (e: React.KeyboardEvent) => {
    const els = Array.from(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    const i = els.indexOf(document.activeElement as HTMLElement);
    if (e.key === "Escape") { e.preventDefault(); close(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); els[(i + 1) % els.length]?.focus(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); els[(i - 1 + els.length) % els.length]?.focus(); }
    else if (e.key === "Home") { e.preventDefault(); els[0]?.focus(); }
    else if (e.key === "End") { e.preventDefault(); els[els.length - 1]?.focus(); }
    else if (e.key === "Tab") close(false);
  };

  return (
    <>
      <button
        ref={btn}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-label={label}
        title="Actions"
        onClick={(e) => {
          e.stopPropagation();
          toggle();
        }}
        onKeyDown={(e) => e.stopPropagation()}
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-lg text-ink-3 transition hover:bg-surface-3 hover:text-ink focus-visible:text-ink",
          open && "bg-surface-3 text-ink",
        )}
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
          <circle cx="5" cy="12" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="19" cy="12" r="1.8" />
        </svg>
      </button>
      {open &&
        createPortal(
          <div className="rd contents">
            <div
              ref={menu}
              id={id}
              role="menu"
              aria-label={label}
              onKeyDown={onMenuKey}
              onClick={(e) => e.stopPropagation()}
              style={{ position: "fixed", top: pos.top, right: pos.right }}
              className="z-50 min-w-44 rounded-xl border border-hairline bg-surface p-1 shadow-2xl"
            >
              {items.map((it) => (
                <button
                  key={it.label}
                  type="button"
                  role="menuitem"
                  tabIndex={-1}
                  onClick={() => {
                    close(false);
                    it.onSelect();
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] font-semibold text-ink-2 outline-none transition hover:bg-surface-2 hover:text-ink focus-visible:bg-surface-2 focus-visible:text-ink"
                >
                  {it.icon}
                  {it.label}
                </button>
              ))}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
