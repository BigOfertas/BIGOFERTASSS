import fs from "node:fs";

const migration = fs.readFileSync("supabase/migrations/20260904190000_product_purchase_options.sql", "utf8");
const productPage = fs.readFileSync("src/routes/product/$id.tsx", "utf8");
const cart = fs.readFileSync("src/lib/cart.ts", "utf8");
const checkout = fs.readFileSync("supabase/functions/checkout-start/index.ts", "utf8");
const admin = fs.readFileSync("src/components/admin/ProductPurchaseAdmin.tsx", "utf8");
const checks = [
  ["tamanhos fixos sem acrescimo", migration.includes("ARRAY['P','M','G','GG','2GG','3GG','4XL']")],
  ["personalizacao normal 25 e frase 45", migration.includes("DEFAULT 25.00") && migration.includes("DEFAULT 45.00")],
  ["patch padrao 15", migration.includes("DEFAULT 15.00")],
  ["precos por modelo", ["184.90","219.90","169.90","159.90","229.90"].every((value) => migration.includes(value))],
  ["servidor recalcula adicionais", migration.includes("resolve_product_purchase_customization") && migration.includes("base_unit_price_value + surcharge_value")],
  ["carrinho diferencia personalizacoes", cart.includes("customizationFingerprint") && cart.includes("customization: item.customization")],
  ["checkout envia personalizacao", checkout.includes("customization: item.customization")],
  ["pagina mostra controles", productPage.includes("ProductPurchaseOptions") && productPage.includes("validatePurchaseCustomization")],
  ["admin geral e individual", admin.includes("Regras gerais") && admin.includes("Configuração individual por produto")],
];
let failed = 0;
for (const [label, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"} - ${label}`);
  if (!ok) failed += 1;
}
if (failed) process.exit(1);
