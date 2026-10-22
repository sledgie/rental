import { useMemo, useState } from "react";
import { useStore } from "../lib/store";
import { computeRecon, withinPeriod } from "../lib/calc";
import { Alert, Button, Card, DataTableWrap, EmptyState, SegmentedTabs, Select, Th, Td } from "../components/ui";
import { Icon } from "../components/icons";
import { downloadCSV, fmtDate, money, moneySigned, num } from "../lib/format";
import { Reconciliation } from "../lib/types";

const REPORTS = [
  { key: "A", label: "A · Bank Reconciliation Summary", icon: "report" },
  { key: "B", label: "B · Bank Reconciliation Detail", icon: "ledger" },
  { key: "C", label: "C · Outstanding Deposits", icon: "arrowRight" },
  { key: "D", label: "D · Outstanding Payments", icon: "arrowRight" },
  { key: "E", label: "E · Unmatched Transactions", icon: "alert" },
  { key: "F", label: "F · Bank Charges & Interest", icon: "bank" },
  { key: "G", label: "G · Reconciliation History", icon: "history" },
  { key: "H", label: "H · Import Exceptions", icon: "upload" },
] as const;

type ReportKey = (typeof REPORTS)[number]["key"];

export default function ReportsPage() {
  const { state } = useStore();
  const [report, setReport] = useState<ReportKey>("A");
  const [accountId, setAccountId] = useState("all");
  const [status, setStatus] = useState("all");

  const recons = useMemo(
    () =>
      state.reconciliations
        .filter((r) => {
          if (accountId !== "all" && r.accountId !== accountId) return false;
          if (status !== "all" && r.status !== status) return false;
          return true;
        })
        .sort((a, b) => b.periodStart.localeCompare(a.periodStart)),
    [state.reconciliations, accountId, status],
  );

  const exportCSV = (rows: (string | number)[][]) => downloadCSV(`reconciliation-report-${report}-${new Date().toISOString().slice(0, 10)}.csv`, rows);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-u-ink">Reconciliation Reports</h2>
          <p className="text-sm text-u-muted">Filterable, drill-down capable reports derived from the reconciliation records. Print-friendly layouts and CSV export are supported.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" icon="print" onClick={() => window.print()}>Print</Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Select value={accountId} onChange={(e) => setAccountId(e.target.value)} className="w-64">
          <option value="all">All accounts</option>
          {state.accounts.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </Select>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-44">
          <option value="all">All statuses</option>
          <option value="Reconciled">Reconciled</option>
          <option value="In Progress">In Progress</option>
          <option value="Needs Review">Needs Review</option>
          <option value="Ready to Finalize">Ready to Finalize</option>
          <option value="Reopened">Reopened</option>
          <option value="Cancelled">Cancelled</option>
        </Select>
      </div>

      <SegmentedTabs tabs={REPORTS.map((r) => ({ key: r.key, label: r.label, icon: r.icon }))} active={report} onChange={(k) => setReport(k as ReportKey)} />

      {/* A — Summary */}
      {report === "A" && (
        <Card>
          <CardHeader title="Bank Reconciliation Summary" subtitle="One row per reconciliation" icon="report" />
          {recons.length === 0 ? (
            <EmptyState icon="report" title="No data" />
          ) : (
            <>
              <DataTableWrap>
                <thead className="bg-u-s2">
                  <tr>
                    <Th>Reference</Th><Th>Account</Th><Th>Period</Th><Th className="text-right">Stmt Ending</Th><Th className="text-right">Adj Bank</Th><Th className="text-right">Adj Book</Th><Th className="text-right">Diff</Th><Th>Matched</Th><Th>Outstanding</Th><Th>Status</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-u-line">
                  {recons.map((r) => {
                    const acct = state.accounts.find((a) => a.id === r.accountId);
                    const calc = computeRecon(state, r);
                    return (
                      <tr key={r.id} className="hover:bg-u-s2/60">
                        <Td className="font-mono text-xs">{r.reference}</Td>
                        <Td>{acct?.name}</Td>
                        <Td className="whitespace-nowrap">{fmtDate(r.periodStart)} – {fmtDate(r.periodEnd)}</Td>
                        <Td className="text-right tabular-nums">{money(r.statementEndingBalance)}</Td>
                        <Td className="text-right tabular-nums">{money(calc.adjustedBank)}</Td>
                        <Td className="text-right tabular-nums">{money(calc.adjustedBook)}</Td>
                        <Td className={`text-right tabular-nums ${Math.abs(calc.remainingDifference) > 0.005 ? "text-u-danger" : "text-u-ok"}`}>{moneySigned(calc.remainingDifference)}</Td>
                        <Td>{calc.matchedBankCount}</Td>
                        <Td>{calc.depositsInTransit.length + calc.outstandingPayments.length}</Td>
                        <Td><span className="text-xs font-medium text-u-ink2">{calc.suggestedStatus}</span></Td>
                      </tr>
                    );
                  })}
                </tbody>
              </DataTableWrap>
              <div className="p-4 border-t border-u-line">
                <Button size="sm" icon="download" onClick={() => exportCSV([["Reference", "Account", "Period Start", "Period End", "Statement Ending", "Adjusted Bank", "Adjusted Book", "Difference", "Matched", "Outstanding", "Status"], ...recons.map((r) => {
                  const acct = state.accounts.find((a) => a.id === r.accountId);
                  const calc = computeRecon(state, r);
                  return [r.reference, acct?.name ?? "", r.periodStart, r.periodEnd, r.statementEndingBalance, calc.adjustedBank, calc.adjustedBook, calc.remainingDifference, calc.matchedBankCount, calc.depositsInTransit.length + calc.outstandingPayments.length, calc.suggestedStatus];
                })])}>Export CSV</Button>
              </div>
            </>
          )}
        </Card>
      )}

      {/* B — Detail */}
      {report === "B" && (
        <Card>
          <CardHeader title="Bank Reconciliation Detail" subtitle="Bank transactions with their matched book transactions" icon="ledger" />
          {recons.length === 0 ? (
            <EmptyState icon="ledger" title="No data" />
          ) : (
            <DataTableWrap>
              <thead className="bg-u-s2">
                <tr>
                  <Th>Recon</Th><Th>Date</Th><Th>Bank Description</Th><Th>Reference</Th><Th className="text-right">Amount</Th><Th>Matched Book Transaction</Th><Th>Status</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-u-line">
                {recons.map((r) => {
                  const calc = computeRecon(state, r);
                  const bankTxs = state.bankTxs.filter((t) => t.accountId === r.accountId && withinPeriod(t.date, r.periodStart, r.periodEnd));
                  return bankTxs.map((t) => {
                    const m = state.matches.find((mm) => mm.reconciliationId === r.id && mm.active && mm.bankTxIds.includes(t.id));
                    return (
                      <tr key={t.id} className="hover:bg-u-s2/60">
                        <Td className="font-mono text-[11px]">{r.reference}</Td>
                        <Td className="whitespace-nowrap">{fmtDate(t.date)}</Td>
                        <Td>{t.description}</Td>
                        <Td className="text-xs">{t.reference}</Td>
                        <Td className={`text-right tabular-nums ${t.signedAmount >= 0 ? "text-u-ok" : "text-u-danger"}`}>{moneySigned(t.signedAmount)}</Td>
                        <Td>{m ? m.bookTxIds.map((id) => state.bookTxs.find((b) => b.id === id)?.description).join("; ") : <span className="text-u-muted">—</span>}</Td>
                        <Td>{m ? <span className="text-xs text-u-ok font-medium">Matched</span> : <span className="text-xs text-u-warn font-medium">Unmatched</span>}</Td>
                      </tr>
                    );
                  });
                })}
              </tbody>
            </DataTableWrap>
          )}
        </Card>
      )}

      {/* C — Outstanding deposits */}
      {report === "C" && (
        <Card>
          <CardHeader title="Outstanding Deposits Report" subtitle="Recorded receipts not yet cleared by the bank" icon="arrowRight" />
          {recons.length === 0 ? (
            <EmptyState icon="arrowRight" title="No data" />
          ) : (
            <DataTableWrap>
              <thead className="bg-u-s2">
                <tr><Th>Date</Th><Th>Payer</Th><Th>Property</Th><Th>Unit</Th><Th className="text-right">Amount</Th><Th>Aging</Th><Th>Recon</Th></tr>
              </thead>
              <tbody className="divide-y divide-u-line">
                {recons.flatMap((r) => {
                  const calc = computeRecon(state, r);
                  return calc.depositsInTransit.map((t) => {
                    const prop = state.properties.find((p) => p.id === t.propertyId);
                    const ageDays = Math.max(0, Math.round((Date.now() - new Date(t.date + "T00:00:00").getTime()) / 86400000));
                    return (
                      <tr key={t.id} className="hover:bg-u-s2/60">
                        <Td className="whitespace-nowrap">{fmtDate(t.date)}</Td>
                        <Td>{t.counterparty}</Td>
                        <Td>{prop?.name ?? "—"}</Td>
                        <Td>{t.unit ?? "—"}</Td>
                        <Td className="text-right tabular-nums">{money(t.moneyIn)}</Td>
                        <Td>{ageDays} days</Td>
                        <Td className="font-mono text-[11px]">{r.reference}</Td>
                      </tr>
                    );
                  });
                })}
              </tbody>
            </DataTableWrap>
          )}
        </Card>
      )}

      {/* D — Outstanding payments */}
      {report === "D" && (
        <Card>
          <CardHeader title="Outstanding Payments Report" subtitle="Recorded disbursements not yet appeared on a bank statement" icon="arrowRight" />
          {recons.length === 0 ? (
            <EmptyState icon="arrowRight" title="No data" />
          ) : (
            <DataTableWrap>
              <thead className="bg-u-s2">
                <tr><Th>Date</Th><Th>Payee</Th><Th>Reference</Th><Th className="text-right">Amount</Th><Th>Aging</Th><Th>Recon</Th></tr>
              </thead>
              <tbody className="divide-y divide-u-line">
                {recons.flatMap((r) => {
                  const calc = computeRecon(state, r);
                  return calc.outstandingPayments.map((t) => {
                    const ageDays = Math.max(0, Math.round((Date.now() - new Date(t.date + "T00:00:00").getTime()) / 86400000));
                    return (
                      <tr key={t.id} className="hover:bg-u-s2/60">
                        <Td className="whitespace-nowrap">{fmtDate(t.date)}</Td>
                        <Td>{t.counterparty}</Td>
                        <Td className="text-xs">{t.reference}</Td>
                        <Td className="text-right tabular-nums">({money(t.moneyOut)})</Td>
                        <Td>{ageDays} days</Td>
                        <Td className="font-mono text-[11px]">{r.reference}</Td>
                      </tr>
                    );
                  });
                })}
              </tbody>
            </DataTableWrap>
          )}
        </Card>
      )}

      {/* E — Unmatched */}
      {report === "E" && (
        <Card>
          <CardHeader title="Unmatched Transactions Report" subtitle="Unresolved items with discrepancy classification" icon="alert" />
          {recons.length === 0 ? (
            <EmptyState icon="alert" title="No data" />
          ) : (
            <DataTableWrap>
              <thead className="bg-u-s2">
                <tr><Th>Date</Th><Th>Description</Th><Th>Source</Th><Th className="text-right">Amount</Th><Th>Classification</Th><Th>Recon</Th></tr>
              </thead>
              <tbody className="divide-y divide-u-line">
                {recons.flatMap((r) => {
                  const calc = computeRecon(state, r);
                  return calc.unmatchedBank.map((t) => (
                    <tr key={`b-${t.id}`} className="hover:bg-u-s2/60">
                      <Td className="whitespace-nowrap">{fmtDate(t.date)}</Td>
                      <Td>{t.description}</Td>
                      <Td>Bank</Td>
                      <Td className={`text-right tabular-nums ${t.signedAmount >= 0 ? "text-u-ok" : "text-u-danger"}`}>{moneySigned(t.signedAmount)}</Td>
                      <Td>{t.duplicateOf ? "Potential Duplicate" : /fee|charge|interest/i.test(t.description) ? "Fee / Interest Not Recorded" : /revers|return/i.test(t.description) ? "Returned / Reversed" : "Bank Without Book Entry"}</Td>
                      <Td className="font-mono text-[11px]">{r.reference}</Td>
                    </tr>
                  )).concat(
                    calc.unmatchedBook.map((t) => (
                      <tr key={`k-${t.id}`} className="hover:bg-u-s2/60">
                        <Td className="whitespace-nowrap">{fmtDate(t.date)}</Td>
                        <Td>{t.description}</Td>
                        <Td>Book</Td>
                        <Td className={`text-right tabular-nums ${t.signedAmount >= 0 ? "text-u-ok" : "text-u-danger"}`}>{moneySigned(t.signedAmount)}</Td>
                        <Td>{t.moneyIn > 0 ? "Deposit in Transit" : "Outstanding Payment"}</Td>
                        <Td className="font-mono text-[11px]">{r.reference}</Td>
                      </tr>
                    )),
                  );
                })}
              </tbody>
            </DataTableWrap>
          )}
        </Card>
      )}

      {/* F — Bank charges & interest */}
      {report === "F" && (
        <Card>
          <CardHeader title="Bank Charges & Interest Report" subtitle="Fees, interest earned, and related entries" icon="bank" />
          <DataTableWrap>
            <thead className="bg-u-s2">
                <tr><Th>Date</Th><Th>Description</Th><Th>Type</Th><Th>Account</Th><Th>GL Account</Th><Th className="text-right">Amount</Th><Th>Source</Th></tr>
              </thead>
            <tbody className="divide-y divide-u-line">
              {state.bookTxs
                .filter((t) => t.type === "bank_fee" || t.type === "interest_income")
                .sort((a, b) => b.date.localeCompare(a.date))
                .map((t) => {
                  const acct = state.accounts.find((a) => a.id === t.accountId);
                  return (
                    <tr key={t.id} className="hover:bg-u-s2/60">
                      <Td className="whitespace-nowrap">{fmtDate(t.date)}</Td>
                      <Td>{t.description}</Td>
                      <Td>{t.type === "bank_fee" ? "Bank Charge" : "Interest Income"}</Td>
                      <Td>{acct?.name ?? "—"}</Td>
                      <Td className="text-xs">{t.coa}</Td>
                      <Td className={`text-right tabular-nums ${t.signedAmount >= 0 ? "text-u-ok" : "text-u-danger"}`}>{moneySigned(t.signedAmount)}</Td>
                      <Td className="text-xs text-u-muted">{t.source}</Td>
                    </tr>
                  );
                })}
              {state.bankTxs
                .filter((t) => /fee|charge|interest/i.test(t.description))
                .map((t) => {
                  const activeMatch = state.matches.some((m) => m.active && m.bankTxIds.includes(t.id));
                  if (activeMatch) return null;
                  return (
                    <tr key={t.id} className="hover:bg-u-s2/60">
                      <Td className="whitespace-nowrap">{fmtDate(t.date)}</Td>
                      <Td>{t.description}</Td>
                      <Td><span className="text-u-warn font-medium">Not yet recorded</span></Td>
                      <Td>{state.accounts.find((a) => a.id === t.accountId)?.name ?? "—"}</Td>
                      <Td className="text-xs">—</Td>
                      <Td className={`text-right tabular-nums ${t.signedAmount >= 0 ? "text-u-ok" : "text-u-danger"}`}>{moneySigned(t.signedAmount)}</Td>
                      <Td className="text-xs text-u-muted">Bank statement</Td>
                    </tr>
                  );
                })}
            </tbody>
          </DataTableWrap>
        </Card>
      )}

      {/* G — History */}
      {report === "G" && (
        <Card>
          <CardHeader title="Reconciliation History Report" subtitle="All reconciliations by account and period" icon="history" />
          <DataTableWrap>
            <thead className="bg-u-s2">
              <tr><Th>Reference</Th><Th>Account</Th><Th>Period</Th><Th className="text-right">Stmt Opening</Th><Th className="text-right">Stmt Ending</Th><Th>Status</Th><Th>Finalized By</Th><Th>Reopen Reason</Th></tr>
            </thead>
            <tbody className="divide-y divide-u-line">
              {recons.map((r) => {
                const acct = state.accounts.find((a) => a.id === r.accountId);
                return (
                  <tr key={r.id} className="hover:bg-u-s2/60">
                    <Td className="font-mono text-xs">{r.reference}</Td>
                    <Td>{acct?.name}</Td>
                    <Td className="whitespace-nowrap">{fmtDate(r.periodStart)} – {fmtDate(r.periodEnd)}</Td>
                    <Td className="text-right tabular-nums">{money(r.statementOpeningBalance)}</Td>
                    <Td className="text-right tabular-nums">{money(r.statementEndingBalance)}</Td>
                    <Td><span className="text-xs font-medium text-u-ink2">{r.status}</span></Td>
                    <Td className="text-xs">{r.finalizedBy ?? "—"}</Td>
                    <Td className="text-xs text-u-warn">{r.reopenReason ?? "—"}</Td>
                  </tr>
                );
              })}
            </tbody>
          </DataTableWrap>
        </Card>
      )}

      {/* H — Import exceptions */}
      {report === "H" && (
        <Card>
          <CardHeader title="Import Exceptions Report" subtitle="Rejected rows, potential duplicates, warnings, and batches" icon="upload" />
          {state.importBatches.length === 0 ? (
            <EmptyState icon="upload" title="No import batches" />
          ) : (
            <DataTableWrap>
              <thead className="bg-u-s2">
                <tr><Th>Batch</Th><Th>Account</Th><Th>File</Th><Th>Total</Th><Th>Accepted</Th><Th>Rejected</Th><Th>Duplicates</Th><Th>Warnings</Th><Th>Imported</Th></tr>
              </thead>
              <tbody className="divide-y divide-u-line">
                {state.importBatches.map((b) => (
                  <tr key={b.id} className="hover:bg-u-s2/60 align-top">
                    <Td className="font-mono text-xs">{b.id}</Td>
                    <Td>{state.accounts.find((a) => a.id === b.accountId)?.name ?? b.accountId}</Td>
                    <Td className="text-xs">{b.fileName}</Td>
                    <Td>{b.totalRows}</Td>
                    <Td className="text-u-ok">{b.acceptedRows}</Td>
                    <Td className="text-u-danger">{b.rejectedRows}</Td>
                    <Td className="text-u-warn">{b.duplicateRows}</Td>
                    <Td className="max-w-xs text-xs text-u-muted">{b.warnings.length ? b.warnings.join(" ") : "—"}</Td>
                    <Td className="text-xs text-u-muted">{fmtDate(b.importedAt)}</Td>
                  </tr>
                ))}
              </tbody>
            </DataTableWrap>
          )}
        </Card>
      )}

      <Alert kind="info">
        Reports are generated from the current mock records. Drill-down is available through the workspace and history views. CSV export downloads a filtered snapshot; use Print for PDF-friendly output.
      </Alert>
    </div>
  );
}

function CardHeader({ title, subtitle, icon }: { title: string; subtitle?: string; icon?: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-u-line px-5 py-4">
      <div className="flex items-start gap-3">
        {icon && (
          <div className="mt-0.5 w-9 h-9 rounded-lg bg-u-accent-soft text-u-accent flex items-center justify-center shrink-0">
            <Icon name={icon} className="w-5 h-5" />
          </div>
        )}
        <div>
          <h3 className="text-sm font-semibold text-u-ink">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-u-muted">{subtitle}</p>}
        </div>
      </div>
    </div>
  );
}
