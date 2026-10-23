// Bank accounts directory in the same format as Properties and Tenants: tabs, search, filters, sortable master rows,
// an expandable detail panel, pagination, and a standard side form. Data comes from the Bank Reconciliation store.
import { Fragment, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CircleDollarSign,
  Download,
  History,
  Landmark,
  MoreHorizontal,
  Pencil,
  Plus,
  Power,
  PowerOff,
  ShieldCheck,
} from "lucide-react";
import { useStore } from "../bankrecon/lib/store";
import { ACCOUNT_TYPES, type BankAccount } from "../bankrecon/lib/types";
import { fmtDate, fmtDateTime, money } from "../bankrecon/lib/format";
import { FilterCheckbox, FilterField, FilterPopover, SearchField, SortControl } from "../shell/directory";
import { Button, DataField, EmptyState, IconButton, Overlay, SectionTitle } from "../tenants/components/ui";
import { BankAccountDrawer } from "./BankAccountDrawer";

type Tab = "all" | "operating" | "trust" | "reserve" | "inactive";
type SortKey = "default" | "name" | "institution" | "balance";

const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "All accounts" },
  { key: "operating", label: "Operating" },
  { key: "trust", label: "Trust" },
  { key: "reserve", label: "Reserve & restricted" },
  { key: "inactive", label: "Inactive" },
];

const COLORS = ["blue", "violet", "teal", "amber", "rose", "slate"] as const;
const initials = (name: string) =>
  name.split(/\s+/).filter((w) => /[a-z0-9]/i.test(w)).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
const colorFor = (s: string) => {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) % 997;
  return COLORS[h % COLORS.length];
};

const matches = (a: BankAccount, t: Tab) =>
  t === "all" ||
  (t === "operating" && a.active && a.accountType === "Operating") ||
  (t === "trust" && a.active && a.accountType === "Trust") ||
  (t === "reserve" && a.active && (a.accountType === "Reserve" || a.accountType === "Restricted")) ||
  (t === "inactive" && !a.active);

function Initials({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  return (
    <span className={`avatar avatar-${size} avatar-${colorFor(name)}`} aria-hidden="true">
      {initials(name) || "B"}
    </span>
  );
}

function AccountStatus({ active }: { active: boolean }) {
  return (
    <span className={`status-badge ${active ? "status-active" : "status-inactive"}`}>
      <span className="status-dot" />
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function AuditDrawer({ account, onClose }: { account: BankAccount; onClose: () => void }) {
  const { state } = useStore();
  const entries = state.audit.filter((e) => e.record === account.id);
  return (
    <Overlay title="Audit history" subtitle={`${account.name} · ${account.code ?? account.id}`} drawer onClose={onClose}>
      <div className="form-scroll">
        <section className="detail-section is-compact">
          <SectionTitle icon={<Landmark size={15} />} title="Account" />
          <dl className="lease-facts">
            <DataField label="Institution">{account.institution || "—"} · {account.maskedAccount || "—"}</DataField>
            <DataField label="Type">{account.accountType}{account.classification ? ` · ${account.classification}` : ""}</DataField>
            <DataField label="Ledger account">{account.glAccount} — {account.glAccountName}</DataField>
            <DataField label="Opening balance">{money(account.openingBalance, account.currency)} <span className="muted">as of {fmtDate(account.openingBalanceDate)}</span></DataField>
          </dl>
        </section>
        <section className="detail-section is-compact" style={{ marginTop: 18 }}>
          <SectionTitle icon={<History size={15} />} title={`Changes (${entries.length})`} />
          {entries.length === 0 ? (
            <EmptyState compact title="No changes recorded" description="Configuration changes to this account will appear here." />
          ) : (
            <div className="people-list">
              {entries.map((e) => (
                <div className="person-item" key={e.id}>
                  <div className="person-content">
                    <div className="person-name-line"><span className="person-name">{e.action}</span></div>
                    <div className="person-relationship"><div className="person-role">{e.user}<span className="dot-separator">&middot;</span>{fmtDateTime(e.at)}</div></div>
                    {(e.before || e.after) && <div className="person-contact-peek"><span>{e.before || "—"} → {e.after || "—"}</span></div>}
                    {e.notes && <div className="person-contact-peek"><span>{e.notes}</span></div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
      <div className="form-footer"><Button onClick={onClose}>Close</Button></div>
    </Overlay>
  );
}

function ExpandedAccount({ a, propertyName, recent, onAudit }: { a: BankAccount; propertyName: string | null; recent: number; onAudit: () => void }) {
  return (
    <div className="expanded-detail">
      <div className="expanded-detail-top">
        <span>ACCOUNT DETAILS</span>
        <button type="button" className="text-link" onClick={onAudit}>View audit history</button>
      </div>
      <div className="expanded-grid">
        <section className="detail-section is-compact">
          <SectionTitle icon={<Landmark size={15} />} title="Account information" />
          <dl className="lease-facts">
            <DataField label="Institution">{a.institution || "—"}</DataField>
            <DataField label="Account number">{a.maskedAccount || "—"}</DataField>
            <DataField label="Type">{a.accountType}</DataField>
            <DataField label="Classification">{a.classification || "—"}</DataField>
            <DataField label="Currency">{a.currency}</DataField>
          </dl>
        </section>
        <section className="detail-section is-compact">
          <SectionTitle icon={<CircleDollarSign size={15} />} title="Accounting" />
          <dl className="lease-facts">
            <DataField label="Ledger account">{a.glAccount}<br /><span className="muted">{a.glAccountName}</span></DataField>
            <DataField label="Opening balance">{money(a.openingBalance, a.currency)}</DataField>
            <DataField label="As of">{fmtDate(a.openingBalanceDate)}</DataField>
          </dl>
        </section>
        <section className="detail-section is-compact">
          <SectionTitle icon={<ShieldCheck size={15} />} title="Usage" />
          <dl className="lease-facts">
            <DataField label="Property">{propertyName ?? "Company account"}</DataField>
            <DataField label="Purpose">{a.purpose || "—"}</DataField>
            <DataField label="Notes">{a.notes || "—"}</DataField>
            <DataField label="Recorded changes">{recent}</DataField>
          </dl>
        </section>
      </div>
    </div>
  );
}

export default function BankAccounts({ notify }: { notify?: (message: string) => void }) {
  const { state, updateAccount, deactivateAccount, can } = useStore();
  const accounts = state.accounts;
  const canEdit = can("create_edit_bank_accounts");

  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [institutionFilter, setInstitutionFilter] = useState("");
  const [propertyFilter, setPropertyFilter] = useState("");
  const [companyOnly, setCompanyOnly] = useState(false);
  const [sort, setSort] = useState<SortKey>("default");
  const [desc, setDesc] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(() =>
    window.matchMedia("(min-width: 1161px)").matches ? accounts[0]?.id ?? null : null,
  );
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);
  const [menu, setMenu] = useState<string | null>(null);
  const [form, setForm] = useState<{ account: BankAccount | null } | null>(null);
  const [audit, setAudit] = useState<BankAccount | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  const propertyName = (id: string | null) => (id ? state.properties.find((p) => p.id === id)?.name ?? id : null);
  const institutions = [...new Set(accounts.map((a) => a.institution).filter(Boolean))].sort();

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    let out = accounts.filter((a) => {
      if (!matches(a, tab)) return false;
      if (typeFilter && a.accountType !== typeFilter) return false;
      if (institutionFilter && a.institution !== institutionFilter) return false;
      if (propertyFilter && a.propertyId !== propertyFilter) return false;
      if (companyOnly && a.propertyId) return false;
      if (!q) return true;
      return [a.code ?? "", a.id, a.name, a.institution, a.maskedAccount, a.glAccount, a.glAccountName, a.classification, propertyName(a.propertyId) ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
    if (sort !== "default") {
      const cmp = {
        name: (a: BankAccount, b: BankAccount) => a.name.localeCompare(b.name),
        institution: (a: BankAccount, b: BankAccount) => a.institution.localeCompare(b.institution),
        balance: (a: BankAccount, b: BankAccount) => a.openingBalance - b.openingBalance,
      }[sort];
      out = [...out].sort(cmp);
      if (desc) out.reverse();
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts, tab, search, typeFilter, institutionFilter, propertyFilter, companyOnly, sort, desc]);

  const activeFilters = Number(!!typeFilter) + Number(!!institutionFilter) + Number(!!propertyFilter) + Number(companyOnly);
  const resetFilters = () => { setTypeFilter(""); setInstitutionFilter(""); setPropertyFilter(""); setCompanyOnly(false); setPage(1); };
  const reset = () => { setTab("all"); setSearch(""); setSort("default"); resetFilters(); };

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginated = rows.slice((safePage - 1) * pageSize, safePage * pageSize);
  const sortBy = (k: SortKey) => {
    if (sort === k) setDesc(!desc);
    else { setSort(k); setDesc(k === "balance"); }
    setPage(1);
  };
  const sortIcon = (k: SortKey) => (sort === k ? (desc ? <ArrowDown size={12} /> : <ArrowUp size={12} />) : <ArrowUpDown size={11} />);
  const ariaSort = (k: SortKey) => (sort === k ? (desc ? "descending" : "ascending") : undefined);

  const deactivate = (a: BankAccount) => {
    setMenu(null);
    const res = deactivateAccount(a.id);
    if (!res.ok) setError(res.error ?? "Unable to deactivate this account.");
    else { setError(null); notify?.(`${a.name} was deactivated.`); }
  };
  const reactivate = (a: BankAccount) => {
    setMenu(null);
    updateAccount(a.id, { active: true });
    notify?.(`${a.name} was reactivated.`);
  };

  const exportCsv = () => {
    const q = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const csv = [
      ["ID", "Account", "Institution", "Account number", "Type", "Classification", "Ledger account", "Currency", "Opening balance", "As of", "Status"],
      ...rows.map((a) => [a.code ?? a.id, a.name, a.institution, a.maskedAccount, a.accountType, a.classification, `${a.glAccount} ${a.glAccountName}`, a.currency, a.openingBalance, a.openingBalanceDate, a.active ? "Active" : "Inactive"]),
    ].map((r) => r.map(q).join(",")).join("\n");
    const el = document.createElement("a");
    el.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    el.download = `bank-accounts-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(el); el.click(); el.remove(); URL.revokeObjectURL(el.href);
    notify?.(`Exported ${rows.length} ${rows.length === 1 ? "account" : "accounts"} to CSV.`);
  };

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="page-title-line"><h1>Banks</h1></div>
          <p>Bank accounts used for payments, deposits and reconciliation.</p>
        </div>
        <div className="page-heading-actions">
          <Button onClick={() => { window.location.hash = "#/bank-reconciliation"; }}>
            <Landmark size={15} />
            Reconciliation
          </Button>
          <Button onClick={exportCsv}>
            <Download size={15} />
            Export
          </Button>
          <Button variant="primary" onClick={() => setForm({ account: null })} disabled={!canEdit} title={canEdit ? undefined : "Requires create/edit permission."}>
            <Plus size={17} />
            Add account
          </Button>
        </div>
      </div>

      <section className="directory-panel" aria-label="Bank account directory">
        <div className="directory-tabs" aria-label="Filter bank accounts">
          {TABS.map((t) => (
            <button
              key={t.key}
              className={`directory-tab ${tab === t.key ? "selected" : ""}`}
              aria-pressed={tab === t.key}
              onClick={() => { setTab(t.key); setPage(1); }}
            >
              {t.label}
              <span>{accounts.filter((a) => matches(a, t.key)).length}</span>
            </button>
          ))}
        </div>
        <div className="directory-toolbar">
          <SearchField label="Search bank accounts" placeholder="Search account, institution, ledger account or property..." value={search} onChange={(v) => { setSearch(v); setPage(1); }} />
          <div className="toolbar-actions">
            <FilterPopover title="Filter accounts" count={activeFilters} onReset={resetFilters}>
              <FilterCheckbox checked={companyOnly} onChange={(v) => { setCompanyOnly(v); setPage(1); }} label="Company accounts only" hint="Not tied to a single property" />
              <FilterField id="bank-type-filter" label="Account type">
                <select id="bank-type-filter" value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}>
                  <option value="">All types</option>
                  {ACCOUNT_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </FilterField>
              <FilterField id="bank-institution-filter" label="Institution">
                <select id="bank-institution-filter" value={institutionFilter} onChange={(e) => { setInstitutionFilter(e.target.value); setPage(1); }}>
                  <option value="">All institutions</option>
                  {institutions.map((i) => <option key={i}>{i}</option>)}
                </select>
              </FilterField>
              <FilterField id="bank-property-filter" label="Property">
                <select id="bank-property-filter" value={propertyFilter} onChange={(e) => { setPropertyFilter(e.target.value); setPage(1); }}>
                  <option value="">All properties</option>
                  {state.properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </FilterField>
            </FilterPopover>
            <SortControl
              label="Sort bank accounts"
              value={sort}
              defaultValue="default"
              descending={desc}
              options={[{ value: "name", label: "Account name" }, { value: "institution", label: "Institution" }, { value: "balance", label: "Opening balance" }]}
              onChange={(k) => { setSort(k as SortKey); setDesc(k === "balance"); setPage(1); }}
              onToggle={() => setDesc(!desc)}
            />
          </div>
        </div>

        {error && (
          <div className="form-error" role="alert" style={{ margin: "12px 16px 0" }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <div className="tenant-table-wrap">
          <table className="tenant-table">
            <caption className="sr-only">Bank account directory. Expand an account to inspect its accounting and usage.</caption>
            <colgroup>
              <col className="col-expand" />
              <col className="col-tenant" />
              <col className="col-email" />
              <col className="col-phone" />
              <col className="col-balance" />
              <col className="col-status" />
              <col className="col-actions" />
            </colgroup>
            <thead>
              <tr>
                <th className="expand-cell"><span className="sr-only">Expand</span></th>
                <th aria-sort={ariaSort("name")}><button onClick={() => sortBy("name")}>Account{sortIcon("name")}</button></th>
                <th className="email-cell" aria-sort={ariaSort("institution")}><button onClick={() => sortBy("institution")}>Institution{sortIcon("institution")}</button></th>
                <th className="phone-cell">Ledger account</th>
                <th className="balance-cell" aria-sort={ariaSort("balance")}><button onClick={() => sortBy("balance")}>Opening balance{sortIcon("balance")}</button></th>
                <th className="status-cell">Status</th>
                <th className="actions-cell">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((a) => {
                const open = expanded === a.id;
                const changes = state.audit.filter((e) => e.record === a.id).length;
                return (
                  <Fragment key={a.id}>
                    <tr className={`tenant-row ${open ? "tenant-row-expanded" : ""}`}>
                      <td className="expand-cell">
                        <IconButton
                          label={`${open ? "Collapse" : "Expand"} ${a.name}`}
                          className="expand-button"
                          onClick={() => setExpanded(open ? null : a.id)}
                          aria-expanded={open}
                          aria-controls={`details-${a.id}`}
                        >
                          <ChevronRight size={15} className={open ? "chevron-expanded" : ""} />
                        </IconButton>
                      </td>
                      <td className="tenant-cell">
                        <div className="tenant-identity">
                          <Initials name={a.name} />
                          <div>
                            <button className="tenant-name" onClick={() => setExpanded(open ? null : a.id)}>{a.name}</button>
                            <span className="tenant-number">{a.code ?? a.id}<span>{a.accountType}</span></span>
                          </div>
                        </div>
                      </td>
                      <td className="email-cell">
                        <a>{a.institution || "—"}</a>
                        <span className="tenant-number">{a.maskedAccount || "—"}</span>
                      </td>
                      <td className="phone-cell">
                        <a>{a.glAccount}</a>
                        <span className="tenant-number">{a.glAccountName}</span>
                      </td>
                      <td className="balance-cell">
                        <span className="balance-value">{money(a.openingBalance, a.currency)}</span>
                        <span className="tenant-number">as of {fmtDate(a.openingBalanceDate)}</span>
                      </td>
                      <td className="status-cell"><AccountStatus active={a.active} /></td>
                      <td className="actions-cell">
                        <div className="row-actions">
                          <IconButton label={`Audit history for ${a.name}`} onClick={() => setAudit(a)}>
                            <History size={15} />
                          </IconButton>
                          <IconButton label={`Edit ${a.name}`} onClick={() => setForm({ account: a })} disabled={!canEdit}>
                            <Pencil size={14} />
                          </IconButton>
                          <div className="row-more-anchor" data-row-menu>
                            <IconButton label={`More actions for ${a.name}`} onClick={() => setMenu(menu === a.id ? null : a.id)} aria-expanded={menu === a.id}>
                              <MoreHorizontal size={17} />
                            </IconButton>
                            {menu === a.id && (
                              <div className="row-menu">
                                <button onClick={() => { setForm({ account: a }); setMenu(null); }} disabled={!canEdit}>
                                  <Pencil size={14} />
                                  Edit account
                                </button>
                                <button onClick={() => { setAudit(a); setMenu(null); }}>
                                  <History size={14} />
                                  Audit history
                                </button>
                                <div className="menu-divider" />
                                {a.active ? (
                                  <button onClick={() => deactivate(a)} disabled={!canEdit}>
                                    <PowerOff size={14} />
                                    Deactivate
                                  </button>
                                ) : (
                                  <button onClick={() => reactivate(a)} disabled={!canEdit}>
                                    <Power size={14} />
                                    Reactivate
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                    {open && (
                      <tr className="detail-row" id={`details-${a.id}`}>
                        <td colSpan={7}>
                          <ExpandedAccount a={a} propertyName={propertyName(a.propertyId)} recent={changes} onAudit={() => setAudit(a)} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        {!paginated.length && (
          <EmptyState
            title={accounts.length ? "No bank accounts found" : "Your bank accounts start here"}
            description={accounts.length ? "Try a different search or adjust your filters." : "Add your first bank account to start recording deposits and reconciling statements."}
            action={<Button onClick={accounts.length ? reset : () => setForm({ account: null })}>{accounts.length ? "Clear search & filters" : "Add your first account"}</Button>}
          />
        )}
        <div className="table-pagination">
          <p>
            Showing <strong>{rows.length ? (safePage - 1) * pageSize + 1 : 0}-{Math.min(safePage * pageSize, rows.length)}</strong> of <strong>{rows.length}</strong> accounts
          </p>
          <div className="pagination-controls">
            <label className="page-size">
              <span>Rows per page</span>
              <select aria-label="Rows per page" value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>
                <option value={8}>8</option>
                <option value={16}>16</option>
                <option value={24}>24</option>
              </select>
            </label>
            <div className="pagination-buttons">
              <IconButton className="first-page" label="First page" disabled={safePage === 1} onClick={() => setPage(1)}><ChevronsLeft size={15} /></IconButton>
              <IconButton label="Previous page" disabled={safePage === 1} onClick={() => setPage(safePage - 1)}><ChevronLeft size={15} /></IconButton>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((n) => totalPages <= 5 || Math.abs(n - safePage) <= 1 || n === 1 || n === totalPages)
                .map((n, i, arr) => (
                  <Fragment key={n}>
                    {i > 0 && n - arr[i - 1] > 1 && <span className="pagination-ellipsis">...</span>}
                    <button className={`page-number ${safePage === n ? "selected" : ""}`} aria-label={`Page ${n}`} aria-current={safePage === n ? "page" : undefined} onClick={() => setPage(n)}>
                      {n}
                    </button>
                  </Fragment>
                ))}
              <IconButton label="Next page" disabled={safePage === totalPages} onClick={() => setPage(safePage + 1)}><ChevronRight size={15} /></IconButton>
              <IconButton className="last-page" label="Last page" disabled={safePage === totalPages} onClick={() => setPage(totalPages)}><ChevronsRight size={15} /></IconButton>
            </div>
          </div>
        </div>
      </section>
      <div className="directory-footnote">
        <span>
          <ShieldCheck size={13} />
          Account numbers are masked. No online banking credentials are stored.
        </span>
        <span>Shared with Bank Reconciliation</span>
      </div>

      {form && <BankAccountDrawer key={form.account?.id ?? "new"} account={form.account} onClose={() => setForm(null)} onSaved={(m) => notify?.(m)} />}
      {audit && <AuditDrawer account={audit} onClose={() => setAudit(null)} />}
    </>
  );
}
