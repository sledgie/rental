# Keystone database (Supabase / PostgreSQL)

The relational model, security rules and storage policies for the Keystone rental-management web app (`web/`), written for **Supabase** (PostgreSQL 15+, Supabase Auth, Row-Level Security, Storage).

> **Status:** the schema is complete and tested on an in-process PostgreSQL (see `validation_checklist.md` for exactly what was run and what was *not*). It has been applied to a Supabase project. The web app's **auth, organizations, members, invitations and activity-log screens** read/write it when `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set (`web/src/auth/services/supabase*Service.ts`); every other module still runs on in-memory / `localStorage` data and the legacy Express + Oracle API.
> The old Oracle scripts that used to sit in this folder (`schema_oracle.sql`, `drop_all_oracle.sql`, `add_*.sql`) were already deleted from the working tree before this work started; they are still in git history. This folder is now the only database implementation — nothing was duplicated elsewhere.

## Layout

```
database/
├── README.md                    you are here
├── schema_overview.md           architecture, conventions, decisions, assumptions, open items
├── data_dictionary.md           every table, column, key, index count, RLS summary (generated)
├── entity_relationships.md      Mermaid ER diagrams per domain (generated)
├── requirements_mapping.md      UI module → tables/views/policies/functions/tests, plus gaps
├── installation_guide.md        applying to a local/hosted Supabase project, Auth + Storage setup, rollback
├── validation_checklist.md      what was executed and what still needs a real Supabase run
├── migrations/                  THE source of truth (apply in file order)
│   ├── 001_core_schema.sql           profiles, organizations, members, permissions, settings, hash-chained audit trail
│   ├── 002_organization_security.sql authorization helpers, signup trigger, onboarding RPCs, RLS for core tables
│   ├── 003_rental_management.sql     properties, units, tenants, vendors, documents, e-signature, applications, leases
│   ├── 004_accounting.sql            chart of accounts, journal, invoices, payments, credits, expenses, bills, banking, reconciliation, deposits
│   ├── 005_maintenance_and_projects.sql
│   ├── 006_communication_automation_audit.sql   templates, automation, messaging, notifications, scheduled tasks
│   ├── 007_views_and_functions.sql   reporting views + issue_invoice / record_payment / reverse_payment / generate_rent_invoices / close_books ...
│   ├── 008_storage_policies.sql      8 private buckets + Storage RLS
│   ├── 009_reference_data.sql        permission catalog, role defaults, starter chart of accounts, privilege lock-down
│   ├── 010_foreign_key_indexes.sql   covering indexes for foreign keys
│   ├── 011_table_comments.sql        documentation stored in the database
│   ├── 012_invitation_inbox.sql         invitations a signed-in user can see and accept
│   ├── 013_property_codes.sql           property codes (PR-0001)
│   ├── 014_unit_codes.sql               unit codes (U-0001)
│   ├── 015_property_owner_rpc.sql       replace a property's owners in one transaction
│   ├── 016_lease_financial_notes.sql    lease financial notes
│   ├── 017_payment_receipts.sql         payment receipt numbers
│   ├── 018_bank_account_codes.sql       bank account codes (BA-001)
│   ├── 019_maintenance_records.sql      schedule numbers and payment fields on linked expenses
│   ├── 020_document_numbers.sql         document numbers (DOC-00001)
│   └── 021_automation_condition_operators.sql   empty / not-empty tests in automation rules
├── seed/development_seed.sql    OPTIONAL fictional demo organization (local development only)
├── rollback/drop_application_schema.sql   DESTRUCTIVE reset for throwaway databases
└── tests/
    ├── schema_validation.sql         structure, RLS coverage, privileges, storage config
    ├── data_integrity_validation.sql business rules (isolation, ledger, payments, leases, audit chain, tasks ...)
    ├── rls_validation.sql            many simulated users: isolation, roles, sensitive data, storage, views, service-only functions
    ├── dev_seed_smoke.sql            consistency checks of the development seed
    ├── supabase_stubs.sql            minimal auth/storage/roles so the above run on plain PostgreSQL (NEVER apply to Supabase)
    ├── run_local_tests.mjs           runs everything on PGlite (WebAssembly PostgreSQL) — no Docker needed
    └── generate_docs.mjs             regenerates data_dictionary.md and entity_relationships.md from the live schema
```

There is deliberately **no `supabase/` folder**: the repository did not use the Supabase CLI. `installation_guide.md` shows how to feed `database/migrations` to the CLI without keeping two copies of the truth.

## Quick start

```bash
# 1) run the whole test-suite locally (no Docker, no Supabase)
cd database/tests
npm install @electric-sql/pglite          # dev-only; node_modules is git-ignored
node run_local_tests.mjs                  # stubs + migrations + schema / integrity / RLS tests
node run_local_tests.mjs --with-dev-seed  # migrations + demo data (run twice) + smoke checks
node run_local_tests.mjs --rollback-check # drop everything, reinstall, re-validate

# 2) apply to a Supabase project: see installation_guide.md
```

## Design in five lines

1. **Supabase Auth owns identity**; `profiles.id = auth.users.id`, created by a signup trigger that cannot fail on missing metadata. Organizations are explicit tenants; a user can belong to several with a different role in each.
2. **Every organization-owned table carries `organization_id`** and child tables use *composite* foreign keys `(organization_id, parent_id)`, so cross-organization references are impossible at the database level; RLS checks the caller's membership and permission for that organization (never a client-supplied id alone).
3. **Six fixed roles, data-driven permissions** (`permissions`, `role_permissions`, per-organization overrides). Policies call `private.has_permission(org, 'key')`.
4. **Financial integrity in the database:** double-entry journal (draft → post once → immutable → reverse), immutable issued invoices and payments, locked allocation/credit/refund validation, one recurring rent invoice per lease and period, closed-period lock, hash-chained append-only audit trail.
5. **Files stay in Storage** (8 private buckets, organization-folder paths, signed URLs); the database stores metadata, versions, SHA-256 and links.
