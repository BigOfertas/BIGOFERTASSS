import fs from "node:fs";

const projectRef = process.env.SUPABASE_PROJECT_ID?.trim();
const accessToken = process.env.SUPABASE_ACCESS_TOKEN?.trim();
const migrationName = "home_launches_top10_20260909";
const migrationFile = "supabase/migrations/20260909233000_home_launches_top10.sql";

if (!projectRef || !accessToken) {
  console.error("Home launches deployment is missing required CI configuration.");
  process.exit(2);
}

const apiBase = `https://api.supabase.com/v1/projects/${encodeURIComponent(projectRef)}`;
const headers = {
  authorization: `Bearer ${accessToken}`,
  accept: "application/json",
  "content-type": "application/json",
};

function migrationSql() {
  return fs
    .readFileSync(migrationFile, "utf8")
    .replace(/^\s*BEGIN;\s*/i, "")
    .replace(/\s*COMMIT;\s*$/i, "")
    .trim();
}

async function request(path, init = {}) {
  const response = await fetch(`${apiBase}${path}`, {
    ...init,
    headers: { ...headers, ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(120_000),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${path} HTTP ${response.status}: ${text.slice(0, 2500)}`);
  return text ? JSON.parse(text) : null;
}

const history = await request("/database/migrations");
const applied = Array.isArray(history) && history.some((item) => item?.name === migrationName);

if (!applied) {
  console.log(`Applying ${migrationName}...`);
  await request("/database/migrations", {
    method: "POST",
    body: JSON.stringify({ name: migrationName, query: migrationSql() }),
  });
} else {
  console.log(`Already applied: ${migrationName}.`);
}

const verificationPayload = await request("/database/query/read-only", {
  method: "POST",
  body: JSON.stringify({
    query: `
      select
        exists (
          select 1 from information_schema.columns
          where table_schema = 'public'
            and table_name = 'products'
            and column_name = 'launch_position'
        ) as launch_position_column,
        exists (
          select 1 from pg_catalog.pg_proc p
          join pg_catalog.pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public'
            and p.proname = 'storefront_launch_products'
            and p.prosecdef
        ) as launch_rpc_security_definer,
        count(*) filter (where launch_position between 1 and 10)::int as launch_count,
        count(*) filter (
          where launch_position between 1 and 10
            and status = 'active'::public.product_status
        )::int as active_launch_count,
        min(catalog_code) filter (where launch_position between 1 and 10) as first_launch_code,
        max(catalog_code) filter (where launch_position between 1 and 10) as last_launch_code
      from public.products;
    `,
  }),
});

const verification = Array.isArray(verificationPayload)
  ? verificationPayload[0]
  : verificationPayload;
console.log("HOME_LAUNCHES_BACKEND_VERIFICATION");
console.log(JSON.stringify(verification, null, 2));

if (
  verification?.launch_position_column !== true ||
  verification?.launch_rpc_security_definer !== true ||
  verification?.launch_count !== 10 ||
  verification?.active_launch_count !== 10 ||
  verification?.first_launch_code !== "P000001" ||
  verification?.last_launch_code !== "P000010"
) {
  throw new Error("Home launches backend verification failed.");
}

console.log("HOME_LAUNCHES_BACKEND_OK");
