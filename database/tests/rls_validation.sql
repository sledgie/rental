-- =====================================================================================================================
-- rls_validation.sql
-- Row-Level Security and privilege tests with several simulated Supabase users (JWT claims + the `authenticated` / `anon` database
-- roles): tenant isolation between organizations, role-based read/write rights, sensitive data, views, Storage policies,
-- invitations, messaging, audit trail and service-only functions.
-- Requires the fixtures created by data_integrity_validation.sql (run schema_validation.sql and data_integrity_validation.sql first).
-- =====================================================================================================================
delete from public.test_results where suite = 'rls';

create or replace function public.test_visible(p_user uuid, p_sql text) returns bigint
language plpgsql as $fn$
declare v bigint;
begin
  perform public.test_login(p_user);
  begin
    execute 'select count(*) from (' || p_sql || ') q' into v;
  exception when others then
    perform public.test_logout();
    return -1;
  end;
  perform public.test_logout();
  return v;
end $fn$;

create or replace function public.test_as(p_user uuid, p_sql text) returns text
language plpgsql as $fn$
declare v text;
begin
  perform public.test_login(p_user);
  v := public.test_err(p_sql);
  perform public.test_logout();
  return v;
end $fn$;

create or replace function public.test_affected(p_user uuid, p_sql text) returns bigint
language plpgsql as $fn$
declare v bigint;
begin
  perform public.test_login(p_user);
  begin
    execute p_sql;
    get diagnostics v = row_count;
  exception when others then
    v := -1;
  end;
  perform public.test_logout();
  return v;
end $fn$;

do $$
declare
  a uuid := public.test_uuid('org_a'); b uuid := public.test_uuid('org_b');
  owner_a uuid := 'a0000000-0000-4000-8000-000000000001'; pm uuid := 'a0000000-0000-4000-8000-000000000002'; acct uuid := 'a0000000-0000-4000-8000-000000000003';
  maint uuid := 'a0000000-0000-4000-8000-000000000004'; ro uuid := 'a0000000-0000-4000-8000-000000000005'; adm uuid := 'a0000000-0000-4000-8000-000000000006';
  owner_b uuid := 'b0000000-0000-4000-8000-000000000001'; outsider uuid := 'c0000000-0000-4000-8000-000000000001';
  v_err text; v_n bigint; v_t text; v_cat uuid;
begin
  select id into v_cat from public.expense_categories where organization_id = a order by name limit 1;
  -- the fixtures (as superuser) -------------------------------------------------------------------------------------------
  perform public.test_check('rls', 'fixtures exist: 2 properties, 3 tenants and invoices in org A', (select count(*) from public.properties where organization_id = a) = 2
    and (select count(*) from public.tenants where organization_id = a) = 2 and (select count(*) from public.invoices where organization_id = a) >= 3);

  -- ================= anonymous and outsiders ==================================================================================
  perform public.test_login_anon();
  foreach v_t in array array['properties', 'tenants', 'invoices', 'organizations', 'profiles', 'activity_events', 'documents', 'payments'] loop
    v_err := public.test_err('select * from public.' || v_t);
    perform public.test_check('rls', 'anon cannot read ' || v_t, v_err like '42501%', v_err);
  end loop;
  v_err := public.test_err($q$select public.create_organization('Anon Org')$q$);
  perform public.test_check('rls', 'anon cannot call create_organization', v_err like '42501%', v_err);
  perform public.test_logout();

  foreach v_t in array array['properties', 'tenants', 'invoices', 'payments', 'documents', 'accounts', 'activity_events', 'leases', 'units', 'vendors', 'organization_members',
                             'organization_settings', 'journal_entries', 'maintenance_requests', 'conversations', 'bills'] loop
    perform public.test_check('rls', 'a signed-in user without membership sees no rows of ' || v_t, public.test_visible(outsider, 'select * from public.' || v_t) = 0,
                              public.test_visible(outsider, 'select * from public.' || v_t));
  end loop;
  perform public.test_check('rls', 'a non-member cannot see any organization', public.test_visible(outsider, 'select * from public.organizations') = 0);
  perform public.test_check('rls', 'a non-member sees only their own profile', public.test_visible(outsider, 'select * from public.profiles') = 1);

  -- ================= organization B vs organization A ============================================================================
  perform public.test_check('rls', 'org B owner sees exactly org B''s property', public.test_visible(owner_b, 'select * from public.properties') = 1);
  perform public.test_check('rls', 'org B owner cannot see org A rows even by exact id',
    public.test_visible(owner_b, 'select * from public.tenants where id = ''33333333-0000-4000-8000-000000000001''') = 0
    and public.test_visible(owner_b, format('select * from public.properties where organization_id = %L', a)) = 0);
  perform public.test_check('rls', 'org B owner sees only org B''s organization row', public.test_visible(owner_b, 'select * from public.organizations') = 1);
  perform public.test_check('rls', 'org B owner sees only org B''s accounts',
    public.test_visible(owner_b, format('select * from public.accounts where organization_id = %L', a)) = 0 and public.test_visible(owner_b, 'select * from public.accounts') > 50);
  v_err := public.test_as(owner_b, format($q$insert into public.properties (organization_id, name, address_line1, city) values (%L, 'Hijack', 'x', 'y')$q$, a));
  perform public.test_check('rls', 'org B owner cannot insert into org A (RLS WITH CHECK)', v_err like '42501%', v_err);
  perform public.test_check('rls', 'org B owner cannot update org A rows', public.test_affected(owner_b, format($q$update public.properties set name = 'Hacked' where organization_id = %L$q$, a)) = 0);
  perform public.test_check('rls', 'org B owner cannot delete org A rows', public.test_affected(owner_b, format($q$delete from public.tenants where organization_id = %L$q$, a)) = 0);
  perform public.test_check('rls', 'org B owner cannot move a row into org A by changing organization_id',
    public.test_as(owner_b, format($q$update public.properties set organization_id = %L where organization_id = %L$q$, a, b)) like '42501%');
  v_err := public.test_as(owner_b, format($q$insert into public.units (organization_id, property_id, unit_number) values (%L, '11111111-0000-4000-8000-000000000001', 'Z9')$q$, b));
  perform public.test_check('rls', 'org B owner cannot attach a unit to org A''s property (foreign key + RLS)', v_err is not null, v_err);
  perform public.test_check('rls', 'org A data is untouched after the attempts', (select count(*) from public.properties where organization_id = a and name <> 'Hacked') = 2);

  -- ================= property manager ============================================================================================
  perform public.test_check('rls', 'property manager reads properties, tenants and invoices', public.test_visible(pm, 'select * from public.properties') = 2
    and public.test_visible(pm, 'select * from public.tenants') = 2 and public.test_visible(pm, 'select * from public.invoices') >= 3);
  perform public.test_check('rls', 'property manager can create properties', public.test_as(pm, format($q$insert into public.properties (organization_id, name, address_line1, city) values (%L, 'PM Property', '1 St', 'Toronto')$q$, a)) is null);
  perform public.test_check('rls', 'property manager cannot create invoices (no manage_finance)', public.test_as(pm, format($q$insert into public.invoices (organization_id, tenant_id, due_date) values (%L, '33333333-0000-4000-8000-000000000001', current_date)$q$, a)) like '42501%');
  perform public.test_check('rls', 'property manager cannot post journal entries', public.test_as(pm, format($q$insert into public.journal_entries (organization_id, entry_date) values (%L, current_date)$q$, a)) like '42501%');
  perform public.test_check('rls', 'property manager sees sensitive documents and identification records',
    public.test_visible(pm, 'select * from public.tenant_id_documents') = 1 and public.test_visible(pm, format('select * from public.documents where id = %L', public.test_uuid('doc_sensitive'))) = 1);
  perform public.test_check('rls', 'property manager cannot read the audit log', public.test_visible(pm, 'select * from public.activity_events') = 0);
  perform public.test_check('rls', 'property manager cannot manage members', public.test_affected(pm, format($q$update public.organization_members set role = 'read_only' where organization_id = %L and user_id = %L$q$, a, ro)) = 0);
  perform public.test_check('rls', 'property manager cannot change the organization profile', public.test_affected(pm, format($q$update public.organizations set name = 'Renamed' where id = %L$q$, a)) = 0);

  -- ================= accountant ==============================================================================================
  perform public.test_check('rls', 'accountant reads finance and tenancy data', public.test_visible(acct, 'select * from public.invoices') >= 3 and public.test_visible(acct, 'select * from public.tenants') = 2
    and public.test_visible(acct, 'select * from public.accounts') > 50);
  perform public.test_check('rls', 'accountant can record expenses', public.test_as(acct, format($q$insert into public.expenses (organization_id, category_id, expense_date, amount, description, created_by)
      select %L, id, current_date, 55, 'Office supplies', %L from public.expense_categories where organization_id = %L limit 1$q$, a, acct, a)) is null);
  perform public.test_check('rls', 'accountant can issue payments through record_payment', public.test_as(acct, format($q$select public.record_payment(%L, '33333333-0000-4000-8000-000000000002', %L, current_date, 10, 'cash')$q$, a, public.test_uuid('lease_2'))) is null);
  perform public.test_check('rls', 'accountant cannot create properties or tenants',
    public.test_as(acct, format($q$insert into public.properties (organization_id, name, address_line1, city) values (%L, 'Nope', 'x', 'y')$q$, a)) like '42501%'
    and public.test_as(acct, format($q$insert into public.tenants (organization_id, first_name) values (%L, 'Nope')$q$, a)) like '42501%');
  perform public.test_check('rls', 'accountant cannot see identification records or sensitive documents',
    public.test_visible(acct, 'select * from public.tenant_id_documents') = 0 and public.test_visible(acct, format('select * from public.documents where id = %L', public.test_uuid('doc_sensitive'))) = 0
    and public.test_visible(acct, 'select * from public.tenant_private_details') = 0);
  perform public.test_check('rls', 'accountant can read the audit log', public.test_visible(acct, 'select * from public.activity_events') > 0);
  perform public.test_check('rls', 'accountant can read communications but not manage them', public.test_visible(acct, 'select * from public.message_templates') >= 0
    and public.test_as(acct, format($q$insert into public.message_templates (organization_id, name) values (%L, 'Nope')$q$, a)) like '42501%');

  -- ================= maintenance staff =======================================================================================
  perform public.test_check('rls', 'maintenance staff see properties and units', public.test_visible(maint, 'select * from public.properties') >= 2 and public.test_visible(maint, 'select * from public.units') >= 2);
  perform public.test_check('rls', 'maintenance staff cannot see tenants, leases, invoices or accounts',
    public.test_visible(maint, 'select * from public.tenants') = 0 and public.test_visible(maint, 'select * from public.leases') = 0
    and public.test_visible(maint, 'select * from public.invoices') = 0 and public.test_visible(maint, 'select * from public.accounts') = 0
    and public.test_visible(maint, 'select * from public.payments') = 0 and public.test_visible(maint, 'select * from public.v_invoice_balances') = 0);
  perform public.test_check('rls', 'maintenance staff can create maintenance requests',
    public.test_as(maint, format($q$insert into public.maintenance_requests (organization_id, title, property_id, created_by) values (%L, 'Leaking tap', '11111111-0000-4000-8000-000000000001', %L)$q$, a, maint)) is null);
  perform public.test_check('rls', 'maintenance staff read maintenance requests', public.test_visible(maint, 'select * from public.maintenance_requests') = 1);
  perform public.test_check('rls', 'maintenance staff cannot create expenses, invoices or properties',
    public.test_as(maint, format($q$insert into public.properties (organization_id, name, address_line1, city) values (%L, 'Nope', 'x', 'y')$q$, a)) like '42501%'
    and public.test_as(maint, format($q$insert into public.expenses (organization_id, category_id, expense_date, amount, description) values (%L, %L, current_date, 1, 'x')$q$, a, v_cat)) like '42501%'
    and public.test_as(maint, format($q$insert into public.invoices (organization_id, tenant_id, due_date) values (%L, '33333333-0000-4000-8000-000000000001', current_date)$q$, a)) like '42501%');
  perform public.test_check('rls', 'maintenance staff cannot read the audit log', public.test_visible(maint, 'select * from public.activity_events') = 0);
  perform public.test_check('rls', 'maintenance staff see non-sensitive documents only',
    public.test_visible(maint, format('select * from public.documents where id = %L', public.test_uuid('doc_a'))) = 1 and public.test_visible(maint, format('select * from public.documents where id = %L', public.test_uuid('doc_sensitive'))) = 0);
  perform public.test_check('rls', 'maintenance staff cannot read project or communication data', public.test_visible(maint, 'select * from public.projects') = 0 and public.test_visible(maint, 'select * from public.message_templates') = 0);

  -- ================= read-only ===============================================================================================
  perform public.test_check('rls', 'read-only members can read finance, tenancy and audit data', public.test_visible(ro, 'select * from public.invoices') >= 3 and public.test_visible(ro, 'select * from public.activity_events') > 0);
  foreach v_t in array array['properties', 'tenants', 'invoices', 'expenses', 'maintenance_requests', 'documents', 'vendors'] loop
    perform public.test_check('rls', 'read-only members cannot write ' || v_t,
      public.test_affected(ro, 'update public.' || v_t || ' set organization_id = organization_id') = 0
      and public.test_affected(ro, 'delete from public.' || v_t) = 0);
  end loop;
  v_err := public.test_as(ro, format($q$insert into public.tenants (organization_id, first_name) values (%L, 'RO')$q$, a));
  perform public.test_check('rls', 'read-only members cannot insert', v_err like '42501%', v_err);

  -- ================= administrator and owner ==================================================================================
  perform public.test_check('rls', 'administrator can update the organization profile', public.test_affected(adm, format($q$update public.organizations set phone = '555-0100' where id = %L$q$, a)) = 1);
  perform public.test_check('rls', 'administrators cannot add members directly (people join by accepting an invitation)',
    public.test_as(adm, format($q$insert into public.organization_members (organization_id, user_id, role) values (%L, %L, 'read_only')$q$, a, outsider)) like '42501%');
  perform public.test_check('rls', 'administrator can create invitations', public.test_as(adm, format($q$insert into public.organization_invitations (organization_id, email, role, invited_by) values (%L, 'future@example.test', 'read_only', %L)$q$, a, adm)) is null);
  perform public.test_check('rls', 'invitations cannot claim another user as the inviter', public.test_as(adm, format($q$insert into public.organization_invitations (organization_id, email, role, invited_by) values (%L, 'forged@example.test', 'read_only', %L)$q$, a, owner_a)) like '42501%');
  perform public.test_check('rls', 'administrator cannot invite as owner (role check)', public.test_as(adm, format($q$insert into public.organization_invitations (organization_id, email, role, invited_by) values (%L, 'boss@example.test', 'owner', %L)$q$, a, adm)) like '23514%');
  perform public.test_check('rls', 'the owner can do everything an administrator can', public.test_visible(owner_a, 'select * from public.organization_members') >= 6);

  -- ================= profiles, invitations, members =============================================================================
  perform public.test_check('rls', 'co-members see each other''s profiles but not outsiders'' profiles',
    public.test_visible(acct, format('select * from public.profiles where id = %L', owner_a)) = 1 and public.test_visible(acct, format('select * from public.profiles where id = %L', owner_b)) = 0
    and public.test_visible(acct, format('select * from public.profiles where id = %L', outsider)) = 0);
  perform public.test_check('rls', 'users can edit only their own profile', public.test_affected(acct, format($q$update public.profiles set job_title = 'CFO' where id = %L$q$, acct)) = 1
    and public.test_affected(acct, format($q$update public.profiles set job_title = 'CEO' where id = %L$q$, owner_a)) = 0);
  perform public.test_check('rls', 'users cannot reactivate or change another profile status', public.test_as(acct, format($q$update public.profiles set status = 'deactivated' where id = %L$q$, acct)) like '42501%');
  perform public.test_check('rls', 'managers see invitations; plain members do not', public.test_visible(adm, 'select * from public.organization_invitations') >= 2 and public.test_visible(acct, 'select * from public.organization_invitations') = 0);
  insert into auth.users (id, email) values ('e0000000-0000-4000-8000-000000000001', 'future@example.test') on conflict do nothing;
  perform public.test_check('rls', 'an invitee sees only the pending invitation addressed to their email',
    public.test_visible('e0000000-0000-4000-8000-000000000001', 'select * from public.organization_invitations') = 1);
  perform public.test_check('rls', 'users cannot change their active organization to one they do not belong to',
    public.test_as(outsider, format($q$update public.user_preferences set active_organization_id = %L where user_id = %L$q$, a, outsider)) like '42501%');
  perform public.test_check('rls', 'a member can select their active organization', public.test_as(acct, format($q$select public.switch_active_organization(%L)$q$, a)) is null);
  perform public.test_check('rls', 'a non-member cannot switch into an organization', public.test_as(outsider, format($q$select public.switch_active_organization(%L)$q$, a)) like '42501%');

  -- ================= permission overrides and suspension ========================================================================
  insert into public.organization_role_permissions (organization_id, role, permission, granted) values (a, 'accountant', 'view_tenants', false);
  perform public.test_check('rls', 'an organization override can revoke a default permission', public.test_visible(acct, 'select * from public.tenants') = 0);
  perform public.test_check('rls', 'overrides are scoped to their organization (org B unaffected)', public.test_visible(owner_b, 'select * from public.tenants') = 1);
  delete from public.organization_role_permissions where organization_id = a;
  perform public.test_check('rls', 'removing the override restores the default', public.test_visible(acct, 'select * from public.tenants') = 2);
  v_err := public.test_err(format($q$insert into public.organization_role_permissions (organization_id, role, permission, granted) values (%L, 'owner', 'view_tenants', false)$q$, a));
  perform public.test_check('rls', 'the owner role cannot be restricted by an override', v_err like '23514%', v_err);
  update public.organization_members set status = 'suspended' where organization_id = a and user_id = ro;
  perform public.test_check('rls', 'a suspended member loses all access immediately', public.test_visible(ro, 'select * from public.properties') = 0 and public.test_visible(ro, 'select * from public.organizations') = 0);
  update public.organization_members set status = 'active' where organization_id = a and user_id = ro;
  update public.profiles set status = 'deactivated' where id = ro;
  perform public.test_check('rls', 'a deactivated user loses access in every organization', public.test_visible(ro, 'select * from public.properties') = 0);
  update public.profiles set status = 'active' where id = ro;
  perform public.test_check('rls', 'access returns when the user is reactivated', public.test_visible(ro, 'select * from public.properties') >= 2);

  -- ================= settings =======================================================================================================
  perform public.test_check('rls', 'accountant can save financial settings', public.test_as(acct, format($q$insert into public.organization_settings (organization_id, category, value, updated_by) values (%L, 'financial', '{"invoicePrefix": "INV-"}', %L)$q$, a, acct)) is null);
  perform public.test_check('rls', 'accountant cannot save maintenance settings', public.test_as(acct, format($q$insert into public.organization_settings (organization_id, category, value) values (%L, 'maintenance', '{}')$q$, a)) like '42501%');
  perform public.test_check('rls', 'maintenance staff can save maintenance settings but not financial ones',
    public.test_as(maint, format($q$insert into public.organization_settings (organization_id, category, value) values (%L, 'maintenance', '{"emergencyResponseHours": 4}')$q$, a)) is null
    and public.test_affected(maint, format($q$update public.organization_settings set value = '{}' where organization_id = %L and category = 'financial'$q$, a)) = 0);
  perform public.test_check('rls', 'all members can read settings; outsiders cannot', public.test_visible(ro, 'select * from public.organization_settings') = 2 and public.test_visible(outsider, 'select * from public.organization_settings') = 0);
  perform public.test_check('rls', 'settings must be JSON objects', public.test_err(format($q$insert into public.organization_settings (organization_id, category, value) values (%L, 'general', '[1]')$q$, a)) like '23514%');

  -- ================= audit trail =====================================================================================================
  v_err := public.test_as(owner_a, format($q$insert into public.activity_events (organization_id, actor_display_name, action, category, description, entity_type, entity_id, previous_hash, event_hash) values (%L, 'Forged', 'a.b', 'Users & Security', 'x', 'x', 'x', '', 'forged')$q$, a));
  perform public.test_check('rls', 'not even the owner can insert audit events directly', v_err like '42501%', v_err);
  perform public.test_check('rls', 'audit events cannot be updated or deleted through the API', public.test_affected(owner_a, 'update public.activity_events set description = ''x''') in (0, -1) and public.test_affected(owner_a, 'delete from public.activity_events') in (0, -1));
  v_n := (select count(*) from public.activity_events where organization_id = a);
  perform public.test_as(ro, format($q$select public.record_activity(%L, 'document.downloaded', 'Documents & eSignatures', 'Downloaded the lease', 'document', %L, 'Lease LSE-00001')$q$, a, public.test_uuid('doc_a')::text));
  perform public.test_check('rls', 'record_activity stores the event with the caller as actor (never a client-supplied actor)',
    (select count(*) from public.activity_events where organization_id = a) = v_n + 1
    and (select actor_id from public.activity_events where organization_id = a and action = 'document.downloaded') = ro and (select actor_type from public.activity_events where organization_id = a and action = 'document.downloaded') = 'user');
  perform public.test_as(owner_a, format($q$select public.record_activity(%L, 'user.permissions_changed', 'Users & Security', 'Permissions edited', 'user', %L, 'Perm edit',
      jsonb_build_array(jsonb_build_object('field', 'ssn', 'label', 'Secret', 'previousValue', 'old-secret', 'newValue', 'new-secret', 'changeType', 'modified', 'sensitivity', 'restricted')),
      'success', 'warning', 'Security', null, '{}'::jsonb, null, null, null, '', '{"ipAddress": "203.0.113.9", "userAgent": "test"}'::jsonb)$q$, a, owner_a::text));
  perform public.test_check('rls', 'restricted change values are removed from the readable audit event',
    (select changes -> 0 ->> 'newValue' from public.activity_events where organization_id = a and action = 'user.permissions_changed') is null
    and (select changes -> 0 ->> 'field' from public.activity_events where organization_id = a and action = 'user.permissions_changed') = 'ssn');
  perform public.test_check('rls', 'restricted audit detail is visible only with view_audit_log AND view_sensitive',
    public.test_visible(owner_a, 'select * from public.activity_event_details') = 1 and public.test_visible(acct, 'select * from public.activity_event_details') = 0
    and public.test_visible(pm, 'select * from public.activity_event_details') = 0 and public.test_visible(outsider, 'select * from public.activity_event_details') = 0
    and (select sensitive -> 'metadata' ->> 'ipAddress' from public.activity_event_details limit 1) = '203.0.113.9');
  perform set_config('request.jwt.claim.sub', owner_a::text, true);
  perform public.test_check('rls', 'the audit chain still verifies with restricted details attached', (select valid from public.verify_activity_chain(a)));
  perform set_config('request.jwt.claim.sub', '', true);
  v_err := public.test_as(acct, format($q$select public.record_audit_export(%L, 'activity-logs.csv', '{"category": "Users & Security"}'::jsonb, 12)$q$, a));
  perform public.test_check('rls', 'exporting the audit trail is recorded atomically (event + audit_exports) for permitted members',
    v_err is null
    and (select count(*) from public.audit_exports where organization_id = a and file_name = 'activity-logs.csv') = 1
    and exists (select 1 from public.activity_events where organization_id = a and action = 'audit.exported' and severity = 'warning'), v_err);
  perform public.test_check('rls', 'members without export_data or view_audit_log cannot record an export',
    public.test_as(maint, format($q$select public.record_audit_export(%L, 'x.csv', '{}', 1)$q$, a)) like '42501%' and public.test_as(pm, format($q$select public.record_audit_export(%L, 'x.csv', '{}', 1)$q$, a)) like '42501%');
  perform public.test_check('rls', 'a non-member cannot record activity in an organization', public.test_as(outsider, format($q$select public.record_activity(%L, 'a.b', 'Users & Security', 'x', 'x', 'x')$q$, a)) like '42501%');
  perform public.test_check('rls', 'authenticated users cannot call the internal audit writer', public.test_as(owner_a, format($q$select private.log_activity(%L, null, 'system', 'a.b', 'Users & Security', 'x', 'x', 'x')$q$, a)) like '42501%');
  perform public.test_check('rls', 'org B''s audit trail is separate', public.test_visible(owner_b, 'select * from public.activity_events') >= 1 and public.test_visible(owner_b, format('select * from public.activity_events where organization_id = %L', a)) = 0);
  v_err := public.test_as(maint, format($q$select * from public.verify_activity_chain(%L)$q$, a));
  perform public.test_check('rls', 'verify_activity_chain refuses members without view_audit_log', v_err like '42501%', v_err);
  v_err := public.test_as(acct, format($q$select * from public.verify_activity_chain(%L)$q$, a));
  perform public.test_check('rls', 'verify_activity_chain works for members with view_audit_log', v_err is null, v_err);

  -- ================= views respect RLS ===============================================================================================
  perform public.test_check('rls', 'views run with the caller''s rights', public.test_visible(acct, 'select * from public.v_invoice_balances') >= 3 and public.test_visible(owner_b, 'select * from public.v_invoice_balances') = 0
    and public.test_visible(outsider, 'select * from public.v_tenant_balances') = 0 and public.test_visible(owner_b, 'select * from public.v_trial_balance') > 0
    and public.test_visible(owner_b, format('select * from public.v_trial_balance where organization_id = %L', a)) = 0);

  -- ================= messaging =======================================================================================================
  insert into public.conversations (id, organization_id, subject, created_by, assigned_to) values ('66666666-0000-4000-8000-000000000001', a, 'Roof leak', owner_a, null);
  insert into public.conversation_participants (organization_id, conversation_id, participant_type, user_id) values (a, '66666666-0000-4000-8000-000000000001', 'staff', owner_a);
  insert into public.messages (organization_id, conversation_id, sender_type, sender_user_id, body) values (a, '66666666-0000-4000-8000-000000000001', 'staff', owner_a, 'We are on it');
  perform public.test_check('rls', 'managers see every conversation; read-only staff only when they take part',
    public.test_visible(pm, 'select * from public.conversations') = 1 and public.test_visible(ro, 'select * from public.conversations') = 0 and public.test_visible(ro, 'select * from public.messages') = 0);
  insert into public.conversation_participants (organization_id, conversation_id, participant_type, user_id) values (a, '66666666-0000-4000-8000-000000000001', 'staff', ro);
  perform public.test_check('rls', 'participants can read their conversation and its messages', public.test_visible(ro, 'select * from public.conversations') = 1 and public.test_visible(ro, 'select * from public.messages') = 1);
  perform public.test_check('rls', 'a read-only participant cannot post messages', public.test_as(ro, format($q$insert into public.messages (organization_id, conversation_id, sender_type, sender_user_id, body) values (%L, '66666666-0000-4000-8000-000000000001', 'staff', %L, 'hi')$q$, a, ro)) like '42501%');
  perform public.test_check('rls', 'staff cannot post messages as someone else', public.test_as(pm, format($q$insert into public.messages (organization_id, conversation_id, sender_type, sender_user_id, body) values (%L, '66666666-0000-4000-8000-000000000001', 'staff', %L, 'fake')$q$, a, owner_a)) like '42501%');
  perform public.test_check('rls', 'a manager can reply as themselves', public.test_as(pm, format($q$insert into public.messages (organization_id, conversation_id, sender_type, sender_user_id, body) values (%L, '66666666-0000-4000-8000-000000000001', 'staff', %L, 'ok')$q$, a, pm)) is null);
  perform public.test_check('rls', 'maintenance staff (no communications access) see no conversations', public.test_visible(maint, 'select * from public.conversations') = 0);
  insert into public.notifications (organization_id, user_id, notification_type, title) values (a, pm, 'message', 'For PM'), (a, acct, 'message', 'For accountant');
  perform public.test_check('rls', 'notifications are private to their recipient', public.test_visible(pm, $q$select * from public.notifications where title like 'For %'$q$) = 1 and public.test_visible(acct, $q$select * from public.notifications where title like 'For %'$q$) = 1
    and public.test_visible(owner_a, $q$select * from public.notifications where title like 'For %'$q$) = 0);
  perform public.test_check('rls', 'a user can mark only their own notification read', public.test_affected(pm, $q$update public.notifications set read_at = now() where title like 'For %'$q$) = 1);

  -- ================= service-only and sensitive functions ===================================================================
  v_err := public.test_as(owner_a, $q$select * from public.claim_due_scheduled_tasks('hacker')$q$);
  perform public.test_check('rls', 'users cannot claim scheduled tasks (service role only)', v_err like '42501%', v_err);
  v_err := public.test_as(owner_a, format($q$select public.enqueue_workflow_execution(%L, gen_random_uuid(), 'x', null)$q$, a));
  perform public.test_check('rls', 'users cannot enqueue workflow executions directly', v_err like '42501%', v_err);
  v_err := public.test_as(owner_a, format($q$select private.seed_organization_defaults(%L)$q$, a));
  perform public.test_check('rls', 'users cannot call the organization seed function', v_err like '42501%', v_err);
  v_err := public.test_as(owner_a, $q$select * from private.activity_events_chain$q$);
  perform public.test_check('rls', 'internal functions are not exposed as relations', v_err is not null);
  v_err := public.test_as(owner_a, format($q$insert into public.organization_counters (organization_id, counter_key, last_value) values (%L, 'invoice', 0)$q$, a));
  perform public.test_check('rls', 'counters cannot be tampered with by users', v_err like '42501%', v_err);
  v_err := public.test_as(acct, format($q$select public.close_books(%L, current_date)$q$, a));
  perform public.test_check('rls', 'the accountant may close the books (manage_finance)', v_err is null, v_err);
  v_err := public.test_as(ro, format($q$select public.close_books(%L, current_date + 400)$q$, a));
  perform public.test_check('rls', 'read-only members cannot close the books', v_err like '42501%', v_err);
  v_err := public.test_as(acct, format($q$select public.close_books(%L, current_date - 400)$q$, a));
  perform public.test_check('rls', 'only an owner can reopen a closed period', v_err like '42501%', v_err);
  update public.organizations set books_closed_through = null where id = a;

  -- ================= sensitive/finance writes from the API cannot touch protected data =====================================
  perform public.test_check('rls', 'users cannot delete posted journal entries via the API', public.test_affected(acct, 'delete from public.journal_entries where status = ''posted''') in (0, -1));
  perform public.test_check('rls', 'users cannot delete payments via the API (no delete policy)', public.test_affected(acct, 'delete from public.payments') in (0, -1));
  perform public.test_check('rls', 'users cannot delete activity or signature evidence via the API', public.test_affected(owner_a, 'delete from public.signature_events') in (0, -1));
end $$;

-- ===================================================================================================================
-- Storage policies
-- ===================================================================================================================
do $$
declare
  a uuid := public.test_uuid('org_a'); b uuid := public.test_uuid('org_b');
  owner_a uuid := 'a0000000-0000-4000-8000-000000000001'; pm uuid := 'a0000000-0000-4000-8000-000000000002'; acct uuid := 'a0000000-0000-4000-8000-000000000003';
  maint uuid := 'a0000000-0000-4000-8000-000000000004'; ro uuid := 'a0000000-0000-4000-8000-000000000005'; owner_b uuid := 'b0000000-0000-4000-8000-000000000001';
  outsider uuid := 'c0000000-0000-4000-8000-000000000001';
  v_registered text := a::text || '/leases/lse-1/v1.pdf'; v_err text;
  v_doc uuid := public.test_uuid('doc_sensitive');
begin
  -- a registered, sensitive identification scan and a registered ordinary lease file, plus stray objects
  insert into public.document_versions (organization_id, document_id, version_number, storage_bucket, storage_path, file_name)
    values (a, v_doc, 1, 'tenant-identification', a::text || '/ids/ava/passport.jpg', 'passport.jpg');
  insert into storage.objects (bucket_id, name) values
    ('lease-documents', v_registered),
    ('lease-documents', a::text || '/leases/unregistered.pdf'),
    ('lease-documents', b::text || '/leases/org-b.pdf'),
    ('tenant-identification', a::text || '/ids/ava/passport.jpg'),
    ('signed-documents', a::text || '/signed/lse-1.pdf'),
    ('finance-documents', a::text || '/receipts/r1.pdf'),
    ('property-images', a::text || '/properties/cedar/cover.jpg'),
    ('organization-assets', a::text || '/logo.png');

  perform public.test_check('rls', 'storage: a registered lease file is visible to members with view_documents',
    public.test_visible(pm, format($q$select * from storage.objects where bucket_id = 'lease-documents' and name = %L$q$, v_registered)) = 1
    and public.test_visible(maint, format($q$select * from storage.objects where bucket_id = 'lease-documents' and name = %L$q$, v_registered)) = 1);
  perform public.test_check('rls', 'storage: an object that is not registered as a document version is invisible even to members',
    public.test_visible(pm, format($q$select * from storage.objects where name = %L$q$, a::text || '/leases/unregistered.pdf')) = 0);
  perform public.test_check('rls', 'storage: other organizations'' files and outsiders see nothing',
    public.test_visible(owner_b, format($q$select * from storage.objects where name like %L$q$, a::text || '/%')) = 0 and public.test_visible(outsider, 'select * from storage.objects') = 0
    and public.test_visible(pm, format($q$select * from storage.objects where name = %L$q$, b::text || '/leases/org-b.pdf')) = 0);
  perform public.test_check('rls', 'storage: identification scans need view_sensitive (and a registered, sensitive document)',
    public.test_visible(pm, $q$select * from storage.objects where bucket_id = 'tenant-identification'$q$) = 1
    and public.test_visible(acct, $q$select * from storage.objects where bucket_id = 'tenant-identification'$q$) = 0
    and public.test_visible(maint, $q$select * from storage.objects where bucket_id = 'tenant-identification'$q$) = 0);
  perform public.test_check('rls', 'storage: property images follow view_properties', public.test_visible(maint, $q$select * from storage.objects where bucket_id = 'property-images'$q$) = 1
    and public.test_visible(outsider, $q$select * from storage.objects where bucket_id = 'property-images'$q$) = 0);
  perform public.test_check('rls', 'storage: finance files need view_finance (unregistered here, so hidden from everyone)', public.test_visible(acct, $q$select * from storage.objects where bucket_id = 'finance-documents'$q$) = 0);
  perform public.test_check('rls', 'storage: organization assets (logo) are readable by members', public.test_visible(ro, $q$select * from storage.objects where bucket_id = 'organization-assets'$q$) = 1);

  v_err := public.test_as(acct, format($q$insert into storage.objects (bucket_id, name, owner_id) values ('lease-documents', %L, %L)$q$, a::text || '/leases/new.pdf', acct::text));
  perform public.test_check('rls', 'storage: members with upload_documents can upload into their organization folder', v_err is null, v_err);
  v_err := public.test_as(acct, format($q$insert into storage.objects (bucket_id, name) values ('lease-documents', %L)$q$, b::text || '/leases/evil.pdf'));
  perform public.test_check('rls', 'storage: uploading into another organization''s folder is denied', v_err like '42501%', v_err);
  v_err := public.test_as(acct, $q$insert into storage.objects (bucket_id, name) values ('lease-documents', 'not-an-org/evil.pdf')$q$);
  perform public.test_check('rls', 'storage: a path without an organization folder is denied', v_err like '42501%', v_err);
  v_err := public.test_as(ro, format($q$insert into storage.objects (bucket_id, name) values ('lease-documents', %L)$q$, a::text || '/leases/ro.pdf'));
  perform public.test_check('rls', 'storage: read-only members cannot upload', v_err like '42501%', v_err);
  v_err := public.test_as(owner_a, format($q$insert into storage.objects (bucket_id, name) values ('signed-documents', %L)$q$, a::text || '/signed/forged.pdf'));
  perform public.test_check('rls', 'storage: nobody can upload into signed-documents through the API', v_err like '42501%', v_err);
  v_err := public.test_as(acct, format($q$insert into storage.objects (bucket_id, name) values ('tenant-identification', %L)$q$, a::text || '/ids/x.jpg'));
  perform public.test_check('rls', 'storage: accountants cannot upload identification scans', v_err like '42501%', v_err);
  v_err := public.test_as(pm, format($q$insert into storage.objects (bucket_id, name) values ('tenant-identification', %L)$q$, a::text || '/ids/bea/id.jpg'));
  perform public.test_check('rls', 'storage: property managers can upload identification scans', v_err is null, v_err);
  perform public.test_check('rls', 'storage: the uploader can see their own not-yet-registered upload, nobody else can',
    public.test_visible(acct, format($q$select * from storage.objects where name = %L$q$, a::text || '/leases/new.pdf')) = 1
    and public.test_visible(maint, format($q$select * from storage.objects where name = %L$q$, a::text || '/leases/new.pdf')) = 0);
  perform public.test_check('rls', 'storage: only document managers may delete lease files',
    public.test_affected(maint, format($q$delete from storage.objects where bucket_id = 'lease-documents' and name = %L$q$, v_registered)) = 0
    and public.test_affected(acct, format($q$delete from storage.objects where bucket_id = 'lease-documents' and name = %L$q$, a::text || '/leases/new.pdf')) = 0
    and public.test_affected(pm, format($q$delete from storage.objects where bucket_id = 'lease-documents' and name = %L$q$, v_registered)) = 1);
  perform public.test_check('rls', 'storage: a member cannot overwrite another organization''s object',
    public.test_affected(owner_b, format($q$update storage.objects set owner = null where name = %L$q$, v_registered)) = 0);
  perform public.test_check('rls', 'users cannot register a version as immutable/signed (only the signing service can)',
    public.test_as(pm, format($q$insert into public.document_versions (organization_id, document_id, version_number, storage_bucket, storage_path, file_name, is_immutable, uploaded_by) values (%L, %L, 9, 'lease-documents', %L, 'x.pdf', true, %L)$q$, a, public.test_uuid('doc_a'), a::text || '/leases/x9.pdf', pm)) like '42501%');
  v_err := public.test_as(ro, format($q$insert into storage.objects (bucket_id, name) values ('organization-assets', %L)$q$, a::text || '/avatars/' || ro::text || '/me.png'));
  perform public.test_check('rls', 'storage: a user can upload their own avatar', v_err is null, v_err);
  v_err := public.test_as(ro, format($q$insert into storage.objects (bucket_id, name) values ('organization-assets', %L)$q$, a::text || '/avatars/' || acct::text || '/me.png'));
  perform public.test_check('rls', 'storage: a user cannot upload into another user''s avatar folder', v_err like '42501%', v_err);
  v_err := public.test_as(ro, format($q$insert into storage.objects (bucket_id, name) values ('organization-assets', %L)$q$, a::text || '/logo.png'));
  perform public.test_check('rls', 'storage: a read-only member cannot replace the organization logo', v_err like '42501%', v_err);
end $$;

select suite, count(*) filter (where passed) as passed, count(*) filter (where not passed) as failed from public.test_results where suite = 'rls' group by suite;
