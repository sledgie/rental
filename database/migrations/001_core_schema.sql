-- =====================================================================================================================
-- 001_core_schema.sql
-- Core identity, organization, membership, permission-catalog, settings and audit tables for Supabase (PostgreSQL 15+).
--
-- Conventions used by every migration in this folder
--   * Supabase Auth owns identities: public.profiles.id = auth.users.id. No passwords or tokens are stored here.
--   * Every organization-owned table has organization_id NOT NULL and UNIQUE (organization_id, id). Child tables reference their
--     parents with COMPOSITE foreign keys (organization_id, parent_id) so a row can never point at another organization's record.
--   * Money is numeric(14,2) in the organization (or record) currency. The web app mixes integer cents and decimals; the data
--     access layer converts (see database/data_dictionary.md).
--   * "Enumerations" are text columns with CHECK constraints (easy to extend in later migrations). Values are lower snake_case;
--     the UI labels they map to are listed in database/requirements_mapping.md.
--   * Helper and trigger functions live in the non-exposed schema "private". Only deliberate RPC entry points live in "public".
-- Rollback: this migration only creates objects. database/installation_guide.md lists the reverse order (DROP in reverse).
-- =====================================================================================================================
begin;

create schema if not exists extensions;
create extension if not exists btree_gist with schema extensions;   -- exclusion constraints on date ranges (lease occupancy)
create schema if not exists private;
revoke all on schema private from public;
-- Functions created later in schema private are not executable by PUBLIC/anon unless a migration grants them explicitly.
alter default privileges in schema private revoke execute on routines from public, anon;

set local search_path = public, extensions;

-- ---------------------------------------------------------------------------------------------------------------------
-- Generic helpers
-- ---------------------------------------------------------------------------------------------------------------------
create or replace function private.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- Atomic per-organization counters (invoice numbers, lease numbers, journal entry numbers ...).
create table public.organization_counters (
  organization_id uuid not null,
  counter_key     text not null,
  last_value      bigint not null default 0 check (last_value >= 0),
  primary key (organization_id, counter_key)
);

-- ---------------------------------------------------------------------------------------------------------------------
-- Profiles and personal preferences (identity itself lives in auth.users)
-- ---------------------------------------------------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text,
  full_name   text not null default '',
  phone       text,
  job_title   text,
  avatar_path text,                                  -- Storage object path in bucket "organization-assets" (avatars/<user id>/...)
  status      text not null default 'active' check (status in ('active', 'deactivated')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger profiles_updated_at before update on public.profiles for each row execute function private.set_updated_at();
create index profiles_email_idx on public.profiles (lower(email));

-- ---------------------------------------------------------------------------------------------------------------------
-- Organizations
-- ---------------------------------------------------------------------------------------------------------------------
create table public.organizations (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null check (char_length(btrim(name)) between 2 and 60),
  legal_name            text,
  business_type         text not null default 'individual_landlord'
                          check (business_type in ('individual_landlord', 'property_management_company', 'real_estate_business', 'other')),
  registration_number   text,
  country               text not null default 'Canada',
  currency              char(3) not null default 'CAD' check (currency ~ '^[A-Z]{3}$'),
  timezone              text not null default 'America/Toronto',
  plan                  text not null default 'starter' check (plan in ('starter', 'growth', 'scale')),
  status                text not null default 'active' check (status in ('active', 'inactive')),
  fiscal_year_start_month smallint not null default 1 check (fiscal_year_start_month between 1 and 12),
  books_closed_through  date,                          -- accounting period lock: no postings dated on/before this date
  email                 text,
  phone                 text,
  website               text,
  address_line1         text,
  address_line2         text,
  city                  text,
  state_province        text,
  postal_code           text,
  logo_path             text,                          -- Storage path in bucket "organization-assets"
  created_by            uuid references public.profiles (id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create trigger organizations_updated_at before update on public.organizations for each row execute function private.set_updated_at();
alter table public.organization_counters
  add constraint organization_counters_org_fk foreign key (organization_id) references public.organizations (id) on delete cascade;

-- A user may belong to several organizations, with a different role in each.
create table public.organization_members (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id         uuid not null references public.profiles (id) on delete cascade,
  role            text not null check (role in ('owner', 'administrator', 'property_manager', 'accountant', 'maintenance_staff', 'read_only')),
  status          text not null default 'active' check (status in ('active', 'suspended')),
  invited_by      uuid references public.profiles (id) on delete set null,
  joined_at       timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, user_id),
  unique (organization_id, id)
);
create index organization_members_user_idx on public.organization_members (user_id) where status = 'active';
create trigger organization_members_updated_at before update on public.organization_members for each row execute function private.set_updated_at();

create table public.organization_invitations (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  email           text not null check (email = lower(btrim(email)) and email like '%_@_%'),
  role            text not null check (role in ('administrator', 'property_manager', 'accountant', 'maintenance_staff', 'read_only')),
  status          text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'expired', 'revoked')),
  token_hash      text unique,                         -- SHA-256 of the emailed token; the raw token is never stored
  invited_by      uuid references public.profiles (id) on delete set null,
  accepted_by     uuid references public.profiles (id) on delete set null,
  expires_at      timestamptz not null default (now() + interval '14 days'),
  responded_at    timestamptz,
  resend_count    integer not null default 0 check (resend_count >= 0),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, id)
);
create unique index organization_invitations_one_pending on public.organization_invitations (organization_id, email) where status = 'pending';
create index organization_invitations_email_idx on public.organization_invitations (email) where status = 'pending';
create trigger organization_invitations_updated_at before update on public.organization_invitations for each row execute function private.set_updated_at();

-- Personal preferences (settings -> Personal preferences). active_organization_id is the "currently selected workspace".
create table public.user_preferences (
  user_id                uuid primary key references public.profiles (id) on delete cascade,
  active_organization_id uuid references public.organizations (id) on delete set null,
  theme                  text not null default 'dark' check (theme in ('dark', 'light', 'blue')),
  landing_page           text not null default 'Dashboard overview',
  language               text not null default 'English (United States)',
  table_density          text not null default 'Comfortable' check (table_density in ('Compact', 'Comfortable', 'Spacious')),
  notifications          jsonb not null default '{"email": true, "desktop": true, "weeklyDigest": true, "productUpdates": false}'::jsonb,
  widgets                jsonb not null default '{"occupancy": true, "rentCollection": true, "maintenance": true, "renewals": true}'::jsonb,
  reduce_motion          boolean not null default false,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create trigger user_preferences_updated_at before update on public.user_preferences for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------------------------------------------------
-- Permission catalog. Roles are fixed (six); what each role may do is data. Organizations can override the defaults
-- (Settings -> Security -> permission matrix) without touching global rows. The owner role can never be restricted.
-- ---------------------------------------------------------------------------------------------------------------------
create table public.permissions (
  key         text primary key,
  area        text not null,
  label       text not null,
  description text
);

create table public.role_permissions (
  role       text not null check (role in ('owner', 'administrator', 'property_manager', 'accountant', 'maintenance_staff', 'read_only')),
  permission text not null references public.permissions (key) on delete cascade,
  primary key (role, permission)
);

create table public.organization_role_permissions (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  role            text not null check (role in ('administrator', 'property_manager', 'accountant', 'maintenance_staff', 'read_only')),
  permission      text not null references public.permissions (key) on delete cascade,
  granted         boolean not null,
  updated_by      uuid references public.profiles (id) on delete set null,
  updated_at      timestamptz not null default now(),
  primary key (organization_id, role, permission)
);

-- ---------------------------------------------------------------------------------------------------------------------
-- Organization settings: one JSON document per category (general, financial, property, maintenance, projects, notifications,
-- tasks, workflow, documents, security, data, bank_reconciliation, deposits). Validated shape lives in the application.
-- ---------------------------------------------------------------------------------------------------------------------
create table public.organization_settings (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  category        text not null check (category in ('general', 'financial', 'property', 'maintenance', 'projects', 'notifications',
                                                    'tasks', 'workflow', 'documents', 'security', 'data', 'bank_reconciliation', 'deposits')),
  value           jsonb not null default '{}'::jsonb check (jsonb_typeof(value) = 'object'),
  updated_by      uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  primary key (organization_id, category)
);
create trigger organization_settings_updated_at before update on public.organization_settings for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------------------------------------------------
-- Activity / audit trail (append-only, hash-chained per organization). Used by Activity Logs, the organization activity tab,
-- payment/refund audit, deposit audit, signature audit and member management.
-- ---------------------------------------------------------------------------------------------------------------------
create table public.activity_events (
  id                   uuid primary key default gen_random_uuid(),
  organization_id      uuid not null references public.organizations (id) on delete cascade,
  occurred_at          timestamptz not null default now(),
  recorded_at          timestamptz not null default now(),
  actor_id             uuid references public.profiles (id) on delete set null,
  actor_type           text not null default 'user' check (actor_type in ('user', 'system', 'scheduled_job', 'integration')),
  actor_display_name   text not null,
  action               text not null check (action ~ '^[a-z_]+\.[a-z_]+$'),
  category             text not null check (category in ('Properties & Units', 'Tenants & Leases', 'Accounting & Finance', 'Maintenance & Repairs',
                                                          'Projects & Renovations', 'Documents & eSignatures', 'Communications', 'Users & Security')),
  description          text not null,
  entity_type          text not null,
  entity_id            text not null,                  -- text: ids of any table (uuid) or external references
  related_record_label text not null default '',
  property_id          uuid,                           -- denormalized filter dimensions; deliberately no FK so history survives deletions
  unit_id              uuid,
  tenant_id            uuid,
  changes              jsonb not null default '[]'::jsonb check (jsonb_typeof(changes) = 'array'),
  outcome              text not null default 'success' check (outcome in ('success', 'failure', 'denied', 'pending')),
  severity             text not null default 'informational' check (severity in ('informational', 'warning', 'critical')),
  source_module        text not null default '',
  correlation_id       text not null default '',
  reason               text,
  metadata             jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  error                jsonb,
  sensitive_digest     text,                           -- SHA-256 of the restricted detail row (activity_event_details), so tampering with it is detectable
  chain_seq            bigint not null default 0,      -- position in the organization's hash chain (assigned under lock by the trigger)
  previous_hash        text not null,
  event_hash           text not null unique,
  unique (organization_id, id),
  unique (organization_id, chain_seq)
);
create index activity_events_org_time_idx    on public.activity_events (organization_id, occurred_at desc, id desc);
create index activity_events_entity_idx      on public.activity_events (organization_id, entity_type, entity_id, occurred_at desc);
create index activity_events_actor_idx       on public.activity_events (organization_id, actor_id, occurred_at desc);
create index activity_events_category_idx    on public.activity_events (organization_id, category, occurred_at desc);
create index activity_events_property_idx    on public.activity_events (organization_id, property_id, occurred_at desc) where property_id is not null;
create index activity_events_failed_idx      on public.activity_events (organization_id, occurred_at desc) where outcome in ('failure', 'denied');
create index activity_events_correlation_idx on public.activity_events (organization_id, correlation_id) where correlation_id <> '';

-- Restricted part of an event (client IP, user agent, request ids, before/after values flagged "restricted"). Visible only to members
-- who may both read the audit log and see sensitive data; everyone else sees the event without it.
create table public.activity_event_details (
  organization_id uuid not null,
  event_id        uuid primary key,
  sensitive       jsonb not null default '{}'::jsonb check (jsonb_typeof(sensitive) = 'object'),
  foreign key (organization_id, event_id) references public.activity_events (organization_id, id) on delete cascade
);

create table public.audit_policies (
  organization_id   uuid primary key references public.organizations (id) on delete cascade,
  retention_days    integer not null default 2555 check (retention_days between 365 and 36500),
  archive_after_days integer not null default 365 check (archive_after_days >= 30),
  updated_by        uuid references public.profiles (id) on delete set null,
  updated_at        timestamptz not null default now()
);

create table public.audit_exports (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations (id) on delete cascade,
  activity_event_id uuid,
  actor_id          uuid references public.profiles (id) on delete set null,
  file_name         text not null,
  filters           jsonb not null default '{}'::jsonb,
  row_count         integer not null check (row_count >= 0),
  outcome           text not null default 'success' check (outcome in ('success', 'failure')),
  created_at        timestamptz not null default now(),
  foreign key (organization_id, activity_event_id) references public.activity_events (organization_id, id)
);
create index audit_exports_org_idx on public.audit_exports (organization_id, created_at desc);

-- Hash chain: each event stores the SHA-256 of its canonical content plus the previous event's hash (per organization).
-- Canonical hash of an event (also used by public.verify_activity_chain to re-check the chain).
create or replace function private.activity_event_hash(e public.activity_events) returns text
language sql immutable set search_path = '' as $$
  select encode(sha256(convert_to(
    jsonb_build_object('id', e.id, 'org', e.organization_id, 'occurredAt', extract(epoch from e.occurred_at)::text, 'recordedAt', extract(epoch from e.recorded_at)::text,
                       'actor', e.actor_id, 'actorType', e.actor_type, 'action', e.action, 'category', e.category,
                       'description', e.description, 'entityType', e.entity_type, 'entityId', e.entity_id,
                       'changes', e.changes, 'outcome', e.outcome, 'severity', e.severity, 'metadata', e.metadata,
                       'seq', e.chain_seq, 'sensitive', e.sensitive_digest, 'previousHash', e.previous_hash)::text, 'UTF8')), 'hex');
$$;

-- An advisory transaction lock serialises appends to one organization so two concurrent inserts cannot fork the chain.
create or replace function private.activity_events_chain() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_prev text;
  v_seq  bigint;
begin
  perform pg_advisory_xact_lock(hashtextextended(new.organization_id::text, 7241));
  select e.event_hash, e.chain_seq into v_prev, v_seq
    from public.activity_events e
   where e.organization_id = new.organization_id
   order by e.chain_seq desc
   limit 1;
  new.recorded_at    := clock_timestamp();
  new.chain_seq      := coalesce(v_seq, 0) + 1;
  new.previous_hash  := coalesce(v_prev, repeat('0', 64));
  new.event_hash     := private.activity_event_hash(new);
  return new;
end $$;
create trigger activity_events_chain before insert on public.activity_events for each row execute function private.activity_events_chain();

-- Deleting is only possible inside the controlled purge path (retention job / organization closure), which sets app.audit_purge.
create or replace function private.activity_events_immutable() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' and coalesce(current_setting('app.audit_purge', true), '') = 'on' then
    return old;
  end if;
  raise exception 'activity_events is append-only (% blocked)', tg_op using errcode = '42501';
end $$;
create trigger activity_events_no_update before update or delete on public.activity_events for each row execute function private.activity_events_immutable();
create trigger activity_events_no_truncate before truncate on public.activity_events for each statement execute function private.activity_events_immutable();

commit;
