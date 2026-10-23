-- =====================================================================================================================
-- dev_seed_smoke.sql
-- Checks that database/seed/development_seed.sql produced a consistent demo organization (run after the seed; see run_local_tests.mjs).
-- =====================================================================================================================
delete from public.test_results where suite = 'seed';

do $$
declare
  o uuid := md5('mrr-demo:organization')::uuid;
  v_owner uuid;
begin
  select user_id into v_owner from public.organization_members where organization_id = o and role = 'owner';
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform public.test_check('seed', 'demo organization exists with one owner', (select count(*) from public.organization_members where organization_id = o) = 1 and v_owner is not null);
  perform public.test_check('seed', 'seed is repeatable: second run created nothing new', (select count(*) from public.organizations where name like 'Maple Ridge%') = 1 and (select count(*) from public.properties where organization_id = o) = 3);
  perform public.test_check('seed', 'portfolio: 3 properties, 8 units, 6 tenants', (select count(*) from public.units where organization_id = o) = 8 and (select count(*) from public.tenants where organization_id = o) = 6);
  perform public.test_check('seed', '5 active leases with parties and units', (select count(*) from public.leases where organization_id = o and status = 'active') = 5
    and (select count(*) from public.lease_parties where organization_id = o) = 6 and (select count(*) from public.lease_units where organization_id = o and is_occupying) = 5);
  perform public.test_check('seed', 'current occupancy view lists the tenants', (select count(*) from public.v_current_occupancy where organization_id = o) >= 6);
  perform public.test_check('seed', 'rent invoices exist for two months, all issued', (select count(*) from public.invoices where organization_id = o and invoice_type = 'rent') = 10
    and not exists (select 1 from public.invoices where organization_id = o and status <> 'open'));
  perform public.test_check('seed', 'payments recorded: 4 + overpayment, with a partial payment and a tenant credit',
    (select count(*) from public.payments where organization_id = o) = 5 and exists (select 1 from public.v_invoice_balances where organization_id = o and paid_total > 0 and outstanding > 0)
    and (select count(*) from public.credit_notes where organization_id = o and source_payment_id is not null) = 1);
  perform public.test_check('seed', 'every posted journal entry balances and the trial balance nets to zero',
    not exists (select 1 from public.journal_entries e join public.journal_entry_lines l on l.entry_id = e.id where e.organization_id = o and e.status = 'posted' group by e.id having sum(l.debit) <> sum(l.credit))
    and (select coalesce(sum(net_debit), 0) from public.v_trial_balance where organization_id = o) = 0);
  perform public.test_check('seed', 'property financial view reports revenue by property', (select coalesce(sum(revenue), 0) from public.v_property_financials where organization_id = o) > 0);
  perform public.test_check('seed', 'payables: bills with a partial payment, schedule, expenses',
    (select count(*) from public.bills where organization_id = o) = 2 and exists (select 1 from public.v_bill_balances where organization_id = o and derived_status in ('partially_paid', 'overdue'))
    and (select count(*) from public.expenses where organization_id = o) = 2 and (select count(*) from public.bill_schedules where organization_id = o) = 1);
  perform public.test_check('seed', 'maintenance dashboard counts the open and emergency requests',
    (select sum(open_requests) from public.v_maintenance_dashboard where organization_id = o) = 2 and (select sum(emergency_open) from public.v_maintenance_dashboard where organization_id = o) = 1);
  perform public.test_check('seed', 'project progress view reports spend and task completion', (select spent > 0 and total_tasks = 3 and completed_tasks = 1 from public.v_project_progress where organization_id = o));
  perform public.test_check('seed', 'applications: one reserves a unit, statuses recorded in history', (select count(*) from public.applications where organization_id = o) = 2
    and (select count(*) from public.application_status_history where organization_id = o) = 2);
  perform public.test_check('seed', 'documents are registered with organization-scoped storage paths', not exists (select 1 from public.document_versions where organization_id = o and split_part(storage_path, '/', 1) <> o::text)
    and (select count(*) from public.document_links where organization_id = o) = 2);
  perform public.test_check('seed', 'communication: templates, a valid rule, a conversation with both participant kinds',
    (select count(*) from public.message_templates where organization_id = o) = 3 and (select count(*) from public.automation_rules where organization_id = o and status = 'active') = 1
    and (select count(*) from public.conversation_participants where organization_id = o) = 2);
  perform public.test_check('seed', 'scheduled tasks are defined', (select count(*) from public.scheduled_tasks where organization_id = o) = 2);
  perform public.test_check('seed', 'deposit has its collection transaction', (select sum(signed_amount) from public.deposit_transactions where organization_id = o) = 1850);
  perform public.test_check('seed', 'the audit chain of the demo organization verifies', (select valid from public.verify_activity_chain(o)));
  perform public.test_check('seed', 'starter chart of accounts is present', (select count(*) from public.accounts where organization_id = o) >= 55);
end $$;
