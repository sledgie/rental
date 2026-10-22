import Link from "../../../shim/link";
import { db } from "../../../db";
import * as schema from "../../../db/schema";
import { PageHeader, Card, Badge, Callout, EmptyState } from "../../../components/ui";
import { loadDepositModule } from "../../../lib/deposits/service";
import { getCurrentUser } from "../../../lib/session";
import {
  DEPOSIT_TYPE_LABELS,
  JURISDICTIONS,
  LEASE_TYPES,
  LIABILITY_ACCOUNT_BY_TYPE,
  PERMISSIONS,
  ROLES,
  ROLE_PERMISSIONS,
  can,
  depositTypeLabel,
  type DepositType,
  type Permission,
} from "../../../lib/deposits/domain";
import { formatCurrency } from "../../../lib/money";
import { formatDate } from "../../../lib/dates";
import { AccountMappingForm, RateDialog, RuleDialog } from "../../../components/config-forms";

export const dynamic = "force-dynamic";
export const metadata = { title: "Deposit configuration" };

export default async function ConfigurationPage() {
  const data = await loadDepositModule();
  const user = await getCurrentUser();
  const canConfigureRules = can(user.role, "configure_rules");
  const canConfigureAccounts = can(user.role, "configure_accounts");
  const meta = await db.select().from(schema.appMeta);
  let mappings: Record<string, { liability: string; cash: string; receivable: string }> = {};
  try {
    const raw = meta.find((m) => m.key === "deposit_account_mappings")?.value;
    if (raw) mappings = JSON.parse(raw) as typeof mappings;
  } catch {
    mappings = {};
  }
  const effectiveMappings = Object.fromEntries(
    Object.entries(LIABILITY_ACCOUNT_BY_TYPE).map(([type, account]) => [
      type,
      mappings[type] ?? { liability: account, cash: "1020", receivable: "1200" },
    ]),
  ) as Record<string, { liability: string; cash: string; receivable: string }>;

  const rules = [...data.rules].sort((a, b) =>
    `${a.jurisdiction}${a.leaseType}${a.depositType}${a.effectiveFrom}` < `${b.jurisdiction}${b.leaseType}${b.depositType}${b.effectiveFrom}` ? 1 : -1,
  );

  return (
    <div className="stack" style={{ gap: 14 }}>
      <PageHeader
        breadcrumb={[{ label: "Deposits", href: "/deposits" }, { label: "Configuration" }]}
        title="Deposit configuration"
        description="Effective-dated deposit rules, interest rate history, account mappings and role-based approvals. Rules are never hardcoded universally — every jurisdiction and lease type is configured explicitly."
        meta={<><span>{rules.length} rule versions</span><span>·</span><span>{data.rateHistory.length} rate versions</span><span>·</span><span>Signed in as {user.name} ({user.role})</span></>}
        actions={<Link href="/deposits/reports?report=audit" className="btn btn-sm">View configuration audit</Link>}
      />

      {!canConfigureRules && (
        <Callout tone="warning" title="Read-only configuration">
          Your role can view but not change deposit rules or rates. An Administrator can configure these; changes are effective-dated and audited.
        </Callout>
      )}

      <Card
        title="Deposit rules by jurisdiction and lease type"
        subtitle="The current effective version is shown per combination. Creating a new version closes the previous version the day before the new effective date, preserving historical evaluation."
        padded={false}
      >
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Jurisdiction</th><th>Lease type</th><th>Deposit type</th><th>Permitted</th><th>Maximum / method</th>
                <th>Interest</th><th>Applications</th><th>Approvals</th><th>Effective</th><th>Legal reference</th><th>Action</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => {
                const current = !rule.effectiveTo || rule.effectiveTo >= data.today;
                return (
                  <tr key={rule.id} style={{ opacity: current ? 1 : 0.65 }}>
                    <td className="strong">{JURISDICTIONS.find((j) => j.code === rule.jurisdiction)?.label ?? rule.jurisdiction}</td>
                    <td className="small">{rule.leaseType}</td>
                    <td className="small">{DEPOSIT_TYPE_LABELS[rule.depositType as DepositType] ?? rule.depositType}</td>
                    <td>{rule.collectionPermitted ? <Badge tone="success" dot>Permitted</Badge> : <Badge tone="danger" dot>Prohibited</Badge>}</td>
                    <td className="small">
                      {rule.maxMultipleOfRentBps ? `${(rule.maxMultipleOfRentBps / 100).toFixed(2)}× monthly rent` : rule.calculationMethod === "replacement_cost" ? "Documented replacement cost" : rule.maxAmountCents != null ? formatCurrency(rule.maxAmountCents) : "No fixed maximum"}
                    </td>
                    <td className="small">{rule.interestApplicable ? `${rule.interestFrequency} · ${rule.interestMethod}` : "None"}</td>
                    <td className="small" style={{ maxWidth: 190 }}>{rule.applicationPurposes.length ? rule.applicationPurposes.join(", ").replaceAll("_", " ") : "—"}</td>
                    <td className="small">
                      {rule.approvalRequired ? <Badge tone="warning">Apply</Badge> : null}
                      {rule.refundApprovalRequired ? <div><Badge tone="warning">Refund</Badge></div> : null}
                      {!rule.approvalRequired && !rule.refundApprovalRequired ? "—" : null}
                    </td>
                    <td className="small nowrap">{formatDate(rule.effectiveFrom)}{rule.effectiveTo ? <div className="muted">to {formatDate(rule.effectiveTo)}</div> : <div className="muted">current</div>}</td>
                    <td className="small" style={{ maxWidth: 220 }}>{rule.legalReference}</td>
                    <td>
                      <RuleDialog
                        canConfigure={canConfigureRules}
                        rule={{
                          id: rule.id,
                          jurisdiction: rule.jurisdiction,
                          leaseType: rule.leaseType,
                          depositType: rule.depositType,
                          collectionPermitted: rule.collectionPermitted,
                          maxAmountCents: rule.maxAmountCents,
                          maxMultipleOfRentBps: rule.maxMultipleOfRentBps,
                          calculationMethod: rule.calculationMethod,
                          refundConditions: rule.refundConditions,
                          interestApplicable: rule.interestApplicable,
                          interestFrequency: rule.interestFrequency,
                          applicationPurposes: rule.applicationPurposes,
                          requiredDocuments: rule.requiredDocuments,
                          approvalRequired: rule.approvalRequired,
                          refundApprovalRequired: rule.refundApprovalRequired,
                          effectiveFrom: rule.effectiveFrom,
                          validationMessage: rule.validationMessage,
                          legalReference: rule.legalReference,
                          notes: rule.notes,
                        }}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid-2">
        <Card
          title="Interest rate history"
          subtitle="Effective-dated annual rates. The engine splits accruals at rate changes; opening a report never posts interest."
          padded={false}
          actions={<RateDialog canConfigure={canConfigureRules} defaultJurisdiction="ON" />}
        >
          {data.rateHistory.length === 0 ? (
            <EmptyState title="No interest rates configured" description="Interest cannot be calculated until a rate history exists for the jurisdiction and deposit type." />
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead><tr><th>Jurisdiction</th><th>Lease type</th><th>Deposit type</th><th className="num">Annual rate</th><th>Effective</th><th>Source</th></tr></thead>
                <tbody>
                  {[...data.rateHistory]
                    .sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? 1 : -1))
                    .map((rate) => (
                      <tr key={rate.id}>
                        <td className="strong">{rate.jurisdiction}</td>
                        <td className="small">{rate.leaseType}</td>
                        <td className="small">{depositTypeLabel(rate.depositType)}</td>
                        <td className="num">{(rate.annualRateBps / 100).toFixed(2)}%</td>
                        <td className="small nowrap">{formatDate(rate.effectiveFrom)}<div className="muted">{rate.effectiveTo ? `to ${formatDate(rate.effectiveTo)}` : "current"}</div></td>
                        <td className="small">{rate.source}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title="Approval and permission requirements" subtitle="Sensitive operations require specific permissions; refunds and commercial applications may require separate approval.">
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>Operation</th><th>Required permission</th><th>Approval</th></tr></thead>
              <tbody>
                <tr><td>Record collection</td><td className="small mono">record_collection</td><td className="small">No</td></tr>
                <tr><td>Apply deposit</td><td className="small mono">apply_deposit</td><td className="small">Per rule (approval reference)</td></tr>
                <tr><td>Request refund</td><td className="small mono">request_refund</td><td className="small">Per rule</td></tr>
                <tr><td>Approve refund</td><td className="small mono">approve_refund</td><td className="small">Second user required</td></tr>
                <tr><td>Process refund payment</td><td className="small mono">process_refund</td><td className="small">Refund must be approved</td></tr>
                <tr><td>Post interest</td><td className="small mono">process_interest</td><td className="small">Preview &amp; explicit confirmation</td></tr>
                <tr><td>Configure rules / rates</td><td className="small mono">configure_rules</td><td className="small">Effective-dated versioning</td></tr>
                <tr><td>Reconcile / reverse</td><td className="small mono">reconcile_deposits</td><td className="small">Reason mandatory, no auto-adjust</td></tr>
              </tbody>
            </table>
          </div>
          <div className="divider" />
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>Role</th>{["view_deposits", "record_collection", "apply_deposit", "approve_refund", "process_refund", "configure_rules", "reconcile_deposits"].map((p) => <th key={p} style={{ fontSize: 9.5 }}>{p.replaceAll("_", " ")}</th>)}</tr></thead>
              <tbody>
                {ROLES.map((role) => (
                  <tr key={role.code}>
                    <td className="small strong">{role.label}</td>
                    {(["view_deposits", "record_collection", "apply_deposit", "approve_refund", "process_refund", "configure_rules", "reconcile_deposits"] as Permission[]).map((permission) => (
                      <td key={permission} className="small">{ROLE_PERMISSIONS[role.code].includes(permission) ? <span title="Allowed" style={{ color: "var(--dp-success)" }}>✓</span> : <span title="Not allowed" className="muted">—</span>}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="hint" style={{ marginBottom: 0 }}>{PERMISSIONS.length} granular permissions are enforced in the server actions, not just hidden in the interface.</p>
        </Card>
      </div>

      <Card
        title="Deposit account mapping"
        subtitle="Maps each deposit category to a liability account, bank/trust account and receivable account. Mappings must exist before a posting is allowed."
      >
        <AccountMappingForm
          accounts={data.lookups.accounts.map((a) => ({ code: a.code, name: a.name, type: a.type }))}
          mappings={effectiveMappings}
          canConfigure={canConfigureAccounts}
        />
        <div className="divider" />
        <Callout tone="info" title="Chart of accounts integration">
          Existing accounts are reused — the module never creates duplicate accounts. Collection posts Debit bank / Credit deposit liability;
          refunds reverse it; applications relieve the linked receivable. Interest accrues to 2310 via expense 6100.
        </Callout>
      </Card>

      <Card title="Jurisdiction notes" subtitle="Rules are not assumed to be universal.">
        <ul className="small" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
          <li><strong>Ontario residential:</strong> last month&apos;s rent and refundable key deposits are supported. Damage, pet and utility deposits are prohibited and blocked. Last month&apos;s rent interest follows the annual guideline; key retention is limited to documented replacement cost.</li>
          <li><strong>British Columbia residential:</strong> security deposits are permitted up to half a month&apos;s rent with statutory interest; last month&apos;s rent deposits are not recognised.</li>
          <li><strong>Alberta / Ontario commercial:</strong> security and utility deposits are negotiated, with approval-gated applications for documented damage, arrears and utilities.</li>
          <li><strong>Unknown jurisdictions:</strong> no default rule exists. The workflow warns and blocks collection until an authorized user configures the rule.</li>
        </ul>
      </Card>
    </div>
  );
}
