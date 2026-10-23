-- =====================================================================================================================
-- data_integrity_validation.sql
-- Behavioural tests of the database-level business rules: tenant isolation (composite FKs), lease occupancy, journal posting and
-- immutability, invoices, payments, allocations, credits, recurring billing, bills, reconciliation, audit hash chain, membership
-- guards, documents/signatures, scheduled tasks and workflow de-duplication.
-- Run on a FRESH database after schema_validation.sql (it creates the helpers). Creates fictional fixtures; never run on real data.
-- =====================================================================================================================
delete from public.test_results where suite = 'integrity';

insert into auth.users (id, email, raw_user_meta_data) values
  ('a0000000-0000-4000-8000-000000000001', 'owner.a@example.test', '{"full_name": "Olivia Owner"}'),
  ('a0000000-0000-4000-8000-000000000002', 'pm.a@example.test',    '{"name": "Pat Manager"}'),
  ('a0000000-0000-4000-8000-000000000003', 'acct.a@example.test',  '{}'),
  ('a0000000-0000-4000-8000-000000000004', 'maint.a@example.test', '{}'),
  ('a0000000-0000-4000-8000-000000000005', 'ro.a@example.test',    '{}'),
  ('a0000000-0000-4000-8000-000000000006', 'admin.a@example.test', '{}'),
  ('b0000000-0000-4000-8000-000000000001', 'owner.b@example.test', '{"full_name": "Bob Owner"}'),
  ('c0000000-0000-4000-8000-000000000001', 'outsider@example.test', '{}');

do $$
declare
  v_a uuid; v_b uuid;
  v_owner_a uuid := 'a0000000-0000-4000-8000-000000000001';
  v_owner_b uuid := 'b0000000-0000-4000-8000-000000000001';
begin
  -- signup trigger ------------------------------------------------------------------------------------------------------
  perform public.test_check('integrity', 'signup creates a profile per auth user', (select count(*) from public.profiles) = 8);
  perform public.test_check('integrity', 'profile name comes from user metadata (full_name / name / email prefix)',
    (select full_name from public.profiles where id = v_owner_a) = 'Olivia Owner'
    and (select full_name from public.profiles where id = 'a0000000-0000-4000-8000-000000000002') = 'Pat Manager'
    and (select full_name from public.profiles where id = 'a0000000-0000-4000-8000-000000000003') = 'acct.a');
  perform public.test_check('integrity', 'signup creates default user preferences', (select count(*) from public.user_preferences) = 8);

  -- onboarding ------------------------------------------------------------------------------------------------------------
  perform public.test_login(v_owner_a);
  v_a := public.create_organization('Alpha Rentals', 'property_management_company', 'Canada', 'CAD', 'America/Toronto');
  perform public.test_logout();
  perform public.test_login(v_owner_b);
  v_b := public.create_organization('Bravo Homes', 'individual_landlord', 'United States', 'USD', 'America/Chicago');
  perform public.test_logout();
  perform public.test_set('org_a', v_a::text); perform public.test_set('org_b', v_b::text);
  perform public.test_check('integrity', 'create_organization makes the caller the owner',
    (select role from public.organization_members where organization_id = v_a and user_id = v_owner_a) = 'owner');
  perform public.test_check('integrity', 'create_organization seeds the starter chart of accounts and categories',
    (select count(*) from public.accounts where organization_id = v_a) >= 55 and (select count(*) from public.expense_categories where organization_id = v_a) = 15);
  perform public.test_check('integrity', 'starter chart has the system accounts used by posting functions',
    (select count(*) from public.accounts where organization_id = v_a and system_key in ('accounts_receivable','rent_income','sales_tax_payable','tenant_credits','rent_discounts','operating_bank')) = 6);
  perform public.test_check('integrity', 'starter chart hierarchy is linked (Tenant Rent Receivable under Accounts Receivable)',
    (select p.code from public.accounts c join public.accounts p on p.id = c.parent_id where c.organization_id = v_a and c.code = '1111') = '1110');
  perform public.test_check('integrity', 'contra accounts carry the opposite normal balance',
    (select normal_balance from public.accounts where organization_id = v_a and code = '4150') = 'debit');
  perform public.test_check('integrity', 'user preferences remember the active organization', (select active_organization_id from public.user_preferences where user_id = v_owner_a) = v_a);
  perform public.test_check('integrity', 'organization creation is written to the audit trail', (select count(*) from public.activity_events where organization_id = v_a) >= 1);

  insert into public.organization_members (organization_id, user_id, role) values
    (v_a, 'a0000000-0000-4000-8000-000000000002', 'property_manager'),
    (v_a, 'a0000000-0000-4000-8000-000000000003', 'accountant'),
    (v_a, 'a0000000-0000-4000-8000-000000000004', 'maintenance_staff'),
    (v_a, 'a0000000-0000-4000-8000-000000000005', 'read_only'),
    (v_a, 'a0000000-0000-4000-8000-000000000006', 'administrator');

  -- fixtures ----------------------------------------------------------------------------------------------------------------
  insert into public.properties (id, organization_id, name, address_line1, city) values
    ('11111111-0000-4000-8000-000000000001', v_a, 'Cedar Court', '148 Cedar Ave', 'Toronto'),
    ('11111111-0000-4000-8000-000000000002', v_a, 'Harbor House', '72 Harbor St', 'Toronto'),
    ('11111111-0000-4000-8000-0000000000b1', v_b, 'Bravo Tower', '1 Main St', 'Chicago');
  insert into public.units (id, organization_id, property_id, unit_number, unit_status, market_rent) values
    ('22222222-0000-4000-8000-000000000001', v_a, '11111111-0000-4000-8000-000000000001', '101', 'vacant', 1800),
    ('22222222-0000-4000-8000-000000000002', v_a, '11111111-0000-4000-8000-000000000001', '102', 'vacant', 1850),
    ('22222222-0000-4000-8000-0000000000b1', v_b, '11111111-0000-4000-8000-0000000000b1', '1A', 'vacant', 2000);
  insert into public.tenants (id, organization_id, first_name, last_name, email) values
    ('33333333-0000-4000-8000-000000000001', v_a, 'Ava', 'Thompson', 'ava@example.test'),
    ('33333333-0000-4000-8000-000000000002', v_a, 'Mateo', 'Rivera', 'mateo@example.test'),
    ('33333333-0000-4000-8000-0000000000b1', v_b, 'Bea', 'Baker', 'bea@example.test');
  perform public.test_check('integrity', 'tenant numbers are generated per organization (TEN-0001...)',
    (select array_agg(tenant_number order by tenant_number) from public.tenants where organization_id = v_a) = array['TEN-0001','TEN-0002']
    and (select tenant_number from public.tenants where organization_id = v_b) = 'TEN-0001');
  insert into public.bank_accounts (id, organization_id, name, gl_account_id, last4)
    select '44444444-0000-4000-8000-000000000001', v_a, 'Operating', id, '4821' from public.accounts where organization_id = v_a and code = '1101';
end $$;

-- ===================================================================================================================
-- Tenant isolation: a row can never reference another organization's record
-- ===================================================================================================================
do $$
declare
  v_a uuid := public.test_uuid('org_a'); v_b uuid := public.test_uuid('org_b');
  v_err text;
begin
  v_err := public.test_err(format($q$insert into public.units (organization_id, property_id, unit_number) values (%L, '11111111-0000-4000-8000-0000000000b1', 'X1')$q$, v_a));
  perform public.test_check('integrity', 'unit cannot attach to a property of another organization (composite FK)', v_err like '23503%', v_err);
  v_err := public.test_err(format($q$insert into public.leases (organization_id, start_date, end_date) values (%L, '2026-01-01', '2026-12-31')$q$, v_a));
  perform public.test_check('integrity', 'a lease can be created for the right organization', v_err is null, v_err);
  v_err := public.test_err(format($q$insert into public.lease_units (organization_id, lease_id, unit_id, start_date) select %L, id, '22222222-0000-4000-8000-0000000000b1', '2026-01-01' from public.leases where organization_id = %L$q$, v_a, v_a));
  perform public.test_check('integrity', 'lease cannot cover a unit of another organization', v_err like '23503%', v_err);
  v_err := public.test_err(format($q$insert into public.lease_parties (organization_id, lease_id, tenant_id) select %L, id, '33333333-0000-4000-8000-0000000000b1' from public.leases where organization_id = %L limit 1$q$, v_a, v_a));
  perform public.test_check('integrity', 'lease cannot include a tenant of another organization', v_err like '23503%', v_err);
  v_err := public.test_err(format($q$insert into public.invoices (organization_id, tenant_id, due_date) values (%L, '33333333-0000-4000-8000-0000000000b1', current_date)$q$, v_a));
  perform public.test_check('integrity', 'invoice cannot bill a tenant of another organization', v_err like '23503%', v_err);
end $$;

-- ===================================================================================================================
-- Leases: occupancy cannot overlap
-- ===================================================================================================================
do $$
declare
  v_a uuid := public.test_uuid('org_a');
  v_l1 uuid := gen_random_uuid(); v_l2 uuid := gen_random_uuid(); v_l3 uuid := gen_random_uuid();
  v_u1 uuid := '22222222-0000-4000-8000-000000000001'; v_u2 uuid := '22222222-0000-4000-8000-000000000002';
  v_t1 uuid := '33333333-0000-4000-8000-000000000001'; v_t2 uuid := '33333333-0000-4000-8000-000000000002';
  v_err text;
begin
  delete from public.leases where organization_id = v_a;      -- remove the probe lease above
  insert into public.leases (id, organization_id, lease_number, start_date, end_date, agreed_monthly_rent, rent_due_day, status) values
    (v_l1, v_a, null, '2026-01-01', '2026-12-31', 1800, 1, 'draft'),
    (v_l2, v_a, null, '2026-06-01', '2027-05-31', 1800, 1, 'draft'),
    (v_l3, v_a, null, '2027-01-01', '2027-12-31', 1850, 1, 'draft');
  perform public.test_check('integrity', 'lease numbers are generated and unique (LSE-nnnnn)', (select count(distinct lease_number) from public.leases where organization_id = v_a and lease_number ~ '^LSE-[0-9]{5}$') = 3);
  insert into public.lease_units (organization_id, lease_id, unit_id, allocated_monthly_rent, start_date, end_date) values
    (v_a, v_l1, v_u1, 1800, '2026-01-01', '2026-12-31'),
    (v_a, v_l2, v_u1, 1800, '2026-06-01', '2027-05-31'),     -- overlaps lease 1 but both are drafts
    (v_a, v_l3, v_u2, 1850, '2027-01-01', '2027-12-31');
  insert into public.lease_parties (organization_id, lease_id, tenant_id, role, is_primary_contact, is_signatory) values
    (v_a, v_l1, v_t1, 'main_tenant', true, true), (v_a, v_l2, v_t2, 'main_tenant', true, true), (v_a, v_l3, v_t2, 'main_tenant', true, true);
  perform public.test_set('lease_1', v_l1::text); perform public.test_set('lease_2', v_l2::text); perform public.test_set('lease_3', v_l3::text);

  update public.leases set status = 'active' where id = v_l1;
  perform public.test_check('integrity', 'activating a lease marks its unit rows as occupying', (select is_occupying from public.lease_units where lease_id = v_l1));
  v_err := public.test_err(format($q$update public.leases set status = 'active' where id = %L$q$, v_l2));
  perform public.test_check('integrity', 'a second active lease on overlapping dates for the same unit is rejected (exclusion constraint)', v_err like '23P01%', v_err);
  update public.leases set status = 'terminated', terminated_on = '2026-05-31' where id = v_l1;
  update public.lease_units set end_date = '2026-05-31' where lease_id = v_l1;
  v_err := public.test_err(format($q$update public.leases set status = 'active' where id = %L$q$, v_l2));
  perform public.test_check('integrity', 'once the first lease has ended the next lease can start', v_err is null, v_err);
  update public.units set allow_multiple_active_leases = true where id = v_u2;
  v_err := public.test_err(format($q$insert into public.lease_units (organization_id, lease_id, unit_id, start_date) select %L, %L, %L, '2027-02-01' $q$, v_a, v_l2, v_u2));
  perform public.test_check('integrity', 'units that allow multiple active leases accept overlapping ones', v_err is null, v_err);
  v_err := public.test_err(format($q$update public.lease_units set end_date = '2025-01-01' where lease_id = %L$q$, v_l2));
  perform public.test_check('integrity', 'lease unit end date cannot precede its start (check)', v_err like '23514%', v_err);
  v_err := public.test_err(format($q$insert into public.lease_parties (organization_id, lease_id, tenant_id, role, is_primary_contact) values (%L, %L, %L, 'co_tenant', true)$q$, v_a, v_l2, v_t1));
  perform public.test_check('integrity', 'only one current primary contact per lease', v_err like '23505%', v_err);
  perform public.test_check('integrity', 'current occupancy view shows the active tenant', (select count(*) from public.v_current_occupancy where lease_id = v_l2 and tenant_id = v_t2) >= 1);
end $$;

-- ===================================================================================================================
-- Journal: balanced, posted once, immutable, reversible, period lock
-- ===================================================================================================================
do $$
declare
  v_a uuid := public.test_uuid('org_a');
  v_owner uuid := 'a0000000-0000-4000-8000-000000000001';
  v_bank uuid; v_income uuid; v_group uuid; v_nodirect uuid;
  v_entry uuid; v_rev uuid; v_err text;
begin
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  select id into v_bank from public.accounts where organization_id = v_a and code = '1101';
  select id into v_income from public.accounts where organization_id = v_a and code = '4110';
  select id into v_group from public.accounts where organization_id = v_a and code = '4100';
  select id into v_nodirect from public.accounts where organization_id = v_a and code = '1111';   -- system account: no manual posting

  v_err := public.test_err(format($q$select public.create_journal_entry(%L, current_date, 'unbalanced', jsonb_build_array(
      jsonb_build_object('account_id', %L, 'debit', 100), jsonb_build_object('account_id', %L, 'credit', 90)))$q$, v_a, v_bank, v_income));
  perform public.test_check('integrity', 'an unbalanced entry cannot be posted', v_err like '23514%' and v_err like '%balance%', v_err);
  v_err := public.test_err(format($q$select public.create_journal_entry(%L, current_date, 'group', jsonb_build_array(
      jsonb_build_object('account_id', %L, 'debit', 100), jsonb_build_object('account_id', %L, 'credit', 100)))$q$, v_a, v_bank, v_group));
  perform public.test_check('integrity', 'group (non-posting) accounts cannot be posted to', v_err like '23514%', v_err);
  v_err := public.test_err(format($q$select public.create_journal_entry(%L, current_date, 'system', jsonb_build_array(
      jsonb_build_object('account_id', %L, 'debit', 100), jsonb_build_object('account_id', %L, 'credit', 100)))$q$, v_a, v_nodirect, v_income));
  perform public.test_check('integrity', 'accounts that disallow manual posting are refused on manual entries', v_err like '23514%', v_err);
  insert into public.journal_entries (id, organization_id, entry_date, memo) values ('55555555-0000-4000-8000-000000000001', v_a, current_date, 'draft probe');
  v_err := public.test_err(format($q$insert into public.journal_entry_lines (organization_id, entry_id, account_id, debit, credit, entry_date)
      values (%L, '55555555-0000-4000-8000-000000000001', %L, 5, 5, current_date)$q$, v_a, v_bank));
  perform public.test_check('integrity', 'a journal line with both debit and credit is rejected', v_err like '23514%', v_err);
  delete from public.journal_entries where id = '55555555-0000-4000-8000-000000000001';
  perform public.test_check('integrity', 'a draft entry can be deleted', not exists (select 1 from public.journal_entries where id = '55555555-0000-4000-8000-000000000001'));

  v_entry := public.create_journal_entry(v_a, current_date, 'Opening rent', jsonb_build_array(
      jsonb_build_object('account_id', v_bank, 'debit', 250.50, 'memo', 'in'), jsonb_build_object('account_id', v_income, 'credit', 250.50, 'property_id', '11111111-0000-4000-8000-000000000001')));
  perform public.test_set('journal_1', v_entry::text);
  perform public.test_check('integrity', 'a balanced entry posts and gets a number', (select status from public.journal_entries where id = v_entry) = 'posted' and (select entry_number from public.journal_entries where id = v_entry) is not null);
  v_err := public.test_err(format($q$update public.journal_entry_lines set debit = 1 where entry_id = %L and debit > 0$q$, v_entry));
  perform public.test_check('integrity', 'lines of a posted entry cannot be edited', v_err like '42501%', v_err);
  v_err := public.test_err(format($q$delete from public.journal_entries where id = %L$q$, v_entry));
  perform public.test_check('integrity', 'a posted entry cannot be deleted', v_err like '42501%', v_err);
  v_err := public.test_err(format($q$update public.journal_entries set memo = 'tampered' where id = %L$q$, v_entry));
  perform public.test_check('integrity', 'a posted entry cannot be edited', v_err like '42501%', v_err);
  v_err := public.test_err(format($q$insert into public.journal_entry_lines (organization_id, entry_id, account_id, debit, entry_date) values (%L, %L, %L, 10, current_date)$q$, v_a, v_entry, v_bank));
  perform public.test_check('integrity', 'lines cannot be added to a posted entry', v_err like '42501%', v_err);

  v_rev := public.reverse_journal_entry(v_entry, current_date, 'Mistake');
  perform public.test_check('integrity', 'reversal posts a mirror entry and marks the original reversed',
    (select status from public.journal_entries where id = v_entry) = 'reversed' and (select status from public.journal_entries where id = v_rev) = 'posted'
    and (select sum(debit) - sum(credit) from public.journal_entry_lines where entry_id in (v_entry, v_rev)) = 0);
  v_err := public.test_err(format($q$select public.reverse_journal_entry(%L)$q$, v_entry));
  perform public.test_check('integrity', 'a reversed entry cannot be reversed again', v_err like '22023%', v_err);
  perform public.test_check('integrity', 'trial balance nets to zero after reversal', (select coalesce(sum(net_debit), 0) from public.v_trial_balance where organization_id = v_a) = 0);

  perform public.close_books(v_a, current_date);
  v_err := public.test_err(format($q$select public.create_journal_entry(%L, current_date, 'late', jsonb_build_array(
      jsonb_build_object('account_id', %L, 'debit', 1), jsonb_build_object('account_id', %L, 'credit', 1)))$q$, v_a, v_bank, v_income));
  perform public.test_check('integrity', 'posting inside a closed period is rejected', v_err like '23514%' and v_err like '%closed%', v_err);
  update public.organizations set books_closed_through = null where id = v_a;
  perform public.test_check('integrity', 'closing the books is written to the audit trail', exists (select 1 from public.activity_events where organization_id = v_a and description like 'Books closed through%'));
end $$;

-- ===================================================================================================================
-- Receivables: invoices, payments, allocations, credits
-- ===================================================================================================================
do $$
declare
  v_a uuid := public.test_uuid('org_a');
  v_owner uuid := 'a0000000-0000-4000-8000-000000000001';
  v_t1 uuid := '33333333-0000-4000-8000-000000000001'; v_t2 uuid := '33333333-0000-4000-8000-000000000002';
  v_bank uuid := '44444444-0000-4000-8000-000000000001';
  v_inv uuid; v_inv2 uuid; v_pay uuid; v_pay2 uuid; v_credit uuid; v_err text; v_n int;
  v_l1 uuid := public.test_uuid('lease_1'); v_l2 uuid := public.test_uuid('lease_2');
begin
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  insert into public.invoices (organization_id, tenant_id, lease_id, property_id, unit_id, invoice_type, due_date, issue_date)
    values (v_a, v_t1, v_l1, '11111111-0000-4000-8000-000000000001', '22222222-0000-4000-8000-000000000001', 'rent', current_date + 5, current_date) returning id into v_inv;
  insert into public.invoice_lines (organization_id, invoice_id, description, category, quantity, unit_price, tax_rate) values
    (v_a, v_inv, 'Monthly rent', 'rent', 1, 1000.00, 0), (v_a, v_inv, 'Parking', 'parking', 1, 100.00, 13);
  perform public.test_check('integrity', 'invoice numbers are generated per organization (INV-00001)', (select invoice_number from public.invoices where id = v_inv) = 'INV-00001');
  perform public.test_check('integrity', 'line subtotal and tax are computed by the database',
    (select sum(subtotal) from public.invoice_lines where invoice_id = v_inv) = 1100.00 and (select sum(tax_amount) from public.invoice_lines where invoice_id = v_inv) = 13.00);
  perform public.test_check('integrity', 'invoice balance view totals lines (1113.00 outstanding)', (select total from public.v_invoice_balances where invoice_id = v_inv) = 1113.00);
  v_err := public.test_err(format($q$insert into public.payment_allocations (organization_id, payment_id, invoice_id, amount) values (%L, gen_random_uuid(), %L, 10)$q$, v_a, v_inv));
  perform public.test_check('integrity', 'allocation to a missing payment is rejected', v_err is not null, v_err);

  perform public.issue_invoice(v_inv);
  perform public.test_check('integrity', 'issuing an invoice opens it and posts Dr AR / Cr income + tax',
    (select status from public.invoices where id = v_inv) = 'open' and (select journal_entry_id from public.invoices where id = v_inv) is not null
    and (select sum(debit) - sum(credit) from public.journal_entry_lines where entry_id = (select journal_entry_id from public.invoices where id = v_inv)) = 0
    and (select sum(debit) from public.journal_entry_lines where entry_id = (select journal_entry_id from public.invoices where id = v_inv)) = 1113.00);
  v_err := public.test_err(format($q$update public.invoice_lines set unit_price = 1 where invoice_id = %L$q$, v_inv));
  perform public.test_check('integrity', 'lines of an issued invoice are immutable', v_err like '42501%', v_err);
  v_err := public.test_err(format($q$update public.invoices set due_date = current_date + 90 where id = %L$q$, v_inv));
  perform public.test_check('integrity', 'dates of an issued invoice are immutable', v_err like '42501%', v_err);
  v_err := public.test_err(format($q$delete from public.invoices where id = %L$q$, v_inv));
  perform public.test_check('integrity', 'an issued invoice cannot be deleted', v_err like '42501%', v_err);

  -- payments
  v_pay := public.record_payment(v_a, v_t1, v_l1, current_date, 600.00, 'etransfer', 'REF-1', null, v_bank,
            jsonb_build_array(jsonb_build_object('invoice_id', v_inv, 'amount', 600.00)), true, 'idem-1');
  perform public.test_check('integrity', 'record_payment allocates and posts the ledger entry',
    (select allocated from public.v_payment_summary where payment_id = v_pay) = 600.00 and (select journal_entry_id from public.payments where id = v_pay) is not null);
  perform public.test_check('integrity', 'invoice is partially paid (derived)', (select derived_status from public.v_invoice_balances where invoice_id = v_inv) = 'partially_paid'
    and (select outstanding from public.v_invoice_balances where invoice_id = v_inv) = 513.00);
  perform public.test_check('integrity', 'record_payment is idempotent for the same key',
    public.record_payment(v_a, v_t1, v_l1, current_date, 600.00, 'etransfer', 'REF-1', null, v_bank, '[]'::jsonb, true, 'idem-1') = v_pay and (select count(*) from public.payments) = 1);
  v_err := public.test_err(format($q$select public.record_payment(%L, %L, %L, current_date, 100, 'cash', null, null, null, jsonb_build_array(jsonb_build_object('invoice_id', %L, 'amount', 600)))$q$, v_a, v_t1, v_l1, v_inv));
  perform public.test_check('integrity', 'allocations beyond the payment amount are rejected (and the whole payment rolls back)', v_err like '23514%', v_err);
  perform public.test_check('integrity', 'a failed record_payment leaves no partial rows', (select count(*) from public.payments) = 1);
  v_err := public.test_err(format($q$select public.record_payment(%L, %L, %L, current_date, 900, 'cash', null, null, null, jsonb_build_array(jsonb_build_object('invoice_id', %L, 'amount', 900)))$q$, v_a, v_t1, v_l1, v_inv));
  perform public.test_check('integrity', 'allocation beyond the invoice balance is rejected', v_err like '23514%' and v_err like '%invoice balance%', v_err);
  v_err := public.test_err(format($q$select public.record_payment(%L, %L, %L, current_date, 50, 'cash', null, null, null, jsonb_build_array(jsonb_build_object('invoice_id', %L, 'amount', 50)))$q$, v_a, v_t2, v_l2, v_inv));
  perform public.test_check('integrity', 'a payment cannot be applied to another tenant''s invoice', v_err like '23514%' and v_err like '%different tenants%', v_err);
  v_err := public.test_err(format($q$update public.payments set amount = 1 where id = %L$q$, v_pay));
  perform public.test_check('integrity', 'payment amounts cannot be edited', v_err like '42501%', v_err);
  v_err := public.test_err(format($q$delete from public.payments where id = %L$q$, v_pay));
  perform public.test_check('integrity', 'payments cannot be deleted', v_err like '42501%', v_err);
  v_err := public.test_err(format($q$delete from public.payment_allocations where payment_id = %L$q$, v_pay));
  perform public.test_check('integrity', 'payment allocations cannot be deleted', v_err like '42501%', v_err);

  -- overpayment -> credit note, refunds, applications
  v_pay2 := public.record_payment(v_a, v_t1, v_l1, current_date, 700.00, 'cash', null, null, v_bank,
            jsonb_build_array(jsonb_build_object('invoice_id', v_inv, 'amount', 513.00)), true);
  select id into v_credit from public.credit_notes where source_payment_id = v_pay2;
  perform public.test_check('integrity', 'the unapplied remainder becomes an open credit note', v_credit is not null and (select amount from public.credit_notes where id = v_credit) = 187.00);
  perform public.test_check('integrity', 'the invoice is paid in full', (select derived_status from public.v_invoice_balances where invoice_id = v_inv) = 'paid' and (select outstanding from public.v_invoice_balances where invoice_id = v_inv) = 0);
  perform public.test_check('integrity', 'the overpayment ledger entry balances', (select sum(debit) - sum(credit) from public.journal_entry_lines where entry_id = (select journal_entry_id from public.payments where id = v_pay2)) = 0);

  insert into public.invoices (organization_id, tenant_id, lease_id, due_date, status) values (v_a, v_t1, v_l1, current_date + 30, 'draft') returning id into v_inv2;
  insert into public.invoice_lines (organization_id, invoice_id, description, category, unit_price) values (v_a, v_inv2, 'Late fee', 'fees', 150.00);
  perform public.issue_invoice(v_inv2);
  v_err := public.test_err(format($q$select public.apply_credit_note(%L, %L, 200)$q$, v_credit, v_inv2));
  perform public.test_check('integrity', 'applying more than the remaining credit is rejected', v_err like '23514%' and v_err like '%remaining credit%', v_err);
  perform public.apply_credit_note(v_credit, v_inv2, 100.00);
  perform public.test_check('integrity', 'applying part of the credit works', (select remaining from public.v_credit_balances where credit_note_id = v_credit) = 87.00
    and (select outstanding from public.v_invoice_balances where invoice_id = v_inv2) = 50.00);
  v_err := public.test_err(format($q$select public.apply_credit_note(%L, %L, 80)$q$, v_credit, v_inv2));
  perform public.test_check('integrity', 'a credit cannot over-pay an invoice', v_err like '23514%' and v_err like '%invoice balance%', v_err);
  v_err := public.test_err(format($q$select public.reverse_payment(%L, 'bounced')$q$, v_pay2));
  perform public.test_check('integrity', 'a payment whose credit was already used cannot be reversed', v_err like '23514%', v_err);
  v_err := public.test_err(format($q$insert into public.payment_refunds (organization_id, payment_id, amount, reason) values (%L, %L, 500, 'too much')$q$, v_a, v_pay));
  perform public.test_check('integrity', 'refund cannot exceed the unapplied part of a payment', v_err like '23514%', v_err);
  v_err := public.test_err(format($q$update public.invoices set status = 'void' where id = %L$q$, v_inv2));
  perform public.test_check('integrity', 'an invoice with applied credit cannot be voided', v_err like '23514%', v_err);

  -- reversal
  perform public.reverse_payment(v_pay, 'NSF');
  perform public.test_check('integrity', 'reversing a payment reopens the invoice balance', (select outstanding from public.v_invoice_balances where invoice_id = v_inv) = 600.00
    and (select status from public.payments where id = v_pay) = 'reversed' and (select reversal_reason from public.payments where id = v_pay) = 'NSF');
  perform public.test_check('integrity', 'reversing a payment reverses its ledger entry', (select status from public.journal_entries where id = (select journal_entry_id from public.payments where id = v_pay)) = 'reversed');
  v_err := public.test_err(format($q$update public.payments set status = 'posted', reversed_at = null where id = %L$q$, v_pay));
  perform public.test_check('integrity', 'a reversed payment cannot be revived', v_err like '42501%', v_err);
  v_err := public.test_err(format($q$select public.reverse_payment(%L, '')$q$, v_pay));
  perform public.test_check('integrity', 'reversing twice is rejected', v_err like '22023%', v_err);
  v_err := public.test_err(format($q$update public.invoices set status = 'void' where id = %L$q$, v_inv));
  perform public.test_check('integrity', 'an invoice that still carries a posted payment cannot be voided', v_err like '23514%', v_err);
end $$;

-- ===================================================================================================================
-- Recurring billing: one rent invoice per lease and period
-- ===================================================================================================================
do $$
declare
  v_a uuid := public.test_uuid('org_a');
  v_first int; v_second int; v_err text;
begin
  perform set_config('request.jwt.claim.sub', 'a0000000-0000-4000-8000-000000000001', true);
  v_first := public.generate_rent_invoices(v_a, date '2026-09-01');
  v_second := public.generate_rent_invoices(v_a, date '2026-09-01');
  perform public.test_check('integrity', 'generate_rent_invoices creates one invoice per active lease', v_first = 1, v_first);
  perform public.test_check('integrity', 'running billing again for the same period creates nothing (no duplicates)', v_second = 0, v_second);
  perform public.test_check('integrity', 'generated invoice carries rent line and due date',
    (select count(*) from public.invoices i join public.invoice_lines l on l.invoice_id = i.id where i.billing_period_start = '2026-09-01' and l.category = 'rent' and l.unit_price = 1800) = 1);
  v_err := public.test_err(format($q$insert into public.invoices (organization_id, tenant_id, lease_id, invoice_type, due_date, billing_period_start)
      select %L, tenant_id, lease_id, 'rent', due_date, billing_period_start from public.invoices where billing_period_start = '2026-09-01' limit 1$q$, v_a));
  perform public.test_check('integrity', 'a manual duplicate rent invoice for the same period is rejected by the unique index', v_err like '23505%', v_err);
  perform public.test_check('integrity', 'a different billing period can be generated', public.generate_rent_invoices(v_a, date '2026-10-01') = 1);
end $$;

-- ===================================================================================================================
-- Payables and bank reconciliation
-- ===================================================================================================================
do $$
declare
  v_a uuid := public.test_uuid('org_a');
  v_vendor uuid := gen_random_uuid(); v_bill uuid := gen_random_uuid(); v_sched uuid := gen_random_uuid();
  v_bank uuid := '44444444-0000-4000-8000-000000000001'; v_err text; v_rec uuid; v_rec2 uuid;
begin
  insert into public.vendors (id, organization_id, company_name, vendor_type) values (v_vendor, v_a, 'Toronto Hydro', 'service_provider');
  insert into public.bills (id, organization_id, name, category, vendor_id, property_id, invoice_number, billing_period_start, billing_period_end, invoice_date, due_date, amount)
    values (v_bill, v_a, 'Hydro Sept', 'hydro', v_vendor, '11111111-0000-4000-8000-000000000001', 'H-1001', '2026-08-01', '2026-08-31', '2026-09-02', '2026-09-20', 300.00);
  perform public.test_check('integrity', 'bill numbers are generated (BILL-00001)', (select bill_number from public.bills where id = v_bill) = 'BILL-00001');
  v_err := public.test_err(format($q$insert into public.bills (organization_id, name, category, vendor_id, property_id, invoice_number, billing_period_start, billing_period_end, invoice_date, due_date, amount)
      values (%L, 'dup', 'hydro', %L, '11111111-0000-4000-8000-000000000001', 'H-1001', '2026-08-01', '2026-08-31', '2026-09-02', '2026-09-20', 10)$q$, v_a, v_vendor));
  perform public.test_check('integrity', 'the same provider invoice number cannot be entered twice for a vendor', v_err like '23505%', v_err);
  insert into public.bill_payments (organization_id, bill_id, amount, paid_on, bank_account_id) values (v_a, v_bill, 200.00, '2026-09-10', v_bank);
  v_err := public.test_err(format($q$insert into public.bill_payments (organization_id, bill_id, amount, paid_on) values (%L, %L, 150, '2026-09-11')$q$, v_a, v_bill));
  perform public.test_check('integrity', 'bill payments cannot exceed the bill amount', v_err like '23514%', v_err);
  perform public.test_check('integrity', 'bill balance view derives status', (select remaining from public.v_bill_balances where bill_id = v_bill) = 100.00 and (select derived_status from public.v_bill_balances where bill_id = v_bill) in ('overdue', 'partially_paid'));
  insert into public.bill_schedules (id, organization_id, name, bill_type, vendor_id, property_id, start_date) values (v_sched, v_a, 'Hydro monthly', 'hydro', v_vendor, '11111111-0000-4000-8000-000000000001', '2026-01-01');
  insert into public.bill_schedule_runs (organization_id, schedule_id, due_date, action, bill_id) values (v_a, v_sched, '2026-09-20', 'posted', v_bill);
  v_err := public.test_err(format($q$insert into public.bill_schedule_runs (organization_id, schedule_id, due_date, action) values (%L, %L, '2026-09-20', 'skipped')$q$, v_a, v_sched));
  perform public.test_check('integrity', 'a schedule occurrence can be handled only once', v_err like '23505%', v_err);
  v_err := public.test_err(format($q$insert into public.expenses (organization_id, category_id, expense_date, amount, tax_amount, description)
      select %L, id, current_date, 100, 120, 'tax > amount' from public.expense_categories limit 1$q$, v_a));
  perform public.test_check('integrity', 'expense tax cannot exceed the expense total', v_err like '23514%', v_err);

  -- bank statement lines: re-importing the same line is blocked, flagged duplicates are allowed
  insert into public.bank_transactions (organization_id, bank_account_id, tx_date, description, credit, fingerprint) values (v_a, v_bank, '2026-09-01', 'EFT RENT', 1800, 'fp-1');
  v_err := public.test_err(format($q$insert into public.bank_transactions (organization_id, bank_account_id, tx_date, description, credit, fingerprint) values (%L, %L, '2026-09-01', 'EFT RENT', 1800, 'fp-1')$q$, v_a, v_bank));
  perform public.test_check('integrity', 'the same statement line cannot be imported twice', v_err like '23505%', v_err);
  perform public.test_check('integrity', 'statement signed amount = credit - debit', (select signed_amount from public.bank_transactions where fingerprint = 'fp-1') = 1800.00);
  v_err := public.test_err(format($q$insert into public.book_transactions (organization_id, bank_account_id, tx_date, tx_type, money_in, money_out) values (%L, %L, '2026-09-01', 'rent_payment', 10, 10)$q$, v_a, v_bank));
  perform public.test_check('integrity', 'a ledger line is either money in or money out', v_err like '23514%', v_err);

  insert into public.reconciliations (id, organization_id, bank_account_id, period_start, period_end, status) values (gen_random_uuid(), v_a, v_bank, '2026-08-01', '2026-08-31', 'reconciled') returning id into v_rec;
  v_err := public.test_err(format($q$insert into public.reconciliations (organization_id, bank_account_id, period_start, period_end, status) values (%L, %L, '2026-08-15', '2026-09-15', 'reconciled')$q$, v_a, v_bank));
  perform public.test_check('integrity', 'overlapping reconciled periods for one account are rejected', v_err like '23P01%', v_err);
  v_err := public.test_err(format($q$insert into public.reconciliations (organization_id, bank_account_id, period_start, period_end, status) values (%L, %L, '2026-09-01', '2026-09-30', 'in_progress')$q$, v_a, v_bank));
  perform public.test_check('integrity', 'a new period can be reconciled after the previous one', v_err is null, v_err);
  perform public.test_check('integrity', 'reconciliation references are generated (REC-00001)', (select reference from public.reconciliations where id = v_rec) = 'REC-00001');
  v_err := public.test_err(format($q$insert into public.reconciliation_adjustments (organization_id, reconciliation_id, side, kind, amount) values (%L, %L, 'bank', 'fee', 5)$q$, v_a, v_rec));
  perform public.test_check('integrity', 'a finalized reconciliation is frozen', v_err like '42501%', v_err);
end $$;

-- ===================================================================================================================
-- Audit hash chain, membership guards, invitations
-- ===================================================================================================================
do $$
declare
  v_a uuid := public.test_uuid('org_a'); v_b uuid := public.test_uuid('org_b');
  v_owner uuid := 'a0000000-0000-4000-8000-000000000001';
  v_pm uuid := 'a0000000-0000-4000-8000-000000000002';
  v_outsider uuid := 'c0000000-0000-4000-8000-000000000001';
  v_inv uuid; v_err text; v_ok boolean; v_first uuid; v_desc text;
begin
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform public.test_check('integrity', 'audit chain verifies for an untouched organization', (select valid from public.verify_activity_chain(v_a)));
  perform public.test_check('integrity', 'audit chain has events from the earlier steps', (select count(*) from public.activity_events where organization_id = v_a) >= 8, (select count(*) from public.activity_events where organization_id = v_a));
  perform public.test_check('integrity', 'every audit event links to the hash of the previous one',
    not exists (select 1 from (select previous_hash, lag(event_hash) over (order by chain_seq) as expected from public.activity_events where organization_id = v_a) q
                     where q.expected is not null and q.expected <> q.previous_hash));
  perform public.test_check('integrity', 'the first event links to the genesis hash', (select previous_hash from public.activity_events where organization_id = v_a order by chain_seq limit 1) = repeat('0', 64));
  v_err := public.test_err(format($q$update public.activity_events set description = 'x' where organization_id = %L$q$, v_a));
  perform public.test_check('integrity', 'activity events cannot be updated', v_err like '42501%', v_err);
  v_err := public.test_err(format($q$delete from public.activity_events where organization_id = %L$q$, v_a));
  perform public.test_check('integrity', 'activity events cannot be deleted', v_err like '42501%', v_err);
  v_err := public.test_err('truncate public.activity_events');
  perform public.test_check('integrity', 'activity events cannot be truncated (blocked by the trigger or by the foreign keys)', v_err is not null, v_err);

  -- tampering by a privileged operator (trigger bypass) is detected by verification
  select id, description into v_first, v_desc from public.activity_events where organization_id = v_a order by chain_seq limit 1 offset 3;
  set session_replication_role = replica;
  update public.activity_events set description = 'tampered' where id = v_first;
  set session_replication_role = origin;
  perform public.test_check('integrity', 'verification detects a tampered event and names it', (select not valid and first_invalid_event = v_first from public.verify_activity_chain(v_a)));
  set session_replication_role = replica;
  update public.activity_events set description = v_desc where id = v_first;           -- restore the fixture
  set session_replication_role = origin;
  perform public.test_check('integrity', 'verification passes again once the event is restored', (select valid from public.verify_activity_chain(v_a)));

  -- membership guards
  v_err := public.test_err(format($q$update public.organization_members set role = 'administrator' where organization_id = %L and user_id = %L$q$, v_a, v_owner));
  perform public.test_check('integrity', 'the last active owner cannot be demoted', v_err like '23514%', v_err);
  v_err := public.test_err(format($q$update public.organization_members set status = 'suspended' where organization_id = %L and user_id = %L$q$, v_a, v_owner));
  perform public.test_check('integrity', 'the last active owner cannot be suspended', v_err like '23514%', v_err);
  v_err := public.test_err(format($q$delete from public.organization_members where organization_id = %L and user_id = %L$q$, v_a, v_owner));
  perform public.test_check('integrity', 'the last active owner cannot be removed', v_err like '23514%', v_err);

  perform public.test_login(v_pm);
  v_err := public.test_err(format($q$update public.organization_members set role = 'owner' where organization_id = %L and user_id = %L$q$, v_a, v_pm));
  perform public.test_logout();
  perform public.test_check('integrity', 'a property manager cannot promote themselves (RLS hides the row; role unchanged)', (select role from public.organization_members where organization_id = v_a and user_id = v_pm) = 'property_manager', v_err);
  perform public.test_login('a0000000-0000-4000-8000-000000000006');
  v_err := public.test_err(format($q$update public.organization_members set role = 'owner' where organization_id = %L and user_id = 'a0000000-0000-4000-8000-000000000006'$q$, v_a));
  perform public.test_logout();
  perform public.test_check('integrity', 'an administrator cannot grant themselves the owner role', v_err like '42501%', v_err);
  perform public.test_login('a0000000-0000-4000-8000-000000000006');
  v_err := public.test_err(format($q$update public.organization_members set role = 'read_only' where organization_id = %L and user_id = %L$q$, v_a, v_owner));
  perform public.test_logout();
  perform public.test_check('integrity', 'an administrator cannot demote or remove an owner', v_err like '42501%' or v_err like '23514%', v_err);

  -- invitations
  perform public.test_login(v_owner);
  insert into public.organization_invitations (organization_id, email, role, invited_by) values (v_a, 'new.hire@example.test', 'accountant', v_owner) returning id into v_inv;
  v_err := public.test_err(format($q$insert into public.organization_invitations (organization_id, email, role, invited_by) values (%L, 'new.hire@example.test', 'read_only', %L)$q$, v_a, v_owner));
  perform public.test_logout();
  perform public.test_check('integrity', 'only one pending invitation per email', v_err like '23505%', v_err);
  insert into auth.users (id, email) values ('d0000000-0000-4000-8000-000000000001', 'new.hire@example.test');
  perform public.test_login(v_outsider);
  v_err := public.test_err(format($q$select public.accept_invitation(%L)$q$, v_inv));
  perform public.test_logout();
  perform public.test_check('integrity', 'someone else cannot accept an invitation addressed to another email', v_err like 'P0002%', v_err);
  perform public.test_login('d0000000-0000-4000-8000-000000000001');
  perform public.accept_invitation(v_inv);
  perform public.test_logout();
  perform public.test_check('integrity', 'the invitee joins with the invited role',
    (select role from public.organization_members where organization_id = v_a and user_id = 'd0000000-0000-4000-8000-000000000001') = 'accountant'
    and (select status from public.organization_invitations where id = v_inv) = 'accepted');
  perform public.test_login('d0000000-0000-4000-8000-000000000001');
  v_err := public.test_err(format($q$select public.accept_invitation(%L)$q$, v_inv));
  perform public.test_logout();
  perform public.test_check('integrity', 'an invitation cannot be accepted twice', v_err like '22023%', v_err);

  -- declining an invitation
  insert into auth.users (id, email) values ('d0000000-0000-4000-8000-000000000002', 'decliner@example.test');
  perform public.test_login(v_owner);
  insert into public.organization_invitations (organization_id, email, role, invited_by) values (v_a, 'decliner@example.test', 'read_only', v_owner) returning id into v_inv;
  perform public.test_logout();
  perform public.test_login('d0000000-0000-4000-8000-000000000002');
  perform public.decline_invitation(v_inv);
  v_err := public.test_err(format($q$select public.accept_invitation(%L)$q$, v_inv));
  perform public.test_logout();
  perform public.test_check('integrity', 'a declined invitation cannot be accepted and creates no membership',
    (select status from public.organization_invitations where id = v_inv) = 'declined' and v_err like '22023%'
    and not exists (select 1 from public.organization_members where organization_id = v_a and user_id = 'd0000000-0000-4000-8000-000000000002'), v_err);

  -- ownership transfer
  perform public.test_login(v_owner);
  perform public.transfer_ownership(v_a, v_pm);
  perform public.test_logout();
  perform public.test_check('integrity', 'ownership transfer promotes the new owner and demotes the old one',
    (select role from public.organization_members where organization_id = v_a and user_id = v_pm) = 'owner'
    and (select role from public.organization_members where organization_id = v_a and user_id = v_owner) = 'administrator');
  -- restore for later suites
  update public.organization_members set role = 'owner' where organization_id = v_a and user_id = v_owner;
  update public.organization_members set role = 'property_manager' where organization_id = v_a and user_id = v_pm;
  perform public.test_check('integrity', 'role changes are audited (user.role_changed)', exists (select 1 from public.activity_events where organization_id = v_a and action = 'user.role_changed'));
end $$;

-- ===================================================================================================================
-- Documents, versions, signatures
-- ===================================================================================================================
do $$
declare
  v_a uuid := public.test_uuid('org_a'); v_b uuid := public.test_uuid('org_b');
  v_owner uuid := 'a0000000-0000-4000-8000-000000000001';
  v_doc uuid := gen_random_uuid(); v_ver uuid := gen_random_uuid(); v_doc_b uuid := gen_random_uuid(); v_err text; v_req uuid := gen_random_uuid(); v_signer uuid := gen_random_uuid();
begin
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  insert into public.documents (id, organization_id, name, document_type, uploaded_by) values (v_doc, v_a, 'Lease LSE-00001.pdf', 'Lease agreement', v_owner);
  insert into public.document_versions (id, organization_id, document_id, version_number, storage_bucket, storage_path, file_name, mime_type, size_bytes, sha256)
    values (v_ver, v_a, v_doc, 1, 'lease-documents', v_a::text || '/leases/lse-1/v1.pdf', 'v1.pdf', 'application/pdf', 1000, repeat('a', 64));
  update public.documents set current_version_id = v_ver where id = v_doc;
  perform public.test_set('doc_a', v_doc::text); perform public.test_set('ver_a', v_ver::text);
  v_err := public.test_err(format($q$insert into public.document_versions (organization_id, document_id, version_number, storage_bucket, storage_path, file_name)
      values (%L, %L, 2, 'lease-documents', %L, 'x.pdf')$q$, v_a, v_doc, v_b::text || '/leases/x.pdf'));
  perform public.test_check('integrity', 'a document version must be stored under its own organization folder', v_err like '23514%', v_err);
  v_err := public.test_err(format($q$insert into public.document_versions (organization_id, document_id, version_number, storage_bucket, storage_path, file_name)
      values (%L, %L, 2, 'lease-documents', %L, 'dup.pdf')$q$, v_a, v_doc, v_a::text || '/leases/lse-1/v1.pdf'));
  perform public.test_check('integrity', 'a storage object can be registered only once', v_err like '23505%', v_err);
  v_err := public.test_err(format($q$insert into public.document_versions (organization_id, document_id, version_number, storage_bucket, storage_path, file_name, sha256)
      values (%L, %L, 2, 'lease-documents', %L, 'bad.pdf', 'xyz')$q$, v_a, v_doc, v_a::text || '/leases/bad.pdf'));
  perform public.test_check('integrity', 'sha256 must be 64 hex characters', v_err like '23514%', v_err);
  insert into public.document_links (organization_id, document_id, entity_type, entity_id, is_primary) values (v_a, v_doc, 'lease', public.test_uuid('lease_2'), true);
  perform public.test_check('integrity', 'a document links to a lease of the same organization', (select count(*) from public.document_links where document_id = v_doc) = 1);
  v_err := public.test_err(format($q$insert into public.document_links (organization_id, document_id, entity_type, entity_id) values (%L, %L, 'property', '11111111-0000-4000-8000-0000000000b1')$q$, v_a, v_doc));
  perform public.test_check('integrity', 'a document cannot link to another organization''s property', v_err like '23503%', v_err);
  v_err := public.test_err(format($q$insert into public.document_links (organization_id, document_id, entity_type, entity_id) values (%L, %L, 'tenant', gen_random_uuid())$q$, v_a, v_doc));
  perform public.test_check('integrity', 'a document cannot link to a record that does not exist', v_err like '23503%', v_err);

  -- signature flow + immutability of signed versions
  insert into public.signature_requests (id, organization_id, document_id, source_version_id, source_sha256, title, created_by, lease_id)
    values (v_req, v_a, v_doc, v_ver, repeat('a', 64), 'Sign lease', v_owner, public.test_uuid('lease_2'));
  insert into public.signers (id, organization_id, request_id, name, email, token_hash) values (v_signer, v_a, v_req, 'Mateo Rivera', 'mateo@example.test', repeat('b', 64));
  insert into public.signature_fields (organization_id, request_id, signer_id, field_type, page, x, y, width, height) values (v_a, v_req, v_signer, 'signature', 1, 0.1, 0.8, 0.3, 0.05);
  v_err := public.test_err(format($q$insert into public.signature_fields (organization_id, request_id, signer_id, field_type, page, x, y, width, height) values (%L, %L, %L, 'signature', 1, 1.5, 0.8, 0.3, 0.05)$q$, v_a, v_req, v_signer));
  perform public.test_check('integrity', 'signature field coordinates must be normalised 0..1', v_err like '22003%' or v_err like '23514%', v_err);
  insert into public.signature_events (organization_id, request_id, signer_id, action, ip_address, document_sha256) values (v_a, v_req, v_signer, 'sent', '203.0.113.5', repeat('a', 64));
  v_err := public.test_err(format($q$update public.signature_events set action = 'voided' where request_id = %L$q$, v_req));
  perform public.test_check('integrity', 'signature events are append-only', v_err like '42501%', v_err);
  v_err := public.test_err(format($q$delete from public.signature_events where request_id = %L$q$, v_req));
  perform public.test_check('integrity', 'signature events cannot be deleted', v_err like '42501%', v_err);
  insert into public.document_versions (organization_id, document_id, version_number, storage_bucket, storage_path, file_name, is_immutable, sha256)
    values (v_a, v_doc, 2, 'signed-documents', v_a::text || '/signed/lse-1.pdf', 'signed.pdf', true, repeat('c', 64));
  v_err := public.test_err(format($q$update public.document_versions set file_name = 'edited.pdf' where document_id = %L and version_number = 2$q$, v_doc));
  perform public.test_check('integrity', 'a signed (immutable) document version cannot be modified', v_err like '42501%', v_err);
  v_err := public.test_err(format($q$delete from public.document_versions where document_id = %L and version_number = 2$q$, v_doc));
  perform public.test_check('integrity', 'a signed (immutable) document version cannot be deleted', v_err like '42501%', v_err);

  -- tenant identification
  insert into public.documents (id, organization_id, name, document_type, is_sensitive, uploaded_by) values (v_doc_b, v_a, 'Passport Ava', 'Identification', true, v_owner);
  insert into public.tenant_id_documents (organization_id, tenant_id, document_id, id_type, expires_on) values (v_a, '33333333-0000-4000-8000-000000000001', v_doc_b, 'passport', current_date + 30);
  perform public.test_check('integrity', 'tenant identification metadata is recorded', (select count(*) from public.tenant_id_documents) = 1);
  v_err := public.test_err(format($q$insert into public.tenant_id_documents (organization_id, tenant_id, document_id, id_type) values (%L, '33333333-0000-4000-8000-000000000001', %L, 'passport')$q$, v_a, v_doc_b));
  perform public.test_check('integrity', 'a document can describe only one identification record', v_err like '23505%', v_err);
  perform public.test_set('doc_sensitive', v_doc_b::text);
end $$;

-- ===================================================================================================================
-- Automation, messaging, scheduled tasks
-- ===================================================================================================================
do $$
declare
  v_a uuid := public.test_uuid('org_a'); v_owner uuid := 'a0000000-0000-4000-8000-000000000001';
  v_tpl uuid := gen_random_uuid(); v_sms uuid := gen_random_uuid(); v_rule uuid := gen_random_uuid(); v_err text; v_e1 uuid; v_e2 uuid; v_task uuid := gen_random_uuid();
  v_claimed int; v_claimed2 int; v_run uuid; v_entity uuid := gen_random_uuid();
begin
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  insert into public.message_templates (id, organization_id, name, channel, status, subject, body) values (v_tpl, v_a, 'Rent reminder', 'email', 'draft', 'Hi', 'Body'), (v_sms, v_a, 'Rent SMS', 'sms', 'active', '', 'Body');
  perform public.test_check('integrity', 'template version 1 is snapshotted on insert', (select count(*) from public.message_template_versions where template_id = v_tpl and version = 1) = 1);
  update public.message_templates set body = 'New body' where id = v_tpl;
  perform public.test_check('integrity', 'editing template content bumps the version and keeps history', (select version from public.message_templates where id = v_tpl) = 2 and (select count(*) from public.message_template_versions where template_id = v_tpl) = 2);
  update public.message_templates set internal_notes = 'note' where id = v_tpl;
  perform public.test_check('integrity', 'non-content edits do not bump the version', (select version from public.message_templates where id = v_tpl) = 2);

  v_err := public.test_err(format($q$insert into public.automation_rules (organization_id, name, event_type, template_id, channel, status) values (%L, 'r', 'invoice.overdue', %L, 'email', 'active')$q$, v_a, v_tpl));
  perform public.test_check('integrity', 'a rule cannot be active while its template is inactive', v_err like '23514%', v_err);
  v_err := public.test_err(format($q$insert into public.automation_rules (organization_id, name, event_type, template_id, channel, status) values (%L, 'r', 'invoice.overdue', %L, 'email', 'active')$q$, v_a, v_sms));
  perform public.test_check('integrity', 'a rule cannot be active when channel and template channel differ', v_err like '23514%', v_err);
  update public.message_templates set status = 'active' where id = v_tpl;
  insert into public.automation_rules (id, organization_id, name, event_type, template_id, channel, status, dedupe_enabled, dedupe_window_hours) values (v_rule, v_a, 'Overdue rent', 'invoice.overdue', v_tpl, 'email', 'active', true, 24);
  perform public.test_check('integrity', 'a rule with a matching active template can be active', (select status from public.automation_rules where id = v_rule) = 'active');

  v_e1 := public.enqueue_workflow_execution(v_a, v_rule, 'invoice', v_entity);
  v_e2 := public.enqueue_workflow_execution(v_a, v_rule, 'invoice', v_entity);
  perform public.test_check('integrity', 'workflow executions are de-duplicated inside the rule window', v_e1 is not null and v_e2 is null);
  perform public.test_check('integrity', 'a different entity gets its own execution', public.enqueue_workflow_execution(v_a, v_rule, 'invoice', gen_random_uuid()) is not null);
  v_err := public.test_err(format($q$insert into public.workflow_executions (organization_id, rule_id, event_type, dedupe_key) select organization_id, rule_id, event_type, dedupe_key from public.workflow_executions where id = %L$q$, v_e1));
  perform public.test_check('integrity', 'the dedupe key is unique per rule at the table level', v_err like '23505%', v_err);

  -- scheduled tasks
  insert into public.scheduled_tasks (id, organization_id, name, task_type, schedule_type, interval_minutes, next_run_at) values (v_task, v_a, 'Rent run', 'rent_invoice_generation', 'interval', 60, now() - interval '1 minute');
  v_err := public.test_err(format($q$insert into public.scheduled_tasks (organization_id, name, task_type, schedule_type) values (%L, 'bad', 'custom', 'interval')$q$, v_a));
  perform public.test_check('integrity', 'an interval task needs interval_minutes', v_err like '23514%', v_err);
  select count(*) into v_claimed from public.claim_due_scheduled_tasks('worker-1', 10, 300);
  select count(*) into v_claimed2 from public.claim_due_scheduled_tasks('worker-2', 10, 300);
  perform public.test_check('integrity', 'a due task is claimed once; a second worker gets nothing', v_claimed = 1 and v_claimed2 = 0, v_claimed || '/' || v_claimed2);
  perform public.test_check('integrity', 'claiming advances next_run_at by the interval', (select next_run_at > now() from public.scheduled_tasks where id = v_task));
  select id into v_run from public.scheduled_task_runs where task_id = v_task;
  v_err := public.test_err(format($q$insert into public.scheduled_task_runs (organization_id, task_id, scheduled_for) select organization_id, task_id, scheduled_for from public.scheduled_task_runs where id = %L$q$, v_run));
  perform public.test_check('integrity', 'the same task occurrence cannot run twice (unique key)', v_err like '23505%', v_err);
  perform public.complete_scheduled_task_run(v_run, 'succeeded', '{"created": 3}'::jsonb);
  perform public.test_check('integrity', 'completing a run records the outcome', (select status from public.scheduled_task_runs where id = v_run) = 'succeeded' and (select last_status from public.scheduled_tasks where id = v_task) = 'succeeded');
  v_err := public.test_err(format($q$select public.complete_scheduled_task_run(%L, 'failed')$q$, v_run));
  perform public.test_check('integrity', 'a finished run cannot be completed again', v_err like 'P0002%', v_err);
  update public.scheduled_task_runs set status = 'running', locked_until = now() - interval '1 minute', finished_at = null where id = v_run;
  perform public.test_check('integrity', 'stale locks are reclaimed', public.reclaim_stale_task_runs() = 1);

  -- messaging participants
  v_err := public.test_err(format($q$insert into public.conversation_participants (organization_id, conversation_id, participant_type, user_id, tenant_id) select %L, id, 'staff', %L, '33333333-0000-4000-8000-000000000001' from (select gen_random_uuid() as id) x$q$, v_a, v_owner));
  perform public.test_check('integrity', 'a participant is exactly one kind of party', v_err is not null, v_err);
end $$;

-- ===================================================================================================================
-- Deposits
-- ===================================================================================================================
do $$
declare
  v_a uuid := public.test_uuid('org_a'); v_err text; v_dep uuid := gen_random_uuid(); v_t1 uuid := '33333333-0000-4000-8000-000000000001';
  v_tx uuid;
begin
  perform set_config('request.jwt.claim.sub', 'a0000000-0000-4000-8000-000000000001', true);
  insert into public.deposit_rules (organization_id, jurisdiction, lease_type, deposit_type, effective_from, effective_to) values (v_a, 'ON', 'residential', 'last_month_rent', '2026-01-01', '2026-12-31');
  v_err := public.test_err(format($q$insert into public.deposit_rules (organization_id, jurisdiction, lease_type, deposit_type, effective_from) values (%L, 'ON', 'residential', 'last_month_rent', '2026-06-01')$q$, v_a));
  perform public.test_check('integrity', 'deposit rules for one scope cannot overlap in time', v_err like '23P01%', v_err);
  insert into public.deposit_rules (organization_id, jurisdiction, lease_type, deposit_type, effective_from) values (v_a, 'ON', 'residential', 'last_month_rent', '2027-01-01');
  perform public.test_check('integrity', 'a successor rule can start after the previous one ends', true);
  insert into public.deposits (id, organization_id, tenant_id, lease_id, deposit_type, status, required_amount) values (v_dep, v_a, v_t1, public.test_uuid('lease_2'), 'last_month_rent', 'expected', 1800);
  perform public.test_check('integrity', 'deposit references are generated (DEP-00001)', (select reference from public.deposits where id = v_dep) = 'DEP-00001');
  insert into public.deposit_transactions (organization_id, deposit_id, txn_type, signed_amount) values (v_a, v_dep, 'collection', 1800) returning id into v_tx;
  v_err := public.test_err(format($q$update public.deposit_transactions set signed_amount = 1 where id = %L$q$, v_tx));
  perform public.test_check('integrity', 'deposit transactions are append-only', v_err like '42501%', v_err);
  v_err := public.test_err(format($q$update public.deposit_transactions set status = 'reversed' where id = %L$q$, v_tx));
  perform public.test_check('integrity', 'a deposit transaction can be flagged reversed (the only allowed change)', v_err is null, v_err);
  v_err := public.test_err(format($q$insert into public.deposit_key_devices (organization_id, deposit_id, device_type, quantity_issued, quantity_returned) values (%L, %L, 'fob', 1, 2)$q$, v_a, v_dep));
  perform public.test_check('integrity', 'returned key devices cannot exceed issued', v_err like '23514%', v_err);
end $$;

-- ===================================================================================================================
-- Chart of accounts rules
-- ===================================================================================================================
do $$
declare
  v_a uuid := public.test_uuid('org_a'); v_err text; v_posting uuid; v_group uuid; v_child uuid;
begin
  select id into v_posting from public.accounts where organization_id = v_a and code = '1101';
  select id into v_group from public.accounts where organization_id = v_a and code = '1100';
  v_err := public.test_err(format($q$insert into public.accounts (organization_id, code, name, account_type, normal_balance, parent_id) values (%L, '1101.1', 'Under posting', 'asset', 'debit', %L)$q$, v_a, v_posting));
  perform public.test_check('integrity', 'the parent of an account must be a group account', v_err like '23514%', v_err);
  v_err := public.test_err(format($q$update public.accounts set parent_id = (select id from public.accounts where organization_id = %L and code = '1110') where organization_id = %L and code = '1000'$q$, v_a, v_a));
  perform public.test_check('integrity', 'an account cannot be moved under its own descendant', v_err like '23514%', v_err);
  v_err := public.test_err(format($q$insert into public.accounts (organization_id, code, name, account_type, normal_balance) values (%L, '1101', 'Duplicate code', 'asset', 'debit')$q$, v_a));
  perform public.test_check('integrity', 'account codes are unique per organization', v_err like '23505%', v_err);
  v_err := public.test_err(format($q$insert into public.accounts (organization_id, code, name, account_type, normal_balance) values (%L, 'Z100', 'Org B account', 'asset', 'debit')$q$, public.test_uuid('org_b')));
  v_err := coalesce(v_err, public.test_err(format($q$insert into public.accounts (organization_id, code, name, account_type, normal_balance) values (%L, 'Z100', 'Org A account', 'asset', 'debit')$q$, v_a)));
  perform public.test_check('integrity', 'the same account code may exist in another organization', v_err is null, v_err);
  v_err := public.test_err(format($q$update public.accounts set account_type = 'liability' where organization_id = %L and code = '4110'$q$, v_a));
  perform public.test_check('integrity', 'an account with postings cannot change type', v_err like '23514%', v_err);
  v_err := public.test_err(format($q$update public.accounts set account_type = 'liability', normal_balance = 'credit' where organization_id = %L and code = '8200'$q$, v_a));
  perform public.test_check('integrity', 'an account without postings can still be reclassified', v_err is null, v_err);
  v_err := public.test_err(format($q$insert into public.bank_accounts (organization_id, name, gl_account_id) select %L, 'Bad GL', id from public.accounts where organization_id = %L and code = '4110'$q$, v_a, v_a));
  perform public.test_check('integrity', 'a bank account must map to an asset/liability posting account', v_err like '23514%', v_err);
  -- depth limit: chain of groups
  v_child := v_group;
  for i in 1..9 loop
    declare v_new uuid := gen_random_uuid();
    begin
      insert into public.accounts (id, organization_id, code, name, account_type, normal_balance, role, parent_id) values (v_new, v_a, 'D' || i, 'Depth ' || i, 'asset', 'debit', 'group', v_child);
      v_child := v_new;
    exception when others then
      perform public.test_check('integrity', 'the chart is limited to 8 levels (failed at level ' || (i + 2) || ')', sqlstate = '23514' and i >= 4, sqlerrm);
      exit;
    end;
  end loop;
end $$;

select suite, count(*) filter (where passed) as passed, count(*) filter (where not passed) as failed from public.test_results where suite = 'integrity' group by suite;
