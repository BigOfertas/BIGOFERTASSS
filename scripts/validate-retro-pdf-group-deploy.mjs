import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(file, "utf8");
const manifest = JSON.parse(read("catalog-jobs/pdf-groups/retro.json"));
const workflow = read(".github/workflows/catalog-pdf-group-deploy.yml");
const normalizer = read("scripts/catalog-retro-plan.mjs");
const merger = read("scripts/catalog-merge-plans.mjs");
const applier = read("scripts/apply-normalized-catalog-plan.mjs");
const guard = read("scripts/catalog-retro-production-guard.mjs");

assert.equal(manifest.enabled, true, "Retro production request must be enabled for this deployment");
assert.equal(manifest.reset_catalog, false, "Retro deployment must never reset the catalog");
assert.equal(manifest.category?.slug, "retro");
assert.equal(manifest.commercial_type, "retro");
assert.equal(Number(manifest.price), 219.9);
assert.equal(manifest.albums?.length, 30, "PDF Retro section must contain 30 album buckets");
assert.equal(new Set(manifest.albums.map((album) => album.url)).size, 30);
for (const album of manifest.albums) {
  assert.match(album.url, /^https:\/\/photos\.google\.com\/share\//);
}

for (const token of [
  "max-parallel: 6",
  "google-photos-collector.mjs",
  "google-photos-assimilator-runner.mjs",
  "catalog-retro-plan.mjs",
  "catalog-merge-plans.mjs",
  "apply-normalized-catalog-plan.mjs",
  "catalog-retro-production-guard.mjs",
  "catalog-batch-public-verify.mjs",
  "--launch-count 10",
]) {
  assert.ok(workflow.includes(token), `Retro workflow missing ${token}`);
}
assert.doesNotMatch(workflow, /--reset\b/);
assert.match(normalizer, /slug: "retro"/);
assert.match(normalizer, /RETRO_PRICE = 219\.9/);
assert.match(normalizer, /patches: \[\]/);
assert.match(merger, /merged\.summary\.albums !== 30/);
assert.match(applier, /catalog_apply_normalized_batch/);
assert.match(applier, /false,\n\s+true,/);
assert.match(guard, /active_launch_count/);
assert.match(guard, /Códigos P do lote retrô não são consecutivos/);
assert.match(guard, /commercial_type = 'retro'/);

console.log("RETRO_PDF_GROUP_DEPLOY_VALIDATION_OK");
