import { revalidatePath } from "../../shim/store";
import { db } from "../../db";
import * as schema from "../../db/schema";
import { and, eq, isNotNull } from "../../db/ops";
import { addDaysISO, isISODate, todayISO } from "../dates";
import { centsFromInput, formatCurrency, rentMultipleCents } from "../money";
import { getCurrentUser, setCurrentStaffId } from "../session";
import {
  computeBalances,
  deriveStatus,
  getApplicableRule,
  interestAccrualWindow,
  principalEventStream,
  calculateInterest,
  validateApplication,
  validateCollection,
  validateRefund,
  ruleMaxAmountCents,
  type RateLike,
  type RuleLike,
  type TxnLike,
} from "./engine";
import {
  applicationLines,
  collectionLines,
  interestAccrualLines,
  interestCreditLines,
  interestPaymentLines,
  nextSequentialReference,
  newId,
  postJournal,
  postReversingJournal,
  refundLines,
} from "./accounting";
import {
  DEPOSIT_TYPES,
  APPLICATION_PURPOSES,
  JURISDICTIONS,
  LEASE_TYPES,
  LIABILITY_ACCOUNT_BY_TYPE,
  can,
  depositTypeLabel,
  type DepositStatus,
  type Permission,
} from "./domain";

export type ActionState = {
  ok: boolean;
  message: string;
  errors: string[];
  warnings: string[];
};

const blank: ActionState = { ok: false, message: "", errors: [], warnings: [] };

const fail = (errors: string[], warnings: string[] = []): ActionState => ({
  ok: false,
  message: errors[0] ?? "The action could not be completed.",
  errors,
  warnings,
});

const done = (message: string, warnings: string[] = []): ActionState => ({
  ok: true,
  message,
  errors: [],
  warnings,
});

function requirePermission(role: Parameters<typeof can>[0], permission: Permission, label: string): string | null {
  if (!can(role, permission)) {
    return `Your role does not allow you to ${label}. Ask an administrator for the "${permission.replaceAll("_", " ")}" permission.`;
  }
  return null;
}

function fdString(fd: FormData, key: string): string {
  return String(fd.get(key) ?? "").trim();
}

function fdDate(fd: FormData, key: string, fallback = todayISO()): string {
  const value = fdString(fd, key);
  return isISODate(value) ? value : fallback;
}

async function writeAudit(input: {
  entityType: string;
  entityId: string;
  action: string;
  userId: string;
  previousValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  reason?: string | null;
  approvalRef?: string | null;
  relatedRef?: string | null;
}) {
  await db.insert(schema.auditLog).values({
    id: newId("aud"),
    entityType: input.entityType,
    entityId: input.entityId,
    action: input.action,
    userId: input.userId,
    previousValue: input.previousValue ?? null,
    newValue: input.newValue ?? null,
    reason: input.reason ?? null,
    approvalRef: input.approvalRef ?? null,
    relatedRef: input.relatedRef ?? null,
  });
}

const ruleRowToRule = (r: typeof schema.depositRules.$inferSelect): RuleLike => ({
  id: r.id,
  jurisdiction: r.jurisdiction,
  leaseType: r.leaseType,
  depositType: r.depositType,
  collectionPermitted: r.collectionPermitted,
  maxAmountCents: r.maxAmountCents,
  maxMultipleOfRentBps: r.maxMultipleOfRentBps,
  calculationMethod: r.calculationMethod,
  refundConditions: r.refundConditions,
  interestApplicable: r.interestApplicable,
  interestMethod: r.interestMethod,
  interestFrequency: r.interestFrequency,
  applicationPurposes: r.applicationPurposes ?? [],
  requiredDocuments: r.requiredDocuments ?? [],
  approvalRequired: r.approvalRequired,
  refundApprovalRequired: r.refundApprovalRequired,
  roundingMode: r.roundingMode,
  effectiveFrom: r.effectiveFrom,
  effectiveTo: r.effectiveTo,
  validationMessage: r.validationMessage,
  legalReference: r.legalReference,
  notes: r.notes,
});

async function loadRules(): Promise<RuleLike[]> {
  const rows = await db.select().from(schema.depositRules);
  return rows.map(ruleRowToRule);
}

async function loadRateLikes(jurisdiction: string, leaseType: string, depositType: string): Promise<RateLike[]> {
  const rows = await db.select().from(schema.depositInterestRates);
  return rows
    .filter((r) => r.jurisdiction === jurisdiction && r.leaseType === leaseType && r.depositType === depositType)
    .map((r) => ({
      id: r.id,
      annualRateBps: r.annualRateBps,
      effectiveFrom: r.effectiveFrom,
      effectiveTo: r.effectiveTo,
      source: r.source,
    }));
}

async function refreshDepositStatus(depositId: string, actorId: string) {
  const [deposit] = await db.select().from(schema.deposits).where(eq(schema.deposits.id, depositId));
  if (!deposit) return;
  const txns = await db.select().from(schema.depositTransactions).where(eq(schema.depositTransactions.depositId, depositId));
  const refunds = await db.select().from(schema.depositRefunds).where(eq(schema.depositRefunds.depositId, depositId));
  const balances = computeBalances(deposit.requiredAmountCents, txns as TxnLike[]);
  const openRefund = refunds.find((r) => ["requested", "approved", "processing"].includes(r.status));
  if (["cancelled", "closed", "transferred"].includes(deposit.status)) return;
  const next = deriveStatus({
    current: deposit.status as DepositStatus,
    balances,
    openRefundStatus: openRefund?.status ?? null,
  });
  await db
    .update(schema.deposits)
    .set({ status: next, updatedAt: new Date() })
    .where(eq(schema.deposits.id, depositId));
  void actorId;
}

/* --------------------------------- Session --------------------------------- */

export async function setUserAction(fd: FormData): Promise<void> {
  const id = String(fd.get("staffId") ?? "");
  const rows = await db.select().from(schema.staff);
  if (rows.some((r) => r.id === id)) {
    setCurrentStaffId(id);
  }
  revalidatePath("/", "layout");
}

/* ------------------------------- Create deposit ------------------------------- */

export async function createDepositAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  const denied = requirePermission(user.role, "create_deposit", "create deposit records");
  if (denied) return fail([denied]);

  const leaseId = fdString(fd, "leaseId");
  const depositType = fdString(fd, "depositType");
  const expectedDate = fdDate(fd, "expectedDate");
  const amount = centsFromInput(fd.get("requiredAmount"));
  const saveAsDraft = fdString(fd, "intent") === "draft";
  const notes = fdString(fd, "notes");
  const responsibleUserId = fdString(fd, "responsibleUserId") || user.id;
  const liabilityAccountCode = fdString(fd, "liabilityAccountCode");
  const cashAccountCode = fdString(fd, "cashAccountCode");
  const receivableAccountCode = fdString(fd, "receivableAccountCode");
  const deviceType = fdString(fd, "deviceType");
  const deviceIdentifier = fdString(fd, "deviceIdentifier");
  const deviceQty = Number(fdString(fd, "deviceQuantity") || "0");
  const deviceCost = centsFromInput(fd.get("deviceReplacementCost")) ?? 0;

  const errors: string[] = [];
  const warnings: string[] = [];
  if (!leaseId) errors.push("Select the lease the deposit belongs to.");
  if (!DEPOSIT_TYPES.includes(depositType as (typeof DEPOSIT_TYPES)[number])) errors.push("Select a valid deposit type.");
  if (amount == null || amount <= 0) errors.push("Enter the required deposit amount greater than zero.");

  const [lease] = leaseId ? await db.select().from(schema.leases).where(eq(schema.leases.id, leaseId)) : [];
  if (!lease) errors.push("The selected lease could not be found.");
  const accounts = await db.select().from(schema.chartOfAccounts);
  const liabilityAccount = accounts.find((a) => a.code === liabilityAccountCode);
  const cashAccount = accounts.find((a) => a.code === cashAccountCode);
  if (!liabilityAccount || liabilityAccount.type !== "liability") errors.push("Select an active liability account for the deposit.");
  if (!cashAccount || cashAccount.type !== "asset") errors.push("Select an active bank or cash account.");

  const rules = await loadRules();
  const rule = lease
    ? getApplicableRule(rules, {
        jurisdiction: lease.jurisdiction,
        leaseType: lease.leaseType,
        depositType,
        asOf: expectedDate,
      })
    : null;
  if (lease && !rule) {
    errors.push(
      `No deposit rule is configured for ${lease.jurisdiction} ${lease.leaseType} / ${depositTypeLabel(depositType)} effective ${expectedDate}. Configure the rule before creating this deposit.`,
    );
  }
  if (rule && !rule.collectionPermitted) errors.push(rule.validationMessage);
  const replacementBasis = depositType === "key_fob" ? deviceCost * Math.max(1, deviceQty) : null;
  const maxCents = ruleMaxAmountCents(rule, lease?.monthlyRentCents ?? null, replacementBasis);
  if (rule && maxCents != null && amount != null && amount > maxCents) {
    errors.push(`The required amount exceeds the permitted maximum of ${formatCurrency(maxCents)} under ${rule.legalReference}.`);
  }
  if (rule?.calculationMethod === "replacement_cost" && (replacementBasis == null || replacementBasis <= 0)) {
    warnings.push("Key deposits cannot exceed the reasonable expected replacement cost. Record the device replacement cost basis.");
  }
  if (lease && depositType === "last_month_rent") {
    const rentLimit = rentMultipleCents(lease.monthlyRentCents, 10_000);
    if ((amount ?? 0) > rentLimit) errors.push(`Last month's rent cannot exceed one month's rent (${formatCurrency(rentLimit)}).`);
  }
  if (lease) {
    const siblings = await db.select().from(schema.deposits).where(eq(schema.deposits.leaseId, lease.id));
    const duplicate = siblings.find(
      (d) => d.depositType === depositType && !["cancelled", "closed", "refunded"].includes(d.status),
    );
    if (duplicate) errors.push(`An active ${depositTypeLabel(depositType)} already exists for this lease (${duplicate.reference}).`);
  }
  if (errors.length) return fail(errors, warnings);

  if (!lease || !rule) return fail(["Unable to resolve lease or deposit rule."]);
  const references = await db.select({ reference: schema.deposits.reference }).from(schema.deposits);
  const reference = nextSequentialReference("DEP", references.map((r) => r.reference));
  const id = newId("dep");
  const tenantId = lease.tenantId;
  const initialStatus: DepositStatus = saveAsDraft ? "draft" : "expected";

  await db.insert(schema.deposits).values({
    id,
    reference,
    tenantId,
    leaseId: lease.id,
    propertyId: lease.propertyId,
    unitId: lease.unitId,
    depositType,
    jurisdiction: lease.jurisdiction,
    leaseType: lease.leaseType,
    status: initialStatus,
    requiredAmountCents: amount ?? 0,
    expectedDate,
    firstReceivedDate: null,
    interestApplicable: rule.interestApplicable,
    liabilityAccountCode,
    cashAccountCode,
    receivableAccountCode: receivableAccountCode || "1200",
    interestPayableAccountCode: "2310",
    responsibleUserId,
    notes: notes || null,
    documents: fdString(fd, "documentName")
      ? [{ name: fdString(fd, "documentName"), kind: "lease/notice" }]
      : [],
    ruleSnapshot: {
      ruleId: rule.id,
      legalReference: rule.legalReference,
      effectiveFrom: rule.effectiveFrom,
      interestApplicable: rule.interestApplicable,
      interestMethod: rule.interestMethod,
      maxCents,
      capturedAt: todayISO(),
    },
    createdBy: user.id,
    source: "user",
  });

  if (depositType === "key_fob" && deviceIdentifier) {
    await db.insert(schema.keyDevices).values({
      id: newId("dev"),
      depositId: id,
      deviceType: deviceType || "key",
      identifier: deviceIdentifier,
      quantityIssued: Math.max(1, deviceQty || 1),
      quantityReturned: 0,
      replacementCostCents: deviceCost,
      returnDate: null,
      returnCondition: null,
      notes: null,
    });
  }

  await writeAudit({
    entityType: "deposit",
    entityId: id,
    action: "Deposit created",
    userId: user.id,
    newValue: { reference, depositType, requiredAmountCents: amount, status: initialStatus },
    reason: notes || null,
    relatedRef: lease.reference,
  });

  revalidatePath("/deposits", "layout");
  return done(
    `${reference} created as ${initialStatus} (${formatCurrency(amount ?? 0)} ${depositTypeLabel(depositType)}). No money has moved and no accounting entry has been posted until a collection is recorded.`,
    warnings,
  );
}

export async function updateDraftDepositAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  const denied = requirePermission(user.role, "edit_draft", "edit draft deposits");
  if (denied) return fail([denied]);
  const depositId = fdString(fd, "depositId");
  const [deposit] = await db.select().from(schema.deposits).where(eq(schema.deposits.id, depositId));
  if (!deposit) return fail(["Deposit not found."]);
  if (deposit.status !== "draft") return fail(["Only draft deposits can be edited. Use a controlled correction workflow for posted records."]);
  const amount = centsFromInput(fd.get("requiredAmount"));
  if (amount == null || amount <= 0) return fail(["Enter a required amount greater than zero."]);
  const expectedDate = fdDate(fd, "expectedDate", deposit.expectedDate);
  const [lease] = await db.select().from(schema.leases).where(eq(schema.leases.id, deposit.leaseId));
  const rules = await loadRules();
  const rule = lease
    ? getApplicableRule(rules, {
        jurisdiction: lease.jurisdiction,
        leaseType: lease.leaseType,
        depositType: deposit.depositType,
        asOf: expectedDate,
      })
    : null;
  if (!rule) return fail(["No effective rule exists for the new expected date — configure the rule first."]);
  if (!rule.collectionPermitted) return fail([rule.validationMessage]);
  const maxCents = ruleMaxAmountCents(rule, lease?.monthlyRentCents ?? null);
  if (maxCents != null && amount > maxCents) return fail([`Amount exceeds the permitted maximum of ${formatCurrency(maxCents)}.`]);

  await db
    .update(schema.deposits)
    .set({
      requiredAmountCents: amount,
      expectedDate,
      notes: fdString(fd, "notes") || null,
      liabilityAccountCode: fdString(fd, "liabilityAccountCode") || deposit.liabilityAccountCode,
      cashAccountCode: fdString(fd, "cashAccountCode") || deposit.cashAccountCode,
      status: "expected",
      updatedAt: new Date(),
    })
    .where(eq(schema.deposits.id, depositId));
  await writeAudit({
    entityType: "deposit",
    entityId: depositId,
    action: "Draft deposit updated",
    userId: user.id,
    previousValue: { requiredAmountCents: deposit.requiredAmountCents, expectedDate: deposit.expectedDate },
    newValue: { requiredAmountCents: amount, expectedDate },
    reason: fdString(fd, "notes") || null,
  });
  revalidatePath("/deposits", "layout");
  return done(`${deposit.reference} updated and released to Expected.`);
}

/* -------------------------------- Collection -------------------------------- */

export async function recordCollectionAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  const denied = requirePermission(user.role, "record_collection", "record deposit collections");
  if (denied) return fail([denied]);

  const depositId = fdString(fd, "depositId");
  const amount = centsFromInput(fd.get("amount"));
  const receivedDate = fdDate(fd, "receivedDate");
  const method = fdString(fd, "method") || "eft";
  const paymentSelection = fdString(fd, "paymentId");
  const paymentReference = fdString(fd, "paymentReference");
  const receiptNote = fdString(fd, "receiptNote");
  const notes = fdString(fd, "notes");

  const [deposit] = await db.select().from(schema.deposits).where(eq(schema.deposits.id, depositId));
  if (!deposit) return fail(["Deposit not found."]);
  const [lease] = await db.select().from(schema.leases).where(eq(schema.leases.id, deposit.leaseId));
  if (!lease) return fail(["The deposit has no lease mapping. Attach a lease before collecting funds."]);
  const txns = await db.select().from(schema.depositTransactions).where(eq(schema.depositTransactions.depositId, depositId));
  const balances = computeBalances(deposit.requiredAmountCents, txns as TxnLike[]);
  const rules = await loadRules();
  const rule = getApplicableRule(rules, {
    jurisdiction: deposit.jurisdiction,
    leaseType: deposit.leaseType,
    depositType: deposit.depositType,
    asOf: deposit.expectedDate,
  });
  const accounts = await db.select().from(schema.chartOfAccounts);
  const hasAccountMapping =
    accounts.some((a) => a.code === deposit.liabilityAccountCode && a.isActive) &&
    accounts.some((a) => a.code === deposit.cashAccountCode && a.isActive);

  let linkedPayment: typeof schema.payments.$inferSelect | undefined;
  let alreadyUsed = false;
  if (paymentSelection && paymentSelection !== "new") {
    const [payment] = await db.select().from(schema.payments).where(eq(schema.payments.id, paymentSelection));
    linkedPayment = payment;
    if (!payment) return fail(["The selected payment could not be found."]);
    if (payment.tenantId !== lease.tenantId) return fail(["The selected payment belongs to a different tenant and cannot fund this deposit."]);
    if (payment.type !== "deposit") return fail(["Only deposit-type payments from the Payments module can fund a deposit."]);
    alreadyUsed = txns.some((t) => t.paymentId === payment.id);
  }

  const validation = validateCollection({
    rule,
    leaseMonthlyRentCents: lease.monthlyRentCents,
    balances,
    status: deposit.status,
    amountCents: amount ?? 0,
    asOf: receivedDate,
    replacementCostBasisCents: null,
    hasAccountMapping,
    linkedPaymentAmountCents: linkedPayment?.amountCents ?? null,
    linkedPaymentAlreadyUsed: alreadyUsed,
  });
  if (!validation.ok) return fail(validation.errors, validation.warnings);

  const year = receivedDate.slice(0, 4);
  const [paymentRefs, txnRefs] = await Promise.all([
    db.select({ reference: schema.payments.reference }).from(schema.payments),
    db.select({ reference: schema.depositTransactions.reference }).from(schema.depositTransactions),
  ]);

  let paymentId = linkedPayment?.id ?? "";
  if (paymentSelection === "new" || !paymentSelection) {
    const id = newId("pay");
    await db.insert(schema.payments).values({
      id,
      reference: paymentReference || nextSequentialReference("PMT", paymentRefs.map((p) => p.reference)),
      tenantId: lease.tenantId,
      leaseId: lease.id,
      type: "deposit",
      direction: "in",
      amountCents: amount ?? 0,
      method,
      receivedAt: receivedDate,
      referenceNote: receiptNote || null,
      status: "cleared",
      simulated: true,
      createdBy: user.id,
      notes: `Simulated deposit collection recorded from the Deposits module (${deposit.reference}).`,
    });
    paymentId = id;
  }

  const txnId = newId("dtx");
  const txnReference = nextSequentialReference("DTR", txnRefs.map((t) => t.reference));
  await db.insert(schema.depositTransactions).values({
    id: txnId,
    reference: txnReference,
    depositId,
    txnType: (amount ?? 0) < balances.uncollectedCents ? "partial_collection" : "collection",
    classification: "principal",
    signedAmountCents: amount ?? 0,
    occurredAt: receivedDate,
    paymentId,
    userId: user.id,
    notes: notes || `Simulated ${method} collection. No real funds transferred.`,
    documentRef: receiptNote || `Receipt ${txnReference}`,
    status: "posted",
    source: "user",
  });

  const entryId = await postJournal({
    sourceType: "deposit_collection",
    sourceId: txnId,
    entryDate: receivedDate,
    description: `Deposit collection ${deposit.reference} — ${formatCurrency(amount ?? 0)}`,
    lines: collectionLines(deposit.cashAccountCode, deposit.liabilityAccountCode, amount ?? 0),
    userId: user.id,
    depositId,
  });
  await db.update(schema.depositTransactions).set({ journalEntryId: entryId }).where(eq(schema.depositTransactions.id, txnId));

  const status = deriveStatus({
    current: deposit.status as DepositStatus,
    balances: computeBalances(deposit.requiredAmountCents, [...(txns as TxnLike[]), {
      id: txnId,
      txnType: "collection",
      classification: "principal",
      signedAmountCents: amount ?? 0,
      occurredAt: receivedDate,
    }]),
    openRefundStatus: null,
  });

  await db
    .update(schema.deposits)
    .set({
      firstReceivedDate: deposit.firstReceivedDate ?? receivedDate,
      status,
      updatedAt: new Date(),
    })
    .where(eq(schema.deposits.id, depositId));

  await writeAudit({
    entityType: "deposit",
    entityId: depositId,
    action: "Collection recorded (simulated)",
    userId: user.id,
    previousValue: { receivedCents: balances.receivedCents, status: deposit.status },
    newValue: { receivedCents: balances.receivedCents + (amount ?? 0), status },
    reason: notes || null,
    relatedRef: txnReference,
    approvalRef: entryId,
  });

  revalidatePath("/deposits", "layout");
  void year;
  return done(
    `Simulated collection of ${formatCurrency(amount ?? 0)} recorded against ${deposit.reference}. Ledger ${txnReference} posted to ${deposit.liabilityAccountCode}.`,
    validation.warnings,
  );
}

/* -------------------------------- Application -------------------------------- */

export async function postApplicationAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  const denied = requirePermission(user.role, "apply_deposit", "apply deposits to permitted purposes");
  if (denied) return fail([denied]);

  const depositId = fdString(fd, "depositId");
  const amount = centsFromInput(fd.get("amount"));
  const purpose = fdString(fd, "purpose");
  const invoiceId = fdString(fd, "invoiceId");
  const approvalRef = fdString(fd, "approvalRef");
  const notes = fdString(fd, "notes");
  const documentRef = fdString(fd, "documentRef");
  const asOf = todayISO();

  const [deposit] = await db.select().from(schema.deposits).where(eq(schema.deposits.id, depositId));
  if (!deposit) return fail(["Deposit not found."]);
  const [lease] = await db.select().from(schema.leases).where(eq(schema.leases.id, deposit.leaseId));
  if (!lease) return fail(["The deposit has no lease mapping."]);
  const txns = await db.select().from(schema.depositTransactions).where(eq(schema.depositTransactions.depositId, depositId));
  const balances = computeBalances(deposit.requiredAmountCents, txns as TxnLike[]);
  const rules = await loadRules();
  const rule = getApplicableRule(rules, {
    jurisdiction: deposit.jurisdiction,
    leaseType: deposit.leaseType,
    depositType: deposit.depositType,
    asOf,
  });

  let invoice: (typeof schema.rentInvoices.$inferSelect) | null = null;
  let isFinalPeriod = false;
  if (invoiceId) {
    const [found] = await db.select().from(schema.rentInvoices).where(eq(schema.rentInvoices.id, invoiceId));
    invoice = found ?? null;
    if (invoice) {
      const leaseInvoices = await db
        .select()
        .from(schema.rentInvoices)
        .where(eq(schema.rentInvoices.leaseId, deposit.leaseId));
      const later = leaseInvoices.filter((i) => i.periodStart > invoice!.periodStart);
      isFinalPeriod = later.length === 0 && invoice.periodEnd >= addDaysISO(lease.endDate, -35);
    }
  }
  const alreadyApplied = Boolean(invoice && txns.some((t) => t.invoiceId === invoice.id && t.txnType === "application"));
  const accounts = await db.select().from(schema.chartOfAccounts);
  const hasAccountMapping =
    accounts.some((a) => a.code === deposit.liabilityAccountCode && a.isActive) &&
    accounts.some((a) => a.code === (deposit.receivableAccountCode ?? "1200") && a.isActive);

  const validation = validateApplication({
    rule,
    status: deposit.status,
    balances,
    amountCents: amount ?? 0,
    purpose,
    leaseMonthlyRentCents: lease.monthlyRentCents,
    invoice: invoice
      ? {
          id: invoice.id,
          amountCents: invoice.amountCents,
          status: invoice.status,
          periodStart: invoice.periodStart,
          periodEnd: invoice.periodEnd,
          isFinalPeriod,
          belongsToLease: invoice.leaseId === deposit.leaseId,
        }
      : null,
    leaseEndDate: lease.endDate,
    asOf,
    approvalRef,
    hasAccountMapping,
    alreadyAppliedToRecord: alreadyApplied,
  });
  if (!validation.ok) return fail(validation.errors, validation.warnings);

  const txnRefs = await db.select({ reference: schema.depositTransactions.reference }).from(schema.depositTransactions);
  const txnId = newId("dtx");
  const txnReference = nextSequentialReference("DTR", txnRefs.map((t) => t.reference));
  const receivable = deposit.receivableAccountCode ?? "1200";

  await db.insert(schema.depositTransactions).values({
    id: txnId,
    reference: txnReference,
    depositId,
    txnType: "application",
    classification: "principal",
    signedAmountCents: -(amount ?? 0),
    occurredAt: asOf,
    invoiceId: invoice?.id ?? null,
    userId: user.id,
    notes: notes || "Deposit applied under the applicable configured rule.",
    documentRef: documentRef || null,
    purpose,
    approvalRef: approvalRef || null,
    status: "posted",
    source: "user",
  });

  const entryId = await postJournal({
    sourceType: "deposit_application",
    sourceId: txnId,
    entryDate: asOf,
    description: `Deposit application ${deposit.reference} — ${purpose.replaceAll("_", " ")}`,
    lines: applicationLines(deposit.liabilityAccountCode, receivable, amount ?? 0),
    userId: user.id,
    depositId,
  });
  await db.update(schema.depositTransactions).set({ journalEntryId: entryId }).where(eq(schema.depositTransactions.id, txnId));

  if (invoice) {
    await db
      .update(schema.rentInvoices)
      .set({
        status: (amount ?? 0) >= invoice.amountCents ? "settled_by_deposit" : invoice.status,
        settlementRef: txnReference,
      })
      .where(eq(schema.rentInvoices.id, invoice.id));
  }

  await refreshDepositStatus(depositId, user.id);
  await writeAudit({
    entityType: "deposit",
    entityId: depositId,
    action: `Deposit applied — ${purpose}`,
    userId: user.id,
    previousValue: { principalOutstandingCents: balances.principalOutstandingCents },
    newValue: { appliedCents: amount, invoiceId: invoice?.id ?? null },
    reason: notes || null,
    approvalRef: approvalRef || null,
    relatedRef: txnReference,
  });

  revalidatePath("/deposits", "layout");
  return done(
    `Application of ${formatCurrency(amount ?? 0)} posted against ${deposit.reference}. Ledger ${txnReference}; the linked receivable was relieved — no duplicate rental income recognised.`,
    validation.warnings,
  );
}

/* ---------------------------------- Refunds ---------------------------------- */

export async function requestRefundAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  const denied = requirePermission(user.role, "request_refund", "request deposit refunds");
  if (denied) return fail([denied]);

  const depositId = fdString(fd, "depositId");
  const principal = centsFromInput(fd.get("principalAmount")) ?? 0;
  const interest = centsFromInput(fd.get("interestAmount")) ?? 0;
  const method = fdString(fd, "method") || "eft";
  const requestedAt = fdDate(fd, "requestedAt");
  const notes = fdString(fd, "notes");
  const documentRef = fdString(fd, "documentRef");
  const dueDate = fdString(fd, "dueDate") || addDaysISO(requestedAt, 15);

  const [deposit] = await db.select().from(schema.deposits).where(eq(schema.deposits.id, depositId));
  if (!deposit) return fail(["Deposit not found."]);
  const [lease] = await db.select().from(schema.leases).where(eq(schema.leases.id, deposit.leaseId));
  const txns = await db.select().from(schema.depositTransactions).where(eq(schema.depositTransactions.depositId, depositId));
  const devices = await db.select().from(schema.keyDevices).where(eq(schema.keyDevices.depositId, depositId));
  const refunds = await db.select().from(schema.depositRefunds).where(eq(schema.depositRefunds.depositId, depositId));
  const balances = computeBalances(deposit.requiredAmountCents, txns as TxnLike[]);
  const rules = await loadRules();
  const rule = getApplicableRule(rules, {
    jurisdiction: deposit.jurisdiction,
    leaseType: deposit.leaseType,
    depositType: deposit.depositType,
    asOf: todayISO(),
  });
  const accounts = await db.select().from(schema.chartOfAccounts);
  const validation = validateRefund({
    rule,
    status: deposit.status,
    balances,
    principalCents: principal,
    interestCents: interest,
    lease: { endDate: lease?.endDate ?? todayISO(), status: lease?.status ?? "active" },
    asOf: requestedAt,
    devices: devices.map((d) => ({
      deviceType: d.deviceType,
      quantityIssued: d.quantityIssued,
      quantityReturned: d.quantityReturned,
      replacementCostCents: d.replacementCostCents,
    })),
    openRefund: refunds.some((r) => ["requested", "approved", "processing"].includes(r.status)),
    hasAccountMapping:
      accounts.some((a) => a.code === deposit.cashAccountCode && a.isActive) &&
      accounts.some((a) => a.code === deposit.liabilityAccountCode && a.isActive),
  });
  if (!validation.ok) return fail(validation.errors, validation.warnings);

  const refs = await db.select({ reference: schema.depositRefunds.reference }).from(schema.depositRefunds);
  const reference = nextSequentialReference("RFS", refs.map((r) => r.reference));
  const refundId = newId("rfd");
  const requiresApproval = Boolean(rule?.refundApprovalRequired);
  await db.insert(schema.depositRefunds).values({
    id: refundId,
    reference,
    depositId,
    requestedAt,
    requestedPrincipalCents: principal,
    requestedInterestCents: interest,
    approvedPrincipalCents: requiresApproval ? null : principal,
    approvedInterestCents: requiresApproval ? null : interest,
    method,
    status: requiresApproval ? "requested" : "approved",
    dueDate,
    approvalStatus: requiresApproval ? "pending" : "not_required",
    requestedBy: user.id,
    approvedBy: requiresApproval ? null : user.id,
    approvedAt: requiresApproval ? null : new Date(),
    notes: notes || null,
    documentRef: documentRef || null,
    source: "user",
  });

  const txnRefs = await db.select({ reference: schema.depositTransactions.reference }).from(schema.depositTransactions);
  const txnId = newId("dtx");
  await db.insert(schema.depositTransactions).values({
    id: txnId,
    reference: nextSequentialReference("DTR", txnRefs.map((t) => t.reference)),
    depositId,
    txnType: "refund_request",
    classification: "none",
    signedAmountCents: 0,
    occurredAt: requestedAt,
    refundId,
    userId: user.id,
    notes: `Refund requested: ${formatCurrency(principal + interest)} (${requiresApproval ? "approval required" : "auto-approved by policy"}).`,
    documentRef: documentRef || null,
    status: "posted",
    source: "user",
  });

  await db
    .update(schema.deposits)
    .set({ status: requiresApproval ? "refund_requested" : "refund_pending", updatedAt: new Date() })
    .where(eq(schema.deposits.id, depositId));
  await writeAudit({
    entityType: "deposit",
    entityId: depositId,
    action: "Refund requested",
    userId: user.id,
    newValue: { refundReference: reference, principal, interest, requiresApproval },
    reason: notes || null,
    relatedRef: reference,
  });

  revalidatePath("/deposits", "layout");
  return done(
    `${reference} created for ${formatCurrency(principal + interest)}. ${requiresApproval ? "A different authorized approver must approve it before payment." : "Policy allows processing without a separate approval."}`,
    validation.warnings,
  );
}

export async function decideRefundAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  const denied = requirePermission(user.role, "approve_refund", "approve or reject refunds");
  if (denied) return fail([denied]);
  const refundId = fdString(fd, "refundId");
  const decision = fdString(fd, "decision");
  const reason = fdString(fd, "reason");

  const [refund] = await db.select().from(schema.depositRefunds).where(eq(schema.depositRefunds.id, refundId));
  if (!refund) return fail(["Refund not found."]);
  if (refund.status !== "requested") return fail(["Only refunds awaiting approval can be decided."]);
  if (refund.requestedBy === user.id) return fail(["Segregation of duties: the requester cannot approve their own refund."]);
  if (decision === "reject" && !reason) return fail(["A rejection reason is required."]);

  if (decision === "reject") {
    await db
      .update(schema.depositRefunds)
      .set({ status: "rejected", approvalStatus: "rejected", rejectionReason: reason, approvedBy: user.id, approvedAt: new Date() })
      .where(eq(schema.depositRefunds.id, refundId));
    await refreshDepositStatus(refund.depositId, user.id);
    await writeAudit({
      entityType: "deposit",
      entityId: refund.depositId,
      action: "Refund rejected",
      userId: user.id,
      previousValue: { status: refund.status },
      newValue: { status: "rejected", reason },
      reason,
      approvalRef: refund.reference,
    });
    revalidatePath("/deposits", "layout");
    return done(`${refund.reference} rejected. No funds moved.`);
  }

  const [deposit] = await db.select().from(schema.deposits).where(eq(schema.deposits.id, refund.depositId));
  const txns = await db.select().from(schema.depositTransactions).where(eq(schema.depositTransactions.depositId, refund.depositId));
  const balances = computeBalances(deposit?.requiredAmountCents ?? 0, txns as TxnLike[]);
  const principal = Math.min(refund.requestedPrincipalCents, Math.max(0, balances.principalOutstandingCents));
  const interest = Math.min(refund.requestedInterestCents, Math.max(0, balances.interestOutstandingCents));
  if (principal + interest <= 0) return fail(["The refundable balance is no longer available. The refund cannot be approved."]);
  if (principal < refund.requestedPrincipalCents || interest < refund.requestedInterestCents) {
    return fail([
      "The available balance is lower than the requested amount. Reject and re-request the refund for the current refundable balance.",
    ]);
  }

  await db
    .update(schema.depositRefunds)
    .set({
      approvedPrincipalCents: principal,
      approvedInterestCents: interest,
      status: "approved",
      approvalStatus: "approved",
      approvedBy: user.id,
      approvedAt: new Date(),
    })
    .where(eq(schema.depositRefunds.id, refundId));
  await db
    .update(schema.deposits)
    .set({ status: "refund_pending", updatedAt: new Date() })
    .where(eq(schema.deposits.id, refund.depositId));
  await writeAudit({
    entityType: "deposit",
    entityId: refund.depositId,
    action: "Refund approved",
    userId: user.id,
    previousValue: { status: refund.status },
    newValue: { status: "approved", principal, interest },
    reason: reason || null,
    approvalRef: refund.reference,
  });
  revalidatePath("/deposits", "layout");
  return done(`${refund.reference} approved for ${formatCurrency(principal + interest)}. The refund now awaits payment processing.`);
}

export async function processRefundAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  const denied = requirePermission(user.role, "process_refund", "process refund payments");
  if (denied) return fail([denied]);
  const refundId = fdString(fd, "refundId");
  const method = fdString(fd, "method") || "eft";
  const completedDate = fdDate(fd, "completedDate");
  const paymentReference = fdString(fd, "paymentReference");
  const notes = fdString(fd, "notes");

  const [refund] = await db.select().from(schema.depositRefunds).where(eq(schema.depositRefunds.id, refundId));
  if (!refund) return fail(["Refund not found."]);
  if (!["approved", "requested"].includes(refund.status)) {
    return fail(["Only an approved refund can be processed. Duplicate completion is not permitted."]);
  }
  if (refund.status === "requested") {
    return fail(["This refund still requires approval by an authorized approver."]);
  }
  if (refund.paymentId) return fail(["This refund already has a payment reference and cannot be paid twice."]);
  const [deposit] = await db.select().from(schema.deposits).where(eq(schema.deposits.id, refund.depositId));
  if (!deposit) return fail(["Deposit not found."]);
  const [lease] = await db.select().from(schema.leases).where(eq(schema.leases.id, deposit.leaseId));
  if (!lease) return fail(["The deposit has no lease mapping."]);
  const txns = await db.select().from(schema.depositTransactions).where(eq(schema.depositTransactions.depositId, deposit.id));
  const balances = computeBalances(deposit.requiredAmountCents, txns as TxnLike[]);
  const principal = refund.approvedPrincipalCents ?? 0;
  const interest = refund.approvedInterestCents ?? 0;
  if (principal > balances.principalOutstandingCents || interest > balances.interestOutstandingCents) {
    return fail(["The approved refund exceeds the current outstanding balance. Reverse or re-request before paying."]);
  }
  if (principal + interest <= 0) return fail(["The refund has no approved amount."]);

  const paymentRefs = await db.select({ reference: schema.payments.reference }).from(schema.payments);
  const txnRefs = await db.select({ reference: schema.depositTransactions.reference }).from(schema.depositTransactions);
  let paymentSeq = paymentRefs.map((p) => p.reference);
  let txnSeq = txnRefs.map((t) => t.reference);
  let firstPaymentId: string | null = null;

  const principalTxnId = newId("dtx");
  let paymentId: string | null = null;
  if (principal > 0) {
    const id = newId("pay");
    const reference = paymentReference || nextSequentialReference("PMT", paymentSeq);
    paymentSeq = [...paymentSeq, reference];
    await db.insert(schema.payments).values({
      id,
      reference,
      tenantId: deposit.tenantId,
      leaseId: deposit.leaseId,
      type: "deposit_refund",
      direction: "out",
      amountCents: principal,
      method,
      receivedAt: completedDate,
      referenceNote: refund.reference,
      status: "cleared",
      simulated: true,
      createdBy: user.id,
      notes: `Simulated deposit refund payment for ${deposit.reference}. No real transfer initiated.`,
    });
    paymentId = id;
    firstPaymentId = id;
    const principalReference = nextSequentialReference("DTR", txnSeq);
    txnSeq = [...txnSeq, principalReference];
    const entryId = await postJournal({
      sourceType: "deposit_refund",
      sourceId: principalTxnId,
      entryDate: completedDate,
      description: `Deposit refund ${deposit.reference} — ${formatCurrency(principal)}`,
      lines: refundLines(deposit.liabilityAccountCode, deposit.cashAccountCode, principal),
      userId: user.id,
      depositId: deposit.id,
    });
    await db.insert(schema.depositTransactions).values({
      id: principalTxnId,
      reference: principalReference,
      depositId: deposit.id,
      txnType: "refund_payment",
      classification: "principal",
      signedAmountCents: -principal,
      occurredAt: completedDate,
      paymentId,
      refundId: refund.id,
      journalEntryId: entryId,
      userId: user.id,
      notes: notes || `Simulated refund via ${method}.`,
      documentRef: refund.reference,
      status: "posted",
      source: "user",
    });
  }
  if (interest > 0) {
    const id = newId("pay");
    const reference = nextSequentialReference("PMT", paymentSeq);
    paymentSeq = [...paymentSeq, reference];
    await db.insert(schema.payments).values({
      id,
      reference,
      tenantId: deposit.tenantId,
      leaseId: deposit.leaseId,
      type: "interest",
      direction: "out",
      amountCents: interest,
      method,
      receivedAt: completedDate,
      referenceNote: refund.reference,
      status: "cleared",
      simulated: true,
      createdBy: user.id,
      notes: `Simulated interest refund for ${deposit.reference}.`,
    });
    const interestTxnId = newId("dtx");
    const interestReference = nextSequentialReference("DTR", txnSeq);
    txnSeq = [...txnSeq, interestReference];
    const entryId = await postJournal({
      sourceType: "interest_payment",
      sourceId: interestTxnId,
      entryDate: completedDate,
      description: `Deposit interest refund ${deposit.reference} — ${formatCurrency(interest)}`,
      lines: interestPaymentLines(deposit.interestPayableAccountCode, deposit.cashAccountCode, interest),
      userId: user.id,
      depositId: deposit.id,
    });
    await db.insert(schema.depositTransactions).values({
      id: interestTxnId,
      reference: interestReference,
      depositId: deposit.id,
      txnType: "interest_payment",
      classification: "interest",
      signedAmountCents: -interest,
      occurredAt: completedDate,
      paymentId: id,
      refundId: refund.id,
      journalEntryId: entryId,
      userId: user.id,
      notes: `Interest included in refund ${refund.reference}.`,
      status: "posted",
      source: "user",
    });
    firstPaymentId = firstPaymentId ?? id;
  }

  await db
    .update(schema.depositRefunds)
    .set({
      status: "completed",
      paymentId: firstPaymentId,
      completedAt: new Date(),
      notes: notes || refund.notes,
    })
    .where(eq(schema.depositRefunds.id, refund.id));

  await refreshDepositStatus(deposit.id, user.id);
  await writeAudit({
    entityType: "deposit",
    entityId: deposit.id,
    action: "Refund processed (simulated)",
    userId: user.id,
    previousValue: { principalOutstandingCents: balances.principalOutstandingCents, status: deposit.status },
    newValue: { refundReference: refund.reference, principal, interest },
    reason: notes || null,
    relatedRef: refund.reference,
  });

  revalidatePath("/deposits", "layout");
  return done(
    `Simulated refund of ${formatCurrency(principal + interest)} completed for ${refund.reference}. Liability released and payment reference recorded.`,
  );
}

/* ---------------------------------- Interest --------------------------------- */

export async function postInterestAccrualAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  const denied = requirePermission(user.role, "process_interest", "post deposit interest");
  if (denied) return fail([denied]);
  const depositId = fdString(fd, "depositId");
  const periodStart = fdDate(fd, "periodStart");
  const periodEnd = fdDate(fd, "periodEnd");
  if (periodEnd <= periodStart) return fail(["The interest period end must be after the period start."]);

  const [deposit] = await db.select().from(schema.deposits).where(eq(schema.deposits.id, depositId));
  if (!deposit) return fail(["Deposit not found."]);
  const rules = await loadRules();
  const rule = getApplicableRule(rules, {
    jurisdiction: deposit.jurisdiction,
    leaseType: deposit.leaseType,
    depositType: deposit.depositType,
    asOf: periodEnd,
  });
  if (!rule?.interestApplicable) return fail(["The applicable rule does not provide for interest on this deposit."]);
  const rates = await loadRateLikes(deposit.jurisdiction, deposit.leaseType, deposit.depositType);
  if (rates.length === 0) return fail(["No effective-dated interest rate is configured for this deposit. Configure the rate history first."]);

  const txns = await db.select().from(schema.depositTransactions).where(eq(schema.depositTransactions.depositId, depositId));
  const overlap = txns.some(
    (t) =>
      t.txnType === "interest_accrual" &&
      t.periodStart &&
      t.periodEnd &&
      periodStart < t.periodEnd &&
      periodEnd > t.periodStart,
  );
  if (overlap) return fail(["An interest accrual already exists that overlaps this period. Duplicate accrual is not permitted."]);
  if (txns.some((t) => t.txnType === "interest_accrual" && t.periodStart === periodStart && t.periodEnd === periodEnd)) {
    return fail(["This interest period has already been accrued."]);
  }

  const preview = calculateInterest({
    periodStart,
    periodEnd,
    principalEvents: principalEventStream(txns as TxnLike[]),
    rates,
  });
  if (preview.missingRate) return fail(["An effective interest rate is missing for part of the period. Configure the rate history."]);
  if (preview.totalCents <= 0) return fail(["The calculated interest for this period is zero. Adjust the period or principal."]);

  const txnRefs = await db.select({ reference: schema.depositTransactions.reference }).from(schema.depositTransactions);
  const txnId = newId("dtx");
  const txnReference = nextSequentialReference("DTR", txnRefs.map((t) => t.reference));
  const entryId = await postJournal({
    sourceType: "interest_accrual",
    sourceId: txnId,
    entryDate: periodEnd,
    description: `Interest accrual ${deposit.reference} ${periodStart} → ${periodEnd}`,
    lines: interestAccrualLines(deposit.interestPayableAccountCode, preview.totalCents),
    userId: user.id,
    depositId,
  });
  await db.insert(schema.depositTransactions).values({
    id: txnId,
    reference: txnReference,
    depositId,
    txnType: "interest_accrual",
    classification: "interest",
    signedAmountCents: preview.totalCents,
    occurredAt: periodEnd,
    journalEntryId: entryId,
    userId: user.id,
    notes: `Interest on eligible principal (${preview.segments.length} segment(s), blended ${(preview.blendedRateBps / 100).toFixed(2)}%).`,
    periodStart,
    periodEnd,
    rateBps: preview.blendedRateBps,
    status: "posted",
    source: "user",
  });
  await db.update(schema.deposits).set({ updatedAt: new Date() }).where(eq(schema.deposits.id, depositId));
  await writeAudit({
    entityType: "deposit",
    entityId: depositId,
    action: "Interest accrued",
    userId: user.id,
    newValue: { periodStart, periodEnd, totalCents: preview.totalCents, blendedRateBps: preview.blendedRateBps },
    relatedRef: txnReference,
  });
  revalidatePath("/deposits", "layout");
  return done(`Interest of ${formatCurrency(preview.totalCents)} accrued and posted as ${txnReference}.`);
}

export async function settleInterestAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  const denied = requirePermission(user.role, "process_interest", "pay or credit deposit interest");
  if (denied) return fail([denied]);
  const depositId = fdString(fd, "depositId");
  const mode = fdString(fd, "mode"); // payment | credit
  const amount = centsFromInput(fd.get("amount"));
  const invoiceId = fdString(fd, "invoiceId");
  const method = fdString(fd, "method") || "eft";
  const date = fdDate(fd, "date");
  const notes = fdString(fd, "notes");

  const [deposit] = await db.select().from(schema.deposits).where(eq(schema.deposits.id, depositId));
  if (!deposit) return fail(["Deposit not found."]);
  const txns = await db.select().from(schema.depositTransactions).where(eq(schema.depositTransactions.depositId, depositId));
  const balances = computeBalances(deposit.requiredAmountCents, txns as TxnLike[]);
  if (amount == null || amount <= 0) return fail(["Enter an interest amount greater than zero."]);
  if (amount > balances.interestOutstandingCents) return fail(["The amount exceeds the posted interest outstanding."]);
  if (mode === "credit" && !invoiceId) return fail(["Select the open rent invoice the interest credit applies to."]);

  let invoice: typeof schema.rentInvoices.$inferSelect | undefined;
  if (mode === "credit") {
    const [found] = await db.select().from(schema.rentInvoices).where(eq(schema.rentInvoices.id, invoiceId));
    if (!found) return fail(["The selected invoice was not found."]);
    if (found.leaseId !== deposit.leaseId) return fail(["The invoice must belong to the deposit's lease."]);
    if (found.status !== "open") return fail(["Only an open rent invoice can receive an interest credit."]);
    invoice = found;
    if (txns.some((t) => t.txnType === "interest_credit" && t.invoiceId === invoice!.id)) {
      return fail(["This invoice has already received an interest credit."]);
    }
  }

  const paymentRefs = await db.select({ reference: schema.payments.reference }).from(schema.payments);
  let paymentId: string | null = null;
  if (mode === "payment") {
    const id = newId("pay");
    await db.insert(schema.payments).values({
      id,
      reference: nextSequentialReference("PMT", paymentRefs.map((p) => p.reference)),
      tenantId: deposit.tenantId,
      leaseId: deposit.leaseId,
      type: "interest",
      direction: "out",
      amountCents: amount,
      method,
      receivedAt: date,
      referenceNote: `Interest settlement ${deposit.reference}`,
      status: "cleared",
      simulated: true,
      createdBy: user.id,
      notes: "Simulated interest payment. No real funds transferred.",
    });
    paymentId = id;
  }

  const txnRefs = await db.select({ reference: schema.depositTransactions.reference }).from(schema.depositTransactions);
  const txnId = newId("dtx");
  const txnReference = nextSequentialReference("DTR", txnRefs.map((t) => t.reference));
  const entryId = await postJournal({
    sourceType: mode === "payment" ? "interest_payment" : "interest_credit",
    sourceId: txnId,
    entryDate: date,
    description: `Interest ${mode === "payment" ? "payment" : "credit"} ${deposit.reference}`,
    lines:
      mode === "payment"
        ? interestPaymentLines(deposit.interestPayableAccountCode, deposit.cashAccountCode, amount)
        : interestCreditLines(deposit.interestPayableAccountCode, deposit.receivableAccountCode ?? "1200", amount),
    userId: user.id,
    depositId,
  });
  await db.insert(schema.depositTransactions).values({
    id: txnId,
    reference: txnReference,
    depositId,
    txnType: mode === "payment" ? "interest_payment" : "interest_credit",
    classification: "interest",
    signedAmountCents: -amount,
    occurredAt: date,
    paymentId,
    invoiceId: invoice?.id ?? null,
    journalEntryId: entryId,
    userId: user.id,
    notes: notes || (mode === "payment" ? `Simulated interest payment via ${method}.` : `Interest credited to ${invoice?.reference}.`),
    status: "posted",
    source: "user",
  });
  if (invoice) {
    await db
      .update(schema.rentInvoices)
      .set({ settlementRef: `${invoice.settlementRef ? `${invoice.settlementRef}, ` : ""}${txnReference}` })
      .where(eq(schema.rentInvoices.id, invoice.id));
  }
  await writeAudit({
    entityType: "deposit",
    entityId: depositId,
    action: mode === "payment" ? "Interest paid (simulated)" : "Interest credited",
    userId: user.id,
    newValue: { amount, invoiceId: invoice?.id ?? null },
    reason: notes || null,
    relatedRef: txnReference,
  });
  revalidatePath("/deposits", "layout");
  return done(`${mode === "payment" ? "Simulated interest payment" : "Interest credit"} of ${formatCurrency(amount)} posted (${txnReference}).`);
}

/* ------------------------------- Corrections ------------------------------- */

export async function reverseTransactionAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  const denied = requirePermission(user.role, "reconcile_deposits", "reverse posted deposit transactions");
  if (denied) return fail([denied]);
  const txnId = fdString(fd, "txnId");
  const reason = fdString(fd, "reason");
  if (!reason) return fail(["A reason is required for a controlled reversal."]);
  const [txn] = await db.select().from(schema.depositTransactions).where(eq(schema.depositTransactions.id, txnId));
  if (!txn) return fail(["Transaction not found."]);
  if (txn.txnType === "reversal") return fail(["A reversal transaction cannot itself be reversed."]);
  const existing = await db
    .select()
    .from(schema.depositTransactions)
    .where(and(eq(schema.depositTransactions.reversalOfTxnId, txn.id), eq(schema.depositTransactions.status, "posted")));
  if (existing.length > 0) return fail(["This transaction has already been reversed."]);
  if (txn.signedAmountCents === 0 && txn.classification === "none") {
    return fail(["This ledger event has no financial effect and does not require a reversal."]);
  }

  const txnRefs = await db.select({ reference: schema.depositTransactions.reference }).from(schema.depositTransactions);
  const reversalId = newId("dtx");
  const reference = nextSequentialReference("DTR", txnRefs.map((t) => t.reference));
  const newJournalId = await postReversingJournal({
    originalEntryId: txn.journalEntryId,
    sourceType: "reversal",
    sourceId: reversalId,
    entryDate: todayISO(),
    description: `Reversal of ${txn.reference} — ${reason}`,
    userId: user.id,
    depositId: txn.depositId,
  });
  await db.insert(schema.depositTransactions).values({
    id: reversalId,
    reference,
    depositId: txn.depositId,
    txnType: "reversal",
    classification: txn.classification,
    signedAmountCents: -txn.signedAmountCents,
    occurredAt: todayISO(),
    journalEntryId: newJournalId,
    userId: user.id,
    notes: `Controlled reversal: ${reason}`,
    relatedTxnId: txn.id,
    reversalOfTxnId: txn.id,
    status: "posted",
    source: "user",
  });
  if (txn.invoiceId) {
    await db
      .update(schema.rentInvoices)
      .set({ status: "open", settlementRef: `Reversed by ${reference}` })
      .where(eq(schema.rentInvoices.id, txn.invoiceId));
  }
  if (txn.refundId && txn.txnType === "refund_payment") {
    await db.update(schema.depositRefunds).set({ status: "reversed" }).where(eq(schema.depositRefunds.id, txn.refundId));
  }
  if (txn.txnType === "refund_payment" || txn.txnType === "interest_payment") {
    await db.update(schema.deposits).set({ reconciliationStatus: "exception" }).where(eq(schema.deposits.id, txn.depositId));
  }
  await refreshDepositStatus(txn.depositId, user.id);
  await writeAudit({
    entityType: "deposit",
    entityId: txn.depositId,
    action: "Transaction reversed",
    userId: user.id,
    previousValue: { txnReference: txn.reference, amountCents: txn.signedAmountCents },
    newValue: { reversalReference: reference, journalEntryId: newJournalId },
    reason,
    relatedRef: txn.reference,
  });
  revalidatePath("/deposits", "layout");
  return done(`Reversal ${reference} posted. The original transaction remains visible and immutable in the audit trail.`);
}

/* ------------------------------- Key devices ------------------------------- */

export async function updateKeyDeviceAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  const denied = requirePermission(user.role, "record_collection", "update key / fob return records");
  if (denied) return fail([denied]);
  const deviceId = fdString(fd, "deviceId");
  const quantityReturned = Number(fdString(fd, "quantityReturned") || "0");
  const returnDate = fdDate(fd, "returnDate");
  const condition = fdString(fd, "returnCondition") || "good";
  const notes = fdString(fd, "notes");
  const [device] = await db.select().from(schema.keyDevices).where(eq(schema.keyDevices.id, deviceId));
  if (!device) return fail(["Device record not found."]);
  if (quantityReturned < 0 || quantityReturned > device.quantityIssued) {
    return fail([`Returned quantity must be between 0 and ${device.quantityIssued}.`]);
  }
  if (quantityReturned < device.quantityReturned) {
    return fail(["Returned quantity cannot be reduced. Use a documented correction workflow."]);
  }
  await db
    .update(schema.keyDevices)
    .set({ quantityReturned, returnDate, returnCondition: condition, notes: notes || device.notes })
    .where(eq(schema.keyDevices.id, device.id));
  await writeAudit({
    entityType: "deposit",
    entityId: device.depositId,
    action: "Access device return recorded",
    userId: user.id,
    previousValue: { quantityReturned: device.quantityReturned, condition: device.returnCondition },
    newValue: { quantityReturned, condition, returnDate },
    reason: notes || null,
    relatedRef: device.identifier,
  });
  revalidatePath("/deposits", "layout");
  return done(`Return updated for ${device.identifier}. Refund eligibility re-evaluated using the documented replacement cost.`);
}

/* ------------------------------- Reconciliation ------------------------------- */

export async function reconcileDepositAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  const denied = requirePermission(user.role, "reconcile_deposits", "reconcile deposit records");
  if (denied) return fail([denied]);
  const depositId = fdString(fd, "depositId");
  const status = fdString(fd, "status");
  const notes = fdString(fd, "notes");
  if (!["reconciled", "exception", "under_review", "not_reviewed"].includes(status)) return fail(["Select a valid reconciliation status."]);
  if (status === "reconciled") {
    const [deposit] = await db.select().from(schema.deposits).where(eq(schema.deposits.id, depositId));
    if (!deposit) return fail(["Deposit not found."]);
    const txns = await db.select().from(schema.depositTransactions).where(eq(schema.depositTransactions.depositId, depositId));
    const balances = computeBalances(deposit.requiredAmountCents, txns as TxnLike[]);
    const missingJournals = txns.filter((t) => t.classification !== "none" && !t.journalEntryId);
    if (missingJournals.length > 0) {
      return fail([
        `${missingJournals.length} posted ledger transaction(s) have no accounting entry. Post or reverse them before marking the deposit reconciled. The accounting balance must never be forced to match.`,
      ]);
    }
    void balances;
  }
  await db
    .update(schema.deposits)
    .set({ reconciliationStatus: status, lastReconciledAt: new Date(), updatedAt: new Date() })
    .where(eq(schema.deposits.id, depositId));
  await writeAudit({
    entityType: "deposit",
    entityId: depositId,
    action: "Reconciliation reviewed",
    userId: user.id,
    newValue: { status },
    reason: notes || null,
  });
  revalidatePath("/deposits", "layout");
  return done(`Reconciliation status updated to ${status.replaceAll("_", " ")}.`);
}

export async function updateReconciliationItemAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  const denied = requirePermission(user.role, "reconcile_deposits", "manage reconciliation exceptions");
  if (denied) return fail([denied]);
  const itemId = fdString(fd, "itemId");
  const status = fdString(fd, "status");
  const notes = fdString(fd, "resolutionNotes");
  if (!["open", "under_review", "resolved", "correction_required"].includes(status)) return fail(["Select a valid status."]);
  if (status === "resolved" && !notes) return fail(["Resolution notes are required before resolving a discrepancy."]);
  const [item] = await db.select().from(schema.reconciliationItems).where(eq(schema.reconciliationItems.id, itemId));
  if (!item) return fail(["Reconciliation item not found."]);
  await db
    .update(schema.reconciliationItems)
    .set({
      status,
      resolutionNotes: notes || item.resolutionNotes,
      reviewerId: user.id,
      resolvedAt: status === "resolved" ? new Date() : null,
    })
    .where(eq(schema.reconciliationItems.id, itemId));
  await writeAudit({
    entityType: "reconciliation",
    entityId: item.id,
    action: "Reconciliation item updated",
    userId: user.id,
    previousValue: { status: item.status },
    newValue: { status, notes },
    reason: notes || null,
    relatedRef: item.reference,
  });
  revalidatePath("/deposits", "layout");
  return done(`${item.reference} marked ${status.replaceAll("_", " ")}. No accounting balance was adjusted.`);
}

/* -------------------------------- Close / cancel -------------------------------- */

export async function closeDepositAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  const denied = requirePermission(user.role, "reconcile_deposits", "close deposit records");
  if (denied) return fail([denied]);
  const depositId = fdString(fd, "depositId");
  const reason = fdString(fd, "reason");
  const [deposit] = await db.select().from(schema.deposits).where(eq(schema.deposits.id, depositId));
  if (!deposit) return fail(["Deposit not found."]);
  const txns = await db.select().from(schema.depositTransactions).where(eq(schema.depositTransactions.depositId, depositId));
  const refunds = await db.select().from(schema.depositRefunds).where(eq(schema.depositRefunds.depositId, depositId));
  const balances = computeBalances(deposit.requiredAmountCents, txns as TxnLike[]);
  if (balances.principalOutstandingCents !== 0 || balances.interestOutstandingCents !== 0) {
    return fail([
      `The deposit still has ${formatCurrency(balances.principalOutstandingCents)} principal and ${formatCurrency(balances.interestOutstandingCents)} interest outstanding. Settle the obligation before closing.`,
    ]);
  }
  if (refunds.some((r) => ["requested", "approved", "processing"].includes(r.status))) {
    return fail(["An open refund request must be completed or rejected before closing the deposit."]);
  }
  await db
    .update(schema.deposits)
    .set({ status: "closed", closedAt: todayISO(), updatedAt: new Date(), notes: reason || deposit.notes })
    .where(eq(schema.deposits.id, depositId));
  await writeAudit({
    entityType: "deposit",
    entityId: depositId,
    action: "Deposit closed",
    userId: user.id,
    previousValue: { status: deposit.status },
    newValue: { status: "closed" },
    reason: reason || null,
  });
  revalidatePath("/deposits", "layout");
  return done(`${deposit.reference} closed. Finalized transactions remain in the ledger and audit trail.`);
}

export async function cancelDepositAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  const denied = requirePermission(user.role, "edit_draft", "cancel draft or expected deposits");
  if (denied) return fail([denied]);
  const depositId = fdString(fd, "depositId");
  const reason = fdString(fd, "reason");
  if (!reason) return fail(["A cancellation reason is required."]);
  const [deposit] = await db.select().from(schema.deposits).where(eq(schema.deposits.id, depositId));
  if (!deposit) return fail(["Deposit not found."]);
  if (!["draft", "expected"].includes(deposit.status)) {
    return fail(["Only draft or expected deposits without collections can be cancelled. Finalized transactions cannot be deleted."]);
  }
  const txns = await db.select().from(schema.depositTransactions).where(eq(schema.depositTransactions.depositId, depositId));
  if (txns.some((t) => t.classification === "principal" && t.signedAmountCents > 0)) {
    return fail(["This deposit has recorded collections and cannot be cancelled. Refund or apply the funds first."]);
  }
  await db
    .update(schema.deposits)
    .set({ status: "cancelled", cancelledAt: todayISO(), cancellationReason: reason, updatedAt: new Date() })
    .where(eq(schema.deposits.id, depositId));
  await writeAudit({
    entityType: "deposit",
    entityId: depositId,
    action: "Deposit cancelled",
    userId: user.id,
    previousValue: { status: deposit.status },
    newValue: { status: "cancelled", reason },
    reason,
  });
  revalidatePath("/deposits", "layout");
  return done(`${deposit.reference} cancelled. No finalized collection or refund transaction was erased.`);
}

/* -------------------------------- Configuration -------------------------------- */

export async function saveDepositRuleAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  const denied = requirePermission(user.role, "configure_rules", "configure deposit rules");
  if (denied) return fail([denied]);
  const jurisdiction = fdString(fd, "jurisdiction");
  const leaseType = fdString(fd, "leaseType");
  const depositType = fdString(fd, "depositType");
  const effectiveFrom = fdDate(fd, "effectiveFrom");
  const collectionPermitted = fd.get("collectionPermitted") === "on";
  const maxAmount = centsFromInput(fd.get("maxAmount"));
  const maxMultiple = fdString(fd, "maxMultipleOfRent");
  const calculationMethod = fdString(fd, "calculationMethod") || "fixed";
  const interestApplicable = fd.get("interestApplicable") === "on";
  const interestFrequency = fdString(fd, "interestFrequency") || (interestApplicable ? "annual" : "none");
  const approvalRequired = fd.get("approvalRequired") === "on";
  const refundApprovalRequired = fd.get("refundApprovalRequired") === "on";
  const purposes = APPLICATION_PURPOSES.filter((p) => fd.getAll("purposes").includes(p));
  const validationMessage = fdString(fd, "validationMessage");
  const legalReference = fdString(fd, "legalReference");
  const refundConditions = fdString(fd, "refundConditions");
  const requiredDocuments = fdString(fd, "requiredDocuments")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const notes = fdString(fd, "notes");
  const roundingMode = fdString(fd, "roundingMode") || "half_up_cent";

  const errors: string[] = [];
  if (!JURISDICTIONS.some((j) => j.code === jurisdiction)) errors.push("Select a valid jurisdiction.");
  if (!LEASE_TYPES.some((l) => l.code === leaseType)) errors.push("Select a valid lease type.");
  if (!DEPOSIT_TYPES.includes(depositType as (typeof DEPOSIT_TYPES)[number])) errors.push("Select a valid deposit type.");
  if (!isISODate(effectiveFrom)) errors.push("Enter a valid effective date.");
  if (!validationMessage) errors.push("A validation message is required — it is shown whenever collection is blocked.");
  if (!legalReference) errors.push("A legal / policy reference is required.");
  if (!refundConditions) errors.push("Refund conditions are required.");
  if (collectionPermitted && maxAmount == null && !maxMultiple) {
    errors.push("A permitted collection requires a maximum amount or a rent-multiple calculation method.");
  }
  if (maxMultiple) {
    const num = Number(maxMultiple);
    if (!Number.isFinite(num) || num <= 0) errors.push("The rent multiple must be a positive percentage (e.g. 100 for one month).");
  }
  if (errors.length) return fail(errors);

  const existing = await db.select().from(schema.depositRules);
  const current = getApplicableRule(
    existing.map(ruleRowToRule),
    { jurisdiction, leaseType, depositType, asOf: effectiveFrom },
  );
  if (current && current.effectiveFrom === effectiveFrom) {
    return fail([
      `A rule version for this combination already begins on ${effectiveFrom}. Choose a later effective date to create a new version — history is never overwritten.`,
    ]);
  }
  if (current && effectiveFrom < current.effectiveFrom) {
    return fail([
      `The effective date must be after the current version (${current.effectiveFrom}). Back-dated rule versions are not permitted because historical records must remain evaluated under the rules that applied then.`,
    ]);
  }
  if (current) {
    await db
      .update(schema.depositRules)
      .set({ effectiveTo: addDaysISO(effectiveFrom, -1) })
      .where(eq(schema.depositRules.id, current.id));
  }
  await db.insert(schema.depositRules).values({
    id: newId("rule"),
    jurisdiction,
    leaseType,
    depositType,
    collectionPermitted,
    maxAmountCents: maxAmount,
    maxMultipleOfRentBps: maxMultiple ? Math.round(Number(maxMultiple) * 100) : null,
    calculationMethod,
    refundConditions,
    interestApplicable,
    interestMethod: interestApplicable ? "simple_actual_365" : "none",
    interestFrequency,
    applicationPurposes: purposes,
    requiredDocuments,
    approvalRequired,
    refundApprovalRequired,
    roundingMode,
    effectiveFrom,
    effectiveTo: null,
    validationMessage,
    legalReference,
    notes: notes || null,
    configuredBy: user.id,
  });
  await writeAudit({
    entityType: "deposit_rule",
    entityId: `${jurisdiction}-${leaseType}-${depositType}-${effectiveFrom}`,
    action: "Deposit rule version created",
    userId: user.id,
    previousValue: current ? { id: current.id, effectiveFrom: current.effectiveFrom, maxAmountCents: current.maxAmountCents } : null,
    newValue: { jurisdiction, leaseType, depositType, collectionPermitted, maxAmountCents: maxAmount, effectiveFrom, interestApplicable },
    reason: notes || null,
  });
  revalidatePath("/deposits", "layout");
  return done(
    `New effective-dated rule version saved for ${jurisdiction} ${leaseType} / ${depositTypeLabel(depositType)}, effective ${effectiveFrom}. Historical records remain evaluated under their original rules.`,
  );
}

export async function saveInterestRateAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  const denied = requirePermission(user.role, "configure_rules", "configure deposit interest rates");
  if (denied) return fail([denied]);
  const jurisdiction = fdString(fd, "jurisdiction");
  const leaseType = fdString(fd, "leaseType");
  const depositType = fdString(fd, "depositType");
  const effectiveFrom = fdDate(fd, "effectiveFrom");
  const ratePercent = Number(fdString(fd, "annualRate"));
  const source = fdString(fd, "source");
  const notes = fdString(fd, "notes");
  if (!Number.isFinite(ratePercent) || ratePercent < 0 || ratePercent > 50) return fail(["Enter a valid annual interest rate between 0% and 50%."]);
  if (!source) return fail(["Record the statutory or policy source for the rate."]);
  const rows = await db.select().from(schema.depositInterestRates);
  const match = rows.find(
    (r) =>
      r.jurisdiction === jurisdiction &&
      r.leaseType === leaseType &&
      r.depositType === depositType &&
      r.effectiveFrom === effectiveFrom,
  );
  if (match) return fail(["A rate already exists for that combination and effective date. Rate history cannot be overwritten."]);
  const latest = rows
    .filter((r) => r.jurisdiction === jurisdiction && r.leaseType === leaseType && r.depositType === depositType)
    .sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? 1 : -1))[0];
  if (latest && effectiveFrom <= latest.effectiveFrom) {
    return fail([
      `The new rate must take effect after the latest rate (${latest.effectiveFrom}). Historical rate periods cannot be rewritten.`,
    ]);
  }
  const overlapping = rows
    .filter((r) => r.jurisdiction === jurisdiction && r.leaseType === leaseType && r.depositType === depositType)
    .filter((r) => r.effectiveFrom < effectiveFrom && (!r.effectiveTo || r.effectiveTo >= effectiveFrom));
  for (const r of overlapping) {
    await db
      .update(schema.depositInterestRates)
      .set({ effectiveTo: addDaysISO(effectiveFrom, -1) })
      .where(eq(schema.depositInterestRates.id, r.id));
  }
  await db.insert(schema.depositInterestRates).values({
    id: newId("rate"),
    jurisdiction,
    leaseType,
    depositType,
    annualRateBps: Math.round(ratePercent * 100),
    effectiveFrom,
    effectiveTo: null,
    source,
    notes: notes || null,
  });
  await writeAudit({
    entityType: "interest_rate",
    entityId: `${jurisdiction}-${leaseType}-${depositType}-${effectiveFrom}`,
    action: "Interest rate version created",
    userId: user.id,
    newValue: { annualRateBps: Math.round(ratePercent * 100), effectiveFrom, source },
    reason: notes || null,
  });
  revalidatePath("/deposits", "layout");
  return done(`Interest rate of ${ratePercent.toFixed(2)}% saved effective ${effectiveFrom}.`);
}

export async function saveAccountMappingsAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  const denied = requirePermission(user.role, "configure_accounts", "configure deposit account mappings");
  if (denied) return fail([denied]);
  const accounts = await db.select().from(schema.chartOfAccounts);
  const mapping: Record<string, { liability: string; cash: string; receivable: string }> = {};
  for (const type of DEPOSIT_TYPES) {
    const liability = fdString(fd, `liability_${type}`) || LIABILITY_ACCOUNT_BY_TYPE[type];
    const cash = fdString(fd, "cashAccount") || "1020";
    const receivable = fdString(fd, "receivableAccount") || "1200";
    const liabilityAccount = accounts.find((a) => a.code === liability);
    if (!liabilityAccount || liabilityAccount.type !== "liability") return fail([`Select a liability account for ${depositTypeLabel(type)}.`]);
    mapping[type] = { liability, cash, receivable };
  }
  const cashAccount = accounts.find((a) => a.code === (fdString(fd, "cashAccount") || "1020"));
  if (!cashAccount || cashAccount.type !== "asset") return fail(["Select a valid bank or cash account."]);
  await db
    .insert(schema.appMeta)
    .values({ key: "deposit_account_mappings", value: JSON.stringify(mapping) })
    .onConflictDoUpdate({ target: schema.appMeta.key, set: { value: JSON.stringify(mapping) } });
  await writeAudit({
    entityType: "configuration",
    entityId: "deposit_account_mappings",
    action: "Deposit account mappings updated",
    userId: user.id,
    newValue: mapping,
    reason: fdString(fd, "reason") || null,
  });
  revalidatePath("/deposits", "layout");
  return done("Deposit account mappings saved. New deposit records will default to these accounts.");
}
