import { BookTransaction, BankTransaction, Settings } from "./types";
import { jaccard, r2 } from "./format";

export interface Suggestion {
  bookIds: string[];
  bankIds: string[];
  confidence: number;
  explanation: string;
  type: "one_to_one" | "one_to_many" | "many_to_one";
}

// Type compatibility mapping: which book transaction types can correspond to a bank line
const TYPE_ALIGNMENT: Record<string, string[]> = {
  rent_payment: ["rent", "payment", "rental", "rent "],
  tenant_deposit: ["deposit", "trust"],
  deposit_refund: ["refund", "return"],
  maintenance_expense: ["maintenance", "repair", "service"],
  vendor_payment: ["payment", "invoice", "utilities", "vendor"],
  management_fee: ["management", "fee"],
  bank_fee: ["fee", "charge", "service charge"],
  interest_income: ["interest"],
  transfer_out: ["transfer", "wire", "ach"],
  transfer_in: ["transfer", "wire", "ach"],
  returned_payment: ["return", "reversal", "returned"],
};

function typesAlign(bankDesc: string, bookType: string): boolean {
  const haystack = bankDesc.toLowerCase();
  const needles = TYPE_ALIGNMENT[bookType];
  if (!needles) return false;
  return needles.some((n) => haystack.includes(n));
}

function directionOf(btx: BankTransaction): "in" | "out" {
  return btx.signedAmount >= 0 ? "in" : "out";
}

function directionOfBook(btx: BookTransaction): "in" | "out" {
  return btx.signedAmount >= 0 ? "in" : "out";
}

interface ScoreParts {
  score: number;
  notes: string[];
}

function scorePair(bank: BankTransaction, book: BookTransaction, tolerance: number): ScoreParts {
  if (directionOf(bank) !== directionOfBook(book)) {
    return { score: 0, notes: [] };
  }
  const notes: string[] = [];
  let score = 40; // exact amount + direction required
  notes.push(`Exact amount (${bank.signedAmount >= 0 ? "+" : ""}${r2(bank.signedAmount).toFixed(2)})`);

  // reference match
  const refB = bank.reference.trim().toLowerCase();
  const refK = book.reference.trim().toLowerCase();
  if (refB && refK) {
    if (refB === refK) {
      score += 22;
      notes.push(`Reference ${book.reference} matches exactly`);
    } else if (refB.includes(refK) || refK.includes(refB)) {
      score += 12;
      notes.push(`References partially agree (${book.reference} / ${bank.reference})`);
    }
  }

  // date proximity
  const diffDays = Math.abs(
    Math.round((new Date(book.date + "T00:00:00").getTime() - new Date(bank.date + "T00:00:00").getTime()) / 86400000),
  );
  if (diffDays === 0) {
    score += 15;
    notes.push("Same transaction date");
  } else if (diffDays === 1) {
    score += 11;
    notes.push(`Dates are 1 day apart (book ${book.date}, bank ${bank.date})`);
  } else if (diffDays <= tolerance) {
    score += 8;
    notes.push(`Dates ${diffDays} days apart (within ${tolerance}-day tolerance)`);
  } else {
    notes.push(`Dates ${diffDays} days apart (exceeds tolerance)`);
  }

  // description similarity
  const sim = jaccard(bank.description, book.description);
  if (sim > 0) {
    const dScore = Math.round(sim * 15);
    score += dScore;
    notes.push(`Descriptions ${Math.round(sim * 100)}% similar`);
  }

  // type alignment
  if (typesAlign(bank.description, book.type)) {
    score += 8;
    notes.push(`Type consistent (${book.type.replace(/_/g, " ")})`);
  }

  return { score: Math.min(100, score), notes };
}

export function confidenceLevel(score: number, s: Settings): "High" | "Medium" | "Low" {
  if (score >= s.confidenceHigh) return "High";
  if (score >= s.confidenceMedium) return "Medium";
  if (score >= s.confidenceLow) return "Low";
  return "Low";
}

export interface MatchContext {
  bankTxs: BankTransaction[]; // candidates for this reconciliation period
  bookTxs: BookTransaction[]; // candidates for this reconciliation period
  settings: Settings;
  usedBankIds: Set<string>;
  usedBookIds: Set<string>;
}

/**
 * Find the best match suggestion for a single bank transaction.
 * Considers one-to-one, one-to-many (bank deposit covering several book payments),
 * and (via pairGroups) many-to-one cases.
 */
export function suggestForBankTx(bank: BankTransaction, ctx: MatchContext): Suggestion | null {
  const { settings, usedBookIds, usedBankIds } = ctx;
  const tolerance = settings.dateToleranceDays;
  const dir = directionOf(bank);
  const candidates = ctx.bookTxs.filter(
    (b) => !usedBookIds.has(b.id) && directionOfBook(b) === dir && Math.abs(b.signedAmount - bank.signedAmount) < 0.005,
  );

  // --- One-to-one ---
  let best: { s: Suggestion; score: number } | null = null;
  for (const book of candidates) {
    const { score, notes } = scorePair(bank, book, tolerance);
    if (score >= settings.confidenceLow && (!best || score > best.score)) {
      best = {
        s: {
          bookIds: [book.id],
          bankIds: [bank.id],
          confidence: score,
          explanation: notes.join("; "),
          type: "one_to_one",
        },
        score,
      };
    }
  }

  // --- One-to-many: this bank tx equals the sum of 2 same-direction book txs ---
  if (candidates.length >= 2) {
    outer: for (let i = 0; i < candidates.length; i++) {
      for (let j = i + 1; j < candidates.length; j++) {
        const sum = r2(candidates[i].signedAmount + candidates[j].signedAmount);
        if (Math.abs(sum - bank.signedAmount) < 0.005) {
          const [b1, b2] = [candidates[i], candidates[j]];
          const score = Math.min(
            95,
            30 +
              Math.round(jaccard(bank.description, b1.description) * 25) +
              Math.round(jaccard(bank.description, b2.description) * 25) +
              (Math.abs(daysApart(bank.date, b1.date)) <= tolerance ? 15 : 0) +
              (Math.abs(daysApart(bank.date, b2.date)) <= tolerance ? 10 : 0) +
              (dir === "in" ? 5 : 5),
          );
          if (score >= settings.confidenceLow && (!best || score > best.score)) {
            best = {
              s: {
                bookIds: [b1.id, b2.id],
                bankIds: [bank.id],
                confidence: score,
                explanation:
                  `Bank ${bank.signedAmount >= 0 ? "deposit" : "payment"} equals the combined total of two book transactions ` +
                  `(${b1.description} ${b1.signedAmount.toFixed(2)} + ${b2.description} ${b2.signedAmount.toFixed(2)}).`,
                type: "one_to_many",
              },
              score,
            };
            break outer;
          }
        }
      }
    }
  }

  return best?.s ?? null;
}

function daysApart(a: string, b: string): number {
  return Math.round((new Date(a + "T00:00:00").getTime() - new Date(b + "T00:00:00").getTime()) / 86400000);
}

/** Many-to-one: a single book transaction that equals the combined total of two bank transactions */
export function suggestForBookTxManyToOne(book: BookTransaction, ctx: MatchContext): Suggestion | null {
  const { usedBankIds } = ctx;
  const dir = directionOfBook(book);
  const candidates = ctx.bankTxs.filter(
    (b) => !usedBankIds.has(b.id) && directionOf(b) === dir && b.id !== undefined,
  );
  for (let i = 0; i < candidates.length; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      const sum = r2(candidates[i].signedAmount + candidates[j].signedAmount);
      if (Math.abs(sum - book.signedAmount) < 0.005) {
        const score = 55;
        return {
          bookIds: [book.id],
          bankIds: [candidates[i].id, candidates[j].id],
          confidence: score,
          explanation: `Single book transaction ${book.description} (${book.signedAmount.toFixed(2)}) equals two bank entries combined.`,
          type: "many_to_one",
        };
      }
    }
  }
  return null;
}

/** Validate that grouped amounts reconcile exactly before confirming a match */
export function validateGroup(bankIds: string[], bookIds: string[], bankTxs: BankTransaction[], bookTxs: BookTransaction[]): string | null {
  const bankSum = r2(bankIds.reduce((acc, id) => acc + (bankTxs.find((b) => b.id === id)?.signedAmount ?? 0), 0));
  const bookSum = r2(bookIds.reduce((acc, id) => acc + (bookTxs.find((b) => b.id === id)?.signedAmount ?? 0), 0));
  if (Math.abs(bankSum - bookSum) > 0.005) {
    return `Grouped amounts do not reconcile: bank side ${bankSum.toFixed(2)} vs book side ${bookSum.toFixed(2)} (difference ${(bankSum - bookSum).toFixed(2)}). Record the difference as a missing transaction or adjustment first.`;
  }
  return null;
}

export function buildAutoSuggestions(ctx: MatchContext): Map<string, Suggestion> {
  const out = new Map<string, Suggestion>();
  if (!ctx.settings.autoMatching) return out;
  for (const bank of ctx.bankTxs) {
    if (ctx.usedBankIds.has(bank.id)) continue;
    const sug = suggestForBankTx(bank, ctx);
    if (sug) out.set(bank.id, sug);
  }
  return out;
}
