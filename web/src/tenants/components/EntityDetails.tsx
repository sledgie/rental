import { useState } from "react";
import {
  ArrowUpRight,
  BedDouble,
  Building2,
  CalendarDays,
  Download,
  FileText,
  Home,
  MapPin,
  Maximize2,
  Users,
} from "lucide-react";
import type { Database, Lease } from "../types";
import {
  currentTenantUnits,
  dateLabel,
  daysUntil,
  downloadFile,
  fullName,
  isCurrentLease,
  leaseStatus,
  leaseUnitLinks,
  money,
} from "../lib/domain";
import {
  Avatar,
  Button,
  DataField,
  EmptyState,
  Overlay,
  SectionTitle,
  Signatory,
  StatusBadge,
  TextLink,
} from "./ui";
import type { DetailActions } from "./TenantDetails";

export function LeaseDetail({
  db,
  lease,
  onClose,
  actions,
  warningDays,
  notify,
}: {
  db: Database;
  lease: Lease;
  onClose: () => void;
  actions: DetailActions;
  warningDays: number;
  notify: (message: string) => void;
}) {
  const [previewId, setPreviewId] = useState<string | null>(null);
  const links = leaseUnitLinks(db, lease.id);
  const parties = db.leaseParties.filter((p) => p.leaseId === lease.id);
  const status = leaseStatus(lease, warningDays);
  const agreement = `RENTORA | SAMPLE RESIDENTIAL LEASE\n\n${lease.leaseNumber}\n\nThis is a demonstration document, not a legally executed agreement.\n\nLease term: ${dateLabel(lease.startDate)} to ${dateLabel(lease.endDate)}\nMonthly rent: ${money(lease.totalContractRent)} CAD\nSecurity deposit: ${money(lease.securityDeposit)} CAD (held separately)\n\nPREMISES\n${links
    .map((link) => {
      const unit = db.units.find((u) => u.id === link.unitId)!;
      const property = db.properties.find((p) => p.id === unit.propertyId)!;
      return `${property.name}, Unit ${unit.unitNumber}\n${property.address}, ${property.city}\nAllocated rent: ${money(link.rentAllocation)} CAD / month`;
    })
    .join(
      "\n\n",
    )}\n\nPARTIES\n${parties.map((p) => `${fullName(db.tenants.find((t) => t.id === p.tenantId)!)} - ${p.role} (${p.isSignatory ? "Signatory" : "Non-signatory"})`).join("\n")}\n\nTERMS\n${lease.terms}\n\nAccount credits apply only within their original billing account.`;
  const download = () => {
    downloadFile(`${lease.leaseNumber}-sample-agreement.txt`, agreement);
    notify("Sample lease agreement downloaded.");
  };
  return (
    <Overlay
      wide
      title={lease.leaseNumber}
      subtitle="Residential lease details"
      onClose={onClose}
    >
      <div className="entity-body">
        <div className="lease-detail-status">
          <StatusBadge status={status} />
          <span>
            {status === "Expiring"
              ? `Expires in ${daysUntil(lease.endDate)} days`
              : status === "Expired"
                ? "Historical agreement - retained for your records"
                : "Lease account, billed in CAD"}
          </span>
        </div>
        <dl className="entity-facts">
          <DataField label="Start date">{dateLabel(lease.startDate)}</DataField>
          <DataField label="End date">{dateLabel(lease.endDate)}</DataField>
          <DataField label="Monthly rent">
            {money(lease.totalContractRent)}
          </DataField>
          <DataField label="Security deposit">
            {money(lease.securityDeposit)}
          </DataField>
          <DataField label="Associated units">{links.length}</DataField>
          <DataField label="Tenants & occupants">
            {new Set(parties.map((p) => p.tenantId)).size}
          </DataField>
        </dl>
        <section className="entity-section">
          <SectionTitle icon={<Building2 size={16} />} title="Leased units" />
          {links.map((link) => {
            const unit = db.units.find((u) => u.id === link.unitId)!;
            const property = db.properties.find(
              (p) => p.id === unit.propertyId,
            )!;
            return (
              <div className="entity-unit-row" key={link.id}>
                <span className="entity-list-icon">
                  <Home size={18} />
                </span>
                <div>
                  <TextLink onClick={() => actions.onUnit(unit.id)}>
                    Unit {unit.unitNumber}
                    <ArrowUpRight size={12} />
                  </TextLink>
                  <TextLink
                    className="muted"
                    onClick={() => actions.onProperty(property.id)}
                  >
                    {property.name}
                  </TextLink>
                  <small>
                    {property.address}, {property.city}
                  </small>
                </div>
                <strong>
                  {money(link.rentAllocation)}
                  <small>per month</small>
                </strong>
              </div>
            );
          })}
        </section>
        <section className="entity-section">
          <SectionTitle icon={<Users size={16} />} title="Lease parties" />
          {parties.map((party) => {
            const person = db.tenants.find((t) => t.id === party.tenantId)!;
            const occupied = db.partyUnits
              .filter((pu) => pu.partyId === party.id)
              .map((pu) => db.units.find((u) => u.id === pu.unitId)?.unitNumber)
              .join(", ");
            return (
              <div className="entity-person-row" key={party.id}>
                <Avatar tenant={person} />
                <div>
                  <TextLink onClick={() => actions.onProfile(person.id)}>
                    {fullName(person)}
                  </TextLink>
                  <small>
                    {party.role} &middot; Unit {occupied}
                  </small>
                </div>
                <Signatory value={party.isSignatory} />
              </div>
            );
          })}
        </section>
        <section className="entity-section">
          <SectionTitle icon={<FileText size={16} />} title="Terms & renewal" />
          <p className="terms-copy">{lease.terms}</p>
        </section>
        <section className="entity-section">
          <SectionTitle icon={<FileText size={16} />} title="Lease documents" />
          {lease.documentReferences.length ? (
            lease.documentReferences.map((doc) => (
              <div key={doc.id}>
                <div className="document-row">
                  <span className="document-icon">
                    <FileText size={21} />
                  </span>
                  <span>
                    <strong>{doc.name}</strong>
                    <small>
                      Sample document &middot; {dateLabel(doc.createdAt)}
                    </small>
                  </span>
                  <Button
                    className="button-small"
                    onClick={() =>
                      setPreviewId(previewId === doc.id ? null : doc.id)
                    }
                  >
                    {previewId === doc.id ? "Hide preview" : "Preview"}
                  </Button>
                  <Button
                    className="button-small"
                    onClick={download}
                    aria-label="Download sample lease agreement"
                  >
                    <Download size={14} />
                  </Button>
                </div>
                {previewId === doc.id && (
                  <pre className="document-preview">{agreement}</pre>
                )}
              </div>
            ))
          ) : (
            <EmptyState
              compact
              title="No document attached"
              description="This newly created lease has no signed agreement attached. Its relationship and financial records are still available."
            />
          )}
        </section>
      </div>
      <div className="form-footer">
        <Button onClick={onClose}>Close</Button>
        {lease.documentReferences.length > 0 && (
          <Button variant="primary" onClick={download}>
            <Download size={15} />
            Download agreement
          </Button>
        )}
      </div>
    </Overlay>
  );
}

export function PropertyDetail({
  db,
  propertyId,
  actions,
  onClose,
}: {
  db: Database;
  propertyId: string;
  actions: DetailActions;
  onClose: () => void;
}) {
  const property = db.properties.find((p) => p.id === propertyId)!;
  const units = db.units.filter((u) => u.propertyId === propertyId);
  const tenants = db.tenants.filter((t) =>
    currentTenantUnits(db, t.id).some((u) => u.propertyId === propertyId),
  );
  return (
    <Overlay
      title={property.name}
      subtitle="Property details"
      wide
      onClose={onClose}
    >
      <div className="entity-body">
        <div className="entity-location">
          <MapPin size={17} />
          {property.address}, {property.city}
        </div>
        <div className="property-summary">
          <div>
            <Building2 size={21} />
            <strong>{units.length}</strong>
            <span>Rental units</span>
          </div>
          <div>
            <Home size={21} />
            <strong>
              {units.filter((u) => u.unitStatus === "Occupied").length}
            </strong>
            <span>Occupied units</span>
          </div>
          <div>
            <Users size={21} />
            <strong>{tenants.length}</strong>
            <span>Current residents</span>
          </div>
        </div>
        <SectionTitle title="Rental units" />
        {units.map((unit) => (
          <button
            className="directory-entity-row"
            key={unit.id}
            onClick={() => actions.onUnit(unit.id)}
          >
            <span className="entity-list-icon">
              <Home size={19} />
            </span>
            <span>
              <strong>Unit {unit.unitNumber}</strong>
              <small>
                {unit.bedrooms} bedroom{unit.bedrooms > 1 ? "s" : ""} &middot;{" "}
                {unit.area} sq ft
              </small>
            </span>
            <StatusBadge status={unit.unitStatus} />
            <ArrowUpRight size={16} />
          </button>
        ))}
        <section className="entity-section">
          <SectionTitle title="Current residents" />
          {tenants.length ? (
            tenants.map((t) => (
              <button
                key={t.id}
                className="directory-entity-row"
                onClick={() => actions.onProfile(t.id)}
              >
                <Avatar tenant={t} />
                <span>
                  <strong>{fullName(t)}</strong>
                  <small>{t.tenantNumber}</small>
                </span>
                <StatusBadge status={t.tenantStatus} />
                <ArrowUpRight size={15} />
              </button>
            ))
          ) : (
            <EmptyState
              compact
              title="No current residents"
              description="Residents will appear here once a current lease is associated."
            />
          )}
        </section>
      </div>
    </Overlay>
  );
}

export function UnitDetail({
  db,
  unitId,
  actions,
  onClose,
  warningDays,
}: {
  db: Database;
  unitId: string;
  actions: DetailActions;
  onClose: () => void;
  warningDays: number;
}) {
  const unit = db.units.find((u) => u.id === unitId)!;
  const property = db.properties.find((p) => p.id === unit.propertyId)!;
  const leaseIds = new Set(
    db.leaseUnits.filter((lu) => lu.unitId === unitId).map((lu) => lu.leaseId),
  );
  const leases = db.leases
    .filter((l) => leaseIds.has(l.id))
    .sort((a, b) => b.startDate.localeCompare(a.startDate));
  const people = db.tenants.filter((t) =>
    db.leaseParties.some(
      (p) =>
        p.tenantId === t.id &&
        leases.some((l) => l.id === p.leaseId && isCurrentLease(l)) &&
        db.partyUnits.some((pu) => pu.partyId === p.id && pu.unitId === unitId),
    ),
  );
  return (
    <Overlay
      wide
      title={`Unit ${unit.unitNumber}`}
      subtitle={property.name}
      onClose={onClose}
    >
      <div className="entity-body">
        <div className="entity-location">
          <MapPin size={17} />
          {property.address}, {property.city}
          <TextLink onClick={() => actions.onProperty(property.id)}>
            View property
            <ArrowUpRight size={12} />
          </TextLink>
        </div>
        <div className="unit-detail-features">
          <StatusBadge status={unit.unitStatus} />
          <span>
            <BedDouble size={17} />
            {unit.bedrooms} bedroom{unit.bedrooms > 1 ? "s" : ""}
          </span>
          <span>
            <Maximize2 size={16} />
            {unit.area} sq ft
          </span>
        </div>
        <section className="entity-section">
          <SectionTitle
            icon={<CalendarDays size={16} />}
            title="Lease history"
          />
          {leases.length ? (
            leases.map((lease) => (
              <button
                className="directory-entity-row"
                key={lease.id}
                onClick={() => actions.onLease(lease.id)}
              >
                <span className="entity-list-icon">
                  <FileText size={19} />
                </span>
                <span>
                  <strong>{lease.leaseNumber}</strong>
                  <small>
                    {dateLabel(lease.startDate)} - {dateLabel(lease.endDate)}
                  </small>
                </span>
                <StatusBadge status={leaseStatus(lease, warningDays)} />
                <ArrowUpRight size={15} />
              </button>
            ))
          ) : (
            <EmptyState
              compact
              title="No leases associated"
              description="This unit is available to associate with a new lease."
            />
          )}
        </section>
        <section className="entity-section">
          <SectionTitle title="Current residents" icon={<Users size={16} />} />
          {people.length ? (
            people.map((t) => (
              <button
                className="directory-entity-row"
                key={t.id}
                onClick={() => actions.onProfile(t.id)}
              >
                <Avatar tenant={t} />
                <span>
                  <strong>{fullName(t)}</strong>
                  <small>
                    {t.tenantNumber} &middot; {t.email}
                  </small>
                </span>
                <ArrowUpRight size={15} />
              </button>
            ))
          ) : (
            <EmptyState
              compact
              title="No current residents"
              description="Historical residents remain accessible through their lease records."
            />
          )}
        </section>
      </div>
    </Overlay>
  );
}
