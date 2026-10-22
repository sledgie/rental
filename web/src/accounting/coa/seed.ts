import type { AccountType } from "./taxonomy";
import { defaultNormalBalance } from "./taxonomy";
import type { Account, AccountRole, AccountStatus } from "./types";

interface SeedNode {
  code: string;
  name: string;
  type: AccountType;
  role?: AccountRole;
  classification?: string;
  status?: AccountStatus;
  description?: string;
  taxCode?: string;
  balance?: number;
  openItems?: number;
  ytd?: number;
  children?: SeedNode[];
}

/**
 * Illustrative mock chart for a Canadian property-management business.
 * Sample records only — not a claim of compliance with any accounting,
 * trust-accounting or CRA regime. Everything is editable in-session.
 */
const SEED: SeedNode[] = [
  {
    code: "1000",
    name: "Assets",
    type: "Asset",
    role: "Group",
    classification: "Current Asset",
    description: "Everything the business owns or controls, including operating and trust funds held on behalf of owners.",
    children: [
      {
        code: "1100",
        name: "Current Assets",
        type: "Asset",
        role: "Group",
        classification: "Current Asset",
        balance: 1884320.44,
        children: [
          {
            code: "1101",
            name: "Operating Bank Account",
            type: "Asset",
            classification: "Current Asset",
            description: "RBC operating chequing ••4821 — general business disbursements.",
            balance: 412880.19,
            ytd: 1884200.5,
            openItems: 14,
          },
          {
            code: "1102",
            name: "Trust Bank Account",
            type: "Asset",
            classification: "Trust Asset",
            description: "Segregated trust account holding owner funds and tenant deposits. Never commingled with operating cash.",
            balance: 1187420.05,
            ytd: 6420880.77,
            openItems: 38,
          },
          {
            code: "1110",
            name: "Accounts Receivable",
            type: "Asset",
            role: "Group",
            classification: "Current Asset",
            balance: 214660.2,
            children: [
              {
                code: "1111",
                name: "Tenant Rent Receivable",
                type: "Asset",
                classification: "Current Asset",
                description: "Unpaid rent charged to tenant ledgers, aged by property.",
                balance: 168240.2,
                openItems: 27,
                ytd: 1420880.4,
              },
              {
                code: "1112",
                name: "Other Receivables",
                type: "Asset",
                classification: "Current Asset",
                description: "Damage claims, NSF charges and insurance recoveries owing to the business.",
                balance: 46420.0,
                openItems: 6,
              },
              {
                code: "1113",
                name: "Allowance for Doubtful Accounts",
                type: "Asset",
                classification: "Contra Asset",
                description: "Reserve against aged tenant receivables.",
                balance: -18500,
              },
            ],
          },
          {
            code: "1120",
            name: "Prepaid Expenses",
            type: "Asset",
            classification: "Current Asset",
            description: "Prepaid insurance and service contracts amortised over the coverage period.",
            balance: 32940.0,
          },
          {
            code: "1140",
            name: "GST/HST Input Tax Credits Receivable",
            type: "Asset",
            classification: "Current Asset",
            taxCode: "ITC",
            description: "Recoverable GST/HST paid on operating and property expenses.",
            balance: 14920.0,
            openItems: 3,
          },
        ],
      },
      {
        code: "1200",
        name: "Non-Current Assets",
        type: "Asset",
        role: "Group",
        classification: "Non-Current Asset",
        balance: 186400.0,
        children: [
          {
            code: "1210",
            name: "Property and Equipment",
            type: "Asset",
            role: "Group",
            classification: "Non-Current Asset",
            balance: 214000,
            children: [
              {
                code: "1211",
                name: "Computer and Office Equipment",
                type: "Asset",
                classification: "Non-Current Asset",
                balance: 48200,
              },
              {
                code: "1212",
                name: "Leasehold Improvements",
                type: "Asset",
                classification: "Non-Current Asset",
                balance: 96300,
              },
              {
                code: "1213",
                name: "Furniture and Fixtures",
                type: "Asset",
                classification: "Non-Current Asset",
                balance: 69500,
              },
            ],
          },
          {
            code: "1220",
            name: "Accumulated Depreciation",
            type: "Asset",
            classification: "Contra Asset",
            description: "Cumulative capital cost allowance-book depreciation on property and equipment.",
            balance: -27600,
          },
          {
            code: "1230",
            name: "Capitalized Development Costs",
            type: "Asset",
            classification: "Intangible Asset",
            status: "Inactive",
            description: "Legacy portal build costs — closed to new activity after the 2024 platform migration.",
            balance: 0,
          },
        ],
      },
    ],
  },
  {
    code: "2000",
    name: "Liabilities",
    type: "Liability",
    role: "Group",
    classification: "Current Liability",
    description: "Amounts owed to third parties, owners and tenants, including statutory remittances.",
    children: [
      {
        code: "2100",
        name: "Current Liabilities",
        type: "Liability",
        role: "Group",
        classification: "Current Liability",
        balance: 1462880.9,
        children: [
          {
            code: "2101",
            name: "Accounts Payable",
            type: "Liability",
            classification: "Current Liability",
            description: "Trade invoices from vendors, contractors and utility providers.",
            balance: 184320.66,
            openItems: 41,
            ytd: 940220.11,
          },
          {
            code: "2102",
            name: "Accrued Expenses",
            type: "Liability",
            classification: "Current Liability",
            description: "Expenses incurred but not yet invoiced at period end.",
            balance: 62180.24,
            openItems: 9,
          },
          {
            code: "2103",
            name: "GST/HST Payable",
            type: "Liability",
            classification: "Statutory Liability",
            taxCode: "HST13",
            description: "Net GST/HST collected less input tax credits, remitted quarterly.",
            balance: 28410.0,
          },
          {
            code: "2104",
            name: "Source Deductions Payable",
            type: "Liability",
            classification: "Statutory Liability",
            description: "CPP, EI and income tax withheld from payroll, remitted semi-monthly.",
            balance: 19880.0,
          },
          {
            code: "2110",
            name: "Tenant Security Deposits Payable",
            type: "Liability",
            classification: "Trust Liability",
            description: "Deposits held in trust and refundable at end of tenancy, less approved deductions.",
            balance: 964200.0,
            openItems: 122,
          },
          {
            code: "2120",
            name: "Prepaid Rent",
            type: "Liability",
            classification: "Current Liability",
            description: "Rent received in advance of the period it applies to (deferred revenue).",
            balance: 203890.0,
            openItems: 17,
          },
        ],
      },
      {
        code: "2200",
        name: "Long-Term Liabilities",
        type: "Liability",
        role: "Group",
        classification: "Long-Term Liability",
        balance: 2840000,
        children: [
          {
            code: "2201",
            name: "Mortgage Payable",
            type: "Liability",
            classification: "Long-Term Liability",
            description: "Principal outstanding on the head-office building mortgage.",
            balance: 2650000,
          },
          {
            code: "2202",
            name: "Equipment Financing",
            type: "Liability",
            classification: "Long-Term Liability",
            description: "Term loan secured against office and field equipment.",
            balance: 190000,
          },
        ],
      },
    ],
  },
  {
    code: "3000",
    name: "Equity",
    type: "Equity",
    role: "Group",
    classification: "Contributed Capital",
    children: [
      {
        code: "3100",
        name: "Owner's Equity",
        type: "Equity",
        role: "Group",
        classification: "Contributed Capital",
        balance: 310000,
        children: [
          {
            code: "3110",
            name: "Owner Contributions",
            type: "Equity",
            classification: "Contributed Capital",
            balance: 400000,
          },
          {
            code: "3120",
            name: "Owner Drawings",
            type: "Equity",
            classification: "Drawings",
            balance: -90000,
          },
        ],
      },
      { code: "3200", name: "Retained Earnings", type: "Equity", classification: "Retained Earnings", balance: 624180.5 },
      {
        code: "3300",
        name: "Current Year Earnings",
        type: "Equity",
        classification: "Retained Earnings",
        description: "System-calculated net income for the open fiscal year. Not directly posted.",
        balance: 0,
      },
    ],
  },
  {
    code: "4000",
    name: "Income",
    type: "Revenue",
    role: "Group",
    classification: "Operating Revenue",
    description: "Revenue earned from managed properties, management contracts and ancillary services.",
    children: [
      {
        code: "4100",
        name: "Rental Income",
        type: "Revenue",
        role: "Group",
        classification: "Operating Revenue",
        taxCode: "EXEMPT",
        balance: 4188200,
        children: [
          { code: "4110", name: "Residential Rent Revenue", type: "Revenue", classification: "Operating Revenue", taxCode: "EXEMPT", balance: 2842600, ytd: 2842600, openItems: 6 },
          { code: "4120", name: "Commercial Rent Revenue", type: "Revenue", classification: "Operating Revenue", taxCode: "HST13", balance: 986400, ytd: 986400 },
          { code: "4130", name: "Parking and Locker Revenue", type: "Revenue", classification: "Operating Revenue", taxCode: "HST13", balance: 214800 },
          { code: "4140", name: "Laundry and Vending Revenue", type: "Revenue", classification: "Service Revenue", balance: 144400 },
        ],
      },
      {
        code: "4200",
        name: "Property Management Fees",
        type: "Revenue",
        role: "Group",
        classification: "Fee Revenue",
        taxCode: "HST13",
        balance: 612400,
        children: [
          { code: "4210", name: "Base Management Fees", type: "Revenue", classification: "Fee Revenue", taxCode: "HST13", balance: 498200, ytd: 498200, openItems: 4 },
          { code: "4220", name: "Leasing Commission Income", type: "Revenue", classification: "Service Revenue", taxCode: "HST13", balance: 114200 },
        ],
      },
      {
        code: "4300",
        name: "Other Service Income",
        type: "Revenue",
        role: "Group",
        classification: "Service Revenue",
        balance: 86400,
        children: [
          { code: "4310", name: "Maintenance Recharge Income", type: "Revenue", classification: "Service Revenue", taxCode: "HST13", balance: 52800 },
          { code: "4320", name: "Administrative Recoveries", type: "Revenue", classification: "Service Revenue", taxCode: "HST13", balance: 33600 },
        ],
      },
      {
        code: "4400",
        name: "Late Payment Fees",
        type: "Revenue",
        classification: "Service Revenue",
        taxCode: "HST13",
        description: "NSF and late-rent fees charged per the tenancy agreement.",
        balance: 41280,
        openItems: 2,
      },
      {
        code: "4500",
        name: "Tenant Utility Billings",
        type: "Revenue",
        classification: "Operating Revenue",
        taxCode: "ZERO",
        description: "Pass-through utility recoveries billed to tenants under ratio or sub-meter agreements.",
        balance: 128940,
      },
    ],
  },
  {
    code: "5000",
    name: "Direct Property and Operating Expenses",
    type: "Operating Cost",
    role: "Group",
    classification: "Site Operations",
    description: "Costs incurred directly at managed properties. Tagged by property in the sub-ledger.",
    children: [
      {
        code: "5100",
        name: "Property Maintenance",
        type: "Operating Cost",
        role: "Group",
        classification: "Property Maintenance",
        balance: 384200,
        children: [
          { code: "5110", name: "Repairs and Maintenance — General", type: "Operating Cost", classification: "Property Maintenance", taxCode: "ITC", balance: 186400, openItems: 8, ytd: 186400 },
          { code: "5120", name: "Landscaping and Snow Removal", type: "Operating Cost", classification: "Property Maintenance", taxCode: "ITC", balance: 78200 },
          { code: "5130", name: "Janitorial and Cleaning", type: "Operating Cost", classification: "Property Maintenance", taxCode: "ITC", balance: 92400 },
          { code: "5140", name: "Pest Control", type: "Operating Cost", classification: "Property Maintenance", taxCode: "ITC", balance: 27200 },
        ],
      },
      {
        code: "5200",
        name: "Utilities",
        type: "Operating Cost",
        role: "Group",
        classification: "Utilities",
        balance: 268400,
        children: [
          { code: "5210", name: "Electricity", type: "Operating Cost", classification: "Utilities", taxCode: "HST13", balance: 142800 },
          { code: "5220", name: "Natural Gas", type: "Operating Cost", classification: "Utilities", taxCode: "GST5", balance: 88600 },
          { code: "5230", name: "Water and Sewer", type: "Operating Cost", classification: "Utilities", taxCode: "N/A", balance: 37000 },
        ],
      },
      { code: "5300", name: "Property Insurance", type: "Operating Cost", classification: "Insurance", taxCode: "EXEMPT", description: "Building and liability premiums for managed properties.", balance: 96400 },
      { code: "5400", name: "Property Taxes", type: "Operating Cost", classification: "Property Taxes", taxCode: "N/A", description: "Municipal property tax levies, net of any vacancy or small-business rebates.", balance: 184200 },
      {
        code: "5500",
        name: "Property Management Operating Costs",
        type: "Operating Cost",
        role: "Group",
        classification: "Site Operations",
        balance: 214600,
        children: [
          { code: "5510", name: "Resident Manager Salaries", type: "Operating Cost", classification: "Site Operations", description: "On-site staff directly assigned to managed properties.", balance: 148200 },
          { code: "5520", name: "Property Office Supplies", type: "Operating Cost", classification: "Site Operations", taxCode: "ITC", balance: 22400 },
          { code: "5530", name: "Tenant Relations and Events", type: "Operating Cost", classification: "Site Operations", balance: 44000 },
        ],
      },
    ],
  },
  {
    code: "6000",
    name: "Administrative and Other Expenses",
    type: "Administrative Expense",
    role: "Group",
    classification: "Office",
    description: "Overhead of running the management business itself, not attributable to a single property.",
    children: [
      {
        code: "6100",
        name: "Salaries and Wages",
        type: "Administrative Expense",
        role: "Group",
        classification: "Payroll",
        balance: 486200,
        children: [
          { code: "6110", name: "Salaries", type: "Administrative Expense", classification: "Payroll", balance: 342000, openItems: 2 },
          { code: "6120", name: "Wages and Contract Labour", type: "Administrative Expense", classification: "Payroll", balance: 68400 },
          { code: "6130", name: "Employee Benefits", type: "Administrative Expense", classification: "Payroll", balance: 41800 },
          { code: "6140", name: "Employer Payroll Taxes", type: "Administrative Expense", classification: "Payroll", description: "Employer share of CPP and EI premiums.", balance: 34000 },
        ],
      },
      { code: "6200", name: "Office Expenses", type: "Administrative Expense", classification: "Office", taxCode: "ITC", balance: 28400 },
      {
        code: "6300",
        name: "Professional Fees",
        type: "Administrative Expense",
        role: "Group",
        classification: "Professional",
        balance: 74200,
        children: [
          { code: "6310", name: "Legal Fees", type: "Administrative Expense", classification: "Professional", taxCode: "ITC", balance: 32800 },
          { code: "6320", name: "Accounting and Audit Fees", type: "Administrative Expense", classification: "Professional", taxCode: "HST13", balance: 41400 },
        ],
      },
      { code: "6400", name: "Software and Subscriptions", type: "Administrative Expense", classification: "Technology", taxCode: "HST13", description: "Property-management platform, accounting stack and productivity licences.", balance: 38600, openItems: 1 },
      { code: "6500", name: "Travel and Vehicle", type: "Administrative Expense", classification: "Office", taxCode: "ITC", balance: 21400 },
      { code: "6600", name: "Bank Charges and Merchant Fees", type: "Administrative Expense", classification: "Financial", taxCode: "GST5", balance: 16800 },
      { code: "6700", name: "Marketing and Leasing Signage", type: "Administrative Expense", classification: "Office", taxCode: "HST13", balance: 29400 },
    ],
  },
  {
    code: "7000",
    name: "Other Income",
    type: "Other Income",
    role: "Group",
    classification: "Non-Operating Income",
    children: [
      { code: "7100", name: "Interest Income — Operating", type: "Other Income", classification: "Interest Income", balance: 6420 },
      { code: "7200", name: "Interest Income — Trust Account", type: "Other Income", classification: "Interest Income", description: "Interest earned on trust balances; credited to owners per management agreement.", balance: 18240 },
      { code: "7300", name: "Gain on Disposal of Equipment", type: "Other Income", classification: "Gain on Disposal", balance: 4800 },
      { code: "7400", name: "Sundry Income", type: "Other Income", classification: "Non-Operating Income", taxCode: "HST13", balance: 2180 },
    ],
  },
  {
    code: "8000",
    name: "Other Expenses",
    type: "Other Expense",
    role: "Group",
    classification: "Non-Operating Expense",
    children: [
      { code: "8100", name: "Mortgage Interest Expense", type: "Other Expense", classification: "Interest Expense", description: "Interest component of mortgage payments on owned premises.", balance: 128400 },
      { code: "8200", name: "Depreciation Expense", type: "Other Expense", classification: "Depreciation", description: "Periodic depreciation of property and equipment.", balance: 34200 },
      { code: "8300", name: "Loss on Disposal of Assets", type: "Other Expense", classification: "Loss on Disposal", balance: 2600 },
      { code: "8400", name: "Donations and Community Support", type: "Other Expense", classification: "Non-Operating Expense", balance: 5400 },
      { code: "8500", name: "Penalties and Interest", type: "Other Expense", classification: "Non-Operating Expense", description: "Non-deductible late-filing penalties and remittance interest.", balance: 1180 },
    ],
  },
];

const pad = (n: number) => String(n).padStart(3, "0");

export function buildSeedChart(): Account[] {
  const out: Account[] = [];
  let seq = 0;
  const base = new Date("2025-01-06T09:00:00-05:00").getTime();

  const walk = (nodes: SeedNode[], parentId: string | null, depth: number) => {
    nodes.forEach((node, i) => {
      seq += 1;
      const id = `acct_${pad(seq)}`;
      const created = new Date(base + seq * 3_600_000).toISOString();
      out.push({
        id,
        code: node.code,
        name: node.name,
        parentId,
        type: node.type,
        classification: node.classification ?? null,
        normalBalance: defaultNormalBalance(node.type),
        role: node.role ?? (node.children && node.children.length ? "Group" : "Posting"),
        allowDirectPosting: !(node.role === "Group" || node.children?.length),
        status: node.status ?? "Active",
        description: node.description ?? "",
        taxCode: node.taxCode ?? null,
        openingBalance: node.balance ?? null,
        sortOrder: (i + 1) * 10,
        createdAt: created,
        updatedAt: created,
        openItems: node.openItems ?? 0,
        ytdAmount: node.ytd ?? node.balance ?? 0,
      });
      if (node.children?.length) walk(node.children, id, depth + 1);
    });
  };

  walk(SEED, null, 0);
  return out;
}


