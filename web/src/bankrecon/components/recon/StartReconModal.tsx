import { useEffect, useMemo, useState } from "react";
import { useRouter } from "../../shim/route";
import { useStore } from "../../lib/store";
import { Alert, Button, Field, Input, Modal, Select, Textarea } from "../ui";
import { money, monthStart, monthEnd, toISO, fmtDate } from "../../lib/format";

export function StartReconModal({ open, onClose, accountId, onDone }: { open: boolean; onClose: () => void; accountId?: string; onDone?: (reconId: string) => void }) {
  const { state, startReconciliation } = useStore();
  const router = useRouter();

  const latestCompleted = useMemo(() => {
    if (!accountId) return null;
    return state.reconciliations
      .filter((r) => r.accountId === accountId && r.status === "Reconciled")
      .sort((a, b) => b.periodEnd.localeCompare(a.periodEnd))[0] ?? null;
  }, [state.reconciliations, accountId]);

  const [form, setForm] = useState({
    accountId: "",
    periodStart: toISO(monthStart(0)),
    periodEnd: toISO(monthEnd(0)),
    statementOpeningBalance: "",
    statementEndingBalance: "",
    statementRef: "",
    fileName: "",
    notes: "",
  });
  const [result, setResult] = useState<{ ok: boolean; error?: string; warnings: string[]; reconId?: string } | null>(null);

  useEffect(() => {
    if (open) {
      const first = accountId ?? state.accounts[0]?.id ?? "";
      const acct = state.accounts.find((a) => a.id === first);
      setForm({
        accountId: first,
        periodStart: toISO(monthStart(0)),
        periodEnd: toISO(monthEnd(0)),
        statementOpeningBalance: String(latestCompleted?.statementEndingBalance ?? acct?.openingBalance ?? 0),
        statementEndingBalance: String(latestCompleted?.statementEndingBalance ?? acct?.openingBalance ?? 0),
        statementRef: `STMT-${first.replace("BA-", "")}-${toISO(monthStart(0)).slice(0, 7).replace(/-/g, "")}`,
        fileName: "",
        notes: "",
      });
      setResult(null);
    }
  }, [open, accountId, state.accounts, latestCompleted]);

  const submit = () => {
    const opening = Number(form.statementOpeningBalance);
    const ending = Number(form.statementEndingBalance);
    if (!Number.isFinite(opening) || !Number.isFinite(ending)) {
      setResult({ ok: false, error: "Opening and ending balances must be valid numbers.", warnings: [] });
      return;
    }
    const res = startReconciliation({
      accountId: form.accountId,
      periodStart: form.periodStart,
      periodEnd: form.periodEnd,
      statementOpeningBalance: opening,
      statementEndingBalance: ending,
      statementRef: form.statementRef,
      fileName: form.fileName || null,
      notes: form.notes,
    });
    setResult(res);
    if (res.ok && res.reconId) {
      onDone?.(res.reconId);
      onClose();
      router.push(`/accounting/bank-reconciliation/workspace/${form.accountId}`);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Start Reconciliation"
      subtitle="Define the statement period and balances before importing transactions."
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" icon="play" onClick={submit}>
            Start Reconciliation
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {result && result.error && <Alert kind="danger">{result.error}</Alert>}
        {result && result.warnings.map((w, i) => (
          <Alert key={i} kind="warning">
            {w}
          </Alert>
        ))}
        {latestCompleted && (
          <Alert kind="info">
            Prefilled from the most recent completed reconciliation ({latestCompleted.statementRef}, ending {money(latestCompleted.statementEndingBalance)} on {fmtDate(latestCompleted.periodEnd)}).
          </Alert>
        )}
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Bank Account">
            <Select value={form.accountId} onChange={(e) => setForm({ ...form, accountId: e.target.value })}>
              {state.accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.maskedAccount})
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Statement Reference">
            <Input value={form.statementRef} onChange={(e) => setForm({ ...form, statementRef: e.target.value })} placeholder="STMT-OP-202510" />
          </Field>
          <Field label="Statement Start Date">
            <Input type="date" value={form.periodStart} onChange={(e) => setForm({ ...form, periodStart: e.target.value })} />
          </Field>
          <Field label="Statement Ending Date">
            <Input type="date" value={form.periodEnd} onChange={(e) => setForm({ ...form, periodEnd: e.target.value })} />
          </Field>
          <Field label="Statement Opening Balance" hint="Should match the previous statement ending balance.">
            <Input type="number" step="0.01" value={form.statementOpeningBalance} onChange={(e) => setForm({ ...form, statementOpeningBalance: e.target.value })} />
          </Field>
          <Field label="Statement Ending Balance" hint="Ending balance per the bank statement.">
            <Input type="number" step="0.01" value={form.statementEndingBalance} onChange={(e) => setForm({ ...form, statementEndingBalance: e.target.value })} />
          </Field>
          <Field label="Statement File (optional)">
            <Input value={form.fileName} onChange={(e) => setForm({ ...form, fileName: e.target.value })} placeholder="statement_202510.csv" />
          </Field>
          <Field label="Reconciliation Notes (optional)">
            <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>
        </div>
        <p className="text-xs text-u-muted">
          Overlapping active reconciliations are blocked. Opening balance inconsistencies require investigation and a documented, approved exception.
        </p>
      </div>
    </Modal>
  );
}
