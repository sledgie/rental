-- =====================================================================================================================
-- 016_lease_financial_notes.sql
-- The Leases page keeps lease notes and financial-terms notes separately, and offers "Other" as a payment frequency.
--   * leases.financial_notes  new column for the financial-terms notes (leases.notes stays the general lease notes)
--   * leases.payment_frequency also accepts 'other'
-- =====================================================================================================================
begin;
set local search_path = public, extensions;

alter table public.leases add column if not exists financial_notes text;
comment on column public.leases.financial_notes is 'Notes about the financial terms (rent, deposit, fees), separate from the general lease notes.';

do $$
declare
  c record;
begin
  for c in
    select conname from pg_constraint
     where conrelid = 'public.leases'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%payment_frequency%'
  loop
    execute format('alter table public.leases drop constraint %I', c.conname);
  end loop;
  alter table public.leases add constraint leases_payment_frequency_check
    check (payment_frequency in ('weekly', 'biweekly', 'monthly', 'quarterly', 'annually', 'other'));
end $$;

commit;
