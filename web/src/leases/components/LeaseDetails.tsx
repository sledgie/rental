import { useMemo, useRef, useState, type DragEvent, type ReactNode } from "react";
import {
  documentCategories,
  formatDate,
  formatMoney,
  leaseMonthlyRent,
  type Lease,
  type LeaseData,
  type LeaseParty,
  type LeaseRenewal,
  type PartyRole,
} from "../leaseData";
import Icon from "./Icon";
import StatusBadge from "./StatusBadge";

export type DetailTab = "Overview" | "People & units" | "Financials" | "Documents" | "Renewals" | "Activity";

export interface LeaseDetailActions {
  onEditLease: () => void;
  onEditFinancials: () => void;
  onAddUnit: () => void;
  onRemoveUnit: (linkId: string) => void;
  onAddParty: (role: PartyRole) => void;
  onEditParty: (partyId: string) => void;
  onRemoveParty: (partyId: string) => void;
  onViewPerson: (personId: string) => void;
  onUploadFiles: (files: File[]) => void;
  onEditDocument: (documentId: string) => void;
  onPreviewDocument: (documentId: string) => void;
  onDownloadDocument: (documentId: string) => void;
  onReplaceDocument: (documentId: string) => void;
  onViewVersions: (documentId: string) => void;
  onRecordSignature: (documentId: string) => void;
  onArchiveDocument: (documentId: string) => void;
  onDeleteDocument: (documentId: string) => void;
  onCreateRenewal: (type: "Renewal" | "Amendment") => void;
  onRenewalStatus: (renewalId: string, status: LeaseRenewal["status"]) => void;
  onOpenTransaction: (transactionId: string) => void;
}

interface LeaseDetailsProps {
  lease: Lease;
  data: LeaseData;
  tab: DetailTab;
  onTabChange: (tab: DetailTab) => void;
  actions: LeaseDetailActions;
}

const tabs: DetailTab[] = ["Overview", "People & units", "Financials", "Documents", "Renewals", "Activity"];

function InfoItem({ label, children, wide = false }: { label: string; children: ReactNode; wide?: boolean }) {
  return <div className={`info-item ${wide ? "info-item-wide" : ""}`}><span>{label}</span><strong>{children || "Not set"}</strong></div>;
}

function roleClass(role: string) {
  return `role-${role.toLowerCase().replace(/[^a-z]+/g, "-")}`;
}

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function fileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function humanFileType(value: string) {
  if (!value) return "Unknown";
  if (value === "application/pdf") return "PDF";
  if (value.startsWith("image/")) return value.slice(6).toUpperCase();
  if (value.includes("wordprocessingml")) return "DOCX";
  if (value.includes("spreadsheet")) return "XLSX";
  return value.split("/").pop()?.toUpperCase() ?? "FILE";
}

function StatusDot({ status }: { status: string }) {
  const token = status.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return <span className={`status-dot status-dot-${token}`} aria-hidden="true" />;
}

export default function LeaseDetails({ lease, data, tab, onTabChange, actions }: LeaseDetailsProps) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [documentQuery, setDocumentQuery] = useState("");
  const [documentCategory, setDocumentCategory] = useState("All categories");
  const [openDocumentMenu, setOpenDocumentMenu] = useState<string | null>(null);

  const leaseUnits = data.leaseUnits.filter((link) => link.leaseId === lease.id);
  const leaseParties = data.parties.filter((party) => party.leaseId === lease.id);
  const leaseDocuments = data.documents.filter((document) => document.leaseId === lease.id);
  const leaseRenewals = data.renewals.filter((renewal) => renewal.originalLeaseId === lease.id);
  const leaseTransactions = data.transactions.filter((transaction) => transaction.leaseId === lease.id).sort((a, b) => b.date.localeCompare(a.date));
  const leaseActivities = data.activities.filter((activity) => activity.leaseId === lease.id).sort((a, b) => b.date.localeCompare(a.date));
  const monthlyRent = leaseMonthlyRent(lease, data.leaseUnits);
  const occupiedPeople = leaseParties.map((party) => ({ party, person: data.people.find((person) => person.id === party.personId) })).filter((item) => item.person);
  const pendingSignatures = leaseParties.filter((party) => party.isSignatory && party.signatureStatus === "Pending").length;
  const signedAgreementOnFile = leaseDocuments.some((document) =>
    (document.category === "Signed Lease Agreement" || document.category === "Original Lease Agreement") &&
    document.signatureStatus === "Signed" && document.status !== "Superseded" && document.status !== "Archived",
  );
  const missingRequiredInfo = (lease.status === "Active" || lease.status === "Expiring") &&
    (leaseUnits.length === 0 || !leaseParties.some((party) => party.role === "Main Tenant") || !signedAgreementOnFile);
  const deadlineDays = lease.renewalDeadline ? Math.ceil((new Date(`${lease.renewalDeadline}T12:00:00`).getTime() - new Date(`${new Date().toISOString().slice(0, 10)}T12:00:00`).getTime()) / (1000 * 60 * 60 * 24)) : Number.POSITIVE_INFINITY;
  const attentionMessages = [
    ...(lease.status === "Pending Signature" ? ["Lease workflow is pending signature."] : []),
    ...(pendingSignatures > 0 ? [`${pendingSignatures} signatory response${pendingSignatures > 1 ? "s are" : " is"} still pending.`] : []),
    ...(deadlineDays <= 30 ? [`Renewal / notice deadline ${deadlineDays < 0 ? "passed" : deadlineDays === 0 ? "is today" : `in ${deadlineDays} days`} (${formatDate(lease.renewalDeadline)}).`] : []),
    ...(missingRequiredInfo ? [!leaseUnits.length ? "No unit is linked." : !leaseParties.some((party) => party.role === "Main Tenant") ? "A main tenant is missing." : "A signed lease agreement is missing."] : []),
  ];
  const filteredDocuments = useMemo(() => leaseDocuments.filter((document) => {
    const query = documentQuery.trim().toLowerCase();
    const matchesQuery = !query || [document.title, document.originalFileName, document.category, document.notes, document.documentDate].some((value) => value?.toLowerCase().includes(query));
    const matchesCategory = documentCategory === "All categories" || document.category === documentCategory;
    return matchesQuery && matchesCategory;
  }), [leaseDocuments, documentQuery, documentCategory]);
  const outstanding = leaseTransactions.filter((transaction) => transaction.status === "Outstanding").reduce((total, transaction) => total + Math.max(0, transaction.amount), 0);

  const handleFiles = (files: FileList | File[]) => {
    if (files.length > 0) actions.onUploadFiles(Array.from(files));
  };

  const dropFiles = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (event.dataTransfer.files.length) handleFiles(event.dataTransfer.files);
  };

  const currentTabContent = () => {
    if (tab === "Overview") return (
      <div className="detail-tab-content overview-tab">
        {attentionMessages.length > 0 && <div className="attention-callout"><Icon name="alert" size={17} /><div><strong>Needs attention</strong><span>{attentionMessages.join(" ")}</span></div></div>}
        <div className="detail-section-heading"><div><span className="eyebrow">AGREEMENT PROFILE</span><h3>Lease overview</h3></div><button className="button button-small button-secondary" onClick={actions.onEditLease}><Icon name="edit" size={14} /> Edit details</button></div>
        <div className="overview-grid">
          <div className="info-panel">
            <div className="info-grid">
              <InfoItem label="Lease ID">{lease.leaseNumber}</InfoItem>
              <InfoItem label="Lease name">{lease.name}</InfoItem>
              <InfoItem label="Lease type">{lease.leaseType}</InfoItem>
              <InfoItem label="Tenancy / legal status">{lease.tenancyStatus}</InfoItem>
              <InfoItem label="Workflow status"><StatusBadge status={lease.status} /></InfoItem>
              <InfoItem label="Lease start date">{formatDate(lease.startDate)}</InfoItem>
              <InfoItem label="Fixed-term end date">{lease.endDate ? formatDate(lease.endDate) : "No fixed end date"}</InfoItem>
              <InfoItem label="Renewal eligibility">{lease.renewalEligible ? "Eligible" : "Not eligible / not set"}</InfoItem>
              <InfoItem label="Renewal / notice deadline">{formatDate(lease.renewalDeadline)}</InfoItem>
              <InfoItem label="Notice period">{lease.noticePeriodDays ? `${lease.noticePeriodDays} days` : "Not set"}</InfoItem>
              <InfoItem label="Occupancy status">{lease.occupancyStatus}</InfoItem>
              <InfoItem label="Date created">{formatDate(lease.createdAt)}</InfoItem>
              <InfoItem label="Last updated">{formatDate(lease.updatedAt)}</InfoItem>
              <InfoItem label="Created by">{lease.createdBy}</InfoItem>
              <InfoItem label="Signatures pending">{pendingSignatures || "None"}</InfoItem>
              <InfoItem label="Internal notes" wide>{lease.notes || "No internal notes recorded."}</InfoItem>
            </div>
          </div>
          <aside className="overview-aside">
            <div className="aside-section">
              <div className="aside-section-head"><span>PROPERTY & UNITS</span><button className="text-button" onClick={() => onTabChange("People & units")}>View all</button></div>
              {leaseUnits.length ? leaseUnits.map((link) => {
                const unit = data.units.find((item) => item.id === link.unitId);
                const property = data.properties.find((item) => item.id === unit?.propertyId);
                return <div className="mini-unit" key={link.id}><span className="mini-unit-mark"><Icon name="building" size={15} /></span><div><strong>{property?.name} | Unit {unit?.number}</strong><small>{unit?.type} | {formatMoney(link.allocatedMonthlyRent)} allocation</small></div></div>;
              }) : <div className="empty-inline compact-empty">No units assigned.</div>}
            </div>
            <div className="aside-section">
              <div className="aside-section-head"><span>LEASE PARTIES</span><button className="text-button" onClick={() => onTabChange("People & units")}>View all</button></div>
              {occupiedPeople.slice(0, 4).map(({ party, person }) => <div className="mini-person" key={party.id}><span className={`mini-avatar ${party.role === "Main Tenant" ? "avatar-main" : ""}`}>{initials(person!.name)}</span><div><strong>{person!.name}{party.role === "Main Tenant" && <span className="primary-star"> | MAIN</span>}</strong><small>{party.role}</small></div></div>)}
              {occupiedPeople.length === 0 && <div className="empty-inline compact-empty">No lease parties yet.</div>}
              {occupiedPeople.length > 4 && <button className="text-button more-people-link" onClick={() => onTabChange("People & units")}>+{occupiedPeople.length - 4} more people</button>}
            </div>
            <div className="aside-section aside-metrics">
              <div className="aside-section-head"><span>CONTRACT TERMS</span><button className="text-button" onClick={() => onTabChange("Financials")}>Details</button></div>
              <div className="contract-rent">{formatMoney(monthlyRent)}<small>/ month</small></div>
              <span className="aside-footnote">Agreed contract rent, not cash received</span>
              <div className="mini-document-line"><Icon name="file" size={15} /><span>{leaseDocuments.length} document{leaseDocuments.length === 1 ? "" : "s"}</span><button className="text-button" onClick={() => onTabChange("Documents")}>Manage</button></div>
            </div>
          </aside>
        </div>
        <div className="overview-bottom-grid">
          <div className="overview-summary-block"><span className="eyebrow">CURRENT TERM</span><strong>{formatDate(lease.startDate)} <span>to</span> {lease.endDate ? formatDate(lease.endDate) : "Ongoing"}</strong><small>{lease.leaseType} | {lease.tenancyStatus} | {lease.occupancyStatus.toLowerCase()} occupancy</small></div>
          <div className="overview-summary-block"><span className="eyebrow">RENEWAL WORKSPACE</span><strong>{leaseRenewals.length ? `${leaseRenewals.length} renewal / amendment record${leaseRenewals.length > 1 ? "s" : ""}` : "No changes recorded"}</strong><small>{leaseRenewals[0] ? `${leaseRenewals[0].status} ${leaseRenewals[0].type.toLowerCase()} | created ${formatDate(leaseRenewals[0].createdAt)}` : "Original agreement remains the current set of terms."}</small></div>
        </div>
      </div>
    );

    if (tab === "People & units") return (
      <div className="detail-tab-content people-tab">
        <section className="detail-section">
          <div className="detail-section-heading"><div><span className="eyebrow">PROPERTY RELATIONSHIPS</span><h3>Property & units <span className="section-count">{leaseUnits.length}</span></h3><p>Unit assignments and rent allocations are linked separately to this agreement.</p></div><button className="button button-small button-secondary" onClick={actions.onAddUnit}><Icon name="plus" size={14} /> Add unit</button></div>
          {leaseUnits.length ? <div className="detail-table-wrap"><table className="detail-table unit-detail-table"><thead><tr><th>Property / address</th><th>Unit</th><th>Type</th><th>Unit status</th><th>Allocated monthly rent</th><th>Unit notes</th><th></th></tr></thead><tbody>{leaseUnits.map((link) => {
            const unit = data.units.find((item) => item.id === link.unitId);
            const property = data.properties.find((item) => item.id === unit?.propertyId);
            return <tr key={link.id}><td><strong>{property?.name}</strong><small>{property?.address}, {property?.city}</small></td><td><strong>{unit?.number ?? "Unknown"}</strong></td><td>{unit?.type ?? "Not set"}</td><td><span className="unit-status"><StatusDot status={unit?.status ?? "Unknown"} />{unit?.status ?? "Unknown"}</span></td><td className="numeric-cell">{formatMoney(link.allocatedMonthlyRent)}</td><td>{link.notes || unit?.notes || "-"}</td><td><button className="icon-button danger-hover" aria-label={`Remove unit ${unit?.number ?? "from lease"}`} title="Remove unit from this lease" onClick={() => actions.onRemoveUnit(link.id)}><Icon name="close" size={15} /></button></td></tr>;
          })}</tbody><tfoot><tr><td colSpan={4}>Total allocated to units</td><td className="numeric-cell">{formatMoney(leaseUnits.reduce((total, link) => total + link.allocatedMonthlyRent, 0))}</td><td colSpan={2}>{typeof lease.financialTerms.agreedMonthlyRent === "number" && lease.financialTerms.agreedMonthlyRent !== leaseUnits.reduce((total, link) => total + link.allocatedMonthlyRent, 0) ? `Agreed contract rent is ${formatMoney(lease.financialTerms.agreedMonthlyRent)}.` : "Matches current unit allocations."}</td></tr></tfoot></table></div> : <div className="empty-state small-empty"><Icon name="building" size={20} /><strong>No units assigned</strong><span>Add a property unit to create a lease relationship.</span><button className="button button-small button-secondary" onClick={actions.onAddUnit}>Add unit</button></div>}
        </section>

        <section className="detail-section party-section">
          <div className="detail-section-heading"><div><span className="eyebrow">PEOPLE & OCCUPANCY</span><h3>Tenants, co-tenants & occupants <span className="section-count">{leaseParties.length}</span></h3><p>Party links do not duplicate or delete their underlying tenant records. Occupants are not automatically financially responsible.</p></div><div className="button-group"><button className="button button-small button-secondary" onClick={() => actions.onAddParty("Main Tenant")}><Icon name="plus" size={14} /> Add tenant</button><button className="button button-small button-secondary" onClick={() => actions.onAddParty("Co-Tenant")}>Add co-tenant</button><button className="button button-small button-quiet" onClick={() => actions.onAddParty("Occupant")}>Add occupant</button><button className="button button-small button-quiet" onClick={() => actions.onAddParty("Guarantor")}>Add guarantor</button></div></div>
          {leaseParties.length ? <div className="detail-table-wrap"><table className="detail-table party-detail-table"><thead><tr><th>Name</th><th>Role</th><th>Email / phone</th><th>Occupancy start</th><th>Occupancy end</th><th>Signatory</th><th>Tenant record</th><th>Actions</th></tr></thead><tbody>{leaseParties.map((party: LeaseParty) => {
            const person = data.people.find((item) => item.id === party.personId);
            if (!person) return null;
            return <tr key={party.id}><td><div className="person-name-cell"><span className={`mini-avatar ${party.role === "Main Tenant" ? "avatar-main" : ""}`}>{initials(person.name)}</span><div><strong>{person.name}</strong>{party.isPrimaryContact && <small className="primary-contact-label">Primary contact</small>}</div></div></td><td><span className={`role-label ${roleClass(party.role)}`}>{party.role}</span>{party.relationship && <small className="table-subtext">{party.relationship}</small>}</td><td><strong className="contact-primary">{person.email || "No email"}</strong><small>{person.phone || "No phone"}</small></td><td>{formatDate(party.relationshipStartDate)}</td><td>{party.relationshipEndDate ? formatDate(party.relationshipEndDate) : "-"}</td><td>{party.isSignatory ? <StatusBadge status={party.signatureStatus}>{party.signatureStatus}</StatusBadge> : <span className="muted-cell">Not required</span>}</td><td><StatusBadge status={person.isTenantRecord ? person.recordStatus : "Not a tenant record"}>{person.isTenantRecord ? person.recordStatus : "Not a tenant record"}</StatusBadge></td><td><div className="row-actions compact-actions"><button className="text-button" onClick={() => actions.onViewPerson(person.id)}>Profile</button><button className="icon-button" title="Edit relationship" aria-label={`Edit ${person.name}'s relationship`} onClick={() => actions.onEditParty(party.id)}><Icon name="edit" size={14} /></button><button className="icon-button danger-hover" title="Remove from lease" aria-label={`Remove ${person.name} from this lease`} onClick={() => actions.onRemoveParty(party.id)}><Icon name="close" size={14} /></button></div></td></tr>;
          })}</tbody></table></div> : <div className="empty-state small-empty"><Icon name="people" size={20} /><strong>No people linked to this lease</strong><span>Add the main tenant, other signatories, and authorized occupants.</span><button className="button button-small button-secondary" onClick={() => actions.onAddParty("Main Tenant")}>Add tenant</button></div>}
        </section>
      </div>
    );

    if (tab === "Financials") return (
      <div className="detail-tab-content financial-tab">
        <section className="detail-section">
          <div className="detail-section-heading"><div><span className="eyebrow">CONTRACT VALUE</span><h3>Financial terms</h3><p>Agreed lease terms are separate from charges and payments recorded in Financials.</p></div><button className="button button-small button-secondary" onClick={actions.onEditFinancials}><Icon name="edit" size={14} /> Edit financial terms</button></div>
          <div className="financial-highlight-row"><div className="contract-value"><span>Contracted monthly rent</span><strong>{formatMoney(monthlyRent)}</strong><small>Agreement value | not rent actually received</small></div><div className="financial-key"><span>Rent due day</span><strong>{lease.financialTerms.rentDueDay ? `Day ${lease.financialTerms.rentDueDay} of each month` : "Not set"}</strong></div><div className="financial-key"><span>Outstanding transactions</span><strong className={outstanding > 0 ? "text-warning" : ""}>{formatMoney(outstanding)}</strong><small>From existing transaction records</small></div></div>
          <div className="financial-detail-grid">
            <div className="financial-detail-block"><h4>Rent & allocations</h4><dl className="detail-definition-list"><div><dt>Agreed monthly rent</dt><dd>{formatMoney(monthlyRent)}</dd></div><div><dt>Payment frequency</dt><dd>{lease.financialTerms.paymentFrequency || "Not set"}</dd></div><div><dt>Payment method</dt><dd>{lease.financialTerms.paymentMethod || "Not recorded"}</dd></div><div><dt>Effective date of current rent</dt><dd>{formatDate(lease.financialTerms.effectiveDate)}</dd></div></dl>
              {leaseUnits.length > 0 && <div className="allocation-list"><span className="allocation-list-label">By unit</span>{leaseUnits.map((link) => { const unit = data.units.find((item) => item.id === link.unitId); return <div key={link.id}><span>{unit?.number ?? "Unit"}</span><strong>{formatMoney(link.allocatedMonthlyRent)}</strong></div>; })}<div className="allocation-sum"><span>Allocation total</span><strong>{formatMoney(leaseUnits.reduce((total, link) => total + link.allocatedMonthlyRent, 0))}</strong></div></div>}
            </div>
            <div className="financial-detail-block"><h4>Other agreed terms</h4><dl className="detail-definition-list"><div><dt>Deposit type</dt><dd>{lease.financialTerms.depositType || "Not set"}</dd></div><div><dt>Deposit amount</dt><dd>{formatMoney(lease.financialTerms.depositAmount)}</dd></div>{typeof lease.financialTerms.depositPermitted === "boolean" && <div><dt>Jurisdiction check</dt><dd>{lease.financialTerms.depositPermitted ? "Marked applicable" : "Requires review"}</dd></div>}<div><dt>Parking fees / month</dt><dd>{formatMoney(lease.financialTerms.parkingFees)}</dd></div><div><dt>Storage fees / month</dt><dd>{formatMoney(lease.financialTerms.storageFees)}</dd></div><div><dt>Utilities</dt><dd>{lease.financialTerms.utilities || "Not specified"}</dd></div><div><dt>Rent increase details</dt><dd>{lease.financialTerms.rentIncreaseDetails || "No increase recorded"}</dd></div></dl>
              {lease.financialTerms.additionalCharges.length > 0 && <div className="allocation-list"><span className="allocation-list-label">Additional charges</span>{lease.financialTerms.additionalCharges.map((charge, index) => <div key={`${charge.label}-${index}`}><span>{charge.label}</span><strong>{formatMoney(charge.amount)}</strong></div>)}</div>}
              <div className="financial-note"><span>Financial notes</span><p>{lease.financialTerms.notes || "No financial notes recorded."}</p></div>
            </div>
          </div>
          <div className="legal-config-note"><Icon name="help" size={15} /><span>Deposit rules, permitted fees, rent increases, and notice requirements vary by jurisdiction and tenancy type. Configure and verify local requirements before execution.</span></div>
        </section>
        <section className="detail-section transactions-section"><div className="detail-section-heading"><div><span className="eyebrow">EXISTING FINANCIAL RECORDS</span><h3>Transaction history <span className="section-count">{leaseTransactions.length}</span></h3><p>Read-only view of related Financials records. Opening this lease does not create charges or payments.</p></div><button className="text-button" onClick={() => leaseTransactions[0] && actions.onOpenTransaction(leaseTransactions[0].id)}>View related transaction <Icon name="link" size={13} /></button></div>
          {leaseTransactions.length ? <div className="detail-table-wrap"><table className="detail-table transaction-table"><thead><tr><th>Transaction date</th><th>Description</th><th>Type</th><th>Amount</th><th>Status</th><th>Source transaction</th></tr></thead><tbody>{leaseTransactions.map((transaction) => <tr key={transaction.id}><td>{formatDate(transaction.date)}</td><td><strong>{transaction.description}</strong></td><td>{transaction.type}</td><td className={transaction.amount < 0 ? "amount-credit" : "numeric-cell"}>{transaction.amount < 0 ? "-" : ""}{formatMoney(Math.abs(transaction.amount))}</td><td><StatusBadge status={transaction.status}>{transaction.status}</StatusBadge></td><td><button className="source-link" onClick={() => actions.onOpenTransaction(transaction.id)}>{transaction.sourceReference} <Icon name="link" size={12} /></button></td></tr>)}</tbody></table></div> : <div className="empty-state small-empty"><Icon name="wallet" size={20} /><strong>No related transactions</strong><span>Transactions appear here when linked in the Financials module.</span></div>}
        </section>
      </div>
    );

    if (tab === "Documents") return (
      <div className="detail-tab-content documents-tab">
        <div className="detail-section-heading document-heading"><div><span className="eyebrow">LEASE FILES</span><h3>Documents <span className="section-count">{leaseDocuments.length}</span></h3><p>Multiple documents and preserved versions are linked to this lease.</p></div><button className="button button-small button-primary" onClick={() => fileInput.current?.click()}><Icon name="upload" size={14} /> Upload documents</button></div>
        <div className="storage-callout compact-callout"><Icon name="alert" size={15} /><span><strong>Simulated storage.</strong> Files and metadata remain in this browser session; storage, authorization, and retention controls are not connected.</span></div>
        <div className="dropzone document-dropzone" onDragOver={(event) => event.preventDefault()} onDrop={dropFiles} onClick={() => fileInput.current?.click()} role="button" tabIndex={0} aria-label="Upload multiple lease documents" onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") fileInput.current?.click(); }}>
          <div className="upload-symbol"><Icon name="upload" size={18} /></div><div><strong>Drop multiple files to upload</strong><span>Or browse your device. Document categories and metadata can be edited after upload.</span></div><button type="button" className="button button-small button-secondary" onClick={(event) => { event.stopPropagation(); fileInput.current?.click(); }}>Browse files</button>
        </div>
        <input ref={fileInput} className="visually-hidden" type="file" multiple onChange={(event) => { if (event.target.files) handleFiles(event.target.files); event.target.value = ""; }} />
        <div className="document-tools"><label className="search-input document-search"><Icon name="search" size={16} /><input placeholder="Search title, file name, notes..." value={documentQuery} onChange={(event) => setDocumentQuery(event.target.value)} /></label><select aria-label="Filter document category" value={documentCategory} onChange={(event) => setDocumentCategory(event.target.value)}><option>All categories</option>{documentCategories.map((category) => <option key={category}>{category}</option>)}</select><span className="document-results">{filteredDocuments.length} of {leaseDocuments.length} documents</span></div>
        {filteredDocuments.length ? <div className="detail-table-wrap documents-table-wrap"><table className="detail-table documents-table"><thead><tr><th>Document</th><th>Category</th><th>File</th><th>Uploaded</th><th>Document date</th><th>Version / expiry</th><th>Signature</th><th>Status</th><th>Actions</th></tr></thead><tbody>{filteredDocuments.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt)).map((document) => <tr key={document.id}>
          <td className="document-title-cell"><button className="document-title-button" onClick={() => actions.onPreviewDocument(document.id)}><span className="file-type-icon"><Icon name="file" size={16} /></span><span><strong>{document.title}</strong><small>{document.id}</small></span></button>{typeof document.uploadProgress === "number" && document.uploadProgress < 100 && <div className="upload-progress"><span style={{ width: `${document.uploadProgress}%` }} /></div>}</td>
          <td>{document.category}</td><td><span className="file-name-cell">{document.originalFileName}</span><small className="table-subtext">{humanFileType(document.fileType)} | {fileSize(document.fileSize)}</small></td><td>{formatDate(document.uploadedAt)}<small className="table-subtext">by {document.uploadedBy}</small></td><td>{formatDate(document.documentDate)}</td><td><strong>v{document.versionNumber}</strong><small className="table-subtext">{document.expiryDate ? `Expires ${formatDate(document.expiryDate)}` : document.previousVersionId ? "Versioned record" : "No expiry"}</small></td><td>{document.signatureStatus === "Not required" ? <span className="muted-cell">Not required</span> : <StatusBadge status={document.signatureStatus}>{document.signatureStatus}</StatusBadge>}{document.signedDate && <small className="table-subtext">{formatDate(document.signedDate)}</small>}</td><td><StatusBadge status={document.status}>{typeof document.uploadProgress === "number" && document.uploadProgress < 100 ? `Uploading ${document.uploadProgress}%` : document.status}</StatusBadge></td>
          <td><div className="document-actions"><button className="icon-button" title="Preview document" aria-label={`Preview ${document.title}`} onClick={() => actions.onPreviewDocument(document.id)}><Icon name="eye" size={15} /></button><button className="icon-button" title="Download document" aria-label={`Download ${document.title}`} onClick={() => actions.onDownloadDocument(document.id)}><Icon name="download" size={15} /></button><div className="document-menu-wrap"><button className="icon-button" aria-label={`More actions for ${document.title}`} aria-expanded={openDocumentMenu === document.id} onClick={() => setOpenDocumentMenu((current) => current === document.id ? null : document.id)}><Icon name="more" size={16} /></button>{openDocumentMenu === document.id && <div className="action-menu document-action-menu">
            <button onClick={() => { actions.onEditDocument(document.id); setOpenDocumentMenu(null); }}><Icon name="edit" size={14} /> Edit metadata</button>
            <button onClick={() => { actions.onReplaceDocument(document.id); setOpenDocumentMenu(null); }}><Icon name="refresh" size={14} /> Replace with new version</button>
            <button onClick={() => { actions.onViewVersions(document.id); setOpenDocumentMenu(null); }}><Icon name="activity" size={14} /> Version history</button>
            {document.status !== "Signed" && document.signatureStatus !== "Signed" && <button onClick={() => { actions.onRecordSignature(document.id); setOpenDocumentMenu(null); }}><Icon name="check" size={14} /> Record signed outside app</button>}
            {document.status !== "Archived" && <button onClick={() => { actions.onArchiveDocument(document.id); setOpenDocumentMenu(null); }}><Icon name="file" size={14} /> Archive document</button>}
            {document.signatureStatus !== "Signed" && document.status !== "Signed" && document.status !== "Superseded" && <button className="menu-danger" onClick={() => { actions.onDeleteDocument(document.id); setOpenDocumentMenu(null); }}><Icon name="close" size={14} /> Delete document</button>}
          </div>}</div></div></td>
        </tr>)}</tbody></table></div> : <div className="empty-state small-empty"><Icon name="file" size={20} /><strong>{leaseDocuments.length ? "No matching documents" : "No documents attached"}</strong><span>{leaseDocuments.length ? "Try a different search or category." : "Upload more than one agreement, notice, or supporting file."}</span><button className="button button-small button-secondary" onClick={() => fileInput.current?.click()}>Upload documents</button></div>}
        <div className="document-retention-note"><Icon name="help" size={14} /><span>Replacing a signed document creates a new version and preserves the earlier record. Electronic signatures are not available in this prototype.</span></div>
      </div>
    );

    if (tab === "Renewals") return (
      <div className="detail-tab-content renewals-tab">
        <div className="detail-section-heading"><div><span className="eyebrow">TERMS & CHANGES</span><h3>Renewals & amendments</h3><p>Create a draft or record a proposed change without overwriting the current agreement.</p></div><div className="button-group"><button className="button button-small button-secondary" onClick={() => actions.onCreateRenewal("Renewal")}><Icon name="plus" size={14} /> Create renewal draft</button><button className="button button-small button-quiet" onClick={() => actions.onCreateRenewal("Amendment")}>Add amendment</button></div></div>
        <div className="current-term-bar" id="current-term-anchor"><div><span className="eyebrow">CURRENT AGREEMENT - PRESERVED</span><strong>{formatDate(lease.startDate)} <span>to</span> {lease.endDate ? formatDate(lease.endDate) : "Ongoing / no fixed end"}</strong></div><div><span className="eyebrow">CURRENT CONTRACT RENT</span><strong>{formatMoney(monthlyRent)} <small>/ month</small></strong></div><div><span className="eyebrow">RENEWAL / NOTICE RULE</span><strong>{lease.renewalEligible ? "Eligible" : "Not eligible"} <small>{lease.noticePeriodDays ? `| ${lease.noticePeriodDays} day notice` : ""}</small></strong></div></div>
        <div className="renewal-rule-note"><Icon name="calendar" size={15} /><span>Deadline: <strong>{formatDate(lease.renewalDeadline)}</strong>{lease.renewalDeadline ? ` | ${lease.noticePeriodDays ?? "Configurable"} day notice period` : " | not configured"}. Rules depend on tenancy type and jurisdiction.</span></div>
        {leaseRenewals.length ? <div className="renewal-record-list">{leaseRenewals.map((renewal) => <RenewalRecord key={renewal.id} renewal={renewal} data={data} onStatus={actions.onRenewalStatus} />)}</div> : <div className="empty-state small-empty"><Icon name="refresh" size={20} /><strong>No renewal or amendment drafts</strong><span>Future terms are stored separately from the original signed agreement.</span><button className="button button-small button-secondary" onClick={() => actions.onCreateRenewal("Renewal")}>Start a renewal draft</button></div>}
        <div className="history-strip"><div className="history-strip-icon"><Icon name="activity" size={16} /></div><div><strong>Previous terms and changes</strong><span>{leaseRenewals.length ? "The original agreement and each proposed change are retained as separate records. Related documents are linked to their draft." : "No changes have been recorded. The current agreement remains the only saved term set."}</span></div><button className="text-button" onClick={() => onTabChange("Activity")}>View activity</button></div>
      </div>
    );

    return (
      <div className="detail-tab-content activity-tab">
        <div className="detail-section-heading"><div><span className="eyebrow">AUDIT TRAIL</span><h3>Activity history <span className="section-count">{leaseActivities.length}</span></h3><p>Client-side prototype activity. Changes are not permanently saved.</p></div></div>
        {leaseActivities.length ? <div className="activity-timeline">{leaseActivities.map((activity) => <div className="timeline-entry" key={activity.id}><span className="timeline-marker"><StatusDot status={activity.action} /></span><div className="timeline-body"><div className="timeline-title"><strong>{activity.action}</strong><span>{formatDate(activity.date)}</span></div><p>{activity.details}</p><small>{activity.user}</small></div></div>)}</div> : <div className="empty-state small-empty"><Icon name="activity" size={20} /><strong>No activity recorded</strong><span>Changes made in the prototype will appear here.</span></div>}
      </div>
    );
  };

  return <div className="lease-detail-panel">
    <div className="detail-panel-head"><div className="detail-panel-identity"><span className="detail-panel-kicker">LEASE DETAILS</span><strong>{lease.leaseNumber} <span className="detail-panel-divider">/</span> {lease.name}</strong></div><div className="detail-panel-actions"><StatusBadge status={lease.status} /><button className="icon-button" title="Edit lease overview" aria-label="Edit lease overview" onClick={actions.onEditLease}><Icon name="edit" size={15} /></button></div></div>
    <div className="detail-tabs" role="tablist" aria-label={`${lease.leaseNumber} detail sections`}>{tabs.map((item) => <button key={item} role="tab" aria-selected={tab === item} className={`detail-tab ${tab === item ? "active" : ""}`} onClick={() => onTabChange(item)}>{item}{item === "Documents" && <span className="tab-count">{leaseDocuments.length}</span>}</button>)}</div>
    {currentTabContent()}
  </div>;
}

function RenewalRecord({ renewal, data, onStatus }: { renewal: LeaseRenewal; data: LeaseData; onStatus: (renewalId: string, status: LeaseRenewal["status"]) => void }) {
  const relatedDocuments = data.documents.filter((document) => renewal.relatedDocumentIds.includes(document.id));
  const progression: LeaseRenewal["status"][] = ["Draft", "Pending Review", "Pending Signature", "Approved", "Signed"];
  const nextStatus = progression[Math.min(progression.indexOf(renewal.status) + 1, progression.length - 1)];
  return <article className="renewal-record">
    <div className="renewal-record-top"><div className="renewal-record-title"><span className="renewal-kind-mark"><Icon name={renewal.type === "Renewal" ? "refresh" : "edit"} size={16} /></span><div><div className="renewal-name-line"><h4>{renewal.type} draft</h4><StatusBadge status={renewal.status}>{renewal.status}</StatusBadge></div><span>Created {formatDate(renewal.createdAt)} | linked to {renewal.originalLeaseId}</span></div></div><span className="renewal-record-id">{renewal.id.toUpperCase()}</span></div>
    <div className="renewal-term-grid"><div><span>Proposed start</span><strong>{formatDate(renewal.proposedStartDate)}</strong></div><div><span>Proposed end</span><strong>{renewal.proposedEndDate ? formatDate(renewal.proposedEndDate) : "No fixed end"}</strong></div><div><span>Proposed monthly rent</span><strong>{renewal.proposedRent === undefined ? "Not set" : formatMoney(renewal.proposedRent)}</strong></div><div><span>Effective date of changes</span><strong>{formatDate(renewal.effectiveDate)}</strong></div><div><span>Reminder date</span><strong>{formatDate(renewal.reminderDate)}</strong></div></div>
    {renewal.notes && <p className="renewal-notes">{renewal.notes}</p>}
    <div className="renewal-record-footer"><div className="related-documents"><span>Supporting documents</span>{relatedDocuments.length ? relatedDocuments.map((document) => <span className="related-document-chip" key={document.id}><Icon name="file" size={12} />{document.title}</span>) : <span className="muted-cell">None linked</span>}</div><div className="renewal-actions">{renewal.status !== "Signed" && <button className="button button-small button-secondary" onClick={() => onStatus(renewal.id, nextStatus)}>{renewal.status === "Approved" ? "Record signed" : `Move to ${nextStatus.toLowerCase()}`} <Icon name="chevronRight" size={14} /></button>}<button className="icon-button" title="View previous terms" aria-label="View original terms" onClick={() => document.getElementById("current-term-anchor")?.scrollIntoView({ behavior: "smooth", block: "center" })}><Icon name="history" size={15} /></button></div></div>
  </article>;
}