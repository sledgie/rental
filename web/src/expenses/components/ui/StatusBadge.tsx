import { Badge } from "./Badge";
import type { DueStatus, ProviderPaymentStatus, RecoveryStatus, ScheduleStatus } from "../../types";
import {
  DUE_STATUS_LABEL,
  PAYMENT_STATUS_LABEL,
  RECOVERY_STATUS_LABEL,
} from "../../utils/bills";

export function DueBadge({ status }: { status: DueStatus }) {
  const tone =
    status === "overdue"
      ? "rose"
      : status === "due_soon"
        ? "amber"
        : status === "settled"
          ? "emerald"
          : "sky";
  return (
    <Badge tone={tone} dot>
      {DUE_STATUS_LABEL[status]}
    </Badge>
  );
}

export function PaymentBadge({ status }: { status: ProviderPaymentStatus }) {
  const tone =
    status === "paid" ? "emerald" : status === "partially_paid" ? "amber" : "orange";
  return <Badge tone={tone}>{PAYMENT_STATUS_LABEL[status]}</Badge>;
}

export function RecoveryBadge({ status }: { status: RecoveryStatus }) {
  const tone =
    status === "fully_recovered"
      ? "emerald"
      : status === "partially_recovered"
        ? "violet"
        : status === "recovery_pending"
          ? "sky"
          : "neutral";
  return <Badge tone={tone}>{RECOVERY_STATUS_LABEL[status]}</Badge>;
}

export function ScheduleBadge({ status }: { status: ScheduleStatus }) {
  const tone = status === "active" ? "teal" : status === "paused" ? "amber" : "neutral";
  const label = status === "active" ? "Active" : status === "paused" ? "Paused" : "Inactive";
  return (
    <Badge tone={tone} dot>
      {label}
    </Badge>
  );
}
