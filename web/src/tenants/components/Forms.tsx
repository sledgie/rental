import { useRef, useState, type ReactNode } from "react";
import {
  AlertCircle,
  Building2,
  Check,
  ChevronDown,
  Info,
  Plus,
  Upload,
  UserRound,
} from "lucide-react";
import type {
  Database,
  LeaseAssociation,
  NewLeaseInput,
  PartyRole,
  Tenant,
  TenantInput,
  TenantStatus,
} from "../types";
import {
  accountFinancials,
  fullName,
  leaseStatus,
  leaseUnitLinks,
  money,
  today,
} from "../lib/domain";
import { Avatar, Button, Overlay } from "./ui";

type FormErrors = Record<string, string>;
const emptyLease = (): NewLeaseInput => ({
  startDate: today(),
  endDate: `${Number(today().slice(0, 4)) + 1}${today().slice(4)}`,
  rent: 0,
  deposit: 0,
  unitIds: [],
});
export const emptyAssociation = (): LeaseAssociation => ({
  mode: "none",
  role: "Main Tenant",
  isSignatory: true,
  unitIds: [],
});

function Field({
  label,
  id,
  children,
  error,
  optional,
  full = false,
}: {
  label: string;
  id: string;
  children: ReactNode;
  error?: string;
  optional?: boolean;
  full?: boolean;
}) {
  return (
    <div className={`form-field ${full ? "field-full" : ""}`}>
      <label htmlFor={id}>
        {label}
        {optional && <span>Optional</span>}
      </label>
      {children}
      {error && (
        <p className="field-error" id={`${id}-error`}>
          {error}
        </p>
      )}
    </div>
  );
}

function FormError({ message }: { message?: string }) {
  return message ? (
    <div className="form-error" role="alert">
      <AlertCircle size={16} />
      <span>{message}</span>
    </div>
  ) : null;
}

function UnitPicker({
  db,
  ids,
  selected,
  onChange,
}: {
  db: Database;
  ids: string[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  return (
    <div className="unit-picker" role="group" aria-label="Associated units">
      {!ids.length ? (
        <p className="muted">No units are available for these dates.</p>
      ) : (
        ids.map((id) => {
          const unit = db.units.find((u) => u.id === id)!;
          const property = db.properties.find((p) => p.id === unit.propertyId)!;
          return (
            <label
              key={id}
              className={`unit-choice ${selected.includes(id) ? "unit-choice-selected" : ""}`}
            >
              <input
                type="checkbox"
                checked={selected.includes(id)}
                onChange={(e) =>
                  onChange(
                    e.target.checked
                      ? [...selected, id]
                      : selected.filter((s) => s !== id),
                  )
                }
              />
              <Building2 size={17} />
              <span>
                <strong>Unit {unit.unitNumber}</strong>
                <small>{property.name}</small>
              </span>
              {selected.includes(id) && (
                <Check className="unit-choice-check" size={15} />
              )}
            </label>
          );
        })
      )}
    </div>
  );
}

function NewLeaseFields({
  db,
  value,
  onChange,
}: {
  db: Database;
  value: NewLeaseInput;
  onChange: (value: NewLeaseInput) => void;
}) {
  const available = db.units.filter(
    (u) =>
      !db.leaseUnits.some((lu) => {
        if (lu.unitId !== u.id) return false;
        const lease = db.leases.find((l) => l.id === lu.leaseId)!;
        return (
          lease.leaseStatus !== "Terminated" &&
          lease.startDate <= value.endDate &&
          lease.endDate >= value.startDate
        );
      }),
  );
  const changeDate = (key: "startDate" | "endDate", date: string) =>
    onChange({ ...value, [key]: date, unitIds: [] });
  return (
    <div className="form-grid lease-form-fields">
      <Field label="Start date" id="lease-start">
        <input
          id="lease-start"
          type="date"
          value={value.startDate}
          onChange={(e) => changeDate("startDate", e.target.value)}
          required
        />
      </Field>
      <Field label="End date" id="lease-end">
        <input
          id="lease-end"
          type="date"
          value={value.endDate}
          onChange={(e) => changeDate("endDate", e.target.value)}
          required
        />
      </Field>
      <Field label="Total monthly rent (CAD)" id="lease-rent">
        <input
          id="lease-rent"
          type="number"
          min="0.01"
          step="0.01"
          placeholder="0.00"
          value={value.rent || ""}
          onChange={(e) => onChange({ ...value, rent: Number(e.target.value) })}
          required
        />
      </Field>
      <Field label="Security deposit (CAD)" id="lease-deposit" optional>
        <input
          id="lease-deposit"
          type="number"
          min="0"
          step="0.01"
          placeholder="0.00"
          value={value.deposit || ""}
          onChange={(e) =>
            onChange({ ...value, deposit: Number(e.target.value) })
          }
        />
      </Field>
      <div className="field-full">
        <div className="field-label">Select units</div>
        <p className="field-hint">
          Available for this lease term. Rent is allocated equally across
          selected units.
        </p>
        <UnitPicker
          db={db}
          ids={available.map((u) => u.id)}
          selected={value.unitIds}
          onChange={(unitIds) => onChange({ ...value, unitIds })}
        />
      </div>
    </div>
  );
}

function AssociationEditor({
  db,
  value,
  onChange,
  tenantId,
  allowNone = true,
}: {
  db: Database;
  value: LeaseAssociation;
  onChange: (value: LeaseAssociation) => void;
  tenantId?: string;
  allowNone?: boolean;
}) {
  const availableLeases = db.leases.filter(
    (l) =>
      !["Expired", "Terminated"].includes(leaseStatus(l)) &&
      !db.leaseParties.some(
        (p) => p.leaseId === l.id && p.tenantId === tenantId,
      ),
  );
  const selectLease = (id: string) =>
    onChange({
      ...value,
      leaseId: id,
      role: db.leaseParties.some(
        (p) => p.leaseId === id && p.role === "Main Tenant",
      )
        ? "Co-Tenant"
        : "Main Tenant",
      unitIds: leaseUnitLinks(db, id).map((lu) => lu.unitId),
    });
  const options = [
    ...(allowNone ? [{ value: "none", label: "Assign later" }] : []),
    { value: "existing", label: "Existing lease" },
    { value: "new", label: "Create new lease" },
  ];
  return (
    <div className="association-editor">
      <div
        className="segmented-control"
        role="group"
        aria-label="Lease association"
      >
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={value.mode === option.value ? "selected" : ""}
            aria-pressed={value.mode === option.value}
            onClick={() =>
              onChange({
                ...value,
                mode: option.value as LeaseAssociation["mode"],
                role: option.value === "existing" ? "Co-Tenant" : "Main Tenant",
                ...(option.value === "new" && !value.newLease
                  ? { newLease: emptyLease() }
                  : {}),
              })
            }
          >
            {option.label}
          </button>
        ))}
      </div>
      {value.mode === "none" && (
        <div className="inline-info">
          <Info size={16} />
          <p>You can save this person now and associate a lease later.</p>
        </div>
      )}
      {value.mode === "existing" && (
        <div className="form-grid association-fields">
          <Field full label="Existing lease / household" id="existing-lease">
            <select
              id="existing-lease"
              value={value.leaseId ?? ""}
              onChange={(e) => selectLease(e.target.value)}
            >
              <option value="">Select a lease</option>
              {availableLeases.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.leaseNumber} -{" "}
                  {db.tenants
                    .filter((t) =>
                      db.leaseParties.some(
                        (p) =>
                          p.leaseId === l.id &&
                          p.tenantId === t.id &&
                          p.role === "Main Tenant",
                      ),
                    )
                    .map(fullName)
                    .join(", ") || "No main tenant"}{" "}
                  ({leaseStatus(l)})
                </option>
              ))}
            </select>
          </Field>
          {value.leaseId && (
            <div className="field-full">
              <div className="field-label">Units occupied by this person</div>
              <UnitPicker
                db={db}
                ids={leaseUnitLinks(db, value.leaseId).map((lu) => lu.unitId)}
                selected={value.unitIds}
                onChange={(unitIds) => onChange({ ...value, unitIds })}
              />
            </div>
          )}
        </div>
      )}
      {value.mode === "new" && (
        <NewLeaseFields
          db={db}
          value={value.newLease ?? emptyLease()}
          onChange={(newLease) => onChange({ ...value, newLease })}
        />
      )}
      {value.mode !== "none" && (
        <div className="form-grid role-fields">
          <Field label="Role on lease" id="lease-role">
            <select
              id="lease-role"
              value={value.role}
              onChange={(e) =>
                onChange({
                  ...value,
                  role: e.target.value as PartyRole,
                  isSignatory: e.target.value !== "Occupant",
                })
              }
            >
              <option>Main Tenant</option>
              <option>Co-Tenant</option>
              <option>Occupant</option>
            </select>
          </Field>
          <label className="checkbox-label signatory-checkbox">
            <input
              type="checkbox"
              checked={value.isSignatory}
              onChange={(e) =>
                onChange({ ...value, isSignatory: e.target.checked })
              }
            />
            <span>
              Lease signatory
              <small>Shares legal responsibility for this lease</small>
            </span>
          </label>
        </div>
      )}
    </div>
  );
}

function validateAssociation(
  value: LeaseAssociation,
  db: Database,
): string | undefined {
  if (value.mode === "existing") {
    if (!value.leaseId) return "Select an existing lease.";
    if (!value.unitIds.length)
      return "Select at least one unit for this person.";
    if (
      value.role === "Main Tenant" &&
      db.leaseParties.some(
        (p) =>
          p.leaseId === value.leaseId &&
          p.role === "Main Tenant" &&
          !p.effectiveEndDate,
      )
    )
      return "This lease already has a main tenant. Choose Co-Tenant or Occupant.";
  }
  if (value.mode === "new") {
    const lease = value.newLease;
    if (!lease?.startDate || !lease.endDate) return "Provide both lease dates.";
    if (lease.endDate <= lease.startDate)
      return "The lease end date must be after the start date.";
    if (!Number.isFinite(lease.rent) || lease.rent <= 0)
      return "Monthly rent must be greater than zero.";
    if (!Number.isFinite(lease.deposit) || lease.deposit < 0)
      return "Security deposit cannot be negative.";
    if (
      Math.round(lease.rent * 100) / 100 !== lease.rent ||
      Math.round(lease.deposit * 100) / 100 !== lease.deposit
    )
      return "Enter rent and deposit with no more than two decimal places.";
    if (!lease.unitIds.length) return "Select at least one available unit.";
  }
}

const validatePerson = (
  input: Pick<TenantInput, "firstName" | "lastName" | "phone" | "email">,
): FormErrors => {
  const errors: FormErrors = {};
  if (!input.firstName.trim()) errors.firstName = "First name is required.";
  if (!input.lastName.trim()) errors.lastName = "Last name is required.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim()))
    errors.email = "Enter a valid email address.";
  const phoneDigits = input.phone.replace(/\D/g, "");
  if (
    !/^[+\d\s().-]+$/.test(input.phone) ||
    phoneDigits.length < 10 ||
    phoneDigits.length > 15
  )
    errors.phone = "Enter a valid phone number (10-15 digits).";
  return errors;
};

export function TenantForm({
  db,
  tenant,
  onClose,
  onSave,
}: {
  db: Database;
  tenant?: Tenant;
  onClose: () => void;
  onSave: (
    input: TenantInput,
    association: LeaseAssociation,
    editingId?: string,
  ) => void;
}) {
  const [input, setInput] = useState<TenantInput>(() =>
    tenant
      ? { ...tenant }
      : {
          firstName: "",
          lastName: "",
          middleName: "",
          preferredName: "",
          phone: "",
          email: "",
          mailingAddress: "",
          emergencyContact: "",
          notes: "",
          tenantStatus: "Pending",
          classification: "Individual",
        },
  );
  const [association, setAssociation] =
    useState<LeaseAssociation>(emptyAssociation);
  const [errors, setErrors] = useState<FormErrors>({});
  const photoRef = useRef<HTMLInputElement>(null);
  const change = (key: keyof TenantInput, value: string) => {
    setInput((old) => ({ ...old, [key]: value }));
    setErrors((old) => ({ ...old, [key]: "" }));
  };
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const nextErrors = validatePerson(input);
    const associationError = !tenant
      ? validateAssociation(association, db)
      : undefined;
    if (associationError) nextErrors.form = associationError;
    if (input.dateOfBirth && input.dateOfBirth > today())
      nextErrors.dateOfBirth = "Date of birth cannot be in the future.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    try {
      onSave(
        {
          ...input,
          firstName: input.firstName.trim(),
          lastName: input.lastName.trim(),
          email: input.email.trim(),
          phone: input.phone.trim(),
        },
        association,
        tenant?.id,
      );
    } catch (error) {
      setErrors({
        form:
          error instanceof Error
            ? error.message
            : "Unable to save tenant. Please try again.",
      });
    }
  };
  const uploadPhoto = (file?: File) => {
    if (!file) return;
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 2 * 1024 * 1024
    ) {
      setErrors((old) => ({
        ...old,
        photo: "Choose a JPG, PNG, or WebP image under 2 MB.",
      }));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      change("photoUrl", String(reader.result));
      setErrors((old) => ({ ...old, photo: "" }));
    };
    reader.readAsDataURL(file);
  };
  return (
    <Overlay
      wide
      title={tenant ? "Edit tenant" : "Add tenant"}
      subtitle={
        tenant
          ? `Update the personal details for ${fullName(tenant)}.`
          : "A new person, a new place to call home."
      }
      onClose={onClose}
    >
      <form className="tenant-form" onSubmit={submit} noValidate>
        <div className="form-scroll">
          <section className="form-section">
            <div className="form-section-heading">
              <span className="form-section-icon">
                <UserRound size={17} />
              </span>
              <div>
                <h3>Personal information</h3>
                <p>Contact details for your tenant directory.</p>
              </div>
            </div>
            <div className="photo-upload">
              {input.photoUrl ? (
                <img
                  src={input.photoUrl}
                  className="uploaded-avatar"
                  alt="Tenant profile preview"
                />
              ) : tenant ? (
                <Avatar tenant={tenant} size="lg" />
              ) : (
                <div className="photo-placeholder">
                  <UserRound size={25} />
                </div>
              )}
              <div>
                <Button
                  className="button-small"
                  onClick={() => photoRef.current?.click()}
                >
                  <Upload size={14} />
                  Upload photo
                </Button>
                <small>JPG, PNG or WebP. Max 2 MB.</small>
              </div>
              <input
                ref={photoRef}
                type="file"
                aria-label="Profile photo"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => uploadPhoto(e.target.files?.[0])}
                hidden
              />
              {input.photoUrl && (
                <Button
                  variant="ghost"
                  className="button-small"
                  onClick={() => change("photoUrl", "")}
                >
                  Remove
                </Button>
              )}
            </div>
            {errors.photo && <p className="field-error">{errors.photo}</p>}
            <div className="form-grid">
              <Field
                label="First name"
                id="first-name"
                error={errors.firstName}
              >
                <input
                  id="first-name"
                  data-autofocus
                  autoComplete="given-name"
                  value={input.firstName}
                  onChange={(e) => change("firstName", e.target.value)}
                  placeholder="e.g. Sarah"
                  aria-invalid={!!errors.firstName}
                  aria-describedby={
                    errors.firstName ? "first-name-error" : undefined
                  }
                  required
                />
              </Field>
              <Field label="Last name" id="last-name" error={errors.lastName}>
                <input
                  id="last-name"
                  autoComplete="family-name"
                  value={input.lastName}
                  onChange={(e) => change("lastName", e.target.value)}
                  placeholder="e.g. Johnson"
                  aria-invalid={!!errors.lastName}
                  required
                />
              </Field>
              <Field
                label="Email address"
                id="tenant-email"
                error={errors.email}
              >
                <input
                  id="tenant-email"
                  type="email"
                  autoComplete="email"
                  value={input.email}
                  onChange={(e) => change("email", e.target.value)}
                  placeholder="name@example.com"
                  aria-invalid={!!errors.email}
                  required
                />
              </Field>
              <Field
                label="Phone number"
                id="tenant-phone"
                error={errors.phone}
              >
                <input
                  id="tenant-phone"
                  type="tel"
                  autoComplete="tel"
                  value={input.phone}
                  onChange={(e) => change("phone", e.target.value)}
                  placeholder="+1 (416) 555-0123"
                  aria-invalid={!!errors.phone}
                  required
                />
              </Field>
            </div>
            <details
              className="optional-fields"
              open={tenant ? true : undefined}
            >
              <summary>
                Additional personal details <span>Optional</span>
                <ChevronDown size={15} />
              </summary>
              <div className="form-grid">
                <Field label="Middle name" id="middle-name" optional>
                  <input
                    id="middle-name"
                    value={input.middleName ?? ""}
                    onChange={(e) => change("middleName", e.target.value)}
                  />
                </Field>
                <Field label="Preferred name" id="preferred-name" optional>
                  <input
                    id="preferred-name"
                    value={input.preferredName ?? ""}
                    onChange={(e) => change("preferredName", e.target.value)}
                  />
                </Field>
                <Field
                  label="Date of birth"
                  id="date-of-birth"
                  optional
                  error={errors.dateOfBirth}
                >
                  <input
                    id="date-of-birth"
                    type="date"
                    max={today()}
                    value={input.dateOfBirth ?? ""}
                    onChange={(e) => change("dateOfBirth", e.target.value)}
                  />
                </Field>
                <Field
                  label="Emergency contact"
                  id="emergency-contact"
                  optional
                >
                  <input
                    id="emergency-contact"
                    value={input.emergencyContact ?? ""}
                    onChange={(e) => change("emergencyContact", e.target.value)}
                    placeholder="Name and phone number"
                  />
                </Field>
                <Field
                  label="Mailing address"
                  id="mailing-address"
                  optional
                  full
                >
                  <input
                    id="mailing-address"
                    autoComplete="street-address"
                    value={input.mailingAddress ?? ""}
                    onChange={(e) => change("mailingAddress", e.target.value)}
                    placeholder="Street address, city, province, postal code"
                  />
                </Field>
                <Field label="Internal notes" id="internal-notes" optional full>
                  <textarea
                    id="internal-notes"
                    rows={3}
                    value={input.notes ?? ""}
                    onChange={(e) => change("notes", e.target.value)}
                    placeholder="Only visible to your property management team"
                  />
                </Field>
              </div>
            </details>
          </section>
          <section className="form-section">
            <div className="form-section-heading">
              <h3>Tenant relationship</h3>
            </div>
            <div className="form-grid">
              <Field label="Tenant status" id="tenant-status">
                <select
                  id="tenant-status"
                  value={input.tenantStatus}
                  onChange={(e) =>
                    change("tenantStatus", e.target.value as TenantStatus)
                  }
                >
                  {["Pending", "Active", "Inactive", "Former"].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </Field>
              <Field label="Classification" id="classification">
                <select
                  id="classification"
                  value={input.classification}
                  onChange={(e) => change("classification", e.target.value)}
                >
                  <option>Individual</option>
                  <option>Main tenant</option>
                </select>
              </Field>
            </div>
            <p className="field-hint">
              Tenant status describes this person's relationship with your
              portfolio, not their lease status.
            </p>
          </section>
          {!tenant && (
            <section className="form-section">
              <div className="form-section-heading">
                <div>
                  <h3>Lease association</h3>
                  <p>Connect a lease now, or come back to it later.</p>
                </div>
                <span className="optional-label">Optional</span>
              </div>
              <AssociationEditor
                db={db}
                value={association}
                onChange={setAssociation}
              />
            </section>
          )}
          <FormError message={errors.form} />
          {Object.keys(errors).some((k) => k !== "form" && errors[k]) && (
            <FormError message="Please review the highlighted fields before saving." />
          )}
        </div>
        <div className="form-footer">
          <span>
            <span className="required-dot" />
            Your changes stay in this workspace session.
          </span>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit">
            {tenant ? <Check size={15} /> : <Plus size={15} />}
            {tenant ? "Save changes" : "Add tenant"}
          </Button>
        </div>
      </form>
    </Overlay>
  );
}

export function AssociateLeaseForm({
  db,
  tenant,
  onClose,
  onSave,
}: {
  db: Database;
  tenant: Tenant;
  onClose: () => void;
  onSave: (association: LeaseAssociation) => void;
}) {
  const [association, setAssociation] = useState<LeaseAssociation>({
    ...emptyAssociation(),
    mode: "new",
    newLease: emptyLease(),
  });
  const [error, setError] = useState<string>();
  return (
    <Overlay
      wide
      title="Add a lease"
      subtitle={`Create or associate a lease for ${fullName(tenant)}.`}
      onClose={onClose}
    >
      <form
        className="tenant-form"
        onSubmit={(event) => {
          event.preventDefault();
          const issue = validateAssociation(association, db);
          if (issue) {
            setError(issue);
            return;
          }
          try {
            onSave(association);
          } catch (err) {
            setError(
              err instanceof Error
                ? err.message
                : "Could not associate this lease.",
            );
          }
        }}
        noValidate
      >
        <div className="form-scroll">
          <AssociationEditor
            db={db}
            value={association}
            onChange={setAssociation}
            tenantId={tenant.id}
            allowNone={false}
          />
          <FormError message={error} />
        </div>
        <div className="form-footer">
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit">
            <Plus size={15} />
            {association.mode === "new" ? "Create lease" : "Associate lease"}
          </Button>
        </div>
      </form>
    </Overlay>
  );
}

export interface PersonAssociationInput {
  existingTenantId?: string;
  newPerson?: TenantInput;
  leaseId: string;
  unitIds: string[];
  role: PartyRole;
  isSignatory: boolean;
}
export function AddPersonForm({
  db,
  tenant,
  onClose,
  onSave,
}: {
  db: Database;
  tenant: Tenant;
  onClose: () => void;
  onSave: (input: PersonAssociationInput) => void;
}) {
  const leases = db.leases.filter(
    (l) =>
      db.leaseParties.some(
        (p) => p.leaseId === l.id && p.tenantId === tenant.id,
      ) && !["Expired", "Terminated"].includes(leaseStatus(l)),
  );
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [leaseId, setLeaseId] = useState(leases[0]?.id ?? "");
  const [tenantId, setTenantId] = useState("");
  const [role, setRole] = useState<PartyRole>("Co-Tenant");
  const [isSignatory, setSignatory] = useState(true);
  const [unitIds, setUnitIds] = useState<string[]>(
    leaseUnitLinks(db, leases[0]?.id ?? "").map((lu) => lu.unitId),
  );
  const [person, setPerson] = useState<TenantInput>({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    classification: "Individual",
    tenantStatus: "Active",
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const candidates = db.tenants.filter(
    (t) =>
      !t.archivedAt &&
      !db.leaseParties.some(
        (p) => p.leaseId === leaseId && p.tenantId === t.id,
      ),
  );
  const changePerson = (field: keyof TenantInput, value: string) =>
    setPerson((old) => ({ ...old, [field]: value }));
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const issues = mode === "new" ? validatePerson(person) : {};
    if (!leaseId)
      issues.form =
        "Create or associate a current lease before adding a person.";
    else if (mode === "existing" && !tenantId)
      issues.form = "Choose an existing tenant record.";
    else if (!unitIds.length)
      issues.form = "Select at least one occupied unit.";
    setErrors(issues);
    if (Object.keys(issues).length) return;
    try {
      onSave({
        existingTenantId: mode === "existing" ? tenantId : undefined,
        newPerson: mode === "new" ? person : undefined,
        leaseId,
        unitIds,
        role,
        isSignatory,
      });
    } catch (err) {
      setErrors({
        form: err instanceof Error ? err.message : "Unable to add this person.",
      });
    }
  };
  return (
    <Overlay
      wide
      title="Add co-tenant or occupant"
      subtitle={`Connect a person to ${tenant.firstName}'s household without duplicating their record.`}
      onClose={onClose}
    >
      <form className="tenant-form" onSubmit={submit} noValidate>
        <div className="form-scroll">
          <Field label="Associated lease" id="person-lease">
            <select
              id="person-lease"
              value={leaseId}
              onChange={(e) => {
                setLeaseId(e.target.value);
                setTenantId("");
                setUnitIds(
                  leaseUnitLinks(db, e.target.value).map((lu) => lu.unitId),
                );
              }}
            >
              <option value="">Select a lease</option>
              {leases.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.leaseNumber} ({leaseStatus(l)})
                </option>
              ))}
            </select>
          </Field>
          <div className="segmented-control person-mode">
            <button
              type="button"
              className={mode === "existing" ? "selected" : ""}
              onClick={() => setMode("existing")}
            >
              Existing tenant record
            </button>
            <button
              type="button"
              className={mode === "new" ? "selected" : ""}
              onClick={() => setMode("new")}
            >
              Create a new person
            </button>
          </div>
          {mode === "existing" ? (
            <Field label="Select person" id="existing-person">
              <select
                id="existing-person"
                value={tenantId}
                onChange={(e) => setTenantId(e.target.value)}
              >
                <option value="">Choose a tenant</option>
                {candidates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {fullName(t)} - {t.tenantNumber}
                  </option>
                ))}
              </select>
              <p className="field-hint">
                People already on this lease are excluded.
              </p>
            </Field>
          ) : (
            <div className="form-grid">
              {(["firstName", "lastName", "email", "phone"] as const).map(
                (key) => (
                  <Field
                    key={key}
                    id={`person-${key}`}
                    label={
                      {
                        firstName: "First name",
                        lastName: "Last name",
                        email: "Email address",
                        phone: "Phone number",
                      }[key]
                    }
                    error={errors[key]}
                  >
                    <input
                      id={`person-${key}`}
                      type={
                        key === "email"
                          ? "email"
                          : key === "phone"
                            ? "tel"
                            : "text"
                      }
                      value={person[key]}
                      onChange={(e) => changePerson(key, e.target.value)}
                      required
                    />
                  </Field>
                ),
              )}
            </div>
          )}
          <div className="form-grid role-fields">
            <Field label="Relationship" id="person-role">
              <select
                id="person-role"
                value={role}
                onChange={(e) => {
                  setRole(e.target.value as PartyRole);
                  setSignatory(e.target.value !== "Occupant");
                }}
              >
                <option>Co-Tenant</option>
                <option>Occupant</option>
              </select>
            </Field>
            <label className="checkbox-label signatory-checkbox">
              <input
                type="checkbox"
                checked={isSignatory}
                onChange={(e) => setSignatory(e.target.checked)}
              />
              <span>
                Lease signatory
                <small>Legally responsible under the lease</small>
              </span>
            </label>
          </div>
          {leaseId && (
            <div className="form-section">
              <div className="field-label">Units occupied</div>
              <UnitPicker
                db={db}
                ids={leaseUnitLinks(db, leaseId).map((lu) => lu.unitId)}
                selected={unitIds}
                onChange={setUnitIds}
              />
            </div>
          )}
          <div className="inline-info">
            <Info size={16} />
            <p>
              Occupants can live in a unit without being lease signatories.
              Personal records are shared across all lease associations.
            </p>
          </div>
          <FormError message={errors.form} />
        </div>
        <div className="form-footer">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary">
            <Plus size={15} />
            Add person
          </Button>
        </div>
      </form>
    </Overlay>
  );
}

export function PaymentForm({
  db,
  tenant,
  onClose,
  onSave,
}: {
  db: Database;
  tenant: Tenant;
  onClose: () => void;
  onSave: (
    accountId: string,
    amount: number,
    date: string,
    description: string,
  ) => void;
}) {
  const accounts = db.accounts.filter((a) => a.tenantId === tenant.id);
  const initialAccount =
    accounts.find((a) => accountFinancials(db, a).outstanding > 0) ??
    accounts[0];
  const [accountId, setAccountId] = useState(initialAccount?.id ?? "");
  const [amount, setAmount] = useState(
    initialAccount
      ? String(accountFinancials(db, initialAccount).outstanding || "")
      : "",
  );
  const [date, setDate] = useState(today());
  const [method, setMethod] = useState("Bank transfer");
  const [reference, setReference] = useState("");
  const [error, setError] = useState("");
  return (
    <Overlay
      title="Record a payment"
      subtitle={`Post a payment to ${tenant.firstName}'s selected account.`}
      onClose={onClose}
    >
      <form
        className="tenant-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (
            !accountId ||
            !Number.isFinite(Number(amount)) ||
            Number(amount) < 0.01
          ) {
            setError(
              "Select an account and enter an amount greater than zero.",
            );
            return;
          }
          if (Math.round(Number(amount) * 100) / 100 !== Number(amount)) {
            setError(
              "Enter a payment amount with no more than two decimal places.",
            );
            return;
          }
          if (!date || date > today()) {
            setError("Choose a payment date on or before today.");
            return;
          }
          onSave(
            accountId,
            Number(amount),
            date,
            `${method}${reference ? ` - ${reference}` : ""}`,
          );
        }}
        noValidate
      >
        <div className="form-scroll">
          <div className="form-grid">
            <Field label="Billing account" id="payment-account" full>
              <select
                id="payment-account"
                value={accountId}
                onChange={(e) => {
                  setAccountId(e.target.value);
                  const account = accounts.find((a) => a.id === e.target.value);
                  setAmount(
                    account
                      ? String(accountFinancials(db, account).outstanding || "")
                      : "",
                  );
                }}
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.accountType}: {a.label} (
                    {money(accountFinancials(db, a).outstanding)} due)
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Amount (CAD)" id="payment-amount">
              <input
                id="payment-amount"
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                required
              />
            </Field>
            <Field label="Payment date" id="payment-date">
              <input
                id="payment-date"
                type="date"
                max={today()}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </Field>
            <Field label="Payment method" id="payment-method">
              <select
                id="payment-method"
                value={method}
                onChange={(e) => setMethod(e.target.value)}
              >
                <option>Bank transfer</option>
                <option>Interac e-Transfer</option>
                <option>Cheque</option>
                <option>Cash</option>
              </select>
            </Field>
            <Field label="Reference" id="payment-reference" optional>
              <input
                id="payment-reference"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="e.g. Transfer #12345"
              />
            </Field>
          </div>
          <div className="inline-info">
            <Info size={16} />
            <p>
              This payment will settle the oldest posted charges in this
              account. Any overpayment remains as credit in this account only.
            </p>
          </div>
          <FormError message={error} />
        </div>
        <div className="form-footer">
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit">
            <Check size={15} />
            Post payment
          </Button>
        </div>
      </form>
    </Overlay>
  );
}
