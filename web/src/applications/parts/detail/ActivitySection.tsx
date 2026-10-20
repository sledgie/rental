import { useStore, activitiesOf } from "../../state/store";
import { formatDateTime } from "../../lib/format";
import { Badge } from "../../components/ui/Badge";
import { EmptyHint } from "./parts";
import {
  IconChat,
  IconCheck,
  IconClipboard,
  IconClock,
  IconFile,
  IconHome,
  IconLayers,
  IconPencil,
  IconPlus,
  IconShield,
  IconUser,
  IconUsers,
  IconUpload,
  IconWarn,
} from "../../components/icons";
import type { ActivityType } from "../../data/types";
import type { ReactNode } from "react";

const META: Record<ActivityType, { icon: ReactNode; label: string; tone: string }> = {
  application_created: { icon: <IconPlus width={13} height={13} />, label: "Application created", tone: "text-u-accent" },
  application_updated: { icon: <IconPencil width={13} height={13} />, label: "Application updated", tone: "text-u-ink2" },
  applicant_added: { icon: <IconUser width={13} height={13} />, label: "Applicant added", tone: "text-u-blue" },
  co_applicant_added: { icon: <IconUsers width={13} height={13} />, label: "Co-applicant added", tone: "text-u-blue" },
  applicant_removed: { icon: <IconWarn width={13} height={13} />, label: "Applicant removed", tone: "text-u-warn" },
  unit_selected: { icon: <IconHome width={13} height={13} />, label: "Unit selected", tone: "text-u-blue" },
  document_uploaded: { icon: <IconUpload width={13} height={13} />, label: "Document uploaded", tone: "text-u-accent" },
  document_updated: { icon: <IconLayers width={13} height={13} />, label: "Document updated", tone: "text-u-accent" },
  document_archived: { icon: <IconFile width={13} height={13} />, label: "Document archived", tone: "text-u-muted" },
  document_deleted: { icon: <IconWarn width={13} height={13} />, label: "Document deleted", tone: "text-u-danger" },
  review_started: { icon: <IconShield width={13} height={13} />, label: "Review started", tone: "text-u-violet" },
  review_note_added: { icon: <IconClipboard width={13} height={13} />, label: "Review note added", tone: "text-u-violet" },
  information_requested: { icon: <IconChat width={13} height={13} />, label: "Information requested", tone: "text-u-warn" },
  information_received: { icon: <IconCheck width={13} height={13} />, label: "Information received", tone: "text-u-ok" },
  status_changed: { icon: <IconClipboard width={13} height={13} />, label: "Status changed", tone: "text-u-accent" },
  decision_recorded: { icon: <IconShield width={13} height={13} />, label: "Decision recorded", tone: "text-u-ok" },
  communication_logged: { icon: <IconChat width={13} height={13} />, label: "Communication logged", tone: "text-u-blue" },
  follow_up_completed: { icon: <IconCheck width={13} height={13} />, label: "Follow-up completed", tone: "text-u-ok" },
  lease_created: { icon: <IconHome width={13} height={13} />, label: "Lease created", tone: "text-u-ok" },
  note_added: { icon: <IconClipboard width={13} height={13} />, label: "Note added", tone: "text-u-ink2" },
};

export function ActivitySection({ applicationId }: { applicationId: string }) {
  const { state } = useStore();
  const activities = activitiesOf(state, applicationId);

  return (
    <div className="rounded-xl border border-u-line bg-u-card/60 p-3.5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <IconClock width={14} height={14} className="text-u-muted" />
            <h3 className="text-[13px] font-semibold text-u-ink">H. Application Activity History</h3>
            <Badge tone="neutral">{activities.length} events</Badge>
          </div>
          <p className="mt-0.5 text-[11.5px] text-u-muted">
            Chronological record of every significant event, newest first.
          </p>
        </div>
      </div>

      {activities.length === 0 ? (
        <EmptyHint>No activity recorded yet.</EmptyHint>
      ) : (
        <ol className="relative space-y-0 border-l border-u-line pl-4">
          {activities.map((a) => {
            const meta = META[a.activityType] ?? META.application_updated;
            return (
              <li key={a.id} className="relative pb-3 last:pb-0">
                <span className="absolute top-1 -left-[22px] flex h-4 w-4 items-center justify-center rounded-full border border-u-line2 bg-u-s2">
                  <span className={meta.tone}>{meta.icon}</span>
                </span>
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="text-[12.5px] font-medium text-u-ink">{a.description}</span>
                  <span className="font-mono text-[10.5px] text-u-muted">{formatDateTime(a.createdAt)}</span>
                </div>
                <p className="text-[11.5px] text-u-muted">
                  {a.createdBy}
                  {a.details ? ` · ${a.details}` : ""}
                </p>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
