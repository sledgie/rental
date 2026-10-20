import { useStore, reviewsOf, staffName, documentsOf, partiesOf } from "../../state/store";
import { formatDate, relativeDays } from "../../lib/format";
import { PERMISSIONS } from "../../data/types";
import { Badge, MockTag, RestrictedTag, ScreeningStatusBadge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { MiniTable, Td, EmptyHint, Note, SubSection } from "./parts";
import { IconCheck, IconLock, IconClipboard, IconChat, IconRefresh, IconShield } from "../../components/icons";
import type { DialogRequest } from "./dialogTypes";
import type { ScreeningStatus } from "../../data/types";

const REVIEW_STEPS: { type: string; description: string }[] = [
  { type: "Completeness Check", description: "Application form and required documents received" },
  { type: "Employment & Income", description: "Lawfully collected income and employment verification" },
  { type: "Reference Check", description: "Current and prior landlord references" },
  { type: "Rental History", description: "Payment history, notices, and prior tenancies" },
  { type: "Credit Check", description: "Only with written authorization where legally permitted" },
  { type: "Identity Verification", description: "Government ID review where appropriate and permitted" },
  { type: "Final Review", description: "Documented human decision — no automated approval" },
];

export function ScreeningSection({
  applicationId,
  open,
}: {
  applicationId: string;
  open: (d: DialogRequest) => void;
}) {
  const { state, can } = useStore();
  const app = state.applications.find((a) => a.id === applicationId);
  if (!app) return null;

  const reviews = reviewsOf(state, applicationId);
  const parties = partiesOf(state, applicationId).filter((p) => p.role !== "Proposed Occupant");
  const docs = documentsOf(state, applicationId);
  const screeningAllowed = can(PERMISSIONS.screening);

  const byType = (type: string) => reviews.find((r) => r.reviewType === type);
  const missing: string[] = [];
  parties.forEach((p) =>
    p.requiredDocuments.forEach((req) => {
      const satisfied = docs.some(
        (d) => d.applicationPartyId === p.id && d.category === req && d.status !== "Needs Replacement",
      );
      if (!satisfied) missing.push(`${req} — ${p.fullName}`);
    }),
  );

  const followUps = reviews.filter((r) => r.followUpRequired && r.status !== "Completed");

  const summaryTone = (statuses: ScreeningStatus[]) => {
    if (statuses.length === 0) return "Not Started" as ScreeningStatus;
    if (statuses.every((s) => s === "Completed")) return "Completed" as ScreeningStatus;
    if (statuses.some((s) => s === "Waiting for Information")) return "Waiting for Information" as ScreeningStatus;
    if (statuses.some((s) => s === "In Progress")) return "In Progress" as ScreeningStatus;
    return "In Progress" as ScreeningStatus;
  };

  const overall = summaryTone(reviews.map((r) => r.status));

  return (
    <div className="space-y-3 rounded-xl border border-u-line bg-u-card/60 p-3.5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[13px] font-semibold text-u-ink">D. Screening and Review</h3>
            <ScreeningStatusBadge status={overall} />
            {!screeningAllowed && <RestrictedTag label="Screening access required" />}
          </div>
          <p className="mt-0.5 text-[11.5px] text-u-muted">
            Documented, human-reviewed process. Decisions are never automated and never based on protected
            characteristics.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <MockTag label="Human-reviewed" />
          <Button size="xs" variant="secondary" icon={<IconRefresh width={12} height={12} />} onClick={() => open({ kind: "startReview" })}>
            Start Review
          </Button>
          <Button size="xs" variant="ghost" icon={<IconChat width={12} height={12} />} onClick={() => open({ kind: "reviewNote" })}>
            Add Review Note
          </Button>
          <Button size="xs" variant="ghost" onClick={() => open({ kind: "requestInfo" })}>
            Request More Information
          </Button>
          <Button size="xs" variant="ghost" onClick={() => open({ kind: "referenceCheck" })}>
            Record Reference Check
          </Button>
          <Button
            size="xs"
            variant="ghost"
            icon={<IconShield width={12} height={12} />}
            disabled={!screeningAllowed}
            title={screeningAllowed ? undefined : "Requires applications.screening.read"}
            onClick={() => open({ kind: "screeningStatus" })}
          >
            Update Screening Status
          </Button>
          <Button
            size="xs"
            variant="success"
            icon={<IconCheck width={12} height={12} />}
            disabled={!can(PERMISSIONS.decisions)}
            onClick={() => open({ kind: "completeReview" })}
          >
            Mark Review Complete
          </Button>
        </div>
      </div>

      {!screeningAllowed && (
        <div className="flex items-start gap-2 rounded-lg border border-u-danger/30 bg-u-danger/[0.07] px-3 py-2 text-[12px] text-u-danger">
          <IconLock width={14} height={14} className="mt-px shrink-0" />
          <span>
            Screening results are masked for your role. Use the staff switcher in the sidebar to sign in as a user
            with <span className="font-mono text-[11px]">applications.screening.read</span> to view them.
          </span>
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-3">
        <SubSection title="Review steps" hint="Per-application checklist" className="lg:col-span-2">
          <MiniTable head={["Review Type", "Status", "Started", "Last Reviewed", "Reviewer", "Notes / Follow-up"]}>
            {REVIEW_STEPS.map((step) => {
              const review = byType(step.type);
              const status: ScreeningStatus = review?.status ?? "Not Started";
              return (
                <tr key={step.type} className="hover:bg-u-s2/50">
                  <Td>
                    <p className="font-medium text-u-ink">{step.type}</p>
                    <p className="max-w-[240px] text-[11px] text-u-muted">{step.description}</p>
                  </Td>
                  <Td>
                    {screeningAllowed ? (
                      <ScreeningStatusBadge status={status} />
                    ) : (
                      <span className="font-mono text-[11px] text-u-danger/80">••••••</span>
                    )}
                  </Td>
                  <Td>{screeningAllowed ? formatDate(review?.startedAt) : "—"}</Td>
                  <Td>{screeningAllowed ? formatDate(review?.reviewedAt) : "—"}</Td>
                  <Td>{review ? staffName(state, review.reviewerId) : "—"}</Td>
                  <Td>
                    {screeningAllowed && review?.notes ? (
                      <p className="max-w-[260px] text-[11.5px] text-u-ink2">{review.notes}</p>
                    ) : review?.followUpRequired ? (
                      <Badge tone="amber">Follow-up due {formatDate(review?.followUpDate)}</Badge>
                    ) : (
                      <span className="text-u-muted">—</span>
                    )}
                    {screeningAllowed && review?.followUpRequired && review.notes && (
                      <p className="mt-1 text-[11px] text-u-warn/90">
                        Follow-up due {formatDate(review.followUpDate)} · {relativeDays(review.followUpDate)}
                      </p>
                    )}
                  </Td>
                </tr>
              );
            })}
          </MiniTable>
        </SubSection>

        <div className="space-y-3">
          <SubSection title="Completeness" hint={`${app.completeness}% of required items received`}>
            <div className="space-y-2 text-[12px]">
              <div className="flex items-center justify-between">
                <span className="text-u-muted">Missing information</span>
                <Badge tone={missing.length ? "amber" : "emerald"}>{missing.length} item{missing.length === 1 ? "" : "s"}</Badge>
              </div>
              {missing.length === 0 ? (
                <EmptyHint>All required documents and answers have been received.</EmptyHint>
              ) : (
                <ul className="space-y-1">
                  {missing.map((m) => (
                    <li key={m} className="flex items-start gap-1.5 text-[11.5px] text-u-ink2">
                      <span className="text-u-warn">•</span>
                      <span>{m}</span>
                    </li>
                  ))}
                </ul>
              )}
              <Button size="xs" variant="ghost" className="mt-1" onClick={() => open({ kind: "requestInfo" })}>
                Request missing items
              </Button>
            </div>
          </SubSection>

          <SubSection title="Applicant screening" hint="Recorded per applicant, not per household">
            <MiniTable head={["Applicant", "Status"]}>
              {parties.map((p) => (
                <tr key={p.id}>
                  <Td>{p.fullName}</Td>
                  <Td>{screeningAllowed ? <ScreeningStatusBadge status={p.screeningStatus} /> : <span className="font-mono text-[11px] text-u-danger/80">••••</span>}</Td>
                </tr>
              ))}
            </MiniTable>
          </SubSection>

          <SubSection title="Review log">
            <dl className="space-y-1.5 text-[12px]">
              <div className="flex justify-between gap-2">
                <dt className="text-u-muted">Assigned reviewer</dt>
                <dd className="text-u-ink2">{staffName(state, app.assignedReviewerId)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-u-muted">Review start date</dt>
                <dd className="text-u-ink2">{formatDate(reviews.find((r) => r.startedAt)?.startedAt)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-u-muted">Last review date</dt>
                <dd className="text-u-ink2">
                  {formatDate(
                    reviews
                      .filter((r) => r.reviewedAt)
                      .map((r) => r.reviewedAt as string)
                      .sort()
                      .pop(),
                  )}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-u-muted">Open follow-ups</dt>
                <dd className="text-u-ink2">{followUps.length}</dd>
              </div>
            </dl>
            <div className="mt-2">
              <Note tone="info">
                <IconClipboard width={11} height={11} className="mr-1 inline align-[-1px]" />
                Reviewer notes are stored per application and restricted to authorized staff.
              </Note>
            </div>
          </SubSection>
        </div>
      </div>

      <SubSection title="Outstanding follow-up items" hint="Owned by the assigned reviewer">
        {followUps.length === 0 ? (
          <EmptyHint>No open follow-up items for this application.</EmptyHint>
        ) : (
          <MiniTable head={["Item", "Review Type", "Due", "Owner", "Action"]}>
            {followUps.map((r) => (
              <tr key={r.id}>
                <Td>{r.notes ?? "Follow-up required"}</Td>
                <Td>{r.reviewType}</Td>
                <Td>
                  <Badge tone="amber">{formatDate(r.followUpDate)}</Badge>
                </Td>
                <Td>{staffName(state, r.reviewerId)}</Td>
                <Td>
                  <Button size="xs" variant="ghost" onClick={() => open({ kind: "reviewNote" })}>
                    Add note
                  </Button>
                </Td>
              </tr>
            ))}
          </MiniTable>
        )}
      </SubSection>
    </div>
  );
}
