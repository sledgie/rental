export type Tenant = {
  name: string;
  role: "Leaseholder" | "Co-leaseholder" | "Occupant";
  since: string;
};

export type UnitStatus = "current" | "late" | "delinquent" | "vacant" | "notice";

export type Unit = {
  unit: string;
  beds: number;
  baths: number;
  sqft: number;
  rent: number;
  balance: number;
  dueInDays: number;
  status: UnitStatus;
  leaseEnd: string;
  tenants: Tenant[];
  history: number[]; // 12 months: 1 = paid on time, 0.5 = late, 0 = missed
};

export type Property = {
  code: string;
  name: string;
  type: "Multifamily" | "Mixed-Use" | "Townhomes" | "Student" | "Senior Living";
  address1: string;
  city: string;
  state: string;
  zip: string;
  manager: string;
  managerPhone: string;
  managerEmail: string;
  acquired: string;
  yearBuilt: number;
  trend: number[];
  units: Unit[];
};

export const properties: Property[] = [
  {
    code: "PR-1042",
    name: "The Marlowe",
    type: "Multifamily",
    address1: "4210 Sycamore Avenue",
    city: "Austin",
    state: "TX",
    zip: "78745",
    manager: "Dana Whitfield",
    managerPhone: "(512) 555-0142",
    managerEmail: "dana.whitfield@marlowe.co",
    acquired: "Mar 2021",
    yearBuilt: 2014,
    trend: [128, 134, 121, 146, 152, 139, 128, 118, 131, 124, 112, 108],
    units: [
      {
        unit: "1A",
        beds: 1,
        baths: 1,
        sqft: 742,
        rent: 1680,
        balance: 0,
        dueInDays: 11,
        status: "current",
        leaseEnd: "Aug 31, 2026",
        tenants: [{ name: "Elena Ruiz", role: "Leaseholder", since: "Sep 2023" }],
        history: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      },
      {
        unit: "2B",
        beds: 2,
        baths: 2,
        sqft: 1124,
        rent: 2450,
        balance: 2450,
        dueInDays: -6,
        status: "delinquent",
        leaseEnd: "Feb 28, 2026",
        tenants: [
          { name: "Marcus Bell", role: "Leaseholder", since: "Jan 2022" },
          { name: "Priya Raman", role: "Co-leaseholder", since: "Jan 2022" },
          { name: "Noah Bell", role: "Occupant", since: "Jun 2024" },
        ],
        history: [1, 1, 0.5, 1, 1, 0, 1, 0.5, 1, 0, 1, 0],
      },
      {
        unit: "3C",
        beds: 2,
        baths: 1,
        sqft: 980,
        rent: 2120,
        balance: 640,
        dueInDays: -2,
        status: "late",
        leaseEnd: "Nov 30, 2026",
        tenants: [
          { name: "Sofia Marchetti", role: "Leaseholder", since: "Apr 2024" },
          { name: "Tom Okafor", role: "Occupant", since: "Apr 2024" },
        ],
        history: [1, 1, 1, 0.5, 1, 1, 1, 0.5, 1, 1, 1, 0.5],
      },
      {
        unit: "4D",
        beds: 3,
        baths: 2,
        sqft: 1410,
        rent: 3190,
        balance: 0,
        dueInDays: 9,
        status: "current",
        leaseEnd: "Jun 30, 2027",
        tenants: [
          { name: "The Nguyen Family", role: "Leaseholder", since: "Jul 2021" },
        ],
        history: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      },
      {
        unit: "5E",
        beds: 1,
        baths: 1,
        sqft: 705,
        rent: 1540,
        balance: 0,
        dueInDays: 0,
        status: "vacant",
        leaseEnd: "—",
        tenants: [],
        history: [1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      },
    ],
  },
  {
    code: "PR-1077",
    name: "Harborview Lofts",
    type: "Mixed-Use",
    address1: "88 Pier Street, Suite 100",
    city: "San Diego",
    state: "CA",
    zip: "92101",
    manager: "Owen Castellanos",
    managerPhone: "(619) 555-0177",
    managerEmail: "owen.c@harborviewgrp.com",
    acquired: "Nov 2019",
    yearBuilt: 2008,
    trend: [96, 102, 110, 118, 108, 99, 92, 88, 94, 101, 112, 124],
    units: [
      {
        unit: "L-01",
        beds: 1,
        baths: 1,
        sqft: 810,
        rent: 2680,
        balance: 0,
        dueInDays: 14,
        status: "current",
        leaseEnd: "Dec 31, 2026",
        tenants: [
          { name: "Grace Lindqvist", role: "Leaseholder", since: "Feb 2020" },
        ],
        history: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      },
      {
        unit: "L-02",
        beds: 2,
        baths: 2,
        sqft: 1290,
        rent: 3890,
        balance: 11670,
        dueInDays: -74,
        status: "delinquent",
        leaseEnd: "Month-to-month",
        tenants: [
          { name: "Devon Hart", role: "Leaseholder", since: "May 2019" },
          { name: "Iris Kwan", role: "Co-leaseholder", since: "May 2019" },
        ],
        history: [1, 0.5, 0, 0, 0, 0.5, 0, 0, 0.5, 0, 0, 0],
      },
      {
        unit: "L-04",
        beds: 2,
        baths: 2,
        sqft: 1345,
        rent: 4020,
        balance: 4020,
        dueInDays: -3,
        status: "delinquent",
        leaseEnd: "Sep 30, 2026",
        tenants: [
          { name: "Julian Ferreira", role: "Leaseholder", since: "Oct 2023" },
          { name: "Amara Ellis", role: "Occupant", since: "Jan 2025" },
        ],
        history: [1, 1, 1, 1, 0.5, 1, 1, 1, 0.5, 0.5, 1, 0],
      },
      {
        unit: "PH-1",
        beds: 3,
        baths: 3,
        sqft: 1960,
        rent: 6450,
        balance: 0,
        dueInDays: 7,
        status: "current",
        leaseEnd: "Apr 30, 2027",
        tenants: [
          { name: "Dr. Hale & Partner", role: "Leaseholder", since: "Aug 2022" },
        ],
        history: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      },
    ],
  },
  {
    code: "PR-1103",
    name: "Juniper Ridge Townhomes",
    type: "Townhomes",
    address1: "1207 Juniper Way",
    city: "Denver",
    state: "CO",
    zip: "80220",
    manager: "Renee Salt",
    managerPhone: "(303) 555-1103",
    managerEmail: "renee@juniperridge.pm",
    acquired: "Jul 2022",
    yearBuilt: 2018,
    trend: [42, 38, 45, 51, 47, 44, 40, 36, 39, 41, 38, 33],
    units: [
      {
        unit: "TH-1",
        beds: 3,
        baths: 2,
        sqft: 1580,
        rent: 2890,
        balance: 2890,
        dueInDays: -19,
        status: "delinquent",
        leaseEnd: "May 31, 2026",
        tenants: [
          { name: "Curtis Vaughn", role: "Leaseholder", since: "Jan 2021" },
          { name: "Bethany Vaughn", role: "Co-leaseholder", since: "Jan 2021" },
          { name: "Eli Vaughn", role: "Occupant", since: "Aug 2015" },
        ],
        history: [1, 1, 0.5, 1, 0, 1, 1, 0.5, 0, 0, 0, 0],
      },
      {
        unit: "TH-2",
        beds: 3,
        baths: 2,
        sqft: 1580,
        rent: 2890,
        balance: 0,
        dueInDays: 12,
        status: "current",
        leaseEnd: "Oct 31, 2026",
        tenants: [
          { name: "Naomi Oyelaran", role: "Leaseholder", since: "Mar 2024" },
          { name: "Peter Lange", role: "Co-leaseholder", since: "Mar 2024" },
        ],
        history: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      },
      {
        unit: "TH-4",
        beds: 2,
        baths: 1,
        sqft: 1180,
        rent: 2240,
        balance: 410,
        dueInDays: -1,
        status: "late",
        leaseEnd: "Jul 31, 2026",
        tenants: [{ name: "Hollis Grant", role: "Leaseholder", since: "Nov 2023" }],
        history: [1, 1, 1, 1, 0.5, 1, 1, 1, 0.5, 1, 1, 0.5],
      },
    ],
  },
  {
    code: "PR-1156",
    name: "The Beacon at 5th",
    type: "Student",
    address1: "501 University Boulevard",
    city: "Tempe",
    state: "AZ",
    zip: "85281",
    manager: "Marcus Ibarra",
    managerPhone: "(480) 555-1156",
    managerEmail: "m.ibarra@beacon5th.com",
    acquired: "Jan 2020",
    yearBuilt: 2016,
    trend: [210, 198, 240, 256, 231, 205, 188, 176, 194, 220, 248, 262],
    units: [
      {
        unit: "101",
        beds: 4,
        baths: 2,
        sqft: 1240,
        rent: 3480,
        balance: 0,
        dueInDays: 8,
        status: "current",
        leaseEnd: "Jul 31, 2026",
        tenants: [
          { name: "Kayla Brennan", role: "Leaseholder", since: "Aug 2024" },
          { name: "Tobi Adeyemi", role: "Occupant", since: "Aug 2024" },
          { name: "Sam Petrov", role: "Occupant", since: "Aug 2024" },
          { name: "Rene Duval", role: "Occupant", since: "Aug 2024" },
        ],
        history: [0.5, 1, 1, 1, 1, 0.5, 1, 1, 1, 1, 1, 1],
      },
      {
        unit: "208",
        beds: 2,
        baths: 1,
        sqft: 860,
        rent: 1980,
        balance: 1980,
        dueInDays: -12,
        status: "delinquent",
        leaseEnd: "Jul 31, 2026",
        tenants: [
          { name: "Jordyn Pike", role: "Leaseholder", since: "Aug 2023" },
          { name: "Aliyah Stokes", role: "Co-leaseholder", since: "Aug 2023" },
        ],
        history: [1, 1, 0.5, 0, 1, 1, 0.5, 0, 1, 0, 0, 0],
      },
      {
        unit: "214",
        beds: 2,
        baths: 1,
        sqft: 860,
        rent: 1980,
        balance: 0,
        dueInDays: 8,
        status: "current",
        leaseEnd: "Jul 31, 2026",
        tenants: [
          { name: "Fernando Cruz", role: "Leaseholder", since: "Aug 2025" },
          { name: "Dmitri Volkov", role: "Occupant", since: "Aug 2025" },
        ],
        history: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      },
      {
        unit: "322",
        beds: 3,
        baths: 2,
        sqft: 1080,
        rent: 2640,
        balance: 880,
        dueInDays: -4,
        status: "late",
        leaseEnd: "Aug 15, 2026",
        tenants: [
          { name: "Priyanka Sethi", role: "Leaseholder", since: "Jan 2024" },
          { name: "Molly Reyes", role: "Occupant", since: "Jan 2024" },
        ],
        history: [1, 1, 1, 0.5, 1, 1, 0.5, 1, 1, 0.5, 1, 0.5],
      },
      {
        unit: "415",
        beds: 1,
        baths: 1,
        sqft: 520,
        rent: 1150,
        balance: 0,
        dueInDays: 30,
        status: "notice",
        leaseEnd: "Feb 28, 2026",
        tenants: [{ name: "Vacant — Leasing", role: "Leaseholder", since: "—" }],
        history: [1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0],
      },
    ],
  },
  {
    code: "PR-1188",
    name: "Silver Maple Manor",
    type: "Senior Living",
    address1: "34 Silver Maple Drive",
    city: "Portland",
    state: "OR",
    zip: "97219",
    manager: "Alice Kowalczyk",
    managerPhone: "(503) 555-1188",
    managerEmail: "alice.k@silvermaple.org",
    acquired: "Sep 2018",
    yearBuilt: 1996,
    trend: [64, 61, 66, 69, 62, 58, 55, 57, 61, 60, 58, 56],
    units: [
      {
        unit: "M-12",
        beds: 1,
        baths: 1,
        sqft: 680,
        rent: 1875,
        balance: 0,
        dueInDays: 15,
        status: "current",
        leaseEnd: "Mar 31, 2027",
        tenants: [{ name: "Walter Jessup", role: "Leaseholder", since: "Jun 2018" }],
        history: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      },
      {
        unit: "M-18",
        beds: 1,
        baths: 1,
        sqft: 680,
        rent: 1875,
        balance: 3750,
        dueInDays: -41,
        status: "delinquent",
        leaseEnd: "Month-to-month",
        tenants: [
          { name: "Rosalind Hartman", role: "Leaseholder", since: "Feb 2017" },
          { name: "Gene Hartman", role: "Co-leaseholder", since: "Feb 2017" },
        ],
        history: [1, 1, 1, 0.5, 0.5, 0, 0, 0.5, 0, 0, 0, 0],
      },
      {
        unit: "M-24",
        beds: 2,
        baths: 1,
        sqft: 910,
        rent: 2410,
        balance: 0,
        dueInDays: 6,
        status: "current",
        leaseEnd: "Jan 31, 2027",
        tenants: [{ name: "Bernice Ayoade", role: "Leaseholder", since: "Apr 2019" }],
        history: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      },
    ],
  },
  {
    code: "PR-1201",
    name: "Foundry District Flats",
    type: "Multifamily",
    address1: "77 Foundry Lane",
    city: "Pittsburgh",
    state: "PA",
    zip: "15201",
    manager: "Terrence Boyle",
    managerPhone: "(412) 555-1201",
    managerEmail: "tboyle@foundryflats.com",
    acquired: "May 2023",
    yearBuilt: 2021,
    trend: [18, 22, 27, 31, 26, 24, 29, 34, 38, 42, 45, 49],
    units: [
      {
        unit: "F-2",
        beds: 1,
        baths: 1,
        sqft: 715,
        rent: 1495,
        balance: 0,
        dueInDays: 13,
        status: "current",
        leaseEnd: "Jun 30, 2026",
        tenants: [{ name: "Yusuf Karim", role: "Leaseholder", since: "Jun 2023" }],
        history: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      },
      {
        unit: "F-5",
        beds: 2,
        baths: 2,
        sqft: 1065,
        rent: 2295,
        balance: 0,
        dueInDays: 13,
        status: "current",
        leaseEnd: "Sep 30, 2026",
        tenants: [
          { name: "Chloe Baptiste", role: "Leaseholder", since: "Aug 2023" },
          { name: "Ravi Menon", role: "Co-leaseholder", since: "Aug 2023" },
        ],
        history: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      },
      {
        unit: "F-8",
        beds: 2,
        baths: 1,
        sqft: 990,
        rent: 2095,
        balance: 2095,
        dueInDays: -8,
        status: "delinquent",
        leaseEnd: "Aug 31, 2026",
        tenants: [{ name: "Silas Trent", role: "Leaseholder", since: "Feb 2024" }],
        history: [1, 1, 1, 0.5, 1, 1, 0, 0.5, 0, 0, 1, 0],
      },
    ],
  },
  {
    code: "PR-1244",
    name: "Casa Verde Gardens",
    type: "Multifamily",
    address1: "2420 Palm Court",
    city: "Miami",
    state: "FL",
    zip: "33133",
    manager: "Lucia Ferrer",
    managerPhone: "(305) 555-1244",
    managerEmail: "lucia@cverde.co",
    acquired: "Feb 2017",
    yearBuilt: 1972,
    trend: [142, 139, 151, 147, 155, 162, 158, 149, 144, 151, 157, 166],
    units: [
      {
        unit: "CV-1",
        beds: 2,
        baths: 2,
        sqft: 1105,
        rent: 3120,
        balance: 0,
        dueInDays: 10,
        status: "current",
        leaseEnd: "May 31, 2026",
        tenants: [
          { name: "Ana & Luis Delgado", role: "Leaseholder", since: "Oct 2019" },
        ],
        history: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      },
      {
        unit: "CV-6",
        beds: 3,
        baths: 2,
        sqft: 1390,
        rent: 3860,
        balance: 7720,
        dueInDays: -58,
        status: "delinquent",
        leaseEnd: "Month-to-month",
        tenants: [
          { name: "Bruno Salazar", role: "Leaseholder", since: "Dec 2018" },
          { name: "Nadia Salazar", role: "Co-leaseholder", since: "Dec 2018" },
          { name: "Teo Salazar", role: "Occupant", since: "Jul 2023" },
        ],
        history: [1, 0.5, 1, 0, 0, 0.5, 0, 0, 0, 0.5, 0, 0],
      },
      {
        unit: "CV-9",
        beds: 1,
        baths: 1,
        sqft: 760,
        rent: 2180,
        balance: 0,
        dueInDays: 10,
        status: "current",
        leaseEnd: "Dec 31, 2026",
        tenants: [{ name: "Imani Brooks", role: "Leaseholder", since: "Feb 2025" }],
        history: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      },
      {
        unit: "CV-11",
        beds: 2,
        baths: 1,
        sqft: 1005,
        rent: 2870,
        balance: 720,
        dueInDays: -2,
        status: "late",
        leaseEnd: "Oct 31, 2026",
        tenants: [
          { name: "Dario Pinto", role: "Leaseholder", since: "Nov 2022" },
          { name: "Camila Rey", role: "Occupant", since: "Nov 2022" },
        ],
        history: [1, 1, 1, 1, 0.5, 1, 1, 1, 0.5, 1, 1, 0.5],
      },
    ],
  },
  {
    code: "PR-1289",
    name: "Northgate Commons",
    type: "Mixed-Use",
    address1: "15 Northgate Square",
    city: "Charlotte",
    state: "NC",
    zip: "28206",
    manager: "Wendell Paige",
    managerPhone: "(704) 555-1289",
    managerEmail: "w.paige@northgatecmn.com",
    acquired: "Aug 2020",
    yearBuilt: 2011,
    trend: [88, 91, 84, 79, 82, 87, 93, 96, 90, 86, 81, 78],
    units: [
      {
        unit: "NG-A",
        beds: 1,
        baths: 1,
        sqft: 780,
        rent: 1620,
        balance: 0,
        dueInDays: 16,
        status: "current",
        leaseEnd: "Apr 30, 2026",
        tenants: [{ name: "Harriet Sloane", role: "Leaseholder", since: "Jan 2023" }],
        history: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      },
      {
        unit: "NG-C",
        beds: 2,
        baths: 2,
        sqft: 1150,
        rent: 2340,
        balance: 2340,
        dueInDays: -27,
        status: "delinquent",
        leaseEnd: "Month-to-month",
        tenants: [
          { name: "Ozzie Nakamura", role: "Leaseholder", since: "Mar 2021" },
          { name: "Bex Nakamura", role: "Co-leaseholder", since: "Mar 2021" },
        ],
        history: [1, 1, 0.5, 0, 0.5, 0, 1, 0, 0, 0, 0, 0],
      },
      {
        unit: "NG-E",
        beds: 2,
        baths: 1,
        sqft: 1010,
        rent: 2060,
        balance: 0,
        dueInDays: 5,
        status: "current",
        leaseEnd: "Nov 30, 2026",
        tenants: [
          { name: "Talia Grant-Moss", role: "Leaseholder", since: "Sep 2024" },
          { name: "Jonah Reyes", role: "Occupant", since: "Sep 2024" },
        ],
        history: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      },
    ],
  },
];

/* ---------- derived helpers ---------- */

export const unitBalance = (u: Unit) => u.balance;

export const propertyBalance = (p: Property) =>
  p.units.reduce((sum, u) => sum + u.balance, 0);

export const propertyRentRoll = (p: Property) =>
  p.units.reduce((sum, u) => sum + u.rent, 0);

export const propertyTenants = (p: Property) =>
  p.units.reduce((sum, u) => sum + u.tenants.length, 0);

export const propertyOccupied = (p: Property) =>
  p.units.filter((u) => u.status !== "vacant" && u.status !== "notice").length;

export const propertyAtRisk = (p: Property) =>
  p.units.filter((u) => u.status === "delinquent" || u.status === "late").length;

export const propertyCollectionRate = (p: Property) => {
  const total = p.units.reduce((s, u) => s + u.history.length, 0);
  const paid = p.units.reduce((s, u) => s + u.history.reduce((a, b) => a + b, 0), 0);
  return total === 0 ? 1 : paid / total;
};

export const currency = (n: number, compact = false) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
    notation: compact ? "compact" : "standard",
  }).format(n);

export type Severity = "good" | "warn" | "bad";

export const severityOf = (balance: number, rent: number): Severity => {
  if (balance <= 0) return "good";
  if (rent > 0 && balance >= rent) return "bad";
  return "warn";
};

export const statusMeta: Record<
  UnitStatus,
  { label: string; dot: string; chip: string; bar: string }
> = {
  current: {
    label: "Current",
    dot: "bg-sage-500",
    chip: "bg-sage-50 dark:bg-sage-400/10 text-sage-700 dark:text-sage-300 ring-sage-200 dark:ring-sage-400/30",
    bar: "from-sage-400 to-sage-500",
  },
  late: {
    label: "Late",
    dot: "bg-sand-500",
    chip: "bg-sand-50 dark:bg-sand-400/10 text-sand-700 dark:text-sand-300 ring-sand-200 dark:ring-sand-400/30",
    bar: "from-sand-400 to-sand-500",
  },
  delinquent: {
    label: "Delinquent",
    dot: "bg-brick-500",
    chip: "bg-brick-50 dark:bg-brick-400/10 text-brick-700 dark:text-brick-300 ring-brick-200 dark:ring-brick-400/30",
    bar: "from-brick-400 to-brick-500",
  },
  notice: {
    label: "Notice",
    dot: "bg-mint-500",
    chip: "bg-mint-50 dark:bg-mint-400/10 text-mint-700 dark:text-mint-300 ring-mint-200 dark:ring-mint-400/30",
    bar: "from-mint-400 to-mint-500",
  },
  vacant: {
    label: "Vacant",
    dot: "bg-gry-400",
    chip: "bg-surface-2 text-ink-2 ring-hairline",
    bar: "from-gry-300 to-gry-400",
  },
};
