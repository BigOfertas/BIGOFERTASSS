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
const products = read("src/routes/products.tsx");
const checkout = read("src/routes/checkout.tsx");
const nav = read("src/components/layout/CategoryNav.tsx");
const header = read("src/components/layout/Header.tsx");
const footer = read("src/components/layout/Footer.tsx");
const promo = read("src/components/layout/PromoBanner.tsx");
const categories = read("src/components/home/VisualCategories.tsx");
const best = read("src/components/home/BestSellers.tsx");
const brazil = read("src/components/home/BrazilianTeams.tsx");
const brazilProducts = read("src/components/home/BrazilianProducts.tsx");
const faq = read("src/components/home/FAQ.tsx");
const productCard = read("src/components/product/ProductCard.tsx");
const productPage = read("src/routes/product/$id.tsx");
const purchaseOptions = read("src/components/product/ProductPurchaseOptions.tsx");
const shippingCalculator = read("src/components/product/ProductShippingCalculator.tsx");
const gallery = read("src/components/product/ProductGallery.tsx");
const seo = read("src/components/product/ProductSeo.tsx");
const filters = read("src/components/ProductFilters.tsx");
const catalog = read("src/lib/catalog.ts");
const catalogGrid = read("src/components/product/CatalogProductGrid.tsx");
const catalogHooks = read("src/hooks/useCatalogProducts.ts");
const searchSuggestions = read("src/hooks/useCatalogSearchSuggestions.ts");
const shipping = read("src/lib/shipping.ts");
const admin = read("src/routes/admin.tsx");
const personalization = read("src/components/admin/PersonalizationAdmin.tsx");
const personalizationLib = read("src/lib/site-personalization.ts");
const registration = read("src/routes/cadastro.tsx");
const auth = read("src/lib/auth.tsx");
const personalizationMigration = read(
  "supabase/migrations/20260904213000_storefront_personalization.sql",
);
const commercialTypeMigration = read(
  "supabase/migrations/20260904213500_catalog_commercial_type.sql",
);
const signupPhoneMigration = read("supabase/migrations/20260907124500_require_phone_on_signup.sql");
const stage2Migration = read(
  "supabase/migrations/20260908133000_storefront_experience_stage_2.sql",
);
const config = read("supabase/config.toml");

check(
  "admin mantém a seção de personalização",
  admin.includes('id: "personalization"') && admin.includes("<PersonalizationAdmin />"),
);

const assetSlots = [
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
];
check(
  "personalização mantém os 15 slots administráveis",
  assetSlots.every(
    (slot) =>
      personalizationLib.includes(`"${slot}"`) && personalizationMigration.includes(`'${slot}'`),
  ),
);
check(
  "admin informa dimensões, proporção e formato das artes",
  personalization.includes("Ideal:") &&
    personalization.includes("proporção aproximada") &&
    personalization.includes("Formato:"),
);
check(
  "banners PC e mobile mantêm as proporções definidas",
  index.includes('aspectRatio: "1920/100"') &&
    index.includes('aspectRatio: "1080/169"') &&
    index.includes('aspectRatio: "1920/550"') &&
    index.includes('aspectRatio: "1080/1067"'),
);
check(
  "faixa intermediária continua com versões PC e mobile",
  index.includes("ambient_banner_desktop") && index.includes("ambient_banner_mobile"),
);
check(
  "carrossel superior continua em movimento contínuo",
  promo.includes('animationPlayState: "running"') && promo.includes("animate-marquee--fast"),
);
check("hero continua sem link", !index.includes('id="inferior"\n          href='));
check(
  "banner do Brasileirão continua levando à seção correta",
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
  "menu desktop e mobile usam a taxonomia comercial definida",
  expectedNav.every((label) => nav.includes(`name: "${label}"`)) &&
    forbiddenNav.every((label) => !nav.includes(`name: "${label}"`)) &&
    header.includes("<CategoryNav />") &&
    header.includes("<CategoryNav mobile"),
);

check(
  "Monte seu pedido mantém sete cards na ordem definida",
  [
    "Conjunto infantil / Kids",
    "Conjunto de treino / Kits",
    "Short",
    "Basquete / NBA",
    "Corta-vento / Windbreaker",
    "Mundo FIFA",
    "Camisas retrô",
  ].every((label, index, list) => {
    const position = categories.indexOf(`name: "${label}"`);
    const previous = index === 0 ? -1 : categories.indexOf(`name: "${list[index - 1]}"`);
    return position >= 0 && position > previous;
  }),
);
check(
  "cards de Monte seu pedido usam artes administráveis em proporção 2:3",
  categories.includes("useStorefrontPersonalization") &&
    categories.includes("image={data?.[category.slot]?.url ?? null}") &&
    categories.includes('className="aspect-[2/3]') &&
    categories.includes("category_retro"),
);
check(
  "atalhos visuais usam os mesmos filtros do menu",
  categories.includes('search: { category: "infantil" }') &&
    categories.includes('search: { category: "kit-treino" }') &&
    categories.includes('search: { category: "basquete" }') &&
    categories.includes('search: { category: "corta-ventos" }') &&
    categories.includes('search: { category: "retro" }') &&
    categories.includes('search: { campeonato: "copa-do-mundo" }'),
);

check(
  "FAQ mantém as três dúvidas de afiliados definidas",
  faq.includes("question: `Como faço para ser afiliado da ${BRAND.officialName}?`") &&
    faq.includes("clique em “Quero ser afiliado”") &&
    faq.includes("Quanto ganho como afiliado?") &&
    faq.includes("Você recebe um valor fixo por peça") &&
    faq.includes("Meu link de afiliado expira?") &&
    faq.includes("Seu link permanece o mesmo enquanto você for afiliado ativo"),
);
check(
  "cadastro exige telefone brasileiro válido",
  registration.includes("Telefone") &&
    registration.includes('type="tel"') &&
    registration.includes("isValidBrazilianPhone(phone)") &&
    registration.includes("nameValid && phoneValid") &&
    registration.includes("formatBrazilianPhone"),
);
check(
  "telefone do cadastro é salvo e obrigatório no banco",
  auth.includes("phone: onlyDigits(phone, 11)") &&
    signupPhoneMigration.includes("BEFORE INSERT ON auth.users") &&
    signupPhoneMigration.includes("is_valid_brazilian_phone") &&
    signupPhoneMigration.includes("Telefone invalido ou DDD inexistente"),
);

check(
  "vitrine não usa Mais vendidos falso",
  !best.includes("Mais vendidos") &&
    !best.includes("bestSellingProducts") &&
    best.includes("Lançamentos"),
);
check(
  "placeholders aparecem somente durante carregamento",
  best.includes("isLoading") &&
    brazilProducts.includes("isLoading") &&
    !best.includes("placeholderCount") &&
    !brazilProducts.includes("placeholderCount") &&
    best.includes("ProductCardPlaceholder") &&
    brazilProducts.includes("ProductCardPlaceholder"),
);
check(
  "card mantém navegação ao produto e quick add separado sem CTA repetido",
  productCard.includes("data-product-card") &&
    productCard.includes("<ProductQuickAdd") &&
    productCard.includes('to="/product/$id"') &&
    !productCard.includes("Ver produto") &&
    !productCard.includes("Ver detalhes"),
);
check(
  "card prioriza imagem e metadados comerciais",
  productCard.includes("commercialType") &&
    productCard.includes("time") &&
    productCard.includes('className="h-full w-full object-contain') &&
    productCard.includes("sizes="),
);

check(
  "catálogo etapa 2 possui filtros comerciais completos",
  ["season", "brand", "audience", "commercialType"].every(
    (key) =>
      catalog.includes(`${key}?: string`) &&
      products.includes(`${key}: filterKeySchema.optional()`),
  ) &&
    filters.includes('title="Temporada"') &&
    filters.includes('title="Marca"') &&
    filters.includes('title="Modelo"') &&
    filters.includes('title="Público"'),
);
check(
  "filtros mobile usam painel, contador e total de resultados",
  products.includes("<Sheet") &&
    products.includes("Filtrar") &&
    products.includes("activeFilterCount") &&
    products.includes("Ver {catalog?.total") &&
    products.includes('side="bottom"'),
);
check(
  "seletor técnico de 12/24/48 não é exibido ao cliente",
  !products.includes("CATALOG_PAGE_SIZES") && !products.includes("Exibir"),
);
check(
  "facetas acompanham os filtros selecionados",
  products.includes("useCatalogFacets(search)") &&
    catalogHooks.includes('"catalog_filter_facets_v2"') &&
    catalogHooks.includes("catalogFilterArgs(facetQuery)"),
);
check(
  "catálogo usa RPC atual para produtos e preserva facetas da etapa 2",
  catalogHooks.includes('"catalog_products_page_v3"') &&
    searchSuggestions.includes('"catalog_products_page_v3"') &&
    stage2Migration.includes("CREATE OR REPLACE FUNCTION public.catalog_products_page_v2") &&
    stage2Migration.includes("CREATE OR REPLACE FUNCTION public.catalog_filter_facets_v2"),
);
check(
  "busca de sugestões usa debounce de 250 ms",
  searchSuggestions.includes("const SEARCH_DEBOUNCE_MS = 250") &&
    searchSuggestions.includes("window.setTimeout") &&
    header.includes("useCatalogSearchSuggestions"),
);
check(
  "catálogo público aceita imagens do produto ou das variações",
  stage2Migration.includes("LEFT JOIN public.product_variants pv ON pv.id = i.variant_id") &&
    stage2Migration.includes("COALESCE(pv.is_default, false) DESC") &&
    !/catalog_filter_facets_v2[\s\S]*?i\.variant_id IS NULL/.test(stage2Migration),
);
check(
  "tipo comercial continua vindo da configuração de compra",
  commercialTypeMigration.includes("LEFT JOIN public.product_purchase_settings") &&
    stage2Migration.includes("LEFT JOIN public.product_purchase_settings"),
);

check(
  "catálogo mantém densidade 2/3/4/5 no PC e 1/2 no mobile",
  catalogGrid.includes('if (typeof window === "undefined") return 4') &&
    catalogGrid.includes('if (typeof window === "undefined") return 2') &&
    catalogGrid.includes("([2, 3, 4, 5] as const)") &&
    catalogGrid.includes("([1, 2] as const)"),
);
check(
  "densidade usa transição e preserva preferência",
  catalogGrid.includes("transition-opacity duration-200") &&
    catalogGrid.includes("setFading(true)") &&
    catalogGrid.includes("window.localStorage.setItem"),
);

check(
  "produto não exibe SKU operacional",
  !productPage.includes("SKU:") && !productPage.includes('{ label: "SKU"'),
);
check(
  "produto não exibe peso ou dimensões da embalagem",
  !productPage.includes('{ label: "Peso"') && !productPage.includes('{ label: "Dimensões"'),
);
check(
  "produto possui guia de tamanhos sem medidas inventadas",
  purchaseOptions.includes("Ver guia de tamanhos") &&
    purchaseOptions.includes("Meça de uma axila à outra") &&
    purchaseOptions.includes("As medidas em centímetros podem variar entre modelos"),
);
check(
  "produto possui cálculo de entrega antes do carrinho",
  productPage.includes("ProductShippingCalculator") &&
    shippingCalculator.includes("requestProductShippingQuotes") &&
    shippingCalculator.includes("Previsão total:"),
);
check(
  "prazo total soma preparação e transporte",
  shipping.includes("formatTotalDeliveryLabel") &&
    shipping.includes("productionBusinessDays + range.min") &&
    purchaseOptions.includes("Prazo total estimado") &&
    checkout.includes("formatTotalDeliveryLabel"),
);
check(
  "produto mantém ação fixa no mobile",
  productPage.includes("fixed inset-x-0 bottom-0") && productPage.includes("Valor por peça"),
);
check(
  "cliente recorrente pode reutilizar dados do checkout",
  checkout.includes("Usar estes dados") &&
    checkout.includes("Editar") &&
    checkout.includes("identity"),
);

check(
  "galeria e cards mantêm dicas de tamanho e prioridade",
  gallery.includes("sizes=") &&
    gallery.includes('fetchPriority="high"') &&
    productCard.includes("sizes="),
);
check(
  "SEO mantém Open Graph, Twitter e dados estruturados",
  seo.includes("twitter:card") &&
    seo.includes("og:image:alt") &&
    seo.includes("application/ld+json"),
);

const institutionalRoutes = [
  "/privacidade",
  "/trocas-e-devolucoes",
  "/termos-de-compra",
  "/producao-e-envio",
  "/contato",
];
check(
  "rodapé aponta para páginas institucionais reais",
  institutionalRoutes.every((route) => footer.includes(`to="${route}"`)) &&
    institutionalRoutes.every((route) =>
      fs.existsSync(`src/routes/${route.slice(1).replaceAll("/", "-")}.tsx`),
    ),
);
check(
  "rodapé evita repetição técnica de segurança",
  !/HTTPS|SSL|TLS|criptograf/i.test(footer) && footer.includes("PEDIDO ACOMPANHADO"),
);

check(
  "uploads de personalização continuam protegidos por owner",
  personalizationMigration.includes("site_asset_uploads_owner_all") &&
    personalizationMigration.includes("site_personalization_assets_owner_all"),
);
check(
  "funções de assets mantêm validação própria de autenticação",
  config.includes("[functions.site-asset-presign]\nverify_jwt = false") &&
    config.includes("[functions.site-asset-complete]\nverify_jwt = false"),
);

console.log(`\n${passed}/${passed + failed} validações aprovadas.`);
if (failed > 0) process.exit(1);
