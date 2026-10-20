import type {
  Bill,
  DueStatus,
  ProviderPayment,
  ProviderPaymentStatus,
  RecoveryStatus,
  TenantAllocation,
  TenantRecovery,
} from "../types";
import { daysBetween, round2, todayISO } from "./format";

export function sumPayments(payments: ProviderPayment[], billId: string): number {
  return round2(
    payments.filter((p) => p.billId === billId).reduce((s, p) => s + p.amount, 0),
  );
}

export function sumRecoveries(
  recoveries: TenantRecovery[],
  billId: string,
  tenantId?: string,
): number {
  return round2(
    recoveries
      .filter((r) => r.billId === billId && (!tenantId || r.tenantId === tenantId))
      .reduce((s, r) => s + r.amount, 0),
  );
}

export function allocationShare(billAmount: number, allocation: TenantAllocation, expectedAmount?: number): number {
  const basis =
    allocation.calculationBasis === "expected" && expectedAmount != null
      ? expectedAmount
      : billAmount;

  switch (allocation.method) {
    case "none":
      return 0;
    case "percentage":
      return round2(basis * ((allocation.percentage ?? 0) / 100));
    case "fixed":
      return round2(allocation.fixedAmount ?? 0);
    case "manual":
      return round2(allocation.manualAmount ?? 0);
    case "equal_split":
      return 0;
    default:
      return 0;
  }
}

export function resolvedAllocations(
  billAmount: number,
  allocations: TenantAllocation[],
  expectedAmount?: number,
): Array<TenantAllocation & { share: number }> {
  const equalOnes = allocations.filter((a) => a.method === "equal_split");
  const equalShare =
    equalOnes.length > 0 ? round2(billAmount / equalOnes.length) : 0;

  return allocations.map((a) => ({
    ...a,
    share:
      a.method === "equal_split"
        ? equalShare
        : allocationShare(billAmount, a, expectedAmount),
  }));
}

export function totalTenantShare(bill: Bill, expectedAmount?: number): number {
  return round2(
    resolvedAllocations(bill.amount, bill.allocations, expectedAmount).reduce(
      (s, a) => s + a.share,
      0,
    ),
  );
}

export function landlordShare(bill: Bill): number {
  return round2(bill.amount - totalTenantShare(bill));
}

export function providerBalance(bill: Bill, payments: ProviderPayment[]): number {
  return round2(bill.amount - sumPayments(payments, bill.id));
}

export function recoveryOutstanding(
  bill: Bill,
  recoveries: TenantRecovery[],
): number {
  return round2(totalTenantShare(bill) - sumRecoveries(recoveries, bill.id));
}

export function providerStatus(
  bill: Bill,
  payments: ProviderPayment[],
): ProviderPaymentStatus {
  const paid = sumPayments(payments, bill.id);
  if (paid <= 0) return "unpaid";
  if (paid + 0.001 < bill.amount) return "partially_paid";
  return "paid";
}

export function dueStatus(
  bill: Bill,
  payments: ProviderPayment[],
  dueSoonDays = 7,
): DueStatus {
  if (providerStatus(bill, payments) === "paid") return "settled";
  const days = daysBetween(todayISO(), bill.dueDate);
  if (days < 0) return "overdue";
  if (days <= dueSoonDays) return "due_soon";
  return "upcoming";
}

export function recoveryStatus(
  bill: Bill,
  recoveries: TenantRecovery[],
): RecoveryStatus {
  const share = totalTenantShare(bill);
  if (share <= 0) return "not_recoverable";
  const recovered = sumRecoveries(recoveries, bill.id);
  if (recovered <= 0) return "recovery_pending";
  if (recovered + 0.001 < share) return "partially_recovered";
  return "fully_recovered";
}

export function isReminderActive(
  bill: Bill,
  payments: ProviderPayment[],
): boolean {
  if (providerStatus(bill, payments) === "paid") return false;
  const days = daysBetween(todayISO(), bill.dueDate);
  if (days < 0) return true;
  return bill.reminderDays.some((d) => days <= d);
}

export const DUE_STATUS_LABEL: Record<DueStatus, string> = {
  upcoming: "Upcoming",
  due_soon: "Due Soon",
  overdue: "Overdue",
  settled: "Settled",
};

export const PAYMENT_STATUS_LABEL: Record<ProviderPaymentStatus, string> = {
  unpaid: "Unpaid",
  partially_paid: "Partially Paid",
  paid: "Paid",
};

export const RECOVERY_STATUS_LABEL: Record<RecoveryStatus, string> = {
  not_recoverable: "Not Recoverable",
  recovery_pending: "Recovery Pending",
  partially_recovered: "Partially Recovered",
  fully_recovered: "Fully Recovered",
};

export function allocationsExceedBill(
  amount: number,
  allocations: TenantAllocation[],
): boolean {
  const total = resolvedAllocations(amount, allocations).reduce(
    (s, a) => s + a.share,
    0,
  );
  return total > amount + 0.001;
}
