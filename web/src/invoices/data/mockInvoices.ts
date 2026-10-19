import type {
  ActivityEntry,
  ActivityKind,
  Invoice,
  InvoiceLineItem,
  InvoiceStatus,
  LineItemCategory,
  Payment,
  Property,
} from "@inv/types/invoice";

/**
 * Deterministic "today" for the prototype so that overdue / due-this-week /
 * due-this-month filters always produce meaningful results with the mock data.
 */
export const DEMO_TODAY = new Date("2026-10-22T09:00:00");

export const properties: Property[] = [
  { id: "prp_maple", name: "Maple Residence", city: "Toronto, ON", units: 42 },
  { id: "prp_cedar", name: "Cedar Apartments", city: "Ottawa, ON", units: 36 },
  { id: "prp_oak", name: "Oak Residence", city: "Hamilton, ON", units: 28 },
  { id: "prp_harbour", name: "Harbourview Lofts", city: "Toronto, ON", units: 54 },
  { id: "prp_birch", name: "Birch Court Townhomes", city: "Brampton, ON", units: 22 },
];

let seq = 0;
const nid = (prefix: string) => `${prefix}-${(++seq).toString().padStart(3, "0")}`;

const li = (
  description: string,
  category: LineItemCategory,
  quantity: number,
  unitPrice: number,
  taxRate = 0
): InvoiceLineItem => ({
  id: nid("li"),
  description,
  category,
  quantity,
  unitPrice,
  taxRate,
});

const pay = (
  invoiceId: string,
  date: string,
  method: Payment["method"],
  reference: string,
  amount: number,
  notes?: string
): Payment => ({ id: nid("pm"), invoiceId, date, method, reference, amount, notes });

export const tenants = [
  "John Smith",
  "Sarah Lee",
  "Michael Brown",
  "Emma Wilson",
  "Daniel Okoye",
  "Priya Raman",
  "Lucas Fontaine",
  "Hannah Blackwood",
  "Omar Haddad",
  "Grace Lindqvist",
  "Terrence Boyle",
  "Aisha Bello",
  "Nathan Reid",
  "Sofia Marchetti",
  "Kevin Zhou",
  "Renée Dubois",
  "Marcus Adeyemi",
  "Elena Petrova",
  "Liam Gallagher",
  "Yasmin Farouk",
  "Diego Santos",
  "Chloe Tremblay",
  "Robert Nkemelu",
  "Ingrid Halvorsen",
  "Sam Whitfield",
  "Fatima Zahra",
];

const initials = (name: string) =>
  name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");



type RawInvoice = Omit<
  Invoice,
  "currency" | "tenant" | "attachments" | "notes" | "activity"
> & { tenantName: string };

const raw: RawInvoice[] = [
  {
    id: "INV-2026-001",
    tenantName: "John Smith",
    propertyId: "prp_maple",
    propertyName: "Maple Residence",
    unit: "101",
    leaseRef: "LSE-2024-0117",
    type: "rent",
    status: "overdue",
    issueDate: "2026-10-01",
    dueDate: "2026-10-15",
    billingPeriodStart: "2026-10-01",
    billingPeriodEnd: "2026-10-31",
    discount: 0,
    memo: "Tenant notified by phone on Oct 16 — agreed to pay by Oct 24.",
    lineItems: [
      li("Monthly rent — Unit 101 (October 2026)", "Rent", 1, 1750, 0),
      li("Assigned storage locker L-08", "Storage", 1, 100, 0),
    ],
    payments: [],
  },
  {
    id: "INV-2026-002",
    tenantName: "Sarah Lee",
    propertyId: "prp_maple",
    propertyName: "Maple Residence",
    unit: "204",
    leaseRef: "LSE-2023-0442",
    type: "rent",
    status: "partially_paid",
    issueDate: "2026-10-05",
    dueDate: "2026-10-20",
    billingPeriodStart: "2026-10-01",
    billingPeriodEnd: "2026-10-31",
    discount: 0,
    memo: "Split payment arrangement approved by property manager.",
    lineItems: [
      li("Monthly rent — Unit 204 (October 2026)", "Rent", 1, 2010, 0),
      li("Water & sewer flat rate — October", "Utilities", 1, 90, 0),
    ],
    payments: [
      pay("INV-2026-002", "2026-10-18", "E-Transfer", "TRF-88421-KQ", 1000, "First of two agreed instalments."),
    ],
  },
  {
    id: "INV-2026-003",
    tenantName: "Michael Brown",
    propertyId: "prp_cedar",
    propertyName: "Cedar Apartments",
    unit: "302",
    leaseRef: "LSE-2022-0088",
    type: "rent",
    status: "paid",
    issueDate: "2026-10-08",
    dueDate: "2026-10-25",
    billingPeriodStart: "2026-10-01",
    billingPeriodEnd: "2026-10-31",
    discount: 0,
    lineItems: [
      li("Monthly rent — Unit 302 (October 2026)", "Rent", 1, 1500, 0),
      li("Underground parking stall C-12", "Parking", 1, 150, 0),
    ],
    payments: [
      pay("INV-2026-003", "2026-10-21", "Bank Transfer", "WT-2026-77410", 1650, "Paid in full ahead of due date."),
    ],
  },
  {
    id: "INV-2026-004",
    tenantName: "Emma Wilson",
    propertyId: "prp_oak",
    propertyName: "Oak Residence",
    unit: "103",
    leaseRef: "LSE-2026-0231",
    type: "rent",
    status: "draft",
    issueDate: "2026-10-10",
    dueDate: "2026-10-30",
    billingPeriodStart: "2026-11-01",
    billingPeriodEnd: "2026-11-30",
    discount: 50,
    memo: "Awaiting confirmation of the November good-standing credit before sending.",
    lineItems: [li("Monthly rent — Unit 103 (November 2026)", "Rent", 1, 1950, 0)],
    payments: [],
  },
  {
    id: "INV-2026-005",
    tenantName: "Daniel Okoye",
    propertyId: "prp_harbour",
    propertyName: "Harbourview Lofts",
    unit: "1210",
    leaseRef: "LSE-2021-0310",
    type: "rent",
    status: "overdue",
    issueDate: "2026-09-01",
    dueDate: "2026-09-15",
    billingPeriodStart: "2026-09-01",
    billingPeriodEnd: "2026-09-30",
    discount: 0,
    memo: "Two reminder notices sent. Escalated to collections review.",
    lineItems: [
      li("Monthly rent — Unit 1210 (September 2026)", "Rent", 1, 2600, 0),
      li("Reserved parking — level P2", "Parking", 1, 150, 0),
    ],
    payments: [],
  },
  {
    id: "INV-2026-006",
    tenantName: "Priya Raman",
    propertyId: "prp_maple",
    propertyName: "Maple Residence",
    unit: "412",
    leaseRef: "LSE-2025-0509",
    type: "utilities",
    status: "unpaid",
    issueDate: "2026-10-01",
    dueDate: "2026-10-15",
    billingPeriodStart: "2026-09-01",
    billingPeriodEnd: "2026-09-30",
    discount: 0,
    lineItems: [
      li("Monthly rent — Unit 412 (October 2026)", "Rent", 1, 2150, 0),
      li("Hydro — metered usage 612 kWh", "Utilities", 1, 170.04, 13),
    ],
    payments: [],
  },
  {
    id: "INV-2026-007",
    tenantName: "Lucas Fontaine",
    propertyId: "prp_cedar",
    propertyName: "Cedar Apartments",
    unit: "118",
    leaseRef: "LSE-2026-0044",
    type: "rent",
    status: "pending_approval",
    issueDate: "2026-10-03",
    dueDate: "2026-10-18",
    billingPeriodStart: "2026-10-01",
    billingPeriodEnd: "2026-10-31",
    discount: 0,
    memo: "New lease — pending regional manager approval before issuing.",
    lineItems: [
      li("Monthly rent — Unit 118 (October 2026)", "Rent", 1, 1450, 0),
      li("Water & sewer flat rate — October", "Utilities", 1, 135, 0),
    ],
    payments: [],
  },
  {
    id: "INV-2026-008",
    tenantName: "Hannah Blackwood",
    propertyId: "prp_oak",
    propertyName: "Oak Residence",
    unit: "207",
    leaseRef: "LSE-2024-0812",
    type: "maintenance",
    status: "partially_paid",
    issueDate: "2026-09-20",
    dueDate: "2026-10-05",
    billingPeriodStart: "2026-09-01",
    billingPeriodEnd: "2026-09-30",
    discount: 0,
    memo: "Chargeback for tenant-caused damage; tenant disputing portion.",
    lineItems: [
      li("Monthly rent — Unit 207 (September 2026)", "Rent", 1, 1750, 0),
      li("Emergency plumbing repair — supply line", "Maintenance", 1, 208.5, 13),
    ],
    payments: [
      pay("INV-2026-008", "2026-10-02", "Cheque", "CHQ-000431", 500, "Partial cheque — tenant requested balance plan."),
    ],
  },
  {
    id: "INV-2026-009",
    tenantName: "Omar Haddad",
    propertyId: "prp_birch",
    propertyName: "Birch Court Townhomes",
    unit: "TH-14",
    leaseRef: "LSE-2023-0205",
    type: "rent",
    status: "paid",
    issueDate: "2026-10-01",
    dueDate: "2026-10-15",
    billingPeriodStart: "2026-10-01",
    billingPeriodEnd: "2026-10-31",
    discount: 0,
    lineItems: [li("Monthly rent — Townhome 14 (October 2026)", "Rent", 1, 2890, 0)],
    payments: [
      pay("INV-2026-009", "2026-10-09", "Pre-Authorized Debit", "PAD-55120-B", 2890, "Autopay — rent schedule."),
    ],
  },
  {
    id: "INV-2026-010",
    tenantName: "Grace Lindqvist",
    propertyId: "prp_harbour",
    propertyName: "Harbourview Lofts",
    unit: "306",
    leaseRef: "LSE-2025-0771",
    type: "other",
    status: "void",
    issueDate: "2026-10-06",
    dueDate: "2026-10-21",
    billingPeriodStart: "2026-10-01",
    billingPeriodEnd: "2026-10-31",
    discount: 0,
    memo: "Issued against the wrong unit — voided and re-issued as INV-2026-014.",
    lineItems: [
      li("Monthly rent — Unit 306 (October 2026)", "Rent", 1, 2400, 0),
      li("Pet fee — one cat", "Fees", 1, 45, 0),
    ],
    payments: [],
  },
  {
    id: "INV-2026-011",
    tenantName: "Terrence Boyle",
    propertyId: "prp_maple",
    propertyName: "Maple Residence",
    unit: "009",
    leaseRef: "LSE-2022-0140",
    type: "rent",
    status: "overdue",
    issueDate: "2026-09-15",
    dueDate: "2026-09-30",
    billingPeriodStart: "2026-09-01",
    billingPeriodEnd: "2026-09-30",
    discount: 0,
    lineItems: [li("Monthly rent — Unit 9 (September 2026)", "Rent", 1, 1625, 0)],
    payments: [],
  },
  {
    id: "INV-2026-012",
    tenantName: "Aisha Bello",
    propertyId: "prp_cedar",
    propertyName: "Cedar Apartments",
    unit: "421",
    leaseRef: "LSE-2026-0198",
    type: "maintenance",
    status: "unpaid",
    issueDate: "2026-10-12",
    dueDate: "2026-10-27",
    billingPeriodStart: "2026-10-01",
    billingPeriodEnd: "2026-10-31",
    discount: 0,
    lineItems: [
      li("Window replacement — bedroom, labour", "Maintenance", 1, 640, 13),
      li("Window unit — triple pane, 900mm", "Maintenance", 1, 480, 13),
    ],
    payments: [],
  },
  {
    id: "INV-2026-013",
    tenantName: "Nathan Reid",
    propertyId: "prp_oak",
    propertyName: "Oak Residence",
    unit: "315",
    leaseRef: "LSE-2024-0333",
    type: "utilities",
    status: "partially_paid",
    issueDate: "2026-10-12",
    dueDate: "2026-10-26",
    billingPeriodStart: "2026-09-01",
    billingPeriodEnd: "2026-09-30",
    discount: 0,
    lineItems: [
      li("Hydro — metered usage 438 kWh", "Utilities", 1, 96.4, 13),
      li("Thermal — shared plant recovery", "Utilities", 1, 62, 0),
      li("Water — metered 9.4 m³", "Utilities", 1, 47.2, 0),
    ],
    payments: [
      pay("INV-2026-013", "2026-10-19", "Credit Card", "CDN-99213-XD", 100, "Card payment via tenant portal."),
    ],
  },
  {
    id: "INV-2026-014",
    tenantName: "Sofia Marchetti",
    propertyId: "prp_harbour",
    propertyName: "Harbourview Lofts",
    unit: "902",
    leaseRef: "LSE-2026-0301",
    type: "rent",
    status: "draft",
    issueDate: "2026-10-15",
    dueDate: "2026-10-29",
    billingPeriodStart: "2026-11-01",
    billingPeriodEnd: "2026-11-30",
    discount: 0,
    memo: "Replacement invoice for the voided INV-2026-010.",
    lineItems: [
      li("Monthly rent — Unit 902 (November 2026)", "Rent", 1, 2400, 0),
      li("Pet fee — one cat", "Fees", 1, 45, 0),
    ],
    payments: [],
  },
  {
    id: "INV-2026-015",
    tenantName: "Kevin Zhou",
    propertyId: "prp_maple",
    propertyName: "Maple Residence",
    unit: "227",
    leaseRef: "LSE-2023-0664",
    type: "rent",
    status: "paid",
    issueDate: "2026-10-15",
    dueDate: "2026-10-30",
    billingPeriodStart: "2026-10-01",
    billingPeriodEnd: "2026-10-31",
    discount: 25,
    lineItems: [
      li("Monthly rent — Unit 227 (October 2026)", "Rent", 1, 1895, 0),
      li("Bike room storage", "Storage", 1, 30, 0),
    ],
    payments: [
      pay("INV-2026-015", "2026-10-17", "Bank Transfer", "WT-2026-78115", 1900, "Loyalty credit of $25.00 applied."),
    ],
  },
  {
    id: "INV-2026-016",
    tenantName: "Renée Dubois",
    propertyId: "prp_birch",
    propertyName: "Birch Court Townhomes",
    unit: "TH-03",
    leaseRef: "LSE-2025-0122",
    type: "other",
    status: "unpaid",
    issueDate: "2026-10-16",
    dueDate: "2026-10-31",
    billingPeriodStart: "2026-10-01",
    billingPeriodEnd: "2026-10-31",
    discount: 0,
    lineItems: [
      li("Second parking pad — October", "Parking", 1, 85, 13),
      li("Pet fee — one dog", "Fees", 1, 45, 0),
      li("NSF chargeback (Sep 28)", "Fees", 1, 48.5, 0),
    ],
    payments: [],
  },
  {
    id: "INV-2026-017",
    tenantName: "Marcus Adeyemi",
    propertyId: "prp_cedar",
    propertyName: "Cedar Apartments",
    unit: "205",
    leaseRef: "LSE-2021-0902",
    type: "rent",
    status: "overdue",
    issueDate: "2026-09-05",
    dueDate: "2026-09-20",
    billingPeriodStart: "2026-09-01",
    billingPeriodEnd: "2026-09-30",
    discount: 0,
    memo: "Payment plan in place: $750 on Oct 05, balance due Nov 05.",
    lineItems: [
      li("Monthly rent — Unit 205 (September 2026)", "Rent", 1, 1690, 0),
      li("Late fee — 2% of balance", "Fees", 1, 33.8, 0),
    ],
    payments: [
      pay("INV-2026-017", "2026-10-05", "E-Transfer", "TRF-87902-PL", 750, "Instalment 1 of 2 per payment plan."),
    ],
  },
  {
    id: "INV-2026-018",
    tenantName: "Elena Petrova",
    propertyId: "prp_oak",
    propertyName: "Oak Residence",
    unit: "410",
    leaseRef: "LSE-2026-0418",
    type: "rent",
    status: "pending_approval",
    issueDate: "2026-10-18",
    dueDate: "2026-11-02",
    billingPeriodStart: "2026-11-01",
    billingPeriodEnd: "2026-11-30",
    discount: 0,
    memo: "Rent increase applied per renewal — needs approval above 2.5%.",
    lineItems: [li("Monthly rent — Unit 410 (November 2026)", "Rent", 1, 2045, 0)],
    payments: [],
  },
  {
    id: "INV-2026-019",
    tenantName: "Liam Gallagher",
    propertyId: "prp_harbour",
    propertyName: "Harbourview Lofts",
    unit: "118",
    leaseRef: "LSE-2025-0250",
    type: "maintenance",
    status: "unpaid",
    issueDate: "2026-10-20",
    dueDate: "2026-11-04",
    billingPeriodStart: "2026-10-01",
    billingPeriodEnd: "2026-10-31",
    discount: 0,
    lineItems: [
      li("In-suite appliance repair — dishwasher", "Maintenance", 2, 185, 13),
      li("Replacement door seal kit", "Maintenance", 1, 64.5, 13),
    ],
    payments: [],
  },
  {
    id: "INV-2026-020",
    tenantName: "Yasmin Farouk",
    propertyId: "prp_maple",
    propertyName: "Maple Residence",
    unit: "515",
    leaseRef: "LSE-2020-0012",
    type: "utilities",
    status: "overdue",
    issueDate: "2026-08-25",
    dueDate: "2026-09-10",
    billingPeriodStart: "2026-08-01",
    billingPeriodEnd: "2026-08-31",
    discount: 0,
    memo: "Final notice issued Oct 12. Ledger hold placed on account.",
    lineItems: [
      li("Hydro — metered usage 705 kWh", "Utilities", 1, 142.8, 13),
      li("Water — metered 14.1 m³", "Utilities", 1, 68, 0),
      li("Late fee — 2% of balance", "Fees", 1, 28.92, 0),
    ],
    payments: [],
  },
  {
    id: "INV-2026-021",
    tenantName: "Diego Santos",
    propertyId: "prp_cedar",
    propertyName: "Cedar Apartments",
    unit: "512",
    leaseRef: "LSE-2026-0455",
    type: "rent",
    status: "draft",
    issueDate: "2026-10-20",
    dueDate: "2026-11-05",
    billingPeriodStart: "2026-11-01",
    billingPeriodEnd: "2026-11-30",
    discount: 0,
    lineItems: [
      li("Monthly rent — Unit 512 (November 2026)", "Rent", 1, 1780, 0),
      li("Underground parking stall C-31", "Parking", 1, 135, 0),
    ],
    payments: [],
  },
  {
    id: "INV-2026-022",
    tenantName: "Chloe Tremblay",
    propertyId: "prp_oak",
    propertyName: "Oak Residence",
    unit: "122",
    leaseRef: "LSE-2024-0571",
    type: "utilities",
    status: "unpaid",
    issueDate: "2026-10-21",
    dueDate: "2026-11-06",
    billingPeriodStart: "2026-10-01",
    billingPeriodEnd: "2026-10-31",
    discount: 0,
    lineItems: [
      li("Hydro — metered usage 356 kWh", "Utilities", 1, 78.3, 13),
      li("Thermal — shared plant recovery", "Utilities", 1, 58, 0),
    ],
    payments: [],
  },
  {
    id: "INV-2026-023",
    tenantName: "Robert Nkemelu",
    propertyId: "prp_birch",
    propertyName: "Birch Court Townhomes",
    unit: "TH-09",
    leaseRef: "LSE-2022-0610",
    type: "rent",
    status: "paid",
    issueDate: "2026-10-21",
    dueDate: "2026-11-07",
    billingPeriodStart: "2026-11-01",
    billingPeriodEnd: "2026-11-30",
    discount: 0,
    lineItems: [li("Monthly rent — Townhome 9 (November 2026)", "Rent", 1, 2950, 0)],
    payments: [
      pay("INV-2026-023", "2026-10-22", "Pre-Authorized Debit", "PAD-55488-C", 2950, "Autopay — rent schedule."),
    ],
  },
  {
    id: "INV-2026-024",
    tenantName: "Ingrid Halvorsen",
    propertyId: "prp_harbour",
    propertyName: "Harbourview Lofts",
    unit: "1512",
    leaseRef: "LSE-2023-0777",
    type: "rent",
    status: "pending_approval",
    issueDate: "2026-10-22",
    dueDate: "2026-11-08",
    billingPeriodStart: "2026-11-01",
    billingPeriodEnd: "2026-11-30",
    discount: 100,
    memo: "Renewal incentive — one-time $100 credit pending approval.",
    lineItems: [
      li("Monthly rent — Unit 1512 (November 2026)", "Rent", 1, 3350, 0),
      li("Two parking stalls — level P1", "Parking", 2, 160, 0),
    ],
    payments: [],
  },
  {
    id: "INV-2026-025",
    tenantName: "Sam Whitfield",
    propertyId: "prp_maple",
    propertyName: "Maple Residence",
    unit: "333",
    leaseRef: "LSE-2026-0512",
    type: "other",
    status: "unpaid",
    issueDate: "2026-10-22",
    dueDate: "2026-11-10",
    billingPeriodStart: "2026-10-22",
    billingPeriodEnd: "2026-11-21",
    discount: 0,
    lineItems: [
      li("Guest suite — 3 nights @ $145", "Fees", 3, 145, 13),
      li("Moving elevator reservation", "Fees", 1, 250, 0),
    ],
    payments: [],
  },
  {
    id: "INV-2026-026",
    tenantName: "Fatima Zahra",
    propertyId: "prp_cedar",
    propertyName: "Cedar Apartments",
    unit: "601",
    leaseRef: "LSE-2024-0910",
    type: "maintenance",
    status: "paid",
    issueDate: "2026-10-22",
    dueDate: "2026-11-12",
    billingPeriodStart: "2026-10-01",
    billingPeriodEnd: "2026-10-31",
    discount: 0,
    lineItems: [
      li("Balcony drain clearing — contracted", "Maintenance", 1, 320, 13),
      li("Preventative inspection — Q4", "Maintenance", 1, 140, 13),
    ],
    payments: [
      pay("INV-2026-026", "2026-10-22", "Bank Transfer", "WT-2026-78501", 520.16, "Paid on receipt."),
    ],
  },
];

/* ---------- Attachments, notes and timelines ---------- */

const attachmentsFor = (inv: RawInvoice): Invoice["attachments"] => {
  const base: Invoice["attachments"] = [
    {
      id: nid("at"),
      name: `${inv.id}.pdf`,
      kind: "pdf" as const,
      size: "184 KB",
      uploadedBy: "System",
      uploadedAt: inv.issueDate,
    },
  ];
  if (inv.type === "maintenance" || inv.type === "utilities") {
    base.push({
      id: nid("at"),
      name:
        inv.type === "maintenance"
          ? "contractor-invoice-copy.pdf"
          : "meter-readings-oct-2026.xlsx",
      kind: inv.type === "maintenance" ? "pdf" : "sheet",
      size: inv.type === "maintenance" ? "96 KB" : "24 KB",
      uploadedBy: "Dana Whitmore",
      uploadedAt: inv.dueDate,
    });
  }
  if (inv.status === "partially_paid" || inv.status === "paid") {
    base.push({
      id: nid("at"),
      name: "remittance-advice.jpg",
      kind: "image",
      size: "412 KB",
      uploadedBy: "Tenant portal",
      uploadedAt: inv.payments[0]?.date ?? inv.dueDate,
    });
  }
  return base;
};

const notesFor = (inv: RawInvoice): Invoice["notes"] => {
  const notes: Invoice["notes"] = [];
  if (inv.memo) {
    notes.push({
      id: nid("nt"),
      author: "Dana Whitmore",
      createdAt: `${inv.dueDate}T14:20:00`,
      body: inv.memo,
      pinned: true,
    });
  }
  if (inv.status === "overdue") {
    notes.push({
      id: nid("nt"),
      author: "System",
      createdAt: `${inv.dueDate}T09:00:00`,
      body: "Automated reminder email sent to tenant (reminder #1 of 3).",
    });
  }
  if (inv.status === "paid") {
    notes.push({
      id: nid("nt"),
      author: "Dana Whitmore",
      createdAt: `${inv.dueDate}T16:05:00`,
      body: "Reconciled against the property ledger. Nothing outstanding.",
    });
  }
  return notes;
};

const activityFor = (inv: RawInvoice, notes: Invoice["notes"]): ActivityEntry[] => {
  const out: ActivityEntry[] = [];
  const push = (
    kind: ActivityKind,
    label: string,
    at: string,
    actor: string,
    detail?: string
  ) => out.push({ id: nid("ac"), kind, label, detail, actor, at });

  push("created", "Invoice created", `${inv.issueDate}T09:12:00`, "Dana Whitmore", `Draft generated from ${inv.leaseRef}.`);

  const editDate = addDays(inv.issueDate, 1);
  if (inv.discount > 0) {
    push("edited", "Discount applied", `${editDate}T11:40:00`, "Dana Whitmore", `Credit of $${inv.discount.toFixed(2)} CAD added.`);
  } else if (inv.type !== "rent") {
    push("edited", "Line items updated", `${editDate}T10:05:00`, "Dana Whitmore", "Quantities and tax rates verified against vendor bill.");
  } else {
    push("edited", "Lease charges synced", `${editDate}T08:30:00`, "System", "Recurring rent schedule imported from the lease.");
  }

  if (inv.status === "pending_approval") {
    push("approved", "Awaiting approval", `${editDate}T15:00:00`, "System", "Routed to regional manager — Marcus Hale.");
  } else if (inv.status !== "draft" && inv.status !== "void") {
    push("approved", "Invoice approved", `${editDate}T15:00:00`, "Marcus Hale");
    push("sent", "Invoice sent to tenant", `${addDays(inv.issueDate, 1)}T16:00:00`, "System", `Delivered to tenant portal and email.`);
  }

  if (inv.status === "void") {
    push("voided", "Invoice voided", `${inv.dueDate}T09:45:00`, "Dana Whitmore", inv.memo);
  }

  inv.payments.forEach((p) =>
    push("payment", "Payment recorded", `${p.date}T13:30:00`, "Dana Whitmore", `${p.method} · ${p.reference}`)
  );

  if (inv.status === "paid") {
    push("paid", "Invoice marked as paid", `${inv.payments.at(-1)?.date ?? inv.dueDate}T13:31:00`, "System", "Balance cleared in full.");
  }

  if (inv.status === "overdue") {
    const first = notes.at(-1)?.createdAt ?? `${inv.dueDate}T09:00:00`;
    push("reminder", "Marked overdue", `${inv.dueDate}T00:05:00`, "System", "Past due — reminder sequence started.");
    if (first) push("reminder", "Reminder #1 sent", first, "System");
  }

  return out;
};

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const TENANT_META: Record<string, { phone: string; email: string }> = {};
raw.forEach((inv, i) => {
  const digits = (100 + i * 37) % 900 + 100;
  const last4 = (1000 + i * 131) % 10000;
  TENANT_META[inv.tenantName] = {
    phone: `(${416 + (i % 4) * 2}) ${digits}-${String(last4).padStart(4, "0")}`,
    email: `${inv.tenantName.toLowerCase().replace(/[^a-z ]/g, "").trim().replace(/\s+/g, ".")}@${
      ["gmail.com", "outlook.com", "fastmail.com", "proton.me"][i % 4]
    }`,
  };
});

export const seedInvoices: Invoice[] = raw.map((inv) => {
  const notes = notesFor(inv);
  const meta = TENANT_META[inv.tenantName];
  return {
    ...inv,
    currency: "CAD",
    tenant: {
      name: inv.tenantName,
      email: meta.email,
      phone: meta.phone,
      avatarInitials: initials(inv.tenantName),
    },
    attachments: attachmentsFor(inv),
    notes,
    activity: activityFor(inv, notes),
  };
});

export const invoicesById = (list: Invoice[]) =>
  Object.fromEntries(list.map((i) => [i.id, i]));

export const statusRank: Record<InvoiceStatus, number> = {
  overdue: 0,
  unpaid: 1,
  partially_paid: 2,
  pending_approval: 3,
  draft: 4,
  paid: 5,
  void: 6,
};

export const nextInvoiceId = (list: Invoice[]): string => {
  const nums = list
    .map((i) => Number(i.id.split("-").pop()))
    .filter((n) => Number.isFinite(n)) as number[];
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `INV-2026-${String(next).padStart(3, "0")}`;
};
