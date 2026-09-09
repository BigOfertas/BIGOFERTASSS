import assert from "node:assert/strict";
import fs from "node:fs";
import { inferPurchasePatches } from "./catalog-business-rules.mjs";

const read = (file) => fs.readFileSync(file, "utf8");
const codes = (product) => inferPurchasePatches(product).map((patch) => patch.code);
const includesAll = (actual, expected, label) => {
  for (const code of expected) assert.ok(actual.includes(code), `${label} missing ${code}`);
};
const excludesAll = (actual, forbidden, label) => {
  for (const code of forbidden)
    assert.ok(!actual.includes(code), `${label} must not include ${code}`);
};

const externalMigration = read(
  "supabase/migrations/20260909150000_google_photos_external_images.sql",
);
for (const token of [
  "external_url text",
  "image_source text",
  "product_images_exactly_one_source",
  "googleusercontent",
  "catalog_products_page_v3",
  "storefront_product_detail_v2",
]) {
  assert.ok(externalMigration.includes(token), `external migration missing ${token}`);
}

const patchesMigration = read("supabase/migrations/20260909151000_multiple_purchase_patches.sql");
assert.match(patchesMigration, /patchCodes/);
assert.match(patchesMigration, /jsonb_array_elements_text\(requested_patch_codes\)/);
assert.match(patchesMigration, /surcharge := surcharge \+ patch_price/);

const importMigration = read("supabase/migrations/20260909152000_google_photos_catalog_import.sql");
for (const token of [
  "catalog_apply_normalized_batch",
  "p_reset_catalog",
  "catalog_source_key",
  "google_photos",
  "external_url",
  "P[0-9]{6}",
]) {
  assert.ok(importMigration.includes(token), `import migration missing ${token}`);
}

const pipeline = read("scripts/google-photos-catalog-pipeline.mjs");
assert.match(pipeline, /buildCatalogBusinessProfile/);
assert.match(pipeline, /highQualityUrl/);
assert.match(pipeline, /googleusercontent/);
assert.match(pipeline, /catalog_apply_normalized_batch/);
assert.match(pipeline, /--reset/);
assert.match(pipeline, /CATALOG_URL_VALIDATION_OK/);

const productImages = read("src/lib/product-images.ts");
assert.match(productImages, /external_url/);
assert.match(productImages, /getProductImageSourceUrl/);

const catalog = read("src/lib/catalog.ts");
assert.match(catalog, /image_external_url/);

const purchaseLib = read("src/lib/product-purchase.ts");
assert.match(purchaseLib, /patchCodes: string\[\]/);
assert.match(purchaseLib, /for \(const code of customization\.patchCodes\)/);

const purchaseUi = read("src/components/product/ProductPurchaseOptions.tsx");
assert.match(purchaseUi, /type="checkbox"/);
assert.match(purchaseUi, /patchCodes: next/);

const workflow = read(".github/workflows/google-photos-catalog-pipeline.yml");
assert.match(workflow, /workflow_dispatch/);
assert.match(workflow, /reset_catalog/);
assert.match(workflow, /google-photos-catalog-pipeline\.mjs/);

const vasco = codes({ name: "CAMISA I VASCO 26/27 ADIDAS", team: "Vasco", season: "26/27" });
includesAll(vasco, ["brasileirao", "copa-do-brasil", "sul-americana"], "Vasco 26/27");
excludesAll(vasco, ["libertadores", "mundial-de-clubes"], "Vasco 26/27");

const manCity = codes({
  name: "CAMISA II MANCHESTER CITY 26/27 PUMA",
  team: "Manchester City",
  season: "26/27",
});
includesAll(
  manCity,
  ["premier-league", "fa-cup", "champions-league", "uefa-campaign"],
  "Manchester City",
);
excludesAll(manCity, ["mundial-de-clubes", "fifa-club-world-champions"], "Manchester City");

const chelsea = codes({ name: "CAMISA I CHELSEA 26/27 NIKE", team: "Chelsea", season: "26/27" });
includesAll(chelsea, ["premier-league", "fa-cup", "fifa-club-world-champions"], "Chelsea");
excludesAll(chelsea, ["mundial-de-clubes", "champions-league"], "Chelsea");

const bayern = codes({ name: "CAMISA I BAYERN 26/27 ADIDAS", team: "Bayern", season: "26/27" });
includesAll(
  bayern,
  [
    "bundesliga",
    "dfb-pokal",
    "champions-league",
    "champions-league-multiple-winner",
    "uefa-campaign",
  ],
  "Bayern",
);

const barcelona = codes({
  name: "CAMISA II BARCELONA 26/27 NIKE",
  team: "Barcelona",
  season: "26/27",
});
includesAll(
  barcelona,
  [
    "laliga-champions",
    "copa-del-rey",
    "champions-league",
    "champions-league-multiple-winner",
    "uefa-campaign",
  ],
  "Barcelona",
);
excludesAll(barcelona, ["laliga"], "Barcelona champion");

const psg = codes({ name: "CAMISA I PSG 26/27 NIKE", team: "PSG", season: "26/27" });
includesAll(
  psg,
  ["ligue-1-champions", "coupe-de-france", "champions-league-titleholder", "uefa-campaign"],
  "PSG",
);
excludesAll(psg, ["ligue-1", "champions-league"], "PSG titleholder");

const lyon = codes({ name: "CAMISA II LYON 26/27 ADIDAS", team: "Lyon", season: "26/27" });
includesAll(lyon, ["ligue-1", "coupe-de-france", "europa-league", "uefa-campaign"], "Lyon");

const milan = codes({ name: "CAMISA II MILAN 26/27 PUMA", team: "Milan", season: "26/27" });
includesAll(milan, ["serie-a", "coppa-italia", "europa-league", "uefa-campaign"], "Milan");
excludesAll(milan, ["champions-league-multiple-winner"], "Milan outside UCL");

const napoli = codes({ name: "CAMISA I NAPOLI 26/26 EA7", team: "Napoli", season: "26/26" });
includesAll(
  napoli,
  ["serie-a", "coppa-italia", "champions-league", "uefa-campaign"],
  "Napoli 26/26 source title",
);

console.log("GOOGLE_PHOTOS_FINAL_CATALOG_PIPELINE_OK");
