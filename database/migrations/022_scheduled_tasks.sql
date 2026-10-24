-- =====================================================================================================================
-- 022_scheduled_tasks.sql
-- Scheduled Tasks: work assignments with due dates, priorities, checklists, comments, attachments, reminders, recurring series
-- and a history of every change. This is the people-facing task list; it is separate from public.scheduled_tasks (background
-- jobs run by workers) and from public.project_tasks (the task rows inside a renovation project).
--
-- What the database enforces (so the screen cannot get it wrong):
--   * Visibility: members with view_tasks see every task; everyone else sees the tasks they are assigned to, created or collaborate on.
--   * Assigning a task to someone else needs assign_tasks; cancelling or rescheduling needs manage_task_series (or being the assignee/creator for rescheduling).
--   * Completed / cancelled tasks keep their history: core fields are frozen until the task is reopened.
--   * One task per recurring series and day (UNIQUE recurrence_id, occurrence_date), so generating occurrences twice is harmless.
--   * Every change writes a task_activities row, and the important ones write a domain_events row (outbox for automation).
--   * Reference numbers (TSK-0001 ...) are assigned atomically per organization.
--
-- Functions: create_scheduled_task, set_task_series_status, update_task_series_occurrences, process_task_schedule (generates
-- occurrences, flags overdue tasks, turns due in-app reminders into notifications) and process_all_task_schedules (workers only).
-- Nothing here sends e-mail or text: only "in_app" reminders are delivered (as notifications); other channels stay "scheduled".
-- =====================================================================================================================
begin;
set local search_path = public, extensions;

-- ---------------------------------------------------------------------------------------------------------------------
-- Permissions
-- ---------------------------------------------------------------------------------------------------------------------
insert into public.permissions (key, area, label, description) values
  ('view_tasks',          'operations', 'View all tasks',                    'See every scheduled task (without it: only tasks assigned to you, created by you or shared with you)'),
  ('manage_tasks',        'operations', 'Manage tasks',                      'Create, edit, complete and reopen tasks, checklists, reminders and attachments'),
  ('assign_tasks',        'operations', 'Assign tasks to others',            'Assign tasks and collaborators other than yourself'),
  ('manage_task_series',  'operations', 'Manage series, categories, cancel', 'Create and control recurring series, manage task categories, cancel or delete tasks')
on conflict (key) do update set area = excluded.area, label = excluded.label, description = excluded.description;

insert into public.role_permissions (role, permission) values
  ('administrator', 'view_tasks'), ('administrator', 'manage_tasks'), ('administrator', 'assign_tasks'), ('administrator', 'manage_task_series'),
  ('property_manager', 'view_tasks'), ('property_manager', 'manage_tasks'), ('property_manager', 'assign_tasks'), ('property_manager', 'manage_task_series'),
  ('accountant', 'view_tasks'), ('accountant', 'manage_tasks'),
  ('maintenance_staff', 'manage_tasks'),
  ('read_only', 'view_tasks')
on conflict do nothing;

-- ---------------------------------------------------------------------------------------------------------------------
-- Categories and recurring series
-- ---------------------------------------------------------------------------------------------------------------------
create table public.task_categories (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name            text not null check (btrim(name) <> '' and char_length(name) <= 80),
  slug            text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  color           text not null default '#1d6650' check (color ~ '^#[0-9a-fA-F]{6}$'),
  icon            text not null default 'clipboard',
  is_system       boolean not null default false,
  is_active       boolean not null default true,
  created_by      uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, slug),
  unique (organization_id, name)
);

create table public.task_recurrences (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references public.organizations (id) on delete cascade,
  title                 text not null check (btrim(title) <> ''),
  frequency             text not null default 'weekly' check (frequency in ('daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'custom')),
  "interval"            integer not null default 1 check ("interval" between 1 and 52),
  days_of_week          smallint[] not null default '{}' check (days_of_week <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]),   -- 0 = Sunday
  month_day            integer check (month_day between 1 and 31),
  month_week           integer check (month_week in (-1, 1, 2, 3, 4, 5)),                                                   -- -1 = last
  month_weekday        integer check (month_weekday between 0 and 6),
  start_date           date not null,
  end_date             date,
  timezone             text not null default 'America/Toronto',
  advance_reminder_days integer not null default 1 check (advance_reminder_days between 0 and 30),
  status               text not null default 'active' check (status in ('active', 'paused', 'cancelled', 'completed')),
  next_occurrence_date date,
  last_generated_date  date,
  template             jsonb not null default '{}'::jsonb check (jsonb_typeof(template) = 'object'),   -- fields copied onto each generated occurrence
  created_by           uuid references public.profiles (id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (organization_id, id),
  check (end_date is null or end_date >= start_date),
  check ((month_week is null) = (month_weekday is null))
);
create index task_recurrences_status_idx on public.task_recurrences (organization_id, status, next_occurrence_date);

-- ---------------------------------------------------------------------------------------------------------------------
-- Tasks and what hangs off them
-- ---------------------------------------------------------------------------------------------------------------------
create table public.tasks (
  id                      uuid primary key default gen_random_uuid(),
  organization_id         uuid not null references public.organizations (id) on delete cascade,
  reference_number        text,
  title                   text not null check (btrim(title) <> ''),
  description             text not null default '',
  category_id             uuid,
  priority                text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  status                  text not null default 'not_started' check (status in ('not_started', 'in_progress', 'blocked', 'completed', 'cancelled')),
  property_id             uuid,
  unit_id                 uuid,
  tenant_id               uuid,
  lease_id                uuid,
  maintenance_request_id  uuid,
  vendor_id               uuid,
  project_id              uuid,
  assignee_id             uuid references public.profiles (id) on delete set null,
  collaborator_ids        uuid[] not null default '{}',
  start_date              date,
  due_date                date,
  due_time                time,
  timezone                text not null default 'America/Toronto',
  is_recurring            boolean not null default false,
  recurrence_id           uuid,
  occurrence_date         date,
  completion_notes        text not null default '',
  completed_at            timestamptz,
  completed_by            uuid references public.profiles (id) on delete set null,
  cancelled_at            timestamptz,
  cancel_reason           text not null default '',
  reminder_prefs          jsonb not null default '{"enabled": true, "daysBefore": [1], "channels": ["in_app"]}'::jsonb check (jsonb_typeof(reminder_prefs) = 'object'),
  overdue_notified_at     timestamptz,
  created_by              uuid references public.profiles (id) on delete set null,
  updated_by              uuid references public.profiles (id) on delete set null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, reference_number),
  unique (recurrence_id, occurrence_date),                       -- a series produces at most one task per day
  check (due_date is null or start_date is null or due_date >= start_date),
  foreign key (organization_id, category_id)            references public.task_categories (organization_id, id)    on delete set null (category_id),
  foreign key (organization_id, property_id)            references public.properties (organization_id, id)        on delete set null (property_id),
  foreign key (organization_id, unit_id)                references public.units (organization_id, id)             on delete set null (unit_id),
  foreign key (organization_id, tenant_id)              references public.tenants (organization_id, id)           on delete set null (tenant_id),
  foreign key (organization_id, lease_id)               references public.leases (organization_id, id)            on delete set null (lease_id),
  foreign key (organization_id, maintenance_request_id) references public.maintenance_requests (organization_id, id) on delete set null (maintenance_request_id),
  foreign key (organization_id, vendor_id)              references public.vendors (organization_id, id)           on delete set null (vendor_id),
  foreign key (organization_id, project_id)             references public.projects (organization_id, id)          on delete set null (project_id),
  foreign key (organization_id, recurrence_id)          references public.task_recurrences (organization_id, id)  on delete set null (recurrence_id)
);
create trigger tasks_number before insert on public.tasks for each row execute function private.assign_number('reference_number', 'task', 'TSK-', '4');
create index tasks_due_idx        on public.tasks (organization_id, due_date) where status not in ('completed', 'cancelled');
create index tasks_status_idx     on public.tasks (organization_id, status, priority);
create index tasks_assignee_idx   on public.tasks (organization_id, assignee_id, due_date);
create index tasks_category_idx   on public.tasks (organization_id, category_id) where category_id is not null;
create index tasks_property_idx   on public.tasks (organization_id, property_id) where property_id is not null;
create index tasks_unit_idx       on public.tasks (organization_id, unit_id) where unit_id is not null;
create index tasks_tenant_idx     on public.tasks (organization_id, tenant_id) where tenant_id is not null;
create index tasks_lease_idx      on public.tasks (organization_id, lease_id) where lease_id is not null;
create index tasks_maintenance_idx on public.tasks (organization_id, maintenance_request_id) where maintenance_request_id is not null;
create index tasks_vendor_idx     on public.tasks (organization_id, vendor_id) where vendor_id is not null;
create index tasks_project_idx    on public.tasks (organization_id, project_id) where project_id is not null;
create index tasks_recurrence_idx on public.tasks (organization_id, recurrence_id) where recurrence_id is not null;
create index tasks_collaborators_idx on public.tasks using gin (collaborator_ids);

create table public.task_checklist_items (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  task_id         uuid not null,
  title           text not null check (btrim(title) <> '' and char_length(title) <= 300),
  is_done         boolean not null default false,
  done_by         uuid references public.profiles (id) on delete set null,
  done_at         timestamptz,
  position        integer not null default 0,
  created_at      timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, task_id) references public.tasks (organization_id, id) on delete cascade
);
create index task_checklist_items_task_idx on public.task_checklist_items (organization_id, task_id, position);

create table public.task_comments (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  task_id         uuid not null,
  author_id       uuid references public.profiles (id) on delete set null,
  body            text not null check (btrim(body) <> ''),
  created_at      timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, task_id) references public.tasks (organization_id, id) on delete cascade
);
create index task_comments_task_idx on public.task_comments (organization_id, task_id, created_at);

create table public.task_attachments (                            -- the file itself lives in Document Center (documents); this row ties it to the task
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  task_id         uuid not null,
  document_id     uuid,
  file_name       text not null check (btrim(file_name) <> ''),
  file_size       bigint not null default 0 check (file_size >= 0),
  mime_type       text not null default 'application/octet-stream',
  uploaded_by     uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, task_id)     references public.tasks (organization_id, id)     on delete cascade,
  foreign key (organization_id, document_id) references public.documents (organization_id, id) on delete set null (document_id)
);
create index task_attachments_task_idx     on public.task_attachments (organization_id, task_id);
create index task_attachments_document_idx on public.task_attachments (organization_id, document_id) where document_id is not null;

create table public.task_reminders (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  task_id         uuid not null,
  remind_at       timestamptz not null,
  channel         text not null default 'in_app' check (channel in ('in_app', 'email', 'sms')),
  status          text not null default 'scheduled' check (status in ('scheduled', 'sent', 'cancelled', 'failed')),
  recipient_id    uuid references public.profiles (id) on delete cascade,
  sent_at         timestamptz,
  created_at      timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, task_id) references public.tasks (organization_id, id) on delete cascade
);
create index task_reminders_task_idx on public.task_reminders (organization_id, task_id);
create index task_reminders_due_idx  on public.task_reminders (remind_at) where status = 'scheduled';

create table public.task_activities (                             -- append-only history, written by the triggers below
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  task_id         uuid not null,
  recurrence_id   uuid,
  actor_id        uuid references public.profiles (id) on delete set null,
  action          text not null,
  summary         text not null,
  prior_value     text,
  new_value       text,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  foreign key (organization_id, task_id) references public.tasks (organization_id, id) on delete cascade
);
create index task_activities_task_idx on public.task_activities (organization_id, task_id, created_at desc);

create trigger task_categories_updated_at  before update on public.task_categories  for each row execute function private.set_updated_at();
create trigger task_recurrences_updated_at before update on public.task_recurrences for each row execute function private.set_updated_at();
create trigger tasks_updated_at            before update on public.tasks            for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------------------------------------------------
-- Recurrence engine (port of the module's date maths: every comparison is on calendar dates, so daylight-saving changes never move a task)
-- ---------------------------------------------------------------------------------------------------------------------
create or replace function private.task_series_matches(p_day date, r public.task_recurrences) returns boolean
language plpgsql immutable set search_path = '' as $$
declare
  v_iv integer := greatest(coalesce(r."interval", 1), 1);
  v_diff integer := p_day - r.start_date;
  v_days smallint[];
  v_months integer;
  v_dim integer := extract(day from (date_trunc('month', p_day::timestamp) + interval '1 month - 1 day'))::integer;
  v_first date;
  v_expected date;
  v_off integer;
  v_day integer;
begin
  if p_day < r.start_date then return false; end if;

  if r.frequency = 'daily' or (r.frequency = 'custom' and cardinality(r.days_of_week) = 0) then
    return v_diff % v_iv = 0;
  end if;

  if r.frequency in ('weekly', 'custom') then
    v_days := case when cardinality(r.days_of_week) > 0 then r.days_of_week else array[extract(dow from r.start_date)::smallint] end;
    if not (extract(dow from p_day)::smallint = any (v_days)) then return false; end if;
    return ((p_day - ((extract(dow from p_day)::integer + 6) % 7)) - (r.start_date - ((extract(dow from r.start_date)::integer + 6) % 7))) / 7 % v_iv = 0;
  end if;

  v_months := (extract(year from p_day)::integer - extract(year from r.start_date)::integer) * 12
            + (extract(month from p_day)::integer - extract(month from r.start_date)::integer);

  if r.frequency = 'monthly' then
    if v_months % v_iv <> 0 then return false; end if;
    if r.month_week is not null and r.month_weekday is not null then
      if r.month_week = -1 then
        v_first := (date_trunc('month', p_day::timestamp) + interval '1 month - 1 day')::date;
        v_expected := v_first - ((extract(dow from v_first)::integer - r.month_weekday + 7) % 7);
      else
        v_first := date_trunc('month', p_day::timestamp)::date;
        v_off := (r.month_weekday - extract(dow from v_first)::integer + 7) % 7;
        v_day := least(1 + v_off + (r.month_week - 1) * 7, v_dim);
        v_expected := v_first + (v_day - 1);
      end if;
      return v_expected = p_day;
    end if;
    if r.month_day is not null then return extract(day from p_day)::integer = least(r.month_day, v_dim); end if;
    return extract(day from p_day)::integer = least(extract(day from r.start_date)::integer, v_dim);
  end if;

  if r.frequency = 'quarterly' then
    if v_months % (3 * v_iv) <> 0 then return false; end if;
    return extract(day from p_day)::integer = least(extract(day from r.start_date)::integer, v_dim);
  end if;

  if r.frequency = 'yearly' then
    if (extract(year from p_day)::integer - extract(year from r.start_date)::integer) % v_iv <> 0 then return false; end if;
    if extract(month from p_day) <> extract(month from r.start_date) then return false; end if;
    return extract(day from p_day)::integer = least(extract(day from r.start_date)::integer, v_dim);
  end if;
  return false;
end $$;

-- First matching date strictly after p_after (or on the start date when p_after is null); null when the series is over. Searches up to 5 years.
create or replace function private.next_task_occurrence(r public.task_recurrences, p_after date) returns date
language plpgsql immutable set search_path = '' as $$
declare
  v_cursor date := case when p_after is null then r.start_date else greatest(p_after + 1, r.start_date) end;
  i integer;
begin
  for i in 0 .. 366 * 5 + 10 loop
    if r.end_date is not null and v_cursor > r.end_date then return null; end if;
    if private.task_series_matches(v_cursor, r) then return v_cursor; end if;
    v_cursor := v_cursor + 1;
  end loop;
  return null;
end $$;

-- ---------------------------------------------------------------------------------------------------------------------
-- Before-write rules on tasks (apply to signed-in users; workers and the functions below run as the database owner)
-- ---------------------------------------------------------------------------------------------------------------------
create or replace function private.task_before_write() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_enforce boolean := coalesce(current_setting('role', true), '') = 'authenticated' and coalesce(current_setting('app.task_system', true), '') <> 'on';
  v_terminal boolean;
  v_user uuid;
begin
  new.is_recurring := new.recurrence_id is not null;
  if tg_op = 'INSERT' then
    new.created_by := coalesce(new.created_by, v_uid);
    new.updated_by := coalesce(new.updated_by, v_uid);
    if new.status in ('completed', 'cancelled') then
      raise exception 'a task cannot be created as completed or cancelled' using errcode = '22023';
    end if;
  else
    new.updated_by := coalesce(v_uid, new.updated_by);
    v_terminal := old.status in ('completed', 'cancelled');
    if v_terminal and new.status in ('completed', 'cancelled') and new.status <> old.status then
      raise exception 'reopen the task before changing it from % to %', old.status, new.status using errcode = '22023';
    end if;
    if v_terminal and new.status = old.status and (
         (new.title, new.description, new.category_id, new.priority, new.property_id, new.unit_id, new.tenant_id, new.lease_id, new.maintenance_request_id,
          new.vendor_id, new.project_id, new.assignee_id, new.collaborator_ids, new.start_date, new.due_date, new.due_time)
         is distinct from
         (old.title, old.description, old.category_id, old.priority, old.property_id, old.unit_id, old.tenant_id, old.lease_id, old.maintenance_request_id,
          old.vendor_id, old.project_id, old.assignee_id, old.collaborator_ids, old.start_date, old.due_date, old.due_time)) then
      raise exception 'this task is % - its history is preserved. Reopen it to change the details.', old.status using errcode = '22023';
    end if;
    -- status bookkeeping
    if new.status = 'completed' and old.status <> 'completed' then
      new.completed_at := coalesce(new.completed_at, now());
      new.completed_by := coalesce(v_uid, new.completed_by);
    end if;
    if new.status = 'cancelled' and old.status <> 'cancelled' then
      new.cancelled_at := coalesce(new.cancelled_at, now());
    end if;
    if v_terminal and new.status not in ('completed', 'cancelled') then
      new.completed_at := null; new.completed_by := null; new.cancelled_at := null; new.cancel_reason := '';
    end if;
    if new.due_date is distinct from old.due_date and new.due_date >= current_date then new.overdue_notified_at := null; end if;
    -- cancelling and rescheduling
    if v_enforce and new.status = 'cancelled' and old.status <> 'cancelled' and not private.has_permission(new.organization_id, 'manage_task_series') then
      raise exception 'cancelling a task needs the manage_task_series permission' using errcode = '42501';
    end if;
    if v_enforce and (new.due_date is distinct from old.due_date or new.start_date is distinct from old.start_date)
       and not private.has_permission(new.organization_id, 'manage_task_series')
       and v_uid is distinct from old.assignee_id and v_uid is distinct from old.created_by then
      raise exception 'only the assignee, the creator or a series manager can reschedule this task' using errcode = '42501';
    end if;
  end if;

  if new.status = 'cancelled' and btrim(coalesce(new.cancel_reason, '')) = '' and tg_op = 'UPDATE' and v_enforce then
    raise exception 'give a reason when cancelling a task' using errcode = '22023';
  end if;

  -- assignee and collaborators must be active members of this organization; assigning someone else needs assign_tasks
  if new.assignee_id is not null and (tg_op = 'INSERT' or new.assignee_id is distinct from old.assignee_id) then
    if not exists (select 1 from public.organization_members m where m.organization_id = new.organization_id and m.user_id = new.assignee_id and m.status = 'active') then
      raise exception 'the assignee is not an active member of this organization' using errcode = '23514';
    end if;
    if v_enforce and new.assignee_id is distinct from v_uid and not private.has_permission(new.organization_id, 'assign_tasks') then
      raise exception 'assigning a task to someone else needs the assign_tasks permission' using errcode = '42501';
    end if;
  end if;
  if cardinality(new.collaborator_ids) > 0 and (tg_op = 'INSERT' or new.collaborator_ids is distinct from old.collaborator_ids) then
    for v_user in select distinct u from unnest(new.collaborator_ids) u loop
      if not exists (select 1 from public.organization_members m where m.organization_id = new.organization_id and m.user_id = v_user and m.status = 'active') then
        raise exception 'a collaborator is not an active member of this organization' using errcode = '23514';
      end if;
    end loop;
    if v_enforce and not private.has_permission(new.organization_id, 'assign_tasks') and exists (select 1 from unnest(new.collaborator_ids) u where u is distinct from v_uid)
       and (tg_op = 'INSERT' or new.collaborator_ids is distinct from old.collaborator_ids) then
      raise exception 'adding other collaborators needs the assign_tasks permission' using errcode = '42501';
    end if;
  end if;

  -- a unit must belong to the chosen property
  if new.unit_id is not null and new.property_id is not null then
    if not exists (select 1 from public.units u where u.organization_id = new.organization_id and u.id = new.unit_id and u.property_id = new.property_id) then
      raise exception 'the unit does not belong to the selected property' using errcode = '23514';
    end if;
  end if;
  return new;
end $$;
create trigger tasks_before_write before insert or update on public.tasks for each row execute function private.task_before_write();

-- ---------------------------------------------------------------------------------------------------------------------
-- After-write: history, domain events and reminders
-- ---------------------------------------------------------------------------------------------------------------------
create or replace function private.task_schedule_reminders(t public.tasks) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_days integer;
  v_channel text;
  v_at timestamptz;
begin
  if t.due_date is null or t.assignee_id is null or t.status in ('completed', 'cancelled') then return; end if;
  if coalesce((t.reminder_prefs ->> 'enabled')::boolean, true) is not true then return; end if;
  for v_days in select distinct least(greatest(d::integer, 0), 60) from jsonb_array_elements_text(coalesce(t.reminder_prefs -> 'daysBefore', '[1]'::jsonb)) d limit 3 loop
    for v_channel in select distinct c from jsonb_array_elements_text(coalesce(t.reminder_prefs -> 'channels', '["in_app"]'::jsonb)) c where c in ('in_app', 'email', 'sms') limit 3 loop
      v_at := ((t.due_date - v_days)::timestamp + time '09:00') at time zone t.timezone;
      if v_at >= now() - interval '12 hours' then
        insert into public.task_reminders (organization_id, task_id, remind_at, channel, recipient_id) values (t.organization_id, t.id, v_at, v_channel, t.assignee_id);
      end if;
    end loop;
  end loop;
end $$;

create or replace function private.task_after_write() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_name text;
  v_payload jsonb;
  v_fields text[];
  v_action text;
  v_summary text;
  v_event text;
  v_reschedule boolean := false;
begin
  select coalesce(nullif(btrim(full_name), ''), email, 'Someone') into v_name from public.profiles where id = v_actor;
  v_name := coalesce(v_name, 'The system');
  v_payload := jsonb_build_object('task_id', new.id, 'reference_number', new.reference_number, 'title', new.title, 'status', new.status, 'priority', new.priority,
                                  'assignee_id', new.assignee_id, 'due_date', new.due_date, 'property_id', new.property_id, 'recurrence_id', new.recurrence_id);

  if tg_op = 'INSERT' then
    insert into public.task_activities (organization_id, task_id, recurrence_id, actor_id, action, summary, new_value)
      values (new.organization_id, new.id, new.recurrence_id, v_actor, 'created',
              case when new.recurrence_id is not null and exists (select 1 from public.tasks o where o.recurrence_id = new.recurrence_id and o.id <> new.id)
                   then format('Occurrence generated for %s', new.occurrence_date) else 'Task created' || case when new.recurrence_id is not null then ' with a recurring series' else '' end end,
              new.assignee_id::text);
    insert into public.domain_events (organization_id, event_type, entity_type, entity_id, payload) values (new.organization_id, 'TaskCreated', 'task', new.id, v_payload);
    if new.assignee_id is not null and new.assignee_id is distinct from v_actor then
      insert into public.domain_events (organization_id, event_type, entity_type, entity_id, payload) values (new.organization_id, 'TaskAssigned', 'task', new.id, v_payload);
    end if;
    perform private.task_schedule_reminders(new);
    return new;
  end if;

  if new.status is distinct from old.status then
    if new.status = 'completed' then v_action := 'completed'; v_summary := format('Task completed by %s', v_name); v_event := 'TaskCompleted';
    elsif new.status = 'cancelled' then v_action := 'cancelled'; v_summary := format('Task cancelled by %s%s', v_name, case when new.cancel_reason <> '' then ': ' || new.cancel_reason else '' end); v_event := 'TaskCancelled';
    elsif old.status in ('completed', 'cancelled') then v_action := 'status_changed'; v_summary := format('Task reopened by %s', v_name); v_event := 'TaskStatusChanged';
    else v_action := 'status_changed'; v_summary := format('Status changed from %s to %s', old.status, new.status); v_event := 'TaskStatusChanged';
    end if;
    insert into public.task_activities (organization_id, task_id, recurrence_id, actor_id, action, summary, prior_value, new_value)
      values (new.organization_id, new.id, new.recurrence_id, v_actor, v_action, v_summary, old.status, new.status);
    insert into public.domain_events (organization_id, event_type, entity_type, entity_id, payload)
      values (new.organization_id, v_event, 'task', new.id, v_payload || jsonb_build_object('from', old.status, 'to', new.status));
    if new.status in ('completed', 'cancelled') then
      update public.task_reminders set status = 'cancelled' where task_id = new.id and organization_id = new.organization_id and status = 'scheduled';
    elsif old.status in ('completed', 'cancelled') then
      v_reschedule := true;
    end if;
  end if;

  if new.due_date is distinct from old.due_date then
    insert into public.task_activities (organization_id, task_id, recurrence_id, actor_id, action, summary, prior_value, new_value)
      values (new.organization_id, new.id, new.recurrence_id, v_actor, 'rescheduled',
              format('Rescheduled from %s to %s by %s', coalesce(old.due_date::text, 'no date'), coalesce(new.due_date::text, 'no date'), v_name), old.due_date::text, new.due_date::text);
    insert into public.domain_events (organization_id, event_type, entity_type, entity_id, payload)
      values (new.organization_id, 'TaskDueDateChanged', 'task', new.id, v_payload || jsonb_build_object('from', old.due_date, 'to', new.due_date)),
             (new.organization_id, 'TaskRescheduled',    'task', new.id, v_payload || jsonb_build_object('from', old.due_date, 'to', new.due_date));
    v_reschedule := true;
  end if;

  if new.assignee_id is distinct from old.assignee_id then
    insert into public.task_activities (organization_id, task_id, recurrence_id, actor_id, action, summary, prior_value, new_value)
      values (new.organization_id, new.id, new.recurrence_id, v_actor, 'reassigned', format('Reassigned by %s', v_name), old.assignee_id::text, new.assignee_id::text);
    insert into public.domain_events (organization_id, event_type, entity_type, entity_id, payload) values (new.organization_id, 'TaskAssigned', 'task', new.id, v_payload);
    v_reschedule := true;
  end if;

  if old.overdue_notified_at is null and new.overdue_notified_at is not null then
    insert into public.task_activities (organization_id, task_id, recurrence_id, actor_id, action, summary, new_value)
      values (new.organization_id, new.id, new.recurrence_id, null, 'overdue', format('Task is overdue (due %s)', new.due_date), new.due_date::text);
    insert into public.domain_events (organization_id, event_type, entity_type, entity_id, payload) values (new.organization_id, 'TaskOverdue', 'task', new.id, v_payload);
  end if;

  select array_agg(n.key order by n.key) into v_fields
    from jsonb_each(to_jsonb(new)) n
   where n.value is distinct from (to_jsonb(old) -> n.key)
     and n.key not in ('updated_at', 'updated_by', 'status', 'completed_at', 'completed_by', 'cancelled_at', 'cancel_reason', 'overdue_notified_at', 'due_date', 'assignee_id', 'reminder_prefs');
  if v_fields is not null then
    insert into public.task_activities (organization_id, task_id, recurrence_id, actor_id, action, summary, metadata)
      values (new.organization_id, new.id, new.recurrence_id, v_actor, 'edited', format('Edited (%s) by %s', array_to_string(v_fields, ', '), v_name), jsonb_build_object('fields', to_jsonb(v_fields)));
  end if;

  if v_reschedule or new.reminder_prefs is distinct from old.reminder_prefs then
    update public.task_reminders set status = 'cancelled' where task_id = new.id and organization_id = new.organization_id and status = 'scheduled';
    perform private.task_schedule_reminders(new);
  end if;
  return new;
end $$;
create trigger tasks_after_write after insert or update on public.tasks for each row execute function private.task_after_write();

-- Checklist bookkeeping and category protection
create or replace function private.task_checklist_before_write() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.is_done and (tg_op = 'INSERT' or not old.is_done) then
    new.done_by := coalesce((select auth.uid()), new.done_by); new.done_at := coalesce(new.done_at, now());
  elsif not new.is_done then
    new.done_by := null; new.done_at := null;
  end if;
  return new;
end $$;
create trigger task_checklist_items_before_write before insert or update on public.task_checklist_items for each row execute function private.task_checklist_before_write();

create or replace function private.task_category_guard() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_user boolean := coalesce(current_setting('role', true), '') = 'authenticated' and coalesce(current_setting('app.task_system', true), '') <> 'on';
begin
  if tg_op = 'DELETE' then
    if old.is_system then raise exception 'system categories cannot be deleted - deactivate them instead' using errcode = '23514'; end if;
    return old;
  end if;
  if tg_op = 'INSERT' then
    if coalesce(new.slug, '') = '' then new.slug := trim(both '-' from regexp_replace(lower(new.name), '[^a-z0-9]+', '-', 'g')); end if;
    if v_user then new.is_system := false; new.created_by := coalesce(new.created_by, (select auth.uid())); end if;
  elsif v_user and new.is_system is distinct from old.is_system then
    raise exception 'is_system cannot be changed' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger task_categories_guard before insert or update or delete on public.task_categories for each row execute function private.task_category_guard();

-- Starter categories for every organization (new ones through the trigger, existing ones right below)
create or replace function private.seed_task_categories(p_org uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform set_config('app.task_system', 'on', true);          -- not a user action: lets the guard keep is_system = true
  insert into public.task_categories (organization_id, name, slug, color, icon, is_system) values
    (p_org, 'Property Inspection',            'property-inspection',  '#2563eb', 'search',    true),
    (p_org, 'Preventive Maintenance',         'preventive-maintenance', '#059669', 'wrench',  true),
    (p_org, 'Repairs and Follow-up',          'repairs-follow-up',    '#ea580c', 'hammer',    true),
    (p_org, 'Lease Renewal and Expiration',   'lease-renewal',        '#7c3aed', 'file',      true),
    (p_org, 'Tenant Follow-up',               'tenant-follow-up',     '#0284c7', 'users',     true),
    (p_org, 'Financial Review',               'financial-review',     '#0d9488', 'chart',     true),
    (p_org, 'Vendor Appointment',             'vendor-appointment',   '#db2777', 'truck',     true),
    (p_org, 'Compliance and Documentation',   'compliance',           '#b45309', 'shield',    true),
    (p_org, 'Project Milestone',              'project-milestone',    '#4f46e5', 'flag',      true),
    (p_org, 'Administrative',                 'administrative',       '#64748b', 'clipboard', true),
    (p_org, 'Custom',                         'custom',               '#0f172a', 'star',      true)
  on conflict (organization_id, slug) do nothing;
  perform set_config('app.task_system', 'off', true);
end $$;

create or replace function private.organizations_seed_tasks() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.seed_task_categories(new.id);
  return new;
end $$;
create trigger organizations_seed_task_categories after insert on public.organizations for each row execute function private.organizations_seed_tasks();

select private.seed_task_categories(id) from public.organizations;

-- ---------------------------------------------------------------------------------------------------------------------
-- Row-Level Security
-- ---------------------------------------------------------------------------------------------------------------------
call private.apply_org_policies('public.task_categories',  null, 'manage_task_series');
call private.apply_org_policies('public.task_recurrences', null, 'manage_task_series');

alter table public.tasks enable row level security;
create policy tasks_select on public.tasks for select to authenticated
  using (private.has_permission(organization_id, 'view_tasks') or assignee_id = (select auth.uid()) or created_by = (select auth.uid()) or (select auth.uid()) = any (collaborator_ids));
create policy tasks_insert on public.tasks for insert to authenticated
  with check (private.has_permission(organization_id, 'manage_tasks') and created_by = (select auth.uid()));
create policy tasks_update on public.tasks for update to authenticated
  using (private.has_permission(organization_id, 'manage_tasks')
         and (private.has_permission(organization_id, 'view_tasks') or assignee_id = (select auth.uid()) or created_by = (select auth.uid()) or (select auth.uid()) = any (collaborator_ids)))
  with check (private.has_permission(organization_id, 'manage_tasks'));
create policy tasks_delete on public.tasks for delete to authenticated using (private.has_permission(organization_id, 'manage_task_series'));
revoke all on public.tasks from anon;
grant select, insert, update, delete on public.tasks to authenticated;

-- children: visible exactly when their task is visible (the sub-select runs under the caller's RLS)
do $$
declare
  t text;
begin
  foreach t in array array['task_checklist_items', 'task_comments', 'task_attachments', 'task_reminders', 'task_activities'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select to authenticated using (exists (select 1 from public.tasks k where k.id = task_id and k.organization_id = %I.organization_id))', t || '_select', t, t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;

create policy task_checklist_items_insert on public.task_checklist_items for insert to authenticated
  with check (private.has_permission(organization_id, 'manage_tasks') and exists (select 1 from public.tasks k where k.id = task_id and k.organization_id = task_checklist_items.organization_id));
create policy task_checklist_items_update on public.task_checklist_items for update to authenticated
  using (private.has_permission(organization_id, 'manage_tasks') and exists (select 1 from public.tasks k where k.id = task_id and k.organization_id = task_checklist_items.organization_id))
  with check (private.has_permission(organization_id, 'manage_tasks'));
create policy task_checklist_items_delete on public.task_checklist_items for delete to authenticated
  using (private.has_permission(organization_id, 'manage_tasks') and exists (select 1 from public.tasks k where k.id = task_id and k.organization_id = task_checklist_items.organization_id));
grant select, insert, update, delete on public.task_checklist_items to authenticated;

create policy task_comments_insert on public.task_comments for insert to authenticated
  with check (author_id = (select auth.uid()) and exists (select 1 from public.tasks k where k.id = task_id and k.organization_id = task_comments.organization_id));
create policy task_comments_delete on public.task_comments for delete to authenticated
  using (author_id = (select auth.uid()) or private.has_permission(organization_id, 'manage_task_series'));
grant select, insert, delete on public.task_comments to authenticated;

create policy task_attachments_insert on public.task_attachments for insert to authenticated
  with check (private.has_permission(organization_id, 'manage_tasks') and uploaded_by = (select auth.uid())
              and exists (select 1 from public.tasks k where k.id = task_id and k.organization_id = task_attachments.organization_id));
create policy task_attachments_delete on public.task_attachments for delete to authenticated
  using (private.has_permission(organization_id, 'manage_tasks') and exists (select 1 from public.tasks k where k.id = task_id and k.organization_id = task_attachments.organization_id));
grant select, insert, delete on public.task_attachments to authenticated;

create policy task_reminders_insert on public.task_reminders for insert to authenticated
  with check (private.has_permission(organization_id, 'manage_tasks') and exists (select 1 from public.tasks k where k.id = task_id and k.organization_id = task_reminders.organization_id));
create policy task_reminders_update on public.task_reminders for update to authenticated
  using (private.has_permission(organization_id, 'manage_tasks') and exists (select 1 from public.tasks k where k.id = task_id and k.organization_id = task_reminders.organization_id))
  with check (private.has_permission(organization_id, 'manage_tasks'));
grant select, insert, update on public.task_reminders to authenticated;

grant select on public.task_activities to authenticated;      -- history is written only by private.task_after_write()

-- ---------------------------------------------------------------------------------------------------------------------
-- Occurrence generation
-- ---------------------------------------------------------------------------------------------------------------------
-- Creates up to p_count upcoming occurrences of an active series (not past p_until). Idempotent: an existing day is skipped.
create or replace function private.generate_task_occurrences(p_series uuid, p_count integer default 6, p_until date default null) returns integer
language plpgsql set search_path = '' as $$
declare
  r public.task_recurrences;
  v_cursor date;
  v_next date;
  v_created integer := 0;
  v_id uuid;
  v_tpl jsonb;
  i integer;
begin
  select * into r from public.task_recurrences where id = p_series for update;
  if not found or r.status <> 'active' then return 0; end if;
  v_tpl := r.template;
  v_cursor := r.last_generated_date;
  for i in 1 .. least(greatest(p_count, 0), 24) loop
    v_next := private.next_task_occurrence(r, v_cursor);
    exit when v_next is null or (p_until is not null and v_next > p_until);
    insert into public.tasks (organization_id, title, description, category_id, priority, status, property_id, unit_id, tenant_id, lease_id, maintenance_request_id,
                              vendor_id, project_id, assignee_id, collaborator_ids, start_date, due_date, due_time, timezone, recurrence_id, occurrence_date, reminder_prefs, created_by)
    values (r.organization_id, coalesce(v_tpl ->> 'title', r.title), coalesce(v_tpl ->> 'description', ''), nullif(v_tpl ->> 'category_id', '')::uuid,
            coalesce(v_tpl ->> 'priority', 'normal'), 'not_started', nullif(v_tpl ->> 'property_id', '')::uuid, nullif(v_tpl ->> 'unit_id', '')::uuid,
            nullif(v_tpl ->> 'tenant_id', '')::uuid, nullif(v_tpl ->> 'lease_id', '')::uuid, nullif(v_tpl ->> 'maintenance_request_id', '')::uuid,
            nullif(v_tpl ->> 'vendor_id', '')::uuid, nullif(v_tpl ->> 'project_id', '')::uuid, nullif(v_tpl ->> 'assignee_id', '')::uuid,
            coalesce((select array_agg(x::uuid) from jsonb_array_elements_text(coalesce(v_tpl -> 'collaborator_ids', '[]'::jsonb)) x), '{}'),
            v_next, v_next, nullif(v_tpl ->> 'due_time', '')::time, coalesce(v_tpl ->> 'timezone', r.timezone), r.id, v_next,
            coalesce(v_tpl -> 'reminder_prefs', '{"enabled": true, "daysBefore": [1], "channels": ["in_app"]}'::jsonb), r.created_by)
    on conflict (recurrence_id, occurrence_date) do nothing
    returning id into v_id;
    if v_id is not null then
      v_created := v_created + 1;
      insert into public.task_checklist_items (organization_id, task_id, title, position)
        select r.organization_id, v_id, x.title, x.ord - 1 from jsonb_array_elements_text(coalesce(v_tpl -> 'checklist', '[]'::jsonb)) with ordinality x (title, ord);
    end if;
    v_id := null;
    v_cursor := v_next;
  end loop;
  update public.task_recurrences
     set last_generated_date = coalesce(v_cursor, last_generated_date),
         next_occurrence_date = private.next_task_occurrence(r, coalesce(v_cursor, last_generated_date))
   where id = r.id;
  return v_created;
end $$;

-- ---------------------------------------------------------------------------------------------------------------------
-- Public functions (called through PostgREST)
-- ---------------------------------------------------------------------------------------------------------------------
-- Creates a task (and its recurring series, checklist and first occurrences) in one transaction. Runs as the caller, so every RLS policy
-- and every rule above applies. p keys (all optional except title): title, description, category_id, priority, status, property_id, unit_id,
-- tenant_id, lease_id, maintenance_request_id, vendor_id, project_id, assignee_id, collaborator_ids[], start_date, due_date, due_time,
-- timezone, reminder {enabled, days_before[], channels[]}, checklist[], recurrence {frequency, interval, days_of_week[], month_day,
-- month_week, month_weekday, end_date, start_date, advance_reminder_days}.
create or replace function public.create_scheduled_task(p_org uuid, p jsonb) returns uuid
language plpgsql set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_title text := btrim(coalesce(p ->> 'title', ''));
  v_rec jsonb := p -> 'recurrence';
  v_series uuid;
  v_task uuid;
  v_due date := nullif(p ->> 'due_date', '')::date;
  v_tz text := coalesce(nullif(p ->> 'timezone', ''), 'America/Toronto');
  v_reminder jsonb;
  v_template jsonb;
  v_days jsonb;
  v_assignee uuid := coalesce(nullif(p ->> 'assignee_id', '')::uuid, v_uid);
  v_collab uuid[] := coalesce((select array_agg(x::uuid) from jsonb_array_elements_text(coalesce(p -> 'collaborator_ids', '[]'::jsonb)) x), '{}');
  r public.task_recurrences;
begin
  if v_uid is null then raise exception 'not signed in' using errcode = '42501'; end if;
  if v_title = '' then raise exception 'the task title is required' using errcode = '22023'; end if;
  if v_rec is null and v_due is null then raise exception 'a due date is required for one-time tasks' using errcode = '22023'; end if;
  if not private.has_permission(p_org, 'manage_tasks') then raise exception 'you do not have permission to create tasks' using errcode = '42501'; end if;

  v_days := coalesce(p -> 'reminder' -> 'days_before', '[1]'::jsonb);
  v_reminder := jsonb_build_object('enabled', coalesce((p -> 'reminder' ->> 'enabled')::boolean, true), 'daysBefore', v_days,
                                   'channels', coalesce(p -> 'reminder' -> 'channels', '["in_app"]'::jsonb));

  if v_rec is not null then
    if not private.has_permission(p_org, 'manage_task_series') then raise exception 'creating a recurring series needs the manage_task_series permission' using errcode = '42501'; end if;
    v_template := jsonb_strip_nulls(jsonb_build_object(
      'title', v_title, 'description', coalesce(p ->> 'description', ''), 'category_id', p ->> 'category_id', 'priority', coalesce(p ->> 'priority', 'normal'),
      'property_id', p ->> 'property_id', 'unit_id', p ->> 'unit_id', 'tenant_id', p ->> 'tenant_id', 'lease_id', p ->> 'lease_id',
      'maintenance_request_id', p ->> 'maintenance_request_id', 'vendor_id', p ->> 'vendor_id', 'project_id', p ->> 'project_id',
      'assignee_id', v_assignee, 'collaborator_ids', to_jsonb(v_collab), 'due_time', p ->> 'due_time', 'timezone', v_tz,
      'reminder_prefs', v_reminder, 'checklist', coalesce(p -> 'checklist', '[]'::jsonb)));
    insert into public.task_recurrences (organization_id, title, frequency, "interval", days_of_week, month_day, month_week, month_weekday, start_date, end_date,
                                         timezone, advance_reminder_days, template, created_by)
    values (p_org, v_title || ' (series)', coalesce(v_rec ->> 'frequency', 'weekly'), coalesce((v_rec ->> 'interval')::integer, 1),
            coalesce((select array_agg(x::smallint) from jsonb_array_elements_text(coalesce(v_rec -> 'days_of_week', '[]'::jsonb)) x), '{}'),
            nullif(v_rec ->> 'month_day', '')::integer, nullif(v_rec ->> 'month_week', '')::integer, nullif(v_rec ->> 'month_weekday', '')::integer,
            coalesce(nullif(v_rec ->> 'start_date', '')::date, v_due), nullif(v_rec ->> 'end_date', '')::date, v_tz,
            coalesce((v_rec ->> 'advance_reminder_days')::integer, 1), v_template, v_uid)
    returning id into v_series;
    select * into r from public.task_recurrences where id = v_series;
    v_due := coalesce(v_due, r.start_date);
  end if;

  insert into public.tasks (organization_id, title, description, category_id, priority, status, property_id, unit_id, tenant_id, lease_id, maintenance_request_id,
                            vendor_id, project_id, assignee_id, collaborator_ids, start_date, due_date, due_time, timezone, recurrence_id, occurrence_date, reminder_prefs)
  values (p_org, v_title, coalesce(p ->> 'description', ''), nullif(p ->> 'category_id', '')::uuid, coalesce(p ->> 'priority', 'normal'), coalesce(p ->> 'status', 'not_started'),
          nullif(p ->> 'property_id', '')::uuid, nullif(p ->> 'unit_id', '')::uuid, nullif(p ->> 'tenant_id', '')::uuid, nullif(p ->> 'lease_id', '')::uuid,
          nullif(p ->> 'maintenance_request_id', '')::uuid, nullif(p ->> 'vendor_id', '')::uuid, nullif(p ->> 'project_id', '')::uuid, v_assignee, v_collab,
          nullif(p ->> 'start_date', '')::date, v_due, nullif(p ->> 'due_time', '')::time, v_tz, v_series, case when v_series is not null then v_due end, v_reminder)
  returning id into v_task;

  insert into public.task_checklist_items (organization_id, task_id, title, position)
    select p_org, v_task, btrim(x.title), x.ord - 1 from jsonb_array_elements_text(coalesce(p -> 'checklist', '[]'::jsonb)) with ordinality x (title, ord)
     where btrim(x.title) <> '' and x.ord <= 50;

  if v_series is not null then
    update public.task_recurrences set last_generated_date = v_due where id = v_series;
    perform private.generate_task_occurrences(v_series, 5);
  end if;
  return v_task;
end $$;

-- pause / resume / cancel / generate for a recurring series
create or replace function public.set_task_series_status(p_series uuid, p_action text, p_count integer default 6) returns jsonb
language plpgsql set search_path = '' as $$
declare
  r public.task_recurrences;
  v_n integer := 0;
begin
  select * into r from public.task_recurrences where id = p_series;
  if not found then raise exception 'series not found' using errcode = 'P0002'; end if;
  if not private.has_permission(r.organization_id, 'manage_task_series') then raise exception 'you do not have permission to manage recurring series' using errcode = '42501'; end if;
  if p_action = 'pause' then
    update public.task_recurrences set status = 'paused' where id = p_series;
  elsif p_action = 'resume' then
    if r.status = 'cancelled' then raise exception 'a cancelled series cannot be resumed' using errcode = '22023'; end if;
    update public.task_recurrences set status = 'active', next_occurrence_date = private.next_task_occurrence(r, r.last_generated_date) where id = p_series;
  elsif p_action = 'generate' then
    v_n := private.generate_task_occurrences(p_series, p_count);
  elsif p_action = 'cancel' then
    update public.task_recurrences set status = 'cancelled' where id = p_series;
    update public.tasks set status = 'cancelled', cancel_reason = 'Series cancelled' where recurrence_id = p_series and organization_id = r.organization_id and status not in ('completed', 'cancelled');
    get diagnostics v_n = row_count;
  else
    raise exception 'unknown action %', p_action using errcode = '22023';
  end if;
  return jsonb_build_object('series_id', p_series, 'action', p_action, 'count', v_n, 'status', (select status from public.task_recurrences where id = p_series));
end $$;

-- Apply a change to this occurrence, this and later open occurrences, or every open occurrence of the series. Completed and cancelled
-- occurrences are never touched; the series template follows. Schedule fields (dates) are only ever changed on the single task.
create or replace function public.update_task_series_occurrences(p_task uuid, p_patch jsonb, p_scope text default 'single') returns jsonb
language plpgsql set search_path = '' as $$
declare
  t public.tasks;
  v_types constant jsonb := '{"title":"text","description":"text","category_id":"uuid","priority":"text","property_id":"uuid","unit_id":"uuid","tenant_id":"uuid","lease_id":"uuid","maintenance_request_id":"uuid","vendor_id":"uuid","project_id":"uuid","assignee_id":"uuid","due_time":"time"}';
  v_set text := '';
  k text;
  v_applied integer := 0;
  v_skipped integer := 0;
  v_scope_sql text;
begin
  select * into t from public.tasks where id = p_task;
  if not found then raise exception 'task not found' using errcode = 'P0002'; end if;
  if t.recurrence_id is null or p_scope = 'single' then raise exception 'use a normal update for single tasks' using errcode = '22023'; end if;
  if p_scope not in ('future', 'all') then raise exception 'scope must be single, future or all' using errcode = '22023'; end if;
  if not private.has_permission(t.organization_id, 'manage_task_series') then raise exception 'changing a whole series needs the manage_task_series permission' using errcode = '42501'; end if;
  for k in select key from jsonb_object_keys(p_patch) key loop
    if v_types ? k then
      v_set := v_set || format('%I = nullif(%L, '''')::%s, ', k, p_patch ->> k, v_types ->> k);
    end if;
  end loop;
  if v_set = '' then raise exception 'nothing to change' using errcode = '22023'; end if;
  v_scope_sql := case when p_scope = 'future' then format('and due_date >= %L', coalesce(t.due_date, current_date)) else '' end;
  execute format('update public.tasks set %s updated_at = now() where recurrence_id = %L and organization_id = %L and status not in (''completed'', ''cancelled'') %s',
                 v_set, t.recurrence_id, t.organization_id, v_scope_sql);
  get diagnostics v_applied = row_count;
  execute format('select count(*) from public.tasks where recurrence_id = %L and organization_id = %L and status in (''completed'', ''cancelled'') %s',
                 t.recurrence_id, t.organization_id, v_scope_sql) into v_skipped;
  update public.task_recurrences
     set template = template || (select coalesce(jsonb_object_agg(e.key, e.value), '{}'::jsonb) from jsonb_each(p_patch) e where v_types ? e.key)
   where id = t.recurrence_id;
  return jsonb_build_object('scope', p_scope, 'applied', v_applied, 'skipped', v_skipped);
end $$;

-- Housekeeping for one organization: generate the next 30 days of every active series, flag overdue tasks and deliver due in-app reminders.
-- Callable by members who manage series (so the screen can run it) and by workers (service role).
create or replace function public.process_task_schedule(p_org uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_worker boolean := coalesce((select auth.jwt()) ->> 'role', '') = 'service_role'
                      or ((select auth.uid()) is null and coalesce(current_setting('role', true), 'none') <> 'authenticated');
  s record;
  v_generated integer := 0;
  v_overdue integer := 0;
  v_reminders integer := 0;
begin
  if not v_worker and not private.has_permission(p_org, 'manage_task_series') then
    raise exception 'you do not have permission to run the task schedule' using errcode = '42501';
  end if;
  perform set_config('app.task_system', 'on', true);

  for s in select id from public.task_recurrences where organization_id = p_org and status = 'active' loop
    v_generated := v_generated + private.generate_task_occurrences(s.id, 12, current_date + 30);
  end loop;

  update public.tasks
     set overdue_notified_at = now()
   where organization_id = p_org and status not in ('completed', 'cancelled') and overdue_notified_at is null
     and due_date < (now() at time zone timezone)::date;
  get diagnostics v_overdue = row_count;

  update public.task_reminders r set status = 'cancelled'
   from public.tasks k
   where r.organization_id = p_org and r.status = 'scheduled' and k.id = r.task_id and k.organization_id = r.organization_id and k.status in ('completed', 'cancelled');

  with due as (
    select r.id, r.recipient_id, k.id as task_id, k.title, k.reference_number, k.due_date
      from public.task_reminders r join public.tasks k on k.id = r.task_id and k.organization_id = r.organization_id
     where r.organization_id = p_org and r.status = 'scheduled' and r.channel = 'in_app' and r.remind_at <= now() and r.recipient_id is not null
     for update of r skip locked
  ), note as (
    insert into public.notifications (organization_id, user_id, notification_type, title, body, entity_type, entity_id, dedupe_key)
      select p_org, d.recipient_id, 'task_reminder', 'Task reminder: ' || d.title,
             coalesce(d.reference_number, 'Task') || case when d.due_date is not null then ' is due ' || d.due_date::text else '' end, 'task', d.task_id, 'task-reminder:' || d.id
        from due d
      on conflict (organization_id, user_id, dedupe_key) do nothing
      returning 1
  ), mark as (
    update public.task_reminders r set status = 'sent', sent_at = now() from due d where r.id = d.id returning 1
  )
  select count(*) into v_reminders from mark;

  perform set_config('app.task_system', 'off', true);
  return jsonb_build_object('series_generated', v_generated, 'overdue_flagged', v_overdue, 'reminders_delivered', v_reminders);
end $$;

-- Worker entry point: every organization that has tasks. Service role only.
create or replace function public.process_all_task_schedules() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  o record;
  v_n integer := 0;
begin
  for o in select distinct organization_id from public.tasks union select distinct organization_id from public.task_recurrences loop
    perform public.process_task_schedule(o.organization_id);
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

-- ---------------------------------------------------------------------------------------------------------------------
-- Document Center: files can be attached to a task
-- ---------------------------------------------------------------------------------------------------------------------
alter table public.document_links drop constraint document_links_entity_type_check;
alter table public.document_links add constraint document_links_entity_type_check
  check (entity_type in ('property', 'unit', 'tenant', 'lease', 'application', 'application_party', 'vendor', 'maintenance_request', 'work_order', 'asset', 'project',
                         'project_task', 'invoice', 'payment', 'expense', 'bill', 'credit_note', 'bank_account', 'reconciliation', 'journal_entry', 'deposit',
                         'project_expense', 'project_invoice', 'task'));

create or replace function private.validate_document_link() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_table text;
  v_found boolean;
begin
  v_table := case new.entity_type
    when 'property' then 'properties' when 'unit' then 'units' when 'tenant' then 'tenants' when 'lease' then 'leases'
    when 'application' then 'applications' when 'application_party' then 'application_parties' when 'vendor' then 'vendors'
    when 'maintenance_request' then 'maintenance_requests' when 'work_order' then 'maintenance_work_orders' when 'asset' then 'assets'
    when 'project' then 'projects' when 'project_task' then 'project_tasks' when 'project_expense' then 'project_expenses'
    when 'project_invoice' then 'project_invoices' when 'invoice' then 'invoices' when 'payment' then 'payments'
    when 'expense' then 'expenses' when 'bill' then 'bills' when 'credit_note' then 'credit_notes' when 'bank_account' then 'bank_accounts'
    when 'reconciliation' then 'reconciliations' when 'journal_entry' then 'journal_entries' when 'deposit' then 'deposits'
    when 'task' then 'tasks' end;
  -- tables created in later migrations are resolved at run time; to_regclass tolerates an incompletely migrated database
  if to_regclass('public.' || v_table) is null then
    raise exception 'cannot link documents to % yet (table % is not installed)', new.entity_type, v_table using errcode = '55000';
  end if;
  execute format('select exists (select 1 from public.%I where organization_id = $1 and id = $2)', v_table)
    into v_found using new.organization_id, new.entity_id;
  if not v_found then
    raise exception 'linked % does not exist in this organization', new.entity_type using errcode = '23503';
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------------------------------------------------
revoke all on function public.create_scheduled_task(uuid, jsonb), public.set_task_series_status(uuid, text, integer), public.update_task_series_occurrences(uuid, jsonb, text),
                       public.process_task_schedule(uuid), public.process_all_task_schedules() from public, anon;
grant execute on function public.create_scheduled_task(uuid, jsonb), public.set_task_series_status(uuid, text, integer), public.update_task_series_occurrences(uuid, jsonb, text),
                          public.process_task_schedule(uuid) to authenticated, service_role;
grant execute on function public.process_all_task_schedules() to service_role;
grant execute on function private.generate_task_occurrences(uuid, integer, date), private.next_task_occurrence(public.task_recurrences, date),
                          private.task_series_matches(date, public.task_recurrences) to authenticated, service_role;

-- 017 created private.issue_receipt_on_post without the usual lock-down: nobody but the trigger needs it
revoke execute on function private.issue_receipt_on_post() from public, anon;
revoke execute on all routines in schema private from public, anon;

-- ---------------------------------------------------------------------------------------------------------------------
-- Documentation
-- ---------------------------------------------------------------------------------------------------------------------
comment on table public.task_categories  is 'Scheduled Tasks: categories per organization (11 system defaults are seeded for every organization; custom ones can be added).';
comment on table public.task_recurrences is 'Scheduled Tasks: recurring series. The template jsonb is copied onto every generated occurrence; occurrences are unique per series and day.';
comment on table public.tasks            is 'Scheduled Tasks: work assignments with due dates. Visibility: view_tasks, or assigned / created / collaborating. Completed or cancelled tasks are frozen until reopened.';
comment on table public.task_checklist_items is 'Scheduled Tasks: checklist steps of a task.';
comment on table public.task_comments    is 'Scheduled Tasks: comments on a task (append-only; authors can delete their own).';
comment on table public.task_attachments is 'Scheduled Tasks: files attached to a task. The file is a Document Center document; this row is the link and cached metadata.';
comment on table public.task_reminders   is 'Scheduled Tasks: reminders for a task. Only in_app reminders are delivered (as notifications by process_task_schedule); email and sms stay scheduled until a sender exists.';
comment on table public.task_activities  is 'Scheduled Tasks: append-only history of a task, written by the database triggers (created, status, reschedule, reassign, edits, overdue).';
comment on function public.create_scheduled_task(uuid, jsonb) is 'Creates a task (with checklist and, optionally, a recurring series and its first occurrences) in one transaction, as the caller.';
comment on function public.set_task_series_status(uuid, text, integer) is 'pause | resume | cancel | generate a recurring task series. Cancelling cancels open occurrences and keeps completed history.';
comment on function public.update_task_series_occurrences(uuid, jsonb, text) is 'Applies a change to this and future (or all) open occurrences of a series and updates the series template.';
comment on function public.process_task_schedule(uuid) is 'Generates the next 30 days of occurrences, flags overdue tasks and delivers due in-app reminders for one organization. Series managers and workers only.';
comment on function public.process_all_task_schedules() is 'Worker entry point: runs process_task_schedule for every organization that uses tasks. Service role only.';

commit;
