import { useState } from "react";
import { useStore } from "../../lib/store";
import { Alert, Badge, Button, Drawer, Field, Input, Textarea, confidenceBadge, matchBadge } from "../ui";
import { BankTransaction, BookTransaction } from "../../lib/types";
import { TX_TYPE_META } from "../../lib/types";
import { fmtDate, fmtDateTime, money, moneySigned } from "../../lib/format";

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5">
      <span className="text-xs text-u-muted whitespace-nowrap">{k}</span>
      <span className="text-xs text-u-ink2 text-right break-all">{v}</span>
    </div>
  );
}

export function BankTxDrawer({ tx, open, onClose }: { tx: BankTransaction | null; open: boolean; onClose: () => void }) {
  const { state, updateBankTransaction } = useStore();
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState(false);

  if (tx && open && note !== tx.notes) setNote(tx.notes);

  const activeMatch = state.matches.find((m) => m.active && m.bankTxIds.includes(tx?.id ?? ""));
  const matchHistory = state.matches.filter((m) => m.bankTxIds.includes(tx?.id ?? "")).flatMap((m) =>
    m.history.map((h) => ({ ...h, matchId: m.id, confidence: m.confidenceLevel })),
  );
  const property = state.properties.find((p) => p.id === tx?.accountId);

  return (
    <Drawer open={open} onClose={onClose} title="Bank Statement Transaction" width="max-w-lg">
      {tx && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            {activeMatch ? matchBadge("Matched") : tx.duplicateOf ? <Badge kind="duplicate" dot>Potential Duplicate</Badge> : matchBadge("Unmatched")}
            <span className="text-sm font-semibold tabular-nums" style={{ color: tx.signedAmount >= 0 ? "var(--ok)" : "var(--danger)" }}>
              {moneySigned(tx.signedAmount)}
            </span>
          </div>

          <div className="rounded-lg border border-u-line divide-y divide-u-line">
            <Row k="Transaction Date" v={fmtDate(tx.date)} />
            <Row k="Posted Date" v={tx.postedDate ? fmtDate(tx.postedDate) : "—"} />
            <Row k="Description" v={tx.description} />
            <Row k="Reference Number" v={tx.reference} />
            <Row k="Money In (Credit)" v={money(tx.credit)} />
            <Row k="Money Out (Debit)" v={money(tx.debit)} />
            <Row k="Transaction Amount" v={moneySigned(tx.signedAmount)} />
            <Row k="Running Balance" v={tx.runningBalance !== null ? money(tx.runningBalance) : "—"} />
            <Row k="Import Batch" v={tx.batchId} />
            <Row k="Fingerprint" v={tx.fingerprint} />
            <Row k="Account" v={`${property ? "" : ""}${state.accounts.find((a) => a.id === tx.accountId)?.name ?? tx.accountId}`} />
            <Row k="Manual Entry" v={tx.manualEntry ? "Yes" : "No"} />
            <Row k="Imported At" v={fmtDateTime(tx.importedAt)} />
          </div>

          {activeMatch && (
            <div className="rounded-lg border border-u-ok/30 bg-u-ok-soft/50 p-3">
              <p className="text-xs font-medium text-u-ok">Confirmed match</p>
              <p className="text-xs text-u-ok mt-1">
                {confidenceBadge(activeMatch.confidenceLevel)} · {activeMatch.explanation}
              </p>
              <p className="text-[11px] text-u-ok mt-1">
                Matched to book transaction(s): {activeMatch.bookTxIds.map((id) => state.bookTxs.find((b) => b.id === id)?.description).join("; ")}
              </p>
              <p className="text-[11px] text-u-ok mt-1">Confirmed by {activeMatch.confirmedBy} at {fmtDateTime(activeMatch.confirmedAt)}</p>
            </div>
          )}

          <div>
            <p className="text-xs font-semibold text-u-ink2 mb-1.5">Match History (preserved)</p>
            {matchHistory.length === 0 ? (
              <p className="text-xs text-u-muted">No match history.</p>
            ) : (
              <ul className="space-y-1.5">
                {matchHistory.map((h, i) => (
                  <li key={i} className="rounded-lg border border-u-line p-2.5 text-[11px]">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-u-ink2">{h.action}</span>
                      <span className="text-u-muted">{fmtDateTime(h.at)}</span>
                    </div>
                    <p className="text-u-muted mt-0.5">{h.by} · {h.note || "—"}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <p className="text-xs font-semibold text-u-ink2 mb-1.5">Investigation Notes</p>
            <Field label="">
              <Textarea rows={3} value={note} onChange={(e) => { setNote(e.target.value); setSaved(false); }} placeholder="Add context for investigators…" />
            </Field>
            <div className="flex items-center gap-2 mt-1.5">
              <Button
                size="sm"
                variant="secondary"
                icon="check"
                onClick={() => {
                  updateBankTransaction(tx.id, { notes: note });
                  setSaved(true);
                }}
              >
                Save Note
              </Button>
              {saved && <span className="text-xs text-u-ok">Saved</span>}
            </div>
          </div>

          <Alert kind="info">
            This is the bank's perspective: credits are deposits (money in), debits are withdrawals (money out). Unmatched bank items create an unexplained difference until matched or recorded.
          </Alert>
        </div>
      )}
    </Drawer>
  );
}

export function BookTxDrawer({ tx, open, onClose }: { tx: BookTransaction | null; open: boolean; onClose: () => void }) {
  const { state, updateBookTransaction, can } = useStore();
  const [note, setNote] = useState("");
  const [assignee, setAssignee] = useState("");

  if (tx && open) {
    if (note !== tx.notes) setNote(tx.notes);
    if (assignee !== tx.assignee) setAssignee(tx.assignee);
  }

  const activeMatch = state.matches.find((m) => m.active && m.bookTxIds.includes(tx?.id ?? ""));
  const property = tx ? state.properties.find((p) => p.id === tx.propertyId) : null;

  return (
    <Drawer open={open} onClose={onClose} title="Book Transaction (Ledger)" width="max-w-lg">
      {tx && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            {activeMatch ? matchBadge("Matched") : matchBadge("Unmatched")}
            <span className="text-sm font-semibold tabular-nums" style={{ color: tx.signedAmount >= 0 ? "var(--ok)" : "var(--danger)" }}>
              {moneySigned(tx.signedAmount)}
            </span>
          </div>

          <div className="rounded-lg border border-u-line divide-y divide-u-line">
            <Row k="Transaction Date" v={fmtDate(tx.date)} />
            <Row k="Transaction Type" v={<Badge kind="neutral">{TX_TYPE_META[tx.type].label}</Badge>} />
            <Row k="Description" v={tx.description} />
            <Row k="Tenant / Vendor / Payee" v={tx.counterparty} />
            <Row k="Property / Unit" v={<>{property ? property.name : "—"}{tx.unit ? <span> · Unit {tx.unit}</span> : null}</>} />
            <Row k="Payment / Journal Reference" v={tx.reference} />
            <Row k="Source Record" v={tx.source} />
            <Row k="Money In" v={money(tx.moneyIn)} />
            <Row k="Money Out" v={money(tx.moneyOut)} />
            <Row k="Chart of Accounts" v={`${tx.coa} — ${state.coa.find((c) => c.code === tx.coa)?.name ?? ""}`} />
            <Row k="Posting Status" v={tx.postingStatus} />
            <Row k="Created At" v={fmtDateTime(tx.createdAt)} />
          </div>

          {tx.invoices.length > 0 && (
            <div className="rounded-lg border border-u-accent/30 bg-u-accent-soft/40 p-3">
              <p className="text-xs font-medium text-u-accent">Invoices settled by this payment (one payment covering multiple invoices)</p>
              <ul className="mt-1.5 space-y-1">
                {tx.invoices.map((inv) => (
                  <li key={inv.id} className="flex items-center justify-between text-xs text-u-accent">
                    <span>{inv.number}</span>
                    <span className="tabular-nums">{money(inv.amount)}</span>
                  </li>
                ))}
              </ul>
              <p className="text-[11px] text-u-accent mt-1.5">Income and accounts receivable are not duplicated during reconciliation — the payment record preserves the invoice links.</p>
            </div>
          )}

          {activeMatch && (
            <div className="rounded-lg border border-u-ok/30 bg-u-ok-soft/50 p-3">
              <p className="text-xs font-medium text-u-ok">Confirmed match</p>
              <p className="text-xs text-u-ok mt-1">
                {confidenceBadge(activeMatch.confidenceLevel)} · {activeMatch.explanation}
              </p>
              <p className="text-[11px] text-u-ok mt-1">
                Bank transaction(s): {activeMatch.bankTxIds.map((id) => state.bankTxs.find((b) => b.id === id)?.description).join("; ")}
              </p>
              <p className="text-[11px] text-u-ok mt-1">Confirmed by {activeMatch.confirmedBy} at {fmtDateTime(activeMatch.confirmedAt)}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Investigation Notes">
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Notes…" />
            </Field>
            <Field label="Assigned To">
              <Input value={assignee} onChange={(e) => setAssignee(e.target.value)} placeholder="Assignee" />
            </Field>
          </div>
          <Button
            size="sm"
            variant="secondary"
            icon="check"
            disabled={!can("match_transactions") || !note || note === tx.notes}
            onClick={() => updateBookTransaction(tx.id, { notes: note, assignee })}
          >
            Save Notes & Assignment
          </Button>

          <Alert kind="info">
            {tx.type === "tenant_deposit" || tx.type === "deposit_refund"
              ? "Tenant deposit activity: credits increase the deposit liability (not rental income); refunds relieve it. Trust account safeguards apply."
              : "This transaction comes from the accounting ledger (payment records or journal entries). It must not be reclassified merely to clear a reconciliation difference."}
          </Alert>
        </div>
      )}
    </Drawer>
  );
}
