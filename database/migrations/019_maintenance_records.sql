-- =====================================================================================================================
-- 019_maintenance_records.sql
-- What the Maintenance screens keep that the tables did not have yet:
--   * maintenance_schedules.schedule_number   human-readable ID (PM-0001) for inspection / preventive schedules, assigned by the database
--   * expenses: due_date, payment_status, amount_paid, invoice_ref, vendor_name, category_label
--     (the maintenance "Bills & Expenses" link shows who an expense was paid to, whether it is paid, the supplier invoice and the
--      category wording used on screen; the posted ledger side of an expense is unchanged)
-- =====================================================================================================================
begin;
set local search_path = public, extensions;

alter table public.maintenance_schedules add column if not exists schedule_number text;
create unique index if not exists maintenance_schedules_org_number_key on public.maintenance_schedules (organization_id, schedule_number) where schedule_number is not null;
drop trigger if exists maintenance_schedules_number on public.maintenance_schedules;
create trigger maintenance_schedules_number before insert on public.maintenance_schedules
  for each row execute function private.assign_number('schedule_number', 'maintenance_schedule', 'PM-', '4');
do $$
declare
  r record;
begin
  for r in select id, organization_id from public.maintenance_schedules where schedule_number is null order by created_at, id loop
    update public.maintenance_schedules set schedule_number = 'PM-' || lpad(private.next_number(r.organization_id, 'maintenance_schedule')::text, 4, '0') where id = r.id;
  end loop;
end $$;

alter table public.expenses
  add column if not exists due_date date,
  add column if not exists payment_status text not null default 'paid' check (payment_status in ('paid', 'unpaid', 'partially_paid', 'overdue')),
  add column if not exists amount_paid numeric(14,2) check (amount_paid is null or amount_paid >= 0),
  add column if not exists invoice_ref text,
  add column if not exists vendor_name text,
  add column if not exists category_label text;

commit;
