# Installation guide

Nothing in this folder connects to, creates or changes a Supabase project by itself. Every step below is something **you** run deliberately. Never use a production project for the first run, and never put the service-role key, the database password or any other secret in the repository or in front-end code.

## 0. What you need

* A **local** Supabase stack (Supabase CLI + Docker) *or* a throw-away Supabase project, or any PostgreSQL 15+ with the Supabase platform schemas (`auth`, `storage`, roles `anon` / `authenticated` / `service_role`).
* `psql` (optional) and Node 18+ (only for the offline test-suite).

## 1. Apply the migrations

The migrations in `database/migrations` are the single source of truth. Apply them in order, once, to an **empty** project.

### A. Supabase CLI (recommended)

The CLI expects `supabase/migrations/<timestamp>_<name>.sql`. Copy at deploy time — do not commit a second copy.

```bash
supabase init                       # once; creates supabase/ (not part of this repo yet)
supabase start                      # local stack, needs Docker

# bash
mkdir -p supabase/migrations && i=0
for f in database/migrations/*.sql; do
  i=$((i+1)); name=$(basename "$f" .sql | sed 's/^[0-9]*_//')
  cp "$f" "supabase/migrations/$(printf '20260101%06d' "$i")_${name}.sql"
done
supabase db reset                   # applies all migrations to the local database
```

```powershell
# PowerShell
New-Item -ItemType Directory -Force supabase/migrations | Out-Null; $i = 0
Get-ChildItem database/migrations/*.sql | Sort-Object Name | ForEach-Object {
  $i++; $name = ($_.BaseName -replace '^\d+_', '')
  Copy-Item $_.FullName ("supabase/migrations/20260101{0:D6}_{1}.sql" -f $i, $name)
}
supabase db reset
```

Hosted project (after the local run is green and you have a backup/PITR snapshot): `supabase link --project-ref <ref>` then `supabase db push`.

### B. Plain `psql`

```bash
export DATABASE_URL='postgresql://postgres:<password>@127.0.0.1:54322/postgres'   # local stack default port
for f in database/migrations/*.sql; do psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f" || break; done
```

Each file is wrapped in its own transaction, so a failing file leaves nothing half-applied.

## 2. Supabase settings that the schema relies on

| Setting | Value |
|---|---|
| **Authentication → Providers → Email** | Enabled. Turn **Confirm email** on for production. Sign-in/sign-up work with the stock `signUp` / `signInWithPassword` calls; the profile row is created by the database trigger. |
| **Authentication → URL configuration** | Site URL = your app URL; add redirect URLs for password reset and invitation links. |
| **Authentication → Password policy / MFA / session timeout** | The Security settings page stores the *desired* policy in `organization_settings`; actual enforcement is configured here (these are project-wide Auth settings, not per organization). |
| **Data API → Exposed schemas** | `public` only. **Never expose `private`** — it holds the SECURITY DEFINER helpers. |
| **Storage** | Buckets are created by migration 008 (all private). Confirm in Studio that none is public. |

Migration 002 creates triggers on `auth.users` (`on_auth_user_created`, `on_auth_user_email_changed`). Creating triggers on `auth.users` is the documented Supabase pattern; it works from the `postgres` role used by the CLI and the SQL editor.

## 3. Roles and keys

| Who | Key | May |
|---|---|---|
| Browser / mobile app | **anon key + the user's JWT** (role `authenticated`) | Everything the RLS policies allow. Calls `rpc('create_organization' ...)`, `record_payment`, `issue_invoice`, `record_activity`, etc. |
| Workers / Edge Functions | **service-role key (server side only)** | `claim_due_scheduled_tasks`, `complete_scheduled_task_run`, `reclaim_stale_task_runs`, `enqueue_workflow_execution`, writing `signature_events`, `notifications`, `workflow_executions`, `signed-documents` objects |
| Anyone not signed in | anon | Nothing: `anon` has no privilege on any table, view or public function |

```ts
// browser
const { data: orgId } = await supabase.rpc('create_organization', { p_name: 'Maple Ridge Rentals', p_business_type: 'property_management_company' });
await supabase.rpc('record_payment', { p_org: orgId, p_tenant: tenantId, p_lease: leaseId, p_date: '2026-10-01', p_amount: 1850, p_method: 'etransfer',
  p_bank_account: bankId, p_allocations: [{ invoice_id, amount: 1850 }], p_idempotency_key: crypto.randomUUID() });

// worker (service role, server only)
const { data: runs } = await admin.rpc('claim_due_scheduled_tasks', { p_worker: 'worker-1', p_limit: 10 });
```

Generate typed clients with `supabase gen types typescript --local > web/src/database.types.ts` once the app is wired.

## 4. Storage

| Bucket | Content | Limit | Read needs | Write needs |
|---|---|---|---|---|
| `tenant-identification` | ID scans, tenant photos | 10 MB; JPEG/PNG/WebP/PDF | `view_sensitive` + registered sensitive document | `manage_tenants` + `view_sensitive` |
| `lease-documents` | Lease PDFs, addenda, notices | 25 MB; PDF/DOC(X)/images | `view_documents` + registered version | `upload_documents` |
| `signed-documents` | Signed PDFs and certificates | 25 MB; PDF | `view_documents` + registered version | **service role only** |
| `property-images` | Cover and gallery images | 5 MB; images | `view_properties` | `manage_properties` |
| `maintenance-attachments` | Photos, reports | 25 MB; images/PDF/MP4 | `view_maintenance` + registered version | `manage_maintenance` |
| `project-documents` | Quotes, permits, photos | 25 MB; images/PDF/XLSX/CSV | `view_projects` + registered version | `manage_projects` |
| `finance-documents` | Receipts, statements, supporting invoices | 25 MB; PDF/images/CSV/XLSX | `view_finance` + registered version | `manage_finance` |
| `organization-assets` | Logo, per-user avatars (`<org>/avatars/<user>/...`) | 2 MB; images | `view_settings` | `manage_settings` (avatars: own folder) |

**Object name convention:** `<organization_id>/<area>/<record id>/<random-uuid>-<file name>`. The first segment must be the organization id; policies reject anything else.

**Upload flow for a document bucket** (the app must follow it, because downloads require a registered version):
1. `insert` a `documents` row (set `uploaded_by = auth.uid()`),
2. upload the file to Storage with the path above,
3. `insert` a `document_versions` row with the same `storage_bucket` / `storage_path`, `size_bytes`, `sha256`, then set `documents.current_version_id`,
4. link it with `document_links`.

If step 3 fails the uploader can still see and delete their own unregistered object; anything older is cleaned up by a service-role job.

**Download:** `supabase.storage.from(bucket).createSignedUrl(path, 60)` — never use public URLs.

## 5. Optional demo data

`seed/development_seed.sql` creates a fictional organization **but never an Auth user**.

1. Create a user the supported way (Studio → Authentication → Add user, the app's sign-up page, or the Admin API).
2. Run, in one session:
   ```bash
   psql "$DATABASE_URL" -c "select set_config('app.seed_owner_email', 'you@example.com', false)" -f database/seed/development_seed.sql
   ```
   (use a single psql session: `psql "$DATABASE_URL"` then `set app.seed_owner_email = 'you@example.com'; \i database/seed/development_seed.sql`).
3. Running it again is a no-op. Document rows have storage paths but **no files are uploaded**.

## 6. Verify the installation

* Offline (no Supabase): `cd database/tests && npm i @electric-sql/pglite && node run_local_tests.mjs`.
* On a real local Supabase: run `tests/schema_validation.sql` as the `postgres` role (it creates the helper functions and needs no stubs there). `data_integrity_validation.sql` / `rls_validation.sql` also work against Supabase's real `auth.users`, but they insert users with `insert into auth.users (id, email, ...)` — if your GoTrue version requires more columns, create the fixture users with the Admin API instead. **This real-stack run has not been performed yet** (see `validation_checklist.md`).
* The test files create helper objects (`public.test_results`, `public.test_ctx`, `public.test_*` functions) and fictional fixtures: run them only on a throw-away database, or drop those helpers and the fixture organizations afterwards.
* After the first deploy check in Studio: Table editor shows RLS enabled on every table; Storage shows 8 private buckets; Database → Functions lists the RPCs; Advisors report no "RLS disabled" findings.

## 7. Rollback and recovery

* Migrations are additive; there is no per-migration "down" script (a destructive down-migration on financial data would be a trap).
* **Throw-away database:** `database/rollback/drop_application_schema.sql` (needs `select set_config('app.confirm_drop','yes-drop-everything', false)` first) removes every application object, Storage policy and bucket row; then re-apply the migrations. Empty the Storage buckets with the Storage API beforehand.
* **Shared / hosted environments:** take a backup or enable point-in-time recovery *before* each `db push`; to roll back restore the snapshot. Do not hand-edit applied migration files — add a new numbered migration instead.
* Anything that cannot be rolled back automatically: Storage files (uploaded objects are not removed by SQL), Auth users, and rows written by workers.

## 8. Adding a migration later

Create `012_<name>.sql` (begin/commit, `set local search_path = public, extensions`), call `private.apply_org_policies(...)` for new tables, add composite `(organization_id, id)` keys, run `tests/schema_validation.sql` (it fails if a table lacks RLS, a comment, or a foreign key lacks an index), then regenerate the docs with `node tests/generate_docs.mjs`. If you add a helper to schema `private` that policies call, grant it to `authenticated` explicitly in that migration (schema `private` revokes execution by default).
