import { useMemo, useState } from "react";
import {
  useStore,
  partiesOf,
  primaryApplicantOf,
  propertyOf,
  unitOf,
  documentsOf,
  nextLeaseNumber,
} from "../state/store";
import { currency, formatDate, isoDay } from "../lib/format";
import { Badge, ApplicationStatusBadge, MockTag } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Checkbox, Field, Input, Select, Textarea } from "../components/ui/Form";
import { Modal } from "../components/ui/Overlay";
import { Info, InfoGrid } from "../components/ui/Misc";

/**
 * Lease creation from an approved application.
 *
 * Carries forward application data for staff review, then creates a linked Lease
 * record. Applicant person records are reused (no duplicate tenants), the
 * application stays intact, and unit occupancy is left to the lease move-in
 * process.
 */
export function CreateLeaseModal({
  applicationId,
  onClose,
  onViewLease,
}: {
  applicationId: string;
  onClose: () => void;
  onViewLease?: (applicationId: string) => void;
}) {
  const { state, dispatch, toast, uid } = useStore();
  const app = state.applications.find((a) => a.id === applicationId);
  const property = propertyOf(state, app?.propertyId);
  const unit = unitOf(state, app?.unitId);
  const parties = partiesOf(state, applicationId);
  const applicants = parties.filter((p) => p.role !== "Proposed Occupant");
  const occupants = parties.filter((p) => p.role === "Proposed Occupant");
  const primary = primaryApplicantOf(state, applicationId);
  const docs = documentsOf(state, applicationId);

  const [form, setForm] = useState(() => ({
    leaseNumber: nextLeaseNumber(state),
    startDate: app?.requestedMoveInDate ?? isoDay(),
    termMonths: String(app?.requestedLeaseTerm ?? 12),
    monthlyRent: String(app?.proposedRent ?? app?.advertisedRent ?? 0),
    deposit: String(app?.proposedRent ?? app?.advertisedRent ?? 0),
    occupants: occupants.map((o) => o.fullName).join(", "),
    notes: `Created from application ${app?.applicationNumber ?? ""}.`,
  }));
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>(
    docs.filter((d) => d.category === "Reference" || d.category === "Employment Letter").map((d) => d.id),
  );
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const term = useMemo(() => {
    const start = new Date(`${form.startDate}T12:00:00`);
    const end = new Date(start);
    end.setMonth(end.getMonth() + Number(form.termMonths || 0));
    return end.toISOString().slice(0, 10);
  }, [form.startDate, form.termMonths]);

  if (!app) return null;

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = () => {
    if (!primary) {
      setError("This application has no primary applicant.");
      return;
    }
    if (!confirmed) {
      setError("Confirm the lease details before creating the lease.");
      return;
    }
    const personIds = applicants.map((a) => a.personId).filter(Boolean) as string[];
    const lease = {
      id: uid("lse"),
      leaseNumber: form.leaseNumber,
      propertyId: app.propertyId,
      unitId: app.unitId,
      applicationId: app.id,
      tenantPersonIds: personIds,
      occupantNames: form.occupants
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      startDate: form.startDate,
      endDate: term,
      monthlyRent: Number(form.monthlyRent) || 0,
      securityDeposit: Number(form.deposit) || 0,
      termMonths: Number(form.termMonths) || 12,
      status: "Pending Signature" as const,
      createdAt: isoDay(),
      notes: form.notes,
    };
    dispatch({ type: "CREATE_LEASE", lease });

    // Selected application documents are copied (linked) to the lease record,
    // never moved — the application keeps its originals.
    selectedDocIds.forEach((id) => {
      const doc = state.documents.find((d) => d.id === id);
      if (!doc) return;
      dispatch({
        type: "UPDATE_DOCUMENT",
        id: doc.id,
        updatedBy: state.currentUser.name,
        patch: { notes: `${doc.notes ? `${doc.notes} · ` : ""}Copied to lease ${lease.leaseNumber}.` },
        note: `${doc.title} linked to lease ${lease.leaseNumber}`,
      });
    });

    toast({
      variant: "success",
      title: `Lease ${lease.leaseNumber} created`,
      description:
        "Linked to this application with the existing person records. The application stays Approved; the unit is still not marked occupied until move-in.",
      simulated: true,
    });
    onClose();
    onViewLease?.(app.id);
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="xl"
      title="Create Lease from Application"
      description="Review the carried-forward information, adjust the lease terms, then confirm. Nothing is created until you confirm."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} disabled={!confirmed}>
            Create Lease
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-u-line bg-u-s2/60 px-3 py-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[12px] text-u-accent">{app.applicationNumber}</span>
            <ApplicationStatusBadge status={app.status} />
            <span className="text-[12px] text-u-muted">
              {property?.name} · Unit {unit?.unitNumber} · {primary?.fullName}
            </span>
          </div>
          <MockTag label="No backend write" />
        </div>

        {app.status !== "Approved" && (
          <div className="rounded-lg border border-u-warn/35 bg-u-warn/8 px-3 py-2 text-[12px] text-u-warn">
            Only approved applications should be converted to a lease. This application is currently{" "}
            <strong>{app.status}</strong>.
          </div>
        )}

        <div className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-lg border border-u-line bg-u-card/60 p-3">
            <h4 className="mb-2.5 text-[12px] font-semibold text-u-ink">Carried forward from the application</h4>
            <InfoGrid cols={2}>
              <Info label="Property" value={property?.name ?? "—"} />
              <Info label="Unit" value={`Unit ${unit?.unitNumber} · ${unit?.unitType}`} />
              <Info label="Desired move-in" value={formatDate(app.requestedMoveInDate)} />
              <Info label="Proposed term" value={`${app.requestedLeaseTerm} months`} />
              <Info
                label="Agreed rent"
                value={
                  app.proposedRent != null
                    ? `${currency(app.proposedRent)} (proposed of ${currency(app.advertisedRent)})`
                    : currency(app.advertisedRent)
                }
              />
              <Info label="Source" value={app.applicationSource} />
            </InfoGrid>

            <h4 className="mt-3 mb-2 text-[12px] font-semibold text-u-ink">
              Applicants ({applicants.length}) — existing person records reused
            </h4>
            <ul className="space-y-1.5">
              {applicants.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-2 rounded-md border border-u-line bg-u-s2/50 px-2 py-1.5">
                  <span className="min-w-0">
                    <span className="block truncate text-[12.5px] text-u-ink">
                      {a.fullName} {a.isPrimary && <Badge tone="indigo">Primary</Badge>}
                    </span>
                    <span className="block truncate text-[11px] text-u-muted">{a.email}</span>
                  </span>
                  <span className="text-[11px] text-u-muted">
                    {a.personId ? "linked person" : "no person record"}
                  </span>
                </li>
              ))}
            </ul>

            {occupants.length > 0 && (
              <>
                <h4 className="mt-3 mb-2 text-[12px] font-semibold text-u-ink">
                  Proposed occupants ({occupants.length}) — not on the lease as tenants
                </h4>
                <ul className="space-y-1">
                  {occupants.map((o) => (
                    <li key={o.id} className="text-[12px] text-u-ink2">
                      {o.fullName} — {o.relationship}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>

          <div className="space-y-3">
            <div className="rounded-lg border border-u-line bg-u-card/60 p-3">
              <h4 className="mb-2.5 text-[12px] font-semibold text-u-ink">Lease terms</h4>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Lease number">
                  <Input value={form.leaseNumber} onChange={(e) => set("leaseNumber", e.target.value)} />
                </Field>
                <Field label="Start date" required>
                  <Input type="date" value={form.startDate} onChange={(e) => set("startDate", e.target.value)} />
                </Field>
                <Field label="Lease term (months)" required>
                  <Select value={form.termMonths} onChange={(e) => set("termMonths", e.target.value)}>
                    {["6", "12", "13", "18", "24"].map((t) => (
                      <option key={t} value={t}>
                        {t} months
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="End date (calculated)" hint="Auto from term">
                  <Input value={formatDate(term)} readOnly disabled />
                </Field>
                <Field label="Monthly rent" required>
                  <Input type="number" value={form.monthlyRent} onChange={(e) => set("monthlyRent", e.target.value)} />
                </Field>
                <Field label="Security deposit" required>
                  <Input type="number" value={form.deposit} onChange={(e) => set("deposit", e.target.value)} />
                </Field>
                <Field label="Proposed occupants" hint="Comma separated" className="sm:col-span-2">
                  <Input value={form.occupants} onChange={(e) => set("occupants", e.target.value)} />
                </Field>
                <Field label="Lease notes" className="sm:col-span-2">
                  <Textarea rows={3} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
                </Field>
              </div>
            </div>

            <div className="rounded-lg border border-u-line bg-u-card/60 p-3">
              <h4 className="mb-1 text-[12px] font-semibold text-u-ink">Copy application documents to the lease</h4>
              <p className="mb-2 text-[11.5px] text-u-muted">
                Optional. Selected documents are linked to the lease while the originals stay on the application.
                Lease document management remains separate.
              </p>
              <div className="max-h-40 space-y-1.5 overflow-y-auto pr-1">
                {docs.length === 0 && (
                  <p className="text-[12px] text-u-muted">This application has no documents to copy.</p>
                )}
                {docs.map((d) => (
                  <Checkbox
                    key={d.id}
                    checked={selectedDocIds.includes(d.id)}
                    onChange={(v) =>
                      setSelectedDocIds((ids) => (v ? [...ids, d.id] : ids.filter((x) => x !== d.id)))
                    }
                    label={
                      <span className="flex items-center gap-2">
                        <span className="truncate">{d.title}</span>
                        <Badge tone="neutral">{d.category}</Badge>
                      </span>
                    }
                    description={`v${d.versionNumber} · ${d.fileName}`}
                  />
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-u-accent/35 bg-u-accent/[0.08] p-3">
              <Checkbox
                checked={confirmed}
                onChange={(v) => {
                  setConfirmed(v);
                  setError(null);
                }}
                label="I reviewed the applicants, occupants, rent, term, and dates above."
                description="Creating the lease does not mark the unit occupied and does not start billing until the lease move-in is completed in the Leases module."
              />
            </div>
          </div>
        </div>

        {error && (
          <p className="rounded-lg border border-u-danger/35 bg-u-danger/8 px-3 py-2 text-[12px] text-u-danger">{error}</p>
        )}
      </div>
    </Modal>
  );
}
