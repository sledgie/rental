import { useEffect, useMemo, useState, type ChangeEvent, type DragEvent } from "react";
import {
  dateOffset,
  documentCategories,
  formatDate,
  formatMoney,
  type LeaseData,
  type PartyRole,
  type TenancyStatus,
} from "../leaseData";
import Icon from "./Icon";

export interface WizardParty {
  id: string;
  personId?: string;
  newPerson?: {
    name: string;
    email: string;
    phone: string;
    mailingAddress: string;
    isTenantRecord: boolean;
  };
  displayName: string;
  role: PartyRole;
  isSignatory: boolean;
  signatureStatus: "Not required" | "Pending";
  startDate: string;
  relationship: string;
  notes: string;
}

export interface WizardFile {
  file: File;
  title: string;
  category: (typeof documentCategories)[number];
  documentDate: string;
}

export interface LeaseWizardPayload {
  name: string;
  leaseType: string;
  tenancyStatus: TenancyStatus;
  status: string;
  startDate: string;
  endDate: string;
  notes: string;
  propertyId: string;
  units: { unitId: string; rent: number; notes: string }[];
  parties: WizardParty[];
  monthlyRent: number;
  rentDueDay: number;
  depositType: string;
  depositAmount: number;
  parkingFees: number;
  storageFees: number;
  utilities: string;
  rentIncreaseDetails: string;
  paymentMethod: string;
  paymentFrequency: string;
  financialNotes: string;
  files: WizardFile[];
}

interface LeaseWizardProps {
  data: LeaseData;
  unavailableUnitIds: Set<string>;
  onClose: () => void;
  onSave: (payload: LeaseWizardPayload, asDraft: boolean) => void;
}

const steps = ["Basic information", "Property & units", "People", "Financial terms", "Documents", "Review"];
const roleOptions: PartyRole[] = ["Main Tenant", "Co-Tenant", "Occupant", "Guarantor"];

function localName(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ");
}

export default function LeaseWizard({ data, unavailableUnitIds, onClose, onSave }: LeaseWizardProps) {
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [createNewPerson, setCreateNewPerson] = useState(false);
  const [partyDraft, setPartyDraft] = useState({
    personId: "",
    role: "Co-Tenant" as PartyRole,
    isSignatory: true,
    startDate: dateOffset(0),
    relationship: "",
    name: "",
    email: "",
    phone: "",
    mailingAddress: "",
  });
  const [form, setForm] = useState<LeaseWizardPayload>({
    name: "",
    leaseType: "Residential Fixed Term",
    tenancyStatus: "Fixed-term",
    status: "Pending Review",
    startDate: dateOffset(0),
    endDate: dateOffset(365),
    notes: "",
    propertyId: data.properties[0]?.id ?? "",
    units: [],
    parties: [],
    monthlyRent: 0,
    rentDueDay: 1,
    depositType: "Security deposit",
    depositAmount: 0,
    parkingFees: 0,
    storageFees: 0,
    utilities: "Tenant pays electricity and internet.",
    rentIncreaseDetails: "",
    paymentMethod: "Not recorded",
    paymentFrequency: "Monthly",
    financialNotes: "",
    files: [],
  });

  useEffect(() => {
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [onClose]);

  const selectedProperty = data.properties.find((property) => property.id === form.propertyId);
  const propertyUnits = data.units.filter((unit) => unit.propertyId === form.propertyId);
  const allocationTotal = form.units.reduce((total, unit) => total + unit.rent, 0);
  const hasFixedTerm = form.tenancyStatus === "Fixed-term";
  const availablePeople = useMemo(() => data.people.filter((person) => person.isTenantRecord && person.recordStatus !== "Archived"), [data.people]);
  const hasMainTenant = form.parties.some((party) => party.role === "Main Tenant");

  const update = <K extends keyof LeaseWizardPayload>(key: K, value: LeaseWizardPayload[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setError("");
  };

  const addParty = () => {
    const selectedPerson = data.people.find((person) => person.id === partyDraft.personId);
    const name = createNewPerson ? partyDraft.name.trim() : selectedPerson?.name;
    if (!name) {
      setError(createNewPerson ? "Enter a name for the new person." : "Select a person to add.");
      return;
    }
    if (partyDraft.role === "Main Tenant" && hasMainTenant) {
      setError("This lease already has a main tenant. Remove or change that role first.");
      return;
    }
    if (!createNewPerson && form.parties.some((party) => party.personId === partyDraft.personId)) {
      setError("This person is already linked to the draft lease.");
      return;
    }
    if (createNewPerson && (partyDraft.role === "Main Tenant" || partyDraft.role === "Co-Tenant") && !partyDraft.email.trim()) {
      setError("Add an email address for a new tenant record.");
      return;
    }
    if (createNewPerson && partyDraft.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(partyDraft.email.trim())) {
      setError("Enter a valid email address.");
      return;
    }

    const isTenantRecord = partyDraft.role !== "Occupant";
    const newParty: WizardParty = {
      id: `draft-party-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      personId: createNewPerson ? undefined : selectedPerson?.id,
      newPerson: createNewPerson
        ? {
            name,
            email: partyDraft.email.trim(),
            phone: partyDraft.phone.trim(),
            mailingAddress: partyDraft.mailingAddress.trim(),
            isTenantRecord,
          }
        : undefined,
      displayName: name,
      role: partyDraft.role,
      isSignatory: partyDraft.role === "Occupant" ? false : partyDraft.isSignatory,
      signatureStatus: partyDraft.role === "Occupant" || !partyDraft.isSignatory ? "Not required" : "Pending",
      startDate: partyDraft.startDate,
      relationship: partyDraft.relationship,
      notes: "",
    };
    update("parties", [...form.parties, newParty]);
    setPartyDraft((current) => ({ ...current, personId: "", name: "", email: "", phone: "", mailingAddress: "", relationship: "" }));
    setCreateNewPerson(false);
  };

  const receiveFiles = (files: FileList | File[]) => {
    const picked = Array.from(files).map((file) => ({
      file,
      title: localName(file.name),
      category: "Other" as (typeof documentCategories)[number],
      documentDate: dateOffset(0),
    }));
    update("files", [...form.files, ...picked]);
  };

  const toggleUnit = (unitId: string, marketRent: number) => {
    const exists = form.units.some((unit) => unit.unitId === unitId);
    update("units", exists ? form.units.filter((unit) => unit.unitId !== unitId) : [...form.units, { unitId, rent: marketRent, notes: "" }]);
  };

  const validateStep = (): boolean => {
    if (step === 0) {
      if (!form.name.trim()) return setError("Enter a lease name to continue."), false;
      if (!form.startDate) return setError("Choose a lease start date."), false;
      if (hasFixedTerm && !form.endDate) return setError("Choose an end date for this fixed-term lease."), false;
      if (hasFixedTerm && form.endDate && form.endDate < form.startDate) return setError("The fixed-term end date must be after the start date."), false;
    }
    if (step === 1) {
      if (!form.propertyId) return setError("Select a property."), false;
      if (form.units.length === 0) return setError("Assign at least one unit before creating a lease."), false;
      if (form.units.some((unit) => unit.rent < 0)) return setError("Unit rent allocations cannot be negative."), false;
    }
    if (step === 2 && !form.parties.some((party) => party.role === "Main Tenant")) {
      return setError("Add a main tenant before creating this lease."), false;
    }
    if (step === 3 && Number(form.monthlyRent || allocationTotal) <= 0) {
      return setError("Enter a contracted monthly rent greater than zero."), false;
    }
    if (step === 3 && (form.rentDueDay < 1 || form.rentDueDay > 31)) {
      return setError("Rent due day must be between 1 and 31."), false;
    }
    setError("");
    return true;
  };

  const next = () => {
    if (validateStep()) setStep((current) => Math.min(current + 1, steps.length - 1));
  };

  const createLease = () => {
    if (!validateStep()) return;
    for (let index = step + 1; index < steps.length - 1; index += 1) {
      if (index === 0 && (!form.name.trim() || !form.startDate || (hasFixedTerm && !form.endDate))) {
        setStep(0);
        setError("Complete the required basic information before creating the lease.");
        return;
      }
      if (index === 1 && form.units.length === 0) {
        setStep(1);
        setError("Assign at least one unit before creating a lease.");
        return;
      }
      if (index === 2 && !form.parties.some((party) => party.role === "Main Tenant")) {
        setStep(2);
        setError("Add a main tenant before creating this lease.");
        return;
      }
      if (index === 3 && Number(form.monthlyRent || allocationTotal) <= 0) {
        setStep(3);
        setError("Enter a contracted monthly rent greater than zero.");
        return;
      }
    }
    onSave({ ...form, endDate: hasFixedTerm ? form.endDate : "", monthlyRent: Number(form.monthlyRent || allocationTotal) }, false);
  };

  const saveDraft = () => {
    if (!form.name.trim()) {
      setError("Enter a lease name before saving this draft.");
      setStep(0);
      return;
    }
    onSave({ ...form, status: "Draft", endDate: hasFixedTerm ? form.endDate : "", monthlyRent: Number(form.monthlyRent || allocationTotal) }, true);
  };

  const onFileInput = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) receiveFiles(event.target.files);
    event.target.value = "";
  };

  const onDropFiles = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (event.dataTransfer.files.length) receiveFiles(event.dataTransfer.files);
  };

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="modal modal-wizard" role="dialog" aria-modal="true" aria-labelledby="wizard-title">
        <header className="modal-header wizard-header">
          <div>
            <div className="eyebrow">LEASE WORKSPACE / NEW AGREEMENT</div>
            <h2 id="wizard-title">Create lease</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close create lease form"><Icon name="close" /></button>
        </header>

        <div className="wizard-progress" aria-label={`Step ${step + 1} of ${steps.length}`}>
          {steps.map((label, index) => (
            <button key={label} className={`wizard-step ${index === step ? "is-current" : ""} ${index < step ? "is-complete" : ""}`} onClick={() => index < step && setStep(index)} disabled={index > step}>
              <span className="wizard-step-number">{index < step ? <Icon name="check" size={13} /> : `0${index + 1}`}</span>
              <span>{label}</span>
            </button>
          ))}
        </div>

        <div className="modal-body wizard-body">
          {error && <div className="form-error"><Icon name="alert" size={15} />{error}</div>}

          {step === 0 && (
            <div className="form-grid two-col">
              <div className="field field-span-2">
                <label htmlFor="lease-name">Lease name <span className="required-mark">*</span></label>
                <input id="lease-name" autoFocus placeholder="e.g. Smith Family - Main Floor Lease" value={form.name} onChange={(event) => update("name", event.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="lease-type">Lease type</label>
                <select id="lease-type" value={form.leaseType} onChange={(event) => { const leaseType = event.target.value; setForm((current) => ({ ...current, leaseType, tenancyStatus: leaseType === "Month-to-Month" ? "Periodic" : current.tenancyStatus === "Periodic" ? "Fixed-term" : current.tenancyStatus })); setError(""); }}>
                  <option>Residential Fixed Term</option><option>Month-to-Month</option><option>Commercial Fixed Term</option><option>Student Housing</option><option>Other</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="tenancy-status">Tenancy / legal status</label>
                <select id="tenancy-status" value={form.tenancyStatus} onChange={(event) => update("tenancyStatus", event.target.value as TenancyStatus)}><option>Fixed-term</option><option>Periodic</option><option>At will</option><option>Other</option></select>
              </div>
              <div className="field">
                <label htmlFor="lease-status">Workflow status</label>
                <select id="lease-status" value={form.status} onChange={(event) => update("status", event.target.value)}>
                  <option>Pending Review</option><option>Pending Signature</option><option>Active</option><option>Expiring</option>
                </select>
                <span className="field-hint">Workflow status is separate from physical occupancy.</span>
              </div>
              <div className="field">
                <label htmlFor="lease-start">Start date <span className="required-mark">*</span></label>
                <input id="lease-start" type="date" value={form.startDate} onChange={(event) => update("startDate", event.target.value)} />
              </div>
              {hasFixedTerm && <div className="field">
                <label htmlFor="lease-end">Fixed-term end date <span className="required-mark">*</span></label>
                <input id="lease-end" type="date" value={form.endDate} onChange={(event) => update("endDate", event.target.value)} />
              </div>}
              {!hasFixedTerm && <div className="field field-note"><Icon name="clock" size={16} /><span>This tenancy status has no fixed end date. Notice and renewal rules can be configured for the applicable jurisdiction.</span></div>}
              <div className="field field-span-2">
                <label htmlFor="lease-notes">Internal notes</label>
                <textarea id="lease-notes" rows={3} placeholder="Add context for your team" value={form.notes} onChange={(event) => update("notes", event.target.value)} />
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="wizard-section">
              <div className="form-grid two-col wizard-select-row">
                <div className="field">
                  <label htmlFor="property-select">Property <span className="required-mark">*</span></label>
                  <select id="property-select" value={form.propertyId} onChange={(event) => { update("propertyId", event.target.value); update("units", []); }}>
                    {data.properties.map((property) => <option key={property.id} value={property.id}>{property.name} - {property.address}</option>)}
                  </select>
                </div>
                <div className="selected-property-note"><Icon name="building" size={16} /><span>{selectedProperty ? `${selectedProperty.address}, ${selectedProperty.city}` : "Choose a property to see units."}</span></div>
              </div>
              <div className="section-intro-row"><div><h3>Available units</h3><p>Select one or more units. Allocations form the rent total unless you enter a separate agreed amount.</p></div><span className="quiet-count">{form.units.length} selected</span></div>
              <div className="unit-picker-list">
                {propertyUnits.map((unit) => {
                  const selected = form.units.find((item) => item.unitId === unit.id);
                  const blocked = unavailableUnitIds.has(unit.id) && !selected;
                  const property = data.properties.find((item) => item.id === unit.propertyId);
                  return <div className={`unit-picker-row ${selected ? "selected" : ""} ${blocked ? "blocked" : ""}`} key={unit.id}>
                    <label className="unit-choice">
                      <input type="checkbox" checked={Boolean(selected)} disabled={blocked} onChange={() => toggleUnit(unit.id, unit.marketRent)} />
                      <span className="checkmark"></span>
                      <span className="unit-choice-copy"><strong>{property?.name} | {unit.number}</strong><small>{unit.type} <span className="dot-separator">|</span> {blocked ? "Assigned to another active lease" : `Market rent ${formatMoney(unit.marketRent)}`}</small></span>
                    </label>
                    {selected && <div className="allocation-input"><label htmlFor={`rent-${unit.id}`}>Monthly allocation</label><div className="money-input"><span>$</span><input id={`rent-${unit.id}`} type="number" min="0" value={selected.rent} onChange={(event) => update("units", form.units.map((item) => item.unitId === unit.id ? { ...item, rent: Number(event.target.value) } : item))} /></div></div>}
                  </div>;
                })}
                {propertyUnits.length === 0 && <div className="empty-inline">No units are attached to this property yet.</div>}
              </div>
              <div className="allocation-total"><span>Allocated monthly rent</span><strong>{formatMoney(allocationTotal)}</strong></div>
            </div>
          )}

          {step === 2 && (
            <div className="wizard-section">
              <div className="section-intro-row people-intro"><div><h3>Lease parties</h3><p>Use a separate relationship for every tenant, occupant, and guarantor.</p></div><span className="quiet-count">{form.parties.length} people</span></div>
              <div className="party-draft-form">
                <div className="party-form-heading"><span className="step-mini-number">01</span><div><strong>Add someone to this lease</strong><small>Occupants are not automatically tenants or financially responsible.</small></div></div>
                <div className="form-grid three-col">
                  <div className="field">
                    <label htmlFor="party-role">Role</label>
                    <select id="party-role" value={partyDraft.role} onChange={(event) => setPartyDraft((current) => ({ ...current, role: event.target.value as PartyRole, isSignatory: event.target.value !== "Occupant" }))}>
                      {roleOptions.map((role) => <option key={role}>{role}</option>)}
                    </select>
                  </div>
                  <div className="field field-span-2">
                    <label htmlFor="party-person">Person record</label>
                    {!createNewPerson ? <select id="party-person" value={partyDraft.personId} onChange={(event) => setPartyDraft((current) => ({ ...current, personId: event.target.value }))}>
                      <option value="">Select an existing person...</option>
                      {availablePeople.map((person) => <option key={person.id} value={person.id}>{person.name} - {person.email}</option>)}
                    </select> : <input id="party-person" value={partyDraft.name} onChange={(event) => setPartyDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Full name" />}
                  </div>
                  {createNewPerson && <>
                    <div className="field"><label htmlFor="new-party-email">Email</label><input id="new-party-email" type="email" value={partyDraft.email} onChange={(event) => setPartyDraft((current) => ({ ...current, email: event.target.value }))} placeholder="name@email.com" /></div>
                    <div className="field"><label htmlFor="new-party-phone">Phone</label><input id="new-party-phone" value={partyDraft.phone} onChange={(event) => setPartyDraft((current) => ({ ...current, phone: event.target.value }))} placeholder="(207) 555-0123" /></div>
                    <div className="field"><label htmlFor="new-party-address">Mailing address</label><input id="new-party-address" value={partyDraft.mailingAddress} onChange={(event) => setPartyDraft((current) => ({ ...current, mailingAddress: event.target.value }))} placeholder="Street, city, state" /></div>
                  </>}
                  {partyDraft.role === "Occupant" && <div className="field"><label htmlFor="party-relationship">Relationship</label><input id="party-relationship" value={partyDraft.relationship} onChange={(event) => setPartyDraft((current) => ({ ...current, relationship: event.target.value }))} placeholder="e.g. Child, caregiver" /></div>}
                  <div className="field"><label htmlFor="party-start">Occupancy / relationship start</label><input id="party-start" type="date" value={partyDraft.startDate} onChange={(event) => setPartyDraft((current) => ({ ...current, startDate: event.target.value }))} /></div>
                  {partyDraft.role !== "Occupant" && <label className="check-field"><input type="checkbox" checked={partyDraft.isSignatory} onChange={(event) => setPartyDraft((current) => ({ ...current, isSignatory: event.target.checked }))} /><span className="checkmark"></span><span>Required to sign this agreement</span></label>}
                </div>
                <div className="party-form-actions"><button className="text-button" onClick={() => { setCreateNewPerson((current) => !current); setPartyDraft((current) => ({ ...current, personId: "", name: "", email: "", phone: "", mailingAddress: "" })); }}>{createNewPerson ? "Choose an existing person" : "+ Create new person record"}</button><button className="button button-small button-secondary" onClick={addParty}><Icon name="plus" size={15} /> Add to lease</button></div>
              </div>
              {form.parties.length > 0 ? <div className="draft-party-list">{form.parties.map((party) => <div key={party.id} className="draft-party-row"><span className={`role-dot role-${party.role.toLowerCase().replace(/[^a-z]+/g, "-")}`}></span><div><strong>{party.displayName}</strong><small>{party.role}{party.role === "Occupant" ? " | not a tenant record" : party.isSignatory ? " | signatory" : " | not required to sign"}</small></div><button className="icon-button quiet-icon" aria-label={`Remove ${party.displayName}`} onClick={() => update("parties", form.parties.filter((item) => item.id !== party.id))}><Icon name="close" size={16} /></button></div>)}</div> : <div className="empty-inline">No people added yet. Add a main tenant and any co-tenants or occupants.</div>}
            </div>
          )}

          {step === 3 && (
            <div className="wizard-section">
              <div className="form-grid three-col">
                <div className="field field-span-2"><label htmlFor="agreed-rent">Contracted monthly rent <span className="required-mark">*</span></label><div className="money-input money-input-large"><span>$</span><input id="agreed-rent" type="number" min="0" value={form.monthlyRent || allocationTotal} onChange={(event) => update("monthlyRent", Number(event.target.value))} /></div><span className="field-hint">Unit allocation total: {formatMoney(allocationTotal)}. This is contract value, not rent received.</span></div>
                <div className="field"><label htmlFor="rent-due">Rent due day</label><input id="rent-due" type="number" min="1" max="31" value={form.rentDueDay} onChange={(event) => update("rentDueDay", Number(event.target.value))} /></div>
                <div className="field"><label htmlFor="deposit-type">Deposit type</label><select id="deposit-type" value={form.depositType} onChange={(event) => update("depositType", event.target.value)}><option>Security deposit</option><option>Last month's rent</option><option>Pet deposit</option><option>Other</option><option>Not applicable</option><option>Not set</option></select><span className="field-hint">Confirm local rules before collecting a deposit.</span></div>
                <div className="field"><label htmlFor="deposit-amount">Deposit amount</label><div className="money-input"><span>$</span><input id="deposit-amount" type="number" min="0" value={form.depositAmount} onChange={(event) => update("depositAmount", Number(event.target.value))} /></div></div>
                <div className="field"><label htmlFor="parking-fee">Parking fees / month</label><div className="money-input"><span>$</span><input id="parking-fee" type="number" min="0" value={form.parkingFees} onChange={(event) => update("parkingFees", Number(event.target.value))} /></div></div>
                <div className="field"><label htmlFor="storage-fee">Storage fees / month</label><div className="money-input"><span>$</span><input id="storage-fee" type="number" min="0" value={form.storageFees} onChange={(event) => update("storageFees", Number(event.target.value))} /></div></div>
                <div className="field"><label htmlFor="payment-frequency">Payment frequency</label><select id="payment-frequency" value={form.paymentFrequency} onChange={(event) => update("paymentFrequency", event.target.value)}><option>Monthly</option><option>Weekly</option><option>Bi-weekly</option><option>Quarterly</option><option>Other</option></select></div>
                <div className="field"><label htmlFor="payment-method">Payment method</label><select id="payment-method" value={form.paymentMethod} onChange={(event) => update("paymentMethod", event.target.value)}><option>Not recorded</option><option>ACH transfer</option><option>Check</option><option>Online portal</option><option>Other</option></select></div>
                <div className="field field-span-3"><label htmlFor="utilities">Utilities arrangement</label><input id="utilities" value={form.utilities} onChange={(event) => update("utilities", event.target.value)} /></div>
                <div className="field field-span-3"><label htmlFor="rent-increase">Rent increase details</label><textarea id="rent-increase" rows={2} value={form.rentIncreaseDetails} onChange={(event) => update("rentIncreaseDetails", event.target.value)} placeholder="Effective date, approval, or notice requirements" /></div>
                <div className="field field-span-3"><label htmlFor="financial-notes">Financial notes</label><textarea id="financial-notes" rows={2} value={form.financialNotes} onChange={(event) => update("financialNotes", event.target.value)} /></div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="wizard-section">
              <div className="storage-callout"><Icon name="upload" size={17} /><div><strong>Simulated storage</strong><span>Files are represented in this browser session only. No documents are uploaded to a server.</span></div></div>
              <div className="dropzone wizard-dropzone" onDragOver={(event) => event.preventDefault()} onDrop={onDropFiles}>
                <div className="upload-symbol"><Icon name="upload" size={20} /></div><div><strong>Drop files here to attach</strong><span>Multiple PDF, Word, image, or other files can be selected.</span></div>
                <label className="button button-small button-secondary file-browse">Browse files<input type="file" multiple onChange={onFileInput} /></label>
              </div>
              {form.files.length > 0 ? <div className="wizard-file-list">{form.files.map((item, index) => <div className="wizard-file-row" key={`${item.file.name}-${index}`}><div className="file-type-icon"><Icon name="file" size={17} /></div><div className="wizard-file-name"><strong>{item.title}</strong><small>{item.file.name} | {(item.file.size / 1024).toFixed(0)} KB</small></div><select aria-label={`Category for ${item.title}`} value={item.category} onChange={(event) => update("files", form.files.map((entry, i) => i === index ? { ...entry, category: event.target.value as WizardFile["category"] } : entry))}>{documentCategories.map((category) => <option key={category}>{category}</option>)}</select><input className="wizard-file-date" aria-label={`Document date for ${item.title}`} type="date" value={item.documentDate} onChange={(event) => update("files", form.files.map((entry, i) => i === index ? { ...entry, documentDate: event.target.value } : entry))} /><button className="icon-button quiet-icon" aria-label={`Remove ${item.title}`} onClick={() => update("files", form.files.filter((_, i) => i !== index))}><Icon name="close" size={15} /></button></div>)}</div> : <div className="empty-inline">No files attached. Documents can be added after the lease is created.</div>}
            </div>
          )}

          {step === 5 && (
            <div className="wizard-section review-summary">
              <div className="review-topline"><div><span className="eyebrow">READY FOR REVIEW</span><h3>{form.name || "Untitled lease"}</h3></div><span className="status-badge status-draft">{form.status}</span></div>
              <div className="review-grid">
                <div><span>Lease type / tenancy status</span><strong>{form.leaseType} / {form.tenancyStatus}</strong></div><div><span>Term</span><strong>{formatDate(form.startDate)} - {hasFixedTerm ? formatDate(form.endDate) : "No fixed end"}</strong></div>
                <div><span>Property / units</span><strong>{selectedProperty?.name || "No property"}{form.units.length ? ` | ${form.units.map((unit) => data.units.find((item) => item.id === unit.unitId)?.number).filter(Boolean).join(", ")}` : ""}</strong></div>
                <div><span>Contracted monthly rent</span><strong>{formatMoney(form.monthlyRent || allocationTotal)}</strong></div>
                <div><span>People</span><strong>{form.parties.map((party) => party.displayName).join(", ") || "No parties added"}</strong></div>
                <div><span>Documents</span><strong>{form.files.length} attached for simulated storage</strong></div>
              </div>
              <div className="review-note"><Icon name="alert" size={16} /><span>Creating this lease updates only the prototype's client-side state. Signatures, notices, and file storage are not connected to external services.</span></div>
            </div>
          )}
        </div>

        <footer className="modal-footer wizard-footer">
          <div className="wizard-footer-left">{step > 0 && <button className="button button-ghost" onClick={() => { setError(""); setStep((current) => current - 1); }}><Icon name="chevronLeft" size={16} /> Back</button>}{step === 0 && <button className="button button-ghost" onClick={onClose}>Cancel</button>}</div>
          <div className="wizard-footer-right"><button className="button button-secondary" onClick={saveDraft}><Icon name="file" size={15} /> Save as draft</button>{step < steps.length - 1 ? <button className="button button-primary" onClick={next}>Continue <Icon name="chevronRight" size={16} /></button> : <button className="button button-primary" onClick={createLease}><Icon name="check" size={16} /> Create lease</button>}</div>
        </footer>
      </section>
    </div>
  );
}