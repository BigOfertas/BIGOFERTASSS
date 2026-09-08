import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

const migration = read("supabase/migrations/20260908113000_catalog_foundation_stage_1.sql");
const variantFix = read("supabase/migrations/20260908115000_fix_catalog_variant_upsert.sql");
const purchaseMigration = read("supabase/migrations/20260908114500_scale_purchase_admin.sql");
const catalog = read("src/lib/catalog.ts");
const products = read("src/lib/products.ts");
const detail = read("src/lib/product-detail.ts");
const stage3Migration = read("supabase/migrations/20260908152000_storefront_media_seo_stage_3.sql");
const seo = read("src/components/product/ProductSeo.tsx");
const adminRoute = read("src/routes/admin.tsx");
const admin = read("src/components/admin/CatalogFoundationAdmin.tsx");
const adminClient = read("src/lib/admin-catalog-foundation.ts");
const imageAdmin = read("src/lib/admin-product-images.ts");
const purchaseAdmin = read("src/components/admin/ProductPurchaseAdmin.tsx");
const purchaseClient = read("src/lib/admin-product-purchase.ts");
const deploy = read("scripts/deploy-storefront-upgrade-migrations.mjs");
const deployWorkflow = read(".github/workflows/deploy-storefront-upgrades-backend.yml");

const checks = [
  [
    "produtos possuem temporada, marca e publico como campos proprios",
    /ADD COLUMN IF NOT EXISTS season text/.test(migration) &&
      /ADD COLUMN IF NOT EXISTS brand text/.test(migration) &&
      /ADD COLUMN IF NOT EXISTS audience text/.test(migration),
  ],
  [
    "taxonomia aberta substitui dependencia de listas fechadas no admin ativo",
    /CREATE TABLE IF NOT EXISTS public\.catalog_taxonomy_items/.test(migration) &&
      /CREATE TABLE IF NOT EXISTS public\.catalog_taxonomy_relations/.test(migration) &&
      /owner_upsert_catalog_taxonomy/.test(migration) &&
      !/ProductAdmin/.test(adminRoute),
  ],
  [
    "admin ativo usa catalogo escalavel unificado",
    /CatalogFoundationAdmin/.test(adminRoute) &&
      !/ProductImageAdmin/.test(adminRoute) &&
      /fetchAdminCatalogPage/.test(admin),
  ],
  [
    "catalogo administrativo e paginado no banco",
    /owner_catalog_products_page/.test(migration) &&
      /p_page_size/.test(migration) &&
      /PAGE_SIZE = 25/.test(admin) &&
      /p_page_size: input\.pageSize/.test(adminClient),
  ],
  [
    "administracao de venda tambem e paginada",
    /owner_purchase_products_page/.test(purchaseMigration) &&
      /fetchPurchaseProductsPage/.test(purchaseAdmin) &&
      /p_page_size: input\.pageSize/.test(purchaseClient),
  ],
  [
    "variacoes reais podem ser criadas e editadas",
    /owner_save_catalog_variant/.test(migration) &&
      /saveAdminCatalogVariant/.test(adminClient) &&
      /Nova variação/.test(admin) &&
      /priceOverride/.test(admin),
  ],
  [
    "upsert de opcoes usa alvos validos de indices por expressao",
    /ON CONFLICT \(product_id, \(lower\(name\)\)\)/.test(variantFix) &&
      /ON CONFLICT \(option_id, \(lower\(value\)\)\)/.test(variantFix),
  ],
  [
    "imagens podem pertencer a galeria geral ou a uma variacao",
    /owner_assign_catalog_image_variant/.test(migration) &&
      /variantId: input\.variantId \?\? null/.test(imageAdmin) &&
      /uploadVariantId/.test(admin) &&
      /assignAdminCatalogImageVariant/.test(admin),
  ],
  [
    "produto publico exige imagem pronta",
    /JOIN LATERAL \([\s\S]*public\.product_images/.test(migration) &&
      /i\.status = 'ready'::public\.product_image_status/.test(migration) &&
      /if \(images\.length === 0\)/.test(detail),
  ],
  [
    "sku saiu do payload do catalogo publico",
    !/\bsku:\s*z\./.test(catalog) &&
      !/'sku',\s*pr\.sku/.test(migration) &&
      !/product\.sku/.test(seo),
  ],
  ["sku nao participa mais da busca publica utilitaria", !/product\.sku/.test(products)],
  [
    "detalhe publico nao solicita sku de produto ou variante",
    /storefront_product_detail_v1/.test(detail) &&
      /CREATE OR REPLACE FUNCTION public\.storefront_product_detail_v1/.test(stage3Migration) &&
      !/'sku'/.test(stage3Migration.split("CREATE OR REPLACE FUNCTION public.storefront_product_detail_v1")[1]),
  ],
  [
    "escolha real de variacao nao e preenchida automaticamente",
    /if \(variants\.length === 1\) return variants\[0\]/.test(detail) &&
      /if \(hasRealChoice\) return null/.test(detail),
  ],
  [
    "compatibilidade considera as escolhas atuais sem trocar silenciosamente",
    /selectionByVariantList/.test(detail) &&
      /delete candidateSelection\[optionId\]/.test(detail) &&
      /Object\.entries\(candidateSelection\)/.test(detail),
  ],
  [
    "deploy futuro conhece todas as migrations da etapa um",
    /catalog_foundation_stage_1/.test(deploy) &&
      /scale_purchase_admin/.test(deploy) &&
      /fix_catalog_variant_upsert/.test(deploy) &&
      /20260908113000_catalog_foundation_stage_1\.sql/.test(deployWorkflow) &&
      /20260908114500_scale_purchase_admin\.sql/.test(deployWorkflow) &&
      /20260908115000_fix_catalog_variant_upsert\.sql/.test(deployWorkflow),
  ],
];

let failures = 0;
for (const [label, pass] of checks) {
  if (pass) {
    console.log(`PASS - ${label}`);
  } else {
    failures += 1;
    console.error(`FAIL - ${label}`);
  }
}

if (failures > 0) {
  console.error(`\n${failures}/${checks.length} validacoes falharam.`);
  process.exit(1);
}

console.log(`\n${checks.length}/${checks.length} validacoes aprovadas.`);
