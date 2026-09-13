import fs from "node:fs";

const migration = fs.readFileSync(
  "supabase/migrations/20260913174500_financial_dashboard.sql",
  "utf8",
);
const component = fs.readFileSync("src/components/admin/FinancialAdmin.tsx", "utf8");
const financeLib = fs.readFileSync("src/lib/admin-finance.ts", "utf8");
const adminRoute = fs.readFileSync("src/routes/admin.tsx", "utf8");

function requireText(source, needle, label) {
  if (!source.includes(needle)) {
    console.error(`FINANCE_VALIDATION_MISSING: ${label}`);
    process.exit(10);
  }
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    console.error(`FINANCE_VALIDATION_FAILED: ${label}. expected=${expected} actual=${actual}`);
    process.exit(11);
  }
}

function profitCents(
  saleCents,
  costCents,
  addOnRevenueCents = 0,
  addOnCostCents = 0,
  discountCents = 0,
  quantity = 1,
) {
  return (saleCents + addOnRevenueCents - costCents - addOnCostCents) * quantity - discountCents;
}

function share5Cents(profit) {
  return Math.round((profit * 500) / 10000);
}

// Cenários monetários centrais em centavos, sem aritmética de ponto flutuante.
assertEqual(profitCents(18490, 7500), 10990, "Torcedor: lucro unitário");
assertEqual(share5Cents(10990), 550, "5% de R$ 109,90 arredonda para R$ 5,50");
assertEqual(profitCents(18490, 7500, 2500, 1500), 11990, "Nome + Número");
assertEqual(profitCents(18490, 7500, 1500, 500), 11990, "Patch");
assertEqual(profitCents(18490, 7500, 4500, 3000), 12490, "Frase personalizada");
assertEqual(profitCents(18490, 7500, 0, 0, 0, 3), 32970, "Múltiplas unidades");
assertEqual(share5Cents(1000000), 50000, "5% de R$ 10.000,00");

requireText(migration, "capture_order_item_financial_snapshot", "trigger de snapshot");
requireText(migration, "protect_order_item_financial_snapshot", "imutabilidade do snapshot");
requireText(migration, "financial_snapshot_version", "versão de snapshot");
requireText(migration, "unit_product_cost_snapshot", "snapshot do custo do produto");
requireText(migration, "add_on_cost_snapshot", "snapshot do custo dos adicionais");
requireText(migration, "line_discount_snapshot", "snapshot de desconto");
requireText(migration, "line_profit_snapshot", "snapshot de lucro");
requireText(migration, "payment_status = 'paid'", "somente pedidos pagos");
requireText(migration, "'canceled'::public.order_status", "exclusão de cancelados");
requireText(migration, "'refunded'::public.order_status", "exclusão de reembolsados");
requireText(migration, "round(totals.profit * 500 / 10000, 2)", "participação de 5% sobre lucro");
requireText(migration, "public.has_role('owner'::public.app_role)", "proteção owner");
requireText(
  migration,
  "REVOKE ALL ON TABLE public.finance_settings FROM PUBLIC, anon, authenticated",
  "custos não públicos",
);
requireText(
  migration,
  "ON CONFLICT (product_id) DO NOTHING",
  "seed sem sobrescrever configuração existente",
);
requireText(migration, "BEFORE INSERT ON public.order_items", "snapshot somente em novos itens");

for (const period of ["today", "7d", "30d", "month", "previous_month", "year"]) {
  requireText(migration, `WHEN '${period}'`, `filtro ${period}`);
}

requireText(component, "Participação sobre o lucro", "card de participação");
requireText(component, "5% do lucro do período — nunca do faturamento.", "regra visual dos 5%");
requireText(component, "Faturamento x lucro", "gráfico financeiro");
requireText(component, "Por que deu este lucro?", "composição do lucro");
requireText(
  component,
  "Esta alteração será aplicada somente às novas compras",
  "aviso de snapshot",
);
requireText(component, "Produtos", "ranking por produto");
requireText(component, "Categorias", "ranking por categoria");
requireText(financeLib, "owner_get_financial_dashboard", "RPC do dashboard");
requireText(financeLib, "owner_save_product_finance", "RPC de custo do produto");
requireText(adminRoute, 'id: "finance"', "navegação Financeiro");
requireText(adminRoute, "<FinancialAdmin", "renderização Financeiro");

console.log("FINANCIAL_DASHBOARD_VALIDATION_OK");
