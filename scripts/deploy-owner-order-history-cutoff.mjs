import fs from "node:fs";

const projectRef = process.env.SUPABASE_PROJECT_ID?.trim();
const accessToken = process.env.SUPABASE_ACCESS_TOKEN?.trim();

if (!projectRef || !accessToken) {
  console.error("Owner order-history deployment is missing required CI configuration.");
  process.exit(2);
}

const apiBase = `https://api.supabase.com/v1/projects/${encodeURIComponent(projectRef)}`;
const headers = {
  authorization: `Bearer ${accessToken}`,
  accept: "application/json",
  "content-type": "application/json",
};

const migrationName = "hide_existing_owner_order_history_20260910";
const migrationFile = "supabase/migrations/20260910143538_hide_existing_owner_order_history.sql";
const cutoff = "2026-09-10T14:35:38Z";

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

const history = await readHistory();
const alreadyApplied = history.some((item) => item?.name === migrationName);

if (!alreadyApplied) {
  const response = await fetch(`${apiBase}/database/migrations`, {
    method: "POST",
    headers,
    body: JSON.stringify({ name: migrationName, query: migrationSql() }),
    signal: AbortSignal.timeout(120_000),
  });
  const text = await response.text();
  if (!response.ok) {
    console.error(`Migration failed with HTTP ${response.status}.`);
    if (text) console.error(text.slice(0, 3000));
    process.exit(10);
  }
  console.log(`Applied ${migrationName}.`);
} else {
  console.log(`Already applied: ${migrationName}.`);
}

const verification = await readOnly(`
select
  pg_get_functiondef('public.admin_list_orders(text,text,text,integer,integer)'::regprocedure)
    like '%${cutoff}%' as cutoff_live,
  (select count(*) from public.orders where created_at < '${cutoff}'::timestamptz) as hidden_existing_orders,
  (select count(*) from public.orders where created_at >= '${cutoff}'::timestamptz) as visible_orders_since_cutoff;
`);

console.log("OWNER_ORDER_HISTORY_CUTOFF_VERIFICATION");
console.log(JSON.stringify(verification, null, 2));

if (verification?.cutoff_live !== true) {
  console.error("Owner order-history cutoff verification failed.");
  process.exit(11);
}

console.log("Existing owner order history is hidden; future orders remain visible.");
