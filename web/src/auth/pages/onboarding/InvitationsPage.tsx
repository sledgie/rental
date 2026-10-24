import { useMemo, useState } from "react";
import { useNavigate } from "../../shim/router";
import {
  AlertCircle,
  ArrowRight,
  Building2,
  CalendarDays,
  Check,
  Clock3,
  Mail,
  MailQuestion,
  ShieldAlert,
  UserRound,
  X,
} from "lucide-react";
import { SetupLayout } from "../../layouts/SetupLayout";
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  InvitationStatusBadge,
  Modal,
  RoleBadge,
} from "../../components/ui";
import { useAuth } from "../../contexts/AuthContext";
import { useOrganization } from "../../contexts/OrganizationContext";
import { useToast } from "../../contexts/ToastContext";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import { daysUntil, formatDate, orgGradient, orgMonogram, roleDescriptions } from "../../lib/format";
import { cn } from "../../utils/cn";
import type { InvitationWithContext } from "../../services";

type FilterKey = "all" | "pending" | "archived";

export default function InvitationsPage() {
  useDocumentTitle("Your invitations");
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const {
    allMyInvitations,
    pendingInvitations,
    workspaces,
    activeOrganization,
    suspendedWorkspaces,
    acceptInvitation,
    declineInvitation,
  } = useOrganization();
  const { toast } = useToast();

  const [filter, setFilter] = useState<FilterKey>("all");
  const [accepting, setAccepting] = useState<InvitationWithContext | null>(null);
  const [declining, setDeclining] = useState<InvitationWithContext | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (filter === "pending") return allMyInvitations.filter((invite) => invite.effectiveStatus === "pending");
    if (filter === "archived") return allMyInvitations.filter((invite) => invite.effectiveStatus !== "pending");
    return allMyInvitations;
  }, [allMyInvitations, filter]);

  const counts = {
    all: allMyInvitations.length,
    pending: pendingInvitations.length,
    archived: allMyInvitations.length - pendingInvitations.length,
  };

  async function handleAccept() {
    if (!accepting) return;
    setBusyId(accepting.id);
    setError(null);
    try {
      const organization = await acceptInvitation(accepting.id);
      setAccepting(null);
      toast({
        title: `Joined ${organization.name}`,
        description: `You're now a member of ${organization.name}. Opening its dashboard.`,
        variant: "success",
      });
      navigate("/app/dashboard", { replace: true });
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "We couldn't accept this invitation.";
      setError(message);
      setAccepting(null);
      toast({ title: "Invitation not accepted", description: message, variant: "error" });
    } finally {
      setBusyId(null);
    }
  }

  async function handleDecline() {
    if (!declining) return;
    setBusyId(declining.id);
    try {
      await declineInvitation(declining.id);
      setDeclining(null);
      toast({ title: "Invitation declined", description: "The organization will no longer see a pending invite.", variant: "info" });
    } catch (caught) {
      toast({
        title: "Could not decline invitation",
        description: caught instanceof Error ? caught.message : "Try again.",
        variant: "error",
      });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <SetupLayout maxWidth="max-w-4xl">
      <div className="animate-fade-up">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.14em] text-u-accent uppercase">Organization access</p>
            <h1 className="mt-2 text-[27px] font-semibold tracking-[-0.035em] text-u-ink sm:text-[30px]">
              Your invitations
            </h1>
            <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-u-muted">
              Invitations addressed to <span className="font-medium text-u-ink2">{user?.email}</span>. Only an
              Owner or Administrator can invite you — organizations can't be joined by name.
            </p>
          </div>
          <Badge tone="slate" className="w-fit px-2.5 py-1">
            <Mail className="size-3" />
            {counts.pending} awaiting response
          </Badge>
        </div>

        {workspaces.length > 0 ? (
          <div className="mt-5 flex flex-col gap-2.5 rounded-xl border border-u-ok/80 bg-u-ok-soft/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-center gap-2 text-[12px] text-u-ok">
              <Check className="size-4 shrink-0" strokeWidth={2.5} />
              You already belong to{" "}
              <span className="font-semibold">
                {workspaces.map((workspace) => workspace.organization.name).join(", ")}
              </span>
              .
            </p>
            <Button size="sm" variant="secondary" onClick={() => navigate(activeOrganization ? "/app/dashboard" : "/organizations/select")}>
              {activeOrganization ? "Open dashboard" : "Choose a workspace"}
              <ArrowRight className="size-3.5" />
            </Button>
          </div>
        ) : null}

        {error ? (
          <Alert tone="danger" className="mt-4" title="Invitation error">
            {error}
          </Alert>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center gap-1 rounded-lg border border-u-line bg-u-card p-1 shadow-[0_1px_2px_rgba(12,42,34,0.03)] sm:w-fit">
          {(
            [
              { key: "all", label: "All" },
              { key: "pending", label: "Pending" },
              { key: "archived", label: "Archived" },
            ] as { key: FilterKey; label: string }[]
          ).map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setFilter(tab.key)}
              className={cn(
                "focus-ring flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-[11.5px] font-medium transition sm:flex-none",
                filter === tab.key ? "bg-u-ink2 text-u-onaccent shadow-sm" : "text-u-muted hover:bg-u-s2 hover:text-u-ink"
              )}
            >
              {tab.label}
              <span
                className={cn(
                  "rounded-full px-1.5 text-[9.5px]",
                  filter === tab.key ? "bg-u-card/15 text-u-onaccent" : "bg-u-s3 text-u-muted"
                )}
              >
                {counts[tab.key]}
              </span>
            </button>
          ))}
        </div>

        <div className="mt-4 space-y-3">
          {filtered.length === 0 ? (
            <Card>
              <EmptyState
                icon={MailQuestion}
                title={filter === "pending" ? "No pending invitations" : "Nothing here yet"}
                description={
                  workspaces.length > 0
                    ? "You're all caught up. Switch to another workspace or invite teammates from organization settings."
                    : "You have no invitations yet. Create your own organization to get started, or ask an Owner to invite this email address."
                }
                action={
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button size="sm" icon={Building2} onClick={() => navigate("/onboarding/create-organization")}>
                      Create an organization
                    </Button>
                    {workspaces.length > 0 ? (
                      <Button size="sm" variant="secondary" onClick={() => navigate("/app/dashboard")}>
                        Return to workspace
                      </Button>
                    ) : null}
                  </div>
                }
              />
            </Card>
          ) : (
            filtered.map((invitation) => {
              const isPending = invitation.effectiveStatus === "pending";
              const daysLeft = daysUntil(invitation.expiresAt);
              const org = invitation.organization;
              return (
                <Card
                  key={invitation.id}
                  className={cn(
                    "overflow-hidden transition",
                    isPending ? "hover:border-u-line2 hover:shadow-[0_8px_28px_-20px_rgba(12,42,34,0.35)]" : "opacity-90"
                  )}
                >
                  <div className="flex flex-col gap-4 p-4 sm:p-5">
                    <div className="flex items-start gap-3">
                      <span
                        className={cn(
                          "flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-[12px] font-semibold text-u-onaccent shadow-sm",
                          orgGradient(org?.name ?? invitation.organizationId)
                        )}
                      >
                        {orgMonogram(org?.name ?? "Organization")}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-[14px] font-semibold tracking-[-0.01em] text-u-ink">
                            {org?.name ?? "Organization unavailable"}
                          </h2>
                          <InvitationStatusBadge status={invitation.effectiveStatus} />
                        </div>
                        <p className="mt-0.5 text-[11px] text-u-muted">
                          {org?.businessType} · {org?.country} · {org?.currency}
                        </p>
                      </div>
                      {isPending ? (
                        <span
                          className={cn(
                            "hidden shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[10px] font-medium sm:flex",
                            daysLeft <= 3 ? "bg-u-warn-soft text-u-warn ring-1 ring-u-warn/30" : "bg-u-s2 text-u-muted ring-1 ring-u-line"
                          )}
                        >
                          <Clock3 className="size-3" />
                          {daysLeft > 0 ? `${daysLeft} day${daysLeft === 1 ? "" : "s"} left` : "Expired"}
                        </span>
                      ) : null}
                    </div>

                    <div className="grid grid-cols-1 gap-x-6 gap-y-2.5 rounded-lg border border-u-line bg-u-s2/50 px-3.5 py-3 sm:grid-cols-2">
                      <div className="flex items-center gap-2">
                        <Mail className="size-3.5 shrink-0 text-u-muted" />
                        <span className="text-[10.5px] text-u-muted">Invited email</span>
                        <span className="ml-auto truncate text-[11px] font-medium text-u-ink2">{invitation.email}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <ShieldAlert className="size-3.5 shrink-0 text-u-muted" />
                        <span className="text-[10.5px] text-u-muted">Assigned role</span>
                        <span className="ml-auto">
                          <RoleBadge role={invitation.role} />
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <UserRound className="size-3.5 shrink-0 text-u-muted" />
                        <span className="text-[10.5px] text-u-muted">Invited by</span>
                        <span className="ml-auto flex items-center gap-1.5 text-[11px] font-medium text-u-ink2">
                          <Avatar name={invitation.inviterName} size="xs" /> {invitation.inviterName}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CalendarDays className="size-3.5 shrink-0 text-u-muted" />
                        <span className="text-[10.5px] text-u-muted">Sent</span>
                        <span className="ml-auto text-[11px] font-medium text-u-ink2">
                          {formatDate(invitation.createdAt, { month: "short", day: "numeric", year: "numeric" })}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 sm:col-span-2">
                        <Clock3 className="size-3.5 shrink-0 text-u-muted" />
                        <span className="text-[10.5px] text-u-muted">Expires</span>
                        <span className="ml-auto text-[11px] font-medium text-u-ink2">
                          {formatDate(invitation.expiresAt, { month: "short", day: "numeric", year: "numeric" })}
                        </span>
                      </div>
                    </div>

                    {isPending ? (
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <p className="flex-1 text-[10.5px] leading-relaxed text-u-muted">
                          Accepting adds an active membership. You can switch between organizations at any time.
                        </p>
                        <div className="flex gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            icon={X}
                            onClick={() => setDeclining(invitation)}
                            disabled={busyId === invitation.id}
                          >
                            Decline
                          </Button>
                          <Button size="sm" icon={Check} onClick={() => setAccepting(invitation)} disabled={busyId === invitation.id}>
                            Accept Invitation
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="flex items-center gap-1.5 text-[10.5px] text-u-muted">
                        <AlertCircle className="size-3.5" />
                        {invitation.effectiveStatus === "expired"
                          ? "This invitation has expired. Ask an organization admin to send a new one."
                          : invitation.effectiveStatus === "accepted"
                            ? "This invitation has already been accepted."
                            : invitation.effectiveStatus === "declined"
                              ? "You declined this invitation."
                              : "This invitation was revoked by the organization."}
                      </p>
                    )}
                  </div>
                </Card>
              );
            })
          )}
        </div>

        {suspendedWorkspaces.length > 0 ? (
          <div className="mt-4 rounded-xl border border-u-warn/30 bg-u-warn-soft/60 px-4 py-3">
            <p className="text-[11.5px] font-medium text-u-warn">Suspended membership</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-u-warn">
              {suspendedWorkspaces.map((workspace) => workspace.organization.name).join(", ")} — your access is
              suspended. Contact an Owner or Administrator there; accepting a new invitation would create a
              duplicate and is blocked.
            </p>
          </div>
        ) : null}

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => navigate("/onboarding/create-organization")}
            className="focus-ring group flex items-center gap-3 rounded-xl border border-u-line bg-u-card px-4 py-3.5 text-left transition hover:border-u-accent/30 hover:shadow-[0_6px_20px_-16px_rgba(29,102,80,0.5)]"
          >
            <span className="flex size-9 items-center justify-center rounded-lg bg-u-accent-soft ring-1 ring-u-accent/30">
              <Building2 className="size-4 text-u-accent" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[12px] font-semibold text-u-ink">Create your own organization</span>
              <span className="block text-[10.5px] text-u-muted">Start a workspace and become Owner</span>
            </span>
            <ArrowRight className="size-4 text-u-s3 transition group-hover:translate-x-0.5 group-hover:text-u-accent" />
          </button>
          <button
            type="button"
            onClick={async () => {
              if (workspaces.length) {
                navigate("/organizations/select");
                return;
              }
              await signOut();
              navigate("/login", { replace: true });
            }}
            className="focus-ring flex items-center gap-3 rounded-xl border border-u-line bg-u-card px-4 py-3.5 text-left transition hover:border-u-line2"
          >
            <span className="flex size-9 items-center justify-center rounded-lg bg-u-s2 ring-1 ring-u-line">
              <ArrowRight className="size-4 rotate-180 text-u-muted" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[12px] font-semibold text-u-ink">
                {workspaces.length ? "Choose an existing workspace" : "Return to sign in"}
              </span>
              <span className="block text-[10.5px] text-u-muted">
                {workspaces.length ? "Open a workspace you belong to" : "Use a different account"}
              </span>
            </span>
          </button>
        </div>
      </div>

      <Modal
        open={Boolean(accepting)}
        onClose={() => (busyId ? undefined : setAccepting(null))}
        title={accepting ? `Join ${accepting.organization?.name ?? "organization"}` : "Join organization"}
        description="Review the access you'll receive before joining."
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setAccepting(null)} disabled={Boolean(busyId)}>
              Cancel
            </Button>
            <Button size="sm" icon={Check} loading={Boolean(busyId)} onClick={handleAccept}>
              Accept & join
            </Button>
          </>
        }
      >
        {accepting ? (
          <div className="space-y-3.5">
            <div className="flex items-center gap-3 rounded-lg border border-u-line bg-u-s2/60 p-3">
              <span className={cn("flex size-9 items-center justify-center rounded-lg bg-gradient-to-br text-[11px] font-semibold text-u-onaccent", orgGradient(accepting.organization?.name ?? "org"))}>
                {orgMonogram(accepting.organization?.name ?? "Organization")}
              </span>
              <div className="min-w-0">
                <p className="text-[12.5px] font-semibold text-u-ink">{accepting.organization?.name}</p>
                <p className="text-[10.5px] text-u-muted">
                  Invited by {accepting.inviterName} · expires {formatDate(accepting.expiresAt)}
                </p>
              </div>
              <span className="ml-auto">
                <RoleBadge role={accepting.role} />
              </span>
            </div>
            <div className="rounded-lg border border-u-accent/30 bg-u-accent-soft/60 px-3 py-2.5">
              <p className="text-[11px] font-semibold text-u-accent">As {accepting.role}, you'll be able to:</p>
              <p className="mt-1 text-[11px] leading-relaxed text-u-accent">{roleDescriptions[accepting.role]}</p>
            </div>
            <p className="text-[11px] leading-relaxed text-u-muted">
              Joining creates an active membership for <span className="font-medium text-u-ink2">{accepting.email}</span>{" "}
              and makes this your active organization. Organization data is only visible to members.
            </p>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(declining)}
        onClose={() => (busyId ? undefined : setDeclining(null))}
        title="Decline this invitation?"
        description={declining ? `${declining.organization?.name} will see that you declined.` : undefined}
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setDeclining(null)} disabled={Boolean(busyId)}>
              Keep invitation
            </Button>
            <Button variant="danger" size="sm" loading={Boolean(busyId)} onClick={handleDecline}>
              Decline invitation
            </Button>
          </>
        }
      >
        <p className="text-[12px] leading-relaxed text-u-ink2">
          You can ask {declining?.inviterName} for a new invitation later. Declining does not affect your account
          or any other organization memberships.
        </p>
      </Modal>
    </SetupLayout>
  );
}
