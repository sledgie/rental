-- =====================================================================================================================
-- 002_organization_security.sql
-- Authorization helpers, signup/onboarding, membership guards and Row-Level Security for the core tables.
--
-- Security model
--   * Authorization is decided in the database from auth.uid() + organization_members + the permission catalog. A client-supplied
--     organization_id is never trusted by itself: policies check the caller's membership of THAT organization, and composite
--     foreign keys (organization_id, parent_id) stop a row from referencing another organization's data.
--   * Helper functions are SECURITY DEFINER with search_path = '' (fully qualified names), live in schema "private" (not exposed by the
--     Data API), and are executable by "authenticated" only. They read organization_members without triggering RLS recursion.
--   * Public RPC entry points (create_organization, accept_invitation, ...) are SECURITY DEFINER, derive the actor from auth.uid(),
--     and are executable by "authenticated" only.
-- =====================================================================================================================
begin;
set local search_path = public, extensions;

grant usage on schema private to authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------------------
-- Authorization helpers
-- ---------------------------------------------------------------------------------------------------------------------
create or replace function private.is_org_member(p_org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
      from public.organization_members m
      join public.profiles p on p.id = m.user_id
     where m.organization_id = p_org
       and m.user_id = (select auth.uid())
       and m.status = 'active'
       and p.status = 'active');
$$;

create or replace function private.org_role(p_org uuid) returns text
language sql stable security definer set search_path = '' as $$
  select m.role
    from public.organization_members m
    join public.profiles p on p.id = m.user_id
   where m.organization_id = p_org
     and m.user_id = (select auth.uid())
     and m.status = 'active'
     and p.status = 'active'
   limit 1;
$$;

-- Owner always passes. Otherwise an organization override wins; if there is none the global role default applies.
create or replace function private.has_permission(p_org uuid, p_permission text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare
  v_role text := private.org_role(p_org);
  v_override boolean;
begin
  if v_role is null then return false; end if;
  if v_role = 'owner' then return true; end if;
  select o.granted into v_override
    from public.organization_role_permissions o
   where o.organization_id = p_org and o.role = v_role and o.permission = p_permission;
  if found then return v_override; end if;
  return exists (select 1 from public.role_permissions r where r.role = v_role and r.permission = p_permission);
end $$;

-- True when the caller and another user share at least one active organization (used to let co-members read each other's profile).
create or replace function private.shares_org_with(p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
      from public.organization_members a
      join public.organization_members b on b.organization_id = a.organization_id
     where a.user_id = (select auth.uid()) and a.status = 'active'
       and b.user_id = p_user and b.status = 'active');
$$;

-- Which permission is needed to edit a settings category.
create or replace function private.setting_edit_permission(p_category text) returns text
language sql immutable set search_path = '' as $$
  select case p_category
    when 'financial' then 'manage_finance'
    when 'bank_reconciliation' then 'manage_finance'
    when 'deposits' then 'manage_finance'
    when 'property' then 'manage_properties'
    when 'maintenance' then 'manage_maintenance'
    when 'projects' then 'manage_projects'
    when 'notifications' then 'manage_communications'
    when 'documents' then 'manage_documents'
    when 'data' then 'export_data'
    else 'manage_settings' end;
$$;

-- Next number from an organization counter, e.g. private.next_number(org, 'invoice'). Atomic; safe under concurrency.
create or replace function private.next_number(p_org uuid, p_key text) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  v_value bigint;
begin
  insert into public.organization_counters (organization_id, counter_key, last_value)
  values (p_org, p_key, 1)
  on conflict (organization_id, counter_key) do update set last_value = public.organization_counters.last_value + 1
  returning last_value into v_value;
  return v_value;
end $$;

-- Internal audit writer (used by triggers and RPCs). Not executable by API roles.
create or replace function private.log_activity(
  p_org uuid, p_actor uuid, p_actor_type text, p_action text, p_category text, p_description text,
  p_entity_type text, p_entity_id text, p_label text default '', p_changes jsonb default '[]'::jsonb,
  p_outcome text default 'success', p_severity text default 'informational', p_source text default '',
  p_reason text default null, p_metadata jsonb default '{}'::jsonb, p_property uuid default null,
  p_unit uuid default null, p_tenant uuid default null, p_correlation text default '', p_sensitive jsonb default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid := gen_random_uuid();
  v_name text;
  v_public jsonb;
  v_restricted jsonb;
  v_detail jsonb;
begin
  select coalesce(nullif(btrim(pr.full_name), ''), pr.email) into v_name from public.profiles pr where pr.id = p_actor;
  v_name := coalesce(v_name, case p_actor_type when 'system' then 'System' when 'scheduled_job' then 'Scheduled job'
                                               when 'integration' then 'Integration' else 'Unknown user' end);
  -- values of changes flagged "restricted" never go into the readable event; they move to the restricted detail row
  select coalesce(jsonb_agg(case when c ->> 'sensitivity' = 'restricted' then c || '{"previousValue": null, "newValue": null}'::jsonb else c end), '[]'::jsonb),
         nullif(jsonb_agg(c) filter (where c ->> 'sensitivity' = 'restricted'), 'null'::jsonb)
    into v_public, v_restricted from jsonb_array_elements(coalesce(p_changes, '[]'::jsonb)) c;
  v_detail := nullif(jsonb_strip_nulls(jsonb_build_object('metadata', p_sensitive, 'restrictedChanges', v_restricted)), '{}'::jsonb);
  insert into public.activity_events (id, organization_id, actor_id, actor_type, actor_display_name, action, category, description,
                                      entity_type, entity_id, related_record_label, property_id, unit_id, tenant_id, changes, outcome,
                                      severity, source_module, correlation_id, reason, metadata, sensitive_digest, previous_hash, event_hash)
  values (v_id, p_org, p_actor, p_actor_type, v_name, p_action, p_category, p_description,
          p_entity_type, p_entity_id, coalesce(p_label, ''), p_property, p_unit, p_tenant, v_public, p_outcome,
          p_severity, coalesce(p_source, ''), coalesce(nullif(p_correlation, ''), 'cor_' || p_entity_id), p_reason,
          coalesce(p_metadata, '{}'::jsonb), case when v_detail is null then null else encode(sha256(convert_to(v_detail::text, 'UTF8')), 'hex') end, '', '');   -- hash columns are filled by the chain trigger
  if v_detail is not null then
    insert into public.activity_event_details (organization_id, event_id, sensitive) values (p_org, v_id, v_detail);
  end if;
  return v_id;
end $$;

revoke all on function private.log_activity(uuid, uuid, text, text, text, text, text, text, text, jsonb, text, text, text, text, jsonb, uuid, uuid, uuid, text, jsonb) from public;
revoke all on function private.next_number(uuid, text) from public, anon;
revoke all on function private.is_org_member(uuid), private.org_role(uuid), private.has_permission(uuid, text), private.shares_org_with(uuid),
                       private.setting_edit_permission(text) from public, anon;
grant execute on function private.is_org_member(uuid), private.org_role(uuid), private.has_permission(uuid, text), private.shares_org_with(uuid),
                          private.setting_edit_permission(text) to authenticated, service_role;
grant execute on function private.next_number(uuid, text) to authenticated, service_role;  -- called inside RPCs/triggers that run as the caller

-- Public wrapper so the application can record its own user actions. The actor is ALWAYS the caller; any member may record.
create or replace function public.record_activity(
  p_org uuid, p_action text, p_category text, p_description text, p_entity_type text, p_entity_id text,
  p_label text default '', p_changes jsonb default '[]'::jsonb, p_outcome text default 'success', p_severity text default 'informational',
  p_source_module text default '', p_reason text default null, p_metadata jsonb default '{}'::jsonb,
  p_property_id uuid default null, p_unit_id uuid default null, p_tenant_id uuid default null, p_correlation_id text default '',
  p_sensitive jsonb default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null or not private.is_org_member(p_org) then
    raise exception 'not a member of this organization' using errcode = '42501';
  end if;
  return private.log_activity(p_org, (select auth.uid()), 'user', p_action, p_category, p_description, p_entity_type, p_entity_id, p_label,
                              p_changes, p_outcome, p_severity, p_source_module, p_reason, p_metadata, p_property_id, p_unit_id, p_tenant_id,
                              p_correlation_id, p_sensitive);
end $$;
revoke all on function public.record_activity(uuid, text, text, text, text, text, text, jsonb, text, text, text, text, jsonb, uuid, uuid, uuid, text, jsonb) from public, anon;
grant execute on function public.record_activity(uuid, text, text, text, text, text, text, jsonb, text, text, text, text, jsonb, uuid, uuid, uuid, text, jsonb) to authenticated;

-- ---------------------------------------------------------------------------------------------------------------------
-- Signup: create the profile (and default preferences) when Supabase Auth creates a user. Uses only values that always exist.
-- It never raises for missing metadata; organization onboarding is a separate, explicit step (public.create_organization).
-- ---------------------------------------------------------------------------------------------------------------------
create or replace function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_name text := coalesce(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''), nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
                          nullif(split_part(coalesce(new.email, ''), '@', 1), ''), 'New user');
begin
  insert into public.profiles (id, email, full_name) values (new.id, new.email, v_name) on conflict (id) do nothing;
  insert into public.user_preferences (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end $$;

create or replace function private.handle_user_email_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles set email = new.email where id = new.id and email is distinct from new.email;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function private.handle_new_user();
drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed after update of email on auth.users for each row execute function private.handle_user_email_change();

-- ---------------------------------------------------------------------------------------------------------------------
-- Membership guards: owners are protected, the last active owner can never be removed/demoted/suspended.
-- ---------------------------------------------------------------------------------------------------------------------
create or replace function private.guard_member_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid := coalesce(new.organization_id, old.organization_id);
  v_caller_role text;
begin
  -- Cascading cleanup of a deleted organization (controlled closure path) is allowed.
  if tg_op = 'DELETE' and not exists (select 1 from public.organizations o where o.id = v_org) then
    return old;
  end if;

  -- The very first member of an organization is its owner (created by public.create_organization).
  if tg_op = 'INSERT' and new.role = 'owner'
     and not exists (select 1 from public.organization_members m where m.organization_id = v_org and m.role = 'owner' and m.status = 'active') then
    return new;
  end if;

  -- Last active owner protection (applies to everyone, including service role).
  if tg_op in ('UPDATE', 'DELETE') and old.role = 'owner' and old.status = 'active'
     and (tg_op = 'DELETE' or new.role <> 'owner' or new.status <> 'active')
     and not exists (select 1 from public.organization_members m
                      where m.organization_id = old.organization_id and m.role = 'owner' and m.status = 'active' and m.id <> old.id) then
    raise exception 'An organization must keep at least one active owner' using errcode = '23514';
  end if;

  -- Only owners may create, change or remove owners. (auth.uid() is null for the service role / migrations.)
  if (select auth.uid()) is not null then
    v_caller_role := private.org_role(v_org);
    if (coalesce(new.role, '') = 'owner' or coalesce(old.role, '') = 'owner') and v_caller_role is distinct from 'owner'
       and not (tg_op = 'UPDATE' and old.user_id = (select auth.uid()) and new.role = old.role) then
      raise exception 'Only an owner can grant, change or remove the owner role' using errcode = '42501';
    end if;
  end if;
  return coalesce(new, old);
end $$;
create trigger organization_members_guard before insert or update or delete on public.organization_members
  for each row execute function private.guard_member_change();

create or replace function private.audit_member_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid := coalesce(new.organization_id, old.organization_id);
  v_user uuid := coalesce(new.user_id, old.user_id);
  v_actor uuid := (select auth.uid());
  v_name text;
begin
  if not exists (select 1 from public.organizations o where o.id = v_org) then return null; end if;
  select coalesce(nullif(btrim(full_name), ''), email) into v_name from public.profiles where id = v_user;
  if tg_op = 'INSERT' then
    perform private.log_activity(v_org, v_actor, case when v_actor is null then 'system' else 'user' end, 'user.activated', 'Users & Security',
      format('%s joined as %s.', coalesce(v_name, 'A user'), new.role), 'user', v_user::text, coalesce(v_name, ''),
      jsonb_build_array(jsonb_build_object('field', 'role', 'label', 'Role', 'previousValue', null, 'newValue', new.role, 'changeType', 'added')),
      'success', 'informational', 'Organization members');
  elsif tg_op = 'DELETE' then
    perform private.log_activity(v_org, v_actor, case when v_actor is null then 'system' else 'user' end, 'user.deactivated', 'Users & Security',
      format('%s was removed from the organization.', coalesce(v_name, 'A user')), 'user', v_user::text, coalesce(v_name, ''),
      '[]'::jsonb, 'success', 'warning', 'Organization members');
  else
    if new.role is distinct from old.role then
      perform private.log_activity(v_org, v_actor, case when v_actor is null then 'system' else 'user' end, 'user.role_changed', 'Users & Security',
        format('Role changed for %s: %s to %s.', coalesce(v_name, 'a user'), old.role, new.role), 'user', v_user::text, coalesce(v_name, ''),
        jsonb_build_array(jsonb_build_object('field', 'role', 'label', 'Role', 'previousValue', old.role, 'newValue', new.role, 'changeType', 'modified')),
        'success', 'warning', 'Organization members');
    end if;
    if new.status is distinct from old.status then
      perform private.log_activity(v_org, v_actor, case when v_actor is null then 'system' else 'user' end,
        case when new.status = 'suspended' then 'user.deactivated' else 'user.activated' end, 'Users & Security',
        format('%s was %s.', coalesce(v_name, 'A user'), case when new.status = 'suspended' then 'suspended' else 'reactivated' end),
        'user', v_user::text, coalesce(v_name, ''),
        jsonb_build_array(jsonb_build_object('field', 'status', 'label', 'Membership status', 'previousValue', old.status, 'newValue', new.status, 'changeType', 'modified')),
        'success', 'warning', 'Organization members');
    end if;
  end if;
  return null;
end $$;
create trigger organization_members_audit after insert or update or delete on public.organization_members
  for each row execute function private.audit_member_change();

-- ---------------------------------------------------------------------------------------------------------------------
-- Onboarding / membership RPCs
-- ---------------------------------------------------------------------------------------------------------------------
-- Creates an organization and makes the caller its owner in ONE transaction (the app's "Create organization" step).
create or replace function public.create_organization(
  p_name text, p_business_type text default 'individual_landlord', p_country text default 'Canada',
  p_currency text default 'CAD', p_timezone text default 'America/Toronto'
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
  v_org uuid;
begin
  if v_user is null then raise exception 'authentication required' using errcode = '28000'; end if;
  if not exists (select 1 from public.profiles where id = v_user and status = 'active') then
    raise exception 'profile missing or deactivated' using errcode = '42501';
  end if;
  insert into public.organizations (name, business_type, country, currency, timezone, created_by)
  values (btrim(p_name), coalesce(p_business_type, 'individual_landlord'), coalesce(p_country, 'Canada'), upper(coalesce(p_currency, 'CAD')),
          coalesce(p_timezone, 'America/Toronto'), v_user)
  returning id into v_org;
  insert into public.organization_members (organization_id, user_id, role, status, invited_by) values (v_org, v_user, 'owner', 'active', v_user);
  insert into public.audit_policies (organization_id, updated_by) values (v_org, v_user);
  insert into public.user_preferences (user_id, active_organization_id) values (v_user, v_org)
    on conflict (user_id) do update set active_organization_id = excluded.active_organization_id;
  perform private.seed_organization_defaults(v_org);
  perform private.log_activity(v_org, v_user, 'user', 'security.settings_changed', 'Users & Security',
          format('Organization "%s" created.', btrim(p_name)), 'organization', v_org::text, btrim(p_name), '[]'::jsonb,
          'success', 'informational', 'Onboarding');
  return v_org;
end $$;

create or replace function public.switch_active_organization(p_org uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_org_member(p_org) then raise exception 'not a member of this organization' using errcode = '42501'; end if;
  insert into public.user_preferences (user_id, active_organization_id) values ((select auth.uid()), p_org)
    on conflict (user_id) do update set active_organization_id = excluded.active_organization_id;
end $$;

-- The invitee accepts an invitation addressed to the email on their JWT. Creates/reactivates the membership atomically.
create or replace function public.accept_invitation(p_invitation uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
  v_email text := lower(coalesce((select auth.jwt()) ->> 'email', ''));
  v_inv public.organization_invitations%rowtype;
begin
  if v_user is null then raise exception 'authentication required' using errcode = '28000'; end if;
  select * into v_inv from public.organization_invitations where id = p_invitation for update;
  if not found or v_inv.email <> v_email then raise exception 'invitation not found' using errcode = 'P0002'; end if;
  if v_inv.status <> 'pending' then raise exception 'invitation is %', v_inv.status using errcode = '22023'; end if;
  if v_inv.expires_at < now() then
    update public.organization_invitations set status = 'expired', responded_at = now() where id = v_inv.id;
    raise exception 'invitation expired' using errcode = '22023';
  end if;
  insert into public.organization_members (organization_id, user_id, role, status, invited_by)
  values (v_inv.organization_id, v_user, v_inv.role, 'active', v_inv.invited_by)
  on conflict (organization_id, user_id) do update set role = excluded.role, status = 'active';
  update public.organization_invitations set status = 'accepted', accepted_by = v_user, responded_at = now() where id = v_inv.id;
  insert into public.user_preferences (user_id, active_organization_id) values (v_user, v_inv.organization_id)
    on conflict (user_id) do update set active_organization_id = coalesce(public.user_preferences.active_organization_id, excluded.active_organization_id);
  return v_inv.organization_id;
end $$;

create or replace function public.decline_invitation(p_invitation uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_email text := lower(coalesce((select auth.jwt()) ->> 'email', ''));
begin
  update public.organization_invitations set status = 'declined', responded_at = now()
   where id = p_invitation and email = v_email and status = 'pending';
  if not found then raise exception 'invitation not found' using errcode = 'P0002'; end if;
end $$;

-- Ownership transfer: the current owner promotes another active member and becomes an administrator.
create or replace function public.transfer_ownership(p_org uuid, p_new_owner uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
begin
  if private.org_role(p_org) is distinct from 'owner' then raise exception 'only an owner can transfer ownership' using errcode = '42501'; end if;
  if p_new_owner = v_user then raise exception 'choose a different member' using errcode = '22023'; end if;
  if not exists (select 1 from public.organization_members where organization_id = p_org and user_id = p_new_owner and status = 'active') then
    raise exception 'new owner must be an active member' using errcode = '22023';
  end if;
  update public.organization_members set role = 'owner' where organization_id = p_org and user_id = p_new_owner;
  update public.organization_members set role = 'administrator' where organization_id = p_org and user_id = v_user;
end $$;

revoke all on function public.create_organization(text, text, text, text, text), public.switch_active_organization(uuid),
                       public.accept_invitation(uuid), public.decline_invitation(uuid), public.transfer_ownership(uuid, uuid) from public, anon;
grant execute on function public.create_organization(text, text, text, text, text), public.switch_active_organization(uuid),
                          public.accept_invitation(uuid), public.decline_invitation(uuid), public.transfer_ownership(uuid, uuid) to authenticated;

-- Default per-organization data (chart of accounts, settings, categories). Real body is defined in 010_reference_data.sql;
-- this stub keeps create_organization valid if migrations are applied one at a time.
create or replace function private.seed_organization_defaults(p_org uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  null;
end $$;
revoke all on function private.seed_organization_defaults(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------------------------------
-- Reusable policy generator for organization-owned tables.
--   p_read   permission needed to SELECT (NULL = any active member)
--   p_write  permission needed to INSERT/UPDATE (NULL = no write policies are created)
--   p_delete permission needed to DELETE (default: same as p_write; pass 'none' to create no delete policy)
-- The generated policies are ordinary CREATE POLICY statements, visible in pg_policies.
-- ---------------------------------------------------------------------------------------------------------------------
create or replace procedure private.apply_org_policies(p_table regclass, p_read text, p_write text, p_delete text default null)
language plpgsql set search_path = public as $$
declare
  v_read_check text := case when p_read is null then 'private.is_org_member(organization_id)'
                            else format('private.has_permission(organization_id, %L)', p_read) end;
  v_del text := coalesce(p_delete, p_write);
begin
  execute format('alter table %s enable row level security', p_table);
  execute format('drop policy if exists org_select on %s', p_table);
  execute format('create policy org_select on %s for select to authenticated using (%s)', p_table, v_read_check);
  if p_write is not null then
    execute format('drop policy if exists org_insert on %s', p_table);
    execute format('create policy org_insert on %s for insert to authenticated with check (private.has_permission(organization_id, %L))', p_table, p_write);
    execute format('drop policy if exists org_update on %s', p_table);
    execute format('create policy org_update on %s for update to authenticated using (private.has_permission(organization_id, %L)) with check (private.has_permission(organization_id, %L))', p_table, p_write, p_write);
  end if;
  if v_del is not null and v_del <> 'none' then
    execute format('drop policy if exists org_delete on %s', p_table);
    execute format('create policy org_delete on %s for delete to authenticated using (private.has_permission(organization_id, %L))', p_table, v_del);
  end if;
  execute format('revoke all on %s from anon', p_table);
  execute format('grant select%s%s on %s to authenticated',
                 case when p_write is not null then ', insert, update' else '' end,
                 case when v_del is not null and v_del <> 'none' then ', delete' else '' end, p_table);
end $$;

-- ---------------------------------------------------------------------------------------------------------------------
-- RLS for the core tables
-- ---------------------------------------------------------------------------------------------------------------------
alter table public.profiles                      enable row level security;
alter table public.user_preferences              enable row level security;
alter table public.organizations                 enable row level security;
alter table public.organization_members          enable row level security;
alter table public.organization_invitations      enable row level security;
alter table public.permissions                   enable row level security;
alter table public.role_permissions              enable row level security;
alter table public.organization_role_permissions enable row level security;
alter table public.organization_settings         enable row level security;
alter table public.organization_counters         enable row level security;   -- no policies: reachable only through private.next_number()
alter table public.activity_events               enable row level security;
alter table public.audit_policies                enable row level security;
alter table public.audit_exports                 enable row level security;
alter table public.activity_event_details        enable row level security;

-- profiles: your own row, or a co-member's. Users edit only their own profile; rows are created by the signup trigger.
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or private.shares_org_with(id));
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()) and status = 'active');

create policy user_preferences_select on public.user_preferences for select to authenticated using (user_id = (select auth.uid()));
create policy user_preferences_insert on public.user_preferences for insert to authenticated
  with check (user_id = (select auth.uid()) and (active_organization_id is null or private.is_org_member(active_organization_id)));
create policy user_preferences_update on public.user_preferences for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and (active_organization_id is null or private.is_org_member(active_organization_id)));

create policy organizations_select on public.organizations for select to authenticated using (private.is_org_member(id));
create policy organizations_update on public.organizations for update to authenticated
  using (private.has_permission(id, 'manage_settings')) with check (private.has_permission(id, 'manage_settings'));

create policy organization_members_select on public.organization_members for select to authenticated using (private.is_org_member(organization_id));
-- No INSERT policy: a membership is created only by public.create_organization, public.accept_invitation (the invitee's own consent) or the service role.
create policy organization_members_update on public.organization_members for update to authenticated
  using (private.has_permission(organization_id, 'manage_members')) with check (private.has_permission(organization_id, 'manage_members'));
create policy organization_members_delete on public.organization_members for delete to authenticated using (private.has_permission(organization_id, 'manage_members'));

-- Invitations: managers see and manage them; the invitee sees pending invitations addressed to their JWT email (accept/decline via RPC).
create policy organization_invitations_select on public.organization_invitations for select to authenticated
  using (private.has_permission(organization_id, 'manage_members')
         or (status = 'pending' and email = lower(coalesce((select auth.jwt()) ->> 'email', ''))));
create policy organization_invitations_insert on public.organization_invitations for insert to authenticated
  with check (private.has_permission(organization_id, 'manage_members') and invited_by = (select auth.uid()));
create policy organization_invitations_update on public.organization_invitations for update to authenticated
  using (private.has_permission(organization_id, 'manage_members')) with check (private.has_permission(organization_id, 'manage_members'));
create policy organization_invitations_delete on public.organization_invitations for delete to authenticated
  using (private.has_permission(organization_id, 'manage_members'));

create policy permissions_select on public.permissions for select to authenticated using (true);
create policy role_permissions_select on public.role_permissions for select to authenticated using (true);
create policy org_role_permissions_select on public.organization_role_permissions for select to authenticated using (private.is_org_member(organization_id));
create policy org_role_permissions_write on public.organization_role_permissions for all to authenticated
  using (private.has_permission(organization_id, 'manage_members')) with check (private.has_permission(organization_id, 'manage_members'));

create policy organization_settings_select on public.organization_settings for select to authenticated using (private.has_permission(organization_id, 'view_settings'));
create policy organization_settings_insert on public.organization_settings for insert to authenticated
  with check (private.has_permission(organization_id, private.setting_edit_permission(category)));
create policy organization_settings_update on public.organization_settings for update to authenticated
  using (private.has_permission(organization_id, private.setting_edit_permission(category)))
  with check (private.has_permission(organization_id, private.setting_edit_permission(category)));

-- Audit trail: readable with view_audit_log; written ONLY by private.log_activity / public.record_activity (no insert policy).
create policy activity_events_select on public.activity_events for select to authenticated using (private.has_permission(organization_id, 'view_audit_log'));
create policy activity_event_details_select on public.activity_event_details for select to authenticated
  using (private.has_permission(organization_id, 'view_audit_log') and private.has_permission(organization_id, 'view_sensitive'));
create policy audit_policies_select on public.audit_policies for select to authenticated using (private.has_permission(organization_id, 'view_audit_log'));
create policy audit_policies_insert on public.audit_policies for insert to authenticated with check (private.has_permission(organization_id, 'manage_settings'));
create policy audit_policies_update on public.audit_policies for update to authenticated
  using (private.has_permission(organization_id, 'manage_settings')) with check (private.has_permission(organization_id, 'manage_settings'));
create policy audit_exports_select on public.audit_exports for select to authenticated using (private.has_permission(organization_id, 'view_audit_log'));

-- Table privileges (RLS still applies on top). anon gets nothing; append-only tables get no UPDATE/DELETE.
revoke all on public.profiles, public.user_preferences, public.organizations, public.organization_members, public.organization_invitations,
              public.permissions, public.role_permissions, public.organization_role_permissions, public.organization_settings,
              public.organization_counters, public.activity_events, public.activity_event_details, public.audit_policies, public.audit_exports from anon, authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update on public.user_preferences to authenticated;
grant select, update on public.organizations to authenticated;
grant select, update, delete on public.organization_members to authenticated;
grant select, insert, update, delete on public.organization_invitations, public.organization_role_permissions to authenticated;
grant select on public.permissions, public.role_permissions to authenticated;
grant select, insert, update on public.organization_settings, public.audit_policies to authenticated;
grant select on public.activity_events, public.activity_event_details, public.audit_exports to authenticated;

commit;
