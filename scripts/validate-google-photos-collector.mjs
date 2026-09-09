import assert from "node:assert/strict";
import {
  groupImagesByTitles,
  highQualityGoogleImageUrl,
  isGoogleImageUrl,
  looksLikeCatalogTitle,
  mediaKeyFromUrl,
  validateGooglePhotosUrl,
} from "./google-photos-collector.mjs";

const direct = "https://lh3.googleusercontent.com/pw/ABC123=w1445-h1445-s-no-gm?authuser=0";
assert.equal(isGoogleImageUrl(direct), true);
assert.equal(mediaKeyFromUrl(direct), "lh3.googleusercontent.com/pw/ABC123");
assert.equal(
  highQualityGoogleImageUrl(direct),
  "https://lh3.googleusercontent.com/pw/ABC123=w4096-h4096-s-no-gm",
);
assert.equal(looksLikeCatalogTitle("CAMISA I CHELSEA 26/27 NIKE"), true);
assert.equal(looksLikeCatalogTitle("CAMISA I PLAYER CHELSEA 26/27 NIKE"), true);
assert.equal(looksLikeCatalogTitle("Google Photos"), false);
assert.ok(validateGooglePhotosUrl("https://photos.google.com/share/abc?key=123").startsWith("https://photos.google.com/"));
assert.throws(() => validateGooglePhotosUrl("https://example.com/album"));

const titles = [
  { text: "CAMISA I CHELSEA 26/27 NIKE", top: 100, left: 0 },
  { text: "CAMISA II CHELSEA 26/27 NIKE", top: 500, left: 0 },
];
const images = [
  { mediaKey: "a", top: 200, left: 10 },
  { mediaKey: "b", top: 300, left: 10 },
  { mediaKey: "c", top: 600, left: 10 },
];
const grouped = groupImagesByTitles(images, titles);
assert.equal(grouped.groups.length, 2);
assert.deepEqual(grouped.groups.map((group) => group.images.length), [2, 1]);
assert.equal(grouped.ungrouped.length, 0);

console.log("GOOGLE_PHOTOS_COLLECTOR_VALIDATION_OK");
