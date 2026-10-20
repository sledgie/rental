// Shared directory controls, taken from the Tenants page so every list filters the same way: a search box with the "/" shortcut, a
// "Filters" button with a popover (checkboxes and selects, Reset, Show results) and a "Sort by" select with a direction button.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowDown, ArrowDownUp, ArrowUp, ChevronDown, Search, SlidersHorizontal, X } from "lucide-react";
import { Button, IconButton } from "../tenants/components/ui";

export function SearchField({ label, placeholder, value, onChange }: { label: string; placeholder: string; value: string; onChange: (value: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable) return;
      event.preventDefault();
      ref.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  return (
    <div className="search-field">
      <Search size={17} />
      <input ref={ref} aria-label={label} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
      {value ? (
        <IconButton label="Clear search" onClick={() => onChange("")}>
          <X size={14} />
        </IconButton>
      ) : (
        <kbd>/</kbd>
      )}
    </div>
  );
}

export function FilterPopover({ title, count, onReset, children }: { title: string; count: number; onReset: () => void; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", key);
    };
  }, [open]);
  return (
    <div className="filter-anchor" ref={ref}>
      <Button className={count ? "filters-active" : ""} aria-expanded={open} onClick={() => setOpen(!open)}>
        <SlidersHorizontal size={15} />
        Filters
        {count > 0 && <span className="filter-count">{count}</span>}
        <ChevronDown size={13} />
      </Button>
      {open && (
        <div className="filter-popover">
          <div className="popover-title">
            {title}
            <button onClick={onReset}>Reset</button>
          </div>
          {children}
          <Button variant="primary" className="apply-filters" onClick={() => setOpen(false)}>
            Show results
          </Button>
        </div>
      )}
    </div>
  );
}

export function FilterCheckbox({ checked, onChange, label, hint }: { checked: boolean; onChange: (checked: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="filter-checkbox">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>
        {label}
        {hint && <small>{hint}</small>}
      </span>
    </label>
  );
}

export function FilterField({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="popover-field">
      <label htmlFor={id}>{label}</label>
      {children}
    </div>
  );
}

export function SortControl({
  label,
  value,
  defaultValue,
  options,
  descending,
  onChange,
  onToggle,
}: {
  label: string;
  value: string;
  /** the natural order of the list; shown as "Sort by" and hides the direction button, like Tenants */
  defaultValue: string;
  options: { value: string; label: string }[];
  descending: boolean;
  onChange: (value: string) => void;
  onToggle: () => void;
}) {
  return (
    <>
      <label className="sort-control">
        <ArrowDownUp size={15} />
        <span className="sr-only">{label}</span>
        <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}>
          <option value={defaultValue}>Sort by</option>
          {options.filter((o) => o.value !== defaultValue).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown size={13} />
      </label>
      {value !== defaultValue && (
        <IconButton className="sort-direction" label={descending ? "Sort ascending" : "Sort descending"} onClick={onToggle}>
          {descending ? <ArrowDown size={16} /> : <ArrowUp size={16} />}
        </IconButton>
      )}
    </>
  );
}
