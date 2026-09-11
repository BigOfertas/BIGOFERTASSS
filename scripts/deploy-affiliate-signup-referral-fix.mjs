import fs from "node:fs";

const projectRef = process.env.SUPABASE_PROJECT_ID?.trim();
const accessToken = process.env.SUPABASE_ACCESS_TOKEN?.trim();

if (!projectRef || !accessToken) {
  console.error("Affiliate signup fix deployment is missing required CI configuration.");
  process.exit(2);
}

const migrationName = "fix_affiliate_signup_referral_ambiguity_20260911";
const migrationFile =
  "supabase/migrations/20260911172000_fix_affiliate_signup_referral_ambiguity.sql";
const apiBase = `https://api.supabase.com/v1/projects/${encodeURIComponent(projectRef)}`;
const headers = {
  authorization: `Bearer ${accessToken}`,
  accept: "application/json",
  "content-type": "application/json",
};

function migrationSql(file) {
  return fs
    .readFileSync(file, "utf8")
    .replace(/^\s*BEGIN;\s*/i, "")
    .replace(/\s*COMMIT;\s*$/i, "")
    .trim();
}

async function readHistory() {
  const response = await fetch(`${apiBase}/database/migrations`, {
    headers,
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`MIGRATION_HISTORY_HTTP_${response.status}`);
  const payload = await response.json();
  return Array.isArray(payload) ? payload : [];
}

async function readOnly(query) {
  const response = await fetch(`${apiBase}/database/query/read-only`, {
    method: "POST",
    headers,
    body: JSON.stringify({ query }),
    signal: AbortSignal.timeout(30_000),
  });
  const text = await response.text();
  if (!response.ok)
    throw new Error(`READ_ONLY_QUERY_HTTP_${response.status}: ${text.slice(0, 1000)}`);
  const payload = JSON.parse(text);
  return Array.isArray(payload) ? payload[0] : payload;
}

async function applyMigration() {
  const response = await fetch(`${apiBase}/database/migrations`, {
    method: "POST",
    headers,
    body: JSON.stringify({ name: migrationName, query: migrationSql(migrationFile) }),
    signal: AbortSignal.timeout(120_000),
  });
  const text = await response.text();
  if (!response.ok) {
    console.error(`Migration ${migrationName} failed with HTTP ${response.status}.`);
    if (text) console.error(text.slice(0, 3000));
    process.exit(10);
  }
  console.log(`Applied ${migrationName}.`);
}

const history = await readHistory();
const alreadyApplied = history.some((item) => item?.name === migrationName);
if (alreadyApplied) {
  console.log(`Already applied: ${migrationName}.`);
} else {
  await applyMigration();
}

const verification = await readOnly(`
select
  exists (
    select 1
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'handle_new_user'
      and p.prosecdef
      and position('normalized_referral_code' in pg_catalog.pg_get_functiondef(p.oid)) > 0
      and position('a.referral_code = normalized_referral_code' in pg_catalog.pg_get_functiondef(p.oid)) > 0
  ) as referral_signup_function_fixed,
  exists (
    select 1
    from pg_catalog.pg_trigger t
    join pg_catalog.pg_class c on c.oid = t.tgrelid
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'auth'
      and c.relname = 'users'
      and t.tgname = 'on_auth_user_created'
      and not t.tgisinternal
  ) as signup_trigger_live;
`);

console.log("AFFILIATE_SIGNUP_REFERRAL_FIX_VERIFICATION");
console.log(JSON.stringify(verification, null, 2));

if (
  verification?.referral_signup_function_fixed !== true ||
  verification?.signup_trigger_live !== true
) {
  console.error("Affiliate signup referral fix verification failed.");
  process.exit(11);
}

console.log("Affiliate referral signup fix is live.");
