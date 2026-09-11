import fs from "node:fs";

const projectRef = process.env.SUPABASE_PROJECT_ID?.trim();
const accessToken = process.env.SUPABASE_ACCESS_TOKEN?.trim();
const migrationName = "remove_generic_product_description_sentence_20260911";
const migrationFile =
  "supabase/migrations/20260911102000_remove_generic_product_description_sentence.sql";

if (!projectRef || !accessToken) {
  console.error("Product description cleanup deployment is missing required CI configuration.");
  process.exit(2);
}

const apiBase = `https://api.supabase.com/v1/projects/${encodeURIComponent(projectRef)}`;
const headers = {
  authorization: `Bearer ${accessToken}`,
  accept: "application/json",
  "content-type": "application/json",
};

function migrationSql(file) {
  return fs
    .readFileSync(file, "utf8")
    .replace(/^\s*BEGIN;\s*/i, "")
    .replace(/\s*COMMIT;\s*$/i, "")
    .trim();
}

async function readHistory() {
  const response = await fetch(`${apiBase}/database/migrations`, {
    headers,
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`MIGRATION_HISTORY_HTTP_${response.status}`);
  const payload = await response.json();
  return Array.isArray(payload) ? payload : [];
}

async function readOnly(query) {
  const response = await fetch(`${apiBase}/database/query/read-only`, {
    method: "POST",
    headers,
    body: JSON.stringify({ query }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`READ_ONLY_QUERY_HTTP_${response.status}`);
  const payload = await response.json();
  return Array.isArray(payload) ? payload[0] : payload;
}

async function applyMigration() {
  const response = await fetch(`${apiBase}/database/migrations`, {
    method: "POST",
    headers,
    body: JSON.stringify({ name: migrationName, query: migrationSql(migrationFile) }),
    signal: AbortSignal.timeout(120_000),
  });
  const text = await response.text();
  if (!response.ok) {
    console.error(`Migration ${migrationName} failed with HTTP ${response.status}.`);
    if (text) console.error(text.slice(0, 3000));
    process.exit(10);
  }
  console.log(`Applied ${migrationName}.`);
}

const history = await readHistory();
const alreadyApplied = history.some((item) => item?.name === migrationName);
if (alreadyApplied) console.log(`Already applied: ${migrationName}.`);
else await applyMigration();

const verification = await readOnly(`
select
  count(*)::integer as total_products,
  count(*) filter (
    where description ~* 'Disponível com as opções( de tamanho e personalização)? configuradas pela (BIGofertas|DropBox)\\.'
  )::integer as descriptions_with_forbidden_sentence,
  exists (
    select 1
    from pg_catalog.pg_trigger t
    join pg_catalog.pg_class c on c.oid = t.tgrelid
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'products'
      and t.tgname = 'clean_product_description_before_write'
      and not t.tgisinternal
  ) as cleanup_trigger_live
from public.products;
`);

console.log("PRODUCT_DESCRIPTION_CLEANUP_VERIFICATION");
console.log(JSON.stringify(verification, null, 2));

if (
  !verification ||
  verification.descriptions_with_forbidden_sentence !== 0 ||
  verification.cleanup_trigger_live !== true
) {
  console.error("Product description cleanup verification failed.");
  process.exit(11);
}

console.log("All product descriptions are clean and future writes are protected.");
