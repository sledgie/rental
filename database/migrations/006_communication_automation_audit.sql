-- =====================================================================================================================
-- 006_communication_automation_audit.sql
-- Message templates, delivery history, notification preferences, internal/external messaging (conversations, announcements),
-- in-app notifications, workflow automation (rules + executions), scheduled tasks (definitions + runs), domain-event outbox.
--
-- Scheduled tasks (time-driven jobs) and workflow automation (event-driven rules) are intentionally separate models.
-- Duplicate protection:
--   * scheduled_task_runs UNIQUE (task_id, scheduled_for)  -> a task occurrence can be started only once
--   * workflow_executions UNIQUE (rule_id, dedupe_key) + public.enqueue_workflow_execution() window check
--   * public.claim_due_scheduled_tasks() uses FOR UPDATE SKIP LOCKED so parallel workers never claim the same task
-- =====================================================================================================================
begin;
set local search_path = public, extensions;

-- ---------------------------------------------------------------------------------------------------------------------
-- Message templates (email / sms / in-app)
-- ---------------------------------------------------------------------------------------------------------------------
create table public.message_templates (
  id                     uuid primary key default gen_random_uuid(),
  organization_id        uuid not null references public.organizations (id) on delete cascade,
  name                   text not null check (btrim(name) <> ''),
  description            text,
  category               text not null default 'General',
  channel                text not null default 'email' check (channel in ('email', 'sms', 'in_app')),
  subject                text not null default '',
  body                   text not null default '',
  plain_text_body        text not null default '',
  sender_configuration   jsonb not null default '{}'::jsonb,     -- {fromName, fromEmail, replyTo, cc, bcc, signature}
  recipient_configuration jsonb not null default '{}'::jsonb,    -- {to, recipientRule}
  in_app_configuration   jsonb not null default '{}'::jsonb,     -- {title, actionLabel, destinationRoute}
  available_variables    text[] not null default '{}',
  required_variables     text[] not null default '{}',
  property_scope         text not null default 'company' check (property_scope in ('company', 'properties')),
  event_context          text not null default 'manual',
  status                 text not null default 'draft' check (status in ('active', 'draft', 'inactive')),
  language               text not null default 'en',
  internal_notes         text,
  legal_notice           boolean not null default false,
  jurisdiction           text,
  version                integer not null default 1 check (version >= 1),
  created_by             uuid references public.profiles (id) on delete set null,
  updated_by             uuid references public.profiles (id) on delete set null,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, name)
);
create index message_templates_idx on public.message_templates (organization_id, channel, status);
create table public.message_template_properties (
  organization_id uuid not null,
  template_id     uuid not null,
  property_id     uuid not null,
  primary key (template_id, property_id),
  foreign key (organization_id, template_id) references public.message_templates (organization_id, id) on delete cascade,
  foreign key (organization_id, property_id) references public.properties (organization_id, id) on delete cascade
);
create table public.message_template_attachments (
  organization_id uuid not null,
  template_id     uuid not null,
  document_id     uuid not null,
  primary key (template_id, document_id),
  foreign key (organization_id, template_id) references public.message_templates (organization_id, id) on delete cascade,
  foreign key (organization_id, document_id) references public.documents (organization_id, id) on delete cascade
);
create table public.message_template_versions (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  template_id     uuid not null,
  version         integer not null,
  snapshot        jsonb not null,
  changed_by      uuid references public.profiles (id) on delete set null,
  changed_at      timestamptz not null default now(),
  unique (template_id, version),
  foreign key (organization_id, template_id) references public.message_templates (organization_id, id) on delete cascade
);

-- Content changes bump the version; every version is kept so a log can always say which wording was sent.
create or replace function private.message_template_versioning() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    if (new.subject, new.body, new.plain_text_body, new.sender_configuration, new.in_app_configuration, new.channel)
       is distinct from (old.subject, old.body, old.plain_text_body, old.sender_configuration, old.in_app_configuration, old.channel) then
      new.version := old.version + 1;
    else
      new.version := old.version;
    end if;
    new.updated_by := coalesce(new.updated_by, (select auth.uid()));
    return new;
  end if;
  new.created_by := coalesce(new.created_by, (select auth.uid()));
  new.updated_by := coalesce(new.updated_by, new.created_by);
  return new;
end $$;
create trigger message_templates_versioning before insert or update on public.message_templates for each row execute function private.message_template_versioning();

create or replace function private.message_template_snapshot() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' or new.version is distinct from old.version then
    insert into public.message_template_versions (organization_id, template_id, version, snapshot, changed_by)
    values (new.organization_id, new.id, new.version, to_jsonb(new), (select auth.uid()))
    on conflict (template_id, version) do nothing;
  end if;
  return null;
end $$;
create trigger message_templates_snapshot after insert or update on public.message_templates for each row execute function private.message_template_snapshot();

-- ---------------------------------------------------------------------------------------------------------------------
-- Workflow automation (event-driven rules)
-- ---------------------------------------------------------------------------------------------------------------------
create table public.automation_rules (
  id                       uuid primary key default gen_random_uuid(),
  organization_id          uuid not null references public.organizations (id) on delete cascade,
  name                     text not null check (btrim(name) <> ''),
  description              text,
  event_type               text not null,
  template_id              uuid,
  channel                  text not null default 'email' check (channel in ('email', 'sms', 'in_app')),
  recipient_type           text not null default 'tenant',
  custom_recipients        text,
  property_scope           text not null default 'company' check (property_scope in ('company', 'properties')),
  delay_amount             integer not null default 0 check (delay_amount >= 0),
  delay_unit               text not null default 'days' check (delay_unit in ('minutes', 'hours', 'days')),
  business_days_only       boolean not null default false,
  send_time                time,
  cancel_on                text,
  timezone                 text not null default 'America/Toronto',
  duplicate_prevention_key text not null default '{{event_type}}:{{entity_id}}',
  dedupe_enabled           boolean not null default true,
  dedupe_window_hours      integer not null default 24 check (dedupe_window_hours >= 0),
  retry_max_attempts       integer not null default 3 check (retry_max_attempts between 0 and 20),
  retry_backoff_minutes    integer not null default 15 check (retry_backoff_minutes >= 0),
  status                   text not null default 'inactive' check (status in ('active', 'inactive')),
  execution_mode           text not null default 'configured' check (execution_mode in ('configured', 'simulated', 'live')),
  created_by               uuid references public.profiles (id) on delete set null,
  updated_by               uuid references public.profiles (id) on delete set null,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, template_id) references public.message_templates (organization_id, id) on delete set null (template_id)
);
create index automation_rules_event_idx on public.automation_rules (organization_id, event_type) where status = 'active';
create table public.automation_rule_conditions (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  rule_id         uuid not null,
  position        integer not null default 0,
  field           text not null,
  operator        text not null check (operator in ('equals', 'not_equals', 'greater_than', 'less_than', 'greater_or_equal', 'less_or_equal', 'contains', 'in', 'is_true', 'is_false')),
  value           text,
  foreign key (organization_id, rule_id) references public.automation_rules (organization_id, id) on delete cascade
);
create index automation_rule_conditions_idx on public.automation_rule_conditions (organization_id, rule_id, position);
create table public.automation_rule_properties (
  organization_id uuid not null,
  rule_id         uuid not null,
  property_id     uuid not null,
  primary key (rule_id, property_id),
  foreign key (organization_id, rule_id) references public.automation_rules (organization_id, id) on delete cascade,
  foreign key (organization_id, property_id) references public.properties (organization_id, id) on delete cascade
);

-- An active rule needs an ACTIVE template on the same channel (the rule the UI enforces, now enforced in the database too).
create or replace function private.check_automation_rule_activation() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_t public.message_templates%rowtype;
begin
  new.updated_by := coalesce((select auth.uid()), new.updated_by);
  if new.status = 'active' then
    select * into v_t from public.message_templates where organization_id = new.organization_id and id = new.template_id;
    if not found then raise exception 'An active rule needs a template' using errcode = '23514'; end if;
    if v_t.status <> 'active' then raise exception 'The rule''s template must be active' using errcode = '23514'; end if;
    if v_t.channel <> new.channel then raise exception 'The rule channel (%) must match the template channel (%)', new.channel, v_t.channel using errcode = '23514'; end if;
  end if;
  return new;
end $$;
create trigger automation_rules_activation before insert or update on public.automation_rules for each row execute function private.check_automation_rule_activation();

-- ---------------------------------------------------------------------------------------------------------------------
-- Delivery history and notification preferences
-- ---------------------------------------------------------------------------------------------------------------------
create table public.communication_logs (
  id                   uuid primary key default gen_random_uuid(),
  organization_id      uuid not null,
  template_id          uuid,
  template_version     integer,
  automation_rule_id   uuid,
  recipient_name       text,
  recipient_email      text,
  recipient_phone      text,
  related_entity_type  text,
  related_entity_id    text,
  property_id          uuid,
  unit_id              uuid,
  tenant_id            uuid,
  rendered_subject     text not null default '',
  rendered_body        text not null default '',
  channel              text not null check (channel in ('email', 'sms', 'in_app')),
  category             text,
  status               text not null default 'queued' check (status in ('draft', 'queued', 'sending', 'sent', 'delivered', 'opened', 'bounced', 'failed', 'cancelled')),
  trigger_source       text not null default 'manual' check (trigger_source in ('manual', 'test', 'automation')),
  attempt_count        integer not null default 0 check (attempt_count >= 0),
  provider_message_id  text,
  provider_response    jsonb,
  queued_at            timestamptz,
  sent_at              timestamptz,
  delivered_at         timestamptz,
  opened_at            timestamptz,
  failed_at            timestamptz,
  cancelled_at         timestamptz,
  error_details        jsonb,
  is_mock              boolean not null default false,
  initiated_by         uuid references public.profiles (id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, template_id) references public.message_templates (organization_id, id) on delete set null (template_id),
  foreign key (organization_id, automation_rule_id) references public.automation_rules (organization_id, id) on delete set null (automation_rule_id),
  foreign key (organization_id, property_id) references public.properties (organization_id, id) on delete set null (property_id),
  foreign key (organization_id, unit_id) references public.units (organization_id, id) on delete set null (unit_id),
  foreign key (organization_id, tenant_id) references public.tenants (organization_id, id) on delete set null (tenant_id)
);
create index communication_logs_idx        on public.communication_logs (organization_id, created_at desc);
create index communication_logs_status_idx on public.communication_logs (organization_id, status, created_at desc);
create index communication_logs_tenant_idx on public.communication_logs (organization_id, tenant_id, created_at desc) where tenant_id is not null;
create table public.communication_log_attempts (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  log_id          uuid not null,
  attempted_at    timestamptz not null default now(),
  status          text not null,
  detail          text,
  foreign key (organization_id, log_id) references public.communication_logs (organization_id, id) on delete cascade
);
create index communication_log_attempts_idx on public.communication_log_attempts (organization_id, log_id, attempted_at);

create table public.tenant_communication_preferences (
  organization_id uuid not null,
  tenant_id       uuid primary key,
  email_enabled   boolean not null default true,
  sms_enabled     boolean not null default false,
  in_app_enabled  boolean not null default true,
  consent         text not null default 'not_required' check (consent in ('granted', 'withdrawn', 'not_required')),
  marketing_opt_out boolean not null default false,
  updated_at      timestamptz not null default now(),
  foreign key (organization_id, tenant_id) references public.tenants (organization_id, id) on delete cascade
);
create table public.property_notification_settings (
  organization_id uuid not null,
  property_id     uuid primary key,
  enabled         boolean not null default true,
  sender_email    text,
  quiet_start     time,
  quiet_end       time,
  timezone        text,
  foreign key (organization_id, property_id) references public.properties (organization_id, id) on delete cascade
);

-- ---------------------------------------------------------------------------------------------------------------------
-- Messaging: conversations, messages, announcements, notifications
-- ---------------------------------------------------------------------------------------------------------------------
create table public.conversations (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references public.organizations (id) on delete cascade,
  subject             text not null check (btrim(subject) <> ''),
  category            text not null default 'General Inquiry'
                        check (category in ('General Inquiry', 'Maintenance', 'Lease and Renewal', 'Rent and Payments', 'Invoice and Charges', 'Deposit and Refund',
                                            'Inspection', 'Property Announcement', 'Complaint', 'Document Request', 'Vendor Coordination', 'Internal Discussion', 'Other')),
  priority            text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  status              text not null default 'open' check (status in ('open', 'in_progress', 'waiting_for_reply', 'resolved', 'closed', 'archived')),
  visibility          text not null default 'external' check (visibility in ('external', 'internal_only')),
  primary_channel     text not null default 'email' check (primary_channel in ('email', 'sms', 'whatsapp', 'in_app')),
  assigned_to         uuid references public.profiles (id) on delete set null,
  assigned_at         timestamptz,
  assigned_by         uuid references public.profiles (id) on delete set null,
  assignment_notes    text,
  related_entity_type text check (related_entity_type in ('property', 'unit', 'tenant', 'lease', 'maintenance', 'invoice', 'payment', 'deposit', 'inspection', 'vendor', 'other')),
  related_entity_id   uuid,
  related_entity_ref  text,
  tags                text[] not null default '{}',
  created_by          uuid references public.profiles (id) on delete set null,
  archived_at         timestamptz,
  resolved_at         timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (organization_id, id)
);
create index conversations_status_idx   on public.conversations (organization_id, status, updated_at desc);
create index conversations_assigned_idx on public.conversations (organization_id, assigned_to, status) where assigned_to is not null;

-- A participant (or sender) is exactly one of: staff member, tenant, vendor, owner.
create table public.conversation_participants (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null,
  conversation_id   uuid not null,
  participant_type  text not null check (participant_type in ('staff', 'tenant', 'vendor', 'owner')),
  user_id           uuid references public.profiles (id) on delete cascade,
  tenant_id         uuid,
  vendor_id         uuid,
  owner_id          uuid,
  participant_role  text,
  joined_at         timestamptz not null default now(),
  last_read_at      timestamptz,
  check (num_nonnulls(user_id, tenant_id, vendor_id, owner_id) = 1),
  check ((participant_type = 'staff') = (user_id is not null)
         and (participant_type = 'tenant') = (tenant_id is not null)
         and (participant_type = 'vendor') = (vendor_id is not null)
         and (participant_type = 'owner') = (owner_id is not null)),
  unique (organization_id, id),
  foreign key (organization_id, conversation_id) references public.conversations (organization_id, id) on delete cascade,
  foreign key (organization_id, tenant_id) references public.tenants (organization_id, id) on delete cascade,
  foreign key (organization_id, vendor_id) references public.vendors (organization_id, id) on delete cascade,
  foreign key (organization_id, owner_id) references public.owners (organization_id, id) on delete cascade
);
create unique index conversation_participants_unique on public.conversation_participants
  (conversation_id, coalesce(user_id, tenant_id, vendor_id, owner_id));
create index conversation_participants_user_idx on public.conversation_participants (organization_id, user_id) where user_id is not null;

create table public.messages (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null,
  conversation_id    uuid not null,
  sender_type        text not null check (sender_type in ('staff', 'tenant', 'vendor', 'owner', 'system')),
  sender_user_id     uuid references public.profiles (id) on delete set null,
  sender_tenant_id   uuid,
  sender_vendor_id   uuid,
  sender_owner_id    uuid,
  body               text not null,
  channel            text not null default 'email' check (channel in ('email', 'sms', 'whatsapp', 'in_app')),
  delivery_status    text not null default 'draft' check (delivery_status in ('draft', 'simulated_sent', 'simulated_delivered', 'simulated_read', 'sent', 'delivered', 'read', 'failed')),
  is_internal_note   boolean not null default false,
  reply_to_message_id uuid,
  edited_at          timestamptz,
  created_at         timestamptz not null default now(),
  unique (organization_id, id),
  check (num_nonnulls(sender_user_id, sender_tenant_id, sender_vendor_id, sender_owner_id) <= 1),
  foreign key (organization_id, conversation_id) references public.conversations (organization_id, id) on delete cascade,
  foreign key (organization_id, sender_tenant_id) references public.tenants (organization_id, id) on delete set null (sender_tenant_id),
  foreign key (organization_id, sender_vendor_id) references public.vendors (organization_id, id) on delete set null (sender_vendor_id),
  foreign key (organization_id, sender_owner_id) references public.owners (organization_id, id) on delete set null (sender_owner_id),
  foreign key (organization_id, reply_to_message_id) references public.messages (organization_id, id) on delete set null (reply_to_message_id)
);
create index messages_conversation_idx on public.messages (organization_id, conversation_id, created_at);
create table public.message_attachments (
  organization_id uuid not null,
  message_id      uuid not null,
  document_id     uuid not null,
  primary key (message_id, document_id),
  foreign key (organization_id, message_id) references public.messages (organization_id, id) on delete cascade,
  foreign key (organization_id, document_id) references public.documents (organization_id, id) on delete cascade
);
create table public.conversation_stars (
  organization_id uuid not null,
  conversation_id uuid not null,
  user_id         uuid not null references public.profiles (id) on delete cascade,
  starred_at      timestamptz not null default now(),
  primary key (conversation_id, user_id),
  foreign key (organization_id, conversation_id) references public.conversations (organization_id, id) on delete cascade
);
create table public.conversation_events (                       -- append-only history of a conversation
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  conversation_id uuid not null,
  event_type      text not null check (event_type in ('conversation_created', 'message_sent', 'internal_note_added', 'status_changed', 'priority_changed',
                                                      'category_changed', 'assigned', 'reassigned', 'participant_added', 'archived', 'reopened', 'record_linked')),
  actor_id        uuid references public.profiles (id) on delete set null,
  old_value       text,
  new_value       text,
  notes           text,
  created_at      timestamptz not null default now(),
  foreign key (organization_id, conversation_id) references public.conversations (organization_id, id) on delete cascade
);
create index conversation_events_idx on public.conversation_events (organization_id, conversation_id, created_at);
create or replace function private.append_only() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' and not exists (select 1 from public.organizations o where o.id = old.organization_id) then return old; end if;
  if tg_op = 'DELETE' and tg_table_name = 'conversation_events' and not exists (select 1 from public.conversations c where c.id = old.conversation_id) then return old; end if;
  raise exception '% is append-only', tg_table_name using errcode = '42501';
end $$;
create trigger conversation_events_append_only before update or delete on public.conversation_events for each row execute function private.append_only();

create table public.announcements (
  id                       uuid primary key default gen_random_uuid(),
  organization_id          uuid not null references public.organizations (id) on delete cascade,
  title                    text not null,
  body                     text not null,
  category                 text not null default 'Property Announcement',
  target_audience          text not null default 'all_tenants' check (target_audience in ('all_tenants', 'property_tenants', 'unit_tenants', 'owners', 'staff', 'vendors')),
  priority                 text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  acknowledgement_required boolean not null default false,
  status                   text not null default 'draft' check (status in ('draft', 'scheduled', 'published', 'expired', 'cancelled')),
  channels                 text[] not null default '{email}',
  scheduled_at             timestamptz,
  published_at             timestamptz,
  expires_at               timestamptz,
  created_by               uuid references public.profiles (id) on delete set null,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  unique (organization_id, id),
  check (status <> 'scheduled' or scheduled_at is not null),
  check (expires_at is null or published_at is null or expires_at > published_at)
);
create table public.announcement_targets (
  organization_id uuid not null,
  announcement_id uuid not null,
  property_id     uuid not null,
  unit_id         uuid,
  foreign key (organization_id, announcement_id) references public.announcements (organization_id, id) on delete cascade,
  foreign key (organization_id, property_id) references public.properties (organization_id, id) on delete cascade,
  foreign key (organization_id, unit_id) references public.units (organization_id, id) on delete cascade
);
create unique index announcement_targets_unique on public.announcement_targets (announcement_id, property_id, coalesce(unit_id, '00000000-0000-0000-0000-000000000000'::uuid));
create table public.announcement_acknowledgements (
  organization_id uuid not null,
  announcement_id uuid not null,
  user_id         uuid references public.profiles (id) on delete cascade,
  tenant_id       uuid,
  acknowledged_at timestamptz not null default now(),
  check (num_nonnulls(user_id, tenant_id) = 1),
  foreign key (organization_id, announcement_id) references public.announcements (organization_id, id) on delete cascade,
  foreign key (organization_id, tenant_id) references public.tenants (organization_id, id) on delete cascade
);
create unique index announcement_ack_unique on public.announcement_acknowledgements (announcement_id, coalesce(user_id, tenant_id));

create table public.notifications (                              -- in-app notifications for staff users
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id         uuid not null references public.profiles (id) on delete cascade,
  notification_type text not null,                                 -- message, assignment, urgent, announcement, status_change, rent_overdue, lease_expiring ...
  title           text not null,
  body            text,
  entity_type     text,
  entity_id       uuid,
  conversation_id uuid,
  dedupe_key      text,
  read_at         timestamptz,
  created_at      timestamptz not null default now(),
  unique (organization_id, user_id, dedupe_key),
  foreign key (organization_id, conversation_id) references public.conversations (organization_id, id) on delete cascade
);
create index notifications_user_idx on public.notifications (user_id, created_at desc) where read_at is null;

-- ---------------------------------------------------------------------------------------------------------------------
-- Workflow executions + outbox
-- ---------------------------------------------------------------------------------------------------------------------
create table public.domain_events (                              -- transactional outbox: written with the business change, consumed by workers
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  event_type      text not null,
  entity_type     text,
  entity_id       uuid,
  payload         jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  processed_at    timestamptz,
  unique (organization_id, id)
);
create index domain_events_pending_idx on public.domain_events (created_at) where processed_at is null;
create index domain_events_org_idx on public.domain_events (organization_id, event_type, created_at desc);

create table public.workflow_executions (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null,
  rule_id               uuid not null,
  event_id              uuid,
  event_type            text not null,
  entity_type           text,
  entity_id             uuid,
  dedupe_key            text not null,
  status                text not null default 'scheduled' check (status in ('scheduled', 'running', 'sent', 'skipped', 'failed', 'cancelled')),
  scheduled_for         timestamptz not null default now(),
  attempts              integer not null default 0 check (attempts >= 0),
  next_attempt_at       timestamptz,
  last_error            text,
  communication_log_id  uuid,
  locked_by             text,
  locked_until          timestamptz,
  created_at            timestamptz not null default now(),
  finished_at           timestamptz,
  unique (organization_id, id),
  unique (rule_id, dedupe_key),
  foreign key (organization_id, rule_id) references public.automation_rules (organization_id, id) on delete cascade,
  foreign key (organization_id, event_id) references public.domain_events (organization_id, id) on delete set null (event_id),
  foreign key (organization_id, communication_log_id) references public.communication_logs (organization_id, id) on delete set null (communication_log_id)
);
create index workflow_executions_due_idx on public.workflow_executions (scheduled_for) where status in ('scheduled', 'failed');
create index workflow_executions_rule_idx on public.workflow_executions (organization_id, rule_id, created_at desc);

-- Queue one execution for a rule, honouring the rule's duplicate-prevention window. Returns NULL when it is a duplicate.
create or replace function public.enqueue_workflow_execution(
  p_org uuid, p_rule uuid, p_entity_type text, p_entity_id uuid, p_scheduled_for timestamptz default now(), p_event uuid default null
) returns uuid
language plpgsql set search_path = public, extensions as $$
declare
  v_rule public.automation_rules%rowtype;
  v_key text;
  v_id uuid;
begin
  select * into v_rule from public.automation_rules where organization_id = p_org and id = p_rule;
  if not found then raise exception 'rule not found' using errcode = 'P0002'; end if;
  if v_rule.status <> 'active' then return null; end if;
  v_key := replace(replace(v_rule.duplicate_prevention_key, '{{event_type}}', v_rule.event_type), '{{entity_id}}', coalesce(p_entity_id::text, ''));
  perform pg_advisory_xact_lock(hashtextextended(p_rule::text || v_key, 31));
  if v_rule.dedupe_enabled and exists (
       select 1 from public.workflow_executions w
        where w.rule_id = p_rule and w.dedupe_key = v_key and w.status <> 'cancelled'
          and w.created_at > now() - make_interval(hours => v_rule.dedupe_window_hours)) then
    return null;
  end if;
  insert into public.workflow_executions (organization_id, rule_id, event_id, event_type, entity_type, entity_id, dedupe_key, scheduled_for)
  values (p_org, p_rule, p_event, v_rule.event_type, p_entity_type, p_entity_id,
          case when v_rule.dedupe_enabled and v_rule.dedupe_window_hours > 0 then v_key else v_key || '#' || gen_random_uuid()::text end, p_scheduled_for)
  on conflict (rule_id, dedupe_key) do nothing
  returning id into v_id;
  return v_id;
end $$;

-- ---------------------------------------------------------------------------------------------------------------------
-- Scheduled tasks (time-driven)
-- ---------------------------------------------------------------------------------------------------------------------
create table public.scheduled_tasks (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  name             text not null check (btrim(name) <> ''),
  description      text,
  task_type        text not null check (task_type in ('rent_invoice_generation', 'bill_schedule_posting', 'lease_expiry_check', 'document_expiry_scan', 'overdue_invoice_check',
                                                       'preventive_maintenance', 'deposit_interest_accrual', 'report_generation', 'data_retention', 'custom')),
  schedule_type    text not null check (schedule_type in ('interval', 'daily', 'weekly', 'monthly', 'cron')),
  interval_minutes integer check (interval_minutes is null or interval_minutes >= 1),
  run_time         time,
  days_of_week     smallint[],
  day_of_month     smallint check (day_of_month is null or day_of_month between 1 and 31),
  cron_expression  text,
  timezone         text not null default 'America/Toronto',
  parameters       jsonb not null default '{}'::jsonb check (jsonb_typeof(parameters) = 'object'),
  enabled          boolean not null default true,
  next_run_at      timestamptz,
  last_run_at      timestamptz,
  last_status      text check (last_status in ('succeeded', 'failed', 'skipped')),
  created_by       uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, name),
  check ((schedule_type = 'interval') = (interval_minutes is not null)),
  check (schedule_type <> 'cron' or cron_expression is not null)
);
create index scheduled_tasks_due_idx on public.scheduled_tasks (next_run_at) where enabled;

create table public.scheduled_task_runs (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  task_id         uuid not null,
  scheduled_for   timestamptz not null,
  status          text not null default 'queued' check (status in ('queued', 'running', 'succeeded', 'failed', 'skipped', 'cancelled')),
  attempt         integer not null default 1 check (attempt >= 1),
  started_at      timestamptz,
  finished_at     timestamptz,
  locked_by       text,
  locked_until    timestamptz,
  result          jsonb,
  error           text,
  created_at      timestamptz not null default now(),
  unique (task_id, scheduled_for),                                -- duplicate execution protection
  unique (organization_id, id),
  foreign key (organization_id, task_id) references public.scheduled_tasks (organization_id, id) on delete cascade
);
create index scheduled_task_runs_task_idx on public.scheduled_task_runs (organization_id, task_id, scheduled_for desc);
create index scheduled_task_runs_lock_idx on public.scheduled_task_runs (locked_until) where status = 'running';

-- Next occurrence for the simple schedule types. Cron schedules are advanced by the worker via complete_scheduled_task_run().
create or replace function private.next_task_run(p_type text, p_from timestamptz, p_interval int, p_tz text) returns timestamptz
language sql immutable set search_path = '' as $$
  select case p_type
    when 'interval' then p_from + make_interval(mins => p_interval)
    when 'daily'    then ((p_from at time zone p_tz) + interval '1 day') at time zone p_tz
    when 'weekly'   then ((p_from at time zone p_tz) + interval '7 days') at time zone p_tz
    when 'monthly'  then ((p_from at time zone p_tz) + interval '1 month') at time zone p_tz
    else null end;
$$;

-- Workers (service role) claim due tasks. FOR UPDATE SKIP LOCKED + the unique run key make double execution impossible.
create or replace function public.claim_due_scheduled_tasks(p_worker text, p_limit integer default 10, p_lock_seconds integer default 300)
returns setof public.scheduled_task_runs
language plpgsql security definer set search_path = '' as $$
begin
  return query
  with due as (
    select t.id, t.organization_id, t.next_run_at as due_at, t.schedule_type, t.interval_minutes, t.timezone
      from public.scheduled_tasks t
     where t.enabled and t.next_run_at <= now()
     order by t.next_run_at
     for update skip locked
     limit greatest(p_limit, 0)),
  claimed as (
    insert into public.scheduled_task_runs (organization_id, task_id, scheduled_for, status, started_at, locked_by, locked_until)
    select d.organization_id, d.id, d.due_at, 'running', now(), p_worker, now() + make_interval(secs => p_lock_seconds) from due d
    on conflict (task_id, scheduled_for) do nothing
    returning *),
  advanced as (
    update public.scheduled_tasks t
       set last_run_at = now(),
           next_run_at = private.next_task_run(d.schedule_type, d.due_at, d.interval_minutes, d.timezone)
      from due d where t.id = d.id and d.schedule_type <> 'cron'
    returning t.id)
  select c.* from claimed c;
end $$;

create or replace function public.complete_scheduled_task_run(
  p_run uuid, p_status text, p_result jsonb default null, p_error text default null, p_next_run_at timestamptz default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_task uuid;
begin
  if p_status not in ('succeeded', 'failed', 'skipped') then raise exception 'invalid status' using errcode = '22023'; end if;
  update public.scheduled_task_runs
     set status = p_status, finished_at = now(), result = p_result, error = p_error, locked_until = null
   where id = p_run and status = 'running'
  returning task_id into v_task;
  if v_task is null then raise exception 'run % is not running', p_run using errcode = 'P0002'; end if;
  update public.scheduled_tasks set last_status = p_status, next_run_at = coalesce(p_next_run_at, next_run_at) where id = v_task;
end $$;

-- Re-queue runs whose worker disappeared (lock expired) so another worker can finish them.
create or replace function public.reclaim_stale_task_runs() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_count integer;
begin
  update public.scheduled_task_runs set status = 'failed', error = 'worker lock expired', finished_at = now(), locked_until = null
   where status = 'running' and locked_until < now();
  get diagnostics v_count = row_count;
  return v_count;
end $$;
revoke all on function public.claim_due_scheduled_tasks(text, integer, integer), public.complete_scheduled_task_run(uuid, text, jsonb, text, timestamptz),
                       public.reclaim_stale_task_runs() from public, anon, authenticated;
grant execute on function public.claim_due_scheduled_tasks(text, integer, integer), public.complete_scheduled_task_run(uuid, text, jsonb, text, timestamptz),
                          public.reclaim_stale_task_runs() to service_role;

-- ---------------------------------------------------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['message_templates', 'automation_rules', 'communication_logs', 'conversations', 'announcements', 'scheduled_tasks'] loop
    execute format('create trigger %I before update on public.%I for each row execute function private.set_updated_at()', t || '_updated_at', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------------------------------------------------
-- Row-Level Security
-- ---------------------------------------------------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['message_templates', 'message_template_properties', 'message_template_attachments', 'automation_rules', 'automation_rule_conditions',
                            'automation_rule_properties', 'communication_logs', 'communication_log_attempts', 'tenant_communication_preferences',
                            'property_notification_settings', 'announcements', 'announcement_targets', 'scheduled_tasks'] loop
    execute format('call private.apply_org_policies(%L, %L, %L)', 'public.' || t, 'view_communications', 'manage_communications');
  end loop;
end $$;
call private.apply_org_policies('public.message_template_versions', 'view_communications', null, 'none');
call private.apply_org_policies('public.workflow_executions',       'view_communications', null, 'none');   -- written by workers (service role)
call private.apply_org_policies('public.scheduled_task_runs',       'view_communications', null, 'none');
call private.apply_org_policies('public.domain_events',             'view_audit_log',      null, 'none');
call private.apply_org_policies('public.announcement_acknowledgements', 'view_communications', 'view_communications', 'none');  -- acknowledging = any staff member
drop policy if exists org_update on public.announcement_acknowledgements;

-- Conversations: staff see conversations they take part in or are assigned to, plus everyone with manage_communications (inboxes).
-- Internal-only conversations are never visible to people without a staff participation.
alter table public.conversations              enable row level security;
alter table public.conversation_participants  enable row level security;
alter table public.messages                   enable row level security;
alter table public.message_attachments        enable row level security;
alter table public.conversation_stars         enable row level security;
alter table public.conversation_events        enable row level security;

create or replace function private.can_see_conversation(p_org uuid, p_conversation uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.has_permission(p_org, 'view_communications') and (
    private.has_permission(p_org, 'manage_communications')
    or exists (select 1 from public.conversations c where c.id = p_conversation and c.organization_id = p_org and c.assigned_to = (select auth.uid()))
    or exists (select 1 from public.conversation_participants p where p.conversation_id = p_conversation and p.organization_id = p_org and p.user_id = (select auth.uid())));
$$;
revoke all on function private.can_see_conversation(uuid, uuid) from public, anon;
grant execute on function private.can_see_conversation(uuid, uuid) to authenticated, service_role;

create policy conversations_select on public.conversations for select to authenticated using (private.can_see_conversation(organization_id, id));
create policy conversations_insert on public.conversations for insert to authenticated
  with check (private.has_permission(organization_id, 'manage_communications') and created_by = (select auth.uid()));
create policy conversations_update on public.conversations for update to authenticated
  using (private.can_see_conversation(organization_id, id) and private.has_permission(organization_id, 'manage_communications'))
  with check (private.has_permission(organization_id, 'manage_communications'));
create policy conversations_delete on public.conversations for delete to authenticated using (private.has_permission(organization_id, 'manage_communications'));

create policy conversation_participants_select on public.conversation_participants for select to authenticated using (private.can_see_conversation(organization_id, conversation_id));
create policy conversation_participants_write on public.conversation_participants for all to authenticated
  using (private.has_permission(organization_id, 'manage_communications')) with check (private.has_permission(organization_id, 'manage_communications'));
create policy messages_select on public.messages for select to authenticated using (private.can_see_conversation(organization_id, conversation_id));
create policy messages_insert on public.messages for insert to authenticated
  with check (private.can_see_conversation(organization_id, conversation_id) and private.has_permission(organization_id, 'manage_communications')
              and sender_type = 'staff' and sender_user_id = (select auth.uid()));
create policy messages_update on public.messages for update to authenticated
  using (sender_user_id = (select auth.uid()) and private.can_see_conversation(organization_id, conversation_id))
  with check (sender_user_id = (select auth.uid()));
create policy message_attachments_select on public.message_attachments for select to authenticated
  using (exists (select 1 from public.messages m where m.organization_id = message_attachments.organization_id and m.id = message_attachments.message_id));
create policy message_attachments_write on public.message_attachments for all to authenticated
  using (private.has_permission(organization_id, 'manage_communications')) with check (private.has_permission(organization_id, 'manage_communications'));
create policy conversation_stars_own on public.conversation_stars for all to authenticated
  using (user_id = (select auth.uid()) and private.is_org_member(organization_id)) with check (user_id = (select auth.uid()) and private.is_org_member(organization_id));
create policy conversation_events_select on public.conversation_events for select to authenticated using (private.can_see_conversation(organization_id, conversation_id));
create policy conversation_events_insert on public.conversation_events for insert to authenticated
  with check (private.has_permission(organization_id, 'manage_communications') and actor_id = (select auth.uid()));

-- Notifications belong to one user.
alter table public.notifications enable row level security;
create policy notifications_select on public.notifications for select to authenticated using (user_id = (select auth.uid()) and private.is_org_member(organization_id));
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and private.is_org_member(organization_id));
create policy notifications_delete on public.notifications for delete to authenticated using (user_id = (select auth.uid()));

revoke all on public.conversations, public.conversation_participants, public.messages, public.message_attachments, public.conversation_stars,
              public.conversation_events, public.notifications from anon;
grant select, insert, update, delete on public.conversations, public.conversation_participants, public.message_attachments, public.conversation_stars to authenticated;
grant select, insert, update on public.messages to authenticated;
grant select, insert on public.conversation_events to authenticated;
grant select, update, delete on public.notifications to authenticated;

commit;
