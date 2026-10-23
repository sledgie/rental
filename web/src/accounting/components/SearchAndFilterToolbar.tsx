import { isSupabaseConfigured } from "../../lib/supabase";
// Tabs + search + "Filters" popover in the shared directory format used by Properties, Payments and Tenants (shell/directory.tsx).
import { ChevronsDownUp, ChevronsUpDown } from "lucide-react";
import { useChart } from "../store/chart-store";
import { ACCOUNT_TYPES, TYPE_META } from "../coa/taxonomy";
import { DEFAULT_FILTERS } from "../store/chart-store";
import { IconButton } from "../../tenants/components/ui";
import { FilterCheckbox, FilterField, FilterPopover, SearchField } from "../../shell/directory";

export function SearchAndFilterToolbar() {
  const { state, api, result } = useChart();
  const { filters } = state;

  const popoverCount =
    (filters.type !== "all" ? 1 : 0) + (filters.role !== "all" ? 1 : 0) + (filters.showInactive !== DEFAULT_FILTERS.showInactive ? 1 : 0);
  const resetPopover = () =>
    api.setFilter({ type: DEFAULT_FILTERS.type, role: DEFAULT_FILTERS.role, showInactive: DEFAULT_FILTERS.showInactive });

  const inactiveCount = state.accounts.filter((a) => a.status === "Inactive").length;
  const tabs = [
    { key: "all" as const, label: "All accounts", count: state.accounts.length },
    { key: "Active" as const, label: "Active", count: state.accounts.length - inactiveCount },
    { key: "Inactive" as const, label: "Inactive", count: inactiveCount },
  ];

  return (
    <>
      <div className="directory-tabs" aria-label="Filter accounts by status">
        {tabs.map((t) => (
          <button
            key={t.key}
            className={`directory-tab ${filters.status === t.key ? "selected" : ""}`}
            aria-pressed={filters.status === t.key}
            onClick={() => api.setFilter(t.key === "Active" ? { status: t.key } : { status: t.key, showInactive: true })}
          >
            {t.label}
            <span>{t.count}</span>
          </button>
        ))}
        <div className="directory-tabs-end">
          <span className="live-dot" />
          {isSupabaseConfigured ? "Live" : "Demo data"}
        </div>
      </div>
      <div className="directory-toolbar">
        <SearchField
          label="Search accounts by code or name"
          placeholder="Search account code or name..."
          value={filters.query}
          onChange={(v) => api.setFilter({ query: v })}
        />
        <div className="toolbar-actions">
          <FilterPopover title="Filter accounts" count={popoverCount} onReset={resetPopover}>
            <FilterField id="coa-type-filter" label="Account type">
              <select id="coa-type-filter" value={filters.type} onChange={(e) => api.setFilter({ type: e.target.value as typeof filters.type })}>
                <option value="all">All types</option>
                {ACCOUNT_TYPES.map((t) => (
                  <option key={t} value={t}>{TYPE_META[t].label}</option>
                ))}
              </select>
            </FilterField>
            <FilterField id="coa-role-filter" label="Account role">
              <select id="coa-role-filter" value={filters.role} onChange={(e) => api.setFilter({ role: e.target.value as typeof filters.role })}>
                <option value="all">Group + posting</option>
                <option value="Group">Group accounts</option>
                <option value="Posting">Posting accounts</option>
              </select>
            </FilterField>
            <FilterCheckbox
              checked={filters.showInactive}
              onChange={(v) => api.setFilter({ showInactive: v })}
              label="Show inactive"
              hint="Include deactivated accounts in the tree"
            />
          </FilterPopover>
          <IconButton label="Expand all groups" onClick={api.expandAll}>
            <ChevronsUpDown size={16} />
          </IconButton>
          <IconButton label="Collapse all groups" onClick={api.collapseAll}>
            <ChevronsDownUp size={16} />
          </IconButton>
        </div>
      </div>
      <p className="sr-only" aria-live="polite">{result.count} accounts shown</p>
    </>
  );
}
