import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
let passed = 0;
let failed = 0;

function check(label, condition) {
  if (condition) {
    passed += 1;
    console.log(`PASS - ${label}`);
  } else {
    failed += 1;
    console.error(`FAIL - ${label}`);
  }
}

const migration = read("supabase/migrations/20260908152000_storefront_media_seo_stage_3.sql");
const r2 = read("supabase/functions/_shared/r2.ts");
const presign = read("supabase/functions/r2-image-presign/index.ts");
const complete = read("supabase/functions/r2-image-complete/index.ts");
const adminImages = read("src/lib/admin-product-images.ts");
const productImages = read("src/lib/product-images.ts");
const catalog = read("src/lib/catalog.ts");
const catalogHooks = read("src/hooks/useCatalogProducts.ts");
const searchSuggestions = read("src/hooks/useCatalogSearchSuggestions.ts");
const productDetail = read("src/lib/product-detail.ts");
const productRoute = read("src/routes/product/$id.tsx");
const productSeo = read("src/components/product/ProductSeo.tsx");
const productSeoLib = read("src/lib/product-seo.ts");
const gallery = read("src/components/product/ProductGallery.tsx");
const hostingerSeoWorker = read("cloudflare/hostinger-product-seo-worker.ts");
const deploy = read("scripts/deploy-storefront-upgrade-migrations.mjs");
const deployWorkflow = read(".github/workflows/deploy-storefront-upgrades-backend.yml");

check(
  "banco possui chaves de derivados card e thumb",
  migration.includes("ADD COLUMN IF NOT EXISTS card_storage_key text") &&
    migration.includes("ADD COLUMN IF NOT EXISTS thumb_storage_key text"),
);
check(
  "R2 gera um conjunto estável main card thumb por imagem",
  r2.includes("buildProductImageObjectKeys") &&
    r2.includes("-card.${extension}") &&
    r2.includes("-thumb.${extension}"),
);
check(
  "presign prepara três uploads e mantém um único registro de imagem",
  presign.includes("derivativeUploads") &&
    presign.includes("card_storage_key: objectKeys.card") &&
    presign.includes("thumb_storage_key: objectKeys.thumb") &&
    presign.includes("Promise.all"),
);
check(
  "complete só publica imagem depois de verificar todos os derivados",
  complete.includes("image.card_storage_key") &&
    complete.includes("image.thumb_storage_key") &&
    complete.includes("Promise.all(keys.map") &&
    complete.includes('status: "ready"'),
);
check(
  "admin converte uploads para WebP e cria tamanhos main card thumb",
  adminImages.includes('const OUTPUT_MIME = "image/webp"') &&
    adminImages.includes("MAIN_MAX_EDGE") &&
    adminImages.includes("CARD_MAX_EDGE") &&
    adminImages.includes("THUMB_MAX_EDGE") &&
    adminImages.includes("processProductImage") &&
    adminImages.includes("putDerivative"),
);
check(
  "catálogo usa derivados card e busca usa RPC v3",
  catalog.includes("image_card_storage_key") &&
    catalog.includes("buildR2PublicImageUrl(item.image_card_storage_key)") &&
    catalogHooks.includes('"catalog_products_page_v3"') &&
    searchSuggestions.includes('"catalog_products_page_v3"') &&
    migration.includes("CREATE OR REPLACE FUNCTION public.catalog_products_page_v3"),
);
check(
  "galeria usa thumb separado da imagem grande",
  productImages.includes("thumbUrl") && gallery.includes("src={image.thumbUrl}"),
);
check(
  "detalhe público passou a uma única RPC de produto",
  productDetail.includes('"storefront_product_detail_v1"') &&
    migration.includes("CREATE OR REPLACE FUNCTION public.storefront_product_detail_v1") &&
    !productDetail.includes('.from("product_images")') &&
    !productDetail.includes('.from("product_options")') &&
    !productDetail.includes('.from("product_variants")'),
);
check(
  "rota carrega detalhe antes de renderizar head e reaproveita no React Query",
  productRoute.includes("loader: ({ params }) => fetchProductDetail(params.id)") &&
    productRoute.includes("head: ({ loaderData })") &&
    productRoute.includes("buildProductHead(loaderData)") &&
    productRoute.includes("initialData: loaderDetail"),
);
check(
  "SEO inicial possui canonical Open Graph Twitter e preço",
  productSeoLib.includes('property: "og:title"') &&
    productSeoLib.includes('property: "og:image"') &&
    productSeoLib.includes('name: "twitter:card"') &&
    productSeoLib.includes('property: "product:price:amount"') &&
    productSeoLib.includes('rel: "canonical"'),
);
check(
  "SEO dinâmico mantém canonical no domínio oficial",
  productSeo.includes("BRAND.siteUrl") && !productSeo.includes("window.location.origin"),
);
check(
  "galeria mobile possui swipe contador ampliação e zoom",
  gallery.includes("onTouchStart") &&
    gallery.includes("onTouchEnd") &&
    gallery.includes("SWIPE_THRESHOLD") &&
    gallery.includes("viewerOpen") &&
    gallery.includes("zoomed") &&
    gallery.includes("activeIndex + 1"),
);
check(
  "ponte SEO para Hostinger consulta o mesmo detalhe e injeta metadados no edge",
  hostingerSeoWorker.includes("storefront_product_detail_v1") &&
    hostingerSeoWorker.includes("HTMLRewriter") &&
    hostingerSeoWorker.includes("STOREFRONT_ORIGIN_BASE_URL") &&
    hostingerSeoWorker.includes('meta property="og:image"'),
);
check(
  "deploy futuro inclui e verifica a etapa três",
  deploy.includes("storefront_media_seo_stage_3") &&
    deploy.includes("catalog_v3_rpc") &&
    deploy.includes("product_detail_v1_rpc") &&
    deploy.includes("image_card_derivative_column") &&
    deployWorkflow.includes("20260908152000_storefront_media_seo_stage_3.sql"),
);
check(
  "compatibilidade de variações usa seleção atual",
  productRoute.includes("value.id,\n                          selection,") &&
    !productRoute.includes("value.id,\n                          {},"),
);

console.log(`\n${passed}/${passed + failed} validações da Etapa 3 aprovadas.`);
if (failed > 0) process.exit(1);
