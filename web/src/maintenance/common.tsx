// Shared bits of the maintenance list pages (Tenants-style directory chrome): pagination, row menu handling, avatar colours.
import { Fragment, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { IconButton } from "../tenants/components/ui";

const COLORS = ["blue", "violet", "teal", "amber", "rose", "slate"] as const;
export const colorFor = (s: string) => {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) % 997;
  return COLORS[h % COLORS.length];
};
export const initialsOf = (name: string) => name.split(/\s+/).filter((w) => /^[A-Za-z0-9]/.test(w)).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

/** Row "…" menu: one open at a time, closes on outside click / Escape. */
export function useRowMenu() {
  const [menu, setMenu] = useState<string | null>(null);
  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest("[data-row-menu]")) setMenu(null);
    };
    const key = (e: KeyboardEvent) => e.key === "Escape" && setMenu(null);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", key);
    };
  }, [menu]);
  return { menu, setMenu };
}

export function Pager({ total, page, pageSize, noun, setPage, setPageSize }: { total: number; page: number; pageSize: number; noun: string; setPage: (n: number) => void; setPageSize: (n: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const safe = Math.min(page, pages);
  return (
    <div className="table-pagination">
      <p>Showing <strong>{total ? (safe - 1) * pageSize + 1 : 0}-{Math.min(safe * pageSize, total)}</strong> of <strong>{total}</strong> {noun}</p>
      <div className="pagination-controls">
        <label className="page-size">
          <span>Rows per page</span>
          <select aria-label="Rows per page" value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}><option value={8}>8</option><option value={16}>16</option><option value={24}>24</option></select>
        </label>
        <div className="pagination-buttons">
          <IconButton className="first-page" label="First page" disabled={safe === 1} onClick={() => setPage(1)}><ChevronsLeft size={15} /></IconButton>
          <IconButton label="Previous page" disabled={safe === 1} onClick={() => setPage(safe - 1)}><ChevronLeft size={15} /></IconButton>
          {Array.from({ length: pages }, (_, i) => i + 1)
            .filter((n) => pages <= 5 || Math.abs(n - safe) <= 1 || n === 1 || n === pages)
            .map((n, i, arr) => (
              <Fragment key={n}>
                {i > 0 && n - arr[i - 1] > 1 && <span className="pagination-ellipsis">...</span>}
                <button className={`page-number ${safe === n ? "selected" : ""}`} aria-label={`Page ${n}`} aria-current={safe === n ? "page" : undefined} onClick={() => setPage(n)}>{n}</button>
              </Fragment>
            ))}
          <IconButton label="Next page" disabled={safe === pages} onClick={() => setPage(safe + 1)}><ChevronRight size={15} /></IconButton>
          <IconButton className="last-page" label="Last page" disabled={safe === pages} onClick={() => setPage(pages)}><ChevronsRight size={15} /></IconButton>
        </div>
      </div>
    </div>
  );
}

// tone → the shared status-badge colours used by the other directory pages
export type Tone = "ok" | "info" | "warn" | "danger" | "neutral" | "pending" | "good";
export const TONE_CLASS: Record<Tone, string> = {
  ok: "status-active",
  info: "status-reserved",
  warn: "status-expiring",
  danger: "status-terminated",
  neutral: "status-draft",
  pending: "status-pending",
  good: "status-occupied",
};
export function StatusPill({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return <span className={`status-badge ${TONE_CLASS[tone]}`}><span className="status-dot" />{children}</span>;
}
