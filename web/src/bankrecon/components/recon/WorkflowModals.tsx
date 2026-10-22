import { useState } from "react";
import { useStore } from "../../lib/store";
import { computeRecon } from "../../lib/calc";
import { Alert, Button, Checkbox, Field, Input, Modal, Select, Textarea } from "../ui";
import { money, moneySigned, fmtDate } from "../../lib/format";
import { BankTransaction, BookTxType, TX_TYPE_META } from "../../lib/types";

// ---------------------------------------------------------------------------
// Finalize
// ---------------------------------------------------------------------------

export function FinalizeModal({ open, onClose, reconId, onDone }: { open: boolean; onClose: () => void; reconId: string; onDone?: () => void }) {
  const { state, finalizeReconciliation, user } = useStore();
  const recon = state.reconciliations.find((r) => r.id === reconId);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!recon) return null;
  const account = state.accounts.find((a) => a.id === recon.accountId)!;
  const calc = computeRecon(state, recon);
  const approved = state.settings.approvalRequired ? user.permissions.includes("approve_adjustments") : true;

  const submit = () => {
    const res = finalizeReconciliation(reconId, confirmed);
    if (!res.ok) {
      setError(res.error ?? "Finalization failed.");
      return;
    }
    setError(null);
    onDone?.();
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Finalize Reconciliation"
      subtitle={`${account.name} · ${fmtDate(recon.periodStart)} – ${fmtDate(recon.periodEnd)}`}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="success"
            icon="lock"
            disabled={!confirmed || !approved}
            title={approved ? undefined : "Finalization requires approval permissions (approve adjustments)."}
            onClick={submit}
          >
            Finalize & Lock
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <Alert kind="danger">{error}</Alert>}
        {!approved && <Alert kind="warning">Your role cannot approve adjustments. Finalization requires an approver — switch to the Accounting Admin user in the header to complete this step.</Alert>}
        {calc.hasUnresolvedBankItems && <Alert kind="danger">{calc.unmatchedBank.length} unmatched bank transaction(s) remain. Resolve, record, or reject them before finalizing.</Alert>}
        {!calc.isBalanced && <Alert kind="danger">Adjusted balances do not agree — remaining difference {moneySigned(calc.remainingDifference)}. Unexplained differences cannot be written off.</Alert>}

        <div className="rounded-xl border border-u-line divide-y divide-u-line">
          {[
            ["Bank Account", `${account.name} (${account.maskedAccount})`],
            ["Statement Period", `${fmtDate(recon.periodStart)} – ${fmtDate(recon.periodEnd)}`],
            ["Statement Ending Balance", money(calc.statementEndingBalance)],
            ["Add: Deposits in Transit", money(calc.depositsInTransitAmount)],
            ["Less: Outstanding Payments", `(${money(calc.outstandingPaymentsAmount)})`],
            ["Adjusted Bank Balance", money(calc.adjustedBank)],
            ["Book Balance", money(calc.bookBalance)],
            ["Adjusted Book Balance", money(calc.adjustedBook)],
            ["Remaining Difference", moneySigned(calc.remainingDifference)],
            ["Matched Transactions", `${calc.matchedBankCount} bank / ${calc.matchedBookCount} book`],
            ["Outstanding Timing Differences", `${calc.depositsInTransit.length + calc.outstandingPayments.length} item(s)`],
            ["Unresolved Transactions", `${calc.unmatchedBank.length + calc.unmatchedBook.length} item(s)`],
          ].map(([k, v]) => (
            <div key={k} className="flex items-center justify-between gap-4 px-4 py-2.5">
              <span className="text-xs text-u-muted">{k}</span>
              <span className="text-sm font-medium text-u-ink tabular-nums">{v}</span>
            </div>
          ))}
        </div>

        <div className="rounded-lg border border-u-warn/30 bg-u-warn-soft/60 px-3.5 py-2.5">
          <Checkbox checked={confirmed} onChange={setConfirmed} label={<span className="text-xs text-u-warn">I confirm the adjusted balances agree within currency precision, all material discrepancies are resolved or approved, and no unexplained difference remains.</span>} />
        </div>
        <p className="text-xs text-u-muted">
          Finalizing locks this reconciliation against ordinary editing. Corrections require an authorized reopening with a recorded reason and audit entry.
        </p>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Reopen
// ---------------------------------------------------------------------------

export function ReopenModal({ open, onClose, reconId, onDone }: { open: boolean; onClose: () => void; reconId: string; onDone?: () => void }) {
  const { state, reopenReconciliation } = useStore();
  const recon = state.reconciliations.find((r) => r.id === reconId);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!recon) return null;
  const canReopen = state.users.find((u) => u.id === state.currentUserId)?.permissions.includes("reopen_reconciliation") &&
    (state.settings.reopenPermission !== "admin" || state.users.find((u) => u.id === state.currentUserId)?.role === "Accounting Admin");

  const submit = () => {
    const res = reopenReconciliation(reconId, reason);
    if (!res.ok) {
      setError(res.error ?? "Reopen failed.");
      return;
    }
    onDone?.();
    onClose();
    setReason("");
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Reopen Reconciliation"
      subtitle={recon.reference}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" icon="unlock" disabled={!reason.trim() || !canReopen} title={canReopen ? undefined : "Reopening requires reopen permission and (per settings) an Accounting Admin."} onClick={submit}>
            Reopen
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <Alert kind="danger">{error}</Alert>}
        <Alert kind="warning">
          Reopening preserves the previous completed state and audit trail. The reconciliation must be finalized again after corrections. Silent modification of historical records is not allowed.
        </Alert>
        <Field label="Reopen Reason (required)" hint="This reason is recorded in the audit log.">
          <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Deposit refund posted after finalization — correcting the match." />
        </Field>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Cancel
// ---------------------------------------------------------------------------

export function CancelModal({ open, onClose, reconId, onDone }: { open: boolean; onClose: () => void; reconId: string; onDone?: () => void }) {
  const { state, cancelReconciliation } = useStore();
  const recon = state.reconciliations.find((r) => r.id === reconId);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!recon) return null;

  const submit = () => {
    const res = cancelReconciliation(reconId, reason);
    if (!res.ok) {
      setError(res.error ?? "Cancellation failed.");
      return;
    }
    onDone?.();
    onClose();
    setReason("");
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Cancel Reconciliation"
      subtitle={recon.reference}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Keep Working
          </Button>
          <Button variant="danger" disabled={!reason.trim()} onClick={submit}>
            Cancel Reconciliation
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <Alert kind="danger">{error}</Alert>}
        <Alert kind="warning">Cancelling records the reason in the audit log and frees the statement period. This is not a deletion — the reconciliation remains in history.</Alert>
        <Field label="Cancellation Reason (required)">
          <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Duplicate statement import discovered." />
        </Field>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Record Missing Transaction (bank activity missing from the books)
// ---------------------------------------------------------------------------

export function RecordMissingModal({ open, onClose, bankTx, onDone }: { open: boolean; onClose: () => void; bankTx: BankTransaction | null; onDone?: (txId: string) => void }) {
  const { state, addBookTransaction } = useStore();
  const [type, setType] = useState<BookTxType>("bank_fee");
  const [coa, setCoa] = useState(state.coa[0]?.code ?? "");
  const [description, setDescription] = useState("");
  const [counterparty, setCounterparty] = useState("");
  const [reference, setReference] = useState("");
  const [date, setDate] = useState("");
  const [moneyIn, setMoneyIn] = useState("");
  const [moneyOut, setMoneyOut] = useState("");
  const [error, setError] = useState<string | null>(null);

  // reset prefilled values whenever a new bank tx is selected
  const [lastId, setLastId] = useState<string | null>(null);
  if (open && bankTx && bankTx.id !== lastId) {
    setLastId(bankTx.id);
    const defaultType: BookTxType = bankTx.credit > 0 ? "interest_income" : "bank_fee";
    setType(defaultType);
    setCoa(defaultType === "interest_income" ? "6100" : "5300");
    setDescription(bankTx.description);
    setCounterparty("Bank");
    setReference(bankTx.reference);
    setDate(bankTx.date);
    if (bankTx.credit > 0) {
      setMoneyIn(String(bankTx.credit));
      setMoneyOut("");
    } else {
      setMoneyIn("");
      setMoneyOut(String(bankTx.debit));
    }
    setError(null);
  }

  const direction = TX_TYPE_META[type].direction;
  const inAmt = direction === "in" ? Number(moneyIn) : 0;
  const outAmt = direction === "out" ? Number(moneyOut) : 0;

  const submit = () => {
    setError(null);
    if (!description.trim()) return setError("Description is required.");
    if (!Number.isFinite(inAmt + outAmt) || inAmt + outAmt <= 0) return setError("Enter a valid amount.");
    if (direction === "in" && inAmt <= 0) return setError("This transaction type requires a money-in amount.");
    if (direction === "out" && outAmt <= 0) return setError("This transaction type requires a money-out amount.");
    if (!coa) return setError("Select a Chart of Accounts account.");
    const tx = addBookTransaction({
      accountId: bankTx?.accountId ?? state.accounts[0].id,
      date,
      type,
      description,
      counterparty: counterparty || "Bank",
      propertyId: null,
      unit: null,
      reference,
      invoices: [],
      moneyIn: r2Safe(inAmt),
      moneyOut: r2Safe(outAmt),
      coa,
      source: `Recorded during reconciliation ${bankTx ? "(missing bank transaction)" : ""} — mock journal entry`,
      postingStatus: "Posted",
    });
    onDone?.(tx.id);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record Missing Transaction"
      subtitle="Create a book (ledger) entry for bank activity that is missing from the accounting records."
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" icon="check" onClick={submit}>
            Confirm Entry
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <Alert kind="danger">{error}</Alert>}
        {bankTx && (
          <Alert kind="info">
            Bank transaction “{bankTx.description}” ({moneySigned(bankTx.signedAmount)}, {fmtDate(bankTx.date)}) has no book entry. Recording a balanced entry makes it eligible for matching. This is a simulated posting in the demo environment.
          </Alert>
        )}
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Transaction Type" hint="Do not classify unexplained inflows as rental income or outflows as operating expense by default.">
            <Select value={type} onChange={(e) => setType(e.target.value as BookTxType)}>
              {Object.entries(TX_TYPE_META).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Chart of Accounts Account">
            <Select value={coa} onChange={(e) => setCoa(e.target.value)}>
              {state.coa.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} — {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Date">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Reference">
            <Input value={reference} onChange={(e) => setReference(e.target.value)} />
          </Field>
          <Field label="Description">
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
          <Field label="Payee / Counterparty">
            <Input value={counterparty} onChange={(e) => setCounterparty(e.target.value)} />
          </Field>
          {direction === "in" ? (
            <Field label="Money In (Credit)">
              <Input type="number" step="0.01" value={moneyIn} onChange={(e) => setMoneyIn(e.target.value)} />
            </Field>
          ) : (
            <Field label="Money Out (Debit)">
              <Input type="number" step="0.01" value={moneyOut} onChange={(e) => setMoneyOut(e.target.value)} />
            </Field>
          )}
        </div>
        <div className="rounded-lg border border-u-line bg-u-s2/60 px-4 py-3 text-xs">
          <p className="font-medium text-u-ink2 mb-1">Proposed accounting entry (preview)</p>
          <p className="text-u-muted">
            {direction === "in" ? `Debit Bank Account (${coa})` : `Credit Bank Account (${coa})`} {" "}
            {direction === "in" ? money(inAmt) : money(outAmt)}{" "}
            {direction === "in" ? `/ Credit ${coa}` : `/ Debit ${coa}`} {" "}
            {direction === "in" ? money(inAmt) : money(outAmt)}
          </p>
          <p className="text-u-muted mt-1">Balanced entry using the bank account's linked cash account. Entries involving tenant deposits or trust accounts require additional review.</p>
        </div>
      </div>
    </Modal>
  );
}

function r2Safe(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// ---------------------------------------------------------------------------
// Adjustment
// ---------------------------------------------------------------------------

export function AdjustmentModal({ open, onClose, reconId, onDone }: { open: boolean; onClose: () => void; reconId: string; onDone?: () => void }) {
  const { state, addAdjustment } = useStore();
  const recon = state.reconciliations.find((r) => r.id === reconId);
  const [side, setSide] = useState<"bank" | "book">("bank");
  const [kind, setKind] = useState("Bank-side adjustment");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [coa, setCoa] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!recon) return null;

  const submit = () => {
    setError(null);
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt === 0) return setError("Enter a non-zero amount.");
    if (!description.trim()) return setError("A description is required.");
    const res = addAdjustment({
      reconciliationId: reconId,
      side,
      kind,
      amount: side === "bank" ? amt : -amt,
      description,
      coa: coa || null,
      notes: "",
    });
    if (!res.ok) return setError(res.error ?? "Failed to add adjustment.");
    onDone?.();
    onClose();
    setAmount("");
    setDescription("");
    setCoa("");
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add Reconciliation Adjustment"
      subtitle={recon.reference}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" icon="check" onClick={submit}>
            Add & Approve
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <Alert kind="danger">{error}</Alert>}
        <Alert kind="warning">
          Adjustments are recorded with an audit trail and require approval permissions. They never silently alter finalized reconciliations. Do not use adjustments to hide unexplained differences — investigate them first.
        </Alert>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Adjustment Side">
            <Select value={side} onChange={(e) => setSide(e.target.value as "bank" | "book")}>
              <option value="bank">Bank-side (applied to adjusted bank balance)</option>
              <option value="book">Book-side (applied to adjusted book balance)</option>
            </Select>
          </Field>
          <Field label="Kind">
            <Input value={kind} onChange={(e) => setKind(e.target.value)} placeholder="e.g. Bank error correction" />
          </Field>
          <Field label="Amount (positive)">
            <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <Field label="Chart of Accounts (optional)">
            <Select value={coa} onChange={(e) => setCoa(e.target.value)}>
              <option value="">— none —</option>
              {state.coa.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} — {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field className="sm:col-span-2" label="Description">
            <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
        </div>
      </div>
    </Modal>
  );
}
