import {
  documentsOf,
  partiesOf,
  primaryApplicantOf,
  propertyOf,
  unitOf,
  type AppState,
} from "../state/store";
import type { Application, ApplicationStatus } from "../data/types";

export const STATUS_ORDER: ApplicationStatus[] = [
  "New",
  "Under Review",
  "Awaiting Information",
  "Approved",
  "Waitlisted",
  "Declined",
  "Withdrawn",
  "Archived",
  "Draft",
];

export interface RowModel {
  application: Application;
  propertyName: string;
  propertyLine: string;
  unitLine: string;
  propertyAddress: string;
  primaryName: string;
  primaryEmail: string;
  coApplicants: ReturnType<typeof partiesOf>;
  occupants: ReturnType<typeof partiesOf>;
  coApplicantNames: string;
  occupantNames: string;
  docCount: number;
  docSummary: string;
}

export function rowModel(state: AppState, application: Application): RowModel {
  const property = propertyOf(state, application.propertyId);
  const unit = unitOf(state, application.unitId);
  const all = partiesOf(state, application.id);
  const primary = primaryApplicantOf(state, application.id);
  const coApplicants = all.filter((p) => p.role === "Co-Applicant");
  const occupants = all.filter((p) => p.role === "Proposed Occupant");
  const docs = documentsOf(state, application.id);

  return {
    application,
    propertyName: property?.name ?? "Unknown property",
    propertyLine: property ? `${property.name}` : "—",
    propertyAddress: property
      ? `${property.addressLine1}, ${property.city}, ${property.state} ${property.postalCode}`
      : "—",
    unitLine: unit ? `Unit ${unit.unitNumber}` : "—",
    primaryName: primary?.fullName ?? "—",
    primaryEmail: primary?.email ?? "",
    coApplicants,
    occupants,
    coApplicantNames: coApplicants.map((p) => p.fullName).join(", "),
    occupantNames: occupants.map((p) => p.fullName).join(", "),
    docCount: docs.length,
    docSummary: docs
      .slice(0, 4)
      .map((d) => `${d.title} (${d.status})`)
      .join("\n"),
  };
}

export type SortKey = "applicant" | "dateApplied" | "moveIn" | "status" | "rent" | "id";

export const SORT_LABELS: { key: SortKey; label: string }[] = [
  { key: "dateApplied", label: "Date applied" },
  { key: "applicant", label: "Applicant name" },
  { key: "moveIn", label: "Desired move-in" },
  { key: "status", label: "Status" },
  { key: "rent", label: "Monthly rent" },
  { key: "id", label: "Application ID" },
];

export function sortApplications(
  rows: RowModel[],
  key: SortKey,
  dir: "asc" | "desc",
): RowModel[] {
  const factor = dir === "asc" ? 1 : -1;
  const value = (r: RowModel) => {
    switch (key) {
      case "applicant":
        return r.primaryName.toLowerCase();
      case "dateApplied":
        return r.application.submittedAt;
      case "moveIn":
        return r.application.requestedMoveInDate;
      case "status":
        return STATUS_ORDER.indexOf(r.application.status);
      case "rent":
        return r.application.proposedRent ?? r.application.advertisedRent;
      case "id":
        return r.application.applicationNumber;
    }
  };
  return rows
    .slice()
    .sort((a, b) => {
      const av = value(a);
      const bv = value(b);
      if (av === bv) return a.application.applicationNumber < b.application.applicationNumber ? -1 : 1;
      return av > bv ? factor : -factor;
    });
}

export function filterRows(
  rows: RowModel[],
  opts: {
    query: string;
    status: ApplicationStatus | "All";
    propertyId: string;
    unitId: string;
    from: string;
    to: string;
  },
): RowModel[] {
  const q = opts.query.trim().toLowerCase();
  return rows.filter((r) => {
    if (opts.status !== "All" && r.application.status !== opts.status) return false;
    if (opts.propertyId !== "All" && r.application.propertyId !== opts.propertyId) return false;
    if (opts.unitId !== "All" && r.application.unitId !== opts.unitId) return false;
    if (opts.from && r.application.submittedAt < opts.from) return false;
    if (opts.to && r.application.submittedAt > opts.to) return false;
    if (!q) return true;
    const haystack = [
      r.application.applicationNumber,
      r.primaryName,
      r.primaryEmail,
      r.propertyName,
      r.unitLine,
      ...r.coApplicants.map((p) => `${p.fullName} ${p.email}`),
      ...r.occupants.map((p) => p.fullName),
      r.application.status,
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });
}

export const SUMMARY_CARDS: {
  key: string;
  label: string;
  statuses: ApplicationStatus[];
  accent: string;
  hint: string;
}[] = [
  {
    key: "new",
    label: "New Applications",
    statuses: ["New"],
    accent: "text-u-blue",
    hint: "Submitted but review has not started.",
  },
  {
    key: "review",
    label: "Under Review",
    statuses: ["Under Review"],
    accent: "text-u-accent",
    hint: "Actively being screened by an assigned reviewer.",
  },
  {
    key: "awaiting",
    label: "Awaiting Information",
    statuses: ["Awaiting Information"],
    accent: "text-u-warn",
    hint: "Paused pending documents or answers from the applicant.",
  },
  {
    key: "approved",
    label: "Approved",
    statuses: ["Approved"],
    accent: "text-u-ok",
    hint: "Approved applications that may be converted to a lease.",
  },
  {
    key: "waitlisted",
    label: "Waitlisted",
    statuses: ["Waitlisted"],
    accent: "text-u-violet",
    hint: "Qualified applicants waiting on unit availability.",
  },
];
