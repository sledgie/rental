-- =====================================================================================================================
-- 015_property_owner_rpc.sql
-- public.set_property_owners(property, owners): replaces a property's owner links in ONE transaction, so the form can save a single
-- owner (100 %) or a joint split without ever leaving the property half-linked. The 100 % total is still enforced by the deferred
-- constraint trigger on property_owners, and the composite foreign key keeps every owner inside the property's organization.
--   p_owners = [{"owner_id": "<uuid>", "percentage": 60}, ...]   (an empty array removes all links)
-- =====================================================================================================================
begin;
set local search_path = public, extensions;

create or replace function public.set_property_owners(p_property uuid, p_owners jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid;
begin
  select organization_id into v_org from public.properties where id = p_property;
  if v_org is null or not private.has_permission(v_org, 'manage_properties') then
    raise exception 'not allowed to change this property' using errcode = '42501';
  end if;
  if jsonb_typeof(coalesce(p_owners, '[]'::jsonb)) <> 'array' then
    raise exception 'p_owners must be a JSON array' using errcode = '22023';
  end if;
  delete from public.property_owners where property_id = p_property;
  insert into public.property_owners (organization_id, property_id, owner_id, ownership_percentage)
    select v_org, p_property, (e ->> 'owner_id')::uuid, coalesce((e ->> 'percentage')::numeric, 100)
      from jsonb_array_elements(coalesce(p_owners, '[]'::jsonb)) e;
end $$;

revoke all on function public.set_property_owners(uuid, jsonb) from public, anon;
grant execute on function public.set_property_owners(uuid, jsonb) to authenticated;

commit;
