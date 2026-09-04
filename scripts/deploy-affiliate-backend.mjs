import fs from "node:fs";

const projectRef = process.env.SUPABASE_PROJECT_ID?.trim();
const accessToken = process.env.SUPABASE_ACCESS_TOKEN?.trim();

if (!projectRef || !accessToken) {
  console.error("Affiliate backend deployment is missing required CI configuration.");
  process.exit(2);
}

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

async function readOnly(query) {
  const response = await fetch(`${apiBase}/database/query/read-only`, {
    method: "POST",
    headers,
    body: JSON.stringify({ query }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    throw new Error(`READ_ONLY_QUERY_HTTP_${response.status}`);
  }
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
    if (text) console.error(text.slice(0, 2000));
    process.exit(10);
  }
  console.log(`Applied ${name}.`);
}

const before = await readOnly(`
select
  pg_catalog.to_regclass('public.affiliate_program_settings') is not null as core_live,
  exists (
    select 1
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'owner_get_affiliate_overview'
  ) as admin_queries_live;
`);

console.log(`Core already live: ${before?.core_live === true}`);
console.log(`Admin queries already live: ${before?.admin_queries_live === true}`);

if (before?.core_live !== true) {
  await applyMigration(
    "affiliate_referral_backend",
    "supabase/migrations/20260904041000_affiliate_referral_backend.sql",
  );
}

// This migration is idempotent (REVOKE/GRANT/COMMENT only), so applying it
// after the core is safe even if a previous deployment stopped midway.
await applyMigration(
  "affiliate_backend_hardening",
  "supabase/migrations/20260904042500_affiliate_backend_hardening.sql",
);

const afterHardening = await readOnly(`
select exists (
  select 1
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'owner_get_affiliate_overview'
) as admin_queries_live;
`);

if (afterHardening?.admin_queries_live !== true) {
  await applyMigration(
    "affiliate_admin_queries",
    "supabase/migrations/20260904044000_affiliate_admin_queries.sql",
  );
}

const verification = await readOnly(`
select
  pg_catalog.to_regclass('public.affiliate_program_settings') is not null as settings_table,
  pg_catalog.to_regclass('public.affiliates') is not null as affiliates_table,
  pg_catalog.to_regclass('public.affiliate_referrals') is not null as referrals_table,
  pg_catalog.to_regclass('public.affiliate_commissions') is not null as commissions_table,
  pg_catalog.to_regclass('public.affiliate_withdrawals') is not null as withdrawals_table,
  exists (
    select 1 from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'get_my_affiliate_dashboard'
  ) as customer_dashboard_rpc,
  exists (
    select 1 from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'owner_get_affiliate_overview'
  ) as owner_overview_rpc,
  exists (
    select 1 from public.affiliate_program_settings s
    where s.singleton = true and s.enabled = false
  ) as program_starts_disabled;
`);

console.log("AFFILIATE_BACKEND_LIVE_VERIFICATION");
console.log(JSON.stringify(verification, null, 2));

const required = [
  "settings_table",
  "affiliates_table",
  "referrals_table",
  "commissions_table",
  "withdrawals_table",
  "customer_dashboard_rpc",
  "owner_overview_rpc",
  "program_starts_disabled",
];

if (!required.every((key) => verification?.[key] === true)) {
  console.error("Affiliate backend verification failed.");
  process.exit(11);
}

const historyResponse = await fetch(`${apiBase}/database/migrations`, {
  headers,
  signal: AbortSignal.timeout(20_000),
});
if (!historyResponse.ok) {
  throw new Error(`MIGRATION_HISTORY_HTTP_${historyResponse.status}`);
}
const history = await historyResponse.json();
if (Array.isArray(history)) {
  console.log("AFFILIATE_REMOTE_MIGRATION_RECORDS");
  for (const item of history) {
    if (typeof item?.name === "string" && item.name.startsWith("affiliate_")) {
      console.log(`${item.version ?? "?"} ${item.name}`);
    }
  }
}
