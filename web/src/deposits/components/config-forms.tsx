import { useActionState, formProps } from "../shim/react";
import {
  saveAccountMappingsAction,
  saveDepositRuleAction,
  saveInterestRateAction,
  type ActionState,
} from "../lib/deposits/actions";
import {
  APPLICATION_PURPOSES,
  DEPOSIT_TYPE_LABELS,
  DEPOSIT_TYPES,
  JURISDICTIONS,
  LEASE_TYPES,
  PURPOSE_LABELS,
  type DepositType,
} from "../lib/deposits/domain";
import { ActionDialog, Field } from "./deposit-actions";
import { Callout } from "./ui";
import { todayISO } from "../lib/dates";

const initial: ActionState = { ok: false, message: "", errors: [], warnings: [] };

export type RuleFormValue = {
  id: string;
  jurisdiction: string;
  leaseType: string;
  depositType: string;
  collectionPermitted: boolean;
  maxAmountCents: number | null;
  maxMultipleOfRentBps: number | null;
  calculationMethod: string;
  refundConditions: string;
  interestApplicable: boolean;
  interestFrequency: string;
  applicationPurposes: string[];
  requiredDocuments: string[];
  approvalRequired: boolean;
  refundApprovalRequired: boolean;
  effectiveFrom: string;
  validationMessage: string;
  legalReference: string;
  notes: string | null;
};

export function RuleDialog({ rule, canConfigure }: { rule: RuleFormValue; canConfigure: boolean }) {
  return (
    <ActionDialog
      label="New version"
      title={`Configure ${DEPOSIT_TYPE_LABELS[rule.depositType as DepositType] ?? rule.depositType}`}
      description={`${rule.jurisdiction} · ${rule.leaseType} · current version effective ${rule.effectiveFrom}. Saving creates a new effective-dated version and closes the previous version the day before — history is never overwritten.`}
      action={saveDepositRuleAction}
      submitLabel="Save rule version"
      tone="primary"
      size="md"
      disabledReason={!canConfigure ? "Your role cannot configure deposit rules." : null}
    >
      <div className="grid-2-even" style={{ gap: 10 }}>
        <Field label="Jurisdiction">
          <select className="select" name="jurisdiction" defaultValue={rule.jurisdiction}>
            {JURISDICTIONS.map((j) => <option key={j.code} value={j.code}>{j.label}</option>)}
          </select>
        </Field>
        <Field label="Lease type">
          <select className="select" name="leaseType" defaultValue={rule.leaseType}>
            {LEASE_TYPES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
          </select>
        </Field>
        <Field label="Deposit type">
          <select className="select" name="depositType" defaultValue={rule.depositType}>
            {DEPOSIT_TYPES.map((t) => <option key={t} value={t}>{DEPOSIT_TYPE_LABELS[t]}</option>)}
          </select>
        </Field>
        <Field label="Effective from" hint="Must be after the current version start date.">
          <input className="input" type="date" name="effectiveFrom" defaultValue={todayISO()} required />
        </Field>
        <Field label="Calculation method">
          <select className="select" name="calculationMethod" defaultValue={rule.calculationMethod}>
            <option value="fixed">Fixed maximum amount</option>
            <option value="rent_multiple">Multiple of monthly rent</option>
            <option value="replacement_cost">Documented replacement cost</option>
          </select>
        </Field>
        <Field label="Maximum amount (CAD)">
          <input className="input" name="maxAmount" inputMode="decimal" defaultValue={rule.maxAmountCents != null ? (rule.maxAmountCents / 100).toFixed(2) : ""} placeholder="e.g. 2000.00" />
        </Field>
        <Field label="Maximum as % of one month's rent" hint="100 = one month, 50 = half a month.">
          <input className="input" name="maxMultipleOfRent" type="number" min={0} max={1000} defaultValue={rule.maxMultipleOfRentBps != null ? rule.maxMultipleOfRentBps / 100 : ""} />
        </Field>
        <Field label="Interest frequency">
          <select className="select" name="interestFrequency" defaultValue={rule.interestFrequency}>
            <option value="none">None</option>
            <option value="annual">Annual</option>
            <option value="monthly">Monthly</option>
          </select>
        </Field>
        <Field label="Rounding rule">
          <select className="select" name="roundingMode" defaultValue="half_up_cent">
            <option value="half_up_cent">Half-up to the cent</option>
            <option value="down_cent">Round down to the cent</option>
          </select>
        </Field>
      </div>
      <Field label="Legal / policy reference">
        <input className="input" name="legalReference" defaultValue={rule.legalReference} required />
      </Field>
      <Field label="Refund conditions">
        <textarea className="textarea" name="refundConditions" defaultValue={rule.refundConditions} required />
      </Field>
      <Field label="Validation message shown when blocked">
        <textarea className="textarea" name="validationMessage" defaultValue={rule.validationMessage} required />
      </Field>
      <Field label="Permitted application purposes">
        <div className="grid-2-even" style={{ gap: 6 }}>
          {APPLICATION_PURPOSES.map((purpose) => (
            <label className="checkline" key={purpose}>
              <input type="checkbox" name="purposes" value={purpose} defaultChecked={rule.applicationPurposes.includes(purpose)} />
              <span>{PURPOSE_LABELS[purpose]}</span>
            </label>
          ))}
        </div>
      </Field>
      <Field label="Required documents (comma separated)">
        <input className="input" name="requiredDocuments" defaultValue={rule.requiredDocuments.join(", ")} />
      </Field>
      <div className="grid-2-even" style={{ gap: 6 }}>
        <label className="checkline"><input type="checkbox" name="collectionPermitted" defaultChecked={rule.collectionPermitted} /><span>Collection permitted</span></label>
        <label className="checkline"><input type="checkbox" name="interestApplicable" defaultChecked={rule.interestApplicable} /><span>Interest applies</span></label>
        <label className="checkline"><input type="checkbox" name="approvalRequired" defaultChecked={rule.approvalRequired} /><span>Application requires approval</span></label>
        <label className="checkline"><input type="checkbox" name="refundApprovalRequired" defaultChecked={rule.refundApprovalRequired} /><span>Refund requires approval</span></label>
      </div>
      <Field label="Configuration notes">
        <textarea className="textarea" name="notes" defaultValue={rule.notes ?? ""} />
      </Field>
    </ActionDialog>
  );
}

export function RateDialog({
  canConfigure,
  defaultJurisdiction,
}: {
  canConfigure: boolean;
  defaultJurisdiction: string;
}) {
  return (
    <ActionDialog
      label="Add rate version"
      title="New effective-dated interest rate"
      description="Rate history cannot be overwritten. A new rate closes the previous open-ended rate the day before it becomes effective."
      action={saveInterestRateAction}
      submitLabel="Save rate"
      tone="primary"
      size="md"
      disabledReason={!canConfigure ? "Your role cannot configure interest rates." : null}
    >
      <div className="grid-2-even" style={{ gap: 10 }}>
        <Field label="Jurisdiction">
          <select className="select" name="jurisdiction" defaultValue={defaultJurisdiction}>
            {JURISDICTIONS.map((j) => <option key={j.code} value={j.code}>{j.label}</option>)}
          </select>
        </Field>
        <Field label="Lease type">
          <select className="select" name="leaseType" defaultValue="residential">
            {LEASE_TYPES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
          </select>
        </Field>
        <Field label="Deposit type">
          <select className="select" name="depositType" defaultValue="last_month_rent">
            {DEPOSIT_TYPES.map((t) => <option key={t} value={t}>{DEPOSIT_TYPE_LABELS[t]}</option>)}
          </select>
        </Field>
        <Field label="Effective from">
          <input className="input" type="date" name="effectiveFrom" defaultValue={todayISO()} required />
        </Field>
        <Field label="Annual rate (%)" hint="Applied with actual/365 simple interest.">
          <input className="input" name="annualRate" inputMode="decimal" placeholder="2.10" required />
        </Field>
      </div>
      <Field label="Statutory / policy source" hint="Recorded on the rate and shown in calculation details.">
        <input className="input" name="source" placeholder="e.g. Ontario rent increase guideline 2026 (2.10%)" required />
      </Field>
      <Field label="Notes">
        <textarea className="textarea" name="notes" />
      </Field>
    </ActionDialog>
  );
}

export function AccountMappingForm({
  accounts,
  mappings,
  canConfigure,
}: {
  accounts: { code: string; name: string; type: string }[];
  mappings: Record<string, { liability: string; cash: string; receivable: string }>;
  canConfigure: boolean;
}) {
  const [state, formAction, pending] = useActionState(saveAccountMappingsAction, initial);
  return (
    <form {...formProps(formAction)} className="stack" style={{ gap: 12 }}>
      {state.ok && <Callout tone="success" title="Mappings saved">{state.message}</Callout>}
      {state.errors.length > 0 && (
        <Callout tone="danger" title="Mappings not saved">
          <ul style={{ margin: "4px 0 0 16px", padding: 0 }}>{state.errors.map((e) => <li key={e}>{e}</li>)}</ul>
        </Callout>
      )}
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Deposit type</th>
              <th>Liability account</th>
            </tr>
          </thead>
          <tbody>
            {DEPOSIT_TYPES.map((type) => (
              <tr key={type}>
                <td className="strong">{DEPOSIT_TYPE_LABELS[type]}</td>
                <td>
                  <select className="select" name={`liability_${type}`} defaultValue={mappings[type]?.liability ?? "2240"} disabled={!canConfigure}>
                    {accounts.filter((a) => a.type === "liability").map((a) => (
                      <option key={a.code} value={a.code}>{a.code} · {a.name}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="form-grid">
        <Field label="Bank / trust account">
          <select className="select" name="cashAccount" defaultValue={mappings.last_month_rent?.cash ?? "1020"} disabled={!canConfigure}>
            {accounts.filter((a) => a.type === "asset").map((a) => (
              <option key={a.code} value={a.code}>{a.code} · {a.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Receivable account for applications">
          <select className="select" name="receivableAccount" defaultValue={mappings.last_month_rent?.receivable ?? "1200"} disabled={!canConfigure}>
            {accounts.filter((a) => a.type === "asset").map((a) => (
              <option key={a.code} value={a.code}>{a.code} · {a.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Change reason">
          <input className="input" name="reason" placeholder="Recorded in the audit trail" />
        </Field>
      </div>
      <div className="btn-row" style={{ justifyContent: "flex-end" }}>
        <button type="submit" className="btn btn-primary" disabled={!canConfigure || pending}>{pending ? "Saving…" : "Save mappings"}</button>
      </div>
    </form>
  );
}
