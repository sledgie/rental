import { useState } from "react";
import { Ban, Pencil, Plus } from "lucide-react";
import type { Caps, Category } from "../types";
import { cx } from "./ui";

const COLORS = ["#1d6650", "#2563eb", "#059669", "#ea580c", "#7c3aed", "#0284c7", "#0d9488", "#db2777", "#b45309", "#64748b"];

/** Task categories: the 11 system defaults plus the organization's own. System ones can be renamed and recoloured but never deleted. */
export default function CategoriesTab({ categories, counts, caps, busy, onCreate, onUpdate }: {
  categories: Category[];
  counts: Map<string, number>;
  caps: Caps;
  busy: boolean;
  onCreate: (name: string, color: string) => void;
  onUpdate: (id: string, patch: { name?: string; color?: string; isActive?: boolean }) => void;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState(COLORS[0]);

  return (
    <div className="space-y-3 p-4">
      <p className="text-xs text-u-muted">Categories group tasks on the list and the calendar. Deactivating a category hides it from new tasks; existing tasks keep it.</p>
      {!caps.series && <p className="rounded-lg bg-u-warn-soft px-3 py-2 text-xs text-u-warn">Your role can view categories but not change them.</p>}
      {caps.series && (
        <form className="flex flex-wrap items-end gap-3 rounded-xl bg-u-s2 p-3" onSubmit={(e) => { e.preventDefault(); if (name.trim()) { onCreate(name.trim(), color); setName(""); } }}>
          <div className="min-w-48 flex-1">
            <label htmlFor="st-newcat" className="mb-1 block text-[11px] font-semibold text-u-ink2">New category</label>
            <input id="st-newcat" className="st-input" value={name} maxLength={80} placeholder="e.g. Turnover cleaning" onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <span className="mb-1 block text-[11px] font-semibold text-u-ink2">Colour</span>
            <div className="flex gap-1.5">{COLORS.map((c) => <button key={c} type="button" aria-label={`Colour ${c}`} aria-pressed={color === c} onClick={() => setColor(c)} className={cx("size-6 rounded-full ring-2 ring-offset-2 ring-offset-u-s2", color === c ? "ring-u-ink" : "ring-transparent")} style={{ backgroundColor: c }} />)}</div>
          </div>
          <button type="submit" className="st-btn st-btn-primary" disabled={busy || !name.trim()}><Plus size={14} />Add</button>
        </form>
      )}
      <ul className="divide-y divide-u-line rounded-xl border border-u-line bg-u-card">
        {categories.map((c) => (
          <li key={c.id} className="flex items-center gap-3 px-4 py-2.5">
            <span className="h-8 w-1.5 rounded-full" style={{ backgroundColor: c.color }} />
            <div className="min-w-0 flex-1">
              {editing === c.id ? (
                <div className="flex flex-wrap items-center gap-2">
                  <input aria-label="Category name" className="st-input max-w-64" value={editName} onChange={(e) => setEditName(e.target.value)} />
                  <div className="flex gap-1">{COLORS.slice(0, 7).map((cc) => <button key={cc} type="button" aria-label={`Colour ${cc}`} onClick={() => setEditColor(cc)} className={cx("size-5 rounded-full ring-2 ring-offset-1 ring-offset-u-card", editColor === cc ? "ring-u-ink" : "ring-transparent")} style={{ backgroundColor: cc }} />)}</div>
                  <button type="button" className="st-btn st-btn-sm st-btn-primary" disabled={busy || !editName.trim()} onClick={() => { onUpdate(c.id, { name: editName, color: editColor }); setEditing(null); }}>Save</button>
                  <button type="button" className="st-btn st-btn-sm" onClick={() => setEditing(null)}>Cancel</button>
                </div>
              ) : (
                <>
                  <p className="truncate text-sm font-semibold text-u-ink">{c.name}{!c.isActive && <span className="ml-2 rounded bg-u-s3 px-1.5 py-0.5 text-[10px] font-bold text-u-muted">INACTIVE</span>}</p>
                  <p className="text-[11px] text-u-muted">{c.isSystem ? "System default" : "Custom"} · {counts.get(c.id) ?? 0} task{(counts.get(c.id) ?? 0) === 1 ? "" : "s"}</p>
                </>
              )}
            </div>
            {caps.series && editing !== c.id && (
              <div className="flex gap-1">
                <button type="button" className="st-pg" title="Rename or recolour" aria-label={`Edit ${c.name}`} onClick={() => { setEditing(c.id); setEditName(c.name); setEditColor(c.color); }}><Pencil size={13} /></button>
                <button type="button" className="st-pg" title={c.isActive ? "Deactivate" : "Activate"} aria-label={`${c.isActive ? "Deactivate" : "Activate"} ${c.name}`} disabled={busy} onClick={() => onUpdate(c.id, { isActive: !c.isActive })}><Ban size={13} /></button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
