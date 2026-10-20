import {
  useStore,
  propertyOf,
  unitOf,
  staffName,
  primaryApplicantOf,
  documentsOf,
  leaseOf,
} from "../../state/store";
import { currency, formatDate } from "../../lib/format";
import { ApplicationStatusBadge, Badge, MockTag } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Info, InfoGrid, ProgressBar } from "../../components/ui/Misc";
import { IconPencil, IconExternal, IconHome } from "../../components/icons";
import type { DialogRequest } from "./dialogTypes";

export function OverviewSection({
  applicationId,
  open,
}: {
  applicationId: string;
  open: (d: DialogRequest) => void;
}) {
  const { state } = useStore();
  const app = state.applications.find((a) => a.id === applicationId);
  if (!app) return null;
  const property = propertyOf(state, app.propertyId);
  const unit = unitOf(state, app.unitId);
  const applicant = primaryApplicantOf(state, app.id);
  const docCount = documentsOf(state, app.id).length;
  const lease = app.createdLeaseId ? leaseOf(state, app.createdLeaseId) : undefined;

  return (
    <div className="rounded-xl border border-u-line bg-u-card/60 p-3.5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-[13px] font-semibold text-u-ink">A. Application Overview</h3>
          <ApplicationStatusBadge status={app.status} />
          {app.status === "Draft" && <Badge tone="slate">Draft — not submitted</Badge>}
        </div>
        <div className="flex items-center gap-1.5">
          <MockTag label="Client-side state" />
          <Button
            size="xs"
            variant="secondary"
            icon={<IconPencil width={12} height={12} />}
            onClick={() => open({ kind: "editApplication" })}
          >
            Edit Application
          </Button>
        </div>
      </div>

      <InfoGrid cols={4}>
        <Info label="Application ID" value={<span className="font-mono">{app.applicationNumber}</span>} />
        <Info label="Application Type" value="New rental application" />
        <Info label="Application Status" value={<ApplicationStatusBadge status={app.status} />} />
        <Info label="Date Submitted" value={formatDate(app.submittedAt)} />
        <Info label="Last Updated" value={formatDate(app.updatedAt)} />
        <Info label="Assigned Reviewer" value={staffName(state, app.assignedReviewerId)} />
        <Info label="Desired Move-in Date" value={formatDate(app.requestedMoveInDate)} />
        <Info label="Requested Lease Term" value={`${app.requestedLeaseTerm} months`} />
        <Info label="Property and Unit" value={`${property?.name ?? "—"} · Unit ${unit?.unitNumber ?? "—"}`} />
        <Info label="Advertised Rent" value={currency(app.advertisedRent)} />
        <Info
          label="Proposed Monthly Rent"
          value={
            app.proposedRent != null && app.proposedRent !== app.advertisedRent ? (
              <span className="text-u-warn">{currency(app.proposedRent)} (negotiated)</span>
            ) : (
              `${currency(app.advertisedRent)} (advertised)`
            )
          }
        />
        <Info label="Application Source" value={app.applicationSource} />
      </InfoGrid>

      <div className="mt-3.5 grid gap-3 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Info label="Internal Notes" value={app.internalNotes || "No internal notes recorded."} />
        </div>
        <div className="space-y-2 rounded-lg border border-u-line bg-u-s2/50 p-2.5">
          <div className="flex items-center justify-between text-[11.5px] text-u-muted">
            <span className="tracking-wide uppercase">Application completeness</span>
            <span className="font-medium text-u-ink2">{app.completeness}%</span>
          </div>
          <ProgressBar value={app.completeness} tone={app.completeness < 60 ? "amber" : "brand"} />
          <div className="flex items-center justify-between text-[11.5px] text-u-muted">
            <span>
              {docCount} active document{docCount === 1 ? "" : "s"}
            </span>
            <span>{applicant?.fullName}</span>
          </div>
        </div>
      </div>

      {lease && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-u-ok/30 bg-u-ok/[0.07] px-3 py-2">
          <div className="text-[12px] text-u-ok">
            Lease <span className="font-mono">{lease.leaseNumber}</span> created from this application ·{" "}
            {formatDate(lease.startDate)} · {lease.status}
          </div>
          <Button
            size="xs"
            variant="success"
            icon={<IconExternal width={12} height={12} />}
            onClick={() => open({ kind: "viewLease" })}
          >
            View Lease
          </Button>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button size="xs" variant="ghost" icon={<IconHome width={12} height={12} />} onClick={() => open({ kind: "viewUnit" })}>
          View unit record
        </Button>
        <Button
          size="xs"
          variant="ghost"
          icon={<IconExternal width={12} height={12} />}
          onClick={() => open({ kind: "viewProperty" })}
        >
          View property record
        </Button>
        <span className="text-[11px] text-u-muted">
          Property and unit values are read from the Properties and Units modules — never duplicated here.
        </span>
      </div>
    </div>
  );
}
