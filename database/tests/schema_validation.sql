-- =====================================================================================================================
-- schema_validation.sql
-- Static checks of the installed schema: tables, key columns, constraints, indexes, triggers, views, function privileges,
-- RLS coverage and Storage configuration. Results are collected in public.test_results (a harness table that is NOT part of
-- the migrations). Run after all migrations. Safe to re-run.
-- =====================================================================================================================
create table if not exists public.test_results (id bigserial primary key, suite text not null, name text not null, passed boolean not null, detail text);
grant all on public.test_results to public;
grant usage, select on sequence public.test_results_id_seq to public;

create or replace function public.test_check(p_suite text, p_name text, p_cond boolean, p_detail text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into public.test_results (suite, name, passed, detail) values (p_suite, p_name, coalesce(p_cond, false), p_detail);
end $$;

create or replace function public.test_check(p_suite text, p_name text, p_cond boolean, p_detail bigint) returns void
language sql security definer set search_path = public as $$ select public.test_check(p_suite, p_name, p_cond, p_detail::text) $$;

-- run a statement and report its error (NULL when it succeeds)
create or replace function public.test_err(p_sql text) returns text
language plpgsql as $$
begin
  execute p_sql;
  return null;
exception when others then
  return sqlstate || ': ' || sqlerrm;
end $$;

create or replace function public.test_count(p_sql text) returns bigint
language plpgsql as $$
declare v bigint;
begin
  execute 'select count(*) from (' || p_sql || ') q' into v;
  return v;
end $$;

-- ---- shared helpers used by the other test files (this file must run first) ------------------------------------------------
create table if not exists public.test_ctx (key text primary key, val text);
grant all on public.test_ctx to public;
create or replace function public.test_set(p_key text, p_val text) returns void language sql security definer set search_path = public as $fn$
  insert into public.test_ctx values (p_key, p_val) on conflict (key) do update set val = excluded.val $fn$;
create or replace function public.test_get(p_key text) returns text language sql security definer set search_path = public as $fn$
  select val from public.test_ctx where key = p_key $fn$;
create or replace function public.test_uuid(p_key text) returns uuid language sql security definer set search_path = public as $fn$
  select val::uuid from public.test_ctx where key = p_key $fn$;

-- Act as a Supabase user: JWT claims + the 'authenticated' database role (what PostgREST does for a signed-in request).
create or replace function public.test_login(p_user uuid) returns void language plpgsql as $fn$
declare v_email text;
begin
  execute 'reset role';
  select email into v_email from auth.users where id = p_user;
  perform set_config('request.jwt.claim.sub', p_user::text, true);
  perform set_config('request.jwt.claim.email', coalesce(v_email, ''), true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'email', v_email, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $fn$;
create or replace function public.test_login_anon() returns void language plpgsql as $fn$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '', true);
  execute 'set local role anon';
end $fn$;
create or replace function public.test_logout() returns void language plpgsql as $fn$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.email', '', true);
  perform set_config('request.jwt.claims', '', true);
end $fn$;

delete from public.test_results where suite = 'schema';

do $$
declare
  v_expected text[] := array[
    'accounts','activity_event_details','activity_events','announcement_acknowledgements','announcement_targets','announcements','application_communications','application_parties',
    'application_reviews','application_status_history','applications','assets','audit_exports','audit_policies','automation_rule_conditions','automation_rule_properties',
    'automation_rules','bank_accounts','bank_import_batches','bank_import_mappings','bank_transactions','bill_payments','bill_schedule_runs','bill_schedule_tenants',
    'bill_schedules','bill_tenant_allocations','bill_tenant_recoveries','bill_units','bills','book_transaction_invoices','book_transactions','catalog_items',
    'communication_log_attempts','communication_logs','conversation_events','conversation_participants','conversation_stars','conversations','credit_note_applications',
    'credit_note_lines','credit_notes','deposit_interest_rates','deposit_key_devices','deposit_reconciliation_items','deposit_refunds','deposit_rules',
    'deposit_transactions','deposits','document_links','document_versions','documents','domain_events','expense_allocations','expense_categories','expenses',
    'invoice_lines','invoice_notes','invoices','journal_entries','journal_entry_lines','lease_additional_charges','lease_parties','lease_party_units',
    'lease_renewal_documents','lease_renewals','lease_units','leases','maintenance_estimates','maintenance_request_completions','maintenance_requests',
    'maintenance_schedule_checklist_items','maintenance_schedules','maintenance_visits','maintenance_work_logs','maintenance_work_orders','management_companies',
    'message_attachments','message_template_attachments','message_template_properties','message_template_versions','message_templates','messages','notification_preferences','notifications',
    'organization_counters','organization_invitations','organization_members','organization_role_permissions','organization_settings','organizations','owners',
    'payment_allocations','payment_refunds','payments','permissions','profiles','project_change_orders','project_deficiencies','project_expenses',
    'project_inspections','project_invoice_lines','project_invoices','project_milestones','project_payment_allocations','project_payments','project_purchase_orders',
    'project_quotes','project_task_dependencies','project_tasks','project_team_members','project_tenant_notifications','projects','properties',
    'property_notification_settings','property_owners','property_preferred_vendors','reconciliation_adjustments','reconciliation_match_bank_lines',
    'reconciliation_match_book_lines','reconciliation_matches','reconciliations','role_permissions','scheduled_task_runs','scheduled_tasks','signature_events',
    'signature_fields','signature_requests','signers','tenant_communication_preferences','tenant_contacts','tenant_id_documents','tenant_private_details','tenants',
    'units','user_preferences','vendor_private_details','vendor_workers','vendors','workflow_executions',
    'task_activities','task_attachments','task_categories','task_checklist_items','task_comments','task_recurrences','task_reminders','tasks'];
  v_missing text[];
  v_extra text[];
  v_views text[] := array['v_bill_balances','v_credit_balances','v_current_occupancy','v_document_expirations','v_invoice_balances','v_lease_expirations','v_leases_current',
                          'v_maintenance_dashboard','v_organization_financials','v_outstanding_invoices','v_payment_summary','v_project_progress','v_property_financials',
                          'v_tenant_balances','v_tenant_occupancy_history','v_trial_balance','v_unit_status'];
  v_name text;
begin
  -- 1. tables -----------------------------------------------------------------------------------------------------------
  select array_agg(t) into v_missing from unnest(v_expected) t where to_regclass('public.' || t) is null;
  perform public.test_check('schema', 'all ' || array_length(v_expected, 1) || ' expected tables exist', v_missing is null, array_to_string(v_missing, ','));
  select array_agg(c.relname) into v_extra from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and c.relname <> all (v_expected) and c.relname not in ('test_results', 'test_ctx');
  perform public.test_check('schema', 'no undocumented tables', v_extra is null, array_to_string(v_extra, ','));

  select array_agg(c.relname) into v_missing from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and c.relname not in ('test_results', 'test_ctx') and obj_description(c.oid, 'pg_class') is null;
  perform public.test_check('schema', 'every table has a documentation comment', v_missing is null, array_to_string(v_missing, ','));

  -- 2. RLS coverage -----------------------------------------------------------------------------------------------------
  select array_agg(c.relname) into v_missing from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity and c.relname not in ('test_results', 'test_ctx');
  perform public.test_check('schema', 'RLS is enabled on every public table', v_missing is null, array_to_string(v_missing, ','));

  select array_agg(c.relname) into v_missing from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and c.relname not in ('test_results', 'test_ctx', 'organization_counters')
     and not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname and p.cmd in ('SELECT', 'ALL'));
  perform public.test_check('schema', 'every readable table has a SELECT policy (organization_counters is intentionally closed)', v_missing is null, array_to_string(v_missing, ','));
  perform public.test_check('schema', 'organization_counters has no policy (deny all)', not exists (select 1 from pg_policies where tablename = 'organization_counters'));

  -- tables that carry organization_id must be writable only through a policy that checks membership/permission
  select array_agg(p.tablename || '.' || p.policyname) into v_missing from pg_policies p
   where p.schemaname = 'public' and p.cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
     and coalesce(p.qual, '') || coalesce(p.with_check, '') !~ '(has_permission|is_org_member|auth\.uid|can_see_conversation)';
  perform public.test_check('schema', 'no write policy is unconditional', v_missing is null, array_to_string(v_missing, ','));

  select array_agg(p.tablename || '.' || p.policyname) into v_missing from pg_policies p
   where p.schemaname in ('public', 'storage') and ('anon' = any (p.roles) or 'public' = any (p.roles));
  perform public.test_check('schema', 'no policy is granted to anon or PUBLIC', v_missing is null, array_to_string(v_missing, ','));

  select array_agg(c.relname) into v_missing from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind in ('r', 'v') and c.relname not in ('test_results', 'test_ctx')
     and (has_table_privilege('anon', c.oid, 'select') or has_table_privilege('anon', c.oid, 'insert') or has_table_privilege('anon', c.oid, 'update') or has_table_privilege('anon', c.oid, 'delete'));
  perform public.test_check('schema', 'anon has no privileges on any table or view', v_missing is null, array_to_string(v_missing, ','));

  -- 3. multi-tenant isolation structure ---------------------------------------------------------------------------------
  select array_agg(c.relname) into v_missing from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r'
     and exists (select 1 from pg_attribute a where a.attrelid = c.oid and a.attname = 'organization_id' and not a.attisdropped and a.attnotnull)
     and c.relname not in ('organizations', 'organization_counters', 'deposit_rules', 'deposit_interest_rates', 'audit_policies')
     and not exists (select 1 from pg_constraint k where k.conrelid = c.oid and k.contype = 'f' and
                     (select array_agg(att.attname::text order by att.attname) from unnest(k.conkey) u join pg_attribute att on att.attrelid = c.oid and att.attnum = u) @> array['organization_id']
                     and array_length(k.conkey, 1) = 1 and k.confrelid = 'public.organizations'::regclass)
     and not exists (select 1 from pg_constraint k where k.conrelid = c.oid and k.contype = 'f' and array_length(k.conkey, 1) = 2
                     and (select att.attname from pg_attribute att where att.attrelid = c.oid and att.attnum = k.conkey[1]) = 'organization_id');
  perform public.test_check('schema', 'every organization-owned table references its organization (directly or via composite FK)', v_missing is null, array_to_string(v_missing, ','));

  select count(*) into v_name from pg_constraint k join pg_namespace n on n.oid = k.connamespace
   where n.nspname = 'public' and k.contype = 'f' and array_length(k.conkey, 1) = 2
     and (select att.attname from pg_attribute att where att.attrelid = k.conrelid and att.attnum = k.conkey[1]) = 'organization_id';
  perform public.test_check('schema', 'composite (organization_id, id) foreign keys are widely used (>= 250)', v_name::int >= 250, v_name);

  -- 4. integrity features -----------------------------------------------------------------------------------------------
  perform public.test_check('schema', 'lease occupancy exclusion constraint exists', exists (select 1 from pg_constraint where conname = 'lease_units_no_overlap' and contype = 'x'));
  perform public.test_check('schema', 'reconciliation overlap exclusion constraint exists', exists (select 1 from pg_constraint where conname = 'reconciliations_no_overlap' and contype = 'x'));
  perform public.test_check('schema', 'deposit rule overlap exclusion constraint exists', exists (select 1 from pg_constraint where conname = 'deposit_rules_no_overlap' and contype = 'x'));
  perform public.test_check('schema', 'recurring rent invoice uniqueness index exists', exists (select 1 from pg_indexes where indexname = 'invoices_one_rent_per_period'));
  perform public.test_check('schema', 'scheduled task run uniqueness (task_id, scheduled_for)', exists (select 1 from pg_constraint where conrelid = 'public.scheduled_task_runs'::regclass and contype = 'u' and pg_get_constraintdef(oid) like '%task_id, scheduled_for%'));
  perform public.test_check('schema', 'journal line sides are exclusive (check constraint)', exists (select 1 from pg_constraint where conrelid = 'public.journal_entry_lines'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%debit%' and pg_get_constraintdef(oid) like '%credit%' and pg_get_constraintdef(oid) like '%OR%'));
  perform public.test_check('schema', 'hash-chain trigger on activity_events', exists (select 1 from pg_trigger where tgname = 'activity_events_chain'));
  perform public.test_check('schema', 'append-only triggers on activity_events', (select count(*) from pg_trigger where tgrelid = 'public.activity_events'::regclass and tgname like 'activity_events_no_%') = 2);
  perform public.test_check('schema', 'signup trigger on auth.users', exists (select 1 from pg_trigger where tgname = 'on_auth_user_created'));
  perform public.test_check('schema', 'updated_at triggers exist on mutable tables (>= 39)', (select count(*) from pg_trigger where tgname like '%\_updated\_at' and not tgisinternal) >= 39);

  -- every foreign key to a table other than profiles/permissions is served by an index (migration 010)
  select count(*) into v_name from (
    with fks as (
      select k.conrelid, k.conkey,
             (select array_agg(u.attnum order by u.ord) filter (where a.attname <> 'organization_id')
                from unnest(k.conkey) with ordinality u (attnum, ord) join pg_attribute a on a.attrelid = k.conrelid and a.attnum = u.attnum) as keycols
        from pg_constraint k join pg_namespace n on n.oid = k.connamespace
       where n.nspname = 'public' and k.contype = 'f' and k.confrelid not in ('public.profiles'::regclass, 'public.permissions'::regclass))
    select 1 from fks f
     where not exists (select 1 from pg_index i where i.indrelid = f.conrelid and (i.indkey::int2[])[0:array_length(f.keycols, 1) - 1] = f.keycols::int2[])
       and not exists (select 1 from pg_index i where i.indrelid = f.conrelid and (i.indkey::int2[])[0:array_length(f.conkey, 1) - 1] = f.conkey)
  ) q;
  perform public.test_check('schema', 'every foreign key (except to profiles) has a covering index', v_name::int = 0, v_name);

  -- 5. views --------------------------------------------------------------------------------------------------------------
  select array_agg(v) into v_missing from unnest(v_views) v where to_regclass('public.' || v) is null;
  perform public.test_check('schema', 'all reporting views exist', v_missing is null, array_to_string(v_missing, ','));
  select array_agg(c.relname) into v_missing from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'v' and not coalesce(c.reloptions @> array['security_invoker=true'], false);
  perform public.test_check('schema', 'all views are security_invoker (RLS applies to the caller)', v_missing is null, array_to_string(v_missing, ','));

  -- 6. function privileges ------------------------------------------------------------------------------------------------
  perform public.test_check('schema', 'anon cannot execute any public RPC',
    not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.prokind = 'f' and p.proname not like 'test\_%'
                 and has_function_privilege('anon', p.oid, 'execute')));
  perform public.test_check('schema', 'anon cannot execute any private function',
    not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'private' and has_function_privilege('anon', p.oid, 'execute')));
  perform public.test_check('schema', 'worker functions are service_role only',
    not has_function_privilege('authenticated', 'public.claim_due_scheduled_tasks(text,integer,integer)', 'execute')
    and has_function_privilege('service_role', 'public.claim_due_scheduled_tasks(text,integer,integer)', 'execute')
    and not has_function_privilege('authenticated', 'public.enqueue_workflow_execution(uuid,uuid,text,uuid,timestamptz,uuid)', 'execute'));
  perform public.test_check('schema', 'onboarding RPCs are executable by authenticated',
    has_function_privilege('authenticated', 'public.create_organization(text,text,text,text,text)', 'execute')
    and has_function_privilege('authenticated', 'public.accept_invitation(uuid)', 'execute'));
  perform public.test_check('schema', 'internal audit writer is not executable by authenticated',
    not has_function_privilege('authenticated', 'private.log_activity(uuid,uuid,text,text,text,text,text,text,text,jsonb,text,text,text,text,jsonb,uuid,uuid,uuid,text,jsonb)', 'execute'));
  perform public.test_check('schema', 'seed function is not executable by authenticated', not has_function_privilege('authenticated', 'private.seed_organization_defaults(uuid)', 'execute'));
  perform public.test_check('schema', 'SECURITY DEFINER functions pin search_path',
    not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('public', 'private') and p.prosecdef
                 and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')));

  -- 7. reference data -----------------------------------------------------------------------------------------------------
  perform public.test_check('schema', 'permission catalog loaded (26 keys)', (select count(*) from public.permissions) = 26, (select count(*) from public.permissions));
  perform public.test_check('schema', 'every role has defaults', (select count(distinct role) from public.role_permissions) = 5);
  perform public.test_check('schema', 'administrator has every permission', (select count(*) from public.role_permissions where role = 'administrator') = (select count(*) from public.permissions));
  perform public.test_check('schema', 'read_only holds no manage_* permission', not exists (select 1 from public.role_permissions where role = 'read_only' and permission like 'manage\_%'));

  -- 8. storage ------------------------------------------------------------------------------------------------------------
  perform public.test_check('schema', '8 storage buckets configured', (select count(*) from storage.buckets where id in ('tenant-identification','lease-documents','signed-documents','property-images','maintenance-attachments','project-documents','finance-documents','organization-assets')) = 8);
  perform public.test_check('schema', 'no bucket is public', not exists (select 1 from storage.buckets where public));
  perform public.test_check('schema', 'every bucket has a size limit and mime allow-list', not exists (select 1 from storage.buckets where file_size_limit is null or allowed_mime_types is null));
  perform public.test_check('schema', 'every bucket has a SELECT policy', not exists (select 1 from storage.buckets b where not exists (select 1 from pg_policies p where p.schemaname = 'storage' and p.policyname = b.id || '_select')));
  perform public.test_check('schema', 'signed-documents has no INSERT/UPDATE/DELETE policy for users', not exists (select 1 from pg_policies p where p.schemaname = 'storage' and p.policyname in ('signed-documents_insert','signed-documents_update','signed-documents_delete')));
end $$;

select suite, count(*) filter (where passed) as passed, count(*) filter (where not passed) as failed from public.test_results where suite = 'schema' group by suite;
