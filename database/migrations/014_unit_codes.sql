-- =====================================================================================================================
-- 014_unit_codes.sql
-- Human-readable unit codes (U-0001, U-0002, ...) assigned by the database, unique per organization, like tenant/lease/property
-- numbers. The Units page shows them as the unit's ID; the row's uuid stays the real key.
-- =====================================================================================================================
begin;
set local search_path = public, extensions;

alter table public.units add column if not exists unit_code text;
create unique index if not exists units_org_code_key on public.units (organization_id, unit_code) where unit_code is not null;

drop trigger if exists units_code on public.units;
create trigger units_code before insert on public.units
  for each row execute function private.assign_number('unit_code', 'unit', 'U-', '4');

-- number the units that already exist (oldest first)
do $$
declare
  r record;
begin
  for r in select id, organization_id from public.units where unit_code is null order by created_at, id loop
    update public.units set unit_code = 'U-' || lpad(private.next_number(r.organization_id, 'unit')::text, 4, '0') where id = r.id;
  end loop;
end $$;

comment on column public.units.unit_code is 'Human-readable unit ID (U-0001), assigned on insert by private.assign_number.';

commit;
