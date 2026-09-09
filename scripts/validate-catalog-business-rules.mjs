import fs from "node:fs";
import assert from "node:assert/strict";
import {
  CATALOG_SIZES,
  COMMERCIAL_TYPE_PRICES,
  PERSONALIZATION_RULES,
  buildCatalogBusinessProfile,
  inferCommercialType,
  inferPurchasePatches,
  inferUniform,
} from "./catalog-business-rules.mjs";

assert.deepEqual(CATALOG_SIZES, ["P", "M", "G", "GG", "2GG", "3GG", "4XL"]);
assert.deepEqual(COMMERCIAL_TYPE_PRICES, {
  torcedor: 184.9,
  feminino: 184.9,
  jogador: 219.9,
  retro: 219.9,
  infantil: 169.9,
  calcao: 159.9,
  basquete: 229.9,
});
assert.deepEqual(PERSONALIZATION_RULES, {
  normalPrice: 25,
  normalNameMax: 12,
  phrasePrice: 45,
  phraseMax: 50,
  patchPrice: 15,
});

const cases = [
  ["CAMISA I VASCO 26/27 ADIDAS", "torcedor", 184.9],
  ["CAMISA I FEMININA VASCO 26/27 ADIDAS", "feminino", 184.9],
  ["CAMISA I PLAYER VASCO 26/27 ADIDAS", "jogador", 219.9],
  ["CAMISA RETRO VASCO 1998", "retro", 219.9],
  ["KIT INFANTIL VASCO 26/27", "infantil", 169.9],
  ["CALCAO VASCO 26/27", "calcao", 159.9],
  ["CAMISA BASQUETE LAKERS NBA", "basquete", 229.9],
];
for (const [name, expectedType, expectedPrice] of cases) {
  assert.equal(inferCommercialType({ name }), expectedType, name);
  assert.equal(buildCatalogBusinessProfile({ name }).price, expectedPrice, name);
}

assert.deepEqual(inferUniform("CAMISA I VASCO 26/27 ADIDAS"), {
  model: "I",
  label: "Primeiro uniforme",
});
assert.deepEqual(inferUniform("CAMISA II VASCO 26/27 ADIDAS"), {
  model: "II",
  label: "Segundo uniforme",
});
assert.deepEqual(inferUniform("CAMISA III VASCO 26/27 ADIDAS"), {
  model: "III",
  label: "Terceiro uniforme",
});
assert.equal(
  buildCatalogBusinessProfile({ name: "CAMISA II VASCO 26/27 ADIDAS" }).specifications,
  "Uniforme: Segundo uniforme",
);

const vascoPatches = inferPurchasePatches({
  name: "CAMISA I VASCO 26/27 ADIDAS",
  competition: "BRASILEIRÃO",
  team: "VASCO",
});
assert.deepEqual(
  vascoPatches.map((patch) => patch.code),
  ["brasileirao", "libertadores", "sul-americana", "copa-do-brasil", "mundial-de-clubes"],
);

const purchaseUi = fs.readFileSync("src/components/product/ProductPurchaseOptions.tsx", "utf8");
assert.match(purchaseUi, /config\.phraseEnabled && !normalEnabled/);
assert.match(purchaseUi, /nome e número/);

const purchaseLib = fs.readFileSync("src/lib/product-purchase.ts", "utf8");
assert.match(purchaseLib, /frase personalizada não pode conter números/i);

const importer = fs.readFileSync("scripts/catalog-import-zip.mjs", "utf8");
assert.match(importer, /catalog-business-rules\.mjs/);
assert.match(importer, /owner_save_product_purchase_settings_v2/);
assert.match(importer, /owner_catalog_import_set_specifications/);
assert.match(importer, /owner_catalog_import_set_variant_price/);

const assimilator = fs.readFileSync("scripts/google-photos-assimilator.mjs", "utf8");
assert.match(assimilator, /catalog-business-rules\.mjs/);
assert.match(assimilator, /commercialType/);
assert.match(assimilator, /proposal\.price/);
assert.match(assimilator, /uniform/);

const migration = fs.readFileSync(
  "supabase/migrations/20260909130000_catalog_business_rules.sql",
  "utf8",
);
for (const value of ["184.90", "219.90", "169.90", "159.90", "229.90", "25.00", "45.00", "15.00"]) {
  assert.ok(migration.includes(value), `migration missing ${value}`);
}
assert.match(migration, /frase personalizada não pode conter números/i);
assert.match(migration, /owner_catalog_import_set_variant_price/);

console.log("CATALOG_BUSINESS_RULES_VALIDATION_OK");
