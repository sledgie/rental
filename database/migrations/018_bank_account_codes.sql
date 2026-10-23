-- =====================================================================================================================
-- 018_bank_account_codes.sql
-- Human-readable bank account IDs (BA-001, BA-002, ...) assigned by the database, unique per organization, like unit, tenant and lease
-- numbers. The Banks page shows them as the account's ID; the row's uuid stays the real key.
-- =====================================================================================================================
begin;
set local search_path = public, extensions;

alter table public.bank_accounts add column if not exists account_code text;
create unique index if not exists bank_accounts_org_code_key on public.bank_accounts (organization_id, account_code) where account_code is not null;

drop trigger if exists bank_accounts_code on public.bank_accounts;
create trigger bank_accounts_code before insert on public.bank_accounts
  for each row execute function private.assign_number('account_code', 'bank_account', 'BA-', '3');

do $$
declare
  r record;
begin
  for r in select id, organization_id from public.bank_accounts where account_code is null order by created_at, id loop
    update public.bank_accounts set account_code = 'BA-' || lpad(private.next_number(r.organization_id, 'bank_account')::text, 3, '0') where id = r.id;
  end loop;
end $$;

comment on column public.bank_accounts.account_code is 'Human-readable bank account ID (BA-001), assigned on insert by private.assign_number.';

commit;
