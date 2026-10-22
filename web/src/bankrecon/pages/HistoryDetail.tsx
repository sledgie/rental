import { useMemo, useState } from "react";
import Link from "../shim/link";
import { useStore } from "../lib/store";
import { computeRecon, withinPeriod } from "../lib/calc";
import { Alert, Badge, Button, Card, DataTableWrap, EmptyState, SegmentedTabs, StatCard, Th, Td, confidenceBadge, reconStatusBadge } from "../components/ui";
import { Icon } from "../components/icons";
import { FinalizeModal, ReopenModal, CancelModal } from "../components/recon/WorkflowModals";
import { fmtDate, fmtDateTime, money, moneySigned, num } from "../lib/format";
import { ReconStatus } from "../lib/types";

export default function HistoryDetailPage({ id }: { id: string }) {
  const { state, can } = useStore();
  const [tab, setTab] = useState<"summary" | "matches" | "audit">("summary");
  const [reopenOpen, setReopenOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [finalizeOpen, setFinalizeOpen] = useState(false);

  const recon = useMemo(() => state.reconciliations.find((r) => r.id === id), [state.reconciliations, id]);
  const account = recon ? state.accounts.find((a) => a.id === recon.accountId) : null;
  const calc = recon ? computeRecon(state, recon) : null;

  if (!recon || !account || !calc) {
    return (
      <Card className="p-8 text-center">
        <p className="text-sm text-u-muted">Reconciliation not found.</p>
        <Link href="/accounting/bank-reconciliation/history"><Button className="mt-3">Back to history</Button></Link>
      </Card>
    );
  }

  const matchedList = state.matches.filter((m) => m.reconciliationId === recon.id && m.active);
  const audit = state.audit.filter((a) => a.record === recon.reference || a.record === recon.id);
  const archived = !recon.detailSeeded;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-semibold text-u-ink font-mono">{recon.reference}</h2>
            {reconStatusBadge(recon.status)}
          </div>
          <p className="text-xs text-u-muted mt-1">
            {account.name} · {fmtDate(recon.periodStart)} – {fmtDate(recon.periodEnd)} · Statement {recon.statementRef}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/accounting/bank-reconciliation/history"><Button size="sm" variant="ghost" icon="chevronRight" className="rotate-180">Back</Button></Link>
          {recon.status === "Reconciled" && can("reopen_reconciliation") && (
            <Button size="sm" variant="primary" icon="unlock" onClick={() => setReopenOpen(true)}>Reopen</Button>
          )}
          {recon.status !== "Reconciled" && recon.status !== "Cancelled" && can("cancel_reconciliation") && (
            <Button size="sm" variant="ghost" className="text-u-danger" onClick={() => setCancelOpen(true)}>Cancel</Button>
          )}
          {recon.status !== "Reconciled" && recon.status !== "Cancelled" && (
            <Button size="sm" variant="success" icon="lock" disabled={!calc.canFinalize || !can("finalize_reconciliation")} onClick={() => setFinalizeOpen(true)}>Finalize</Button>
          )}
        </div>
      </div>

      {recon.reopenReason && <Alert kind="warning">Reopened: {recon.reopenReason}</Alert>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Statement Ending" value={money(recon.statementEndingBalance)} icon="bank" tone="slate" />
        <StatCard label="Adjusted Bank" value={money(calc.adjustedBank)} icon="scale" tone="indigo" />
        <StatCard label="Adjusted Book" value={money(calc.adjustedBook)} icon="ledger" tone="indigo" />
        <StatCard label="Remaining Difference" value={moneySigned(calc.remainingDifference)} icon="alert" tone={Math.abs(calc.remainingDifference) <= 0.005 ? "emerald" : "rose"} />
      </div>

      <div>
        <SegmentedTabs
          tabs={[
            { key: "summary", label: "Summary", icon: "report" },
            { key: "matches", label: `Matches (${matchedList.length})`, icon: "check" },
            { key: "audit", label: "Audit Trail", icon: "history" },
          ]}
          active={tab}
          onChange={(k) => setTab(k as typeof tab)}
        />
      </div>

      {tab === "summary" && (
        <Card>
          <div className="border-b border-u-line px-5 py-4">
            <h3 className="text-sm font-semibold text-u-ink">Reconciliation Summary</h3>
            <p className="text-xs text-u-muted">Finalized records are locked; corrections require an authorized reopening.</p>
          </div>
          <div className="p-5 space-y-3">
            {archived && (
              <Alert kind="info">
                Archived record — full transaction detail was not retained in this demo. The stored summary below is preserved as finalized.
              </Alert>
            )}
            <div className="grid sm:grid-cols-2 gap-x-8 divide-y divide-u-line text-sm">
              {[
                ["Bank Account", account.name],
                ["Statement Period", `${fmtDate(recon.periodStart)} – ${fmtDate(recon.periodEnd)}`],
                ["Statement Opening Balance", money(recon.statementOpeningBalance)],
                ["Statement Ending Balance", money(recon.statementEndingBalance)],
                ["Book Balance", money(calc.bookBalance)],
                ["Add: Deposits in Transit", money(calc.depositsInTransitAmount)],
                ["Less: Outstanding Payments", `(${money(calc.outstandingPaymentsAmount)})`],
                ["Adjusted Bank Balance", money(calc.adjustedBank)],
                ["Adjusted Book Balance", money(calc.adjustedBook)],
                ["Remaining Difference", moneySigned(calc.remainingDifference)],
                ["Matched Transactions", `${calc.matchedBankCount} bank / ${calc.matchedBookCount} book`],
                ["Outstanding Items", `${calc.depositsInTransit.length + calc.outstandingPayments.length}`],
                ["Status", recon.status],
                ["Created By / At", `${recon.createdBy} · ${fmtDateTime(recon.createdAt)}`],
                ["Finalized By / At", recon.finalizedBy ? `${recon.finalizedBy} · ${fmtDateTime(recon.finalizedAt ?? "")}` : "—"],
                ["File", recon.fileName ?? "—"],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-4 py-1">
                  <span className="text-xs text-u-muted">{k}</span>
                  <span className="text-sm font-medium text-u-ink tabular-nums">{v}</span>
                </div>
              ))}
            </div>
            {recon.notes && <p className="text-xs text-u-muted">Notes: {recon.notes}</p>}
          </div>
        </Card>
      )}

      {tab === "matches" && (
        <Card>
          <div className="border-b border-u-line px-5 py-4">
            <h3 className="text-sm font-semibold text-u-ink">Confirmed Matches</h3>
          </div>
          {matchedList.length === 0 ? (
            <EmptyState icon="check" title="No confirmed matches" />
          ) : (
            <DataTableWrap>
              <thead className="bg-u-s2">
                <tr>
                  <Th>Bank Transaction</Th>
                  <Th>Book Transaction(s)</Th>
                  <Th>Type</Th>
                  <Th>Confidence</Th>
                  <Th>Explanation</Th>
                  <Th>Confirmed</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-u-line">
                {matchedList.map((m) => (
                  <tr key={m.id} className="hover:bg-u-s2/60 align-top">
                    <Td>{state.bankTxs.find((t) => t.id === m.bankTxIds[0])?.description ?? m.bankTxIds[0]}</Td>
                    <Td>{m.bookTxIds.map((id) => state.bookTxs.find((b) => b.id === id)?.description).join("; ")}</Td>
                    <Td><Badge kind="neutral">{m.type}</Badge></Td>
                    <Td>{confidenceBadge(m.confidenceLevel)}</Td>
                    <Td className="max-w-xs text-xs text-u-muted">{m.explanation}</Td>
                    <Td className="text-xs text-u-muted">{m.confirmedBy} · {fmtDateTime(m.confirmedAt)}</Td>
                  </tr>
                ))}
              </tbody>
            </DataTableWrap>
          )}
        </Card>
      )}

      {tab === "audit" && (
        <Card>
          <div className="border-b border-u-line px-5 py-4">
            <h3 className="text-sm font-semibold text-u-ink">Audit Trail</h3>
            <p className="text-xs text-u-muted">Immutable record of workflow events for this reconciliation.</p>
          </div>
          {audit.length === 0 ? (
            <EmptyState icon="history" title="No audit entries" />
          ) : (
            <ul className="divide-y divide-u-line">
              {audit.map((e) => (
                <li key={e.id} className="flex items-start gap-3 px-5 py-3">
                  <div className="w-7 h-7 rounded-lg bg-u-s2 text-u-muted flex items-center justify-center shrink-0">
                    <Icon name="history" className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-u-ink2">{e.action}</span>
                      <span className="text-[11px] text-u-muted whitespace-nowrap">{fmtDateTime(e.at)}</span>
                    </div>
                    <p className="text-[11px] text-u-muted">{e.user} · {e.record}</p>
                    {(e.before || e.after) && (
                      <p className="text-[11px] text-u-muted mt-0.5">
                        <span className="text-u-muted">Before:</span> {e.before || "—"} <span className="text-u-muted">→</span> <span className="text-u-muted">After:</span> {e.after || "—"}
                      </p>
                    )}
                    {e.notes && <p className="text-[11px] text-u-muted mt-0.5">{e.notes}</p>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <ReopenModal open={reopenOpen} onClose={() => setReopenOpen(false)} reconId={recon.id} />
      <CancelModal open={cancelOpen} onClose={() => setCancelOpen(false)} reconId={recon.id} />
      <FinalizeModal open={finalizeOpen} onClose={() => setFinalizeOpen(false)} reconId={recon.id} />
    </div>
  );
}
