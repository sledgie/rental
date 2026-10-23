import { useMemo, useState } from "react";
import Link from "../shim/link";
import { useStore } from "../lib/store";
import { computeRecon } from "../lib/calc";
import { Button, Card, DataTableWrap, EmptyState, Input, Select, Th, Td, Toolbar, reconStatusBadge } from "../components/ui";
import { Icon } from "../components/icons";
import { fmtDate, fmtDateTime, money, moneySigned } from "../lib/format";

export default function HistoryPage() {
  const { state } = useStore();
  const [search, setSearch] = useState("");
  const [accountId, setAccountId] = useState("all");
  const [status, setStatus] = useState("all");

  const rows = useMemo(() => {
    return state.reconciliations
      .filter((r) => {
        if (accountId !== "all" && r.accountId !== accountId) return false;
        if (status !== "all" && r.status !== status) return false;
        if (search) {
          const s = search.toLowerCase();
          const acct = state.accounts.find((a) => a.id === r.accountId);
          if (!`${r.reference} ${acct?.name ?? ""} ${r.statementRef}`.toLowerCase().includes(s)) return false;
        }
        return true;
      })
      .sort((a, b) => b.periodStart.localeCompare(a.periodStart));
  }, [state, search, accountId, status]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-u-ink">Reconciliation History</h2>
          <p className="text-sm text-u-muted">Completed, reopened, cancelled, and in-progress reconciliations by account and period.</p>
        </div>
        <Toolbar>
          <div className="relative">
            <Icon name="search" className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-u-muted" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" className="w-48 pl-8" />
          </div>
          <Select value={accountId} onChange={(e) => setAccountId(e.target.value)} className="w-56">
            <option value="all">All accounts</option>
            {state.accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </Select>
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-44">
            <option value="all">All statuses</option>
            {["In Progress", "Needs Review", "Ready to Finalize", "Reconciled", "Reopened", "Cancelled"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </Select>
        </Toolbar>
      </div>

      <Card>
        {rows.length === 0 ? (
          <EmptyState icon="history" title="No reconciliations found" />
        ) : (
          <DataTableWrap>
            <thead className="bg-u-s2">
              <tr>
                <Th>Reference</Th>
                <Th>Account</Th>
                <Th>Period</Th>
                <Th className="text-right">Statement Ending</Th>
                <Th className="text-right">Remaining Diff.</Th>
                <Th>Status</Th>
                <Th>Finalized / Notes</Th>
                <Th></Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-u-line">
              {rows.map((r) => {
                const account = state.accounts.find((a) => a.id === r.accountId);
                const calc = r.status === "Reconciled" || r.status === "Cancelled" ? null : computeRecon(state, r);
                const diff = r.finalSummary?.remainingDifference ?? calc?.remainingDifference ?? 0;
                return (
                  <tr key={r.id} className="hover:bg-u-s2/60">
                    <Td className="font-mono text-xs">{r.reference}</Td>
                    <Td>{account?.name ?? r.accountId}</Td>
                    <Td className="whitespace-nowrap">{fmtDate(r.periodStart)} – {fmtDate(r.periodEnd)}</Td>
                    <Td className="text-right tabular-nums">{money(r.statementEndingBalance)}</Td>
                    <Td className={`text-right tabular-nums ${Math.abs(diff) > 0.005 ? "text-u-danger" : "text-u-ok"}`}>{moneySigned(diff)}</Td>
                    <Td>{reconStatusBadge(r.status)}</Td>
                    <Td>
                      {r.finalizedBy && <span className="text-xs text-u-ink2">{r.finalizedBy} · {fmtDateTime(r.finalizedAt ?? r.createdAt).split(" at ")[0]}</span>}
                      {r.reopenReason && <div className="text-[11px] text-u-warn mt-0.5 truncate max-w-[16rem]">↺ {r.reopenReason}</div>}
                      {r.status === "Cancelled" && <div className="text-[11px] text-u-muted mt-0.5">{r.notes}</div>}
                    </Td>
                    <Td>
                      <Link href={`/accounting/bank-reconciliation/history/${r.id}`}>
                        <Button size="sm" variant="ghost" icon="chevronRight">View</Button>
                      </Link>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </DataTableWrap>
        )}
      </Card>
    </div>
  );
}
