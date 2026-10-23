import { isSupabaseConfigured } from "../lib/supabase";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Printer } from "lucide-react";
import { Button as TnButton } from "../tenants/components/ui";
import { getDataset, getReportDefinition, SYS } from "./lib/data";
import { getFinancialReport } from "./lib/services";
import type { ReportRow } from "./lib/types";
import { formatMoney } from "./lib/utils/currency";
import { downloadCsv, printReport } from "./lib/utils/export";
import { ReportCharts } from "./Charts";
import { Drilldown, type DrillState } from "./Drilldown";
import { FilterChips, ReportFilterPopover } from "./FiltersBar";
import { useReportContext } from "./ReportProvider";
import { go } from "./nav";

export function ReportView({ reportId }: { reportId: string }) {
  const definition = getReportDefinition(reportId);
  const { filters, patchFilters, budgetOverrides, matchOverrides, toggleMatch, markUsed } = useReportContext();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [drill, setDrill] = useState<DrillState | null>(null);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const ds = getDataset();

  const result = useMemo(
    () => getFinancialReport(reportId, filters, { budgetOverrides, matchOverrides }),
    [reportId, filters, budgetOverrides, matchOverrides],
  );

  if (!definition) {
    return (
      <div className="tn fr">
        <div className="app-shell"><div className="main-shell"><main className="main-content">
          <div className="page-heading">
            <div><h1>Unknown report</h1><p>That report is not in the catalog.</p></div>
            <div className="page-heading-actions"><TnButton onClick={() => go()}><ChevronLeft size={15} />Financial Reports</TnButton></div>
          </div>
        </main></div></div>
      </div>
    );
  }

  const open = (id: string) => { markUsed(id); go(id); };

  const onRowClick = (row: ReportRow) => {
    if (row.accountId && (reportId === "profit-and-loss" || reportId === "balance-sheet" || reportId === "trial-balance")) {
      patchFilters({ accountId: row.accountId });
      open("account-activity");
      return;
    }
    if (row.propertyId && (reportId === "income-expense-by-property" || reportId === "noi-by-property" || reportId === "property-profitability")) {
      patchFilters({ propertyId: row.propertyId });
      open("profit-and-loss");
      return;
    }
    if (row.sourceType === "journal" && row.sourceId) setDrill({ kind: "journal", id: row.sourceId });
    else if (row.sourceType === "invoice" && row.sourceId) setDrill({ kind: "invoice", id: row.sourceId });
    else if (row.sourceType === "payment" && row.sourceId) setDrill({ kind: "payment", id: row.sourceId });
    else if (row.sourceType === "bill" && row.sourceId) setDrill({ kind: "bill", id: row.sourceId });
    else if (row.sourceType === "report" && row.sourceId) open(row.sourceId);
    else if (row.expandable) setExpanded((s) => ({ ...s, [row.id]: !s[row.id] }));
  };

  const visibleRows: ReportRow[] = [];
  result.rows.forEach((row) => {
    visibleRows.push(row);
    if (row.children && expanded[row.id]) visibleRows.push(...row.children);
  });

  const sorted = sortKey
    ? [...visibleRows].sort((a, b) => {
        const av = Number(a.meta?.[sortKey] ?? (sortKey === "amount" ? a.amount : 0));
        const bv = Number(b.meta?.[sortKey] ?? (sortKey === "amount" ? b.amount : 0));
        return sortDir === "asc" ? av - bv : bv - av;
      })
    : visibleRows;

  return (
    <div className="tn fr">
      <div className="app-shell">
        <div className="main-shell">
          <main className="main-content">
            <div className="page-heading">
              <div>
                <div className="page-title-line">
                  <h1>{definition.name}</h1>
                </div>
                <p>{definition.description}</p>
              </div>
              <div className="page-heading-actions no-print">
                <TnButton onClick={() => go()}><ChevronLeft size={15} />Financial Reports</TnButton>
                <TnButton onClick={() => downloadCsv(result)}><Download size={15} />CSV</TnButton>
                <TnButton variant="primary" onClick={printReport}><Printer size={15} />Print / PDF</TnButton>
              </div>
            </div>

            <section className="directory-panel" aria-label={`${definition.name} report`}>
              <div className="directory-toolbar no-print">
                <span className="fr-period">{result.periodLabel}{result.basisLabel && !definition.defaultAsOf ? ` · ${result.basisLabel}` : ""}</span>
                <div className="toolbar-actions">
                  <ReportFilterPopover definition={definition} />
                </div>
              </div>
              <FilterChips />

              {definition.availability !== "available" && (
                <p className="fr-note"><strong>Available with limitations.</strong> {definition.availabilityNote}</p>
              )}

              <ReportCharts
                charts={result.charts}
                onSelect={(label) => {
                  const prop = ds.properties.find((p) => p.propertyCode === label || p.propertyName === label);
                  if (prop) patchFilters({ propertyId: prop.propertyId });
                }}
              />

              {reportId === "budget-vs-actual" && <BudgetEditor />}
              {reportId === "bank-reconciliation" && <BankMatchPanel matchOverrides={matchOverrides} toggleMatch={toggleMatch} />}
              {reportId === "year-end-package" && <YearEndLinks onOpen={open} />}

              <article className="fr-sheet">
                <header className="fr-head">
                  <h2>{result.title}</h2>
                  <p>{result.companyName}</p>
                  <p>{result.propertyLabel}</p>
                  <p>{result.periodLabel}</p>
                  {result.basisLabel && !definition.defaultAsOf ? <p>{result.basisLabel}</p> : null}
                  <p>Generated {new Date(result.generatedAt).toLocaleString("en-CA")}</p>
                </header>

                {sorted.length === 0 ? (
                  <div className="fr-empty">No records match the selected filters.</div>
                ) : (
                  <div className="fr-scroll">
                    <table className="fin">
                      <thead>
                        <tr>
                          {result.columns.map((col) => {
                            const sortable = col.format === "money" || col.key === "amount";
                            return (
                              <th
                                key={col.key}
                                className={`${col.align === "right" ? "num" : ""} ${sortable ? "sortable" : ""}`}
                                onClick={() => {
                                  if (!sortable) return;
                                  setSortKey(col.key);
                                  setSortDir((d) => (sortKey === col.key && d === "desc" ? "asc" : "desc"));
                                }}
                              >
                                {col.label}
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {sorted.map((row) => {
                          const cls = row.isGrandTotal ? "grand" : row.isTotal ? "total" : row.isSection ? "section" : "";
                          const clickable = Boolean(row.accountId || row.sourceId || row.propertyId || row.expandable);
                          return (
                            <tr key={row.id} className={`${cls} ${clickable ? "clickable" : ""}`} onClick={() => onRowClick(row)}>
                              {result.columns.map((col) => {
                                if (col.key === "label") {
                                  return (
                                    <td key={col.key} className={`indent-${row.indent}`}>
                                      {row.expandable && <ChevronRight size={14} className={`chev ${expanded[row.id] ? "open" : ""}`} />}{" "}
                                      {row.label}
                                    </td>
                                  );
                                }
                                if (col.key === "amount") return <td key={col.key} className={`num ${row.amount < 0 ? "neg" : ""}`}>{row.isSection ? "" : formatMoney(row.amount)}</td>;
                                if (col.key === "priorAmount") return <td key={col.key} className="num">{row.isSection ? "" : row.priorAmount == null ? "—" : formatMoney(row.priorAmount)}</td>;
                                if (col.key === "accountCode") return <td key={col.key}>{row.accountCode ?? row.meta?.accountCode ?? ""}</td>;
                                const raw = row.meta?.[col.key];
                                if (col.format === "money" && typeof raw === "number") return <td key={col.key} className="num">{formatMoney(raw)}</td>;
                                if (col.key === "status" && raw === "favorable") return <td key={col.key} className="fav">Favorable</td>;
                                if (col.key === "status" && raw === "unfavorable") return <td key={col.key} className="unfav">Unfavorable</td>;
                                return <td key={col.key} className={col.align === "right" ? "num" : ""}>{raw === null || raw === undefined ? "" : String(raw)}</td>;
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                <ul className="fr-notes">
                  {result.notes.map((n) => <li key={n}>{n}</li>)}
                  <li>Amounts in CAD. Negative amounts are shown in parentheses.</li>
                  {result.recordCount != null && <li>Records: {result.recordCount}</li>}
                </ul>
              </article>
            </section>

            <div className="directory-footnote no-print">
              <span>Mock ledger data generated in the browser. Budget edits and bank matches are kept for this session only.</span>
            </div>
          </main>
        </div>
      </div>
      <Drilldown drill={drill} onClose={() => setDrill(null)} onOpen={setDrill} />
    </div>
  );
}

const YEAR_END = ["profit-and-loss", "balance-sheet", "cash-flow", "trial-balance", "general-ledger", "ar-aging", "ap-aging", "security-deposit-register", "income-expense-by-property", "gst-hst-summary"];

function YearEndLinks({ onOpen }: { onOpen: (id: string) => void }) {
  return (
    <div className="fr-block no-print">
      <strong>Package index</strong>
      <p>Open each statement or use Print / PDF for a combined printout. This package is not audited.</p>
      <div className="fr-links">
        {YEAR_END.map((id) => (
          <button key={id} type="button" className="fr-link" style={{ marginTop: 0 }} onClick={() => onOpen(id)}>{id.replaceAll("-", " ")}</button>
        ))}
      </div>
    </div>
  );
}

function BudgetEditor() {
  const { filters, budgetOverrides, setBudgetAmount } = useReportContext();
  const ds = getDataset();
  const [accountId, setAccountId] = useState(SYS.rent);
  const [propertyId, setPropertyId] = useState(ds.properties[0].propertyId);
  const [amount, setAmount] = useState("0");
  return (
    <form
      className="fr-tools no-print"
      onSubmit={(e) => {
        e.preventDefault();
        setBudgetAmount({
          budgetId: `override-${propertyId}-${accountId}`,
          fiscalYear: filters.fiscalYear,
          period: "annual",
          month: null,
          propertyId,
          accountId,
          budgetAmount: Number(amount) || 0,
        });
      }}
    >
      <div className="fr-f">
        <label htmlFor="fr-bud-prop">Edit mock budget — property</label>
        <select id="fr-bud-prop" value={propertyId} onChange={(e) => setPropertyId(e.target.value)}>
          {ds.properties.map((p) => <option key={p.propertyId} value={p.propertyId}>{p.propertyName}</option>)}
        </select>
      </div>
      <div className="fr-f">
        <label htmlFor="fr-bud-acct">Account</label>
        <select id="fr-bud-acct" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          {ds.accounts.filter((a) => a.accountType === "revenue" || a.accountType === "expense").map((a) => (
            <option key={a.accountId} value={a.accountId}>{a.accountCode} {a.accountName}</option>
          ))}
        </select>
      </div>
      <div className="fr-f">
        <label htmlFor="fr-bud-amt">Annual budget (CAD)</label>
        <input id="fr-bud-amt" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />
      </div>
      <TnButton variant="primary" type="submit">Save budget line</TnButton>
      <span className="fr-tools-hint">{budgetOverrides.length} override(s) in this session</span>
    </form>
  );
}

function BankMatchPanel({ matchOverrides, toggleMatch }: { matchOverrides: Record<string, boolean>; toggleMatch: (id: string, matched: boolean) => void }) {
  const ds = getDataset();
  const statement = isSupabaseConfigured ? ds.bankStatements[ds.bankStatements.length - 1] : undefined;
  const txns = ds.bankTxns.filter((t) => t.statementId === (isSupabaseConfigured ? statement?.statementId : "STMT-OP-2026-02")).slice(0, 12);
  return (
    <div className="fr-block no-print">
      <strong>Reconciliation workspace</strong>
      <p>{isSupabaseConfigured ? (statement ? `Latest statement period ${statement.periodStart} to ${statement.periodEnd}. Toggle match status here to preview; reconcile in Bank Reconciliation.` : "No bank statements imported yet. Import them in Bank Reconciliation.") : "Sample statement for RBC Operating — February 2026. Toggle match status; unmatched items remain reconciling items."}</p>
      <div className="fr-scroll">
        <table className="fin">
          <thead><tr><th>Date</th><th>Description</th><th className="num">Amount</th><th>Matched</th></tr></thead>
          <tbody>
            {txns.map((t) => {
              const matched = t.bankTxnId in matchOverrides ? matchOverrides[t.bankTxnId] : t.defaultMatched;
              return (
                <tr key={t.bankTxnId}>
                  <td>{t.txnDate}</td>
                  <td>{t.description}</td>
                  <td className="num">{formatMoney(t.amount)}</td>
                  <td><button type="button" className="fr-link" style={{ marginTop: 0 }} onClick={() => toggleMatch(t.bankTxnId, !matched)}>{matched ? "Matched" : "Unmatched"}</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
