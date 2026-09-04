import fs from "node:fs";
import path from "node:path";

const projectRef = process.env.SUPABASE_PROJECT_ID?.trim();
const accessToken = process.env.SUPABASE_ACCESS_TOKEN?.trim();

if (!projectRef || !accessToken) {
  console.error("Supabase migration inspection is missing required CI configuration.");
  process.exit(2);
}

const migrationsDir = path.resolve("supabase/migrations");
const local = fs
  .readdirSync(migrationsDir, { withFileTypes: true })
  .filter((entry) => entry.isFile() && /^\d{14}_.+\.sql$/.test(entry.name))
  .map((entry) => ({
    version: entry.name.slice(0, 14),
    name: entry.name.slice(15, -4),
    file: entry.name,
  }))
  .sort((a, b) => a.version.localeCompare(b.version));

const managementHeaders = {
  authorization: `Bearer ${accessToken}`,
  accept: "application/json",
  "content-type": "application/json",
};

const response = await fetch(
  `https://api.supabase.com/v1/projects/${encodeURIComponent(projectRef)}/database/migrations`,
  {
    headers: managementHeaders,
    signal: AbortSignal.timeout(20_000),
  },
);

if (!response.ok) {
  console.error(`Supabase migration history request failed with HTTP ${response.status}.`);
  process.exit(3);
}

const payload = await response.json();
if (!Array.isArray(payload)) {
  console.error("Supabase migration history returned an unexpected response.");
  process.exit(4);
}

const remote = payload
  .map((item) => ({
    version: typeof item?.version === "string" ? item.version : "",
    name: typeof item?.name === "string" ? item.name : "",
  }))
  .filter((item) => /^\d{14}$/.test(item.version))
  .sort((a, b) => a.version.localeCompare(b.version));

const localVersions = new Set(local.map((item) => item.version));
const remoteVersions = new Set(remote.map((item) => item.version));
const pending = local.filter((item) => !remoteVersions.has(item.version));
const remoteOnly = remote.filter((item) => !localVersions.has(item.version));

console.log(`Local migrations: ${local.length}`);
console.log(`Remote recorded migrations: ${remote.length}`);
console.log(`Local not recorded remotely: ${pending.length}`);
console.log(`Remote not present locally: ${remoteOnly.length}`);

if (pending.length > 0) {
  console.log("\nLOCAL_NOT_REMOTE");
  for (const item of pending) console.log(`${item.version} ${item.name}`);
}

if (remoteOnly.length > 0) {
  console.log("\nREMOTE_NOT_LOCAL");
  for (const item of remoteOnly) console.log(`${item.version} ${item.name || "(unnamed)"}`);
}

const affiliateVersions = new Set([
  "20260904041000",
  "20260904042500",
  "20260904044000",
]);
const affiliatePending = pending.filter((item) => affiliateVersions.has(item.version));
console.log(`\nAffiliate migrations pending remotely: ${affiliatePending.length}`);
for (const item of affiliatePending) console.log(`${item.version} ${item.name}`);

const readinessQuery = `
select
  pg_catalog.to_regclass('public.profiles') is not null as profiles_table,
  pg_catalog.to_regclass('public.user_roles') is not null as user_roles_table,
  pg_catalog.to_regclass('public.orders') is not null as orders_table,
  pg_catalog.to_regclass('public.notification_events') is not null as notification_events_table,
  (
    select count(*) = 8
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'orders'
      and column_name in (
        'user_id', 'payment_status', 'status', 'subtotal_amount',
        'discount_amount', 'total_amount', 'paid_at', 'public_number'
      )
  ) as orders_required_columns,
  exists (
    select 1
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'has_role'
  ) as has_role_function,
  exists (
    select 1
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'is_valid_brazilian_phone'
  ) as phone_validator_function,
  exists (
    select 1
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'is_valid_brazilian_cpf'
  ) as cpf_validator_function,
  exists (
    select 1
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'claim_notification_events'
  ) as notification_claim_function,
  pg_catalog.to_regclass('public.affiliate_program_settings') is not null as affiliate_settings_live,
  pg_catalog.to_regclass('public.affiliates') is not null as affiliates_live,
  pg_catalog.to_regclass('public.affiliate_referrals') is not null as affiliate_referrals_live,
  pg_catalog.to_regclass('public.affiliate_commissions') is not null as affiliate_commissions_live,
  pg_catalog.to_regclass('public.affiliate_withdrawals') is not null as affiliate_withdrawals_live;
`;

const readinessResponse = await fetch(
  `https://api.supabase.com/v1/projects/${encodeURIComponent(projectRef)}/database/query/read-only`,
  {
    method: "POST",
    headers: managementHeaders,
    body: JSON.stringify({ query: readinessQuery }),
    signal: AbortSignal.timeout(20_000),
  },
);

if (!readinessResponse.ok) {
  console.error(`Supabase live schema readiness request failed with HTTP ${readinessResponse.status}.`);
  process.exit(5);
}

const readinessPayload = await readinessResponse.json();
const readiness = Array.isArray(readinessPayload)
  ? readinessPayload[0]
  : readinessPayload;

console.log("\nAFFILIATE_LIVE_READINESS");
console.log(JSON.stringify(readiness, null, 2));

const dependencyKeys = [
  "profiles_table",
  "user_roles_table",
  "orders_table",
  "notification_events_table",
  "orders_required_columns",
  "has_role_function",
  "phone_validator_function",
  "cpf_validator_function",
  "notification_claim_function",
];
const dependenciesReady = dependencyKeys.every((key) => readiness?.[key] === true);
console.log(`Affiliate migration dependencies ready: ${dependenciesReady}`);

// Inspection is intentionally read-only. Drift is reported instead of repaired.
