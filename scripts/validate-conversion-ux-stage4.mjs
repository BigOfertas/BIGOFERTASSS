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

const header = read("src/components/layout/Header.tsx");
const products = read("src/routes/products.tsx");
const filters = read("src/components/ProductFilters.tsx");
const card = read("src/components/product/ProductCard.tsx");
const grid = read("src/components/product/CatalogProductGrid.tsx");
const catalog = read("src/lib/catalog.ts");
const catalogHook = read("src/hooks/useCatalogProducts.ts");
const searchHook = read("src/hooks/useCatalogSearchSuggestions.ts");
const favorites = read("src/context/FavoritesContext.tsx");
const favoriteRoute = read("src/routes/favoritos.tsx");
const cartContext = read("src/context/CartContext.tsx");
const miniCart = read("src/components/cart/MiniCartDrawer.tsx");
const root = read("src/routes/__root.tsx");
const productRoute = read("src/routes/product/$id.tsx");
const productSeo = read("src/components/product/ProductSeo.tsx");
const shipping = read("src/components/product/ProductShippingCalculator.tsx");
const cart = read("src/routes/cart.tsx");
const checkout = read("src/routes/checkout.tsx");
const checkoutLib = read("src/lib/checkout.ts");
const account = read("src/routes/conta.tsx");
const migration = read("supabase/migrations/20260908210500_conversion_ux_stage_4.sql");
const deploy = read("scripts/deploy-storefront-upgrade-migrations.mjs");
const deployWorkflow = read(".github/workflows/deploy-storefront-upgrades-backend.yml");

check(
  "header desktop prioriza busca, conta, favoritos e carrinho",
  header.includes("useCatalogSearchSuggestions") &&
    header.includes("accountDestination") &&
    header.includes('to="/favoritos"') &&
    header.includes('to="/cart"') &&
    header.includes("Busque por time, seleção, camisa, temporada"),
);

check(
  "busca possui painel rico com produtos, times, marcas e estado vazio",
  header.includes("Resultados rápidos") &&
    header.includes("Times e seleções") &&
    header.includes("Marcas") &&
    header.includes("Ver todos os resultados") &&
    header.includes("Nenhum produto encontrado") &&
    searchHook.includes("SEARCH_DEBOUNCE_MS = 250"),
);

check(
  "catálogo e produto preservam breadcrumbs reais",
  products.includes('aria-label="Breadcrumb"') &&
    products.includes('to="/products"') &&
    productRoute.includes('aria-label="Breadcrumb"') &&
    productRoute.includes("detail.category.slug"),
);

check(
  "catálogo mostra filtros ativos removíveis e limpar tudo",
  products.includes("Filtros ativos") &&
    products.includes("removeFilter") &&
    products.includes("Limpar tudo") &&
    products.includes("activeFilters.map"),
);

check(
  "facetas mostram contagem e filtros ficam sticky no desktop",
  filters.includes("item.count") &&
    products.includes("sticky top-32") &&
    products.includes("max-h-[calc(100vh-9rem)]") &&
    products.includes('side="bottom"'),
);

check(
  "cards têm hierarquia comercial, promoção, favorito e segunda imagem",
  card.includes("data-product-card") &&
    card.includes("discountPercent") &&
    card.includes("Preço por peça") &&
    card.includes("toggleFavorite") &&
    card.includes("hoverImageUrl") &&
    card.includes("md:group-hover:opacity-100"),
);

check(
  "RPC v3 foi estendida sem criar nova versão pública desnecessária",
  migration.includes("CREATE OR REPLACE FUNCTION public.catalog_products_page_v3") &&
    migration.includes("image_hover_storage_key") &&
    migration.includes("hover_storage_key") &&
    catalog.includes("image_hover_storage_key") &&
    catalog.includes("hoverImageUrl") &&
    catalogHook.includes('"catalog_products_page_v3"') &&
    !catalogHook.includes("catalog_products_page_v4"),
);

check(
  "favoritos persistem sem apagar dados antes da hidratação",
  favorites.includes("FAVORITES_STORAGE_KEY") &&
    favorites.includes("hydrated") &&
    favorites.includes("if (!hydrated") &&
    favoriteRoute.includes("Nenhum favorito ainda") &&
    root.includes("<FavoritesProvider>"),
);

check(
  "bloco de compra fica sticky no desktop e opções ganham alvo forte",
  productSeo.includes('section[aria-labelledby="product-title"]') &&
    productSeo.includes("position: sticky") &&
    productSeo.includes("min-height: 3rem") &&
    productSeo.includes("fieldset + fieldset") &&
    productRoute.includes("<fieldset key={option.id}>"),
);

check(
  "entrega pelo CEP comunica prazo total e benefícios próximos da compra",
  shipping.includes("Entrega para o seu CEP") &&
    shipping.includes("Previsão total:") &&
    shipping.includes("Compra segura") &&
    shipping.includes("Pedido acompanhado") &&
    shipping.includes("Prazo pelo seu CEP"),
);

check(
  "mini carrinho abre após adicionar e oferece continuar ou ir ao carrinho",
  cartContext.includes("setCartDrawerOpen(true)") &&
    cartContext.includes("cartDrawerOpen") &&
    root.includes("<MiniCartDrawer />") &&
    miniCart.includes("Ir para o carrinho") &&
    miniCart.includes("Continuar comprando") &&
    miniCart.includes("discount.nextTier"),
);

check(
  "carrinho mantém resumo sticky e comunica próximo desconto",
  cart.includes("lg:sticky lg:top-32") &&
    cart.includes("discount.nextTier.unitsRemaining") &&
    cart.includes("Resumo do pedido") &&
    cart.includes("Continuar comprando"),
);

check(
  "checkout segue foco transacional sem header completo da vitrine",
  checkout.includes("Compra protegida") &&
    !checkout.includes("<Header />") &&
    checkout.includes("Resumo") &&
    checkout.includes("formatTotalDeliveryLabel"),
);

check(
  "retorno do pagamento mantém confirmação do pedido sem afirmar pagamento antes do webhook",
  checkoutLib.includes("LAST_CHECKOUT_STORAGE_KEY") &&
    checkoutLib.includes("storeLastCheckoutSnapshot(payload)") &&
    account.includes("Pedido recebido") &&
    /a\s+confirmação pode levar alguns instantes/.test(account) &&
    account.includes("Acompanhar pedido") &&
    account.includes('to="/conta/pedidos/$orderNumber"'),
);

check(
  "estados vazios e skeletons são úteis e coerentes",
  products.includes("Nenhum produto por aqui") &&
    favoriteRoute.includes("Nenhum favorito ainda") &&
    miniCart.includes("Seu carrinho está vazio") &&
    grid.includes("ProductCardSkeleton") &&
    header.includes("animate-pulse") &&
    account.includes("animate-pulse"),
);

check(
  "áreas transacionais priorizam superfícies sólidas e espaço em branco",
  shipping.includes("border border-gray-200 bg-white") &&
    cart.includes("bg-white") &&
    checkout.includes("bg-white") &&
    products.includes("gap-9") &&
    grid.includes("gap-y-10") &&
    !miniCart.includes("glass-panel"),
);

check(
  "deploy futuro conhece a etapa quatro sem publicar Hostinger",
  deploy.includes("conversion_ux_stage_4") &&
    deployWorkflow.includes("20260908210500_conversion_ux_stage_4.sql") &&
    deploy.includes("catalog_v3_rpc"),
);

console.log(`\n${passed}/${passed + failed} validações da Etapa 4 aprovadas.`);
if (failed > 0) process.exit(1);
