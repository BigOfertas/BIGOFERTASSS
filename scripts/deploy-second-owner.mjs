import fs from "node:fs";

const projectRef = process.env.SUPABASE_PROJECT_ID?.trim();
const accessToken = process.env.SUPABASE_ACCESS_TOKEN?.trim();

if (!projectRef || !accessToken) {
  console.error("Second owner deployment is missing required CI configuration.");
  process.exit(2);
}

const apiBase = `https://api.supabase.com/v1/projects/${encodeURIComponent(projectRef)}`;
const headers = {
  authorization: `Bearer ${accessToken}`,
  accept: "application/json",
  "content-type": "application/json",
};

const migrationName = "add_second_owner_20260911";
const migrationFile = "supabase/migrations/20260911183000_add_second_owner.sql";

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
    console.error(`Second owner migration failed with HTTP ${response.status}.`);
    if (text) console.error(text.slice(0, 2000));
    process.exit(10);
  }
  console.log("Second owner migration applied.");
}

const history = await readHistory();
const alreadyApplied = history.some((item) => item?.name === migrationName);
if (alreadyApplied) {
  console.log("Second owner migration already applied.");
} else {
  await applyMigration();
}

const verification = await readOnly(`
select
  exists (
    select 1
    from auth.users u
    join public.user_roles r on r.user_id = u.id
    where lower(u.email) = lower('lo2341097@gmail.com')
      and r.role = 'owner'::public.app_role
  ) as second_owner_active,
  (
    select count(*)::integer
    from public.user_roles
    where role = 'owner'::public.app_role
  ) as owner_count;
`);

console.log("SECOND_OWNER_VERIFICATION");
console.log(JSON.stringify(verification, null, 2));

if (verification?.second_owner_active !== true || Number(verification?.owner_count ?? 0) < 2) {
  console.error("Second owner verification failed.");
  process.exit(11);
}

console.log("Second owner is live.");
