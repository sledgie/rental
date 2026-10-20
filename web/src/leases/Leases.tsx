import { Fragment, useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { ArrowDown, ArrowDownUp, ArrowUp, ArrowUpDown, ArrowUpRight, Building2, FileText, Users, ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Download, Eye, Pencil, Plus, Search, ShieldCheck, X } from "lucide-react";
import Icon from "./components/Icon";
import { createPortal } from "react-dom";
import { Button, DataField, EmptyState, IconButton, SectionTitle, TextLink } from "../tenants/components/ui";
import { FilterCheckbox, FilterField, FilterPopover, SearchField, SortControl } from "../shell/directory";
import { useLeaseData } from "./store";
import { isLeaseExpiringSoon } from "./summary";
import LeaseDetails, { type DetailTab, type LeaseDetailActions } from "./components/LeaseDetails";
import LeaseWizard, { type LeaseWizardPayload } from "./components/LeaseWizard";
import StatusBadge from "./components/StatusBadge";
import { lockScroll } from "../shell/scrollLock";
import {
  AddPartyModal,
  AddUnitModal,
  ConfirmationModal,
  DocumentHistoryModal,
  DocumentMetadataModal,
  DocumentPreviewModal,
  FinancialTermsModal,
  LeaseEditorModal,
  PartyEditorModal,
  PersonProfileModal,
  RenewalModal,
  SignatureModal,
  TransactionModal,
  type DocumentMetadataValues,
  type LeaseEditValues,
  type PartyEditValues,
  type PartyValues,
  type RenewalValues,
} from "./components/LeaseDialogs";
import {
  dateOffset,
  formatDate,
  formatMoney,
  leaseMonthlyRent,
  type Lease,
  type LeaseActivity,
  type LeaseData,
  type LeaseDocument,
  type LeaseParty,
  type LeaseRenewal,
  type LeaseStatus,
  type PartyRole,
  type TenantRecord,
} from "./leaseData";

type ToastState = { message: string; kind: "success" | "error" | "info" } | null;
type ConfirmState = { title: string; message: string; confirmLabel?: string; destructive?: boolean; onConfirm: () => void } | null;
type PartyModalState = { leaseId: string; role: PartyRole } | null;
type RenewalModalState = { leaseId: string; type: "Renewal" | "Amendment" } | null;
type SortKey = "name" | "startDate" | "endDate" | "rent";

type LeaseTab = "All statuses" | "Active" | "Expiring soon" | "Pending signature" | "Draft & review" | "Ended";
const LEASE_TABS: LeaseTab[] = ["All statuses", "Active", "Expiring soon", "Pending signature", "Draft & review", "Ended"];
const TAB_LABEL: Record<LeaseTab, string> = { "All statuses": "All leases", Active: "Active", "Expiring soon": "Expiring soon", "Pending signature": "Pending signature", "Draft & review": "Draft & review", Ended: "Ended" };
function tabMatches(tab: string, lease: Lease) {
  if (tab === "Active") return lease.status === "Active";
  if (tab === "Expiring soon") return isLeaseExpiringSoon(lease);
  if (tab === "Pending signature") return lease.status === "Pending Signature";
  if (tab === "Draft & review") return lease.status === "Draft" || lease.status === "Pending Review";
  if (tab === "Ended") return lease.status === "Expired" || lease.status === "Terminated" || lease.status === "Archived";
  return true;
}

const AVATAR_COLORS = ["blue", "violet", "teal", "amber", "rose", "slate"] as const;
const initialsOf = (name: string) => name.split(/\s+/).filter((w) => /^[A-Za-z0-9]/.test(w)).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
const avatarColor = (value: string) => {
  let h = 0;
  for (const ch of value) h = (h * 31 + ch.charCodeAt(0)) % 997;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
};

const leaseStatuses: LeaseStatus[] = ["Draft", "Pending Review", "Pending Signature", "Active", "Expiring", "Expired", "Terminated", "Archived"];

function makeId(prefix: string) {
  const random = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${random}`;
}

function shiftDate(value: string, days: number) {
  if (!value) return "";
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function leaseLocations(lease: Lease, data: LeaseData) {
  const relationships = data.leaseUnits.filter((link) => link.leaseId === lease.id);
  if (!relationships.length) return { main: "No units assigned", title: "No property or unit linked" };
  const items = relationships.map((link) => {
    const unit = data.units.find((candidate) => candidate.id === link.unitId);
    const property = data.properties.find((candidate) => candidate.id === unit?.propertyId);
    return { property: property?.name ?? "Unknown property", unit: unit?.number ?? "?", address: property ? `${property.address}, ${property.city}` : "" };
  });
  const propertyNames = [...new Set(items.map((item) => item.property))];
  const unitNames = items.map((item) => item.unit);
  const unitsShort = unitNames.length > 2 ? `${unitNames.slice(0, 2).join(", ")} +${unitNames.length - 2}` : unitNames.join(", ");
  const label = propertyNames.length === 1 ? `${propertyNames[0]} | ${unitNames.length === 1 ? "Unit" : "Units"} ${unitsShort}` : `${propertyNames.length} properties | ${unitsShort}`;
  return { main: label, title: items.map((item) => `${item.property} | Unit ${item.unit}${item.address ? ` | ${item.address}` : ""}`).join("\n") };
}

function leasePeopleSummary(lease: Lease, data: LeaseData) {
  const parties = data.parties.filter((party) => party.leaseId === lease.id);
  const main = parties.find((party) => party.role === "Main Tenant");
  const person = data.people.find((item) => item.id === main?.personId);
  if (!parties.length) return "No tenant linked";
  const remainder = parties.length - 1;
  return `${person?.name ?? "Main tenant not set"}${remainder > 0 ? ` +${remainder} more` : ""}`;
}

function countLeaseDocuments(lease: Lease, data: LeaseData) {
  return data.documents.filter((document) => document.leaseId === lease.id).length;
}

function touchLease(data: LeaseData, leaseId: string): Lease[] {
  return data.leases.map((lease) => lease.id === leaseId ? { ...lease, updatedAt: dateOffset(0) } : lease);
}

function PrimaryButton({ children, onClick, className = "", icon }: { children: ReactNode; onClick: () => void; className?: string; icon?: string }) {
  return <button className={`button button-primary ${className}`} onClick={onClick}>{icon && <Icon name={icon} size={16} />}{children}</button>;
}

function Toast({ toast, onDismiss }: { toast: ToastState; onDismiss: () => void }) {
  if (!toast) return null;
  return <div className={`lease-toast lease-toast-${toast.kind}`} role="status" aria-live="polite"><span className="lease-toast-mark"><Icon name={toast.kind === "success" ? "check" : toast.kind === "error" ? "alert" : "help"} size={15} /></span><span>{toast.message}</span><button className="icon-button" aria-label="Dismiss notification" onClick={onDismiss}><Icon name="close" size={14} /></button></div>;
}

/** Master-detail panel: main details only (lease, tenants, property and units). Financial terms, documents, renewals and activity live in the lease drawer. */
function ExpandedLease({ lease, data, onView }: { lease: Lease; data: LeaseData; onView: () => void }) {
  const parties = data.parties.filter((party) => party.leaseId === lease.id);
  const links = data.leaseUnits.filter((link) => link.leaseId === lease.id);
  return (
    <div className="expanded-detail">
      <div className="expanded-detail-top">
        <span>LEASE DETAILS</span>
        <TextLink onClick={onView}>
          Open lease details
          <ArrowUpRight size={12} />
        </TextLink>
      </div>
      <div className="expanded-grid">
        <section className="detail-section is-compact">
          <SectionTitle icon={<FileText size={15} />} title="Lease information" />
          <dl className="lease-facts">
            <DataField label="Lease number">{lease.leaseNumber}</DataField>
            <DataField label="Lease type">{lease.leaseType}</DataField>
            <DataField label="Start date">{lease.startDate ? formatDate(lease.startDate) : "Not set"}</DataField>
            <DataField label="End date">{lease.endDate ? formatDate(lease.endDate) : "No fixed end"}</DataField>
            <DataField label="Status"><StatusBadge status={lease.status}>{lease.status}</StatusBadge></DataField>
          </dl>
        </section>

        <section className="detail-section is-compact">
          <SectionTitle icon={<Users size={15} />} title={`Tenants (${parties.length})`} />
          {parties.length ? (
            <div className="people-list" style={{ maxHeight: 330, overflowY: "auto" }}>
              {parties.map((party) => {
                const person = data.people.find((item) => item.id === party.personId);
                const name = person?.name ?? "Unknown person";
                return (
                  <div className="person-item" key={party.id}>
                    <span className={`avatar avatar-sm avatar-${avatarColor(name)}`} aria-hidden="true">{initialsOf(name)}</span>
                    <div className="person-content">
                      <div className="person-name-line"><span className="person-name">{name}</span></div>
                      <div className="person-relationship"><div className="person-role">{party.role}</div></div>
                      <div className="person-contact-peek">
                        {person?.phone && <a href={`tel:${person.phone.replace(/[^+\d]/g, "")}`}>{person.phone}</a>}
                        {person?.email && <a href={`mailto:${person.email}`}>{person.email}</a>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState compact title="No tenants" description="Add a tenant to this lease from its details." />
          )}
        </section>

        <section className="detail-section is-compact">
          <SectionTitle icon={<Building2 size={15} />} title={`Property & units (${links.length})`} />
          {links.length ? (
            <dl className="lease-facts">
              {links.map((link) => {
                const unit = data.units.find((item) => item.id === link.unitId);
                const property = data.properties.find((item) => item.id === unit?.propertyId);
                return (
                  <DataField key={link.id} label={property?.name ?? "Unknown property"}>
                    Unit {unit?.number ?? "?"}{property ? <span className="muted"> &middot; {property.address}, {property.city}</span> : null}
                  </DataField>
                );
              })}
            </dl>
          ) : (
            <EmptyState compact title="No units" description="No property or unit is linked to this lease." />
          )}
        </section>
      </div>
    </div>
  );
}

export default function Leases({ params }: { params?: Record<string, string> } = {}) {
  const [data, setData] = useLeaseData();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All statuses");
  const [propertyFilter, setPropertyFilter] = useState("All properties");
  const [startAfter, setStartAfter] = useState("");
  const [endBefore, setEndBefore] = useState("");
  const [documentFilter, setDocumentFilter] = useState("All document statuses");
  const [sortKey, setSortKey] = useState<SortKey>("endDate");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [tabsByLease, setTabsByLease] = useState<Record<string, DetailTab>>({});
  const [openLeaseMenu, setOpenLeaseMenu] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editLeaseId, setEditLeaseId] = useState<string | null>(null);
  const [financialLeaseId, setFinancialLeaseId] = useState<string | null>(null);
  const [partyModal, setPartyModal] = useState<PartyModalState>(null);
  const [editPartyId, setEditPartyId] = useState<string | null>(null);
  const [addUnitLeaseId, setAddUnitLeaseId] = useState<string | null>(null);
  const [renewalModal, setRenewalModal] = useState<RenewalModalState>(null);
  const [editDocumentId, setEditDocumentId] = useState<string | null>(null);
  const [signatureDocumentId, setSignatureDocumentId] = useState<string | null>(null);
  const [documentHistoryId, setDocumentHistoryId] = useState<string | null>(null);
  const [previewDocumentId, setPreviewDocumentId] = useState<string | null>(null);
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [profilePersonId, setProfilePersonId] = useState<string | null>(null);
  const [drawerLeaseId, setDrawerLeaseId] = useState<string | null>(null);
  const [replaceTargetId, setReplaceTargetId] = useState<string | null>(null);
  const replaceInput = useRef<HTMLInputElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);

  const notify = (message: string, kind: NonNullable<ToastState>["kind"] = "success") => {
    setToast({ message, kind });
    window.setTimeout(() => setToast(null), 4200);
  };

  const addActivity = (previous: LeaseData, leaseId: string, action: string, details: string): LeaseActivity[] => [
    { id: makeId("activity"), leaseId, date: dateOffset(0), user: "Maya Chen", action, details },
    ...previous.activities,
  ];

  const filteredLeases = useMemo(() => {
    const query = search.trim().toLowerCase();
    let result = data.leases.filter((lease) => {
      const links = data.leaseUnits.filter((link) => link.leaseId === lease.id);
      const parties = data.parties.filter((party) => party.leaseId === lease.id);
      const documents = data.documents.filter((document) => document.leaseId === lease.id);
      const personNames = parties.map((party) => data.people.find((person) => person.id === party.personId)?.name ?? "").join(" ");
      const propertyAndUnit = links.map((link) => {
        const unit = data.units.find((item) => item.id === link.unitId);
        const property = data.properties.find((item) => item.id === unit?.propertyId);
        return `${property?.name ?? ""} ${property?.address ?? ""} ${unit?.number ?? ""}`;
      }).join(" ");
      const matchesSearch = !query || [lease.leaseNumber, lease.name, lease.leaseType, personNames, propertyAndUnit].some((value) => value.toLowerCase().includes(query));
      const matchesStatus = tabMatches(statusFilter, lease);
      const matchesProperty = propertyFilter === "All properties" || links.some((link) => data.units.find((unit) => unit.id === link.unitId)?.propertyId === propertyFilter);
      const matchesStart = !startAfter || (lease.startDate && lease.startDate >= startAfter);
      const matchesEnd = !endBefore || (lease.endDate && lease.endDate <= endBefore);
      const matchesDocumentStatus = documentFilter === "All document statuses" || documents.some((document) => document.status === documentFilter);
      return matchesSearch && matchesStatus && matchesProperty && matchesStart && matchesEnd && matchesDocumentStatus;
    });
    result = [...result].sort((first, second) => {
      let order = 0;
      if (sortKey === "name") order = first.name.localeCompare(second.name);
      if (sortKey === "startDate") order = (first.startDate || "").localeCompare(second.startDate || "");
      if (sortKey === "endDate") order = (first.endDate || "9999-12-31").localeCompare(second.endDate || "9999-12-31");
      if (sortKey === "rent") order = leaseMonthlyRent(first, data.leaseUnits) - leaseMonthlyRent(second, data.leaseUnits);
      return sortDirection === "asc" ? order : -order;
    });
    return result;
  }, [data, search, statusFilter, propertyFilter, startAfter, endBefore, documentFilter, sortKey, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(filteredLeases.length / pageSize));
  const pageLeases = filteredLeases.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const activeFilterCount = [search, statusFilter !== "All statuses", propertyFilter !== "All properties", startAfter, endBefore, documentFilter !== "All document statuses"].filter(Boolean).length;

  const unavailableUnitIds = useMemo(() => new Set(data.leaseUnits.filter((link) => {
    const linkedLease = data.leases.find((lease) => lease.id === link.leaseId);
    return linkedLease?.status === "Active" || linkedLease?.status === "Expiring";
  }).map((link) => link.unitId)), [data.leaseUnits, data.leases]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchInput.current?.focus();
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  useEffect(() => {
    setCurrentPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  const toggleExpanded = (leaseId: string) => setExpandedIds((current) => {
    const next = new Set(current);
    if (next.has(leaseId)) next.delete(leaseId);
    else next.add(leaseId);
    return next;
  });

  const setDetailTab = (leaseId: string, tab: DetailTab) => setTabsByLease((current) => ({ ...current, [leaseId]: tab }));

  const expandLease = (leaseId: string, tab: DetailTab = "Overview") => {
    setExpandedIds((current) => new Set(current).add(leaseId));
    setDetailTab(leaseId, tab);
    setOpenLeaseMenu(null);
  };

  const viewLease = (leaseId: string, tab: DetailTab = "Overview") => {
    setDetailTab(leaseId, tab);
    setDrawerLeaseId(leaseId);
    setOpenLeaseMenu(null);
  };

  // deep link: #/leases?lease=LSE-0001 opens that lease's drawer
  useEffect(() => {
    const key = params?.lease;
    if (!key) return;
    const match = data.leases.find((lease) => lease.id === key || lease.leaseNumber === key);
    if (match) viewLease(match.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params?.lease]);

  // #/leases?expand=LSE-0001 opens that lease's inline summary row
  useEffect(() => {
    const key = params?.expand;
    if (!key) return;
    const match = data.leases.find((lease) => lease.id === key || lease.leaseNumber === key);
    if (match) setExpandedIds((current) => new Set(current).add(match.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params?.expand]);

  // the drawer takes over the page: lock scroll, make the page inert, close on Escape unless a dialog is open on top
  useEffect(() => {
    if (!drawerLeaseId) return;
    const root = document.getElementById("root");
    if (root) root.inert = true;
    const unlockScroll = lockScroll();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !document.querySelector(".ls .modal-backdrop")) setDrawerLeaseId(null);
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      if (root) root.inert = false;
      unlockScroll();
      document.removeEventListener("keydown", onKey, true);
    };
  }, [drawerLeaseId]);

  const updateLease = (leaseId: string, updater: (lease: Lease) => Lease, action: string, details: string) => {
    setData((current) => ({
      ...current,
      leases: current.leases.map((lease) => lease.id === leaseId ? { ...updater(lease), updatedAt: dateOffset(0) } : lease),
      activities: addActivity(current, leaseId, action, details),
    }));
  };

  const saveLeaseWizard = (payload: LeaseWizardPayload, asDraft: boolean) => {
    const leaseId = makeId("lease");
    const numericIds = data.leases.map((lease) => Number(lease.leaseNumber.replace("LSE-", ""))).filter(Number.isFinite);
    const leaseNumber = `LSE-${String(Math.max(0, ...numericIds) + 1).padStart(4, "0")}`;
    const today = dateOffset(0);
    const newLease: Lease = {
      id: leaseId,
      leaseNumber,
      name: payload.name.trim(),
      leaseType: payload.leaseType,
      tenancyStatus: payload.tenancyStatus,
      status: (asDraft ? "Draft" : payload.status) as LeaseStatus,
      startDate: payload.startDate,
      endDate: payload.endDate || undefined,
      renewalEligible: true,
      renewalDeadline: payload.endDate ? shiftDate(payload.endDate, -60) : undefined,
      noticePeriodDays: 60,
      createdAt: today,
      updatedAt: today,
      createdBy: "Maya Chen",
      notes: payload.notes,
      occupancyStatus: (asDraft || payload.status === "Pending Review" || payload.status === "Pending Signature") ? "Not yet occupied" : "Occupied",
      financialTerms: {
        agreedMonthlyRent: payload.monthlyRent > 0 ? payload.monthlyRent : undefined,
        rentDueDay: payload.rentDueDay,
        depositType: payload.depositType,
        depositAmount: payload.depositAmount,
        additionalCharges: [],
        parkingFees: payload.parkingFees,
        storageFees: payload.storageFees,
        utilities: payload.utilities,
        rentIncreaseDetails: payload.rentIncreaseDetails,
        effectiveDate: payload.startDate || undefined,
        paymentFrequency: payload.paymentFrequency,
        paymentMethod: payload.paymentMethod,
        notes: payload.financialNotes,
      },
    };
    const newPeople: TenantRecord[] = [];
    const newParties: LeaseParty[] = payload.parties.map((party) => {
      let personId = party.personId;
      if (!personId && party.newPerson) {
        personId = makeId("person");
        newPeople.push({ id: personId, ...party.newPerson, recordStatus: "Active" });
      }
      return {
        id: makeId("party"), leaseId, personId: personId ?? makeId("person-missing"), role: party.role,
        isPrimaryContact: party.role === "Main Tenant", isSignatory: party.isSignatory,
        signatureStatus: party.signatureStatus, relationshipStartDate: party.startDate,
        relationship: party.relationship, notes: party.notes,
      };
    });
    const newLinks = payload.units.map((unit) => ({ id: makeId("lease-unit"), leaseId, unitId: unit.unitId, allocatedMonthlyRent: unit.rent, startDate: payload.startDate || undefined, endDate: payload.endDate || undefined, notes: unit.notes }));
    const newDocuments: LeaseDocument[] = payload.files.map((item) => {
      const id = makeId("document");
      return {
        id, leaseId, title: item.title, category: item.category, originalFileName: item.file.name,
        fileType: item.file.type || "application/octet-stream", fileSize: item.file.size, uploadedAt: today,
        uploadedBy: "Maya Chen", documentDate: item.documentDate, versionNumber: 1, versionGroupId: makeId("document-version"),
        signatureStatus: "Not required", status: "Draft", storageReference: `simulated://leases/${leaseNumber}/${id}/${item.file.name}`,
        notes: "Simulated in-browser file reference; not uploaded to a server.", uploadProgress: 100, file: item.file,
      };
    });
    setData((current) => ({
      ...current,
      leases: [newLease, ...current.leases],
      leaseUnits: [...newLinks, ...current.leaseUnits],
      people: [...newPeople, ...current.people],
      parties: [...newParties, ...current.parties],
      documents: [...newDocuments, ...current.documents],
      activities: [
        { id: makeId("activity"), leaseId, date: today, user: "Maya Chen", action: asDraft ? "Lease draft created" : "Lease created", details: `${leaseNumber} ${asDraft ? "saved as a draft" : "created in client-side prototype state"}.` },
        ...newDocuments.map((document) => ({ id: makeId("activity"), leaseId, date: today, user: "Maya Chen", action: "Document uploaded", details: `${document.title} staged in simulated storage.` })),
        ...current.activities,
      ],
    }));
    setWizardOpen(false);
    setCurrentPage(1);
    setExpandedIds((current) => new Set(current).add(leaseId));
    setTabsByLease((current) => ({ ...current, [leaseId]: "Overview" }));
    notify(asDraft ? `${leaseNumber} saved as a client-side draft.` : `${leaseNumber} created in this prototype session.`);
  };

  const saveLeaseEdits = (leaseId: string, values: LeaseEditValues) => {
    const lease = data.leases.find((item) => item.id === leaseId);
    if (!lease) return;
    const conflictsWithActiveLease = data.leaseUnits.some((link) => {
      if (link.leaseId !== leaseId) return false;
      return data.leaseUnits.some((other) => {
        if (other.unitId !== link.unitId || other.leaseId === leaseId) return false;
        const otherLease = data.leases.find((candidate) => candidate.id === other.leaseId);
        return otherLease?.status === "Active" || otherLease?.status === "Expiring";
      });
    });
    if ((values.status === "Active" || values.status === "Expiring") && conflictsWithActiveLease) {
      notify("One or more units are already assigned to another active lease.", "error");
      return;
    }
    const statusChanged = lease.status !== values.status;
    updateLease(leaseId, (current) => ({
      ...current, name: values.name, leaseType: values.leaseType, tenancyStatus: values.tenancyStatus, status: values.status, startDate: values.startDate,
      endDate: values.endDate || undefined, renewalEligible: values.renewalEligible, renewalDeadline: values.renewalDeadline || undefined,
      noticePeriodDays: values.noticePeriodDays || undefined, notes: values.notes, occupancyStatus: values.occupancyStatus,
    }), statusChanged ? "Status changed" : "Lease updated", statusChanged ? `${lease.status} to ${values.status}.` : "Lease overview fields were updated.");
    setEditLeaseId(null);
    notify("Lease details updated in this browser session.");
  };

  const saveFinancialTerms = (leaseId: string, terms: Lease["financialTerms"]) => {
    updateLease(leaseId, (lease) => ({ ...lease, financialTerms: terms }), "Financial terms changed", `Contracted monthly rent updated to ${formatMoney(terms.agreedMonthlyRent)}. Actual transactions were not changed.`);
    setFinancialLeaseId(null);
    notify("Contract terms updated. Financial transactions were left unchanged.");
  };

  const saveParty = (leaseId: string, values: PartyValues) => {
    if (values.role === "Main Tenant" && data.parties.some((party) => party.leaseId === leaseId && party.role === "Main Tenant")) {
      notify("A main tenant is already associated with this lease.", "error");
      return;
    }
    const newPersonId = values.newPerson ? makeId("person") : values.personId;
    const person: TenantRecord | null = values.newPerson && newPersonId ? { id: newPersonId, ...values.newPerson } : null;
    const newParty: LeaseParty = {
      id: makeId("party"), leaseId, personId: newPersonId ?? "", role: values.role,
      isPrimaryContact: values.isPrimaryContact, isSignatory: values.isSignatory, signatureStatus: values.signatureStatus,
      relationshipStartDate: values.relationshipStartDate, relationshipEndDate: values.relationshipEndDate || undefined,
      relationship: values.relationship, notes: values.notes,
    };
    setData((current) => ({
      ...current,
      people: person ? [person, ...current.people] : current.people,
      parties: [newParty, ...current.parties],
      leases: touchLease(current, leaseId),
      activities: addActivity(current, leaseId, values.role === "Occupant" ? "Occupant added" : "Lease party added", `${person?.name ?? current.people.find((item) => item.id === newPersonId)?.name ?? "Person"} added as ${values.role}.`),
    }));
    setPartyModal(null);
    notify(`${person?.name ?? "Person"} linked to the lease. Tenant records are not duplicated.`);
  };

  const savePartyEdits = (party: LeaseParty, values: PartyEditValues) => {
    if (values.role === "Main Tenant" && data.parties.some((item) => item.leaseId === party.leaseId && item.id !== party.id && item.role === "Main Tenant")) {
      notify("A different main tenant is already linked. Change that relationship first.", "error");
      return;
    }
    const person = data.people.find((item) => item.id === party.personId);
    setData((current) => ({
      ...current,
      parties: current.parties.map((item) => item.id === party.id ? { ...item, ...values, relationshipEndDate: values.relationshipEndDate || undefined } : item),
      leases: touchLease(current, party.leaseId),
      activities: addActivity(current, party.leaseId, "Lease party updated", `${person?.name ?? "Person"}'s relationship updated to ${values.role}.`),
    }));
    setEditPartyId(null);
    notify("Lease relationship updated.");
  };

  const removeParty = (party: LeaseParty) => {
    const person = data.people.find((item) => item.id === party.personId);
    setConfirmState({
      title: "Remove person from lease?",
      message: `${person?.name ?? "This person"} will be unlinked from this lease. Their underlying tenant/person record will remain in the portfolio.`,
      confirmLabel: "Remove relationship",
      destructive: true,
      onConfirm: () => {
        setData((current) => ({ ...current, parties: current.parties.filter((item) => item.id !== party.id), leases: touchLease(current, party.leaseId), activities: addActivity(current, party.leaseId, "Lease party removed", `${person?.name ?? "Person"} removed from the lease; their underlying person record was retained.`) }));
        setConfirmState(null);
        notify("Person unlinked from the lease. Their record was retained.");
      },
    });
  };

  const unitOptionsFor = (leaseId: string) => {
    const lease = data.leases.find((item) => item.id === leaseId);
    return data.units.filter((unit) => {
      if (data.leaseUnits.some((link) => link.leaseId === leaseId && link.unitId === unit.id)) return false;
      const otherActiveLease = data.leaseUnits.some((link) => {
        if (link.unitId !== unit.id || link.leaseId === leaseId) return false;
        const linkedLease = data.leases.find((candidate) => candidate.id === link.leaseId);
        return linkedLease?.status === "Active" || linkedLease?.status === "Expiring";
      });
      return !otherActiveLease;
    }).map((unit) => ({ unit, propertyName: data.properties.find((property) => property.id === unit.propertyId)?.name ?? "Unknown property" })).filter((option) => option.unit.status !== "Turnover" || lease?.status === "Draft");
  };

  const addUnit = (leaseId: string, unitId: string, rent: number, notes: string, agreedTotal: number) => {
    const blocked = data.leaseUnits.some((link) => link.unitId === unitId && link.leaseId !== leaseId && ["Active", "Expiring"].includes(data.leases.find((lease) => lease.id === link.leaseId)?.status ?? ""));
    if (blocked) {
      notify("This unit is assigned to another active lease and cannot be linked here.", "error");
      return;
    }
    const lease = data.leases.find((item) => item.id === leaseId);
    const unit = data.units.find((item) => item.id === unitId);
    if (!lease || !unit) return;
    const link = { id: makeId("lease-unit"), leaseId, unitId, allocatedMonthlyRent: rent, startDate: lease.startDate || undefined, endDate: lease.endDate, notes };
    setData((current) => ({
      ...current,
      leaseUnits: [link, ...current.leaseUnits],
      leases: current.leases.map((item) => item.id === leaseId ? { ...item, financialTerms: { ...item.financialTerms, agreedMonthlyRent: agreedTotal }, updatedAt: dateOffset(0) } : item),
      activities: addActivity(current, leaseId, "Unit added", `${unit.number} added with a ${formatMoney(rent)} monthly allocation; agreed lease total set to ${formatMoney(agreedTotal)}.`),
    }));
    setAddUnitLeaseId(null);
    notify(`Unit ${unit.number} added. Contracted rent was updated once.`);
  };

  const removeUnit = (leaseId: string, linkId: string) => {
    const link = data.leaseUnits.find((item) => item.id === linkId);
    const unit = data.units.find((item) => item.id === link?.unitId);
    if (!link) return;
    setConfirmState({
      title: "Remove unit from lease?",
      message: `Unit ${unit?.number ?? ""} will be unlinked from this lease. Contracted rent will be recalculated using the remaining agreement allocation.`,
      confirmLabel: "Remove unit",
      destructive: true,
      onConfirm: () => {
        setData((current) => {
          const lease = current.leases.find((item) => item.id === leaseId);
          const remainingLinks = current.leaseUnits.filter((item) => item.id !== linkId);
          const remainingRent = lease ? leaseMonthlyRent(lease, current.leaseUnits) - link.allocatedMonthlyRent : 0;
          return {
            ...current,
            leaseUnits: remainingLinks,
            leases: current.leases.map((item) => item.id === leaseId ? { ...item, financialTerms: { ...item.financialTerms, agreedMonthlyRent: Math.max(0, remainingRent) || undefined }, updatedAt: dateOffset(0) } : item),
            activities: addActivity(current, leaseId, "Unit removed", `Unit ${unit?.number ?? ""} removed; contract rent recalculated from remaining units.`),
          };
        });
        setConfirmState(null);
        notify("Unit removed from the lease.");
      },
    });
  };

  const saveRenewal = (leaseId: string, values: RenewalValues) => {
    const renewal: LeaseRenewal = { id: makeId(values.type.toLowerCase()), originalLeaseId: leaseId, type: values.type, proposedStartDate: values.proposedStartDate || undefined, proposedEndDate: values.proposedEndDate || undefined, proposedRent: values.proposedRent, effectiveDate: values.effectiveDate || undefined, reminderDate: values.reminderDate || undefined, status: values.status, relatedDocumentIds: values.relatedDocumentIds, notes: values.notes, createdAt: dateOffset(0) };
    setData((current) => ({ ...current, renewals: [renewal, ...current.renewals], leases: touchLease(current, leaseId), activities: addActivity(current, leaseId, `${values.type} created`, `${values.type} draft created for review. Current signed terms remain unchanged.`) }));
    setRenewalModal(null);
    notify(`${values.type} draft created. The original agreement remains unchanged.`);
  };

  const advanceRenewal = (renewalId: string, status: LeaseRenewal["status"]) => {
    const renewal = data.renewals.find((item) => item.id === renewalId);
    if (!renewal) return;
    setData((current) => ({
      ...current,
      renewals: current.renewals.map((item) => item.id === renewalId ? { ...item, status } : item),
      leases: touchLease(current, renewal.originalLeaseId),
      activities: addActivity(current, renewal.originalLeaseId, "Renewal status updated", `${renewal.type} ${renewalId} moved to ${status}.`),
    }));
    notify(`Renewal status changed to ${status}. No external reminder or signature was sent.`);
  };

  const uploadDocuments = (leaseId: string, files: File[]) => {
    if (!files.length) return;
    const lease = data.leases.find((item) => item.id === leaseId);
    if (!lease) return;
    const uploads: LeaseDocument[] = files.map((file) => {
      const id = makeId("document");
      return {
        id, leaseId, title: file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " "), category: "Other",
        originalFileName: file.name, fileType: file.type || "application/octet-stream", fileSize: file.size,
        uploadedAt: dateOffset(0), uploadedBy: "Maya Chen", documentDate: dateOffset(0), versionNumber: 1,
        versionGroupId: makeId("document-version"), signatureStatus: "Not required", status: "Draft",
        storageReference: `simulated://leases/${lease.leaseNumber}/${id}/${file.name}`,
        notes: "Simulated in-browser file reference; not uploaded to a server.", uploadProgress: 0, file,
      };
    });
    setData((current) => ({
      ...current,
      documents: [...uploads, ...current.documents],
      leases: touchLease(current, leaseId),
      activities: uploads.reduce((entries, document) => addActivity({ ...current, activities: entries }, leaseId, "Document uploaded", `${document.title} staged in simulated storage.`), current.activities),
    }));
    uploads.forEach((document) => {
      let progress = 0;
      const timer = window.setInterval(() => {
        progress = Math.min(100, progress + 25);
        setData((current) => ({
          ...current,
          documents: current.documents.map((item) => item.id === document.id ? { ...item, uploadProgress: progress } : item),
        }));
        if (progress >= 100) window.clearInterval(timer);
      }, 180);
    });
    notify(`${uploads.length} file${uploads.length === 1 ? "" : "s"} staged in simulated storage. Nothing was uploaded to a server.`, "info");
  };

  const editDocument = (documentId: string, values: DocumentMetadataValues) => {
    const document = data.documents.find((item) => item.id === documentId);
    if (!document) return;
    setData((current) => ({
      ...current,
      documents: current.documents.map((item) => item.id === documentId ? { ...item, ...values, expiryDate: values.expiryDate || undefined, documentDate: values.documentDate || undefined } : item),
      leases: touchLease(current, document.leaseId),
      activities: addActivity(current, document.leaseId, "Document metadata updated", `${values.title} metadata was updated.`),
    }));
    setEditDocumentId(null);
    notify("Document metadata updated in this browser session.");
  };

  const recordSignature = (documentId: string, signedDate: string, signedBy: string) => {
    const document = data.documents.find((item) => item.id === documentId);
    if (!document) return;
    setData((current) => ({
      ...current,
      documents: current.documents.map((item) => item.id === documentId ? { ...item, status: "Signed", signatureStatus: "Signed", signedDate, signedBy, notes: item.notes ? `${item.notes} Recorded as signed outside this prototype.` : "Recorded as signed outside this prototype." } : item),
      leases: touchLease(current, document.leaseId),
      activities: addActivity(current, document.leaseId, "Signature recorded", `${document.title} marked signed by ${signedBy} on ${formatDate(signedDate)}. This was not an electronic signature.`),
    }));
    setSignatureDocumentId(null);
    notify("Signature details recorded. No electronic signature was applied.");
  };

  const archiveDocument = (documentId: string) => {
    const document = data.documents.find((item) => item.id === documentId);
    if (!document) return;
    setConfirmState({
      title: "Archive this document?",
      message: `${document.title} will be marked Archived and retained in the lease record and version history.`,
      confirmLabel: "Archive document",
      onConfirm: () => {
        setData((current) => ({ ...current, documents: current.documents.map((item) => item.id === documentId ? { ...item, status: "Archived" } : item), leases: touchLease(current, document.leaseId), activities: addActivity(current, document.leaseId, "Document archived", `${document.title} archived; metadata and version history retained.`) }));
        setConfirmState(null);
        notify("Document archived; its record is retained.");
      },
    });
  };

  const deleteDocument = (documentId: string) => {
    const document = data.documents.find((item) => item.id === documentId);
    if (!document) return;
    if (document.status === "Signed" || document.signatureStatus === "Signed" || document.status === "Superseded") {
      notify("Signed and superseded agreement records are retained. Archive the document instead.", "error");
      return;
    }
    setConfirmState({
      title: "Delete document from this prototype?",
      message: `${document.title} will be removed from the current browser session. This does not delete a server file because no file-storage service is connected.`,
      confirmLabel: "Delete document",
      destructive: true,
      onConfirm: () => {
        setData((current) => ({ ...current, documents: current.documents.filter((item) => item.id !== documentId), leases: touchLease(current, document.leaseId), activities: addActivity(current, document.leaseId, "Document deleted", `${document.title} removed from prototype state.`) }));
        setConfirmState(null);
        notify("Document removed from this browser session.");
      },
    });
  };

  const beginReplace = (documentId: string) => {
    setReplaceTargetId(documentId);
    window.setTimeout(() => replaceInput.current?.click(), 0);
  };

  const onReplaceFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    const old = data.documents.find((document) => document.id === replaceTargetId);
    event.target.value = "";
    if (!file || !old) return;
    const newId = makeId("document");
    const replacement: LeaseDocument = {
      ...old,
      id: newId,
      title: old.title,
      originalFileName: file.name,
      fileType: file.type || "application/octet-stream",
      fileSize: file.size,
      uploadedAt: dateOffset(0),
      uploadedBy: "Maya Chen",
      documentDate: old.documentDate,
      versionNumber: old.versionNumber + 1,
      previousVersionId: old.id,
      expiryDate: undefined,
      signatureStatus: "Not required",
      status: "Draft",
      storageReference: `simulated://leases/${old.leaseId}/${newId}/${file.name}`,
      notes: "New simulated version. Previous file and signature metadata are retained.",
      signedDate: undefined,
      signedBy: undefined,
      uploadProgress: 100,
      file,
    };
    setData((current) => ({
      ...current,
      documents: [replacement, ...current.documents.map((document) => document.id === old.id ? { ...document, status: "Superseded" as const } : document)],
      leases: touchLease(current, old.leaseId),
      activities: addActivity(current, old.leaseId, "Document version created", `${old.title} v${replacement.versionNumber} created. Previous version retained in history.`),
    }));
    setReplaceTargetId(null);
    notify(`Version ${replacement.versionNumber} created. Earlier document and signature metadata were preserved.`);
  };

  const downloadDocument = (documentId: string) => {
    const document = data.documents.find((item) => item.id === documentId);
    if (!document) return;
    if (document.file) {
      const url = URL.createObjectURL(document.file);
      const link = window.document.createElement("a");
      link.href = url;
      link.download = document.originalFileName;
      link.click();
      URL.revokeObjectURL(url);
      notify("Download started from this browser session.", "info");
      return;
    }
    const content = `Simulated document record\nTitle: ${document.title}\nOriginal file name: ${document.originalFileName}\nStorage reference: ${document.storageReference}\nNo document binary is stored in this prototype.`;
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const anchor = window.document.createElement("a");
    anchor.href = url;
    anchor.download = `${document.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-record.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
    notify("Downloaded a metadata record. The sample file has no stored binary.", "info");
  };

  const archiveLease = (lease: Lease) => setConfirmState({
    title: lease.status === "Archived" ? "Restore this lease?" : "Archive this lease?",
    message: lease.status === "Archived" ? `${lease.leaseNumber} will return to the lease register as a draft workflow record.` : `${lease.leaseNumber} will be moved to Archived. Its units, people, documents, and financial history will remain linked.`,
    confirmLabel: lease.status === "Archived" ? "Restore lease" : "Archive lease",
    destructive: lease.status !== "Archived",
    onConfirm: () => {
      const nextStatus: LeaseStatus = lease.status === "Archived" ? "Draft" : "Archived";
      updateLease(lease.id, (current) => ({ ...current, status: nextStatus }), "Status changed", `Lease moved from ${lease.status} to ${nextStatus}.`);
      setConfirmState(null);
      setOpenLeaseMenu(null);
      notify(`Lease ${nextStatus.toLowerCase()} in this browser session.`);
    },
  });

  const popoverCount = [propertyFilter !== "All properties", startAfter, endBefore, documentFilter !== "All document statuses"].filter(Boolean).length;
  const resetPopover = () => { setPropertyFilter("All properties"); setStartAfter(""); setEndBefore(""); setDocumentFilter("All document statuses"); setCurrentPage(1); };
  const resetFilters = () => {
    setSearch(""); setStatusFilter("All statuses"); setPropertyFilter("All properties"); setStartAfter(""); setEndBefore(""); setDocumentFilter("All document statuses"); setCurrentPage(1);
  };

  const activeEditLease = data.leases.find((lease) => lease.id === editLeaseId);
  const activeFinancialLease = data.leases.find((lease) => lease.id === financialLeaseId);
  const activeParty = data.parties.find((party) => party.id === editPartyId);
  const activePartyPerson = activeParty ? data.people.find((person) => person.id === activeParty.personId) : undefined;
  const activeRenewalLease = renewalModal ? data.leases.find((lease) => lease.id === renewalModal.leaseId) : undefined;
  const activeEditDocument = data.documents.find((document) => document.id === editDocumentId);
  const activeSignatureDocument = data.documents.find((document) => document.id === signatureDocumentId);
  const activeHistoryDocument = data.documents.find((document) => document.id === documentHistoryId);
  const activePreviewDocument = data.documents.find((document) => document.id === previewDocumentId);
  const activeTransaction = data.transactions.find((transaction) => transaction.id === transactionId);
  const activeProfile = data.people.find((person) => person.id === profilePersonId);

  const detailActions = (lease: Lease): LeaseDetailActions => ({
                  onEditLease: () => setEditLeaseId(lease.id), onEditFinancials: () => setFinancialLeaseId(lease.id), onAddUnit: () => setAddUnitLeaseId(lease.id), onRemoveUnit: (linkId) => removeUnit(lease.id, linkId),
                  onAddParty: (role) => setPartyModal({ leaseId: lease.id, role }), onEditParty: (partyId) => setEditPartyId(partyId), onRemoveParty: (partyId) => { const party = data.parties.find((item) => item.id === partyId); if (party) removeParty(party); }, onViewPerson: setProfilePersonId,
                  onUploadFiles: (files) => uploadDocuments(lease.id, files), onEditDocument: setEditDocumentId, onPreviewDocument: setPreviewDocumentId, onDownloadDocument: downloadDocument,
                  onReplaceDocument: beginReplace, onViewVersions: setDocumentHistoryId, onRecordSignature: setSignatureDocumentId, onArchiveDocument: archiveDocument, onDeleteDocument: deleteDocument,
                  onCreateRenewal: (type) => setRenewalModal({ leaseId: lease.id, type }), onRenewalStatus: advanceRenewal, onOpenTransaction: setTransactionId,
  });

  const exportCsv = () => {
    const q = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const csv = [
      ["Lease ID", "Name", "Type", "Property / unit", "Start", "End", "Monthly rent", "Status"],
      ...filteredLeases.map((lease) => [lease.leaseNumber, lease.name, lease.leaseType, leaseLocations(lease, data).main, lease.startDate ?? "", lease.endDate ?? "", leaseMonthlyRent(lease, data.leaseUnits), lease.status]),
    ].map((r) => r.map(q).join(",")).join("\n");
    const link = window.document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    link.download = `leases-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    notify(`Exported ${filteredLeases.length} ${filteredLeases.length === 1 ? "lease" : "leases"} to CSV.`);
  };
  const sortIcon = (key: SortKey) => (sortKey === key ? (sortDirection === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ArrowUpDown size={11} />);
  const ariaSort = (key: SortKey) => (sortKey === key ? (sortDirection === "asc" ? "ascending" : "descending") : undefined);
  const sortBy = (key: SortKey) => {
    if (sortKey === key) setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDirection("asc"); }
    setCurrentPage(1);
  };
  const safePage = Math.min(currentPage, totalPages);

  return <div className="tn ls">
    <div className="app-shell">
      <div className="main-shell">
        <main className="main-content">
          <div className="page-heading">
            <div>
              <div className="page-title-line"><h1>Leases</h1></div>
              <p>Manage lease agreements, tenants, documents, and renewals.</p>
            </div>
            <div className="page-heading-actions">
              <Button onClick={exportCsv}><Download size={15} />Export</Button>
              <Button variant="primary" onClick={() => setWizardOpen(true)}><Plus size={17} />Create lease</Button>
            </div>
          </div>

          <section className="directory-panel" aria-label="Lease directory">
            <div className="directory-tabs" aria-label="Filter leases">
              {LEASE_TABS.map((tab) => (
                <button key={tab} className={`directory-tab ${statusFilter === tab ? "selected" : ""}`} aria-pressed={statusFilter === tab} onClick={() => { setStatusFilter(tab); setCurrentPage(1); }}>
                  {TAB_LABEL[tab]}<span>{data.leases.filter((lease) => tabMatches(tab, lease)).length}</span>
                </button>
              ))}
              <div className="directory-tabs-end"><span className="live-dot" />Demo data</div>
            </div>
            <div className="directory-toolbar">
              <SearchField label="Search leases" placeholder="Search lease ID, name, tenant, property, or unit..." value={search} onChange={(v) => { setSearch(v); setCurrentPage(1); }} />
              <div className="toolbar-actions">
                <FilterPopover title="Filter leases" count={popoverCount} onReset={resetPopover}>
                  <FilterField id="lease-property-filter" label="Property">
                    <select id="lease-property-filter" value={propertyFilter} onChange={(e) => { setPropertyFilter(e.target.value); setCurrentPage(1); }}>
                      <option>All properties</option>
                      {data.properties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}
                    </select>
                  </FilterField>
                  <FilterField id="lease-start-filter" label="Starts on or after">
                    <input id="lease-start-filter" type="date" value={startAfter} onChange={(e) => { setStartAfter(e.target.value); setCurrentPage(1); }} />
                  </FilterField>
                  <FilterField id="lease-end-filter" label="Ends on or before">
                    <input id="lease-end-filter" type="date" value={endBefore} onChange={(e) => { setEndBefore(e.target.value); setCurrentPage(1); }} />
                  </FilterField>
                  <FilterField id="lease-document-filter" label="Document status">
                    <select id="lease-document-filter" value={documentFilter} onChange={(e) => { setDocumentFilter(e.target.value); setCurrentPage(1); }}>
                      <option>All document statuses</option>
                      <option>Draft</option>
                      <option>Awaiting Signature</option>
                      <option>Signed</option>
                      <option>Active</option>
                      <option>Superseded</option>
                      <option>Archived</option>
                      <option>Expired</option>
                    </select>
                  </FilterField>
                </FilterPopover>
                <SortControl
                  label="Sort leases"
                  value={sortKey}
                  defaultValue="endDate"
                  descending={sortDirection === "desc"}
                  options={[{ value: "name", label: "Lease name" }, { value: "startDate", label: "Start date" }, { value: "rent", label: "Monthly rent" }]}
                  onChange={(k) => { setSortKey(k as SortKey); setSortDirection("asc"); setCurrentPage(1); }}
                  onToggle={() => setSortDirection((current) => (current === "asc" ? "desc" : "asc"))}
                />
              </div>
            </div>

            <div className="tenant-table-wrap">
              <table className="tenant-table">
                <caption className="sr-only">Lease directory. Expand a lease to inspect its units, people, documents, renewals and financial terms.</caption>
                <colgroup><col className="col-expand" /><col className="col-tenant" /><col className="col-email" /><col className="col-phone" /><col className="col-units" /><col className="col-balance" /><col className="col-status" /><col className="col-actions" /></colgroup>
                <thead><tr>
                  <th className="expand-cell"><span className="sr-only">Expand</span></th>
                  <th aria-sort={ariaSort("name")}><button onClick={() => sortBy("name")}>Lease{sortIcon("name")}</button></th>
                  <th className="email-cell">Property / unit</th>
                  <th className="phone-cell" aria-sort={ariaSort("endDate")}><button onClick={() => sortBy("endDate")}>Term{sortIcon("endDate")}</button></th>
                  <th className="units-cell">Documents</th>
                  <th className="balance-cell" aria-sort={ariaSort("rent")}><button onClick={() => sortBy("rent")}>Monthly rent{sortIcon("rent")}</button></th>
                  <th className="status-cell">Status</th>
                  <th className="actions-cell">Actions</th>
                </tr></thead>
                <tbody>
                  {pageLeases.map((lease) => {
                    const expanded = expandedIds.has(lease.id);
              const location = leaseLocations(lease, data);
              const numberDocuments = countLeaseDocuments(lease, data);
              const pendingDocs = data.documents.some((document) => document.leaseId === lease.id && document.status === "Awaiting Signature");
              const pendingParties = data.parties.some((party) => party.leaseId === lease.id && party.signatureStatus === "Pending");
              const hasSignedAgreement = data.documents.some((document) => document.leaseId === lease.id && (document.category === "Signed Lease Agreement" || document.category === "Original Lease Agreement") && document.signatureStatus === "Signed" && document.status !== "Superseded" && document.status !== "Archived");
              const missingRequiredInfo = (lease.status === "Active" || lease.status === "Expiring") && (!data.leaseUnits.some((link) => link.leaseId === lease.id) || !data.parties.some((party) => party.leaseId === lease.id && party.role === "Main Tenant") || !hasSignedAgreement);
              const needsAttention = lease.status === "Pending Signature" || pendingDocs || pendingParties || missingRequiredInfo || isLeaseExpiringSoon(lease);
                    const placeSub = data.leaseUnits.filter((link) => link.leaseId === lease.id).length > 1 ? "Multi-unit agreement" : (data.properties.find((property) => property.id === data.units.find((unit) => unit.id === data.leaseUnits.find((link) => link.leaseId === lease.id)?.unitId)?.propertyId)?.address ?? "");
                    return <Fragment key={lease.id}>
                      <tr className={`tenant-row ${expanded ? "tenant-row-expanded" : ""}`}>
                        <td className="expand-cell"><IconButton label={`${expanded ? "Collapse" : "Expand"} ${lease.leaseNumber} ${lease.name}`} className="expand-button" onClick={() => toggleExpanded(lease.id)} aria-expanded={expanded} aria-controls={`detail-${lease.id}`}><ChevronRight size={15} className={expanded ? "chevron-expanded" : ""} /></IconButton></td>
                        <td className="tenant-cell"><div className="tenant-identity"><span className={`avatar avatar-md avatar-${avatarColor(lease.name)}`} aria-hidden="true">{initialsOf(lease.name)}</span><div><button className="tenant-name" onClick={() => viewLease(lease.id, "Overview")}>{lease.name}</button><span className="tenant-number">{lease.leaseNumber}{needsAttention && <span className="attention-dot" title="Lease needs attention" />}<span>{leasePeopleSummary(lease, data)}</span></span></div></div></td>
                        <td className="email-cell" title={location.title}><a>{location.main}</a><span className="tenant-number">{placeSub}</span></td>
                        <td className="phone-cell"><a>{lease.startDate ? formatDate(lease.startDate) : "Not set"}</a><span className="tenant-number">{lease.endDate ? `to ${formatDate(lease.endDate)}` : "No fixed end"}</span></td>
                        <td className="units-cell"><button className="document-count" onClick={() => viewLease(lease.id, "Documents")} aria-label={`${numberDocuments} documents; open lease documents`}><Icon name="file" size={14} /><span>{numberDocuments}</span>{pendingDocs && <span className="pending-document-mark" title="Document awaiting signature">!</span>}</button></td>
                        <td className="balance-cell"><span className="balance-value">{formatMoney(leaseMonthlyRent(lease, data.leaseUnits))}</span><span className="tenant-number">per month</span></td>
                        <td className="status-cell"><StatusBadge status={lease.status}>{lease.status}</StatusBadge></td>
                        <td className="actions-cell"><div className="row-actions">
                          <IconButton label={`View ${lease.leaseNumber}`} onClick={() => viewLease(lease.id, "Overview")}><Eye size={15} /></IconButton>
                          <IconButton label={`Edit ${lease.leaseNumber}`} onClick={() => setEditLeaseId(lease.id)}><Pencil size={14} /></IconButton>
                          <div className="lease-menu-wrap"><button className="icon-button more-action-button" aria-label={`More actions for ${lease.leaseNumber}`} aria-expanded={openLeaseMenu === lease.id} onClick={() => setOpenLeaseMenu((current) => current === lease.id ? null : lease.id)}><Icon name="more" size={17} /></button>{openLeaseMenu === lease.id && <div className="action-menu lease-action-menu"><button onClick={() => { setEditLeaseId(lease.id); setOpenLeaseMenu(null); }}><Icon name="edit" size={14} /> Edit lease details</button><button onClick={() => { setRenewalModal({ leaseId: lease.id, type: "Renewal" }); setOpenLeaseMenu(null); }}><Icon name="refresh" size={14} /> Create renewal draft</button><button onClick={() => { if (navigator.clipboard?.writeText) navigator.clipboard.writeText(lease.leaseNumber).then(() => notify(`${lease.leaseNumber} copied.`)).catch(() => notify(lease.leaseNumber, "info")); else notify(lease.leaseNumber, "info"); setOpenLeaseMenu(null); }}><Icon name="link" size={14} /> Copy lease ID</button><button className={lease.status === "Archived" ? "" : "menu-danger"} onClick={() => archiveLease(lease)}><Icon name={lease.status === "Archived" ? "refresh" : "file"} size={14} /> {lease.status === "Archived" ? "Restore lease" : "Archive lease"}</button></div>}</div>
                        </div></td>
                      </tr>
                      {expanded && <tr className="detail-row" key={`${lease.id}-detail`} id={`detail-${lease.id}`}><td colSpan={8}><ExpandedLease lease={lease} data={data} onView={() => viewLease(lease.id, "Overview")} /></td></tr>}
                    </Fragment>;
                  })}
                </tbody>
              </table>
            </div>
            {!pageLeases.length && (
              <EmptyState
                title={data.leases.length ? "No leases found" : "Your lease directory starts here"}
                description={data.leases.length ? "Try a different search or adjust your filters." : "Create a lease to begin managing agreements, people, and documents."}
                action={<Button onClick={data.leases.length ? resetFilters : () => setWizardOpen(true)}>{data.leases.length ? "Clear search & filters" : "Create your first lease"}</Button>}
              />
            )}
            <div className="table-pagination">
              <p>Showing <strong>{filteredLeases.length ? (safePage - 1) * pageSize + 1 : 0}-{Math.min(safePage * pageSize, filteredLeases.length)}</strong> of <strong>{filteredLeases.length}</strong> leases</p>
              <div className="pagination-controls">
                <label className="page-size">
                  <span>Rows per page</span>
                  <select aria-label="Rows per page" value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setCurrentPage(1); }}><option value={8}>8</option><option value={16}>16</option><option value={24}>24</option></select>
                </label>
                <div className="pagination-buttons">
                  <IconButton className="first-page" label="First page" disabled={safePage === 1} onClick={() => setCurrentPage(1)}><ChevronsLeft size={15} /></IconButton>
                  <IconButton label="Previous page" disabled={safePage === 1} onClick={() => setCurrentPage(safePage - 1)}><ChevronLeft size={15} /></IconButton>
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((n) => totalPages <= 5 || Math.abs(n - safePage) <= 1 || n === 1 || n === totalPages)
                    .map((n, i, arr) => (
                      <Fragment key={n}>
                        {i > 0 && n - arr[i - 1] > 1 && <span className="pagination-ellipsis">...</span>}
                        <button className={`page-number ${safePage === n ? "selected" : ""}`} aria-label={`Page ${n}`} aria-current={safePage === n ? "page" : undefined} onClick={() => setCurrentPage(n)}>{n}</button>
                      </Fragment>
                    ))}
                  <IconButton label="Next page" disabled={safePage === totalPages} onClick={() => setCurrentPage(safePage + 1)}><ChevronRight size={15} /></IconButton>
                  <IconButton className="last-page" label="Last page" disabled={safePage === totalPages} onClick={() => setCurrentPage(totalPages)}><ChevronsRight size={15} /></IconButton>
                </div>
              </div>
            </div>
          </section>
          <div className="directory-footnote">
            <span><ShieldCheck size={13} />Contracted rent shown; actual payments stay in Financials.</span>
            <span>Prototype data<span className="footnote-separator">&middot;</span>Changes stay in this browser session</span>
          </div>
        </main>
      </div>
    </div>

    {createPortal(<div className="tn ls">
    <input ref={replaceInput} type="file" className="visually-hidden" onChange={onReplaceFile} />
    {wizardOpen && <LeaseWizard data={data} unavailableUnitIds={unavailableUnitIds} onClose={() => setWizardOpen(false)} onSave={saveLeaseWizard} />}
    {activeEditLease && <LeaseEditorModal lease={activeEditLease} onClose={() => setEditLeaseId(null)} onSave={(values) => saveLeaseEdits(activeEditLease.id, values)} />}
    {activeFinancialLease && <FinancialTermsModal terms={activeFinancialLease.financialTerms} monthlyRent={leaseMonthlyRent(activeFinancialLease, data.leaseUnits)} onClose={() => setFinancialLeaseId(null)} onSave={(values) => saveFinancialTerms(activeFinancialLease.id, values)} />}
    {partyModal && <AddPartyModal role={partyModal.role} people={data.people.filter((person) => !data.parties.some((party) => party.leaseId === partyModal.leaseId && party.personId === person.id))} hasMainTenant={data.parties.some((party) => party.leaseId === partyModal.leaseId && party.role === "Main Tenant")} onClose={() => setPartyModal(null)} onSave={(values) => saveParty(partyModal.leaseId, values)} />}
    {activeParty && activePartyPerson && <PartyEditorModal party={activeParty} personName={activePartyPerson.name} hasOtherMain={activeParty.role !== "Main Tenant" && data.parties.some((party) => party.leaseId === activeParty.leaseId && party.id !== activeParty.id && party.role === "Main Tenant")} onClose={() => setEditPartyId(null)} onSave={(values) => savePartyEdits(activeParty, values)} />}
    {addUnitLeaseId && (() => {
      const lease = data.leases.find((item) => item.id === addUnitLeaseId);
      if (!lease) return null;
      return <AddUnitModal options={unitOptionsFor(lease.id)} currentTotal={leaseMonthlyRent(lease, data.leaseUnits)} onClose={() => setAddUnitLeaseId(null)} onSave={(unitId, rent, notes, total) => addUnit(lease.id, unitId, rent, notes, total)} />;
    })()}
    {renewalModal && activeRenewalLease && <RenewalModal lease={activeRenewalLease} type={renewalModal.type} monthlyRent={leaseMonthlyRent(activeRenewalLease, data.leaseUnits)} documents={data.documents.filter((document) => document.leaseId === activeRenewalLease.id)} onClose={() => setRenewalModal(null)} onSave={(values) => saveRenewal(activeRenewalLease.id, values)} />}
    {activeEditDocument && <DocumentMetadataModal document={activeEditDocument} onClose={() => setEditDocumentId(null)} onSave={(values) => editDocument(activeEditDocument.id, values)} />}
    {activeSignatureDocument && <SignatureModal document={activeSignatureDocument} onClose={() => setSignatureDocumentId(null)} onSave={(date, by) => recordSignature(activeSignatureDocument.id, date, by)} />}
    {activeHistoryDocument && <DocumentHistoryModal document={activeHistoryDocument} allDocuments={data.documents.filter((document) => document.leaseId === activeHistoryDocument.leaseId)} onClose={() => setDocumentHistoryId(null)} onPreview={(id) => { setDocumentHistoryId(null); setPreviewDocumentId(id); }} />}
    {activePreviewDocument && <DocumentPreviewModal document={activePreviewDocument} onClose={() => setPreviewDocumentId(null)} />}
    {activeTransaction && <TransactionModal transaction={activeTransaction} onClose={() => setTransactionId(null)} />}
    {activeProfile && <PersonProfileModal person={activeProfile} data={data} onClose={() => setProfilePersonId(null)} />}
    {confirmState && <ConfirmationModal title={confirmState.title} message={confirmState.message} confirmLabel={confirmState.confirmLabel} destructive={confirmState.destructive} onClose={() => setConfirmState(null)} onConfirm={confirmState.onConfirm} />}
    <Toast toast={toast} onDismiss={() => setToast(null)} />
    {drawerLeaseId && (() => {
      const lease = data.leases.find((item) => item.id === drawerLeaseId);
      if (!lease) return null;
      return <div className="overlay-backdrop drawer-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setDrawerLeaseId(null); }}>
        <div className="overlay-panel drawer-panel profile-drawer lease-profile-drawer" role="dialog" aria-modal="true" aria-labelledby="lease-drawer-title">
          <div className="overlay-header"><div><h2 id="lease-drawer-title">Lease details</h2><p>Everything about this lease, in one place.</p></div><IconButton label="Close lease details" onClick={() => setDrawerLeaseId(null)}><X size={20} /></IconButton></div>
          <div className="profile-heading">
            <span className={`avatar avatar-xl avatar-${avatarColor(lease.name)}`} aria-hidden="true">{initialsOf(lease.name)}</span>
            <div className="profile-identity"><h2>{lease.name}</h2><div><span>{lease.leaseNumber}</span><StatusBadge status={lease.status}>{lease.status}</StatusBadge></div></div>
            <Button className="profile-edit-button" onClick={() => setEditLeaseId(lease.id)}><Pencil size={14} />Edit lease</Button>
          </div>
          <div className="profile-body lease-drawer-body"><LeaseDetails lease={lease} data={data} tab={tabsByLease[lease.id] ?? "Overview"} onTabChange={(tab) => setDetailTab(lease.id, tab)} actions={detailActions(lease)} /></div>
        </div>
      </div>;
    })()}
    </div>, document.body)}
  </div>;
}
