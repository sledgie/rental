import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
  type Dispatch,
  type ReactNode,
} from "react";
import {
  activities as seedActivities,
  applications as seedApplications,
  communications as seedCommunications,
  documents as seedDocuments,
  leases as seedLeases,
  parties as seedPartyList,
  people as seedPeople,
  properties as seedProperties,
  reviews as seedReviews,
  staff as seedStaff,
  tenants as seedTenants,
  units as seedUnits,
} from "../data/mockData";
import {
  type Application,
  type ApplicationActivity,
  type ApplicationCommunication,
  type ApplicationDocument,
  type ApplicationParty,
  type ApplicationReview,
  type ApplicationStatus,
  type DocumentStatus,
  type ID,
  type Lease,
  type Person,
  type Property,
  type ScreeningStatus,
  type Staff,
  type Tenant,
  type Unit,
} from "../data/types";
import { PERMISSIONS } from "../data/types";
import { isSupabaseConfigured } from "../../lib/supabase";
import { getActiveOrgId, subscribeActiveOrg } from "../../lib/activeOrg";
import { reloadLeaseData } from "../../leases/store";
import * as repo from "../repo";

/* --------------------------------- State --------------------------------- */

export interface Toast {
  id: string;
  title: string;
  description?: string;
  variant: "info" | "success" | "warn" | "error";
  simulated?: boolean;
}

export interface AppState {
  currentUser: Staff;
  staff: Staff[];
  properties: Property[];
  units: Unit[];
  people: Person[];
  tenants: Tenant[];
  leases: Lease[];
  applications: Application[];
  parties: ApplicationParty[];
  documents: ApplicationDocument[];
  reviews: ApplicationReview[];
  activities: ApplicationActivity[];
  communications: ApplicationCommunication[];
  toasts: Toast[];
  seq: number;
}

const demoState: AppState = {
  currentUser: seedStaff[0],
  staff: seedStaff,
  properties: seedProperties,
  units: seedUnits,
  people: seedPeople,
  tenants: seedTenants,
  leases: seedLeases,
  applications: seedApplications,
  parties: seedPartyList,
  documents: seedDocuments,
  reviews: seedReviews,
  activities: seedActivities,
  communications: seedCommunications,
  toasts: [],
  seq: 100,
};

// with Supabase nothing sample is shown: the lists are filled from the organization
const liveState: AppState = {
  currentUser: { id: "", name: "", role: "", email: "", permissions: Object.values(PERMISSIONS) },
  staff: [],
  properties: [], units: [], people: [], tenants: [], leases: [], applications: [], parties: [], documents: [], reviews: [], activities: [], communications: [],
  toasts: [],
  seq: 100,
};
const initialState: AppState = isSupabaseConfigured ? liveState : demoState;

/* -------------------------------- Actions -------------------------------- */

export type Action =
  | { type: "LOAD"; loaded: repo.Loaded }
  | { type: "SET_USER"; id: ID }
  | {
      type: "ADD_APPLICATION";
      application: Application;
      parties: ApplicationParty[];
      documents: Array<Partial<ApplicationDocument> & { applicationId: ID; title: string }>;
    }
  | { type: "UPDATE_APPLICATION"; id: ID; patch: Partial<Application>; activity?: ActivityInput }
  | { type: "SET_STATUS"; id: ID; to: ApplicationStatus; notes?: string; changedBy: string; decision?: boolean }
  | { type: "ADD_ACTIVITY"; applicationId: ID; activity: ActivityInput }
  | {
      type: "ADD_PARTY";
      party: ApplicationParty;
      activityType: "applicant_added" | "co_applicant_added";
    }
  | { type: "UPDATE_PARTY"; id: ID; patch: Partial<ApplicationParty> }
  | { type: "REMOVE_PARTY"; id: ID; reason: string; removedBy: string }
  | { type: "LINK_PERSON"; partyId: ID; personId?: ID; newPerson?: Person }
  | {
      type: "ADD_DOCUMENTS";
      documents: Array<Partial<ApplicationDocument> & { applicationId: ID; title: string }>;
      uploadedBy: string;
    }
  | { type: "UPDATE_DOCUMENT"; id: ID; patch: Partial<ApplicationDocument>; note?: string; updatedBy: string }
  | { type: "SET_DOCUMENT_STATUS"; id: ID; status: DocumentStatus; updatedBy: string; note?: string }
  | {
      type: "REPLACE_DOCUMENT";
      id: ID;
      version: { fileName: string; fileSize: number; fileType: string; notes?: string; file?: File };
      updatedBy: string;
    }
  | { type: "DELETE_DOCUMENT"; id: ID; deletedBy: string }
  | { type: "ADD_REVIEW"; review: ApplicationReview }
  | { type: "UPDATE_REVIEW"; id: ID; patch: Partial<ApplicationReview> }
  | { type: "ADD_COMMUNICATION"; communication: ApplicationCommunication }
  | { type: "COMPLETE_FOLLOW_UP"; communicationId: ID; completedBy: string }
  | { type: "CREATE_LEASE"; lease: Lease }
  | { type: "ADD_PERSON"; person: Person }
  | { type: "PUSH_TOAST"; toast: Toast }
  | { type: "DISMISS_TOAST"; id: string };

let seqCounter = 500;
// with Supabase every new record needs a real UUID, because the id becomes its database primary key
const uid = (prefix: string) => (isSupabaseConfigured ? crypto.randomUUID() : `${prefix}-${++seqCounter}`);

export type ActivityInput = Omit<Partial<ApplicationActivity>, "description"> & {
  description: string;
};

function withActivity(
  state: AppState,
  applicationId: ID,
  activity: ActivityInput,
): ApplicationActivity[] {
  const full: ApplicationActivity = {
    id: uid("act"),
    applicationId,
    activityType: activity.activityType ?? "application_updated",
    description: activity.description,
    details: activity.details,
    createdAt: activity.createdAt ?? new Date().toISOString(),
    createdBy: activity.createdBy ?? "System",
  };
  return [full, ...state.activities];
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "LOAD": {
      const l = action.loaded;
      return {
        ...state,
        currentUser: l.me ?? state.currentUser, staff: l.staff, properties: l.properties, units: l.units, people: l.people, tenants: l.tenants, leases: l.leases, applications: l.applications,
        parties: l.parties, documents: l.documents, reviews: l.reviews, activities: l.activities, communications: l.communications,
      };
    }

    case "SET_USER":
      return { ...state, currentUser: state.currentUser.id === action.id ? state.currentUser : state.staff.find((s) => s.id === action.id) ?? state.currentUser };

    case "ADD_APPLICATION": {
      const activities = withActivity(state, action.application.id, {
        activityType: "application_created",
        description: `Application created — ${action.application.applicationNumber}`,
        details: `Source: ${action.application.applicationSource}`,
        createdBy: action.application.assignedReviewerId
          ? staffName(state, action.application.assignedReviewerId)
          : "Staff",
      });
      // Normalize the incoming draft documents the same way the document
      // pipeline does, so a real storage adapter can slot in later.
      const normalized: ApplicationDocument[] = action.documents.map((partial) => {
        const version = {
          id: isSupabaseConfigured ? uid("ver") : `${partial.id ?? uid("doc")}-v1`,
          versionNumber: 1,
          fileName: partial.fileName ?? "document.pdf",
          fileSize: partial.fileSize ?? 0,
          fileType: partial.fileType ?? "PDF",
          uploadedAt: partial.uploadedAt ?? new Date().toISOString().slice(0, 10),
          uploadedBy: state.currentUser.name,
          notes: partial.notes,
          file: partial.file,
        };
        return {
          id: partial.id ?? uid("doc"),
          applicationId: partial.applicationId,
          applicationPartyId: partial.applicationPartyId,
          title: partial.title,
          category: partial.category ?? "Supporting Document",
          fileName: version.fileName,
          fileType: version.fileType,
          fileSize: version.fileSize,
          uploadedAt: version.uploadedAt,
          uploadedBy: version.uploadedBy,
          versionNumber: 1,
          status: "Received",
          notes: partial.notes,
          versions: [version],
          deletedAt: null,
          storageReference: undefined,
        } satisfies ApplicationDocument;
      });
      const uploadActivity: ApplicationActivity[] =
        normalized.length > 0
          ? [{
              id: uid("act"),
              applicationId: action.application.id,
              activityType: "document_uploaded",
              description: `${normalized.length} document${normalized.length === 1 ? "" : "s"} uploaded at intake`,
              details: normalized.map((n) => n.fileName).join(", "),
              createdAt: new Date().toISOString(),
              createdBy: state.currentUser.name,
            }]
          : [];
      return {
        ...state,
        applications: [action.application, ...state.applications],
        parties: [...state.parties, ...action.parties],
        documents: [...normalized, ...state.documents],
        activities: [...uploadActivity, ...activities],
        seq: state.seq + 1,
      };
    }

    case "UPDATE_APPLICATION": {
      const applications = state.applications.map((a) =>
        a.id === action.id ? { ...a, ...action.patch, updatedAt: new Date().toISOString().slice(0, 10) } : a,
      );
      return {
        ...state,
        applications,
        activities: action.activity
          ? withActivity({ ...state }, action.id, action.activity)
          : state.activities,
      };
    }

    case "SET_STATUS": {
      const target = state.applications.find((a) => a.id === action.id);
      if (!target || target.status === action.to) return state;
      const now = new Date().toISOString().slice(0, 10);
      const acts: Partial<ApplicationActivity> & { description: string } = {
        activityType: action.decision ? "decision_recorded" : "status_changed",
        description: `Status changed — ${target.status} → ${action.to}`,
        details: action.notes,
        createdBy: action.changedBy ?? "System",
      };
      const activities = withActivity(state, action.id, acts);
      if (action.decision) {
        activities.unshift({
          id: uid("act"),
          applicationId: action.id,
          activityType: "status_changed",
          description: `Status changed — ${target.status} → ${action.to}`,
          details: action.notes,
          createdAt: now,
          createdBy: action.changedBy,
        });
      }
      return {
        ...state,
        applications: state.applications.map((a) =>
          a.id === action.id ? { ...a, status: action.to, updatedAt: now } : a,
        ),
        activities,
      };
    }

    case "ADD_ACTIVITY":
      return { ...state, activities: withActivity(state, action.applicationId, action.activity) };

    case "ADD_PARTY": {
      const label =
        action.activityType === "co_applicant_added" ? "Co-applicant added" : "Applicant added";
      return {
        ...state,
        parties: [...state.parties, action.party],
        activities: withActivity(state, action.party.applicationId, {
          activityType: action.activityType,
          description: `${label} — ${action.party.fullName}`,
          details: action.party.personId ? "Linked to an existing person record." : undefined,
          createdBy: state.currentUser.name,
        }),
      };
    }

    case "UPDATE_PARTY":
      return {
        ...state,
        parties: state.parties.map((p) => (p.id === action.id ? { ...p, ...action.patch } : p)),
      };

    case "REMOVE_PARTY": {
      const target = state.parties.find((p) => p.id === action.id);
      if (!target) return state;
      return {
        ...state,
        parties: state.parties.filter((p) => p.id !== action.id),
        activities: withActivity(state, target.applicationId, {
          activityType: "applicant_removed",
          description: `${target.role} removed — ${target.fullName}`,
          details: `${action.reason} · The underlying person record was not deleted.`,
          createdBy: action.removedBy,
        }),
      };
    }

    case "LINK_PERSON": {
      const target = state.parties.find((p) => p.id === action.partyId);
      if (!target) return state;
      let people = state.people;
      let tenants = state.tenants;
      let personId = action.personId;
      if (action.newPerson) {
        people = [...people, action.newPerson];
        personId = action.newPerson.id;
      }
      if (personId && !people.find((p) => p.id === personId)?.tenantId) {
        const exists = tenants.find((t) => t.personId === personId);
        if (!exists) {
          tenants = [
            ...tenants,
            {
              id: uid("tnt"),
              code: `TEN-${1200 + tenants.length}`,
              personId,
              status: "Prospect",
              balanceCents: 0,
              since: new Date().toISOString().slice(0, 10),
            },
          ];
          people = people.map((p) => (p.id === personId ? { ...p, tenantId: uid("tnt") } : p));
        }
      }
      return {
        ...state,
        people,
        tenants,
        parties: state.parties.map((p) => (p.id === action.partyId ? { ...p, personId } : p)),
        activities: withActivity(state, target.applicationId, {
          activityType: "applicant_added",
          description: `Applicant linked to person record — ${target.fullName}`,
          details: "Reused the existing person/tenant record instead of creating a duplicate.",
          createdBy: state.currentUser.name,
        }),
      };
    }

    case "ADD_DOCUMENTS": {
      const created: ApplicationDocument[] = action.documents.map((partial) => {
        const version = {
          id: isSupabaseConfigured ? uid("ver") : `${partial.id ?? uid("doc")}-v1`,
          versionNumber: 1,
          fileName: partial.fileName ?? `${partial.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.pdf`,
          fileSize: partial.fileSize ?? 0,
          fileType: partial.fileType ?? "PDF",
          uploadedAt: partial.uploadedAt ?? new Date().toISOString().slice(0, 10),
          uploadedBy: action.uploadedBy,
          notes: partial.notes,
          file: partial.file,
        };
        return {
          id: partial.id ?? uid("doc"),
          applicationId: partial.applicationId,
          applicationPartyId: partial.applicationPartyId,
          title: partial.title,
          category: partial.category ?? "Supporting Document",
          fileName: version.fileName,
          fileType: version.fileType,
          fileSize: version.fileSize,
          uploadedAt: version.uploadedAt,
          uploadedBy: action.uploadedBy,
          versionNumber: 1,
          status: "Received" as DocumentStatus,
          notes: partial.notes,
          versions: [version],
          deletedAt: null,
          retentionUntil: `${new Date().getFullYear() + 7}-01-01`,
          storageReference: undefined,
        };
      });
      const first = created[0];
      const activities = first
        ? withActivity(state, first.applicationId, {
            activityType: "document_uploaded",
            description:
              created.length === 1
                ? `Document uploaded — ${created[0].title}`
                : `${created.length} documents uploaded`,
            details: created.map((c) => c.fileName).join(", "),
            createdBy: action.uploadedBy,
          })
        : state.activities;
      return { ...state, documents: [...created, ...state.documents], activities };
    }

    case "UPDATE_DOCUMENT": {
      const target = state.documents.find((doc) => doc.id === action.id);
      if (!target) return state;
      return {
        ...state,
        documents: state.documents.map((doc) => (doc.id === action.id ? { ...doc, ...action.patch } : doc)),
        activities: withActivity(state, target.applicationId, {
          activityType: "document_updated",
          description: action.note ?? `Document metadata updated — ${action.patch.title ?? target.title}`,
          details: action.patch.notes && !action.note ? action.patch.notes : undefined,
          createdBy: action.updatedBy,
        }),
      };
    }

    case "SET_DOCUMENT_STATUS": {
      const doc = state.documents.find((x) => x.id === action.id);
      if (!doc) return state;
      return {
        ...state,
        documents: state.documents.map((x) => (x.id === action.id ? { ...x, status: action.status } : x)),
        activities: withActivity(state, doc.applicationId, {
          activityType: action.status === "Archived" ? "document_archived" : "document_updated",
          description: `${doc.title} marked ${action.status}`,
          details: action.note,
          createdBy: action.updatedBy,
        }),
      };
    }

    case "REPLACE_DOCUMENT": {
      const doc = state.documents.find((x) => x.id === action.id);
      if (!doc) return state;
      const nextVersion = doc.versionNumber + 1;
      const version = {
        id: isSupabaseConfigured ? uid("ver") : `${doc.id}-v${nextVersion}`,
        versionNumber: nextVersion,
        fileName: action.version.fileName,
        fileSize: action.version.fileSize,
        fileType: action.version.fileType,
        uploadedAt: new Date().toISOString().slice(0, 10),
        uploadedBy: action.updatedBy,
        notes: action.version.notes,
        file: action.version.file,
      };
      return {
        ...state,
        documents: state.documents.map((x) =>
          x.id === action.id
            ? {
                ...x,
                fileName: version.fileName,
                fileType: version.fileType,
                fileSize: version.fileSize,
                uploadedAt: version.uploadedAt,
                uploadedBy: action.updatedBy,
                versionNumber: nextVersion,
                previousVersionId: doc.versions[doc.versions.length - 1]?.id,
                status: "Received",
                versions: [...x.versions, version],
              }
            : x,
        ),
        activities: withActivity(state, doc.applicationId, {
          activityType: "document_updated",
          description: `${doc.title} replaced with version ${nextVersion}`,
          details: `Previous version ${doc.versionNumber} retained in version history.`,
          createdBy: action.updatedBy,
        }),
      };
    }

    case "DELETE_DOCUMENT": {
      const doc = state.documents.find((x) => x.id === action.id);
      if (!doc) return state;
      return {
        ...state,
        documents: state.documents.map((x) =>
          x.id === action.id ? { ...x, deletedAt: new Date().toISOString().slice(0, 10) } : x,
        ),
        activities: withActivity(state, doc.applicationId, {
          activityType: "document_deleted",
          description: `Document deleted — ${doc.title}`,
          details: "Soft delete pending the retention window. Storage purge requires a backend job.",
          createdBy: action.deletedBy,
        }),
      };
    }

    case "ADD_REVIEW":
      return {
        ...state,
        reviews: [action.review, ...state.reviews],
        activities: withActivity(state, action.review.applicationId, {
          activityType:
            "review_note_added",
          description: `Review recorded — ${action.review.reviewType}`,
          details: action.review.notes,
          createdBy: staffName(state, action.review.reviewerId),
        }),
      };

    case "UPDATE_REVIEW":
      return {
        ...state,
        reviews: state.reviews.map((r) => (r.id === action.id ? { ...r, ...action.patch } : r)),
      };

    case "ADD_COMMUNICATION":
      return {
        ...state,
        communications: [action.communication, ...state.communications],
        activities: withActivity(state, action.communication.applicationId, {
          activityType: "communication_logged",
          description: `${action.communication.contactMethod} logged — ${action.communication.subject}`,
          details: action.communication.summary,
          createdBy: action.communication.createdBy,
        }),
      };

    case "COMPLETE_FOLLOW_UP": {
      const com = state.communications.find((c) => c.id === action.communicationId);
      if (!com) return state;
      return {
        ...state,
        communications: state.communications.map((c) =>
          c.id === action.communicationId
            ? { ...c, followUpStatus: "Completed", followUpRequired: false }
            : c,
        ),
        activities: withActivity(state, com.applicationId, {
          activityType: "follow_up_completed",
          description: `Follow-up completed — ${com.subject}`,
          createdBy: action.completedBy,
        }),
      };
    }

    case "CREATE_LEASE": {
      const app = state.applications.find((a) => a.id === action.lease.applicationId);
      if (!app) return state;
      const now = new Date().toISOString().slice(0, 10);
      return {
        ...state,
        leases: [...state.leases, action.lease],
        applications: state.applications.map((a) =>
          a.id === action.lease.applicationId ? { ...a, createdLeaseId: action.lease.id, updatedAt: now } : a,
        ),
        activities: ([
          ...withActivity(state, app.id, {
            activityType: "lease_created",
            description: `Lease created from application — ${action.lease.leaseNumber}`,
            details:
              "Applicant person records linked to the lease. Application record and review history preserved.",
            createdBy: state.currentUser.name,
          }),
          {
            id: uid("act"),
            applicationId: app.id,
            activityType: "note_added",
            description: `Unit ${unitLabel(state, app.unitId)} not marked occupied after lease creation`,
            details: "Occupancy changes are driven by lease move-in, not by application approval.",
            createdAt: now,
            createdBy: "System",
          },
        ] as ApplicationActivity[]),
      };
    }

    case "ADD_PERSON":
      return { ...state, people: [...state.people, action.person] };

    case "PUSH_TOAST":
      return { ...state, toasts: [...state.toasts, action.toast].slice(-4) };

    case "DISMISS_TOAST":
      return { ...state, toasts: state.toasts.filter((t) => t.id !== action.id) };

    default:
      return state;
  }
}

/* ------------------------------- Selectors ------------------------------- */

export const staffName = (state: AppState, id?: ID | null) =>
  state.staff.find((s) => s.id === id)?.name ?? "Unassigned";

export const propertyOf = (state: AppState, id?: ID) =>
  state.properties.find((p) => p.id === id);

export const unitOf = (state: AppState, id?: ID) => state.units.find((u) => u.id === id);

export const unitLabel = (state: AppState, unitId?: ID) => unitOf(state, unitId)?.unitNumber ?? "—";

export const personOf = (state: AppState, id?: ID) => state.people.find((p) => p.id === id);

export const tenantOf = (state: AppState, id?: ID) => state.tenants.find((t) => t.id === id);

export const leaseOf = (state: AppState, id?: ID) => state.leases.find((l) => l.id === id);

export const partiesOf = (state: AppState, applicationId: ID) =>
  state.parties.filter((p) => p.applicationId === applicationId);

export const documentsOf = (state: AppState, applicationId: ID) =>
  state.documents.filter((d) => d.applicationId === applicationId && !d.deletedAt);

export const reviewsOf = (state: AppState, applicationId: ID) =>
  state.reviews.filter((r) => r.applicationId === applicationId);

export const activitiesOf = (state: AppState, applicationId: ID) =>
  state.activities
    .filter((a) => a.applicationId === applicationId)
    .slice()
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

export const communicationsOf = (state: AppState, applicationId: ID) =>
  state.communications.filter((c) => c.applicationId === applicationId);

export const statusHistoryOf = (state: AppState, applicationId: ID) =>
  state.activities
    .filter((a) => a.applicationId === applicationId && a.activityType === "status_changed")
    .slice()
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

export const primaryApplicantOf = (state: AppState, applicationId: ID) =>
  partiesOf(state, applicationId).find((p) => p.isPrimary) ?? partiesOf(state, applicationId)[0];

export const nextApplicationNumber = (state: AppState) => {
  const max = state.applications.reduce((acc, a) => {
    const n = Number(a.applicationNumber.replace(/\D/g, ""));
    return Number.isFinite(n) ? Math.max(acc, n) : acc;
  }, 0);
  return `APP-${String(max + 1).padStart(isSupabaseConfigured ? 5 : 4, "0")}`;
};

export const nextLeaseNumber = (state: AppState) => {
  const year = new Date().getFullYear();
  const count = state.leases.filter((l) => l.leaseNumber.includes(String(year))).length + 1;
  return `LSE-${year}-${String(count).padStart(4, "0")}`;
};

/* -------------------------------- Provider ------------------------------- */

interface StoreValue {
  /** false while the first load from Supabase is running */
  ready: boolean;
  loadError: string | null;
  state: AppState;
  dispatch: Dispatch<Action>;
  can: (permission: string) => boolean;
  toast: (t: Omit<Toast, "id">) => void;
  uid: (prefix: string) => string;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [status, setStatus] = useState({ ready: !isSupabaseConfigured, error: null as string | null });
  const orgId = useSyncExternalStore(subscribeActiveOrg, getActiveOrgId);
  // last state known to be in the database; changes are written as the difference from it
  const saved = useRef<repo.Slices>(repo.emptySlices());
  const chain = useRef<Promise<void>>(Promise.resolve());
  const userRef = useRef(state.currentUser);
  userRef.current = state.currentUser;

  const can = useCallback(
    (permission: string) => state.currentUser.permissions.includes(permission),
    [state.currentUser],
  );

  const toast = useCallback((t: Omit<Toast, "id">) => {
    if (isSupabaseConfigured) {
      // the prototype wording ("saved to client state", "simulated") no longer applies once the data lives in the database
      const description = t.description
        ?.replace(/^Simulated — no email or text was sent\.$/, "Logged. No email or text was sent.")
        .replace(/^Mock record — nothing was sent\.$/, "Logged. Nothing was sent to the applicant.");
      const stale = /client state|locally|local\b|no backend|not connected|prototype|no bytes|nothing was uploaded/i.test(description ?? "");
      dispatch({ type: "PUSH_TOAST", toast: { ...t, simulated: false, description: stale ? undefined : description, id: uid("toast") } });
      return;
    }
    dispatch({ type: "PUSH_TOAST", toast: { ...t, id: uid("toast") } });
  }, []);

  const slicesOf = (s: AppState): repo.Slices => ({
    people: s.people, leases: s.leases, applications: s.applications, parties: s.parties, documents: s.documents, reviews: s.reviews, activities: s.activities, communications: s.communications,
  });

  const reload = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    const org = getActiveOrgId();
    if (!org) return;
    try {
      await chain.current; // let pending writes finish so they are not overwritten by an older read
      const loaded = await repo.loadAll(org);
      if (getActiveOrgId() !== org) return;
      saved.current = {
        people: loaded.people, leases: loaded.leases, applications: loaded.applications, parties: loaded.parties, documents: loaded.documents, reviews: loaded.reviews, activities: loaded.activities, communications: loaded.communications,
      };
      dispatch({ type: "LOAD", loaded });
      setStatus({ ready: true, error: null });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load applications.";
      setStatus({ ready: true, error: message });
      dispatch({ type: "PUSH_TOAST", toast: { id: uid("toast"), title: "Applications could not be loaded", description: message, variant: "error" } });
    }
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    setStatus({ ready: false, error: null });
    if (orgId) void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  // every change is written to the database as a difference from what is already saved
  useEffect(() => {
    if (!isSupabaseConfigured || !status.ready) return;
    const next = slicesOf(state);
    const prev = saved.current;
    const strip = (x: repo.Slices) => JSON.stringify({ ...x, documents: x.documents.map((d) => ({ ...d, versions: d.versions.map((v) => ({ ...v, file: undefined })) })) });
    if (strip(prev) === strip(next)) return;
    saved.current = next;
    const createdLease = next.leases.length > prev.leases.length;
    chain.current = chain.current
      .then(() => repo.persist(prev, next, userRef.current))
      .then(() => { if (createdLease) void reloadLeaseData(true); })
      .catch((error) => {
        dispatch({ type: "PUSH_TOAST", toast: { id: uid("toast"), title: "The change could not be saved", description: error instanceof Error ? error.message : undefined, variant: "error" } });
        return reload();
      });
  }, [state, status.ready, reload]);

  useEffect(() => {
    if (!state.toasts.length) return;
    const timer = setTimeout(() => {
      dispatch({ type: "DISMISS_TOAST", id: state.toasts[0].id });
    }, 5200);
    return () => clearTimeout(timer);
  }, [state.toasts]);

  const value = useMemo<StoreValue>(
    () => ({ ready: status.ready, loadError: status.error, state, dispatch, can, toast, uid }),
    [status, state, can, toast],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside <StoreProvider>");
  return ctx;
}

/** Convenience helper for review status filters. */
export const screeningIsActive = (s: ScreeningStatus) =>
  s === "In Progress" || s === "Waiting for Information";
