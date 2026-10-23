-- =====================================================================================================================
-- 007_views_and_functions.sql
-- Reporting views (all SECURITY INVOKER, so the caller's Row-Level Security applies to every underlying table) and the
-- transactional business functions the application calls: issue_invoice, record_payment, reverse_payment, apply_credit_note,
-- generate_rent_invoices, close_books, verify_activity_chain.
-- The functions are SECURITY INVOKER as well: they can only do what the calling user could do with plain INSERT/UPDATE statements,
-- they just do it atomically and in the right order.
-- =====================================================================================================================
begin;
set local search_path = public, extensions;

-- ---------------------------------------------------------------------------------------------------------------------
-- Receivables views
-- ---------------------------------------------------------------------------------------------------------------------
create or replace view public.v_invoice_balances with (security_invoker = true) as
select i.organization_id,
       i.id                               as invoice_id,
       i.invoice_number,
       i.tenant_id,
       i.lease_id,
       i.property_id,
       i.unit_id,
       i.invoice_type,
       i.status,
       i.issue_date,
       i.due_date,
       i.currency,
       t.total,
       coalesce(p.paid, 0)                as paid_by_payments,
       coalesce(c.credited, 0)            as paid_by_credits,
       coalesce(p.paid, 0) + coalesce(c.credited, 0) as paid_total,
       case when i.status = 'void' then 0 else greatest(t.total - coalesce(p.paid, 0) - coalesce(c.credited, 0), 0) end as outstanding,
       case
         when i.status in ('draft', 'pending_approval', 'void') then i.status
         when t.total - coalesce(p.paid, 0) - coalesce(c.credited, 0) <= 0 then 'paid'
         when coalesce(p.paid, 0) + coalesce(c.credited, 0) > 0 and i.due_date < current_date then 'overdue'
         when coalesce(p.paid, 0) + coalesce(c.credited, 0) > 0 then 'partially_paid'
         when i.due_date < current_date then 'overdue'
         else 'unpaid' end                as derived_status,
       (i.status = 'open' and i.due_date < current_date and t.total - coalesce(p.paid, 0) - coalesce(c.credited, 0) > 0) as is_overdue,
       case when i.status = 'open' and i.due_date < current_date and t.total - coalesce(p.paid, 0) - coalesce(c.credited, 0) > 0
            then current_date - i.due_date else 0 end as days_overdue
  from public.invoices i
  cross join lateral (select coalesce(sum(l.subtotal + l.tax_amount), 0) - i.discount as total from public.invoice_lines l where l.invoice_id = i.id) t
  left join lateral (select sum(a.amount) as paid from public.payment_allocations a join public.payments pm on pm.id = a.payment_id
                      where a.invoice_id = i.id and pm.status = 'posted') p on true
  left join lateral (select sum(ca.amount) as credited from public.credit_note_applications ca where ca.invoice_id = i.id) c on true;

create or replace view public.v_outstanding_invoices with (security_invoker = true) as
select * from public.v_invoice_balances where status = 'open' and outstanding > 0;

create or replace view public.v_payment_summary with (security_invoker = true) as
select p.organization_id, p.id as payment_id, p.payment_number, p.tenant_id, p.lease_id, p.payment_date, p.method, p.amount, p.status,
       coalesce(a.allocated, 0) as allocated, coalesce(r.refunded, 0) as refunded,
       case when p.status = 'posted' then p.amount - coalesce(a.allocated, 0) - coalesce(r.refunded, 0) else 0 end as unapplied
  from public.payments p
  left join lateral (select sum(amount) as allocated from public.payment_allocations where payment_id = p.id) a on true
  left join lateral (select sum(amount) as refunded from public.payment_refunds where payment_id = p.id) r on true;

create or replace view public.v_credit_balances with (security_invoker = true) as
select c.organization_id, c.id as credit_note_id, c.credit_number, c.tenant_id, c.lease_id, c.issue_date, c.amount, c.status as stored_status,
       coalesce(a.applied, 0) as applied,
       case when c.status = 'void' or (pm.status = 'reversed') then 0 else c.amount - coalesce(a.applied, 0) end as remaining,
       (c.status = 'open' and coalesce(pm.status, 'posted') = 'posted') as is_valid,
       case when c.status in ('draft', 'void') then c.status
            when pm.status = 'reversed' then 'invalid'
            when coalesce(a.applied, 0) >= c.amount then 'applied'
            when coalesce(a.applied, 0) > 0 then 'partially_applied'
            else 'open' end as derived_status
  from public.credit_notes c
  left join public.payments pm on pm.organization_id = c.organization_id and pm.id = c.source_payment_id
  left join lateral (select sum(amount) as applied from public.credit_note_applications where credit_note_id = c.id) a on true;

create or replace view public.v_tenant_balances with (security_invoker = true) as
select t.organization_id, t.id as tenant_id, t.tenant_number,
       trim(t.first_name || ' ' || t.last_name) as tenant_name,
       coalesce(sum(b.outstanding), 0) as outstanding,
       coalesce(sum(b.outstanding) filter (where b.is_overdue), 0) as overdue,
       coalesce((select sum(cb.remaining) from public.v_credit_balances cb where cb.tenant_id = t.id and cb.is_valid), 0) as credit_available
  from public.tenants t
  left join public.v_invoice_balances b on b.tenant_id = t.id and b.status = 'open'
 group by t.organization_id, t.id, t.tenant_number, t.first_name, t.last_name;

-- ---------------------------------------------------------------------------------------------------------------------
-- Payables
-- ---------------------------------------------------------------------------------------------------------------------
create or replace view public.v_bill_balances with (security_invoker = true) as
select b.organization_id, b.id as bill_id, b.bill_number, b.name, b.category, b.vendor_id, b.property_id, b.invoice_date, b.due_date, b.amount, b.status as stored_status,
       coalesce(p.paid, 0) as paid, b.amount - coalesce(p.paid, 0) as remaining, coalesce(r.recovered, 0) as recovered,
       case when b.status <> 'open' then b.status
            when coalesce(p.paid, 0) >= b.amount then 'paid'
            when b.due_date < current_date then 'overdue'
            when coalesce(p.paid, 0) > 0 then 'partially_paid'
            when b.due_date <= current_date + 7 then 'due_soon'
            else 'upcoming' end as derived_status,
       case when b.responsible_party = 'landlord' then 'not_recoverable'
            when coalesce(r.recovered, 0) >= b.amount then 'fully_recovered'
            when coalesce(r.recovered, 0) > 0 then 'partially_recovered'
            else 'recovery_pending' end as recovery_status
  from public.bills b
  left join lateral (select sum(amount) as paid from public.bill_payments where bill_id = b.id) p on true
  left join lateral (select sum(amount) as recovered from public.bill_tenant_recoveries where bill_id = b.id) r on true;

-- ---------------------------------------------------------------------------------------------------------------------
-- Leases and occupancy
-- ---------------------------------------------------------------------------------------------------------------------
create or replace view public.v_leases_current with (security_invoker = true) as
select l.organization_id, l.id as lease_id, l.lease_number, l.status, l.start_date, l.end_date,
       (l.end_date - current_date) as days_until_end,
       (l.status = 'active' and l.end_date is not null and l.end_date between current_date and current_date + 60) as is_expiring,
       l.agreed_monthly_rent, l.deposit_amount,
       (select string_agg(distinct p.name || ' · ' || u.unit_number, ', ' order by p.name || ' · ' || u.unit_number)
          from public.lease_units lu join public.units u on u.id = lu.unit_id join public.properties p on p.id = u.property_id
         where lu.lease_id = l.id) as units,
       (select trim(t.first_name || ' ' || t.last_name) from public.lease_parties lp join public.tenants t on t.id = lp.tenant_id
         where lp.lease_id = l.id and lp.role = 'main_tenant' order by lp.is_primary_contact desc, lp.relationship_start_date limit 1) as main_tenant
  from public.leases l
 where l.status in ('active', 'pending_signature', 'pending_review');

create or replace view public.v_lease_expirations with (security_invoker = true) as
select * from public.v_leases_current where status = 'active' and end_date is not null and end_date between current_date and current_date + 90 order by end_date;

create or replace view public.v_current_occupancy with (security_invoker = true) as
select lu.organization_id, u.property_id, pr.name as property_name, u.id as unit_id, u.unit_number, l.id as lease_id, l.lease_number,
       t.id as tenant_id, trim(t.first_name || ' ' || t.last_name) as tenant_name, lp.role as party_role,
       lu.start_date as occupancy_start, lu.end_date as occupancy_end, lu.allocated_monthly_rent
  from public.lease_units lu
  join public.leases l on l.id = lu.lease_id and l.status = 'active'
  join public.units u on u.id = lu.unit_id
  join public.properties pr on pr.id = u.property_id
  join public.lease_parties lp on lp.lease_id = l.id and (lp.relationship_end_date is null or lp.relationship_end_date >= current_date)
  join public.tenants t on t.id = lp.tenant_id
 where lu.start_date <= current_date and (lu.end_date is null or lu.end_date >= current_date);

create or replace view public.v_tenant_occupancy_history with (security_invoker = true) as
select lp.organization_id, lp.tenant_id, l.id as lease_id, l.lease_number, l.status as lease_status, lp.role,
       u.property_id, u.id as unit_id, u.unit_number, lu.start_date, lu.end_date
  from public.lease_parties lp
  join public.leases l on l.id = lp.lease_id
  join public.lease_units lu on lu.lease_id = l.id
  join public.units u on u.id = lu.unit_id;

create or replace view public.v_unit_status with (security_invoker = true) as
select u.organization_id, u.id as unit_id, u.property_id, u.unit_number, u.unit_status, u.market_rent, u.advertised_rent,
       o.lease_id, o.tenant_name, o.occupancy_end
  from public.units u
  left join lateral (select lease_id, string_agg(tenant_name, ', ') as tenant_name, max(occupancy_end) as occupancy_end
                       from public.v_current_occupancy c where c.unit_id = u.id group by lease_id limit 1) o on true
 where u.archived_at is null;

-- ---------------------------------------------------------------------------------------------------------------------
-- Financial summaries (from POSTED journal lines; reversed entries stay in the totals together with their reversing entries)
-- ---------------------------------------------------------------------------------------------------------------------
create or replace view public.v_trial_balance with (security_invoker = true) as
select a.organization_id, a.id as account_id, a.code, a.name, a.account_type, a.normal_balance,
       coalesce(sum(l.debit), 0) as total_debit, coalesce(sum(l.credit), 0) as total_credit,
       coalesce(sum(l.debit - l.credit), 0) as net_debit
  from public.accounts a
  left join public.journal_entry_lines l on l.organization_id = a.organization_id and l.account_id = a.id
  left join public.journal_entries e on e.organization_id = l.organization_id and e.id = l.entry_id and e.status in ('posted', 'reversed')
 where a.role = 'posting' and (l.id is null or e.id is not null)
 group by a.organization_id, a.id, a.code, a.name, a.account_type, a.normal_balance;

create or replace view public.v_property_financials with (security_invoker = true) as
select l.organization_id, l.property_id, date_trunc('month', l.entry_date)::date as month,
       sum(case when a.account_type in ('revenue', 'other_income') then l.credit - l.debit else 0 end) as revenue,
       sum(case when a.account_type in ('operating_cost', 'administrative_expense', 'other_expense') then l.debit - l.credit else 0 end) as expenses,
       sum(case when a.account_type in ('revenue', 'other_income') then l.credit - l.debit else 0 end)
         - sum(case when a.account_type in ('operating_cost', 'administrative_expense', 'other_expense') then l.debit - l.credit else 0 end) as net_income
  from public.journal_entry_lines l
  join public.journal_entries e on e.organization_id = l.organization_id and e.id = l.entry_id and e.status in ('posted', 'reversed')
  join public.accounts a on a.organization_id = l.organization_id and a.id = l.account_id
 where l.property_id is not null
 group by l.organization_id, l.property_id, date_trunc('month', l.entry_date);

create or replace view public.v_organization_financials with (security_invoker = true) as
select l.organization_id, date_trunc('month', l.entry_date)::date as month,
       sum(case when a.account_type in ('revenue', 'other_income') then l.credit - l.debit else 0 end) as revenue,
       sum(case when a.account_type in ('operating_cost', 'administrative_expense', 'other_expense') then l.debit - l.credit else 0 end) as expenses,
       sum(case when a.account_type in ('revenue', 'other_income') then l.credit - l.debit else 0 end)
         - sum(case when a.account_type in ('operating_cost', 'administrative_expense', 'other_expense') then l.debit - l.credit else 0 end) as net_income
  from public.journal_entry_lines l
  join public.journal_entries e on e.organization_id = l.organization_id and e.id = l.entry_id and e.status in ('posted', 'reversed')
  join public.accounts a on a.organization_id = l.organization_id and a.id = l.account_id
 group by l.organization_id, date_trunc('month', l.entry_date);

-- ---------------------------------------------------------------------------------------------------------------------
-- Maintenance and projects
-- ---------------------------------------------------------------------------------------------------------------------
create or replace view public.v_maintenance_dashboard with (security_invoker = true) as
select r.organization_id, r.property_id,
       count(*) filter (where r.status not in ('completed', 'closed', 'rejected', 'cancelled', 'draft')) as open_requests,
       count(*) filter (where r.priority = 'emergency' and r.status not in ('completed', 'closed', 'rejected', 'cancelled', 'draft')) as emergency_open,
       count(*) filter (where r.target_date < current_date and r.status not in ('completed', 'closed', 'rejected', 'cancelled', 'draft')) as overdue,
       count(*) filter (where r.status in ('awaiting_approval')) as awaiting_approval,
       count(*) filter (where r.status = 'completed' and r.completed_at >= now() - interval '30 days') as completed_last_30_days,
       round(avg(extract(epoch from (coalesce(r.completed_at, now()) - r.reported_at)) / 86400)::numeric, 1) as avg_days_open
  from public.maintenance_requests r
 group by r.organization_id, r.property_id;

create or replace view public.v_project_progress with (security_invoker = true) as
select p.organization_id, p.id as project_id, p.project_number, p.name, p.status, p.property_id, p.unit_id,
       p.original_budget, p.contingency,
       coalesce(co.approved_changes, 0) as approved_change_orders,
       p.original_budget + coalesce(co.approved_changes, 0) as revised_budget,
       coalesce(ex.spent, 0) as spent,
       coalesce(inv.invoiced, 0) as invoiced,
       coalesce(pay.paid, 0) as paid,
       p.original_budget + coalesce(co.approved_changes, 0) - coalesce(ex.spent, 0) as budget_remaining,
       coalesce(tk.total_tasks, 0) as total_tasks, coalesce(tk.done_tasks, 0) as completed_tasks,
       case when coalesce(tk.total_tasks, 0) = 0 then 0 else round(100.0 * tk.done_tasks / tk.total_tasks, 1) end as percent_complete,
       (p.estimated_completion < current_date and p.status not in ('completed', 'cancelled')) as is_late
  from public.projects p
  left join lateral (select sum(cost_delta) as approved_changes from public.project_change_orders c where c.project_id = p.id and c.approval_status = 'approved') co on true
  left join lateral (select sum(total) as spent from public.project_expenses e where e.project_id = p.id and e.approval_status = 'approved') ex on true
  left join lateral (select coalesce(sum(l.subtotal + l.tax_amount), 0) - coalesce((select sum(i2.discount) from public.project_invoices i2 where i2.project_id = p.id and i2.approval_status = 'approved'), 0) as invoiced
                       from public.project_invoice_lines l join public.project_invoices i on i.id = l.invoice_id
                      where i.project_id = p.id and i.approval_status = 'approved') inv on true
  left join lateral (select sum(amount) as paid from public.project_payments pp where pp.project_id = p.id) pay on true
  left join lateral (select count(*) as total_tasks, count(*) filter (where t.status = 'completed') as done_tasks from public.project_tasks t where t.project_id = p.id) tk on true;

create or replace view public.v_document_expirations with (security_invoker = true) as
select d.organization_id, d.id as document_id, d.name, d.document_type, d.expiry_date, d.expiry_date - current_date as days_until_expiry
  from public.documents d
 where d.expiry_date is not null and d.deleted_at is null and d.status in ('active', 'signed') and d.expiry_date <= current_date + 90;

grant select on public.v_invoice_balances, public.v_outstanding_invoices, public.v_payment_summary, public.v_credit_balances, public.v_tenant_balances,
                public.v_bill_balances, public.v_leases_current, public.v_lease_expirations, public.v_current_occupancy, public.v_tenant_occupancy_history,
                public.v_unit_status, public.v_trial_balance, public.v_property_financials, public.v_organization_financials,
                public.v_maintenance_dashboard, public.v_project_progress, public.v_document_expirations to authenticated;
revoke all on public.v_invoice_balances, public.v_outstanding_invoices, public.v_payment_summary, public.v_credit_balances, public.v_tenant_balances,
              public.v_bill_balances, public.v_leases_current, public.v_lease_expirations, public.v_current_occupancy, public.v_tenant_occupancy_history,
              public.v_unit_status, public.v_trial_balance, public.v_property_financials, public.v_organization_financials,
              public.v_maintenance_dashboard, public.v_project_progress, public.v_document_expirations from anon;

-- ---------------------------------------------------------------------------------------------------------------------
-- Transactional business functions
-- ---------------------------------------------------------------------------------------------------------------------
-- Issue an invoice: validates it, locks it, and (when the chart of accounts has the needed system accounts) posts Dr AR / Cr income + tax.
create or replace function public.issue_invoice(p_invoice uuid) returns uuid
language plpgsql set search_path = public, extensions as $$
declare
  v_inv public.invoices%rowtype;
  v_subtotal numeric;
  v_tax numeric;
  v_ar uuid;
  v_income uuid;
  v_tax_acct uuid;
  v_discount_acct uuid;
  v_lines jsonb := '[]'::jsonb;
  v_line record;
  v_je uuid;
begin
  select * into v_inv from public.invoices where id = p_invoice for update;
  if not found then raise exception 'invoice not found' using errcode = 'P0002'; end if;
  if v_inv.status not in ('draft', 'pending_approval') then raise exception 'invoice is already %', v_inv.status using errcode = '22023'; end if;
  select coalesce(sum(subtotal), 0), coalesce(sum(tax_amount), 0) into v_subtotal, v_tax from public.invoice_lines where invoice_id = p_invoice;
  if v_subtotal <= 0 then raise exception 'an invoice needs at least one line with an amount' using errcode = '23514'; end if;
  if v_inv.discount > v_subtotal + v_tax then raise exception 'discount exceeds the invoice total' using errcode = '23514'; end if;

  select id into v_ar from public.accounts where organization_id = v_inv.organization_id and system_key = 'accounts_receivable';
  select id into v_income from public.accounts where organization_id = v_inv.organization_id and system_key = 'rent_income';
  select id into v_tax_acct from public.accounts where organization_id = v_inv.organization_id and system_key = 'sales_tax_payable';
  select id into v_discount_acct from public.accounts where organization_id = v_inv.organization_id and system_key = 'rent_discounts';

  if v_ar is not null and v_income is not null and (v_tax = 0 or v_tax_acct is not null) and (v_inv.discount = 0 or v_discount_acct is not null) then
    v_lines := jsonb_build_array(jsonb_build_object('account_id', v_ar, 'debit', v_subtotal + v_tax - v_inv.discount, 'memo', v_inv.invoice_number,
                                                    'tenant_id', v_inv.tenant_id, 'lease_id', v_inv.lease_id, 'property_id', v_inv.property_id, 'unit_id', v_inv.unit_id));
    if v_inv.discount > 0 then
      v_lines := v_lines || jsonb_build_object('account_id', v_discount_acct, 'debit', v_inv.discount, 'memo', 'Discount ' || v_inv.invoice_number,
                                               'property_id', v_inv.property_id, 'unit_id', v_inv.unit_id);
    end if;
    for v_line in select coalesce(account_id, v_income) as account_id, sum(subtotal) as amount from public.invoice_lines where invoice_id = p_invoice group by 1 loop
      v_lines := v_lines || jsonb_build_object('account_id', v_line.account_id, 'credit', v_line.amount, 'memo', v_inv.invoice_number,
                                               'property_id', v_inv.property_id, 'unit_id', v_inv.unit_id);
    end loop;
    if v_tax > 0 then
      v_lines := v_lines || jsonb_build_object('account_id', v_tax_acct, 'credit', v_tax, 'memo', 'Tax ' || v_inv.invoice_number);
    end if;
    v_je := public.create_journal_entry(v_inv.organization_id, v_inv.issue_date, 'Invoice ' || v_inv.invoice_number, v_lines, true, 'invoice');
  end if;
  update public.invoices set status = 'open', journal_entry_id = v_je where id = p_invoice;
  return p_invoice;
end $$;

-- Record a payment, allocate it to invoices and (optionally) keep the unapplied remainder as a tenant credit — all in one transaction.
-- p_allocations: [{"invoice_id": "...", "amount": 100.00}, ...]
create or replace function public.record_payment(
  p_org uuid, p_tenant uuid, p_lease uuid, p_date date, p_amount numeric, p_method text,
  p_reference text default null, p_notes text default null, p_bank_account uuid default null,
  p_allocations jsonb default '[]'::jsonb, p_keep_credit boolean default true, p_idempotency_key text default null
) returns uuid
language plpgsql set search_path = public, extensions as $$
declare
  v_id uuid;
  v_number text;
  v_alloc jsonb;
  v_allocated numeric := 0;
  v_remainder numeric;
  v_credited numeric := 0;
  v_gl uuid;
  v_ar uuid;
  v_credits uuid;
  v_lines jsonb;
  v_je uuid;
begin
  if p_idempotency_key is not null then
    select id into v_id from public.payments where organization_id = p_org and idempotency_key = p_idempotency_key;
    if found then return v_id; end if;
  end if;
  insert into public.payments (organization_id, tenant_id, lease_id, payment_date, method, amount, reference, notes, bank_account_id, idempotency_key, recorded_by)
  values (p_org, p_tenant, p_lease, p_date, p_method, p_amount, p_reference, p_notes, p_bank_account, p_idempotency_key, (select auth.uid()))
  returning id, payment_number into v_id, v_number;

  for v_alloc in select * from jsonb_array_elements(coalesce(p_allocations, '[]'::jsonb)) loop
    insert into public.payment_allocations (organization_id, payment_id, invoice_id, amount)
    values (p_org, v_id, (v_alloc ->> 'invoice_id')::uuid, (v_alloc ->> 'amount')::numeric);
    v_allocated := v_allocated + (v_alloc ->> 'amount')::numeric;
  end loop;
  v_remainder := p_amount - v_allocated;

  if v_remainder > 0 and p_keep_credit then
    insert into public.credit_notes (organization_id, tenant_id, lease_id, source_payment_id, status, amount, reason, created_by)
    values (p_org, p_tenant, p_lease, v_id, 'open', v_remainder, 'Overpayment from ' || v_number, (select auth.uid()));
    v_credited := v_remainder;
  end if;

  if p_bank_account is not null then
    select gl_account_id into v_gl from public.bank_accounts where organization_id = p_org and id = p_bank_account;
    select id into v_ar from public.accounts where organization_id = p_org and system_key = 'accounts_receivable';
    select id into v_credits from public.accounts where organization_id = p_org and system_key = 'tenant_credits';
    if v_gl is not null and v_ar is not null and (v_credited = 0 or v_credits is not null) then
      v_lines := jsonb_build_array(jsonb_build_object('account_id', v_gl, 'debit', p_amount, 'memo', v_number, 'tenant_id', p_tenant, 'lease_id', p_lease, 'bank_account_id', p_bank_account));
      if p_amount - v_credited > 0 then
        v_lines := v_lines || jsonb_build_object('account_id', v_ar, 'credit', p_amount - v_credited, 'memo', v_number, 'tenant_id', p_tenant, 'lease_id', p_lease);
      end if;
      if v_credited > 0 then
        v_lines := v_lines || jsonb_build_object('account_id', v_credits, 'credit', v_credited, 'memo', 'Overpayment ' || v_number, 'tenant_id', p_tenant, 'lease_id', p_lease);
      end if;
      v_je := public.create_journal_entry(p_org, p_date, 'Payment ' || v_number, v_lines, true, 'payment');
      update public.payments set journal_entry_id = v_je where id = v_id;
    end if;
  end if;
  return v_id;
end $$;

-- Reverse a payment. Allocations stay as history but stop counting; credits created from the overpayment are voided (unless already used).
create or replace function public.reverse_payment(p_payment uuid, p_reason text) returns void
language plpgsql set search_path = public, extensions as $$
declare
  v_pay public.payments%rowtype;
begin
  select * into v_pay from public.payments where id = p_payment for update;
  if not found then raise exception 'payment not found' using errcode = 'P0002'; end if;
  if v_pay.status = 'reversed' then raise exception 'payment already reversed' using errcode = '22023'; end if;
  if exists (select 1 from public.credit_note_applications ca join public.credit_notes c on c.id = ca.credit_note_id where c.source_payment_id = p_payment) then
    raise exception 'A credit created by this payment has already been applied; unapply it first' using errcode = '23514';
  end if;
  update public.credit_notes set status = 'void', voided_at = now() where source_payment_id = p_payment and status <> 'void';
  update public.payments set status = 'reversed', reversal_reason = p_reason where id = p_payment;
  if v_pay.journal_entry_id is not null then
    perform public.reverse_journal_entry(v_pay.journal_entry_id, current_date, 'Reversal of payment ' || v_pay.payment_number);
  end if;
end $$;

create or replace function public.apply_credit_note(p_credit uuid, p_invoice uuid, p_amount numeric) returns uuid
language plpgsql set search_path = public, extensions as $$
declare
  v_credit public.credit_notes%rowtype;
  v_id uuid;
begin
  select * into v_credit from public.credit_notes where id = p_credit;
  if not found then raise exception 'credit note not found' using errcode = 'P0002'; end if;
  insert into public.credit_note_applications (organization_id, credit_note_id, invoice_id, amount)
  values (v_credit.organization_id, p_credit, p_invoice, p_amount) returning id into v_id;
  return v_id;
end $$;

-- Idempotent monthly rent run: one rent invoice per active lease for the billing period. Safe to call repeatedly.
create or replace function public.generate_rent_invoices(p_org uuid, p_period_start date, p_issue boolean default false) returns integer
language plpgsql set search_path = public, extensions as $$
declare
  v_lease record;
  v_invoice uuid;
  v_end date := (date_trunc('month', p_period_start) + interval '1 month - 1 day')::date;
  v_created integer := 0;
  v_charge record;
  v_unit uuid;
  v_property uuid;
  v_tenant uuid;
begin
  for v_lease in
    select l.* from public.leases l
     where l.organization_id = p_org and l.status = 'active' and l.payment_frequency = 'monthly'
       and l.start_date <= v_end and (l.end_date is null or l.end_date >= p_period_start)
  loop
    select lp.tenant_id into v_tenant from public.lease_parties lp
     where lp.lease_id = v_lease.id and lp.role = 'main_tenant' and (lp.relationship_end_date is null or lp.relationship_end_date >= p_period_start)
     order by lp.is_primary_contact desc, lp.relationship_start_date limit 1;
    continue when v_tenant is null;
    select u.id, u.property_id into v_unit, v_property
      from public.lease_units lu join public.units u on u.id = lu.unit_id where lu.lease_id = v_lease.id order by lu.start_date limit 1;

    insert into public.invoices (organization_id, tenant_id, lease_id, property_id, unit_id, invoice_type, status, issue_date, due_date,
                                 billing_period_start, billing_period_end, memo, created_by)
    values (p_org, v_tenant, v_lease.id, v_property, case when (select count(*) from public.lease_units where lease_id = v_lease.id) = 1 then v_unit end,
            'rent', 'draft', current_date, p_period_start + (least(v_lease.rent_due_day, 28) - 1), p_period_start, v_end,
            'Rent for ' || to_char(p_period_start, 'FMMonth YYYY'), (select auth.uid()))
    on conflict (organization_id, lease_id, billing_period_start) where invoice_type = 'rent' and status <> 'void' and lease_id is not null and billing_period_start is not null
    do nothing
    returning id into v_invoice;
    continue when v_invoice is null;                          -- already generated for this period

    insert into public.invoice_lines (organization_id, invoice_id, position, description, category, unit_price)
    values (p_org, v_invoice, 1, 'Monthly rent', 'rent', v_lease.agreed_monthly_rent);
    if v_lease.parking_fees > 0 then
      insert into public.invoice_lines (organization_id, invoice_id, position, description, category, unit_price) values (p_org, v_invoice, 2, 'Parking', 'parking', v_lease.parking_fees);
    end if;
    if v_lease.storage_fees > 0 then
      insert into public.invoice_lines (organization_id, invoice_id, position, description, category, unit_price) values (p_org, v_invoice, 3, 'Storage', 'storage', v_lease.storage_fees);
    end if;
    for v_charge in select label, amount from public.lease_additional_charges where lease_id = v_lease.id order by position loop
      insert into public.invoice_lines (organization_id, invoice_id, position, description, category, unit_price) values (p_org, v_invoice, 10, v_charge.label, 'fees', v_charge.amount);
    end loop;
    if p_issue then perform public.issue_invoice(v_invoice); end if;
    v_created := v_created + 1;
  end loop;
  return v_created;
end $$;

-- Lock the books: nothing dated on or before p_through can be posted afterwards. Moving the date backwards needs the owner.
create or replace function public.close_books(p_org uuid, p_through date) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_current date;
begin
  if not private.has_permission(p_org, 'manage_finance') then raise exception 'not allowed' using errcode = '42501'; end if;
  select books_closed_through into v_current from public.organizations where id = p_org;
  if v_current is not null and p_through < v_current and private.org_role(p_org) is distinct from 'owner' then
    raise exception 'Only an owner can reopen a closed period' using errcode = '42501';
  end if;
  update public.organizations set books_closed_through = p_through where id = p_org;
  perform private.log_activity(p_org, (select auth.uid()), 'user', 'security.settings_changed', 'Accounting & Finance',
          'Books closed through ' || coalesce(p_through::text, 'none') || '.', 'organization', p_org::text, '', '[]'::jsonb, 'success', 'warning', 'Accounting');
end $$;

-- Re-computes the audit hash chain for an organization; returns the first broken event (if any).
create or replace function public.verify_activity_chain(p_org uuid)
returns table (valid boolean, checked bigint, first_invalid_event uuid, head_hash text)
language plpgsql stable set search_path = public, extensions as $$
declare
  v_prev text := repeat('0', 64);
  v_checked bigint := 0;
  v_bad uuid;
  v_head text;
  v_event public.activity_events%rowtype;
begin
  if not private.has_permission(p_org, 'view_audit_log') then raise exception 'not allowed' using errcode = '42501'; end if;
  for v_event in select * from public.activity_events where organization_id = p_org order by chain_seq loop
    v_checked := v_checked + 1;
    if v_event.previous_hash <> v_prev or v_event.event_hash <> private.activity_event_hash(v_event) then
      v_bad := v_event.id;
      exit;
    end if;
    v_prev := v_event.event_hash;
    v_head := v_event.event_hash;
  end loop;
  return query select v_bad is null, v_checked, v_bad, v_head;
end $$;

-- Records that the caller exported the audit trail: an 'audit.exported' event (warning severity) + an audit_exports row, atomically.
-- The CSV itself is produced by the application; filters are stored for later review but never any exported values.
create or replace function public.record_audit_export(p_org uuid, p_file_name text, p_filters jsonb, p_row_count integer) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_event uuid;
  v_export uuid := gen_random_uuid();
begin
  if not (private.has_permission(p_org, 'view_audit_log') and private.has_permission(p_org, 'export_data')) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_row_count < 0 then raise exception 'invalid row count' using errcode = '22023'; end if;
  v_event := private.log_activity(p_org, (select auth.uid()), 'user', 'audit.exported', 'Users & Security',
                                  format('Activity log export created: %s records (CSV).', p_row_count), 'audit_export', v_export::text, p_file_name,
                                  '[]'::jsonb, 'success', 'warning', 'Activity Logs', 'User-initiated filtered audit export',
                                  jsonb_build_object('rowCount', p_row_count, 'format', 'CSV', 'changeValuesIncluded', false));
  insert into public.audit_exports (id, organization_id, activity_event_id, actor_id, file_name, filters, row_count)
  values (v_export, p_org, v_event, (select auth.uid()), p_file_name, coalesce(p_filters, '{}'::jsonb), p_row_count);
  return v_export;
end $$;

revoke all on function public.issue_invoice(uuid), public.record_payment(uuid, uuid, uuid, date, numeric, text, text, text, uuid, jsonb, boolean, text),
                       public.reverse_payment(uuid, text), public.apply_credit_note(uuid, uuid, numeric), public.generate_rent_invoices(uuid, date, boolean),
                       public.close_books(uuid, date), public.verify_activity_chain(uuid), public.create_journal_entry(uuid, date, text, jsonb, boolean, text),
                       public.reverse_journal_entry(uuid, date, text), public.enqueue_workflow_execution(uuid, uuid, text, uuid, timestamptz, uuid),
                       public.record_audit_export(uuid, text, jsonb, integer) from public, anon;
grant execute on function public.issue_invoice(uuid), public.record_payment(uuid, uuid, uuid, date, numeric, text, text, text, uuid, jsonb, boolean, text),
                          public.reverse_payment(uuid, text), public.apply_credit_note(uuid, uuid, numeric), public.generate_rent_invoices(uuid, date, boolean),
                          public.close_books(uuid, date), public.verify_activity_chain(uuid), public.create_journal_entry(uuid, date, text, jsonb, boolean, text),
                          public.reverse_journal_entry(uuid, date, text), public.record_audit_export(uuid, text, jsonb, integer) to authenticated;
grant execute on function public.enqueue_workflow_execution(uuid, uuid, text, uuid, timestamptz, uuid) to service_role;

commit;
