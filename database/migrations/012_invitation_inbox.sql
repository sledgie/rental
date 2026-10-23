-- =====================================================================================================================
-- 012_invitation_inbox.sql
-- Read-only RPCs the web app needs because Row-Level Security (correctly) hides organizations from non-members:
--   * public.list_my_invitations()          invitations addressed to the caller's JWT email, with organization and inviter names
--   * public.list_my_suspended_workspaces() the caller's suspended memberships, with the organization name
-- Both derive the caller from auth.uid()/auth.jwt(); nothing is trusted from the client. Executable by "authenticated" only.
-- =====================================================================================================================
begin;
set local search_path = public, extensions;

create or replace function public.list_my_invitations()
returns table (id uuid, organization_id uuid, organization_name text, organization_status text, email text, role text, status text,
               invited_by uuid, inviter_name text, created_at timestamptz, expires_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select i.id, i.organization_id, o.name, o.status, i.email, i.role, i.status, i.invited_by,
         coalesce(nullif(btrim(p.full_name), ''), p.email, 'Workspace team'), i.created_at, i.expires_at
    from public.organization_invitations i
    join public.organizations o on o.id = i.organization_id
    left join public.profiles p on p.id = i.invited_by
   where i.email = lower(coalesce((select auth.jwt()) ->> 'email', ''))
   order by i.created_at desc;
$$;

create or replace function public.list_my_suspended_workspaces()
returns table (membership_id uuid, organization_id uuid, organization_name text, role text, joined_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select m.id, m.organization_id, o.name, m.role, m.joined_at
    from public.organization_members m
    join public.organizations o on o.id = m.organization_id
   where m.user_id = (select auth.uid()) and m.status = 'suspended'
   order by o.name;
$$;

revoke all on function public.list_my_invitations(), public.list_my_suspended_workspaces() from public, anon;
grant execute on function public.list_my_invitations(), public.list_my_suspended_workspaces() to authenticated;

commit;
