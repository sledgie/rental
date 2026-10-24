-- =====================================================================================================================
-- notification_center_validation.sql
-- Behavioural tests of migration 023 (Notification Center): who receives what, preferences, de-duplication, privacy, the permission
-- that a notification requires, the three columns users may change, time-based events and privileges.
-- Run AFTER scheduled_tasks_validation.sql (it reuses the organizations, users, properties and tenants of data_integrity_validation.sql).
-- Fictional fixtures only.
-- =====================================================================================================================
delete from public.test_results where suite = 'notify';

-- other people's notifications are not visible to ordinary users, so the tests count them as the database owner
create or replace function public.test_notes(p_entity uuid, p_type text default null, p_user uuid default null) returns bigint language sql security definer set search_path = public as $fn$
  select count(*) from public.notifications where entity_id = p_entity and (p_type is null or notification_type = p_type) and (p_user is null or user_id = p_user) $fn$;

do $$
declare
  v_a uuid := public.test_uuid('org_a');
  v_b uuid := public.test_uuid('org_b');
  v_owner constant uuid := 'a0000000-0000-4000-8000-000000000001';
  v_pm    constant uuid := 'a0000000-0000-4000-8000-000000000002';
  v_acct  constant uuid := 'a0000000-0000-4000-8000-000000000003';
  v_maint constant uuid := 'a0000000-0000-4000-8000-000000000004';
  v_ro    constant uuid := 'a0000000-0000-4000-8000-000000000005';
  v_admin constant uuid := 'a0000000-0000-4000-8000-000000000006';
  v_bob   constant uuid := 'b0000000-0000-4000-8000-000000000001';
  v_p1 constant uuid := '11111111-0000-4000-8000-000000000001';
  v_u1 constant uuid := '22222222-0000-4000-8000-000000000001';
  v_t1 constant uuid := '33333333-0000-4000-8000-000000000001';
  v_bank constant uuid := '44444444-0000-4000-8000-000000000001';
  v_r1 uuid; v_r2 uuid; v_r3 uuid; v_r4 uuid; v_pay uuid; v_inv uuid; v_lease uuid; v_wo uuid; v_unit uuid; v_log uuid; v_note uuid;
  v_err text; v_n bigint; v_json jsonb; v_title text; v_member uuid;
begin
  -- structure ------------------------------------------------------------------------------------------------------------
  perform public.test_check('notify', 'notifications has the inbox columns',
    (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'notifications'
        and column_name in ('category', 'severity', 'property_id', 'action_label', 'action_route', 'action_required', 'required_permission', 'dismissed_at', 'snoozed_until', 'expires_at')) = 10);


  -- urgent maintenance requests --------------------------------------------------------------------------------------------
  perform public.test_login(v_maint);
  insert into public.maintenance_requests (organization_id, title, property_id, priority, created_by) values (v_a, 'Burst pipe', v_p1, 'emergency', v_maint) returning id into v_r1;
  perform public.test_logout();
  perform public.test_check('notify', 'an emergency request notifies the members who can view maintenance',
    public.test_notes(v_r1, 'maintenance_request_urgent', v_owner) = 1 and public.test_notes(v_r1, 'maintenance_request_urgent', v_pm) = 1
    and (select severity from public.notifications where entity_id = v_r1 and user_id = v_pm) = 'critical');
  perform public.test_check('notify', 'the person who made the change is not notified of it', public.test_notes(v_r1, null, v_maint) = 0);
  perform public.test_check('notify', 'only members holding the required permission receive it',
    not exists (select 1 from public.notifications n where n.entity_id = v_r1 and not private.member_has_permission(n.organization_id, n.user_id, 'view_maintenance')));
  perform public.test_check('notify', 'the notification links to the record and asks for action',
    (select action_route from public.notifications where entity_id = v_r1 and user_id = v_pm) = '#/maintenance-requests?request=' || v_r1
    and (select action_required from public.notifications where entity_id = v_r1 and user_id = v_pm) and (select category from public.notifications where entity_id = v_r1 and user_id = v_pm) = 'maintenance_projects');

  perform public.test_login(v_pm);
  insert into public.maintenance_requests (organization_id, title, property_id, priority, created_by) values (v_a, 'Dripping tap', v_p1, 'normal', v_pm) returning id into v_r2;
  perform public.test_logout();
  perform public.test_check('notify', 'a normal request creates no urgent notification', public.test_notes(v_r2) = 0);
  update public.maintenance_requests set priority = 'high' where id = v_r2;
  perform public.test_check('notify', 'raising a request to high priority notifies once (severity high)',
    public.test_notes(v_r2, 'maintenance_request_urgent', v_owner) = 1 and (select severity from public.notifications where entity_id = v_r2 and user_id = v_owner) = 'high');
  update public.maintenance_requests set priority = 'normal' where id = v_r2;
  update public.maintenance_requests set priority = 'high' where id = v_r2;
  perform public.test_check('notify', 'the same event is never notified twice (de-duplication key)', public.test_notes(v_r2, 'maintenance_request_urgent', v_owner) = 1);

  update public.maintenance_requests set assigned_staff_id = v_maint where id = v_r2;
  perform public.test_check('notify', 'assigning a request notifies the assignee only',
    public.test_notes(v_r2, 'maintenance_request_assigned', v_maint) = 1 and public.test_notes(v_r2, 'maintenance_request_assigned') = 1);
  insert into public.maintenance_requests (organization_id, title, property_id, priority, status, created_by) values (v_a, 'Draft emergency', v_p1, 'emergency', 'draft', v_owner) returning id into v_r4;
  perform public.test_check('notify', 'a draft request raises no alert', public.test_notes(v_r4) = 0);

  -- preferences ------------------------------------------------------------------------------------------------------------
  perform public.test_login(v_pm);
  v_err := public.test_err(format($q$insert into public.notification_preferences (organization_id, user_id, category, minimum_severity) values (%L, %L, 'maintenance_projects', 'critical')$q$, v_a, v_pm));
  perform public.test_check('notify', 'a member can set their own preference', v_err is null, v_err);
  v_err := public.test_err(format($q$insert into public.notification_preferences (organization_id, user_id, category) values (%L, %L, 'financial')$q$, v_a, v_owner));
  perform public.test_check('notify', 'a member cannot set someone else''s preference', v_err like '42501%', v_err);
  v_err := public.test_err(format($q$insert into public.notification_preferences (organization_id, user_id, category) values (%L, %L, 'gossip')$q$, v_a, v_pm));
  perform public.test_check('notify', 'unknown categories are rejected', v_err like '23514%', v_err);
  perform public.test_logout();
  perform public.test_check('notify', 'preferences are private to their owner',
    public.test_visible(v_pm, 'select * from public.notification_preferences') = 1 and public.test_visible(v_owner, 'select * from public.notification_preferences') = 0);

  perform public.test_login(v_maint);
  insert into public.maintenance_requests (organization_id, title, property_id, priority, created_by) values (v_a, 'Broken window', v_p1, 'high', v_maint) returning id into v_r3;
  perform public.test_logout();
  perform public.test_check('notify', 'a raised minimum severity (critical) keeps high alerts out of that member''s inbox',
    public.test_notes(v_r3, null, v_pm) = 0 and public.test_notes(v_r3, null, v_owner) = 1);
  update public.notification_preferences set enabled = false, minimum_severity = 'informational' where user_id = v_pm;
  perform public.test_login(v_maint);
  insert into public.maintenance_requests (organization_id, title, property_id, priority, created_by) values (v_a, 'Emergency flood', v_p1, 'emergency', v_maint) returning id into v_r4;
  perform public.test_logout();
  perform public.test_check('notify', 'switching a category off stops new notifications in it', public.test_notes(v_r4, null, v_pm) = 0 and public.test_notes(v_r4, null, v_owner) = 1);
  perform public.test_check('notify', 'notifications created before the preference stay in the inbox', public.test_notes(v_r1, null, v_pm) = 1);
  delete from public.notification_preferences where user_id = v_pm;

  -- payments ---------------------------------------------------------------------------------------------------------------
  perform public.test_login(v_owner);
  v_pay := public.record_payment(v_a, v_t1, null, current_date, 75.00, 'etransfer', 'NC-1', null, v_bank, '[]'::jsonb, true, 'nc-pay-1');
  perform public.test_logout();
  perform public.test_check('notify', 'a recorded payment notifies finance viewers other than the recorder',
    public.test_notes(v_pay, 'rent_payment_recorded', v_acct) = 1 and public.test_notes(v_pay, 'rent_payment_recorded', v_owner) = 0
    and not exists (select 1 from public.notifications where entity_id = v_pay and user_id = v_maint));
  perform public.test_check('notify', 'payment notifications are informational and link to the payment',
    (select severity from public.notifications where entity_id = v_pay and user_id = v_acct) = 'informational'
    and (select action_route from public.notifications where entity_id = v_pay and user_id = v_acct) like '#/payments?payment=%');

  -- members ----------------------------------------------------------------------------------------------------------------
  select id into v_member from public.organization_members where organization_id = v_a and user_id = v_acct;
  update public.organization_members set role = 'read_only' where id = v_member;
  perform public.test_check('notify', 'a role change notifies the member concerned',
    public.test_notes(v_acct, 'role_changed', v_acct) = 1 and public.test_notes(v_acct, 'role_changed') = 1);
  update public.organization_members set role = 'accountant' where id = v_member;
  update public.organization_members set status = 'suspended' where id = v_member;
  perform public.test_check('notify', 'a suspension notifies members who can manage the team (not the suspended member)',
    public.test_notes(v_acct, 'user_access_suspended', v_owner) = 1 and public.test_notes(v_acct, 'user_access_suspended', v_acct) = 0);
  update public.organization_members set status = 'active' where id = v_member;

  -- delivery failures ----------------------------------------------------------------------------------------------------
  insert into public.communication_logs (organization_id, channel, status, recipient_name, recipient_phone, rendered_body) values (v_a, 'sms', 'queued', 'Ava Thompson', '+15550000001', 'Rent reminder') returning id into v_log;
  perform public.test_check('notify', 'a queued message creates no failure alert', public.test_notes(v_log) = 0);
  update public.communication_logs set status = 'failed', failed_at = now() where id = v_log;
  perform public.test_check('notify', 'a failed text message alerts members who view communications',
    public.test_notes(v_log, 'sms_delivery_failed', v_owner) = 1 and public.test_notes(v_log, 'sms_delivery_failed', v_maint) = 0);

  -- privacy and permissions ------------------------------------------------------------------------------------------------
  select id into v_note from public.notifications where entity_id = v_r1 and user_id = v_pm;
  perform public.test_check('notify', 'members see only their own notifications',
    public.test_visible(v_pm, format('select * from public.notifications where id = %L', v_note)) = 1
    and public.test_visible(v_owner, format('select * from public.notifications where id = %L', v_note)) = 0
    and public.test_visible(v_bob, 'select * from public.notifications') = 0);
  perform public.test_login(v_pm);
  v_err := public.test_err(format($q$update public.notifications set read_at = now(), dismissed_at = now(), snoozed_until = now() + interval '1 day' where id = %L$q$, v_note));
  perform public.test_logout();
  perform public.test_check('notify', 'a member can mark read, dismiss and snooze their notification', v_err is null, v_err);
  v_err := public.test_as(v_pm, format($q$update public.notifications set title = 'forged' where id = %L$q$, v_note));
  perform public.test_check('notify', 'the text of a notification cannot be edited by its recipient', v_err like '42501%', v_err);
  v_err := public.test_as(v_pm, format($q$update public.notifications set user_id = %L where id = %L$q$, v_owner, v_note));
  perform public.test_check('notify', 'a notification cannot be re-addressed', v_err like '42501%', v_err);
  v_err := public.test_as(v_pm, format($q$insert into public.notifications (organization_id, user_id, notification_type, title) values (%L, %L, 'x', 'spam')$q$, v_a, v_owner));
  perform public.test_check('notify', 'members cannot create notifications', v_err like '42501%', v_err);
  v_err := public.test_as(v_pm, format($q$select private.emit_notification(%L, 'x', 'system', 'normal', 'spam', null)$q$, v_a));
  perform public.test_check('notify', 'members cannot call the notification emitter', v_err like '42501%', v_err);

  -- a required permission is enforced when reading -----------------------------------------------------------------------
  insert into public.notifications (organization_id, user_id, notification_type, category, title, required_permission)
    values (v_a, v_maint, 'x', 'financial', 'Needs finance', 'view_finance') returning id into v_note;
  perform public.test_check('notify', 'a notification whose permission the member lacks is hidden',
    public.test_visible(v_maint, format('select * from public.notifications where id = %L', v_note)) = 0);
  insert into public.organization_role_permissions (organization_id, role, permission, granted) values (v_a, 'maintenance_staff', 'view_finance', true);
  perform public.test_check('notify', 'granting the permission reveals it', public.test_visible(v_maint, format('select * from public.notifications where id = %L', v_note)) = 1);
  delete from public.organization_role_permissions where organization_id = v_a and role = 'maintenance_staff' and permission = 'view_finance';
  perform public.test_check('notify', 'removing the permission hides it again', public.test_visible(v_maint, format('select * from public.notifications where id = %L', v_note)) = 0);

  -- notifications written by earlier modules get a category and a link ---------------------------------------------------
  insert into public.notifications (organization_id, user_id, notification_type, title, entity_type, entity_id) values (v_a, v_pm, 'task_reminder', 'Task reminder: x', 'task', v_r1) returning id into v_note;
  perform public.test_check('notify', 'task reminders are filed under Tasks and link to the task',
    (select category from public.notifications where id = v_note) = 'tasks' and (select action_route from public.notifications where id = v_note) = '#/scheduled-tasks?task=' || v_r1);

  -- time-based events ----------------------------------------------------------------------------------------------------
  perform public.test_login(v_owner);
  insert into public.invoices (organization_id, tenant_id, property_id, unit_id, invoice_type, status, due_date, issue_date)
    values (v_a, v_t1, v_p1, v_u1, 'rent', 'draft', current_date - 4, current_date - 30) returning id into v_inv;
  insert into public.invoice_lines (organization_id, invoice_id, description, category, quantity, unit_price, tax_rate) values (v_a, v_inv, 'Rent', 'rent', 1, 900.00, 0);
  update public.invoices set status = 'open' where id = v_inv;
  perform public.test_logout();
  perform public.test_login(v_ro);
  v_json := public.process_notification_events(v_a);
  perform public.test_logout();
  perform public.test_check('notify', 'running the schedule creates an overdue-rent alert for finance viewers (high)',
    public.test_notes(v_inv, 'rent_payment_overdue', v_acct) = 1 and public.test_notes(v_inv, 'rent_payment_overdue', v_maint) = 0
    and (select severity from public.notifications where entity_id = v_inv and user_id = v_acct) = 'high', v_json::text);
  perform public.test_login(v_pm);
  v_json := public.process_notification_events(v_a);
  perform public.test_logout();
  perform public.test_check('notify', 'running the schedule again creates nothing new (idempotent)', (v_json ->> 'created')::int = 0, v_json::text);

  -- an invoice due in 2 days is "due soon" (informational)
  perform public.test_login(v_owner);
  insert into public.invoices (organization_id, tenant_id, property_id, unit_id, invoice_type, status, due_date, issue_date)
    values (v_a, v_t1, v_p1, v_u1, 'rent', 'draft', current_date + 2, current_date) returning id into v_inv;
  insert into public.invoice_lines (organization_id, invoice_id, description, category, quantity, unit_price, tax_rate) values (v_a, v_inv, 'Rent', 'rent', 1, 500.00, 0);
  update public.invoices set status = 'open' where id = v_inv;
  perform public.test_logout();
  perform public.process_notification_events(v_a);
  perform public.test_check('notify', 'an invoice due within 3 days produces an informational reminder',
    public.test_notes(v_inv, 'invoice_due_soon', v_acct) = 1 and (select severity from public.notifications where entity_id = v_inv and user_id = v_acct) = 'informational');

  -- a lease ending soon
  insert into public.units (organization_id, property_id, unit_number, unit_status, market_rent) values (v_a, v_p1, 'NC-9', 'occupied', 1000) returning id into v_unit;
  insert into public.leases (organization_id, start_date, end_date, agreed_monthly_rent, status) values (v_a, current_date - 340, current_date + 20, 1000, 'active') returning id into v_lease;
  insert into public.lease_units (organization_id, lease_id, unit_id, allocated_monthly_rent, start_date, end_date) values (v_a, v_lease, v_unit, 1000, current_date - 340, current_date + 20);
  perform public.process_notification_events(v_a);
  perform public.test_check('notify', 'a lease ending within 30 days produces a high-severity alert linked to its property',
    public.test_notes(v_lease, 'lease_expiring', v_pm) = 1 and (select severity from public.notifications where entity_id = v_lease and user_id = v_pm) = 'high'
    and (select property_id from public.notifications where entity_id = v_lease and user_id = v_pm) = v_p1);

  -- an overdue work order
  insert into public.maintenance_work_orders (organization_id, request_id, title, status, target_date) values (v_a, v_r3, 'Replace glass', 'in_progress', current_date - 3) returning id into v_wo;
  perform public.process_notification_events(v_a);
  perform public.test_check('notify', 'an overdue work order alerts maintenance viewers',
    public.test_notes(v_wo, 'work_order_overdue', v_maint) = 1 and public.test_notes(v_wo, 'work_order_overdue', v_owner) = 1);

  -- an expired invitation
  insert into public.organization_invitations (organization_id, email, role, invited_by, expires_at) values (v_a, 'late.hire@example.test', 'read_only', v_owner, now() - interval '2 days');
  perform public.process_notification_events(v_a);
  perform public.test_check('notify', 'an expired invitation alerts members who manage the team',
    exists (select 1 from public.notifications where notification_type = 'invitation_expired' and user_id = v_owner and body like 'late.hire@example.test%'));

  -- who may run the schedule -----------------------------------------------------------------------------------------------
  v_err := public.test_as(v_bob, format('select public.process_notification_events(%L)', v_a));
  perform public.test_check('notify', 'someone outside the organization cannot run its notification schedule', v_err like '42501%', v_err);
  v_err := public.test_as(v_pm, 'select public.process_all_notification_events()');
  perform public.test_check('notify', 'members cannot run the all-organizations worker', v_err like '42501%', v_err);
  perform public.test_check('notify', 'the worker entry point runs for every organization',
    (public.process_all_notification_events() ->> 'created')::int >= 0);

  -- isolation --------------------------------------------------------------------------------------------------------------
  perform public.test_check('notify', 'another organization received none of this',
    (select count(*) from public.notifications where organization_id = v_b) = 0);

  -- privileges -------------------------------------------------------------------------------------------------------------
  perform public.test_check('notify', 'anon cannot execute the notification functions',
    not has_function_privilege('anon', 'public.process_notification_events(uuid)', 'execute') and not has_function_privilege('anon', 'public.process_all_notification_events()', 'execute'));
  perform public.test_check('notify', 'the all-organizations worker is service_role only',
    not has_function_privilege('authenticated', 'public.process_all_notification_events()', 'execute') and has_function_privilege('service_role', 'public.process_all_notification_events()', 'execute'));
  perform public.test_check('notify', 'members can run their own organization''s schedule',
    has_function_privilege('authenticated', 'public.process_notification_events(uuid)', 'execute'));
  perform public.test_check('notify', 'anon cannot read notifications or preferences',
    not has_table_privilege('anon', 'public.notifications', 'select') and not has_table_privilege('anon', 'public.notification_preferences', 'select'));
end $$;

select suite, count(*) filter (where passed) as passed, count(*) filter (where not passed) as failed from public.test_results where suite = 'notify' group by suite;
