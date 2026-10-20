import type { DerivedLeaseStatus } from "../data/selectors";
import type {
  MaintenanceStatus,
  PartyRole,
  PaymentStatus,
  ProjectStatus,
  TxType,
  UnitCondition,
  UnitStatus,
} from "../data/types";
import type { Tone } from "../components/ui/primitives";
import { Pill } from "../components/ui/primitives";

/* Unit occupancy status — deliberately distinct from lease status. */
export const unitStatusTone: Record<UnitStatus, Tone> = {
  Occupied: "jade",
  Vacant: "azure",
  Reserved: "cyan",
  "Under Maintenance": "amber",
  Inactive: "muted",
};

export const unitStatusHint: Record<UnitStatus, string> = {
  Occupied: "A tenant is in occupation under an applicable lease relationship",
  Vacant: "Available to let — no one in occupation",
  Reserved: "Held for an incoming tenant (deposit or signed-but-unstarted lease)",
  "Under Maintenance": "Out of service for repairs or renovation",
  Inactive: "Withdrawn from the rental programme; history preserved",
};

export const leaseTone: Record<DerivedLeaseStatus, Tone> = {
  Active: "jade",
  Expiring: "amber",
  Pending: "cyan",
  Draft: "neutral",
  Expired: "rose",
  Terminated: "muted",
  None: "muted",
};

export const leaseStatusLabel: Record<DerivedLeaseStatus, string> = {
  Active: "Active",
  Expiring: "Expiring",
  Pending: "Pending",
  Draft: "Draft",
  Expired: "Expired",
  Terminated: "Terminated",
  None: "No current lease",
};

export const financeTone: Record<string, Tone> = {
  Clear: "jade",
  Outstanding: "amber",
  Overdue: "rose",
  "No Activity": "muted",
};

export const maintenanceTone: Record<MaintenanceStatus, Tone> = {
  Open: "azure",
  "In Progress": "cyan",
  Completed: "jade",
  Overdue: "rose",
};

export const projectTone: Record<ProjectStatus, Tone> = {
  Planning: "neutral",
  Active: "azure",
  "On Hold": "amber",
  Completed: "jade",
};

export const priorityTone: Record<string, Tone> = {
  Low: "muted",
  Medium: "azure",
  High: "amber",
  Urgent: "rose",
};

export const conditionTone: Record<UnitCondition, Tone> = {
  Excellent: "jade",
  Good: "azure",
  Fair: "amber",
  "Needs Work": "rose",
};

export const roleTone: Record<PartyRole, Tone> = {
  "Main Tenant": "azure",
  "Co-Tenant": "cyan",
  Guarantor: "neutral",
  Occupant: "muted",
};

export const paymentTone: Record<PaymentStatus, Tone> = {
  Paid: "jade",
  Partial: "amber",
  Unpaid: "rose",
  "Not Due": "neutral",
};

export const txStatusTone: Record<string, Tone> = {
  Posted: "neutral",
  Draft: "muted",
  Void: "muted",
  Scheduled: "cyan",
};

export interface TxMeta {
  label: string;
  tone: Tone;
  /** debit = tenant owes, credit = reduces balance, expense = owner cost */
  direction: "debit" | "credit" | "payment" | "expense";
}

export const txMeta: Record<TxType, TxMeta> = {
  "Rent Charge": { label: "Rent charge", tone: "azure", direction: "debit" },
  "Rent Payment": { label: "Rent payment", tone: "jade", direction: "payment" },
  "Late Fee": { label: "Late fee", tone: "amber", direction: "debit" },
  "Utility Charge": { label: "Utility", tone: "cyan", direction: "debit" },
  "Parking Fee": { label: "Parking", tone: "cyan", direction: "debit" },
  "Maintenance Charge": { label: "Maintenance recharge", tone: "amber", direction: "debit" },
  "Maintenance Expense": { label: "Maintenance expense", tone: "rose", direction: "expense" },
  Credit: { label: "Credit", tone: "jade", direction: "credit" },
  Adjustment: { label: "Adjustment", tone: "neutral", direction: "credit" },
};

export const inspectionTone: Record<string, Tone> = {
  Passed: "jade",
  Scheduled: "cyan",
  Overdue: "rose",
};

export function UnitStatusPill({ status, pulse }: { status: UnitStatus; pulse?: boolean }) {
  return (
    <Pill tone={unitStatusTone[status]} dot pulse={pulse} title={unitStatusHint[status]}>
      {status}
    </Pill>
  );
}

export function LeaseStatusPill({ status }: { status: DerivedLeaseStatus }) {
  return <Pill tone={leaseTone[status]} dot={status !== "None"}>{leaseStatusLabel[status]}</Pill>;
}
