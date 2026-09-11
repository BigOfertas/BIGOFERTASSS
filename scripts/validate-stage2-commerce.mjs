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
const migration = read(
  "supabase/migrations/20260911051000_stage2_purchase_customization_policy.sql",
);

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
    migration.includes("CREATE OR REPLACE FUNCTION public.enforce_product_purchase_customization_policy") &&
    migration.includes("CREATE TRIGGER enforce_product_purchase_customization_policy"),
);

check(
  "migration preserva patches dos não-Shorts sem inventar compatibilidade",
  migration.includes("ELSE patches") &&
    !migration.includes("UPDATE public.products") &&
    !migration.includes("DELETE FROM public.products"),
);

console.log(`\nSTAGE2_COMMERCE_VALIDATION passed=${passed} failed=${failed}`);
if (failed > 0) process.exit(1);
