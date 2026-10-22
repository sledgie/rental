import Link from "../../../shim/link";
import { db } from "../../../db";
import * as schema from "../../../db/schema";
import { and, eq } from "../../../db/ops";
import { PageHeader, Card, Badge, Money, EmptyState, Callout, StatusBadge, DefinitionList } from "../../../components/ui";
import { loadDepositModule } from "../../../lib/deposits/service";
import { getCurrentUser } from "../../../lib/session";
import { PURPOSE_LABELS, can, depositTypeLabel } from "../../../lib/deposits/domain";
import { formatCurrency } from "../../../lib/money";
import { addDaysISO, diffDays, formatDate } from "../../../lib/dates";
import { ApplicationDialog } from "../../../components/deposit-actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Deposit applications" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ApplicationPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const data = await loadDepositModule();
  const user = await getCurrentUser();
  const allowed = can(user.role, "apply_deposit");
  const candidates = data.deposits.filter(
    (row) =>
      row.balances.principalOutstandingCents > 0 &&
      !["cancelled", "closed", "transferred", "draft", "expected", "refund_requested", "refund_pending"].includes(row.deposit.status) &&
      (row.rule?.applicationPurposes.length ?? 0) > 0,
  );
  const requestedId = typeof params.deposit === "string" ? params.deposit : "";
  const selected = data.deposits.find((d) => d.deposit.id === requestedId) ?? candidates[0] ?? null;
  const invoices = selected
    ? await db.select().from(schema.rentInvoices).where(eq(schema.rentInvoices.leaseId, selected.deposit.leaseId))
    : [];
  const openInvoices = invoices.filter((i) => i.status === "open").sort((a, b) => (a.periodStart < b.periodStart ? 1 : -1));
  const laterInvoices = selected && openInvoices[0] ? invoices.filter((i) => i.periodStart > openInvoices[0].periodStart) : [];
  const finalInvoice = openInvoices[0] && selected?.lease
    ? openInvoices[0].periodEnd >= addDaysISO(selected.lease.endDate, -35) && laterInvoices.length === 0
    : false;
  const appliedRefs = new Set(selected?.txns.filter((t) => t.txnType === "application" && t.invoiceId).map((t) => t.invoiceId) ?? []);

  return (
    <div className="stack" style={{ gap: 14 }}>
      <PageHeader
        breadcrumb={[{ label: "Deposits", href: "/deposits" }, { label: "Applications" }]}
        title="Deposit application"
        description="Apply held deposits to permitted purposes only. Last month's rent is restricted to the final rental period and must be linked to the rent invoice without recognising the income twice."
        meta={
          <>
            <span>{candidates.length} deposits eligible for application</span>
            <span>·</span>
            <span>{formatCurrency(candidates.reduce((a, d) => a + d.balances.principalOutstandingCents, 0))} held</span>
          </>
        }
        actions={<Link href="/deposits/register?status=held" className="btn btn-sm">Open register</Link>}
      />

      {!allowed && <Callout tone="danger" title="Permission required">Your role cannot apply deposits. Ask an administrator for the apply-deposit permission.</Callout>}

      <div className="grid-3">
        <Callout tone="info" title="Ontario residential LMR">Only the final rental period is a permitted application. Damage, utilities and arrears applications are blocked by the rule engine.</Callout>
        <Callout tone="warning" title="No duplicate settlement">Each linked invoice can only receive one deposit application. The invoice settlement reference prevents double recognition of rent.</Callout>
        <Callout tone="neutral" title="Commercial rules differ">Commercial leases may permit arrears, utilities or documented damage applications — only where the effective rule permits them and approval is recorded.</Callout>
      </div>

      <Card title="Application candidates" subtitle="Held principal with at least one permitted purpose under the effective rule." padded={false}>
        {candidates.length === 0 ? (
          <EmptyState title="No deposits are currently eligible for application" description="Deposits must be collected and held, and the applicable rule must permit at least one application purpose." />
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr><th>Deposit</th><th>Tenant / lease</th><th>Type</th><th>Jurisdiction</th><th>Lease end</th><th className="num">Held principal</th><th>Permitted purposes</th><th>Status</th><th>Action</th></tr>
              </thead>
              <tbody>
                {candidates.map((row) => (
                  <tr key={row.deposit.id} className={selected?.deposit.id === row.deposit.id ? "selected" : ""}>
                    <td><Link href={`/deposits/application?deposit=${row.deposit.id}`} className="strong">{row.deposit.reference}</Link></td>
                    <td>{row.tenant?.name}<div className="small muted">{row.lease?.reference} · Unit {row.unit?.label}</div></td>
                    <td className="small">{depositTypeLabel(row.deposit.depositType)}</td>
                    <td className="small">{row.deposit.jurisdiction} {row.deposit.leaseType}</td>
                    <td className="small nowrap">{formatDate(row.lease?.endDate)}<div className={diffDays(data.today, row.lease?.endDate ?? data.today) <= 60 ? "small strong" : "small muted"}>{diffDays(data.today, row.lease?.endDate ?? data.today)} days</div></td>
                    <td className="num"><Money cents={row.balances.principalOutstandingCents} /></td>
                    <td className="small" style={{ maxWidth: 240 }}>{(row.rule?.applicationPurposes ?? []).map((p) => PURPOSE_LABELS[p] ?? p).join("; ") || "None permitted"}</td>
                    <td><StatusBadge status={row.deposit.status} /></td>
                    <td><Link href={`/deposits/application?deposit=${row.deposit.id}`} className="btn btn-sm">Preview</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {selected && (
        <div className="grid-2">
          <Card title={`Application preview — ${selected.deposit.reference}`} subtitle={`${depositTypeLabel(selected.deposit.depositType)} · ${selected.tenant?.name}`}>
            <DefinitionList
              items={[
                { term: "Current principal balance", value: <Money cents={selected.balances.principalOutstandingCents} /> },
                { term: "Lease term", value: `${formatDate(selected.lease?.startDate)} → ${formatDate(selected.lease?.endDate)}` },
                { term: "One month's rent", value: <Money cents={selected.lease?.monthlyRentCents ?? 0} /> },
                { term: "Applicable rule", value: selected.rule ? `${selected.rule.legalReference}` : "Not configured" },
                { term: "Approval required", value: selected.rule?.approvalRequired ? <Badge tone="warning">Yes — record approval reference</Badge> : "No" },
                { term: "Accounting impact", value: `Debit ${selected.deposit.liabilityAccountCode} / Credit ${selected.deposit.receivableAccountCode ?? "1200"}` },
                { term: "Total remaining obligation", value: <Money cents={selected.balances.totalRemainingCents} /> },
              ]}
            />
            <div className="divider" />
            <div className="small strong" style={{ marginBottom: 6 }}>Validation results</div>
            <ul className="small" style={{ margin: 0, paddingLeft: 16, lineHeight: 1.7 }}>
              <li className={selected.rule ? "muted" : "strong"}>Rule resolved for {selected.deposit.jurisdiction} {selected.deposit.leaseType}.</li>
              <li className={selected.deposit.depositType === "last_month_rent" && !finalInvoice ? "strong" : "muted"}>
                {selected.deposit.depositType === "last_month_rent" ? (finalInvoice ? "Final rental period invoice identified." : "No final rental period invoice found — prepare the final invoice before applying.") : "Non-LMR deposit — permitted commercial purposes apply."}
              </li>
              <li className={selected.openRefund ? "strong" : "muted"}>{selected.openRefund ? "Blocked: an open refund request exists." : "No open refund blocks the application."}</li>
              <li className="muted">Application cannot exceed the held principal or the linked invoice amount.</li>
            </ul>
            <div className="btn-row" style={{ marginTop: 12 }}>
              <ApplicationDialog
                deposit={{
                  id: selected.deposit.id,
                  reference: selected.deposit.reference,
                  tenantName: selected.tenant?.name ?? "",
                  depositType: selected.deposit.depositType,
                  outstandingCents: selected.balances.principalOutstandingCents,
                  oneMonthRentCents: selected.lease?.monthlyRentCents ?? 0,
                  receivableAccount: selected.deposit.receivableAccountCode ?? "1200",
                  liabilityAccount: selected.deposit.liabilityAccountCode,
                  status: selected.deposit.status,
                }}
                purposes={selected.rule?.applicationPurposes ?? []}
                invoices={openInvoices.map((i) => ({ id: i.id, reference: i.reference, periodLabel: i.periodLabel, amountCents: i.amountCents, status: i.status }))}
                canApply={allowed}
                approvalRequired={Boolean(selected.rule?.approvalRequired)}
                invoiceHint={finalInvoice ? "This is the final rental period invoice and is eligible for last month's rent." : "Select the authorized obligation. The final rental period invoice is required for LMR."}
              />
              <Link href={`/deposits/${selected.deposit.id}`} className="btn btn-sm">Full details</Link>
            </div>
          </Card>

          <Card title="Lease invoices and obligations" subtitle="Deposit applications relieve accounts receivable — they do not create rental income." padded={false}>
            {invoices.length === 0 ? (
              <EmptyState title="No invoices for this lease" description="Create the final rental period invoice in the rent ledger before applying last month's rent." />
            ) : (
              <div className="table-wrap">
                <table className="data">
                  <thead><tr><th>Invoice</th><th>Period</th><th className="num">Amount</th><th>Due</th><th>Status</th><th>Settlement</th></tr></thead>
                  <tbody>
                    {invoices.sort((a, b) => (a.periodStart < b.periodStart ? 1 : -1)).map((invoice) => (
                      <tr key={invoice.id}>
                        <td className="mono small">{invoice.reference}</td>
                        <td className="small">{invoice.periodLabel}<div className="small muted">{formatDate(invoice.periodStart)} → {formatDate(invoice.periodEnd)}</div></td>
                        <td className="num"><Money cents={invoice.amountCents} /></td>
                        <td className="small nowrap">{formatDate(invoice.dueDate)}</td>
                        <td><Badge tone={invoice.status === "open" ? "warning" : "success"}>{invoice.status.replaceAll("_", " ")}</Badge></td>
                        <td className="small">{appliedRefs.has(invoice.id) ? <Badge tone="accent">Deposit applied</Badge> : invoice.settlementRef ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="card-body">
              <Callout tone="info" title="Final rental period">
                For Ontario residential tenancies, the last month&apos;s rent deposit may only be applied to the final rental period or credited against a lawful rent increase. The engine checks the lease end date, invoice order and duplicate settlement before posting.
              </Callout>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
