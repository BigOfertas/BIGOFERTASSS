import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const pricing = read("src/lib/progressive-discount.ts");
const cart = read("src/routes/cart.tsx");
const shipping = read("src/components/cart/ShippingCalculator.tsx");
const footer = read("src/components/layout/Footer.tsx");
const baseMigration = read(
  "supabase/migrations/20260902153000_progressive_discount_and_free_shipping.sql",
);
const revisionMigration = read(
  "supabase/migrations/20260902154500_progressive_discount_revision.sql",
);

const checks = [
  [
    "tiers progressivos vigentes no frontend",
    [
      "minimumUnits: 5, percent: 5, freeShipping: false",
      "minimumUnits: 8, percent: 10, freeShipping: true",
      "minimumUnits: 15, percent: 15, freeShipping: true",
      "minimumUnits: 25, percent: 20, freeShipping: true",
      "minimumUnits: 35, percent: 30, freeShipping: true",
    ].every((token) => pricing.includes(token)),
  ],
  [
    "carrinho aplica desconto e frete gratis sem alterar preco unitario",
    cart.includes("getProgressiveDiscount(totalItems, totalPrice)") &&
      cart.includes("discount.subtotalAfterDiscount") &&
      cart.includes("const shippingAmount = discount.freeShipping") &&
      cart.includes("freeShipping={discount.freeShipping}") &&
      cart.includes("currency.format(item.unitPrice)"),
  ],
  [
    "cotacao real continua visivel na faixa de frete gratis",
    shipping.includes("freeShipping") &&
      shipping.includes("line-through") &&
      shipping.includes("quote.totalPrice") &&
      shipping.includes("Cotação absorvida pela BIGofertas"),
  ],
  [
    "backend base ignora desconto informado pelo caller",
    baseMigration.includes("PERFORM p_discount_amount") &&
      baseMigration.includes("bigofertas_progressive_discount_percent(total_units_value)"),
  ],
  [
    "backend vigente implementa exatamente os cinco degraus revisados",
    [
      "WHEN p_units >= 35 THEN 30",
      "WHEN p_units >= 25 THEN 20",
      "WHEN p_units >= 15 THEN 15",
      "WHEN p_units >= 8 THEN 10",
      "WHEN p_units >= 5 THEN 5",
    ].every((token) => revisionMigration.includes(token)) &&
      revisionMigration.includes("CHECK (discount_percent IN (0, 5, 10, 15, 20, 30))"),
  ],
  [
    "frete gratis vale para todas as faixas a partir de 8 pecas",
    revisionMigration.includes("IF NEW.discount_percent >= 10 THEN") &&
      revisionMigration.includes("shipping_discount_amount := NEW.shipping_base_amount + NEW.shipping_additional_amount") &&
      revisionMigration.includes("NEW.shipping_amount := 0"),
  ],
  [
    "frete gratis preserva custo operacional em snapshot separado do valor cobrado",
    baseMigration.includes("shipping_discount_amount") &&
      revisionMigration.includes("NEW.shipping_base_amount + NEW.shipping_additional_amount") &&
      revisionMigration.includes("NEW.total_amount := NEW.subtotal_amount - NEW.discount_amount + NEW.shipping_amount"),
  ],
  [
    "create_order_core continua restrita ao service role",
    baseMigration.includes(
      "GRANT EXECUTE ON FUNCTION public.create_order_core(uuid, uuid, jsonb, jsonb, jsonb, numeric, text) TO service_role",
    ) &&
      !baseMigration.includes(
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
