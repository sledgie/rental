import { useEffect, useMemo, useRef, useState } from "react";
import type {
  AllocationStrategy,
  CreditBalance,
  Invoice,
  InvoiceBalance,
  Lease,
  NewPaymentInput,
  Payment,
  PaymentMethod,
  Property,
  Tenant,
  TenantCredit,
  Unit,
} from "../types";
import {
  allocateFunds,
  eligibleInvoices,
  fmtCAD,
  formatDate,
  METHOD_LABELS,
  periodLabel,
  sumCents,
  todayISO,
  validatePaymentDraft,
  validateReferenceDuplicate,
} from "../utils/paymentUtils";
import { Button, Field, Icon, inputCls, Modal, ModalHeader, textareaCls } from "./ui";
import { PaymentAllocationTable } from "./PaymentAllocationTable";
import { cn } from "../utils/cn";

// ---------------------------------------------------------------------------
// Searchable tenant dropdown
// ---------------------------------------------------------------------------

function TenantCombobox({
  tenants,
  leases,
  units,
  properties,
  value,
  onChange,
  invalid,
}: {
  tenants: Tenant[];
  leases: Lease[];
  units: Unit[];
  properties: Property[];
  value: string;
  onChange: (id: string) => void;
  invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  const selected = tenants.find((t) => t.id === value);

  const unitLabelFor = (tenantId: string) =>
    leases
      .filter((l) => l.tenantId === tenantId)
      .map((l) => {
        const unit = units.find((u) => u.id === l.unitId);
        const property = unit ? properties.find((p) => p.id === unit.propertyId) : undefined;
        return property && unit ? `${property.name} · ${unit.number}` : l.id;
      })
      .join(" / ");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tenants;
    return tenants.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.number.toLowerCase().includes(q) ||
        unitLabelFor(t.id).toLowerCase().includes(q),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, tenants, leases, units, properties]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const pick = (id: string) => {
    onChange(id);
    setOpen(false);
    setQuery("");
  };

  return (
    <div ref={rootRef} className="relative">
      <div className="relative">
        <Icon name="user" className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-u-muted" />
        <input
          id="pf-tenant"
          role="combobox"
          aria-expanded={open}
          aria-controls="pf-tenant-list"
          aria-autocomplete="list"
          aria-invalid={invalid || undefined}
          autoComplete="off"
          className={cn(inputCls, "pl-9 pr-8")}
          placeholder="Search by name, account # or unit…"
          value={open ? query : (selected ? `${selected.name} · ${selected.number}` : "")}
          onFocus={() => {
            setOpen(true);
            setQuery("");
            setHighlight(0);
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            setHighlight(0);
            if (!open) setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
              setHighlight((h) => Math.min(filtered.length - 1, h + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setHighlight((h) => Math.max(0, h - 1));
            } else if (e.key === "Enter") {
              e.preventDefault();
              if (open && filtered[highlight]) pick(filtered[highlight].id);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
        />
        <Icon name="chevron-down" className={cn("pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-u-muted transition-transform", open && "rotate-180")} />
      </div>
      {open && (
        <ul
          id="pf-tenant-list"
          role="listbox"
          aria-label="Tenants"
          className="absolute z-20 mt-1.5 max-h-64 w-full overflow-y-auto rounded-lg bg-u-card py-1 shadow-lg ring-1 ring-u-line2/10 animate-p-rise"
        >
          {filtered.length === 0 && (
            <li className="px-3 py-2.5 text-[13px] text-u-muted">No tenants match “{query}”.</li>
          )}
          {filtered.map((t, i) => (
            <li key={t.id} role="option" aria-selected={t.id === value}>
              <button
                type="button"
                onMouseEnter={() => setHighlight(i)}
                onClick={() => pick(t.id)}
                className={cn(
                  "flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition-colors",
                  i === highlight ? "bg-u-accent-soft" : "",
                  t.id === value ? "text-u-accent" : "text-u-ink",
                  !t.active && "opacity-60",
                )}
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">
                    {t.name} <span className="font-mono text-[10px] text-u-muted">{t.number}</span>
                    {!t.active && <span className="ml-1.5 text-[10px] font-semibold text-u-danger uppercase">inactive</span>}
                  </span>
                  <span className="block truncate text-xs text-u-muted">{unitLabelFor(t.id)}</span>
                </span>
                {t.id === value && <Icon name="check" className="h-4 w-4 text-u-accent" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// New payment workflow — steps: 1 tenant & payment · 2 allocate · 3 confirm
// ---------------------------------------------------------------------------

const STEPS = ["Tenant & payment", "Allocate funds", "Review & post"];

export function PaymentForm({
  tenants,
  leases,
  units,
  properties,
  invoices,
  payments,
  credits,
  balances,
  creditBalances,
  onCancel,
  onPost,
}: {
  tenants: Tenant[];
  leases: Lease[];
  units: Unit[];
  properties: Property[];
  invoices: Invoice[];
  payments: Payment[];
  credits: TenantCredit[];
  balances: Map<string, InvoiceBalance>;
  creditBalances: Map<string, CreditBalance>;
  onCancel: () => void;
  onPost: (input: NewPaymentInput) => void;
}) {
  const [step, setStep] = useState(0);
  const [tenantId, setTenantId] = useState("");
  const [leaseId, setLeaseId] = useState("");
  const [date, setDate] = useState(todayISO());
  const [amountText, setAmountText] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("etransfer");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [applyAmounts, setApplyAmounts] = useState<Record<string, string>>({});
  const [strategy, setStrategy] = useState<AllocationStrategy>("oldest");
  const [useCredit, setUseCredit] = useState(false);
  const [overpayChoice, setOverpayChoice] = useState<"credit" | "back" | "">("");
  const [attemptedStep, setAttemptedStep] = useState(-1);
  const [confirmed, setConfirmed] = useState(false);
  const [posting, setPosting] = useState(false);

  const tenant = tenants.find((t) => t.id === tenantId);
  const tenantLeases = useMemo(() => leases.filter((l) => l.tenantId === tenantId), [leases, tenantId]);
  const lease = leases.find((l) => l.id === leaseId);
  const unit = lease ? units.find((u) => u.id === lease.unitId) : undefined;
  const property = unit ? properties.find((p) => p.id === unit.propertyId) : undefined;

  const eligible = useMemo(
    () => (leaseId ? eligibleInvoices(invoices, balances, tenantId, leaseId) : []),
    [invoices, balances, tenantId, leaseId],
  );

  const creditAvailable = useMemo(
    () =>
      sumCents(
        credits
          .filter((c) => c.tenantId === tenantId)
          .map((c) => {
            const b = creditBalances.get(c.id);
            return b && b.valid && !b.exhausted ? b.remaining : 0;
          }),
      ),
    [credits, creditBalances, tenantId],
  );

  const draftRows = useMemo(
    () =>
      eligible
        .filter((inv) => selectedIds.includes(inv.id))
        .map((inv) => ({ invoiceId: inv.id, amountText: applyAmounts[inv.id] ?? "" })),
    [eligible, selectedIds, applyAmounts],
  );

  const validation = useMemo(
    () =>
      validatePaymentDraft(
        {
          tenantId,
          leaseId,
          date,
          amountText,
          method,
          rows: draftRows,
          useCredit,
          creditAvailableCents: creditAvailable,
          keepCreditDecided: overpayChoice === "credit",
        },
        invoices,
        balances,
        payments,
      ),
    [tenantId, leaseId, date, amountText, method, draftRows, useCredit, creditAvailable, overpayChoice, invoices, balances, payments],
  );

  const refWarning = useMemo(() => validateReferenceDuplicate(payments, reference), [payments, reference]);

  const step0Errors = ["tenant", "lease", "date", "amount", "method"].filter((k) => validation.errors[k]);
  const step1Errors = Object.keys(validation.errors).filter((k) => k.startsWith("row:") || k === "allocation" || k === "overpay");

  // ------------------------------------------------------------------ actions

  const selectTenant = (id: string) => {
    setTenantId(id);
    setSelectedIds([]);
    setApplyAmounts({});
    setUseCredit(false);
    setOverpayChoice("");
    const tl = leases.filter((l) => l.tenantId === id);
    setLeaseId(tl.length === 1 ? tl[0].id : "");
  };

  const selectLease = (id: string) => {
    setLeaseId(id);
    setSelectedIds([]);
    setApplyAmounts({});
    setOverpayChoice("");
  };

  const autoAllocate = (strat: AllocationStrategy = strategy) => {
    const funds = Math.max(0, validation.amountCents) + (useCredit ? creditAvailable : 0);
    const lines = allocateFunds(
      eligible
        .filter((inv) => selectedIds.includes(inv.id))
        .map((inv) => ({ invoiceId: inv.id, dueDate: inv.dueDate, outstanding: balances.get(inv.id)?.outstanding ?? 0 })),
      funds,
      strat,
    );
    const next: Record<string, string> = {};
    for (const id of selectedIds) next[id] = "";
    for (const line of lines) next[line.invoiceId] = (line.amount / 100).toFixed(2);
    setApplyAmounts(next);
  };

  const toggleInvoice = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    setApplyAmounts((prev) => ({ ...prev, [id]: prev[id] ?? "" }));
    setOverpayChoice("");
  };

  const toggleAll = (select: boolean) => {
    setSelectedIds(select ? eligible.map((i) => i.id) : []);
    setOverpayChoice("");
  };

  const setApply = (id: string, text: string) => {
    setApplyAmounts((prev) => ({ ...prev, [id]: text }));
    setOverpayChoice("");
  };

  const selectAllAndAuto = () => {
    setSelectedIds(eligible.map((i) => i.id));
    const funds = Math.max(0, validation.amountCents) + (useCredit ? creditAvailable : 0);
    const lines = allocateFunds(
      eligible.map((inv) => ({ invoiceId: inv.id, dueDate: inv.dueDate, outstanding: balances.get(inv.id)?.outstanding ?? 0 })),
      funds,
      strategy,
    );
    const next: Record<string, string> = {};
    for (const inv of eligible) next[inv.id] = "";
    for (const line of lines) next[line.invoiceId] = (line.amount / 100).toFixed(2);
    setApplyAmounts(next);
  };

  const goAllocate = () => {
    setAttemptedStep(0);
    if (step0Errors.length === 0) setStep(1);
  };

  const goReview = () => {
    setAttemptedStep(1);
    if (step0Errors.length === 0 && step1Errors.length === 0) setStep(2);
  };

  const totals = {
    received: validation.amountCents,
    allocated: validation.totalAllocated,
    unallocated: validation.unallocated,
    before: sumCents(eligible.filter((i) => selectedIds.includes(i.id)).map((i) => balances.get(i.id)?.outstanding ?? 0)),
    creditUsed: Math.max(0, validation.totalAllocated - Math.max(0, validation.amountCents)),
  };
  const after = Math.max(0, totals.before - totals.allocated);

  const post = () => {
    setPosting(true);
    window.setTimeout(() => {
      onPost({
        tenantId,
        leaseId,
        date,
        amountCents: totals.received,
        method,
        reference: reference.trim() || undefined,
        notes: notes.trim() || undefined,
        rows: validation.rowsCents
          .filter((r) => r.amount > 0 && selectedIds.includes(r.invoiceId))
          .map((r) => ({ invoiceId: r.invoiceId, amountCents: r.amount })),
        applyCredit: useCredit && totals.creditUsed > 0,
        keepCredit: overpayChoice === "credit",
      });
    }, 450);
  };

  const refPlaceholder =
    method === "etransfer"
      ? "e.g. ETRF-12345-AB (confirmation #)"
      : method === "card"
        ? "e.g. TERM-44712 (terminal approval code)"
        : "Optional — e.g. bill denomination record";

  const invById = useMemo(() => new Map(invoices.map((i) => [i.id, i])), [invoices]);

  return (
    <Modal onClose={onCancel} size="xl" labelledBy="pf-title">
      <ModalHeader
        id="pf-title"
        title="Record a payment"
        subtitle="Fictional demo transaction — posted to the in-memory ledger only. Card numbers and CVVs are never entered here; external terminals process card data separately."
        onClose={onCancel}
      >
        <ol className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium">
          {STEPS.map((label, i) => (
            <li key={label} className="flex items-center gap-2">
              <span
                className={cn(
                  "flex h-5.5 w-5.5 items-center justify-center rounded-full text-[10px] font-bold transition-colors",
                  step > i ? "bg-u-accent text-u-bg" : step === i ? "bg-u-accent text-u-bg ring-4 ring-u-accent/30" : "bg-u-s3 text-u-muted",
                )}
              >
                {step > i ? <Icon name="check" className="h-3 w-3" /> : i + 1}
              </span>
              <span className={step === i ? "text-u-ink" : "text-u-muted"}>{label}</span>
              {i < STEPS.length - 1 && <span className="h-px w-6 bg-u-line sm:w-9" aria-hidden="true" />}
            </li>
          ))}
        </ol>
      </ModalHeader>

      {/* STEP 1 — tenant & payment info */}
      {step === 0 && (
        <>
          <div className="grid grid-cols-1 gap-x-5 gap-y-4 px-6 py-5 md:grid-cols-2">
            <Field label="Tenant" htmlFor="pf-tenant" required error={attemptedStep >= 0 ? validation.errors.tenant : undefined}>
              <TenantCombobox
                tenants={tenants}
                leases={leases}
                units={units}
                properties={properties}
                value={tenantId}
                onChange={selectTenant}
                invalid={attemptedStep >= 0 && !!validation.errors.tenant}
              />
            </Field>

            <Field
              label="Lease"
              htmlFor="pf-lease"
              required={tenantLeases.length > 1}
              error={attemptedStep >= 0 ? validation.errors.lease : undefined}
              hint={
                tenantId && tenantLeases.length === 0
                  ? "This tenant has no leases in the demo data."
                  : tenantLeases.length > 1
                    ? "This tenant has multiple leases — choose one."
                    : undefined
              }
            >
              {tenantLeases.length > 1 ? (
                <select id="pf-lease" value={leaseId} onChange={(e) => selectLease(e.target.value)} className={inputCls} aria-invalid={(attemptedStep >= 0 && !!validation.errors.lease) || undefined}>
                  <option value="">Select a lease…</option>
                  {tenantLeases.map((l) => {
                    const u = units.find((x) => x.id === l.unitId);
                    const pr = u ? properties.find((x) => x.id === u.propertyId) : undefined;
                    return (
                      <option key={l.id} value={l.id}>
                        {l.id} — {pr?.name} · {u?.number} ({fmtCAD(l.monthlyRent)}/mo, {l.status})
                      </option>
                    );
                  })}
                </select>
              ) : (
                <input
                  id="pf-lease"
                  className={cn(inputCls, "bg-u-s2 text-u-muted")}
                  readOnly
                  value={lease ? `${lease.id} · ${fmtCAD(lease.monthlyRent)}/mo · ${lease.status}` : "Auto-selected from tenant"}
                />
              )}
            </Field>

            <Field label="Property / Unit" htmlFor="pf-unit" hint="Populated automatically from the selected lease." className="md:col-span-2">
              <input
                id="pf-unit"
                className={cn(inputCls, "bg-u-s2 text-u-ink2")}
                readOnly
                value={property && unit ? `${property.name} — ${unit.number} · ${property.address}` : "—"}
              />
            </Field>

            {tenant && (
              <div className="rounded-lg border border-u-accent/30 bg-u-accent-soft/70 px-4 py-3 text-[13px] text-u-accent md:col-span-2 animate-p-fade">
                <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
                  <span className="font-semibold">{tenant.name}</span>
                  <span className="font-mono text-xs">Account {tenant.number}</span>
                  <span className="text-u-accent">{tenant.email}</span>
                  <span className="text-u-accent">{tenant.phone}</span>
                  <span className={cn("ml-auto font-semibold", creditAvailable > 0 ? "text-u-blue" : "text-u-accent")}>
                    {creditAvailable > 0 ? `Credit on account: ${fmtCAD(creditAvailable)}` : "No credit on account"}
                  </span>
                </div>
              </div>
            )}

            <Field label="Payment date" htmlFor="pf-date" required error={attemptedStep >= 0 ? validation.errors.date : undefined} hint={date > todayISO() ? "Heads up — this date is in the future." : undefined}>
              <input id="pf-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} aria-invalid={(attemptedStep >= 0 && !!validation.errors.date) || undefined} />
            </Field>

            <Field label="Total amount received (CAD)" htmlFor="pf-amount" required error={attemptedStep >= 0 ? validation.errors.amount : undefined} hint="The actual money received — not the invoice total.">
              <div className="relative">
                <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-u-muted">$</span>
                <input
                  id="pf-amount"
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={amountText}
                  onChange={(e) => setAmountText(e.target.value)}
                  className={cn(inputCls, "pl-7 pr-14 font-display font-semibold tabular-nums")}
                  aria-invalid={(attemptedStep >= 0 && !!validation.errors.amount) || undefined}
                />
                <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs font-medium text-u-muted">CAD</span>
              </div>
            </Field>

            <Field label="Payment method" required error={attemptedStep >= 0 ? validation.errors.method : undefined} className="md:col-span-2">
              <div role="radiogroup" aria-label="Payment method" className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {(Object.keys(METHOD_LABELS) as PaymentMethod[]).map((m) => (
                  <label
                    key={m}
                    className={cn(
                      "flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2.5 text-[13px] font-medium transition-colors",
                      method === m ? "border-u-accent bg-u-accent-soft text-u-accent ring-1 ring-u-accent/40" : "border-u-line bg-u-card text-u-ink2 hover:border-u-line2",
                    )}
                  >
                    <input type="radio" name="pf-method" className="h-3.5 w-3.5 accent-u-accent" checked={method === m} onChange={() => setMethod(m)} />
                    {METHOD_LABELS[m]}
                  </label>
                ))}
              </div>
            </Field>

            <Field
              label="Transaction reference"
              htmlFor="pf-ref"
              hint={refWarning ?? "Optional — confirmation or approval code."}
            >
              <input id="pf-ref" value={reference} onChange={(e) => setReference(e.target.value)} placeholder={refPlaceholder} className={cn(inputCls, refWarning && "border-u-warn/55 focus:border-u-warn focus:ring-u-warn/25")} />
            </Field>

            <Field label="Internal notes" htmlFor="pf-notes">
              <textarea id="pf-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Visible to staff only." className={textareaCls} />
            </Field>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-u-line bg-u-s2/50 px-6 py-4">
            <Button variant="ghost" onClick={onCancel}>Cancel</Button>
            <Button variant="primary" onClick={goAllocate}>
              Continue to allocation
              <Icon name="chevron-right" className="h-4 w-4" />
            </Button>
          </div>
        </>
      )}

      {/* STEP 2 — allocate across invoices */}
      {step === 1 && (
        <>
          <div className="space-y-4 px-6 py-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-display text-[15px] font-semibold text-u-ink">
                  Outstanding invoices — {tenant?.name}
                </h3>
                <p className="text-xs text-u-muted">
                  {lease?.id} · only unpaid / partially paid invoices for this lease are shown.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-1.5 text-xs text-u-muted">
                  Priority
                  <select
                    value={strategy}
                    onChange={(e) => setStrategy(e.target.value as AllocationStrategy)}
                    aria-label="Allocation priority"
                    className="h-8 rounded-md border border-u-line bg-u-card px-2 text-xs font-medium text-u-ink2 focus:border-u-accent focus:outline-none focus:ring-2 focus:ring-u-accent/25"
                  >
                    <option value="oldest">Oldest first</option>
                    <option value="newest">Newest first</option>
                  </select>
                </label>
                <Button size="sm" variant="secondary" onClick={() => autoAllocate()} disabled={selectedIds.length === 0}>
                  <Icon name="sort" className="h-3.5 w-3.5" />
                  Auto allocate
                </Button>
                <Button size="sm" variant="secondary" onClick={selectAllAndAuto} disabled={eligible.length === 0}>
                  <Icon name="check" className="h-3.5 w-3.5" />
                  Select all + auto
                </Button>
              </div>
            </div>

            {creditAvailable > 0 && (
              <label className={cn("flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 text-[13px] transition-colors", useCredit ? "border-u-blue/60 bg-u-blue-soft ring-1 ring-u-blue/30" : "border-u-line bg-u-card hover:border-u-line2")}>
                <input type="checkbox" className="mt-0.5 h-4 w-4 accent-u-accent" checked={useCredit} onChange={(e) => setUseCredit(e.target.checked)} />
                <span>
                  <span className="font-semibold text-u-ink">Apply tenant credit — {fmtCAD(creditAvailable)} available.</span>
                  <span className="block text-xs text-u-muted">
                    Credit can cover amounts beyond the cash received. Unused credit stays on the tenant's account.
                  </span>
                </span>
              </label>
            )}

            {eligible.length === 0 ? (
              <div className="flex items-center gap-2 rounded-lg border border-u-accent/30 bg-u-accent-soft px-4 py-4 text-[13px] text-u-accent">
                <Icon name="check" className="h-4 w-4 text-u-accent" />
                All invoices on this lease are paid in full (or cancelled). Nothing to collect.
              </div>
            ) : (
              <PaymentAllocationTable
                invoices={eligible}
                balances={balances}
                selectedIds={selectedIds}
                onToggle={toggleInvoice}
                onToggleAll={toggleAll}
                applyAmounts={applyAmounts}
                onApplyAmount={setApply}
              />
            )}

            {/* Totals */}
            <div className="grid grid-cols-2 gap-2.5 rounded-lg border border-u-line bg-u-s2/60 p-4 sm:grid-cols-5">
              {[
                ["Payment received", fmtCAD(totals.received), "text-u-ink"],
                ["Total allocated", fmtCAD(totals.allocated), "text-u-accent"],
                ["Unallocated", fmtCAD(totals.unallocated), totals.unallocated > 0 ? "text-u-warn" : "text-u-muted"],
                ["Selected balance before", fmtCAD(totals.before), "text-u-ink2"],
                ["Balance after payment", fmtCAD(after), "text-u-ink"],
              ].map(([label, value, cls]) => (
                <div key={label}>
                  <p className="text-[10px] font-semibold tracking-wide text-u-muted uppercase">{label}</p>
                  <p className={cn("mt-1 font-display text-[15px] font-semibold tabular-nums", cls)}>{value}</p>
                </div>
              ))}
            </div>
            {useCredit && totals.creditUsed > 0 && (
              <p className="flex items-center gap-2 rounded-lg border border-u-blue/30 bg-u-blue-soft px-3.5 py-2.5 text-[13px] text-u-blue">
                <Icon name="banknote" className="h-4 w-4 text-u-blue" />
                {fmtCAD(totals.creditUsed)} of the allocation will be funded from the tenant's existing credit.
              </p>
            )}
            {attemptedStep >= 1 && validation.errors.allocation && (
              <p className="flex items-center gap-2 rounded-lg border border-u-danger/30 bg-u-danger-soft px-3.5 py-2.5 text-[13px] font-medium text-u-danger" role="alert">
                <Icon name="alert" className="h-4 w-4 text-u-danger" />
                {validation.errors.allocation}
              </p>
            )}

            {/* Overpayment handling */}
            {validation.overpayment && (
              <div className={cn("rounded-lg border px-4 py-3.5 text-[13px]", attemptedStep >= 1 && overpayChoice !== "credit" ? "border-u-danger/55 bg-u-danger-soft text-u-danger" : "border-u-warn/55 bg-u-warn-soft text-u-warn")} role={attemptedStep >= 1 && overpayChoice !== "credit" ? "alert" : undefined}>
                <p className="flex items-center gap-2 font-semibold">
                  <Icon name="alert" className={cn("h-4 w-4", attemptedStep >= 1 && overpayChoice !== "credit" ? "text-u-danger" : "text-u-warn")} />
                  Excess funds: {fmtCAD(totals.unallocated)} received but not allocated.
                </p>
                <div className="mt-2.5 space-y-1.5">
                  <label className="flex cursor-pointer items-start gap-2">
                    <input type="radio" name="pf-overpay" className="mt-0.5 h-3.5 w-3.5 accent-u-accent" checked={overpayChoice === "credit"} onChange={() => setOverpayChoice("credit")} />
                    <span>Retain <span className="font-semibold">{fmtCAD(totals.unallocated)}</span> as unapplied tenant credit (kept separately, applicable to a future charge).</span>
                  </label>
                  <label className="flex cursor-pointer items-start gap-2">
                    <input type="radio" name="pf-overpay" className="mt-0.5 h-3.5 w-3.5 accent-u-accent" checked={overpayChoice === "back"} onChange={() => setOverpayChoice("back")} />
                    <span>Allocate it to another eligible invoice instead (stay on this step and adjust).</span>
                  </label>
                </div>
                {attemptedStep >= 1 && overpayChoice !== "credit" && (
                  <p className="mt-2 font-medium text-u-danger">{validation.errors.overpay ?? "Choose how to handle the excess before posting."}</p>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-u-line bg-u-s2/50 px-6 py-4">
            <Button variant="ghost" onClick={() => setStep(0)}>
              <Icon name="chevron-left" className="h-4 w-4" />
              Back
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={onCancel}>Cancel</Button>
              <Button variant="primary" onClick={goReview}>
                Review payment
                <Icon name="chevron-right" className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}

      {/* STEP 3 — confirm & post */}
      {step === 2 && (
        <>
          <div className="grid grid-cols-1 gap-6 px-6 py-5 lg:grid-cols-2">
            <div>
              <h3 className="text-[11px] font-semibold tracking-wide text-u-muted uppercase">Payment summary</h3>
              <dl className="mt-3 space-y-2.5 text-sm">
                {[
                  ["Tenant", `${tenant?.name ?? "—"} (${tenant?.number ?? ""})`],
                  ["Lease", lease?.id ?? "—"],
                  ["Property / Unit", property && unit ? `${property.name} — ${unit.number}` : "—"],
                  ["Payment date", formatDate(date)],
                  ["Method", METHOD_LABELS[method]],
                  ["Reference", reference.trim() || "—"],
                  ["Amount received", fmtCAD(totals.received)],
                  ["Total allocated", fmtCAD(totals.allocated)],
                  ["Unallocated → tenant credit", overpayChoice === "credit" ? fmtCAD(totals.unallocated) : "$0.00"],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-baseline justify-between gap-4 border-b border-dashed border-u-line pb-2">
                    <dt className="text-u-muted">{k}</dt>
                    <dd className={cn("text-right font-medium text-u-ink", String(k).startsWith("Amount") && "font-display text-base font-semibold tabular-nums")}>{v}</dd>
                  </div>
                ))}
              </dl>
              {notes.trim() && (
                <p className="mt-3 rounded-lg bg-u-s2 px-3 py-2 text-xs text-u-ink2">
                  <span className="font-semibold">Notes:</span> {notes.trim()}
                </p>
              )}
            </div>

            <div>
              <h3 className="text-[11px] font-semibold tracking-wide text-u-muted uppercase">Allocation & resulting balances</h3>
              <div className="mt-3 overflow-hidden rounded-lg border border-u-line">
                <table className="w-full text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-u-line bg-u-s2/70 text-[11px] tracking-wide text-u-muted uppercase">
                      <th className="px-3 py-2 font-semibold">Invoice</th>
                      <th className="px-3 py-2 font-semibold">Period</th>
                      <th className="px-3 py-2 text-right font-semibold">Applied</th>
                      <th className="px-3 py-2 text-right font-semibold">Left owing</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-u-line">
                    {validation.rowsCents
                      .filter((r) => r.amount > 0 && selectedIds.includes(r.invoiceId))
                      .map((r) => {
                        const inv = invById.get(r.invoiceId);
                        const before = balances.get(r.invoiceId)?.outstanding ?? 0;
                        return (
                          <tr key={r.invoiceId}>
                            <td className="px-3 py-2 font-mono text-xs text-u-ink">{r.invoiceId}</td>
                            <td className="px-3 py-2 text-u-ink2">{inv ? periodLabel(inv.periodStart, inv.periodEnd) : "—"}</td>
                            <td className="px-3 py-2 text-right font-medium text-u-accent tabular-nums">{fmtCAD(r.amount)}</td>
                            <td className="px-3 py-2 text-right text-u-ink2 tabular-nums">{fmtCAD(Math.max(0, before - r.amount))}</td>
                          </tr>
                        );
                      })}
                    {useCredit && totals.creditUsed > 0 && (
                      <tr className="bg-u-blue-soft/70">
                        <td className="px-3 py-2 font-medium text-u-blue" colSpan={2}>Funded from tenant credit</td>
                        <td className="px-3 py-2 text-right font-medium text-u-blue tabular-nums">{fmtCAD(totals.creditUsed)}</td>
                        <td className="px-3 py-2" />
                      </tr>
                    )}
                    {overpayChoice === "credit" && totals.unallocated > 0 && (
                      <tr className="bg-u-warn-soft/70">
                        <td className="px-3 py-2 font-medium text-u-warn" colSpan={2}>New unapplied tenant credit</td>
                        <td className="px-3 py-2 text-right font-medium text-u-warn tabular-nums">{fmtCAD(totals.unallocated)}</td>
                        <td className="px-3 py-2" />
                      </tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-u-line bg-u-card">
                      <td className="px-3 py-2.5 font-display font-semibold text-u-ink" colSpan={2}>Total posted</td>
                      <td className="px-3 py-2.5 text-right font-display font-semibold text-u-ink tabular-nums">{fmtCAD(totals.received)}</td>
                      <td className="px-3 py-2.5" />
                    </tr>
                  </tfoot>
                </table>
              </div>
              {validation.warnings.map((w) => (
                <p key={w} className="mt-3 flex items-start gap-2 rounded-lg border border-u-warn/55 bg-u-warn-soft px-3 py-2.5 text-xs text-u-warn">
                  <Icon name="alert" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-u-warn" />
                  {w}
                </p>
              ))}
              {refWarning && (
                <p className="mt-2 flex items-start gap-2 rounded-lg border border-u-warn/55 bg-u-warn-soft px-3 py-2.5 text-xs text-u-warn">
                  <Icon name="alert" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-u-warn" />
                  {refWarning}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-3 border-t border-u-line bg-u-s2/50 px-6 py-4">
            <label className="flex cursor-pointer items-start gap-2.5 text-[13px] text-u-ink2">
              <input type="checkbox" className="mt-0.5 h-4 w-4 accent-u-accent" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
              <span>
                I confirm this transaction is correct: <span className="font-semibold">{fmtCAD(totals.received)}</span> received from{" "}
                <span className="font-semibold">{tenant?.name}</span>, allocated as shown. One payment record and one receipt will be created.
              </span>
            </label>
            <div className="flex items-center justify-between gap-3">
              <Button variant="ghost" onClick={() => setStep(1)}>
                <Icon name="chevron-left" className="h-4 w-4" />
                Back
              </Button>
              <div className="flex items-center gap-2">
                <Button variant="ghost" onClick={onCancel}>Cancel</Button>
                <Button variant="primary" onClick={post} disabled={!confirmed || posting} className="min-w-48">
                  {posting ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-u-accent/30 border-t-transparent" aria-hidden="true" />
                      Posting…
                    </>
                  ) : (
                    <>
                      <Icon name="check" className="h-4 w-4" />
                      Post {fmtCAD(totals.received)} payment
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </Modal>
  );
}
