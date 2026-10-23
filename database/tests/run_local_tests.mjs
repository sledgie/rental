// Applies the platform stubs, every migration (in order) and the SQL tests to an in-process PostgreSQL (PGlite, WebAssembly).
// Development helper only - it needs no Docker and no running database. Real Supabase behaviour (Auth, Storage API, PostgREST)
// must still be confirmed on a local Supabase stack; see ../validation_checklist.md.
//
//   cd database/tests
//   npm install @electric-sql/pglite            (dev-only dependency, not part of the application)
//   node run_local_tests.mjs                    # stubs + migrations + schema / integrity / RLS tests
//   node run_local_tests.mjs rls_validation.sql # run chosen test files (schema_validation.sql must come first once)
//   node run_local_tests.mjs --with-dev-seed    # stubs + migrations + development seed (run twice) + seed smoke test
//
// DATABASE_TESTS_DIR lets the runner live elsewhere (e.g. next to a node_modules that has PGlite) while reading these files.
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";

const here = process.env.DATABASE_TESTS_DIR ?? path.dirname(fileURLToPath(import.meta.url));
const db = new PGlite({ extensions: { btree_gist } });
const read = (p) => readFileSync(path.join(here, p), "utf8");
let failed = 0;

async function run(label, sql) {
  try {
    await db.exec(sql);
    console.log(`  ok    ${label}`);
    return true;
  } catch (error) {
    failed += 1;
    console.log(`  FAIL  ${label}\n        ${String(error.message).split("\n")[0]}${error.position ? ` (position ${error.position})` : ""}`);
    return false;
  }
}

console.log("PostgreSQL:", (await db.query("select version()")).rows[0].version.split(",")[0]);
console.log("\nplatform stubs");
await run("supabase_stubs.sql", read("supabase_stubs.sql"));

console.log("\nmigrations");
for (const file of readdirSync(path.join(here, "../migrations")).filter((f) => f.endsWith(".sql")).sort()) {
  if (!(await run(file, read(`../migrations/${file}`)))) {
    console.log("\nstopping: a migration failed");
    process.exit(1);
  }
}

if (process.argv.includes("--rollback-check")) {
  // Reinstall check: the rollback script must refuse without confirmation, remove everything, and the migrations must apply cleanly again.
  console.log("\nrollback and reinstall");
  const refused = await db.exec(read("../rollback/drop_application_schema.sql")).then(() => false, () => true);
  console.log(`  ${refused ? "ok   " : "FAIL "} rollback refuses to run without confirmation`);
  if (!refused) failed += 1;
  await db.exec("select set_config('app.confirm_drop', 'yes-drop-everything', false)");
  await run("rollback/drop_application_schema.sql", read("../rollback/drop_application_schema.sql"));
  const left = (await db.query("select (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind in ('r','v'))::int as relations, (select count(*) from pg_namespace where nspname = 'private')::int as private_schema, (select count(*) from pg_trigger where tgname like 'on_auth_user%')::int as auth_triggers, (select count(*) from storage.buckets)::int as buckets")).rows[0];
  const clean = left.relations === 0 && left.private_schema === 0 && left.auth_triggers === 0 && left.buckets === 0;
  console.log(`  ${clean ? "ok   " : "FAIL "} nothing left behind ${JSON.stringify(left)}`);
  if (!clean) failed += 1;
  for (const file of readdirSync(path.join(here, "../migrations")).filter((f) => f.endsWith(".sql")).sort()) await run(`reinstall ${file}`, read(`../migrations/${file}`));
  await run("schema_validation.sql after reinstall", read("schema_validation.sql"));
  const res = await db.query("select count(*)::int as total, count(*) filter (where passed)::int as passed from test_results where suite = 'schema'");
  console.log(`\nassertions: ${res.rows[0].passed}/${res.rows[0].total} passed`);
  process.exit(failed || res.rows[0].passed !== res.rows[0].total ? 1 : 0);
}

if (process.argv.includes("--with-dev-seed")) {
  // Seed mode: create one Auth user (what Studio or the sign-up page would do), run the seed twice (it must be repeatable), smoke-check it.
  console.log("\ndevelopment seed");
  await run("schema_validation.sql (helpers)", read("schema_validation.sql"));
  await db.exec("insert into auth.users (id, email) values (gen_random_uuid(), 'seed.owner@example.test'); select set_config('app.seed_owner_email', 'seed.owner@example.test', false);");
  await run("seed/development_seed.sql", read("../seed/development_seed.sql"));
  await run("seed/development_seed.sql (second run is a no-op)", read("../seed/development_seed.sql"));
  await run("dev_seed_smoke.sql", read("dev_seed_smoke.sql"));
  const res = await db.query("select count(*)::int as total, count(*) filter (where passed)::int as passed from test_results where suite = 'seed'");
  console.log(`\nassertions: ${res.rows[0].passed}/${res.rows[0].total} passed`);
  for (const r of (await db.query("select name, detail from test_results where suite = 'seed' and not passed")).rows) console.log(`  FAILED ${r.name} ${r.detail ?? ""}`);
  process.exit(failed || res.rows[0].passed !== res.rows[0].total ? 1 : 0);
}

console.log("\ntests");
const requested = process.argv.slice(2).filter((a) => a.endsWith(".sql"));
for (const file of requested.length ? requested : ["schema_validation.sql", "data_integrity_validation.sql", "rls_validation.sql"]) {
  await run(file, read(file));
}
const total = await db.query("select count(*)::int as total, count(*) filter (where passed)::int as passed from test_results").catch(() => ({ rows: [{ total: 0, passed: 0 }] }));
for (const s of (await db.query("select suite, count(*)::int as total, count(*) filter (where passed)::int as passed from test_results group by suite order by suite")).rows) console.log(`  ${s.suite.padEnd(10)} ${s.passed}/${s.total}`);
console.log(`\nassertions: ${total.rows[0].passed}/${total.rows[0].total} passed`);
const bad = await db.query("select suite, name, detail from test_results where not passed order by id").catch(() => ({ rows: [] }));
for (const r of bad.rows) console.log(`  FAILED [${r.suite}] ${r.name} ${r.detail ?? ""}`);
process.exit(failed || bad.rows.length || total.rows[0].total === 0 ? 1 : 0);
