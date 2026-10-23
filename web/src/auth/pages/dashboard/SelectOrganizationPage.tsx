import { useState } from "react";
import { useNavigate } from "../../shim/router";
import {
  ArrowRight,
  Building2,
  Check,
  Clock3,
  Globe2,
  Mail,
  Plus,
  ShieldAlert,
  Users,
  Wallet,
} from "lucide-react";
import { SetupLayout } from "../../layouts/SetupLayout";
import { Alert, Badge, Button, Card, MembershipStatusBadge, RoleBadge } from "../../components/ui";
import { useAuth } from "../../contexts/AuthContext";
import { useOrganization } from "../../contexts/OrganizationContext";
import { useToast } from "../../contexts/ToastContext";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import { formatDate, orgGradient, orgMonogram } from "../../lib/format";
import { cn } from "../../utils/cn";

export default function SelectOrganizationPage() {
  useDocumentTitle("Choose an organization");
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    workspaces,
    suspendedWorkspaces,
    pendingInvitations,
    activeOrganization,
    switchOrganization,
    loading,
  } = useOrganization();
  const { toast } = useToast();
  const [selectingId, setSelectingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSelect(organizationId: string, name: string) {
    setSelectingId(organizationId);
    setError(null);
    try {
      await switchOrganization(organizationId);
      toast({ title: `Now in ${name}`, description: "Dashboard and data scoped to this organization.", variant: "success" });
      navigate("/app/dashboard", { replace: true });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to open that organization.");
    } finally {
      setSelectingId(null);
    }
  }

  if (loading) {
    return (
      <SetupLayout maxWidth="max-w-5xl">
        <div className="animate-fade-up">
          <div className="h-3 w-32 animate-pulse rounded bg-u-line" />
          <div className="mt-3 h-7 w-64 animate-pulse rounded bg-u-line/80" />
          <div className="mt-2 h-3 w-full max-w-lg animate-pulse rounded bg-u-s3" />
          <div className="mt-7 grid gap-3 sm:grid-cols-2">
            {[0, 1, 2, 3].map((item) => (
              <div key={item} className="h-[196px] animate-pulse rounded-xl border border-u-line bg-u-card p-4">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-u-s3" />
                  <div className="space-y-1.5">
                    <div className="h-3 w-36 rounded bg-u-s3" />
                    <div className="h-2 w-24 rounded bg-u-s2" />
                  </div>
                </div>
                <div className="mt-5 h-2 w-full rounded bg-u-s2" />
                <div className="mt-2 h-2 w-3/4 rounded bg-u-s2" />
              </div>
            ))}
          </div>
          <p className="mt-5 flex items-center justify-center gap-2 text-[11px] text-u-muted">
            <span className="size-3.5 animate-spin rounded-full border-[1.5px] border-u-line border-t-blue-500" />
            Checking your active memberships…
          </p>
        </div>
      </SetupLayout>
    );
  }

  return (
    <SetupLayout maxWidth="max-w-5xl">
      <div className="animate-fade-up">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.14em] text-u-accent uppercase">Workspace access</p>
            <h1 className="mt-2 text-[27px] font-semibold tracking-[-0.035em] text-u-ink sm:text-[30px]">
              Choose an organization
            </h1>
            <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-u-muted">
              You have access to {workspaces.length} {workspaces.length === 1 ? "organization" : "organizations"} as{" "}
              <span className="font-medium text-u-ink2">{user?.email}</span>. Every dashboard, report, and setting is
              scoped to the workspace you select.
            </p>
          </div>
          {pendingInvitations.length > 0 ? (
            <button
              type="button"
              onClick={() => navigate("/onboarding/invitations")}
              className="focus-ring flex w-fit items-center gap-2 rounded-lg border border-u-accent/30 bg-u-accent-soft px-3 py-2 text-left transition hover:bg-u-accent-soft"
            >
              <Mail className="size-4 text-u-accent" />
              <span>
                <span className="block text-[11px] font-semibold text-u-accent">
                  {pendingInvitations.length} pending invitation{pendingInvitations.length > 1 ? "s" : ""}
                </span>
                <span className="block text-[10px] text-u-accent">Review organization access</span>
              </span>
              <ArrowRight className="ml-1 size-3.5 text-u-accent" />
            </button>
          ) : null}
        </div>

        {error ? (
          <Alert tone="danger" className="mt-5">
            {error}
          </Alert>
        ) : null}

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {workspaces.map((workspace) => {
            const isActive = activeOrganization?.id === workspace.organization.id;
            const busy = selectingId === workspace.organization.id;
            return (
              <Card
                key={workspace.organization.id}
                className={cn(
                  "group relative overflow-hidden transition",
                  isActive ? "border-u-accent/30 ring-1 ring-u-accent/10" : "hover:border-u-line2 hover:shadow-[0_14px_40px_-28px_rgba(15,23,42,0.45)]"
                )}
              >
                {isActive ? (
                  <div className="flex items-center justify-between bg-u-accent px-4 py-1.5">
                    <span className="flex items-center gap-1.5 text-[10px] font-medium text-u-onaccent">
                      <Check className="size-3" strokeWidth={3} /> Current workspace
                    </span>
                    <span className="text-[9.5px] text-u-onaccent">{workspace.organization.plan} plan</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-between border-b border-u-line px-4 py-1.5">
                    <span className="text-[10px] font-medium tracking-wide text-u-muted uppercase">Workspace</span>
                    <span className="text-[9.5px] text-u-muted">{workspace.organization.plan} plan</span>
                  </div>
                )}
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <span
                      className={cn(
                        "flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-[12px] font-semibold text-u-onaccent shadow-sm",
                        orgGradient(workspace.organization.name)
                      )}
                    >
                      {orgMonogram(workspace.organization.name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h2 className="truncate text-[14px] font-semibold tracking-[-0.01em] text-u-ink">
                        {workspace.organization.name}
                      </h2>
                      <p className="mt-0.5 truncate text-[10.5px] text-u-muted">{workspace.organization.businessType}</p>
                    </div>
                    <RoleBadge role={workspace.membership.role} />
                  </div>

                  <div className="mt-3.5 grid grid-cols-2 gap-2 text-[10.5px]">
                    <div className="flex items-center gap-1.5 rounded-md border border-u-line bg-u-s2/70 px-2 py-1.5">
                      <MembershipStatusBadge status={workspace.membership.status} />
                    </div>
                    <div className="flex items-center gap-1.5 rounded-md border border-u-line bg-u-s2/70 px-2 py-1.5 text-u-muted">
                      <Wallet className="size-3 text-u-muted" />
                      {workspace.organization.currency}
                    </div>
                    <div className="flex items-center gap-1.5 rounded-md border border-u-line bg-u-s2/70 px-2 py-1.5 text-u-muted">
                      <Globe2 className="size-3 text-u-muted" />
                      {workspace.organization.country}
                    </div>
                    <div className="flex items-center gap-1.5 rounded-md border border-u-line bg-u-s2/70 px-2 py-1.5 text-u-muted">
                      <Clock3 className="size-3 text-u-muted" />
                      {workspace.organization.timezone.split("/")[1]?.replace("_", " ")}
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-3">
                    <p className="text-[10px] text-u-muted">
                      Member since {formatDate(workspace.membership.dateJoined, { month: "short", year: "numeric" })}
                    </p>
                    <Button
                      size="sm"
                      variant={isActive ? "secondary" : "primary"}
                      loading={busy}
                      disabled={Boolean(selectingId)}
                      onClick={() => handleSelect(workspace.organization.id, workspace.organization.name)}
                      iconRight={isActive ? undefined : ArrowRight}
                    >
                      {isActive ? "Open workspace" : "Select Organization"}
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}

          <button
            type="button"
            onClick={() => navigate("/onboarding/create-organization")}
            className="focus-ring group relative flex min-h-[196px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-u-line2 bg-u-card/50 p-5 text-center transition hover:border-u-accent/30 hover:bg-u-accent-soft/40"
          >
            <span className="flex size-10 items-center justify-center rounded-xl border border-u-line bg-u-card shadow-sm transition group-hover:border-u-accent/30">
              <Plus className="size-4.5 text-u-muted transition group-hover:text-u-accent" />
            </span>
            <span className="text-[12.5px] font-semibold text-u-ink">Create a new organization</span>
            <span className="max-w-[220px] text-[10.5px] leading-relaxed text-u-muted">
              Set up a separate workspace for another portfolio or business.
            </span>
          </button>
        </div>

        {workspaces.length === 0 && !loading ? (
          <Card className="mt-4">
            <div className="flex flex-col items-center px-6 py-10 text-center">
              <span className="flex size-11 items-center justify-center rounded-xl bg-u-s2 ring-1 ring-u-line">
                <Building2 className="size-5 text-u-muted" />
              </span>
              <h2 className="mt-3 text-[14px] font-semibold text-u-ink">No active workspaces</h2>
              <p className="mt-1 max-w-sm text-[12px] leading-relaxed text-u-muted">
                Create an organization or accept a pending invitation. Your account can exist without any
                organization membership.
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <Button size="sm" onClick={() => navigate("/onboarding")}>Setup options</Button>
                <Button size="sm" variant="secondary" onClick={() => navigate("/onboarding/invitations")}>
                  View invitations
                </Button>
              </div>
            </div>
          </Card>
        ) : null}

        {suspendedWorkspaces.length > 0 ? (
          <div className="mt-4 rounded-xl border border-u-warn/30 bg-u-warn-soft/60 p-4">
            <p className="flex items-center gap-1.5 text-[11.5px] font-semibold text-u-warn">
              <ShieldAlert className="size-3.5" />
              Suspended memberships are hidden
            </p>
            <div className="mt-2 space-y-1.5">
              {suspendedWorkspaces.map((workspace) => (
                <div key={workspace.organization.id} className="flex flex-wrap items-center gap-2 text-[11px] text-u-warn">
                  <span className="font-medium">{workspace.organization.name}</span>
                  <RoleBadge role={workspace.membership.role} />
                  <MembershipStatusBadge status={workspace.membership.status} />
                  <span className="text-u-warn/80">Contact an Owner to restore access.</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-u-line bg-u-card/70 px-4 py-3 text-[10.5px] text-u-muted">
          <span className="flex items-center gap-1.5">
            <Users className="size-3.5 text-u-muted" />
            Only organizations with an active membership are listed
          </span>
          <span className="hidden text-u-s3 sm:inline">·</span>
          <Badge tone="slate">Membership ≠ account</Badge>
          <span className="ml-auto text-u-muted">Switching is validated on every change</span>
        </div>
      </div>
    </SetupLayout>
  );
}
