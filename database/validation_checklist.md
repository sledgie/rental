# Validation checklist

What was actually executed, what it proves, and what is still open. Nothing here was run against Supabase (no Supabase CLI, Docker or PostgreSQL was available in the environment) and nothing was deployed anywhere.

## 1. How the SQL was validated

The migrations, seed and tests were executed on **PGlite 0.5.11** (real PostgreSQL **18.6** compiled to WebAssembly, in process, with the `btree_gist` extension). Supabase's platform objects were recreated by `tests/supabase_stubs.sql` (roles `anon` / `authenticated` / `service_role`, `auth.users`, `auth.uid()`, `auth.jwt()`, `storage.buckets`, `storage.objects`). Users are simulated exactly as PostgREST does it: JWT claims in `request.jwt.claim.*` plus `SET ROLE authenticated` / `anon`.

```text
cd database/tests && node run_local_tests.mjs
  stubs + 23 migrations                      ok (every file applies cleanly, in order)
  schema      40/40
  integrity  155/155
  rls        150/150
  tasks       91/91
  notify      47/47                          assertions: 483/483 passed

node run_local_tests.mjs --with-dev-seed     seed ran twice (2nd run a no-op)        assertions: 19/19 passed
node run_local_tests.mjs --rollback-check    refused without confirmation → dropped everything (0 relations, no private schema,
                                             no auth triggers, no buckets) → re-applied all 23 migrations → schema tests 40/40
node tests/generate_docs.mjs                 data_dictionary.md + entity_relationships.md regenerated from the live schema
```

Failures found *by these tests* and fixed during development (so they are not hypothetical): unprivileged `anon` could execute internal routines (procedures were missed by the first lock-down); `verify_activity_chain` lacked execute rights on its hash helper; the audit chain was ordered by timestamp (ties possible) → replaced by a per-organization `chain_seq`; administrators could insert memberships for arbitrary users → INSERT policy removed; 151 foreign keys had no covering index → migration 010; users could mark document versions immutable → policy tightened; the maintenance-staff expense test silently passed on an empty sub-select → rewritten with a literal id.

## 2. Checklist against the acceptance criteria

| # | Requirement | Evidence | Status |
|---|---|---|---|
| 1 | Expected tables and columns exist | `schema`: all 138 tables present, no undocumented tables; every table has a comment; data dictionary generated from the live catalog | ✅ run |
| 2 | Foreign keys reference valid tables/columns | PostgreSQL creates them or the migration fails; 392 FKs; every FK (except to `profiles`) has a covering index (`schema`) | ✅ run |
| 3 | Constraints and indexes present | exclusion constraints (lease occupancy, reconciliation periods, deposit rules), partial unique indexes (recurring rent invoice, one reserved application per unit, one primary contact), CHECKs, ~550 indexes (`schema`, `integrity`) | ✅ run |
| 4 | Migrations apply in order | 001→023 on an empty database, and again after the rollback script | ✅ run |
| 5 | Seed data respects the schema | development seed (run twice) + 19 consistency assertions (balanced ledger, no duplicates, valid chain) | ✅ run |
| 6 | RLS enabled on intended tables | `schema`: RLS on every public table; every readable table has a SELECT policy; `organization_counters` deliberately closed; no policy for `anon`/PUBLIC; `anon` has no table/view/function privilege | ✅ run |
| 7 | Policies for each required operation | `rls`: read/insert/update/delete tested per role on representative tables; append-only tables have no UPDATE/DELETE policy | ✅ run |
| 8 | Users cannot access another organization's records | `rls`: outsider, anon and a signed-in owner of another organization — read, insert, update, delete, id-guessing, moving a row by changing `organization_id`; composite-FK attempts in `integrity` | ✅ run |
| 9 | Membership and role checks | six roles + administrator/owner distinctions, suspended member, deactivated user, permission override, owner cannot be restricted, last owner protection | ✅ run |
| 10 | Storage policies protect sensitive documents | `rls`: registered vs unregistered objects, other-organization paths, malformed paths, identification scans need `view_sensitive`, signed-documents not writable, avatar folders, delete rights | ✅ run (against the stub `storage.objects`; real Storage API not exercised) |
| 11 | Financial invariants | unbalanced/posted/closed-period entries, immutability, reversal, issued-invoice immutability, duplicate recurring invoices, over-allocation, wrong-tenant allocation, refunds, credits, payment reversal, idempotency, ledger balance | ✅ run |
| 12 | Duplicate scheduled executions prevented | second worker gets nothing; same occurrence cannot be inserted twice; stale locks reclaimed; workflow de-duplication | ✅ run (sequential — see §3 for concurrency) |
| 13 | Views and functions compile | all 17 views and 20 public functions executed; views are `security_invoker` | ✅ run |
| 14 | Sensitive function privileges | `anon` has none; worker functions are `service_role` only; internal audit writer/seed not callable by users; every SECURITY DEFINER pins `search_path` | ✅ run |
| 15 | Schema supports the persistent UI features | `requirements_mapping.md` (module by module, with documented gaps) | ✅ reviewed (static) |
| 16 | Multiple simulated users and organizations | ten signed-in users across 2 organizations (owner, administrator, property manager, accountant, maintenance staff, read-only, invitees, outsider) + anon | ✅ run |

## 3. Not run — outstanding verification

These need a real Supabase stack and could not be done here. Treat the schema as **not yet verified** for them.

1. **A real Supabase local stack / project** (Docker + CLI, or a throw-away project): apply the migrations through `supabase db reset`, check Studio advisors (RLS, function search_path, exposed schemas), run the three test files against it. In particular confirm that creating the triggers on `auth.users` works from the migration role and that inserting fixture users into the real `auth.users` is accepted.
2. **PostgreSQL 15 and 17** (Supabase's supported majors): everything was executed on 18. The SQL avoids 16+/17+/18-only syntax by review, but this was not executed on those versions.
3. **PostgREST / supabase-js behaviour**: RPC argument naming (`p_*` parameters), `Prefer: return` handling with RLS (e.g. `INSERT ... RETURNING` needs SELECT rights on the new row), and Realtime were not tested.
4. **Supabase Storage API**: real uploads, `owner_id` population (the "own unregistered upload" rule relies on `storage.objects.owner_id`), signed URLs, bucket size/MIME enforcement. The stub tables only prove the policy logic.
5. **Concurrency**: PGlite is single-connection, so parallel behaviour was verified by design review only — advisory lock on the audit chain, `FOR UPDATE` in allocation/credit/bill validators, `FOR UPDATE SKIP LOCKED` task claiming, the invoice unique index under parallel `generate_rent_invoices`. Run a multi-connection test (e.g. `pgbench` or a script) before relying on them.
6. **Performance** with realistic volume (hundreds of thousands of journal lines / audit events): `EXPLAIN` of the reporting views and RLS helper calls; consider partitioning `activity_events` and `journal_entry_lines` later.
7. **Application integration**: the web app is not connected; the data-access layer (units conversion, camelCase↔snake_case, RPC use, upload flow) is future work. The UI statuses/labels map to the lower-case snake_case CHECK values listed in the migrations.
8. **Auth configuration** (email confirmation, password policy, MFA, session timeouts, redirect URLs) and the e-mail/SMS/signing providers.

## 4. Static checks performed

* Every `SECURITY DEFINER` function sets `search_path` and fully qualifies objects; none is executable by `anon`; trigger and helper functions live in the unexposed `private` schema.
* No secrets, keys, passwords or real personal data are present; seed data is fictional (`example.test` addresses).
* No migration drops data or calls a destructive command; the only destructive script is `rollback/drop_application_schema.sql`, which refuses to run without an explicit confirmation setting.
* No duplicate implementation: the Oracle scripts formerly in this folder were already deleted from the working tree (still in git history); nothing else was changed outside `database/`.
