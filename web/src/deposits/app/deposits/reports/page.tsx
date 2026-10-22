import Link from "../../../shim/link";
import { PageHeader, Card, Callout, EmptyState, Tabs, Badge, FilterCard, GetForm } from "../../../components/ui";
import { PrintButton } from "../../../components/deposit-actions";
import { loadDepositModule, parseFilters, applyFilters, filtersToQuery } from "../../../lib/deposits/service";
import { REPORT_DEFINITIONS, buildReport, type ReportKey } from "../../../lib/deposits/reports";
import { DEPOSIT_STATUSES, DEPOSIT_TYPE_LABELS, DEPOSIT_TYPES, JURISDICTIONS, statusLabel } from "../../../lib/deposits/domain";
import { formatCurrency } from "../../../lib/money";
import { formatDate } from "../../../lib/dates";

export const dynamic = "force-dynamic";
export const metadata = { title: "Deposit reports" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ReportsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const filters = parseFilters(params);
  const requested = typeof params.report === "string" ? params.report : "liability";
  const key: ReportKey = (REPORT_DEFINITIONS.some((r) => r.key === requested) ? requested : "liability") as ReportKey;
  const data = await loadDepositModule();
  const filtered = applyFilters(data.deposits, filters, data.today);
  const report = buildReport(key, filtered, data, data.today);
  const query = filtersToQuery({ ...filters, report: key });
  const depositRefMap = new Map(data.deposits.map((d) => [d.deposit.reference, d.deposit.id]));

  const formatCell = (value: string | number | undefined, type?: string) => {
    if (value == null || value === "") return "—";
    if (type === "currency" && typeof value === "number") return formatCurrency(value);
    if (type === "percent" && typeof value === "number") return `${(value / 100).toFixed(2)}%`;
    if (type === "date") return formatDate(String(value));
    if (type === "number") return Number(value).toLocaleString("en-CA");
    return String(value);
  };

  return (
    <div className="stack" style={{ gap: 14 }}>
      <PageHeader
        breadcrumb={[{ label: "Deposits", href: "/deposits" }, { label: "Reports" }]}
        title="Deposit reports"
        description="Operational and financial reports with drill-downs. Every export reflects the filters selected below, and amounts stay separate from record counts."
        meta={<><span>{filtered.length} deposits in scope</span><span>·</span><span>As of {data.today}</span><span>·</span><span>Exports are CSV (opens in Excel)</span></>}
        actions={
          <>
            <Link href={`/api/deposits/export?${query}`} className="btn btn-sm btn-primary">Export CSV</Link>
            <PrintButton label="Print / PDF" />
            <Link href="/deposits/register" className="btn btn-sm">Open register</Link>
          </>
        }
      />

      <Tabs tabs={REPORT_DEFINITIONS.map((r) => ({ key: r.key, label: r.label }))} current={key} basePath="/deposits/reports" />

      <FilterCard title="Report filters" subtitle="Filters apply to the report table and to the CSV export.">
        <GetForm className="filter-bar">
          <input type="hidden" name="report" value={key} />
          <label className="field"><span className="label">Search</span><input className="input" name="q" defaultValue={filters.q} placeholder="Deposit, tenant, property…" /></label>
          <label className="field"><span className="label">Property</span>
            <select className="select" name="propertyId" defaultValue={filters.propertyId}>
              <option value="">All properties</option>
              {data.lookups.properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <label className="field"><span className="label">Deposit type</span>
            <select className="select" name="depositType" defaultValue={filters.depositType}>
              <option value="">All types</option>
              {DEPOSIT_TYPES.map((t) => <option key={t} value={t}>{DEPOSIT_TYPE_LABELS[t]}</option>)}
            </select>
          </label>
          <label className="field"><span className="label">Status</span>
            <select className="select" name="status" defaultValue={filters.status}>
              <option value="">All statuses</option>
              {DEPOSIT_STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
            </select>
          </label>
          <label className="field"><span className="label">Jurisdiction</span>
            <select className="select" name="jurisdiction" defaultValue={filters.jurisdiction}>
              <option value="">All</option>
              {JURISDICTIONS.map((j) => <option key={j.code} value={j.code}>{j.code}</option>)}
            </select>
          </label>
          <label className="field"><span className="label">Expected from</span><input className="input" type="date" name="expectedFrom" defaultValue={filters.expectedFrom} /></label>
          <label className="field"><span className="label">Expected to</span><input className="input" type="date" name="expectedTo" defaultValue={filters.expectedTo} /></label>
          <div className="btn-row">
            <button type="submit" className="btn btn-primary">Apply</button>
            <Link href={`/deposits/reports?report=${key}`} className="btn">Reset</Link>
          </div>
        </GetForm>
      </FilterCard>

      <Card
        title={report.title}
        subtitle={report.description}
        padded={false}
        actions={<Badge tone="neutral">{report.rows.length} rows</Badge>}
      >
        {report.rows.length === 0 ? (
          <EmptyState
            title="No records for this report and filter combination"
            description="Missing data is shown explicitly rather than estimated. Broaden the filters or reset them."
            action={<Link href={`/deposits/reports?report=${key}`} className="btn">Reset filters</Link>}
          />
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  {report.columns.map((column) => (
                    <th key={column.key} className={["currency", "number", "percent"].includes(column.type ?? "") ? "num" : ""}>{column.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.rows.slice(0, 200).map((row, index) => (
                  <tr key={index}>
                    {report.columns.map((column) => {
                      const raw = row[column.key];
                      const depositId = typeof raw === "string" ? depositRefMap.get(raw) : undefined;
                      return (
                        <td key={column.key} className={["currency", "number", "percent"].includes(column.type ?? "") ? "num" : ""}>
                          {depositId ? <Link href={`/deposits/${depositId}`} className="strong">{raw}</Link> : formatCell(raw, column.type)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
              {report.totals && (
                <tfoot>
                  <tr>
                    {report.columns.map((column, index) => {
                      if (index === 0) return <td key={column.key}>Totals ({report.rows.length} rows)</td>;
                      const total = report.totals?.[column.key];
                      return <td key={column.key} className={["currency", "number", "percent"].includes(column.type ?? "") ? "num" : ""}>{total != null ? formatCell(total, column.type) : ""}</td>;
                    })}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </Card>

      <div className="grid-2-even">
        <Callout tone="info" title="Drill-downs">
          Deposit references link directly to the full deposit detail page, where you can inspect the ledger, journal entries, approvals and audit trail behind each row.
        </Callout>
        <Callout tone="warning" title="Report limitations">
          {key === "aging"
            ? "Aging reflects the specific obligation (collection, refund, interest, final-period application or device return). A deposit that has legitimately remained held is not classified as overdue."
            : "All amounts are simulated demo data. The audit report shows the most recent 200 events; accounting period restrictions follow the configured posting workflow."}
        </Callout>
      </div>
      {report.note && <p className="hint" style={{ margin: 0 }}>{report.note}</p>}
    </div>
  );
}
