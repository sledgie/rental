import { Button } from "../ui/Button";
import { Field, Input, Select, Textarea } from "../ui/Field";
import { Modal } from "../ui/Modal";
import { useApp } from "../../context/AppContext";
import { getProvider } from "../../data/catalog";
import type { Bill, PaymentMethod } from "../../types";
import { providerBalance } from "../../utils/bills";
import { formatCAD, round2, todayISO } from "../../utils/format";
import { useEffect, useState } from "react";

const methods: PaymentMethod[] = [
  "bank_transfer",
  "credit_card",
  "debit_card",
  "cheque",
  "cash",
  "other",
];

export function RecordPaymentModal({
  open,
  onClose,
  bill,
}: {
  open: boolean;
  onClose: () => void;
  bill: Bill | null;
}) {
  const { payments, addPayment, pushToast } = useApp();
  const remaining = bill ? providerBalance(bill, payments) : 0;
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [method, setMethod] = useState<PaymentMethod>("bank_transfer");
  const [reference, setReference] = useState("");
  const [account, setAccount] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (open && bill) {
      setAmount(remaining > 0 ? String(remaining) : "");
      setDate(todayISO());
      setMethod("bank_transfer");
      setReference("");
      setAccount("");
      setNotes("");
      setError("");
    }
  }, [open, bill, remaining]);

  if (!bill) return null;
  const billId = bill.id;

  function save() {
    const value = round2(Number(amount));
    if (!value || value <= 0) {
      setError("Enter a payment amount.");
      return;
    }
    if (value > remaining + 0.001) {
      setError(
        `Payment cannot exceed the remaining provider balance of ${formatCAD(remaining)}. Overpayments are not enabled.`,
      );
      return;
    }
    addPayment({
      billId: billId,
      amount: value,
      date,
      method,
      referenceNumber: reference || undefined,
      account: account || undefined,
      notes: notes || undefined,
    });
    pushToast(
      `Provider payment of ${formatCAD(value)} recorded. Tenant recovery is unchanged.`,
    );
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record provider payment"
      subtitle={`${bill.id} · ${bill.name}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={remaining <= 0}>
            Record payment
          </Button>
        </>
      }
    >
      <div className="mb-4 grid grid-cols-3 gap-2 rounded-xl border border-u-line2 bg-u-bg p-3">
        <div>
          <p className="text-[10px] tracking-wide text-u-muted uppercase">Provider</p>
          <p className="text-sm text-u-ink">{getProvider(bill.providerId)?.name}</p>
        </div>
        <div>
          <p className="text-[10px] tracking-wide text-u-muted uppercase">Invoice</p>
          <p className="font-mono text-sm text-u-ink">{formatCAD(bill.amount)}</p>
        </div>
        <div>
          <p className="text-[10px] tracking-wide text-u-muted uppercase">Outstanding</p>
          <p className="font-mono text-sm text-u-warn">{formatCAD(remaining)}</p>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Payment amount (CAD)" error={error}>
          <Input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field label="Payment date">
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
        <Field label="Payment account (optional)" className="sm:col-span-2">
          <Input
            value={account}
            onChange={(e) => setAccount(e.target.value)}
            placeholder="Operating — TD ****4412"
          />
        </Field>
        <Field label="Notes" className="sm:col-span-2">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}
