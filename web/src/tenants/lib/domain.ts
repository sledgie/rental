import type {
  Account,
  Database,
  Lease,
  LeaseAssociation,
  LeaseStatus,
  NewLeaseInput,
  Tenant,
  TenantInput,
  Transaction,
} from "../types";

export const DEFAULT_WARNING_DAYS = 60;
export const today = () => new Date().toISOString().slice(0, 10);
export const uid = (prefix: string) =>
  `${prefix}-${crypto.randomUUID().slice(0, 12)}`;
export const fullName = (tenant: Pick<Tenant, "firstName" | "lastName">) =>
  `${tenant.firstName} ${tenant.lastName}`;
export const money = (amount: number) =>
  new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(
    amount,
  );
export const dateLabel = (date?: string, short = false) =>
  date
    ? new Date(`${date.slice(0, 10)}T12:00:00`).toLocaleDateString("en-CA", {
        month: "short",
        day: "numeric",
        ...(short ? {} : { year: "numeric" }),
      })
    : "Not provided";
export const daysUntil = (date: string, asOf = today()) =>
  Math.ceil(
    (Date.parse(`${date.slice(0, 10)}T12:00:00Z`) -
      Date.parse(`${asOf.slice(0, 10)}T12:00:00Z`)) /
      86400000,
  );

export function leaseStatus(
  lease: Lease,
  warningDays = DEFAULT_WARNING_DAYS,
  asOf = today(),
): LeaseStatus {
  if (["Draft", "Pending", "Terminated"].includes(lease.leaseStatus))
    return lease.leaseStatus;
  if (lease.leaseStatus === "Expired" || daysUntil(lease.endDate, asOf) < 0)
    return "Expired";
  if (daysUntil(lease.startDate, asOf) > 0) return "Pending";
  return daysUntil(lease.endDate, asOf) <= warningDays ? "Expiring" : "Active";
}

export const isCurrentLease = (lease: Lease) =>
  ["Active", "Expiring"].includes(leaseStatus(lease));
export const tenantLeases = (db: Database, tenantId: string) => {
  const ids = new Set(
    db.leaseParties
      .filter((p) => p.tenantId === tenantId)
      .map((p) => p.leaseId),
  );
  return db.leases
    .filter((l) => ids.has(l.id))
    .sort((a, b) => b.startDate.localeCompare(a.startDate));
};

export function leaseUnitLinks(db: Database, leaseId: string) {
  const seen = new Set<string>();
  return db.leaseUnits.filter((link) => {
    const key = `${link.leaseId}:${link.unitId}`;
    if (link.leaseId !== leaseId || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function currentTenantUnits(db: Database, tenantId: string) {
  const asOf = today();
  const activeLeases = new Set(
    db.leases.filter(isCurrentLease).map((l) => l.id),
  );
  const parties = db.leaseParties.filter(
    (p) =>
      p.tenantId === tenantId &&
      activeLeases.has(p.leaseId) &&
      p.effectiveStartDate <= asOf &&
      (!p.effectiveEndDate || p.effectiveEndDate >= asOf),
  );
  const ids = new Set(
    parties.flatMap((p) =>
      db.partyUnits
        .filter(
          (pu) =>
            pu.partyId === p.id &&
            db.leaseUnits.some(
              (lu) =>
                lu.leaseId === p.leaseId &&
                lu.unitId === pu.unitId &&
                lu.occupancyStartDate <= asOf &&
                (!lu.occupancyEndDate || lu.occupancyEndDate >= asOf),
            ),
        )
        .map((pu) => pu.unitId),
    ),
  );
  return db.units.filter((u) => ids.has(u.id));
}

export function relatedPeople(db: Database, tenantId: string) {
  const leaseIds = new Set(tenantLeases(db, tenantId).map((l) => l.id));
  const ids = new Set(
    db.leaseParties
      .filter((p) => leaseIds.has(p.leaseId))
      .map((p) => p.tenantId),
  );
  return db.tenants.filter((t) => ids.has(t.id));
}

export const accountTransactions = (db: Database, accountId: string) =>
  db.transactions.filter((t) => t.accountId === accountId);

export function accountFinancials(
  db: Database,
  account: Account,
  asOf = today(),
) {
  const posted = accountTransactions(db, account.id).filter(
    (t) =>
      t.paymentStatus === "Posted" && t.transactionDate.slice(0, 10) <= asOf,
  );
  const sum = (type: Transaction["transactionType"]) =>
    posted
      .filter((t) => t.transactionType === type)
      .reduce((total, t) => total + t.amount, 0);
  const charges = sum("Charge");
  const currentCharges = posted
    .filter(
      (t) =>
        t.transactionType === "Charge" &&
        t.transactionDate.slice(0, 7) === asOf.slice(0, 7),
    )
    .reduce((total, t) => total + t.amount, 0);
  const payments = sum("Payment");
  const credits = sum("Credit") + sum("Adjustment");
  const netBalance = Math.round((charges - payments - credits) * 100) / 100;
  // Credits and payments settle the oldest charge within this account, never another account.
  let available = payments + credits;
  let overdue = 0;
  let oldestOverdueDays = 0;
  const chargeRecords = posted
    .filter((t) => t.transactionType === "Charge")
    .sort((a, b) =>
      (a.dueDate ?? a.transactionDate).localeCompare(
        b.dueDate ?? b.transactionDate,
      ),
    );
  for (const charge of chargeRecords) {
    const applied = Math.min(charge.amount, Math.max(available, 0));
    available -= applied;
    const unpaid = charge.amount - applied;
    const overdueDays = -daysUntil(
      charge.dueDate ?? charge.transactionDate,
      asOf,
    );
    if (unpaid > 0 && overdueDays > 0) {
      overdue += unpaid;
      oldestOverdueDays = Math.max(oldestOverdueDays, overdueDays);
    }
  }
  return {
    account,
    charges,
    currentCharges,
    payments,
    credits,
    netBalance,
    outstanding: Math.max(0, netBalance),
    creditBalance: Math.max(0, -netBalance),
    overdue: Math.round(overdue * 100) / 100,
    oldestOverdueDays,
  };
}

export function tenantFinancials(db: Database, tenantId: string) {
  const accounts = db.accounts
    .filter((a) => a.tenantId === tenantId)
    .map((a) => accountFinancials(db, a));
  return {
    accounts,
    outstanding: accounts.reduce((s, a) => s + a.outstanding, 0),
    charges: accounts.reduce((s, a) => s + a.charges, 0),
    currentCharges: accounts.reduce((s, a) => s + a.currentCharges, 0),
    payments: accounts.reduce((s, a) => s + a.payments, 0),
    credits: accounts.reduce((s, a) => s + a.credits, 0),
    creditBalance: accounts.reduce((s, a) => s + a.creditBalance, 0),
    overdue: accounts.reduce((s, a) => s + a.overdue, 0),
    oldestOverdueDays: Math.max(0, ...accounts.map((a) => a.oldestOverdueDays)),
  };
}

export function dashboardSummary(db: Database) {
  const accounts = db.accounts.map((a) => accountFinancials(db, a));
  return {
    tenants: db.tenants.filter((t) => !t.archivedAt).length,
    activeLeases: db.leases.filter(isCurrentLease).length,
    outstanding: accounts.reduce((s, a) => s + a.outstanding, 0),
    outstandingAccounts: accounts.filter((a) => a.outstanding > 0).length,
  };
}

export const nextExpiry = (db: Database, tenantId: string) =>
  tenantLeases(db, tenantId)
    .filter(isCurrentLease)
    .map((l) => l.endDate)
    .sort()[0];

export interface DirectoryFilters {
  search: string;
  status: "All Tenants" | Tenant["tenantStatus"];
  outstanding: boolean;
  expiring: boolean;
  includeArchived: boolean;
  propertyId: string;
  sort: "default" | "name" | "balance" | "units" | "expiry";
  descending: boolean;
  warningDays: number;
}

export function filterTenants(db: Database, filters: DirectoryFilters) {
  const query = filters.search.trim().toLowerCase();
  const digits = query.replace(/\D/g, "");
  const result = db.tenants.filter((tenant) => {
    if (tenant.archivedAt && !filters.includeArchived) return false;
    if (
      filters.status !== "All Tenants" &&
      tenant.tenantStatus !== filters.status
    )
      return false;
    const leases = tenantLeases(db, tenant.id);
    const allUnits = leases
      .flatMap((l) => leaseUnitLinks(db, l.id))
      .map((lu) => db.units.find((u) => u.id === lu.unitId)!)
      .filter(Boolean);
    if (
      filters.propertyId &&
      !allUnits.some((u) => u.propertyId === filters.propertyId)
    )
      return false;
    if (filters.outstanding && tenantFinancials(db, tenant.id).outstanding <= 0)
      return false;
    if (
      filters.expiring &&
      !leases.some((l) => leaseStatus(l, filters.warningDays) === "Expiring")
    )
      return false;
    if (query) {
      const haystack = [
        fullName(tenant),
        tenant.middleName,
        tenant.preferredName,
        tenant.tenantNumber,
        tenant.email,
        tenant.phone,
        ...allUnits.flatMap((u) => [
          u.unitNumber,
          `unit ${u.unitNumber}`,
          db.properties.find((p) => p.id === u.propertyId)?.name,
        ]),
      ]
        .join(" ")
        .toLowerCase();
      const phoneMatch =
        digits.length >= 3 &&
        /^[\d\s()+.-]+$/.test(query) &&
        tenant.phone.replace(/\D/g, "").includes(digits);
      if (!haystack.includes(query) && !phoneMatch) return false;
    }
    return true;
  });
  if (filters.sort !== "default")
    result.sort((a, b) => {
      let difference = 0;
      if (filters.sort === "name")
        difference = fullName(a).localeCompare(fullName(b));
      if (filters.sort === "balance")
        difference =
          tenantFinancials(db, a.id).outstanding -
          tenantFinancials(db, b.id).outstanding;
      if (filters.sort === "units")
        difference =
          currentTenantUnits(db, a.id).length -
          currentTenantUnits(db, b.id).length;
      if (filters.sort === "expiry") {
        const aExpiry = nextExpiry(db, a.id);
        const bExpiry = nextExpiry(db, b.id);
        if (!aExpiry) return 1;
        if (!bExpiry) return -1;
        difference = aExpiry.localeCompare(bExpiry);
      }
      return (
        difference * (filters.descending ? -1 : 1) ||
        fullName(a).localeCompare(fullName(b))
      );
    });
  return result;
}

export function appendActivity(
  db: Database,
  tenantId: string,
  label: string,
  description: string,
): Database {
  return {
    ...db,
    activities: [
      {
        id: uid("activity"),
        tenantId,
        at: new Date().toISOString(),
        label,
        description,
      },
      ...db.activities,
    ],
  };
}

export function associatePerson(
  db: Database,
  tenantId: string,
  leaseId: string,
  role: LeaseAssociation["role"],
  unitIds: string[],
  isSignatory: boolean,
): Database {
  if (
    db.leaseParties.some(
      (p) => p.leaseId === leaseId && p.tenantId === tenantId,
    )
  )
    throw new Error(
      "This person is already associated with the selected lease.",
    );
  if (
    role === "Main Tenant" &&
    db.leaseParties.some(
      (p) =>
        p.leaseId === leaseId &&
        p.role === "Main Tenant" &&
        !p.effectiveEndDate,
    )
  )
    throw new Error(
      "This lease already has a main tenant. Choose Co-Tenant or Occupant.",
    );
  const allowedUnits = new Set(
    leaseUnitLinks(db, leaseId).map((lu) => lu.unitId),
  );
  const uniqueUnitIds = [...new Set(unitIds)];
  if (
    !uniqueUnitIds.length ||
    uniqueUnitIds.some((id) => !allowedUnits.has(id))
  )
    throw new Error(
      "Choose at least one unit belonging to the selected lease.",
    );
  const lease = db.leases.find((l) => l.id === leaseId);
  if (!lease) throw new Error("The selected lease no longer exists.");
  if (!db.tenants.some((t) => t.id === tenantId))
    throw new Error("The selected tenant no longer exists.");
  const partyId = uid("party");
  return appendActivity(
    {
      ...db,
      leaseParties: [
        ...db.leaseParties,
        {
          id: partyId,
          tenantId,
          leaseId,
          role,
          isSignatory,
          effectiveStartDate:
            lease.endDate < today()
              ? lease.startDate
              : lease.startDate > today()
                ? lease.startDate
                : today(),
          ...(lease.endDate < today()
            ? { effectiveEndDate: lease.endDate }
            : {}),
        },
      ],
      partyUnits: [
        ...db.partyUnits,
        ...uniqueUnitIds.map((unitId) => ({
          id: uid("party-unit"),
          partyId,
          unitId,
        })),
      ],
    },
    tenantId,
    "Lease association added",
    `Joined ${lease.leaseNumber} as ${role.toLowerCase()}.`,
  );
}

export function createLease(
  db: Database,
  tenantId: string,
  input: NewLeaseInput,
  role: LeaseAssociation["role"] = "Main Tenant",
  isSignatory = true,
): Database {
  const id = uid("lease");
  const leaseNumber = `LSE-${new Date().getFullYear()}-${String(db.leases.length + 1).padStart(3, "0")}`;
  const date = today();
  const unitIds = [...new Set(input.unitIds)];
  if (
    !unitIds.length ||
    !input.startDate ||
    !input.endDate ||
    input.endDate <= input.startDate ||
    !Number.isFinite(input.rent) ||
    input.rent <= 0 ||
    !Number.isFinite(input.deposit) ||
    input.deposit < 0
  )
    throw new Error(
      "Please provide valid lease dates, rent, deposit, and at least one unit.",
    );
  if (
    Math.round(input.rent * 100) / 100 !== input.rent ||
    Math.round(input.deposit * 100) / 100 !== input.deposit
  )
    throw new Error(
      "Rent and deposit must use no more than two decimal places.",
    );
  if (unitIds.some((unitId) => !db.units.some((u) => u.id === unitId)))
    throw new Error("One of the selected units no longer exists.");
  const overlapping = db.leaseUnits.some(
    (link) =>
      unitIds.includes(link.unitId) &&
      db.leases.some(
        (l) =>
          l.id === link.leaseId &&
          l.leaseStatus !== "Terminated" &&
          l.startDate <= input.endDate &&
          l.endDate >= input.startDate,
      ),
  );
  if (overlapping)
    throw new Error(
      "A selected unit already has a lease during these dates. Choose another unit or lease term.",
    );
  const lease: Lease = {
    id,
    leaseNumber,
    startDate: input.startDate,
    endDate: input.endDate,
    leaseStatus: input.startDate > date ? "Pending" : "Active",
    totalContractRent: input.rent,
    securityDeposit: input.deposit,
    terms:
      "Monthly rent is due on the first day of each month. The security deposit is held separately from rent.",
    documentReferences: [],
    createdAt: date,
    updatedAt: date,
  };
  const rentCents = Math.round(input.rent * 100);
  const share = Math.floor(rentCents / unitIds.length);
  let next: Database = {
    ...db,
    leases: [...db.leases, lease],
    leaseUnits: [
      ...db.leaseUnits,
      ...unitIds.map((unitId, i) => ({
        id: uid("lease-unit"),
        leaseId: id,
        unitId,
        rentAllocation:
          (i === unitIds.length - 1 ? rentCents - share * i : share) / 100,
        occupancyStartDate: input.startDate,
      })),
    ],
    units: db.units.map((u) => {
      if (!unitIds.includes(u.id) || input.endDate < date) return u;
      const currentlyOccupied = db.leaseUnits.some(
        (lu) =>
          lu.unitId === u.id &&
          db.leases.some((l) => l.id === lu.leaseId && isCurrentLease(l)),
      );
      return {
        ...u,
        unitStatus:
          currentlyOccupied || input.startDate <= date
            ? "Occupied"
            : "Reserved",
      };
    }),
    accounts: [
      ...db.accounts,
      {
        id: uid("account"),
        label: leaseNumber,
        accountType: "Lease",
        tenantId,
        leaseId: id,
        currency: "CAD",
        nettingRule: "within-account-only",
      },
    ],
  };
  next = associatePerson(next, tenantId, id, role, unitIds, isSignatory);
  return appendActivity(
    next,
    tenantId,
    "Lease created",
    `${leaseNumber} was created with ${unitIds.length} associated unit${unitIds.length === 1 ? "" : "s"}.`,
  );
}

export function saveTenant(
  db: Database,
  input: TenantInput,
  association: LeaseAssociation,
  editingId?: string,
): { db: Database; tenant: Tenant } {
  if (
    db.tenants.some(
      (t) =>
        t.id !== editingId &&
        t.email.toLowerCase() === input.email.trim().toLowerCase(),
    )
  )
    throw new Error(
      "A tenant with this email already exists. Select their existing record instead.",
    );
  const existing = db.tenants.find((t) => t.id === editingId);
  const date = new Date().toISOString();
  const maxNumber = Math.max(
    1000,
    ...db.tenants.map((t) => Number(t.tenantNumber.replace(/\D/g, ""))),
  );
  const tenant: Tenant = {
    ...existing,
    ...input,
    email: input.email.trim().toLowerCase(),
    id: existing?.id ?? uid("tenant"),
    tenantNumber: existing?.tenantNumber ?? `TNT-${maxNumber + 1}`,
    createdAt: existing?.createdAt ?? date,
    updatedAt: date,
    avatarColor:
      existing?.avatarColor ??
      ["violet", "blue", "rose", "teal", "amber"][db.tenants.length % 5],
  };
  let next = {
    ...db,
    tenants: existing
      ? db.tenants.map((t) => (t.id === tenant.id ? tenant : t))
      : [tenant, ...db.tenants],
  };
  next = appendActivity(
    next,
    tenant.id,
    existing ? "Tenant information updated" : "Tenant record created",
    existing
      ? "Personal and contact information was saved."
      : "Added to the tenant directory.",
  );
  if (!existing && association.mode === "existing" && association.leaseId)
    next = associatePerson(
      next,
      tenant.id,
      association.leaseId,
      association.role,
      association.unitIds,
      association.isSignatory,
    );
  if (!existing && association.mode === "new" && association.newLease)
    next = createLease(
      next,
      tenant.id,
      association.newLease,
      association.role,
      association.isSignatory,
    );
  return { db: next, tenant };
}

export function downloadFile(
  name: string,
  content: string,
  type = "text/plain",
) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function tenantCsv(db: Database, tenants: Tenant[]) {
  const escape = (value: string | number) =>
    `"${String(value)
      .replace(/^[=+@-]/, "'$&")
      .replace(/"/g, '""')}"`;
  const rows: (string | number)[][] = [
    [
      "Tenant ID",
      "Name",
      "Phone",
      "Email",
      "Current units",
      "Outstanding balance (CAD)",
      "Status",
      "Archived",
    ],
  ];
  tenants.forEach((t) =>
    rows.push([
      t.tenantNumber,
      fullName(t),
      t.phone,
      t.email,
      currentTenantUnits(db, t.id).length,
      tenantFinancials(db, t.id).outstanding.toFixed(2),
      t.tenantStatus,
      t.archivedAt ? "Yes" : "No",
    ]),
  );
  return rows.map((row) => row.map(escape).join(",")).join("\r\n");
}
