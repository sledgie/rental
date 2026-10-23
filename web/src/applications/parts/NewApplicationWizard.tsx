import { useMemo, useState } from "react";
import { useStore, nextApplicationNumber, propertyOf, unitOf } from "../state/store";
import {
  DOCUMENT_CATEGORIES,
  type ApplicationSource,
  type DocumentCategory,
  type PartyRole,
} from "../data/types";
import { currency, fileExt, fileSize, isoDay, addDays } from "../lib/format";
import { Badge, MockTag, UnitStatusBadge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Checkbox, Field, Input, Select, Textarea } from "../components/ui/Form";
import { Drawer } from "../components/ui/Overlay";
import { Info, InfoGrid } from "../components/ui/Misc";
import { IconCheck, IconFile, IconPlus, IconTrash, IconUpload, IconX } from "../components/icons";
import { cn } from "../utils/cn";

const STEPS = [
  { n: 1, label: "Property & Unit" },
  { n: 2, label: "Applicant" },
  { n: 3, label: "Co-Applicants & Occupants" },
  { n: 4, label: "Supporting Information" },
  { n: 5, label: "Documents" },
  { n: 6, label: "Review & Save" },
];

interface Draft {
  propertyId: string;
  unitId: string;
  moveIn: string;
  term: string;
  proposedRent: string;
  source: ApplicationSource;
  existingPerson: string;
  fullName: string;
  preferredName: string;
  email: string;
  phone: string;
  address: string;
  contact: string;
  employment: string;
  income: string;
  coApplicants: { id: string; fullName: string; email: string; phone: string; relationship: string; income: string }[];
  occupants: { id: string; fullName: string; relationship: string }[];
  occupantsTotal: string;
  parking: string;
  pets: string;
  preferences: string;
  references: { id: string; name: string; contact: string; relationship: string }[];
  creditAuth: boolean;
  idVerification: boolean;
  screeningConsent: boolean;
  notes: string;
  reviewer: string;
  docs: { id: string; title: string; category: DocumentCategory; fileName: string; fileSize: number; notes?: string; file?: File }[];
}

const emptyDraft = (): Draft => ({
  propertyId: "",
  unitId: "",
  moveIn: addDays(14),
  term: "12",
  proposedRent: "",
  source: "Website",
  existingPerson: "New applicant record",
  fullName: "",
  preferredName: "",
  email: "",
  phone: "",
  address: "",
  contact: "Email",
  employment: "",
  income: "",
  coApplicants: [],
  occupants: [],
  occupantsTotal: "1",
  parking: "1 space",
  pets: "None reported",
  preferences: "",
  references: [],
  creditAuth: false,
  idVerification: false,
  screeningConsent: false,
  notes: "",
  reviewer: "Dana Whitfield",
  docs: [],
});

let localId = 0;
const lid = () => `local-${++localId}`;

export function NewApplicationWizard({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (applicationId: string) => void;
}) {
  const { state, dispatch, toast, uid } = useStore();
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [showErrors, setShowErrors] = useState(false);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  const propertyOptions = state.properties.map((p) => ({ value: p.id, label: p.name }));
  const unitOptions = state.units
    .filter((u) => !draft.propertyId || u.propertyId === draft.propertyId)
    .map((u) => ({ value: u.id, label: `Unit ${u.unitNumber} — ${u.unitType} · ${currency(u.advertisedRent)}` }));
  const unit = unitOf(state, draft.unitId);
  const property = propertyOf(state, draft.propertyId);

  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (!draft.propertyId) e.propertyId = "Select a property";
    if (!draft.unitId) e.unitId = "Select a unit";
    if (!draft.moveIn) e.moveIn = "Move-in date is required";
    if (draft.existingPerson === "New applicant record") {
      if (!draft.fullName.trim()) e.fullName = "Full legal name is required";
      if (!draft.email.trim()) e.email = "Email is required";
    }
    if (!draft.occupantsTotal) e.occupantsTotal = "Occupant count is required";
    return e;
  }, [draft]);

  const stepErrors = (n: number) => {
    switch (n) {
      case 1:
        return [errors.propertyId, errors.unitId, errors.moveIn].filter(Boolean) as string[];
      case 2:
        return [errors.fullName, errors.email].filter(Boolean) as string[];
      case 4:
        return [errors.occupantsTotal].filter(Boolean) as string[];
      default:
        return [];
    }
  };

  const reset = () => {
    setDraft(emptyDraft());
    setStep(1);
    setShowErrors(false);
  };

  const save = (status: "New" | "Draft") => {
    setShowErrors(true);
    if (Object.keys(errors).length) return;
    const applicationId = uid("app");
    const primaryPerson =
      draft.existingPerson === "New applicant record"
        ? undefined
        : state.people.find((p) => `${p.fullName} — ${p.email}` === draft.existingPerson);

    const parties = [
      {
        id: uid("pty"),
        applicationId,
        personId: primaryPerson?.id,
        role: "Primary Applicant" as PartyRole,
        isPrimary: true,
        fullName: primaryPerson?.fullName ?? draft.fullName,
        preferredName: draft.preferredName || primaryPerson?.preferredName,
        email: primaryPerson?.email ?? draft.email,
        phone: primaryPerson?.phone ?? draft.phone,
        currentAddress: draft.address || primaryPerson?.currentAddress,
        preferredContact: draft.contact as never,
        relationship: primaryPerson ? "Existing tenant / person record" : "Applicant",
        incomeMonthly: draft.income ? Number(draft.income) : undefined,
        employment: draft.employment,
        screeningStatus: "Not Started" as const,
        requiredDocuments: [
          "Rental Application Form",
          "Proof of Income",
          ...(draft.creditAuth ? ["Credit Authorization"] : []),
          ...(draft.idVerification ? ["Identity Verification"] : []),
        ],
        signatureRequired: true,
        signatureStatus: "Not Sent" as const,
        notes: draft.screeningConsent ? "Screening consent captured at intake." : undefined,
      },
      ...draft.coApplicants.map((c) => ({
        id: uid("pty"),
        applicationId,
        role: "Co-Applicant" as PartyRole,
        isPrimary: false,
        fullName: c.fullName,
        email: c.email,
        phone: c.phone,
        preferredContact: "Email" as const,
        relationship: c.relationship || "Co-applicant",
        incomeMonthly: c.income ? Number(c.income) : undefined,
        screeningStatus: "Not Started" as const,
        requiredDocuments: ["Rental Application Form"],
        signatureRequired: true,
        signatureStatus: "Not Sent" as const,
      })),
      ...draft.occupants.map((o) => ({
        id: uid("pty"),
        applicationId,
        role: "Proposed Occupant" as PartyRole,
        isPrimary: false,
        fullName: o.fullName,
        email: "—",
        phone: "—",
        preferredContact: "Mail" as const,
        relationship: o.relationship || "Occupant",
        screeningStatus: "Not Applicable" as const,
        requiredDocuments: [],
        signatureRequired: false,
        signatureStatus: "Not Applicable" as const,
      })),
    ];

    dispatch({
      type: "ADD_APPLICATION",
      parties,
      documents: draft.docs.map((doc) => ({
        id: uid("doc"),
        applicationId,
        title: doc.title,
        category: doc.category,
        fileName: doc.fileName,
        fileType: fileExt(doc.fileName),
        fileSize: doc.fileSize,
        uploadedAt: isoDay(),
        notes: doc.notes,
        file: doc.file,
      })),
      application: {
        id: applicationId,
        applicationNumber: nextApplicationNumber(state),
        status,
        propertyId: draft.propertyId,
        unitId: draft.unitId,
        requestedMoveInDate: draft.moveIn,
        requestedLeaseTerm: Number(draft.term) || 12,
        advertisedRent: unit?.advertisedRent ?? 0,
        proposedRent: draft.proposedRent ? Number(draft.proposedRent) : null,
        applicationSource: draft.source,
        assignedReviewerId:
          draft.reviewer === "Dana Whitfield"
            ? "stf-1"
            : draft.reviewer === "Marcus Ibele"
              ? "stf-2"
              : draft.reviewer === "Priya Raman"
                ? "stf-3"
                : "stf-4",
        submittedAt: isoDay(),
        updatedAt: isoDay(),
        internalNotes: draft.notes,
        unitReservation: "None",
        proposedOccupants: Number(draft.occupantsTotal) || 1,
        parkingRequired: draft.parking,
        petInfo: draft.pets,
        rentalPreferences: draft.preferences,
        completeness: Math.min(
          100,
          25 +
            (draft.employment ? 10 : 0) +
            (draft.income ? 10 : 0) +
            draft.docs.length * 8 +
            (draft.creditAuth ? 8 : 0) +
            (draft.idVerification ? 8 : 0),
        ),
      },
    });

    if (primaryPerson === undefined && draft.fullName) {
      dispatch({
        type: "ADD_PERSON",
        person: {
          id: uid("per"),
          fullName: draft.fullName,
          preferredName: draft.preferredName || undefined,
          email: draft.email,
          phone: draft.phone,
          currentAddress: draft.address,
        },
      });
    }

    toast({
      variant: status === "Draft" ? "info" : "success",
      title: `${nextApplicationNumber(state)} saved as ${status}`,
      description: "Created in client state only — no backend write occurred.",
      simulated: true,
    });
    onCreated(applicationId);
    reset();
    onClose();
  };

  if (!open) return null;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width="max-w-4xl"
      title="New Application"
      subtitle="Six-step intake. Progress is kept while you move between steps."
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-[11.5px] text-u-muted">
            {stepErrors(step).length > 0 && showErrors ? (
              <span className="text-u-warn">Complete: {stepErrors(step).join(", ")}</span>
            ) : (
              <span>
                Step {step} of 6 · {STEPS[step - 1].label}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {step > 1 && (
              <Button variant="secondary" onClick={() => setStep((s) => s - 1)}>
                Back
              </Button>
            )}
            {step < 6 ? (
              <Button
                variant="primary"
                onClick={() => {
                  setShowErrors(true);
                  if (stepErrors(step).length === 0) setStep((s) => s + 1);
                }}
              >
                Continue
              </Button>
            ) : (
              <>
                <Button variant="secondary" onClick={() => save("Draft")}>
                  Save as Draft
                </Button>
                <Button variant="primary" icon={<IconCheck width={13} height={13} />} onClick={() => save("New")}>
                  Save Application
                </Button>
              </>
            )}
          </div>
        </div>
      }
    >
      {/* Step rail */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-u-line bg-u-card px-4 py-2.5">
        {STEPS.map((s) => {
          const done = s.n < step;
          const current = s.n === step;
          return (
            <button
              key={s.n}
              type="button"
              onClick={() => setStep(s.n)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] transition-colors",
                current
                  ? "border-u-accent/50 bg-u-accent/15 text-u-accent"
                  : done
                    ? "border-u-ok/35 bg-u-ok/10 text-u-ok"
                    : "border-u-line bg-u-s2 text-u-muted hover:text-u-ink",
              )}
            >
              <span className="font-mono">{done ? "✓" : s.n}</span>
              {s.label}
            </button>
          );
        })}
        <span className="ml-auto">
          <MockTag label="No backend" />
        </span>
      </div>

      <div className="space-y-4 px-4 py-4">
        {/* Step 1 */}
        {step === 1 && (
          <div className="space-y-3">
            <h3 className="text-[13px] font-semibold text-u-ink">Step 1 — Property and Unit</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Select property" required error={showErrors ? errors.propertyId : undefined}>
                <Select
                  value={draft.propertyId}
                  onChange={(e) => {
                    set("propertyId", e.target.value);
                    set("unitId", "");
                  }}
                >
                  <option value="">Choose a property…</option>
                  {propertyOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field
                label="Select unit"
                required
                error={showErrors ? errors.unitId : undefined}
                hint="Available units listed first"
              >
                <Select value={draft.unitId} onChange={(e) => set("unitId", e.target.value)} disabled={!draft.propertyId}>
                  <option value="">Choose a unit…</option>
                  {unitOptions
                    .slice()
                    .sort((a, b) => a.label.localeCompare(b.label))
                    .map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                </Select>
              </Field>
              <Field label="Desired move-in date" required error={showErrors ? errors.moveIn : undefined}>
                <Input type="date" value={draft.moveIn} onChange={(e) => set("moveIn", e.target.value)} />
              </Field>
              <Field label="Requested lease term">
                <Select value={draft.term} onChange={(e) => set("term", e.target.value)}>
                  {["6", "12", "13", "18", "24"].map((t) => (
                    <option key={t} value={t}>
                      {t} months
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Proposed monthly rent" hint={`Advertised ${currency(unit?.advertisedRent ?? 0)}`}>
                <Input
                  type="number"
                  value={draft.proposedRent}
                  placeholder={unit ? String(unit.advertisedRent) : "0"}
                  onChange={(e) => set("proposedRent", e.target.value)}
                />
              </Field>
              <Field label="Application source">
                <Select value={draft.source} onChange={(e) => set("source", e.target.value as ApplicationSource)}>
                  {["Website", "Referral", "Walk-in", "Listing Portal", "Manually Entered", "Transfer"].map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            {unit && property && (
              <div className="rounded-lg border border-u-line bg-u-card/60 p-3">
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-[13px] font-medium text-u-ink">
                    {property.name} · Unit {unit.unitNumber}
                  </span>
                  <UnitStatusBadge status={unit.status} />
                </div>
                <InfoGrid cols={3}>
                  <Info label="Unit type" value={unit.unitType} />
                  <Info label="Size" value={`${unit.squareFeet} sq ft · ${unit.bedrooms} bd / ${unit.bathrooms} ba`} />
                  <Info label="Advertised rent" value={currency(unit.advertisedRent)} />
                  <Info label="Available from" value={isoDay() > unit.availableFrom ? "Immediately" : unit.availableFrom} />
                  <Info label="Parking" value={`${unit.parkingSpaces} space(s)${unit.parkingFee ? ` · ${currency(unit.parkingFee)}/mo` : ""}`} />
                  <Info label="Pet policy" value={unit.petPolicy} />
                </InfoGrid>
                <p className="mt-2 text-[11.5px] text-u-muted">
                  Selecting a unit does not reserve it. Availability is read from the Units module.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Step 2 */}
        {step === 2 && (
          <div className="space-y-3">
            <h3 className="text-[13px] font-semibold text-u-ink">Step 2 — Applicant</h3>
            <Field label="Applicant record" hint="Link an existing person/tenant, or create a new record">
              <Select value={draft.existingPerson} onChange={(e) => set("existingPerson", e.target.value)}>
                <option value="New applicant record">New applicant record</option>
                {state.people.map((p) => (
                  <option key={p.id} value={`${p.fullName} — ${p.email}`}>
                    {p.fullName} — {p.email}
                    {p.tenantId ? " (existing tenant)" : ""}
                  </option>
                ))}
              </Select>
            </Field>
            {draft.existingPerson === "New applicant record" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Full legal name" required error={showErrors ? errors.fullName : undefined}>
                  <Input value={draft.fullName} onChange={(e) => set("fullName", e.target.value)} />
                </Field>
                <Field label="Preferred name">
                  <Input value={draft.preferredName} onChange={(e) => set("preferredName", e.target.value)} />
                </Field>
                <Field label="Email" required error={showErrors ? errors.email : undefined}>
                  <Input type="email" value={draft.email} onChange={(e) => set("email", e.target.value)} />
                </Field>
                <Field label="Phone">
                  <Input type="tel" value={draft.phone} onChange={(e) => set("phone", e.target.value)} />
                </Field>
                <Field label="Current address" className="sm:col-span-2">
                  <Input value={draft.address} onChange={(e) => set("address", e.target.value)} />
                </Field>
              </div>
            ) : (
              <div className="rounded-lg border border-u-line bg-u-card/60 p-3 text-[12px] text-u-muted">
                Using the selected person record — contact details are read from it and never duplicated.
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Preferred contact method">
                <Select value={draft.contact} onChange={(e) => set("contact", e.target.value)}>
                  {["Email", "Phone", "Text Message", "Mail"].map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Assign reviewer">
                <Select value={draft.reviewer} onChange={(e) => set("reviewer", e.target.value)}>
                  {["Dana Whitfield", "Marcus Ibele", "Priya Raman", "Elena Cruz"].map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          </div>
        )}

        {/* Step 3 */}
        {step === 3 && (
          <div className="space-y-3">
            <h3 className="text-[13px] font-semibold text-u-ink">Step 3 — Co-Applicants and Occupants</h3>
            <div className="rounded-lg border border-u-line bg-u-card/60 p-3 text-[12px] text-u-muted">
              <p className="text-u-ink2">
                Primary applicant:{" "}
                <span className="text-u-ink">
                  {draft.existingPerson === "New applicant record" ? draft.fullName || "— not entered yet" : draft.existingPerson}
                </span>
              </p>
              <p className="mt-1">
                Add co-applicants for everyone applying as a tenant. Add proposed occupants separately — they are not
                screened and are not on the lease as tenants.
              </p>
            </div>

            <div className="space-y-2">
              {draft.coApplicants.map((c, i) => (
                <div key={c.id} className="grid gap-2 rounded-lg border border-u-line bg-u-card/60 p-2.5 sm:grid-cols-4">
                  <Field label={`Co-applicant ${i + 1} name`}>
                    <Input
                      value={c.fullName}
                      onChange={(e) =>
                        set("coApplicants", draft.coApplicants.map((x, xi) => (xi === i ? { ...x, fullName: e.target.value } : x)))
                      }
                    />
                  </Field>
                  <Field label="Email">
                    <Input
                      type="email"
                      value={c.email}
                      onChange={(e) => set("coApplicants", draft.coApplicants.map((x, xi) => (xi === i ? { ...x, email: e.target.value } : x)))}
                    />
                  </Field>
                  <Field label="Phone">
                    <Input
                      value={c.phone}
                      onChange={(e) => set("coApplicants", draft.coApplicants.map((x, xi) => (xi === i ? { ...x, phone: e.target.value } : x)))}
                    />
                  </Field>
                  <Field label="Relationship">
                    <div className="flex gap-1.5">
                      <Input
                        value={c.relationship}
                        placeholder="Spouse"
                        onChange={(e) =>
                          set("coApplicants", draft.coApplicants.map((x, xi) => (xi === i ? { ...x, relationship: e.target.value } : x)))
                        }
                      />
                      <Button
                        variant="danger"
                        size="sm"
                        icon={<IconTrash width={13} height={13} />}
                        onClick={() => set("coApplicants", draft.coApplicants.filter((_, xi) => xi !== i))}
                      >
                        {""}
                      </Button>
                    </div>
                  </Field>
                </div>
              ))}
              <Button
                size="sm"
                variant="secondary"
                icon={<IconPlus width={13} height={13} />}
                onClick={() =>
                  set("coApplicants", [
                    ...draft.coApplicants,
                    { id: lid(), fullName: "", email: "", phone: "", relationship: "", income: "" },
                  ])
                }
              >
                Add co-applicant
              </Button>
            </div>

            <div className="space-y-2 border-t border-u-line pt-3">
              {draft.occupants.map((o, i) => (
                <div key={o.id} className="grid gap-2 rounded-lg border border-dashed border-u-line2 bg-u-card/40 p-2.5 sm:grid-cols-3">
                  <Field label={`Occupant ${i + 1} name`}>
                    <Input
                      value={o.fullName}
                      onChange={(e) => set("occupants", draft.occupants.map((x, xi) => (xi === i ? { ...x, fullName: e.target.value } : x)))}
                    />
                  </Field>
                  <Field label="Relationship / age">
                    <Input
                      value={o.relationship}
                      placeholder="Child of applicant (age 9)"
                      onChange={(e) => set("occupants", draft.occupants.map((x, xi) => (xi === i ? { ...x, relationship: e.target.value } : x)))}
                    />
                  </Field>
                  <Field label="Remove">
                    <Button
                      variant="danger"
                      size="sm"
                      icon={<IconTrash width={13} height={13} />}
                      onClick={() => set("occupants", draft.occupants.filter((_, xi) => xi !== i))}
                    >
                      Remove occupant
                    </Button>
                  </Field>
                </div>
              ))}
              <Button
                size="sm"
                variant="ghost"
                icon={<IconPlus width={13} height={13} />}
                onClick={() => set("occupants", [...draft.occupants, { id: lid(), fullName: "", relationship: "" }])}
              >
                Add proposed occupant (not an applicant)
              </Button>
            </div>

            <Field label="Total proposed occupants" required error={showErrors ? errors.occupantsTotal : undefined} className="max-w-48">
              <Input type="number" value={draft.occupantsTotal} onChange={(e) => set("occupantsTotal", e.target.value)} />
            </Field>
          </div>
        )}

        {/* Step 4 */}
        {step === 4 && (
          <div className="space-y-3">
            <h3 className="text-[13px] font-semibold text-u-ink">Step 4 — Supporting Information</h3>
            <p className="text-[11.5px] text-u-muted">
              Only collect what your jurisdiction and policy allow. Consent checkboxes record what the applicant
              authorized.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Employer">
                <Input value={draft.employment} onChange={(e) => set("employment", e.target.value)} />
              </Field>
              <Field label="Stated monthly income">
                <Input type="number" value={draft.income} onChange={(e) => set("income", e.target.value)} />
              </Field>
              <Field label="Parking requirement">
                <Input value={draft.parking} onChange={(e) => set("parking", e.target.value)} />
              </Field>
              <Field label="Pet information">
                <Input value={draft.pets} onChange={(e) => set("pets", e.target.value)} />
              </Field>
              <Field label="Additional rental preferences" className="sm:col-span-2">
                <Textarea rows={2} value={draft.preferences} onChange={(e) => set("preferences", e.target.value)} />
              </Field>
            </div>

            <div className="space-y-2">
              {draft.references.map((r, i) => (
                <div key={r.id} className="grid gap-2 rounded-lg border border-u-line bg-u-card/60 p-2.5 sm:grid-cols-4">
                  <Field label={`Reference ${i + 1} name`}>
                    <Input
                      value={r.name}
                      onChange={(e) => set("references", draft.references.map((x, xi) => (xi === i ? { ...x, name: e.target.value } : x)))}
                    />
                  </Field>
                  <Field label="Contact">
                    <Input
                      value={r.contact}
                      onChange={(e) => set("references", draft.references.map((x, xi) => (xi === i ? { ...x, contact: e.target.value } : x)))}
                    />
                  </Field>
                  <Field label="Relationship">
                    <Input
                      value={r.relationship}
                      onChange={(e) => set("references", draft.references.map((x, xi) => (xi === i ? { ...x, relationship: e.target.value } : x)))}
                    />
                  </Field>
                  <Field label="Remove">
                    <Button
                      variant="danger"
                      size="sm"
                      icon={<IconTrash width={13} height={13} />}
                      onClick={() => set("references", draft.references.filter((_, xi) => xi !== i))}
                    >
                      {""}
                    </Button>
                  </Field>
                </div>
              ))}
              <Button
                size="sm"
                variant="secondary"
                icon={<IconPlus width={13} height={13} />}
                onClick={() => set("references", [...draft.references, { id: lid(), name: "", contact: "", relationship: "" }])}
              >
                Add reference
              </Button>
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              <Checkbox
                checked={draft.creditAuth}
                onChange={(v) => set("creditAuth", v)}
                label="Credit authorization signed"
                description="Only where legally permitted"
              />
              <Checkbox
                checked={draft.idVerification}
                onChange={(v) => set("idVerification", v)}
                label="Identity verification provided"
                description="Where appropriate and lawful"
              />
              <Checkbox
                checked={draft.screeningConsent}
                onChange={(v) => set("screeningConsent", v)}
                label="Screening consent captured"
                description="Recorded on the applicant"
              />
            </div>

            <Field label="Internal notes">
              <Textarea rows={3} value={draft.notes} onChange={(e) => set("notes", e.target.value)} />
            </Field>
          </div>
        )}

        {/* Step 5 */}
        {step === 5 && (
          <div className="space-y-3">
            <h3 className="text-[13px] font-semibold text-u-ink">Step 5 — Documents</h3>
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11.5px] text-u-muted">
                {draft.docs.length} document{draft.docs.length === 1 ? "" : "s"} attached. Multiple files are supported;
                assign a category to each.
              </p>
              <MockTag label="Storage not connected" />
            </div>
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-u-line2 bg-u-s2/40 px-4 py-6 text-center hover:border-u-accent/60">
              <IconUpload className="text-u-muted" width={18} height={18} />
              <span className="text-[13px] text-u-ink">Drop files here or click to browse</span>
              <span className="text-[11.5px] text-u-muted">Multiple file selection supported</span>
              <input
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? []);
                  set(
                    "docs",
                    draft.docs.concat(
                      files.map((f) => ({
                        id: lid(),
                        title: f.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " "),
                        category: "Supporting Document" as DocumentCategory,
                        fileName: f.name,
                        fileSize: f.size,
                        file: f,
                      })),
                    ),
                  );
                  e.target.value = "";
                }}
              />
            </label>

            {draft.docs.map((doc, i) => (
              <div key={doc.id} className="grid gap-2 rounded-lg border border-u-line bg-u-card/60 p-2.5 sm:grid-cols-4">
                <Field label="Title">
                  <Input
                    value={doc.title}
                    onChange={(e) => set("docs", draft.docs.map((x, xi) => (xi === i ? { ...x, title: e.target.value } : x)))}
                  />
                </Field>
                <Field label="Category">
                  <Select
                    value={doc.category}
                    onChange={(e) =>
                      set("docs", draft.docs.map((x, xi) => (xi === i ? { ...x, category: e.target.value as DocumentCategory } : x)))
                    }
                  >
                    {DOCUMENT_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Notes">
                  <Input
                    value={doc.notes ?? ""}
                    onChange={(e) => set("docs", draft.docs.map((x, xi) => (xi === i ? { ...x, notes: e.target.value } : x)))}
                  />
                </Field>
                <Field label="File">
                  <div className="flex items-center gap-1.5">
                    <span className="min-w-0 flex-1 truncate font-mono text-[11.5px] text-u-muted">
                      {doc.fileName} · {fileSize(doc.fileSize)}
                    </span>
                    <Button
                      variant="danger"
                      size="sm"
                      icon={<IconX width={13} height={13} />}
                      onClick={() => set("docs", draft.docs.filter((_, xi) => xi !== i))}
                    >
                      {""}
                    </Button>
                  </div>
                </Field>
              </div>
            ))}

            <div className="rounded-lg border border-u-line bg-u-card/60 p-3">
              <p className="mb-1.5 text-[12px] font-semibold text-u-ink">Required item checklist</p>
              <ul className="space-y-1 text-[11.5px]">
                {["Rental Application Form", "Proof of Income", "Credit Authorization", "Identity Verification"].map((item) => {
                  const has = draft.docs.some((d) => d.category === item);
                  return (
                    <li key={item} className={cn("flex items-center gap-2", has ? "text-u-ok" : "text-u-warn")}>
                      <span>{has ? "✓" : "•"}</span>
                      <span className={has ? "" : "text-u-ink2"}>{item}</span>
                      <span className="text-u-muted">{has ? "received" : "still missing (configurable)"}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        )}

        {/* Step 6 */}
        {step === 6 && (
          <div className="space-y-3">
            <h3 className="text-[13px] font-semibold text-u-ink">Step 6 — Review and Save</h3>
            {Object.keys(errors).length > 0 && (
              <div className="rounded-lg border border-u-warn/35 bg-u-warn/8 px-3 py-2 text-[12px] text-u-warn">
                Resolve before saving: {Object.values(errors).join(", ")}
              </div>
            )}
            <div className="grid gap-3 lg:grid-cols-2">
              <div className="rounded-lg border border-u-line bg-u-card/60 p-3">
                <h4 className="mb-2 text-[12px] font-semibold text-u-ink">Property and terms</h4>
                <InfoGrid cols={2}>
                  <Info label="Property" value={property?.name ?? "—"} />
                  <Info label="Unit" value={unit ? `Unit ${unit.unitNumber}` : "—"} />
                  <Info label="Move-in" value={draft.moveIn || "—"} />
                  <Info label="Term" value={`${draft.term} months`} />
                  <Info label="Advertised rent" value={currency(unit?.advertisedRent)} />
                  <Info label="Proposed rent" value={draft.proposedRent ? currency(Number(draft.proposedRent)) : "—"} />
                  <Info label="Source" value={draft.source} />
                  <Info label="Reviewer" value={draft.reviewer} />
                </InfoGrid>
              </div>
              <div className="rounded-lg border border-u-line bg-u-card/60 p-3">
                <h4 className="mb-2 text-[12px] font-semibold text-u-ink">Household</h4>
                <InfoGrid cols={2}>
                  <Info label="Primary applicant" value={draft.existingPerson === "New applicant record" ? draft.fullName || "—" : draft.existingPerson} className="sm:col-span-2" />
                  <Info label="Email" value={draft.email || "—"} />
                  <Info label="Phone" value={draft.phone || "—"} />
                  <Info label="Co-applicants" value={String(draft.coApplicants.length)} />
                  <Info label="Occupants" value={String(draft.occupants.length)} />
                  <Info label="Documents" value={String(draft.docs.length)} />
                  <Info label="Consents" value={[draft.creditAuth && "Credit", draft.idVerification && "ID", draft.screeningConsent && "Screening"].filter(Boolean).join(", ") || "None recorded"} />
                </InfoGrid>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-u-line bg-u-s2/60 px-3 py-2.5 text-[11.5px] text-u-muted">
              <IconFile width={13} height={13} />
              Saving creates an Application record with its parties and documents in client state. No emails are sent,
              no unit is reserved, and no tenant billing starts.
            </div>
            {draft.docs.length === 0 && (
              <Badge tone="amber">No documents attached — you can add them later from the application detail.</Badge>
            )}
          </div>
        )}
      </div>
    </Drawer>
  );
}
