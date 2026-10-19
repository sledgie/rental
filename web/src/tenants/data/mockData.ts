import type { Database, TenantStatus } from "../types";

const offsetDate = (days: number) => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

export function createMockDatabase(): Database {
  const names = [
    ["Sarah", "Johnson"],
    ["Michael", "Chen"],
    ["Emily", "Davis"],
    ["James", "Wilson"],
    ["Olivia", "Martinez"],
    ["Daniel", "Thompson"],
    ["Sophia", "Anderson"],
    ["William", "Brown"],
    ["Ava", "Patel"],
    ["Noah", "Garcia"],
    ["Isabella", "Taylor"],
    ["Benjamin", "Moore"],
    ["Mia", "Robinson"],
    ["Lucas", "Martin"],
    ["Charlotte", "Lee"],
    ["Henry", "Clark"],
    ["Amelia", "Walker"],
    ["Alexander", "Hall"],
    ["Grace", "Lewis"],
    ["Oliver", "Young"],
    ["Ethan", "Johnson"],
    ["Lily", "Johnson"],
    ["Emma", "Wilson"],
    ["Jack", "Cooper"],
  ];
  const statusFor = (i: number): TenantStatus =>
    [14, 15, 23].includes(i)
      ? "Pending"
      : [16, 17].includes(i)
        ? "Inactive"
        : [18, 19].includes(i)
          ? "Former"
          : "Active";
  const db: Database = {
    tenants: names.map(([firstName, lastName], i) => ({
      id: `t${i + 1}`,
      tenantNumber: `TNT-${1001 + i}`,
      firstName,
      lastName,
      phone: `+1 (416) ${["555", "555", "647"][i % 3]}-${String(1234 + i * 113).padStart(4, "0")}`,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${i % 3 === 1 ? "outlook.com" : "gmail.com"}`,
      mailingAddress:
        i < 14
          ? `${120 + i * 8} King Street West, Toronto, ON M5H 1J9`
          : undefined,
      emergencyContact:
        i === 0 ? "Ethan Johnson, +1 (416) 647-3494" : undefined,
      dateOfBirth: i === 0 ? "1991-08-14" : undefined,
      notes:
        i === 0
          ? "Prefers email for non-urgent communication. Parking space P-14 is included with Unit 204."
          : "",
      classification: i < 20 ? "Main tenant" : "Individual",
      tenantStatus: statusFor(i),
      createdAt: offsetDate(-240 + i * 7),
      updatedAt: offsetDate(-i % 8),
      avatarColor: ["violet", "blue", "rose", "amber", "teal", "slate"][i % 6],
    })),
    properties: [
      {
        id: "p1",
        name: "Maplewood Residences",
        address: "120 King Street West",
        city: "Toronto, ON M5H 1J9",
      },
      {
        id: "p2",
        name: "Parkside Apartments",
        address: "85 Wellington Street",
        city: "Toronto, ON M5J 2H7",
      },
      {
        id: "p3",
        name: "The Oakridge",
        address: "340 Oak Avenue",
        city: "Mississauga, ON L5B 2C9",
      },
      {
        id: "p4",
        name: "Harbour View",
        address: "22 Queens Quay East",
        city: "Toronto, ON M5E 1B4",
      },
    ],
    units: [
      {
        id: "u1",
        propertyId: "p1",
        unitNumber: "204",
        unitStatus: "Occupied",
        bedrooms: 2,
        area: 960,
      },
      {
        id: "u2",
        propertyId: "p1",
        unitNumber: "205",
        unitStatus: "Occupied",
        bedrooms: 1,
        area: 640,
      },
      ...Array.from({ length: 13 }, (_, i) => ({
        id: `u${i + 3}`,
        propertyId: `p${(i % 4) + 1}`,
        unitNumber: String(301 + i * 2),
        unitStatus: "Occupied" as const,
        bedrooms: (i % 3) + 1,
        area: 700 + i * 40,
      })),
      {
        id: "u16",
        propertyId: "p4",
        unitNumber: "PH-02",
        unitStatus: "Occupied",
        bedrooms: 1,
        area: 590,
      },
      {
        id: "u17",
        propertyId: "p2",
        unitNumber: "108",
        unitStatus: "Available",
        bedrooms: 1,
        area: 660,
      },
      {
        id: "u18",
        propertyId: "p3",
        unitNumber: "402",
        unitStatus: "Available",
        bedrooms: 2,
        area: 880,
      },
      {
        id: "u19",
        propertyId: "p1",
        unitNumber: "210",
        unitStatus: "Available",
        bedrooms: 2,
        area: 920,
      },
      {
        id: "u20",
        propertyId: "p4",
        unitNumber: "506",
        unitStatus: "Reserved",
        bedrooms: 2,
        area: 1010,
      },
    ],
    leases: [],
    leaseUnits: [],
    leaseParties: [],
    partyUnits: [],
    accounts: [],
    transactions: [],
    activities: [],
  };

  const addLease = (
    id: string,
    tenantId: string,
    unitIds: string[],
    rent: number,
    startDays: number,
    endDays: number,
    historical = false,
    pending = false,
  ) => {
    const leaseNumber = `LSE-${new Date().getFullYear()}-${id.replace("l", "").padStart(3, "0")}`;
    db.leases.push({
      id,
      leaseNumber,
      startDate: offsetDate(startDays),
      endDate: offsetDate(endDays),
      leaseStatus: historical ? "Expired" : pending ? "Pending" : "Active",
      totalContractRent: rent,
      securityDeposit: rent,
      terms:
        "Rent is due on the first day of each month. Utilities are billed separately. Renewal is subject to 60 days written notice. Deposits are held separately and are not netted against rent.",
      documentReferences: [
        {
          id: `doc-${id}`,
          name: "Residential lease agreement",
          createdAt: offsetDate(startDays),
        },
      ],
      createdAt: offsetDate(startDays),
      updatedAt: offsetDate(-5),
    });
    unitIds.forEach((unitId, i) =>
      db.leaseUnits.push({
        id: `lu-${id}-${unitId}`,
        leaseId: id,
        unitId,
        rentAllocation:
          id === "l1" ? (i === 0 ? 1850 : 900) : rent / unitIds.length,
        occupancyStartDate: offsetDate(startDays),
        ...(historical ? { occupancyEndDate: offsetDate(endDays) } : {}),
      }),
    );
    const partyId = `party-${id}-${tenantId}`;
    db.leaseParties.push({
      id: partyId,
      leaseId: id,
      tenantId,
      role: "Main Tenant",
      isSignatory: true,
      effectiveStartDate: offsetDate(startDays),
      ...(historical ? { effectiveEndDate: offsetDate(endDays) } : {}),
    });
    unitIds.forEach((unitId) =>
      db.partyUnits.push({ id: `pu-${partyId}-${unitId}`, partyId, unitId }),
    );
    db.activities.push({
      id: `act-${id}`,
      tenantId,
      at: offsetDate(startDays),
      label: "Lease associated",
      description: `${leaseNumber} linked to ${unitIds.length} unit${unitIds.length === 1 ? "" : "s"}.`,
    });
  };

  const rents = [
    2750, 2400, 1850, 3200, 2100, 2650, 2250, 1950, 2200, 2050, 2300, 1800,
    2150, 2500,
  ];
  rents.forEach((rent, i) =>
    addLease(
      `l${i + 1}`,
      `t${i + 1}`,
      i === 0 ? ["u1", "u2"] : [`u${i + 2}`],
      rent,
      -180 - i * 3,
      [2, 5, 8].includes(i) ? 20 + i * 3 : 185 - i * 3,
    ),
  );
  addLease("l15", "t7", ["u16"], 900, -150, 215);
  addLease("l16", "t3", ["u4"], 1750, -560, -195, true);
  addLease("l17", "t19", ["u17"], 1250, -400, -35, true);
  addLease("l18", "t20", ["u18"], 1700, -500, -135, true);
  addLease("l19", "t16", ["u20"], 2600, 14, 379, false, true);

  [
    ["t21", "l1", "Co-Tenant", "u1"],
    ["t22", "l1", "Occupant", "u2"],
    ["t23", "l4", "Co-Tenant", "u5"],
  ].forEach(([tenantId, leaseId, role, unitId]) => {
    const partyId = `party-${leaseId}-${tenantId}`;
    db.leaseParties.push({
      id: partyId,
      leaseId,
      tenantId,
      role: role as "Co-Tenant" | "Occupant",
      isSignatory: role === "Co-Tenant",
      effectiveStartDate: offsetDate(-160),
    });
    db.partyUnits.push({ id: `pu-${partyId}`, partyId, unitId });
  });

  const addAccount = (
    id: string,
    tenantId: string,
    leaseId: string,
    charge: number,
    payment: number,
    dueDays: number,
    unitId?: string,
    credit = 0,
  ) => {
    const lease = db.leases.find((l) => l.id === leaseId)!;
    const accountType = unitId ? ("Unit" as const) : ("Lease" as const);
    db.accounts.push({
      id,
      tenantId,
      leaseId,
      unitId,
      label: unitId
        ? `Unit ${db.units.find((u) => u.id === unitId)!.unitNumber}`
        : lease.leaseNumber,
      accountType,
      currency: "CAD",
      nettingRule: "within-account-only",
    });
    const base = {
      accountId: id,
      accountType,
      tenantId,
      leaseId,
      unitId,
      paymentStatus: "Posted" as const,
    };
    db.transactions.push({
      ...base,
      id: `txn-${id}-charge`,
      transactionType: "Charge",
      description: "Monthly rent",
      amount: charge,
      transactionDate: offsetDate(Math.min(-1, dueDays - 5)),
      dueDate: offsetDate(dueDays),
    });
    if (payment)
      db.transactions.push({
        ...base,
        id: `txn-${id}-payment`,
        transactionType: "Payment",
        description: "Rent payment - bank transfer",
        amount: payment,
        transactionDate: offsetDate(-2),
      });
    if (credit)
      db.transactions.push({
        ...base,
        id: `txn-${id}-credit`,
        transactionType: "Credit",
        description: "Utility reconciliation credit",
        amount: credit,
        transactionDate: offsetDate(-1),
      });
  };
  const payments = [
    1500, 2400, 1850, 0, 1800, 2650, 1500, 1950, 1650, 2050, 2300, 1800, 2150,
    2500,
  ];
  rents.forEach((rent, i) =>
    addAccount(
      `a${i + 1}`,
      `t${i + 1}`,
      `l${i + 1}`,
      rent,
      payments[i],
      i === 3 ? -45 : [4, 8].includes(i) ? 5 : -12,
    ),
  );
  addAccount("a15", "t7", "l15", 900, 1000, -10, "u16", 100);
  addAccount("a16", "t3", "l16", 1750, 1750, -195);
  addAccount("a17", "t19", "l17", 1250, 1000, -35);
  addAccount("a18", "t20", "l18", 1700, 1700, -135);
  db.transactions.push({
    id: "txn-draft",
    accountId: "a1",
    accountType: "Lease",
    tenantId: "t1",
    leaseId: "l1",
    transactionType: "Charge",
    description: "Next month rent (draft)",
    amount: 2750,
    transactionDate: offsetDate(5),
    dueDate: offsetDate(15),
    paymentStatus: "Draft",
  });
  db.transactions.push({
    id: "txn-void",
    accountId: "a4",
    accountType: "Lease",
    tenantId: "t4",
    leaseId: "l4",
    transactionType: "Charge",
    description: "Late fee (waived)",
    amount: 100,
    transactionDate: offsetDate(-5),
    dueDate: offsetDate(-5),
    paymentStatus: "Voided",
  });
  db.tenants.forEach((t) =>
    db.activities.push({
      id: `activity-created-${t.id}`,
      tenantId: t.id,
      at: t.createdAt,
      label: "Tenant record created",
      description: "Added to the Rentora tenant directory.",
    }),
  );
  return db;
}
