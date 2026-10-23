-- =====================================================================================================================
-- 013_property_codes.sql
-- Property codes (PR-0001, PR-0002, ...) are assigned by the database when the application does not supply one, the same way
-- tenant, application and lease numbers already are (private.assign_number, atomic per organization).
-- =====================================================================================================================
begin;
set local search_path = public, extensions;

drop trigger if exists properties_code on public.properties;
create trigger properties_code before insert on public.properties
  for each row execute function private.assign_number('code', 'property', 'PR-', '4');

commit;
