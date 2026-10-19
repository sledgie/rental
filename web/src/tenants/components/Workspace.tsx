import { useState } from "react";
import {
  ArrowUpRight,
  Bell,
  Building2,
  CheckCircle2,
  CircleDollarSign,
  FileText,
  Home,
  Info,
  LifeBuoy,
  Settings2,
  Users,
} from "lucide-react";
import type { Database } from "../types";
import {
  accountFinancials,
  dashboardSummary,
  dateLabel,
  daysUntil,
  fullName,
  leaseStatus,
  money,
} from "../lib/domain";
import {
  Avatar,
  Button,
  EmptyState,
  Overlay,
  SectionTitle,
  StatusBadge,
} from "./ui";
import type { DetailActions } from "./TenantDetails";

export type WorkspaceView =
  | "Overview"
  | "Properties"
  | "Units"
  | "Leases"
  | "Financials"
  | "Documents"
  | "Notifications"
  | "Help & support"
  | "Settings";

export function WorkspacePanel({
  view,
  db,
  actions,
  onClose,
  warningDays,
  dense,
  onSettings,
  onAddTenant,
}: {
  view: WorkspaceView;
  db: Database;
  actions: DetailActions;
  onClose: () => void;
  warningDays: number;
  dense: boolean;
  onSettings: (warningDays: number, dense: boolean) => void;
  onAddTenant: () => void;
}) {
  const [days, setDays] = useState(warningDays);
  const [compact, setCompact] = useState(dense);
  const [settingsError, setSettingsError] = useState("");
  const summary = dashboardSummary(db);
  const expiring = db.leases.filter(
    (l) => leaseStatus(l, warningDays) === "Expiring",
  );
  const overdue = db.accounts
    .map((a) => accountFinancials(db, a))
    .filter((a) => a.overdue > 0);
  return (
    <Overlay
      wide
      title={view}
      subtitle={
        view === "Help & support"
          ? "A little guidance, right when you need it."
          : view === "Settings"
            ? "Make this tenant workspace work for you."
            : "Acme Properties workspace"
      }
      onClose={onClose}
    >
      <div className="workspace-panel-body">
        {view === "Overview" && (
          <>
            <div className="workspace-overview">
              <div>
                <Users size={20} />
                <strong>{summary.tenants}</strong>
                <span>Tenant records</span>
              </div>
              <div>
                <FileText size={20} />
                <strong>{summary.activeLeases}</strong>
                <span>Active leases</span>
              </div>
              <div>
                <CircleDollarSign size={20} />
                <strong>{money(summary.outstanding)}</strong>
                <span>Outstanding balance</span>
              </div>
            </div>
            <SectionTitle title="Upcoming lease expiries" />
            {expiring.map((lease) => (
              <button
                className="directory-entity-row"
                key={lease.id}
                onClick={() => actions.onLease(lease.id)}
              >
                <span className="entity-list-icon">
                  <FileText size={18} />
                </span>
                <span>
                  <strong>{lease.leaseNumber}</strong>
                  <small>
                    {dateLabel(lease.endDate)} &middot;{" "}
                    {daysUntil(lease.endDate)} days remaining
                  </small>
                </span>
                <StatusBadge status="Expiring" />
                <ArrowUpRight size={15} />
              </button>
            ))}
            {!expiring.length && (
              <EmptyState
                compact
                title="No upcoming expiries"
                description={`No current lease ends in the next ${warningDays} days.`}
              />
            )}
            <div className="inline-info">
              <Info size={16} />
              <p>
                This preview uses the tenant module's sample portfolio. Your
                records live in memory for this session.
              </p>
            </div>
          </>
        )}
        {view === "Properties" &&
          db.properties.map((property) => (
            <button
              className="directory-entity-row"
              key={property.id}
              onClick={() => actions.onProperty(property.id)}
            >
              <span className="entity-list-icon">
                <Building2 size={21} />
              </span>
              <span>
                <strong>{property.name}</strong>
                <small>
                  {property.address}, {property.city}
                </small>
              </span>
              <span className="entity-row-count">
                {db.units.filter((u) => u.propertyId === property.id).length}{" "}
                units
              </span>
              <ArrowUpRight size={16} />
            </button>
          ))}
        {view === "Units" &&
          db.units.map((unit) => (
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
                  {db.properties.find((p) => p.id === unit.propertyId)?.name}
                </small>
              </span>
              <StatusBadge status={unit.unitStatus} />
              <ArrowUpRight size={16} />
            </button>
          ))}
        {view === "Leases" &&
          db.leases.map((lease) => (
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
              <ArrowUpRight size={16} />
            </button>
          ))}
        {view === "Financials" && (
          <>
            <div className="workspace-balance">
              <span>Total outstanding</span>
              <strong>
                {money(summary.outstanding)}
                <small>CAD</small>
              </strong>
              <p>
                Positive balances across independent accounts, without
                cross-account credit offsetting.
              </p>
            </div>
            <SectionTitle title="Billing accounts" />
            {db.accounts.map((account) => {
              const tenant = db.tenants.find((t) => t.id === account.tenantId)!;
              const financials = accountFinancials(db, account);
              return (
                <button
                  className="directory-entity-row"
                  key={account.id}
                  onClick={() =>
                    actions.onProfile(tenant.id, "Financial ledger")
                  }
                >
                  <Avatar tenant={tenant} />
                  <span>
                    <strong>{fullName(tenant)}</strong>
                    <small>
                      {account.accountType} account &middot; {account.label}
                    </small>
                  </span>
                  <span
                    className={
                      financials.netBalance > 0
                        ? "amber-text"
                        : financials.netBalance < 0
                          ? "green-text"
                          : "muted"
                    }
                  >
                    {money(financials.netBalance)}
                    {financials.netBalance < 0 ? " credit" : ""}
                  </span>
                  <ArrowUpRight size={15} />
                </button>
              );
            })}
          </>
        )}
        {view === "Documents" && (
          <>
            {db.leases.flatMap((l) =>
              l.documentReferences.map((doc) => (
                <button
                  className="directory-entity-row"
                  key={doc.id}
                  onClick={() => actions.onLease(l.id)}
                >
                  <span className="document-icon">
                    <FileText size={20} />
                  </span>
                  <span>
                    <strong>{doc.name}</strong>
                    <small>
                      {l.leaseNumber} &middot; {dateLabel(doc.createdAt)}
                    </small>
                  </span>
                  <ArrowUpRight size={16} />
                </button>
              )),
            )}
            <div className="inline-info">
              <Info size={16} />
              <p>
                Sample agreements are available to preview and download.
                Historical documents are retained.
              </p>
            </div>
          </>
        )}
        {view === "Notifications" && (
          <>
            {!expiring.length && !overdue.length ? (
              <EmptyState
                title="You're all caught up"
                description="No upcoming lease expiries or overdue balances need your attention."
              />
            ) : (
              <>
                <SectionTitle
                  title="Needs your attention"
                  icon={<Bell size={16} />}
                />
                {expiring.map((lease) => (
                  <button
                    className="notification-row"
                    key={lease.id}
                    onClick={() => actions.onLease(lease.id)}
                  >
                    <span className="notification-icon amber-text">
                      <FileText size={18} />
                    </span>
                    <span>
                      <strong>
                        Lease expiring in {daysUntil(lease.endDate)} days
                      </strong>
                      <small>
                        {lease.leaseNumber} ends on {dateLabel(lease.endDate)}.
                        Review renewal terms.
                      </small>
                    </span>
                    <ArrowUpRight size={15} />
                  </button>
                ))}
                {overdue.map((financials) => {
                  const tenant = db.tenants.find(
                    (t) => t.id === financials.account.tenantId,
                  )!;
                  return (
                    <button
                      className="notification-row"
                      key={financials.account.id}
                      onClick={() =>
                        actions.onProfile(tenant.id, "Financial ledger")
                      }
                    >
                      <span className="notification-icon red-text">
                        <CircleDollarSign size={18} />
                      </span>
                      <span>
                        <strong>
                          {money(financials.overdue)} overdue for{" "}
                          {fullName(tenant)}
                        </strong>
                        <small>
                          {financials.account.label} &middot; Oldest unpaid
                          charge is {financials.oldestOverdueDays} days overdue.
                        </small>
                      </span>
                      <ArrowUpRight size={15} />
                    </button>
                  );
                })}
              </>
            )}
          </>
        )}
        {view === "Help & support" && (
          <>
            <div className="help-heading">
              <LifeBuoy size={30} />
              <h3>A clearer view of every tenancy.</h3>
              <p>
                This interactive workspace is a frontend prototype. No real
                payments are processed and no data leaves your browser.
              </p>
            </div>
            <div className="help-topic">
              <h4>Start with the tenant, not the lease</h4>
              <p>
                Add a person first and assign their lease whenever you're ready.
                Use the chevron beside a name to see leases, units, household
                members, and balances in place.
              </p>
            </div>
            <div className="help-topic">
              <h4>One person, one record</h4>
              <p>
                When adding a co-tenant or occupant, choose an existing person
                to avoid duplicates. Each person can be associated with multiple
                leases and different units.
              </p>
            </div>
            <div className="help-topic">
              <h4>Balances you can trace</h4>
              <p>
                Open a financial ledger to see posted charges, payments, and
                credits. Independent accounts stay separate. Archiving never
                deletes financial or lease history.
              </p>
            </div>
            <div className="keyboard-shortcuts">
              <h4>Keyboard shortcuts</h4>
              <div>
                <span>Search the tenant directory</span>
                <kbd>/</kbd>
              </div>
              <div>
                <span>Add a new tenant</span>
                <kbd>N</kbd>
              </div>
              <div>
                <span>Close a drawer or dialog</span>
                <kbd>Esc</kbd>
              </div>
            </div>
            <Button variant="primary" onClick={onAddTenant}>
              Add a tenant
              <ArrowUpRight size={14} />
            </Button>
          </>
        )}
        {view === "Settings" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!Number.isInteger(days) || days < 1 || days > 365) {
                setSettingsError("Choose a whole number from 1 to 365.");
                return;
              }
              onSettings(days, compact);
            }}
          >
            <div className="settings-heading">
              <span className="workspace-avatar">AP</span>
              <div>
                <h3>Acme Properties</h3>
                <p>Property management workspace</p>
              </div>
              <StatusBadge status="Active" />
            </div>
            <div className="settings-field">
              <label htmlFor="warning-days">
                <strong>Lease expiry warning</strong>
                <span>
                  Leases within this window are automatically marked Expiring.
                </span>
              </label>
              <div>
                <input
                  id="warning-days"
                  type="number"
                  min={1}
                  max={365}
                  value={days || ""}
                  onChange={(e) => setDays(Number(e.target.value))}
                />
                <span>days</span>
              </div>
            </div>
            <label className="settings-field">
              <span>
                <strong>Compact table density</strong>
                <span>Reduce row spacing to see more tenants at once.</span>
              </span>
              <input
                type="checkbox"
                checked={compact}
                onChange={(e) => setCompact(e.target.checked)}
              />
            </label>
            <div className="settings-field">
              <span>
                <strong>Currency & accounting</strong>
                <span>
                  Canadian dollar (CAD). Credits settle only their original
                  account.
                </span>
              </span>
              <span className="settings-fixed">CAD</span>
            </div>
            <div className="inline-info">
              <Info size={16} />
              <p>
                Settings and sample records are kept for this session. Reloading
                the page restores the sample dataset.
              </p>
            </div>
            {settingsError && (
              <p className="field-error" role="alert">
                {settingsError}
              </p>
            )}
            <div className="settings-actions">
              <Button onClick={onClose}>Cancel</Button>
              <Button type="submit" variant="primary">
                <Settings2 size={15} />
                Save preferences
              </Button>
            </div>
          </form>
        )}
        {!["Settings", "Help & support", "Overview"].includes(view) && (
          <div className="workspace-data-note">
            <CheckCircle2 size={13} />
            Live from your tenant relationship records
          </div>
        )}
      </div>
    </Overlay>
  );
}
