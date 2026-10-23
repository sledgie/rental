-- =====================================================================================================================
-- 008_storage_policies.sql
-- Supabase Storage: private buckets + organization-scoped access policies on storage.objects.
--
-- Object naming convention (every bucket):   <organization_id>/<area>/<record id>/<random-uuid>-<original file name>
--   * The first path segment MUST be the organization id. Policies never trust that alone:
--       - the caller must be an active member of that organization with the bucket's permission, and
--       - for document buckets, READ additionally requires a visible public.document_versions row that registers the object
--         (so Row-Level Security of documents / sensitive-document rules decides who can download); the only exception is the
--         uploader's own not-yet-registered upload (owner_id = auth.uid()), so a failed registration can be cleaned up, and
--       - signed-documents is write-protected for end users: the signing service (service role) writes it.
--   * Sensitive buckets are private; the application downloads through short-lived signed URLs (createSignedUrl), never public URLs.
-- The bucket rows are created by this migration when it is applied. Applying it is a deliberate step (see installation_guide.md);
-- nothing here connects to or modifies a remote project by itself.
-- =====================================================================================================================
begin;
set local search_path = public, extensions;

-- Organization id encoded in the first folder of an object name (NULL when malformed).
create or replace function private.storage_org(p_name text) returns uuid
language sql immutable set search_path = '' as $$
  select case when split_part(p_name, '/', 1) ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
              then split_part(p_name, '/', 1)::uuid end;
$$;

-- True when the object is registered as a version of a document the caller may see (RLS of documents/document_versions applies).
create or replace function private.storage_object_registered(p_bucket text, p_name text) returns boolean
language sql stable set search_path = '' as $$
  select exists (select 1 from public.document_versions v where v.storage_bucket = p_bucket and v.storage_path = p_name);
$$;
revoke all on function private.storage_org(text), private.storage_object_registered(text, text) from public, anon;
grant execute on function private.storage_org(text), private.storage_object_registered(text, text) to authenticated, service_role;

-- Buckets ------------------------------------------------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('tenant-identification', 'tenant-identification', false,  10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  ('lease-documents',       'lease-documents',       false,  26214400, array['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/jpeg', 'image/png']),
  ('signed-documents',      'signed-documents',      false,  26214400, array['application/pdf']),
  ('property-images',       'property-images',       false,   5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('maintenance-attachments','maintenance-attachments', false, 26214400, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'video/mp4']),
  ('project-documents',     'project-documents',     false,  26214400, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/csv']),
  ('finance-documents',     'finance-documents',     false,  26214400, array['application/pdf', 'image/jpeg', 'image/png', 'text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']),
  ('organization-assets',   'organization-assets',   false,   2097152, array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Policy generator -----------------------------------------------------------------------------------------------------------
--   p_read / p_write   permissions needed to download / upload+replace
--   p_delete           permission needed to delete (NULL = nobody but the service role)
--   p_registered       require a registered, visible document version for downloads
create or replace procedure private.apply_storage_policies(p_bucket text, p_read text, p_write text, p_delete text, p_registered boolean)
language plpgsql set search_path = public as $$
declare
  v_select text := format('bucket_id = %L and private.storage_org(name) is not null and private.has_permission(private.storage_org(name), %L)%s',
                          p_bucket, p_read, case when p_registered then ' and (private.storage_object_registered(bucket_id, name) or owner_id = (select auth.uid())::text)' else '' end);
begin
  execute format('drop policy if exists %I on storage.objects', p_bucket || '_select');
  execute format('create policy %I on storage.objects for select to authenticated using (%s)', p_bucket || '_select', v_select);
  if p_write is not null then
    execute format('drop policy if exists %I on storage.objects', p_bucket || '_insert');
    execute format('create policy %I on storage.objects for insert to authenticated with check (bucket_id = %L and private.storage_org(name) is not null and private.has_permission(private.storage_org(name), %L))',
                   p_bucket || '_insert', p_bucket, p_write);
    execute format('drop policy if exists %I on storage.objects', p_bucket || '_update');
    execute format('create policy %I on storage.objects for update to authenticated using (bucket_id = %L and private.storage_org(name) is not null and private.has_permission(private.storage_org(name), %L)) with check (bucket_id = %L and private.storage_org(name) is not null and private.has_permission(private.storage_org(name), %L))',
                   p_bucket || '_update', p_bucket, p_write, p_bucket, p_write);
  end if;
  if p_delete is not null then
    execute format('drop policy if exists %I on storage.objects', p_bucket || '_delete');
    execute format('create policy %I on storage.objects for delete to authenticated using (bucket_id = %L and private.storage_org(name) is not null and private.has_permission(private.storage_org(name), %L))',
                   p_bucket || '_delete', p_bucket, p_delete);
  end if;
end $$;

call private.apply_storage_policies('tenant-identification', 'view_sensitive',   'manage_tenants',     'manage_documents',   true);
call private.apply_storage_policies('lease-documents',       'view_documents',   'upload_documents',   'manage_documents',   true);
call private.apply_storage_policies('signed-documents',      'view_documents',   null,                 null,                 true);    -- written by the signing service only
call private.apply_storage_policies('property-images',       'view_properties',  'manage_properties',  'manage_properties',  false);
call private.apply_storage_policies('maintenance-attachments','view_maintenance','manage_maintenance', 'manage_maintenance', true);
call private.apply_storage_policies('project-documents',     'view_projects',    'manage_projects',    'manage_projects',    true);
call private.apply_storage_policies('finance-documents',     'view_finance',     'manage_finance',     'manage_finance',     true);
call private.apply_storage_policies('organization-assets',   'view_settings',    'manage_settings',    'manage_settings',    false);

-- Tenant identification images must additionally be uploaded by someone who may see sensitive data.
drop policy if exists tenant_identification_insert on storage.objects;
create policy tenant_identification_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'tenant-identification' and private.storage_org(name) is not null
              and private.has_permission(private.storage_org(name), 'manage_tenants') and private.has_permission(private.storage_org(name), 'view_sensitive'));

-- Personal avatars live under organization-assets/avatars/<organization_id>/<user_id>/...; a user may manage only their own folder.
drop policy if exists organization_assets_own_avatar on storage.objects;
create policy organization_assets_own_avatar on storage.objects for all to authenticated
  using (bucket_id = 'organization-assets' and split_part(name, '/', 2) = 'avatars' and split_part(name, '/', 3) = (select auth.uid())::text
         and private.is_org_member(private.storage_org(name)))
  with check (bucket_id = 'organization-assets' and split_part(name, '/', 2) = 'avatars' and split_part(name, '/', 3) = (select auth.uid())::text
              and private.is_org_member(private.storage_org(name)));

commit;
