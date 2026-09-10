import fs from "node:fs";
import path from "node:path";

const clean = (value) => String(value ?? "").trim();

function parseArgs(argv) {
  const out = { mode: "", snapshot: "", plan: "", out: "" };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "snapshot" || arg === "verify") out.mode = arg;
    else if (arg === "--snapshot") out.snapshot = argv[++index];
    else if (arg === "--plan") out.plan = argv[++index];
    else if (arg === "--out") out.out = argv[++index];
    else throw new Error(`Opção desconhecida: ${arg}`);
  }
  if (!out.mode) throw new Error("Use snapshot ou verify.");
  return out;
}

const options = parseArgs(process.argv.slice(2));
const projectRef = clean(process.env.SUPABASE_PROJECT_ID);
const accessToken = clean(process.env.SUPABASE_ACCESS_TOKEN);
if (!projectRef || !accessToken) {
  throw new Error("SUPABASE_PROJECT_ID e SUPABASE_ACCESS_TOKEN são obrigatórios.");
}

const apiBase = `https://api.supabase.com/v1/projects/${encodeURIComponent(projectRef)}`;
const headers = {
  authorization: `Bearer ${accessToken}`,
  accept: "application/json",
  "content-type": "application/json",
};

async function request(query) {
  const response = await fetch(`${apiBase}/database/query/read-only`, {
    method: "POST",
    headers,
    body: JSON.stringify({ query }),
    signal: AbortSignal.timeout(120_000),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Supabase HTTP ${response.status}: ${text.slice(0, 2000)}`);
  return text ? JSON.parse(text) : [];
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

async function protectedState() {
  const rows = await request(`
    select
      (select count(*)::int from public.orders) as orders,
      (select count(*)::int from public.order_items) as order_items,
      (select count(*)::int from public.profiles) as profiles,
      (select count(*)::int from public.affiliates) as affiliates;
  `);
  if (!Array.isArray(rows) || !rows[0]) throw new Error("Não foi possível ler o estado protegido.");
  return rows[0];
}

if (options.mode === "snapshot") {
  const target = options.out || ".artifacts/catalog-batch/protected-state-before.json";
  const state = await protectedState();
  writeJson(target, state);
  console.log("CATALOG_BATCH_PROTECTED_SNAPSHOT");
  console.log(JSON.stringify(state));
  process.exit(0);
}

if (!options.snapshot || !options.plan) {
  throw new Error("verify exige --snapshot e --plan.");
}

const before = JSON.parse(fs.readFileSync(options.snapshot, "utf8"));
const plan = JSON.parse(fs.readFileSync(options.plan, "utf8"));
const products = Array.isArray(plan.products) ? plan.products : [];
if (products.length === 0) throw new Error("Plano do catálogo sem produtos.");

const sourceKeys = products.map((product) => clean(product.sourceKey));
if (sourceKeys.some((key) => !key)) throw new Error("Plano contém produto sem sourceKey.");
if (new Set(sourceKeys).size !== sourceKeys.length) throw new Error("Plano contém sourceKey duplicada.");

const plannedProducts = products.length;
const plannedVariants = products.reduce(
  (sum, product) => sum + (Array.isArray(product.variants) ? product.variants.length : 0),
  0,
);
const plannedImages = products.reduce(
  (sum, product) =>
    sum +
    (Array.isArray(product.variants)
      ? product.variants.reduce(
          (inner, variant) => inner + (Array.isArray(variant.images) ? variant.images.length : 0),
          0,
        )
      : 0),
  0,
);

const sourceArray = `ARRAY[${sourceKeys.map(sqlLiteral).join(",")}]::text[]`;
const verificationRows = await request(`
  with selected_products as (
    select p.*
    from public.products p
    where p.catalog_source_key = any(${sourceArray})
  )
  select
    (select count(*)::int from selected_products) as products,
    (select count(*)::int from selected_products where status::text = 'active') as active_products,
    (select count(distinct catalog_source_key)::int from selected_products) as distinct_source_keys,
    (select count(*)::int from selected_products where catalog_code is null) as missing_catalog_codes,
    (select count(distinct catalog_code)::int from selected_products) as distinct_catalog_codes,
    (select count(*)::int
       from public.product_variants v
       join selected_products p on p.id = v.product_id) as variants,
    (select count(*)::int
       from public.product_variants v
       join selected_products p on p.id = v.product_id
      where v.status::text = 'active') as active_variants,
    (select count(*)::int
       from public.product_images i
       join selected_products p on p.id = i.product_id
      where i.status::text = 'ready' and i.image_source = 'google_photos') as ready_google_images,
    (select min(catalog_code) from selected_products) as first_catalog_code,
    (select max(catalog_code) from selected_products) as last_catalog_code;
`);
const verification = verificationRows?.[0];
if (!verification) throw new Error("Verificação do lote não retornou resultado.");

const after = await protectedState();
for (const key of ["orders", "order_items", "profiles", "affiliates"]) {
  if (Number(before[key]) !== Number(after[key])) {
    throw new Error(`Estado protegido alterado em ${key}: ${before[key]} -> ${after[key]}`);
  }
}

const expected = {
  products: plannedProducts,
  active_products: plannedProducts,
  distinct_source_keys: plannedProducts,
  missing_catalog_codes: 0,
  distinct_catalog_codes: plannedProducts,
  variants: plannedVariants,
  active_variants: plannedVariants,
  ready_google_images: plannedImages,
};
for (const [key, value] of Object.entries(expected)) {
  if (Number(verification[key]) !== Number(value)) {
    throw new Error(`Verificação do lote falhou em ${key}: esperado ${value}, recebido ${verification[key]}`);
  }
}

const sampleRows = await request(`
  select
    p.id::text as id,
    p.slug,
    p.name,
    p.catalog_code,
    c.slug as category_slug
  from public.products p
  left join public.categories c on c.id = p.primary_category_id
  where p.catalog_source_key = any(${sourceArray})
  order by p.catalog_code asc;
`);

const sampleIndexes = [...new Set([0, Math.floor((sampleRows.length - 1) / 2), sampleRows.length - 1])]
  .filter((index) => index >= 0 && index < sampleRows.length);
const samples = sampleIndexes.map((index) => sampleRows[index]);

const result = {
  batchKey: plan.batchKey ?? null,
  sourceAlbumUrl: plan.sourceAlbumUrl ?? null,
  planned: { products: plannedProducts, variants: plannedVariants, images: plannedImages },
  database: verification,
  protectedBefore: before,
  protectedAfter: after,
  samples,
};
const target = options.out || ".artifacts/catalog-batch/verification.json";
writeJson(target, result);
console.log("CATALOG_BATCH_DB_VERIFICATION");
console.log(JSON.stringify(result, null, 2));
console.log(
  `CATALOG_BATCH_DB_OK products=${plannedProducts} variants=${plannedVariants} images=${plannedImages}`,
);
