import { Fragment, useEffect, useRef, useState, type RefObject } from "react";
import {
  Archive,
  ArrowDown,
  ArrowDownUp,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CircleDollarSign,
  Eye,
  MoreHorizontal,
  Pencil,
  Search,
  SlidersHorizontal,
  Users,
  X,
} from "lucide-react";
import type { Database, Tenant, TenantStatus } from "../types";
import {
  currentTenantUnits,
  fullName,
  money,
  tenantFinancials,
  type DirectoryFilters,
} from "../lib/domain";
import { Avatar, Button, EmptyState, IconButton, StatusBadge } from "./ui";
import { ExpandedDetail, type DetailActions } from "./TenantDetails";

export function DirectoryControls({
  db,
  filters,
  onChange,
  searchRef,
}: {
  db: Database;
  filters: DirectoryFilters;
  onChange: (filters: DirectoryFilters) => void;
  searchRef: RefObject<HTMLInputElement | null>;
}) {
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const activeFilters =
    Number(filters.outstanding) +
    Number(filters.expiring) +
    Number(filters.includeArchived) +
    Number(!!filters.propertyId);
  useEffect(() => {
    if (!filterOpen) return;
    const close = (event: MouseEvent) => {
      if (!filterRef.current?.contains(event.target as Node))
        setFilterOpen(false);
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFilterOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", key);
    };
  }, [filterOpen]);
  const statuses: ("All Tenants" | TenantStatus)[] = [
    "All Tenants",
    "Active",
    "Pending",
    "Inactive",
    "Former",
  ];
  return (
    <>
      <div className="directory-tabs" aria-label="Filter tenants by status">
        {statuses.map((status) => {
          const count = db.tenants.filter(
            (t) =>
              (!t.archivedAt || filters.includeArchived) &&
              (status === "All Tenants" || t.tenantStatus === status),
          ).length;
          return (
            <button
              key={status}
              className={`directory-tab ${filters.status === status ? "selected" : ""}`}
              onClick={() => onChange({ ...filters, status })}
              aria-pressed={filters.status === status}
            >
              {status === "All Tenants" ? "All tenants" : status}
              <span>{count}</span>
            </button>
          );
        })}
        <div className="directory-tabs-end">
          <span className="live-dot" />
          Live directory
        </div>
      </div>
      <div className="directory-toolbar">
        <div className="search-field">
          <Search size={17} />
          <input
            ref={searchRef}
            aria-label="Search tenants"
            placeholder="Search name, email, property or unit..."
            value={filters.search}
            onChange={(e) => onChange({ ...filters, search: e.target.value })}
          />
          {filters.search ? (
            <IconButton
              label="Clear search"
              onClick={() => onChange({ ...filters, search: "" })}
            >
              <X size={14} />
            </IconButton>
          ) : (
            <kbd>/</kbd>
          )}
        </div>
        <div className="toolbar-actions">
          <div className="filter-anchor" ref={filterRef}>
            <Button
              className={activeFilters ? "filters-active" : ""}
              aria-expanded={filterOpen}
              onClick={() => setFilterOpen(!filterOpen)}
            >
              <SlidersHorizontal size={15} />
              Filters
              {activeFilters > 0 && (
                <span className="filter-count">{activeFilters}</span>
              )}
              <ChevronDown size={13} />
            </Button>
            {filterOpen && (
              <div className="filter-popover">
                <div className="popover-title">
                  Filter tenants
                  <button
                    onClick={() =>
                      onChange({
                        ...filters,
                        outstanding: false,
                        expiring: false,
                        includeArchived: false,
                        propertyId: "",
                      })
                    }
                  >
                    Reset
                  </button>
                </div>
                <label className="filter-checkbox">
                  <input
                    type="checkbox"
                    checked={filters.outstanding}
                    onChange={(e) =>
                      onChange({ ...filters, outstanding: e.target.checked })
                    }
                  />
                  <span>
                    Outstanding balance
                    <small>Accounts with an unpaid balance</small>
                  </span>
                </label>
                <label className="filter-checkbox">
                  <input
                    type="checkbox"
                    checked={filters.expiring}
                    onChange={(e) =>
                      onChange({ ...filters, expiring: e.target.checked })
                    }
                  />
                  <span>
                    Expiring leases
                    <small>Within the next {filters.warningDays} days</small>
                  </span>
                </label>
                <div className="popover-field">
                  <label htmlFor="property-filter">Property</label>
                  <select
                    id="property-filter"
                    value={filters.propertyId}
                    onChange={(e) =>
                      onChange({ ...filters, propertyId: e.target.value })
                    }
                  >
                    <option value="">All properties</option>
                    {db.properties.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <label className="filter-checkbox archived-checkbox">
                  <input
                    type="checkbox"
                    checked={filters.includeArchived}
                    onChange={(e) =>
                      onChange({
                        ...filters,
                        includeArchived: e.target.checked,
                      })
                    }
                  />
                  <span>
                    Include archived tenants
                    <small>Historical records remain available</small>
                  </span>
                </label>
                <Button
                  variant="primary"
                  className="apply-filters"
                  onClick={() => setFilterOpen(false)}
                >
                  Show results
                </Button>
              </div>
            )}
          </div>
          <label className="sort-control">
            <ArrowDownUp size={15} />
            <span className="sr-only">Sort tenants</span>
            <select
              aria-label="Sort tenants"
              value={filters.sort}
              onChange={(e) =>
                onChange({
                  ...filters,
                  sort: e.target.value as DirectoryFilters["sort"],
                  descending: ["balance", "units"].includes(e.target.value),
                })
              }
            >
              <option value="default">Sort by</option>
              <option value="name">Tenant name</option>
              <option value="balance">Balance</option>
              <option value="units">Number of units</option>
              <option value="expiry">Lease expiry</option>
            </select>
            <ChevronDown size={13} />
          </label>
          {filters.sort !== "default" && (
            <IconButton
              className="sort-direction"
              label={filters.descending ? "Sort ascending" : "Sort descending"}
              onClick={() =>
                onChange({ ...filters, descending: !filters.descending })
              }
            >
              {filters.descending ? (
                <ArrowDown size={16} />
              ) : (
                <ArrowUp size={16} />
              )}
            </IconButton>
          )}
        </div>
      </div>
    </>
  );
}

interface RowProps {
  db: Database;
  tenant: Tenant;
  expanded: boolean;
  onExpand: () => void;
  actions: DetailActions;
  onEdit: (tenantId: string) => void;
  onArchive: (tenantId: string) => void;
  menuOpen: boolean;
  setMenuOpen: (value: boolean) => void;
}

export function TenantMasterRow({
  db,
  tenant,
  expanded,
  onExpand,
  actions,
  onEdit,
  onArchive,
  menuOpen,
  setMenuOpen,
}: RowProps) {
  const financials = tenantFinancials(db, tenant.id);
  const units = currentTenantUnits(db, tenant.id);
  return (
    <tr
      className={`tenant-row ${expanded ? "tenant-row-expanded" : ""} ${tenant.archivedAt ? "tenant-archived" : ""}`}
    >
      <td className="expand-cell">
        <IconButton
          label={`${expanded ? "Collapse" : "Expand"} ${fullName(tenant)}`}
          className="expand-button"
          onClick={onExpand}
          aria-expanded={expanded}
          aria-controls={`details-${tenant.id}`}
        >
          <ChevronRight
            size={15}
            className={expanded ? "chevron-expanded" : ""}
          />
        </IconButton>
      </td>
      <td className="tenant-cell">
        <div className="tenant-identity">
          <Avatar tenant={tenant} />
          <div>
            <button
              className="tenant-name"
              onClick={() => actions.onProfile(tenant.id)}
            >
              {fullName(tenant)}
            </button>
            <span className="tenant-number">
              {tenant.tenantNumber}
              {tenant.archivedAt && <span>Archived</span>}
            </span>
          </div>
        </div>
      </td>
      <td className="phone-cell">
        <a href={`tel:${tenant.phone.replace(/[^+\d]/g, "")}`}>
          {tenant.phone}
        </a>
      </td>
      <td className="email-cell">
        <a href={`mailto:${tenant.email}`} title={tenant.email}>
          {tenant.email}
        </a>
      </td>
      <td className="units-cell">
        <span className={`unit-count ${units.length ? "" : "muted"}`}>
          {units.length.toString().padStart(2, "0")}
        </span>
      </td>
      <td className="balance-cell">
        <span
          className={`balance-value ${financials.outstanding > 0 ? (financials.oldestOverdueDays > 30 ? "red-text" : "amber-text") : "zero-balance"}`}
        >
          {money(financials.outstanding)}
        </span>
        {financials.oldestOverdueDays > 30 && (
          <span className="overdue-label">
            {financials.oldestOverdueDays} days overdue
          </span>
        )}
      </td>
      <td className="status-cell">
        <StatusBadge status={tenant.tenantStatus} />
      </td>
      <td className="actions-cell">
        <div className="row-actions">
          <IconButton
            label={`View ${fullName(tenant)}`}
            onClick={() => actions.onProfile(tenant.id)}
          >
            <Eye size={15} />
          </IconButton>
          <IconButton
            label={`Edit ${fullName(tenant)}`}
            onClick={() => onEdit(tenant.id)}
          >
            <Pencil size={14} />
          </IconButton>
          <div className="row-more-anchor" data-row-menu>
            <IconButton
              label={`More actions for ${fullName(tenant)}`}
              onClick={() => setMenuOpen(!menuOpen)}
              aria-expanded={menuOpen}
            >
              <MoreHorizontal size={17} />
            </IconButton>
            {menuOpen && (
              <div className="row-menu">
                <button
                  onClick={() => {
                    actions.onProfile(tenant.id);
                    setMenuOpen(false);
                  }}
                >
                  <Eye size={14} />
                  View profile
                </button>
                <button
                  onClick={() => {
                    actions.onProfile(tenant.id, "Financial ledger");
                    setMenuOpen(false);
                  }}
                >
                  <CircleDollarSign size={14} />
                  Financial ledger
                </button>
                <button
                  onClick={() => {
                    actions.onAddPerson(tenant.id);
                    setMenuOpen(false);
                  }}
                >
                  <Users size={14} />
                  Add person
                </button>
                <div className="menu-divider" />
                <button
                  className={tenant.archivedAt ? "" : "danger-menu-item"}
                  onClick={() => {
                    onArchive(tenant.id);
                    setMenuOpen(false);
                  }}
                >
                  <Archive size={14} />
                  {tenant.archivedAt ? "Restore tenant" : "Archive tenant"}
                </button>
              </div>
            )}
          </div>
        </div>
      </td>
    </tr>
  );
}

export function TenantTable({
  db,
  tenants,
  expandedId,
  onExpand,
  actions,
  onEdit,
  onArchive,
  filters,
  onSort,
  page,
  pageSize,
  onPage,
  onPageSize,
  onReset,
  onAdd,
}: {
  db: Database;
  tenants: Tenant[];
  expandedId: string | null;
  onExpand: (id: string) => void;
  actions: DetailActions;
  onEdit: (id: string) => void;
  onArchive: (id: string) => void;
  filters: DirectoryFilters;
  onSort: (sort: DirectoryFilters["sort"]) => void;
  page: number;
  pageSize: number;
  onPage: (page: number) => void;
  onPageSize: (size: number) => void;
  onReset: () => void;
  onAdd: () => void;
}) {
  const [menuId, setMenuId] = useState<string | null>(null);
  const totalPages = Math.max(1, Math.ceil(tenants.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginated = tenants.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize,
  );
  useEffect(() => {
    if (!menuId) return;
    const close = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest("[data-row-menu]"))
        setMenuId(null);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuId(null);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", key);
    };
  }, [menuId]);
  const sortIcon = (sort: DirectoryFilters["sort"]) =>
    filters.sort === sort ? (
      filters.descending ? (
        <ArrowDown size={12} />
      ) : (
        <ArrowUp size={12} />
      )
    ) : (
      <ArrowUpDown size={11} />
    );
  return (
    <>
      <div className="tenant-table-wrap">
        <table className="tenant-table">
          <caption className="sr-only">
            Tenant directory. Expand a tenant to inspect their leases, units,
            household, and account balances.
          </caption>
          <colgroup>
            <col className="col-expand" />
            <col className="col-tenant" />
            <col className="col-phone" />
            <col className="col-email" />
            <col className="col-units" />
            <col className="col-balance" />
            <col className="col-status" />
            <col className="col-actions" />
          </colgroup>
          <thead>
            <tr>
              <th className="expand-cell">
                <span className="sr-only">Expand</span>
              </th>
              <th
                aria-sort={
                  filters.sort === "name"
                    ? filters.descending
                      ? "descending"
                      : "ascending"
                    : undefined
                }
              >
                <button onClick={() => onSort("name")}>
                  Tenant{sortIcon("name")}
                </button>
              </th>
              <th className="phone-cell">Phone number</th>
              <th className="email-cell">Email address</th>
              <th
                className="units-cell"
                aria-sort={
                  filters.sort === "units"
                    ? filters.descending
                      ? "descending"
                      : "ascending"
                    : undefined
                }
              >
                <button onClick={() => onSort("units")}>
                  Units{sortIcon("units")}
                </button>
              </th>
              <th
                className="balance-cell"
                aria-sort={
                  filters.sort === "balance"
                    ? filters.descending
                      ? "descending"
                      : "ascending"
                    : undefined
                }
              >
                <button onClick={() => onSort("balance")}>
                  Balance{sortIcon("balance")}
                </button>
              </th>
              <th className="status-cell">Status</th>
              <th className="actions-cell">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginated.map((tenant) => (
              <Fragment key={tenant.id}>
                <TenantMasterRow
                  db={db}
                  tenant={tenant}
                  expanded={expandedId === tenant.id}
                  onExpand={() => onExpand(tenant.id)}
                  actions={actions}
                  onEdit={onEdit}
                  onArchive={onArchive}
                  menuOpen={menuId === tenant.id}
                  setMenuOpen={(open) => setMenuId(open ? tenant.id : null)}
                />
                {expandedId === tenant.id && (
                  <tr className="detail-row" id={`details-${tenant.id}`}>
                    <td colSpan={8}>
                      <ExpandedDetail
                        db={db}
                        tenant={tenant}
                        actions={actions}
                        warningDays={filters.warningDays}
                      />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      {!paginated.length && (
        <EmptyState
          title={
            db.tenants.length
              ? "No tenants found"
              : "Your tenant directory starts here"
          }
          description={
            db.tenants.length
              ? "Try a different search or adjust your filters."
              : "Add your first tenant to start managing their tenancy."
          }
          action={
            <Button onClick={db.tenants.length ? onReset : onAdd}>
              {db.tenants.length
                ? "Clear search & filters"
                : "Add your first tenant"}
            </Button>
          }
        />
      )}
      <div className="table-pagination">
        <p>
          Showing{" "}
          <strong>
            {tenants.length ? (safePage - 1) * pageSize + 1 : 0}-
            {Math.min(safePage * pageSize, tenants.length)}
          </strong>{" "}
          of <strong>{tenants.length}</strong> tenants
        </p>
        <div className="pagination-controls">
          <label className="page-size">
            <span>Rows per page</span>
            <select
              aria-label="Rows per page"
              value={pageSize}
              onChange={(e) => onPageSize(Number(e.target.value))}
            >
              <option value={8}>8</option>
              <option value={16}>16</option>
              <option value={24}>24</option>
            </select>
          </label>
          <div className="pagination-buttons">
            <IconButton
              className="first-page"
              label="First page"
              disabled={safePage === 1}
              onClick={() => onPage(1)}
            >
              <ChevronsLeft size={15} />
            </IconButton>
            <IconButton
              label="Previous page"
              disabled={safePage === 1}
              onClick={() => onPage(safePage - 1)}
            >
              <ChevronLeft size={15} />
            </IconButton>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(
                (n) =>
                  totalPages <= 5 ||
                  Math.abs(n - safePage) <= 1 ||
                  n === 1 ||
                  n === totalPages,
              )
              .map((n, i, arr) => (
                <Fragment key={n}>
                  {i > 0 && n - arr[i - 1] > 1 && (
                    <span className="pagination-ellipsis">...</span>
                  )}
                  <button
                    className={`page-number ${safePage === n ? "selected" : ""}`}
                    aria-label={`Page ${n}`}
                    aria-current={safePage === n ? "page" : undefined}
                    onClick={() => onPage(n)}
                  >
                    {n}
                  </button>
                </Fragment>
              ))}
            <IconButton
              label="Next page"
              disabled={safePage === totalPages}
              onClick={() => onPage(safePage + 1)}
            >
              <ChevronRight size={15} />
            </IconButton>
            <IconButton
              className="last-page"
              label="Last page"
              disabled={safePage === totalPages}
              onClick={() => onPage(totalPages)}
            >
              <ChevronsRight size={15} />
            </IconButton>
          </div>
        </div>
      </div>
    </>
  );
}
