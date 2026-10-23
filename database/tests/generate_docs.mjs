// Generates database/data_dictionary.md and database/entity_relationships.md from the LIVE schema (migrations applied to an in-process
// PostgreSQL), so the documentation cannot drift from the SQL.   Usage (same setup as run_local_tests.mjs):
//   cd database/tests && npm install @electric-sql/pglite && node generate_docs.mjs
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";

const here = process.env.DATABASE_TESTS_DIR ?? path.dirname(fileURLToPath(import.meta.url));
const out = process.env.DATABASE_DOCS_OUT ?? path.join(here, "..");
const db = new PGlite({ extensions: { btree_gist } });
await db.exec(readFileSync(path.join(here, "supabase_stubs.sql"), "utf8"));
for (const f of readdirSync(path.join(here, "../migrations")).filter((x) => x.endsWith(".sql")).sort()) await db.exec(readFileSync(path.join(here, "../migrations", f), "utf8"));

const DOMAINS = [
  ["Identity, organizations and security", "profiles user_preferences organizations organization_members organization_invitations permissions role_permissions organization_role_permissions organization_settings organization_counters activity_events activity_event_details audit_policies audit_exports"],
  ["Portfolio: owners, properties, units, vendors", "owners management_companies properties property_owners units vendors vendor_private_details vendor_workers property_preferred_vendors"],
  ["Tenancy: tenants, applications, leases", "tenants tenant_private_details tenant_contacts tenant_id_documents applications application_parties application_reviews application_status_history application_communications leases lease_additional_charges lease_units lease_parties lease_party_units lease_renewals lease_renewal_documents"],
  ["Documents and e-signatures", "documents document_versions document_links signature_requests signers signature_fields signature_events"],
  ["Accounting: chart, journal, banks", "accounts expense_categories catalog_items bank_accounts journal_entries journal_entry_lines"],
  ["Receivables: invoices, payments, credits", "invoices invoice_lines invoice_notes payments payment_allocations payment_refunds credit_notes credit_note_lines credit_note_applications"],
  ["Payables: expenses and bills", "expenses expense_allocations bill_schedules bill_schedule_tenants bill_schedule_runs bills bill_units bill_tenant_allocations bill_payments bill_tenant_recoveries"],
  ["Bank reconciliation", "bank_import_mappings reconciliations bank_import_batches bank_transactions book_transactions book_transaction_invoices reconciliation_matches reconciliation_match_bank_lines reconciliation_match_book_lines reconciliation_adjustments"],
  ["Security deposits", "deposit_rules deposit_interest_rates deposits deposit_refunds deposit_transactions deposit_key_devices deposit_reconciliation_items"],
  ["Maintenance", "assets maintenance_requests maintenance_request_completions maintenance_work_orders maintenance_estimates maintenance_visits maintenance_work_logs maintenance_schedules maintenance_schedule_checklist_items"],
  ["Projects", "projects project_tenant_notifications project_team_members project_tasks project_task_dependencies project_invoices project_invoice_lines project_purchase_orders project_expenses project_payments project_payment_allocations project_change_orders project_quotes project_milestones project_inspections project_deficiencies"],
  ["Communication, automation and scheduling", "message_templates message_template_properties message_template_attachments message_template_versions automation_rules automation_rule_conditions automation_rule_properties communication_logs communication_log_attempts tenant_communication_preferences property_notification_settings conversations conversation_participants messages message_attachments conversation_stars conversation_events announcements announcement_targets announcement_acknowledgements notifications domain_events workflow_executions scheduled_tasks scheduled_task_runs"],
].map(([title, list]) => [title, list.split(" ")]);

const q = async (sql) => (await db.query(sql)).rows;
const tables = new Map((await q(`select c.relname as name, obj_description(c.oid, 'pg_class') as comment, c.oid from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' order by 1`)).map((r) => [r.name, r]));
const listed = new Set(DOMAINS.flatMap(([, t]) => t));
const missing = [...tables.keys()].filter((t) => !listed.has(t));
if (missing.length) throw new Error("tables missing from the DOMAINS map: " + missing.join(", "));

const cols = await q(`select c.relname as tbl, a.attname as col, format_type(a.atttypid, a.atttypmod) as type, not a.attnotnull as nullable, pg_get_expr(d.adbin, d.adrelid) as def, a.attgenerated <> '' as generated, a.attnum
  from pg_attribute a join pg_class c on c.oid = a.attrelid join pg_namespace n on n.oid = c.relnamespace left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
 where n.nspname = 'public' and c.relkind = 'r' and a.attnum > 0 and not a.attisdropped order by c.relname, a.attnum`);
const cons = await q(`select c.relname as tbl, k.conname, k.contype, pg_get_constraintdef(k.oid) as def, r.relname as ref,
    (select array_agg(a.attname order by u.ord) from unnest(k.conkey) with ordinality u(attnum, ord) join pg_attribute a on a.attrelid = k.conrelid and a.attnum = u.attnum) as cols
  from pg_constraint k join pg_class c on c.oid = k.conrelid join pg_namespace n on n.oid = c.relnamespace left join pg_class r on r.oid = k.confrelid
 where n.nspname = 'public' order by c.relname, k.contype, k.conname`);
const idx = await q(`select tablename as tbl, indexname, indexdef from pg_indexes where schemaname = 'public' order by tablename, indexname`);
const pol = await q(`select tablename as tbl, policyname, cmd, roles, qual, with_check from pg_policies where schemaname = 'public' order by tablename, cmd, policyname`);
const trg = await q(`select c.relname as tbl, t.tgname, pg_get_triggerdef(t.oid) as def from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace where not t.tgisinternal and n.nspname = 'public' order by 1, 2`);
const views = await q(`select c.relname as name, obj_description(c.oid, 'pg_class') as comment from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'v' order by 1`);
const funcs = await q(`select p.oid::regprocedure::text as sig, p.proname, n.nspname as schema, p.prosecdef, obj_description(p.oid, 'pg_proc') as comment,
    array(select r.rolname from pg_roles r where r.rolname in ('anon', 'authenticated', 'service_role') and has_function_privilege(r.oid, p.oid, 'execute') order by 1) as exec_roles
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('public', 'private') and p.prokind in ('f', 'p') order by n.nspname, p.proname`);

const perms = (text) => [...new Set([...(text ?? "").matchAll(/has_permission\([^,]+,\s*'([a-z_]+)'/g)].map((m) => m[1]))];
const md = (s) => String(s ?? "").replaceAll("|", "\\|").replaceAll("\n", " ");

// ------------------------------------------------------------------ data dictionary
let d = `# Data dictionary

> Generated by \`database/tests/generate_docs.mjs\` from the live schema (migrations 001-011 applied to PostgreSQL). Do not edit by hand; change the migrations and regenerate.

${tables.size} tables, ${views.length} views, ${funcs.filter((f) => f.schema === "public").length} public functions. Money columns are \`numeric(14,2)\` in the record's currency. Every organization-owned table has \`organization_id\` and a composite \`(organization_id, id)\` key that child tables reference, so rows can never point across organizations.

**How to read the access column:** *read* / *write* name the permission keys that the RLS policies require (see \`permissions\` in \`002\`/\`009\`; the owner role always passes). "member" means any active member of the organization.

`;
for (const [title, list] of DOMAINS) {
  d += `\n## ${title}\n`;
  for (const t of list) {
    const info = tables.get(t);
    d += `\n### \`${t}\`\n\n${info.comment ?? ""}\n\n`;
    const pk = cons.find((c) => c.tbl === t && c.contype === "p")?.cols ?? [];
    const fk = new Map(cons.filter((c) => c.tbl === t && c.contype === "f").flatMap((c) => c.cols.filter((x) => x !== "organization_id" || c.cols.length === 1).map((col) => [col, `${c.ref}`])));
    d += "| Column | Type | Null | Default | Notes |\n|---|---|---|---|---|\n";
    for (const c of cols.filter((x) => x.tbl === t)) {
      const notes = [pk.includes(c.col) ? "PK" : "", fk.has(c.col) ? `FK → ${fk.get(c.col)}` : "", c.generated ? "generated" : ""].filter(Boolean).join(", ");
      d += `| \`${c.col}\` | ${md(c.type)} | ${c.nullable ? "yes" : "no"} | ${c.def ? "`" + md(c.def).slice(0, 60) + "`" : ""} | ${notes} |\n`;
    }
    const uniques = cons.filter((c) => c.tbl === t && c.contype === "u").map((c) => `(${c.cols.join(", ")})`);
    const checks = cons.filter((c) => c.tbl === t && c.contype === "c").length;
    const excl = cons.filter((c) => c.tbl === t && c.contype === "x").map((c) => c.conname);
    d += `\n- **Unique:** ${uniques.length ? uniques.join("; ") : "—"}${excl.length ? `  \n- **Exclusion:** ${excl.join(", ")}` : ""}  \n- **Checks:** ${checks}  \n- **Indexes:** ${idx.filter((i) => i.tbl === t).length}`;
    const rules = pol.filter((p) => p.tbl === t);
    const bycmd = (cmd) => [...new Set(rules.filter((p) => p.cmd === cmd || p.cmd === "ALL").flatMap((p) => perms((p.qual ?? "") + (p.with_check ?? ""))))];
    const describe = (cmd) => { const has = rules.some((p) => p.cmd === cmd || p.cmd === "ALL"); if (!has) return "no policy (denied)"; const ps = bycmd(cmd); return ps.length ? ps.join(" / ") : "member / own rows"; };
    d += `  \n- **Access (RLS):** read: ${describe("SELECT")}; insert: ${describe("INSERT")}; update: ${describe("UPDATE")}; delete: ${describe("DELETE")}\n`;
    const triggers = trg.filter((x) => x.tbl === t).map((x) => x.tgname);
    if (triggers.length) d += `- **Triggers:** ${triggers.join(", ")}\n`;
  }
}
d += `\n## Views\n\nAll views are \`security_invoker\`: they run with the caller's rights, so RLS of every underlying table applies.\n\n| View | Purpose |\n|---|---|\n`;
const viewPurpose = {
  v_invoice_balances: "Per-invoice total, paid (payments + credits), outstanding and derived status (paid / partially_paid / overdue / unpaid).",
  v_outstanding_invoices: "Open invoices with an outstanding balance.", v_payment_summary: "Per payment: allocated, refunded and unapplied amounts.",
  v_credit_balances: "Per credit note: applied, remaining, validity (source payment not reversed) and derived status.", v_tenant_balances: "Per tenant: outstanding, overdue and available credit.",
  v_bill_balances: "Per bill: paid, remaining, recovered and derived payment/recovery status.", v_leases_current: "Active/pending leases with units, main tenant and expiring flag (60 days).",
  v_lease_expirations: "Active leases ending within 90 days.", v_current_occupancy: "Who occupies which unit today (active lease, current party and occupancy dates).",
  v_tenant_occupancy_history: "Every unit a tenant has been attached to through leases.", v_unit_status: "Units with current lease and tenant names.",
  v_trial_balance: "Debit/credit totals per posting account from posted (and reversed) entries.", v_property_financials: "Monthly revenue, expenses and net income per property.",
  v_organization_financials: "Monthly revenue, expenses and net income for the whole organization.", v_maintenance_dashboard: "Open, emergency, overdue and recently completed requests per property.",
  v_project_progress: "Budget (with approved change orders), spend, invoiced, paid and task progress per project.", v_document_expirations: "Documents expiring within 90 days.",
};
for (const v of views) d += `| \`${v.name}\` | ${viewPurpose[v.name] ?? ""} |\n`;
d += `\n## Functions\n\n| Function | Schema | Rights | Executable by | Notes |\n|---|---|---|---|---|\n`;
for (const f of funcs) if (!/^(set_updated_at|assign_number|activity_events_|guard_member_change|audit_member_change|journal_|invoice_guard|invoice_line_guard|payment_guard|check_|validate_|allocations_immutable|payment_refunds|reconciliation_frozen|deposit_transactions_immutable|protect_immutable|signature_events_immutable|record_application_status|lease_unit_defaults|sync_lease_occupancy|message_template_|append_only|handle_new_user|handle_user_email|lease_)/.test(f.proname) || f.schema === "public")
  d += `| \`${md(f.sig.replace(/^public\./, ""))}\` | ${f.schema} | ${f.prosecdef ? "SECURITY DEFINER" : "invoker"} | ${f.exec_roles.join(", ") || "—"} | ${md(f.comment ?? "")} |\n`;
d += `\nTrigger functions (set_updated_at, assign_number, guards, validators ...) live in schema \`private\`, are not callable through the API and are documented inside the migrations.\n`;
writeFileSync(path.join(out, "data_dictionary.md"), d);

// ------------------------------------------------------------------ ER diagrams
const fks = cons.filter((c) => c.contype === "f");
let e = `# Entity relationships

> Generated by \`database/tests/generate_docs.mjs\` from the foreign keys of the live schema. Every organization-owned relationship is a composite \`(organization_id, parent_id)\` foreign key; the diagrams show the logical parent → child relationship once per column. Tables shown in a domain diagram without attributes belong to another domain. \`organizations\` and \`profiles\` are referenced by almost every table and are omitted from the edges for readability (every organization-owned table has \`organization_id\`; audit columns such as \`created_by\` point at \`profiles\`).

Legend: \`A ||--o{ B\` = one A has many B. Optional parents (nullable keys) are drawn as \`|o--o{\`.
`;
const colNullable = new Map(cols.map((c) => [`${c.tbl}.${c.col}`, c.nullable]));
for (const [title, list] of DOMAINS) {
  const set = new Set(list);
  const edges = fks.filter((k) => set.has(k.tbl) && !["organizations", "profiles", "permissions"].includes(k.ref));
  e += `\n## ${title}\n\n\`\`\`mermaid\nerDiagram\n`;
  const shown = new Set(list);
  for (const k of edges) shown.add(k.ref);
  for (const t of shown) {
    if (!set.has(t)) { e += `  ${t} {\n    uuid id\n  }\n`; continue; }
    const pkc = cons.find((c) => c.tbl === t && c.contype === "p")?.cols ?? [];
    const fkCols = new Set(edges.filter((k) => k.tbl === t).flatMap((k) => k.cols).filter((c) => c !== "organization_id"));
    e += `  ${t} {\n`;
    for (const c of cols.filter((x) => x.tbl === t && (pkc.includes(x.col) || fkCols.has(x.col) || x.col === "organization_id"))) {
      e += `    ${c.type.replace(/[^a-zA-Z0-9]/g, "_").replace(/_+$/, "")} ${c.col}${pkc.includes(c.col) ? " PK" : fkCols.has(c.col) ? " FK" : ""}\n`;
    }
    e += `  }\n`;
  }
  const seen = new Set();
  for (const k of edges) {
    const keyCol = k.cols.filter((c) => c !== "organization_id").join(",") || "organization_id";
    const id = `${k.ref}>${k.tbl}:${keyCol}`;
    if (seen.has(id)) continue; seen.add(id);
    const optional = k.cols.filter((c) => c !== "organization_id").some((c) => colNullable.get(`${k.tbl}.${c}`));
    e += `  ${k.ref} ${optional ? "|o" : "||"}--o{ ${k.tbl} : "${keyCol}"\n`;
  }
  e += "```\n";
}
const crossRefs = fks.filter((k) => ["organizations", "profiles"].includes(k.ref));
e += `\n## Cross-cutting references\n\n- ${new Set(crossRefs.filter((k) => k.ref === "organizations").map((k) => k.tbl)).size} tables reference \`organizations\` (tenant boundary).\n- ${new Set(crossRefs.filter((k) => k.ref === "profiles").map((k) => k.tbl + "." + k.cols.join(","))).size} columns reference \`profiles\` (actors, assignees, uploaders).\n- \`auth.users\` is referenced only by \`profiles.id\`.\n`;
writeFileSync(path.join(out, "entity_relationships.md"), e);
console.log(`wrote data_dictionary.md (${d.length} chars) and entity_relationships.md (${e.length} chars)`);
process.exit(0);
