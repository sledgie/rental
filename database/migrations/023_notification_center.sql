-- =====================================================================================================================
-- 023_notification_center.sql
-- Notification Center: turns the existing public.notifications table (in-app notifications for one staff user) into a full inbox
-- and adds the producers that fill it.
--
--   * notifications gets a category, a severity, a property, an action link, "action required", dismiss / snooze / expiry and an
--     optional required permission. A notification belongs to ONE user (fan-out happens when it is created), so row-level
--     security stays "you see your own".
--   * required_permission is enforced by the read policy: a user who loses (or never had) the permission no longer sees the row.
--   * Users can only change read_at, dismissed_at and snoozed_until. They cannot create notifications, edit text or re-address one.
--   * notification_preferences: per user, per organization and category: on/off and a minimum severity. They decide who receives
--     a notification when it is CREATED; notifications already in the inbox stay.
--   * private.emit_notification is the one place that decides recipients (active members, holding the permission, with the
--     category enabled and the severity high enough) and de-duplicates by key.
--   * Producers: triggers on maintenance requests, applications, payments, members and delivery logs, and
--     public.process_notification_events (overdue / due-soon invoices, expiring leases, overdue work orders, expired invitations)
--     for events that are about time passing. Nothing here sends e-mail or text.
--
-- Categories: financial, properties_leases, maintenance_projects, team_organization, communications_documents, system, tasks.
-- =====================================================================================================================
begin;
set local search_path = public, extensions;

-- ---------------------------------------------------------------------------------------------------------------------
-- Columns
-- ---------------------------------------------------------------------------------------------------------------------
alter table public.notifications
  add column category            text    not null default 'system'
                                   check (category in ('financial', 'properties_leases', 'maintenance_projects', 'team_organization', 'communications_documents', 'system', 'tasks')),
  add column severity            text    not null default 'normal' check (severity in ('critical', 'high', 'normal', 'informational')),
  add column property_id         uuid,
  add column action_label        text,
  add column action_route        text,
  add column action_required     boolean not null default false,
  add column required_permission text references public.permissions (key),
  add column dismissed_at        timestamptz,
  add column snoozed_until       timestamptz,
  add column expires_at          timestamptz;

alter table public.notifications
  add constraint notifications_property_fk foreign key (organization_id, property_id) references public.properties (organization_id, id) on delete set null (property_id);

-- rows that existed before this migration
update public.notifications set category = 'tasks', action_label = 'Open task', action_route = '#/scheduled-tasks?task=' || entity_id
 where notification_type like 'task%' and entity_id is not null;
update public.notifications set category = 'communications_documents' where conversation_id is not null and category = 'system';

create index notifications_inbox_idx    on public.notifications (organization_id, user_id, created_at desc) where dismissed_at is null;
create index notifications_property_fk  on public.notifications (organization_id, property_id);

-- Producers that predate this migration (task reminders in 022, message notifications) insert with the column defaults; give them the right
-- category and link here so those functions do not need to change.
create or replace function private.notifications_defaults() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.category = 'system' then
    if new.notification_type like 'task%' then
      new.category := 'tasks';
      if new.entity_id is not null then
        new.action_label := coalesce(new.action_label, 'Open task');
        new.action_route := coalesce(new.action_route, '#/scheduled-tasks?task=' || new.entity_id);
      end if;
    elsif new.conversation_id is not null then
      new.category := 'communications_documents';
      new.action_label := coalesce(new.action_label, 'Open message');
      new.action_route := coalesce(new.action_route, '#/messages');
    end if;
  end if;
  return new;
end $$;
create trigger notifications_defaults before insert on public.notifications for each row execute function private.notifications_defaults();

-- ---------------------------------------------------------------------------------------------------------------------
-- Row-level security: your own rows, and only those whose permission you still hold. Three columns are writable.
-- ---------------------------------------------------------------------------------------------------------------------
drop policy notifications_select on public.notifications;
create policy notifications_select on public.notifications for select to authenticated
  using (user_id = (select auth.uid()) and private.is_org_member(organization_id)
         and (required_permission is null or private.has_permission(organization_id, required_permission)));

revoke update on public.notifications from authenticated;
grant update (read_at, dismissed_at, snoozed_until) on public.notifications to authenticated;

-- ---------------------------------------------------------------------------------------------------------------------
-- Preferences
-- ---------------------------------------------------------------------------------------------------------------------
create table public.notification_preferences (
  organization_id  uuid not null,
  user_id          uuid not null,
  category         text not null check (category in ('financial', 'properties_leases', 'maintenance_projects', 'team_organization', 'communications_documents', 'system', 'tasks')),
  enabled          boolean not null default true,
  minimum_severity text not null default 'informational' check (minimum_severity in ('informational', 'normal', 'high', 'critical')),
  updated_at       timestamptz not null default now(),
  primary key (organization_id, user_id, category),
  foreign key (organization_id, user_id) references public.organization_members (organization_id, user_id) on delete cascade
);
create trigger notification_preferences_updated_at before update on public.notification_preferences for each row execute function private.set_updated_at();
create index notification_preferences_user_idx on public.notification_preferences (user_id);

alter table public.notification_preferences enable row level security;
create policy notification_preferences_select on public.notification_preferences for select to authenticated
  using (user_id = (select auth.uid()) and private.is_org_member(organization_id));
create policy notification_preferences_insert on public.notification_preferences for insert to authenticated
  with check (user_id = (select auth.uid()) and private.is_org_member(organization_id));
create policy notification_preferences_update on public.notification_preferences for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and private.is_org_member(organization_id));
create policy notification_preferences_delete on public.notification_preferences for delete to authenticated
  using (user_id = (select auth.uid()));
revoke all on public.notification_preferences from anon;
grant select, insert, update, delete on public.notification_preferences to authenticated;

-- ---------------------------------------------------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------------------------------------------------
create or replace function private.severity_rank(p text) returns integer
language sql immutable set search_path = '' as $$
  select case p when 'critical' then 3 when 'high' then 2 when 'normal' then 1 else 0 end;
$$;

-- What a category requires when the user has not chosen anything (quieter categories start higher).
create or replace function private.notification_default_minimum(p_category text) returns text
language sql immutable set search_path = '' as $$
  select case p_category when 'maintenance_projects' then 'normal' when 'communications_documents' then 'normal' when 'system' then 'high' else 'informational' end;
$$;

-- private.has_permission for ANY user (it only knows the caller): owner = everything, else the organization override, else the role default.
create or replace function private.member_has_permission(p_org uuid, p_user uuid, p_permission text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select case when m.role = 'owner' then true
                else coalesce((select o.granted from public.organization_role_permissions o
                                where o.organization_id = p_org and o.role = m.role and o.permission = p_permission),
                              exists (select 1 from public.role_permissions r where r.role = m.role and r.permission = p_permission)) end
      from public.organization_members m
      join public.profiles pr on pr.id = m.user_id and pr.status = 'active'
     where m.organization_id = p_org and m.user_id = p_user and m.status = 'active'), false);
$$;

-- Creates one notification per eligible recipient and returns how many were created. Recipients are active members who
--   * are in p_users (when given; otherwise everyone),
--   * are not p_exclude (usually the person who made the change),
--   * hold p_permission (when given), and
--   * have not switched the category off or set a higher minimum severity.
-- A repeated p_dedupe key never creates a second row for the same user.
create or replace function private.emit_notification(
  p_org uuid, p_event text, p_category text, p_severity text, p_title text, p_body text,
  p_entity_type text default null, p_entity_id uuid default null, p_property uuid default null,
  p_action_label text default null, p_action_route text default null, p_permission text default null,
  p_users uuid[] default null, p_exclude uuid default null, p_dedupe text default null,
  p_action_required boolean default false, p_expires timestamptz default null
) returns integer
language plpgsql security definer set search_path = '' as $$
declare v_count integer;
begin
  with ins as (
    insert into public.notifications (organization_id, user_id, notification_type, category, severity, title, body, entity_type, entity_id, property_id,
                                      action_label, action_route, action_required, required_permission, dedupe_key, expires_at)
      select p_org, m.user_id, p_event, p_category, p_severity, p_title, p_body, p_entity_type, p_entity_id, p_property,
             p_action_label, p_action_route, p_action_required, p_permission, p_dedupe, p_expires
        from public.organization_members m
        join public.profiles pr on pr.id = m.user_id and pr.status = 'active'
        left join public.notification_preferences np on np.organization_id = m.organization_id and np.user_id = m.user_id and np.category = p_category
       where m.organization_id = p_org and m.status = 'active'
         and (p_users is null or m.user_id = any (p_users))
         and (p_exclude is null or m.user_id <> p_exclude)
         and (p_permission is null or private.member_has_permission(p_org, m.user_id, p_permission))
         and coalesce(np.enabled, true)
         and private.severity_rank(p_severity) >= private.severity_rank(coalesce(np.minimum_severity, private.notification_default_minimum(p_category)))
      on conflict (organization_id, user_id, dedupe_key) do nothing
      returning 1)
  select count(*) into v_count from ins;
  return v_count;
end $$;

-- ---------------------------------------------------------------------------------------------------------------------
-- Producers: things that happen
-- ---------------------------------------------------------------------------------------------------------------------
-- New urgent maintenance request, or one that becomes urgent; and a request assigned to a staff member.
create or replace function private.notify_maintenance_request() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_urgent boolean := new.priority in ('emergency', 'high') and new.status not in ('draft', 'completed', 'closed', 'rejected', 'cancelled');
  v_route text := '#/maintenance-requests?request=' || new.id;
  v_label text := coalesce(new.request_number || ' · ', '') || new.title;
begin
  if v_urgent and (case when tg_op = 'INSERT' then true else (old.priority is distinct from new.priority or old.status is distinct from new.status) end) then
    perform private.emit_notification(new.organization_id, 'maintenance_request_urgent', 'maintenance_projects',
      case when new.priority = 'emergency' then 'critical' else 'high' end,
      case when new.priority = 'emergency' then 'Emergency maintenance request' else 'High-priority maintenance request' end, v_label,
      'maintenance_request', new.id, new.property_id, 'Open request', v_route, 'view_maintenance', null, (select auth.uid()), 'maintenance-urgent:' || new.id, true);
  end if;
  if new.assigned_staff_id is not null and new.status not in ('completed', 'closed', 'rejected', 'cancelled')
     and (case when tg_op = 'INSERT' then true else old.assigned_staff_id is distinct from new.assigned_staff_id end) then
    perform private.emit_notification(new.organization_id, 'maintenance_request_assigned', 'maintenance_projects', 'normal',
      'Maintenance request assigned to you', v_label,
      'maintenance_request', new.id, new.property_id, 'Open request', v_route, 'view_maintenance', array[new.assigned_staff_id], (select auth.uid()),
      'maintenance-assigned:' || new.id || ':' || new.assigned_staff_id, true);
  end if;
  return null;
end $$;
create trigger maintenance_requests_notify after insert or update of priority, status, assigned_staff_id on public.maintenance_requests
  for each row execute function private.notify_maintenance_request();

-- An application that has been submitted.
create or replace function private.notify_application() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'new' and (case when tg_op = 'INSERT' then true else old.status is distinct from 'new' end) then
    perform private.emit_notification(new.organization_id, 'application_received', 'properties_leases', 'normal',
      'New rental application', coalesce(new.application_number, 'An application') || ' is waiting for review',
      'application', new.id, new.property_id, 'Review application', '#/applications?application=' || new.id, 'view_tenants', null, (select auth.uid()),
      'application-received:' || new.id, true);
  end if;
  return null;
end $$;
create trigger applications_notify after insert or update of status on public.applications for each row execute function private.notify_application();

-- A payment recorded or reversed.
create or replace function private.notify_payment() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_text text := to_char(new.amount, 'FM999,999,990.00') || ' ' || new.currency || ' · ' || replace(new.method, '_', ' ');
begin
  if new.status = 'posted' and tg_op = 'INSERT' then
    perform private.emit_notification(new.organization_id, 'rent_payment_recorded', 'financial', 'informational',
      'Payment recorded', coalesce(new.payment_number || ' · ', '') || v_text,
      'payment', new.id, null, 'View payment', '#/payments?payment=' || new.id, 'view_finance', null, coalesce(new.recorded_by, (select auth.uid())), 'payment-recorded:' || new.id);
  elsif new.status = 'reversed' and (case when tg_op = 'UPDATE' then old.status = 'posted' else false end) then
    perform private.emit_notification(new.organization_id, 'payment_reversed', 'financial', 'high',
      'Payment reversed', coalesce(new.payment_number || ' · ', '') || v_text || coalesce(' · ' || new.reversal_reason, ''),
      'payment', new.id, null, 'View payment', '#/payments?payment=' || new.id, 'view_finance', null, (select auth.uid()), 'payment-reversed:' || new.id, true);
  end if;
  return null;
end $$;
create trigger payments_notify after insert or update of status on public.payments for each row execute function private.notify_payment();

-- Someone joined, had their role changed or was suspended.
create or replace function private.notify_member() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_name text;
begin
  select coalesce(nullif(btrim(full_name), ''), email, 'A member') into v_name from public.profiles where id = new.user_id;
  if tg_op = 'INSERT' then
    perform private.emit_notification(new.organization_id, 'invitation_accepted', 'team_organization', 'informational',
      'New team member', v_name || ' joined as ' || replace(new.role, '_', ' '),
      'team_member', new.user_id, null, 'View team', '#/organization', 'manage_members', null, new.user_id, 'member-joined:' || new.id);
  else
    if new.role is distinct from old.role and new.status = 'active' then
      perform private.emit_notification(new.organization_id, 'role_changed', 'team_organization', 'normal',
        'Your role changed', 'You are now ' || replace(new.role, '_', ' '),
        'team_member', new.user_id, null, null, null, null, array[new.user_id], null, 'role-changed:' || new.id || ':' || new.role || ':' || extract(epoch from now())::bigint);
    end if;
    if new.status = 'suspended' and old.status = 'active' then
      perform private.emit_notification(new.organization_id, 'user_access_suspended', 'team_organization', 'high',
        'Team member suspended', v_name || '''s access was suspended',
        'team_member', new.user_id, null, 'View team', '#/organization', 'manage_members', null, (select auth.uid()), 'member-suspended:' || new.id || ':' || extract(epoch from now())::bigint);
    end if;
  end if;
  return null;
end $$;
create trigger organization_members_notify after insert or update of role, status on public.organization_members
  for each row execute function private.notify_member();

-- A message that could not be delivered.
create or replace function private.notify_delivery_failure() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status in ('failed', 'bounced') and (case when tg_op = 'INSERT' then true else old.status is distinct from new.status end) and new.channel in ('email', 'sms') then
    perform private.emit_notification(new.organization_id, case when new.channel = 'sms' then 'sms_delivery_failed' else 'message_delivery_failed' end,
      'communications_documents', 'high',
      case when new.channel = 'sms' then 'Text message not delivered' else 'Email not delivered' end,
      coalesce(new.recipient_name, new.recipient_phone, new.recipient_email, 'A recipient') || case when new.rendered_subject <> '' then ' · ' || new.rendered_subject else '' end,
      'communication', new.id, new.property_id, 'Open messages', '#/messages', 'view_communications', null, null, 'delivery-failed:' || new.id);
  end if;
  return null;
end $$;
create trigger communication_logs_notify after insert or update of status on public.communication_logs
  for each row execute function private.notify_delivery_failure();

-- ---------------------------------------------------------------------------------------------------------------------
-- Producers: time passing
-- ---------------------------------------------------------------------------------------------------------------------
-- Invoices that are overdue (last 30 days) or due within 3 days, leases ending within 60 days, work orders past their target date
-- and invitations that expired unanswered. Idempotent (dedupe keys): any active member opening the inbox may run it; workers run it for all.
create or replace function public.process_notification_events(p_org uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_worker boolean := coalesce((select auth.jwt()) ->> 'role', '') = 'service_role'
                      or ((select auth.uid()) is null and coalesce(current_setting('role', true), 'none') <> 'authenticated');
  r record;
  v_made integer := 0;
begin
  if not v_worker and not private.is_org_member(p_org) then
    raise exception 'you are not a member of this organization' using errcode = '42501';
  end if;

  for r in
    select b.invoice_id, b.invoice_number, b.invoice_type, b.property_id, b.outstanding, b.currency, b.due_date, b.days_overdue, b.is_overdue
      from public.v_invoice_balances b
     where b.organization_id = p_org and b.status = 'open' and b.outstanding > 0
       and ((b.is_overdue and b.days_overdue between 1 and 30) or (not b.is_overdue and b.due_date between current_date and current_date + 3))
  loop
    if r.is_overdue then
      v_made := v_made + private.emit_notification(p_org, case when r.invoice_type = 'rent' then 'rent_payment_overdue' else 'invoice_overdue' end, 'financial', 'high',
        case when r.invoice_type = 'rent' then 'Rent is overdue' else 'Invoice is overdue' end,
        coalesce(r.invoice_number, 'Invoice') || ' · ' || to_char(r.outstanding, 'FM999,999,990.00') || ' ' || r.currency || ' outstanding, ' || r.days_overdue || ' day' || case when r.days_overdue = 1 then '' else 's' end || ' late',
        'invoice', r.invoice_id, r.property_id, 'View invoice', '#/invoices', 'view_finance', null, null, 'invoice-overdue:' || r.invoice_id, true);
    else
      v_made := v_made + private.emit_notification(p_org, 'invoice_due_soon', 'financial', 'informational', 'Invoice due soon',
        coalesce(r.invoice_number, 'Invoice') || ' · ' || to_char(r.outstanding, 'FM999,999,990.00') || ' ' || r.currency || ' due ' || r.due_date,
        'invoice', r.invoice_id, r.property_id, 'View invoice', '#/invoices', 'view_finance', null, null, 'invoice-due-soon:' || r.invoice_id, false);
    end if;
  end loop;

  for r in
    select l.id, l.lease_number, l.name, l.end_date, (l.end_date - current_date) as days_left,
           (select u.property_id from public.lease_units lu join public.units u on u.organization_id = lu.organization_id and u.id = lu.unit_id
             where lu.organization_id = l.organization_id and lu.lease_id = l.id limit 1) as property_id
      from public.leases l
     where l.organization_id = p_org and l.status = 'active' and l.end_date between current_date and current_date + 60
  loop
    v_made := v_made + private.emit_notification(p_org, 'lease_expiring', 'properties_leases', case when r.days_left <= 30 then 'high' else 'normal' end,
      'Lease expiring soon', coalesce(r.name, r.lease_number, 'A lease') || ' ends ' || r.end_date || ' (' || r.days_left || ' day' || case when r.days_left = 1 then '' else 's' end || ')',
      'lease', r.id, r.property_id, 'View lease', '#/leases', 'view_tenants', null, null, 'lease-expiring:' || r.id || ':' || r.end_date, true);
  end loop;

  for r in
    select w.id, w.work_order_number, w.title, w.target_date, q.property_id
      from public.maintenance_work_orders w
      join public.maintenance_requests q on q.organization_id = w.organization_id and q.id = w.request_id
     where w.organization_id = p_org and w.status in ('awaiting_assignment', 'scheduled', 'in_progress') and w.target_date < current_date and w.target_date > current_date - 60
  loop
    v_made := v_made + private.emit_notification(p_org, 'work_order_overdue', 'maintenance_projects', 'high', 'Work order is overdue',
      coalesce(r.work_order_number || ' · ', '') || r.title || ' was due ' || r.target_date,
      'work_order', r.id, r.property_id, 'Open work order', '#/work-orders?workorder=' || r.id, 'view_maintenance', null, null, 'work-order-overdue:' || r.id, true);
  end loop;

  for r in
    select i.id, i.email from public.organization_invitations i
     where i.organization_id = p_org and i.status = 'pending' and i.expires_at < now() and i.expires_at > now() - interval '30 days'
  loop
    v_made := v_made + private.emit_notification(p_org, 'invitation_expired', 'team_organization', 'normal', 'Invitation expired',
      r.email || ' did not accept in time', 'team_member', null, null, 'View team', '#/organization', 'manage_members', null, null, 'invitation-expired:' || r.id);
  end loop;

  return jsonb_build_object('created', v_made);
end $$;

create or replace function public.process_all_notification_events() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare o record; v_total integer := 0; v_json jsonb;
begin
  if coalesce((select auth.jwt()) ->> 'role', '') <> 'service_role' and not ((select auth.uid()) is null and coalesce(current_setting('role', true), 'none') <> 'authenticated') then
    raise exception 'workers only' using errcode = '42501';
  end if;
  for o in select id from public.organizations loop
    v_json := public.process_notification_events(o.id);
    v_total := v_total + (v_json ->> 'created')::integer;
  end loop;
  return jsonb_build_object('created', v_total);
end $$;

-- ---------------------------------------------------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------------------------------------------------
revoke execute on function private.notifications_defaults(), private.severity_rank(text), private.notification_default_minimum(text),
  private.member_has_permission(uuid, uuid, text),
  private.emit_notification(uuid, text, text, text, text, text, text, uuid, uuid, text, text, text, uuid[], uuid, text, boolean, timestamptz),
  private.notify_maintenance_request(), private.notify_application(), private.notify_payment(), private.notify_member(), private.notify_delivery_failure()
  from public, anon, authenticated;
revoke execute on function public.process_notification_events(uuid), public.process_all_notification_events() from public, anon;
grant  execute on function public.process_notification_events(uuid) to authenticated, service_role;
grant  execute on function public.process_all_notification_events() to service_role;

comment on table  public.notification_preferences is 'Per user, organization and notification category: whether new notifications are created for them and the lowest severity they want.';
comment on table  public.notifications is 'In-app notifications for staff users. One row per recipient: category, severity, optional required permission (enforced by the read policy), action link, dismiss / snooze / expiry. Users may only change read_at, dismissed_at and snoozed_until.';
comment on function public.process_notification_events(uuid) is 'Creates the time-based notifications for one organization (overdue and due-soon invoices, expiring leases, overdue work orders, expired invitations). Idempotent; members and workers.';
comment on function public.process_all_notification_events() is 'Worker entry point: runs process_notification_events for every organization. Service role only.';

commit;
