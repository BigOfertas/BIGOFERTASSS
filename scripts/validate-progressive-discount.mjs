import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const pricing = read("src/lib/progressive-discount.ts");
const cart = read("src/routes/cart.tsx");
const shipping = read("src/components/cart/ShippingCalculator.tsx");
const footer = read("src/components/layout/Footer.tsx");
const migration = read(
  "supabase/migrations/20260902153000_progressive_discount_and_free_shipping.sql",
);

const checks = [
  [
    "tiers progressivos exatos no frontend",
    [
      "minimumUnits: 5, percent: 5",
      "minimumUnits: 10, percent: 10",
      "minimumUnits: 15, percent: 15",
      "minimumUnits: 30, percent: 20",
      "minimumUnits: 45, percent: 35, freeShipping: true",
    ].every((token) => pricing.includes(token)),
  ],
  [
    "carrinho aplica desconto e frete gratis sem alterar preco unitario",
    cart.includes("getProgressiveDiscount(totalItems, totalPrice)") &&
      cart.includes("discount.subtotalAfterDiscount") &&
      cart.includes("discount.freeShipping") &&
      cart.includes("Cotação absorvida pela BIGofertas"),
  ],
  [
    "cotacao real continua visivel na faixa de frete gratis",
    shipping.includes("freeShipping") &&
      shipping.includes("line-through") &&
      shipping.includes("quote.totalPrice"),
  ],
  [
    "backend ignora desconto informado pelo caller",
    migration.includes("PERFORM p_discount_amount") &&
      migration.includes("bigofertas_progressive_discount_percent(total_units_value)"),
  ],
  [
    "backend implementa exatamente os cinco degraus",
    [
      "WHEN p_units >= 45 THEN 35",
      "WHEN p_units >= 30 THEN 20",
      "WHEN p_units >= 15 THEN 15",
      "WHEN p_units >= 10 THEN 10",
      "WHEN p_units >= 5 THEN 5",
    ].every((token) => migration.includes(token)),
  ],
  [
    "frete gratis preserva custo operacional em snapshot separado do valor cobrado",
    migration.includes("shipping_discount_amount") &&
      migration.includes("shipping_discount_value := shipping_base_value + shipping_additional_value") &&
      migration.includes("shipping_total_value := 0"),
  ],
  [
    "create_order_core continua restrita ao service role",
    migration.includes(
      "GRANT EXECUTE ON FUNCTION public.create_order_core(uuid, uuid, jsonb, jsonb, jsonb, numeric, text) TO service_role",
    ) &&
      !migration.includes(
        "GRANT EXECUTE ON FUNCTION public.create_order_core(uuid, uuid, jsonb, jsonb, jsonb, numeric, text) TO authenticated",
      ),
  ],
  [
    "rodape mostra pagamentos e seguranca sem Reclame Aqui ou selo Google inventado",
    footer.includes("Formas de pagamento") &&
      footer.includes("Site seguro") &&
      footer.includes("INFINITEPAY") &&
      footer.includes("HTTPS ativo") &&
      !/reclame\s*aqui/i.test(footer) &&
      !/google\s*site\s*seguro/i.test(footer),
  ],
];

let failed = 0;
for (const [label, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"} ${label}`);
  if (!ok) failed += 1;
}

if (failed > 0) {
  console.error(`\n${failed} validação(ões) falharam.`);
  process.exit(1);
}

console.log(`\n${checks.length}/${checks.length} validações passaram.`);
