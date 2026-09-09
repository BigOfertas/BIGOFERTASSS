import fs from "node:fs";
import assert from "node:assert/strict";
import {
  CATALOG_SIZES,
  COMMERCIAL_TYPE_PRICES,
  PATCH_CATALOG,
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

const patchCodes = (product) => inferPurchasePatches(product).map((patch) => patch.code);
const hasAll = (actual, expected, label) => {
  for (const code of expected) assert.ok(actual.includes(code), `${label} missing ${code}`);
};
const hasNone = (actual, forbidden, label) => {
  for (const code of forbidden) assert.ok(!actual.includes(code), `${label} must not include ${code}`);
};

const vasco = patchCodes({ name: "CAMISA I VASCO 26/27 ADIDAS", team: "VASCO" });
hasAll(
  vasco,
  ["brasileirao", "libertadores", "sul-americana", "copa-do-brasil", "mundial-de-clubes"],
  "Vasco",
);

const manCity = patchCodes({
  name: "CAMISA II MANCHESTER CITY 26/27 PUMA",
  league: "Premier League",
});
hasAll(manCity, ["premier-league", "fa-cup", "champions-league", "mundial-de-clubes"], "Man City");
hasNone(manCity, ["europa-league", "conference-league", "brasileirao"], "Man City");

const chelsea = patchCodes({ name: "CAMISA I CHELSEA 26/27 NIKE", league: "Premier League" });
hasAll(chelsea, ["premier-league", "fa-cup", "mundial-de-clubes", "fifa-club-world-champions"], "Chelsea");
hasNone(chelsea, ["champions-league", "europa-league", "conference-league"], "Chelsea");

const arsenal = patchCodes({ name: "CAMISA I ARSENAL 26/27 ADIDAS", league: "Premier League" });
hasAll(arsenal, ["premier-league", "premier-league-champions", "fa-cup", "champions-league"], "Arsenal");

const barcelona = patchCodes({ name: "CAMISA II BARCELONA 26/27 NIKE", league: "LaLiga" });
hasAll(barcelona, ["laliga", "copa-del-rey", "champions-league"], "Barcelona");

const milan = patchCodes({ name: "CAMISA II MILAN 26/27 PUMA", league: "Serie A Italia" });
hasAll(milan, ["serie-a", "coppa-italia", "europa-league"], "Milan");
hasNone(milan, ["champions-league", "mundial-de-clubes"], "Milan");

const lyon = patchCodes({ name: "CAMISA II LYON 26/27 ADIDAS", league: "Ligue 1" });
hasAll(lyon, ["ligue-1", "coupe-de-france", "europa-league"], "Lyon");

const benfica = patchCodes({ name: "CAMISA I BENFICA 26/27 ADIDAS", league: "Liga Portugal" });
hasAll(benfica, ["liga-portugal", "taca-de-portugal", "europa-league", "mundial-de-clubes"], "Benfica");

const argentinaClub = patchCodes({ name: "CAMISA I RIVER PLATE 26/27 ADIDAS" });
hasAll(
  argentinaClub,
  ["liga-profesional-argentina", "copa-argentina", "libertadores", "sul-americana", "mundial-de-clubes"],
  "River Plate",
);

const interMiami = patchCodes({ name: "CAMISA I INTER MIAMI 26/27 ADIDAS", league: "MLS" });
hasAll(interMiami, ["mls", "leagues-cup", "concacaf-champions-cup", "mundial-de-clubes"], "Inter Miami");

const nationalCases = [
  [{ name: "CAMISA I BRASIL 26/27 NIKE", selecao: "Brasil" }, ["fifa-world-cup-2026", "copa-america"], []],
  [
    { name: "CAMISA I ESPANHA 26/27 ADIDAS", selecao: "Espanha" },
    ["fifa-world-cup-2026", "fifa-world-champions", "euro", "uefa-nations-league"],
    [],
  ],
  [
    { name: "CAMISA I ITALIA 26/27 ADIDAS", selecao: "Itália" },
    ["euro", "uefa-nations-league"],
    ["fifa-world-cup-2026"],
  ],
  [{ name: "CAMISA I AFRICA DO SUL 26/27 ADIDAS", selecao: "África do Sul" }, ["fifa-world-cup-2026", "afcon"], []],
  [{ name: "CAMISA I JAPAO 26/27 ADIDAS", selecao: "Japão" }, ["fifa-world-cup-2026", "afc-asian-cup"], []],
  [{ name: "CAMISA I NOVA ZELANDIA 26/27 NIKE", selecao: "Nova Zelândia" }, ["fifa-world-cup-2026", "ofc-nations-cup"], []],
  [
    { name: "CAMISA I JAMAICA 26/27 ADIDAS", selecao: "Jamaica" },
    ["concacaf-gold-cup", "concacaf-nations-league"],
    ["fifa-world-cup-2026"],
  ],
];
for (const [product, expected, forbidden] of nationalCases) {
  const actual = patchCodes(product);
  hasAll(actual, expected, product.name);
  hasNone(actual, forbidden, product.name);
}

assert.deepEqual(patchCodes({ name: "CAMISA RETRO VASCO 1998" }), []);
assert.deepEqual(patchCodes({ name: "CAMISA RETRO VASCO 1998 LIBERTADORES" }), ["libertadores"]);
assert.deepEqual(patchCodes({ name: "CALCAO MANCHESTER CITY 26/27" }), []);
assert.deepEqual(patchCodes({ name: "CONJUNTO TREINO BARCELONA 26/27" }), []);
assert.deepEqual(patchCodes({ name: "CORTA VENTO PSG 26/27" }), []);
assert.deepEqual(patchCodes({ name: "CAMISA BASQUETE LAKERS NBA" }), []);

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

const businessMigration = fs.readFileSync(
  "supabase/migrations/20260909130000_catalog_business_rules.sql",
  "utf8",
);
for (const value of ["184.90", "219.90", "169.90", "159.90", "229.90", "25.00", "45.00", "15.00"]) {
  assert.ok(businessMigration.includes(value), `business migration missing ${value}`);
}
assert.match(businessMigration, /frase personalizada não pode conter números/i);
assert.match(businessMigration, /owner_catalog_import_set_variant_price/);

const patchMigration = fs.readFileSync(
  "supabase/migrations/20260909143000_global_patch_matrix.sql",
  "utf8",
);
for (const code of [
  "brasileirao",
  "premier-league",
  "laliga",
  "serie-a",
  "bundesliga",
  "ligue-1",
  "mls",
  "champions-league",
  "europa-league",
  "conference-league",
  "fifa-world-cup-2026",
  "euro",
  "copa-america",
  "afcon",
  "afc-asian-cup",
  "concacaf-gold-cup",
  "ofc-nations-cup",
]) {
  assert.ok(patchMigration.includes(`\"code\":\"${code}\"`), `patch migration missing ${code}`);
}
assert.ok(PATCH_CATALOG.length >= 45, "global patch catalog unexpectedly small");

console.log("CATALOG_BUSINESS_RULES_VALIDATION_OK");
