-- =====================================================================================================================
-- 009_reference_data.sql
-- Mandatory reference data (safe to re-run): the permission catalog, role defaults, and the real body of
-- private.seed_organization_defaults() which gives every new organization a starter chart of accounts and expense categories.
-- Optional fictional fixtures live in database/seed/development_seed.sql and are NOT part of the migrations.
-- =====================================================================================================================
begin;
set local search_path = public, extensions;

-- ---------------------------------------------------------------------------------------------------------------------
-- Permission catalog (area, key, label). Keys are referenced by every RLS policy.
-- ---------------------------------------------------------------------------------------------------------------------
insert into public.permissions (key, area, label, description) values
  ('view_settings',        'settings',       'View organization settings',  'Read workspace configuration'),
  ('manage_settings',      'settings',       'Manage organization settings','Change organization profile and general/security settings'),
  ('manage_members',       'settings',       'Manage members & roles',      'Invite users, change roles, suspend or remove members'),
  ('view_properties',      'portfolio',      'View properties & units',     'Read properties, units, owners and vendors'),
  ('manage_properties',    'portfolio',      'Manage properties & units',   'Create and edit properties, units and owners'),
  ('manage_vendors',       'portfolio',      'Manage vendors',              'Create and edit vendors and contractors'),
  ('view_tenants',         'tenancy',        'View tenants & leases',       'Read tenants, applications and leases'),
  ('manage_tenants',       'tenancy',        'Manage tenants & leases',     'Create and edit tenants, applications and leases'),
  ('view_sensitive',       'tenancy',        'View sensitive data',         'Identity documents, dates of birth, tax identifiers, sensitive documents'),
  ('view_finance',         'finance',        'View financial records',      'Invoices, payments, expenses, bills, bank and accounting records'),
  ('manage_finance',       'finance',        'Manage financial records',    'Create invoices/payments/expenses, post journal entries, reconcile'),
  ('view_maintenance',     'operations',     'View maintenance',            'Requests, work orders, assets and schedules'),
  ('manage_maintenance',   'operations',     'Manage maintenance',          'Create and update maintenance records'),
  ('view_projects',        'operations',     'View projects',               'Read renovation and improvement projects'),
  ('manage_projects',      'operations',     'Manage projects',             'Create and update projects and project finances'),
  ('view_documents',       'documents',      'View documents',              'Read non-sensitive documents and signature requests'),
  ('upload_documents',     'documents',      'Upload documents',            'Upload files and link them to records'),
  ('manage_documents',     'documents',      'Manage documents',            'Edit, archive, delete documents; manage signature requests'),
  ('view_communications',  'communication',  'View communications',         'Templates, messages, delivery history, workflows'),
  ('manage_communications','communication',  'Manage communications',       'Edit templates, send messages, manage workflows and scheduled tasks'),
  ('export_data',          'data',           'Export organization data',    'Export configuration and reference data'),
  ('view_audit_log',       'audit',          'View audit log',              'Read the activity log and verify its integrity')
on conflict (key) do update set area = excluded.area, label = excluded.label, description = excluded.description;

-- Role defaults. Owner is implicit (always allowed), so it needs no rows.
insert into public.role_permissions (role, permission)
select r.role, p.key
  from (values
    ('administrator', null),                                   -- null = every permission
    ('property_manager', 'view_settings'), ('property_manager', 'view_properties'), ('property_manager', 'manage_properties'), ('property_manager', 'manage_vendors'),
    ('property_manager', 'view_tenants'), ('property_manager', 'manage_tenants'), ('property_manager', 'view_sensitive'), ('property_manager', 'view_finance'),
    ('property_manager', 'view_maintenance'), ('property_manager', 'manage_maintenance'), ('property_manager', 'view_projects'), ('property_manager', 'manage_projects'),
    ('property_manager', 'view_documents'), ('property_manager', 'upload_documents'), ('property_manager', 'manage_documents'),
    ('property_manager', 'view_communications'), ('property_manager', 'manage_communications'), ('property_manager', 'export_data'),
    ('accountant', 'view_settings'), ('accountant', 'view_properties'), ('accountant', 'manage_vendors'), ('accountant', 'view_tenants'), ('accountant', 'view_finance'),
    ('accountant', 'manage_finance'), ('accountant', 'view_maintenance'), ('accountant', 'view_projects'), ('accountant', 'view_documents'),
    ('accountant', 'upload_documents'), ('accountant', 'view_communications'), ('accountant', 'export_data'), ('accountant', 'view_audit_log'),
    ('maintenance_staff', 'view_settings'), ('maintenance_staff', 'view_properties'), ('maintenance_staff', 'manage_vendors'), ('maintenance_staff', 'view_maintenance'),
    ('maintenance_staff', 'manage_maintenance'), ('maintenance_staff', 'view_documents'), ('maintenance_staff', 'upload_documents'),
    ('read_only', 'view_settings'), ('read_only', 'view_properties'), ('read_only', 'view_tenants'), ('read_only', 'view_finance'), ('read_only', 'view_maintenance'),
    ('read_only', 'view_projects'), ('read_only', 'view_documents'), ('read_only', 'view_communications'), ('read_only', 'view_audit_log')
  ) as r (role, permission)
  join public.permissions p on r.permission is null or p.key = r.permission
on conflict do nothing;

-- ---------------------------------------------------------------------------------------------------------------------
-- Starter chart of accounts + expense categories for a new organization (mirrors the structure of the Chart of Accounts screen).
-- Idempotent: only creates what is missing, so re-running never duplicates or overwrites an organization's changes.
-- ---------------------------------------------------------------------------------------------------------------------
-- The starter chart, as data (code, name, type, role, parent code, classification, system key, contra account?).
create or replace function private.default_chart()
returns table (code text, name text, account_type text, role text, parent_code text, classification text, system_key text, contra boolean)
language sql immutable set search_path = '' as $$
  select * from (values
    ('1000','Assets','asset','group',null,'Current Asset',null,false),
        ('1100','Current Assets','asset','group','1000','Current Asset',null,false),
        ('1101','Operating Bank Account','asset','posting','1100','Current Asset','operating_bank',false),
        ('1102','Trust Bank Account','asset','posting','1100','Trust Asset','trust_bank',false),
        ('1110','Accounts Receivable','asset','group','1100','Current Asset',null,false),
        ('1111','Tenant Rent Receivable','asset','posting','1110','Current Asset','accounts_receivable',false),
        ('1112','Other Receivables','asset','posting','1110','Current Asset',null,false),
        ('1113','Allowance for Doubtful Accounts','asset','posting','1110','Contra Asset',null,true),
        ('1120','Prepaid Expenses','asset','posting','1100','Current Asset',null,false),
        ('1140','GST/HST Input Tax Credits Receivable','asset','posting','1100','Current Asset','tax_receivable',false),
        ('1200','Non-Current Assets','asset','group','1000','Non-Current Asset',null,false),
        ('1211','Computer and Office Equipment','asset','posting','1200','Non-Current Asset',null,false),
        ('1220','Accumulated Depreciation','asset','posting','1200','Contra Asset',null,true),
        ('2000','Liabilities','liability','group',null,'Current Liability',null,false),
        ('2100','Current Liabilities','liability','group','2000','Current Liability',null,false),
        ('2101','Accounts Payable','liability','posting','2100','Current Liability','accounts_payable',false),
        ('2102','Accrued Expenses','liability','posting','2100','Current Liability',null,false),
        ('2103','GST/HST Payable','liability','posting','2100','Current Liability','sales_tax_payable',false),
        ('2110','Tenant Security Deposits Payable','liability','posting','2100','Trust Liability','tenant_deposits',false),
        ('2120','Prepaid Rent and Tenant Credits','liability','posting','2100','Current Liability','tenant_credits',false),
        ('2130','Deposit Interest Payable','liability','posting','2100','Current Liability','deposit_interest_payable',false),
        ('2200','Long-Term Liabilities','liability','group','2000','Long-Term Liability',null,false),
        ('2201','Mortgage Payable','liability','posting','2200','Long-Term Liability',null,false),
        ('3000','Equity','equity','group',null,null,null,false),
        ('3110','Owner Contributions','equity','posting','3000',null,null,false),
        ('3120','Owner Drawings','equity','posting','3000',null,null,true),
        ('3200','Retained Earnings','equity','posting','3000',null,'retained_earnings',false),
        ('4000','Income','revenue','group',null,null,null,false),
        ('4100','Rental Income','revenue','group','4000',null,null,false),
        ('4110','Residential Rent Revenue','revenue','posting','4100',null,'rent_income',false),
        ('4120','Commercial Rent Revenue','revenue','posting','4100',null,null,false),
        ('4130','Parking and Locker Revenue','revenue','posting','4100',null,null,false),
        ('4150','Rent Discounts and Adjustments','revenue','posting','4100','Contra Revenue','rent_discounts',true),
        ('4400','Late Payment Fees','revenue','posting','4000',null,'late_fees',false),
        ('4500','Tenant Utility Billings','revenue','posting','4000',null,null,false),
        ('5000','Direct Property and Operating Expenses','operating_cost','group',null,null,null,false),
        ('5110','Repairs and Maintenance — General','operating_cost','posting','5000',null,null,false),
        ('5120','Landscaping and Snow Removal','operating_cost','posting','5000',null,null,false),
        ('5130','Janitorial and Cleaning','operating_cost','posting','5000',null,null,false),
        ('5140','Pest Control','operating_cost','posting','5000',null,null,false),
        ('5210','Electricity','operating_cost','posting','5000',null,null,false),
        ('5220','Natural Gas','operating_cost','posting','5000',null,null,false),
        ('5230','Water and Sewer','operating_cost','posting','5000',null,null,false),
        ('5300','Property Insurance','operating_cost','posting','5000',null,null,false),
        ('5400','Property Taxes','operating_cost','posting','5000',null,null,false),
        ('6000','Administrative and Other Expenses','administrative_expense','group',null,null,null,false),
        ('6200','Office Expenses','administrative_expense','posting','6000',null,null,false),
        ('6310','Legal Fees','administrative_expense','posting','6000',null,null,false),
        ('6320','Accounting and Audit Fees','administrative_expense','posting','6000',null,null,false),
        ('6400','Software and Subscriptions','administrative_expense','posting','6000',null,null,false),
        ('6600','Bank Charges and Merchant Fees','administrative_expense','posting','6000',null,null,false),
        ('6700','Marketing and Leasing Signage','administrative_expense','posting','6000',null,null,false),
        ('7000','Other Income','other_income','group',null,null,null,false),
        ('7100','Interest Income — Operating','other_income','posting','7000',null,null,false),
        ('7200','Interest Income — Trust Account','other_income','posting','7000',null,null,false),
        ('8000','Other Expenses','other_expense','group',null,null,null,false),
        ('8100','Mortgage Interest Expense','other_expense','posting','8000',null,null,false),
        ('8200','Depreciation Expense','other_expense','posting','8000',null,null,false)
  ) as t (code, name, account_type, role, parent_code, classification, system_key, contra);
$$;
revoke all on function private.default_chart() from public, anon;

create or replace function private.seed_organization_defaults(p_org uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  -- 1) the accounts (parents are linked in step 2 so the insert order does not matter). Control accounts (AR, AP, tenant deposits/credits)
  --    are fed only by invoices, payments and bills, so they refuse manual journal postings.
  insert into public.accounts (organization_id, code, name, account_type, classification, normal_balance, role, allow_direct_posting, system_key, sort_order)
  select p_org, s.code, s.name, s.account_type, s.classification,
         case when (s.account_type in ('asset', 'operating_cost', 'administrative_expense', 'other_expense')) <> s.contra then 'debit' else 'credit' end,
         s.role, coalesce(s.system_key not in ('accounts_receivable', 'accounts_payable', 'tenant_deposits', 'tenant_credits'), true), s.system_key, s.code::int
    from private.default_chart() s
  on conflict (organization_id, code) do nothing;

  -- 2) the hierarchy
  update public.accounts a set parent_id = pa.id
    from private.default_chart() s join public.accounts pa on pa.organization_id = p_org and pa.code = s.parent_code
   where a.organization_id = p_org and a.code = s.code and a.parent_id is null and s.parent_code is not null;

  -- 3) expense categories mapped to their default GL account
  insert into public.expense_categories (organization_id, name, account_id)
  select p_org, c.name, a.id
    from (values ('Repairs & Maintenance', '5110'), ('Landscaping & Snow Removal', '5120'), ('Cleaning', '5130'), ('Pest Control', '5140'),
                 ('Electricity', '5210'), ('Gas', '5220'), ('Water & Sewer', '5230'), ('Insurance', '5300'), ('Property Taxes', '5400'),
                 ('Office', '6200'), ('Legal', '6310'), ('Accounting', '6320'), ('Software', '6400'), ('Bank Charges', '6600'), ('Marketing', '6700')) as c (name, code)
    join public.accounts a on a.organization_id = p_org and a.code = c.code
  on conflict (organization_id, name) do nothing;
end $$;
revoke all on function private.seed_organization_defaults(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------------------------------
-- Lock-down of schema private: nothing is executable by PUBLIC/anon; only the few helpers that RLS policies and invoker-rights
-- functions call are granted to authenticated. Everything else (log_activity, seed_organization_defaults, trigger functions ...) stays
-- internal. Re-run this block after adding a new helper to schema private.
-- ---------------------------------------------------------------------------------------------------------------------
revoke execute on all routines in schema private from public, anon, authenticated;
grant execute on function private.is_org_member(uuid), private.org_role(uuid), private.has_permission(uuid, text), private.shares_org_with(uuid),
                          private.setting_edit_permission(text), private.next_number(uuid, text), private.invoice_total(uuid),
                          private.can_see_conversation(uuid, uuid), private.storage_org(text), private.storage_object_registered(text, text),
                          private.activity_event_hash(public.activity_events) to authenticated;
grant execute on all routines in schema private to service_role;

commit;
