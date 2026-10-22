import { useMemo, useState } from "react";
import { AlertCircle, Check, ChevronDown, Plus, Search, Sparkles } from "lucide-react";
import { availableVariablesForEvent } from "../lib/engine";
import { VARIABLE_GROUP_NAMES, VARIABLE_GROUPS, VARIABLE_MAP } from "../lib/variables";
import type { TemplateInput } from "../lib/types";
import { Badge } from "./ui";

export function MergeFieldPicker({ template, usedVariables, unknownVariables, onInsert, onToggleRequired }: {
  template: TemplateInput;
  usedVariables: string[];
  unknownVariables: string[];
  onInsert: (name: string) => void;
  onToggleRequired: (name: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"insert" | "used">("insert");
  const [closedGroups, setClosedGroups] = useState<string[]>([]);
  const allowed = useMemo(() => availableVariablesForEvent(template.eventContext), [template.eventContext]);
  const filtered = VARIABLE_GROUPS.filter((variable) => `${variable.name} ${variable.description} ${variable.group}`.toLowerCase().includes(search.toLowerCase()));
  const groups = VARIABLE_GROUP_NAMES.map((group) => ({ group, variables: filtered.filter((variable) => variable.group === group) })).filter((group) => group.variables.length);

  return <section className="flex min-h-[300px] flex-col rounded-lg border border-u-line bg-u-s2/60" aria-label="Merge fields">
    <div className="flex border-b border-u-line bg-u-card p-1.5">
      <button onClick={() => setTab("insert")} className={`flex-1 rounded-md px-2 py-1.5 text-[11px] font-semibold ${tab === "insert" ? "bg-u-accent-soft text-u-accent" : "text-u-muted hover:bg-u-s2"}`}>Insert variable</button>
      <button onClick={() => setTab("used")} className={`flex-1 rounded-md px-2 py-1.5 text-[11px] font-semibold ${tab === "used" ? "bg-u-accent-soft text-u-accent" : "text-u-muted hover:bg-u-s2"}`}>Used · {usedVariables.length}</button>
    </div>
    {tab === "insert" ? <>
      <div className="p-2.5"><div className="relative"><Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-u-muted" /><input value={search} onChange={(event) => setSearch(event.target.value)} className="input min-h-8 py-1.5 pl-8 text-xs" placeholder="Search merge fields" aria-label="Search merge fields" /></div></div>
      <div className="scrollbar-thin max-h-[430px] flex-1 overflow-y-auto px-2 pb-3">
        {groups.map(({ group, variables }) => <div key={group} className="mb-1">
          <button onClick={() => setClosedGroups((items) => items.includes(group) ? items.filter((item) => item !== group) : [...items, group])} className="flex w-full items-center px-1.5 py-2 text-[10px] font-semibold uppercase tracking-[.08em] text-u-muted" aria-expanded={!closedGroups.includes(group)}>{group}<span className="ml-1.5 text-u-muted">{variables.length}</span><ChevronDown size={12} className={`ml-auto transition-transform ${closedGroups.includes(group) ? "-rotate-90" : ""}`} /></button>
          {!closedGroups.includes(group) && <div className="space-y-1">{variables.map((variable) => {
            const isAllowed = allowed.includes(variable.name);
            return <button key={variable.name} disabled={!isAllowed} onClick={() => onInsert(variable.name)} title={isAllowed ? `Insert ${variable.name} at cursor` : `${variable.group} data is not available for the selected event`} className="group w-full rounded-md border border-transparent bg-u-card px-2.5 py-2 text-left hover:border-u-accent/30 hover:bg-u-accent-soft/50 disabled:cursor-not-allowed disabled:opacity-45">
              <span className="flex items-center gap-1.5"><code className="truncate text-[10px] font-semibold text-u-accent">{`{{${variable.name}}}`}</code><Plus size={12} className="ml-auto shrink-0 text-u-s3 group-hover:text-u-accent" /></span>
              <span className="mt-1 block text-[10px] leading-4 text-u-muted">{variable.description}</span><span className="mt-1 block text-[9px] font-medium uppercase tracking-wide text-u-muted">{variable.type}{!isAllowed ? " · unavailable for event" : ""}</span>
            </button>;
          })}</div>}
        </div>)}
        {!groups.length && <p className="p-5 text-center text-xs text-u-muted">No merge fields match “{search}”.</p>}
      </div>
    </> : <div className="scrollbar-thin max-h-[490px] flex-1 overflow-y-auto p-3">
      <p className="mb-3 text-[10px] leading-4 text-u-muted">Mark fields required to block a test or manual request when a record has no value.</p>
      {usedVariables.length ? <div className="space-y-2">{usedVariables.map((name) => {
        const variable = VARIABLE_MAP[name];
        const unknown = unknownVariables.includes(name);
        const required = template.requiredVariables.includes(name);
        return <div key={name} className={`rounded-md border bg-u-card p-2.5 ${unknown ? "border-u-danger/30" : "border-u-line"}`}>
          <div className="flex items-start gap-1.5">{unknown && <AlertCircle size={13} className="mt-0.5 shrink-0 text-u-danger" />}<code className="break-all text-[10px] font-semibold text-u-ink2">{`{{${name}}}`}</code></div>
          <p className="mt-1 text-[10px] leading-4 text-u-muted">{variable?.description ?? "Unknown variable. Remove it or choose a supported merge field."}</p>
          {!unknown && <button onClick={() => onToggleRequired(name)} className={`mt-2 flex items-center gap-1.5 text-[10px] font-medium ${required ? "text-u-accent" : "text-u-muted"}`}><span className={`grid h-3.5 w-3.5 place-items-center rounded border ${required ? "border-u-accent/60 bg-u-accent text-u-onaccent" : "border-u-line2"}`}>{required && <Check size={10} />}</span>Required for sending</button>}
        </div>;
      })}</div> : <div className="py-10 text-center"><Sparkles size={20} className="mx-auto text-u-s3" /><p className="mt-2 text-xs text-u-muted">No merge fields used yet.</p></div>}
      {unknownVariables.length > 0 && <div className="mt-3"><Badge tone="red">{unknownVariables.length} unknown variable{unknownVariables.length === 1 ? "" : "s"}</Badge></div>}
    </div>}
  </section>;
}
