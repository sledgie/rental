import { db } from "../../db";
import * as schema from "../../db/schema";
import { eq } from "../../db/ops";

export type JournalLineInput = {
  accountCode: string;
  debitCents?: number;
  creditCents?: number;
  memo?: string;
};

export function collectionLines(cashAccount: string, liabilityAccount: string, amountCents: number): JournalLineInput[] {
  return [
    { accountCode: cashAccount, debitCents: amountCents, memo: "Deposit funds received" },
    { accountCode: liabilityAccount, creditCents: amountCents, memo: "Tenant deposit liability recognised" },
  ];
}

export function applicationLines(liabilityAccount: string, receivableAccount: string, amountCents: number): JournalLineInput[] {
  return [
    { accountCode: liabilityAccount, debitCents: amountCents, memo: "Deposit applied — liability relief" },
    { accountCode: receivableAccount, creditCents: amountCents, memo: "Applied against receivable (no duplicate income)" },
  ];
}

export function refundLines(liabilityAccount: string, cashAccount: string, amountCents: number): JournalLineInput[] {
  return [
    { accountCode: liabilityAccount, debitCents: amountCents, memo: "Deposit liability released" },
    { accountCode: cashAccount, creditCents: amountCents, memo: "Refund paid (simulated)" },
  ];
}

export function interestAccrualLines(interestPayableAccount: string, amountCents: number): JournalLineInput[] {
  return [
    { accountCode: "6100", debitCents: amountCents, memo: "Tenant deposit interest expense" },
    { accountCode: interestPayableAccount, creditCents: amountCents, memo: "Deposit interest payable" },
  ];
}

export function interestPaymentLines(interestPayableAccount: string, cashAccount: string, amountCents: number): JournalLineInput[] {
  return [
    { accountCode: interestPayableAccount, debitCents: amountCents, memo: "Interest obligation settled" },
    { accountCode: cashAccount, creditCents: amountCents, memo: "Interest paid (simulated)" },
  ];
}

export function interestCreditLines(interestPayableAccount: string, receivableAccount: string, amountCents: number): JournalLineInput[] {
  return [
    { accountCode: interestPayableAccount, debitCents: amountCents, memo: "Interest credited to tenant obligation" },
    { accountCode: receivableAccount, creditCents: amountCents, memo: "Interest credit against rent receivable" },
  ];
}

export function nextSequentialReference(prefix: string, existing: string[]): string {
  const year = new Date().getFullYear();
  const pattern = new RegExp(`^${prefix}-${year}-(\\d+)$`);
  let max = 0;
  for (const ref of existing) {
    const match = ref.match(pattern);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `${prefix}-${year}-${String(max + 1).padStart(4, "0")}`;
}

export function newId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

export type PostJournalInput = {
  sourceType: string;
  sourceId: string;
  entryDate: string;
  description: string;
  lines: JournalLineInput[];
  userId: string;
  depositId: string;
};

/** Posts a balanced journal entry exactly once per source transaction. */
export async function postJournal(input: PostJournalInput): Promise<string> {
  const debit = input.lines.reduce((acc, l) => acc + (l.debitCents ?? 0), 0);
  const credit = input.lines.reduce((acc, l) => acc + (l.creditCents ?? 0), 0);
  if (debit !== credit) throw new Error("Journal entry is not balanced — posting blocked.");
  if (debit <= 0) throw new Error("Journal entry must have a non-zero amount.");
  const codes = input.lines.map((l) => l.accountCode);
  const accounts = await db.select().from(schema.chartOfAccounts);
  for (const code of codes) {
    const account = accounts.find((a) => a.code === code);
    if (!account) throw new Error(`Account ${code} does not exist in the chart of accounts.`);
    if (!account.isActive) throw new Error(`Account ${code} is inactive — a valid mapping is required.`);
  }

  const existing = await db
    .select()
    .from(schema.journalEntries)
    .where(eq(schema.journalEntries.sourceId, input.sourceId));
  const duplicate = existing.find((e) => e.sourceType === input.sourceType);
  if (duplicate) return duplicate.id;

  const allEntries = await db.select({ reference: schema.journalEntries.reference }).from(schema.journalEntries);
  const reference = nextSequentialReference("JE", allEntries.map((e) => e.reference));
  const entryId = newId("je");
  await db.insert(schema.journalEntries).values({
    id: entryId,
    reference,
    entryDate: input.entryDate,
    description: input.description,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    status: "posted",
    simulated: true,
    createdBy: input.userId,
  });
  await db.insert(schema.journalLines).values(
    input.lines.map((l, i) => ({
      id: `${entryId}-${i + 1}`,
      entryId,
      accountCode: l.accountCode,
      debitCents: l.debitCents ?? 0,
      creditCents: l.creditCents ?? 0,
      memo: l.memo ?? null,
      depositId: input.depositId,
    })),
  );
  return entryId;
}

export async function postReversingJournal(args: {
  originalEntryId: string | null;
  sourceType: string;
  sourceId: string;
  entryDate: string;
  description: string;
  userId: string;
  depositId: string;
}): Promise<string | null> {
  if (!args.originalEntryId) return null;
  const lines = await db.select().from(schema.journalLines).where(eq(schema.journalLines.entryId, args.originalEntryId));
  if (lines.length === 0) return null;
  return postJournal({
    sourceType: args.sourceType,
    sourceId: args.sourceId,
    entryDate: args.entryDate,
    description: args.description,
    lines: lines.map((l) => ({
      accountCode: l.accountCode,
      debitCents: l.creditCents,
      creditCents: l.debitCents,
      memo: `Reversal — ${l.memo ?? ""}`.trim(),
    })),
    userId: args.userId,
    depositId: args.depositId,
  });
}
