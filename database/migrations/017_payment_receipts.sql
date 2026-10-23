-- =====================================================================================================================
-- 017_payment_receipts.sql
-- A receipt is issued the moment a payment is posted (RCT-00001, ...), so the Payments page can show the receipt number straight away.
-- Numbers are assigned by the database (atomic per organization, like payment / invoice / lease numbers); payments that were posted
-- before this migration get theirs below, oldest first.
-- =====================================================================================================================
begin;
set local search_path = public, extensions;

create or replace function private.issue_receipt_on_post() returns trigger
language plpgsql as $$
begin
  if new.receipt_issued_at is null then new.receipt_issued_at := now(); end if;
  return new;
end $$;

drop trigger if exists payments_receipt_number on public.payments;
create trigger payments_receipt_number before insert on public.payments
  for each row execute function private.assign_number('receipt_number', 'receipt', 'RCT-', '5');
drop trigger if exists payments_receipt_issued on public.payments;
create trigger payments_receipt_issued before insert on public.payments
  for each row execute function private.issue_receipt_on_post();

do $$
declare
  r record;
begin
  for r in select id, organization_id from public.payments where receipt_number is null order by created_at, id loop
    update public.payments
       set receipt_number = 'RCT-' || lpad(private.next_number(r.organization_id, 'receipt')::text, 5, '0'),
           receipt_issued_at = coalesce(receipt_issued_at, created_at)
     where id = r.id;
  end loop;
end $$;

commit;
