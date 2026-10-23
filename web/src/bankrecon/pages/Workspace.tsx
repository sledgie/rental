import { useMemo, useState } from "react";
import Link from "../shim/link";
import { useStore } from "../lib/store";
import { computeRecon, depositLiabilityCheck, withinPeriod } from "../lib/calc";
import { suggestForBankTx, suggestForBookTxManyToOne, Suggestion } from "../lib/matching";
import { Alert, Badge, Button, Card, Field, Input, Modal, ProgressBar, SegmentedTabs, Select, Th, Td, Toolbar, confidenceBadge, matchBadge, reconStatusBadge } from "../components/ui";
import { Icon } from "../components/icons";
import { BankTxDrawer, BookTxDrawer } from "../components/recon/TxDrawers";
import { FinalizeModal, ReopenModal, CancelModal, RecordMissingModal, AdjustmentModal } from "../components/recon/WorkflowModals";
import { StartReconModal } from "../components/recon/StartReconModal";
import { BankTransaction, BookTransaction, BookTxType, TX_TYPE_META, Reconciliation } from "../lib/types";
import { fmtDate, money, moneySigned, num, r2, ageLabel } from "../lib/format";

type SortKey = "date" | "amount" | "description" | "status";

export default function WorkspacePage({ accountId }: { accountId: string }) {
  const { state, createMatch, unmatch, can, addBankTransactions, addBookTransaction, updateBookTransaction } = useStore();

  const account = state.accounts.find((a) => a.id === accountId);
  const recon = useMemo(
    () =>
      state.reconciliations
        .filter((r) => r.accountId === accountId && r.status !== "Cancelled")
        .sort((a, b) => b.periodStart.localeCompare(a.periodStart))[0] ?? null,
    [state.reconciliations, accountId],
  );

  const [mobileTab, setMobileTab] = useState<"bank" | "book" | "summary">("bank");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [bankDir, setBankDir] = useState("all");
  const [bookType, setBookType] = useState("all");
  const [minAmt, setMinAmt] = useState("");
  const [maxAmt, setMaxAmt] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const [selBank, setSelBank] = useState<Set<string>>(new Set());
  const [selBook, setSelBook] = useState<Set<string>>(new Set());
  const [bankDrawer, setBankDrawer] = useState<BankTransaction | null>(null);
  const [bookDrawer, setBookDrawer] = useState<BookTransaction | null>(null);
  const [finalizeOpen, setFinalizeOpen] = useState(false);
  const [reopenOpen, setReopenOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [missingTx, setMissingTx] = useState<BankTransaction | null>(null);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [addBankOpen, setAddBankOpen] = useState(false);
  const [addBookOpen, setAddBookOpen] = useState(false);
  const [manualMatchBook, setManualMatchBook] = useState<BookTransaction | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  // Suggestion memos must run before any early return (Rules of Hooks)
  const bankSuggestions = useMemo(() => {
    if (!recon || !state.settings.autoMatching) return new Map<string, Suggestion>();
    const bankInPeriod = state.bankTxs.filter((t) => t.accountId === accountId && withinPeriod(t.date, recon.periodStart, recon.periodEnd));
    const bookInPeriod = state.bookTxs.filter((t) => t.accountId === accountId && withinPeriod(t.date, recon.periodStart, recon.periodEnd));
    const activeMatches = state.matches.filter((m) => m.reconciliationId === recon.id && m.active);
    const usedBank = new Set(activeMatches.flatMap((m) => m.bankTxIds));
    const usedBook = new Set(activeMatches.flatMap((m) => m.bookTxIds));
    const ctx = { bankTxs: bankInPeriod, bookTxs: bookInPeriod, settings: state.settings, usedBankIds: usedBank, usedBookIds: usedBook };
    const map = new Map<string, Suggestion>();
    for (const b of bankInPeriod) {
      if (usedBank.has(b.id) || dismissed.has(b.id)) continue;
      const s = suggestForBankTx(b, ctx);
      if (s) map.set(b.id, s);
    }
    return map;
  }, [state, accountId, recon, dismissed]);

  const bookSuggestions = useMemo(() => {
    if (!recon || !state.settings.autoMatching) return new Map<string, Suggestion>();
    const bankInPeriod = state.bankTxs.filter((t) => t.accountId === accountId && withinPeriod(t.date, recon.periodStart, recon.periodEnd));
    const bookInPeriod = state.bookTxs.filter((t) => t.accountId === accountId && withinPeriod(t.date, recon.periodStart, recon.periodEnd));
    const activeMatches = state.matches.filter((m) => m.reconciliationId === recon.id && m.active);
    const usedBank = new Set(activeMatches.flatMap((m) => m.bankTxIds));
    const usedBook = new Set(activeMatches.flatMap((m) => m.bookTxIds));
    const ctx = { bankTxs: bankInPeriod, bookTxs: bookInPeriod, settings: state.settings, usedBankIds: usedBank, usedBookIds: usedBook };
    const map = new Map<string, Suggestion>();
    const covered = new Set<string>();
    for (const s of bankSuggestions.values()) s.bookIds.forEach((id) => covered.add(id));
    for (const b of bookInPeriod) {
      if (usedBook.has(b.id) || covered.has(b.id)) continue;
      const s = suggestForBookTxManyToOne(b, ctx);
      if (s) map.set(b.id, s);
    }
    return map;
  }, [state, accountId, recon, bankSuggestions]);

  const toggle = (set: Set<string>, id: string, setter: (s: Set<string>) => void) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setter(next);
  };

  if (!account) {
    return (
      <Card className="p-8 text-center">
        <p className="text-sm text-u-muted">Bank account not found.</p>
        <Link href="/accounting/bank-reconciliation"><Button className="mt-3">Back to dashboard</Button></Link>
      </Card>
    );
  }

  if (!recon) {
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <Card className="p-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-u-accent-soft text-u-accent flex items-center justify-center mx-auto">
            <Icon name="bank" className="w-7 h-7" />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-u-ink">{account.name}</h2>
          <p className="mt-1 text-sm text-u-muted">No reconciliation is active for this account. Start one to open the workspace.</p>
          <div className="mt-5 flex justify-center">
            <StartReconModal open onClose={() => {}} accountId={account.id} onDone={() => {}} />
          </div>
        </Card>
      </div>
    );
  }

  const calc = computeRecon(state, recon);
  const locked = recon.status === "Reconciled";

  const bankInPeriod = state.bankTxs.filter((t) => t.accountId === account.id && withinPeriod(t.date, recon.periodStart, recon.periodEnd));
  const bookInPeriod = state.bookTxs.filter((t) => t.accountId === account.id && withinPeriod(t.date, recon.periodStart, recon.periodEnd));
  const activeMatches = state.matches.filter((m) => m.reconciliationId === recon.id && m.active);
  const usedBank = new Set(activeMatches.flatMap((m) => m.bankTxIds));
  const usedBook = new Set(activeMatches.flatMap((m) => m.bookTxIds));

  const matchForBank = (id: string) => activeMatches.find((m) => m.bankTxIds.includes(id));
  const matchForBook = (id: string) => activeMatches.find((m) => m.bookTxIds.includes(id));

  const bankMatchedIds = new Set(activeMatches.flatMap((m) => m.bankTxIds));
  const bookMatchedIds = new Set(activeMatches.flatMap((m) => m.bookTxIds));

  const applyFilters = <T extends { date: string; description: string; signedAmount: number; reference: string }>(list: T[], extra?: (t: T) => boolean) =>
    list.filter((t) => {
      if (search) {
        const s = search.toLowerCase();
        if (!`${t.description} ${t.reference}`.toLowerCase().includes(s)) return false;
      }
      if (dateFrom && t.date < dateFrom) return false;
      if (dateTo && t.date > dateTo) return false;
      if (minAmt !== "" && t.signedAmount < Number(minAmt)) return false;
      if (maxAmt !== "" && t.signedAmount > Number(maxAmt)) return false;
      if (extra && !extra(t)) return false;
      return true;
    });

  const sortList = <T extends { date: string; description: string; signedAmount: number }>(list: T[]) => {
    const dir = sortDir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      if (sortKey === "date") return a.date.localeCompare(b.date) * dir;
      if (sortKey === "amount") return (a.signedAmount - b.signedAmount) * dir;
      if (sortKey === "description") return a.description.localeCompare(b.description) * dir;
      return 0;
    });
  };

  const filteredBank = sortList(
    applyFilters(bankInPeriod, (t) => {
      if (bankDir === "in" && t.signedAmount < 0) return false;
      if (bankDir === "out" && t.signedAmount >= 0) return false;
      if (statusFilter === "unmatched" && bankMatchedIds.has(t.id)) return false;
      if (statusFilter === "matched" && !bankMatchedIds.has(t.id)) return false;
      if (statusFilter === "duplicates" && !t.duplicateOf) return false;
      return true;
    }),
  );
  const filteredBook = sortList(
    applyFilters(bookInPeriod, (t) => {
      if (bookType !== "all" && t.type !== bookType) return false;
      if (statusFilter === "unmatched" && bookMatchedIds.has(t.id)) return false;
      if (statusFilter === "matched" && !bookMatchedIds.has(t.id)) return false;
      return true;
    }),
  );

  const doMatchSelected = () => {
    setNotice(null);
    if (selBank.size === 0 || selBook.size === 0) return setNotice("Select at least one bank transaction and one book transaction to match.");
    const res = createMatch({ bankIds: [...selBank], bookIds: [...selBook] });
    if (!res.ok) return setNotice(res.error ?? "Match failed.");
    setNotice("Match confirmed. The transaction is now matched; unmatch it any time (history preserved).");
    setSelBank(new Set());
    setSelBook(new Set());
  };

  const acceptSuggestion = (bank: BankTransaction, s: Suggestion) => {
    setNotice(null);
    const res = createMatch({ bankIds: [bank.id], bookIds: s.bookIds, confidence: s.confidence, explanation: s.explanation, automatic: false });
    if (!res.ok) return setNotice(res.error ?? "Match failed.");
    setNotice(`Match confirmed (${s.confidence >= 85 ? "High" : s.confidence >= 60 ? "Medium" : "Low"} confidence).`);
  };

  const rejectSuggestion = (bankId: string) => {
    setDismissed((prev) => new Set(prev).add(bankId));
    setNotice("Suggestion dismissed. The transaction remains unmatched for manual investigation.");
  };

  const trustCheck = account.accountType === "Trust" ? depositLiabilityCheck(state, recon) : null;
  const lastCompleted = state.reconciliations
    .filter((r) => r.accountId === account.id && r.status === "Reconciled")
    .sort((a, b) => b.periodEnd.localeCompare(a.periodEnd))[0];

  return (
    <div className="space-y-5">
      {/* Workspace header */}
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-semibold text-u-ink">{account.name}</h2>
              {reconStatusBadge(recon.status)}
              {account.accountType === "Trust" && <Badge kind="outstanding" dot>Trust Account</Badge>}
              {locked && <Badge kind="cancelled" dot><Icon name="lock" className="w-3 h-3" /> Locked</Badge>}
            </div>
            <p className="text-xs text-u-muted mt-1">
              {account.id} · {account.institution} · {account.maskedAccount} · {account.currency} · Statement {recon.statementRef} · Period {fmtDate(recon.periodStart)} – {fmtDate(recon.periodEnd)}
            </p>
            <p className="text-xs text-u-muted mt-1">
              Last completed: {lastCompleted ? `${lastCompleted.statementRef} ending ${money(lastCompleted.statementEndingBalance)} (${fmtDate(lastCompleted.periodEnd)})` : "—"} · Created by {recon.createdBy}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/accounting/bank-reconciliation/imports?account=${account.id}`}>
              <Button size="sm" variant="secondary" icon="upload" disabled={locked}>Import Statement</Button>
            </Link>
            <Button size="sm" variant="secondary" icon="plus" onClick={() => setAddBankOpen(true)} disabled={locked}>Add Bank Transaction</Button>
            <Button size="sm" variant="secondary" icon="file" onClick={() => setAddBookOpen(true)} disabled={locked}>Add Book Transaction</Button>
            <Button size="sm" variant="secondary" icon="scale" onClick={() => setAdjustOpen(true)} disabled={locked || !can("approve_adjustments")} title={can("approve_adjustments") ? undefined : "Requires approve adjustments permission."}>Adjustment</Button>
            {!locked && (
              <Button size="sm" variant="success" icon="lock" disabled={!calc.canFinalize || !can("finalize_reconciliation")} title={can("finalize_reconciliation") ? undefined : "Requires finalize permission."} onClick={() => setFinalizeOpen(true)}>
                Finalize
              </Button>
            )}
            {locked && (
              <Button size="sm" variant="primary" icon="unlock" disabled={!can("reopen_reconciliation")} onClick={() => setReopenOpen(true)}>Reopen</Button>
            )}
            {!locked && (
              <Button size="sm" variant="ghost" className="text-u-danger" disabled={!can("cancel_reconciliation")} onClick={() => setCancelOpen(true)}>Cancel</Button>
            )}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 lg:grid-cols-6 gap-3">
          {[
            ["Statement Opening", money(recon.statementOpeningBalance)],
            ["Statement Ending", money(recon.statementEndingBalance)],
            ["Book Balance", money(calc.bookBalance)],
            ["Remaining Difference", moneySigned(calc.remainingDifference)],
            ["Matched", `${calc.matchedBankCount} / ${bankInPeriod.length} bank`],
            ["Status", calc.canFinalize ? "Ready to Finalize" : calc.suggestedStatus],
          ].map(([k, v]) => (
            <div key={k} className="rounded-lg border border-u-line bg-u-s2/50 px-3 py-2">
              <p className="text-[10px] font-medium uppercase tracking-wide text-u-muted">{k}</p>
              <p className={`text-sm font-semibold tabular-nums ${k === "Remaining Difference" && Math.abs(calc.remainingDifference) > 0.005 ? "text-u-danger" : "text-u-ink"}`}>{v}</p>
            </div>
          ))}
        </div>
        <div className="mt-3">
          <ProgressBar value={calc.matchedBankCount} max={Math.max(bankInPeriod.length, 1)} tone={calc.canFinalize ? "emerald" : "indigo"} />
          <p className="text-[11px] text-u-muted mt-1">Reconciliation progress — matched bank transactions</p>
        </div>
        {notice && <div className="mt-3"><Alert kind="info">{notice}</Alert></div>}
        {locked && (
          <div className="mt-3">
            <Alert kind="warning">This reconciliation is finalized and locked against ordinary editing. Corrections require an authorized reopening with a recorded reason and audit entry.</Alert>
          </div>
        )}
      </Card>

      {/* Mobile tabs */}
      <div className="lg:hidden">
        <SegmentedTabs
          tabs={[
            { key: "bank", label: `Bank (${filteredBank.length})`, icon: "bank" },
            { key: "book", label: `Book (${filteredBook.length})`, icon: "ledger" },
            { key: "summary", label: "Summary", icon: "scale" },
          ]}
          active={mobileTab}
          onChange={(k) => setMobileTab(k)}
        />
      </div>

      {/* Shared filters */}
      <Card className="p-4 no-print">
        <Toolbar>
          <div className="relative">
            <Icon name="search" className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-u-muted" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search description or reference…" className="w-48 pl-8" />
          </div>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-36" title="From date" />
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-36" title="To date" />
          <Input type="number" placeholder="Min $" value={minAmt} onChange={(e) => setMinAmt(e.target.value)} className="w-24" />
          <Input type="number" placeholder="Max $" value={maxAmt} onChange={(e) => setMaxAmt(e.target.value)} className="w-24" />
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-40">
            <option value="all">All statuses</option>
            <option value="unmatched">Unmatched only</option>
            <option value="matched">Matched only</option>
            <option value="duplicates">Potential duplicates</option>
          </Select>
          <Select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)} className="w-36">
            <option value="date">Sort: Date</option>
            <option value="amount">Sort: Amount</option>
            <option value="description">Sort: Description</option>
          </Select>
          <Button size="sm" variant="ghost" icon={sortDir === "asc" ? "chevronDown" : "chevronDown"} onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))} className="rotate-180" title={sortDir === "asc" ? "Ascending" : "Descending"}>
            {sortDir === "asc" ? "Asc" : "Desc"}
          </Button>
          {(selBank.size > 0 || selBook.size > 0) && (
            <Button size="sm" variant="primary" icon="check" onClick={doMatchSelected}>
              Match Selected ({selBank.size} bank × {selBook.size} book)
            </Button>
          )}
          {(selBank.size > 0 || selBook.size > 0) && (
            <Button size="sm" variant="ghost" onClick={() => { setSelBank(new Set()); setSelBook(new Set()); }}>Clear</Button>
          )}
        </Toolbar>
      </Card>

      {/* Panels */}
      <div className="grid lg:grid-cols-2 gap-5">
        {/* BANK PANEL */}
        <div className={`${mobileTab === "bank" ? "block" : "hidden"} lg:block`}>
          <Card>
            <div className="flex items-center justify-between border-b border-u-line px-4 py-3">
              <h3 className="text-sm font-semibold text-u-ink flex items-center gap-2"><Icon name="bank" className="w-4 h-4 text-u-accent" /> Bank Statement Transactions</h3>
              <span className="text-xs text-u-muted">{filteredBank.length} of {bankInPeriod.length}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-u-s2">
                  <tr>
                    <Th className="w-8"></Th>
                    <Th>Date</Th>
                    <Th>Description</Th>
                    <Th>Reference</Th>
                    <Th className="text-right">Money In</Th>
                    <Th className="text-right">Money Out</Th>
                    <Th className="text-right">Amount</Th>
                    <Th>Match Status</Th>
                    <Th>Actions</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-u-line">
                  {filteredBank.map((t) => {
                    const m = matchForBank(t.id);
                    const sug = bankSuggestions.get(t.id);
                    return (
                      <tr key={t.id} className="hover:bg-u-s2/60 align-top">
                        <td className="px-2 py-2">
                          <input
                            type="checkbox"
                            checked={selBank.has(t.id)}
                            disabled={locked || !!m}
                            onChange={() => toggle(selBank, t.id, setSelBank)}
                            className="w-3.5 h-3.5 rounded border-u-line2 text-u-accent focus:ring-u-accent/60"
                          />
                        </td>
                        <Td className="whitespace-nowrap">
                          {fmtDate(t.date)}
                          {t.postedDate && t.postedDate !== t.date && <div className="text-[10px] text-u-muted">posted {fmtDate(t.postedDate)}</div>}
                        </Td>
                        <Td>
                          <button type="button" onClick={() => setBankDrawer(t)} className="text-left font-medium text-u-accent hover:underline truncate max-w-[16rem]">
                            {t.description}
                          </button>
                          {t.duplicateOf && <Badge kind="duplicate">Potential duplicate</Badge>}
                          {t.runningBalance !== null && <div className="text-[10px] text-u-muted">bal {money(t.runningBalance)}</div>}
                        </Td>
                        <Td className="whitespace-nowrap text-xs">{t.reference}</Td>
                        <Td className="text-right tabular-nums text-u-ok">{t.credit > 0 ? num(t.credit) : "—"}</Td>
                        <Td className="text-right tabular-nums text-u-danger">{t.debit > 0 ? num(t.debit) : "—"}</Td>
                        <Td className={`text-right tabular-nums font-medium ${t.signedAmount >= 0 ? "text-u-ok" : "text-u-danger"}`}>{moneySigned(t.signedAmount)}</Td>
                        <Td>
                          {m ? (
                            <div className="space-y-1">
                              {matchBadge("Matched")}
                              <button type="button" onClick={() => setBankDrawer(t)} className="text-[10px] text-u-accent hover:underline">
                                {m.bookTxIds.length} book tx · {m.confidenceLevel}
                              </button>
                            </div>
                          ) : sug ? (
                            <div className="space-y-1">
                              {confidenceBadge(sug.confidence >= 85 ? "High" : sug.confidence >= 60 ? "Medium" : "Low")}
                              <p className="text-[10px] text-u-muted max-w-[14rem]">{sug.explanation}</p>
                            </div>
                          ) : t.duplicateOf ? (
                            <Badge kind="duplicate" dot>Potential Duplicate</Badge>
                          ) : (
                            <Badge kind="unmatched" dot>Unmatched</Badge>
                          )}
                        </Td>
                        <Td>
                          <div className="flex flex-col gap-1">
                            <button type="button" onClick={() => setBankDrawer(t)} className="text-[11px] text-u-muted hover:text-u-accent">Details</button>
                            {sug && !locked && (
                              <>
                                <Button size="sm" variant="outline" onClick={() => acceptSuggestion(t, sug)}>Accept</Button>
                                <Button size="sm" variant="ghost" onClick={() => rejectSuggestion(t.id)}>Reject</Button>
                              </>
                            )}
                            {m && !locked && can("unmatch_transactions") && (
                              <Button size="sm" variant="ghost" className="text-u-danger" onClick={() => unmatch(m.id)}>Unmatch</Button>
                            )}
                            {!m && !locked && (
                              <Button size="sm" variant="ghost" className="text-u-muted" onClick={() => setMissingTx(t)} title="Record a book entry for this bank activity">
                                Record Missing
                              </Button>
                            )}
                          </div>
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredBank.length === 0 && <p className="p-6 text-center text-xs text-u-muted">No bank transactions match the filters.</p>}
            </div>
          </Card>
        </div>

        {/* BOOK PANEL */}
        <div className={`${mobileTab === "book" ? "block" : "hidden"} lg:block`}>
          <Card>
            <div className="flex items-center justify-between border-b border-u-line px-4 py-3">
              <h3 className="text-sm font-semibold text-u-ink flex items-center gap-2"><Icon name="ledger" className="w-4 h-4 text-u-accent" /> Book Transactions (Ledger)</h3>
              <div className="flex items-center gap-2">
                <Select value={bankDir} onChange={(e) => setBankDir(e.target.value)} className="w-28 text-xs">
                  <option value="all">All</option>
                  <option value="in">Money In</option>
                  <option value="out">Money Out</option>
                </Select>
                <Select value={bookType} onChange={(e) => setBookType(e.target.value)} className="w-40 text-xs">
                  <option value="all">All types</option>
                  {Object.entries(TX_TYPE_META).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </Select>
                <span className="text-xs text-u-muted">{filteredBook.length} of {bookInPeriod.length}</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-u-s2">
                  <tr>
                    <Th className="w-8"></Th>
                    <Th>Date</Th>
                    <Th>Type</Th>
                    <Th>Description</Th>
                    <Th>Tenant / Vendor</Th>
                    <Th>Property / Unit</Th>
                    <Th>Reference</Th>
                    <Th className="text-right">Amount</Th>
                    <Th>Match Status</Th>
                    <Th>Actions</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-u-line">
                  {filteredBook.map((t) => {
                    const m = matchForBook(t.id);
                    const sug = bookSuggestions.get(t.id);
                    const prop = state.properties.find((p) => p.id === t.propertyId);
                    return (
                      <tr key={t.id} className="hover:bg-u-s2/60 align-top">
                        <td className="px-2 py-2">
                          <input
                            type="checkbox"
                            checked={selBook.has(t.id)}
                            disabled={locked || !!m}
                            onChange={() => toggle(selBook, t.id, setSelBook)}
                            className="w-3.5 h-3.5 rounded border-u-line2 text-u-accent focus:ring-u-accent/60"
                          />
                        </td>
                        <Td className="whitespace-nowrap">{fmtDate(t.date)}</Td>
                        <Td><Badge kind="neutral">{TX_TYPE_META[t.type].label}</Badge></Td>
                        <Td>
                          <button type="button" onClick={() => setBookDrawer(t)} className="text-left font-medium text-u-accent hover:underline truncate max-w-[14rem] block">
                            {t.description}
                          </button>
                          {t.invoices.length > 0 && <div className="text-[10px] text-u-muted">{t.invoices.length} invoice(s) settled</div>}
                        </Td>
                        <Td className="whitespace-nowrap">{t.counterparty}</Td>
                        <Td className="whitespace-nowrap">{prop ? prop.name : "—"}{t.unit ? ` · ${t.unit}` : ""}</Td>
                        <Td className="whitespace-nowrap text-xs">{t.reference}</Td>
                        <Td className={`text-right tabular-nums font-medium ${t.signedAmount >= 0 ? "text-u-ok" : "text-u-danger"}`}>{moneySigned(t.signedAmount)}</Td>
                        <Td>
                          {m ? (
                            <div className="space-y-1">
                              {matchBadge("Matched")}
                              <button type="button" onClick={() => setBookDrawer(t)} className="text-[10px] text-u-accent hover:underline">
                                {m.bankTxIds.length} bank tx · {m.confidenceLevel}
                              </button>
                            </div>
                          ) : sug ? (
                            <div className="space-y-1">
                              {confidenceBadge(sug.confidence >= 85 ? "High" : sug.confidence >= 60 ? "Medium" : "Low")}
                              <p className="text-[10px] text-u-muted max-w-[12rem]">{sug.explanation}</p>
                            </div>
                          ) : (
                            <Badge kind="unmatched" dot>Unmatched</Badge>
                          )}
                        </Td>
                        <Td>
                          <div className="flex flex-col gap-1">
                            <button type="button" onClick={() => setBookDrawer(t)} className="text-[11px] text-u-muted hover:text-u-accent">Details</button>
                            {sug && !locked && (
                              <Button size="sm" variant="outline" onClick={() => {
                                const res = createMatch({ bankIds: sug.bankIds, bookIds: [t.id], confidence: sug.confidence, explanation: sug.explanation, automatic: false });
                                if (!res.ok) setNotice(res.error ?? "Match failed.");
                              }}>Accept</Button>
                            )}
                            {m && !locked && can("unmatch_transactions") && (
                              <Button size="sm" variant="ghost" className="text-u-danger" onClick={() => unmatch(m.id)}>Unmatch</Button>
                            )}
                            {!m && !locked && (
                              <Button size="sm" variant="ghost" className="text-u-muted" onClick={() => setManualMatchBook(t)}>Match to Bank</Button>
                            )}
                          </div>
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredBook.length === 0 && <p className="p-6 text-center text-xs text-u-muted">No book transactions match the filters.</p>}
            </div>
          </Card>
        </div>
      </div>

      {/* SUMMARY */}
      <div className={`${mobileTab === "summary" ? "block" : "hidden"} lg:block space-y-5`}>
        <Card>
          <div className="border-b border-u-line px-5 py-4">
            <h3 className="text-sm font-semibold text-u-ink flex items-center gap-2"><Icon name="scale" className="w-4 h-4 text-u-accent" /> Reconciliation Calculation</h3>
            <p className="text-xs text-u-muted">Transparent balance summary — every figure is derived from the transactions above.</p>
          </div>
          <div className="p-5 space-y-4">
            <div className="grid sm:grid-cols-2 gap-x-8 gap-y-1 text-sm">
              <CalcRow k="Bank Statement Ending Balance" v={money(calc.statementEndingBalance)} />
              <CalcRow k="Book Balance" v={money(calc.bookBalance)} />
              <CalcRow k="Add: Deposits in Transit" v={money(calc.depositsInTransitAmount)} />
              <CalcRow k="Less: Outstanding Payments" v={`(${money(calc.outstandingPaymentsAmount)})`} />
              {calc.bankAdjustments.map((a) => (
                <CalcRow key={a.id} k={`Bank adjustment: ${a.kind}`} v={moneySigned(a.amount)} />
              ))}
              <CalcRow k="Adjusted Bank Balance" v={money(calc.adjustedBank)} bold />
              {calc.bookAdjustments.map((a) => (
                <CalcRow key={a.id} k={`Book adjustment: ${a.kind}`} v={moneySigned(a.amount)} />
              ))}
              <CalcRow k="Adjusted Book Balance" v={money(calc.adjustedBook)} bold />
              <CalcRow k="Remaining Difference" v={moneySigned(calc.remainingDifference)} tone={calc.isBalanced ? "ok" : "bad"} bold />
            </div>
            {calc.isBalanced && <Alert kind="success">Adjusted balances agree. No unexplained difference remains.</Alert>}
            {!calc.isBalanced && (
              <Alert kind="danger">
                Unexplained difference of {moneySigned(calc.remainingDifference)} remains. Unmatched bank transactions must be matched, recorded, or rejected before this reconciliation can be finalized. Differences cannot be written off silently.
              </Alert>
            )}

            {/* Timing differences */}
            <div className="grid lg:grid-cols-2 gap-4">
              <div className="rounded-lg border border-u-violet/30 bg-u-violet/10 p-3">
                <p className="text-xs font-semibold text-u-violet flex items-center gap-1.5"><Icon name="arrowRight" className="w-3.5 h-3.5" /> Deposits in Transit ({calc.depositsInTransit.length})</p>
                {calc.depositsInTransit.length === 0 ? (
                  <p className="text-[11px] text-u-muted mt-1">None — all recorded receipts have cleared.</p>
                ) : (
                  <ul className="mt-1.5 space-y-1">
                    {calc.depositsInTransit.map((t) => (
                      <li key={t.id} className="flex items-center justify-between text-[11px] text-u-ink2">
                        <span className="truncate">{t.description}</span>
                        <span className="tabular-nums whitespace-nowrap">{money(t.moneyIn)} · {ageLabel(t.date)}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="text-[10px] text-u-muted mt-1.5">Legitimate timing difference — not an accounting error. Outstanding items cannot be deleted to force a balanced reconciliation.</p>
              </div>
              <div className="rounded-lg border border-u-warn/30 bg-u-warn-soft/40 p-3">
                <p className="text-xs font-semibold text-u-warn flex items-center gap-1.5"><Icon name="arrowRight" className="w-3.5 h-3.5" /> Outstanding Payments ({calc.outstandingPayments.length})</p>
                {calc.outstandingPayments.length === 0 ? (
                  <p className="text-[11px] text-u-muted mt-1">None — all recorded disbursements have cleared.</p>
                ) : (
                  <ul className="mt-1.5 space-y-1">
                    {calc.outstandingPayments.map((t) => (
                      <li key={t.id} className="flex items-center justify-between text-[11px] text-u-ink2">
                        <span className="truncate">{t.description}</span>
                        <span className="tabular-nums whitespace-nowrap">({money(t.moneyOut)}) · {ageLabel(t.date)}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {calc.outstandingPayments.some((t) => ageLabel(t.date).includes("month")) && (
                  <p className="text-[10px] text-u-warn mt-1.5">⚠ Stale outstanding item — investigate promptly.</p>
                )}
              </div>
            </div>

            {/* Unresolved items */}
            <div>
              <p className="text-xs font-semibold text-u-ink2 mb-1.5">Unresolved Items ({calc.unmatchedBank.length + calc.unmatchedBook.length})</p>
              {calc.unmatchedBank.length + calc.unmatchedBook.length === 0 ? (
                <p className="text-xs text-u-muted">No unresolved transactions. All activity is matched or classified as a valid timing difference.</p>
              ) : (
                <ul className="space-y-1.5">
                  {calc.unmatchedBank.map((t) => (
                    <li key={t.id} className="flex items-center justify-between gap-3 rounded-lg border border-u-danger/30 bg-u-danger-soft/40 px-3 py-2 text-xs">
                      <div className="min-w-0">
                        <span className="font-medium text-u-danger">Bank transaction without book entry</span>
                        <span className="text-u-muted"> · {t.description} · {t.reference}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="tabular-nums text-u-danger">{moneySigned(t.signedAmount)}</span>
                        <Button size="sm" variant="outline" onClick={() => setMissingTx(t)}>Record Missing</Button>
                      </div>
                    </li>
                  ))}
                  {calc.unmatchedBook.map((t) => (
                    <li key={t.id} className="flex items-center justify-between gap-3 rounded-lg border border-u-warn/30 bg-u-warn-soft/40 px-3 py-2 text-xs">
                      <div className="min-w-0">
                        <span className="font-medium text-u-warn">Book transaction not yet on statement</span>
                        <span className="text-u-muted"> · {t.description} · {t.reference}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="tabular-nums text-u-warn">{moneySigned(t.signedAmount)}</span>
                        <button type="button" onClick={() => setBookDrawer(t)} className="text-[11px] text-u-accent hover:underline">Investigate</button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Trust safeguards */}
            {trustCheck && (
              <div className="rounded-lg border border-u-accent/30 bg-u-accent-soft/40 p-3">
                <p className="text-xs font-semibold text-u-accent flex items-center gap-1.5"><Icon name="shield" className="w-3.5 h-3.5" /> Tenant Deposit Liability Reconciliation</p>
                <div className="mt-1.5 grid grid-cols-3 gap-3 text-xs">
                  <div><p className="text-u-muted">Bank movement</p><p className="font-semibold tabular-nums">{money(trustCheck.bankMovement)}</p></div>
                  <div><p className="text-u-muted">Book movement</p><p className="font-semibold tabular-nums">{money(trustCheck.bookMovement)}</p></div>
                  <div><p className="text-u-muted">Difference</p><p className={`font-semibold tabular-nums ${trustCheck.inBalance ? "text-u-ok" : "text-u-danger"}`}>{moneySigned(trustCheck.difference)}</p></div>
                </div>
                {trustCheck.inBalance ? (
                  <p className="text-[11px] text-u-ok mt-1.5">✓ Bank funds and deposit obligations are in agreement for this period.</p>
                ) : (
                  <p className="text-[11px] text-u-danger mt-1.5">⚠ Difference between bank funds and deposit obligations — investigate. Tenant deposits are never rental income.</p>
                )}
                <p className="text-[10px] text-u-muted mt-1.5">Bank reconciliation and deposit liability reconciliation are related but different controls.</p>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Modals */}
      <FinalizeModal open={finalizeOpen} onClose={() => setFinalizeOpen(false)} reconId={recon.id} />
      <ReopenModal open={reopenOpen} onClose={() => setReopenOpen(false)} reconId={recon.id} />
      <CancelModal open={cancelOpen} onClose={() => setCancelOpen(false)} reconId={recon.id} />
      <RecordMissingModal open={!!missingTx} onClose={() => setMissingTx(null)} bankTx={missingTx} onDone={() => setNotice("Missing transaction recorded in the ledger — it is now eligible for matching.")} />
      <AdjustmentModal open={adjustOpen} onClose={() => setAdjustOpen(false)} reconId={recon.id} />
      <AddBankTxModal open={addBankOpen} onClose={() => setAddBankOpen(false)} accountId={account.id} onAdd={(rows) => addBankTransactions(rows, account.id, `MANUAL-${recon.id}`, "Manual entry")} />
      <AddBookTxModal open={addBookOpen} onClose={() => setAddBookOpen(false)} accountId={account.id} onAdd={(data) => addBookTransaction(data)} />
      <ManualMatchModal
        open={!!manualMatchBook}
        onClose={() => setManualMatchBook(null)}
        bookTx={manualMatchBook}
        bankTxs={bankInPeriod.filter((t) => !usedBank.has(t.id) && manualMatchBook !== null && t.signedAmount * manualMatchBook.signedAmount > 0)}
        onConfirm={(bankIds) => {
          const book = manualMatchBook!;
          const res = createMatch({ bankIds, bookIds: [book.id] });
          if (!res.ok) return setNotice(res.error ?? "Match failed.");
          setNotice("Manual match confirmed.");
          setManualMatchBook(null);
        }}
      />
      <BankTxDrawer tx={bankDrawer} open={!!bankDrawer} onClose={() => setBankDrawer(null)} />
      <BookTxDrawer tx={bookDrawer} open={!!bookDrawer} onClose={() => setBookDrawer(null)} />
    </div>
  );
}

function CalcRow({ k, v, bold, tone }: { k: string; v: string; bold?: boolean; tone?: "ok" | "bad" }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <span className={`text-xs ${bold ? "font-semibold text-u-ink2" : "text-u-muted"}`}>{k}</span>
      <span className={`tabular-nums text-sm ${bold ? "font-semibold" : "font-medium"} ${tone === "ok" ? "text-u-ok" : tone === "bad" ? "text-u-danger" : "text-u-ink"}`}>{v}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add bank transaction (manual)
// ---------------------------------------------------------------------------

function AddBankTxModal({ open, onClose, accountId, onAdd }: { open: boolean; onClose: () => void; accountId: string; onAdd: (rows: { date: string; postedDate: string | null; description: string; reference: string; debit: number; credit: number; runningBalance: number | null }[]) => void }) {
  const [date, setDate] = useState("");
  const [posted, setPosted] = useState("");
  const [description, setDescription] = useState("");
  const [reference, setReference] = useState("");
  const [debit, setDebit] = useState("");
  const [credit, setCredit] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    setError(null);
    if (!date || !description.trim()) return setError("Date and description are required.");
    const d = Number(debit);
    const c = Number(credit);
    if ((debit === "" || credit === "") && !Number.isFinite(c + d)) return setError("Enter debit or credit amount.");
    if (Number.isFinite(d) && Number.isFinite(c) && d > 0 && c > 0) return setError("Enter either a debit or a credit, not both.");
    onAdd([{ date, postedDate: posted || null, description, reference: reference || `MAN-${Date.now().toString(36)}`, debit: Number.isFinite(d) ? d : 0, credit: Number.isFinite(c) ? c : 0, runningBalance: null }]);
    setDate(""); setPosted(""); setDescription(""); setReference(""); setDebit(""); setCredit("");
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add Bank Transaction (manual)"
      subtitle="Manually record an bank statement line outside of an import (e.g. an ATM withdrawal)."
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" icon="check" onClick={submit}>Add Transaction</Button></>}
    >
      <div className="space-y-4">
        {error && <Alert kind="danger">{error}</Alert>}
        <div className="grid grid-cols-2 gap-4">
          <Field label="Transaction Date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Posted Date (optional)"><Input type="date" value={posted} onChange={(e) => setPosted(e.target.value)} /></Field>
          <Field label="Description"><Input value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
          <Field label="Reference"><Input value={reference} onChange={(e) => setReference(e.target.value)} /></Field>
          <Field label="Money Out (Debit)"><Input type="number" step="0.01" value={debit} onChange={(e) => setDebit(e.target.value)} /></Field>
          <Field label="Money In (Credit)"><Input type="number" step="0.01" value={credit} onChange={(e) => setCredit(e.target.value)} /></Field>
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Add book transaction (manual ledger entry)
// ---------------------------------------------------------------------------

function AddBookTxModal({ open, onClose, accountId, onAdd }: { open: boolean; onClose: () => void; accountId: string; onAdd: (data: Omit<BookTransaction, "id" | "signedAmount" | "notes" | "assignee" | "createdAt" | "postingStatus"> & { postingStatus?: BookTransaction["postingStatus"] }) => void }) {
  const { state } = useStore();
  const [type, setType] = useState<BookTxType>("other");
  const [coa, setCoa] = useState(state.coa[0]?.code ?? "");
  const [description, setDescription] = useState("");
  const [counterparty, setCounterparty] = useState("");
  const [date, setDate] = useState("");
  const [reference, setReference] = useState("");
  const [moneyIn, setMoneyIn] = useState("");
  const [moneyOut, setMoneyOut] = useState("");
  const [error, setError] = useState<string | null>(null);

  const direction = TX_TYPE_META[type].direction;

  const submit = () => {
    setError(null);
    if (!description.trim()) return setError("Description is required.");
    if (!date) return setError("Date is required.");
    const inAmt = direction === "in" ? Number(moneyIn) : 0;
    const outAmt = direction === "out" ? Number(moneyOut) : 0;
    if (!Number.isFinite(inAmt + outAmt) || inAmt + outAmt <= 0) return setError("Enter a valid amount for the transaction direction.");
    onAdd({
      accountId,
      date,
      type,
      description,
      counterparty: counterparty || "—",
      propertyId: null,
      unit: null,
      reference,
      invoices: [],
      moneyIn: r2(inAmt),
      moneyOut: r2(outAmt),
      coa,
      source: "Manual journal entry (demo)",
    });
    setDescription(""); setCounterparty(""); setDate(""); setReference(""); setMoneyIn(""); setMoneyOut("");
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add Book Transaction (ledger entry)"
      subtitle="Simulated journal entry against the bank account's linked cash account."
      size="lg"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" icon="check" onClick={submit}>Record Entry</Button></>}
    >
      <div className="space-y-4">
        {error && <Alert kind="danger">{error}</Alert>}
        <div className="grid grid-cols-2 gap-4">
          <Field label="Transaction Type">
            <Select value={type} onChange={(e) => setType(e.target.value as BookTxType)}>
              {Object.entries(TX_TYPE_META).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Chart of Accounts">
            <Select value={coa} onChange={(e) => setCoa(e.target.value)}>
              {state.coa.map((c) => (
                <option key={c.code} value={c.code}>{c.code} — {c.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Reference"><Input value={reference} onChange={(e) => setReference(e.target.value)} /></Field>
          <Field label="Description" >
            <Input value={description} onChange={(e) => setDescription(e.target.value)} className="col-span-2" />
          </Field>
          <Field label="Counterparty"><Input value={counterparty} onChange={(e) => setCounterparty(e.target.value)} className="col-span-2" /></Field>
          {direction === "in" ? (
            <Field label="Money In"><Input type="number" step="0.01" value={moneyIn} onChange={(e) => setMoneyIn(e.target.value)} /></Field>
          ) : (
            <Field label="Money Out"><Input type="number" step="0.01" value={moneyOut} onChange={(e) => setMoneyOut(e.target.value)} /></Field>
          )}
        </div>
        <Alert kind="info">Simulated posting — no real journal is written to an accounting system in this demo.</Alert>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Manual match picker (book → bank)
// ---------------------------------------------------------------------------

function ManualMatchModal({ open, onClose, bookTx, bankTxs, onConfirm }: { open: boolean; onClose: () => void; bookTx: BookTransaction | null; bankTxs: BankTransaction[]; onConfirm: (bankIds: string[]) => void }) {
  const [sel, setSel] = useState<Set<string>>(new Set());
  const book = bookTx;

  const toggle = (id: string) => {
    const next = new Set(sel);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSel(next);
  };

  const total = [...sel].reduce((a, id) => a + (bankTxs.find((b) => b.id === id)?.signedAmount ?? 0), 0);
  const matchesAmount = Math.abs(total - (book?.signedAmount ?? 0)) < 0.005;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Manual Match — select bank transaction(s)"
      subtitle={book ? `Book transaction: ${book.description} (${moneySigned(book.signedAmount)})` : undefined}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" icon="check" disabled={sel.size === 0 || !matchesAmount} onClick={() => onConfirm([...sel])}>
            Confirm Match
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Alert kind={matchesAmount ? "success" : "danger"}>
          {sel.size === 0
            ? "Select one or more bank transactions. Grouped amounts must reconcile exactly with the book transaction (recorded fees may be included as separate book entries)."
            : matchesAmount
              ? `Combined bank amount ${moneySigned(total)} equals the book amount — match will reconcile exactly.`
              : `Combined bank amount ${moneySigned(total)} does NOT equal the book amount ${moneySigned(book?.signedAmount ?? 0)} (difference ${moneySigned(total - (book?.signedAmount ?? 0))}). Record the difference as a missing transaction first.`}
        </Alert>
        <div className="max-h-72 overflow-y-auto rounded-lg border border-u-line divide-y divide-u-line">
          {bankTxs.map((t) => (
            <label key={t.id} className="flex items-center gap-3 px-3 py-2 hover:bg-u-s2 cursor-pointer">
              <input type="checkbox" checked={sel.has(t.id)} onChange={() => toggle(t.id)} className="w-4 h-4 rounded border-u-line2 text-u-accent focus:ring-u-accent/60" />
              <span className="text-xs text-u-ink2 flex-1 truncate">{t.description}</span>
              <span className="text-[11px] text-u-muted">{fmtDate(t.date)} · {t.reference}</span>
              <span className={`text-xs tabular-nums font-medium ${t.signedAmount >= 0 ? "text-u-ok" : "text-u-danger"}`}>{moneySigned(t.signedAmount)}</span>
            </label>
          ))}
          {bankTxs.length === 0 && <p className="p-6 text-center text-xs text-u-muted">No eligible unmatched bank transactions of the same direction.</p>}
        </div>
      </div>
    </Modal>
  );
}
