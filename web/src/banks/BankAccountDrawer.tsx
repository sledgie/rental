// Add / edit bank account in the same side drawer as Add unit: lettered sections, an auto-generated ID and a footer with Cancel / Create.
import { useMemo, useState } from "react";
import { useStore } from "../bankrecon/lib/store";
import { isSupabaseConfigured } from "../lib/supabase";
import { ACCOUNT_TYPES, type BankAccount } from "../bankrecon/lib/types";
import { fmtDateTime } from "../bankrecon/lib/format";
import { Icon } from "../units/components/ui/Icon";
import { Button, Field, Select, TextArea, TextInput } from "../units/components/ui/primitives";
import { Callout, Drawer } from "../units/components/ui/Modal";

type Draft = {
  accountId: string;
  name: string;
  institution: string;
  maskedAccount: string;
  accountType: BankAccount["accountType"];
  classification: string;
  currency: string;
  glAccount: string;
  openingBalance: string;
  openingBalanceDate: string;
  propertyId: string;
  purpose: string;
  notes: string;
};

const PREFIX: Record<BankAccount["accountType"], string> = { Operating: "OP", Trust: "TR", Reserve: "RS", Restricted: "RT", Other: "OT" };

/** BA-<type>-<next number>, numbered across all accounts like the existing BA-OP-01, BA-TR-02, ... */
function nextAccountId(accounts: BankAccount[], type: BankAccount["accountType"]): string {
  const highest = accounts.reduce((max, a) => {
    const n = Number(a.id.split("-").pop());
    return Number.isFinite(n) ? Math.max(max, n) : max;
  }, 0);
  return `BA-${PREFIX[type]}-${String(highest + 1).padStart(2, "0")}`;
}

function SectionLabel({ step, title, note }: { step: string; title: string; note?: string }) {
  return (
    <div className="mb-2.5 flex items-center gap-2 border-b border-u-line2 pb-1.5">
      <span className="u-num flex h-5 w-5 items-center justify-center rounded border border-u-accent/35 bg-u-accent/12 text-[10.5px] font-600 text-u-accent">
        {step}
      </span>
      <h3 className="font-display text-[12px] font-600 uppercase tracking-[0.11em] text-u-ink2">{title}</h3>
      {note && <span className="ml-auto text-[10.5px] text-u-muted">{note}</span>}
    </div>
  );
}

export function BankAccountDrawer({
  account,
  onClose,
  onSaved,
}: {
  /** null = add a new account */
  account: BankAccount | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const { state, addAccount, updateAccount, can } = useStore();
  const mode = account ? "edit" : "create";
  const [draft, setDraft] = useState<Draft>(() => ({
    accountId: account?.id ?? "",
    name: account?.name ?? "",
    institution: account?.institution ?? "",
    maskedAccount: account?.maskedAccount ?? "",
    accountType: account?.accountType ?? "Operating",
    classification: account?.classification ?? "",
    currency: account?.currency ?? "USD",
    glAccount: account?.glAccount ?? "",
    openingBalance: account ? String(account.openingBalance) : "",
    openingBalanceDate: account?.openingBalanceDate ?? new Date().toISOString().slice(0, 10),
    propertyId: account?.propertyId ?? "",
    purpose: account?.purpose ?? "",
    notes: account?.notes ?? "",
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setErrors((e) => (e[key as string] ? { ...e, [key as string]: "" } : e));
    setFormError(null);
  };

  const generatedId = useMemo(
    () => (mode === "create" ? (isSupabaseConfigured ? "Assigned on save" : nextAccountId(state.accounts, draft.accountType)) : account?.code ?? draft.accountId),
    [mode, state.accounts, draft.accountType, draft.accountId],
  );
  const allowed = can("create_edit_bank_accounts");

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!draft.name.trim()) e.name = "Account name is required.";
    if (!draft.glAccount) e.glAccount = "Link a Chart of Accounts cash/bank account.";
    const balance = Number(draft.openingBalance);
    if (draft.openingBalance.trim() === "" || !Number.isFinite(balance)) e.openingBalance = "Enter a valid opening balance (0 is fine).";
    if (!/^[A-Za-z]{3}$/.test(draft.currency.trim())) e.currency = "Use a 3-letter code, e.g. USD.";
    if (!draft.openingBalanceDate) e.openingBalanceDate = "Choose the date of the opening balance.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function save() {
    if (!validate()) {
      setFormError("The account was not saved — fix the highlighted fields and try again.");
      return;
    }
    setSaving(true);
    window.setTimeout(() => {
      const fields = {
        name: draft.name.trim(),
        institution: draft.institution.trim(),
        maskedAccount: draft.maskedAccount.trim(),
        accountType: draft.accountType,
        currency: draft.currency.trim().toUpperCase(),
        glAccount: draft.glAccount,
        glAccountName: state.coa.find((c) => c.code === draft.glAccount)?.name ?? "",
        openingBalance: Number(draft.openingBalance),
        openingBalanceDate: draft.openingBalanceDate,
        purpose: draft.purpose.trim(),
        propertyId: draft.propertyId || null,
        classification: draft.classification.trim(),
        notes: draft.notes.trim(),
      };
      if (account) {
        updateAccount(account.id, fields);
        onSaved(`${fields.name} was updated.`);
      } else {
        const res = addAccount({ id: isSupabaseConfigured ? crypto.randomUUID() : generatedId, active: true, ...fields });
        if (!res.ok) {
          setSaving(false);
          setFormError(res.error ?? "Unable to create the account.");
          return;
        }
        onSaved(isSupabaseConfigured ? `${fields.name} was added.` : `${fields.name} was added as ${generatedId}.`);
      }
      setSaving(false);
      onClose();
    }, 380);
  }

  return (
    <Drawer
      open
      onClose={onClose}
      labelledBy="bank-account-form-title"
      title={mode === "create" ? "Add bank account" : `Edit ${account?.name ?? "bank account"}`}
      subtitle={
        mode === "create"
          ? "Creates the account record only — no transactions or reconciliation are generated automatically."
          : "Account numbers stay masked. Changes are recorded in the audit history."
      }
      footer={
        <div className="flex flex-wrap items-center gap-2 px-4 py-3">
          <span className="text-[11px] text-u-muted">
            {mode === "create" ? (
              <>Will be created as <span className="u-num text-u-muted">{generatedId}</span></>
            ) : (
              <>Last updated <span className="u-num text-u-muted">{account ? fmtDateTime(account.updatedAt) : "—"}</span></>
            )}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="md" onClick={onClose}>Cancel</Button>
            <Button variant="primary" size="md" icon="check" loading={saving} disabled={!allowed} onClick={save}>
              {mode === "create" ? "Create account" : "Save changes"}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-5 p-4">
        {!allowed && (
          <Callout tone="amber" icon="alert" title="View only">You don't have permission to create or edit bank accounts.</Callout>
        )}
        {formError && (
          <Callout tone="rose" icon="alert" title="Check the highlighted fields">{formError}</Callout>
        )}

        {/* A — identification */}
        <section>
          <SectionLabel step="A" title="Account identification" note="How the account appears across the app" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Account name" required error={errors.name} className="sm:col-span-2">
              <TextInput value={draft.name} invalid={!!errors.name} placeholder="e.g. Operating account" onChange={(e) => set("name", e.target.value)} />
            </Field>
            <Field label="Account ID" hint="Auto-generated">
              <div className="flex h-9 items-center gap-1.5 rounded-md border border-u-line2 bg-u-bg/50 px-2.5">
                <Icon name="spark" size={12} className="text-u-accent" />
                <span className="u-num text-[13px] text-u-ink2">{generatedId}</span>
              </div>
            </Field>
            <Field label="Account type" required>
              <Select value={draft.accountType} onChange={(e) => set("accountType", e.target.value as BankAccount["accountType"])}>
                {ACCOUNT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </Select>
            </Field>
          </div>
        </section>

        {/* B — bank details */}
        <section>
          <SectionLabel step="B" title="Bank details" note="Only a masked number is stored" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Financial institution" className="sm:col-span-2">
              <TextInput value={draft.institution} placeholder="e.g. First National Bank" onChange={(e) => set("institution", e.target.value)} />
            </Field>
            <Field label="Masked account number">
              <TextInput value={draft.maskedAccount} placeholder="****4521" onChange={(e) => set("maskedAccount", e.target.value)} />
            </Field>
            <Field label="Currency" required error={errors.currency}>
              <TextInput value={draft.currency} maxLength={3} invalid={!!errors.currency} onChange={(e) => set("currency", e.target.value)} />
            </Field>
            <Field label="Classification" hint="Optional" className="sm:col-span-2">
              <TextInput value={draft.classification} placeholder="e.g. Operating, Trust, Restricted" onChange={(e) => set("classification", e.target.value)} />
            </Field>
            <Field label="Purpose" hint="Optional" className="sm:col-span-2">
              <TextInput value={draft.purpose} placeholder="e.g. Rent collection and bill payments" onChange={(e) => set("purpose", e.target.value)} />
            </Field>
          </div>
        </section>

        {/* C — accounting */}
        <section>
          <SectionLabel step="C" title="Accounting" note="Required for reconciliation" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Linked Chart of Accounts" required error={errors.glAccount} className="sm:col-span-2">
              <Select value={draft.glAccount} invalid={!!errors.glAccount} onChange={(e) => set("glAccount", e.target.value)}>
                <option value="">Select a cash/bank account…</option>
                {state.coa.filter((c) => c.kind === "asset").map((c) => (
                  <option key={c.code} value={c.code}>{c.code} — {c.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="Opening balance" required error={errors.openingBalance}>
              <TextInput type="number" step="0.01" value={draft.openingBalance} invalid={!!errors.openingBalance} placeholder="e.g. 25000" onChange={(e) => set("openingBalance", e.target.value)} />
            </Field>
            <Field label="As of" required error={errors.openingBalanceDate}>
              <TextInput type="date" value={draft.openingBalanceDate} invalid={!!errors.openingBalanceDate} onChange={(e) => set("openingBalanceDate", e.target.value)} />
            </Field>
          </div>
          <Callout className="mt-2" tone="azure" icon="info">
            The opening balance is the starting point for reconciliation. It does not create a deposit or any ledger entry.
          </Callout>
        </section>

        {/* D — usage */}
        <section>
          <SectionLabel step="D" title="Usage" note="Optional" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Property" hint="Leave empty for a company account" className="sm:col-span-2">
              <Select value={draft.propertyId} onChange={(e) => set("propertyId", e.target.value)}>
                <option value="">None — company account</option>
                {state.properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
            </Field>
            <Field label="Internal notes" className="sm:col-span-2 lg:col-span-4">
              <TextArea rows={3} value={draft.notes} placeholder="Anything the team should know about this account." onChange={(e) => set("notes", e.target.value)} />
            </Field>
          </div>
        </section>
      </div>
    </Drawer>
  );
}
