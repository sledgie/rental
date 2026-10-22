import { X } from "lucide-react";
import { FilterField, FilterPopover } from "../shell/directory";
import { getDataset } from "./lib/data";
import type { ReportDefinition, ReportFilters } from "./lib/types";
import { PRESET_LABELS } from "./lib/utils/dates";
import { activeFilterChips } from "./lib/utils/filters";
import { useReportContext } from "./ReportProvider";

const SOURCE_TYPES = [
  "opening_balance", "tenant_invoice", "tenant_payment", "vendor_bill", "vendor_payment", "mortgage_payment", "depreciation",
  "security_deposit", "capital_expenditure", "owner_distribution", "owner_contribution", "bank_charge", "manual",
];

/** The report filter popover (same control Properties and Tenants use) for the report's supported filters. */
export function ReportFilterPopover({ definition }: { definition: ReportDefinition }) {
  const { filters, patchFilters, resetFilters } = useReportContext();
  const ds = getDataset();
  const has = (key: string) => definition.filters.includes(key as never);
  const chips = activeFilterChips(filters, ds);
  const sel = <K extends keyof ReportFilters>(id: string, label: string, key: K, children: React.ReactNode, parse?: (v: string) => ReportFilters[K]) => (
    <FilterField id={id} label={label}>
      <select id={id} value={String(filters[key])} onChange={(e) => patchFilters({ [key]: parse ? parse(e.target.value) : e.target.value } as Partial<ReportFilters>)}>
        {children}
      </select>
    </FilterField>
  );
  return (
    <FilterPopover title="Report filters" count={chips.length} onReset={resetFilters}>
      {has("period") && sel("fr-preset", "Period", "periodPreset", Object.entries(PRESET_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>))}
      {(has("period") || has("startDate")) && (
        <FilterField id="fr-start" label="Start date">
          <input id="fr-start" type="date" value={filters.startDate} onChange={(e) => patchFilters({ startDate: e.target.value })} />
        </FilterField>
      )}
      {(has("period") || has("endDate")) && (
        <FilterField id="fr-end" label="End date">
          <input id="fr-end" type="date" value={filters.endDate} onChange={(e) => patchFilters({ endDate: e.target.value })} />
        </FilterField>
      )}
      {(has("asOfDate") || definition.defaultAsOf) && (
        <FilterField id="fr-asof" label="As-of date">
          <input id="fr-asof" type="date" value={filters.asOfDate} onChange={(e) => patchFilters({ asOfDate: e.target.value })} />
        </FilterField>
      )}
      {has("fiscalYear") && sel("fr-fy", "Fiscal year", "fiscalYear", <><option value={2025}>2025</option><option value={2026}>2026</option></>, Number)}
      {has("propertyId") && sel("fr-prop", "Property", "propertyId", <><option value="all">All properties</option>{ds.properties.map((p) => <option key={p.propertyId} value={p.propertyId}>{p.propertyName}</option>)}</>)}
      {has("ownerId") && sel("fr-owner", "Owner", "ownerId", <><option value="all">All owners</option>{ds.owners.map((o) => <option key={o.ownerId} value={o.ownerId}>{o.ownerName}</option>)}</>)}
      {has("accountId") && sel("fr-acct", "Account", "accountId", <><option value="all">All accounts</option>{ds.accounts.filter((a) => a.isPostingAccount).map((a) => <option key={a.accountId} value={a.accountId}>{a.accountCode} {a.accountName}</option>)}</>)}
      {has("tenantId") && sel("fr-tenant", "Tenant", "tenantId", <><option value="all">All tenants</option>{ds.tenants.map((t) => <option key={t.tenantId} value={t.tenantId}>{t.tenantName}</option>)}</>)}
      {has("vendorId") && sel("fr-vendor", "Vendor", "vendorId", <><option value="all">All vendors</option>{ds.vendors.map((v) => <option key={v.vendorId} value={v.vendorId}>{v.vendorName}</option>)}</>)}
      {has("bankAccountId") && sel("fr-bank", "Bank account", "bankAccountId", <><option value="all">All bank accounts</option>{ds.bankAccounts.map((b) => <option key={b.bankAccountId} value={b.bankAccountId}>{b.name}</option>)}</>)}
      {has("accountingBasis") && sel("fr-basis", "Accounting basis", "accountingBasis", <><option value="accrual">Accrual</option><option value="cash">Cash</option></>)}
      {has("comparison") && (
        <FilterField id="fr-compare" label="Comparison">
          <select id="fr-compare" value={filters.comparison ? "yes" : "no"} onChange={(e) => patchFilters({ comparison: e.target.value === "yes" })}>
            <option value="yes">Prior period</option>
            <option value="no">Off</option>
          </select>
        </FilterField>
      )}
      {has("transactionType") && sel("fr-txtype", "Transaction type", "transactionType", <><option value="all">All types</option>{SOURCE_TYPES.map((t) => <option key={t} value={t}>{t.replaceAll("_", " ")}</option>)}</>)}
      {has("transactionStatus") && sel("fr-txstatus", "Status", "transactionStatus", <><option value="posted">Posted</option><option value="draft">Draft</option><option value="all">All</option></>)}
      {has("paymentMethod") && sel("fr-paymethod", "Payment method", "paymentMethod", <><option value="all">All methods</option><option value="e-transfer">E-transfer</option><option value="cheque">Cheque</option><option value="pre-authorized">Pre-authorized</option><option value="wire">Wire</option></>)}
    </FilterPopover>
  );
}

export function FilterChips() {
  const { filters, patchFilters } = useReportContext();
  const chips = activeFilterChips(filters, getDataset());
  if (!chips.length) return null;
  return (
    <div className="fr-chips no-print">
      {chips.map((c) => (
        <span className="fr-chip" key={c.key}>
          {c.label}
          <button type="button" aria-label={`Remove ${c.label}`} onClick={() => patchFilters({ [c.key]: "all" } as Partial<ReportFilters>)}><X size={12} /></button>
        </span>
      ))}
    </div>
  );
}
