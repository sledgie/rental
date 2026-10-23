import {
  Banknote,
  CalendarClock,
  FileText,
  Info,
  Landmark,
  Percent,
  ReceiptText,
  Wallet,
} from "lucide-react";
import { ACCOUNT_OPTIONS } from "../mockSettings";
import type { PageProps } from "../types";
import { Badge, Callout, Card, CardBody, CardHeader, Field, Input, RadioCards, Select, Textarea } from "../components/ui";

function AccountSelect({
  value,
  onChange,
  disabled,
  invalid,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  invalid?: boolean;
}) {
  return (
    <Select value={value} disabled={disabled} invalid={invalid} onChange={(event) => onChange(event.target.value)}>
      {ACCOUNT_OPTIONS.map((group) => (
        <optgroup key={group.group} label={group.group}>
          {group.options.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </optgroup>
      ))}
    </Select>
  );
}

export default function FinancialPage({ value, update, readOnly, errors }: PageProps) {
  const year = new Date().getFullYear();
  const nextNumber = String(value.nextInvoiceNumber || 0).padStart(4, "0");
  const invoicePreview = `${value.invoicePrefix}${year}-${nextNumber}`;

  return (
    <div className="space-y-5">
      <Callout tone="neutral" icon={Info} title="Financial defaults only">
        These values configure how new financial records are prepared. Nothing is posted to an accounting ledger, and no tax filing is processed in this prototype.
      </Callout>

      <Card id="accounts">
        <CardHeader
          icon={Landmark}
          title="Chart of accounts"
          description="Choose the default ledger mappings used when new charges, invoices and deposits are created."
          aside={<Badge tone="blue">Accounting</Badge>}
        />
        <CardBody className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Default chart of accounts" error={errors.chartOfAccounts} className="md:col-span-2">
              <Select value={value.chartOfAccounts} disabled={readOnly} onChange={(event) => update("chartOfAccounts", event.target.value)}>
                {["Standard property chart", "Simplified cash-basis chart", "Custom · Northstar schedules", "Trust accounting chart"].map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </Select>
            </Field>
            <Field label="Rental income account" required error={errors.incomeAccount}>
              <AccountSelect value={value.incomeAccount} disabled={readOnly} invalid={!!errors.incomeAccount} onChange={(next) => update("incomeAccount", next)} />
            </Field>
            <Field label="Operating expense account" required error={errors.operatingExpenseAccount}>
              <AccountSelect value={value.operatingExpenseAccount} disabled={readOnly} invalid={!!errors.operatingExpenseAccount} onChange={(next) => update("operatingExpenseAccount", next)} />
            </Field>
            <Field label="Repair & maintenance expense" required error={errors.repairExpenseAccount}>
              <AccountSelect value={value.repairExpenseAccount} disabled={readOnly} invalid={!!errors.repairExpenseAccount} onChange={(next) => update("repairExpenseAccount", next)} />
            </Field>
            <Field label="Security deposit liability" required error={errors.depositLiabilityAccount}>
              <AccountSelect value={value.depositLiabilityAccount} disabled={readOnly} invalid={!!errors.depositLiabilityAccount} onChange={(next) => update("depositLiabilityAccount", next)} />
            </Field>
            <Field label="Default bank & cash account" required error={errors.bankAccount} className="md:col-span-2">
              <AccountSelect value={value.bankAccount} disabled={readOnly} invalid={!!errors.bankAccount} onChange={(next) => update("bankAccount", next)} />
            </Field>
          </div>
          <Callout tone="success" icon={Banknote}>
            Chart of accounts is mapped for new transactions. Existing entries remain on their original accounts.
          </Callout>
        </CardBody>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[1.35fr_1fr]">
        <Card id="invoicing">
          <CardHeader icon={FileText} title="Invoicing & payment terms" description="Invoice numbering and due-date calculation for new invoices." />
          <CardBody className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Invoice prefix" required error={errors.invoicePrefix} hint="Letters, numbers and hyphens.">
                <Input value={value.invoicePrefix} disabled={readOnly} invalid={!!errors.invoicePrefix} maxLength={12} onChange={(event) => update("invoicePrefix", event.target.value.toUpperCase())} />
              </Field>
              <Field label="Next invoice number" required error={errors.nextInvoiceNumber}>
                <Input type="number" min={1} max={999999} value={value.nextInvoiceNumber} disabled={readOnly} invalid={!!errors.nextInvoiceNumber} onChange={(event) => update("nextInvoiceNumber", Number(event.target.value))} />
              </Field>
            </div>
            <div className="flex items-center justify-between gap-4 rounded-xl border border-dashed border-u-line bg-u-s2/60 px-4 py-3  ">
              <div>
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-u-muted">Next number preview</p>
                <p className="mt-0.5 font-mono text-[15px] font-semibold text-u-ink ">{invoicePreview}</p>
              </div>
              <Badge tone="gray">Prototype only</Badge>
            </div>
            <Field label="Default payment terms">
              <Select value={value.paymentTerms} disabled={readOnly} onChange={(event) => update("paymentTerms", event.target.value)}>
                {["Due immediately", "Net 7", "Net 15", "Net 30", "Net 45"].map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </Select>
            </Field>
            <Field label="Due-date calculation">
              <Select value={value.dueDateCalculation} disabled={readOnly} onChange={(event) => update("dueDateCalculation", event.target.value)}>
                {["Issue date + payment terms", "Rent due day", "End of issue month", "Manual due date"].map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </Select>
            </Field>
          </CardBody>
        </Card>

        <Card id="rent">
          <CardHeader icon={CalendarClock} title="Rent & late fees" description="Standard rent schedule and late-payment rules." />
          <CardBody className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Rent due day" required error={errors.rentDueDay} hint="1st–28th of each month.">
                <Select value={String(value.rentDueDay)} disabled={readOnly} onChange={(event) => update("rentDueDay", Number(event.target.value))}>
                  {Array.from({ length: 28 }, (_, index) => index + 1).map((day) => (
                    <option key={day} value={day}>{day}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Grace period (days)" required error={errors.gracePeriod}>
                <Input type="number" min={0} max={30} value={value.gracePeriod} disabled={readOnly} invalid={!!errors.gracePeriod} onChange={(event) => update("gracePeriod", Number(event.target.value))} />
              </Field>
            </div>
            <Field label="Late-fee method">
              <RadioCards
                columns={2}
                value={value.lateFeeMethod}
                disabled={readOnly}
                onChange={(next) => update("lateFeeMethod", next)}
                options={[
                  { value: "Fixed amount", label: "Fixed amount", description: "One flat fee per late payment." },
                  { value: "Percentage of rent", label: "Percentage of rent", description: "A percentage with an optional cap." },
                ]}
              />
            </Field>
            {value.lateFeeMethod === "Fixed amount" ? (
              <Field label="Late fee amount" error={errors.lateFeeAmount} hint="Charged after the grace period.">
                <Input type="number" min={0} max={1000} prefix="$" value={value.lateFeeAmount} disabled={readOnly} invalid={!!errors.lateFeeAmount} onChange={(event) => update("lateFeeAmount", Number(event.target.value))} />
              </Field>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Late fee rate" error={errors.lateFeePercent}>
                  <Input type="number" min={0} max={20} step={0.25} prefix="%" value={value.lateFeePercent} disabled={readOnly} invalid={!!errors.lateFeePercent} onChange={(event) => update("lateFeePercent", Number(event.target.value))} />
                </Field>
                <Field label="Maximum late fee" error={errors.lateFeeCap}>
                  <Input type="number" min={0} max={5000} prefix="$" value={value.lateFeeCap} disabled={readOnly} invalid={!!errors.lateFeeCap} onChange={(event) => update("lateFeeCap", Number(event.target.value))} />
                </Field>
              </div>
            )}
            <div className="rounded-lg bg-u-s2 px-3 py-2 text-[11.5px] text-u-muted  ">
              Example: $1,850 rent due on the {value.rentDueDay}th. A {value.lateFeeMethod === "Fixed amount" ? `$${value.lateFeeAmount}` : `${value.lateFeePercent}% fee (max $${value.lateFeeCap})`} applies after{" "}
              {value.gracePeriod} days. Mock calculation only.
            </div>
          </CardBody>
        </Card>
      </div>

      <Card id="taxes">
        <CardHeader icon={Percent} title="Tax configuration" description="Default tax treatment for new invoices and charges." aside={<Badge tone="amber">No filings processed</Badge>} />
        <CardBody className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Tax name">
              <Input value={value.taxName} disabled={readOnly} onChange={(event) => update("taxName", event.target.value)} />
            </Field>
            <Field label="Default tax rate" error={errors.taxRate}>
              <Input type="number" min={0} max={30} step={0.01} prefix="%" value={value.taxRate} disabled={readOnly} invalid={!!errors.taxRate} onChange={(event) => update("taxRate", Number(event.target.value))} />
            </Field>
          </div>
          <Field label="Pricing treatment">
            <RadioCards
              value={value.taxInclusive ? "Inclusive" : "Exclusive"}
              disabled={readOnly}
              onChange={(next) => update("taxInclusive", next === "Inclusive")}
              options={[
                { value: "Exclusive", label: "Tax exclusive", description: "Tax is added on top of the invoice subtotal." },
                { value: "Inclusive", label: "Tax inclusive", description: "The entered amount already contains tax." },
              ]}
            />
          </Field>
        </CardBody>
      </Card>

      <Card id="payments">
        <CardHeader icon={Wallet} title="Payments, deposits & approvals" description="Payment guidance, refund behavior and financial approval limits." />
        <CardBody className="space-y-4">
          <Field label="Default payment instructions" required error={errors.paymentInstructions} hint="Included on new invoices. Do not include sensitive banking credentials in this prototype.">
            <Textarea value={value.paymentInstructions} disabled={readOnly} invalid={!!errors.paymentInstructions} rows={4} onChange={(event) => update("paymentInstructions", event.target.value)} />
          </Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Deposit refund preference">
              <Select value={value.depositRefund} disabled={readOnly} onChange={(event) => update("depositRefund", event.target.value)}>
                {["Original payment method within 21 days", "Check within 30 days", "Manual refund review", "Apply to outstanding balance first"].map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </Select>
            </Field>
            <Field label="Financial reporting period">
              <Select value={value.financialReportingPeriod} disabled={readOnly} onChange={(event) => update("financialReportingPeriod", event.target.value)}>
                {["Calendar month", "Fiscal month", "Calendar quarter", "Fiscal quarter"].map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </Select>
            </Field>
            <Field
              label="Default financial approval threshold"
              error={errors.approvalThreshold}
              hint="Transactions at or above this amount require approval."
              className="md:col-span-2"
            >
              <Input type="number" min={0} prefix="$" value={value.approvalThreshold} disabled={readOnly} invalid={!!errors.approvalThreshold} onChange={(event) => update("approvalThreshold", Number(event.target.value))} />
            </Field>
          </div>
        </CardBody>
        <div className="flex items-start gap-2 border-t border-u-line px-5 py-3 text-[11.5px] text-u-muted sm:px-6  ">
          <ReceiptText className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Approvals are simulated at the UI level. Accounting entries and tax filings are not created by this settings prototype.
        </div>
      </Card>
    </div>
  );
}
