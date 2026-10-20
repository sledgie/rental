import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  dateOffset,
  documentCategories,
  formatDate,
  formatMoney,
  type FinancialTerms,
  type Lease,
  type LeaseData,
  type LeaseDocument,
  type LeaseParty,
  type LeaseRenewal,
  type LeaseStatus,
  type PartyRole,
  type SignatureStatus,
  type TenantRecord,
  type TenancyStatus,
  type Unit,
} from "../leaseData";
import Icon from "./Icon";
import StatusBadge from "./StatusBadge";

export function ModalFrame({
  title,
  kicker,
  children,
  footer,
  onClose,
  size = "",
}: {
  title: string;
  kicker?: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  size?: string;
}) {
  useEffect(() => {
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [onClose]);

  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className={`modal ${size}`} role="dialog" aria-modal="true" aria-label={title}>
      <header className="modal-header"><div>{kicker && <div className="eyebrow">{kicker}</div>}<h2>{title}</h2></div><button className="icon-button" onClick={onClose} aria-label="Close dialog"><Icon name="close" /></button></header>
      <div className="modal-body">{children}</div>
      {footer && <footer className="modal-footer">{footer}</footer>}
    </section>
  </div>;
}

const statuses: LeaseStatus[] = ["Draft", "Pending Review", "Pending Signature", "Active", "Expiring", "Expired", "Terminated", "Archived"];
const roles: PartyRole[] = ["Main Tenant", "Co-Tenant", "Occupant", "Guarantor"];

export interface LeaseEditValues {
  name: string;
  leaseType: string;
  tenancyStatus: TenancyStatus;
  status: LeaseStatus;
  startDate: string;
  endDate: string;
  renewalEligible: boolean;
  renewalDeadline: string;
  noticePeriodDays: number;
  notes: string;
  occupancyStatus: Lease["occupancyStatus"];
}

export function LeaseEditorModal({ lease, onSave, onClose }: { lease: Lease; onSave: (values: LeaseEditValues) => void; onClose: () => void }) {
  const [form, setForm] = useState<LeaseEditValues>({
    name: lease.name, leaseType: lease.leaseType, tenancyStatus: lease.tenancyStatus, status: lease.status, startDate: lease.startDate,
    endDate: lease.endDate ?? "", renewalEligible: lease.renewalEligible, renewalDeadline: lease.renewalDeadline ?? "",
    noticePeriodDays: lease.noticePeriodDays ?? 0, notes: lease.notes, occupancyStatus: lease.occupancyStatus,
  });
  const [error, setError] = useState("");
  const hasFixedTerm = form.tenancyStatus === "Fixed-term";
  const save = () => {
    if (!form.name.trim()) return setError("Lease name is required.");
    if (!form.startDate && form.status !== "Draft") return setError("Add a start date before moving this lease out of draft.");
    if (hasFixedTerm && !form.endDate && form.status !== "Draft") return setError("A fixed-term tenancy needs an end date.");
    if (hasFixedTerm && form.startDate && form.endDate && form.endDate < form.startDate) return setError("The end date must be after the lease start date.");
    onSave({ ...form, endDate: hasFixedTerm ? form.endDate : "" });
  };
  return <ModalFrame title="Edit lease details" kicker={lease.leaseNumber} onClose={onClose} size="modal-medium" footer={<><button className="button button-ghost" onClick={onClose}>Cancel</button><button className="button button-primary" onClick={save}><Icon name="check" size={15} /> Save changes</button></>}>
    {error && <div className="form-error"><Icon name="alert" size={15} />{error}</div>}
    <div className="form-grid two-col">
      <div className="field field-span-2"><label htmlFor="edit-lease-name">Lease name</label><input id="edit-lease-name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></div>
      <div className="field"><label htmlFor="edit-lease-type">Lease type</label><select id="edit-lease-type" value={form.leaseType} onChange={(event) => { const leaseType = event.target.value; setForm({ ...form, leaseType, tenancyStatus: leaseType === "Month-to-Month" ? "Periodic" : form.tenancyStatus === "Periodic" ? "Fixed-term" : form.tenancyStatus }); }}><option>Residential Fixed Term</option><option>Month-to-Month</option><option>Commercial Fixed Term</option><option>Student Housing</option><option>Other</option></select></div>
      <div className="field"><label htmlFor="edit-tenancy-status">Tenancy / legal status</label><select id="edit-tenancy-status" value={form.tenancyStatus} onChange={(event) => setForm({ ...form, tenancyStatus: event.target.value as TenancyStatus })}><option>Fixed-term</option><option>Periodic</option><option>At will</option><option>Other</option></select></div>
      <div className="field"><label htmlFor="edit-lease-status">Workflow status</label><select id="edit-lease-status" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as LeaseStatus })}>{statuses.map((status) => <option key={status}>{status}</option>)}</select></div>
      <div className="field"><label htmlFor="edit-lease-start">Start date</label><input id="edit-lease-start" type="date" value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} /></div>
      {hasFixedTerm && <div className="field"><label htmlFor="edit-lease-end">Fixed-term end date</label><input id="edit-lease-end" type="date" value={form.endDate} onChange={(event) => setForm({ ...form, endDate: event.target.value })} /></div>}
      <div className="field"><label htmlFor="edit-renewal-deadline">Renewal / notice deadline</label><input id="edit-renewal-deadline" type="date" value={form.renewalDeadline} onChange={(event) => setForm({ ...form, renewalDeadline: event.target.value })} /></div>
      <div className="field"><label htmlFor="edit-notice-period">Notice period (days)</label><input id="edit-notice-period" type="number" min="0" value={form.noticePeriodDays} onChange={(event) => setForm({ ...form, noticePeriodDays: Number(event.target.value) })} /></div>
      <div className="field"><label htmlFor="edit-occupancy">Physical occupancy status</label><select id="edit-occupancy" value={form.occupancyStatus} onChange={(event) => setForm({ ...form, occupancyStatus: event.target.value as Lease["occupancyStatus"] })}><option>Occupied</option><option>Vacant</option><option>Not yet occupied</option><option>Unknown</option></select><span className="field-hint">Occupancy status is distinct from the lease workflow status.</span></div>
      <label className="check-field field-span-2"><input type="checkbox" checked={form.renewalEligible} onChange={(event) => setForm({ ...form, renewalEligible: event.target.checked })} /><span className="checkmark"></span><span>Eligible for renewal under current configured rules</span></label>
      <div className="field field-span-2"><label htmlFor="edit-lease-notes">Internal notes</label><textarea id="edit-lease-notes" rows={4} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></div>
    </div>
  </ModalFrame>;
}

export function FinancialTermsModal({ terms, monthlyRent, onSave, onClose }: { terms: FinancialTerms; monthlyRent: number; onSave: (values: FinancialTerms) => void; onClose: () => void }) {
  const [form, setForm] = useState<FinancialTerms>({ ...terms, agreedMonthlyRent: monthlyRent, additionalCharges: terms.additionalCharges.map((item) => ({ ...item })) });
  const [error, setError] = useState("");
  const set = <K extends keyof FinancialTerms>(key: K, value: FinancialTerms[K]) => setForm((current) => ({ ...current, [key]: value }));
  const save = () => {
    if (form.agreedMonthlyRent !== undefined && form.agreedMonthlyRent < 0) return setError("Contract rent cannot be negative.");
    if (form.rentDueDay < 1 || form.rentDueDay > 31) return setError("Rent due day must be between 1 and 31.");
    if (form.depositAmount < 0 || form.parkingFees < 0 || form.storageFees < 0) return setError("Deposit and monthly fee values cannot be negative.");
    onSave(form);
  };
  return <ModalFrame title="Edit financial terms" kicker="CONTRACT TERMS ONLY" onClose={onClose} size="modal-medium" footer={<><button className="button button-ghost" onClick={onClose}>Cancel</button><button className="button button-primary" onClick={save}><Icon name="check" size={15} /> Save terms</button></>}>
    {error && <div className="form-error"><Icon name="alert" size={15} />{error}</div>}
    <div className="storage-callout compact-callout"><Icon name="wallet" size={15} /><span>Changes here update contracted terms only. Payments and balances remain in the Financials transaction records.</span></div>
    <div className="form-grid two-col">
      <div className="field"><label htmlFor="edit-contract-rent">Agreed monthly rent</label><div className="money-input"><span>$</span><input id="edit-contract-rent" type="number" min="0" value={form.agreedMonthlyRent ?? 0} onChange={(event) => set("agreedMonthlyRent", Number(event.target.value))} /></div></div>
      <div className="field"><label htmlFor="edit-rent-due-day">Rent due day</label><input id="edit-rent-due-day" type="number" min="1" max="31" value={form.rentDueDay} onChange={(event) => set("rentDueDay", Number(event.target.value))} /></div>
      <div className="field"><label htmlFor="edit-payment-frequency">Payment frequency</label><select id="edit-payment-frequency" value={form.paymentFrequency} onChange={(event) => set("paymentFrequency", event.target.value)}><option>Monthly</option><option>Weekly</option><option>Bi-weekly</option><option>Quarterly</option><option>Other</option></select></div>
      <div className="field"><label htmlFor="edit-payment-method">Payment method</label><select id="edit-payment-method" value={form.paymentMethod} onChange={(event) => set("paymentMethod", event.target.value)}><option>Not recorded</option><option>ACH transfer</option><option>Check</option><option>Online portal</option><option>Other</option></select></div>
      <div className="field"><label htmlFor="edit-deposit-type">Deposit type</label><select id="edit-deposit-type" value={form.depositType} onChange={(event) => set("depositType", event.target.value)}><option>Security deposit</option><option>Last month's rent</option><option>Pet deposit</option><option>Other</option><option>Not applicable</option><option>Not set</option></select></div>
      <div className="field"><label htmlFor="edit-deposit-amount">Deposit amount</label><div className="money-input"><span>$</span><input id="edit-deposit-amount" type="number" min="0" value={form.depositAmount} onChange={(event) => set("depositAmount", Number(event.target.value))} /></div></div>
      <label className="check-field field-span-2"><input type="checkbox" checked={form.depositPermitted ?? false} onChange={(event) => set("depositPermitted", event.target.checked)} /><span className="checkmark"></span><span>Mark this deposit type as reviewed for the applicable jurisdiction</span></label>
      <div className="field"><label htmlFor="edit-parking">Parking fee / month</label><div className="money-input"><span>$</span><input id="edit-parking" type="number" min="0" value={form.parkingFees} onChange={(event) => set("parkingFees", Number(event.target.value))} /></div></div>
      <div className="field"><label htmlFor="edit-storage">Storage fee / month</label><div className="money-input"><span>$</span><input id="edit-storage" type="number" min="0" value={form.storageFees} onChange={(event) => set("storageFees", Number(event.target.value))} /></div></div>
      <div className="field field-span-2"><label htmlFor="edit-utilities">Utilities arrangement</label><input id="edit-utilities" value={form.utilities} onChange={(event) => set("utilities", event.target.value)} /></div>
      <div className="field field-span-2"><label htmlFor="edit-effective-date">Effective date of current rent</label><input id="edit-effective-date" type="date" value={form.effectiveDate ?? ""} onChange={(event) => set("effectiveDate", event.target.value)} /></div>
      <div className="field field-span-2"><label htmlFor="edit-rent-increase">Rent increase details</label><textarea id="edit-rent-increase" rows={2} value={form.rentIncreaseDetails} onChange={(event) => set("rentIncreaseDetails", event.target.value)} /></div>
      <div className="field field-span-2"><div className="field-label-row"><label>Additional agreed charges</label><button className="text-button" onClick={() => set("additionalCharges", [...form.additionalCharges, { label: "", amount: 0 }])}>+ Add charge</button></div>
        {form.additionalCharges.length ? <div className="charge-editor-list">{form.additionalCharges.map((charge, index) => <div className="charge-editor-row" key={`${index}-${charge.label}`}><input aria-label={`Charge ${index + 1} description`} placeholder="Description" value={charge.label} onChange={(event) => set("additionalCharges", form.additionalCharges.map((item, i) => i === index ? { ...item, label: event.target.value } : item))} /><div className="money-input"><span>$</span><input aria-label={`Charge ${index + 1} amount`} type="number" min="0" value={charge.amount} onChange={(event) => set("additionalCharges", form.additionalCharges.map((item, i) => i === index ? { ...item, amount: Number(event.target.value) } : item))} /></div><button className="icon-button" aria-label={`Remove charge ${index + 1}`} onClick={() => set("additionalCharges", form.additionalCharges.filter((_, i) => i !== index))}><Icon name="close" size={14} /></button></div>)}</div> : <span className="field-hint">No additional charges.</span>}
      </div>
      <div className="field field-span-2"><label htmlFor="edit-financial-notes">Financial notes</label><textarea id="edit-financial-notes" rows={3} value={form.notes} onChange={(event) => set("notes", event.target.value)} /></div>
    </div>
  </ModalFrame>;
}

export interface PartyValues {
  personId?: string;
  newPerson?: Omit<TenantRecord, "id">;
  role: PartyRole;
  isPrimaryContact: boolean;
  isSignatory: boolean;
  signatureStatus: SignatureStatus;
  relationshipStartDate: string;
  relationshipEndDate: string;
  relationship: string;
  notes: string;
}

export function AddPartyModal({
  role,
  people,
  hasMainTenant,
  onSave,
  onClose,
}: {
  role: PartyRole;
  people: TenantRecord[];
  hasMainTenant: boolean;
  onSave: (values: PartyValues) => void;
  onClose: () => void;
}) {
  const initialRole: PartyRole = role === "Main Tenant" && hasMainTenant ? "Co-Tenant" : role;
  const [newRecord, setNewRecord] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    personId: "", name: "", email: "", phone: "", mailingAddress: "", role: initialRole,
    isSignatory: initialRole !== "Occupant", signatureStatus: "Pending" as SignatureStatus,
    startDate: dateOffset(0), endDate: "", relationship: "", notes: "",
  });
  const visiblePeople = people.filter((person) => person.recordStatus !== "Archived");
  const isTenant = form.role !== "Occupant";
  const save = () => {
    const selected = people.find((person) => person.id === form.personId);
    if (!newRecord && !selected) return setError("Select an existing person or create a new record.");
    if (newRecord && !form.name.trim()) return setError("Enter the person's full name.");
    if (newRecord && isTenant && !form.email.trim()) return setError("Add an email address for a new tenant or guarantor record.");
    if (newRecord && form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return setError("Enter a valid email address.");
    if (form.role === "Main Tenant" && hasMainTenant) return setError("A main tenant is already linked. Change the existing role first.");
    if (form.endDate && form.startDate && form.endDate < form.startDate) return setError("The relationship end date must be after its start date.");
    if (form.isSignatory && form.signatureStatus === "Not required") return setError("A signatory needs a signature status.");
    onSave({
      personId: newRecord ? undefined : form.personId,
      newPerson: newRecord ? { name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim(), mailingAddress: form.mailingAddress.trim(), recordStatus: "Active", isTenantRecord: isTenant } : undefined,
      role: form.role, isPrimaryContact: form.role === "Main Tenant", isSignatory: form.role === "Occupant" ? false : form.isSignatory,
      signatureStatus: form.role === "Occupant" || !form.isSignatory ? "Not required" : form.signatureStatus,
      relationshipStartDate: form.startDate, relationshipEndDate: form.endDate, relationship: form.relationship, notes: form.notes,
    });
  };
  return <ModalFrame title="Add person to lease" kicker="LEASE PARTY" onClose={onClose} size="modal-medium" footer={<><button className="button button-ghost" onClick={onClose}>Cancel</button><button className="button button-primary" onClick={save}><Icon name="plus" size={15} /> Add to lease</button></>}>
    {error && <div className="form-error"><Icon name="alert" size={15} />{error}</div>}
    <div className="form-grid two-col">
      <div className="field"><label htmlFor="party-modal-role">Role</label><select id="party-modal-role" value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as PartyRole, isSignatory: event.target.value !== "Occupant" })}>{roles.map((option) => <option key={option}>{option}</option>)}</select></div>
      <div className="field"><label htmlFor="party-modal-person">Person</label>{!newRecord ? <select id="party-modal-person" value={form.personId} onChange={(event) => setForm({ ...form, personId: event.target.value })}><option value="">Choose an existing record...</option>{visiblePeople.map((person) => <option key={person.id} value={person.id}>{person.name} | {person.email || "No email"}</option>)}</select> : <input id="party-modal-person" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Full name" />}</div>
      {newRecord && <>
        <div className="field"><label htmlFor="party-modal-email">Email {isTenant && <span className="required-mark">*</span>}</label><input id="party-modal-email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="name@email.com" /></div>
        <div className="field"><label htmlFor="party-modal-phone">Phone</label><input id="party-modal-phone" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="(207) 555-0123" /></div>
        <div className="field field-span-2"><label htmlFor="party-modal-address">Mailing address</label><input id="party-modal-address" value={form.mailingAddress} onChange={(event) => setForm({ ...form, mailingAddress: event.target.value })} placeholder="Street, city, state, ZIP" /></div>
      </>}
      <div className="field"><label htmlFor="party-modal-start">Relationship / occupancy start</label><input id="party-modal-start" type="date" value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} /></div>
      <div className="field"><label htmlFor="party-modal-end">Relationship / occupancy end</label><input id="party-modal-end" type="date" value={form.endDate} onChange={(event) => setForm({ ...form, endDate: event.target.value })} /></div>
      {form.role === "Occupant" && <div className="field field-span-2"><label htmlFor="party-modal-relationship">Relationship to main tenant</label><input id="party-modal-relationship" value={form.relationship} onChange={(event) => setForm({ ...form, relationship: event.target.value })} placeholder="e.g. Child, caregiver, family member" /></div>}
      {form.role !== "Occupant" && <>
        <label className="check-field"><input type="checkbox" checked={form.isSignatory} onChange={(event) => setForm({ ...form, isSignatory: event.target.checked })} /><span className="checkmark"></span><span>Required to sign agreement</span></label>
        {form.isSignatory && <div className="field"><label htmlFor="party-modal-signature">Signature status</label><select id="party-modal-signature" value={form.signatureStatus} onChange={(event) => setForm({ ...form, signatureStatus: event.target.value as SignatureStatus })}><option>Pending</option><option>Signed</option><option>Declined</option></select></div>}
      </>}
      <div className="field field-span-2"><label htmlFor="party-modal-notes">Relationship notes</label><textarea id="party-modal-notes" rows={2} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder={form.role === "Occupant" ? "Occupancy notes; not a financial responsibility assignment." : "Optional internal notes"} /></div>
    </div>
    <button className="text-button create-record-toggle" onClick={() => { setNewRecord((current) => !current); setForm({ ...form, personId: "", name: "", email: "", phone: "", mailingAddress: "" }); setError(""); }}>{newRecord ? "Select an existing person record" : "+ Create a new tenant / person record"}</button>
    {form.role === "Occupant" && <div className="legal-config-note occupant-note"><Icon name="people" size={15} /><span>Occupants can have contact details without being treated as tenant signatories or financially responsible parties.</span></div>}
  </ModalFrame>;
}

export interface PartyEditValues {
  role: PartyRole;
  isPrimaryContact: boolean;
  isSignatory: boolean;
  signatureStatus: SignatureStatus;
  relationshipStartDate: string;
  relationshipEndDate: string;
  relationship: string;
  notes: string;
}

export function PartyEditorModal({ party, personName, hasOtherMain, onSave, onClose }: { party: LeaseParty; personName: string; hasOtherMain: boolean; onSave: (values: PartyEditValues) => void; onClose: () => void }) {
  const [form, setForm] = useState<PartyEditValues>({ role: party.role, isPrimaryContact: party.isPrimaryContact, isSignatory: party.isSignatory, signatureStatus: party.signatureStatus, relationshipStartDate: party.relationshipStartDate, relationshipEndDate: party.relationshipEndDate ?? "", relationship: party.relationship ?? "", notes: party.notes });
  const [error, setError] = useState("");
  const save = () => {
    if (form.role === "Main Tenant" && hasOtherMain) return setError("Another main tenant is already linked to this lease.");
    if (form.relationshipEndDate && form.relationshipStartDate && form.relationshipEndDate < form.relationshipStartDate) return setError("The relationship end date must be after its start date.");
    onSave({ ...form, isPrimaryContact: form.role === "Main Tenant" || form.isPrimaryContact, isSignatory: form.role === "Occupant" ? false : form.isSignatory, signatureStatus: form.role === "Occupant" || !form.isSignatory ? "Not required" : form.signatureStatus });
  };
  return <ModalFrame title="Edit lease relationship" kicker={personName} onClose={onClose} size="modal-small" footer={<><button className="button button-ghost" onClick={onClose}>Cancel</button><button className="button button-primary" onClick={save}>Save relationship</button></>}>
    {error && <div className="form-error"><Icon name="alert" size={15} />{error}</div>}
    <div className="form-grid">
      <div className="field"><label htmlFor="edit-party-role">Role</label><select id="edit-party-role" value={form.role} onChange={(event) => { const role = event.target.value as PartyRole; setForm({ ...form, role, isPrimaryContact: role === "Main Tenant" ? true : form.role === "Main Tenant" ? false : form.isPrimaryContact, isSignatory: role !== "Occupant" }); }}>{roles.map((role) => <option key={role}>{role}</option>)}</select></div>
      <div className="field"><label htmlFor="edit-party-start">Relationship start</label><input id="edit-party-start" type="date" value={form.relationshipStartDate} onChange={(event) => setForm({ ...form, relationshipStartDate: event.target.value })} /></div>
      <div className="field"><label htmlFor="edit-party-end">Relationship end</label><input id="edit-party-end" type="date" value={form.relationshipEndDate} onChange={(event) => setForm({ ...form, relationshipEndDate: event.target.value })} /></div>
      {form.role === "Occupant" && <div className="field"><label htmlFor="edit-party-relation">Relationship to main tenant</label><input id="edit-party-relation" value={form.relationship} onChange={(event) => setForm({ ...form, relationship: event.target.value })} /></div>}
      {form.role !== "Occupant" && <>
        <label className="check-field"><input type="checkbox" checked={form.isSignatory} onChange={(event) => setForm({ ...form, isSignatory: event.target.checked })} /><span className="checkmark"></span><span>Required to sign</span></label>
        {form.isSignatory && <div className="field"><label htmlFor="edit-party-signature">Signature status</label><select id="edit-party-signature" value={form.signatureStatus} onChange={(event) => setForm({ ...form, signatureStatus: event.target.value as SignatureStatus })}><option>Pending</option><option>Signed</option><option>Declined</option></select></div>}
      </>}
      <div className="field"><label htmlFor="edit-party-notes">Notes</label><textarea id="edit-party-notes" rows={3} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></div>
    </div>
  </ModalFrame>;
}

export function AddUnitModal({ options, currentTotal, onSave, onClose }: { options: { unit: Unit; propertyName: string }[]; currentTotal: number; onSave: (unitId: string, rent: number, notes: string, agreedTotal: number) => void; onClose: () => void }) {
  const [unitId, setUnitId] = useState(options[0]?.unit.id ?? "");
  const selected = options.find((item) => item.unit.id === unitId)?.unit;
  const [rent, setRent] = useState(selected?.marketRent ?? 0);
  const [agreedTotal, setAgreedTotal] = useState(currentTotal + (selected?.marketRent ?? 0));
  const [totalEdited, setTotalEdited] = useState(false);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const selectUnit = (value: string) => {
    const next = options.find((item) => item.unit.id === value)?.unit;
    setUnitId(value);
    setRent(next?.marketRent ?? 0);
    if (!totalEdited) setAgreedTotal(currentTotal + (next?.marketRent ?? 0));
  };
  const save = () => {
    if (!unitId) return setError("Select an available unit.");
    if (rent < 0 || agreedTotal < 0) return setError("Rent values cannot be negative.");
    onSave(unitId, rent, notes, agreedTotal);
  };
  return <ModalFrame title="Add unit to lease" kicker="UNIT RELATIONSHIP" onClose={onClose} size="modal-small" footer={<><button className="button button-ghost" onClick={onClose}>Cancel</button><button className="button button-primary" disabled={!options.length} onClick={save}><Icon name="plus" size={15} /> Add unit</button></>}>
    {error && <div className="form-error"><Icon name="alert" size={15} />{error}</div>}
    {!options.length ? <div className="empty-state small-empty"><Icon name="building" size={20} /><strong>No available units</strong><span>All units are assigned to an active lease or already linked here.</span></div> : <div className="form-grid">
      <div className="field"><label htmlFor="add-unit-select">Property / unit</label><select id="add-unit-select" value={unitId} onChange={(event) => selectUnit(event.target.value)}>{options.map(({ unit, propertyName }) => <option key={unit.id} value={unit.id}>{propertyName} | Unit {unit.number} | {unit.type}</option>)}</select></div>
      <div className="field"><label htmlFor="add-unit-allocation">Allocated monthly rent</label><div className="money-input"><span>$</span><input id="add-unit-allocation" type="number" min="0" value={rent} onChange={(event) => { const value = Number(event.target.value); setRent(value); if (!totalEdited) setAgreedTotal(currentTotal + value); }} /></div></div>
      <div className="field"><label htmlFor="add-unit-total">New agreed contract total</label><div className="money-input"><span>$</span><input id="add-unit-total" type="number" min="0" value={agreedTotal} onChange={(event) => { setAgreedTotal(Number(event.target.value)); setTotalEdited(true); }} /></div><span className="field-hint">Updated once for this lease; unit allocations are not added twice.</span></div>
      <div className="field"><label htmlFor="add-unit-notes">Unit-specific notes</label><textarea id="add-unit-notes" rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} /></div>
    </div>}
  </ModalFrame>;
}

function dateFrom(value: string, days: number) {
  if (!value) return dateOffset(days);
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export interface RenewalValues {
  type: "Renewal" | "Amendment";
  proposedStartDate: string;
  proposedEndDate: string;
  proposedRent: number;
  effectiveDate: string;
  reminderDate: string;
  status: LeaseRenewal["status"];
  relatedDocumentIds: string[];
  notes: string;
}

export function RenewalModal({ lease, type, monthlyRent, documents, onSave, onClose }: { lease: Lease; type: "Renewal" | "Amendment"; monthlyRent: number; documents: LeaseDocument[]; onSave: (values: RenewalValues) => void; onClose: () => void }) {
  const firstDate = lease.endDate ? dateFrom(lease.endDate, 1) : dateFrom(lease.startDate, 365);
  const [form, setForm] = useState<RenewalValues>({ type, proposedStartDate: type === "Renewal" ? firstDate : "", proposedEndDate: lease.endDate ? dateFrom(lease.endDate, 366) : "", proposedRent: monthlyRent, effectiveDate: firstDate, reminderDate: lease.renewalDeadline ?? "", status: "Draft", relatedDocumentIds: [], notes: "" });
  const [error, setError] = useState("");
  const save = () => {
    if (form.proposedRent < 0) return setError("Proposed rent cannot be negative.");
    if (form.proposedEndDate && form.proposedStartDate && form.proposedEndDate < form.proposedStartDate) return setError("The proposed end date must be after the start date.");
    if (form.type === "Renewal" && !form.proposedStartDate) return setError("Add a proposed renewal start date.");
    onSave(form);
  };
  return <ModalFrame title={`Create ${type.toLowerCase()} draft`} kicker={`${lease.leaseNumber} | ORIGINAL TERMS PRESERVED`} onClose={onClose} size="modal-medium" footer={<><button className="button button-ghost" onClick={onClose}>Cancel</button><button className="button button-primary" onClick={save}><Icon name="filePlus" size={15} /> Save draft</button></>}>
    {error && <div className="form-error"><Icon name="alert" size={15} />{error}</div>}
    <div className="storage-callout compact-callout"><Icon name="history" size={15} /><span>The original signed agreement is not changed. This creates a linked draft record for proposed terms.</span></div>
    <div className="form-grid two-col">
      <div className="field"><label htmlFor="renewal-type">Change type</label><select id="renewal-type" value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as RenewalValues["type"] })}><option>Renewal</option><option>Amendment</option></select></div>
      <div className="field"><label htmlFor="renewal-status">Approval / signature workflow</label><select id="renewal-status" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as RenewalValues["status"] })}><option>Draft</option><option>Pending Review</option><option>Pending Signature</option><option>Approved</option></select></div>
      <div className="field"><label htmlFor="renewal-start">Proposed new start date</label><input id="renewal-start" type="date" value={form.proposedStartDate} onChange={(event) => setForm({ ...form, proposedStartDate: event.target.value })} /></div>
      <div className="field"><label htmlFor="renewal-end">Proposed new end date</label><input id="renewal-end" type="date" value={form.proposedEndDate} onChange={(event) => setForm({ ...form, proposedEndDate: event.target.value })} /><span className="field-hint">Leave blank for periodic / no fixed end terms.</span></div>
      <div className="field"><label htmlFor="renewal-rent">Proposed monthly rent</label><div className="money-input"><span>$</span><input id="renewal-rent" type="number" min="0" value={form.proposedRent} onChange={(event) => setForm({ ...form, proposedRent: Number(event.target.value) })} /></div></div>
      <div className="field"><label htmlFor="renewal-effective">Effective date of changes</label><input id="renewal-effective" type="date" value={form.effectiveDate} onChange={(event) => setForm({ ...form, effectiveDate: event.target.value })} /></div>
      <div className="field"><label htmlFor="renewal-reminder">Reminder date</label><input id="renewal-reminder" type="date" value={form.reminderDate} onChange={(event) => setForm({ ...form, reminderDate: event.target.value })} /></div>
      <div className="field field-span-2"><label>Related renewal / amendment documents</label>{documents.length ? <div className="document-check-list">{documents.map((document) => <label className="check-field" key={document.id}><input type="checkbox" checked={form.relatedDocumentIds.includes(document.id)} onChange={(event) => setForm({ ...form, relatedDocumentIds: event.target.checked ? [...form.relatedDocumentIds, document.id] : form.relatedDocumentIds.filter((id) => id !== document.id) })} /><span className="checkmark"></span><span>{document.title} <small>{document.category}</small></span></label>)}</div> : <span className="field-hint">No lease documents available to link. Upload documents from the Documents tab.</span>}</div>
      <div className="field field-span-2"><label htmlFor="renewal-notes">Notes and proposed terms</label><textarea id="renewal-notes" rows={3} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Approval notes, conditions, and proposed changes" /></div>
    </div>
  </ModalFrame>;
}

export interface DocumentMetadataValues {
  title: string;
  category: (typeof documentCategories)[number];
  documentDate: string;
  expiryDate: string;
  status: LeaseDocument["status"];
  signatureStatus: SignatureStatus;
  notes: string;
}

export function DocumentMetadataModal({ document, onSave, onClose }: { document: LeaseDocument; onSave: (values: DocumentMetadataValues) => void; onClose: () => void }) {
  const [form, setForm] = useState<DocumentMetadataValues>({ title: document.title, category: document.category, documentDate: document.documentDate ?? "", expiryDate: document.expiryDate ?? "", status: document.status, signatureStatus: document.signatureStatus, notes: document.notes });
  const [error, setError] = useState("");
  const documentStatuses: LeaseDocument["status"][] = ["Draft", "Awaiting Signature", "Active", "Superseded", "Archived", "Expired", ...(document.status === "Signed" ? ["Signed" as const] : [])];
  const save = () => {
    if (!form.title.trim()) return setError("Document title is required.");
    if (form.expiryDate && form.documentDate && form.expiryDate < form.documentDate) return setError("The expiry date must be after the document date.");
    onSave({ ...form, title: form.title.trim() });
  };
  return <ModalFrame title="Edit document metadata" kicker={document.originalFileName} onClose={onClose} size="modal-small" footer={<><button className="button button-ghost" onClick={onClose}>Cancel</button><button className="button button-primary" onClick={save}><Icon name="check" size={15} /> Save metadata</button></>}>
    {error && <div className="form-error"><Icon name="alert" size={15} />{error}</div>}
    <div className="storage-callout compact-callout"><Icon name="file" size={15} /><span>Document metadata is stored in the current browser session. Binary file storage is simulated.</span></div>
    <div className="form-grid">
      <div className="field"><label htmlFor="doc-title">Document title</label><input id="doc-title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></div>
      <div className="field"><label htmlFor="doc-category">Category</label><select id="doc-category" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value as DocumentMetadataValues["category"] })}>{documentCategories.map((category) => <option key={category}>{category}</option>)}</select></div>
      <div className="field"><label htmlFor="doc-status">Document status</label><select id="doc-status" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as LeaseDocument["status"] })}>{documentStatuses.map((status) => <option key={status}>{status}</option>)}</select></div>
      <div className="field"><label htmlFor="doc-signature-status">Signature status</label><select id="doc-signature-status" value={form.signatureStatus} disabled={document.signatureStatus === "Signed"} onChange={(event) => setForm({ ...form, signatureStatus: event.target.value as SignatureStatus })}>{document.signatureStatus === "Signed" ? <option>Signed</option> : <><option>Not required</option><option>Pending</option><option>Declined</option></>}</select>{document.signatureStatus !== "Signed" && <span className="field-hint">Use "Record signed outside app" to add a date and signatory details.</span>}</div>
      <div className="field"><label htmlFor="doc-date">Document date</label><input id="doc-date" type="date" value={form.documentDate} onChange={(event) => setForm({ ...form, documentDate: event.target.value })} /></div>
      <div className="field"><label htmlFor="doc-expiry">Expiry date</label><input id="doc-expiry" type="date" value={form.expiryDate} onChange={(event) => setForm({ ...form, expiryDate: event.target.value })} /></div>
      <div className="field"><label>File type / size</label><div className="readonly-field">{document.fileType || "Unknown type"} | {document.fileSize ? `${Math.ceil(document.fileSize / 1024)} KB` : "Size unavailable"}</div></div>
      <div className="field"><label>Version / uploaded by</label><div className="readonly-field">v{document.versionNumber} | {document.uploadedBy}</div></div>
      <div className="field"><label htmlFor="doc-notes">Notes</label><textarea id="doc-notes" rows={3} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></div>
    </div>
  </ModalFrame>;
}

export function SignatureModal({ document, onSave, onClose }: { document: LeaseDocument; onSave: (date: string, signatory: string) => void; onClose: () => void }) {
  const [date, setDate] = useState(dateOffset(0));
  const [signatory, setSignatory] = useState("");
  const [error, setError] = useState("");
  return <ModalFrame title="Record signed document" kicker="EXTERNAL SIGNATURE RECORD" onClose={onClose} size="modal-small" footer={<><button className="button button-ghost" onClick={onClose}>Cancel</button><button className="button button-primary" onClick={() => { if (!signatory.trim()) return setError("Enter the signatory name or names."); onSave(date, signatory.trim()); }}><Icon name="check" size={15} /> Record signature</button></>}>
    <div className="signature-warning"><Icon name="alert" size={17} /><div><strong>This does not create an electronic signature.</strong><span>Record a signature completed outside this prototype. No signing integration is connected.</span></div></div>
    {error && <div className="form-error"><Icon name="alert" size={15} />{error}</div>}
    <div className="form-grid"><div className="field"><label>Document</label><div className="readonly-field">{document.title} | v{document.versionNumber}</div></div><div className="field"><label htmlFor="signed-date">Signature date</label><input id="signed-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} /></div><div className="field"><label htmlFor="signed-by">Signatory name(s)</label><input id="signed-by" value={signatory} onChange={(event) => setSignatory(event.target.value)} placeholder="Enter signatory name(s)" /></div></div>
  </ModalFrame>;
}

export function ConfirmationModal({ title, message, confirmLabel = "Confirm", destructive = false, onConfirm, onClose }: { title: string; message: string; confirmLabel?: string; destructive?: boolean; onConfirm: () => void; onClose: () => void }) {
  return <ModalFrame title={title} kicker="CONFIRM ACTION" onClose={onClose} size="modal-small" footer={<><button className="button button-ghost" onClick={onClose}>Cancel</button><button className={`button ${destructive ? "button-danger" : "button-primary"}`} onClick={onConfirm}>{confirmLabel}</button></>}>
    <div className={`confirmation-symbol ${destructive ? "confirmation-danger" : ""}`}><Icon name={destructive ? "alert" : "help"} size={20} /></div><p className="confirmation-copy">{message}</p>
  </ModalFrame>;
}

export function PersonProfileModal({ person, data, onClose }: { person: TenantRecord; data: LeaseData; onClose: () => void }) {
  const relationships = data.parties.filter((party) => party.personId === person.id);
  return <ModalFrame title={person.name} kicker="PERSON PROFILE" onClose={onClose} size="modal-small" footer={<button className="button button-primary" onClick={onClose}>Close profile</button>}>
    <div className="profile-hero"><span className="profile-avatar">{person.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span><div><strong>{person.name}</strong><StatusBadge status={person.isTenantRecord ? person.recordStatus : "Not a tenant record"}>{person.isTenantRecord ? person.recordStatus : "Occupant record"}</StatusBadge></div></div>
    <div className="profile-fields"><div><span>Email</span><strong>{person.email || "Not recorded"}</strong></div><div><span>Phone</span><strong>{person.phone || "Not recorded"}</strong></div><div><span>Mailing address</span><strong>{person.mailingAddress || "Not recorded"}</strong></div><div><span>Linked lease relationships</span><strong>{relationships.length || "None"}</strong></div></div>
    {relationships.length > 0 && <div className="profile-lease-list"><span>LEASE LINKS</span>{relationships.map((party) => { const lease = data.leases.find((item) => item.id === party.leaseId); return <div key={party.id}><strong>{lease?.leaseNumber}</strong><span>{lease?.name} | {party.role}</span></div>; })}</div>}
    <div className="legal-config-note"><Icon name="link" size={15} /><span>Removing a person from a lease does not delete this underlying record.</span></div>
  </ModalFrame>;
}

export function TransactionModal({ transaction, onClose }: { transaction: LeaseData["transactions"][number]; onClose: () => void }) {
  return <ModalFrame title="Financial transaction" kicker={transaction.sourceReference} onClose={onClose} size="modal-small" footer={<button className="button button-primary" onClick={onClose}>Close record</button>}>
    <div className="transaction-detail-amount"><span>{transaction.description}</span><strong className={transaction.amount < 0 ? "amount-credit" : ""}>{transaction.amount < 0 ? "-" : ""}{formatMoney(Math.abs(transaction.amount))}</strong><StatusBadge status={transaction.status}>{transaction.status}</StatusBadge></div>
    <div className="profile-fields"><div><span>Transaction ID</span><strong>{transaction.id}</strong></div><div><span>Date</span><strong>{formatDate(transaction.date)}</strong></div><div><span>Type</span><strong>{transaction.type}</strong></div><div><span>Source</span><strong>{transaction.sourceReference}</strong></div></div>
    <div className="legal-config-note"><Icon name="wallet" size={15} /><span>This is a view of an existing financial record. No duplicate charge or payment was created.</span></div>
  </ModalFrame>;
}

export function DocumentHistoryModal({ document, allDocuments, onPreview, onClose }: { document: LeaseDocument; allDocuments: LeaseDocument[]; onPreview: (id: string) => void; onClose: () => void }) {
  const versions = useMemo(() => allDocuments.filter((item) => item.versionGroupId === document.versionGroupId).sort((a, b) => a.versionNumber - b.versionNumber), [allDocuments, document.versionGroupId]);
  return <ModalFrame title="Document version history" kicker={document.title} onClose={onClose} size="modal-small" footer={<button className="button button-primary" onClick={onClose}>Done</button>}>
    <p className="modal-intro">Previous versions and their metadata are retained. Replacing a signed agreement never silently overwrites it.</p>
    <div className="version-history-list">{versions.map((version) => <div className={`version-history-item ${version.id === document.id ? "version-current" : ""}`} key={version.id}><span className="version-indicator">v{version.versionNumber}</span><div><strong>{version.title}</strong><small>{version.originalFileName} | {formatDate(version.uploadedAt)} | {version.uploadedBy}</small><div className="version-meta"><StatusBadge status={version.status}>{version.status}</StatusBadge>{version.signatureStatus === "Signed" && <span>Signed {formatDate(version.signedDate)}{version.signedBy ? ` by ${version.signedBy}` : ""}</span>}{version.notes && <span>{version.notes}</span>}</div></div><button className="icon-button" title="Preview this version" aria-label={`Preview version ${version.versionNumber}`} onClick={() => onPreview(version.id)}><Icon name="eye" size={15} /></button></div>)}</div>
  </ModalFrame>;
}

export function DocumentPreviewModal({ document, onClose }: { document: LeaseDocument; onClose: () => void }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (!document.file) { setUrl(""); return; }
    const objectUrl = URL.createObjectURL(document.file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [document]);
  const supported = document.file && (document.file.type === "application/pdf" || document.file.type.startsWith("image/"));
  return <ModalFrame title={document.title} kicker={`PREVIEW | VERSION ${document.versionNumber}`} onClose={onClose} size="modal-preview" footer={<><span className="preview-storage-note">Simulated file | {document.originalFileName}</span><button className="button button-secondary" onClick={onClose}>Close preview</button></>}>
    {supported && url ? document.file?.type.startsWith("image/") ? <div className="document-preview-image"><img src={url} alt={document.title} /></div> : <iframe className="document-preview-frame" title={`Preview ${document.title}`} src={url} /> : <div className="preview-unavailable"><span className="preview-file-symbol"><Icon name="file" size={26} /></span><h3>Preview unavailable</h3><p>{document.file ? "This file type is not supported for in-browser preview." : "This sample document has simulated metadata but no stored binary file."}</p><div className="preview-file-meta"><span>File name</span><strong>{document.originalFileName}</strong><span>Type / size</span><strong>{document.fileType || "Unknown"} | {document.fileSize ? `${Math.ceil(document.fileSize / 1024)} KB` : "No binary stored"}</strong><span>Storage reference</span><strong>{document.storageReference}</strong></div></div>}
  </ModalFrame>;
}