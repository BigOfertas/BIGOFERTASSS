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

async function readHistory() {
  const response = await fetch(`${apiBase}/database/migrations`, {
    headers,
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    throw new Error(`MIGRATION_HISTORY_HTTP_${response.status}`);
  }
  const payload = await response.json();
  return Array.isArray(payload) ? payload : [];
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

let history = await readHistory();
const appliedNames = new Set(
  history
    .map((item) => (typeof item?.name === "string" ? item.name : ""))
    .filter(Boolean),
);

const before = await readOnly(`
select
  pg_catalog.to_regclass('public.affiliate_program_settings') is not null as core_live,
  exists (
    select 1
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'owner_get_affiliate_overview'
  ) as admin_queries_live,
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'affiliate_program_settings'
      and column_name = 'withdrawal_method'
  ) as readiness_live,
  pg_catalog.to_regclass('public.affiliate_refund_reviews') is not null as refund_reviews_live;
`);

console.log(`Core already live: ${before?.core_live === true}`);
console.log(`Admin queries already live: ${before?.admin_queries_live === true}`);
console.log(`Readiness already live: ${before?.readiness_live === true}`);
console.log(`Refund review queue already live: ${before?.refund_reviews_live === true}`);

if (before?.core_live !== true) {
  if (appliedNames.has("affiliate_referral_backend")) {
    throw new Error("AFFILIATE_CORE_RECORDED_BUT_NOT_LIVE");
  }
  await applyMigration(
    "affiliate_referral_backend",
    "supabase/migrations/20260904041000_affiliate_referral_backend.sql",
  );
  appliedNames.add("affiliate_referral_backend");
}

if (!appliedNames.has("affiliate_backend_hardening")) {
  await applyMigration(
    "affiliate_backend_hardening",
    "supabase/migrations/20260904042500_affiliate_backend_hardening.sql",
  );
  appliedNames.add("affiliate_backend_hardening");
}

const afterCore = await readOnly(`
select exists (
  select 1
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'owner_get_affiliate_overview'
) as admin_queries_live;
`);

if (afterCore?.admin_queries_live !== true) {
  if (appliedNames.has("affiliate_admin_queries")) {
    throw new Error("AFFILIATE_ADMIN_RECORDED_BUT_NOT_LIVE");
  }
  await applyMigration(
    "affiliate_admin_queries",
    "supabase/migrations/20260904044000_affiliate_admin_queries.sql",
  );
  appliedNames.add("affiliate_admin_queries");
}

const readinessState = await readOnly(`
select
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'affiliate_program_settings'
      and column_name = 'withdrawal_method'
  ) as withdrawal_method_live,
  pg_catalog.to_regclass('public.affiliate_refund_reviews') is not null as refund_reviews_live;
`);

if (readinessState?.withdrawal_method_live !== true || readinessState?.refund_reviews_live !== true) {
  if (appliedNames.has("affiliate_program_readiness")) {
    throw new Error("AFFILIATE_READINESS_RECORDED_BUT_NOT_LIVE");
  }
  await applyMigration(
    "affiliate_program_readiness",
    "supabase/migrations/20260904050000_affiliate_program_readiness.sql",
  );
  appliedNames.add("affiliate_program_readiness");
}

if (!appliedNames.has("affiliate_program_readiness_hardening")) {
  await applyMigration(
    "affiliate_program_readiness_hardening",
    "supabase/migrations/20260904050500_affiliate_program_readiness_hardening.sql",
  );
  appliedNames.add("affiliate_program_readiness_hardening");
}

if (!appliedNames.has("affiliate_fixed_commission_tiers")) {
  await applyMigration(
    "affiliate_fixed_commission_tiers",
    "supabase/migrations/20260904051500_affiliate_fixed_commission_tiers.sql",
  );
  appliedNames.add("affiliate_fixed_commission_tiers");
}

if (!appliedNames.has("affiliate_pix_withdrawal_and_defaults")) {
  await applyMigration(
    "affiliate_pix_withdrawal_and_defaults",
    "supabase/migrations/20260904052000_affiliate_pix_withdrawal_and_defaults.sql",
  );
  appliedNames.add("affiliate_pix_withdrawal_and_defaults");
}

const verification = await readOnly(`
select
  pg_catalog.to_regclass('public.affiliate_program_settings') is not null as settings_table,
  pg_catalog.to_regclass('public.affiliates') is not null as affiliates_table,
  pg_catalog.to_regclass('public.affiliate_referrals') is not null as referrals_table,
  pg_catalog.to_regclass('public.affiliate_commissions') is not null as commissions_table,
  pg_catalog.to_regclass('public.affiliate_withdrawals') is not null as withdrawals_table,
  pg_catalog.to_regclass('public.affiliate_refund_reviews') is not null as refund_reviews_table,
  pg_catalog.to_regclass('public.affiliate_commission_tiers') is not null as fixed_tiers_table,
  pg_catalog.to_regclass('public.affiliate_commission_tier_overrides') is not null as fixed_overrides_table,
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'affiliate_program_settings'
      and column_name = 'withdrawal_method'
  ) as withdrawal_method_column,
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
    select 1 from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'owner_list_affiliate_candidates'
  ) as owner_candidates_rpc,
  exists (
    select 1 from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'owner_list_affiliate_referrals'
  ) as owner_referrals_rpc,
  exists (
    select 1 from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'owner_list_affiliate_referred_orders'
  ) as owner_referred_orders_rpc,
  exists (
    select 1 from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'owner_list_affiliate_refund_reviews'
  ) as owner_refund_reviews_rpc,
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'affiliate_commissions' and column_name = 'commission_unit_amount'
  ) as fixed_snapshot_columns,
  (select count(*) = 6 from public.affiliate_commission_tiers) as fixed_tier_count_safe,
  exists (
    select 1 from public.affiliate_program_settings s
    where s.singleton = true
      and s.hold_days = 0
      and s.minimum_withdrawal = 60.00
      and upper(btrim(s.withdrawal_method)) = 'PIX'
  ) as confirmed_business_defaults,
  not exists (
    select 1
    from public.affiliate_program_settings s
    where s.singleton = true
      and s.enabled
      and (s.hold_days is null or s.minimum_withdrawal is null or s.withdrawal_method is null)
  ) as enabled_configuration_safe;
`);

console.log("AFFILIATE_BACKEND_LIVE_VERIFICATION");
console.log(JSON.stringify(verification, null, 2));

const required = [
  "settings_table",
  "affiliates_table",
  "referrals_table",
  "commissions_table",
  "withdrawals_table",
  "refund_reviews_table",
  "fixed_tiers_table",
  "fixed_overrides_table",
  "fixed_snapshot_columns",
  "fixed_tier_count_safe",
  "confirmed_business_defaults",
  "withdrawal_method_column",
  "customer_dashboard_rpc",
  "owner_overview_rpc",
  "owner_candidates_rpc",
  "owner_referrals_rpc",
  "owner_referred_orders_rpc",
  "owner_refund_reviews_rpc",
  "enabled_configuration_safe",
];

if (!required.every((key) => verification?.[key] === true)) {
  console.error("Affiliate backend verification failed.");
  process.exit(11);
}

history = await readHistory();
console.log("AFFILIATE_REMOTE_MIGRATION_RECORDS");
for (const item of history) {
  if (typeof item?.name === "string" && item.name.startsWith("affiliate_")) {
    console.log(`${item.version ?? "?"} ${item.name}`);
  }
}
