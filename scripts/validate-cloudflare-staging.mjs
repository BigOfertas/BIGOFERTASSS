import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const sourceConfigPath = path.join(root, "wrangler.jsonc");
const generatedConfigPath = path.join(root, ".output", "server", "wrangler.json");

assert.ok(
  fs.existsSync(sourceConfigPath),
  "Configuração versionada do Cloudflare ausente: wrangler.jsonc",
);

const sourceConfig = JSON.parse(fs.readFileSync(sourceConfigPath, "utf8"));
assert.equal(sourceConfig.name, "bigofertas-staging");
assert.equal(sourceConfig.compatibility_date, "2026-09-03");
assert.equal(sourceConfig.keep_vars, true);
assert.equal(sourceConfig.vars?.INFINITEPAY_HANDLE, "yan-saulo");

assert.ok(
  fs.existsSync(generatedConfigPath),
  "Build Cloudflare ausente. Execute `bun run build` antes do validador.",
);

const generatedConfig = JSON.parse(fs.readFileSync(generatedConfigPath, "utf8"));
assert.equal(generatedConfig.name, "bigofertas-staging");
assert.equal(generatedConfig.vars?.INFINITEPAY_HANDLE, "yan-saulo");
assert.equal(generatedConfig.main, "index.mjs");
assert.equal(generatedConfig.assets?.binding, "ASSETS");

console.log("PASS - Worker gerado aponta para bigofertas-staging");
console.log("PASS - InfiniteTag yan-saulo chega ao binding gerado pelo Nitro");
console.log("PASS - configuração mantém as demais variáveis remotas com keep_vars");
