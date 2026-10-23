import { useEffect, useMemo, useState } from "react";
import { Link } from "../../shim/router";
import {
  AlertTriangle,
  Check,
  Crown,
  Info,
  Mail,
  MoreHorizontal,
  Search,
  ShieldCheck,
  ShieldOff,
  Trash2,
  UserCheck,
  UserCog,
  UserPlus,
  Users,
} from "lucide-react";
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  MembershipStatusBadge,
  Modal,
  RoleBadge,
  SelectInput,
  Skeleton,
} from "../../components/ui";
import { useAuth } from "../../contexts/AuthContext";
import { useOrganization } from "../../contexts/OrganizationContext";
import { useToast } from "../../contexts/ToastContext";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import { formatDate, ASSIGNABLE_ROLES, roleDescriptions } from "../../lib/format";
import { membershipService, type MembershipWithUser } from "../../services";
import type { Role } from "../../lib/types";
import { SettingsHeader } from "./SettingsChrome";
import { InviteMemberModal } from "./InviteMemberModal";
import { cn } from "../../utils/cn";

type ConfirmType = "remove" | "suspend" | "reactivate" | "transfer";

interface ConfirmState {
  type: ConfirmType;
  member: MembershipWithUser;
}

export default function MembersPage() {
  useDocumentTitle("Members");
  const { user } = useAuth();
  const {
    activeOrganization,
    activeRole,
    isOrganizationOwner,
    revision,
    updateMemberRole,
    setMemberStatus,
    removeMember,
    transferOwnership,
  } = useOrganization();
  const { toast } = useToast();

  const [members, setMembers] = useState<MembershipWithUser[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "suspended">("all");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [selected, setSelected] = useState<MembershipWithUser | null>(null);
  const [roleDraft, setRoleDraft] = useState<Role>("Property Manager");
  const [modalError, setModalError] = useState<string | null>(null);
  const [savingRole, setSavingRole] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [confirming, setConfirming] = useState(false);

  const organizationId = activeOrganization?.id;

  useEffect(() => {
    if (!organizationId) return;
    let cancelled = false;
    setLoadError(null);
    membershipService.listOrganizationMembers(organizationId)
      .then((rows) => {
        if (!cancelled) setMembers(rows);
      })
      .catch((error) => {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : "Unable to load members.");
      });
    return () => {
      cancelled = true;
    };
  }, [organizationId, revision]);

  const counts = useMemo(
    () => ({
      total: members?.length ?? 0,
      active: members?.filter((member) => member.membership.status === "active").length ?? 0,
      suspended: members?.filter((member) => member.membership.status === "suspended").length ?? 0,
      owners: members?.filter((member) => member.membership.role === "Owner" && member.membership.status === "active").length ?? 0,
    }),
    [members]
  );

  const filtered = useMemo(() => {
    if (!members) return [];
    const query = search.trim().toLowerCase();
    return members.filter((member) => {
      const matchesQuery =
        !query ||
        member.user.fullName.toLowerCase().includes(query) ||
        member.user.email.toLowerCase().includes(query) ||
        member.membership.role.toLowerCase().includes(query);
      const matchesStatus = statusFilter === "all" || member.membership.status === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [members, search, statusFilter]);

  function openMember(member: MembershipWithUser) {
    setSelected(member);
    setRoleDraft(member.membership.role === "Owner" ? "Administrator" : member.membership.role);
    setModalError(null);
  }

  const isSelf = (member: MembershipWithUser) => member.user.id === user?.id;
  const isEditable = (member: MembershipWithUser) => !isSelf(member) && member.membership.status === "active";

  async function applyRole() {
    if (!selected) return;
    if (roleDraft === selected.membership.role) {
      setModalError("Choose a different role first.");
      return;
    }
    setSavingRole(true);
    setModalError(null);
    try {
      await updateMemberRole(selected.membership.id, roleDraft);
      toast({
        title: "Role updated",
        description: `${selected.user.fullName} is now ${roleDraft} in ${activeOrganization?.name}.`,
        variant: "success",
      });
      setSelected(null);
    } catch (error) {
      setModalError(error instanceof Error ? error.message : "Unable to update role.");
    } finally {
      setSavingRole(false);
    }
  }

  function askConfirm(type: ConfirmType, member: MembershipWithUser) {
    setSelected(null);
    setModalError(null);
    setConfirm({ type, member });
  }

  async function runConfirm() {
    if (!confirm) return;
    setConfirming(true);
    try {
      const { member, type } = confirm;
      if (type === "remove") {
        await removeMember(member.membership.id);
        toast({ title: "Member removed", description: `${member.user.fullName} no longer has access.`, variant: "success" });
      } else if (type === "suspend") {
        await setMemberStatus(member.membership.id, "suspended");
        toast({ title: "Membership suspended", description: `${member.user.fullName}'s access was suspended.`, variant: "info" });
      } else if (type === "reactivate") {
        await setMemberStatus(member.membership.id, "active");
        toast({ title: "Membership restored", description: `${member.user.fullName} can access the workspace again.`, variant: "success" });
      } else {
        await transferOwnership(member.membership.id);
        toast({
          title: "Ownership transferred",
          description: `${member.user.fullName} is now Owner. You were moved to Administrator.`,
          variant: "success",
        });
      }
      setConfirm(null);
    } catch (error) {
      toast({
        title: "Action not completed",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "error",
      });
    } finally {
      setConfirming(false);
    }
  }

  const confirmCopy: Record<ConfirmType, { title: string; description: string; cta: string; danger?: boolean }> = {
    remove: {
      title: "Remove this member?",
      description: "Their membership is deleted. Any workspace data they created remains in the organization.",
      cta: "Remove member",
      danger: true,
    },
    suspend: {
      title: "Suspend this membership?",
      description: "They immediately lose access and disappear from the organization switcher until reactivated.",
      cta: "Suspend membership",
    },
    reactivate: {
      title: "Restore this membership?",
      description: "They regain access with their previous role and can select this organization again.",
      cta: "Restore access",
    },
    transfer: {
      title: "Transfer organization ownership?",
      description: "You will become an Administrator. Only the new Owner can transfer ownership back.",
      cta: "Transfer ownership",
      danger: true,
    },
  };

  const safeguardingOwner = confirm?.member.isLastActiveOwner ?? false;

  return (
    <div className="space-y-5">
      <SettingsHeader
        title="Members"
        description="Manage who can access this workspace and what they can do. Role changes are checked against mock authorization rules."
        actions={
          <Button size="sm" icon={UserPlus} onClick={() => setInviteOpen(true)}>
            Invite member
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: "Total members", value: counts.total, icon: Users, tone: "text-u-muted bg-u-s2 ring-u-line" },
          { label: "Active", value: counts.active, icon: UserCheck, tone: "text-u-ok bg-u-ok-soft ring-u-ok/30" },
          { label: "Suspended", value: counts.suspended, icon: ShieldOff, tone: "text-u-warn bg-u-warn-soft ring-u-warn/30" },
          { label: "Active owners", value: counts.owners, icon: Crown, tone: "text-u-accent bg-u-accent-soft ring-u-accent/30" },
        ].map((stat) => (
          <Card key={stat.label} className="flex items-center gap-2.5 p-3">
            <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg ring-1", stat.tone)}>
              <stat.icon className="size-4" />
            </span>
            <div>
              <p className="text-[16px] font-semibold tracking-[-0.02em] text-u-ink tabular-nums">{stat.value}</p>
              <p className="text-[9.5px] text-u-muted">{stat.label}</p>
            </div>
          </Card>
        ))}
      </div>

      {loadError ? <Alert tone="danger">{loadError}</Alert> : null}

      {counts.owners === 1 ? (
        <div className="flex items-start gap-2 rounded-lg border border-u-accent/30 bg-u-accent-soft/50 px-3.5 py-2.5">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-u-accent" />
          <p className="text-[10.5px] leading-relaxed text-u-accent">
            This organization has one Owner. To change that Owner, transfer ownership to an active member first —
            the last Owner cannot be suspended, demoted, or removed. You are currently {activeRole}.
          </p>
        </div>
      ) : null}

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-2 border-b border-u-line p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-[280px]">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-u-muted" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search members or roles…"
              aria-label="Search members"
              className="h-8.5 w-full rounded-md border border-u-line bg-u-s2/70 pr-3 pl-8 text-[11.5px] text-u-ink2 transition placeholder:text-u-muted focus:border-u-accent/60 focus:bg-u-card focus:ring-[3px] focus:ring-u-accent/10 focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-1 rounded-md border border-u-line p-0.5 sm:w-fit">
            {(["all", "active", "suspended"] as const).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={cn(
                  "flex-1 rounded px-2 py-1 text-[10.5px] font-medium capitalize transition sm:flex-none",
                  statusFilter === status ? "bg-u-ink2 text-u-onaccent" : "text-u-muted hover:bg-u-s2"
                )}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        {!members ? (
          <div className="space-y-2 p-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="flex items-center gap-3">
                <Skeleton className="size-8 rounded-full" />
                <Skeleton className="h-3 w-32" />
                <Skeleton className="ml-auto h-3 w-20" />
                <Skeleton className="h-3 w-16" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Users}
            title={members.length === 0 ? "No members yet" : "No matching members"}
            description={
              members.length === 0
                ? "Invite your first team member. The Owner who created this organization is always a member."
                : "Try a different search or status filter."
            }
            action={
              members.length === 0 ? (
                <Button size="sm" icon={UserPlus} onClick={() => setInviteOpen(true)}>
                  Invite a member
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setSearch("");
                    setStatusFilter("all");
                  }}
                >
                  Clear filters
                </Button>
              )
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left">
              <thead>
                <tr className="border-b border-u-line bg-u-s2/50">
                  {["Member", "Role", "Membership", "Date joined", "Actions"].map((heading) => (
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
                {filtered.map((member) => {
                  const self = isSelf(member);
                  return (
                    <tr
                      key={member.membership.id}
                      className={cn(
                        "border-b border-u-line transition last:border-0 hover:bg-u-s2/60",
                        member.membership.status === "suspended" && "bg-u-warn-soft/20"
                      )}
                    >
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={member.user.fullName} size="sm" />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="truncate text-[11.5px] font-medium text-u-ink">{member.user.fullName}</p>
                              {self ? <Badge tone="blue" className="px-1 py-0 text-[8px]">You</Badge> : null}
                              {member.isLastActiveOwner ? (
                                <Badge tone="indigo" className="px-1 py-0 text-[8px]">
                                  Last owner
                                </Badge>
                              ) : null}
                            </div>
                            <p className="truncate text-[9.5px] text-u-muted">{member.user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <RoleBadge role={member.membership.role} />
                      </td>
                      <td className="px-4 py-2.5">
                        <MembershipStatusBadge status={member.membership.status} />
                      </td>
                      <td className="px-4 py-2.5 text-[10.5px] text-u-muted tabular-nums">
                        {formatDate(member.membership.dateJoined, { month: "short", day: "numeric", year: "numeric" })}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => openMember(member)}
                          aria-label={`Manage ${member.user.fullName}`}
                          className="focus-ring inline-flex size-7 items-center justify-center rounded-md text-u-muted transition hover:bg-u-s3 hover:text-u-ink2"
                        >
                          <MoreHorizontal className="size-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-col gap-1.5 border-t border-u-line bg-u-s2/40 px-4 py-2.5 text-[10px] text-u-muted sm:flex-row sm:items-center sm:justify-between">
          <span className="flex items-center gap-1.5">
            <Info className="size-3" />
            Role authorization is enforced in the service layer, not only the UI.
          </span>
          <Link to="/app/organization/invitations" className="flex items-center gap-1 font-medium text-u-accent hover:text-u-accent">
            <Mail className="size-3" />
            View pending invitations
          </Link>
        </div>
      </Card>

      <InviteMemberModal open={inviteOpen} onClose={() => setInviteOpen(false)} />

      {/* Member actions */}
      <Modal
        open={Boolean(selected)}
        onClose={() => (savingRole ? undefined : setSelected(null))}
        title={selected ? `Manage ${selected.user.fullName}` : "Manage member"}
        description={selected ? `${selected.user.email} · joined ${formatDate(selected.membership.dateJoined)}` : undefined}
        footer={
          <Button variant="secondary" size="sm" onClick={() => setSelected(null)} disabled={savingRole}>
            Close
          </Button>
        }
      >
        {selected ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-lg border border-u-line bg-u-s2/60 p-3">
              <Avatar name={selected.user.fullName} size="lg" />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-u-ink">
                  {selected.user.fullName}
                  {isSelf(selected) ? (
                    <Badge tone="blue" className="px-1 py-0 text-[8px]">You</Badge>
                  ) : null}
                </p>
                <p className="truncate text-[10.5px] text-u-muted">{selected.user.email}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <RoleBadge role={selected.membership.role} />
                  <MembershipStatusBadge status={selected.membership.status} />
                </div>
              </div>
            </div>

            {modalError ? <Alert tone="danger">{modalError}</Alert> : null}

            {isSelf(selected) ? (
              <Alert tone="info" title="That's your own membership">
                You cannot change your own role, suspend yourself, or remove your own access. Ask another Owner or
                Administrator. Ownership transfer is the only way to hand over the Owner role.
              </Alert>
            ) : selected.isLastActiveOwner ? (
              <Alert tone="warning" title="Last active Owner safeguard">
                This is the last Owner. Transfer ownership to another active member before changing, suspending, or
                removing this membership.
              </Alert>
            ) : selected.membership.role === "Owner" && !isOrganizationOwner ? (
              <Alert tone="warning" title="Owner membership is protected">
                Administrators cannot change, suspend, or remove an Owner. Ask the current Owner to transfer ownership
                if this access needs to change.
              </Alert>
            ) : null}

            <div className="rounded-lg border border-u-line p-3">
              <div className="flex items-center gap-1.5">
                <UserCog className="size-3.5 text-u-muted" />
                <p className="text-[11.5px] font-semibold text-u-ink">Role & permissions</p>
              </div>
              {isEditable(selected) && !(selected.membership.role === "Owner" && !isOrganizationOwner) ? (
                <>
                  <div className="mt-2.5">
                    <SelectInput
                      label="Assigned role"
                      value={roleDraft}
                      onChange={(event) => {
                        setRoleDraft(event.target.value as Role);
                        setModalError(null);
                      }}
                      options={ASSIGNABLE_ROLES.map((role) => ({ value: role, label: role }))}
                      disabled={savingRole}
                    />
                  </div>
                  <p className="mt-1.5 text-[10px] leading-relaxed text-u-muted">{roleDescriptions[roleDraft]}</p>
                  <div className="mt-2 flex justify-end">
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={Check}
                      onClick={applyRole}
                      loading={savingRole}
                      disabled={roleDraft === selected.membership.role}
                    >
                      Update role
                    </Button>
                  </div>
                </>
              ) : (
                <p className="mt-1.5 text-[10.5px] leading-relaxed text-u-muted">
                  Reactivate this membership before changing its role. The Owner role is not granted from this selector
                  {isOrganizationOwner ? " — use transfer ownership instead." : " and requires the current Owner."}
                </p>
              )}
            </div>

            {!isSelf(selected) && !(selected.membership.role === "Owner" && !isOrganizationOwner) ? (
              <div className="rounded-lg border border-u-line p-3">
                <p className="text-[11.5px] font-semibold text-u-ink">Membership access</p>
                <div className="mt-2 flex flex-col gap-1.5">
                  {selected.membership.status === "active" ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={ShieldOff}
                      className="justify-start"
                      disabled={selected.isLastActiveOwner}
                      onClick={() => askConfirm("suspend", selected)}
                    >
                      Suspend membership
                    </Button>
                  ) : (
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={UserCheck}
                      className="justify-start"
                      onClick={() => askConfirm("reactivate", selected)}
                    >
                      Reactivate membership
                    </Button>
                  )}
                  {isOrganizationOwner && selected.membership.status === "active" && selected.membership.role !== "Owner" ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={Crown}
                      className="justify-start"
                      onClick={() => askConfirm("transfer", selected)}
                    >
                      Transfer ownership to {selected.user.fullName.split(" ")[0]}
                    </Button>
                  ) : null}
                  <Button
                    variant="danger"
                    size="sm"
                    icon={Trash2}
                    className="justify-start"
                    disabled={selected.isLastActiveOwner}
                    onClick={() => askConfirm("remove", selected)}
                  >
                    Remove from organization
                  </Button>
                </div>
                <p className="mt-2 flex items-start gap-1 text-[9.5px] leading-relaxed text-u-muted">
                  <AlertTriangle className="mt-0.5 size-2.5 shrink-0" />
                  {activeRole === "Administrator"
                    ? "Administrators cannot change, suspend, or remove an Owner."
                    : "The last active Owner must remain in the organization."}
                </p>
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>

      {/* Confirmation */}
      <Modal
        open={Boolean(confirm)}
        onClose={() => (confirming ? undefined : setConfirm(null))}
        title={confirm ? confirmCopy[confirm.type].title : "Confirm action"}
        description={confirm ? `${confirm.member.user.fullName} · ${confirm.member.user.email}` : undefined}
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setConfirm(null)} disabled={confirming}>
              Cancel
            </Button>
            <Button
              variant={confirm && confirmCopy[confirm.type].danger ? "danger" : "primary"}
              size="sm"
              loading={confirming}
              onClick={runConfirm}
            >
              {confirm ? confirmCopy[confirm.type].cta : "Confirm"}
            </Button>
          </>
        }
      >
        {confirm ? (
          <div className="space-y-2.5">
            <p className="text-[12px] leading-relaxed text-u-ink2">{confirmCopy[confirm.type].description}</p>
            {safeguardingOwner && confirm.type !== "reactivate" ? (
              <Alert tone="danger" title="Safeguard blocked">
                The final active Owner cannot be removed, suspended, or demoted. Transfer ownership first.
              </Alert>
            ) : null}
            <div className="flex items-center gap-2 rounded-lg border border-u-line bg-u-s2/70 px-3 py-2 text-[10.5px] text-u-muted">
              <UserCheck className="size-3.5" />
              A mock activity log entry will be created for this action.
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}