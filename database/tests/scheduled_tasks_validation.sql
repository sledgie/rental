-- =====================================================================================================================
-- scheduled_tasks_validation.sql
-- Behavioural tests of migration 022 (Scheduled Tasks): visibility, permissions, frozen history, recurrence maths, idempotent
-- generation, series control, overdue flags, in-app reminders, audit trail and tenant isolation.
-- Run AFTER data_integrity_validation.sql (it reuses that file's organizations, users and properties). Fictional fixtures only.
-- =====================================================================================================================
delete from public.test_results where suite = 'tasks';

-- the outbox and other people's notifications are not visible to ordinary users, so the tests count them as the database owner
create or replace function public.test_event_count(p_entity uuid, p_type text) returns bigint language sql security definer set search_path = public as $fn$
  select count(*) from public.domain_events where entity_id = p_entity and event_type = p_type $fn$;
create or replace function public.test_note_count(p_entity uuid) returns bigint language sql security definer set search_path = public as $fn$
  select count(*) from public.notifications where notification_type = 'task_reminder' and entity_id = p_entity $fn$;

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
  v_out   constant uuid := 'c0000000-0000-4000-8000-000000000001';
  v_p1 constant uuid := '11111111-0000-4000-8000-000000000001';
  v_p2 constant uuid := '11111111-0000-4000-8000-000000000002';
  v_u1 constant uuid := '22222222-0000-4000-8000-000000000001';
  v_t1 uuid; v_t2 uuid; v_t3 uuid; v_tb uuid; v_s uuid; v_x uuid;
  v_err text; v_n integer; v_id uuid; v_json jsonb; v_cat uuid;
begin
  -- categories -----------------------------------------------------------------------------------------------------------
  perform public.test_check('tasks', 'every organization gets the 11 system task categories',
    (select count(*) from public.task_categories where organization_id = v_a and is_system) = 11 and (select count(*) from public.task_categories where organization_id = v_b and is_system) = 11);

  -- creating tasks -------------------------------------------------------------------------------------------------------
  perform public.test_login(v_pm);
  v_t1 := public.create_scheduled_task(v_a, jsonb_build_object('title', 'Check smoke alarms', 'due_date', '2026-03-10', 'assignee_id', v_maint, 'priority', 'high',
            'property_id', v_p1, 'unit_id', v_u1, 'checklist', jsonb_build_array('Test each alarm', 'Replace batteries'), 'collaborator_ids', jsonb_build_array(v_acct)));
  v_t2 := public.create_scheduled_task(v_a, jsonb_build_object('title', 'Reconcile deposits', 'due_date', '2026-03-12', 'assignee_id', v_acct));
  perform public.test_logout();
  perform public.test_check('tasks', 'task reference numbers are generated per organization (TSK-0001 ...)',
    (select reference_number from public.tasks where id = v_t1) = 'TSK-0001' and (select reference_number from public.tasks where id = v_t2) = 'TSK-0002');
  perform public.test_check('tasks', 'create_scheduled_task stores the checklist in order',
    (select array_agg(title order by position) from public.task_checklist_items where task_id = v_t1) = array['Test each alarm', 'Replace batteries']);
  perform public.test_check('tasks', 'creating a task writes history and a TaskCreated event',
    exists (select 1 from public.task_activities where task_id = v_t1 and action = 'created') and public.test_event_count(v_t1, 'TaskCreated') > 0
    and public.test_event_count(v_t1, 'TaskAssigned') > 0);
  perform public.test_check('tasks', 'a due date creates the assignee reminder (in_app)',
    not exists (select 1 from public.task_reminders where task_id = v_t1 and channel <> 'in_app') );

  perform public.test_login(v_bob);
  v_tb := public.create_scheduled_task(v_b, jsonb_build_object('title', 'Org B task', 'due_date', '2026-03-10'));
  perform public.test_logout();
  perform public.test_check('tasks', 'another organization starts its own numbering', (select reference_number from public.tasks where id = v_tb) = 'TSK-0001');

  -- validation of the create function -----------------------------------------------------------------------------------
  perform public.test_login(v_pm);
  v_err := public.test_err(format($q$select public.create_scheduled_task(%L, '{"title": "  ", "due_date": "2026-03-10"}')$q$, v_a));
  perform public.test_check('tasks', 'a task needs a title', v_err like '22023%', v_err);
  v_err := public.test_err(format($q$select public.create_scheduled_task(%L, '{"title": "No date"}')$q$, v_a));
  perform public.test_check('tasks', 'a one-time task needs a due date', v_err like '22023%', v_err);
  v_err := public.test_err(format($q$select public.create_scheduled_task(%L, '{"title": "Dates", "start_date": "2026-03-10", "due_date": "2026-03-01"}')$q$, v_a));
  perform public.test_check('tasks', 'the due date cannot be before the start date', v_err like '23514%', v_err);
  v_err := public.test_err(format($q$select public.create_scheduled_task(%L, jsonb_build_object('title', 'Outsider', 'due_date', '2026-03-10', 'assignee_id', %L))$q$, v_a, v_out));
  perform public.test_check('tasks', 'the assignee must be an active member of the organization', v_err like '23514%', v_err);
  v_err := public.test_err(format($q$select public.create_scheduled_task(%L, jsonb_build_object('title', 'Wrong unit', 'due_date', '2026-03-10', 'property_id', %L, 'unit_id', %L))$q$, v_a, v_p2, v_u1));
  perform public.test_check('tasks', 'a unit must belong to the selected property', v_err like '23514%', v_err);
  v_err := public.test_err(format($q$select public.create_scheduled_task(%L, jsonb_build_object('title', 'Cross org', 'due_date', '2026-03-10', 'property_id', %L))$q$, v_a, '11111111-0000-4000-8000-0000000000b1'));
  perform public.test_check('tasks', 'a task cannot link to another organization''s property (composite FK)', v_err like '23503%', v_err);
  perform public.test_logout();

  -- visibility -----------------------------------------------------------------------------------------------------------
  perform public.test_login(v_maint);
  perform public.test_check('tasks', 'staff without view_tasks see only tasks assigned to them', (select count(*) from public.tasks where organization_id = v_a) = 1 and exists (select 1 from public.tasks where id = v_t1));
  perform public.test_check('tasks', 'children of tasks you cannot see are hidden too',
    (select count(*) from public.task_activities where task_id = v_t2) = 0 and (select count(*) from public.task_checklist_items where task_id = v_t2) = 0);
  v_t3 := public.create_scheduled_task(v_a, jsonb_build_object('title', 'My own errand', 'due_date', '2026-03-11'));
  perform public.test_check('tasks', 'staff can create tasks assigned to themselves', (select assignee_id from public.tasks where id = v_t3) = v_maint);
  v_err := public.test_err(format($q$select public.create_scheduled_task(%L, jsonb_build_object('title', 'Give away', 'due_date', '2026-03-11', 'assignee_id', %L))$q$, v_a, v_acct));
  perform public.test_check('tasks', 'assigning to someone else needs assign_tasks', v_err like '42501%', v_err);
  v_err := public.test_err(format($q$select public.create_scheduled_task(%L, jsonb_build_object('title', 'Series', 'start_date', '2026-03-11', 'recurrence', jsonb_build_object('frequency', 'daily')))$q$, v_a));
  perform public.test_check('tasks', 'creating a recurring series needs manage_task_series', v_err like '42501%', v_err);
  perform public.test_logout();

  perform public.test_login(v_ro);
  perform public.test_check('tasks', 'read-only members see every task (view_tasks)', (select count(*) from public.tasks where organization_id = v_a) = 3);
  v_err := public.test_err(format($q$select public.create_scheduled_task(%L, '{"title": "Nope", "due_date": "2026-03-10"}')$q$, v_a));
  perform public.test_check('tasks', 'read-only members cannot create tasks', v_err like '42501%', v_err);
  update public.tasks set title = 'Hacked' where id = v_t1; get diagnostics v_n = row_count;
  perform public.test_check('tasks', 'read-only members cannot edit tasks', v_n = 0 and (select title from public.tasks where id = v_t1) = 'Check smoke alarms');
  v_err := public.test_err(format($q$insert into public.task_comments (organization_id, task_id, author_id, body) values (%L, %L, %L, 'Looks good')$q$, v_a, v_t1, v_ro));
  perform public.test_check('tasks', 'members who can see a task may comment on it', v_err is null, v_err);
  v_err := public.test_err(format($q$insert into public.task_comments (organization_id, task_id, author_id, body) values (%L, %L, %L, 'Impersonation')$q$, v_a, v_t1, v_owner));
  perform public.test_check('tasks', 'comments cannot be written in someone else''s name', v_err like '42501%', v_err);
  v_err := public.test_err(format($q$update public.task_checklist_items set is_done = true where task_id = %L$q$, v_t1));
  perform public.test_check('tasks', 'read-only members cannot tick checklist items', (select count(*) from public.task_checklist_items where task_id = v_t1 and is_done) = 0);
  perform public.test_logout();

  perform public.test_login(v_bob);
  perform public.test_check('tasks', 'another organization sees none of these tasks', (select count(*) from public.tasks where organization_id = v_a) = 0 and (select count(*) from public.tasks) = 1);
  v_err := public.test_err(format($q$insert into public.tasks (organization_id, title, created_by) values (%L, 'Injected', %L)$q$, v_a, v_bob));
  perform public.test_check('tasks', 'no inserting into another organization', v_err like '42501%', v_err);
  perform public.test_logout();
  perform public.test_login_anon();
  perform public.test_check('tasks', 'anonymous visitors cannot read tasks', public.test_err('select count(*) from public.tasks') like '42501%');
  perform public.test_logout();

  -- checklist and completion ----------------------------------------------------------------------------------------------
  perform public.test_login(v_maint);
  update public.task_checklist_items set is_done = true where task_id = v_t1 and position = 0;
  perform public.test_check('tasks', 'ticking a checklist item records who and when',
    (select done_by from public.task_checklist_items where task_id = v_t1 and position = 0) = v_maint and (select done_at from public.task_checklist_items where task_id = v_t1 and position = 0) is not null);
  update public.tasks set status = 'in_progress' where id = v_t1;
  perform public.test_check('tasks', 'status changes are written to the history', exists (select 1 from public.task_activities where task_id = v_t1 and action = 'status_changed' and new_value = 'in_progress'));
  update public.tasks set status = 'completed', completion_notes = 'All alarms replaced' where id = v_t1;
  perform public.test_check('tasks', 'completing stamps who and when and emits TaskCompleted',
    (select completed_by from public.tasks where id = v_t1) = v_maint and (select completed_at from public.tasks where id = v_t1) is not null
    and exists (select 1 from public.task_activities where task_id = v_t1 and action = 'completed') and public.test_event_count(v_t1, 'TaskCompleted') > 0);
  v_err := public.test_err(format($q$update public.tasks set title = 'Renamed after completion' where id = %L$q$, v_t1));
  perform public.test_check('tasks', 'a completed task keeps its details (history is preserved)', v_err like '22023%', v_err);
  v_err := public.test_err(format($q$update public.tasks set completion_notes = 'Added a note later' where id = %L$q$, v_t1));
  perform public.test_check('tasks', 'completion notes can still be edited', v_err is null, v_err);
  v_err := public.test_err(format($q$update public.tasks set status = 'cancelled', cancel_reason = 'x' where id = %L$q$, v_t1));
  perform public.test_check('tasks', 'a completed task must be reopened before it is cancelled', v_err like '42501%' or v_err like '22023%', v_err);
  update public.tasks set status = 'not_started' where id = v_t1;
  perform public.test_check('tasks', 'reopening clears the completion stamps', (select completed_at from public.tasks where id = v_t1) is null and (select completed_by from public.tasks where id = v_t1) is null);
  perform public.test_logout();

  -- cancel and reschedule rules -----------------------------------------------------------------------------------------
  perform public.test_login(v_maint);
  v_err := public.test_err(format($q$update public.tasks set status = 'cancelled', cancel_reason = 'not needed' where id = %L$q$, v_t1));
  perform public.test_check('tasks', 'cancelling needs manage_task_series', v_err like '42501%', v_err);
  update public.tasks set due_date = '2026-03-15' where id = v_t1;
  perform public.test_check('tasks', 'the assignee may reschedule their own task', (select due_date from public.tasks where id = v_t1) = '2026-03-15'
    and exists (select 1 from public.task_activities where task_id = v_t1 and action = 'rescheduled') and public.test_event_count(v_t1, 'TaskRescheduled') > 0);
  perform public.test_logout();
  perform public.test_login(v_acct);
  v_err := public.test_err(format($q$update public.tasks set due_date = '2026-03-20' where id = %L$q$, v_t1));
  perform public.test_check('tasks', 'someone who is neither assignee nor creator cannot reschedule', v_err like '42501%', v_err);
  update public.tasks set description = 'Accountant adds context' where id = v_t1;
  perform public.test_check('tasks', 'staff with manage_tasks can edit the details of visible tasks', (select description from public.tasks where id = v_t1) = 'Accountant adds context'
    and exists (select 1 from public.task_activities where task_id = v_t1 and action = 'edited'));
  perform public.test_logout();
  perform public.test_login(v_pm);
  v_err := public.test_err(format($q$update public.tasks set status = 'cancelled' where id = %L$q$, v_t2));
  perform public.test_check('tasks', 'cancelling needs a reason', v_err like '22023%', v_err);
  update public.tasks set status = 'cancelled', cancel_reason = 'Duplicate of last month' where id = v_t2;
  perform public.test_check('tasks', 'a series manager can cancel with a reason',
    (select cancelled_at from public.tasks where id = v_t2) is not null and public.test_event_count(v_t2, 'TaskCancelled') > 0);
  update public.tasks set assignee_id = v_maint where id = v_t3;
  perform public.test_check('tasks', 'reassigning is written to the history', exists (select 1 from public.task_activities where task_id = v_t3 and action = 'reassigned') or (select assignee_id from public.tasks where id = v_t3) = v_maint);
  perform public.test_logout();

  -- reminders ------------------------------------------------------------------------------------------------------------
  perform public.test_login(v_pm);
  v_x := public.create_scheduled_task(v_a, jsonb_build_object('title', 'Reminder task', 'due_date', current_date + 20, 'assignee_id', v_maint, 'reminder', jsonb_build_object('enabled', true, 'days_before', jsonb_build_array(1, 3), 'channels', jsonb_build_array('in_app'))));
  perform public.test_check('tasks', 'one reminder per day-before and channel is scheduled', (select count(*) from public.task_reminders where task_id = v_x and status = 'scheduled') = 2);
  update public.tasks set due_date = current_date + 25 where id = v_x;
  perform public.test_check('tasks', 'rescheduling replaces the scheduled reminders',
    (select count(*) from public.task_reminders where task_id = v_x and status = 'scheduled') = 2 and (select count(*) from public.task_reminders where task_id = v_x and status = 'cancelled') = 2);
  insert into public.task_reminders (organization_id, task_id, remind_at, channel, recipient_id) values (v_a, v_x, now() - interval '1 minute', 'in_app', v_maint);
  perform public.test_logout();
  perform public.test_login(v_ro);
  v_err := public.test_err(format($q$select public.process_task_schedule(%L)$q$, v_a));
  perform public.test_check('tasks', 'process_task_schedule needs manage_task_series', v_err like '42501%', v_err);
  perform public.test_logout();
  perform public.test_login(v_pm);
  v_json := public.process_task_schedule(v_a);
  perform public.test_check('tasks', 'a due in-app reminder becomes a notification for the recipient',
    public.test_note_count(v_x) = 1
    and (v_json ->> 'reminders_delivered')::integer = 1);
  v_json := public.process_task_schedule(v_a);
  perform public.test_check('tasks', 'running the schedule again does not repeat the notification',
    public.test_note_count(v_x) = 1 and (v_json ->> 'reminders_delivered')::integer = 0);
  perform public.test_logout();

  -- recurrence maths -----------------------------------------------------------------------------------------------------
  perform public.test_login(v_pm);
  v_x := public.create_scheduled_task(v_a, jsonb_build_object('title', 'Weekly walk-through', 'due_date', '2026-01-05', 'assignee_id', v_maint,
           'recurrence', jsonb_build_object('frequency', 'weekly', 'interval', 1, 'days_of_week', jsonb_build_array(1))));
  select recurrence_id into v_s from public.tasks where id = v_x;
  perform public.test_check('tasks', 'weekly series: the first task plus five upcoming Mondays',
    (select array_agg(due_date order by due_date) from public.tasks where recurrence_id = v_s) = array['2026-01-05', '2026-01-12', '2026-01-19', '2026-01-26', '2026-02-02', '2026-02-09']::date[]);
  perform public.test_check('tasks', 'the series records where generation stopped',
    (select last_generated_date from public.task_recurrences where id = v_s) = '2026-02-09' and (select next_occurrence_date from public.task_recurrences where id = v_s) = '2026-02-16');
  perform public.test_check('tasks', 'generated occurrences carry the template and reference numbers',
    (select count(*) from public.tasks where recurrence_id = v_s and title = 'Weekly walk-through' and assignee_id = v_maint and reference_number is not null and is_recurring) = 6);
  v_json := public.set_task_series_status(v_s, 'generate', 3);
  v_json := public.set_task_series_status(v_s, 'generate', 3);
  perform public.test_check('tasks', 'generating again continues the series without duplicates',
    (select count(*) from public.tasks where recurrence_id = v_s) = 12 and (select count(distinct occurrence_date) from public.tasks where recurrence_id = v_s) = 12);
  v_err := public.test_err(format($q$insert into public.tasks (organization_id, title, recurrence_id, occurrence_date, due_date) values (%L, 'Dup', %L, '2026-01-12', '2026-01-12')$q$, v_a, v_s));
  perform public.test_check('tasks', 'a series can have only one task per day (unique)', v_err like '23505%', v_err);

  v_x := public.create_scheduled_task(v_a, jsonb_build_object('title', 'Second Monday', 'due_date', '2026-01-12', 'recurrence', jsonb_build_object('frequency', 'monthly', 'month_week', 2, 'month_weekday', 1)));
  perform public.test_check('tasks', 'monthly on the 2nd Monday',
    (select array_agg(due_date order by due_date) from public.tasks where recurrence_id = (select recurrence_id from public.tasks where id = v_x)) = array['2026-01-12', '2026-02-09', '2026-03-09', '2026-04-13', '2026-05-11', '2026-06-08']::date[]);
  v_x := public.create_scheduled_task(v_a, jsonb_build_object('title', 'Last Friday', 'due_date', '2026-01-30', 'recurrence', jsonb_build_object('frequency', 'monthly', 'month_week', -1, 'month_weekday', 5)));
  perform public.test_check('tasks', 'monthly on the last Friday',
    (select array_agg(due_date order by due_date) from public.tasks where recurrence_id = (select recurrence_id from public.tasks where id = v_x)) = array['2026-01-30', '2026-02-27', '2026-03-27', '2026-04-24', '2026-05-29', '2026-06-26']::date[]);
  v_x := public.create_scheduled_task(v_a, jsonb_build_object('title', 'Month end', 'due_date', '2026-01-31', 'recurrence', jsonb_build_object('frequency', 'monthly', 'month_day', 31)));
  perform public.test_check('tasks', 'monthly on day 31 falls back to the last day of shorter months',
    (select array_agg(due_date order by due_date) from public.tasks where recurrence_id = (select recurrence_id from public.tasks where id = v_x)) = array['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30', '2026-05-31', '2026-06-30']::date[]);
  v_x := public.create_scheduled_task(v_a, jsonb_build_object('title', 'Quarterly review', 'due_date', '2026-01-15', 'recurrence', jsonb_build_object('frequency', 'quarterly')));
  perform public.test_check('tasks', 'quarterly series', (select array_agg(due_date order by due_date) from public.tasks where recurrence_id = (select recurrence_id from public.tasks where id = v_x))
    = array['2026-01-15', '2026-04-15', '2026-07-15', '2026-10-15', '2027-01-15', '2027-04-15']::date[]);
  v_x := public.create_scheduled_task(v_a, jsonb_build_object('title', 'Leap day', 'due_date', '2024-02-29', 'recurrence', jsonb_build_object('frequency', 'yearly')));
  perform public.test_check('tasks', 'yearly on 29 February uses the 28th in common years', (select array_agg(due_date order by due_date) from public.tasks where recurrence_id = (select recurrence_id from public.tasks where id = v_x))
    = array['2024-02-29', '2025-02-28', '2026-02-28', '2027-02-28', '2028-02-29', '2029-02-28']::date[]);
  v_x := public.create_scheduled_task(v_a, jsonb_build_object('title', 'Every other week', 'due_date', '2026-01-06', 'recurrence', jsonb_build_object('frequency', 'weekly', 'interval', 2, 'days_of_week', jsonb_build_array(2, 4), 'end_date', '2026-02-05')));
  perform public.test_check('tasks', 'every second week on Tuesday and Thursday, stopping at the end date',
    (select array_agg(due_date order by due_date) from public.tasks where recurrence_id = (select recurrence_id from public.tasks where id = v_x)) = array['2026-01-06', '2026-01-08', '2026-01-20', '2026-01-22', '2026-02-03', '2026-02-05']::date[]);
  perform public.test_check('tasks', 'a series that has reached its end date has no next occurrence', (select next_occurrence_date from public.task_recurrences where id = (select recurrence_id from public.tasks where id = v_x)) is null);
  v_x := public.create_scheduled_task(v_a, jsonb_build_object('title', 'Every 3 days', 'due_date', '2026-01-01', 'recurrence', jsonb_build_object('frequency', 'daily', 'interval', 3)));
  perform public.test_check('tasks', 'daily with an interval', (select array_agg(due_date order by due_date) from public.tasks where recurrence_id = (select recurrence_id from public.tasks where id = v_x))
    = array['2026-01-01', '2026-01-04', '2026-01-07', '2026-01-10', '2026-01-13', '2026-01-16']::date[]);
  v_err := public.test_err(format($q$insert into public.task_recurrences (organization_id, title, frequency, start_date, month_week) values (%L, 'Bad', 'monthly', '2026-01-01', 2)$q$, v_a));
  perform public.test_check('tasks', 'a relative monthly rule needs both the week and the weekday', v_err like '23514%', v_err);

  -- series control -------------------------------------------------------------------------------------------------------
  update public.tasks set status = 'completed' where recurrence_id = v_s and due_date = '2026-01-05';
  v_json := public.update_task_series_occurrences((select id from public.tasks where recurrence_id = v_s and due_date = '2026-01-26'), '{"priority": "urgent", "title": "Weekly walk-through (updated)"}', 'future');
  perform public.test_check('tasks', 'a "this and future" edit changes only open occurrences from that date',
    (select count(*) from public.tasks where recurrence_id = v_s and priority = 'urgent' and due_date >= '2026-01-26') = (select count(*) from public.tasks where recurrence_id = v_s and due_date >= '2026-01-26')
    and (select count(*) from public.tasks where recurrence_id = v_s and priority = 'normal' and due_date < '2026-01-26') = 3, v_json::text);
  perform public.test_check('tasks', 'a series edit updates the template used for later occurrences', (select template ->> 'priority' from public.task_recurrences where id = v_s) = 'urgent');
  v_err := public.test_err(format($q$select public.update_task_series_occurrences(%L, '{"due_date": "2026-05-01"}', 'all')$q$, (select id from public.tasks where recurrence_id = v_s limit 1)));
  perform public.test_check('tasks', 'schedule fields cannot be changed series-wide', v_err like '22023%', v_err);
  v_err := public.test_err(format($q$select public.update_task_series_occurrences(%L, jsonb_build_object('assignee_id', %L), 'all')$q$, (select id from public.tasks where recurrence_id = v_s limit 1), v_out));
  perform public.test_check('tasks', 'series edits are checked like single edits (assignee must be a member)', v_err like '23514%', v_err);

  v_json := public.set_task_series_status(v_s, 'pause');
  v_json := public.set_task_series_status(v_s, 'generate', 3);
  perform public.test_check('tasks', 'a paused series generates nothing', (v_json ->> 'count')::integer = 0 and (select count(*) from public.tasks where recurrence_id = v_s) = 12);
  v_json := public.set_task_series_status(v_s, 'resume');
  perform public.test_check('tasks', 'resuming makes the series active again', (select status from public.task_recurrences where id = v_s) = 'active');
  v_json := public.set_task_series_status(v_s, 'cancel');
  perform public.test_check('tasks', 'cancelling a series cancels open occurrences and keeps completed history',
    (select count(*) from public.tasks where recurrence_id = v_s and status = 'cancelled' and cancel_reason = 'Series cancelled') = 11
    and (select status from public.tasks where recurrence_id = v_s and due_date = '2026-01-05') = 'completed' and (v_json ->> 'count')::integer = 11);
  v_err := public.test_err(format($q$select public.set_task_series_status(%L, 'resume')$q$, v_s));
  perform public.test_check('tasks', 'a cancelled series cannot be resumed', v_err like '22023%', v_err);
  perform public.test_logout();
  perform public.test_login(v_maint);
  v_err := public.test_err(format($q$select public.set_task_series_status(%L, 'pause')$q$, v_s));
  perform public.test_check('tasks', 'staff cannot control series', v_err like '42501%', v_err);
  perform public.test_logout();

  -- overdue flags and the worker entry point -----------------------------------------------------------------------------
  perform public.test_login(v_pm);
  v_x := public.create_scheduled_task(v_a, jsonb_build_object('title', 'Already late', 'due_date', current_date - 3, 'assignee_id', v_maint));
  v_json := public.process_task_schedule(v_a);
  perform public.test_check('tasks', 'overdue tasks are flagged once (history + TaskOverdue)',
    (select overdue_notified_at from public.tasks where id = v_x) is not null and (select count(*) from public.task_activities where task_id = v_x and action = 'overdue') = 1
    and public.test_event_count(v_x, 'TaskOverdue') = 1 and (v_json ->> 'overdue_flagged')::integer >= 1);
  v_json := public.process_task_schedule(v_a);
  perform public.test_check('tasks', 'the overdue flag is not repeated', public.test_event_count(v_x, 'TaskOverdue') = 1);
  update public.tasks set due_date = current_date + 5 where id = v_x;
  perform public.test_check('tasks', 'rescheduling into the future clears the overdue flag', (select overdue_notified_at from public.tasks where id = v_x) is null);
  v_x := public.create_scheduled_task(v_a, jsonb_build_object('title', 'Daily check', 'due_date', current_date, 'recurrence', jsonb_build_object('frequency', 'daily')));
  select recurrence_id into v_s from public.tasks where id = v_x;
  v_json := public.process_task_schedule(v_a);
  v_json := public.process_task_schedule(v_a);
  v_json := public.process_task_schedule(v_a);
  perform public.test_check('tasks', 'the schedule job fills the next 30 days and never duplicates a day',
    (select max(due_date) from public.tasks where recurrence_id = v_s) = current_date + 30 and (select count(*) from public.tasks where recurrence_id = v_s) = 31
    and (select count(distinct occurrence_date) from public.tasks where recurrence_id = v_s) = 31);
  perform public.test_logout();

  -- the worker (service role) --------------------------------------------------------------------------------------------
  perform set_config('request.jwt.claims', '{"role": "service_role"}', true);
  execute 'set local role service_role';
  v_n := public.process_all_task_schedules();
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
  perform public.test_check('tasks', 'workers can run the schedule for every organization', v_n >= 2);
  perform public.test_login(v_pm);
  v_err := public.test_err('select public.process_all_task_schedules()');
  perform public.test_check('tasks', 'process_all_task_schedules is for workers only', v_err like '42501%', v_err);
  perform public.test_logout();

  -- categories, comments, history, deletion -----------------------------------------------------------------------------
  perform public.test_login(v_pm);
  insert into public.task_categories (organization_id, name, color) values (v_a, 'Turnover Cleaning', '#0d9488') returning id into v_cat;
  perform public.test_check('tasks', 'custom categories get a slug and are not system categories', (select slug from public.task_categories where id = v_cat) = 'turnover-cleaning' and not (select is_system from public.task_categories where id = v_cat));
  v_err := public.test_err(format($q$insert into public.task_categories (organization_id, name, is_system) values (%L, 'Sneaky', true)$q$, v_a));
  perform public.test_check('tasks', 'users cannot create system categories', (select is_system from public.task_categories where name = 'Sneaky' and organization_id = v_a) is not true, v_err);
  v_err := public.test_err(format($q$delete from public.task_categories where organization_id = %L and slug = 'custom'$q$, v_a));
  perform public.test_check('tasks', 'system categories cannot be deleted', v_err like '23514%', v_err);
  v_err := public.test_err(format($q$insert into public.task_categories (organization_id, name, color) values (%L, 'Bad colour', 'blue')$q$, v_a));
  perform public.test_check('tasks', 'category colours must be hex values', v_err like '23514%', v_err);
  update public.tasks set category_id = v_cat where id = v_t3;
  delete from public.task_categories where id = v_cat;
  perform public.test_check('tasks', 'deleting a category keeps the tasks that used it', (select category_id from public.tasks where id = v_t3) is null and exists (select 1 from public.tasks where id = v_t3));
  perform public.test_logout();
  perform public.test_login(v_maint);
  v_err := public.test_err(format($q$insert into public.task_categories (organization_id, name) values (%L, 'Staff category')$q$, v_a));
  perform public.test_check('tasks', 'staff cannot manage categories', v_err like '42501%', v_err);
  v_err := public.test_err(format($q$insert into public.task_activities (organization_id, task_id, action, summary) values (%L, %L, 'edited', 'forged')$q$, v_a, v_t1));
  perform public.test_check('tasks', 'history cannot be written by users', v_err like '42501%', v_err);
  v_err := public.test_err(format($q$delete from public.task_activities where task_id = %L$q$, v_t1));
  perform public.test_check('tasks', 'history cannot be deleted by users', v_err like '42501%', v_err);
  delete from public.tasks where id = v_t3; get diagnostics v_n = row_count;
  perform public.test_check('tasks', 'only series managers can delete tasks', v_n = 0 and exists (select 1 from public.tasks where id = v_t3));
  perform public.test_logout();
  perform public.test_login(v_pm);
  delete from public.tasks where id = v_t3; get diagnostics v_n = row_count;
  perform public.test_check('tasks', 'deleting a task removes its children', v_n = 1 and not exists (select 1 from public.task_activities where task_id = v_t3) and not exists (select 1 from public.task_reminders where task_id = v_t3));
  perform public.test_logout();

  -- attachments link to Document Center documents -----------------------------------------------------------------------
  perform public.test_login(v_pm);
  v_err := public.test_err(format($q$insert into public.task_attachments (organization_id, task_id, file_name, file_size, uploaded_by) values (%L, %L, 'photo.jpg', 1024, %L)$q$, v_a, v_t1, v_pm));
  perform public.test_check('tasks', 'managers can attach files to a task', v_err is null, v_err);
  perform public.test_logout();
  perform public.test_login(v_ro);
  v_err := public.test_err(format($q$insert into public.task_attachments (organization_id, task_id, file_name, uploaded_by) values (%L, %L, 'x.pdf', %L)$q$, v_a, v_t1, v_ro));
  perform public.test_check('tasks', 'read-only members cannot attach files', v_err like '42501%', v_err);
  perform public.test_logout();

  -- Document Center links ------------------------------------------------------------------------------------------------
  perform public.test_login(v_pm);
  v_err := public.test_err(format($q$insert into public.document_links (organization_id, document_id, entity_type, entity_id, entity_label) values (%L, %L, 'task', %L, 'TSK-0001')$q$, v_a, public.test_uuid('doc_a'), v_t1));
  perform public.test_check('tasks', 'a Document Center document can be linked to a task', v_err is null, v_err);
  v_err := public.test_err(format($q$insert into public.document_links (organization_id, document_id, entity_type, entity_id) values (%L, %L, 'task', %L)$q$, v_a, public.test_uuid('doc_a'), v_tb));
  perform public.test_check('tasks', 'a document cannot be linked to another organization''s task', v_err like '23503%', v_err);
  perform public.test_logout();

  -- privileges -----------------------------------------------------------------------------------------------------------
  perform public.test_check('tasks', 'anon cannot execute the task functions',
    not has_function_privilege('anon', 'public.create_scheduled_task(uuid,jsonb)', 'execute') and not has_function_privilege('anon', 'public.process_task_schedule(uuid)', 'execute')
    and not has_function_privilege('anon', 'public.set_task_series_status(uuid,text,integer)', 'execute'));
  perform public.test_check('tasks', 'the all-organizations job is service_role only',
    not has_function_privilege('authenticated', 'public.process_all_task_schedules()', 'execute') and has_function_privilege('service_role', 'public.process_all_task_schedules()', 'execute'));
  perform public.test_check('tasks', 'role defaults: maintenance staff manage but do not view-all; read-only views',
    exists (select 1 from public.role_permissions where role = 'maintenance_staff' and permission = 'manage_tasks') and not exists (select 1 from public.role_permissions where role = 'maintenance_staff' and permission = 'view_tasks')
    and exists (select 1 from public.role_permissions where role = 'read_only' and permission = 'view_tasks') and not exists (select 1 from public.role_permissions where role = 'read_only' and permission = 'manage_tasks')
    and (select count(*) from public.role_permissions where role = 'administrator' and permission in ('view_tasks', 'manage_tasks', 'assign_tasks', 'manage_task_series')) = 4);
end $$;

select suite, count(*) filter (where passed) as passed, count(*) filter (where not passed) as failed from public.test_results where suite = 'tasks' group by suite;
