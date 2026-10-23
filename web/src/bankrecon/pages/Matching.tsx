import { useMemo, useState } from "react";
import Link from "../shim/link";
import { useStore } from "../lib/store";
import { computeRecon, withinPeriod } from "../lib/calc";
import { suggestForBankTx, suggestForBookTxManyToOne, Suggestion } from "../lib/matching";
import { Alert, Badge, Button, Card, DataTableWrap, EmptyState, Select, StatCard, Th, Td, confidenceBadge } from "../components/ui";
import { moneySigned, fmtDate } from "../lib/format";

export default function MatchingPage() {
  const { state, createMatch, can } = useStore();
  const [accountId, setAccountId] = useState(state.accounts[0]?.id ?? "");

  const recon = useMemo(
    () => state.reconciliations.filter((r) => r.accountId === accountId && r.status !== "Cancelled").sort((a, b) => b.periodStart.localeCompare(a.periodStart))[0],
    [state.reconciliations, accountId],
  );

  const items = useMemo(() => {
    if (!recon) return [];
    const bankInPeriod = state.bankTxs.filter((t) => t.accountId === accountId && withinPeriod(t.date, recon.periodStart, recon.periodEnd));
    const bookInPeriod = state.bookTxs.filter((t) => t.accountId === accountId && withinPeriod(t.date, recon.periodStart, recon.periodEnd));
    const activeMatches = state.matches.filter((m) => m.reconciliationId === recon.id && m.active);
    const usedBank = new Set(activeMatches.flatMap((m) => m.bankTxIds));
    const usedBook = new Set(activeMatches.flatMap((m) => m.bookTxIds));
    const ctx = { bankTxs: bankInPeriod, bookTxs: bookInPeriod, settings: state.settings, usedBankIds: usedBank, usedBookIds: usedBook };

    const out: { kind: "bank" | "book"; bankId: string; bookIds: string[]; bankIds: string[]; sug: Suggestion }[] = [];
    if (state.settings.autoMatching) {
      for (const b of bankInPeriod) {
        if (usedBank.has(b.id)) continue;
        const s = suggestForBankTx(b, ctx);
        if (s) out.push({ kind: "bank", bankId: b.id, bookIds: s.bookIds, bankIds: [b.id], sug: s });
      }
      const covered = new Set<string>();
      for (const s of out.map((o) => o.sug)) s.bookIds.forEach((id) => covered.add(id));
      for (const b of bookInPeriod) {
        if (usedBook.has(b.id) || covered.has(b.id)) continue;
        const s = suggestForBookTxManyToOne(b, ctx);
        if (s) out.push({ kind: "book", bankId: s.bankIds[0], bookIds: [b.id], bankIds: s.bankIds, sug: s });
      }
    }
    return out;
  }, [state, accountId, recon]);

  const account = state.accounts.find((a) => a.id === accountId);
  const calc = recon ? computeRecon(state, recon) : null;
  const activeMatches = state.matches.filter((m) => m.reconciliationId === recon?.id && m.active);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-u-ink">Transaction Matching</h2>
          <p className="text-sm text-u-muted">Review and act on suggested matches for the selected account and period.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={accountId} onChange={(e) => setAccountId(e.target.value)} className="w-72">
            {state.accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </Select>
          {recon && (
            <Link href={`/accounting/bank-reconciliation/workspace/${accountId}`}>
              <Button size="sm" variant="secondary" icon="arrowRight">Open Workspace</Button>
            </Link>
          )}
        </div>
      </div>

      {recon && calc && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Suggested Matches" value={items.length} hint="Across both directions" icon="check" tone="indigo" />
          <StatCard label="Confirmed Matches" value={activeMatches.length} hint="One-to-one, grouped, or netted" icon="match" tone="emerald" />
          <StatCard label="Unmatched Bank Txns" value={calc.unmatchedBank.length} tone="rose" />
          <StatCard label="Unmatched Book Txns" value={calc.unmatchedBook.length} tone="amber" />
        </div>
      )}

      <Card>
        <div className="border-b border-u-line px-5 py-4">
          <h2 className="text-sm font-semibold text-u-ink">Match Suggestions Queue</h2>
          <p className="text-xs text-u-muted">
            Suggestions are generated from the matching engine (amount, date tolerance, reference, description, type, direction). A suggested match is not a confirmed match.
          </p>
        </div>
        {!recon ? (
          <EmptyState icon="bank" title="No reconciliation for this account" description="Start a reconciliation to generate match suggestions." />
        ) : items.length === 0 ? (
          <EmptyState icon="check" title="No pending suggestions" description="Every matchable transaction has been confirmed, or automatic matching is disabled in settings." />
        ) : (
          <DataTableWrap>
            <thead className="bg-u-s2">
              <tr>
                <Th>Bank Transaction</Th>
                <Th>Book Transaction(s)</Th>
                <Th>Type</Th>
                <Th>Confidence</Th>
                <Th>Explanation</Th>
                <Th>Actions</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-u-line">
              {items.map((item) => {
                const bankTx = state.bankTxs.find((t) => t.id === item.bankId)!;
                const bookTxs = item.bookIds.map((id) => state.bookTxs.find((b) => b.id === id)).filter(Boolean) as NonNullable<ReturnType<typeof state.bookTxs.find>>[];
                return (
                  <tr key={`${item.kind}-${item.bankId}-${item.bookIds.join(",")}`} className="hover:bg-u-s2/60 align-top">
                    <Td>
                      <button type="button" onClick={() => window.location.assign(`/accounting/bank-reconciliation/workspace/${accountId}`)} className="font-medium text-u-accent hover:underline text-left">
                        {bankTx.description}
                      </button>
                      <div className="text-[11px] text-u-muted">{fmtDate(bankTx.date)} · {bankTx.reference}</div>
                      <span className={`text-xs tabular-nums font-medium ${bankTx.signedAmount >= 0 ? "text-u-ok" : "text-u-danger"}`}>{moneySigned(bankTx.signedAmount)}</span>
                    </Td>
                    <Td>
                      <ul className="space-y-0.5">
                        {bookTxs.map((b) => (
                          <li key={b.id}>
                            <span className="text-xs text-u-ink2">{b.description}</span>
                            <span className={`text-xs tabular-nums ml-2 ${b.signedAmount >= 0 ? "text-u-ok" : "text-u-danger"}`}>{moneySigned(b.signedAmount)}</span>
                          </li>
                        ))}
                      </ul>
                    </Td>
                    <Td>
                      <Badge kind={item.sug.type === "one_to_many" ? "outstanding" : item.sug.type === "many_to_one" ? "review" : "suggested"}>
                        {item.sug.type === "one_to_many" ? "1 bank → N book" : item.sug.type === "many_to_one" ? "N bank → 1 book" : "1-to-1"}
                      </Badge>
                    </Td>
                    <Td>{confidenceBadge(item.sug.confidence >= 85 ? "High" : item.sug.confidence >= 60 ? "Medium" : "Low")}</Td>
                    <Td className="max-w-xs"><span className="text-xs text-u-muted">{item.sug.explanation}</span></Td>
                    <Td>
                      <div className="flex flex-col gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          icon="check"
                          disabled={!can("match_transactions")}
                          onClick={() => {
                            const res = createMatch({ bankIds: item.sug.bankIds, bookIds: item.sug.bookIds, confidence: item.sug.confidence, explanation: item.sug.explanation, automatic: false });
                            if (!res.ok) alert(res.error);
                          }}
                        >
                          Accept
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => alert("Use the workspace to manually group or override this suggestion.")}>Override</Button>
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
        Matching rules enforced: one bank transaction matches only related book transactions, one book transaction is matched at most once (unless a grouped match explicitly allows it), and direction + currency are respected. Confirmed matches record the user and timestamp; undone matches preserve their history.
      </Alert>
    </div>
  );
}
