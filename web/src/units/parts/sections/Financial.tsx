import { useMemo, useState } from "react";
import type { Database, Transaction } from "../../data/types";
import type { UnitRow } from "../../data/selectors";
import { formatDate, money, monthLabel, signedMoney } from "../../lib/format";
import { Icon } from "../../components/ui/Icon";
import { Button, Pill, Select, Sparkline, Tip } from "../../components/ui/primitives";
import { Callout, Modal } from "../../components/ui/Modal";
import { ActionLink, MiniStat, MoneyLine, SectionCard } from "./common";
import { paymentTone, txMeta, txStatusTone } from "../status";

function amountFor(t: Transaction): { value: string; tone: string } {
  const meta = txMeta[t.transactionType];
  const sign = meta.direction === "payment" || meta.direction === "credit" ? -1 : 1;
  return {
    value: signedMoney(sign * t.amount),
    tone:
      meta.direction === "payment" || meta.direction === "credit"
        ? "text-u-ok"
        : meta.direction === "expense"
          ? "text-u-muted"
          : "text-u-ink",
  };
}

function TxRow({ t, dense }: { t: Transaction; dense?: boolean }) {
  const meta = txMeta[t.transactionType];
  const { value, tone } = amountFor(t);
  const excluded = t.transactionStatus !== "Posted";
  return (
    <tr
      className={
        "border-t border-u-line2/60 transition-colors hover:bg-u-s2/50" + (excluded ? " opacity-55" : "")
      }
    >
      <td className={"u-num whitespace-nowrap text-u-muted " + (dense ? "px-2 py-1.5" : "px-2.5 py-2")}>
        {formatDate(t.transactionDate)}
      </td>
      <td className="u-num hidden whitespace-nowrap px-2.5 py-2 text-u-muted sm:table-cell">
        {t.dueDate ? formatDate(t.dueDate) : "—"}
      </td>
      <td className={"min-w-0 " + (dense ? "px-2 py-1.5" : "px-2.5 py-2")}>
        <span className="flex items-center gap-1.5">
          <span className="truncate text-[12px] text-u-ink2">{t.description}</span>
          {excluded && (
            <Pill tone={txStatusTone[t.transactionStatus]} className="shrink-0">
              {t.transactionStatus} · excluded
            </Pill>
          )}
        </span>
        <span className="u-num mt-0.5 block text-[10.5px] text-u-muted">
          {t.id}
          {t.leaseId ? ` · ${t.leaseId}` : ""}
          {t.reference ? ` · ${t.reference}` : ""}
        </span>
      </td>
      <td className="hidden px-2.5 py-2 md:table-cell">
        <Pill tone={meta.tone}>{meta.label}</Pill>
      </td>
      <td className={"u-num whitespace-nowrap text-right font-500 " + tone + (dense ? " px-2 py-1.5" : " px-2.5 py-2")}>
        {value}
      </td>
      <td className="hidden whitespace-nowrap px-2.5 py-2 lg:table-cell">
        {t.paymentStatus ? <Pill tone={paymentTone[t.paymentStatus]}>{t.paymentStatus}</Pill> : <span className="text-u-muted">—</span>}
        {t.transactionType === "Rent Charge" && t.paymentStatus === "Partial" && (
          <span className="u-num ml-1 text-[10.5px] text-u-muted">{money(t.amountPaid ?? 0)} applied</span>
        )}
      </td>
    </tr>
  );
}

export function FinancialSection({ row, db }: { row: UnitRow; db: Database }) {
  const f = row.financials;
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const ledgerRows = useMemo(() => {
    return db.transactions
      .filter((t) => t.unitId === row.unit.id)
      .filter((t) => (typeFilter === "all" ? true : t.transactionType === typeFilter))
      .filter((t) => (statusFilter === "all" ? true : t.transactionStatus === statusFilter))
      .sort((a, b) => b.transactionDate.localeCompare(a.transactionDate));
  }, [db.transactions, row.unit.id, typeFilter, statusFilter]);

  const postedTotals = useMemo(() => {
    const posted = ledgerRows.filter((t) => t.transactionStatus === "Posted");
    return {
      charges: posted.filter((t) => txMeta[t.transactionType].direction === "debit").reduce((s, t) => s + t.amount, 0),
      payments: posted.filter((t) => txMeta[t.transactionType].direction === "payment").reduce((s, t) => s + t.amount, 0),
      credits: posted.filter((t) => txMeta[t.transactionType].direction === "credit").reduce((s, t) => s + t.amount, 0),
      expenses: posted.filter((t) => txMeta[t.transactionType].direction === "expense").reduce((s, t) => s + t.amount, 0),
    };
  }, [ledgerRows]);

  return (
    <SectionCard
      icon="wallet"
      step="D"
      title="Financial Summary"
      meta={`Unit account ACC-${row.unit.code ?? row.unit.id} · CAD`}
      actions={
        <Button size="xs" variant="primary" icon="list" onClick={() => setLedgerOpen(true)}>
          View financial ledger
        </Button>
      }
    >
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <MiniStat
          label="Contractual rent"
          icon="dollar"
          value={row.ctx.currentRent !== null ? money(row.ctx.currentRent) : "—"}
          tone={row.ctx.currentRent !== null ? "azure" : "muted"}
          hint={
            row.ctx.currentRent !== null
              ? row.ctx.rentBasis === "allocation"
                ? "Unit allocation on the current lease"
                : row.ctx.rentBasis === "single-unit-lease"
                  ? "Single-unit lease total"
                  : "Holdover rate — excluded from the rent roll"
              : row.ctx.rentBasis === "unallocated"
                ? "Shared lease, no allocation recorded"
                : "No applicable lease"
          }
        />
        <MiniStat
          label="Billed this month"
          icon="clipboard"
          value={money(f.billedThisMonth)}
          hint="Posted charges only"
        />
        <MiniStat
          label="Collected this month"
          icon="check"
          tone="jade"
          value={money(f.collectedThisMonth)}
          hint={f.collectionRate !== null ? `${f.collectionRate.toFixed(0)}% of trailing rent billed` : "No billing history"}
        />
        <MiniStat
          label="Outstanding"
          icon="clock"
          tone={f.outstandingNet > 0 ? "amber" : "jade"}
          value={money(f.outstandingNet)}
          hint={
            f.credits > 0
              ? `${money(f.outstandingGross)} gross less ${money(f.credits)} credits`
              : "Open posted charges"
          }
        />
        <MiniStat
          label="Overdue"
          icon="alert"
          tone={f.overdueNet > 0 ? "rose" : "jade"}
          value={money(f.overdueNet)}
          hint={f.overdueNet > 0 ? "Past due date and unpaid" : "Nothing past due"}
        />
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,240px)]">
        <div className="rounded-md border border-u-line2 bg-u-bg/45 px-3 py-2">
          <MoneyLine label="Rent billed this month" value={money(f.billedThisMonth)} hint="Posted rent charges dated in the current month" />
          <MoneyLine label="Rent collected this month" value={money(f.collectedThisMonth)} tone="jade" hint="Posted rent payments dated in the current month" />
          <MoneyLine label="Outstanding rent" value={money(Math.max(0, f.outstandingGross - f.otherChargesOpen))} tone={f.outstandingGross > f.otherChargesOpen ? "amber" : "neutral"} />
          <MoneyLine label="Other open charges" value={money(f.otherChargesOpen)} tone="amber" hint="Late fees, utilities, parking, recharges" />
          <MoneyLine label="Credits & adjustments" value={f.credits ? `− ${money(f.credits)}` : money(0)} tone="jade" hint="Applied within this unit account only" />
          <MoneyLine
            label="Overdue amount"
            value={money(f.overdueGross)}
            tone={f.overdueGross > 0 ? "rose" : "jade"}
            hint="Unpaid posted charges past their due date"
          />
          <MoneyLine label="Maintenance expense (90 days)" value={money(f.maintenanceExpenseRecent)} tone="muted" hint="Owner cost — not a tenant receivable" />
          <MoneyLine label="Security deposit held" value={f.securityDeposit !== null ? money(f.securityDeposit) : "—"} tone="muted" hint="Held in trust, not income" />
          <MoneyLine label="Net balance on this unit" value={money(f.outstandingNet)} tone={f.outstandingNet > 0 ? "rose" : "jade"} strong />
        </div>

        <div className="flex flex-col gap-2">
          <div className="rounded-md border border-u-line2 bg-u-bg/45 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.09em] text-u-muted">
              Billed vs collected · 6 months
            </p>
            <div className="mt-2 flex items-end justify-between gap-2">
              <Sparkline data={f.series.map((p) => p.collected)} tone="var(--ok)" width={118} height={38} />
              <div className="text-right">
                <p className="u-num text-[15px] font-600 text-u-ok">{money(f.series.reduce((s, p) => s + p.collected, 0))}</p>
                <p className="text-[10.5px] text-u-muted">collected</p>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-3 text-[10.5px] text-u-muted">
              {f.series.map((p) => (
                <Tip key={p.key} content={`${monthLabel(p.key)} — billed ${money(p.billed)} · collected ${money(p.collected)}`}>
                  <span className="flex flex-col items-center gap-1">
                    <span className="flex h-6 w-4 items-end gap-px">
                      <span
                        className="w-[7px] rounded-[1px] bg-u-line2"
                        style={{ height: `${Math.max(6, (p.billed / Math.max(...f.series.map((x) => x.billed), 1)) * 100)}%` }}
                      />
                      <span
                        className="w-[7px] rounded-[1px] bg-u-ok/80"
                        style={{ height: `${Math.max(6, (p.collected / Math.max(...f.series.map((x) => x.billed), 1)) * 100)}%` }}
                      />
                    </span>
                    <span className="u-num">{p.label}</span>
                  </span>
                </Tip>
              ))}
            </div>
          </div>
          {(f.excluded.draft + f.excluded.voided + f.excluded.scheduled > 0) && (
            <Callout tone="muted" icon="shield">
              <strong className="text-u-ink2">Excluded from balances:</strong>{" "}
              {f.excluded.draft} draft, {f.excluded.voided} voided, {f.excluded.scheduled} scheduled. Only posted
              transactions affect this unit's account.
            </Callout>
          )}
        </div>
      </div>

      {/* recent transactions */}
      <div className="mt-3 overflow-hidden rounded-md border border-u-line2">
        <div className="flex items-center justify-between gap-2 bg-u-s2/55 px-2.5 py-1.5">
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.09em] text-u-muted">
            Recent transactions
          </span>
          <ActionLink onClick={() => setLedgerOpen(true)} icon="external">
            Open full ledger
          </ActionLink>
        </div>
        <table className="w-full text-left">
          <tbody>
            {f.recent.slice(0, 6).map((t) => (
              <TxRow key={t.id} t={t} dense />
            ))}
            {f.recent.length === 0 && (
              <tr>
                <td className="px-2.5 py-4 text-center text-[12px] text-u-muted">
                  No transactions have ever been raised against this unit account.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-2 flex items-start gap-1.5 text-[10.5px] leading-relaxed text-u-muted">
        <Icon name="info" size={11} className="mt-px shrink-0" />
        Overdue is derived from unpaid posted charges past their due date. Credits are applied to this unit account
        only — never offset against another tenant, lease or unit. Shared-lease amounts use the recorded allocation.
      </p>

      {/* ---- full ledger ---- */}
      <Modal
        open={ledgerOpen}
        onClose={() => setLedgerOpen(false)}
        title={`Financial ledger — unit ${row.unit.unitNumber}`}
        subtitle={
          <span className="u-num">
            ACC-{row.unit.code ?? row.unit.id} · {ledgerRows.length} transaction{ledgerRows.length === 1 ? "" : "s"} · CAD
          </span>
        }
        icon="list"
        width="lg"
        footer={
          <>
            <span className="mr-auto text-[11.5px] text-u-muted">
              Posted totals — charges <span className="u-num text-u-ink2">{money(postedTotals.charges)}</span> · payments{" "}
              <span className="u-num text-u-ok">{money(postedTotals.payments)}</span> · credits{" "}
              <span className="u-num text-u-ok">{money(postedTotals.credits)}</span> · expenses{" "}
              <span className="u-num text-u-muted">{money(postedTotals.expenses)}</span>
            </span>
            <Button onClick={() => setLedgerOpen(false)}>Close</Button>
          </>
        }
      >
        <div className="mb-2.5 flex flex-wrap items-center gap-2">
          <Select
            aria-label="Filter by transaction type"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="h-8 w-auto min-w-[168px] text-[12px]"
          >
            <option value="all">All transaction types</option>
            {Object.keys(txMeta).map((k) => (
              <option key={k} value={k}>
                {txMeta[k as keyof typeof txMeta].label}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Filter by posting status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-8 w-auto min-w-[150px] text-[12px]"
          >
            <option value="all">All posting statuses</option>
            {["Posted", "Draft", "Scheduled", "Void"].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
          {(typeFilter !== "all" || statusFilter !== "all") && (
            <Button
              size="xs"
              variant="ghost"
              icon="x"
              onClick={() => {
                setTypeFilter("all");
                setStatusFilter("all");
              }}
            >
              Clear
            </Button>
          )}
          <span className="u-num ml-auto text-[11.5px] text-u-muted">
            Net balance {money(f.outstandingNet)}
          </span>
        </div>
        <div className="overflow-hidden rounded-md border border-u-line2">
          <table className="w-full text-left">
            <thead className="bg-u-s2/70 text-[10px] uppercase tracking-[0.09em] text-u-muted">
              <tr>
                <th className="px-2.5 py-1.5 font-semibold">Date</th>
                <th className="hidden px-2.5 py-1.5 font-semibold sm:table-cell">Due</th>
                <th className="px-2.5 py-1.5 font-semibold">Description / account</th>
                <th className="hidden px-2.5 py-1.5 font-semibold md:table-cell">Type</th>
                <th className="px-2.5 py-1.5 text-right font-semibold">Amount</th>
                <th className="hidden px-2.5 py-1.5 font-semibold lg:table-cell">Payment</th>
              </tr>
            </thead>
            <tbody className="bg-u-bg/40">
              {ledgerRows.map((t) => (
                <TxRow key={t.id} t={t} />
              ))}
              {ledgerRows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-2.5 py-6 text-center text-[12px] text-u-muted">
                    No transactions match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Modal>
    </SectionCard>
  );
}
