-- =====================================================================================================================
-- 005_maintenance_and_projects.sql
-- Maintenance (requests, work orders, estimates, visits, work log, assets, preventive/inspection schedules) and
-- property-improvement projects (tasks, team, expenses, invoices, payments, change orders, quotes, POs, milestones,
-- inspections, deficiencies).
-- Attachments and project documents are rows in public.documents linked through public.document_links.
-- =====================================================================================================================
begin;
set local search_path = public, extensions;

-- ---------------------------------------------------------------------------------------------------------------------
-- Assets and maintenance
-- ---------------------------------------------------------------------------------------------------------------------
create table public.assets (
  id                   uuid primary key default gen_random_uuid(),
  organization_id      uuid not null references public.organizations (id) on delete cascade,
  asset_number         text,
  name                 text not null,
  asset_type           text not null,
  property_id          uuid not null,
  unit_id              uuid,
  room                 text,
  brand                text,
  model                text,
  serial_number        text,
  purchase_date        date,
  purchase_price       numeric(14,2) check (purchase_price is null or purchase_price >= 0),
  supplier             text,
  install_date         date,
  warranty_start       date,
  warranty_end         date,
  warranty_provider    text,
  warranty_reference   text,
  warranty_notes       text,
  condition            text not null default 'good' check (condition in ('excellent', 'good', 'fair', 'poor', 'failed')),
  status               text not null default 'active' check (status in ('active', 'under_inspection', 'under_repair', 'replaced', 'retired', 'disposed')),
  last_inspection      date,
  last_service         date,
  next_service         date,
  replaced_by_id       uuid,
  replacement_reason   text,
  replacement_date     date,
  retired_date         date,
  disposal_notes       text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, asset_number),
  check (warranty_end is null or warranty_start is null or warranty_end >= warranty_start),
  foreign key (organization_id, property_id) references public.properties (organization_id, id) on delete restrict,
  foreign key (organization_id, unit_id) references public.units (organization_id, id) on delete restrict,
  foreign key (organization_id, replaced_by_id) references public.assets (organization_id, id) on delete set null (replaced_by_id)
);
create trigger assets_number before insert on public.assets for each row execute function private.assign_number('asset_number', 'asset', 'AST-', '5');
create index assets_property_idx on public.assets (organization_id, property_id, status);
create index assets_warranty_idx on public.assets (organization_id, warranty_end) where warranty_end is not null and status = 'active';
create index assets_service_idx on public.assets (organization_id, next_service) where next_service is not null and status = 'active';

create table public.maintenance_requests (
  id                      uuid primary key default gen_random_uuid(),
  organization_id         uuid not null references public.organizations (id) on delete cascade,
  request_number          text,
  title                   text not null check (btrim(title) <> ''),
  description             text,
  category                text not null default 'general',
  subcategory             text,
  priority                text not null default 'normal' check (priority in ('emergency', 'high', 'normal', 'low')),
  status                  text not null default 'new'
                            check (status in ('draft', 'new', 'under_review', 'awaiting_approval', 'approved', 'assigned', 'in_progress', 'on_hold',
                                              'completed', 'closed', 'rejected', 'cancelled')),
  property_id             uuid not null,
  unit_id                 uuid,
  room                    text,
  tenant_id               uuid,
  lease_id                uuid,
  asset_id                uuid,
  reported_by_name        text,
  reported_by_role        text,
  source                  text,
  reported_at             timestamptz not null default now(),
  preferred_date          date,
  target_date             date,
  completed_at            timestamptz,
  assigned_staff_id       uuid references public.profiles (id) on delete set null,
  assigned_vendor_id      uuid,
  assigned_at             timestamptz,
  internal_notes          text,
  tenant_notes            text,
  contractor_notes        text,
  access_instructions     text,
  preferred_access_times  text,
  pets_note               text,
  approval_status         text not null default 'not_required' check (approval_status in ('not_required', 'pending_approval', 'approved', 'rejected', 'revision_requested')),
  approved_budget         numeric(14,2) check (approved_budget is null or approved_budget >= 0),
  resolution_outcome      text check (resolution_outcome in ('repaired', 'replaced', 'no_fault_found', 'unable_to_repair', 'deferred', 'cancelled')),
  resolution_notes        text,
  final_cost              numeric(14,2) check (final_cost is null or final_cost >= 0),
  verified_by             uuid references public.profiles (id) on delete set null,
  verification_status     text check (verification_status in ('verified', 'pending_verification', 'not_verified')),
  warranty_info           text,
  follow_up_required      boolean not null default false,
  status_reason           text,                                  -- reason for rejection / cancellation
  linked_project_id       uuid,
  created_by              uuid references public.profiles (id) on delete set null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, request_number),
  check (unit_id is null or property_id is not null),
  foreign key (organization_id, property_id) references public.properties (organization_id, id) on delete restrict,
  foreign key (organization_id, unit_id) references public.units (organization_id, id) on delete restrict,
  foreign key (organization_id, tenant_id) references public.tenants (organization_id, id) on delete set null (tenant_id),
  foreign key (organization_id, lease_id) references public.leases (organization_id, id) on delete set null (lease_id),
  foreign key (organization_id, asset_id) references public.assets (organization_id, id) on delete set null (asset_id),
  foreign key (organization_id, assigned_vendor_id) references public.vendors (organization_id, id) on delete set null (assigned_vendor_id)
);
create trigger maintenance_requests_number before insert on public.maintenance_requests for each row execute function private.assign_number('request_number', 'maintenance_request', 'MR-', '5');
create index maintenance_requests_status_idx   on public.maintenance_requests (organization_id, status, priority);
create index maintenance_requests_property_idx on public.maintenance_requests (organization_id, property_id, reported_at desc);
create index maintenance_requests_unit_idx     on public.maintenance_requests (organization_id, unit_id) where unit_id is not null;
create index maintenance_requests_target_idx   on public.maintenance_requests (organization_id, target_date) where status not in ('completed', 'closed', 'rejected', 'cancelled');
create index maintenance_requests_vendor_idx   on public.maintenance_requests (organization_id, assigned_vendor_id) where assigned_vendor_id is not null;

create table public.maintenance_request_completions (          -- history of earlier completions when a request is reopened
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  request_id      uuid not null,
  completed_at    timestamptz not null,
  outcome         text not null check (outcome in ('repaired', 'replaced', 'no_fault_found', 'unable_to_repair', 'deferred', 'cancelled')),
  notes           text,
  final_cost      numeric(14,2),
  reopened_at     timestamptz,
  reopen_reason   text,
  foreign key (organization_id, request_id) references public.maintenance_requests (organization_id, id) on delete cascade
);

create table public.maintenance_work_orders (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null,
  work_order_number text,
  request_id        uuid not null,
  title             text not null,
  description       text,
  scope             text,
  vendor_id         uuid,
  staff_id          uuid references public.profiles (id) on delete set null,
  priority          text not null default 'normal' check (priority in ('emergency', 'high', 'normal', 'low')),
  scheduled_date    date,
  target_date       date,
  status            text not null default 'draft' check (status in ('draft', 'awaiting_assignment', 'scheduled', 'in_progress', 'on_hold', 'completed', 'cancelled')),
  estimate          numeric(14,2) check (estimate is null or estimate >= 0),
  approved_budget   numeric(14,2) check (approved_budget is null or approved_budget >= 0),
  actual_cost       numeric(14,2) check (actual_cost is null or actual_cost >= 0),
  completion_notes  text,
  completed_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, work_order_number),
  foreign key (organization_id, request_id) references public.maintenance_requests (organization_id, id) on delete cascade,
  foreign key (organization_id, vendor_id) references public.vendors (organization_id, id) on delete set null (vendor_id)
);
create trigger work_orders_number before insert on public.maintenance_work_orders for each row execute function private.assign_number('work_order_number', 'work_order', 'WO-', '5');
create index work_orders_request_idx on public.maintenance_work_orders (organization_id, request_id);
create index work_orders_status_idx  on public.maintenance_work_orders (organization_id, status, scheduled_date);

create table public.maintenance_estimates (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  request_id      uuid not null,
  vendor_id       uuid,
  label           text not null,
  labor           numeric(14,2) not null default 0 check (labor >= 0),
  materials       numeric(14,2) not null default 0 check (materials >= 0),
  other           numeric(14,2) not null default 0 check (other >= 0),
  tax             numeric(14,2) not null default 0 check (tax >= 0),
  total           numeric(14,2) generated always as (labor + materials + other + tax) stored,
  status          text not null default 'pending_approval' check (status in ('not_required', 'pending_approval', 'approved', 'rejected', 'revision_requested')),
  submitted_by    uuid references public.profiles (id) on delete set null,
  submitted_at    timestamptz not null default now(),
  approved_by     uuid references public.profiles (id) on delete set null,
  approved_at     timestamptz,
  approved_budget numeric(14,2),
  notes           text,
  foreign key (organization_id, request_id) references public.maintenance_requests (organization_id, id) on delete cascade,
  foreign key (organization_id, vendor_id) references public.vendors (organization_id, id) on delete set null (vendor_id)
);
create index maintenance_estimates_request_idx on public.maintenance_estimates (organization_id, request_id);

create table public.maintenance_visits (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null,
  request_id          uuid not null,
  work_order_id       uuid,
  vendor_id           uuid,
  staff_id            uuid references public.profiles (id) on delete set null,
  purpose             text not null,
  visit_date          date not null,
  visit_time          time,
  duration_minutes    integer check (duration_minutes is null or duration_minutes > 0),
  status              text not null default 'scheduled' check (status in ('scheduled', 'completed', 'cancelled', 'rescheduled')),
  access_arrangements text,
  notes               text,
  foreign key (organization_id, request_id) references public.maintenance_requests (organization_id, id) on delete cascade,
  foreign key (organization_id, work_order_id) references public.maintenance_work_orders (organization_id, id) on delete set null (work_order_id),
  foreign key (organization_id, vendor_id) references public.vendors (organization_id, id) on delete set null (vendor_id)
);
create index maintenance_visits_date_idx on public.maintenance_visits (organization_id, visit_date) where status = 'scheduled';
create index maintenance_visits_request_idx on public.maintenance_visits (organization_id, request_id);

create table public.maintenance_work_logs (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null,
  request_id       uuid not null,
  work_order_id    uuid,
  log_date         date not null,
  person           text not null,
  work_performed   text not null,
  diagnosis        text,
  materials        text,
  hours            numeric(6,2) not null default 0 check (hours >= 0),
  outcome          text,
  follow_up_required boolean not null default false,
  notes            text,
  created_by       uuid references public.profiles (id) on delete set null,
  foreign key (organization_id, request_id) references public.maintenance_requests (organization_id, id) on delete cascade,
  foreign key (organization_id, work_order_id) references public.maintenance_work_orders (organization_id, id) on delete set null (work_order_id)
);
create index maintenance_work_logs_request_idx on public.maintenance_work_logs (organization_id, request_id, log_date);

-- Preventive maintenance / inspection schedules (the "Inspections" screen)
create table public.maintenance_schedules (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null,
  task              text not null,
  category          text not null default 'general',
  property_id       uuid not null,
  unit_id           uuid,
  asset_id          uuid,
  frequency         text not null default 'monthly' check (frequency in ('weekly', 'monthly', 'quarterly', 'semi_annual', 'annual', 'custom')),
  custom_days       integer check (custom_days is null or custom_days > 0),
  last_completed    date,
  next_due          date not null,
  vendor_id         uuid,
  estimated_cost    numeric(14,2) check (estimated_cost is null or estimated_cost >= 0),
  instructions      text,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (organization_id, id),
  check (frequency <> 'custom' or custom_days is not null),
  foreign key (organization_id, property_id) references public.properties (organization_id, id) on delete restrict,
  foreign key (organization_id, unit_id) references public.units (organization_id, id) on delete restrict,
  foreign key (organization_id, asset_id) references public.assets (organization_id, id) on delete set null (asset_id),
  foreign key (organization_id, vendor_id) references public.vendors (organization_id, id) on delete set null (vendor_id)
);
create index maintenance_schedules_due_idx on public.maintenance_schedules (organization_id, next_due) where is_active;
create table public.maintenance_schedule_checklist_items (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  schedule_id     uuid not null,
  position        integer not null default 0,
  label           text not null,
  foreign key (organization_id, schedule_id) references public.maintenance_schedules (organization_id, id) on delete cascade
);

-- Link expenses to the maintenance records that caused them
alter table public.expenses
  add column maintenance_request_id uuid,
  add column asset_id uuid,
  add constraint expenses_work_order_fk foreign key (organization_id, work_order_id)
    references public.maintenance_work_orders (organization_id, id) on delete set null (work_order_id),
  add constraint expenses_request_fk foreign key (organization_id, maintenance_request_id)
    references public.maintenance_requests (organization_id, id) on delete set null (maintenance_request_id),
  add constraint expenses_asset_fk foreign key (organization_id, asset_id)
    references public.assets (organization_id, id) on delete set null (asset_id);
create index expenses_work_order_idx on public.expenses (organization_id, work_order_id) where work_order_id is not null;

-- ---------------------------------------------------------------------------------------------------------------------
-- Projects
-- ---------------------------------------------------------------------------------------------------------------------
create table public.projects (
  id                       uuid primary key default gen_random_uuid(),
  organization_id          uuid not null references public.organizations (id) on delete cascade,
  project_number           text,
  name                     text not null check (btrim(name) <> ''),
  property_id              uuid not null,
  unit_id                  uuid,
  project_type             text not null default 'renovation' check (project_type in ('renovation', 'repair', 'maintenance', 'upgrade', 'restoration', 'other')),
  description              text,
  reason                   text,
  priority                 text not null default 'normal' check (priority in ('low', 'normal', 'high', 'emergency')),
  status                   text not null default 'draft' check (status in ('draft', 'planned', 'approved', 'in_progress', 'on_hold', 'completed', 'cancelled')),
  manager_id               uuid references public.profiles (id) on delete set null,
  manager_name             text,
  planned_start            date,
  estimated_completion     date,
  actual_start             date,
  actual_completion        date,
  occupancy_status         text check (occupancy_status in ('occupied', 'vacant', 'vacating', 'ready_for_rent')),
  tenant_id                uuid,
  must_vacate              boolean not null default false,
  access_requirements      text,
  move_out_date            date,
  expected_ready_date      date,
  actual_ready_date        date,
  utility_shutdowns        text,
  lost_rent                numeric(14,2) not null default 0 check (lost_rent >= 0),
  readiness_approved       boolean not null default false,
  readiness_approved_by    uuid references public.profiles (id) on delete set null,
  original_budget          numeric(14,2) not null default 0 check (original_budget >= 0),
  contingency              numeric(14,2) not null default 0 check (contingency >= 0),
  internal_notes           text,
  archived_at              timestamptz,
  created_by               uuid references public.profiles (id) on delete set null,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, project_number),
  check (estimated_completion is null or planned_start is null or estimated_completion >= planned_start),
  check (actual_completion is null or actual_start is null or actual_completion >= actual_start),
  foreign key (organization_id, property_id) references public.properties (organization_id, id) on delete restrict,
  foreign key (organization_id, unit_id) references public.units (organization_id, id) on delete restrict,
  foreign key (organization_id, tenant_id) references public.tenants (organization_id, id) on delete set null (tenant_id)
);
create trigger projects_number before insert on public.projects for each row execute function private.assign_number('project_number', 'project', 'PRJ-', '4');
create index projects_status_idx   on public.projects (organization_id, status) where archived_at is null;
create index projects_property_idx on public.projects (organization_id, property_id, status);

alter table public.maintenance_requests
  add constraint maintenance_requests_project_fk foreign key (organization_id, linked_project_id)
  references public.projects (organization_id, id) on delete set null (linked_project_id);
alter table public.journal_entry_lines
  add constraint jel_project_fk foreign key (organization_id, project_id) references public.projects (organization_id, id) on delete restrict;
create index jel_project_idx on public.journal_entry_lines (organization_id, project_id, entry_date) where project_id is not null;

create table public.project_tenant_notifications (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id      uuid not null,
  notified_on     date not null,
  channel         text not null,
  note            text,
  foreign key (organization_id, project_id) references public.projects (organization_id, id) on delete cascade
);
create table public.project_team_members (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null,
  project_id        uuid not null,
  vendor_id         uuid not null,
  role              text not null,
  responsibilities  text,
  contract_amount   numeric(14,2) not null default 0 check (contract_amount >= 0),
  start_date        date,
  end_date          date,
  status            text not null default 'assigned' check (status in ('assigned', 'active', 'complete', 'released')),
  worker_name       text,
  check (end_date is null or start_date is null or end_date >= start_date),
  foreign key (organization_id, project_id) references public.projects (organization_id, id) on delete cascade,
  foreign key (organization_id, vendor_id) references public.vendors (organization_id, id) on delete restrict
);
create index project_team_members_project_idx on public.project_team_members (organization_id, project_id);

create table public.project_tasks (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null,
  project_id         uuid not null,
  name               text not null,
  description        text,
  category           text not null default 'general' check (category in ('demolition', 'electrical', 'plumbing', 'painting', 'flooring', 'kitchen', 'bathroom', 'cleanup', 'inspection', 'general')),
  assignee_type      text not null default 'internal' check (assignee_type in ('contractor', 'worker', 'internal')),
  vendor_id          uuid,
  assignee_name      text,
  planned_start      date,
  planned_finish     date,
  actual_start       date,
  actual_finish      date,
  estimated_cost     numeric(14,2) not null default 0 check (estimated_cost >= 0),
  actual_cost        numeric(14,2) not null default 0 check (actual_cost >= 0),
  status             text not null default 'not_started' check (status in ('not_started', 'in_progress', 'blocked', 'completed')),
  priority           text not null default 'normal' check (priority in ('low', 'normal', 'high', 'emergency')),
  completion_notes   text,
  before_photo_path  text,
  after_photo_path   text,
  inspection_required boolean not null default false,
  created_by         uuid references public.profiles (id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (organization_id, id),
  check (planned_finish is null or planned_start is null or planned_finish >= planned_start),
  foreign key (organization_id, project_id) references public.projects (organization_id, id) on delete cascade,
  foreign key (organization_id, vendor_id) references public.vendors (organization_id, id) on delete set null (vendor_id)
);
create index project_tasks_project_idx on public.project_tasks (organization_id, project_id, planned_start);
create table public.project_task_dependencies (
  organization_id uuid not null,
  task_id         uuid not null,
  depends_on_id   uuid not null,
  primary key (task_id, depends_on_id),
  check (task_id <> depends_on_id),
  foreign key (organization_id, task_id) references public.project_tasks (organization_id, id) on delete cascade,
  foreign key (organization_id, depends_on_id) references public.project_tasks (organization_id, id) on delete cascade
);

create table public.project_invoices (                        -- invoices FROM contractors/vendors to the project (payables)
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null,
  project_id       uuid not null,
  invoice_number   text not null,
  vendor_id        uuid not null,
  task_id          uuid,
  purchase_order_id uuid,
  invoice_date     date not null,
  received_date    date,
  due_date         date not null,
  discount         numeric(14,2) not null default 0 check (discount >= 0),
  approval_status  text not null default 'draft' check (approval_status in ('draft', 'pending_approval', 'approved', 'rejected', 'cancelled')),
  notes            text,
  created_by       uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, vendor_id, invoice_number),
  foreign key (organization_id, project_id) references public.projects (organization_id, id) on delete cascade,
  foreign key (organization_id, vendor_id) references public.vendors (organization_id, id) on delete restrict,
  foreign key (organization_id, task_id) references public.project_tasks (organization_id, id) on delete set null (task_id)
);
create index project_invoices_project_idx on public.project_invoices (organization_id, project_id, due_date);
create table public.project_invoice_lines (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null,
  invoice_id       uuid not null,
  position         integer not null default 0,
  description      text not null,
  quantity         numeric(12,3) not null default 1 check (quantity > 0),
  uom              text not null default 'ea',
  unit_price       numeric(14,2) not null check (unit_price >= 0),
  tax_rate         numeric(6,3) not null default 0 check (tax_rate between 0 and 100),
  subtotal         numeric(14,2) generated always as (round(quantity * unit_price, 2)) stored,
  tax_amount       numeric(14,2) generated always as (round(quantity * unit_price * tax_rate / 100, 2)) stored,
  foreign key (organization_id, invoice_id) references public.project_invoices (organization_id, id) on delete cascade
);
create index project_invoice_lines_idx on public.project_invoice_lines (organization_id, invoice_id);

create table public.project_purchase_orders (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null,
  project_id        uuid not null,
  po_number         text not null,
  vendor_name       text not null,
  vendor_id         uuid,
  items             text,
  quantity          numeric(12,3),
  subtotal          numeric(14,2) not null default 0 check (subtotal >= 0),
  tax               numeric(14,2) not null default 0 check (tax >= 0),
  total             numeric(14,2) generated always as (subtotal + tax) stored,
  expected_delivery date,
  approved_by       uuid references public.profiles (id) on delete set null,
  approval_date     date,
  status            text not null default 'draft' check (status in ('draft', 'approved', 'ordered', 'received', 'cancelled')),
  unique (organization_id, id),
  unique (organization_id, project_id, po_number),
  foreign key (organization_id, project_id) references public.projects (organization_id, id) on delete cascade,
  foreign key (organization_id, vendor_id) references public.vendors (organization_id, id) on delete set null (vendor_id)
);
alter table public.project_invoices
  add constraint project_invoices_po_fk foreign key (organization_id, purchase_order_id)
  references public.project_purchase_orders (organization_id, id) on delete set null (purchase_order_id);

create table public.project_expenses (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null,
  project_id        uuid not null,
  task_id           uuid,
  source_invoice_id uuid,
  expense_date      date not null,
  category          text not null default 'other'
                      check (category in ('labor', 'materials', 'plumbing_electrical_supplies', 'equipment_rental', 'permits_inspections', 'contractor_services',
                                          'delivery_transportation', 'waste_removal', 'other')),
  description       text not null,
  vendor_name       text,
  vendor_id         uuid,
  quantity          numeric(12,3) not null default 1 check (quantity > 0),
  uom               text not null default 'ea',
  unit_price        numeric(14,2) not null check (unit_price >= 0),
  discount          numeric(14,2) not null default 0 check (discount >= 0),
  tax_rate          numeric(6,3) not null default 0 check (tax_rate between 0 and 100),
  subtotal          numeric(14,2) generated always as (round(quantity * unit_price, 2)) stored,
  tax_amount        numeric(14,2) generated always as (round((round(quantity * unit_price, 2) - discount) * tax_rate / 100, 2)) stored,
  total             numeric(14,2) generated always as (round(quantity * unit_price, 2) - discount + round((round(quantity * unit_price, 2) - discount) * tax_rate / 100, 2)) stored,
  receipt_number    text,
  approval_status   text not null default 'draft' check (approval_status in ('draft', 'pending_approval', 'approved', 'rejected', 'cancelled')),
  notes             text,
  created_by        uuid references public.profiles (id) on delete set null,
  created_at        timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, project_id) references public.projects (organization_id, id) on delete cascade,
  foreign key (organization_id, task_id) references public.project_tasks (organization_id, id) on delete set null (task_id),
  foreign key (organization_id, source_invoice_id) references public.project_invoices (organization_id, id) on delete set null (source_invoice_id),
  foreign key (organization_id, vendor_id) references public.vendors (organization_id, id) on delete set null (vendor_id)
);
create index project_expenses_project_idx on public.project_expenses (organization_id, project_id, expense_date);

create table public.project_payments (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null,
  project_id       uuid not null,
  payee_vendor_id  uuid not null,
  payment_date     date not null,
  amount           numeric(14,2) not null check (amount > 0),
  method           text not null check (method in ('eft', 'cheque', 'credit_card', 'cash', 'wire_transfer')),
  reference        text,
  notes            text,
  recorded_by      uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, project_id) references public.projects (organization_id, id) on delete cascade,
  foreign key (organization_id, payee_vendor_id) references public.vendors (organization_id, id) on delete restrict
);
create table public.project_payment_allocations (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null,
  payment_id       uuid not null,
  invoice_id       uuid not null,
  amount           numeric(14,2) not null check (amount > 0),
  unique (payment_id, invoice_id),
  foreign key (organization_id, payment_id) references public.project_payments (organization_id, id) on delete cascade,
  foreign key (organization_id, invoice_id) references public.project_invoices (organization_id, id) on delete restrict
);
create or replace function private.validate_project_payment_allocation() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_pay public.project_payments%rowtype;
  v_inv_total numeric;
  v_allocated numeric;
  v_inv_paid numeric;
begin
  select * into v_pay from public.project_payments where organization_id = new.organization_id and id = new.payment_id for update;
  perform 1 from public.project_invoices where organization_id = new.organization_id and id = new.invoice_id for update;
  select coalesce(sum(subtotal + tax_amount), 0) - (select discount from public.project_invoices where id = new.invoice_id)
    into v_inv_total from public.project_invoice_lines where invoice_id = new.invoice_id;
  select coalesce(sum(amount), 0) into v_allocated from public.project_payment_allocations where payment_id = new.payment_id and id is distinct from new.id;
  select coalesce(sum(amount), 0) into v_inv_paid from public.project_payment_allocations where invoice_id = new.invoice_id and id is distinct from new.id;
  if v_allocated + new.amount > v_pay.amount then raise exception 'Allocations exceed the payment amount' using errcode = '23514'; end if;
  if v_inv_paid + new.amount > v_inv_total then raise exception 'Allocation exceeds the invoice balance' using errcode = '23514'; end if;
  return new;
end $$;
create trigger project_payment_allocations_validate before insert or update on public.project_payment_allocations
  for each row execute function private.validate_project_payment_allocation();

create table public.project_change_orders (
  id                   uuid primary key default gen_random_uuid(),
  organization_id      uuid not null,
  project_id           uuid not null,
  co_number            text not null,
  description          text not null,
  reason               text,
  requested_by         text,
  date_requested       date not null default current_date,
  cost_delta           numeric(14,2) not null default 0,
  schedule_impact_days integer not null default 0,
  approval_status      text not null default 'draft' check (approval_status in ('draft', 'pending_approval', 'approved', 'rejected', 'cancelled')),
  approver_id          uuid references public.profiles (id) on delete set null,
  approval_date        date,
  rejection_reason     text,
  unique (organization_id, project_id, co_number),
  foreign key (organization_id, project_id) references public.projects (organization_id, id) on delete cascade
);
create table public.project_quotes (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null,
  project_id       uuid not null,
  vendor_id        uuid not null,
  quote_number     text not null,
  issue_date       date not null,
  expiry_date      date,
  description      text,
  subtotal         numeric(14,2) not null check (subtotal >= 0),
  tax_rate         numeric(6,3) not null default 0 check (tax_rate between 0 and 100),
  tax              numeric(14,2) not null default 0 check (tax >= 0),
  total            numeric(14,2) generated always as (subtotal + tax) stored,
  status           text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'expired')),
  unique (organization_id, project_id, quote_number),
  check (expiry_date is null or expiry_date >= issue_date),
  foreign key (organization_id, project_id) references public.projects (organization_id, id) on delete cascade,
  foreign key (organization_id, vendor_id) references public.vendors (organization_id, id) on delete restrict
);
create table public.project_milestones (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null,
  project_id          uuid not null,
  name                text not null,
  description         text,
  planned_date        date not null,
  actual_date         date,
  status              text not null default 'pending' check (status in ('pending', 'in_progress', 'completed')),
  responsible         text,
  notes               text,
  requires_inspection boolean not null default false,
  foreign key (organization_id, project_id) references public.projects (organization_id, id) on delete cascade
);
create index project_milestones_project_idx on public.project_milestones (organization_id, project_id, planned_date);
create table public.project_inspections (
  id                   uuid primary key default gen_random_uuid(),
  organization_id      uuid not null,
  project_id           uuid not null,
  task_id              uuid,
  inspection_type      text not null,
  inspection_date      date not null,
  inspector            text,
  checklist            jsonb not null default '[]'::jsonb check (jsonb_typeof(checklist) = 'array'),    -- [{label, passed}]
  result               text not null default 'scheduled' check (result in ('scheduled', 'pass', 'fail', 'conditional')),
  findings             text,
  corrective_actions   text,
  reinspection_date    date,
  notes                text,
  unique (organization_id, id),
  foreign key (organization_id, project_id) references public.projects (organization_id, id) on delete cascade,
  foreign key (organization_id, task_id) references public.project_tasks (organization_id, id) on delete set null (task_id)
);
create table public.project_deficiencies (
  id                   uuid primary key default gen_random_uuid(),
  organization_id      uuid not null,
  project_id           uuid not null,
  inspection_id        uuid,
  description          text not null,
  severity             text not null default 'medium' check (severity in ('low', 'medium', 'high', 'critical')),
  assigned_to          text,
  due_date             date,
  status               text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'verified')),
  resolution_notes     text,
  completion_evidence  text,
  reinspection_date    date,
  foreign key (organization_id, project_id) references public.projects (organization_id, id) on delete cascade,
  foreign key (organization_id, inspection_id) references public.project_inspections (organization_id, id) on delete set null (inspection_id)
);
create index project_deficiencies_open_idx on public.project_deficiencies (organization_id, project_id) where status in ('open', 'in_progress');

-- ---------------------------------------------------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['assets', 'maintenance_requests', 'maintenance_work_orders', 'maintenance_schedules', 'projects', 'project_tasks'] loop
    execute format('create trigger %I before update on public.%I for each row execute function private.set_updated_at()', t || '_updated_at', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------------------------------------------------
-- Row-Level Security
-- ---------------------------------------------------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['assets', 'maintenance_requests', 'maintenance_request_completions', 'maintenance_work_orders', 'maintenance_estimates',
                            'maintenance_visits', 'maintenance_work_logs', 'maintenance_schedules', 'maintenance_schedule_checklist_items'] loop
    execute format('call private.apply_org_policies(%L, %L, %L)', 'public.' || t, 'view_maintenance', 'manage_maintenance');
  end loop;
  foreach t in array array['projects', 'project_tenant_notifications', 'project_team_members', 'project_tasks', 'project_task_dependencies', 'project_invoices',
                            'project_invoice_lines', 'project_purchase_orders', 'project_expenses', 'project_payments', 'project_payment_allocations',
                            'project_change_orders', 'project_quotes', 'project_milestones', 'project_inspections', 'project_deficiencies'] loop
    execute format('call private.apply_org_policies(%L, %L, %L)', 'public.' || t, 'view_projects', 'manage_projects');
  end loop;
end $$;

commit;
