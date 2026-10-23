import React, { createContext, useContext, useEffect, useMemo, useReducer, useCallback } from "react";
import { StoreState, Reconciliation, BankAccount, BookTransaction, BankTransaction, Match, Adjustment, ImportBatch, ImportMapping, AuditEntry, Settings, ReconStatus, ColumnMapping } from "./types";
import { buildSeed } from "./seed";
import { computeRecon } from "./calc";
import { r2, uid, fingerprint as makeFingerprint } from "./format";

const STORAGE_KEY = "rms-bank-recon-state-v3";

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

type Action =
  | { type: "HYDRATE"; state: StoreState }
  | { type: "SET_USER"; userId: string }
  | { type: "SET_STATE"; patch: Partial<StoreState> }
  | { type: "ADD_AUDIT"; entry: Omit<AuditEntry, "id" | "eventId"> }
  | { type: "RECON_CREATE"; recon: Reconciliation }
  | { type: "RECON_UPDATE"; id: string; patch: Partial<Reconciliation> }
  | { type: "RECON_STATUS"; id: string; status: ReconStatus }
  | { type: "ADD_BANK_TXS"; txs: BankTransaction[] }
  | { type: "DELETE_BANK_TX"; id: string }
  | { type: "UPDATE_BANK_TX"; id: string; patch: Partial<BankTransaction> }
  | { type: "ADD_BOOK_TX"; tx: BookTransaction }
  | { type: "UPDATE_BOOK_TX"; id: string; patch: Partial<BookTransaction> }
  | { type: "ADD_MATCH"; match: Match }
  | { type: "UNMATCH"; matchId: string; by: string }
  | { type: "ADD_ADJUSTMENT"; adjustment: Adjustment }
  | { type: "DELETE_ADJUSTMENT"; id: string }
  | { type: "ADD_ACCOUNT"; account: BankAccount }
  | { type: "UPDATE_ACCOUNT"; id: string; patch: Partial<BankAccount> }
  | { type: "ADD_IMPORT_BATCH"; batch: ImportBatch }
  | { type: "SAVE_MAPPING"; mapping: ImportMapping }
  | { type: "DELETE_MAPPING"; id: string }
  | { type: "RESET" };

function refresh(state: StoreState): StoreState {
  // Recompute derived fields and statuses for all non-finalized reconciliations
  const reconciliations = state.reconciliations.map((r) => {
    if (r.status === "Reconciled" || r.status === "Cancelled") return r;
    const calc = computeRecon(state, r);
    return {
      ...r,
      status: calc.suggestedStatus,
    };
  });
  return { ...state, reconciliations };
}

function reducer(state: StoreState, action: Action): StoreState {
  switch (action.type) {
    case "HYDRATE":
      return action.state;
    case "RESET":
      return buildSeed();
    case "SET_USER":
      return { ...state, currentUserId: action.userId };
    case "SET_STATE":
      return { ...state, ...action.patch };
    case "ADD_AUDIT": {
      const seq = state.audit.length + 1000;
      const entry: AuditEntry = { ...action.entry, id: `A-${seq}`, eventId: `EV-${seq}` };
      return { ...state, audit: [entry, ...state.audit] };
    }
    case "RECON_CREATE":
      return refresh({ ...state, reconciliations: [action.recon, ...state.reconciliations] });
    case "RECON_UPDATE":
      return refresh({
        ...state,
        reconciliations: state.reconciliations.map((r) => (r.id === action.id ? { ...r, ...action.patch } : r)),
      });
    case "RECON_STATUS":
      return refresh({
        ...state,
        reconciliations: state.reconciliations.map((r) => (r.id === action.id ? { ...r, status: action.status } : r)),
      });
    case "ADD_BANK_TXS":
      return refresh({ ...state, bankTxs: [...state.bankTxs, ...action.txs] });
    case "DELETE_BANK_TX":
      return refresh({ ...state, bankTxs: state.bankTxs.filter((t) => t.id !== action.id) });
    case "UPDATE_BANK_TX":
      return refresh({
        ...state,
        bankTxs: state.bankTxs.map((t) => (t.id === action.id ? { ...t, ...action.patch } : t)),
      });
    case "ADD_BOOK_TX":
      return refresh({ ...state, bookTxs: [...state.bookTxs, action.tx] });
    case "UPDATE_BOOK_TX":
      return refresh({
        ...state,
        bookTxs: state.bookTxs.map((t) => (t.id === action.id ? { ...t, ...action.patch } : t)),
      });
    case "ADD_MATCH":
      return refresh({ ...state, matches: [...state.matches, action.match] });
    case "UNMATCH": {
      const matches = state.matches.map((m) =>
        m.id === action.matchId
          ? { ...m, active: false, history: [...m.history, { action: "Match undone", by: action.by, at: new Date().toISOString(), note: "Match manually undone; history preserved." }] }
          : m,
      );
      return refresh({ ...state, matches });
    }
    case "ADD_ADJUSTMENT":
      return refresh({ ...state, adjustments: [...state.adjustments, action.adjustment] });
    case "DELETE_ADJUSTMENT":
      return refresh({ ...state, adjustments: state.adjustments.filter((a) => a.id !== action.id) });
    case "ADD_ACCOUNT":
      return { ...state, accounts: [...state.accounts, action.account] };
    case "UPDATE_ACCOUNT":
      return {
        ...state,
        accounts: state.accounts.map((a) => (a.id === action.id ? { ...a, ...action.patch, updatedAt: new Date().toISOString() } : a)),
      };
    case "ADD_IMPORT_BATCH":
      return { ...state, importBatches: [action.batch, ...state.importBatches] };
    case "SAVE_MAPPING":
      return { ...state, importMappings: [action.mapping, ...state.importMappings] };
    case "DELETE_MAPPING":
      return { ...state, importMappings: state.importMappings.filter((m) => m.id !== action.id) };
    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Context + actions
// ---------------------------------------------------------------------------

export interface StartReconInput {
  accountId: string;
  periodStart: string;
  periodEnd: string;
  statementOpeningBalance: number;
  statementEndingBalance: number;
  statementRef: string;
  fileName: string | null;
  notes: string;
}

export interface StartReconResult {
  ok: boolean;
  reconId?: string;
  warnings: string[];
  error?: string;
}

interface StoreContextValue {
  state: StoreState;
  user: StoreState["users"][number];
  can: (permission: string) => boolean;
  startReconciliation: (input: StartReconInput) => StartReconResult;
  cancelReconciliation: (id: string, reason: string) => { ok: boolean; error?: string };
  finalizeReconciliation: (id: string, confirmation: boolean) => { ok: boolean; error?: string };
  reopenReconciliation: (id: string, reason: string) => { ok: boolean; error?: string };
  updateReconciliation: (id: string, patch: Partial<Reconciliation>) => void;
  addBankTransactions: (rows: { date: string; postedDate: string | null; description: string; reference: string; debit: number; credit: number; runningBalance: number | null }[], accountId: string, batchLabel: string, fileName: string) => void;
  deleteBankTransaction: (id: string) => void;
  updateBankTransaction: (id: string, patch: Partial<BankTransaction>) => void;
  addBookTransaction: (tx: Omit<BookTransaction, "id" | "signedAmount" | "notes" | "assignee" | "createdAt" | "postingStatus"> & { postingStatus?: BookTransaction["postingStatus"] }) => BookTransaction;
  updateBookTransaction: (id: string, patch: Partial<BookTransaction>) => void;
  createMatch: (input: { bankIds: string[]; bookIds: string[]; confidence?: number; explanation?: string; automatic?: boolean }) => { ok: boolean; error?: string; matchId?: string };
  unmatch: (matchId: string) => void;
  addAdjustment: (input: { reconciliationId: string; side: "bank" | "book"; kind: string; amount: number; description: string; coa: string | null; notes: string }) => { ok: boolean; error?: string };
  deleteAdjustment: (id: string) => void;
  addAccount: (account: Omit<BankAccount, "createdAt" | "updatedAt">) => { ok: boolean; error?: string };
  updateAccount: (id: string, patch: Partial<BankAccount>) => void;
  deactivateAccount: (id: string) => { ok: boolean; error?: string };
  updateSettings: (patch: Partial<Settings>) => void;
  saveMapping: (name: string, columns: ColumnMapping, signedAmountMeaning: "positive_is_deposit" | "positive_is_withdrawal") => void;
  addImportBatch: (batch: ImportBatch) => void;
  deleteMapping: (id: string) => void;
  setUser: (userId: string) => void;
  resetDemo: () => void;
}

const StoreContext = createContext<StoreContextValue | null>(null);

function loadInitialState(): StoreState {
  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as StoreState;
        if (parsed.version === 3) return parsed;
      }
    } catch {
      // fall through to seed
    }
  }
  return buildSeed();
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadInitialState);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // storage may be unavailable; state stays in memory
    }
  }, [state]);

  const user = useMemo(() => state.users.find((u) => u.id === state.currentUserId) ?? state.users[0], [state.users, state.currentUserId]);

  const addAudit = useCallback((entry: Omit<AuditEntry, "id" | "eventId">) => dispatch({ type: "ADD_AUDIT", entry }), []);

  const can = useCallback((permission: string) => user.permissions.includes(permission), [user]);

  const startReconciliation = useCallback(
    (input: StartReconInput): StartReconResult => {
      const warnings: string[] = [];
      const account = state.accounts.find((a) => a.id === input.accountId);
      if (!account) return { ok: false, warnings, error: "Bank account not found." };
      if (!can("start_reconciliation")) return { ok: false, warnings, error: "You do not have permission to start reconciliations." };

      const overlap = state.reconciliations.find(
        (r) =>
          r.accountId === input.accountId &&
          r.status !== "Reconciled" &&
          r.status !== "Cancelled" &&
          r.periodStart <= input.periodEnd &&
          r.periodEnd >= input.periodStart,
      );
      if (overlap) {
        return { ok: false, warnings, error: `An active reconciliation already exists for this account covering ${overlap.periodStart} to ${overlap.periodEnd} (${overlap.reference}). Complete, cancel, or reopen it first.` };
      }

      // opening balance consistency vs latest completed reconciliation
      const prev = state.reconciliations
        .filter((r) => r.accountId === input.accountId && (r.status === "Reconciled" || r.status === "Reopened") && r.periodEnd < input.periodStart)
        .sort((a, b) => b.periodEnd.localeCompare(a.periodEnd))[0];
      if (prev && Math.abs(prev.statementEndingBalance - input.statementOpeningBalance) > 0.005) {
        warnings.push(
          `Opening balance difference: statement opening balance ${input.statementOpeningBalance.toFixed(2)} does not equal the previous completed statement ending balance ${prev.statementEndingBalance.toFixed(2)} (${prev.statementRef}). Investigate before proceeding; documented exceptions require approval.`,
        );
      }
      const earlierDone = state.reconciliations.find(
        (r) => r.accountId === input.accountId && r.status === "Reconciled" && r.periodEnd >= input.periodStart,
      );
      if (earlierDone) {
        warnings.push(`A completed reconciliation already exists for a period ending ${earlierDone.periodEnd}. Reconciling an earlier period requires an authorized exception workflow.`);
      }
      const dup = state.reconciliations.find(
        (r) => r.accountId === input.accountId && r.periodStart === input.periodStart && r.status !== "Cancelled",
      );
      if (dup) {
        return { ok: false, warnings, error: `A reconciliation for the period starting ${input.periodStart} already exists (${dup.reference}).` };
      }

      const ref = `REC-${account.id.replace("BA-", "")}-${input.periodStart.slice(0, 7).replace(/-/g, "")}`;
      const recon: Reconciliation = {
        id: uid("REC"),
        reference: ref,
        accountId: input.accountId,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        statementOpeningBalance: r2(input.statementOpeningBalance),
        statementEndingBalance: r2(input.statementEndingBalance),
        statementRef: input.statementRef,
        fileName: input.fileName,
        notes: input.notes,
        status: "In Progress",
        createdBy: user.name,
        createdAt: new Date().toISOString(),
        finalizedBy: null,
        finalizedAt: null,
        reopenReason: null,
        finalSummary: null,
        detailSeeded: true,
      };
      dispatch({ type: "RECON_CREATE", recon });
      addAudit({ at: new Date().toISOString(), user: user.name, action: "Reconciliation created", record: recon.reference, before: "", after: `Period ${input.periodStart} to ${input.periodEnd}`, notes: input.notes });
      return { ok: true, reconId: recon.id, warnings };
    },
    [state, user, can, addAudit],
  );

  const cancelReconciliation = useCallback(
    (id: string, reason: string) => {
      const recon = state.reconciliations.find((r) => r.id === id);
      if (!recon) return { ok: false, error: "Reconciliation not found." };
      if (!can("cancel_reconciliation")) return { ok: false, error: "You do not have permission to cancel reconciliations." };
      if (recon.status === "Reconciled") return { ok: false, error: "A finalized reconciliation cannot be cancelled; use the reopen workflow." };
      if (!reason.trim()) return { ok: false, error: "A cancellation reason is required." };
      dispatch({ type: "RECON_STATUS", id, status: "Cancelled" });
      addAudit({ at: new Date().toISOString(), user: user.name, action: "Reconciliation cancelled", record: recon.reference, before: recon.status, after: "Cancelled", notes: reason });
      return { ok: true };
    },
    [state, user, can, addAudit],
  );

  const finalizeReconciliation = useCallback(
    (id: string, confirmation: boolean): { ok: boolean; error?: string } => {
      const recon = state.reconciliations.find((r) => r.id === id);
      if (!recon) return { ok: false, error: "Reconciliation not found." };
      if (recon.status === "Reconciled") return { ok: false, error: "This reconciliation is already finalized." };
      if (recon.status === "Cancelled") return { ok: false, error: "This reconciliation was cancelled." };
      if (!can("finalize_reconciliation")) return { ok: false, error: "You do not have permission to finalize reconciliations." };
      if (state.settings.approvalRequired && !can("approve_adjustments")) return { ok: false, error: "Finalization requires approval permissions (approve adjustments)." };
      if (!confirmation) return { ok: false, error: "Confirmation is required to finalize." };
      const calc = computeRecon(state, recon);
      if (!calc.isBalanced) return { ok: false, error: `Adjusted balances do not agree (remaining difference ${calc.remainingDifference.toFixed(2)}). Resolve all unexplained differences first.` };
      if (calc.hasUnresolvedBankItems) return { ok: false, error: `${calc.unmatchedBank.length} unmatched bank transaction(s) remain. Resolve or record them before finalizing.` };
      const unapproved = state.adjustments.filter((a) => a.reconciliationId === id && !a.approved).length;
      if (unapproved > 0) return { ok: false, error: `${unapproved} unapproved adjustment(s) must be approved before finalization.` };

      dispatch({
        type: "RECON_UPDATE",
        id,
        patch: {
          status: "Reconciled",
          finalizedBy: user.name,
          finalizedAt: new Date().toISOString(),
          finalSummary: {
            statementEndingBalance: calc.statementEndingBalance,
            adjustedBank: calc.adjustedBank,
            adjustedBook: calc.adjustedBook,
            remainingDifference: calc.remainingDifference,
            matchedCount: calc.matchedBankCount,
            outstandingCount: calc.depositsInTransit.length + calc.outstandingPayments.length,
            unresolvedCount: 0,
          },
        },
      });
      addAudit({
        at: new Date().toISOString(), user: user.name, action: "Reconciliation finalized", record: recon.reference,
        before: recon.status, after: "Reconciled",
        notes: `Adjusted bank ${calc.adjustedBank.toFixed(2)} = adjusted book ${calc.adjustedBook.toFixed(2)}; ${calc.matchedBankCount} matched; ${calc.depositsInTransit.length + calc.outstandingPayments.length} outstanding timing differences.`,
      });
      return { ok: true };
    },
    [state, user, can, addAudit],
  );

  const reopenReconciliation = useCallback(
    (id: string, reason: string): { ok: boolean; error?: string } => {
      const recon = state.reconciliations.find((r) => r.id === id);
      if (!recon) return { ok: false, error: "Reconciliation not found." };
      if (recon.status !== "Reconciled") return { ok: false, error: "Only finalized reconciliations can be reopened." };
      if (!can("reopen_reconciliation")) return { ok: false, error: "You do not have permission to reopen reconciliations." };
      if (state.settings.reopenPermission === "admin" && user.role !== "Accounting Admin") {
        return { ok: false, error: "Reopening requires an Accounting Admin (configured permission)." };
      }
      if (!reason.trim()) return { ok: false, error: "A reopen reason is required." };
      dispatch({ type: "RECON_UPDATE", id, patch: { status: "Reopened", reopenReason: reason } });
      addAudit({ at: new Date().toISOString(), user: user.name, action: "Reconciliation reopened", record: recon.reference, before: "Reconciled", after: "Reopened", notes: reason });
      return { ok: true };
    },
    [state, user, can, addAudit],
  );

  const updateReconciliation = useCallback((id: string, patch: Partial<Reconciliation>) => dispatch({ type: "RECON_UPDATE", id, patch }), []);

  const addBankTransactions = useCallback(
    (rows: { date: string; postedDate: string | null; description: string; reference: string; debit: number; credit: number; runningBalance: number | null }[], accountId: string, batchLabel: string, fileName: string) => {
      const txs: BankTransaction[] = rows.map((r) => {
        const signed = r2(r.credit - r.debit);
        return {
          id: uid("btx"),
          batchId: batchLabel,
          accountId,
          date: r.date,
          postedDate: r.postedDate,
          description: r.description,
          reference: r.reference,
          debit: r2(r.debit),
          credit: r2(r.credit),
          signedAmount: signed,
          runningBalance: r.runningBalance,
          fingerprint: makeFingerprint(accountId, r.date, signed, r.reference, r.description),
          duplicateOf: null,
          manualEntry: false,
          importedAt: new Date().toISOString(),
          notes: "",
        };
      });
      dispatch({ type: "ADD_BANK_TXS", txs });
      addAudit({ at: new Date().toISOString(), user: user.name, action: "Bank transactions added", record: `${batchLabel} (${fileName})`, before: "", after: `${txs.length} transaction(s)`, notes: "Imported statement activity" });
    },
    [user, addAudit],
  );

  const deleteBankTransaction = useCallback(
    (id: string) => {
      const tx = state.bankTxs.find((t) => t.id === id);
      dispatch({ type: "DELETE_BANK_TX", id });
      if (tx) addAudit({ at: new Date().toISOString(), user: user.name, action: "Bank transaction deleted", record: tx.id, before: `${tx.description} ${tx.signedAmount.toFixed(2)}`, after: "", notes: "Removed from workspace" });
    },
    [state, user, addAudit],
  );

  const addBookTransaction = useCallback(
    (tx: Omit<BookTransaction, "id" | "signedAmount" | "notes" | "assignee" | "createdAt" | "postingStatus"> & { postingStatus?: BookTransaction["postingStatus"] }) => {
      const full: BookTransaction = {
        id: uid("bt"),
        signedAmount: r2(tx.moneyIn - tx.moneyOut),
        notes: "",
        assignee: "Unassigned",
        createdAt: new Date().toISOString(),
        postingStatus: tx.postingStatus ?? "Posted",
        ...tx,
      };
      dispatch({ type: "ADD_BOOK_TX", tx: full });
      addAudit({ at: new Date().toISOString(), user: user.name, action: "Book transaction recorded", record: full.id, before: "", after: `${full.description} (${full.signedAmount.toFixed(2)}, ${full.coa})`, notes: `Source: ${full.source}` });
      return full;
    },
    [user, addAudit],
  );

  const updateBookTransaction = useCallback((id: string, patch: Partial<BookTransaction>) => dispatch({ type: "UPDATE_BOOK_TX", id, patch }), []);

  const updateBankTransaction = useCallback((id: string, patch: Partial<BankTransaction>) => dispatch({ type: "UPDATE_BANK_TX", id, patch }), []);

  const createMatch = useCallback(
    (input: { bankIds: string[]; bookIds: string[]; confidence?: number; explanation?: string; automatic?: boolean }): { ok: boolean; error?: string; matchId?: string } => {
      const bankTxs = input.bankIds.map((id) => state.bankTxs.find((t) => t.id === id)).filter(Boolean) as BankTransaction[];
      const bookTxs = input.bookIds.map((id) => state.bookTxs.find((t) => t.id === id)).filter(Boolean) as BookTransaction[];
      if (!bankTxs.length || !bookTxs.length) return { ok: false, error: "Select at least one bank transaction and one book transaction." };
      const bankSum = r2(bankTxs.reduce((a, t) => a + t.signedAmount, 0));
      const bookSum = r2(bookTxs.reduce((a, t) => a + t.signedAmount, 0));
      if (Math.abs(bankSum - bookSum) > 0.005) {
        return { ok: false, error: `Grouped amounts do not reconcile: bank side ${bankSum.toFixed(2)} vs book side ${bookSum.toFixed(2)}. Record the difference as a missing transaction or an adjustment first.` };
      }
      // one bank tx / one book tx may only appear in one active match
      const activeMatches = state.matches.filter((m) => m.active);
      for (const m of activeMatches) {
        if (m.bankTxIds.some((id) => input.bankIds.includes(id))) return { ok: false, error: "One of the selected bank transactions is already matched." };
        if (m.bookTxIds.some((id) => input.bookIds.includes(id))) return { ok: false, error: "One of the selected book transactions is already matched." };
      }
      // determine reconciliation (from bank tx's active recon)
      const recon = state.reconciliations.find(
        (r) => r.accountId === bankTxs[0].accountId && r.status !== "Reconciled" && r.status !== "Cancelled" && r.periodStart <= bankTxs[0].date && bankTxs[0].date <= r.periodEnd,
      );
      if (!recon) return { ok: false, error: "No active reconciliation covers the selected bank transactions." };
      if (!can("match_transactions")) return { ok: false, error: "You do not have permission to match transactions." };

      const auto = input.automatic ?? false;
      const confidence = input.confidence ?? 50;
      const match: Match = {
        id: uid("M"),
        reconciliationId: recon.id,
        bankTxIds: input.bankIds,
        bookTxIds: input.bookIds,
        confidence,
        confidenceLevel: confidence >= 85 ? "High" : confidence >= 60 ? "Medium" : "Low",
        explanation: input.explanation ?? "Manual match confirmed by user.",
        type: input.bankIds.length > 1 ? "many_to_one" : input.bookIds.length > 1 ? "one_to_many" : "one_to_one",
        automatic: auto,
        confirmedBy: user.name,
        confirmedAt: new Date().toISOString(),
        active: true,
        history: [{ action: auto ? "Matched automatically" : "Manual match confirmed", by: user.name, at: new Date().toISOString(), note: input.explanation ?? "" }],
      };
      dispatch({ type: "ADD_MATCH", match });
      addAudit({ at: new Date().toISOString(), user: user.name, action: "Transaction match confirmed", record: match.id, before: "", after: `Bank ${input.bankIds.length} ↔ Book ${input.bookIds.length} (confidence ${confidence})`, notes: match.explanation });
      return { ok: true, matchId: match.id };
    },
    [state, user, can, addAudit],
  );

  const unmatch = useCallback(
    (matchId: string) => {
      const m = state.matches.find((x) => x.id === matchId);
      if (!can("unmatch_transactions")) return;
      dispatch({ type: "UNMATCH", matchId, by: user.name });
      if (m) addAudit({ at: new Date().toISOString(), user: user.name, action: "Match undone", record: m.id, before: `Matched (${m.confidenceLevel} confidence)`, after: "Unmatched", notes: "Match history preserved" });
    },
    [state, user, can, addAudit],
  );

  const addAdjustment = useCallback(
    (input: { reconciliationId: string; side: "bank" | "book"; kind: string; amount: number; description: string; coa: string | null; notes: string }): { ok: boolean; error?: string } => {
      const recon = state.reconciliations.find((r) => r.id === input.reconciliationId);
      if (!recon) return { ok: false, error: "Reconciliation not found." };
      if (recon.status === "Reconciled") return { ok: false, error: "Adjustments cannot be added to a finalized reconciliation. Reopen it first." };
      if (!can("approve_adjustments")) return { ok: false, error: "You do not have permission to approve adjustments." };
      const adjustment: Adjustment = {
        id: uid("ADJ"),
        reconciliationId: input.reconciliationId,
        side: input.side,
        kind: input.kind,
        amount: r2(input.amount),
        description: input.description,
        coa: input.coa,
        approved: true,
        createdBy: user.name,
        createdAt: new Date().toISOString(),
        notes: input.notes,
      };
      dispatch({ type: "ADD_ADJUSTMENT", adjustment });
      addAudit({ at: new Date().toISOString(), user: user.name, action: "Adjustment approved", record: `${recon.reference}/${adjustment.id}`, before: "", after: `${input.side}-side ${input.amount.toFixed(2)} (${input.kind})`, notes: input.description });
      return { ok: true };
    },
    [state, user, can, addAudit],
  );

  const deleteAdjustment = useCallback((id: string) => dispatch({ type: "DELETE_ADJUSTMENT", id }), []);

  const addAccount = useCallback(
    (account: Omit<BankAccount, "createdAt" | "updatedAt">): { ok: boolean; error?: string } => {
      if (!can("create_edit_bank_accounts")) return { ok: false, error: "You do not have permission to create bank accounts." };
      if (!account.id.trim()) return { ok: false, error: "Account ID is required." };
      if (state.accounts.some((a) => a.id === account.id)) return { ok: false, error: "An account with this internal identifier already exists." };
      if (!account.glAccount.trim()) return { ok: false, error: "A linked Chart of Accounts account is required." };
      if (!Number.isFinite(account.openingBalance)) return { ok: false, error: "Opening balance must be a valid number." };
      const full: BankAccount = { ...account, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      dispatch({ type: "ADD_ACCOUNT", account: full });
      addAudit({ at: new Date().toISOString(), user: user.name, action: "Bank account created", record: full.id, before: "", after: full.name, notes: `Type ${full.accountType}, GL ${full.glAccount}` });
      return { ok: true };
    },
    [state, user, can, addAudit],
  );

  const updateAccount = useCallback(
    (id: string, patch: Partial<BankAccount>) => {
      const before = state.accounts.find((a) => a.id === id);
      dispatch({ type: "UPDATE_ACCOUNT", id, patch });
      if (before) {
        addAudit({ at: new Date().toISOString(), user: user.name, action: "Bank account updated", record: id, before: JSON.stringify({ name: before.name, type: before.accountType, glAccount: before.glAccount, active: before.active }), after: JSON.stringify({ ...patch }), notes: "Configuration change" });
      }
    },
    [state, user, addAudit],
  );

  const deactivateAccount = useCallback(
    (id: string): { ok: boolean; error?: string } => {
      if (!can("create_edit_bank_accounts")) return { ok: false, error: "You do not have permission to edit bank accounts." };
      const account = state.accounts.find((a) => a.id === id);
      if (!account) return { ok: false, error: "Account not found." };
      const activeRecon = state.reconciliations.find((r) => r.accountId === id && r.status !== "Reconciled" && r.status !== "Cancelled");
      if (activeRecon) return { ok: false, error: `Account has an active reconciliation (${activeRecon.reference}). Complete, cancel, or reopen it before deactivating this account.` };
      dispatch({ type: "UPDATE_ACCOUNT", id, patch: { active: false } });
      addAudit({ at: new Date().toISOString(), user: user.name, action: "Bank account deactivated", record: id, before: "Active", after: "Inactive", notes: "No active reconciliation present" });
      return { ok: true };
    },
    [state, user, can, addAudit],
  );

  const updateSettings = useCallback(
    (patch: Partial<Settings>) => {
      const before = state.settings;
      dispatch({ type: "SET_STATE", patch: { settings: { ...state.settings, ...patch } } });
      addAudit({ at: new Date().toISOString(), user: user.name, action: "Reconciliation settings changed", record: "Settings", before: JSON.stringify(before), after: JSON.stringify({ ...before, ...patch }), notes: "Settings apply to future reconciliations only; finalized records are unchanged." });
    },
    [state, user, addAudit],
  );

  const saveMapping = useCallback(
    (name: string, columns: ColumnMapping, signedAmountMeaning: "positive_is_deposit" | "positive_is_withdrawal") => {
      if (!can("manage_settings")) return;
      const mapping: ImportMapping = { id: uid("MAP"), name, format: "Custom mapping", columns, signedAmountMeaning, createdAt: new Date().toISOString() };
      dispatch({ type: "SAVE_MAPPING", mapping });
      addAudit({ at: new Date().toISOString(), user: user.name, action: "Import mapping saved", record: name, before: "", after: JSON.stringify(columns), notes: "CSV import mapping" });
    },
    [user, can, addAudit],
  );

  const addImportBatch = useCallback(
    (batch: ImportBatch) => {
      dispatch({ type: "ADD_IMPORT_BATCH", batch });
      addAudit({ at: new Date().toISOString(), user: user.name, action: "Statement import confirmed", record: batch.id, before: "", after: `${batch.acceptedRows} accepted, ${batch.rejectedRows} rejected, ${batch.duplicateRows} duplicates`, notes: `File ${batch.fileName} · mapping ${batch.mappingName}` });
    },
    [user, addAudit],
  );

  const deleteMapping = useCallback(
    (id: string) => {
      dispatch({ type: "DELETE_MAPPING", id });
      addAudit({ at: new Date().toISOString(), user: user.name, action: "Import mapping deleted", record: id, before: "", after: "", notes: "" });
    },
    [user, addAudit],
  );

  const setUser = useCallback((userId: string) => dispatch({ type: "SET_USER", userId }), []);
  const resetDemo = useCallback(() => {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    dispatch({ type: "RESET" });
  }, []);

  const value: StoreContextValue = {
    state,
    user,
    can,
    startReconciliation,
    cancelReconciliation,
    finalizeReconciliation,
    reopenReconciliation,
    updateReconciliation,
    addBankTransactions,
    deleteBankTransaction,
    updateBankTransaction,
    addBookTransaction,
    updateBookTransaction,
    createMatch,
    unmatch,
    addAdjustment,
    deleteAdjustment,
    addAccount,
    updateAccount,
    deactivateAccount,
    updateSettings,
    saveMapping,
    deleteMapping,
    addImportBatch,
    setUser,
    resetDemo,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}

export function nextReconStatus(state: StoreState, id: string): ReconStatus {
  const recon = state.reconciliations.find((r) => r.id === id);
  if (!recon) return "Not Started";
  if (recon.status === "Reconciled" || recon.status === "Cancelled") return recon.status;
  return computeRecon(state, recon).suggestedStatus;
}
