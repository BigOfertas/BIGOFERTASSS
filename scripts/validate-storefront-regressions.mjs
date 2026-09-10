import fs from "node:fs";
import path from "node:path";

const read = (file) => fs.readFileSync(file, "utf8");
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

function routeFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? routeFiles(target) : [target];
  });
}

const root = read("src/routes/__root.tsx");
const products = read("src/routes/products.tsx");
const filterKey = read("src/lib/catalog-filter-key.ts");
const homeSelection = read("src/lib/home-product-selection.ts");
const leagues = read("src/components/home/ShopByLeague.tsx");
const brazilTeams = read("src/components/home/BrazilianTeams.tsx");
const brazilProducts = read("src/components/home/BrazilianProducts.tsx");
const carousel = read("src/components/product/ProductCarousel.tsx");
const index = read("src/routes/index.tsx");
const migration = read("supabase/migrations/20260910043000_catalog_filter_key_canonical.sql");
const backendWorkflow = read(".github/workflows/deploy-storefront-upgrades-backend.yml");

const footerBlock = root.match(/const FOOTER_ROUTES = new Set\(\[([\s\S]*?)\]\);/)?.[1] ?? "";
const footerRoutes = Array.from(footerBlock.matchAll(/"([^\"]+)"/g), (match) => match[1]);
const expectedFooterRoutes = [
  "/",
  "/products",
  "/privacidade",
  "/trocas-e-devolucoes",
  "/termos-de-compra",
  "/producao-e-envio",
  "/contato",
];
check(
  "rodapé fica somente em navegação pública e institucional",
  JSON.stringify(footerRoutes) === JSON.stringify(expectedFooterRoutes) &&
    root.includes('pathname.startsWith("/product/")'),
);
check(
  "fluxos privados e transacionais não recebem rodapé",
  [
    "/login",
    "/cadastro",
    "/esqueci-senha",
    "/redefinir-senha",
    "/conta",
    "/admin",
    "/cart",
    "/checkout",
  ].every((route) => !footerRoutes.includes(route)),
);
const routeFooterUsers = routeFiles("src/routes").filter(
  (file) => file !== "src/routes/__root.tsx" && /<Footer\b|import\s+Footer\b/.test(read(file)),
);
check("nenhuma rota injeta rodapé por conta própria", routeFooterUsers.length === 0);

check(
  "filtro de URL normaliza valores multi-palavra antes da validação",
  products.includes('from "@/lib/catalog-filter-key"') &&
    products.includes(".transform(toCatalogFilterKey)") &&
    products.includes(".catch({})") &&
    filterKey.includes('.replace(/[^a-z0-9]+/g, "-")'),
);
check(
  "banco usa a mesma chave canônica e corrige dados antigos",
  migration.includes("'[[:space:]]+'") &&
    migration.includes("UPDATE public.products") &&
    migration.includes("UPDATE public.catalog_taxonomy_items") &&
    migration.includes("'Real Madrid'") &&
    migration.includes("'Manchester United'"),
);
check(
  "correção de filtros será aplicada e verificada no backend",
  backendWorkflow.includes("deploy-catalog-filter-key-fix.mjs") &&
    backendWorkflow.includes("20260910043000_catalog_filter_key_canonical.sql"),
);

check(
  "Compre por liga consulta apenas Torcedor e Jogador",
  leagues.includes('commercialType: "torcedor"') &&
    leagues.includes('commercialType: "jogador"') &&
    leagues.includes("isStandardHomeJersey") &&
    !/useCatalogProducts\(\{\s*liga: displayLeague\.slug,\s*pageSize:/s.test(leagues),
);
check(
  "regra positiva da home aceita somente Camisa I II III nos tipos permitidos",
  homeSelection.includes('new Set(["torcedor", "jogador"])') &&
    homeSelection.includes("CAMISA") &&
    homeSelection.includes("I|II|III"),
);

check(
  "Encontre seu time contém o carrossel imediatamente após os escudos",
  brazilTeams.includes('import BrazilianProducts from "@/components/home/BrazilianProducts"') &&
    brazilTeams.indexOf("<BrazilianProducts />") > brazilTeams.indexOf("{teams.map") &&
    !index.includes('import BrazilianProducts from "@/components/home/BrazilianProducts"') &&
    !index.includes("<BrazilianProducts />"),
);
check(
  "carrossel brasileiro busca legado e taxonomia atual e diversifica times",
  brazilProducts.includes('campeonato: "brasileirao"') &&
    brazilProducts.includes('liga: "brasileirao"') &&
    brazilProducts.includes("selectVariedProducts") &&
    brazilProducts.includes("const SHOWCASE_SIZE = 15"),
);
check(
  "carrossel padrão mantém cinco cards por página e quinze itens geram três páginas",
  carousel.includes("const productsPerPage = 5") && 15 / 5 === 3,
);
check(
  "atalho do Atlético-MG usa a chave canônica do catálogo",
  brazilTeams.includes('{ id: "atletico-mineiro", name: "Atlético-MG"'),
);

console.log(`\nSTOREFRONT_REGRESSION_VALIDATION passed=${passed} failed=${failed}`);
if (failed > 0) process.exit(1);
