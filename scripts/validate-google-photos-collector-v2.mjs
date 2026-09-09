import assert from 'node:assert/strict';
import { validateAlbumUrl, mediaKey, highQualityUrl, looksLikeTitle } from './google-photos-collector-v2.mjs';
const u='https://lh3.googleusercontent.com/pw/ABC=w1445-h1445-s-no-gm?authuser=0';
assert.equal(mediaKey(u),'lh3.googleusercontent.com/pw/ABC');
assert.equal(highQualityUrl(u),'https://lh3.googleusercontent.com/pw/ABC=w4096-h4096-s-no-gm');
assert.equal(looksLikeTitle('CAMISA I CHELSEA 26/27 NIKE'),true);
assert.ok(validateAlbumUrl('https://photos.google.com/share/x?key=y'));
console.log('GOOGLE_PHOTOS_COLLECTOR_V2_VALIDATION_OK');
