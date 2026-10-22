import { useState } from "react";
import { useActionState, formProps } from "../shim/react";
import Link from "../shim/link";
import { createDepositAction, type ActionState } from "../lib/deposits/actions";
import { DEPOSIT_TYPE_LABELS, DEPOSIT_TYPES, LIABILITY_ACCOUNT_BY_TYPE, type DepositType } from "../lib/deposits/domain";
import { getApplicableRule, ruleMaxAmountCents, type RuleLike } from "../lib/deposits/engine";
import { formatCurrency, rentMultipleCents } from "../lib/money";
import { formatDate, todayISO } from "../lib/dates";
import { Callout } from "./ui";
import { Field as FormField } from "./deposit-actions";

export type LeaseOption = {
  id: string;
  reference: string;
  tenantName: string;
  tenantId: string;
  propertyName: string;
  building: string;
  unitLabel: string;
  leaseType: string;
  jurisdiction: string;
  monthlyRentCents: number;
  startDate: string;
  endDate: string;
  status: string;
};

const initial: ActionState = { ok: false, message: "", errors: [], warnings: [] };

export function NewDepositForm({
  leases,
  accounts,
  staff,
  rules,
  today,
}: {
  leases: LeaseOption[];
  accounts: { code: string; name: string; type: string }[];
  staff: { id: string; name: string; title: string }[];
  rules: RuleLike[];
  today: string;
}) {
  const [state, formAction, pending] = useActionState(createDepositAction, initial);
  const [leaseId, setLeaseId] = useState(leases[0]?.id ?? "");
  const [depositType, setDepositType] = useState<DepositType>("last_month_rent");
  const [expectedDate, setExpectedDate] = useState(today);
  const [amount, setAmount] = useState("");
  const lease = leases.find((l) => l.id === leaseId);
  const rule = lease
    ? getApplicableRule(rules, { jurisdiction: lease.jurisdiction, leaseType: lease.leaseType, depositType, asOf: expectedDate })
    : null;
  const maxCents = ruleMaxAmountCents(rule, lease?.monthlyRentCents ?? null, depositType === "key_fob" ? 15000 : null);
  const oneMonth = lease ? rentMultipleCents(lease.monthlyRentCents, 10_000) : 0;
  const amountNum = Number(amount.replace(/[^0-9.]/g, "")) * 100;
  const overLimit = Boolean(rule && maxCents != null && amountNum > maxCents);

  return (
    <form {...formProps(formAction)} className="stack" style={{ gap: 14 }}>
      {state.ok && (
        <Callout tone="success" title="Deposit record created">
          {state.message}{" "}
          <Link href="/deposits/register" className="strong" style={{ textDecoration: "underline" }}>Open the register</Link> to record a collection.
        </Callout>
      )}
      {state.errors.length > 0 && (
        <Callout tone="danger" title="Deposit could not be created">
          <ul style={{ margin: "4px 0 0 16px", padding: 0 }}>
            {state.errors.map((e) => <li key={e}>{e}</li>)}
          </ul>
        </Callout>
      )}
      {state.warnings.length > 0 && (
        <Callout tone="warning" title="Review required">
          <ul style={{ margin: "4px 0 0 16px", padding: 0 }}>
            {state.warnings.map((w) => <li key={w}>{w}</li>)}
          </ul>
        </Callout>
      )}

      <section className="card">
        <header className="card-head">
          <div>
            <h2 className="card-title">1 · Lease and deposit type</h2>
            <div className="card-sub">Tenant, property, building, unit and jurisdiction are inherited from the selected lease. Unrelated tenants cannot be attached.</div>
          </div>
        </header>
        <div className="card-body stack" style={{ gap: 12 }}>
          <div className="form-grid">
            <FormField label="Lease" hint="Only active or notice leases are listed.">
              <select className="select" name="leaseId" value={leaseId} onChange={(e) => setLeaseId(e.target.value)} required>
                <option value="">Select a lease…</option>
                {leases.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.reference} · {l.tenantName} · {l.propertyName} {l.unitLabel} · {l.jurisdiction} {l.leaseType}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Deposit type">
              <select className="select" name="depositType" value={depositType} onChange={(e) => setDepositType(e.target.value as DepositType)}>
                {DEPOSIT_TYPES.map((type) => (
                  <option key={type} value={type}>{DEPOSIT_TYPE_LABELS[type]}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Expected collection date">
              <input className="input" type="date" name="expectedDate" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} required />
            </FormField>
            <FormField label="Responsible staff member">
              <select className="select" name="responsibleUserId" defaultValue={staff[0]?.id}>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} — {s.title}</option>
                ))}
              </select>
            </FormField>
          </div>

          {lease && (
            <div className="grid-4" style={{ background: "var(--dp-surface)", border: "1px solid var(--dp-line)", borderRadius: 10, padding: 12 }}>
              <div><div className="small muted">Tenant</div><div className="strong">{lease.tenantName}</div></div>
              <div><div className="small muted">Property / unit</div><div className="strong">{lease.propertyName} · {lease.unitLabel}</div><div className="small muted">{lease.building}</div></div>
              <div><div className="small muted">Lease term</div><div className="strong">{formatDate(lease.startDate)} → {formatDate(lease.endDate)}</div></div>
              <div><div className="small muted">Monthly rent</div><div className="strong tabular">{formatCurrency(lease.monthlyRentCents)}</div></div>
            </div>
          )}

          {lease && !rule && (
            <Callout tone="warning" title="No effective deposit rule">
              There is no {depositType} rule configured for {lease.jurisdiction} {lease.leaseType} effective {formatDate(expectedDate)}. Collection is blocked until an authorized user configures the rule.
            </Callout>
          )}
          {rule && !rule.collectionPermitted && (
            <Callout tone="danger" title="Collection is prohibited by the applicable rule">
              {rule.validationMessage} <span className="small">({rule.legalReference})</span>
            </Callout>
          )}
          {rule && rule.collectionPermitted && (
            <Callout tone="info" title="Applicable rule">
              {rule.legalReference} · effective {formatDate(rule.effectiveFrom)}{rule.effectiveTo ? ` to ${formatDate(rule.effectiveTo)}` : ""}. {" "}
              {maxCents != null ? `Permitted maximum ${formatCurrency(maxCents)}.` : "No fixed maximum in this rule version."}{" "}
              {rule.interestApplicable ? `Interest applies (${(rule.interestFrequency || "annual")} frequency).` : "No interest obligation configured."}
              {" "}Permitted applications: {rule.applicationPurposes.length ? rule.applicationPurposes.join(", ").replaceAll("_", " ") : "none"}.
            </Callout>
          )}
        </div>
      </section>

      <section className="card">
        <header className="card-head">
          <div>
            <h2 className="card-title">2 · Amount and accounting mapping</h2>
            <div className="card-sub">Create an expected record first; collection is a separate, confirmed step.</div>
          </div>
        </header>
        <div className="card-body stack" style={{ gap: 12 }}>
          <div className="form-grid">
            <FormField label="Required amount" hint={maxCents != null ? `Maximum ${formatCurrency(maxCents)} under the applicable rule.` : "Configured rule has no fixed maximum."}>
              <input className="input" name="requiredAmount" inputMode="decimal" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} required />
            </FormField>
            <FormField label="Deposit liability account">
              <select className="select" name="liabilityAccountCode" defaultValue={LIABILITY_ACCOUNT_BY_TYPE[depositType]}>
                {accounts.filter((a) => a.type === "liability").map((a) => (
                  <option key={a.code} value={a.code}>{a.code} · {a.name}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Bank / trust account">
              <select className="select" name="cashAccountCode" defaultValue="1020">
                {accounts.filter((a) => a.type === "asset").map((a) => (
                  <option key={a.code} value={a.code}>{a.code} · {a.name}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Receivable account for applications">
              <select className="select" name="receivableAccountCode" defaultValue="1200">
                {accounts.filter((a) => a.type === "asset").map((a) => (
                  <option key={a.code} value={a.code}>{a.code} · {a.name}</option>
                ))}
              </select>
            </FormField>
          </div>
          {depositType === "last_month_rent" && lease && (
            <div className="callout callout-neutral">
              Last month&apos;s rent is legally limited to one month&apos;s lawful rent ({formatCurrency(oneMonth)}). Over-collection must be handled through a documented adjustment.
            </div>
          )}
          {overLimit && <Callout tone="danger" title="Amount exceeds the permitted maximum">Reduce the amount or record an authorized configuration change. Collection will be blocked.</Callout>}
          {depositType === "key_fob" && (
            <div className="form-grid" style={{ borderTop: "1px solid var(--dp-line)", paddingTop: 12 }}>
              <FormField label="Device type">
                <select className="select" name="deviceType" defaultValue="key">
                  <option value="key">Key</option>
                  <option value="fob">Fob</option>
                  <option value="access_card">Access card</option>
                  <option value="garage_remote">Garage remote</option>
                </select>
              </FormField>
              <FormField label="Device identifier">
                <input className="input" name="deviceIdentifier" placeholder="e.g. KEY-1204-1" />
              </FormField>
              <FormField label="Quantity issued">
                <input className="input" type="number" min={1} name="deviceQuantity" defaultValue={1} />
              </FormField>
              <FormField label="Replacement cost per device" hint="Required basis for key deposit limits.">
                <input className="input" name="deviceReplacementCost" inputMode="decimal" placeholder="75.00" />
              </FormField>
            </div>
          )}
          <div className="form-grid">
            <FormField label="Supporting document name">
              <input className="input" name="documentName" placeholder="e.g. Signed lease agreement.pdf" />
            </FormField>
          </div>
          <FormField label="Notes">
            <textarea className="textarea" name="notes" placeholder="Internal notes — who requested the deposit, any conditions, special instructions." />
          </FormField>
        </div>
      </section>

      <div className="btn-row" style={{ justifyContent: "flex-end" }}>
        <button type="submit" name="intent" value="draft" className="btn" disabled={pending}>Save as draft</button>
        <button type="submit" name="intent" value="expected" className="btn btn-primary" disabled={pending}>
          {pending ? "Creating…" : "Create expected deposit"}
        </button>
      </div>
      <p className="hint" style={{ textAlign: "right", margin: 0 }}>
        No money moves and no accounting entry is posted when a deposit record is created.
      </p>
    </form>
  );
}

