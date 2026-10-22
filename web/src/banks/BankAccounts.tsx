import { useMemo, useState } from "react";
import { useStore } from "../bankrecon/lib/store";
import { Alert, Badge, Button, Card, DataTableWrap, Drawer, EmptyState, Field, Input, Modal, Select, Textarea, Th, Td, Toolbar } from "../bankrecon/components/ui";
import { Icon } from "../bankrecon/components/icons";
import { ACCOUNT_TYPES, BankAccount } from "../bankrecon/lib/types";
import { fmtDate, money, fmtDateTime } from "../bankrecon/lib/format";

const emptyForm = {
  id: "",
  name: "",
  institution: "",
  maskedAccount: "",
  accountType: "Operating" as BankAccount["accountType"],
  currency: "USD",
  glAccount: "",
  glAccountName: "",
  openingBalance: "",
  openingBalanceDate: fmtDate(new Date()),
  purpose: "",
  propertyId: "",
  classification: "",
  notes: "",
};

export default function BankAccountsPage() {
  const { state, addAccount, updateAccount, deactivateAccount, can } = useStore();
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<BankAccount | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [auditAccount, setAuditAccount] = useState<BankAccount | null>(null);

  const filtered = useMemo(() => {
    if (!search) return state.accounts;
    const s = search.toLowerCase();
    return state.accounts.filter((a) => `${a.name} ${a.maskedAccount} ${a.id} ${a.institution} ${a.glAccount}`.toLowerCase().includes(s));
  }, [state.accounts, search]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, openingBalanceDate: new Date().toISOString().slice(0, 10) });
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (a: BankAccount) => {
    setEditing(a);
    setForm({
      id: a.id,
      name: a.name,
      institution: a.institution,
      maskedAccount: a.maskedAccount,
      accountType: a.accountType,
      currency: a.currency,
      glAccount: a.glAccount,
      glAccountName: a.glAccountName,
      openingBalance: String(a.openingBalance),
      openingBalanceDate: a.openingBalanceDate,
      purpose: a.purpose,
      propertyId: a.propertyId ?? "",
      classification: a.classification,
      notes: a.notes,
    });
    setFormError(null);
    setModalOpen(true);
  };

  const submit = () => {
    setFormError(null);
    if (!form.id.trim()) return setFormError("Account ID (unique internal identifier) is required.");
    if (state.accounts.some((a) => a.id === form.id && a.id !== editing?.id)) return setFormError("An account with this internal identifier already exists. Duplicate active configurations are not allowed.");
    if (!form.name.trim()) return setFormError("Account name is required.");
    if (!form.glAccount.trim()) return setFormError("Link a Chart of Accounts cash/bank account.");
    const balance = Number(form.openingBalance);
    if (!Number.isFinite(balance)) return setFormError("Opening balance must be a valid number.");
    if (!editing && state.accounts.some((a) => a.maskedAccount === form.maskedAccount && a.maskedAccount !== "")) {
      // masked numbers may repeat across institutions; only warn
    }

    if (editing) {
      updateAccount(editing.id, {
        name: form.name,
        institution: form.institution,
        maskedAccount: form.maskedAccount,
        accountType: form.accountType,
        currency: form.currency,
        glAccount: form.glAccount,
        glAccountName: form.glAccountName || (state.coa.find((c) => c.code === form.glAccount)?.name ?? ""),
        openingBalance: balance,
        openingBalanceDate: form.openingBalanceDate,
        purpose: form.purpose,
        propertyId: form.propertyId || null,
        classification: form.classification,
        notes: form.notes,
      });
    } else {
      const res = addAccount({
        id: form.id.trim(),
        name: form.name,
        institution: form.institution,
        maskedAccount: form.maskedAccount,
        accountType: form.accountType,
        currency: form.currency,
        glAccount: form.glAccount,
        glAccountName: form.glAccountName || (state.coa.find((c) => c.code === form.glAccount)?.name ?? ""),
        openingBalance: balance,
        openingBalanceDate: form.openingBalanceDate,
        active: true,
        purpose: form.purpose,
        propertyId: form.propertyId || null,
        classification: form.classification,
        notes: form.notes,
      });
      if (!res.ok) return setFormError(res.error ?? "Failed to create account.");
    }
    setModalOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-u-ink">Bank Accounts</h2>
          <p className="text-sm text-u-muted">Configure bank accounts used by the rental management system. Account numbers are masked. No online banking credentials are stored.</p>
        </div>
        <Button variant="primary" icon="plus" onClick={openCreate} disabled={!can("create_edit_bank_accounts")} title={can("create_edit_bank_accounts") ? undefined : "Requires create/edit permission."}>
          New Bank Account
        </Button>
      </div>

      <Card>
        <div className="flex items-center justify-between gap-3 border-b border-u-line px-5 py-4">
          <h2 className="text-sm font-semibold text-u-ink">Configured Accounts</h2>
          <Toolbar>
            <div className="relative">
              <Icon name="search" className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-u-muted" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search accounts…" className="w-52 pl-8" />
            </div>
          </Toolbar>
        </div>
        {filtered.length === 0 ? (
          <EmptyState icon="bank" title="No bank accounts found" />
        ) : (
          <DataTableWrap>
            <thead className="bg-u-s2">
              <tr>
                <Th>Account</Th>
                <Th>Type / Classification</Th>
                <Th>GL Account</Th>
                <Th>Opening Balance</Th>
                <Th>Status</Th>
                <Th>Actions</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-u-line">
              {filtered.map((a) => (
                <tr key={a.id} className="hover:bg-u-s2/60">
                  <Td>
                    <div className="font-medium text-u-ink">{a.name}</div>
                    <div className="text-[11px] text-u-muted">
                      {a.id} · {a.institution} · {a.maskedAccount}
                    </div>
                    {a.propertyId && <div className="text-[11px] text-u-muted">Property: {state.properties.find((p) => p.id === a.propertyId)?.name ?? a.propertyId}</div>}
                  </Td>
                  <Td>
                    <Badge kind={a.accountType === "Trust" ? "outstanding" : a.accountType === "Operating" ? "suggested" : "neutral"}>{a.accountType}</Badge>
                    <div className="text-[11px] text-u-muted mt-1">{a.classification}</div>
                  </Td>
                  <Td>{a.glAccount}<div className="text-[11px] text-u-muted">{a.glAccountName}</div></Td>
                  <Td className="tabular-nums">{money(a.openingBalance)}<div className="text-[11px] text-u-muted">as of {fmtDate(a.openingBalanceDate)}</div></Td>
                  <Td>
                    {a.active ? <Badge kind="matched" dot>Active</Badge> : <Badge kind="cancelled" dot>Inactive</Badge>}
                  </Td>
                  <Td>
                    <div className="flex flex-wrap gap-1.5">
                      <Button size="sm" variant="ghost" icon="settings" onClick={() => openEdit(a)} disabled={!can("create_edit_bank_accounts")}>Edit</Button>
                      <Button size="sm" variant="ghost" icon="history" onClick={() => setAuditAccount(a)}>Audit</Button>
                      {a.active && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-u-danger hover:bg-u-danger-soft"
                          icon="lock"
                          disabled={!can("create_edit_bank_accounts")}
                          onClick={() => {
                            const res = deactivateAccount(a.id);
                            if (!res.ok) alert(res.error);
                          }}
                        >
                          Deactivate
                        </Button>
                      )}
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </DataTableWrap>
        )}
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? `Edit Bank Account — ${editing.id}` : "New Bank Account"}
        subtitle="Account numbers are masked in the interface. Configuration changes are recorded in the audit trail."
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button variant="primary" icon="check" onClick={submit}>Save Account</Button>
          </>
        }
      >
        <div className="space-y-4">
          {formError && <Alert kind="danger">{formError}</Alert>}
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Bank Account ID (unique internal identifier)">
              <Input value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value })} disabled={!!editing} placeholder="BA-OP-05" />
            </Field>
            <Field label="Account Name">
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Sunrise PM — Operating" />
            </Field>
            <Field label="Financial Institution">
              <Input value={form.institution} onChange={(e) => setForm({ ...form, institution: e.target.value })} />
            </Field>
            <Field label="Masked Account Number" hint="Store only a masked representation (e.g. ****4521).">
              <Input value={form.maskedAccount} onChange={(e) => setForm({ ...form, maskedAccount: e.target.value })} placeholder="****4521" />
            </Field>
            <Field label="Account Type" hint="Types and legal classifications are configurable per jurisdiction.">
              <Select value={form.accountType} onChange={(e) => setForm({ ...form, accountType: e.target.value as BankAccount["accountType"] })}>
                {ACCOUNT_TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </Select>
            </Field>
            <Field label="Currency">
              <Input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} />
            </Field>
            <Field label="Linked Chart of Accounts">
              <Select value={form.glAccount} onChange={(e) => setForm({ ...form, glAccount: e.target.value, glAccountName: state.coa.find((c) => c.code === e.target.value)?.name ?? "" })}>
                <option value="">— select cash/bank account —</option>
                {state.coa.filter((c) => c.kind === "asset").map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} — {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Opening Balance">
              <Input type="number" step="0.01" value={form.openingBalance} onChange={(e) => setForm({ ...form, openingBalance: e.target.value })} />
            </Field>
            <Field label="Opening Balance Date">
              <Input type="date" value={form.openingBalanceDate} onChange={(e) => setForm({ ...form, openingBalanceDate: e.target.value })} />
            </Field>
            <Field label="Optional Property Association">
              <Select value={form.propertyId} onChange={(e) => setForm({ ...form, propertyId: e.target.value })}>
                <option value="">— none (corporate account) —</option>
                {state.properties.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="Classification" hint="Trust / Operating / Reserve / Restricted legal classification.">
              <Input value={form.classification} onChange={(e) => setForm({ ...form, classification: e.target.value })} placeholder="Operating" />
            </Field>
            <Field label="Account Purpose">
              <Input value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} />
            </Field>
            <Field className="sm:col-span-2" label="Notes">
              <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </Field>
          </div>
        </div>
      </Modal>

      <Drawer open={!!auditAccount} onClose={() => setAuditAccount(null)} title={auditAccount ? `Audit History — ${auditAccount.name}` : ""}>
        {auditAccount && (
          <div className="space-y-3">
            <div className="rounded-lg border border-u-line p-3 text-xs text-u-ink2 space-y-1">
              <p><span className="text-u-muted">ID:</span> {auditAccount.id}</p>
              <p><span className="text-u-muted">Institution:</span> {auditAccount.institution} · {auditAccount.maskedAccount}</p>
              <p><span className="text-u-muted">Type:</span> {auditAccount.accountType} · {auditAccount.classification}</p>
              <p><span className="text-u-muted">GL:</span> {auditAccount.glAccount} — {auditAccount.glAccountName}</p>
              <p><span className="text-u-muted">Opening:</span> {money(auditAccount.openingBalance)} as of {fmtDate(auditAccount.openingBalanceDate)}</p>
            </div>
            {state.audit.filter((e) => e.record === auditAccount.id).length === 0 && <p className="text-xs text-u-muted">No configuration changes recorded yet.</p>}
            {state.audit.filter((e) => e.record === auditAccount.id).map((e) => (
              <div key={e.id} className="rounded-lg border border-u-line p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-u-ink2">{e.action}</span>
                  <span className="text-[11px] text-u-muted">{fmtDateTime(e.at)}</span>
                </div>
                <p className="text-[11px] text-u-muted mt-1">{e.user}</p>
                <p className="text-[11px] text-u-muted mt-1">
                  <span className="text-u-muted">Before:</span> {e.before || "—"} <span className="text-u-muted">→ After:</span> {e.after || "—"}
                </p>
                {e.notes && <p className="text-[11px] text-u-muted mt-1">{e.notes}</p>}
              </div>
            ))}
          </div>
        )}
      </Drawer>
    </div>
  );
}
