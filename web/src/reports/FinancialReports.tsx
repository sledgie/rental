import { useEffect, useMemo, useState } from "react";
import { ArrowRight, FileBarChart } from "lucide-react";
import { Button as TnButton, EmptyState } from "../tenants/components/ui";
import { SearchField } from "../shell/directory";
import { REPORT_CATALOG, REPORT_CATEGORIES } from "./lib/data/catalog";
import { getDataset } from "./lib/data";
import { getKpis } from "./lib/services";
import type { ReportDefinition } from "./lib/types";
import { formatMoney, formatPercent } from "./lib/utils/currency";
import { ReportFilterPopover, FilterChips } from "./FiltersBar";
import { ReportProvider, useReportContext } from "./ReportProvider";
import { ReportView } from "./ReportView";
import { go } from "./nav";
import "./reports.css";

function Change({ value }: { value: number | null }) {
  if (value === null) return <span className="fr-delta flat">No comparison</span>;
  const up = value >= 0;
  return <span className={`fr-delta ${up ? "up" : "down"}`}>{up ? "▲" : "▼"} {formatPercent(Math.abs(value))}</span>;
}

const availabilityOf = (a: string) =>
  a === "available" ? { cls: "available", text: "Available" } : a === "planned" ? { cls: "planned", text: "Planned" } : { cls: "limited", text: "Available with limitations" };

// The catalog only needs the period, property and basis filters that drive the headline figures.
const CATALOG_DEFINITION: ReportDefinition = {
  reportId: "catalog",
  name: "Catalog",
  description: "",
  categoryId: "financial-performance",
  availability: "available",
  filters: ["period", "propertyId", "accountingBasis"],
  priority: 0,
};

function Catalog() {
  const { filters, recentlyUsed, markUsed } = useReportContext();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const ds = getDataset();
  const kpis = useMemo(() => getKpis(filters, ds), [filters, ds]);

  const reports = useMemo(() => {
    const q = query.trim().toLowerCase();
    return REPORT_CATALOG.filter((r) => (category === "all" || r.categoryId === category) && (!q || r.name.toLowerCase().includes(q) || r.description.toLowerCase().includes(q)));
  }, [query, category]);

  const open = (id: string) => { markUsed(id); go(id); };
  const countFor = (id: string) => REPORT_CATALOG.filter((r) => id === "all" || r.categoryId === id).length;

  return (
    <div className="tn fr">
      <div className="app-shell">
        <div className="main-shell">
          <main className="main-content">
            <div className="page-heading">
              <div>
                <div className="page-title-line">
                  <h1>Financial Reports</h1>
                  <span className="muted">{REPORT_CATALOG.length} reports</span>
                </div>
                <p>Analyze financial performance, cash flow, receivables, payables and property-level profitability.</p>
              </div>
              <div className="page-heading-actions">
                <TnButton variant="primary" onClick={() => open("profit-and-loss")}><FileBarChart size={16} />Generate report</TnButton>
              </div>
            </div>

            <div className="fr-kpis">
              {kpis.map((k) => (
                <button key={k.id} type="button" className="fr-kpi" title={k.hint} onClick={() => open(k.href.split("/").pop() as string)}>
                  <span className="fr-kpi-top"><span>{k.label}</span><Change value={k.change} /></span>
                  <span className="fr-kpi-value">{formatMoney(k.value)}</span>
                  <span className="fr-kpi-period">{k.period}</span>
                </button>
              ))}
            </div>

            <section className="directory-panel" aria-label="Report catalog">
              <div className="directory-tabs" aria-label="Report categories">
                {[{ id: "all", name: "All reports" }, ...REPORT_CATEGORIES].map((c) => (
                  <button key={c.id} type="button" className={`directory-tab ${category === c.id ? "selected" : ""}`} aria-pressed={category === c.id} onClick={() => setCategory(c.id)}>
                    {c.name}<span>{countFor(c.id)}</span>
                  </button>
                ))}
              </div>
              <div className="directory-toolbar">
                <SearchField label="Search reports" placeholder="Search by report name or description..." value={query} onChange={setQuery} />
                <div className="toolbar-actions">
                  <ReportFilterPopover definition={CATALOG_DEFINITION} />
                </div>
              </div>
              <FilterChips />

              {recentlyUsed.length > 0 && (
                <div className="fr-recent">
                  <span>Recently used:</span>
                  {recentlyUsed.map((id) => {
                    const r = REPORT_CATALOG.find((x) => x.reportId === id);
                    return r ? <button key={id} type="button" onClick={() => open(id)}>{r.name}</button> : null;
                  })}
                </div>
              )}

              {reports.length === 0 && (
                <EmptyState title="No reports match" description="Try another search or choose a different category." action={<TnButton onClick={() => { setQuery(""); setCategory("all"); }}>Clear search</TnButton>} />
              )}

              {REPORT_CATEGORIES.filter((c) => category === "all" || c.id === category).map((c) => {
                const items = reports.filter((r) => r.categoryId === c.id);
                if (!items.length) return null;
                return (
                  <section key={c.id} className="fr-section">
                    <h2>{c.name}</h2>
                    <p>{c.description}</p>
                    <div className="fr-grid">
                      {items.map((r) => {
                        const a = availabilityOf(r.availability);
                        return (
                          <button key={r.reportId} type="button" className="fr-card" onClick={() => open(r.reportId)}>
                            <span className={`fr-pill ${a.cls}`}>{a.text}</span>
                            <h3>{r.name}</h3>
                            <p>{r.description}</p>
                            <span className="fr-card-open">Open <ArrowRight size={13} /></span>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </section>

            <div className="directory-footnote">
              <span>Mock ledger data generated in the browser; figures are illustrative and not connected to a live accounting backend.</span>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

export default function FinancialReports({ params }: { params?: Record<string, string> }) {
  const reportId = params?.report;
  useEffect(() => { window.scrollTo?.(0, 0); }, [reportId]);
  return (
    <ReportProvider>
      {reportId ? <ReportView reportId={reportId} /> : <Catalog />}
    </ReportProvider>
  );
}
