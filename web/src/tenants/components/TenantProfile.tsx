import { useState } from "react";
import {
  Activity as ActivityIcon,
  ArrowDownLeft,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  Download,
  FileText,
  History,
  Info,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Wallet,
} from "lucide-react";
import type { Database, ProfileTab, Tenant } from "../types";
import {
  accountFinancials,
  currentTenantUnits,
  dateLabel,
  downloadFile,
  fullName,
  isCurrentLease,
  money,
  nextExpiry,
  tenantFinancials,
  tenantLeases,
} from "../lib/domain";
import {
  Avatar,
  Button,
  DataField,
  EmptyState,
  Overlay,
  SectionTitle,
  StatusBadge,
  TextLink,
} from "./ui";
import {
  CoTenantList,
  FinancialSummary,
  LeaseSection,
  UnitList,
  type DetailActions,
} from "./TenantDetails";

export function FinancialLedger({
  db,
  tenant,
  onPayment,
}: {
  db: Database;
  tenant: Tenant;
  onPayment: () => void;
}) {
  const [accountId, setAccountId] = useState("");
  const [type, setType] = useState("All transactions");
  const financials = tenantFinancials(db, tenant.id);
  const accounts = db.accounts.filter((a) => a.tenantId === tenant.id);
  const accountIds = new Set(accounts.map((a) => a.id));
  const transactions = db.transactions
    .filter(
      (t) =>
        accountIds.has(t.accountId) &&
        (!accountId || t.accountId === accountId) &&
        (type === "All transactions" || t.transactionType === type),
    )
    .sort((a, b) => b.transactionDate.localeCompare(a.transactionDate));
  const exportLedger = () => {
    const rows = [
      ["Date", "Account", "Description", "Type", "Amount (CAD)", "Status"],
      ...transactions.map((t) => [
        t.transactionDate,
        accounts.find((a) => a.id === t.accountId)?.label ?? "",
        t.description,
        t.transactionType,
        t.amount.toFixed(2),
        t.paymentStatus,
      ]),
    ];
    downloadFile(
      `${tenant.tenantNumber}-ledger.csv`,
      rows
        .map((row) => row.map((v) => `"${v.replace(/"/g, '""')}"`).join(","))
        .join("\r\n"),
      "text/csv;charset=utf-8",
    );
  };
  return (
    <div className="ledger-view">
      <SectionTitle
        icon={<Wallet size={17} />}
        title="Financial ledger"
        action={
          accounts.length ? (
            <Button
              className="button-small"
              variant="primary"
              onClick={onPayment}
            >
              <Plus size={13} />
              Record payment
            </Button>
          ) : undefined
        }
      />
      {!accounts.length ? (
        <EmptyState
          title="No billing account assigned"
          description="This person has no financial account of their own. Shared lease charges are billed to the designated account holder, not duplicated across household members."
        />
      ) : (
        <>
          <div className="ledger-totals">
            <div>
              <span>Outstanding balance</span>
              <strong className={financials.outstanding ? "amber-text" : ""}>
                {money(financials.outstanding)}
              </strong>
            </div>
            <div>
              <span>Overdue</span>
              <strong className={financials.overdue ? "red-text" : ""}>
                {money(financials.overdue)}
              </strong>
            </div>
            <div>
              <span>Account credits held</span>
              <strong className="green-text">
                {money(financials.creditBalance)}
              </strong>
            </div>
          </div>
          <div className="ledger-accounts">
            <h4>
              Account balances <span>CAD</span>
            </h4>
            {accounts
              .filter((a) => !accountId || a.id === accountId)
              .map((account) => {
                const summary = accountFinancials(db, account);
                return (
                  <div className="ledger-account" key={account.id}>
                    <div>
                      <strong>{account.label}</strong>
                      <small>
                        {account.accountType} account &middot; Billed to{" "}
                        {fullName(tenant)}
                      </small>
                    </div>
                    <div>
                      <strong
                        className={
                          summary.outstanding
                            ? "amber-text"
                            : summary.creditBalance
                              ? "green-text"
                              : ""
                        }
                      >
                        {money(summary.outstanding || summary.creditBalance)}
                      </strong>
                      <small>
                        {summary.creditBalance
                          ? "Available credit in this account"
                          : summary.outstanding
                            ? `${money(summary.overdue)} overdue`
                            : "Settled"}
                      </small>
                    </div>
                  </div>
                );
              })}
          </div>
          <div className="account-rule">
            <Info size={14} />
            <p>
              Only posted transactions affect balances. Payments settle oldest
              charges first within the same account. Credits never offset
              another account's balance. Deposits are held separately.
            </p>
          </div>
          <div className="ledger-toolbar">
            <select
              aria-label="Filter ledger by account"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
            >
              <option value="">All accounts</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.accountType}: {a.label}
                </option>
              ))}
            </select>
            <select
              aria-label="Filter transaction type"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              {[
                "All transactions",
                "Charge",
                "Payment",
                "Credit",
                "Adjustment",
              ].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
            <Button
              className="button-small"
              onClick={exportLedger}
              disabled={!transactions.length}
            >
              <Download size={13} />
              Export
            </Button>
          </div>
          <div className="ledger-table-wrap">
            <table className="ledger-table">
              <thead>
                <tr>
                  <th>Date / description</th>
                  <th>Account</th>
                  <th>Status</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((transaction) => (
                  <tr key={transaction.id}>
                    <td>
                      <strong>{transaction.description}</strong>
                      <small>
                        {dateLabel(transaction.transactionDate)}
                        {transaction.dueDate
                          ? ` / Due ${dateLabel(transaction.dueDate, true)}`
                          : ""}
                      </small>
                    </td>
                    <td>
                      <span>
                        {
                          accounts.find((a) => a.id === transaction.accountId)
                            ?.label
                        }
                      </span>
                      <small>{transaction.transactionType}</small>
                    </td>
                    <td>
                      <StatusBadge small status={transaction.paymentStatus} />
                    </td>
                    <td
                      className={
                        transaction.transactionType !== "Charge"
                          ? "green-text"
                          : ""
                      }
                    >
                      {money(
                        transaction.transactionType === "Charge"
                          ? transaction.amount
                          : -transaction.amount,
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!transactions.length && (
            <EmptyState
              compact
              title="No matching transactions"
              description="Choose a different account or transaction type."
            />
          )}
        </>
      )}
    </div>
  );
}

const tabs: ProfileTab[] = [
  "Overview",
  "Personal information",
  "Leases",
  "Units",
  "People",
  "Financial ledger",
  "Documents",
  "Activity history",
];

export function TenantProfile({
  db,
  tenant,
  tab,
  onTab,
  onClose,
  onEdit,
  onArchive,
  onPayment,
  actions,
  warningDays,
}: {
  db: Database;
  tenant: Tenant;
  tab: ProfileTab;
  onTab: (tab: ProfileTab) => void;
  onClose: () => void;
  onEdit: () => void;
  onArchive: () => void;
  onPayment: () => void;
  actions: DetailActions;
  warningDays: number;
}) {
  const leases = tenantLeases(db, tenant.id);
  const units = currentTenantUnits(db, tenant.id);
  const financials = tenantFinancials(db, tenant.id);
  const expiry = nextExpiry(db, tenant.id);
  const transactions = db.transactions
    .filter((t) => t.tenantId === tenant.id && t.paymentStatus === "Posted")
    .sort((a, b) => b.transactionDate.localeCompare(a.transactionDate));
  const documents = leases.flatMap((l) =>
    l.documentReferences.map((d) => ({
      ...d,
      leaseId: l.id,
      leaseNumber: l.leaseNumber,
    })),
  );
  const activities = db.activities
    .filter((a) => a.tenantId === tenant.id)
    .sort((a, b) => b.at.localeCompare(a.at));
  return (
    <Overlay
      drawer
      title="Tenant profile"
      subtitle="Everything about this tenancy, in one place."
      onClose={onClose}
      className="profile-drawer"
    >
      <div className="profile-heading">
        <Avatar tenant={tenant} size="xl" />
        <div className="profile-identity">
          <h2>{fullName(tenant)}</h2>
          <div>
            <span>{tenant.tenantNumber}</span>
            <StatusBadge status={tenant.tenantStatus} />
          </div>
        </div>
        <Button className="profile-edit-button" onClick={onEdit}>
          <Pencil size={14} />
          Edit tenant
        </Button>
      </div>
      <nav className="profile-tabs" aria-label="Tenant profile sections">
        {tabs.map((t) => (
          <button
            key={t}
            className={t === tab ? "selected" : ""}
            aria-current={t === tab ? "page" : undefined}
            onClick={() => onTab(t)}
          >
            {t === "Personal information"
              ? "Personal info"
              : t === "Activity history"
                ? "Activity"
                : t}
          </button>
        ))}
      </nav>
      <div className="profile-body" key={tab}>
        {tenant.archivedAt && (
          <div className="archived-banner">
            <Info size={17} />
            <p>
              This tenant is archived. All leases and financial history have
              been retained.
            </p>
            <TextLink onClick={onArchive}>Restore</TextLink>
          </div>
        )}
        {tab === "Overview" && (
          <>
            <div className="profile-contact">
              <a href={`mailto:${tenant.email}`}>
                <Mail size={15} />
                {tenant.email}
              </a>
              <a href={`tel:${tenant.phone.replace(/[^+\d]/g, "")}`}>
                <Phone size={15} />
                {tenant.phone}
              </a>
              {tenant.mailingAddress && (
                <span>
                  <MapPin size={15} />
                  {tenant.mailingAddress}
                </span>
              )}
            </div>
            <div className="profile-at-a-glance">
              <button onClick={() => onTab("Leases")}>
                <span>Active leases</span>
                <strong>
                  {leases.filter(isCurrentLease).length}
                  <ArrowUpRight size={15} />
                </strong>
              </button>
              <button onClick={() => onTab("Units")}>
                <span>Current units</span>
                <strong>
                  {units.length}
                  <ArrowUpRight size={15} />
                </strong>
              </button>
              <button onClick={() => onTab("Financial ledger")}>
                <span>Outstanding balance</span>
                <strong className={financials.outstanding ? "amber-text" : ""}>
                  {money(financials.outstanding)}
                  <ArrowUpRight size={15} />
                </strong>
              </button>
            </div>
            <div className="next-expiry">
              <CalendarDays size={17} />
              <div>
                <span>Next lease expiry</span>
                <strong>
                  {expiry ? dateLabel(expiry) : "No current lease"}
                </strong>
              </div>
              <Button
                className="button-small"
                onClick={() => actions.onAddLease(tenant.id)}
              >
                <Plus size={13} />
                Add lease
              </Button>
            </div>
            <LeaseSection
              db={db}
              tenant={tenant}
              actions={actions}
              warningDays={warningDays}
            />
            <section className="profile-section">
              <SectionTitle
                title="Recent financial activity"
                icon={<History size={16} />}
                action={
                  <TextLink onClick={() => onTab("Financial ledger")}>
                    View ledger
                    <ArrowUpRight size={13} />
                  </TextLink>
                }
              />
              {transactions.length ? (
                transactions.slice(0, 4).map((t) => (
                  <div className="recent-transaction" key={t.id}>
                    <span
                      className={`transaction-icon ${t.transactionType !== "Charge" ? "transaction-positive" : ""}`}
                    >
                      {t.transactionType === "Charge" ? (
                        <CreditCard size={17} />
                      ) : (
                        <ArrowDownLeft size={17} />
                      )}
                    </span>
                    <div>
                      <strong>{t.description}</strong>
                      <span>
                        {dateLabel(t.transactionDate)} &middot;{" "}
                        {t.transactionType}
                      </span>
                    </div>
                    <strong
                      className={
                        t.transactionType !== "Charge" ? "green-text" : ""
                      }
                    >
                      {money(t.amount)}
                    </strong>
                  </div>
                ))
              ) : (
                <EmptyState
                  compact
                  title="No financial activity yet"
                  description="Posted charges and payments will appear here."
                />
              )}
            </section>
            {tenant.notes && (
              <section className="profile-section">
                <SectionTitle
                  icon={<FileText size={15} />}
                  title="Internal notes"
                />
                <p className="profile-note">{tenant.notes}</p>
              </section>
            )}
          </>
        )}
        {tab === "Personal information" && (
          <>
            <SectionTitle
              title="Personal information"
              action={
                <TextLink onClick={onEdit}>
                  <Pencil size={13} />
                  Edit details
                </TextLink>
              }
            />
            <dl className="personal-info-grid">
              <DataField label="First name">{tenant.firstName}</DataField>
              <DataField label="Middle name">
                {tenant.middleName || "Not provided"}
              </DataField>
              <DataField label="Last name">{tenant.lastName}</DataField>
              <DataField label="Preferred name">
                {tenant.preferredName || "Not provided"}
              </DataField>
              <DataField label="Date of birth">
                {dateLabel(tenant.dateOfBirth)}
              </DataField>
              <DataField label="Tenant status">
                <StatusBadge status={tenant.tenantStatus} />
              </DataField>
              <DataField label="Phone">{tenant.phone}</DataField>
              <DataField label="Email">{tenant.email}</DataField>
              <DataField label="Mailing address">
                {tenant.mailingAddress || "Not provided"}
              </DataField>
              <DataField label="Emergency contact">
                {tenant.emergencyContact || "Not provided"}
              </DataField>
              <DataField label="Classification">
                {tenant.classification}
              </DataField>
              <DataField label="Added to directory">
                {dateLabel(tenant.createdAt)}
              </DataField>
              <DataField label="Internal notes">
                {tenant.notes || "No notes added."}
              </DataField>
            </dl>
            <div className="profile-archive-area">
              <div>
                <h4>
                  {tenant.archivedAt ? "Restore tenant" : "Archive this tenant"}
                </h4>
                <p>
                  {tenant.archivedAt
                    ? "Make this person visible in the directory again."
                    : "Hide this record without deleting its lease or financial history."}
                </p>
              </div>
              <Button
                variant={tenant.archivedAt ? "secondary" : "danger"}
                onClick={onArchive}
              >
                {tenant.archivedAt ? "Restore tenant" : "Archive tenant"}
              </Button>
            </div>
          </>
        )}
        {tab === "Leases" && (
          <LeaseSection
            db={db}
            tenant={tenant}
            actions={actions}
            warningDays={warningDays}
          />
        )}
        {tab === "Units" && (
          <UnitList db={db} tenant={tenant} actions={actions} />
        )}
        {tab === "People" && (
          <CoTenantList db={db} tenant={tenant} actions={actions} />
        )}
        {tab === "Financial ledger" && (
          <FinancialLedger db={db} tenant={tenant} onPayment={onPayment} />
        )}
        {tab === "Documents" && (
          <>
            <SectionTitle
              title="Lease documents"
              icon={<FileText size={17} />}
            />
            {documents.length ? (
              documents.map((document) => (
                <button
                  key={document.id}
                  className="document-row"
                  onClick={() => actions.onLease(document.leaseId)}
                >
                  <span className="document-icon">
                    <FileText size={21} />
                  </span>
                  <span>
                    <strong>{document.name}</strong>
                    <small>
                      {document.leaseNumber} &middot; Added{" "}
                      {dateLabel(document.createdAt)}
                    </small>
                  </span>
                  <ArrowUpRight size={17} />
                </button>
              ))
            ) : (
              <EmptyState
                title="No documents yet"
                description="Documents associated with this person's leases will appear here, including historical agreements."
              />
            )}
            <div className="inline-info">
              <Info size={16} />
              <p>
                These are sample lease documents for this prototype. They can be
                previewed and downloaded from their lease.
              </p>
            </div>
          </>
        )}
        {tab === "Activity history" && (
          <>
            <SectionTitle
              title="Activity history"
              icon={<ActivityIcon size={17} />}
            />
            <div className="activity-timeline">
              {activities.map((activity) => (
                <div className="activity-item" key={activity.id}>
                  <span>
                    <CheckCircle2 size={15} />
                  </span>
                  <div>
                    <h4>{activity.label}</h4>
                    <p>{activity.description}</p>
                    <time>{dateLabel(activity.at)}</time>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
        <div className="profile-footer-note">
          Tenant records are private to your workspace. All amounts in CAD.
        </div>
      </div>
    </Overlay>
  );
}

export { FinancialSummary };
