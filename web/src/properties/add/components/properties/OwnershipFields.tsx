import { useState } from "react";
import { FileText, Paperclip, Plus, Trash2, UserPlus, X } from "lucide-react";
import { Field } from "../ui/Field";
import { Input, Select } from "../ui/Input";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { useToast } from "../ui/Toast";
import { useAppStore } from "../../store/AppStore";
import type { Owner, OwnershipType } from "../../types/property";
import type { SectionProps } from "./PropertyFormSection";

export function OwnershipFields({ form, set, errors }: SectionProps) {
  const { owners, addOwner, staff, managementCompanies, addManagementCompany } = useAppStore();
  const { toast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [newOwner, setNewOwner] = useState({ name: "", type: "individual" as Owner["type"], email: "", phone: "" });
  const [ownerErr, setOwnerErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [companyOpen, setCompanyOpen] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [companyErr, setCompanyErr] = useState<string | null>(null);

  const isJoint = form.ownershipType === "joint";

  const createOwner = async () => {
    if (!newOwner.name.trim()) {
      setOwnerErr("Owner name is required.");
      return;
    }
    if (newOwner.email && !/^\S+@\S+\.\S+$/.test(newOwner.email)) {
      setOwnerErr("Enter a valid email address.");
      return;
    }
    const owner: Owner = {
      id: `own-${Date.now().toString(36)}`,
      name: newOwner.name.trim(),
      type: newOwner.type,
      email: newOwner.email.trim(),
      phone: newOwner.phone.trim() || undefined,
    };
    setSaving(true);
    try {
      // with Supabase the saved owner comes back with its real id
      const saved = await addOwner(owner);
      set("ownerId", saved.id);
      setModalOpen(false);
      setNewOwner({ name: "", type: "individual", email: "", phone: "" });
      setOwnerErr(null);
      toast("success", "Owner created", `${saved.name} was added and linked to this property.`);
    } catch (error) {
      setOwnerErr(error instanceof Error ? error.message : "Unable to create the owner.");
    } finally {
      setSaving(false);
    }
  };

  const createCompany = async () => {
    if (!companyName.trim()) {
      setCompanyErr("Company name is required.");
      return;
    }
    setSaving(true);
    try {
      const saved = await addManagementCompany(companyName.trim());
      set("managementCompanyId", saved.id);
      setCompanyOpen(false);
      setCompanyName("");
      setCompanyErr(null);
      toast("success", "Management company created", `${saved.name} was added and linked to this property.`);
    } catch (error) {
      setCompanyErr(error instanceof Error ? error.message : "Unable to create the management company.");
    } finally {
      setSaving(false);
    }
  };

  const addShare = () => {
    set("ownerShares", [...form.ownerShares, { ownerId: "", percentage: "" }]);
  };

  const updateShare = (idx: number, key: "ownerId" | "percentage", value: string) => {
    const next = form.ownerShares.map((s, i) => (i === idx ? { ...s, [key]: value } : s));
    set("ownerShares", next);
  };

  const removeShare = (idx: number) => {
    set("ownerShares", form.ownerShares.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-x-5 gap-y-4 md:grid-cols-2">
        <Field
          label="Property Owner"
          htmlFor="ownerId"
          required
          error={errors.ownerId}
          hint="Properties reference an existing owner record — details stay in one place."
        >
          <div className="flex gap-2">
            <Select
              id="ownerId"
              value={form.ownerId}
              invalid={!!errors.ownerId}
              onChange={(e) => set("ownerId", e.target.value)}
            >
              <option value="">Select an owner…</option>
              {owners.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name} {o.type === "organization" ? "(Org)" : ""}
                </option>
              ))}
            </Select>
            <Button type="button" variant="outline" className="shrink-0" onClick={() => setModalOpen(true)}>
              <UserPlus size={15} /> New
            </Button>
          </div>
        </Field>

        <Field label="Ownership Type" htmlFor="ownershipType">
          <Select
            id="ownershipType"
            value={form.ownershipType}
            onChange={(e) => set("ownershipType", e.target.value as OwnershipType)}
          >
            <option value="">Select…</option>
            <option value="individual">Individual</option>
            <option value="joint">Joint Ownership</option>
            <option value="corporation">Corporation</option>
            <option value="other">Other</option>
          </Select>
        </Field>
      </div>

      {isJoint && (
        <div className="rounded-lg border border-moss-800 bg-moss-900/70 p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[13px] font-medium text-moss-300">Ownership Split</p>
            <Button type="button" variant="outline" size="sm" onClick={addShare}>
              <Plus size={13} /> Add Co-owner
            </Button>
          </div>
          {form.ownerShares.length === 0 ? (
            <p className="text-xs text-moss-500">
              Add each co-owner and their ownership percentage. Percentages should total 100%.
            </p>
          ) : (
            <div className="space-y-2">
              {form.ownerShares.map((share, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Select
                    aria-label={`Co-owner ${idx + 1}`}
                    value={share.ownerId}
                    onChange={(e) => updateShare(idx, "ownerId", e.target.value)}
                    className="flex-1"
                  >
                    <option value="">Select owner…</option>
                    {owners.map((o) => (
                      <option key={o.id} value={o.id}>{o.name}</option>
                    ))}
                  </Select>
                  <div className="relative w-28 shrink-0">
                    <Input
                      aria-label={`Ownership percentage ${idx + 1}`}
                      type="number"
                      min={0}
                      max={100}
                      value={share.percentage}
                      onChange={(e) => updateShare(idx, "percentage", e.target.value)}
                      placeholder="50"
                      className="pr-7"
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-moss-500">%</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeShare(idx)}
                    aria-label="Remove co-owner"
                    className="rounded-md p-2 text-moss-500 hover:bg-moss-800 hover:text-brick-400 transition-colors"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}
          {errors.ownerShares && <p className="mt-2 text-xs text-brick-400">{errors.ownerShares}</p>}
        </div>
      )}

      <div className="grid grid-cols-1 gap-x-5 gap-y-4 md:grid-cols-2">
        <Field label="Property Manager" htmlFor="propertyManagerId" hint="Optional — assign from existing staff.">
          <Select
            id="propertyManagerId"
            value={form.propertyManagerId}
            onChange={(e) => set("propertyManagerId", e.target.value)}
          >
            <option value="">Unassigned</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>{s.name} — {s.role}</option>
            ))}
          </Select>
        </Field>

        <Field label="Management Company" htmlFor="managementCompanyId">
          <div className="flex gap-2">
            <Select
              id="managementCompanyId"
              value={form.managementCompanyId}
              onChange={(e) => set("managementCompanyId", e.target.value)}
            >
              <option value="">None / self-managed</option>
              {managementCompanies.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </Select>
            <Button type="button" variant="outline" className="shrink-0" onClick={() => setCompanyOpen(true)}>
              <Plus size={15} /> New
            </Button>
          </div>
        </Field>

        <Field label="Management Start Date" htmlFor="managementStartDate">
          <Input
            id="managementStartDate"
            type="date"
            value={form.managementStartDate}
            onChange={(e) => set("managementStartDate", e.target.value)}
            className="[color-scheme:dark]"
          />
        </Field>

        <div className="hidden md:block" />

        <Field label="Emergency Contact Name" htmlFor="emergencyContactName">
          <Input
            id="emergencyContactName"
            value={form.emergencyContactName}
            onChange={(e) => set("emergencyContactName", e.target.value)}
            placeholder="e.g. On-call superintendent"
          />
        </Field>

        <Field label="Emergency Contact Phone" htmlFor="emergencyContactPhone" error={errors.emergencyContactPhone}>
          <Input
            id="emergencyContactPhone"
            type="tel"
            value={form.emergencyContactPhone}
            invalid={!!errors.emergencyContactPhone}
            onChange={(e) => set("emergencyContactPhone", e.target.value)}
            placeholder="e.g. +1 (416) 555-0100"
          />
        </Field>
      </div>

      <Field label="Management Agreement" hint="Attach the signed management agreement (simulated for this prototype).">
        {form.managementAgreementFile ? (
          <div className="flex items-center gap-3 rounded-lg border border-moss-700 bg-moss-900 px-3 py-2.5 max-w-md">
            <FileText size={16} className="shrink-0 text-mint-400" />
            <span className="flex-1 truncate text-sm text-moss-200">{form.managementAgreementFile}</span>
            <button
              type="button"
              aria-label="Remove agreement"
              onClick={() => set("managementAgreementFile", "")}
              className="text-moss-500 hover:text-brick-400"
            >
              <X size={15} />
            </button>
          </div>
        ) : (
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-moss-700 px-4 py-2.5 text-sm text-moss-400 transition-colors hover:border-mint-500/50 hover:text-moss-200">
            <Paperclip size={15} />
            Attach agreement document
            <input
              type="file"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) set("managementAgreementFile", f.name);
              }}
            />
          </label>
        )}
      </Field>

      {/* New owner modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Create New Owner"
        description="The owner record is stored once and can be linked to any property."
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={createOwner} disabled={saving}>{saving ? "Creating…" : "Create Owner"}</Button>
          </>
        }
      >
        <div className="space-y-4">
          {ownerErr && (
            <p className="rounded-lg border border-brick-600/40 bg-brick-500/10 px-3 py-2 text-xs text-brick-400">{ownerErr}</p>
          )}
          <Field label="Owner Name" htmlFor="newOwnerName" required>
            <Input
              id="newOwnerName"
              value={newOwner.name}
              onChange={(e) => setNewOwner({ ...newOwner, name: e.target.value })}
              placeholder="Full name or company name"
            />
          </Field>
          <Field label="Owner Type" htmlFor="newOwnerType">
            <Select
              id="newOwnerType"
              value={newOwner.type}
              onChange={(e) => setNewOwner({ ...newOwner, type: e.target.value as Owner["type"] })}
            >
              <option value="individual">Individual</option>
              <option value="organization">Organization</option>
            </Select>
          </Field>
          <Field label="Email" htmlFor="newOwnerEmail">
            <Input
              id="newOwnerEmail"
              type="email"
              value={newOwner.email}
              onChange={(e) => setNewOwner({ ...newOwner, email: e.target.value })}
              placeholder="owner@example.com"
            />
          </Field>
          <Field label="Phone" htmlFor="newOwnerPhone">
            <Input
              id="newOwnerPhone"
              type="tel"
              value={newOwner.phone}
              onChange={(e) => setNewOwner({ ...newOwner, phone: e.target.value })}
              placeholder="+1 (416) 555-0100"
            />
          </Field>
        </div>
      </Modal>

      {/* New management company modal */}
      <Modal
        open={companyOpen}
        onClose={() => setCompanyOpen(false)}
        title="Create Management Company"
        description="The company is stored once and can be linked to any property."
        footer={
          <>
            <Button variant="ghost" onClick={() => setCompanyOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={createCompany} disabled={saving}>{saving ? "Creating…" : "Create Company"}</Button>
          </>
        }
      >
        <div className="space-y-4">
          {companyErr && (
            <p className="rounded-lg border border-brick-600/40 bg-brick-500/10 px-3 py-2 text-xs text-brick-400">{companyErr}</p>
          )}
          <Field label="Company Name" htmlFor="newCompanyName" required>
            <Input
              id="newCompanyName"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="e.g. Maplewood Management Ltd."
            />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
