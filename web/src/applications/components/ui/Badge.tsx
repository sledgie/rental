import type { ReactNode } from "react";
import { cn } from "../../utils/cn";
import type {
  ApplicationStatus,
  DocumentStatus,
  ScreeningStatus,
  UnitStatus,
} from "../../data/types";
import { IconSparkle } from "../icons";

type Tone =
  | "neutral"
  | "blue"
  | "indigo"
  | "amber"
  | "emerald"
  | "red"
  | "violet"
  | "slate"
  | "cyan";

const tones: Record<Tone, string> = {
  neutral: "bg-u-s3 text-u-ink2 border-u-line2",
  blue: "bg-u-blue/12 text-u-blue border-u-blue/30",
  indigo: "bg-u-accent/14 text-u-accent border-u-accent/30",
  amber: "bg-u-warn/12 text-u-warn border-u-warn/30",
  emerald: "bg-u-ok/12 text-u-ok border-u-ok/30",
  red: "bg-u-danger/12 text-u-danger border-u-danger/30",
  violet: "bg-u-violet/12 text-u-violet border-u-violet/30",
  slate: "bg-u-muted/12 text-u-muted border-u-muted/30",
  cyan: "bg-u-blue/12 text-u-blue border-u-blue/30",
};

export function Badge({
  children,
  tone = "neutral",
  className,
  dot,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium leading-4",
        tones[tone],
        className,
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />}
      {children}
    </span>
  );
}

export const APPLICATION_STATUS_TONE: Record<ApplicationStatus, Tone> = {
  Draft: "slate",
  New: "cyan",
  "Under Review": "indigo",
  "Awaiting Information": "amber",
  Approved: "emerald",
  Declined: "red",
  Waitlisted: "violet",
  Withdrawn: "slate",
  Archived: "neutral",
};

export const DOCUMENT_STATUS_TONE: Record<DocumentStatus, Tone> = {
  Received: "blue",
  "Under Review": "amber",
  Accepted: "emerald",
  "Needs Replacement": "red",
  Archived: "slate",
};

export const SCREENING_STATUS_TONE: Record<ScreeningStatus, Tone> = {
  "Not Started": "slate",
  "In Progress": "indigo",
  "Waiting for Information": "amber",
  Completed: "emerald",
  "Not Applicable": "neutral",
};

const UNIT_STATUS_TONE: Record<UnitStatus, Tone> = {
  Vacant: "emerald",
  Occupied: "blue",
  Notice: "amber",
  Renovation: "violet",
  Reserved: "cyan",
};

export const ApplicationStatusBadge = ({ status }: { status: ApplicationStatus }) => (
  <Badge tone={APPLICATION_STATUS_TONE[status]} dot>
    {status}
  </Badge>
);

export const DocumentStatusBadge = ({ status }: { status: DocumentStatus }) => (
  <Badge tone={DOCUMENT_STATUS_TONE[status]}>{status}</Badge>
);

export const ScreeningStatusBadge = ({ status }: { status: ScreeningStatus }) => (
  <Badge tone={SCREENING_STATUS_TONE[status]}>{status}</Badge>
);

export const UnitStatusBadge = ({ status }: { status: UnitStatus }) => (
  <Badge tone={UNIT_STATUS_TONE[status]}>{status}</Badge>
);

/** Marks a control as simulated in the prototype (no real backend attached). */
export function MockTag({
  label = "Simulated",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded border border-dashed border-u-warn/45 bg-u-warn/8 px-1.5 py-px text-[10px] font-medium tracking-wide text-u-warn/90 uppercase",
        className,
      )}
    >
      <IconSparkle width={10} height={10} />
      {label}
    </span>
  );
}

export function RestrictedTag({ label = "Restricted" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded border border-u-danger/35 bg-u-danger/8 px-1.5 py-px text-[10px] font-medium tracking-wide text-u-danger/90 uppercase">
      {label}
    </span>
  );
}
