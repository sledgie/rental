import { useMemo, useState } from "react";
import { useStore } from "../lib/store";
import { computeRecon } from "../lib/calc";
import { Alert, Badge, Button, Card, DataTableWrap, Drawer, EmptyState, Field, Input, Modal, SegmentedTabs, StatCard, Th, Td, matchBadge } from "../components/ui";
import { Icon } from "../components/icons";
import { BankTxDrawer, BookTxDrawer } from "../components/recon/TxDrawers";
import { RecordMissingModal } from "../components/recon/WorkflowModals";
import { BankTransaction, BookTransaction } from "../lib/types";
import { ageLabel, fmtDate, moneySigned } from "../lib/format";

type Category =
  | "Bank Without Book Entry"
  | "Book Not Yet Found on Bank Statement"
  | "Potential Duplicate"
  | "Bank Fee or Interest Not Yet Recorded"
  | "Returned or Reversed Payment"
  | "Other Investigations";

interface UnmatchedItem {
  id: string;
  category: Category;
  date: string;
  amount: number;
  description: string;
  source: "Bank" | "Book";
  tx: BankTransaction | BookTransaction;
  reconId: string;
  accountId: string;
  suggestedResolution: string;
}

export default function UnmatchedPage() {
  const { state, updateBookTransaction } = useStore();
  const [cat, setCat] = useState<Category | "All">("All");
  const [search, setSearch] = useState("");
  const [bankDrawer, setBankDrawer] = useState<BankTransaction | null>(null);
  const [bookDrawer, setBookDrawer] = useState<BookTransaction | null>(null);
  const [missingTx, setMissingTx] = useState<BankTransaction | null>(null);
  const [resolved, setResolved] = useState<Set<string>>(new Set());
  const [noteTarget, setNoteTarget] = useState<{ kind: "bank" | "book"; id: string } | null>(null);
  const [note, setNote] = useState("");
  const [assignee, setAssignee] = useState("");

  const items = useMemo<UnmatchedItem[]>(() => {
    const out: UnmatchedItem[] = [];
    for (const recon of state.reconciliations) {
      if (recon.status === "Cancelled" || recon.status === "Reconciled") continue;
      const calc = computeRecon(state, recon);
      const account = state.accounts.find((a) => a.id === recon.accountId);
      for (const t of calc.unmatchedBank) {
        let category: Category = "Bank Without Book Entry";
        let resolution = "Match to a book transaction, record a missing transaction, or reject as duplicate.";
        if (t.duplicateOf) {
          category = "Potential Duplicate";
          resolution = "Compare with the original transaction and reject the duplicate, or keep both if both are legitimate.";
        } else if (/fee|charge|interest/i.test(t.description)) {
          category = "Bank Fee or Interest Not Yet Recorded";
          resolution = "Record the missing transaction with the appropriate expense or income account.";
        } else if (/revers|return/i.test(t.description)) {
          category = "Returned or Reversed Payment";
          resolution = "Confirm the reversal was posted to accounts receivable; match to the reversal entry.";
        } else if (account?.accountType === "Trust") {
          resolution = "Trust account item — verify deposit liability treatment before recording.";
        }
        out.push({ id: t.id, category, date: t.date, amount: t.signedAmount, description: t.description, source: "Bank", tx: t, reconId: recon.id, accountId: recon.accountId, suggestedResolution: resolution });
      }
      for (const t of calc.unmatchedBook) {
        let category: Category = "Book Not Yet Found on Bank Statement";
        let resolution = "Likely a deposit in transit or outstanding payment (timing difference). Verify in subsequent statements.";
        if (t.type === "returned_payment") {
          category = "Returned or Reversed Payment";
          resolution = "Confirm the bank reversal appears on the statement; match when it clears.";
        }
        if (t.moneyIn > 0) resolution = "Deposit in transit — expected to appear on a subsequent bank statement.";
        if (t.moneyOut > 0) resolution = "Outstanding payment — disbursement recorded but not yet on the statement.";
        out.push({ id: t.id, category, date: t.date, amount: t.signedAmount, description: t.description, source: "Book", tx: t, reconId: recon.id, accountId: recon.accountId, suggestedResolution: resolution });
      }
    }
    return out;
  }, [state]);

  const cats: (Category | "All")[] = ["All", "Bank Without Book Entry", "Book Not Yet Found on Bank Statement", "Potential Duplicate", "Bank Fee or Interest Not Yet Recorded", "Returned or Reversed Payment", "Other Investigations"];

  const filtered = items.filter((i) => {
    if (cat !== "All") {
      if (cat === "Other Investigations" && i.category !== "Other Investigations") return false;
      if (cat !== "Other Investigations" && i.category !== cat) return false;
    }
    if (search && !`${i.description} ${i.tx.reference ?? ""}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const openNote = (kind: "bank" | "book", id: string) => {
    const tx = kind === "bank" ? state.bankTxs.find((t) => t.id === id) : state.bookTxs.find((t) => t.id === id);
    setNote(tx?.notes ?? "");
    setAssignee(kind === "book" ? (tx as BookTransaction)?.assignee ?? "" : "");
    setNoteTarget({ kind, id });
  };

  const saveNote = () => {
    if (!noteTarget) return;
    if (noteTarget.kind === "bank") {
      // bank notes are edited in the drawer; keep book notes here
    } else {
      updateBookTransaction(noteTarget.id, { notes: note, assignee });
    }
    setNoteTarget(null);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-u-ink">Unmatched Transactions</h2>
          <p className="text-sm text-u-muted">Investigate discrepancies by category. Timing differences are not errors — they explain the balance gap.</p>
        </div>
        <div className="relative">
          <Icon name="search" className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-u-muted" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" className="w-52 pl-8" />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Unmatched Bank Txns" value={items.filter((i) => i.source === "Bank").length} tone="rose" icon="bank" />
        <StatCard label="Unmatched Book Txns" value={items.filter((i) => i.source === "Book").length} tone="amber" icon="ledger" />
        <StatCard label="Open Investigations" value={items.filter((i) => !resolved.has(i.id)).length} tone="violet" icon="alert" />
        <StatCard label="Resolved (session)" value={resolved.size} tone="emerald" icon="check" />
      </div>

      <Card>
        <div className="border-b border-u-line px-5 py-4">
          <SegmentedTabs
            tabs={cats.map((c) => ({ key: c, label: c, badge: c === "All" ? items.length : items.filter((i) => i.category === c).length }))}
            active={cat}
            onChange={(k) => setCat(k as Category | "All")}
          />
        </div>
        {filtered.length === 0 ? (
          <EmptyState icon="check" title="No unmatched transactions in this category" description="Matches, timing differences, and recordings clear items from this view automatically." />
        ) : (
          <DataTableWrap>
            <thead className="bg-u-s2">
              <tr>
                <Th>Date</Th>
                <Th>Amount</Th>
                <Th>Description</Th>
                <Th>Source</Th>
                <Th>Age</Th>
                <Th>Suggested Resolution</Th>
                <Th>Status</Th>
                <Th>Actions</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-u-line">
              {filtered.map((i) => {
                const isResolved = resolved.has(i.id);
                return (
                  <tr key={i.id} className="hover:bg-u-s2/60 align-top">
                    <Td className="whitespace-nowrap">{fmtDate(i.date)}</Td>
                    <Td className={`tabular-nums font-medium whitespace-nowrap ${i.amount >= 0 ? "text-u-ok" : "text-u-danger"}`}>{moneySigned(i.amount)}</Td>
                    <Td>
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => (i.source === "Bank" ? setBankDrawer(i.tx as BankTransaction) : setBookDrawer(i.tx as BookTransaction))}
                          className="font-medium text-u-accent hover:underline text-left"
                        >
                          {i.description}
                        </button>
                        <Badge kind={i.category === "Potential Duplicate" ? "duplicate" : i.category === "Bank Fee or Interest Not Yet Recorded" ? "review" : i.source === "Bank" ? "unmatched" : "outstanding"}>
                          {i.category}
                        </Badge>
                      </div>
                    </Td>
                    <Td>{i.source}</Td>
                    <Td className="whitespace-nowrap">{ageLabel(i.date)}</Td>
                    <Td className="max-w-xs text-xs text-u-muted">{i.suggestedResolution}</Td>
                    <Td>
                      {isResolved ? (
                        <Badge kind="matched" dot>Resolved</Badge>
                      ) : (
                        <Badge kind="review" dot>Open</Badge>
                      )}
                    </Td>
                    <Td>
                      <div className="flex flex-wrap gap-1">
                        <Button size="sm" variant="ghost" icon="info" onClick={() => (i.source === "Bank" ? setBankDrawer(i.tx as BankTransaction) : setBookDrawer(i.tx as BookTransaction))}>Details</Button>
                        {i.source === "Bank" && (
                          <Button size="sm" variant="outline" onClick={() => setMissingTx(i.tx as BankTransaction)}>Record Missing</Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => openNote(i.source === "Bank" ? "bank" : "book", i.id)}>Note</Button>
                        {!isResolved && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-u-ok"
                            onClick={() => setResolved((prev) => new Set(prev).add(i.id))}
                          >
                            Resolved
                          </Button>
                        )}
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </DataTableWrap>
        )}
      </Card>

      <Alert kind="info">
        Unmatched transactions do not automatically create accounting entries. Bank fees, interest, and legitimate missing activity are recorded through the record-missing workflow with the appropriate Chart of Accounts account. Timing differences remain outstanding until they clear.
      </Alert>

      <RecordMissingModal open={!!missingTx} onClose={() => setMissingTx(null)} bankTx={missingTx} />
      <BankTxDrawer tx={bankDrawer} open={!!bankDrawer} onClose={() => setBankDrawer(null)} />
      <BookTxDrawer tx={bookDrawer} open={!!bookDrawer} onClose={() => setBookDrawer(null)} />

      <Modal
        open={!!noteTarget}
        onClose={() => setNoteTarget(null)}
        title="Investigation Notes"
        subtitle={noteTarget ? `Transaction ${noteTarget.id}` : undefined}
        footer={<><Button variant="ghost" onClick={() => setNoteTarget(null)}>Cancel</Button><Button variant="primary" icon="check" onClick={saveNote}>Save</Button></>}
      >
        <div className="space-y-4">
          <Field label="Notes">
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Document the investigation…" />
          </Field>
          {noteTarget?.kind === "book" && (
            <Field label="Assigned To">
              <Input value={assignee} onChange={(e) => setAssignee(e.target.value)} placeholder="Assignee" />
            </Field>
          )}
          <p className="text-xs text-u-muted">Notes are recorded for investigators; they do not post accounting entries.</p>
        </div>
      </Modal>
    </div>
  );
}
