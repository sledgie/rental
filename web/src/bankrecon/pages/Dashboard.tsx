import { useMemo, useState } from "react";
import Link from "../shim/link";
import { useStore } from "../lib/store";
import { computeDashboardTotals, computeRecon, withinPeriod } from "../lib/calc";
import { Badge, Button, Card, DataTableWrap, EmptyState, Input, Select, StatCard, Th, Td, Toolbar, Alert, ProgressBar } from "../components/ui";
import { Icon } from "../components/icons";
import { StartReconModal } from "../components/recon/StartReconModal";
import { money, moneySigned, fmtDate, fmtDateTime } from "../lib/format";
import { Reconciliation, ReconStatus } from "../lib/types";

export default function ReconDashboardPage() {
  const { state } = useStore();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<"name" | "balance" | "difference" | "status">("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [startOpen, setStartOpen] = useState(false);
  const [startAccount, setStartAccount] = useState<string | undefined>(undefined);

  const totals = useMemo(() => computeDashboardTotals(state), [state]);

  const rows = useMemo(() => {
    const activeRecon = (accountId: string): Reconciliation | null => {
      const recs = state.reconciliations
        .filter((r) => r.accountId === accountId && r.status !== "Cancelled")
        .sort((a, b) => b.periodStart.localeCompare(a.periodStart));
      return recs[0] ?? null;
    };
    return state.accounts
      .map((a) => {
        const recon = activeRecon(a.id);
        const calc = recon ? computeRecon(state, recon) : null;
        return { account: a, recon, calc };
      })
      .filter(({ account, calc }) => {
        if (!account.active && statusFilter !== "inactive") return false;
        if (statusFilter !== "all") {
          const status = calc?.suggestedStatus ?? "Not Started";
          if (statusFilter === "reconciled" && calc?.suggestedStatus !== "Reconciled") return false;
          if (statusFilter === "active" && !calc) return false;
          if (statusFilter !== "all" && statusFilter !== "inactive" && statusFilter !== "reconciled" && statusFilter !== "active" && status !== statusFilter) return false;
        }
        if (typeFilter !== "all" && account.accountType !== typeFilter) return false;
        if (search) {
          const s = search.toLowerCase();
          if (!`${account.name} ${account.maskedAccount} ${account.id} ${account.institution}`.toLowerCase().includes(s)) return false;
        }
        return true;
      })
      .sort((x, y) => {
        const dir = sortDir === "asc" ? 1 : -1;
        if (sortKey === "name") return x.account.name.localeCompare(y.account.name) * dir;
        if (sortKey === "balance") return ((y.calc?.statementEndingBalance ?? 0) - (x.calc?.statementEndingBalance ?? 0)) * dir;
        if (sortKey === "difference") return ((x.calc?.remainingDifference ?? 0) - (y.calc?.remainingDifference ?? 0)) * dir;
        return ((x.calc?.suggestedStatus ?? "Not Started").localeCompare(y.calc?.suggestedStatus ?? "Not Started")) * dir;
      });
  }, [state, search, statusFilter, typeFilter, sortKey, sortDir]);

  const toggleSort = (k: "name" | "balance" | "difference" | "status") => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setSortDir("asc");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-u-ink">Bank Reconciliation</h2>
          <p className="text-sm text-u-muted">
            Compare bank statements against accounting records, investigate differences, and finalize monthly reconciliations.
          </p>
        </div>
        <Button variant="primary" icon="play" onClick={() => { setStartAccount(undefined); setStartOpen(true); }}>
          Start Reconciliation
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Bank Accounts" value={totals.totalAccounts} hint={`${totals.activeAccounts} active · ${state.accounts.length - totals.activeAccounts} inactive`} icon="bank" tone="slate" />
        <StatCard label="Accounts Requiring Reconciliation" value={totals.accountsNeedingRecon} hint="Current period outstanding" icon="refresh" tone="amber" />
        <StatCard label="Reconciliations In Progress" value={totals.inProgress} hint={`${totals.overdue} overdue`} icon="clock" tone="violet" />
        <StatCard label="Completed Reconciliations" value={totals.completed} hint="Reconciled and locked" icon="check" tone="emerald" />
        <StatCard label="Unmatched Bank Transactions" value={totals.unmatchedBankTxs} hint="Across active reconciliations" icon="alert" tone="rose" />
        <StatCard label="Unmatched Book Transactions" value={totals.unmatchedBookTxs} hint="Timing differences or investigations" icon="alert" tone="amber" />
        <StatCard label="Unresolved Differences" value={totals.unresolvedDifferences} hint="Reconciliations not balancing" icon="scale" tone="rose" />
        <StatCard label="Overdue Reconciliations" value={totals.overdue} hint="Past statement period, not completed" icon="clock" tone="violet" />
      </div>

      <Alert kind="info">
        Demonstration environment: all figures are derived from simulated records in this browser session. No real bank connection exists and no actual funds move.
      </Alert>

      {/* Account reconciliation summary */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-u-line px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-u-ink">Account Reconciliation Summary</h2>
            <p className="text-xs text-u-muted">Open any account to continue its reconciliation workspace.</p>
          </div>
          <Toolbar>
            <div className="relative">
              <Icon name="search" className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-u-muted" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search accounts…" className="w-44 pl-8" />
            </div>
            <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="w-40">
              <option value="all">All types</option>
              {["Operating", "Trust", "Reserve", "Restricted", "Other"].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </Select>
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-44">
              <option value="all">All statuses</option>
              <option value="active">Not Reconciled</option>
              <option value="reconciled">Reconciled</option>
              <option value="inactive">Inactive accounts</option>
            </Select>
          </Toolbar>
        </div>

        {rows.length === 0 ? (
          <EmptyState icon="bank" title="No bank accounts match your filters" />
        ) : (
          <DataTableWrap>
            <thead className="bg-u-s2">
              <tr>
                <Th sortable={sortKey === "name"} onSort={() => toggleSort("name")} sortDir={sortKey === "name" ? sortDir : undefined}>Bank Account</Th>
                <Th>Type</Th>
                <Th>GL Account</Th>
                <Th>Last Reconciled</Th>
                <Th>Current Period</Th>
                <Th sortable={sortKey === "balance"} onSort={() => toggleSort("balance")} sortDir={sortKey === "balance" ? sortDir : undefined}>Statement Balance</Th>
                <Th>Book Balance</Th>
                <Th>Unreconciled</Th>
                <Th sortable={sortKey === "difference"} onSort={() => toggleSort("difference")} sortDir={sortKey === "difference" ? sortDir : undefined}>Difference</Th>
                <Th sortable={sortKey === "status"} onSort={() => toggleSort("status")} sortDir={sortKey === "status" ? sortDir : undefined}>Status</Th>
                <Th>Actions</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-u-line">
              {rows.map(({ account, recon, calc }) => {
                const lastReconciled = state.reconciliations
                  .filter((r) => r.accountId === account.id && r.status === "Reconciled")
                  .sort((a, b) => b.periodEnd.localeCompare(a.periodEnd))[0];
                const status: ReconStatus = calc?.suggestedStatus ?? "Not Started";
                const totalBankTxns = recon
                  ? state.bankTxs.filter((t) => t.accountId === account.id && withinPeriod(t.date, recon.periodStart, recon.periodEnd)).length
                  : 0;
                return (
                  <tr key={account.id} className="hover:bg-u-s2/60 align-top">
                    <Td>
                      <div className="font-medium text-u-ink">{account.name}</div>
                      <div className="text-[11px] text-u-muted">{account.maskedAccount} · {account.institution}</div>
                    </Td>
                    <Td>
                      <Badge kind={account.accountType === "Trust" ? "outstanding" : account.accountType === "Operating" ? "suggested" : "neutral"}>{account.accountType}</Badge>
                      <div className="text-[11px] text-u-muted mt-1">{account.classification}</div>
                    </Td>
                    <Td>{account.glAccount}<div className="text-[11px] text-u-muted">{account.glAccountName}</div></Td>
                    <Td className="whitespace-nowrap">{lastReconciled ? fmtDate(lastReconciled.periodEnd) : "—"}</Td>
                    <Td className="whitespace-nowrap">
                      {recon ? fmtDate(recon.periodStart) : <span className="text-u-muted">No reconciliation started</span>}
                    </Td>
                    <Td className="tabular-nums font-medium">{recon ? money(recon.statementEndingBalance) : "—"}</Td>
                    <Td className="tabular-nums">{calc ? money(calc.bookBalance) : "—"}</Td>
                    <Td className="tabular-nums">{recon ? `${calc?.unmatchedBank.length ?? 0} bank / ${calc?.unmatchedBook.length ?? 0} book` : "—"}</Td>
                    <Td className={`tabular-nums font-medium ${(calc?.remainingDifference ?? 0) !== 0 ? "text-u-danger" : "text-u-ok"}`}>
                      {calc ? moneySigned(calc.remainingDifference) : "—"}
                    </Td>
                    <Td>
                      <Badge kind={status === "Reconciled" ? "matched" : status === "Ready to Finalize" ? "ready" : status === "Needs Review" ? "review" : status === "Not Started" ? "neutral" : "suggested"} dot>
                        {status}
                      </Badge>
                      {recon && status !== "Reconciled" && status !== "Cancelled" && (
                        <div className="mt-1.5 w-24">
                          <ProgressBar
                            value={calc?.matchedBankCount ?? 0}
                            max={Math.max(totalBankTxns, 1)}
                            tone={status === "Ready to Finalize" ? "emerald" : "indigo"}
                          />
                        </div>
                      )}
                    </Td>
                    <Td>
                      <div className="flex flex-col gap-1.5">
                        <Link href={`/accounting/bank-reconciliation/workspace/${account.id}`}>
                          <Button size="sm" variant={recon ? "primary" : "secondary"} icon={recon ? "refresh" : "play"}>
                            {recon ? "Continue" : "Open"}
                          </Button>
                        </Link>
                        <Link href="/accounting/bank-reconciliation/history">
                          <Button size="sm" variant="ghost" icon="history">History</Button>
                        </Link>
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </DataTableWrap>
        )}
      </Card>

      {/* Recent activity */}
      <Card>
        <div className="border-b border-u-line px-5 py-4">
          <h2 className="text-sm font-semibold text-u-ink">Recent Activity (Audit Trail)</h2>
          <p className="text-xs text-u-muted">Configuration changes, imports, matches, and workflow events.</p>
        </div>
        <ul className="divide-y divide-u-line">
          {state.audit.slice(0, 8).map((e) => (
            <li key={e.id} className="flex items-center gap-3 px-5 py-2.5">
              <div className="w-7 h-7 rounded-lg bg-u-s2 text-u-muted flex items-center justify-center shrink-0">
                <Icon name="history" className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-u-ink2">
                  <span className="font-medium">{e.action}</span> · <span className="text-u-muted">{e.record}</span>
                </p>
                <p className="text-[11px] text-u-muted truncate">{e.notes}</p>
              </div>
              <span className="text-[11px] text-u-muted whitespace-nowrap">{fmtDateTime(e.at)}</span>
              <span className="text-[11px] text-u-muted whitespace-nowrap">{e.user}</span>
            </li>
          ))}
        </ul>
      </Card>

      <StartReconModal open={startOpen} onClose={() => setStartOpen(false)} accountId={startAccount} />
    </div>
  );
}
