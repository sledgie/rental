import { isSupabaseConfigured } from "../../../lib/supabase";
import { useState } from "react";
import {
  useStore,
  partiesOf,
  personOf,
  propertyOf,
  tenantOf,
  unitOf,
  leaseOf,
  staffName,
} from "../../state/store";
import {
  DOCUMENT_CATEGORIES,
  PERMISSIONS,
  type ApplicationStatus,
  type ApplicationCommunication,
  type ApplicationReview,
  type DocumentCategory,
  type DocumentStatus,
  type PartyRole,
  type ScreeningStatus,
} from "../../data/types";
import { currency, formatDate, fileSize, isoDay, addDays } from "../../lib/format";
import { Badge, DocumentStatusBadge, MockTag, UnitStatusBadge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Checkbox, FormDialog, Input, Select, Textarea, type FormFieldSpec } from "../../components/ui/Form";
import { ConfirmDialog, Modal } from "../../components/ui/Overlay";
import { Info, InfoGrid } from "../../components/ui/Misc";
import { CreateLeaseModal } from "../CreateLeaseModal";
import type { ActivityType } from "../../data/types";
import type { DialogRequest } from "./dialogTypes";

const ALL_STATUSES: ApplicationStatus[] = [
  "New",
  "Under Review",
  "Awaiting Information",
  "Approved",
  "Waitlisted",
  "Declined",
  "Withdrawn",
  "Archived",
];

const SCREENING_STATES: ScreeningStatus[] = [
  "Not Started",
  "In Progress",
  "Waiting for Information",
  "Completed",
  "Not Applicable",
];

const REVIEW_TYPES: ApplicationReview["reviewType"][] = [
  "Completeness Check",
  "Reference Check",
  "Employment & Income",
  "Credit Check",
  "Rental History",
  "Identity Verification",
  "Final Review",
];

const CONTACT_METHODS: ApplicationCommunication["contactMethod"][] = [
  "Phone Call",
  "Email",
  "Text Message",
  "In Person",
  "Letter",
  "Portal Message",
];

/* ------------------------------- Spec dialog ------------------------------ */

function SpecDialog({
  title,
  description,
  spec,
  submitLabel = "Save",
  notice,
  size,
  onClose,
  onSubmit,
}: {
  title: string;
  description?: string;
  spec: FormFieldSpec[];
  submitLabel?: string;
  notice?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  onClose: () => void;
  onSubmit: (values: Record<string, string>) => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(spec.map((f) => [f.name, f.defaultValue ?? ""])),
  );
  return (
    <FormDialog
      open
      title={title}
      description={description}
      spec={spec}
      values={values}
      onChange={(name, value) => setValues((v) => ({ ...v, [name]: value }))}
      onCancel={onClose}
      onSubmit={() => onSubmit(values)}
      submitLabel={submitLabel}
      notice={notice}
      size={size}
    />
  );
}

/* --------------------------------- Host ---------------------------------- */

export function DialogHost({
  applicationId,
  dialog,
  onClose,
}: {
  applicationId: string;
  dialog: DialogRequest | null;
  onClose: () => void;
}) {
  const { state, dispatch, can, toast, uid } = useStore();
  const app = state.applications.find((a) => a.id === applicationId);
  if (!app || !dialog) return null;
  const property = propertyOf(state, app.propertyId);
  const unit = unitOf(state, app.unitId);
  const parties = partiesOf(state, applicationId);
  const applicants = parties.filter((p) => p.role !== "Proposed Occupant");
  const staffOptions = ["Dana Whitfield", "Marcus Ibele", "Priya Raman", "Elena Cruz"];
  const unitOptions = state.units.map((u) => {
    const p = propertyOf(state, u.propertyId);
    return `${p?.name ?? ""} · Unit ${u.unitNumber} · ${currency(u.advertisedRent)}`;
  });
  const by = state.currentUser.name;
  const today = isoDay();

  const logActivity = (description: string, details?: string, activityType?: ActivityType) =>
    dispatch({
      type: "ADD_ACTIVITY",
      applicationId,
      activity: { description, details, createdBy: by, activityType },
    });

  switch (dialog.kind) {
    /* ---------------------------- Application ---------------------------- */
    case "editApplication":
      return (
        <SpecDialog
          title={`Edit application ${app.applicationNumber}`}
          description="Core application details. Property and unit data still comes from the Properties and Units modules."
          size="lg"
          onClose={onClose}
          onSubmit={(v) => {
            dispatch({
              type: "UPDATE_APPLICATION",
              id: applicationId,
              patch: {
                requestedMoveInDate: v.moveIn || app.requestedMoveInDate,
                requestedLeaseTerm: Number(v.term) || app.requestedLeaseTerm,
                proposedRent: v.proposedRent ? Number(v.proposedRent) : null,
                applicationSource: v.source as typeof app.applicationSource,
                assignedReviewerId: staffOptions.includes(v.reviewer)
                  ? (state.applications && v.reviewer === "Dana Whitfield"
                      ? "stf-1"
                      : v.reviewer === "Marcus Ibele"
                        ? "stf-2"
                        : v.reviewer === "Priya Raman"
                          ? "stf-3"
                          : "stf-4")
                  : app.assignedReviewerId,
                proposedOccupants: Number(v.occupants) || app.proposedOccupants,
                parkingRequired: v.parking,
                petInfo: v.pets,
                rentalPreferences: v.preferences,
                internalNotes: v.notes,
                completeness: v.completeness ? Number(v.completeness) : app.completeness,
              },
              activity: {
                activityType: "application_updated",
                description: `Application ${app.applicationNumber} updated`,
                details: v.changeNote || "Details edited by staff",
                createdBy: by,
              },
            });
            toast({ variant: "success", title: "Application updated", description: "Saved to client state (no backend call).", simulated: true });
            onClose();
          }}
          spec={[
            { kind: "select", name: "property", label: "Property", span: 2, defaultValue: `${property?.name} — ${property?.addressLine1}`, options: [`${property?.name} — ${property?.addressLine1}`], hint: "Read from Properties module" },
            { kind: "select", name: "unit", label: "Unit", span: 2, defaultValue: `Unit ${unit?.unitNumber}`, options: unitOptions, hint: "Changing the unit logs a 'unit selected' activity" },
            { kind: "date", name: "moveIn", label: "Desired move-in date", type: "date", defaultValue: app.requestedMoveInDate, required: true },
            { kind: "select", name: "term", label: "Requested lease term (months)", options: ["6", "12", "13", "18", "24"], defaultValue: String(app.requestedLeaseTerm) },
            { kind: "number", name: "proposedRent", label: "Proposed monthly rent", type: "number", defaultValue: app.proposedRent != null ? String(app.proposedRent) : "", hint: `Advertised ${currency(app.advertisedRent)}` },
            { kind: "number", name: "occupants", label: "Proposed occupants", type: "number", defaultValue: String(app.proposedOccupants) },
            { kind: "select", name: "source", label: "Application source", options: ["Website", "Referral", "Walk-in", "Listing Portal", "Manually Entered", "Transfer"], defaultValue: app.applicationSource },
            { kind: "select", name: "reviewer", label: "Assigned reviewer", options: staffOptions, defaultValue: staffName(state, app.assignedReviewerId) },
            { kind: "text", name: "parking", label: "Parking requirement", defaultValue: app.parkingRequired, span: 2 },
            { kind: "text", name: "pets", label: "Pet information", defaultValue: app.petInfo, span: 2 },
            { kind: "textarea", name: "preferences", label: "Additional rental preferences", defaultValue: app.rentalPreferences, span: 2 },
            { kind: "textarea", name: "notes", label: "Internal notes", defaultValue: app.internalNotes, span: 2 },
            { kind: "number", name: "completeness", label: "Application completeness (%)", type: "number", defaultValue: String(app.completeness) },
            { kind: "text", name: "changeNote", label: "Change note (added to activity history)", span: 2 },
          ]}
        />
      );

    case "status":
      return (
        <SpecDialog
          title="Change application status"
          description="Status changes are recorded in the status history and the activity timeline."
          onClose={onClose}
          onSubmit={(v) => {
            dispatch({ type: "SET_STATUS", id: applicationId, to: v.status as ApplicationStatus, notes: v.reason, changedBy: by, decision: v.status === "Approved" || v.status === "Declined" });
            toast({ variant: "success", title: `Status set to ${v.status}`, description: "Recorded locally with your note.", simulated: true });
            onClose();
          }}
          spec={[
            { kind: "select", name: "status", label: "New status", options: ALL_STATUSES, defaultValue: app.status, required: true },
            { kind: "textarea", name: "reason", label: "Reason or internal note", span: 2, placeholder: "Why the status is changing (shown in history)" },
          ]}
        />
      );

    case "decision":
      return (
        <ConfirmDialog
          open
          title={dialog.decision === "Approved" ? "Record approval" : "Record decline"}
          tone={dialog.decision === "Approved" ? "primary" : "danger"}
          confirmLabel={`Confirm ${dialog.decision === "Approved" ? "approval" : "decline"}`}
          requireReason
          reasonPlaceholder={
            dialog.decision === "Approved"
              ? "Approval terms and conditions (required)"
              : "Documented decision reason for the adverse action notice (required)"
          }
          message={
            <>
              You are about to record a <strong>{dialog.decision}</strong> decision for{" "}
              <span className="font-mono">{app.applicationNumber}</span> ({applicants.map((a) => a.fullName).join(", ")}).
              {dialog.decision === "Approved" ? (
                <>
                  {" "}
                  This does <strong>not</strong> create a lease, reserve the unit, or mark it occupied.
                </>
              ) : (
                <>
                  {" "}
                  An adverse action notice must be sent to the applicant when consumer reports influenced the decision.
                </>
              )}
            </>
          }
          onCancel={onClose}
          onConfirm={(reason) => {
            if (!reason || !reason.trim()) {
              toast({ variant: "error", title: "Reason required", description: "A documented reason is required for final decisions." });
              return;
            }
            if (!can(PERMISSIONS.decisions)) {
              toast({ variant: "error", title: "Not permitted", description: "Your role cannot record decisions." });
              return;
            }
            dispatch({ type: "SET_STATUS", id: applicationId, to: dialog.decision, notes: reason, changedBy: by, decision: true });
            toast({ variant: "success", title: `Decision recorded — ${dialog.decision}`, description: "Status history and activity log updated locally.", simulated: true });
            onClose();
          }}
        />
      );

    case "archiveApplication":
      return (
        <ConfirmDialog
          open
          title="Archive application"
          confirmLabel="Archive application"
          message={
            <>
              Archive <span className="font-mono">{app.applicationNumber}</span>? Archived applications stay searchable
              for the retention period and keep their documents and history.
            </>
          }
          onCancel={onClose}
          onConfirm={(reason) => {
            dispatch({ type: "SET_STATUS", id: applicationId, to: "Archived", notes: reason ?? "Archived by staff", changedBy: by });
            onClose();
          }}
        />
      );

    /* ------------------------------ Reviewing ---------------------------- */
    case "startReview":
      return (
        <SpecDialog
          title="Start review"
          description="Assigns the reviewer and moves the application into review. Nothing is screened automatically."
          onClose={onClose}
          onSubmit={(v) => {
            dispatch({
              type: "ADD_REVIEW",
              review: {
                id: uid("rev"),
                applicationId,
                reviewerId: app.assignedReviewerId ?? "stf-1",
                reviewType: "Completeness Check",
                status: "In Progress",
                startedAt: v.startDate || today,
                notes: v.note || "Review opened by staff.",
                followUpRequired: v.followUp === "Yes",
                followUpDate: v.due || undefined,
              },
            });
            if (["New", "Draft", "Awaiting Information", "Waitlisted"].includes(app.status)) {
              dispatch({ type: "SET_STATUS", id: applicationId, to: "Under Review", notes: "Review started", changedBy: by });
            }
            toast({ variant: "success", title: "Review started", description: "Completeness check opened under your name.", simulated: true });
            onClose();
          }}
          spec={[
            { kind: "select", name: "reviewer", label: "Reviewer", options: staffOptions, defaultValue: staffName(state, app.assignedReviewerId) },
            { kind: "date", name: "startDate", label: "Review start date", type: "date", defaultValue: today },
            { kind: "select", name: "followUp", label: "Follow-up required?", options: ["No", "Yes"], defaultValue: "No" },
            { kind: "date", name: "due", label: "Follow-up due date", type: "date", defaultValue: addDays(3) },
            { kind: "textarea", name: "note", label: "Initial review note", span: 2, placeholder: "What you are checking first" },
          ]}
        />
      );

    case "reviewNote":
      return (
        <SpecDialog
          title="Add review note"
          description="Notes are attributed to you and visible to authorized staff only."
          onClose={onClose}
          onSubmit={(v) => {
            const open = state.reviews.find((r) => r.applicationId === applicationId && r.status !== "Completed");
            if (open) {
              dispatch({
                type: "UPDATE_REVIEW",
                id: open.id,
                patch: { notes: v.note, reviewedAt: today },
              });
            }
            logActivity("Review note added", v.note, "review_note_added");
            toast({ variant: "success", title: "Review note added", simulated: true });
            onClose();
          }}
          spec={[
            { kind: "textarea", name: "note", label: "Review note", required: true, rows: 4, span: 2, placeholder: "What you verified, what is still outstanding" },
          ]}
        />
      );

    case "requestInfo":
      return (
        <SpecDialog
          title="Request information from applicant"
          description={isSupabaseConfigured ? "Logs the request and pauses the application as Awaiting Information. No message is sent from here." : "Logs the request and pauses the application as Awaiting Information. No message is actually sent in the prototype."}
          onClose={onClose}
          onSubmit={(v) => {
            dispatch({ type: "SET_STATUS", id: applicationId, to: "Awaiting Information", notes: `Requested: ${v.items}`, changedBy: by });
            dispatch({
              type: "ADD_COMMUNICATION",
              communication: {
                id: uid("com"),
                applicationId,
                applicationPartyId: parties[0]?.id,
                contactMethod: (v.method as ApplicationCommunication["contactMethod"]) ?? "Email",
                subject: `Information requested — ${v.items.slice(0, 60)}`,
                summary: v.items,
                createdAt: today,
                createdBy: by,
                followUpRequired: true,
                followUpDate: v.due || addDays(3),
                followUpStatus: "Open",
              },
            });
            logActivity("Information requested", v.items, "information_requested");
            toast({ variant: "warn", title: "Request logged", description: "Simulated — no email or text was sent.", simulated: true });
            onClose();
          }}
          spec={[
            { kind: "textarea", name: "items", label: "Information or documents requested", required: true, rows: 3, span: 2, placeholder: "e.g. Two most recent pay stubs and a landlord reference" },
            { kind: "select", name: "method", label: "Contact method", options: CONTACT_METHODS, defaultValue: "Email" },
            { kind: "date", name: "due", label: "Follow-up due date", type: "date", defaultValue: addDays(3) },
          ]}
        />
      );

    case "infoReceived":
      return (
        <SpecDialog
          title="Record information received"
          description="Confirms the outstanding items arrived and resumes the review."
          onClose={onClose}
          onSubmit={(v) => {
            dispatch({ type: "SET_STATUS", id: applicationId, to: "Under Review", notes: "Information received — review resumed", changedBy: by });
            logActivity("Information received", v.note || "Applicant supplied the requested items", "information_received");
            toast({ variant: "success", title: "Information recorded", simulated: true });
            onClose();
          }}
          spec={[{ kind: "textarea", name: "note", label: "What was received", rows: 3, span: 2, required: true }]}
        />
      );

    case "referenceCheck":
      return (
        <SpecDialog
          title="Record reference check"
          description="Stores the outcome of a landlord or personal reference call."
          onClose={onClose}
          onSubmit={(v) => {
            dispatch({
              type: "ADD_REVIEW",
              review: {
                id: uid("rev"),
                applicationId,
                reviewerId: app.assignedReviewerId ?? "stf-1",
                reviewType: "Reference Check",
                status: "Completed",
                reviewedAt: today,
                startedAt: today,
                notes: `${v.contact}: ${v.outcome}. ${v.note ?? ""}`.trim(),
                followUpRequired: v.outcome === "No response",
                followUpDate: v.outcome === "No response" ? addDays(3) : undefined,
              },
            });
            toast({ variant: "success", title: "Reference check recorded", simulated: true });
            onClose();
          }}
          spec={[
            { kind: "select", name: "applicant", label: "Applicant", options: applicants.map((a) => a.fullName), span: 2 },
            { kind: "text", name: "contact", label: "Reference name and contact", required: true, span: 2 },
            { kind: "select", name: "outcome", label: "Outcome", options: ["Positive", "Neutral", "Negative", "No response"], defaultValue: "Positive" },
            { kind: "date", name: "date", label: "Check date", type: "date", defaultValue: today },
            { kind: "textarea", name: "note", label: "Notes", rows: 3, span: 2 },
          ]}
        />
      );

    case "screeningStatus": {
      if (!can(PERMISSIONS.screening)) {
        toast({ variant: "error", title: "Screening data is restricted", description: "Your role lacks applications.screening.read." });
        return null;
      }
      return (
        <SpecDialog
          title="Update screening status"
          description="Per-review status. Screening results stay restricted to authorized staff."
          onClose={onClose}
          onSubmit={(v) => {
            const existing = state.reviews.find(
              (r) => r.applicationId === applicationId && r.reviewType === v.reviewType,
            );
            if (existing) {
              dispatch({
                type: "UPDATE_REVIEW",
                id: existing.id,
                patch: {
                  status: v.status as ScreeningStatus,
                  notes: v.note || existing.notes,
                  reviewedAt: v.status === "Completed" ? today : existing.reviewedAt,
                  startedAt: existing.startedAt ?? today,
                  followUpRequired: v.status === "Waiting for Information",
                  followUpDate: v.status === "Waiting for Information" ? addDays(3) : undefined,
                },
              });
            } else {
              dispatch({
                type: "ADD_REVIEW",
                review: {
                  id: uid("rev"),
                  applicationId,
                  reviewerId: app.assignedReviewerId ?? "stf-1",
                  reviewType: v.reviewType as ApplicationReview["reviewType"],
                  status: v.status as ScreeningStatus,
                  startedAt: today,
                  reviewedAt: v.status === "Completed" ? today : undefined,
                  notes: v.note,
                  followUpRequired: v.status === "Waiting for Information",
                  followUpDate: v.status === "Waiting for Information" ? addDays(3) : undefined,
                },
              });
            }
            toast({ variant: "success", title: `${v.reviewType} updated to ${v.status}`, simulated: true });
            onClose();
          }}
          spec={[
            { kind: "select", name: "reviewType", label: "Review type", options: REVIEW_TYPES, defaultValue: "Employment & Income" },
            { kind: "select", name: "status", label: "Status", options: SCREENING_STATES, defaultValue: "In Progress" },
            { kind: "textarea", name: "note", label: "Notes", rows: 3, span: 2 },
          ]}
        />
      );
    }

    case "completeReview":
      return (
        <SpecDialog
          title="Mark review complete"
          description="Completes open review steps and moves the application to Under Review (final) status."
          onClose={onClose}
          onSubmit={(v) => {
            state.reviews
              .filter((r) => r.applicationId === applicationId && r.status !== "Completed" && r.status !== "Not Applicable")
              .forEach((r) =>
                dispatch({
                  type: "UPDATE_REVIEW",
                  id: r.id,
                  patch: { status: "Completed", reviewedAt: today, notes: v.summary || r.notes, followUpRequired: false },
                }),
              );
            logActivity("Review completed", v.summary || "All review steps closed", "review_note_added");
            toast({ variant: "success", title: "Review marked complete", description: "Ready for a documented decision.", simulated: true });
            onClose();
          }}
          spec={[{ kind: "textarea", name: "summary", label: "Review summary", rows: 3, span: 2, required: true }]}
        />
      );

    /* ------------------------------- Parties ----------------------------- */
    case "addCoApplicant":
    case "addOccupant": {
      const isOccupant = dialog.kind === "addOccupant";
      const applicantExtraFields: FormFieldSpec[] = isOccupant
        ? []
        : [
            { kind: "text", name: "employment", label: "Employer", span: 2 },
            { kind: "number", name: "income", label: "Stated monthly income", type: "number" },
            { kind: "text", name: "notes", label: "Notes", span: 2 },
          ];
      return (
        <SpecDialog
          title={isOccupant ? "Add proposed occupant" : "Add co-applicant"}
          description={
            isOccupant
              ? "Occupants live in the unit but are not applicants and are not screened."
              : "Co-applicants are applying as tenants and are screened separately."
          }
          onClose={onClose}
          onSubmit={(v) => {
            const existing = state.people.find((p) => p.email.toLowerCase() === v.email.toLowerCase());
            dispatch({
              type: "ADD_PARTY",
              activityType: isOccupant ? "applicant_added" : "co_applicant_added",
              party: {
                id: uid("pty"),
                applicationId,
                personId: existing?.id,
                role: (isOccupant ? "Proposed Occupant" : "Co-Applicant") as PartyRole,
                isPrimary: false,
                fullName: v.fullName,
                email: v.email,
                phone: v.phone,
                currentAddress: v.address,
                preferredContact: v.contact as never,
                relationship: v.relationship || (isOccupant ? "Occupant" : "Co-applicant"),
                incomeMonthly: v.income ? Number(v.income) : undefined,
                employment: v.employment,
                screeningStatus: isOccupant ? "Not Applicable" : "Not Started",
                requiredDocuments: isOccupant ? [] : ["Rental Application Form"],
                signatureRequired: !isOccupant,
                signatureStatus: isOccupant ? "Not Applicable" : "Not Sent",
                notes: v.notes,
              },
            });
            toast({
              variant: "success",
              title: `${isOccupant ? "Occupant" : "Co-applicant"} added`,
              description: existing ? "Linked to the existing person record." : "New application party created locally.",
              simulated: true,
            });
            onClose();
          }}
          spec={[
            { kind: "text", name: "fullName", label: "Full legal name", required: true, span: 2 },
            { kind: "email", name: "email", label: "Email", type: "email", required: true },
            { kind: "tel", name: "phone", label: "Phone", type: "tel" },
            { kind: "text", name: "address", label: "Current address", span: 2 },
            { kind: "select", name: "contact", label: "Preferred contact", options: ["Email", "Phone", "Text Message", "Mail"], defaultValue: "Email" },
            { kind: "text", name: "relationship", label: isOccupant ? "Relationship to applicant" : "Household role", placeholder: isOccupant ? "e.g. Child of applicant (age 9)" : "e.g. Spouse, roommate" },
            ...applicantExtraFields
          ]}
        />
      );
    }

    case "editParty": {
      const party = parties.find((p) => p.id === dialog.partyId);
      if (!party) return null;
      const partyExtraFields: FormFieldSpec[] =
        party.role === "Proposed Occupant"
          ? [{ kind: "text", name: "notes", label: "Notes", span: 2, defaultValue: party.notes ?? "" }]
          : [
              { kind: "text", name: "employment", label: "Employer", defaultValue: party.employment ?? "", span: 2 },
              { kind: "number", name: "income", label: "Stated monthly income", type: "number", defaultValue: party.incomeMonthly ? String(party.incomeMonthly) : "" },
              { kind: "select", name: "screening", label: "Screening status", options: SCREENING_STATES, defaultValue: party.screeningStatus },
              { kind: "select", name: "signature", label: "Signature status", options: ["Not Sent", "Sent", "Signed", "Not Applicable"], defaultValue: party.signatureStatus },
              { kind: "textarea", name: "notes", label: "Notes", span: 2, defaultValue: party.notes ?? "" },
            ];
      return (
        <SpecDialog
          title={`Edit ${party.role.toLowerCase()} — ${party.fullName}`}
          description="Edits the application's copy of the party details. The underlying person record is untouched."
          onClose={onClose}
          onSubmit={(v) => {
            dispatch({
              type: "UPDATE_PARTY",
              id: party.id,
              patch: {
                fullName: v.fullName,
                preferredName: v.preferredName || undefined,
                email: v.email,
                phone: v.phone,
                currentAddress: v.address,
                preferredContact: v.contact as never,
                relationship: v.relationship,
                incomeMonthly: v.income ? Number(v.income) : undefined,
                employment: v.employment,
                screeningStatus: v.screening as ScreeningStatus,
                signatureStatus: v.signature as never,
                notes: v.notes,
              },
            });
            toast({ variant: "success", title: "Applicant details updated", simulated: true });
            onClose();
          }}
          spec={[
            { kind: "text", name: "fullName", label: "Full legal name", required: true, defaultValue: party.fullName, span: 2 },
            { kind: "text", name: "preferredName", label: "Preferred name", defaultValue: party.preferredName ?? "" },
            { kind: "text", name: "relationship", label: "Relationship / household role", defaultValue: party.relationship },
            { kind: "email", name: "email", label: "Email", type: "email", required: true, defaultValue: party.email },
            { kind: "tel", name: "phone", label: "Phone", type: "tel", defaultValue: party.phone },
            { kind: "text", name: "address", label: "Current address", span: 2, defaultValue: party.currentAddress ?? "" },
            { kind: "select", name: "contact", label: "Preferred contact method", options: ["Email", "Phone", "Text Message", "Mail"], defaultValue: party.preferredContact },
            ...partyExtraFields
          ]}
        />
      );
    }

    case "removeParty": {
      const party = parties.find((p) => p.id === dialog.partyId);
      if (!party) return null;
      return (
        <ConfirmDialog
          open
          title={`Remove ${party.role.toLowerCase()}`}
          tone="danger"
          confirmLabel="Remove from application"
          requireReason
          reasonPlaceholder="Why is this party being removed?"
          message={
            <>
              Remove <strong>{party.fullName}</strong> from {app.applicationNumber}? Their person and tenant records are
              kept, and any documents they uploaded stay with the application.
            </>
          }
          onCancel={onClose}
          onConfirm={(reason) => {
            dispatch({ type: "REMOVE_PARTY", id: party.id, reason: reason ?? "Removed by staff", removedBy: by });
            onClose();
          }}
        />
      );
    }

    case "linkTenant": {
      const party = parties.find((p) => p.id === dialog.partyId);
      if (!party) return null;
      const options = [
        "Create a new person record",
        ...state.people.map((p) => `${p.fullName} — ${p.email}${p.tenantId ? " (existing tenant)" : ""}`),
      ];
      return (
        <SpecDialog
          title="Create or link a person record"
          description="Avoids duplicate tenants: pick an existing person, or create one from the application details."
          onClose={onClose}
          onSubmit={(v) => {
            if (v.person === "Create a new person record") {
              dispatch({
                type: "LINK_PERSON",
                partyId: party.id,
                newPerson: {
                  id: uid("per"),
                  fullName: party.fullName,
                  email: party.email,
                  phone: party.phone,
                  currentAddress: party.currentAddress ?? "",
                },
              });
            } else {
              const person = state.people.find((p) => v.person.startsWith(p.fullName));
              dispatch({ type: "LINK_PERSON", partyId: party.id, personId: person?.id });
            }
            toast({ variant: "success", title: "Person record linked", simulated: true });
            onClose();
          }}
          spec={[{ kind: "select", name: "person", label: "Person record", options, required: true, span: 2 }]}
        />
      );
    }

    case "viewTenant": {
      const party = parties.find((p) => p.id === dialog.partyId);
      const person = party?.personId ? personOf(state, party.personId) : undefined;
      const tenant = person?.tenantId ? tenantOf(state, person.tenantId) : undefined;
      return (
        <Modal
          open
          onClose={onClose}
          title={person ? `Tenant profile — ${person.fullName}` : "No person record linked"}
          description="Read-only view of the existing tenant record. Tenant data is owned by the Tenants module."
          size="md"
          footer={
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
          }
        >
          {!person || !tenant ? (
            <p className="text-[13px] text-u-muted">
              This applicant has no person or tenant record yet. Use “Create or link tenant record” to attach one
              without duplicating data.
            </p>
          ) : (
            <InfoGrid cols={2}>
              <Info label="Full legal name" value={person.fullName} />
              <Info label="Preferred name" value={person.preferredName ?? "—"} />
              <Info label="Email" value={person.email} />
              <Info label="Phone" value={person.phone} />
              <Info label="Tenant code" value={tenant.code} mono />
              <Info label="Tenant status" value={tenant.status} />
              <Info label="Current address" value={person.currentAddress} className="sm:col-span-2" />
              <Info label="Tenancy since" value={formatDate(tenant.since)} />
              <Info label="Account balance" value={currency(tenant.balanceCents / 100)} />
            </InfoGrid>
          )}
        </Modal>
      );
    }

    /* ------------------------------ Documents ---------------------------- */
    case "uploadDocs":
      return <UploadDialog applicationId={applicationId} onClose={onClose} />;

    case "documentMeta": {
      const doc = state.documents.find((d) => d.id === dialog.documentId);
      if (!doc) return null;
      return (
        <SpecDialog
          title="Edit document metadata"
          description="Title, category, status, and notes. Replacing the file itself is a separate versioned action."
          onClose={onClose}
          onSubmit={(v) => {
            dispatch({
              type: "UPDATE_DOCUMENT",
              id: doc.id,
              updatedBy: by,
              patch: {
                title: v.title,
                category: v.category as DocumentCategory,
                status: v.status as DocumentStatus,
                notes: v.notes,
                applicationPartyId: v.applicant === "Not applicant-specific" ? undefined : parties.find((p) => p.fullName === v.applicant)?.id,
              },
              note: `Document metadata updated — ${v.title}`,
            });
            toast({ variant: "success", title: "Document updated", simulated: true });
            onClose();
          }}
          spec={[
            { kind: "text", name: "title", label: "Document title", required: true, defaultValue: doc.title, span: 2 },
            { kind: "select", name: "category", label: "Category", options: DOCUMENT_CATEGORIES, defaultValue: doc.category },
            { kind: "select", name: "status", label: "Status", options: ["Received", "Under Review", "Accepted", "Needs Replacement", "Archived"], defaultValue: doc.status },
            { kind: "select", name: "applicant", label: "Belongs to", options: ["Not applicant-specific", ...parties.map((p) => p.fullName)], defaultValue: parties.find((p) => p.id === doc.applicationPartyId)?.fullName ?? "Not applicant-specific", span: 2 },
            { kind: "textarea", name: "notes", label: "Notes", rows: 3, span: 2, defaultValue: doc.notes ?? "" },
          ]}
        />
      );
    }

    case "setDocumentStatus": {
      const doc = state.documents.find((d) => d.id === dialog.documentId);
      if (!doc) return null;
      return (
        <SpecDialog
          title={`Set document status — ${doc.title}`}
          onClose={onClose}
          onSubmit={(v) => {
            dispatch({ type: "SET_DOCUMENT_STATUS", id: doc.id, status: v.status as DocumentStatus, updatedBy: by, note: v.note });
            onClose();
          }}
          spec={[
            { kind: "select", name: "status", label: "Status", options: ["Received", "Under Review", "Accepted", "Needs Replacement", "Archived"], defaultValue: doc.status },
            { kind: "text", name: "note", label: "Note", span: 2 },
          ]}
        />
      );
    }

    case "replaceDocument": {
      const doc = state.documents.find((d) => d.id === dialog.documentId);
      if (!doc) return null;
      return <ReplaceDialog documentId={doc.id} applicationId={applicationId} onClose={onClose} />;
    }

    case "versionHistory": {
      const doc = state.documents.find((d) => d.id === dialog.documentId);
      if (!doc) return null;
      return (
        <Modal
          open
          onClose={onClose}
          title={`Version history — ${doc.title}`}
          description="Previous versions are retained so application records are never silently overwritten."
          size="lg"
          footer={
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
          }
        >
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge tone="indigo">Current version v{doc.versionNumber}</Badge>
              <DocumentStatusBadge status={doc.status} />
              {doc.previousVersionId && (
                <span className="font-mono text-[11px] text-u-muted">previous: {doc.previousVersionId}</span>
              )}
            </div>
            <div className="overflow-hidden rounded-lg border border-u-line">
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr className="border-b border-u-line bg-u-s2/70 text-left text-[10px] tracking-wide text-u-muted uppercase">
                    <th className="px-2.5 py-1.5">Version</th>
                    <th className="px-2.5 py-1.5">File</th>
                    <th className="px-2.5 py-1.5">Size</th>
                    <th className="px-2.5 py-1.5">Uploaded</th>
                    <th className="px-2.5 py-1.5">Uploaded by</th>
                    <th className="px-2.5 py-1.5">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-u-line/70">
                  {doc.versions
                    .slice()
                    .reverse()
                    .map((v) => (
                      <tr key={v.id} className={v.versionNumber === doc.versionNumber ? "bg-u-accent/[0.06]" : undefined}>
                        <td className="px-2.5 py-1.5">
                          <span className="flex items-center gap-1.5">
                            <span className="font-mono">v{v.versionNumber}</span>
                            {v.versionNumber === doc.versionNumber && <Badge tone="emerald">current</Badge>}
                          </span>
                        </td>
                        <td className="max-w-[200px] truncate px-2.5 py-1.5 font-mono text-[11.5px]">{v.fileName}</td>
                        <td className="px-2.5 py-1.5">{fileSize(v.fileSize)}</td>
                        <td className="px-2.5 py-1.5">{formatDate(v.uploadedAt)}</td>
                        <td className="px-2.5 py-1.5">{v.uploadedBy}</td>
                        <td className="px-2.5 py-1.5 text-[11.5px] text-u-muted">{v.notes ?? "—"}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            <p className="text-[11.5px] text-u-muted">
              {isSupabaseConfigured ? "Each version is kept; open the current file from the document row." : "Storage references are not populated in the prototype, so historical files cannot be streamed back."}
            </p>
          </div>
        </Modal>
      );
    }

    case "deleteDocument": {
      const doc = state.documents.find((d) => d.id === dialog.documentId);
      if (!doc) return null;
      return (
        <ConfirmDialog
          open
          title="Delete document"
          tone="danger"
          confirmLabel="Delete document"
          requireReason
          reasonPlaceholder="Reason for deletion (retained in the audit log)"
          message={
            <>
              Delete <strong>{doc.title}</strong> ({doc.fileName})? The record is soft-deleted and hidden immediately;
              permanent purge from storage happens after the retention window and requires a backend job. Deleting a
              document does not delete the applicant's person record.
            </>
          }
          onCancel={onClose}
          onConfirm={(reason) => {
            dispatch({ type: "DELETE_DOCUMENT", id: doc.id, deletedBy: `${by}${reason ? ` — ${reason}` : ""}` });
            toast({ variant: "warn", title: "Document deleted", description: "Soft delete recorded in the activity log.", simulated: true });
            onClose();
          }}
        />
      );
    }

    /* --------------------------- Communications -------------------------- */
    case "communication":
      return (
        <SpecDialog
          title={dialog.method ? `Record ${dialog.method.toLowerCase()}` : "Add communication note"}
          description="Creates a communication record in the local activity log. No message is sent."
          onClose={onClose}
          onSubmit={(v) => {
            dispatch({
              type: "ADD_COMMUNICATION",
              communication: {
                id: uid("com"),
                applicationId,
                applicationPartyId: parties.find((p) => p.fullName === v.applicant)?.id,
                contactMethod: (v.method || "Phone Call") as ApplicationCommunication["contactMethod"],
                subject: v.subject,
                summary: v.summary,
                createdAt: v.date || today,
                createdBy: by,
                followUpRequired: v.followUp === "Yes",
                followUpDate: v.followUp === "Yes" ? v.due || addDays(3) : undefined,
                followUpStatus: v.followUp === "Yes" ? "Open" : undefined,
              },
            });
            logActivity(`${v.method || "Phone call"} logged — ${v.subject}`, v.summary, "communication_logged");
            toast({ variant: "success", title: "Communication logged", description: "Mock record — nothing was sent.", simulated: true });
            onClose();
          }}
          spec={[
            { kind: "select", name: "method", label: "Contact method", options: CONTACT_METHODS, defaultValue: dialog.method ?? "Phone Call" },
            { kind: "date", name: "date", label: "Communication date", type: "date", defaultValue: today },
            { kind: "select", name: "applicant", label: "Applicant", options: ["Household", ...parties.map((p) => p.fullName)], defaultValue: parties.find((p) => p.isPrimary)?.fullName ?? "Household", span: 2 },
            { kind: "text", name: "subject", label: "Subject", required: true, span: 2 },
            { kind: "textarea", name: "summary", label: "Summary", required: true, rows: 3, span: 2 },
            { kind: "select", name: "followUp", label: "Follow-up required?", options: ["No", "Yes"], defaultValue: "No" },
            { kind: "date", name: "due", label: "Follow-up due date", type: "date", defaultValue: addDays(3) },
          ]}
        />
      );

    case "followUp":
      return (
        <SpecDialog
          title="Add follow-up task"
          description="Creates a follow-up item attached to this application."
          onClose={onClose}
          onSubmit={(v) => {
            dispatch({
              type: "ADD_COMMUNICATION",
              communication: {
                id: uid("com"),
                applicationId,
                contactMethod: "Portal Message",
                subject: `[Follow-up] ${v.task}`,
                summary: v.note || "Follow-up task created by staff.",
                createdAt: today,
                createdBy: by,
                followUpRequired: true,
                followUpDate: v.due || addDays(2),
                followUpStatus: "Open",
              },
            });
            toast({ variant: "success", title: "Follow-up task added", simulated: true });
            onClose();
          }}
          spec={[
            { kind: "text", name: "task", label: "Task", required: true, span: 2 },
            { kind: "date", name: "due", label: "Due date", type: "date", defaultValue: addDays(2) },
            { kind: "textarea", name: "note", label: "Details", rows: 2, span: 2 },
          ]}
        />
      );

    /* --------------------------- Lease & records ------------------------- */
    case "createLease":
      return <CreateLeaseModal applicationId={applicationId} onClose={onClose} />;

    case "viewLease": {
      const lease = app.createdLeaseId ? leaseOf(state, app.createdLeaseId) : undefined;
      return (
        <Modal
          open
          onClose={onClose}
          title={lease ? `Lease ${lease.leaseNumber}` : "No lease created"}
          description={lease ? "Linked lease created from this application." : "This application has not been converted to a lease."}
          size="lg"
          footer={
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
          }
        >
          {!lease ? (
            <p className="text-[13px] text-u-muted">
              Use <strong>Create Lease</strong> on an approved application to start the conversion workflow.
            </p>
          ) : (
            <div className="space-y-3">
              <InfoGrid cols={3}>
                <Info label="Lease number" value={lease.leaseNumber} mono />
                <Info label="Status" value={lease.status} />
                <Info label="Created" value={formatDate(lease.createdAt)} />
                <Info label="Property" value={propertyOf(state, lease.propertyId)?.name ?? "—"} />
                <Info label="Unit" value={`Unit ${unitOf(state, lease.unitId)?.unitNumber ?? "—"}`} />
                <Info label="Monthly rent" value={currency(lease.monthlyRent)} />
                <Info label="Term" value={`${lease.termMonths} months`} />
                <Info label="Start" value={formatDate(lease.startDate)} />
                <Info label="End" value={formatDate(lease.endDate)} />
                <Info label="Security deposit" value={currency(lease.securityDeposit)} />
                <Info label="Tenants on lease" value={String(lease.tenantPersonIds.length)} />
                <Info label="Occupants" value={lease.occupantNames.join(", ") || "—"} />
              </InfoGrid>
              <div className="rounded-lg border border-u-line bg-u-s2/50 px-3 py-2 text-[12px] text-u-muted">
                {lease.notes}
              </div>
              <div className="rounded-lg border border-u-ok/25 bg-u-ok/[0.06] px-3 py-2 text-[12px] text-u-ok">
                The application record and its review history remain intact, and the unit is still shown as{" "}
                {unitOf(state, lease.unitId)?.status ?? "—"} — occupancy updates when the lease move-in is completed.
              </div>
            </div>
          )}
        </Modal>
      );
    }

    case "viewProperty":
      return (
        <Modal
          open
          onClose={onClose}
          title={property?.name ?? "Property"}
          description="Read-only view from the Properties module."
          size="lg"
          footer={
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
          }
        >
          <InfoGrid cols={2}>
            <Info label="Property name" value={property?.name} />
            <Info label="Type" value={property?.propertyType} />
            <Info label="Address" value={`${property?.addressLine1}, ${property?.city}, ${property?.state} ${property?.postalCode}`} className="sm:col-span-2" />
            <Info label="Year built" value={property?.yearBuilt} />
            <Info label="Managed by" value={staffName(state, property?.managerId)} />
            <Info label="Units" value={`${state.units.filter((u) => u.propertyId === property?.id).length} units`} />
            <Info label="Open applications" value={`${state.applications.filter((a) => a.propertyId === property?.id && !["Archived", "Draft"].includes(a.status)).length}`} />
          </InfoGrid>
        </Modal>
      );

    case "viewUnit":
      return (
        <Modal
          open
          onClose={onClose}
          title={`Unit ${unit?.unitNumber} — ${property?.name ?? ""}`}
          description="Read-only view from the Units module."
          size="lg"
          footer={
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
          }
        >
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              {unit && <UnitStatusBadge status={unit.status} />}
              <span className="text-[12px] text-u-muted">
                Available {formatDate(unit?.availableFrom)} · application approval does not change this status
              </span>
            </div>
            <InfoGrid cols={3}>
              <Info label="Unit number" value={unit?.unitNumber} />
              <Info label="Unit type" value={unit?.unitType} />
              <Info label="Size" value={unit ? `${unit.squareFeet} sq ft` : "—"} />
              <Info label="Beds / Baths" value={unit ? `${unit.bedrooms} / ${unit.bathrooms}` : "—"} />
              <Info label="Advertised rent" value={currency(unit?.advertisedRent)} />
              <Info label="Parking" value={unit ? `${unit.parkingSpaces} · ${currency(unit.parkingFee)}/mo` : "—"} />
              <Info label="Pet policy" value={unit?.petPolicy} className="sm:col-span-2" />
              <Info label="Notes" value={unit?.notes ?? "—"} />
              <Info
                label="Active applications"
                value={`${state.applications.filter((a) => a.unitId === unit?.id && !["Archived", "Draft"].includes(a.status)).length}`}
              />
            </InfoGrid>
          </div>
        </Modal>
      );

    default:
      return null;
  }
}

/* ---------------------------- Upload sub-dialogs -------------------------- */

function UploadDialog({ applicationId, onClose }: { applicationId: string; onClose: () => void }) {
  const { state, dispatch, toast, uid } = useStore();
  const parties = partiesOf(state, applicationId);
  const [files, setFiles] = useState<{ id: string; file: File; title: string; category: DocumentCategory; partyId?: string; notes?: string }[]>([]);
  const [dragging, setDragging] = useState(false);

  const commit = () => {
    if (!files.length) return;
    dispatch({
      type: "ADD_DOCUMENTS",
      uploadedBy: `${state.currentUser.name} (Staff upload)`,
      documents: files.map((f) => ({
        applicationId,
        applicationPartyId: f.partyId,
        title: f.title,
        category: f.category,
        fileName: f.file.name,
        fileType: f.file.name.split(".").pop()?.toUpperCase() ?? "PDF",
        fileSize: f.file.size,
        uploadedAt: isoDay(),
        notes: f.notes,
        file: f.file,
        id: uid("doc"),
      })),
    });
    toast(
      isSupabaseConfigured
        ? { variant: "success", title: `${files.length} document${files.length === 1 ? "" : "s"} uploading`, description: "Files are stored privately with the application." }
        : { variant: "warn", title: `${files.length} document${files.length === 1 ? "" : "s"} recorded`, description: "Metadata only — document storage is not connected in this prototype.", simulated: true },
    );
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Upload documents"
      description="Batch upload with categories, applicant attribution, and notes."
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!files.length} onClick={commit}>
            Upload {files.length || ""} Document{files.length === 1 ? "" : "s"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            setFiles((f) => [
              ...f,
              ...Array.from(e.dataTransfer.files).map((file, i) => ({
                id: `${Date.now()}-${i}-${file.name}`,
                file,
                title: file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " "),
                category: "Supporting Document" as DocumentCategory,
              })),
            ]);
          }}
          className={`rounded-xl border-2 border-dashed px-4 py-6 text-center ${dragging ? "border-brand bg-brand/8" : "border-line-2 bg-canvas-2/40"}`}
        >
          <p className="text-[13px] text-u-ink">Drop files here or</p>
          <label className="mt-2 inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-u-line2 bg-u-s2 px-2.5 py-1.5 text-xs text-u-ink hover:border-u-accent/60">
            Browse Files
            <input
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                setFiles((f) => [
                  ...f,
                  ...Array.from(e.target.files ?? []).map((file, i) => ({
                    id: `${Date.now()}-${i}-${file.name}`,
                    file,
                    title: file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " "),
                    category: "Supporting Document" as DocumentCategory,
                  })),
                ]);
                e.target.value = "";
              }}
            />
          </label>
        </div>

        {files.map((f, idx) => (
          <div key={f.id} className="grid gap-2 rounded-lg border border-u-line bg-u-card/60 p-2.5 sm:grid-cols-2">
            <div className="sm:col-span-2 flex items-center justify-between gap-2">
              <span className="truncate font-mono text-[11.5px] text-u-ink2">
                {f.file.name} · {fileSize(f.file.size)}
              </span>
              <button
                type="button"
                className="text-[11px] text-u-danger hover:underline"
                onClick={() => setFiles((list) => list.filter((x) => x.id !== f.id))}
              >
                Remove
              </button>
            </div>
            <Input
              value={f.title}
              placeholder="Document title"
              onChange={(e) =>
                setFiles((list) => list.map((x, i) => (i === idx ? { ...x, title: e.target.value } : x)))
              }
            />
            <Select
              value={f.category}
              onChange={(e) =>
                setFiles((list) =>
                  list.map((x, i) => (i === idx ? { ...x, category: e.target.value as DocumentCategory } : x)),
                )
              }
            >
              {DOCUMENT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
            <Select
              value={f.partyId ?? ""}
              onChange={(e) => setFiles((list) => list.map((x, i) => (i === idx ? { ...x, partyId: e.target.value || undefined } : x)))}
            >
              <option value="">Not applicant-specific</option>
              {parties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.fullName} ({p.role})
                </option>
              ))}
            </Select>
            <Input
              value={f.notes ?? ""}
              placeholder="Notes (optional)"
              onChange={(e) => setFiles((list) => list.map((x, i) => (i === idx ? { ...x, notes: e.target.value } : x)))}
            />
          </div>
        ))}

        <div className="flex items-center gap-2 rounded-lg border border-u-warn/30 bg-u-warn/[0.07] px-3 py-2 text-[11.5px] text-u-warn">
          <MockTag label="Storage not connected" />
          <span>{isSupabaseConfigured ? "Files are stored privately and only visible to people with document access." : "Only the file name, size, and type are captured. No bytes are uploaded."}</span>
        </div>
      </div>
    </Modal>
  );
}

function ReplaceDialog({
  documentId,
  applicationId,
  onClose,
}: {
  documentId: string;
  applicationId: string;
  onClose: () => void;
}) {
  const { state, dispatch, toast } = useStore();
  const doc = state.documents.find((d) => d.id === documentId);
  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState("");
  if (!doc) return null;

  return (
    <Modal
      open
      onClose={onClose}
      title={`Replace — ${doc.title}`}
      description={`The current version (v${doc.versionNumber}) is preserved in version history.`}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!file}
            onClick={() => {
              dispatch({
                type: "REPLACE_DOCUMENT",
                id: doc.id,
                updatedBy: state.currentUser.name,
                version: {
                  fileName: file!.name,
                  fileSize: file!.size,
                  fileType: file!.name.split(".").pop()?.toUpperCase() ?? "PDF",
                  notes,
                  file: file!,
                },
              });
              void applicationId;
              toast({ variant: "success", title: `Replaced with v${doc.versionNumber + 1}`, description: "Previous version retained.", simulated: true });
              onClose();
            }}
          >
            Upload new version
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="rounded-lg border border-u-line bg-u-s2/50 px-3 py-2 text-[12px] text-u-muted">
          Current file: <span className="font-mono text-u-ink2">{doc.fileName}</span> · {fileSize(doc.fileSize)} ·{" "}
          {doc.fileType}
        </div>
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-u-line2 bg-u-s2/40 px-4 py-6 text-center hover:border-u-accent/60">
          <span className="text-[13px] text-u-ink">{file ? file.name : "Choose a replacement file"}</span>
          <span className="text-[11.5px] text-u-muted">
            {file ? `${fileSize(file.size)} ready` : isSupabaseConfigured ? "Choose the new file" : "Only the file metadata is captured in the prototype"}
          </span>
          <input type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </label>
        <Textarea
          rows={3}
          placeholder="What changed in this version?"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <div className="flex items-start gap-2 rounded-lg border border-u-line bg-u-s2/50 px-3 py-2 text-[11.5px] text-u-muted">
          <Checkbox
            checked
            onChange={() => undefined}
            label="Keep the previous version viewable in version history"
            description="Required — application records are never overwritten."
          />
        </div>
      </div>
    </Modal>
  );
}
