-- =====================================================================================================================
-- 011_table_comments.sql
-- Documentation stored in the database itself (visible in Supabase Studio and used to generate database/data_dictionary.md).
-- =====================================================================================================================
begin;
set local search_path = public, extensions;

do $$
declare
  r record;
begin
  for r in select * from (values
    -- identity / organization
    ('profiles', 'Application profile of a Supabase Auth user (id = auth.users.id). Created by the signup trigger; holds display data only, never credentials.'),
    ('user_preferences', 'Personal preferences (theme, landing page, density, notifications) and the currently selected organization of one user.'),
    ('organizations', 'A tenant of the application: a landlord business or management company. Holds profile, regional defaults, contact/address and the books-closed date.'),
    ('organization_members', 'Membership of a user in an organization with one of six roles (owner, administrator, property_manager, accountant, maintenance_staff, read_only).'),
    ('organization_invitations', 'Pending/accepted/declined/expired/revoked invitations to join an organization. Only a hash of the emailed token is stored.'),
    ('permissions', 'Global catalog of permission keys referenced by every RLS policy.'),
    ('role_permissions', 'Default permissions of each role (the owner role is implicit and always allowed).'),
    ('organization_role_permissions', 'Per-organization overrides of the default role permissions (the security permission matrix).'),
    ('organization_settings', 'One JSON document of settings per organization and category (general, financial, property, maintenance, projects, notifications, tasks, workflow, documents, security, data, bank_reconciliation, deposits).'),
    ('organization_counters', 'Atomic per-organization counters used to generate human-readable numbers (invoices, leases, payments ...). No API access.'),
    ('activity_events', 'Append-only, hash-chained audit trail per organization (Activity Logs, payment/deposit/signature audit, member management).'),
    ('activity_event_details', 'Restricted part of an audit event (IP, user agent, request ids, restricted before/after values); needs view_audit_log AND view_sensitive.'),
    ('audit_policies', 'Audit retention and archive settings of an organization.'),
    ('audit_exports', 'Record of every audit-trail export (who, which filters, how many rows).'),
    -- portfolio
    ('owners', 'Property owners (individuals or organizations) that hold shares of properties.'),
    ('management_companies', 'External property management companies referenced by properties.'),
    ('properties', 'Buildings/parcels managed by an organization: address, configuration, ownership, financial, utility and maintenance defaults.'),
    ('property_owners', 'Ownership shares of owners in properties (total per property <= 100 %).'),
    ('units', 'Rentable units of a property with status, rent, features and inspection dates.'),
    ('vendors', 'Vendors, contractors and service providers (maintenance, projects, utility bills).'),
    ('vendor_private_details', 'Sensitive vendor identifiers (tax id); readable only with view_sensitive.'),
    ('vendor_workers', 'Individual workers employed by a contractor.'),
    ('property_preferred_vendors', 'Preferred contractors of a property (junction).'),
    -- tenancy
    ('tenants', 'People who rent, applied to rent or are prospects. One row per person per organization.'),
    ('tenant_private_details', 'Sensitive personal data of a tenant (date of birth); readable only with view_sensitive.'),
    ('tenant_contacts', 'Emergency, alternate, guarantor and employer contacts of a tenant.'),
    ('tenant_id_documents', 'Metadata of identification documents (type, expiry, verification). The scan itself is a sensitive document in Storage.'),
    ('applications', 'Rental applications for a unit with status, reviewer, reservation and requested terms.'),
    ('application_parties', 'Applicants, co-applicants and proposed occupants of an application, with screening and signature state.'),
    ('application_reviews', 'Screening/review steps (credit, references, income ...) performed on an application.'),
    ('application_status_history', 'Automatic history of application status changes (written by trigger).'),
    ('application_communications', 'Logged contacts with applicants (calls, emails, letters) and follow-ups.'),
    ('leases', 'Lease agreements with dates, status and financial terms. A lease can cover several units and parties.'),
    ('lease_additional_charges', 'Extra recurring charges stated on a lease (label + amount).'),
    ('lease_units', 'Units covered by a lease with rent allocation and occupancy dates. A GiST exclusion constraint prevents overlapping exclusive occupancy.'),
    ('lease_parties', 'People attached to a lease (main tenant, co-tenant, occupant, guarantor) with signatory/signature state and relationship dates.'),
    ('lease_party_units', 'Which unit(s) of the lease each party occupies.'),
    ('lease_renewals', 'Renewal and amendment proposals for a lease.'),
    ('lease_renewal_documents', 'Documents attached to a renewal or amendment (junction).'),
    -- documents
    ('documents', 'Document Center records: name, type, category, origin module, status, tags, expiry. Binary content lives in Supabase Storage.'),
    ('document_versions', 'Versions of a document. Each row registers one Storage object (bucket + path, size, SHA-256). Signed versions are immutable.'),
    ('document_links', 'Links a document to the business records it belongs to (property, lease, tenant, invoice ...). Targets are verified to belong to the same organization.'),
    ('signature_requests', 'E-signature requests for a document version (hash-locked at send time).'),
    ('signers', 'Signers of a request. Only hashes of tokens/PINs/OTPs are stored.'),
    ('signature_fields', 'Placement of signature/initial/date/text fields (normalised page coordinates).'),
    ('signature_events', 'Append-only evidence trail of a signature request (sent, viewed, signed ... with IP and document hash).'),
    -- accounting
    ('accounts', 'Chart of accounts (hierarchical, max 8 levels). System keys let posting functions find control accounts.'),
    ('expense_categories', 'Expense categories mapped to a default GL account.'),
    ('catalog_items', 'Billable/creditable catalog items with default rate and GL account.'),
    ('bank_accounts', 'Bank accounts (last 4 digits only) mapped to an asset/liability GL account.'),
    ('journal_entries', 'Double-entry journal headers. Created as draft, posted once; posted entries are immutable (reverse instead).'),
    ('journal_entry_lines', 'Journal lines with debit/credit and reporting dimensions (property, unit, tenant, lease, vendor, bank account, project).'),
    ('invoices', 'Receivable invoices to tenants. Paid/partial/overdue states are derived in v_invoice_balances. Issued invoices are immutable.'),
    ('invoice_lines', 'Invoice lines; subtotal and tax are generated columns.'),
    ('invoice_notes', 'Internal notes on an invoice.'),
    ('payments', 'Payments received from tenants. Never edited or deleted; only reversed.'),
    ('payment_allocations', 'Allocation of a payment to invoices; validated against payment amount and invoice balance.'),
    ('payment_refunds', 'Refunds of unapplied payment amounts (append-only).'),
    ('credit_notes', 'Credits held for a tenant (manual credit notes and overpayment credits).'),
    ('credit_note_lines', 'Lines of a credit note (item, account, quantity, rate, discount).'),
    ('credit_note_applications', 'Application of a credit note to invoices (append-only, validated).'),
    ('expenses', 'General property/business expenses with optional unit, vendor, work order and bank account.'),
    ('expense_allocations', 'Split of one expense across properties/units; must add up to the expense total.'),
    ('bill_schedules', 'Recurring bill schedules (utilities, insurance, taxes) with frequency and tenant allocation rules.'),
    ('bill_schedule_tenants', 'Tenants that share a scheduled bill (junction).'),
    ('bill_schedule_runs', 'Handled occurrences of a bill schedule (posted/skipped); unique per schedule and due date.'),
    ('bills', 'Vendor/utility bills payable by the organization, optionally recoverable from tenants.'),
    ('bill_units', 'Units a bill relates to (junction).'),
    ('bill_tenant_allocations', 'How a bill is split between tenants (percentage, fixed, manual, equal).'),
    ('bill_payments', 'Payments made to the provider of a bill (validated against the bill amount).'),
    ('bill_tenant_recoveries', 'Amounts recovered from tenants for a bill.'),
    ('bank_import_mappings', 'Saved CSV column mappings for bank statement imports.'),
    ('reconciliations', 'Bank reconciliation sessions per account and period. Overlapping reconciled periods are impossible (exclusion constraint).'),
    ('bank_import_batches', 'Bank statement import runs with row counts and warnings.'),
    ('bank_transactions', 'Imported bank statement lines; a fingerprint prevents importing the same line twice.'),
    ('book_transactions', 'Ledger-side transactions presented to the reconciliation screen.'),
    ('book_transaction_invoices', 'Invoices referenced by a ledger transaction.'),
    ('reconciliation_matches', 'Confirmed matches between bank and ledger lines with confidence and history.'),
    ('reconciliation_match_bank_lines', 'Bank lines in a match (a line belongs to one match at a time).'),
    ('reconciliation_match_book_lines', 'Ledger lines in a match (a line belongs to one match at a time).'),
    ('reconciliation_adjustments', 'Adjustments (fees, interest, timing) proposed during a reconciliation.'),
    ('deposit_rules', 'Jurisdiction rules for security deposits (limits, interest, refund conditions). organization_id NULL = system default.'),
    ('deposit_interest_rates', 'Effective-dated interest rates for deposits.'),
    ('deposits', 'Security deposits held for a lease with status, accounts and rule snapshot.'),
    ('deposit_refunds', 'Refund requests/approvals/payments for a deposit.'),
    ('deposit_transactions', 'Append-only ledger of everything that happened to a deposit.'),
    ('deposit_key_devices', 'Keys/fobs/access cards issued against a key deposit.'),
    ('deposit_reconciliation_items', 'Exceptions found when reconciling deposits to the ledger.'),
    -- maintenance
    ('assets', 'Equipment and fixtures (appliances, HVAC ...) with warranty, condition and replacement chain.'),
    ('maintenance_requests', 'Maintenance requests with priority, workflow status, approval and resolution.'),
    ('maintenance_request_completions', 'History of earlier completions of a request that was reopened.'),
    ('maintenance_work_orders', 'Work orders issued for a request.'),
    ('maintenance_estimates', 'Cost estimates for a request; total is generated.'),
    ('maintenance_visits', 'Scheduled visits for a request/work order.'),
    ('maintenance_work_logs', 'Time and work performed entries.'),
    ('maintenance_schedules', 'Preventive maintenance and inspection schedules.'),
    ('maintenance_schedule_checklist_items', 'Checklist steps of a preventive schedule.'),
    -- projects
    ('projects', 'Property improvement projects with budget, dates, occupancy impact and readiness.'),
    ('project_tenant_notifications', 'Notices sent to tenants affected by a project.'),
    ('project_team_members', 'Contractors assigned to a project with contract amounts.'),
    ('project_tasks', 'Project tasks with planned/actual dates and costs.'),
    ('project_task_dependencies', 'Task dependency edges.'),
    ('project_invoices', 'Invoices received from contractors for a project.'),
    ('project_invoice_lines', 'Lines of a project invoice; subtotal and tax generated.'),
    ('project_purchase_orders', 'Purchase orders of a project.'),
    ('project_expenses', 'Itemised project expenses with approval; totals are generated.'),
    ('project_payments', 'Payments made to project payees.'),
    ('project_payment_allocations', 'Allocation of project payments to project invoices (validated).'),
    ('project_change_orders', 'Budget/schedule change orders and their approval.'),
    ('project_quotes', 'Contractor quotes received for a project.'),
    ('project_milestones', 'Project milestones.'),
    ('project_inspections', 'Inspections performed during a project with checklist and result.'),
    ('project_deficiencies', 'Deficiencies found by inspections and their resolution.'),
    -- communication / automation
    ('message_templates', 'Reusable email/SMS/in-app templates. Editing content bumps the version.'),
    ('message_template_properties', 'Properties a template is scoped to (junction).'),
    ('message_template_attachments', 'Documents attached to a template (junction).'),
    ('message_template_versions', 'Snapshot of every template version.'),
    ('automation_rules', 'Workflow automation rules: event trigger, template, timing, de-duplication, retry. Activation requires a matching active template.'),
    ('automation_rule_conditions', 'Conditions that must hold for a rule to run.'),
    ('automation_rule_properties', 'Properties a rule is scoped to (junction).'),
    ('communication_logs', 'Delivery history of every message request (rendered content, status, provider response).'),
    ('communication_log_attempts', 'Per-attempt delivery detail.'),
    ('tenant_communication_preferences', 'Channel preferences and consent of a tenant.'),
    ('property_notification_settings', 'Per-property notification overrides (sender, quiet hours).'),
    ('conversations', 'Message threads between staff and tenants/owners/vendors, with category, priority, status and assignment.'),
    ('conversation_participants', 'Participants of a conversation (staff, tenant, vendor or owner).'),
    ('messages', 'Messages and internal notes in a conversation.'),
    ('message_attachments', 'Documents attached to a message (junction).'),
    ('conversation_stars', 'Per-user starred conversations.'),
    ('conversation_events', 'Append-only history of changes to a conversation.'),
    ('announcements', 'Announcements to tenants/owners/staff/vendors with scheduling and acknowledgement.'),
    ('announcement_targets', 'Properties/units an announcement targets.'),
    ('announcement_acknowledgements', 'Who acknowledged an announcement.'),
    ('notifications', 'In-app notifications for staff users.'),
    ('domain_events', 'Transactional outbox of business events consumed by workflow workers.'),
    ('workflow_executions', 'Executions of automation rules; unique (rule, dedupe key) prevents duplicates.'),
    ('scheduled_tasks', 'Time-driven task definitions (interval/daily/weekly/monthly/cron), separate from workflows.'),
    ('scheduled_task_runs', 'Execution history of scheduled tasks; unique (task, scheduled_for) prevents duplicate execution.')
  ) as v (tbl, descr) loop
    execute format('comment on table public.%I is %L', r.tbl, r.descr);
  end loop;
end $$;

comment on function public.create_organization(text, text, text, text, text) is
  'Onboarding RPC (SECURITY DEFINER, authenticated only): creates an organization, makes the caller its owner, seeds the starter chart of accounts.';
comment on function public.accept_invitation(uuid) is
  'RPC (SECURITY DEFINER, authenticated only): the invitee accepts an invitation addressed to the email in their JWT.';
comment on function public.record_activity(uuid, text, text, text, text, text, text, jsonb, text, text, text, text, jsonb, uuid, uuid, uuid, text, jsonb) is
  'RPC (SECURITY DEFINER, authenticated only): append a user action to the audit trail; the actor is always auth.uid().';
comment on function public.issue_invoice(uuid) is 'SECURITY INVOKER: validates an invoice, opens it and posts the ledger entry when system accounts exist.';
comment on function public.record_payment(uuid, uuid, uuid, date, numeric, text, text, text, uuid, jsonb, boolean, text) is
  'SECURITY INVOKER: records a payment, allocates it, keeps the remainder as credit and posts the ledger entry in one transaction.';
comment on function public.generate_rent_invoices(uuid, date, boolean) is 'SECURITY INVOKER: idempotent monthly rent invoicing for all active monthly leases.';
comment on function public.claim_due_scheduled_tasks(text, integer, integer) is 'service_role only: claims due scheduled tasks with FOR UPDATE SKIP LOCKED.';
comment on function public.record_audit_export(uuid, text, jsonb, integer) is 'RPC (SECURITY DEFINER): records an audit-trail export (event + audit_exports row); needs view_audit_log and export_data.';
comment on function public.verify_activity_chain(uuid) is 'Re-computes the audit hash chain of an organization and reports the first broken event.';

commit;
