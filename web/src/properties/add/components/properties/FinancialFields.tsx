import { useState } from "react";
import { Eye, EyeOff, Info } from "lucide-react";
import { Field } from "../ui/Field";
import { Input, Select } from "../ui/Input";
import { CURRENCIES, EXPENSE_CATEGORIES } from "../../data/mockProperties";
import type { TaxFrequency } from "../../types/property";
import type { SectionProps } from "./PropertyFormSection";
import { formatCurrency } from "./validation";

function CurrencyInput({
  id,
  value,
  onChange,
  invalid,
  placeholder,
  currency,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  invalid?: boolean;
  placeholder?: string;
  currency: string;
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-moss-500">$</span>
      <Input
        id={id}
        type="number"
        min={0}
        step="0.01"
        value={value}
        invalid={invalid}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pl-7 pr-14"
      />
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-moss-500">
        {currency}
      </span>
    </div>
  );
}

export function FinancialFields({ form, set, errors }: SectionProps) {
  const [showMortgageRef, setShowMortgageRef] = useState(false);
  const cur = form.defaultCurrency || "CAD";

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-lg border border-moss-800 bg-moss-900/70 p-3.5">
        <Info size={15} className="mt-0.5 shrink-0 text-moss-500" />
        <p className="text-xs leading-relaxed text-moss-500">
          All financial fields are optional — you can create the property now and complete this
          later. The purchase price and current estimated value are tracked separately.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-x-5 gap-y-4 md:grid-cols-2">
        <Field label="Purchase Price" htmlFor="purchasePrice" error={errors.purchasePrice}
          hint={form.purchasePrice && !errors.purchasePrice ? formatCurrency(form.purchasePrice, cur) : "The historical acquisition cost."}>
          <CurrencyInput
            id="purchasePrice"
            value={form.purchasePrice}
            invalid={!!errors.purchasePrice}
            onChange={(v) => set("purchasePrice", v)}
            placeholder="0.00"
            currency={cur}
          />
        </Field>

        <Field label="Purchase Date" htmlFor="purchaseDate" error={errors.purchaseDate}>
          <Input
            id="purchaseDate"
            type="date"
            value={form.purchaseDate}
            invalid={!!errors.purchaseDate}
            onChange={(e) => set("purchaseDate", e.target.value)}
            className="[color-scheme:dark]"
          />
        </Field>

        <Field label="Current Estimated Value" htmlFor="currentEstimatedValue" error={errors.currentEstimatedValue}
          hint={form.currentEstimatedValue && !errors.currentEstimatedValue ? formatCurrency(form.currentEstimatedValue, cur) : "Today's market estimate — separate from purchase price."}>
          <CurrencyInput
            id="currentEstimatedValue"
            value={form.currentEstimatedValue}
            invalid={!!errors.currentEstimatedValue}
            onChange={(v) => set("currentEstimatedValue", v)}
            placeholder="0.00"
            currency={cur}
          />
        </Field>

        <Field label="Default Currency" htmlFor="defaultCurrency">
          <Select
            id="defaultCurrency"
            value={form.defaultCurrency}
            onChange={(e) => set("defaultCurrency", e.target.value)}
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Select>
        </Field>

        <Field label="Property Tax Amount" htmlFor="propertyTaxAmount" error={errors.propertyTaxAmount}>
          <CurrencyInput
            id="propertyTaxAmount"
            value={form.propertyTaxAmount}
            invalid={!!errors.propertyTaxAmount}
            onChange={(v) => set("propertyTaxAmount", v)}
            placeholder="0.00"
            currency={cur}
          />
        </Field>

        <Field label="Property Tax Frequency" htmlFor="propertyTaxFrequency">
          <Select
            id="propertyTaxFrequency"
            value={form.propertyTaxFrequency}
            onChange={(e) => set("propertyTaxFrequency", e.target.value as TaxFrequency)}
          >
            <option value="">Select…</option>
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="annually">Annually</option>
            <option value="other">Other</option>
          </Select>
        </Field>

        <Field label="Insurance Provider" htmlFor="insuranceProvider">
          <Input
            id="insuranceProvider"
            value={form.insuranceProvider}
            onChange={(e) => set("insuranceProvider", e.target.value)}
            placeholder="e.g. Intact Insurance"
          />
        </Field>

        <Field label="Insurance Policy Expiry" htmlFor="insurancePolicyExpiry">
          <Input
            id="insurancePolicyExpiry"
            type="date"
            value={form.insurancePolicyExpiry}
            onChange={(e) => set("insurancePolicyExpiry", e.target.value)}
            className="[color-scheme:dark]"
          />
        </Field>

        <Field label="Mortgage Lender" htmlFor="mortgageLender">
          <Input
            id="mortgageLender"
            value={form.mortgageLender}
            onChange={(e) => set("mortgageLender", e.target.value)}
            placeholder="e.g. RBC Royal Bank"
          />
        </Field>

        <Field label="Mortgage Reference" htmlFor="mortgageReference" hint="Masked by default — never share full account credentials.">
          <div className="relative">
            <Input
              id="mortgageReference"
              type={showMortgageRef ? "text" : "password"}
              autoComplete="off"
              value={form.mortgageReference}
              onChange={(e) => set("mortgageReference", e.target.value)}
              placeholder="Internal reference number"
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowMortgageRef((s) => !s)}
              aria-label={showMortgageRef ? "Hide mortgage reference" : "Show mortgage reference"}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-moss-500 hover:text-moss-300"
            >
              {showMortgageRef ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </Field>

        <Field label="Default Expense Category" htmlFor="defaultExpenseCategory" hint="Used as the default when logging expenses for this property.">
          <Select
            id="defaultExpenseCategory"
            value={form.defaultExpenseCategory}
            onChange={(e) => set("defaultExpenseCategory", e.target.value)}
          >
            <option value="">Select…</option>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Select>
        </Field>
      </div>
    </div>
  );
}
