import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { MembershipStatus, Organization, OrganizationInput, Role } from "../lib/types";
import { isManagerRole, isOwner } from "../lib/format";
import { useAuth } from "./AuthContext";
import { setActiveOrgId as publishActiveOrg } from "../../lib/activeOrg";
import {
  invitationService,
  membershipService,
  organizationService,
  type InvitationWithContext,
  type UserWorkspace,
} from "../services";

type Workspace = UserWorkspace;
type UserInvitation = InvitationWithContext;

interface OrganizationContextValue {
  loading: boolean;
  switching: boolean;
  workspaces: Workspace[];
  memberships: Workspace["membership"][];
  suspendedWorkspaces: Workspace[];
  pendingInvitations: UserInvitation[];
  allMyInvitations: UserInvitation[];
  activeOrganization: Organization | null;
  activeRole: Role | null;
  activeOrgId: string | null;
  canManage: boolean;
  isOrganizationOwner: boolean;
  revision: number;
  switchOrganization: (organizationId: string) => Promise<Organization>;
  createOrganization: (input: OrganizationInput) => Promise<Organization>;
  updateOrganization: (input: OrganizationInput) => Promise<void>;
  acceptInvitation: (invitationId: string) => Promise<Organization>;
  declineInvitation: (invitationId: string) => Promise<void>;
  refreshWorkspaces: () => Promise<void>;
  refreshInvitations: () => Promise<void>;
  inviteMember: (email: string, role: Role) => Promise<void>;
  updateMemberRole: (membershipId: string, role: Role) => Promise<void>;
  setMemberStatus: (membershipId: string, status: MembershipStatus) => Promise<void>;
  removeMember: (membershipId: string) => Promise<void>;
  transferOwnership: (membershipId: string) => Promise<void>;
  revokeInvitation: (invitationId: string) => Promise<void>;
  resendInvitation: (invitationId: string) => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextValue | null>(null);

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [suspendedWorkspaces, setSuspendedWorkspaces] = useState<Workspace[]>([]);
  const [allMyInvitations, setAllMyInvitations] = useState<UserInvitation[]>([]);
  const [activeOrgId, setActiveOrgId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null);
  const [switching, setSwitching] = useState(false);
  const [revision, setRevision] = useState(0);
  const activeOrgRef = useRef<string | null>(null);
  const requestId = useRef(0);

  activeOrgRef.current = activeOrgId;

  // data modules outside React (property store, ...) follow the selected organization
  useEffect(() => {
    publishActiveOrg(activeOrgId);
  }, [activeOrgId]);

  const loadInvitations = useCallback(async (email: string) => {
    const invitations = await invitationService.listInvitationsForEmail(email);
    setAllMyInvitations(invitations);
  }, []);

  useEffect(() => {
    const currentUserId = user?.id;
    const ticket = ++requestId.current;

    if (!currentUserId) {
      setWorkspaces([]);
      setSuspendedWorkspaces([]);
      setAllMyInvitations([]);
      setActiveOrgId(null);
      setLoadedUserId(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setActiveOrgId(null);
    (async () => {
      try {
        const [active, suspended, invitations] = await Promise.all([
          membershipService.listUserWorkspaces(currentUserId),
          membershipService.listUserSuspendedWorkspaces(currentUserId),
          invitationService.listInvitationsForEmail(user.email),
        ]);
        if (ticket !== requestId.current) return;

        setWorkspaces(active);
        setSuspendedWorkspaces(suspended);
        setAllMyInvitations(invitations);

        const storedId = await membershipService.getActiveOrganizationId(currentUserId);
        let chosen = active.find((workspace) => workspace.organization.id === storedId) ?? null;
        if (!chosen && active.length === 1) {
          chosen = active[0];
          await membershipService.switchActiveOrganization(currentUserId, chosen.organization.id);
          if (ticket !== requestId.current) return;
        }
        setActiveOrgId(chosen?.organization.id ?? null);
      } catch {
        if (ticket === requestId.current) {
          setWorkspaces([]);
          setSuspendedWorkspaces([]);
          setAllMyInvitations([]);
          setActiveOrgId(null);
        }
      } finally {
        if (ticket === requestId.current) {
          setLoading(false);
          // Marks which user's organization state is fully resolved. Route guards
          // use this to avoid redirecting during the render between "signed in"
          // and "memberships loaded".
          setLoadedUserId(currentUserId);
        }
      }
    })();
  }, [user?.id, user?.email]);

  const syncWorkspaces = useCallback(async (preferredId?: string | null) => {
    if (!user) return;
    const ticket = ++requestId.current;
    const [active, suspended] = await Promise.all([
      membershipService.listUserWorkspaces(user.id),
      membershipService.listUserSuspendedWorkspaces(user.id),
    ]);
    if (ticket !== requestId.current) return;
    setWorkspaces(active);
    setSuspendedWorkspaces(suspended);

    const desired = preferredId ?? activeOrgRef.current;
    let chosen = active.find((workspace) => workspace.organization.id === desired) ?? null;
    if (!chosen && active.length === 1) {
      chosen = active[0];
      await membershipService.switchActiveOrganization(user.id, chosen.organization.id);
    }
    setActiveOrgId(chosen?.organization.id ?? null);
  }, [user]);

  const refreshWorkspaces = useCallback(async () => {
    setSwitching(true);
    try {
      await syncWorkspaces();
    } finally {
      setSwitching(false);
    }
  }, [syncWorkspaces]);

  const refreshInvitations = useCallback(async () => {
    if (user) await loadInvitations(user.email);
  }, [user, loadInvitations]);

  const switchOrganization = useCallback(
    async (organizationId: string) => {
      if (!user) throw new Error("Please sign in again.");
      setSwitching(true);
      try {
        const organization = await membershipService.switchActiveOrganization(user.id, organizationId);
        setActiveOrgId(organization.id);
        activeOrgRef.current = organization.id;
        setRevision((value) => value + 1);
        return organization;
      } finally {
        setSwitching(false);
      }
    },
    [user]
  );

  const createOrganization = useCallback(
    async (input: OrganizationInput) => {
      if (!user) throw new Error("Please sign in again.");
      const organization = await organizationService.createOrganizationWithOwner(user.id, input);
      await syncWorkspaces(organization.id);
      setActiveOrgId(organization.id);
      activeOrgRef.current = organization.id;
      setRevision((value) => value + 1);
      return organization;
    },
    [user, syncWorkspaces]
  );

  const updateOrganization = useCallback(
    async (input: OrganizationInput) => {
      if (!user || !activeOrgRef.current) throw new Error("Select an organization first.");
      await organizationService.updateOrganization(user.id, activeOrgRef.current, input);
      await syncWorkspaces(activeOrgRef.current);
      setRevision((value) => value + 1);
    },
    [user, syncWorkspaces]
  );

  const acceptInvitation = useCallback(
    async (invitationId: string) => {
      if (!user) throw new Error("Please sign in again.");
      const organization = await invitationService.acceptInvitation(invitationId, user);
      await Promise.all([syncWorkspaces(organization.id), loadInvitations(user.email)]);
      setActiveOrgId(organization.id);
      activeOrgRef.current = organization.id;
      setRevision((value) => value + 1);
      return organization;
    },
    [user, syncWorkspaces, loadInvitations]
  );

  const declineInvitation = useCallback(
    async (invitationId: string) => {
      if (!user) throw new Error("Please sign in again.");
      await invitationService.declineInvitation(invitationId, user);
      await loadInvitations(user.email);
    },
    [user, loadInvitations]
  );

  const inviteMember = useCallback(
    async (email: string, role: Role) => {
      if (!user || !activeOrgRef.current) throw new Error("Select an organization first.");
      await invitationService.createInvitation({
        actorId: user.id,
        organizationId: activeOrgRef.current,
        email,
        role,
      });
      setRevision((value) => value + 1);
    },
    [user]
  );

  const updateMemberRole = useCallback(
    async (membershipId: string, role: Role) => {
      if (!user || !activeOrgRef.current) throw new Error("Select an organization first.");
      await membershipService.updateMembershipRole({
        actorId: user.id,
        actorName: user.fullName,
        organizationId: activeOrgRef.current,
        membershipId,
        role,
      });
      setRevision((value) => value + 1);
    },
    [user]
  );

  const setMemberStatus = useCallback(
    async (membershipId: string, status: MembershipStatus) => {
      if (!user || !activeOrgRef.current) throw new Error("Select an organization first.");
      await membershipService.setMembershipStatus({
        actorId: user.id,
        organizationId: activeOrgRef.current,
        membershipId,
        status,
      });
      setRevision((value) => value + 1);
    },
    [user]
  );

  const removeMember = useCallback(
    async (membershipId: string) => {
      if (!user || !activeOrgRef.current) throw new Error("Select an organization first.");
      await membershipService.removeMembership({
        actorId: user.id,
        organizationId: activeOrgRef.current,
        membershipId,
      });
      setRevision((value) => value + 1);
    },
    [user]
  );

  const transferOwnership = useCallback(
    async (membershipId: string) => {
      if (!user || !activeOrgRef.current) throw new Error("Select an organization first.");
      await membershipService.transferOwnership({
        actorId: user.id,
        organizationId: activeOrgRef.current,
        membershipId,
      });
      await syncWorkspaces(activeOrgRef.current);
      setRevision((value) => value + 1);
    },
    [user, syncWorkspaces]
  );

  const revokeInvitation = useCallback(
    async (invitationId: string) => {
      if (!user || !activeOrgRef.current) throw new Error("Select an organization first.");
      await invitationService.revokeInvitation({
        actorId: user.id,
        organizationId: activeOrgRef.current,
        invitationId,
      });
      setRevision((value) => value + 1);
    },
    [user]
  );

  const resendInvitation = useCallback(
    async (invitationId: string) => {
      if (!user || !activeOrgRef.current) throw new Error("Select an organization first.");
      await invitationService.resendInvitation({
        actorId: user.id,
        organizationId: activeOrgRef.current,
        invitationId,
      });
      setRevision((value) => value + 1);
    },
    [user]
  );

  const activeWorkspace = workspaces.find((workspace) => workspace.organization.id === activeOrgId) ?? null;
  const activeOrganization = activeWorkspace?.organization ?? null;
  const activeRole = activeWorkspace?.membership.role ?? null;
  const pendingInvitations = allMyInvitations.filter((invitation) => invitation.effectiveStatus === "pending");
  const resolvedLoading = Boolean(user) && (loading || loadedUserId !== user?.id);

  const value = useMemo<OrganizationContextValue>(
    () => ({
      loading: resolvedLoading,
      switching,
      workspaces,
      memberships: workspaces.map((workspace) => workspace.membership),
      suspendedWorkspaces,
      pendingInvitations,
      allMyInvitations,
      activeOrganization,
      activeRole,
      activeOrgId,
      canManage: isManagerRole(activeRole),
      isOrganizationOwner: isOwner(activeRole),
      revision,
      switchOrganization,
      createOrganization,
      updateOrganization,
      acceptInvitation,
      declineInvitation,
      refreshWorkspaces,
      refreshInvitations,
      inviteMember,
      updateMemberRole,
      setMemberStatus,
      removeMember,
      transferOwnership,
      revokeInvitation,
      resendInvitation,
    }),
    [
      resolvedLoading,
      switching,
      workspaces,
      suspendedWorkspaces,
      pendingInvitations,
      allMyInvitations,
      activeOrganization,
      activeRole,
      activeOrgId,
      revision,
      switchOrganization,
      createOrganization,
      updateOrganization,
      acceptInvitation,
      declineInvitation,
      refreshWorkspaces,
      refreshInvitations,
      inviteMember,
      updateMemberRole,
      setMemberStatus,
      removeMember,
      transferOwnership,
      revokeInvitation,
      resendInvitation,
    ]
  );

  return <OrganizationContext.Provider value={value}>{children}</OrganizationContext.Provider>;
}

export function useOrganization(): OrganizationContextValue {
  const context = useContext(OrganizationContext);
  if (!context) throw new Error("useOrganization must be used inside OrganizationProvider");
  return context;
}
