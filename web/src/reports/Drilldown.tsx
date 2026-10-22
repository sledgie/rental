import { getDataset } from "./lib/data";
import { formatMoney } from "./lib/utils/currency";
import { Overlay } from "../tenants/components/ui";

export interface DrillState {
  kind: "journal" | "invoice" | "payment" | "bill" | "account" | "unavailable";
  id: string;
  title?: string;
}

export function Drilldown({
  drill,
  onClose,
  onOpen,
}: {
  drill: DrillState | null;
  onClose: () => void;
  onOpen: (next: DrillState) => void;
}) {
  if (!drill) return null;
  const ds = getDataset();

  return (
    <Overlay title={labelFor(drill)} subtitle="Drill-down" drawer onClose={onClose} className="fr-drill no-print">
      <div className="fr-drill-body">
        {drill.kind === "unavailable" ? (
          <p className="fr-d">The originating source transaction is not available in this dataset.</p>
        ) : drill.kind === "journal" ? (
          <JournalDetail id={drill.id} onOpen={onOpen} />
        ) : drill.kind === "invoice" ? (
          <InvoiceDetail id={drill.id} onOpen={onOpen} />
        ) : drill.kind === "payment" ? (
          <PaymentDetail id={drill.id} />
        ) : drill.kind === "bill" ? (
          <BillDetail id={drill.id} onOpen={onOpen} />
        ) : (
          <p className="fr-d">Account {ds.accounts.find((a) => a.accountId === drill.id)?.accountName}</p>
        )}
      </div>
    </Overlay>
  );
}

function labelFor(drill: DrillState) {
  if (drill.title) return drill.title;
  if (drill.kind === "journal") return "Journal entry";
  if (drill.kind === "invoice") return "Invoice";
  if (drill.kind === "payment") return "Payment";
  if (drill.kind === "bill") return "Vendor bill";
  return "Detail";
}

function JournalDetail({ id, onOpen }: { id: string; onOpen: (d: DrillState) => void }) {
  const ds = getDataset();
  const je = ds.journalEntries.find((j) => j.journalEntryId === id);
  if (!je) return <p className="fr-d">Journal entry not found.</p>;
  return (
    <div>
      <p className="fr-d">
        {je.journalEntryNumber} · {je.postingDate} · {je.status} · {je.sourceType.replaceAll("_", " ")}
      </p>
      <p className="fr-d">{je.description}</p>
      <table className="fin">
        <thead>
          <tr>
            <th>Account</th>
            <th>Property</th>
            <th className="num">Debit</th>
            <th className="num">Credit</th>
          </tr>
        </thead>
        <tbody>
          {je.lines.map((l) => {
            const acct = ds.accounts.find((a) => a.accountId === l.accountId);
            return (
              <tr key={l.journalLineId}>
                <td>
                  {acct?.accountCode} {acct?.accountName}
                </td>
                <td>{ds.properties.find((p) => p.propertyId === l.propertyId)?.propertyName ?? "Unallocated"}</td>
                <td className="num">{l.debitAmount ? formatMoney(l.debitAmount) : ""}</td>
                <td className="num">{l.creditAmount ? formatMoney(l.creditAmount) : ""}</td>
              </tr>
            );
          })}
          <tr className="total">
            <td colSpan={2}>Total</td>
            <td className="num">{formatMoney(je.debitTotal)}</td>
            <td className="num">{formatMoney(je.creditTotal)}</td>
          </tr>
        </tbody>
      </table>
      <div className="fr-actions">
        {je.sourceType === "tenant_invoice" || je.sourceType === "tenant_credit" ? (
          <button className="fr-link" onClick={() => onOpen({ kind: "invoice", id: je.sourceId })}>
            Open source invoice
          </button>
        ) : null}
        {je.sourceType === "tenant_payment" || je.sourceType === "unapplied_payment" ? (
          <button className="fr-link" onClick={() => onOpen({ kind: "payment", id: je.sourceId })}>
            Open source payment
          </button>
        ) : null}
        {je.sourceType === "vendor_bill" || je.sourceType === "capital_expenditure" ? (
          <button className="fr-link" onClick={() => onOpen({ kind: "bill", id: je.sourceId })}>
            Open source bill
          </button>
        ) : null}
      </div>
    </div>
  );
}

function InvoiceDetail({ id, onOpen }: { id: string; onOpen: (d: DrillState) => void }) {
  const ds = getDataset();
  const inv = ds.invoices.find((i) => i.invoiceId === id);
  if (!inv) return <p className="fr-d">Invoice not found.</p>;
  const tenant = ds.tenants.find((t) => t.tenantId === inv.tenantId);
  const allocs = ds.allocations.filter((a) => a.invoiceId === inv.invoiceId);
  const je = ds.journalEntries.find((j) => j.sourceId === inv.invoiceId && j.sourceType === "tenant_invoice");
  return (
    <div>
      <p className="fr-d">
        {inv.invoiceNumber} · {tenant?.tenantName} · {inv.status}
      </p>
      <p className="fr-d">
        Date {inv.invoiceDate} · Due {inv.dueDate} · Total {formatMoney(inv.totalAmount)}
      </p>
      <table className="fin">
        <thead>
          <tr>
            <th>Description</th>
            <th className="num">Amount</th>
            <th className="num">Tax</th>
          </tr>
        </thead>
        <tbody>
          {inv.lines.map((l) => (
            <tr key={l.lineId}>
              <td>{l.description}</td>
              <td className="num">{formatMoney(l.amount)}</td>
              <td className="num">{formatMoney(l.taxAmount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h3>Allocations</h3>
      {allocs.length === 0 ? <p className="fr-d">No payment allocations.</p> : null}
      <ul className="fr-notes">
        {allocs.map((a) => (
          <li key={a.allocationId}>
            {a.allocationDate} · {formatMoney(a.allocatedAmount)} · payment {a.paymentId}
          </li>
        ))}
      </ul>
      {je ? (
        <button className="fr-link" onClick={() => onOpen({ kind: "journal", id: je.journalEntryId })}>
          Open journal entry {je.journalEntryNumber}
        </button>
      ) : (
        <p className="fr-d">{inv.isOpening ? "Opening invoice — revenue was recognized in a prior year." : "No journal entry linked."}</p>
      )}
    </div>
  );
}

function PaymentDetail({ id }: { id: string }) {
  const ds = getDataset();
  const pmt = ds.payments.find((p) => p.paymentId === id);
  if (!pmt) return <p className="fr-d">Payment not found.</p>;
  const allocs = ds.allocations.filter((a) => a.paymentId === id);
  return (
    <div>
      <p className="fr-d">
        {pmt.paymentNumber} · {pmt.paymentDate} · {pmt.paymentMethod} · {formatMoney(pmt.totalAmount)}
      </p>
      <ul className="fr-notes">
        {allocs.length === 0 ? <li>Unapplied — this receipt is not allocated to an invoice.</li> : null}
        {allocs.map((a) => {
          const inv = ds.invoices.find((i) => i.invoiceId === a.invoiceId);
          return (
            <li key={a.allocationId}>
              Applied {formatMoney(a.allocatedAmount)} to {inv?.invoiceNumber}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function BillDetail({ id, onOpen }: { id: string; onOpen: (d: DrillState) => void }) {
  const ds = getDataset();
  const bill = ds.bills.find((b) => b.billId === id);
  if (!bill) return <p className="fr-d">Bill not found.</p>;
  const vendor = ds.vendors.find((v) => v.vendorId === bill.vendorId);
  const je = ds.journalEntries.find((j) => j.sourceId === bill.billId);
  return (
    <div>
      <p className="fr-d">
        {bill.billNumber} · {vendor?.vendorName} · {bill.paymentStatus}
      </p>
      <p className="fr-d">
        {bill.billDate} · Due {bill.dueDate} · {formatMoney(bill.totalAmount)}
      </p>
      <table className="fin">
        <thead>
          <tr>
            <th>Line</th>
            <th className="num">Amount</th>
          </tr>
        </thead>
        <tbody>
          {bill.lines.map((l) => (
            <tr key={l.lineId}>
              <td>
                {l.description}
                {l.isCapital ? " (capitalized)" : ""}
              </td>
              <td className="num">{formatMoney(l.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {je ? (
        <button className="fr-link" onClick={() => onOpen({ kind: "journal", id: je.journalEntryId })}>
          Open journal entry {je.journalEntryNumber}
        </button>
      ) : null}
    </div>
  );
}
