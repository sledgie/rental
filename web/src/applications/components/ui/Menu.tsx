import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "../../utils/cn";

export interface MenuItem {
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  tone?: "default" | "danger" | "accent";
  disabled?: boolean;
  hint?: string;
  separatorBefore?: boolean;
}

export function Menu({
  label,
  items,
  trigger,
  align = "right",
  width = "w-56",
}: {
  label: string;
  items: MenuItem[];
  trigger?: ReactNode;
  align?: "left" | "right";
  width?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex h-7 items-center justify-center gap-1 rounded-md border border-transparent px-1.5 text-u-muted transition-colors hover:border-u-line2 hover:bg-u-s3 hover:text-u-ink",
          open && "border-u-line2 bg-u-s3 text-u-ink",
        )}
      >
        {trigger}
      </button>
      {open && (
        <div
          role="menu"
          className={cn(
            "absolute top-[calc(100%+4px)] z-40 overflow-hidden rounded-lg border border-u-line2 bg-u-s2 py-1 shadow-2xl shadow-u-bg/60 animate-ap-in",
            width,
            align === "right" ? "right-0" : "left-0",
          )}
        >
          {items.map((item, i) => (
            <div key={item.label + i} className={cn(item.separatorBefore && "mt-1 border-t border-u-line pt-1")}>
              <button
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  setOpen(false);
                  item.onSelect();
                }}
                className={cn(
                  "flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[12.5px] transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                  item.tone === "danger"
                    ? "text-u-danger hover:bg-u-danger/10"
                    : item.tone === "accent"
                      ? "text-u-accent hover:bg-u-accent/10"
                      : "text-u-ink2 hover:bg-u-s3 hover:text-u-ink",
                )}
              >
                {item.icon && <span className="shrink-0 opacity-80">{item.icon}</span>}
                <span className="flex-1">{item.label}</span>
                {item.hint && <span className="text-[10px] text-u-muted">{item.hint}</span>}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
