import fs from "node:fs";

const projectRef = process.env.SUPABASE_PROJECT_ID?.trim();
const accessToken = process.env.SUPABASE_ACCESS_TOKEN?.trim();
const migrationName = "catalog_filter_key_canonical_20260910";
const migrationFile = "supabase/migrations/20260910043000_catalog_filter_key_canonical.sql";

if (!projectRef || !accessToken) {
  console.error("Catalog filter-key deployment is missing required CI configuration.");
  process.exit(2);
}

const apiBase = `https://api.supabase.com/v1/projects/${encodeURIComponent(projectRef)}`;
const headers = {
  authorization: `Bearer ${accessToken}`,
  accept: "application/json",
  "content-type": "application/json",
};

function migrationSql() {
  return fs
    .readFileSync(migrationFile, "utf8")
    .replace(/^\s*BEGIN;\s*/i, "")
    .replace(/\s*COMMIT;\s*$/i, "")
    .trim();
}

async function request(path, init = {}, timeout = 120_000) {
  const response = await fetch(`${apiBase}${path}`, {
    ...init,
    headers: { ...headers, ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(timeout),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${path} HTTP ${response.status}: ${text.slice(0, 2500)}`);
  }
  return text ? JSON.parse(text) : null;
}

const history = await request("/database/migrations", {}, 30_000);
const alreadyApplied =
  Array.isArray(history) && history.some((item) => item?.name === migrationName);

if (!alreadyApplied) {
  console.log(`Applying ${migrationName}...`);
  await request("/database/migrations", {
    method: "POST",
    body: JSON.stringify({ name: migrationName, query: migrationSql() }),
  });
  console.log(`Applied ${migrationName}.`);
} else {
  console.log(`Already applied: ${migrationName}.`);
}

const verificationPayload = await request(
  "/database/query/read-only",
  {
    method: "POST",
    body: JSON.stringify({
      query: `
        select
          public.catalog_filter_key('Real Madrid') = 'real-madrid' as real_madrid_key_ok,
          public.catalog_filter_key('Manchester United') = 'manchester-united' as manchester_united_key_ok,
          public.catalog_filter_key('São Paulo') = 'sao-paulo' as sao_paulo_key_ok,
          public.catalog_filter_key('Premier League') = 'premier-league' as premier_league_key_ok,
          not exists (
            select 1
            from public.products
            where campeonato_key ~ '[[:space:]]'
               or liga_key ~ '[[:space:]]'
               or time_key ~ '[[:space:]]'
               or season_key ~ '[[:space:]]'
               or brand_key ~ '[[:space:]]'
               or audience_key ~ '[[:space:]]'
          ) as product_keys_without_spaces,
          not exists (
            select 1
            from public.catalog_taxonomy_items
            where slug ~ '[[:space:]]'
          ) as taxonomy_keys_without_spaces;
      `,
    }),
  },
  30_000,
);

const verification = Array.isArray(verificationPayload)
  ? verificationPayload[0]
  : verificationPayload;

console.log("CATALOG_FILTER_KEY_VERIFICATION");
console.log(JSON.stringify(verification, null, 2));

const required = [
  "real_madrid_key_ok",
  "manchester_united_key_ok",
  "sao_paulo_key_ok",
  "premier_league_key_ok",
  "product_keys_without_spaces",
  "taxonomy_keys_without_spaces",
];

if (!required.every((key) => verification?.[key] === true)) {
  throw new Error("Canonical catalog filter-key verification failed.");
}

console.log("CATALOG_FILTER_KEY_BACKEND_OK");
