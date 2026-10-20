import { Button } from "../ui/Button";
import { Field, Input, Select, Textarea } from "../ui/Field";
import { Modal } from "../ui/Modal";
import { useApp } from "../../context/AppContext";
import { getTenant, propertyLabel } from "../../data/catalog";
import type { Bill, PaymentMethod } from "../../types";
import { resolvedAllocations, sumRecoveries } from "../../utils/bills";
import { formatCAD, round2, todayISO } from "../../utils/format";
import { useEffect, useMemo, useState } from "react";

const methods: PaymentMethod[] = [
  "bank_transfer",
  "credit_card",
  "debit_card",
  "cheque",
  "cash",
  "other",
];

export function RecordRecoveryModal({
  open,
  onClose,
  bill,
  presetTenantId,
}: {
  open: boolean;
  onClose: () => void;
  bill: Bill | null;
  presetTenantId?: string;
}) {
  const { recoveries, addRecovery, pushToast } = useApp();
  const shares = useMemo(
    () => (bill ? resolvedAllocations(bill.amount, bill.allocations) : []),
    [bill],
  );
  const [tenantId, setTenantId] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [method, setMethod] = useState<PaymentMethod>("bank_transfer");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  const selected = shares.find((s) => s.tenantId === tenantId);
  const recovered = bill && tenantId ? sumRecoveries(recoveries, bill.id, tenantId) : 0;
  const remaining = selected ? round2(selected.share - recovered) : 0;

  useEffect(() => {
    if (!open || !bill) return;
    const initial = presetTenantId || shares[0]?.tenantId || "";
    setTenantId(initial);
    setDate(todayISO());
    setMethod("bank_transfer");
    setReference("");
    setNotes("");
    setError("");
  }, [open, bill, presetTenantId, shares]);

  useEffect(() => {
    if (!open) return;
    if (remaining > 0) setAmount(String(remaining));
    else setAmount("");
  }, [open, remaining, tenantId]);

  if (!bill) return null;
  const billId = bill.id;

  function save() {
    const value = round2(Number(amount));
    if (!tenantId) {
      setError("Select a tenant.");
      return;
    }
    if (!value || value <= 0) {
      setError("Enter an amount recovered.");
      return;
    }
    if (value > remaining + 0.001) {
      setError(`Cannot exceed remaining recovery of ${formatCAD(remaining)} for this tenant.`);
      return;
    }
    addRecovery({
      billId: billId,
      tenantId,
      amount: value,
      date,
      method,
      referenceNumber: reference || undefined,
      notes: notes || undefined,
    });
    pushToast(
      `Tenant recovery of ${formatCAD(value)} recorded. Provider invoice status is unchanged.`,
    );
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record tenant recovery"
      subtitle="Reimbursement from the tenant to the landlord — not a provider payment."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={shares.length === 0}>
            Record recovery
          </Button>
        </>
      }
    >
      {shares.length === 0 ? (
        <p className="text-sm text-u-muted">This bill has no tenant recovery. Allocation is 100% landlord.</p>
      ) : (
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-2 rounded-xl border border-u-line2 bg-u-bg p-3 text-sm">
            <div>
              <p className="text-[10px] text-u-muted uppercase">Related bill</p>
              <p className="text-u-ink">{bill.id}</p>
            </div>
            <div>
              <p className="text-[10px] text-u-muted uppercase">Property / unit</p>
              <p className="text-u-ink">{propertyLabel(bill.propertyId, bill.unitIds)}</p>
            </div>
          </div>
          <Field label="Tenant">
            <Select value={tenantId} onChange={(e) => setTenantId(e.target.value)}>
              {shares.map((s) => (
                <option key={s.tenantId} value={s.tenantId}>
                  {getTenant(s.tenantId)?.name} — share {formatCAD(s.share)}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-3 gap-2 rounded-lg border border-u-violet/20 bg-u-violet/8 p-3 text-xs">
            <div>
              <p className="text-u-muted">Tenant share</p>
              <p className="font-mono text-u-ink">{formatCAD(selected?.share ?? 0)}</p>
            </div>
            <div>
              <p className="text-u-muted">Recovered</p>
              <p className="font-mono text-u-violet">{formatCAD(recovered)}</p>
            </div>
            <div>
              <p className="text-u-muted">Outstanding</p>
              <p className="font-mono text-u-warn">{formatCAD(remaining)}</p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Amount recovered (CAD)" error={error}>
              <Input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </Field>
            <Field label="Recovery date">
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label="Payment method">
              <Select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
                {methods.map((m) => (
                  <option key={m} value={m}>
                    {m.replace("_", " ")}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Transaction / reference number">
              <Input value={reference} onChange={(e) => setReference(e.target.value)} />
            </Field>
            <Field label="Notes" className="sm:col-span-2">
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
          </div>
        </div>
      )}
    </Modal>
  );
}
