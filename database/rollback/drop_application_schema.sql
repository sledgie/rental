-- =====================================================================================================================
-- drop_application_schema.sql  -  DESTRUCTIVE. LOCAL / THROWAWAY DATABASES ONLY.
--
-- Removes every object created by database/migrations (tables, views, functions, policies, the private schema, the auth.users
-- triggers and the Storage policies + bucket rows) so the migrations can be applied again from scratch. All business data in the
-- dropped tables is lost. There is no per-migration "down" script: migrations are additive, and the recovery strategy for a
-- shared environment is a point-in-time restore / backup taken before applying a migration (see installation_guide.md).
--
-- It refuses to run unless you opt in explicitly in the same session:
--     select set_config('app.confirm_drop', 'yes-drop-everything', false);
-- Storage objects (files) are NOT deleted by SQL; empty the buckets with the Storage API first. Never run this against production.
-- =====================================================================================================================
do $$
declare
  r record;
  v_buckets text[] := array['tenant-identification', 'lease-documents', 'signed-documents', 'property-images', 'maintenance-attachments', 'project-documents', 'finance-documents', 'organization-assets'];
  v_bucket text;
begin
  if coalesce(current_setting('app.confirm_drop', true), '') <> 'yes-drop-everything' then
    raise exception 'Refusing to drop the application schema. Set app.confirm_drop = ''yes-drop-everything'' to confirm (local databases only).';
  end if;

  -- Storage policies and bucket rows
  foreach v_bucket in array v_buckets loop
    for r in select unnest(array['_select', '_insert', '_update', '_delete']) as suffix loop
      execute format('drop policy if exists %I on storage.objects', v_bucket || r.suffix);
    end loop;
  end loop;
  drop policy if exists tenant_identification_insert on storage.objects;
  drop policy if exists organization_assets_own_avatar on storage.objects;
  if not exists (select 1 from storage.objects where bucket_id = any (v_buckets) limit 1) then
    delete from storage.buckets where id = any (v_buckets);
  else
    raise notice 'Storage objects still exist in the application buckets; the bucket rows were kept. Empty them via the Storage API.';
  end if;

  -- triggers on Supabase-owned tables
  drop trigger if exists on_auth_user_created on auth.users;
  drop trigger if exists on_auth_user_email_changed on auth.users;

  -- views, tables, then routines in public
  for r in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
            where n.nspname = 'public' and c.relkind in ('v', 'm') and not exists (select 1 from pg_depend d where d.objid = c.oid and d.deptype = 'e') loop
    execute format('drop view if exists public.%I cascade', r.relname);
  end loop;
  for r in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
            where n.nspname = 'public' and c.relkind in ('r', 'p') and not exists (select 1 from pg_depend d where d.objid = c.oid and d.deptype = 'e') loop
    execute format('drop table if exists public.%I cascade', r.relname);
  end loop;
  for r in select p.oid::regprocedure::text as sig, p.prokind from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e') loop
    execute format('drop %s if exists %s cascade', case when r.prokind = 'p' then 'procedure' else 'function' end, r.sig);
  end loop;

  drop schema if exists private cascade;
  raise notice 'Application schema dropped. Re-apply database/migrations/*.sql to reinstall.';
end $$;
