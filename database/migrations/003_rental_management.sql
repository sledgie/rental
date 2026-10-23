-- =====================================================================================================================
-- 003_rental_management.sql
-- Portfolio and people: owners, properties, units, tenants, vendors, documents (+versions, links, e-signatures),
-- rental applications, leases (multi-unit, multi-party), renewals.
--
-- Source modules: Properties / Add property, Units, Tenants, Applications, Leases, Document Center, vendors/contractors,
-- e-signature fields on leases and applications.
-- =====================================================================================================================
begin;
set local search_path = public, extensions;

-- Generic "assign a human readable number when none is supplied" trigger. TG_ARGV: column, counter key, prefix, width.
create or replace function private.assign_number() returns trigger
language plpgsql as $$
declare
  v_col text := tg_argv[0];
  v_current text := to_jsonb(new) ->> v_col;
begin
  if v_current is null or v_current = '' then
    new := jsonb_populate_record(new, jsonb_build_object(
      v_col, tg_argv[2] || lpad(private.next_number(new.organization_id, tg_argv[1])::text, tg_argv[3]::int, '0')));
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------------------------------------------------------
-- Owners, management companies, properties, units
-- ---------------------------------------------------------------------------------------------------------------------
create table public.owners (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name            text not null check (btrim(name) <> ''),
  owner_type      text not null default 'individual' check (owner_type in ('individual', 'organization')),
  email           text,
  phone           text,
  notes           text,
  archived_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, id)
);
create table public.management_companies (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name            text not null check (btrim(name) <> ''),
  email           text,
  phone           text,
  notes           text,
  archived_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, id)
);

create table public.properties (
  id                        uuid primary key default gen_random_uuid(),
  organization_id           uuid not null references public.organizations (id) on delete cascade,
  code                      text,
  name                      text not null check (btrim(name) <> ''),
  property_type             text not null default 'other'
                              check (property_type in ('detached_house', 'semi_detached_house', 'townhouse', 'condominium', 'multi_unit_residential',
                                                       'apartment_building', 'commercial', 'mixed_use', 'other')),
  status                    text not null default 'active' check (status in ('active', 'inactive', 'under_renovation', 'sold')),
  is_draft                  boolean not null default false,
  description               text,
  cover_image_path          text,                       -- bucket property-images
  date_acquired             date,
  -- address
  country                   text not null default 'Canada',
  address_line1             text not null,
  address_line2             text,
  city                      text not null,
  state_province            text,
  postal_code               text,
  timezone                  text,
  -- configuration
  building_type             text,
  year_built                smallint check (year_built is null or year_built between 1600 and 2200),
  total_building_area       numeric(12,2) check (total_building_area is null or total_building_area >= 0),
  area_unit                 text not null default 'sqft' check (area_unit in ('sqft', 'sqm')),
  lot_size                  numeric(14,2) check (lot_size is null or lot_size >= 0),
  lot_size_unit             text check (lot_size_unit in ('sqft', 'sqm', 'acres', 'hectares')),
  parking_spaces            integer check (parking_spaces is null or parking_spaces >= 0),
  amenities                 text[] not null default '{}',
  furnishing_status         text check (furnishing_status in ('furnished', 'unfurnished', 'mixed', 'not_applicable')),
  general_features          text,
  bedrooms                  numeric(3,1),
  bathrooms                 numeric(3,1),
  parking_details           text,
  -- ownership & management
  ownership_type            text check (ownership_type in ('individual', 'joint', 'corporation', 'other')),
  property_manager_id       uuid references public.profiles (id) on delete set null,
  management_company_id     uuid,
  management_start_date     date,
  emergency_contact_name    text,
  emergency_contact_phone   text,
  -- financial
  purchase_price            numeric(14,2) check (purchase_price is null or purchase_price >= 0),
  purchase_date             date,
  estimated_value           numeric(14,2) check (estimated_value is null or estimated_value >= 0),
  property_tax_amount       numeric(14,2) check (property_tax_amount is null or property_tax_amount >= 0),
  property_tax_frequency    text check (property_tax_frequency in ('monthly', 'quarterly', 'annually', 'other')),
  insurance_provider        text,
  insurance_policy_expiry   date,
  mortgage_lender           text,
  mortgage_reference        text,
  default_currency          char(3) check (default_currency is null or default_currency ~ '^[A-Z]{3}$'),
  default_expense_category_id uuid,                    -- FK added in 004 (expense_categories)
  -- utilities
  electricity_provider      text,
  electricity_account_ref   text,
  water_sewer_provider      text,
  gas_provider              text,
  internet_provider         text,
  waste_provider            text,
  heating_type              text,
  water_heating_type        text,
  utility_responsibility    text check (utility_responsibility in ('owner', 'tenant', 'shared', 'not_applicable')),
  -- maintenance defaults and inspections
  default_maintenance_contact text,
  maintenance_instructions  text,
  last_inspection_date      date,
  next_inspection_date      date,
  warranty_expiry_date      date,
  access_instructions       text,
  notes                     text,
  archived_at               timestamptz,
  created_by                uuid references public.profiles (id) on delete set null,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, management_company_id) references public.management_companies (organization_id, id) on delete set null (management_company_id)
);
create unique index properties_org_code_key on public.properties (organization_id, code) where code is not null;
create index properties_org_status_idx on public.properties (organization_id, status) where archived_at is null;
create index properties_org_name_idx on public.properties (organization_id, lower(name));

create table public.property_owners (
  id                   uuid primary key default gen_random_uuid(),
  organization_id      uuid not null,
  property_id          uuid not null,
  owner_id             uuid not null,
  ownership_percentage numeric(5,2) not null default 100 check (ownership_percentage > 0 and ownership_percentage <= 100),
  created_at           timestamptz not null default now(),
  unique (property_id, owner_id),
  foreign key (organization_id, property_id) references public.properties (organization_id, id) on delete cascade,
  foreign key (organization_id, owner_id) references public.owners (organization_id, id) on delete restrict
);
create index property_owners_owner_idx on public.property_owners (organization_id, owner_id);

-- Shares of one property can never exceed 100 %.
create or replace function private.check_property_owner_shares() returns trigger
language plpgsql as $$
begin
  if (select coalesce(sum(ownership_percentage), 0) from public.property_owners where property_id = new.property_id) > 100.0001 then
    raise exception 'Ownership percentages for a property cannot exceed 100%%' using errcode = '23514';
  end if;
  return null;
end $$;
create constraint trigger property_owners_share_total after insert or update on public.property_owners
  deferrable initially deferred for each row execute function private.check_property_owner_shares();

create table public.units (
  id                          uuid primary key default gen_random_uuid(),
  organization_id             uuid not null,
  property_id                 uuid not null,
  unit_number                 text not null check (btrim(unit_number) <> ''),
  unit_type                   text,
  unit_status                 text not null default 'vacant'
                                check (unit_status in ('occupied', 'vacant', 'reserved', 'notice', 'under_maintenance', 'renovation', 'turnover', 'unavailable')),
  unit_condition              text check (unit_condition in ('excellent', 'good', 'fair', 'needs_work')),
  bedrooms                    numeric(3,1) check (bedrooms is null or bedrooms >= 0),
  bathrooms                   numeric(3,1) check (bathrooms is null or bathrooms >= 0),
  square_feet                 integer check (square_feet is null or square_feet > 0),
  floor                       text,
  furnished                   text check (furnished in ('furnished', 'partially_furnished', 'unfurnished')),
  parking_details             text,
  parking_spaces              integer check (parking_spaces is null or parking_spaces >= 0),
  parking_fee                 numeric(10,2) check (parking_fee is null or parking_fee >= 0),
  storage_details             text,
  pet_policy                  text,
  appliances                  text[] not null default '{}',
  utilities_included          text[] not null default '{}',
  accessibility_features      text[] not null default '{}',
  year_renovated              smallint,
  advertised_rent             numeric(12,2) check (advertised_rent is null or advertised_rent >= 0),
  market_rent                 numeric(12,2) check (market_rent is null or market_rent >= 0),
  deposit_amount              numeric(12,2) check (deposit_amount is null or deposit_amount >= 0),
  available_on                date,
  last_inspection_date        date,
  next_inspection_date        date,
  inspector                   text,
  allow_multiple_active_leases boolean not null default false,
  notes                       text,
  archived_at                 timestamptz,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, property_id, unit_number),
  foreign key (organization_id, property_id) references public.properties (organization_id, id) on delete restrict
);
create index units_property_idx on public.units (organization_id, property_id, unit_status) where archived_at is null;
create index units_available_idx on public.units (organization_id, available_on) where unit_status = 'vacant';

-- ---------------------------------------------------------------------------------------------------------------------
-- Vendors / contractors / service providers (maintenance, projects, expenses, utility bills)
-- ---------------------------------------------------------------------------------------------------------------------
create table public.vendors (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references public.organizations (id) on delete cascade,
  vendor_type         text not null default 'vendor' check (vendor_type in ('vendor', 'contractor', 'service_provider')),
  company_name        text not null check (btrim(company_name) <> ''),
  contact_name        text,
  phone               text,
  email               text,
  website             text,
  address             text,
  trade               text,
  categories          text[] not null default '{}',
  license_number      text,
  insurance_provider  text,
  insurance_expiry    date,
  wsib_number         text,
  wsib_expiry         date,
  pricing_model       text check (pricing_model in ('fixed_price', 'hourly', 'daily', 'cost_plus')),
  agreed_rate         text,
  payment_terms       text,
  rating              numeric(2,1) check (rating is null or rating between 0 and 5),
  notes               text,
  is_active           boolean not null default true,
  archived_at         timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (organization_id, id)
);
create index vendors_org_name_idx on public.vendors (organization_id, lower(company_name));
create table public.vendor_private_details (               -- tax identifiers: visible only with view_sensitive
  organization_id uuid not null,
  vendor_id       uuid primary key,
  tax_id          text,
  updated_at      timestamptz not null default now(),
  foreign key (organization_id, vendor_id) references public.vendors (organization_id, id) on delete cascade
);
create table public.vendor_workers (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  vendor_id       uuid not null,
  name            text not null,
  role            text,
  phone           text,
  foreign key (organization_id, vendor_id) references public.vendors (organization_id, id) on delete cascade
);
create index vendor_workers_vendor_idx on public.vendor_workers (organization_id, vendor_id);
create table public.property_preferred_vendors (
  organization_id uuid not null,
  property_id     uuid not null,
  vendor_id       uuid not null,
  primary key (property_id, vendor_id),
  foreign key (organization_id, property_id) references public.properties (organization_id, id) on delete cascade,
  foreign key (organization_id, vendor_id) references public.vendors (organization_id, id) on delete cascade
);

-- ---------------------------------------------------------------------------------------------------------------------
-- Tenants (people). Prospects and applicants are tenants with status 'prospect'/'applicant'.
-- ---------------------------------------------------------------------------------------------------------------------
create table public.tenants (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  tenant_number    text,
  first_name       text not null check (btrim(first_name) <> ''),
  middle_name      text,
  last_name        text not null default '',
  preferred_name   text,
  photo_path       text,                                 -- Storage path in bucket tenant-identification (<org id>/photos/<tenant id>/...)
  email            text,
  phone            text,
  mailing_address  text,
  occupation       text,
  classification   text not null default 'individual' check (classification in ('main_tenant', 'individual')),
  status           text not null default 'active' check (status in ('prospect', 'applicant', 'pending', 'active', 'inactive', 'former')),
  notes            text,
  archived_at      timestamptz,
  created_by       uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, tenant_number)
);
create trigger tenants_number before insert on public.tenants for each row execute function private.assign_number('tenant_number', 'tenant', 'TEN-', '4');
create index tenants_org_name_idx on public.tenants (organization_id, lower(last_name), lower(first_name));
create index tenants_org_status_idx on public.tenants (organization_id, status) where archived_at is null;
create index tenants_org_email_idx on public.tenants (organization_id, lower(email)) where email is not null;

create table public.tenant_private_details (            -- personal data beyond contact details: visible only with view_sensitive
  organization_id uuid not null,
  tenant_id       uuid primary key,
  date_of_birth   date check (date_of_birth is null or date_of_birth < current_date),
  updated_at      timestamptz not null default now(),
  foreign key (organization_id, tenant_id) references public.tenants (organization_id, id) on delete cascade
);
create table public.tenant_contacts (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  tenant_id       uuid not null,
  contact_type    text not null default 'emergency' check (contact_type in ('emergency', 'alternate', 'guarantor', 'employer', 'other')),
  name            text not null,
  relationship    text,
  phone           text,
  email           text,
  address         text,
  is_primary      boolean not null default false,
  created_at      timestamptz not null default now(),
  foreign key (organization_id, tenant_id) references public.tenants (organization_id, id) on delete cascade
);
create index tenant_contacts_tenant_idx on public.tenant_contacts (organization_id, tenant_id);

-- ---------------------------------------------------------------------------------------------------------------------
-- Documents, versions, links to business records, e-signature
-- ---------------------------------------------------------------------------------------------------------------------
create table public.documents (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references public.organizations (id) on delete cascade,
  name                text not null check (btrim(name) <> ''),
  document_type       text not null default 'Supporting document',
  category            text not null default 'General',
  origin_module       text not null default 'Manual Upload',
  creation_method     text not null default 'manual_upload' check (creation_method in ('system_generated', 'manual_upload', 'imported')),
  description         text,
  tags                text[] not null default '{}',
  status              text not null default 'active' check (status in ('active', 'archived', 'draft', 'awaiting_signature', 'signed', 'superseded', 'expired')),
  signature_status    text not null default 'not_required' check (signature_status in ('not_required', 'pending', 'signed', 'declined')),
  review_status       text check (review_status in ('received', 'under_review', 'accepted', 'needs_replacement')),
  visibility          text not null default 'internal' check (visibility in ('internal', 'team', 'restricted')),
  document_date       date,
  expiry_date         date,
  retention_until     date,
  is_sensitive        boolean not null default false,      -- identity documents, signed leases ...: needs view_sensitive
  current_version_id  uuid,
  uploaded_by         uuid references public.profiles (id) on delete set null,
  archived_at         timestamptz,
  deleted_at          timestamptz,                         -- soft delete (retention rules)
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (organization_id, id)
);
create index documents_org_status_idx on public.documents (organization_id, status, created_at desc) where deleted_at is null;
create index documents_org_expiry_idx on public.documents (organization_id, expiry_date) where expiry_date is not null and deleted_at is null;
create index documents_org_type_idx on public.documents (organization_id, document_type);
create index documents_tags_idx on public.documents using gin (tags);

create table public.document_versions (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  document_id     uuid not null,
  version_number  integer not null check (version_number >= 1),
  storage_bucket  text not null,
  storage_path    text not null,                           -- <organization_id>/... ; the object itself lives in Supabase Storage
  file_name       text not null,
  mime_type       text,
  size_bytes      bigint check (size_bytes is null or size_bytes >= 0),
  sha256          text check (sha256 is null or sha256 ~ '^[0-9a-f]{64}$'),
  page_count      integer,
  is_immutable    boolean not null default false,          -- true for signed versions and certificates
  is_certificate  boolean not null default false,
  notes           text,
  uploaded_by     uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  unique (organization_id, id),
  unique (document_id, version_number),
  unique (storage_bucket, storage_path),
  check (split_part(storage_path, '/', 1) = organization_id::text),
  foreign key (organization_id, document_id) references public.documents (organization_id, id) on delete cascade
);
alter table public.documents
  add constraint documents_current_version_fk foreign key (organization_id, current_version_id)
  references public.document_versions (organization_id, id) deferrable initially deferred;

create or replace function private.protect_immutable_version() returns trigger
language plpgsql as $$
begin
  if old.is_immutable then
    if tg_op = 'DELETE' and not exists (select 1 from public.documents d where d.id = old.document_id) then
      return old;                                          -- the whole document is being removed
    end if;
    raise exception 'Signed document versions are immutable' using errcode = '42501';
  end if;
  return coalesce(new, old);
end $$;
create trigger document_versions_immutable before update or delete on public.document_versions
  for each row execute function private.protect_immutable_version();

-- Links a document to the business records it belongs to. entity_id is polymorphic, so a trigger verifies that the target row
-- exists IN THE SAME ORGANIZATION (whitelisted table names only).
create table public.document_links (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  document_id     uuid not null,
  entity_type     text not null check (entity_type in ('property', 'unit', 'tenant', 'lease', 'application', 'application_party', 'vendor',
                                                        'maintenance_request', 'work_order', 'asset', 'project', 'project_task', 'invoice',
                                                        'payment', 'expense', 'bill', 'credit_note', 'bank_account', 'reconciliation',
                                                        'journal_entry', 'deposit', 'project_expense', 'project_invoice')),
  entity_id       uuid not null,
  entity_label    text,
  relationship_type text,
  is_primary      boolean not null default false,
  stage           text check (stage in ('before', 'during', 'after')),
  created_at      timestamptz not null default now(),
  unique (document_id, entity_type, entity_id),
  foreign key (organization_id, document_id) references public.documents (organization_id, id) on delete cascade
);
create index document_links_entity_idx on public.document_links (organization_id, entity_type, entity_id);

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
    when 'reconciliation' then 'reconciliations' when 'journal_entry' then 'journal_entries' when 'deposit' then 'deposits' end;
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
create trigger document_links_validate before insert or update of entity_type, entity_id on public.document_links
  for each row execute function private.validate_document_link();

-- Tenant identification: metadata only; the scan itself is a (sensitive) document in the tenant-identification bucket.
create table public.tenant_id_documents (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null,
  tenant_id           uuid not null,
  document_id         uuid not null unique,
  id_type             text not null check (id_type in ('drivers_license', 'passport', 'government_id', 'other')),
  expires_on          date,
  verification_status text not null default 'unverified' check (verification_status in ('unverified', 'verified', 'rejected')),
  verified_by         uuid references public.profiles (id) on delete set null,
  verified_at         timestamptz,
  created_at          timestamptz not null default now(),
  foreign key (organization_id, tenant_id) references public.tenants (organization_id, id) on delete cascade,
  foreign key (organization_id, document_id) references public.documents (organization_id, id) on delete cascade
);
create index tenant_id_documents_tenant_idx on public.tenant_id_documents (organization_id, tenant_id);
create index tenant_id_documents_expiry_idx on public.tenant_id_documents (organization_id, expires_on) where expires_on is not null;

-- E-signature -----------------------------------------------------------------------------------------------------------
create table public.signature_requests (
  id                      uuid primary key default gen_random_uuid(),
  organization_id         uuid not null,
  document_id             uuid not null,
  source_version_id       uuid not null,
  source_sha256           text check (source_sha256 is null or source_sha256 ~ '^[0-9a-f]{64}$'),   -- hash-locked at send time
  lease_id                uuid,
  tenant_id               uuid,
  title                   text not null,
  message                 text,
  status                  text not null default 'draft'
                            check (status in ('draft', 'fields_added', 'ready_to_send', 'sent', 'viewed', 'partially_signed', 'completed', 'declined', 'voided', 'expired')),
  signing_order_enforced  boolean not null default true,
  expires_at              timestamptz,
  completed_at            timestamptz,
  completed_version_id    uuid,
  certificate_version_id  uuid,
  created_by              uuid not null references public.profiles (id),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, document_id) references public.documents (organization_id, id) on delete restrict,
  foreign key (organization_id, source_version_id) references public.document_versions (organization_id, id) on delete restrict,
  foreign key (organization_id, completed_version_id) references public.document_versions (organization_id, id) on delete restrict,
  foreign key (organization_id, certificate_version_id) references public.document_versions (organization_id, id) on delete restrict,
  foreign key (organization_id, tenant_id) references public.tenants (organization_id, id) on delete set null (tenant_id)
);
create index signature_requests_status_idx on public.signature_requests (organization_id, status);

create table public.signers (
  id                   uuid primary key default gen_random_uuid(),
  organization_id      uuid not null,
  request_id           uuid not null,
  tenant_id            uuid,
  name                 text not null,
  email                text not null,
  role                 text not null default 'Tenant',
  signing_order        integer not null default 1 check (signing_order >= 1),
  required             boolean not null default true,
  status               text not null default 'pending' check (status in ('pending', 'sent', 'viewed', 'signed', 'declined')),
  token_hash           text unique,                      -- SHA-256 of the one-time URL token; the raw token is never stored
  token_expires_at     timestamptz,
  verification         text not null default 'none' check (verification in ('none', 'email_otp', 'sms_otp', 'pin')),
  pin_hash             text,
  otp_hash             text,
  otp_expires_at       timestamptz,
  otp_attempts         integer not null default 0 check (otp_attempts >= 0),
  signed_at            timestamptz,
  signature_image_path text,
  unique (organization_id, id),
  foreign key (organization_id, request_id) references public.signature_requests (organization_id, id) on delete cascade,
  foreign key (organization_id, tenant_id) references public.tenants (organization_id, id) on delete set null (tenant_id)
);
create index signers_request_idx on public.signers (organization_id, request_id, signing_order);

create table public.signature_fields (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  request_id      uuid not null,
  signer_id       uuid not null,
  field_type      text not null check (field_type in ('signature', 'initials', 'full_name', 'date', 'text', 'checkbox')),
  page            integer not null check (page >= 1),
  x               numeric(7,6) not null check (x between 0 and 1),     -- normalised page coordinates, origin top-left
  y               numeric(7,6) not null check (y between 0 and 1),
  width           numeric(7,6) not null check (width > 0 and width <= 1),
  height          numeric(7,6) not null check (height > 0 and height <= 1),
  required        boolean not null default true,
  label           text,
  value           text,
  filled_at       timestamptz,
  foreign key (organization_id, request_id) references public.signature_requests (organization_id, id) on delete cascade,
  foreign key (organization_id, signer_id) references public.signers (organization_id, id) on delete cascade
);
create index signature_fields_request_idx on public.signature_fields (organization_id, request_id, signer_id);

create table public.signature_events (                   -- append-only evidence trail
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null,
  request_id          uuid not null,
  signer_id           uuid,
  action              text not null check (action in ('sent', 'delivered', 'opened', 'viewed', 'signed', 'declined', 'completed', 'verified_otp', 'voided')),
  email               text,
  ip_address          inet,
  user_agent          text,
  document_version_id uuid,
  document_sha256     text,
  status              text,
  metadata            jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  foreign key (organization_id, request_id) references public.signature_requests (organization_id, id) on delete cascade,
  foreign key (organization_id, signer_id) references public.signers (organization_id, id) on delete set null (signer_id)
);
create index signature_events_request_idx on public.signature_events (organization_id, request_id, created_at);
create or replace function private.signature_events_immutable() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' and not exists (select 1 from public.signature_requests r where r.id = old.request_id) then return old; end if;
  raise exception 'signature_events is append-only' using errcode = '42501';
end $$;
create trigger signature_events_no_change before update or delete on public.signature_events for each row execute function private.signature_events_immutable();

-- ---------------------------------------------------------------------------------------------------------------------
-- Rental applications
-- ---------------------------------------------------------------------------------------------------------------------
create table public.applications (
  id                       uuid primary key default gen_random_uuid(),
  organization_id          uuid not null references public.organizations (id) on delete cascade,
  application_number       text,
  status                   text not null default 'draft'
                             check (status in ('draft', 'new', 'under_review', 'awaiting_information', 'approved', 'declined', 'waitlisted', 'withdrawn', 'archived')),
  property_id              uuid not null,
  unit_id                  uuid not null,
  requested_move_in_date   date,
  requested_lease_term_months integer check (requested_lease_term_months is null or requested_lease_term_months > 0),
  advertised_rent          numeric(12,2) check (advertised_rent is null or advertised_rent >= 0),
  proposed_rent            numeric(12,2) check (proposed_rent is null or proposed_rent >= 0),
  source                   text not null default 'manually_entered'
                             check (source in ('website', 'referral', 'walk_in', 'listing_portal', 'manually_entered', 'transfer')),
  assigned_reviewer_id     uuid references public.profiles (id) on delete set null,
  submitted_at             timestamptz,
  internal_notes           text,
  created_lease_id         uuid,                          -- FK added below (leases are defined after applications)
  unit_reservation         text not null default 'none' check (unit_reservation in ('none', 'soft_hold', 'reserved')),
  proposed_occupants       integer check (proposed_occupants is null or proposed_occupants >= 0),
  parking_required         text,
  pet_info                 text,
  rental_preferences       text,
  completeness             smallint not null default 0 check (completeness between 0 and 100),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, application_number),
  foreign key (organization_id, property_id) references public.properties (organization_id, id) on delete restrict,
  foreign key (organization_id, unit_id) references public.units (organization_id, id) on delete restrict
);
create trigger applications_number before insert on public.applications for each row execute function private.assign_number('application_number', 'application', 'APP-', '5');
create index applications_status_idx on public.applications (organization_id, status, submitted_at desc);
create index applications_unit_idx on public.applications (organization_id, unit_id);
-- A unit can be reserved by at most one application at a time.
create unique index applications_one_reservation_per_unit on public.applications (organization_id, unit_id)
  where unit_reservation = 'reserved' and status not in ('declined', 'withdrawn', 'archived');

create table public.application_parties (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null,
  application_id     uuid not null,
  tenant_id          uuid,
  role               text not null check (role in ('primary_applicant', 'co_applicant', 'proposed_occupant')),
  is_primary         boolean not null default false,
  full_name          text not null,
  preferred_name     text,
  email              text,
  phone              text,
  current_address    text,
  preferred_contact  text not null default 'email' check (preferred_contact in ('email', 'phone', 'text_message', 'mail')),
  relationship       text,
  income_monthly     numeric(12,2) check (income_monthly is null or income_monthly >= 0),
  employment         text,
  screening_status   text not null default 'not_started' check (screening_status in ('not_started', 'in_progress', 'waiting_for_information', 'completed', 'not_applicable')),
  required_documents text[] not null default '{}',
  signature_required boolean not null default false,
  signature_status   text not null default 'not_applicable' check (signature_status in ('not_sent', 'sent', 'signed', 'not_applicable')),
  notes              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, application_id) references public.applications (organization_id, id) on delete cascade,
  foreign key (organization_id, tenant_id) references public.tenants (organization_id, id) on delete set null (tenant_id)
);
create unique index application_parties_one_primary on public.application_parties (application_id) where is_primary;
create index application_parties_application_idx on public.application_parties (organization_id, application_id);

create table public.application_reviews (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  application_id  uuid not null,
  reviewer_id     uuid references public.profiles (id) on delete set null,
  review_type     text not null check (review_type in ('completeness_check', 'reference_check', 'employment_income', 'credit_check', 'rental_history', 'identity_verification', 'final_review')),
  status          text not null default 'not_started' check (status in ('not_started', 'in_progress', 'waiting_for_information', 'completed', 'not_applicable')),
  started_at      timestamptz,
  reviewed_at     timestamptz,
  notes           text,
  follow_up_required boolean not null default false,
  follow_up_date  date,
  created_at      timestamptz not null default now(),
  foreign key (organization_id, application_id) references public.applications (organization_id, id) on delete cascade
);
create index application_reviews_application_idx on public.application_reviews (organization_id, application_id);

create table public.application_status_history (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  application_id  uuid not null,
  from_status     text,
  to_status       text not null,
  changed_by      uuid references public.profiles (id) on delete set null,
  changed_at      timestamptz not null default now(),
  notes           text,
  foreign key (organization_id, application_id) references public.applications (organization_id, id) on delete cascade
);
create index application_status_history_idx on public.application_status_history (organization_id, application_id, changed_at);

create table public.application_communications (
  id                   uuid primary key default gen_random_uuid(),
  organization_id      uuid not null,
  application_id       uuid not null,
  application_party_id uuid,
  contact_method       text not null check (contact_method in ('phone_call', 'email', 'text_message', 'in_person', 'letter', 'portal_message')),
  subject              text not null,
  summary              text,
  created_by           uuid references public.profiles (id) on delete set null,
  created_at           timestamptz not null default now(),
  follow_up_required   boolean not null default false,
  follow_up_date       date,
  follow_up_status     text check (follow_up_status in ('open', 'completed', 'overdue')),
  foreign key (organization_id, application_id) references public.applications (organization_id, id) on delete cascade,
  foreign key (organization_id, application_party_id) references public.application_parties (organization_id, id) on delete set null (application_party_id)
);
create index application_communications_idx on public.application_communications (organization_id, application_id, created_at desc);

-- Status changes are recorded automatically so history cannot be skipped by a client.
create or replace function private.record_application_status() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.application_status_history (organization_id, application_id, from_status, to_status, changed_by)
    values (new.organization_id, new.id, case when tg_op = 'UPDATE' then old.status end, new.status, (select auth.uid()));
  end if;
  return null;
end $$;
create trigger applications_status_history after insert or update of status on public.applications
  for each row execute function private.record_application_status();

-- ---------------------------------------------------------------------------------------------------------------------
-- Leases
-- ---------------------------------------------------------------------------------------------------------------------
create table public.leases (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references public.organizations (id) on delete cascade,
  lease_number          text,
  name                  text,
  lease_type            text,
  jurisdiction          text,
  tenancy_status        text not null default 'fixed_term' check (tenancy_status in ('fixed_term', 'periodic', 'at_will', 'other')),
  -- 'expiring' is derived from end_date and the configured warning window (see v_leases_current), never stored
  status                text not null default 'draft'
                          check (status in ('draft', 'pending_review', 'pending_signature', 'active', 'expired', 'terminated', 'archived')),
  start_date            date not null,
  end_date              date,
  renewal_eligible      boolean not null default true,
  renewal_deadline      date,
  notice_period_days    integer check (notice_period_days is null or notice_period_days >= 0),
  occupancy_status      text not null default 'unknown' check (occupancy_status in ('occupied', 'vacant', 'not_yet_occupied', 'unknown')),
  application_id        uuid,
  -- financial terms
  agreed_monthly_rent   numeric(12,2) not null default 0 check (agreed_monthly_rent >= 0),
  rent_due_day          smallint not null default 1 check (rent_due_day between 1 and 31),
  payment_frequency     text not null default 'monthly' check (payment_frequency in ('weekly', 'biweekly', 'monthly', 'quarterly', 'annually')),
  payment_method        text,
  deposit_type          text,
  deposit_amount        numeric(12,2) not null default 0 check (deposit_amount >= 0),
  deposit_permitted     boolean,
  parking_fees          numeric(10,2) not null default 0 check (parking_fees >= 0),
  storage_fees          numeric(10,2) not null default 0 check (storage_fees >= 0),
  late_fee_amount       numeric(10,2) not null default 0 check (late_fee_amount >= 0),
  late_fee_grace_days   integer not null default 0 check (late_fee_grace_days >= 0),
  utilities             text,
  rent_increase_details text,
  financial_effective_date date,
  renewal_terms         text,
  terms                 text,
  notes                 text,
  terminated_on         date,
  termination_reason    text,
  created_by            uuid references public.profiles (id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, lease_number),
  check (end_date is null or end_date >= start_date),
  check (terminated_on is null or terminated_on >= start_date),
  foreign key (organization_id, application_id) references public.applications (organization_id, id) on delete set null (application_id)
);
create trigger leases_number before insert on public.leases for each row execute function private.assign_number('lease_number', 'lease', 'LSE-', '5');
create index leases_status_idx on public.leases (organization_id, status, end_date);
create index leases_expiry_idx on public.leases (organization_id, end_date) where status = 'active';
alter table public.applications
  add constraint applications_created_lease_fk foreign key (organization_id, created_lease_id)
  references public.leases (organization_id, id) on delete set null (created_lease_id);

create table public.lease_additional_charges (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  lease_id        uuid not null,
  label           text not null,
  amount          numeric(10,2) not null check (amount >= 0),
  position        integer not null default 0,
  foreign key (organization_id, lease_id) references public.leases (organization_id, id) on delete cascade
);
create index lease_additional_charges_lease_idx on public.lease_additional_charges (organization_id, lease_id);

-- One lease can cover several units, each with its own rent allocation and occupancy dates.
create table public.lease_units (
  id                      uuid primary key default gen_random_uuid(),
  organization_id         uuid not null,
  lease_id                uuid not null,
  unit_id                 uuid not null,
  allocated_monthly_rent  numeric(12,2) check (allocated_monthly_rent is null or allocated_monthly_rent >= 0),
  start_date              date not null,
  end_date                date,
  notes                   text,
  is_occupying            boolean not null default false,   -- maintained by triggers from leases.status
  exclusive               boolean not null default true,    -- copied from NOT units.allow_multiple_active_leases
  created_at              timestamptz not null default now(),
  unique (organization_id, id),
  check (end_date is null or end_date >= start_date),
  foreign key (organization_id, lease_id) references public.leases (organization_id, id) on delete cascade,
  foreign key (organization_id, unit_id) references public.units (organization_id, id) on delete restrict,
  -- No two exclusive, occupying leases may cover the same unit on overlapping dates (race-free, enforced by PostgreSQL).
  constraint lease_units_no_overlap exclude using gist (
    unit_id with =,
    daterange(start_date, coalesce(end_date, 'infinity'::date), '[]') with &&
  ) where (is_occupying and exclusive)
);
create index lease_units_lease_idx on public.lease_units (organization_id, lease_id);
create index lease_units_unit_idx on public.lease_units (organization_id, unit_id, start_date);

create or replace function private.lease_unit_defaults() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  select (l.status = 'active') into new.is_occupying from public.leases l where l.organization_id = new.organization_id and l.id = new.lease_id;
  select not u.allow_multiple_active_leases into new.exclusive from public.units u where u.organization_id = new.organization_id and u.id = new.unit_id;
  new.is_occupying := coalesce(new.is_occupying, false);
  new.exclusive := coalesce(new.exclusive, true);
  return new;
end $$;
create trigger lease_units_defaults before insert on public.lease_units for each row execute function private.lease_unit_defaults();

create or replace function private.sync_lease_occupancy() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status is distinct from old.status then
    update public.lease_units set is_occupying = (new.status = 'active')
     where organization_id = new.organization_id and lease_id = new.id and is_occupying is distinct from (new.status = 'active');
  end if;
  return null;
end $$;
create trigger leases_sync_occupancy after update of status on public.leases for each row execute function private.sync_lease_occupancy();

create table public.lease_parties (
  id                       uuid primary key default gen_random_uuid(),
  organization_id          uuid not null,
  lease_id                 uuid not null,
  tenant_id                uuid not null,
  role                     text not null default 'main_tenant' check (role in ('main_tenant', 'co_tenant', 'occupant', 'guarantor')),
  is_primary_contact       boolean not null default false,
  is_signatory             boolean not null default false,
  signature_status         text not null default 'not_required' check (signature_status in ('not_required', 'pending', 'signed', 'declined')),
  relationship_start_date  date not null default current_date,
  relationship_end_date    date,
  relationship             text,
  notes                    text,
  created_at               timestamptz not null default now(),
  unique (organization_id, id),
  check (relationship_end_date is null or relationship_end_date >= relationship_start_date),
  foreign key (organization_id, lease_id) references public.leases (organization_id, id) on delete cascade,
  foreign key (organization_id, tenant_id) references public.tenants (organization_id, id) on delete restrict
);
create unique index lease_parties_one_primary_contact on public.lease_parties (lease_id) where is_primary_contact and relationship_end_date is null;
create index lease_parties_lease_idx on public.lease_parties (organization_id, lease_id);
create index lease_parties_tenant_idx on public.lease_parties (organization_id, tenant_id, relationship_start_date);

create table public.lease_party_units (                  -- which unit(s) a party occupies under the lease
  organization_id uuid not null,
  lease_party_id  uuid not null,
  unit_id         uuid not null,
  primary key (lease_party_id, unit_id),
  foreign key (organization_id, lease_party_id) references public.lease_parties (organization_id, id) on delete cascade,
  foreign key (organization_id, unit_id) references public.units (organization_id, id) on delete restrict
);

create table public.lease_renewals (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null,
  original_lease_id  uuid not null,
  successor_lease_id uuid,
  renewal_type       text not null default 'renewal' check (renewal_type in ('renewal', 'amendment')),
  proposed_start_date date,
  proposed_end_date  date,
  proposed_rent      numeric(12,2) check (proposed_rent is null or proposed_rent >= 0),
  effective_date     date,
  reminder_date      date,
  status             text not null default 'draft' check (status in ('draft', 'pending_review', 'pending_signature', 'approved', 'signed')),
  notes              text,
  created_by         uuid references public.profiles (id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (organization_id, id),
  check (proposed_end_date is null or proposed_start_date is null or proposed_end_date >= proposed_start_date),
  foreign key (organization_id, original_lease_id) references public.leases (organization_id, id) on delete cascade,
  foreign key (organization_id, successor_lease_id) references public.leases (organization_id, id) on delete set null (successor_lease_id)
);
create index lease_renewals_original_idx on public.lease_renewals (organization_id, original_lease_id);
create index lease_renewals_reminder_idx on public.lease_renewals (organization_id, reminder_date) where status in ('draft', 'pending_review', 'pending_signature');
create table public.lease_renewal_documents (
  organization_id uuid not null,
  renewal_id      uuid not null,
  document_id     uuid not null,
  primary key (renewal_id, document_id),
  foreign key (organization_id, renewal_id) references public.lease_renewals (organization_id, id) on delete cascade,
  foreign key (organization_id, document_id) references public.documents (organization_id, id) on delete cascade
);

-- signature requests may reference a lease (composite FK added now that leases exist)
alter table public.signature_requests
  add constraint signature_requests_lease_fk foreign key (organization_id, lease_id)
  references public.leases (organization_id, id) on delete set null (lease_id);

-- ---------------------------------------------------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['owners', 'management_companies', 'properties', 'units', 'vendors', 'tenants', 'documents', 'signature_requests',
                           'applications', 'application_parties', 'leases', 'lease_renewals'] loop
    execute format('create trigger %I before update on public.%I for each row execute function private.set_updated_at()', t || '_updated_at', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------------------------------------------------
-- Row-Level Security
-- ---------------------------------------------------------------------------------------------------------------------
call private.apply_org_policies('public.owners',                    'view_properties', 'manage_properties');
call private.apply_org_policies('public.management_companies',      'view_properties', 'manage_properties');
call private.apply_org_policies('public.properties',                'view_properties', 'manage_properties');
call private.apply_org_policies('public.property_owners',           'view_properties', 'manage_properties');
call private.apply_org_policies('public.property_preferred_vendors','view_properties', 'manage_properties');
call private.apply_org_policies('public.units',                     'view_properties', 'manage_properties');
call private.apply_org_policies('public.vendors',                   'view_properties', 'manage_vendors');
call private.apply_org_policies('public.vendor_workers',            'view_properties', 'manage_vendors');
call private.apply_org_policies('public.tenants',                   'view_tenants', 'manage_tenants');
call private.apply_org_policies('public.tenant_contacts',           'view_tenants', 'manage_tenants');
call private.apply_org_policies('public.applications',              'view_tenants', 'manage_tenants');
call private.apply_org_policies('public.application_parties',       'view_tenants', 'manage_tenants');
call private.apply_org_policies('public.application_reviews',       'view_tenants', 'manage_tenants');
call private.apply_org_policies('public.application_status_history','view_tenants', null, 'none');   -- written by trigger only
call private.apply_org_policies('public.application_communications','view_tenants', 'manage_tenants');
call private.apply_org_policies('public.leases',                    'view_tenants', 'manage_tenants');
call private.apply_org_policies('public.lease_additional_charges',  'view_tenants', 'manage_tenants');
call private.apply_org_policies('public.lease_units',               'view_tenants', 'manage_tenants');
call private.apply_org_policies('public.lease_parties',             'view_tenants', 'manage_tenants');
call private.apply_org_policies('public.lease_party_units',         'view_tenants', 'manage_tenants');
call private.apply_org_policies('public.lease_renewals',            'view_tenants', 'manage_tenants');
call private.apply_org_policies('public.lease_renewal_documents',   'view_tenants', 'manage_tenants');

-- Sensitive tenant / vendor details and identification metadata
do $$
declare t text;
begin
  foreach t in array array['tenant_private_details', 'vendor_private_details', 'tenant_id_documents'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;
create policy tenant_private_select on public.tenant_private_details for select to authenticated using (private.has_permission(organization_id, 'view_sensitive'));
create policy tenant_private_write on public.tenant_private_details for all to authenticated
  using (private.has_permission(organization_id, 'view_sensitive') and private.has_permission(organization_id, 'manage_tenants'))
  with check (private.has_permission(organization_id, 'view_sensitive') and private.has_permission(organization_id, 'manage_tenants'));
create policy vendor_private_select on public.vendor_private_details for select to authenticated using (private.has_permission(organization_id, 'view_sensitive'));
create policy vendor_private_write on public.vendor_private_details for all to authenticated
  using (private.has_permission(organization_id, 'view_sensitive') and private.has_permission(organization_id, 'manage_vendors'))
  with check (private.has_permission(organization_id, 'view_sensitive') and private.has_permission(organization_id, 'manage_vendors'));
create policy tenant_id_documents_select on public.tenant_id_documents for select to authenticated using (private.has_permission(organization_id, 'view_sensitive'));
create policy tenant_id_documents_write on public.tenant_id_documents for all to authenticated
  using (private.has_permission(organization_id, 'view_sensitive') and private.has_permission(organization_id, 'manage_tenants'))
  with check (private.has_permission(organization_id, 'view_sensitive') and private.has_permission(organization_id, 'manage_tenants'));

-- Documents: sensitive documents need view_sensitive; uploaders may maintain their own non-sensitive files.
alter table public.documents          enable row level security;
alter table public.document_versions  enable row level security;
alter table public.document_links     enable row level security;
create policy documents_select on public.documents for select to authenticated
  using (private.has_permission(organization_id, 'view_documents') and (not is_sensitive or private.has_permission(organization_id, 'view_sensitive')));
create policy documents_insert on public.documents for insert to authenticated
  with check (uploaded_by = (select auth.uid()) and private.has_permission(organization_id, 'upload_documents')
              and (not is_sensitive or private.has_permission(organization_id, 'manage_documents')));
create policy documents_update on public.documents for update to authenticated
  using (private.has_permission(organization_id, 'manage_documents')
         or (uploaded_by = (select auth.uid()) and not is_sensitive and private.has_permission(organization_id, 'upload_documents')))
  with check (private.has_permission(organization_id, 'manage_documents')
              or (uploaded_by = (select auth.uid()) and not is_sensitive and private.has_permission(organization_id, 'upload_documents')));
create policy documents_delete on public.documents for delete to authenticated using (private.has_permission(organization_id, 'manage_documents'));

-- Versions and links inherit the visibility of their document (the sub-select is itself subject to documents RLS).
create policy document_versions_select on public.document_versions for select to authenticated
  using (exists (select 1 from public.documents d where d.organization_id = document_versions.organization_id and d.id = document_versions.document_id));
create policy document_versions_insert on public.document_versions for insert to authenticated
  with check (uploaded_by = (select auth.uid()) and private.has_permission(organization_id, 'upload_documents')
              and not is_immutable and not is_certificate        -- only the signing service (service role) writes signed versions
              and exists (select 1 from public.documents d where d.organization_id = document_versions.organization_id and d.id = document_versions.document_id));
create policy document_versions_delete on public.document_versions for delete to authenticated
  using (private.has_permission(organization_id, 'manage_documents') and not is_immutable);
create policy document_links_select on public.document_links for select to authenticated
  using (exists (select 1 from public.documents d where d.organization_id = document_links.organization_id and d.id = document_links.document_id));
create policy document_links_write on public.document_links for all to authenticated
  using (private.has_permission(organization_id, 'upload_documents')
         and exists (select 1 from public.documents d where d.organization_id = document_links.organization_id and d.id = document_links.document_id))
  with check (private.has_permission(organization_id, 'upload_documents')
              and exists (select 1 from public.documents d where d.organization_id = document_links.organization_id and d.id = document_links.document_id));
revoke all on public.documents, public.document_versions, public.document_links from anon;
grant select, insert, update, delete on public.documents, public.document_links to authenticated;
grant select, insert, delete on public.document_versions to authenticated;

-- E-signature: staff manage requests/signers/fields; the evidence trail is written by the signing service (service role) only.
call private.apply_org_policies('public.signature_requests', 'view_documents', 'manage_documents', 'manage_documents');
call private.apply_org_policies('public.signers',            'view_documents', 'manage_documents', 'manage_documents');
call private.apply_org_policies('public.signature_fields',   'view_documents', 'manage_documents', 'manage_documents');
call private.apply_org_policies('public.signature_events',   'view_documents', null, 'none');

commit;
