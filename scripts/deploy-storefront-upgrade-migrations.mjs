import fs from "node:fs";

const projectRef = process.env.SUPABASE_PROJECT_ID?.trim();
const accessToken = process.env.SUPABASE_ACCESS_TOKEN?.trim();

if (!projectRef || !accessToken) {
  console.error("Storefront upgrade deployment is missing required CI configuration.");
  process.exit(2);
}

const apiBase = `https://api.supabase.com/v1/projects/${encodeURIComponent(projectRef)}`;
const headers = {
  authorization: `Bearer ${accessToken}`,
  accept: "application/json",
  "content-type": "application/json",
};

const migrations = [
  [
    "storefront_personalization",
    "supabase/migrations/20260904213000_storefront_personalization.sql",
  ],
  ["catalog_commercial_type", "supabase/migrations/20260904213500_catalog_commercial_type.sql"],
  [
    "affiliate_self_service_links",
    "supabase/migrations/20260905004500_affiliate_self_service_links.sql",
  ],
  ["require_phone_on_signup", "supabase/migrations/20260907124500_require_phone_on_signup.sql"],
];

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
  if (!response.ok) throw new Error(`READ_ONLY_QUERY_HTTP_${response.status}`);
  const payload = await response.json();
  return Array.isArray(payload) ? payload[0] : payload;
}

async function applyMigration(name, file) {
  console.log(`Applying ${name}...`);
  const response = await fetch(`${apiBase}/database/migrations`, {
    method: "POST",
    headers,
    body: JSON.stringify({ name, query: migrationSql(file) }),
    signal: AbortSignal.timeout(120_000),
  });
  const text = await response.text();
  if (!response.ok) {
    console.error(`Migration ${name} failed with HTTP ${response.status}.`);
    if (text) console.error(text.slice(0, 3000));
    process.exit(10);
  }
  console.log(`Applied ${name}.`);
}

const history = await readHistory();
const appliedNames = new Set(
  history.map((item) => (typeof item?.name === "string" ? item.name : "")).filter(Boolean),
);

for (const [name, file] of migrations) {
  if (appliedNames.has(name)) {
    console.log(`Already applied: ${name}.`);
    continue;
  }
  await applyMigration(name, file);
  appliedNames.add(name);
}

const verification = await readOnly(`
select
  pg_catalog.to_regclass('public.site_asset_uploads') is not null as site_asset_uploads_table,
  pg_catalog.to_regclass('public.site_personalization_assets') is not null as personalization_table,
  exists (
    select 1 from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'get_storefront_personalization'
  ) as personalization_rpc,
  exists (
    select 1 from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'catalog_products_page'
  ) as catalog_rpc,
  exists (
    select 1 from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'activate_my_affiliate'
  ) as affiliate_activate_rpc,
  exists (
    select 1 from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'deactivate_my_affiliate'
  ) as affiliate_deactivate_rpc,
  exists (
    select 1 from pg_catalog.pg_trigger t
    join pg_catalog.pg_class c on c.oid = t.tgrelid
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'auth'
      and c.relname = 'users'
      and t.tgname = 'require_phone_on_signup'
      and not t.tgisinternal
  ) as signup_phone_trigger;
`);

console.log("STOREFRONT_UPGRADE_BACKEND_VERIFICATION");
console.log(JSON.stringify(verification, null, 2));

const required = [
  "site_asset_uploads_table",
  "personalization_table",
  "personalization_rpc",
  "catalog_rpc",
  "affiliate_activate_rpc",
  "affiliate_deactivate_rpc",
  "signup_phone_trigger",
];

if (!required.every((key) => verification?.[key] === true)) {
  console.error("Storefront upgrade backend verification failed.");
  process.exit(11);
}

console.log("Storefront upgrade backend is live.");
