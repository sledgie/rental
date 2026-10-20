import type { ApplicationStatus } from "../../data/types";

/**
 * Every interaction that opens a dialog inside the expanded application row is
 * described here so sections stay presentational and the dialog host owns the
 * forms + validation.
 */
export type DialogRequest =
  | { kind: "editApplication" }
  | { kind: "status"; status?: ApplicationStatus }
  | { kind: "decision"; decision: "Approved" | "Declined" }
  | { kind: "startReview" }
  | { kind: "reviewNote" }
  | { kind: "requestInfo" }
  | { kind: "infoReceived" }
  | { kind: "referenceCheck" }
  | { kind: "screeningStatus" }
  | { kind: "completeReview" }
  | { kind: "addCoApplicant" }
  | { kind: "addOccupant" }
  | { kind: "editParty"; partyId: string }
  | { kind: "removeParty"; partyId: string }
  | { kind: "linkTenant"; partyId: string }
  | { kind: "viewTenant"; partyId: string }
  | { kind: "uploadDocs" }
  | { kind: "documentMeta"; documentId: string }
  | { kind: "replaceDocument"; documentId: string }
  | { kind: "versionHistory"; documentId: string }
  | { kind: "deleteDocument"; documentId: string }
  | { kind: "setDocumentStatus"; documentId: string }
  | { kind: "communication"; method?: string }
  | { kind: "followUp" }
  | { kind: "createLease" }
  | { kind: "viewLease" }
  | { kind: "viewProperty" }
  | { kind: "viewUnit" }
  | { kind: "archiveApplication" };

export interface SectionProps {
  applicationId: string;
  open: (d: DialogRequest) => void;
}
