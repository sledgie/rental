import { useStore, statusHistoryOf, leaseOf } from "../../state/store";
import { PERMISSIONS, type ApplicationStatus } from "../../data/types";
import { formatDate } from "../../lib/format";
import { ApplicationStatusBadge, Badge, MockTag, RestrictedTag } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { EmptyHint, MiniTable, Note, SubSection, Td } from "./parts";
import { IconCheck, IconClipboard, IconLock, IconX } from "../../components/icons";
import type { DialogRequest } from "./dialogTypes";

const ACTIONS_BY_STATUS: Record<
  ApplicationStatus,
  { label: string; dialog: DialogRequest; tone?: "primary" | "secondary" | "ghost" | "success" | "danger"; guard?: string }[]
> = {
  New: [
    { label: "Start Review", dialog: { kind: "startReview" }, tone: "primary" },
    { label: "Request Information", dialog: { kind: "requestInfo" } },
    { label: "Edit Application", dialog: { kind: "editApplication" } },
  ],
  "Under Review": [
    { label: "Update Review", dialog: { kind: "reviewNote" } },
    { label: "Add Notes", dialog: { kind: "reviewNote" } },
    { label: "Request Information", dialog: { kind: "requestInfo" } },
    { label: "Complete Review", dialog: { kind: "completeReview" }, tone: "primary" },
  ],
  "Awaiting Information": [
    { label: "Record Information Received", dialog: { kind: "infoReceived" }, tone: "primary" },
    { label: "Resume Review", dialog: { kind: "startReview" } },
  ],
  Approved: [
    { label: "Create Lease", dialog: { kind: "createLease" }, tone: "primary" },
    { label: "View Application", dialog: { kind: "editApplication" } },
    { label: "Archive", dialog: { kind: "archiveApplication" } },
  ],
  Waitlisted: [
    { label: "Update Status", dialog: { kind: "status" }, tone: "primary" },
    { label: "Reconsider Application", dialog: { kind: "startReview" } },
  ],
  Declined: [
    { label: "Record Decision Details", dialog: { kind: "decision", decision: "Declined" } },
    { label: "Archive", dialog: { kind: "archiveApplication" } },
  ],
  Withdrawn: [
    { label: "Record Withdrawal", dialog: { kind: "status", status: "Withdrawn" } },
    { label: "Archive", dialog: { kind: "archiveApplication" } },
  ],
  Archived: [{ label: "Restore to Waitlisted", dialog: { kind: "status", status: "Waitlisted" } }],
  Draft: [
    { label: "Submit Application", dialog: { kind: "status", status: "New" }, tone: "primary" },
    { label: "Edit Application", dialog: { kind: "editApplication" } },
  ],
};

export function DecisionSection({
  applicationId,
  open,
}: {
  applicationId: string;
  open: (d: DialogRequest) => void;
}) {
  const { state, can } = useStore();
  const app = state.applications.find((a) => a.id === applicationId);
  if (!app) return null;

  const history = statusHistoryOf(state, applicationId);
  const lease = app.createdLeaseId ? leaseOf(state, app.createdLeaseId) : undefined;
  const canDecide = can(PERMISSIONS.decisions);

  return (
    <div className="space-y-3 rounded-xl border border-u-line bg-u-card/60 p-3.5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[13px] font-semibold text-u-ink">F. Application Status and Decision</h3>
            <ApplicationStatusBadge status={app.status} />
            {lease && <Badge tone="emerald">Lease {lease.leaseNumber}</Badge>}
            {!canDecide && <RestrictedTag label="Decision permission required" />}
          </div>
          <p className="mt-0.5 text-[11.5px] text-u-muted">
            Final decisions always require confirmation and a recorded reason. Status changes are written to the
            activity history.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <MockTag label="Status updates are local" />
          <Button size="xs" variant="secondary" icon={<IconClipboard width={12} height={12} />} onClick={() => open({ kind: "status" })}>
            Change Status
          </Button>
          {app.status !== "Approved" && (
            <Button
              size="xs"
              variant="success"
              icon={<IconCheck width={12} height={12} />}
              disabled={!canDecide}
              title={canDecide ? undefined : "Requires applications.decision.write"}
              onClick={() => open({ kind: "decision", decision: "Approved" })}
            >
              Approve…
            </Button>
          )}
          {app.status !== "Declined" && (
            <Button
              size="xs"
              variant="danger"
              icon={<IconX width={12} height={12} />}
              disabled={!canDecide}
              onClick={() => open({ kind: "decision", decision: "Declined" })}
            >
              Decline…
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <SubSection
          title="Available actions"
          hint={`Suggested for “${app.status}” applications`}
          className="lg:col-span-1"
        >
          <div className="flex flex-wrap gap-1.5">
            {ACTIONS_BY_STATUS[app.status].map((a) => (
              <Button
                key={a.label}
                size="xs"
                variant={a.tone ?? "secondary"}
                disabled={a.dialog.kind !== "editApplication" && a.dialog.kind !== "createLease" && !canDecide}
                title={
                  canDecide
                    ? undefined
                    : "Requires applications.decision.write — switch staff user in the sidebar"
                }
                onClick={() => open(a.dialog)}
              >
                {a.label}
              </Button>
            ))}
          </div>
          <div className="mt-3 space-y-2">
            <Note>
              Approving an application does not create a lease, reserve the unit, or mark it occupied. Use{" "}
              <span className="text-u-ink2">Create Lease</span> to start the conversion workflow.
            </Note>
            {app.status === "Approved" && !app.createdLeaseId && (
              <Note tone="info">
                Ready for conversion — lease creation will carry forward the applicants, occupants, rent, term, and
                selected documents.
              </Note>
            )}
          </div>
        </SubSection>

        <SubSection title="Status history" hint="Every change is attributed and timestamped" className="lg:col-span-2">
          {history.length === 0 ? (
            <EmptyHint>No status changes recorded yet — this application is still in its initial state.</EmptyHint>
          ) : (
            <MiniTable head={["Previous Status", "New Status", "Date Changed", "Changed By", "Notes / Reason"]}>
              {history.map((h) => {
                const transition = h.description.replace(/^Status changed — /, "").split("→");
                return (
                <tr key={h.id} className="hover:bg-u-s2/50">
                  <Td>
                    <Badge tone="neutral">{(transition[0] ?? "—").trim()}</Badge>
                  </Td>
                  <Td>
                    <ApplicationStatusBadge status={(transition[1] ?? "").trim() as ApplicationStatus} />
                  </Td>
                  <Td>{formatDate(h.createdAt)}</Td>
                  <Td>{h.createdBy}</Td>
                  <Td>
                    <span className="block max-w-[320px] text-[11.5px] text-u-muted">
                      {h.activityType === "decision_recorded" ? `Decision recorded · ${h.details ?? ""}` : h.details || "—"}
                    </span>
                  </Td>
                </tr>
                );
              })}
            </MiniTable>
          )}
          <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
            <div className="rounded-lg border border-u-line bg-u-s2/50 px-2.5 py-2">
              <p className="text-[10.5px] tracking-wide text-u-muted uppercase">Decision recorded</p>
              <p className="mt-0.5 text-[12.5px] text-u-ink">
                {state.activities.find(
                  (a) => a.applicationId === applicationId && a.activityType === "decision_recorded",
                )?.description ?? "No final decision recorded yet."}
              </p>
              {(() => {
                const decision = state.activities.find(
                  (a) => a.applicationId === applicationId && a.activityType === "decision_recorded",
                );
                return decision ? (
                  <p className="mt-1 text-[11px] text-u-muted">
                    {formatDate(decision.createdAt)} · {decision.createdBy}
                    {decision.details ? ` · ${decision.details}` : ""}
                  </p>
                ) : null;
              })()}
            </div>
            <div className="rounded-lg border border-u-line bg-u-s2/50 px-2.5 py-2">
              <p className="text-[10.5px] tracking-wide text-u-muted uppercase">Lease conversion</p>
              <p className="mt-0.5 text-[12.5px] text-u-ink">
                {lease
                  ? `${lease.leaseNumber} · ${lease.status} · starts ${formatDate(lease.startDate)}`
                  : "No lease created from this application."}
              </p>
              <p className="mt-1 text-[11px] text-u-muted">
                {lease ? (
                  <button type="button" className="text-u-accent hover:underline" onClick={() => open({ kind: "viewLease" })}>
                    View related lease
                  </button>
                ) : (
                  "Application and lease records stay separate."
                )}
              </p>
            </div>
          </div>
        </SubSection>
      </div>

      <Note tone="warn">
        <IconLock width={11} height={11} className="mr-1 inline align-[-1px]" />
        Decisions are documented by authorized staff only. Reasons are recorded for compliance (including adverse
        action notices) and never inferred from protected characteristics.
      </Note>
    </div>
  );
}
