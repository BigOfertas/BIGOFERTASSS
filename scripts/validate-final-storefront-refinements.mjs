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

const nav = read("src/components/layout/CategoryNav.tsx");
const root = read("src/routes/__root.tsx");
const migration = read("supabase/migrations/20260911114500_final_storefront_refinements.sql");
const deploy = read("scripts/deploy-final-storefront-refinements.mjs");
const backendWorkflow = read(".github/workflows/deploy-storefront-upgrades-backend.yml");

check(
  "cabeçalho possui seção FEMININO filtrada por tipo comercial e destaques",
  nav.includes('name: "FEMININO"') &&
    nav.includes('commercialType: "feminino"') &&
    nav.includes('sort: "featured"'),
);

check(
  "rodapé é adiado até a hidratação e não integra o shell inicial",
  root.includes("const [storefrontHydrated, setStorefrontHydrated] = useState(false)") &&
    root.includes("setStorefrontHydrated(true)") &&
    root.includes("storefrontHydrated && showStorefrontFooter"),
);

check(
  "Manchester City P002218 faz parte do reparo explícito de modelos",
  migration.includes("'P002218'") &&
    migration.includes("'Modelo'") &&
    migration.includes("'Modelo 1'") &&
    migration.includes("'Modelo 2'"),
);

check(
  "reparo cria duas variantes e associa as duas imagens a modelos distintos",
  migration.includes("INSERT INTO public.product_variant_values") &&
    migration.includes("target_code || '-MODEL-02'") &&
    migration.includes("SET variant_id = model_two_variant_id") &&
    migration.includes("ready_image_count <> 2"),
);

check(
  "reparo é limitado aos produtos infantis conhecidos e não inclui Shorts ou Corta-Vento",
  migration.includes("settings.commercial_type = 'infantil'") &&
    !migration.includes("'P000753'") &&
    !migration.includes("commercial_type = 'calcao'") &&
    !migration.includes("corta-vento"),
);

check(
  "Feminino possui ranking global de clubes famosos",
  migration.includes("IF commercial_key = 'feminino' THEN") &&
    migration.includes("WHEN 'real-madrid' THEN 1") &&
    migration.includes("WHEN 'manchester-united' THEN 3") &&
    migration.includes("WHEN 'flamengo' THEN 5") &&
    migration.includes("WHEN 'paris-saint-germain' THEN 15"),
);

check(
  "deploy final aplica migration de forma idempotente e verifica o produto alvo",
  deploy.includes('migrationName = "final_storefront_refinements_20260911"') &&
    deploy.includes("manchester_city_model_selector") &&
    deploy.includes("model_selectors_ready") &&
    deploy.includes("storefront_priority_present") &&
    deploy.includes("feminine_products_present"),
);

check(
  "pipeline de backend publica automaticamente o refinamento na main",
  backendWorkflow.includes("scripts/deploy-final-storefront-refinements.mjs") &&
    backendWorkflow.includes("20260911114500_final_storefront_refinements.sql") &&
    backendWorkflow.includes("Deploy final storefront refinements"),
);

console.log(`\nFINAL_STOREFRONT_REFINEMENTS passed=${passed} failed=${failed}`);
if (failed > 0) process.exit(1);
