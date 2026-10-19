import { useEffect, useMemo, useState } from "react";
import { Wallet } from "lucide-react";
import { Button } from "@inv/components/ui/Button";
import { Fieldset, Input, Select } from "@inv/components/ui/Field";
import { Modal } from "@inv/components/ui/Modal";
import { useToast } from "@inv/components/ui/Toast";
import { formatCAD, todayISO } from "@inv/lib/format";
import { invoiceBalance, invoiceTotal, type Invoice, type Payment } from "@inv/types/invoice";

const methods: Payment["method"][] = [
  "Bank Transfer",
  "E-Transfer",
  "Credit Card",
  "Pre-Authorized Debit",
  "Cheque",
  "Cash",
];

interface RecordPaymentModalProps {
  open: boolean;
  invoice?: Invoice;
  onClose: () => void;
  onSubmit: (input: {
    date: string;
    method: Payment["method"];
    reference: string;
    amount: number;
    notes?: string;
  }) => void;
}

export function RecordPaymentModal({
  open,
  invoice,
  onClose,
  onSubmit,
}: RecordPaymentModalProps) {
  const toast = useToast();
  const balance = invoice ? invoiceBalance(invoice) : 0;
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [method, setMethod] = useState<Payment["method"]>("Bank Transfer");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open || !invoice) return;
    setAmount(invoiceBalance(invoice).toFixed(2));
    setDate(todayISO());
    setMethod("Bank Transfer");
    setReference("");
    setNotes("");
  }, [open, invoice]);

  const parsed = Number(amount) || 0;
  const newBalance = useMemo(() => Math.max(0, balance - parsed), [balance, parsed]);
  const overpay = parsed > balance + 0.004;
  const valid = invoice !== undefined && parsed > 0 && reference.trim() !== "" && !overpay;

  if (!invoice) return null;
  const total = invoiceTotal(invoice);

  const submit = () => {
    if (!valid) {
      toast({
        kind: "warning",
        title: "Check the payment details",
        body: "Enter a positive amount that does not exceed the balance, plus a transaction reference.",
      });
      return;
    }
    onSubmit({
      date,
      method,
      reference: reference.trim(),
      amount: Math.round(parsed * 100) / 100,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      width="max-w-lg"
      title={`Record payment — ${invoice.id}`}
      description="Demonstration only. No gateway is contacted and no tenant is notified."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} disabled={!valid}>
            <Wallet className="size-4" />
            Record payment
          </Button>
        </>
      }
    >
      <div className="space-y-3.5">
        <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-line bg-line text-center">
          <div className="bg-surface-2 px-3 py-2.5">
            <dt className="text-[10.5px] uppercase tracking-wide text-ink-faint">Invoice total</dt>
            <dd className="mt-1 text-[14px] font-medium text-ink tabular-nums">
              {formatCAD(total)}
            </dd>
          </div>
          <div className="bg-surface-2 px-3 py-2.5">
            <dt className="text-[10.5px] uppercase tracking-wide text-ink-faint">Balance</dt>
            <dd className="mt-1 text-[14px] font-medium text-ink tabular-nums">
              {formatCAD(balance)}
            </dd>
          </div>
          <div className="bg-surface-2 px-3 py-2.5">
            <dt className="text-[10.5px] uppercase tracking-wide text-ink-faint">After payment</dt>
            <dd
              className={`mt-1 text-[14px] font-semibold tabular-nums ${
                newBalance <= 0.004 ? "text-paid" : "text-ink"
              }`}
            >
              {formatCAD(newBalance)}
            </dd>
          </div>
        </dl>

        <div className="grid grid-cols-2 gap-3">
          <Fieldset label="Amount (CAD)">
            <Input
              type="number"
              min={0}
              step={10}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              aria-invalid={overpay}
            />
          </Fieldset>
          <Fieldset label="Payment date">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Fieldset>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Fieldset label="Payment method">
            <Select
              value={method}
              onChange={(e) => setMethod(e.target.value as Payment["method"])}
            >
              {methods.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </Select>
          </Fieldset>
          <Fieldset label="Transaction reference">
            <Input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="WT-2026-00000"
            />
          </Fieldset>
        </div>

        <Fieldset label="Notes" hint="optional">
          <Input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Instalment 1 of 2 per payment plan"
          />
        </Fieldset>

        {overpay ? (
          <p className="rounded-lg border border-unpaid/30 bg-unpaid/10 px-3 py-2 text-[12.5px] text-unpaid">
            The amount entered exceeds the outstanding balance of {formatCAD(balance)}.
          </p>
        ) : (
          <p className="rounded-lg border border-line bg-surface-2/60 px-3 py-2 text-[12px] leading-relaxed text-ink-muted">
            Status updates automatically: partial payments set the invoice to
            <span className="text-[#b4c5ea]"> Partially Paid</span>, full payments to
            <span className="text-paid"> Paid</span>.
          </p>
        )}
      </div>
    </Modal>
  );
}
