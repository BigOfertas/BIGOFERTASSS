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

const index = read("src/routes/index.tsx");
const nav = read("src/components/layout/CategoryNav.tsx");
const categories = read("src/components/home/VisualCategories.tsx");
const best = read("src/components/home/BestSellers.tsx");
const productCard = read("src/components/product/ProductCard.tsx");
const productPage = read("src/routes/product/$id.tsx");
const header = read("src/components/layout/Header.tsx");
const admin = read("src/routes/admin.tsx");
const personalization = read("src/components/admin/PersonalizationAdmin.tsx");
const personalizationLib = read("src/lib/site-personalization.ts");
const brazil = read("src/components/home/BrazilianTeams.tsx");
const brazilProducts = read("src/components/home/BrazilianProducts.tsx");
const promo = read("src/components/layout/PromoBanner.tsx");
const shipping = read("src/components/product/ProductShippingCalculator.tsx");
const gallery = read("src/components/product/ProductGallery.tsx");
const seo = read("src/components/product/ProductSeo.tsx");
const catalog = read("src/lib/catalog.ts");
const catalogGrid = read("src/components/product/CatalogProductGrid.tsx");
const migration = read("supabase/migrations/20260904213000_storefront_personalization.sql");
const catalogMigration = read("supabase/migrations/20260904213500_catalog_commercial_type.sql");
const config = read("supabase/config.toml");

check(
  "admin possui seção Personalização",
  admin.includes('id: "personalization"') && admin.includes("<PersonalizationAdmin />"),
);
check(
  "personalização contém todos os 15 slots",
  [
    "top_banner_desktop",
    "top_banner_mobile",
    "hero_desktop",
    "hero_mobile",
    "brasileirao_banner_desktop",
    "brasileirao_banner_mobile",
    "ambient_banner_desktop",
    "ambient_banner_mobile",
    "category_kids",
    "category_training",
    "category_shorts",
    "category_basketball",
    "category_windbreaker",
    "category_fifa",
    "category_retro",
  ].every((slot) => personalizationLib.includes(`"${slot}"`) && migration.includes(`'${slot}'`)),
);
check(
  "admin mostra tamanho e proporção recomendados",
  personalization.includes("Ideal:") &&
    personalization.includes("proporção aproximada") &&
    personalization.includes("Formato:"),
);
check(
  "carrossel superior tem dimensões PC e mobile corretas",
  index.includes('aspectRatio: "1920/100"') && index.includes('aspectRatio: "1080/169"'),
);
check(
  "hero tem dimensões PC e mobile corretas",
  index.includes('aspectRatio: "1920/550"') && index.includes('aspectRatio: "1080/1067"'),
);
check(
  "faixa intermediária aceita PC e mobile",
  index.includes("ambient_banner_desktop") && index.includes("ambient_banner_mobile"),
);
check(
  "carrossel superior força movimento contínuo",
  promo.includes('animationPlayState: "running"') && promo.includes("animate-marquee--fast"),
);
check("banner hero não possui link configurado", !index.includes('id="inferior"\n          href='));
check(
  "banner Brasileirão leva à seção Brasileirão",
  brazil.includes('href="#brasileirao"') && brazilProducts.includes('id="brasileirao"'),
);

const expectedNav = [
  "INÍCIO",
  "KIDS",
  "KITS DE TREINO",
  "SHORTS",
  "BASQUETE / NBA",
  "CORTA-VENTO",
  "MUNDO FIFA",
  "CAMISAS RETRÔ",
];
const forbiddenNav = [
  "COPA DO MUNDO",
  "JOGADOR",
  "KIT REGATA",
  "CONJUNTOS",
  "INFANTIL",
  "FEMININAS",
  "ACESSÓRIOS",
];
check(
  "menu desktop e mobile usam somente a nova taxonomia comercial",
  expectedNav.every((label) => nav.includes(`name: "${label}"`)) &&
    forbiddenNav.every((label) => !nav.includes(`name: "${label}"`)) &&
    header.includes("<CategoryNav />") &&
    header.includes("<CategoryNav mobile"),
);

const categoryOrder = [
  "Conjunto infantil / Kids",
  "Conjunto de treino / Kits",
  "Short",
  "Basquete / NBA",
  "Corta-vento / Windbreaker",
  "Mundo FIFA",
  "Camisas retrô",
];
check(
  "Monte seu pedido possui sete cards na ordem definida",
  categoryOrder.every((label, index) => {
    const position = categories.indexOf(`name: "${label}"`);
    if (position < 0) return false;
    return index === 0 || position > categories.indexOf(`name: "${categoryOrder[index - 1]}"`);
  }),
);
check(
  "cards de Monte seu pedido usam artes administráveis",
  categories.includes("useStorefrontPersonalization") && categories.includes("category_retro"),
);

check(
  "Mais vendidos falso foi removido",
  !best.includes("Mais vendidos") &&
    !best.includes("bestSellingProducts") &&
    best.includes("Lançamentos"),
);
check(
  "placeholders permanecem temporariamente",
  best.includes("ProductCardPlaceholder") && brazilProducts.includes("ProductCardPlaceholder"),
);
check(
  "card de produto usa CTA Ver produto",
  productCard.includes("Ver produto") && !productCard.includes("Ver detalhes"),
);
check(
  "card aceita time e tipo comercial automaticamente",
  productCard.includes("commercialType") &&
    productCard.includes("time") &&
    catalog.includes("commercial_type"),
);
check(
  "catálogo inclui tipo comercial via product_purchase_settings",
  catalogMigration.includes("LEFT JOIN public.product_purchase_settings") &&
    catalogMigration.includes("'commercial_type'"),
);
check(
  "produto não exibe SKU operacional",
  !productPage.includes("SKU:") && !productPage.includes('{ label: "SKU"'),
);
check(
  "produto não exibe peso e dimensões da embalagem",
  !productPage.includes('{ label: "Peso"') && !productPage.includes('{ label: "Dimensões"'),
);
check(
  "produto tem calculadora de entrega",
  productPage.includes("ProductShippingCalculator") &&
    shipping.includes("requestProductShippingQuotes"),
);
check(
  "produto tem ação fixa no mobile",
  productPage.includes("fixed inset-x-0 bottom-0") && productPage.includes("Valor por peça"),
);
check(
  "pesquisa tem sugestões dinâmicas",
  header.includes("useCatalogSearchSuggestions") && header.includes("Ver todos os resultados"),
);
check(
  "catálogo possui densidade 2/3/4/5 no PC com padrão 4 e 1/2 no mobile",
  /useState<DesktopColumns>\(\(\)\s*=>\s*readStoredDesktopColumns\(\),?\s*\)/.test(catalogGrid) &&
    /useState<MobileColumns>\(\(\)\s*=>\s*readStoredMobileColumns\(\),?\s*\)/.test(catalogGrid) &&
    catalogGrid.includes('if (typeof window === "undefined") return 4') &&
    catalogGrid.includes('if (typeof window === "undefined") return 2') &&
    catalogGrid.includes("([2, 3, 4, 5] as const)") &&
    catalogGrid.includes("([1, 2] as const)"),
);
check(
  "troca de densidade usa fade e preserva preferência",
  catalogGrid.includes("transition-opacity duration-200") &&
    catalogGrid.includes("setFading(true)") &&
    catalogGrid.includes("window.localStorage.setItem"),
);
check(
  "galeria e cards possuem dicas de tamanho/performance",
  gallery.includes("sizes=") &&
    gallery.includes('fetchPriority="high"') &&
    productCard.includes("sizes="),
);
check(
  "SEO inclui Open Graph, Twitter e dados estruturados",
  seo.includes("twitter:card") &&
    seo.includes("og:image:alt") &&
    seo.includes("application/ld+json"),
);
check(
  "uploads de personalização validam owner via RLS",
  migration.includes("site_asset_uploads_owner_all") &&
    migration.includes("site_personalization_assets_owner_all"),
);
check(
  "funções de assets desligam verify_jwt da plataforma e validam no handler",
  config.includes("[functions.site-asset-presign]\nverify_jwt = false") &&
    config.includes("[functions.site-asset-complete]\nverify_jwt = false"),
);

console.log(`\n${passed}/${passed + failed} validações aprovadas.`);
if (failed > 0) process.exit(1);
