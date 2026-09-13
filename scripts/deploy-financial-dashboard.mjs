import fs from "node:fs";

const projectRef = process.env.SUPABASE_PROJECT_ID?.trim();
const accessToken = process.env.SUPABASE_ACCESS_TOKEN?.trim();

if (!projectRef || !accessToken) {
  console.error("Financial dashboard deployment is missing required Supabase CI configuration.");
  process.exit(2);
}

const apiBase = `https://api.supabase.com/v1/projects/${encodeURIComponent(projectRef)}`;
const headers = {
  authorization: `Bearer ${accessToken}`,
  accept: "application/json",
  "content-type": "application/json",
};

const migrations = [
  {
    name: "financial_dashboard_20260913",
    file: "supabase/migrations/20260913174500_financial_dashboard.sql",
  },
  {
    name: "financial_dashboard_security_hardening_20260913",
    file: "supabase/migrations/20260913181500_financial_dashboard_security_hardening.sql",
  },
  {
    name: "fix_financial_dashboard_payment_status_type_20260913",
    file: "supabase/migrations/20260913204500_fix_financial_dashboard_payment_status_type.sql",
  },
  {
    name: "finance_category_bulk_20260913",
    file: "supabase/migrations/20260913210000_finance_category_bulk.sql",
  },
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
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`READ_ONLY_QUERY_HTTP_${response.status}: ${text.slice(0, 1200)}`);
  }
  const payload = await response.json();
  return Array.isArray(payload) ? payload[0] : payload;
}

async function applyMigration(migration) {
  const response = await fetch(`${apiBase}/database/migrations`, {
    method: "POST",
    headers,
    body: JSON.stringify({ name: migration.name, query: migrationSql(migration.file) }),
    signal: AbortSignal.timeout(120_000),
  });
  const text = await response.text();
  if (!response.ok) {
    console.error(
      `Financial dashboard migration ${migration.name} failed with HTTP ${response.status}.`,
    );
    if (text) console.error(text.slice(0, 3000));
    process.exit(10);
  }
  console.log(`Financial dashboard migration ${migration.name} applied.`);
}

const history = await readHistory();
for (const migration of migrations) {
  if (history.some((item) => item?.name === migration.name)) {
    console.log(`Financial dashboard migration ${migration.name} already applied.`);
  } else {
    await applyMigration(migration);
  }
}

const verification = await readOnly(`
select
  to_regclass('public.finance_settings') is not null as finance_settings_ready,
  to_regclass('public.product_financial_settings') is not null as product_finance_ready,
  to_regclass('public.finance_category_settings') is not null as finance_categories_ready,
  to_regclass('public.product_variant_financial_settings') is not null as variant_finance_ready,
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'product_variants' and column_name = 'commercial_type'
  ) as variant_commercial_type_ready,
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'order_items' and column_name = 'financial_snapshot_version'
  ) as snapshot_column_ready,
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'order_items' and column_name = 'line_profit_snapshot'
  ) as profit_column_ready,
  exists (
    select 1 from pg_trigger
    where tgname = 'capture_order_item_financial_snapshot' and not tgisinternal
  ) as capture_trigger_ready,
  exists (
    select 1 from pg_trigger
    where tgname = 'protect_order_item_financial_snapshot' and not tgisinternal
  ) as immutable_trigger_ready,
  to_regprocedure('public.owner_get_financial_dashboard(text,timestamptz,timestamptz)') is not null as dashboard_rpc_ready,
  to_regprocedure('public.owner_get_finance_settings()') is not null as settings_rpc_ready,
  to_regprocedure('public.owner_finance_products_page(text,integer,integer)') is not null as products_rpc_ready,
  to_regprocedure('public.owner_save_product_finance(uuid,numeric)') is not null as save_cost_rpc_ready,
  to_regprocedure('public.owner_finance_category_settings()') is not null as category_settings_rpc_ready,
  to_regprocedure('public.owner_apply_finance_category(text,numeric,numeric)') is not null as category_apply_rpc_ready,
  to_regprocedure('public.owner_finance_variant_targets_page(text,text,integer,integer)') is not null as variant_page_rpc_ready,
  to_regprocedure('public.owner_save_finance_variant(uuid,text,numeric,numeric)') is not null as variant_save_rpc_ready,
  not has_function_privilege('anon', 'public.owner_get_financial_dashboard(text,timestamptz,timestamptz)', 'execute') as anon_dashboard_blocked,
  not has_function_privilege('anon', 'public.owner_get_finance_settings()', 'execute') as anon_settings_blocked,
  not has_function_privilege('anon', 'public.owner_finance_products_page(text,integer,integer)', 'execute') as anon_products_blocked,
  not has_function_privilege('anon', 'public.owner_save_product_finance(uuid,numeric)', 'execute') as anon_save_cost_blocked,
  not has_function_privilege('anon', 'public.owner_save_finance_settings(numeric,numeric,numeric,numeric,numeric,numeric)', 'execute') as anon_save_settings_blocked,
  not has_function_privilege('anon', 'public.owner_finance_category_settings()', 'execute') as anon_category_settings_blocked,
  not has_function_privilege('anon', 'public.owner_apply_finance_category(text,numeric,numeric)', 'execute') as anon_category_apply_blocked,
  not has_function_privilege('anon', 'public.owner_finance_variant_targets_page(text,text,integer,integer)', 'execute') as anon_variant_page_blocked,
  not has_function_privilege('anon', 'public.owner_save_finance_variant(uuid,text,numeric,numeric)', 'execute') as anon_variant_save_blocked,
  not has_function_privilege('authenticated', 'public.finance_default_product_cost(numeric,text)', 'execute') as customer_cost_helper_blocked,
  not has_function_privilege('authenticated', 'public.finance_variant_current_cost(uuid)', 'execute') as customer_variant_cost_helper_blocked,
  has_function_privilege('authenticated', 'public.owner_get_financial_dashboard(text,timestamptz,timestamptz)', 'execute') as authenticated_rpc_granted,
  has_function_privilege('authenticated', 'public.owner_apply_finance_category(text,numeric,numeric)', 'execute') as authenticated_category_rpc_granted,
  (select relrowsecurity from pg_class where oid = 'public.finance_settings'::regclass) as finance_rls_enabled,
  (select relrowsecurity from pg_class where oid = 'public.finance_category_settings'::regclass) as category_finance_rls_enabled,
  (select relrowsecurity from pg_class where oid = 'public.product_variant_financial_settings'::regclass) as variant_finance_rls_enabled,
  (select format_type(a.atttypid, a.atttypmod) = 'order_payment_status'
     from pg_attribute a
    where a.attrelid = 'public.orders'::regclass
      and a.attname = 'payment_status'
      and not a.attisdropped) as payment_status_type_ready,
  position(
    'public.payment_status'
    in pg_get_functiondef('public.owner_get_financial_dashboard(text,timestamptz,timestamptz)'::regprocedure)
  ) = 0 as dashboard_missing_enum_reference_removed,
  position(
    'public.order_payment_status'
    in pg_get_functiondef('public.owner_get_financial_dashboard(text,timestamptz,timestamptz)'::regprocedure)
  ) > 0 as dashboard_payment_enum_reference_ready,
  position(
    'oi.product_name_snapshot'
    in pg_get_functiondef('public.owner_get_financial_dashboard(text,timestamptz,timestamptz)'::regprocedure)
  ) = 0 as dashboard_missing_product_name_reference_removed,
  position(
    'oi.product_name'
    in pg_get_functiondef('public.owner_get_financial_dashboard(text,timestamptz,timestamptz)'::regprocedure)
  ) > 0 as dashboard_product_name_reference_ready,
  position(
    'finance_variant_current_cost'
    in pg_get_functiondef('public.capture_order_item_financial_snapshot()'::regprocedure)
  ) > 0 as variant_snapshot_cost_ready,
  position(
    'financial_snapshot_version := 2'
    in pg_get_functiondef('public.capture_order_item_financial_snapshot()'::regprocedure)
  ) > 0 as snapshot_version_two_ready,
  (select count(*) = 0
   from public.order_items oi
   cross join public.finance_settings fs
   where fs.singleton = true
     and oi.created_at < fs.activated_at
     and oi.financial_snapshot_version is not null) as historical_items_untouched;
`);

console.log("FINANCIAL_DASHBOARD_DEPLOYMENT_VERIFICATION");
console.log(JSON.stringify(verification, null, 2));

const required = [
  "finance_settings_ready",
  "product_finance_ready",
  "finance_categories_ready",
  "variant_finance_ready",
  "variant_commercial_type_ready",
  "snapshot_column_ready",
  "profit_column_ready",
  "capture_trigger_ready",
  "immutable_trigger_ready",
  "dashboard_rpc_ready",
  "settings_rpc_ready",
  "products_rpc_ready",
  "save_cost_rpc_ready",
  "category_settings_rpc_ready",
  "category_apply_rpc_ready",
  "variant_page_rpc_ready",
  "variant_save_rpc_ready",
  "anon_dashboard_blocked",
  "anon_settings_blocked",
  "anon_products_blocked",
  "anon_save_cost_blocked",
  "anon_save_settings_blocked",
  "anon_category_settings_blocked",
  "anon_category_apply_blocked",
  "anon_variant_page_blocked",
  "anon_variant_save_blocked",
  "customer_cost_helper_blocked",
  "customer_variant_cost_helper_blocked",
  "authenticated_rpc_granted",
  "authenticated_category_rpc_granted",
  "finance_rls_enabled",
  "category_finance_rls_enabled",
  "variant_finance_rls_enabled",
  "payment_status_type_ready",
  "dashboard_missing_enum_reference_removed",
  "dashboard_payment_enum_reference_ready",
  "dashboard_missing_product_name_reference_removed",
  "dashboard_product_name_reference_ready",
  "variant_snapshot_cost_ready",
  "snapshot_version_two_ready",
  "historical_items_untouched",
];

if (required.some((key) => verification?.[key] !== true)) {
  console.error("Financial dashboard verification failed.");
  process.exit(11);
}

console.log("Financial dashboard database is ready.");
