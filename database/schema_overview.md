# Schema overview

## 1. Findings about the project

* **Frontend (`web/`, React 18 + Vite 8 + Tailwind 4).** ~30 modules (Properties, Units, Tenants, Leases, Applications, Invoices, Payments, Deposits, Expenses & Bills, Accounting, Bank Reconciliation, Maintenance, Projects, Document Center, Messages, Message Templates, Workflow Automation, Activity Logs, Reports, Organization, System Settings, Auth). Almost all of them run on **in-memory stores** (`useSyncExternalStore`, React context) seeded with mock data, some persisted to `localStorage`. Money is stored as integer cents in the Payments/Projects/Deposits modules and as decimals elsewhere.
* **Legacy backend (`server/`, Express + `oracledb`)** serves only the dashboard, chart of accounts, properties, units, tenants, credit notes, vendors, bills and bill schedules against an Oracle schema (`database/schema_oracle.sql`, generated from `docs/schema.prisma`). That Oracle work was already removed from the working tree before this task; `docs/schema.prisma` (47 models) was used as a cross-check of the domain, not as the design — the design follows what the UI actually reads and writes.
* **No Supabase configuration existed**: no `supabase/` folder, no `config.toml`, no environment variables, no client library in `web/package.json`.
* Several modules model the same concept differently (three `Lease` shapes, three `Tenant`s, two invoice/payment models, vendors vs contractors vs service providers). The schema **unifies** them (one `leases` with `lease_units` + `lease_parties`; one `tenants`; invoices as the receivable document and payments allocated to them; one `vendors`).

## 2. Technology and migration strategy

* PostgreSQL 15+ as provided by Supabase. Used features: composite foreign keys with `ON DELETE SET NULL (column)` (15+), `security_invoker` views (15+), GiST exclusion constraints (`btree_gist`), generated columns, `FOR UPDATE SKIP LOCKED`, advisory locks, built-in `sha256()` and `gen_random_uuid()`. No third-party extension besides `btree_gist`.
* **One authoritative location:** `database/migrations/NNN_name.sql`, applied in file order, each in its own transaction. They only create/extend objects, so applying them to an empty project is the supported path. For the Supabase CLI, copy them to `supabase/migrations/<timestamp>_<name>.sql` at deploy time (see `installation_guide.md`).
* Recovery: every migration is additive; `rollback/drop_application_schema.sql` removes everything for throwaway databases; for shared environments the strategy is a backup/PITR snapshot before each migration.

## 3. Structure (138 tables · 17 views · 20 public functions · ~500 policies · ~550 indexes)

| Domain | Migration | Tables |
|---|---|---|
| Identity & security | 001–002, 009 | profiles, user_preferences, organizations, organization_members, organization_invitations, permissions, role_permissions, organization_role_permissions, organization_settings, organization_counters, activity_events, activity_event_details, audit_policies, audit_exports |
| Portfolio | 003 | owners, management_companies, properties, property_owners, units, vendors, vendor_private_details, vendor_workers, property_preferred_vendors |
| Tenancy | 003 | tenants, tenant_private_details, tenant_contacts, tenant_id_documents, applications (+parties, reviews, status history, communications), leases, lease_units, lease_parties, lease_party_units, lease_additional_charges, lease_renewals (+documents) |
| Documents | 003, 008 | documents, document_versions, document_links, signature_requests, signers, signature_fields, signature_events |
| Accounting & receivables & payables | 004 | accounts, expense_categories, catalog_items, journal_entries/lines, invoices/lines/notes, payments, payment_allocations, payment_refunds, credit_notes/lines/applications, expenses, expense_allocations, bills (+units, tenant allocations, payments, recoveries), bill_schedules (+tenants, runs) |
| Banking | 004 | bank_accounts, bank_import_mappings, bank_import_batches, bank_transactions, book_transactions, reconciliations, reconciliation_matches (+line junctions), reconciliation_adjustments |
| Deposits | 004 | deposit_rules, deposit_interest_rates, deposits, deposit_transactions, deposit_refunds, deposit_key_devices, deposit_reconciliation_items |
| Maintenance | 005 | assets, maintenance_requests (+completions), maintenance_work_orders, maintenance_estimates, maintenance_visits, maintenance_work_logs, maintenance_schedules (+checklist) |
| Projects | 005 | projects and 15 child tables (tasks, dependencies, team, invoices, expenses, payments, change orders, quotes, POs, milestones, inspections, deficiencies, tenant notices) |
| Communication & automation | 006 | message_templates (+versions), automation_rules (+conditions), communication_logs, conversations, messages, announcements, notifications, domain_events, workflow_executions, scheduled_tasks, scheduled_task_runs ... |

Full column-level detail: `data_dictionary.md`. Diagrams: `entity_relationships.md`.

## 4. Key design decisions

### Authentication and onboarding
* `public.profiles(id → auth.users.id)`; signup trigger `private.handle_new_user` derives the name from `full_name` / `name` / e-mail prefix and never raises — signup cannot fail because of missing metadata. E-mail changes are mirrored.
* Onboarding is an explicit step: `public.create_organization(...)` creates the organization, the owner membership, the audit policy, the active-organization pointer and the starter chart of accounts **in one transaction**. There is no INSERT policy on `organizations` or `organization_members`; people join by `accept_invitation` (their own consent) or through the service role.
* `organization_members.status = 'suspended'` or `profiles.status = 'deactivated'` removes access immediately (every helper checks both).
* Owners are protected by triggers: the last active owner cannot be demoted, suspended or removed, and only owners can create/modify owners; `transfer_ownership()` swaps roles atomically.

### Multi-tenant isolation (defence in depth)
1. `organization_id NOT NULL` on every organization-owned table.
2. `UNIQUE (organization_id, id)` on parents and composite FKs `(organization_id, parent_id)` on children — a child can never reference another organization's parent (tested).
3. RLS on all 138 tables (a test fails if one is missing), generated from `private.apply_org_policies(table, read_permission, write_permission, delete_permission)` or hand-written where rules are special (documents, conversations, notifications, storage).
4. Polymorphic links (`document_links`) are verified by trigger against a whitelist of tables **inside the same organization**.
5. Helper functions are `SECURITY DEFINER` with `search_path = ''`, live in the unexposed `private` schema, and are executable only by `authenticated`/`service_role`.

### Money and numbering
* `numeric(14,2)`; currency is a `char(3)` on organizations, bank accounts, invoices, payments, bills and expenses. Payments/Projects/Deposits modules use integer cents in the UI: convert at the data-access layer (`cents / 100`).
* Human-readable numbers (`INV-00001`, `LSE-00001`, `PAY-00001`, `MR-00001`, ...) come from `organization_counters` through `private.next_number()` (atomic, per organization) and are assigned by a trigger when the client does not supply one.

### Derived state is derived
Invoice paid / partially paid / overdue, credit remaining, bill status, "expiring" leases, occupancy, KPIs and all report numbers come from views (`v_*`) and are never stored, so they cannot disagree with the ledger.

### Financial rules enforced by the database
* **Journal:** created as draft, posted once (balanced, ≥ 2 lines, active *posting* accounts, not in a closed period), then immutable; corrections by reversal entries (`reverse_journal_entry`). `organizations.books_closed_through` locks periods (`close_books`).
* **Invoices:** lines editable only while draft/pending; an issued invoice can only be sent/viewed/voided; voiding is blocked while payments or credits are applied. A partial unique index forbids a second rent invoice for the same lease and billing period; `generate_rent_invoices` is idempotent.
* **Payments:** never edited or deleted — only reversed (with reason). Allocations, refunds and credit applications are validated under row locks against payment amount, invoice balance, tenant identity and credit validity (a credit created by a reversed payment is invalid). `record_payment` is atomic and idempotent (`idempotency_key`).
* **Bills, bank, reconciliation, deposits:** payments/recoveries ≤ bill; one handling per schedule occurrence; statement-line fingerprints unique per account; no two *reconciled* periods overlap for an account (exclusion constraint); deposit rules/rates cannot overlap in time; deposit transactions are append-only.
* **Leases:** an exclusion constraint on `(unit, date range) WHERE is_occupying AND exclusive` prevents double occupancy race-free; `units.allow_multiple_active_leases` opts a unit out.
* **Audit trail:** `activity_events` is append-only and **hash-chained per organization** (`chain_seq`, `previous_hash`, `event_hash`, advisory lock per organization); `verify_activity_chain()` recomputes it and reports the first broken event. Restricted detail (IP, user agent, restricted before/after values) is split into `activity_event_details` (needs `view_audit_log` **and** `view_sensitive`), its digest being part of the hash.

### Roles and permissions
Roles are fixed (`owner`, `administrator`, `property_manager`, `accountant`, `maintenance_staff`, `read_only`); what they may do is data (`role_permissions`), overridable per organization (`organization_role_permissions`, owner excluded). The UI's nine coarse switches map to the finer database keys:

| UI switch (Settings → Security) | Database permission keys |
|---|---|
| View / Edit organization settings | `view_settings` / `manage_settings` |
| Manage financial defaults, View financial reports | `manage_finance` / `view_finance` |
| Manage properties & leases | `manage_properties`, `manage_tenants`, `manage_vendors` |
| Manage maintenance | `manage_maintenance` (+ `manage_projects` for project work) |
| Manage members & roles | `manage_members` |
| Export organization data / View audit log | `export_data` / `view_audit_log` |

### Storage
Eight private buckets (see `installation_guide.md`) with size and MIME limits. Object names start with the organization id; policies require membership + permission, and for document buckets a **registered, visible `document_versions` row** (so document-level RLS and sensitivity decide downloads). `signed-documents` has no user write policy: only the signing service (service role) writes it. No public URLs — use short-lived signed URLs.

### Scheduling and automation
Scheduled tasks (time-driven) and workflow automation (event-driven) are separate. Duplicate protection: `scheduled_task_runs UNIQUE (task_id, scheduled_for)`, `claim_due_scheduled_tasks()` with `FOR UPDATE SKIP LOCKED` (service role only), `workflow_executions UNIQUE (rule_id, dedupe_key)` plus the window check in `enqueue_workflow_execution()`. Rules cannot be *active* without an active template on the same channel.

## 5. Assumptions and unresolved business rules

1. **Roles/permissions:** the six roles and their defaults are inferred from the Security settings page and role names in several modules; confirm the default matrix (`009_reference_data.sql`) with the business.
2. **Posting accounts:** invoices post Dr `accounts_receivable` / Cr `rent_income` (+ `sales_tax_payable`, `rent_discounts`), payments Dr bank GL / Cr AR (+ `tenant_credits`). If those system accounts are missing, the transaction still succeeds **without** a ledger entry (`journal_entry_id` stays NULL). Decide whether that should be an error in production.
3. **Late fees, deposit liability postings, bill/expense postings, project cost postings, tax filing** are not generated by database functions; the app/service must post them with `create_journal_entry`.
4. **Overdue** = open invoice with a positive balance past its due date (no grace period is applied; grace/late-fee policy lives in lease terms and settings).
5. **Lease "expiring" window** is 60 days in `v_leases_current`; the app setting `property` may differ — views should read the setting if it must be configurable.
6. **Deposit jurisdiction rules** in `development_seed.sql` are illustrative samples, not legal advice.
7. **Rent history:** mid-lease rent changes are represented by renewals/amendments and `leases.financial_effective_date`, not a per-month rent schedule.
8. **Occupancy history** is reproducible from lease dates; a historical *unit status* (e.g. "under maintenance" last March) would need periodic snapshots.
9. **Tenant data:** date of birth is plain `date` in `tenant_private_details` (RLS-protected). If legal review requires encryption at rest beyond Supabase's disk encryption, use column encryption (Vault / pgsodium) there.
10. **Vendor tax IDs** are plain text in `vendor_private_details` for the same reason.
11. **Time zones:** timestamps are `timestamptz`; dates (due dates, lease dates) are `date` interpreted in the organization's time zone by the application.

## 6. Open items (not part of this deliverable)

* Wire `web/` to Supabase (`@supabase/supabase-js`, generated types via `supabase gen types typescript`), replacing the in-memory stores and the Express API.
* Signing service / Edge Functions: send signature links, verify tokens, write `signature_events`, generate certificates and `signed-documents` objects.
* Workers (service role): scheduled-task runner, workflow dispatcher (reads `domain_events` / `workflow_executions`), notification fan-out, e-mail/SMS providers, retention purge using `app.audit_purge`.
* Edge case: orphaned Storage objects (uploaded but never registered) are deletable only by the uploader or the service role — schedule a clean-up job.
* Performance validation on production-sized data (`EXPLAIN` of the reporting views, partitioning of `activity_events` / `journal_entry_lines` if they grow past tens of millions of rows).
