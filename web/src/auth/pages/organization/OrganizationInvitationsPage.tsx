import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Clock3,
  Mail,
  MailPlus,
  RefreshCw,
  Search,
  ShieldCheck,
  UserPlus,
  XCircle,
} from "lucide-react";
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
  Skeleton,
} from "../../components/ui";
import { useOrganization } from "../../contexts/OrganizationContext";
import { useToast } from "../../contexts/ToastContext";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import { daysUntil, formatDate } from "../../lib/format";
import { listInvitationsForOrganization, type InvitationWithContext } from "../../services/mockInvitationService";
import { SettingsHeader } from "./SettingsChrome";
import { InviteMemberModal } from "./InviteMemberModal";
import { cn } from "../../utils/cn";

type Filter = "all" | "pending" | "archived";

export default function OrganizationInvitationsPage() {
  useDocumentTitle("Invitations");
  const { activeOrganization, revision, revokeInvitation, resendInvitation } = useOrganization();
  const { toast } = useToast();

  const [invitations, setInvitations] = useState<InvitationWithContext[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [revoking, setRevoking] = useState<InvitationWithContext | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const organizationId = activeOrganization?.id;

  useEffect(() => {
    if (!organizationId) return;
    let cancelled = false;
    setError(null);
    listInvitationsForOrganization(organizationId)
      .then((rows) => {
        if (!cancelled) setInvitations(rows);
      })
      .catch((caught) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "Unable to load invitations.");
      });
    return () => {
      cancelled = true;
    };
  }, [organizationId, revision]);

  const counts = useMemo(
    () => ({
      all: invitations?.length ?? 0,
      pending: invitations?.filter((invitation) => invitation.effectiveStatus === "pending").length ?? 0,
      archived: invitations?.filter((invitation) => invitation.effectiveStatus !== "pending").length ?? 0,
    }),
    [invitations]
  );

  const filtered = useMemo(() => {
    if (!invitations) return [];
    const query = search.trim().toLowerCase();
    return invitations.filter((invitation) => {
      const matchesQuery =
        !query ||
        invitation.email.toLowerCase().includes(query) ||
        (invitation.organization?.name ?? "").toLowerCase().includes(query) ||
        invitation.role.toLowerCase().includes(query);
      const matchesFilter =
        filter === "all" ||
        (filter === "pending" ? invitation.effectiveStatus === "pending" : invitation.effectiveStatus !== "pending");
      return matchesQuery && matchesFilter;
    });
  }, [invitations, filter, search]);

  async function handleResend(invitation: InvitationWithContext) {
    setBusyId(invitation.id);
    try {
      await resendInvitation(invitation.id);
      toast({
        title: "Invitation refreshed",
        description: `${invitation.email} now has a new 7-day invitation window. No email was sent.`,
        variant: "success",
      });
    } catch (caught) {
      toast({
        title: "Could not resend invitation",
        description: caught instanceof Error ? caught.message : "Try again.",
        variant: "error",
      });
    } finally {
      setBusyId(null);
    }
  }

  async function handleRevoke() {
    if (!revoking) return;
    setBusyId(revoking.id);
    try {
      await revokeInvitation(revoking.id);
      toast({ title: "Invitation revoked", description: `${revoking.email} can no longer accept this invitation.`, variant: "info" });
      setRevoking(null);
    } catch (caught) {
      toast({
        title: "Could not revoke invitation",
        description: caught instanceof Error ? caught.message : "Try again.",
        variant: "error",
      });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-5">
      <SettingsHeader
        title="Invitations"
        description="Invite teammates by email and track every pending, accepted, expired, or revoked invitation for this workspace."
        actions={
          <Button size="sm" icon={UserPlus} onClick={() => setInviteOpen(true)}>
            Invite member
          </Button>
        }
      />

      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Total invitations", value: counts.all, icon: MailPlus, tone: "text-u-muted bg-u-s2 ring-u-line" },
          { label: "Awaiting response", value: counts.pending, icon: Clock3, tone: "text-u-warn bg-u-warn-soft ring-u-warn/30" },
          { label: "Archived", value: counts.archived, icon: ShieldCheck, tone: "text-u-muted bg-u-s2 ring-u-line" },
        ].map((stat) => (
          <Card key={stat.label} className="flex items-center gap-2.5 p-3">
            <span className={cn("hidden size-8 shrink-0 items-center justify-center rounded-lg ring-1 sm:flex", stat.tone)}>
              <stat.icon className="size-4" />
            </span>
            <div>
              <p className="text-[16px] font-semibold tracking-[-0.02em] text-u-ink tabular-nums">{stat.value}</p>
              <p className="text-[9.5px] text-u-muted">{stat.label}</p>
            </div>
          </Card>
        ))}
      </div>

      {error ? <Alert tone="danger">{error}</Alert> : null}

      <div className="flex items-start gap-2 rounded-lg border border-u-accent/30 bg-u-accent-soft/50 px-3.5 py-2.5">
        <Mail className="mt-0.5 size-3.5 shrink-0 text-u-accent" />
        <p className="text-[10.5px] leading-relaxed text-u-accent">
          Invitations are mock records. No email is delivered. An invitee with an existing account sees the invitation
          in <span className="font-medium">Your invitations</span>; a new invitee can register with the same email and
          accept it later. Invitations expire after seven days.
        </p>
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-2 border-b border-u-line p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-[280px]">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-u-muted" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search email or role…"
              aria-label="Search invitations"
              className="h-8.5 w-full rounded-md border border-u-line bg-u-s2/70 pr-3 pl-8 text-[11.5px] text-u-ink2 transition placeholder:text-u-muted focus:border-u-accent/60 focus:bg-u-card focus:ring-[3px] focus:ring-u-accent/10 focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-1 rounded-md border border-u-line p-0.5 sm:w-fit">
            {(
              [
                { key: "all", label: `All ${counts.all}` },
                { key: "pending", label: `Pending ${counts.pending}` },
                { key: "archived", label: `Archived ${counts.archived}` },
              ] as { key: Filter; label: string }[]
            ).map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setFilter(tab.key)}
                className={cn(
                  "flex-1 rounded px-2 py-1 text-[10.5px] font-medium transition sm:flex-none",
                  filter === tab.key ? "bg-u-ink2 text-u-onaccent" : "text-u-muted hover:bg-u-s2"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {!invitations ? (
          <div className="space-y-2 p-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="flex items-center gap-3">
                <Skeleton className="size-8 rounded-full" />
                <Skeleton className="h-3 w-40" />
                <Skeleton className="ml-auto h-3 w-20" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={MailPlus}
            title={invitations.length === 0 ? "No invitations yet" : "No invitations match"}
            description={
              invitations.length === 0
                ? `Invite someone to ${activeOrganization?.name}. They will receive a mock invitation linked to their email address.`
                : "Try a different search or filter."
            }
            action={
              invitations.length === 0 ? (
                <Button size="sm" icon={UserPlus} onClick={() => setInviteOpen(true)}>
                  Invite your first teammate
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setSearch("");
                    setFilter("all");
                  }}
                >
                  Clear filters
                </Button>
              )
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[840px] text-left">
              <thead>
                <tr className="border-b border-u-line bg-u-s2/50">
                  {["Invitee", "Role", "Invited by", "Sent", "Expires", "Status", "Actions"].map((heading) => (
                    <th
                      key={heading}
                      className={cn(
                        "px-4 py-2 text-[9.5px] font-semibold tracking-[0.05em] text-u-muted uppercase",
                        heading === "Actions" && "text-right"
                      )}
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((invitation) => {
                  const pending = invitation.effectiveStatus === "pending";
                  const expiresIn = daysUntil(invitation.expiresAt);
                  return (
                    <tr
                      key={invitation.id}
                      className={cn(
                        "border-b border-u-line transition last:border-0 hover:bg-u-s2/60",
                        !pending && "opacity-80"
                      )}
                    >
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <span className="flex size-7 items-center justify-center rounded-full bg-u-s3 text-[9px] font-semibold text-u-muted ring-2 ring-white">
                            {invitation.email.slice(0, 2).toUpperCase()}
                          </span>
                          <div className="min-w-0">
                            <p className="max-w-[190px] truncate text-[11.5px] font-medium text-u-ink">{invitation.email}</p>
                            <p className="text-[9.5px] text-u-muted">Linked by exact email address</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <RoleBadge role={invitation.role} />
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="flex items-center gap-1.5 text-[10.5px] text-u-ink2">
                          <Avatar name={invitation.inviterName} size="xs" />
                          {invitation.inviterName}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-[10.5px] text-u-muted tabular-nums">
                        {formatDate(invitation.createdAt, { month: "short", day: "numeric" })}
                      </td>
                      <td className="px-4 py-2.5">
                        <p className="text-[10.5px] text-u-muted tabular-nums">
                          {formatDate(invitation.expiresAt, { month: "short", day: "numeric", year: "numeric" })}
                        </p>
                        {pending ? (
                          <p className={cn("text-[9px]", expiresIn <= 3 ? "font-medium text-u-warn" : "text-u-muted")}>
                            {expiresIn > 0 ? `${expiresIn}d remaining` : "Expiring today"}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-2.5">
                        <InvitationStatusBadge status={invitation.effectiveStatus} />
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center justify-end gap-1">
                          {invitation.effectiveStatus !== "accepted" && invitation.effectiveStatus !== "revoked" ? (
                            <Button
                              size="xs"
                              variant="ghost"
                              icon={RefreshCw}
                              disabled={Boolean(busyId)}
                              onClick={() => handleResend(invitation)}
                            >
                              {pending ? "Resend" : "Renew"}
                            </Button>
                          ) : null}
                          {pending ? (
                            <Button
                              size="xs"
                              variant="ghost"
                              icon={XCircle}
                              className="text-u-danger hover:bg-u-danger-soft hover:text-u-danger"
                              disabled={Boolean(busyId)}
                              onClick={() => setRevoking(invitation)}
                            >
                              Revoke
                            </Button>
                          ) : null}
                          {!pending && (invitation.effectiveStatus === "accepted" || invitation.effectiveStatus === "revoked") ? (
                            <span className="px-1.5 text-[9.5px] text-u-s3">No actions</span>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-u-line bg-u-s2/40 px-4 py-2.5 text-[10px] text-u-muted">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="size-3" />
            Role permissions are validated when an invitation is created and accepted.
          </span>
          <Badge tone="slate">
            <CalendarDays className="size-2.5" />
            Expiry: 7 days
          </Badge>
        </div>
      </Card>

      <InviteMemberModal open={inviteOpen} onClose={() => setInviteOpen(false)} />

      <Modal
        open={Boolean(revoking)}
        onClose={() => (busyId ? undefined : setRevoking(null))}
        title="Revoke this invitation?"
        description={revoking ? `${revoking.email} will no longer be able to accept this invite.` : undefined}
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setRevoking(null)} disabled={Boolean(busyId)}>
              Keep invitation
            </Button>
            <Button variant="danger" size="sm" loading={Boolean(busyId)} onClick={handleRevoke}>
              Revoke invitation
            </Button>
          </>
        }
      >
        <p className="text-[12px] leading-relaxed text-u-ink2">
          The invitation status becomes <span className="font-medium">Revoked</span> and a new activity log entry is
          recorded. You can create a fresh invitation later if needed.
        </p>
      </Modal>
    </div>
  );
}
