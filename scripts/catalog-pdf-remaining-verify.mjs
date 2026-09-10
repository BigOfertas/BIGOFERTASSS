import fs from "node:fs";
import path from "node:path";

function parseArgs(argv) {
  const out = { snapshot: "", root: "", output: "" };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--snapshot") out.snapshot = argv[++index];
    else if (arg === "--root") out.root = argv[++index];
    else if (arg === "--output") out.output = argv[++index];
    else throw new Error(`Opção desconhecida: ${arg}`);
  }
  if (!out.snapshot || !out.root || !out.output) {
    throw new Error("Use --snapshot, --root e --output.");
  }
  return out;
}

function clean(value) {
  return String(value ?? "").trim();
}

function walkJson(root) {
  if (!fs.existsSync(root)) return [];
  const files = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...walkJson(full));
    else if (entry.isFile() && entry.name.endsWith(".json")) files.push(full);
  }
  return files.sort();
}

function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

const options = parseArgs(process.argv.slice(2));
const before = JSON.parse(fs.readFileSync(path.resolve(options.snapshot), "utf8"));
const files = walkJson(path.resolve(options.root));
const plans = [];
for (const file of files) {
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  if (Array.isArray(data.products)) plans.push({ file, data });
}
if (plans.length === 0) throw new Error("Nenhum plano reconciliado encontrado.");

const products = plans.flatMap(({ data }) => data.products ?? []);
if (products.length === 0) throw new Error("Planos reconciliados sem produtos.");
const sourceKeys = products.map((product) => clean(product.sourceKey));
if (sourceKeys.some((key) => !key)) throw new Error("Produto sem sourceKey no plano final.");
if (new Set(sourceKeys).size !== sourceKeys.length)
  throw new Error("sourceKey duplicada no plano final.");

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
const rows = await request(`
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
    (select count(*)::int from public.product_variants v join selected_products p on p.id = v.product_id) as variants,
    (select count(*)::int from public.product_variants v join selected_products p on p.id = v.product_id where v.status::text = 'active') as active_variants,
    (select count(*)::int from public.product_images i join selected_products p on p.id = i.product_id where i.status::text = 'ready' and i.image_source = 'google_photos') as ready_google_images,
    (select min(catalog_code) from selected_products) as first_catalog_code,
    (select max(catalog_code) from selected_products) as last_catalog_code;
`);
const database = rows?.[0];
if (!database) throw new Error("Verificação final não retornou dados.");

const protectedRows = await request(`
  select
    (select count(*)::int from public.orders) as orders,
    (select count(*)::int from public.order_items) as order_items,
    (select count(*)::int from public.profiles) as profiles,
    (select count(*)::int from public.affiliates) as affiliates;
`);
const after = protectedRows?.[0];
if (!after) throw new Error("Não foi possível verificar o estado protegido.");
for (const key of ["orders", "order_items", "profiles", "affiliates"]) {
  if (Number(before[key]) !== Number(after[key])) {
    throw new Error(`Estado protegido alterado em ${key}: ${before[key]} -> ${after[key]}`);
  }
}

const expected = {
  products: products.length,
  active_products: products.length,
  distinct_source_keys: products.length,
  missing_catalog_codes: 0,
  distinct_catalog_codes: products.length,
  variants: plannedVariants,
  active_variants: plannedVariants,
  ready_google_images: plannedImages,
};
for (const [key, value] of Object.entries(expected)) {
  if (Number(database[key]) !== Number(value)) {
    throw new Error(
      `Verificação final falhou em ${key}: esperado ${value}, recebido ${database[key]}`,
    );
  }
}

const sampleRows = await request(`
  select p.slug, p.name, p.catalog_code, c.slug as category_slug
  from public.products p
  left join public.categories c on c.id = p.primary_category_id
  where p.catalog_source_key = any(${sourceArray})
  order by p.catalog_code asc;
`);
if (sampleRows.length !== products.length) {
  throw new Error(`Amostras: esperado ${products.length}, recebido ${sampleRows.length}.`);
}
const sampleIndexes = [
  ...new Set([
    0,
    Math.floor((sampleRows.length - 1) * 0.2),
    Math.floor((sampleRows.length - 1) * 0.4),
    Math.floor((sampleRows.length - 1) * 0.6),
    Math.floor((sampleRows.length - 1) * 0.8),
    sampleRows.length - 1,
  ]),
].filter((index) => index >= 0 && index < sampleRows.length);
const result = {
  planned: { products: products.length, variants: plannedVariants, images: plannedImages },
  database,
  protectedBefore: before,
  protectedAfter: after,
  groups: plans.map(({ file, data }) => ({
    file: path.basename(file),
    group: data.pdfGroupName ?? data.pdfGroupId ?? path.basename(file, ".json"),
    products: data.products.length,
    variants: data.products.reduce((sum, product) => sum + (product.variants?.length ?? 0), 0),
    images: data.products.reduce(
      (sum, product) =>
        sum +
        (product.variants ?? []).reduce(
          (inner, variant) => inner + (variant.images?.length ?? 0),
          0,
        ),
      0,
    ),
  })),
  samples: sampleIndexes.map((index) => sampleRows[index]),
};
fs.mkdirSync(path.dirname(path.resolve(options.output)), { recursive: true });
fs.writeFileSync(path.resolve(options.output), `${JSON.stringify(result, null, 2)}\n`, "utf8");
console.log("PDF_REMAINING_DB_VERIFICATION");
console.log(JSON.stringify(result, null, 2));
console.log(
  `PDF_REMAINING_DB_OK products=${products.length} variants=${plannedVariants} images=${plannedImages}`,
);
