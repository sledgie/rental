import { ChevronLeft, ChevronRight } from "lucide-react";
import { Select } from "@inv/components/ui/Field";
import { cn } from "@inv/utils/cn";

interface PaginationProps {
  page: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

const pageSizes = [10, 15, 25, 50];

function buildPages(page: number, pageCount: number): (number | "…")[] {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1);
  const out: (number | "…")[] = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(pageCount - 1, page + 1);
  if (start > 2) out.push("…");
  for (let i = start; i <= end; i++) out.push(i);
  if (end < pageCount - 1) out.push("…");
  out.push(pageCount);
  return out;
}

export function Pagination({
  page,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
}: PaginationProps) {
  const pageCount = Math.max(1, Math.ceil(totalItems / pageSize));
  const from = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(totalItems, page * pageSize);
  const pages = buildPages(page, pageCount);

  const btn =
    "grid size-8 place-items-center rounded-md border border-transparent text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink disabled:pointer-events-none disabled:opacity-40";
  const num = (active: boolean) =>
    cn(
      "h-8 min-w-8 rounded-md border px-2 text-[13px] font-medium transition-colors tabular-nums",
      active
        ? "border-accent/50 bg-accent-soft text-[#8ce2bf]"
        : "border-transparent text-ink-muted hover:bg-surface-2 hover:text-ink"
    );

  return (
    <div className="flex flex-col-reverse items-stretch gap-3 border-t border-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-3 text-[12.5px] text-ink-muted">
        <span className="tabular-nums">
          Showing{" "}
          <span className="text-ink">
            {from}–{to}
          </span>{" "}
          of <span className="text-ink">{totalItems}</span> invoices
        </span>
        <span className="hidden h-4 w-px bg-line sm:block" />
        <label className="flex items-center gap-2">
          <span className="hidden sm:inline">Rows</span>
          <Select
            aria-label="Rows per page"
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="h-8 w-[68px] text-[13px]"
          >
            {pageSizes.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </label>
      </div>

      <nav className="flex items-center justify-end gap-1" aria-label="Pagination">
        <button
          type="button"
          className={btn}
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
        >
          <ChevronLeft className="size-4" />
        </button>
        {pages.map((p, i) =>
          p === "…" ? (
            <span key={`gap-${i}`} className="grid h-8 min-w-8 place-items-center text-ink-faint">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              className={num(p === page)}
              aria-current={p === page ? "page" : undefined}
              onClick={() => onPageChange(p)}
            >
              {p}
            </button>
          )
        )}
        <button
          type="button"
          className={btn}
          onClick={() => onPageChange(page + 1)}
          disabled={page >= pageCount}
          aria-label="Next page"
        >
          <ChevronRight className="size-4" />
        </button>
      </nav>
    </div>
  );
}
