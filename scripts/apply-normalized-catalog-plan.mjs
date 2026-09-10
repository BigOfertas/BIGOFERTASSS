import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const MAX_STAGE_CHUNK_BYTES = 240_000;

function parseArgs(argv) {
  const out = { plan: "", stock: 999 };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--plan") out.plan = argv[++index];
    else if (arg === "--stock") out.stock = Number.parseInt(argv[++index], 10);
    else throw new Error(`Opção desconhecida: ${arg}`);
  }
  if (!out.plan) throw new Error("Use --plan.");
  if (!Number.isInteger(out.stock) || out.stock < 0 || out.stock > 1_000_000) {
    throw new Error("Estoque técnico inválido.");
  }
  return out;
}

function dollarQuote(value) {
  let tag = "catalog_payload";
  while (value.includes(`$${tag}$`)) tag += "_x";
  return `$${tag}$${value}$${tag}$`;
}

function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function slugify(value) {
  return String(value ?? "catalog")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 36);
}

function splitProducts(products, maxBytes) {
  const chunks = [];
  let current = [];
  let currentBytes = 2;

  for (const product of products) {
    const encoded = JSON.stringify(product);
    const encodedBytes = Buffer.byteLength(encoded, "utf8") + 1;
    if (encodedBytes > maxBytes) {
      throw new Error(`Produto excede limite seguro de staging (${encodedBytes} bytes).`);
    }
    if (current.length > 0 && currentBytes + encodedBytes > maxBytes) {
      chunks.push(current);
      current = [];
      currentBytes = 2;
    }
    current.push(product);
    currentBytes += encodedBytes;
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

const options = parseArgs(process.argv.slice(2));
const projectRef = String(process.env.SUPABASE_PROJECT_ID ?? "").trim();
const accessToken = String(process.env.SUPABASE_ACCESS_TOKEN ?? "").trim();
if (!projectRef || !accessToken) {
  throw new Error("SUPABASE_PROJECT_ID e SUPABASE_ACCESS_TOKEN são obrigatórios.");
}

const plan = JSON.parse(fs.readFileSync(path.resolve(options.plan), "utf8"));
if (!Array.isArray(plan.products) || plan.products.length === 0) throw new Error("Plano vazio.");
const payloadObject = {
  schemaVersion: plan.schemaVersion ?? 1,
  batchKey: plan.batchKey,
  sourceAlbumUrl: plan.sourceAlbumUrl,
  products: plan.products,
};
const payload = JSON.stringify(payloadObject);
const digest = crypto.createHash("sha256").update(payload).digest("hex").slice(0, 12);
const migrationName = `catalog_batch_${slugify(plan.batchKey)}_${digest}`;
const stageKey = `catalog-stage-${digest}`;
const apiBase = `https://api.supabase.com/v1/projects/${encodeURIComponent(projectRef)}`;
const headers = {
  authorization: `Bearer ${accessToken}`,
  accept: "application/json",
  "content-type": "application/json",
};

async function request(endpoint, init = {}) {
  const response = await fetch(`${apiBase}${endpoint}`, {
    ...init,
    headers: { ...headers, ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(180_000),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${endpoint} HTTP ${response.status}: ${text.slice(0, 2500)}`);
  }
  return text ? JSON.parse(text) : null;
}

async function applyMigration(name, query, historyNames) {
  if (historyNames.has(name)) {
    console.log(`CATALOG_MIGRATION_ALREADY_APPLIED migration=${name}`);
    return;
  }
  await request("/database/migrations", {
    method: "POST",
    body: JSON.stringify({ name, query }),
  });
  historyNames.add(name);
  console.log(`CATALOG_MIGRATION_APPLIED migration=${name}`);
}

const history = await request("/database/migrations");
const historyNames = new Set(Array.isArray(history) ? history.map((item) => item?.name).filter(Boolean) : []);
if (historyNames.has(migrationName)) {
  console.log(`CATALOG_BATCH_ALREADY_APPLIED migration=${migrationName}`);
  process.exit(0);
}

const directQuery = `
  select public.catalog_apply_normalized_batch(
    ${dollarQuote(payload)}::jsonb,
    false,
    true,
    ${options.stock}
  );
`;
const directBodyBytes = Buffer.byteLength(JSON.stringify({ name: migrationName, query: directQuery }), "utf8");

if (directBodyBytes <= MAX_STAGE_CHUNK_BYTES) {
  await applyMigration(migrationName, directQuery, historyNames);
  console.log(`CATALOG_BATCH_APPLIED migration=${migrationName} mode=direct products=${plan.products.length}`);
  process.exit(0);
}

const chunks = splitProducts(plan.products, MAX_STAGE_CHUNK_BYTES);
const initMigration = `catalog_stage_init_${digest}`;
const initQuery = `
  create table if not exists public.catalog_import_staging (
    stage_key text not null,
    chunk_index integer not null,
    products jsonb not null,
    created_at timestamptz not null default now(),
    primary key (stage_key, chunk_index)
  );
  revoke all on table public.catalog_import_staging from public, anon, authenticated;
  grant all on table public.catalog_import_staging to service_role;
  delete from public.catalog_import_staging where stage_key = ${sqlLiteral(stageKey)};
`;
await applyMigration(initMigration, initQuery, historyNames);

for (let index = 0; index < chunks.length; index += 1) {
  const chunkJson = JSON.stringify(chunks[index]);
  const chunkMigration = `catalog_stage_${digest}_${String(index + 1).padStart(3, "0")}`;
  const chunkQuery = `
    insert into public.catalog_import_staging(stage_key, chunk_index, products)
    values (${sqlLiteral(stageKey)}, ${index}, ${dollarQuote(chunkJson)}::jsonb)
    on conflict (stage_key, chunk_index) do update
      set products = excluded.products,
          created_at = now();
  `;
  await applyMigration(chunkMigration, chunkQuery, historyNames);
}

const headerPayload = JSON.stringify({
  schemaVersion: payloadObject.schemaVersion,
  batchKey: payloadObject.batchKey,
  sourceAlbumUrl: payloadObject.sourceAlbumUrl,
});
const finalQuery = `
  do $catalog_atomic_apply$
  declare
    v_products jsonb;
    v_payload jsonb;
  begin
    select coalesce(
      jsonb_agg(item.value order by staged.chunk_index, item.ordinality),
      '[]'::jsonb
    )
    into v_products
    from public.catalog_import_staging staged
    cross join lateral jsonb_array_elements(staged.products)
      with ordinality as item(value, ordinality)
    where staged.stage_key = ${sqlLiteral(stageKey)};

    if jsonb_array_length(v_products) <> ${plan.products.length} then
      raise exception 'Staging incompleto: esperado %, encontrado %',
        ${plan.products.length}, jsonb_array_length(v_products);
    end if;

    v_payload := jsonb_set(
      ${dollarQuote(headerPayload)}::jsonb,
      '{products}',
      v_products,
      true
    );

    perform public.catalog_apply_normalized_batch(
      v_payload,
      false,
      true,
      ${options.stock}
    );

    delete from public.catalog_import_staging where stage_key = ${sqlLiteral(stageKey)};
  end
  $catalog_atomic_apply$;
`;
await applyMigration(migrationName, finalQuery, historyNames);
console.log(
  `CATALOG_BATCH_APPLIED migration=${migrationName} mode=staged-atomic chunks=${chunks.length} products=${plan.products.length}`,
);
