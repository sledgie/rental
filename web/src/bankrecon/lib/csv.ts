import { fingerprint, normalizeDesc, r2 } from "./format";
import { BankAccount, ColumnMapping, Settings } from "./types";

export interface CsvParseResult {
  header: string[];
  rows: string[][];
  delimiter: string;
}

export function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/).find((l) => l.trim().length > 0) ?? "";
  const counts: Record<string, number> = { ",": 0, ";": 0, "\t": 0, "|": 0 };
  for (const ch of firstLine) if (ch in counts) counts[ch]++;
  return (Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] as string) ?? ",";
}

// RFC-4180-ish CSV parser (handles quotes, escaped quotes, CRLF)
export function parseCSV(text: string, delimiter?: string): CsvParseResult {
  const delim = delimiter ?? detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === delim) {
      row.push(field);
      field = "";
      i++;
      continue;
    }
    if (ch === "\r") {
      i++;
      continue;
    }
    if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i++;
      continue;
    }
    field += ch;
    i++;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  const nonEmpty = rows.filter((r) => r.some((c) => c.trim().length > 0));
  const header = (nonEmpty[0] ?? []).map((h) => h.trim());
  return { header, rows: nonEmpty.slice(1), delimiter: delim };
}

export interface FieldAliases {
  transactionDate: string[];
  postedDate: string[];
  description: string[];
  reference: string[];
  debit: string[];
  credit: string[];
  signedAmount: string[];
  runningBalance: string[];
}

export const FIELD_ALIASES: FieldAliases = {
  transactionDate: ["transactiondate", "date", "txndate", "transaction date", "value date", "posting date"],
  postedDate: ["posteddate", "post date", "posted", "valuedate", "effective date"],
  description: ["description", "memo", "details", "narration", "name", "payee"],
  reference: ["reference", "referencenumber", "ref", "checkno", "check number", "transaction id", "doc id"],
  debit: ["debit", "withdrawal", "withdrawals", "paid out", "debits", "money out", "out"],
  credit: ["credit", "deposit", "deposits", "paid in", "credits", "money in", "in"],
  signedAmount: ["amount", "signed amount", "net amount", "value", "total"],
  runningBalance: ["runningbalance", "balance", "running bal", "current balance"],
};

// Suggest a column mapping from header names
export function suggestMapping(header: string[]): ColumnMapping {
  const mapping: ColumnMapping = {
    transactionDate: null,
    postedDate: null,
    description: null,
    reference: null,
    debit: null,
    credit: null,
    signedAmount: null,
    runningBalance: null,
  };
  header.forEach((h, idx) => {
    const low = h.trim().toLowerCase();
    for (const [field, aliases] of Object.entries(FIELD_ALIASES) as [keyof FieldAliases, string[]][]) {
      if (mapping[field] !== null) continue;
      if (aliases.some((a) => low === a || low.includes(a))) {
        (mapping as unknown as Record<string, number | null>)[field] = idx;
        break;
      }
    }
  });
  return mapping;
}

export interface ParsedBankRow {
  rowNumber: number;
  date: string;
  postedDate: string | null;
  description: string;
  reference: string;
  debit: number;
  credit: number;
  signedAmount: number;
  runningBalance: number | null;
}

export interface RowValidationResult {
  rowNumber: number;
  values: string[];
  parsed: ParsedBankRow | null;
  status: "accepted" | "rejected" | "duplicate";
  reason: string;
}

export interface ValidateInput {
  rows: string[][];
  mapping: ColumnMapping;
  account: BankAccount;
  periodStart: string;
  periodEnd: string;
  settings: Settings;
  hasHeader: boolean;
  positiveIsDeposit: boolean;
  existingFingerprints: string[];
  startRowOffset: number; // 1-based row number of the first data row in the file
}

export function validateBankRows(input: ValidateInput): RowValidationResult[] {
  const { rows, mapping, account, periodStart, periodEnd, settings, hasHeader, positiveIsDeposit } = input;
  const results: RowValidationResult[] = [];
  const seen = new Set<string>();
  const runningBalanceStart = account.openingBalance;

  rows.forEach((raw) => {
    const rowNumber = raw.length > 0 ? Number(raw[0]) || 0 : 0;
    const get = (idx: number | null): string => (idx !== null && idx < raw.length ? raw[idx] ?? "" : "");
    const val = (idx: number | null): number => {
      const s = get(idx).replace(/[$,\s]/g, "").replace(/^\(/, "-").replace(/\)$/, "");
      const n = Number(s);
      return Number.isFinite(n) ? n : NaN;
    };

    const dateStr = get(mapping.transactionDate).trim();
    const postedStr = get(mapping.postedDate).trim();
    const description = get(mapping.description).trim();
    const reference = get(mapping.reference).trim();
    const debit = mapping.debit !== null ? val(mapping.debit) : 0;
    const credit = mapping.credit !== null ? val(mapping.credit) : 0;
    const signed = mapping.signedAmount !== null ? val(mapping.signedAmount) : NaN;
    const running = mapping.runningBalance !== null ? val(mapping.runningBalance) : NaN;

    const fail = (reason: string, status: RowValidationResult["status"] = "rejected"): void => {
      results.push({ rowNumber: input.startRowOffset + results.length, values: raw, parsed: null, status, reason });
    };

    if (!dateStr) return fail("Missing transaction date");
    const date = new Date(dateStr + "T00:00:00");
    if (Number.isNaN(date.getTime())) return fail("Invalid date format");
    if (date < parseIso(periodStart) || date > parseIso(periodEnd)) return fail("Date outside selected statement period");
    if (!description) return fail("Empty description (required)");

    let debitVal = debit;
    let creditVal = credit;
    if (Number.isNaN(signed) && Number.isNaN(debit) && Number.isNaN(credit)) return fail("Missing amount");

    if (!Number.isNaN(signed)) {
      // single signed amount column
      if (positiveIsDeposit) {
        creditVal = signed;
        debitVal = 0;
      } else {
        debitVal = signed;
        creditVal = 0;
      }
      if (signed === 0) return fail("Zero amount");
    }
    if (Number.isNaN(debitVal)) debitVal = 0;
    if (Number.isNaN(creditVal)) creditVal = 0;
    if (debitVal < 0 || creditVal < 0) return fail("Negative amount in debit/credit column");
    if (debitVal > 0 && creditVal > 0) return fail("Both debit and credit populated (ambiguous)");

    const txDate = date.toISOString().slice(0, 10);
    const postedDate = postedStr && !Number.isNaN(new Date(postedStr).getTime()) ? postedStr : null;
    const signedAmount = r2(creditVal - debitVal);
    const fp = fingerprint(account.id, txDate, signedAmount, reference, description);

    const dupInFile = seen.has(fp);
    seen.add(fp);
    const dupExisting = input.existingFingerprints.includes(fp);
    if (dupInFile) return fail("Duplicate row within this file", "duplicate");
    if (dupExisting) return fail("Potential duplicate of a previously imported transaction", "duplicate");

    let runningBalance: number | null = null;
    if (!Number.isNaN(running)) {
      runningBalance = running;
    }

    const parsed: ParsedBankRow = {
      rowNumber: 0,
      date: txDate,
      postedDate,
      description,
      reference: reference || `ROW-${input.startRowOffset + results.length}`,
      debit: r2(debitVal),
      credit: r2(creditVal),
      signedAmount,
      runningBalance,
    };

    // currency check
    if (account.currency === "USD" && creditVal > 1000000000) return fail("Unsupported currency magnitude");

    results.push({ rowNumber: input.startRowOffset + results.length, values: raw, parsed, status: "accepted", reason: "" });
  });

  // Running balance consistency check (sequential, file order)
  let expected = runningBalanceStart;
  for (const res of results) {
    if (res.parsed) {
      const shown = res.parsed.runningBalance;
      if (shown !== null && Math.abs(shown - r2(expected)) > 0.01) {
        res.status = "rejected";
        res.parsed = null;
        res.reason = `Inconsistent running balance: expected ${expected.toFixed(2)}, file shows ${shown.toFixed(2)}`;
      }
    }
    if (res.parsed) expected = r2(expected + res.parsed.signedAmount);
  }

  return results;
}

function parseIso(s: string): Date {
  return new Date(s + "T00:00:00");
}

// Sample statement generator so users can try the import workflow
export function buildSampleCSV(account: BankAccount, rows: { date: string; description: string; reference: string; debit: number; credit: number }[]): string {
  const header = ["Transaction Date", "Description", "Reference Number", "Debit", "Credit"];
  const body = rows.map((r) => [r.date, `"${r.description}"`, r.reference, r.debit > 0 ? r.debit.toFixed(2) : "", r.credit > 0 ? r.credit.toFixed(2) : ""]);
  return [header.join(","), ...body.map((r) => r.join(","))].join("\n");
}

export function normalizeDescForMatch(s: string): string {
  return normalizeDesc(s);
}
