import fs from "node:fs";

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

const card = read("src/components/product/ProductCard.tsx");
const quickAdd = read("src/components/product/ProductQuickAdd.tsx");
const register = read("src/routes/cadastro.tsx");
const purchase = read("src/lib/product-purchase.ts");
const catalog = read("src/lib/catalog.ts");
const productsRoute = read("src/routes/products.tsx");
const brazil = read("src/components/home/BrazilianProducts.tsx");
const leagues = read("src/components/home/ShopByLeague.tsx");
const deploy = read("scripts/deploy-storefront-upgrade-migrations.mjs");
const patchAudit = read("scripts/audit-stage2-patches.mjs");
const migration = read(
  "supabase/migrations/20260911051000_stage2_purchase_customization_policy.sql",
);
const priorityMigration = read("supabase/migrations/20260911054000_stage2_storefront_priority.sql");

check(
  "card possui ação direta de carrinho ao lado do preço",
  card.includes("<ProductQuickAdd") &&
    card.includes("items-end justify-between") &&
    card.includes("data-product-card"),
);

check(
  "quick add abre aba animada e carrega produto/configuração somente ao abrir",
  quickAdd.includes("<Popover") &&
    quickAdd.includes("data-product-quick-add-panel") &&
    quickAdd.includes("fetchProductDetail(productSlug || productId)") &&
    quickAdd.includes("fetchProductPurchaseConfig(productId)") &&
    quickAdd.includes("if (!open || data || loading) return"),
);

check(
  "quick add exige tamanho e adiciona variante real ao carrinho",
  quickAdd.includes("Escolha o tamanho") &&
    quickAdd.includes("data-product-quick-add-sizes") &&
    quickAdd.includes("validatePurchaseCustomization") &&
    quickAdd.includes("customizationToCartOptions") &&
    quickAdd.includes("addToCart({") &&
    quickAdd.includes("variantId: variant.id"),
);

check(
  "campo confirmar senha atualiza confirmPassword e não o toggle de visibilidade",
  register.includes("onChange={(event) => setConfirmPassword(event.target.value)}") &&
    !register.includes("onChange={(event) => setShowConfirmPassword(event.target.value)}"),
);

check(
  "frontend bloqueia personalização, frase e patches para Shorts/calção",
  purchase.includes('const isShorts = commercialType === "calcao"') &&
    purchase.includes("personalizationEnabled: !isShorts") &&
    purchase.includes("phraseEnabled: !isShorts") &&
    purchase.includes("patches: isShorts ? [] : patches"),
);

check(
  "validação rejeita personalização desativada em vez de aceitar payload antigo",
  purchase.includes("!config.personalizationEnabled && customization.personalization") &&
    purchase.includes("!config.phraseEnabled && customization.phrase") &&
    purchase.includes("Escolha apenas patches disponíveis para este produto"),
);

check(
  "migration incremental normaliza regra e instala proteção para futuras alterações",
  migration.includes("UPDATE public.product_purchase_settings") &&
    migration.includes("commercial_type <> 'calcao'") &&
    migration.includes("WHEN commercial_type = 'calcao' THEN '[]'::jsonb") &&
    migration.includes(
      "CREATE OR REPLACE FUNCTION public.enforce_product_purchase_customization_policy",
    ) &&
    migration.includes("CREATE TRIGGER enforce_product_purchase_customization_policy"),
);

check(
  "migration preserva patches dos não-Shorts sem inventar compatibilidade",
  migration.includes("ELSE patches") &&
    !migration.includes("UPDATE public.products") &&
    !migration.includes("DELETE FROM public.products"),
);

check(
  "catálogo oferece e usa Destaques como ordenação comercial padrão",
  catalog.includes('"featured"') &&
    catalog.includes('sort: query.sort ?? "featured"') &&
    productsRoute.includes('<option value="featured">Destaques</option>') &&
    productsRoute.includes('search.sort ?? "featured"'),
);

check(
  "home brasileira e ligas internacionais preservam prioridade do backend",
  brazil.includes('sort: "featured"') &&
    leagues.includes('sort: "featured"') &&
    !brazil.includes("Date.parse(right.created_at)") &&
    !leagues.includes("Date.parse(right.created_at)"),
);

check(
  "ranking cobre clubes brasileiros, internacionais, retrôs e uniformes principais",
  priorityMigration.includes("CREATE OR REPLACE FUNCTION public.storefront_product_priority") &&
    priorityMigration.includes("WHEN 'flamengo' THEN 1") &&
    priorityMigration.includes("WHEN 'real-madrid' THEN 1") &&
    priorityMigration.includes("WHEN 'manchester-united' THEN 1") &&
    priorityMigration.includes("commercial_key = 'retro'") &&
    priorityMigration.includes("camisa (torcedor |jogador |player )?i") &&
    priorityMigration.includes("prm.sort_key = 'featured'"),
);

check(
  "ranking não reescreve produtos nem descongela Corta-Vento",
  !priorityMigration.includes("UPDATE public.products") &&
    !priorityMigration.includes("DELETE FROM public.products") &&
    priorityMigration.includes("Corta-Vento permanece intocado"),
);

check(
  "deploy conhece a migration de prioridade comercial",
  deploy.includes("stage2_storefront_priority_20260911") &&
    deploy.includes("20260911054000_stage2_storefront_priority.sql"),
);

check(
  "auditoria de patches usa regras canônicas e ignora Corta-Vento congelado",
  patchAudit.includes("inferPurchasePatches") &&
    patchAudit.includes("frozenWindbreaker") &&
    patchAudit.includes('row.commercial_type === "calcao"') &&
    patchAudit.includes("PATCH_MISMATCH"),
);

console.log(`\nSTAGE2_COMMERCE_VALIDATION passed=${passed} failed=${failed}`);
if (failed > 0) process.exit(1);
