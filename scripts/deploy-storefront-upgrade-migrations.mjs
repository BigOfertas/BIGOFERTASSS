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
  [
    "catalog_foundation_stage_1",
    "supabase/migrations/20260908113000_catalog_foundation_stage_1.sql",
  ],
  ["scale_purchase_admin", "supabase/migrations/20260908114500_scale_purchase_admin.sql"],
  [
    "fix_catalog_variant_upsert",
    "supabase/migrations/20260908115000_fix_catalog_variant_upsert.sql",
  ],
  [
    "storefront_experience_stage_2",
    "supabase/migrations/20260908133000_storefront_experience_stage_2.sql",
  ],
  [
    "storefront_media_seo_stage_3",
    "supabase/migrations/20260908152000_storefront_media_seo_stage_3.sql",
  ],
  [
    "catalog_bulk_import_bridge",
    "supabase/migrations/20260908170000_catalog_bulk_import_bridge.sql",
  ],
  ["catalog_business_rules", "supabase/migrations/20260909130000_catalog_business_rules.sql"],
  [
    "global_patch_matrix_refined_2026",
    "supabase/migrations/20260909143000_global_patch_matrix.sql",
  ],
  [
    "google_photos_external_images",
    "supabase/migrations/20260909150000_google_photos_external_images.sql",
  ],
  ["multiple_purchase_patches", "supabase/migrations/20260909151000_multiple_purchase_patches.sql"],
  [
    "google_photos_catalog_import_reset_fix_20260909",
    "supabase/migrations/20260909152000_google_photos_catalog_import.sql",
  ],
  [
    "catalog_public_rpc_security_fix_20260909",
    "supabase/migrations/20260909220000_catalog_public_rpc_security_fix.sql",
  ],
  [
    "stage2_purchase_customization_policy_20260911",
    "supabase/migrations/20260911051000_stage2_purchase_customization_policy.sql",
  ],
  [
    "stage2_storefront_priority_20260911",
    "supabase/migrations/20260911054000_stage2_storefront_priority.sql",
  ],
  [
    "stage2_storefront_priority_security_fix_20260911",
    "supabase/migrations/20260911055500_stage2_storefront_priority_security_fix.sql",
  ],
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
  pg_catalog.to_regclass('public.catalog_taxonomy_items') is not null as catalog_taxonomy_table,
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'product_images' and column_name = 'card_storage_key'
  ) as image_card_derivative_column,
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'product_images' and column_name = 'thumb_storage_key'
  ) as image_thumb_derivative_column,
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'product_images' and column_name = 'external_url'
  ) as image_external_url_column,
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'products' and column_name = 'catalog_code'
  ) as catalog_code_column,
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'product_variants' and column_name = 'catalog_variant_code'
  ) as catalog_variant_code_column,
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'product_images' and column_name = 'catalog_source_key'
  ) as catalog_source_key_column,
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
    where n.nspname = 'public' and p.proname = 'catalog_products_page_v2'
  ) as catalog_v2_rpc,
  exists (
    select 1 from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'catalog_products_page_v2' and p.prosecdef
  ) as catalog_v2_security_definer,
  exists (
    select 1 from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'catalog_products_page_v3'
  ) as catalog_v3_rpc,
  exists (
    select 1 from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'catalog_filter_facets_v2'
  ) as catalog_facets_v2_rpc,
  exists (
    select 1 from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'catalog_filter_facets_v2' and p.prosecdef
  ) as catalog_facets_v2_security_definer,
  exists (
    select 1 from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'storefront_product_detail_v1'
  ) as product_detail_v1_rpc,
  exists (
    select 1 from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'storefront_product_detail_v2'
  ) as product_detail_v2_rpc,
  exists (
    select 1 from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'owner_catalog_products_page'
  ) as scalable_catalog_admin_rpc,
  exists (
    select 1 from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'owner_save_catalog_variant'
  ) as catalog_variant_admin_rpc,
  exists (
    select 1 from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'owner_catalog_import_upsert_product'
  ) as catalog_import_product_rpc,
  exists (
    select 1 from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'owner_catalog_import_upsert_variant'
  ) as catalog_import_variant_rpc,
  exists (
    select 1 from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'owner_catalog_import_finalize_image'
  ) as catalog_import_image_rpc,
  exists (
    select 1 from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'catalog_apply_normalized_batch'
  ) as catalog_apply_normalized_batch_rpc,
  exists (
    select 1 from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'owner_purchase_products_page'
  ) as scalable_purchase_admin_rpc,
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
  ) as signup_phone_trigger,
  exists (
    select 1
    from public.store_purchase_settings s
    cross join lateral jsonb_array_elements(s.patch_catalog) p(value)
    where s.singleton = true
      and p.value->>'code' = 'champions-league-multiple-winner'
  ) as global_patch_matrix,
  exists (
    select 1 from pg_catalog.pg_trigger t
    join pg_catalog.pg_class c on c.oid = t.tgrelid
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'product_purchase_settings'
      and t.tgname = 'enforce_product_purchase_customization_policy'
      and not t.tgisinternal
  ) as stage2_purchase_policy_trigger,
  not exists (
    select 1
    from public.product_purchase_settings s
    where s.commercial_type = 'calcao'
      and (s.personalization_enabled or s.phrase_enabled or s.patches <> '[]'::jsonb)
  ) as shorts_purchase_policy,
  not exists (
    select 1
    from public.product_purchase_settings s
    where s.commercial_type <> 'calcao'
      and (not s.personalization_enabled or not s.phrase_enabled)
  ) as non_shorts_personalization_policy,
  exists (
    select 1 from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'storefront_product_priority'
  ) as stage2_storefront_priority_rpc;
`);

console.log("STOREFRONT_UPGRADE_BACKEND_VERIFICATION");
console.log(JSON.stringify(verification, null, 2));

const required = [
  "site_asset_uploads_table",
  "personalization_table",
  "catalog_taxonomy_table",
  "image_card_derivative_column",
  "image_thumb_derivative_column",
  "image_external_url_column",
  "catalog_code_column",
  "catalog_variant_code_column",
  "catalog_source_key_column",
  "personalization_rpc",
  "catalog_rpc",
  "catalog_v2_rpc",
  "catalog_v2_security_definer",
  "catalog_v3_rpc",
  "catalog_facets_v2_rpc",
  "catalog_facets_v2_security_definer",
  "product_detail_v1_rpc",
  "product_detail_v2_rpc",
  "scalable_catalog_admin_rpc",
  "catalog_variant_admin_rpc",
  "catalog_import_product_rpc",
  "catalog_import_variant_rpc",
  "catalog_import_image_rpc",
  "catalog_apply_normalized_batch_rpc",
  "scalable_purchase_admin_rpc",
  "affiliate_activate_rpc",
  "affiliate_deactivate_rpc",
  "signup_phone_trigger",
  "global_patch_matrix",
  "stage2_purchase_policy_trigger",
  "shorts_purchase_policy",
  "non_shorts_personalization_policy",
  "stage2_storefront_priority_rpc",
];

if (!required.every((key) => verification?.[key] === true)) {
  console.error("Storefront upgrade backend verification failed.");
  process.exit(11);
}

console.log("Storefront upgrade backend is live.");
