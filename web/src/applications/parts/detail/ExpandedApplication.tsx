import { useState } from "react";
import { useStore, leaseOf, propertyOf, unitOf, primaryApplicantOf, partiesOf } from "../../state/store";
import { formatDate } from "../../lib/format";
import { Button } from "../../components/ui/Button";
import { Badge, MockTag } from "../../components/ui/Badge";
import { IconChevronUp, IconLock } from "../../components/icons";
import { cn } from "../../utils/cn";
import { OverviewSection } from "./OverviewSection";
import { ApplicantsSection } from "./ApplicantsSection";
import { PropertyUnitSection } from "./PropertyUnitSection";
import { ScreeningSection } from "./ScreeningSection";
import { DocumentsSection } from "./DocumentsSection";
import { DecisionSection } from "./DecisionSection";
import { CommunicationsSection } from "./CommunicationsSection";
import { ActivitySection } from "./ActivitySection";
import { DialogHost } from "./DialogHost";
import type { DialogRequest } from "./dialogTypes";

const SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "applicants", label: "Applicants" },
  { id: "property", label: "Property & Unit" },
  { id: "screening", label: "Screening" },
  { id: "documents", label: "Documents" },
  { id: "decision", label: "Status & Decision" },
  { id: "communications", label: "Communications" },
  { id: "activity", label: "Activity" },
];

export function ExpandedApplication({
  applicationId,
  onCollapse,
}: {
  applicationId: string;
  onCollapse: () => void;
}) {
  const { state, can } = useStore();
  const [dialog, setDialog] = useState<DialogRequest | null>(null);
  const [dialogSeq, setDialogSeq] = useState(0);
  const open = (d: DialogRequest) => {
    setDialog(d);
    setDialogSeq((n) => n + 1);
  };
  const [active, setActive] = useState("overview");
  const app = state.applications.find((a) => a.id === applicationId);
  if (!app) return null;

  const property = propertyOf(state, app.propertyId);
  const unit = unitOf(state, app.unitId);
  const partyCount = partiesOf(state, applicationId).length;
  const lease = app.createdLeaseId ? leaseOf(state, app.createdLeaseId) : undefined;

  const jump = (id: string) => {
    setActive(id);
    document.getElementById(`sec-${applicationId}-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="border-t border-u-accent/20 bg-u-s2/50">
      {/* Context strip */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-u-line bg-u-card/70 px-4 py-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-u-muted">
          <span className="font-mono text-u-accent">{app.applicationNumber}</span>
          <span className="text-u-ink2">{property?.name}</span>
          <span>Unit {unit?.unitNumber}</span>
          <span>·</span>
          <span>Move-in {formatDate(app.requestedMoveInDate)}</span>
          <span>·</span>
          <span>
            {partyCount} part{partyCount === 1 ? "y" : "ies"} on file
          </span>
          {lease && <Badge tone="emerald">Lease {lease.leaseNumber}</Badge>}
          {!can("applications.screening.read") && (
            <span className="inline-flex items-center gap-1 text-u-danger/90">
              <IconLock width={11} height={11} />
              Screening masked
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <MockTag label="Expanded detail — client state" />
          <Button size="xs" variant="ghost" icon={<IconChevronUp width={12} height={12} />} onClick={onCollapse}>
            Collapse
          </Button>
        </div>
      </div>

      {/* Section nav */}
      <div className="sticky top-0 z-10 flex items-center gap-1 overflow-x-auto border-b border-u-line bg-u-s2/95 px-3 py-1.5 backdrop-blur">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => jump(s.id)}
            className={cn(
              "shrink-0 rounded-md px-2 py-1 text-[11.5px] transition-colors",
              active === s.id ? "bg-u-accent/15 text-u-accent" : "text-u-muted hover:bg-u-s2 hover:text-u-ink",
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="space-y-3 px-3 py-3">
        <div id={`sec-${applicationId}-overview`}>
          <OverviewSection applicationId={applicationId} open={open} />
        </div>
        <div id={`sec-${applicationId}-applicants`}>
          <ApplicantsSection applicationId={applicationId} open={open} />
        </div>
        <div id={`sec-${applicationId}-property`}>
          <PropertyUnitSection applicationId={applicationId} open={open} />
        </div>
        <div id={`sec-${applicationId}-screening`}>
          <ScreeningSection applicationId={applicationId} open={open} />
        </div>
        <div id={`sec-${applicationId}-documents`}>
          <DocumentsSection applicationId={applicationId} open={open} />
        </div>
        <div id={`sec-${applicationId}-decision`}>
          <DecisionSection applicationId={applicationId} open={open} />
        </div>
        <div id={`sec-${applicationId}-communications`}>
          <CommunicationsSection applicationId={applicationId} open={open} />
        </div>
        <div id={`sec-${applicationId}-activity`}>
          <ActivitySection applicationId={applicationId} />
        </div>
      </div>

      <DialogHost
        key={`${applicationId}-${dialogSeq}`}
        applicationId={applicationId}
        dialog={dialog}
        onClose={() => setDialog(null)}
      />
      <span className="hidden">{primaryApplicantOf(state, applicationId)?.fullName}</span>
    </div>
  );
}
