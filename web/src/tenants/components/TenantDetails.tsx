import {
  ArrowUpRight,
  Building2,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  ExternalLink,
  FileText,
  Home,
  Plus,
  Users,
} from "lucide-react";
import type { Database, Lease, Tenant } from "../types";
import {
  accountFinancials,
  dateLabel,
  daysUntil,
  fullName,
  leaseStatus,
  leaseUnitLinks,
  money,
  relatedPeople,
  tenantFinancials,
  tenantLeases,
} from "../lib/domain";
import {
  Avatar,
  DataField,
  EmptyState,
  SectionTitle,
  Signatory,
  StatusBadge,
  TextLink,
} from "./ui";

export interface DetailActions {
  onProfile: (tenantId: string, tab?: "Overview" | "Financial ledger") => void;
  onLease: (leaseId: string) => void;
  onProperty: (propertyId: string) => void;
  onUnit: (unitId: string) => void;
  onAddPerson: (tenantId: string) => void;
  onAddLease: (tenantId: string) => void;
}

interface DetailProps {
  db: Database;
  tenant: Tenant;
  actions: DetailActions;
  warningDays: number;
  compact?: boolean;
}

export function LeaseSection({
  db,
  tenant,
  actions,
  warningDays,
  compact = false,
}: DetailProps) {
  const leases = tenantLeases(db, tenant.id);
  return (
    <section
      className={`detail-section lease-section ${compact ? "is-compact" : ""}`}
    >
      <SectionTitle
        icon={<FileText size={15} />}
        title="Lease information"
        action={
          !compact ? (
            <TextLink onClick={() => actions.onAddLease(tenant.id)}>
              <Plus size={13} /> Add lease
            </TextLink>
          ) : undefined
        }
      />
      {!leases.length ? (
        <EmptyState
          compact
          title="No leases yet"
          description="Add a lease whenever this tenant is ready."
          action={
            <TextLink onClick={() => actions.onAddLease(tenant.id)}>
              Create or associate a lease <Plus size={13} />
            </TextLink>
          }
        />
      ) : (
        leases.map((lease) => (
          <LeaseItem
            key={lease.id}
            db={db}
            lease={lease}
            onOpen={() => actions.onLease(lease.id)}
            warningDays={warningDays}
            compact={compact}
          />
        ))
      )}
    </section>
  );
}

export function LeaseItem({
  db,
  lease,
  onOpen,
  warningDays,
  compact = false,
}: {
  db: Database;
  lease: Lease;
  onOpen: () => void;
  warningDays: number;
  compact?: boolean;
}) {
  const status = leaseStatus(lease, warningDays);
  const people = new Set(
    db.leaseParties
      .filter((p) => p.leaseId === lease.id)
      .map((p) => p.tenantId),
  ).size;
  return (
    <div className={`lease-item ${compact ? "lease-item-compact" : ""}`}>
      <div className="detail-item-heading">
        <TextLink onClick={onOpen} className="lease-number">
          {lease.leaseNumber}
          <ArrowUpRight size={12} />
        </TextLink>
        <StatusBadge status={status} small />
      </div>
      <dl className="lease-facts">
        <DataField label="Lease term">
          {dateLabel(lease.startDate, true)} - {dateLabel(lease.endDate)}
        </DataField>
        <DataField label="Monthly rent">
          <span className="value-emphasis">
            {money(lease.totalContractRent)}
          </span>
          <span className="muted"> / mo</span>
        </DataField>
        <DataField label="Security deposit">
          {money(lease.securityDeposit)}
        </DataField>
      </dl>
      <div className="lease-associations">
        <span>
          <Home size={11} />
          {leaseUnitLinks(db, lease.id).length} units
        </span>
        <span>
          <Users size={11} />
          {people} people
        </span>
      </div>
      <div className="lease-renewal">
        {status === "Expiring" ? (
          <span className="amber-text">
            Renewal due in {daysUntil(lease.endDate)} days
          </span>
        ) : status === "Expired" || status === "Terminated" ? (
          "Historical lease retained"
        ) : (
          "Renewal: 60 days written notice"
        )}
      </div>
      <TextLink onClick={onOpen} className="document-link">
        <FileText size={12} />
        {lease.documentReferences.length
          ? "View lease document"
          : "View lease details"}
        <ExternalLink size={11} />
      </TextLink>
    </div>
  );
}

export function UnitList({
  db,
  tenant,
  actions,
  compact = false,
}: Omit<DetailProps, "warningDays">) {
  const leases = tenantLeases(db, tenant.id);
  const count = leases.reduce(
    (sum, lease) => sum + leaseUnitLinks(db, lease.id).length,
    0,
  );
  return (
    <section
      className={`detail-section unit-section ${compact ? "is-compact" : ""}`}
    >
      <SectionTitle icon={<Building2 size={15} />} title="Leased units" />
      {!count ? (
        <EmptyState
          compact
          title="No associated units"
          description="Units will appear here when a lease is linked."
        />
      ) : (
        leases.map((lease) => (
          <div className="unit-lease-group" key={lease.id}>
            {(leases.length > 1 || !compact) && (
              <button
                className="group-label"
                onClick={() => actions.onLease(lease.id)}
              >
                {lease.leaseNumber}
                <span>{leaseStatus(lease)}</span>
              </button>
            )}
            {leaseUnitLinks(db, lease.id).map((link) => {
              const unit = db.units.find((u) => u.id === link.unitId)!;
              const property = db.properties.find(
                (p) => p.id === unit.propertyId,
              )!;
              const unitBalance = db.accounts
                .filter((a) => a.unitId === unit.id && a.leaseId === lease.id)
                .reduce(
                  (sum, a) => sum + accountFinancials(db, a).outstanding,
                  0,
                );
              const historical = ["Expired", "Terminated"].includes(
                leaseStatus(lease),
              );
              return (
                <div className="unit-item" key={link.id}>
                  <div className="unit-item-top">
                    <TextLink
                      className="unit-name"
                      onClick={() => actions.onUnit(unit.id)}
                    >
                      Unit {unit.unitNumber}
                      <ArrowUpRight size={11} />
                    </TextLink>
                    <span
                      className={`occupancy ${historical ? "historical" : ""}`}
                    >
                      <i />
                      {historical ? "Historical" : unit.unitStatus}
                    </span>
                  </div>
                  <TextLink
                    className="property-name"
                    onClick={() => actions.onProperty(property.id)}
                  >
                    {property.name}
                  </TextLink>
                  <p className="unit-address">
                    {property.address}
                    {!compact ? `, ${property.city}` : ""}
                  </p>
                  <div className="unit-rent">
                    <span>
                      {money(link.rentAllocation)}
                      <span className="muted"> / mo</span>
                    </span>
                    {unitBalance > 0 && (
                      <span className="amber-text">
                        {money(unitBalance)} due
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))
      )}
      {compact && leases.length === 1 && (
        <div className="unit-lease-caption">Under {leases[0].leaseNumber}</div>
      )}
    </section>
  );
}

export function CoTenantList({
  db,
  tenant,
  actions,
  compact = false,
}: Omit<DetailProps, "warningDays">) {
  const people = relatedPeople(db, tenant.id);
  const leaseIds = new Set(tenantLeases(db, tenant.id).map((l) => l.id));
  return (
    <section
      className={`detail-section people-section ${compact ? "is-compact" : ""}`}
    >
      <SectionTitle
        icon={<Users size={15} />}
        title={compact ? "Co-tenants & occupants" : "Co-tenants and occupants"}
      />
      {!people.length ? (
        <EmptyState
          compact
          title="No household yet"
          description="Associate a lease to add people to this tenancy."
        />
      ) : (
        <div className="people-list">
          {people.map((person) => {
            const parties = db.leaseParties.filter(
              (p) => p.tenantId === person.id && leaseIds.has(p.leaseId),
            );
            return (
              <div
                className={`person-item ${person.id === tenant.id ? "person-main" : ""}`}
                key={person.id}
              >
                <Avatar tenant={person} size={compact ? "sm" : "md"} />
                <div className="person-content">
                  <div className="person-name-line">
                    <TextLink
                      className="person-name"
                      onClick={() => actions.onProfile(person.id)}
                    >
                      {fullName(person)}
                    </TextLink>
                    {compact && person.id !== tenant.id && (
                      <span className="person-number">
                        {person.tenantNumber}
                      </span>
                    )}
                  </div>
                  {parties.map((party) => {
                    const occupied = db.partyUnits
                      .filter((pu) => pu.partyId === party.id)
                      .map(
                        (pu) =>
                          db.units.find((u) => u.id === pu.unitId)?.unitNumber,
                      )
                      .join(", ");
                    return (
                      <div className="person-relationship" key={party.id}>
                        <div className="person-role">
                          {party.role}
                          <span className="dot-separator">
                            &middot;
                          </span>Unit {occupied}
                          {compact && <Signatory value={party.isSignatory} />}
                        </div>
                        {(!compact || leaseIds.size > 1) && (
                          <div className="person-lease-line">
                            <TextLink
                              onClick={() => actions.onLease(party.leaseId)}
                            >
                              {
                                db.leases.find((l) => l.id === party.leaseId)
                                  ?.leaseNumber
                              }
                            </TextLink>
                            {!compact && (
                              <Signatory value={party.isSignatory} />
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {!compact && (
                    <div className="person-contact">
                      <span>{person.tenantNumber}</span>
                      <a href={`tel:${person.phone.replace(/[^+\d]/g, "")}`}>
                        {person.phone}
                      </a>
                      <a href={`mailto:${person.email}`}>{person.email}</a>
                    </div>
                  )}
                  {compact && (
                    <div className="person-contact-peek">
                      <a href={`tel:${person.phone.replace(/[^+\d]/g, "")}`}>
                        {person.phone}
                      </a>
                      <a href={`mailto:${person.email}`}>{person.email}</a>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {people.length === 1 && (
        <p className="household-empty">No co-tenants or occupants yet.</p>
      )}
      <TextLink
        onClick={() => actions.onAddPerson(tenant.id)}
        className="add-person-link"
      >
        <Plus size={13} />
        Add co-tenant / occupant
      </TextLink>
    </section>
  );
}

export function FinancialSummary({
  db,
  tenant,
  actions,
  compact = false,
}: Omit<DetailProps, "warningDays">) {
  const financials = tenantFinancials(db, tenant.id);
  return (
    <section
      className={`detail-section financial-section ${compact ? "is-compact" : ""}`}
    >
      <SectionTitle
        icon={<CircleDollarSign size={15} />}
        title="Financial summary"
      />
      <div className="financial-balance">
        <span>Outstanding balance</span>
        <strong
          className={
            financials.outstanding > 0
              ? financials.oldestOverdueDays > 30
                ? "red-text"
                : "amber-text"
              : ""
          }
        >
          {money(financials.outstanding)}
          <small>CAD</small>
        </strong>
      </div>
      <dl className="financial-facts">
        <DataField label="Current charges">
          <span title="Posted charges in the current calendar month">
            {money(financials.currentCharges)}
          </span>
        </DataField>
        <DataField label="Payments received">
          {money(financials.payments)}
        </DataField>
        <DataField label="Credits & adjustments">
          {money(financials.credits)}
        </DataField>
        <DataField label="Overdue amount">
          <span className={financials.overdue > 0 ? "amber-text" : ""}>
            {money(financials.overdue)}
          </span>
        </DataField>
      </dl>
      {financials.outstanding === 0 && (
        <span className="settled-note">
          <CheckCircle2 size={12} />
          No outstanding balance
        </span>
      )}
      {financials.accounts.length > 1 ? (
        <div className="independent-accounts">
          {financials.accounts.map((a) => (
            <div key={a.account.id}>
              <span>
                {a.account.accountType}: {a.account.label}
              </span>
              <span className={a.netBalance < 0 ? "green-text" : ""}>
                {money(a.netBalance)}
                {a.netBalance < 0 ? " credit" : ""}
              </span>
            </div>
          ))}
          <p>Independent accounts. Credits are not offset.</p>
        </div>
      ) : (
        <p className="account-scope">
          {financials.accounts[0]
            ? `${financials.accounts[0].account.accountType} account: ${financials.accounts[0].account.label}`
            : "No billing account assigned to this person."}
        </p>
      )}
      <p className="financial-period-note">
        Charges: this month. Other totals: all time.
      </p>
      <TextLink
        className="ledger-link"
        onClick={() => actions.onProfile(tenant.id, "Financial ledger")}
      >
        View financial ledger
        <ChevronRight size={13} />
      </TextLink>
    </section>
  );
}

export function ExpandedDetail({
  db,
  tenant,
  actions,
  warningDays,
}: DetailProps) {
  return (
    <div className="expanded-detail">
      <div className="expanded-detail-top">
        <span>TENANCY DETAILS</span>
        <TextLink onClick={() => actions.onProfile(tenant.id)}>
          View full profile
          <ArrowUpRight size={12} />
        </TextLink>
      </div>
      <div className="expanded-grid">
        <LeaseSection
          db={db}
          tenant={tenant}
          actions={actions}
          warningDays={warningDays}
          compact
        />
        <UnitList db={db} tenant={tenant} actions={actions} compact />
        <CoTenantList db={db} tenant={tenant} actions={actions} compact />
        <FinancialSummary db={db} tenant={tenant} actions={actions} compact />
      </div>
    </div>
  );
}
