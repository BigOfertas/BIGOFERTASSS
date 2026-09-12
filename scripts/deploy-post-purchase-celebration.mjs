import fs from "node:fs";

const projectRef = process.env.SUPABASE_PROJECT_ID?.trim();
const accessToken = process.env.SUPABASE_ACCESS_TOKEN?.trim();

if (!projectRef || !accessToken) {
  console.error("Post-purchase celebration deployment is missing required CI configuration.");
  process.exit(2);
}

const apiBase = `https://api.supabase.com/v1/projects/${encodeURIComponent(projectRef)}`;
const headers = {
  authorization: `Bearer ${accessToken}`,
  accept: "application/json",
  "content-type": "application/json",
};
const migrationName = "post_purchase_celebration_20260912";
const migrationFile = "supabase/migrations/20260912170000_post_purchase_celebration.sql";

function migrationSql() {
  return fs
    .readFileSync(migrationFile, "utf8")
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
  if (!response.ok) throw new Error(`READ_ONLY_QUERY_HTTP_${response.status}`);
  const payload = await response.json();
  return Array.isArray(payload) ? payload[0] : payload;
}

async function applyMigration() {
  const response = await fetch(`${apiBase}/database/migrations`, {
    method: "POST",
    headers,
    body: JSON.stringify({ name: migrationName, query: migrationSql() }),
    signal: AbortSignal.timeout(120_000),
  });
  const text = await response.text();
  if (!response.ok) {
    console.error(`Post-purchase celebration migration failed with HTTP ${response.status}.`);
    if (text) console.error(text.slice(0, 2000));
    process.exit(10);
  }
  console.log("Post-purchase celebration migration applied.");
}

const history = await readHistory();
if (history.some((item) => item?.name === migrationName)) {
  console.log("Post-purchase celebration migration already applied.");
} else {
  await applyMigration();
}

const verification = await readOnly(`
select
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'orders'
      and column_name = 'post_purchase_seen_at'
  ) as column_ready,
  to_regprocedure('public.claim_my_order_celebration(text)') is not null as function_ready,
  has_function_privilege('anon', 'public.claim_my_order_celebration(text)', 'execute') as anon_can_execute,
  has_function_privilege('authenticated', 'public.claim_my_order_celebration(text)', 'execute') as authenticated_can_execute,
  has_function_privilege('service_role', 'public.claim_my_order_celebration(text)', 'execute') as service_role_can_execute;
`);

console.log("POST_PURCHASE_CELEBRATION_VERIFICATION");
console.log(JSON.stringify(verification, null, 2));

if (
  verification?.column_ready !== true ||
  verification?.function_ready !== true ||
  verification?.anon_can_execute !== false ||
  verification?.authenticated_can_execute !== true ||
  verification?.service_role_can_execute !== true
) {
  console.error("Post-purchase celebration verification failed.");
  process.exit(11);
}

console.log("One-time post-purchase celebration state is ready.");
