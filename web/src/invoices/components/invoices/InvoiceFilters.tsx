import { useState } from "react";
import { Filter, Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@inv/components/ui/Button";
import { Input, Select } from "@inv/components/ui/Field";
import { properties } from "@inv/data/mockInvoices";
import { typeLabels, type InvoiceFilters, type InvoiceStatus, type InvoiceType } from "@inv/types/invoice";
import { cn } from "@inv/utils/cn";

interface InvoiceFiltersBarProps {
  filters: InvoiceFilters;
  onChange: (patch: Partial<InvoiceFilters>) => void;
  onClear: () => void;
  tenants: string[];
  resultCount: number;
  activeCount: number;
}

const statusOptions: { value: InvoiceStatus | "all"; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "pending_approval", label: "Pending Approval" },
  { value: "unpaid", label: "Unpaid" },
  { value: "partially_paid", label: "Partially Paid" },
  { value: "paid", label: "Paid" },
  { value: "overdue", label: "Overdue" },
  { value: "void", label: "Void" },
];

const dueOptions: { value: InvoiceFilters["due"]; label: string }[] = [
  { value: "all", label: "All dates" },
  { value: "overdue", label: "Overdue" },
  { value: "this_week", label: "Due this week" },
  { value: "this_month", label: "Due this month" },
  { value: "custom", label: "Custom range" },
];

const selectClass = "h-9 text-[13px]";

export function InvoiceFiltersBar({
  filters,
  onChange,
  onClear,
  tenants,
  resultCount,
  activeCount,
}: InvoiceFiltersBarProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <section
      aria-label="Invoice filters"
      className="rounded-xl border border-line bg-surface"
    >
      {/* Row 1 — search + primary selects */}
      <div className="flex flex-col gap-2.5 p-3 lg:flex-row lg:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint" />
          <Input
            type="search"
            value={filters.query}
            onChange={(e) => onChange({ query: e.target.value })}
            placeholder="Search invoice ID, tenant, property or unit…"
            aria-label="Search invoices"
            className="pl-9"
          />
        </div>

        <div className="grid grid-cols-2 gap-2.5 lg:flex lg:w-auto lg:shrink-0">
          <Select
            aria-label="Filter by status"
            className={cn(selectClass, "lg:w-[168px]")}
            value={filters.status}
            onChange={(e) => onChange({ status: e.target.value as InvoiceStatus | "all" })}
          >
            {statusOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>

          <Select
            aria-label="Filter by property"
            className={cn(selectClass, "lg:w-[176px]")}
            value={filters.propertyId}
            onChange={(e) => onChange({ propertyId: e.target.value })}
          >
            <option value="all">All Properties</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>

          <Select
            aria-label="Filter by invoice type"
            className={cn(selectClass, "lg:w-[148px]")}
            value={filters.type}
            onChange={(e) => onChange({ type: e.target.value as InvoiceType | "all" })}
          >
            <option value="all">All Types</option>
            {(Object.keys(typeLabels) as InvoiceType[]).map((t) => (
              <option key={t} value={t}>
                {typeLabels[t]}
              </option>
            ))}
          </Select>

          <Select
            aria-label="Filter by due date"
            className={cn(selectClass, "lg:w-[158px]")}
            value={filters.due}
            onChange={(e) =>
              onChange({ due: e.target.value as InvoiceFilters["due"] })
            }
          >
            {dueOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {/* Custom date range */}
      {filters.due === "custom" ? (
        <div className="flex flex-wrap items-end gap-2.5 border-t border-line px-3 py-3">
          <div>
            <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-ink-muted">
              From
            </p>
            <Input
              type="date"
              value={filters.customFrom}
              onChange={(e) => onChange({ customFrom: e.target.value })}
              aria-label="Custom range start"
              className="w-[170px]"
            />
          </div>
          <div>
            <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-ink-muted">
              To
            </p>
            <Input
              type="date"
              value={filters.customTo}
              onChange={(e) => onChange({ customTo: e.target.value })}
              aria-label="Custom range end"
              className="w-[170px]"
            />
          </div>
        </div>
      ) : null}

      {/* Advanced */}
      {showAdvanced ? (
        <div className="grid grid-cols-1 gap-2.5 border-t border-line p-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-ink-muted">
              Min amount
            </p>
            <Input
              type="number"
              min={0}
              step={50}
              value={filters.minAmount}
              onChange={(e) => onChange({ minAmount: e.target.value })}
              placeholder="0"
              aria-label="Minimum amount"
            />
          </div>
          <div>
            <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-ink-muted">
              Max amount
            </p>
            <Input
              type="number"
              min={0}
              step={50}
              value={filters.maxAmount}
              onChange={(e) => onChange({ maxAmount: e.target.value })}
              placeholder="Any"
              aria-label="Maximum amount"
            />
          </div>
          <div className="sm:col-span-2">
            <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-ink-muted">
              Tenant
            </p>
            <Select
              aria-label="Filter by tenant"
              value={filters.tenant}
              onChange={(e) => onChange({ tenant: e.target.value })}
            >
              <option value="all">All tenants</option>
              {tenants.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </div>
        </div>
      ) : null}

      {/* Footer — result count + actions */}
      <div className="flex flex-wrap items-center gap-2 border-t border-line bg-surface-2/50 px-3 py-2.5 rounded-b-xl">
        <span className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-muted">
          <Filter className="size-3.5 text-ink-faint" />
          <span className="tabular-nums text-ink">{resultCount}</span>
          {resultCount === 1 ? "invoice matches" : "invoices match"} the current filters
        </span>

        {activeCount > 0 ? (
          <span className="rounded-full border border-accent/30 bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-brand-ink">
            {activeCount} active {activeCount === 1 ? "filter" : "filters"}
          </span>
        ) : null}

        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAdvanced((v) => !v)}
            aria-expanded={showAdvanced}
          >
            <SlidersHorizontal className="size-3.5" />
            {showAdvanced ? "Hide advanced" : "Advanced"}
          </Button>
          {activeCount > 0 ? (
            <Button variant="ghost" size="sm" onClick={onClear}>
              <X className="size-3.5" />
              Clear filters
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
