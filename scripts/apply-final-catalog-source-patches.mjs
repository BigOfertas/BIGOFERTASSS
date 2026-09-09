import fs from "node:fs";

function read(file) {
  return fs.readFileSync(file, "utf8");
}

function write(file, value) {
  fs.writeFileSync(file, value, "utf8");
}

function replaceRequired(value, search, replacement, label) {
  if (!value.includes(search)) throw new Error(`Trecho não encontrado: ${label}`);
  return value.replace(search, replacement);
}

function replaceRegex(value, regex, replacement, label) {
  if (!regex.test(value)) throw new Error(`Padrão não encontrado: ${label}`);
  return value.replace(regex, replacement);
}

// 1. Matriz conservadora: competição continental depende de participação real da temporada.
{
  const file = "scripts/catalog-business-rules.mjs";
  let value = read(file);
  value = replaceRegex(
    value,
    /patches: \[\s*"brasileirao",[\s\S]*?\],\s*leagueMarkers: \["BRASILEIRAO"/,
    'patches: ["brasileirao", "copa-do-brasil"],\n    leagueMarkers: ["BRASILEIRAO"',
    "patches brasileiros domésticos",
  );
  value = replaceRegex(
    value,
    /patches: \["liga-profesional-argentina", "copa-argentina", "libertadores", "sul-americana"\],/,
    'patches: ["liga-profesional-argentina", "copa-argentina"],',
    "patches argentinos domésticos",
  );
  value = replaceRequired(
    value,
    'patches: ["mls", "leagues-cup", "concacaf-champions-cup"],',
    'patches: ["mls", "leagues-cup"],',
    "MLS",
  );
  value = replaceRequired(
    value,
    'patches: ["liga-mx", "leagues-cup", "concacaf-champions-cup"],',
    'patches: ["liga-mx", "leagues-cup"],',
    "Liga MX",
  );
  value = replaceRequired(
    value,
    'patches: ["saudi-pro-league", "kings-cup", "afc-champions-league-elite"],',
    'patches: ["saudi-pro-league", "kings-cup"],',
    "Saudi Pro League",
  );
  value = replaceRequired(
    value,
    'function currentSeason2627(source) {\n  return /\\b(26[/-]27|2026[/-]27|2026 27)\\b/.test(source);\n}',
    'function currentSeason2627(source) {\n  // 26/26 é preservado como título de origem do fornecedor (caso Napoli), mas pertence ao ciclo atual.\n  return /\\b(26[/-](?:26|27)|2026[/-]27|2026 27)\\b/.test(source);\n}',
    "temporada atual",
  );

  const continentalData = `const CONMEBOL_2026 = Object.freeze({
  libertadores: Object.freeze([
    "CORINTHIANS",
    "CRUZEIRO",
    "FLAMENGO",
    "FLUMINENSE",
    "MIRASSOL",
    "PALMEIRAS",
  ]),
  "sul-americana": Object.freeze([
    "ATLETICO MINEIRO",
    "BOTAFOGO",
    "GREMIO",
    "RB BRAGANTINO",
    "RED BULL BRAGANTINO",
    "SANTOS",
    "SAO PAULO",
    "VASCO",
  ]),
});

`;
  value = replaceRequired(
    value,
    "const CLUB_DOMESTIC_RULES = Object.freeze([",
    continentalData + "const CLUB_DOMESTIC_RULES = Object.freeze([",
    "dados CONMEBOL 2026",
  );

  const domesticFunction = `function inferDomesticClubPatches(source) {
  const codes = new Set();
  for (const rule of CLUB_DOMESTIC_RULES) {
    if (!anyAlias(source, rule.leagueMarkers) && !anyAlias(source, rule.clubs)) continue;
    for (const code of rule.patches) addPatch(codes, code);
  }
  return codes;
}`;
  const continentalFunction = `${domesticFunction}

function inferContinentalClubPatches(source) {
  const codes = new Set();
  if (!currentSeason2627(source)) return codes;

  if (anyAlias(source, CONMEBOL_2026.libertadores)) addPatch(codes, "libertadores");
  if (anyAlias(source, CONMEBOL_2026["sul-americana"])) addPatch(codes, "sul-americana");

  const uefaPatch = inferUefa2627Patch(source);
  if (uefaPatch) addPatch(codes, uefaPatch);
  return codes;
}`;
  value = replaceRequired(value, domesticFunction, continentalFunction, "inferência continental");

  value = replaceRegex(
    value,
    /function inferSpecialClubPatches\(source\) \{[\s\S]*?\n\}\n\nexport function inferCommercialType/,
    `function inferSpecialClubPatches(source) {
  const codes = new Set();
  if (currentSeason2627(source) && aliasInSource(source, "CHELSEA"))
    addPatch(codes, "fifa-club-world-champions");
  if (currentSeason2627(source) && aliasInSource(source, "ARSENAL"))
    addPatch(codes, "premier-league-champions");
  if (currentSeason2627(source) && anyAlias(source, ["PSG", "PARIS SAINT GERMAIN"]))
    addPatch(codes, "champions-league-titleholder");
  return codes;
}

function replaceCompetitionBadgeWithTitleholder(codes) {
  if (codes.has("champions-league-titleholder")) codes.delete("champions-league");
  if (codes.has("europa-league-titleholder")) codes.delete("europa-league");
  if (codes.has("conference-league-titleholder")) codes.delete("conference-league");
}

export function inferCommercialType`,
    "patches especiais",
  );

  value = replaceRegex(
    value,
    /export function inferPurchasePatches\(product\) \{[\s\S]*?\n\}\n\nexport function buildCatalogBusinessProfile/,
    `export function inferPurchasePatches(product) {
  const source = sourceText(product);
  if (NO_PATCH_PRODUCT.test(source)) return [];
  const explicit = explicitPatches(source);
  if (/\\bRETRO\\b/.test(source)) return finalizePatches(explicit);

  const national = identifyNationalTeam(source, product);
  if (national) {
    const codes = inferNationalPatches(source, national);
    for (const code of explicit) codes.add(code);
    replaceCompetitionBadgeWithTitleholder(codes);
    return finalizePatches(codes);
  }

  const codes = inferDomesticClubPatches(source);
  for (const code of inferContinentalClubPatches(source)) codes.add(code);
  for (const code of inferSpecialClubPatches(source)) codes.add(code);
  for (const code of explicit) codes.add(code);
  replaceCompetitionBadgeWithTitleholder(codes);
  return finalizePatches(codes);
}

export function buildCatalogBusinessProfile`,
    "inferPurchasePatches definitivo",
  );
  write(file, value);
}

// 2. Página de produto e admin usam URL externa quando houver.
{
  const file = "src/lib/product-detail.ts";
  let value = read(file);
  value = replaceRequired(
    value,
    '"storefront_product_detail_v1",',
    '"storefront_product_detail_v2",',
    "RPC detalhe v2",
  );
  write(file, value);
}

{
  const file = "src/components/admin/ProductImageAdmin.tsx";
  let value = read(file);
  value = replaceRequired(
    value,
    'import { buildR2PublicImageUrl } from "@/lib/product-images";',
    'import { getProductImageSourceUrl } from "@/lib/product-images";',
    "helper imagem admin",
  );
  value = replaceRequired(
    value,
    "const imageUrl = buildR2PublicImageUrl(image.storage_key);",
    "const imageUrl = getProductImageSourceUrl(image);",
    "preview imagem admin",
  );
  write(file, value);
}

// 3. SEO recebe a mesma imagem externa do detalhe público.
{
  const file = "cloudflare/hostinger-product-seo-worker.ts";
  let value = read(file);
  value = replaceRequired(
    value,
    "storefront_product_detail_v1",
    "storefront_product_detail_v2",
    "RPC SEO v2",
  );
  value = replaceRequired(
    value,
    "    card_storage_key?: string | null;\n    is_primary?: boolean;",
    "    card_storage_key?: string | null;\n    external_url?: string | null;\n    is_primary?: boolean;",
    "tipo imagem SEO",
  );
  value = replaceRequired(
    value,
    `  const imageKey = primary?.storage_key ?? primary?.card_storage_key ?? null;
  const image = imageKey
    ? \`${cleanBase(env.R2_PUBLIC_BASE_URL)}/\${encodeObjectKey(imageKey)}\`
    : null;`,
    `  const imageKey = primary?.storage_key ?? primary?.card_storage_key ?? null;
  const externalImage = primary?.external_url?.trim() || null;
  const image = externalImage ??
    (imageKey ? \`${cleanBase(env.R2_PUBLIC_BASE_URL)}/\${encodeObjectKey(imageKey)}\` : null);`,
    "imagem SEO externa",
  );
  write(file, value);
}

// 4. Normalizador: aliases comerciais e público final.
{
  const file = "scripts/google-photos-catalog-pipeline.mjs";
  let value = read(file);
  value = replaceRequired(
    value,
    'function titleCaseEntity(value) {\n  const upperWords = new Set(["PSG", "AC", "FC", "NBA", "EA7"]);',
    'function titleCaseEntity(value) {\n  const normalized = normalizeCatalogText(value);\n  if (["MAN. CITY", "MAN CITY"].includes(normalized)) return "Manchester City";\n  if (["PSG", "PARIS SAINT GERMAIN"].includes(normalized)) return "PSG";\n  const upperWords = new Set(["PSG", "AC", "FC", "NBA", "EA7"]);',
    "aliases do normalizador",
  );
  value = replaceRequired(
    value,
    'audience: normalizeCatalogText(proposed.audience || "adulto"),',
    'audience: normalizeCatalogText(proposed.audience) === "ADULTO" ? "MASCULINO" : normalizeCatalogText(proposed.audience || "MASCULINO"),',
    "público do normalizador",
  );
  write(file, value);
}

// 5. Deploy do Supabase passa a aplicar todas as migrations novas.
{
  const file = "scripts/deploy-storefront-upgrade-migrations.mjs";
  let value = read(file);
  value = replaceRequired(
    value,
    '  ["global_patch_matrix", "supabase/migrations/20260909143000_global_patch_matrix.sql"],\n];',
    '  ["global_patch_matrix", "supabase/migrations/20260909143000_global_patch_matrix.sql"],\n  ["google_photos_external_images", "supabase/migrations/20260909150000_google_photos_external_images.sql"],\n  ["multiple_purchase_patches", "supabase/migrations/20260909151000_multiple_purchase_patches.sql"],\n  ["google_photos_catalog_import", "supabase/migrations/20260909152000_google_photos_catalog_import.sql"],\n];',
    "lista de migrations",
  );
  value = replaceRequired(
    value,
    "  ) as global_patch_matrix;\n`);",
    `  ) as global_patch_matrix,
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'product_images' and column_name = 'external_url'
  ) as external_image_url_column,
  exists (
    select 1 from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'storefront_product_detail_v2'
  ) as product_detail_v2_rpc,
  exists (
    select 1 from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'catalog_apply_normalized_batch'
  ) as catalog_normalized_batch_rpc;
\`);`,
    "verificação backend final",
  );
  value = replaceRequired(
    value,
    '  "global_patch_matrix",\n];',
    '  "global_patch_matrix",\n  "external_image_url_column",\n  "product_detail_v2_rpc",\n  "catalog_normalized_batch_rpc",\n];',
    "required backend final",
  );
  write(file, value);
}

// 6. CI principal valida regras de negócio e pipeline novo antes do build/deploy.
{
  const file = ".github/workflows/validate-main.yml";
  let value = read(file);
  value = replaceRequired(
    value,
    "      - name: Validate storefront customer experience\n        run: node scripts/validate-storefront-upgrades.mjs",
    "      - name: Validate final catalog pipeline\n        run: node scripts/validate-catalog-business-rules.mjs && node scripts/validate-google-photos-final-pipeline.mjs\n\n      - name: Validate storefront customer experience\n        run: node scripts/validate-storefront-upgrades.mjs",
    "validação CI catálogo final",
  );
  write(file, value);
}

// 7. Validador antigo da mídia aceita a RPC v2 no detalhe.
{
  const file = "scripts/validate-storefront-media-stage3.mjs";
  let value = read(file);
  value = value.replaceAll('"storefront_product_detail_v1"', '"storefront_product_detail_v2"');
  write(file, value);
}

// Limpa arquivos temporários da etapa anterior de pesquisa/refino.
for (const file of [
  ".github/workflows/refine-global-patches.yml",
  "catalog-jobs/refine-global-patches.json",
  "catalog-jobs/format-catalog-business-rules.json",
]) {
  if (fs.existsSync(file)) fs.rmSync(file);
}

console.log("FINAL_CATALOG_SOURCE_PATCHES_APPLIED");
