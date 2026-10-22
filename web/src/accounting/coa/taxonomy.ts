import type { NormalBalance } from "./types";

export const ACCOUNT_TYPES = [
  "Asset",
  "Liability",
  "Equity",
  "Revenue",
  "Operating Cost",
  "Administrative Expense",
  "Other Income",
  "Other Expense",
] as const;

export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const MAX_DEPTH = 8;
export const TOP_LEVEL_LABEL = "Top-Level Account";

export interface TypeMeta {
  label: string;
  short: string;
  range: [number, number];
  rangeLabel: string;
  normalBalance: NormalBalance;
  /** Statement the type rolls up into — used for grouping in the summary rail. */
  statement: "Balance Sheet" | "Income Statement";
  chip: string;
  dot: string;
}

export const TYPE_META: Record<AccountType, TypeMeta> = {
  Asset: {
    label: "Asset",
    short: "AS",
    range: [1000, 1999],
    rangeLabel: "1000–1999",
    normalBalance: "Debit",
    statement: "Balance Sheet",
    chip: "bg-u-blue/12 text-u-blue border-u-blue/30",
    dot: "bg-u-blue",
  },
  Liability: {
    label: "Liability",
    short: "LI",
    range: [2000, 2999],
    rangeLabel: "2000–2999",
    normalBalance: "Credit",
    statement: "Balance Sheet",
    chip: "bg-u-warn/12 text-u-warn border-u-warn/30",
    dot: "bg-u-warn",
  },
  Equity: {
    label: "Equity",
    short: "EQ",
    range: [3000, 3999],
    rangeLabel: "3000–3999",
    normalBalance: "Credit",
    statement: "Balance Sheet",
    chip: "bg-u-violet/12 text-u-violet border-u-violet/30",
    dot: "bg-u-violet",
  },
  Revenue: {
    label: "Revenue",
    short: "RV",
    range: [4000, 4999],
    rangeLabel: "4000–4999",
    normalBalance: "Credit",
    statement: "Income Statement",
    chip: "bg-u-ok/12 text-u-ok border-u-ok/30",
    dot: "bg-u-ok",
  },
  "Operating Cost": {
    label: "Operating Cost",
    short: "OC",
    range: [5000, 5999],
    rangeLabel: "5000–5999",
    normalBalance: "Debit",
    statement: "Income Statement",
    chip: "bg-u-danger/12 text-u-danger border-u-danger/30",
    dot: "bg-u-danger",
  },
  "Administrative Expense": {
    label: "Administrative",
    short: "AD",
    range: [6000, 6999],
    rangeLabel: "6000–6999",
    normalBalance: "Debit",
    statement: "Income Statement",
    chip: "bg-u-muted/12 text-u-muted border-u-muted/30",
    dot: "bg-u-muted",
  },
  "Other Income": {
    label: "Other Income",
    short: "OI",
    range: [7000, 7999],
    rangeLabel: "7000–7999",
    normalBalance: "Credit",
    statement: "Income Statement",
    chip: "bg-u-accent/12 text-u-accent border-u-accent/30",
    dot: "bg-u-accent",
  },
  "Other Expense": {
    label: "Other Expense",
    short: "OE",
    range: [8000, 8999],
    rangeLabel: "8000–8999",
    normalBalance: "Debit",
    statement: "Income Statement",
    chip: "bg-u-ink2/12 text-u-ink2 border-u-ink2/30",
    dot: "bg-u-ink2",
  },
};

/** Classification is a free-ish sub-label whose allowed values depend on type. */
export const CLASSIFICATIONS: Record<AccountType, string[]> = {
  Asset: ["Current Asset", "Non-Current Asset", "Contra Asset", "Intangible Asset", "Trust Asset"],
  Liability: [
    "Current Liability",
    "Long-Term Liability",
    "Contra Liability",
    "Trust Liability",
    "Statutory Liability",
  ],
  Equity: ["Contributed Capital", "Retained Earnings", "Drawings", "Contra Equity"],
  Revenue: ["Operating Revenue", "Service Revenue", "Fee Revenue", "Contra Revenue"],
  "Operating Cost": [
    "Property Maintenance",
    "Utilities",
    "Insurance",
    "Property Taxes",
    "Site Operations",
  ],
  "Administrative Expense": ["Payroll", "Office", "Professional", "Technology", "Occupancy", "Financial"],
  "Other Income": ["Non-Operating Income", "Gain on Disposal", "Interest Income"],
  "Other Expense": ["Non-Operating Expense", "Interest Expense", "Depreciation", "Loss on Disposal"],
};

export const TAX_CODES = [
  { code: "HST13", label: "HST 13% — Ontario" },
  { code: "GST5", label: "GST 5% — Federal" },
  { code: "HST15", label: "HST 15% — Atlantic" },
  { code: "ITC", label: "Input Tax Credits — GST/HST" },
  { code: "EXEMPT", label: "GST/HST Exempt" },
  { code: "ZERO", label: "Zero-rated" },
  { code: "N/A", label: "Not applicable" },
] as const;

export const ROLE_META = {
  Group: {
    label: "Group",
    hint: "Structural container — rolls up children, cannot be posted to.",
    chip: "bg-u-blue/12 text-u-blue border-u-blue/30",
  },
  Posting: {
    label: "Posting",
    hint: "Leaf ledger account — accepts journal entries.",
    chip: "bg-u-accent-soft text-u-accent border-u-accent/30",
  },
} as const;

export const defaultNormalBalance = (type: AccountType): NormalBalance => TYPE_META[type].normalBalance;

export const defaultClassification = (type: AccountType): string | null =>
  CLASSIFICATIONS[type][0] ?? null;

export const typeOfCode = (code: string): AccountType | null => {
  const n = Number.parseInt(code, 10);
  if (Number.isNaN(n)) return null;
  return ACCOUNT_TYPES.find((t) => n >= TYPE_META[t].range[0] && n <= TYPE_META[t].range[1]) ?? null;
};

export const money = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return "—";
  const sign = value < 0 ? "−" : "";
  return `${sign}$${Math.abs(value).toLocaleString("en-CA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

export const compactMoney = (value: number): string => {
  const abs = Math.abs(value);
  const sign = value < 0 ? "−" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(abs >= 10_000 ? 0 : 1)}K`;
  return `${sign}$${abs.toFixed(0)}`;
};

export const formatDate = (iso: string): string =>
  new Date(iso).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "2-digit" });

export const formatDateTime = (iso: string): string =>
  new Date(iso).toLocaleString("en-CA", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
