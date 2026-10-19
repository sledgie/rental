import {
  Ban,
  Check,
  CircleDollarSign,
  Clock,
  FileClock,
  FilePlus2,
  type LucideIcon,
} from "lucide-react";
import type { InvoiceStatus } from "@inv/types/invoice";
import { statusLabels } from "@inv/types/invoice";
import { cn } from "@inv/utils/cn";

interface Tone {
  icon: LucideIcon;
  chip: string;
  dot: string;
  row: string;
}

const tones: Record<InvoiceStatus, Tone> = {
  paid: {
    icon: Check,
    chip: "border-paid/25 bg-paid/10 text-paid",
    dot: "bg-paid",
    row: "text-paid",
  },
  partially_paid: {
    icon: CircleDollarSign,
    chip: "border-info/25 bg-info/10 text-info-ink",
    dot: "bg-info",
    row: "text-info-ink",
  },
  unpaid: {
    icon: Clock,
    chip: "border-unpaid/25 bg-unpaid/10 text-unpaid",
    dot: "bg-unpaid",
    row: "text-unpaid",
  },
  pending_approval: {
    icon: FileClock,
    chip: "border-unpaid/25 bg-unpaid/10 text-unpaid",
    dot: "bg-unpaid",
    row: "text-unpaid",
  },
  overdue: {
    icon: FileClock,
    chip: "border-overdue/30 bg-overdue/10 text-overdue",
    dot: "bg-overdue",
    row: "text-overdue",
  },
  draft: {
    icon: FilePlus2,
    chip: "border-line-strong bg-surface-3 text-draft",
    dot: "bg-draft",
    row: "text-draft",
  },
  void: {
    icon: Ban,
    chip: "border-line-strong bg-surface-2 text-ink-faint line-through decoration-1",
    dot: "bg-ink-faint",
    row: "text-ink-faint",
  },
};

export const statusTone = (status: InvoiceStatus): Tone => tones[status];

export function InvoiceStatusBadge({
  status,
  size = "md",
  className,
}: {
  status: InvoiceStatus;
  size?: "sm" | "md";
  className?: string;
}) {
  const tone = tones[status];
  const Icon = tone.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border font-medium whitespace-nowrap",
        tone.chip,
        size === "sm" ? "px-1.5 py-0.5 text-[11px]" : "px-2 py-1 text-[11.5px]",
        className
      )}
    >
      <Icon className={size === "sm" ? "size-3" : "size-3.5"} strokeWidth={2.2} />
      {statusLabels[status]}
    </span>
  );
}
