-- =====================================================================================================================
-- 020_document_numbers.sql
-- Human-readable document numbers (DOC-00001, ...) assigned by the database, unique per organization, like the other numbered records.
-- The Document Center shows and searches by this number.
-- =====================================================================================================================
begin;
set local search_path = public, extensions;

alter table public.documents add column if not exists document_number text;
create unique index if not exists documents_org_number_key on public.documents (organization_id, document_number) where document_number is not null;
drop trigger if exists documents_number on public.documents;
create trigger documents_number before insert on public.documents
  for each row execute function private.assign_number('document_number', 'document', 'DOC-', '5');

do $$
declare
  r record;
begin
  for r in select id, organization_id from public.documents where document_number is null order by created_at, id loop
    update public.documents set document_number = 'DOC-' || lpad(private.next_number(r.organization_id, 'document')::text, 5, '0') where id = r.id;
  end loop;
end $$;

commit;
