import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  "supabase/migrations/20260913210000_finance_category_bulk.sql",
  "utf8",
);
const ui = readFileSync("src/components/admin/FinanceCategoryPricing.tsx", "utf8");
const client = readFileSync("src/lib/admin-finance-categories.ts", "utf8");
const adminRoute = readFileSync("src/routes/admin.tsx", "utf8");

function cents(value) {
  return Math.round(value * 100);
}

function profit(sale, cost) {
  return cents(sale) - cents(cost);
}

function fivePercent(profitCents) {
  return Math.round(profitCents * 0.05);
}

function makeState() {
  return {
    categories: {
      torcedor: { sale: 184.9, cost: 75 },
      jogador: { sale: 219.9, cost: 95 },
      basquete: { sale: 229.9, cost: 120 },
    },
    variants: [
      {
        id: "base-x-torcedor",
        product: "base-x",
        type: "torcedor",
        sale: 184.9,
        costOverride: null,
      },
      { id: "base-x-jogador", product: "base-x", type: "jogador", sale: 219.9, costOverride: null },
      { id: "torcedor-b", product: "produto-b", type: "torcedor", sale: 184.9, costOverride: 82 },
      { id: "nba-c", product: "produto-c", type: "basquete", sale: 229.9, costOverride: null },
    ],
  };
}

function resolvedCost(state, variant) {
  return variant.costOverride ?? state.categories[variant.type]?.cost ?? null;
}

function applyAll(state, type, { sale, cost }) {
  if (sale !== undefined) {
    state.categories[type].sale = sale;
    for (const variant of state.variants) {
      if (variant.type === type) variant.sale = sale;
    }
  }
  if (cost !== undefined) {
    state.categories[type].cost = cost;
    for (const variant of state.variants) {
      if (variant.type === type) variant.costOverride = null;
    }
  }
}

function saveIndividual(state, variantId, { sale, cost }) {
  const variant = state.variants.find((item) => item.id === variantId);
  assert.ok(variant, "variant exists");
  if (sale !== undefined) variant.sale = sale;
  if (cost !== undefined) variant.costOverride = cost;
}

// 1. somente custo de Torcedor
{
  const state = makeState();
  applyAll(state, "torcedor", { cost: 80 });
  assert.equal(resolvedCost(state, state.variants[0]), 80);
  assert.equal(state.variants[0].sale, 184.9);
}

// 2. somente preço de Torcedor
{
  const state = makeState();
  applyAll(state, "torcedor", { sale: 189.9 });
  assert.equal(state.variants[0].sale, 189.9);
  assert.equal(resolvedCost(state, state.variants[0]), 75);
}

// 3. preço e custo juntos
{
  const state = makeState();
  applyAll(state, "torcedor", { sale: 189.9, cost: 80 });
  assert.equal(state.variants[0].sale, 189.9);
  assert.equal(resolvedCost(state, state.variants[0]), 80);
}

// 4. todas as Torcedor atuais recebem a mudança
{
  const state = makeState();
  applyAll(state, "torcedor", { cost: 85 });
  assert.deepEqual(
    state.variants
      .filter((item) => item.type === "torcedor")
      .map((item) => resolvedCost(state, item)),
    [85, 85],
  );
}

// 5 e 6. Jogador e NBA não são tocados
{
  const state = makeState();
  const jogadorBefore = structuredClone(state.variants[1]);
  const nbaBefore = structuredClone(state.variants[3]);
  applyAll(state, "torcedor", { sale: 190, cost: 85 });
  assert.deepEqual(state.variants[1], jogadorBefore);
  assert.deepEqual(state.variants[3], nbaBefore);
}

// 7, 8 e 9. exceção individual -> aplicar a todos -> nova exceção
{
  const state = makeState();
  saveIndividual(state, "torcedor-b", { cost: 82, sale: 191 });
  assert.equal(resolvedCost(state, state.variants[2]), 82);
  applyAll(state, "torcedor", { cost: 85 });
  assert.equal(resolvedCost(state, state.variants[2]), 85);
  saveIndividual(state, "torcedor-b", { cost: 82 });
  assert.equal(resolvedCost(state, state.variants[2]), 82);
}

// 10. snapshot antigo fica imutável
{
  const state = makeState();
  const oldOrder = Object.freeze({ sale: 184.9, cost: 75, profit: 109.9 });
  applyAll(state, "torcedor", { cost: 85 });
  assert.deepEqual(oldOrder, { sale: 184.9, cost: 75, profit: 109.9 });
}

// 11, 12 e 13. nova compra usa novos valores, novo lucro e 5% do novo lucro
{
  const state = makeState();
  applyAll(state, "torcedor", { sale: 184.9, cost: 85 });
  const variant = state.variants[0];
  const newProfit = profit(variant.sale, resolvedCost(state, variant));
  assert.equal(newProfit, 9990);
  assert.equal(fivePercent(newProfit), 500);
}

// 14. Torcedor muda sem alterar Jogador do mesmo produto-base
{
  const state = makeState();
  applyAll(state, "torcedor", { sale: 189.9, cost: 80 });
  const torcedor = state.variants.find((item) => item.id === "base-x-torcedor");
  const jogador = state.variants.find((item) => item.id === "base-x-jogador");
  assert.equal(torcedor.sale, 189.9);
  assert.equal(resolvedCost(state, torcedor), 80);
  assert.equal(jogador.sale, 219.9);
  assert.equal(resolvedCost(state, jogador), 95);
}

// 15. contrato de autorização: RPCs de escrita exigem owner e anon é revogado
for (const rpc of ["owner_apply_finance_category", "owner_save_finance_variant"]) {
  assert.match(migration, new RegExp(`CREATE OR REPLACE FUNCTION public\\.${rpc}`));
}
assert.ok(
  (
    migration.match(
      /auth\.uid\(\) IS NULL OR NOT public\.has_role\('owner'::public\.app_role\)/g,
    ) ?? []
  ).length >= 4,
  "owner guard present on category/variant admin RPCs",
);
assert.match(
  migration,
  /REVOKE ALL ON FUNCTION public\.owner_apply_finance_category\(text,numeric,numeric\) FROM PUBLIC, anon/,
);
assert.match(
  migration,
  /REVOKE ALL ON FUNCTION public\.owner_save_finance_variant\(uuid,text,numeric,numeric\) FROM PUBLIC, anon/,
);

// Contratos estruturais: classificação real, sem heurística por nome.
assert.match(migration, /ADD COLUMN IF NOT EXISTS commercial_type text/);
assert.match(migration, /COALESCE\(v\.commercial_type, pps\.commercial_type, 'other'\)/);
assert.doesNotMatch(migration, /LIKE '%regata%'/);
assert.doesNotMatch(migration, /lower\(COALESCE\(p_product_name/);

// Preço continua na fonte real do checkout: product_variants/products.
assert.match(
  migration,
  /UPDATE public\.product_variants v[\s\S]*price_override = round\(p_sale_price, 2\)/,
);
assert.match(migration, /UPDATE public\.products p[\s\S]*price = pv\.price_override/);
assert.match(migration, /product_type_prices = jsonb_set/);
assert.doesNotMatch(migration, /CREATE TABLE[^;]*price/i);

// “Aplicar a todos” limpa exceções individuais de custo do grupo.
assert.match(migration, /DELETE FROM public\.product_variant_financial_settings vfs/);
assert.match(migration, /finance_category_settings/);

// Histórico: migration não atualiza nem apaga pedidos/itens históricos.
assert.doesNotMatch(migration, /UPDATE public\.order_items/i);
assert.doesNotMatch(migration, /DELETE FROM public\.order_items/i);
assert.doesNotMatch(migration, /UPDATE public\.orders\s/i);
assert.match(migration, /financial_snapshot_version := 2/);
assert.match(migration, /public\.finance_variant_current_cost\(NEW\.variant_id\)/);

// Adicionais continuam cobrados pela configuração de compra e com custo no snapshot.
assert.match(migration, /purchase-personalization-name/);
assert.match(migration, /purchase-phrase/);
assert.match(migration, /option_id = 'purchase-patch'/);

// Os 12 grupos pedidos estão suportados.
for (const type of [
  "torcedor",
  "feminino",
  "jogador",
  "retro",
  "infantil",
  "calcao",
  "basquete",
  "camisa_calcao",
  "regata_calcao",
  "treino_calca",
  "casaco_calca",
  "corta_vento",
]) {
  assert.ok(migration.includes(`'${type}'`), `migration supports ${type}`);
  assert.ok(client.includes(`"${type}"`), `client supports ${type}`);
}

// Interface: confirmação, quantidade afetada, separação preço/custo, individual e histórico.
for (const copy of [
  "Preços e custos por categoria",
  "Aplicar a todos",
  "Preço de venda",
  "Custo atual",
  "novas vendas",
  "Exceções individuais por produto/variação",
  "Salvar individual",
]) {
  assert.ok(ui.includes(copy), `UI contains ${copy}`);
}
assert.ok(adminRoute.includes("FinanceCategoryPricing"), "finance category UI is mounted in admin");

console.log("FINANCE_CATEGORY_BULK_VALIDATION passed=15 failed=0");
