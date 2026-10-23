-- =====================================================================================================================
-- development_seed.sql  -  OPTIONAL fictional fixtures for LOCAL DEVELOPMENT ONLY. Never run against production.
--
-- It does NOT create authentication users (and must not: auth.users is owned by Supabase Auth). First create a user the supported
-- way (Studio -> Authentication -> Add user, or the app's sign-up page, or `supabase auth` / the Admin API), then run:
--
--     psql "$DATABASE_URL" -c "select set_config('app.seed_owner_email', 'you@example.com', false)" -f database/seed/development_seed.sql
--   (or, in one session:  set app.seed_owner_email = 'you@example.com';  \i database/seed/development_seed.sql )
--
-- The script creates the organization "Maple Ridge Rentals (demo)" owned by that user, with a small, internally consistent portfolio:
-- properties, units, tenants, leases, applications, invoices and payments (through the real functions), a deposit, vendors, bills,
-- maintenance, a project, document METADATA (no files are uploaded to Storage), templates, rules, a conversation and scheduled
-- tasks. It is repeatable: running it again does nothing once the demo organization exists.
-- All names, addresses, e-mail addresses (example.test) and amounts are fictional.
-- =====================================================================================================================
set search_path = public, extensions;

create or replace function pg_temp.sid(p_key text) returns uuid language sql immutable as $$ select md5('mrr-demo:' || p_key)::uuid $$;

do $seed$
declare
  v_email text := current_setting('app.seed_owner_email', true);
  v_owner uuid;
  v_org uuid := pg_temp.sid('organization');
  v_bank_gl uuid; v_bank uuid := pg_temp.sid('bank:operating');
  v_period date := date_trunc('month', current_date)::date;
  v_prev date := (date_trunc('month', current_date) - interval '1 month')::date;
  v_inv uuid; v_amt numeric; v_credit uuid; v_je uuid;
  v_tenants text[] := array['ava','mateo','priya','jordan','sofia','noah'];
  v_names text[][] := array[['Ava','Thompson'],['Mateo','Rivera'],['Priya','Shah'],['Jordan','Lee'],['Sofia','Bennett'],['Noah','Williams']];
  i int;
  v_prop_cedar uuid := pg_temp.sid('property:cedar'); v_prop_harbor uuid := pg_temp.sid('property:harbor'); v_prop_maple uuid := pg_temp.sid('property:maple');
begin
  if v_email is null or v_email = '' then
    raise exception 'Set app.seed_owner_email to the e-mail of an existing Auth user first (see the header of this file).';
  end if;
  select p.id into v_owner from public.profiles p where lower(p.email) = lower(v_email);
  if v_owner is null then raise exception 'No profile for % - create the Auth user first.', v_email; end if;
  if exists (select 1 from public.organizations where id = v_org) then
    raise notice 'Demo organization already exists - nothing to do.';
    return;
  end if;
  perform set_config('request.jwt.claim.sub', v_owner::text, true);     -- so created_by / actor columns point at the seed owner

  -- organization ------------------------------------------------------------------------------------------------------------
  insert into public.organizations (id, name, business_type, country, currency, timezone, plan, email, phone, website, address_line1, city, state_province, postal_code, created_by)
  values (v_org, 'Maple Ridge Rentals (demo)', 'property_management_company', 'Canada', 'CAD', 'America/Toronto', 'growth', 'hello@mapleridge.example.test', '(416) 555-0142',
          'https://www.mapleridge.example.test', '200 Front Street West', 'Toronto', 'ON', 'M5V 3K2', v_owner);
  insert into public.organization_members (organization_id, user_id, role) values (v_org, v_owner, 'owner');
  insert into public.audit_policies (organization_id, updated_by) values (v_org, v_owner);
  update public.user_preferences set active_organization_id = v_org where user_id = v_owner;
  perform private.seed_organization_defaults(v_org);
  select gl_account_id into v_bank_gl from (select id as gl_account_id from public.accounts where organization_id = v_org and code = '1101') x;
  insert into public.bank_accounts (id, organization_id, name, institution, last4, account_type, gl_account_id, opening_balance, opening_balance_date)
  values (v_bank, v_org, 'Operating chequing', 'Maple Credit Union', '4821', 'operating', v_bank_gl, 25000, date_trunc('year', current_date)::date);

  -- owners and properties ------------------------------------------------------------------------------------------------
  insert into public.owners (id, organization_id, name, owner_type, email) values
    (pg_temp.sid('owner:1'), v_org, 'Nadia Holdings Inc.', 'organization', 'owner1@example.test'), (pg_temp.sid('owner:2'), v_org, 'Elena Marquez', 'individual', 'owner2@example.test');
  insert into public.properties (id, organization_id, code, name, property_type, status, address_line1, city, state_province, postal_code, country, year_built, parking_spaces, amenities, timezone, created_by) values
    (v_prop_cedar,  v_org, 'PROP-014', 'Cedar Court',  'apartment_building',    'active', '148 Cedar Avenue',  'Toronto',   'ON', 'M4C 1A1', 'Canada', 1998, 20, array['Laundry','Bike storage'], 'America/Toronto', v_owner),
    (v_prop_harbor, v_org, 'PROP-021', 'Harbor House', 'multi_unit_residential', 'active', '72 Harbour Street', 'Vancouver', 'BC', 'V6B 2K4', 'Canada', 2005, 8,  array['Elevator'],                'America/Vancouver', v_owner),
    (v_prop_maple,  v_org, 'PROP-029', 'Maple Row',    'townhouse',             'active', '915 Maple Drive',   'Calgary',   'AB', 'T2P 1J9', 'Canada', 2012, 6,  array['Garage'],                  'America/Edmonton', v_owner);
  insert into public.property_owners (organization_id, property_id, owner_id, ownership_percentage) values
    (v_org, v_prop_cedar, pg_temp.sid('owner:1'), 100), (v_org, v_prop_harbor, pg_temp.sid('owner:1'), 60), (v_org, v_prop_harbor, pg_temp.sid('owner:2'), 40), (v_org, v_prop_maple, pg_temp.sid('owner:2'), 100);
  insert into public.units (id, organization_id, property_id, unit_number, unit_type, unit_status, bedrooms, bathrooms, square_feet, market_rent, advertised_rent, deposit_amount) values
    (pg_temp.sid('unit:cedar:2B'),   v_org, v_prop_cedar,  '2B',  'Apartment', 'occupied', 2, 1, 850,  1850, 1850, 1850),
    (pg_temp.sid('unit:cedar:3A'),   v_org, v_prop_cedar,  '3A',  'Apartment', 'occupied', 1, 1, 640,  1550, 1550, 1550),
    (pg_temp.sid('unit:cedar:1A'),   v_org, v_prop_cedar,  '1A',  'Studio',    'vacant',   0, 1, 430,  1425, 1425, 1425),
    (pg_temp.sid('unit:harbor:4'),   v_org, v_prop_harbor, '4',   'Apartment', 'occupied', 2, 2, 920,  2400, 2400, 2400),
    (pg_temp.sid('unit:harbor:7'),   v_org, v_prop_harbor, '7',   'Loft',      'occupied', 1, 1, 780,  2150, 2150, 2150),
    (pg_temp.sid('unit:maple:102'),  v_org, v_prop_maple,  '102', 'Townhouse', 'occupied', 3, 2, 1400, 2250, 2250, 2250),
    (pg_temp.sid('unit:maple:204'),  v_org, v_prop_maple,  '204', 'Townhouse', 'reserved', 3, 2, 1400, 2300, 2300, 2300),
    (pg_temp.sid('unit:maple:206'),  v_org, v_prop_maple,  '206', 'Townhouse', 'under_maintenance', 2, 1, 1100, 1900, 1900, 1900);

  -- tenants, contacts, vendors ---------------------------------------------------------------------------------------------
  for i in 1..6 loop
    insert into public.tenants (id, organization_id, first_name, last_name, email, phone, status, created_by)
    values (pg_temp.sid('tenant:' || v_tenants[i]), v_org, v_names[i][1], v_names[i][2], v_tenants[i] || '@example.test', '(416) 555-01' || lpad((40 + i)::text, 2, '0'), 'active', v_owner);
  end loop;
  insert into public.tenant_private_details (organization_id, tenant_id, date_of_birth) values
    (v_org, pg_temp.sid('tenant:ava'), date '1991-04-12'), (v_org, pg_temp.sid('tenant:mateo'), date '1988-09-30');
  insert into public.tenant_contacts (organization_id, tenant_id, contact_type, name, relationship, phone) values
    (v_org, pg_temp.sid('tenant:ava'), 'emergency', 'Lena Thompson', 'Sister', '(416) 555-0199'), (v_org, pg_temp.sid('tenant:mateo'), 'emergency', 'Carlos Rivera', 'Father', '(604) 555-0170');
  insert into public.vendors (id, organization_id, vendor_type, company_name, contact_name, phone, email, trade, categories, payment_terms, rating) values
    (pg_temp.sid('vendor:plumb'), v_org, 'contractor', 'Northern Plumbing Ltd.', 'Sam Duffy', '(416) 555-0120', 'plumb@example.test', 'Plumbing', array['Plumbing','Heating'], 'Net 15', 4.6),
    (pg_temp.sid('vendor:elec'),  v_org, 'contractor', 'BrightWire Electric',  'Dana Cruz', '(416) 555-0121', 'elec@example.test',  'Electrical', array['Electrical'], 'Net 30', 4.3),
    (pg_temp.sid('vendor:hydro'), v_org, 'service_provider', 'City Hydro (demo)', null, '(416) 555-0130', 'billing@hydro.example.test', 'Utilities', array['Electricity'], 'On receipt', null);

  -- leases (the multi-tenant lease at Cedar Court shows several parties) ---------------------------------------------------
  insert into public.leases (id, organization_id, lease_number, name, lease_type, tenancy_status, status, start_date, end_date, agreed_monthly_rent, rent_due_day, deposit_amount, deposit_type, parking_fees, jurisdiction, created_by) values
    (pg_temp.sid('lease:1'), v_org, null, 'Cedar 2B - Thompson/Rivera', 'Residential', 'fixed_term', 'draft', current_date - 200, current_date + 165, 1850, 1, 1850, 'Last month''s rent', 50, 'ON', v_owner),
    (pg_temp.sid('lease:2'), v_org, null, 'Cedar 3A - Shah',            'Residential', 'fixed_term', 'draft', current_date - 120, current_date + 245, 1550, 1, 1550, 'Last month''s rent', 0, 'ON', v_owner),
    (pg_temp.sid('lease:3'), v_org, null, 'Harbor 4 - Lee',             'Residential', 'fixed_term', 'draft', current_date - 300, current_date + 65,  2400, 1, 2400, 'Security deposit',    0, 'BC', v_owner),
    (pg_temp.sid('lease:4'), v_org, null, 'Harbor 7 - Bennett',         'Residential', 'periodic',   'draft', current_date - 500, null,               2150, 1, 2150, 'Security deposit',    0, 'BC', v_owner),
    (pg_temp.sid('lease:5'), v_org, null, 'Maple 102 - Williams',       'Residential', 'fixed_term', 'draft', current_date - 90,  current_date + 275, 2250, 1, 2250, 'Security deposit',    0, 'AB', v_owner);
  insert into public.lease_units (organization_id, lease_id, unit_id, allocated_monthly_rent, start_date, end_date) values
    (v_org, pg_temp.sid('lease:1'), pg_temp.sid('unit:cedar:2B'), 1850, current_date - 200, current_date + 165),
    (v_org, pg_temp.sid('lease:2'), pg_temp.sid('unit:cedar:3A'), 1550, current_date - 120, current_date + 245),
    (v_org, pg_temp.sid('lease:3'), pg_temp.sid('unit:harbor:4'), 2400, current_date - 300, current_date + 65),
    (v_org, pg_temp.sid('lease:4'), pg_temp.sid('unit:harbor:7'), 2150, current_date - 500, null),
    (v_org, pg_temp.sid('lease:5'), pg_temp.sid('unit:maple:102'), 2250, current_date - 90,  current_date + 275);
  insert into public.lease_parties (organization_id, lease_id, tenant_id, role, is_primary_contact, is_signatory, signature_status, relationship_start_date) values
    (v_org, pg_temp.sid('lease:1'), pg_temp.sid('tenant:ava'),    'main_tenant', true,  true, 'signed', current_date - 200),
    (v_org, pg_temp.sid('lease:1'), pg_temp.sid('tenant:mateo'),  'co_tenant',   false, true, 'signed', current_date - 200),
    (v_org, pg_temp.sid('lease:2'), pg_temp.sid('tenant:priya'),  'main_tenant', true,  true, 'signed', current_date - 120),
    (v_org, pg_temp.sid('lease:3'), pg_temp.sid('tenant:jordan'), 'main_tenant', true,  true, 'signed', current_date - 300),
    (v_org, pg_temp.sid('lease:4'), pg_temp.sid('tenant:sofia'),  'main_tenant', true,  true, 'signed', current_date - 500),
    (v_org, pg_temp.sid('lease:5'), pg_temp.sid('tenant:noah'),   'main_tenant', true,  true, 'signed', current_date - 90);
  insert into public.lease_additional_charges (organization_id, lease_id, label, amount, position) values (v_org, pg_temp.sid('lease:1'), 'Storage locker', 35, 1);
  update public.leases set status = 'active' where organization_id = v_org and id in (select pg_temp.sid('lease:' || n) from generate_series(1, 5) n);
  insert into public.lease_renewals (organization_id, original_lease_id, renewal_type, proposed_start_date, proposed_end_date, proposed_rent, reminder_date, status, created_by)
  values (v_org, pg_temp.sid('lease:3'), 'renewal', current_date + 66, current_date + 431, 2475, current_date + 15, 'draft', v_owner);

  -- applications ----------------------------------------------------------------------------------------------------------
  insert into public.applications (id, organization_id, status, property_id, unit_id, requested_move_in_date, requested_lease_term_months, advertised_rent, proposed_rent, source, submitted_at, unit_reservation, completeness, assigned_reviewer_id) values
    (pg_temp.sid('app:1'), v_org, 'under_review', v_prop_maple, pg_temp.sid('unit:maple:204'), current_date + 30, 12, 2300, 2300, 'website', now() - interval '3 days', 'reserved', 80, v_owner),
    (pg_temp.sid('app:2'), v_org, 'new', v_prop_cedar, pg_temp.sid('unit:cedar:1A'), current_date + 45, 12, 1425, null, 'listing_portal', now() - interval '1 day', 'none', 40, null);
  insert into public.application_parties (organization_id, application_id, role, is_primary, full_name, email, phone, income_monthly, employment, screening_status, required_documents) values
    (v_org, pg_temp.sid('app:1'), 'primary_applicant', true, 'Riley Chen', 'riley@example.test', '(403) 555-0111', 6200, 'Software developer', 'in_progress', array['Proof of income','Identity verification']),
    (v_org, pg_temp.sid('app:2'), 'primary_applicant', true, 'Morgan Ellis', 'morgan@example.test', '(416) 555-0188', 3900, 'Barista', 'not_started', array['Proof of income']);
  insert into public.application_reviews (organization_id, application_id, reviewer_id, review_type, status, started_at) values (v_org, pg_temp.sid('app:1'), v_owner, 'credit_check', 'in_progress', now() - interval '2 days');

  -- receivables: rent invoices for last month (paid, partly paid) and this month (open) ---------------------------------------
  perform public.generate_rent_invoices(v_org, v_prev, true);
  perform public.generate_rent_invoices(v_org, v_period, true);
  for v_inv in select id from public.invoices where organization_id = v_org and billing_period_start = v_prev order by invoice_number loop
    if (select count(*) from public.payments where organization_id = v_org) < 4 then
      select b.outstanding into v_amt from public.v_invoice_balances b where b.invoice_id = v_inv;
      if (select count(*) from public.payments where organization_id = v_org) = 3 then v_amt := round(v_amt / 2.0, 2); end if;      -- one partial payment
      perform public.record_payment(v_org, (select tenant_id from public.invoices where id = v_inv), (select lease_id from public.invoices where id = v_inv),
        v_prev + 3, v_amt, 'etransfer', 'DEMO-' || substr(v_inv::text, 1, 6), null, v_bank,
        jsonb_build_array(jsonb_build_object('invoice_id', v_inv, 'amount', v_amt)));
    end if;
  end loop;
  -- an overpayment that becomes a tenant credit
  select id into v_inv from public.invoices where organization_id = v_org and billing_period_start = v_period order by invoice_number limit 1;
  perform public.record_payment(v_org, (select tenant_id from public.invoices where id = v_inv), (select lease_id from public.invoices where id = v_inv),
    current_date, (select outstanding from public.v_invoice_balances where invoice_id = v_inv) + 100, 'etransfer', 'DEMO-OVERPAY', 'Includes $100 prepayment', v_bank,
    jsonb_build_array(jsonb_build_object('invoice_id', v_inv, 'amount', (select outstanding from public.v_invoice_balances where invoice_id = v_inv))));

  -- deposit ---------------------------------------------------------------------------------------------------------------
  insert into public.deposit_rules (id, organization_id, jurisdiction, lease_type, deposit_type, max_multiple_of_rent_bps, calculation_method, interest_applicable, legal_reference, validation_message, notes)
  values (pg_temp.sid('deposit-rule:on-lmr'), v_org, 'ON', 'residential', 'last_month_rent', 10000, 'rent_multiple', true, 'Sample only - confirm with local legislation', 'Sample rule for demo data: at most one month''s rent.', 'Fictional sample configuration.');
  insert into public.deposits (id, organization_id, tenant_id, lease_id, property_id, unit_id, deposit_type, jurisdiction, lease_type, status, required_amount, first_received_date, interest_applicable, created_by)
  values (pg_temp.sid('deposit:1'), v_org, pg_temp.sid('tenant:ava'), pg_temp.sid('lease:1'), v_prop_cedar, pg_temp.sid('unit:cedar:2B'), 'last_month_rent', 'ON', 'residential', 'held', 1850, current_date - 200, true, v_owner);
  insert into public.deposit_transactions (organization_id, deposit_id, txn_type, signed_amount, occurred_at, user_id, notes) values (v_org, pg_temp.sid('deposit:1'), 'collection', 1850, now() - interval '200 days', v_owner, 'Collected at lease signing');

  -- payables ---------------------------------------------------------------------------------------------------------------
  insert into public.expenses (organization_id, property_id, category_id, vendor_id, expense_date, amount, tax_amount, description, payment_account_id, created_by)
  select v_org, v_prop_cedar, c.id, pg_temp.sid('vendor:plumb'), current_date - 12, 452.00, 52.00, 'Replace kitchen faucet cartridge', v_bank, v_owner from public.expense_categories c where c.organization_id = v_org and c.name = 'Repairs & Maintenance';
  insert into public.expenses (organization_id, property_id, category_id, expense_date, amount, tax_amount, description, created_by)
  select v_org, v_prop_harbor, c.id, current_date - 20, 1180.00, 0, 'Building insurance - monthly premium', v_owner from public.expense_categories c where c.organization_id = v_org and c.name = 'Insurance';
  insert into public.bills (id, organization_id, name, category, vendor_id, property_id, invoice_number, billing_period_start, billing_period_end, invoice_date, due_date, amount, responsible_party, created_by) values
    (pg_temp.sid('bill:1'), v_org, 'Hydro - Cedar Court', 'hydro', pg_temp.sid('vendor:hydro'), v_prop_cedar, 'H-' || to_char(current_date, 'YYMM') || '01', v_prev, v_period - 1, v_period + 1, v_period + 18, 612.40, 'shared', v_owner),
    (pg_temp.sid('bill:2'), v_org, 'Hydro - Harbor House', 'hydro', pg_temp.sid('vendor:hydro'), v_prop_harbor, 'H-' || to_char(current_date, 'YYMM') || '02', v_prev, v_period - 1, v_period + 1, v_period - 3, 388.15, 'landlord', v_owner);
  insert into public.bill_units (organization_id, bill_id, unit_id) values (v_org, pg_temp.sid('bill:1'), pg_temp.sid('unit:cedar:2B')), (v_org, pg_temp.sid('bill:1'), pg_temp.sid('unit:cedar:3A'));
  insert into public.bill_tenant_allocations (organization_id, bill_id, tenant_id, unit_id, method, percentage) values
    (v_org, pg_temp.sid('bill:1'), pg_temp.sid('tenant:ava'), pg_temp.sid('unit:cedar:2B'), 'percentage', 30), (v_org, pg_temp.sid('bill:1'), pg_temp.sid('tenant:priya'), pg_temp.sid('unit:cedar:3A'), 'percentage', 20);
  insert into public.bill_payments (organization_id, bill_id, amount, paid_on, method, bank_account_id) values (v_org, pg_temp.sid('bill:2'), 200.00, v_period - 1, 'bank_transfer', v_bank);
  insert into public.bill_schedules (id, organization_id, name, bill_type, vendor_id, property_id, frequency, repeat_every, repeat_unit, start_date, next_expected_date, responsible_party, expected_amount) values
    (pg_temp.sid('schedule:hydro'), v_org, 'Hydro - Cedar Court (monthly)', 'hydro', pg_temp.sid('vendor:hydro'), v_prop_cedar, 'monthly', 1, 'month', date_trunc('year', current_date)::date, v_period + 18, 'shared', 600);
  insert into public.bank_transactions (organization_id, bank_account_id, tx_date, description, credit, fingerprint) values
    (v_org, v_bank, v_prev + 3, 'E-TRANSFER RENT', 1850, 'demo-fp-1'), (v_org, v_bank, v_prev + 4, 'E-TRANSFER RENT', 1550, 'demo-fp-2'), (v_org, v_bank, v_prev + 6, 'BANK FEE', 0, 'demo-fp-3');
  update public.bank_transactions set debit = 12.50 where fingerprint = 'demo-fp-3';

  -- maintenance ----------------------------------------------------------------------------------------------------------
  insert into public.assets (id, organization_id, name, asset_type, property_id, unit_id, brand, model, warranty_end, condition, status, next_service) values
    (pg_temp.sid('asset:boiler'), v_org, 'Boiler #1', 'Heating', v_prop_cedar, null, 'Viessmann', 'Vitodens 100', current_date + 300, 'good', 'active', current_date + 40),
    (pg_temp.sid('asset:fridge'), v_org, 'Refrigerator 2B', 'Appliance', v_prop_cedar, pg_temp.sid('unit:cedar:2B'), 'Frostline', 'FL-218', current_date - 20, 'fair', 'active', null);
  insert into public.maintenance_requests (id, organization_id, title, description, category, priority, status, property_id, unit_id, tenant_id, reported_by_name, source, reported_at, target_date, approval_status, created_by) values
    (pg_temp.sid('mr:1'), v_org, 'Kitchen faucet dripping', 'Slow drip under the sink.', 'Plumbing', 'normal', 'in_progress', v_prop_cedar, pg_temp.sid('unit:cedar:2B'), pg_temp.sid('tenant:ava'), 'Ava Thompson', 'Tenant', now() - interval '6 days', current_date + 2, 'not_required', v_owner),
    (pg_temp.sid('mr:2'), v_org, 'No heat in unit 4', 'Radiators cold since morning.', 'Heating', 'emergency', 'assigned', v_prop_harbor, pg_temp.sid('unit:harbor:4'), pg_temp.sid('tenant:jordan'), 'Jordan Lee', 'Tenant', now() - interval '5 hours', current_date, 'not_required', v_owner),
    (pg_temp.sid('mr:3'), v_org, 'Replace hallway light', 'Fixture flickers.', 'Electrical', 'low', 'completed', v_prop_maple, pg_temp.sid('unit:maple:102'), pg_temp.sid('tenant:noah'), 'Noah Williams', 'Tenant', now() - interval '20 days', current_date - 12, 'not_required', v_owner);
  update public.maintenance_requests set assigned_vendor_id = pg_temp.sid('vendor:plumb'), assigned_at = now() - interval '5 days' where id = pg_temp.sid('mr:1');
  update public.maintenance_requests set completed_at = now() - interval '14 days', resolution_outcome = 'repaired', final_cost = 140 where id = pg_temp.sid('mr:3');
  insert into public.maintenance_work_orders (organization_id, request_id, title, vendor_id, priority, status, scheduled_date, estimate) values
    (v_org, pg_temp.sid('mr:1'), 'Replace faucet cartridge', pg_temp.sid('vendor:plumb'), 'normal', 'in_progress', current_date, 450);
  insert into public.maintenance_estimates (organization_id, request_id, vendor_id, label, labor, materials, tax, status) values (v_org, pg_temp.sid('mr:1'), pg_temp.sid('vendor:plumb'), 'Faucet repair', 300, 80, 50, 'approved');
  insert into public.maintenance_visits (organization_id, request_id, vendor_id, purpose, visit_date, visit_time, duration_minutes) values (v_org, pg_temp.sid('mr:1'), pg_temp.sid('vendor:plumb'), 'Replace cartridge', current_date + 1, '10:00', 90);
  insert into public.maintenance_schedules (organization_id, task, category, property_id, asset_id, frequency, next_due, vendor_id, estimated_cost, instructions) values
    (v_org, 'Annual boiler service', 'Heating', v_prop_cedar, pg_temp.sid('asset:boiler'), 'annual', current_date + 40, pg_temp.sid('vendor:plumb'), 380, 'Check pressure, flue and safety valves.');

  -- project ------------------------------------------------------------------------------------------------------------
  insert into public.projects (id, organization_id, name, property_id, unit_id, project_type, description, priority, status, manager_id, planned_start, estimated_completion, actual_start, occupancy_status, original_budget, contingency, created_by) values
    (pg_temp.sid('project:1'), v_org, 'Unit 206 turnover renovation', v_prop_maple, pg_temp.sid('unit:maple:206'), 'renovation', 'Kitchen refresh, paint and flooring.', 'high', 'in_progress', v_owner, current_date - 14, current_date + 30, current_date - 12, 'vacant', 18000, 1800, v_owner);
  insert into public.project_tasks (id, organization_id, project_id, name, category, vendor_id, planned_start, planned_finish, estimated_cost, actual_cost, status) values
    (pg_temp.sid('task:1'), v_org, pg_temp.sid('project:1'), 'Demolition', 'demolition', pg_temp.sid('vendor:plumb'), current_date - 12, current_date - 8, 1500, 1450, 'completed'),
    (pg_temp.sid('task:2'), v_org, pg_temp.sid('project:1'), 'Electrical upgrades', 'electrical', pg_temp.sid('vendor:elec'), current_date - 6, current_date + 4, 3200, 1200, 'in_progress'),
    (pg_temp.sid('task:3'), v_org, pg_temp.sid('project:1'), 'Painting and flooring', 'painting', null, current_date + 5, current_date + 20, 6400, 0, 'not_started');
  insert into public.project_task_dependencies (organization_id, task_id, depends_on_id) values (v_org, pg_temp.sid('task:2'), pg_temp.sid('task:1')), (v_org, pg_temp.sid('task:3'), pg_temp.sid('task:2'));
  insert into public.project_milestones (organization_id, project_id, name, planned_date, status) values (v_org, pg_temp.sid('project:1'), 'Rough-in inspection', current_date + 6, 'pending');
  insert into public.project_expenses (organization_id, project_id, task_id, expense_date, category, description, vendor_name, quantity, unit_price, tax_rate, approval_status, created_by)
  values (v_org, pg_temp.sid('project:1'), pg_temp.sid('task:1'), current_date - 9, 'waste_removal', 'Dumpster rental', 'BinCo', 1, 420, 13, 'approved', v_owner);

  -- documents (metadata only: no file is uploaded to Storage by this seed) ---------------------------------------------------
  insert into public.documents (id, organization_id, name, document_type, category, origin_module, status, uploaded_by, tags) values
    (pg_temp.sid('doc:lease1'), v_org, 'Lease Cedar 2B.pdf', 'Lease agreement', 'Lease & tenancy', 'Leases', 'signed', v_owner, array['lease','cedar']),
    (pg_temp.sid('doc:policy'), v_org, 'Building insurance policy 2026.pdf', 'Insurance policy', 'Property records', 'Properties', 'active', v_owner, array['insurance']);
  insert into public.document_versions (organization_id, document_id, version_number, storage_bucket, storage_path, file_name, mime_type, size_bytes, sha256, uploaded_by) values
    (v_org, pg_temp.sid('doc:lease1'), 1, 'lease-documents', v_org::text || '/leases/demo/lease-cedar-2b.pdf', 'lease-cedar-2b.pdf', 'application/pdf', 184000, md5('demo-1') || md5('demo-2'), v_owner),
    (v_org, pg_temp.sid('doc:policy'), 1, 'lease-documents', v_org::text || '/properties/demo/insurance-2026.pdf', 'insurance-2026.pdf', 'application/pdf', 96000, md5('demo-3') || md5('demo-4'), v_owner);
  update public.documents d set current_version_id = v.id from public.document_versions v where v.document_id = d.id and v.version_number = 1 and d.organization_id = v_org;
  insert into public.document_links (organization_id, document_id, entity_type, entity_id, entity_label, is_primary) values
    (v_org, pg_temp.sid('doc:lease1'), 'lease', pg_temp.sid('lease:1'), 'Cedar 2B lease', true), (v_org, pg_temp.sid('doc:policy'), 'property', v_prop_harbor, 'Harbor House', true);

  -- communication ------------------------------------------------------------------------------------------------------
  insert into public.message_templates (id, organization_id, name, category, channel, subject, body, plain_text_body, status, event_context, created_by) values
    (pg_temp.sid('tpl:overdue'), v_org, 'Rent overdue reminder', 'Finance', 'email', 'Rent reminder for {{unit_number}}', '<p>Hello {{tenant_first_name}}, your rent is overdue.</p>', 'Hello {{tenant_first_name}}, your rent is overdue.', 'active', 'invoice.overdue', v_owner),
    (pg_temp.sid('tpl:visit'), v_org, 'Maintenance visit SMS', 'Maintenance', 'sms', '', 'A technician will visit on {{visit_date}}.', 'A technician will visit on {{visit_date}}.', 'active', 'maintenance.visit_scheduled', v_owner),
    (pg_temp.sid('tpl:draft'), v_org, 'Lease renewal offer (draft)', 'Leases', 'email', 'Your lease renewal', '<p>Draft.</p>', 'Draft.', 'draft', 'lease.expiring_soon', v_owner);
  insert into public.automation_rules (id, organization_id, name, event_type, template_id, channel, status, delay_amount, delay_unit, created_by)
  values (pg_temp.sid('rule:overdue'), v_org, 'Overdue rent reminder - 3 days', 'invoice.overdue', pg_temp.sid('tpl:overdue'), 'email', 'active', 3, 'days', v_owner);
  insert into public.automation_rule_conditions (organization_id, rule_id, position, field, operator, value) values (v_org, pg_temp.sid('rule:overdue'), 1, 'days_overdue', 'greater_or_equal', '3');
  insert into public.communication_logs (organization_id, template_id, template_version, recipient_name, recipient_email, rendered_subject, rendered_body, channel, status, trigger_source, attempt_count, is_mock, initiated_by, sent_at)
  values (v_org, pg_temp.sid('tpl:overdue'), 1, 'Ava Thompson', 'ava@example.test', 'Rent reminder for 2B', 'Hello Ava, your rent is overdue.', 'email', 'sent', 'test', 1, true, v_owner, now() - interval '1 day');
  insert into public.conversations (id, organization_id, subject, category, priority, status, created_by, assigned_to) values (pg_temp.sid('conv:1'), v_org, 'Heating in Harbor House unit 4', 'Maintenance', 'urgent', 'in_progress', v_owner, v_owner);
  insert into public.conversation_participants (organization_id, conversation_id, participant_type, user_id) values (v_org, pg_temp.sid('conv:1'), 'staff', v_owner);
  insert into public.conversation_participants (organization_id, conversation_id, participant_type, tenant_id) values (v_org, pg_temp.sid('conv:1'), 'tenant', pg_temp.sid('tenant:jordan'));
  insert into public.messages (organization_id, conversation_id, sender_type, sender_tenant_id, body, channel, delivery_status) values (v_org, pg_temp.sid('conv:1'), 'tenant', pg_temp.sid('tenant:jordan'), 'The radiators are cold again.', 'email', 'delivered');
  insert into public.messages (organization_id, conversation_id, sender_type, sender_user_id, body, channel, delivery_status) values (v_org, pg_temp.sid('conv:1'), 'staff', v_owner, 'A contractor is on the way.', 'email', 'sent');
  insert into public.scheduled_tasks (organization_id, name, task_type, schedule_type, run_time, next_run_at, created_by) values
    (v_org, 'Monthly rent invoices', 'rent_invoice_generation', 'monthly', '01:00', date_trunc('month', now() + interval '1 month'), v_owner),
    (v_org, 'Lease expiry check', 'lease_expiry_check', 'daily', '02:00', date_trunc('day', now() + interval '1 day'), v_owner);

  -- a few audit events from other modules (the member, payment and invoice flows already wrote theirs)
  perform private.log_activity(v_org, v_owner, 'user', 'property.updated', 'Properties & Units', 'Cedar Court details updated.', 'property', v_prop_cedar::text, 'Cedar Court',
    '[{"field":"parkingSpaces","label":"Parking spaces","previousValue":"18","newValue":"20","changeType":"modified"}]'::jsonb, 'success', 'informational', 'Properties', null, '{}'::jsonb, v_prop_cedar);
  perform private.log_activity(v_org, null, 'system', 'lease.signed', 'Documents & eSignatures', 'Lease for Cedar 2B signed by all parties.', 'lease', pg_temp.sid('lease:1')::text, 'Cedar 2B lease');
  raise notice 'Demo organization created: Maple Ridge Rentals (demo)';
end $seed$;
