import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useChart } from "../store/chart-store";
import {
  ACCOUNT_TYPES,
  CLASSIFICATIONS,
  TAX_CODES,
  TYPE_META,
  defaultClassification,
  defaultNormalBalance,
  type AccountType,
} from "../coa/taxonomy";
import { ancestorChain, suggestNextCode } from "../coa/tree";
import { validateDraft } from "../coa/validation";
import type { AccountDraft, FieldErrors, InsertPosition, NormalBalance } from "../coa/types";
import { cn } from "../utils/cn";
import { ParentAccountSelector } from "./ParentAccountSelector";
import { Button, Checkbox, Drawer, Field, Note, Select, Switch, TextArea, TextInput } from "./ui";
import { CornerDownRight, Info, Sparkle } from "./Icons";

export interface FormRequest {
  mode: "create" | "edit";
  accountId?: string | null;
  position?: InsertPosition;
}

/** Resolve the parent a new account will be created under, from any insertion method. */
const parentFromPosition = (
  accounts: { id: string; parentId: string | null }[],
  position?: InsertPosition,
): string | null => {
  if (!position || position.kind === "root") return null;
  if (position.kind === "child") return position.parentId;
  return accounts.find((a) => a.id === position.siblingId)?.parentId ?? null;
};

function Segmented<T extends string>({
  value,
  options,
  onChange,
  disabled,
  name,
}: {
  value: T;
  options: { value: T; label: string; hint?: string }[];
  onChange: (v: T) => void;
  disabled?: boolean;
  name: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={name}
      className={cn(
        "inline-flex w-full rounded-[7px] border border-u-line bg-u-s3 p-[3px]",
        disabled && "opacity-55",
      )}
    >
      {options.map((opt) => {
        const on = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={disabled}
            title={opt.hint}
            onClick={() => onChange(opt.value)}
            className={cn(
              "flex-1 rounded-[5px] px-2 py-1.5 text-[12.5px] font-medium transition-all duration-150",
              on
                ? "bg-u-card text-u-ink shadow-[0_1px_2px_rgba(20,24,26,.10)] ring-1 ring-u-line"
                : "text-u-muted hover:text-u-ink2",
              disabled && "cursor-not-allowed",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function Section({ title, children, note }: { title: string; children: ReactNode; note?: string }) {
  return (
    <section className="border-t border-u-line px-4 py-4 first:border-t-0 sm:px-5">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h3 className="text-[12px] font-semibold uppercase tracking-[0.1em] text-u-ink">
          {title}
        </h3>
        {note && <span className="text-[11px] text-u-muted">{note}</span>}
      </div>
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">{children}</div>
    </section>
  );
}

export function AccountForm({ request, onClose }: { request: FormRequest | null; onClose: () => void }) {
  const { state, api } = useChart();
  const editing = request?.mode === "edit" ? state.accounts.find((a) => a.id === request.accountId) ?? null : null;

  const initial = useMemo<AccountDraft>(() => {
    if (editing) {
      return {
        code: editing.code,
        name: editing.name,
        parentId: editing.parentId,
        type: editing.type,
        classification: editing.classification,
        normalBalance: editing.normalBalance,
        role: editing.role,
        allowDirectPosting: editing.allowDirectPosting,
        status: editing.status,
        description: editing.description,
        taxCode: editing.taxCode,
        openingBalance: editing.openingBalance,
      };
    }
    const parentId = parentFromPosition(state.accounts, request?.position);
    const parent = parentId ? state.accounts.find((a) => a.id === parentId) ?? null : null;
    const pos = request?.position;
    const sibling =
      pos && (pos.kind === "before" || pos.kind === "after")
        ? state.accounts.find((a) => a.id === pos.siblingId) ?? null
        : null;
    const type: AccountType = parent?.type ?? sibling?.type ?? "Asset";
    return {
      code: suggestNextCode(state.accounts, parentId, type) ?? "",
      name: "",
      parentId,
      type,
      classification: defaultClassification(type),
      normalBalance: defaultNormalBalance(type),
      role: "Posting",
      allowDirectPosting: true,
      status: "Active",
      description: "",
      taxCode: null,
      openingBalance: null,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request, editing?.id]);

  const [draft, setDraft] = useState<AccountDraft>(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [warnings, setWarnings] = useState<FieldErrors>({});
  const [submitted, setSubmitted] = useState(false);
  const [acknowledgedMove, setAcknowledgedMove] = useState(false);

  useEffect(() => {
    if (!request) return;
    setDraft(initial);
    setErrors({});
    setWarnings({});
    setSubmitted(false);
    setAcknowledgedMove(false);
  }, [request, initial]);

  const set = <K extends keyof AccountDraft>(key: K, value: AccountDraft[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const validation = useMemo(
    () =>
      validateDraft(draft, {
        accounts: state.accounts,
        editingId: editing?.id ?? null,
        originalParentId: editing?.parentId ?? null,
      }),
    [draft, state.accounts, editing],
  );

  useEffect(() => {
    if (submitted) {
      setErrors(validation.errors);
      setWarnings(validation.warnings);
    } else {
      setWarnings(validation.warnings);
    }
  }, [submitted, validation]);

  if (!request) return null;

  const parent = draft.parentId ? state.accounts.find((a) => a.id === draft.parentId) ?? null : null;
  const chain = parent ? ancestorChain(state.accounts, parent.id) : [];
  const positionLabel = (() => {
    const pos = request.position;
    if (!pos || request.mode === "edit") return null;
    if (pos.kind === "before" || pos.kind === "after") {
      const sib = state.accounts.find((a) => a.id === pos.siblingId);
      return sib ? `Inserted ${pos.kind} ${sib.code} ${sib.name}` : null;
    }
    if (pos.kind === "child" && parent) return `Added as a child of ${parent.code} ${parent.name}`;
    return "Added at the top level of the chart";
  })();

  const changeType = (type: AccountType) => {
    setDraft((prev) => {
      const nextParent =
        prev.parentId && state.accounts.find((a) => a.id === prev.parentId)?.type !== type ? null : prev.parentId;
      return {
        ...prev,
        type,
        classification:
          prev.classification && CLASSIFICATIONS[type].includes(prev.classification)
            ? prev.classification
            : defaultClassification(type),
        normalBalance: defaultNormalBalance(type),
        parentId: nextParent,
      };
    });
    if (parent && parent.type !== type) {
      api.notify({
        kind: "info",
        title: "Parent cleared",
        message: `${parent.code} ${parent.name} is a ${parent.type} account, so it cannot hold a ${type} account. Choose a new parent.`,
      });
    }
  };

  const suggestCode = () => {
    const next = suggestNextCode(
      state.accounts.filter((a) => a.id !== editing?.id),
      draft.parentId,
      draft.type,
    );
    if (!next) {
      api.notify({
        kind: "warning",
        title: "No safe code available",
        message: `Every code in the ${TYPE_META[draft.type].rangeLabel} range is taken. Enter a code manually, or widen the range convention.`,
      });
      return;
    }
    set("code", next);
    api.notify({
      kind: "info",
      title: `Suggested code ${next}`,
      message: "The suggestion is editable — nothing is applied until you save.",
    });
  };

  const submit = () => {
    setSubmitted(true);
    setErrors(validation.errors);
    setWarnings(validation.warnings);
    if (Object.keys(validation.errors).length) {
      const first = Object.keys(validation.errors)[0];
      const el = document.getElementById(`f-${first}`);
      el?.focus();
      el?.scrollIntoView({ block: "center", behavior: "smooth" });
      api.notify({
        kind: "error",
        title: "Fix the highlighted fields",
        message: `${Object.keys(validation.errors).length} validation rule${
          Object.keys(validation.errors).length === 1 ? "" : "s"
        } blocked the save. The chart is unchanged.`,
      });
      return;
    }
    if (request.mode === "edit" && editing) {
      const moved = draft.parentId !== editing.parentId;
      if (moved && !acknowledgedMove) {
        setErrors((e) => ({ ...e, form: "Confirm the re-parenting warning before saving." }));
        return;
      }
      api.saveAccount(editing.id, draft);
    } else {
      api.createAccount(draft, request.position ?? { kind: "root" });
    }
    onClose();
  };

  const isGroup = draft.role === "Group";
  const errorCount = Object.keys(errors).length;

  return (
    <Drawer
      open
      onClose={onClose}
      eyebrow={request.mode === "edit" ? `Editing · ${editing?.code ?? ""}` : "New account"}
      title={request.mode === "edit" ? "Edit account" : "Create account"}
      footer={
        <>
          <div className="flex min-w-0 flex-1 items-center gap-2 text-[11.5px] text-u-muted">
            <Info className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">Session state only — not written to a database.</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="md" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" size="md" onClick={submit}>
              {request.mode === "edit" ? "Save changes" : "Create account"}
            </Button>
          </div>
        </>
      }
    >
      {/* placement preview */}
      <div className="mb-4 rounded-[8px] border border-u-line bg-u-s2 px-3 py-2.5">
        <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.09em] text-u-muted">
          {request.mode === "edit" ? "Current position in the chart" : "Where this account will land"}
        </p>
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[12px] text-u-ink2">
          <span className="uppercase tracking-[0.06em] text-u-muted">Chart</span>
          {chain.map((node) => (
            <span key={node.id} className="flex items-center gap-1.5">
              <span className="text-u-muted">›</span>
              <span className="font-mono text-[11.5px] text-u-ink2">{node.code}</span>
              <span className="max-w-[18ch] truncate">{node.name}</span>
            </span>
          ))}
          <span className="text-u-muted">›</span>
          <span className="inline-flex items-center gap-1.5 rounded-[5px] border border-u-accent/30 bg-u-accent-soft px-1.5 py-0.5 font-medium text-u-accent">
            <CornerDownRight className="h-3 w-3" />
            <span className="font-mono text-[11.5px] tabular">{draft.code || "____"}</span>
            <span className="max-w-[22ch] truncate">{draft.name || "New account"}</span>
          </span>
        </div>
        {positionLabel && <p className="mt-1.5 text-[11.5px] text-u-muted">{positionLabel}.</p>}
        {!parent && <p className="mt-1.5 text-[11.5px] text-u-muted">No parent — this will be a top-level account.</p>}
      </div>

      {errors.form && (
        <div className="mb-4">
          <Note tone="danger" title="Cannot save yet">
            {errors.form}
          </Note>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            submit();
          }
        }}
      >
        <Section title="Identity" note="Code and name are required">
          <Field
            label="Account code"
            required
            htmlFor="f-code"
            error={errors.code}
            warning={warnings.code}
            hint={`Conventional range for ${draft.type}: ${TYPE_META[draft.type].rangeLabel}. Codes are unique but may differ in length.`}
            aside={
              <button
                type="button"
                onClick={suggestCode}
                className="inline-flex items-center gap-1 rounded-[4px] px-1 py-0.5 text-[11px] font-medium text-u-accent transition-colors hover:bg-u-accent-soft"
              >
                <Sparkle className="h-3 w-3" /> Suggest next code
              </button>
            }
          >
            <TextInput
              id="f-code"
              name="code"
              inputMode="numeric"
              autoComplete="off"
              placeholder="e.g. 4120"
              value={draft.code}
              invalid={!!errors.code}
              onChange={(e) => set("code", e.target.value.replace(/[^\d]/g, "").slice(0, 6))}
              className="font-mono tabular"
            />
          </Field>

          <Field label="Account name" required htmlFor="f-name" error={errors.name}>
            <TextInput
              id="f-name"
              name="name"
              autoComplete="off"
              placeholder="e.g. Commercial Rent Revenue"
              value={draft.name}
              invalid={!!errors.name}
              onChange={(e) => set("name", e.target.value)}
            />
          </Field>

          <div className="sm:col-span-2">
            <Field
              label="Parent account"
              htmlFor="f-parent"
              error={errors.parentId}
              hint="Search the full hierarchy, expand any branch, or keep it top-level. Inactive accounts, posting accounts and type mismatches are excluded."
            >
              <ParentAccountSelector
                id="f-parent"
                accounts={state.accounts}
                value={draft.parentId}
                type={draft.type}
                editingId={editing?.id ?? null}
                invalid={!!errors.parentId}
                onChange={(id) => set("parentId", id)}
              />
            </Field>
          </div>
        </Section>

        <Section title="Classification" note="Drives report grouping">
          <Field label="Account type" required htmlFor="f-type">
            <Select id="f-type" value={draft.type} onChange={(e) => changeType(e.target.value as AccountType)}>
              {ACCOUNT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {TYPE_META[t].label} · {TYPE_META[t].rangeLabel}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Account classification"
            htmlFor="f-classification"
            error={errors.classification}
            hint="Optional — values depend on the account type."
          >
            <Select
              id="f-classification"
              value={draft.classification ?? ""}
              invalid={!!errors.classification}
              onChange={(e) => set("classification", e.target.value || null)}
            >
              <option value="">Not set</option>
              {CLASSIFICATIONS[draft.type].map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Normal balance"
            htmlFor="f-normalBalance"
            warning={warnings.normalBalance}
            hint={`Defaults to ${TYPE_META[draft.type].normalBalance} for ${draft.type} accounts.`}
          >
            <Segmented<NormalBalance>
              name="Normal balance"
              value={draft.normalBalance}
              onChange={(v) => set("normalBalance", v)}
              options={[
                { value: "Debit", label: "Debit" },
                { value: "Credit", label: "Credit" },
              ]}
            />
          </Field>

          <Field
            label="Tax code"
            htmlFor="f-taxCode"
            hint="Optional — Canadian GST/HST handling for this account."
          >
            <Select
              id="f-taxCode"
              value={draft.taxCode ?? ""}
              onChange={(e) => set("taxCode", e.target.value || null)}
            >
              <option value="">Not applicable</option>
              {TAX_CODES.map((t) => (
                <option key={t.code} value={t.code}>
                  {t.code} — {t.label}
                </option>
              ))}
            </Select>
          </Field>
        </Section>

        <Section title="Posting behaviour" note="Group vs. posting rules">
          <Field
            label="Account role"
            error={errors.role}
            hint={isGroup ? "Group accounts roll up children and never receive journal lines." : "Posting accounts are leaves and accept journal lines."}
          >
            <Segmented<AccountDraft["role"]>
              name="Account role"
              value={draft.role}
              onChange={(v) =>
                setDraft((prev) => ({
                  ...prev,
                  role: v,
                  allowDirectPosting: v === "Group" ? false : true,
                  openingBalance: v === "Group" ? null : prev.openingBalance,
                }))
              }
              options={[
                { value: "Group", label: "Group account" },
                { value: "Posting", label: "Posting account" },
              ]}
            />
          </Field>

          <Field
            label="Allow direct posting"
            hint={isGroup ? "Locked off while the account is a group." : "Turn off to keep the account open but closed to journals."}
          >
            <div className="flex h-9 items-center rounded-[6px] border border-u-line bg-u-s2 px-2.5">
              <Switch
                id="f-allowDirectPosting"
                checked={draft.allowDirectPosting}
                disabled={isGroup}
                onChange={(v) => set("allowDirectPosting", v)}
                label={draft.allowDirectPosting ? "Yes — journals may post here" : "No — blocked from journals"}
              />
            </div>
          </Field>

          <Field label="Status" htmlFor="f-status" error={errors.status}>
            <Segmented<AccountDraft["status"]>
              name="Status"
              value={draft.status}
              onChange={(v) => set("status", v)}
              options={[
                { value: "Active", label: "Active" },
                { value: "Inactive", label: "Inactive" },
              ]}
            />
          </Field>

          <Field
            label="Opening balance"
            htmlFor="f-openingBalance"
            error={errors.openingBalance}
            hint="Optional. Leave blank for accounts created mid-year."
          >
            <TextInput
              id="f-openingBalance"
              type="number"
              step="0.01"
              placeholder={isGroup ? "Rolled up from children" : "0.00"}
              disabled={isGroup}
              value={draft.openingBalance ?? ""}
              invalid={!!errors.openingBalance}
              onChange={(e) =>
                set("openingBalance", e.target.value === "" ? null : Number.parseFloat(e.target.value))
              }
              className="font-mono tabular"
            />
          </Field>

          <div className="sm:col-span-2">
            <Field label="Description" htmlFor="f-description" hint="Optional — shown in the details panel and on account pickers.">
              <TextArea
                id="f-description"
                rows={3}
                placeholder="What belongs in this account, and any sub-ledger conventions…"
                value={draft.description}
                onChange={(e) => set("description", e.target.value)}
              />
            </Field>
          </div>
        </Section>

        {request.mode === "edit" && editing && draft.parentId !== editing.parentId && (
          <div className="border-t border-u-line px-4 py-4 sm:px-5">
            <Note tone="warning" title="This save will re-parent the account">
              <p className="mb-2">
                Moving {editing.code} {editing.name} changes its grouping in trial balances, financial statements
                and any connected integrations. All descendants travel with it.
              </p>
              <Checkbox
                id="ack-move"
                checked={acknowledgedMove}
                onChange={setAcknowledgedMove}
                label="I understand the reporting impact and want to save the new parent."
              />
            </Note>
          </div>
        )}

        <div className="flex items-center justify-between gap-3 border-t border-u-line bg-u-s2 px-4 py-2.5 sm:px-5">
          <span className={cn("text-[11.5px]", errorCount ? "font-medium text-u-danger" : "text-u-muted")}>
            {submitted && errorCount
              ? `${errorCount} field${errorCount === 1 ? "" : "s"} need attention`
              : request.mode === "edit"
                ? `Editing ${editing?.code} · id ${editing?.id}`
                : "Press ⌘/Ctrl + ⏎ to save"}
          </span>
          <span className="hidden text-[11.5px] text-u-muted sm:inline">
            {isGroup ? "Group account — no direct postings" : "Posting account"}
          </span>
        </div>
        <button type="submit" className="sr-only" tabIndex={-1} aria-hidden="true">
          Save
        </button>
      </form>
    </Drawer>
  );
}
